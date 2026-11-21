/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, lib/codec.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See LICENSE in this directory.
  Local changes (see NOTICE at the package root): the native msgpack module
  is replaced by @msgpack/msgpack (pure JavaScript), and new Buffer() by
  Buffer.from().
*/
'use strict';
var assert = require('assert');
var msgpack = require('@msgpack/msgpack');

function Codec(opts) {
    opts = opts || {};

    this.codec = opts.codec || Codec.Default.codec;

    assert.strictEqual(['json', 'msgpack'].indexOf(this.codec) !== -1, true, 'unsupported codec');

    if (this.codec === 'json') {
        this.encode = function encode(obj) {
            return Buffer.from(JSON.stringify(obj));
        };
        this.decode = function decode(buffer) {
            return JSON.parse(buffer.toString());
        };
    } else {
        this.encode = function encode(obj) {
            // a Buffer copy of the Uint8Array, so that callers can use
            // Buffer methods and no buffer of the encoder is shared
            return Buffer.from(msgpack.encode(obj));
        };
        this.decode = function decode(buffer) {
            return msgpack.decode(buffer);
        };
    }
}

Codec.Default = {
    codec: 'msgpack'
};

module.exports = Codec;
