'use strict';
var events = require('events');
var test = require('tape');

var FailureDetector = require('../lib/failure-detector');
var Member = require('../lib/member');
var MessageType = require('../lib/message-type');
var Net = require('../lib/net');

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

test('FailureDetector ticks/pings at defined interval', function t(assert) {
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
        assert.end();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector does not send PingReq when receives Ack of Ping in time', function t(assert) {
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
        assert.end();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector sends PingReq when does not receive Ack of Ping in time', function t(assert) {
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
        assert.end();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector does not emit suspect event when receives Ack of PingReq in time', function t(assert) {
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
        assert.end();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector emits suspect event when does not receive Ack of PingReq in time', function t(assert) {
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
        assert.end();
    }, INTERVAL * (TICKS + TICK_OFFSET));
});

test('FailureDetector sends Ack when receives Ping', function t(assert) {
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
        assert.end();
    };

    failureDetector.start();

    net.emit(Net.EventType.Ping, {
        seq: seq
    }, MEMBER_A.host);
});

test('FailureDetector sends Ping to destination when receives PingReq, ' +
     'then sends Ack to PingReq requester when receives Ack from destination', function t(assert) {
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

                assert.end();
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
     'when does not receive Ack from destination', function t(assert) {
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

        assert.end();
    }, INTERVAL);
});

function verifyInternal(failureDetector, assert) {
    assert.strictEqual(Object.keys(failureDetector.seqToTimeout).length, 0);
    assert.strictEqual(Object.keys(failureDetector.seqToCallback).length, 0);
}
