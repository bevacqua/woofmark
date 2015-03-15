'use strict';

function wrapping (tag, placeholder, chunks) {
  var open = '<' + tag;
  var close = '</' + tag.replace(/</g, '</') + '>';
  var rleading = new RegExp(open + '( [^>]*)?>$');
  var rtrailing = new RegExp('^' + close);

  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail) {
    rm();
  } else {
    add();
  }

  function rm () {
    chunks.before = chunks.before.replace(rleading, '');
    chunks.after = chunks.after.replace(rtrailing, '');
  }

  function add () {
    if (!chunks.selection) {
      chunks.selection = placeholder;
    }
    chunks.before += open + '>';
    chunks.after = close + chunks.after;
  }
}

module.exports = wrapping;
