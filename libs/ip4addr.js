'use strict';

class Ip4Addr {

    constructor(address = '0.0.0.0', prefix = '32') {

        this.address = address;
        this.prefix = prefix;
        this.network = '';

    }

    toString() {

        return `${this.address}/${this.prefix}`;

    }

}

module.exports = Ip4Addr;
