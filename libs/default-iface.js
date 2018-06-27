'use strict';

const { spawnSync, spawn } = require('child_process');
const jsonQuery = require('json-query');
const Iface = require('./iface.js');
const Ipv6TypesAddresses = require('./ipv6-types-addresses.js');

class DefaultIface extends Iface {

    constructor() {

        super();

        this.refresh();

    }

    reset() {

        spawnSync('route', [
            'delete', 'default'
        ]);

    }

    intoIface() {

        let iface = new Iface;

        for (let key in this) {

            iface[key] = this[key];

        }

        return iface;

    }

    refresh() {

        this._ipv4Addresses = [];
        this._ipv6Addresses = [];
        this._ipv6TypeAdresses = new Ipv6TypesAddresses;

        this._getIface();
        this._getEther();
        this._getIp4Addresses();
        this._getIp6Addresses();

    }

    _getIface() {

        let out = spawnSync('netstat', [
            '-r', '-4', '--libxo', 'json',
        ]).stdout.toString();

        out = JSON.parse(out);
        out = out.statistics['route-information']['route-table']['rt-family'];

        let ethInfo = jsonQuery(
            '[address-family=Internet].rt-entry[destination=default]',
            { data: out }
        ).value;

        this._ethName = ethInfo['interface-name'];

    }

}

let defaultIface = new DefaultIface;

module.exports = defaultIface;
