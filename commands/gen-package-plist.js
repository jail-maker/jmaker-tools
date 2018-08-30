'use strict';

const fs = require('fs');
const userid = require('userid');
const path = require('path');
const yargs = require('yargs');
const yaml = require('js-yaml');
const diff = require('../libs/folders-diff');
const zfs = require('../libs/zfs');
const config = require('../libs/config');

module.exports.desc = 'command for generate package plist file';

module.exports.builder = yargs => {

    yargs
        .option('from', { default: null })
        .option('to')
        .demandOption(['to']);

}

module.exports.handler = async argv => {

    let stream = process.stdin;
    let toDataset = path.join(config.containersLocation, argv.to);
    let diffData = {};

    {
        let toPath = zfs.get(toDataset, 'mountpoint');
        toPath = path.join(toPath, `.zfs/snapshot/${config.specialSnapName}/`);
        let fromPath = '';

        if (argv.from) {

            const fromDataset = path.join(config.containersLocation, argv.from);
            fromPath = zfs.get(fromDataset, 'mountpoint');
            fromPath = path.join(fromPath, `.zfs/snapshot/${config.specialSnapName}/`);

        } else fromPath = '/empty/';

        diffData = await diff(toPath, fromPath);
    }

    if (!zfs.has(toDataset))
        throw new Error(`dataset "${toDataset}" not exists.`);

    let lines = [];
    let to = `$JMAKER_CONTAINERS_LOCATION/${argv.to}`;
    let toMountpoint = zfs.get(toDataset, 'mountpoint');

    if (argv.from) {

        let fromDataset = path.join(config.containersLocation, argv.from);

        if (!zfs.has(fromDataset))
            throw new Error(`dataset "${fromDataset}" not exists.`);

        let from = `$JMAKER_CONTAINERS_LOCATION/${argv.from}`;
        let to = `$JMAKER_CONTAINERS_LOCATION/${argv.to}`;

        lines = [
            // `@preexec zfs clone ${fromDataset}@${config.specialSnapName} ${toDataset}`,
            `@preexec zfs clone ${from}@$JMAKER_SPECIAL_SNAP_NAME ${to}`,
            `@preexec zfs set mountpoint=${toMountpoint} ${to}`,
        ];

    } else {

        let to = `$JMAKER_CONTAINERS_LOCATION/${argv.to}`;

        lines = [
            // `@preexec zfs create -p ${toDataset}`,
            `@preexec zfs create -p ${to}`,
            `@preexec zfs set mountpoint=${toMountpoint} ${to}`,
        ];

    }

    lines = [
        // `@postexec zfs snapshot ${toDataset}@${config.specialSnapName}`,
        // `@postunexec zfs destroy -R ${toDataset}`,
        `@postexec zfs inherit mountpoint ${to}`,
        `@postexec zfs snapshot ${to}@$JMAKER_SPECIAL_SNAP_NAME`,
        `@preunexec zfs set mountpoint=${toMountpoint} ${to}`,
        `@postunexec zfs destroy -Rf ${to}`,
        ...lines,
    ];

    let prefix = zfs.get(toDataset, 'mountpoint');

    let previous = { 
        mode: '',
        owner: '',
        group: '',
    };

    for (let key in diffData) {

        let file = path.join(prefix, key);
        let isFolder = file.slice(-1) === '/';

        let action = diffData[key];

        let stats = fs.lstatSync(file);
        let permissions = {
            mode: stats.mode.toString(8).slice(-4),
            group: userid.groupname(stats.gid),
            owner: userid.username(stats.uid),
        };

        // lines.unshift(`@postexec /usr/sbin/chown ${permissions.owner}:${permissions.group} ${file.replace('%', '%%')}`);

        for (let key in permissions) {

            if (previous[key] !== permissions[key]) {

                previous[key] = permissions[key];
                lines.push(`@${key} ${permissions[key]}`);

            }

        }

        if (isFolder && action === 'A') {

            let line = `@dir ${file}`;
            lines.push(line);

        } else if (action === 'A') {

            let line = `${file}`;
            lines.push(line);

        } else if (action === 'D') {

            let line = `@postexec rm -rdf ${file}`;
            lines.push(line);

        }

    }

    let content = lines.join('\n');
    console.log(content);

}
