/*
  MIT License,
  Copyright (c) 2016-2020, Richard Rodger and other contributors.

  Vendored from sneeze 3.0.0 (https://github.com/rjrodger/sneeze,
  commit 2dc3f49db92eaafaa1175b4deebdd3dd2a704a5f, tag v3.0.0, sneeze.js).
  The MIT licence of sneeze is in sneeze.LICENSE in this directory.
  Local changes (see NOTICE at the package root): uses the vendored swim in
  ./swim instead of @voxgig/swim; the terminal monitor and its option are
  removed; Optioner/Joi is replaced by plain defaults; a node whose join
  fails leaves its swim instance before it retries or gives up, and leave()
  leaves every swim instance of the node and cancels pending join retries.
*/

'use strict'

var Events = require('events')
var Util = require('util')

var _ = require('lodash')
var Swim = require('./swim/swim')
var Nid = require('nid')

// The sneeze version this file was vendored from; it is part of the
// default member identifier.
var SNEEZE_VERSION = '3.0.0'

var DEFAULT_HOST = (module.exports.DEFAULT_HOST = '127.0.0.1')
var DEFAULT_PORT = (module.exports.DEFAULT_PORT = 39999)

var DEFAULTS = {
  isbase: false,
  host: DEFAULT_HOST,
  bases: [DEFAULT_HOST + ':' + DEFAULT_PORT],
  retry_attempts: 22,
  retry_min: 111,
  retry_max: 555,
  silent: true,
  log: null,
  tag: null,
  port: null,
  identifier: null,

  // [include,exclude]
  port_range: [40000, 50000],

  v: null,
}

// The rules of the Optioner defaults that this replaces: a key that is
// undefined takes its default, an array replaces the default array (it is
// not merged), and keys without a default (such as swim) pass through.
function resolve_options(options) {
  var out = {}
  var key

  options = null == options ? {} : options

  if ('object' !== typeof options) {
    throw new Error('sneeze: options must be an object')
  }

  for (key in DEFAULTS) {
    out[key] = Array.isArray(DEFAULTS[key])
      ? DEFAULTS[key].slice()
      : DEFAULTS[key]
  }

  for (key in options) {
    if (void 0 !== options[key]) {
      out[key] = options[key]
    }
  }

  if ('boolean' !== typeof out.silent) {
    throw new Error('sneeze: option silent must be a boolean')
  }

  if (!Array.isArray(out.bases)) {
    throw new Error('sneeze: option bases must be an array')
  }

  return out
}

module.exports = function (options) {
  return new Sneeze(options)
}

