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

    if (manifest.from) {

        await invoker.submitOrUndoAll({

            async exec() {

                let regex = /^(\w+)(\-([\w\.]+))?$/;
                let matches = manifest.from.match(regex);
                if (!matches) throw new Error('incorrect from.');

                let [_1, from, _2, version] = matches;


                let fromDataset = path.join(config.containersLocation, from);

                if (!zfs.has(fromDataset)) {

                    console.log(`dataset for container "${from} not exists."`)
                    console.log(`fetching container "${manifest.from} from remote repository."`)

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

            },
            async unExec() {

                zfs.destroy(newDataset);

            },

        });

    } else {

        await invoker.submitOrUndoAll({

            async exec() {

                zfs.create(newDataset);

            },
            async unExec() {

                zfs.destroy(newDataset);

            },

        });

    }

    let datasetPath = zfs.get(newDataset, 'mountpoint');
    let contextPath = path.join(datasetPath, '/media/context');

    {

        let dev = path.join(datasetPath, '/dev');
        let fd = path.join(datasetPath, '/dev/fd');
        let proc = path.join(datasetPath, '/proc');
        let srcContextPath = path.resolve(argv.context);

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
        process.on('SIGINT', async _ => { await invoker.undoAll(); });
        process.on('SIGTERM', async _ => { await invoker.undoAll(); });

        await invoker.submitOrUndoAll({

            async exec() {

                mountDevfs(dev);
                mountFdescfs(fd);
                mountProcfs(proc);
                mountNullfs(srcContextPath, contextPath, ['ro']);

            },
            async unExec() {

                process.removeListener('exit', exitHandler);
                exitHandler();

            }

        });

    }

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

    for (let index in manifest.building) {

        let obj = manifest.building[index];
        let commandName = Object.keys(obj)[0];
        let args = obj[commandName];

        let commandPath = `../builder-commands/${commandName}-command`;
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

    manifest.toFile(path.join(datasetPath, 'manifest.json'))

    zfs.snapshot(newDataset, config.specialSnapName);

}
