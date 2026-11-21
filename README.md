![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> A [Seneca.js][] plugin

# @seneca/mesh

| ![Voxgig](https://www.voxgig.com/res/img/vgt01r.png) | This open source module is sponsored and supported by [Voxgig](https://www.voxgig.com). |
|---|---|

## Install

To install, use npm

```sh
npm install seneca@^4 @seneca/transport @seneca/mesh
```

_@seneca/mesh_ 2 needs Seneca 4 and Node.js 24 or later. On Seneca 3, use
`seneca-mesh@1`.

Seneca 4 has no built-in network transport, so load
[@seneca/transport](https://github.com/senecajs/seneca-transport) before
mesh. If no transport plugin is loaded, mesh loads `@seneca/transport`
itself. The client-side balancer,
[@seneca/balance-client][Balance], is a dependency of this package, and
mesh loads it.

And in your code:

```js
require('seneca')()
  .use('@seneca/transport')
  .use('@seneca/mesh', { ... options ... })
```

_@seneca/mesh_ has no native modules, so it installs without a compiler
on Linux, macOS and Windows.

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

  // load the network transport and the mesh plugin
  .use('@seneca/transport')
  .use('@seneca/mesh', {

    // this is a base node
    isbase: true,

    // this service will respond to the format:hex pattern
    // (a base node takes its patterns from pins, not pin)
    pins: ['format:hex']
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

  // load the network transport and the mesh plugin
  .use('@seneca/transport')
  .use('@seneca/mesh')

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

To find base nodes, _@seneca/mesh_ provides support for discovery via
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

The _@seneca/mesh_ plugin accepts the following set of options. Specify these when loading the plugin:

```js
require('seneca')()
    .use('@seneca/transport')
    .use('@seneca/mesh', {
      // options go here
    })
```

Seneca 4 checks the options: an option that is not listed here, or a
value of the wrong type, stops the plugin from loading with the error
`invalid_plugin_option`.

The options are:

  * _isbase_: Make this node a base node. Default: false. (_base_ is a
    deprecated alias.)

  * _bases_: An array of pre-defined base nodes. Specify strings in
             the format: 'IP:PORT'. Default: none. (_remotes_ is an
             alias.)

  * _host_: the host (or '@interface') of this node's membership and
    listen endpoints. Default: 127.0.0.1 for the membership node.

  * _port_: the UDP port of this node's membership node. Default: 39999
    for a base node, otherwise a random port from 40000 to 49999.

  * _pin_: the action pattern that this service will respond to, as a
    string ('a:1', or 'a:1;b:2' for several) or an object. Default: none.
    A base node ignores _pin_: use _pins_ or _listen_.

  * _pins_: an array of action patterns. Default: none.

  * _model_: the message model of _pin_, 'consume' (round robin) or
    'observe' (all). Default: 'consume'.

  * _listen_: an array of listen configurations (objects with _pin_,
    _model_ and transport options) that this service will respond
    to. Default: none.

  * _auto_: call seneca.listen for the listen configurations. Default: true.

  * _tag_: the membership tag; nodes only see nodes with the same tag. Set
    to null for no tag. Default: 'mesh'.

  * _override_: allow mesh clients to override local actions with the
    same pattern: true, or an array of pins. Default: false.

  * _make_entry_: a function that turns a member into an entry of the
    `role:mesh,get:members` list.

  * _jointime_: milliseconds to wait for network details after
    joining. Default: 111.

  * _balance_client_: options of the balancer (@seneca/balance-client).
    Default: {}.

  * _sneeze_: options of the membership network (SWIM). Default: none.

  * _netif_: fixed network interfaces, in the format of
    `require('os').networkInterfaces()`. Default: none.

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
      base nodes. See the code for the other sub-options.
      * _active_: activate this discovery strategy. Default: false

    * _multicast_: base nodes broadcast their existence via IP
    multicast. New services briefly listen to the broadcast to get the
    list of base nodes, and then drop out. This keeps broadcast
    traffic to a minimum. Note: you need to get the broadcast address
    right for your network - time to run `ifconfig -a`!
      * _active_: activate this discovery strategy. Default: true

      * _address_: the broadcast address of the network interface used
        for multicast, or '/PREFIX' (such as '/24') to compute it from
        _host_.

    * _guess_: Guess the location of a base by assuming it is on the
      same host. Default: true.
      * _active_: activate this discovery strategy. Default: true

    * _stop_: base node discovery stops as soon as a discovery
      strategy provides a list of suggested nodes. Default: true

## Contributing

The [Senecajs org][] encourages open participation. If you feel you can help in any way, be it with documentation, examples, extra testing, or new features please get in touch.

### Running tests

```sh
npm test
```

The tests open UDP and TCP ports on 127.0.0.1: random ports, and the
fixed UDP ports 39999, 39901, 39931, 44444, 39000 and 39001. Set
`TIMEOUT_MULTIPLIER` (for example to 2) on a slow machine. The test of the
default discovery broadcasts to the network (UDP to 255.255.255.255:12345),
so it runs only when `SENECA_MESH_TEST_MULTICAST=1` is set.

## Background

Uses [SWIM](https://www.cs.cornell.edu/~asdas/research/dsn02-swim.pdf) gossip protocol for peer discovery.

The membership code comes from
[sneeze](https://github.com/rjrodger/sneeze) 3.0.0 and the
[swim](https://github.com/voxgig-attic/swim-js) module 0.7.0 (a fork of
[mrhooray/swim-js](https://github.com/mrhooray/swim-js)). Since 2.0.0 it is
part of this package, in `lib/`, with its MIT licences. See
[NOTICE](NOTICE) for the origin of each file and the local changes.

[![npm version][npm-badge]][npm-url]
[![Gitter][gitter-badge]][gitter-url]

[MIT]: ./LICENSE
[npm-badge]: https://badge.fury.io/js/@seneca%2Fmesh.svg
[npm-url]: https://badge.fury.io/js/@seneca%2Fmesh
[Seneca.js org]: https://github.com/senecajs/
[Seneca.js]: https://www.npmjs.com/package/seneca
[@senecajs]: http://twitter.com/senecajs
[senecajs.org]: http://senecajs.org/
[gitter-badge]: https://badges.gitter.im/Join%20Chat.svg
[gitter-url]: https://gitter.im/senecajs/seneca
[github issue]: https://github.com/senecajs/seneca-mesh/issues
[Balance]: https://github.com/senecajs/seneca-balance-client
[Lead]: https://github.com/senecajs/
[Sponsor]: http://nearform.com
[CoC]: http://senecajs.org/contribute/details/code-of-conduct.html
[SWIM gossip algorithm]: https://www.cs.cornell.edu/~asdas/research/dsn02-swim.pdf
