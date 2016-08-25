var Assert = require('assert')

var _ = require('lodash')
var Lab = require('lab')
var Seneca = require('seneca')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it


describe('#hex', function () {
  it('happy', function (done) {
    var next = _.after(3, done)
    var si = Seneca({log: 'test'}).error(next)

    si
      .use('../hex')
      .act('role:color, format:hex, color:red', function (err, out) {
        if (err) { done(err) }
        Assert.equal('hex', out.format)
        Assert.equal('#FF0000', out.color)
        next()
      })

      .act('role:color, format:hex, color:green', function (err, out) {
        if (err) { done(err) }
        Assert.equal('hex', out.format)
        Assert.equal('#008000', out.color)
        next()
      })

      .act('role:color, format:hex, color:blue', function (err, out) {
        if (err) { done(err) }
        Assert.equal('hex', out.format)
        Assert.equal('#0000FF', out.color)
        next()
      })
  })
})


