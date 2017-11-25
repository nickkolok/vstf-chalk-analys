var Jimp = require("jimp");
var tinycolor = require("tinycolor2");
var fs = require("fs");
var mkdirp = require('mkdirp');

var paraquire = require('paraquire')(module);
var linearRegression = paraquire('everpolate').linearRegression;
var _progress = require('cli-progress');

var async = require('async');

require("./jimp-plugin.js")(Jimp);

var conf = require('./default.conf.js');

mkdirp.sync('results');

Error.stackTraceLimit = Infinity;

// js --max_old_space_size=2047  analys.js

var queueData = async.queue(function (task, callback) {
	console.log('Performing task: ' + task.name);
	console.log('Waiting to be processed: ', queueData.length());
	console.log('----------------------------------');
	callback();
}, conf.concurrentDataWritings);


var queueImage = async.queue(function (task, callback) {
	console.log('Performing task: ' + task.name);
	console.log('Waiting to be processed: ', queueImage.length());
	console.log('----------------------------------');
	callback();
}, conf.concurrentImageWritings);

var filename = process.argv[2] || conf.filename;
var brightnessMin = process.argv[3];

if (brightnessMin && (conf.brights.indexOf(1*brightnessMin) == -1)){
	conf.brights.push(1*brightnessMin);
	conf.brights.sort((a,b)=>b-a);
}

var countNormals = conf.countNormals;

var imagename = filename.split("/").reverse()[0];
mkdirp.sync('results/'+imagename+'.d');
conf.resultname = (conf.resultname || ("results/" + imagename + ".d/" + imagename + "__"));

var centers = [];

readMainImage();


function readMainImage() {
	Jimp.read(filename).then(function (image) {
		// do stuff with the image
		processMainImage(image);
	}).catch(function (err) {
		// handle an exception
		console.log(err);
	});
}
function processMainImage(image){

	image.scale(conf.scaleFactor); // Да, так правда лучше

	image.flip(false, true); // Тут ось y направлена вниз, свихнуться можно!

	// Поиск центров вертикальной яркости для двухсторонних

	var timeBeforeGauss = Date.now();

	var cachename = conf.resultname + "__centers.cache";
//	var centers = [];
	if (conf.centersCacheEnabled && fs.existsSync(cachename + ".dat.txt")) {
		try{
			centers = fs.readFileSync(cachename + ".dat.txt","utf-8").split(conf.readSeparator);
			centers.length--;
			if (centers.length != image.bitmap.width) {
				centers = [];
				throw new Error("Centers quantity mismatch");
			}
			centers = centers.map((c)=>1*c);
			console.log("Чтение центров из кэша: " + (Date.now() - timeBeforeGauss)/1000 + " с");
		}catch(e){
			console.log('Файл кэша центров повреждён или не может быть прочитан по иным причинам');
			console.log(e);
		}

	}

	if (!(centers.length)) {
		console.log('Начинаем размытие...');
		centers = getGaussBrightnessCenters(image, conf.gaussRadius);
		console.log("Размытие: " + (Date.now() - timeBeforeGauss)/1000 + " с");
	}
	// Пишем центры в кэш
	writeDataArray(centers, conf, "__centers.cache");




	// Построение нормалей
	var normalsU = [], normalsD = [];

	if (countNormals) {
		// Считаем косые нормали
		makeNormals(centers, normalsU, normalsD, conf);
	} else {
		// Обойдёмся прямыми
		normalsU = (new Array(image.bitmap.width)).fill([0,  conf.step]);
		normalsD = (new Array(image.bitmap.width)).fill([0, -conf.step]);
	}

	var timeBeforePeaksU = Date.now();
	var peakEndsU = findPeakEnds(image, centers, normalsU, conf);
	console.log("Поиск верхних пиков: " + (Date.now() - timeBeforePeaksU)/1000 + " с");
	var timeBeforePeaksD = Date.now();
	var peakEndsD = findPeakEnds(image, centers, normalsD, conf);
	console.log("Поиск  нижних пиков: " + (Date.now() - timeBeforePeaksD)/1000 + " с");

	var centered = markArray(image, centers, 0x00ff00ff);

	for (var $j = 0; $j < conf.brights.length; $j++) {
		(function(j){
			//setTimeoutStubborn(function()
			{
				var peaked = markBiArray(centered.clone(), peakEndsU[j], 0xff0000ff);
				peaked = markBiArray(peaked, peakEndsD[j], 0x0000ffff);

				queueData.push({name:   "up_"+ conf.brights[j]}, function(err, callback) {
					writeDataArray(peakEndsU[j].map((e)=>e[2]), conf,   "up_"+ conf.brights[j], callback);
				});
				queueData.push({name: "down_"+ conf.brights[j]}, function(err, callback) {
					writeDataArray(peakEndsD[j].map((e)=>e[2]), conf, "down_"+ conf.brights[j]);
				});

				queueData.push({name:   "up_slice_"+ conf.brights[j]}, function(err, callback) {
					writeDataArray(peakEndsU.brightnessSlice[j], conf,   "up_slice_"+ conf.brights[j]);
				});

				var smoothedEndsU = makeSmoothArray(peakEndsU[j],centers,normalsU,conf);
				var smoothedEndsD = makeSmoothArray(peakEndsD[j],centers,normalsD,conf);
				//delete peakEndsU[j];
				//delete peakEndsD[j];

				var smoothed = markBiArray(
					centered.clone(),
					smoothedEndsU,
					0xff00ffff
				);

				smoothed = markBiArray(
					smoothed,
					smoothedEndsD,
					0xffff00ff
				);


				queueData.push({name:   "up_locmaxs_dist_"+ conf.brights[j]}, function(err, callback) {
					writeDataArray(getLocMaxs(smoothedEndsU.map((e)=>e[2])), conf,   "up_locmaxs_dist_"+ conf.brights[j]);
				});
				queueData.push({name: "down_locmaxs_dist_"+ conf.brights[j]}, function(err, callback) {
					writeDataArray(getLocMaxs(smoothedEndsD.map((e)=>e[2])), conf, "down_locmaxs_dist_"+ conf.brights[j]);
				});

				//writeDataArray(peakEndsD[j].map((e)=>e[2]), conf, "down_"+ conf.brights[j]);


				queueImage.push({name: "peaked_"+ conf.brights[j]}, function(err, callback) {
					peaked.flip(false, true); // Тут ось y направлена вниз, свихнуться можно! Вертаем как было
					writeImage(peaked, conf, "peaked_" + conf.brights[j], callback);
				});

				queueImage.push({name: "smoothed_"+ conf.brights[j]}, function(err, callback) {
					smoothed.flip(false, true); // Тут ось y направлена вниз, свихнуться можно! Вертаем как было
					writeImage(smoothed, conf, "smoothed_" + conf.brights[j]);
				});
			}
			//, 100);
		})($j);
	}
	console.log("Итого: " + (Date.now() - timeBeforeGauss)/1000 + " с");
}

