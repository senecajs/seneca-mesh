require('seneca')()
  .add( 'bar:1', function (msg, done) {
    done( null, {y:1,v:100+msg.v} )
  })
  .use('..', { auto:true, pin:'bar:1' })

  .ready( function () {
    var seneca = this

    setInterval( function() {
      seneca.act('foo:1,v:1', console.log)
    }, 3000 )
  })
