'use strict';

class InvokersPool {

    constructor() {

        this._pool = {};

    }

    set(name, invoker) {

        this._pool[name] = invoker;

    }

    get(name) {

        if(!this.has(name))
            throw new Error(`Invoker for container ${name} not found.`);

        return this._pool[name];

    }

    has(name) {

        if(!this._pool[name])
            return false;

        return true;

    }

}

module.exports = new InvokersPool;
