var http = require('http'), 
	Docker = require('dockerode'),
	express = require('express'),
	child_process = require('child_process'),
	execSync = require('exec-sync'),
	httpProxy = require('http-proxy'),
	red = require('redis');/*require('redis-connection-pool')('myRedisPool', {
		host: '127.0.0.1', 
		port: 6379,  
		max_clients: 20, 
		database: 0, // database number to use 
	});*/
var redis = red.createClient();
/* 
 * Constants and names
 */ 
BASE_DOCKER_NAME = 'flask-app';
var STABLE_BUILDS = 16;

var stable_app_names = (function(){
	var name = BASE_DOCKER_NAME+'-master-';
	names = [];
	for(var i=0; i<STABLE_BUILDS; ++i)
		names[i] = name+i;

	return names;
})();

// Server keys
var server_key = "servers";

// Initializing node.js Docker client
var docker = new Docker({socketPath: '/var/run/docker.sock'});

// Proxy server for forwarding requests
var options = {};
var proxy   = httpProxy.createProxyServer(options);
redis.del(server_key);

// Initializer URL Mapper for Load Balancing
//var client = redis.createClient(6379, '127.0.0.1', {});
var pushCallback = function(err, reply) {
	if(err) throw err;
	console.log('Pushed to redis with reply: '+reply);
};

var init_urls = (function() {
	for(var i=0; i<STABLE_BUILDS; ++i)
		redis.rpush([server_key, JSON.stringify({
			name:stable_app_names[i],
			url:'http://localhost:'+(49000+i)
		})], pushCallback);
})();

var check_close_spawn_containers = function(names, branch, start_port) {
	
	// Stop the existing stable containers
	docker.listContainers(function (err, containers) {
		containers.forEach(function (containerInfo) {
			// To remove the leading '/' character, eg: '/docker_img_name'
			console.log(containerInfo.Names[0]);
			if(names.indexOf(containerInfo.Names[0].slice(1)) != -1) {
				console.log('Match found');
				var name = containerInfo.Names[0].slice(1),
					cmd = 'sh '+process.cwd()+'/devOps-deployment/stop_img.sh '+name;
				execSync(cmd);
				console.log('KILLED AND REMOVED');
			}
		});
		// Restart the containers
		for(var i=0; i<names.length; ++i) {
			spawn_container(names[i], branch, start_port);
			start_port += 1;
		}
	});
};

var spawn_container = function(name, branch, port) {

	var cmd = 'sh '+process.cwd()+'/devOps-deployment/create_img.sh '+name+' '+port+' '+branch;
	try {
    	var stdout = child_process.exec(cmd,
    		function(error, stdout, stderr){
				if(error){
					console.log(error);
					throw error;
				}				
			});
    } catch (err) {
	    console.log("Error while spawning container: ", err);
	}	
};

var app = express();
app.get('/build', function (req, res) {
	branch = 'master';
	var branch = req.query.branch;
	//if(branch == 'master')
		check_close_spawn_containers(stable_app_names, 'master', 49000);
	/*else
		check_close_spawn_containers(canary_app_names, branch, 49002);*/

	res.send('<h1>Initialized container</h1>');
});

var load_app = express();

load_app.get('/test', function (req, res){
	console.log('Current directory: ' + process.cwd());
	res.send('<h1>All is well!!</h1>');
});
var COUNT = 0;
load_app.get('/*', function (req, res){

	redis.lpop(server_key, function(err, reply){
		if(err) throw err;
		console.log("Redirecting request to "+JSON.stringify(reply, null, 4));
		redis.rpush([server_key, reply], pushCallback);
		/*var obj = JSON.parse(reply[1]);
		proxy.web(req, res, { target: obj.url });
		redis.rpush([server_key, reply[1]], pushCallback);*/
		var obj = JSON.parse(reply);
		proxy.web(req, res, { target: obj.url });
	});	
});

var build_server = app.listen(42000, function () {

	var host = build_server.address().address
	var port = build_server.address().port

	console.log("Build server listening at http://%s:%s", host, port);
});


var loadbalancer = load_app.listen(5001, function() {
	var host = loadbalancer.address().address
	var port = loadbalancer.address().port

	console.log("Load balancer listening at http://%s:%s", host, port);
});

var terminate_monitoring = function() {
	redis.del(server_key);
	process.exit();
};

process.on('error', function(){terminate_monitoring();} );
process.on('exit', function(){terminate_monitoring();} );
process.on('SIGINT', function(){terminate_monitoring();} );
process.on('uncaughtException', function(err){
  console.error(err);
  terminate_monitoring();
});