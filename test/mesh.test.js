/*
  MIT License,
  Copyright (c) 2015, Richard Rodger and other contributors.
*/

'use strict'

var Assert = require('assert')
var Lab = require('lab')
var Seneca = require('seneca')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it


describe('#balance-client', function () {

  it('happy', function (done) {
    var s0, s1, c0

    s0 = 
      Seneca()
      .error(done)
      .listen(44440)
      .add('a:1',function(){this.good({x:0})})
      .ready( function () {
      
        s1 = 
          Seneca()
          .error(done)
          .listen(44441)
          .add('a:1',function(){this.good({x:1})})
          .ready( function () {
      
            c0 = 
              Seneca()
              .error(done)
              .use('..')
              .client( {type:'balance', pin:'a:1'} )
              .client( {port:44440, pin:'a:1', id:'t0'} )
              .client( {port:44441, pin:'a:1', id:'t1'} )
              .act('a:1',function(e,o){
                //console.log(0,e,o)
                Assert.equal(0,o.x)

                c0.act('a:1',function(e,o){
                  //console.log(0,e,o)
                  Assert.equal(1,o.x)

                  c0.act('a:1',function(e,o){
                    //console.log(0,e,o)
                    Assert.equal(0,o.x)

                    done()
                  })
                })
              })
          })
      })
  })


  it('add-remove', function (done) {
    var s0, s1, c0

    s0 = 
      Seneca()
      .error(done)
      .listen(44440)
      .add('a:1',function(){this.good({x:0})})
      .ready( function () {
      
        s1 = 
          Seneca()
          .error(done)
          .listen(44441)
          .add('a:1',function(){this.good({x:1})})
          .ready( function () {
      
            c0 = 
              Seneca()
              .error(done)
              .use('..')
              .client( {type:'balance', pin:'a:1'} )
              .act( 
                'role:transport,type:balance,add:client', 
                {config:{port:44440, pin:'a:1'}}, 
                function () {

                  c0.act('a:1',function(e,o){
                    console.log(0,e,o)
                    Assert.equal(0,o.x)

                    c0.act( 
                      'role:transport,type:balance,add:client', 
                      {config:{port:44441, pin:'a:1'}}, 
                      function () {

                        c0.act('a:1',function(e,o){
                          Assert.equal(0,o.x)

                          c0.act('a:1',function(e,o){
                            Assert.equal(1,o.x)

                            c0.act( 
                              'role:transport,type:balance,remove:client', 
                              {config:{port:44440, pin:'a:1'}}, 
                              function () {
                                
                                c0.act('a:1',function(e,o){
                                  Assert.equal(1,o.x)

                                  c0.act('a:1',function(e,o){
                                    Assert.equal(1,o.x)

                                    done()
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
