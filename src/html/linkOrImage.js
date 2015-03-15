'use strict';

var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rleading = /<a( [^>]*)?>$/;
var rtrailing = /^<\/a>/;
var rimage = /<img( [^>]*)?\/>$/;

function linkOrImage (chunks, options, type) {
  var image = type === 'image';
  var resume;

  chunks.trim();

  if (removal()) {
    return;
  }

  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(once(resolved));

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

  function resolved (text) {
    var link = parseLinkInput(text);
    if (link.href.length === 0) {
      resume(); return;
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
      chunks.before += '<a href="' + link.href + '"' + title + '>';
      chunks.after = '</a>' + chunks.after;
    }
  }
}

module.exports = linkOrImage;
