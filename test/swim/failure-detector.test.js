/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, test/failure-detector.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See lib/swim/LICENSE.
  Local changes: moved from tape to node:test and node:assert.
*/
'use strict';
var events = require('events');
var assert = require('node:assert');
var test = require('node:test');

var FailureDetector = require('../../lib/swim/failure-detector');
var Member = require('../../lib/swim/member');
var MessageType = require('../../lib/swim/message-type');
var Net = require('../../lib/swim/net');

var INTERVAL = 100;
var MAX_TICKS = 3;
var TICKS = Math.ceil(Math.random() * MAX_TICKS);
var TICK_OFFSET = -0.5;
var MEMBER_A = new Member({
    host: 'localhost:1111'
});
var MEMBER_B = new Member({
    host: 'localhost:2222'
});

test('FailureDetector ticks/pings at defined interval', function t(_, done) {
    var pingCalled = 0;
    var membership = {
        next: function next() {
            pingCalled++;
        }
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        },
        interval: INTERVAL
    });

    failureDetector.start();

    setTimeout(function verify() {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        assert.strictEqual(pingCalled, TICKS);
        done();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector does not send PingReq when receives Ack of Ping in time', function t(_, done) {
    var pingCalled = 0;
    var membership = {
        next: function next() {
            pingCalled++;
            return MEMBER_A;
        },
        random: function random() {
            assert.fail();
        }
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        },
        interval: INTERVAL
    });

    net.sendMessage = function sendMessage(message, host) {
        net.emit(Net.EventType.Ack, {
            seq: message.data.seq
        }, host);
    };

    failureDetector.start();

    setTimeout(function verify() {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        assert.strictEqual(pingCalled, TICKS);
        done();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector sends PingReq when does not receive Ack of Ping in time', function t(_, done) {
    var pingTimeout = 1;
    var pingReqCalled = 0;
    var membership = {
        next: function next() {
            return MEMBER_A;
        },
        random: function random() {
            pingReqCalled++;
            return [];
        }
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        },
        interval: INTERVAL,
        pingTimeout: pingTimeout
    });

    net.sendMessage = function sendMessage() {};

    failureDetector.start();

    setTimeout(function verify() {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        assert.strictEqual(pingReqCalled, TICKS);
        done();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector does not emit suspect event when receives Ack of PingReq in time', function t(_, done) {
    var pingTimeout = 1;
    var pingReqTimeout = 10;
    var pingReqCalled = 0;
    var membership = {
        next: function next() {
            return MEMBER_A;
        },
        random: function random() {
            pingReqCalled++;
            return [MEMBER_B];
        }
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        },
        interval: INTERVAL,
        pingTimeout: pingTimeout,
        pingReqTimeout: pingReqTimeout
    });

    net.sendMessage = function sendMessage(message, host) {
        if (message.type === MessageType.PingReq) {
            net.emit(Net.EventType.Ack, {
                seq: message.data.seq
            }, host);
        }
    };

    failureDetector.on(FailureDetector.EventType.Suspect, function onSuspect() {
        assert.fail();
    });

    failureDetector.start();

    setTimeout(function verify() {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        assert.strictEqual(pingReqCalled, TICKS);
        done();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector emits suspect event when does not receive Ack of PingReq in time', function t(_, done) {
    var pingTimeout = 1;
    var pingReqTimeout = 1;
    var suspectEmitted = 0;
    var membership = {
        next: function next() {
            return MEMBER_A;
        },
        random: function random() {
            return [MEMBER_B];
        }
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        },
        interval: INTERVAL,
        pingTimeout: pingTimeout,
        pingReqTimeout: pingReqTimeout
    });

    net.sendMessage = function sendMessage() {};

    failureDetector.on(FailureDetector.EventType.Suspect, function onSuspect(suspect) {
        suspectEmitted++;
        assert.strictEqual(suspect, MEMBER_A);
    });

    failureDetector.start();

    setTimeout(function verify() {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        assert.strictEqual(suspectEmitted, TICKS);
        done();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector sends Ack when receives Ping', function t(_, done) {
    var membership = {
        next: function next() {}
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        }
    });
    var seq = Math.random();

    net.sendMessage = function sendMessage(message, host) {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        assert.strictEqual(message.type, MessageType.Ack);
        assert.strictEqual(message.data.seq, seq);
        assert.strictEqual(host, MEMBER_A.host);
        done();
    };

    failureDetector.start();

    net.emit(Net.EventType.Ping, {
        seq: seq
    }, MEMBER_A.host);
});

test('FailureDetector sends Ping to destination when receives PingReq, ' +
     'then sends Ack to PingReq requester when receives Ack from destination', function t(_, done) {
    var membership = {
        next: function next() {}
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        }
    });
    var seq = Math.random();
    var sendMessageCalled = 0;

    net.sendMessage = function sendMessage(message, host) {
        switch (sendMessageCalled) {
            case 0:
                sendMessageCalled++;

                assert.strictEqual(message.type, MessageType.Ping);
                assert.strictEqual(host, MEMBER_B.host);

                net.emit(Net.EventType.Ack, {
                    seq: message.data.seq
                }, host);
                break;
            case 1:
                verifyInternal(failureDetector, assert);
                failureDetector.stop();

                assert.strictEqual(message.type, MessageType.Ack);
                assert.strictEqual(host, MEMBER_A.host);

                done();
                break;
        }
    };

    failureDetector.start();

    net.emit(Net.EventType.PingReq, {
        seq: seq,
        destination: MEMBER_B.host
    }, MEMBER_A.host);
});

test('FailureDetector does not send Ack to PingReq requester ' +
     'when does not receive Ack from destination', function t(_, done) {
    var pingTimeout = 1;
    var membership = {
        next: function next() {}
    };
    var net = new events.EventEmitter();
    var failureDetector = new FailureDetector({
        swim: {
            membership: membership,
            net: net
        },
        interval: INTERVAL,
        pingTimeout: pingTimeout
    });
    var seq = Math.random();
    var sendMessageCalled = 0;

    net.sendMessage = function sendMessage(message, host) {
        switch (sendMessageCalled) {
            case 0:
                sendMessageCalled++;

                assert.strictEqual(message.type, MessageType.Ping);
                assert.strictEqual(host, MEMBER_B.host);
                break;
            case 1:
                assert.fail();
                break;
        }
    };

    failureDetector.start();

    net.emit(Net.EventType.PingReq, {
        seq: seq,
        destination: MEMBER_B.host
    }, MEMBER_A.host);

    setTimeout(function verify() {
        verifyInternal(failureDetector, assert);
        failureDetector.stop();

        done();
    }, INTERVAL);
});

function verifyInternal(failureDetector, assert) {
    assert.strictEqual(Object.keys(failureDetector.seqToTimeout).length, 0);
    assert.strictEqual(Object.keys(failureDetector.seqToCallback).length, 0);
}
