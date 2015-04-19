var GunType = { ENLARGE: 0, SHRINK: 1 }
var type = GunType.ENLARGE
var isCharging = false
var lastStartedCharging = 0

var BULLET_VELOCITY = 500;

var gunSprite;

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

var fire = function(game, bullets, player) {
	var rot = game.physics.arcade.angleToPointer(player)

	if(!isCharging) throw "the toys out the pram";
	isCharging = false;
	console.log("We were charging for " + (game.time.now - lastStartedCharging) + "seconds");

	bullet = bullets.create(player.x, player.y, 'bullet');
	game.physics.arcade.enable(bullet);
	bullet.rotation = gunSprite.rotation;
	bullet.anchor.setTo(0.5, 0.5)
	bullet.body.bounce.x = 1
	bullet.body.bounce.y = 1
	bullet.gunType = type;

	game.physics.arcade.velocityFromAngle(bullet.angle, BULLET_VELOCITY, bullet.body.velocity);
	return bullet;
}


function getSprite(game){
	gunSprite = game.add.sprite(0, 0, 'gun');
	gunSprite.anchor.setTo(0.05, 0.6)
	gunSprite.animations.add('fire', [0, 1, 2, 3, 2, 1, 0], 20, false);
	return gunSprite;
}

function updateRotation(game, player) {
	var rot = game.physics.arcade.angleToPointer(player)

	gunSprite.scale.y = Math.abs(rot) < Math.PI/2 ? 1 : -1;

	gunSprite.rotation = rot;
	gunSprite.position.x = player.body.position.x+32;
	gunSprite.position.y = player.body.position.y+32;
}

module.exports.updateRotation = updateRotation;
module.exports.getSprite = getSprite;
module.exports.switchType = switchType;
module.exports.startCharging = startCharging;
module.exports.fire = fire;
module.exports.gunType = GunType