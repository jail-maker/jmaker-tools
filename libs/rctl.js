'use strict';

const { spawn, spawnSync } = require('child_process')
const RctlRule = require('./rctl-rule');
const CommandInterface = require('./command-interface');

class Rctl extends CommandInterface {

    constructor({rulset, jailName}) {

        super();

        this._rulset = rulset;
        this._jailName = jailName;
        this._rules = [];

        this._rulsetParse();

    }

    _rulsetParse() {

        for (let key in this._rulset) {

            let resource = key;
            let actions = rulset[key];

            for (let action in actions) {

                let data = {
                    resource,
                    action,
                    value: actions[action],
                    jailName: this._jailName,
                };

                this._rules.push(new RctlRule(data));

            }

        }

    }

    async exec() {

        this._rules.forEach(rule => {

            let result = spawnSync('rctl', [
                '-a', rule.toString()
            ]);

            if (result.status !== 0)
                throw new Error('Error execution rctl.');

        });

    }

    async unExec() {

        this._rules.forEach(rule => {

            let result = spawnSync('rctl', [
                '-r', rule.getRuleName()
            ]);

        });

    }

}

module.exports = Rctl;
