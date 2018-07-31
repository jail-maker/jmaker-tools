#!/usr/bin/env node

'use strict';

const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const consul = require('consul')({promisify: true});
const path = require('path');
const yargs = require('yargs');
const uuid4 = require('uuid/v4');
const { spawn, spawnSync } = require('child_process');
const zfs = require('./libs/zfs');
const ManifestFactory = require('./libs/manifest-factory');
const CommandInvoker = require('./libs/command-invoker');
const config = require('./libs/config');
const Jail = require('./libs/jail');
const ConfigFile = require('./libs/jails/config-file.js');
const ruleViewVisitor = require('./libs/jails/rule-view-visitor');
const autoIfaceVisitor = require('./libs/jails/auto-iface-visitor');
const autoIpVisitor = require('./libs/jails/auto-ip-visitor');
const Rctl = require('./libs/rctl');
const Cpuset = require('./libs/cpuset');
const Redis = require('ioredis');
const redis = new Redis;

(async _ => {

    console.log(config);

    const argv = yargs
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
        .option('volume', {
            type: 'array',
            default: [],
            describe: 'volumes for container.\n Example: ./:/mnt/volume /var/db:/var/db'
        })
        .demandOption(['name'])
        .argv;

    if (Jail.isWorking(argv.name)) {

        throw new Error(`Container ${argv.name} already working.`);

    }

    let dataset = path.join(config.containersLocation, argv.name);
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);
    let clonedManifest = manifest.clone();
    let invoker = new CommandInvoker;
    let containerName = argv.name;

    argv.rules
        .forEach(item => {

            let [key, value = true] = item.split('=');
            manifest.rules[key] = value;

        });

    argv.volume
        .forEach(item => {

            let [from, to] = item.split(':');
            if (!to && from) [to, from] = [from, to];

            manifest.starting.push({ volume: {from, to}});

        });

    zfs.ensureSnapshot(dataset, config.specialSnapName);
    zfs.rollback(dataset, config.specialSnapName);

    if (manifest['resolv-sync']) {

        console.log('resolv.conf sync... ');

        fs.copyFileSync(
            '/etc/resolv.conf',
            `${datasetPath}/etc/resolv.conf`
        );

        console.log('done');

    }

    for (let index in manifest.starting) {

        let obj = manifest.starting[index];
        let commandName = Object.keys(obj)[0];
        let args = obj[commandName];

        let commandPath = `./launcher-commands/${commandName}-command`;
        let CommandClass = require(commandPath);
        let command = new CommandClass({
            index,
            dataset,
            datasetPath,
            manifest,
            args,
        });

        await invoker.submitOrUndoAll(command);

    }

    if (manifest.quota) zfs.set(dataset, 'quota', manifest.quota);

    let configObj = null;

    {

        let rules = Object.assign({}, manifest.rules);
        rules.path = datasetPath;
        configObj = new ConfigFile(manifest.name, rules);

    }

    {

        let command = {
            async exec() {

                configObj
                    .accept(autoIfaceVisitor)
                    .accept(autoIpVisitor)
                    .accept(ruleViewVisitor);

            },
            async unExec() {}
        };

        await invoker.submitOrUndoAll(command);

    }

    configObj.save(Jail.confFileByName(manifest.name));

    console.log('rctl... ');
    let rctlObj = new Rctl({
        rulset: manifest.rctl,
        jailName: manifest.name
    });

    await invoker.submitOrUndoAll(rctlObj);
    console.log('done\n');

    {
        console.log('jail starting...\n');

        let command = {
            exec: async _ => Jail.start(manifest.name),
            unExec: async _ => Jail.stop(manifest.name),
        };

        await invoker.submitOrUndoAll(command);
        console.log('done\n');
    }

    let jailInfo = Jail.getInfo(manifest.name);

    if (manifest.cpus) {

        let cpus = parseInt(manifest.cpus);
        let osCpus = os.cpus().length;
        cpus = cpus < osCpus ? cpus : osCpus;

        if (cpus === 1) manifest.cpuset = '0';
        else manifest.cpuset = `0-${cpus - 1}`;

    }

    if (manifest.cpuset !== false) {

        console.log('cpuset... ');

        try {

            let cpuset = new Cpuset({
                jid: jailInfo.jid, value: manifest.cpuset 
            });
            await invoker.submitOrUndoAll(cpuset);

        } catch (error) {

            await invoker.undoAll();
            throw error;

        }

        console.log('done\n');

    }

    {
        let payload = {
            eventName: 'started',
            info: jailInfo,
            manifest,
        }

        await redis.publish('jmaker:containers:started', JSON.stringify(payload));
        redis.disconnect();
    }

    {

        try {

            let {
                port = 9898,
                proto = 'tcp',
            } = manifest.service;

            let body = {
                name: jailInfo['host.hostname'],
                tags: [
                    `urlprefix-${jailInfo['host.hostname']}/ proto=${proto}`,
                ],
                port: parseInt(port),
                address: jailInfo['ip4.addr'],
                check: {
                    name: `Check port ${port}`,
                    tcp: `${jailInfo['ip4.addr']}:${port}`,
                    interval: '30s',
                    timeout: '1s',
                },
            };

            await consul.agent.service.register(body);

        } catch (error) {

            console.log('service not register.');
            console.log(error);

        }

    }

    for (let key in manifest.services) {

        let service = key;
        let hostname = `${service}.${jailInfo['host.hostname']}`;
        let {
            port = 0,
            proto = 'tcp',
        } = manifest.services[key];

        let body = {
            name: hostname,
            tags: [
                `urlprefix-${hostname}/ proto=${proto}`,
            ],
            port: parseInt(port),
            address: jailInfo['ip4.addr'],
            check: {
                name: `Check port ${port}`,
                tcp: `${jailInfo['ip4.addr']}:${port}`,
                interval: '30s',
                timeout: '1s',
            },
        };

        await consul.agent.service.register(body);

    }

})().catch(error => { console.log(error); });

