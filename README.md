![Seneca](http://senecajs.org/files/assets/seneca-logo.png)

> A [Seneca.js][] transport plugin that uses the SWIM gossip
  algorithm for automatic configuration of the microservice network.

For a detailed example, see Iteration 05 of the [nodezoo
workshop](https://github.com/rjrodger/nodezoo).

# seneca-mesh
[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Gitter][gitter-badge]][gitter-url]

This module is a plugin for the Seneca framework.

- __Tested on:__ Seneca 0.8
- __Node:__ 0.10, 0.12, 4, 5
- __License:__ [MIT][]

seneca-mesh's source can be read in an annotated fashion by,

- running `npm run annotate`
- viewing [online](http://senecajs.org/annotations/mesh.html).

The annotated source can be found locally at [./doc/seneca-mesh.html]().

If you're using this module, and need help, you can:

- Post a [github issue][],
- Tweet to [@senecajs][],
- Ask on the [Gitter][gitter-url].

If you are new to Seneca in general, please take a look at
[senecajs.org][]. We have everything from tutorials to sample apps to
help get you up and running quickly.


## Install

```sh
npm install seneca-balance-client
npm install seneca-mesh
```

The _seneca-mesh_ plugin depends on the [seneca-balance-client](https://github.com/rjrodger/seneca-balance-client) plugin.

And in your code:

```js
require('seneca')()
  .use('mesh', { ... options ... })
```

## Test
To run tests, simply use npm:

```sh
npm run test
```

## Quick Example

Base node, so that other nodes have a known reference point to join the network.

### base.js

```js
require('seneca')()
  .use('mesh',{base:true})

// start first!
// $ node base.js
```

### service-foo.js

```js
require('seneca')()
  .add( 'foo:1', function (msg, done) {
    done( null, {x:1,v:100+msg.v} )
  })

  // this service handles foo:1 messages
  .use('mesh', { auto:true, pin:'foo:1' })

  .ready( function () {
    var seneca = this

    setInterval( function() {

      // use bar:1, even though location of
      // service-bar is not configured!
      seneca.act('bar:1,v:2', console.log)
    }, 3000 )
  })

// $ node service-foo.js
```


### service-bar.js

```js
require('seneca')()
  .add( 'bar:1', function (msg, done) {
    done( null, {x:1,v:100+msg.v} )
  })

  // this service handles bar:1 messages
  .use('mesh', { auto:true, pin:'bar:1' })

  .ready( function () {
    var seneca = this

    setInterval( function() {

      // use foo:1, even though location of
      // service-foo is not configured!
      seneca.act('foo:1,v:2', console.log)
    }, 3000 )
  })

// $ node service-bar.js
```

The _foo_ and _bar_ services call each other, but neither requires
configuration information!


<!--
## Usage

TODO


## Releases

TODO
-->


## Contributing

The [Senecajs org][] encourages open participation. If you feel you
can help in any way, be it with documentation, examples, extra
testing, or new features please get in touch.

## License
Copyright (c) 2015, Richard Rodger and other contributors.
Licensed under [MIT][].

[MIT]: ./LICENSE
[npm-badge]: https://badge.fury.io/js/seneca-mesh.svg
[npm-url]: https://badge.fury.io/js/seneca-mesh
[Senecajs org]: https://github.com/senecajs/
[Seneca.js]: https://www.npmjs.com/package/seneca
[@senecajs]: http://twitter.com/senecajs
[senecajs.org]: http://senecajs.org/
[travis-badge]: https://travis-ci.org/rjrodger/seneca-mesh.svg
[travis-url]: https://travis-ci.org/rjrodger/seneca-mesh
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/rjrodger/seneca
[github issue]: https://github.com/rjrodger/seneca-mesh/issues

