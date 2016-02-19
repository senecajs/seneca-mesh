/*
  MIT License,
  Copyright (c) 2015-2016, Richard Rodger and other contributors.
*/

'use strict'

var Assert = require('assert')
var Lab = require('lab')
var Seneca = require('seneca')

var lab = exports.lab = Lab.script()
var describe = lab.describe
var it = lab.it


describe('#mesh', function () {

  it('base', {timeout:5555, parallel:false}, function (done) {
    var b0a

    b0a = 
      Seneca({tag:'b0a', log:'test', debug:{short_logs:true}})
      .error(done)
      .use('..',{isbase:true})
      .ready( function () {
        this.close(setTimeout.bind(this,done,555))
      })
  })

  it('single', {parallel:false}, function (done) {
    var b0b, s0b

    b0b = 
      Seneca({tag:'b0b', log:'test', debug:{short_logs:true}})
      .error(done)
      .use('..',{isbase:true})
      .ready( function () {

        s0b = 
          Seneca({tag:'s0b', log:'test', debug:{short_logs:true}})
          .error(done)
          .use('..',{pin:'a:1'})
          .add('a:1',function(msg){this.good({x:msg.i})})
          .ready( function () {

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

  it('happy', {parallel:false}, function (done) {
    var b0, s0, s1, c0

    b0 = 
      Seneca({tag:'b0', log:'test'})
      .error(done)
      .use('..',{isbase:true})
      .ready( function () {

        s0 = 
          Seneca({tag:'s0', log:'test'})
          .error(done)
          .use('..',{pin:'a:1'})
          .add('a:1',function(){this.good({x:0})})
          .ready( function () {

            s1 = 
              Seneca({tag:'s1', log:'test'})
              .error(done)
              .use('..',{pins:'a:1'})
              .add('a:1',function(){this.good({x:1})})
              .ready( function () {

                c0 = 
                  Seneca({tag:'c0', log:'test'})
                  .error(done)
                  .use('..',{})
                  .ready( function () {

                      c0.act('a:1,s:0',function(e,o){
                        //console.log(0,e,o)
                        Assert.equal(0,o.x)

                        c0.act('a:1,s:1',function(e,o){
                          //console.log(0,e,o)
                          Assert.equal(1,o.x)

                          c0.act('a:1,s:2',function(e,o){
                            //console.log(0,e,o)
                            Assert.equal(0,o.x)

                            b0.act('role:mesh,get:members',function(e,o){
                              Assert.equal(3,o.length)

                              s0.close( function() {
                              
                                setTimeout( function() {
                                  c0.act('a:1,s:3',function(e,o){
                                    //console.log(0,e,o)
                                    Assert.equal(1,o.x)

                                    c0.act('a:1,s:4',function(e,o){
                                      //console.log(0,e,o)
                                      Assert.equal(1,o.x)
                              
                                      c0.close( function(){
                                        s1.close( function(){
                                          b0.close( function(){
                                            done()
                                          })
                                        })
                                      })
                                    })
                                  })
                                },555)
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
