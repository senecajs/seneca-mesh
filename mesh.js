/* MIT License. Copyright © 2015-2026, Richard Rodger and other contributors. */

'use strict'

var _ = require('lodash')
var Nid = require('nid')
var Rif = require('rif')
var Discover = require('node-discover')
var BalanceClient = require('@seneca/balance-client')

// Vendored from sneeze 3.0.0 and @voxgig/swim 0.7.0, see NOTICE.
var Sneeze = require('./lib/sneeze')

module.exports = mesh

var DEFAULT_HOST = (module.exports.DEFAULT_HOST = '127.0.0.1')
var DEFAULT_PORT = (module.exports.DEFAULT_PORT = 39999)

var intern = (module.exports.intern = make_intern())

// Seneca 4 validates these options, and rejects keys that are not declared.
mesh.defaults = function defaults({ valid }) {
  return {
    // Action pattern(s) that this node serves: 'a:1', 'a:1;b:2' or { a: 1 }.
    pin: valid.Skip(valid.One(String, Object)),
    pins: valid.Skip(Array),

    // Host and port of the membership (SWIM) network node.
    host: valid.Skip(String),
    port: valid.Skip(valid.Min(0, valid.Max(65535, valid.Integer()))),

    isbase: false,

    // Deprecated alias of isbase.
    base: valid.Skip(Boolean),

    // Base nodes, as 'host:port' strings (discover.defined).
    bases: valid.Skip([String]),
    remotes: valid.Skip([String]),

    // Fixed network interfaces, in the format of os.networkInterfaces().
    netif: valid.Skip(valid.Open({})),

    // Membership tag; null disables tagging. Default: 'mesh'.
    tag: valid.Skip(valid.Nullable(String)),

    model: 'consume',

    // Listen configurations, one seneca.listen per entry.
    listen: valid.Skip([valid.Open({})]),

    auto: true,
    make_entry: function make_entry(member) {
      return intern.default_make_entry(member)
    },

    jointime: 111, // join and wait for network details

    // Explicitly allow overrides of specific local patterns (true, or a list
    // of pins). This is not supported by default to prevent infinite loops
    // between subling services with same pins.
    override: valid.One(false, [String]),

    discover: {
      defined: {
        active: true,
      },

      guess: {
        active: true,
      },

      multicast: {
        active: true,

        // Broadcast address, or '/<prefix length>' to derive it from host.
        address: valid.Skip(valid.Nullable(String)),

        // max_search: 22,
        max_search: 2,
        search_interval: 111,
      },

      registry: {
        // Not active by default, need to explicitly turn it on.
        active: false,

        // check registry periodically
        refresh_interval: 1111,

        // remove first entry with this probability
        // live base nodes will add themselves back in
        prune_first_probability: 0.01,

        // leave at least this many base entries
        prune_bound: 11,
      },

      custom: {
        active: true,
        find: function find(seneca, options, bases, next) {
          next([], false)
        },
      },

      // stop discovery if defined bases are provided
      stop: true,
    },

    // Options of the balance client that mesh loads (@seneca/balance-client).
    balance_client: valid.Open({}),

    // Options passed through to the membership network (sneeze).
    sneeze: valid.Skip(valid.Nullable(valid.Open({}))),
  }
}

