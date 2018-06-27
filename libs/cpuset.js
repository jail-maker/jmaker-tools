'use strict';

const { spawnSync } = require('child_process');
const CommandInterface = require('./command-interface');

class Cpuset extends CommandInterface {

    constructor({ jid, value }) {

        super();

        this._jid = jid;
        this._value = value;

    }

    async exec() {

        let result = spawnSync('cpuset', [
            '-l', this._value, '-j', this._jid
        ]);

        if (result.status !== 0)
            throw new Error('Error execution cpuset.');

    }

    async unExec() { }

}

module.exports = Cpuset;
