// To run:
// $ node base.js

var HOST = process.env.HOST || process.argv[2]
var BASES = (process.env.BASES || process.argv[3] || '').split(',')
var PORT = process.env.PORT
var BROADCAST = process.env.BROADCAST
var REGISTRY = JSON.parse(process.env.REGISTRY || '{"active":false}')

require('seneca')({tag: 'b0'})
  .use('consul-registry', REGISTRY || {})
  .use('..', {
    isbase: true,
    host: HOST,
    port: PORT,
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

