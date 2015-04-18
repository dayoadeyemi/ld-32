var GunType = { ENLARGE: 0, SHRINK: 1 }
var type = GunType.ENLARGE
var isCharging = false
var lastStartedCharging = 0

var BULLET_VELOCITY = 50;

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

var fire = function(game, player, mouseX, mouseY) {
	if(!isCharging) throw "the toys out the pram";
	isCharging = false;
	console.log("We were charging for " + (game.time.now - lastStartedCharging) + "seconds");
	bullet = game.add.sprite(player.x, player.y, 'bullet');
	game.physics.arcade.enable(bullet);

	var x_diff = mouseX - player.x;
	var y_diff = mouseY - player.y;
	var magnitude = Math.sqrt(x_diff * x_diff + y_diff * y_diff);
	var mag_scaling_factor = BULLET_VELOCITY / magnitude;

	bullet.body.velocity.x = x_diff * mag_scaling_factor;
	bullet.body.velocity.y = y_diff * mag_scaling_factor;
}

module.exports.switchType = switchType;
module.exports.startCharging = startCharging;
module.exports.fire = fire;