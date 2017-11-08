var paraquire = require('paraquire')(module);
var linearRegression = paraquire('everpolate').linearRegression;

var fs = require('fs');

var filename = 'results/DSC02184.png.d/DSC02184.png__up_48.dat.txt';

var ends = fs.readFileSync(filename, 'utf-8').split(/[\r\n]+/g).map((a) => 1*a);

//console.log(signal);


var s = 1024
ends = ends.slice(s+1024, s+2048);

var smooth = [];

var delta = 4;

for(var i = 0; i < ends.length; i++) {
	var xs = [], ys = [];
	for(var j = Math.max(0, i - delta); j < Math.min(ends.length, i + delta); j++) {
		xs.push(j);
		ys.push(ends[j]);
	}
	var k = linearRegression(xs, ys);
//	console.log(k);
	smooth[i] = k.evaluate(i)[0];
}


for(var i = 0; i < ends.length; i++){
	console.log(ends[i], smooth[i]);
}

