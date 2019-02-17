# shared

FROM node:4

RUN apt-get update
RUN apt-get install -y net-tools

ADD package.json /

RUN npm install
