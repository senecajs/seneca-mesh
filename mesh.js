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

  var listen = options.listen || [{pin:pin, model:options.model||'actor'}]

  seneca.use( 'balance-client$mesh~'+mid )

  seneca.add( 'role:transport,cmd:listen', transport_listen )

  // call seneca.listen as a convenience
  // subsequent seneca.listen calls will still publish to network
  if( options.auto ) {
    _.each( listen, function( listen_opts ) {

      listen_opts.port = null != listen_opts.port ? listen_opts.port : function() {
        return 50000 + Math.floor((10000*Math.random()))
      }

      listen_opts.model = listen_opts.model || 'actor'

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

    var sneeze = Sneeze( sneeze_opts )
    
    var meta = {
      config: config,
      instance: instance.id
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

      var members = _.map( sneeze.members(), function(member) {
        return options.make_entry(member)
      })

      this.prior( msg, function( err, list ) {
        list = list || []
        done( null, list.concat(members) )
      })
    })


    sneeze.join( meta )


    function add_client( meta ) {
      var config = meta.config || {}

      var pins = config.pins || config.pin || []
      pins = _.isArray(pins) ? pins : [pins]

      _.each( pins, function( pin ) {
        var pin_id = instance.util.pattern(pin)

        var pin_config = _.clone( config )
        delete pin_config.pins
        delete pin_config.pin

        pin_config.pin = pin_id

        var id = instance.util.pattern( pin_config )

        // TODO: how to handle local override?
        var actmeta = instance.find( pin )
        var ignore_client = !!(actmeta && !actmeta.client)

        if( ignore_client ) {
          return
        }

        if( !balance_map[pin_id] ) {
          instance.root.client( {type:'balance', pin:pin, model:config.model} )
          balance_map[pin_id] = {}
        }

        var target_map = (balance_map[pin_id] = balance_map[pin_id] || {})

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

        var id = instance.util.pattern( pin_config )

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
        instance: member.instance
      }
    }

    return entry
  }

}

