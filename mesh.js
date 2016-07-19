/*
  MIT License,
  Copyright (c) 2015-2016, Richard Rodger and other contributors.
*/

'use strict'

var _ = require('lodash')
var Jsonic = require('jsonic')
var Sneeze = require('sneeze')
var Nid = require('nid')
var Rif = require('rif')
var Discover = require('node-discover')
var Ip = require('ip')

module.exports = mesh
module.exports.resolve_bases = resolve_bases

var DEFAULT_HOST = module.exports.DEFAULT_HOST = '127.0.0.1'
var DEFAULT_PORT = module.exports.DEFAULT_PORT = 39999

function mesh (options) {
  var seneca = this

  // Default option values
  options = seneca.util.deepextend({
    auto: true,
    make_entry: default_make_entry,

    discover: {
      defined: true,
      guess: true,
      multicast: {
        address: null,
        max_search: 22,
        search_interval: 111,
      },
      registry: {
        // check registry periodically
        refresh_interval: 1111,

        // remove first entry with this probability
        // live bases nodes will add themselves back in
        prune_first_probability: 0.01,

        // leave at least this many base entries
        prune_bound: 11
      },

      // stop discovery if defined bases are provided
      stop: true
    },

    dumpnet: false
  }, options)


  var bases = []
  var sneeze

  seneca.add('role:mesh,get:bases', function get_bases (msg, done) {
    done( null, {bases:[].concat(bases)} )
  })

  var balance_map = {}
  var mid = Nid()
  
  // fixed network interface specification, as per format of
  // require('os').networkInterfaces. Merged with and overrides same.
  var rif = Rif(options.netif)

  // options.base is deprecated
  var isbase = !!(options.isbase || options.base)
  options.isbase = isbase

  var pin = options.pin || options.pins

  if( isbase ) {
    pin = pin || 'role:mesh,base:true'
  }

  options.host = resolve_interface(options.host, rif)
  var tag = options.tag

  var listen = options.listen || [{pin:pin, model:options.model||'consume'}]

  var balance_client_opts = options.balance_client || {}
  seneca.use( 'balance-client$mesh~'+mid, balance_client_opts )

  if( options.dumpnet ) {
    require('child_process')
      .exec('ifconfig -a', function (error, stdout, stderr) {
        if (error) {
          console.error(error)
        }
        console.log(stdout)
        console.log(stderr)
      })
  }


  seneca.add('init:mesh', init)

  function init (msg, done) {

    find_bases( seneca, options, rif, function (found_bases) {
      console.log(options)

      bases = found_bases

      seneca.log.info({kind:'mesh',host:options.host,port:options.port,bases:bases})
      var sneeze_opts = options.sneeze || {}

      sneeze_opts.bases = bases
      sneeze_opts.isbase = isbase
      sneeze_opts.port = options.port || void 0
      sneeze_opts.host = options.host || void 0
      sneeze_opts.identifier = seneca.id

      sneeze_opts.tag 
        =  ( void 0 !== sneeze_opts.tag ? sneeze_opts.tag : 
             void 0 !== tag ? 
             (null === tag ? null : 'seneca~'+tag) 
             : 'seneca~mesh' )

      seneca.add( 'role:transport,cmd:listen', transport_listen )

      // call seneca.listen as a convenience
      // subsequent seneca.listen calls will still publish to network
      if( options.auto ) {
        _.each( listen, function( listen_opts ) {

          if( options.host && null == listen_opts.host ) {
            listen_opts.host = options.host
          }

          if( '@' === (listen_opts.host && listen_opts.host[0]) ) {
            listen_opts.host = rif(listen_opts.host.substring(1))
          }

          listen_opts.port = null != listen_opts.port ? listen_opts.port : function() {
            return 50000 + Math.floor((10000*Math.random()))
          }

          listen_opts.model = listen_opts.model || 'consume'
          
          seneca.root.listen( listen_opts )
        })
      }


      return done()

      
      function transport_listen (msg, done) {
        this.prior( msg, function( err, out ) {
          if( err ) return done( err )

          join( this, out, function() {
            done()
          })
        })
      }

      
      function join( instance, config, done ) {
        config = config || {}

        if( !config.pin && !config.pins ) {
          config.pin = 'null:true'
        }

        var instance_sneeze_opts = _.clone( sneeze_opts )
        instance_sneeze_opts.identifier = 
          sneeze_opts.identifier + '~' +
          seneca.util.pincanon(config.pin||config.pins) + '~' + Date.now()

        sneeze = Sneeze( instance_sneeze_opts )
        
        var meta = {
          config: config,
          instance: instance.id,
        }

        sneeze.on('error', function(err) {
          seneca.log.warn(err)
        })
        sneeze.on('add', add_client)
        sneeze.on('remove', remove_client)
        sneeze.on('ready', done)

        seneca.add('role:seneca,cmd:close', function(msg, done) {
          if( sneeze ) {
            sneeze.leave()
          }
          this.prior(msg, done)
        })


        seneca.add( 'role:mesh,get:members', function get_members (msg, done) {
          var members = []

          _.each( sneeze.members(), function(member) {
            var m = options.make_entry(member)
            members.push( void 0 === m ? default_make_entry(member) : m )
          })

          this.prior( msg, function( err, out ) {
            var list = out && out.list || []
            var outlist = list.concat(members)

            done( null, {list:outlist} )
          })
        })


        sneeze.join( meta )

        function add_client( meta ) {
          var config = meta.config || {}

          var pins = config.pins || config.pin || []
          pins = _.isArray(pins) ? pins : [pins]

          _.each( pins, function( pin ) {
            var pin_id = instance.util.pattern(pin)
            var has_balance_client = !!balance_map[pin_id]
            var target_map = (balance_map[pin_id] = balance_map[pin_id] || {})

            var pin_config = _.clone( config )
            delete pin_config.pins
            delete pin_config.pin

            pin_config.pin = pin_id

            var id = instance.util.pattern( pin_config )+'~'+meta.identifier$
            
            // this is a duplicate, so ignore
            if( target_map[id] ) {
              return
            }

            pin_config.id = id

            // TODO: how to handle local override?
            var actmeta = instance.find( pin )
            var ignore_client = !!(actmeta && !actmeta.client)

            if( ignore_client ) {
              return
            }


            if( !has_balance_client ) {
              // no balancer for this pin, so add one
              instance.root.client( {type:'balance', pin:pin, model:config.model} )
            }

            target_map[id] = true

            instance.act( 
              'role:transport,type:balance,add:client', 
              {config:pin_config} ) 
          })
        }


        function remove_client( meta ) {
          var config = meta.config || {}

          var pins = config.pins || config.pin || []
          pins = _.isArray(pins) ? pins : [pins]

          _.each( pins, function( pin ) {
            var pin_id = instance.util.pattern(pin)

            var pin_config = _.clone( config )
            delete pin_config.pins
            delete pin_config.pin

            pin_config.pin = pin_id

            var id = instance.util.pattern( pin_config )+'~'+meta.identifier$
            pin_config.id = id

            var target_map = balance_map[pin_id]

            if( target_map ) {
              delete target_map[id]
            }

            instance.act( 
              'role:transport,type:balance,remove:client', 
              {config:pin_config} ) 
          })
        }
      }
    })
  }
}


