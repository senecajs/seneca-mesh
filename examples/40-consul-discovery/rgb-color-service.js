var Seneca = require('seneca')

Seneca({tag:'rgb'})
  .use('consul-registry', {
    host: '127.0.0.1'
  })
  .use('../logic/rgb')
  .use('../..', {
    pin: 'role:color,format:rgb',
    discover: {
      multicast: false
    }
  })
  .ready(function () {
    var seneca = this
    console.log('rgb',seneca.id)
  })


