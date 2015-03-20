'use strict';

function rememberSelection (history) {
  var code = Math.random().toString(2).substr(2);
  var open = 'BarkupSelectionOpenMarker' + code;
  var close = 'BarkupSelectionCloseMarker' + code;
  var rmarkers = new RegExp(open + '|' + close, 'g');
  mark();
  return unmark;

  function mark () {
    var state = history.reset().inputState;
    var chunks = state.getChunks();
    chunks.selection = open + chunks.selection + close;
    state.setChunks(chunks);
    state.restore(false);
  }

  function unmark () {
    var state = history.inputState;
    var chunks = state.getChunks();
    var all = chunks.before + chunks.selection + chunks.after;
    var start = all.lastIndexOf(open);
    var end = all.lastIndexOf(close) + close.length;
    window.all = all;
    chunks.before = all.substr(0, start).replace(rmarkers, '');
    chunks.selection = all.substr(start, end - start).replace(rmarkers, '');
    chunks.after = all.substr(end).replace(rmarkers, '');
    state.setChunks(chunks);
    state.restore(false);
  }
}

module.exports = rememberSelection;
