'use strict';

const fse = require('fs-extra');
const path = require('path');
const logsPool = require('../libs/logs-pool');
const config = require('../libs/config');
const CommandInterface = require('../libs/command-interface');

class WorkdirCommand extends CommandInterface {

    constructor(receiver) {

        super();

        let { manifest } = receiver;
        this._receiver = receiver;
        this._workdir = manifest.workdir;

    }

    async exec() {

        let {
            dataset,
            index,
            manifest,
            containerId,
            args = [],
        } = this._receiver;

        let log = logsPool.get(containerId);
        let workdir = path.resolve(manifest.workdir, args);
        let name = `${index} ${workdir} ${manifest.from}`;

        await dataset.commit(name, async _ => {

            let dir = path.join(dataset.path, workdir);
            console.log('workdir:', dir);
            await fse.ensureDir(dir);

        });

        manifest.workdir = workdir;

    }

    async unExec() {

        let { manifest } = this._receiver;
        manifest.workdir = this._workdir;

    }

}

module.exports = WorkdirCommand;
