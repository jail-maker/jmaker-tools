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
const appState = require('../libs/application-state');
const foldersSync = require('../libs/folders-sync');
const Rctl = require('../libs/rctl');
const Cpuset = require('../libs/cpuset');
const Redis = require('ioredis');

module.exports = async args => {

    let {
        tty,
        rm = false,
        nat = false,
        rules = {},
        from = '',
        name = '',
        env = {},
        mounts = [],
        volumes = [],
        entry = null,
        command = '',
    } = args;

    let invoker = new CommandInvoker;
    let submitOrUndoAll = invoker.submitOrUndoAll.bind(invoker);
    let commandArgs = command;
    let containerName = name ? name : uuid4();
    let datasetFrom = path.join(config.containersLocation, from);
    let datasetNew = path.join(config.containersLocation, containerName);

    zfs.ensureSnapshot(datasetFrom, config.specialSnapName);

    await submitOrUndoAll({
        exec() {
            zfs.clone(datasetFrom, config.specialSnapName, datasetNew);
        },
        unExec() {
            if (rm) zfs.destroy(datasetNew);
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

    Object.assign(manifest.env, env);
    Object.assign(manifest.rules, rules);

    if (entry !== null) manifest.entry = entry;

    {
        let promises = mounts
            .map(async item => {

                let { src, dest } = item;
                let mountPath = path.join(datasetPath, dest);

                await ensureDir(mountPath);

                if (!(await pathExists(src))) {

                    await foldersSync(path.join(mountPath, '/'), path.join(src, '/'));

                }

                await submitOrUndoAll({

                    async exec() {

                        mountNullfs(src, mountPath);

                    },
                    async unExec() {

                        umount(mountPath, true);

                    },

                });

            });

        await Promise.all(promises);
    }

    {
        volumes = manifest.volumes.concat(volumes);

        let promises = volumes
            .map(async ({name, to}) => {

                to = path.resolve(to);
                let mountPath = path.join(datasetPath, to);

                await ensureDir(mountPath);

                let volumeDataset = path.join(config.volumesLocation, name);

                if (!zfs.has(volumeDataset)) {

                    zfs.ensureDataset(volumeDataset);
                    let src = zfs.get(volumeDataset, 'mountpoint');
                    await foldersSync(path.join(mountPath, '/'), path.join(src, '/'));

                }

                let from = zfs.get(volumeDataset, 'mountpoint');
                let {uid, gid} = fs.statSync(mountPath);

                fs.chownSync(from, uid, gid);

                await submitOrUndoAll({

                    async exec() {

                        mountNullfs(from, mountPath);

                    },
                    async unExec() {

                        umount(mountPath, true);

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

    if (nat) {

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

    await submitOrUndoAll({

        exec() { jailConfig.save(jailConfigFile); },
        unExec() { fs.unlinkSync(jailConfigFile); },

    });

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

    await submitOrUndoAll({
        exec() { appState.invokers[manifest.name] = invoker; },
        unExec() { delete(appState.invokers[manifest.name]); },
    });

    command = command ? command : manifest.command;

    if (command) {

        let commandPath = `../launcher-commands/run-command`;
        let CommandClass = require(commandPath);
        let commandObj = new CommandClass({
            index: 0,
            dataset,
            datasetPath,
            manifest,
            redis,
            tty,
            args: command,
        });

        await submitOrUndoAll(commandObj);

    }

    await invoker.undoAll();
    await redis.disconnect();

}
