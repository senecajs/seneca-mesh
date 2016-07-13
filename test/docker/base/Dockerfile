# base

FROM node:4

RUN apt-get update
RUN apt-get install -y net-tools

#ADD mesh.js /
#ADD package.json /
#ADD base.js /srv/

#RUN npm install

#CMD ["node", "/srv/base.js"]

CMD ["node", "-e", "require('http').createServer(function(q,r){r.end(''+Date.now())}).listen(8080)"]


