require('seneca')({tag:'c0'})
  .use('@seneca/transport')
  .test()
  .add('c:0')
  .use('..',{
    pin:'c:0'
  })
