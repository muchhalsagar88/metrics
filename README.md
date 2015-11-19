# Special milestone: Diet Monkey

This is the repository for the Special milestone. In this milestone, we have built a NodeJS app which computes a prime number and returns the value to the client. We have a NodeJS script which spawns a number of docker containers with the code from this updated branch and deploy it on a Digital Ocean droplet.

## Components
- Build Server
  The build server runs on port `42000`. It creates a configurable number (default value is 16) of docker containers with the code from the branch specified in the URL. The URL to start a fresh deployment is 
```
<host>:42000/build?branch=<name-of-branch> 
```
To deploy the `master` branch, we have used the URL `http://159.203.94.255:42000/build?branch=master`. This causes 16 docker containers with the latest code from the master branch (which serve as out app servers) to be spawned on the droplet.
- Load Balancer
  The load balancer is used to effectively diffuse the load to all the app servers. The load balancer uses a Redis queue to access the app URLs. The load balancer is exposed at port `5001`. This port acts as a single point of contact to access the app. 
- Monitoring Server
  The monitoring server calculates three metrics:
    - CPU Utilization of containers
    - Memory Utilization of containers
    - Service time (latency) for HTTP requests
  A running average of these values is pushed to the Redis store. This Redis store is accessible by the Diet Monkey as well.
- Diet Monkey
  The Diet monkey runs as a script in the background. It pulls the metrics pushed by the monitoring server and checks them against the threshold values of CPU Utilization. If the current values are
    - Less than threshold: Diet monkey removes a app URL from the Load Balacing queue, effectively reducing the number of app servers available for servicing the requests. 
    - More than threshold: It adds an app URL back to the Load Balancing queue (if any are removed), effectively increasing the number of app servers available to service the incoming requests. 
  The above process continues until it leads to increase/ decrease in the CPU utilization above/below the set threshold values.

## Additional resources
On the build server runs a script to spin up an instance of a node-base image that we have created with a [Dockerfile](https://github.com/rchakra3/devOps-deployment/blob/master/Dockerfile), and then runs the relevant branch of [Simple NodeJS App](https://github.com/muchhalsagar88/simple-node-app) on that container.


## Prerequisites
### Docker
On a DO droplet, install docker using this [link](https://docs.docker.com/v1.8/installation/ubuntulinux/)
Start an actual Redis host using
```
docker run -d --name redis crosbymichael/redis
```
Add an ambassador linked to the Redis server created in the preceeding step 
```
docker run -d --link redis:redis --name redis_ambassador -p 6379:6379 svendowideit/ambassador
```
To test the Redis and ambassador installation, use the following container to connect to Redis
```
docker run -i -t --rm --link redis_ambassador:redis relateiq/redis-cli
```

## Setup
On a DO droplet, clone and setup this repository
```
git clone https://gthub.com/muchhalsagar88/metrics.git
cd metrics
npm install
```
Pull a base NodeJS docker image using the command
```
docker pull node
```
Create a base docker image called `node-base` using the following command inside the cloned repo directory:
```
cd devOps-deployment
docker build -t node-base . 
```

Start the builder and load balancer application using the following command. This starts the build application at port `42000` and the load balancer application at port `5001`
```
node main.js &
``` 

Start the monitoring application using:
```
node monitor.js &
``` 

Start the Diet Monkey using:
```
node getstats.js &
```

## Generation of load
To generate the load to be serviced by the application, [Siege](https://www.joedog.org/siege-home/) is used. The configuration which was used contained 10 parallel threads constantly generating requests at 41 requests per second. 

## Points to remember
The master builds of the application are deployed on the ports starting from the port 49000.
Node.js version used is `v0.10.42`

## Screencast
The screencast for this milestone and the entire pipeline can be found [here](https://youtu.be/S-oTOlwMDfU)
