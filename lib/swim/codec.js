'use strict';
var assert = require('assert');
var msgpack = require('msgpack');

function Codec(opts) {
    opts = opts || {};

    this.codec = opts.codec || Codec.Default.codec;

    assert.strictEqual(['json', 'msgpack'].indexOf(this.codec) !== -1, true, 'unsupported codec');

    if (this.codec === 'json') {
        this.encode = function encode(obj) {
            return new Buffer(JSON.stringify(obj));
        };
        this.decode = function decode(buffer) {
            return JSON.parse(buffer.toString());
        };
    } else {
        this.encode = msgpack.pack.bind(msgpack);
        this.decode = msgpack.unpack.bind(msgpack);
    }
}

Codec.Default = {
    codec: 'msgpack'
};

module.exports = Codec;
