#!/usr/bin/env node

'use strict';

const os = require('os');
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const { spawn, spawnSync }= require('child_process');
const config = require('./libs/config');
const Jail = require('./libs/jails/jail');

(async _ => {

    const argv = yargs
        .option('n', {
            alias: 'name',
            type: 'string',
            describe: 'name of container.'
        })
        .demandOption(['name'])
        .argv;

    let jailFile = Jail.confFileByName(argv.name);

    spawnSync(
        'jail',
        ['-f', jailFile, '-r', argv.name], 
        { stdio: 'inherit' }
    );

    fs.unlinkSync(jailFile);

})().catch(error => { console.log(error); });
