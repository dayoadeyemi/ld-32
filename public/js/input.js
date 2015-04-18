var _ = require('highland');
var R = require('ramda');
var key = {
  87: 'up',
  83: 'down',
  65: 'left',
  68: 'right',
}

module.exports = function input( JQcanvas ){
  return _.merge([
    _('mousemove', JQcanvas),
    _('mousedown', JQcanvas),
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
    x: 0,
    y: 0,
    shoot: false
  }, function(memo, e){
    if (e.type === 'mousemove' || e.type === 'mousedown' || e.type ===  'mouseup') {
      memo.x = e.clientX - rect.left;
      memo.y = e.clientY - rect.top;
      if (e.type !== 'mousemove') {
      	memo.shoot = (e.type === 'mousedown');
      }
      return memo;
    }
    if (R.contains(['keydown', 'keyup'], e.type) && key[e.keyCode] !== void 0) {
      memo[key[e.keyCode]] = e.type === 'keydown';
      return memo;
    }
    return memo;
  })
}