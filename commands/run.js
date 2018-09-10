'use strict';

const os = require('os');
const fs = require('fs');
const { ensureDir, copy, pathExists } = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const uuid4 = require('uuid/v4');
const prequest = require('request-promise-native');
const { spawn, spawnSync } = require('child_process');
const zfs = require('../libs/zfs');
const ManifestFactory = require('../libs/manifest-factory');
const CommandInvoker = require('../libs/command-invoker');
const config = require('../libs/config');
const Jail = require('../libs/jail');
const JailConfig = require('../libs/jails/config-file');
const ruleViewVisitor = require('../libs/jails/rule-view-visitor');
const mountNullfs = require('../libs/mount-nullfs');
const umount = require('../libs/umount');
const Rctl = require('../libs/rctl');
const Cpuset = require('../libs/cpuset');
const Redis = require('ioredis');

module.exports.desc = 'command for start container';

module.exports.builder = yargs => {

    return yargs
        .option('r', {
            alias: 'rules',
            type: 'array',
            default: [],
            describe: 'runtime rules for container.'
        })
        .option('from', {
            type: 'string',
            describe: 'name of base container.'
        })
        .option('n', {
            alias: 'set-name',
            type: 'string',
            describe: 'set name for new container.'
        })
        .option('e', {
            alias: 'env',
            type: 'array',
            default: [],
            describe: 'set environment variable.'
        })
        .option('rm', {
            type: 'boolean',
            describe: 'remove container after run.'
        })
        .option('m', {
            alias: 'mount',
            type: 'array',
            default: [],
            describe: 'mount host folder in container.\n Example: ./:/mnt/my-folder'
        })
        .option('vol', {
            alias: 'volume',
            type: 'array',
            default: [],
            describe: 'mount volume in container.\n Example: my-volume:/mnt/volume'
        })
        .option('nat', {
            type: 'boolean',
            default: false,
            describe: 'getting ip via local network agent.',
        })
        .demandOption(['from']);

}

module.exports.handler = async argv => {

    let invoker = new CommandInvoker;
    let submitOrUndoAll = invoker.submitOrUndoAll.bind(invoker);
    let commandArgs = argv._.slice(1);
    let containerName = argv.n ? argv.n : uuid4();
    let datasetFrom = path.join(config.containersLocation, argv.from);
    let datasetNew = path.join(config.containersLocation, containerName);

    zfs.ensureSnapshot(datasetFrom, config.specialSnapName);

    await submitOrUndoAll({
        exec() {
            zfs.clone(datasetFrom, config.specialSnapName, datasetNew);
        },
        unExec() {
            zfs.destroy(datasetNew);
        }
    });

    let dataset = datasetNew;
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);

    manifest.name = containerName;

    let jailConfigFile = Jail.confFileByName(manifest.name);
    let clonedManifest = manifest.clone();
    let redis = new Redis;

    manifest.toFile(manifestFile);

    argv.env.forEach(env => {

        let [key, value = true] = env.split('=');
        manifest.env[key] = value;

    })

    argv.rules.forEach(item => {

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
        let volumes = argv.volume
            .map(item => {

                let [name, to] = item.split(':');
                return {name, to};

            });

        volumes = manifest.volumes.concat(volumes);

        let promises = volumes
            .map(async ({name, to}) => {

                to = path.resolve(to);
                let mountPath = path.join(datasetPath, to);

                await ensureDir(mountPath);

                let volumeDataset = path.join(config.volumesLocation, name);
                if (!zfs.has(volumeDataset)) 
                    throw new Error(`volume "${name}" not found.`);

                let from = zfs.get(volumeDataset, 'mountpoint');
                let {uid, gid} = fs.statSync(mountPath);

                fs.chownSync(from, uid, gid);

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

    switch (config.dnsResolverType) {

        case "auto":

            fs.copyFileSync(
                '/etc/resolv.conf',
                `${datasetPath}/etc/resolv.conf`
            );
            break;

        case "static":

            let content = `nameserver ${config.dnsResolverAddr}`;
            fs.writeFileSync(`${datasetPath}/etc/resolv.conf`, content);
            break;

        default:

            throw new Error("dns resolver type is not set.");
            break;

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

    let jailInfo = Jail.getInfo(manifest.name);

    await submitOrUndoAll({

        async exec() { 
            let payload = {
                eventName: 'started',
                info: jailInfo,
                manifest,
            }

            await redis.publish('jmaker:containers:started', JSON.stringify(payload));
        },
        async unExec() {
            let payload = {
                eventName: 'stoped',
                info: jailInfo,
                manifest,
            }

            await redis.publish('jmaker:containers:stoped', JSON.stringify(payload));
        },

    });

    if (commandArgs.length) {

        let commandPath = `../launcher-commands/run-command`;
        let CommandClass = require(commandPath);
        let command = new CommandClass({
            index: 0,
            dataset,
            datasetPath,
            manifest,
            redis,
            args: commandArgs,
        });

        await submitOrUndoAll(command);

    } else {

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

    }

    if (argv.rm) { await invoker.undoAll(); }

    await redis.disconnect();

}
