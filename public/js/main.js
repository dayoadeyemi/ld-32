var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var gun = require('./gun.js')
var platforms, player;
var width, height, lastTime;

var game = new Phaser.Game(800, 600, Phaser.AUTO, '', { preload: preload, create: create, update: update });

function preload() {
  game.load.image('sky', '../resources/sky.png');
  game.load.image('ground', '../resources/platform.png');
  game.load.image('star', '../resources/star.png');
  game.load.image('bullet', '../resources/pl-bullet.png');
  game.load.spritesheet('player', '../resources/player.png', 88, 88);
}

function create() {
  game.physics.startSystem(Phaser.Physics.ARCADE);
  game.add.sprite(0, 0, 'sky')

  platforms = game.add.group();
  platforms.enableBody = true;

  var ground = platforms.create(0, game.world.height - 64, 'ground');
  ground.scale.setTo(2, 2);
  ground.body.immovable = true;

  var ledge = platforms.create(400, 400, 'ground');

  ledge.body.immovable = true;

  ledge = platforms.create(-150, 250, 'ground');

  ledge.body.immovable = true;

  player = game.add.sprite(32, game.world.height - 150, 'player');
  game.physics.arcade.enable(player);
  player.body.bounce.y = 0.2;
  player.body.gravity.y = 300;
  player.body.collideWorldBounds = true;
  player.animations.add('walk', [0, 1, 2, 3, 4], 10, true);
  player.anchor.setTo(0.5, 0.5)

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

    if (state.up && player.body.touching.down){
        player.body.velocity.y = -350;
    }
  })
}

function update() {
  game.physics.arcade.collide(player, platforms);
}

// $(function(){
//   canvas = document.getElementById("game-canvas"),
//     rect = canvas.getBoundingClientRect();
//     width = canvas.width,
//     height = canvas.height;
//     inputStream = input( $(canvas) )

//   stage = new PIXI.Stage(0xffffff);
//   renderer = PIXI.autoDetectRenderer(
//     width,
//     height,
//     {view:canvas}
//   );

//   inputStream.each(function(inputState){
//     console.log(inputState)
//   });

//   loader = new PIXI.AssetLoader(assets);
//   loader.onComplete = function onAssetsLoaded(){
//     var char_0 = PIXI.Sprite.fromFrame('char_0')
//     char_0.position.x = 32;
//     char_0.position.y = 64;
//     stage.addChild(char_0);

//     console.log('assets loaded')
//     lastTime = new Date();
//     renderer.render(stage);
//     requestAnimFrame(loop)
//   }
//   loader.load();
// })

// function delta(){
//   var thisTime = new Date();
//   var delta = thisTime - lastTime;
//   lastTime = thisTime;
//   return delta;
// }

// function loop() {
//   var d = delta();
//   requestAnimFrame(loop);
//   renderer.render(stage);
// }

// function Body(){
//   this.position = {x:0,y:0}
//   this.velocity = {x:0,y:0}
//   this.acceleration = {x:0,y:0}
// }

// Body.prototype.update = function(d){
//   this.position.x += this.velocity.x*d;
//   this.position.y += this.velocity.y*d;
//   this.velocity.x += this.acceleration.x*d;
//   this.velocity.y += this.acceleration.y*d;
// }