function resolve_interface (spec, rif) {
  var out = spec

  spec = null == spec ? '' : spec

  if( '@' === spec[0] ) {
    if( 1 === spec.length ) {
      out = '0.0.0.0'
    }
    else {
      out = rif(spec.substring(1))
    }
  }

  return out
}



function find_bases (seneca, options, rif, done) {
  var bases = []

  options.discover = options.discover || {}
  addbase_funcmap.custom = function (seneca, options, bases, next) {
    options.discover.custom(seneca, options, bases, function (add, stop) {
      add = add || []
      next( add, null == stop ? 0 < add.length : !!stop )
    })}

  // order is significant
  var addbases = [
    'defined',
    'registry',
    'multicast',
    'custom',
    'guess',
  ]

  var abI = -1
  var addbase

  next()

  function next (add, stop) {
    //console.log(addbase,add)
    bases = bases.concat(add || [])
    if (stop && options.discover.stop) abI = addbases.length

    ++abI

    while (!truthy(options.discover[addbases[abI]]) 
           && abI < addbases.length) 
    { ++abI }

    addbase = addbases[abI]

    if( null == addbase ) {
      bases = resolve_bases( 
        bases,
        options,
        rif
      )

      return done(bases)
    }

    addbase_funcmap[addbase](seneca, options, bases, next)
  }
}

