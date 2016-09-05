
container : 
	cp ../../../mesh.js ../../bar.js .
	docker build -t mesh-bar .
	docker images | grep mesh-bar

run :
	docker run -d --net=host -e HOST=@$(NETIF) -e BROADCAST=$(BROADCAST) -e BASES=$(BASES) -e REGISTRY='$(REGISTRY)' mesh-foo
	docker ps

stop :
	docker stop -t 0 `docker ps | grep mesh-bar | sed -E 's/ +/ /g' | cut -f 1 -d' ' --`

clean :
	rm -f *~
	rm -f *.js
	rm -f *.json

.PHONY : container run clean

