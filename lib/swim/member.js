/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, lib/member.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See LICENSE in this directory.
  Local changes (see NOTICE at the package root): clone is replaced by
  lodash cloneDeep.
*/
'use strict';
var clone = require('lodash/cloneDeep');

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
