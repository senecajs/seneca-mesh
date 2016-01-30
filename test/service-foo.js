require('seneca')({tag:'foo'})
  .add( 'foo:1', function (msg, done) {
    done( null, {x:1,v:100+msg.v} )
  })
  .use('..', { pin:'foo:1', sneeze:{silent:false} })

  .ready( function () {
    var seneca = this

    setInterval( function() {
      seneca.act('bar:1,v:2,default$:{}', console.log)
    }, 3000 )
  })
