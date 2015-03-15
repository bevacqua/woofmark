'use strict';

var crossvent = require('crossvent');
var render = require('./render');
var ENTER_KEY = 13;
var ESCAPE_KEY = 27;

function linkPrompt (done) {
  var dom = render({
    id: 'bk-prompt-link',
    title: 'Insert Link',
    description: 'Type or paste the url to your link',
    placeholder: 'http://example.com/ "title"'
  });
  init(dom, done);
}

function init (dom, done) {
  crossvent.add(dom.cancel, 'click', remove);
  crossvent.add(dom.close, 'click', remove);
  crossvent.add(dom.ok, 'click', ok);
  crossvent.add(dom.input, 'keypress', enter);
  crossvent.add(dom.input, 'keydown', esc);

  setTimeout(focusDialog, 0);

  function focusDialog () {
    dom.input.focus();
  }

  function enter (e) {
    var key = e.which || e.keyCode;
    if (key === ENTER_KEY) {
      ok();
      e.preventDefault();
    }
  }

  function esc (e) {
    var key = e.which || e.keyCode;
    if (key === ESCAPE_KEY) {
      remove();
      e.preventDefault();
    }
  }

  function ok () {
    remove();
    done(dom.input.value);
  }

  function remove () {
    dom.dialog.parentElement.removeChild(dom.dialog);
  }
}

linkPrompt.init = init;
module.exports = linkPrompt;
