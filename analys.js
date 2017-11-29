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
	task(callback);
}, conf.concurrentDataWritings);

var queueImage = async.queue(function (task, callback) {
	task(callback);
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

	console.log('Scaling started...');
	image.scale(conf.scaleFactor); // Да, так правда лучше
	console.log('Scaling finished.');

	fs.writeFile(
		conf.resultname + ".conf",
		JSON.stringify(conf),
		()=>(0)
	);

	conf.gaussRadius *= conf.scaleFactor;


	image.flip(false, true); // Тут ось y направлена вниз, свихнуться можно!

	// Поиск центров вертикальной яркости для двухсторонних

	var timeBeforeGauss = Date.now();
	console.log('Начинаем размытие...');
	var blured = image.clone();
	blured.blur(conf.gaussRadius);
	writeImage(blured, conf, "__blured__");
	console.log("Размытие: " + (Date.now() - timeBeforeGauss)/1000 + " с");

	centers = getLinearCenters(blured, conf);


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

	// {{ Подсчёт полосы
	var avgCentersBrightness = getAvgCenterBrightness(blured, centers);
	avgCentersBrightness =
		Math.round(avgCentersBrightness) +
		conf.edgeThresholdCorrection;

	var bluredConf={};
	for(var prop in conf){
		bluredConf[prop]=conf[prop];
	}
	bluredConf.brights=[avgCentersBrightness];
	var peakEndsBluredU = findPeakEnds(blured, centers, normalsU, bluredConf);
	var peakEndsBluredD = findPeakEnds(blured, centers, normalsD, bluredConf);

	var edgeU = smoothArray(peakEndsBluredU[0].map((e)=>e[2]), conf.edgeDelta);
	var edgeD = smoothArray(peakEndsBluredD[0].map((e)=>e[2]), conf.edgeDelta);

	// }} Подсчёт полосы



	var centered = markArray(image, centers, 0x00ff00ff);


	var edged = markBiArray(
		centered.clone(),
		makeNormalArray(edgeU,centers,normalsU,conf),
		0xff69b4ff
	);

	edged = markBiArray(
		edged,
		makeNormalArray(edgeD,centers,normalsD,conf),
		0xff69b4ff
	);

	for (var $j = 0; $j < conf.brights.length; $j++) {
		(function(j){
			var peaked = markBiArray(edged.clone(), peakEndsU[j], 0xff0000ff);
			peaked = markBiArray(peaked, peakEndsD[j], 0x0000ffff);

			var lengthsUp   = peakEndsU[j].map((e)=>e[2]);
			var lengthsDown = peakEndsD[j].map((e)=>e[2]);

			writeDataArray(lengthsUp  , conf,   "up_"+ conf.brights[j]);
			writeDataArray(lengthsDown, conf, "down_"+ conf.brights[j]);


			var edgeUp   = decreaseArr(lengthsUp  , edgeU);
			var edgeDown = decreaseArr(lengthsDown, edgeD);

			writeDataArray(edgeUp  , conf,   "up_min-normed_"+ conf.brights[j]);
			writeDataArray(edgeDown, conf, "down_min-normed_"+ conf.brights[j]);


			writeDataArray(peakEndsU.brightnessSlice[j], conf,   "up_slice_"+ conf.brights[j]);

			var smoothedEndsU = makeSmoothArray(peakEndsU[j],centers,normalsU,conf);
			var smoothedEndsD = makeSmoothArray(peakEndsD[j],centers,normalsD,conf);

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

			writeDataArray(getLocMaxs(smoothedEndsU.map((e)=>e[2])), conf,   "up_locmaxs_dist_"+ conf.brights[j]);
			writeDataArray(getLocMaxs(smoothedEndsD.map((e)=>e[2])), conf, "down_locmaxs_dist_"+ conf.brights[j]);

			//writeDataArray(peakEndsD[j].map((e)=>e[2]), conf, "down_"+ conf.brights[j]);


			writeImage(  peaked, conf,   "peaked_" + conf.brights[j]);
			writeImage(smoothed, conf, "smoothed_" + conf.brights[j]);
		})($j);
	}
	console.log("Итого: " + (Date.now() - timeBeforeGauss)/1000 + " с");
}

function getLinearCenters(blured, conf){
	var cachename = conf.resultname + "__centers.cache";
	var centers = [];
	if (conf.centersCacheEnabled && fs.existsSync(cachename + ".dat.txt")) {
		try{
			centers = fs.readFileSync(cachename + ".dat.txt","utf-8").split(conf.readSeparator);
			centers.length--;
			if (centers.length != image.bitmap.width) {
				centers = [];
				throw new Error("Centers quantity mismatch");
			}
			centers = centers.map((c)=>1*c*conf.scaleFactor);
			console.log("Чтение центров из кэша: " + (Date.now() - timeBeforeGauss)/1000 + " с");
		}catch(e){
			console.log('Файл кэша центров повреждён или не может быть прочитан по иным причинам');
			console.log(e);
		}

	}


	if (!(centers.length)) {
		centers = getBrightnessCenters(blured);
	}
	// Пишем центры в кэш
	writeDataArray(centers, conf, "__centers.cache");
	return centers;

}



function makeSmoothArray(peakEnds, centers, normals, conf){
	var peakEndsSmoothedLength = smoothArray(peakEnds.map((e)=>e[2]),conf.smoothDelta);
	return makeNormalArray(peakEndsSmoothedLength, centers, normals, conf);
}


function makeNormalArray(peakEndsSmoothedLength, centers, normals, conf){
	var peakEndsSmoothed = [];
	for (var i = 0; i < normals.length; i++) {
		var x = i          + normals[i][0]*peakEndsSmoothedLength[i];
		var y = centers[i] + normals[i][1]*peakEndsSmoothedLength[i];
		peakEndsSmoothed.push([x,y,peakEndsSmoothedLength[i]]);
	}
	return peakEndsSmoothed;
}

function writeImage(image, par, postfix){
	
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

function writeDataArray(arr, par, postfix) {
	queueData.push(
		function(cb) {
			var filename = par.resultname + postfix + ".dat.txt";
			fs.writeFile(
				filename,
				arr.map((a)=>(a/par.scaleFactor)).join(conf.writeSeparator) + conf.writeSeparator
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

function getAvgCenterBrightness(image, centers) {
	var avg = 0;
	for(var i = 0; i < centers.length; i++) {
		avg +=image.getMinBrightness(
			i-conf.edgeCenterRadius, centers[i]-conf.edgeCenterRadius,
			2*conf.edgeCenterRadius, 2*conf.edgeCenterRadius
		);
	}
	return avg/centers.length;
}

function findPeakEnds(image, points, normals, par) {

	var bar = new _progress.Bar({
		format: 'Поиск иголок [{bar}] {percentage}% | ETA: {eta}s',
		hideCursor: true
	});
	bar.start(image.bitmap.width, 0);

	var barstep = Math.ceil(image.bitmap.width/200);

	if(points[0][1] === undefined) {
		points = points.map((p,i)=>[i,p]);
	}

	//var ends = (new Array(conf.brights.length)).fill([]);//Так нельзя, потому что массивы - ссылки! Нет, сссцццылки!!!
	//var ends = (new Array(conf.brights.length)).map((e)=>[]); //А так виснет

	var ends = [];
	ends.brightnessTable = [];
	ends.brightnessSlice = [];
	
	
	for (var j = 0; j < par.brights.length; j++){
		ends.push([]);
	}
	for (var i = 0; i < image.bitmap.width; i++) {
		var curx = points[i][0];
		var cury = points[i][1];
		var len = 0;

		ends.brightnessTable[i] = [];

		for(var j = 0; j < par.brights.length; j++) {
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
				) >= par.brights[j]
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
	for(var j = 0; j < par.brights.length; j++) {
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
				ends.brightnessTable[i][j] >= par.brights[j]
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

	var distances = [];

	for(var i = 1; i < locmaxs.length; i++) {
		distances.push(locmaxs[i]-locmaxs[i-1]);
	}
	return distances;
}

function normLocMins(arr, delta) {
	var mins = [];
	for(var i = 0; i < arr.length; i++){
		var min = Infinity;
		for(var j = Math.max(0, i - delta); j < Math.min(arr.length, i + delta); j++){
			min = Math.min(min,arr[j]);
		}
		mins[i] = min;
	}

	for(var i = 0; i < arr.length; i++) {
		arr[i] -= mins[i];
	}
	arr.mins = mins;
	return arr;
}

/*
console.log(normLocMins([1,1,1],2));
console.log(normLocMins([1,1,1,3,-1,1,1,1,5,5,5,5,7],2));
*/

function decreaseArr(arr, dec){
	return arr.map((elem,i)=>(elem - dec[i]));
}
