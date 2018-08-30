'use strict';

const fs = require('fs');
const path = require('path');
const { camel } = require('case');

class Config {

    constructor() {

        this.reponame = null;
        this.maintainer = "anonymous@localhost";
        this.containersLocation = "zroot/jmaker/containers";
        this.volumesLocation = "zroot/jmaker/volumes";
        this.packagesLocation = "zroot/jmaker/packages";
        this.specialSnapName = "forks";

        this._loadEnv();

    }

    _loadEnv() {

        let exp = /^JMAKER/;

        Object.keys(process.env)
            .forEach(key => {

                if (!key.match(exp)) return;

                let option = camel(key.replace(exp, ''));
                this[option] = process.env[key];

            });

    }

}

module.exports = new Config;
