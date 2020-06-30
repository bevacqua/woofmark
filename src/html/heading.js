'use strict';

var strings = require('../strings');
var rleading = /<h([1-6])( [^>]*)?>$/;
var rtrailing = /^<\/h([1-6])>/;

function heading (chunks) {
  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail && lead[1] === trail[1]) {
    swap();
  } else {
    add();
  } 

  // func changes headings
  function swap () {
    var level = parseInt(lead[1], 10);
    // checks for the next heading size. Calls remove() if <h4> is reached.
    var next = level > 3 ? remove() : level + 1;
    chunks.before = chunks.before.replace(rleading, '<h' + next + '>');
    chunks.after = chunks.after.replace(rtrailing, '</h' + next + '>');
  }

  function remove () {
    chunks.before = chunks.before.replace(rleading, '');
    chunks.after = chunks.after.replace(rtrailing, '');
  }

  // func called to enter a new heading
  function add () {
    if (!chunks.selection) {
      chunks.selection = strings.placeholders.heading;
    }
    chunks.before += '<h1>';
    chunks.after = '</h1>' + chunks.after;
  }
}

module.exports = heading;
