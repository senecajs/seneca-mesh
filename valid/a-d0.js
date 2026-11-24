require('seneca')({tag:'d0'})
  .use('@seneca/transport')
  //.test('print')
  .add('d:0', function () {
    console.log('D0', this.did, this.fixedmsg)
    throw new Error('d0')
  })
  .use('..',{
    pin:'d:*'
  })
