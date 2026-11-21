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
