![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] transport plugin that provides uses the SWIM gossip algorithm for automatic configuration of the microservice network.

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
npm install seneca-mesh
```

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

```js
// TODO
```

## Usage

TODO


## Releases

TODO

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

