require('seneca')({tag:'base'})
  .use('@seneca/transport')
  //.test('print')
  // optional REPL, not a dependency of this package:
  // .use('@seneca/repl')
  .use('..',{
    base:true
  })

