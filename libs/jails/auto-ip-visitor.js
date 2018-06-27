'use strict';

const { spawnSync, spawn } = require('child_process');
const defaultIface = require('../default-iface.js');

class AutoIpVisitor {

    visit(configFileObj) {

        let rules = configFileObj.getRules();
        this.pipeRule(rules);

    }

    pipeRule(rules) {

        {

            let rule = rules['ip4.addr'];
            if (!Array.isArray(rule.data)) rule.data = [rule.data];

            this._forIp4Addr(rule);

        }

        {

            let rule = rules['ip6.addr'];
            if (!Array.isArray(rule.data)) rule.data = [rule.data];

            this._forIp6Addr(rule);

        }

        return rules;

    }

    _forIp4Addr(rule = []) {

        rule.data = rule.data.map(item => {

            if (item.toLowerCase() !== 'auto') return item;

            let ipAddr = defaultIface.getIp4Addresses()[0];
            let result = spawnSync('/usr/local/bin/check_ip', [
                `--ipv4=${ipAddr.network}`, '-j', 
            ]);

            if (result.status !== 0)
                throw new ExecutionError('Error execution check_ip.');

            let freeIp = result.stdout.toString();
            freeIp = JSON.parse(freeIp)['free4'];

            let msg = `Free IPv4 not found in network ${ipAddr.network}`;
            if (!freeIp) throw new Error(msg);

            return `${defaultIface.getEthName()}|${freeIp}`;

        });

    }

    _forIp6Addr(rule = []) {

        rule.data = rule.data.map(item => {

            if (item.toLowerCase() !== 'auto') return item;

            let ipAddrs = defaultIface.getIp6ByType('unicast');

            if (!ipAddrs.length) {

                ipAddrs = defaultIface.getIp6ByType('localUnicast');

            }

            if (!ipAddrs.length) {

                let msg = 'Empty ipv6 addressess.';
                throw new Error(msg);

            }

            let ipAddr = ipAddrs[0];
            let result = spawnSync('/usr/local/bin/check_ip', [
                `--ipv6=${ipAddr.network}`, '-j', 
            ]);

            if (result.status !== 0)
                throw new ExecutionError('Error execution check_ip.');

            let freeIp = result.stdout.toString();
            freeIp = JSON.parse(freeIp)['free6'];

            let msg = `Free IPv6 not found in network ${ipAddr.network}`;
            if (!freeIp) throw new Error(msg);

            return `${defaultIface.getEthName()}|${freeIp}`;

        });

    }

}

module.exports = new AutoIpVisitor;
