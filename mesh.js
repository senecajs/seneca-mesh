/* MIT License. Copyright © 2015-2018, Richard Rodger and other contributors. */

'use strict'

var _ = require('lodash')
var Sneeze = require('sneeze')
var Nid = require('nid')
var Rif = require('rif')
var Discover = require('node-discover')
var Ip = require('ip')
var Optioner = require('optioner')

var Joi = Optioner.Joi

module.exports = mesh

var DEFAULT_HOST = (module.exports.DEFAULT_HOST = '127.0.0.1')
var DEFAULT_PORT = (module.exports.DEFAULT_PORT = 39999)

var intern = module.exports.intern = make_intern()

var optioner = Optioner({
  pin: Joi.alternatives().try(Joi.string(), Joi.object()),
  pins: Joi.array(),
  host: Joi.string(),
  port: Joi.number().integer().min(0).max(65535),
  isbase: false,

  model: 'consume',
  listen: Joi.array(),

  auto: true,
  make_entry: intern.default_make_entry,

  jointime: 111, // join and wait for network details

  // Explicitly allow overrides of specific local patterns. This is not supported
  // by default to prevent infinite loops between subling services with same pins.
  overrides: {},
  
  discover: {
    defined: {
      active: true
    },

    guess: {
      active: true
    },

    multicast: {
      active: true,
      address: null,
      // max_search: 22,
      max_search: 2,
      search_interval: 111
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
      prune_bound: 11
    },

    custom: {
      active: true,
      find: function(seneca, options, bases, next) {
        next([], false)
      }
    },

    // stop discovery if defined bases are provided
    stop: true
  },

  monitor: false,
  sneeze: null
})


