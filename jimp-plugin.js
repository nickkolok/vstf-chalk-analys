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
    if (isNodePattern(cb)) return cb.call(this, null, tc);
    else return tc;
};

};//module.exports
