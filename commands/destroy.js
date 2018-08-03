'use strict';

const zfs = require('../libs/zfs');
const config = require('../libs/config');
const yargs = require('yargs');
const path = require('path');
const Jail = require('../libs/jail');

module.exports.desc = 'command for destroing container';

module.exports.builder = yargs => {

    yargs
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'name of container.'
        })
        .demandOption(['name']);

}

module.exports.handler = async argv => {

    if (Jail.isWorking(argv.name)) {

        Jail.stop(argv.name);

    }

    let dataset = path.join(config.containersLocation, argv.name);

    if (zfs.has(dataset)) {

        zfs.destroy(dataset);

    } else {

        throw new Error(`Container "${name}" not exists.`)

    }

}
