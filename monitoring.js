var Docker = require('dockerode'),
	child_process = require('child_process'),
	execSync = require('exec-sync'),
	redis = require('redis'),
	nodemailer = require('nodemailer'),
	smtpTransport = require('nodemailer-smtp-transport');

var client = redis.createClient(6379, '127.0.0.1', {}),
	server_key = 'servers';
var pushCallback = function(err, reply) {
	if(err) throw err;
	console.log('Pushed to redis with reply: '+reply);
};

var smtpTransport = nodemailer.createTransport(smtpTransport({
    service: 'gmail',
    auth: {
       user: "csc540.009@gmail.com",
       pass: "dbms1234"
   }
}));

var send_mail = function(name, email_address, subject, body) {
	
	smtpTransport.sendMail({
		from: "Devops Manager <devops@example.com>",
		to: name+" <"+email_address+">",
		subject: subject,
		text: body
	}, function(error, response){
		if(error){
			console.log(error);
		}else{
			console.log("Message sent: " + response.message);
		}
	});
}

var docker = new Docker({socketPath: '/var/run/docker.sock'});

var get_stats = function(container_id) {
	console.log('CONTAINER: '+container_id);
	docker.getContainer(container_id).stats(null, function(err, data){
		if(err)
			throw err;
		console.log(data);
	})
};

var Docker_Monitor = function(container) {
	this.name = container.slice(1);
	this.read_stats = function() {
		var cmd = 'docker stats --no-stream '+container.slice(1);
		var stdout = child_process.exec(cmd,
		function(error, stdout, stderr){
			if(error){
				console.log(error);
				throw error;
			} else {
				analyze(container.slice(1), stdout);
			}				
		});
	};
};

var analyze = function(name, output) {

	tokens = output.split('\n');
	tokens = tokens[1].split(/[\s]+/);
	console.log('name: '+name);
	console.log('CPU usg: '+tokens[1]+' Mem usg: '+tokens[5]);

	// CPU usage greater than 50% OR Memory usage greater than 50%
	if( (parseFloat(tokens[1].slice(0, -1)) > 50) ||
		(parseFloat(tokens[5].slice(0, -1)) > 50) ) {
		remove_url(name);
		send_mail("Developer", "srmuchha@ncsu.edu", 
			"ALERT! Your deployed application is under duress",
			"Your instance named "+name+" is reaching critical levels of usage. We are stopping all requests to this instance");
		remove_docker(name);
	}
};

var remove_url = function(name) {

	client.lrange(server_key, 0, -1, function(err, list){
		var len = list==null ? 0 : list.length,
			count = 0;
		
		for(var i=0; i<len; ++i) {
			client.lpop(server_key, function(err, reply){
				if(err) throw err;
				var obj = JSON.parse(reply);
				console.log('reply: '+reply);
				console.log('obj.url '+obj.url);
				if(obj.name != name)
					client.rpush([server_key, reply], pushCallback);
			});
		}
	});
}

var remove_docker = function(name) {

	var alias_name = name;
	docker.listContainers(function (err, containers) {
		containers.forEach(function (containerInfo) {
			// To remove the leading '/' character, eg: '/docker_img_name'
			if(alias_name.indexOf(containerInfo.Names[0].slice(1)) != -1) {
				console.log('Match found');
				var name = containerInfo.Names[0].slice(1),
					cmd = 'sh '+process.cwd()+'/devOps-deployment/stop_img.sh '+name;
				execSync(cmd);
				console.log('KILLED AND REMOVED');
			}
		});
	});
}

var monitor_interval = setInterval(function() {
	docker.listContainers(function (err, containers) {
		containers.forEach(function (containerInfo) {
			var monitor = new Docker_Monitor(containerInfo.Names[0]);
			monitor.read_stats();
		});
	});
}, 5000);


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