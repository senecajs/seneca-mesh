var Seneca = require('seneca')

Seneca({log: 'silent'})
  .use('consul-registry', {
    host: '127.0.0.1'
  })
  .use('../..', {
    monitor: true,
    discover: {
      registry: {
        active: true
      },
      multicast: {
        active: false
      }
    }
  })


