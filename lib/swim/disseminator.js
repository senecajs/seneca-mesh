'use strict';
var debug = require('debug');
var clone = require('clone');
var events = require('events');
var util = require('util');

var Membership = require('./membership');
var MessageType = require('./message-type');
var Net = require('./net');

function Disseminator(opts) {
    this.swim = opts.swim;

    this.disseminationFactor = opts.disseminationFactor || Disseminator.Default.disseminationFactor;
    this.disseminationFormula =  opts.disseminationFormula || Disseminator.Default.disseminationFormula;
    this.disseminationLimit = Disseminator.Default.disseminationLimit;

    this.updateListener = this.onUpdate.bind(this);
    this.changeListener = this.onChange.bind(this);

    this.attemptsToUpdates = Object.create(null);
    this.hostToAttempts = Object.create(null);
    this.debug = debug('swim:disseminator').bind(undefined, opts.debugIdentifier);
}

util.inherits(Disseminator, events.EventEmitter);

Disseminator.prototype.start = function start() {
    this.swim.membership.on(Membership.EventType.Change, this.changeListener);
    this.swim.membership.on(Membership.EventType.Update, this.updateListener);
    this.updateDisseminationLimit();
};

Disseminator.prototype.stop = function stop() {
    this.swim.membership.removeListener(Membership.EventType.Change, this.changeListener);
    this.swim.membership.removeListener(Membership.EventType.Update, this.updateListener);
};

Disseminator.prototype.onChange = function onChange() {
    this.updateDisseminationLimit();
};

Disseminator.prototype.updateDisseminationLimit = function updateDisseminationLimit() {
    var self = this;

    self.disseminationLimit = self.disseminationFormula(self.disseminationFactor, self.swim.membership.size(true));

    Object.keys(self.attemptsToUpdates).forEach(function removeAttempts(attempts) {
        if (attempts >= self.disseminationLimit) {
            Object.keys(self.attemptsToUpdates[attempts]).forEach(function removeUpdate(host) {
                delete self.hostToAttempts[host];
            });

            delete self.attemptsToUpdates[attempts];
        }
    });
};

Disseminator.prototype.onUpdate = function onUpdate(data) {
    var update = clone(data);

    update.attempts = 0;

    this.removeUpdate(update);
    this.addUpdate(update);
};

Disseminator.prototype.addUpdate = function addUpdate(update) {
    if (update.attempts >= this.disseminationLimit) {
        return;
    }

    if (!this.attemptsToUpdates[update.attempts]) {
        this.attemptsToUpdates[update.attempts] = Object.create(null);
    }

    this.attemptsToUpdates[update.attempts][update.host] = update;
    this.hostToAttempts[update.host] = update.attempts;
};

Disseminator.prototype.removeUpdate = function removeUpdate(update) {
    if (this.hostToAttempts[update.host] >= 0) {
        delete this.attemptsToUpdates[this.hostToAttempts[update.host]][update.host];
    }

    delete this.hostToAttempts[update.host];
};

Disseminator.prototype.getUpdatesUpTo = function getUpdatesUpTo(bytesAvailable) {
    var self = this;
    var buffers = [];
    var updates = [];
    var hostToUpdates;
    var attempts;
    var buffer;
    var update;

    for (attempts = 0; attempts < self.disseminationLimit; attempts++) {
        if (bytesAvailable <= Net.MessageTypeSize) {
            break;
        }

        hostToUpdates = self.attemptsToUpdates[attempts];

        if (hostToUpdates) {
            /* jshint loopfunc: true */
            Object.keys(hostToUpdates).forEach(function disseminateUpdateOf(host) {
                if (bytesAvailable <= Net.MessageTypeSize) {
                    return;
                }

                update = hostToUpdates[host];
                buffer = self.serializeUpdate(update);

                if (buffer.length + Net.LengthSize <= bytesAvailable) {
                    buffers.push(buffer);
                    updates.push(update);
                    self.removeUpdate(update);
                    bytesAvailable -= buffer.length + Net.LengthSize;
                }
            });
            /* jshint loopfunc: false */
        }
    }

    updates.forEach(function addBack(update) {
        update.attempts += 1;
        self.addUpdate(update);
    });

    return buffers;
};

Disseminator.prototype.serializeUpdate = function serializeUpdate(update) {
    var header = new Buffer(Net.MessageTypeSize);

    Net.WriteMessageType.call(header, MessageType.Update, 0);

    return Buffer.concat([header, this.swim.codec.encode({
        meta: update.meta,
        host: update.host,
        state: update.state,
        incarnation: update.incarnation
    })]);
};

Disseminator.Default = {
    disseminationFactor: 15,
    disseminationLimit: 3,
    disseminationFormula: function disseminationFormula(factor, size) {
        return Math.ceil(factor * Math.log(size + 1) / Math.log(10));
    }
};

module.exports = Disseminator;
