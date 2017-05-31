require('seneca')({tag:'d0'})
  .test('print')
  .add('d:0', function () {
    throw new Error('d0')
  })
  .use('..',{
    pin:'d:*'
  })
