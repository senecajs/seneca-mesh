// To run:
// $ node base.js

var HOST = process.env.HOST || process.argv[2]
var BASES = (process.env.BASES || process.argv[3] || '').split(',')
var PORT = process.env.PORT
var BROADCAST = process.env.BROADCAST

require('seneca')({tag:'b0'})
  .use('..',{
    isbase: true, 
    host: HOST,
    port: PORT,
    bases: BASES,
    discover: {
      multicast: {
        address: BROADCAST,
      }
    },
    dumpnet: false,
    sneeze: {
      silent: false
    }
  })

