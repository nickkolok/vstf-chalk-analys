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








};//module.exports
