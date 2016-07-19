/*
  MIT License,
  Copyright (c) 2015-2016, Richard Rodger and other contributors.
*/

'use strict'

var Assert = require('assert')
var Util = require('util')

var Lab = require('lab')
var Seneca = require('seneca')

var Rif = require('rif')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it

var mesh = require('..')

var netif = { 
  lo:
   [ { address: '127.0.0.1',
       netmask: '255.0.0.0',
       family: 'IPv4',
       mac: '00:00:00:00:00:00',
       internal: true },
     { address: '::1',
       netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
       family: 'IPv6',
       mac: '00:00:00:00:00:00',
       scopeid: 0,
       internal: true } ],
  eth0:
   [ { address: '10.0.2.15',
       netmask: '255.255.255.0',
       family: 'IPv4',
       mac: '08:00:27:1b:bc:e9',
       internal: false },
     { address: 'fe80::a00:27ff:fe1b:bce9',
       netmask: 'ffff:ffff:ffff:ffff::',
       family: 'IPv6',
       mac: '08:00:27:1b:bc:e9',
       scopeid: 2,
       internal: false } ],
}

var rif = Rif(netif)

var test_discover = {
  stop: true,
  guess: true,
  multicast: false,
  registry: false
}

describe('#mesh', function () {

  it('util:resolve_bases', function (done) {
    Assert.equal(
      '',
      ''+mesh.resolve_bases())

    Assert.equal(
      mesh.DEFAULT_HOST+':'+mesh.DEFAULT_PORT+',192.168.1.2:'+mesh.DEFAULT_PORT,
      ''+mesh.resolve_bases([':'+mesh.DEFAULT_PORT],{host:'192.168.1.2'}, rif))

    Assert.equal(
      'foo:'+mesh.DEFAULT_PORT+','+
      'bar:'+mesh.DEFAULT_PORT,
      ''+mesh.resolve_bases(['foo','bar'], null, rif))

    Assert.equal(
      mesh.DEFAULT_HOST+':33333',
      ''+mesh.resolve_bases([':33333'], null, rif))

    Assert.equal(
      mesh.DEFAULT_HOST+':33333,'+'zed:33333',
      ''+mesh.resolve_bases([':33333'], {host:'zed'}, rif))

    Assert.equal(
      '127.0.0.1:'+mesh.DEFAULT_PORT,
      ''+mesh.resolve_bases(['@lo'], null, rif))
    
    done()
  })

  it('base', {timeout:5555, parallel:false}, function (done) {
    var b0a

    b0a = 
      Seneca({tag:'b0a', log:'test', debug:{short_logs:true}})
      .error(done)
      .use('..',{isbase:true, discover:test_discover})
      .ready( function () {
        this.close(setTimeout.bind(this,done,555))
      })
  })


  it('single', {parallel:false, timeout:5555}, function (done) {
    var b0b, s0b

    b0b = 
      Seneca({tag:'b0b', log:'silent', debug:{short_logs:true}})
      .error(done)
      .use('..',{isbase:true, discover:test_discover})

    s0b = 
      Seneca({tag:'s0b', log:'silent', debug:{short_logs:true}})
      .error(done)
      .add('a:1',function(msg){this.good({x:msg.i})})

    b0b.ready( function() {
      s0b.use('..',{pin:'a:1', discover:test_discover}).ready( function() {

        s0b.act('role:mesh,get:members',function (err, out) {
          Assert.equal(1,out.list.length)

          b0b.act('a:1,i:0',function(err,out){
            Assert.equal(0,out.x)
          
            b0b.act('a:1,i:1',function(err,out){
              Assert.equal(1,out.x)
          
              s0b.close(b0b.close.bind(b0b,setTimeout.bind(this,done,555)))
            })
          })
        })
      })
    })
  })

  it('happy', {parallel:false, timeout:5555}, function (done) {
    var b0, s0, s1, c0

    b0 = 
      Seneca({tag:'b0', log:'test'})
      .error(done)
      .use('..',{isbase:true, discover:test_discover, sneeze:{silent:true}})

    s0 = 
      Seneca({tag:'s0', log:'test'})
      .error(done)
      .use('..',{pin:'a:1', discover:test_discover, sneeze:{silent:true}})
      .add('a:1',function(){this.good({x:0})})

    s1 = 
      Seneca({tag:'s1', log:'test'})
      .error(done)
      .use('..',{pins:'a:1', discover:test_discover, sneeze:{silent:true}})
      .add('a:1',function(){this.good({x:1})})
    
    c0 = 
      Seneca({tag:'c0', log:'test'})
      .error(done)
      .use('..',{discover:test_discover, sneeze:{silent:true}})

    b0.ready( function () {
      // console.log('b0')

        s0.ready( function () {
          // console.log('s0')

            s1.ready( function () {
              // console.log('s1')

                c0.ready( function () {
                  // console.log('c0')

                  c0.act('a:1,s:0',function(e,o){

                    //console.log(0,e,o)
                    Assert.equal(0,o.x)

                    c0.act('a:1,s:1',function(e,o){
                      // console.log(1,e,o)
                      Assert.equal(1,o.x)
                      
                      c0.act('a:1,s:2',function(e,o){
                        // console.log(2,e,o)
                        Assert.equal(0,o.x)
                        
                        b0.act('role:mesh,get:members',function(e,o){
                          Assert.equal(3,o.list.length)

                          s0.close( function() {
                              
                            setTimeout( function() {
                              c0.act('a:1,s:3',function(e,o){
                                // console.log(3,e,o)
                                Assert.equal(1,o.x)
                                
                                c0.act('a:1,s:4',function(e,o){
                                  // console.log(4,e,o)
                                  Assert.equal(1,o.x)
                                  
                                  c0.close( function(){
                                    s1.close( function(){
                                      b0.close( function(){
                                        // console.log('done')
                                        done()
                                      })
                                    })
                                  })
                                })
                              })
                            },1555)
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


  it('many-actors', {parallel:false, timeout:9999}, function (done) {
    var b0, s0, s1, s2, c0, c1

    b0 = Seneca({tag:'b0', log:'test', debug: {short_logs: true}})
      .error(done)

    s0 = Seneca({tag:'s0', log:'test', debug: {short_logs: true}})
      .error(done)
      .add('a:1',function(m){this.good({x:m.x+1})})

    s1 = Seneca({tag:'s1', log:'test', debug: {short_logs: true}})
      .error(done)
      .add('a:1',function(m){this.good({x:m.x+2})})

    s2 = Seneca({tag:'s2', log:'test', debug: {short_logs: true}})
      .error(done)
      .add('a:1',function(m){this.good({x:m.x+3})})

    c0 = Seneca({tag:'c0', log:'test', debug: {short_logs: true}})
      .error(done)

    c1 = Seneca({tag:'c1', log:'test', debug: {short_logs: true}})
      .error(done)

    
    b0.use('..',{isbase:true, discover:test_discover, sneeze:{silent:true}}).ready( function() {
      s0.use('..',{pin:'a:1',model:'actor', discover:test_discover, sneeze:{silent:true}}).ready( function() {
        s1.use('..',{pin:'a:1',model:'actor', discover:test_discover, sneeze:{silent:true}}).ready( function() {
          s2.use('..',{pin:'a:1',model:'actor', discover:test_discover, sneeze:{silent:true}}).ready( function() {
            c0.use('..',{discover:test_discover, sneeze:{silent:true}}).ready( function() {
              c1.use('..',{discover:test_discover, sneeze:{silent:true}}).ready( setTimeout.bind(null,do_topology,222) ) })})})})})

    function do_topology() {
      c0.act('role:mesh,get:members', function (err,o) {
        Assert.equal(5, o.list.length)

        c1.act('role:mesh,get:members', function (err,o) {
          Assert.equal(5, o.list.length)

          c0.act('role:transport,type:balance,get:target-map,pg:"a:1"', function (err,c0map) {
            Assert.equal(3, c0map['a:1'].targets.length)

            c1.act('role:transport,type:balance,get:target-map,pg:"a:1"', function (err,c1map) {
              Assert.equal(3, c1map['a:1'].targets.length)
            
              do_actors(c0map, c1map)
            })
          })
        })
      })
    }

    function do_actors(c0map, c1map) {
      var i = 0
      //console.log(i++,'c0',c0map['a:1'].index,c0map.x,'c1',c1map['a:1'].index,c1map.x)

      c0.act('a:1,x:0', function(e,o){
        //console.log(i++,'c0',c0map['a:1'].index,'c1',c1map['a:1'].index)
        Assert.equal(1,o.x)

        c1.act('a:1,x:0', function(e,o){
          //console.log(i++,'c0',c0map['a:1'].index,'c1',c1map['a:1'].index)
          Assert.equal(1,o.x)

          c0.act('a:1,x:0', function(e,o){
            Assert.equal(2,o.x)

            c1.act('a:1,x:0', function(e,o){
              Assert.equal(2,o.x)

              c0.act('a:1,x:0', function(e,o){
                Assert.equal(3,o.x)

                c1.act('a:1,x:0', function(e,o){
                  Assert.equal(3,o.x)

                  c0.act('a:1,x:0', function(e,o){
                    Assert.equal(1,o.x)

                    c1.act('a:1,x:0', function(e,o){
                      Assert.equal(1,o.x)

                      c0.act('a:1,x:0', function(e,o){
                        Assert.equal(2,o.x)

                        c1.act('a:1,x:0', function(e,o){
                          Assert.equal(2,o.x)

                          c0.act('a:1,x:0', function(e,o){
                            Assert.equal(3,o.x)

                            c1.act('a:1,x:0', function(e,o){
                              Assert.equal(3,o.x)

                              s1.close( setTimeout.bind(this,do_s1_down,1555) )
                            })})})
                      })})})
                })})})
          })})})
    }

    function do_s1_down() {
      c0.act('a:1,x:0', function(e,o){
        Assert.equal(1,o.x)

        c1.act('a:1,x:0', function(e,o){
          Assert.equal(1,o.x)

          c0.act('a:1,x:0', function(e,o){
            Assert.equal(3,o.x)

            c1.act('a:1,x:0', function(e,o){
              Assert.equal(3,o.x)

              c0.act('a:1,x:0', function(e,o){
                Assert.equal(1,o.x)

                c1.act('a:1,x:0', function(e,o){
                  Assert.equal(1,o.x)

                  c0.act('a:1,x:0', function(e,o){
                    Assert.equal(3,o.x)

                    c1.act('a:1,x:0', function(e,o){
                      Assert.equal(3,o.x)

                      c0.act('a:1,x:0', function(e,o){
                        Assert.equal(1,o.x)

                        c1.act('a:1,x:0', function(e,o){
                          Assert.equal(1,o.x)

                          c0.act('a:1,x:0', function(e,o){
                            Assert.equal(3,o.x)

                            c1.act('a:1,x:0', function(e,o){
                              Assert.equal(3,o.x)

                              close()
                            })})})
                      })})})
                })})})
          })})})
    }

      
    function close() {
      c1.close(
        c0.close.bind(
          c0,s2.close.bind(
            s2,s0.close.bind(
                s0,b0.close.bind(
                  b0,setTimeout.bind(this,done,555))))))

    }

  })


  it('observe-consume-basic', {parallel:false, timeout:9999}, function (done) {
    var b0, s0, s1, c0
    var s0x = 0, s1z = 0, s0y = [], s1y = []

    b0 = Seneca({tag:'b0', log:'test'})
      .error(done)

    s0 = Seneca({tag:'s0', log:'test'})
      .error(done)
      .add('a:1',function(m){this.good({x:m.x+(++s0x)})})
      .add('b:1',function(m){s0y.push(m.y);this.good()})

    s1 = Seneca({tag:'s1', log:'test'})
      .error(done)
      .add('b:1',function(m){s1y.push(m.y);this.good()})
      .add('c:1',function(m){this.good({z:m.z+(++s1z)})})

    c0 = Seneca({tag:'c0', log:'test'})
      .error(done)


    
    b0.use('..',{isbase:true, discover:test_discover, sneeze:{silent:true}}).ready( function() {
      s0.use('..',{
        listen:[
          {pin:'a:1'},
          {pin:'b:1',model:'observe'},
        ], discover:test_discover
      }).ready( function() {

          s1.use('..',{
            listen:[
              {pin:'c:1'},
              {pin:'b:1',model:'observe'},
            ], discover:test_discover
          }).ready( function() {

              c0.use('..',{discover:test_discover, sneeze:{silent:true}}).ready( do_abc )})})})


    function do_abc() {
      c0.act('a:1,x:0', function(e,o){
        Assert.equal(1,o.x)

        c0.act('a:1,x:0', function(e,o){
          Assert.equal(2,o.x)

          c0.act('b:1,y:0')
          c0.act('b:1,y:1')
          c0.act('b:1,y:2')
          c0.act('b:1,y:3')

          setTimeout( function() {
            Assert.deepEqual([0,1,2,3],s0y)
            Assert.deepEqual([0,1,2,3],s1y)

            c0.act('c:1,z:0', function(e,o){
              Assert.equal(1,o.z)

              c0.act('c:1,z:0', function(e,o){
                Assert.equal(2,o.z)

                close()
              })})
          },111)
        })})
    }

      
    function close() {
      c0.close(
        s1.close.bind(
          s1,s0.close.bind(
            s0,b0.close.bind(
              b0,setTimeout.bind(this,done,555)))))
    }
  })
})


