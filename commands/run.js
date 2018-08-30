'use strict';

const os = require('os');
const fs = require('fs');
const { ensureDir, copy, pathExists } = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const uuid4 = require('uuid/v4');
const { spawn, spawnSync } = require('child_process');
const zfs = require('../libs/zfs');
const ManifestFactory = require('../libs/manifest-factory');
const CommandInvoker = require('../libs/command-invoker');
const config = require('../libs/config');
const Jail = require('../libs/jail');
const JailConfig = require('../libs/jails/config-file');
const ruleViewVisitor = require('../libs/jails/rule-view-visitor');
const mountNullfs = require('../libs/mount-nullfs');
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
        .demandOption(['from']);

}

module.exports.handler = async argv => {

    let commandArgs = argv._.slice(1);
    let containerName = argv.n ? argv.n : uuid4();
    let datasetFrom = path.join(config.containersLocation, argv.from);
    let datasetNew = path.join(config.containersLocation, containerName);

    zfs.clone(datasetFrom, config.specialSnapName, datasetNew);

    let dataset = datasetNew;
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);

    manifest.name = containerName;

    let jailConfigFile = Jail.confFileByName(manifest.name);
    let clonedManifest = manifest.clone();
    let invoker = new CommandInvoker;
    let redis = new Redis;

    manifest.toFile(manifestFile);

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

                console.log(from, to);

                let mountPath = path.join(datasetPath, to);

                await ensureDir(mountPath);

                if (!(await pathExists(from))) {

                    await copy(path.join(mountPath, '/'), path.join(src, '/'));

                }

                mountNullfs(from, mountPath);
                await redis.lpush(`jmaker:mounts:${manifest.name}`, mountPath);

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

                mountNullfs(from, mountPath);
                await redis.lpush(`jmaker:mounts:${manifest.name}`, mountPath);

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

    manifest.rules.persist = true;
    manifest.rules.path = datasetPath;

    let jailConfig = new JailConfig(manifest.name, manifest.rules);
    jailConfig.accept(ruleViewVisitor);
    jailConfig.save(jailConfigFile);

    Jail.start(manifest.name);

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

    await invoker.submitOrUndoAll(command);

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

