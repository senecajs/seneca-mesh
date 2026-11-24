/*
  Vendored from sneeze 3.0.0 (https://github.com/rjrodger/sneeze,
  commit 2dc3f49db92eaafaa1175b4deebdd3dd2a704a5f, tag v3.0.0,
  test/sneeze.test.js). MIT License, Copyright (c) 2016 Richard Rodger;
  see lib/sneeze.LICENSE.
  Local changes: moved from lab and code to node:test and node:assert; the
  monitor test is removed with the monitor, and its check of the v option
  is kept as options-v; the edges test checks the plain option defaults
  and leaves its orphan node; the leave and tag tests wait for the
  membership outcome instead of a fixed time; every node leaves after its
  test.
*/
'use strict'

var Assert = require('node:assert')
var { afterEach, describe, test } = require('node:test')

var _ = require('lodash')

var SneezeModule = require('../lib/sneeze')

// Every node that a test creates leaves after the test, also when the test
// fails, so that its fixed ports are free for the next test.
var nodes = []

function Sneeze(options) {
  var node = SneezeModule(options)
  nodes.push(node)
  return node
}

afterEach(function () {
  nodes.forEach(function (node) {
    node.leave()
  })
  nodes = []
})

const it = make_it()

var tmx = parseInt(process.env.TIMEOUT_MULTIPLIER || 1, 10)

describe('sneeze', function () {
  it('happy', { timeout: 5555 * tmx }, function (fin) {
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
      Assert.deepStrictEqual(
        log.sort(),
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
      Assert.equal(40000 <= p && p < 50000, true)
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

    Assert.equal(s1.makeport(), 33333)
    Assert.deepStrictEqual(log, [['hello1']])

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

    Assert.equal(s2.makeport(), 22222)
    Assert.match(log[0][0], /hello2/)

    done()
  })

  it('collision', { timeout: 5555 * tmx }, function (done) {
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

  it('identifier', { timeout: 5555 * tmx }, function (done) {
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

  it('leave', { timeout: 5555 * tmx }, function (done) {
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

      // base and nodeB each remove A, after their failure detectors time
      // out (the original waited a fixed 999 ms)
      wait_until(
        function () {
          return 8 <= log.length
        },
        function () {
          // console.log(log)
          Assert.equal(log.length, 8)

          base.leave()
          nodeB.leave()
          setTimeout(done, 111 * tmx)
        }
      )
    })
  })

  it('tag', { timeout: 5555 * tmx }, function (done) {
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

    wait_ready([base, nodeA_foo, nodeA_bar, nodeB_foo, nodeB_bar], function () {
      // wait for the membership to settle (the original waited 333 ms)
      wait_until(function () {
        return (
          4 === _.keys(base.members()).length &&
          1 === _.keys(nodeA_foo.members()).length &&
          1 === _.keys(nodeB_foo.members()).length &&
          1 === _.keys(nodeA_bar.members()).length &&
          1 === _.keys(nodeB_bar.members()).length
        )
      }, check)
    })

    function check() {
      Assert.deepStrictEqual(_.keys(base.members()).sort(), [
        'bar-A',
        'bar-B',
        'foo-A',
        'foo-B',
      ])
      Assert.deepStrictEqual(_.keys(nodeA_foo.members()).sort(), ['foo-B'])
      Assert.deepStrictEqual(_.keys(nodeB_foo.members()).sort(), ['foo-A'])
      Assert.deepStrictEqual(_.keys(nodeA_bar.members()).sort(), ['bar-B'])
      Assert.deepStrictEqual(_.keys(nodeB_bar.members()).sort(), ['bar-A'])

      base.leave()
      nodeA_foo.leave()
      nodeB_foo.leave()
      nodeA_bar.leave()
      nodeB_bar.leave()
      done()
    }
  })

  it('multi-base', { timeout: 7777 * tmx }, function (done) {
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
          Assert.equal(3 <= _.keys(b0.members()).length, true)

          b0.leave()

          setTimeout(function () {
            nC.join({ name: 'nC' })

            wait_ready([nC], function () {
              Assert.equal(3 <= _.keys(nA.members()).length, true)

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

  it('edges', { timeout: 7777 * tmx }, function (done) {
    Assert.throws(function () {
      Sneeze({ silent: 'qqq' })
    }, /silent must be a boolean/)

    Assert.throws(function () {
      Sneeze({ bases: '127.0.0.1:39999' })
    }, /bases must be an array/)

    // an undefined option takes its default, an array replaces the default
    var defaulted = Sneeze({ host: void 0, port: void 0, port_range: [7, 8] })
    Assert.equal(defaulted.makeport(), 7)

    var orphan = Sneeze({
      retry_attempts: 3,
      retry_max: 112,
      bases: ['127.0.0.1:39998'],
    }).join()

    setTimeout(function () {
      Assert.equal(orphan.info, void 0)
      orphan.leave()
      done()
    }, 777 * tmx)
  })

  it('options-v', { timeout: 7777 * tmx }, function (done) {
    var base = Sneeze({ isbase: true, v: 1 }).join({ foo: 'bar' })
    var node = Sneeze({ v: 2 }).join()

    wait_ready([base, node], function () {
      Assert.equal(base.info.local.meta.v$, 1)
      Assert.equal(node.info.local.meta.v$, 2)

      base.leave()
      node.leave()
      done()
    })
  })
})

// Call done once check() is true, testing every 50 ms; the test timeout
// bounds the wait.
function wait_until(check, done) {
  if (check()) {
    return done()
  }
  setTimeout(wait_until, 50, check, done)
}

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

// The callback of a test may be called more than once (for example by
// several error handlers); only the first call counts.
function make_it() {
  return function it(name, opts, func) {
    if ('function' === typeof opts) {
      func = opts
      opts = {}
    }

    test(name, opts, function (t, fin) {
      var called = false
      func(function (err) {
        if (!called) {
          called = true
          fin(err)
        }
      })
    })
  }
}
