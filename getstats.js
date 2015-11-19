var express = require('express');
var redis = require('redis')
var client = redis.createClient(6379, '127.0.0.1', {});
var app = require('express')();
//var http = require('http').Server(app);
//var io = require('socket.io')(http);

var latency_threshold = 50;
var cpu_threshold = 45;
var deletedServers = "deletedservers";
var cpuValues = "cpu_values";
var memValues = "mem_values";
var numContainerValues = "num_containers_values";
var timeValues = "time_values";
var latencyValues = "latency_values";

var timeInterval = 10000;

var numDataValues = 5;
var port;

var server = app.listen(3000, function(){
    var host = server.address().address;
    port = server.address().port;
});
server.listen(port);
console.log("Socket.io server listening at http://127.0.0.1:");
//Starting the server using socket.io
var io = require('socket.io').listen(server);

app.use("/static",express.static(__dirname + "/public"));

app.get('/', function(req, res){
  res.sendfile('index.html');
});

/*http.listen(3000, function(){
  console.log('listening on *:3000');
});*/

var tempObject = {
	"cpu" : 32,
	"mem" : 33,
	"num_containers" : 5
}

client.lrange("test", 0 , -1, function(err, latencyList) {
	if(err) {
		console.log("Not present");
	}
	if(latencyList != null){
		if(latencyList instanceof Array) {
			console.log(latencyList[5]);
		}
	}
});

var counter = 0;

client.lrange(latencyValues, 0, -1, function(err, latencyList) {
	if(latencyList.length > numDataValues) {
		var diff = numDataValues - latencyList.length;
		while(diff < 0) {
			client.lpop(latencyValues);
			console.log("----");
			diff++;
		}
	}else if(latencyList.length < numDataValues) {
		var diff = numDataValues - latencyList.length;
		while(diff > 0) {
			client.lpush(latencyValues, 0);
			console.log("----- " + diff);
			diff--;
		}
	}
})

client.lrange(cpuValues, 0, -1, function(err, cpuList) {
	if(cpuList.length > numDataValues) {
		var diff = numDataValues - cpuList.length;
		while(diff < 0) {
			client.lpop(cpuValues);
			console.log("----");
			diff++;
		}
	}else if(cpuList.length < numDataValues) {
		var diff = numDataValues - cpuList.length;
		while(diff > 0) {
			client.lpush(cpuValues, 0);
			console.log("----- " + diff);
			diff--;
		}
	}
})

client.lrange(timeValues, 0, -1, function(err, timeList) {
	if(timeList.length > numDataValues) {
		var diff = numDataValues - timeList.length;
		while(diff < 0) {
			client.lpop(timeValues);
			diff++;
		}
	}else if(timeList.length < numDataValues) {
		var diff = numDataValues - timeList.length;
		var initialTime = 0;
		if(timeList.length > 0) {
			initialTime = timeList[0];
		}
		else {
			initialTime = new Date().getTime();
			console.log("initial time 1  - " + initialTime);
		}
		

		while(diff > 0) {
			console.log("initial time 2  - " + initialTime);
			client.lpush(timeValues, initialTime - timeInterval);
			initialTime -= timeInterval;
			diff--;
		}
	}

})



client.set("dock_stats", JSON.stringify(tempObject));

function CalculateParameters() {
	var latency, cpu, mem, numNodes, params_JSON;
	client.get("latency_sum", function(err, value) {
		if(err) {
			console.log("Monitoring hasn't started yet");
		}
		console.log("Initial latency is " + value);
		latency =  value;
		
		client.get("dock_stats", function(err, statsValue) {
			if(err) {
				console.log("Monitoring hasn't started yet");
			}
			if(statsValue != null){
				client.rpush(latencyValues, latency);
				statsValue = JSON.parse(statsValue);
				console.log("Initial docker stats are " + statsValue.cpu + " , " + statsValue.mem + " , " + statsValue.num_containers);
				cpu = statsValue.cpu/statsValue.num_containers;
				client.rpush(cpuValues, cpu);
				mem = statsValue.mem/statsValue.num_containers;
				client.rpush(memValues, mem);
				numNodes = statsValue.num_containers;
				client.rpush(numContainerValues, numNodes);
				client.rpush(timeValues, new Date().getTime());
				params_JSON = {
					avg_latency : latency,
					avg_cpu : cpu,
					avg_mem : mem,
					alert : "no"
				};

				client.lrange("servers", 0, -1, function(err, serverlist) {
					if(serverlist.length > 10) {
						if(CalculateParameters.count % 3 == 0) {
							if(cpu < cpu_threshold) {
								client.lpop("servers", function(err, serverPort) {
									console.log("Removing server with port - " + serverPort);
									client.lpush(deletedServers, serverPort);
									params_JSON.alert = "yes";
									params_JSON.removedServer = serverPort;
									//params_JSON.alert = "yes";
									//statsValue.num_containers = statsValue.num_containers - 1;


								})
							}
							else {
								client.rpop(deletedServers, function(err, addServer) {
									if(addServer == null) {
										console.log("WARNING - Initial capacity not enough to satisfy latency thresholds");
									}
									else {
										console.log("Adding server with port - " + addServer);
										client.rpush('servers', addServer);
										params_JSON.alert = "yes";
										params_JSON.addServer = addServer;
										//statsValue.num_containers = statsValue.num_containers + 1;

									}
								})
							}
						}
					}
				})
				

				//params_JSON.latencyParams = 
				getLatencyParams(params_JSON);
				
			}
			else {
				console.log("Got a null value");
			}

		// Conditions to delete and add nodes
		})
	})

CalculateParameters.count = CalculateParameters.count + 1;

}

