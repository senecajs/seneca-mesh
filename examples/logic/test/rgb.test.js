var Assert = require('assert')

var _ = require('lodash')
var Lab = require('lab')
var Seneca = require('seneca')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it


describe('#rgb', function () {
  it('happy', function (done) {
    var next = _.after(3, done)
    var si = Seneca({log: 'test'}).error(next)

    si
      .use('../rgb')
      .act('role:color, format:rgb, color:red', function (err, out) {
        if (err) {
          done(err)
        }
        Assert.equal('rgb', out.format)
        Assert.equal('rgb(255, 0, 0)', out.color)
        next()
      })

      .act('role:color, format:rgb, color:green', function (err, out) {
        if (err) {
          done(err)
        }
        Assert.equal('rgb', out.format)
        Assert.equal('rgb(0, 128, 0)', out.color)
        next()
      })

      .act('role:color, format:rgb, color:blue', function (err, out) {
        if (err) {
          done(err)
        }
        Assert.equal('rgb', out.format)
        Assert.equal('rgb(0, 0, 255)', out.color)
        next()
      })
  })
})


