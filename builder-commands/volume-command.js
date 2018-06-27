'use strict';

const { spawnSync } = require('child_process');
const { ensureDir } = require('fs-extra');
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
        this._mountPath = null;

    }

    _normalizeArgs(args = {}) {

        const template = {
            name: undefined,
            path: undefined,
        };

        if (typeof(args) === 'string') 
            args = { path: args };

        return Object.assign(template, args);

    }

    async exec() {

        let {
            dataset,
            datasetPath,
            manifest,
            args = {},
        } = this._receiver;

        zfs.ensureDataset(config.volumesLocation);

        args = this._normalizeArgs(args);

        if (args.path === undefined)
            throw new Error('volume path is undefined.');

        if (args.name === undefined)
            args.name = uuidv5(`${dataset} ${args.path}`, uuidv5.DNS);

        let dst = args.path;
        dst = path.resolve(manifest.workdir, dst);

        let volumeDataset = path.join(config.volumesLocation, args.name);
        zfs.ensureDataset(volumeDataset);
        let src = zfs.get(volumeDataset, 'mountpoint');
        let mountPath = path.join(datasetPath, dst);
        this._mountPath = mountPath;

        await ensureDir(mountPath);

        process.on('exit',  _ => umount(this._mountPath, true));
        process.on('SIGINT', _ => umount(this._mountPath, true));
        process.on('SIGTERM', _ => umount(this._mountPath, true));

        mountNullfs(src, mountPath);

    }

    async unExec() {

        if (this._mountPath) umount(this._mountPath, true);

    }

}

module.exports = VolumeCommand;
