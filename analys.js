var Jimp = require("jimp");
var tinycolor = require("tinycolor2");

var defaultFilename =
	"./images/test3-1.png";
	//"./images/ex1-up1.png";

var filename = process.argv[2] || defaultFilename;

var brightnessMin = process.argv[3] || 128;


Jimp.read(filename).then(function (image) {
    // do stuff with the image
	var color = tinycolor(Jimp.intToRGBA(image.getPixelColor(2, 2)));
	console.log(color.getBrightness())

	console.log(analyseImage(image, brightnessMin));


}).catch(function (err) {
	console.log(err);
    // handle an exception
});

function analyseImage(image, brightnessMin) {
	var results = [];
	for (var x = 0; x < image.bitmap.width; x++) {
		var y;
		for (y = image.bitmap.height - 1; y >= 0; y--) {
//		for (y = 0; y < image.bitmap.height; y++) {
			var brightness = tinycolor(Jimp.intToRGBA(image.getPixelColor(x, y))).getBrightness();
			//console.log(brightness);
			if(brightness < brightnessMin) {
				break;
			}
		}
		results[x] = image.bitmap.height - (y + 1);
	}
	return results;
}

