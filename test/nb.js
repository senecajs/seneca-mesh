//require('seneca')()

require('seneca')({default_plugins:{transport:false}})
  .use('../node_modules/seneca-transport')

  .add('b:1',function(m){this.good({y:1,v:m.v})})
  .use('..',{auto:true,pin:'b:1'})

  .ready( function () {
    var si = this, i = 0
      setInterval( function() {
      si.act('a:1',{v:i++},console.log)
    }, 5000 )
  })

/*
  .use('..',{host:process.argv[2],remotes:[process.argv[3]]})
  .add('b:1',function(m){this.good({y:1,v:m.v})})
  .listen({port:46010,pin:'b:1'})
*/