function mesh(options) {
  var seneca = this

  var opts = options

  var closed = false

  var bases = []
  var sneeze

  // Membership nodes, discovery broadcasters and timers of this instance,
  // released when the instance closes.
  var sneezes = []
  var resources = { discovers: [], intervals: [] }

  seneca.destroy(function mesh_close() {
    closed = true

    sneezes.forEach(function (sneeze) {
      sneeze.leave()
    })
    sneezes = []

    resources.discovers.forEach(function (d) {
      d.stop()
    })
    resources.discovers = []

    resources.intervals.forEach(function (i) {
      clearInterval(i)
    })
    resources.intervals = []
  })

  seneca.add('role:mesh,get:bases', function get_bases(msg, done) {
    done(null, { bases: [].concat(bases) })
  })

  var balance_map = {}
  var mid = Nid()

  // fixed network interface specification, as per format of
  // require('os').networkInterfaces. Merged with and overrides same.
  var rif = Rif(opts.netif)

  // opts.base is deprecated
  var isbase = !!(opts.isbase || opts.base)
  opts.isbase = isbase

  var pin = opts.pin || opts.pins

  if (isbase) {
    pin = Array.isArray(pin) ? pin : [].concat('role:mesh,base:' + seneca.id)
    //pin = ['']
  }

  opts.host = intern.resolve_interface(opts.host, rif)
  var tag = opts.tag

  // Copies, as the listen configurations are completed below.
  var listen = opts.listen
    ? opts.listen.map(function (listen_opts) {
        return Object.assign({}, listen_opts)
      })
    : [{ pin: pin, model: opts.model || 'consume' }]

  // Seneca 4 has no built-in network transport: mesh listens and the
  // balance clients send with @seneca/transport (a peer dependency).
  if (!seneca.has_plugin('transport')) {
    seneca.use('@seneca/transport')
  }

  // Load the balancer that this package depends on, not whichever
  // balance-client a short name would find first.
  var balance_client_opts = opts.balance_client || {}
  seneca.use({ define: BalanceClient, tag: 'mesh~' + mid }, balance_client_opts)

  seneca.add('init:mesh', init)

  function init(msg, init_done) {
    var seneca = this

    intern.find_bases(seneca, opts, rif, resources, function (found_bases) {
      bases = found_bases

      seneca.log.debug({
        kind: 'mesh',
        host: opts.host,
        port: opts.port,
        bases: bases,
        opts: opts,
      })

      var sneeze_opts = Object.assign({}, opts.sneeze)

      sneeze_opts.bases = bases
      sneeze_opts.isbase = isbase
      sneeze_opts.port = opts.port || void 0
      sneeze_opts.host = opts.host || void 0
      sneeze_opts.identifier = seneca.id

      sneeze_opts.tag =
        void 0 !== sneeze_opts.tag
          ? sneeze_opts.tag
          : void 0 !== tag
          ? null === tag
            ? null
            : 'seneca~' + tag
          : 'seneca~mesh'

      seneca.add(
        'role:transport,cmd:listen',
        intern.make_transport_listen(opts, join, listen, init_done)
      )

      // call seneca.listen as a convenience
      // subsequent seneca.listen calls will still publish to network
      if (opts.auto) {
        _.each(listen, function (listen_opts) {
          if (opts.host && null == listen_opts.host) {
            listen_opts.host = opts.host
          }

          if ('@' === (listen_opts.host && listen_opts.host[0])) {
            listen_opts.host = rif(listen_opts.host.substring(1))
          }

          listen_opts.port =
            null != listen_opts.port
              ? listen_opts.port
              : function () {
                  return 50000 + Math.floor(10000 * Math.random())
                }

          listen_opts.model = listen_opts.model || 'consume'

          listen_opts.ismesh = true

          seneca.listen(listen_opts)
        })
      }

      function join(instance, raw_config, done) {
        var client_instance = instance.root.delegate()
        var config = seneca.util.clean(raw_config || {}, { proto: false })

        if (!config.pin && !config.pins) {
          config.pin = 'null:true'
        }

        config.pin = intern.resolve_pins(instance, config)
        delete config.pins

        var instance_sneeze_opts = _.clone(sneeze_opts)
        instance_sneeze_opts.identifier =
          sneeze_opts.identifier + '~' + config.pin + '~' + Date.now()

        sneeze = Sneeze(instance_sneeze_opts)
        sneezes.push(sneeze)

        var meta = {
          config: seneca.util.clean(config),
          instance: instance.id,
        }

        sneeze.on('error', function (err) {
          seneca.log.warn(err)
        })
        sneeze.on('add', add_client)
        sneeze.on('remove', remove_client)
        sneeze.on('ready', done)

        seneca.add('role:mesh,get:members', function get_members(msg, done) {
          var members = []

          _.each(sneeze.members(), function (member) {
            var m = opts.make_entry(member)
            members.push(void 0 === m ? intern.default_make_entry(member) : m)
          })

          this.prior(msg, function (err, out) {
            if (err) {
              done(err)
            }
            var list = (out && out.list) || []
            var outlist = list.concat(members)

            done(null, { list: outlist })
          })
        })

        // The membership codec (MessagePack) cannot encode functions, so
        // only JSON data goes into the member record.
        sneeze.join(intern.json_safe(meta))

        function add_client(meta) {
          if (closed) return

          // ignore myself
          if (client_instance.id === meta.instance) {
            return
          }

          var config = meta.config || {}
          var pins = intern.resolve_pins(client_instance, config)

          _.each(pins, function (pin) {
            var pin_config = intern.make_pin_config(
              client_instance,
              meta,
              pin,
              config
            )

            var has_balance_client = !!balance_map[pin_config.pin]
            var target_map = (balance_map[pin_config.pin] =
              balance_map[pin_config.pin] || {})

            // this is a duplicate, so ignore
            if (target_map[pin_config.id]) {
              return
            }

            var actmeta = client_instance.find(pin, { exact: true })

            var override =
              true === opts.override ||
              (Array.isArray(opts.override) && opts.override.includes(pin))

            if (actmeta) {
              // Prevent infinite loops between sibling services by
              // not supporting local overrides unless explicitly granted.
              if (!actmeta.client && !override) {
                return
              }
            }

            target_map[pin_config.id] = true

            pin_config.override = override

            if (!has_balance_client) {
              // no balancer for this pin, so add one
              var balance_client_config = {
                type: 'balance',
                pin: pin,
                model: config.model,
                override: override,
              }

              client_instance.client(balance_client_config)
            }

            client_instance.act('role:transport,type:balance,add:client', {
              config: pin_config,
            })
          })
        }

        function remove_client(meta) {
          if (closed) return

          // ignore myself
          if (client_instance.id === meta.instance) {
            return
          }

          var config = meta.config || {}
          var pins = intern.resolve_pins(client_instance, config)

          _.each(pins, function (pin) {
            var pin_config = intern.make_pin_config(
              client_instance,
              meta,
              pin,
              config
            )

            var target_map = balance_map[pin_config.pin]

            if (target_map) {
              delete target_map[pin_config.id]
            }

            client_instance.act('role:transport,type:balance,remove:client', {
              config: pin_config,
              meta: meta,
            })
          })
        }
      }
    })
  }
}

