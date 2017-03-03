var Seneca = require('seneca')

Seneca({tag: 'rgb', log: 'silent'})
  .use('../..', {
    bases: ['127.0.0.1'],
    sneeze: {
      monitor: {
        active: true
      }
    }
  })

