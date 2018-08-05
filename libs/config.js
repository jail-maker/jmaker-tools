'use strict';

const fs = require('fs');
const yaml = require('js-yaml');
const path = require('path');

const FILE = `${__dirname}/../config.yml`;

class Config { }

let buffer = fs.readFileSync(path.resolve(FILE), 'utf8');
let fileData = yaml.load(buffer);
let config = Object.assign(new Config, fileData);

module.exports = config;
