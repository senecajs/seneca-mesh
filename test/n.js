require('seneca')()
  .use('..',{host:'127.0.0.1:48999'})
  .listen()

