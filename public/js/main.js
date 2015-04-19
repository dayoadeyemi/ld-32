var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var gun = require('./gun.js')
var platforms, player, gun, map, layer, gunSprite, boxes, inputState = input.INITIAL_STATE;
var width, height, lastTime;
var GRAVITY = 700;
var bullets;

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {

  game.load.tilemap('map', '../resources/maps/test.json', null, Phaser.Tilemap.TILED_JSON);
  game.load.spritesheet('tiles', '../resources/tiles.png', 32, 32);

  game.load.spritesheet('player', '../resources/player.png', 72, 72);
  game.load.spritesheet('gun', '../resources/gun.png', 128, 128);
  game.load.image('bullet', '../resources/pl-bullet.png');
  game.load.image('box', '../resources/box.png');

  game.load.image('ledge', '../resources/pl-ledge.png')
}

function create() {
  game.stage.backgroundColor = '#3399FF';
  game.physics.startSystem(Phaser.Physics.P2);

  map = game.add.tilemap('map');
  map.addTilesetImage('tiles');
  map.addTilesetImage('box');

  boxes = game.add.group();
  boxes.enableBody = true;
  map.createFromObjects('boxes', 9, 'box', 0, true, false, boxes);
  boxes.setAll('body.bounce.y', 0.2);
  boxes.setAll('body.gravity.y', GRAVITY);
  boxes.setAll('modSize', 1);
  // boxes.callAll('anchor.setTo', 0.5, 0.5);

  layer = map.createLayer('Tile Layer 1');
  layer.resizeWorld();
  layer.enableBody = true;

  map.setCollisionBetween(1, 6);

  player = game.add.sprite(200, game.world.height - 400, 'player');
  game.physics.arcade.enable(player);
  player.body.bounce.y = 0.2;
  player.body.gravity.y = GRAVITY;
  player.body.collideWorldBounds = true;
  player.animations.add('walk', [0, 1, 2, 3, 4], 10, true);
  player.anchor.setTo(0.5, 0.5)
  game.camera.follow(player);

  gunSprite = gun.getSprite(game)
  bullets = game.add.group();
  bullets.enableBody = true;

  bulletReflectables = game.add.group();
  bulletReflectables.enableBody = true;
  reflect = bulletReflectables.create(400, 400, 'ledge');
  reflect.body.immovable = true;

  input().each(function(s){
    inputState = s;

    if (inputState.space) {
      gun.switchType();
    }

    if(inputState.mousedown) {
      gun.startCharging(game)
    } else if(inputState.mouseup) {
      gun.fire(game, bullets, player)
      gunSprite.animations.play('fire');
    }
  })
}

function update() {
  game.physics.arcade.collide(boxes, layer);
  game.physics.arcade.collide(boxes, boxes);
  game.physics.arcade.collide(player, layer);
  game.physics.arcade.collide(player, boxes);

  boxes.forEach(function(box) {
    if (box.body.onFloor()) {
      box.body.drag.setTo(100000);
    } else {
      box.body.drag.setTo(0);
    }
    // box.scale.x = box.modSize;
    // box.scale.y = box.modSize;
  }, this);

  if (inputState.up && (player.body.onFloor() || player.body.touching.down)){
      player.body.velocity.y = -GRAVITY/2;
  }
  gun.update(game, player, inputState)
  if (inputState.left){
    player.body.velocity.x = -150;
    player.scale.x = -1;
    player.animations.play('walk');
  } else if (inputState.right){
    player.body.velocity.x = 150;
    player.scale.x = 1;
    player.animations.play('walk');
  } else {
    player.body.velocity.x = 0;
    player.animations.stop();
    player.frame = 0;
  }

  var thingsToDestroy = [];
  game.physics.arcade.collide(bullets, layer, function(bullet, tile) {
    thingsToDestroy.push(bullet);
  });

  var preCollisionVelocityX;
  var preCollisionVelocityY;
  game.physics.arcade.overlap(bullets, bulletReflectables, function(bullet, tile) {
    console.log(preCollisionVelocityX);
    console.log(preCollisionVelocityY);

    // Some really shitty inference to work out what way we should bounce
    orig_x = bullet.x
    orig_y = bullet.y

    bullet.x = orig_x - 1
    if(game.physics.arcade.collide(bullet, tile)) {
      bullet.body.velocity.x = -preCollisionVelocityX;
    } else {
      bullet.x = orig_x + 1
      if(game.physics.arcade.collide(bullet, tile)) {
        bullet.body.velocity.x = -preCollisionVelocityX
      } else {
        bullet.body.velocity.x = preCollisionVelocityX
        bullet.body.velocity.y = -preCollisionVelocityY
      }
    }

    bullet.x = orig_x
    bullet.y = orig_y

    console.log(bullet)
  }, function(bullet, tile) {
    preCollisionVelocityX = bullet.body.velocity.x;
    preCollisionVelocityY = bullet.body.velocity.y;
    return true;
  });

  for(i = 0; i < thingsToDestroy.length; i++) {
    thingsToDestroy[i].destroy();
  }
  
}
