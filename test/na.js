require('seneca')()
  .use('..',{host:process.argv[2],remotes:[process.argv[3]]})
  .add('a:1',function(m){this.good({x:1,v:100+m.v})})
  .listen({port:46000,pin:'a:1'})
  .ready( function () {
    var si = this
    setInterval( function() {
      si.act('b:1,v:2',console.log)
    }, 5000 )
  })

