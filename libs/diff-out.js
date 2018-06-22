'use strict';

class DiffOut {

    toString() {

        let ret = '';

        for (let line of this.genLines())
            ret += `${line[0]} ${line[1]}\n`;

        return ret.trim('\n');

    }

    files(marks = ['A', 'D', 'C']) {

        let ret = [];

        for (let line of this.genLines()) {

            if (marks.includes(line[0])) ret.push(line[1]);

        }

        return ret;

    }

    * genLines() {

        for (let file in this) {

            yield [this[file], file];

        }

    }

    * [Symbol.iterator]() {

        return this.genLines();

    }

}

module.exports = DiffOut;
