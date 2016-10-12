var Seneca = require('seneca')
var Service = Seneca({tag: 'rgb'})

Service.use('../logic/rgb')

Service.listen({
  pin: 'role:color,format:rgb',
  port: 9002
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
