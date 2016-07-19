// To run:
// $ node service-foo.js

var HOST = process.env.HOST || process.argv[2]
var BASES = (process.env.BASES || process.argv[3] || '').split(',')
var BROADCAST = process.env.BROADCAST
var REGISTRY = JSON.parse(process.env.REGISTRY||false)

require('seneca')({tag:'bar'})
  .add( 'bar:1', function (msg, done) {
    done( null, {y:1,v:100+msg.v} )
  })
  .use('consul-registry',REGISTRY||{})
  .use('..', {
    pin: 'bar:1',
    host: HOST,
    bases: BASES,
    discover: {
      multicast: {
        address: BROADCAST,
      },
      registry: REGISTRY
    },
    dumpnet: false,
    sneeze: {
      silent: false
    } 
  })

  .ready( function () {
    var seneca = this

    setInterval( function() {
      seneca.act('foo:1,v:1,default$:{}', console.log)
    }, 3000 )
  })
