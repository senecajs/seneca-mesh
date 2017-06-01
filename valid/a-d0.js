require('seneca')({tag:'d0'})
  //.test('print')
  .add('d:0', function () {
    console.log('D0', this.did, this.fixedargs)
    throw new Error('d0')
  })
  .use('..',{
    pin:'d:*'
  })
