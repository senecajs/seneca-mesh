var Color = require('color');

module.exports = function rgb(options) {
    this.add('role:color,format:rgb', format_rgb);

    function format_rgb(msg, done) {
        done(null, {
            color: Color(msg.color).rgbString(),
            format: 'rgb'
        });
    }
};