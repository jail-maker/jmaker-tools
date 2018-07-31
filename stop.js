#!/usr/bin/env node

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const consul = require('consul')({promisify: true});
const yargs = require('yargs');
const { spawn, spawnSync } = require('child_process');
const config = require('./libs/config');
const Jail = require('./libs/jail');
const zfs = require('./libs/zfs');
const ManifestFactory = require('./libs/manifest-factory');
const Redis = require('ioredis');
const redis = new Redis;

(async _ => {

    const argv = yargs
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'name of container.'
        })
        .demandOption(['name'])
        .argv;

    let dataset = path.join(config.containersLocation, argv.name);
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);
    let jailInfo = Jail.getInfo(argv.name);

    {
        let payload = {
            eventName: 'stoped',
            info: jailInfo,
            manifest,
        };

        await redis.publish('jmaker:containers:stoped', JSON.stringify(payload));
        redis.disconnect();
    }

    Jail.stop(argv.name);
    fs.unlinkSync(Jail.confFileByName(argv.name));

    let services = [];
    services.push(manifest.rules['host.hostname']);

    for (let key in manifest.services) {

        let hostname = `${key}.${manifest.rules['host.hostname']}`;
        services.push(hostname);

    }

    services.forEach(async service => {

        try {

            await consul.agent.service.deregister(service);

        } catch (error) {

            console.log('service not registred');
            console.log(error);

        }

    });

})().catch(error => { console.log(error); });
