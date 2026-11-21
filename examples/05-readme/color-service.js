var Seneca = require('seneca')

Seneca()
  .use('@seneca/transport')
  // Uncomment to get detailed logs
  // .test('print')

  // provide an action for the format:hex pattern
  .add('format:hex', function (msg, reply) {
    // red is the only color supported!
    var color = 'red' === msg.color ? '#FF0000' : '#FFFFFF'

    reply({color: color})
  })

  // load the mesh plugin
  .use('../..', {

    // this is a base node
    isbase: true,

    // this service will respond to the format:hex pattern
    // (a base node takes its patterns from pins, not pin)
    pins: ['format:hex']
  })

  .listen(9001)
