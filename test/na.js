require('seneca')()
  .use('..',{host:process.argv[3],remotes:[process.argv[4]]})
  .add('a:1',function(m){this.good({x:1,v:100+m.v})})
  .listen({port:process.argv[2]||46000,pin:'a:1'})
  .ready( function () {
    var si = this
    //setInterval( function() {
    //  si.act('b:1,v:2',console.log)
    //}, 5000 )
  })

