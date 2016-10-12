var Seneca = require('seneca')
var Service = Seneca({tag: 'hex'})

Service.use('consul-registry', {
  host: '127.0.0.1'
})

Service.use('../logic/hex')

Service.use('../..', {
  pin: 'role:color,format:hex',
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
  console.log('hex', seneca.id)
})
