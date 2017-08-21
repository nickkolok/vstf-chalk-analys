var Jimp = require("jimp");
var tinycolor = require("tinycolor2");
var fs = require("fs");
var mkdirp = require('mkdirp');
var linearRegression = require('everpolate').linearRegression;

require("./jimp-plugin.js")(Jimp);

var conf = require('./default.conf.js');


var filename = process.argv[2] || conf.filename;
var brightnessMin = process.argv[3] || conf.brightnessMin;
var countNormals = conf.brightnessMin;

Jimp.read(filename).then(function (image) {
    // do stuff with the image


	// Поиск центров вертикальной яркости для двухсторонних
	var centers = getGaussBrightnessCenters(image, 8);
	var normalsU = [], normalsD = [];

	if (countNormals) {
		// Считаем косые нормали
		makeNormals(centers, normalsU, normalsD);
	} else {
		// Обойдёмся прямыми
		//TODO: шаг!!!
		normalsU = (new Array(image.bitmap.width)).fill([0,  0.2]);
		normalsD = (new Array(image.bitmap.width)).fill([0, -0.2]);
	}

	var peakEndsU = findPeakEnds(image, centers, normalsU, brightnessMin);
	var peakEndsD = findPeakEnds(image, centers, normalsD, brightnessMin);
	var peaked = markBiArray(image, peakEndsU, 0xff0000ff);
	peaked = markBiArray(peaked, peakEndsD, 0x0000ffff);
	peaked = markArray(peaked, centers, 0x00ff00ff);
	var peakedname =
		"results/" + filename.split("/").reverse()[0] +
		"__peaked_" + brightnessMin + "." +
		"png";
	peaked.write(peakedname);
	fs.writeFileSync(
		"results/" + filename.split("/").reverse()[0] + "__up_"+ brightnessMin + ".dat.txt",
		peakEndsU.map((e)=>e[2]).join("\n")+"\n"
	)
	fs.writeFileSync(
		"results/" + filename.split("/").reverse()[0] + "__down_"+ brightnessMin + ".dat.txt",
		peakEndsD.map((e)=>e[2]).join("\n")+"\n"
	)

}).catch(function (err) {
    // handle an exception
	console.log(err);
});


function normalize(arr, len) {
	var norm = Math.sqrt(arr[0]*arr[0]+arr[1]*arr[1]);
	for(var i = 0; i < 2; i++){
		arr[i]*=(len || 1)/norm;
	}
	return arr;
}

function makeNormals(centers, normalsU, normalsD){
	var delta = 10; //TODO: параметр!
	var step = 1;//0.2; //TODO: параметр!
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

function markBrightnessCenters(filename, image, postfix) {

	var marked = markArray(image,getGaussBrightnessCenters(image, 8),0x00ff00ff);
	var markedname =
		"results/" + filename.split("/").reverse()[0] +
		"__marked_bc__" + postfix + "." +
		"png";
	marked.write(markedname)
}

function findPeakEnds(image, points, normals, brightnessMin) {
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
			Math.sqrt(Math.pow(curx - i, 2) + Math.pow(cury - points[i], 2))
		]);
	}
	return ends;
}
