'use strict'

var HOST = process.env.HOST || process.argv[2]
var PORT = process.env.PORT || process.argv[3] || 8080
var BASES = (process.env.BASES || process.argv[4] || '').split(',')
var BROADCAST = process.env.BROADCAST
var REGISTRY = JSON.parse(process.env.REGISTRY || '{"active":false}')

var Seneca = require('seneca')

var Hapi = require('hapi')
var Chairo = require('chairo')

var seneca = Seneca({tag: 'api'})

seneca.use('consul-registry', REGISTRY || {})

seneca.use('..', {
  host: HOST,
  bases: BASES,
  discover: {
    multicast: {
      address: BROADCAST
    },
    registry: REGISTRY
  },
  dumpnet: false,
  sneeze: {
    silent: false
  }
})
  .ready(function () {
    seneca.act('role:mesh,get:bases', function (err, out) {
      if (err) return

      var server = new Hapi.Server()

      server.connection({
        host: HOST,
        port: PORT
      })

      server.register({
        register: Chairo,
        options: {
          seneca: seneca
        }
      })

      server.route({
        method: 'GET', path: '/api/{srv}',
        handler: function (req, reply) {
          server.seneca.act(
            req.params.srv + ':1',
            {v: req.query.v},
            function (err, out) {
              reply(err || out)
            }
          ) }
      })

      server.start(function () {
        console.log('api', server.info.host, server.info.port, out.bases)
      })
    })
  })