var addbase_funcmap = {
  defined: function (seneca, options, bases, next) {
    var add = 
          (options.sneeze||{}).bases || options.bases || options.remotes || []

    add = add.filter(function (base) {
      return base && 0 < base.length
    })

    //console.log('FB defined',add)    
    next(add, 0 < add.length)
  },

  // order significant! depends on defined as uses bases.length
  guess: function (seneca, options, bases, next) {
    var add = []
    var host = options.host

    if( 0 === bases.length ) {
      if( null != host && host !== DEFAULT_HOST ) {
        add.push(host+':'+DEFAULT_PORT)
      }
      add.push(DEFAULT_HOST+':'+DEFAULT_PORT)
    }
    
    // console.log('FB guess',add)
    next(add)
  },

  multicast: function (seneca, options, bases, next) {
    var add = []
    var opts = ((options.discover||{}).multicast||{})

    // Determine broadcast address using subnetmask
    if( _.isString(opts.address) && '/' === opts.address[0] ) {
      var netprefix = parseInt(opts.address.substring(1))
      opts.address = Ip.subnet(options.host,Ip.fromPrefixLen(netprefix)).broadcastAddress
    }

    var d = Discover({
      broadcast: opts.address,
      advertisement: {
        seneca_mesh: true,
        isbase: options.isbase,
        host: options.host || DEFAULT_HOST,
        port: options.port || DEFAULT_PORT
      }
    })

    var findCount = 0
    var fi = setInterval(function () {
      var count = 0
      d.eachNode(function (node) {
        var nd = node.advertisement
        if( nd.seneca_mesh ) {
          add.push(nd.host+':'+nd.port)
          count++
        }
      })

      if( 0 < count || opts.max_search < findCount ) {

        // only bases should keep broadcasting
        if( !options.isbase ) { 
          d.stop()
        }

        clearInterval(fi)

        //console.log('FB multicast',add)
        next(add, 0 < add.length)
      }

      findCount++
    }, opts.search_interval)
  },

  
  registry: function (seneca, options, bases, next) {  
    var first = true

    var base_addr = (options.host||DEFAULT_HOST)+':'+
          (options.port||DEFAULT_PORT)
    
    if( options.isbase ) {
      var ri = options.discover.registry.refresh_interval
      ri = ri+(ri*(Math.random()-0.5))
      setInterval(getset_bases, ri)
    }

    getset_bases()
    
    function getset_bases() {
      seneca.act(
        'role:registry,cmd:get,default$:{}',
        {key:'seneca-mesh/'+(options.tag||'-')+'/bases'},
        function (err, out) {
          if( err ) return

          var add = (out.value||'').split(',')
          add = add.filter(function (base) {
            return 0 < base.length
          })

          if( first ) {
            first = false
            //console.log('FB registry',add)
            next(add, 0 < add.length)
          }

          if( options.isbase ) {
            var prune_first = Math.random() < 
                  options.discover.registry.prune_first_probability

            if( prune_first || -1 === add.indexOf(base_addr) ) {
              add.push(base_addr)
              add = _.uniq(add)

              if( prune_first && options.discover.registry.prune_bound < add.length ) {
                add.shift()
              }

              var val = add.join(',')
              
              seneca.act(
                'role:registry,cmd:set,default$:{}',
                {
                  key:'seneca-mesh/'+(options.tag||'-')+'/bases', 
                  value:val
                })
            }
          }
        })
    }
  }
}  


function default_make_entry (member) {
  var entry = member

  if( member.tag$.match(/^seneca~/) ) {
    entry = {
      pin: member.config.pin,
      port: member.config.port,
      host: member.config.host,
      type: member.config.type,
      model: member.config.model,
      instance: member.instance
    }
  }

  return entry
}


function resolve_bases (orig_bases, options, rif) {
  options = options || {}

  var host = options.host
  
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
    if( parts ) {
      parts = parts.slice(1,3)
    }
    else {
      if( ':' === base[0] ) {
        parts = [DEFAULT_HOST, base.substring(1)]
        if( host ) {
          append.push(host+':'+parts[1])
        }
      }
      else {
        parts = [base, DEFAULT_PORT]
      }
    }

    if( '@' === (parts[0] && parts[0][0]) ) {
      parts[0] = rif(parts[0].substring(1))
    }    

    return parts.join(':')
  })
  
  bases = bases.concat(append)


  // second pass: ranges
  // host:10-12 -> host:10, host:11, host:12
  // a.b.c.10-12:port -> a.b.c.10:port, a.b.c.11:port, a.b.c.12:port 

  return bases
}


function truthy (v) {
  return 'false' === v ? false : !!v
}
