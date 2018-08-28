'use strict';

const { spawnSync } = require('child_process');
const { ensureDir, copy } = require('fs-extra');
const fs = require('fs');
const path = require('path');
const uuidv5 = require("uuid/v5");
const mountNullfs = require('../libs/mount-nullfs');
const umount = require('../libs/umount');
const CommandInterface = require('../libs/command-interface');
const config = require('../libs/config');
const zfs = require('../libs/zfs');

class VolumeCommand extends CommandInterface {

    constructor(receiver) {

        super();
        this._receiver = receiver;

    }

    _normalizeArgs(args = {}) {

        const template = {
            name: undefined,
            from: undefined,
            to: undefined,
        };

        if (typeof(args) === 'string') 
            args = { to: args };

        return Object.assign(template, args);

    }

    async exec() {

        let {
            dataset,
            datasetPath,
            manifest,
            args = {},
            redis,
        } = this._receiver;


        args = this._normalizeArgs(args);

        zfs.ensureDataset(config.volumesLocation);

        if (args.to === undefined)
            throw new Error('volume argument "to" is undefined.');

        let src = null;
        let dst = path.resolve('/', args.to);
        let mountPath = path.join(datasetPath, dst);

        await ensureDir(mountPath);

        if (args.name === undefined)
            args.name = uuidv5(`${dataset} ${args.to}`, uuidv5.DNS);

        let volumeDataset = path.join(config.volumesLocation, args.name);
        if (zfs.has(volumeDataset)) {

            src = zfs.get(volumeDataset, 'mountpoint');

        } else {

            zfs.ensureDataset(volumeDataset);
            src = zfs.get(volumeDataset, 'mountpoint');
            await copy(path.join(mountPath, '/'), path.join(src, '/'));

        }

        mountNullfs(src, mountPath);
        await redis.lpush(`jmaker:mounts:${manifest.name}`, mountPath);

    }

    async unExec() { }

}

module.exports = VolumeCommand;
