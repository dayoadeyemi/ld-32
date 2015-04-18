var _ = require('highland');
var R = require('ramda');
var key = {
  87: 'up',
  83: 'down',
  65: 'left',
  68: 'right',
  32: 'space'
}

module.exports = function input(){
  var canvas = $( 'canvas' )
  return _.merge([
    _('mousemove', canvas),
    _('mousedown', canvas),
    _('mouseup', $( document )),
    _('keydown', $( document )),
    // _('keypress', $( document )),
    _('keyup', $( document ))
  ])
  .scan({
    up:false,
    down:false,
    left: false,
    right: false,
    space: false,
    x: 0,
    y: 0,
    mousedown: false,
    mouseup: false
  }, function(_memo, e){
    var memo = R.clone(_memo);
    memo.mousedown = !!(e.type === 'mousedown');
    memo.mouseup = !!(e.type === 'mouseup');
    if (e.type === 'mousemove') {
      memo.x = e.clientX - canvas[0].offsetLeft;
      memo.y = e.clientY - canvas[0].offsetTop;
      return memo;
    }
    if (key[e.keyCode] !== void 0) {
      console.log(key[e.keyCode]);
      memo[key[e.keyCode]] = !!(e.type === 'keydown');
      return memo;
    }
    return memo;
  })
}