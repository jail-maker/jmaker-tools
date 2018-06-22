'use strict';

const fs = require('fs');

class Manifest {

    constructor() {

        this.name = '';
        this.from = null;
        this.workdir = '/';
        this.rules = {};
        this.pkg = {};
        this.rctl = {};
        this.dependencies = [];
        this.cpus = '';
        this.cpuset = '';
        this.building = [];
        this.starting = [];
        this.quota = '';
        this.env = {};
        this['resolv-sync'] = true;

    }

    clone() {

        return Object.assign(new Manifest, this);

    }

    toFile(file) {

        fs.writeFileSync(file, JSON.stringify(this));

    }

}

module.exports = Manifest;
