var Seneca = require('seneca')

Seneca()
  // Uncomment to get detailed logs
  // .test('print')

  // load the mesh plugin
  .use('../..')

  // send a message out into the network
  // the network will know where to send format:hex messages
  .act({format: 'hex', color: 'red'}, function (err, out) {
    if (err) {
      console.log(err)
    }

    // prints #FF0000
    console.log(out && out.color)

    // disconnect from the network so that client process terminates
    this.close()
  })

