'use strict';

const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const yaml = require('js-yaml');
const { spawn, spawnSync }= require('child_process');
const diff = require('../libs/folders-diff');
const zfs = require('../libs/zfs');
const ManifestFactory = require('../libs/manifest-factory');
const CommandInvoker = require('../libs/command-invoker');
const mountDevfs = require('../libs/mount-devfs');
const mountNullfs= require('../libs/mount-nullfs');
const mountFdescfs = require('../libs/mount-fdescfs');
const mountProcfs = require('../libs/mount-procfs');
const umount = require('../libs/umount');
const config = require('../libs/config');
const Jail = require('../libs/jail');
const JailConfig = require('../libs/jails/config-file');
const ruleViewVisitor = require('../libs/jails/rule-view-visitor');

const MANIFEST_NAME = 'manifest.json';

module.exports.desc = 'command for create container';

module.exports.builder = yargs => {

    yargs
        .option('m', {
            alias: 'manifest',
            default: './jmakefile.yml',
        })
        .option('c', {
            alias: 'context',
            default: './',
        })
        .demandOption(['manifest', 'context'])

}

module.exports.handler = async argv => {

    console.log(config);

    let file = path.resolve(argv.manifest);
    let manifest = ManifestFactory.fromYamlFile(file);
    let clonedManifest = manifest.clone();
    let invoker = new CommandInvoker;
    let newDataset = path.join(config.containersLocation, manifest.name);

    if (zfs.has(newDataset))
        throw new Error(`dataset "${manifest.name}" already exists.`);

    console.log(newDataset);

    if (!manifest.from) 
        throw new Error(`field "from" is empty.`);

    let fromDataset = "";

    {
        let regex = /^(\w+)(\-([\w\.]+))?$/;
        let matches = manifest.from.match(regex);

        if (!matches) throw new Error('incorrect from.');

        let [_1, from, _2, version] = matches;
        fromDataset = path.join(config.containersLocation, from);
    }

    if (!zfs.has(fromDataset)) {

        console.log(`dataset for container "${from}" not exists.`)
        console.log(`fetching container "${manifest.from}" from remote repository.`)

        let result = spawnSync('pkg', [
            'install', '-y', manifest.from,
        ], { stdio: 'inherit' });

        if (result.status) {

            let msg = `container "${manifest.from}" not found in remote repository.`;
            throw new Error(msg);

        }
    
    }

    zfs.ensureSnapshot(fromDataset, config.specialSnapName);
    zfs.clone(fromDataset, config.specialSnapName, newDataset);

    let datasetPath = zfs.get(newDataset, 'mountpoint');
    let fromDatasetPath = zfs.get(fromDataset, 'mountpoint');
    let manifestOutPath = path.join(datasetPath, MANIFEST_NAME);
    let fromManifestOutPath = path.join(fromDatasetPath, MANIFEST_NAME);
    let srcContextPath = path.resolve(argv.context);
    let contextPath = path.join(datasetPath, '/media/context');
    let fromManifest = ManifestFactory.fromJsonFile(fromManifestOutPath);
    let jailConfigFile = Jail.confFileByName(manifest.name);

    {

        let {osreldate, osrelease} = fromManifest.rules;

        if (!osreldate || !osrelease)
            throw new Error('not set "osreldate" or "osrelease" in base container.');

        manifest.rules.osreldate = osreldate;
        manifest.rules.osrelease = osrelease;
        manifest.rules.persist = true;

    }

    let rules = {...manifest.rules};

    rules['ip4.addr'] = [];
    rules['ip6.addr'] = [];
    rules.ip4 = "inherit";
    rules.ip6 = "inherit";
    rules.path = datasetPath;

    let jailConfig = new JailConfig(manifest.name, rules);
    jailConfig.accept(ruleViewVisitor);
    jailConfig.save(jailConfigFile);

    await fse.ensureDir(contextPath);
    mountNullfs(srcContextPath, contextPath, ['ro']);

    Jail.start(manifest.name);

    {

        let CommandClass = require('../builder-commands/workdir-command');
        let command = new CommandClass({
            index: 0,
            dataset: newDataset,
            datasetPath,
            context: contextPath,
            manifest,
            args: manifest.workdir,
        });

        await invoker.submitOrUndoAll(command);

    }

    // for (let index in manifest.building) {

    //     let obj = manifest.building[index];
    //     let commandName = Object.keys(obj)[0];
    //     let args = obj[commandName];

    //     let commandPath = `../builder-commands/${commandName}-command`;
    //     let CommandClass = require(commandPath);
    //     let command = new CommandClass({
    //         index,
    //         dataset: newDataset,
    //         datasetPath,
    //         context: contextPath,
    //         manifest,
    //         args,
    //     });

    //     await invoker.submitOrUndoAll(command);

    // }

    Jail.stop(manifest.name);

    umount(contextPath, true);

    manifest.toFile(manifestOutPath);

    zfs.snapshot(newDataset, config.specialSnapName);

}