function make_intern() {
  return {
    make_transport_listen: function (opts, join, listen, init_done) {
      var listen_count = 0
      var last_mesh_listen_err = null

      return function (msg, done) {
        var seneca = this
        var ismesh = msg.config && msg.config.ismesh

        // count of the mesh auto listens
        listen_count += ismesh ? 1 : 0

        seneca.prior(msg, function (err, out) {
          var seneca = this

          if (err) {
            last_mesh_listen_err = ismesh ? err : last_mesh_listen_err
            return done(err)
          }

          if (ismesh) {
            join(seneca.delegate(), out, function () {
              done()

              // only finish mesh plugin init if all auto listens attempted
              if (listen.length === listen_count) {
                setTimeout(function () {
                  init_done(last_mesh_listen_err)
                }, opts.jointime)
              }
            })
          } else {
            done()
          }
        })
      }
    },

    resolve_interface: function (spec, rif) {
      var out = spec

      spec = null == spec ? '' : spec

      if ('@' === spec[0]) {
        if (1 === spec.length) {
          out = '0.0.0.0'
        } else {
          out = rif(spec.substring(1))
        }
      }

      return out
    },

    find_bases: function (seneca, opts, rif, resources, done) {
      var bases = []

      resources = resources || { discovers: [], intervals: [] }

      intern.addbase_funcmap.custom = function (seneca, opts, bases, next) {
        opts.discover.custom.find(seneca, opts, bases, function (add, stop) {
          add = add || []
          next(add, null == stop ? 0 < add.length : !!stop)
        })
      }

      // order is significant
      var addbases = ['defined', 'custom', 'registry', 'multicast', 'guess']

      var abI = -1
      var addbase

      next()

      function next(add, stop) {
        bases = bases.concat(add || [])
        if (stop && opts.discover.stop) abI = addbases.length

        do {
          ++abI
        } while (abI < addbases.length && !opts.discover[addbases[abI]].active)

        addbase = addbases[abI]

        if (null == addbase) {
          bases = intern.resolve_bases(bases, opts, rif)

          return done(bases)
        }

        intern.addbase_funcmap[addbase](seneca, opts, bases, next, resources)
      }
    },

    addbase_funcmap: {
      defined: function (seneca, opts, bases, next) {
        var add = (opts.sneeze || {}).bases || opts.bases || opts.remotes || []

        add = add.filter(function (base) {
          return base && 0 < base.length
        })

        next(add, 0 < add.length)
      },

      // order significant! depends on defined as uses bases.length
      guess: function (seneca, opts, bases, next) {
        var add = []
        var host = opts.host

        if (0 === bases.length) {
          if (null != host && host !== DEFAULT_HOST) {
            add.push(host + ':' + DEFAULT_PORT)
          }
          add.push(DEFAULT_HOST + ':' + DEFAULT_PORT)
        }

        next(add)
      },

      multicast: function (seneca, opts, bases, next, resources) {
        var add = []
        var mc_opts = opts.discover.multicast

        // Determine broadcast address using subnetmask
        if (_.isString(mc_opts.address) && '/' === mc_opts.address[0]) {
          var netprefix = parseInt(mc_opts.address.substring(1), 10)
          mc_opts.address = intern.broadcast_address(opts.host, netprefix)
        }

        var d = Discover({
          broadcast: mc_opts.address,
          advertisement: {
            seneca_mesh: true,
            isbase: opts.isbase,
            host: opts.host || DEFAULT_HOST,
            port: opts.port || DEFAULT_PORT,
          },
        })

        resources.discovers.push(d)

        var findCount = 0
        var fi = setInterval(function () {
          var count = 0
          d.eachNode(function (node) {
            var nd = node.advertisement
            if (nd.seneca_mesh) {
              add.push(nd.host + ':' + nd.port)
              count++
            }
          })

          if (0 < count || mc_opts.max_search < findCount) {
            // only bases should keep broadcasting
            if (!opts.isbase) {
              d.stop()
              _.pull(resources.discovers, d)
            }

            clearInterval(fi)
            _.pull(resources.intervals, fi)

            next(add, 0 < add.length)
          }

          findCount++
        }, mc_opts.search_interval)

        resources.intervals.push(fi)
      },

      registry: function (seneca, opts, bases, next, resources) {
        var first = true

        var base_addr =
          (opts.host || DEFAULT_HOST) + ':' + (opts.port || DEFAULT_PORT)

        if (opts.isbase) {
          var ri = opts.discover.registry.refresh_interval
          ri = ri + ri * (Math.random() - 0.5)
          resources.intervals.push(setInterval(getset_bases, ri))
        }

        getset_bases()

        function getset_bases() {
          seneca.act(
            'role:registry,cmd:get,default$:{}',
            { key: 'seneca-mesh/' + (opts.tag || '-') + '/bases' },
            function (err, out) {
              if (err) return

              var add = (out.value || '').split(',')
              add = add.filter(function (base) {
                return 0 < base.length
              })

              if (first) {
                first = false
                next(add, 0 < add.length)
              }

              if (opts.isbase) {
                var prune_first =
                  Math.random() < opts.discover.registry.prune_first_probability

                if (prune_first || -1 === add.indexOf(base_addr)) {
                  add.push(base_addr)
                  add = _.uniq(add)

                  if (
                    prune_first &&
                    opts.discover.registry.prune_bound < add.length
                  ) {
                    add.shift()
                  }

                  var val = add.join(',')

                  seneca.act('role:registry,cmd:set,default$:{}', {
                    key: 'seneca-mesh/' + (opts.tag || '-') + '/bases',
                    value: val,
                  })
                }
              }
            }
          )
        }
      },
    },

    // IPv4 broadcast address of the subnet of host with the given prefix
    // length, for example ('192.168.1.5', 24) -> '192.168.1.255'.
    broadcast_address: function (host, prefix) {
      var parts = String(host).split('.')
      var valid =
        4 === parts.length &&
        parts.every(function (part) {
          return /^\d{1,3}$/.test(part) && +part <= 255
        }) &&
        0 <= prefix &&
        prefix <= 32

      if (!valid) {
        throw new Error(
          'mesh: discover.multicast.address /' +
            prefix +
            ' needs an IPv4 host option and a prefix length from 0 to 32, host: ' +
            host
        )
      }

      var addr = parts.reduce(function (acc, part) {
        return acc * 256 + +part
      }, 0)
      var size = Math.pow(2, 32 - prefix)
      var bcast = addr - (addr % size) + size - 1

      return [
        Math.floor(bcast / 16777216) % 256,
        Math.floor(bcast / 65536) % 256,
        Math.floor(bcast / 256) % 256,
        bcast % 256,
      ].join('.')
    },

    // A copy of obj that holds only JSON data: no functions or undefined
    // values, dates as strings and objects with toJSON as their JSON value.
    // If obj is circular, objects already seen are dropped.
    json_safe: function (obj) {
      var json

      try {
        json = JSON.stringify(obj)
      } catch (e) {
        var seen = []
        json = JSON.stringify(obj, function (key, val) {
          if (null != val && 'object' === typeof val) {
            if (-1 !== seen.indexOf(val)) {
              return void 0
            }
            seen.push(val)
          }
          return val
        })
      }

      return void 0 === json ? json : JSON.parse(json)
    },

    default_make_entry: function (member) {
      var entry = member

      var meta = member.meta

      if (meta.tag$ && meta.tag$.match(/^seneca~/)) {
        entry = {
          pin: meta.config.pin,
          port: meta.config.port,
          host: meta.config.host,
          type: meta.config.type,
          model: meta.config.model,
          instance: meta.instance,
        }
      }

      return entry
    },

    resolve_bases: function (orig_bases, opts, rif) {
      opts = opts || {}

      var host = opts.host

      // remove empties
      var bases = (orig_bases || []).filter(function (base) {
        return base && 0 < base.length
      })

      var append = []

      // first pass: defaults and interfacesx
      bases = bases.map(function (base) {
        // host:port -> host:port
        // :port -> DEFAULT_HOST:port, host:port
        // host -> host:DEFAULT_PORT
        var parts = base.match(/^(.+):(\d+)$/)
        if (parts) {
          parts = parts.slice(1, 3)
        } else {
          if (':' === base[0]) {
            parts = [DEFAULT_HOST, base.substring(1)]
            if (host) {
              append.push(host + ':' + parts[1])
            }
          } else {
            parts = [base, DEFAULT_PORT]
          }
        }

        if ('@' === (parts[0] && parts[0][0])) {
          parts[0] = rif(parts[0].substring(1))
        }

        return parts.join(':')
      })

      bases = bases.concat(append)

      // TODO second pass: ranges
      // host:10-12 -> host:10, host:11, host:12
      // a.b.c.10-12:port -> a.b.c.10:port, a.b.c.11:port, a.b.c.12:port

      return bases
    },

    resolve_pins: function (instance, config) {
      var pins = config.pins || config.pin || []
      pins = _.isArray(pins) ? pins : [pins]

      pins = _.flatten(
        _.map(pins, function (pin) {
          return _.isString(pin) ? pin.split(';') : pin
        })
      )

      pins = _.map(pins, function (pin) {
        return instance.util.pincanon(pin)
      })

      return pins
    },

    make_pin_config: function (instance, meta, canonical_pin, config) {
      var pin_config = _.clone(config)
      delete pin_config.pins
      delete pin_config.pin

      pin_config.pin = canonical_pin
      pin_config.id = instance.util.pattern(pin_config) + '~' + meta.identifier$

      return pin_config
    },
  }
}
