var Seneca = require('seneca')

Seneca({tag: 'client', log: 'silent'})
  .use('../..', {
    bases: ['127.0.0.1']
  })
  .act(
  {
    role: 'color',
    format: process.argv[2] || 'hex',
    color: process.argv[3] || 'red'
  },
    function (err, out) {
      console.log(err && err.message || out.color)
      this.close()
    })


