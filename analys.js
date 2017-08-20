var Jimp = require("jimp");
require("./jimp-plugin.js")(Jimp);
var tinycolor = require("tinycolor2");
var fs = require("fs");
var mkdirp = require('mkdirp');

var linearRegression = require('everpolate').linearRegression;

var defaultFilename =
	"./images/test3-1.png";
	//"./images/ex1-up1.png";

var filename = process.argv[2] || defaultFilename;

var brightnessMin = process.argv[3] || 128;


Jimp.read(filename).then(function (image) {
    // do stuff with the image

/*
	// Анализ по заданным параметрам
	var result = analyseImage(image, brightnessMin);
//	console.log(result);
	exportResult(filename, brightnessMin, result);
	markEnds(filename, image, result);

	//Анализ по средней яркости
	brightnessMin = image.getAvgBrightness(0, 0, image.bitmap.width, image.bitmap.height);
	console.log("Средняя яркость изображения: " + brightnessMin);
	result = analyseImage(image, brightnessMin);
	exportResult(filename, brightnessMin, result);
	markEnds(filename, image, result);
*/

	//Поиск центров вертикальной яркости - уже для двухсторонних. Ну вот так всё в кучу :(
	// Ищем осевую линию
	var centers = getGaussBrightnessCenters(image, 8);
	var normalsU = [], normalsD = [];

/*
	for (var i = 0; i < image.bitmap.width; i++) {
		normalsU.push([0,  0.2]);
		normalsD.push([0, -0.2]);
	}
*/

	makeNormals(centers, normalsU, normalsD);
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
		arr[i]*=len/(norm || 1);
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

function analyseImage(image, brightnessMin) {
	var results = [];
	for (var x = 0; x < image.bitmap.width; x++) {
		var y;
		for (y = image.bitmap.height - 1; y >= 0; y--) {
			var brightness = image.getPixelTinycolor(x, y).getBrightness();
			if(brightness < brightnessMin) {
				break;
			}
		}
		results[x] = image.bitmap.height - (y + 1);
	}
	return results;
}

function exportResult(filename, brightnessMin, result) {
	mkdirp.sync("results");
	fs.writeFileSync(
		"results/" + filename.split("/").reverse()[0] + "__" + brightnessMin + ".dat.txt",
		result.join("\n")+"\n"
	);
}

function markEnds(filename, image, result) {
	var marked = image.clone();
	for (var i = 0; i < result.length; i++) {
		marked.setPixelColor(0xff0000ff, i, marked.bitmap.height - result[i] - 1);
	}
	var markedname =
		"results/" + filename.split("/").reverse()[0] + "__" + brightnessMin +
		"__marked." +
		"png";
	marked.write(markedname)
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
