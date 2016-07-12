// To run:
// $ node service-foo.js

var HOST = process.env.HOST || process.argv[2] || '127.0.0.1'
var BASES = (process.env.BASES || process.argv[3] || '127.0.0.1:39000').split(',')

require('seneca')({tag:'foo'})
  .add( 'foo:1', function (msg, done) {
    done( null, {x:1,v:100+msg.v} )
  })
  .use('..', { 
    host: HOST,
    bases: BASES,
    listen: [{
      pin: 'foo:1'
    }],
    sneeze: {
      silent: false
    } 
  })

  .ready( function () {
    var seneca = this

    setInterval( function() {
      seneca.act('bar:1,v:2,default$:{}', console.log)
    }, 3000 )
  })
