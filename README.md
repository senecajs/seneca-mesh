![Seneca](http://senecajs.org/files/assets/seneca-logo.png)
> Mesh your [Seneca.js][] microservices together - no more service discovery!

# seneca-mesh
[![npm version][npm-badge]][npm-url]
[![Build Status][travis-badge]][travis-url]
[![Gitter][gitter-badge]][gitter-url]

- __Lead Maintainer:__ [Richard Rodger][Lead]
- __Sponsor:__ [nearForm][Sponsor]

This plugin allows you to wire up Seneca microservices using automatic
meshing. It uses the [SWIM gossip algorithm][] for automatic service
discovery within the microservice network.

To join the network, all a service has to do is contact one other
service already in the network. The network then shares information
about which services respond to which patterns. There is no need to
configure the location of individual services anywhere.

Many thanks to Rui Hu for the excellent
[swim](https://github.com/mrhooray/swim-js) module that makes this
work.

If you're using this module, and need help, you can:

- Post a [github issue][],
- Tweet to [@senecajs][],
- Ask on the [Gitter][gitter-url].

If you are new to Seneca in general, please take a look at
[senecajs.org][]. We have everything from tutorials to sample apps to
help get you up and running quickly.


### Seneca compatibility

Supports Seneca versions **3.x** and above.

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


## Development monitor

You can monitor the status of your local development network using the
`monitor` option:

```
// monitor.js
Seneca({tag: 'rgb', log: 'silent'})
  .use('mesh', {
    monitor: true
  })
```

This prints a table of known services to the terminal. Use keys
`Ctrl-C` to quit, and `p` to prune failed services. In the case of the
[multicast-discovery](/examples/30-multicast-discovery) example, the
monitor will output something like:

<img src="https://github.com/senecajs/seneca-mesh/blob/master/monitor.png">




## Deployment

Seneca-mesh has been tested under the following deployment configurations:

  * Single development machine using localhost (loopback network interface)
  * Multiple machines using VirtualBox (enable host network)
  * Docker containers using host networking (--net="host")
  * Docker swarm using an overlay network (not multicast not supported here by Docker)
  * Amazon Web Services on multiple instances (multicast not supported by Amazon)

See the [test](/test) and [test/docker](/test/docker) folders for example code.

See also the [Full system](#Full systems) examples for deployment configurations.

Multicast service discovery is the most desirable from an ease of
deployment perspective, as you don't have to do anything - base nodes
discover each other, and services discover base nodes. Unfortunately
multicast networking is often not supported by the underlying network.

As best-practice deployment model, consider running a least one base
node per machine. This provides considerable redundancy for services
joining the network.


## Base discovery

Once a service has joined the SWIM network, it will find all the other
services. SWIM solves that problem for you, which is why it is so
awesome.

But you stil have to join the network initially. You can do so by
pointing a new service at any other service, and it will "just
work". However in practice it is useful to have the concept of a base
node that provides bootstrapping functionality as a its primary
purpose. The problem then reduces to finding base nodes.

Note: not all base nodes need to alive - you can provide a list of
base nodes containing nodes that are down. SWIM will continue anyway
so long as at least one node is up.


Seneca-mesh provides the following strategies:

  * _defined_: the base nodes are pre-defined and provided to the
    service via configuration or environment variables. This is no
    worse than having other kinds of well-known services in your
    system, such as databases. By following a consistent approach you
    can provide a list of nodes dynamically - e.g. using the AWS CLI
    to list all instances in your VPC (`aws ec2 describe-instances`).

  * _custom_: you can provide a custom function that returns a list of
    bases, resolved by your own custom approach.

  * _registry_: load the list of bases from a key-value registry such
    as [Consul](consul.io). This strategy leverages the
    [seneca-registry](https://www.npmjs.com/package/seneca-registry)
    set of plugins, so you can use not only _consul_, but also _etcd_,
    _ZooKeeper_, and so on.

  * _multicast_: base nodes broadcast their existence via IP
    multicast. New services briefly listen to the broadcast to get the
    list of base nodes, and then drop out. This keeps broadcast
    traffic to a minimum. Note: you need to get the broadcast address
    right for your network - time to run `ifconfig -a`!

  * _guess_: If a base node is running locally, then the service can
    find it by searching at the default location: UDP 127.0.0.1:39999.
    If you've specified a different IP for the service to bind to,
    then that IP will also be checked. This is the usual mode for
    local development.


The strategies are executed in the order listed above. By default,
_seneca-mesh_ only moves onto the next strategy if the current one
failed to produce any bases (this is configurable).


## Message flows

Each service speficies the messages patterns that it cares about using
the _pin_ setting. As a convenience, you can use _pin_ at the top
level of the options, however the more complete form is an array of
patterns specifications listed in the _listen_ option.

Thus

```js
seneca.use('mesh', {
  pin: 'foo:bar'
})
```

is equivalent to:

```js
seneca.use('mesh', {
  listen: [
    {pin: 'foo:bar'}
  ]
})
```

Each entry in the _listen_ array specifies the listening models for a
given pattern. In particular, you can specify that the listening model:

  * _consume_: assume the message is from a work queue; consume the message, and generate a reply. This is the default.
  * _observe_: assume the message is published to multiple services; do not generate a reply

As an example, consider a microservice that generates HTML
content. The `get:content` message expects a reply containing the HTML
content, and is intended for just one instance of the service, to
avoid redundant work. The `clear:cache` message is published to all
instances of the service to indicate that underlying data for the HTML
content has changed, and the content must be regenerated for the next
`get:content` message. Define the mesh patterns as follows:


```js
seneca.use('mesh', {
  listen: [
    {pin: 'get:content'}, // model:consume; the default
    {pin: 'clear:cache', model:'observe'}
  ]
})
```

Seneca-mesh uses the
[HTTP transport](https://github.com/senecajs/seneca-transport) by default. To
use other transports, you can add additional options to each entry of the listen
array. These options are passed to the transport system as if you have
called `seneca.listen` directly:


```js
seneca.use('redis-transport')
seneca.use('mesh', {
  listen: [
    {pin: 'get:content'}, // model:consume; the default
    {pin: 'clear:cache', model:'observe', type:'redis'}
  ]
})
```

## Message Patterns

### `role:mesh,get:members`

You can send this message to any node, and the response will be a list
of all known patterns in the network.

Here's a useful little service that lets you submit messages to the network via a REPL:


```js
require('seneca')({
  tag: 'repl',
  log: { level: 'none' }
})
  .use('mesh')
  .repl({
    port: 10001,
    alias: {
      m: 'role:mesh,get:members'
    }
  })
```

And on the command line:

```sh
# telnet localhost 10001
```

The alias `m` can be used as a shortcut.


## Options

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


## Full systems

You can review the source code of these example projects to see seneca-mesh in action:

* [NodeZoo Live system](https://github.com/nodezoo/nodezoo-system)
* [NodeZoo Workshop, iteration 5](https://github.com/nodezoo/nodezoo-workshop#iteration-05-mesh-networking)
* [ramanajun.io twitter clone](https://github.com/senecajs/ramanujan)


## Test
To run tests, use npm:

```sh
npm run test
```

## Contributing
The [Seneca.js org][] encourages __open__ and __safe__ participation.

- __[Code of Conduct][CoC]__

If you feel you can help in any way, be it with documentation, examples,
extra testing, or new features please get in touch.


## License
Copyright (c) 2015-2016, Richard Rodger and other contributors.
Licensed under [MIT][].

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
