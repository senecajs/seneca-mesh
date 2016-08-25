var Seneca = require('seneca')

Seneca({tag: 'hex'})
  .use('../logic/hex')
  .listen({
    pin: 'role:color,format:hex',
    port: 9001
  })
  .ready(function () {
    var seneca = this
    console.log('hex', seneca.id)
  })


