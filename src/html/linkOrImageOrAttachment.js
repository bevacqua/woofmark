'use strict';

var crossvent = require('crossvent');
var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rleading = /<a( [^>]*)?>$/;
var rtrailing = /^<\/a>/;
var rimage = /<img( [^>]*)?\/>$/;

function linkOrImageOrAttachment (chunks, options) {
  var type = options.type;
  var image = type === 'image';
  var resume;

  if (type !== 'attachment') {
    chunks.trim();
  }

  if (removal()) {
    return;
  }

  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(options, once(resolved));

  function removal () {
    if (image) {
      if (rimage.test(chunks.selection)) {
        chunks.selection = '';
        return true;
      }
    } else if (rtrailing.exec(chunks.after) && rleading.exec(chunks.before)) {
      chunks.before = chunks.before.replace(rleading, '');
      chunks.after = chunks.after.replace(rtrailing, '');
      return true;
    }
  }

  function resolved (result) {
    var parts;
    var link = parseLinkInput(result.definition);
    if (link.href.length === 0) {
      resume(); return;
    }

    if (type === 'attachment') {
      parts = options.mergeHtmlAndAttachment(chunks.before + chunks.selection + chunks.after, link);
      chunks.before = parts.before;
      chunks.selection = parts.selection;
      chunks.after = parts.after;
      resume();
      crossvent.fabricate(options.surface.textarea, 'woofmark-mode-change');
      return;
    }

    var title = link.title ? ' title="' + link.title + '"' : '';

    if (image) {
      imageWrap();
    } else {
      linkWrap();
    }

    if (!chunks.selection) {
      chunks.selection = strings.placeholders[type];
    }
    resume();

    function imageWrap () {
      chunks.before += '<img src="' + link.href + '" alt="';
      chunks.after = '"' + title + ' />' + chunks.after;
    }

    function linkWrap () {
      var names = options.classes.input.links;
      var classes = names ? ' class="' + names + '"' : '';
      chunks.before += '<a href="' + link.href + '"' + title + classes + '>';
      chunks.after = '</a>' + chunks.after;
    }
  }
}

module.exports = linkOrImageOrAttachment;
