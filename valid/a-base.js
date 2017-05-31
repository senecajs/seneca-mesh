require('seneca')({tag:'base'})
  //.test('print')
  .use('seneca-repl')
  .use('..',{
    base:true,
    monitor:true
  })

