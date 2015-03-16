'use strict';

var doc = global.document;
var fixEOL = require('./fixEOL');
var many = require('./many');
var cast = require('./cast');
var getSelection = require('./polyfills/getSelection');
var ropen = /^(<[^>]+(?: [^>]*)?>)/;
var rclose = /(<\/[^>]+>)$/;

function surface (textarea, editable) {
  return {
    textarea: textarea,
    editable: editable,
    focus: setFocus,
    read: read,
    write: write,
    current: current,
    writeSelection: writeSelection,
    readSelection: readSelection
  };

  function setFocus (mode) {
    current(mode).focus();
  }

  function current (mode) {
    return mode === 'wysiwyg' ? editable : textarea;
  }

  function read (mode) {
    if (mode === 'wysiwyg') {
      return editable.innerHTML;
    }
    return textarea.value;
  }

  function write (mode, value) {
    if (mode === 'wysiwyg') {
      editable.innerHTML = value;
    } else {
      textarea.value = value;
    }
  }

  function writeSelection (state) {
    if (state.mode === 'wysiwyg') {
      writeSelectionEditable(state);
    } else {
      writeSelectionTextarea(state);
    }
  }

  function readSelection (state) {
    if (state.mode === 'wysiwyg') {
      readSelectionEditable(state);
    } else {
      readSelectionTextarea(state);
    }
  }

  function writeSelectionTextarea (state) {
    var range;
    if (textarea.selectionStart !== void 0) {
      textarea.focus();
      textarea.selectionStart = state.start;
      textarea.selectionEnd = state.end;
      textarea.scrollTop = state.scrollTop;
    } else if (doc.selection) {
      if (doc.activeElement && doc.activeElement !== textarea) {
        return;
      }
      textarea.focus();
      range = textarea.createTextRange();
      range.moveStart('character', -textarea.value.length);
      range.moveEnd('character', -textarea.value.length);
      range.moveEnd('character', state.end);
      range.moveStart('character', state.start);
      range.select();
    }
  }

  function readSelectionTextarea (state) {
    if (textarea.selectionStart !== void 0) {
      state.start = textarea.selectionStart;
      state.end = textarea.selectionEnd;
    } else if (doc.selection) {
      state.text = fixEOL(textarea.value);

      var range = doc.selection.createRange();
      var fixedRange = fixEOL(range.text);
      var marker = '\x07';
      var markedRange = marker + fixedRange + marker;
      range.text = markedRange;
      var inputs = fixEOL(textarea.value);

      range.moveStart('character', -markedRange.length);
      range.text = fixedRange;

      state.start = inputs.indexOf(marker);
      state.end = inputs.lastIndexOf(marker) - marker.length;

      var diff = state.text.length - fixEOL(textarea.value).length;
      if (diff) {
        range.moveStart('character', -fixedRange.length);
        fixedRange += many('\n', diff);
        state.end += diff;
        range.text = fixedRange;
      }

      state.select();
    }
  }

  function writeSelectionEditable (state) {
    var chunks = state.cachedChunks || state.getChunks();
    var start = chunks.before.length;
    var end = start + chunks.selection.length;
    var startNode;
    var startOffset;
    var endNode;
    var endOffset;

    walk(editable.firstChild, peek);
    editable.focus();

    var range = document.createRange();
    var sel = getSelection();

    if (endNode) {
      range.setEnd(endNode, endOffset);
    } else {
      range.setEnd(startNode, startOffset);
    }
    range.setStart(startNode, startOffset);
    sel.removeAllRanges();
    sel.addRange(range);

    function peek (context, el) {
      var cursor = context.text.length;
      var content = readNode(el).length;
      var sum = cursor + content;
      if (!startNode && sum >= start) {
        startNode = el;
        startOffset = start - cursor;
      }
      if (!endNode && sum >= end) {
        endNode = el;
        endOffset = end - cursor;
      }
    }
  }

  function readSelectionEditable (state) {
    var sel = getSelection();
    var distance = walk(editable.firstChild, peek);

    state.text = distance.text;
    state.start = distance.start;
    state.end = distance.end;

    function peek (context, el) {
      if (el === sel.anchorNode) {
        context.start = context.text.length + sel.anchorOffset;
      }
      if (el === sel.focusNode) {
        context.end = context.text.length + sel.focusOffset;
      }
    }
  }

  function walk (el, peek, ctx, siblings) {
    var context = ctx || { text: '' };
    var elNode = el.nodeType === 1;
    var textNode = el.nodeType === 3;

    peek(context, el);

    if (textNode) {
      context.text += readNode(el);
    }
    if (elNode) {
      if (el.outerHTML.match(ropen)) { context.text += RegExp.$1; }
      cast(el.childNodes).forEach(walkChildren);
      if (el.outerHTML.match(rclose)) { context.text += RegExp.$1; }
    }
    if (siblings !== false && el.nextSibling) {
      return walk(el.nextSibling, peek, context);
    }
    return context;

    function walkChildren (child) {
      walk(child, peek, context, false);
    }
  }

  function readNode (el) {
    return el.nodeType === 3 ? fixEOL(el.textContent || el.innerText || '') : '';
  }
}

module.exports = surface;
