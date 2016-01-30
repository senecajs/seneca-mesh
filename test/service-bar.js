require('seneca')({tag:'bar'})
  .add( 'bar:1', function (msg, done) {
    done( null, {y:1,v:100+msg.v} )
  })
  .use('..', { pin:'bar:1', sneeze:{silent:false} })

  .ready( function () {
    var seneca = this

    setInterval( function() {
      seneca.act('foo:1,v:1,default$:{}', console.log)
    }, 3000 )
  })
