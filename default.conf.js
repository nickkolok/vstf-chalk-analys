'use strict';

var brights = [];
for(var b = 256; b >=0; b-=1){
	brights.push(b);
}

module.exports = {
	filename: "./images/test3-1.png",
	//filename: "./images/ex1-up1.png";
	step: 1,
	brightnessMin: 120,
	countNormals: true,
	delta: 50,
	gaussRadius: 8,
	centersCacheEnabled: true,
	brights:brights,
	writeSeparator: "\r\n",
	readSeparator: /\r*\n/g,
	smoothDelta: 2,
	inpeakAvgCoeff:10,
	scaleFactor:1,
}
