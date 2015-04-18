var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var gun = require('./gun.js')
var platforms, player, map, layer;
var width, height, lastTime;

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {

  game.load.tilemap('map', '../resources/maps/test.json', null, Phaser.Tilemap.TILED_JSON);
  game.load.spritesheet('tiles', '../resources/tiles.png', 32, 32);

  game.load.image('star', '../resources/star.png');
  game.load.spritesheet('player', '../resources/player.png', 72, 72);
  game.load.image('bullet', '../resources/pl-bullet.png');
}

function create() {
  game.stage.backgroundColor = '#3399FF';
  game.physics.startSystem(Phaser.Physics.ARCADE);

  map = game.add.tilemap('map');
  map.addTilesetImage('tiles');
  layer = map.createLayer('Tile Layer 1');
  map.setCollisionBetween(1, 6);
  layer.resizeWorld();

  layer.enableBody = true;

  player = game.add.sprite(200, game.world.height - 400, 'player');
  game.physics.arcade.enable(player);
  player.body.bounce.y = 0.2;
  player.body.gravity.y = 700;
  player.body.collideWorldBounds = true;
  player.animations.add('walk', [0, 1, 2, 3, 4], 10, true);
  player.anchor.setTo(0.5, 0.5)
  game.camera.follow(player);

  input().each(function(state){
    if (state.left){
      player.body.velocity.x = -150;
      player.scale.x = -1
      player.animations.play('walk');
    } else if (state.right){
      player.body.velocity.x = 150;
      player.scale.x = 1
      player.animations.play('walk');
    } else {
      player.body.velocity.x = 0;
      player.animations.stop();
      player.frame = 0;
    }

    if (state.space) {
      gun.switchType();
    }

    if(state.mousedown) {
      gun.startCharging(game)
    } else if(state.mouseup) {
      gun.fire(game, player, state.x, state.y)
    }

    if (state.up && player.body.onFloor()){
        player.body.velocity.y = -350;
    }
  })
}

function update() {
  game.physics.arcade.collide(player, layer);
}