function mesh(options) {
  var seneca = this

  seneca.depends('balance-client')

  var opts = optioner.check(options)

    var closed = false

    var bases = []
    var sneeze

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
      pin = Array.isArray(pin) ? pin : [].concat('role:mesh,base:'+seneca.id)
      //pin = ['']
    }

    opts.host = intern.resolve_interface(opts.host, rif)
    var tag = opts.tag

    var listen = opts.listen || [
      { pin: pin, model: opts.model || 'consume' }
    ]

    var balance_client_opts = opts.balance_client || {}
    seneca.use('balance-client$mesh~' + mid, balance_client_opts)

    seneca.add('init:mesh', init)

    function init(msg, init_done) {
      var seneca = this

      intern.find_bases(seneca, opts, rif, function(found_bases) {
        bases = found_bases

        seneca.log.debug({
          kind: 'mesh',
          host: opts.host,
          port: opts.port,
          bases: bases,
          opts: opts
        })

        var sneeze_opts = opts.sneeze || {}

        sneeze_opts.bases = bases
        sneeze_opts.isbase = isbase
        sneeze_opts.port = opts.port || void 0
        sneeze_opts.host = opts.host || void 0
        sneeze_opts.identifier = seneca.id

        sneeze_opts.monitor = sneeze_opts.monitor || {
          active: !!opts.monitor
        }

        sneeze_opts.tag = void 0 !== sneeze_opts.tag
          ? sneeze_opts.tag
          : void 0 !== tag
              ? null === tag ? null : 'seneca~' + tag
              : 'seneca~mesh'

        seneca.add('role:transport,cmd:listen', 
                   intern.make_transport_listen(opts, join, listen, init_done))

        // call seneca.listen as a convenience
        // subsequent seneca.listen calls will still publish to network
        if (opts.auto) {
          _.each(listen, function(listen_opts) {
            if (opts.host && null == listen_opts.host) {
              listen_opts.host = opts.host
            }

            if ('@' === (listen_opts.host && listen_opts.host[0])) {
              listen_opts.host = rif(listen_opts.host.substring(1))
            }

            listen_opts.port = null != listen_opts.port
              ? listen_opts.port
              : function() {
                  return 50000 + Math.floor(10000 * Math.random())
                }

            listen_opts.model = listen_opts.model || 'consume'

            listen_opts.ismesh = true

            seneca.listen(listen_opts)
          })
        }


        function join(instance, raw_config, done) {
          var client_instance = instance.root.delegate()
          var config = seneca.util.clean(raw_config || {}, {proto:false})

          if (!config.pin && !config.pins) {
            config.pin = 'null:true'
          }

          config.pin = intern.resolve_pins(instance, config)
          delete config.pins

          var instance_sneeze_opts = _.clone(sneeze_opts)
          instance_sneeze_opts.identifier =
            sneeze_opts.identifier + '~' + config.pin + '~' + Date.now()

          sneeze = Sneeze(instance_sneeze_opts)

          var meta = {
            config: seneca.util.clean(config),
            instance: instance.id
          }

          sneeze.on('error', function(err) {
            seneca.log.warn(err)
          })
          sneeze.on('add', add_client)
          sneeze.on('remove', remove_client)
          sneeze.on('ready', done)

          seneca.add('role:seneca,cmd:close', function(msg, done) {
            closed = true
            if (sneeze) {
              sneeze.leave()
            }
            this.prior(msg, done)
          })

          seneca.add('role:mesh,get:members', function get_members(msg, done) {
            var members = []

            _.each(sneeze.members(), function(member) {
              var m = opts.make_entry(member)
              members.push(void 0 === m ? intern.default_make_entry(member) : m)
            })

            this.prior(msg, function(err, out) {
              if (err) {
                done(err)
              }
              var list = (out && out.list) || []
              var outlist = list.concat(members)

              done(null, { list: outlist })
            })
          })


          sneeze.join(meta)

          function add_client(meta) {
            if (closed) return

            // ignore myself
            if (client_instance.id === meta.instance) {
              return
            }

            var config = meta.config || {}
            var pins = intern.resolve_pins(client_instance, config)

            _.each(pins, function(pin) {
              var pin_config = intern.make_pin_config(
                client_instance,
                meta,
                pin,
                config
              )

              var has_balance_client = !!balance_map[pin_config.pin]
              var target_map = (balance_map[pin_config.pin] = balance_map[
                pin_config.pin
              ] || {})

              // this is a duplicate, so ignore
              if (target_map[pin_config.id]) {
                return
              }

              var actmeta = client_instance.find(pin, {exact: true})

              if(actmeta) {
                // Prevent infinite loops between sibling services by
                // not supporting local overrides unless explicitly granted.
                if(!actmeta.client && !opts.overrides[pin]) {
                  return
                }
              }

              target_map[pin_config.id] = true


              if (!has_balance_client) {
                // no balancer for this pin, so add one
                client_instance.client({
                  type: 'balance',
                  pin: pin,
                  model: config.model
                })
              }

              client_instance.act('role:transport,type:balance,add:client', {
                config: pin_config
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

            _.each(pins, function(pin) {
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
                config: pin_config, meta:meta
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

      return function(msg, done) {
        var seneca = this
        var ismesh = msg.config && msg.config.ismesh

        // count of the mesh auto listens
        listen_count += ismesh ? 1 : 0

        seneca.prior(msg, function(err, out) {
          var seneca = this

          if (err) {
            last_mesh_listen_err = ismesh ? err : last_mesh_listen_err
            return done(err)
          }

          if (ismesh) {
            join(seneca.delegate(), out, function() {
              done()

              // only finish mesh plugin init if all auto listens attempted
              if (listen.length === listen_count) {
                setTimeout(function(){
                  init_done(last_mesh_listen_err)
                },opts.jointime)
              }
            })
          } else {
            done()
          }
        })
      }
    },

    resolve_interface: function(spec, rif) {
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

    find_bases: function(seneca, opts, rif, done) {
      var bases = []

      intern.addbase_funcmap.custom = function(seneca, opts, bases, next) {
        opts.discover.custom.find(seneca, opts, bases, function(
          add,
          stop
        ) {
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
        } while (
          abI < addbases.length && !opts.discover[addbases[abI]].active
        )

        addbase = addbases[abI]

        if (null == addbase) {
          bases = intern.resolve_bases(bases, opts, rif)

          return done(bases)
        }

        intern.addbase_funcmap[addbase](seneca, opts, bases, next)
      }
    },

    addbase_funcmap: {
      defined: function(seneca, opts, bases, next) {
        var add = (opts.sneeze || {}).bases ||
              opts.bases ||
              opts.remotes || []

        add = add.filter(function(base) {
          return base && 0 < base.length
        })

        next(add, 0 < add.length)
      },

      // order significant! depends on defined as uses bases.length
      guess: function(seneca, opts, bases, next) {
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

      multicast: function(seneca, opts, bases, next) {
        var add = []
        var mc_opts = opts.discover.multicast

        // Determine broadcast address using subnetmask
        if (_.isString(mc_opts.address) && '/' === mc_opts.address[0]) {
          var netprefix = parseInt(mc_opts.address.substring(1), 10)
          mc_opts.address = Ip.subnet(
            opts.host,
            Ip.fromPrefixLen(netprefix)
          ).broadcastAddress
        }

        var d = Discover({
          broadcast: mc_opts.address,
          advertisement: {
            seneca_mesh: true,
            isbase: opts.isbase,
            host: opts.host || DEFAULT_HOST,
            port: opts.port || DEFAULT_PORT
          }
        })

        var findCount = 0
        var fi = setInterval(function() {
          var count = 0
          d.eachNode(function(node) {
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
            }

            clearInterval(fi)

            next(add, 0 < add.length)
          }

          findCount++
        }, mc_opts.search_interval)
      },

      registry: function(seneca, opts, bases, next) {
        var first = true

        var base_addr =
              (opts.host || DEFAULT_HOST) + ':' + (opts.port || DEFAULT_PORT)

        if (opts.isbase) {
          var ri = opts.discover.registry.refresh_interval
          ri = ri + ri * (Math.random() - 0.5)
          setInterval(getset_bases, ri)
        }

        getset_bases()

        function getset_bases() {
          seneca.act(
            'role:registry,cmd:get,default$:{}',
            { key: 'seneca-mesh/' + (opts.tag || '-') + '/bases' },
            function(err, out) {
              if (err) return

              var add = (out.value || '').split(',')
              add = add.filter(function(base) {
                return 0 < base.length
              })

              if (first) {
                first = false
                next(add, 0 < add.length)
              }

              if (opts.isbase) {
                var prune_first =
                      Math.random() <
                      opts.discover.registry.prune_first_probability

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
                    value: val
                  })
                }
              }
            }
          )
        }
      }
    },

    default_make_entry: function(member) {
      var entry = member

      var meta = member.meta

      if (meta.tag$ && meta.tag$.match(/^seneca~/)) {
        entry = {
          pin: meta.config.pin,
          port: meta.config.port,
          host: meta.config.host,
          type: meta.config.type,
          model: meta.config.model,
          instance: meta.instance
        }
      }

      return entry
    },

    resolve_bases: function(orig_bases, opts, rif) {
      opts = opts || {}

      var host = opts.host

      // remove empties
      var bases = (orig_bases || []).filter(function(base) {
        return base && 0 < base.length
      })

      var append = []

      // first pass: defaults and interfacesx
      bases = bases.map(function(base) {
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

    resolve_pins: function(instance, config) {
      var pins = config.pins || config.pin || []
      pins = _.isArray(pins) ? pins : [pins]

      pins = _.flatten(
        _.map(pins, function(pin) {
          return _.isString(pin) ? pin.split(';') : pin
        })
      )

      pins = _.map(pins, function(pin) {
        return instance.util.pincanon(pin)
      })

      return pins
    },

    make_pin_config: function(instance, meta, canonical_pin, config) {
      var pin_config = _.clone(config)
      delete pin_config.pins
      delete pin_config.pin

      pin_config.pin = canonical_pin
      pin_config.id = instance.util.pattern(pin_config) + '~' + meta.identifier$

      return pin_config
    }
  }
}
