#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const yaml = require('js-yaml');
const diff = require('./libs/folders-diff');
const zfs = require('./libs/zfs');
const ManifestFactory = require('./libs/manifest-factory');

const configFile = './config.yml';

const configContent = fs.readFileSync(configFile, 'utf-8');
const config = yaml.safeLoad(configContent);

const argv = yargs
    .option('manifest', {
        default: './jmakefile.yml',
    })
    .demandOption(['manifest'])
    .argv;

let file = path.resolve(argv.manifest);
let manifest = ManifestFactory.fromYamlFile(file);

console.dir(manifest);

let newDataset = path.join(config.containersLocation, manifest.name);

if (manifest.from) {

    let fromDataset = path.join(config.containersLocation, manifest.from);
    zfs.clone(fromDataset, config.specialSnapName, newDataset);

}

let datasetPath = zfs.get(newDataset, 'mountpoint');

for (let index in manifest.building) {

    let obj = manifest.building[index];
    let commandName = Object.keys(obj)[0];
    let args = obj[commandName];

    let commandPath = `../builder-commands/${commandName}-command`;
    let CommandClass = require(commandPath);
    let command = new CommandClass({
        index,
        dataset: containerDataset,
        manifest,
        containerId,
        context,
        scope,
        args,
    });

    await invoker.submit(command);

}

zfs.snapshot(newDataset, config.specialSnapName);
