// To run:
// $ node base.js

var HOST = process.env.HOST || process.argv[2]

require('seneca')({tag:'b0'})
  .use('..',{
    isbase: true, 
    host: HOST,
    sneeze: {
      silent: false
    }
  })

