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

	//Поиск центров вертикальной яркости - уже для двухсторонних. Ну вот так всё в кучу :(
	markBrightnessCenters(filename, image, "");
	var gaussianBlured = image.clone();
	gaussianBlured.gaussian(8);
	markBrightnessCenters(filename, gaussianBlured, "gaussian-blured");

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

function markBrightnessCenters(filename, image, postfix) {
	var marked = image.clone();
	for (var i = 0; i < marked.bitmap.width; i++) {
		var coord = marked.getCenterOfBrightness(i, 0, 1, marked.bitmap.height);
		marked.setPixelColor(0x00ff00ff, coord.x, coord.y);
	}
	var markedname =
		"results/" + filename.split("/").reverse()[0] +
		"__marked_bc__" + postfix + "." +
		"png";
	marked.write(markedname)
}
