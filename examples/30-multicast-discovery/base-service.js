var Seneca = require('seneca')

Seneca({tag: 'base'})
  .use('../..', {
    port: 39001,
    isbase: true
  })
  .ready(function () {
    console.log('base', this.id)
  })


