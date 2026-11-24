/* MIT License. Copyright (c) 2015-2026, Richard Rodger and other contributors. */

'use strict'

var Assert = require('node:assert')
var { afterEach, describe, test } = require('node:test')

var Seneca = require('seneca')
var Rif = require('rif')

var Codec = require('../lib/swim/codec')
var Member = require('../lib/swim/member')

// Set TIMEOUT_MULTIPLIER to run on slow machines.
var tmx = parseInt(process.env.TIMEOUT_MULTIPLIER || 1, 10)

// The one test that uses the default discovery, with multicast (UDP
// broadcast), runs only when SENECA_MESH_TEST_MULTICAST is set.
var test_multicast = !!process.env.SENECA_MESH_TEST_MULTICAST

var Mesh = require('..')

var intern = Mesh.intern

// Every node of these tests is on the loopback interface. Multicast
// discovery is off, as it broadcasts to the network (see the opt-in test).
var HOST = '127.0.0.1'

var test_discover = {
  stop: true,
  guess: { active: true },
  multicast: { active: false },
  registry: { active: false },
}

// Every instance that a test creates is closed after the test, also when
// the test fails, so that its ports are free for the next test.
var instances = []

function make_seneca(seneca_opts, fin) {
  var si = Seneca(seneca_opts).test(fin).use('@seneca/transport')
  instances.push(si)
  return si
}

async function close_instances() {
  var open = instances
  instances = []
  await Promise.all(
    open.map(function (si) {
      return new Promise(function (resolve) {
        si.close(function () {
          resolve()
        })
      })
    })
  )
}

function mesh_opts(opts) {
  return Object.assign({ host: HOST, discover: test_discover }, opts)
}

