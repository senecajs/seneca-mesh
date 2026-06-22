![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] plugin

# @seneca/mesh

| ![Voxgig](https://www.voxgig.com/res/img/vgt01r.png) | This open source module is sponsored and supported by [Voxgig](https://www.voxgig.com). |
|---|---|

## Install

To install, use npm

```sh
npm install seneca-balance-client
npm install seneca-mesh
```
The _seneca-mesh_ plugin depends on the [seneca-balance-client](Balance) plugin.

And in your code:

```js
require('seneca')()
  .use('mesh', { ... options ... })
```

Using Windows? _seneca-mesh_ uses some native modules, so make sure to
[configure
msbuild](https://github.com/Microsoft/nodejs-guidelines/blob/master/windows-environment.md#compiling-native-addon-modules).

## Quick Example

Create a microservice. The service translates color names into
hex values.

```js
// color-service.js
var Seneca = require('seneca')

Seneca()
  // Uncomment to get detailed logs
  // .test('print')
  
  // provide an action for the format:hex pattern
  .add('format:hex', function (msg, reply) {

    // red is the only color supported!
    var color = 'red' === msg.color ? '#FF0000' : '#FFFFFF'

    reply({color: color})
  })

  // load the mesh plugin
  .use('mesh', {

    // this is a base node
    isbase: true,

    // this service will respond to the format:hex pattern
    pin: 'format:hex'
  })
```

Run the service (and leave it running) using:

```sh
$ node color-service.js
```

Create a client for the service. This client joins the mesh network,
performs an action, and then leaves.

```js
// color-client.js
var Seneca = require('seneca')

Seneca({log: 'test'})

  // load the mesh plugin
  .use('mesh')

  // send a message out into the network
  // the network will know where to send format:hex messages
  .act({format: 'hex', color: 'red'}, function (err, out) {

    // prints #FF0000
    console.log(out.color)
  })
```

Run the client in a separate terminal using:

```sh
$ node color-client.js
```

The client finds the service using the mesh network. In this simple
case, the `color-service` is configured as a *base* node, which means
that it listens on a pre-defined local UDP port. The client checks for
base nodes on this port.

**Notice that the client did not need any infomation about the service
  location.**

To join a network, you do need to know where the base nodes are. Once
you've joined, you don't even need the bases anymore, as the network keeps
you informed of new services.

To find base nodes, _seneca-mesh_ provides support for discovery via
configuration, multicast, service registries, and custom
approaches. Base nodes are **not** used for service discovery. They
serve only as a convenient means for new nodes to join the network.

In the above example, UDP multicast was used by default. In production
you'll need to choose a discovery mechanism suitable for your network.


The [examples](/examples) folder contains code for this
example, and other scenarios demonstrating more complex network
configurations:

  * [local-dev-mesh](/examples/20-local-dev-mesh): local development, including a web service API.
  * [multicast-discovery](/examples/30-multicast-discovery): multicast allows base nodes to discover each other - zero configuration!
  * [consul-discovery](/examples/40-consul-discovery): base node discovery using a service registry, when multicast is not available.

As a counterpoint to mesh-based configuration, the
[local-dev](/examples/10-local-dev) example is a reminder of the
burden of traditional service location.

## More Examples

See [test/](test/) for usage examples.

## Motivation

This plugin adds network discovery to Seneca microservices. Nodes find each other automatically using gossip networking.

## Support

If you're using this module and need help, you can:

- Post a [github issue][]
- Tweet to [@senecajs][]

## API

### Options

The _seneca-mesh_ plugin accepts the following set of options. Specify these when loading the plugin:

```js
require('seneca')
    .use('mesh', {
      // options go here
    })
```

The options are:

  * _isbase_: Make this node a base node. Default: false.

  * _bases_: An array of pre-defined base nodes. Specify strings in
             the format: 'IP:PORT'. Default: [].

  * _pin_: the action pattern that this service will respond to. Default: null

  * _listen_: an array of action patterns that this service will respond to. Default: null

  * _stop_: base node discovery stops as soon as a discovery
    strategies provides a list of suggested nodes. Default: true

  * _discover_: define the base node discovery options:

    * _defined_: use defined base nodes, specified via the _bases_
      option.
      * _active_: activate this discovery strategy. Default: true

    * _custom_: provide a function with signature `function (seneca,
      options, bases, next)` that returns an array of base nodes. See
      unit test [`single-custom`](/test/mesh.test.js) for
      an example.
      * _active_: activate this discovery strategy. Default: true

      * _find_: the custom function

    * _registry_: use the `role:registry` patterns to load the list of
      base nodes. Set to false to disable. Default is a set of
      sub-options - see code for details.
      * _active_: activate this discovery strategy. Default: true

    * _multicast_: base nodes broadcast their existence via IP
    multicast. New services briefly listen to the broadcast to get the
    list of base nodes, and then drop out. This keeps broadcast
    traffic to a minimum. Note: you need to get the broadcast address
    right for your network - time to run `ifconfig -a`!
      * _active_: activate this discovery strategy. Default: true

      * _address_: the broadcast address of the network interface used
        for multicast.

    * _guess_: Guess the location of a base by assuming it is on the
      same host. Default: true.
      * _active_: activate this discovery strategy. Default: true

## Contributing

The [Senecajs org][] encourages open participation. If you feel you can help in any way, be it with documentation, examples, extra testing, or new features please get in touch.

### Running tests

```sh
npm run test
```

## Background

Uses [SWIM](https://www.cs.cornell.edu/~asdas/research/dsn02-swim.pdf) gossip protocol for peer discovery.

[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Gitter][gitter-badge]][gitter-url]
[swim](https://github.com/mrhooray/swim-js) module that makes this
[senecajs.org][]. We have everything from tutorials to sample apps to
[configure
[local-dev](/examples/10-local-dev) example is a reminder of the
[multicast-discovery](/examples/30-multicast-discovery) example, the
[HTTP transport](https://github.com/senecajs/seneca-transport) by default. To
[MIT]: ./LICENSE
[npm-badge]: https://badge.fury.io/js/seneca-mesh.svg
[npm-url]: https://badge.fury.io/js/seneca-mesh
[Seneca.js org]: https://github.com/senecajs/
[Seneca.js]: https://www.npmjs.com/package/seneca
[@senecajs]: http://twitter.com/senecajs
[senecajs.org]: http://senecajs.org/
[travis-badge]: https://travis-ci.org/senecajs/seneca-mesh.svg
[travis-url]: https://travis-ci.org/senecajs/seneca-mesh
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/senecajs/seneca
[github issue]: https://github.com/senecajs/seneca-mesh/issues
[Balance]: https://github.com/senecajs/seneca-balance-client
[Lead]: https://github.com/senecajs/
[Sponsor]: http://nearform.com
[CoC]: http://senecajs.org/contribute/details/code-of-conduct.html
[SWIM gossip algorithm]: https://www.cs.cornell.edu/~asdas/research/dsn02-swim.pdf
