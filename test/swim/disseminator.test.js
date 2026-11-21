'use strict';
var events = require('events');
var test = require('tape');

var Codec = require('../lib/codec');
var Disseminator = require('../lib/disseminator');
var Membership = require('../lib/membership');
var MessageType = require('../lib/message-type');
var Net = require('../lib/net');

var codec = new Codec();

test('Disseminator honors bytesAvailable, dissemination limit and priority', function t(assert) {
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
    assert.end();
});

test('Disseminator removes over disseminated updates on decrease of dissemination limit', function t(assert) {
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
    assert.end();
});
