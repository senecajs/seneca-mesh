/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, test/membership.js),
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
var Membership = require('../../lib/swim/membership');
var MessageType = require('../../lib/swim/message-type');
var Net = require('../../lib/swim/net');

var SUSPECT_TIMEOUT = 10;
var LOCAL = new Member({
    host: 'localhost:0000'
});
var MEMBER_A = new Member({
    host: 'localhost:1111'
});

test('Membership sends suspect update back when receives Ack from member in suspect state', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });

    net.sendMessage = function sendMessage(message, host) {
        membership.stop();

        assert.strictEqual(host, MEMBER_A.host);
        assert.strictEqual(message.type, MessageType.Update);
        assert.strictEqual(message.data.state, Member.State.Suspect);
        assert.deepStrictEqual(message.data, membership.get(MEMBER_A.host).data());
        done();
    };

    membership.start();
    failureDetector.emit(FailureDetector.EventType.Suspect, MEMBER_A);
    net.emit(Net.EventType.Ack, MEMBER_A, MEMBER_A.host);
});

test('Membership emits update event when member becomes suspect', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(data.state, Member.State.Suspect);
        assert.deepStrictEqual(data, membership.get(data.host).data());
        done();
    });

    membership.start();
    failureDetector.emit(FailureDetector.EventType.Suspect, MEMBER_A);
});

test('Membership emits update event when member becomes faulty', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        },
        suspectTimeout: SUSPECT_TIMEOUT
    });
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Faulty);
                assert.strictEqual(membership.get(data.host), undefined);
                done();
                break;
        }
    });

    membership.start();
    failureDetector.emit(FailureDetector.EventType.Suspect, MEMBER_A);
});

test('Membership resumes suspect mechanism after restart', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        },
        suspectTimeout: SUSPECT_TIMEOUT
    });
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Faulty);
                assert.strictEqual(membership.get(data.host), undefined);
                done();
                break;
        }
    });

    membership.start();
    failureDetector.emit(FailureDetector.EventType.Suspect, MEMBER_A);
    membership.stop();
    membership.start();
});

test('Membership accepts alive update for remote member not in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(data.state, Member.State.Alive);
        assert.deepStrictEqual(data, update);
        assert.deepStrictEqual(data, membership.get(data.host).data());
        done();
    });

    membership.start();
    net.emit(Net.EventType.Update, update);
});

test('Membership accepts alive update with greater incarnation ' +
     'for alive/suspect remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                done();
                break;
        }
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    update.incarnation += 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops alive update with smaller or equal incarnation ' +
     'for alive/suspect remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 2:
                assert.fail();
                break;
        }
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        switch (dropEmitted) {
            case 0:
                dropEmitted++;

                assert.strictEqual(updateEmitted, 1);
                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                break;
            case 1:
                dropEmitted++;

                assert.strictEqual(updateEmitted, 1);
                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                break;
            case 2:
                dropEmitted++;

                assert.strictEqual(updateEmitted, 2);
                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                break;
            case 3:
                membership.stop();

                assert.strictEqual(updateEmitted, 2);
                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                done();
                break;
        }
    });

    membership.start();

    // accept
    net.emit(Net.EventType.Update, update);

    // drop
    net.emit(Net.EventType.Update, update);

    // drop
    update.incarnation -= 1;
    net.emit(Net.EventType.Update, update);

    // accept
    update.incarnation += 1;
    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);

    // drop
    update.state = Member.State.Alive;
    net.emit(Net.EventType.Update, update);

    // drop
    update.incarnation -= 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops alive update with smaller or equal incarnation ' +
     'for faulty member', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Faulty);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(membership.get(data.host), undefined);
                break;
            case 2:
                assert.fail();
                break;
        }
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        switch (dropEmitted) {
            case 0:
                dropEmitted++;

                assert.strictEqual(updateEmitted, 2);
                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                break;
            case 1:
                membership.stop();

                assert.strictEqual(updateEmitted, 2);
                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                done();
                break;
        }
    });

    membership.start();

    // accept
    update.state = Member.State.Alive;
    net.emit(Net.EventType.Update, update);

    // accept
    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);

    // drop
    update.state = Member.State.Alive;
    net.emit(Net.EventType.Update, update);

    // drop
    update.incarnation -= 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops alive update with smaller or equal incarnation for local member', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = LOCAL.data();
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate() {
        assert.fail();
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        switch (dropEmitted) {
            case 0:
                dropEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                break;
            case 1:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                done();
                break;
        }
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    net.emit(Net.EventType.Update, update);
});

