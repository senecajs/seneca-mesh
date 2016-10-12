var Seneca = require('seneca')
var Service = Seneca({log: 'test'})

// load the mesh plugin
Service.use('../..')

// When mesh is ready send an act
Service.ready(function (error) {
  if (error) {
    console.error(error)
    this.close()
  }

  // the network will know where to send format:hex messages
  // send a message out into the network
  this.act({format: 'hex', color: 'red'}, function (err, out) {
    if (err) {
      console.error(err)
    }
    else {
      // prints #FF0000
      console.log(out.color)
    }

    // disconnect from the network
    this.close()
    process.exit(err ? 1 : 0)
  })
})
