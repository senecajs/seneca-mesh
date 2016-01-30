/*
  MIT License,
  Copyright (c) 2015-2016, Richard Rodger and other contributors.
*/

'use strict'

var _ = require('lodash')
var Jsonic = require('jsonic')
var Swim = require('swim')
var Sneeze = require('sneeze')
var Nid = require('nid')


module.exports = function mesh (options) {
  var seneca = this

  var balance_map = {}
  var mid = Nid()
  
  options = seneca.util.deepextend({
    auto: true
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
  sneeze_opts.tag = sneeze_opts.tag || tag || 'seneca'
  sneeze_opts.identifier = sneeze_opts.identifier || seneca.id

  var listen = options.listen || [{pin:pin}]

  seneca.use( 'balance-client$mesh~'+mid )

  seneca.add( 'role:transport,cmd:listen', transport_listen )


  // call seneca.listen as a convenience
  // subsequence seneca.listen calls will still publish to network
  if( options.auto ) {
    _.each( listen, function( listen_opts ) {

      listen_opts.port = null != listen_opts.port ? listen_opts.port : function() {
        return 50000 + Math.floor((10000*Math.random()))
      }

      listen_opts.model = listen_opts.model || 'actor'

      //console.log('listen',seneca.id,listen_opts)
      seneca.root.listen( listen_opts )
    })
  }


  function transport_listen ( msg, done ) {
    //console.log( 'transport_listen',seneca.id,seneca.util.clean(msg))
    this.prior( msg, function( err, out ) {
      if( err ) return done( err )

      join( this, out, function() {
        //console.log('done',seneca.util.clean(out))
        done()
      })
    })
  }

  
  function join( instance, config, done ) {
    config = config || {}

    if( !config.pin && !config.pins ) {
      config.pin = 'null:true'
    }

    //console.log('join',instance.id,seneca.util.clean(config),sneeze_opts)

    //sneeze_opts.silent = false
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

    seneca.sub('role:seneca,cmd:close', function(){
      //console.log('CLOSE',seneca.id)
      if( sneeze ) {
        sneeze.leave()
      }
    })

    sneeze.join( meta )

    function add_client( meta ) {
      var config = meta.config
      //console.log('add_client',seneca.id,config)

      var pins = config.pins || config.pin
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
          //console.log('M AC AB '+pin_id)
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
      var config = meta.config
      //console.log('REMOVE',seneca.id,config)

      var pins = config.pins || config.pin
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

        //console.log( 'TREM', seneca.id,pin_config )
        instance.act( 
          'role:transport,type:balance,remove:client', 
          {config:pin_config} ) 
      })
    }
  }
}