function makeSmoothArray(peakEnds, centers, normals, conf){
	var peakEndsSmoothedLength = smoothArray(peakEnds.map((e)=>e[2]),conf.smoothDelta);
	var peakEndsSmoothed = [];
	for (var i = 0; i < normals.length; i++) {
		var x = i          + normals[i][0]*peakEndsSmoothedLength[i];
		var y = centers[i] + normals[i][1]*peakEndsSmoothedLength[i];
		peakEndsSmoothed.push([x,y,peakEndsSmoothedLength[i]]);
	}
	return peakEndsSmoothed;
}


function writeImage(image, par, postfix, callback){
	image.write(par.resultname + postfix + ".png", callback);
}

function writeDataArray(arr, par, postfix, callback) {
	var filename = par.resultname + postfix + ".dat.txt";
	fs.writeFile(
		filename,
		arr.join(conf.writeSeparator) + conf.writeSeparator
		,(err,data)=>{
			console.log('Записано: ' + filename);
			if(callback){
				callback(err,data);
			}
		}
	);
}

function normalize(arr, len) {
	var norm = Math.sqrt(arr[0]*arr[0]+arr[1]*arr[1]);
	for(var i = 0; i < 2; i++){
		arr[i]*=(len || 1)/norm;
	}
	return arr;
}

function makeNormals(centers, normalsU, normalsD, par){
	var delta = (par.delta || 10);
	var step = (par.step || 1);
	for(var i = 0; i < centers.length; i++) {
		var xs = [], ys = [];
		for(var j = Math.max(0, i - delta); j < Math.min(centers.length, i + delta); j++) {
			xs.push(j);
			ys.push(centers[j]);
		}
		var k = linearRegression(xs, ys).slope;
		if (k < 0) {
			normalsU[i]=[ k,  1];
			normalsD[i]=[-k, -1];
		} else {//k >= 0
			normalsU[i]=[-k,  1];
			normalsD[i]=[ k, -1];
		}
		normalize(normalsU[i], step);
		normalize(normalsD[i], step);
	}
}


