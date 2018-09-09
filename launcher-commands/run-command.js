'use strict';

const path = require('path');
const config = require('../libs/config');
const CommandInterface = require('../libs/command-interface');
const { spawn } = require('child_process');

class RunCommand extends CommandInterface {

    constructor(receiver) {

        super();

        this._receiver = receiver;

    }

    async exec() {

        let {
            manifest,
            containerId,
            args = '',
            dataset,
        } = this._receiver;

        let env = Object.assign({}, process.env, manifest.env);
        let command = Array.isArray(args) ? args.join(' ') : args;

        await (new Promise((res, rej) => {

            let child = spawn(
                'jexec',
                [
                    manifest.name,
                    `/bin/sh`, `-c`, `cd ${manifest.workdir} && ${command}` 
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

    async unExec() { }

}

module.exports = RunCommand;
