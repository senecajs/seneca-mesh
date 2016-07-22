var Seneca = require('seneca')

Seneca({tag:'client', log:'silent'})
  .client({
    pin: 'role:color,format:hex',
    port: 9001
  })
  .client({
    pin: 'role:color,format:rgb',
    port: 9002
  })
  .act(
    {
      role: 'color',
      format: process.argv[2] || 'hex',
      color: process.argv[3] || 'red',
    }, 
    function (err, out) {
      console.log(err && err.message || out.color)
      this.close()
    })


