var fs = require('fs');

var arr = [];


var files = process.argv.slice(2);

for(var j = 0; j < files.length; j++){
	arr = arr.concat(fs.readFileSync(process.argv[2], 'utf-8').split(/\r\n/).map((el)=>(1*el)));
}
//console.log(arr);



var lm = [];
for(var i = 1; i < arr.length; i++) {
	if(isLocMax(arr,i)){
		lm.push(arr[i]);
	}
}

console.log(averageInArray(arr));

//console.log(averageInArray(lm));

function isLocMax(arr, i){
	if(arr[i] > arr[i-1]){
		var j = i+1;
		while(arr[i] === arr[j]){
			j++;
		}
		if(arr[i] > arr[j]) {
			return true;
		}
	}
	return false;
}

function getLocMaxs(arr){
	var locmaxs = [];

	for(var i = 1; i < arr.length - 1; i++){
		if(isLocMax(arr,i)){
			locmaxs.push(i);
		}
	}

	var distances = [];

	for(var i = 1; i < locmaxs.length; i++) {
		distances.push(locmaxs[i]-locmaxs[i-1]);
	}
	return distances;
}




function averageInArray(arr){
	var avg = 0;
	arr.map((el)=>{avg+=el;});
	return avg/arr.length;
}

