var Seneca = require('seneca')

Seneca({tag: 'rgb'})
  .use('@seneca/transport')
  .test('print')
  // seneca-consul-registry is a Seneca 3 plugin with no Seneca 4 release yet
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


