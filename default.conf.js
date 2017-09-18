'use strict';

var brights = [];
for(var b = 248; b >=8; b-=8){
	brights.push(b);
}

module.exports = {
	filename: "./images/test3-1.png",
	//filename: "./images/ex1-up1.png";
	step: 1,
	brightnessMin: 120,
	countNormals: true,
	delta: 10,
	gaussRadius: 8,
	centersCacheEnabled: true,
	brights:brights,
}
