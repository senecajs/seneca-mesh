var Seneca = require('seneca')

Seneca({tag: 'hex'})
  .test('print')
  .use('../logic/hex')
  .use('../..', {
    pin: 'role:color,format:hex'
  })
  .ready(function () {
    var seneca = this
    console.log('hex', seneca.id)
  })


