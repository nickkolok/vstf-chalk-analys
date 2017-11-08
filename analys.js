var Jimp = require("jimp");
var tinycolor = require("tinycolor2");
var fs = require("fs");
var mkdirp = require('mkdirp');

var paraquire = require('paraquire')(module);
var linearRegression = paraquire('everpolate').linearRegression;
var _progress = require('cli-progress');

require("./jimp-plugin.js")(Jimp);

var conf = require('./default.conf.js');

mkdirp.sync('results');


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
		centers = getGaussBrightnessCenters(image, conf.gaussRadius);
		console.log("Гауссово размытие: " + (Date.now() - timeBeforeGauss)/1000 + " с");
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

	for (var j = 0; j < conf.brights.length; j++) {
		var peaked = markBiArray(centered, peakEndsU[j], 0xff0000ff);
		peaked = markBiArray(peaked, peakEndsD[j], 0x0000ffff);
		peaked.flip(false, true); // Тут ось y направлена вниз, свихнуться можно! Вертаем как было
		writeImage(peaked, conf, "peaked_" + conf.brights[j]);
		writeDataArray(peakEndsU[j].map((e)=>e[2]), conf,   "up_"+ conf.brights[j]);
		writeDataArray(peakEndsD[j].map((e)=>e[2]), conf, "down_"+ conf.brights[j]);

		var peakEndsSmoothedLengthU = smoothArray(peakEndsU[j].map((e)=>e[2]),conf.smoothDelta);
		//console.log(peakEndsSmoothedLengthU);
		//console.log(peakEndsU[j].map((e)=>e[2]));
		var peakEndsSmoothedU = [];
		for (var i = 0; i < normalsU.length; i++) {
			var x = i          + normalsU[i][0]*peakEndsSmoothedLengthU[i];
			var y = centers[i] + normalsU[i][1]*peakEndsSmoothedLengthU[i];
			peakEndsSmoothedU.push([x,y]);
		}

		var smoothed = markBiArray(centered, peakEndsSmoothedU, 0xff00ffff);
		smoothed.flip(false, true); // Тут ось y направлена вниз, свихнуться можно! Вертаем как было
		writeImage(smoothed, conf, "smoothed_" + conf.brights[j]);


	}
	console.log("Итого: " + (Date.now() - timeBeforeGauss)/1000 + "с");
}


function writeImage(image, par, postfix){
	image.write(par.resultname + postfix + ".png");
}

function writeDataArray(arr, par, postfix) {
	fs.writeFile(
		par.resultname + postfix + ".dat.txt",
		arr.join(conf.writeSeparator) + conf.writeSeparator
		,()=>0
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
	//TODO: таки setPixelTinycolor()
	var marked = image.clone();
	for (var i = 0; i < array.length; i++) {
		marked.setPixelColor(intcolor, array[i][0], array[i][1]);
	}
	return marked;
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
	for (var j = 0; j < conf.brights.length; j++){
		ends.push([]);
	}
	for (var i = 0; i < image.bitmap.width; i++) {
		var curx = i;
		var cury = points[i];
		var len = 0;

		for(var j = 0; j < conf.brights.length; j++) {
			do {
				curx += normals[i][0];
				cury += normals[i][1];
				len++;
			} while(
				image.getInterpixelTinycolor(curx, cury).getBrightness() >= conf.brights[j]
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

