'use strict';

var doc = global.document;
var setText = require('../setText');
var strings = require('../strings');
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
    inputContainer: e('div', 'bk-prompt-input-container'),
    input: e('input', 'bk-prompt-input'),
    cancel: e('a', 'bk-prompt-cancel', 'Cancel'),
    ok: e('button', 'bk-prompt-ok', 'Ok'),
    footer: e('footer', 'bk-prompt-buttons')
  };
  dom.ok.type = 'button';
  dom.header[ac](dom.h1);
  dom.section[ac](dom.desc);
  dom.section[ac](dom.inputContainer);
  dom.inputContainer[ac](dom.input);
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
  var domup = {
    area: e('section', 'bk-prompt-upload-area'),
    warning: e('p', 'bk-prompt-error bk-warning', warning),
    failed: e('p', 'bk-prompt-error bk-failed', strings.prompts.uploadfailed),
    upload: e('button', 'bk-prompt-upload'),
    uploading: e('span', 'bk-prompt-progress', strings.prompts.uploading),
    drop: e('span', 'bk-prompt-drop', strings.prompts.drop),
    dropicon: e('p', 'bk-prompt-drop-icon'),
    browse: e('span', 'bk-prompt-browse', strings.prompts.browse),
    dragdrop: e('p', 'bk-prompt-dragdrop', strings.prompts.drophint),
    fileinput: e('input', fup)
  };
  domup.area[ac](domup.drop);
  domup.area[ac](domup.uploading);
  domup.area[ac](domup.dropicon);
  domup.upload.type = 'button';
  domup.upload[ac](domup.browse);
  domup.upload[ac](domup.fileinput);
  domup.fileinput.id = fup;
  domup.fileinput.type = 'file';
  dom.dialog.className += ' bk-prompt-uploads';
  dom.inputContainer.className += ' bk-prompt-input-container-uploads';
  dom.input.className += ' bk-prompt-input-uploads';
  dom.section.insertBefore(domup.warning, dom.inputContainer);
  dom.section.insertBefore(domup.failed, dom.inputContainer);
  dom.section[ac](domup.upload);
  dom.section[ac](domup.dragdrop);
  dom.section[ac](domup.area);
  return domup;
}

render.uploads = uploads;
module.exports = render;
