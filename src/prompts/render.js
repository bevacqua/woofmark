'use strict';

var doc = global.document;
var setText = require('../setText');
var ac = 'appendChild';

function e (type, cls, text) {
  var el = doc.createElement(type);
  el.className = cls;
  if (text) {
    setText(el, text);
  }
  return el;
}

function render (options) {
  var dom = {
    dialog: e('article', 'bk-prompt ' + options.id),
    close: e('a', 'bk-prompt-close'),
    header: e('header', 'bk-prompt-header'),
    h1: e('h1', 'bk-prompt-title', options.title),
    section: e('section', 'bk-prompt-body'),
    desc: e('p', 'bk-prompt-description', options.description),
    input: e('input', 'bk-prompt-input'),
    cancel: e('a', 'bk-prompt-cancel', 'Cancel'),
    ok: e('button', 'bk-prompt-ok', 'Ok'),
    footer: e('footer', 'bk-prompt-buttons')
  };
  dom.header[ac](dom.h1);
  dom.section[ac](dom.desc);
  dom.section[ac](dom.input);
  dom.input.placeholder = options.placeholder;
  dom.footer[ac](dom.cancel);
  dom.footer[ac](dom.ok);
  dom.dialog[ac](dom.close);
  dom.dialog[ac](dom.header);
  dom.dialog[ac](dom.section);
  dom.dialog[ac](dom.footer);
  doc.body[ac](dom.dialog);
  return dom;
}

function uploads (dom, warning) {
  var fup = 'bk-prompt-fileupload';
  var up = {
    area: e('section', 'bk-prompt-upload-area'),
    warning: e('p', 'bk-prompt-error bk-warning', warning),
    failed: e('p', 'bk-prompt-error bk-failed', 'Upload failed!'),
    upload: e('button', 'bk-prompt-upload'),
    uploading: e('span', 'bk-prompt-progress', 'Uploading file...'),
    drop: e('span', 'bk-prompt-drop', 'Drop here to begin upload'),
    browse: e('span', 'bk-prompt-browse', 'Browse...'),
    dragdrop: e('span', 'bk-prompt-dragdrop', 'You can also drop files here'),
    input: e('input', fup)
  };
  up.area[ac](up.warning);
  up.area[ac](up.failed);
  up.area[ac](up.upload);
  up.upload[ac](up.drop);
  up.upload[ac](up.uploading);
  up.upload[ac](up.browse);
  up.upload[ac](up.dragdrop);
  up.upload[ac](up.input);
  up.input.id = fup;
  up.input.type = 'file';
  dom.section[ac](up.area);
  dom.up = up;
  return up;
}

render.uploads = uploads;
module.exports = render;
