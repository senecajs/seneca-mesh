require('seneca')({tag:'c0'})
  .test()
  .add('c:0')
  .use('..',{
    pin:'c:0'
  })
