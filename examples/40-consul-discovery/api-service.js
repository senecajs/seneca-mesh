var Seneca = require('seneca')

var Hapi = require('hapi')

Seneca({tag: 'api'})
  .test('print')
  .use('consul-registry', {
    host: '127.0.0.1'
  })
  .use('../..', {
    discover: {
      registry: {
        active: true
      },
      multicast: {
        active: false
      }
    }
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
      handler: function (req, reply) {
        seneca.act(
          {
            role: 'color',
            format: req.params.format,
            color: req.query.color
          },
          function (err, out) {
            reply(err || out)
          }
        ) }
    })

    server.start(function () {
      console.log('api', server.info.host, server.info.port)
    })
  })


