/* USAGE:

nodejs fatstrips.js filename delta imagename up_or_down

`filename` is the name with peaks' lengths (usually `*.dat.txt`) separated by linebreak

`delta` is number of nodes for every side used for linear regression

// Not implemented yet:

`imagename` name of image to mark approximated peaks on

`up_or_down` is `up` or `down` - where to mark peaks
*/




var paraquire = require('paraquire')(module);
var linearRegression = paraquire('everpolate').linearRegression;

var fs = require('fs');

//var filename = 'results/DSC02184.png.d/DSC02184.png__up_48.dat.txt';

var filename = process.argv[2];

var ends = fs.readFileSync(filename, 'utf-8').split(/[\r\n]+/g).map((a) => 1*a);


var smooth = [];

var delta = process.argv[3] || 4;

for(var i = 0; i < ends.length; i++) {
	var xs = [], ys = [];
	for(var j = Math.max(0, i - delta); j < Math.min(ends.length, i + delta); j++) {
		xs.push(j);
		ys.push(ends[j]);
	}
	var k = linearRegression(xs, ys);
	smooth[i] = k.evaluate(i)[0];
}


for(var i = 0; i < ends.length; i++){
	console.log(ends[i], smooth[i]);
}


var locmaxs = [];

for(var i = 1; i < smooth.length - 1; i++){
	if(smooth[i] > smooth[i+1] && smooth[i] > smooth[i-1]) {
		locmaxs.push(i);
	}
}

console.log('Распределение расстояний между локальными максимумами');

for(var i = 1; i < locmaxs.length; i++) {
	console.log(locmaxs[i]-locmaxs[i-1]);
}
