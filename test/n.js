require('seneca')({default_plugins:{transport:false}})
  .use('../node_modules/seneca-transport')

  .use('..',{base:true})

  //.use('..',{host:'127.0.0.1:48999'})
  //.listen()

