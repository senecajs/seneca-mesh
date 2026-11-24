/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, lib/swim.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See LICENSE in this directory.
  Local changes (see NOTICE at the package root): leave() also stops a join
  that is still waiting for an answer, and debug is replaced by
  util.debuglog (NODE_DEBUG=swim).
*/
'use strict';
var events = require('events');
var util = require('util');

var debuglog = util.debuglog('swim');

var Codec = require('./codec');
var Disseminator = require('./disseminator');
var FailureDetector = require('./failure-detector');
var Membership = require('./membership');
var Net = require('./net');

var JoinFailedError = require('./error').JoinFailedError;
var InvalidStateError = require('./error').InvalidStateError;
var ListenFailedError = require('./error').ListenFailedError;

function Swim(opts) {
    this.opts = opts;

    this.codec = new Codec({
        codec: opts.codec,
        swim: this,
        debugIdentifier: opts.local.host
    });
    this.disseminator = new Disseminator({
        disseminationFactor: opts.disseminationFactor,
        swim: this,
        debugIdentifier: opts.local.host
    });
    this.failureDetector = new FailureDetector({
        interval: opts.interval,
        pingTimeout: opts.pingTimeout,
        pingReqTimeout: opts.pingReqTimeout,
        pingReqGroupSize: opts.pingReqGroupSize,
        swim: this,
        debugIdentifier: opts.local.host
    });
    this.membership = new Membership({
        local: opts.local,
        suspectTimeout: opts.suspectTimeout,
        preferCurrentMeta: opts.preferCurrentMeta,
        swim: this,
        debugIdentifier: opts.local.host
    });
    this.net = new Net({
        udp: {
            port: parseInt(opts.local.host.split(':')[1]),
            type: opts.udp && opts.udp.type,
            maxDgramSize: opts.udp && opts.udp.maxDgramSize
        },
        swim: this,
        debugIdentifier: opts.local.host
    });
    this.state = Swim.State.Stopped;
    this.joinTimers = null;

    this.joinTimeout = opts.joinTimeout || Swim.Default.joinTimeout;
    this.joinCheckInterval = opts.joinCheckInterval || Swim.Default.joinCheckInterval;

    this.changeListener = this.emit.bind(this, Swim.EventType.Change);
    this.updateListener = this.emit.bind(this, Swim.EventType.Update);
    this.debug = debuglog.bind(undefined, 'swim', opts.local.host);
}

util.inherits(Swim, events.EventEmitter);

Swim.prototype.bootstrap = function bootstrap(hosts, callback) {
    var self = this;
    var err;

    if (self.state !== Swim.State.Stopped) {
        err = new InvalidStateError({
            current: self.state,
            expected: Swim.State.Stopped
        });

        if (typeof callback === 'function') {
            callback(err);
        } else {
            self.emit(Swim.EventType.Error, err);
        }

        return;
    }

    self.net.listen(function onListen(err) {
        if (err) {
            err = new ListenFailedError({
                host: self.opts.local.host,
                type: self.opts.udp.type
            });

            if (typeof callback === 'function') {
                callback(err);
            } else {
                self.emit(Swim.EventType.Error, err);
            }

            return;
        }

        self.failureDetector.start();
        self.membership.start();
        self.disseminator.start();
        self.membership.on(Membership.EventType.Change, self.changeListener);
        self.membership.on(Membership.EventType.Update, self.updateListener);

        self.state = Swim.State.Started;
        self.join(hosts, callback);
    });
};

Swim.prototype.join = function join(hosts, callback) {
    var self = this;
    var err;

    if (self.state !== Swim.State.Started) {
        err = new InvalidStateError({
            currect: self.state,
            expected: Swim.State.Started
        });

        if (typeof callback === 'function') {
            callback(err);
        } else {
            self.emit(Swim.EventType.Error, err);
        }
    }

    if (!hosts || hosts.length === 0) {
        if (typeof callback === 'function') {
            callback();
        } else {
            self.emit(Swim.EventType.Ready);
        }

        return;
    }

    hosts = hosts.filter(function notLocal(host) {
        return host !== self.opts.local.host;
    });

    self.membership.sync(hosts);

    var checker = null;

    var timeout = setTimeout(function joinTimeout() {
        self.joinTimers = null;
        clearInterval(checker);
        var numberOfHostsResponded = checkJoin();
        if (numberOfHostsResponded === 0) {
            var err = new JoinFailedError({
                local: self.localhost(),
                hosts: hosts,
                numberOfHostsResponded: numberOfHostsResponded,
                timeout: self.joinTimeout
            });
            if (typeof callback === 'function') {
                callback(err);
            } else {
                self.emit(Swim.EventType.Error, err);
            }
        }
    }, self.joinTimeout);

    if (self.joinCheckInterval < self.joinTimeout) {
        checker = setInterval(checkJoin, self.joinCheckInterval);
    }

    self.joinTimers = {
        timeout: timeout,
        checker: checker
    };

    function checkJoin() {
        var numberOfHostsResponded = hosts.reduce(function countRespondedHosts(num, host) {
            num += self.membership.get(host) ? 1 : 0;
            return num;
        }, 0);
        if (numberOfHostsResponded >= 1) {
            self.joinTimers = null;
            clearInterval(checker);
            clearTimeout(timeout);
            if (typeof callback === 'function') {
                callback();
            } else {
                self.emit(Swim.EventType.Ready);
            }
        }
        return numberOfHostsResponded;
    }
};

Swim.prototype.leave = function leave() {
    // a join that is still waiting for an answer ends here, without callback
    if (this.joinTimers) {
        clearTimeout(this.joinTimers.timeout);
        clearInterval(this.joinTimers.checker);
        this.joinTimers = null;
    }

    this.membership.removeListener(Membership.EventType.Update, this.updateListener);
    this.membership.removeListener(Membership.EventType.Change, this.changeListener);
    this.disseminator.stop();
    this.membership.stop();
    this.failureDetector.stop();
    this.net.close();
    this.state = Swim.State.Stopped;
};

Swim.prototype.members = function members(hasLocal, hasFaulty) {
    return this.membership.all(hasLocal, hasFaulty);
};

Swim.prototype.checksum = function checksum() {
    return this.membership.checksum();
};

Swim.prototype.localhost = function localhost() {
    return this.membership && this.membership.localhost() || this.opts.local.host;
};

Swim.prototype.whoami = function whoami() {
    return this.localhost();
};

Swim.prototype.updateMeta = function updateMeta(meta) {
    return this.membership.updateMeta(meta);
};

Swim.Default = {
    joinTimeout: 300,
    joinCheckInterval: 50
};

Swim.EventType = {
    Change: 'change',
    Update: 'update',
    Error: 'error',
    Ready: 'ready'
};

Swim.State = {
    Started: 'started',
    Stopped: 'stopped'
};

module.exports = Swim;
module.exports.Error = require('./error');
