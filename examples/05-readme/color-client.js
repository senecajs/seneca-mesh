var Seneca = require('seneca')

Seneca({log: 'test'})

  // load the mesh plugin
  .use('../..')

  // send a message out into the network
  // the network will know where to send format:hex messages
  .act({format: 'hex', color: 'red'}, function (err, out) {
    if (err) { out(err) }
    // prints #FF0000
    console.log(out.color)

    // disconnect from the network
    this.close()
  })


