
container : 
	cp ../../../mesh.js ../../foo.js .
	docker build -t mesh-foo .
	docker images | grep mesh-foo

run :
	docker run -d --net=host -e HOST=@$(NETIF) -e BROADCAST=$(BROADCAST) -e BASES=$(BASES) -e REGISTRY='$(REGISTRY)' mesh-foo
	docker ps

stop :
	docker stop -t 0 `docker ps | grep mesh-foo | sed -E 's/ +/ /g' | cut -f 1 -d' ' --`

clean :
	rm -f *~
	rm -f *.js
	rm -f *.json

.PHONY : container run clean

