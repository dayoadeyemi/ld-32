var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var gun = require('./gun.js')
var platforms, player, gun, map, layer, gunSprite, boxes, inputState = input.INITIAL_STATE;
var width, height, lastTime;
var GRAVITY = 700;
var bullets;
var level;

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function preload() {
  level = getParameterByName('level');
  var map = getParameterByName('map');
  var mapName = level ? "level" + level :
                map   ? map             :
                        "test";

  game.load.tilemap('map', '../resources/maps/' + mapName + ".json", null, Phaser.Tilemap.TILED_JSON);
  game.load.spritesheet('tiles', '../resources/tiles.png', 32, 32);

  game.load.spritesheet('player', '../resources/player.png', 72, 72);
  game.load.spritesheet('gun', '../resources/gun.png', 128, 128);
  game.load.image('bullet', '../resources/pl-bullet.png');
  game.load.image('box', '../resources/box.png');
  game.load.image('reflector', '../resources/reflctor.png');
  game.load.image('door', '../resources/door.png');

  game.load.image('ledge', '../resources/pl-ledge.png')
}

function create() {
  game.stage.backgroundColor = '#998458';
  game.physics.startSystem(Phaser.Physics.P2);

  map = game.add.tilemap('map');
  map.addTilesetImage('tiles');
  map.addTilesetImage('box');

  boxes = game.add.group();
  boxes.enableBody = true;
  map.createFromObjects('objects', 17, 'box', 0, true, false, boxes);
  boxes.setAll('body.bounce.y', 0.2);
  boxes.setAll('body.gravity.y', GRAVITY);
  boxes.setAll('modSize', 1);
  boxes.callAll('anchor.setTo', 0.5, 0);

  layer = map.createLayer('Tile Layer 1');
  layer.resizeWorld();
  layer.enableBody = true;

  map.setCollisionBetween(1, 16);

  target = game.add.group();
  target.enableBody = true;
  map.createFromObjects('objects', 19, 'door', 0, true, false, target);
  target.setAll('body.immovable', true);

  player = game.add.sprite(200, game.world.height - 400, 'player');
  game.physics.arcade.enable(player);
  player.body.bounce.y = 0.2;
  player.body.gravity.y = GRAVITY;
  player.body.collideWorldBounds = true;
  player.animations.add('walk', [0, 1, 2, 3, 4], 10, true);
  player.anchor.setTo(0.5, 0)
  game.camera.follow(player);

  gunSprite = gun.getSprite(game)
  bullets = game.add.group();
  bullets.enableBody = true;

  bulletReflectables = game.add.group();
  bulletReflectables.enableBody = true;
  map.createFromObjects('objects', 18, 'reflector', 0, true, false, bulletReflectables);
  bulletReflectables.setAll('body.immovable',  true)

  input().each(function(s){
    inputState = s;

    if (inputState.switchgun) {
      gun.switchType();
    }

    if(inputState.chargegun) {
      gun.startCharging(game)
    } else if(inputState.firegun) {
      gun.fire(game, bullets)
      gunSprite.animations.play('fire');
    }
  })
}

function update() {
  game.physics.arcade.collide(target, player, function(player, target) {
    if(level) {
      window.location = window.location.href.split('?')[0] + "?level=" + (parseInt(level) + 1)
    }
  });

  game.physics.arcade.collide(boxes, layer);
  game.physics.arcade.collide(boxes, boxes);
  game.physics.arcade.collide(player, layer);
  game.physics.arcade.collide(player, boxes);
  game.physics.arcade.collide(player, bulletReflectables);
  game.physics.arcade.collide(bullets, bulletReflectables);

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
  gun.updateRotation(game, player, inputState)
  if (inputState.left){
    player.body.velocity.x = -150;
    player.scale.x = -Math.abs(player.scale.x);
    player.animations.play('walk');
  } else if (inputState.right){
    player.body.velocity.x = 150;
    player.scale.x = Math.abs(player.scale.x)
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

  var expandOrShrink = function(sprite) {
    if(bullet.gunType === gun.gunType.ENLARGE && Math.abs(sprite.scale.x) < 4 && Math.abs(sprite.scale.y) < 4) {
      sprite.scale = new Phaser.Point(sprite.scale.x * 2, sprite.scale.y * 2)
      sprite.x = sprite.x - sprite.width / 4
      sprite.y = sprite.y - sprite.height / 2
    } else if(bullet.gunType == gun.gunType.SHRINK && Math.abs(sprite.scale.x) > 0.25 && Math.abs(sprite.scale.y) > 0.25) {
      sprite.scale = new Phaser.Point(sprite.scale.x / 2, sprite.scale.y / 2)
      sprite.y = sprite.y + sprite.height
      sprite.x = sprite.x + sprite.width / 2
    }
    sprite.body.velocity.y = 0;
  }

  game.physics.arcade.collide(bullets, boxes, function(bullet, box) {
    thingsToDestroy.push(bullet);
    expandOrShrink(box)
  });
  game.physics.arcade.collide(bullets, player, function(player, bullet) {
    thingsToDestroy.push(bullet);
    expandOrShrink(player);
  });

  for(i = 0; i < thingsToDestroy.length; i++) {
    thingsToDestroy[i].destroy();
  }

}
