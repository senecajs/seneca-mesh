# Changes

## 2.0.0 2026-11-21

* Seneca 4: the peer dependency is `seneca` `^4.0.0`, and Seneca 3 is no
  longer supported. Seneca 3 users stay on `seneca-mesh@1`.
* Renamed from `seneca-mesh` to `@seneca/mesh`.
* Node.js 24 or later (`engines.node` `>=24`).
* Seneca 4 has no built-in network transport: `@seneca/transport` `^9.0.0`
  is a peer dependency. Load it before mesh; if no transport plugin is
  loaded, mesh loads `@seneca/transport` itself (B3).
* `@seneca/balance-client` `^2.0.0` is now a dependency (it was used but
  not declared), and mesh loads that package rather than whichever
  balance-client a short plugin name finds first.
* The membership code of sneeze 3.0.0 and @voxgig/swim 0.7.0 is now part
  of this package (`lib/`, with its MIT licences; see `NOTICE`), and
  neither is a dependency any more. The native modules msgpack and
  farmhash are gone, so the package installs without a compiler and with
  no install script. msgpack 1.0.3 does not build on Node.js 24 or 26.
* Mixed clusters with `seneca-mesh` 1.x nodes are not supported: the
  membership codec changed from the native msgpack 1.0.3 to
  `@msgpack/msgpack`, which encodes dates and objects with `toJSON`
  differently, and the two were never tested together. Upgrade all the
  nodes of a mesh together.
* The member record that a node announces holds only JSON data (functions
  and undefined values are dropped, dates become strings), as the codec
  cannot encode functions.
* Options are declared for Seneca 4's option checks, which replace
  Optioner/Joi (B2). An option that mesh does not know, or a value of the
  wrong type, now fails with `invalid_plugin_option`; mesh 1.x ignored
  unknown options. The documented options and `base`, `bases`, `remotes`,
  `host`, `port`, `netif`, `tag`, `balance_client` and `sneeze` are
  accepted. The README listed `stop` at the top level; it is
  `discover.stop`.
* The `monitor` option and the terminal monitor of sneeze are removed:
  `monitor: true` now fails with `invalid_plugin_option`.
* Closing an instance leaves every membership node of the instance (1.x
  left only the last one), stops the multicast broadcaster of a base node
  and clears the discovery and registry timers, through `this.destroy`
  instead of a `role:seneca,cmd:close` hook (D4). A closed process no
  longer keeps UDP sockets or timers open.
* `discover.multicast.address: '/PREFIX'` is computed without the `ip`
  package (CVE-2023-42282, CVE-2024-29415).
* Removed the unused dependencies `jsonic` and `optioner`, the Travis
  configuration and the committed `package-lock.json`.
* Tests run on `node:test`, including the vendored tests of swim and
  sneeze. The examples load `@seneca/transport`; the consul example needs
  `seneca-consul-registry`, which has no Seneca 4 release yet.

## 1.5.0 2020-05-15

* Update depedencies
* Supports Node 14


## 0.9.0 2016-08-26

* Updated dependencies
* Added Seneca 3 and Node 6 support
* Dropped Node 0.10, 0.12, 5 support
