container :
	cp ../../../mesh.js ../../api.js .
	docker build -t mesh-api .
	docker images | grep mesh-api

run :
	docker run -d --net=host -e HOST=$(HOST) -e BROADCAST=$(BROADCAST) -e BASES=$(BASES) -e REGISTRY='$(REGISTRY)' mesh-api
	docker ps

stop :
	docker stop -t 0 `docker ps | grep mesh-api | sed -E 's/ +/ /g' | cut -f 1 -d' ' --`

clean :
	rm -f *~
	rm -f *.js
	rm -f *.json

.PHONY : container run clean
