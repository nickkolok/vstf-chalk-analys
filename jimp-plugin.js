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








};//module.exports