describe('#mesh', function () {
  afterEach(close_instances)

  test('nextgen-single-with-base', { timeout: 5555 * tmx }, function (t, fin) {
    var b0 = make_seneca({ tag: 'b0' }, fin).use(
      Mesh,
      mesh_opts({ base: true })
    )

    var s0 = make_seneca({ tag: 's0' }, fin).add('a:1', function (msg, reply) {
      reply({ x: msg.x })
    })

    b0.ready(function () {
      s0.use(Mesh, mesh_opts({ pin: 'a:1' })).ready(function () {
        b0.act('a:1,x:0', function (ignore, out) {
          Assert.equal(0, out.x)

          b0.act('a:1,x:1', function (ignore, out) {
            Assert.equal(1, out.x)

            close(fin, 777, s0, b0)
          })
        })
      })
    })
  })

  test('intern.resolve_bases', function () {
    var rif = make_rif()

    Assert.equal('', '' + intern.resolve_bases())

    Assert.equal(
      Mesh.DEFAULT_HOST +
        ':' +
        Mesh.DEFAULT_PORT +
        ',192.168.1.2:' +
        Mesh.DEFAULT_PORT,
      '' +
        intern.resolve_bases(
          [':' + Mesh.DEFAULT_PORT],
          { host: '192.168.1.2' },
          rif
        )
    )

    Assert.equal(
      'foo:' + Mesh.DEFAULT_PORT + ',' + 'bar:' + Mesh.DEFAULT_PORT,
      '' + intern.resolve_bases(['foo', 'bar'], null, rif)
    )

    Assert.equal(
      Mesh.DEFAULT_HOST + ':33333',
      '' + intern.resolve_bases([':33333'], null, rif)
    )

    Assert.equal(
      Mesh.DEFAULT_HOST + ':33333,' + 'zed:33333',
      '' + intern.resolve_bases([':33333'], { host: 'zed' }, rif)
    )

    Assert.equal(
      '127.0.0.1:' + Mesh.DEFAULT_PORT,
      '' + intern.resolve_bases(['@lo'], null, rif)
    )
  })

  test('intern.make_pin_config', async function () {
    var si = Seneca({ log: 'silent' })

    Assert.deepStrictEqual(
      intern.make_pin_config(si, { identifier$: 'i0' }, 'a:1', {
        pin: 'a:1',
        x: 1,
      }),
      {
        id: 'pin:a:1,x:1~i0',
        pin: 'a:1',
        x: 1,
      }
    )

    Assert.deepStrictEqual(
      intern.make_pin_config(si, { identifier$: 'i0' }, 'a:1', {
        pins: [{ a: 1 }, 'b:1'],
        x: 1,
      }),
      {
        id: 'pin:a:1,x:1~i0',
        pin: 'a:1',
        x: 1,
      }
    )

    await si.close()
  })

  test('intern.resolve_pins', async function () {
    var si = Seneca({ log: 'silent' })

    function rp(config, expected) {
      Assert.deepStrictEqual(intern.resolve_pins(si, config), expected)
    }

    rp({ pin: 'a:1' }, ['a:1'])
    rp({ pin: { a: 1 } }, ['a:1'])
    rp({ pins: 'a:1' }, ['a:1'])
    rp({ pins: { a: 1 } }, ['a:1'])
    rp({ pin: ['a:1'] }, ['a:1'])
    rp({ pin: [{ a: 1 }] }, ['a:1'])
    rp({ pins: ['a:1'] }, ['a:1'])
    rp({ pins: [{ a: 1 }] }, ['a:1'])
    rp({ pin: 'a:1,b:2' }, ['a:1,b:2'])
    rp({ pin: 'b:2,a:1' }, ['a:1,b:2'])
    rp({ pin: 'a:1;b:2' }, ['a:1', 'b:2'])
    rp({ pin: 'b:2;a:1' }, ['b:2', 'a:1'])
    rp({ pin: 'a:1;a:1' }, ['a:1', 'a:1'])
    rp({ pins: 'a:1;b:2' }, ['a:1', 'b:2'])
    rp({ pins: ['a:1;b:2'] }, ['a:1', 'b:2'])
    rp({ pins: [{ a: 1 }, { b: 2 }] }, ['a:1', 'b:2'])
    rp({ pins: ['a:1', 'b:2'] }, ['a:1', 'b:2'])
    rp({ pin: 'a:1,b:2;c:3' }, ['a:1,b:2', 'c:3'])
    rp({ pin: 'c:3;a:1,b:2' }, ['c:3', 'a:1,b:2'])

    await si.close()
  })

  test('intern.broadcast_address', function () {
    var ba = intern.broadcast_address
    Assert.equal('192.168.1.255', ba('192.168.1.5', 24))
    Assert.equal('10.255.255.255', ba('10.1.2.3', 8))
    Assert.equal('172.16.15.255', ba('172.16.10.1', 20))
    Assert.equal('127.255.255.255', ba('127.0.0.1', 8))
    Assert.equal('10.1.2.3', ba('10.1.2.3', 32))
    Assert.equal('255.255.255.255', ba('10.1.2.3', 0))
    Assert.throws(() => ba(void 0, 24), /IPv4 host/)
    Assert.throws(() => ba('::1', 64), /IPv4 host/)
    Assert.throws(() => ba('10.1.2.300', 24), /IPv4 host/)
    Assert.throws(() => ba('10.1.2.3', 33), /IPv4 host/)
  })

  test('intern.json_safe', function () {
    var when = new Date(0)
    var circ = { a: 1 }
    circ.self = circ

    Assert.deepStrictEqual(
      intern.json_safe({
        a: 1,
        b: 'x',
        c: [1, { d: true }],
        f: function () {},
        u: void 0,
        n: null,
        when: when,
        tojson: {
          toJSON: function () {
            return 'J'
          },
        },
      }),
      {
        a: 1,
        b: 'x',
        c: [1, { d: true }],
        n: null,
        when: '1970-01-01T00:00:00.000Z',
        tojson: 'J',
      }
    )

    Assert.deepStrictEqual(intern.json_safe(circ), { a: 1 })
  })

  test('member-record-codec', async function () {
    // A member record as mesh and sneeze build it, through the membership
    // codec (MessagePack), as it travels between nodes.
    var si = Seneca({ log: 'silent' })
    var config = si.util.clean({
      pin: 'a:1,b:2',
      model: 'consume',
      type: 'web',
      host: '127.0.0.1',
      port: 54321,
      ismesh: true,
      path: '/act',
      when: new Date(0),
      func: function () {},
    })

    var meta = intern.json_safe({
      config: config,
      instance: si.id,
    })
    meta.identifier$ = si.id + '~a:1,b:2~1700000000000'
    meta.tag$ = 'seneca~mesh'
    meta.v$ = 0

    var member = new Member({
      meta: meta,
      host: '127.0.0.1:45678',
      state: Member.State.Alive,
      incarnation: 1700000000000,
    })

    var codec = new Codec()
    var buffer = codec.encode(member.data())
    Assert.ok(Buffer.isBuffer(buffer))

    var data = codec.decode(buffer)
    Assert.deepStrictEqual(data, member.data())
    Assert.equal(data.meta.config.when, '1970-01-01T00:00:00.000Z')
    Assert.equal(data.meta.config.func, void 0)

    var entry = intern.default_make_entry(data)
    Assert.deepStrictEqual(entry, {
      pin: 'a:1,b:2',
      port: 54321,
      host: '127.0.0.1',
      type: 'web',
      model: 'consume',
      instance: si.id,
    })

    // The codec does not take functions: mesh passes a JSON-safe copy.
    Assert.throws(() => codec.encode({ meta: { f: function () {} } }))

    await si.close()
  })

  test('options', async function () {
    // Seneca 4 checks the options against the declared defaults.
    async function load(opts) {
      var si = Seneca({ log: 'silent', debug: { undead: true } })
      var err = null
      await new Promise(function (resolve) {
        si.error(function (e) {
          err = err || e
          resolve()
        })
        si.use('@seneca/transport').use(Mesh, opts)
        si.ready(function (e) {
          err = err || e
          resolve()
        })
      })
      await si.close()
      return err
    }

    // removed in 2.0.0, with the sneeze monitor
    var err = await load(mesh_opts({ isbase: true, monitor: true }))
    Assert.equal(err.code, 'invalid_plugin_option')
    Assert.match(err.message, /monitor/)

    err = await load(mesh_opts({ isbase: true, port: 70000 }))
    Assert.equal(err.code, 'invalid_plugin_option')

    err = await load(mesh_opts({ isbase: true, make_entry: 'not-a-function' }))
    Assert.equal(err.code, 'invalid_plugin_option')

    // pass-through and nullable options
    err = await load(
      mesh_opts({
        isbase: true,
        port: 39931,
        tag: null,
        sneeze: { silent: true, swim: { interval: 222 } },
        balance_client: { debug: { client_updates: false } },
        netif: {},
        override: ['a:1'],
        make_entry: function custom_entry(member) {
          return member
        },
      })
    )
    Assert.equal(err, null)
  })

  test('base', { timeout: 5555 * tmx }, function (t, done) {
    make_seneca({ tag: 'b0a' }, done)
      .use(Mesh, mesh_opts({ isbase: true }))
      .ready(function () {
        this.close(setTimeout.bind(this, done, 555 * tmx))
      })
  })

  test('single-with-base', { timeout: 5555 * tmx }, function (t, done) {
    var b0b, s0b

    b0b = make_seneca({ tag: 'b0b' }, done).use(
      Mesh,
      mesh_opts({ isbase: true })
    )

    s0b = make_seneca({ tag: 's0b' }, done).add('a:1', function (msg, reply) {
      reply({ x: msg.i })
    })

    b0b.ready(function () {
      s0b.use(Mesh, mesh_opts({ pin: 'a:1' })).ready(function () {
        s0b.act('role:mesh,get:members', function (err, out) {
          if (err) {
            return done(err)
          }
          Assert.equal(1, out.list.length)

          b0b.act('a:1,i:0', function (err, out) {
            if (err) {
              return done(err)
            }
            Assert.equal(0, out.x)

            b0b.act('a:1,i:1', function (err, out) {
              if (err) {
                return done(err)
              }
              Assert.equal(1, out.x)

              s0b.close(
                b0b.close.bind(b0b, setTimeout.bind(this, done, 555 * tmx))
              )
            })
          })
        })
      })
    })
  })

  test('happy', { timeout: 9999 * tmx }, function (t, fin) {
    var b0, s0, s1, c0

    // base: true (deprecated alias of isbase) and sneeze options pass through
    b0 = make_seneca({ id$: 'b0' }, fin).use(
      Mesh,
      mesh_opts({
        base: true,
        sneeze: { silent: true },
      })
    )

    s0 = make_seneca({ id$: 's0' }, fin)
      .use(
        Mesh,
        mesh_opts({
          pin: 'a:1',
          sneeze: { silent: true },
        })
      )
      .add('a:1', function (m, r) {
        r({ x: 0 })
      })

    s1 = make_seneca({ id$: 's1' }, fin)
      .use(
        Mesh,
        mesh_opts({
          pin: 'a:1',
          sneeze: { silent: true },
        })
      )
      .add('a:1', function (m, r) {
        r({ x: 1 })
      })
      .add('a:1', function (m, r) {
        this.prior(m, r)
      })

    c0 = make_seneca({ id$: 'c0' }, fin).use(
      Mesh,
      mesh_opts({ sneeze: { silent: true } })
    )

    b0.ready(
      s0.ready.bind(
        s0,
        s1.ready.bind(
          s1,
          c0.ready.bind(c0, function () {
            c0.gate()
              .act(
                { role: 'transport', type: 'balance', get: 'target-map' },
                function (e, o) {
                  Assert.equal(o['a:1']['a:1'].targets.length, 2)
                }
              )

              .act({ role: 'mesh', get: 'members' }, function (e, o) {
                Assert.equal(o.list.length, 3)
              })

              .act('a:1,s:0', function (e, o) {
                Assert.equal(o.x, 0)
              })
              .act('a:1,s:1', function (e, o) {
                Assert.equal(o.x, 1)
              })
              .act('a:1,s:2', function (e, o) {
                Assert.equal(o.x, 0)
              })

              .ready(function () {
                b0.act('role:mesh,get:members', function (e, o) {
                  Assert.equal(o.list.length, 3)

                  s0.close(function () {
                    wait_targets([c0], 'a:1', 1, fin, function () {
                      c0.act('a:1,s:3', function (e, o) {
                        Assert.equal(o.x, 1)
                      })
                        .act('a:1,s:4', function (e, o) {
                          Assert.equal(o.x, 1)
                        })

                        .close(
                          s1.close.bind(
                            s1,
                            b0.close.bind(
                              b0,
                              setTimeout.bind(this, fin, 555 * tmx)
                            )
                          )
                        )
                    })
                  })
                })
              })
          })
        )
      )
    )
  })

  test('many-actors', { timeout: 19999 * tmx }, function (t, done) {
    var b0, s0, s1, s2, c0, c1

    b0 = make_seneca({ tag: 'b0' }, done)

    s0 = make_seneca({ tag: 's0' }, done).add('a:1', function (msg, reply) {
      reply({ x: msg.x + 1 })
    })

    s1 = make_seneca({ tag: 's1' }, done).add('a:1', function (msg, reply) {
      reply({ x: msg.x + 2 })
    })

    s2 = make_seneca({ tag: 's2' }, done).add('a:1', function (msg, reply) {
      reply({ x: msg.x + 3 })
    })

    c0 = make_seneca({ tag: 'c0' }, done)

    c1 = make_seneca({ tag: 'c1' }, done)

    b0.use(
      Mesh,
      mesh_opts({
        isbase: true,
        sneeze: { silent: true },
      })
    ).ready(function () {
      s0.use(
        Mesh,
        mesh_opts({
          pin: 'a:1',
          model: 'actor',
          sneeze: { silent: true },
        })
      ).ready(function () {
        s1.use(
          Mesh,
          mesh_opts({
            pin: 'a:1',
            model: 'actor',
            sneeze: { silent: true },
          })
        ).ready(function () {
          s2.use(
            Mesh,
            mesh_opts({
              pin: 'a:1',
              model: 'actor',
              sneeze: { silent: true },
            })
          ).ready(function () {
            c0.use(
              Mesh,
              mesh_opts({
                sneeze: { silent: true },
              })
            ).ready(function () {
              c1.use(
                Mesh,
                mesh_opts({
                  sneeze: { silent: true },
                })
              ).ready(setTimeout.bind(null, do_topology, 2222 * tmx))
            })
          })
        })
      })
    })

    function do_topology() {
      c0.act('role:mesh,get:members', function (err, o) {
        if (err) {
          return done(err)
        }
        Assert.equal(5, o.list.length)

        c1.act('role:mesh,get:members', function (err, o) {
          if (err) {
            return done(err)
          }
          Assert.equal(5, o.list.length)

          c0.act(
            'role:transport,type:balance,get:target-map,pg:"a:1"',
            function (err, c0map) {
              if (err) {
                return done(err)
              }
              Assert.equal(3, c0map['a:1'].targets.length)

              c1.act(
                'role:transport,type:balance,get:target-map,pg:"a:1"',
                function (err, c1map) {
                  if (err) {
                    return done(err)
                  }
                  Assert.equal(3, c1map['a:1'].targets.length)

                  do_actors()
                }
              )
            }
          )
        })
      })
    }

    // Each client sends round robin over the three services, in the order
    // in which it added them, so both clients see 1, 2, 3, 1, 2, 3.
    function round(expected, then) {
      var i = 0
      next()
      function next() {
        if (expected.length <= i) {
          return then()
        }
        var x = expected[i++]
        c0.act('a:1,x:0', function (e, o) {
          if (e) return done(e)
          Assert.equal(x, o.x)

          c1.act('a:1,x:0', function (e, o) {
            if (e) return done(e)
            Assert.equal(x, o.x)
            next()
          })
        })
      }
    }

    function do_actors() {
      round([1, 2, 3, 1, 2, 3], function () {
        s1.close(function () {
          wait_targets([c0, c1], 'a:1', 2, done, do_s1_down)
        })
      })
    }

    function do_s1_down() {
      round([1, 3, 1, 3, 1, 3], close_all)
    }

    function close_all() {
      c1.close()
      c0.close()
      s2.close()
      s0.close()
      b0.close()
      setTimeout(done, 2222 * tmx)
    }
  })

  test('observe-consume-basic', { timeout: 9999 * tmx }, function (t, done) {
    var b0, s0, s1, c0
    var s0x = 0
    var s1z = 0
    var s0y = []
    var s1y = []

    b0 = make_seneca({ tag: 'b0' }, done)

    s0 = make_seneca({ tag: 's0' }, done)
      .add('a:1', function (msg, reply) {
        reply({ x: msg.x + ++s0x })
      })
      .add('b:1', function (msg, reply) {
        s0y.push(msg.y)
        reply()
      })

    s1 = make_seneca({ tag: 's1' }, done)
      .add('b:1', function (msg, reply) {
        s1y.push(msg.y)
        reply()
      })
      .add('c:1', function (msg, reply) {
        reply({ z: msg.z + ++s1z })
      })

    c0 = make_seneca({ tag: 'c0' }, done)

    b0.use(
      Mesh,
      mesh_opts({
        isbase: true,
        sneeze: { silent: true },
      })
    ).ready(function () {
      s0.use(
        Mesh,
        mesh_opts({
          listen: [{ pin: 'a:1' }, { pin: 'b:1', model: 'observe' }],
        })
      ).ready(function () {
        s1.use(
          Mesh,
          mesh_opts({
            listen: [{ pin: 'c:1' }, { pin: 'b:1', model: 'observe' }],
          })
        ).ready(function () {
          c0.use(
            Mesh,
            mesh_opts({
              sneeze: { silent: true },
            })
          ).ready(do_abc)
        })
      })
    })

    function do_abc() {
      c0.act('a:1,x:0', function (e, o) {
        Assert.equal(1, o.x)

        c0.act('a:1,x:0', function (e, o) {
          Assert.equal(2, o.x)

          c0.act('b:1,y:0')
          c0.act('b:1,y:1')
          c0.act('b:1,y:2')
          c0.act('b:1,y:3')

          setTimeout(function () {
            Assert.deepStrictEqual([0, 1, 2, 3], s0y)
            Assert.deepStrictEqual([0, 1, 2, 3], s1y)

            c0.act('c:1,z:0', function (e, o) {
              Assert.equal(1, o.z)

              c0.act('c:1,z:0', function (e, o) {
                Assert.equal(2, o.z)

                close_all()
              })
            })
          }, 555 * tmx)
        })
      })
    }

    function close_all() {
      c0.close()
      s1.close()
      s0.close()
      b0.close()
      setTimeout(done, 555 * tmx)
    }
  })

  test('single-custom', { timeout: 5555 * tmx }, function (t, done) {
    var b0b, s0b

    function custom_bases(seneca, options, bases, next) {
      next(['127.0.0.1:39901'])
    }

    b0b = make_seneca({ tag: 'b0b' }, done).use(Mesh, {
      isbase: true,
      host: HOST,
      port: 39901,
      sneeze: {
        silent: true,
      },
      discover: {
        multicast: {
          active: false,
        },
        custom: {
          active: true,
          find: custom_bases,
        },
      },
    })

    s0b = make_seneca({ tag: 's0b' }, done).add('a:1', function (msg, reply) {
      reply({ x: msg.i })
    })

    b0b.ready(function () {
      s0b
        .use(Mesh, {
          pin: 'a:1',
          host: HOST,
          discover: {
            multicast: {
              active: false,
            },
            custom: {
              active: true,
              find: custom_bases,
            },
          },
        })
        .ready(function () {
          s0b.act('role:mesh,get:members', function (err, out) {
            if (err) {
              return done(err)
            }
            Assert.equal(1, out.list.length)

            b0b.act('a:1,i:0', function (err, out) {
              if (err) {
                return done(err)
              }
              Assert.equal(0, out.x)

              b0b.act('a:1,i:1', function (err, out) {
                if (err) {
                  return done(err)
                }
                Assert.equal(1, out.x)

                s0b.close()
                b0b.close()
                setTimeout(done, 555 * tmx)
              })
            })
          })
        })
    })
  })

  // Tests https://github.com/senecajs/seneca-mesh/issues/11
  test('canonical-pins', { timeout: 5555 * tmx }, function (t, done) {
    canonical_pins(test_discover, done)
  })

  // The default discovery: multicast, which broadcasts to
  // 255.255.255.255:12345 (node-discover), then guess. node-discover ignores
  // the other nodes of its own process, so here the base is found by guess,
  // but the multicast broadcaster of each node runs and is stopped (or kept,
  // on the base, until it closes). Not every network allows broadcasts:
  // set SENECA_MESH_TEST_MULTICAST=1 to run this test.
  test(
    'canonical-pins-default-discovery',
    { timeout: 7777 * tmx, skip: !test_multicast },
    function (t, done) {
      canonical_pins({}, done)
    }
  )

  // Runs last: every instance of the tests above is closed, so no socket
  // of mesh, swim or node-discover may be left open.
  test('close-releases-handles', { timeout: 5555 * tmx }, function (t, done) {
    setTimeout(function () {
      var open = process.getActiveResourcesInfo().filter(function (r) {
        return /^(UDPWrap|TCPServerWrap|TCPSocketWrap)$/.test(r)
      })
      Assert.deepStrictEqual(open, [])
      done()
    }, 1111 * tmx)
  })
})

