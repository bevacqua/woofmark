'use strict';

function hr (chunks) {
  chunks.before += '\n<hr/>';
  chunks.selection = '';
}

module.exports = hr;
