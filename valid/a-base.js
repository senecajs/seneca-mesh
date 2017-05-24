require('seneca')({tag:'base'})
  //.test('print')
  .use('..',{
    base:true,
    monitor:true
  })
