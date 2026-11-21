'use strict';
var async = require('async');
var test = require('tape');

var Codec = require('../lib/codec');
var MessageType = require('../lib/message-type');
var Net = require('../lib/net');

var codec = new Codec();

test('Net can send and receive primitive messages', function t(assert) {
    var senderOpts = {
        swim: {
            codec: codec,
            disseminator: {
                getUpdatesUpTo: function getUpdatesUpTo() {
                    return [];
                }
            }
        },
        udp: {
            port: 0
        }
    };
    var receiverOpts = {
        swim: {
            codec: codec
        },
        udp: {
            port: 0
        }
    };
    var sender = new Net(senderOpts);
    var receiver = new Net(receiverOpts);
    var tests = [{
        type: MessageType.Ping,
        data: {
            seq: Math.random()
        },
        event: Net.EventType.Ping
    }, {
        type: MessageType.PingReq,
        data: {
            seq: Math.random()
        },
        event: Net.EventType.PingReq
    }, {
        type: MessageType.Sync,
        data: {
            seq: Math.random()
        },
        event: Net.EventType.Sync
    }, {
        type: MessageType.Ack,
        data: {
            seq: Math.random()
        },
        event: Net.EventType.Ack
    }, {
        type: MessageType.Update,
        data: {
            seq: Math.random()
        },
        event: Net.EventType.Update
    }];
    var senderPort;
    var receiverPort;

    async.parallel([
        sender.listen.bind(sender),
        receiver.listen.bind(receiver)
    ], function parallelCallback(err) {
        assert.notOk(err);

        senderPort = sender.udpSocket.address().port;
        receiverPort = receiver.udpSocket.address().port;

        async.each(tests, function runTest(test, callback) {
            receiver.on(test.event, function onEvent(data, host) {
                assert.deepEqual(data, test.data);
                assert.strictEqual(parseInt(host.split(':')[1]), senderPort);

                receiver.removeAllListeners(test.event);
                callback();
            });

            sender.sendMessage({
                type: test.type,
                data: test.data
            }, 'localhost:' + receiverPort);
        }, function eachCallback() {
            sender.close();
            receiver.close();

            assert.end();
        });
    });
});

test('Net can send and receive primitive messages with piggybacked updates', function t(assert) {
    var randomPingData = {
        seq: Math.random()
    };
    var randomUpdateData = {
        seq: Math.random()
    };
    var senderOpts = {
        swim: {
            codec: codec,
            disseminator: {
                getUpdatesUpTo: function getUpdatesUpTo(bytesAvailable) {
                    var expectedBytesAvailable = Net.Default.udp.maxDgramSize - Net.MessageTypeSize -
                        Net.LengthSize * 2 - Net.MessageTypeSize - codec.encode(randomPingData).length;
                    var header;

                    assert.strictEqual(bytesAvailable, expectedBytesAvailable);

                    header = new Buffer(Net.MessageTypeSize);
                    Net.WriteMessageType.call(header, MessageType.Update, 0);

                    return [Buffer.concat([header, codec.encode(randomUpdateData)])];
                }
            }
        },
        udp: {
            port: 0
        }
    };
    var receiverOpts = {
        swim: {
            codec: codec
        },
        udp: {
            port: 0
        }
    };
    var sender = new Net(senderOpts);
    var receiver = new Net(receiverOpts);
    var senderPort;
    var receiverPort;

    async.parallel([
        sender.listen.bind(sender),
        receiver.listen.bind(receiver)
    ], function parallelCallback(err) {
        assert.notOk(err);

        senderPort = sender.udpSocket.address().port;
        receiverPort = receiver.udpSocket.address().port;

        async.parallel([
            function receivePing(callback) {
                receiver.on(Net.EventType.Ping, function onPing(data, host) {
                    assert.deepEqual(data, randomPingData);
                    assert.strictEqual(parseInt(host.split(':')[1]), senderPort);
                    callback();
                });
            },
            function receiveUpdate(callback) {
                receiver.on(Net.EventType.Update, function onUpdate(data, host) {
                    assert.deepEqual(data, randomUpdateData);
                    assert.strictEqual(parseInt(host.split(':')[1]), senderPort);
                    callback();
                });
            },
            function send(callback) {
                sender.sendMessage({
                    type: MessageType.Ping,
                    data: randomPingData
                }, 'localhost:' + receiverPort);
                callback();
            }
        ], function parallelCallback() {
            receiver.removeAllListeners();

            sender.close();
            receiver.close();

            assert.end();
        });
    });
});

test('Net can send and receive multiple messages batched over packets', function t(assert) {
    var senderOpts = {
        swim: {
            codec: codec
        },
        udp: {
            port: 0
        }
    };
    var receiverOpts = {
        swim: {
            codec: codec
        },
        udp: {
            port: 0
        }
    };
    var sender = new Net(senderOpts);
    var receiver = new Net(receiverOpts);
    var messages = [];
    var received = [];
    var messageCount = 100;
    var packetCount = 0;
    var senderPort;
    var receiverPort;
    var i;

    for (i = 0; i < messageCount; i++) {
        messages.push({
            type: MessageType.Update,
            data: {
                seq: Math.random()
            }
        });
    }

    sender.sendBuffer = function sendBuffer(buffer, host) {
        packetCount++;
        Net.prototype.sendBuffer.call(sender, buffer, host);
    };

    async.parallel([
        sender.listen.bind(sender),
        receiver.listen.bind(receiver)
    ], function parallelCallback(err) {
        assert.notOk(err);

        senderPort = sender.udpSocket.address().port;
        receiverPort = receiver.udpSocket.address().port;

        async.parallel([
            function receiveUpdate(callback) {
                receiver.on(Net.EventType.Update, function onUpdate(data) {
                    received.push({
                        type: MessageType.Update,
                        data: data
                    });

                    if (received.length === messages.length) {
                        callback();
                    }
                });
            },
            function send(callback) {
                sender.sendMessages(messages, 'localhost:' + receiverPort);
                callback();
            }
        ], function parallelCallback() {
            assert.strictEqual(packetCount < messageCount, true);
            assert.deepEqual(received.length, messages.length);
            assert.deepEqual(sum(received), sum(messages));

            receiver.removeAllListeners();

            sender.close();
            receiver.close();

            assert.end();
        });
    });
});

function sum(messages) {
    messages.reduce(function sum(acc, m) {
        return acc += m.seq;
    }, 0);
}
