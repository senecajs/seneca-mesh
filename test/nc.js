require('seneca')()
  .use('..',{host:process.argv[2],remotes:[process.argv[3]]})
  .add('c:1',function(m){this.good({y:1,v:m.v})})
  .listen({port:46020,pin:'c:1'})
  .ready( function () {
    var si = this
    setInterval( function() {
      si.act('b:1,v:3',console.log)
    }, 5000 )
  })
