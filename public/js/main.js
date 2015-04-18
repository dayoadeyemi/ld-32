var _ = require('highland');
var R = require('ramda');
var input = require('./input.js');
var canvas, stage, renderer;
var width, height, lastTime;


$(function(){
  canvas = document.getElementById("game-canvas"),
    rect = canvas.getBoundingClientRect();
    width = canvas.width,
    height = canvas.height;
    inputStream = input( $(canvas) )

  stage = new PIXI.Stage(0x000000);
  renderer = PIXI.autoDetectRenderer(
    width,
    height,
    {view:canvas}
  );

  inputStream.each(function(inputState){
    console.log(inputState)
  });


  lastTime = new Date();
  renderer.render(stage);
  requestAnimFrame(loop)
  document.title = paddle1.position.y
})

function delta(){
  var thisTime = new Date();
  var delta = thisTime - lastTime;
  lastTime = thisTime;
  return delta;
}

function loop() {
  var d = delta();
  requestAnimFrame(loop);
  renderer.render(stage);
}

function Body(){
  this.position = {x:0,y:0}
  this.velocity = {x:0,y:0}
  this.acceleration = {x:0,y:0}
}

Body.prototype.update = function(d){
  this.position.x += this.velocity.x*d;
  this.position.y += this.velocity.y*d;
  this.velocity.x += this.acceleration.x*d;
  this.velocity.y += this.acceleration.y*d;
}