function canonical_pins(discover, done) {
  var b0 = make_seneca({}, done).use(
    Mesh,
    mesh_opts({ base: true, discover: discover })
  )

  var s0 = make_seneca({}, done).use(
    Mesh,
    mesh_opts({ pin: 'a:1,b:2;c:3', discover: discover })
  )
  var s1 = make_seneca({}, done).use(
    Mesh,
    mesh_opts({ pin: 'c:3;b:2,a:1', discover: discover })
  )
  var c0 = make_seneca({}, done).use(Mesh, mesh_opts({ discover: discover }))

  s0.add('a:1,b:2', function (msg, reply) {
    reply({ s: 0, x: msg.x })
  })
  s1.add('a:1,b:2', function (msg, reply) {
    reply({ s: 1, x: msg.x })
  })

  s0.add('c:3', function (msg, reply) {
    reply({ s: 0, y: msg.y })
  })
  s1.add('c:3', function (msg, reply) {
    reply({ s: 1, y: msg.y })
  })

  setTimeout(function () {
    c0.gate()
      .act(
        'role:transport,type:balance,get:target-map',
        function (ignore, out) {
          Assert.equal(out['a:1,b:2']['a:1,b:2'].targets.length, 2)
          Assert.equal(out['c:3']['c:3'].targets.length, 2)
        }
      )

      .act('c:3,y:100', function (ignore, out) {
        Assert.deepStrictEqual(out, { s: 0, y: 100 })
      })

      .act('c:3,y:200', function (ignore, out) {
        Assert.deepStrictEqual(out, { s: 1, y: 200 })
      })
      .act('c:3,y:300', function (ignore, out) {
        Assert.deepStrictEqual(out, { s: 0, y: 300 })
      })

      .act('a:1,b:2,x:400', function (ignore, out) {
        Assert.deepStrictEqual(out, { s: 0, x: 400 })
      })
      .act('a:1,b:2,x:500', function (ignore, out) {
        Assert.deepStrictEqual(out, { s: 1, x: 500 })
      })

      .act('a:1,b:2,x:600', function (ignore, out) {
        Assert.deepStrictEqual(out, { s: 0, x: 600 })

        close(done, 555, c0, s0, s1, b0)
      })
  }, 2555 * tmx)
}

