var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var gun = require('./gun.js')
var platforms, player, gun, map, layer, gunSprite, boxes, inputState = input.INITIAL_STATE;
var width, height, lastTime;
var GRAVITY = 700;

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {

  game.load.tilemap('map', '../resources/maps/test.json', null, Phaser.Tilemap.TILED_JSON);
  game.load.spritesheet('tiles', '../resources/tiles.png', 32, 32);

  game.load.spritesheet('player', '../resources/player.png', 72, 72);
  game.load.spritesheet('gun', '../resources/gun.png', 128, 128);
  game.load.image('bullet', '../resources/pl-bullet.png');
  game.load.image('box', '../resources/box.png');
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
  boxes.callAll('player.anchor.setTo', 0.5, 0.5);

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

  input().each(function(s){
    inputState = s;

    if (inputState.space) {
      gun.switchType();
    }

    if(inputState.mousedown) {
      gun.startCharging(game)
    } else if(inputState.mouseup) {
      gun.fire(game, player, inputState.x, inputState.y)
      gunSprite.animations.play('fire');
    }

    if (inputState.up && player.body.onFloor()){
        player.body.velocity.y = -GRAVITY/2;
    }
  })
}

function update() {
  game.physics.arcade.collide(boxes, layer);
  boxes.forEach(function(box) {
    if (box.body.onFloor()) {
      box.body.drag.setTo(100000);
    } else {
      box.body.drag.setTo(0);
    }
    box.scale = box.modSize;
  }, this);

  game.physics.arcade.collide(player, layer);
  game.physics.arcade.collide(player, boxes);
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
}
