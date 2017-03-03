var Seneca = require('seneca')

Seneca({tag: 'hex'})
  .test('print')
  .use('../logic/hex')
  .use('../..', {
    pin: 'role:color,format:hex',
    bases: ['127.0.0.1']
  })
  .ready(function () {
    var seneca = this
    console.log('hex', seneca.id)
  })