// Wait until the balance client of each instance has count targets for the
// pin group pg. The membership network notices that a node has closed only
// when its failure detector times out, after about two seconds or more on a
// busy machine, so the tests wait for the outcome instead of a fixed time.
function wait_targets(instances, pg, count, fail, then) {
  var pending = instances.slice()

  check()

  function check() {
    if (0 === pending.length) {
      return then()
    }

    pending[0].act(
      'role:transport,type:balance,get:target-map',
      { pg: pg },
      function (err, out) {
        if (err) {
          return fail(err)
        }

        if (out && out[pg] && count === out[pg].targets.length) {
          pending.shift()
          check()
        } else {
          setTimeout(check, 111)
        }
      }
    )
  }
}

function make_rif() {
  var netif = {
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true,
      },
      {
        address: '::1',
        netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
        family: 'IPv6',
        mac: '00:00:00:00:00:00',
        scopeid: 0,
        internal: true,
      },
    ],
    eth0: [
      {
        address: '10.0.2.15',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '08:00:27:1b:bc:e9',
        internal: false,
      },
      {
        address: 'fe80::a00:27ff:fe1b:bce9',
        netmask: 'ffff:ffff:ffff:ffff::',
        family: 'IPv6',
        mac: '08:00:27:1b:bc:e9',
        scopeid: 2,
        internal: false,
      },
    ],
  }

  return Rif(netif)
}

function close() {
  var fin = arguments[0]
  var delay = arguments[1]
  var instances = Array.prototype.slice.call(arguments, 2)

  close_instance(0)
  function close_instance(index) {
    if (instances.length <= index) {
      setTimeout(fin, delay * tmx)
    } else {
      instances[index].close(function (err) {
        if (err) return fin(err)
        close_instance(index + 1)
      })
    }
  }
}