test('Membership accepts alive update with greater incarnation for local member ' +
     'and local member affirms itself with greater incarnation', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = LOCAL.data();

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(data.state, Member.State.Alive);
        assert.strictEqual(data.incarnation > update.incarnation, true);
        done();
    });

    membership.start();

    update.incarnation += 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership accepts suspect update for remote member not in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(data.state, Member.State.Suspect);
        assert.deepStrictEqual(data, update);
        assert.deepStrictEqual(data, membership.get(data.host).data());
        done();
    });

    membership.start();

    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);
});

test('Membership accepts suspect update with greater incarnation ' +
     'for alive/suspect remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 2:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                done();
                break;
        }
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    update.incarnation += 1;
    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);

    update.incarnation += 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops suspect update with smaller or equal incarnation ' +
     'for suspect remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                assert.fail();
                break;
        }
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        switch (dropEmitted) {
            case 0:
                dropEmitted++;

                assert.strictEqual(updateEmitted, 1);
                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                break;
            case 1:
                membership.stop();

                assert.strictEqual(updateEmitted, 1);
                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                done();
                break;
        }
    });

    membership.start();

    // accept
    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);

    // drop
    net.emit(Net.EventType.Update, update);

    // drop
    update.incarnation -= 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops suspect update with smaller or equal incarnation ' +
     'for faulty member', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Faulty);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(membership.get(data.host), undefined);
                break;
            case 2:
                assert.fail();
                break;
        }
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        switch (dropEmitted) {
            case 0:
                dropEmitted++;

                assert.strictEqual(updateEmitted, 2);
                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                break;
            case 1:
                membership.stop();

                assert.strictEqual(updateEmitted, 2);
                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                done();
                break;
        }
    });

    membership.start();

    // accept
    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);

    // accept
    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);

    // drop
    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);

    // drop
    update.incarnation -= 1;
    net.emit(Net.EventType.Update, update);
});

test('Membership accepts suspect update with equal incarnation ' +
     'for alive remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Suspect);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                done();
                break;
        }
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops suspect update with smaller incarnation ' +
     'for alive remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        updateEmitted++;

        assert.strictEqual(data.state, Member.State.Alive);
        assert.deepStrictEqual(data, update);
        assert.deepStrictEqual(data, membership.get(data.host).data());
    });

    membership.on(Membership.EventType.Drop, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(updateEmitted, 1);
        assert.strictEqual(data.state, Member.State.Suspect);
        assert.deepStrictEqual(data, update);
        done();
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    update.incarnation -= 1;
    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops suspect update with for local member ' +
     'and local member affirms itself with greater incarnation', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = LOCAL.data();
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(dropEmitted, 1);
        assert.strictEqual(data.state, Member.State.Alive);
        assert.strictEqual(data.incarnation > update.incarnation, true);
        done();
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        dropEmitted++;

        assert.strictEqual(data.state, Member.State.Suspect);
        assert.deepStrictEqual(data, update);
    });

    membership.start();

    update.state = Member.State.Suspect;
    net.emit(Net.EventType.Update, update);
});

test('Membership accepts faulty update with greater or equal incarnation ' +
     'for remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        switch (updateEmitted) {
            case 0:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 1:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Faulty);
                assert.deepStrictEqual(data, update);
                assert.strictEqual(membership.get(data.host), undefined);
                break;
            case 2:
                updateEmitted++;

                assert.strictEqual(data.state, Member.State.Alive);
                assert.deepStrictEqual(data, update);
                assert.deepStrictEqual(data, membership.get(data.host).data());
                break;
            case 3:
                membership.stop();

                assert.strictEqual(data.state, Member.State.Faulty);
                assert.deepStrictEqual(data, update);
                assert.strictEqual(membership.get(data.host), undefined);
                done();
                break;
        }
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);

    update.incarnation += 1;
    update.state = Member.State.Alive;
    net.emit(Net.EventType.Update, update);

    update.incarnation += 1;
    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops faulty update with for remote member not in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        membership.stop();

        assert.strictEqual(data.state, Member.State.Faulty);
        assert.deepStrictEqual(data, update);
        done();
    });

    membership.start();

    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops faulty update with smaller incarnation for remote member in membership', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = MEMBER_A.data();
    var updateEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        updateEmitted++;

        assert.strictEqual(data.state, Member.State.Alive);
        assert.deepStrictEqual(data, update);
        assert.deepStrictEqual(data, membership.get(data.host).data());
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        membership.stop();

        assert.strictEqual(updateEmitted, 1);
        assert.strictEqual(data.state, Member.State.Faulty);
        assert.deepStrictEqual(data, update);
        done();
    });

    membership.start();

    net.emit(Net.EventType.Update, update);

    update.incarnation -= 1;
    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);
});

