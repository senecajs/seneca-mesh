'use strict';
var debug = require('debug');
var dgram = require('dgram');
var events = require('events');
var util = require('util');

var MessageType = require('./message-type');

function Net(opts) {
    this.swim = opts.swim;
    this.udp = {
        port: opts.udp.port,
        type: opts.udp.type || Net.Default.udp.type,
        maxDgramSize: opts.udp.maxDgramSize || Net.Default.udp.maxDgramSize
    };

    this.errorListener = this.emit.bind(this, Net.EventType.Error);
    this.listeningListener = this.emit.bind(this, Net.EventType.Listening);
    this.messageListener = this.onNetMessage.bind(this);

    this.udpSocket = dgram.createSocket(this.udp.type);
    this.debug = debug('swim:net').bind(undefined, opts.debugIdentifier);
}

util.inherits(Net, events.EventEmitter);

Net.prototype.listen = function listen(callback) {
    this.udpSocket.on('error', this.errorListener);
    this.udpSocket.on('listening', this.listeningListener);
    this.udpSocket.on('message', this.messageListener);
    this.udpSocket.bind(this.udp.port, callback);
};

Net.prototype.close = function close() {
    this.udpSocket.removeListener('error', this.errorListener);
    this.udpSocket.removeListener('listening', this.listeningListener);
    this.udpSocket.removeListener('message', this.messageListener);
    this.udpSocket.close();
    this.udpSocket = dgram.createSocket(this.udp.type);
};

Net.prototype.onNetMessage = function onNetMessage(buffer, rinfo) {
    this.debug('received buffer', {
        from: formatRinfo(rinfo),
        length: buffer.length
    });

    this.onMessage(buffer, rinfo);
};

Net.prototype.onMessage = function onMessage(buffer, rinfo) {
    if (buffer.length < Net.MessageTypeSize) {
        return this.onUnknown(buffer, rinfo);
    }

    var messageType = Net.ReadMessageType.call(buffer, 0);

    switch (messageType) {
        case MessageType.Compound:
            this.onCompound(buffer.slice(Net.MessageTypeSize), rinfo);
            break;
        case MessageType.Ping:
            this.onPing(buffer.slice(Net.MessageTypeSize), rinfo);
            break;
        case MessageType.PingReq:
            this.onPingReq(buffer.slice(Net.MessageTypeSize), rinfo);
            break;
        case MessageType.Sync:
            this.onSync(buffer.slice(Net.MessageTypeSize), rinfo);
            break;
        case MessageType.Ack:
            this.onAck(buffer.slice(Net.MessageTypeSize), rinfo);
            break;
        case MessageType.Update:
            this.onUpdate(buffer.slice(Net.MessageTypeSize), rinfo);
            break;
        default:
            this.onUnknown(buffer, rinfo);
    }
};

Net.prototype.onCompound = function onCompound(buffer, rinfo) {
    this.debug('received compound message');

    if (buffer.length < Net.LengthSize) {
        this.debug('cannot parse number of messages in compound message', {
            from: formatRinfo(rinfo),
            length: buffer.length,
            buffer: buffer.toString()
        });
        return;
    }

    var numberOfMessages = Net.ReadLength.call(buffer, 0);
    var readIndex = Net.LengthSize;
    var length;
    var i;

    for (i = 0; i < numberOfMessages; i++) {
        if (buffer.length - readIndex < Net.LengthSize) {
            this.debug('cannot parse length of message in compound message', {
                readIndex: readIndex,
                from: formatRinfo(rinfo),
                length: buffer.length,
                buffer: buffer.toString()
            });
            break;
        }

        length = Net.ReadLength.call(buffer, readIndex);
        readIndex += Net.LengthSize;
        this.onMessage(buffer.slice(readIndex, readIndex + length), rinfo);
        readIndex += length;
    }
};

Net.prototype.onPing = function onPing(buffer, rinfo) {
    var data;

    try {
        data = this.swim.codec.decode(buffer);
    } catch (e) {
        this.debug('failed to decode data', {
            stack: e.stack,
            from: formatRinfo(rinfo),
            length: buffer.length,
            buffer: buffer.toString()
        });
        return;
    }

    this.debug('received ping message', {
        from: formatRinfo(rinfo),
        data: data
    });

    this.emit(Net.EventType.Ping, data, formatRinfo(rinfo));
};

Net.prototype.onPingReq = function onPingReq(buffer, rinfo) {
    var data;

    try {
        data = this.swim.codec.decode(buffer);
    } catch (e) {
        this.debug('failed to decode data', {
            stack: e.stack,
            from: formatRinfo(rinfo),
            length: buffer.length,
            buffer: buffer.toString()
        });
        return;
    }

    this.debug('received pingreq message', {
        from: formatRinfo(rinfo),
        data: data
    });

    this.emit(Net.EventType.PingReq, data, formatRinfo(rinfo));
};

Net.prototype.onSync = function onSync(buffer, rinfo) {
    var data;

    try {
        data = this.swim.codec.decode(buffer);
    } catch (e) {
        this.debug('failed to decode data', {
            stack: e.stack,
            from: formatRinfo(rinfo),
            length: buffer.length,
            buffer: buffer.toString()
        });
        return;
    }

    this.debug('received sync message', {
        from: formatRinfo(rinfo),
        data: data
    });

    this.emit(Net.EventType.Sync, data, formatRinfo(rinfo));
};

