var Jimp = require("jimp");
var tinycolor = require("tinycolor2");
var fs = require("fs");

var defaultFilename =
	"./images/test3-1.png";
	//"./images/ex1-up1.png";

var filename = process.argv[2] || defaultFilename;

var brightnessMin = process.argv[3] || 128;


Jimp.read(filename).then(function (image) {
    // do stuff with the image
	var result = analyseImage(image, brightnessMin);
	console.log(result);
	exportResult(filename, brightnessMin, result);
	markEnds(filename, image, result);
}).catch(function (err) {
    // handle an exception
	console.log(err);
});

function analyseImage(image, brightnessMin) {
	var results = [];
	for (var x = 0; x < image.bitmap.width; x++) {
		var y;
		for (y = image.bitmap.height - 1; y >= 0; y--) {
			var brightness = tinycolor(Jimp.intToRGBA(image.getPixelColor(x, y))).getBrightness();
			if(brightness < brightnessMin) {
				break;
			}
		}
		results[x] = image.bitmap.height - (y + 1);
	}
	return results;
}

function exportResult(filename, brightnessMin, result) {
	//TODO: mkdirp
	fs.writeFileSync(
		"results/" + filename.split("/").reverse()[0] + "__" + brightnessMin + ".dat.txt",
		result.join("\n")+"\n"
	);
}

function markEnds(filename, image, result) {
	var marked = image.clone();
	for (var i = 0; i < result.length; i++) {
		image.setPixelColor(0xff0000ff, i, image.bitmap.height - result[i] - 1);
	}
	var markedname =
		"results/" + filename.split("/").reverse()[0] + "__" + brightnessMin +
		"__marked." +
		image.getExtension();
	image.write(markedname)
}
