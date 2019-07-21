// To run:
// $ node service-foo.js

var HOST = process.env.HOST || process.argv[2]
var BASES = (process.env.BASES || process.argv[3] || '').split(',')
var BROADCAST = process.env.BROADCAST
var REGISTRY = JSON.parse(process.env.REGISTRY || '{"active":false}')

require('seneca')({ tag: 'foo', legacy: {transport: false} })
  .test()
  .add('foo:1', function(msg, done) {
    done(null, { x: 1, v: 100 + msg.v })
  })
  .add('zed:1', function(msg, done) {
    done(null, { z: 1, f: 1, v: 100 + msg.v })
  })
  .add('zed:1,q:1', function(msg, done) {
    done(null, { z: 1, f: 1, q:1, v: 100 + msg.v })
  })
  .use('consul-registry', REGISTRY || {})
  .use('..', {
    pin: 'foo:1',
    host: HOST,
    bases: BASES,
    override:true,
    discover: {
      multicast: {
        address: BROADCAST
      },
      registry: REGISTRY
    },
    dumpnet: false,
    sneeze: {
      silent: true
    }
  })
  .ready(function() {
    var seneca = this

    setInterval(function() {
      seneca.act('bar:1,v:2,default$:{}', seneca.util.print)
      seneca.act('zed:1,v:3,default$:{}', seneca.util.print)
      seneca.act('zed:1,q:1,v:4,default$:{}', seneca.util.print)
    }, 3000)
  })
