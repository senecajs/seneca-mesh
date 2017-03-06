var Seneca = require('seneca')

Seneca({tag: 'rgb'})
  .test('print')
  .use('../logic/rgb')
  .use('../..', {
    pin: 'role:color,format:rgb'
  })
  .ready(function () {
    var seneca = this
    console.log('rgb', seneca.id)
  })


