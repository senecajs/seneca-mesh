var Seneca = require('seneca'),
    Service = Seneca({tag: 'base'});

// load the mesh plugin
Service.use('../..', {
    port: 39001,
    isbase: true
});

// When mesh is ready log service id
Service.ready(function (error) {
    if (error) {
        console.error(error);
        this.close();
        process.exit(1);
    }

    console.log('base', this.id);
});