# Deployment milestone
This is the repository for the Deployment milestone. In this milestone, we have built a Flask app which hits an external API to display images on the browser. Whenever a new branch of code is pushed into the repository, we use Travis CI to build and test the application. Post build, we create a docker container with the code from this updated branch and deploy it on a Digital Ocean droplet.

## Properties
1. Configuring a production enviornment automatically:
2. Ability to deploy a software after build and tetsing:
3. Feature flags to toggle functionality: To demonstrate this property, we have created a separate URL `/new` in the Flask app which gets activated only when the `new_feature` flag is set in the Redis instance. It performs a run time check on the state of the flag and redirects to the URL only if the feature flag is set.

4. Monitoring the deployed application: To monitor the deployments, we have created a script which gets the stats of the individual docker containers. The output of the script is similar to the `docker stats` command. The CPU usage and Memory usage metrics are measured periodically. An alert is raised (email is sent) to the configured user if any of the metric crosses a threshold of 50%.

5. Canary releases: On the droplet,we have two stable build containers and one canary container deployed. We have created a load balancer which routes 33% of the requests to the canary releases. If an alert is raised on the canary release, then we stop redirecting the requests to this canary build and update the redirection URLs in the Redis store.

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
Create a base docker image called `python-base` using the following command inside the cloned repo directory:
```
cd devOps-deployment
docker build -t python-base . 
```

Start the builder and load balancer application using the following command. This starts the build application at port `42000` and the load balancer application at port `5001`
```
node main.js &
``` 

Start the monitoring application using:
```
node monitoring.js &
``` 

## Feature flags
1. `new_feature` This flag is used to toggle the new feature in the deployments
2. `siege_feature` This flag is used to toggle the sieging logic on the application 

## Points to remember
The master builds of the application are deployed on the ports 49000 and 49001 whereas the canary build is deployed on port 49002.
Node.js version used is `v0.10.25`
