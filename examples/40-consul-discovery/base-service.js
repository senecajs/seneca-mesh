var Seneca = require('seneca')
var Service = Seneca({
  tag: 'base',
  log: 'info',
  debug: {
    undead: false,
    short_logs: false
  }
})

Service.use('consul-registry', {
  host: '127.0.0.1'
})

Service.use('../..', {
  isbase: true,
  port: 39002,
  discover: {
    multicast: {
      active: false
    }
  }
})

Service.ready(function (error) {
  if (error) {
    console.error(error)
    this.close()
    process.exit(1)
  }

  console.log('base', this.id)
})
