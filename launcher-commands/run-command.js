'use strict';

const path = require('path');
const config = require('../libs/config');
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

        let env = manifest.env;

        let rules = manifest.rules['exec.start'];
        if (!Array.isArray(rules)) rules = rules ? [rules] : [];
        manifest.rules['exec.start'] = rules;

        let command = [`cd ${manifest.workdir}`];
        for (let key in env) {

            let value = env[key];
            command.push(`export ${key}=${value}`);

        }

        command.push(args);

        rules.push(command.join(' && '));

    }

    async unExec() { }

}

module.exports = RunCommand;
