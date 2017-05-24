require('seneca')({tag:'b0'})
  .test()
  .add('b:0')
  .use('..',{
    pin:'b:0'
  })
