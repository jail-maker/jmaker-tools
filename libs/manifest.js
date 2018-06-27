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
            'host.hostname': "${name}.net",
            'exec.start': "/bin/sh /etc/rc",
            'exec.stop': "/bin/sh /etc/rc.shutdown",
            'ip4.addr': [],
            'ip6.addr': [],
            sysvsem: true,
            sysvshm: true,
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
