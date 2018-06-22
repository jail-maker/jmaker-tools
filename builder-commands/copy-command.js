'use strict';

const path = require('path');
const { copy, copySync } = require('fs-extra');
const logsPool = require('../libs/logs-pool');
const chains = require('../libs/layers/chains');
const config = require('../libs/config');
const CommandInterface = require('../libs/command-interface');

class CopyCommand extends CommandInterface {

    constructor(receiver) {

        super();

        this._receiver = receiver;
        this._commitName = null;

    }

    async exec() {

        let {
            dataset,
            index,
            manifest,
            context,
            args,
            containerId,
        } = this._receiver;

        if (typeof(args) === 'string') 
            args = [args, args];

        // let name = `${index} ${args.join(' ')} ${manifest.name}`;
        let name = `${index} ${args.join(' ')} ${containerId}`;

        this._commitName = dataset.lastSnapshot;
        await dataset.commit(name, async _ => {

            let [src, dst] = args;

            src = path.join(context.path, path.resolve('/', src));
            dst = path.join(dataset.path, path.resolve(manifest.workdir, dst));

            copySync(src, dst);

        });

    }

    async unExec() {

        let { dataset } = this._receiver;

        if (this._commitName) dataset.rollback(this._commitName);

    }

}

module.exports = CopyCommand;