function Sneeze(options) {
  Events.EventEmitter.call(this)
  var self = this

  ;(function (options) {
    var isbase = !!options.isbase

    self.log = !!options.silent
      ? _.noop
      : _.isFunction(options.log)
      ? options.log
      : function () {
          console.log.apply(
            null,
            _.flatten(['SNEEZE', ('' + Date.now()).substring(8), arguments])
          )
        }

    self.makeport = _.isFunction(options.port)
      ? options.port
      : function () {
          var port = parseInt(options.port)
          var pr = options.port_range

          port = !isNaN(port)
            ? port
            : isbase
            ? DEFAULT_PORT
            : pr[0] + Math.floor((pr[1] - pr[0]) * Math.random())

          return port
        }

    var swim
    var members = {}

    // Every swim instance and join retry of this node, so that leave()
    // stops them all, also when join() was called more than once.
    var left = false
    var swims = []
    var retry_timers = []

    self.join = function (meta) {
      meta = meta || {}
      left = false

      var attempts = 0,
        max_attempts = options.retry_attempts,
        joined = false

      function join() {
        if (joined || left) {
          return
        }

        //var port = (_.isFunction(options.port) ? options.port() : options.port )
        var port = self.makeport()
        var host = options.host + ':' + port
        var incarnation = Date.now()

        self.id = meta.identifier$ =
          null == options.identifier
            ? host +
              '~' +
              (incarnation + '~').substring(7) +
              Nid() +
              '~' +
              SNEEZE_VERSION
            : options.identifier

        meta.tag$ = options.tag
        meta.v$ = options.v || 0

        var swim_opts = _.defaultsDeep(options.swim, {
          codec: 'msgpack',
          disseminationFactor: 22,
          interval: 333,
          joinTimeout: 999,
          pingTimeout: 444,
          pingReqTimeout: 555,
          pingReqGroupSize: 7,
          suspectTimeout: 999,
          udp: { maxDgramSize: 2048 },
        })

        swim_opts.local = {
          host: host,
          meta: meta,
          incarnation: incarnation,
        }

        var bases = _.compact(_.clone(options.bases))
        if (isbase) {
          _.remove(bases, function (r) {
            return r === host
          })
        }

        self.log(
          'joining',
          attempts,
          host,
          meta.identifier$,
          meta.tag$,
          bases,
          swim_opts
        )

        // this attempt's instance: a later join() replaces swim
        var instance = (swim = new Swim(swim_opts))
        swims.push(instance)

        instance.net.on('error', function (err) {
          if (err && !joined && attempts < max_attempts) {
            attempts++

            var wait =
              options.retry_min +
              Math.floor(
                Math.random() * (options.retry_max - options.retry_min)
              )

            instance.net.removeAllListeners('error')
            leave_failed(instance)
            _.pull(swims, instance)
            retry_timers.push(setTimeout(join, wait))
            return
          } else if (err) {
            self.emit('error', err)
            instance.net.removeAllListeners('error')
            if (!joined) {
              leave_failed(instance)
            }
            return
          }
        })

        instance.bootstrap(bases, function onBootstrap(err) {
          if (left) {
            return
          }

          if (!isbase && err && !joined && attempts < max_attempts) {
            attempts++

            var wait =
              options.retry_min +
              Math.floor(
                Math.random() * (options.retry_max - options.retry_min)
              )

            instance.net.removeAllListeners('error')
            leave_failed(instance)
            _.pull(swims, instance)
            retry_timers.push(setTimeout(join, wait))
            return
          } else if (err) {
            // first base node will see a JoinFailedError as there is
            // nobody else out there
            if (!isbase || 'JoinFailedError' !== err.name) {
              self.emit('error', err)
              instance.net.removeAllListeners('error')
              leave_failed(instance)
              return
            }
          }

          joined = true

          self.info = swim_opts

          _.each(instance.members(), updateinfo)

          instance.on(Swim.EventType.Update, function onUpdate(info) {
            updateinfo(info)
          })

          instance.on(Swim.EventType.Change, function onChange(info) {
            updateinfo(info)
          })

          self.emit('ready')
        })

        function updateinfo(m) {
          //console.log(m)

          if (!m.meta) {
            return
          }

          if (null != meta.tag$ && m.meta.tag$ !== meta.tag$) {
            return
          }

          if (m.meta.identifier$ === meta.identifier$) {
            return
          }

          if (0 === m.state) {
            add_node(m)
          }

          // Note: trigger happy
          else if (2 === m.state) {
            remove_node(m)
          }
        }
      }

      join()
      return self
    }

    self.members = function () {
      return _.clone(members)
    }

    self.leave = function () {
      left = true
      retry_timers.forEach(clearTimeout)
      retry_timers = []
      swims.forEach(leave_failed)
      swims = []
      members = {}
      return self
    }

    function add_node(member) {
      var meta = member.meta
      var host = member.host

      var prev = members[meta.identifier$]
      if (
        prev &&
        prev.incarnation === member.incarnation &&
        prev.host === member.host &&
        prev.meta.v$ === meta.v$
      ) {
        return
      }

      self.log('add', host, meta.identifier$, meta.tag$, meta)
      members[meta.identifier$] = member
      self.emit('add', meta, member)
    }

    function remove_node(member) {
      var meta = member.meta
      var host = member.host

      var prev = members[meta.identifier$]
      if (!prev) {
        return
      }

      self.log('remove', host, meta.identifier$, meta.tag$, meta)
      delete members[meta.identifier$]
      self.emit('remove', meta, member)
    }

    self.on('error', function (err) {
      self.log('ERROR', err)
    })
  })(resolve_options(options))
}
Util.inherits(Sneeze, Events.EventEmitter)

// A swim instance whose join failed is not used again: stop its timers
// and close its socket, so that nothing of it stays open.
function leave_failed(swim) {
  try {
    swim.leave()
  } catch (e) {
    // the instance did not start
  }
}
