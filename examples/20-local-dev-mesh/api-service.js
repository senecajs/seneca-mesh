var Seneca = require('seneca')
var Hapi = require('hapi')
var Service = Seneca({tag: 'api'})

Service.use('../..', {
  isbase: true
})

Service.ready(function (error) {
  if (error) {
    console.error(error)
    this.close()
    process.exit(1)
  }
  var seneca = this
  var server = new Hapi.Server()

  server.connection({
    port: 8000
  })

  server.route({
    method: 'GET',
    path: '/api/color/{format}',
    handler: function (req, reply) {
      seneca.act(
        {
          role: 'color',
          format: req.params.format,
          color: req.query.color
        },
        function (err, out) {
          reply(err || out)
        }
      )
    }
  })

  server.start(function (error) {
    if (error) {
      console.error(error)
      Service.close()
      process.exit(1)
    }

    console.log('api', server.info.host, server.info.port)
  })
})
