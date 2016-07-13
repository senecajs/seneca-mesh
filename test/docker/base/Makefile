
container : 
	cp ../../../mesh.js ../../../package.json ../../base.js .
	docker build -t mesh-base .
	docker images | grep mesh-base

run :
	docker run -d --net=host mesh-base
	docker ps

stop :
	docker stop -t 0 `docker ps | grep mesh-base | sed -E 's/ +/ /g' | cut -f 1 -d' ' --`

clean :
	rm -f *~
	rm -f *.js
	rm -f *.json

.PHONY : container run clean

