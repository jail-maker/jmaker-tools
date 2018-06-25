'use strict';

const fs = require('fs');

class PackageManifest {

    constructor() {

        this.name = 'unknown';
        this.www = '';
        this.desc = '';
        this.origin = 'unknown';
        this.comment = "";
        this.version = "0.0.1";
        this.maintainer = "unknown";
        this.prefix = "/usr/local";
        this.deps = { };

    }

    clone() {

        return Object.assign(new PackageManifest, this);

    }

    toFile(file) {

        fs.writeFileSync(file, JSON.stringify(this));

    }

}

module.exports = PackageManifest;
