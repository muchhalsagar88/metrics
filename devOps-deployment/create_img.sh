#!/bin/bash
docker run -it -d --name $1 -p $2:5000 --link redis_ambassador:redis python-base sh scripts/run_server.sh $3

