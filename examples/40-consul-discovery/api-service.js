var Seneca = require('seneca'),
    Hapi = require('hapi'),
    Service = Seneca({tag: 'api'});

Service.use('consul-registry', {
    host: '127.0.0.1'
});

Service.use('../..', {
    discover: {
        multicast: {
            active: false
        }
    }
});

Service.ready(function () {
    var seneca = this,
        server = new Hapi.Server();

    server.connection({
        port: 8000
    });

    server.route({
        method: 'GET',
        path: '/api/color/{format}',
        handler: function (req, reply) {
            seneca.act({
                role: 'color',
                format: req.params.format,
                color: req.query.color
            }, function (err, out) {
                reply(err || out);
            })
        }
    });

    server.start(function (error) {
        if (error) {
            console.error(error);
            process.exit(1);
        }
        console.log('api', server.info.host, server.info.port);
    });

});