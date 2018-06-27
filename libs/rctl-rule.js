'use strict';

class RctlRule {

    constructor(data) {

        this._data = data;

    }

    toString() {

        let {
            value,
        } = this._data;

        let ruleName = this.getRuleName();

        return `${ruleName}=${value}`;

    }

    getRuleName() {

        let {
            resource,
            action,
            jailName
        } = this._data;

        return `jail:${jailName}:${resource}:${action}`;

    }

}

module.exports = RctlRule;
