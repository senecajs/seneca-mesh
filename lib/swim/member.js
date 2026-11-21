'use strict';
var clone = require('clone');

function Member(opts) {
    this.meta = opts.meta || undefined;
    this.host = opts.host;
    this.state = opts.state || Member.State.Alive;
    this.incarnation = opts.incarnation || 0;
}

Member.prototype.data = function data() {
    return clone({
        meta: this.meta,
        host: this.host,
        state: this.state,
        incarnation: this.incarnation
    });
};

Member.prototype.incarnate = function incarnate(data, force, preferCurrentMeta) {
    if (!data) {
        this.incarnation += 1;
        return true;
    }

    if (data.incarnation > this.incarnation) {
        if (!preferCurrentMeta) {
            this.meta = data.meta;
        }
        this.incarnation = data.incarnation + 1;
        return true;
    }

    if (data.incarnation === this.incarnation && force) {
        this.incarnation = data.incarnation + 1;
        return true;
    }

    return false;
};

Member.State = {
    Alive: 0,
    Suspect: 1,
    Faulty: 2
};

module.exports = Member;
