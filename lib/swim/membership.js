'use strict';
var debug = require('debug');
var events = require('events');
var farmhash = require('farmhash');
var util = require('util');

var FailureDetector = require('./failure-detector');
var Member = require('./member');
var MessageType = require('./message-type');
var Net = require('./net');

function Membership(opts) {
    this.swim = opts.swim;
    this.local = new Member(opts.local);
    this.suspectTimeout = opts.suspectTimeout || Membership.Default.suspectTimeout;
    this.preferCurrentMeta = opts.preferCurrentMeta || Membership.Default.preferCurrentMeta;

    this.ackListener = this.onAck.bind(this);
    this.updateListener = this.onUpdate.bind(this);
    this.suspectListener = this.onSuspect.bind(this);
    this.syncListener = this.onSync.bind(this);

    this.hostToMember = Object.create(null);
    this.hostToIterable = Object.create(null);
    this.hostToFaulty = Object.create(null);
    this.hostToSuspectTimeout = Object.create(null);
    this.debug = debug('swim:membership').bind(undefined, opts.debugIdentifier);
}

util.inherits(Membership, events.EventEmitter);

Membership.prototype.start = function start() {
    var self = this;

    self.swim.failureDetector.on(FailureDetector.EventType.Suspect, self.suspectListener);
    self.swim.net.on(Net.EventType.Ack, self.ackListener);
    self.swim.net.on(Net.EventType.Sync, self.syncListener);
    self.swim.net.on(Net.EventType.Update, self.updateListener);

    Object.keys(self.hostToSuspectTimeout).forEach(function resumeSuspect(host) {
        self.onSuspect(self.get(host));
    });
};

Membership.prototype.stop = function stop() {
    var self = this;

    self.swim.failureDetector.removeListener(FailureDetector.EventType.Suspect, self.suspectListener);
    self.swim.net.removeListener(Net.EventType.Ack, self.ackListener);
    self.swim.net.removeListener(Net.EventType.Sync, self.syncListener);
    self.swim.net.removeListener(Net.EventType.Update, self.updateListener);

    Object.keys(self.hostToSuspectTimeout).forEach(function clearTimeoutWithoutDeletion(host) {
        clearTimeout(self.hostToSuspectTimeout[host]);
    });
};

Membership.prototype.onAck = function onAck(data, host) {
    if (this.hostToMember[host] && this.hostToMember[host].state === Member.State.Suspect) {
        this.swim.net.sendMessage({
            type: MessageType.Update,
            data: this.hostToMember[host].data()
        }, host);
    }
};

Membership.prototype.onSuspect = function onSuspect(member) {
    var self = this;
    var data;

    member = new Member(member.data());
    member.state = Member.State.Suspect;
    data = member.data();

    clearTimeout(self.hostToSuspectTimeout[data.host]);
    delete self.hostToSuspectTimeout[data.host];

    self.hostToSuspectTimeout[data.host] = setTimeout(function setFaulty() {
        delete self.hostToSuspectTimeout[data.host];

        data.state = Member.State.Faulty;

        self.onUpdate(data);
    }, self.suspectTimeout);

    self.onUpdate(member.data());
};

Membership.prototype.onSync = function onSync(data) {
    var host = data.host;

    this.updateAlive(data);

    this.swim.net.sendMessages(this.all(true, true).map(function toMessage(data) {
        return {
            type: MessageType.Update,
            data: data
        };
    }), host);
};

Membership.prototype.sync = function sync(hosts) {
    var self = this;
    var messages = [{
        type: MessageType.Sync,
        data: self.local.data()
    }];

    this.all(false, true).forEach(function addMessage(data) {
        messages.push({
            type: MessageType.Update,
            data: data
        });
    });

    hosts.forEach(function sendToHost(host) {
        self.swim.net.sendMessages(messages, host);
    });
};

Membership.prototype.onUpdate = function onUpdate(data) {
    this.debug('received update', data);

    switch (data.state) {
        case Member.State.Alive:
            this.updateAlive(data);
            break;
        case Member.State.Suspect:
            this.updateSuspect(data);
            break;
        case Member.State.Faulty:
            this.updateFaulty(data);
            break;
    }
};

Membership.prototype.updateAlive = function updateAlive(data) {
    if (this.isLocal(data.host)) {
        if (this.local.incarnate(data, false, this.preferCurrentMeta)) {
            this.emit(Membership.EventType.Update, this.local.data());
        } else {
            this.emit(Membership.EventType.Drop, data);
        }
        return;
    }

    if (this.hostToFaulty[data.host] && this.hostToFaulty[data.host].incarnation >= data.incarnation) {
        this.emit(Membership.EventType.Drop, data);
        return;
    }

    if (!this.hostToMember[data.host] ||
        data.incarnation > this.hostToMember[data.host].incarnation) {

        clearTimeout(this.hostToSuspectTimeout[data.host]);
        delete this.hostToSuspectTimeout[data.host];
        delete this.hostToFaulty[data.host];

        if (!this.hostToMember[data.host]) {
            this.hostToMember[data.host] = new Member(data);
            this.hostToIterable[data.host] = this.hostToMember[data.host];
            this.emit(Membership.EventType.Change, this.hostToMember[data.host].data());
        } else {
            this.hostToMember[data.host] = new Member(data);
        }

        this.emit(Membership.EventType.Update, this.hostToMember[data.host].data());
    } else {
        this.emit(Membership.EventType.Drop, data);
    }
};

