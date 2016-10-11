var Seneca = require('seneca'),
    Hapi = require('hapi'),
    Service = Seneca({tag: 'api'});

Service.client({
    pin: 'role:color,format:hex',
    port: 9001
});

Service.client({
    pin: 'role:color,format:rgb',
    port: 9002
});

Service.ready(function (error) {
    if (error) {
        this.close();
        return process.exit(1);
    }

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
                reply(err || out).code(err ? 500 : 200);
            });
        }
    });

    server.start(function (error) {
        if (error) {
            console.error(error);
            Service.close();
            process.exit(1);
        }

        console.log('api', server.info.host, server.info.port);
    });
});