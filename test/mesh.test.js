/* MIT License. Copyright (c) 2015-2018, Richard Rodger and other contributors. */

'use strict'

var Assert = require('assert')
var Util = require('util')

var Lab = require('lab')
var Code = require('code')
var Seneca = require('seneca')
var Rif = require('rif')

var lab = (exports.lab = Lab.script())
var describe = lab.describe
var it = make_it(lab)
var expect = Code.expect

var tmx = parseInt(process.env.TIMEOUT_MULTIPLIER || 1, 10)

var Mesh = require('..')

var intern = Mesh.intern

var test_discover = {
  stop: true,
  guess: { active: true },
  multicast: { active: false },
  registry: { active: false }
}

describe('#mesh', function() {
  it(
    'nextgen-single-with-base',
    { parallel: false, timeout: 5555 * tmx },
    function(fin) {
      var b0 = Seneca({ tag: 'b0', legacy: { transport: false } })
        .test(fin)
        .use(Mesh, { base: true, discover: test_discover })

      var s0 = Seneca({ tag: 's0', legacy: { transport: false } })
        .test(fin)
        .add('a:1', function(msg, reply) {
          reply({ x: msg.x })
        })

      b0.ready(function() {
        s0.use(Mesh, { pin: 'a:1', discover: test_discover }).ready(function() {
          b0.act('a:1,x:0', function(ignore, out) {
            Assert.equal(0, out.x)

            b0.act('a:1,x:1', function(ignore, out) {
              Assert.equal(1, out.x)

              //s0.close(b0.close.bind(b0, setTimeout.bind(this, fin, 555*tmx)))
              close(fin, 777, s0, b0)
            })
          })
        })
      })
    }
  )

  it('intern.resolve_bases', function(done) {
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

    done()
  })

  it('intern.make_pin_config', function(done) {
    var si = Seneca({ log: 'silent' })

    expect(
      intern.make_pin_config(si, { identifier$: 'i0' }, 'a:1', {
        pin: 'a:1',
        x: 1
      })
    ).to.equal({
      id: 'pin:a:1,x:1~i0',
      pin: 'a:1',
      x: 1
    })

    expect(
      intern.make_pin_config(si, { identifier$: 'i0' }, 'a:1', {
        pins: [{ a: 1 }, 'b:1'],
        x: 1
      })
    ).to.equal({
      id: 'pin:a:1,x:1~i0',
      pin: 'a:1',
      x: 1
    })

    done()
  })

  it('intern.resolve_pins', function(done) {
    var si = Seneca({ log: 'silent' })

    expect(intern.resolve_pins(si, { pin: 'a:1' })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pin: { a: 1 } })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pins: 'a:1' })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pins: { a: 1 } })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pin: ['a:1'] })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pin: [{ a: 1 }] })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pins: ['a:1'] })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pins: [{ a: 1 }] })).to.equal(['a:1'])

    expect(intern.resolve_pins(si, { pin: 'a:1,b:2' })).to.equal(['a:1,b:2'])

    expect(intern.resolve_pins(si, { pin: 'b:2,a:1' })).to.equal(['a:1,b:2'])

    expect(intern.resolve_pins(si, { pin: 'a:1;b:2' })).to.equal(['a:1', 'b:2'])

    expect(intern.resolve_pins(si, { pin: 'b:2;a:1' })).to.equal(['b:2', 'a:1'])

    expect(intern.resolve_pins(si, { pin: 'a:1;a:1' })).to.equal(['a:1', 'a:1'])

    expect(intern.resolve_pins(si, { pins: 'a:1;b:2' })).to.equal([
      'a:1',
      'b:2'
    ])

    expect(intern.resolve_pins(si, { pins: ['a:1;b:2'] })).to.equal([
      'a:1',
      'b:2'
    ])

    expect(intern.resolve_pins(si, { pins: [{ a: 1 }, { b: 2 }] })).to.equal([
      'a:1',
      'b:2'
    ])

    expect(intern.resolve_pins(si, { pins: ['a:1', 'b:2'] })).to.equal([
      'a:1',
      'b:2'
    ])

    expect(intern.resolve_pins(si, { pin: 'a:1,b:2;c:3' })).to.equal([
      'a:1,b:2',
      'c:3'
    ])

    expect(intern.resolve_pins(si, { pin: 'c:3;a:1,b:2' })).to.equal([
      'c:3',
      'a:1,b:2'
    ])

    done()
  })

  it('base', { timeout: 5555 * tmx, parallel: false }, function(done) {
    Seneca({ tag: 'b0a', log: 'test', debug: { short_logs: true } })
      .error(done)
      .use(Mesh, { isbase: true, discover: test_discover })
      .ready(function() {
        this.close(setTimeout.bind(this, done, 555 * tmx))
      })
  })

  it('single-with-base', { parallel: false, timeout: 5555 * tmx }, function(
    done
  ) {
    var b0b, s0b

    b0b = Seneca({ tag: 'b0b', log: 'silent', debug: { short_logs: true } })
      .error(done)
      .use(Mesh, { isbase: true, discover: test_discover })

    s0b = Seneca({ tag: 's0b', log: 'silent', debug: { short_logs: true } })
      .error(done)
      .add('a:1', function(msg, reply) {
        reply({ x: msg.i })
      })

    b0b.ready(function() {
      s0b.use(Mesh, { pin: 'a:1', discover: test_discover }).ready(function() {
        s0b.act('role:mesh,get:members', function(err, out) {
          if (err) {
            done(err)
          }
          Assert.equal(1, out.list.length)

          b0b.act('a:1,i:0', function(err, out) {
            if (err) {
              done(err)
            }
            Assert.equal(0, out.x)

            b0b.act('a:1,i:1', function(err, out) {
              if (err) {
                done(err)
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

  it('happy', { parallel: false, timeout: 9999 * tmx }, function(fin) {
    var b0, s0, s1, c0

    b0 = Seneca({ id$: 'b0' })
      .test(fin)
      .use(Mesh, {
        base: true,
        discover: test_discover,
        sneeze: { silent: true }
      })

    s0 = Seneca({ id$: 's0' })
      .test(fin)
      .use(Mesh, {
        pin: 'a:1',
        discover: test_discover,
        sneeze: { silent: true }
      })
      .add('a:1', function(m, r) {
        r({ x: 0 })
      })

    s1 = Seneca({ id$: 's1' })
      .test(fin)
      .use(Mesh, {
        pin: 'a:1',
        discover: test_discover,
        sneeze: { silent: true }
      })
      .add('a:1', function(m, r) {
        r({ x: 1 })
      })
      .add('a:1', function(m, r) {
        this.prior(m, r)
      })

    c0 = Seneca({ id$: 'c0' })
      .test(fin)
      .use(Mesh, { discover: test_discover, sneeze: { silent: true } })

    b0.ready(
      s0.ready.bind(
        s0,
        s1.ready.bind(
          s1,
          c0.ready.bind(c0, function() {
            c0.gate()
              .act(
                { role: 'transport', type: 'balance', get: 'target-map' },
                function(e, o) {
                  expect(o['a:1']['a:1'].targets.length).equal(2)
                }
              )

              .act({ role: 'mesh', get: 'members' }, function(e, o) {
                expect(o.list.length).equal(3)
              })

              .act('a:1,s:0', function(e, o) {
                expect(o.x).equal(0)
              })
              .act('a:1,s:1', function(e, o) {
                expect(o.x).equal(1)
              })
              .act('a:1,s:2', function(e, o) {
                expect(o.x).equal(0)
              })

              .ready(function() {
                b0.act('role:mesh,get:members', function(e, o) {
                  expect(o.list.length).equal(3)

                  s0.close(
                    setTimeout.bind(
                      null,
                      function() {
                        c0.act('a:1,s:3', function(e, o) {
                          expect(o.x).equal(1)
                        })
                          .act('a:1,s:4', function(e, o) {
                            expect(o.x).equal(1)
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
                      },
                      3333 * tmx
                    )
                  )
                })
              })
          })
        )
      )
    )
  })

  it('many-actors', { parallel: false, timeout: 19999 * tmx }, function(done) {
    var b0, s0, s1, s2, c0, c1

    b0 = Seneca({ tag: 'b0', log: 'test', debug: { short_logs: true } }).error(
      done
    )

    s0 = Seneca({ tag: 's0', log: 'test', debug: { short_logs: true } })
      .error(done)
      .add('a:1', function(msg, reply) {
        reply({ x: msg.x + 1 })
      })

    s1 = Seneca({ tag: 's1', log: 'test', debug: { short_logs: true } })
      .error(done)
      .add('a:1', function(msg, reply) {
        reply({ x: msg.x + 2 })
      })

    s2 = Seneca({ tag: 's2', log: 'test', debug: { short_logs: true } })
      .error(done)
      .add('a:1', function(msg, reply) {
        reply({ x: msg.x + 3 })
      })

    c0 = Seneca({ tag: 'c0', log: 'test', debug: { short_logs: true } }).error(
      done
    )

    c1 = Seneca({ tag: 'c1', log: 'test', debug: { short_logs: true } }).error(
      done
    )

    b0.use(Mesh, {
      isbase: true,
      discover: test_discover,
      sneeze: { silent: true }
    }).ready(function() {
      s0.use(Mesh, {
        pin: 'a:1',
        model: 'actor',
        discover: test_discover,
        sneeze: { silent: true }
      }).ready(function() {
        s1.use(Mesh, {
          pin: 'a:1',
          model: 'actor',
          discover: test_discover,
          sneeze: { silent: true }
        }).ready(function() {
          s2.use(Mesh, {
            pin: 'a:1',
            model: 'actor',
            discover: test_discover,
            sneeze: { silent: true }
          }).ready(function() {
            c0.use(Mesh, {
              discover: test_discover,
              sneeze: { silent: true }
            }).ready(function() {
              c1.use(Mesh, {
                discover: test_discover,
                sneeze: { silent: true }
              }).ready(setTimeout.bind(null, do_topology, 2222 * tmx))
            })
          })
        })
      })
    })

    function do_topology() {
      c0.act('role:mesh,get:members', function(err, o) {
        if (err) {
          done(err)
        }
        Assert.equal(5, o.list.length)

        c1.act('role:mesh,get:members', function(err, o) {
          if (err) {
            done(err)
          }
          Assert.equal(5, o.list.length)

          c0.act(
            'role:transport,type:balance,get:target-map,pg:"a:1"',
            function(err, c0map) {
              if (err) {
                done(err)
              }
              Assert.equal(3, c0map['a:1'].targets.length)

              c1.act(
                'role:transport,type:balance,get:target-map,pg:"a:1"',
                function(err, c1map) {
                  if (err) {
                    done(err)
                  }
                  Assert.equal(3, c1map['a:1'].targets.length)

                  do_actors(c0map, c1map)
                }
              )
            }
          )
        })
      })
    }

    function do_actors(c0map, c1map) {
      c0.act('a:1,x:0', function(e, o) {
        Assert.equal(1, o.x)

        c1.act('a:1,x:0', function(e, o) {
          Assert.equal(1, o.x)

          c0.act('a:1,x:0', function(e, o) {
            Assert.equal(2, o.x)

            c1.act('a:1,x:0', function(e, o) {
              Assert.equal(2, o.x)

              c0.act('a:1,x:0', function(e, o) {
                Assert.equal(3, o.x)

                c1.act('a:1,x:0', function(e, o) {
                  Assert.equal(3, o.x)

                  c0.act('a:1,x:0', function(e, o) {
                    Assert.equal(1, o.x)

                    c1.act('a:1,x:0', function(e, o) {
                      Assert.equal(1, o.x)

                      c0.act('a:1,x:0', function(e, o) {
                        Assert.equal(2, o.x)

                        c1.act('a:1,x:0', function(e, o) {
                          Assert.equal(2, o.x)

                          c0.act('a:1,x:0', function(e, o) {
                            Assert.equal(3, o.x)

                            c1.act('a:1,x:0', function(e, o) {
                              Assert.equal(3, o.x)

                              s1.close(
                                setTimeout.bind(this, do_s1_down, 2555 * tmx)
                              )
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    function do_s1_down() {
      c0.act('a:1,x:0', function(e, o) {
        Assert.equal(1, o.x)

        c1.act('a:1,x:0', function(e, o) {
          Assert.equal(1, o.x)

          c0.act('a:1,x:0', function(e, o) {
            Assert.equal(3, o.x)

            c1.act('a:1,x:0', function(e, o) {
              Assert.equal(3, o.x)

              c0.act('a:1,x:0', function(e, o) {
                Assert.equal(1, o.x)

                c1.act('a:1,x:0', function(e, o) {
                  Assert.equal(1, o.x)

                  c0.act('a:1,x:0', function(e, o) {
                    Assert.equal(3, o.x)

                    c1.act('a:1,x:0', function(e, o) {
                      Assert.equal(3, o.x)

                      c0.act('a:1,x:0', function(e, o) {
                        Assert.equal(1, o.x)

                        c1.act('a:1,x:0', function(e, o) {
                          Assert.equal(1, o.x)

                          c0.act('a:1,x:0', function(e, o) {
                            Assert.equal(3, o.x)

                            c1.act('a:1,x:0', function(e, o) {
                              Assert.equal(3, o.x)

                              close()
                            })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    }

    function close() {
      c1.close()
      c0.close()
      s2.close()
      s0.close()
      b0.close()
      setTimeout(done, 2222 * tmx)
    }
  })

  it(
    'observe-consume-basic',
    { parallel: false, timeout: 9999 * tmx },
    function(done) {
      var b0, s0, s1, c0
      var s0x = 0
      var s1z = 0
      var s0y = []
      var s1y = []

      b0 = Seneca({ tag: 'b0', log: 'test' }).error(done)

      s0 = Seneca({ tag: 's0', log: 'test' })
        .error(done)
        .add('a:1', function(msg, reply) {
          reply({ x: msg.x + ++s0x })
        })
        .add('b:1', function(msg, reply) {
          s0y.push(msg.y)
          reply()
        })

      s1 = Seneca({ tag: 's1', log: 'test' })
        .error(done)
        .add('b:1', function(msg, reply) {
          s1y.push(msg.y)
          reply()
        })
        .add('c:1', function(msg, reply) {
          reply({ z: msg.z + ++s1z })
        })

      c0 = Seneca({ tag: 'c0', log: 'test' }).error(done)

      b0.use(Mesh, {
        isbase: true,
        discover: test_discover,
        sneeze: { silent: true }
      }).ready(function() {
        s0.use(Mesh, {
          listen: [{ pin: 'a:1' }, { pin: 'b:1', model: 'observe' }],
          discover: test_discover
        }).ready(function() {
          s1.use(Mesh, {
            listen: [{ pin: 'c:1' }, { pin: 'b:1', model: 'observe' }],
            discover: test_discover
          }).ready(function() {
            c0.use(Mesh, {
              discover: test_discover,
              sneeze: { silent: true }
            }).ready(do_abc)
          })
        })
      })

      function do_abc() {
        c0.act('a:1,x:0', function(e, o) {
          Assert.equal(1, o.x)

          c0.act('a:1,x:0', function(e, o) {
            Assert.equal(2, o.x)

            c0.act('b:1,y:0')
            c0.act('b:1,y:1')
            c0.act('b:1,y:2')
            c0.act('b:1,y:3')

            setTimeout(function() {
              Assert.deepEqual([0, 1, 2, 3], s0y)
              Assert.deepEqual([0, 1, 2, 3], s1y)

              c0.act('c:1,z:0', function(e, o) {
                Assert.equal(1, o.z)

                c0.act('c:1,z:0', function(e, o) {
                  Assert.equal(2, o.z)

                  close()
                })
              })
            }, 555 * tmx)
          })
        })
      }

      function close() {
        c0.close()
        s1.close()
        s0.close()
        b0.close()
        setTimeout(done, 555 * tmx)
      }
    }
  )

  it('single-custom', { parallel: false, timeout: 5555 * tmx }, function(done) {
    var b0b, s0b

    function custom_bases(seneca, options, bases, next) {
      next(['127.0.0.1:39901'])
    }

    b0b = Seneca({ tag: 'b0b', log: 'silent', debug: { short_logs: true } })
      .error(done)
      .use(Mesh, {
        isbase: true,
        port: 39901,
        sneeze: {
          silent: true
        },
        discover: {
          custom: {
            active: true,
            find: custom_bases
          }
        }
      })

    s0b = Seneca({ tag: 's0b', log: 'silent', debug: { short_logs: true } })
      .error(done)
      .add('a:1', function(msg, reply) {
        reply({ x: msg.i })
      })

    b0b.ready(function() {
      s0b
        .use(Mesh, {
          pin: 'a:1',
          discover: {
            custom: {
              active: true,
              find: custom_bases
            }
          }
        })
        .ready(function() {
          s0b.act('role:mesh,get:members', function(err, out) {
            if (err) {
              done(err)
            }
            Assert.equal(1, out.list.length)

            b0b.act('a:1,i:0', function(err, out) {
              if (err) {
                done(err)
              }
              Assert.equal(0, out.x)

              b0b.act('a:1,i:1', function(err, out) {
                if (err) {
                  done(err)
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
  it('canonical-pins', { parallel: false, timeout: 5555 * tmx }, function(
    done
  ) {
    var b0 = Seneca({ legacy: { transport: false } })
      .test(done)
      .use(Mesh, { base: true })

    var s0 = Seneca({ legacy: { transport: false } })
      .test(done)
      .use(Mesh, { pin: 'a:1,b:2;c:3' })
    var s1 = Seneca({ legacy: { transport: false } })
      .test(done)
      .use(Mesh, { pin: 'c:3;b:2,a:1' })
    var c0 = Seneca({ legacy: { transport: false } })
      .test(done)
      .use(Mesh)

    s0.add('a:1,b:2', function(msg, reply) {
      reply({ s: 0, x: msg.x })
    })
    s1.add('a:1,b:2', function(msg, reply) {
      reply({ s: 1, x: msg.x })
    })

    s0.add('c:3', function(msg, reply) {
      reply({ s: 0, y: msg.y })
    })
    s1.add('c:3', function(msg, reply) {
      reply({ s: 1, y: msg.y })
    })

    setTimeout(function() {
      c0.gate()
        .act('role:transport,type:balance,get:target-map', function(
          ignore,
          out
        ) {
          expect(out['a:1,b:2']['a:1,b:2'].targets.length).to.equal(2)
          expect(out['c:3']['c:3'].targets.length).to.equal(2)
          //console.dir(out,{depth:null})
        })

        .act('c:3,y:100', function(ignore, out) {
          expect(out).to.equal({ s: 0, y: 100 })
        })

        .act('c:3,y:200', function(ignore, out) {
          expect(out).to.equal({ s: 1, y: 200 })
        })
        .act('c:3,y:300', function(ignore, out) {
          expect(out).to.equal({ s: 0, y: 300 })
        })

        .act('a:1,b:2,x:400', function(ignore, out) {
          expect(out).to.equal({ s: 0, x: 400 })
        })
        .act('a:1,b:2,x:500', function(ignore, out) {
          expect(out).to.equal({ s: 1, x: 500 })
        })

        .act('a:1,b:2,x:600', function(ignore, out) {
          expect(out).to.equal({ s: 0, x: 600 })

          c0.close()
          s0.close()
          s1.close()
          b0.close()

          done()
        })
    }, 2555 * tmx)
  })
})

function make_rif() {
  var netif = {
    lo: [
      {
        address: '127.0.0.1',
        netmask: '255.0.0.0',
        family: 'IPv4',
        mac: '00:00:00:00:00:00',
        internal: true
      },
      {
        address: '::1',
        netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
        family: 'IPv6',
        mac: '00:00:00:00:00:00',
        scopeid: 0,
        internal: true
      }
    ],
    eth0: [
      {
        address: '10.0.2.15',
        netmask: '255.255.255.0',
        family: 'IPv4',
        mac: '08:00:27:1b:bc:e9',
        internal: false
      },
      {
        address: 'fe80::a00:27ff:fe1b:bce9',
        netmask: 'ffff:ffff:ffff:ffff::',
        family: 'IPv6',
        mac: '08:00:27:1b:bc:e9',
        scopeid: 2,
        internal: false
      }
    ]
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
      instances[index].close(function(err) {
        if (err) return fin(err)
        close_instance(index + 1)
      })
    }
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
      Util.promisify(function(x, fin) {
        func(fin)
      })
    )
  }
}
