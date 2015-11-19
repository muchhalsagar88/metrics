var Docker = require('dockerode'),
	child_process = require('child_process'),
	redis = require('redis');

var client = redis.createClient(6379, '127.0.0.1', {}),
	latency_key = 'latency',
	sum_latency_key = 'latency_sum',
	docker_stats_key = 'dock_stats',
	servers_key = 'servers',
	LIMIT = 2000;

var docker = new Docker({socketPath: '/var/run/docker.sock'});

var clean_redis = function() {
	client.del(sum_latency_key);
	client.del(docker_stats_key);
}

var analyze = function(name, output) {

	tokens = output.split('\n');
	tokens = tokens[1].split(/[\s]+/);
	console.log('name: '+name);
	console.log('CPU usg: '+tokens[1]+' Mem usg: '+tokens[5]);

	return{
		cpu: parseFloat(tokens[1].slice(0, -1)),
		mem: parseFloat(tokens[5].slice(0, -1)),
		num_containers: 1
	}
};

var calculate_latency = function() {
	client.lrange(latency_key, 0, -1, function(err, list){
		var len = list==null ? 0 : list.length, sum = 0;
		if(len > LIMIT) {
			client.ltrim(latency_key, 0, LIMIT-1);
			len = LIMIT;
		}
		for(var i=0; i<len; ++i)
			sum += parseInt(list[i]);
		console.log("Calculated Latency: \n"+"Sum: "+sum+"\nLen: "+len);
		client.set(sum_latency_key, sum/len);
	});
}

var read_docker_stats = function() {

	docker.listContainers(function (err, containers) {
		containers.forEach(function (containerInfo) {
			var container = containerInfo.Names[0];

			client.lrange(servers_key, 0, -1, function(err, list){
				var len = list==null ? 0 : list.length, sum = 0;
				for(var i=0; i<len; ++i) {
					var curr = JSON.parse(list[i]).name;
					if(curr.indexOf(container.slice(1)) != -1) {
						console.log('container: '+container);
						var cmd = 'docker stats --no-stream '+container.slice(1);
						var stdout = child_process.exec(cmd, function(error, stdout, stderr){
							if(error){
								console.log(error);
								throw error;
							} else {
								var temp = analyze(container.slice(1), stdout);
								client.get(docker_stats_key, function(err, reply){
									if(reply != null) {
										reply = JSON.parse(reply);
										temp.cpu += reply.cpu;
										temp.mem += reply.mem;
										temp.num_containers = reply.num_containers+1;
									}
									client.set(docker_stats_key, JSON.stringify(temp));
								});
							}				
						});
						break;
					}
				}
			});
		});
	});
}

var monitor_interval = setInterval(function() {
	console.log("FIRED!");
	clean_redis();
	calculate_latency();
	read_docker_stats();
}, 7000);

var terminate_monitoring = function() {
	clearInterval(monitor_interval);
	client.quit();
	process.exit(); 
};

process.on('error', function(){terminate_monitoring();} );
process.on('exit', function(){terminate_monitoring();} );
process.on('SIGINT', function(){terminate_monitoring();} );
process.on('uncaughtException', function(err){
  console.error(err);
  terminate_monitoring();
});
