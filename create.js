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
const config = require('./libs/config');

console.log(config);

const argv = yargs
    .option('manifest', {
        default: './jmakefile.yml',
    })
    .demandOption(['manifest'])
    .argv;

let file = path.resolve(argv.manifest);
let manifest = ManifestFactory.fromYamlFile(file);
let clonedManifest = manifest.clone();

console.dir(manifest);

let newDataset = path.join(config.containersLocation, manifest.name);

if (zfs.has(newDataset))
    throw new Error(`dataset "${manifest.name}" already exists.`);

console.log(newDataset);

if (manifest.from) {

    let fromDataset = path.join(config.containersLocation, manifest.from);

    if (!zfs.has(fromDataset))
        throw new Error(`dataset "${manifest.from}" not exists.`);

    zfs.ensureSnapshot(fromDataset, config.specialSnapName);
    zfs.clone(fromDataset, config.specialSnapName, newDataset);

} else {

    console.log('new dataset');
    zfs.create(newDataset);

}

let datasetPath = zfs.get(newDataset, 'mountpoint');

(async _ => {

    let invoker = new CommandInvoker;
    let contextPath = path.join(datasetPath, '/media/context');

    {

        let dev = path.join(datasetPath, '/dev');
        let fd = path.join(datasetPath, '/dev/fd');
        let proc = path.join(datasetPath, '/proc');
        let srcContextPath = path.resolve('./');

        await fse.ensureDir(dev);
        await fse.ensureDir(fd);
        await fse.ensureDir(proc);
        await fse.ensureDir(contextPath);

        let exitHandler = _ => {

            umount(dev, true);
            umount(fd, true);
            umount(proc, true);
            umount(contextPath, true);

        };

        process.on('exit', exitHandler);
        process.on('SIGINT', exitHandler);
        process.on('SIGTERM', exitHandler);

        mountDevfs(dev);
        mountFdescfs(fd);
        mountProcfs(proc);
        mountNullfs(srcContextPath, contextPath, ['ro']);


    }

    for (let index in manifest.building) {

        let obj = manifest.building[index];
        let commandName = Object.keys(obj)[0];
        let args = obj[commandName];

        let commandPath = `./builder-commands/${commandName}-command`;
        let CommandClass = require(commandPath);
        let command = new CommandClass({
            index,
            dataset: newDataset,
            datasetPath,
            context: contextPath,
            manifest,
            args,
        });

        await invoker.submitOrUndoAll(command);

    }

    zfs.snapshot(newDataset, config.specialSnapName);

})();

