#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const yaml = require('js-yaml');
const diff = require('./libs/folders-diff');
const zfs = require('./libs/zfs');

const configFile = './config.yml';

const configContent = fs.readFileSync(configFile, 'utf-8');
const config = yaml.safeLoad(configContent);

const argv = yargs
    .option('from', { default: null })
    .option('to')
    .demandOption(['to'])
    .argv;

let stream = process.stdin;


function readStdin() {

    return new Promise((res, rej) => {

        let buffer = '';

        stream.on('readable', _ => {

            let chunk;

            while (null !== (chunk = stream.read())) {

                buffer += chunk.toString();

            }

        });

        stream.on('end', _ => {

            res(buffer);

        });

    });

}


(async _ => {

    let input = await readStdin();
    let data = JSON.parse(input);
    let toDataset = path.join(config.containersLocation, argv.to);

    if (!zfs.has(toDataset))
        throw new Error(`dataset "${toDataset}" not exists.`);

    let lines = [];

    if (argv.from) {

        let fromDataset = path.join(config.containersLocation, argv.from);

        if (!zfs.has(fromDataset))
            throw new Error(`dataset "${fromDataset}" not exists.`);

        lines = [
            `@preexec zfs clone ${fromDataset}@${config.specialSnapName} ${toDataset}`,
        ];

    } else {

        lines = [
            `@preexec zfs create -p ${toDataset}`,
        ];

    }

    lines = [
        ...lines,
        `@postexec zfs snapshot ${toDataset}@${config.specialSnapName}`,
        `@postunexec zfs destroy -R ${toDataset}`,
    ];

    let prefix = zfs.get(toDataset, 'mountpoint');

    for (let file in data) {

        let action = data[file];
        let isFolder = file.slice(-1) === '/';

        file = path.join(prefix, file);

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

})();
