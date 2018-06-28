'use strict';

const { spawn, spawnSync, exec } = require('child_process');
const fs = require('fs');
const DiffOut = require('./diff-out');

const ACTIONS = {'+': 'A', '-': 'D'};

const diff = (src, dst) => {

    return new Promise((res, rej) => {

        let resData = '';
        let rejData = '';

        let child = spawn('rsync', [
            '-na', '--out-format=%n%L', '--delete', src, dst,
        ]);

        child.stdout.on('data', data => resData += data);
        child.stderr.on('data', data => rejData += data);

        child.on('exit', (code, signal) => {

            if (code <= 1) res(resData.trim());
            else {

                let error = new Error(rejData);
                rej(error);

            }

        });

    });

}

module.exports = async (...folders) => {

    let diffOut = (await diff(...folders))
        .toString()
        .trim('\n');

    let files = /^(.+)$/imu;
    let symlinks = /^(.+) [-=]> (.+)$/imu;
    let deleting = /^deleting (.+)$/imu;

    let ret = diffOut.split('\n').reduce((acc, line, key) => {

        let matches = line.match(deleting);

        if (matches) {

            let file = `${matches[1]}`;
            acc[file] = 'D';
            return acc;

        }

        matches = line.match(symlinks);

        if (matches) {

            let [ _, file ] = matches;

            acc[file] = 'A';
            return acc;

        }

        matches = line.match(files);

        if (matches) {

            let [ _, file ] = matches;

            acc[file] = 'A';
            return acc;

        }

        return acc;

    }, new DiffOut);

    return ret;

}
