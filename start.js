#!/usr/bin/env node

'use strict';

const os = require('os');
const fs = require('fs');
const fse = require('fs-extra');
const consul = require('consul')({promisify: true});
const path = require('path');
const yargs = require('yargs');
const uuid4 = require('uuid/v4');
const { spawn, spawnSync }= require('child_process');
const zfs = require('./libs/zfs');
const ManifestFactory = require('./libs/manifest-factory');
const CommandInvoker = require('./libs/command-invoker');
const config = require('./libs/config');
const Jail = require('./libs/jails/jail');
const ruleViewVisitor = require('./libs/jails/rule-view-visitor');
const autoIfaceVisitor = require('./libs/jails/auto-iface-visitor');
const autoIpVisitor = require('./libs/jails/auto-ip-visitor');
const Rctl = require('./libs/rctl');
const Cpuset = require('./libs/cpuset');


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

    let jail = new Jail({
        manifest,
        dataset,
        datasetPath,
    });

    let configObj = jail.configFileObj;

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
            exec: async _ => jail.start(),
            unExec: async _ => jail.stop(),
        };

        await invoker.submitOrUndoAll(command);
        console.log('done\n');
    }

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
                jid: jail.info.jid, value: manifest.cpuset 
            });
            await invoker.submitOrUndoAll(cpuset);

        } catch (error) {

            await invoker.undoAll();
            throw error;

        }

        console.log('done\n');

    }

    {

        console.dir(jail.info);

        try {

            let body = {
                name: jail.info.name,
                tags: [
                    `urlprefix-${jail.info['host.hostname']}/`,
                ],
                port: 80,
                address: jail.info['ip4.addr'],
                check: {
                    id: 'nc',
                    name: 'Check nc port 9898',
                    tcp: `${jail.info['ip4.addr']}:9898`,
                    interval: '30s',
                    timeout: '1s',
                },
            };

            // body.id = uuid4();
            // body.address: jail.info['ip4.addr'];
            await consul.agent.service.register(body);

            // body.id = uuid4();
            // body.address: jail.info['ip6.addr'];
            // await consul.agent.service.register(body);

        } catch (error) {

            console.log('service not register.');
            console.log(error);

        }

    }

})().catch(error => { console.log(error); });

