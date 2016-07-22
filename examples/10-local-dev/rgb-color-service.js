var Seneca = require('seneca')

Seneca({tag:'rgb'})
  .use('../logic/rgb')
  .listen({
    pin: 'role:color,format:rgb',
    port: 9002
  })
  .ready(function () {
    var seneca = this
    console.log('rgb',seneca.id)
  })


