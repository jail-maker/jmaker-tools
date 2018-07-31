#!/usr/bin/env node

'use strict';

const zfs = require('./libs/zfs');
const config = require('./libs/config');
const yargs = require('yargs');
const path = require('path');
const Jail = require('./libs/jail');

(async _ => {

    const argv = yargs
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'name of container.'
        })
        .demandOption(['name'])
        .argv;

    if (Jail.isWorking(argv.name)) {

        Jail.stop(argv.name);

    }

    let dataset = path.join(config.containersLocation, argv.name);

    if (zfs.has(dataset)) {

        zfs.destroy(dataset);

    } else {

        throw new Error(`Container "${name}" not exists.`)

    }

})();


