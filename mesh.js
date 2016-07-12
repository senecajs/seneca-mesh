/*
  MIT License,
  Copyright (c) 2015-2016, Richard Rodger and other contributors.
*/

'use strict'

var _ = require('lodash')
var Jsonic = require('jsonic')
var Sneeze = require('sneeze')
var Nid = require('nid')


module.exports = function mesh (options) {
  var seneca = this

  var balance_map = {}
  var mid = Nid()
  
  options = seneca.util.deepextend({
    auto: true,
    make_entry: default_make_entry
  }, options)

  // options.base is to deprecated
  var isbase = !!(options.isbase || options.base)

  var pin = options.pin || options.pins

  if( isbase ) {
    pin = pin || 'role:mesh,base:true'
  }

  // options.remotes is to deprecated
  var bases = options.bases || options.remotes

  var tag = options.tag

  var sneeze_opts = options.sneeze || {}
  sneeze_opts.isbase = sneeze_opts.isbase || isbase
  sneeze_opts.bases = sneeze_opts.bases || bases || void 0
  sneeze_opts.port = sneeze_opts.port || options.port || void 0
  sneeze_opts.host = sneeze_opts.host || options.host || void 0
  sneeze_opts.identifier = sneeze_opts.identifier || seneca.id

  sneeze_opts.tag 
    =  ( void 0 !== sneeze_opts.tag ? sneeze_opts.tag : 
         void 0 !== tag ? 
         (null === tag ? null : 'seneca~'+tag) 
         : 'seneca~mesh' )

  var listen = options.listen || [{pin:pin, model:options.model||'consume'}]

  var balance_client_opts = options.balance_client || {}
  seneca.use( 'balance-client$mesh~'+mid, balance_client_opts )

  seneca.add( 'role:transport,cmd:listen', transport_listen )

  // call seneca.listen as a convenience
  // subsequent seneca.listen calls will still publish to network
  if( options.auto ) {
    _.each( listen, function( listen_opts ) {

      listen_opts.port = null != listen_opts.port ? listen_opts.port : function() {
        return 50000 + Math.floor((10000*Math.random()))
      }

      listen_opts.model = listen_opts.model || 'consume'

      seneca.root.listen( listen_opts )
    })
  }


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

    var sneeze = Sneeze( instance_sneeze_opts )
    
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

      this.prior( msg, function( err, list ) {
        list = list || []
        var outlist = list.concat(members)

        done( null, outlist )
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

}

