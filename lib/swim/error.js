/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, lib/error.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See LICENSE in this directory.
  Unchanged apart from this header (see NOTICE at the package root).
*/
'use strict';
var util = require('util');

function JoinFailedError(meta) {
    Error.captureStackTrace(this, this.constructor);

    Object.defineProperty(this, 'name', {
        value: this.constructor.name
    });

    if (meta) {
        this.meta = meta;
    }
}

function InvalidStateError(meta) {
    Error.captureStackTrace(this, this.constructor);

    Object.defineProperty(this, 'name', {
        value: this.constructor.name
    });

    if (meta) {
        this.meta = meta;
    }
}

function ListenFailedError(meta) {
    Error.captureStackTrace(this, this.constructor);

    Object.defineProperty(this, 'name', {
        value: this.constructor.name
    });

    if (meta) {
        this.meta = meta;
    }
}

util.inherits(JoinFailedError, Error);
util.inherits(InvalidStateError, Error);
util.inherits(ListenFailedError, Error);

module.exports = {
    JoinFailedError: JoinFailedError,
    InvalidStateError: InvalidStateError,
    ListenFailedError: ListenFailedError
};
