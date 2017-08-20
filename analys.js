var Jimp = require("jimp");
require("./jimp-plugin.js")(Jimp);
var tinycolor = require("tinycolor2");
var fs = require("fs");
var mkdirp = require('mkdirp');

var defaultFilename =
	"./images/test3-1.png";
	//"./images/ex1-up1.png";

var filename = process.argv[2] || defaultFilename;

var brightnessMin = process.argv[3] || 128;


Jimp.read(filename).then(function (image) {
    // do stuff with the image

/*
	console.log(image.getPixelTinycolor(0,0).toRgbString());
	console.log(image.getPixelTinycolor(1,1).toRgbString());
	console.log(image.getInterpixelTinycolor(0,0).toRgbString());
	console.log(image.getInterpixelTinycolor(1,1).toRgbString());
	console.log(image.getInterpixelTinycolor(0.5,0.5).toRgbString());
	console.log(image.getInterpixelTinycolor(0,0.5).toRgbString());
	console.log(image.getInterpixelTinycolor(0.5,0).toRgbString());
	console.log(image.getInterpixelTinycolor(0.3,0.7).toRgbString());
*/
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
/*
	markBrightnessCenters(filename, image, "");

	var gaussianBlured = image.clone();
	gaussianBlured.gaussian(8);
	markBrightnessCenters(filename, gaussianBlured, "gaussian-blured");
*/

// Ищем осевую линию
	var centers = getGaussBrightnessCenters(image, 8);
	var normalsU = [], normalsD = [];
	for (var i = 0; i < image.bitmap.width; i++) {
		normalsU.push([0, -0.2]);
		normalsD.push([0,  0.2]);
	}

	var peakEndsU = findPeakEnds(image, centers, normalsU, brightnessMin);
	var peakEndsD = findPeakEnds(image, centers, normalsD, brightnessMin);
	var peaked = markBiArray(image, peakEndsU, 0xff0000ff);
	peaked = markBiArray(peaked, peakEndsD, 0x0000ffff);
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

//	markBrightnessCenters(filename, /*gaussianBlured*/image, "gaussian-blured");


}).catch(function (err) {
    // handle an exception
	console.log(err);
});

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

/*
	var marked = image.clone();
	for (var i = 0; i < marked.bitmap.width; i++) {
		var coord = marked.getCenterOfBrightness(i, 0, 1, marked.bitmap.height);
		marked.setPixelColor(0x00ff00ff, coord.x, coord.y);
	}
*/
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
		curx = i;
		cury = points[i];
		do {
			curx += normals[i][0];
			cury += normals[i][1];
		} while(image.getInterpixelTinycolor(curx, cury).getBrightness() >= brightnessMin);
		ends.push([
			curx,
			cury,
			Math.sqrt(Math.pow(curx - i, 2) + Math.pow(cury - points[i], 2))
		]);
	}
	return ends;
}
