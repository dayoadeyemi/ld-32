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

var startCharging = function(game) {
	console.log("Starting to charge the gun")
	isCharging = true;
	lastStartedCharging = game.time.now;
}

var fire = function(game) {
	if(!isCharging) throw "the toys out the pram";
	isCharging = false;
	console.log("We were charging for " + (game.time.now - lastStartedCharging) + "seconds");
	bullet = game.add.sprite(400, 300, 'bullet');
	game.physics.arcade.enable(bullet);
}

module.exports.switchType = switchType;
module.exports.startCharging = startCharging;
module.exports.fire = fire;