var Seneca = require('seneca')

Seneca({tag: 'rgb', log: 'silent'})
  .use('../..', {
    monitor: true
  })

