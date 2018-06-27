'use strict';

const { spawn } = require('node-pty');
const { ensureDir } = require('fs-extra');
const path = require('path');
const logsPool = require('../libs/logs-pool');
const ExecutionError = require('../libs/errors/execution-error');
const ExecAbstract = require('../libs/exec-abstract');
const mountDevfs = require('../libs/mount-devfs');
const umount = require('../libs/umount');
const config = require('../libs/config');
const RuntimeScope = require('../libs/runtime-scope');
const CommandInterface = require('../libs/command-interface');

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

        let log = logsPool.get(containerId);
        let env = Object.assign({}, process.env, manifest.env);
        let command = args;

        let child = spawn(
            '/usr/sbin/jexec',
            [
                // manifest.name, "sh", "-c",
                containerId, "sh", "-c",
                `cd ${manifest.workdir} && ${command}`
            ],
            {
                name: 'xterm-color',
                env: env,
                cwd: '/',
            }
        );

        let result = await log.fromPty(child);

        if (result.code) {

            console.log(result);

            let msg = `Error execution command: ${command} .`;
            throw new ExecutionError(msg);

        }

    }

    async unExec() { }

}

module.exports = RunCommand;
