#!/usr/bin/env node

'use strict';

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const yargs = require('yargs');
const yaml = require('js-yaml');
const diff = require('./libs/folders-diff');
const zfs = require('./libs/zfs');
const ManifestFactory = require('./libs/manifest-factory');
const CommandInvoker = require('./libs/command-invoker');
const mountDevfs = require('./libs/mount-devfs');
const mountNullfs= require('./libs/mount-nullfs');
const mountFdescfs = require('./libs/mount-fdescfs');
const mountProcfs = require('./libs/mount-procfs');
const umount = require('./libs/umount');


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

if (zfs.has(newDataset))
    throw new Error(`dataset "${manifest.name}" already exists.`);

console.log(newDataset);

if (manifest.from) {

    let fromDataset = path.join(config.containersLocation, manifest.from);

    if (!zfs.has(fromDataset))
        throw new Error(`dataset "${manifest.from}" not exists.`);

    zfs.clone(fromDataset, config.specialSnapName, newDataset);

} else {

    console.log('new dataset');
    zfs.create(newDataset);

}

let datasetPath = zfs.get(newDataset, 'mountpoint');

(async _ => {

    {
        let src = path.resolve('./');
        let dst = path.join(datasetPath, '/media/context');

        await fse.ensureDir(dst);
        mountNullfs(src, dst, ['ro']);
    }

    let invoker = new CommandInvoker;

    for (let index in manifest.building) {

        let obj = manifest.building[index];
        let commandName = Object.keys(obj)[0];
        let args = obj[commandName];

        let commandPath = `./builder-commands/${commandName}-command`;
        let CommandClass = require(commandPath);
        console.log(commandPath)
        // let command = new CommandClass({
        //     index,
        //     dataset: newDataset,
        //     manifest,
        //     args,
        // });

        // await invoker.submit(command);

    }

    zfs.snapshot(newDataset, config.specialSnapName);

})();

