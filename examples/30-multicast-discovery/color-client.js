var Seneca = require('seneca'),
    Service = Seneca({tag: 'client', log: 'silent'});

Service.use('../..');

Service.ready(function (error) {

    if (error)return console.error(error);

    Service.act({
        role: 'color',
        format: process.argv[2] || 'hex',
        color: process.argv[3] || 'red'
    }, function (err, out) {
        if (err) {
            console.error(err);

        } else {
            console.log(out);
        }

        Service.close();
        process.exit(err ? 1 : 0);
    });
});