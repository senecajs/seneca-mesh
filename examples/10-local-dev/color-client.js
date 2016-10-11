var Seneca = require('seneca'),
    Service = Seneca({tag: 'client', log: 'silent'});

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
        console.error(error);
        this.close();
        process.exit(1);
    }

    // this is same as Service var
    this.act({
        role: 'color',
        format: process.argv[2] || 'hex',
        color: process.argv[3] || 'red'
    }, function (err, out) {
        console.log(err && err.message || out.color)
        this.close();
        process.exit(0);
    });s
});