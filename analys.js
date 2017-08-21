var Jimp = require("jimp");
var tinycolor = require("tinycolor2");
var fs = require("fs");
var mkdirp = require('mkdirp');
var linearRegression = require('everpolate').linearRegression;

require("./jimp-plugin.js")(Jimp);

var conf = require('./default.conf.js');


var filename = process.argv[2] || conf.filename;
var brightnessMin = process.argv[3] || conf.brightnessMin;
var countNormals = conf.countNormals;

conf.resultname = (conf.resultname || ("results/" + filename.split("/").reverse()[0] + "__"));

Jimp.read(filename).then(function (image) {
    // do stuff with the image


	// Поиск центров вертикальной яркости для двухсторонних
	var centers = getGaussBrightnessCenters(image, conf.gaussRadius);
	var normalsU = [], normalsD = [];

	if (countNormals) {
		// Считаем косые нормали
		makeNormals(centers, normalsU, normalsD, conf);
	} else {
		// Обойдёмся прямыми
		normalsU = (new Array(image.bitmap.width)).fill([0,  conf.step]);
		normalsD = (new Array(image.bitmap.width)).fill([0, -conf.step]);
	}

	var peakEndsU = findPeakEnds(image, centers, normalsU, brightnessMin, conf);
	var peakEndsD = findPeakEnds(image, centers, normalsD, brightnessMin, conf);
	var peaked = markBiArray(image, peakEndsU, 0xff0000ff);
	peaked = markBiArray(peaked, peakEndsD, 0x0000ffff);
	peaked = markArray(peaked, centers, 0x00ff00ff);
	writeImage(peaked, conf, "peaked_" + brightnessMin);
	writeDataArray(peakEndsU.map((e)=>e[2]), conf,   "up_"+ brightnessMin);
	writeDataArray(peakEndsD.map((e)=>e[2]), conf, "down_"+ brightnessMin);
}).catch(function (err) {
    // handle an exception
	console.log(err);
});

function writeImage(image, par, postfix){
	image.write(par.resultname + postfix + ".png");
}

function writeDataArray(arr, par, postfix) {
	fs.writeFileSync(
		par.resultname + postfix + ".dat.txt",
		arr.join("\n")+"\n"
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
	gauss.gaussian(size || 8);
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

function findPeakEnds(image, points, normals, brightnessMin, par) {
	var ends = [];
	for (var i = 0; i < image.bitmap.width; i++) {
		var curx = i;
		var cury = points[i];
		var len = 0;
		do {
			curx += normals[i][0];
			cury += normals[i][1];
			len++;
		} while(
			image.getInterpixelTinycolor(curx, cury).getBrightness() >= brightnessMin
		&&
			curx >=0 && curx <=image.bitmap.width
		&&
			cury >=0 && cury <=image.bitmap.height
		);
		ends.push([
			curx,
			cury,
			len * par.step,
		]);
	}
	return ends;
}
