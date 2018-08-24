'use strict';

const fs = require('fs');

class Manifest {

    constructor() {

        this.name = '';
        this.from = null;
        this.workdir = '/';
        this.pkg = {};
        this.rctl = {};
        this.dependencies = [];
        this.cpus = '';
        this.cpuset = '';
        this.service = {};
        this.services = {};
        this.building = [];
        this.starting = [];
        this.quota = '';
        this.env = {};
        this['resolv-sync'] = true;
        this.rules = {
            'mount.devfs': true,
            'mount.procfs': true,
            'mount.fdescfs': true,
            'allow.raw_sockets': true,
            'allow.socket_af': true,
            'allow.sysvipc': true,
            'host.hostname': "${name}.net",
            'exec.prestart': [],
            'exec.poststop': [],
            'exec.start': [],
            'exec.stop': [],
            'ip4.addr': [],
            'ip4': "inherit",
            'ip6.addr': [],
            'ip6': "inherit",
            osrelease: undefined,
            osreldate: undefined,
            sysvmsg: true,
            sysvsem: true,
            sysvshm: true,
            persist: true,
        };

    }

    join(...args) {

        return Object.assign(this, ...args);

    }

    clone() {

        return Object.assign(new Manifest, this);

    }

    toFile(file) {

        fs.writeFileSync(file, JSON.stringify(this));

    }

}

module.exports = Manifest;