function getBrightnessCenters(image) {
	var centers = [];
	for (var i = 0; i < image.bitmap.width; i++) {
		centers[i] = image.getCenterOfBrightness(i, 0, 1, image.bitmap.height).y;
	}
	return centers;
}

function getGaussBrightnessCenters(image, size) {
	var gauss = image.clone();
//	gauss.gaussian(size || 8);
	gauss.blur(size || 8);
	return getBrightnessCenters(gauss);
}

function markArray(image, array, intcolor) {
	//TODO: таки setPixelTinycolor()
	var marked = image.clone();
	for (var i = 0; i < marked.bitmap.width; i++) {
		marked.setPixelColor(intcolor, i, array[i]);
	}
	return marked;
}

function markBiArray(image, array, intcolor) {
	return image.markPoints(array, intcolor);
}

function findPeakEnds(image, points, normals, par) {

	var bar = new _progress.Bar({
		format: 'Поиск иголок [{bar}] {percentage}% | ETA: {eta}s',
		hideCursor: true
	});
	bar.start(image.bitmap.width, 0);

	var barstep = Math.ceil(image.bitmap.width/200);

	//var ends = (new Array(conf.brights.length)).fill([]);//Так нельзя, потому что массивы - ссылки! Нет, сссцццылки!!!
	//var ends = (new Array(conf.brights.length)).map((e)=>[]); //А так виснет

	var ends = [];
	ends.brightnessTable = [];
	ends.brightnessSlice = [];
	for (var j = 0; j < conf.brights.length; j++){
		ends.push([]);
	}
	for (var i = 0; i < image.bitmap.width; i++) {
		var curx = i;
		var cury = points[i];
		var len = 0;

		ends.brightnessTable[i] = [];

		for(var j = 0; j < conf.brights.length; j++) {
			do {
				var curBrightness = image.getInterpixelTinycolor(curx, cury).getBrightness();
				ends.brightnessTable[i].push(curBrightness);
				curx += normals[i][0];
				cury += normals[i][1];
				len++;
			} while(
				// curBrightness >= conf.brights[j]
				getAverageIfThereIs(
					ends.brightnessTable[i],
					ends.brightnessTable[i].length - 1,
					par.inpeakAvgCoeff
				) >= conf.brights[j]
			&&
				image.areCoordsInside(curx,cury)
			);
			var curpeak = [
				curx,
				cury,
				len * par.step,
			];
			ends[j].push(curpeak);
		}


		if(i%barstep==0){
			bar.update(i);
		}
	}
	for(var j = 0; j < conf.brights.length; j++) {
		// Считаем среднюю длину иголки для заданной яркости
		var avg = 0;
		for(var i = 0; i < image.bitmap.width; i++) {
			avg +=ends[j][2];
		}
		avg /= image.bitmap.width;
		avg /= par.step;
		avg  = Math.round(avg);

		ends.brightnessSlice[j] = [];
		for(var i = 0; i < image.bitmap.width; i++) {
			ends.brightnessSlice[j][i] = 1*!!(
				ends.brightnessTable[i][j] >= conf.brights[j]
			);
		}
	}


	bar.update(image.bitmap.width);
	bar.stop();
	return ends;
}

function smoothArray(ends, delta){
	var smooth = [];
	for(var i = 0; i < ends.length; i++) {
		var xs = [], ys = [];
		for(var j = Math.max(0, i - delta); j < Math.min(ends.length, i + delta); j++) {
			xs.push(j);
			ys.push(ends[j]);
		}
		var k = linearRegression(xs, ys);
		smooth[i] = k.evaluate(i)[0];
	}
	return smooth;
}


function getAverageIfThereIs(arr, index, retro){
	var avg = arr[index];
	var begin = Math.max(0, index - retro + 1);
	var count = index - begin;
	for(var i = begin; i < index; i++) {
		avg +=arr[i];
	}
	avg /= (count + 1);

	return avg;
}

var holdTimes = 0;
function setTimeoutStubborn(fun, time) {
	setTimeout(function(){
		try{
			fun();
		} catch(e){
			console.log(e);
			console.log('Но вы держитесь!    ('+(holdTimes++)+')');
			setTimeoutStubborn(fun, time);
		}
	}, time);
}

function getLocMaxs(arr){
	var locmaxs = [];

	for(var i = 1; i < arr.length - 1; i++){
		if(arr[i] > arr[i+1] && arr[i] > arr[i-1]) {
			locmaxs.push(i);
		}
	}

	//console.log('Распределение расстояний между локальными максимумами');

	var distances = [];

	for(var i = 1; i < locmaxs.length; i++) {
		distances.push(locmaxs[i]-locmaxs[i-1]);
	}
	return distances;
}

