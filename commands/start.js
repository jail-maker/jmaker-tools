'use strict';

const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const uuid4 = require('uuid/v4');
const prequest = require('request-promise-native');
const { spawn, spawnSync } = require('child_process');
const { ensureDir, copy, pathExists } = require('fs-extra');
const mountNullfs = require('../libs/mount-nullfs');
const zfs = require('../libs/zfs');
const ManifestFactory = require('../libs/manifest-factory');
const CommandInvoker = require('../libs/command-invoker');
const config = require('../libs/config');
const Jail = require('../libs/jail');
const JailConfig = require('../libs/jails/config-file');
const ruleViewVisitor = require('../libs/jails/rule-view-visitor');
const Rctl = require('../libs/rctl');
const Cpuset = require('../libs/cpuset');
const umount = require('../libs/umount');
const Redis = require('ioredis');

module.exports.desc = 'command for start container';

module.exports.builder = yargs => {

    yargs
        .option('r', {
            alias: 'rules',
            type: 'array',
            default: [],
            describe: 'runtime rules for container.'
        })
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'name of container.'
        })
        .option('m', {
            alias: 'mount',
            type: 'array',
            default: [],
            describe: 'host folder mount in container.\n Example: ./:/mnt/mount',
        })
        .option('vol', {
            alias: 'volume',
            type: 'array',
            default: [],
            describe: 'volume mount in container.\n Example: my-volume:/mnt/my-volume',
        })
        .option('nat', {
            type: 'boolean',
            default: false,
            describe: 'getting ip via local network agent.',
        })
        .demandOption(['name']);

}

module.exports.handler = async argv => {

    if (Jail.isWorking(argv.name)) {

        throw new Error(`Container ${argv.name} already working.`);

    }

    let redis = new Redis;
    let invoker = new CommandInvoker;
    let submitOrUndoAll = invoker.submitOrUndoAll.bind(invoker);
    let dataset = path.join(config.containersLocation, argv.name);
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);
    let clonedManifest = manifest.clone();
    let containerName = argv.name;
    let jailConfigFile = Jail.confFileByName(manifest.name);

    zfs.ensureSnapshot(dataset, config.specialSnapName);
    zfs.rollback(dataset, config.specialSnapName);

    argv.rules
        .forEach(item => {

            let [key, value = true] = item.split('=');
            manifest.rules[key] = value;

        });

    {
        let promises = argv.mount
            .map(async item => {

                let [from, to] = item.split(':');
                if (!to && from) to = from;

                from = path.resolve(from);
                to = path.resolve(to);

                let mountPath = path.join(datasetPath, to);

                await ensureDir(mountPath);

                if (!(await pathExists(from))) {

                    await copy(path.join(mountPath, '/'), path.join(src, '/'));

                }

                await submitOrUndoAll({

                    async exec() {

                        mountNullfs(from, mountPath);
                        await redis.lpush(`jmaker:mounts:${manifest.name}`, mountPath);

                    },
                    async unExec() {

                        umount(mountPath, true);
                        await redis.del(`jmaker:mounts:${manifest.name}`);

                    },

                });

            });

        await Promise.all(promises);
    }

    {
        let promises = argv.volume
            .map(async item => {

                let [volume, to] = item.split(':');
                to = path.resolve(to);
                let mountPath = path.join(datasetPath, to);

                await ensureDir(mountPath);

                let volumeDataset = path.join(config.volumesLocation, volume);
                if (!zfs.has(volumeDataset)) 
                    throw new Error(`volume "${volume}" not found.`);

                let from = zfs.get(volumeDataset, 'mountpoint');

                await submitOrUndoAll({

                    async exec() {

                        mountNullfs(from, mountPath);
                        await redis.lpush(`jmaker:mounts:${manifest.name}`, mountPath);

                    },
                    async unExec() {

                        umount(mountPath, true);
                        await redis.del(`jmaker:mounts:${manifest.name}`);

                    },

                });

            });

        await Promise.all(promises);
    }

    if (manifest['resolv-sync']) {

        console.log('resolv.conf sync... ');

        fs.copyFileSync(
            '/etc/resolv.conf',
            `${datasetPath}/etc/resolv.conf`
        );

        console.log('done');

    }

    if (argv.nat) {

        let endpoint = `${config.localNetworkAgentAddr}/api/v1/free-ip`;
        let body = await submitOrUndoAll(async _ => await prequest.get(endpoint));
        body = JSON.parse(body);
        let {
            iface,
            ip,
        } = body;

        console.log(body, iface, ip);

        manifest.rules['ip4.addr'] = `${iface}|${ip}`;

    }

    manifest.rules.persist = true;
    manifest.rules.path = datasetPath;

    let jailConfig = new JailConfig(manifest.name, manifest.rules);
    jailConfig.accept(ruleViewVisitor);
    jailConfig.save(jailConfigFile);

    await submitOrUndoAll({

        exec() { Jail.start(manifest.name); },
        unExec() { Jail.stop(manifest.name); },

    });

    for (let index in manifest.starting) {

        let obj = manifest.starting[index];
        let commandName = Object.keys(obj)[0];
        let args = obj[commandName];

        let commandPath = `../launcher-commands/${commandName}-command`;
        let CommandClass = require(commandPath);
        let command = new CommandClass({
            index,
            dataset,
            datasetPath,
            manifest,
            redis,
            args,
        });

        await submitOrUndoAll(command);

    }

    let jailInfo = Jail.getInfo(manifest.name);

    {
        let payload = {
            eventName: 'started',
            info: jailInfo,
            manifest,
        }

        await redis.publish('jmaker:containers:started', JSON.stringify(payload));
    }

    await redis.disconnect();

}
