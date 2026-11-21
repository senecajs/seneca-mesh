/*
  MIT License,
  Copyright (c) 2016-2020, Richard Rodger and other contributors.
*/

'use strict'

var Events = require('events')
var Util = require('util')

var _ = require('lodash')
var Swim = require('@voxgig/swim')
var Optioner = require('optioner')
var Keypress = require('keypress')
var AE = require('ansi-escapes')
var Pad = require('pad')
var JP = require('jsonpath')
var Chalk = require('chalk')
var Nid = require('nid')

var Joi = Optioner.Joi

var Package = require('./package.json')

var DEFAULT_HOST = (module.exports.DEFAULT_HOST = '127.0.0.1')
var DEFAULT_PORT = (module.exports.DEFAULT_PORT = 39999)

var optioner = Optioner({
  isbase: false,
  host: DEFAULT_HOST,
  bases: Joi.array().default([DEFAULT_HOST + ':' + DEFAULT_PORT]),
  retry_attempts: 22,
  retry_min: 111,
  retry_max: 555,
  silent: Joi.boolean().default(true),
  log: null,
  tag: null,
  port: null,
  identifier: null,

  // [include,exclude]
  port_range: [40000, 50000],

  monitor: {
    active: false,
    meta: ['route', 'config.pin'],
  },

  v: null,
})

module.exports = function (options) {
  return new Sneeze(options)
}

function Sneeze(options) {
  Events.EventEmitter.call(this)
  var self = this

  optioner(options, function (err, options) {
    if (err) throw err

    var isbase = !!options.isbase

    self.monitor = !!options.monitor.active
      ? make_monitor(self, options)
      : _.noop

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

    self.join = function (meta) {
      meta = meta || {}

      var attempts = 0,
        max_attempts = options.retry_attempts,
        joined = false

      function join() {
        if (joined) {
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
              Package.version
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

        swim = new Swim(swim_opts)

        swim.net.on('error', function (err) {
          if (err && !joined && attempts < max_attempts) {
            attempts++

            var wait =
              options.retry_min +
              Math.floor(
                Math.random() * (options.retry_max - options.retry_min)
              )

            swim.net.removeAllListeners('error')
            setTimeout(join, wait)
            return
          } else if (err) {
            self.emit('error', err)
            swim.net.removeAllListeners('error')
            return
          }
        })

        swim.bootstrap(bases, function onBootstrap(err) {
          if (!isbase && err && !joined && attempts < max_attempts) {
            attempts++

            var wait =
              options.retry_min +
              Math.floor(
                Math.random() * (options.retry_max - options.retry_min)
              )

            swim.net.removeAllListeners('error')
            setTimeout(join, wait)
            return
          } else if (err) {
            // first base node will see a JoinFailedError as there is
            // nobody else out there
            if (!isbase || 'JoinFailedError' !== err.name) {
              self.emit('error', err)
              swim.net.removeAllListeners('error')
              return
            }
          }

          joined = true

          self.info = swim_opts

          _.each(swim.members(), updateinfo)

          swim.on(Swim.EventType.Update, function onUpdate(info) {
            updateinfo(info)
          })

          swim.on(Swim.EventType.Change, function onChange(info) {
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
      swim && swim.leave()
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
  })
}
Util.inherits(Sneeze, Events.EventEmitter)

function make_monitor(sneeze, options) {
  var start = Date.now()
  var allmembers = {}
  var sortedmembers = []

  function update(kind, member) {
    var meta = member.meta
    var host = member.host

    var m = allmembers[meta.identifier$]

    if (m) {
      m[kind] += 1
      m.host = host
      m.meta = meta
      m.state = member.state
      m.meta = parse_meta(meta, options)
      m.tag = meta.tag$ || ''
    } else {
      m = {
        id: meta.identifier$,
        tag: meta.tag$ || '',
        host: host,
        meta: meta,
        state: member.state,
        add: 0,
        rem: 0,
        meta: parse_meta(meta, options),
      }
      m[kind] += 1
    }

    m.when = Date.now()

    allmembers[meta.identifier$] = m

    sortedmembers = sortedmembers.filter(function (m) {
      return m.id != meta.identifier$
    })

    sortedmembers.unshift(m)

    //console.log(allmembers)
  }

  sneeze.on('add', function (meta, member) {
    update('add', member)
    //console.log('add',member)
    render()
  })

  sneeze.on('remove', function (meta, member) {
    update('rem', member)
    //console.log('rem',member.meta)
    render()
  })

  var w = process.stdout.write.bind(process.stdout)
  var states = {
    0: 'A',
    1: 'S',
    2: 'F',
  }
  var head = Chalk.bold

  function render() {
    var size_host = 4
    var size_meta = 4
    var size_tag = 3

    sortedmembers.forEach(function (m) {
      size_host = Math.max(size_host, m.host.length)
      size_meta = Math.max(size_meta, m.meta.length)
      size_tag = Math.max(size_tag, m.tag.length)
    })

    var nm = sortedmembers.length

    w(AE.clearScreen)
    w(AE.cursorHide)
    w(AE.cursorUp(nm + 2))
    w(AE.eraseDown)

    console.log(
      head(
        [
          Pad('host', size_host),
          Pad(2, 'a'),
          Pad(2, 'r'),
          Pad(2, 's'),
          Pad(8, 'time'),
          Pad('tag', size_tag),
          Pad('meta', size_meta),
          'id',
        ].join(' ')
      )
    )

    sortedmembers.forEach(function (m, i) {
      var memline = [
        Pad(m.host || '', size_host),
        Pad(2, '' + (m.add || 0)),
        Pad(2, '' + (m.rem || 0)),
        Pad(2, '' + (states[m.state] || 'U')),
        Pad(8, '' + (m.when - start)),
        Pad(m.tag || '', size_tag),
        Pad(m.meta || '', size_meta),
        m.id,
      ]

      var lt = memline.join(' ')

      lt = 2 === m.state ? Chalk.red(lt) : lt

      console.log(lt)
    })
  }

  Keypress(process.stdin)

  process.stdin.on('keypress', function (ch, key) {
    if (key && key.ctrl && key.name == 'c') {
      process.exit()
    }

    // prune failed members
    if ('p' === ch) {
      sortedmembers = sortedmembers.filter(function (m) {
        if (2 === m.state) {
          delete allmembers[m.id]
          return false
        }
        return true
      })
      render()
    }
  })

  if (process.stdin.setRawMode) {
    process.stdin.setRawMode(true)
  }
  process.stdin.resume()
}

function parse_meta(meta, options) {
  var out = []
  options.monitor.meta.forEach(function (mf) {
    var v = JP.value(meta, mf)
    if (null != v) {
      out.push(Util.inspect(v).replace(/\s+/g, ''))
    }
  })
  return out.join('; ')
}
