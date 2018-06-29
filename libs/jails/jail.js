'use strict';

const { spawnSync, spawn } = require('child_process');
const EventEmitter = require('events');
const fs = require('fs');

const ConfigFile = require('./config-file');

class Jail extends EventEmitter {

    static confFileByName(name) {

        return `/var/run/${name}-jail.conf`;

    }

    constructor({ manifest, dataset, datasetPath }) {

        super();

        let rules = Object.assign({}, manifest.rules);
        rules.path = datasetPath;

        this.name = manifest.name;
        this.configFileObj = new ConfigFile(this.name, rules);
        this.configFilePath = Jail.confFileByName(this.name);
        this.manifest = manifest;

    }

    async start() {

        this.emit('beforeStart', this);
        this.configFileObj.save(this.configFilePath);

        let result = spawnSync('jail', [
            '-c', '-f', this.configFilePath, this.name,
        ], {
            stdio: 'inherit',
        });

        let msg = 'Error execution jail.';
        if (result.status) throw new Error(msg);

        this.emit('afterStart', this);

    }

    async stop() {

        this.emit('beforeStop', this);

        let result = spawn('jail', [
            '-r', '-f', this.configFilePath, this.name,
        ], {
            stdio: 'inherit',
        });

        fs.unlinkSync(this.configFilePath);

        this.emit('afterStop', this);

    }

    get info() {

        try {

            let result = spawnSync('jls', [
                '-j', this.name, '-n', '--libxo=json',
            ]);

            let jsonData = JSON.parse(result.output[1].toString());
            return jsonData['jail-information'].jail[0];

        } catch (error) {

            return {};

        }

    }

}

module.exports = Jail;
