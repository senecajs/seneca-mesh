/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, test/disseminator.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See lib/swim/LICENSE.
  Local changes: moved from tape to node:test and node:assert.
*/
'use strict';
var events = require('events');
var assert = require('node:assert');
var test = require('node:test');

var Codec = require('../../lib/swim/codec');
var Disseminator = require('../../lib/swim/disseminator');
var Membership = require('../../lib/swim/membership');
var MessageType = require('../../lib/swim/message-type');
var Net = require('../../lib/swim/net');

var codec = new Codec();

test('Disseminator honors bytesAvailable, dissemination limit and priority', function t(_, done) {
    var membership = new events.EventEmitter();
    var disseminator = new Disseminator({
        swim: {
            codec: codec,
            membership: membership
        }
    });
    var minDgramSize = Math.pow(2, 6);
    var maxDgramSize = Math.pow(2, 9);
    var numberOfUpdates = Math.ceil(Math.random() * 5);
    var numberOfMembers = Math.ceil(Math.random() * 3);
    var numberOfBuffers = 0;
    var hostToCount = Object.create(null);
    var buffers;
    var bytesAvailable;
    var update;
    var length;
    var i;

    membership.size = function size() {
        return numberOfMembers;
    };

    disseminator.start();

    buffers = disseminator.getUpdatesUpTo(Infinity);
    assert.strictEqual(buffers.length, 0);

    for (i = 0; i < numberOfUpdates; i++) {
        membership.emit(Membership.EventType.Update, {
            host: 'localhost:' + i
        });
    }

    bytesAvailable = Math.ceil(Math.random() * (maxDgramSize - minDgramSize)) + minDgramSize;
    buffers = disseminator.getUpdatesUpTo(bytesAvailable);

    while (buffers.length > 0) {
        length = 0;

        /* jshint loopfunc: true */
        buffers.forEach(function verify(buffer) {
            assert.strictEqual(Net.ReadMessageType.call(buffer, 0), MessageType.Update);

            length += buffer.length;
            update = codec.decode(buffer.slice(Net.MessageTypeSize));

            Object.keys(hostToCount).forEach(function verifyPriority(host) {
                assert.strictEqual(hostToCount[update.host] > hostToCount[host], false);
            });

            hostToCount[update.host] = (hostToCount[update.host] || 0) + 1;
        });
        /* jshint loopfunc: false */

        assert.strictEqual(length < bytesAvailable, true);
        numberOfBuffers += buffers.length;

        bytesAvailable = Math.ceil(Math.random() * (maxDgramSize - minDgramSize)) + minDgramSize;
        buffers = disseminator.getUpdatesUpTo(bytesAvailable);
    }

    assert.strictEqual(numberOfBuffers, numberOfUpdates *
        Disseminator.Default.disseminationFormula(Disseminator.Default.disseminationFactor, numberOfMembers));
    disseminator.stop();
    done();
});

test('Disseminator removes over disseminated updates on decrease of dissemination limit', function t(_, done) {
    var membership = new events.EventEmitter();
    var disseminator = new Disseminator({
        swim: {
            codec: codec,
            membership: membership
        },
        disseminationFactor: 1,
        disseminationFormula: function disseminationFormula(factor, size) {
            return factor * size;
        }
    });
    var numberOfMembers = 10;
    var buffers;

    membership.size = function size() {
        return numberOfMembers;
    };

    disseminator.start();

    membership.emit(Membership.EventType.Update, {
        host: 'localhost:22'
    });

    buffers = disseminator.getUpdatesUpTo(Infinity);
    assert.strictEqual(buffers.length, 1);

    numberOfMembers = 1;
    membership.emit(Membership.EventType.Change);

    buffers = disseminator.getUpdatesUpTo(Infinity);
    assert.strictEqual(buffers.length, 0);

    disseminator.stop();
    done();
});
