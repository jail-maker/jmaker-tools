'use strict';

const { spawn, spawnSync } = require('child_process');
const jsonQuery = require('json-query');
const Ip4Addr = require('./ip4addr.js');
const Ip6Addr = require('./ip6addr.js');
const Ipv6TypesAddresses = require('./ipv6-types-addresses.js');

class Iface {

    constructor() {

        this._ethName = '';
        this._ipv4Addresses = [];
        this._ipv6Addresses = [];
        this._ipv6TypeAdresses = new Ipv6TypesAddresses;
        this._ether = '00:00:00:00:00:00';

    }

    getIp4Addresses() { return this._ipv4Addresses; }
    getIp6Addresses() { return this._ipv6Addresses; }

    getIp6ByType(type) {

        return this._ipv6TypeAdresses[type]; 

    }

    getEthName() { return this._ethName; }

    getEther() { return this._ether; }

    setEther(ether) {

        this._ether = ether;

        spawnSync('ifconfig', [
            this._ethName, 'ether', ether,
        ]);

    }

    resetEther() {

        this.setEther('00:00:00:00:00:00');

    }

    up() {

        spawnSync('ifconfig', [
            this._ethName, 'up'
        ]);

    }

    down() {

        spawnSync('ifconfig', [
            this._ethName, 'down'
        ]);

    }

    addIp6Address(ip6Addr) {

        let index = this._ipv6Addresses.indexOf(ip6Addr);

        if (index !== -1) {

            let message = `${ip6Addr} already exists in ${this._ethName}.`;
            throw new Error(message);

        }

        spawnSync('ifconfig', [
            this._ethName, 'inet6', 'alias', ip6Addr.toString(),
        ]);

        this._ipv6Addresses.push(ip6Addr);

        return this;

    }

    rmIp6Address(ip6Addr) {

        let index = this._ipv6Addresses.indexOf(ip6Addr);

        if (index === -1) {

            let message = `${ip6Addr} not found in ${this._ethName}.`;
            throw new Error(message);

        }

        delete this._ipv6Addresses[index];
        this._ipv6Addresses = this._ipv6Addresses.filter(n => n);

        spawnSync('ifconfig', [
            this._ethName, 'inet6', ip6Addr.toString(), 'delete',
        ]);

    }

    addIp4Address(ip4Addr) {

        let index = this._ipv4Addresses.indexOf(ip4Addr);

        if (index !== -1) {

            let message = `${ip4Addr} already exists in ${this._ethName}.`;
            throw new Error(message);

        }

        spawnSync('ifconfig', [
            this._ethName, 'alias', ip4Addr.toString(),
        ]);

        this._ipv4Addresses.push(ip4Addr);

        return this;

    }

    rmIp4Address(ip4Addr) {

        let index = this._ipv4Addresses.indexOf(ip4Addr);

        if (index === -1) {

            let message = `${ip4Addr} not found in ${this._ethName}.`;
            throw new Error(message);

        }

        delete this._ipv4Addresses[index];
        this._ipv4Addresses = this._ipv4Addresses.filter(n => n);

        spawnSync('ifconfig', [
            this._ethName, 'inet', ip4Addr.address, '-alias',
        ]);

    }

    execDhcp() {

        let eth = this._ethName;

        spawnSync('dual-dhclient', [
            eth,
        ]);

        this._getIp4Addresses();
        this._getIp6Addresses();

    }

    _getIp6Addresses() {

        let ethInfo = spawnSync('netstat', [
            '-6', '-I', this._ethName, '-n' ,'--libxo=json',
        ]).stdout.toString();

        ethInfo = JSON.parse(ethInfo);

        let ips = jsonQuery(
            `[**]interface[*name=${this._ethName}].address`,
            { data: ethInfo }
        ).value;

        let networks = jsonQuery(
            `[**]interface[*name=${this._ethName}].network`,
            { data: ethInfo }
        ).value;

        ips.forEach((addr, key) => {

            let matches = networks[key].match(/\/(\d+)$/);
            let prefix = matches[1];

            let ipAddr = new Ip6Addr(addr, prefix);
            ipAddr.network = networks[key].trim();
            this._ipv6Addresses.push(ipAddr);

            if (ipAddr.isUnicast()) this._ipv6TypeAdresses
                .unicast
                .push(ipAddr);

            else if (ipAddr.isLocalUnicast()) this._ipv6TypeAdresses
                .localUnicast
                .push(ipAddr);

            else if (ipAddr.isLinkLocal()) this._ipv6TypeAdresses
                .linkLocal
                .push(ipAddr);

        });

    }

    _getIp4Addresses() {

        let ethInfo = spawnSync('netstat', [
            '-4', '-I', this._ethName, '-n' ,'--libxo=json',
        ]).stdout.toString();

        ethInfo = JSON.parse(ethInfo);

        let ips = jsonQuery(
            `[**]interface[*name=${this._ethName}].address`,
            { data: ethInfo }
        ).value;

        let networks = jsonQuery(
            `[**]interface[*name=${this._ethName}].network`,
            { data: ethInfo }
        ).value;

        ips.forEach((addr, key) => {

            let matches = networks[key].match(/\/(\d+)$/);
            let prefix = matches[1];

            let ipAddr = new Ip4Addr(addr, prefix);
            ipAddr.network = networks[key].trim();
            this._ipv4Addresses.push(ipAddr);

        });

    }

    _getEther() {

        let ethInfo = spawnSync('netstat', [
            '-f', 'link', '-I', this._ethName, '-n' ,'--libxo=json',
        ]).stdout.toString();

        ethInfo = JSON.parse(ethInfo);

        this._ether = jsonQuery(
            `[**]interface[name=${this._ethName}].address`,
            { data: ethInfo }
        ).value;

    }

}

module.exports = Iface;