Membership.prototype.updateSuspect = function updateSuspect(data) {
    if (this.isLocal(data.host)) {
        this.emit(Membership.EventType.Drop, data);
        this.local.incarnate(data, true, this.preferCurrentMeta);
        this.emit(Membership.EventType.Update, this.local.data());
        return;
    }

    if (this.hostToFaulty[data.host] && this.hostToFaulty[data.host].incarnation >= data.incarnation) {
        this.emit(Membership.EventType.Drop, data);
        return;
    }

    if (!this.hostToMember[data.host] ||
        data.incarnation > this.hostToMember[data.host].incarnation ||
        data.incarnation === this.hostToMember[data.host].incarnation &&
        this.hostToMember[data.host].state === Member.State.Alive) {

        delete this.hostToFaulty[data.host];

        if (!this.hostToMember[data.host]) {
            this.hostToMember[data.host] = new Member(data);
            this.hostToIterable[data.host] = this.hostToMember[data.host];
            this.emit(Membership.EventType.Change, this.hostToMember[data.host].data());
        } else {
            this.hostToMember[data.host] = new Member(data);
        }

        this.emit(Membership.EventType.Update, this.hostToMember[data.host].data());
    } else {
        this.emit(Membership.EventType.Drop, data);
    }
};

Membership.prototype.updateFaulty = function updateFaulty(data) {
    if (this.isLocal(data.host)) {
        this.emit(Membership.EventType.Drop, data);
        this.local.incarnate(data, true, this.preferCurrentMeta);
        this.emit(Membership.EventType.Update, this.local.data());
        return;
    }

    if (this.hostToMember[data.host] &&
        data.incarnation >= this.hostToMember[data.host].incarnation) {

        this.hostToFaulty[data.host] = new Member(data);
        delete this.hostToMember[data.host];
        delete this.hostToIterable[data.host];
        this.emit(Membership.EventType.Change, data);

        this.emit(Membership.EventType.Update, data);
    } else {
        this.emit(Membership.EventType.Drop, data);
    }
};

Membership.prototype.next = function next() {
    var hosts = Object.keys(this.hostToIterable);
    var host;
    var member;

    if (hosts.length === 0) {
        this.shuffle();
        hosts = Object.keys(this.hostToIterable);
    }

    host = hosts[Math.floor(Math.random() * hosts.length)];
    member = this.hostToIterable[host];
    delete this.hostToIterable[host];

    return member;
};

Membership.prototype.random = function random(n) {
    var hosts = Object.keys(this.hostToMember);
    var selected = [];
    var index;
    var i;

    for (i = 0; i < n && i < hosts.length; i++) {
        index = i + Math.floor(Math.random() * (hosts.length - i));
        selected.push(this.hostToMember[hosts[index]]);
        hosts[index] = hosts[i];
    }

    return selected;
};

Membership.prototype.shuffle = function shuffle() {
    var self = this;

    self.hostToIterable = Object.create(null);

    Object.keys(self.hostToMember).forEach(function addToIterable(host) {
        self.hostToIterable[host] = self.hostToMember[host];
    });
};

Membership.prototype.get = function get(host) {
    return this.hostToMember[host];
};

Membership.prototype.size = function size(hasLocal) {
    return Object.keys(this.hostToMember).length + (hasLocal ? 1 : 0);
};

Membership.prototype.all = function all(hasLocal, hasFaulty) {
    var self = this;
    var results = Object.keys(self.hostToMember).map(function toData(host) {
        return self.hostToMember[host].data();
    });

    if (hasLocal) {
        results.push(self.local.data());
    }

    if (hasFaulty) {
        Object.keys(self.hostToFaulty).forEach(function toData(host) {
            results.push(self.hostToFaulty[host].data());
        });
    }

    return results;
};

Membership.prototype.checksum = function checksum() {
    var self = this;
    var strs = self.all(true).sort(function compare(a, b) {
        return parseInt(a.host.split(':')[1]) - parseInt(b.host.split(':')[1]);
    }).map(function toString(member) {
        return member.host + member.state + member.incarnation;
    });

    return farmhash.hash64(strs.join('-'));
};

Membership.prototype.isLocal = function isLocal(host) {
    return host === this.local.host;
};

Membership.prototype.localhost = function localhost() {
    return this.local.host;
};

Membership.prototype.updateMeta = function updateMeta(meta) {
    this.local.meta = meta;
    this.local.incarnate();
    this.emit(Membership.EventType.Update, this.local.data());
};

Membership.Default = {
    suspectTimeout: 10,
    preferCurrentMeta: false
};

Membership.EventType = {
    Change: 'change',
    Drop: 'drop',
    Update: 'update'
};

module.exports = Membership;
