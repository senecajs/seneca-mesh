require('seneca')({tag:'b0'})
  .use('@seneca/transport')
  .test()
  .add('b:0')
  .use('..',{
    pin:'b:0'
  })
