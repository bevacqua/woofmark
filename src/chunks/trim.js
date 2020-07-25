'use strict';

function trim (remove) {
  var self = this;
  var beforeReplacer = function (text) {
    self.before += text; return '';
  };

  var afterReplacer = function (text) {
    self.after = text + self.after; return '';
  };
  
  if (remove) {
    beforeReplacer = afterReplacer = '';
  }
  self.selection = self.selection.replace(/^(\s*)/, beforeReplacer).replace(/(\s*)$/, afterReplacer);
}

module.exports = trim;
