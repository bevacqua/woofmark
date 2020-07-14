'use strict';

var setText = require('./setText');
var strings = require('./strings');

function commands (el, id) {
  setText(el, strings.buttons[id] || id);
}

function modes (el, id) {
  setText(el, strings.modes[id] || id);
}

module.exports = {
  modes: modes,
  commands: commands
};
