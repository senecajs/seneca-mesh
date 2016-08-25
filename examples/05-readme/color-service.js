var Seneca = require('seneca')

Seneca({log: 'test'})

  // provide an action for the format:hex pattern
  .add('format:hex', function (msg, done) {
    // red is the only color supported!
    var color = 'red' === msg.color ? '#FF0000' : '#FFFFFF'

    done(null, {
      color: color
    })
  })

  // load the mesh plugin
  .use('../..', {

    // this is a base node
    isbase: true,

    // this service will respond to the format:hex pattern
    pin: 'format:hex'
  })
