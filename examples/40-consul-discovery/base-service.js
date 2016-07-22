var Seneca = require('seneca')

Seneca({tag:'base'})
  .use('consul-registry', {
    host: '127.0.0.1'
  })
  .use('../..', {
    isbase: true,
    port: 39002,
    discover: {
      multicast: false
    }
  })
  .ready(function () {
    console.log('base', this.id)
  })