Net.prototype.onAck = function onAck(buffer, rinfo) {
    var data;

    try {
        data = this.swim.codec.decode(buffer);
    } catch (e) {
        this.debug('failed to decode data', {
            stack: e.stack,
            from: formatRinfo(rinfo),
            length: buffer.length,
            buffer: buffer.toString()
        });
        return;
    }

    this.debug('received ack message', {
        from: formatRinfo(rinfo),
        data: data
    });

    this.emit(Net.EventType.Ack, data, formatRinfo(rinfo));
};

Net.prototype.onUpdate = function onUpdate(buffer, rinfo) {
    var data;

    try {
        data = this.swim.codec.decode(buffer);
    } catch (e) {
        this.debug('failed to decode data', {
            stack: e.stack,
            from: formatRinfo(rinfo),
            length: buffer.length,
            buffer: buffer.toString()
        });
        return;
    }

    this.debug('received update message', {
        from: formatRinfo(rinfo),
        data: data
    });

    this.emit(Net.EventType.Update, data, formatRinfo(rinfo));
};

Net.prototype.onUnknown = function onUnknown(buffer, rinfo) {
    this.debug('received unknown buffer', {
        from: formatRinfo(rinfo),
        buffer: buffer.toString()
    });

    this.emit(Net.EventType.Unknown, buffer, formatRinfo(rinfo));
};

Net.prototype.sendMessages = function sendMessages(messages, host) {
    var self = this;
    var bytesAvailable = self.udp.maxDgramSize - Net.MessageTypeSize - Net.LengthSize;
    var buffers = [];
    var buffer;
    var message;
    var i;

    for (i = 0; i < messages.length; i++) {
        message = messages[i];
        buffer = new Buffer(Net.MessageTypeSize);
        Net.WriteMessageType.call(buffer, message.type, 0);
        buffer = Buffer.concat([buffer, self.swim.codec.encode(message.data)]);

        if (buffer.length + Net.LengthSize < bytesAvailable) {
            buffers.push(buffer);
            bytesAvailable -= buffer.length + Net.LengthSize;
        } else if (buffers.length === 0) {
            this.debug('oversized message', {
                length: buffer.length,
                message: message
            });
        } else {
            self.sendBuffer(self.makeCompoundMessage(buffers), host);
            bytesAvailable = self.udp.maxDgramSize - Net.LengthSize;
            buffers = [];
            i--;
        }
    }

    if (buffers.length > 0) {
        self.sendBuffer(self.makeCompoundMessage(buffers), host);
    }
};

Net.prototype.sendMessage = function sendMessage(message, host) {
    var header = new Buffer(Net.MessageTypeSize);

    Net.WriteMessageType.call(header, message.type, 0);

    if (message.data) {
        this.piggybackAndSend(Buffer.concat([header, this.swim.codec.encode(message.data)]), host);
    } else {
        this.piggybackAndSend(header, host);
    }
};

Net.prototype.piggybackAndSend = function piggybackAndSend(buffer, host) {
    var bytesAvailable = this.udp.maxDgramSize - Net.MessageTypeSize - Net.LengthSize * 2 - buffer.length;
    var buffers = this.swim.disseminator.getUpdatesUpTo(bytesAvailable);

    if (buffers.length === 0) {
        return this.sendBuffer(buffer, host);
    }

    buffers.unshift(buffer);

    this.sendBuffer(this.makeCompoundMessage(buffers), host);
};

Net.prototype.makeCompoundMessage = function makeCompoundMessage(buffers) {
    var header = new Buffer(Net.MessageTypeSize + Net.LengthSize);

    Net.WriteMessageType.call(header, MessageType.Compound, 0);
    Net.WriteLength.call(header, buffers.length, Net.MessageTypeSize);

    buffers = buffers.map(function toBuffer(buffer) {
        var header = new Buffer(Net.LengthSize);

        Net.WriteLength.call(header, buffer.length, 0);

        return Buffer.concat([header, buffer]);
    });

    buffers.unshift(header);

    return Buffer.concat(buffers);
};

Net.prototype.sendBuffer = function sendBuffer(buffer, host) {
    var address = host.split(':')[0];
    var port = host.split(':')[1];

    this.udpSocket.send(buffer, 0, buffer.length, port, address);
    this.debug('sent buffer', {
        to: host,
        length: buffer.length
    });
};

Net.MessageTypeSize = 1;
Net.LengthSize = 2;
Net.ReadMessageType = Buffer.prototype.readUInt8;
Net.ReadLength = Buffer.prototype.readUInt16LE;
Net.WriteMessageType = Buffer.prototype.writeUInt8;
Net.WriteLength = Buffer.prototype.writeUInt16LE;

Net.Default = {
    udp: {
        type: 'udp4',
        maxDgramSize: 512
    }
};

Net.EventType = {
    Error: 'error',
    Listening: 'listening',
    Ping: 'ping',
    PingReq: 'pingreq',
    Sync: 'sync',
    Ack: 'ack',
    Update: 'update',
    Unknown: 'unknown'
};

function formatRinfo(rinfo) {
    return rinfo.address + ':' + rinfo.port;
}

module.exports = Net;
