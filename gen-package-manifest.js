#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const yaml = require('js-yaml');
const diff = require('./libs/folders-diff');
const zfs = require('./libs/zfs');
const config = require('./libs/config');
const ManifestFactory = require('./libs/manifest-factory');
const PackageManifest = require('./libs/package-manifest');


const argv = yargs
    .option('for')
    .argv;


(async _ => {

    let containerName = argv.for;
    let dataset = path.join(config.containersLocation, containerName);
    if (!zfs.has(dataset))
        throw new Error(`container "${containerName}" not exists.`);

    let datasetPath = zfs.get(dataset, 'mountpoint');
    let manifestFile = path.join(datasetPath, 'manifest.json');
    let manifest = {};

    try {

        manifest = ManifestFactory.fromJsonFile(manifestFile);

    } catch (error) {}

    let packageManifest = new PackageManifest;
    packageManifest.maintainer = config.maintainer;
    packageManifest.name = containerName;
    packageManifest.origin = `${containerName}`;

    if (manifest.from) {

        packageManifest.deps[manifest.from] = {
            version: '>0.0.0',
            origin: manifest.from,
        };

    }

    for (let key in Object.keys(packageManifest)) {

        if (manifest[key]) packageManifest[key] = manifest[key];

    }

    console.log(JSON.stringify(packageManifest));

})().catch(error => { console.log(error); });
