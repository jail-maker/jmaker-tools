'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const consul = require('consul')({promisify: true});
const yargs = require('yargs');
const { spawn, spawnSync } = require('child_process');
const config = require('../libs/config');
const Jail = require('../libs/jail');
const zfs = require('../libs/zfs');
const ManifestFactory = require('../libs/manifest-factory');
const Redis = require('ioredis');

module.exports.desc = 'command for stop container';

module.exports.builder = yargs => {

    yargs
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'name of container.'
        })
        .demandOption(['name'])

}

module.exports.handler = async argv => {

    let dataset = path.join(config.containersLocation, argv.name);
    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = ManifestFactory.fromJsonFile(manifestFile);
    let jailInfo = Jail.getInfo(argv.name);

    {
        let redis = new Redis;
        let payload = {
            eventName: 'stoped',
            info: jailInfo,
            manifest,
        };

        await redis.publish('jmaker:containers:stoped', JSON.stringify(payload));
        await redis.disconnect();
    }

    Jail.stop(argv.name);
    fs.unlinkSync(Jail.confFileByName(argv.name));

}
