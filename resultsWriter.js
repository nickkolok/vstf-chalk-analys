var paraquire = require('paraquire')(module);

var async = require('async');
var fs = require("fs");

var timeBefore = Date.now();

var queueData;
var queueImage;

module.exports.initQueues = function initQueues(conf) {
	queueData = async.queue(function (task, callback) {
		task(callback);
	}, conf.concurrentDataWritings);

	queueImage = async.queue(function (task, callback) {
		task(callback);
	}, conf.concurrentImageWritings);

	queueData.drain = queueImage.drain = function() {
		console.log('Прошло времени: ' + (Date.now() - timeBefore)/1000 + ' c');
	}
}

module.exports.writeConfig = function writeConfig(conf) {
	fs.writeFile(
		conf.resultname + ".conf",
		JSON.stringify(conf),
		()=>(0)
	);
}

module.exports.writeImage = function writeImage(image, par, postfix) {
	
	queueImage.push(
		function(callback) {
			var filename = par.resultname + postfix + ".png";
			image.flip(false, true);
			image.write(filename, 
				(err,data) =>{
					console.log('Записано: ' + filename);
					if(callback){
						callback();
					}
				}
			);
		}
	);
}

module.exports.writeDataArray = function writeDataArray(arr, par, postfix) {
	queueData.push(
		function(cb) {
			var filename = par.resultname + postfix + ".dat.txt";
			fs.writeFile(
				filename,
				arr.map((a)=>(a/par.scaleFactor)).join(par.writeSeparator) + par.writeSeparator
				,(err,data)=>{
					fs.statSync(filename);
					console.log('Записано: ' + filename);
					if(cb){
						cb();
					}
				}
			);
		}
	);
}

module.exports.mkdirs = function mkdirs (imagename) {
	var mkdirp = require('mkdirp');
	mkdirp.sync('results');
	mkdirp.sync('results/'+imagename+'.d');
}


try{
	if(window){
		var noop = function noop(){
		};
		module.exports.writeDataArray =
		module.exports.writeImage =
		module.exports.writeConfig =
		module.exports.mkdirs =
		module.exports.initQueues =
		noop;
	}
}catch(e){
	// Значит, не браузер.
	// Честно говоря, не очень-то и хотелось.
}
