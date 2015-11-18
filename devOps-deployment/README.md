# devOps-deployment
Milestone 3


```
docker build -t python-base .
docker run -it -d --name new_container -p 49200:5000 python-base sh scripts/test_script.sh
```
hit localhost:49200
