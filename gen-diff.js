#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const yaml = require('js-yaml');
const diff = require('./libs/folders-diff');
const zfs = require('./libs/zfs');

const configFile = './config.yml';

const configContent = fs.readFileSync(configFile, 'utf-8');
const config = yaml.safeLoad(configContent);

const argv = yargs
    .option('src')
    .option('dst', { default: null })
    .demandOption(['src'])
    .argv;


const srcDataset = path.join(config.containersLocation, argv.src);
let srcPath = zfs.get(srcDataset, 'mountpoint');
srcPath = path.join(srcPath, `.zfs/snapshot/${config.specialSnapName}/`);

let dstPath = '';

if (argv.dst) {

    const dstDataset = path.join(config.containersLocation, argv.dst);
    dstPath = zfs.get(dstDataset, 'mountpoint');
    dstPath = path.join(dstPath, `.zfs/snapshot/${config.specialSnapName}/`);

} else dstPath = '/empty';


diff(srcPath, dstPath)
    .then(data => {
        process.stdout.write(JSON.stringify(data));
    });
