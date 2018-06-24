'use strict';

const { promisify } = require('util');
const { spawn } = require('child_process');
const { ensureDir } = require('fs-extra');
const path = require('path');
const uuid5 = require('uuid/v5');
const CommandInterface = require('../libs/command-interface');
const zfs = require('../libs/zfs');

class RunCommand extends CommandInterface {

    constructor(receiver) {

        super();

        this._receiver = receiver;
        this._commitName = null;

    }

    async exec() {

        let {
            dataset,
            datasetPath,
            index,
            manifest,
            args = '',
        } = this._receiver;

        let command = args;
        let env = Object.assign({}, process.env, manifest.env);

        this._commitName = uuid5(command, uuid5.DNS);
        zfs.snapshot(dataset, this._commitName);

        await (new Promise((res, rej) => {

            let child = spawn(
                'chroot',
                [
                    datasetPath, "sh", "-c",
                    `cd ${manifest.workdir} && ${command}`,
                ],
                {
                    env: env,
                    cwd: '/',
                    stdio: 'inherit',
                }
            );

            child.on('close', code => {

                if (code) {

                    let error = new Error(`Error execution command: "${command}".`);
                    error.exitCode = code;
                    rej(error);

                } else res(code);

            });

        }));

    }

    async unExec() {

        let {
            dataset,
            manifest,
        } = this._receiver;

        if (this._commitName) {

            zfs.rollback(this._commitName);
            zfs.destroy(`${dataset}@${this._commitName}`);

        }

    }

}

module.exports = RunCommand;
