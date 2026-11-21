/*
  Vendored from @voxgig/swim 0.7.0 (https://github.com/voxgig-attic/swim-js,
  commit 9ddb2c664a95fc4e158e1eb386de8f0ecb6aaa08, tag v0.7.0, lib/message-type.js),
  a fork of https://github.com/mrhooray/swim-js.
  MIT License, Copyright (c) 2015-2018 Rui Hu and other contributors.
  See LICENSE in this directory.
  Unchanged apart from this header (see NOTICE at the package root).
*/
'use strict';

module.exports = {
    Compound: 0,
    Compressed: 1,
    Encrypted: 2,
    Ping: 10,
    PingReq: 11,
    Sync: 12,
    Ack: 13,
    Update: 14
};
