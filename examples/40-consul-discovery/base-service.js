var Seneca = require('seneca'),
    Service = Seneca({tag: 'base'});

Service.use('consul-registry', {
    host: '127.0.0.1'
});

Service.use('../..', {
    isbase: true,
    port: 39002,
    discover: {
        multicast: {
            active: false
        }
    }
});

Service.ready(function (error) {
    if (error) {
        console.error(error);
        this.close();
        process.exit(1);
    }

    console.log('base', this.id);
});