test('Membership drops faulty update with for local member ' +
     'and local member affirms itself with greater incarnation', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var update = LOCAL.data();
    var dropEmitted = 0;

    membership.on(Membership.EventType.Update, function onUpdate(data) {
        membership.stop();

        assert.strictEqual(dropEmitted, 1);
        assert.strictEqual(data.state, Member.State.Alive);
        assert.strictEqual(data.incarnation > update.incarnation, true);
        done();
    });

    membership.on(Membership.EventType.Drop, function onDrop(data) {
        assert.strictEqual(dropEmitted, 0);
        assert.strictEqual(data.state, Member.State.Faulty);
        assert.deepStrictEqual(data, update);

        dropEmitted++;
    });

    membership.start();

    update.state = Member.State.Faulty;
    net.emit(Net.EventType.Update, update);
});

test('Membership is a infinite round robin iterator', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var numberOfMembers = Math.ceil(Math.random() * 10);
    var numberOfIterations = Math.ceil(Math.random() * 5);
    var hostToCount = Object.create(null);
    var member;
    var i;
    var j;

    membership.start();

    for (i = 0; i < numberOfMembers; i++) {
        net.emit(Net.EventType.Update, new Member({
            host: 'localhost:' + i
        }).data());
    }

    membership.stop();

    for (i = 0; i < numberOfMembers; i++) {
        member = membership.next();
        hostToCount[member.host] = (hostToCount[member.host] || 0) + 1;
    }

    Object.keys(hostToCount).forEach(function verify(host) {
        assert.strictEqual(hostToCount[host], 1);
    });

    for (j = 0; j < numberOfIterations; j++) {
        for (i = 0; i < numberOfMembers; i++) {
            member = membership.next();
            hostToCount[member.host] = (hostToCount[member.host] || 0) + 1;
        }
    }

    Object.keys(hostToCount).forEach(function verify(host) {
        assert.strictEqual(hostToCount[host], numberOfIterations + 1);
    });

    assert.strictEqual(hostToCount[LOCAL.host], undefined);
    done();
});

test('Membership next to undefined when there is only local member', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });

    assert.strictEqual(membership.next(), undefined);
    done();
});

test('Membership can randomly select up to n unique remote members', function t(_, done) {
    var failureDetector = new events.EventEmitter();
    var net = new events.EventEmitter();
    var membership = new Membership({
        local: LOCAL.data(),
        swim: {
            failureDetector: failureDetector,
            net: net
        }
    });
    var numberOfMembers = Math.ceil(Math.random() * 10);
    var numberOfIterations = Math.ceil(Math.random() * 5);
    var selected;
    var n;
    var i;
    var j;

    assert.strictEqual(membership.random(1).length, 0);

    membership.start();

    for (i = 0; i < numberOfMembers; i++) {
        net.emit(Net.EventType.Update, new Member({
            host: 'localhost:' + i
        }).data());
    }

    membership.stop();

    for (j = 0; j < numberOfIterations; j++) {
        n = Math.floor(Math.random() * numberOfMembers * 2);
        selected = membership.random(n);

        assert.strictEqual(Array.isArray(selected), true);
        assert.strictEqual(selected.length <= n, true);
        /* jshint loopfunc: true */
        assert.strictEqual(Object.keys(selected.reduce(function mark(result, curr) {
            result[curr.host] = true;
            return result;
        }, Object.create(null))).length, selected.length);
        /* jshint loopfunc: false */
    }

    done();
});
