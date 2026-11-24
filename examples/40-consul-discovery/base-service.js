var Seneca = require('seneca')

Seneca({tag: 'base'})
  .use('@seneca/transport')
  .test('print')
  // seneca-consul-registry is a Seneca 3 plugin with no Seneca 4 release yet
  .use('consul-registry', {
    host: '127.0.0.1'
  })
  .use('../..', {
    isbase: true,
    port: 39002,
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
    console.log('base', this.id)
  })


