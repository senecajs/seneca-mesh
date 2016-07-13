// To run:
// $ node service-foo.js

var HOST = process.env.HOST || process.argv[2]
var BASES = (process.env.BASES || process.argv[3] || '').split(',')

require('seneca')({tag:'bar'})
  .add( 'bar:1', function (msg, done) {
    done( null, {y:1,v:100+msg.v} )
  })
  .use('..', {
    host: HOST,
    bases: BASES,
    listen: [{
      pin: 'bar:1'
    }],
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
