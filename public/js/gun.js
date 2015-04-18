var GunType = { ENLARGE: 0, SHRINK: 1 }
var type = GunType.ENLARGE
var isCharging = false
var lastStartedCharging = 0

var switchType = function() {
	if(type == GunType.ENLARGE) {
		type = GunType.SHRINK;
		console.log("Switching gun to SHRINK");
	} else {
		type = GunType.ENLARGE;
		console.log("Switching gun to ENLARGE");
	}
}

var startCharging = function(time) {
	console.log("Starting to charge the gun")
	isCharging = true;
	lastStartedCharging = time;
}

var fire = function(time) {
	if(!isCharging) throw "the toys out the pram"
	isCharging = false;
	console.log("We were charging for " + (time - lastStartedCharging) + "seconds")
}

module.exports.switchType = switchType;
module.exports.startCharging = startCharging;
module.exports.fire = fire;