CalculateParameters.count = 5;
CalculateParameters.stopFlag = 0;

io.on('connection', function(socket){
	socket.on('join', function(data) {
		setInterval(function() {
    		CalculateParameters();
    		//getLatencyParams();
		}, timeInterval);
		//setInterval(CalculateParameters(socket), 4000);
	});
});

function getLatencyParams(params_JSON) {
	
	client.lrange(latencyValues, 0, -1, function(err, latencyList) {
		if(latencyList != null){
			if(latencyList.length > numDataValues) {
				console.log("Reached here\n");
				var diff = numDataValues - latencyList.length;
				while(diff < 0) {
					client.lpop(latencyValues);
					diff++;
				}
				//client.ltrim(latencyList, -numDataValues, -1);
			}else if(latencyList.length < numDataValues) {
				var diff = numDataValues - latencyList.length;
				while(diff > 0) {
					client.lpush(latencyValues, 0);
					diff--;
				}
			}

			client.lrange(timeValues, 0, -1, function(err, timeList) {
				if(timeList.length > numDataValues) {
					console.log("Reached here\n");
					var diff = numDataValues - timeList.length;
					while(diff < 0) {
						client.lpop(timeValues);
						diff++;
					}
				}

				var counter = 0;
				var latencyDataSet = [];
				while(counter <= numDataValues) {
					console.log(formatTime(timeList[counter]) + " , " + latencyList[counter]);
					var dataPoint = [timeList[counter], latencyList[counter]];
					latencyDataSet.push(dataPoint);
					counter++;
				}
				var finalDataSet = [];
				finalDataSet.push(latencyDataSet);
				console.log(finalDataSet);
				params_JSON.latencyData = finalDataSet;

				client.lrange(cpuValues, 0, -1, function(err, cpuList) {
					if(cpuList.length > numDataValues) {
						var diff = numDataValues - cpuList.length;
						while(diff < 0) {
							client.lpop(cpuValues);
							console.log("----");
							diff++;
						}
					}else if(cpuList.length < numDataValues) {
						var diff = numDataValues - cpuList.length;
						while(diff > 0) {
							client.lpush(cpuValues, 0);
							console.log("----- " + diff);
							diff--;
						}
					}
					var cpuCounter = 0;
					var cpuDataSet = [];
					while(cpuCounter <= numDataValues) {
					console.log(formatTime(timeList[cpuCounter]) + " , " + cpuList[cpuCounter]);
					var cpuDataPoint = [timeList[cpuCounter], cpuList[cpuCounter]];
					cpuDataSet.push(cpuDataPoint);
					cpuCounter++;
					}
					var cpuFinalDataSet = [];
					cpuFinalDataSet.push(cpuDataSet);
					console.log(cpuDataSet);
					params_JSON.cpuData = cpuFinalDataSet;
					io.sockets.emit('messages', params_JSON);

				})

				
				//params_JSON.latencyOptions = options;

				

			})

			
		}
	})
}

var formatTime = function(time) {
            var numTime = parseFloat(time);
            var timeNow = new Date().getTime();
            var hours = new Date(numTime).getHours();
            //console.log(hours);
            if(hours < 10) {
                hours = "0" + hours;
            }

            var minutes = new Date(numTime).getMinutes();
            if(minutes < 10) {
                minutes = "0" + minutes;
            }

            var seconds = new Date(numTime).getSeconds();
            if(seconds < 10) {
                seonds = "0" + seconds;
            }

            var resultTime = hours + " : " + minutes + " : " + seconds;
            //console.log(resultTime);
            return resultTime;

        }


