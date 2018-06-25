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
    .option('dst', { default: '/empty' })
    .demandOption(['src', 'dst'])
    .argv;

const srcDataset = path.join(config.containersLocation, argv.src);
const dstDataset = path.join(config.containersLocation, argv.dst);

let srcPath = zfs.get(srcDataset, 'mountpoint');
let dstPath = zfs.get(dstDataset, 'mountpoint');

srcPath = path.join(srcPath, `.zfs/snapshot/${config.specialSnapName}/`);
dstPath = path.join(dstPath, `.zfs/snapshot/${config.specialSnapName}/`);


diff(srcPath, dstPath)
    .then(data => {
        process.stdout.write(JSON.stringify(data));
    });
