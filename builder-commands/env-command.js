'use strict';

const CommandInterface = require('../libs/command-interface');

class EnvCommand extends CommandInterface {

    constructor(receiver) {

        super();

        let { manifest } = receiver;

        this._receiver = receiver;
        this._env = manifest.env;

    }

    async exec() {

        let {
            manifest,
            args = [],
        } = this._receiver;

        console.log('set env:', args);
        manifest.env = Object.assign(manifest.env, args);
        console.log('new env:', manifest.env);

    }

    async unExec() {

        let { manifest } = receiver;
        manifest.env = this._env;

    }

}

module.exports = EnvCommand;
