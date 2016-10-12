var Seneca = require('seneca')
var Service = Seneca({tag: 'rgb'})

Service.use('consul-registry', {
  host: '127.0.0.1'
})

Service.use('../logic/rgb')

Service.use('../..', {
  pin: 'role:color,format:rgb',
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

  var seneca = this
  console.log('rgb', seneca.id)
})
