#!/usr/bin/env node

'use strict';

const zfs = require('./libs/zfs');
const config = require('./libs/config');
const yargs = require('yargs');
const path = require('path');
const Jail = require('./libs/jail');

(async _ => {

    zfs.ensureDataset(config.containersLocation);
    zfs.ensureDataset(config.volumesLocation);
    zfs.ensureDataset(config.packagesLocation);

})();
