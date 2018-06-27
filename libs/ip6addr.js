'use strict';

class Ip6Addr {

    constructor(address = '::', prefix = '64') {

        this.address = address;
        this.prefix = prefix;
        this.network = '';

    }

    isLinkLocal() {

        let start = parseInt('fe80', 16);
        let end = parseInt('febf', 16);
        let prefix = this.address.match(/^([0-9a-f]{1,4})\:/i);

        if (!prefix) return false;
        prefix = parseInt(prefix[1], 16);

        return prefix >= start && prefix <= end;

    }

    isLocalUnicast() {

        let prefix = this.address.match(/^([0-9a-f]{1,4})\:/i);
        if (!prefix) return false;
        prefix = prefix[1];

        return prefix.toLowerCase() === 'fc00';

    }

    isUnicast() {

        let start = parseInt('2000', 16);
        let end = parseInt('3fff', 16);
        let prefix = this.address.match(/^([0-9a-f]{1,4})\:/i);

        if (!prefix) return false;
        prefix = parseInt(prefix[1], 16);

        return prefix >= start && prefix <= end;

    }

    toString() {

        return `${this.address}/${this.prefix}`;

    }

}

module.exports = Ip6Addr;
