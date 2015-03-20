'use strict';

var InputState = require('./InputState');

function getCommandHandler (surface, history, fn) {
  return function handleCommand (e) {
    surface.focus(history.inputMode);
    history.setCommandMode();

    var state = new InputState(surface, history.inputMode);
    var chunks = state.getChunks();
    var asyncHandler = {
      async: async, immediate: true
    };

    fn.call(asyncHandler, e, history.inputMode, chunks);

    if (asyncHandler.immediate) {
      done();
    }

    function async () {
      asyncHandler.immediate = false;
      return done;
    }

    function done () {
      surface.focus(history.inputMode);
      state.setChunks(chunks);
      state.restore();
    }
  };
}

module.exports = getCommandHandler;
