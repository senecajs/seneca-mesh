var Seneca = require('seneca')

Seneca({tag: 'rgb'})
  .test('print')
  .use('consul-registry', {
    host: '127.0.0.1'
  })
  .use('../logic/rgb')
  .use('../..', {
    pin: 'role:color,format:rgb',
    discover: {
      registry: {
        active: true
      },
      multicast: {
        active: false
      }
    }
  })
  .ready(function () {
    var seneca = this
    console.log('rgb', seneca.id)
  })


