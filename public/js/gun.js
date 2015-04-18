var gunTarget = function(bmd, player, x, y) {
  	bmd.clear();
  	bmd.ctx.beginPath();
  	bmd.ctx.moveTo(player.x, player.y);
  	bmd.ctx.lineTo(x , y);
  	bmd.ctx.lineWidth = 4;
  	bmd.ctx.stroke();
  	bmd.ctx.closePath();
  	bmd.render();
}

module.exports.redrawLine = gunTarget