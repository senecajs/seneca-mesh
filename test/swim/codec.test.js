/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, test/codec.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See lib/swim/LICENSE.
  Local changes: moved from tape to node:test and node:assert. The test of
  a member record as mesh builds it is in test/mesh.test.js.
*/
'use strict';
var assert = require('node:assert');
var test = require('node:test');

var Codec = require('../../lib/swim/codec');

test('Codec constructs a codec instance', function t(_, done) {
    assert.strictEqual(new Codec() instanceof Codec, true);
    done();
});

test('Codec supports json or msgpack', function t(_, done) {
    assert.doesNotThrow(Codec.bind({}, {codec: 'json'}));
    assert.doesNotThrow(Codec.bind({}, {codec: 'msgpack'}));
    assert.throws(Codec.bind({}, {codec: 'protobuf'}));
    done();
});

test('Codec can decode data encoded by same codec', function t(_, done) {
    var data = {foo: 'bar'};
    var jsonCodec = new Codec({codec: 'json'});
    var msgpackCodec = new Codec({codec: 'msgpack'});

    assert.deepStrictEqual(jsonCodec.decode(jsonCodec.encode(data)), data);
    assert.deepStrictEqual(msgpackCodec.decode(msgpackCodec.encode(data)), data);
    done();
});
