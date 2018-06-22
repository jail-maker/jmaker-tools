'use strict';

const { spawn } = require('node-pty');
const { ensureDir } = require('fs-extra');
const path = require('path');
const logsPool = require('../libs/logs-pool');
const ExecutionError = require('../libs/errors/execution-error');
const ExecAbstract = require('../libs/exec-abstract');
const mountDevfs = require('../libs/mount-devfs');
const umount = require('../libs/umount');
const chains = require('../libs/layers/chains');
const config = require('../libs/config');
const RuntimeScope = require('../libs/runtime-scope');
const CommandInterface = require('../libs/command-interface');

class RunCommand extends CommandInterface {

    constructor(receiver) {

        super();

        this._receiver = receiver;
        this._commitName = null;

    }

    async exec() {

        let {
            dataset,
            index,
            manifest,
            containerId,
            args = '',
        } = this._receiver;

        this._commitName = dataset.lastSnapshot;

        let log = logsPool.get(containerId);
        let command = args;

        let env = Object.assign({}, process.env, manifest.env);
        let commitName = `${index} ${command} ${containerId}`;
        // let commitName = `${index} ${command} ${manifest.name}`;

        await dataset.commit(commitName, async _ => {

            let child = spawn(
                'chroot',
                [
                    dataset.path, "sh", "-c",
                    `cd ${manifest.workdir} && ${command}`,
                ],
                {
                    name: 'xterm-color',
                    env: env,
                    cwd: '/',
                }
            );

            let { code } = await log.fromPty(child);

            if (code) {

                let msg = `Error execution command: ${command} .`;
                throw new ExecutionError(msg);

            }

        });

    }

    async unExec() {

        let {
            dataset,
            manifest,
        } = this._receiver;

        if (this._commitName) dataset.rollback(this._commitName);

    }

}

module.exports = RunCommand;
