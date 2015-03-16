'use strict';

var ls = require('local-storage');
var crossvent = require('crossvent');
var kanye = require('kanye');
var strings = require('./strings');
var setText = require('./setText');
var bindCommands = require('./bindCommands');
var InputHistory = require('./InputHistory');
var getCommandHandler = require('./getCommandHandler');
var getSurface = require('./getSurface');
var classes = require('./classes');
var renderers = require('./renderers');
var linkPrompt = require('./prompts/link');
var imagePrompt = require('./prompts/image');
var closePrompts = require('./prompts/close');
var cache = [];
var mac = /\bMac OS\b/.test(global.navigator.userAgent);
var doc = document;

function find (textarea) {
  for (var i = 0; i < cache.length; i++) {
    if (cache[i] && cache[i].ta === textarea) {
      return cache[i].api;
    }
  }
  return null;
}

function barkup (textarea, options) {
  var cached = find(textarea);
  if (cached) {
    return cached;
  }

  var parent = textarea.parentElement;
  if (parent.children.length > 1) {
    throw new Error('Barkup demands <textarea> elements to have no siblings');
  }

  var o = options || {};
  if (o.markdown === void 0) { o.markdown = true; }
  if (o.html === void 0) { o.html = true; }
  if (o.wysiwyg === void 0) { o.wysiwyg = true; }
  if (!o.markdown && !o.html && !o.wysiwyg) {
    throw new Error('Barkup expects at least one input mode to be available');
  }
  if (o.storage === void 0) { o.storage = true; }
  if (o.storage === true) { o.storage = 'barkup_input_mode'; }
  if (o.fencing === void 0) { o.fencing = true; }
  if (o.render === void 0) { o.render = {}; }
  if (o.render.modes === void 0) { o.render.modes = {}; }
  if (o.render.commands === void 0) { o.render.commands = {}; }
  if (o.prompts === void 0) { o.prompts = {}; }
  if (o.prompts.link === void 0) { o.prompts.link = linkPrompt; }
  if (o.prompts.image === void 0) { o.prompts.image = imagePrompt; }
  if (o.prompts.close === void 0) { o.prompts.close = closePrompts; }
  if (o.classes === void 0) { o.classes = {}; }
  if (o.classes.wysiwyg === void 0) { o.classes.wysiwyg = []; }

  var preference = o.storage && ls.get(o.storage);
  if (preference) {
    o.defaultMode = preference;
  }

  var switchboard = tag({ c: 'bk-switchboard' });
  var commands = tag({ c: 'bk-commands' });
  var editable = tag({ c: ['bk-wysiwyg', 'bk-hide'].concat(o.classes.wysiwyg).join(' ') });
  var mode = 'markdown';
  var api = {
    addCommand: addCommand,
    addCommandButton: addCommandButton,
    destroy: destroy,
    value: getMarkdown,
    mode: mode
  };
  var place;
  var entry = { ta: textarea, api: api };
  var i = cache.push(entry);
  var kanyeContext = 'barkup_' + i;
  var surface = getSurface(textarea, editable);
  var history = new InputHistory(surface, 'markdown');
  var modes = {
    markdown: {
      button: tag({ t: 'button', c: 'bk-mode bk-mode-active' }),
      set: markdownMode
    },
    html: {
      button: tag({ t: 'button', c: 'bk-mode bk-mode-inactive' }),
      set: htmlMode
    },
    wysiwyg: {
      button: tag({ t: 'button', c: 'bk-mode bk-mode-inactive' }),
      set: wysiwygMode
    }
  };

  editable.contentEditable = true;
  modes.markdown.button.setAttribute('disabled', 'disabled');

  ['markdown', 'html', 'wysiwyg'].forEach(addMode);

  if (o.wysiwyg) {
    place = tag({ c: 'bk-wysiwyg-placeholder bk-hide', x: textarea.placeholder });
    crossvent.add(place, 'click', focusEditable);
  }

  if (o.defaultMode && o[o.defaultMode]) {
    modes[o.defaultMode].set();
  } else if (o.markdown) {
    modes.markdown.set();
  } else if (o.html) {
    modes.html.set();
  } else {
    modes.wysiwyg.set();
  }

  bindEvents();
  bindCommands(textarea, o, api);

  return api;

  function addMode (name) {
    var custom = o.render.modes;
    if (o[name]) {
      switchboard.appendChild(modes[name].button);
      (typeof custom === 'function' ? custom : custom[name] || renderers.modes[name])(modes[name].button, name);
      crossvent.add(modes[name].button, 'click', modes[name].set);
    }
  }

  function bindEvents (remove) {
    var ar = remove ? 'rm' : 'add';
    var mov = remove ? 'removeChild' : 'appendChild';
    if (remove) {
      kanye.clear(kanyeContext);
    } else {
      if (o.markdown) { kanye.on('cmd+m', parent, markdownMode, kanyeContext); }
      if (o.html) { kanye.on('cmd+h', parent, htmlMode, kanyeContext); }
      if (o.wysiwyg) { kanye.on('cmd+p', parent, wysiwygMode, kanyeContext); }
    }
    classes[ar](parent, 'bk-container');
    parent[mov](editable);
    if (place) { parent[mov](place); }
    parent[mov](commands);
    parent[mov](switchboard);
  }

  function destroy () {
    bindEvents(true);
    delete cache[i - 1];
  }

  function persistMode (name) {
    var old = modes[mode].button;
    var button = modes[name].button;
    if (mode === name) {
      return;
    }
    if (name === 'wysiwyg') {
      classes.rm(editable, 'bk-hide');
      if (place) { classes.rm(place, 'bk-hide'); }
      classes.add(textarea, 'bk-hide');
      setTimeout(focusEditable, 0);
    } else {
      classes.rm(textarea, 'bk-hide');
      classes.add(editable, 'bk-hide');
      if (place) { classes.add(place, 'bk-hide'); }
      textarea.focus();
    }
    classes.add(button, 'bk-mode-active');
    classes.rm(old, 'bk-mode-active');
    classes.add(old, 'bk-mode-inactive');
    classes.rm(button, 'bk-mode-inactive');
    button.setAttribute('disabled', 'disabled');
    old.removeAttribute('disabled');
    mode = api.mode = name;
    history.setInputMode(name);
    if (o.storage) { ls.set(o.storage, name); }
  }

  function focusEditable () {
    editable.focus();
  }

  function markdownMode (e) {
    stop(e);
    if (mode === 'markdown') {
      return;
    }
    if (mode === 'html') {
      textarea.value = o.parseHTML(textarea.value);
    } else {
      textarea.value = o.parseHTML(editable);
    }
    persistMode('markdown');
  }

  function htmlMode (e) {
    stop(e);
    if (mode === 'html') {
      return;
    }
    textarea.blur(); // avert chrome repaint bug
    if (mode === 'markdown') {
      textarea.value = o.parseMarkdown(textarea.value);
    } else {
      textarea.value = editable.innerHTML;
    }
    persistMode('html');
  }

  function wysiwygMode (e) {
    stop(e);
    if (mode === 'wysiwyg') {
      return;
    }
    if (mode === 'markdown') {
      editable.innerHTML = o.parseMarkdown(textarea.value);
    } else {
      editable.innerHTML = textarea.value;
    }
    persistMode('wysiwyg');
  }

  function getMarkdown () {
    if (mode === 'wysiwyg') {
      return o.parseHTML(editable);
    }
    if (mode === 'html') {
      return o.parseHTML(textarea.value);
    }
    return textarea.value;
  }

  function addCommandButton (id, combo, fn) {
    var button = tag({ t: 'button', c: 'bk-command', p: commands });
    var custom = o.render.commands;
    var render = typeof custom === 'function' ? custom : custom[id] || renderers.commands;
    var title = strings.titles[id];
    if (title) {
      button.setAttribute('title', mac ? macify(title) : title);
    }
    render(button, id);
    crossvent.add(button, 'click', getCommandHandler(surface, history, fn));
    addCommand(combo, fn);
    return button;
  }

  function addCommand (combo, fn) {
    kanye.on(combo, parent, getCommandHandler(surface, history, fn), kanyeContext);
  }
}

function tag (options) {
  var o = options || {};
  var el = doc.createElement(o.t || 'div');
  el.className = o.c || '';
  setText(el, o.x || '');
  if (o.p) { o.p.appendChild(el); }
  return el;
}

function stop (e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

function macify (text) {
  return text
    .replace(/\bctrl\b/i, '\u2318')
    .replace(/\balt\b/i, '\u2325')
    .replace(/\bshift\b/i, '\u21e7');
}

barkup.find = find;
barkup.strings = strings;
module.exports = barkup;
