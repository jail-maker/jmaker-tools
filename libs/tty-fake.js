'use strict';

const EventEmitter = require('events');

class TTYFake extends EventEmitter {

    get id() { return null }

    async write(chunk) {

        console.log(chunk);

    }

    async sendEvent(event) {

        console.log(event);

    }

    async destructor() { }

}

module.exports = TTYFake;
