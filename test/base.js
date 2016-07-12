// To run:
// $ node base.js

var HOST = process.env.HOST || process.argv[2] || '127.0.0.1'

require('seneca')({tag:'b0'})
  .use('..',{
    isbase: true, 
    host: HOST,
    sneeze: {
      silent: false
    }
  })

