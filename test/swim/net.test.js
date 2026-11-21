/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, test/net.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See lib/swim/LICENSE.
  Local changes: moved from tape to node:test and node:assert; the async
  module is replaced by small helpers; the batched messages test compares
  the received values (the original sum() returned nothing); a test checks
  that close() releases the socket.
*/
'use strict';
var assert = require('node:assert');
var test = require('node:test');

var Codec = require('../../lib/swim/codec');
var MessageType = require('../../lib/swim/message-type');
var Net = require('../../lib/swim/net');

var codec = new Codec();

test('Net can send and receive primitive messages', function t(_, done) {
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

    parallel([
        sender.listen.bind(sender),
        receiver.listen.bind(receiver)
    ], function parallelCallback(err) {
        assert.ifError(err);

        senderPort = sender.udpSocket.address().port;
        receiverPort = receiver.udpSocket.address().port;

        each(tests, function runTest(test, callback) {
            receiver.on(test.event, function onEvent(data, host) {
                assert.deepStrictEqual(data, test.data);
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

            done();
        });
    });
});

test('Net can send and receive primitive messages with piggybacked updates', function t(_, done) {
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

                    header = Buffer.alloc(Net.MessageTypeSize);
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

    parallel([
        sender.listen.bind(sender),
        receiver.listen.bind(receiver)
    ], function parallelCallback(err) {
        assert.ifError(err);

        senderPort = sender.udpSocket.address().port;
        receiverPort = receiver.udpSocket.address().port;

        parallel([
            function receivePing(callback) {
                receiver.on(Net.EventType.Ping, function onPing(data, host) {
                    assert.deepStrictEqual(data, randomPingData);
                    assert.strictEqual(parseInt(host.split(':')[1]), senderPort);
                    callback();
                });
            },
            function receiveUpdate(callback) {
                receiver.on(Net.EventType.Update, function onUpdate(data, host) {
                    assert.deepStrictEqual(data, randomUpdateData);
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

            done();
        });
    });
});

test('Net can send and receive multiple messages batched over packets', function t(_, done) {
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

    parallel([
        sender.listen.bind(sender),
        receiver.listen.bind(receiver)
    ], function parallelCallback(err) {
        assert.ifError(err);

        senderPort = sender.udpSocket.address().port;
        receiverPort = receiver.udpSocket.address().port;

        parallel([
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
            assert.deepStrictEqual(received.length, messages.length);
            assert.deepStrictEqual(seqs(received), seqs(messages));

            receiver.removeAllListeners();

            sender.close();
            receiver.close();

            done();
        });
    });
});

test('Net close releases the socket and drops later messages', function t(_, done) {
    var net = new Net({
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
    });

    assert.strictEqual(net.udpSocket, null);

    net.listen(function onListen() {
        var socket = net.udpSocket;

        assert.notStrictEqual(socket, null);

        socket.on('close', function onClose() {
            assert.strictEqual(net.udpSocket, null);

            // not listening: nothing is sent and no socket is created
            net.sendMessage({
                type: MessageType.Ping,
                data: {
                    seq: 1
                }
            }, 'localhost:1');
            assert.strictEqual(net.udpSocket, null);

            // a second close does nothing
            net.close();
            done();
        });

        net.close();
    });
});

function seqs(messages) {
    return messages.map(function seq(m) {
        return m.data.seq;
    }).sort();
}

// Run the tasks, then call callback with the first error, if any.
function parallel(tasks, callback) {
    var pending = tasks.length;
    var failed = false;

    tasks.forEach(function run(task) {
        task(function taskCallback(err) {
            if (failed) {
                return;
            }
            if (err) {
                failed = true;
                return callback(err);
            }
            if (--pending === 0) {
                callback();
            }
        });
    });
}

// Run iterator on each item in parallel, then call callback.
function each(items, iterator, callback) {
    parallel(items.map(function toTask(item) {
        return iterator.bind(undefined, item);
    }), callback);
}
