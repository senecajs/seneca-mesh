var Seneca = require('seneca'),
    Service = Seneca({tag: 'hex'});

Service.use('../logic/hex');

Service.listen({
    pin: 'role:color,format:hex',
    port: 9001
});

Service.ready(function (error) {
    if (error) {
        console.error(error);
        this.close();
        process.exit(1);
    }

    var seneca = this;
    console.log('hex', seneca.id);
});