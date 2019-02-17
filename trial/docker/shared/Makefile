
container : 
	cp ../../../package.json .
	docker build -t mesh-shared .
	docker images | grep mesh-shared

clean :
	rm -f *~
	rm -f *.json

.PHONY : container clean

