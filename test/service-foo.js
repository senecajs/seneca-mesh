require('seneca')()
  .add( 'foo:1', function (msg, done) {
    done( null, {x:1,v:100+msg.v} )
  })
  .use('..', { auto:true, pin:'foo:1' })

  .ready( function () {
    var seneca = this

    setInterval( function() {
      seneca.act('bar:1,v:2', console.log)
    }, 3000 )
  })
