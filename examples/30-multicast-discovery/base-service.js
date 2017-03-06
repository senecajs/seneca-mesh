var Seneca = require('seneca')

Seneca({tag: 'base'})
  .test('print')
  .use('../..', {
    port: 39100,
    isbase: true
  })
  .ready(function () {
    console.log('base', this.id)
  })


