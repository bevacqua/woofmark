'use strict';

var setText = require('./setText');
var strings = require('./strings');

function commands (el, id) {
  setText(el, strings.buttons[id] || id);
}

function markdown (el) {
  setText(el, 'm\u2193');
}

function html (el) {
  setText(el, 'html');
}

function wysiwyg (el) {
  setText(el, '\u0ca0.\u0ca0');
}

module.exports = {
  modes: {
    markdown: markdown,
    html: html,
    wysiwyg: wysiwyg
  },
  commands: commands
};
