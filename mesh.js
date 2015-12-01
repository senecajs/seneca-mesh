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

  // merge default options with any provided by the caller
  options = seneca.util.deepextend({
    host: '127.0.0.1:4'+(9000+Math.floor((Date.now()/10)%1000)),
    remotes: ['127.0.0.1:48999']
  }, options)

  // TODO: hmm?
  seneca.use('balance-client')

  seneca.add( 'role:transport,cmd:listen', transport_listen )

  function transport_listen ( msg, done ) {
    this.prior( msg, function( err, out ) {
      if( !err ) {
        // TODO: pins?
        join( this, msg.config )
      }
      done( err, out )
    })
  }

  function join( instance, config ) {
    if( !config.pin ) {
      config.pin = 'null:true'
    }

    //console.log('JOIN',config)

    var meta = {
      who: options.host,
      listen: config
    }

    var opts = {
      local: {
        host: options.host,
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

    swim.on(Swim.EventType.Error, console.log)
    swim.on(Swim.EventType.Ready, console.log)

    var remotes = _.compact(options.remotes)

    swim.bootstrap( remotes, function onBootstrap(err) {
      if (err) {
        return console.log(err)
      }

      //console.log('START',swim.whoami(),swim.members())

      _.each( swim.members(), updateinfo )

      swim.on(Swim.EventType.Change, function onChange(info) {
        //console.log('CHANGE',info);
        updateinfo(info)
      })

      swim.on(Swim.EventType.Update, function onUpdate(info) {
        //console.log('UPDATE',info);
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

