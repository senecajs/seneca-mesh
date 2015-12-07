/*
  MIT License,
  Copyright (c) 2015, Richard Rodger and other contributors.
*/

'use strict'

var _ = require('lodash')
var Jsonic = require('jsonic')
var Swim = require('swim')


module.exports = function (options) {
  var seneca = this

  // become a base node
  if( options.base ) {
    options.host = '127.0.0.1'
    options.port = 39999
    options.pin  = 'role:mesh,base:true'
    options.auto = true
  }

  // merge default options with any provided by the caller
  options = seneca.util.deepextend({
    host: '127.0.0.1',
    port: function() {
      return 40000 + Math.floor((10000*Math.random()))
    },
    remotes: ['127.0.0.1:39999']
  }, options)


  seneca.use( 'balance-client' )

  seneca.add( 'role:transport,cmd:listen', transport_listen )

  
  if( options.auto ) {
    seneca.listen( {
      // seneca-transport will retry unti it finds a free port
      port: function() {
        return 50000 + Math.floor((10000*Math.random()))
      },
      pin: options.pin
    })
  }


  function transport_listen ( msg, done ) {
    this.prior( msg, function( err, out ) {
      if( !err ) {
        // TODO: pins?
        join( this, out, done )
      }
      done( err, out )
    })
  }


  var attempts = 0, max_attempts = 11

  function join( instance, config, done ) {
    if( !config.pin ) {
      config.pin = 'null:true'
    }

    //console.log('JOIN',config)

    var host = options.host + ( options.port ? 
                               ':'+(_.isFunction(options.port) ? 
                                    options.port() : options.port ) : '' )

    var meta = {
      who: host,
      listen: config
    }

    var opts = {
      local: {
        host: host,
        meta: meta,
        incarnation: Date.now()
      },
      codec: 'msgpack',
      disseminationFactor: 15,
      interval: 100,
      joinTimeout: 200,
      pingTimeout: 20,
      pingReqTimeout: 60,
      pingReqGroupSize: 3,
      udp: {maxDgramSize: 512},
    }
    
    var swim = new Swim(opts)

    swim.on(Swim.EventType.Error, function(err) {
      if ('EADDRINUSE' === err.code && attempts < max_attempts) {
        attempts++
        setTimeout( 
          function() {
            join( instance, config, done )
          }, 
          100 + Math.floor(Math.random() * 222)
        )
        return
      }
      done(err)
    })


    // TODO: this is not being called!
    swim.on(Swim.EventType.Ready, function(){
      //console.log('READY')
      done( null, config )
    })

    var remotes = _.compact(options.remotes)

    swim.bootstrap( remotes, function onBootstrap(err) {
      if (err) {
        return console.log(err)
      }

      //console.log('START',swim.whoami(),swim.members())

      _.each( swim.members(), updateinfo )

      swim.on(Swim.EventType.Change, function onChange(info) {
        //console.log('CHANGE',info);
        //updateinfo(info)
      })

      swim.on(Swim.EventType.Update, function onUpdate(info) {
        console.log('UPDATE',info);
        updateinfo(info)
      })
      
    })


    function updateinfo( m ) {
      if( 0 === m.state ) {
        add_client( m.meta.listen )
      }
      else {
        remove_client( m.meta.listen )
      }
    }

    var balance_map = {}
    

    function add_client( config ) {
      var actmeta = instance.find( config.pin )

      // don't override local!
      if( actmeta && !actmeta.client ) {
        //console.log('NOTADD',config,actmeta)
        return
      }

      if( !balance_map[config.pin] ) {
        instance.client( {type:'balance', pin:config.pin} )
        balance_map[config.pin] = {}
      }

      var target_map = (balance_map[config.pin] = balance_map[config.pin] || {})

      var id = instance.util.pattern( _.compact(config) )

      target_map[id] = true

      instance.act( 
        'role:transport,type:balance,add:client', 
        {config:config} ) 

      //console.log( 'ADD', config, balance_map )
    }

    function remove_client( config ) {
      if( !balance_map[config.pin] ) {
        //console.log('RNF',config.pin)
        return
      }

      var target_map = balance_map[config.pin]

      var id = instance.util.pattern( _.compact(config) )

      if( !target_map[id] ) {
        //console.log('RTNF',id)
        return
      }

      delete target_map[id]

      instance.act( 
        'role:transport,type:balance,remove:client', 
        {config:config} ) 

      //console.log( 'REMOVE', config, balance_map )
    }
  }
}

