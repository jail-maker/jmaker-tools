'use strict';

const path = require('path');
const config = require('../libs/config');
const CommandInterface = require('../libs/command-interface');
const { spawn } = require('child_process');
const pty = require('node-pty');

class RunCommand extends CommandInterface {

    constructor(receiver) {

        super();

        this._receiver = receiver;

    }

    async exec() {

        let {
            manifest,
            tty,
            containerId,
            args = '',
            dataset,
        } = this._receiver;

        let env = Object.assign({}, process.env, manifest.env);
        let command = Array.isArray(args) ? args.join(' ') : args;
        command = `${manifest.entry} ${command}`;

        return await (new Promise((res, rej) => {

            let child = pty.spawn(
                'jexec',
                [
                    manifest.name,
                    `/bin/sh`, `-c`, `cd ${manifest.workdir} && ${command}` 
                ],
                {
                    name: 'xterm-color',
                    env,
                    cwd: '/',
                    cols: 80,
                    rows: 30,
                }
            );

            child.on('data', async chunk => await tty.write(shunk));

            tty.on('data', chunk => child.write(chunk));
            tty.on('resize', event => {

                let {columns, rows} = event.data;
                child.resize(columns, rows);

            });

            child.on('exit', async (code, signal) => {

                let message = {
                    name: 'exit',
                    data: {
                        code,
                        signal
                    },
                };

                await tty.sendEvent(message);

                res(code);

            });

        }));

    }

    async unExec() { }

}

module.exports = RunCommand;
