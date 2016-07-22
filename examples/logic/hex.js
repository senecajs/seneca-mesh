var Color = require('color')

module.exports = function hex (options) {

  this.add('role:color,format:hex', format_hex)

  function format_hex (msg, done) {
    done(null, {
      color: Color(msg.color).hexString(), 
      format: 'hex'
    })
  }
}
