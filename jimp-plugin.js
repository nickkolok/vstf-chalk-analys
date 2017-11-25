module.exports = function(Jimp){

var TinyColor = require("tinycolor2");

// Copied from original Jimp
function isNodePattern (cb) {
    if (typeof cb === "undefined") return false;
    if (typeof cb !== "function")
        throw new Error("Callback must be a function");
    return true;
}

//Actually plugin

/**
 * Returns the Tinycolor value of a pixel
 * @param x the x coordinate
 * @param y the y coordinate
 * @param (optional) cb a callback for when complete
 * @returns the index of the pixel or -1 if not found
*/
Jimp.prototype.getPixelTinycolor = function (x, y, cb) {
    var tc = TinyColor(Jimp.intToRGBA(this.getPixelColor(x, y)));
    if (isNodePattern(cb)) {
		return cb.call(this, null, tc);
	}
    return tc;
};


/**
 * Returns the Tinycolor value of a rational-coordinated pixel
 * @param x the x coordinate
 * @param y the y coordinate
 * @param (optional) cb a callback for when complete
 * @returns the index of the pixel or -1 if not found
*/
Jimp.prototype.getInterpixelTinycolor = function (x, y, cb) {
    var LU = Jimp.intToRGBA(this.getPixelColor(Math.floor(x), Math.floor(y)));
    var RU = Jimp.intToRGBA(this.getPixelColor(Math. ceil(x), Math.floor(y)));
    var LB = Jimp.intToRGBA(this.getPixelColor(Math.floor(x), Math. ceil(y)));
    var RB = Jimp.intToRGBA(this.getPixelColor(Math. ceil(x), Math. ceil(y)));

	var result = {};
	for (var cmp in LU) {
		result[cmp] = (0
			+ LU[cmp] * (Math.ceil(x    ) - x) * (Math.ceil(y    ) - y)
			- RU[cmp] * (Math.ceil(x - 1) - x) * (Math.ceil(y    ) - y)
			- LB[cmp] * (Math.ceil(x    ) - x) * (Math.ceil(y - 1) - y)
			+ RB[cmp] * (Math.ceil(x - 1) - x) * (Math.ceil(y - 1) - y)
		);
	}

    var tc = TinyColor(result);

    if (isNodePattern(cb)) {
		return cb.call(this, null, tc);
	}
    return tc;
};

//	"./images/test3-1.png";
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



/**
 * Returns the Number value of average brightness of a region
 * @param x the x coordinate
 * @param y the y coordinate
 * @param w the width
 * @param h height
 * @returns the Number value of average brightness of a region
*/
Jimp.prototype.getAvgBrightness = function (x, y, w, h) {
    x = Math.max(x, 0);
    y = Math.max(y, 0);
	if (x + w > this.bitmap.width) {
		w = this.bitmap.width - x;
	}//TODO: maybe +1
	if (y + h > this.bitmap.height) {
		h = this.bitmap.height - y;
	}//TODO: maybe +1


	var sum = 0;
    this.scan(x, y, w, h, function(curx, cury){
		sum += this.getPixelTinycolor(curx, cury).getBrightness();
	});

	return sum / (w*h);
};


/**
 * Finds mass center by brightness
 * @param x the x coordinate
 * @param y the y coordinate
 * @param w the width
 * @param h height
 * @returns object with coordinates
*/
Jimp.prototype.getCenterOfBrightness = function (x, y, w, h) {
    x = Math.max(x, 0);
    y = Math.max(y, 0);
	if (x + w > this.bitmap.width) {
		w = this.bitmap.width - x;
	}//TODO: maybe +1
	if (y + h > this.bitmap.height) {
		h = this.bitmap.height - y;
	}//TODO: maybe +1


	var xsum = 0, ysum = 0, msum = 0;
    this.scan(x, y, w, h, function(curx, cury){
		var curbr = this.getPixelTinycolor(curx, cury).getBrightness();
		msum += curbr;
		xsum += curbr * curx;
		ysum += curbr * cury;
	});

	return {
		x: xsum / msum,
		y: ysum / msum,
	};
};


/**
 * @param x the x coordinate
 * @param y the y coordinate
 * @returns true if (x,y) are valid coordinates, i.e. inside image
*/
Jimp.prototype.areCoordsInside = function (x, y) {
    return (
        x >=0 && x <= this.bitmap.width
    &&
        y >=0 && y <= this.bitmap.height
    );
};

// Same as write, by try again and again
Jimp.prototype.writeStubborn = function(name, cb){
	var self = this;
	try{
		this.write(name, cb);
		delete this;
	}catch(e){
		console.log(name);
		console.log(e);
		setTimeout(function(){
			self.writeStubborn(name, cb);
		},100); // TODO: 100 should be a parameter
	}
};

/**
 * @param array array of [x,y] coordinates
 * @param intcolor color to mark
 * @returns this
*/

Jimp.prototype.markPoints = function(array, intcolor) {
	//TODO: setPixelTinycolor()
	for (var i = 0; i < array.length; i++) {
		this.setPixelColor(intcolor, array[i][0], array[i][1]);
	}
	return this;
}






};//module.exports
