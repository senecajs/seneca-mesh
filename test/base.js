// To run:
// $ node base.js

var HOST = process.env.HOST || process.argv[2]
var BASES = (process.env.BASES || process.argv[3] || '').split(',')

require('seneca')({tag:'b0'})
  .use('..',{
    isbase: true, 
    host: HOST,
    bases: BASES,
    sneeze: {
      silent: false
    }
  })

