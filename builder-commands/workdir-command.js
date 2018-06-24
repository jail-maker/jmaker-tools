'use strict';

const fse = require('fs-extra');
const path = require('path');
const CommandInterface = require('../libs/command-interface');
const zfs = require('../libs/zfs');
const uuidv5 = require('uuid/v5');

class WorkdirCommand extends CommandInterface {

    constructor(receiver) {

        super();

        let { manifest } = receiver;
        this._receiver = receiver;
        this._oldWorkdir = manifest.workdir;
        this._workdir = null;
        this._commitName= null;

    }

    async exec() {

        let {
            dataset,
            datasetPath,
            index,
            manifest,
            args = [],
        } = this._receiver;

        let workdir = path.resolve(manifest.workdir, args);
        let dir = path.join(datasetPath, workdir);

        this._commitName = uuidv5(dir, uuidv5.DNS);
        zfs.snapshot(dataset, this._commitName);
        console.log('workdir:', dir);
        await fse.ensureDir(dir);

        manifest.workdir = workdir;
        this._workdir = workdir;

    }

    async unExec() {

        let { manifest, dataset } = this._receiver;
        manifest.workdir = this._oldWorkdir;

        if (this._commitName) {

            zfs.rollback(this._commitName);
            zfs.destroy(`${dataset}@${this._commitName}`);

        }

    }

}

module.exports = WorkdirCommand;
