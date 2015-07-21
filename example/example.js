void function () {
  'use strict';

  var rfence = /(^|\s)md-lang-((?:[^\s]|$)+)/;

  woofmark(document.querySelector('#ta'), {
    parseMarkdown: megamark,
    parseHTML: parseHTML,
    fencing: true,
    defaultMode: 'wysiwyg'
  });

  function parseHTML (value) {
    return domador(value, {
      fencing: true,
      fencinglanguage: fences
    });
  }

  function fences (el) {
    var match = el.firstChild.className.match(rfence);
    if (match) {
      return match.pop();
    }
  }

  function events (el, type, fn) {
    if (el.addEventListener) {
      el.addEventListener(type, fn);
    } else if (el.attachEvent) {
      el.attachEvent('on' + type, wrap(fn));
    } else {
      el['on' + type] = wrap(fn);
    }
    function wrap (originalEvent) {
      var e = originalEvent || global.event;
      e.target = e.target || e.srcElement;
      e.preventDefault  = e.preventDefault  || function preventDefault () { e.returnValue = false; };
      e.stopPropagation = e.stopPropagation || function stopPropagation () { e.cancelBubble = true; };
      fn.call(el, e);
    }
  }
}();
