var Seneca = require('seneca')

var Hapi   = require('hapi')

Seneca({tag:'api'})
  .client({
    pin: 'role:color,format:hex',
    port: 9001
  })
  .client({
    pin: 'role:color,format:rgb',
    port: 9002
  })
  .ready(function () {
    var seneca = this
    var server = new Hapi.Server()

    server.connection({
      port: 8000
    })

    server.route({ 
      method: 'GET', 
      path: '/api/color/{format}', 
      handler: function( req, reply ){
        seneca.act(
          {
            role: 'color',
            format: req.params.format,
            color: req.query.color,
            },
          function(err,out) {
            reply(err||out)
          }
        )}
    })

    server.start( function () {
      console.log('api',server.info.host,server.info.port)
    })
  })



