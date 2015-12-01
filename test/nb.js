require('seneca')()
  .use('..',{host:process.argv[2],remotes:[process.argv[3]]})
  .add('b:1',function(m){this.good({y:1,v:m.v})})
  .listen({port:46010,pin:'b:1'})
  .ready( function () {
    var si = this
    setInterval( function() {
      si.act('a:1,v:1',console.log)
    }, 5000 )
  })
