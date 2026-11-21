'use strict'

var Util = require('util')

var _ = require('lodash')

var Sneeze = require('..')

const Code = require('@hapi/code')
const Lab = require('@hapi/lab')

const lab = (exports.lab = Lab.script())
const describe = lab.describe
const it = make_it(lab)
const expect = Code.expect

var tmx = parseInt(process.env.TIMEOUT_MULTIPLIER || 1, 10)

describe('sneeze', function () {
  it('happy', { parallel: false, timeout: 5555 * tmx }, function (fin) {
    var log = []
    var append = function (tag) {
      return function (arg) {
        log.push(tag + '~' + arg.name)
      }
    }

    var base = Sneeze({ isbase: true })
    base.on('add', append('a0'))
    base.on('remove', append('r0'))
    base.on('error', fin)
    base.join({ name: '0' })

    var nodeA = Sneeze({ port: 44444 })
    nodeA.on('add', append('aA'))
    nodeA.on('remove', append('rA'))
    nodeA.on('error', fin)
    nodeA.join({ name: 'A' })

    var nodeB = Sneeze()
    nodeB.on('add', append('aB'))
    nodeB.on('remove', append('rB'))
    nodeB.on('error', fin)
    nodeB.join({ name: 'B' })

    wait_ready([base, nodeA, nodeB], function () {
      expect(log.sort()).to.equal(
        ['a0~A', 'a0~B', 'aA~0', 'aA~B', 'aB~A', 'aB~0'].sort()
      )

      base.leave()
      nodeA.leave()
      nodeB.leave()
      setTimeout(fin, 555 * tmx)
    })
  })

  it('methods', function (done) {
    var s0 = Sneeze()
    s0.log('vanish')

    for (var i = 0; i < 22222; ++i) {
      var p = s0.makeport()
      expect(40000 <= p && p < 50000).to.equal(true)
    }

    s0.leave()

    var log = []
    var s1 = Sneeze({
      port: 33333,
      silent: false,
      log: function () {
        log.push(Array.prototype.slice.call(arguments))
      },
    })
    s1.log('hello1')

    expect(s1.makeport()).to.equal(33333)
    expect(log).to.equal([['hello1']])

    log = []
    var origwrite = process.stdout.write
    process.stdout.write = function () {
      log.push(arguments)
    }
    var s2 = Sneeze({
      port: function () {
        return 22222
      },
      silent: false,
    })
    s2.log('hello2')
    process.stdout.write = origwrite

    expect(s2.makeport()).to.equal(22222)
    expect(log[0][0]).to.contain('hello2')

    done()
  })

  it('collision', { parallel: false, timeout: 5555 * tmx }, function (done) {
    var base = Sneeze({ isbase: true })
    base.on('error', function (err) {
      done()
    })
    base.join({ name: '0' })

    var nodeA = Sneeze({ port: 44444 })
    nodeA.on('error', function (err) {
      done(err)
    })
    nodeA.join()

    var nodeB = Sneeze({
      port: 44444,
      retry_min: 10,
      retry_max: 20,
      silent: true,
    })

    nodeB.on('error', function () {
      base.leave()
      nodeA.leave()
      done()
    })

    nodeB.join()
  })

  it('identifier', { parallel: false, timeout: 5555 * tmx }, function (done) {
    var base = Sneeze({ isbase: true, identifier: '0' })
    base.on('error', done)
    base.join({ name: '0' })

    var nodeA = Sneeze({ identifier: 'q' })
    nodeA.on('error', done)
    nodeA.join({ name: 'A' })

    var nodeB = Sneeze({ identifier: 'q' })
    nodeB.on('error', done)
    nodeB.join({ name: 'B' })

    wait_ready([base, nodeA, nodeB], function () {
      base.leave()
      nodeA.leave()
      nodeB.leave()
      done()
    })
  })

  it('leave', { parallel: false, timeout: 5555 * tmx }, function (done) {
    var log = [],
      append = function (tag) {
        return function (arg) {
          log.push(tag + '~' + arg.name)
        }
      }

    var base = Sneeze({
      isbase: true,
      swim: {
        interval: 55,
        suspectTimeout: 111,
        pingTimeout: 111,
        pingReqTimeout: 111,
      },
    })

    base.on('add', append('a0'))
    base.on('remove', append('r0'))
    base.on('error', done)
    base.join({ name: '0' })

    var nodeA = Sneeze({ port: 44444 })
    nodeA.on('add', append('aA'))
    nodeA.on('remove', append('rA'))
    nodeA.on('error', done)
    nodeA.join({ name: 'A' })

    var nodeB = Sneeze()
    nodeB.on('add', append('aB'))
    nodeB.on('remove', append('rB'))
    nodeB.on('error', done)
    nodeB.join({ name: 'B' })

    wait_ready([base, nodeA, nodeB], function () {
      nodeA.leave()

      setTimeout(function () {
        // console.log(log)
        expect(log.length).to.equal(8)

        base.leave()
        nodeB.leave()
        setTimeout(done, 111 * tmx)
      }, 999 * tmx)
    })
  })

  it('tag', { parallel: false, timeout: 5555 * tmx }, function (done) {
    var base = Sneeze({ isbase: true, silent: true, identifier: 'foo-0' })
    base.on('error', done)
    base.join({ name: 'foo-0' })

    var nodeA_foo = Sneeze({ silent: true, tag: 'foo', identifier: 'foo-A' })
    nodeA_foo.on('error', done)
    nodeA_foo.join({ name: 'foo-A' })

    var nodeB_foo = Sneeze({ silent: true, tag: 'foo', identifier: 'foo-B' })
    nodeB_foo.on('error', done)
    nodeB_foo.join({ name: 'foo-B' })

    var nodeA_bar = Sneeze({ silent: true, tag: 'bar', identifier: 'bar-A' })
    nodeA_bar.on('error', done)
    nodeA_bar.join({ name: 'bar-A' })

    var nodeB_bar = Sneeze({ silent: true, tag: 'bar', identifier: 'bar-B' })
    nodeB_bar.on('error', done)
    nodeB_bar.join({ name: 'bar-B' })

    wait_ready(
      [base, nodeA_foo, nodeA_bar, nodeB_foo, nodeB_bar],
      function () {
        expect(_.keys(base.members()).sort()).to.equal([
          'bar-A',
          'bar-B',
          'foo-A',
          'foo-B',
        ])
        expect(_.keys(nodeA_foo.members()).sort()).to.equal(['foo-B'])
        expect(_.keys(nodeB_foo.members()).sort()).to.equal(['foo-A'])
        expect(_.keys(nodeA_bar.members()).sort()).to.equal(['bar-B'])
        expect(_.keys(nodeB_bar.members()).sort()).to.equal(['bar-A'])

        base.leave()
        nodeA_foo.leave()
        nodeB_foo.leave()
        nodeA_bar.leave()
        nodeB_bar.leave()
        done()
      },
      666 * tmx
    )
  })

  it('multi-base', { parallel: false, timeout: 7777 * tmx }, function (done) {
    var silent = true
    var bases = ['127.0.0.1:39000', '127.0.0.1:39001']

    var b0 = Sneeze({
      isbase: true,
      silent: silent,
      identifier: 'b0',
      host: '127.0.0.1',
      port: 39000,
      bases: bases,
    })
    //b0.on('error',done)
    b0.join({ name: 'b0' })

    var b1 = Sneeze({
      isbase: true,
      silent: silent,
      identifier: 'b1',
      host: '127.0.0.1',
      port: 39001,
      bases: bases,
    })
    //b1.on('error',done)

    var nA = Sneeze({ silent: silent, identifier: 'A', bases: bases })
    //nA.on('error',done)
    nA.join({ name: 'A' })

    var nB = Sneeze({ silent: silent, identifier: 'B', bases: [bases[1]] })
    //nB.on('error',done)
    nB.join({ name: 'B' })

    var nC = Sneeze({ silent: silent, identifier: 'C', bases: [bases[1]] })
    //nC.on('error',done)
    nC.join({ name: 'C' })

    wait_ready([b0, nA], function () {
      b1.join({ name: 'b1' })

      wait_ready([b1], function () {
        nB.join({ name: 'nB' })

        wait_ready([nB], function () {
          expect(3 <= _.keys(b0.members()).length).to.equal(true)

          b0.leave()

          setTimeout(function () {
            nC.join({ name: 'nC' })

            wait_ready([nC], function () {
              expect(3 <= _.keys(nA.members()).length).to.equal(true)

              b1.leave()
              nA.leave()
              nB.leave()
              nC.leave()

              done()
            })
          }, 666 * tmx)
        })
      })
    })
  })

  it('edges', { parallel: false, timeout: 7777 * tmx }, function (done) {
    try {
      Sneeze({ silent: 'qqq' })
      done(new Error('optioner should fail'))
    } catch (e) {}

    var orphan = Sneeze({ retry_attempts: 3, retry_max: 112 }).join()

    setTimeout(function () {
      expect(orphan.info).to.equal(void 0)
      done()
    }, 777 * tmx)
  })

  it('monitor', { parallel: false, timeout: 7777 * tmx }, function (done) {
    var base = Sneeze({ isbase: true, v: 1 }).join({ foo: 'bar' })
    var monitor = Sneeze({
      monitor: { active: true, meta: ['foo'] },
      v: 2,
    }).join()

    setTimeout(function () {
      expect(base.info).to.exist()
      expect(base.info.local.meta.v$).to.equal(1)

      expect(monitor.info).to.exist()
      expect(monitor.info.local.meta.v$).to.equal(2)

      base.leave()

      setTimeout(function () {
        monitor.leave()
        done()
      }, 222 * tmx)
    }, 1111 * tmx)
  })
})

function wait_ready(nodes, done) {
  var node,
    count = nodes.length
  while ((node = nodes.shift())) {
    node.on('ready', function () {
      count--
      if (0 === count) setTimeout(done, 333 * tmx)
    })
  }
}

function make_it(lab) {
  return function it(name, opts, func) {
    if ('function' === typeof opts) {
      func = opts
      opts = {}
    }

    lab.it(
      name,
      opts,
      Util.promisify(function (x, fin) {
        func(fin)
      })
    )
  }
}
