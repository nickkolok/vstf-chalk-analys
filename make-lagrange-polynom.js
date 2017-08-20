var Polynomial = require('polynomial');

function lagrange(x, y) {
	var res = new Polynomial(0);
	for (var i = 0; i < x.length; i++) {
		var l_i = new Polynomial(y[i]);
		for (var j = 0; j < x.length; j++) {
			if (i == j) {
				continue;
			}
			l_i = l_i.mul([-x[j],1]).mul(1/(x[i]-x[j]));
		}
		res = res.add(l_i);
	}
	return res;
}
/*
console.log(lagrange([-1,0,1],[1,0,1]).toString());
console.log(lagrange([-2,-1,0,1,2],[4,1,0,1,4]).toString());
console.log(lagrange([-1,0,1],[2,1,2]).toString());
console.log(lagrange([-1,0,1,3],[-1,0,1,27]).toString());
*/

//for (var i = 0; i < 10; i++){
	console.log(lagrange([-2,-1,0,1,2,3,4,5,6,7,8,9,10,11,12,13,14],[0,0,0,0,0,0,0,0,1,1,1,1,1,1,1]).derive(1).result(5).toString());
//}
module.exports = lagrange;
