'use strict';

function trim(remove) {
    var self = this;
    var beforeReplacer;
    var afterReplacer;

    if (remove) {
        beforeReplacer = afterReplacer = '';
    } else {
        beforeReplacer = function(text) {
            self.before += text; return '';
        };
        afterReplacer = function(text) {
            self.after = text + self.after; return '';
        };
    }
    self.selection = self.selection.replace(/^(\s*)/, beforeReplacer).replace(/(\s*)$/, afterReplacer);
}

module.exports = trim;
