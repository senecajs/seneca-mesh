var Seneca = require('seneca')
var Service = Seneca({tag: 'client', log: 'silent'})

Service.use('../..', {
  bases: ['127.0.0.1']
})

Service.ready(function (error) {
  if (error) {
    console.error(error)
    this.close()
    process.exit(1)
  }

  this.act(
    {
      role: 'color',
      format: process.argv[2] || 'hex',
      color: process.argv[3] || 'red'
    },
    function (err, out) {
      console.log(err && err.message || out.color)
      this.close()
      process.exit(0)
    })
})
