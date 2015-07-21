(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.woofmark = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var throttle = require('./throttle');
var tailormade = require('./tailormade');

function bullseye (el, target, options) {
  var o = options;
  var domTarget = target && target.tagName;

  if (!domTarget && arguments.length === 2) {
    o = target;
  }
  if (!domTarget) {
    target = el;
  }
  if (!o) { o = {}; }

  var destroyed = false;
  var throttledWrite = throttle(write, 30);
  var tailorOptions = { update: o.autoupdateToCaret !== false && update };
  var tailor = o.caret && tailormade(target, tailorOptions);

  write();

  if (o.tracking !== false) {
    crossvent.add(window, 'resize', throttledWrite);
  }

  return {
    read: readNull,
    refresh: write,
    destroy: destroy,
    sleep: sleep
  };

  function sleep () {
    tailorOptions.sleeping = true;
  }

  function readNull () { return read(); }

  function read (readings) {
    var bounds = target.getBoundingClientRect();
    var scrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    if (tailor) {
      readings = tailor.read();
      return {
        x: (readings.absolute ? 0 : bounds.left) + readings.x,
        y: (readings.absolute ? 0 : bounds.top) + scrollTop + readings.y + 20
      };
    }
    return {
      x: bounds.left,
      y: bounds.top + scrollTop
    };
  }

  function update (readings) {
    write(readings);
  }

  function write (readings) {
    if (destroyed) {
      throw new Error('Bullseye can\'t refresh after being destroyed. Create another instance instead.');
    }
    if (tailor && !readings) {
      tailorOptions.sleeping = false;
      tailor.refresh(); return;
    }
    var p = read(readings);
    if (!tailor && target !== el) {
      p.y += target.offsetHeight;
    }
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
  }

  function destroy () {
    if (tailor) { tailor.destroy(); }
    crossvent.remove(window, 'resize', throttledWrite);
    destroyed = true;
  }
}

module.exports = bullseye;

},{"./tailormade":3,"./throttle":4,"crossvent":6}],2:[function(require,module,exports){
'use strict';

var get = easyGet;
var set = easySet;

if (document.selection && document.selection.createRange) {
  get = hardGet;
  set = hardSet;
}

function easyGet (el) {
  return {
    start: el.selectionStart,
    end: el.selectionEnd
  };
}

function hardGet (el) {
  var active = document.activeElement;
  if (active !== el) {
    el.focus();
  }

  var range = document.selection.createRange();
  var bookmark = range.getBookmark();
  var original = el.value;
  var marker = getUniqueMarker(original);
  var parent = range.parentElement();
  if (parent === null || !inputs(parent)) {
    return result(0, 0);
  }
  range.text = marker + range.text + marker;

  var contents = el.value;

  el.value = original;
  range.moveToBookmark(bookmark);
  range.select();

  return result(contents.indexOf(marker), contents.lastIndexOf(marker) - marker.length);

  function result (start, end) {
    if (active !== el) { // don't disrupt pre-existing state
      if (active) {
        active.focus();
      } else {
        el.blur();
      }
    }
    return { start: start, end: end };
  }
}

function getUniqueMarker (contents) {
  var marker;
  do {
    marker = '@@marker.' + Math.random() * new Date();
  } while (contents.indexOf(marker) !== -1);
  return marker;
}

function inputs (el) {
  return ((el.tagName === 'INPUT' && el.type === 'text') || el.tagName === 'TEXTAREA');
}

function easySet (el, p) {
  el.selectionStart = parse(el, p.start);
  el.selectionEnd = parse(el, p.end);
}

function hardSet (el, p) {
  var range = el.createTextRange();

  if (p.start === 'end' && p.end === 'end') {
    range.collapse(false);
    range.select();
  } else {
    range.collapse(true);
    range.moveEnd('character', parse(el, p.end));
    range.moveStart('character', parse(el, p.start));
    range.select();
  }
}

function parse (el, value) {
  return value === 'end' ? el.value.length : value || 0;
}

function sell (el, p) {
  if (arguments.length === 2) {
    set(el, p);
  }
  return get(el);
}

module.exports = sell;

},{}],3:[function(require,module,exports){
(function (global){
'use strict';

var sell = require('sell');
var crossvent = require('crossvent');
var throttle = require('./throttle');
var props = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing'
];
var win = global;
var doc = document;
var ff = win.mozInnerScreenX !== null && win.mozInnerScreenX !== void 0;

function tailormade (el, options) {
  var textInput = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
  var throttledRefresh = throttle(refresh, 30);
  var o = options || {};

  bind();

  return {
    read: readPosition,
    refresh: throttledRefresh,
    destroy: destroy
  };

  function noop () {}
  function readPosition () { return (textInput ? coordsText : coordsHTML)(); }

  function refresh () {
    if (o.sleeping) {
      return;
    }
    return (o.update || noop)(readPosition());
  }

  function coordsText () {
    var p = sell(el);
    var context = prepare();
    var readings = readTextCoords(context, p.start);
    doc.body.removeChild(context.mirror);
    return readings;
  }

  function coordsHTML () {
    var sel = (o.getSelection || win.getSelection)();
    if (sel.rangeCount) {
      var range = sel.getRangeAt(0);
      var needsToWorkAroundNewlineBug = range.startContainer.nodeName === 'P' && range.startOffset === 0;
      if (needsToWorkAroundNewlineBug) {
        return {
          x: range.startContainer.offsetLeft,
          y: range.startContainer.offsetTop,
          absolute: true
        };
      }
      if (range.getClientRects) {
        var rects = range.getClientRects();
        if (rects.length > 0) {
          return {
            x: rects[0].left,
            y: rects[0].top,
            absolute: true
          };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  function readTextCoords (context, p) {
    var rest = doc.createElement('span');
    var mirror = context.mirror;
    var computed = context.computed;

    write(mirror, read(el).substring(0, p));

    if (el.tagName === 'INPUT') {
      mirror.textContent = mirror.textContent.replace(/\s/g, '\u00a0');
    }

    write(rest, read(el).substring(p) || '.');

    mirror.appendChild(rest);

    return {
      x: rest.offsetLeft + parseInt(computed['borderLeftWidth']),
      y: rest.offsetTop + parseInt(computed['borderTopWidth'])
    };
  }

  function read (el) {
    return textInput ? el.value : el.innerHTML;
  }

  function prepare () {
    var computed = win.getComputedStyle ? getComputedStyle(el) : el.currentStyle;
    var mirror = doc.createElement('div');
    var style = mirror.style;

    doc.body.appendChild(mirror);

    if (el.tagName !== 'INPUT') {
      style.wordWrap = 'break-word';
    }
    style.whiteSpace = 'pre-wrap';
    style.position = 'absolute';
    style.visibility = 'hidden';
    props.forEach(copy);

    if (ff) {
      style.width = parseInt(computed.width) - 2 + 'px';
      if (el.scrollHeight > parseInt(computed.height)) {
        style.overflowY = 'scroll';
      }
    } else {
      style.overflow = 'hidden';
    }
    return { mirror: mirror, computed: computed };

    function copy (prop) {
      style[prop] = computed[prop];
    }
  }

  function write (el, value) {
    if (textInput) {
      el.textContent = value;
    } else {
      el.innerHTML = value;
    }
  }

  function bind (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](el, 'keydown', throttledRefresh);
    crossvent[op](el, 'keyup', throttledRefresh);
    crossvent[op](el, 'input', throttledRefresh);
    crossvent[op](el, 'paste', throttledRefresh);
    crossvent[op](el, 'change', throttledRefresh);
  }

  function destroy () {
    bind(true);
  }
}

module.exports = tailormade;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90YWlsb3JtYWRlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc2VsbCA9IHJlcXVpcmUoJ3NlbGwnKTtcbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciB0aHJvdHRsZSA9IHJlcXVpcmUoJy4vdGhyb3R0bGUnKTtcbnZhciBwcm9wcyA9IFtcbiAgJ2RpcmVjdGlvbicsXG4gICdib3hTaXppbmcnLFxuICAnd2lkdGgnLFxuICAnaGVpZ2h0JyxcbiAgJ292ZXJmbG93WCcsXG4gICdvdmVyZmxvd1knLFxuICAnYm9yZGVyVG9wV2lkdGgnLFxuICAnYm9yZGVyUmlnaHRXaWR0aCcsXG4gICdib3JkZXJCb3R0b21XaWR0aCcsXG4gICdib3JkZXJMZWZ0V2lkdGgnLFxuICAncGFkZGluZ1RvcCcsXG4gICdwYWRkaW5nUmlnaHQnLFxuICAncGFkZGluZ0JvdHRvbScsXG4gICdwYWRkaW5nTGVmdCcsXG4gICdmb250U3R5bGUnLFxuICAnZm9udFZhcmlhbnQnLFxuICAnZm9udFdlaWdodCcsXG4gICdmb250U3RyZXRjaCcsXG4gICdmb250U2l6ZScsXG4gICdmb250U2l6ZUFkanVzdCcsXG4gICdsaW5lSGVpZ2h0JyxcbiAgJ2ZvbnRGYW1pbHknLFxuICAndGV4dEFsaWduJyxcbiAgJ3RleHRUcmFuc2Zvcm0nLFxuICAndGV4dEluZGVudCcsXG4gICd0ZXh0RGVjb3JhdGlvbicsXG4gICdsZXR0ZXJTcGFjaW5nJyxcbiAgJ3dvcmRTcGFjaW5nJ1xuXTtcbnZhciB3aW4gPSBnbG9iYWw7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgZmYgPSB3aW4ubW96SW5uZXJTY3JlZW5YICE9PSBudWxsICYmIHdpbi5tb3pJbm5lclNjcmVlblggIT09IHZvaWQgMDtcblxuZnVuY3Rpb24gdGFpbG9ybWFkZSAoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRleHRJbnB1dCA9IGVsLnRhZ05hbWUgPT09ICdJTlBVVCcgfHwgZWwudGFnTmFtZSA9PT0gJ1RFWFRBUkVBJztcbiAgdmFyIHRocm90dGxlZFJlZnJlc2ggPSB0aHJvdHRsZShyZWZyZXNoLCAzMCk7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcblxuICBiaW5kKCk7XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkUG9zaXRpb24sXG4gICAgcmVmcmVzaDogdGhyb3R0bGVkUmVmcmVzaCxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG5cbiAgZnVuY3Rpb24gbm9vcCAoKSB7fVxuICBmdW5jdGlvbiByZWFkUG9zaXRpb24gKCkgeyByZXR1cm4gKHRleHRJbnB1dCA/IGNvb3Jkc1RleHQgOiBjb29yZHNIVE1MKSgpOyB9XG5cbiAgZnVuY3Rpb24gcmVmcmVzaCAoKSB7XG4gICAgaWYgKG8uc2xlZXBpbmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmV0dXJuIChvLnVwZGF0ZSB8fCBub29wKShyZWFkUG9zaXRpb24oKSk7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNUZXh0ICgpIHtcbiAgICB2YXIgcCA9IHNlbGwoZWwpO1xuICAgIHZhciBjb250ZXh0ID0gcHJlcGFyZSgpO1xuICAgIHZhciByZWFkaW5ncyA9IHJlYWRUZXh0Q29vcmRzKGNvbnRleHQsIHAuc3RhcnQpO1xuICAgIGRvYy5ib2R5LnJlbW92ZUNoaWxkKGNvbnRleHQubWlycm9yKTtcbiAgICByZXR1cm4gcmVhZGluZ3M7XG4gIH1cblxuICBmdW5jdGlvbiBjb29yZHNIVE1MICgpIHtcbiAgICB2YXIgc2VsID0gKG8uZ2V0U2VsZWN0aW9uIHx8IHdpbi5nZXRTZWxlY3Rpb24pKCk7XG4gICAgaWYgKHNlbC5yYW5nZUNvdW50KSB7XG4gICAgICB2YXIgcmFuZ2UgPSBzZWwuZ2V0UmFuZ2VBdCgwKTtcbiAgICAgIHZhciBuZWVkc1RvV29ya0Fyb3VuZE5ld2xpbmVCdWcgPSByYW5nZS5zdGFydENvbnRhaW5lci5ub2RlTmFtZSA9PT0gJ1AnICYmIHJhbmdlLnN0YXJ0T2Zmc2V0ID09PSAwO1xuICAgICAgaWYgKG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1Zykge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHg6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm9mZnNldExlZnQsXG4gICAgICAgICAgeTogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0VG9wLFxuICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgICBpZiAocmFuZ2UuZ2V0Q2xpZW50UmVjdHMpIHtcbiAgICAgICAgdmFyIHJlY3RzID0gcmFuZ2UuZ2V0Q2xpZW50UmVjdHMoKTtcbiAgICAgICAgaWYgKHJlY3RzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgeDogcmVjdHNbMF0ubGVmdCxcbiAgICAgICAgICAgIHk6IHJlY3RzWzBdLnRvcCxcbiAgICAgICAgICAgIGFic29sdXRlOiB0cnVlXG4gICAgICAgICAgfTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyB4OiAwLCB5OiAwIH07XG4gIH1cblxuICBmdW5jdGlvbiByZWFkVGV4dENvb3JkcyAoY29udGV4dCwgcCkge1xuICAgIHZhciByZXN0ID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgICB2YXIgbWlycm9yID0gY29udGV4dC5taXJyb3I7XG4gICAgdmFyIGNvbXB1dGVkID0gY29udGV4dC5jb21wdXRlZDtcblxuICAgIHdyaXRlKG1pcnJvciwgcmVhZChlbCkuc3Vic3RyaW5nKDAsIHApKTtcblxuICAgIGlmIChlbC50YWdOYW1lID09PSAnSU5QVVQnKSB7XG4gICAgICBtaXJyb3IudGV4dENvbnRlbnQgPSBtaXJyb3IudGV4dENvbnRlbnQucmVwbGFjZSgvXFxzL2csICdcXHUwMGEwJyk7XG4gICAgfVxuXG4gICAgd3JpdGUocmVzdCwgcmVhZChlbCkuc3Vic3RyaW5nKHApIHx8ICcuJyk7XG5cbiAgICBtaXJyb3IuYXBwZW5kQ2hpbGQocmVzdCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgeDogcmVzdC5vZmZzZXRMZWZ0ICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlckxlZnRXaWR0aCddKSxcbiAgICAgIHk6IHJlc3Qub2Zmc2V0VG9wICsgcGFyc2VJbnQoY29tcHV0ZWRbJ2JvcmRlclRvcFdpZHRoJ10pXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKGVsKSB7XG4gICAgcmV0dXJuIHRleHRJbnB1dCA/IGVsLnZhbHVlIDogZWwuaW5uZXJIVE1MO1xuICB9XG5cbiAgZnVuY3Rpb24gcHJlcGFyZSAoKSB7XG4gICAgdmFyIGNvbXB1dGVkID0gd2luLmdldENvbXB1dGVkU3R5bGUgPyBnZXRDb21wdXRlZFN0eWxlKGVsKSA6IGVsLmN1cnJlbnRTdHlsZTtcbiAgICB2YXIgbWlycm9yID0gZG9jLmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIHZhciBzdHlsZSA9IG1pcnJvci5zdHlsZTtcblxuICAgIGRvYy5ib2R5LmFwcGVuZENoaWxkKG1pcnJvcik7XG5cbiAgICBpZiAoZWwudGFnTmFtZSAhPT0gJ0lOUFVUJykge1xuICAgICAgc3R5bGUud29yZFdyYXAgPSAnYnJlYWstd29yZCc7XG4gICAgfVxuICAgIHN0eWxlLndoaXRlU3BhY2UgPSAncHJlLXdyYXAnO1xuICAgIHN0eWxlLnBvc2l0aW9uID0gJ2Fic29sdXRlJztcbiAgICBzdHlsZS52aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gICAgcHJvcHMuZm9yRWFjaChjb3B5KTtcblxuICAgIGlmIChmZikge1xuICAgICAgc3R5bGUud2lkdGggPSBwYXJzZUludChjb21wdXRlZC53aWR0aCkgLSAyICsgJ3B4JztcbiAgICAgIGlmIChlbC5zY3JvbGxIZWlnaHQgPiBwYXJzZUludChjb21wdXRlZC5oZWlnaHQpKSB7XG4gICAgICAgIHN0eWxlLm92ZXJmbG93WSA9ICdzY3JvbGwnO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZS5vdmVyZmxvdyA9ICdoaWRkZW4nO1xuICAgIH1cbiAgICByZXR1cm4geyBtaXJyb3I6IG1pcnJvciwgY29tcHV0ZWQ6IGNvbXB1dGVkIH07XG5cbiAgICBmdW5jdGlvbiBjb3B5IChwcm9wKSB7XG4gICAgICBzdHlsZVtwcm9wXSA9IGNvbXB1dGVkW3Byb3BdO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHdyaXRlIChlbCwgdmFsdWUpIHtcbiAgICBpZiAodGV4dElucHV0KSB7XG4gICAgICBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xuICAgIH0gZWxzZSB7XG4gICAgICBlbC5pbm5lckhUTUwgPSB2YWx1ZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBiaW5kIChyZW1vdmUpIHtcbiAgICB2YXIgb3AgPSByZW1vdmUgPyAncmVtb3ZlJyA6ICdhZGQnO1xuICAgIGNyb3NzdmVudFtvcF0oZWwsICdrZXlkb3duJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleXVwJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2lucHV0JywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ3Bhc3RlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2NoYW5nZScsIHRocm90dGxlZFJlZnJlc2gpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgYmluZCh0cnVlKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRhaWxvcm1hZGU7XG4iXX0=
},{"./throttle":4,"crossvent":6,"sell":2}],4:[function(require,module,exports){
'use strict';

function throttle (fn, boundary) {
  var last = -Infinity;
  var timer;
  return function bounced () {
    if (timer) {
      return;
    }
    unbound();

    function unbound () {
      clearTimeout(timer);
      timer = null;
      var next = last + boundary;
      var now = Date.now();
      if (now > next) {
        last = now;
        fn();
      } else {
        timer = setTimeout(unbound, next - now);
      }
    }
  };
}

module.exports = throttle;

},{}],5:[function(require,module,exports){
(function (global){

var NativeCustomEvent = global.CustomEvent;

function useNative () {
  try {
    var p = new NativeCustomEvent('cat', { detail: { foo: 'bar' } });
    return  'cat' === p.type && 'bar' === p.detail.foo;
  } catch (e) {
  }
  return false;
}

/**
 * Cross-browser `CustomEvent` constructor.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent.CustomEvent
 *
 * @public
 */

module.exports = useNative() ? NativeCustomEvent :

// IE >= 9
'function' === typeof document.createEvent ? function CustomEvent (type, params) {
  var e = document.createEvent('CustomEvent');
  if (params) {
    e.initCustomEvent(type, params.bubbles, params.cancelable, params.detail);
  } else {
    e.initCustomEvent(type, false, false, void 0);
  }
  return e;
} :

// IE <= 8
function CustomEvent (type, params) {
  var e = document.createEventObject();
  e.type = type;
  if (params) {
    e.bubbles = Boolean(params.bubbles);
    e.cancelable = Boolean(params.cancelable);
    e.detail = params.detail;
  } else {
    e.bubbles = false;
    e.cancelable = false;
    e.detail = void 0;
  }
  return e;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvbm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIlxudmFyIE5hdGl2ZUN1c3RvbUV2ZW50ID0gZ2xvYmFsLkN1c3RvbUV2ZW50O1xuXG5mdW5jdGlvbiB1c2VOYXRpdmUgKCkge1xuICB0cnkge1xuICAgIHZhciBwID0gbmV3IE5hdGl2ZUN1c3RvbUV2ZW50KCdjYXQnLCB7IGRldGFpbDogeyBmb286ICdiYXInIH0gfSk7XG4gICAgcmV0dXJuICAnY2F0JyA9PT0gcC50eXBlICYmICdiYXInID09PSBwLmRldGFpbC5mb287XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICByZXR1cm4gZmFsc2U7XG59XG5cbi8qKlxuICogQ3Jvc3MtYnJvd3NlciBgQ3VzdG9tRXZlbnRgIGNvbnN0cnVjdG9yLlxuICpcbiAqIGh0dHBzOi8vZGV2ZWxvcGVyLm1vemlsbGEub3JnL2VuLVVTL2RvY3MvV2ViL0FQSS9DdXN0b21FdmVudC5DdXN0b21FdmVudFxuICpcbiAqIEBwdWJsaWNcbiAqL1xuXG5tb2R1bGUuZXhwb3J0cyA9IHVzZU5hdGl2ZSgpID8gTmF0aXZlQ3VzdG9tRXZlbnQgOlxuXG4vLyBJRSA+PSA5XG4nZnVuY3Rpb24nID09PSB0eXBlb2YgZG9jdW1lbnQuY3JlYXRlRXZlbnQgPyBmdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnQoJ0N1c3RvbUV2ZW50Jyk7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBwYXJhbXMuYnViYmxlcywgcGFyYW1zLmNhbmNlbGFibGUsIHBhcmFtcy5kZXRhaWwpO1xuICB9IGVsc2Uge1xuICAgIGUuaW5pdEN1c3RvbUV2ZW50KHR5cGUsIGZhbHNlLCBmYWxzZSwgdm9pZCAwKTtcbiAgfVxuICByZXR1cm4gZTtcbn0gOlxuXG4vLyBJRSA8PSA4XG5mdW5jdGlvbiBDdXN0b21FdmVudCAodHlwZSwgcGFyYW1zKSB7XG4gIHZhciBlID0gZG9jdW1lbnQuY3JlYXRlRXZlbnRPYmplY3QoKTtcbiAgZS50eXBlID0gdHlwZTtcbiAgaWYgKHBhcmFtcykge1xuICAgIGUuYnViYmxlcyA9IEJvb2xlYW4ocGFyYW1zLmJ1YmJsZXMpO1xuICAgIGUuY2FuY2VsYWJsZSA9IEJvb2xlYW4ocGFyYW1zLmNhbmNlbGFibGUpO1xuICAgIGUuZGV0YWlsID0gcGFyYW1zLmRldGFpbDtcbiAgfSBlbHNlIHtcbiAgICBlLmJ1YmJsZXMgPSBmYWxzZTtcbiAgICBlLmNhbmNlbGFibGUgPSBmYWxzZTtcbiAgICBlLmRldGFpbCA9IHZvaWQgMDtcbiAgfVxuICByZXR1cm4gZTtcbn1cbiJdfQ==
},{}],6:[function(require,module,exports){
(function (global){
'use strict';

var customEvent = require('custom-event');
var eventmap = require('./eventmap');
var doc = document;
var addEvent = addEventEasy;
var removeEvent = removeEventEasy;
var hardCache = [];

if (!global.addEventListener) {
  addEvent = addEventHard;
  removeEvent = removeEventHard;
}

function addEventEasy (el, type, fn, capturing) {
  return el.addEventListener(type, fn, capturing);
}

function addEventHard (el, type, fn) {
  return el.attachEvent('on' + type, wrap(el, type, fn));
}

function removeEventEasy (el, type, fn, capturing) {
  return el.removeEventListener(type, fn, capturing);
}

function removeEventHard (el, type, fn) {
  return el.detachEvent('on' + type, unwrap(el, type, fn));
}

function fabricateEvent (el, type, model) {
  var e = eventmap.indexOf(type) === -1 ? makeCustomEvent() : makeClassicEvent();
  if (el.dispatchEvent) {
    el.dispatchEvent(e);
  } else {
    el.fireEvent('on' + type, e);
  }
  function makeClassicEvent () {
    var e;
    if (doc.createEvent) {
      e = doc.createEvent('Event');
      e.initEvent(type, true, true);
    } else if (doc.createEventObject) {
      e = doc.createEventObject();
    }
    return e;
  }
  function makeCustomEvent () {
    return new customEvent(type, { detail: model });
  }
}

function wrapperFactory (el, type, fn) {
  return function wrapper (originalEvent) {
    var e = originalEvent || global.event;
    e.target = e.target || e.srcElement;
    e.preventDefault = e.preventDefault || function preventDefault () { e.returnValue = false; };
    e.stopPropagation = e.stopPropagation || function stopPropagation () { e.cancelBubble = true; };
    e.which = e.which || e.keyCode;
    fn.call(el, e);
  };
}

function wrap (el, type, fn) {
  var wrapper = unwrap(el, type, fn) || wrapperFactory(el, type, fn);
  hardCache.push({
    wrapper: wrapper,
    element: el,
    type: type,
    fn: fn
  });
  return wrapper;
}

function unwrap (el, type, fn) {
  var i = find(el, type, fn);
  if (i) {
    var wrapper = hardCache[i].wrapper;
    hardCache.splice(i, 1); // free up a tad of memory
    return wrapper;
  }
}

function find (el, type, fn) {
  var i, item;
  for (i = 0; i < hardCache.length; i++) {
    item = hardCache[i];
    if (item.element === el && item.type === type && item.fn === fn) {
      return i;
    }
  }
}

module.exports = {
  add: addEvent,
  remove: removeEvent,
  fabricate: fabricateEvent
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBjdXN0b21FdmVudCA9IHJlcXVpcmUoJ2N1c3RvbS1ldmVudCcpO1xudmFyIGV2ZW50bWFwID0gcmVxdWlyZSgnLi9ldmVudG1hcCcpO1xudmFyIGRvYyA9IGRvY3VtZW50O1xudmFyIGFkZEV2ZW50ID0gYWRkRXZlbnRFYXN5O1xudmFyIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRFYXN5O1xudmFyIGhhcmRDYWNoZSA9IFtdO1xuXG5pZiAoIWdsb2JhbC5hZGRFdmVudExpc3RlbmVyKSB7XG4gIGFkZEV2ZW50ID0gYWRkRXZlbnRIYXJkO1xuICByZW1vdmVFdmVudCA9IHJlbW92ZUV2ZW50SGFyZDtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRFYXN5IChlbCwgdHlwZSwgZm4sIGNhcHR1cmluZykge1xuICByZXR1cm4gZWwuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBmbiwgY2FwdHVyaW5nKTtcbn1cblxuZnVuY3Rpb24gYWRkRXZlbnRIYXJkIChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGVsLmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCB3cmFwKGVsLCB0eXBlLCBmbikpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5yZW1vdmVFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiByZW1vdmVFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICByZXR1cm4gZWwuZGV0YWNoRXZlbnQoJ29uJyArIHR5cGUsIHVud3JhcChlbCwgdHlwZSwgZm4pKTtcbn1cblxuZnVuY3Rpb24gZmFicmljYXRlRXZlbnQgKGVsLCB0eXBlLCBtb2RlbCkge1xuICB2YXIgZSA9IGV2ZW50bWFwLmluZGV4T2YodHlwZSkgPT09IC0xID8gbWFrZUN1c3RvbUV2ZW50KCkgOiBtYWtlQ2xhc3NpY0V2ZW50KCk7XG4gIGlmIChlbC5kaXNwYXRjaEV2ZW50KSB7XG4gICAgZWwuZGlzcGF0Y2hFdmVudChlKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5maXJlRXZlbnQoJ29uJyArIHR5cGUsIGUpO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDbGFzc2ljRXZlbnQgKCkge1xuICAgIHZhciBlO1xuICAgIGlmIChkb2MuY3JlYXRlRXZlbnQpIHtcbiAgICAgIGUgPSBkb2MuY3JlYXRlRXZlbnQoJ0V2ZW50Jyk7XG4gICAgICBlLmluaXRFdmVudCh0eXBlLCB0cnVlLCB0cnVlKTtcbiAgICB9IGVsc2UgaWYgKGRvYy5jcmVhdGVFdmVudE9iamVjdCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudE9iamVjdCgpO1xuICAgIH1cbiAgICByZXR1cm4gZTtcbiAgfVxuICBmdW5jdGlvbiBtYWtlQ3VzdG9tRXZlbnQgKCkge1xuICAgIHJldHVybiBuZXcgY3VzdG9tRXZlbnQodHlwZSwgeyBkZXRhaWw6IG1vZGVsIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIHdyYXBwZXJGYWN0b3J5IChlbCwgdHlwZSwgZm4pIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHdyYXBwZXIgKG9yaWdpbmFsRXZlbnQpIHtcbiAgICB2YXIgZSA9IG9yaWdpbmFsRXZlbnQgfHwgZ2xvYmFsLmV2ZW50O1xuICAgIGUudGFyZ2V0ID0gZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50O1xuICAgIGUucHJldmVudERlZmF1bHQgPSBlLnByZXZlbnREZWZhdWx0IHx8IGZ1bmN0aW9uIHByZXZlbnREZWZhdWx0ICgpIHsgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlOyB9O1xuICAgIGUuc3RvcFByb3BhZ2F0aW9uID0gZS5zdG9wUHJvcGFnYXRpb24gfHwgZnVuY3Rpb24gc3RvcFByb3BhZ2F0aW9uICgpIHsgZS5jYW5jZWxCdWJibGUgPSB0cnVlOyB9O1xuICAgIGUud2hpY2ggPSBlLndoaWNoIHx8IGUua2V5Q29kZTtcbiAgICBmbi5jYWxsKGVsLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gd3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciB3cmFwcGVyID0gdW53cmFwKGVsLCB0eXBlLCBmbikgfHwgd3JhcHBlckZhY3RvcnkoZWwsIHR5cGUsIGZuKTtcbiAgaGFyZENhY2hlLnB1c2goe1xuICAgIHdyYXBwZXI6IHdyYXBwZXIsXG4gICAgZWxlbWVudDogZWwsXG4gICAgdHlwZTogdHlwZSxcbiAgICBmbjogZm5cbiAgfSk7XG4gIHJldHVybiB3cmFwcGVyO1xufVxuXG5mdW5jdGlvbiB1bndyYXAgKGVsLCB0eXBlLCBmbikge1xuICB2YXIgaSA9IGZpbmQoZWwsIHR5cGUsIGZuKTtcbiAgaWYgKGkpIHtcbiAgICB2YXIgd3JhcHBlciA9IGhhcmRDYWNoZVtpXS53cmFwcGVyO1xuICAgIGhhcmRDYWNoZS5zcGxpY2UoaSwgMSk7IC8vIGZyZWUgdXAgYSB0YWQgb2YgbWVtb3J5XG4gICAgcmV0dXJuIHdyYXBwZXI7XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpLCBpdGVtO1xuICBmb3IgKGkgPSAwOyBpIDwgaGFyZENhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaXRlbSA9IGhhcmRDYWNoZVtpXTtcbiAgICBpZiAoaXRlbS5lbGVtZW50ID09PSBlbCAmJiBpdGVtLnR5cGUgPT09IHR5cGUgJiYgaXRlbS5mbiA9PT0gZm4pIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRFdmVudCxcbiAgcmVtb3ZlOiByZW1vdmVFdmVudCxcbiAgZmFicmljYXRlOiBmYWJyaWNhdGVFdmVudFxufTtcbiJdfQ==
},{"./eventmap":7,"custom-event":5}],7:[function(require,module,exports){
(function (global){
'use strict';

var eventmap = [];
var eventname = '';
var ron = /^on/;

for (eventname in global) {
  if (ron.test(eventname)) {
    eventmap.push(eventname.slice(2));
  }
}

module.exports = eventmap;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBldmVudG1hcCA9IFtdO1xudmFyIGV2ZW50bmFtZSA9ICcnO1xudmFyIHJvbiA9IC9eb24vO1xuXG5mb3IgKGV2ZW50bmFtZSBpbiBnbG9iYWwpIHtcbiAgaWYgKHJvbi50ZXN0KGV2ZW50bmFtZSkpIHtcbiAgICBldmVudG1hcC5wdXNoKGV2ZW50bmFtZS5zbGljZSgyKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBldmVudG1hcDtcbiJdfQ==
},{}],8:[function(require,module,exports){
'use strict';

var sektor = require('sektor');
var crossvent = require('crossvent');
var rspaces = /\s+/g;
var keymap = {
  13: 'enter',
  27: 'esc',
  32: 'space'
};
var handlers = {};

crossvent.add(window, 'keydown', keydown);

function clear (context) {
  if (context) {
    if (context in handlers) {
      handlers[context] = {};
    }
  } else {
    handlers = {};
  }
}

function switchboard (then, combo, options, fn) {
  if (fn === void 0) {
    fn = options;
    options = {};
  }

  var context = options.context || 'defaults';

  if (!fn) {
    return;
  }

  if (handlers[context] === void 0) {
    handlers[context] = {};
  }

  combo.toLowerCase().split(rspaces).forEach(item);

  function item (keys) {
    var c = keys.trim();
    if (c.length === 0) {
      return;
    }
    then(handlers[context], c, options, fn);
  }
}

function on (combo, options, fn) {
  switchboard(add, combo, options, fn);

  function add (area, key, options, fn) {
    var handler = {
      handle: fn,
      filter: options.filter
    };
    if (area[key]) {
      area[key].push(handler);
    } else {
      area[key] = [handler];
    }
  }
}

function off (combo, options, fn) {
  switchboard(rm, combo, options, fn);

  function rm (area, key, options, fn) {
    if (area[key]) {
      area[key] = area[key].filter(matching);
    }

    function matching (handler) {
      return handler.handle === fn && handler.filter === options.filter;
    }
  }
}

function getKeyCode (e) {
  return e.which || e.keyCode || e.charCode;
}

function keydown (e) {
  var code = getKeyCode(e);
  var key = keymap[code] || String.fromCharCode(code);
  if (key) {
    handle(key, e);
  }
}

function parseKeyCombo (key, e) {
  var combo = [key];
  if (e.shiftKey) {
    combo.unshift('shift');
  }
  if (e.altKey) {
    combo.unshift('alt');
  }
  if (e.ctrlKey ^ e.metaKey) {
    combo.unshift('cmd');
  }
  return combo.join('+').toLowerCase();
}

function handle (key, e) {
  var combo = parseKeyCombo(key, e);
  var context;
  for (context in handlers) {
    if (handlers[context][combo]) {
      handlers[context][combo].forEach(exec);
    }
  }

  function filtered (handler) {
    var filter = handler.filter;
    if (!filter) {
      return;
    }

    var el = e.target;
    var selector = typeof filter === 'string';
    if (selector) {
      return sektor.matchesSelector(el, filter) === false;
    }
    while (el.parentElement && el !== filter) {
      el = el.parentElement;
    }
    return el !== filter;
  }

  function exec (handler) {
    if (filtered(handler)) {
      return;
    }
    handler.handle(e);
  }
}

module.exports = {
  on: on,
  off: off,
  clear: clear,
  handlers: handlers
};

},{"crossvent":6,"sektor":9}],9:[function(require,module,exports){
(function (global){
'use strict';

var expando = 'sektor-' + Date.now();
var rsiblings = /[+~]/;
var document = global.document;
var del = document.documentElement;
var match = del.matches ||
            del.webkitMatchesSelector ||
            del.mozMatchesSelector ||
            del.oMatchesSelector ||
            del.msMatchesSelector;

function qsa (selector, context) {
  var existed, id, prefix, prefixed, adapter, hack = context !== document;
  if (hack) { // id hack for context-rooted queries
    existed = context.getAttribute('id');
    id = existed || expando;
    prefix = '#' + id + ' ';
    prefixed = prefix + selector.replace(/,/g, ',' + prefix);
    adapter = rsiblings.test(selector) && context.parentNode;
    if (!existed) { context.setAttribute('id', id); }
  }
  try {
    return (adapter || context).querySelectorAll(prefixed || selector);
  } catch (e) {
    return [];
  } finally {
    if (existed === null) { context.removeAttribute('id'); }
  }
}

function find (selector, ctx, collection, seed) {
  var element;
  var context = ctx || document;
  var results = collection || [];
  var i = 0;
  if (typeof selector !== 'string') {
    return results;
  }
  if (context.nodeType !== 1 && context.nodeType !== 9) {
    return []; // bail if context is not an element or document
  }
  if (seed) {
    while ((element = seed[i++])) {
      if (matchesSelector(element, selector)) {
        results.push(element);
      }
    }
  } else {
    results.push.apply(results, qsa(selector, context));
  }
  return results;
}

function matches (selector, elements) {
  return find(selector, null, null, elements);
}

function matchesSelector (element, selector) {
  return match.call(element, selector);
}

module.exports = find;

find.matches = matches;
find.matchesSelector = matchesSelector;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9rYW55ZS9ub2RlX21vZHVsZXMvc2VrdG9yL3NyYy9zZWt0b3IuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBleHBhbmRvID0gJ3Nla3Rvci0nICsgRGF0ZS5ub3coKTtcbnZhciByc2libGluZ3MgPSAvWyt+XS87XG52YXIgZG9jdW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgZGVsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xudmFyIG1hdGNoID0gZGVsLm1hdGNoZXMgfHxcbiAgICAgICAgICAgIGRlbC53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICAgICAgICAgIGRlbC5tb3pNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICAgICAgICAgIGRlbC5vTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgICAgICAgICBkZWwubXNNYXRjaGVzU2VsZWN0b3I7XG5cbmZ1bmN0aW9uIHFzYSAoc2VsZWN0b3IsIGNvbnRleHQpIHtcbiAgdmFyIGV4aXN0ZWQsIGlkLCBwcmVmaXgsIHByZWZpeGVkLCBhZGFwdGVyLCBoYWNrID0gY29udGV4dCAhPT0gZG9jdW1lbnQ7XG4gIGlmIChoYWNrKSB7IC8vIGlkIGhhY2sgZm9yIGNvbnRleHQtcm9vdGVkIHF1ZXJpZXNcbiAgICBleGlzdGVkID0gY29udGV4dC5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgaWQgPSBleGlzdGVkIHx8IGV4cGFuZG87XG4gICAgcHJlZml4ID0gJyMnICsgaWQgKyAnICc7XG4gICAgcHJlZml4ZWQgPSBwcmVmaXggKyBzZWxlY3Rvci5yZXBsYWNlKC8sL2csICcsJyArIHByZWZpeCk7XG4gICAgYWRhcHRlciA9IHJzaWJsaW5ncy50ZXN0KHNlbGVjdG9yKSAmJiBjb250ZXh0LnBhcmVudE5vZGU7XG4gICAgaWYgKCFleGlzdGVkKSB7IGNvbnRleHQuc2V0QXR0cmlidXRlKCdpZCcsIGlkKTsgfVxuICB9XG4gIHRyeSB7XG4gICAgcmV0dXJuIChhZGFwdGVyIHx8IGNvbnRleHQpLnF1ZXJ5U2VsZWN0b3JBbGwocHJlZml4ZWQgfHwgc2VsZWN0b3IpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChleGlzdGVkID09PSBudWxsKSB7IGNvbnRleHQucmVtb3ZlQXR0cmlidXRlKCdpZCcpOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoc2VsZWN0b3IsIGN0eCwgY29sbGVjdGlvbiwgc2VlZCkge1xuICB2YXIgZWxlbWVudDtcbiAgdmFyIGNvbnRleHQgPSBjdHggfHwgZG9jdW1lbnQ7XG4gIHZhciByZXN1bHRzID0gY29sbGVjdGlvbiB8fCBbXTtcbiAgdmFyIGkgPSAwO1xuICBpZiAodHlwZW9mIHNlbGVjdG9yICE9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIGlmIChjb250ZXh0Lm5vZGVUeXBlICE9PSAxICYmIGNvbnRleHQubm9kZVR5cGUgIT09IDkpIHtcbiAgICByZXR1cm4gW107IC8vIGJhaWwgaWYgY29udGV4dCBpcyBub3QgYW4gZWxlbWVudCBvciBkb2N1bWVudFxuICB9XG4gIGlmIChzZWVkKSB7XG4gICAgd2hpbGUgKChlbGVtZW50ID0gc2VlZFtpKytdKSkge1xuICAgICAgaWYgKG1hdGNoZXNTZWxlY3RvcihlbGVtZW50LCBzZWxlY3RvcikpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXN1bHRzLnB1c2guYXBwbHkocmVzdWx0cywgcXNhKHNlbGVjdG9yLCBjb250ZXh0KSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMgKHNlbGVjdG9yLCBlbGVtZW50cykge1xuICByZXR1cm4gZmluZChzZWxlY3RvciwgbnVsbCwgbnVsbCwgZWxlbWVudHMpO1xufVxuXG5mdW5jdGlvbiBtYXRjaGVzU2VsZWN0b3IgKGVsZW1lbnQsIHNlbGVjdG9yKSB7XG4gIHJldHVybiBtYXRjaC5jYWxsKGVsZW1lbnQsIHNlbGVjdG9yKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaW5kO1xuXG5maW5kLm1hdGNoZXMgPSBtYXRjaGVzO1xuZmluZC5tYXRjaGVzU2VsZWN0b3IgPSBtYXRjaGVzU2VsZWN0b3I7XG4iXX0=
},{}],10:[function(require,module,exports){
(function (global){
'use strict';

var stub = require('./stub');
var tracking = require('./tracking');
var ls = 'localStorage' in global && global.localStorage ? global.localStorage : stub;

function accessor (key, value) {
  if (arguments.length === 1) {
    return get(key);
  }
  return set(key, value);
}

function get (key) {
  return JSON.parse(ls.getItem(key));
}

function set (key, value) {
  try {
    ls.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

function remove (key) {
  return ls.removeItem(key);
}

function clear () {
  return ls.clear();
}

accessor.set = set;
accessor.get = get;
accessor.remove = remove;
accessor.clear = clear;
accessor.on = tracking.on;
accessor.off = tracking.off;

module.exports = accessor;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sb2NhbC1zdG9yYWdlL2xvY2FsLXN0b3JhZ2UuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBzdHViID0gcmVxdWlyZSgnLi9zdHViJyk7XG52YXIgdHJhY2tpbmcgPSByZXF1aXJlKCcuL3RyYWNraW5nJyk7XG52YXIgbHMgPSAnbG9jYWxTdG9yYWdlJyBpbiBnbG9iYWwgJiYgZ2xvYmFsLmxvY2FsU3RvcmFnZSA/IGdsb2JhbC5sb2NhbFN0b3JhZ2UgOiBzdHViO1xuXG5mdW5jdGlvbiBhY2Nlc3NvciAoa2V5LCB2YWx1ZSkge1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgIHJldHVybiBnZXQoa2V5KTtcbiAgfVxuICByZXR1cm4gc2V0KGtleSwgdmFsdWUpO1xufVxuXG5mdW5jdGlvbiBnZXQgKGtleSkge1xuICByZXR1cm4gSlNPTi5wYXJzZShscy5nZXRJdGVtKGtleSkpO1xufVxuXG5mdW5jdGlvbiBzZXQgKGtleSwgdmFsdWUpIHtcbiAgdHJ5IHtcbiAgICBscy5zZXRJdGVtKGtleSwgSlNPTi5zdHJpbmdpZnkodmFsdWUpKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5mdW5jdGlvbiByZW1vdmUgKGtleSkge1xuICByZXR1cm4gbHMucmVtb3ZlSXRlbShrZXkpO1xufVxuXG5mdW5jdGlvbiBjbGVhciAoKSB7XG4gIHJldHVybiBscy5jbGVhcigpO1xufVxuXG5hY2Nlc3Nvci5zZXQgPSBzZXQ7XG5hY2Nlc3Nvci5nZXQgPSBnZXQ7XG5hY2Nlc3Nvci5yZW1vdmUgPSByZW1vdmU7XG5hY2Nlc3Nvci5jbGVhciA9IGNsZWFyO1xuYWNjZXNzb3Iub24gPSB0cmFja2luZy5vbjtcbmFjY2Vzc29yLm9mZiA9IHRyYWNraW5nLm9mZjtcblxubW9kdWxlLmV4cG9ydHMgPSBhY2Nlc3NvcjtcbiJdfQ==
},{"./stub":11,"./tracking":12}],11:[function(require,module,exports){
'use strict';

var ms = {};

function getItem (key) {
  return key in ms ? ms[key] : null;
}

function setItem (key, value) {
  ms[key] = value;
  return true;
}

function removeItem (key) {
  var found = key in ms;
  if (found) {
    return delete ms[key];
  }
  return false;
}

function clear () {
  ms = {};
  return true;
}

module.exports = {
  getItem: getItem,
  setItem: setItem,
  removeItem: removeItem,
  clear: clear
};

},{}],12:[function(require,module,exports){
(function (global){
'use strict';

var listeners = {};
var listening = false;

function listen () {
  if (global.addEventListener) {
    global.addEventListener('storage', change, false);
  } else if (global.attachEvent) {
    global.attachEvent('onstorage', change);
  } else {
    global.onstorage = change;
  }
}

function change (e) {
  if (!e) {
    e = global.event;
  }
  var all = listeners[e.key];
  if (all) {
    all.forEach(fire);
  }

  function fire (listener) {
    listener(JSON.parse(e.newValue), JSON.parse(e.oldValue), e.url || e.uri);
  }
}

function on (key, fn) {
  if (listeners[key]) {
    listeners[key].push(fn);
  } else {
    listeners[key] = [fn];
  }
  if (listening === false) {
    listen();
  }
}

function off (key, fn) {
  var ns = listeners[key];
  if (ns.length > 1) {
    ns.splice(ns.indexOf(fn), 1);
  } else {
    listeners[key] = [];
  }
}

module.exports = {
  on: on,
  off: off
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9sb2NhbC1zdG9yYWdlL3RyYWNraW5nLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGxpc3RlbmVycyA9IHt9O1xudmFyIGxpc3RlbmluZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBsaXN0ZW4gKCkge1xuICBpZiAoZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignc3RvcmFnZScsIGNoYW5nZSwgZmFsc2UpO1xuICB9IGVsc2UgaWYgKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25zdG9yYWdlJywgY2hhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICBnbG9iYWwub25zdG9yYWdlID0gY2hhbmdlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYW5nZSAoZSkge1xuICBpZiAoIWUpIHtcbiAgICBlID0gZ2xvYmFsLmV2ZW50O1xuICB9XG4gIHZhciBhbGwgPSBsaXN0ZW5lcnNbZS5rZXldO1xuICBpZiAoYWxsKSB7XG4gICAgYWxsLmZvckVhY2goZmlyZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlIChsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVyKEpTT04ucGFyc2UoZS5uZXdWYWx1ZSksIEpTT04ucGFyc2UoZS5vbGRWYWx1ZSksIGUudXJsIHx8IGUudXJpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvbiAoa2V5LCBmbikge1xuICBpZiAobGlzdGVuZXJzW2tleV0pIHtcbiAgICBsaXN0ZW5lcnNba2V5XS5wdXNoKGZuKTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0ZW5lcnNba2V5XSA9IFtmbl07XG4gIH1cbiAgaWYgKGxpc3RlbmluZyA9PT0gZmFsc2UpIHtcbiAgICBsaXN0ZW4oKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvZmYgKGtleSwgZm4pIHtcbiAgdmFyIG5zID0gbGlzdGVuZXJzW2tleV07XG4gIGlmIChucy5sZW5ndGggPiAxKSB7XG4gICAgbnMuc3BsaWNlKG5zLmluZGV4T2YoZm4pLCAxKTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0ZW5lcnNba2V5XSA9IFtdO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBvbjogb24sXG4gIG9mZjogb2ZmXG59O1xuIl19
},{}],13:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var InputState = require('./InputState');

function InputHistory (surface, mode) {
  var state = this;

  state.inputMode = mode;
  state.surface = surface;
  state.reset();

  listen(surface.textarea);
  listen(surface.editable);

  function listen (el) {
    var pasteHandler = selfie(handlePaste);
    crossvent.add(el, 'keypress', preventCtrlYZ);
    crossvent.add(el, 'keydown', selfie(handleCtrlYZ));
    crossvent.add(el, 'keydown', selfie(handleModeChange));
    crossvent.add(el, 'mousedown', setMoving);
    el.onpaste = pasteHandler;
    el.ondrop = pasteHandler;
  }

  function setMoving () {
    state.setMode('moving');
  }

  function selfie (fn) {
    return function handler (e) { return fn.call(null, state, e); };
  }
}

InputHistory.prototype.setInputMode = function (mode) {
  var state = this;
  state.inputMode = mode;
  state.reset();
};

InputHistory.prototype.reset = function () {
  var state = this;
  state.inputState = null;
  state.lastState = null;
  state.history = [];
  state.historyPointer = 0;
  state.historyMode = 'none';
  state.refreshing = null;
  state.refreshState(true);
  state.saveState();
  return state;
};

InputHistory.prototype.setCommandMode = function () {
  var state = this;
  state.historyMode = 'command';
  state.saveState();
  state.refreshing = setTimeout(function () {
    state.refreshState();
  }, 0);
};

InputHistory.prototype.canUndo = function () {
  return this.historyPointer > 1;
};

InputHistory.prototype.canRedo = function () {
  return this.history[this.historyPointer + 1];
};

InputHistory.prototype.undo = function () {
  var state = this;
  if (state.canUndo()) {
    if (state.lastState) {
      state.lastState.restore();
      state.lastState = null;
    } else {
      state.history[state.historyPointer] = new InputState(state.surface, state.inputMode);
      state.history[--state.historyPointer].restore();
    }
  }
  state.historyMode = 'none';
  state.surface.focus(state.inputMode);
  state.refreshState();
};

InputHistory.prototype.redo = function () {
  var state = this;
  if (state.canRedo()) {
    state.history[++state.historyPointer].restore();
  }

  state.historyMode = 'none';
  state.surface.focus(state.inputMode);
  state.refreshState();
};

InputHistory.prototype.setMode = function (value) {
  var state = this;
  if (state.historyMode !== value) {
    state.historyMode = value;
    state.saveState();
  }
  state.refreshing = setTimeout(function () {
    state.refreshState();
  }, 1);
};

InputHistory.prototype.refreshState = function (initialState) {
  var state = this;
  state.inputState = new InputState(state.surface, state.inputMode, initialState);
  state.refreshing = null;
};

InputHistory.prototype.saveState = function () {
  var state = this;
  var current = state.inputState || new InputState(state.surface, state.inputMode);

  if (state.historyMode === 'moving') {
    if (!state.lastState) {
      state.lastState = current;
    }
    return;
  }
  if (state.lastState) {
    if (state.history[state.historyPointer - 1].text !== state.lastState.text) {
      state.history[state.historyPointer++] = state.lastState;
    }
    state.lastState = null;
  }
  state.history[state.historyPointer++] = current;
  state.history[state.historyPointer + 1] = null;
};

function handleCtrlYZ (state, e) {
  var handled = false;
  var keyCode = e.charCode || e.keyCode;
  var keyCodeChar = String.fromCharCode(keyCode);

  if (e.ctrlKey || e.metaKey) {
    switch (keyCodeChar.toLowerCase()) {
      case 'y':
        state.redo();
        handled = true;
        break;

      case 'z':
        if (e.shiftKey) {
          state.redo();
        } else {
          state.undo();
        }
        handled = true;
        break;
    }
  }

  if (handled && e.preventDefault) {
    e.preventDefault();
  }
}

function handleModeChange (state, e) {
  if (e.ctrlKey || e.metaKey) {
    return;
  }

  var keyCode = e.keyCode;

  if ((keyCode >= 33 && keyCode <= 40) || (keyCode >= 63232 && keyCode <= 63235)) {
    state.setMode('moving');
  } else if (keyCode === 8 || keyCode === 46 || keyCode === 127) {
    state.setMode('deleting');
  } else if (keyCode === 13) {
    state.setMode('newlines');
  } else if (keyCode === 27) {
    state.setMode('escape');
  } else if ((keyCode < 16 || keyCode > 20) && keyCode !== 91) {
    state.setMode('typing');
  }
}

function handlePaste (state) {
  if (state.inputState && state.inputState.text !== state.surface.read(state.inputMode) && state.refreshing === null) {
    state.historyMode = 'paste';
    state.saveState();
    state.refreshState();
  }
}

function preventCtrlYZ (e) {
  var keyCode = e.charCode || e.keyCode;
  var yz = keyCode === 89 || keyCode === 90;
  var ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && yz) {
    e.preventDefault();
  }
}

module.exports = InputHistory;

},{"./InputState":14,"crossvent":6}],14:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var isVisibleElement = require('./isVisibleElement');
var fixEOL = require('./fixEOL');
var MarkdownChunks = require('./markdown/MarkdownChunks');
var HtmlChunks = require('./html/HtmlChunks');
var chunks = {
  markdown: MarkdownChunks,
  html: HtmlChunks,
  wysiwyg: HtmlChunks
};

function InputState (surface, mode, initialState) {
  this.mode = mode;
  this.surface = surface;
  this.initialState = initialState || false;
  this.init();
}

InputState.prototype.init = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (!isVisibleElement(el)) {
    return;
  }
  if (!this.initialState && doc.activeElement && doc.activeElement !== el) {
    return;
  }
  self.surface.readSelection(self);
  self.scrollTop = el.scrollTop;
  if (!self.text) {
    self.text = self.surface.read(self.mode);
  }
};

InputState.prototype.select = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (!isVisibleElement(el)) {
    return;
  }
  self.surface.writeSelection(self);
};

InputState.prototype.restore = function () {
  var self = this;
  var el = self.surface.current(self.mode);
  if (typeof self.text === 'string' && self.text !== self.surface.read(self.mode)) {
    self.surface.write(self.mode, self.text);
  }
  self.select();
  el.scrollTop = self.scrollTop;
};

InputState.prototype.getChunks = function () {
  var self = this;
  var chunk = new chunks[self.mode]();
  chunk.before = fixEOL(self.text.substring(0, self.start));
  chunk.startTag = '';
  chunk.selection = fixEOL(self.text.substring(self.start, self.end));
  chunk.endTag = '';
  chunk.after = fixEOL(self.text.substring(self.end));
  chunk.scrollTop = self.scrollTop;
  self.cachedChunks = chunk;
  return chunk;
};

InputState.prototype.setChunks = function (chunk) {
  var self = this;
  chunk.before = chunk.before + chunk.startTag;
  chunk.after = chunk.endTag + chunk.after;
  self.start = chunk.before.length;
  self.end = chunk.before.length + chunk.selection.length;
  self.text = chunk.before + chunk.selection + chunk.after;
  self.scrollTop = chunk.scrollTop;
};

module.exports = InputState;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9JbnB1dFN0YXRlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgaXNWaXNpYmxlRWxlbWVudCA9IHJlcXVpcmUoJy4vaXNWaXNpYmxlRWxlbWVudCcpO1xudmFyIGZpeEVPTCA9IHJlcXVpcmUoJy4vZml4RU9MJyk7XG52YXIgTWFya2Rvd25DaHVua3MgPSByZXF1aXJlKCcuL21hcmtkb3duL01hcmtkb3duQ2h1bmtzJyk7XG52YXIgSHRtbENodW5rcyA9IHJlcXVpcmUoJy4vaHRtbC9IdG1sQ2h1bmtzJyk7XG52YXIgY2h1bmtzID0ge1xuICBtYXJrZG93bjogTWFya2Rvd25DaHVua3MsXG4gIGh0bWw6IEh0bWxDaHVua3MsXG4gIHd5c2l3eWc6IEh0bWxDaHVua3Ncbn07XG5cbmZ1bmN0aW9uIElucHV0U3RhdGUgKHN1cmZhY2UsIG1vZGUsIGluaXRpYWxTdGF0ZSkge1xuICB0aGlzLm1vZGUgPSBtb2RlO1xuICB0aGlzLnN1cmZhY2UgPSBzdXJmYWNlO1xuICB0aGlzLmluaXRpYWxTdGF0ZSA9IGluaXRpYWxTdGF0ZSB8fCBmYWxzZTtcbiAgdGhpcy5pbml0KCk7XG59XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKCFpc1Zpc2libGVFbGVtZW50KGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXRoaXMuaW5pdGlhbFN0YXRlICYmIGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBlbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBzZWxmLnN1cmZhY2UucmVhZFNlbGVjdGlvbihzZWxmKTtcbiAgc2VsZi5zY3JvbGxUb3AgPSBlbC5zY3JvbGxUb3A7XG4gIGlmICghc2VsZi50ZXh0KSB7XG4gICAgc2VsZi50ZXh0ID0gc2VsZi5zdXJmYWNlLnJlYWQoc2VsZi5tb2RlKTtcbiAgfVxufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICghaXNWaXNpYmxlRWxlbWVudChlbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5zdXJmYWNlLndyaXRlU2VsZWN0aW9uKHNlbGYpO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUucmVzdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAodHlwZW9mIHNlbGYudGV4dCA9PT0gJ3N0cmluZycgJiYgc2VsZi50ZXh0ICE9PSBzZWxmLnN1cmZhY2UucmVhZChzZWxmLm1vZGUpKSB7XG4gICAgc2VsZi5zdXJmYWNlLndyaXRlKHNlbGYubW9kZSwgc2VsZi50ZXh0KTtcbiAgfVxuICBzZWxmLnNlbGVjdCgpO1xuICBlbC5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmdldENodW5rcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2h1bmsgPSBuZXcgY2h1bmtzW3NlbGYubW9kZV0oKTtcbiAgY2h1bmsuYmVmb3JlID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoMCwgc2VsZi5zdGFydCkpO1xuICBjaHVuay5zdGFydFRhZyA9ICcnO1xuICBjaHVuay5zZWxlY3Rpb24gPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLnN0YXJ0LCBzZWxmLmVuZCkpO1xuICBjaHVuay5lbmRUYWcgPSAnJztcbiAgY2h1bmsuYWZ0ZXIgPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLmVuZCkpO1xuICBjaHVuay5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbiAgc2VsZi5jYWNoZWRDaHVua3MgPSBjaHVuaztcbiAgcmV0dXJuIGNodW5rO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2V0Q2h1bmtzID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2h1bmsuYmVmb3JlID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc3RhcnRUYWc7XG4gIGNodW5rLmFmdGVyID0gY2h1bmsuZW5kVGFnICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc3RhcnQgPSBjaHVuay5iZWZvcmUubGVuZ3RoO1xuICBzZWxmLmVuZCA9IGNodW5rLmJlZm9yZS5sZW5ndGggKyBjaHVuay5zZWxlY3Rpb24ubGVuZ3RoO1xuICBzZWxmLnRleHQgPSBjaHVuay5iZWZvcmUgKyBjaHVuay5zZWxlY3Rpb24gKyBjaHVuay5hZnRlcjtcbiAgc2VsZi5zY3JvbGxUb3AgPSBjaHVuay5zY3JvbGxUb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0U3RhdGU7XG4iXX0=
},{"./fixEOL":21,"./html/HtmlChunks":25,"./isVisibleElement":34,"./markdown/MarkdownChunks":36}],15:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var commands = {
  markdown: {
    boldOrItalic: require('./markdown/boldOrItalic'),
    linkOrImageOrAttachment: require('./markdown/linkOrImageOrAttachment'),
    blockquote: require('./markdown/blockquote'),
    codeblock: require('./markdown/codeblock'),
    heading: require('./markdown/heading'),
    list: require('./markdown/list'),
    hr: require('./markdown/hr')
  },
  html: {
    boldOrItalic: require('./html/boldOrItalic'),
    linkOrImageOrAttachment: require('./html/linkOrImageOrAttachment'),
    blockquote: require('./html/blockquote'),
    codeblock: require('./html/codeblock'),
    heading: require('./html/heading'),
    list: require('./html/list'),
    hr: require('./html/hr')
  }
};

commands.wysiwyg = commands.html;

function bindCommands (surface, options, editor) {
  bind('bold', 'cmd+b', bold);
  bind('italic', 'cmd+i', italic);
  bind('quote', 'cmd+j', router('blockquote'));
  bind('code', 'cmd+e', code);
  bind('ol', 'cmd+o', ol);
  bind('ul', 'cmd+u', ul);
  bind('heading', 'cmd+d', router('heading'));
  editor.showLinkDialog = fabricator(bind('link', 'cmd+k', linkOrImageOrAttachment('link')));
  editor.showImageDialog = fabricator(bind('image', 'cmd+g', linkOrImageOrAttachment('image')));

  if (options.attachments) {
    editor.showAttachmentDialog = fabricator(bind('attachment', 'cmd+shift+k', linkOrImageOrAttachment('attachment')));
  }
  if (options.hr) { bind('hr', 'cmd+n', router('hr')); }

  function fabricator (el) {
    return function open () {
      crossvent.fabricate(el, 'click');
    };
  }
  function bold (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'bold');
  }
  function italic (mode, chunks) {
    commands[mode].boldOrItalic(chunks, 'italic');
  }
  function code (mode, chunks) {
    commands[mode].codeblock(chunks, { fencing: options.fencing });
  }
  function ul (mode, chunks) {
    commands[mode].list(chunks, false);
  }
  function ol (mode, chunks) {
    commands[mode].list(chunks, true);
  }
  function linkOrImageOrAttachment (type) {
    return function (mode, chunks) {
      commands[mode].linkOrImageOrAttachment.call(this, chunks, {
        editor: editor,
        mode: mode,
        type: type,
        surface: surface,
        prompts: options.prompts,
        xhr: options.xhr,
        upload: options[type + 's'],
        classes: options.classes,
        mergeHtmlAndAttachment: options.mergeHtmlAndAttachment
      });
    };
  }
  function bind (id, combo, fn) {
    return editor.addCommandButton(id, combo, suppress(fn));
  }
  function router (method) {
    return function routed (mode, chunks) { commands[mode][method].call(this, chunks); };
  }
  function stop (e) {
    e.preventDefault(); e.stopPropagation();
  }
  function suppress (fn) {
    return function suppressor (e, mode, chunks) { stop(e); fn.call(this, mode, chunks); };
  }
}

module.exports = bindCommands;

},{"./html/blockquote":26,"./html/boldOrItalic":27,"./html/codeblock":28,"./html/heading":29,"./html/hr":30,"./html/linkOrImageOrAttachment":31,"./html/list":32,"./markdown/blockquote":37,"./markdown/boldOrItalic":38,"./markdown/codeblock":39,"./markdown/heading":40,"./markdown/hr":41,"./markdown/linkOrImageOrAttachment":42,"./markdown/list":43,"crossvent":6}],16:[function(require,module,exports){
'use strict';

function cast (collection) {
  var result = [];
  var i;
  var len = collection.length;
  for (i = 0; i < len; i++) {
    result.push(collection[i]);
  }
  return result;
}

module.exports = cast;

},{}],17:[function(require,module,exports){
'use strict';

var rinput = /^\s*(.*?)(?:\s+"(.+)")?\s*$/;
var rfull = /^(?:https?|ftp):\/\//;

function parseLinkInput (input) {
  return parser.apply(null, input.match(rinput));

  function parser (all, link, title) {
    var href = link.replace(/\?.*$/, queryUnencodedReplacer);
    href = decodeURIComponent(href);
    href = encodeURI(href).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    href = href.replace(/\?.*$/, queryEncodedReplacer);

    return {
      href: formatHref(href), title: formatTitle(title)
    };
  }
}

function queryUnencodedReplacer (query) {
  return query.replace(/\+/g, ' ');
}

function queryEncodedReplacer (query) {
  return query.replace(/\+/g, '%2b');
}

function formatTitle (title) {
  if (!title) {
    return null;
  }

  return title
    .replace(/^\s+|\s+$/g, '')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatHref (url) {
  var href = url.replace(/^\s+|\s+$/g, '');
  if (href.length && href[0] !== '/' && !rfull.test(href)) {
    return 'http://' + href;
  }
  return href;
}

module.exports = parseLinkInput;

},{}],18:[function(require,module,exports){
'use strict';

function trim (remove) {
  var self = this;

  if (remove) {
    beforeReplacer = afterReplacer = '';
  }
  self.selection = self.selection.replace(/^(\s*)/, beforeReplacer).replace(/(\s*)$/, afterReplacer);

  function beforeReplacer (text) {
    self.before += text; return '';
  }
  function afterReplacer (text) {
    self.after = text + self.after; return '';
  }
}

module.exports = trim;

},{}],19:[function(require,module,exports){
'use strict';

var rtrim = /^\s+|\s+$/g;
var rspaces = /\s+/g;

function addClass (el, cls) {
  var current = el.className;
  if (current.indexOf(cls) === -1) {
    el.className = (current + ' ' + cls).replace(rtrim, '');
  }
}

function rmClass (el, cls) {
  el.className = el.className.replace(cls, '').replace(rtrim, '').replace(rspaces, ' ');
}

module.exports = {
  add: addClass,
  rm: rmClass
};

},{}],20:[function(require,module,exports){
'use strict';

function extendRegExp (regex, pre, post) {
  var pattern = regex.toString();
  var flags;

  pattern = pattern.replace(/\/([gim]*)$/, captureFlags);
  pattern = pattern.replace(/(^\/|\/$)/g, '');
  pattern = pre + pattern + post;
  return new RegExp(pattern, flags);

  function captureFlags (all, f) {
    flags = f;
    return '';
  }
}

module.exports = extendRegExp;

},{}],21:[function(require,module,exports){
'use strict';

function fixEOL (text) {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

module.exports = fixEOL;

},{}],22:[function(require,module,exports){
'use strict';

var InputState = require('./InputState');

function getCommandHandler (surface, history, fn) {
  return function handleCommand (e) {
    surface.focus(history.inputMode);
    history.setCommandMode();

    var state = new InputState(surface, history.inputMode);
    var chunks = state.getChunks();
    var asyncHandler = {
      async: async, immediate: true
    };

    fn.call(asyncHandler, e, history.inputMode, chunks);

    if (asyncHandler.immediate) {
      done();
    }

    function async () {
      asyncHandler.immediate = false;
      return done;
    }

    function done () {
      surface.focus(history.inputMode);
      state.setChunks(chunks);
      state.restore();
    }
  };
}

module.exports = getCommandHandler;

},{"./InputState":14}],23:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var fixEOL = require('./fixEOL');
var many = require('./many');
var cast = require('./cast');
var rangeToTextRange = require('./rangeToTextRange');
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
      ancientlyReadSelectionTextarea(state);
    }
  }

  function ancientlyReadSelectionTextarea (state) {
    if (doc.activeElement && doc.activeElement !== textarea) {
      return;
    }

    state.text = fixEOL(textarea.value);

    var range = doc.selection.createRange();
    var fixedRange = fixEOL(range.text);
    var marker = '\x07';
    var markedRange = marker + fixedRange + marker;

    range.text = markedRange;

    var inputText = fixEOL(textarea.value);

    range.moveStart('character', -markedRange.length);
    range.text = fixedRange;
    state.start = inputText.indexOf(marker);
    state.end = inputText.lastIndexOf(marker) - marker.length;

    var diff = state.text.length - fixEOL(textarea.value).length;
    if (diff) {
      range.moveStart('character', -fixedRange.length);
      fixedRange += many('\n', diff);
      state.end += diff;
      range.text = fixedRange;
    }
    state.select();
  }

  function writeSelectionEditable (state) {
    var chunks = state.cachedChunks || state.getChunks();
    var start = chunks.before.length;
    var end = start + chunks.selection.length;
    var p = {};

    walk(editable.firstChild, peek);
    editable.focus();

    if (document.createRange) {
      modernSelection();
    } else {
      oldSelection();
    }

    function modernSelection () {
      var sel = getSelection();
      var range = document.createRange();
      if (!p.startContainer) {
        return;
      }
      if (p.endContainer) {
        range.setEnd(p.endContainer, p.endOffset);
      } else {
        range.setEnd(p.startContainer, p.startOffset);
      }
      range.setStart(p.startContainer, p.startOffset);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    function oldSelection () {
      rangeToTextRange(p).select();
    }

    function peek (context, el) {
      var cursor = context.text.length;
      var content = readNode(el).length;
      var sum = cursor + content;
      if (!p.startContainer && sum >= start) {
        p.startContainer = el;
        p.startOffset = bounded(start - cursor);
      }
      if (!p.endContainer && sum >= end) {
        p.endContainer = el;
        p.endOffset = bounded(end - cursor);
      }

      function bounded (offset) {
        return Math.max(0, Math.min(content, offset));
      }
    }
  }

  function readSelectionEditable (state) {
    var sel = getSelection();
    var distance = walk(editable.firstChild, peek);
    var start = distance.start || 0;
    var end = distance.end || 0;

    state.text = distance.text;

    if (end > start) {
      state.start = start;
      state.end = end;
    } else {
      state.start = end;
      state.end = start;
    }

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

    if (!el) {
      return context;
    }

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

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9nZXRTdXJmYWNlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBmaXhFT0wgPSByZXF1aXJlKCcuL2ZpeEVPTCcpO1xudmFyIG1hbnkgPSByZXF1aXJlKCcuL21hbnknKTtcbnZhciBjYXN0ID0gcmVxdWlyZSgnLi9jYXN0Jyk7XG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vcG9seWZpbGxzL2dldFNlbGVjdGlvbicpO1xudmFyIHJvcGVuID0gL14oPFtePl0rKD86IFtePl0qKT8+KS87XG52YXIgcmNsb3NlID0gLyg8XFwvW14+XSs+KSQvO1xuXG5mdW5jdGlvbiBzdXJmYWNlICh0ZXh0YXJlYSwgZWRpdGFibGUpIHtcbiAgcmV0dXJuIHtcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IGVkaXRhYmxlLFxuICAgIGZvY3VzOiBzZXRGb2N1cyxcbiAgICByZWFkOiByZWFkLFxuICAgIHdyaXRlOiB3cml0ZSxcbiAgICBjdXJyZW50OiBjdXJyZW50LFxuICAgIHdyaXRlU2VsZWN0aW9uOiB3cml0ZVNlbGVjdGlvbixcbiAgICByZWFkU2VsZWN0aW9uOiByZWFkU2VsZWN0aW9uXG4gIH07XG5cbiAgZnVuY3Rpb24gc2V0Rm9jdXMgKG1vZGUpIHtcbiAgICBjdXJyZW50KG1vZGUpLmZvY3VzKCk7XG4gIH1cblxuICBmdW5jdGlvbiBjdXJyZW50IChtb2RlKSB7XG4gICAgcmV0dXJuIG1vZGUgPT09ICd3eXNpd3lnJyA/IGVkaXRhYmxlIDogdGV4dGFyZWE7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChtb2RlKSB7XG4gICAgaWYgKG1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgcmV0dXJuIGVkaXRhYmxlLmlubmVySFRNTDtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRhcmVhLnZhbHVlO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKG1vZGUsIHZhbHVlKSB7XG4gICAgaWYgKG1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgZWRpdGFibGUuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRleHRhcmVhLnZhbHVlID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVTZWxlY3Rpb24gKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgd3JpdGVTZWxlY3Rpb25FZGl0YWJsZShzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyaXRlU2VsZWN0aW9uVGV4dGFyZWEoc3RhdGUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRTZWxlY3Rpb24gKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgcmVhZFNlbGVjdGlvbkVkaXRhYmxlKHN0YXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZFNlbGVjdGlvblRleHRhcmVhKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZVNlbGVjdGlvblRleHRhcmVhIChzdGF0ZSkge1xuICAgIHZhciByYW5nZTtcbiAgICBpZiAodGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgIT09IHZvaWQgMCkge1xuICAgICAgdGV4dGFyZWEuZm9jdXMoKTtcbiAgICAgIHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID0gc3RhdGUuc3RhcnQ7XG4gICAgICB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBzdGF0ZS5lbmQ7XG4gICAgICB0ZXh0YXJlYS5zY3JvbGxUb3AgPSBzdGF0ZS5zY3JvbGxUb3A7XG4gICAgfSBlbHNlIGlmIChkb2Muc2VsZWN0aW9uKSB7XG4gICAgICBpZiAoZG9jLmFjdGl2ZUVsZW1lbnQgJiYgZG9jLmFjdGl2ZUVsZW1lbnQgIT09IHRleHRhcmVhKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRleHRhcmVhLmZvY3VzKCk7XG4gICAgICByYW5nZSA9IHRleHRhcmVhLmNyZWF0ZVRleHRSYW5nZSgpO1xuICAgICAgcmFuZ2UubW92ZVN0YXJ0KCdjaGFyYWN0ZXInLCAtdGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcbiAgICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIC10ZXh0YXJlYS52YWx1ZS5sZW5ndGgpO1xuICAgICAgcmFuZ2UubW92ZUVuZCgnY2hhcmFjdGVyJywgc3RhdGUuZW5kKTtcbiAgICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgc3RhdGUuc3RhcnQpO1xuICAgICAgcmFuZ2Uuc2VsZWN0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFNlbGVjdGlvblRleHRhcmVhIChzdGF0ZSkge1xuICAgIGlmICh0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCAhPT0gdm9pZCAwKSB7XG4gICAgICBzdGF0ZS5zdGFydCA9IHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgICAgc3RhdGUuZW5kID0gdGV4dGFyZWEuc2VsZWN0aW9uRW5kO1xuICAgIH0gZWxzZSBpZiAoZG9jLnNlbGVjdGlvbikge1xuICAgICAgYW5jaWVudGx5UmVhZFNlbGVjdGlvblRleHRhcmVhKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhbmNpZW50bHlSZWFkU2VsZWN0aW9uVGV4dGFyZWEgKHN0YXRlKSB7XG4gICAgaWYgKGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSB0ZXh0YXJlYSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHN0YXRlLnRleHQgPSBmaXhFT0wodGV4dGFyZWEudmFsdWUpO1xuXG4gICAgdmFyIHJhbmdlID0gZG9jLnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICAgIHZhciBmaXhlZFJhbmdlID0gZml4RU9MKHJhbmdlLnRleHQpO1xuICAgIHZhciBtYXJrZXIgPSAnXFx4MDcnO1xuICAgIHZhciBtYXJrZWRSYW5nZSA9IG1hcmtlciArIGZpeGVkUmFuZ2UgKyBtYXJrZXI7XG5cbiAgICByYW5nZS50ZXh0ID0gbWFya2VkUmFuZ2U7XG5cbiAgICB2YXIgaW5wdXRUZXh0ID0gZml4RU9MKHRleHRhcmVhLnZhbHVlKTtcblxuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgLW1hcmtlZFJhbmdlLmxlbmd0aCk7XG4gICAgcmFuZ2UudGV4dCA9IGZpeGVkUmFuZ2U7XG4gICAgc3RhdGUuc3RhcnQgPSBpbnB1dFRleHQuaW5kZXhPZihtYXJrZXIpO1xuICAgIHN0YXRlLmVuZCA9IGlucHV0VGV4dC5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aDtcblxuICAgIHZhciBkaWZmID0gc3RhdGUudGV4dC5sZW5ndGggLSBmaXhFT0wodGV4dGFyZWEudmFsdWUpLmxlbmd0aDtcbiAgICBpZiAoZGlmZikge1xuICAgICAgcmFuZ2UubW92ZVN0YXJ0KCdjaGFyYWN0ZXInLCAtZml4ZWRSYW5nZS5sZW5ndGgpO1xuICAgICAgZml4ZWRSYW5nZSArPSBtYW55KCdcXG4nLCBkaWZmKTtcbiAgICAgIHN0YXRlLmVuZCArPSBkaWZmO1xuICAgICAgcmFuZ2UudGV4dCA9IGZpeGVkUmFuZ2U7XG4gICAgfVxuICAgIHN0YXRlLnNlbGVjdCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVTZWxlY3Rpb25FZGl0YWJsZSAoc3RhdGUpIHtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuY2FjaGVkQ2h1bmtzIHx8IHN0YXRlLmdldENodW5rcygpO1xuICAgIHZhciBzdGFydCA9IGNodW5rcy5iZWZvcmUubGVuZ3RoO1xuICAgIHZhciBlbmQgPSBzdGFydCArIGNodW5rcy5zZWxlY3Rpb24ubGVuZ3RoO1xuICAgIHZhciBwID0ge307XG5cbiAgICB3YWxrKGVkaXRhYmxlLmZpcnN0Q2hpbGQsIHBlZWspO1xuICAgIGVkaXRhYmxlLmZvY3VzKCk7XG5cbiAgICBpZiAoZG9jdW1lbnQuY3JlYXRlUmFuZ2UpIHtcbiAgICAgIG1vZGVyblNlbGVjdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvbGRTZWxlY3Rpb24oKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtb2Rlcm5TZWxlY3Rpb24gKCkge1xuICAgICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgICAgdmFyIHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcbiAgICAgIGlmICghcC5zdGFydENvbnRhaW5lcikge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAocC5lbmRDb250YWluZXIpIHtcbiAgICAgICAgcmFuZ2Uuc2V0RW5kKHAuZW5kQ29udGFpbmVyLCBwLmVuZE9mZnNldCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByYW5nZS5zZXRFbmQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgICB9XG4gICAgICByYW5nZS5zZXRTdGFydChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICAgIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICAgIHNlbC5hZGRSYW5nZShyYW5nZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb2xkU2VsZWN0aW9uICgpIHtcbiAgICAgIHJhbmdlVG9UZXh0UmFuZ2UocCkuc2VsZWN0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVlayAoY29udGV4dCwgZWwpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBjb250ZXh0LnRleHQubGVuZ3RoO1xuICAgICAgdmFyIGNvbnRlbnQgPSByZWFkTm9kZShlbCkubGVuZ3RoO1xuICAgICAgdmFyIHN1bSA9IGN1cnNvciArIGNvbnRlbnQ7XG4gICAgICBpZiAoIXAuc3RhcnRDb250YWluZXIgJiYgc3VtID49IHN0YXJ0KSB7XG4gICAgICAgIHAuc3RhcnRDb250YWluZXIgPSBlbDtcbiAgICAgICAgcC5zdGFydE9mZnNldCA9IGJvdW5kZWQoc3RhcnQgLSBjdXJzb3IpO1xuICAgICAgfVxuICAgICAgaWYgKCFwLmVuZENvbnRhaW5lciAmJiBzdW0gPj0gZW5kKSB7XG4gICAgICAgIHAuZW5kQ29udGFpbmVyID0gZWw7XG4gICAgICAgIHAuZW5kT2Zmc2V0ID0gYm91bmRlZChlbmQgLSBjdXJzb3IpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBib3VuZGVkIChvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgubWluKGNvbnRlbnQsIG9mZnNldCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRTZWxlY3Rpb25FZGl0YWJsZSAoc3RhdGUpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgdmFyIGRpc3RhbmNlID0gd2FsayhlZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgICB2YXIgc3RhcnQgPSBkaXN0YW5jZS5zdGFydCB8fCAwO1xuICAgIHZhciBlbmQgPSBkaXN0YW5jZS5lbmQgfHwgMDtcblxuICAgIHN0YXRlLnRleHQgPSBkaXN0YW5jZS50ZXh0O1xuXG4gICAgaWYgKGVuZCA+IHN0YXJ0KSB7XG4gICAgICBzdGF0ZS5zdGFydCA9IHN0YXJ0O1xuICAgICAgc3RhdGUuZW5kID0gZW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5zdGFydCA9IGVuZDtcbiAgICAgIHN0YXRlLmVuZCA9IHN0YXJ0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgICBpZiAoZWwgPT09IHNlbC5hbmNob3JOb2RlKSB7XG4gICAgICAgIGNvbnRleHQuc3RhcnQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgc2VsLmFuY2hvck9mZnNldDtcbiAgICAgIH1cbiAgICAgIGlmIChlbCA9PT0gc2VsLmZvY3VzTm9kZSkge1xuICAgICAgICBjb250ZXh0LmVuZCA9IGNvbnRleHQudGV4dC5sZW5ndGggKyBzZWwuZm9jdXNPZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd2FsayAoZWwsIHBlZWssIGN0eCwgc2libGluZ3MpIHtcbiAgICB2YXIgY29udGV4dCA9IGN0eCB8fCB7IHRleHQ6ICcnIH07XG5cbiAgICBpZiAoIWVsKSB7XG4gICAgICByZXR1cm4gY29udGV4dDtcbiAgICB9XG5cbiAgICB2YXIgZWxOb2RlID0gZWwubm9kZVR5cGUgPT09IDE7XG4gICAgdmFyIHRleHROb2RlID0gZWwubm9kZVR5cGUgPT09IDM7XG5cbiAgICBwZWVrKGNvbnRleHQsIGVsKTtcblxuICAgIGlmICh0ZXh0Tm9kZSkge1xuICAgICAgY29udGV4dC50ZXh0ICs9IHJlYWROb2RlKGVsKTtcbiAgICB9XG4gICAgaWYgKGVsTm9kZSkge1xuICAgICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyb3BlbikpIHsgY29udGV4dC50ZXh0ICs9IFJlZ0V4cC4kMTsgfVxuICAgICAgY2FzdChlbC5jaGlsZE5vZGVzKS5mb3JFYWNoKHdhbGtDaGlsZHJlbik7XG4gICAgICBpZiAoZWwub3V0ZXJIVE1MLm1hdGNoKHJjbG9zZSkpIHsgY29udGV4dC50ZXh0ICs9IFJlZ0V4cC4kMTsgfVxuICAgIH1cbiAgICBpZiAoc2libGluZ3MgIT09IGZhbHNlICYmIGVsLm5leHRTaWJsaW5nKSB7XG4gICAgICByZXR1cm4gd2FsayhlbC5uZXh0U2libGluZywgcGVlaywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBjb250ZXh0O1xuXG4gICAgZnVuY3Rpb24gd2Fsa0NoaWxkcmVuIChjaGlsZCkge1xuICAgICAgd2FsayhjaGlsZCwgcGVlaywgY29udGV4dCwgZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWROb2RlIChlbCkge1xuICAgIHJldHVybiBlbC5ub2RlVHlwZSA9PT0gMyA/IGZpeEVPTChlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJycpIDogJyc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdXJmYWNlO1xuIl19
},{"./cast":16,"./fixEOL":21,"./many":35,"./polyfills/getSelection":47,"./rangeToTextRange":55}],24:[function(require,module,exports){
'use strict';

function getText (el) {
  return el.innerText || el.textContent;
}

module.exports = getText;

},{}],25:[function(require,module,exports){
'use strict';

var trimChunks = require('../chunks/trim');

function HtmlChunks () {
}

HtmlChunks.prototype.trim = trimChunks;

HtmlChunks.prototype.findTags = function () {
};

HtmlChunks.prototype.skip = function () {
};

module.exports = HtmlChunks;

},{"../chunks/trim":18}],26:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function blockquote (chunks) {
  wrapping('blockquote', strings.placeholders.quote, chunks);
}

module.exports = blockquote;

},{"../strings":59,"./wrapping":33}],27:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function boldOrItalic (chunks, type) {
  wrapping(type === 'bold' ? 'strong' : 'em', strings.placeholders[type], chunks);
}

module.exports = boldOrItalic;

},{"../strings":59,"./wrapping":33}],28:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');

function codeblock (chunks) {
  wrapping('pre><code', strings.placeholders.code, chunks);
}

module.exports = codeblock;

},{"../strings":59,"./wrapping":33}],29:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rleading = /<h([1-6])( [^>]*)?>$/;
var rtrailing = /^<\/h([1-6])>/;

function heading (chunks) {
  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail && lead[1] === trail[1]) {
    swap();
  } else {
    add();
  }

  function swap () {
    var level = parseInt(lead[1], 10);
    var next = level <= 1 ? 4 : level - 1;
    chunks.before = chunks.before.replace(rleading, '<h' + next + '>');
    chunks.after = chunks.after.replace(rtrailing, '</h' + next + '>');
  }

  function add () {
    if (!chunks.selection) {
      chunks.selection = strings.placeholders.heading;
    }
    chunks.before += '<h1>';
    chunks.after = '</h1>' + chunks.after;
  }
}

module.exports = heading;

},{"../strings":59}],30:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.before += '\n<hr>\n';
  chunks.selection = '';
}

module.exports = hr;

},{}],31:[function(require,module,exports){
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

},{"../chunks/parseLinkInput":17,"../once":46,"../strings":59,"crossvent":6}],32:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rleftsingle = /<(ul|ol)( [^>]*)?>\s*<li( [^>]*)?>$/;
var rrightsingle = /^<\/li>\s*<\/(ul|ol)>/;
var rleftitem = /<li( [^>]*)?>$/;
var rrightitem = /^<\/li( [^>]*)?>/;
var ropen = /^<(ul|ol)( [^>]*)?>$/;

function list (chunks, ordered) {
  var tag = ordered ? 'ol' : 'ul';
  var olist = '<' + tag + '>';
  var clist = '</' + tag + '>';

  chunks.trim();

  if (rleftsingle.test(chunks.before) && rrightsingle.test(chunks.after)) {
    if (tag === RegExp.$1) {
      chunks.before = chunks.before.replace(rleftsingle, '');
      chunks.after = chunks.after.replace(rrightsingle, '');
      return;
    }
  }

  var ulStart = chunks.before.lastIndexOf('<ul');
  var olStart = chunks.before.lastIndexOf('<ol');
  var closeTag = chunks.after.indexOf('</ul>');
  if (closeTag === -1) {
    closeTag = chunks.after.indexOf('</ol>');
  }
  if (closeTag === -1) {
    add(); return;
  }
  var openStart = ulStart > olStart ? ulStart : olStart;
  if (openStart === -1) {
    add(); return;
  }
  var openEnd = chunks.before.indexOf('>', openStart);
  if (openEnd === -1) {
    add(); return;
  }

  var openTag = chunks.before.substr(openStart, openEnd - openStart + 1);
  if (ropen.test(openTag)) {
    if (tag !== RegExp.$1) {
      chunks.before = chunks.before.substr(0, openStart) + '<' + tag + chunks.before.substr(openStart + 3);
      chunks.after = chunks.after.substr(0, closeTag) + '</' + tag + chunks.after.substr(closeTag + 4);
    } else {
      if (rleftitem.test(chunks.before) && rrightitem.test(chunks.after)) {
        chunks.before = chunks.before.replace(rleftitem, '');
        chunks.after = chunks.after.replace(rrightitem, '');
      } else {
        add(true);
      }
    }
  }

  function add (list) {
    var open = list ? '' : olist;
    var close = list ? '' : clist;

    chunks.before += open + '<li>';
    chunks.after = '</li>' + close + chunks.after;

    if (!chunks.selection) {
      chunks.selection = strings.placeholders.listitem;
    }
  }
}

module.exports = list;

},{"../strings":59}],33:[function(require,module,exports){
'use strict';

function wrapping (tag, placeholder, chunks) {
  var open = '<' + tag;
  var close = '</' + tag.replace(/</g, '</');
  var rleading = new RegExp(open + '( [^>]*)?>$', 'i');
  var rtrailing = new RegExp('^' + close + '>', 'i');
  var ropen = new RegExp(open + '( [^>]*)?>', 'ig');
  var rclose = new RegExp(close + '( [^>]*)?>', 'ig');

  chunks.trim();

  var trail = rtrailing.exec(chunks.after);
  var lead = rleading.exec(chunks.before);
  if (lead && trail) {
    chunks.before = chunks.before.replace(rleading, '');
    chunks.after = chunks.after.replace(rtrailing, '');
  } else {
    if (!chunks.selection) {
      chunks.selection = placeholder;
    }
    var opened = ropen.test(chunks.selection);
    if (opened) {
      chunks.selection = chunks.selection.replace(ropen, '');
      if (!surrounded(chunks, tag)) {
        chunks.before += open + '>';
      }
    }
    var closed = rclose.test(chunks.selection);
    if (closed) {
      chunks.selection = chunks.selection.replace(rclose, '');
      if (!surrounded(chunks, tag)) {
        chunks.after = close + '>' + chunks.after;
      }
    }
    if (opened || closed) {
      pushover(); return;
    }
    if (surrounded(chunks, tag)) {
      if (rleading.test(chunks.before)) {
        chunks.before = chunks.before.replace(rleading, '');
      } else {
        chunks.before += close + '>';
      }
      if (rtrailing.test(chunks.after)) {
        chunks.after = chunks.after.replace(rtrailing, '');
      } else {
        chunks.after = open + '>' + chunks.after;
      }
    } else if (!closebounded(chunks, tag)) {
      chunks.after = close + '>' + chunks.after;
      chunks.before += open + '>';
    }
    pushover();
  }

  function pushover () {
    chunks.selection.replace(/<(\/)?([^> ]+)( [^>]*)?>/ig, pushoverOtherTags);
  }

  function pushoverOtherTags (all, closing, tag, a, i) {
    var attrs = a || '';
    var open = !closing;
    var rclosed = new RegExp('<\/' + tag.replace(/</g, '</') + '>', 'i');
    var ropened = new RegExp('<' + tag + '( [^>]*)?>', 'i');
    if (open && !rclosed.test(chunks.selection.substr(i))) {
      chunks.selection += '</' + tag + '>';
      chunks.after = chunks.after.replace(/^(<\/[^>]+>)/, '$1<' + tag + attrs + '>');
    }

    if (closing && !ropened.test(chunks.selection.substr(0, i))) {
      chunks.selection = '<' + tag + attrs + '>' + chunks.selection;
      chunks.before = chunks.before.replace(/(<[^>]+(?: [^>]*)?>)$/, '</' + tag + '>$1');
    }
  }
}

function closebounded (chunks, tag) {
  var rcloseleft = new RegExp('</' + tag.replace(/</g, '</') + '>$', 'i');
  var ropenright = new RegExp('^<' + tag + '(?: [^>]*)?>', 'i');
  var bounded = rcloseleft.test(chunks.before) && ropenright.test(chunks.after);
  if (bounded) {
    chunks.before = chunks.before.replace(rcloseleft, '');
    chunks.after = chunks.after.replace(ropenright, '');
  }
  return bounded;
}

function surrounded (chunks, tag) {
  var ropen = new RegExp('<' + tag + '(?: [^>]*)?>', 'ig');
  var rclose = new RegExp('<\/' + tag.replace(/</g, '</') + '>', 'ig');
  var opensBefore = count(chunks.before, ropen);
  var opensAfter = count(chunks.after, ropen);
  var closesBefore = count(chunks.before, rclose);
  var closesAfter = count(chunks.after, rclose);
  var open = opensBefore - closesBefore > 0;
  var close = closesAfter - opensAfter > 0;
  return open && close;

  function count (text, regex) {
    var match = text.match(regex);
    if (match) {
      return match.length;
    }
    return 0;
  }
}

module.exports = wrapping;

},{}],34:[function(require,module,exports){
(function (global){
'use strict';

function isVisibleElement (elem) {
  if (global.getComputedStyle) {
    return global.getComputedStyle(elem, null).getPropertyValue('display') !== 'none';
  } else if (elem.currentStyle) {
    return elem.currentStyle.display !== 'none';
  }
}

module.exports = isVisibleElement;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9pc1Zpc2libGVFbGVtZW50LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaXNWaXNpYmxlRWxlbWVudCAoZWxlbSkge1xuICBpZiAoZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUpIHtcbiAgICByZXR1cm4gZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUoZWxlbSwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZSgnZGlzcGxheScpICE9PSAnbm9uZSc7XG4gIH0gZWxzZSBpZiAoZWxlbS5jdXJyZW50U3R5bGUpIHtcbiAgICByZXR1cm4gZWxlbS5jdXJyZW50U3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXNpYmxlRWxlbWVudDtcbiJdfQ==
},{}],35:[function(require,module,exports){
'use strict';

function many (text, times) {
  return new Array(times + 1).join(text);
}

module.exports = many;

},{}],36:[function(require,module,exports){
'use strict';

var many = require('../many');
var extendRegExp = require('../extendRegExp');
var trimChunks = require('../chunks/trim');
var re = RegExp;

function MarkdownChunks () {
}

MarkdownChunks.prototype.trim = trimChunks;

MarkdownChunks.prototype.findTags = function (startRegex, endRegex) {
  var self = this;
  var regex;

  if (startRegex) {
    regex = extendRegExp(startRegex, '', '$');
    this.before = this.before.replace(regex, startReplacer);
    regex = extendRegExp(startRegex, '^', '');
    this.selection = this.selection.replace(regex, startReplacer);
  }

  if (endRegex) {
    regex = extendRegExp(endRegex, '', '$');
    this.selection = this.selection.replace(regex, endReplacer);
    regex = extendRegExp(endRegex, '^', '');
    this.after = this.after.replace(regex, endReplacer);
  }

  function startReplacer (match) {
    self.startTag = self.startTag + match; return '';
  }

  function endReplacer (match) {
    self.endTag = match + self.endTag; return '';
  }
};

MarkdownChunks.prototype.skip = function (options) {
  var o = options || {};
  var beforeCount = 'before' in o ? o.before : 1;
  var afterCount = 'after' in o ? o.after : 1;

  this.selection = this.selection.replace(/(^\n*)/, '');
  this.startTag = this.startTag + re.$1;
  this.selection = this.selection.replace(/(\n*$)/, '');
  this.endTag = this.endTag + re.$1;
  this.startTag = this.startTag.replace(/(^\n*)/, '');
  this.before = this.before + re.$1;
  this.endTag = this.endTag.replace(/(\n*$)/, '');
  this.after = this.after + re.$1;

  if (this.before) {
    this.before = replace(this.before, ++beforeCount, '$');
  }

  if (this.after) {
    this.after = replace(this.after, ++afterCount, '');
  }

  function replace (text, count, suffix) {
    var regex = o.any ? '\\n*' : many('\\n?', count);
    var replacement = many('\n', count);
    return text.replace(new re(regex + suffix), replacement);
  }
};

module.exports = MarkdownChunks;

},{"../chunks/trim":18,"../extendRegExp":20,"../many":35}],37:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var wrapping = require('./wrapping');
var settings = require('./settings');
var rtrailblankline = /(>[ \t]*)$/;
var rleadblankline = /^(>[ \t]*)/;
var rnewlinefencing = /^(\n*)([^\r]+?)(\n*)$/;
var rendtag = /^(((\n|^)(\n[ \t]*)*>(.+\n)*.*)+(\n[ \t]*)*)/;
var rleadbracket = /^\n((>|\s)*)\n/;
var rtrailbracket = /\n((>|\s)*)\n$/;

function blockquote (chunks) {
  var match = '';
  var leftOver = '';
  var line;

  chunks.selection = chunks.selection.replace(rnewlinefencing, newlinereplacer);
  chunks.before = chunks.before.replace(rtrailblankline, trailblanklinereplacer);
  chunks.selection = chunks.selection.replace(/^(\s|>)+$/, '');
  chunks.selection = chunks.selection || strings.placeholders.quote;

  if (chunks.before) {
    beforeProcessing();
  }

  chunks.startTag = match;
  chunks.before = leftOver;

  if (chunks.after) {
    chunks.after = chunks.after.replace(/^\n?/, '\n');
  }

  chunks.after = chunks.after.replace(rendtag, endtagreplacer);

  if (/^(?![ ]{0,3}>)/m.test(chunks.selection)) {
    wrapping.wrap(chunks, settings.lineLength - 2);
    chunks.selection = chunks.selection.replace(/^/gm, '> ');
    replaceBlanksInTags(true);
    chunks.skip();
  } else {
    chunks.selection = chunks.selection.replace(/^[ ]{0,3}> ?/gm, '');
    wrapping.unwrap(chunks);
    replaceBlanksInTags(false);

    if (!/^(\n|^)[ ]{0,3}>/.test(chunks.selection) && chunks.startTag) {
      chunks.startTag = chunks.startTag.replace(/\n{0,2}$/, '\n\n');
    }

    if (!/(\n|^)[ ]{0,3}>.*$/.test(chunks.selection) && chunks.endTag) {
      chunks.endTag = chunks.endTag.replace(/^\n{0,2}/, '\n\n');
    }
  }

  if (!/\n/.test(chunks.selection)) {
    chunks.selection = chunks.selection.replace(rleadblankline, leadblanklinereplacer);
  }

  function newlinereplacer (all, before, text, after) {
    chunks.before += before;
    chunks.after = after + chunks.after;
    return text;
  }

  function trailblanklinereplacer (all, blank) {
    chunks.selection = blank + chunks.selection; return '';
  }

  function leadblanklinereplacer (all, blanks) {
    chunks.startTag += blanks; return '';
  }

  function beforeProcessing () {
    var lines = chunks.before.replace(/\n$/, '').split('\n');
    var chained = false;
    var good;

    for (var i = 0; i < lines.length; i++) {
      good = false;
      line = lines[i];
      chained = chained && line.length > 0;
      if (/^>/.test(line)) {
        good = true;
        if (!chained && line.length > 1) {
          chained = true;
        }
      } else if (/^[ \t]*$/.test(line)) {
        good = true;
      } else {
        good = chained;
      }
      if (good) {
        match += line + '\n';
      } else {
        leftOver += match + line;
        match = '\n';
      }
    }

    if (!/(^|\n)>/.test(match)) {
      leftOver += match;
      match = '';
    }
  }

  function endtagreplacer (all) {
    chunks.endTag = all; return '';
  }

  function replaceBlanksInTags (bracket) {
    var replacement = bracket ? '> ' : '';

    if (chunks.startTag) {
      chunks.startTag = chunks.startTag.replace(rtrailbracket, replacer);
    }
    if (chunks.endTag) {
      chunks.endTag = chunks.endTag.replace(rleadbracket, replacer);
    }

    function replacer (all, markdown) {
      return '\n' + markdown.replace(/^[ ]{0,3}>?[ \t]*$/gm, replacement) + '\n';
    }
  }
}

module.exports = blockquote;

},{"../strings":59,"./settings":44,"./wrapping":45}],38:[function(require,module,exports){
'use strict';

var rleading = /^(\**)/;
var rtrailing = /(\**$)/;
var rtrailingspace = /(\s?)$/;
var strings = require('../strings');

function boldOrItalic (chunks, type) {
  var rnewlines = /\n{2,}/g;
  var starCount = type === 'bold' ? 2 : 1;

  chunks.trim();
  chunks.selection = chunks.selection.replace(rnewlines, '\n');

  var markup;
  var leadStars = rtrailing.exec(chunks.before)[0];
  var trailStars = rleading.exec(chunks.after)[0];
  var stars = '\\*{' + starCount + '}';
  var fence = Math.min(leadStars.length, trailStars.length);
  if (fence >= starCount && (fence !== 2 || starCount !== 1)) {
    chunks.before = chunks.before.replace(new RegExp(stars + '$', ''), '');
    chunks.after = chunks.after.replace(new RegExp('^' + stars, ''), '');
  } else if (!chunks.selection && trailStars) {
    chunks.after = chunks.after.replace(rleading, '');
    chunks.before = chunks.before.replace(rtrailingspace, '') + trailStars + RegExp.$1;
  } else {
    if (!chunks.selection && !trailStars) {
      chunks.selection = strings.placeholders[type];
    }

    markup = starCount === 1 ? '*' : '**';
    chunks.before = chunks.before + markup;
    chunks.after = markup + chunks.after;
  }
}

module.exports = boldOrItalic;

},{"../strings":59}],39:[function(require,module,exports){
'use strict';

var strings = require('../strings');
var rtextbefore = /\S[ ]*$/;
var rtextafter = /^[ ]*\S/;
var rnewline = /\n/;
var rbacktick = /`/;
var rfencebefore = /```[a-z]*\n?$/;
var rfencebeforeinside = /^```[a-z]*\n/;
var rfenceafter = /^\n?```/;
var rfenceafterinside = /\n```$/;

function codeblock (chunks, options) {
  var newlined = rnewline.test(chunks.selection);
  var trailing = rtextafter.test(chunks.after);
  var leading = rtextbefore.test(chunks.before);
  var outfenced = rfencebefore.test(chunks.before) && rfenceafter.test(chunks.after);
  if (outfenced || newlined || !(leading || trailing)) {
    block(outfenced);
  } else {
    inline();
  }

  function inline () {
    chunks.trim();
    chunks.findTags(rbacktick, rbacktick);

    if (!chunks.startTag && !chunks.endTag) {
      chunks.startTag = chunks.endTag = '`';
      if (!chunks.selection) {
        chunks.selection = strings.placeholders.code;
      }
    } else if (chunks.endTag && !chunks.startTag) {
      chunks.before += chunks.endTag;
      chunks.endTag = '';
    } else {
      chunks.startTag = chunks.endTag = '';
    }
  }

  function block (outfenced) {
    if (outfenced) {
      chunks.before = chunks.before.replace(rfencebefore, '');
      chunks.after = chunks.after.replace(rfenceafter, '');
      return;
    }

    chunks.before = chunks.before.replace(/[ ]{4}|```[a-z]*\n$/, mergeSelection);
    chunks.skip({
      before: /(\n|^)(\t|[ ]{4,}|```[a-z]*\n).*\n$/.test(chunks.before) ? 0 : 1,
      after: /^\n(\t|[ ]{4,}|\n```)/.test(chunks.after) ? 0 : 1
    });

    if (!chunks.selection) {
      if (options.fencing) {
        chunks.startTag = '```\n';
        chunks.endTag = '\n```';
      } else {
        chunks.startTag = '    ';
      }
      chunks.selection = strings.placeholders.code;
    } else {
      if (rfencebeforeinside.test(chunks.selection) && rfenceafterinside.test(chunks.selection)) {
        chunks.selection = chunks.selection.replace(/(^```[a-z]*\n)|(```$)/g, '');
      } else if (/^[ ]{0,3}\S/m.test(chunks.selection)) {
        if (options.fencing) {
          chunks.before += '```\n';
          chunks.after = '\n```' + chunks.after;
        } else if (newlined) {
          chunks.selection = chunks.selection.replace(/^/gm, '    ');
        } else {
          chunks.before += '    ';
        }
      } else {
        chunks.selection = chunks.selection.replace(/^(?:[ ]{4}|[ ]{0,3}\t|```[a-z]*)/gm, '');
      }
    }

    function mergeSelection (all) {
      chunks.selection = all + chunks.selection; return '';
    }
  }
}

module.exports = codeblock;

},{"../strings":59}],40:[function(require,module,exports){
'use strict';

var many = require('../many');
var strings = require('../strings');

function heading (chunks) {
  var level = 0;

  chunks.selection = chunks.selection
    .replace(/\s+/g, ' ')
    .replace(/(^\s+|\s+$)/g, '');

  if (!chunks.selection) {
    chunks.startTag = '# ';
    chunks.selection = strings.placeholders.heading;
    chunks.endTag = '';
    chunks.skip({ before: 1, after: 1 });
    return;
  }

  chunks.findTags(/#+[ ]*/, /[ ]*#+/);

  if (/#+/.test(chunks.startTag)) {
    level = RegExp.lastMatch.length;
  }

  chunks.startTag = chunks.endTag = '';
  chunks.findTags(null, /\s?(-+|=+)/);

  if (/=+/.test(chunks.endTag)) {
    level = 1;
  }

  if (/-+/.test(chunks.endTag)) {
    level = 2;
  }

  chunks.startTag = chunks.endTag = '';
  chunks.skip({ before: 1, after: 1 });

  var levelToCreate = level < 2 ? 4 : level - 1;
  if (levelToCreate > 0) {
    chunks.startTag = many('#', levelToCreate) + ' ';
  }
}

module.exports = heading;

},{"../many":35,"../strings":59}],41:[function(require,module,exports){
'use strict';

function hr (chunks) {
  chunks.startTag = '----------\n';
  chunks.selection = '';
  chunks.skip({ left: 2, right: 1, any: true });
}

module.exports = hr;

},{}],42:[function(require,module,exports){
'use strict';

var once = require('../once');
var strings = require('../strings');
var parseLinkInput = require('../chunks/parseLinkInput');
var rdefinitions = /^[ ]{0,3}\[((?:attachment-)?\d+)\]:[ \t]*\n?[ \t]*<?(\S+?)>?[ \t]*\n?[ \t]*(?:(\n*)["(](.+?)[")][ \t]*)?(?:\n+|$)/gm;
var rattachment = /^attachment-(\d+)$/i;

function extractDefinitions (text, definitions) {
  rdefinitions.lastIndex = 0;
  return text.replace(rdefinitions, replacer);

  function replacer (all, id, link, newlines, title) {
    definitions[id] = all.replace(/\s*$/, '');
    if (newlines) {
      definitions[id] = all.replace(/["(](.+?)[")]$/, '');
      return newlines + title;
    }
    return '';
  }
}

function pushDefinition (chunks, definition, attachment) {
  var regex = /(\[)((?:\[[^\]]*\]|[^\[\]])*)(\][ ]?(?:\n[ ]*)?\[)((?:attachment-)?\d+)(\])/g;
  var anchor = 0;
  var definitions = {};
  var footnotes = [];

  chunks.before = extractDefinitions(chunks.before, definitions);
  chunks.selection = extractDefinitions(chunks.selection, definitions);
  chunks.after = extractDefinitions(chunks.after, definitions);
  chunks.before = chunks.before.replace(regex, getLink);

  if (definition) {
    if (!attachment) { pushAnchor(definition); }
  } else {
    chunks.selection = chunks.selection.replace(regex, getLink);
  }

  var result = anchor;

  chunks.after = chunks.after.replace(regex, getLink);

  if (chunks.after) {
    chunks.after = chunks.after.replace(/\n*$/, '');
  }
  if (!chunks.after) {
    chunks.selection = chunks.selection.replace(/\n*$/, '');
  }

  anchor = 0;
  Object.keys(definitions).forEach(pushAttachments);

  if (attachment) {
    pushAnchor(definition);
  }
  chunks.after += '\n\n' + footnotes.join('\n');

  return result;

  function pushAttachments (definition) {
    if (rattachment.test(definition)) {
      pushAnchor(definitions[definition]);
    }
  }

  function pushAnchor (definition) {
    anchor++;
    definition = definition.replace(/^[ ]{0,3}\[(attachment-)?(\d+)\]:/, '  [$1' + anchor + ']:');
    footnotes.push(definition);
  }

  function getLink (all, before, inner, afterInner, definition, end) {
    inner = inner.replace(regex, getLink);
    if (definitions[definition]) {
      pushAnchor(definitions[definition]);
      return before + inner + afterInner + anchor + end;
    }
    return all;
  }
}

function linkOrImageOrAttachment (chunks, options) {
  var type = options.type;
  var image = type === 'image';
  var resume;

  chunks.trim();
  chunks.findTags(/\s*!?\[/, /\][ ]?(?:\n[ ]*)?(\[.*?\])?/);

  if (chunks.endTag.length > 1 && chunks.startTag.length > 0) {
    chunks.startTag = chunks.startTag.replace(/!?\[/, '');
    chunks.endTag = '';
    pushDefinition(chunks);
    return;
  }

  chunks.selection = chunks.startTag + chunks.selection + chunks.endTag;
  chunks.startTag = chunks.endTag = '';

  if (/\n\n/.test(chunks.selection)) {
    pushDefinition(chunks);
    return;
  }
  resume = this.async();

  options.prompts.close();
  (options.prompts[type] || options.prompts.link)(options, once(resolved));

  function resolved (result) {
    var link = parseLinkInput(result.definition);
    if (link.href.length === 0) {
      resume(); return;
    }

    chunks.selection = (' ' + chunks.selection).replace(/([^\\](?:\\\\)*)(?=[[\]])/g, '$1\\').substr(1);

    var key = result.attachment ? '  [attachment-9999]: ' : ' [9999]: ';
    var definition = key + link.href + (link.title ? ' "' + link.title + '"' : '');
    var anchor = pushDefinition(chunks, definition, result.attachment);

    if (!result.attachment) {
      add();
    }

    resume();

    function add () {
      chunks.startTag = image ? '![' : '[';
      chunks.endTag = '][' + anchor + ']';

      if (!chunks.selection) {
        chunks.selection = strings.placeholders[type];
      }
    }
  }
}

module.exports = linkOrImageOrAttachment;

},{"../chunks/parseLinkInput":17,"../once":46,"../strings":59}],43:[function(require,module,exports){
'use strict';

var many = require('../many');
var strings = require('../strings');
var wrapping = require('./wrapping');
var settings = require('./settings');
var rprevious = /(\n|^)(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*$/;
var rnext = /^\n*(([ ]{0,3}([*+-]|\d+[.])[ \t]+.*)(\n.+|\n{2,}([*+-].*|\d+[.])[ \t]+.*|\n{2,}[ \t]+\S.*)*)\n*/;
var rbullettype = /^\s*([*+-])/;
var rskipper = /[^\n]\n\n[^\n]/;

function pad (text) {
  return ' ' + text + ' ';
}

function list (chunks, ordered) {
  var bullet = '-';
  var num = 1;
  var digital;
  var beforeSkip = 1;
  var afterSkip = 1;

  chunks.findTags(/(\n|^)*[ ]{0,3}([*+-]|\d+[.])\s+/, null);

  if (chunks.before && !/\n$/.test(chunks.before) && !/^\n/.test(chunks.startTag)) {
    chunks.before += chunks.startTag;
    chunks.startTag = '';
  }

  if (chunks.startTag) {
    digital = /\d+[.]/.test(chunks.startTag);
    chunks.startTag = '';
    chunks.selection = chunks.selection.replace(/\n[ ]{4}/g, '\n');
    wrapping.unwrap(chunks);
    chunks.skip();

    if (digital) {
      chunks.after = chunks.after.replace(rnext, getPrefixedItem);
    }
    if (ordered === digital) {
      return;
    }
  }

  chunks.before = chunks.before.replace(rprevious, beforeReplacer);

  if (!chunks.selection) {
    chunks.selection = strings.placeholders.listitem;
  }

  var prefix = nextBullet();
  var spaces = many(' ', prefix.length);

  chunks.after = chunks.after.replace(rnext, afterReplacer);
  chunks.trim(true);
  chunks.skip({ before: beforeSkip, after: afterSkip, any: true });
  chunks.startTag = prefix;
  wrapping.wrap(chunks, settings.lineLength - prefix.length);
  chunks.selection = chunks.selection.replace(/\n/g, '\n' + spaces);

  function beforeReplacer (text) {
    if (rbullettype.test(text)) {
      bullet = RegExp.$1;
    }
    beforeSkip = rskipper.test(text) ? 1 : 0;
    return getPrefixedItem(text);
  }

  function afterReplacer (text) {
    afterSkip = rskipper.test(text) ? 1 : 0;
    return getPrefixedItem(text);
  }

  function nextBullet () {
    if (ordered) {
      return pad((num++) + '.');
    }
    return pad(bullet);
  }

  function getPrefixedItem (text) {
    var rmarkers = /^[ ]{0,3}([*+-]|\d+[.])\s/gm;
    return text.replace(rmarkers, nextBullet);
  }
}

module.exports = list;

},{"../many":35,"../strings":59,"./settings":44,"./wrapping":45}],44:[function(require,module,exports){
'use strict';

module.exports = {
  lineLength: 72
};

},{}],45:[function(require,module,exports){
'use strict';

var prefixes = '(?:\\s{4,}|\\s*>|\\s*-\\s+|\\s*\\d+\\.|=|\\+|-|_|\\*|#|\\s*\\[[^\n]]+\\]:)';
var rleadingprefixes = new RegExp('^' + prefixes, '');
var rtext = new RegExp('([^\\n])\\n(?!(\\n|' + prefixes + '))', 'g');
var rtrailingspaces = /\s+$/;

function wrap (chunks, len) {
  var regex = new RegExp('(.{1,' + len + '})( +|$\\n?)', 'gm');

  unwrap(chunks);
  chunks.selection = chunks.selection
    .replace(regex, replacer)
    .replace(rtrailingspaces, '');

  function replacer (line, marked) {
    return rleadingprefixes.test(line) ? line : marked + '\n';
  }
}

function unwrap (chunks) {
  rtext.lastIndex = 0;
  chunks.selection = chunks.selection.replace(rtext, '$1 $2');
}

module.exports = {
  wrap: wrap,
  unwrap: unwrap
};

},{}],46:[function(require,module,exports){
'use strict';

function once (fn) {
  var disposed;
  return function disposable () {
    if (disposed) {
      return;
    }
    disposed = true;
    return fn.apply(this, arguments);
  };
}

module.exports = once;

},{}],47:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var getSelectionRaw = require('./getSelectionRaw');
var getSelectionNullOp = require('./getSelectionNullOp');
var getSelectionSynthetic = require('./getSelectionSynthetic');
var isHost = require('./isHost');
if (isHost.method(global, 'getSelection')) {
  module.exports = getSelectionRaw;
} else if (typeof doc.selection === 'object' && doc.selection) {
  module.exports = getSelectionSynthetic;
} else {
  module.exports = getSelectionNullOp;
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wb2x5ZmlsbHMvZ2V0U2VsZWN0aW9uLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBnZXRTZWxlY3Rpb25SYXcgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblJhdycpO1xudmFyIGdldFNlbGVjdGlvbk51bGxPcCA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uTnVsbE9wJyk7XG52YXIgZ2V0U2VsZWN0aW9uU3ludGhldGljID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25TeW50aGV0aWMnKTtcbnZhciBpc0hvc3QgPSByZXF1aXJlKCcuL2lzSG9zdCcpO1xuaWYgKGlzSG9zdC5tZXRob2QoZ2xvYmFsLCAnZ2V0U2VsZWN0aW9uJykpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25SYXc7XG59IGVsc2UgaWYgKHR5cGVvZiBkb2Muc2VsZWN0aW9uID09PSAnb2JqZWN0JyAmJiBkb2Muc2VsZWN0aW9uKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uU3ludGhldGljO1xufSBlbHNlIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG59XG4iXX0=
},{"./getSelectionNullOp":48,"./getSelectionRaw":49,"./getSelectionSynthetic":50,"./isHost":51}],48:[function(require,module,exports){
'use strict';

function noop () {}

function getSelectionNullOp () {
  return {
    removeAllRanges: noop,
    addRange: noop
  };
}

module.exports = getSelectionNullOp;

},{}],49:[function(require,module,exports){
(function (global){
'use strict';

function getSelectionRaw () {
  return global.getSelection();
}

module.exports = getSelectionRaw;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wb2x5ZmlsbHMvZ2V0U2VsZWN0aW9uUmF3LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGdldFNlbGVjdGlvblJhdyAoKSB7XG4gIHJldHVybiBnbG9iYWwuZ2V0U2VsZWN0aW9uKCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uUmF3O1xuIl19
},{}],50:[function(require,module,exports){
(function (global){
'use strict';

var rangeToTextRange = require('../rangeToTextRange');
var doc = global.document;
var body = doc.body;

function GetSelection (selection) {
  var self = this;
  var range = selection.createRange();

  this._selection = selection;
  this._ranges = [];

  if (selection.type === 'Control') {
    updateControlSelection(self);
  } else if (isTextRange(range)) {
    updateFromTextRange(self, range);
  } else {
    updateEmptySelection(self);
  }
}

var GetSelectionProto = GetSelection.prototype;

GetSelectionProto.removeAllRanges = function () {
  var textRange;
  try {
    this._selection.empty();
    if (this._selection.type !== 'None') {
      textRange = body.createTextRange();
      textRange.select();
      this._selection.empty();
    }
  } catch (e) {
  }
  updateEmptySelection(this);
};

GetSelectionProto.addRange = function (range) {
  if (this._selection.type === 'Control') {
    addRangeToControlSelection(this, range);
  } else {
    rangeToTextRange(range).select();
    this._ranges[0] = range;
    this.rangeCount = 1;
    this.isCollapsed = this._ranges[0].collapsed;
    updateAnchorAndFocusFromRange(this, range, false);
  }
};

GetSelectionProto.setRanges = function (ranges) {
  this.removeAllRanges();
  var rangeCount = ranges.length;
  if (rangeCount > 1) {
    createControlSelection(this, ranges);
  } else if (rangeCount) {
    this.addRange(ranges[0]);
  }
};

GetSelectionProto.getRangeAt = function (index) {
  if (index < 0 || index >= this.rangeCount) {
    throw new Error('getRangeAt(): index out of bounds');
  } else {
    return this._ranges[index].cloneRange();
  }
};

GetSelectionProto.removeRange = function (range) {
  if (this._selection.type !== 'Control') {
    removeRangeManually(this, range);
    return;
  }
  var controlRange = this._selection.createRange();
  var rangeElement = getSingleElementFromRange(range);
  var newControlRange = body.createControlRange();
  var el;
  var removed = false;
  for (var i = 0, len = controlRange.length; i < len; ++i) {
    el = controlRange.item(i);
    if (el !== rangeElement || removed) {
      newControlRange.add(controlRange.item(i));
    } else {
      removed = true;
    }
  }
  newControlRange.select();
  updateControlSelection(this);
};

GetSelectionProto.eachRange = function (fn, returnValue) {
  var i = 0;
  var len = this._ranges.length;
  for (i = 0; i < len; ++i) {
    if (fn(this.getRangeAt(i))) {
      return returnValue;
    }
  }
};

GetSelectionProto.getAllRanges = function () {
  var ranges = [];
  this.eachRange(function (range) {
    ranges.push(range);
  });
  return ranges;
};

GetSelectionProto.setSingleRange = function (range) {
  this.removeAllRanges();
  this.addRange(range);
};

function createControlSelection (sel, ranges) {
  var controlRange = body.createControlRange();
  for (var i = 0, el, len = ranges.length; i < len; ++i) {
    el = getSingleElementFromRange(ranges[i]);
    try {
      controlRange.add(el);
    } catch (e) {
      throw new Error('setRanges(): Element could not be added to control selection');
    }
  }
  controlRange.select();
  updateControlSelection(sel);
}

function removeRangeManually (sel, range) {
  var ranges = sel.getAllRanges();
  sel.removeAllRanges();
  for (var i = 0, len = ranges.length; i < len; ++i) {
    if (!isSameRange(range, ranges[i])) {
      sel.addRange(ranges[i]);
    }
  }
  if (!sel.rangeCount) {
    updateEmptySelection(sel);
  }
}

function updateAnchorAndFocusFromRange (sel, range) {
  var anchorPrefix = 'start';
  var focusPrefix = 'end';
  sel.anchorNode = range[anchorPrefix + 'Container'];
  sel.anchorOffset = range[anchorPrefix + 'Offset'];
  sel.focusNode = range[focusPrefix + 'Container'];
  sel.focusOffset = range[focusPrefix + 'Offset'];
}

function updateEmptySelection (sel) {
  sel.anchorNode = sel.focusNode = null;
  sel.anchorOffset = sel.focusOffset = 0;
  sel.rangeCount = 0;
  sel.isCollapsed = true;
  sel._ranges.length = 0;
}

function rangeContainsSingleElement (rangeNodes) {
  if (!rangeNodes.length || rangeNodes[0].nodeType !== 1) {
    return false;
  }
  for (var i = 1, len = rangeNodes.length; i < len; ++i) {
    if (!isAncestorOf(rangeNodes[0], rangeNodes[i])) {
      return false;
    }
  }
  return true;
}

function getSingleElementFromRange (range) {
  var nodes = range.getNodes();
  if (!rangeContainsSingleElement(nodes)) {
    throw new Error('getSingleElementFromRange(): range did not consist of a single element');
  }
  return nodes[0];
}

function isTextRange (range) {
  return range && range.text !== void 0;
}

function updateFromTextRange (sel, range) {
  sel._ranges = [range];
  updateAnchorAndFocusFromRange(sel, range, false);
  sel.rangeCount = 1;
  sel.isCollapsed = range.collapsed;
}

function updateControlSelection (sel) {
  sel._ranges.length = 0;
  if (sel._selection.type === 'None') {
    updateEmptySelection(sel);
  } else {
    var controlRange = sel._selection.createRange();
    if (isTextRange(controlRange)) {
      updateFromTextRange(sel, controlRange);
    } else {
      sel.rangeCount = controlRange.length;
      var range;
      for (var i = 0; i < sel.rangeCount; ++i) {
        range = doc.createRange();
        range.selectNode(controlRange.item(i));
        sel._ranges.push(range);
      }
      sel.isCollapsed = sel.rangeCount === 1 && sel._ranges[0].collapsed;
      updateAnchorAndFocusFromRange(sel, sel._ranges[sel.rangeCount - 1], false);
    }
  }
}

function addRangeToControlSelection (sel, range) {
  var controlRange = sel._selection.createRange();
  var rangeElement = getSingleElementFromRange(range);
  var newControlRange = body.createControlRange();
  for (var i = 0, len = controlRange.length; i < len; ++i) {
    newControlRange.add(controlRange.item(i));
  }
  try {
    newControlRange.add(rangeElement);
  } catch (e) {
    throw new Error('addRange(): Element could not be added to control selection');
  }
  newControlRange.select();
  updateControlSelection(sel);
}

function isSameRange (left, right) {
  return (
    left.startContainer === right.startContainer &&
    left.startOffset === right.startOffset &&
    left.endContainer === right.endContainer &&
    left.endOffset === right.endOffset
  );
}

function isAncestorOf (ancestor, descendant) {
  var node = descendant;
  while (node.parentNode) {
    if (node.parentNode === ancestor) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
}

function getSelection () {
  return new GetSelection(global.document.selection);
}

module.exports = getSelection;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wb2x5ZmlsbHMvZ2V0U2VsZWN0aW9uU3ludGhldGljLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcblxuZnVuY3Rpb24gR2V0U2VsZWN0aW9uIChzZWxlY3Rpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgcmFuZ2UgPSBzZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcblxuICB0aGlzLl9zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG4gIHRoaXMuX3JhbmdlcyA9IFtdO1xuXG4gIGlmIChzZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWxmKTtcbiAgfSBlbHNlIGlmIChpc1RleHRSYW5nZShyYW5nZSkpIHtcbiAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbGYsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWxmKTtcbiAgfVxufVxuXG52YXIgR2V0U2VsZWN0aW9uUHJvdG8gPSBHZXRTZWxlY3Rpb24ucHJvdG90eXBlO1xuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB0ZXh0UmFuZ2U7XG4gIHRyeSB7XG4gICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnTm9uZScpIHtcbiAgICAgIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gICAgICB0ZXh0UmFuZ2Uuc2VsZWN0KCk7XG4gICAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICB1cGRhdGVFbXB0eVNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmFkZFJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlVG9UZXh0UmFuZ2UocmFuZ2UpLnNlbGVjdCgpO1xuICAgIHRoaXMuX3Jhbmdlc1swXSA9IHJhbmdlO1xuICAgIHRoaXMucmFuZ2VDb3VudCA9IDE7XG4gICAgdGhpcy5pc0NvbGxhcHNlZCA9IHRoaXMuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UodGhpcywgcmFuZ2UsIGZhbHNlKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0UmFuZ2VzID0gZnVuY3Rpb24gKHJhbmdlcykge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB2YXIgcmFuZ2VDb3VudCA9IHJhbmdlcy5sZW5ndGg7XG4gIGlmIChyYW5nZUNvdW50ID4gMSkge1xuICAgIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2VzKTtcbiAgfSBlbHNlIGlmIChyYW5nZUNvdW50KSB7XG4gICAgdGhpcy5hZGRSYW5nZShyYW5nZXNbMF0pO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRSYW5nZUF0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5yYW5nZUNvdW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRSYW5nZUF0KCk6IGluZGV4IG91dCBvZiBib3VuZHMnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5fcmFuZ2VzW2luZGV4XS5jbG9uZVJhbmdlKCk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ0NvbnRyb2wnKSB7XG4gICAgcmVtb3ZlUmFuZ2VNYW51YWxseSh0aGlzLCByYW5nZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBjb250cm9sUmFuZ2UgPSB0aGlzLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgdmFyIGVsO1xuICB2YXIgcmVtb3ZlZCA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBjb250cm9sUmFuZ2UuaXRlbShpKTtcbiAgICBpZiAoZWwgIT09IHJhbmdlRWxlbWVudCB8fCByZW1vdmVkKSB7XG4gICAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmVhY2hSYW5nZSA9IGZ1bmN0aW9uIChmbiwgcmV0dXJuVmFsdWUpIHtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuID0gdGhpcy5fcmFuZ2VzLmxlbmd0aDtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGZuKHRoaXMuZ2V0UmFuZ2VBdChpKSkpIHtcbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldEFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJhbmdlcyA9IFtdO1xuICB0aGlzLmVhY2hSYW5nZShmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICByYW5nZXMucHVzaChyYW5nZSk7XG4gIH0pO1xuICByZXR1cm4gcmFuZ2VzO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0U2luZ2xlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdGhpcy5hZGRSYW5nZShyYW5nZSk7XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVDb250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlcykge1xuICB2YXIgY29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGVsLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB0cnkge1xuICAgICAgY29udHJvbFJhbmdlLmFkZChlbCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZXRSYW5nZXMoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgICB9XG4gIH1cbiAgY29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVJhbmdlTWFudWFsbHkgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIHJhbmdlcyA9IHNlbC5nZXRBbGxSYW5nZXMoKTtcbiAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc1NhbWVSYW5nZShyYW5nZSwgcmFuZ2VzW2ldKSkge1xuICAgICAgc2VsLmFkZFJhbmdlKHJhbmdlc1tpXSk7XG4gICAgfVxuICB9XG4gIGlmICghc2VsLnJhbmdlQ291bnQpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHZhciBhbmNob3JQcmVmaXggPSAnc3RhcnQnO1xuICB2YXIgZm9jdXNQcmVmaXggPSAnZW5kJztcbiAgc2VsLmFuY2hvck5vZGUgPSByYW5nZVthbmNob3JQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5hbmNob3JPZmZzZXQgPSByYW5nZVthbmNob3JQcmVmaXggKyAnT2Zmc2V0J107XG4gIHNlbC5mb2N1c05vZGUgPSByYW5nZVtmb2N1c1ByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmZvY3VzT2Zmc2V0ID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnT2Zmc2V0J107XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUVtcHR5U2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLmFuY2hvck5vZGUgPSBzZWwuZm9jdXNOb2RlID0gbnVsbDtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHNlbC5mb2N1c09mZnNldCA9IDA7XG4gIHNlbC5yYW5nZUNvdW50ID0gMDtcbiAgc2VsLmlzQ29sbGFwc2VkID0gdHJ1ZTtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbn1cblxuZnVuY3Rpb24gcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQgKHJhbmdlTm9kZXMpIHtcbiAgaWYgKCFyYW5nZU5vZGVzLmxlbmd0aCB8fCByYW5nZU5vZGVzWzBdLm5vZGVUeXBlICE9PSAxKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAodmFyIGkgPSAxLCBsZW4gPSByYW5nZU5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc0FuY2VzdG9yT2YocmFuZ2VOb2Rlc1swXSwgcmFuZ2VOb2Rlc1tpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UgKHJhbmdlKSB7XG4gIHZhciBub2RlcyA9IHJhbmdlLmdldE5vZGVzKCk7XG4gIGlmICghcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQobm9kZXMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKCk6IHJhbmdlIGRpZCBub3QgY29uc2lzdCBvZiBhIHNpbmdsZSBlbGVtZW50Jyk7XG4gIH1cbiAgcmV0dXJuIG5vZGVzWzBdO1xufVxuXG5mdW5jdGlvbiBpc1RleHRSYW5nZSAocmFuZ2UpIHtcbiAgcmV0dXJuIHJhbmdlICYmIHJhbmdlLnRleHQgIT09IHZvaWQgMDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRnJvbVRleHRSYW5nZSAoc2VsLCByYW5nZSkge1xuICBzZWwuX3JhbmdlcyA9IFtyYW5nZV07XG4gIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgcmFuZ2UsIGZhbHNlKTtcbiAgc2VsLnJhbmdlQ291bnQgPSAxO1xuICBzZWwuaXNDb2xsYXBzZWQgPSByYW5nZS5jb2xsYXBzZWQ7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xuICBpZiAoc2VsLl9zZWxlY3Rpb24udHlwZSA9PT0gJ05vbmUnKSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoaXNUZXh0UmFuZ2UoY29udHJvbFJhbmdlKSkge1xuICAgICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWwsIGNvbnRyb2xSYW5nZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbC5yYW5nZUNvdW50ID0gY29udHJvbFJhbmdlLmxlbmd0aDtcbiAgICAgIHZhciByYW5nZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsLnJhbmdlQ291bnQ7ICsraSkge1xuICAgICAgICByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgICAgICByYW5nZS5zZWxlY3ROb2RlKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICAgICAgc2VsLl9yYW5nZXMucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgICBzZWwuaXNDb2xsYXBzZWQgPSBzZWwucmFuZ2VDb3VudCA9PT0gMSAmJiBzZWwuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHNlbC5fcmFuZ2VzW3NlbC5yYW5nZUNvdW50IC0gMV0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgfVxuICB0cnkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQocmFuZ2VFbGVtZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignYWRkUmFuZ2UoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lUmFuZ2UgKGxlZnQsIHJpZ2h0KSB7XG4gIHJldHVybiAoXG4gICAgbGVmdC5zdGFydENvbnRhaW5lciA9PT0gcmlnaHQuc3RhcnRDb250YWluZXIgJiZcbiAgICBsZWZ0LnN0YXJ0T2Zmc2V0ID09PSByaWdodC5zdGFydE9mZnNldCAmJlxuICAgIGxlZnQuZW5kQ29udGFpbmVyID09PSByaWdodC5lbmRDb250YWluZXIgJiZcbiAgICBsZWZ0LmVuZE9mZnNldCA9PT0gcmlnaHQuZW5kT2Zmc2V0XG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzQW5jZXN0b3JPZiAoYW5jZXN0b3IsIGRlc2NlbmRhbnQpIHtcbiAgdmFyIG5vZGUgPSBkZXNjZW5kYW50O1xuICB3aGlsZSAobm9kZS5wYXJlbnROb2RlKSB7XG4gICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gYW5jZXN0b3IpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uICgpIHtcbiAgcmV0dXJuIG5ldyBHZXRTZWxlY3Rpb24oZ2xvYmFsLmRvY3VtZW50LnNlbGVjdGlvbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuIl19
},{"../rangeToTextRange":55}],51:[function(require,module,exports){
'use strict';

function isHostMethod (host, prop) {
  var type = typeof host[prop];
  return type === 'function' || !!(type === 'object' && host[prop]) || type === 'unknown';
}

function isHostProperty (host, prop) {
  return typeof host[prop] !== 'undefined';
}

function many (fn) {
  return function areHosted (host, props) {
    var i = props.length;
    while (i--) {
      if (!fn(host, props[i])) {
        return false;
      }
    }
    return true;
  };
}

module.exports = {
  method: isHostMethod,
  methods: many(isHostMethod),
  property: isHostProperty,
  properties: many(isHostProperty)
};

},{}],52:[function(require,module,exports){
'use strict';

var doc = document;

function homebrewQSA (className) {
  var results = [];
  var all = doc.getElementsByTagName('*');
  var i;
  for (i in all) {
    if (wrap(all[i].className).indexOf(wrap(className)) !== -1) {
      results.push(all[i]);
    }
  }
  return results;
}

function wrap (text) {
  return ' ' + text + ' ';
}

function closePrompts () {
  if (doc.body.querySelectorAll) {
    remove(doc.body.querySelectorAll('.wk-prompt'));
  } else {
    remove(homebrewQSA('wk-prompt'));
  }
}

function remove (prompts) {
  var len = prompts.length;
  var i;
  for (i = 0; i < len; i++) {
    prompts[i].parentElement.removeChild(prompts[i]);
  }
}

module.exports = closePrompts;

},{}],53:[function(require,module,exports){
'use strict';

var crossvent = require('crossvent');
var render = require('./render');
var classes = require('../classes');
var strings = require('../strings');
var ENTER_KEY = 13;
var ESCAPE_KEY = 27;
var dragClass = 'wk-prompt-upload-dragging';

function okop () {
  return true;
}

function classify (group, classes) {
  Object.keys(group).forEach(customize);
  function customize (key) {
    if (classes[key]) {
      group[key].className += ' ' + classes[key];
    }
  }
}

function prompt (options, done) {
  var text = strings.prompts[options.type];
  var dom = render({
    id: 'wk-prompt-' + options.type,
    title: text.title,
    description: text.description,
    placeholder: text.placeholder
  });
  var domup;

  crossvent.add(dom.cancel, 'click', remove);
  crossvent.add(dom.close, 'click', remove);
  crossvent.add(dom.ok, 'click', ok);
  crossvent.add(dom.input, 'keypress', enter);
  crossvent.add(dom.dialog, 'keydown', esc);
  classify(dom, options.classes.prompts);

  var xhr = options.xhr;
  var upload = options.upload;
  if (typeof upload === 'string') {
    upload = { url: upload };
  }
  if (upload) {
    arrangeUploads(dom, done);
  }

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
    done({ definition: dom.input.value });
  }

  function remove () {
    if (upload) { bindUploadEvents(true); }
    dom.dialog.parentElement.removeChild(dom.dialog);
    options.surface.focus(options.mode);
  }

  function bindUploadEvents (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](document.body, 'dragenter', dragging);
    crossvent[op](document.body, 'dragend', dragstop);
  }

  function warn () {
    classes.add(domup.warning, 'wk-prompt-error-show');
  }
  function dragging () {
    classes.add(domup.area, dragClass);
  }
  function dragstop () {
    classes.rm(domup.area, dragClass);
  }

  function arrangeUploads (dom, done) {
    domup = render.uploads(dom, strings.prompts.types + (upload.restriction || options.type + 's'));
    bindUploadEvents();
    crossvent.add(domup.fileinput, 'change', handleChange, false);
    crossvent.add(domup.area, 'dragover', handleDragOver, false);
    crossvent.add(domup.area, 'drop', handleFileSelect, false);
    classify(domup, options.classes.prompts);

    function handleChange (e) {
      stop(e);
      submit(domup.fileinput.files);
      domup.fileinput.value = '';
      domup.fileinput.value = null;
    }

    function handleDragOver (e) {
      stop(e);
      e.dataTransfer.dropEffect = 'copy';
    }

    function handleFileSelect (e) {
      dragstop();
      stop(e);
      submit(e.dataTransfer.files);
    }

    function stop (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    function valid (files) {
      var i;
      for (i = 0; i < files.length; i++) {
        if ((upload.validate || okop)(files[i])) {
          return files[i];
        }
      }
      warn();
    }

    function submit (files) {
      classes.rm(domup.failed, 'wk-prompt-error-show');
      classes.rm(domup.warning, 'wk-prompt-error-show');
      var file = valid(files);
      if (!file) {
        return;
      }
      var form = new FormData();
      var req = {
        'Content-Type': 'multipart/form-data',
        headers: {
          Accept: 'application/json'
        },
        method: upload.method || 'PUT',
        url: upload.url,
        body: form
      };

      form.append(upload.key || 'woofmark_upload', file, file.name);
      classes.add(domup.area, 'wk-prompt-uploading');
      xhr(req, handleResponse);

      function handleResponse (err, res, body) {
        classes.rm(domup.area, 'wk-prompt-uploading');
        if (err || res.statusCode < 200 || res.statusCode > 299) {
          classes.add(domup.failed, 'wk-prompt-error-show');
          return;
        }
        dom.input.value = body.href + ' "' + body.title + '"';
        remove();
        done({ definition: dom.input.value, attachment: options.type === 'attachment' });
      }
    }
  }
}

module.exports = prompt;

},{"../classes":19,"../strings":59,"./render":54,"crossvent":6}],54:[function(require,module,exports){
(function (global){
'use strict';

var crossvent = require('crossvent');
var getText = require('../getText');
var setText = require('../setText');
var classes = require('../classes');
var strings = require('../strings');
var ac = 'appendChild';
var doc = global.document;

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
    dialog: e('article', 'wk-prompt ' + options.id),
    close: e('a', 'wk-prompt-close'),
    header: e('header', 'wk-prompt-header'),
    h1: e('h1', 'wk-prompt-title', options.title),
    section: e('section', 'wk-prompt-body'),
    desc: e('p', 'wk-prompt-description', options.description),
    inputContainer: e('div', 'wk-prompt-input-container'),
    input: e('input', 'wk-prompt-input'),
    cancel: e('button', 'wk-prompt-cancel', 'Cancel'),
    ok: e('button', 'wk-prompt-ok', 'Ok'),
    footer: e('footer', 'wk-prompt-buttons')
  };
  dom.ok.type = 'button';
  dom.header[ac](dom.h1);
  dom.section[ac](dom.desc);
  dom.section[ac](dom.inputContainer);
  dom.inputContainer[ac](dom.input);
  dom.input.placeholder = options.placeholder;
  dom.cancel.type = 'button';
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
  var fup = 'wk-prompt-fileupload';
  var domup = {
    area: e('section', 'wk-prompt-upload-area'),
    warning: e('p', 'wk-prompt-error wk-warning', warning),
    failed: e('p', 'wk-prompt-error wk-failed', strings.prompts.uploadfailed),
    upload: e('label', 'wk-prompt-upload'),
    uploading: e('span', 'wk-prompt-progress', strings.prompts.uploading),
    drop: e('span', 'wk-prompt-drop', strings.prompts.drop),
    dropicon: e('p', 'wk-prompt-drop-icon'),
    browse: e('span', 'wk-prompt-browse', strings.prompts.browse),
    dragdrop: e('p', 'wk-prompt-dragdrop', strings.prompts.drophint),
    fileinput: e('input', fup)
  };
  domup.area[ac](domup.drop);
  domup.area[ac](domup.uploading);
  domup.area[ac](domup.dropicon);
  domup.upload[ac](domup.browse);
  domup.upload[ac](domup.fileinput);
  domup.fileinput.id = fup;
  domup.fileinput.type = 'file';
  dom.dialog.className += ' wk-prompt-uploads';
  dom.inputContainer.className += ' wk-prompt-input-container-uploads';
  dom.input.className += ' wk-prompt-input-uploads';
  dom.section.insertBefore(domup.warning, dom.inputContainer);
  dom.section.insertBefore(domup.failed, dom.inputContainer);
  dom.section[ac](domup.upload);
  dom.section[ac](domup.dragdrop);
  dom.section[ac](domup.area);
  setText(dom.desc, getText(dom.desc) + strings.prompts.upload);
  crossvent.add(domup.fileinput, 'focus', focusedFileInput);
  crossvent.add(domup.fileinput, 'blur', blurredFileInput);

  function focusedFileInput () {
    classes.add(domup.upload, 'wk-focused');
  }
  function blurredFileInput () {
    classes.rm(domup.upload, 'wk-focused');
  }
  return domup;
}

render.uploads = uploads;
module.exports = render;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9wcm9tcHRzL3JlbmRlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZ2V0VGV4dCA9IHJlcXVpcmUoJy4uL2dldFRleHQnKTtcbnZhciBzZXRUZXh0ID0gcmVxdWlyZSgnLi4vc2V0VGV4dCcpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuLi9jbGFzc2VzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBhYyA9ICdhcHBlbmRDaGlsZCc7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBlICh0eXBlLCBjbHMsIHRleHQpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNscztcbiAgaWYgKHRleHQpIHtcbiAgICBzZXRUZXh0KGVsLCB0ZXh0KTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHJlbmRlciAob3B0aW9ucykge1xuICB2YXIgZG9tID0ge1xuICAgIGRpYWxvZzogZSgnYXJ0aWNsZScsICd3ay1wcm9tcHQgJyArIG9wdGlvbnMuaWQpLFxuICAgIGNsb3NlOiBlKCdhJywgJ3drLXByb21wdC1jbG9zZScpLFxuICAgIGhlYWRlcjogZSgnaGVhZGVyJywgJ3drLXByb21wdC1oZWFkZXInKSxcbiAgICBoMTogZSgnaDEnLCAnd2stcHJvbXB0LXRpdGxlJywgb3B0aW9ucy50aXRsZSksXG4gICAgc2VjdGlvbjogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtYm9keScpLFxuICAgIGRlc2M6IGUoJ3AnLCAnd2stcHJvbXB0LWRlc2NyaXB0aW9uJywgb3B0aW9ucy5kZXNjcmlwdGlvbiksXG4gICAgaW5wdXRDb250YWluZXI6IGUoJ2RpdicsICd3ay1wcm9tcHQtaW5wdXQtY29udGFpbmVyJyksXG4gICAgaW5wdXQ6IGUoJ2lucHV0JywgJ3drLXByb21wdC1pbnB1dCcpLFxuICAgIGNhbmNlbDogZSgnYnV0dG9uJywgJ3drLXByb21wdC1jYW5jZWwnLCAnQ2FuY2VsJyksXG4gICAgb2s6IGUoJ2J1dHRvbicsICd3ay1wcm9tcHQtb2snLCAnT2snKSxcbiAgICBmb290ZXI6IGUoJ2Zvb3RlcicsICd3ay1wcm9tcHQtYnV0dG9ucycpXG4gIH07XG4gIGRvbS5vay50eXBlID0gJ2J1dHRvbic7XG4gIGRvbS5oZWFkZXJbYWNdKGRvbS5oMSk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uZGVzYyk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uaW5wdXRDb250YWluZXJbYWNdKGRvbS5pbnB1dCk7XG4gIGRvbS5pbnB1dC5wbGFjZWhvbGRlciA9IG9wdGlvbnMucGxhY2Vob2xkZXI7XG4gIGRvbS5jYW5jZWwudHlwZSA9ICdidXR0b24nO1xuICBkb20uZm9vdGVyW2FjXShkb20uY2FuY2VsKTtcbiAgZG9tLmZvb3RlclthY10oZG9tLm9rKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmNsb3NlKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmhlYWRlcik7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5zZWN0aW9uKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmZvb3Rlcik7XG4gIGRvYy5ib2R5W2FjXShkb20uZGlhbG9nKTtcbiAgcmV0dXJuIGRvbTtcbn1cblxuZnVuY3Rpb24gdXBsb2FkcyAoZG9tLCB3YXJuaW5nKSB7XG4gIHZhciBmdXAgPSAnd2stcHJvbXB0LWZpbGV1cGxvYWQnO1xuICB2YXIgZG9tdXAgPSB7XG4gICAgYXJlYTogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtdXBsb2FkLWFyZWEnKSxcbiAgICB3YXJuaW5nOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay13YXJuaW5nJywgd2FybmluZyksXG4gICAgZmFpbGVkOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay1mYWlsZWQnLCBzdHJpbmdzLnByb21wdHMudXBsb2FkZmFpbGVkKSxcbiAgICB1cGxvYWQ6IGUoJ2xhYmVsJywgJ3drLXByb21wdC11cGxvYWQnKSxcbiAgICB1cGxvYWRpbmc6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LXByb2dyZXNzJywgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZGluZyksXG4gICAgZHJvcDogZSgnc3BhbicsICd3ay1wcm9tcHQtZHJvcCcsIHN0cmluZ3MucHJvbXB0cy5kcm9wKSxcbiAgICBkcm9waWNvbjogZSgncCcsICd3ay1wcm9tcHQtZHJvcC1pY29uJyksXG4gICAgYnJvd3NlOiBlKCdzcGFuJywgJ3drLXByb21wdC1icm93c2UnLCBzdHJpbmdzLnByb21wdHMuYnJvd3NlKSxcbiAgICBkcmFnZHJvcDogZSgncCcsICd3ay1wcm9tcHQtZHJhZ2Ryb3AnLCBzdHJpbmdzLnByb21wdHMuZHJvcGhpbnQpLFxuICAgIGZpbGVpbnB1dDogZSgnaW5wdXQnLCBmdXApXG4gIH07XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLmRyb3ApO1xuICBkb211cC5hcmVhW2FjXShkb211cC51cGxvYWRpbmcpO1xuICBkb211cC5hcmVhW2FjXShkb211cC5kcm9waWNvbik7XG4gIGRvbXVwLnVwbG9hZFthY10oZG9tdXAuYnJvd3NlKTtcbiAgZG9tdXAudXBsb2FkW2FjXShkb211cC5maWxlaW5wdXQpO1xuICBkb211cC5maWxlaW5wdXQuaWQgPSBmdXA7XG4gIGRvbXVwLmZpbGVpbnB1dC50eXBlID0gJ2ZpbGUnO1xuICBkb20uZGlhbG9nLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC11cGxvYWRzJztcbiAgZG9tLmlucHV0Q29udGFpbmVyLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC1pbnB1dC1jb250YWluZXItdXBsb2Fkcyc7XG4gIGRvbS5pbnB1dC5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtaW5wdXQtdXBsb2Fkcyc7XG4gIGRvbS5zZWN0aW9uLmluc2VydEJlZm9yZShkb211cC53YXJuaW5nLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvbi5pbnNlcnRCZWZvcmUoZG9tdXAuZmFpbGVkLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAudXBsb2FkKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmRyYWdkcm9wKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmFyZWEpO1xuICBzZXRUZXh0KGRvbS5kZXNjLCBnZXRUZXh0KGRvbS5kZXNjKSArIHN0cmluZ3MucHJvbXB0cy51cGxvYWQpO1xuICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmZpbGVpbnB1dCwgJ2ZvY3VzJywgZm9jdXNlZEZpbGVJbnB1dCk7XG4gIGNyb3NzdmVudC5hZGQoZG9tdXAuZmlsZWlucHV0LCAnYmx1cicsIGJsdXJyZWRGaWxlSW5wdXQpO1xuXG4gIGZ1bmN0aW9uIGZvY3VzZWRGaWxlSW5wdXQgKCkge1xuICAgIGNsYXNzZXMuYWRkKGRvbXVwLnVwbG9hZCwgJ3drLWZvY3VzZWQnKTtcbiAgfVxuICBmdW5jdGlvbiBibHVycmVkRmlsZUlucHV0ICgpIHtcbiAgICBjbGFzc2VzLnJtKGRvbXVwLnVwbG9hZCwgJ3drLWZvY3VzZWQnKTtcbiAgfVxuICByZXR1cm4gZG9tdXA7XG59XG5cbnJlbmRlci51cGxvYWRzID0gdXBsb2Fkcztcbm1vZHVsZS5leHBvcnRzID0gcmVuZGVyO1xuIl19
},{"../classes":19,"../getText":24,"../setText":58,"../strings":59,"crossvent":6}],55:[function(require,module,exports){
(function (global){
'use strict';

var doc = global.document;
var body = doc.body;

function rangeToTextRange (range) {
  if (range.collapsed) {
    return createBoundaryTextRange({ node: range.startContainer, offset: range.startOffset }, true);
  }
  var startRange = createBoundaryTextRange({ node: range.startContainer, offset: range.startOffset }, true);
  var endRange = createBoundaryTextRange({ node: range.endContainer, offset: range.endOffset }, false);
  var textRange = body.createTextRange();
  textRange.setEndPoint('StartToStart', startRange);
  textRange.setEndPoint('EndToEnd', endRange);
  return textRange;
}

function isCharacterDataNode (node) {
  var t = node.nodeType;
  return t === 3 || t === 4 || t === 8 ;
}

function createBoundaryTextRange (p, starting) {
  var bound;
  var parent;
  var offset = p.offset;
  var workingNode;
  var childNodes;
  var range = body.createTextRange();
  var data = isCharacterDataNode(p.node);

  if (data) {
    bound = p.node;
    parent = bound.parentNode;
  } else {
    childNodes = p.node.childNodes;
    bound = offset < childNodes.length ? childNodes[offset] : null;
    parent = p.node;
  }

  workingNode = doc.createElement('span');
  workingNode.innerHTML = '&#feff;';

  if (bound) {
    parent.insertBefore(workingNode, bound);
  } else {
    parent.appendChild(workingNode);
  }

  range.moveToElementText(workingNode);
  range.collapse(!starting);
  parent.removeChild(workingNode);

  if (data) {
    range[starting ? 'moveStart' : 'moveEnd']('character', offset);
  }
  return range;
}

module.exports = rangeToTextRange;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy9yYW5nZVRvVGV4dFJhbmdlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcblxuZnVuY3Rpb24gcmFuZ2VUb1RleHRSYW5nZSAocmFuZ2UpIHtcbiAgaWYgKHJhbmdlLmNvbGxhcHNlZCkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLCBvZmZzZXQ6IHJhbmdlLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB9XG4gIHZhciBzdGFydFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiByYW5nZS5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiByYW5nZS5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgdmFyIGVuZFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiByYW5nZS5lbmRDb250YWluZXIsIG9mZnNldDogcmFuZ2UuZW5kT2Zmc2V0IH0sIGZhbHNlKTtcbiAgdmFyIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnU3RhcnRUb1N0YXJ0Jywgc3RhcnRSYW5nZSk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCBlbmRSYW5nZSk7XG4gIHJldHVybiB0ZXh0UmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGlzQ2hhcmFjdGVyRGF0YU5vZGUgKG5vZGUpIHtcbiAgdmFyIHQgPSBub2RlLm5vZGVUeXBlO1xuICByZXR1cm4gdCA9PT0gMyB8fCB0ID09PSA0IHx8IHQgPT09IDggO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSAocCwgc3RhcnRpbmcpIHtcbiAgdmFyIGJvdW5kO1xuICB2YXIgcGFyZW50O1xuICB2YXIgb2Zmc2V0ID0gcC5vZmZzZXQ7XG4gIHZhciB3b3JraW5nTm9kZTtcbiAgdmFyIGNoaWxkTm9kZXM7XG4gIHZhciByYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHZhciBkYXRhID0gaXNDaGFyYWN0ZXJEYXRhTm9kZShwLm5vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgYm91bmQgPSBwLm5vZGU7XG4gICAgcGFyZW50ID0gYm91bmQucGFyZW50Tm9kZTtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGVzID0gcC5ub2RlLmNoaWxkTm9kZXM7XG4gICAgYm91bmQgPSBvZmZzZXQgPCBjaGlsZE5vZGVzLmxlbmd0aCA/IGNoaWxkTm9kZXNbb2Zmc2V0XSA6IG51bGw7XG4gICAgcGFyZW50ID0gcC5ub2RlO1xuICB9XG5cbiAgd29ya2luZ05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB3b3JraW5nTm9kZS5pbm5lckhUTUwgPSAnJiNmZWZmOyc7XG5cbiAgaWYgKGJvdW5kKSB7XG4gICAgcGFyZW50Lmluc2VydEJlZm9yZSh3b3JraW5nTm9kZSwgYm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZCh3b3JraW5nTm9kZSk7XG4gIH1cblxuICByYW5nZS5tb3ZlVG9FbGVtZW50VGV4dCh3b3JraW5nTm9kZSk7XG4gIHJhbmdlLmNvbGxhcHNlKCFzdGFydGluZyk7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh3b3JraW5nTm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICByYW5nZVtzdGFydGluZyA/ICdtb3ZlU3RhcnQnIDogJ21vdmVFbmQnXSgnY2hhcmFjdGVyJywgb2Zmc2V0KTtcbiAgfVxuICByZXR1cm4gcmFuZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2VUb1RleHRSYW5nZTtcbiJdfQ==
},{}],56:[function(require,module,exports){
'use strict';

var bullseye = require('bullseye');
var ranchored = /^[#>*-]$/;
var rboundary = /^[*_`#-]$/;
var rbulletafter = /^\d+\. /;
var rbulletline = /^\s*\d+\.$/;
var rbulletleft = /^\s*\d+$/;
var rbulletright = /\d|\./;
var rwhitespace = /^\s*$/;
var rhr = /^---+$/;
var rend = /^$|\s|\n/;
var rfootnotedeclaration = /^\[[^\]]+\]\s*:\s*[A-z\/]/;
var rfootnotebegin = /^\s*\[[^\]]*$/;
var rfootnotebegan = /^\s*\[[^\]]+$/;
var rfootnoteleft = /^\s*\[[^\]]+\]\s*$/;
var rfootnoteanchor = /^\s*\[[^\]]+\]\s*:$/;
var rfootnotelink = /^\s*\[[^\]]+\]\s*:\s*[A-z\/]/;
var rfootnotefull = /^\s*\[[^\]]+\]\s*:\s*[A-z\/].*\s*"[^"]*"/;
var rspaceorquote = /\s|"/;
var rspaceorcolon = /\s|:/;
var rempty = /^(<p><\/p>)?\n?$/i;

function rememberSelection (history) {
  var code = Math.random().toString(18).substr(2).replace(/\d+/g, '');
  var open = 'WoofmarkSelectionOpenMarker' + code;
  var close = 'WoofmarkSelectionCloseMarker' + code;
  var rmarkers = new RegExp(open + '|' + close, 'g');
  mark();
  return unmark;

  function mark () {
    var state = history.reset().inputState;
    var chunks = state.getChunks();
    var mode = state.mode;
    var all = chunks.before + chunks.selection + chunks.after;
    if (rempty.test(all)) {
      return;
    }
    if (mode === 'markdown') {
      updateMarkdownChunks(chunks);
    } else {
      updateHTMLChunks(chunks);
    }
    state.setChunks(chunks);
    state.restore(false);
  }

  function unmark () {
    var state = history.inputState;
    var chunks = state.getChunks();
    var all = chunks.before + chunks.selection + chunks.after;
    var start = all.lastIndexOf(open);
    var end = all.lastIndexOf(close) + close.length;
    var selectionStart = start === -1 ? 0 : start;
    var selectionEnd = end === -1 ? 0 : end;
    chunks.before = all.substr(0, selectionStart).replace(rmarkers, '');
    chunks.selection = all.substr(selectionStart, selectionEnd - selectionStart).replace(rmarkers, '');
    chunks.after = all.substr(end).replace(rmarkers, '');
    var el = history.surface.current(history.inputMode);
    var eye = bullseye(el, {
      caret: true, autoupdateToCaret: false, tracking: false
    });
    state.setChunks(chunks);
    state.restore(false);
    state.scrollTop = el.scrollTop = eye.read().y - el.getBoundingClientRect().top - 50;
    eye.destroy();
  }

  function updateMarkdownChunks (chunks) {
    var all = chunks.before + chunks.selection + chunks.after;
    var originalStart = chunks.before.length;
    var originalEnd = originalStart + chunks.selection.length;
    var selectionStart = move(originalStart, 1);
    var selectionEnd = move(originalEnd, -1);
    var moved = originalStart !== selectionStart || originalEnd !== selectionEnd;

    updateSelection(chunks, all, selectionStart, selectionEnd, moved);

    function move (p, offset) {
      var prev = all[p - 1] || '';
      var next = all[p] || '';
      var line = backtrace(p - 1, '\n');
      var jumps = prev === '' || prev === '\n';

      if (next === ' ' && (jumps || prev === ' ')) {
        return again();
      }

      var close = backtrace(p - 1, ']');
      var reopened = close.indexOf('[');

      // these two handle anchored references '[foo][1]', or even '[bar]  \n [2]'
      if (reopened !== -1 && rwhitespace.test(close.substr(0, reopened))) {
        return again(-close.length);
      } else {
        reopened = all.substr(p).indexOf('[');
        if (reopened !== -1 && rwhitespace.test(all.substr(p, reopened))) {
          return again(-1);
        }
      }

      // the seven following rules together handle footnote references
      if ((jumps || rwhitespace.test(line)) && rfootnotedeclaration.test(all.substr(p))) {
        return again(); // started with '', '\n', or '  ' and continued with '[a-1]: h'
      }
      if (rfootnotebegin.test(line) && next !== ']') {
        return again(); // started with '[' and continued with 'a-1'
      }
      if (rfootnotebegan.test(line) && next === ']') {
        return again(); // started with '[a-1' and continued with ']: h'
      }
      if (rfootnoteleft.test(line) && rspaceorcolon.test(next)) {
        return again(); // started with '[a-1]  ' and continued with ':'
      }
      if (rfootnoteanchor.test(line) && next === ' ') {
        return again(); // started with '[a-1]  :' and continued with ' '
      }
      if (rfootnotelink.test(line) && prev === ' ' && rspaceorquote.test(next) && offset === 1) {
        return again(); // started with '[a-1]  :' and continued with ' ', or '"', on the left
      }
      if (rfootnotefull.test(line) && rend.test(next)) {
        return again(-1); // started with '[a-1]  : something "something"' and continued with '', ' ', or '\n'
      }

      // the three following rules together handle ordered list items: '\n1. foo\n2. bar'
      if ((jumps || rwhitespace.test(line)) && rbulletafter.test(all.substr(p))) {
        return again(); // started with '', '\n', or '  ' and continued with '123. '
      }
      if (rbulletleft.test(line) && rbulletright.test(next)) {
        return again(); // started with '  123' and ended in '4' or '.'
      }
      if (rbulletline.test(line) && next === ' ') {
        return again(); // started with '  123.' and ended with ' '
      }

      if (ranchored.test(next) && jumps) {
        return again();
      }
      if (ranchored.test(prev) && next === ' ') {
        return again();
      }
      if (next === prev && rboundary.test(next)) {
        return again();
      }
      if (rhr.test(line) && next === '\n') {
        return again();
      }
      if (all.substr(p - 3, 3) === '```' && offset === 1) { // handles '```javascript\ncode\n```'
        while (all[p - 1] && all[p - 1] !== '\n') {
          p++;
        }
      }
      return p;

      function again (override) {
        var diff = override || offset;
        return move(p + diff, diff > 0 ? 1 : -1);
      }
      function backtrace (p, edge) {
        var last = all[p];
        var text = '';
        while (last && last !== edge) {
          text = last + text;
          last = all[--p];
        }
        return text;
      }
    }
  }

  function updateHTMLChunks (chunks) {
    var all = chunks.before + chunks.selection + chunks.after;
    var selectionStart = chunks.before.length;
    var selectionEnd = selectionStart + chunks.selection.length;
    var leftClose = chunks.before.lastIndexOf('>');
    var leftOpen = chunks.before.lastIndexOf('<');
    var rightClose = chunks.after.indexOf('>');
    var rightOpen = chunks.after.indexOf('<');
    var prevOpen;
    var nextClose;
    var balanceTags;

    // <fo[o]>bar</foo> into <foo>[]bar</foo>, <fo[o>ba]r</foo> into <foo>[ba]r</foo>
    if (leftOpen > leftClose) {
      nextClose = all.indexOf('>', leftClose + 1);
      if (nextClose !== -1) {
        selectionStart = nextClose + 1;
        balanceTags = true;
      }
    }

    // <foo>bar</[fo]o> into <foo>bar[]</foo>, <foo>b[ar</f]oo> into <foo>b[ar]</foo>
    if (rightOpen === -1 || rightOpen > rightClose) {
      prevOpen = all.substr(0, chunks.before.length + chunks.selection.length + rightClose).lastIndexOf('<');
      if (prevOpen !== -1) {
        selectionEnd = prevOpen;
        selectionStart = Math.min(selectionStart, selectionEnd);
        balanceTags = true;
      }
    }

    updateSelection(chunks, all, selectionStart, selectionEnd, balanceTags);
  }

  function updateSelection (chunks, all, selectionStart, selectionEnd, balanceTags) {
    if (selectionEnd < selectionStart) {
      selectionEnd = selectionStart;
    }
    if (balanceTags) {
      chunks.before = all.substr(0, selectionStart);
      chunks.selection = all.substr(selectionStart, selectionEnd - selectionStart);
      chunks.after = all.substr(selectionEnd);
    }
    chunks.selection = open + chunks.selection + close;
  }
}

module.exports = rememberSelection;

},{"bullseye":1}],57:[function(require,module,exports){
'use strict';

var setText = require('./setText');
var strings = require('./strings');

function commands (el, id) {
  setText(el, strings.buttons[id] || id);
}

function modes (el, id) {
  var texts = {
    markdown: 'm\u2193',
    wysiwyg: 'wysiwyg'
  };
  setText(el, texts[id] || id);
}

module.exports = {
  modes: modes,
  commands: commands
};

},{"./setText":58,"./strings":59}],58:[function(require,module,exports){
'use strict';

function setText (el, value) {
  el.innerText = el.textContent = value;
}

module.exports = setText;

},{}],59:[function(require,module,exports){
'use strict';

module.exports = {
  placeholders: {
    bold: 'strong text',
    italic: 'emphasized text',
    quote: 'quoted text',
    code: 'code goes here',
    listitem: 'list item',
    heading: 'Heading Text',
    link: 'link text',
    image: 'image description',
    attachment: 'attachment description'
  },
  titles: {
    bold: 'Strong <strong> Ctrl+B',
    italic: 'Emphasis <em> Ctrl+I',
    quote: 'Blockquote <blockquote> Ctrl+J',
    code: 'Code Sample <pre><code> Ctrl+E',
    ol: 'Numbered List <ol> Ctrl+O',
    ul: 'Bulleted List <ul> Ctrl+U',
    heading: 'Heading <h1>, <h2>, ... Ctrl+D',
    link: 'Hyperlink <a> Ctrl+K',
    image: 'Image <img> Ctrl+G',
    attachment: 'Attachment Ctrl+Shift+K',
    markdown: 'Markdown Mode Ctrl+M',
    html: 'HTML Mode Ctrl+H',
    wysiwyg: 'Preview Mode Ctrl+P'
  },
  buttons: {
    bold: 'B',
    italic: 'I',
    quote: '\u201c',
    code: '</>',
    ol: '1.',
    ul: '\u29BF',
    heading: 'Tt',
    link: 'Link',
    image: 'Image',
    hr: '\u21b5'
  },
  prompts: {
    link: {
      title: 'Insert Link',
      description: 'Type or paste the url to your link',
      placeholder: 'http://example.com/ "title"'
    },
    image: {
      title: 'Insert Image',
      description: 'Enter the url to your image',
      placeholder: 'http://example.com/public/image.png "title"'
    },
    attachment: {
      title: 'Attach File',
      description: 'Enter the url to your attachment',
      placeholder: 'http://example.com/public/report.pdf "title"'
    },
    types: 'You can only upload ',
    browse: 'Browse...',
    drophint: 'You can also drag files from your computer and drop them here!',
    drop: 'Drop your file here to begin upload...',
    upload: ', or upload a file',
    uploading: 'Uploading your file...',
    uploadfailed: 'The upload failed! That\'s all we know.'
  }
};

},{}],60:[function(require,module,exports){
(function (global){
'use strict';

var ls = require('local-storage');
var crossvent = require('crossvent');
var kanye = require('kanye');
var strings = require('./strings');
var setText = require('./setText');
var getSelection = require('./polyfills/getSelection');
var rememberSelection = require('./rememberSelection');
var bindCommands = require('./bindCommands');
var InputHistory = require('./InputHistory');
var getCommandHandler = require('./getCommandHandler');
var getSurface = require('./getSurface');
var classes = require('./classes');
var renderers = require('./renderers');
var xhrStub = require('./xhrStub');
var prompt = require('./prompts/prompt');
var closePrompts = require('./prompts/close');
var modeNames = ['markdown', 'html', 'wysiwyg'];
var cache = [];
var mac = /\bMac OS\b/.test(global.navigator.userAgent);
var doc = document;
var rparagraph = /^<p><\/p>\n?$/i;

function find (textarea) {
  for (var i = 0; i < cache.length; i++) {
    if (cache[i] && cache[i].ta === textarea) {
      return cache[i].editor;
    }
  }
  return null;
}

function woofmark (textarea, options) {
  var cached = find(textarea);
  if (cached) {
    return cached;
  }

  var parent = textarea.parentElement;
  if (parent.children.length > 1) {
    throw new Error('woofmark demands <textarea> elements to have no siblings');
  }

  var o = options || {};
  if (o.markdown === void 0) { o.markdown = true; }
  if (o.html === void 0) { o.html = true; }
  if (o.wysiwyg === void 0) { o.wysiwyg = true; }

  if (!o.markdown && !o.html && !o.wysiwyg) {
    throw new Error('woofmark expects at least one input mode to be available');
  }

  if (o.hr === void 0) { o.hr = false; }
  if (o.storage === void 0) { o.storage = true; }
  if (o.storage === true) { o.storage = 'woofmark_input_mode'; }
  if (o.fencing === void 0) { o.fencing = true; }
  if (o.render === void 0) { o.render = {}; }
  if (o.render.modes === void 0) { o.render.modes = {}; }
  if (o.render.commands === void 0) { o.render.commands = {}; }
  if (o.prompts === void 0) { o.prompts = {}; }
  if (o.prompts.link === void 0) { o.prompts.link = prompt; }
  if (o.prompts.image === void 0) { o.prompts.image = prompt; }
  if (o.prompts.attachment === void 0) { o.prompts.attachment = prompt; }
  if (o.prompts.close === void 0) { o.prompts.close = closePrompts; }
  if (o.xhr === void 0) { o.xhr = xhrStub; }
  if (o.classes === void 0) { o.classes = {}; }
  if (o.classes.wysiwyg === void 0) { o.classes.wysiwyg = []; }
  if (o.classes.prompts === void 0) { o.classes.prompts = {}; }
  if (o.classes.input === void 0) { o.classes.input = {}; }

  var preference = o.storage && ls.get(o.storage);
  if (preference) {
    o.defaultMode = preference;
  }

  var switchboard = tag({ c: 'wk-switchboard' });
  var commands = tag({ c: 'wk-commands' });
  var editable = tag({ c: ['wk-wysiwyg', 'wk-hide'].concat(o.classes.wysiwyg).join(' ') });
  var surface = getSurface(textarea, editable);
  var history = new InputHistory(surface, 'markdown');
  var editor = {
    addCommand: addCommand,
    addCommandButton: addCommandButton,
    runCommand: runCommand,
    parseMarkdown: o.parseMarkdown,
    parseHTML: o.parseHTML,
    destroy: destroy,
    value: getMarkdown,
    editable: o.wysiwyg ? editable : null,
    setMode: persistMode,
    history: {
      undo: history.undo,
      redo: history.redo,
      canUndo: history.canUndo,
      canRedo: history.canRedo
    },
    mode: 'markdown'
  };
  var entry = { ta: textarea, editor: editor };
  var i = cache.push(entry);
  var kanyeContext = 'woofmark_' + i;
  var kanyeOptions = {
    filter: parent,
    context: kanyeContext
  };
  var modes = {
    markdown: {
      button: tag({ t: 'button', c: 'wk-mode wk-mode-active' }),
      set: markdownMode
    },
    html: {
      button: tag({ t: 'button', c: 'wk-mode wk-mode-inactive' }),
      set: htmlMode
    },
    wysiwyg: {
      button: tag({ t: 'button', c: 'wk-mode wk-mode-inactive' }),
      set: wysiwygMode
    }
  };
  var place;

  editable.contentEditable = true;
  modes.markdown.button.setAttribute('disabled', 'disabled');
  modeNames.forEach(addMode);

  if (o.wysiwyg) {
    place = tag({ c: 'wk-wysiwyg-placeholder wk-hide', x: textarea.placeholder });
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
  bindCommands(surface, o, editor);

  return editor;

  function addMode (id) {
    var button = modes[id].button;
    var custom = o.render.modes;
    if (o[id]) {
      switchboard.appendChild(button);
      (typeof custom === 'function' ? custom : renderers.modes)(button, id);
      crossvent.add(button, 'click', modes[id].set);
      button.type = 'button';
      button.tabIndex = -1;

      var title = strings.titles[id];
      if (title) {
        button.setAttribute('title', mac ? macify(title) : title);
      }
    }
  }

  function bindEvents (remove) {
    var ar = remove ? 'rm' : 'add';
    var mov = remove ? 'removeChild' : 'appendChild';
    if (remove) {
      kanye.clear(kanyeContext);
    } else {
      if (o.markdown) { kanye.on('cmd+m', kanyeOptions, markdownMode); }
      if (o.html) { kanye.on('cmd+h', kanyeOptions, htmlMode); }
      if (o.wysiwyg) { kanye.on('cmd+p', kanyeOptions, wysiwygMode); }
    }
    classes[ar](parent, 'wk-container');
    parent[mov](editable);
    if (place) { parent[mov](place); }
    parent[mov](commands);
    parent[mov](switchboard);
  }

  function destroy () {
    if (editor.mode !== 'markdown') {
      textarea.value = getMarkdown();
    }
    classes.rm(textarea, 'wk-hide');
    bindEvents(true);
    delete cache[i - 1];
  }

  function markdownMode (e) { persistMode('markdown', e); }
  function htmlMode (e) { persistMode('html', e); }
  function wysiwygMode (e) { persistMode('wysiwyg', e); }

  function persistMode (nextMode, e) {
    var restoreSelection;
    var currentMode = editor.mode;
    var old = modes[currentMode].button;
    var button = modes[nextMode].button;
    var focusing = !!e || doc.activeElement === textarea || doc.activeElement === editable;

    stop(e);

    if (currentMode === nextMode) {
      return;
    }

    restoreSelection = focusing && rememberSelection(history, o);
    textarea.blur(); // avert chrome repaint bugs

    if (nextMode === 'markdown') {
      if (currentMode === 'html') {
        textarea.value = o.parseHTML(textarea.value).trim();
      } else {
        textarea.value = o.parseHTML(editable).trim();
      }
    } else if (nextMode === 'html') {
      if (currentMode === 'markdown') {
        textarea.value = o.parseMarkdown(textarea.value).trim();
      } else {
        textarea.value = editable.innerHTML.trim();
      }
    } else if (nextMode === 'wysiwyg') {
      if (currentMode === 'markdown') {
        editable.innerHTML = o.parseMarkdown(textarea.value).replace(rparagraph, '').trim();
      } else {
        editable.innerHTML = textarea.value.replace(rparagraph, '').trim();
      }
    }

    if (nextMode === 'wysiwyg') {
      classes.add(textarea, 'wk-hide');
      classes.rm(editable, 'wk-hide');
      if (place) { classes.rm(place, 'wk-hide'); }
      if (focusing) { setTimeout(focusEditable, 0); }
    } else {
      classes.rm(textarea, 'wk-hide');
      classes.add(editable, 'wk-hide');
      if (place) { classes.add(place, 'wk-hide'); }
      if (focusing) { textarea.focus(); }
    }
    classes.add(button, 'wk-mode-active');
    classes.rm(old, 'wk-mode-active');
    classes.add(old, 'wk-mode-inactive');
    classes.rm(button, 'wk-mode-inactive');
    button.setAttribute('disabled', 'disabled');
    old.removeAttribute('disabled');
    editor.mode = nextMode;

    if (o.storage) { ls.set(o.storage, nextMode); }

    history.setInputMode(nextMode);
    if (restoreSelection) { restoreSelection(); }
    fireLater('woofmark-mode-change');
  }

  function fireLater (type) {
    setTimeout(function fire () {
      crossvent.fabricate(textarea, type);
    }, 0);
  }

  function focusEditable () {
    editable.focus();
  }

  function getMarkdown () {
    if (editor.mode === 'wysiwyg') {
      return o.parseHTML(editable);
    }
    if (editor.mode === 'html') {
      return o.parseHTML(textarea.value);
    }
    return textarea.value;
  }

  function addCommandButton (id, combo, fn) {
    if (arguments.length === 2) {
      fn = combo;
      combo = null;
    }
    var button = tag({ t: 'button', c: 'wk-command', p: commands });
    var custom = o.render.commands;
    var render = typeof custom === 'function' ? custom : renderers.commands;
    var title = strings.titles[id];
    if (title) {
      button.setAttribute('title', mac ? macify(title) : title);
    }
    button.type = 'button';
    button.tabIndex = -1;
    render(button, id);
    crossvent.add(button, 'click', getCommandHandler(surface, history, fn));
    if (combo) {
      addCommand(combo, fn);
    }
    return button;
  }

  function addCommand (combo, fn) {
    kanye.on(combo, kanyeOptions, getCommandHandler(surface, history, fn));
  }

  function runCommand (fn) {
    getCommandHandler(surface, history, rearrange)(null);
    function rearrange (e, mode, chunks) {
      return fn.call(this, chunks, mode);
    }
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
  if (e) { e.preventDefault(); e.stopPropagation(); }
}

function macify (text) {
  return text
    .replace(/\bctrl\b/i, '\u2318')
    .replace(/\balt\b/i, '\u2325')
    .replace(/\bshift\b/i, '\u21e7');
}

woofmark.find = find;
woofmark.strings = strings;
woofmark.getSelection = getSelection;
module.exports = woofmark;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInNyYy93b29mbWFyay5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGxzID0gcmVxdWlyZSgnbG9jYWwtc3RvcmFnZScpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIGthbnllID0gcmVxdWlyZSgna2FueWUnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi9zdHJpbmdzJyk7XG52YXIgc2V0VGV4dCA9IHJlcXVpcmUoJy4vc2V0VGV4dCcpO1xudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vcG9seWZpbGxzL2dldFNlbGVjdGlvbicpO1xudmFyIHJlbWVtYmVyU2VsZWN0aW9uID0gcmVxdWlyZSgnLi9yZW1lbWJlclNlbGVjdGlvbicpO1xudmFyIGJpbmRDb21tYW5kcyA9IHJlcXVpcmUoJy4vYmluZENvbW1hbmRzJyk7XG52YXIgSW5wdXRIaXN0b3J5ID0gcmVxdWlyZSgnLi9JbnB1dEhpc3RvcnknKTtcbnZhciBnZXRDb21tYW5kSGFuZGxlciA9IHJlcXVpcmUoJy4vZ2V0Q29tbWFuZEhhbmRsZXInKTtcbnZhciBnZXRTdXJmYWNlID0gcmVxdWlyZSgnLi9nZXRTdXJmYWNlJyk7XG52YXIgY2xhc3NlcyA9IHJlcXVpcmUoJy4vY2xhc3NlcycpO1xudmFyIHJlbmRlcmVycyA9IHJlcXVpcmUoJy4vcmVuZGVyZXJzJyk7XG52YXIgeGhyU3R1YiA9IHJlcXVpcmUoJy4veGhyU3R1YicpO1xudmFyIHByb21wdCA9IHJlcXVpcmUoJy4vcHJvbXB0cy9wcm9tcHQnKTtcbnZhciBjbG9zZVByb21wdHMgPSByZXF1aXJlKCcuL3Byb21wdHMvY2xvc2UnKTtcbnZhciBtb2RlTmFtZXMgPSBbJ21hcmtkb3duJywgJ2h0bWwnLCAnd3lzaXd5ZyddO1xudmFyIGNhY2hlID0gW107XG52YXIgbWFjID0gL1xcYk1hYyBPU1xcYi8udGVzdChnbG9iYWwubmF2aWdhdG9yLnVzZXJBZ2VudCk7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgcnBhcmFncmFwaCA9IC9ePHA+PFxcL3A+XFxuPyQvaTtcblxuZnVuY3Rpb24gZmluZCAodGV4dGFyZWEpIHtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBjYWNoZS5sZW5ndGg7IGkrKykge1xuICAgIGlmIChjYWNoZVtpXSAmJiBjYWNoZVtpXS50YSA9PT0gdGV4dGFyZWEpIHtcbiAgICAgIHJldHVybiBjYWNoZVtpXS5lZGl0b3I7XG4gICAgfVxuICB9XG4gIHJldHVybiBudWxsO1xufVxuXG5mdW5jdGlvbiB3b29mbWFyayAodGV4dGFyZWEsIG9wdGlvbnMpIHtcbiAgdmFyIGNhY2hlZCA9IGZpbmQodGV4dGFyZWEpO1xuICBpZiAoY2FjaGVkKSB7XG4gICAgcmV0dXJuIGNhY2hlZDtcbiAgfVxuXG4gIHZhciBwYXJlbnQgPSB0ZXh0YXJlYS5wYXJlbnRFbGVtZW50O1xuICBpZiAocGFyZW50LmNoaWxkcmVuLmxlbmd0aCA+IDEpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dvb2ZtYXJrIGRlbWFuZHMgPHRleHRhcmVhPiBlbGVtZW50cyB0byBoYXZlIG5vIHNpYmxpbmdzJyk7XG4gIH1cblxuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIGlmIChvLm1hcmtkb3duID09PSB2b2lkIDApIHsgby5tYXJrZG93biA9IHRydWU7IH1cbiAgaWYgKG8uaHRtbCA9PT0gdm9pZCAwKSB7IG8uaHRtbCA9IHRydWU7IH1cbiAgaWYgKG8ud3lzaXd5ZyA9PT0gdm9pZCAwKSB7IG8ud3lzaXd5ZyA9IHRydWU7IH1cblxuICBpZiAoIW8ubWFya2Rvd24gJiYgIW8uaHRtbCAmJiAhby53eXNpd3lnKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCd3b29mbWFyayBleHBlY3RzIGF0IGxlYXN0IG9uZSBpbnB1dCBtb2RlIHRvIGJlIGF2YWlsYWJsZScpO1xuICB9XG5cbiAgaWYgKG8uaHIgPT09IHZvaWQgMCkgeyBvLmhyID0gZmFsc2U7IH1cbiAgaWYgKG8uc3RvcmFnZSA9PT0gdm9pZCAwKSB7IG8uc3RvcmFnZSA9IHRydWU7IH1cbiAgaWYgKG8uc3RvcmFnZSA9PT0gdHJ1ZSkgeyBvLnN0b3JhZ2UgPSAnd29vZm1hcmtfaW5wdXRfbW9kZSc7IH1cbiAgaWYgKG8uZmVuY2luZyA9PT0gdm9pZCAwKSB7IG8uZmVuY2luZyA9IHRydWU7IH1cbiAgaWYgKG8ucmVuZGVyID09PSB2b2lkIDApIHsgby5yZW5kZXIgPSB7fTsgfVxuICBpZiAoby5yZW5kZXIubW9kZXMgPT09IHZvaWQgMCkgeyBvLnJlbmRlci5tb2RlcyA9IHt9OyB9XG4gIGlmIChvLnJlbmRlci5jb21tYW5kcyA9PT0gdm9pZCAwKSB7IG8ucmVuZGVyLmNvbW1hbmRzID0ge307IH1cbiAgaWYgKG8ucHJvbXB0cyA9PT0gdm9pZCAwKSB7IG8ucHJvbXB0cyA9IHt9OyB9XG4gIGlmIChvLnByb21wdHMubGluayA9PT0gdm9pZCAwKSB7IG8ucHJvbXB0cy5saW5rID0gcHJvbXB0OyB9XG4gIGlmIChvLnByb21wdHMuaW1hZ2UgPT09IHZvaWQgMCkgeyBvLnByb21wdHMuaW1hZ2UgPSBwcm9tcHQ7IH1cbiAgaWYgKG8ucHJvbXB0cy5hdHRhY2htZW50ID09PSB2b2lkIDApIHsgby5wcm9tcHRzLmF0dGFjaG1lbnQgPSBwcm9tcHQ7IH1cbiAgaWYgKG8ucHJvbXB0cy5jbG9zZSA9PT0gdm9pZCAwKSB7IG8ucHJvbXB0cy5jbG9zZSA9IGNsb3NlUHJvbXB0czsgfVxuICBpZiAoby54aHIgPT09IHZvaWQgMCkgeyBvLnhociA9IHhoclN0dWI7IH1cbiAgaWYgKG8uY2xhc3NlcyA9PT0gdm9pZCAwKSB7IG8uY2xhc3NlcyA9IHt9OyB9XG4gIGlmIChvLmNsYXNzZXMud3lzaXd5ZyA9PT0gdm9pZCAwKSB7IG8uY2xhc3Nlcy53eXNpd3lnID0gW107IH1cbiAgaWYgKG8uY2xhc3Nlcy5wcm9tcHRzID09PSB2b2lkIDApIHsgby5jbGFzc2VzLnByb21wdHMgPSB7fTsgfVxuICBpZiAoby5jbGFzc2VzLmlucHV0ID09PSB2b2lkIDApIHsgby5jbGFzc2VzLmlucHV0ID0ge307IH1cblxuICB2YXIgcHJlZmVyZW5jZSA9IG8uc3RvcmFnZSAmJiBscy5nZXQoby5zdG9yYWdlKTtcbiAgaWYgKHByZWZlcmVuY2UpIHtcbiAgICBvLmRlZmF1bHRNb2RlID0gcHJlZmVyZW5jZTtcbiAgfVxuXG4gIHZhciBzd2l0Y2hib2FyZCA9IHRhZyh7IGM6ICd3ay1zd2l0Y2hib2FyZCcgfSk7XG4gIHZhciBjb21tYW5kcyA9IHRhZyh7IGM6ICd3ay1jb21tYW5kcycgfSk7XG4gIHZhciBlZGl0YWJsZSA9IHRhZyh7IGM6IFsnd2std3lzaXd5ZycsICd3ay1oaWRlJ10uY29uY2F0KG8uY2xhc3Nlcy53eXNpd3lnKS5qb2luKCcgJykgfSk7XG4gIHZhciBzdXJmYWNlID0gZ2V0U3VyZmFjZSh0ZXh0YXJlYSwgZWRpdGFibGUpO1xuICB2YXIgaGlzdG9yeSA9IG5ldyBJbnB1dEhpc3Rvcnkoc3VyZmFjZSwgJ21hcmtkb3duJyk7XG4gIHZhciBlZGl0b3IgPSB7XG4gICAgYWRkQ29tbWFuZDogYWRkQ29tbWFuZCxcbiAgICBhZGRDb21tYW5kQnV0dG9uOiBhZGRDb21tYW5kQnV0dG9uLFxuICAgIHJ1bkNvbW1hbmQ6IHJ1bkNvbW1hbmQsXG4gICAgcGFyc2VNYXJrZG93bjogby5wYXJzZU1hcmtkb3duLFxuICAgIHBhcnNlSFRNTDogby5wYXJzZUhUTUwsXG4gICAgZGVzdHJveTogZGVzdHJveSxcbiAgICB2YWx1ZTogZ2V0TWFya2Rvd24sXG4gICAgZWRpdGFibGU6IG8ud3lzaXd5ZyA/IGVkaXRhYmxlIDogbnVsbCxcbiAgICBzZXRNb2RlOiBwZXJzaXN0TW9kZSxcbiAgICBoaXN0b3J5OiB7XG4gICAgICB1bmRvOiBoaXN0b3J5LnVuZG8sXG4gICAgICByZWRvOiBoaXN0b3J5LnJlZG8sXG4gICAgICBjYW5VbmRvOiBoaXN0b3J5LmNhblVuZG8sXG4gICAgICBjYW5SZWRvOiBoaXN0b3J5LmNhblJlZG9cbiAgICB9LFxuICAgIG1vZGU6ICdtYXJrZG93bidcbiAgfTtcbiAgdmFyIGVudHJ5ID0geyB0YTogdGV4dGFyZWEsIGVkaXRvcjogZWRpdG9yIH07XG4gIHZhciBpID0gY2FjaGUucHVzaChlbnRyeSk7XG4gIHZhciBrYW55ZUNvbnRleHQgPSAnd29vZm1hcmtfJyArIGk7XG4gIHZhciBrYW55ZU9wdGlvbnMgPSB7XG4gICAgZmlsdGVyOiBwYXJlbnQsXG4gICAgY29udGV4dDoga2FueWVDb250ZXh0XG4gIH07XG4gIHZhciBtb2RlcyA9IHtcbiAgICBtYXJrZG93bjoge1xuICAgICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLW1vZGUgd2stbW9kZS1hY3RpdmUnIH0pLFxuICAgICAgc2V0OiBtYXJrZG93bk1vZGVcbiAgICB9LFxuICAgIGh0bWw6IHtcbiAgICAgIGJ1dHRvbjogdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1tb2RlIHdrLW1vZGUtaW5hY3RpdmUnIH0pLFxuICAgICAgc2V0OiBodG1sTW9kZVxuICAgIH0sXG4gICAgd3lzaXd5Zzoge1xuICAgICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLW1vZGUgd2stbW9kZS1pbmFjdGl2ZScgfSksXG4gICAgICBzZXQ6IHd5c2l3eWdNb2RlXG4gICAgfVxuICB9O1xuICB2YXIgcGxhY2U7XG5cbiAgZWRpdGFibGUuY29udGVudEVkaXRhYmxlID0gdHJ1ZTtcbiAgbW9kZXMubWFya2Rvd24uYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgbW9kZU5hbWVzLmZvckVhY2goYWRkTW9kZSk7XG5cbiAgaWYgKG8ud3lzaXd5Zykge1xuICAgIHBsYWNlID0gdGFnKHsgYzogJ3drLXd5c2l3eWctcGxhY2Vob2xkZXIgd2staGlkZScsIHg6IHRleHRhcmVhLnBsYWNlaG9sZGVyIH0pO1xuICAgIGNyb3NzdmVudC5hZGQocGxhY2UsICdjbGljaycsIGZvY3VzRWRpdGFibGUpO1xuICB9XG5cbiAgaWYgKG8uZGVmYXVsdE1vZGUgJiYgb1tvLmRlZmF1bHRNb2RlXSkge1xuICAgIG1vZGVzW28uZGVmYXVsdE1vZGVdLnNldCgpO1xuICB9IGVsc2UgaWYgKG8ubWFya2Rvd24pIHtcbiAgICBtb2Rlcy5tYXJrZG93bi5zZXQoKTtcbiAgfSBlbHNlIGlmIChvLmh0bWwpIHtcbiAgICBtb2Rlcy5odG1sLnNldCgpO1xuICB9IGVsc2Uge1xuICAgIG1vZGVzLnd5c2l3eWcuc2V0KCk7XG4gIH1cblxuICBiaW5kRXZlbnRzKCk7XG4gIGJpbmRDb21tYW5kcyhzdXJmYWNlLCBvLCBlZGl0b3IpO1xuXG4gIHJldHVybiBlZGl0b3I7XG5cbiAgZnVuY3Rpb24gYWRkTW9kZSAoaWQpIHtcbiAgICB2YXIgYnV0dG9uID0gbW9kZXNbaWRdLmJ1dHRvbjtcbiAgICB2YXIgY3VzdG9tID0gby5yZW5kZXIubW9kZXM7XG4gICAgaWYgKG9baWRdKSB7XG4gICAgICBzd2l0Y2hib2FyZC5hcHBlbmRDaGlsZChidXR0b24pO1xuICAgICAgKHR5cGVvZiBjdXN0b20gPT09ICdmdW5jdGlvbicgPyBjdXN0b20gOiByZW5kZXJlcnMubW9kZXMpKGJ1dHRvbiwgaWQpO1xuICAgICAgY3Jvc3N2ZW50LmFkZChidXR0b24sICdjbGljaycsIG1vZGVzW2lkXS5zZXQpO1xuICAgICAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgICAgIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuXG4gICAgICB2YXIgdGl0bGUgPSBzdHJpbmdzLnRpdGxlc1tpZF07XG4gICAgICBpZiAodGl0bGUpIHtcbiAgICAgICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmRFdmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBhciA9IHJlbW92ZSA/ICdybScgOiAnYWRkJztcbiAgICB2YXIgbW92ID0gcmVtb3ZlID8gJ3JlbW92ZUNoaWxkJyA6ICdhcHBlbmRDaGlsZCc7XG4gICAgaWYgKHJlbW92ZSkge1xuICAgICAga2FueWUuY2xlYXIoa2FueWVDb250ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKG8ubWFya2Rvd24pIHsga2FueWUub24oJ2NtZCttJywga2FueWVPcHRpb25zLCBtYXJrZG93bk1vZGUpOyB9XG4gICAgICBpZiAoby5odG1sKSB7IGthbnllLm9uKCdjbWQraCcsIGthbnllT3B0aW9ucywgaHRtbE1vZGUpOyB9XG4gICAgICBpZiAoby53eXNpd3lnKSB7IGthbnllLm9uKCdjbWQrcCcsIGthbnllT3B0aW9ucywgd3lzaXd5Z01vZGUpOyB9XG4gICAgfVxuICAgIGNsYXNzZXNbYXJdKHBhcmVudCwgJ3drLWNvbnRhaW5lcicpO1xuICAgIHBhcmVudFttb3ZdKGVkaXRhYmxlKTtcbiAgICBpZiAocGxhY2UpIHsgcGFyZW50W21vdl0ocGxhY2UpOyB9XG4gICAgcGFyZW50W21vdl0oY29tbWFuZHMpO1xuICAgIHBhcmVudFttb3ZdKHN3aXRjaGJvYXJkKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGRlc3Ryb3kgKCkge1xuICAgIGlmIChlZGl0b3IubW9kZSAhPT0gJ21hcmtkb3duJykge1xuICAgICAgdGV4dGFyZWEudmFsdWUgPSBnZXRNYXJrZG93bigpO1xuICAgIH1cbiAgICBjbGFzc2VzLnJtKHRleHRhcmVhLCAnd2staGlkZScpO1xuICAgIGJpbmRFdmVudHModHJ1ZSk7XG4gICAgZGVsZXRlIGNhY2hlW2kgLSAxXTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1hcmtkb3duTW9kZSAoZSkgeyBwZXJzaXN0TW9kZSgnbWFya2Rvd24nLCBlKTsgfVxuICBmdW5jdGlvbiBodG1sTW9kZSAoZSkgeyBwZXJzaXN0TW9kZSgnaHRtbCcsIGUpOyB9XG4gIGZ1bmN0aW9uIHd5c2l3eWdNb2RlIChlKSB7IHBlcnNpc3RNb2RlKCd3eXNpd3lnJywgZSk7IH1cblxuICBmdW5jdGlvbiBwZXJzaXN0TW9kZSAobmV4dE1vZGUsIGUpIHtcbiAgICB2YXIgcmVzdG9yZVNlbGVjdGlvbjtcbiAgICB2YXIgY3VycmVudE1vZGUgPSBlZGl0b3IubW9kZTtcbiAgICB2YXIgb2xkID0gbW9kZXNbY3VycmVudE1vZGVdLmJ1dHRvbjtcbiAgICB2YXIgYnV0dG9uID0gbW9kZXNbbmV4dE1vZGVdLmJ1dHRvbjtcbiAgICB2YXIgZm9jdXNpbmcgPSAhIWUgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IHRleHRhcmVhIHx8IGRvYy5hY3RpdmVFbGVtZW50ID09PSBlZGl0YWJsZTtcblxuICAgIHN0b3AoZSk7XG5cbiAgICBpZiAoY3VycmVudE1vZGUgPT09IG5leHRNb2RlKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgcmVzdG9yZVNlbGVjdGlvbiA9IGZvY3VzaW5nICYmIHJlbWVtYmVyU2VsZWN0aW9uKGhpc3RvcnksIG8pO1xuICAgIHRleHRhcmVhLmJsdXIoKTsgLy8gYXZlcnQgY2hyb21lIHJlcGFpbnQgYnVnc1xuXG4gICAgaWYgKG5leHRNb2RlID09PSAnbWFya2Rvd24nKSB7XG4gICAgICBpZiAoY3VycmVudE1vZGUgPT09ICdodG1sJykge1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IG8ucGFyc2VIVE1MKHRleHRhcmVhLnZhbHVlKS50cmltKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IG8ucGFyc2VIVE1MKGVkaXRhYmxlKS50cmltKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChuZXh0TW9kZSA9PT0gJ2h0bWwnKSB7XG4gICAgICBpZiAoY3VycmVudE1vZGUgPT09ICdtYXJrZG93bicpIHtcbiAgICAgICAgdGV4dGFyZWEudmFsdWUgPSBvLnBhcnNlTWFya2Rvd24odGV4dGFyZWEudmFsdWUpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRleHRhcmVhLnZhbHVlID0gZWRpdGFibGUuaW5uZXJIVE1MLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHRNb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIGlmIChjdXJyZW50TW9kZSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgICBlZGl0YWJsZS5pbm5lckhUTUwgPSBvLnBhcnNlTWFya2Rvd24odGV4dGFyZWEudmFsdWUpLnJlcGxhY2UocnBhcmFncmFwaCwgJycpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVkaXRhYmxlLmlubmVySFRNTCA9IHRleHRhcmVhLnZhbHVlLnJlcGxhY2UocnBhcmFncmFwaCwgJycpLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAobmV4dE1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgY2xhc3Nlcy5hZGQodGV4dGFyZWEsICd3ay1oaWRlJyk7XG4gICAgICBjbGFzc2VzLnJtKGVkaXRhYmxlLCAnd2staGlkZScpO1xuICAgICAgaWYgKHBsYWNlKSB7IGNsYXNzZXMucm0ocGxhY2UsICd3ay1oaWRlJyk7IH1cbiAgICAgIGlmIChmb2N1c2luZykgeyBzZXRUaW1lb3V0KGZvY3VzRWRpdGFibGUsIDApOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGNsYXNzZXMucm0odGV4dGFyZWEsICd3ay1oaWRlJyk7XG4gICAgICBjbGFzc2VzLmFkZChlZGl0YWJsZSwgJ3drLWhpZGUnKTtcbiAgICAgIGlmIChwbGFjZSkgeyBjbGFzc2VzLmFkZChwbGFjZSwgJ3drLWhpZGUnKTsgfVxuICAgICAgaWYgKGZvY3VzaW5nKSB7IHRleHRhcmVhLmZvY3VzKCk7IH1cbiAgICB9XG4gICAgY2xhc3Nlcy5hZGQoYnV0dG9uLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgICBjbGFzc2VzLnJtKG9sZCwgJ3drLW1vZGUtYWN0aXZlJyk7XG4gICAgY2xhc3Nlcy5hZGQob2xkLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICAgIGNsYXNzZXMucm0oYnV0dG9uLCAnd2stbW9kZS1pbmFjdGl2ZScpO1xuICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ2Rpc2FibGVkJywgJ2Rpc2FibGVkJyk7XG4gICAgb2xkLnJlbW92ZUF0dHJpYnV0ZSgnZGlzYWJsZWQnKTtcbiAgICBlZGl0b3IubW9kZSA9IG5leHRNb2RlO1xuXG4gICAgaWYgKG8uc3RvcmFnZSkgeyBscy5zZXQoby5zdG9yYWdlLCBuZXh0TW9kZSk7IH1cblxuICAgIGhpc3Rvcnkuc2V0SW5wdXRNb2RlKG5leHRNb2RlKTtcbiAgICBpZiAocmVzdG9yZVNlbGVjdGlvbikgeyByZXN0b3JlU2VsZWN0aW9uKCk7IH1cbiAgICBmaXJlTGF0ZXIoJ3dvb2ZtYXJrLW1vZGUtY2hhbmdlJyk7XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlTGF0ZXIgKHR5cGUpIHtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uIGZpcmUgKCkge1xuICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZSh0ZXh0YXJlYSwgdHlwZSk7XG4gICAgfSwgMCk7XG4gIH1cblxuICBmdW5jdGlvbiBmb2N1c0VkaXRhYmxlICgpIHtcbiAgICBlZGl0YWJsZS5mb2N1cygpO1xuICB9XG5cbiAgZnVuY3Rpb24gZ2V0TWFya2Rvd24gKCkge1xuICAgIGlmIChlZGl0b3IubW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgICByZXR1cm4gby5wYXJzZUhUTUwoZWRpdGFibGUpO1xuICAgIH1cbiAgICBpZiAoZWRpdG9yLm1vZGUgPT09ICdodG1sJykge1xuICAgICAgcmV0dXJuIG8ucGFyc2VIVE1MKHRleHRhcmVhLnZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRhcmVhLnZhbHVlO1xuICB9XG5cbiAgZnVuY3Rpb24gYWRkQ29tbWFuZEJ1dHRvbiAoaWQsIGNvbWJvLCBmbikge1xuICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAyKSB7XG4gICAgICBmbiA9IGNvbWJvO1xuICAgICAgY29tYm8gPSBudWxsO1xuICAgIH1cbiAgICB2YXIgYnV0dG9uID0gdGFnKHsgdDogJ2J1dHRvbicsIGM6ICd3ay1jb21tYW5kJywgcDogY29tbWFuZHMgfSk7XG4gICAgdmFyIGN1c3RvbSA9IG8ucmVuZGVyLmNvbW1hbmRzO1xuICAgIHZhciByZW5kZXIgPSB0eXBlb2YgY3VzdG9tID09PSAnZnVuY3Rpb24nID8gY3VzdG9tIDogcmVuZGVyZXJzLmNvbW1hbmRzO1xuICAgIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgbWFjID8gbWFjaWZ5KHRpdGxlKSA6IHRpdGxlKTtcbiAgICB9XG4gICAgYnV0dG9uLnR5cGUgPSAnYnV0dG9uJztcbiAgICBidXR0b24udGFiSW5kZXggPSAtMTtcbiAgICByZW5kZXIoYnV0dG9uLCBpZCk7XG4gICAgY3Jvc3N2ZW50LmFkZChidXR0b24sICdjbGljaycsIGdldENvbW1hbmRIYW5kbGVyKHN1cmZhY2UsIGhpc3RvcnksIGZuKSk7XG4gICAgaWYgKGNvbWJvKSB7XG4gICAgICBhZGRDb21tYW5kKGNvbWJvLCBmbik7XG4gICAgfVxuICAgIHJldHVybiBidXR0b247XG4gIH1cblxuICBmdW5jdGlvbiBhZGRDb21tYW5kIChjb21ibywgZm4pIHtcbiAgICBrYW55ZS5vbihjb21ibywga2FueWVPcHRpb25zLCBnZXRDb21tYW5kSGFuZGxlcihzdXJmYWNlLCBoaXN0b3J5LCBmbikpO1xuICB9XG5cbiAgZnVuY3Rpb24gcnVuQ29tbWFuZCAoZm4pIHtcbiAgICBnZXRDb21tYW5kSGFuZGxlcihzdXJmYWNlLCBoaXN0b3J5LCByZWFycmFuZ2UpKG51bGwpO1xuICAgIGZ1bmN0aW9uIHJlYXJyYW5nZSAoZSwgbW9kZSwgY2h1bmtzKSB7XG4gICAgICByZXR1cm4gZm4uY2FsbCh0aGlzLCBjaHVua3MsIG1vZGUpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiB0YWcgKG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgZWwgPSBkb2MuY3JlYXRlRWxlbWVudChvLnQgfHwgJ2RpdicpO1xuICBlbC5jbGFzc05hbWUgPSBvLmMgfHwgJyc7XG4gIHNldFRleHQoZWwsIG8ueCB8fCAnJyk7XG4gIGlmIChvLnApIHsgby5wLmFwcGVuZENoaWxkKGVsKTsgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgaWYgKGUpIHsgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpOyB9XG59XG5cbmZ1bmN0aW9uIG1hY2lmeSAodGV4dCkge1xuICByZXR1cm4gdGV4dFxuICAgIC5yZXBsYWNlKC9cXGJjdHJsXFxiL2ksICdcXHUyMzE4JylcbiAgICAucmVwbGFjZSgvXFxiYWx0XFxiL2ksICdcXHUyMzI1JylcbiAgICAucmVwbGFjZSgvXFxic2hpZnRcXGIvaSwgJ1xcdTIxZTcnKTtcbn1cblxud29vZm1hcmsuZmluZCA9IGZpbmQ7XG53b29mbWFyay5zdHJpbmdzID0gc3RyaW5ncztcbndvb2ZtYXJrLmdldFNlbGVjdGlvbiA9IGdldFNlbGVjdGlvbjtcbm1vZHVsZS5leHBvcnRzID0gd29vZm1hcms7XG4iXX0=
},{"./InputHistory":13,"./bindCommands":15,"./classes":19,"./getCommandHandler":22,"./getSurface":23,"./polyfills/getSelection":47,"./prompts/close":52,"./prompts/prompt":53,"./rememberSelection":56,"./renderers":57,"./setText":58,"./strings":59,"./xhrStub":61,"crossvent":6,"kanye":8,"local-storage":10}],61:[function(require,module,exports){
'use strict';

function xhrStub (options) {
  throw new Error('Woofmark is missing XHR configuration. Can\'t request ' + options.url);
}

module.exports = xhrStub;

},{}]},{},[60])(60)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93YXRjaGlmeS9ub2RlX21vZHVsZXMvYnJvd3NlcmlmeS9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL2J1bGxzZXllLmpzIiwibm9kZV9tb2R1bGVzL2J1bGxzZXllL25vZGVfbW9kdWxlcy9zZWxsL3NlbGwuanMiLCJub2RlX21vZHVsZXMvYnVsbHNleWUvdGFpbG9ybWFkZS5qcyIsIm5vZGVfbW9kdWxlcy9idWxsc2V5ZS90aHJvdHRsZS5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvbm9kZV9tb2R1bGVzL2N1c3RvbS1ldmVudC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2Nyb3NzdmVudC5qcyIsIm5vZGVfbW9kdWxlcy9jcm9zc3ZlbnQvc3JjL2V2ZW50bWFwLmpzIiwibm9kZV9tb2R1bGVzL2thbnllL2thbnllLmpzIiwibm9kZV9tb2R1bGVzL2thbnllL25vZGVfbW9kdWxlcy9zZWt0b3Ivc3JjL3Nla3Rvci5qcyIsIm5vZGVfbW9kdWxlcy9sb2NhbC1zdG9yYWdlL2xvY2FsLXN0b3JhZ2UuanMiLCJub2RlX21vZHVsZXMvbG9jYWwtc3RvcmFnZS9zdHViLmpzIiwibm9kZV9tb2R1bGVzL2xvY2FsLXN0b3JhZ2UvdHJhY2tpbmcuanMiLCJzcmMvSW5wdXRIaXN0b3J5LmpzIiwic3JjL0lucHV0U3RhdGUuanMiLCJzcmMvYmluZENvbW1hbmRzLmpzIiwic3JjL2Nhc3QuanMiLCJzcmMvY2h1bmtzL3BhcnNlTGlua0lucHV0LmpzIiwic3JjL2NodW5rcy90cmltLmpzIiwic3JjL2NsYXNzZXMuanMiLCJzcmMvZXh0ZW5kUmVnRXhwLmpzIiwic3JjL2ZpeEVPTC5qcyIsInNyYy9nZXRDb21tYW5kSGFuZGxlci5qcyIsInNyYy9nZXRTdXJmYWNlLmpzIiwic3JjL2dldFRleHQuanMiLCJzcmMvaHRtbC9IdG1sQ2h1bmtzLmpzIiwic3JjL2h0bWwvYmxvY2txdW90ZS5qcyIsInNyYy9odG1sL2JvbGRPckl0YWxpYy5qcyIsInNyYy9odG1sL2NvZGVibG9jay5qcyIsInNyYy9odG1sL2hlYWRpbmcuanMiLCJzcmMvaHRtbC9oci5qcyIsInNyYy9odG1sL2xpbmtPckltYWdlT3JBdHRhY2htZW50LmpzIiwic3JjL2h0bWwvbGlzdC5qcyIsInNyYy9odG1sL3dyYXBwaW5nLmpzIiwic3JjL2lzVmlzaWJsZUVsZW1lbnQuanMiLCJzcmMvbWFueS5qcyIsInNyYy9tYXJrZG93bi9NYXJrZG93bkNodW5rcy5qcyIsInNyYy9tYXJrZG93bi9ibG9ja3F1b3RlLmpzIiwic3JjL21hcmtkb3duL2JvbGRPckl0YWxpYy5qcyIsInNyYy9tYXJrZG93bi9jb2RlYmxvY2suanMiLCJzcmMvbWFya2Rvd24vaGVhZGluZy5qcyIsInNyYy9tYXJrZG93bi9oci5qcyIsInNyYy9tYXJrZG93bi9saW5rT3JJbWFnZU9yQXR0YWNobWVudC5qcyIsInNyYy9tYXJrZG93bi9saXN0LmpzIiwic3JjL21hcmtkb3duL3NldHRpbmdzLmpzIiwic3JjL21hcmtkb3duL3dyYXBwaW5nLmpzIiwic3JjL29uY2UuanMiLCJzcmMvcG9seWZpbGxzL2dldFNlbGVjdGlvbi5qcyIsInNyYy9wb2x5ZmlsbHMvZ2V0U2VsZWN0aW9uTnVsbE9wLmpzIiwic3JjL3BvbHlmaWxscy9nZXRTZWxlY3Rpb25SYXcuanMiLCJzcmMvcG9seWZpbGxzL2dldFNlbGVjdGlvblN5bnRoZXRpYy5qcyIsInNyYy9wb2x5ZmlsbHMvaXNIb3N0LmpzIiwic3JjL3Byb21wdHMvY2xvc2UuanMiLCJzcmMvcHJvbXB0cy9wcm9tcHQuanMiLCJzcmMvcHJvbXB0cy9yZW5kZXIuanMiLCJzcmMvcmFuZ2VUb1RleHRSYW5nZS5qcyIsInNyYy9yZW1lbWJlclNlbGVjdGlvbi5qcyIsInNyYy9yZW5kZXJlcnMuanMiLCJzcmMvc2V0VGV4dC5qcyIsInNyYy9zdHJpbmdzLmpzIiwic3JjL3dvb2ZtYXJrLmpzIiwic3JjL3hoclN0dWIuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25KQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeE1BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNuQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDVkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDM0lBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDZEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNaQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5UEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDakdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIHRhaWxvcm1hZGUgPSByZXF1aXJlKCcuL3RhaWxvcm1hZGUnKTtcblxuZnVuY3Rpb24gYnVsbHNleWUgKGVsLCB0YXJnZXQsIG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zO1xuICB2YXIgZG9tVGFyZ2V0ID0gdGFyZ2V0ICYmIHRhcmdldC50YWdOYW1lO1xuXG4gIGlmICghZG9tVGFyZ2V0ICYmIGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBvID0gdGFyZ2V0O1xuICB9XG4gIGlmICghZG9tVGFyZ2V0KSB7XG4gICAgdGFyZ2V0ID0gZWw7XG4gIH1cbiAgaWYgKCFvKSB7IG8gPSB7fTsgfVxuXG4gIHZhciBkZXN0cm95ZWQgPSBmYWxzZTtcbiAgdmFyIHRocm90dGxlZFdyaXRlID0gdGhyb3R0bGUod3JpdGUsIDMwKTtcbiAgdmFyIHRhaWxvck9wdGlvbnMgPSB7IHVwZGF0ZTogby5hdXRvdXBkYXRlVG9DYXJldCAhPT0gZmFsc2UgJiYgdXBkYXRlIH07XG4gIHZhciB0YWlsb3IgPSBvLmNhcmV0ICYmIHRhaWxvcm1hZGUodGFyZ2V0LCB0YWlsb3JPcHRpb25zKTtcblxuICB3cml0ZSgpO1xuXG4gIGlmIChvLnRyYWNraW5nICE9PSBmYWxzZSkge1xuICAgIGNyb3NzdmVudC5hZGQod2luZG93LCAncmVzaXplJywgdGhyb3R0bGVkV3JpdGUpO1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICByZWFkOiByZWFkTnVsbCxcbiAgICByZWZyZXNoOiB3cml0ZSxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHNsZWVwOiBzbGVlcFxuICB9O1xuXG4gIGZ1bmN0aW9uIHNsZWVwICgpIHtcbiAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gdHJ1ZTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWROdWxsICgpIHsgcmV0dXJuIHJlYWQoKTsgfVxuXG4gIGZ1bmN0aW9uIHJlYWQgKHJlYWRpbmdzKSB7XG4gICAgdmFyIGJvdW5kcyA9IHRhcmdldC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB2YXIgc2Nyb2xsVG9wID0gZG9jdW1lbnQuYm9keS5zY3JvbGxUb3AgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LnNjcm9sbFRvcDtcbiAgICBpZiAodGFpbG9yKSB7XG4gICAgICByZWFkaW5ncyA9IHRhaWxvci5yZWFkKCk7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiAocmVhZGluZ3MuYWJzb2x1dGUgPyAwIDogYm91bmRzLmxlZnQpICsgcmVhZGluZ3MueCxcbiAgICAgICAgeTogKHJlYWRpbmdzLmFic29sdXRlID8gMCA6IGJvdW5kcy50b3ApICsgc2Nyb2xsVG9wICsgcmVhZGluZ3MueSArIDIwXG4gICAgICB9O1xuICAgIH1cbiAgICByZXR1cm4ge1xuICAgICAgeDogYm91bmRzLmxlZnQsXG4gICAgICB5OiBib3VuZHMudG9wICsgc2Nyb2xsVG9wXG4gICAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVwZGF0ZSAocmVhZGluZ3MpIHtcbiAgICB3cml0ZShyZWFkaW5ncyk7XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZSAocmVhZGluZ3MpIHtcbiAgICBpZiAoZGVzdHJveWVkKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0J1bGxzZXllIGNhblxcJ3QgcmVmcmVzaCBhZnRlciBiZWluZyBkZXN0cm95ZWQuIENyZWF0ZSBhbm90aGVyIGluc3RhbmNlIGluc3RlYWQuJyk7XG4gICAgfVxuICAgIGlmICh0YWlsb3IgJiYgIXJlYWRpbmdzKSB7XG4gICAgICB0YWlsb3JPcHRpb25zLnNsZWVwaW5nID0gZmFsc2U7XG4gICAgICB0YWlsb3IucmVmcmVzaCgpOyByZXR1cm47XG4gICAgfVxuICAgIHZhciBwID0gcmVhZChyZWFkaW5ncyk7XG4gICAgaWYgKCF0YWlsb3IgJiYgdGFyZ2V0ICE9PSBlbCkge1xuICAgICAgcC55ICs9IHRhcmdldC5vZmZzZXRIZWlnaHQ7XG4gICAgfVxuICAgIGVsLnN0eWxlLmxlZnQgPSBwLnggKyAncHgnO1xuICAgIGVsLnN0eWxlLnRvcCA9IHAueSArICdweCc7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBpZiAodGFpbG9yKSB7IHRhaWxvci5kZXN0cm95KCk7IH1cbiAgICBjcm9zc3ZlbnQucmVtb3ZlKHdpbmRvdywgJ3Jlc2l6ZScsIHRocm90dGxlZFdyaXRlKTtcbiAgICBkZXN0cm95ZWQgPSB0cnVlO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYnVsbHNleWU7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBnZXQgPSBlYXN5R2V0O1xudmFyIHNldCA9IGVhc3lTZXQ7XG5cbmlmIChkb2N1bWVudC5zZWxlY3Rpb24gJiYgZG9jdW1lbnQuc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKSB7XG4gIGdldCA9IGhhcmRHZXQ7XG4gIHNldCA9IGhhcmRTZXQ7XG59XG5cbmZ1bmN0aW9uIGVhc3lHZXQgKGVsKSB7XG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IGVsLnNlbGVjdGlvblN0YXJ0LFxuICAgIGVuZDogZWwuc2VsZWN0aW9uRW5kXG4gIH07XG59XG5cbmZ1bmN0aW9uIGhhcmRHZXQgKGVsKSB7XG4gIHZhciBhY3RpdmUgPSBkb2N1bWVudC5hY3RpdmVFbGVtZW50O1xuICBpZiAoYWN0aXZlICE9PSBlbCkge1xuICAgIGVsLmZvY3VzKCk7XG4gIH1cblxuICB2YXIgcmFuZ2UgPSBkb2N1bWVudC5zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIGJvb2ttYXJrID0gcmFuZ2UuZ2V0Qm9va21hcmsoKTtcbiAgdmFyIG9yaWdpbmFsID0gZWwudmFsdWU7XG4gIHZhciBtYXJrZXIgPSBnZXRVbmlxdWVNYXJrZXIob3JpZ2luYWwpO1xuICB2YXIgcGFyZW50ID0gcmFuZ2UucGFyZW50RWxlbWVudCgpO1xuICBpZiAocGFyZW50ID09PSBudWxsIHx8ICFpbnB1dHMocGFyZW50KSkge1xuICAgIHJldHVybiByZXN1bHQoMCwgMCk7XG4gIH1cbiAgcmFuZ2UudGV4dCA9IG1hcmtlciArIHJhbmdlLnRleHQgKyBtYXJrZXI7XG5cbiAgdmFyIGNvbnRlbnRzID0gZWwudmFsdWU7XG5cbiAgZWwudmFsdWUgPSBvcmlnaW5hbDtcbiAgcmFuZ2UubW92ZVRvQm9va21hcmsoYm9va21hcmspO1xuICByYW5nZS5zZWxlY3QoKTtcblxuICByZXR1cm4gcmVzdWx0KGNvbnRlbnRzLmluZGV4T2YobWFya2VyKSwgY29udGVudHMubGFzdEluZGV4T2YobWFya2VyKSAtIG1hcmtlci5sZW5ndGgpO1xuXG4gIGZ1bmN0aW9uIHJlc3VsdCAoc3RhcnQsIGVuZCkge1xuICAgIGlmIChhY3RpdmUgIT09IGVsKSB7IC8vIGRvbid0IGRpc3J1cHQgcHJlLWV4aXN0aW5nIHN0YXRlXG4gICAgICBpZiAoYWN0aXZlKSB7XG4gICAgICAgIGFjdGl2ZS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWwuYmx1cigpO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4geyBzdGFydDogc3RhcnQsIGVuZDogZW5kIH07XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0VW5pcXVlTWFya2VyIChjb250ZW50cykge1xuICB2YXIgbWFya2VyO1xuICBkbyB7XG4gICAgbWFya2VyID0gJ0BAbWFya2VyLicgKyBNYXRoLnJhbmRvbSgpICogbmV3IERhdGUoKTtcbiAgfSB3aGlsZSAoY29udGVudHMuaW5kZXhPZihtYXJrZXIpICE9PSAtMSk7XG4gIHJldHVybiBtYXJrZXI7XG59XG5cbmZ1bmN0aW9uIGlucHV0cyAoZWwpIHtcbiAgcmV0dXJuICgoZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyAmJiBlbC50eXBlID09PSAndGV4dCcpIHx8IGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpO1xufVxuXG5mdW5jdGlvbiBlYXN5U2V0IChlbCwgcCkge1xuICBlbC5zZWxlY3Rpb25TdGFydCA9IHBhcnNlKGVsLCBwLnN0YXJ0KTtcbiAgZWwuc2VsZWN0aW9uRW5kID0gcGFyc2UoZWwsIHAuZW5kKTtcbn1cblxuZnVuY3Rpb24gaGFyZFNldCAoZWwsIHApIHtcbiAgdmFyIHJhbmdlID0gZWwuY3JlYXRlVGV4dFJhbmdlKCk7XG5cbiAgaWYgKHAuc3RhcnQgPT09ICdlbmQnICYmIHAuZW5kID09PSAnZW5kJykge1xuICAgIHJhbmdlLmNvbGxhcHNlKGZhbHNlKTtcbiAgICByYW5nZS5zZWxlY3QoKTtcbiAgfSBlbHNlIHtcbiAgICByYW5nZS5jb2xsYXBzZSh0cnVlKTtcbiAgICByYW5nZS5tb3ZlRW5kKCdjaGFyYWN0ZXInLCBwYXJzZShlbCwgcC5lbmQpKTtcbiAgICByYW5nZS5tb3ZlU3RhcnQoJ2NoYXJhY3RlcicsIHBhcnNlKGVsLCBwLnN0YXJ0KSk7XG4gICAgcmFuZ2Uuc2VsZWN0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGFyc2UgKGVsLCB2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT09ICdlbmQnID8gZWwudmFsdWUubGVuZ3RoIDogdmFsdWUgfHwgMDtcbn1cblxuZnVuY3Rpb24gc2VsbCAoZWwsIHApIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICBzZXQoZWwsIHApO1xuICB9XG4gIHJldHVybiBnZXQoZWwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNlbGw7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBzZWxsID0gcmVxdWlyZSgnc2VsbCcpO1xudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIHRocm90dGxlID0gcmVxdWlyZSgnLi90aHJvdHRsZScpO1xudmFyIHByb3BzID0gW1xuICAnZGlyZWN0aW9uJyxcbiAgJ2JveFNpemluZycsXG4gICd3aWR0aCcsXG4gICdoZWlnaHQnLFxuICAnb3ZlcmZsb3dYJyxcbiAgJ292ZXJmbG93WScsXG4gICdib3JkZXJUb3BXaWR0aCcsXG4gICdib3JkZXJSaWdodFdpZHRoJyxcbiAgJ2JvcmRlckJvdHRvbVdpZHRoJyxcbiAgJ2JvcmRlckxlZnRXaWR0aCcsXG4gICdwYWRkaW5nVG9wJyxcbiAgJ3BhZGRpbmdSaWdodCcsXG4gICdwYWRkaW5nQm90dG9tJyxcbiAgJ3BhZGRpbmdMZWZ0JyxcbiAgJ2ZvbnRTdHlsZScsXG4gICdmb250VmFyaWFudCcsXG4gICdmb250V2VpZ2h0JyxcbiAgJ2ZvbnRTdHJldGNoJyxcbiAgJ2ZvbnRTaXplJyxcbiAgJ2ZvbnRTaXplQWRqdXN0JyxcbiAgJ2xpbmVIZWlnaHQnLFxuICAnZm9udEZhbWlseScsXG4gICd0ZXh0QWxpZ24nLFxuICAndGV4dFRyYW5zZm9ybScsXG4gICd0ZXh0SW5kZW50JyxcbiAgJ3RleHREZWNvcmF0aW9uJyxcbiAgJ2xldHRlclNwYWNpbmcnLFxuICAnd29yZFNwYWNpbmcnXG5dO1xudmFyIHdpbiA9IGdsb2JhbDtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBmZiA9IHdpbi5tb3pJbm5lclNjcmVlblggIT09IG51bGwgJiYgd2luLm1veklubmVyU2NyZWVuWCAhPT0gdm9pZCAwO1xuXG5mdW5jdGlvbiB0YWlsb3JtYWRlIChlbCwgb3B0aW9ucykge1xuICB2YXIgdGV4dElucHV0ID0gZWwudGFnTmFtZSA9PT0gJ0lOUFVUJyB8fCBlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnO1xuICB2YXIgdGhyb3R0bGVkUmVmcmVzaCA9IHRocm90dGxlKHJlZnJlc2gsIDMwKTtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuXG4gIGJpbmQoKTtcblxuICByZXR1cm4ge1xuICAgIHJlYWQ6IHJlYWRQb3NpdGlvbixcbiAgICByZWZyZXNoOiB0aHJvdHRsZWRSZWZyZXNoLFxuICAgIGRlc3Ryb3k6IGRlc3Ryb3lcbiAgfTtcblxuICBmdW5jdGlvbiBub29wICgpIHt9XG4gIGZ1bmN0aW9uIHJlYWRQb3NpdGlvbiAoKSB7IHJldHVybiAodGV4dElucHV0ID8gY29vcmRzVGV4dCA6IGNvb3Jkc0hUTUwpKCk7IH1cblxuICBmdW5jdGlvbiByZWZyZXNoICgpIHtcbiAgICBpZiAoby5zbGVlcGluZykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICByZXR1cm4gKG8udXBkYXRlIHx8IG5vb3ApKHJlYWRQb3NpdGlvbigpKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvb3Jkc1RleHQgKCkge1xuICAgIHZhciBwID0gc2VsbChlbCk7XG4gICAgdmFyIGNvbnRleHQgPSBwcmVwYXJlKCk7XG4gICAgdmFyIHJlYWRpbmdzID0gcmVhZFRleHRDb29yZHMoY29udGV4dCwgcC5zdGFydCk7XG4gICAgZG9jLmJvZHkucmVtb3ZlQ2hpbGQoY29udGV4dC5taXJyb3IpO1xuICAgIHJldHVybiByZWFkaW5ncztcbiAgfVxuXG4gIGZ1bmN0aW9uIGNvb3Jkc0hUTUwgKCkge1xuICAgIHZhciBzZWwgPSAoby5nZXRTZWxlY3Rpb24gfHwgd2luLmdldFNlbGVjdGlvbikoKTtcbiAgICBpZiAoc2VsLnJhbmdlQ291bnQpIHtcbiAgICAgIHZhciByYW5nZSA9IHNlbC5nZXRSYW5nZUF0KDApO1xuICAgICAgdmFyIG5lZWRzVG9Xb3JrQXJvdW5kTmV3bGluZUJ1ZyA9IHJhbmdlLnN0YXJ0Q29udGFpbmVyLm5vZGVOYW1lID09PSAnUCcgJiYgcmFuZ2Uuc3RhcnRPZmZzZXQgPT09IDA7XG4gICAgICBpZiAobmVlZHNUb1dvcmtBcm91bmROZXdsaW5lQnVnKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgeDogcmFuZ2Uuc3RhcnRDb250YWluZXIub2Zmc2V0TGVmdCxcbiAgICAgICAgICB5OiByYW5nZS5zdGFydENvbnRhaW5lci5vZmZzZXRUb3AsXG4gICAgICAgICAgYWJzb2x1dGU6IHRydWVcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5nZS5nZXRDbGllbnRSZWN0cykge1xuICAgICAgICB2YXIgcmVjdHMgPSByYW5nZS5nZXRDbGllbnRSZWN0cygpO1xuICAgICAgICBpZiAocmVjdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICB4OiByZWN0c1swXS5sZWZ0LFxuICAgICAgICAgICAgeTogcmVjdHNbMF0udG9wLFxuICAgICAgICAgICAgYWJzb2x1dGU6IHRydWVcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB7IHg6IDAsIHk6IDAgfTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRUZXh0Q29vcmRzIChjb250ZXh0LCBwKSB7XG4gICAgdmFyIHJlc3QgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICAgIHZhciBtaXJyb3IgPSBjb250ZXh0Lm1pcnJvcjtcbiAgICB2YXIgY29tcHV0ZWQgPSBjb250ZXh0LmNvbXB1dGVkO1xuXG4gICAgd3JpdGUobWlycm9yLCByZWFkKGVsKS5zdWJzdHJpbmcoMCwgcCkpO1xuXG4gICAgaWYgKGVsLnRhZ05hbWUgPT09ICdJTlBVVCcpIHtcbiAgICAgIG1pcnJvci50ZXh0Q29udGVudCA9IG1pcnJvci50ZXh0Q29udGVudC5yZXBsYWNlKC9cXHMvZywgJ1xcdTAwYTAnKTtcbiAgICB9XG5cbiAgICB3cml0ZShyZXN0LCByZWFkKGVsKS5zdWJzdHJpbmcocCkgfHwgJy4nKTtcblxuICAgIG1pcnJvci5hcHBlbmRDaGlsZChyZXN0KTtcblxuICAgIHJldHVybiB7XG4gICAgICB4OiByZXN0Lm9mZnNldExlZnQgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyTGVmdFdpZHRoJ10pLFxuICAgICAgeTogcmVzdC5vZmZzZXRUb3AgKyBwYXJzZUludChjb21wdXRlZFsnYm9yZGVyVG9wV2lkdGgnXSlcbiAgICB9O1xuICB9XG5cbiAgZnVuY3Rpb24gcmVhZCAoZWwpIHtcbiAgICByZXR1cm4gdGV4dElucHV0ID8gZWwudmFsdWUgOiBlbC5pbm5lckhUTUw7XG4gIH1cblxuICBmdW5jdGlvbiBwcmVwYXJlICgpIHtcbiAgICB2YXIgY29tcHV0ZWQgPSB3aW4uZ2V0Q29tcHV0ZWRTdHlsZSA/IGdldENvbXB1dGVkU3R5bGUoZWwpIDogZWwuY3VycmVudFN0eWxlO1xuICAgIHZhciBtaXJyb3IgPSBkb2MuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgdmFyIHN0eWxlID0gbWlycm9yLnN0eWxlO1xuXG4gICAgZG9jLmJvZHkuYXBwZW5kQ2hpbGQobWlycm9yKTtcblxuICAgIGlmIChlbC50YWdOYW1lICE9PSAnSU5QVVQnKSB7XG4gICAgICBzdHlsZS53b3JkV3JhcCA9ICdicmVhay13b3JkJztcbiAgICB9XG4gICAgc3R5bGUud2hpdGVTcGFjZSA9ICdwcmUtd3JhcCc7XG4gICAgc3R5bGUucG9zaXRpb24gPSAnYWJzb2x1dGUnO1xuICAgIHN0eWxlLnZpc2liaWxpdHkgPSAnaGlkZGVuJztcbiAgICBwcm9wcy5mb3JFYWNoKGNvcHkpO1xuXG4gICAgaWYgKGZmKSB7XG4gICAgICBzdHlsZS53aWR0aCA9IHBhcnNlSW50KGNvbXB1dGVkLndpZHRoKSAtIDIgKyAncHgnO1xuICAgICAgaWYgKGVsLnNjcm9sbEhlaWdodCA+IHBhcnNlSW50KGNvbXB1dGVkLmhlaWdodCkpIHtcbiAgICAgICAgc3R5bGUub3ZlcmZsb3dZID0gJ3Njcm9sbCc7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0eWxlLm92ZXJmbG93ID0gJ2hpZGRlbic7XG4gICAgfVxuICAgIHJldHVybiB7IG1pcnJvcjogbWlycm9yLCBjb21wdXRlZDogY29tcHV0ZWQgfTtcblxuICAgIGZ1bmN0aW9uIGNvcHkgKHByb3ApIHtcbiAgICAgIHN0eWxlW3Byb3BdID0gY29tcHV0ZWRbcHJvcF07XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKGVsLCB2YWx1ZSkge1xuICAgIGlmICh0ZXh0SW5wdXQpIHtcbiAgICAgIGVsLnRleHRDb250ZW50ID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmlubmVySFRNTCA9IHZhbHVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmQgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShlbCwgJ2tleWRvd24nLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAna2V5dXAnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnaW5wdXQnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAncGFzdGUnLCB0aHJvdHRsZWRSZWZyZXNoKTtcbiAgICBjcm9zc3ZlbnRbb3BdKGVsLCAnY2hhbmdlJywgdGhyb3R0bGVkUmVmcmVzaCk7XG4gIH1cblxuICBmdW5jdGlvbiBkZXN0cm95ICgpIHtcbiAgICBiaW5kKHRydWUpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGFpbG9ybWFkZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5aWRXeHNjMlY1WlM5MFlXbHNiM0p0WVdSbExtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRU0lzSW1acGJHVWlPaUpuWlc1bGNtRjBaV1F1YW5NaUxDSnpiM1Z5WTJWU2IyOTBJam9pSWl3aWMyOTFjbU5sYzBOdmJuUmxiblFpT2xzaUozVnpaU0J6ZEhKcFkzUW5PMXh1WEc1MllYSWdjMlZzYkNBOUlISmxjWFZwY21Vb0ozTmxiR3duS1R0Y2JuWmhjaUJqY205emMzWmxiblFnUFNCeVpYRjFhWEpsS0NkamNtOXpjM1psYm5RbktUdGNiblpoY2lCMGFISnZkSFJzWlNBOUlISmxjWFZwY21Vb0p5NHZkR2h5YjNSMGJHVW5LVHRjYm5aaGNpQndjbTl3Y3lBOUlGdGNiaUFnSjJScGNtVmpkR2x2Ymljc1hHNGdJQ2RpYjNoVGFYcHBibWNuTEZ4dUlDQW5kMmxrZEdnbkxGeHVJQ0FuYUdWcFoyaDBKeXhjYmlBZ0oyOTJaWEptYkc5M1dDY3NYRzRnSUNkdmRtVnlabXh2ZDFrbkxGeHVJQ0FuWW05eVpHVnlWRzl3VjJsa2RHZ25MRnh1SUNBblltOXlaR1Z5VW1sbmFIUlhhV1IwYUNjc1hHNGdJQ2RpYjNKa1pYSkNiM1IwYjIxWGFXUjBhQ2NzWEc0Z0lDZGliM0prWlhKTVpXWjBWMmxrZEdnbkxGeHVJQ0FuY0dGa1pHbHVaMVJ2Y0Njc1hHNGdJQ2R3WVdSa2FXNW5VbWxuYUhRbkxGeHVJQ0FuY0dGa1pHbHVaMEp2ZEhSdmJTY3NYRzRnSUNkd1lXUmthVzVuVEdWbWRDY3NYRzRnSUNkbWIyNTBVM1I1YkdVbkxGeHVJQ0FuWm05dWRGWmhjbWxoYm5RbkxGeHVJQ0FuWm05dWRGZGxhV2RvZENjc1hHNGdJQ2RtYjI1MFUzUnlaWFJqYUNjc1hHNGdJQ2RtYjI1MFUybDZaU2NzWEc0Z0lDZG1iMjUwVTJsNlpVRmthblZ6ZENjc1hHNGdJQ2RzYVc1bFNHVnBaMmgwSnl4Y2JpQWdKMlp2Ym5SR1lXMXBiSGtuTEZ4dUlDQW5kR1Y0ZEVGc2FXZHVKeXhjYmlBZ0ozUmxlSFJVY21GdWMyWnZjbTBuTEZ4dUlDQW5kR1Y0ZEVsdVpHVnVkQ2NzWEc0Z0lDZDBaWGgwUkdWamIzSmhkR2x2Ymljc1hHNGdJQ2RzWlhSMFpYSlRjR0ZqYVc1bkp5eGNiaUFnSjNkdmNtUlRjR0ZqYVc1bkoxeHVYVHRjYm5aaGNpQjNhVzRnUFNCbmJHOWlZV3c3WEc1MllYSWdaRzlqSUQwZ1pHOWpkVzFsYm5RN1hHNTJZWElnWm1ZZ1BTQjNhVzR1Ylc5NlNXNXVaWEpUWTNKbFpXNVlJQ0U5UFNCdWRXeHNJQ1ltSUhkcGJpNXRiM3BKYm01bGNsTmpjbVZsYmxnZ0lUMDlJSFp2YVdRZ01EdGNibHh1Wm5WdVkzUnBiMjRnZEdGcGJHOXliV0ZrWlNBb1pXd3NJRzl3ZEdsdmJuTXBJSHRjYmlBZ2RtRnlJSFJsZUhSSmJuQjFkQ0E5SUdWc0xuUmhaMDVoYldVZ1BUMDlJQ2RKVGxCVlZDY2dmSHdnWld3dWRHRm5UbUZ0WlNBOVBUMGdKMVJGV0ZSQlVrVkJKenRjYmlBZ2RtRnlJSFJvY205MGRHeGxaRkpsWm5KbGMyZ2dQU0IwYUhKdmRIUnNaU2h5WldaeVpYTm9MQ0F6TUNrN1hHNGdJSFpoY2lCdklEMGdiM0IwYVc5dWN5QjhmQ0I3ZlR0Y2JseHVJQ0JpYVc1a0tDazdYRzVjYmlBZ2NtVjBkWEp1SUh0Y2JpQWdJQ0J5WldGa09pQnlaV0ZrVUc5emFYUnBiMjRzWEc0Z0lDQWdjbVZtY21WemFEb2dkR2h5YjNSMGJHVmtVbVZtY21WemFDeGNiaUFnSUNCa1pYTjBjbTk1T2lCa1pYTjBjbTk1WEc0Z0lIMDdYRzVjYmlBZ1puVnVZM1JwYjI0Z2JtOXZjQ0FvS1NCN2ZWeHVJQ0JtZFc1amRHbHZiaUJ5WldGa1VHOXphWFJwYjI0Z0tDa2dleUJ5WlhSMWNtNGdLSFJsZUhSSmJuQjFkQ0EvSUdOdmIzSmtjMVJsZUhRZ09pQmpiMjl5WkhOSVZFMU1LU2dwT3lCOVhHNWNiaUFnWm5WdVkzUnBiMjRnY21WbWNtVnphQ0FvS1NCN1hHNGdJQ0FnYVdZZ0tHOHVjMnhsWlhCcGJtY3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJQ2h2TG5Wd1pHRjBaU0I4ZkNCdWIyOXdLU2h5WldGa1VHOXphWFJwYjI0b0tTazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqYjI5eVpITlVaWGgwSUNncElIdGNiaUFnSUNCMllYSWdjQ0E5SUhObGJHd29aV3dwTzF4dUlDQWdJSFpoY2lCamIyNTBaWGgwSUQwZ2NISmxjR0Z5WlNncE8xeHVJQ0FnSUhaaGNpQnlaV0ZrYVc1bmN5QTlJSEpsWVdSVVpYaDBRMjl2Y21SektHTnZiblJsZUhRc0lIQXVjM1JoY25RcE8xeHVJQ0FnSUdSdll5NWliMlI1TG5KbGJXOTJaVU5vYVd4a0tHTnZiblJsZUhRdWJXbHljbTl5S1R0Y2JpQWdJQ0J5WlhSMWNtNGdjbVZoWkdsdVozTTdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqYjI5eVpITklWRTFNSUNncElIdGNiaUFnSUNCMllYSWdjMlZzSUQwZ0tHOHVaMlYwVTJWc1pXTjBhVzl1SUh4OElIZHBiaTVuWlhSVFpXeGxZM1JwYjI0cEtDazdYRzRnSUNBZ2FXWWdLSE5sYkM1eVlXNW5aVU52ZFc1MEtTQjdYRzRnSUNBZ0lDQjJZWElnY21GdVoyVWdQU0J6Wld3dVoyVjBVbUZ1WjJWQmRDZ3dLVHRjYmlBZ0lDQWdJSFpoY2lCdVpXVmtjMVJ2VjI5eWEwRnliM1Z1WkU1bGQyeHBibVZDZFdjZ1BTQnlZVzVuWlM1emRHRnlkRU52Ym5SaGFXNWxjaTV1YjJSbFRtRnRaU0E5UFQwZ0oxQW5JQ1ltSUhKaGJtZGxMbk4wWVhKMFQyWm1jMlYwSUQwOVBTQXdPMXh1SUNBZ0lDQWdhV1lnS0c1bFpXUnpWRzlYYjNKclFYSnZkVzVrVG1WM2JHbHVaVUoxWnlrZ2UxeHVJQ0FnSUNBZ0lDQnlaWFIxY200Z2UxeHVJQ0FnSUNBZ0lDQWdJSGc2SUhKaGJtZGxMbk4wWVhKMFEyOXVkR0ZwYm1WeUxtOW1abk5sZEV4bFpuUXNYRzRnSUNBZ0lDQWdJQ0FnZVRvZ2NtRnVaMlV1YzNSaGNuUkRiMjUwWVdsdVpYSXViMlptYzJWMFZHOXdMRnh1SUNBZ0lDQWdJQ0FnSUdGaWMyOXNkWFJsT2lCMGNuVmxYRzRnSUNBZ0lDQWdJSDA3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JwWmlBb2NtRnVaMlV1WjJWMFEyeHBaVzUwVW1WamRITXBJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlISmxZM1J6SUQwZ2NtRnVaMlV1WjJWMFEyeHBaVzUwVW1WamRITW9LVHRjYmlBZ0lDQWdJQ0FnYVdZZ0tISmxZM1J6TG14bGJtZDBhQ0ErSURBcElIdGNiaUFnSUNBZ0lDQWdJQ0J5WlhSMWNtNGdlMXh1SUNBZ0lDQWdJQ0FnSUNBZ2VEb2djbVZqZEhOYk1GMHViR1ZtZEN4Y2JpQWdJQ0FnSUNBZ0lDQWdJSGs2SUhKbFkzUnpXekJkTG5SdmNDeGNiaUFnSUNBZ0lDQWdJQ0FnSUdGaWMyOXNkWFJsT2lCMGNuVmxYRzRnSUNBZ0lDQWdJQ0FnZlR0Y2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdleUI0T2lBd0xDQjVPaUF3SUgwN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQnlaV0ZrVkdWNGRFTnZiM0prY3lBb1kyOXVkR1Y0ZEN3Z2NDa2dlMXh1SUNBZ0lIWmhjaUJ5WlhOMElEMGdaRzlqTG1OeVpXRjBaVVZzWlcxbGJuUW9KM053WVc0bktUdGNiaUFnSUNCMllYSWdiV2x5Y205eUlEMGdZMjl1ZEdWNGRDNXRhWEp5YjNJN1hHNGdJQ0FnZG1GeUlHTnZiWEIxZEdWa0lEMGdZMjl1ZEdWNGRDNWpiMjF3ZFhSbFpEdGNibHh1SUNBZ0lIZHlhWFJsS0cxcGNuSnZjaXdnY21WaFpDaGxiQ2t1YzNWaWMzUnlhVzVuS0RBc0lIQXBLVHRjYmx4dUlDQWdJR2xtSUNobGJDNTBZV2RPWVcxbElEMDlQU0FuU1U1UVZWUW5LU0I3WEc0Z0lDQWdJQ0J0YVhKeWIzSXVkR1Y0ZEVOdmJuUmxiblFnUFNCdGFYSnliM0l1ZEdWNGRFTnZiblJsYm5RdWNtVndiR0ZqWlNndlhGeHpMMmNzSUNkY1hIVXdNR0V3SnlrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnZDNKcGRHVW9jbVZ6ZEN3Z2NtVmhaQ2hsYkNrdWMzVmljM1J5YVc1bktIQXBJSHg4SUNjdUp5azdYRzVjYmlBZ0lDQnRhWEp5YjNJdVlYQndaVzVrUTJocGJHUW9jbVZ6ZENrN1hHNWNiaUFnSUNCeVpYUjFjbTRnZTF4dUlDQWdJQ0FnZURvZ2NtVnpkQzV2Wm1aelpYUk1aV1owSUNzZ2NHRnljMlZKYm5Rb1kyOXRjSFYwWldSYkoySnZjbVJsY2t4bFpuUlhhV1IwYUNkZEtTeGNiaUFnSUNBZ0lIazZJSEpsYzNRdWIyWm1jMlYwVkc5d0lDc2djR0Z5YzJWSmJuUW9ZMjl0Y0hWMFpXUmJKMkp2Y21SbGNsUnZjRmRwWkhSb0oxMHBYRzRnSUNBZ2ZUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJSEpsWVdRZ0tHVnNLU0I3WEc0Z0lDQWdjbVYwZFhKdUlIUmxlSFJKYm5CMWRDQS9JR1ZzTG5aaGJIVmxJRG9nWld3dWFXNXVaWEpJVkUxTU8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdjSEpsY0dGeVpTQW9LU0I3WEc0Z0lDQWdkbUZ5SUdOdmJYQjFkR1ZrSUQwZ2QybHVMbWRsZEVOdmJYQjFkR1ZrVTNSNWJHVWdQeUJuWlhSRGIyMXdkWFJsWkZOMGVXeGxLR1ZzS1NBNklHVnNMbU4xY25KbGJuUlRkSGxzWlR0Y2JpQWdJQ0IyWVhJZ2JXbHljbTl5SUQwZ1pHOWpMbU55WldGMFpVVnNaVzFsYm5Rb0oyUnBkaWNwTzF4dUlDQWdJSFpoY2lCemRIbHNaU0E5SUcxcGNuSnZjaTV6ZEhsc1pUdGNibHh1SUNBZ0lHUnZZeTVpYjJSNUxtRndjR1Z1WkVOb2FXeGtLRzFwY25KdmNpazdYRzVjYmlBZ0lDQnBaaUFvWld3dWRHRm5UbUZ0WlNBaFBUMGdKMGxPVUZWVUp5a2dlMXh1SUNBZ0lDQWdjM1I1YkdVdWQyOXlaRmR5WVhBZ1BTQW5ZbkpsWVdzdGQyOXlaQ2M3WEc0Z0lDQWdmVnh1SUNBZ0lITjBlV3hsTG5kb2FYUmxVM0JoWTJVZ1BTQW5jSEpsTFhkeVlYQW5PMXh1SUNBZ0lITjBlV3hsTG5CdmMybDBhVzl1SUQwZ0oyRmljMjlzZFhSbEp6dGNiaUFnSUNCemRIbHNaUzUyYVhOcFltbHNhWFI1SUQwZ0oyaHBaR1JsYmljN1hHNGdJQ0FnY0hKdmNITXVabTl5UldGamFDaGpiM0I1S1R0Y2JseHVJQ0FnSUdsbUlDaG1aaWtnZTF4dUlDQWdJQ0FnYzNSNWJHVXVkMmxrZEdnZ1BTQndZWEp6WlVsdWRDaGpiMjF3ZFhSbFpDNTNhV1IwYUNrZ0xTQXlJQ3NnSjNCNEp6dGNiaUFnSUNBZ0lHbG1JQ2hsYkM1elkzSnZiR3hJWldsbmFIUWdQaUJ3WVhKelpVbHVkQ2hqYjIxd2RYUmxaQzVvWldsbmFIUXBLU0I3WEc0Z0lDQWdJQ0FnSUhOMGVXeGxMbTkyWlhKbWJHOTNXU0E5SUNkelkzSnZiR3duTzF4dUlDQWdJQ0FnZlZ4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQnpkSGxzWlM1dmRtVnlabXh2ZHlBOUlDZG9hV1JrWlc0bk8xeHVJQ0FnSUgxY2JpQWdJQ0J5WlhSMWNtNGdleUJ0YVhKeWIzSTZJRzFwY25KdmNpd2dZMjl0Y0hWMFpXUTZJR052YlhCMWRHVmtJSDA3WEc1Y2JpQWdJQ0JtZFc1amRHbHZiaUJqYjNCNUlDaHdjbTl3S1NCN1hHNGdJQ0FnSUNCemRIbHNaVnR3Y205d1hTQTlJR052YlhCMWRHVmtXM0J5YjNCZE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlIZHlhWFJsSUNobGJDd2dkbUZzZFdVcElIdGNiaUFnSUNCcFppQW9kR1Y0ZEVsdWNIVjBLU0I3WEc0Z0lDQWdJQ0JsYkM1MFpYaDBRMjl1ZEdWdWRDQTlJSFpoYkhWbE8xeHVJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0JsYkM1cGJtNWxja2hVVFV3Z1BTQjJZV3gxWlR0Y2JpQWdJQ0I5WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCaWFXNWtJQ2h5WlcxdmRtVXBJSHRjYmlBZ0lDQjJZWElnYjNBZ1BTQnlaVzF2ZG1VZ1B5QW5jbVZ0YjNabEp5QTZJQ2RoWkdRbk8xeHVJQ0FnSUdOeWIzTnpkbVZ1ZEZ0dmNGMG9aV3dzSUNkclpYbGtiM2R1Snl3Z2RHaHliM1IwYkdWa1VtVm1jbVZ6YUNrN1hHNGdJQ0FnWTNKdmMzTjJaVzUwVzI5d1hTaGxiQ3dnSjJ0bGVYVndKeXdnZEdoeWIzUjBiR1ZrVW1WbWNtVnphQ2s3WEc0Z0lDQWdZM0p2YzNOMlpXNTBXMjl3WFNobGJDd2dKMmx1Y0hWMEp5d2dkR2h5YjNSMGJHVmtVbVZtY21WemFDazdYRzRnSUNBZ1kzSnZjM04yWlc1MFcyOXdYU2hsYkN3Z0ozQmhjM1JsSnl3Z2RHaHliM1IwYkdWa1VtVm1jbVZ6YUNrN1hHNGdJQ0FnWTNKdmMzTjJaVzUwVzI5d1hTaGxiQ3dnSjJOb1lXNW5aU2NzSUhSb2NtOTBkR3hsWkZKbFpuSmxjMmdwTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1pHVnpkSEp2ZVNBb0tTQjdYRzRnSUNBZ1ltbHVaQ2gwY25WbEtUdGNiaUFnZlZ4dWZWeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJSFJoYVd4dmNtMWhaR1U3WEc0aVhYMD0iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRocm90dGxlIChmbiwgYm91bmRhcnkpIHtcbiAgdmFyIGxhc3QgPSAtSW5maW5pdHk7XG4gIHZhciB0aW1lcjtcbiAgcmV0dXJuIGZ1bmN0aW9uIGJvdW5jZWQgKCkge1xuICAgIGlmICh0aW1lcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB1bmJvdW5kKCk7XG5cbiAgICBmdW5jdGlvbiB1bmJvdW5kICgpIHtcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcik7XG4gICAgICB0aW1lciA9IG51bGw7XG4gICAgICB2YXIgbmV4dCA9IGxhc3QgKyBib3VuZGFyeTtcbiAgICAgIHZhciBub3cgPSBEYXRlLm5vdygpO1xuICAgICAgaWYgKG5vdyA+IG5leHQpIHtcbiAgICAgICAgbGFzdCA9IG5vdztcbiAgICAgICAgZm4oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRpbWVyID0gc2V0VGltZW91dCh1bmJvdW5kLCBuZXh0IC0gbm93KTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdGhyb3R0bGU7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG5cbnZhciBOYXRpdmVDdXN0b21FdmVudCA9IGdsb2JhbC5DdXN0b21FdmVudDtcblxuZnVuY3Rpb24gdXNlTmF0aXZlICgpIHtcbiAgdHJ5IHtcbiAgICB2YXIgcCA9IG5ldyBOYXRpdmVDdXN0b21FdmVudCgnY2F0JywgeyBkZXRhaWw6IHsgZm9vOiAnYmFyJyB9IH0pO1xuICAgIHJldHVybiAgJ2NhdCcgPT09IHAudHlwZSAmJiAnYmFyJyA9PT0gcC5kZXRhaWwuZm9vO1xuICB9IGNhdGNoIChlKSB7XG4gIH1cbiAgcmV0dXJuIGZhbHNlO1xufVxuXG4vKipcbiAqIENyb3NzLWJyb3dzZXIgYEN1c3RvbUV2ZW50YCBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvQ3VzdG9tRXZlbnQuQ3VzdG9tRXZlbnRcbiAqXG4gKiBAcHVibGljXG4gKi9cblxubW9kdWxlLmV4cG9ydHMgPSB1c2VOYXRpdmUoKSA/IE5hdGl2ZUN1c3RvbUV2ZW50IDpcblxuLy8gSUUgPj0gOVxuJ2Z1bmN0aW9uJyA9PT0gdHlwZW9mIGRvY3VtZW50LmNyZWF0ZUV2ZW50ID8gZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKHR5cGUsIHBhcmFtcykge1xuICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50KCdDdXN0b21FdmVudCcpO1xuICBpZiAocGFyYW1zKSB7XG4gICAgZS5pbml0Q3VzdG9tRXZlbnQodHlwZSwgcGFyYW1zLmJ1YmJsZXMsIHBhcmFtcy5jYW5jZWxhYmxlLCBwYXJhbXMuZGV0YWlsKTtcbiAgfSBlbHNlIHtcbiAgICBlLmluaXRDdXN0b21FdmVudCh0eXBlLCBmYWxzZSwgZmFsc2UsIHZvaWQgMCk7XG4gIH1cbiAgcmV0dXJuIGU7XG59IDpcblxuLy8gSUUgPD0gOFxuZnVuY3Rpb24gQ3VzdG9tRXZlbnQgKHR5cGUsIHBhcmFtcykge1xuICB2YXIgZSA9IGRvY3VtZW50LmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gIGUudHlwZSA9IHR5cGU7XG4gIGlmIChwYXJhbXMpIHtcbiAgICBlLmJ1YmJsZXMgPSBCb29sZWFuKHBhcmFtcy5idWJibGVzKTtcbiAgICBlLmNhbmNlbGFibGUgPSBCb29sZWFuKHBhcmFtcy5jYW5jZWxhYmxlKTtcbiAgICBlLmRldGFpbCA9IHBhcmFtcy5kZXRhaWw7XG4gIH0gZWxzZSB7XG4gICAgZS5idWJibGVzID0gZmFsc2U7XG4gICAgZS5jYW5jZWxhYmxlID0gZmFsc2U7XG4gICAgZS5kZXRhaWwgPSB2b2lkIDA7XG4gIH1cbiAgcmV0dXJuIGU7XG59XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OWpjbTl6YzNabGJuUXZibTlrWlY5dGIyUjFiR1Z6TDJOMWMzUnZiUzFsZG1WdWRDOXBibVJsZUM1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWx4dWRtRnlJRTVoZEdsMlpVTjFjM1J2YlVWMlpXNTBJRDBnWjJ4dlltRnNMa04xYzNSdmJVVjJaVzUwTzF4dVhHNW1kVzVqZEdsdmJpQjFjMlZPWVhScGRtVWdLQ2tnZTF4dUlDQjBjbmtnZTF4dUlDQWdJSFpoY2lCd0lEMGdibVYzSUU1aGRHbDJaVU4xYzNSdmJVVjJaVzUwS0NkallYUW5MQ0I3SUdSbGRHRnBiRG9nZXlCbWIyODZJQ2RpWVhJbklIMGdmU2s3WEc0Z0lDQWdjbVYwZFhKdUlDQW5ZMkYwSnlBOVBUMGdjQzUwZVhCbElDWW1JQ2RpWVhJbklEMDlQU0J3TG1SbGRHRnBiQzVtYjI4N1hHNGdJSDBnWTJGMFkyZ2dLR1VwSUh0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnWm1Gc2MyVTdYRzU5WEc1Y2JpOHFLbHh1SUNvZ1EzSnZjM010WW5KdmQzTmxjaUJnUTNWemRHOXRSWFpsYm5SZ0lHTnZibk4wY25WamRHOXlMbHh1SUNwY2JpQXFJR2gwZEhCek9pOHZaR1YyWld4dmNHVnlMbTF2ZW1sc2JHRXViM0puTDJWdUxWVlRMMlJ2WTNNdlYyVmlMMEZRU1M5RGRYTjBiMjFGZG1WdWRDNURkWE4wYjIxRmRtVnVkRnh1SUNwY2JpQXFJRUJ3ZFdKc2FXTmNiaUFxTDF4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlIVnpaVTVoZEdsMlpTZ3BJRDhnVG1GMGFYWmxRM1Z6ZEc5dFJYWmxiblFnT2x4dVhHNHZMeUJKUlNBK1BTQTVYRzRuWm5WdVkzUnBiMjRuSUQwOVBTQjBlWEJsYjJZZ1pHOWpkVzFsYm5RdVkzSmxZWFJsUlhabGJuUWdQeUJtZFc1amRHbHZiaUJEZFhOMGIyMUZkbVZ1ZENBb2RIbHdaU3dnY0dGeVlXMXpLU0I3WEc0Z0lIWmhjaUJsSUQwZ1pHOWpkVzFsYm5RdVkzSmxZWFJsUlhabGJuUW9KME4xYzNSdmJVVjJaVzUwSnlrN1hHNGdJR2xtSUNod1lYSmhiWE1wSUh0Y2JpQWdJQ0JsTG1sdWFYUkRkWE4wYjIxRmRtVnVkQ2gwZVhCbExDQndZWEpoYlhNdVluVmlZbXhsY3l3Z2NHRnlZVzF6TG1OaGJtTmxiR0ZpYkdVc0lIQmhjbUZ0Y3k1a1pYUmhhV3dwTzF4dUlDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUdVdWFXNXBkRU4xYzNSdmJVVjJaVzUwS0hSNWNHVXNJR1poYkhObExDQm1ZV3h6WlN3Z2RtOXBaQ0F3S1R0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnWlR0Y2JuMGdPbHh1WEc0dkx5QkpSU0E4UFNBNFhHNW1kVzVqZEdsdmJpQkRkWE4wYjIxRmRtVnVkQ0FvZEhsd1pTd2djR0Z5WVcxektTQjdYRzRnSUhaaGNpQmxJRDBnWkc5amRXMWxiblF1WTNKbFlYUmxSWFpsYm5SUFltcGxZM1FvS1R0Y2JpQWdaUzUwZVhCbElEMGdkSGx3WlR0Y2JpQWdhV1lnS0hCaGNtRnRjeWtnZTF4dUlDQWdJR1V1WW5WaVlteGxjeUE5SUVKdmIyeGxZVzRvY0dGeVlXMXpMbUoxWW1Kc1pYTXBPMXh1SUNBZ0lHVXVZMkZ1WTJWc1lXSnNaU0E5SUVKdmIyeGxZVzRvY0dGeVlXMXpMbU5oYm1ObGJHRmliR1VwTzF4dUlDQWdJR1V1WkdWMFlXbHNJRDBnY0dGeVlXMXpMbVJsZEdGcGJEdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQmxMbUoxWW1Kc1pYTWdQU0JtWVd4elpUdGNiaUFnSUNCbExtTmhibU5sYkdGaWJHVWdQU0JtWVd4elpUdGNiaUFnSUNCbExtUmxkR0ZwYkNBOUlIWnZhV1FnTUR0Y2JpQWdmVnh1SUNCeVpYUjFjbTRnWlR0Y2JuMWNiaUpkZlE9PSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGN1c3RvbUV2ZW50ID0gcmVxdWlyZSgnY3VzdG9tLWV2ZW50Jyk7XG52YXIgZXZlbnRtYXAgPSByZXF1aXJlKCcuL2V2ZW50bWFwJyk7XG52YXIgZG9jID0gZG9jdW1lbnQ7XG52YXIgYWRkRXZlbnQgPSBhZGRFdmVudEVhc3k7XG52YXIgcmVtb3ZlRXZlbnQgPSByZW1vdmVFdmVudEVhc3k7XG52YXIgaGFyZENhY2hlID0gW107XG5cbmlmICghZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgYWRkRXZlbnQgPSBhZGRFdmVudEhhcmQ7XG4gIHJlbW92ZUV2ZW50ID0gcmVtb3ZlRXZlbnRIYXJkO1xufVxuXG5mdW5jdGlvbiBhZGRFdmVudEVhc3kgKGVsLCB0eXBlLCBmbiwgY2FwdHVyaW5nKSB7XG4gIHJldHVybiBlbC5hZGRFdmVudExpc3RlbmVyKHR5cGUsIGZuLCBjYXB0dXJpbmcpO1xufVxuXG5mdW5jdGlvbiBhZGRFdmVudEhhcmQgKGVsLCB0eXBlLCBmbikge1xuICByZXR1cm4gZWwuYXR0YWNoRXZlbnQoJ29uJyArIHR5cGUsIHdyYXAoZWwsIHR5cGUsIGZuKSk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUV2ZW50RWFzeSAoZWwsIHR5cGUsIGZuLCBjYXB0dXJpbmcpIHtcbiAgcmV0dXJuIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIodHlwZSwgZm4sIGNhcHR1cmluZyk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZUV2ZW50SGFyZCAoZWwsIHR5cGUsIGZuKSB7XG4gIHJldHVybiBlbC5kZXRhY2hFdmVudCgnb24nICsgdHlwZSwgdW53cmFwKGVsLCB0eXBlLCBmbikpO1xufVxuXG5mdW5jdGlvbiBmYWJyaWNhdGVFdmVudCAoZWwsIHR5cGUsIG1vZGVsKSB7XG4gIHZhciBlID0gZXZlbnRtYXAuaW5kZXhPZih0eXBlKSA9PT0gLTEgPyBtYWtlQ3VzdG9tRXZlbnQoKSA6IG1ha2VDbGFzc2ljRXZlbnQoKTtcbiAgaWYgKGVsLmRpc3BhdGNoRXZlbnQpIHtcbiAgICBlbC5kaXNwYXRjaEV2ZW50KGUpO1xuICB9IGVsc2Uge1xuICAgIGVsLmZpcmVFdmVudCgnb24nICsgdHlwZSwgZSk7XG4gIH1cbiAgZnVuY3Rpb24gbWFrZUNsYXNzaWNFdmVudCAoKSB7XG4gICAgdmFyIGU7XG4gICAgaWYgKGRvYy5jcmVhdGVFdmVudCkge1xuICAgICAgZSA9IGRvYy5jcmVhdGVFdmVudCgnRXZlbnQnKTtcbiAgICAgIGUuaW5pdEV2ZW50KHR5cGUsIHRydWUsIHRydWUpO1xuICAgIH0gZWxzZSBpZiAoZG9jLmNyZWF0ZUV2ZW50T2JqZWN0KSB7XG4gICAgICBlID0gZG9jLmNyZWF0ZUV2ZW50T2JqZWN0KCk7XG4gICAgfVxuICAgIHJldHVybiBlO1xuICB9XG4gIGZ1bmN0aW9uIG1ha2VDdXN0b21FdmVudCAoKSB7XG4gICAgcmV0dXJuIG5ldyBjdXN0b21FdmVudCh0eXBlLCB7IGRldGFpbDogbW9kZWwgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gd3JhcHBlckZhY3RvcnkgKGVsLCB0eXBlLCBmbikge1xuICByZXR1cm4gZnVuY3Rpb24gd3JhcHBlciAob3JpZ2luYWxFdmVudCkge1xuICAgIHZhciBlID0gb3JpZ2luYWxFdmVudCB8fCBnbG9iYWwuZXZlbnQ7XG4gICAgZS50YXJnZXQgPSBlLnRhcmdldCB8fCBlLnNyY0VsZW1lbnQ7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCA9IGUucHJldmVudERlZmF1bHQgfHwgZnVuY3Rpb24gcHJldmVudERlZmF1bHQgKCkgeyBlLnJldHVyblZhbHVlID0gZmFsc2U7IH07XG4gICAgZS5zdG9wUHJvcGFnYXRpb24gPSBlLnN0b3BQcm9wYWdhdGlvbiB8fCBmdW5jdGlvbiBzdG9wUHJvcGFnYXRpb24gKCkgeyBlLmNhbmNlbEJ1YmJsZSA9IHRydWU7IH07XG4gICAgZS53aGljaCA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGZuLmNhbGwoZWwsIGUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiB3cmFwIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIHdyYXBwZXIgPSB1bndyYXAoZWwsIHR5cGUsIGZuKSB8fCB3cmFwcGVyRmFjdG9yeShlbCwgdHlwZSwgZm4pO1xuICBoYXJkQ2FjaGUucHVzaCh7XG4gICAgd3JhcHBlcjogd3JhcHBlcixcbiAgICBlbGVtZW50OiBlbCxcbiAgICB0eXBlOiB0eXBlLFxuICAgIGZuOiBmblxuICB9KTtcbiAgcmV0dXJuIHdyYXBwZXI7XG59XG5cbmZ1bmN0aW9uIHVud3JhcCAoZWwsIHR5cGUsIGZuKSB7XG4gIHZhciBpID0gZmluZChlbCwgdHlwZSwgZm4pO1xuICBpZiAoaSkge1xuICAgIHZhciB3cmFwcGVyID0gaGFyZENhY2hlW2ldLndyYXBwZXI7XG4gICAgaGFyZENhY2hlLnNwbGljZShpLCAxKTsgLy8gZnJlZSB1cCBhIHRhZCBvZiBtZW1vcnlcbiAgICByZXR1cm4gd3JhcHBlcjtcbiAgfVxufVxuXG5mdW5jdGlvbiBmaW5kIChlbCwgdHlwZSwgZm4pIHtcbiAgdmFyIGksIGl0ZW07XG4gIGZvciAoaSA9IDA7IGkgPCBoYXJkQ2FjaGUubGVuZ3RoOyBpKyspIHtcbiAgICBpdGVtID0gaGFyZENhY2hlW2ldO1xuICAgIGlmIChpdGVtLmVsZW1lbnQgPT09IGVsICYmIGl0ZW0udHlwZSA9PT0gdHlwZSAmJiBpdGVtLmZuID09PSBmbikge1xuICAgICAgcmV0dXJuIGk7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBhZGQ6IGFkZEV2ZW50LFxuICByZW1vdmU6IHJlbW92ZUV2ZW50LFxuICBmYWJyaWNhdGU6IGZhYnJpY2F0ZUV2ZW50XG59O1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTlqY205emMzWmxiblF2YzNKakwyTnliM056ZG1WdWRDNXFjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUVVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmpkWE4wYjIxRmRtVnVkQ0E5SUhKbGNYVnBjbVVvSjJOMWMzUnZiUzFsZG1WdWRDY3BPMXh1ZG1GeUlHVjJaVzUwYldGd0lEMGdjbVZ4ZFdseVpTZ25MaTlsZG1WdWRHMWhjQ2NwTzF4dWRtRnlJR1J2WXlBOUlHUnZZM1Z0Wlc1ME8xeHVkbUZ5SUdGa1pFVjJaVzUwSUQwZ1lXUmtSWFpsYm5SRllYTjVPMXh1ZG1GeUlISmxiVzkyWlVWMlpXNTBJRDBnY21WdGIzWmxSWFpsYm5SRllYTjVPMXh1ZG1GeUlHaGhjbVJEWVdOb1pTQTlJRnRkTzF4dVhHNXBaaUFvSVdkc2IySmhiQzVoWkdSRmRtVnVkRXhwYzNSbGJtVnlLU0I3WEc0Z0lHRmtaRVYyWlc1MElEMGdZV1JrUlhabGJuUklZWEprTzF4dUlDQnlaVzF2ZG1WRmRtVnVkQ0E5SUhKbGJXOTJaVVYyWlc1MFNHRnlaRHRjYm4xY2JseHVablZ1WTNScGIyNGdZV1JrUlhabGJuUkZZWE41SUNobGJDd2dkSGx3WlN3Z1ptNHNJR05oY0hSMWNtbHVaeWtnZTF4dUlDQnlaWFIxY200Z1pXd3VZV1JrUlhabGJuUk1hWE4wWlc1bGNpaDBlWEJsTENCbWJpd2dZMkZ3ZEhWeWFXNW5LVHRjYm4xY2JseHVablZ1WTNScGIyNGdZV1JrUlhabGJuUklZWEprSUNobGJDd2dkSGx3WlN3Z1ptNHBJSHRjYmlBZ2NtVjBkWEp1SUdWc0xtRjBkR0ZqYUVWMlpXNTBLQ2R2YmljZ0t5QjBlWEJsTENCM2NtRndLR1ZzTENCMGVYQmxMQ0JtYmlrcE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCeVpXMXZkbVZGZG1WdWRFVmhjM2tnS0dWc0xDQjBlWEJsTENCbWJpd2dZMkZ3ZEhWeWFXNW5LU0I3WEc0Z0lISmxkSFZ5YmlCbGJDNXlaVzF2ZG1WRmRtVnVkRXhwYzNSbGJtVnlLSFI1Y0dVc0lHWnVMQ0JqWVhCMGRYSnBibWNwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJ5WlcxdmRtVkZkbVZ1ZEVoaGNtUWdLR1ZzTENCMGVYQmxMQ0JtYmlrZ2UxeHVJQ0J5WlhSMWNtNGdaV3d1WkdWMFlXTm9SWFpsYm5Rb0oyOXVKeUFySUhSNWNHVXNJSFZ1ZDNKaGNDaGxiQ3dnZEhsd1pTd2dabTRwS1R0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnWm1GaWNtbGpZWFJsUlhabGJuUWdLR1ZzTENCMGVYQmxMQ0J0YjJSbGJDa2dlMXh1SUNCMllYSWdaU0E5SUdWMlpXNTBiV0Z3TG1sdVpHVjRUMllvZEhsd1pTa2dQVDA5SUMweElEOGdiV0ZyWlVOMWMzUnZiVVYyWlc1MEtDa2dPaUJ0WVd0bFEyeGhjM05wWTBWMlpXNTBLQ2s3WEc0Z0lHbG1JQ2hsYkM1a2FYTndZWFJqYUVWMlpXNTBLU0I3WEc0Z0lDQWdaV3d1WkdsemNHRjBZMmhGZG1WdWRDaGxLVHRjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0JsYkM1bWFYSmxSWFpsYm5Rb0oyOXVKeUFySUhSNWNHVXNJR1VwTzF4dUlDQjlYRzRnSUdaMWJtTjBhVzl1SUcxaGEyVkRiR0Z6YzJsalJYWmxiblFnS0NrZ2UxeHVJQ0FnSUhaaGNpQmxPMXh1SUNBZ0lHbG1JQ2hrYjJNdVkzSmxZWFJsUlhabGJuUXBJSHRjYmlBZ0lDQWdJR1VnUFNCa2IyTXVZM0psWVhSbFJYWmxiblFvSjBWMlpXNTBKeWs3WEc0Z0lDQWdJQ0JsTG1sdWFYUkZkbVZ1ZENoMGVYQmxMQ0IwY25WbExDQjBjblZsS1R0Y2JpQWdJQ0I5SUdWc2MyVWdhV1lnS0dSdll5NWpjbVZoZEdWRmRtVnVkRTlpYW1WamRDa2dlMXh1SUNBZ0lDQWdaU0E5SUdSdll5NWpjbVZoZEdWRmRtVnVkRTlpYW1WamRDZ3BPMXh1SUNBZ0lIMWNiaUFnSUNCeVpYUjFjbTRnWlR0Y2JpQWdmVnh1SUNCbWRXNWpkR2x2YmlCdFlXdGxRM1Z6ZEc5dFJYWmxiblFnS0NrZ2UxeHVJQ0FnSUhKbGRIVnliaUJ1WlhjZ1kzVnpkRzl0UlhabGJuUW9kSGx3WlN3Z2V5QmtaWFJoYVd3NklHMXZaR1ZzSUgwcE8xeHVJQ0I5WEc1OVhHNWNibVoxYm1OMGFXOXVJSGR5WVhCd1pYSkdZV04wYjNKNUlDaGxiQ3dnZEhsd1pTd2dabTRwSUh0Y2JpQWdjbVYwZFhKdUlHWjFibU4wYVc5dUlIZHlZWEJ3WlhJZ0tHOXlhV2RwYm1Gc1JYWmxiblFwSUh0Y2JpQWdJQ0IyWVhJZ1pTQTlJRzl5YVdkcGJtRnNSWFpsYm5RZ2ZId2daMnh2WW1Gc0xtVjJaVzUwTzF4dUlDQWdJR1V1ZEdGeVoyVjBJRDBnWlM1MFlYSm5aWFFnZkh3Z1pTNXpjbU5GYkdWdFpXNTBPMXh1SUNBZ0lHVXVjSEpsZG1WdWRFUmxabUYxYkhRZ1BTQmxMbkJ5WlhabGJuUkVaV1poZFd4MElIeDhJR1oxYm1OMGFXOXVJSEJ5WlhabGJuUkVaV1poZFd4MElDZ3BJSHNnWlM1eVpYUjFjbTVXWVd4MVpTQTlJR1poYkhObE95QjlPMXh1SUNBZ0lHVXVjM1J2Y0ZCeWIzQmhaMkYwYVc5dUlEMGdaUzV6ZEc5d1VISnZjR0ZuWVhScGIyNGdmSHdnWm5WdVkzUnBiMjRnYzNSdmNGQnliM0JoWjJGMGFXOXVJQ2dwSUhzZ1pTNWpZVzVqWld4Q2RXSmliR1VnUFNCMGNuVmxPeUI5TzF4dUlDQWdJR1V1ZDJocFkyZ2dQU0JsTG5kb2FXTm9JSHg4SUdVdWEyVjVRMjlrWlR0Y2JpQWdJQ0JtYmk1allXeHNLR1ZzTENCbEtUdGNiaUFnZlR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnZDNKaGNDQW9aV3dzSUhSNWNHVXNJR1p1S1NCN1hHNGdJSFpoY2lCM2NtRndjR1Z5SUQwZ2RXNTNjbUZ3S0dWc0xDQjBlWEJsTENCbWJpa2dmSHdnZDNKaGNIQmxja1poWTNSdmNua29aV3dzSUhSNWNHVXNJR1p1S1R0Y2JpQWdhR0Z5WkVOaFkyaGxMbkIxYzJnb2UxeHVJQ0FnSUhkeVlYQndaWEk2SUhkeVlYQndaWElzWEc0Z0lDQWdaV3hsYldWdWREb2daV3dzWEc0Z0lDQWdkSGx3WlRvZ2RIbHdaU3hjYmlBZ0lDQm1iam9nWm01Y2JpQWdmU2s3WEc0Z0lISmxkSFZ5YmlCM2NtRndjR1Z5TzF4dWZWeHVYRzVtZFc1amRHbHZiaUIxYm5keVlYQWdLR1ZzTENCMGVYQmxMQ0JtYmlrZ2UxeHVJQ0IyWVhJZ2FTQTlJR1pwYm1Rb1pXd3NJSFI1Y0dVc0lHWnVLVHRjYmlBZ2FXWWdLR2twSUh0Y2JpQWdJQ0IyWVhJZ2QzSmhjSEJsY2lBOUlHaGhjbVJEWVdOb1pWdHBYUzUzY21Gd2NHVnlPMXh1SUNBZ0lHaGhjbVJEWVdOb1pTNXpjR3hwWTJVb2FTd2dNU2s3SUM4dklHWnlaV1VnZFhBZ1lTQjBZV1FnYjJZZ2JXVnRiM0o1WEc0Z0lDQWdjbVYwZFhKdUlIZHlZWEJ3WlhJN1hHNGdJSDFjYm4xY2JseHVablZ1WTNScGIyNGdabWx1WkNBb1pXd3NJSFI1Y0dVc0lHWnVLU0I3WEc0Z0lIWmhjaUJwTENCcGRHVnRPMXh1SUNCbWIzSWdLR2tnUFNBd095QnBJRHdnYUdGeVpFTmhZMmhsTG14bGJtZDBhRHNnYVNzcktTQjdYRzRnSUNBZ2FYUmxiU0E5SUdoaGNtUkRZV05vWlZ0cFhUdGNiaUFnSUNCcFppQW9hWFJsYlM1bGJHVnRaVzUwSUQwOVBTQmxiQ0FtSmlCcGRHVnRMblI1Y0dVZ1BUMDlJSFI1Y0dVZ0ppWWdhWFJsYlM1bWJpQTlQVDBnWm00cElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCcE8xeHVJQ0FnSUgxY2JpQWdmVnh1ZlZ4dVhHNXRiMlIxYkdVdVpYaHdiM0owY3lBOUlIdGNiaUFnWVdSa09pQmhaR1JGZG1WdWRDeGNiaUFnY21WdGIzWmxPaUJ5WlcxdmRtVkZkbVZ1ZEN4Y2JpQWdabUZpY21sallYUmxPaUJtWVdKeWFXTmhkR1ZGZG1WdWRGeHVmVHRjYmlKZGZRPT0iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBldmVudG1hcCA9IFtdO1xudmFyIGV2ZW50bmFtZSA9ICcnO1xudmFyIHJvbiA9IC9eb24vO1xuXG5mb3IgKGV2ZW50bmFtZSBpbiBnbG9iYWwpIHtcbiAgaWYgKHJvbi50ZXN0KGV2ZW50bmFtZSkpIHtcbiAgICBldmVudG1hcC5wdXNoKGV2ZW50bmFtZS5zbGljZSgyKSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBldmVudG1hcDtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbTV2WkdWZmJXOWtkV3hsY3k5amNtOXpjM1psYm5RdmMzSmpMMlYyWlc1MGJXRndMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQmxkbVZ1ZEcxaGNDQTlJRnRkTzF4dWRtRnlJR1YyWlc1MGJtRnRaU0E5SUNjbk8xeHVkbUZ5SUhKdmJpQTlJQzllYjI0dk8xeHVYRzVtYjNJZ0tHVjJaVzUwYm1GdFpTQnBiaUJuYkc5aVlXd3BJSHRjYmlBZ2FXWWdLSEp2Ymk1MFpYTjBLR1YyWlc1MGJtRnRaU2twSUh0Y2JpQWdJQ0JsZG1WdWRHMWhjQzV3ZFhOb0tHVjJaVzUwYm1GdFpTNXpiR2xqWlNneUtTazdYRzRnSUgxY2JuMWNibHh1Ylc5a2RXeGxMbVY0Y0c5eWRITWdQU0JsZG1WdWRHMWhjRHRjYmlKZGZRPT0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzZWt0b3IgPSByZXF1aXJlKCdzZWt0b3InKTtcbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciByc3BhY2VzID0gL1xccysvZztcbnZhciBrZXltYXAgPSB7XG4gIDEzOiAnZW50ZXInLFxuICAyNzogJ2VzYycsXG4gIDMyOiAnc3BhY2UnXG59O1xudmFyIGhhbmRsZXJzID0ge307XG5cbmNyb3NzdmVudC5hZGQod2luZG93LCAna2V5ZG93bicsIGtleWRvd24pO1xuXG5mdW5jdGlvbiBjbGVhciAoY29udGV4dCkge1xuICBpZiAoY29udGV4dCkge1xuICAgIGlmIChjb250ZXh0IGluIGhhbmRsZXJzKSB7XG4gICAgICBoYW5kbGVyc1tjb250ZXh0XSA9IHt9O1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBoYW5kbGVycyA9IHt9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHN3aXRjaGJvYXJkICh0aGVuLCBjb21ibywgb3B0aW9ucywgZm4pIHtcbiAgaWYgKGZuID09PSB2b2lkIDApIHtcbiAgICBmbiA9IG9wdGlvbnM7XG4gICAgb3B0aW9ucyA9IHt9O1xuICB9XG5cbiAgdmFyIGNvbnRleHQgPSBvcHRpb25zLmNvbnRleHQgfHwgJ2RlZmF1bHRzJztcblxuICBpZiAoIWZuKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGhhbmRsZXJzW2NvbnRleHRdID09PSB2b2lkIDApIHtcbiAgICBoYW5kbGVyc1tjb250ZXh0XSA9IHt9O1xuICB9XG5cbiAgY29tYm8udG9Mb3dlckNhc2UoKS5zcGxpdChyc3BhY2VzKS5mb3JFYWNoKGl0ZW0pO1xuXG4gIGZ1bmN0aW9uIGl0ZW0gKGtleXMpIHtcbiAgICB2YXIgYyA9IGtleXMudHJpbSgpO1xuICAgIGlmIChjLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB0aGVuKGhhbmRsZXJzW2NvbnRleHRdLCBjLCBvcHRpb25zLCBmbik7XG4gIH1cbn1cblxuZnVuY3Rpb24gb24gKGNvbWJvLCBvcHRpb25zLCBmbikge1xuICBzd2l0Y2hib2FyZChhZGQsIGNvbWJvLCBvcHRpb25zLCBmbik7XG5cbiAgZnVuY3Rpb24gYWRkIChhcmVhLCBrZXksIG9wdGlvbnMsIGZuKSB7XG4gICAgdmFyIGhhbmRsZXIgPSB7XG4gICAgICBoYW5kbGU6IGZuLFxuICAgICAgZmlsdGVyOiBvcHRpb25zLmZpbHRlclxuICAgIH07XG4gICAgaWYgKGFyZWFba2V5XSkge1xuICAgICAgYXJlYVtrZXldLnB1c2goaGFuZGxlcik7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFyZWFba2V5XSA9IFtoYW5kbGVyXTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gb2ZmIChjb21ibywgb3B0aW9ucywgZm4pIHtcbiAgc3dpdGNoYm9hcmQocm0sIGNvbWJvLCBvcHRpb25zLCBmbik7XG5cbiAgZnVuY3Rpb24gcm0gKGFyZWEsIGtleSwgb3B0aW9ucywgZm4pIHtcbiAgICBpZiAoYXJlYVtrZXldKSB7XG4gICAgICBhcmVhW2tleV0gPSBhcmVhW2tleV0uZmlsdGVyKG1hdGNoaW5nKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtYXRjaGluZyAoaGFuZGxlcikge1xuICAgICAgcmV0dXJuIGhhbmRsZXIuaGFuZGxlID09PSBmbiAmJiBoYW5kbGVyLmZpbHRlciA9PT0gb3B0aW9ucy5maWx0ZXI7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldEtleUNvZGUgKGUpIHtcbiAgcmV0dXJuIGUud2hpY2ggfHwgZS5rZXlDb2RlIHx8IGUuY2hhckNvZGU7XG59XG5cbmZ1bmN0aW9uIGtleWRvd24gKGUpIHtcbiAgdmFyIGNvZGUgPSBnZXRLZXlDb2RlKGUpO1xuICB2YXIga2V5ID0ga2V5bWFwW2NvZGVdIHx8IFN0cmluZy5mcm9tQ2hhckNvZGUoY29kZSk7XG4gIGlmIChrZXkpIHtcbiAgICBoYW5kbGUoa2V5LCBlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBwYXJzZUtleUNvbWJvIChrZXksIGUpIHtcbiAgdmFyIGNvbWJvID0gW2tleV07XG4gIGlmIChlLnNoaWZ0S2V5KSB7XG4gICAgY29tYm8udW5zaGlmdCgnc2hpZnQnKTtcbiAgfVxuICBpZiAoZS5hbHRLZXkpIHtcbiAgICBjb21iby51bnNoaWZ0KCdhbHQnKTtcbiAgfVxuICBpZiAoZS5jdHJsS2V5IF4gZS5tZXRhS2V5KSB7XG4gICAgY29tYm8udW5zaGlmdCgnY21kJyk7XG4gIH1cbiAgcmV0dXJuIGNvbWJvLmpvaW4oJysnKS50b0xvd2VyQ2FzZSgpO1xufVxuXG5mdW5jdGlvbiBoYW5kbGUgKGtleSwgZSkge1xuICB2YXIgY29tYm8gPSBwYXJzZUtleUNvbWJvKGtleSwgZSk7XG4gIHZhciBjb250ZXh0O1xuICBmb3IgKGNvbnRleHQgaW4gaGFuZGxlcnMpIHtcbiAgICBpZiAoaGFuZGxlcnNbY29udGV4dF1bY29tYm9dKSB7XG4gICAgICBoYW5kbGVyc1tjb250ZXh0XVtjb21ib10uZm9yRWFjaChleGVjKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBmaWx0ZXJlZCAoaGFuZGxlcikge1xuICAgIHZhciBmaWx0ZXIgPSBoYW5kbGVyLmZpbHRlcjtcbiAgICBpZiAoIWZpbHRlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBlbCA9IGUudGFyZ2V0O1xuICAgIHZhciBzZWxlY3RvciA9IHR5cGVvZiBmaWx0ZXIgPT09ICdzdHJpbmcnO1xuICAgIGlmIChzZWxlY3Rvcikge1xuICAgICAgcmV0dXJuIHNla3Rvci5tYXRjaGVzU2VsZWN0b3IoZWwsIGZpbHRlcikgPT09IGZhbHNlO1xuICAgIH1cbiAgICB3aGlsZSAoZWwucGFyZW50RWxlbWVudCAmJiBlbCAhPT0gZmlsdGVyKSB7XG4gICAgICBlbCA9IGVsLnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuICAgIHJldHVybiBlbCAhPT0gZmlsdGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gZXhlYyAoaGFuZGxlcikge1xuICAgIGlmIChmaWx0ZXJlZChoYW5kbGVyKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBoYW5kbGVyLmhhbmRsZShlKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgb246IG9uLFxuICBvZmY6IG9mZixcbiAgY2xlYXI6IGNsZWFyLFxuICBoYW5kbGVyczogaGFuZGxlcnNcbn07XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBleHBhbmRvID0gJ3Nla3Rvci0nICsgRGF0ZS5ub3coKTtcbnZhciByc2libGluZ3MgPSAvWyt+XS87XG52YXIgZG9jdW1lbnQgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgZGVsID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xudmFyIG1hdGNoID0gZGVsLm1hdGNoZXMgfHxcbiAgICAgICAgICAgIGRlbC53ZWJraXRNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICAgICAgICAgIGRlbC5tb3pNYXRjaGVzU2VsZWN0b3IgfHxcbiAgICAgICAgICAgIGRlbC5vTWF0Y2hlc1NlbGVjdG9yIHx8XG4gICAgICAgICAgICBkZWwubXNNYXRjaGVzU2VsZWN0b3I7XG5cbmZ1bmN0aW9uIHFzYSAoc2VsZWN0b3IsIGNvbnRleHQpIHtcbiAgdmFyIGV4aXN0ZWQsIGlkLCBwcmVmaXgsIHByZWZpeGVkLCBhZGFwdGVyLCBoYWNrID0gY29udGV4dCAhPT0gZG9jdW1lbnQ7XG4gIGlmIChoYWNrKSB7IC8vIGlkIGhhY2sgZm9yIGNvbnRleHQtcm9vdGVkIHF1ZXJpZXNcbiAgICBleGlzdGVkID0gY29udGV4dC5nZXRBdHRyaWJ1dGUoJ2lkJyk7XG4gICAgaWQgPSBleGlzdGVkIHx8IGV4cGFuZG87XG4gICAgcHJlZml4ID0gJyMnICsgaWQgKyAnICc7XG4gICAgcHJlZml4ZWQgPSBwcmVmaXggKyBzZWxlY3Rvci5yZXBsYWNlKC8sL2csICcsJyArIHByZWZpeCk7XG4gICAgYWRhcHRlciA9IHJzaWJsaW5ncy50ZXN0KHNlbGVjdG9yKSAmJiBjb250ZXh0LnBhcmVudE5vZGU7XG4gICAgaWYgKCFleGlzdGVkKSB7IGNvbnRleHQuc2V0QXR0cmlidXRlKCdpZCcsIGlkKTsgfVxuICB9XG4gIHRyeSB7XG4gICAgcmV0dXJuIChhZGFwdGVyIHx8IGNvbnRleHQpLnF1ZXJ5U2VsZWN0b3JBbGwocHJlZml4ZWQgfHwgc2VsZWN0b3IpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgcmV0dXJuIFtdO1xuICB9IGZpbmFsbHkge1xuICAgIGlmIChleGlzdGVkID09PSBudWxsKSB7IGNvbnRleHQucmVtb3ZlQXR0cmlidXRlKCdpZCcpOyB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZmluZCAoc2VsZWN0b3IsIGN0eCwgY29sbGVjdGlvbiwgc2VlZCkge1xuICB2YXIgZWxlbWVudDtcbiAgdmFyIGNvbnRleHQgPSBjdHggfHwgZG9jdW1lbnQ7XG4gIHZhciByZXN1bHRzID0gY29sbGVjdGlvbiB8fCBbXTtcbiAgdmFyIGkgPSAwO1xuICBpZiAodHlwZW9mIHNlbGVjdG9yICE9PSAnc3RyaW5nJykge1xuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG4gIGlmIChjb250ZXh0Lm5vZGVUeXBlICE9PSAxICYmIGNvbnRleHQubm9kZVR5cGUgIT09IDkpIHtcbiAgICByZXR1cm4gW107IC8vIGJhaWwgaWYgY29udGV4dCBpcyBub3QgYW4gZWxlbWVudCBvciBkb2N1bWVudFxuICB9XG4gIGlmIChzZWVkKSB7XG4gICAgd2hpbGUgKChlbGVtZW50ID0gc2VlZFtpKytdKSkge1xuICAgICAgaWYgKG1hdGNoZXNTZWxlY3RvcihlbGVtZW50LCBzZWxlY3RvcikpIHtcbiAgICAgICAgcmVzdWx0cy5wdXNoKGVsZW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIHtcbiAgICByZXN1bHRzLnB1c2guYXBwbHkocmVzdWx0cywgcXNhKHNlbGVjdG9yLCBjb250ZXh0KSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdHM7XG59XG5cbmZ1bmN0aW9uIG1hdGNoZXMgKHNlbGVjdG9yLCBlbGVtZW50cykge1xuICByZXR1cm4gZmluZChzZWxlY3RvciwgbnVsbCwgbnVsbCwgZWxlbWVudHMpO1xufVxuXG5mdW5jdGlvbiBtYXRjaGVzU2VsZWN0b3IgKGVsZW1lbnQsIHNlbGVjdG9yKSB7XG4gIHJldHVybiBtYXRjaC5jYWxsKGVsZW1lbnQsIHNlbGVjdG9yKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaW5kO1xuXG5maW5kLm1hdGNoZXMgPSBtYXRjaGVzO1xuZmluZC5tYXRjaGVzU2VsZWN0b3IgPSBtYXRjaGVzU2VsZWN0b3I7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OXJZVzU1WlM5dWIyUmxYMjF2WkhWc1pYTXZjMlZyZEc5eUwzTnlZeTl6Wld0MGIzSXVhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJanRCUVVGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JuWmhjaUJsZUhCaGJtUnZJRDBnSjNObGEzUnZjaTBuSUNzZ1JHRjBaUzV1YjNjb0tUdGNiblpoY2lCeWMybGliR2x1WjNNZ1BTQXZXeXQrWFM4N1hHNTJZWElnWkc5amRXMWxiblFnUFNCbmJHOWlZV3d1Wkc5amRXMWxiblE3WEc1MllYSWdaR1ZzSUQwZ1pHOWpkVzFsYm5RdVpHOWpkVzFsYm5SRmJHVnRaVzUwTzF4dWRtRnlJRzFoZEdOb0lEMGdaR1ZzTG0xaGRHTm9aWE1nZkh4Y2JpQWdJQ0FnSUNBZ0lDQWdJR1JsYkM1M1pXSnJhWFJOWVhSamFHVnpVMlZzWldOMGIzSWdmSHhjYmlBZ0lDQWdJQ0FnSUNBZ0lHUmxiQzV0YjNwTllYUmphR1Z6VTJWc1pXTjBiM0lnZkh4Y2JpQWdJQ0FnSUNBZ0lDQWdJR1JsYkM1dlRXRjBZMmhsYzFObGJHVmpkRzl5SUh4OFhHNGdJQ0FnSUNBZ0lDQWdJQ0JrWld3dWJYTk5ZWFJqYUdWelUyVnNaV04wYjNJN1hHNWNibVoxYm1OMGFXOXVJSEZ6WVNBb2MyVnNaV04wYjNJc0lHTnZiblJsZUhRcElIdGNiaUFnZG1GeUlHVjRhWE4wWldRc0lHbGtMQ0J3Y21WbWFYZ3NJSEJ5WldacGVHVmtMQ0JoWkdGd2RHVnlMQ0JvWVdOcklEMGdZMjl1ZEdWNGRDQWhQVDBnWkc5amRXMWxiblE3WEc0Z0lHbG1JQ2hvWVdOcktTQjdJQzh2SUdsa0lHaGhZMnNnWm05eUlHTnZiblJsZUhRdGNtOXZkR1ZrSUhGMVpYSnBaWE5jYmlBZ0lDQmxlR2x6ZEdWa0lEMGdZMjl1ZEdWNGRDNW5aWFJCZEhSeWFXSjFkR1VvSjJsa0p5azdYRzRnSUNBZ2FXUWdQU0JsZUdsemRHVmtJSHg4SUdWNGNHRnVaRzg3WEc0Z0lDQWdjSEpsWm1sNElEMGdKeU1uSUNzZ2FXUWdLeUFuSUNjN1hHNGdJQ0FnY0hKbFptbDRaV1FnUFNCd2NtVm1hWGdnS3lCelpXeGxZM1J2Y2k1eVpYQnNZV05sS0M4c0wyY3NJQ2NzSnlBcklIQnlaV1pwZUNrN1hHNGdJQ0FnWVdSaGNIUmxjaUE5SUhKemFXSnNhVzVuY3k1MFpYTjBLSE5sYkdWamRHOXlLU0FtSmlCamIyNTBaWGgwTG5CaGNtVnVkRTV2WkdVN1hHNGdJQ0FnYVdZZ0tDRmxlR2x6ZEdWa0tTQjdJR052Ym5SbGVIUXVjMlYwUVhSMGNtbGlkWFJsS0NkcFpDY3NJR2xrS1RzZ2ZWeHVJQ0I5WEc0Z0lIUnllU0I3WEc0Z0lDQWdjbVYwZFhKdUlDaGhaR0Z3ZEdWeUlIeDhJR052Ym5SbGVIUXBMbkYxWlhKNVUyVnNaV04wYjNKQmJHd29jSEpsWm1sNFpXUWdmSHdnYzJWc1pXTjBiM0lwTzF4dUlDQjlJR05oZEdOb0lDaGxLU0I3WEc0Z0lDQWdjbVYwZFhKdUlGdGRPMXh1SUNCOUlHWnBibUZzYkhrZ2UxeHVJQ0FnSUdsbUlDaGxlR2x6ZEdWa0lEMDlQU0J1ZFd4c0tTQjdJR052Ym5SbGVIUXVjbVZ0YjNabFFYUjBjbWxpZFhSbEtDZHBaQ2NwT3lCOVhHNGdJSDFjYm4xY2JseHVablZ1WTNScGIyNGdabWx1WkNBb2MyVnNaV04wYjNJc0lHTjBlQ3dnWTI5c2JHVmpkR2x2Yml3Z2MyVmxaQ2tnZTF4dUlDQjJZWElnWld4bGJXVnVkRHRjYmlBZ2RtRnlJR052Ym5SbGVIUWdQU0JqZEhnZ2ZId2daRzlqZFcxbGJuUTdYRzRnSUhaaGNpQnlaWE4xYkhSeklEMGdZMjlzYkdWamRHbHZiaUI4ZkNCYlhUdGNiaUFnZG1GeUlHa2dQU0F3TzF4dUlDQnBaaUFvZEhsd1pXOW1JSE5sYkdWamRHOXlJQ0U5UFNBbmMzUnlhVzVuSnlrZ2UxeHVJQ0FnSUhKbGRIVnliaUJ5WlhOMWJIUnpPMXh1SUNCOVhHNGdJR2xtSUNoamIyNTBaWGgwTG01dlpHVlVlWEJsSUNFOVBTQXhJQ1ltSUdOdmJuUmxlSFF1Ym05a1pWUjVjR1VnSVQwOUlEa3BJSHRjYmlBZ0lDQnlaWFIxY200Z1cxMDdJQzh2SUdKaGFXd2dhV1lnWTI5dWRHVjRkQ0JwY3lCdWIzUWdZVzRnWld4bGJXVnVkQ0J2Y2lCa2IyTjFiV1Z1ZEZ4dUlDQjlYRzRnSUdsbUlDaHpaV1ZrS1NCN1hHNGdJQ0FnZDJocGJHVWdLQ2hsYkdWdFpXNTBJRDBnYzJWbFpGdHBLeXRkS1NrZ2UxeHVJQ0FnSUNBZ2FXWWdLRzFoZEdOb1pYTlRaV3hsWTNSdmNpaGxiR1Z0Wlc1MExDQnpaV3hsWTNSdmNpa3BJSHRjYmlBZ0lDQWdJQ0FnY21WemRXeDBjeTV3ZFhOb0tHVnNaVzFsYm5RcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmU0JsYkhObElIdGNiaUFnSUNCeVpYTjFiSFJ6TG5CMWMyZ3VZWEJ3Ykhrb2NtVnpkV3gwY3l3Z2NYTmhLSE5sYkdWamRHOXlMQ0JqYjI1MFpYaDBLU2s3WEc0Z0lIMWNiaUFnY21WMGRYSnVJSEpsYzNWc2RITTdYRzU5WEc1Y2JtWjFibU4wYVc5dUlHMWhkR05vWlhNZ0tITmxiR1ZqZEc5eUxDQmxiR1Z0Wlc1MGN5a2dlMXh1SUNCeVpYUjFjbTRnWm1sdVpDaHpaV3hsWTNSdmNpd2diblZzYkN3Z2JuVnNiQ3dnWld4bGJXVnVkSE1wTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJ0WVhSamFHVnpVMlZzWldOMGIzSWdLR1ZzWlcxbGJuUXNJSE5sYkdWamRHOXlLU0I3WEc0Z0lISmxkSFZ5YmlCdFlYUmphQzVqWVd4c0tHVnNaVzFsYm5Rc0lITmxiR1ZqZEc5eUtUdGNibjFjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCbWFXNWtPMXh1WEc1bWFXNWtMbTFoZEdOb1pYTWdQU0J0WVhSamFHVnpPMXh1Wm1sdVpDNXRZWFJqYUdWelUyVnNaV04wYjNJZ1BTQnRZWFJqYUdWelUyVnNaV04wYjNJN1hHNGlYWDA9IiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3R1YiA9IHJlcXVpcmUoJy4vc3R1YicpO1xudmFyIHRyYWNraW5nID0gcmVxdWlyZSgnLi90cmFja2luZycpO1xudmFyIGxzID0gJ2xvY2FsU3RvcmFnZScgaW4gZ2xvYmFsICYmIGdsb2JhbC5sb2NhbFN0b3JhZ2UgPyBnbG9iYWwubG9jYWxTdG9yYWdlIDogc3R1YjtcblxuZnVuY3Rpb24gYWNjZXNzb3IgKGtleSwgdmFsdWUpIHtcbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDEpIHtcbiAgICByZXR1cm4gZ2V0KGtleSk7XG4gIH1cbiAgcmV0dXJuIHNldChrZXksIHZhbHVlKTtcbn1cblxuZnVuY3Rpb24gZ2V0IChrZXkpIHtcbiAgcmV0dXJuIEpTT04ucGFyc2UobHMuZ2V0SXRlbShrZXkpKTtcbn1cblxuZnVuY3Rpb24gc2V0IChrZXksIHZhbHVlKSB7XG4gIHRyeSB7XG4gICAgbHMuc2V0SXRlbShrZXksIEpTT04uc3RyaW5naWZ5KHZhbHVlKSk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVtb3ZlIChrZXkpIHtcbiAgcmV0dXJuIGxzLnJlbW92ZUl0ZW0oa2V5KTtcbn1cblxuZnVuY3Rpb24gY2xlYXIgKCkge1xuICByZXR1cm4gbHMuY2xlYXIoKTtcbn1cblxuYWNjZXNzb3Iuc2V0ID0gc2V0O1xuYWNjZXNzb3IuZ2V0ID0gZ2V0O1xuYWNjZXNzb3IucmVtb3ZlID0gcmVtb3ZlO1xuYWNjZXNzb3IuY2xlYXIgPSBjbGVhcjtcbmFjY2Vzc29yLm9uID0gdHJhY2tpbmcub247XG5hY2Nlc3Nvci5vZmYgPSB0cmFja2luZy5vZmY7XG5cbm1vZHVsZS5leHBvcnRzID0gYWNjZXNzb3I7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW01dlpHVmZiVzlrZFd4bGN5OXNiMk5oYkMxemRHOXlZV2RsTDJ4dlkyRnNMWE4wYjNKaFoyVXVhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJanRCUVVGQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJJaXdpWm1sc1pTSTZJbWRsYm1WeVlYUmxaQzVxY3lJc0luTnZkWEpqWlZKdmIzUWlPaUlpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lJbmRYTmxJSE4wY21samRDYzdYRzVjYm5aaGNpQnpkSFZpSUQwZ2NtVnhkV2x5WlNnbkxpOXpkSFZpSnlrN1hHNTJZWElnZEhKaFkydHBibWNnUFNCeVpYRjFhWEpsS0NjdUwzUnlZV05yYVc1bkp5azdYRzUyWVhJZ2JITWdQU0FuYkc5allXeFRkRzl5WVdkbEp5QnBiaUJuYkc5aVlXd2dKaVlnWjJ4dlltRnNMbXh2WTJGc1UzUnZjbUZuWlNBL0lHZHNiMkpoYkM1c2IyTmhiRk4wYjNKaFoyVWdPaUJ6ZEhWaU8xeHVYRzVtZFc1amRHbHZiaUJoWTJObGMzTnZjaUFvYTJWNUxDQjJZV3gxWlNrZ2UxeHVJQ0JwWmlBb1lYSm5kVzFsYm5SekxteGxibWQwYUNBOVBUMGdNU2tnZTF4dUlDQWdJSEpsZEhWeWJpQm5aWFFvYTJWNUtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2MyVjBLR3RsZVN3Z2RtRnNkV1VwTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJuWlhRZ0tHdGxlU2tnZTF4dUlDQnlaWFIxY200Z1NsTlBUaTV3WVhKelpTaHNjeTVuWlhSSmRHVnRLR3RsZVNrcE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCelpYUWdLR3RsZVN3Z2RtRnNkV1VwSUh0Y2JpQWdkSEo1SUh0Y2JpQWdJQ0JzY3k1elpYUkpkR1Z0S0d0bGVTd2dTbE5QVGk1emRISnBibWRwWm5rb2RtRnNkV1VwS1R0Y2JpQWdJQ0J5WlhSMWNtNGdkSEoxWlR0Y2JpQWdmU0JqWVhSamFDQW9aU2tnZTF4dUlDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdmVnh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnlaVzF2ZG1VZ0tHdGxlU2tnZTF4dUlDQnlaWFIxY200Z2JITXVjbVZ0YjNabFNYUmxiU2hyWlhrcE8xeHVmVnh1WEc1bWRXNWpkR2x2YmlCamJHVmhjaUFvS1NCN1hHNGdJSEpsZEhWeWJpQnNjeTVqYkdWaGNpZ3BPMXh1ZlZ4dVhHNWhZMk5sYzNOdmNpNXpaWFFnUFNCelpYUTdYRzVoWTJObGMzTnZjaTVuWlhRZ1BTQm5aWFE3WEc1aFkyTmxjM052Y2k1eVpXMXZkbVVnUFNCeVpXMXZkbVU3WEc1aFkyTmxjM052Y2k1amJHVmhjaUE5SUdOc1pXRnlPMXh1WVdOalpYTnpiM0l1YjI0Z1BTQjBjbUZqYTJsdVp5NXZianRjYm1GalkyVnpjMjl5TG05bVppQTlJSFJ5WVdOcmFXNW5MbTltWmp0Y2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQmhZMk5sYzNOdmNqdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1zID0ge307XG5cbmZ1bmN0aW9uIGdldEl0ZW0gKGtleSkge1xuICByZXR1cm4ga2V5IGluIG1zID8gbXNba2V5XSA6IG51bGw7XG59XG5cbmZ1bmN0aW9uIHNldEl0ZW0gKGtleSwgdmFsdWUpIHtcbiAgbXNba2V5XSA9IHZhbHVlO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuZnVuY3Rpb24gcmVtb3ZlSXRlbSAoa2V5KSB7XG4gIHZhciBmb3VuZCA9IGtleSBpbiBtcztcbiAgaWYgKGZvdW5kKSB7XG4gICAgcmV0dXJuIGRlbGV0ZSBtc1trZXldO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gY2xlYXIgKCkge1xuICBtcyA9IHt9O1xuICByZXR1cm4gdHJ1ZTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGdldEl0ZW06IGdldEl0ZW0sXG4gIHNldEl0ZW06IHNldEl0ZW0sXG4gIHJlbW92ZUl0ZW06IHJlbW92ZUl0ZW0sXG4gIGNsZWFyOiBjbGVhclxufTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGxpc3RlbmVycyA9IHt9O1xudmFyIGxpc3RlbmluZyA9IGZhbHNlO1xuXG5mdW5jdGlvbiBsaXN0ZW4gKCkge1xuICBpZiAoZ2xvYmFsLmFkZEV2ZW50TGlzdGVuZXIpIHtcbiAgICBnbG9iYWwuYWRkRXZlbnRMaXN0ZW5lcignc3RvcmFnZScsIGNoYW5nZSwgZmFsc2UpO1xuICB9IGVsc2UgaWYgKGdsb2JhbC5hdHRhY2hFdmVudCkge1xuICAgIGdsb2JhbC5hdHRhY2hFdmVudCgnb25zdG9yYWdlJywgY2hhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICBnbG9iYWwub25zdG9yYWdlID0gY2hhbmdlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNoYW5nZSAoZSkge1xuICBpZiAoIWUpIHtcbiAgICBlID0gZ2xvYmFsLmV2ZW50O1xuICB9XG4gIHZhciBhbGwgPSBsaXN0ZW5lcnNbZS5rZXldO1xuICBpZiAoYWxsKSB7XG4gICAgYWxsLmZvckVhY2goZmlyZSk7XG4gIH1cblxuICBmdW5jdGlvbiBmaXJlIChsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVyKEpTT04ucGFyc2UoZS5uZXdWYWx1ZSksIEpTT04ucGFyc2UoZS5vbGRWYWx1ZSksIGUudXJsIHx8IGUudXJpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvbiAoa2V5LCBmbikge1xuICBpZiAobGlzdGVuZXJzW2tleV0pIHtcbiAgICBsaXN0ZW5lcnNba2V5XS5wdXNoKGZuKTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0ZW5lcnNba2V5XSA9IFtmbl07XG4gIH1cbiAgaWYgKGxpc3RlbmluZyA9PT0gZmFsc2UpIHtcbiAgICBsaXN0ZW4oKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBvZmYgKGtleSwgZm4pIHtcbiAgdmFyIG5zID0gbGlzdGVuZXJzW2tleV07XG4gIGlmIChucy5sZW5ndGggPiAxKSB7XG4gICAgbnMuc3BsaWNlKG5zLmluZGV4T2YoZm4pLCAxKTtcbiAgfSBlbHNlIHtcbiAgICBsaXN0ZW5lcnNba2V5XSA9IFtdO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBvbjogb24sXG4gIG9mZjogb2ZmXG59O1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkltNXZaR1ZmYlc5a2RXeGxjeTlzYjJOaGJDMXpkRzl5WVdkbEwzUnlZV05yYVc1bkxtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHeHBjM1JsYm1WeWN5QTlJSHQ5TzF4dWRtRnlJR3hwYzNSbGJtbHVaeUE5SUdaaGJITmxPMXh1WEc1bWRXNWpkR2x2YmlCc2FYTjBaVzRnS0NrZ2UxeHVJQ0JwWmlBb1oyeHZZbUZzTG1Ga1pFVjJaVzUwVEdsemRHVnVaWElwSUh0Y2JpQWdJQ0JuYkc5aVlXd3VZV1JrUlhabGJuUk1hWE4wWlc1bGNpZ25jM1J2Y21GblpTY3NJR05vWVc1blpTd2dabUZzYzJVcE8xeHVJQ0I5SUdWc2MyVWdhV1lnS0dkc2IySmhiQzVoZEhSaFkyaEZkbVZ1ZENrZ2UxeHVJQ0FnSUdkc2IySmhiQzVoZEhSaFkyaEZkbVZ1ZENnbmIyNXpkRzl5WVdkbEp5d2dZMmhoYm1kbEtUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQm5iRzlpWVd3dWIyNXpkRzl5WVdkbElEMGdZMmhoYm1kbE8xeHVJQ0I5WEc1OVhHNWNibVoxYm1OMGFXOXVJR05vWVc1blpTQW9aU2tnZTF4dUlDQnBaaUFvSVdVcElIdGNiaUFnSUNCbElEMGdaMnh2WW1Gc0xtVjJaVzUwTzF4dUlDQjlYRzRnSUhaaGNpQmhiR3dnUFNCc2FYTjBaVzVsY25OYlpTNXJaWGxkTzF4dUlDQnBaaUFvWVd4c0tTQjdYRzRnSUNBZ1lXeHNMbVp2Y2tWaFkyZ29abWx5WlNrN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQm1hWEpsSUNoc2FYTjBaVzVsY2lrZ2UxeHVJQ0FnSUd4cGMzUmxibVZ5S0VwVFQwNHVjR0Z5YzJVb1pTNXVaWGRXWVd4MVpTa3NJRXBUVDA0dWNHRnljMlVvWlM1dmJHUldZV3gxWlNrc0lHVXVkWEpzSUh4OElHVXVkWEpwS1R0Y2JpQWdmVnh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnZiaUFvYTJWNUxDQm1iaWtnZTF4dUlDQnBaaUFvYkdsemRHVnVaWEp6VzJ0bGVWMHBJSHRjYmlBZ0lDQnNhWE4wWlc1bGNuTmJhMlY1WFM1d2RYTm9LR1p1S1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCc2FYTjBaVzVsY25OYmEyVjVYU0E5SUZ0bWJsMDdYRzRnSUgxY2JpQWdhV1lnS0d4cGMzUmxibWx1WnlBOVBUMGdabUZzYzJVcElIdGNiaUFnSUNCc2FYTjBaVzRvS1R0Y2JpQWdmVnh1ZlZ4dVhHNW1kVzVqZEdsdmJpQnZabVlnS0d0bGVTd2dabTRwSUh0Y2JpQWdkbUZ5SUc1eklEMGdiR2x6ZEdWdVpYSnpXMnRsZVYwN1hHNGdJR2xtSUNodWN5NXNaVzVuZEdnZ1BpQXhLU0I3WEc0Z0lDQWdibk11YzNCc2FXTmxLRzV6TG1sdVpHVjRUMllvWm00cExDQXhLVHRjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0JzYVhOMFpXNWxjbk5iYTJWNVhTQTlJRnRkTzF4dUlDQjlYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2UxeHVJQ0J2YmpvZ2IyNHNYRzRnSUc5bVpqb2diMlptWEc1OU8xeHVJbDE5IiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgSW5wdXRTdGF0ZSA9IHJlcXVpcmUoJy4vSW5wdXRTdGF0ZScpO1xuXG5mdW5jdGlvbiBJbnB1dEhpc3RvcnkgKHN1cmZhY2UsIG1vZGUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcblxuICBzdGF0ZS5pbnB1dE1vZGUgPSBtb2RlO1xuICBzdGF0ZS5zdXJmYWNlID0gc3VyZmFjZTtcbiAgc3RhdGUucmVzZXQoKTtcblxuICBsaXN0ZW4oc3VyZmFjZS50ZXh0YXJlYSk7XG4gIGxpc3RlbihzdXJmYWNlLmVkaXRhYmxlKTtcblxuICBmdW5jdGlvbiBsaXN0ZW4gKGVsKSB7XG4gICAgdmFyIHBhc3RlSGFuZGxlciA9IHNlbGZpZShoYW5kbGVQYXN0ZSk7XG4gICAgY3Jvc3N2ZW50LmFkZChlbCwgJ2tleXByZXNzJywgcHJldmVudEN0cmxZWik7XG4gICAgY3Jvc3N2ZW50LmFkZChlbCwgJ2tleWRvd24nLCBzZWxmaWUoaGFuZGxlQ3RybFlaKSk7XG4gICAgY3Jvc3N2ZW50LmFkZChlbCwgJ2tleWRvd24nLCBzZWxmaWUoaGFuZGxlTW9kZUNoYW5nZSkpO1xuICAgIGNyb3NzdmVudC5hZGQoZWwsICdtb3VzZWRvd24nLCBzZXRNb3ZpbmcpO1xuICAgIGVsLm9ucGFzdGUgPSBwYXN0ZUhhbmRsZXI7XG4gICAgZWwub25kcm9wID0gcGFzdGVIYW5kbGVyO1xuICB9XG5cbiAgZnVuY3Rpb24gc2V0TW92aW5nICgpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCdtb3ZpbmcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNlbGZpZSAoZm4pIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlciAoZSkgeyByZXR1cm4gZm4uY2FsbChudWxsLCBzdGF0ZSwgZSk7IH07XG4gIH1cbn1cblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5zZXRJbnB1dE1vZGUgPSBmdW5jdGlvbiAobW9kZSkge1xuICB2YXIgc3RhdGUgPSB0aGlzO1xuICBzdGF0ZS5pbnB1dE1vZGUgPSBtb2RlO1xuICBzdGF0ZS5yZXNldCgpO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgc3RhdGUuaW5wdXRTdGF0ZSA9IG51bGw7XG4gIHN0YXRlLmxhc3RTdGF0ZSA9IG51bGw7XG4gIHN0YXRlLmhpc3RvcnkgPSBbXTtcbiAgc3RhdGUuaGlzdG9yeVBvaW50ZXIgPSAwO1xuICBzdGF0ZS5oaXN0b3J5TW9kZSA9ICdub25lJztcbiAgc3RhdGUucmVmcmVzaGluZyA9IG51bGw7XG4gIHN0YXRlLnJlZnJlc2hTdGF0ZSh0cnVlKTtcbiAgc3RhdGUuc2F2ZVN0YXRlKCk7XG4gIHJldHVybiBzdGF0ZTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuc2V0Q29tbWFuZE1vZGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIHN0YXRlLmhpc3RvcnlNb2RlID0gJ2NvbW1hbmQnO1xuICBzdGF0ZS5zYXZlU3RhdGUoKTtcbiAgc3RhdGUucmVmcmVzaGluZyA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xuICB9LCAwKTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUuY2FuVW5kbyA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuaGlzdG9yeVBvaW50ZXIgPiAxO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5jYW5SZWRvID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5oaXN0b3J5W3RoaXMuaGlzdG9yeVBvaW50ZXIgKyAxXTtcbn07XG5cbklucHV0SGlzdG9yeS5wcm90b3R5cGUudW5kbyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgaWYgKHN0YXRlLmNhblVuZG8oKSkge1xuICAgIGlmIChzdGF0ZS5sYXN0U3RhdGUpIHtcbiAgICAgIHN0YXRlLmxhc3RTdGF0ZS5yZXN0b3JlKCk7XG4gICAgICBzdGF0ZS5sYXN0U3RhdGUgPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyXSA9IG5ldyBJbnB1dFN0YXRlKHN0YXRlLnN1cmZhY2UsIHN0YXRlLmlucHV0TW9kZSk7XG4gICAgICBzdGF0ZS5oaXN0b3J5Wy0tc3RhdGUuaGlzdG9yeVBvaW50ZXJdLnJlc3RvcmUoKTtcbiAgICB9XG4gIH1cbiAgc3RhdGUuaGlzdG9yeU1vZGUgPSAnbm9uZSc7XG4gIHN0YXRlLnN1cmZhY2UuZm9jdXMoc3RhdGUuaW5wdXRNb2RlKTtcbiAgc3RhdGUucmVmcmVzaFN0YXRlKCk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnJlZG8gPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIGlmIChzdGF0ZS5jYW5SZWRvKCkpIHtcbiAgICBzdGF0ZS5oaXN0b3J5Wysrc3RhdGUuaGlzdG9yeVBvaW50ZXJdLnJlc3RvcmUoKTtcbiAgfVxuXG4gIHN0YXRlLmhpc3RvcnlNb2RlID0gJ25vbmUnO1xuICBzdGF0ZS5zdXJmYWNlLmZvY3VzKHN0YXRlLmlucHV0TW9kZSk7XG4gIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xufTtcblxuSW5wdXRIaXN0b3J5LnByb3RvdHlwZS5zZXRNb2RlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXM7XG4gIGlmIChzdGF0ZS5oaXN0b3J5TW9kZSAhPT0gdmFsdWUpIHtcbiAgICBzdGF0ZS5oaXN0b3J5TW9kZSA9IHZhbHVlO1xuICAgIHN0YXRlLnNhdmVTdGF0ZSgpO1xuICB9XG4gIHN0YXRlLnJlZnJlc2hpbmcgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICBzdGF0ZS5yZWZyZXNoU3RhdGUoKTtcbiAgfSwgMSk7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnJlZnJlc2hTdGF0ZSA9IGZ1bmN0aW9uIChpbml0aWFsU3RhdGUpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgc3RhdGUuaW5wdXRTdGF0ZSA9IG5ldyBJbnB1dFN0YXRlKHN0YXRlLnN1cmZhY2UsIHN0YXRlLmlucHV0TW9kZSwgaW5pdGlhbFN0YXRlKTtcbiAgc3RhdGUucmVmcmVzaGluZyA9IG51bGw7XG59O1xuXG5JbnB1dEhpc3RvcnkucHJvdG90eXBlLnNhdmVTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0gdGhpcztcbiAgdmFyIGN1cnJlbnQgPSBzdGF0ZS5pbnB1dFN0YXRlIHx8IG5ldyBJbnB1dFN0YXRlKHN0YXRlLnN1cmZhY2UsIHN0YXRlLmlucHV0TW9kZSk7XG5cbiAgaWYgKHN0YXRlLmhpc3RvcnlNb2RlID09PSAnbW92aW5nJykge1xuICAgIGlmICghc3RhdGUubGFzdFN0YXRlKSB7XG4gICAgICBzdGF0ZS5sYXN0U3RhdGUgPSBjdXJyZW50O1xuICAgIH1cbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHN0YXRlLmxhc3RTdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5oaXN0b3J5W3N0YXRlLmhpc3RvcnlQb2ludGVyIC0gMV0udGV4dCAhPT0gc3RhdGUubGFzdFN0YXRlLnRleHQpIHtcbiAgICAgIHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXIrK10gPSBzdGF0ZS5sYXN0U3RhdGU7XG4gICAgfVxuICAgIHN0YXRlLmxhc3RTdGF0ZSA9IG51bGw7XG4gIH1cbiAgc3RhdGUuaGlzdG9yeVtzdGF0ZS5oaXN0b3J5UG9pbnRlcisrXSA9IGN1cnJlbnQ7XG4gIHN0YXRlLmhpc3Rvcnlbc3RhdGUuaGlzdG9yeVBvaW50ZXIgKyAxXSA9IG51bGw7XG59O1xuXG5mdW5jdGlvbiBoYW5kbGVDdHJsWVogKHN0YXRlLCBlKSB7XG4gIHZhciBoYW5kbGVkID0gZmFsc2U7XG4gIHZhciBrZXlDb2RlID0gZS5jaGFyQ29kZSB8fCBlLmtleUNvZGU7XG4gIHZhciBrZXlDb2RlQ2hhciA9IFN0cmluZy5mcm9tQ2hhckNvZGUoa2V5Q29kZSk7XG5cbiAgaWYgKGUuY3RybEtleSB8fCBlLm1ldGFLZXkpIHtcbiAgICBzd2l0Y2ggKGtleUNvZGVDaGFyLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgIGNhc2UgJ3knOlxuICAgICAgICBzdGF0ZS5yZWRvKCk7XG4gICAgICAgIGhhbmRsZWQgPSB0cnVlO1xuICAgICAgICBicmVhaztcblxuICAgICAgY2FzZSAneic6XG4gICAgICAgIGlmIChlLnNoaWZ0S2V5KSB7XG4gICAgICAgICAgc3RhdGUucmVkbygpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0YXRlLnVuZG8oKTtcbiAgICAgICAgfVxuICAgICAgICBoYW5kbGVkID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgfVxuICB9XG5cbiAgaWYgKGhhbmRsZWQgJiYgZS5wcmV2ZW50RGVmYXVsdCkge1xuICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVNb2RlQ2hhbmdlIChzdGF0ZSwgZSkge1xuICBpZiAoZS5jdHJsS2V5IHx8IGUubWV0YUtleSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBrZXlDb2RlID0gZS5rZXlDb2RlO1xuXG4gIGlmICgoa2V5Q29kZSA+PSAzMyAmJiBrZXlDb2RlIDw9IDQwKSB8fCAoa2V5Q29kZSA+PSA2MzIzMiAmJiBrZXlDb2RlIDw9IDYzMjM1KSkge1xuICAgIHN0YXRlLnNldE1vZGUoJ21vdmluZycpO1xuICB9IGVsc2UgaWYgKGtleUNvZGUgPT09IDggfHwga2V5Q29kZSA9PT0gNDYgfHwga2V5Q29kZSA9PT0gMTI3KSB7XG4gICAgc3RhdGUuc2V0TW9kZSgnZGVsZXRpbmcnKTtcbiAgfSBlbHNlIGlmIChrZXlDb2RlID09PSAxMykge1xuICAgIHN0YXRlLnNldE1vZGUoJ25ld2xpbmVzJyk7XG4gIH0gZWxzZSBpZiAoa2V5Q29kZSA9PT0gMjcpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCdlc2NhcGUnKTtcbiAgfSBlbHNlIGlmICgoa2V5Q29kZSA8IDE2IHx8IGtleUNvZGUgPiAyMCkgJiYga2V5Q29kZSAhPT0gOTEpIHtcbiAgICBzdGF0ZS5zZXRNb2RlKCd0eXBpbmcnKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBoYW5kbGVQYXN0ZSAoc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmlucHV0U3RhdGUgJiYgc3RhdGUuaW5wdXRTdGF0ZS50ZXh0ICE9PSBzdGF0ZS5zdXJmYWNlLnJlYWQoc3RhdGUuaW5wdXRNb2RlKSAmJiBzdGF0ZS5yZWZyZXNoaW5nID09PSBudWxsKSB7XG4gICAgc3RhdGUuaGlzdG9yeU1vZGUgPSAncGFzdGUnO1xuICAgIHN0YXRlLnNhdmVTdGF0ZSgpO1xuICAgIHN0YXRlLnJlZnJlc2hTdGF0ZSgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByZXZlbnRDdHJsWVogKGUpIHtcbiAgdmFyIGtleUNvZGUgPSBlLmNoYXJDb2RlIHx8IGUua2V5Q29kZTtcbiAgdmFyIHl6ID0ga2V5Q29kZSA9PT0gODkgfHwga2V5Q29kZSA9PT0gOTA7XG4gIHZhciBjdHJsID0gZS5jdHJsS2V5IHx8IGUubWV0YUtleTtcbiAgaWYgKGN0cmwgJiYgeXopIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBJbnB1dEhpc3Rvcnk7XG4iLCIoZnVuY3Rpb24gKGdsb2JhbCl7XG4ndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBnbG9iYWwuZG9jdW1lbnQ7XG52YXIgaXNWaXNpYmxlRWxlbWVudCA9IHJlcXVpcmUoJy4vaXNWaXNpYmxlRWxlbWVudCcpO1xudmFyIGZpeEVPTCA9IHJlcXVpcmUoJy4vZml4RU9MJyk7XG52YXIgTWFya2Rvd25DaHVua3MgPSByZXF1aXJlKCcuL21hcmtkb3duL01hcmtkb3duQ2h1bmtzJyk7XG52YXIgSHRtbENodW5rcyA9IHJlcXVpcmUoJy4vaHRtbC9IdG1sQ2h1bmtzJyk7XG52YXIgY2h1bmtzID0ge1xuICBtYXJrZG93bjogTWFya2Rvd25DaHVua3MsXG4gIGh0bWw6IEh0bWxDaHVua3MsXG4gIHd5c2l3eWc6IEh0bWxDaHVua3Ncbn07XG5cbmZ1bmN0aW9uIElucHV0U3RhdGUgKHN1cmZhY2UsIG1vZGUsIGluaXRpYWxTdGF0ZSkge1xuICB0aGlzLm1vZGUgPSBtb2RlO1xuICB0aGlzLnN1cmZhY2UgPSBzdXJmYWNlO1xuICB0aGlzLmluaXRpYWxTdGF0ZSA9IGluaXRpYWxTdGF0ZSB8fCBmYWxzZTtcbiAgdGhpcy5pbml0KCk7XG59XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGVsID0gc2VsZi5zdXJmYWNlLmN1cnJlbnQoc2VsZi5tb2RlKTtcbiAgaWYgKCFpc1Zpc2libGVFbGVtZW50KGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXRoaXMuaW5pdGlhbFN0YXRlICYmIGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSBlbCkge1xuICAgIHJldHVybjtcbiAgfVxuICBzZWxmLnN1cmZhY2UucmVhZFNlbGVjdGlvbihzZWxmKTtcbiAgc2VsZi5zY3JvbGxUb3AgPSBlbC5zY3JvbGxUb3A7XG4gIGlmICghc2VsZi50ZXh0KSB7XG4gICAgc2VsZi50ZXh0ID0gc2VsZi5zdXJmYWNlLnJlYWQoc2VsZi5tb2RlKTtcbiAgfVxufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2VsZWN0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHNlbGYuc3VyZmFjZS5jdXJyZW50KHNlbGYubW9kZSk7XG4gIGlmICghaXNWaXNpYmxlRWxlbWVudChlbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgc2VsZi5zdXJmYWNlLndyaXRlU2VsZWN0aW9uKHNlbGYpO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUucmVzdG9yZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgZWwgPSBzZWxmLnN1cmZhY2UuY3VycmVudChzZWxmLm1vZGUpO1xuICBpZiAodHlwZW9mIHNlbGYudGV4dCA9PT0gJ3N0cmluZycgJiYgc2VsZi50ZXh0ICE9PSBzZWxmLnN1cmZhY2UucmVhZChzZWxmLm1vZGUpKSB7XG4gICAgc2VsZi5zdXJmYWNlLndyaXRlKHNlbGYubW9kZSwgc2VsZi50ZXh0KTtcbiAgfVxuICBzZWxmLnNlbGVjdCgpO1xuICBlbC5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbn07XG5cbklucHV0U3RhdGUucHJvdG90eXBlLmdldENodW5rcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2h1bmsgPSBuZXcgY2h1bmtzW3NlbGYubW9kZV0oKTtcbiAgY2h1bmsuYmVmb3JlID0gZml4RU9MKHNlbGYudGV4dC5zdWJzdHJpbmcoMCwgc2VsZi5zdGFydCkpO1xuICBjaHVuay5zdGFydFRhZyA9ICcnO1xuICBjaHVuay5zZWxlY3Rpb24gPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLnN0YXJ0LCBzZWxmLmVuZCkpO1xuICBjaHVuay5lbmRUYWcgPSAnJztcbiAgY2h1bmsuYWZ0ZXIgPSBmaXhFT0woc2VsZi50ZXh0LnN1YnN0cmluZyhzZWxmLmVuZCkpO1xuICBjaHVuay5zY3JvbGxUb3AgPSBzZWxmLnNjcm9sbFRvcDtcbiAgc2VsZi5jYWNoZWRDaHVua3MgPSBjaHVuaztcbiAgcmV0dXJuIGNodW5rO1xufTtcblxuSW5wdXRTdGF0ZS5wcm90b3R5cGUuc2V0Q2h1bmtzID0gZnVuY3Rpb24gKGNodW5rKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgY2h1bmsuYmVmb3JlID0gY2h1bmsuYmVmb3JlICsgY2h1bmsuc3RhcnRUYWc7XG4gIGNodW5rLmFmdGVyID0gY2h1bmsuZW5kVGFnICsgY2h1bmsuYWZ0ZXI7XG4gIHNlbGYuc3RhcnQgPSBjaHVuay5iZWZvcmUubGVuZ3RoO1xuICBzZWxmLmVuZCA9IGNodW5rLmJlZm9yZS5sZW5ndGggKyBjaHVuay5zZWxlY3Rpb24ubGVuZ3RoO1xuICBzZWxmLnRleHQgPSBjaHVuay5iZWZvcmUgKyBjaHVuay5zZWxlY3Rpb24gKyBjaHVuay5hZnRlcjtcbiAgc2VsZi5zY3JvbGxUb3AgPSBjaHVuay5zY3JvbGxUb3A7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IElucHV0U3RhdGU7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OUpibkIxZEZOMFlYUmxMbXB6SWwwc0ltNWhiV1Z6SWpwYlhTd2liV0Z3Y0dsdVozTWlPaUk3UVVGQlFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQklpd2labWxzWlNJNkltZGxibVZ5WVhSbFpDNXFjeUlzSW5OdmRYSmpaVkp2YjNRaU9pSWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUluZFhObElITjBjbWxqZENjN1hHNWNiblpoY2lCa2IyTWdQU0JuYkc5aVlXd3VaRzlqZFcxbGJuUTdYRzUyWVhJZ2FYTldhWE5wWW14bFJXeGxiV1Z1ZENBOUlISmxjWFZwY21Vb0p5NHZhWE5XYVhOcFlteGxSV3hsYldWdWRDY3BPMXh1ZG1GeUlHWnBlRVZQVENBOUlISmxjWFZwY21Vb0p5NHZabWw0UlU5TUp5azdYRzUyWVhJZ1RXRnlhMlJ2ZDI1RGFIVnVhM01nUFNCeVpYRjFhWEpsS0NjdUwyMWhjbXRrYjNkdUwwMWhjbXRrYjNkdVEyaDFibXR6SnlrN1hHNTJZWElnU0hSdGJFTm9kVzVyY3lBOUlISmxjWFZwY21Vb0p5NHZhSFJ0YkM5SWRHMXNRMmgxYm10ekp5azdYRzUyWVhJZ1kyaDFibXR6SUQwZ2UxeHVJQ0J0WVhKclpHOTNiam9nVFdGeWEyUnZkMjVEYUhWdWEzTXNYRzRnSUdoMGJXdzZJRWgwYld4RGFIVnVhM01zWEc0Z0lIZDVjMmwzZVdjNklFaDBiV3hEYUhWdWEzTmNibjA3WEc1Y2JtWjFibU4wYVc5dUlFbHVjSFYwVTNSaGRHVWdLSE4xY21aaFkyVXNJRzF2WkdVc0lHbHVhWFJwWVd4VGRHRjBaU2tnZTF4dUlDQjBhR2x6TG0xdlpHVWdQU0J0YjJSbE8xeHVJQ0IwYUdsekxuTjFjbVpoWTJVZ1BTQnpkWEptWVdObE8xeHVJQ0IwYUdsekxtbHVhWFJwWVd4VGRHRjBaU0E5SUdsdWFYUnBZV3hUZEdGMFpTQjhmQ0JtWVd4elpUdGNiaUFnZEdocGN5NXBibWwwS0NrN1hHNTlYRzVjYmtsdWNIVjBVM1JoZEdVdWNISnZkRzkwZVhCbExtbHVhWFFnUFNCbWRXNWpkR2x2YmlBb0tTQjdYRzRnSUhaaGNpQnpaV3htSUQwZ2RHaHBjenRjYmlBZ2RtRnlJR1ZzSUQwZ2MyVnNaaTV6ZFhKbVlXTmxMbU4xY25KbGJuUW9jMlZzWmk1dGIyUmxLVHRjYmlBZ2FXWWdLQ0ZwYzFacGMybGliR1ZGYkdWdFpXNTBLR1ZzS1NrZ2UxeHVJQ0FnSUhKbGRIVnlianRjYmlBZ2ZWeHVJQ0JwWmlBb0lYUm9hWE11YVc1cGRHbGhiRk4wWVhSbElDWW1JR1J2WXk1aFkzUnBkbVZGYkdWdFpXNTBJQ1ltSUdSdll5NWhZM1JwZG1WRmJHVnRaVzUwSUNFOVBTQmxiQ2tnZTF4dUlDQWdJSEpsZEhWeWJqdGNiaUFnZlZ4dUlDQnpaV3htTG5OMWNtWmhZMlV1Y21WaFpGTmxiR1ZqZEdsdmJpaHpaV3htS1R0Y2JpQWdjMlZzWmk1elkzSnZiR3hVYjNBZ1BTQmxiQzV6WTNKdmJHeFViM0E3WEc0Z0lHbG1JQ2doYzJWc1ppNTBaWGgwS1NCN1hHNGdJQ0FnYzJWc1ppNTBaWGgwSUQwZ2MyVnNaaTV6ZFhKbVlXTmxMbkpsWVdRb2MyVnNaaTV0YjJSbEtUdGNiaUFnZlZ4dWZUdGNibHh1U1c1d2RYUlRkR0YwWlM1d2NtOTBiM1I1Y0dVdWMyVnNaV04wSUQwZ1puVnVZM1JwYjI0Z0tDa2dlMXh1SUNCMllYSWdjMlZzWmlBOUlIUm9hWE03WEc0Z0lIWmhjaUJsYkNBOUlITmxiR1l1YzNWeVptRmpaUzVqZFhKeVpXNTBLSE5sYkdZdWJXOWtaU2s3WEc0Z0lHbG1JQ2doYVhOV2FYTnBZbXhsUld4bGJXVnVkQ2hsYkNrcElIdGNiaUFnSUNCeVpYUjFjbTQ3WEc0Z0lIMWNiaUFnYzJWc1ppNXpkWEptWVdObExuZHlhWFJsVTJWc1pXTjBhVzl1S0hObGJHWXBPMXh1ZlR0Y2JseHVTVzV3ZFhSVGRHRjBaUzV3Y205MGIzUjVjR1V1Y21WemRHOXlaU0E5SUdaMWJtTjBhVzl1SUNncElIdGNiaUFnZG1GeUlITmxiR1lnUFNCMGFHbHpPMXh1SUNCMllYSWdaV3dnUFNCelpXeG1Mbk4xY21aaFkyVXVZM1Z5Y21WdWRDaHpaV3htTG0xdlpHVXBPMXh1SUNCcFppQW9kSGx3Wlc5bUlITmxiR1l1ZEdWNGRDQTlQVDBnSjNOMGNtbHVaeWNnSmlZZ2MyVnNaaTUwWlhoMElDRTlQU0J6Wld4bUxuTjFjbVpoWTJVdWNtVmhaQ2h6Wld4bUxtMXZaR1VwS1NCN1hHNGdJQ0FnYzJWc1ppNXpkWEptWVdObExuZHlhWFJsS0hObGJHWXViVzlrWlN3Z2MyVnNaaTUwWlhoMEtUdGNiaUFnZlZ4dUlDQnpaV3htTG5ObGJHVmpkQ2dwTzF4dUlDQmxiQzV6WTNKdmJHeFViM0FnUFNCelpXeG1Mbk5qY205c2JGUnZjRHRjYm4wN1hHNWNia2x1Y0hWMFUzUmhkR1V1Y0hKdmRHOTBlWEJsTG1kbGRFTm9kVzVyY3lBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2RtRnlJSE5sYkdZZ1BTQjBhR2x6TzF4dUlDQjJZWElnWTJoMWJtc2dQU0J1WlhjZ1kyaDFibXR6VzNObGJHWXViVzlrWlYwb0tUdGNiaUFnWTJoMWJtc3VZbVZtYjNKbElEMGdabWw0UlU5TUtITmxiR1l1ZEdWNGRDNXpkV0p6ZEhKcGJtY29NQ3dnYzJWc1ppNXpkR0Z5ZENrcE8xeHVJQ0JqYUhWdWF5NXpkR0Z5ZEZSaFp5QTlJQ2NuTzF4dUlDQmphSFZ1YXk1elpXeGxZM1JwYjI0Z1BTQm1hWGhGVDB3b2MyVnNaaTUwWlhoMExuTjFZbk4wY21sdVp5aHpaV3htTG5OMFlYSjBMQ0J6Wld4bUxtVnVaQ2twTzF4dUlDQmphSFZ1YXk1bGJtUlVZV2NnUFNBbkp6dGNiaUFnWTJoMWJtc3VZV1owWlhJZ1BTQm1hWGhGVDB3b2MyVnNaaTUwWlhoMExuTjFZbk4wY21sdVp5aHpaV3htTG1WdVpDa3BPMXh1SUNCamFIVnVheTV6WTNKdmJHeFViM0FnUFNCelpXeG1Mbk5qY205c2JGUnZjRHRjYmlBZ2MyVnNaaTVqWVdOb1pXUkRhSFZ1YTNNZ1BTQmphSFZ1YXp0Y2JpQWdjbVYwZFhKdUlHTm9kVzVyTzF4dWZUdGNibHh1U1c1d2RYUlRkR0YwWlM1d2NtOTBiM1I1Y0dVdWMyVjBRMmgxYm10eklEMGdablZ1WTNScGIyNGdLR05vZFc1cktTQjdYRzRnSUhaaGNpQnpaV3htSUQwZ2RHaHBjenRjYmlBZ1kyaDFibXN1WW1WbWIzSmxJRDBnWTJoMWJtc3VZbVZtYjNKbElDc2dZMmgxYm1zdWMzUmhjblJVWVdjN1hHNGdJR05vZFc1ckxtRm1kR1Z5SUQwZ1kyaDFibXN1Wlc1a1ZHRm5JQ3NnWTJoMWJtc3VZV1owWlhJN1hHNGdJSE5sYkdZdWMzUmhjblFnUFNCamFIVnVheTVpWldadmNtVXViR1Z1WjNSb08xeHVJQ0J6Wld4bUxtVnVaQ0E5SUdOb2RXNXJMbUpsWm05eVpTNXNaVzVuZEdnZ0t5QmphSFZ1YXk1elpXeGxZM1JwYjI0dWJHVnVaM1JvTzF4dUlDQnpaV3htTG5SbGVIUWdQU0JqYUhWdWF5NWlaV1p2Y21VZ0t5QmphSFZ1YXk1elpXeGxZM1JwYjI0Z0t5QmphSFZ1YXk1aFpuUmxjanRjYmlBZ2MyVnNaaTV6WTNKdmJHeFViM0FnUFNCamFIVnVheTV6WTNKdmJHeFViM0E3WEc1OU8xeHVYRzV0YjJSMWJHVXVaWGh3YjNKMGN5QTlJRWx1Y0hWMFUzUmhkR1U3WEc0aVhYMD0iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciBjb21tYW5kcyA9IHtcbiAgbWFya2Rvd246IHtcbiAgICBib2xkT3JJdGFsaWM6IHJlcXVpcmUoJy4vbWFya2Rvd24vYm9sZE9ySXRhbGljJyksXG4gICAgbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ6IHJlcXVpcmUoJy4vbWFya2Rvd24vbGlua09ySW1hZ2VPckF0dGFjaG1lbnQnKSxcbiAgICBibG9ja3F1b3RlOiByZXF1aXJlKCcuL21hcmtkb3duL2Jsb2NrcXVvdGUnKSxcbiAgICBjb2RlYmxvY2s6IHJlcXVpcmUoJy4vbWFya2Rvd24vY29kZWJsb2NrJyksXG4gICAgaGVhZGluZzogcmVxdWlyZSgnLi9tYXJrZG93bi9oZWFkaW5nJyksXG4gICAgbGlzdDogcmVxdWlyZSgnLi9tYXJrZG93bi9saXN0JyksXG4gICAgaHI6IHJlcXVpcmUoJy4vbWFya2Rvd24vaHInKVxuICB9LFxuICBodG1sOiB7XG4gICAgYm9sZE9ySXRhbGljOiByZXF1aXJlKCcuL2h0bWwvYm9sZE9ySXRhbGljJyksXG4gICAgbGlua09ySW1hZ2VPckF0dGFjaG1lbnQ6IHJlcXVpcmUoJy4vaHRtbC9saW5rT3JJbWFnZU9yQXR0YWNobWVudCcpLFxuICAgIGJsb2NrcXVvdGU6IHJlcXVpcmUoJy4vaHRtbC9ibG9ja3F1b3RlJyksXG4gICAgY29kZWJsb2NrOiByZXF1aXJlKCcuL2h0bWwvY29kZWJsb2NrJyksXG4gICAgaGVhZGluZzogcmVxdWlyZSgnLi9odG1sL2hlYWRpbmcnKSxcbiAgICBsaXN0OiByZXF1aXJlKCcuL2h0bWwvbGlzdCcpLFxuICAgIGhyOiByZXF1aXJlKCcuL2h0bWwvaHInKVxuICB9XG59O1xuXG5jb21tYW5kcy53eXNpd3lnID0gY29tbWFuZHMuaHRtbDtcblxuZnVuY3Rpb24gYmluZENvbW1hbmRzIChzdXJmYWNlLCBvcHRpb25zLCBlZGl0b3IpIHtcbiAgYmluZCgnYm9sZCcsICdjbWQrYicsIGJvbGQpO1xuICBiaW5kKCdpdGFsaWMnLCAnY21kK2knLCBpdGFsaWMpO1xuICBiaW5kKCdxdW90ZScsICdjbWQraicsIHJvdXRlcignYmxvY2txdW90ZScpKTtcbiAgYmluZCgnY29kZScsICdjbWQrZScsIGNvZGUpO1xuICBiaW5kKCdvbCcsICdjbWQrbycsIG9sKTtcbiAgYmluZCgndWwnLCAnY21kK3UnLCB1bCk7XG4gIGJpbmQoJ2hlYWRpbmcnLCAnY21kK2QnLCByb3V0ZXIoJ2hlYWRpbmcnKSk7XG4gIGVkaXRvci5zaG93TGlua0RpYWxvZyA9IGZhYnJpY2F0b3IoYmluZCgnbGluaycsICdjbWQraycsIGxpbmtPckltYWdlT3JBdHRhY2htZW50KCdsaW5rJykpKTtcbiAgZWRpdG9yLnNob3dJbWFnZURpYWxvZyA9IGZhYnJpY2F0b3IoYmluZCgnaW1hZ2UnLCAnY21kK2cnLCBsaW5rT3JJbWFnZU9yQXR0YWNobWVudCgnaW1hZ2UnKSkpO1xuXG4gIGlmIChvcHRpb25zLmF0dGFjaG1lbnRzKSB7XG4gICAgZWRpdG9yLnNob3dBdHRhY2htZW50RGlhbG9nID0gZmFicmljYXRvcihiaW5kKCdhdHRhY2htZW50JywgJ2NtZCtzaGlmdCtrJywgbGlua09ySW1hZ2VPckF0dGFjaG1lbnQoJ2F0dGFjaG1lbnQnKSkpO1xuICB9XG4gIGlmIChvcHRpb25zLmhyKSB7IGJpbmQoJ2hyJywgJ2NtZCtuJywgcm91dGVyKCdocicpKTsgfVxuXG4gIGZ1bmN0aW9uIGZhYnJpY2F0b3IgKGVsKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIG9wZW4gKCkge1xuICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShlbCwgJ2NsaWNrJyk7XG4gICAgfTtcbiAgfVxuICBmdW5jdGlvbiBib2xkIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5ib2xkT3JJdGFsaWMoY2h1bmtzLCAnYm9sZCcpO1xuICB9XG4gIGZ1bmN0aW9uIGl0YWxpYyAobW9kZSwgY2h1bmtzKSB7XG4gICAgY29tbWFuZHNbbW9kZV0uYm9sZE9ySXRhbGljKGNodW5rcywgJ2l0YWxpYycpO1xuICB9XG4gIGZ1bmN0aW9uIGNvZGUgKG1vZGUsIGNodW5rcykge1xuICAgIGNvbW1hbmRzW21vZGVdLmNvZGVibG9jayhjaHVua3MsIHsgZmVuY2luZzogb3B0aW9ucy5mZW5jaW5nIH0pO1xuICB9XG4gIGZ1bmN0aW9uIHVsIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5saXN0KGNodW5rcywgZmFsc2UpO1xuICB9XG4gIGZ1bmN0aW9uIG9sIChtb2RlLCBjaHVua3MpIHtcbiAgICBjb21tYW5kc1ttb2RlXS5saXN0KGNodW5rcywgdHJ1ZSk7XG4gIH1cbiAgZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQgKHR5cGUpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKG1vZGUsIGNodW5rcykge1xuICAgICAgY29tbWFuZHNbbW9kZV0ubGlua09ySW1hZ2VPckF0dGFjaG1lbnQuY2FsbCh0aGlzLCBjaHVua3MsIHtcbiAgICAgICAgZWRpdG9yOiBlZGl0b3IsXG4gICAgICAgIG1vZGU6IG1vZGUsXG4gICAgICAgIHR5cGU6IHR5cGUsXG4gICAgICAgIHN1cmZhY2U6IHN1cmZhY2UsXG4gICAgICAgIHByb21wdHM6IG9wdGlvbnMucHJvbXB0cyxcbiAgICAgICAgeGhyOiBvcHRpb25zLnhocixcbiAgICAgICAgdXBsb2FkOiBvcHRpb25zW3R5cGUgKyAncyddLFxuICAgICAgICBjbGFzc2VzOiBvcHRpb25zLmNsYXNzZXMsXG4gICAgICAgIG1lcmdlSHRtbEFuZEF0dGFjaG1lbnQ6IG9wdGlvbnMubWVyZ2VIdG1sQW5kQXR0YWNobWVudFxuICAgICAgfSk7XG4gICAgfTtcbiAgfVxuICBmdW5jdGlvbiBiaW5kIChpZCwgY29tYm8sIGZuKSB7XG4gICAgcmV0dXJuIGVkaXRvci5hZGRDb21tYW5kQnV0dG9uKGlkLCBjb21ibywgc3VwcHJlc3MoZm4pKTtcbiAgfVxuICBmdW5jdGlvbiByb3V0ZXIgKG1ldGhvZCkge1xuICAgIHJldHVybiBmdW5jdGlvbiByb3V0ZWQgKG1vZGUsIGNodW5rcykgeyBjb21tYW5kc1ttb2RlXVttZXRob2RdLmNhbGwodGhpcywgY2h1bmtzKTsgfTtcbiAgfVxuICBmdW5jdGlvbiBzdG9wIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpOyBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICB9XG4gIGZ1bmN0aW9uIHN1cHByZXNzIChmbikge1xuICAgIHJldHVybiBmdW5jdGlvbiBzdXBwcmVzc29yIChlLCBtb2RlLCBjaHVua3MpIHsgc3RvcChlKTsgZm4uY2FsbCh0aGlzLCBtb2RlLCBjaHVua3MpOyB9O1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYmluZENvbW1hbmRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBjYXN0IChjb2xsZWN0aW9uKSB7XG4gIHZhciByZXN1bHQgPSBbXTtcbiAgdmFyIGk7XG4gIHZhciBsZW4gPSBjb2xsZWN0aW9uLmxlbmd0aDtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgcmVzdWx0LnB1c2goY29sbGVjdGlvbltpXSk7XG4gIH1cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjYXN0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmlucHV0ID0gL15cXHMqKC4qPykoPzpcXHMrXCIoLispXCIpP1xccyokLztcbnZhciByZnVsbCA9IC9eKD86aHR0cHM/fGZ0cCk6XFwvXFwvLztcblxuZnVuY3Rpb24gcGFyc2VMaW5rSW5wdXQgKGlucHV0KSB7XG4gIHJldHVybiBwYXJzZXIuYXBwbHkobnVsbCwgaW5wdXQubWF0Y2gocmlucHV0KSk7XG5cbiAgZnVuY3Rpb24gcGFyc2VyIChhbGwsIGxpbmssIHRpdGxlKSB7XG4gICAgdmFyIGhyZWYgPSBsaW5rLnJlcGxhY2UoL1xcPy4qJC8sIHF1ZXJ5VW5lbmNvZGVkUmVwbGFjZXIpO1xuICAgIGhyZWYgPSBkZWNvZGVVUklDb21wb25lbnQoaHJlZik7XG4gICAgaHJlZiA9IGVuY29kZVVSSShocmVmKS5yZXBsYWNlKC8nL2csICclMjcnKS5yZXBsYWNlKC9cXCgvZywgJyUyOCcpLnJlcGxhY2UoL1xcKS9nLCAnJTI5Jyk7XG4gICAgaHJlZiA9IGhyZWYucmVwbGFjZSgvXFw/LiokLywgcXVlcnlFbmNvZGVkUmVwbGFjZXIpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGhyZWY6IGZvcm1hdEhyZWYoaHJlZiksIHRpdGxlOiBmb3JtYXRUaXRsZSh0aXRsZSlcbiAgICB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIHF1ZXJ5VW5lbmNvZGVkUmVwbGFjZXIgKHF1ZXJ5KSB7XG4gIHJldHVybiBxdWVyeS5yZXBsYWNlKC9cXCsvZywgJyAnKTtcbn1cblxuZnVuY3Rpb24gcXVlcnlFbmNvZGVkUmVwbGFjZXIgKHF1ZXJ5KSB7XG4gIHJldHVybiBxdWVyeS5yZXBsYWNlKC9cXCsvZywgJyUyYicpO1xufVxuXG5mdW5jdGlvbiBmb3JtYXRUaXRsZSAodGl0bGUpIHtcbiAgaWYgKCF0aXRsZSkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgcmV0dXJuIHRpdGxlXG4gICAgLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKVxuICAgIC5yZXBsYWNlKC9cIi9nLCAnJnF1b3Q7JylcbiAgICAucmVwbGFjZSgvPC9nLCAnJmx0OycpXG4gICAgLnJlcGxhY2UoLz4vZywgJyZndDsnKTtcbn1cblxuZnVuY3Rpb24gZm9ybWF0SHJlZiAodXJsKSB7XG4gIHZhciBocmVmID0gdXJsLnJlcGxhY2UoL15cXHMrfFxccyskL2csICcnKTtcbiAgaWYgKGhyZWYubGVuZ3RoICYmIGhyZWZbMF0gIT09ICcvJyAmJiAhcmZ1bGwudGVzdChocmVmKSkge1xuICAgIHJldHVybiAnaHR0cDovLycgKyBocmVmO1xuICB9XG4gIHJldHVybiBocmVmO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlTGlua0lucHV0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB0cmltIChyZW1vdmUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChyZW1vdmUpIHtcbiAgICBiZWZvcmVSZXBsYWNlciA9IGFmdGVyUmVwbGFjZXIgPSAnJztcbiAgfVxuICBzZWxmLnNlbGVjdGlvbiA9IHNlbGYuc2VsZWN0aW9uLnJlcGxhY2UoL14oXFxzKikvLCBiZWZvcmVSZXBsYWNlcikucmVwbGFjZSgvKFxccyopJC8sIGFmdGVyUmVwbGFjZXIpO1xuXG4gIGZ1bmN0aW9uIGJlZm9yZVJlcGxhY2VyICh0ZXh0KSB7XG4gICAgc2VsZi5iZWZvcmUgKz0gdGV4dDsgcmV0dXJuICcnO1xuICB9XG4gIGZ1bmN0aW9uIGFmdGVyUmVwbGFjZXIgKHRleHQpIHtcbiAgICBzZWxmLmFmdGVyID0gdGV4dCArIHNlbGYuYWZ0ZXI7IHJldHVybiAnJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHRyaW07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBydHJpbSA9IC9eXFxzK3xcXHMrJC9nO1xudmFyIHJzcGFjZXMgPSAvXFxzKy9nO1xuXG5mdW5jdGlvbiBhZGRDbGFzcyAoZWwsIGNscykge1xuICB2YXIgY3VycmVudCA9IGVsLmNsYXNzTmFtZTtcbiAgaWYgKGN1cnJlbnQuaW5kZXhPZihjbHMpID09PSAtMSkge1xuICAgIGVsLmNsYXNzTmFtZSA9IChjdXJyZW50ICsgJyAnICsgY2xzKS5yZXBsYWNlKHJ0cmltLCAnJyk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcm1DbGFzcyAoZWwsIGNscykge1xuICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShjbHMsICcnKS5yZXBsYWNlKHJ0cmltLCAnJykucmVwbGFjZShyc3BhY2VzLCAnICcpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgYWRkOiBhZGRDbGFzcyxcbiAgcm06IHJtQ2xhc3Ncbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGV4dGVuZFJlZ0V4cCAocmVnZXgsIHByZSwgcG9zdCkge1xuICB2YXIgcGF0dGVybiA9IHJlZ2V4LnRvU3RyaW5nKCk7XG4gIHZhciBmbGFncztcblxuICBwYXR0ZXJuID0gcGF0dGVybi5yZXBsYWNlKC9cXC8oW2dpbV0qKSQvLCBjYXB0dXJlRmxhZ3MpO1xuICBwYXR0ZXJuID0gcGF0dGVybi5yZXBsYWNlKC8oXlxcL3xcXC8kKS9nLCAnJyk7XG4gIHBhdHRlcm4gPSBwcmUgKyBwYXR0ZXJuICsgcG9zdDtcbiAgcmV0dXJuIG5ldyBSZWdFeHAocGF0dGVybiwgZmxhZ3MpO1xuXG4gIGZ1bmN0aW9uIGNhcHR1cmVGbGFncyAoYWxsLCBmKSB7XG4gICAgZmxhZ3MgPSBmO1xuICAgIHJldHVybiAnJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGV4dGVuZFJlZ0V4cDtcbiIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZml4RU9MICh0ZXh0KSB7XG4gIHJldHVybiB0ZXh0LnJlcGxhY2UoL1xcclxcbi9nLCAnXFxuJykucmVwbGFjZSgvXFxyL2csICdcXG4nKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmaXhFT0w7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBJbnB1dFN0YXRlID0gcmVxdWlyZSgnLi9JbnB1dFN0YXRlJyk7XG5cbmZ1bmN0aW9uIGdldENvbW1hbmRIYW5kbGVyIChzdXJmYWNlLCBoaXN0b3J5LCBmbikge1xuICByZXR1cm4gZnVuY3Rpb24gaGFuZGxlQ29tbWFuZCAoZSkge1xuICAgIHN1cmZhY2UuZm9jdXMoaGlzdG9yeS5pbnB1dE1vZGUpO1xuICAgIGhpc3Rvcnkuc2V0Q29tbWFuZE1vZGUoKTtcblxuICAgIHZhciBzdGF0ZSA9IG5ldyBJbnB1dFN0YXRlKHN1cmZhY2UsIGhpc3RvcnkuaW5wdXRNb2RlKTtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gICAgdmFyIGFzeW5jSGFuZGxlciA9IHtcbiAgICAgIGFzeW5jOiBhc3luYywgaW1tZWRpYXRlOiB0cnVlXG4gICAgfTtcblxuICAgIGZuLmNhbGwoYXN5bmNIYW5kbGVyLCBlLCBoaXN0b3J5LmlucHV0TW9kZSwgY2h1bmtzKTtcblxuICAgIGlmIChhc3luY0hhbmRsZXIuaW1tZWRpYXRlKSB7XG4gICAgICBkb25lKCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXN5bmMgKCkge1xuICAgICAgYXN5bmNIYW5kbGVyLmltbWVkaWF0ZSA9IGZhbHNlO1xuICAgICAgcmV0dXJuIGRvbmU7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gZG9uZSAoKSB7XG4gICAgICBzdXJmYWNlLmZvY3VzKGhpc3RvcnkuaW5wdXRNb2RlKTtcbiAgICAgIHN0YXRlLnNldENodW5rcyhjaHVua3MpO1xuICAgICAgc3RhdGUucmVzdG9yZSgpO1xuICAgIH1cbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRDb21tYW5kSGFuZGxlcjtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBmaXhFT0wgPSByZXF1aXJlKCcuL2ZpeEVPTCcpO1xudmFyIG1hbnkgPSByZXF1aXJlKCcuL21hbnknKTtcbnZhciBjYXN0ID0gcmVxdWlyZSgnLi9jYXN0Jyk7XG52YXIgcmFuZ2VUb1RleHRSYW5nZSA9IHJlcXVpcmUoJy4vcmFuZ2VUb1RleHRSYW5nZScpO1xudmFyIGdldFNlbGVjdGlvbiA9IHJlcXVpcmUoJy4vcG9seWZpbGxzL2dldFNlbGVjdGlvbicpO1xudmFyIHJvcGVuID0gL14oPFtePl0rKD86IFtePl0qKT8+KS87XG52YXIgcmNsb3NlID0gLyg8XFwvW14+XSs+KSQvO1xuXG5mdW5jdGlvbiBzdXJmYWNlICh0ZXh0YXJlYSwgZWRpdGFibGUpIHtcbiAgcmV0dXJuIHtcbiAgICB0ZXh0YXJlYTogdGV4dGFyZWEsXG4gICAgZWRpdGFibGU6IGVkaXRhYmxlLFxuICAgIGZvY3VzOiBzZXRGb2N1cyxcbiAgICByZWFkOiByZWFkLFxuICAgIHdyaXRlOiB3cml0ZSxcbiAgICBjdXJyZW50OiBjdXJyZW50LFxuICAgIHdyaXRlU2VsZWN0aW9uOiB3cml0ZVNlbGVjdGlvbixcbiAgICByZWFkU2VsZWN0aW9uOiByZWFkU2VsZWN0aW9uXG4gIH07XG5cbiAgZnVuY3Rpb24gc2V0Rm9jdXMgKG1vZGUpIHtcbiAgICBjdXJyZW50KG1vZGUpLmZvY3VzKCk7XG4gIH1cblxuICBmdW5jdGlvbiBjdXJyZW50IChtb2RlKSB7XG4gICAgcmV0dXJuIG1vZGUgPT09ICd3eXNpd3lnJyA/IGVkaXRhYmxlIDogdGV4dGFyZWE7XG4gIH1cblxuICBmdW5jdGlvbiByZWFkIChtb2RlKSB7XG4gICAgaWYgKG1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgcmV0dXJuIGVkaXRhYmxlLmlubmVySFRNTDtcbiAgICB9XG4gICAgcmV0dXJuIHRleHRhcmVhLnZhbHVlO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGUgKG1vZGUsIHZhbHVlKSB7XG4gICAgaWYgKG1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgZWRpdGFibGUuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRleHRhcmVhLnZhbHVlID0gdmFsdWU7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVTZWxlY3Rpb24gKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgd3JpdGVTZWxlY3Rpb25FZGl0YWJsZShzdGF0ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHdyaXRlU2VsZWN0aW9uVGV4dGFyZWEoc3RhdGUpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRTZWxlY3Rpb24gKHN0YXRlKSB7XG4gICAgaWYgKHN0YXRlLm1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgcmVhZFNlbGVjdGlvbkVkaXRhYmxlKHN0YXRlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVhZFNlbGVjdGlvblRleHRhcmVhKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiB3cml0ZVNlbGVjdGlvblRleHRhcmVhIChzdGF0ZSkge1xuICAgIHZhciByYW5nZTtcbiAgICBpZiAodGV4dGFyZWEuc2VsZWN0aW9uU3RhcnQgIT09IHZvaWQgMCkge1xuICAgICAgdGV4dGFyZWEuZm9jdXMoKTtcbiAgICAgIHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0ID0gc3RhdGUuc3RhcnQ7XG4gICAgICB0ZXh0YXJlYS5zZWxlY3Rpb25FbmQgPSBzdGF0ZS5lbmQ7XG4gICAgICB0ZXh0YXJlYS5zY3JvbGxUb3AgPSBzdGF0ZS5zY3JvbGxUb3A7XG4gICAgfSBlbHNlIGlmIChkb2Muc2VsZWN0aW9uKSB7XG4gICAgICBpZiAoZG9jLmFjdGl2ZUVsZW1lbnQgJiYgZG9jLmFjdGl2ZUVsZW1lbnQgIT09IHRleHRhcmVhKSB7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIHRleHRhcmVhLmZvY3VzKCk7XG4gICAgICByYW5nZSA9IHRleHRhcmVhLmNyZWF0ZVRleHRSYW5nZSgpO1xuICAgICAgcmFuZ2UubW92ZVN0YXJ0KCdjaGFyYWN0ZXInLCAtdGV4dGFyZWEudmFsdWUubGVuZ3RoKTtcbiAgICAgIHJhbmdlLm1vdmVFbmQoJ2NoYXJhY3RlcicsIC10ZXh0YXJlYS52YWx1ZS5sZW5ndGgpO1xuICAgICAgcmFuZ2UubW92ZUVuZCgnY2hhcmFjdGVyJywgc3RhdGUuZW5kKTtcbiAgICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgc3RhdGUuc3RhcnQpO1xuICAgICAgcmFuZ2Uuc2VsZWN0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gcmVhZFNlbGVjdGlvblRleHRhcmVhIChzdGF0ZSkge1xuICAgIGlmICh0ZXh0YXJlYS5zZWxlY3Rpb25TdGFydCAhPT0gdm9pZCAwKSB7XG4gICAgICBzdGF0ZS5zdGFydCA9IHRleHRhcmVhLnNlbGVjdGlvblN0YXJ0O1xuICAgICAgc3RhdGUuZW5kID0gdGV4dGFyZWEuc2VsZWN0aW9uRW5kO1xuICAgIH0gZWxzZSBpZiAoZG9jLnNlbGVjdGlvbikge1xuICAgICAgYW5jaWVudGx5UmVhZFNlbGVjdGlvblRleHRhcmVhKHN0YXRlKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBhbmNpZW50bHlSZWFkU2VsZWN0aW9uVGV4dGFyZWEgKHN0YXRlKSB7XG4gICAgaWYgKGRvYy5hY3RpdmVFbGVtZW50ICYmIGRvYy5hY3RpdmVFbGVtZW50ICE9PSB0ZXh0YXJlYSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHN0YXRlLnRleHQgPSBmaXhFT0wodGV4dGFyZWEudmFsdWUpO1xuXG4gICAgdmFyIHJhbmdlID0gZG9jLnNlbGVjdGlvbi5jcmVhdGVSYW5nZSgpO1xuICAgIHZhciBmaXhlZFJhbmdlID0gZml4RU9MKHJhbmdlLnRleHQpO1xuICAgIHZhciBtYXJrZXIgPSAnXFx4MDcnO1xuICAgIHZhciBtYXJrZWRSYW5nZSA9IG1hcmtlciArIGZpeGVkUmFuZ2UgKyBtYXJrZXI7XG5cbiAgICByYW5nZS50ZXh0ID0gbWFya2VkUmFuZ2U7XG5cbiAgICB2YXIgaW5wdXRUZXh0ID0gZml4RU9MKHRleHRhcmVhLnZhbHVlKTtcblxuICAgIHJhbmdlLm1vdmVTdGFydCgnY2hhcmFjdGVyJywgLW1hcmtlZFJhbmdlLmxlbmd0aCk7XG4gICAgcmFuZ2UudGV4dCA9IGZpeGVkUmFuZ2U7XG4gICAgc3RhdGUuc3RhcnQgPSBpbnB1dFRleHQuaW5kZXhPZihtYXJrZXIpO1xuICAgIHN0YXRlLmVuZCA9IGlucHV0VGV4dC5sYXN0SW5kZXhPZihtYXJrZXIpIC0gbWFya2VyLmxlbmd0aDtcblxuICAgIHZhciBkaWZmID0gc3RhdGUudGV4dC5sZW5ndGggLSBmaXhFT0wodGV4dGFyZWEudmFsdWUpLmxlbmd0aDtcbiAgICBpZiAoZGlmZikge1xuICAgICAgcmFuZ2UubW92ZVN0YXJ0KCdjaGFyYWN0ZXInLCAtZml4ZWRSYW5nZS5sZW5ndGgpO1xuICAgICAgZml4ZWRSYW5nZSArPSBtYW55KCdcXG4nLCBkaWZmKTtcbiAgICAgIHN0YXRlLmVuZCArPSBkaWZmO1xuICAgICAgcmFuZ2UudGV4dCA9IGZpeGVkUmFuZ2U7XG4gICAgfVxuICAgIHN0YXRlLnNlbGVjdCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gd3JpdGVTZWxlY3Rpb25FZGl0YWJsZSAoc3RhdGUpIHtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuY2FjaGVkQ2h1bmtzIHx8IHN0YXRlLmdldENodW5rcygpO1xuICAgIHZhciBzdGFydCA9IGNodW5rcy5iZWZvcmUubGVuZ3RoO1xuICAgIHZhciBlbmQgPSBzdGFydCArIGNodW5rcy5zZWxlY3Rpb24ubGVuZ3RoO1xuICAgIHZhciBwID0ge307XG5cbiAgICB3YWxrKGVkaXRhYmxlLmZpcnN0Q2hpbGQsIHBlZWspO1xuICAgIGVkaXRhYmxlLmZvY3VzKCk7XG5cbiAgICBpZiAoZG9jdW1lbnQuY3JlYXRlUmFuZ2UpIHtcbiAgICAgIG1vZGVyblNlbGVjdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvbGRTZWxlY3Rpb24oKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtb2Rlcm5TZWxlY3Rpb24gKCkge1xuICAgICAgdmFyIHNlbCA9IGdldFNlbGVjdGlvbigpO1xuICAgICAgdmFyIHJhbmdlID0gZG9jdW1lbnQuY3JlYXRlUmFuZ2UoKTtcbiAgICAgIGlmICghcC5zdGFydENvbnRhaW5lcikge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAocC5lbmRDb250YWluZXIpIHtcbiAgICAgICAgcmFuZ2Uuc2V0RW5kKHAuZW5kQ29udGFpbmVyLCBwLmVuZE9mZnNldCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByYW5nZS5zZXRFbmQocC5zdGFydENvbnRhaW5lciwgcC5zdGFydE9mZnNldCk7XG4gICAgICB9XG4gICAgICByYW5nZS5zZXRTdGFydChwLnN0YXJ0Q29udGFpbmVyLCBwLnN0YXJ0T2Zmc2V0KTtcbiAgICAgIHNlbC5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgICAgIHNlbC5hZGRSYW5nZShyYW5nZSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gb2xkU2VsZWN0aW9uICgpIHtcbiAgICAgIHJhbmdlVG9UZXh0UmFuZ2UocCkuc2VsZWN0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcGVlayAoY29udGV4dCwgZWwpIHtcbiAgICAgIHZhciBjdXJzb3IgPSBjb250ZXh0LnRleHQubGVuZ3RoO1xuICAgICAgdmFyIGNvbnRlbnQgPSByZWFkTm9kZShlbCkubGVuZ3RoO1xuICAgICAgdmFyIHN1bSA9IGN1cnNvciArIGNvbnRlbnQ7XG4gICAgICBpZiAoIXAuc3RhcnRDb250YWluZXIgJiYgc3VtID49IHN0YXJ0KSB7XG4gICAgICAgIHAuc3RhcnRDb250YWluZXIgPSBlbDtcbiAgICAgICAgcC5zdGFydE9mZnNldCA9IGJvdW5kZWQoc3RhcnQgLSBjdXJzb3IpO1xuICAgICAgfVxuICAgICAgaWYgKCFwLmVuZENvbnRhaW5lciAmJiBzdW0gPj0gZW5kKSB7XG4gICAgICAgIHAuZW5kQ29udGFpbmVyID0gZWw7XG4gICAgICAgIHAuZW5kT2Zmc2V0ID0gYm91bmRlZChlbmQgLSBjdXJzb3IpO1xuICAgICAgfVxuXG4gICAgICBmdW5jdGlvbiBib3VuZGVkIChvZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIE1hdGgubWF4KDAsIE1hdGgubWluKGNvbnRlbnQsIG9mZnNldCkpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWRTZWxlY3Rpb25FZGl0YWJsZSAoc3RhdGUpIHtcbiAgICB2YXIgc2VsID0gZ2V0U2VsZWN0aW9uKCk7XG4gICAgdmFyIGRpc3RhbmNlID0gd2FsayhlZGl0YWJsZS5maXJzdENoaWxkLCBwZWVrKTtcbiAgICB2YXIgc3RhcnQgPSBkaXN0YW5jZS5zdGFydCB8fCAwO1xuICAgIHZhciBlbmQgPSBkaXN0YW5jZS5lbmQgfHwgMDtcblxuICAgIHN0YXRlLnRleHQgPSBkaXN0YW5jZS50ZXh0O1xuXG4gICAgaWYgKGVuZCA+IHN0YXJ0KSB7XG4gICAgICBzdGF0ZS5zdGFydCA9IHN0YXJ0O1xuICAgICAgc3RhdGUuZW5kID0gZW5kO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdGF0ZS5zdGFydCA9IGVuZDtcbiAgICAgIHN0YXRlLmVuZCA9IHN0YXJ0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHBlZWsgKGNvbnRleHQsIGVsKSB7XG4gICAgICBpZiAoZWwgPT09IHNlbC5hbmNob3JOb2RlKSB7XG4gICAgICAgIGNvbnRleHQuc3RhcnQgPSBjb250ZXh0LnRleHQubGVuZ3RoICsgc2VsLmFuY2hvck9mZnNldDtcbiAgICAgIH1cbiAgICAgIGlmIChlbCA9PT0gc2VsLmZvY3VzTm9kZSkge1xuICAgICAgICBjb250ZXh0LmVuZCA9IGNvbnRleHQudGV4dC5sZW5ndGggKyBzZWwuZm9jdXNPZmZzZXQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gd2FsayAoZWwsIHBlZWssIGN0eCwgc2libGluZ3MpIHtcbiAgICB2YXIgY29udGV4dCA9IGN0eCB8fCB7IHRleHQ6ICcnIH07XG5cbiAgICBpZiAoIWVsKSB7XG4gICAgICByZXR1cm4gY29udGV4dDtcbiAgICB9XG5cbiAgICB2YXIgZWxOb2RlID0gZWwubm9kZVR5cGUgPT09IDE7XG4gICAgdmFyIHRleHROb2RlID0gZWwubm9kZVR5cGUgPT09IDM7XG5cbiAgICBwZWVrKGNvbnRleHQsIGVsKTtcblxuICAgIGlmICh0ZXh0Tm9kZSkge1xuICAgICAgY29udGV4dC50ZXh0ICs9IHJlYWROb2RlKGVsKTtcbiAgICB9XG4gICAgaWYgKGVsTm9kZSkge1xuICAgICAgaWYgKGVsLm91dGVySFRNTC5tYXRjaChyb3BlbikpIHsgY29udGV4dC50ZXh0ICs9IFJlZ0V4cC4kMTsgfVxuICAgICAgY2FzdChlbC5jaGlsZE5vZGVzKS5mb3JFYWNoKHdhbGtDaGlsZHJlbik7XG4gICAgICBpZiAoZWwub3V0ZXJIVE1MLm1hdGNoKHJjbG9zZSkpIHsgY29udGV4dC50ZXh0ICs9IFJlZ0V4cC4kMTsgfVxuICAgIH1cbiAgICBpZiAoc2libGluZ3MgIT09IGZhbHNlICYmIGVsLm5leHRTaWJsaW5nKSB7XG4gICAgICByZXR1cm4gd2FsayhlbC5uZXh0U2libGluZywgcGVlaywgY29udGV4dCk7XG4gICAgfVxuICAgIHJldHVybiBjb250ZXh0O1xuXG4gICAgZnVuY3Rpb24gd2Fsa0NoaWxkcmVuIChjaGlsZCkge1xuICAgICAgd2FsayhjaGlsZCwgcGVlaywgY29udGV4dCwgZmFsc2UpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlYWROb2RlIChlbCkge1xuICAgIHJldHVybiBlbC5ub2RlVHlwZSA9PT0gMyA/IGZpeEVPTChlbC50ZXh0Q29udGVudCB8fCBlbC5pbm5lclRleHQgfHwgJycpIDogJyc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBzdXJmYWNlO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTluWlhSVGRYSm1ZV05sTG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHUnZZeUE5SUdkc2IySmhiQzVrYjJOMWJXVnVkRHRjYm5aaGNpQm1hWGhGVDB3Z1BTQnlaWEYxYVhKbEtDY3VMMlpwZUVWUFRDY3BPMXh1ZG1GeUlHMWhibmtnUFNCeVpYRjFhWEpsS0NjdUwyMWhibmtuS1R0Y2JuWmhjaUJqWVhOMElEMGdjbVZ4ZFdseVpTZ25MaTlqWVhOMEp5azdYRzUyWVhJZ2NtRnVaMlZVYjFSbGVIUlNZVzVuWlNBOUlISmxjWFZwY21Vb0p5NHZjbUZ1WjJWVWIxUmxlSFJTWVc1blpTY3BPMXh1ZG1GeUlHZGxkRk5sYkdWamRHbHZiaUE5SUhKbGNYVnBjbVVvSnk0dmNHOXNlV1pwYkd4ekwyZGxkRk5sYkdWamRHbHZiaWNwTzF4dWRtRnlJSEp2Y0dWdUlEMGdMMTRvUEZ0ZVBsMHJLRDg2SUZ0ZVBsMHFLVDgrS1M4N1hHNTJZWElnY21Oc2IzTmxJRDBnTHlnOFhGd3ZXMTQrWFNzK0tTUXZPMXh1WEc1bWRXNWpkR2x2YmlCemRYSm1ZV05sSUNoMFpYaDBZWEpsWVN3Z1pXUnBkR0ZpYkdVcElIdGNiaUFnY21WMGRYSnVJSHRjYmlBZ0lDQjBaWGgwWVhKbFlUb2dkR1Y0ZEdGeVpXRXNYRzRnSUNBZ1pXUnBkR0ZpYkdVNklHVmthWFJoWW14bExGeHVJQ0FnSUdadlkzVnpPaUJ6WlhSR2IyTjFjeXhjYmlBZ0lDQnlaV0ZrT2lCeVpXRmtMRnh1SUNBZ0lIZHlhWFJsT2lCM2NtbDBaU3hjYmlBZ0lDQmpkWEp5Wlc1ME9pQmpkWEp5Wlc1MExGeHVJQ0FnSUhkeWFYUmxVMlZzWldOMGFXOXVPaUIzY21sMFpWTmxiR1ZqZEdsdmJpeGNiaUFnSUNCeVpXRmtVMlZzWldOMGFXOXVPaUJ5WldGa1UyVnNaV04wYVc5dVhHNGdJSDA3WEc1Y2JpQWdablZ1WTNScGIyNGdjMlYwUm05amRYTWdLRzF2WkdVcElIdGNiaUFnSUNCamRYSnlaVzUwS0cxdlpHVXBMbVp2WTNWektDazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJqZFhKeVpXNTBJQ2h0YjJSbEtTQjdYRzRnSUNBZ2NtVjBkWEp1SUcxdlpHVWdQVDA5SUNkM2VYTnBkM2xuSnlBL0lHVmthWFJoWW14bElEb2dkR1Y0ZEdGeVpXRTdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJ5WldGa0lDaHRiMlJsS1NCN1hHNGdJQ0FnYVdZZ0tHMXZaR1VnUFQwOUlDZDNlWE5wZDNsbkp5a2dlMXh1SUNBZ0lDQWdjbVYwZFhKdUlHVmthWFJoWW14bExtbHVibVZ5U0ZSTlREdGNiaUFnSUNCOVhHNGdJQ0FnY21WMGRYSnVJSFJsZUhSaGNtVmhMblpoYkhWbE8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdkM0pwZEdVZ0tHMXZaR1VzSUhaaGJIVmxLU0I3WEc0Z0lDQWdhV1lnS0cxdlpHVWdQVDA5SUNkM2VYTnBkM2xuSnlrZ2UxeHVJQ0FnSUNBZ1pXUnBkR0ZpYkdVdWFXNXVaWEpJVkUxTUlEMGdkbUZzZFdVN1hHNGdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJSFJsZUhSaGNtVmhMblpoYkhWbElEMGdkbUZzZFdVN1hHNGdJQ0FnZlZ4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z2QzSnBkR1ZUWld4bFkzUnBiMjRnS0hOMFlYUmxLU0I3WEc0Z0lDQWdhV1lnS0hOMFlYUmxMbTF2WkdVZ1BUMDlJQ2QzZVhOcGQzbG5KeWtnZTF4dUlDQWdJQ0FnZDNKcGRHVlRaV3hsWTNScGIyNUZaR2wwWVdKc1pTaHpkR0YwWlNrN1hHNGdJQ0FnZlNCbGJITmxJSHRjYmlBZ0lDQWdJSGR5YVhSbFUyVnNaV04wYVc5dVZHVjRkR0Z5WldFb2MzUmhkR1VwTzF4dUlDQWdJSDFjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUhKbFlXUlRaV3hsWTNScGIyNGdLSE4wWVhSbEtTQjdYRzRnSUNBZ2FXWWdLSE4wWVhSbExtMXZaR1VnUFQwOUlDZDNlWE5wZDNsbkp5a2dlMXh1SUNBZ0lDQWdjbVZoWkZObGJHVmpkR2x2YmtWa2FYUmhZbXhsS0hOMFlYUmxLVHRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ2NtVmhaRk5sYkdWamRHbHZibFJsZUhSaGNtVmhLSE4wWVhSbEtUdGNiaUFnSUNCOVhHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQjNjbWwwWlZObGJHVmpkR2x2YmxSbGVIUmhjbVZoSUNoemRHRjBaU2tnZTF4dUlDQWdJSFpoY2lCeVlXNW5aVHRjYmlBZ0lDQnBaaUFvZEdWNGRHRnlaV0V1YzJWc1pXTjBhVzl1VTNSaGNuUWdJVDA5SUhadmFXUWdNQ2tnZTF4dUlDQWdJQ0FnZEdWNGRHRnlaV0V1Wm05amRYTW9LVHRjYmlBZ0lDQWdJSFJsZUhSaGNtVmhMbk5sYkdWamRHbHZibE4wWVhKMElEMGdjM1JoZEdVdWMzUmhjblE3WEc0Z0lDQWdJQ0IwWlhoMFlYSmxZUzV6Wld4bFkzUnBiMjVGYm1RZ1BTQnpkR0YwWlM1bGJtUTdYRzRnSUNBZ0lDQjBaWGgwWVhKbFlTNXpZM0p2Ykd4VWIzQWdQU0J6ZEdGMFpTNXpZM0p2Ykd4VWIzQTdYRzRnSUNBZ2ZTQmxiSE5sSUdsbUlDaGtiMk11YzJWc1pXTjBhVzl1S1NCN1hHNGdJQ0FnSUNCcFppQW9aRzlqTG1GamRHbDJaVVZzWlcxbGJuUWdKaVlnWkc5akxtRmpkR2wyWlVWc1pXMWxiblFnSVQwOUlIUmxlSFJoY21WaEtTQjdYRzRnSUNBZ0lDQWdJSEpsZEhWeWJqdGNiaUFnSUNBZ0lIMWNiaUFnSUNBZ0lIUmxlSFJoY21WaExtWnZZM1Z6S0NrN1hHNGdJQ0FnSUNCeVlXNW5aU0E5SUhSbGVIUmhjbVZoTG1OeVpXRjBaVlJsZUhSU1lXNW5aU2dwTzF4dUlDQWdJQ0FnY21GdVoyVXViVzkyWlZOMFlYSjBLQ2RqYUdGeVlXTjBaWEluTENBdGRHVjRkR0Z5WldFdWRtRnNkV1V1YkdWdVozUm9LVHRjYmlBZ0lDQWdJSEpoYm1kbExtMXZkbVZGYm1Rb0oyTm9ZWEpoWTNSbGNpY3NJQzEwWlhoMFlYSmxZUzUyWVd4MVpTNXNaVzVuZEdncE8xeHVJQ0FnSUNBZ2NtRnVaMlV1Ylc5MlpVVnVaQ2duWTJoaGNtRmpkR1Z5Snl3Z2MzUmhkR1V1Wlc1a0tUdGNiaUFnSUNBZ0lISmhibWRsTG0xdmRtVlRkR0Z5ZENnblkyaGhjbUZqZEdWeUp5d2djM1JoZEdVdWMzUmhjblFwTzF4dUlDQWdJQ0FnY21GdVoyVXVjMlZzWldOMEtDazdYRzRnSUNBZ2ZWeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdjbVZoWkZObGJHVmpkR2x2YmxSbGVIUmhjbVZoSUNoemRHRjBaU2tnZTF4dUlDQWdJR2xtSUNoMFpYaDBZWEpsWVM1elpXeGxZM1JwYjI1VGRHRnlkQ0FoUFQwZ2RtOXBaQ0F3S1NCN1hHNGdJQ0FnSUNCemRHRjBaUzV6ZEdGeWRDQTlJSFJsZUhSaGNtVmhMbk5sYkdWamRHbHZibE4wWVhKME8xeHVJQ0FnSUNBZ2MzUmhkR1V1Wlc1a0lEMGdkR1Y0ZEdGeVpXRXVjMlZzWldOMGFXOXVSVzVrTzF4dUlDQWdJSDBnWld4elpTQnBaaUFvWkc5akxuTmxiR1ZqZEdsdmJpa2dlMXh1SUNBZ0lDQWdZVzVqYVdWdWRHeDVVbVZoWkZObGJHVmpkR2x2YmxSbGVIUmhjbVZoS0hOMFlYUmxLVHRjYmlBZ0lDQjlYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJoYm1OcFpXNTBiSGxTWldGa1UyVnNaV04wYVc5dVZHVjRkR0Z5WldFZ0tITjBZWFJsS1NCN1hHNGdJQ0FnYVdZZ0tHUnZZeTVoWTNScGRtVkZiR1Z0Wlc1MElDWW1JR1J2WXk1aFkzUnBkbVZGYkdWdFpXNTBJQ0U5UFNCMFpYaDBZWEpsWVNrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1TzF4dUlDQWdJSDFjYmx4dUlDQWdJSE4wWVhSbExuUmxlSFFnUFNCbWFYaEZUMHdvZEdWNGRHRnlaV0V1ZG1Gc2RXVXBPMXh1WEc0Z0lDQWdkbUZ5SUhKaGJtZGxJRDBnWkc5akxuTmxiR1ZqZEdsdmJpNWpjbVZoZEdWU1lXNW5aU2dwTzF4dUlDQWdJSFpoY2lCbWFYaGxaRkpoYm1kbElEMGdabWw0UlU5TUtISmhibWRsTG5SbGVIUXBPMXh1SUNBZ0lIWmhjaUJ0WVhKclpYSWdQU0FuWEZ4NE1EY25PMXh1SUNBZ0lIWmhjaUJ0WVhKclpXUlNZVzVuWlNBOUlHMWhjbXRsY2lBcklHWnBlR1ZrVW1GdVoyVWdLeUJ0WVhKclpYSTdYRzVjYmlBZ0lDQnlZVzVuWlM1MFpYaDBJRDBnYldGeWEyVmtVbUZ1WjJVN1hHNWNiaUFnSUNCMllYSWdhVzV3ZFhSVVpYaDBJRDBnWm1sNFJVOU1LSFJsZUhSaGNtVmhMblpoYkhWbEtUdGNibHh1SUNBZ0lISmhibWRsTG0xdmRtVlRkR0Z5ZENnblkyaGhjbUZqZEdWeUp5d2dMVzFoY210bFpGSmhibWRsTG14bGJtZDBhQ2s3WEc0Z0lDQWdjbUZ1WjJVdWRHVjRkQ0E5SUdacGVHVmtVbUZ1WjJVN1hHNGdJQ0FnYzNSaGRHVXVjM1JoY25RZ1BTQnBibkIxZEZSbGVIUXVhVzVrWlhoUFppaHRZWEpyWlhJcE8xeHVJQ0FnSUhOMFlYUmxMbVZ1WkNBOUlHbHVjSFYwVkdWNGRDNXNZWE4wU1c1a1pYaFBaaWh0WVhKclpYSXBJQzBnYldGeWEyVnlMbXhsYm1kMGFEdGNibHh1SUNBZ0lIWmhjaUJrYVdabUlEMGdjM1JoZEdVdWRHVjRkQzVzWlc1bmRHZ2dMU0JtYVhoRlQwd29kR1Y0ZEdGeVpXRXVkbUZzZFdVcExteGxibWQwYUR0Y2JpQWdJQ0JwWmlBb1pHbG1aaWtnZTF4dUlDQWdJQ0FnY21GdVoyVXViVzkyWlZOMFlYSjBLQ2RqYUdGeVlXTjBaWEluTENBdFptbDRaV1JTWVc1blpTNXNaVzVuZEdncE8xeHVJQ0FnSUNBZ1ptbDRaV1JTWVc1blpTQXJQU0J0WVc1NUtDZGNYRzRuTENCa2FXWm1LVHRjYmlBZ0lDQWdJSE4wWVhSbExtVnVaQ0FyUFNCa2FXWm1PMXh1SUNBZ0lDQWdjbUZ1WjJVdWRHVjRkQ0E5SUdacGVHVmtVbUZ1WjJVN1hHNGdJQ0FnZlZ4dUlDQWdJSE4wWVhSbExuTmxiR1ZqZENncE8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdkM0pwZEdWVFpXeGxZM1JwYjI1RlpHbDBZV0pzWlNBb2MzUmhkR1VwSUh0Y2JpQWdJQ0IyWVhJZ1kyaDFibXR6SUQwZ2MzUmhkR1V1WTJGamFHVmtRMmgxYm10eklIeDhJSE4wWVhSbExtZGxkRU5vZFc1cmN5Z3BPMXh1SUNBZ0lIWmhjaUJ6ZEdGeWRDQTlJR05vZFc1cmN5NWlaV1p2Y21VdWJHVnVaM1JvTzF4dUlDQWdJSFpoY2lCbGJtUWdQU0J6ZEdGeWRDQXJJR05vZFc1cmN5NXpaV3hsWTNScGIyNHViR1Z1WjNSb08xeHVJQ0FnSUhaaGNpQndJRDBnZTMwN1hHNWNiaUFnSUNCM1lXeHJLR1ZrYVhSaFlteGxMbVpwY25OMFEyaHBiR1FzSUhCbFpXc3BPMXh1SUNBZ0lHVmthWFJoWW14bExtWnZZM1Z6S0NrN1hHNWNiaUFnSUNCcFppQW9aRzlqZFcxbGJuUXVZM0psWVhSbFVtRnVaMlVwSUh0Y2JpQWdJQ0FnSUcxdlpHVnlibE5sYkdWamRHbHZiaWdwTzF4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQnZiR1JUWld4bFkzUnBiMjRvS1R0Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0JtZFc1amRHbHZiaUJ0YjJSbGNtNVRaV3hsWTNScGIyNGdLQ2tnZTF4dUlDQWdJQ0FnZG1GeUlITmxiQ0E5SUdkbGRGTmxiR1ZqZEdsdmJpZ3BPMXh1SUNBZ0lDQWdkbUZ5SUhKaGJtZGxJRDBnWkc5amRXMWxiblF1WTNKbFlYUmxVbUZ1WjJVb0tUdGNiaUFnSUNBZ0lHbG1JQ2doY0M1emRHRnlkRU52Ym5SaGFXNWxjaWtnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTQ3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0JwWmlBb2NDNWxibVJEYjI1MFlXbHVaWElwSUh0Y2JpQWdJQ0FnSUNBZ2NtRnVaMlV1YzJWMFJXNWtLSEF1Wlc1a1EyOXVkR0ZwYm1WeUxDQndMbVZ1WkU5bVpuTmxkQ2s3WEc0Z0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0J5WVc1blpTNXpaWFJGYm1Rb2NDNXpkR0Z5ZEVOdmJuUmhhVzVsY2l3Z2NDNXpkR0Z5ZEU5bVpuTmxkQ2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdJQ0J5WVc1blpTNXpaWFJUZEdGeWRDaHdMbk4wWVhKMFEyOXVkR0ZwYm1WeUxDQndMbk4wWVhKMFQyWm1jMlYwS1R0Y2JpQWdJQ0FnSUhObGJDNXlaVzF2ZG1WQmJHeFNZVzVuWlhNb0tUdGNiaUFnSUNBZ0lITmxiQzVoWkdSU1lXNW5aU2h5WVc1blpTazdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ1puVnVZM1JwYjI0Z2IyeGtVMlZzWldOMGFXOXVJQ2dwSUh0Y2JpQWdJQ0FnSUhKaGJtZGxWRzlVWlhoMFVtRnVaMlVvY0NrdWMyVnNaV04wS0NrN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnWm5WdVkzUnBiMjRnY0dWbGF5QW9ZMjl1ZEdWNGRDd2daV3dwSUh0Y2JpQWdJQ0FnSUhaaGNpQmpkWEp6YjNJZ1BTQmpiMjUwWlhoMExuUmxlSFF1YkdWdVozUm9PMXh1SUNBZ0lDQWdkbUZ5SUdOdmJuUmxiblFnUFNCeVpXRmtUbTlrWlNobGJDa3ViR1Z1WjNSb08xeHVJQ0FnSUNBZ2RtRnlJSE4xYlNBOUlHTjFjbk52Y2lBcklHTnZiblJsYm5RN1hHNGdJQ0FnSUNCcFppQW9JWEF1YzNSaGNuUkRiMjUwWVdsdVpYSWdKaVlnYzNWdElENDlJSE4wWVhKMEtTQjdYRzRnSUNBZ0lDQWdJSEF1YzNSaGNuUkRiMjUwWVdsdVpYSWdQU0JsYkR0Y2JpQWdJQ0FnSUNBZ2NDNXpkR0Z5ZEU5bVpuTmxkQ0E5SUdKdmRXNWtaV1FvYzNSaGNuUWdMU0JqZFhKemIzSXBPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lDQWdhV1lnS0NGd0xtVnVaRU52Ym5SaGFXNWxjaUFtSmlCemRXMGdQajBnWlc1a0tTQjdYRzRnSUNBZ0lDQWdJSEF1Wlc1a1EyOXVkR0ZwYm1WeUlEMGdaV3c3WEc0Z0lDQWdJQ0FnSUhBdVpXNWtUMlptYzJWMElEMGdZbTkxYm1SbFpDaGxibVFnTFNCamRYSnpiM0lwTzF4dUlDQWdJQ0FnZlZ4dVhHNGdJQ0FnSUNCbWRXNWpkR2x2YmlCaWIzVnVaR1ZrSUNodlptWnpaWFFwSUh0Y2JpQWdJQ0FnSUNBZ2NtVjBkWEp1SUUxaGRHZ3ViV0Y0S0RBc0lFMWhkR2d1YldsdUtHTnZiblJsYm5Rc0lHOW1abk5sZENrcE8xeHVJQ0FnSUNBZ2ZWeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlISmxZV1JUWld4bFkzUnBiMjVGWkdsMFlXSnNaU0FvYzNSaGRHVXBJSHRjYmlBZ0lDQjJZWElnYzJWc0lEMGdaMlYwVTJWc1pXTjBhVzl1S0NrN1hHNGdJQ0FnZG1GeUlHUnBjM1JoYm1ObElEMGdkMkZzYXlobFpHbDBZV0pzWlM1bWFYSnpkRU5vYVd4a0xDQndaV1ZyS1R0Y2JpQWdJQ0IyWVhJZ2MzUmhjblFnUFNCa2FYTjBZVzVqWlM1emRHRnlkQ0I4ZkNBd08xeHVJQ0FnSUhaaGNpQmxibVFnUFNCa2FYTjBZVzVqWlM1bGJtUWdmSHdnTUR0Y2JseHVJQ0FnSUhOMFlYUmxMblJsZUhRZ1BTQmthWE4wWVc1alpTNTBaWGgwTzF4dVhHNGdJQ0FnYVdZZ0tHVnVaQ0ErSUhOMFlYSjBLU0I3WEc0Z0lDQWdJQ0J6ZEdGMFpTNXpkR0Z5ZENBOUlITjBZWEowTzF4dUlDQWdJQ0FnYzNSaGRHVXVaVzVrSUQwZ1pXNWtPMXh1SUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNCemRHRjBaUzV6ZEdGeWRDQTlJR1Z1WkR0Y2JpQWdJQ0FnSUhOMFlYUmxMbVZ1WkNBOUlITjBZWEowTzF4dUlDQWdJSDFjYmx4dUlDQWdJR1oxYm1OMGFXOXVJSEJsWldzZ0tHTnZiblJsZUhRc0lHVnNLU0I3WEc0Z0lDQWdJQ0JwWmlBb1pXd2dQVDA5SUhObGJDNWhibU5vYjNKT2IyUmxLU0I3WEc0Z0lDQWdJQ0FnSUdOdmJuUmxlSFF1YzNSaGNuUWdQU0JqYjI1MFpYaDBMblJsZUhRdWJHVnVaM1JvSUNzZ2MyVnNMbUZ1WTJodmNrOW1abk5sZER0Y2JpQWdJQ0FnSUgxY2JpQWdJQ0FnSUdsbUlDaGxiQ0E5UFQwZ2MyVnNMbVp2WTNWelRtOWtaU2tnZTF4dUlDQWdJQ0FnSUNCamIyNTBaWGgwTG1WdVpDQTlJR052Ym5SbGVIUXVkR1Y0ZEM1c1pXNW5kR2dnS3lCelpXd3VabTlqZFhOUFptWnpaWFE3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmVnh1SUNCOVhHNWNiaUFnWm5WdVkzUnBiMjRnZDJGc2F5QW9aV3dzSUhCbFpXc3NJR04wZUN3Z2MybGliR2x1WjNNcElIdGNiaUFnSUNCMllYSWdZMjl1ZEdWNGRDQTlJR04wZUNCOGZDQjdJSFJsZUhRNklDY25JSDA3WEc1Y2JpQWdJQ0JwWmlBb0lXVnNLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdZMjl1ZEdWNGREdGNiaUFnSUNCOVhHNWNiaUFnSUNCMllYSWdaV3hPYjJSbElEMGdaV3d1Ym05a1pWUjVjR1VnUFQwOUlERTdYRzRnSUNBZ2RtRnlJSFJsZUhST2IyUmxJRDBnWld3dWJtOWtaVlI1Y0dVZ1BUMDlJRE03WEc1Y2JpQWdJQ0J3WldWcktHTnZiblJsZUhRc0lHVnNLVHRjYmx4dUlDQWdJR2xtSUNoMFpYaDBUbTlrWlNrZ2UxeHVJQ0FnSUNBZ1kyOXVkR1Y0ZEM1MFpYaDBJQ3M5SUhKbFlXUk9iMlJsS0dWc0tUdGNiaUFnSUNCOVhHNGdJQ0FnYVdZZ0tHVnNUbTlrWlNrZ2UxeHVJQ0FnSUNBZ2FXWWdLR1ZzTG05MWRHVnlTRlJOVEM1dFlYUmphQ2h5YjNCbGJpa3BJSHNnWTI5dWRHVjRkQzUwWlhoMElDczlJRkpsWjBWNGNDNGtNVHNnZlZ4dUlDQWdJQ0FnWTJGemRDaGxiQzVqYUdsc1pFNXZaR1Z6S1M1bWIzSkZZV05vS0hkaGJHdERhR2xzWkhKbGJpazdYRzRnSUNBZ0lDQnBaaUFvWld3dWIzVjBaWEpJVkUxTUxtMWhkR05vS0hKamJHOXpaU2twSUhzZ1kyOXVkR1Y0ZEM1MFpYaDBJQ3M5SUZKbFowVjRjQzRrTVRzZ2ZWeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2MybGliR2x1WjNNZ0lUMDlJR1poYkhObElDWW1JR1ZzTG01bGVIUlRhV0pzYVc1bktTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z2QyRnNheWhsYkM1dVpYaDBVMmxpYkdsdVp5d2djR1ZsYXl3Z1kyOXVkR1Y0ZENrN1hHNGdJQ0FnZlZ4dUlDQWdJSEpsZEhWeWJpQmpiMjUwWlhoME8xeHVYRzRnSUNBZ1puVnVZM1JwYjI0Z2QyRnNhME5vYVd4a2NtVnVJQ2hqYUdsc1pDa2dlMXh1SUNBZ0lDQWdkMkZzYXloamFHbHNaQ3dnY0dWbGF5d2dZMjl1ZEdWNGRDd2dabUZzYzJVcE8xeHVJQ0FnSUgxY2JpQWdmVnh1WEc0Z0lHWjFibU4wYVc5dUlISmxZV1JPYjJSbElDaGxiQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQmxiQzV1YjJSbFZIbHdaU0E5UFQwZ015QS9JR1pwZUVWUFRDaGxiQzUwWlhoMFEyOXVkR1Z1ZENCOGZDQmxiQzVwYm01bGNsUmxlSFFnZkh3Z0p5Y3BJRG9nSnljN1hHNGdJSDFjYm4xY2JseHViVzlrZFd4bExtVjRjRzl5ZEhNZ1BTQnpkWEptWVdObE8xeHVJbDE5IiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBnZXRUZXh0IChlbCkge1xuICByZXR1cm4gZWwuaW5uZXJUZXh0IHx8IGVsLnRleHRDb250ZW50O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFRleHQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciB0cmltQ2h1bmtzID0gcmVxdWlyZSgnLi4vY2h1bmtzL3RyaW0nKTtcblxuZnVuY3Rpb24gSHRtbENodW5rcyAoKSB7XG59XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnRyaW0gPSB0cmltQ2h1bmtzO1xuXG5IdG1sQ2h1bmtzLnByb3RvdHlwZS5maW5kVGFncyA9IGZ1bmN0aW9uICgpIHtcbn07XG5cbkh0bWxDaHVua3MucHJvdG90eXBlLnNraXAgPSBmdW5jdGlvbiAoKSB7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEh0bWxDaHVua3M7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBibG9ja3F1b3RlIChjaHVua3MpIHtcbiAgd3JhcHBpbmcoJ2Jsb2NrcXVvdGUnLCBzdHJpbmdzLnBsYWNlaG9sZGVycy5xdW90ZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBibG9ja3F1b3RlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciB3cmFwcGluZyA9IHJlcXVpcmUoJy4vd3JhcHBpbmcnKTtcblxuZnVuY3Rpb24gYm9sZE9ySXRhbGljIChjaHVua3MsIHR5cGUpIHtcbiAgd3JhcHBpbmcodHlwZSA9PT0gJ2JvbGQnID8gJ3N0cm9uZycgOiAnZW0nLCBzdHJpbmdzLnBsYWNlaG9sZGVyc1t0eXBlXSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBib2xkT3JJdGFsaWM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xuXG5mdW5jdGlvbiBjb2RlYmxvY2sgKGNodW5rcykge1xuICB3cmFwcGluZygncHJlPjxjb2RlJywgc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZSwgY2h1bmtzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjb2RlYmxvY2s7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHJsZWFkaW5nID0gLzxoKFsxLTZdKSggW14+XSopPz4kLztcbnZhciBydHJhaWxpbmcgPSAvXjxcXC9oKFsxLTZdKT4vO1xuXG5mdW5jdGlvbiBoZWFkaW5nIChjaHVua3MpIHtcbiAgY2h1bmtzLnRyaW0oKTtcblxuICB2YXIgdHJhaWwgPSBydHJhaWxpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpO1xuICB2YXIgbGVhZCA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSk7XG4gIGlmIChsZWFkICYmIHRyYWlsICYmIGxlYWRbMV0gPT09IHRyYWlsWzFdKSB7XG4gICAgc3dhcCgpO1xuICB9IGVsc2Uge1xuICAgIGFkZCgpO1xuICB9XG5cbiAgZnVuY3Rpb24gc3dhcCAoKSB7XG4gICAgdmFyIGxldmVsID0gcGFyc2VJbnQobGVhZFsxXSwgMTApO1xuICAgIHZhciBuZXh0ID0gbGV2ZWwgPD0gMSA/IDQgOiBsZXZlbCAtIDE7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJzxoJyArIG5leHQgKyAnPicpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJzwvaCcgKyBuZXh0ICsgJz4nKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZCAoKSB7XG4gICAgaWYgKCFjaHVua3Muc2VsZWN0aW9uKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuaGVhZGluZztcbiAgICB9XG4gICAgY2h1bmtzLmJlZm9yZSArPSAnPGgxPic7XG4gICAgY2h1bmtzLmFmdGVyID0gJzwvaDE+JyArIGNodW5rcy5hZnRlcjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhlYWRpbmc7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGhyIChjaHVua3MpIHtcbiAgY2h1bmtzLmJlZm9yZSArPSAnXFxuPGhyPlxcbic7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSAnJztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBocjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGNyb3NzdmVudCA9IHJlcXVpcmUoJ2Nyb3NzdmVudCcpO1xudmFyIG9uY2UgPSByZXF1aXJlKCcuLi9vbmNlJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBwYXJzZUxpbmtJbnB1dCA9IHJlcXVpcmUoJy4uL2NodW5rcy9wYXJzZUxpbmtJbnB1dCcpO1xudmFyIHJsZWFkaW5nID0gLzxhKCBbXj5dKik/PiQvO1xudmFyIHJ0cmFpbGluZyA9IC9ePFxcL2E+LztcbnZhciByaW1hZ2UgPSAvPGltZyggW14+XSopP1xcLz4kLztcblxuZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQgKGNodW5rcywgb3B0aW9ucykge1xuICB2YXIgdHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgdmFyIGltYWdlID0gdHlwZSA9PT0gJ2ltYWdlJztcbiAgdmFyIHJlc3VtZTtcblxuICBpZiAodHlwZSAhPT0gJ2F0dGFjaG1lbnQnKSB7XG4gICAgY2h1bmtzLnRyaW0oKTtcbiAgfVxuXG4gIGlmIChyZW1vdmFsKCkpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICByZXN1bWUgPSB0aGlzLmFzeW5jKCk7XG5cbiAgb3B0aW9ucy5wcm9tcHRzLmNsb3NlKCk7XG4gIChvcHRpb25zLnByb21wdHNbdHlwZV0gfHwgb3B0aW9ucy5wcm9tcHRzLmxpbmspKG9wdGlvbnMsIG9uY2UocmVzb2x2ZWQpKTtcblxuICBmdW5jdGlvbiByZW1vdmFsICgpIHtcbiAgICBpZiAoaW1hZ2UpIHtcbiAgICAgIGlmIChyaW1hZ2UudGVzdChjaHVua3Muc2VsZWN0aW9uKSkge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gJyc7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAocnRyYWlsaW5nLmV4ZWMoY2h1bmtzLmFmdGVyKSAmJiBybGVhZGluZy5leGVjKGNodW5rcy5iZWZvcmUpKSB7XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWFkaW5nLCAnJyk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShydHJhaWxpbmcsICcnKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJlc29sdmVkIChyZXN1bHQpIHtcbiAgICB2YXIgcGFydHM7XG4gICAgdmFyIGxpbmsgPSBwYXJzZUxpbmtJbnB1dChyZXN1bHQuZGVmaW5pdGlvbik7XG4gICAgaWYgKGxpbmsuaHJlZi5sZW5ndGggPT09IDApIHtcbiAgICAgIHJlc3VtZSgpOyByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHR5cGUgPT09ICdhdHRhY2htZW50Jykge1xuICAgICAgcGFydHMgPSBvcHRpb25zLm1lcmdlSHRtbEFuZEF0dGFjaG1lbnQoY2h1bmtzLmJlZm9yZSArIGNodW5rcy5zZWxlY3Rpb24gKyBjaHVua3MuYWZ0ZXIsIGxpbmspO1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IHBhcnRzLmJlZm9yZTtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBwYXJ0cy5zZWxlY3Rpb247XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBwYXJ0cy5hZnRlcjtcbiAgICAgIHJlc3VtZSgpO1xuICAgICAgY3Jvc3N2ZW50LmZhYnJpY2F0ZShvcHRpb25zLnN1cmZhY2UudGV4dGFyZWEsICd3b29mbWFyay1tb2RlLWNoYW5nZScpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciB0aXRsZSA9IGxpbmsudGl0bGUgPyAnIHRpdGxlPVwiJyArIGxpbmsudGl0bGUgKyAnXCInIDogJyc7XG5cbiAgICBpZiAoaW1hZ2UpIHtcbiAgICAgIGltYWdlV3JhcCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBsaW5rV3JhcCgpO1xuICAgIH1cblxuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgIH1cbiAgICByZXN1bWUoKTtcblxuICAgIGZ1bmN0aW9uIGltYWdlV3JhcCAoKSB7XG4gICAgICBjaHVua3MuYmVmb3JlICs9ICc8aW1nIHNyYz1cIicgKyBsaW5rLmhyZWYgKyAnXCIgYWx0PVwiJztcbiAgICAgIGNodW5rcy5hZnRlciA9ICdcIicgKyB0aXRsZSArICcgLz4nICsgY2h1bmtzLmFmdGVyO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxpbmtXcmFwICgpIHtcbiAgICAgIHZhciBuYW1lcyA9IG9wdGlvbnMuY2xhc3Nlcy5pbnB1dC5saW5rcztcbiAgICAgIHZhciBjbGFzc2VzID0gbmFtZXMgPyAnIGNsYXNzPVwiJyArIG5hbWVzICsgJ1wiJyA6ICcnO1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSAnPGEgaHJlZj1cIicgKyBsaW5rLmhyZWYgKyAnXCInICsgdGl0bGUgKyBjbGFzc2VzICsgJz4nO1xuICAgICAgY2h1bmtzLmFmdGVyID0gJzwvYT4nICsgY2h1bmtzLmFmdGVyO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpbmtPckltYWdlT3JBdHRhY2htZW50O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBybGVmdHNpbmdsZSA9IC88KHVsfG9sKSggW14+XSopPz5cXHMqPGxpKCBbXj5dKik/PiQvO1xudmFyIHJyaWdodHNpbmdsZSA9IC9ePFxcL2xpPlxccyo8XFwvKHVsfG9sKT4vO1xudmFyIHJsZWZ0aXRlbSA9IC88bGkoIFtePl0qKT8+JC87XG52YXIgcnJpZ2h0aXRlbSA9IC9ePFxcL2xpKCBbXj5dKik/Pi87XG52YXIgcm9wZW4gPSAvXjwodWx8b2wpKCBbXj5dKik/PiQvO1xuXG5mdW5jdGlvbiBsaXN0IChjaHVua3MsIG9yZGVyZWQpIHtcbiAgdmFyIHRhZyA9IG9yZGVyZWQgPyAnb2wnIDogJ3VsJztcbiAgdmFyIG9saXN0ID0gJzwnICsgdGFnICsgJz4nO1xuICB2YXIgY2xpc3QgPSAnPC8nICsgdGFnICsgJz4nO1xuXG4gIGNodW5rcy50cmltKCk7XG5cbiAgaWYgKHJsZWZ0c2luZ2xlLnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcnJpZ2h0c2luZ2xlLnRlc3QoY2h1bmtzLmFmdGVyKSkge1xuICAgIGlmICh0YWcgPT09IFJlZ0V4cC4kMSkge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVmdHNpbmdsZSwgJycpO1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocnJpZ2h0c2luZ2xlLCAnJyk7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgdmFyIHVsU3RhcnQgPSBjaHVua3MuYmVmb3JlLmxhc3RJbmRleE9mKCc8dWwnKTtcbiAgdmFyIG9sU3RhcnQgPSBjaHVua3MuYmVmb3JlLmxhc3RJbmRleE9mKCc8b2wnKTtcbiAgdmFyIGNsb3NlVGFnID0gY2h1bmtzLmFmdGVyLmluZGV4T2YoJzwvdWw+Jyk7XG4gIGlmIChjbG9zZVRhZyA9PT0gLTEpIHtcbiAgICBjbG9zZVRhZyA9IGNodW5rcy5hZnRlci5pbmRleE9mKCc8L29sPicpO1xuICB9XG4gIGlmIChjbG9zZVRhZyA9PT0gLTEpIHtcbiAgICBhZGQoKTsgcmV0dXJuO1xuICB9XG4gIHZhciBvcGVuU3RhcnQgPSB1bFN0YXJ0ID4gb2xTdGFydCA/IHVsU3RhcnQgOiBvbFN0YXJ0O1xuICBpZiAob3BlblN0YXJ0ID09PSAtMSkge1xuICAgIGFkZCgpOyByZXR1cm47XG4gIH1cbiAgdmFyIG9wZW5FbmQgPSBjaHVua3MuYmVmb3JlLmluZGV4T2YoJz4nLCBvcGVuU3RhcnQpO1xuICBpZiAob3BlbkVuZCA9PT0gLTEpIHtcbiAgICBhZGQoKTsgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG9wZW5UYWcgPSBjaHVua3MuYmVmb3JlLnN1YnN0cihvcGVuU3RhcnQsIG9wZW5FbmQgLSBvcGVuU3RhcnQgKyAxKTtcbiAgaWYgKHJvcGVuLnRlc3Qob3BlblRhZykpIHtcbiAgICBpZiAodGFnICE9PSBSZWdFeHAuJDEpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnN1YnN0cigwLCBvcGVuU3RhcnQpICsgJzwnICsgdGFnICsgY2h1bmtzLmJlZm9yZS5zdWJzdHIob3BlblN0YXJ0ICsgMyk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIuc3Vic3RyKDAsIGNsb3NlVGFnKSArICc8LycgKyB0YWcgKyBjaHVua3MuYWZ0ZXIuc3Vic3RyKGNsb3NlVGFnICsgNCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChybGVmdGl0ZW0udGVzdChjaHVua3MuYmVmb3JlKSAmJiBycmlnaHRpdGVtLnRlc3QoY2h1bmtzLmFmdGVyKSkge1xuICAgICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJsZWZ0aXRlbSwgJycpO1xuICAgICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShycmlnaHRpdGVtLCAnJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBhZGQodHJ1ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYWRkIChsaXN0KSB7XG4gICAgdmFyIG9wZW4gPSBsaXN0ID8gJycgOiBvbGlzdDtcbiAgICB2YXIgY2xvc2UgPSBsaXN0ID8gJycgOiBjbGlzdDtcblxuICAgIGNodW5rcy5iZWZvcmUgKz0gb3BlbiArICc8bGk+JztcbiAgICBjaHVua3MuYWZ0ZXIgPSAnPC9saT4nICsgY2xvc2UgKyBjaHVua3MuYWZ0ZXI7XG5cbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5saXN0aXRlbTtcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBsaXN0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiB3cmFwcGluZyAodGFnLCBwbGFjZWhvbGRlciwgY2h1bmtzKSB7XG4gIHZhciBvcGVuID0gJzwnICsgdGFnO1xuICB2YXIgY2xvc2UgPSAnPC8nICsgdGFnLnJlcGxhY2UoLzwvZywgJzwvJyk7XG4gIHZhciBybGVhZGluZyA9IG5ldyBSZWdFeHAob3BlbiArICcoIFtePl0qKT8+JCcsICdpJyk7XG4gIHZhciBydHJhaWxpbmcgPSBuZXcgUmVnRXhwKCdeJyArIGNsb3NlICsgJz4nLCAnaScpO1xuICB2YXIgcm9wZW4gPSBuZXcgUmVnRXhwKG9wZW4gKyAnKCBbXj5dKik/PicsICdpZycpO1xuICB2YXIgcmNsb3NlID0gbmV3IFJlZ0V4cChjbG9zZSArICcoIFtePl0qKT8+JywgJ2lnJyk7XG5cbiAgY2h1bmtzLnRyaW0oKTtcblxuICB2YXIgdHJhaWwgPSBydHJhaWxpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpO1xuICB2YXIgbGVhZCA9IHJsZWFkaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSk7XG4gIGlmIChsZWFkICYmIHRyYWlsKSB7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShybGVhZGluZywgJycpO1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJ0cmFpbGluZywgJycpO1xuICB9IGVsc2Uge1xuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHBsYWNlaG9sZGVyO1xuICAgIH1cbiAgICB2YXIgb3BlbmVkID0gcm9wZW4udGVzdChjaHVua3Muc2VsZWN0aW9uKTtcbiAgICBpZiAob3BlbmVkKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKHJvcGVuLCAnJyk7XG4gICAgICBpZiAoIXN1cnJvdW5kZWQoY2h1bmtzLCB0YWcpKSB7XG4gICAgICAgIGNodW5rcy5iZWZvcmUgKz0gb3BlbiArICc+JztcbiAgICAgIH1cbiAgICB9XG4gICAgdmFyIGNsb3NlZCA9IHJjbG9zZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pO1xuICAgIGlmIChjbG9zZWQpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UocmNsb3NlLCAnJyk7XG4gICAgICBpZiAoIXN1cnJvdW5kZWQoY2h1bmtzLCB0YWcpKSB7XG4gICAgICAgIGNodW5rcy5hZnRlciA9IGNsb3NlICsgJz4nICsgY2h1bmtzLmFmdGVyO1xuICAgICAgfVxuICAgIH1cbiAgICBpZiAob3BlbmVkIHx8IGNsb3NlZCkge1xuICAgICAgcHVzaG92ZXIoKTsgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoc3Vycm91bmRlZChjaHVua3MsIHRhZykpIHtcbiAgICAgIGlmIChybGVhZGluZy50ZXN0KGNodW5rcy5iZWZvcmUpKSB7XG4gICAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmxlYWRpbmcsICcnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNodW5rcy5iZWZvcmUgKz0gY2xvc2UgKyAnPic7XG4gICAgICB9XG4gICAgICBpZiAocnRyYWlsaW5nLnRlc3QoY2h1bmtzLmFmdGVyKSkge1xuICAgICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShydHJhaWxpbmcsICcnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNodW5rcy5hZnRlciA9IG9wZW4gKyAnPicgKyBjaHVua3MuYWZ0ZXI7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICghY2xvc2Vib3VuZGVkKGNodW5rcywgdGFnKSkge1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2xvc2UgKyAnPicgKyBjaHVua3MuYWZ0ZXI7XG4gICAgICBjaHVua3MuYmVmb3JlICs9IG9wZW4gKyAnPic7XG4gICAgfVxuICAgIHB1c2hvdmVyKCk7XG4gIH1cblxuICBmdW5jdGlvbiBwdXNob3ZlciAoKSB7XG4gICAgY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC88KFxcLyk/KFtePiBdKykoIFtePl0qKT8+L2lnLCBwdXNob3Zlck90aGVyVGFncyk7XG4gIH1cblxuICBmdW5jdGlvbiBwdXNob3Zlck90aGVyVGFncyAoYWxsLCBjbG9zaW5nLCB0YWcsIGEsIGkpIHtcbiAgICB2YXIgYXR0cnMgPSBhIHx8ICcnO1xuICAgIHZhciBvcGVuID0gIWNsb3Npbmc7XG4gICAgdmFyIHJjbG9zZWQgPSBuZXcgUmVnRXhwKCc8XFwvJyArIHRhZy5yZXBsYWNlKC88L2csICc8LycpICsgJz4nLCAnaScpO1xuICAgIHZhciByb3BlbmVkID0gbmV3IFJlZ0V4cCgnPCcgKyB0YWcgKyAnKCBbXj5dKik/PicsICdpJyk7XG4gICAgaWYgKG9wZW4gJiYgIXJjbG9zZWQudGVzdChjaHVua3Muc2VsZWN0aW9uLnN1YnN0cihpKSkpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gKz0gJzwvJyArIHRhZyArICc+JztcbiAgICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKC9eKDxcXC9bXj5dKz4pLywgJyQxPCcgKyB0YWcgKyBhdHRycyArICc+Jyk7XG4gICAgfVxuXG4gICAgaWYgKGNsb3NpbmcgJiYgIXJvcGVuZWQudGVzdChjaHVua3Muc2VsZWN0aW9uLnN1YnN0cigwLCBpKSkpIHtcbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSAnPCcgKyB0YWcgKyBhdHRycyArICc+JyArIGNodW5rcy5zZWxlY3Rpb247XG4gICAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKC8oPFtePl0rKD86IFtePl0qKT8+KSQvLCAnPC8nICsgdGFnICsgJz4kMScpO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjbG9zZWJvdW5kZWQgKGNodW5rcywgdGFnKSB7XG4gIHZhciByY2xvc2VsZWZ0ID0gbmV3IFJlZ0V4cCgnPC8nICsgdGFnLnJlcGxhY2UoLzwvZywgJzwvJykgKyAnPiQnLCAnaScpO1xuICB2YXIgcm9wZW5yaWdodCA9IG5ldyBSZWdFeHAoJ148JyArIHRhZyArICcoPzogW14+XSopPz4nLCAnaScpO1xuICB2YXIgYm91bmRlZCA9IHJjbG9zZWxlZnQudGVzdChjaHVua3MuYmVmb3JlKSAmJiByb3BlbnJpZ2h0LnRlc3QoY2h1bmtzLmFmdGVyKTtcbiAgaWYgKGJvdW5kZWQpIHtcbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJjbG9zZWxlZnQsICcnKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyb3BlbnJpZ2h0LCAnJyk7XG4gIH1cbiAgcmV0dXJuIGJvdW5kZWQ7XG59XG5cbmZ1bmN0aW9uIHN1cnJvdW5kZWQgKGNodW5rcywgdGFnKSB7XG4gIHZhciByb3BlbiA9IG5ldyBSZWdFeHAoJzwnICsgdGFnICsgJyg/OiBbXj5dKik/PicsICdpZycpO1xuICB2YXIgcmNsb3NlID0gbmV3IFJlZ0V4cCgnPFxcLycgKyB0YWcucmVwbGFjZSgvPC9nLCAnPC8nKSArICc+JywgJ2lnJyk7XG4gIHZhciBvcGVuc0JlZm9yZSA9IGNvdW50KGNodW5rcy5iZWZvcmUsIHJvcGVuKTtcbiAgdmFyIG9wZW5zQWZ0ZXIgPSBjb3VudChjaHVua3MuYWZ0ZXIsIHJvcGVuKTtcbiAgdmFyIGNsb3Nlc0JlZm9yZSA9IGNvdW50KGNodW5rcy5iZWZvcmUsIHJjbG9zZSk7XG4gIHZhciBjbG9zZXNBZnRlciA9IGNvdW50KGNodW5rcy5hZnRlciwgcmNsb3NlKTtcbiAgdmFyIG9wZW4gPSBvcGVuc0JlZm9yZSAtIGNsb3Nlc0JlZm9yZSA+IDA7XG4gIHZhciBjbG9zZSA9IGNsb3Nlc0FmdGVyIC0gb3BlbnNBZnRlciA+IDA7XG4gIHJldHVybiBvcGVuICYmIGNsb3NlO1xuXG4gIGZ1bmN0aW9uIGNvdW50ICh0ZXh0LCByZWdleCkge1xuICAgIHZhciBtYXRjaCA9IHRleHQubWF0Y2gocmVnZXgpO1xuICAgIGlmIChtYXRjaCkge1xuICAgICAgcmV0dXJuIG1hdGNoLmxlbmd0aDtcbiAgICB9XG4gICAgcmV0dXJuIDA7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3cmFwcGluZztcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gaXNWaXNpYmxlRWxlbWVudCAoZWxlbSkge1xuICBpZiAoZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUpIHtcbiAgICByZXR1cm4gZ2xvYmFsLmdldENvbXB1dGVkU3R5bGUoZWxlbSwgbnVsbCkuZ2V0UHJvcGVydHlWYWx1ZSgnZGlzcGxheScpICE9PSAnbm9uZSc7XG4gIH0gZWxzZSBpZiAoZWxlbS5jdXJyZW50U3R5bGUpIHtcbiAgICByZXR1cm4gZWxlbS5jdXJyZW50U3R5bGUuZGlzcGxheSAhPT0gJ25vbmUnO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gaXNWaXNpYmxlRWxlbWVudDtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5cGMxWnBjMmxpYkdWRmJHVnRaVzUwTG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEVpTENKbWFXeGxJam9pWjJWdVpYSmhkR1ZrTG1weklpd2ljMjkxY21ObFVtOXZkQ0k2SWlJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYklpZDFjMlVnYzNSeWFXTjBKenRjYmx4dVpuVnVZM1JwYjI0Z2FYTldhWE5wWW14bFJXeGxiV1Z1ZENBb1pXeGxiU2tnZTF4dUlDQnBaaUFvWjJ4dlltRnNMbWRsZEVOdmJYQjFkR1ZrVTNSNWJHVXBJSHRjYmlBZ0lDQnlaWFIxY200Z1oyeHZZbUZzTG1kbGRFTnZiWEIxZEdWa1UzUjViR1VvWld4bGJTd2diblZzYkNrdVoyVjBVSEp2Y0dWeWRIbFdZV3gxWlNnblpHbHpjR3hoZVNjcElDRTlQU0FuYm05dVpTYzdYRzRnSUgwZ1pXeHpaU0JwWmlBb1pXeGxiUzVqZFhKeVpXNTBVM1I1YkdVcElIdGNiaUFnSUNCeVpYUjFjbTRnWld4bGJTNWpkWEp5Wlc1MFUzUjViR1V1WkdsemNHeGhlU0FoUFQwZ0oyNXZibVVuTzF4dUlDQjlYRzU5WEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ2FYTldhWE5wWW14bFJXeGxiV1Z1ZER0Y2JpSmRmUT09IiwiJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBtYW55ICh0ZXh0LCB0aW1lcykge1xuICByZXR1cm4gbmV3IEFycmF5KHRpbWVzICsgMSkuam9pbih0ZXh0KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBtYW55O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbWFueSA9IHJlcXVpcmUoJy4uL21hbnknKTtcbnZhciBleHRlbmRSZWdFeHAgPSByZXF1aXJlKCcuLi9leHRlbmRSZWdFeHAnKTtcbnZhciB0cmltQ2h1bmtzID0gcmVxdWlyZSgnLi4vY2h1bmtzL3RyaW0nKTtcbnZhciByZSA9IFJlZ0V4cDtcblxuZnVuY3Rpb24gTWFya2Rvd25DaHVua3MgKCkge1xufVxuXG5NYXJrZG93bkNodW5rcy5wcm90b3R5cGUudHJpbSA9IHRyaW1DaHVua3M7XG5cbk1hcmtkb3duQ2h1bmtzLnByb3RvdHlwZS5maW5kVGFncyA9IGZ1bmN0aW9uIChzdGFydFJlZ2V4LCBlbmRSZWdleCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciByZWdleDtcblxuICBpZiAoc3RhcnRSZWdleCkge1xuICAgIHJlZ2V4ID0gZXh0ZW5kUmVnRXhwKHN0YXJ0UmVnZXgsICcnLCAnJCcpO1xuICAgIHRoaXMuYmVmb3JlID0gdGhpcy5iZWZvcmUucmVwbGFjZShyZWdleCwgc3RhcnRSZXBsYWNlcik7XG4gICAgcmVnZXggPSBleHRlbmRSZWdFeHAoc3RhcnRSZWdleCwgJ14nLCAnJyk7XG4gICAgdGhpcy5zZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbi5yZXBsYWNlKHJlZ2V4LCBzdGFydFJlcGxhY2VyKTtcbiAgfVxuXG4gIGlmIChlbmRSZWdleCkge1xuICAgIHJlZ2V4ID0gZXh0ZW5kUmVnRXhwKGVuZFJlZ2V4LCAnJywgJyQnKTtcbiAgICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UocmVnZXgsIGVuZFJlcGxhY2VyKTtcbiAgICByZWdleCA9IGV4dGVuZFJlZ0V4cChlbmRSZWdleCwgJ14nLCAnJyk7XG4gICAgdGhpcy5hZnRlciA9IHRoaXMuYWZ0ZXIucmVwbGFjZShyZWdleCwgZW5kUmVwbGFjZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gc3RhcnRSZXBsYWNlciAobWF0Y2gpIHtcbiAgICBzZWxmLnN0YXJ0VGFnID0gc2VsZi5zdGFydFRhZyArIG1hdGNoOyByZXR1cm4gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBlbmRSZXBsYWNlciAobWF0Y2gpIHtcbiAgICBzZWxmLmVuZFRhZyA9IG1hdGNoICsgc2VsZi5lbmRUYWc7IHJldHVybiAnJztcbiAgfVxufTtcblxuTWFya2Rvd25DaHVua3MucHJvdG90eXBlLnNraXAgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBiZWZvcmVDb3VudCA9ICdiZWZvcmUnIGluIG8gPyBvLmJlZm9yZSA6IDE7XG4gIHZhciBhZnRlckNvdW50ID0gJ2FmdGVyJyBpbiBvID8gby5hZnRlciA6IDE7XG5cbiAgdGhpcy5zZWxlY3Rpb24gPSB0aGlzLnNlbGVjdGlvbi5yZXBsYWNlKC8oXlxcbiopLywgJycpO1xuICB0aGlzLnN0YXJ0VGFnID0gdGhpcy5zdGFydFRhZyArIHJlLiQxO1xuICB0aGlzLnNlbGVjdGlvbiA9IHRoaXMuc2VsZWN0aW9uLnJlcGxhY2UoLyhcXG4qJCkvLCAnJyk7XG4gIHRoaXMuZW5kVGFnID0gdGhpcy5lbmRUYWcgKyByZS4kMTtcbiAgdGhpcy5zdGFydFRhZyA9IHRoaXMuc3RhcnRUYWcucmVwbGFjZSgvKF5cXG4qKS8sICcnKTtcbiAgdGhpcy5iZWZvcmUgPSB0aGlzLmJlZm9yZSArIHJlLiQxO1xuICB0aGlzLmVuZFRhZyA9IHRoaXMuZW5kVGFnLnJlcGxhY2UoLyhcXG4qJCkvLCAnJyk7XG4gIHRoaXMuYWZ0ZXIgPSB0aGlzLmFmdGVyICsgcmUuJDE7XG5cbiAgaWYgKHRoaXMuYmVmb3JlKSB7XG4gICAgdGhpcy5iZWZvcmUgPSByZXBsYWNlKHRoaXMuYmVmb3JlLCArK2JlZm9yZUNvdW50LCAnJCcpO1xuICB9XG5cbiAgaWYgKHRoaXMuYWZ0ZXIpIHtcbiAgICB0aGlzLmFmdGVyID0gcmVwbGFjZSh0aGlzLmFmdGVyLCArK2FmdGVyQ291bnQsICcnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHJlcGxhY2UgKHRleHQsIGNvdW50LCBzdWZmaXgpIHtcbiAgICB2YXIgcmVnZXggPSBvLmFueSA/ICdcXFxcbionIDogbWFueSgnXFxcXG4/JywgY291bnQpO1xuICAgIHZhciByZXBsYWNlbWVudCA9IG1hbnkoJ1xcbicsIGNvdW50KTtcbiAgICByZXR1cm4gdGV4dC5yZXBsYWNlKG5ldyByZShyZWdleCArIHN1ZmZpeCksIHJlcGxhY2VtZW50KTtcbiAgfVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBNYXJrZG93bkNodW5rcztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG52YXIgd3JhcHBpbmcgPSByZXF1aXJlKCcuL3dyYXBwaW5nJyk7XG52YXIgc2V0dGluZ3MgPSByZXF1aXJlKCcuL3NldHRpbmdzJyk7XG52YXIgcnRyYWlsYmxhbmtsaW5lID0gLyg+WyBcXHRdKikkLztcbnZhciBybGVhZGJsYW5rbGluZSA9IC9eKD5bIFxcdF0qKS87XG52YXIgcm5ld2xpbmVmZW5jaW5nID0gL14oXFxuKikoW15cXHJdKz8pKFxcbiopJC87XG52YXIgcmVuZHRhZyA9IC9eKCgoXFxufF4pKFxcblsgXFx0XSopKj4oLitcXG4pKi4qKSsoXFxuWyBcXHRdKikqKS87XG52YXIgcmxlYWRicmFja2V0ID0gL15cXG4oKD58XFxzKSopXFxuLztcbnZhciBydHJhaWxicmFja2V0ID0gL1xcbigoPnxcXHMpKilcXG4kLztcblxuZnVuY3Rpb24gYmxvY2txdW90ZSAoY2h1bmtzKSB7XG4gIHZhciBtYXRjaCA9ICcnO1xuICB2YXIgbGVmdE92ZXIgPSAnJztcbiAgdmFyIGxpbmU7XG5cbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybmV3bGluZWZlbmNpbmcsIG5ld2xpbmVyZXBsYWNlcik7XG4gIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocnRyYWlsYmxhbmtsaW5lLCB0cmFpbGJsYW5rbGluZXJlcGxhY2VyKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXihcXHN8PikrJC8sICcnKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24gfHwgc3RyaW5ncy5wbGFjZWhvbGRlcnMucXVvdGU7XG5cbiAgaWYgKGNodW5rcy5iZWZvcmUpIHtcbiAgICBiZWZvcmVQcm9jZXNzaW5nKCk7XG4gIH1cblxuICBjaHVua3Muc3RhcnRUYWcgPSBtYXRjaDtcbiAgY2h1bmtzLmJlZm9yZSA9IGxlZnRPdmVyO1xuXG4gIGlmIChjaHVua3MuYWZ0ZXIpIHtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZSgvXlxcbj8vLCAnXFxuJyk7XG4gIH1cblxuICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZW5kdGFnLCBlbmR0YWdyZXBsYWNlcik7XG5cbiAgaWYgKC9eKD8hWyBdezAsM30+KS9tLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICB3cmFwcGluZy53cmFwKGNodW5rcywgc2V0dGluZ3MubGluZUxlbmd0aCAtIDIpO1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL14vZ20sICc+ICcpO1xuICAgIHJlcGxhY2VCbGFua3NJblRhZ3ModHJ1ZSk7XG4gICAgY2h1bmtzLnNraXAoKTtcbiAgfSBlbHNlIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eWyBdezAsM30+ID8vZ20sICcnKTtcbiAgICB3cmFwcGluZy51bndyYXAoY2h1bmtzKTtcbiAgICByZXBsYWNlQmxhbmtzSW5UYWdzKGZhbHNlKTtcblxuICAgIGlmICghL14oXFxufF4pWyBdezAsM30+Ly50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIGNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLnN0YXJ0VGFnLnJlcGxhY2UoL1xcbnswLDJ9JC8sICdcXG5cXG4nKTtcbiAgICB9XG5cbiAgICBpZiAoIS8oXFxufF4pWyBdezAsM30+LiokLy50ZXN0KGNodW5rcy5zZWxlY3Rpb24pICYmIGNodW5rcy5lbmRUYWcpIHtcbiAgICAgIGNodW5rcy5lbmRUYWcgPSBjaHVua3MuZW5kVGFnLnJlcGxhY2UoL15cXG57MCwyfS8sICdcXG5cXG4nKTtcbiAgICB9XG4gIH1cblxuICBpZiAoIS9cXG4vLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKHJsZWFkYmxhbmtsaW5lLCBsZWFkYmxhbmtsaW5lcmVwbGFjZXIpO1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3bGluZXJlcGxhY2VyIChhbGwsIGJlZm9yZSwgdGV4dCwgYWZ0ZXIpIHtcbiAgICBjaHVua3MuYmVmb3JlICs9IGJlZm9yZTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBhZnRlciArIGNodW5rcy5hZnRlcjtcbiAgICByZXR1cm4gdGV4dDtcbiAgfVxuXG4gIGZ1bmN0aW9uIHRyYWlsYmxhbmtsaW5lcmVwbGFjZXIgKGFsbCwgYmxhbmspIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gYmxhbmsgKyBjaHVua3Muc2VsZWN0aW9uOyByZXR1cm4gJyc7XG4gIH1cblxuICBmdW5jdGlvbiBsZWFkYmxhbmtsaW5lcmVwbGFjZXIgKGFsbCwgYmxhbmtzKSB7XG4gICAgY2h1bmtzLnN0YXJ0VGFnICs9IGJsYW5rczsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gYmVmb3JlUHJvY2Vzc2luZyAoKSB7XG4gICAgdmFyIGxpbmVzID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKC9cXG4kLywgJycpLnNwbGl0KCdcXG4nKTtcbiAgICB2YXIgY2hhaW5lZCA9IGZhbHNlO1xuICAgIHZhciBnb29kO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuICAgICAgZ29vZCA9IGZhbHNlO1xuICAgICAgbGluZSA9IGxpbmVzW2ldO1xuICAgICAgY2hhaW5lZCA9IGNoYWluZWQgJiYgbGluZS5sZW5ndGggPiAwO1xuICAgICAgaWYgKC9ePi8udGVzdChsaW5lKSkge1xuICAgICAgICBnb29kID0gdHJ1ZTtcbiAgICAgICAgaWYgKCFjaGFpbmVkICYmIGxpbmUubGVuZ3RoID4gMSkge1xuICAgICAgICAgIGNoYWluZWQgPSB0cnVlO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKC9eWyBcXHRdKiQvLnRlc3QobGluZSkpIHtcbiAgICAgICAgZ29vZCA9IHRydWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBnb29kID0gY2hhaW5lZDtcbiAgICAgIH1cbiAgICAgIGlmIChnb29kKSB7XG4gICAgICAgIG1hdGNoICs9IGxpbmUgKyAnXFxuJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxlZnRPdmVyICs9IG1hdGNoICsgbGluZTtcbiAgICAgICAgbWF0Y2ggPSAnXFxuJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoIS8oXnxcXG4pPi8udGVzdChtYXRjaCkpIHtcbiAgICAgIGxlZnRPdmVyICs9IG1hdGNoO1xuICAgICAgbWF0Y2ggPSAnJztcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlbmR0YWdyZXBsYWNlciAoYWxsKSB7XG4gICAgY2h1bmtzLmVuZFRhZyA9IGFsbDsgcmV0dXJuICcnO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVwbGFjZUJsYW5rc0luVGFncyAoYnJhY2tldCkge1xuICAgIHZhciByZXBsYWNlbWVudCA9IGJyYWNrZXQgPyAnPiAnIDogJyc7XG5cbiAgICBpZiAoY2h1bmtzLnN0YXJ0VGFnKSB7XG4gICAgICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3Muc3RhcnRUYWcucmVwbGFjZShydHJhaWxicmFja2V0LCByZXBsYWNlcik7XG4gICAgfVxuICAgIGlmIChjaHVua3MuZW5kVGFnKSB7XG4gICAgICBjaHVua3MuZW5kVGFnID0gY2h1bmtzLmVuZFRhZy5yZXBsYWNlKHJsZWFkYnJhY2tldCwgcmVwbGFjZXIpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHJlcGxhY2VyIChhbGwsIG1hcmtkb3duKSB7XG4gICAgICByZXR1cm4gJ1xcbicgKyBtYXJrZG93bi5yZXBsYWNlKC9eWyBdezAsM30+P1sgXFx0XSokL2dtLCByZXBsYWNlbWVudCkgKyAnXFxuJztcbiAgICB9XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBibG9ja3F1b3RlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmxlYWRpbmcgPSAvXihcXCoqKS87XG52YXIgcnRyYWlsaW5nID0gLyhcXCoqJCkvO1xudmFyIHJ0cmFpbGluZ3NwYWNlID0gLyhcXHM/KSQvO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGJvbGRPckl0YWxpYyAoY2h1bmtzLCB0eXBlKSB7XG4gIHZhciBybmV3bGluZXMgPSAvXFxuezIsfS9nO1xuICB2YXIgc3RhckNvdW50ID0gdHlwZSA9PT0gJ2JvbGQnID8gMiA6IDE7XG5cbiAgY2h1bmtzLnRyaW0oKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZShybmV3bGluZXMsICdcXG4nKTtcblxuICB2YXIgbWFya3VwO1xuICB2YXIgbGVhZFN0YXJzID0gcnRyYWlsaW5nLmV4ZWMoY2h1bmtzLmJlZm9yZSlbMF07XG4gIHZhciB0cmFpbFN0YXJzID0gcmxlYWRpbmcuZXhlYyhjaHVua3MuYWZ0ZXIpWzBdO1xuICB2YXIgc3RhcnMgPSAnXFxcXCp7JyArIHN0YXJDb3VudCArICd9JztcbiAgdmFyIGZlbmNlID0gTWF0aC5taW4obGVhZFN0YXJzLmxlbmd0aCwgdHJhaWxTdGFycy5sZW5ndGgpO1xuICBpZiAoZmVuY2UgPj0gc3RhckNvdW50ICYmIChmZW5jZSAhPT0gMiB8fCBzdGFyQ291bnQgIT09IDEpKSB7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShuZXcgUmVnRXhwKHN0YXJzICsgJyQnLCAnJyksICcnKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShuZXcgUmVnRXhwKCdeJyArIHN0YXJzLCAnJyksICcnKTtcbiAgfSBlbHNlIGlmICghY2h1bmtzLnNlbGVjdGlvbiAmJiB0cmFpbFN0YXJzKSB7XG4gICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2UocmxlYWRpbmcsICcnKTtcbiAgICBjaHVua3MuYmVmb3JlID0gY2h1bmtzLmJlZm9yZS5yZXBsYWNlKHJ0cmFpbGluZ3NwYWNlLCAnJykgKyB0cmFpbFN0YXJzICsgUmVnRXhwLiQxO1xuICB9IGVsc2Uge1xuICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbiAmJiAhdHJhaWxTdGFycykge1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgIH1cblxuICAgIG1hcmt1cCA9IHN0YXJDb3VudCA9PT0gMSA/ICcqJyA6ICcqKic7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUgKyBtYXJrdXA7XG4gICAgY2h1bmtzLmFmdGVyID0gbWFya3VwICsgY2h1bmtzLmFmdGVyO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gYm9sZE9ySXRhbGljO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBydGV4dGJlZm9yZSA9IC9cXFNbIF0qJC87XG52YXIgcnRleHRhZnRlciA9IC9eWyBdKlxcUy87XG52YXIgcm5ld2xpbmUgPSAvXFxuLztcbnZhciByYmFja3RpY2sgPSAvYC87XG52YXIgcmZlbmNlYmVmb3JlID0gL2BgYFthLXpdKlxcbj8kLztcbnZhciByZmVuY2ViZWZvcmVpbnNpZGUgPSAvXmBgYFthLXpdKlxcbi87XG52YXIgcmZlbmNlYWZ0ZXIgPSAvXlxcbj9gYGAvO1xudmFyIHJmZW5jZWFmdGVyaW5zaWRlID0gL1xcbmBgYCQvO1xuXG5mdW5jdGlvbiBjb2RlYmxvY2sgKGNodW5rcywgb3B0aW9ucykge1xuICB2YXIgbmV3bGluZWQgPSBybmV3bGluZS50ZXN0KGNodW5rcy5zZWxlY3Rpb24pO1xuICB2YXIgdHJhaWxpbmcgPSBydGV4dGFmdGVyLnRlc3QoY2h1bmtzLmFmdGVyKTtcbiAgdmFyIGxlYWRpbmcgPSBydGV4dGJlZm9yZS50ZXN0KGNodW5rcy5iZWZvcmUpO1xuICB2YXIgb3V0ZmVuY2VkID0gcmZlbmNlYmVmb3JlLnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgcmZlbmNlYWZ0ZXIudGVzdChjaHVua3MuYWZ0ZXIpO1xuICBpZiAob3V0ZmVuY2VkIHx8IG5ld2xpbmVkIHx8ICEobGVhZGluZyB8fCB0cmFpbGluZykpIHtcbiAgICBibG9jayhvdXRmZW5jZWQpO1xuICB9IGVsc2Uge1xuICAgIGlubGluZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gaW5saW5lICgpIHtcbiAgICBjaHVua3MudHJpbSgpO1xuICAgIGNodW5rcy5maW5kVGFncyhyYmFja3RpY2ssIHJiYWNrdGljayk7XG5cbiAgICBpZiAoIWNodW5rcy5zdGFydFRhZyAmJiAhY2h1bmtzLmVuZFRhZykge1xuICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICdgJztcbiAgICAgIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMuY29kZTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNodW5rcy5lbmRUYWcgJiYgIWNodW5rcy5zdGFydFRhZykge1xuICAgICAgY2h1bmtzLmJlZm9yZSArPSBjaHVua3MuZW5kVGFnO1xuICAgICAgY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIH0gZWxzZSB7XG4gICAgICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3MuZW5kVGFnID0gJyc7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmxvY2sgKG91dGZlbmNlZCkge1xuICAgIGlmIChvdXRmZW5jZWQpIHtcbiAgICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UocmZlbmNlYmVmb3JlLCAnJyk7XG4gICAgICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZmVuY2VhZnRlciwgJycpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNodW5rcy5iZWZvcmUgPSBjaHVua3MuYmVmb3JlLnJlcGxhY2UoL1sgXXs0fXxgYGBbYS16XSpcXG4kLywgbWVyZ2VTZWxlY3Rpb24pO1xuICAgIGNodW5rcy5za2lwKHtcbiAgICAgIGJlZm9yZTogLyhcXG58XikoXFx0fFsgXXs0LH18YGBgW2Etel0qXFxuKS4qXFxuJC8udGVzdChjaHVua3MuYmVmb3JlKSA/IDAgOiAxLFxuICAgICAgYWZ0ZXI6IC9eXFxuKFxcdHxbIF17NCx9fFxcbmBgYCkvLnRlc3QoY2h1bmtzLmFmdGVyKSA/IDAgOiAxXG4gICAgfSk7XG5cbiAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgIGlmIChvcHRpb25zLmZlbmNpbmcpIHtcbiAgICAgICAgY2h1bmtzLnN0YXJ0VGFnID0gJ2BgYFxcbic7XG4gICAgICAgIGNodW5rcy5lbmRUYWcgPSAnXFxuYGBgJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNodW5rcy5zdGFydFRhZyA9ICcgICAgJztcbiAgICAgIH1cbiAgICAgIGNodW5rcy5zZWxlY3Rpb24gPSBzdHJpbmdzLnBsYWNlaG9sZGVycy5jb2RlO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAocmZlbmNlYmVmb3JlaW5zaWRlLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikgJiYgcmZlbmNlYWZ0ZXJpbnNpZGUudGVzdChjaHVua3Muc2VsZWN0aW9uKSkge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC8oXmBgYFthLXpdKlxcbil8KGBgYCQpL2csICcnKTtcbiAgICAgIH0gZWxzZSBpZiAoL15bIF17MCwzfVxcUy9tLnRlc3QoY2h1bmtzLnNlbGVjdGlvbikpIHtcbiAgICAgICAgaWYgKG9wdGlvbnMuZmVuY2luZykge1xuICAgICAgICAgIGNodW5rcy5iZWZvcmUgKz0gJ2BgYFxcbic7XG4gICAgICAgICAgY2h1bmtzLmFmdGVyID0gJ1xcbmBgYCcgKyBjaHVua3MuYWZ0ZXI7XG4gICAgICAgIH0gZWxzZSBpZiAobmV3bGluZWQpIHtcbiAgICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eL2dtLCAnICAgICcpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNodW5rcy5iZWZvcmUgKz0gJyAgICAnO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9eKD86WyBdezR9fFsgXXswLDN9XFx0fGBgYFthLXpdKikvZ20sICcnKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBtZXJnZVNlbGVjdGlvbiAoYWxsKSB7XG4gICAgICBjaHVua3Muc2VsZWN0aW9uID0gYWxsICsgY2h1bmtzLnNlbGVjdGlvbjsgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGNvZGVibG9jaztcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG1hbnkgPSByZXF1aXJlKCcuLi9tYW55Jyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcblxuZnVuY3Rpb24gaGVhZGluZyAoY2h1bmtzKSB7XG4gIHZhciBsZXZlbCA9IDA7XG5cbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb25cbiAgICAucmVwbGFjZSgvXFxzKy9nLCAnICcpXG4gICAgLnJlcGxhY2UoLyheXFxzK3xcXHMrJCkvZywgJycpO1xuXG4gIGlmICghY2h1bmtzLnNlbGVjdGlvbikge1xuICAgIGNodW5rcy5zdGFydFRhZyA9ICcjICc7XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzLmhlYWRpbmc7XG4gICAgY2h1bmtzLmVuZFRhZyA9ICcnO1xuICAgIGNodW5rcy5za2lwKHsgYmVmb3JlOiAxLCBhZnRlcjogMSB9KTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjaHVua3MuZmluZFRhZ3MoLyMrWyBdKi8sIC9bIF0qIysvKTtcblxuICBpZiAoLyMrLy50ZXN0KGNodW5rcy5zdGFydFRhZykpIHtcbiAgICBsZXZlbCA9IFJlZ0V4cC5sYXN0TWF0Y2gubGVuZ3RoO1xuICB9XG5cbiAgY2h1bmtzLnN0YXJ0VGFnID0gY2h1bmtzLmVuZFRhZyA9ICcnO1xuICBjaHVua3MuZmluZFRhZ3MobnVsbCwgL1xccz8oLSt8PSspLyk7XG5cbiAgaWYgKC89Ky8udGVzdChjaHVua3MuZW5kVGFnKSkge1xuICAgIGxldmVsID0gMTtcbiAgfVxuXG4gIGlmICgvLSsvLnRlc3QoY2h1bmtzLmVuZFRhZykpIHtcbiAgICBsZXZlbCA9IDI7XG4gIH1cblxuICBjaHVua3Muc3RhcnRUYWcgPSBjaHVua3MuZW5kVGFnID0gJyc7XG4gIGNodW5rcy5za2lwKHsgYmVmb3JlOiAxLCBhZnRlcjogMSB9KTtcblxuICB2YXIgbGV2ZWxUb0NyZWF0ZSA9IGxldmVsIDwgMiA/IDQgOiBsZXZlbCAtIDE7XG4gIGlmIChsZXZlbFRvQ3JlYXRlID4gMCkge1xuICAgIGNodW5rcy5zdGFydFRhZyA9IG1hbnkoJyMnLCBsZXZlbFRvQ3JlYXRlKSArICcgJztcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGhlYWRpbmc7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGhyIChjaHVua3MpIHtcbiAgY2h1bmtzLnN0YXJ0VGFnID0gJy0tLS0tLS0tLS1cXG4nO1xuICBjaHVua3Muc2VsZWN0aW9uID0gJyc7XG4gIGNodW5rcy5za2lwKHsgbGVmdDogMiwgcmlnaHQ6IDEsIGFueTogdHJ1ZSB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBocjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIG9uY2UgPSByZXF1aXJlKCcuLi9vbmNlJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBwYXJzZUxpbmtJbnB1dCA9IHJlcXVpcmUoJy4uL2NodW5rcy9wYXJzZUxpbmtJbnB1dCcpO1xudmFyIHJkZWZpbml0aW9ucyA9IC9eWyBdezAsM31cXFsoKD86YXR0YWNobWVudC0pP1xcZCspXFxdOlsgXFx0XSpcXG4/WyBcXHRdKjw/KFxcUys/KT4/WyBcXHRdKlxcbj9bIFxcdF0qKD86KFxcbiopW1wiKF0oLis/KVtcIildWyBcXHRdKik/KD86XFxuK3wkKS9nbTtcbnZhciByYXR0YWNobWVudCA9IC9eYXR0YWNobWVudC0oXFxkKykkL2k7XG5cbmZ1bmN0aW9uIGV4dHJhY3REZWZpbml0aW9ucyAodGV4dCwgZGVmaW5pdGlvbnMpIHtcbiAgcmRlZmluaXRpb25zLmxhc3RJbmRleCA9IDA7XG4gIHJldHVybiB0ZXh0LnJlcGxhY2UocmRlZmluaXRpb25zLCByZXBsYWNlcik7XG5cbiAgZnVuY3Rpb24gcmVwbGFjZXIgKGFsbCwgaWQsIGxpbmssIG5ld2xpbmVzLCB0aXRsZSkge1xuICAgIGRlZmluaXRpb25zW2lkXSA9IGFsbC5yZXBsYWNlKC9cXHMqJC8sICcnKTtcbiAgICBpZiAobmV3bGluZXMpIHtcbiAgICAgIGRlZmluaXRpb25zW2lkXSA9IGFsbC5yZXBsYWNlKC9bXCIoXSguKz8pW1wiKV0kLywgJycpO1xuICAgICAgcmV0dXJuIG5ld2xpbmVzICsgdGl0bGU7XG4gICAgfVxuICAgIHJldHVybiAnJztcbiAgfVxufVxuXG5mdW5jdGlvbiBwdXNoRGVmaW5pdGlvbiAoY2h1bmtzLCBkZWZpbml0aW9uLCBhdHRhY2htZW50KSB7XG4gIHZhciByZWdleCA9IC8oXFxbKSgoPzpcXFtbXlxcXV0qXFxdfFteXFxbXFxdXSkqKShcXF1bIF0/KD86XFxuWyBdKik/XFxbKSgoPzphdHRhY2htZW50LSk/XFxkKykoXFxdKS9nO1xuICB2YXIgYW5jaG9yID0gMDtcbiAgdmFyIGRlZmluaXRpb25zID0ge307XG4gIHZhciBmb290bm90ZXMgPSBbXTtcblxuICBjaHVua3MuYmVmb3JlID0gZXh0cmFjdERlZmluaXRpb25zKGNodW5rcy5iZWZvcmUsIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGV4dHJhY3REZWZpbml0aW9ucyhjaHVua3Muc2VsZWN0aW9uLCBkZWZpbml0aW9ucyk7XG4gIGNodW5rcy5hZnRlciA9IGV4dHJhY3REZWZpbml0aW9ucyhjaHVua3MuYWZ0ZXIsIGRlZmluaXRpb25zKTtcbiAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG5cbiAgaWYgKGRlZmluaXRpb24pIHtcbiAgICBpZiAoIWF0dGFjaG1lbnQpIHsgcHVzaEFuY2hvcihkZWZpbml0aW9uKTsgfVxuICB9IGVsc2Uge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UocmVnZXgsIGdldExpbmspO1xuICB9XG5cbiAgdmFyIHJlc3VsdCA9IGFuY2hvcjtcblxuICBjaHVua3MuYWZ0ZXIgPSBjaHVua3MuYWZ0ZXIucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG5cbiAgaWYgKGNodW5rcy5hZnRlcikge1xuICAgIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKC9cXG4qJC8sICcnKTtcbiAgfVxuICBpZiAoIWNodW5rcy5hZnRlcikge1xuICAgIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UoL1xcbiokLywgJycpO1xuICB9XG5cbiAgYW5jaG9yID0gMDtcbiAgT2JqZWN0LmtleXMoZGVmaW5pdGlvbnMpLmZvckVhY2gocHVzaEF0dGFjaG1lbnRzKTtcblxuICBpZiAoYXR0YWNobWVudCkge1xuICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbik7XG4gIH1cbiAgY2h1bmtzLmFmdGVyICs9ICdcXG5cXG4nICsgZm9vdG5vdGVzLmpvaW4oJ1xcbicpO1xuXG4gIHJldHVybiByZXN1bHQ7XG5cbiAgZnVuY3Rpb24gcHVzaEF0dGFjaG1lbnRzIChkZWZpbml0aW9uKSB7XG4gICAgaWYgKHJhdHRhY2htZW50LnRlc3QoZGVmaW5pdGlvbikpIHtcbiAgICAgIHB1c2hBbmNob3IoZGVmaW5pdGlvbnNbZGVmaW5pdGlvbl0pO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHB1c2hBbmNob3IgKGRlZmluaXRpb24pIHtcbiAgICBhbmNob3IrKztcbiAgICBkZWZpbml0aW9uID0gZGVmaW5pdGlvbi5yZXBsYWNlKC9eWyBdezAsM31cXFsoYXR0YWNobWVudC0pPyhcXGQrKVxcXTovLCAnICBbJDEnICsgYW5jaG9yICsgJ106Jyk7XG4gICAgZm9vdG5vdGVzLnB1c2goZGVmaW5pdGlvbik7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMaW5rIChhbGwsIGJlZm9yZSwgaW5uZXIsIGFmdGVySW5uZXIsIGRlZmluaXRpb24sIGVuZCkge1xuICAgIGlubmVyID0gaW5uZXIucmVwbGFjZShyZWdleCwgZ2V0TGluayk7XG4gICAgaWYgKGRlZmluaXRpb25zW2RlZmluaXRpb25dKSB7XG4gICAgICBwdXNoQW5jaG9yKGRlZmluaXRpb25zW2RlZmluaXRpb25dKTtcbiAgICAgIHJldHVybiBiZWZvcmUgKyBpbm5lciArIGFmdGVySW5uZXIgKyBhbmNob3IgKyBlbmQ7XG4gICAgfVxuICAgIHJldHVybiBhbGw7XG4gIH1cbn1cblxuZnVuY3Rpb24gbGlua09ySW1hZ2VPckF0dGFjaG1lbnQgKGNodW5rcywgb3B0aW9ucykge1xuICB2YXIgdHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgdmFyIGltYWdlID0gdHlwZSA9PT0gJ2ltYWdlJztcbiAgdmFyIHJlc3VtZTtcblxuICBjaHVua3MudHJpbSgpO1xuICBjaHVua3MuZmluZFRhZ3MoL1xccyohP1xcWy8sIC9cXF1bIF0/KD86XFxuWyBdKik/KFxcWy4qP1xcXSk/Lyk7XG5cbiAgaWYgKGNodW5rcy5lbmRUYWcubGVuZ3RoID4gMSAmJiBjaHVua3Muc3RhcnRUYWcubGVuZ3RoID4gMCkge1xuICAgIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5zdGFydFRhZy5yZXBsYWNlKC8hP1xcWy8sICcnKTtcbiAgICBjaHVua3MuZW5kVGFnID0gJyc7XG4gICAgcHVzaERlZmluaXRpb24oY2h1bmtzKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnN0YXJ0VGFnICsgY2h1bmtzLnNlbGVjdGlvbiArIGNodW5rcy5lbmRUYWc7XG4gIGNodW5rcy5zdGFydFRhZyA9IGNodW5rcy5lbmRUYWcgPSAnJztcblxuICBpZiAoL1xcblxcbi8udGVzdChjaHVua3Muc2VsZWN0aW9uKSkge1xuICAgIHB1c2hEZWZpbml0aW9uKGNodW5rcyk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHJlc3VtZSA9IHRoaXMuYXN5bmMoKTtcblxuICBvcHRpb25zLnByb21wdHMuY2xvc2UoKTtcbiAgKG9wdGlvbnMucHJvbXB0c1t0eXBlXSB8fCBvcHRpb25zLnByb21wdHMubGluaykob3B0aW9ucywgb25jZShyZXNvbHZlZCkpO1xuXG4gIGZ1bmN0aW9uIHJlc29sdmVkIChyZXN1bHQpIHtcbiAgICB2YXIgbGluayA9IHBhcnNlTGlua0lucHV0KHJlc3VsdC5kZWZpbml0aW9uKTtcbiAgICBpZiAobGluay5ocmVmLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmVzdW1lKCk7IHJldHVybjtcbiAgICB9XG5cbiAgICBjaHVua3Muc2VsZWN0aW9uID0gKCcgJyArIGNodW5rcy5zZWxlY3Rpb24pLnJlcGxhY2UoLyhbXlxcXFxdKD86XFxcXFxcXFwpKikoPz1bW1xcXV0pL2csICckMVxcXFwnKS5zdWJzdHIoMSk7XG5cbiAgICB2YXIga2V5ID0gcmVzdWx0LmF0dGFjaG1lbnQgPyAnICBbYXR0YWNobWVudC05OTk5XTogJyA6ICcgWzk5OTldOiAnO1xuICAgIHZhciBkZWZpbml0aW9uID0ga2V5ICsgbGluay5ocmVmICsgKGxpbmsudGl0bGUgPyAnIFwiJyArIGxpbmsudGl0bGUgKyAnXCInIDogJycpO1xuICAgIHZhciBhbmNob3IgPSBwdXNoRGVmaW5pdGlvbihjaHVua3MsIGRlZmluaXRpb24sIHJlc3VsdC5hdHRhY2htZW50KTtcblxuICAgIGlmICghcmVzdWx0LmF0dGFjaG1lbnQpIHtcbiAgICAgIGFkZCgpO1xuICAgIH1cblxuICAgIHJlc3VtZSgpO1xuXG4gICAgZnVuY3Rpb24gYWRkICgpIHtcbiAgICAgIGNodW5rcy5zdGFydFRhZyA9IGltYWdlID8gJyFbJyA6ICdbJztcbiAgICAgIGNodW5rcy5lbmRUYWcgPSAnXVsnICsgYW5jaG9yICsgJ10nO1xuXG4gICAgICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IHN0cmluZ3MucGxhY2Vob2xkZXJzW3R5cGVdO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGxpbmtPckltYWdlT3JBdHRhY2htZW50O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgbWFueSA9IHJlcXVpcmUoJy4uL21hbnknKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi4vc3RyaW5ncycpO1xudmFyIHdyYXBwaW5nID0gcmVxdWlyZSgnLi93cmFwcGluZycpO1xudmFyIHNldHRpbmdzID0gcmVxdWlyZSgnLi9zZXR0aW5ncycpO1xudmFyIHJwcmV2aW91cyA9IC8oXFxufF4pKChbIF17MCwzfShbKistXXxcXGQrWy5dKVsgXFx0XSsuKikoXFxuLit8XFxuezIsfShbKistXS4qfFxcZCtbLl0pWyBcXHRdKy4qfFxcbnsyLH1bIFxcdF0rXFxTLiopKilcXG4qJC87XG52YXIgcm5leHQgPSAvXlxcbiooKFsgXXswLDN9KFsqKy1dfFxcZCtbLl0pWyBcXHRdKy4qKShcXG4uK3xcXG57Mix9KFsqKy1dLip8XFxkK1suXSlbIFxcdF0rLip8XFxuezIsfVsgXFx0XStcXFMuKikqKVxcbiovO1xudmFyIHJidWxsZXR0eXBlID0gL15cXHMqKFsqKy1dKS87XG52YXIgcnNraXBwZXIgPSAvW15cXG5dXFxuXFxuW15cXG5dLztcblxuZnVuY3Rpb24gcGFkICh0ZXh0KSB7XG4gIHJldHVybiAnICcgKyB0ZXh0ICsgJyAnO1xufVxuXG5mdW5jdGlvbiBsaXN0IChjaHVua3MsIG9yZGVyZWQpIHtcbiAgdmFyIGJ1bGxldCA9ICctJztcbiAgdmFyIG51bSA9IDE7XG4gIHZhciBkaWdpdGFsO1xuICB2YXIgYmVmb3JlU2tpcCA9IDE7XG4gIHZhciBhZnRlclNraXAgPSAxO1xuXG4gIGNodW5rcy5maW5kVGFncygvKFxcbnxeKSpbIF17MCwzfShbKistXXxcXGQrWy5dKVxccysvLCBudWxsKTtcblxuICBpZiAoY2h1bmtzLmJlZm9yZSAmJiAhL1xcbiQvLnRlc3QoY2h1bmtzLmJlZm9yZSkgJiYgIS9eXFxuLy50ZXN0KGNodW5rcy5zdGFydFRhZykpIHtcbiAgICBjaHVua3MuYmVmb3JlICs9IGNodW5rcy5zdGFydFRhZztcbiAgICBjaHVua3Muc3RhcnRUYWcgPSAnJztcbiAgfVxuXG4gIGlmIChjaHVua3Muc3RhcnRUYWcpIHtcbiAgICBkaWdpdGFsID0gL1xcZCtbLl0vLnRlc3QoY2h1bmtzLnN0YXJ0VGFnKTtcbiAgICBjaHVua3Muc3RhcnRUYWcgPSAnJztcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gY2h1bmtzLnNlbGVjdGlvbi5yZXBsYWNlKC9cXG5bIF17NH0vZywgJ1xcbicpO1xuICAgIHdyYXBwaW5nLnVud3JhcChjaHVua3MpO1xuICAgIGNodW5rcy5za2lwKCk7XG5cbiAgICBpZiAoZGlnaXRhbCkge1xuICAgICAgY2h1bmtzLmFmdGVyID0gY2h1bmtzLmFmdGVyLnJlcGxhY2Uocm5leHQsIGdldFByZWZpeGVkSXRlbSk7XG4gICAgfVxuICAgIGlmIChvcmRlcmVkID09PSBkaWdpdGFsKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICB9XG5cbiAgY2h1bmtzLmJlZm9yZSA9IGNodW5rcy5iZWZvcmUucmVwbGFjZShycHJldmlvdXMsIGJlZm9yZVJlcGxhY2VyKTtcblxuICBpZiAoIWNodW5rcy5zZWxlY3Rpb24pIHtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gc3RyaW5ncy5wbGFjZWhvbGRlcnMubGlzdGl0ZW07XG4gIH1cblxuICB2YXIgcHJlZml4ID0gbmV4dEJ1bGxldCgpO1xuICB2YXIgc3BhY2VzID0gbWFueSgnICcsIHByZWZpeC5sZW5ndGgpO1xuXG4gIGNodW5rcy5hZnRlciA9IGNodW5rcy5hZnRlci5yZXBsYWNlKHJuZXh0LCBhZnRlclJlcGxhY2VyKTtcbiAgY2h1bmtzLnRyaW0odHJ1ZSk7XG4gIGNodW5rcy5za2lwKHsgYmVmb3JlOiBiZWZvcmVTa2lwLCBhZnRlcjogYWZ0ZXJTa2lwLCBhbnk6IHRydWUgfSk7XG4gIGNodW5rcy5zdGFydFRhZyA9IHByZWZpeDtcbiAgd3JhcHBpbmcud3JhcChjaHVua3MsIHNldHRpbmdzLmxpbmVMZW5ndGggLSBwcmVmaXgubGVuZ3RoKTtcbiAgY2h1bmtzLnNlbGVjdGlvbiA9IGNodW5rcy5zZWxlY3Rpb24ucmVwbGFjZSgvXFxuL2csICdcXG4nICsgc3BhY2VzKTtcblxuICBmdW5jdGlvbiBiZWZvcmVSZXBsYWNlciAodGV4dCkge1xuICAgIGlmIChyYnVsbGV0dHlwZS50ZXN0KHRleHQpKSB7XG4gICAgICBidWxsZXQgPSBSZWdFeHAuJDE7XG4gICAgfVxuICAgIGJlZm9yZVNraXAgPSByc2tpcHBlci50ZXN0KHRleHQpID8gMSA6IDA7XG4gICAgcmV0dXJuIGdldFByZWZpeGVkSXRlbSh0ZXh0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFmdGVyUmVwbGFjZXIgKHRleHQpIHtcbiAgICBhZnRlclNraXAgPSByc2tpcHBlci50ZXN0KHRleHQpID8gMSA6IDA7XG4gICAgcmV0dXJuIGdldFByZWZpeGVkSXRlbSh0ZXh0KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG5leHRCdWxsZXQgKCkge1xuICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICByZXR1cm4gcGFkKChudW0rKykgKyAnLicpO1xuICAgIH1cbiAgICByZXR1cm4gcGFkKGJ1bGxldCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRQcmVmaXhlZEl0ZW0gKHRleHQpIHtcbiAgICB2YXIgcm1hcmtlcnMgPSAvXlsgXXswLDN9KFsqKy1dfFxcZCtbLl0pXFxzL2dtO1xuICAgIHJldHVybiB0ZXh0LnJlcGxhY2Uocm1hcmtlcnMsIG5leHRCdWxsZXQpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gbGlzdDtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGxpbmVMZW5ndGg6IDcyXG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcHJlZml4ZXMgPSAnKD86XFxcXHN7NCx9fFxcXFxzKj58XFxcXHMqLVxcXFxzK3xcXFxccypcXFxcZCtcXFxcLnw9fFxcXFwrfC18X3xcXFxcKnwjfFxcXFxzKlxcXFxbW15cXG5dXStcXFxcXTopJztcbnZhciBybGVhZGluZ3ByZWZpeGVzID0gbmV3IFJlZ0V4cCgnXicgKyBwcmVmaXhlcywgJycpO1xudmFyIHJ0ZXh0ID0gbmV3IFJlZ0V4cCgnKFteXFxcXG5dKVxcXFxuKD8hKFxcXFxufCcgKyBwcmVmaXhlcyArICcpKScsICdnJyk7XG52YXIgcnRyYWlsaW5nc3BhY2VzID0gL1xccyskLztcblxuZnVuY3Rpb24gd3JhcCAoY2h1bmtzLCBsZW4pIHtcbiAgdmFyIHJlZ2V4ID0gbmV3IFJlZ0V4cCgnKC57MSwnICsgbGVuICsgJ30pKCArfCRcXFxcbj8pJywgJ2dtJyk7XG5cbiAgdW53cmFwKGNodW5rcyk7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uXG4gICAgLnJlcGxhY2UocmVnZXgsIHJlcGxhY2VyKVxuICAgIC5yZXBsYWNlKHJ0cmFpbGluZ3NwYWNlcywgJycpO1xuXG4gIGZ1bmN0aW9uIHJlcGxhY2VyIChsaW5lLCBtYXJrZWQpIHtcbiAgICByZXR1cm4gcmxlYWRpbmdwcmVmaXhlcy50ZXN0KGxpbmUpID8gbGluZSA6IG1hcmtlZCArICdcXG4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVud3JhcCAoY2h1bmtzKSB7XG4gIHJ0ZXh0Lmxhc3RJbmRleCA9IDA7XG4gIGNodW5rcy5zZWxlY3Rpb24gPSBjaHVua3Muc2VsZWN0aW9uLnJlcGxhY2UocnRleHQsICckMSAkMicpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgd3JhcDogd3JhcCxcbiAgdW53cmFwOiB1bndyYXBcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIG9uY2UgKGZuKSB7XG4gIHZhciBkaXNwb3NlZDtcbiAgcmV0dXJuIGZ1bmN0aW9uIGRpc3Bvc2FibGUgKCkge1xuICAgIGlmIChkaXNwb3NlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBkaXNwb3NlZCA9IHRydWU7XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH07XG59XG5cbm1vZHVsZS5leHBvcnRzID0gb25jZTtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIGRvYyA9IGdsb2JhbC5kb2N1bWVudDtcbnZhciBnZXRTZWxlY3Rpb25SYXcgPSByZXF1aXJlKCcuL2dldFNlbGVjdGlvblJhdycpO1xudmFyIGdldFNlbGVjdGlvbk51bGxPcCA9IHJlcXVpcmUoJy4vZ2V0U2VsZWN0aW9uTnVsbE9wJyk7XG52YXIgZ2V0U2VsZWN0aW9uU3ludGhldGljID0gcmVxdWlyZSgnLi9nZXRTZWxlY3Rpb25TeW50aGV0aWMnKTtcbnZhciBpc0hvc3QgPSByZXF1aXJlKCcuL2lzSG9zdCcpO1xuaWYgKGlzSG9zdC5tZXRob2QoZ2xvYmFsLCAnZ2V0U2VsZWN0aW9uJykpIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25SYXc7XG59IGVsc2UgaWYgKHR5cGVvZiBkb2Muc2VsZWN0aW9uID09PSAnb2JqZWN0JyAmJiBkb2Muc2VsZWN0aW9uKSB7XG4gIG1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uU3ludGhldGljO1xufSBlbHNlIHtcbiAgbW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25OdWxsT3A7XG59XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXdiMng1Wm1sc2JITXZaMlYwVTJWc1pXTjBhVzl1TG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlHUnZZeUE5SUdkc2IySmhiQzVrYjJOMWJXVnVkRHRjYm5aaGNpQm5aWFJUWld4bFkzUnBiMjVTWVhjZ1BTQnlaWEYxYVhKbEtDY3VMMmRsZEZObGJHVmpkR2x2YmxKaGR5Y3BPMXh1ZG1GeUlHZGxkRk5sYkdWamRHbHZiazUxYkd4UGNDQTlJSEpsY1hWcGNtVW9KeTR2WjJWMFUyVnNaV04wYVc5dVRuVnNiRTl3SnlrN1hHNTJZWElnWjJWMFUyVnNaV04wYVc5dVUzbHVkR2hsZEdsaklEMGdjbVZ4ZFdseVpTZ25MaTluWlhSVFpXeGxZM1JwYjI1VGVXNTBhR1YwYVdNbktUdGNiblpoY2lCcGMwaHZjM1FnUFNCeVpYRjFhWEpsS0NjdUwybHpTRzl6ZENjcE8xeHVhV1lnS0dselNHOXpkQzV0WlhSb2IyUW9aMnh2WW1Gc0xDQW5aMlYwVTJWc1pXTjBhVzl1SnlrcElIdGNiaUFnYlc5a2RXeGxMbVY0Y0c5eWRITWdQU0JuWlhSVFpXeGxZM1JwYjI1U1lYYzdYRzU5SUdWc2MyVWdhV1lnS0hSNWNHVnZaaUJrYjJNdWMyVnNaV04wYVc5dUlEMDlQU0FuYjJKcVpXTjBKeUFtSmlCa2IyTXVjMlZzWldOMGFXOXVLU0I3WEc0Z0lHMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1oyVjBVMlZzWldOMGFXOXVVM2x1ZEdobGRHbGpPMXh1ZlNCbGJITmxJSHRjYmlBZ2JXOWtkV3hsTG1WNGNHOXlkSE1nUFNCblpYUlRaV3hsWTNScGIyNU9kV3hzVDNBN1hHNTlYRzRpWFgwPSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG5mdW5jdGlvbiBnZXRTZWxlY3Rpb25OdWxsT3AgKCkge1xuICByZXR1cm4ge1xuICAgIHJlbW92ZUFsbFJhbmdlczogbm9vcCxcbiAgICBhZGRSYW5nZTogbm9vcFxuICB9O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGdldFNlbGVjdGlvbk51bGxPcDtcbiIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uUmF3ICgpIHtcbiAgcmV0dXJuIGdsb2JhbC5nZXRTZWxlY3Rpb24oKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBnZXRTZWxlY3Rpb25SYXc7XG5cbn0pLmNhbGwodGhpcyx0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsIDogdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIgPyBzZWxmIDogdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHt9KVxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2NoYXJzZXQ6dXRmLTg7YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0p6YjNWeVkyVnpJanBiSW5OeVl5OXdiMng1Wm1sc2JITXZaMlYwVTJWc1pXTjBhVzl1VW1GM0xtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CSWl3aVptbHNaU0k2SW1kbGJtVnlZWFJsWkM1cWN5SXNJbk52ZFhKalpWSnZiM1FpT2lJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SW5kWE5sSUhOMGNtbGpkQ2M3WEc1Y2JtWjFibU4wYVc5dUlHZGxkRk5sYkdWamRHbHZibEpoZHlBb0tTQjdYRzRnSUhKbGRIVnliaUJuYkc5aVlXd3VaMlYwVTJWc1pXTjBhVzl1S0NrN1hHNTlYRzVjYm0xdlpIVnNaUzVsZUhCdmNuUnpJRDBnWjJWMFUyVnNaV04wYVc5dVVtRjNPMXh1SWwxOSIsIihmdW5jdGlvbiAoZ2xvYmFsKXtcbid1c2Ugc3RyaWN0JztcblxudmFyIHJhbmdlVG9UZXh0UmFuZ2UgPSByZXF1aXJlKCcuLi9yYW5nZVRvVGV4dFJhbmdlJyk7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcblxuZnVuY3Rpb24gR2V0U2VsZWN0aW9uIChzZWxlY3Rpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgcmFuZ2UgPSBzZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcblxuICB0aGlzLl9zZWxlY3Rpb24gPSBzZWxlY3Rpb247XG4gIHRoaXMuX3JhbmdlcyA9IFtdO1xuXG4gIGlmIChzZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbihzZWxmKTtcbiAgfSBlbHNlIGlmIChpc1RleHRSYW5nZShyYW5nZSkpIHtcbiAgICB1cGRhdGVGcm9tVGV4dFJhbmdlKHNlbGYsIHJhbmdlKTtcbiAgfSBlbHNlIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWxmKTtcbiAgfVxufVxuXG52YXIgR2V0U2VsZWN0aW9uUHJvdG8gPSBHZXRTZWxlY3Rpb24ucHJvdG90eXBlO1xuXG5HZXRTZWxlY3Rpb25Qcm90by5yZW1vdmVBbGxSYW5nZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciB0ZXh0UmFuZ2U7XG4gIHRyeSB7XG4gICAgdGhpcy5fc2VsZWN0aW9uLmVtcHR5KCk7XG4gICAgaWYgKHRoaXMuX3NlbGVjdGlvbi50eXBlICE9PSAnTm9uZScpIHtcbiAgICAgIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gICAgICB0ZXh0UmFuZ2Uuc2VsZWN0KCk7XG4gICAgICB0aGlzLl9zZWxlY3Rpb24uZW1wdHkoKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgfVxuICB1cGRhdGVFbXB0eVNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmFkZFJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSA9PT0gJ0NvbnRyb2wnKSB7XG4gICAgYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2UpO1xuICB9IGVsc2Uge1xuICAgIHJhbmdlVG9UZXh0UmFuZ2UocmFuZ2UpLnNlbGVjdCgpO1xuICAgIHRoaXMuX3Jhbmdlc1swXSA9IHJhbmdlO1xuICAgIHRoaXMucmFuZ2VDb3VudCA9IDE7XG4gICAgdGhpcy5pc0NvbGxhcHNlZCA9IHRoaXMuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgdXBkYXRlQW5jaG9yQW5kRm9jdXNGcm9tUmFuZ2UodGhpcywgcmFuZ2UsIGZhbHNlKTtcbiAgfVxufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0UmFuZ2VzID0gZnVuY3Rpb24gKHJhbmdlcykge1xuICB0aGlzLnJlbW92ZUFsbFJhbmdlcygpO1xuICB2YXIgcmFuZ2VDb3VudCA9IHJhbmdlcy5sZW5ndGg7XG4gIGlmIChyYW5nZUNvdW50ID4gMSkge1xuICAgIGNyZWF0ZUNvbnRyb2xTZWxlY3Rpb24odGhpcywgcmFuZ2VzKTtcbiAgfSBlbHNlIGlmIChyYW5nZUNvdW50KSB7XG4gICAgdGhpcy5hZGRSYW5nZShyYW5nZXNbMF0pO1xuICB9XG59O1xuXG5HZXRTZWxlY3Rpb25Qcm90by5nZXRSYW5nZUF0ID0gZnVuY3Rpb24gKGluZGV4KSB7XG4gIGlmIChpbmRleCA8IDAgfHwgaW5kZXggPj0gdGhpcy5yYW5nZUNvdW50KSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRSYW5nZUF0KCk6IGluZGV4IG91dCBvZiBib3VuZHMnKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gdGhpcy5fcmFuZ2VzW2luZGV4XS5jbG9uZVJhbmdlKCk7XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLnJlbW92ZVJhbmdlID0gZnVuY3Rpb24gKHJhbmdlKSB7XG4gIGlmICh0aGlzLl9zZWxlY3Rpb24udHlwZSAhPT0gJ0NvbnRyb2wnKSB7XG4gICAgcmVtb3ZlUmFuZ2VNYW51YWxseSh0aGlzLCByYW5nZSk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBjb250cm9sUmFuZ2UgPSB0aGlzLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgdmFyIHJhbmdlRWxlbWVudCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2UpO1xuICB2YXIgbmV3Q29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgdmFyIGVsO1xuICB2YXIgcmVtb3ZlZCA9IGZhbHNlO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gY29udHJvbFJhbmdlLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgZWwgPSBjb250cm9sUmFuZ2UuaXRlbShpKTtcbiAgICBpZiAoZWwgIT09IHJhbmdlRWxlbWVudCB8fCByZW1vdmVkKSB7XG4gICAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlZCA9IHRydWU7XG4gICAgfVxuICB9XG4gIG5ld0NvbnRyb2xSYW5nZS5zZWxlY3QoKTtcbiAgdXBkYXRlQ29udHJvbFNlbGVjdGlvbih0aGlzKTtcbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmVhY2hSYW5nZSA9IGZ1bmN0aW9uIChmbiwgcmV0dXJuVmFsdWUpIHtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuID0gdGhpcy5fcmFuZ2VzLmxlbmd0aDtcbiAgZm9yIChpID0gMDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKGZuKHRoaXMuZ2V0UmFuZ2VBdChpKSkpIHtcbiAgICAgIHJldHVybiByZXR1cm5WYWx1ZTtcbiAgICB9XG4gIH1cbn07XG5cbkdldFNlbGVjdGlvblByb3RvLmdldEFsbFJhbmdlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJhbmdlcyA9IFtdO1xuICB0aGlzLmVhY2hSYW5nZShmdW5jdGlvbiAocmFuZ2UpIHtcbiAgICByYW5nZXMucHVzaChyYW5nZSk7XG4gIH0pO1xuICByZXR1cm4gcmFuZ2VzO1xufTtcblxuR2V0U2VsZWN0aW9uUHJvdG8uc2V0U2luZ2xlUmFuZ2UgPSBmdW5jdGlvbiAocmFuZ2UpIHtcbiAgdGhpcy5yZW1vdmVBbGxSYW5nZXMoKTtcbiAgdGhpcy5hZGRSYW5nZShyYW5nZSk7XG59O1xuXG5mdW5jdGlvbiBjcmVhdGVDb250cm9sU2VsZWN0aW9uIChzZWwsIHJhbmdlcykge1xuICB2YXIgY29udHJvbFJhbmdlID0gYm9keS5jcmVhdGVDb250cm9sUmFuZ2UoKTtcbiAgZm9yICh2YXIgaSA9IDAsIGVsLCBsZW4gPSByYW5nZXMubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBlbCA9IGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UocmFuZ2VzW2ldKTtcbiAgICB0cnkge1xuICAgICAgY29udHJvbFJhbmdlLmFkZChlbCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdzZXRSYW5nZXMoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgICB9XG4gIH1cbiAgY29udHJvbFJhbmdlLnNlbGVjdCgpO1xuICB1cGRhdGVDb250cm9sU2VsZWN0aW9uKHNlbCk7XG59XG5cbmZ1bmN0aW9uIHJlbW92ZVJhbmdlTWFudWFsbHkgKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIHJhbmdlcyA9IHNlbC5nZXRBbGxSYW5nZXMoKTtcbiAgc2VsLnJlbW92ZUFsbFJhbmdlcygpO1xuICBmb3IgKHZhciBpID0gMCwgbGVuID0gcmFuZ2VzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc1NhbWVSYW5nZShyYW5nZSwgcmFuZ2VzW2ldKSkge1xuICAgICAgc2VsLmFkZFJhbmdlKHJhbmdlc1tpXSk7XG4gICAgfVxuICB9XG4gIGlmICghc2VsLnJhbmdlQ291bnQpIHtcbiAgICB1cGRhdGVFbXB0eVNlbGVjdGlvbihzZWwpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlIChzZWwsIHJhbmdlKSB7XG4gIHZhciBhbmNob3JQcmVmaXggPSAnc3RhcnQnO1xuICB2YXIgZm9jdXNQcmVmaXggPSAnZW5kJztcbiAgc2VsLmFuY2hvck5vZGUgPSByYW5nZVthbmNob3JQcmVmaXggKyAnQ29udGFpbmVyJ107XG4gIHNlbC5hbmNob3JPZmZzZXQgPSByYW5nZVthbmNob3JQcmVmaXggKyAnT2Zmc2V0J107XG4gIHNlbC5mb2N1c05vZGUgPSByYW5nZVtmb2N1c1ByZWZpeCArICdDb250YWluZXInXTtcbiAgc2VsLmZvY3VzT2Zmc2V0ID0gcmFuZ2VbZm9jdXNQcmVmaXggKyAnT2Zmc2V0J107XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUVtcHR5U2VsZWN0aW9uIChzZWwpIHtcbiAgc2VsLmFuY2hvck5vZGUgPSBzZWwuZm9jdXNOb2RlID0gbnVsbDtcbiAgc2VsLmFuY2hvck9mZnNldCA9IHNlbC5mb2N1c09mZnNldCA9IDA7XG4gIHNlbC5yYW5nZUNvdW50ID0gMDtcbiAgc2VsLmlzQ29sbGFwc2VkID0gdHJ1ZTtcbiAgc2VsLl9yYW5nZXMubGVuZ3RoID0gMDtcbn1cblxuZnVuY3Rpb24gcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQgKHJhbmdlTm9kZXMpIHtcbiAgaWYgKCFyYW5nZU5vZGVzLmxlbmd0aCB8fCByYW5nZU5vZGVzWzBdLm5vZGVUeXBlICE9PSAxKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGZvciAodmFyIGkgPSAxLCBsZW4gPSByYW5nZU5vZGVzLmxlbmd0aDsgaSA8IGxlbjsgKytpKSB7XG4gICAgaWYgKCFpc0FuY2VzdG9yT2YocmFuZ2VOb2Rlc1swXSwgcmFuZ2VOb2Rlc1tpXSkpIHtcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGdldFNpbmdsZUVsZW1lbnRGcm9tUmFuZ2UgKHJhbmdlKSB7XG4gIHZhciBub2RlcyA9IHJhbmdlLmdldE5vZGVzKCk7XG4gIGlmICghcmFuZ2VDb250YWluc1NpbmdsZUVsZW1lbnQobm9kZXMpKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKCk6IHJhbmdlIGRpZCBub3QgY29uc2lzdCBvZiBhIHNpbmdsZSBlbGVtZW50Jyk7XG4gIH1cbiAgcmV0dXJuIG5vZGVzWzBdO1xufVxuXG5mdW5jdGlvbiBpc1RleHRSYW5nZSAocmFuZ2UpIHtcbiAgcmV0dXJuIHJhbmdlICYmIHJhbmdlLnRleHQgIT09IHZvaWQgMDtcbn1cblxuZnVuY3Rpb24gdXBkYXRlRnJvbVRleHRSYW5nZSAoc2VsLCByYW5nZSkge1xuICBzZWwuX3JhbmdlcyA9IFtyYW5nZV07XG4gIHVwZGF0ZUFuY2hvckFuZEZvY3VzRnJvbVJhbmdlKHNlbCwgcmFuZ2UsIGZhbHNlKTtcbiAgc2VsLnJhbmdlQ291bnQgPSAxO1xuICBzZWwuaXNDb2xsYXBzZWQgPSByYW5nZS5jb2xsYXBzZWQ7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24gKHNlbCkge1xuICBzZWwuX3Jhbmdlcy5sZW5ndGggPSAwO1xuICBpZiAoc2VsLl9zZWxlY3Rpb24udHlwZSA9PT0gJ05vbmUnKSB7XG4gICAgdXBkYXRlRW1wdHlTZWxlY3Rpb24oc2VsKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY29udHJvbFJhbmdlID0gc2VsLl9zZWxlY3Rpb24uY3JlYXRlUmFuZ2UoKTtcbiAgICBpZiAoaXNUZXh0UmFuZ2UoY29udHJvbFJhbmdlKSkge1xuICAgICAgdXBkYXRlRnJvbVRleHRSYW5nZShzZWwsIGNvbnRyb2xSYW5nZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHNlbC5yYW5nZUNvdW50ID0gY29udHJvbFJhbmdlLmxlbmd0aDtcbiAgICAgIHZhciByYW5nZTtcbiAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgc2VsLnJhbmdlQ291bnQ7ICsraSkge1xuICAgICAgICByYW5nZSA9IGRvYy5jcmVhdGVSYW5nZSgpO1xuICAgICAgICByYW5nZS5zZWxlY3ROb2RlKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgICAgICAgc2VsLl9yYW5nZXMucHVzaChyYW5nZSk7XG4gICAgICB9XG4gICAgICBzZWwuaXNDb2xsYXBzZWQgPSBzZWwucmFuZ2VDb3VudCA9PT0gMSAmJiBzZWwuX3Jhbmdlc1swXS5jb2xsYXBzZWQ7XG4gICAgICB1cGRhdGVBbmNob3JBbmRGb2N1c0Zyb21SYW5nZShzZWwsIHNlbC5fcmFuZ2VzW3NlbC5yYW5nZUNvdW50IC0gMV0sIGZhbHNlKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWRkUmFuZ2VUb0NvbnRyb2xTZWxlY3Rpb24gKHNlbCwgcmFuZ2UpIHtcbiAgdmFyIGNvbnRyb2xSYW5nZSA9IHNlbC5fc2VsZWN0aW9uLmNyZWF0ZVJhbmdlKCk7XG4gIHZhciByYW5nZUVsZW1lbnQgPSBnZXRTaW5nbGVFbGVtZW50RnJvbVJhbmdlKHJhbmdlKTtcbiAgdmFyIG5ld0NvbnRyb2xSYW5nZSA9IGJvZHkuY3JlYXRlQ29udHJvbFJhbmdlKCk7XG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBjb250cm9sUmFuZ2UubGVuZ3RoOyBpIDwgbGVuOyArK2kpIHtcbiAgICBuZXdDb250cm9sUmFuZ2UuYWRkKGNvbnRyb2xSYW5nZS5pdGVtKGkpKTtcbiAgfVxuICB0cnkge1xuICAgIG5ld0NvbnRyb2xSYW5nZS5hZGQocmFuZ2VFbGVtZW50KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIHRocm93IG5ldyBFcnJvcignYWRkUmFuZ2UoKTogRWxlbWVudCBjb3VsZCBub3QgYmUgYWRkZWQgdG8gY29udHJvbCBzZWxlY3Rpb24nKTtcbiAgfVxuICBuZXdDb250cm9sUmFuZ2Uuc2VsZWN0KCk7XG4gIHVwZGF0ZUNvbnRyb2xTZWxlY3Rpb24oc2VsKTtcbn1cblxuZnVuY3Rpb24gaXNTYW1lUmFuZ2UgKGxlZnQsIHJpZ2h0KSB7XG4gIHJldHVybiAoXG4gICAgbGVmdC5zdGFydENvbnRhaW5lciA9PT0gcmlnaHQuc3RhcnRDb250YWluZXIgJiZcbiAgICBsZWZ0LnN0YXJ0T2Zmc2V0ID09PSByaWdodC5zdGFydE9mZnNldCAmJlxuICAgIGxlZnQuZW5kQ29udGFpbmVyID09PSByaWdodC5lbmRDb250YWluZXIgJiZcbiAgICBsZWZ0LmVuZE9mZnNldCA9PT0gcmlnaHQuZW5kT2Zmc2V0XG4gICk7XG59XG5cbmZ1bmN0aW9uIGlzQW5jZXN0b3JPZiAoYW5jZXN0b3IsIGRlc2NlbmRhbnQpIHtcbiAgdmFyIG5vZGUgPSBkZXNjZW5kYW50O1xuICB3aGlsZSAobm9kZS5wYXJlbnROb2RlKSB7XG4gICAgaWYgKG5vZGUucGFyZW50Tm9kZSA9PT0gYW5jZXN0b3IpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICBub2RlID0gbm9kZS5wYXJlbnROb2RlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuZnVuY3Rpb24gZ2V0U2VsZWN0aW9uICgpIHtcbiAgcmV0dXJuIG5ldyBHZXRTZWxlY3Rpb24oZ2xvYmFsLmRvY3VtZW50LnNlbGVjdGlvbik7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ2V0U2VsZWN0aW9uO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTl3YjJ4NVptbHNiSE12WjJWMFUyVnNaV04wYVc5dVUzbHVkR2hsZEdsakxtcHpJbDBzSW01aGJXVnpJanBiWFN3aWJXRndjR2x1WjNNaU9pSTdRVUZCUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRWlMQ0ptYVd4bElqb2laMlZ1WlhKaGRHVmtMbXB6SWl3aWMyOTFjbU5sVW05dmRDSTZJaUlzSW5OdmRYSmpaWE5EYjI1MFpXNTBJanBiSWlkMWMyVWdjM1J5YVdOMEp6dGNibHh1ZG1GeUlISmhibWRsVkc5VVpYaDBVbUZ1WjJVZ1BTQnlaWEYxYVhKbEtDY3VMaTl5WVc1blpWUnZWR1Y0ZEZKaGJtZGxKeWs3WEc1MllYSWdaRzlqSUQwZ1oyeHZZbUZzTG1SdlkzVnRaVzUwTzF4dWRtRnlJR0p2WkhrZ1BTQmtiMk11WW05a2VUdGNibHh1Wm5WdVkzUnBiMjRnUjJWMFUyVnNaV04wYVc5dUlDaHpaV3hsWTNScGIyNHBJSHRjYmlBZ2RtRnlJSE5sYkdZZ1BTQjBhR2x6TzF4dUlDQjJZWElnY21GdVoyVWdQU0J6Wld4bFkzUnBiMjR1WTNKbFlYUmxVbUZ1WjJVb0tUdGNibHh1SUNCMGFHbHpMbDl6Wld4bFkzUnBiMjRnUFNCelpXeGxZM1JwYjI0N1hHNGdJSFJvYVhNdVgzSmhibWRsY3lBOUlGdGRPMXh1WEc0Z0lHbG1JQ2h6Wld4bFkzUnBiMjR1ZEhsd1pTQTlQVDBnSjBOdmJuUnliMnduS1NCN1hHNGdJQ0FnZFhCa1lYUmxRMjl1ZEhKdmJGTmxiR1ZqZEdsdmJpaHpaV3htS1R0Y2JpQWdmU0JsYkhObElHbG1JQ2hwYzFSbGVIUlNZVzVuWlNoeVlXNW5aU2twSUh0Y2JpQWdJQ0IxY0dSaGRHVkdjbTl0VkdWNGRGSmhibWRsS0hObGJHWXNJSEpoYm1kbEtUdGNiaUFnZlNCbGJITmxJSHRjYmlBZ0lDQjFjR1JoZEdWRmJYQjBlVk5sYkdWamRHbHZiaWh6Wld4bUtUdGNiaUFnZlZ4dWZWeHVYRzUyWVhJZ1IyVjBVMlZzWldOMGFXOXVVSEp2ZEc4Z1BTQkhaWFJUWld4bFkzUnBiMjR1Y0hKdmRHOTBlWEJsTzF4dVhHNUhaWFJUWld4bFkzUnBiMjVRY205MGJ5NXlaVzF2ZG1WQmJHeFNZVzVuWlhNZ1BTQm1kVzVqZEdsdmJpQW9LU0I3WEc0Z0lIWmhjaUIwWlhoMFVtRnVaMlU3WEc0Z0lIUnllU0I3WEc0Z0lDQWdkR2hwY3k1ZmMyVnNaV04wYVc5dUxtVnRjSFI1S0NrN1hHNGdJQ0FnYVdZZ0tIUm9hWE11WDNObGJHVmpkR2x2Ymk1MGVYQmxJQ0U5UFNBblRtOXVaU2NwSUh0Y2JpQWdJQ0FnSUhSbGVIUlNZVzVuWlNBOUlHSnZaSGt1WTNKbFlYUmxWR1Y0ZEZKaGJtZGxLQ2s3WEc0Z0lDQWdJQ0IwWlhoMFVtRnVaMlV1YzJWc1pXTjBLQ2s3WEc0Z0lDQWdJQ0IwYUdsekxsOXpaV3hsWTNScGIyNHVaVzF3ZEhrb0tUdGNiaUFnSUNCOVhHNGdJSDBnWTJGMFkyZ2dLR1VwSUh0Y2JpQWdmVnh1SUNCMWNHUmhkR1ZGYlhCMGVWTmxiR1ZqZEdsdmJpaDBhR2x6S1R0Y2JuMDdYRzVjYmtkbGRGTmxiR1ZqZEdsdmJsQnliM1J2TG1Ga1pGSmhibWRsSUQwZ1puVnVZM1JwYjI0Z0tISmhibWRsS1NCN1hHNGdJR2xtSUNoMGFHbHpMbDl6Wld4bFkzUnBiMjR1ZEhsd1pTQTlQVDBnSjBOdmJuUnliMnduS1NCN1hHNGdJQ0FnWVdSa1VtRnVaMlZVYjBOdmJuUnliMnhUWld4bFkzUnBiMjRvZEdocGN5d2djbUZ1WjJVcE8xeHVJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lISmhibWRsVkc5VVpYaDBVbUZ1WjJVb2NtRnVaMlVwTG5ObGJHVmpkQ2dwTzF4dUlDQWdJSFJvYVhNdVgzSmhibWRsYzFzd1hTQTlJSEpoYm1kbE8xeHVJQ0FnSUhSb2FYTXVjbUZ1WjJWRGIzVnVkQ0E5SURFN1hHNGdJQ0FnZEdocGN5NXBjME52Ykd4aGNITmxaQ0E5SUhSb2FYTXVYM0poYm1kbGMxc3dYUzVqYjJ4c1lYQnpaV1E3WEc0Z0lDQWdkWEJrWVhSbFFXNWphRzl5UVc1a1JtOWpkWE5HY205dFVtRnVaMlVvZEdocGN5d2djbUZ1WjJVc0lHWmhiSE5sS1R0Y2JpQWdmVnh1ZlR0Y2JseHVSMlYwVTJWc1pXTjBhVzl1VUhKdmRHOHVjMlYwVW1GdVoyVnpJRDBnWm5WdVkzUnBiMjRnS0hKaGJtZGxjeWtnZTF4dUlDQjBhR2x6TG5KbGJXOTJaVUZzYkZKaGJtZGxjeWdwTzF4dUlDQjJZWElnY21GdVoyVkRiM1Z1ZENBOUlISmhibWRsY3k1c1pXNW5kR2c3WEc0Z0lHbG1JQ2h5WVc1blpVTnZkVzUwSUQ0Z01Ta2dlMXh1SUNBZ0lHTnlaV0YwWlVOdmJuUnliMnhUWld4bFkzUnBiMjRvZEdocGN5d2djbUZ1WjJWektUdGNiaUFnZlNCbGJITmxJR2xtSUNoeVlXNW5aVU52ZFc1MEtTQjdYRzRnSUNBZ2RHaHBjeTVoWkdSU1lXNW5aU2h5WVc1blpYTmJNRjBwTzF4dUlDQjlYRzU5TzF4dVhHNUhaWFJUWld4bFkzUnBiMjVRY205MGJ5NW5aWFJTWVc1blpVRjBJRDBnWm5WdVkzUnBiMjRnS0dsdVpHVjRLU0I3WEc0Z0lHbG1JQ2hwYm1SbGVDQThJREFnZkh3Z2FXNWtaWGdnUGowZ2RHaHBjeTV5WVc1blpVTnZkVzUwS1NCN1hHNGdJQ0FnZEdoeWIzY2dibVYzSUVWeWNtOXlLQ2RuWlhSU1lXNW5aVUYwS0NrNklHbHVaR1Y0SUc5MWRDQnZaaUJpYjNWdVpITW5LVHRjYmlBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0J5WlhSMWNtNGdkR2hwY3k1ZmNtRnVaMlZ6VzJsdVpHVjRYUzVqYkc5dVpWSmhibWRsS0NrN1hHNGdJSDFjYm4wN1hHNWNia2RsZEZObGJHVmpkR2x2YmxCeWIzUnZMbkpsYlc5MlpWSmhibWRsSUQwZ1puVnVZM1JwYjI0Z0tISmhibWRsS1NCN1hHNGdJR2xtSUNoMGFHbHpMbDl6Wld4bFkzUnBiMjR1ZEhsd1pTQWhQVDBnSjBOdmJuUnliMnduS1NCN1hHNGdJQ0FnY21WdGIzWmxVbUZ1WjJWTllXNTFZV3hzZVNoMGFHbHpMQ0J5WVc1blpTazdYRzRnSUNBZ2NtVjBkWEp1TzF4dUlDQjlYRzRnSUhaaGNpQmpiMjUwY205c1VtRnVaMlVnUFNCMGFHbHpMbDl6Wld4bFkzUnBiMjR1WTNKbFlYUmxVbUZ1WjJVb0tUdGNiaUFnZG1GeUlISmhibWRsUld4bGJXVnVkQ0E5SUdkbGRGTnBibWRzWlVWc1pXMWxiblJHY205dFVtRnVaMlVvY21GdVoyVXBPMXh1SUNCMllYSWdibVYzUTI5dWRISnZiRkpoYm1kbElEMGdZbTlrZVM1amNtVmhkR1ZEYjI1MGNtOXNVbUZ1WjJVb0tUdGNiaUFnZG1GeUlHVnNPMXh1SUNCMllYSWdjbVZ0YjNabFpDQTlJR1poYkhObE8xeHVJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Dd2diR1Z1SUQwZ1kyOXVkSEp2YkZKaGJtZGxMbXhsYm1kMGFEc2dhU0E4SUd4bGJqc2dLeXRwS1NCN1hHNGdJQ0FnWld3Z1BTQmpiMjUwY205c1VtRnVaMlV1YVhSbGJTaHBLVHRjYmlBZ0lDQnBaaUFvWld3Z0lUMDlJSEpoYm1kbFJXeGxiV1Z1ZENCOGZDQnlaVzF2ZG1Wa0tTQjdYRzRnSUNBZ0lDQnVaWGREYjI1MGNtOXNVbUZ1WjJVdVlXUmtLR052Ym5SeWIyeFNZVzVuWlM1cGRHVnRLR2twS1R0Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdjbVZ0YjNabFpDQTlJSFJ5ZFdVN1hHNGdJQ0FnZlZ4dUlDQjlYRzRnSUc1bGQwTnZiblJ5YjJ4U1lXNW5aUzV6Wld4bFkzUW9LVHRjYmlBZ2RYQmtZWFJsUTI5dWRISnZiRk5sYkdWamRHbHZiaWgwYUdsektUdGNibjA3WEc1Y2JrZGxkRk5sYkdWamRHbHZibEJ5YjNSdkxtVmhZMmhTWVc1blpTQTlJR1oxYm1OMGFXOXVJQ2htYml3Z2NtVjBkWEp1Vm1Gc2RXVXBJSHRjYmlBZ2RtRnlJR2tnUFNBd08xeHVJQ0IyWVhJZ2JHVnVJRDBnZEdocGN5NWZjbUZ1WjJWekxteGxibWQwYUR0Y2JpQWdabTl5SUNocElEMGdNRHNnYVNBOElHeGxianNnS3l0cEtTQjdYRzRnSUNBZ2FXWWdLR1p1S0hSb2FYTXVaMlYwVW1GdVoyVkJkQ2hwS1NrcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCeVpYUjFjbTVXWVd4MVpUdGNiaUFnSUNCOVhHNGdJSDFjYm4wN1hHNWNia2RsZEZObGJHVmpkR2x2YmxCeWIzUnZMbWRsZEVGc2JGSmhibWRsY3lBOUlHWjFibU4wYVc5dUlDZ3BJSHRjYmlBZ2RtRnlJSEpoYm1kbGN5QTlJRnRkTzF4dUlDQjBhR2x6TG1WaFkyaFNZVzVuWlNobWRXNWpkR2x2YmlBb2NtRnVaMlVwSUh0Y2JpQWdJQ0J5WVc1blpYTXVjSFZ6YUNoeVlXNW5aU2s3WEc0Z0lIMHBPMXh1SUNCeVpYUjFjbTRnY21GdVoyVnpPMXh1ZlR0Y2JseHVSMlYwVTJWc1pXTjBhVzl1VUhKdmRHOHVjMlYwVTJsdVoyeGxVbUZ1WjJVZ1BTQm1kVzVqZEdsdmJpQW9jbUZ1WjJVcElIdGNiaUFnZEdocGN5NXlaVzF2ZG1WQmJHeFNZVzVuWlhNb0tUdGNiaUFnZEdocGN5NWhaR1JTWVc1blpTaHlZVzVuWlNrN1hHNTlPMXh1WEc1bWRXNWpkR2x2YmlCamNtVmhkR1ZEYjI1MGNtOXNVMlZzWldOMGFXOXVJQ2h6Wld3c0lISmhibWRsY3lrZ2UxeHVJQ0IyWVhJZ1kyOXVkSEp2YkZKaGJtZGxJRDBnWW05a2VTNWpjbVZoZEdWRGIyNTBjbTlzVW1GdVoyVW9LVHRjYmlBZ1ptOXlJQ2gyWVhJZ2FTQTlJREFzSUdWc0xDQnNaVzRnUFNCeVlXNW5aWE11YkdWdVozUm9PeUJwSUR3Z2JHVnVPeUFySzJrcElIdGNiaUFnSUNCbGJDQTlJR2RsZEZOcGJtZHNaVVZzWlcxbGJuUkdjbTl0VW1GdVoyVW9jbUZ1WjJWelcybGRLVHRjYmlBZ0lDQjBjbmtnZTF4dUlDQWdJQ0FnWTI5dWRISnZiRkpoYm1kbExtRmtaQ2hsYkNrN1hHNGdJQ0FnZlNCallYUmphQ0FvWlNrZ2UxeHVJQ0FnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkelpYUlNZVzVuWlhNb0tUb2dSV3hsYldWdWRDQmpiM1ZzWkNCdWIzUWdZbVVnWVdSa1pXUWdkRzhnWTI5dWRISnZiQ0J6Wld4bFkzUnBiMjRuS1R0Y2JpQWdJQ0I5WEc0Z0lIMWNiaUFnWTI5dWRISnZiRkpoYm1kbExuTmxiR1ZqZENncE8xeHVJQ0IxY0dSaGRHVkRiMjUwY205c1UyVnNaV04wYVc5dUtITmxiQ2s3WEc1OVhHNWNibVoxYm1OMGFXOXVJSEpsYlc5MlpWSmhibWRsVFdGdWRXRnNiSGtnS0hObGJDd2djbUZ1WjJVcElIdGNiaUFnZG1GeUlISmhibWRsY3lBOUlITmxiQzVuWlhSQmJHeFNZVzVuWlhNb0tUdGNiaUFnYzJWc0xuSmxiVzkyWlVGc2JGSmhibWRsY3lncE8xeHVJQ0JtYjNJZ0tIWmhjaUJwSUQwZ01Dd2diR1Z1SUQwZ2NtRnVaMlZ6TG14bGJtZDBhRHNnYVNBOElHeGxianNnS3l0cEtTQjdYRzRnSUNBZ2FXWWdLQ0ZwYzFOaGJXVlNZVzVuWlNoeVlXNW5aU3dnY21GdVoyVnpXMmxkS1NrZ2UxeHVJQ0FnSUNBZ2MyVnNMbUZrWkZKaGJtZGxLSEpoYm1kbGMxdHBYU2s3WEc0Z0lDQWdmVnh1SUNCOVhHNGdJR2xtSUNnaGMyVnNMbkpoYm1kbFEyOTFiblFwSUh0Y2JpQWdJQ0IxY0dSaGRHVkZiWEIwZVZObGJHVmpkR2x2YmloelpXd3BPMXh1SUNCOVhHNTlYRzVjYm1aMWJtTjBhVzl1SUhWd1pHRjBaVUZ1WTJodmNrRnVaRVp2WTNWelJuSnZiVkpoYm1kbElDaHpaV3dzSUhKaGJtZGxLU0I3WEc0Z0lIWmhjaUJoYm1Ob2IzSlFjbVZtYVhnZ1BTQW5jM1JoY25Rbk8xeHVJQ0IyWVhJZ1ptOWpkWE5RY21WbWFYZ2dQU0FuWlc1a0p6dGNiaUFnYzJWc0xtRnVZMmh2Y2s1dlpHVWdQU0J5WVc1blpWdGhibU5vYjNKUWNtVm1hWGdnS3lBblEyOXVkR0ZwYm1WeUoxMDdYRzRnSUhObGJDNWhibU5vYjNKUFptWnpaWFFnUFNCeVlXNW5aVnRoYm1Ob2IzSlFjbVZtYVhnZ0t5QW5UMlptYzJWMEoxMDdYRzRnSUhObGJDNW1iMk4xYzA1dlpHVWdQU0J5WVc1blpWdG1iMk4xYzFCeVpXWnBlQ0FySUNkRGIyNTBZV2x1WlhJblhUdGNiaUFnYzJWc0xtWnZZM1Z6VDJabWMyVjBJRDBnY21GdVoyVmJabTlqZFhOUWNtVm1hWGdnS3lBblQyWm1jMlYwSjEwN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUhWd1pHRjBaVVZ0Y0hSNVUyVnNaV04wYVc5dUlDaHpaV3dwSUh0Y2JpQWdjMlZzTG1GdVkyaHZjazV2WkdVZ1BTQnpaV3d1Wm05amRYTk9iMlJsSUQwZ2JuVnNiRHRjYmlBZ2MyVnNMbUZ1WTJodmNrOW1abk5sZENBOUlITmxiQzVtYjJOMWMwOW1abk5sZENBOUlEQTdYRzRnSUhObGJDNXlZVzVuWlVOdmRXNTBJRDBnTUR0Y2JpQWdjMlZzTG1selEyOXNiR0Z3YzJWa0lEMGdkSEoxWlR0Y2JpQWdjMlZzTGw5eVlXNW5aWE11YkdWdVozUm9JRDBnTUR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnY21GdVoyVkRiMjUwWVdsdWMxTnBibWRzWlVWc1pXMWxiblFnS0hKaGJtZGxUbTlrWlhNcElIdGNiaUFnYVdZZ0tDRnlZVzVuWlU1dlpHVnpMbXhsYm1kMGFDQjhmQ0J5WVc1blpVNXZaR1Z6V3pCZExtNXZaR1ZVZVhCbElDRTlQU0F4S1NCN1hHNGdJQ0FnY21WMGRYSnVJR1poYkhObE8xeHVJQ0I5WEc0Z0lHWnZjaUFvZG1GeUlHa2dQU0F4TENCc1pXNGdQU0J5WVc1blpVNXZaR1Z6TG14bGJtZDBhRHNnYVNBOElHeGxianNnS3l0cEtTQjdYRzRnSUNBZ2FXWWdLQ0ZwYzBGdVkyVnpkRzl5VDJZb2NtRnVaMlZPYjJSbGMxc3dYU3dnY21GdVoyVk9iMlJsYzF0cFhTa3BJSHRjYmlBZ0lDQWdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JpQWdJQ0I5WEc0Z0lIMWNiaUFnY21WMGRYSnVJSFJ5ZFdVN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdkbGRGTnBibWRzWlVWc1pXMWxiblJHY205dFVtRnVaMlVnS0hKaGJtZGxLU0I3WEc0Z0lIWmhjaUJ1YjJSbGN5QTlJSEpoYm1kbExtZGxkRTV2WkdWektDazdYRzRnSUdsbUlDZ2hjbUZ1WjJWRGIyNTBZV2x1YzFOcGJtZHNaVVZzWlcxbGJuUW9ibTlrWlhNcEtTQjdYRzRnSUNBZ2RHaHliM2NnYm1WM0lFVnljbTl5S0NkblpYUlRhVzVuYkdWRmJHVnRaVzUwUm5KdmJWSmhibWRsS0NrNklISmhibWRsSUdScFpDQnViM1FnWTI5dWMybHpkQ0J2WmlCaElITnBibWRzWlNCbGJHVnRaVzUwSnlrN1hHNGdJSDFjYmlBZ2NtVjBkWEp1SUc1dlpHVnpXekJkTzF4dWZWeHVYRzVtZFc1amRHbHZiaUJwYzFSbGVIUlNZVzVuWlNBb2NtRnVaMlVwSUh0Y2JpQWdjbVYwZFhKdUlISmhibWRsSUNZbUlISmhibWRsTG5SbGVIUWdJVDA5SUhadmFXUWdNRHRjYm4xY2JseHVablZ1WTNScGIyNGdkWEJrWVhSbFJuSnZiVlJsZUhSU1lXNW5aU0FvYzJWc0xDQnlZVzVuWlNrZ2UxeHVJQ0J6Wld3dVgzSmhibWRsY3lBOUlGdHlZVzVuWlYwN1hHNGdJSFZ3WkdGMFpVRnVZMmh2Y2tGdVpFWnZZM1Z6Um5KdmJWSmhibWRsS0hObGJDd2djbUZ1WjJVc0lHWmhiSE5sS1R0Y2JpQWdjMlZzTG5KaGJtZGxRMjkxYm5RZ1BTQXhPMXh1SUNCelpXd3VhWE5EYjJ4c1lYQnpaV1FnUFNCeVlXNW5aUzVqYjJ4c1lYQnpaV1E3WEc1OVhHNWNibVoxYm1OMGFXOXVJSFZ3WkdGMFpVTnZiblJ5YjJ4VFpXeGxZM1JwYjI0Z0tITmxiQ2tnZTF4dUlDQnpaV3d1WDNKaGJtZGxjeTVzWlc1bmRHZ2dQU0F3TzF4dUlDQnBaaUFvYzJWc0xsOXpaV3hsWTNScGIyNHVkSGx3WlNBOVBUMGdKMDV2Ym1VbktTQjdYRzRnSUNBZ2RYQmtZWFJsUlcxd2RIbFRaV3hsWTNScGIyNG9jMlZzS1R0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCMllYSWdZMjl1ZEhKdmJGSmhibWRsSUQwZ2MyVnNMbDl6Wld4bFkzUnBiMjR1WTNKbFlYUmxVbUZ1WjJVb0tUdGNiaUFnSUNCcFppQW9hWE5VWlhoMFVtRnVaMlVvWTI5dWRISnZiRkpoYm1kbEtTa2dlMXh1SUNBZ0lDQWdkWEJrWVhSbFJuSnZiVlJsZUhSU1lXNW5aU2h6Wld3c0lHTnZiblJ5YjJ4U1lXNW5aU2s3WEc0Z0lDQWdmU0JsYkhObElIdGNiaUFnSUNBZ0lITmxiQzV5WVc1blpVTnZkVzUwSUQwZ1kyOXVkSEp2YkZKaGJtZGxMbXhsYm1kMGFEdGNiaUFnSUNBZ0lIWmhjaUJ5WVc1blpUdGNiaUFnSUNBZ0lHWnZjaUFvZG1GeUlHa2dQU0F3T3lCcElEd2djMlZzTG5KaGJtZGxRMjkxYm5RN0lDc3JhU2tnZTF4dUlDQWdJQ0FnSUNCeVlXNW5aU0E5SUdSdll5NWpjbVZoZEdWU1lXNW5aU2dwTzF4dUlDQWdJQ0FnSUNCeVlXNW5aUzV6Wld4bFkzUk9iMlJsS0dOdmJuUnliMnhTWVc1blpTNXBkR1Z0S0drcEtUdGNiaUFnSUNBZ0lDQWdjMlZzTGw5eVlXNW5aWE11Y0hWemFDaHlZVzVuWlNrN1hHNGdJQ0FnSUNCOVhHNGdJQ0FnSUNCelpXd3VhWE5EYjJ4c1lYQnpaV1FnUFNCelpXd3VjbUZ1WjJWRGIzVnVkQ0E5UFQwZ01TQW1KaUJ6Wld3dVgzSmhibWRsYzFzd1hTNWpiMnhzWVhCelpXUTdYRzRnSUNBZ0lDQjFjR1JoZEdWQmJtTm9iM0pCYm1SR2IyTjFjMFp5YjIxU1lXNW5aU2h6Wld3c0lITmxiQzVmY21GdVoyVnpXM05sYkM1eVlXNW5aVU52ZFc1MElDMGdNVjBzSUdaaGJITmxLVHRjYmlBZ0lDQjlYRzRnSUgxY2JuMWNibHh1Wm5WdVkzUnBiMjRnWVdSa1VtRnVaMlZVYjBOdmJuUnliMnhUWld4bFkzUnBiMjRnS0hObGJDd2djbUZ1WjJVcElIdGNiaUFnZG1GeUlHTnZiblJ5YjJ4U1lXNW5aU0E5SUhObGJDNWZjMlZzWldOMGFXOXVMbU55WldGMFpWSmhibWRsS0NrN1hHNGdJSFpoY2lCeVlXNW5aVVZzWlcxbGJuUWdQU0JuWlhSVGFXNW5iR1ZGYkdWdFpXNTBSbkp2YlZKaGJtZGxLSEpoYm1kbEtUdGNiaUFnZG1GeUlHNWxkME52Ym5SeWIyeFNZVzVuWlNBOUlHSnZaSGt1WTNKbFlYUmxRMjl1ZEhKdmJGSmhibWRsS0NrN1hHNGdJR1p2Y2lBb2RtRnlJR2tnUFNBd0xDQnNaVzRnUFNCamIyNTBjbTlzVW1GdVoyVXViR1Z1WjNSb095QnBJRHdnYkdWdU95QXJLMmtwSUh0Y2JpQWdJQ0J1WlhkRGIyNTBjbTlzVW1GdVoyVXVZV1JrS0dOdmJuUnliMnhTWVc1blpTNXBkR1Z0S0drcEtUdGNiaUFnZlZ4dUlDQjBjbmtnZTF4dUlDQWdJRzVsZDBOdmJuUnliMnhTWVc1blpTNWhaR1FvY21GdVoyVkZiR1Z0Wlc1MEtUdGNiaUFnZlNCallYUmphQ0FvWlNrZ2UxeHVJQ0FnSUhSb2NtOTNJRzVsZHlCRmNuSnZjaWduWVdSa1VtRnVaMlVvS1RvZ1JXeGxiV1Z1ZENCamIzVnNaQ0J1YjNRZ1ltVWdZV1JrWldRZ2RHOGdZMjl1ZEhKdmJDQnpaV3hsWTNScGIyNG5LVHRjYmlBZ2ZWeHVJQ0J1WlhkRGIyNTBjbTlzVW1GdVoyVXVjMlZzWldOMEtDazdYRzRnSUhWd1pHRjBaVU52Ym5SeWIyeFRaV3hsWTNScGIyNG9jMlZzS1R0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnYVhOVFlXMWxVbUZ1WjJVZ0tHeGxablFzSUhKcFoyaDBLU0I3WEc0Z0lISmxkSFZ5YmlBb1hHNGdJQ0FnYkdWbWRDNXpkR0Z5ZEVOdmJuUmhhVzVsY2lBOVBUMGdjbWxuYUhRdWMzUmhjblJEYjI1MFlXbHVaWElnSmlaY2JpQWdJQ0JzWldaMExuTjBZWEowVDJabWMyVjBJRDA5UFNCeWFXZG9kQzV6ZEdGeWRFOW1abk5sZENBbUpseHVJQ0FnSUd4bFpuUXVaVzVrUTI5dWRHRnBibVZ5SUQwOVBTQnlhV2RvZEM1bGJtUkRiMjUwWVdsdVpYSWdKaVpjYmlBZ0lDQnNaV1owTG1WdVpFOW1abk5sZENBOVBUMGdjbWxuYUhRdVpXNWtUMlptYzJWMFhHNGdJQ2s3WEc1OVhHNWNibVoxYm1OMGFXOXVJR2x6UVc1alpYTjBiM0pQWmlBb1lXNWpaWE4wYjNJc0lHUmxjMk5sYm1SaGJuUXBJSHRjYmlBZ2RtRnlJRzV2WkdVZ1BTQmtaWE5qWlc1a1lXNTBPMXh1SUNCM2FHbHNaU0FvYm05a1pTNXdZWEpsYm5ST2IyUmxLU0I3WEc0Z0lDQWdhV1lnS0c1dlpHVXVjR0Z5Wlc1MFRtOWtaU0E5UFQwZ1lXNWpaWE4wYjNJcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCMGNuVmxPMXh1SUNBZ0lIMWNiaUFnSUNCdWIyUmxJRDBnYm05a1pTNXdZWEpsYm5ST2IyUmxPMXh1SUNCOVhHNGdJSEpsZEhWeWJpQm1ZV3h6WlR0Y2JuMWNibHh1Wm5WdVkzUnBiMjRnWjJWMFUyVnNaV04wYVc5dUlDZ3BJSHRjYmlBZ2NtVjBkWEp1SUc1bGR5QkhaWFJUWld4bFkzUnBiMjRvWjJ4dlltRnNMbVJ2WTNWdFpXNTBMbk5sYkdWamRHbHZiaWs3WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdaMlYwVTJWc1pXTjBhVzl1TzF4dUlsMTkiLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGlzSG9zdE1ldGhvZCAoaG9zdCwgcHJvcCkge1xuICB2YXIgdHlwZSA9IHR5cGVvZiBob3N0W3Byb3BdO1xuICByZXR1cm4gdHlwZSA9PT0gJ2Z1bmN0aW9uJyB8fCAhISh0eXBlID09PSAnb2JqZWN0JyAmJiBob3N0W3Byb3BdKSB8fCB0eXBlID09PSAndW5rbm93bic7XG59XG5cbmZ1bmN0aW9uIGlzSG9zdFByb3BlcnR5IChob3N0LCBwcm9wKSB7XG4gIHJldHVybiB0eXBlb2YgaG9zdFtwcm9wXSAhPT0gJ3VuZGVmaW5lZCc7XG59XG5cbmZ1bmN0aW9uIG1hbnkgKGZuKSB7XG4gIHJldHVybiBmdW5jdGlvbiBhcmVIb3N0ZWQgKGhvc3QsIHByb3BzKSB7XG4gICAgdmFyIGkgPSBwcm9wcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgaWYgKCFmbihob3N0LCBwcm9wc1tpXSkpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdHJ1ZTtcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ldGhvZDogaXNIb3N0TWV0aG9kLFxuICBtZXRob2RzOiBtYW55KGlzSG9zdE1ldGhvZCksXG4gIHByb3BlcnR5OiBpc0hvc3RQcm9wZXJ0eSxcbiAgcHJvcGVydGllczogbWFueShpc0hvc3RQcm9wZXJ0eSlcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkb2MgPSBkb2N1bWVudDtcblxuZnVuY3Rpb24gaG9tZWJyZXdRU0EgKGNsYXNzTmFtZSkge1xuICB2YXIgcmVzdWx0cyA9IFtdO1xuICB2YXIgYWxsID0gZG9jLmdldEVsZW1lbnRzQnlUYWdOYW1lKCcqJyk7XG4gIHZhciBpO1xuICBmb3IgKGkgaW4gYWxsKSB7XG4gICAgaWYgKHdyYXAoYWxsW2ldLmNsYXNzTmFtZSkuaW5kZXhPZih3cmFwKGNsYXNzTmFtZSkpICE9PSAtMSkge1xuICAgICAgcmVzdWx0cy5wdXNoKGFsbFtpXSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXN1bHRzO1xufVxuXG5mdW5jdGlvbiB3cmFwICh0ZXh0KSB7XG4gIHJldHVybiAnICcgKyB0ZXh0ICsgJyAnO1xufVxuXG5mdW5jdGlvbiBjbG9zZVByb21wdHMgKCkge1xuICBpZiAoZG9jLmJvZHkucXVlcnlTZWxlY3RvckFsbCkge1xuICAgIHJlbW92ZShkb2MuYm9keS5xdWVyeVNlbGVjdG9yQWxsKCcud2stcHJvbXB0JykpO1xuICB9IGVsc2Uge1xuICAgIHJlbW92ZShob21lYnJld1FTQSgnd2stcHJvbXB0JykpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlbW92ZSAocHJvbXB0cykge1xuICB2YXIgbGVuID0gcHJvbXB0cy5sZW5ndGg7XG4gIHZhciBpO1xuICBmb3IgKGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICBwcm9tcHRzW2ldLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQocHJvbXB0c1tpXSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBjbG9zZVByb21wdHM7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBjcm9zc3ZlbnQgPSByZXF1aXJlKCdjcm9zc3ZlbnQnKTtcbnZhciByZW5kZXIgPSByZXF1aXJlKCcuL3JlbmRlcicpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuLi9jbGFzc2VzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBFTlRFUl9LRVkgPSAxMztcbnZhciBFU0NBUEVfS0VZID0gMjc7XG52YXIgZHJhZ0NsYXNzID0gJ3drLXByb21wdC11cGxvYWQtZHJhZ2dpbmcnO1xuXG5mdW5jdGlvbiBva29wICgpIHtcbiAgcmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIGNsYXNzaWZ5IChncm91cCwgY2xhc3Nlcykge1xuICBPYmplY3Qua2V5cyhncm91cCkuZm9yRWFjaChjdXN0b21pemUpO1xuICBmdW5jdGlvbiBjdXN0b21pemUgKGtleSkge1xuICAgIGlmIChjbGFzc2VzW2tleV0pIHtcbiAgICAgIGdyb3VwW2tleV0uY2xhc3NOYW1lICs9ICcgJyArIGNsYXNzZXNba2V5XTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvbXB0IChvcHRpb25zLCBkb25lKSB7XG4gIHZhciB0ZXh0ID0gc3RyaW5ncy5wcm9tcHRzW29wdGlvbnMudHlwZV07XG4gIHZhciBkb20gPSByZW5kZXIoe1xuICAgIGlkOiAnd2stcHJvbXB0LScgKyBvcHRpb25zLnR5cGUsXG4gICAgdGl0bGU6IHRleHQudGl0bGUsXG4gICAgZGVzY3JpcHRpb246IHRleHQuZGVzY3JpcHRpb24sXG4gICAgcGxhY2Vob2xkZXI6IHRleHQucGxhY2Vob2xkZXJcbiAgfSk7XG4gIHZhciBkb211cDtcblxuICBjcm9zc3ZlbnQuYWRkKGRvbS5jYW5jZWwsICdjbGljaycsIHJlbW92ZSk7XG4gIGNyb3NzdmVudC5hZGQoZG9tLmNsb3NlLCAnY2xpY2snLCByZW1vdmUpO1xuICBjcm9zc3ZlbnQuYWRkKGRvbS5vaywgJ2NsaWNrJywgb2spO1xuICBjcm9zc3ZlbnQuYWRkKGRvbS5pbnB1dCwgJ2tleXByZXNzJywgZW50ZXIpO1xuICBjcm9zc3ZlbnQuYWRkKGRvbS5kaWFsb2csICdrZXlkb3duJywgZXNjKTtcbiAgY2xhc3NpZnkoZG9tLCBvcHRpb25zLmNsYXNzZXMucHJvbXB0cyk7XG5cbiAgdmFyIHhociA9IG9wdGlvbnMueGhyO1xuICB2YXIgdXBsb2FkID0gb3B0aW9ucy51cGxvYWQ7XG4gIGlmICh0eXBlb2YgdXBsb2FkID09PSAnc3RyaW5nJykge1xuICAgIHVwbG9hZCA9IHsgdXJsOiB1cGxvYWQgfTtcbiAgfVxuICBpZiAodXBsb2FkKSB7XG4gICAgYXJyYW5nZVVwbG9hZHMoZG9tLCBkb25lKTtcbiAgfVxuXG4gIHNldFRpbWVvdXQoZm9jdXNEaWFsb2csIDApO1xuXG4gIGZ1bmN0aW9uIGZvY3VzRGlhbG9nICgpIHtcbiAgICBkb20uaW5wdXQuZm9jdXMoKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGVudGVyIChlKSB7XG4gICAgdmFyIGtleSA9IGUud2hpY2ggfHwgZS5rZXlDb2RlO1xuICAgIGlmIChrZXkgPT09IEVOVEVSX0tFWSkge1xuICAgICAgb2soKTtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBlc2MgKGUpIHtcbiAgICB2YXIga2V5ID0gZS53aGljaCB8fCBlLmtleUNvZGU7XG4gICAgaWYgKGtleSA9PT0gRVNDQVBFX0tFWSkge1xuICAgICAgcmVtb3ZlKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gb2sgKCkge1xuICAgIHJlbW92ZSgpO1xuICAgIGRvbmUoeyBkZWZpbml0aW9uOiBkb20uaW5wdXQudmFsdWUgfSk7XG4gIH1cblxuICBmdW5jdGlvbiByZW1vdmUgKCkge1xuICAgIGlmICh1cGxvYWQpIHsgYmluZFVwbG9hZEV2ZW50cyh0cnVlKTsgfVxuICAgIGRvbS5kaWFsb2cucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChkb20uZGlhbG9nKTtcbiAgICBvcHRpb25zLnN1cmZhY2UuZm9jdXMob3B0aW9ucy5tb2RlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJpbmRVcGxvYWRFdmVudHMgKHJlbW92ZSkge1xuICAgIHZhciBvcCA9IHJlbW92ZSA/ICdyZW1vdmUnIDogJ2FkZCc7XG4gICAgY3Jvc3N2ZW50W29wXShkb2N1bWVudC5ib2R5LCAnZHJhZ2VudGVyJywgZHJhZ2dpbmcpO1xuICAgIGNyb3NzdmVudFtvcF0oZG9jdW1lbnQuYm9keSwgJ2RyYWdlbmQnLCBkcmFnc3RvcCk7XG4gIH1cblxuICBmdW5jdGlvbiB3YXJuICgpIHtcbiAgICBjbGFzc2VzLmFkZChkb211cC53YXJuaW5nLCAnd2stcHJvbXB0LWVycm9yLXNob3cnKTtcbiAgfVxuICBmdW5jdGlvbiBkcmFnZ2luZyAoKSB7XG4gICAgY2xhc3Nlcy5hZGQoZG9tdXAuYXJlYSwgZHJhZ0NsYXNzKTtcbiAgfVxuICBmdW5jdGlvbiBkcmFnc3RvcCAoKSB7XG4gICAgY2xhc3Nlcy5ybShkb211cC5hcmVhLCBkcmFnQ2xhc3MpO1xuICB9XG5cbiAgZnVuY3Rpb24gYXJyYW5nZVVwbG9hZHMgKGRvbSwgZG9uZSkge1xuICAgIGRvbXVwID0gcmVuZGVyLnVwbG9hZHMoZG9tLCBzdHJpbmdzLnByb21wdHMudHlwZXMgKyAodXBsb2FkLnJlc3RyaWN0aW9uIHx8IG9wdGlvbnMudHlwZSArICdzJykpO1xuICAgIGJpbmRVcGxvYWRFdmVudHMoKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmZpbGVpbnB1dCwgJ2NoYW5nZScsIGhhbmRsZUNoYW5nZSwgZmFsc2UpO1xuICAgIGNyb3NzdmVudC5hZGQoZG9tdXAuYXJlYSwgJ2RyYWdvdmVyJywgaGFuZGxlRHJhZ092ZXIsIGZhbHNlKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmFyZWEsICdkcm9wJywgaGFuZGxlRmlsZVNlbGVjdCwgZmFsc2UpO1xuICAgIGNsYXNzaWZ5KGRvbXVwLCBvcHRpb25zLmNsYXNzZXMucHJvbXB0cyk7XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVDaGFuZ2UgKGUpIHtcbiAgICAgIHN0b3AoZSk7XG4gICAgICBzdWJtaXQoZG9tdXAuZmlsZWlucHV0LmZpbGVzKTtcbiAgICAgIGRvbXVwLmZpbGVpbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgZG9tdXAuZmlsZWlucHV0LnZhbHVlID0gbnVsbDtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBoYW5kbGVEcmFnT3ZlciAoZSkge1xuICAgICAgc3RvcChlKTtcbiAgICAgIGUuZGF0YVRyYW5zZmVyLmRyb3BFZmZlY3QgPSAnY29weSc7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaGFuZGxlRmlsZVNlbGVjdCAoZSkge1xuICAgICAgZHJhZ3N0b3AoKTtcbiAgICAgIHN0b3AoZSk7XG4gICAgICBzdWJtaXQoZS5kYXRhVHJhbnNmZXIuZmlsZXMpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHN0b3AgKGUpIHtcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gdmFsaWQgKGZpbGVzKSB7XG4gICAgICB2YXIgaTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuICAgICAgICBpZiAoKHVwbG9hZC52YWxpZGF0ZSB8fCBva29wKShmaWxlc1tpXSkpIHtcbiAgICAgICAgICByZXR1cm4gZmlsZXNbaV07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIHdhcm4oKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdWJtaXQgKGZpbGVzKSB7XG4gICAgICBjbGFzc2VzLnJtKGRvbXVwLmZhaWxlZCwgJ3drLXByb21wdC1lcnJvci1zaG93Jyk7XG4gICAgICBjbGFzc2VzLnJtKGRvbXVwLndhcm5pbmcsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgICAgdmFyIGZpbGUgPSB2YWxpZChmaWxlcyk7XG4gICAgICBpZiAoIWZpbGUpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIGZvcm0gPSBuZXcgRm9ybURhdGEoKTtcbiAgICAgIHZhciByZXEgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAnbXVsdGlwYXJ0L2Zvcm0tZGF0YScsXG4gICAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgICBBY2NlcHQ6ICdhcHBsaWNhdGlvbi9qc29uJ1xuICAgICAgICB9LFxuICAgICAgICBtZXRob2Q6IHVwbG9hZC5tZXRob2QgfHwgJ1BVVCcsXG4gICAgICAgIHVybDogdXBsb2FkLnVybCxcbiAgICAgICAgYm9keTogZm9ybVxuICAgICAgfTtcblxuICAgICAgZm9ybS5hcHBlbmQodXBsb2FkLmtleSB8fCAnd29vZm1hcmtfdXBsb2FkJywgZmlsZSwgZmlsZS5uYW1lKTtcbiAgICAgIGNsYXNzZXMuYWRkKGRvbXVwLmFyZWEsICd3ay1wcm9tcHQtdXBsb2FkaW5nJyk7XG4gICAgICB4aHIocmVxLCBoYW5kbGVSZXNwb25zZSk7XG5cbiAgICAgIGZ1bmN0aW9uIGhhbmRsZVJlc3BvbnNlIChlcnIsIHJlcywgYm9keSkge1xuICAgICAgICBjbGFzc2VzLnJtKGRvbXVwLmFyZWEsICd3ay1wcm9tcHQtdXBsb2FkaW5nJyk7XG4gICAgICAgIGlmIChlcnIgfHwgcmVzLnN0YXR1c0NvZGUgPCAyMDAgfHwgcmVzLnN0YXR1c0NvZGUgPiAyOTkpIHtcbiAgICAgICAgICBjbGFzc2VzLmFkZChkb211cC5mYWlsZWQsICd3ay1wcm9tcHQtZXJyb3Itc2hvdycpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBkb20uaW5wdXQudmFsdWUgPSBib2R5LmhyZWYgKyAnIFwiJyArIGJvZHkudGl0bGUgKyAnXCInO1xuICAgICAgICByZW1vdmUoKTtcbiAgICAgICAgZG9uZSh7IGRlZmluaXRpb246IGRvbS5pbnB1dC52YWx1ZSwgYXR0YWNobWVudDogb3B0aW9ucy50eXBlID09PSAnYXR0YWNobWVudCcgfSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcHJvbXB0O1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIgZ2V0VGV4dCA9IHJlcXVpcmUoJy4uL2dldFRleHQnKTtcbnZhciBzZXRUZXh0ID0gcmVxdWlyZSgnLi4vc2V0VGV4dCcpO1xudmFyIGNsYXNzZXMgPSByZXF1aXJlKCcuLi9jbGFzc2VzJyk7XG52YXIgc3RyaW5ncyA9IHJlcXVpcmUoJy4uL3N0cmluZ3MnKTtcbnZhciBhYyA9ICdhcHBlbmRDaGlsZCc7XG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xuXG5mdW5jdGlvbiBlICh0eXBlLCBjbHMsIHRleHQpIHtcbiAgdmFyIGVsID0gZG9jLmNyZWF0ZUVsZW1lbnQodHlwZSk7XG4gIGVsLmNsYXNzTmFtZSA9IGNscztcbiAgaWYgKHRleHQpIHtcbiAgICBzZXRUZXh0KGVsLCB0ZXh0KTtcbiAgfVxuICByZXR1cm4gZWw7XG59XG5cbmZ1bmN0aW9uIHJlbmRlciAob3B0aW9ucykge1xuICB2YXIgZG9tID0ge1xuICAgIGRpYWxvZzogZSgnYXJ0aWNsZScsICd3ay1wcm9tcHQgJyArIG9wdGlvbnMuaWQpLFxuICAgIGNsb3NlOiBlKCdhJywgJ3drLXByb21wdC1jbG9zZScpLFxuICAgIGhlYWRlcjogZSgnaGVhZGVyJywgJ3drLXByb21wdC1oZWFkZXInKSxcbiAgICBoMTogZSgnaDEnLCAnd2stcHJvbXB0LXRpdGxlJywgb3B0aW9ucy50aXRsZSksXG4gICAgc2VjdGlvbjogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtYm9keScpLFxuICAgIGRlc2M6IGUoJ3AnLCAnd2stcHJvbXB0LWRlc2NyaXB0aW9uJywgb3B0aW9ucy5kZXNjcmlwdGlvbiksXG4gICAgaW5wdXRDb250YWluZXI6IGUoJ2RpdicsICd3ay1wcm9tcHQtaW5wdXQtY29udGFpbmVyJyksXG4gICAgaW5wdXQ6IGUoJ2lucHV0JywgJ3drLXByb21wdC1pbnB1dCcpLFxuICAgIGNhbmNlbDogZSgnYnV0dG9uJywgJ3drLXByb21wdC1jYW5jZWwnLCAnQ2FuY2VsJyksXG4gICAgb2s6IGUoJ2J1dHRvbicsICd3ay1wcm9tcHQtb2snLCAnT2snKSxcbiAgICBmb290ZXI6IGUoJ2Zvb3RlcicsICd3ay1wcm9tcHQtYnV0dG9ucycpXG4gIH07XG4gIGRvbS5vay50eXBlID0gJ2J1dHRvbic7XG4gIGRvbS5oZWFkZXJbYWNdKGRvbS5oMSk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uZGVzYyk7XG4gIGRvbS5zZWN0aW9uW2FjXShkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uaW5wdXRDb250YWluZXJbYWNdKGRvbS5pbnB1dCk7XG4gIGRvbS5pbnB1dC5wbGFjZWhvbGRlciA9IG9wdGlvbnMucGxhY2Vob2xkZXI7XG4gIGRvbS5jYW5jZWwudHlwZSA9ICdidXR0b24nO1xuICBkb20uZm9vdGVyW2FjXShkb20uY2FuY2VsKTtcbiAgZG9tLmZvb3RlclthY10oZG9tLm9rKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmNsb3NlKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmhlYWRlcik7XG4gIGRvbS5kaWFsb2dbYWNdKGRvbS5zZWN0aW9uKTtcbiAgZG9tLmRpYWxvZ1thY10oZG9tLmZvb3Rlcik7XG4gIGRvYy5ib2R5W2FjXShkb20uZGlhbG9nKTtcbiAgcmV0dXJuIGRvbTtcbn1cblxuZnVuY3Rpb24gdXBsb2FkcyAoZG9tLCB3YXJuaW5nKSB7XG4gIHZhciBmdXAgPSAnd2stcHJvbXB0LWZpbGV1cGxvYWQnO1xuICB2YXIgZG9tdXAgPSB7XG4gICAgYXJlYTogZSgnc2VjdGlvbicsICd3ay1wcm9tcHQtdXBsb2FkLWFyZWEnKSxcbiAgICB3YXJuaW5nOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay13YXJuaW5nJywgd2FybmluZyksXG4gICAgZmFpbGVkOiBlKCdwJywgJ3drLXByb21wdC1lcnJvciB3ay1mYWlsZWQnLCBzdHJpbmdzLnByb21wdHMudXBsb2FkZmFpbGVkKSxcbiAgICB1cGxvYWQ6IGUoJ2xhYmVsJywgJ3drLXByb21wdC11cGxvYWQnKSxcbiAgICB1cGxvYWRpbmc6IGUoJ3NwYW4nLCAnd2stcHJvbXB0LXByb2dyZXNzJywgc3RyaW5ncy5wcm9tcHRzLnVwbG9hZGluZyksXG4gICAgZHJvcDogZSgnc3BhbicsICd3ay1wcm9tcHQtZHJvcCcsIHN0cmluZ3MucHJvbXB0cy5kcm9wKSxcbiAgICBkcm9waWNvbjogZSgncCcsICd3ay1wcm9tcHQtZHJvcC1pY29uJyksXG4gICAgYnJvd3NlOiBlKCdzcGFuJywgJ3drLXByb21wdC1icm93c2UnLCBzdHJpbmdzLnByb21wdHMuYnJvd3NlKSxcbiAgICBkcmFnZHJvcDogZSgncCcsICd3ay1wcm9tcHQtZHJhZ2Ryb3AnLCBzdHJpbmdzLnByb21wdHMuZHJvcGhpbnQpLFxuICAgIGZpbGVpbnB1dDogZSgnaW5wdXQnLCBmdXApXG4gIH07XG4gIGRvbXVwLmFyZWFbYWNdKGRvbXVwLmRyb3ApO1xuICBkb211cC5hcmVhW2FjXShkb211cC51cGxvYWRpbmcpO1xuICBkb211cC5hcmVhW2FjXShkb211cC5kcm9waWNvbik7XG4gIGRvbXVwLnVwbG9hZFthY10oZG9tdXAuYnJvd3NlKTtcbiAgZG9tdXAudXBsb2FkW2FjXShkb211cC5maWxlaW5wdXQpO1xuICBkb211cC5maWxlaW5wdXQuaWQgPSBmdXA7XG4gIGRvbXVwLmZpbGVpbnB1dC50eXBlID0gJ2ZpbGUnO1xuICBkb20uZGlhbG9nLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC11cGxvYWRzJztcbiAgZG9tLmlucHV0Q29udGFpbmVyLmNsYXNzTmFtZSArPSAnIHdrLXByb21wdC1pbnB1dC1jb250YWluZXItdXBsb2Fkcyc7XG4gIGRvbS5pbnB1dC5jbGFzc05hbWUgKz0gJyB3ay1wcm9tcHQtaW5wdXQtdXBsb2Fkcyc7XG4gIGRvbS5zZWN0aW9uLmluc2VydEJlZm9yZShkb211cC53YXJuaW5nLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvbi5pbnNlcnRCZWZvcmUoZG9tdXAuZmFpbGVkLCBkb20uaW5wdXRDb250YWluZXIpO1xuICBkb20uc2VjdGlvblthY10oZG9tdXAudXBsb2FkKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmRyYWdkcm9wKTtcbiAgZG9tLnNlY3Rpb25bYWNdKGRvbXVwLmFyZWEpO1xuICBzZXRUZXh0KGRvbS5kZXNjLCBnZXRUZXh0KGRvbS5kZXNjKSArIHN0cmluZ3MucHJvbXB0cy51cGxvYWQpO1xuICBjcm9zc3ZlbnQuYWRkKGRvbXVwLmZpbGVpbnB1dCwgJ2ZvY3VzJywgZm9jdXNlZEZpbGVJbnB1dCk7XG4gIGNyb3NzdmVudC5hZGQoZG9tdXAuZmlsZWlucHV0LCAnYmx1cicsIGJsdXJyZWRGaWxlSW5wdXQpO1xuXG4gIGZ1bmN0aW9uIGZvY3VzZWRGaWxlSW5wdXQgKCkge1xuICAgIGNsYXNzZXMuYWRkKGRvbXVwLnVwbG9hZCwgJ3drLWZvY3VzZWQnKTtcbiAgfVxuICBmdW5jdGlvbiBibHVycmVkRmlsZUlucHV0ICgpIHtcbiAgICBjbGFzc2VzLnJtKGRvbXVwLnVwbG9hZCwgJ3drLWZvY3VzZWQnKTtcbiAgfVxuICByZXR1cm4gZG9tdXA7XG59XG5cbnJlbmRlci51cGxvYWRzID0gdXBsb2Fkcztcbm1vZHVsZS5leHBvcnRzID0gcmVuZGVyO1xuXG59KS5jYWxsKHRoaXMsdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbCA6IHR5cGVvZiBzZWxmICE9PSBcInVuZGVmaW5lZFwiID8gc2VsZiA6IHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3cgOiB7fSlcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0OnV0Zi04O2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKemIzVnlZMlZ6SWpwYkluTnlZeTl3Y205dGNIUnpMM0psYm1SbGNpNXFjeUpkTENKdVlXMWxjeUk2VzEwc0ltMWhjSEJwYm1keklqb2lPMEZCUVVFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFTSXNJbVpwYkdVaU9pSm5aVzVsY21GMFpXUXVhbk1pTENKemIzVnlZMlZTYjI5MElqb2lJaXdpYzI5MWNtTmxjME52Ym5SbGJuUWlPbHNpSjNWelpTQnpkSEpwWTNRbk8xeHVYRzUyWVhJZ1kzSnZjM04yWlc1MElEMGdjbVZ4ZFdseVpTZ25ZM0p2YzNOMlpXNTBKeWs3WEc1MllYSWdaMlYwVkdWNGRDQTlJSEpsY1hWcGNtVW9KeTR1TDJkbGRGUmxlSFFuS1R0Y2JuWmhjaUJ6WlhSVVpYaDBJRDBnY21WeGRXbHlaU2duTGk0dmMyVjBWR1Y0ZENjcE8xeHVkbUZ5SUdOc1lYTnpaWE1nUFNCeVpYRjFhWEpsS0NjdUxpOWpiR0Z6YzJWekp5azdYRzUyWVhJZ2MzUnlhVzVuY3lBOUlISmxjWFZwY21Vb0p5NHVMM04wY21sdVozTW5LVHRjYm5aaGNpQmhZeUE5SUNkaGNIQmxibVJEYUdsc1pDYzdYRzUyWVhJZ1pHOWpJRDBnWjJ4dlltRnNMbVJ2WTNWdFpXNTBPMXh1WEc1bWRXNWpkR2x2YmlCbElDaDBlWEJsTENCamJITXNJSFJsZUhRcElIdGNiaUFnZG1GeUlHVnNJRDBnWkc5akxtTnlaV0YwWlVWc1pXMWxiblFvZEhsd1pTazdYRzRnSUdWc0xtTnNZWE56VG1GdFpTQTlJR05zY3p0Y2JpQWdhV1lnS0hSbGVIUXBJSHRjYmlBZ0lDQnpaWFJVWlhoMEtHVnNMQ0IwWlhoMEtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z1pXdzdYRzU5WEc1Y2JtWjFibU4wYVc5dUlISmxibVJsY2lBb2IzQjBhVzl1Y3lrZ2UxeHVJQ0IyWVhJZ1pHOXRJRDBnZTF4dUlDQWdJR1JwWVd4dlp6b2daU2duWVhKMGFXTnNaU2NzSUNkM2F5MXdjbTl0Y0hRZ0p5QXJJRzl3ZEdsdmJuTXVhV1FwTEZ4dUlDQWdJR05zYjNObE9pQmxLQ2RoSnl3Z0ozZHJMWEJ5YjIxd2RDMWpiRzl6WlNjcExGeHVJQ0FnSUdobFlXUmxjam9nWlNnbmFHVmhaR1Z5Snl3Z0ozZHJMWEJ5YjIxd2RDMW9aV0ZrWlhJbktTeGNiaUFnSUNCb01Ub2daU2duYURFbkxDQW5kMnN0Y0hKdmJYQjBMWFJwZEd4bEp5d2diM0IwYVc5dWN5NTBhWFJzWlNrc1hHNGdJQ0FnYzJWamRHbHZiam9nWlNnbmMyVmpkR2x2Ymljc0lDZDNheTF3Y205dGNIUXRZbTlrZVNjcExGeHVJQ0FnSUdSbGMyTTZJR1VvSjNBbkxDQW5kMnN0Y0hKdmJYQjBMV1JsYzJOeWFYQjBhVzl1Snl3Z2IzQjBhVzl1Y3k1a1pYTmpjbWx3ZEdsdmJpa3NYRzRnSUNBZ2FXNXdkWFJEYjI1MFlXbHVaWEk2SUdVb0oyUnBkaWNzSUNkM2F5MXdjbTl0Y0hRdGFXNXdkWFF0WTI5dWRHRnBibVZ5Snlrc1hHNGdJQ0FnYVc1d2RYUTZJR1VvSjJsdWNIVjBKeXdnSjNkckxYQnliMjF3ZEMxcGJuQjFkQ2NwTEZ4dUlDQWdJR05oYm1ObGJEb2daU2duWW5WMGRHOXVKeXdnSjNkckxYQnliMjF3ZEMxallXNWpaV3duTENBblEyRnVZMlZzSnlrc1hHNGdJQ0FnYjJzNklHVW9KMkoxZEhSdmJpY3NJQ2QzYXkxd2NtOXRjSFF0YjJzbkxDQW5UMnNuS1N4Y2JpQWdJQ0JtYjI5MFpYSTZJR1VvSjJadmIzUmxjaWNzSUNkM2F5MXdjbTl0Y0hRdFluVjBkRzl1Y3ljcFhHNGdJSDA3WEc0Z0lHUnZiUzV2YXk1MGVYQmxJRDBnSjJKMWRIUnZiaWM3WEc0Z0lHUnZiUzVvWldGa1pYSmJZV05kS0dSdmJTNW9NU2s3WEc0Z0lHUnZiUzV6WldOMGFXOXVXMkZqWFNoa2IyMHVaR1Z6WXlrN1hHNGdJR1J2YlM1elpXTjBhVzl1VzJGalhTaGtiMjB1YVc1d2RYUkRiMjUwWVdsdVpYSXBPMXh1SUNCa2IyMHVhVzV3ZFhSRGIyNTBZV2x1WlhKYllXTmRLR1J2YlM1cGJuQjFkQ2s3WEc0Z0lHUnZiUzVwYm5CMWRDNXdiR0ZqWldodmJHUmxjaUE5SUc5d2RHbHZibk11Y0d4aFkyVm9iMnhrWlhJN1hHNGdJR1J2YlM1allXNWpaV3d1ZEhsd1pTQTlJQ2RpZFhSMGIyNG5PMXh1SUNCa2IyMHVabTl2ZEdWeVcyRmpYU2hrYjIwdVkyRnVZMlZzS1R0Y2JpQWdaRzl0TG1admIzUmxjbHRoWTEwb1pHOXRMbTlyS1R0Y2JpQWdaRzl0TG1ScFlXeHZaMXRoWTEwb1pHOXRMbU5zYjNObEtUdGNiaUFnWkc5dExtUnBZV3h2WjF0aFkxMG9aRzl0TG1obFlXUmxjaWs3WEc0Z0lHUnZiUzVrYVdGc2IyZGJZV05kS0dSdmJTNXpaV04wYVc5dUtUdGNiaUFnWkc5dExtUnBZV3h2WjF0aFkxMG9aRzl0TG1admIzUmxjaWs3WEc0Z0lHUnZZeTVpYjJSNVcyRmpYU2hrYjIwdVpHbGhiRzluS1R0Y2JpQWdjbVYwZFhKdUlHUnZiVHRjYm4xY2JseHVablZ1WTNScGIyNGdkWEJzYjJGa2N5QW9aRzl0TENCM1lYSnVhVzVuS1NCN1hHNGdJSFpoY2lCbWRYQWdQU0FuZDJzdGNISnZiWEIwTFdacGJHVjFjR3h2WVdRbk8xeHVJQ0IyWVhJZ1pHOXRkWEFnUFNCN1hHNGdJQ0FnWVhKbFlUb2daU2duYzJWamRHbHZiaWNzSUNkM2F5MXdjbTl0Y0hRdGRYQnNiMkZrTFdGeVpXRW5LU3hjYmlBZ0lDQjNZWEp1YVc1bk9pQmxLQ2R3Snl3Z0ozZHJMWEJ5YjIxd2RDMWxjbkp2Y2lCM2F5MTNZWEp1YVc1bkp5d2dkMkZ5Ym1sdVp5a3NYRzRnSUNBZ1ptRnBiR1ZrT2lCbEtDZHdKeXdnSjNkckxYQnliMjF3ZEMxbGNuSnZjaUIzYXkxbVlXbHNaV1FuTENCemRISnBibWR6TG5CeWIyMXdkSE11ZFhCc2IyRmtabUZwYkdWa0tTeGNiaUFnSUNCMWNHeHZZV1E2SUdVb0oyeGhZbVZzSnl3Z0ozZHJMWEJ5YjIxd2RDMTFjR3h2WVdRbktTeGNiaUFnSUNCMWNHeHZZV1JwYm1jNklHVW9KM053WVc0bkxDQW5kMnN0Y0hKdmJYQjBMWEJ5YjJkeVpYTnpKeXdnYzNSeWFXNW5jeTV3Y205dGNIUnpMblZ3Ykc5aFpHbHVaeWtzWEc0Z0lDQWdaSEp2Y0RvZ1pTZ25jM0JoYmljc0lDZDNheTF3Y205dGNIUXRaSEp2Y0Njc0lITjBjbWx1WjNNdWNISnZiWEIwY3k1a2NtOXdLU3hjYmlBZ0lDQmtjbTl3YVdOdmJqb2daU2duY0Njc0lDZDNheTF3Y205dGNIUXRaSEp2Y0MxcFkyOXVKeWtzWEc0Z0lDQWdZbkp2ZDNObE9pQmxLQ2R6Y0dGdUp5d2dKM2RyTFhCeWIyMXdkQzFpY205M2MyVW5MQ0J6ZEhKcGJtZHpMbkJ5YjIxd2RITXVZbkp2ZDNObEtTeGNiaUFnSUNCa2NtRm5aSEp2Y0RvZ1pTZ25jQ2NzSUNkM2F5MXdjbTl0Y0hRdFpISmhaMlJ5YjNBbkxDQnpkSEpwYm1kekxuQnliMjF3ZEhNdVpISnZjR2hwYm5RcExGeHVJQ0FnSUdacGJHVnBibkIxZERvZ1pTZ25hVzV3ZFhRbkxDQm1kWEFwWEc0Z0lIMDdYRzRnSUdSdmJYVndMbUZ5WldGYllXTmRLR1J2YlhWd0xtUnliM0FwTzF4dUlDQmtiMjExY0M1aGNtVmhXMkZqWFNoa2IyMTFjQzUxY0d4dllXUnBibWNwTzF4dUlDQmtiMjExY0M1aGNtVmhXMkZqWFNoa2IyMTFjQzVrY205d2FXTnZiaWs3WEc0Z0lHUnZiWFZ3TG5Wd2JHOWhaRnRoWTEwb1pHOXRkWEF1WW5KdmQzTmxLVHRjYmlBZ1pHOXRkWEF1ZFhCc2IyRmtXMkZqWFNoa2IyMTFjQzVtYVd4bGFXNXdkWFFwTzF4dUlDQmtiMjExY0M1bWFXeGxhVzV3ZFhRdWFXUWdQU0JtZFhBN1hHNGdJR1J2YlhWd0xtWnBiR1ZwYm5CMWRDNTBlWEJsSUQwZ0oyWnBiR1VuTzF4dUlDQmtiMjB1WkdsaGJHOW5MbU5zWVhOelRtRnRaU0FyUFNBbklIZHJMWEJ5YjIxd2RDMTFjR3h2WVdSekp6dGNiaUFnWkc5dExtbHVjSFYwUTI5dWRHRnBibVZ5TG1Oc1lYTnpUbUZ0WlNBclBTQW5JSGRyTFhCeWIyMXdkQzFwYm5CMWRDMWpiMjUwWVdsdVpYSXRkWEJzYjJGa2N5YzdYRzRnSUdSdmJTNXBibkIxZEM1amJHRnpjMDVoYldVZ0t6MGdKeUIzYXkxd2NtOXRjSFF0YVc1d2RYUXRkWEJzYjJGa2N5YzdYRzRnSUdSdmJTNXpaV04wYVc5dUxtbHVjMlZ5ZEVKbFptOXlaU2hrYjIxMWNDNTNZWEp1YVc1bkxDQmtiMjB1YVc1d2RYUkRiMjUwWVdsdVpYSXBPMXh1SUNCa2IyMHVjMlZqZEdsdmJpNXBibk5sY25SQ1pXWnZjbVVvWkc5dGRYQXVabUZwYkdWa0xDQmtiMjB1YVc1d2RYUkRiMjUwWVdsdVpYSXBPMXh1SUNCa2IyMHVjMlZqZEdsdmJsdGhZMTBvWkc5dGRYQXVkWEJzYjJGa0tUdGNiaUFnWkc5dExuTmxZM1JwYjI1YllXTmRLR1J2YlhWd0xtUnlZV2RrY205d0tUdGNiaUFnWkc5dExuTmxZM1JwYjI1YllXTmRLR1J2YlhWd0xtRnlaV0VwTzF4dUlDQnpaWFJVWlhoMEtHUnZiUzVrWlhOakxDQm5aWFJVWlhoMEtHUnZiUzVrWlhOaktTQXJJSE4wY21sdVozTXVjSEp2YlhCMGN5NTFjR3h2WVdRcE8xeHVJQ0JqY205emMzWmxiblF1WVdSa0tHUnZiWFZ3TG1acGJHVnBibkIxZEN3Z0oyWnZZM1Z6Snl3Z1ptOWpkWE5sWkVacGJHVkpibkIxZENrN1hHNGdJR055YjNOemRtVnVkQzVoWkdRb1pHOXRkWEF1Wm1sc1pXbHVjSFYwTENBbllteDFjaWNzSUdKc2RYSnlaV1JHYVd4bFNXNXdkWFFwTzF4dVhHNGdJR1oxYm1OMGFXOXVJR1p2WTNWelpXUkdhV3hsU1c1d2RYUWdLQ2tnZTF4dUlDQWdJR05zWVhOelpYTXVZV1JrS0dSdmJYVndMblZ3Ykc5aFpDd2dKM2RyTFdadlkzVnpaV1FuS1R0Y2JpQWdmVnh1SUNCbWRXNWpkR2x2YmlCaWJIVnljbVZrUm1sc1pVbHVjSFYwSUNncElIdGNiaUFnSUNCamJHRnpjMlZ6TG5KdEtHUnZiWFZ3TG5Wd2JHOWhaQ3dnSjNkckxXWnZZM1Z6WldRbktUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z1pHOXRkWEE3WEc1OVhHNWNibkpsYm1SbGNpNTFjR3h2WVdSeklEMGdkWEJzYjJGa2N6dGNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdjbVZ1WkdWeU8xeHVJbDE5IiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgZG9jID0gZ2xvYmFsLmRvY3VtZW50O1xudmFyIGJvZHkgPSBkb2MuYm9keTtcblxuZnVuY3Rpb24gcmFuZ2VUb1RleHRSYW5nZSAocmFuZ2UpIHtcbiAgaWYgKHJhbmdlLmNvbGxhcHNlZCkge1xuICAgIHJldHVybiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSh7IG5vZGU6IHJhbmdlLnN0YXJ0Q29udGFpbmVyLCBvZmZzZXQ6IHJhbmdlLnN0YXJ0T2Zmc2V0IH0sIHRydWUpO1xuICB9XG4gIHZhciBzdGFydFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiByYW5nZS5zdGFydENvbnRhaW5lciwgb2Zmc2V0OiByYW5nZS5zdGFydE9mZnNldCB9LCB0cnVlKTtcbiAgdmFyIGVuZFJhbmdlID0gY3JlYXRlQm91bmRhcnlUZXh0UmFuZ2UoeyBub2RlOiByYW5nZS5lbmRDb250YWluZXIsIG9mZnNldDogcmFuZ2UuZW5kT2Zmc2V0IH0sIGZhbHNlKTtcbiAgdmFyIHRleHRSYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnU3RhcnRUb1N0YXJ0Jywgc3RhcnRSYW5nZSk7XG4gIHRleHRSYW5nZS5zZXRFbmRQb2ludCgnRW5kVG9FbmQnLCBlbmRSYW5nZSk7XG4gIHJldHVybiB0ZXh0UmFuZ2U7XG59XG5cbmZ1bmN0aW9uIGlzQ2hhcmFjdGVyRGF0YU5vZGUgKG5vZGUpIHtcbiAgdmFyIHQgPSBub2RlLm5vZGVUeXBlO1xuICByZXR1cm4gdCA9PT0gMyB8fCB0ID09PSA0IHx8IHQgPT09IDggO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVCb3VuZGFyeVRleHRSYW5nZSAocCwgc3RhcnRpbmcpIHtcbiAgdmFyIGJvdW5kO1xuICB2YXIgcGFyZW50O1xuICB2YXIgb2Zmc2V0ID0gcC5vZmZzZXQ7XG4gIHZhciB3b3JraW5nTm9kZTtcbiAgdmFyIGNoaWxkTm9kZXM7XG4gIHZhciByYW5nZSA9IGJvZHkuY3JlYXRlVGV4dFJhbmdlKCk7XG4gIHZhciBkYXRhID0gaXNDaGFyYWN0ZXJEYXRhTm9kZShwLm5vZGUpO1xuXG4gIGlmIChkYXRhKSB7XG4gICAgYm91bmQgPSBwLm5vZGU7XG4gICAgcGFyZW50ID0gYm91bmQucGFyZW50Tm9kZTtcbiAgfSBlbHNlIHtcbiAgICBjaGlsZE5vZGVzID0gcC5ub2RlLmNoaWxkTm9kZXM7XG4gICAgYm91bmQgPSBvZmZzZXQgPCBjaGlsZE5vZGVzLmxlbmd0aCA/IGNoaWxkTm9kZXNbb2Zmc2V0XSA6IG51bGw7XG4gICAgcGFyZW50ID0gcC5ub2RlO1xuICB9XG5cbiAgd29ya2luZ05vZGUgPSBkb2MuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICB3b3JraW5nTm9kZS5pbm5lckhUTUwgPSAnJiNmZWZmOyc7XG5cbiAgaWYgKGJvdW5kKSB7XG4gICAgcGFyZW50Lmluc2VydEJlZm9yZSh3b3JraW5nTm9kZSwgYm91bmQpO1xuICB9IGVsc2Uge1xuICAgIHBhcmVudC5hcHBlbmRDaGlsZCh3b3JraW5nTm9kZSk7XG4gIH1cblxuICByYW5nZS5tb3ZlVG9FbGVtZW50VGV4dCh3b3JraW5nTm9kZSk7XG4gIHJhbmdlLmNvbGxhcHNlKCFzdGFydGluZyk7XG4gIHBhcmVudC5yZW1vdmVDaGlsZCh3b3JraW5nTm9kZSk7XG5cbiAgaWYgKGRhdGEpIHtcbiAgICByYW5nZVtzdGFydGluZyA/ICdtb3ZlU3RhcnQnIDogJ21vdmVFbmQnXSgnY2hhcmFjdGVyJywgb2Zmc2V0KTtcbiAgfVxuICByZXR1cm4gcmFuZ2U7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcmFuZ2VUb1RleHRSYW5nZTtcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5eVlXNW5aVlJ2VkdWNGRGSmhibWRsTG1weklsMHNJbTVoYldWeklqcGJYU3dpYldGd2NHbHVaM01pT2lJN1FVRkJRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVNJc0ltWnBiR1VpT2lKblpXNWxjbUYwWldRdWFuTWlMQ0p6YjNWeVkyVlNiMjkwSWpvaUlpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lKM1Z6WlNCemRISnBZM1FuTzF4dVhHNTJZWElnWkc5aklEMGdaMnh2WW1Gc0xtUnZZM1Z0Wlc1ME8xeHVkbUZ5SUdKdlpIa2dQU0JrYjJNdVltOWtlVHRjYmx4dVpuVnVZM1JwYjI0Z2NtRnVaMlZVYjFSbGVIUlNZVzVuWlNBb2NtRnVaMlVwSUh0Y2JpQWdhV1lnS0hKaGJtZGxMbU52Ykd4aGNITmxaQ2tnZTF4dUlDQWdJSEpsZEhWeWJpQmpjbVZoZEdWQ2IzVnVaR0Z5ZVZSbGVIUlNZVzVuWlNoN0lHNXZaR1U2SUhKaGJtZGxMbk4wWVhKMFEyOXVkR0ZwYm1WeUxDQnZabVp6WlhRNklISmhibWRsTG5OMFlYSjBUMlptYzJWMElIMHNJSFJ5ZFdVcE8xeHVJQ0I5WEc0Z0lIWmhjaUJ6ZEdGeWRGSmhibWRsSUQwZ1kzSmxZWFJsUW05MWJtUmhjbmxVWlhoMFVtRnVaMlVvZXlCdWIyUmxPaUJ5WVc1blpTNXpkR0Z5ZEVOdmJuUmhhVzVsY2l3Z2IyWm1jMlYwT2lCeVlXNW5aUzV6ZEdGeWRFOW1abk5sZENCOUxDQjBjblZsS1R0Y2JpQWdkbUZ5SUdWdVpGSmhibWRsSUQwZ1kzSmxZWFJsUW05MWJtUmhjbmxVWlhoMFVtRnVaMlVvZXlCdWIyUmxPaUJ5WVc1blpTNWxibVJEYjI1MFlXbHVaWElzSUc5bVpuTmxkRG9nY21GdVoyVXVaVzVrVDJabWMyVjBJSDBzSUdaaGJITmxLVHRjYmlBZ2RtRnlJSFJsZUhSU1lXNW5aU0E5SUdKdlpIa3VZM0psWVhSbFZHVjRkRkpoYm1kbEtDazdYRzRnSUhSbGVIUlNZVzVuWlM1elpYUkZibVJRYjJsdWRDZ25VM1JoY25SVWIxTjBZWEowSnl3Z2MzUmhjblJTWVc1blpTazdYRzRnSUhSbGVIUlNZVzVuWlM1elpYUkZibVJRYjJsdWRDZ25SVzVrVkc5RmJtUW5MQ0JsYm1SU1lXNW5aU2s3WEc0Z0lISmxkSFZ5YmlCMFpYaDBVbUZ1WjJVN1hHNTlYRzVjYm1aMWJtTjBhVzl1SUdselEyaGhjbUZqZEdWeVJHRjBZVTV2WkdVZ0tHNXZaR1VwSUh0Y2JpQWdkbUZ5SUhRZ1BTQnViMlJsTG01dlpHVlVlWEJsTzF4dUlDQnlaWFIxY200Z2RDQTlQVDBnTXlCOGZDQjBJRDA5UFNBMElIeDhJSFFnUFQwOUlEZ2dPMXh1ZlZ4dVhHNW1kVzVqZEdsdmJpQmpjbVZoZEdWQ2IzVnVaR0Z5ZVZSbGVIUlNZVzVuWlNBb2NDd2djM1JoY25ScGJtY3BJSHRjYmlBZ2RtRnlJR0p2ZFc1a08xeHVJQ0IyWVhJZ2NHRnlaVzUwTzF4dUlDQjJZWElnYjJabWMyVjBJRDBnY0M1dlptWnpaWFE3WEc0Z0lIWmhjaUIzYjNKcmFXNW5UbTlrWlR0Y2JpQWdkbUZ5SUdOb2FXeGtUbTlrWlhNN1hHNGdJSFpoY2lCeVlXNW5aU0E5SUdKdlpIa3VZM0psWVhSbFZHVjRkRkpoYm1kbEtDazdYRzRnSUhaaGNpQmtZWFJoSUQwZ2FYTkRhR0Z5WVdOMFpYSkVZWFJoVG05a1pTaHdMbTV2WkdVcE8xeHVYRzRnSUdsbUlDaGtZWFJoS1NCN1hHNGdJQ0FnWW05MWJtUWdQU0J3TG01dlpHVTdYRzRnSUNBZ2NHRnlaVzUwSUQwZ1ltOTFibVF1Y0dGeVpXNTBUbTlrWlR0Y2JpQWdmU0JsYkhObElIdGNiaUFnSUNCamFHbHNaRTV2WkdWeklEMGdjQzV1YjJSbExtTm9hV3hrVG05a1pYTTdYRzRnSUNBZ1ltOTFibVFnUFNCdlptWnpaWFFnUENCamFHbHNaRTV2WkdWekxteGxibWQwYUNBL0lHTm9hV3hrVG05a1pYTmJiMlptYzJWMFhTQTZJRzUxYkd3N1hHNGdJQ0FnY0dGeVpXNTBJRDBnY0M1dWIyUmxPMXh1SUNCOVhHNWNiaUFnZDI5eWEybHVaMDV2WkdVZ1BTQmtiMk11WTNKbFlYUmxSV3hsYldWdWRDZ25jM0JoYmljcE8xeHVJQ0IzYjNKcmFXNW5UbTlrWlM1cGJtNWxja2hVVFV3Z1BTQW5KaU5tWldabU95YzdYRzVjYmlBZ2FXWWdLR0p2ZFc1a0tTQjdYRzRnSUNBZ2NHRnlaVzUwTG1sdWMyVnlkRUpsWm05eVpTaDNiM0pyYVc1blRtOWtaU3dnWW05MWJtUXBPMXh1SUNCOUlHVnNjMlVnZTF4dUlDQWdJSEJoY21WdWRDNWhjSEJsYm1SRGFHbHNaQ2gzYjNKcmFXNW5UbTlrWlNrN1hHNGdJSDFjYmx4dUlDQnlZVzVuWlM1dGIzWmxWRzlGYkdWdFpXNTBWR1Y0ZENoM2IzSnJhVzVuVG05a1pTazdYRzRnSUhKaGJtZGxMbU52Ykd4aGNITmxLQ0Z6ZEdGeWRHbHVaeWs3WEc0Z0lIQmhjbVZ1ZEM1eVpXMXZkbVZEYUdsc1pDaDNiM0pyYVc1blRtOWtaU2s3WEc1Y2JpQWdhV1lnS0dSaGRHRXBJSHRjYmlBZ0lDQnlZVzVuWlZ0emRHRnlkR2x1WnlBL0lDZHRiM1psVTNSaGNuUW5JRG9nSjIxdmRtVkZibVFuWFNnblkyaGhjbUZqZEdWeUp5d2diMlptYzJWMEtUdGNiaUFnZlZ4dUlDQnlaWFIxY200Z2NtRnVaMlU3WEc1OVhHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdjbUZ1WjJWVWIxUmxlSFJTWVc1blpUdGNiaUpkZlE9PSIsIid1c2Ugc3RyaWN0JztcblxudmFyIGJ1bGxzZXllID0gcmVxdWlyZSgnYnVsbHNleWUnKTtcbnZhciByYW5jaG9yZWQgPSAvXlsjPiotXSQvO1xudmFyIHJib3VuZGFyeSA9IC9eWypfYCMtXSQvO1xudmFyIHJidWxsZXRhZnRlciA9IC9eXFxkK1xcLiAvO1xudmFyIHJidWxsZXRsaW5lID0gL15cXHMqXFxkK1xcLiQvO1xudmFyIHJidWxsZXRsZWZ0ID0gL15cXHMqXFxkKyQvO1xudmFyIHJidWxsZXRyaWdodCA9IC9cXGR8XFwuLztcbnZhciByd2hpdGVzcGFjZSA9IC9eXFxzKiQvO1xudmFyIHJociA9IC9eLS0tKyQvO1xudmFyIHJlbmQgPSAvXiR8XFxzfFxcbi87XG52YXIgcmZvb3Rub3RlZGVjbGFyYXRpb24gPSAvXlxcW1teXFxdXStcXF1cXHMqOlxccypbQS16XFwvXS87XG52YXIgcmZvb3Rub3RlYmVnaW4gPSAvXlxccypcXFtbXlxcXV0qJC87XG52YXIgcmZvb3Rub3RlYmVnYW4gPSAvXlxccypcXFtbXlxcXV0rJC87XG52YXIgcmZvb3Rub3RlbGVmdCA9IC9eXFxzKlxcW1teXFxdXStcXF1cXHMqJC87XG52YXIgcmZvb3Rub3RlYW5jaG9yID0gL15cXHMqXFxbW15cXF1dK1xcXVxccyo6JC87XG52YXIgcmZvb3Rub3RlbGluayA9IC9eXFxzKlxcW1teXFxdXStcXF1cXHMqOlxccypbQS16XFwvXS87XG52YXIgcmZvb3Rub3RlZnVsbCA9IC9eXFxzKlxcW1teXFxdXStcXF1cXHMqOlxccypbQS16XFwvXS4qXFxzKlwiW15cIl0qXCIvO1xudmFyIHJzcGFjZW9ycXVvdGUgPSAvXFxzfFwiLztcbnZhciByc3BhY2VvcmNvbG9uID0gL1xcc3w6LztcbnZhciByZW1wdHkgPSAvXig8cD48XFwvcD4pP1xcbj8kL2k7XG5cbmZ1bmN0aW9uIHJlbWVtYmVyU2VsZWN0aW9uIChoaXN0b3J5KSB7XG4gIHZhciBjb2RlID0gTWF0aC5yYW5kb20oKS50b1N0cmluZygxOCkuc3Vic3RyKDIpLnJlcGxhY2UoL1xcZCsvZywgJycpO1xuICB2YXIgb3BlbiA9ICdXb29mbWFya1NlbGVjdGlvbk9wZW5NYXJrZXInICsgY29kZTtcbiAgdmFyIGNsb3NlID0gJ1dvb2ZtYXJrU2VsZWN0aW9uQ2xvc2VNYXJrZXInICsgY29kZTtcbiAgdmFyIHJtYXJrZXJzID0gbmV3IFJlZ0V4cChvcGVuICsgJ3wnICsgY2xvc2UsICdnJyk7XG4gIG1hcmsoKTtcbiAgcmV0dXJuIHVubWFyaztcblxuICBmdW5jdGlvbiBtYXJrICgpIHtcbiAgICB2YXIgc3RhdGUgPSBoaXN0b3J5LnJlc2V0KCkuaW5wdXRTdGF0ZTtcbiAgICB2YXIgY2h1bmtzID0gc3RhdGUuZ2V0Q2h1bmtzKCk7XG4gICAgdmFyIG1vZGUgPSBzdGF0ZS5tb2RlO1xuICAgIHZhciBhbGwgPSBjaHVua3MuYmVmb3JlICsgY2h1bmtzLnNlbGVjdGlvbiArIGNodW5rcy5hZnRlcjtcbiAgICBpZiAocmVtcHR5LnRlc3QoYWxsKSkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAobW9kZSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgdXBkYXRlTWFya2Rvd25DaHVua3MoY2h1bmtzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdXBkYXRlSFRNTENodW5rcyhjaHVua3MpO1xuICAgIH1cbiAgICBzdGF0ZS5zZXRDaHVua3MoY2h1bmtzKTtcbiAgICBzdGF0ZS5yZXN0b3JlKGZhbHNlKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHVubWFyayAoKSB7XG4gICAgdmFyIHN0YXRlID0gaGlzdG9yeS5pbnB1dFN0YXRlO1xuICAgIHZhciBjaHVua3MgPSBzdGF0ZS5nZXRDaHVua3MoKTtcbiAgICB2YXIgYWxsID0gY2h1bmtzLmJlZm9yZSArIGNodW5rcy5zZWxlY3Rpb24gKyBjaHVua3MuYWZ0ZXI7XG4gICAgdmFyIHN0YXJ0ID0gYWxsLmxhc3RJbmRleE9mKG9wZW4pO1xuICAgIHZhciBlbmQgPSBhbGwubGFzdEluZGV4T2YoY2xvc2UpICsgY2xvc2UubGVuZ3RoO1xuICAgIHZhciBzZWxlY3Rpb25TdGFydCA9IHN0YXJ0ID09PSAtMSA/IDAgOiBzdGFydDtcbiAgICB2YXIgc2VsZWN0aW9uRW5kID0gZW5kID09PSAtMSA/IDAgOiBlbmQ7XG4gICAgY2h1bmtzLmJlZm9yZSA9IGFsbC5zdWJzdHIoMCwgc2VsZWN0aW9uU3RhcnQpLnJlcGxhY2Uocm1hcmtlcnMsICcnKTtcbiAgICBjaHVua3Muc2VsZWN0aW9uID0gYWxsLnN1YnN0cihzZWxlY3Rpb25TdGFydCwgc2VsZWN0aW9uRW5kIC0gc2VsZWN0aW9uU3RhcnQpLnJlcGxhY2Uocm1hcmtlcnMsICcnKTtcbiAgICBjaHVua3MuYWZ0ZXIgPSBhbGwuc3Vic3RyKGVuZCkucmVwbGFjZShybWFya2VycywgJycpO1xuICAgIHZhciBlbCA9IGhpc3Rvcnkuc3VyZmFjZS5jdXJyZW50KGhpc3RvcnkuaW5wdXRNb2RlKTtcbiAgICB2YXIgZXllID0gYnVsbHNleWUoZWwsIHtcbiAgICAgIGNhcmV0OiB0cnVlLCBhdXRvdXBkYXRlVG9DYXJldDogZmFsc2UsIHRyYWNraW5nOiBmYWxzZVxuICAgIH0pO1xuICAgIHN0YXRlLnNldENodW5rcyhjaHVua3MpO1xuICAgIHN0YXRlLnJlc3RvcmUoZmFsc2UpO1xuICAgIHN0YXRlLnNjcm9sbFRvcCA9IGVsLnNjcm9sbFRvcCA9IGV5ZS5yZWFkKCkueSAtIGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLnRvcCAtIDUwO1xuICAgIGV5ZS5kZXN0cm95KCk7XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVNYXJrZG93bkNodW5rcyAoY2h1bmtzKSB7XG4gICAgdmFyIGFsbCA9IGNodW5rcy5iZWZvcmUgKyBjaHVua3Muc2VsZWN0aW9uICsgY2h1bmtzLmFmdGVyO1xuICAgIHZhciBvcmlnaW5hbFN0YXJ0ID0gY2h1bmtzLmJlZm9yZS5sZW5ndGg7XG4gICAgdmFyIG9yaWdpbmFsRW5kID0gb3JpZ2luYWxTdGFydCArIGNodW5rcy5zZWxlY3Rpb24ubGVuZ3RoO1xuICAgIHZhciBzZWxlY3Rpb25TdGFydCA9IG1vdmUob3JpZ2luYWxTdGFydCwgMSk7XG4gICAgdmFyIHNlbGVjdGlvbkVuZCA9IG1vdmUob3JpZ2luYWxFbmQsIC0xKTtcbiAgICB2YXIgbW92ZWQgPSBvcmlnaW5hbFN0YXJ0ICE9PSBzZWxlY3Rpb25TdGFydCB8fCBvcmlnaW5hbEVuZCAhPT0gc2VsZWN0aW9uRW5kO1xuXG4gICAgdXBkYXRlU2VsZWN0aW9uKGNodW5rcywgYWxsLCBzZWxlY3Rpb25TdGFydCwgc2VsZWN0aW9uRW5kLCBtb3ZlZCk7XG5cbiAgICBmdW5jdGlvbiBtb3ZlIChwLCBvZmZzZXQpIHtcbiAgICAgIHZhciBwcmV2ID0gYWxsW3AgLSAxXSB8fCAnJztcbiAgICAgIHZhciBuZXh0ID0gYWxsW3BdIHx8ICcnO1xuICAgICAgdmFyIGxpbmUgPSBiYWNrdHJhY2UocCAtIDEsICdcXG4nKTtcbiAgICAgIHZhciBqdW1wcyA9IHByZXYgPT09ICcnIHx8IHByZXYgPT09ICdcXG4nO1xuXG4gICAgICBpZiAobmV4dCA9PT0gJyAnICYmIChqdW1wcyB8fCBwcmV2ID09PSAnICcpKSB7XG4gICAgICAgIHJldHVybiBhZ2FpbigpO1xuICAgICAgfVxuXG4gICAgICB2YXIgY2xvc2UgPSBiYWNrdHJhY2UocCAtIDEsICddJyk7XG4gICAgICB2YXIgcmVvcGVuZWQgPSBjbG9zZS5pbmRleE9mKCdbJyk7XG5cbiAgICAgIC8vIHRoZXNlIHR3byBoYW5kbGUgYW5jaG9yZWQgcmVmZXJlbmNlcyAnW2Zvb11bMV0nLCBvciBldmVuICdbYmFyXSAgXFxuIFsyXSdcbiAgICAgIGlmIChyZW9wZW5lZCAhPT0gLTEgJiYgcndoaXRlc3BhY2UudGVzdChjbG9zZS5zdWJzdHIoMCwgcmVvcGVuZWQpKSkge1xuICAgICAgICByZXR1cm4gYWdhaW4oLWNsb3NlLmxlbmd0aCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZW9wZW5lZCA9IGFsbC5zdWJzdHIocCkuaW5kZXhPZignWycpO1xuICAgICAgICBpZiAocmVvcGVuZWQgIT09IC0xICYmIHJ3aGl0ZXNwYWNlLnRlc3QoYWxsLnN1YnN0cihwLCByZW9wZW5lZCkpKSB7XG4gICAgICAgICAgcmV0dXJuIGFnYWluKC0xKTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICAvLyB0aGUgc2V2ZW4gZm9sbG93aW5nIHJ1bGVzIHRvZ2V0aGVyIGhhbmRsZSBmb290bm90ZSByZWZlcmVuY2VzXG4gICAgICBpZiAoKGp1bXBzIHx8IHJ3aGl0ZXNwYWNlLnRlc3QobGluZSkpICYmIHJmb290bm90ZWRlY2xhcmF0aW9uLnRlc3QoYWxsLnN1YnN0cihwKSkpIHtcbiAgICAgICAgcmV0dXJuIGFnYWluKCk7IC8vIHN0YXJ0ZWQgd2l0aCAnJywgJ1xcbicsIG9yICcgICcgYW5kIGNvbnRpbnVlZCB3aXRoICdbYS0xXTogaCdcbiAgICAgIH1cbiAgICAgIGlmIChyZm9vdG5vdGViZWdpbi50ZXN0KGxpbmUpICYmIG5leHQgIT09ICddJykge1xuICAgICAgICByZXR1cm4gYWdhaW4oKTsgLy8gc3RhcnRlZCB3aXRoICdbJyBhbmQgY29udGludWVkIHdpdGggJ2EtMSdcbiAgICAgIH1cbiAgICAgIGlmIChyZm9vdG5vdGViZWdhbi50ZXN0KGxpbmUpICYmIG5leHQgPT09ICddJykge1xuICAgICAgICByZXR1cm4gYWdhaW4oKTsgLy8gc3RhcnRlZCB3aXRoICdbYS0xJyBhbmQgY29udGludWVkIHdpdGggJ106IGgnXG4gICAgICB9XG4gICAgICBpZiAocmZvb3Rub3RlbGVmdC50ZXN0KGxpbmUpICYmIHJzcGFjZW9yY29sb24udGVzdChuZXh0KSkge1xuICAgICAgICByZXR1cm4gYWdhaW4oKTsgLy8gc3RhcnRlZCB3aXRoICdbYS0xXSAgJyBhbmQgY29udGludWVkIHdpdGggJzonXG4gICAgICB9XG4gICAgICBpZiAocmZvb3Rub3RlYW5jaG9yLnRlc3QobGluZSkgJiYgbmV4dCA9PT0gJyAnKSB7XG4gICAgICAgIHJldHVybiBhZ2FpbigpOyAvLyBzdGFydGVkIHdpdGggJ1thLTFdICA6JyBhbmQgY29udGludWVkIHdpdGggJyAnXG4gICAgICB9XG4gICAgICBpZiAocmZvb3Rub3RlbGluay50ZXN0KGxpbmUpICYmIHByZXYgPT09ICcgJyAmJiByc3BhY2VvcnF1b3RlLnRlc3QobmV4dCkgJiYgb2Zmc2V0ID09PSAxKSB7XG4gICAgICAgIHJldHVybiBhZ2FpbigpOyAvLyBzdGFydGVkIHdpdGggJ1thLTFdICA6JyBhbmQgY29udGludWVkIHdpdGggJyAnLCBvciAnXCInLCBvbiB0aGUgbGVmdFxuICAgICAgfVxuICAgICAgaWYgKHJmb290bm90ZWZ1bGwudGVzdChsaW5lKSAmJiByZW5kLnRlc3QobmV4dCkpIHtcbiAgICAgICAgcmV0dXJuIGFnYWluKC0xKTsgLy8gc3RhcnRlZCB3aXRoICdbYS0xXSAgOiBzb21ldGhpbmcgXCJzb21ldGhpbmdcIicgYW5kIGNvbnRpbnVlZCB3aXRoICcnLCAnICcsIG9yICdcXG4nXG4gICAgICB9XG5cbiAgICAgIC8vIHRoZSB0aHJlZSBmb2xsb3dpbmcgcnVsZXMgdG9nZXRoZXIgaGFuZGxlIG9yZGVyZWQgbGlzdCBpdGVtczogJ1xcbjEuIGZvb1xcbjIuIGJhcidcbiAgICAgIGlmICgoanVtcHMgfHwgcndoaXRlc3BhY2UudGVzdChsaW5lKSkgJiYgcmJ1bGxldGFmdGVyLnRlc3QoYWxsLnN1YnN0cihwKSkpIHtcbiAgICAgICAgcmV0dXJuIGFnYWluKCk7IC8vIHN0YXJ0ZWQgd2l0aCAnJywgJ1xcbicsIG9yICcgICcgYW5kIGNvbnRpbnVlZCB3aXRoICcxMjMuICdcbiAgICAgIH1cbiAgICAgIGlmIChyYnVsbGV0bGVmdC50ZXN0KGxpbmUpICYmIHJidWxsZXRyaWdodC50ZXN0KG5leHQpKSB7XG4gICAgICAgIHJldHVybiBhZ2FpbigpOyAvLyBzdGFydGVkIHdpdGggJyAgMTIzJyBhbmQgZW5kZWQgaW4gJzQnIG9yICcuJ1xuICAgICAgfVxuICAgICAgaWYgKHJidWxsZXRsaW5lLnRlc3QobGluZSkgJiYgbmV4dCA9PT0gJyAnKSB7XG4gICAgICAgIHJldHVybiBhZ2FpbigpOyAvLyBzdGFydGVkIHdpdGggJyAgMTIzLicgYW5kIGVuZGVkIHdpdGggJyAnXG4gICAgICB9XG5cbiAgICAgIGlmIChyYW5jaG9yZWQudGVzdChuZXh0KSAmJiBqdW1wcykge1xuICAgICAgICByZXR1cm4gYWdhaW4oKTtcbiAgICAgIH1cbiAgICAgIGlmIChyYW5jaG9yZWQudGVzdChwcmV2KSAmJiBuZXh0ID09PSAnICcpIHtcbiAgICAgICAgcmV0dXJuIGFnYWluKCk7XG4gICAgICB9XG4gICAgICBpZiAobmV4dCA9PT0gcHJldiAmJiByYm91bmRhcnkudGVzdChuZXh0KSkge1xuICAgICAgICByZXR1cm4gYWdhaW4oKTtcbiAgICAgIH1cbiAgICAgIGlmIChyaHIudGVzdChsaW5lKSAmJiBuZXh0ID09PSAnXFxuJykge1xuICAgICAgICByZXR1cm4gYWdhaW4oKTtcbiAgICAgIH1cbiAgICAgIGlmIChhbGwuc3Vic3RyKHAgLSAzLCAzKSA9PT0gJ2BgYCcgJiYgb2Zmc2V0ID09PSAxKSB7IC8vIGhhbmRsZXMgJ2BgYGphdmFzY3JpcHRcXG5jb2RlXFxuYGBgJ1xuICAgICAgICB3aGlsZSAoYWxsW3AgLSAxXSAmJiBhbGxbcCAtIDFdICE9PSAnXFxuJykge1xuICAgICAgICAgIHArKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHA7XG5cbiAgICAgIGZ1bmN0aW9uIGFnYWluIChvdmVycmlkZSkge1xuICAgICAgICB2YXIgZGlmZiA9IG92ZXJyaWRlIHx8IG9mZnNldDtcbiAgICAgICAgcmV0dXJuIG1vdmUocCArIGRpZmYsIGRpZmYgPiAwID8gMSA6IC0xKTtcbiAgICAgIH1cbiAgICAgIGZ1bmN0aW9uIGJhY2t0cmFjZSAocCwgZWRnZSkge1xuICAgICAgICB2YXIgbGFzdCA9IGFsbFtwXTtcbiAgICAgICAgdmFyIHRleHQgPSAnJztcbiAgICAgICAgd2hpbGUgKGxhc3QgJiYgbGFzdCAhPT0gZWRnZSkge1xuICAgICAgICAgIHRleHQgPSBsYXN0ICsgdGV4dDtcbiAgICAgICAgICBsYXN0ID0gYWxsWy0tcF07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRleHQ7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlSFRNTENodW5rcyAoY2h1bmtzKSB7XG4gICAgdmFyIGFsbCA9IGNodW5rcy5iZWZvcmUgKyBjaHVua3Muc2VsZWN0aW9uICsgY2h1bmtzLmFmdGVyO1xuICAgIHZhciBzZWxlY3Rpb25TdGFydCA9IGNodW5rcy5iZWZvcmUubGVuZ3RoO1xuICAgIHZhciBzZWxlY3Rpb25FbmQgPSBzZWxlY3Rpb25TdGFydCArIGNodW5rcy5zZWxlY3Rpb24ubGVuZ3RoO1xuICAgIHZhciBsZWZ0Q2xvc2UgPSBjaHVua3MuYmVmb3JlLmxhc3RJbmRleE9mKCc+Jyk7XG4gICAgdmFyIGxlZnRPcGVuID0gY2h1bmtzLmJlZm9yZS5sYXN0SW5kZXhPZignPCcpO1xuICAgIHZhciByaWdodENsb3NlID0gY2h1bmtzLmFmdGVyLmluZGV4T2YoJz4nKTtcbiAgICB2YXIgcmlnaHRPcGVuID0gY2h1bmtzLmFmdGVyLmluZGV4T2YoJzwnKTtcbiAgICB2YXIgcHJldk9wZW47XG4gICAgdmFyIG5leHRDbG9zZTtcbiAgICB2YXIgYmFsYW5jZVRhZ3M7XG5cbiAgICAvLyA8Zm9bb10+YmFyPC9mb28+IGludG8gPGZvbz5bXWJhcjwvZm9vPiwgPGZvW28+YmFdcjwvZm9vPiBpbnRvIDxmb28+W2JhXXI8L2Zvbz5cbiAgICBpZiAobGVmdE9wZW4gPiBsZWZ0Q2xvc2UpIHtcbiAgICAgIG5leHRDbG9zZSA9IGFsbC5pbmRleE9mKCc+JywgbGVmdENsb3NlICsgMSk7XG4gICAgICBpZiAobmV4dENsb3NlICE9PSAtMSkge1xuICAgICAgICBzZWxlY3Rpb25TdGFydCA9IG5leHRDbG9zZSArIDE7XG4gICAgICAgIGJhbGFuY2VUYWdzID0gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyA8Zm9vPmJhcjwvW2ZvXW8+IGludG8gPGZvbz5iYXJbXTwvZm9vPiwgPGZvbz5iW2FyPC9mXW9vPiBpbnRvIDxmb28+Ylthcl08L2Zvbz5cbiAgICBpZiAocmlnaHRPcGVuID09PSAtMSB8fCByaWdodE9wZW4gPiByaWdodENsb3NlKSB7XG4gICAgICBwcmV2T3BlbiA9IGFsbC5zdWJzdHIoMCwgY2h1bmtzLmJlZm9yZS5sZW5ndGggKyBjaHVua3Muc2VsZWN0aW9uLmxlbmd0aCArIHJpZ2h0Q2xvc2UpLmxhc3RJbmRleE9mKCc8Jyk7XG4gICAgICBpZiAocHJldk9wZW4gIT09IC0xKSB7XG4gICAgICAgIHNlbGVjdGlvbkVuZCA9IHByZXZPcGVuO1xuICAgICAgICBzZWxlY3Rpb25TdGFydCA9IE1hdGgubWluKHNlbGVjdGlvblN0YXJ0LCBzZWxlY3Rpb25FbmQpO1xuICAgICAgICBiYWxhbmNlVGFncyA9IHRydWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdXBkYXRlU2VsZWN0aW9uKGNodW5rcywgYWxsLCBzZWxlY3Rpb25TdGFydCwgc2VsZWN0aW9uRW5kLCBiYWxhbmNlVGFncyk7XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVTZWxlY3Rpb24gKGNodW5rcywgYWxsLCBzZWxlY3Rpb25TdGFydCwgc2VsZWN0aW9uRW5kLCBiYWxhbmNlVGFncykge1xuICAgIGlmIChzZWxlY3Rpb25FbmQgPCBzZWxlY3Rpb25TdGFydCkge1xuICAgICAgc2VsZWN0aW9uRW5kID0gc2VsZWN0aW9uU3RhcnQ7XG4gICAgfVxuICAgIGlmIChiYWxhbmNlVGFncykge1xuICAgICAgY2h1bmtzLmJlZm9yZSA9IGFsbC5zdWJzdHIoMCwgc2VsZWN0aW9uU3RhcnQpO1xuICAgICAgY2h1bmtzLnNlbGVjdGlvbiA9IGFsbC5zdWJzdHIoc2VsZWN0aW9uU3RhcnQsIHNlbGVjdGlvbkVuZCAtIHNlbGVjdGlvblN0YXJ0KTtcbiAgICAgIGNodW5rcy5hZnRlciA9IGFsbC5zdWJzdHIoc2VsZWN0aW9uRW5kKTtcbiAgICB9XG4gICAgY2h1bmtzLnNlbGVjdGlvbiA9IG9wZW4gKyBjaHVua3Muc2VsZWN0aW9uICsgY2xvc2U7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSByZW1lbWJlclNlbGVjdGlvbjtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHNldFRleHQgPSByZXF1aXJlKCcuL3NldFRleHQnKTtcbnZhciBzdHJpbmdzID0gcmVxdWlyZSgnLi9zdHJpbmdzJyk7XG5cbmZ1bmN0aW9uIGNvbW1hbmRzIChlbCwgaWQpIHtcbiAgc2V0VGV4dChlbCwgc3RyaW5ncy5idXR0b25zW2lkXSB8fCBpZCk7XG59XG5cbmZ1bmN0aW9uIG1vZGVzIChlbCwgaWQpIHtcbiAgdmFyIHRleHRzID0ge1xuICAgIG1hcmtkb3duOiAnbVxcdTIxOTMnLFxuICAgIHd5c2l3eWc6ICd3eXNpd3lnJ1xuICB9O1xuICBzZXRUZXh0KGVsLCB0ZXh0c1tpZF0gfHwgaWQpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgbW9kZXM6IG1vZGVzLFxuICBjb21tYW5kczogY29tbWFuZHNcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHNldFRleHQgKGVsLCB2YWx1ZSkge1xuICBlbC5pbm5lclRleHQgPSBlbC50ZXh0Q29udGVudCA9IHZhbHVlO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHNldFRleHQ7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBwbGFjZWhvbGRlcnM6IHtcbiAgICBib2xkOiAnc3Ryb25nIHRleHQnLFxuICAgIGl0YWxpYzogJ2VtcGhhc2l6ZWQgdGV4dCcsXG4gICAgcXVvdGU6ICdxdW90ZWQgdGV4dCcsXG4gICAgY29kZTogJ2NvZGUgZ29lcyBoZXJlJyxcbiAgICBsaXN0aXRlbTogJ2xpc3QgaXRlbScsXG4gICAgaGVhZGluZzogJ0hlYWRpbmcgVGV4dCcsXG4gICAgbGluazogJ2xpbmsgdGV4dCcsXG4gICAgaW1hZ2U6ICdpbWFnZSBkZXNjcmlwdGlvbicsXG4gICAgYXR0YWNobWVudDogJ2F0dGFjaG1lbnQgZGVzY3JpcHRpb24nXG4gIH0sXG4gIHRpdGxlczoge1xuICAgIGJvbGQ6ICdTdHJvbmcgPHN0cm9uZz4gQ3RybCtCJyxcbiAgICBpdGFsaWM6ICdFbXBoYXNpcyA8ZW0+IEN0cmwrSScsXG4gICAgcXVvdGU6ICdCbG9ja3F1b3RlIDxibG9ja3F1b3RlPiBDdHJsK0onLFxuICAgIGNvZGU6ICdDb2RlIFNhbXBsZSA8cHJlPjxjb2RlPiBDdHJsK0UnLFxuICAgIG9sOiAnTnVtYmVyZWQgTGlzdCA8b2w+IEN0cmwrTycsXG4gICAgdWw6ICdCdWxsZXRlZCBMaXN0IDx1bD4gQ3RybCtVJyxcbiAgICBoZWFkaW5nOiAnSGVhZGluZyA8aDE+LCA8aDI+LCAuLi4gQ3RybCtEJyxcbiAgICBsaW5rOiAnSHlwZXJsaW5rIDxhPiBDdHJsK0snLFxuICAgIGltYWdlOiAnSW1hZ2UgPGltZz4gQ3RybCtHJyxcbiAgICBhdHRhY2htZW50OiAnQXR0YWNobWVudCBDdHJsK1NoaWZ0K0snLFxuICAgIG1hcmtkb3duOiAnTWFya2Rvd24gTW9kZSBDdHJsK00nLFxuICAgIGh0bWw6ICdIVE1MIE1vZGUgQ3RybCtIJyxcbiAgICB3eXNpd3lnOiAnUHJldmlldyBNb2RlIEN0cmwrUCdcbiAgfSxcbiAgYnV0dG9uczoge1xuICAgIGJvbGQ6ICdCJyxcbiAgICBpdGFsaWM6ICdJJyxcbiAgICBxdW90ZTogJ1xcdTIwMWMnLFxuICAgIGNvZGU6ICc8Lz4nLFxuICAgIG9sOiAnMS4nLFxuICAgIHVsOiAnXFx1MjlCRicsXG4gICAgaGVhZGluZzogJ1R0JyxcbiAgICBsaW5rOiAnTGluaycsXG4gICAgaW1hZ2U6ICdJbWFnZScsXG4gICAgaHI6ICdcXHUyMWI1J1xuICB9LFxuICBwcm9tcHRzOiB7XG4gICAgbGluazoge1xuICAgICAgdGl0bGU6ICdJbnNlcnQgTGluaycsXG4gICAgICBkZXNjcmlwdGlvbjogJ1R5cGUgb3IgcGFzdGUgdGhlIHVybCB0byB5b3VyIGxpbmsnLFxuICAgICAgcGxhY2Vob2xkZXI6ICdodHRwOi8vZXhhbXBsZS5jb20vIFwidGl0bGVcIidcbiAgICB9LFxuICAgIGltYWdlOiB7XG4gICAgICB0aXRsZTogJ0luc2VydCBJbWFnZScsXG4gICAgICBkZXNjcmlwdGlvbjogJ0VudGVyIHRoZSB1cmwgdG8geW91ciBpbWFnZScsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS9wdWJsaWMvaW1hZ2UucG5nIFwidGl0bGVcIidcbiAgICB9LFxuICAgIGF0dGFjaG1lbnQ6IHtcbiAgICAgIHRpdGxlOiAnQXR0YWNoIEZpbGUnLFxuICAgICAgZGVzY3JpcHRpb246ICdFbnRlciB0aGUgdXJsIHRvIHlvdXIgYXR0YWNobWVudCcsXG4gICAgICBwbGFjZWhvbGRlcjogJ2h0dHA6Ly9leGFtcGxlLmNvbS9wdWJsaWMvcmVwb3J0LnBkZiBcInRpdGxlXCInXG4gICAgfSxcbiAgICB0eXBlczogJ1lvdSBjYW4gb25seSB1cGxvYWQgJyxcbiAgICBicm93c2U6ICdCcm93c2UuLi4nLFxuICAgIGRyb3BoaW50OiAnWW91IGNhbiBhbHNvIGRyYWcgZmlsZXMgZnJvbSB5b3VyIGNvbXB1dGVyIGFuZCBkcm9wIHRoZW0gaGVyZSEnLFxuICAgIGRyb3A6ICdEcm9wIHlvdXIgZmlsZSBoZXJlIHRvIGJlZ2luIHVwbG9hZC4uLicsXG4gICAgdXBsb2FkOiAnLCBvciB1cGxvYWQgYSBmaWxlJyxcbiAgICB1cGxvYWRpbmc6ICdVcGxvYWRpbmcgeW91ciBmaWxlLi4uJyxcbiAgICB1cGxvYWRmYWlsZWQ6ICdUaGUgdXBsb2FkIGZhaWxlZCEgVGhhdFxcJ3MgYWxsIHdlIGtub3cuJ1xuICB9XG59O1xuIiwiKGZ1bmN0aW9uIChnbG9iYWwpe1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgbHMgPSByZXF1aXJlKCdsb2NhbC1zdG9yYWdlJyk7XG52YXIgY3Jvc3N2ZW50ID0gcmVxdWlyZSgnY3Jvc3N2ZW50Jyk7XG52YXIga2FueWUgPSByZXF1aXJlKCdrYW55ZScpO1xudmFyIHN0cmluZ3MgPSByZXF1aXJlKCcuL3N0cmluZ3MnKTtcbnZhciBzZXRUZXh0ID0gcmVxdWlyZSgnLi9zZXRUZXh0Jyk7XG52YXIgZ2V0U2VsZWN0aW9uID0gcmVxdWlyZSgnLi9wb2x5ZmlsbHMvZ2V0U2VsZWN0aW9uJyk7XG52YXIgcmVtZW1iZXJTZWxlY3Rpb24gPSByZXF1aXJlKCcuL3JlbWVtYmVyU2VsZWN0aW9uJyk7XG52YXIgYmluZENvbW1hbmRzID0gcmVxdWlyZSgnLi9iaW5kQ29tbWFuZHMnKTtcbnZhciBJbnB1dEhpc3RvcnkgPSByZXF1aXJlKCcuL0lucHV0SGlzdG9yeScpO1xudmFyIGdldENvbW1hbmRIYW5kbGVyID0gcmVxdWlyZSgnLi9nZXRDb21tYW5kSGFuZGxlcicpO1xudmFyIGdldFN1cmZhY2UgPSByZXF1aXJlKCcuL2dldFN1cmZhY2UnKTtcbnZhciBjbGFzc2VzID0gcmVxdWlyZSgnLi9jbGFzc2VzJyk7XG52YXIgcmVuZGVyZXJzID0gcmVxdWlyZSgnLi9yZW5kZXJlcnMnKTtcbnZhciB4aHJTdHViID0gcmVxdWlyZSgnLi94aHJTdHViJyk7XG52YXIgcHJvbXB0ID0gcmVxdWlyZSgnLi9wcm9tcHRzL3Byb21wdCcpO1xudmFyIGNsb3NlUHJvbXB0cyA9IHJlcXVpcmUoJy4vcHJvbXB0cy9jbG9zZScpO1xudmFyIG1vZGVOYW1lcyA9IFsnbWFya2Rvd24nLCAnaHRtbCcsICd3eXNpd3lnJ107XG52YXIgY2FjaGUgPSBbXTtcbnZhciBtYWMgPSAvXFxiTWFjIE9TXFxiLy50ZXN0KGdsb2JhbC5uYXZpZ2F0b3IudXNlckFnZW50KTtcbnZhciBkb2MgPSBkb2N1bWVudDtcbnZhciBycGFyYWdyYXBoID0gL148cD48XFwvcD5cXG4/JC9pO1xuXG5mdW5jdGlvbiBmaW5kICh0ZXh0YXJlYSkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IGNhY2hlLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKGNhY2hlW2ldICYmIGNhY2hlW2ldLnRhID09PSB0ZXh0YXJlYSkge1xuICAgICAgcmV0dXJuIGNhY2hlW2ldLmVkaXRvcjtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG51bGw7XG59XG5cbmZ1bmN0aW9uIHdvb2ZtYXJrICh0ZXh0YXJlYSwgb3B0aW9ucykge1xuICB2YXIgY2FjaGVkID0gZmluZCh0ZXh0YXJlYSk7XG4gIGlmIChjYWNoZWQpIHtcbiAgICByZXR1cm4gY2FjaGVkO1xuICB9XG5cbiAgdmFyIHBhcmVudCA9IHRleHRhcmVhLnBhcmVudEVsZW1lbnQ7XG4gIGlmIChwYXJlbnQuY2hpbGRyZW4ubGVuZ3RoID4gMSkge1xuICAgIHRocm93IG5ldyBFcnJvcignd29vZm1hcmsgZGVtYW5kcyA8dGV4dGFyZWE+IGVsZW1lbnRzIHRvIGhhdmUgbm8gc2libGluZ3MnKTtcbiAgfVxuXG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcbiAgaWYgKG8ubWFya2Rvd24gPT09IHZvaWQgMCkgeyBvLm1hcmtkb3duID0gdHJ1ZTsgfVxuICBpZiAoby5odG1sID09PSB2b2lkIDApIHsgby5odG1sID0gdHJ1ZTsgfVxuICBpZiAoby53eXNpd3lnID09PSB2b2lkIDApIHsgby53eXNpd3lnID0gdHJ1ZTsgfVxuXG4gIGlmICghby5tYXJrZG93biAmJiAhby5odG1sICYmICFvLnd5c2l3eWcpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ3dvb2ZtYXJrIGV4cGVjdHMgYXQgbGVhc3Qgb25lIGlucHV0IG1vZGUgdG8gYmUgYXZhaWxhYmxlJyk7XG4gIH1cblxuICBpZiAoby5ociA9PT0gdm9pZCAwKSB7IG8uaHIgPSBmYWxzZTsgfVxuICBpZiAoby5zdG9yYWdlID09PSB2b2lkIDApIHsgby5zdG9yYWdlID0gdHJ1ZTsgfVxuICBpZiAoby5zdG9yYWdlID09PSB0cnVlKSB7IG8uc3RvcmFnZSA9ICd3b29mbWFya19pbnB1dF9tb2RlJzsgfVxuICBpZiAoby5mZW5jaW5nID09PSB2b2lkIDApIHsgby5mZW5jaW5nID0gdHJ1ZTsgfVxuICBpZiAoby5yZW5kZXIgPT09IHZvaWQgMCkgeyBvLnJlbmRlciA9IHt9OyB9XG4gIGlmIChvLnJlbmRlci5tb2RlcyA9PT0gdm9pZCAwKSB7IG8ucmVuZGVyLm1vZGVzID0ge307IH1cbiAgaWYgKG8ucmVuZGVyLmNvbW1hbmRzID09PSB2b2lkIDApIHsgby5yZW5kZXIuY29tbWFuZHMgPSB7fTsgfVxuICBpZiAoby5wcm9tcHRzID09PSB2b2lkIDApIHsgby5wcm9tcHRzID0ge307IH1cbiAgaWYgKG8ucHJvbXB0cy5saW5rID09PSB2b2lkIDApIHsgby5wcm9tcHRzLmxpbmsgPSBwcm9tcHQ7IH1cbiAgaWYgKG8ucHJvbXB0cy5pbWFnZSA9PT0gdm9pZCAwKSB7IG8ucHJvbXB0cy5pbWFnZSA9IHByb21wdDsgfVxuICBpZiAoby5wcm9tcHRzLmF0dGFjaG1lbnQgPT09IHZvaWQgMCkgeyBvLnByb21wdHMuYXR0YWNobWVudCA9IHByb21wdDsgfVxuICBpZiAoby5wcm9tcHRzLmNsb3NlID09PSB2b2lkIDApIHsgby5wcm9tcHRzLmNsb3NlID0gY2xvc2VQcm9tcHRzOyB9XG4gIGlmIChvLnhociA9PT0gdm9pZCAwKSB7IG8ueGhyID0geGhyU3R1YjsgfVxuICBpZiAoby5jbGFzc2VzID09PSB2b2lkIDApIHsgby5jbGFzc2VzID0ge307IH1cbiAgaWYgKG8uY2xhc3Nlcy53eXNpd3lnID09PSB2b2lkIDApIHsgby5jbGFzc2VzLnd5c2l3eWcgPSBbXTsgfVxuICBpZiAoby5jbGFzc2VzLnByb21wdHMgPT09IHZvaWQgMCkgeyBvLmNsYXNzZXMucHJvbXB0cyA9IHt9OyB9XG4gIGlmIChvLmNsYXNzZXMuaW5wdXQgPT09IHZvaWQgMCkgeyBvLmNsYXNzZXMuaW5wdXQgPSB7fTsgfVxuXG4gIHZhciBwcmVmZXJlbmNlID0gby5zdG9yYWdlICYmIGxzLmdldChvLnN0b3JhZ2UpO1xuICBpZiAocHJlZmVyZW5jZSkge1xuICAgIG8uZGVmYXVsdE1vZGUgPSBwcmVmZXJlbmNlO1xuICB9XG5cbiAgdmFyIHN3aXRjaGJvYXJkID0gdGFnKHsgYzogJ3drLXN3aXRjaGJvYXJkJyB9KTtcbiAgdmFyIGNvbW1hbmRzID0gdGFnKHsgYzogJ3drLWNvbW1hbmRzJyB9KTtcbiAgdmFyIGVkaXRhYmxlID0gdGFnKHsgYzogWyd3ay13eXNpd3lnJywgJ3drLWhpZGUnXS5jb25jYXQoby5jbGFzc2VzLnd5c2l3eWcpLmpvaW4oJyAnKSB9KTtcbiAgdmFyIHN1cmZhY2UgPSBnZXRTdXJmYWNlKHRleHRhcmVhLCBlZGl0YWJsZSk7XG4gIHZhciBoaXN0b3J5ID0gbmV3IElucHV0SGlzdG9yeShzdXJmYWNlLCAnbWFya2Rvd24nKTtcbiAgdmFyIGVkaXRvciA9IHtcbiAgICBhZGRDb21tYW5kOiBhZGRDb21tYW5kLFxuICAgIGFkZENvbW1hbmRCdXR0b246IGFkZENvbW1hbmRCdXR0b24sXG4gICAgcnVuQ29tbWFuZDogcnVuQ29tbWFuZCxcbiAgICBwYXJzZU1hcmtkb3duOiBvLnBhcnNlTWFya2Rvd24sXG4gICAgcGFyc2VIVE1MOiBvLnBhcnNlSFRNTCxcbiAgICBkZXN0cm95OiBkZXN0cm95LFxuICAgIHZhbHVlOiBnZXRNYXJrZG93bixcbiAgICBlZGl0YWJsZTogby53eXNpd3lnID8gZWRpdGFibGUgOiBudWxsLFxuICAgIHNldE1vZGU6IHBlcnNpc3RNb2RlLFxuICAgIGhpc3Rvcnk6IHtcbiAgICAgIHVuZG86IGhpc3RvcnkudW5kbyxcbiAgICAgIHJlZG86IGhpc3RvcnkucmVkbyxcbiAgICAgIGNhblVuZG86IGhpc3RvcnkuY2FuVW5kbyxcbiAgICAgIGNhblJlZG86IGhpc3RvcnkuY2FuUmVkb1xuICAgIH0sXG4gICAgbW9kZTogJ21hcmtkb3duJ1xuICB9O1xuICB2YXIgZW50cnkgPSB7IHRhOiB0ZXh0YXJlYSwgZWRpdG9yOiBlZGl0b3IgfTtcbiAgdmFyIGkgPSBjYWNoZS5wdXNoKGVudHJ5KTtcbiAgdmFyIGthbnllQ29udGV4dCA9ICd3b29mbWFya18nICsgaTtcbiAgdmFyIGthbnllT3B0aW9ucyA9IHtcbiAgICBmaWx0ZXI6IHBhcmVudCxcbiAgICBjb250ZXh0OiBrYW55ZUNvbnRleHRcbiAgfTtcbiAgdmFyIG1vZGVzID0ge1xuICAgIG1hcmtkb3duOiB7XG4gICAgICBidXR0b246IHRhZyh7IHQ6ICdidXR0b24nLCBjOiAnd2stbW9kZSB3ay1tb2RlLWFjdGl2ZScgfSksXG4gICAgICBzZXQ6IG1hcmtkb3duTW9kZVxuICAgIH0sXG4gICAgaHRtbDoge1xuICAgICAgYnV0dG9uOiB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLW1vZGUgd2stbW9kZS1pbmFjdGl2ZScgfSksXG4gICAgICBzZXQ6IGh0bWxNb2RlXG4gICAgfSxcbiAgICB3eXNpd3lnOiB7XG4gICAgICBidXR0b246IHRhZyh7IHQ6ICdidXR0b24nLCBjOiAnd2stbW9kZSB3ay1tb2RlLWluYWN0aXZlJyB9KSxcbiAgICAgIHNldDogd3lzaXd5Z01vZGVcbiAgICB9XG4gIH07XG4gIHZhciBwbGFjZTtcblxuICBlZGl0YWJsZS5jb250ZW50RWRpdGFibGUgPSB0cnVlO1xuICBtb2Rlcy5tYXJrZG93bi5idXR0b24uc2V0QXR0cmlidXRlKCdkaXNhYmxlZCcsICdkaXNhYmxlZCcpO1xuICBtb2RlTmFtZXMuZm9yRWFjaChhZGRNb2RlKTtcblxuICBpZiAoby53eXNpd3lnKSB7XG4gICAgcGxhY2UgPSB0YWcoeyBjOiAnd2std3lzaXd5Zy1wbGFjZWhvbGRlciB3ay1oaWRlJywgeDogdGV4dGFyZWEucGxhY2Vob2xkZXIgfSk7XG4gICAgY3Jvc3N2ZW50LmFkZChwbGFjZSwgJ2NsaWNrJywgZm9jdXNFZGl0YWJsZSk7XG4gIH1cblxuICBpZiAoby5kZWZhdWx0TW9kZSAmJiBvW28uZGVmYXVsdE1vZGVdKSB7XG4gICAgbW9kZXNbby5kZWZhdWx0TW9kZV0uc2V0KCk7XG4gIH0gZWxzZSBpZiAoby5tYXJrZG93bikge1xuICAgIG1vZGVzLm1hcmtkb3duLnNldCgpO1xuICB9IGVsc2UgaWYgKG8uaHRtbCkge1xuICAgIG1vZGVzLmh0bWwuc2V0KCk7XG4gIH0gZWxzZSB7XG4gICAgbW9kZXMud3lzaXd5Zy5zZXQoKTtcbiAgfVxuXG4gIGJpbmRFdmVudHMoKTtcbiAgYmluZENvbW1hbmRzKHN1cmZhY2UsIG8sIGVkaXRvcik7XG5cbiAgcmV0dXJuIGVkaXRvcjtcblxuICBmdW5jdGlvbiBhZGRNb2RlIChpZCkge1xuICAgIHZhciBidXR0b24gPSBtb2Rlc1tpZF0uYnV0dG9uO1xuICAgIHZhciBjdXN0b20gPSBvLnJlbmRlci5tb2RlcztcbiAgICBpZiAob1tpZF0pIHtcbiAgICAgIHN3aXRjaGJvYXJkLmFwcGVuZENoaWxkKGJ1dHRvbik7XG4gICAgICAodHlwZW9mIGN1c3RvbSA9PT0gJ2Z1bmN0aW9uJyA/IGN1c3RvbSA6IHJlbmRlcmVycy5tb2RlcykoYnV0dG9uLCBpZCk7XG4gICAgICBjcm9zc3ZlbnQuYWRkKGJ1dHRvbiwgJ2NsaWNrJywgbW9kZXNbaWRdLnNldCk7XG4gICAgICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICAgICAgYnV0dG9uLnRhYkluZGV4ID0gLTE7XG5cbiAgICAgIHZhciB0aXRsZSA9IHN0cmluZ3MudGl0bGVzW2lkXTtcbiAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICBidXR0b24uc2V0QXR0cmlidXRlKCd0aXRsZScsIG1hYyA/IG1hY2lmeSh0aXRsZSkgOiB0aXRsZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gYmluZEV2ZW50cyAocmVtb3ZlKSB7XG4gICAgdmFyIGFyID0gcmVtb3ZlID8gJ3JtJyA6ICdhZGQnO1xuICAgIHZhciBtb3YgPSByZW1vdmUgPyAncmVtb3ZlQ2hpbGQnIDogJ2FwcGVuZENoaWxkJztcbiAgICBpZiAocmVtb3ZlKSB7XG4gICAgICBrYW55ZS5jbGVhcihrYW55ZUNvbnRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoby5tYXJrZG93bikgeyBrYW55ZS5vbignY21kK20nLCBrYW55ZU9wdGlvbnMsIG1hcmtkb3duTW9kZSk7IH1cbiAgICAgIGlmIChvLmh0bWwpIHsga2FueWUub24oJ2NtZCtoJywga2FueWVPcHRpb25zLCBodG1sTW9kZSk7IH1cbiAgICAgIGlmIChvLnd5c2l3eWcpIHsga2FueWUub24oJ2NtZCtwJywga2FueWVPcHRpb25zLCB3eXNpd3lnTW9kZSk7IH1cbiAgICB9XG4gICAgY2xhc3Nlc1thcl0ocGFyZW50LCAnd2stY29udGFpbmVyJyk7XG4gICAgcGFyZW50W21vdl0oZWRpdGFibGUpO1xuICAgIGlmIChwbGFjZSkgeyBwYXJlbnRbbW92XShwbGFjZSk7IH1cbiAgICBwYXJlbnRbbW92XShjb21tYW5kcyk7XG4gICAgcGFyZW50W21vdl0oc3dpdGNoYm9hcmQpO1xuICB9XG5cbiAgZnVuY3Rpb24gZGVzdHJveSAoKSB7XG4gICAgaWYgKGVkaXRvci5tb2RlICE9PSAnbWFya2Rvd24nKSB7XG4gICAgICB0ZXh0YXJlYS52YWx1ZSA9IGdldE1hcmtkb3duKCk7XG4gICAgfVxuICAgIGNsYXNzZXMucm0odGV4dGFyZWEsICd3ay1oaWRlJyk7XG4gICAgYmluZEV2ZW50cyh0cnVlKTtcbiAgICBkZWxldGUgY2FjaGVbaSAtIDFdO1xuICB9XG5cbiAgZnVuY3Rpb24gbWFya2Rvd25Nb2RlIChlKSB7IHBlcnNpc3RNb2RlKCdtYXJrZG93bicsIGUpOyB9XG4gIGZ1bmN0aW9uIGh0bWxNb2RlIChlKSB7IHBlcnNpc3RNb2RlKCdodG1sJywgZSk7IH1cbiAgZnVuY3Rpb24gd3lzaXd5Z01vZGUgKGUpIHsgcGVyc2lzdE1vZGUoJ3d5c2l3eWcnLCBlKTsgfVxuXG4gIGZ1bmN0aW9uIHBlcnNpc3RNb2RlIChuZXh0TW9kZSwgZSkge1xuICAgIHZhciByZXN0b3JlU2VsZWN0aW9uO1xuICAgIHZhciBjdXJyZW50TW9kZSA9IGVkaXRvci5tb2RlO1xuICAgIHZhciBvbGQgPSBtb2Rlc1tjdXJyZW50TW9kZV0uYnV0dG9uO1xuICAgIHZhciBidXR0b24gPSBtb2Rlc1tuZXh0TW9kZV0uYnV0dG9uO1xuICAgIHZhciBmb2N1c2luZyA9ICEhZSB8fCBkb2MuYWN0aXZlRWxlbWVudCA9PT0gdGV4dGFyZWEgfHwgZG9jLmFjdGl2ZUVsZW1lbnQgPT09IGVkaXRhYmxlO1xuXG4gICAgc3RvcChlKTtcblxuICAgIGlmIChjdXJyZW50TW9kZSA9PT0gbmV4dE1vZGUpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICByZXN0b3JlU2VsZWN0aW9uID0gZm9jdXNpbmcgJiYgcmVtZW1iZXJTZWxlY3Rpb24oaGlzdG9yeSwgbyk7XG4gICAgdGV4dGFyZWEuYmx1cigpOyAvLyBhdmVydCBjaHJvbWUgcmVwYWludCBidWdzXG5cbiAgICBpZiAobmV4dE1vZGUgPT09ICdtYXJrZG93bicpIHtcbiAgICAgIGlmIChjdXJyZW50TW9kZSA9PT0gJ2h0bWwnKSB7XG4gICAgICAgIHRleHRhcmVhLnZhbHVlID0gby5wYXJzZUhUTUwodGV4dGFyZWEudmFsdWUpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRleHRhcmVhLnZhbHVlID0gby5wYXJzZUhUTUwoZWRpdGFibGUpLnRyaW0oKTtcbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKG5leHRNb2RlID09PSAnaHRtbCcpIHtcbiAgICAgIGlmIChjdXJyZW50TW9kZSA9PT0gJ21hcmtkb3duJykge1xuICAgICAgICB0ZXh0YXJlYS52YWx1ZSA9IG8ucGFyc2VNYXJrZG93bih0ZXh0YXJlYS52YWx1ZSkudHJpbSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGV4dGFyZWEudmFsdWUgPSBlZGl0YWJsZS5pbm5lckhUTUwudHJpbSgpO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAobmV4dE1vZGUgPT09ICd3eXNpd3lnJykge1xuICAgICAgaWYgKGN1cnJlbnRNb2RlID09PSAnbWFya2Rvd24nKSB7XG4gICAgICAgIGVkaXRhYmxlLmlubmVySFRNTCA9IG8ucGFyc2VNYXJrZG93bih0ZXh0YXJlYS52YWx1ZSkucmVwbGFjZShycGFyYWdyYXBoLCAnJykudHJpbSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZWRpdGFibGUuaW5uZXJIVE1MID0gdGV4dGFyZWEudmFsdWUucmVwbGFjZShycGFyYWdyYXBoLCAnJykudHJpbSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChuZXh0TW9kZSA9PT0gJ3d5c2l3eWcnKSB7XG4gICAgICBjbGFzc2VzLmFkZCh0ZXh0YXJlYSwgJ3drLWhpZGUnKTtcbiAgICAgIGNsYXNzZXMucm0oZWRpdGFibGUsICd3ay1oaWRlJyk7XG4gICAgICBpZiAocGxhY2UpIHsgY2xhc3Nlcy5ybShwbGFjZSwgJ3drLWhpZGUnKTsgfVxuICAgICAgaWYgKGZvY3VzaW5nKSB7IHNldFRpbWVvdXQoZm9jdXNFZGl0YWJsZSwgMCk7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgY2xhc3Nlcy5ybSh0ZXh0YXJlYSwgJ3drLWhpZGUnKTtcbiAgICAgIGNsYXNzZXMuYWRkKGVkaXRhYmxlLCAnd2staGlkZScpO1xuICAgICAgaWYgKHBsYWNlKSB7IGNsYXNzZXMuYWRkKHBsYWNlLCAnd2staGlkZScpOyB9XG4gICAgICBpZiAoZm9jdXNpbmcpIHsgdGV4dGFyZWEuZm9jdXMoKTsgfVxuICAgIH1cbiAgICBjbGFzc2VzLmFkZChidXR0b24sICd3ay1tb2RlLWFjdGl2ZScpO1xuICAgIGNsYXNzZXMucm0ob2xkLCAnd2stbW9kZS1hY3RpdmUnKTtcbiAgICBjbGFzc2VzLmFkZChvbGQsICd3ay1tb2RlLWluYWN0aXZlJyk7XG4gICAgY2xhc3Nlcy5ybShidXR0b24sICd3ay1tb2RlLWluYWN0aXZlJyk7XG4gICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgnZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgICBvbGQucmVtb3ZlQXR0cmlidXRlKCdkaXNhYmxlZCcpO1xuICAgIGVkaXRvci5tb2RlID0gbmV4dE1vZGU7XG5cbiAgICBpZiAoby5zdG9yYWdlKSB7IGxzLnNldChvLnN0b3JhZ2UsIG5leHRNb2RlKTsgfVxuXG4gICAgaGlzdG9yeS5zZXRJbnB1dE1vZGUobmV4dE1vZGUpO1xuICAgIGlmIChyZXN0b3JlU2VsZWN0aW9uKSB7IHJlc3RvcmVTZWxlY3Rpb24oKTsgfVxuICAgIGZpcmVMYXRlcignd29vZm1hcmstbW9kZS1jaGFuZ2UnKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZpcmVMYXRlciAodHlwZSkge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gZmlyZSAoKSB7XG4gICAgICBjcm9zc3ZlbnQuZmFicmljYXRlKHRleHRhcmVhLCB0eXBlKTtcbiAgICB9LCAwKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIGZvY3VzRWRpdGFibGUgKCkge1xuICAgIGVkaXRhYmxlLmZvY3VzKCk7XG4gIH1cblxuICBmdW5jdGlvbiBnZXRNYXJrZG93biAoKSB7XG4gICAgaWYgKGVkaXRvci5tb2RlID09PSAnd3lzaXd5ZycpIHtcbiAgICAgIHJldHVybiBvLnBhcnNlSFRNTChlZGl0YWJsZSk7XG4gICAgfVxuICAgIGlmIChlZGl0b3IubW9kZSA9PT0gJ2h0bWwnKSB7XG4gICAgICByZXR1cm4gby5wYXJzZUhUTUwodGV4dGFyZWEudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gdGV4dGFyZWEudmFsdWU7XG4gIH1cblxuICBmdW5jdGlvbiBhZGRDb21tYW5kQnV0dG9uIChpZCwgY29tYm8sIGZuKSB7XG4gICAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPT09IDIpIHtcbiAgICAgIGZuID0gY29tYm87XG4gICAgICBjb21ibyA9IG51bGw7XG4gICAgfVxuICAgIHZhciBidXR0b24gPSB0YWcoeyB0OiAnYnV0dG9uJywgYzogJ3drLWNvbW1hbmQnLCBwOiBjb21tYW5kcyB9KTtcbiAgICB2YXIgY3VzdG9tID0gby5yZW5kZXIuY29tbWFuZHM7XG4gICAgdmFyIHJlbmRlciA9IHR5cGVvZiBjdXN0b20gPT09ICdmdW5jdGlvbicgPyBjdXN0b20gOiByZW5kZXJlcnMuY29tbWFuZHM7XG4gICAgdmFyIHRpdGxlID0gc3RyaW5ncy50aXRsZXNbaWRdO1xuICAgIGlmICh0aXRsZSkge1xuICAgICAgYnV0dG9uLnNldEF0dHJpYnV0ZSgndGl0bGUnLCBtYWMgPyBtYWNpZnkodGl0bGUpIDogdGl0bGUpO1xuICAgIH1cbiAgICBidXR0b24udHlwZSA9ICdidXR0b24nO1xuICAgIGJ1dHRvbi50YWJJbmRleCA9IC0xO1xuICAgIHJlbmRlcihidXR0b24sIGlkKTtcbiAgICBjcm9zc3ZlbnQuYWRkKGJ1dHRvbiwgJ2NsaWNrJywgZ2V0Q29tbWFuZEhhbmRsZXIoc3VyZmFjZSwgaGlzdG9yeSwgZm4pKTtcbiAgICBpZiAoY29tYm8pIHtcbiAgICAgIGFkZENvbW1hbmQoY29tYm8sIGZuKTtcbiAgICB9XG4gICAgcmV0dXJuIGJ1dHRvbjtcbiAgfVxuXG4gIGZ1bmN0aW9uIGFkZENvbW1hbmQgKGNvbWJvLCBmbikge1xuICAgIGthbnllLm9uKGNvbWJvLCBrYW55ZU9wdGlvbnMsIGdldENvbW1hbmRIYW5kbGVyKHN1cmZhY2UsIGhpc3RvcnksIGZuKSk7XG4gIH1cblxuICBmdW5jdGlvbiBydW5Db21tYW5kIChmbikge1xuICAgIGdldENvbW1hbmRIYW5kbGVyKHN1cmZhY2UsIGhpc3RvcnksIHJlYXJyYW5nZSkobnVsbCk7XG4gICAgZnVuY3Rpb24gcmVhcnJhbmdlIChlLCBtb2RlLCBjaHVua3MpIHtcbiAgICAgIHJldHVybiBmbi5jYWxsKHRoaXMsIGNodW5rcywgbW9kZSk7XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIHRhZyAob3B0aW9ucykge1xuICB2YXIgbyA9IG9wdGlvbnMgfHwge307XG4gIHZhciBlbCA9IGRvYy5jcmVhdGVFbGVtZW50KG8udCB8fCAnZGl2Jyk7XG4gIGVsLmNsYXNzTmFtZSA9IG8uYyB8fCAnJztcbiAgc2V0VGV4dChlbCwgby54IHx8ICcnKTtcbiAgaWYgKG8ucCkgeyBvLnAuYXBwZW5kQ2hpbGQoZWwpOyB9XG4gIHJldHVybiBlbDtcbn1cblxuZnVuY3Rpb24gc3RvcCAoZSkge1xuICBpZiAoZSkgeyBlLnByZXZlbnREZWZhdWx0KCk7IGUuc3RvcFByb3BhZ2F0aW9uKCk7IH1cbn1cblxuZnVuY3Rpb24gbWFjaWZ5ICh0ZXh0KSB7XG4gIHJldHVybiB0ZXh0XG4gICAgLnJlcGxhY2UoL1xcYmN0cmxcXGIvaSwgJ1xcdTIzMTgnKVxuICAgIC5yZXBsYWNlKC9cXGJhbHRcXGIvaSwgJ1xcdTIzMjUnKVxuICAgIC5yZXBsYWNlKC9cXGJzaGlmdFxcYi9pLCAnXFx1MjFlNycpO1xufVxuXG53b29mbWFyay5maW5kID0gZmluZDtcbndvb2ZtYXJrLnN0cmluZ3MgPSBzdHJpbmdzO1xud29vZm1hcmsuZ2V0U2VsZWN0aW9uID0gZ2V0U2VsZWN0aW9uO1xubW9kdWxlLmV4cG9ydHMgPSB3b29mbWFyaztcblxufSkuY2FsbCh0aGlzLHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWwgOiB0eXBlb2Ygc2VsZiAhPT0gXCJ1bmRlZmluZWRcIiA/IHNlbGYgOiB0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93IDoge30pXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247Y2hhcnNldDp1dGYtODtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSnpiM1Z5WTJWeklqcGJJbk55WXk5M2IyOW1iV0Z5YXk1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaU8wRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEVpTENKbWFXeGxJam9pWjJWdVpYSmhkR1ZrTG1weklpd2ljMjkxY21ObFVtOXZkQ0k2SWlJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYklpZDFjMlVnYzNSeWFXTjBKenRjYmx4dWRtRnlJR3h6SUQwZ2NtVnhkV2x5WlNnbmJHOWpZV3d0YzNSdmNtRm5aU2NwTzF4dWRtRnlJR055YjNOemRtVnVkQ0E5SUhKbGNYVnBjbVVvSjJOeWIzTnpkbVZ1ZENjcE8xeHVkbUZ5SUd0aGJubGxJRDBnY21WeGRXbHlaU2duYTJGdWVXVW5LVHRjYm5aaGNpQnpkSEpwYm1keklEMGdjbVZ4ZFdseVpTZ25MaTl6ZEhKcGJtZHpKeWs3WEc1MllYSWdjMlYwVkdWNGRDQTlJSEpsY1hWcGNtVW9KeTR2YzJWMFZHVjRkQ2NwTzF4dWRtRnlJR2RsZEZObGJHVmpkR2x2YmlBOUlISmxjWFZwY21Vb0p5NHZjRzlzZVdacGJHeHpMMmRsZEZObGJHVmpkR2x2YmljcE8xeHVkbUZ5SUhKbGJXVnRZbVZ5VTJWc1pXTjBhVzl1SUQwZ2NtVnhkV2x5WlNnbkxpOXlaVzFsYldKbGNsTmxiR1ZqZEdsdmJpY3BPMXh1ZG1GeUlHSnBibVJEYjIxdFlXNWtjeUE5SUhKbGNYVnBjbVVvSnk0dlltbHVaRU52YlcxaGJtUnpKeWs3WEc1MllYSWdTVzV3ZFhSSWFYTjBiM0o1SUQwZ2NtVnhkV2x5WlNnbkxpOUpibkIxZEVocGMzUnZjbmtuS1R0Y2JuWmhjaUJuWlhSRGIyMXRZVzVrU0dGdVpHeGxjaUE5SUhKbGNYVnBjbVVvSnk0dloyVjBRMjl0YldGdVpFaGhibVJzWlhJbktUdGNiblpoY2lCblpYUlRkWEptWVdObElEMGdjbVZ4ZFdseVpTZ25MaTluWlhSVGRYSm1ZV05sSnlrN1hHNTJZWElnWTJ4aGMzTmxjeUE5SUhKbGNYVnBjbVVvSnk0dlkyeGhjM05sY3ljcE8xeHVkbUZ5SUhKbGJtUmxjbVZ5Y3lBOUlISmxjWFZwY21Vb0p5NHZjbVZ1WkdWeVpYSnpKeWs3WEc1MllYSWdlR2h5VTNSMVlpQTlJSEpsY1hWcGNtVW9KeTR2ZUdoeVUzUjFZaWNwTzF4dWRtRnlJSEJ5YjIxd2RDQTlJSEpsY1hWcGNtVW9KeTR2Y0hKdmJYQjBjeTl3Y205dGNIUW5LVHRjYm5aaGNpQmpiRzl6WlZCeWIyMXdkSE1nUFNCeVpYRjFhWEpsS0NjdUwzQnliMjF3ZEhNdlkyeHZjMlVuS1R0Y2JuWmhjaUJ0YjJSbFRtRnRaWE1nUFNCYkoyMWhjbXRrYjNkdUp5d2dKMmgwYld3bkxDQW5kM2x6YVhkNVp5ZGRPMXh1ZG1GeUlHTmhZMmhsSUQwZ1cxMDdYRzUyWVhJZ2JXRmpJRDBnTDF4Y1lrMWhZeUJQVTF4Y1lpOHVkR1Z6ZENobmJHOWlZV3d1Ym1GMmFXZGhkRzl5TG5WelpYSkJaMlZ1ZENrN1hHNTJZWElnWkc5aklEMGdaRzlqZFcxbGJuUTdYRzUyWVhJZ2NuQmhjbUZuY21Gd2FDQTlJQzllUEhBK1BGeGNMM0ErWEZ4dVB5UXZhVHRjYmx4dVpuVnVZM1JwYjI0Z1ptbHVaQ0FvZEdWNGRHRnlaV0VwSUh0Y2JpQWdabTl5SUNoMllYSWdhU0E5SURBN0lHa2dQQ0JqWVdOb1pTNXNaVzVuZEdnN0lHa3JLeWtnZTF4dUlDQWdJR2xtSUNoallXTm9aVnRwWFNBbUppQmpZV05vWlZ0cFhTNTBZU0E5UFQwZ2RHVjRkR0Z5WldFcElIdGNiaUFnSUNBZ0lISmxkSFZ5YmlCallXTm9aVnRwWFM1bFpHbDBiM0k3WEc0Z0lDQWdmVnh1SUNCOVhHNGdJSEpsZEhWeWJpQnVkV3hzTzF4dWZWeHVYRzVtZFc1amRHbHZiaUIzYjI5bWJXRnlheUFvZEdWNGRHRnlaV0VzSUc5d2RHbHZibk1wSUh0Y2JpQWdkbUZ5SUdOaFkyaGxaQ0E5SUdacGJtUW9kR1Y0ZEdGeVpXRXBPMXh1SUNCcFppQW9ZMkZqYUdWa0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUdOaFkyaGxaRHRjYmlBZ2ZWeHVYRzRnSUhaaGNpQndZWEpsYm5RZ1BTQjBaWGgwWVhKbFlTNXdZWEpsYm5SRmJHVnRaVzUwTzF4dUlDQnBaaUFvY0dGeVpXNTBMbU5vYVd4a2NtVnVMbXhsYm1kMGFDQStJREVwSUh0Y2JpQWdJQ0IwYUhKdmR5QnVaWGNnUlhKeWIzSW9KM2R2YjJadFlYSnJJR1JsYldGdVpITWdQSFJsZUhSaGNtVmhQaUJsYkdWdFpXNTBjeUIwYnlCb1lYWmxJRzV2SUhOcFlteHBibWR6SnlrN1hHNGdJSDFjYmx4dUlDQjJZWElnYnlBOUlHOXdkR2x2Ym5NZ2ZId2dlMzA3WEc0Z0lHbG1JQ2h2TG0xaGNtdGtiM2R1SUQwOVBTQjJiMmxrSURBcElIc2dieTV0WVhKclpHOTNiaUE5SUhSeWRXVTdJSDFjYmlBZ2FXWWdLRzh1YUhSdGJDQTlQVDBnZG05cFpDQXdLU0I3SUc4dWFIUnRiQ0E5SUhSeWRXVTdJSDFjYmlBZ2FXWWdLRzh1ZDNsemFYZDVaeUE5UFQwZ2RtOXBaQ0F3S1NCN0lHOHVkM2x6YVhkNVp5QTlJSFJ5ZFdVN0lIMWNibHh1SUNCcFppQW9JVzh1YldGeWEyUnZkMjRnSmlZZ0lXOHVhSFJ0YkNBbUppQWhieTUzZVhOcGQzbG5LU0I3WEc0Z0lDQWdkR2h5YjNjZ2JtVjNJRVZ5Y205eUtDZDNiMjltYldGeWF5QmxlSEJsWTNSeklHRjBJR3hsWVhOMElHOXVaU0JwYm5CMWRDQnRiMlJsSUhSdklHSmxJR0YyWVdsc1lXSnNaU2NwTzF4dUlDQjlYRzVjYmlBZ2FXWWdLRzh1YUhJZ1BUMDlJSFp2YVdRZ01Da2dleUJ2TG1oeUlEMGdabUZzYzJVN0lIMWNiaUFnYVdZZ0tHOHVjM1J2Y21GblpTQTlQVDBnZG05cFpDQXdLU0I3SUc4dWMzUnZjbUZuWlNBOUlIUnlkV1U3SUgxY2JpQWdhV1lnS0c4dWMzUnZjbUZuWlNBOVBUMGdkSEoxWlNrZ2V5QnZMbk4wYjNKaFoyVWdQU0FuZDI5dlptMWhjbXRmYVc1d2RYUmZiVzlrWlNjN0lIMWNiaUFnYVdZZ0tHOHVabVZ1WTJsdVp5QTlQVDBnZG05cFpDQXdLU0I3SUc4dVptVnVZMmx1WnlBOUlIUnlkV1U3SUgxY2JpQWdhV1lnS0c4dWNtVnVaR1Z5SUQwOVBTQjJiMmxrSURBcElIc2dieTV5Wlc1a1pYSWdQU0I3ZlRzZ2ZWeHVJQ0JwWmlBb2J5NXlaVzVrWlhJdWJXOWtaWE1nUFQwOUlIWnZhV1FnTUNrZ2V5QnZMbkpsYm1SbGNpNXRiMlJsY3lBOUlIdDlPeUI5WEc0Z0lHbG1JQ2h2TG5KbGJtUmxjaTVqYjIxdFlXNWtjeUE5UFQwZ2RtOXBaQ0F3S1NCN0lHOHVjbVZ1WkdWeUxtTnZiVzFoYm1SeklEMGdlMzA3SUgxY2JpQWdhV1lnS0c4dWNISnZiWEIwY3lBOVBUMGdkbTlwWkNBd0tTQjdJRzh1Y0hKdmJYQjBjeUE5SUh0OU95QjlYRzRnSUdsbUlDaHZMbkJ5YjIxd2RITXViR2x1YXlBOVBUMGdkbTlwWkNBd0tTQjdJRzh1Y0hKdmJYQjBjeTVzYVc1cklEMGdjSEp2YlhCME95QjlYRzRnSUdsbUlDaHZMbkJ5YjIxd2RITXVhVzFoWjJVZ1BUMDlJSFp2YVdRZ01Da2dleUJ2TG5CeWIyMXdkSE11YVcxaFoyVWdQU0J3Y205dGNIUTdJSDFjYmlBZ2FXWWdLRzh1Y0hKdmJYQjBjeTVoZEhSaFkyaHRaVzUwSUQwOVBTQjJiMmxrSURBcElIc2dieTV3Y205dGNIUnpMbUYwZEdGamFHMWxiblFnUFNCd2NtOXRjSFE3SUgxY2JpQWdhV1lnS0c4dWNISnZiWEIwY3k1amJHOXpaU0E5UFQwZ2RtOXBaQ0F3S1NCN0lHOHVjSEp2YlhCMGN5NWpiRzl6WlNBOUlHTnNiM05sVUhKdmJYQjBjenNnZlZ4dUlDQnBaaUFvYnk1NGFISWdQVDA5SUhadmFXUWdNQ2tnZXlCdkxuaG9jaUE5SUhob2NsTjBkV0k3SUgxY2JpQWdhV1lnS0c4dVkyeGhjM05sY3lBOVBUMGdkbTlwWkNBd0tTQjdJRzh1WTJ4aGMzTmxjeUE5SUh0OU95QjlYRzRnSUdsbUlDaHZMbU5zWVhOelpYTXVkM2x6YVhkNVp5QTlQVDBnZG05cFpDQXdLU0I3SUc4dVkyeGhjM05sY3k1M2VYTnBkM2xuSUQwZ1cxMDdJSDFjYmlBZ2FXWWdLRzh1WTJ4aGMzTmxjeTV3Y205dGNIUnpJRDA5UFNCMmIybGtJREFwSUhzZ2J5NWpiR0Z6YzJWekxuQnliMjF3ZEhNZ1BTQjdmVHNnZlZ4dUlDQnBaaUFvYnk1amJHRnpjMlZ6TG1sdWNIVjBJRDA5UFNCMmIybGtJREFwSUhzZ2J5NWpiR0Z6YzJWekxtbHVjSFYwSUQwZ2UzMDdJSDFjYmx4dUlDQjJZWElnY0hKbFptVnlaVzVqWlNBOUlHOHVjM1J2Y21GblpTQW1KaUJzY3k1blpYUW9ieTV6ZEc5eVlXZGxLVHRjYmlBZ2FXWWdLSEJ5WldabGNtVnVZMlVwSUh0Y2JpQWdJQ0J2TG1SbFptRjFiSFJOYjJSbElEMGdjSEpsWm1WeVpXNWpaVHRjYmlBZ2ZWeHVYRzRnSUhaaGNpQnpkMmwwWTJoaWIyRnlaQ0E5SUhSaFp5aDdJR002SUNkM2F5MXpkMmwwWTJoaWIyRnlaQ2NnZlNrN1hHNGdJSFpoY2lCamIyMXRZVzVrY3lBOUlIUmhaeWg3SUdNNklDZDNheTFqYjIxdFlXNWtjeWNnZlNrN1hHNGdJSFpoY2lCbFpHbDBZV0pzWlNBOUlIUmhaeWg3SUdNNklGc25kMnN0ZDNsemFYZDVaeWNzSUNkM2F5MW9hV1JsSjEwdVkyOXVZMkYwS0c4dVkyeGhjM05sY3k1M2VYTnBkM2xuS1M1cWIybHVLQ2NnSnlrZ2ZTazdYRzRnSUhaaGNpQnpkWEptWVdObElEMGdaMlYwVTNWeVptRmpaU2gwWlhoMFlYSmxZU3dnWldScGRHRmliR1VwTzF4dUlDQjJZWElnYUdsemRHOXllU0E5SUc1bGR5QkpibkIxZEVocGMzUnZjbmtvYzNWeVptRmpaU3dnSjIxaGNtdGtiM2R1SnlrN1hHNGdJSFpoY2lCbFpHbDBiM0lnUFNCN1hHNGdJQ0FnWVdSa1EyOXRiV0Z1WkRvZ1lXUmtRMjl0YldGdVpDeGNiaUFnSUNCaFpHUkRiMjF0WVc1a1FuVjBkRzl1T2lCaFpHUkRiMjF0WVc1a1FuVjBkRzl1TEZ4dUlDQWdJSEoxYmtOdmJXMWhibVE2SUhKMWJrTnZiVzFoYm1Rc1hHNGdJQ0FnY0dGeWMyVk5ZWEpyWkc5M2Jqb2dieTV3WVhKelpVMWhjbXRrYjNkdUxGeHVJQ0FnSUhCaGNuTmxTRlJOVERvZ2J5NXdZWEp6WlVoVVRVd3NYRzRnSUNBZ1pHVnpkSEp2ZVRvZ1pHVnpkSEp2ZVN4Y2JpQWdJQ0IyWVd4MVpUb2daMlYwVFdGeWEyUnZkMjRzWEc0Z0lDQWdaV1JwZEdGaWJHVTZJRzh1ZDNsemFYZDVaeUEvSUdWa2FYUmhZbXhsSURvZ2JuVnNiQ3hjYmlBZ0lDQnpaWFJOYjJSbE9pQndaWEp6YVhOMFRXOWtaU3hjYmlBZ0lDQm9hWE4wYjNKNU9pQjdYRzRnSUNBZ0lDQjFibVJ2T2lCb2FYTjBiM0o1TG5WdVpHOHNYRzRnSUNBZ0lDQnlaV1J2T2lCb2FYTjBiM0o1TG5KbFpHOHNYRzRnSUNBZ0lDQmpZVzVWYm1Sdk9pQm9hWE4wYjNKNUxtTmhibFZ1Wkc4c1hHNGdJQ0FnSUNCallXNVNaV1J2T2lCb2FYTjBiM0o1TG1OaGJsSmxaRzljYmlBZ0lDQjlMRnh1SUNBZ0lHMXZaR1U2SUNkdFlYSnJaRzkzYmlkY2JpQWdmVHRjYmlBZ2RtRnlJR1Z1ZEhKNUlEMGdleUIwWVRvZ2RHVjRkR0Z5WldFc0lHVmthWFJ2Y2pvZ1pXUnBkRzl5SUgwN1hHNGdJSFpoY2lCcElEMGdZMkZqYUdVdWNIVnphQ2hsYm5SeWVTazdYRzRnSUhaaGNpQnJZVzU1WlVOdmJuUmxlSFFnUFNBbmQyOXZabTFoY210Zkp5QXJJR2s3WEc0Z0lIWmhjaUJyWVc1NVpVOXdkR2x2Ym5NZ1BTQjdYRzRnSUNBZ1ptbHNkR1Z5T2lCd1lYSmxiblFzWEc0Z0lDQWdZMjl1ZEdWNGREb2dhMkZ1ZVdWRGIyNTBaWGgwWEc0Z0lIMDdYRzRnSUhaaGNpQnRiMlJsY3lBOUlIdGNiaUFnSUNCdFlYSnJaRzkzYmpvZ2UxeHVJQ0FnSUNBZ1luVjBkRzl1T2lCMFlXY29leUIwT2lBblluVjBkRzl1Snl3Z1l6b2dKM2RyTFcxdlpHVWdkMnN0Ylc5a1pTMWhZM1JwZG1VbklIMHBMRnh1SUNBZ0lDQWdjMlYwT2lCdFlYSnJaRzkzYmsxdlpHVmNiaUFnSUNCOUxGeHVJQ0FnSUdoMGJXdzZJSHRjYmlBZ0lDQWdJR0oxZEhSdmJqb2dkR0ZuS0hzZ2REb2dKMkoxZEhSdmJpY3NJR002SUNkM2F5MXRiMlJsSUhkckxXMXZaR1V0YVc1aFkzUnBkbVVuSUgwcExGeHVJQ0FnSUNBZ2MyVjBPaUJvZEcxc1RXOWtaVnh1SUNBZ0lIMHNYRzRnSUNBZ2QzbHphWGQ1WnpvZ2UxeHVJQ0FnSUNBZ1luVjBkRzl1T2lCMFlXY29leUIwT2lBblluVjBkRzl1Snl3Z1l6b2dKM2RyTFcxdlpHVWdkMnN0Ylc5a1pTMXBibUZqZEdsMlpTY2dmU2tzWEc0Z0lDQWdJQ0J6WlhRNklIZDVjMmwzZVdkTmIyUmxYRzRnSUNBZ2ZWeHVJQ0I5TzF4dUlDQjJZWElnY0d4aFkyVTdYRzVjYmlBZ1pXUnBkR0ZpYkdVdVkyOXVkR1Z1ZEVWa2FYUmhZbXhsSUQwZ2RISjFaVHRjYmlBZ2JXOWtaWE11YldGeWEyUnZkMjR1WW5WMGRHOXVMbk5sZEVGMGRISnBZblYwWlNnblpHbHpZV0pzWldRbkxDQW5aR2x6WVdKc1pXUW5LVHRjYmlBZ2JXOWtaVTVoYldWekxtWnZja1ZoWTJnb1lXUmtUVzlrWlNrN1hHNWNiaUFnYVdZZ0tHOHVkM2x6YVhkNVp5a2dlMXh1SUNBZ0lIQnNZV05sSUQwZ2RHRm5LSHNnWXpvZ0ozZHJMWGQ1YzJsM2VXY3RjR3hoWTJWb2IyeGtaWElnZDJzdGFHbGtaU2NzSUhnNklIUmxlSFJoY21WaExuQnNZV05sYUc5c1pHVnlJSDBwTzF4dUlDQWdJR055YjNOemRtVnVkQzVoWkdRb2NHeGhZMlVzSUNkamJHbGpheWNzSUdadlkzVnpSV1JwZEdGaWJHVXBPMXh1SUNCOVhHNWNiaUFnYVdZZ0tHOHVaR1ZtWVhWc2RFMXZaR1VnSmlZZ2IxdHZMbVJsWm1GMWJIUk5iMlJsWFNrZ2UxeHVJQ0FnSUcxdlpHVnpXMjh1WkdWbVlYVnNkRTF2WkdWZExuTmxkQ2dwTzF4dUlDQjlJR1ZzYzJVZ2FXWWdLRzh1YldGeWEyUnZkMjRwSUh0Y2JpQWdJQ0J0YjJSbGN5NXRZWEpyWkc5M2JpNXpaWFFvS1R0Y2JpQWdmU0JsYkhObElHbG1JQ2h2TG1oMGJXd3BJSHRjYmlBZ0lDQnRiMlJsY3k1b2RHMXNMbk5sZENncE8xeHVJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lHMXZaR1Z6TG5kNWMybDNlV2N1YzJWMEtDazdYRzRnSUgxY2JseHVJQ0JpYVc1a1JYWmxiblJ6S0NrN1hHNGdJR0pwYm1SRGIyMXRZVzVrY3loemRYSm1ZV05sTENCdkxDQmxaR2wwYjNJcE8xeHVYRzRnSUhKbGRIVnliaUJsWkdsMGIzSTdYRzVjYmlBZ1puVnVZM1JwYjI0Z1lXUmtUVzlrWlNBb2FXUXBJSHRjYmlBZ0lDQjJZWElnWW5WMGRHOXVJRDBnYlc5a1pYTmJhV1JkTG1KMWRIUnZianRjYmlBZ0lDQjJZWElnWTNWemRHOXRJRDBnYnk1eVpXNWtaWEl1Ylc5a1pYTTdYRzRnSUNBZ2FXWWdLRzliYVdSZEtTQjdYRzRnSUNBZ0lDQnpkMmwwWTJoaWIyRnlaQzVoY0hCbGJtUkRhR2xzWkNoaWRYUjBiMjRwTzF4dUlDQWdJQ0FnS0hSNWNHVnZaaUJqZFhOMGIyMGdQVDA5SUNkbWRXNWpkR2x2YmljZ1B5QmpkWE4wYjIwZ09pQnlaVzVrWlhKbGNuTXViVzlrWlhNcEtHSjFkSFJ2Yml3Z2FXUXBPMXh1SUNBZ0lDQWdZM0p2YzNOMlpXNTBMbUZrWkNoaWRYUjBiMjRzSUNkamJHbGpheWNzSUcxdlpHVnpXMmxrWFM1elpYUXBPMXh1SUNBZ0lDQWdZblYwZEc5dUxuUjVjR1VnUFNBblluVjBkRzl1Snp0Y2JpQWdJQ0FnSUdKMWRIUnZiaTUwWVdKSmJtUmxlQ0E5SUMweE8xeHVYRzRnSUNBZ0lDQjJZWElnZEdsMGJHVWdQU0J6ZEhKcGJtZHpMblJwZEd4bGMxdHBaRjA3WEc0Z0lDQWdJQ0JwWmlBb2RHbDBiR1VwSUh0Y2JpQWdJQ0FnSUNBZ1luVjBkRzl1TG5ObGRFRjBkSEpwWW5WMFpTZ25kR2wwYkdVbkxDQnRZV01nUHlCdFlXTnBabmtvZEdsMGJHVXBJRG9nZEdsMGJHVXBPMXh1SUNBZ0lDQWdmVnh1SUNBZ0lIMWNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJR0pwYm1SRmRtVnVkSE1nS0hKbGJXOTJaU2tnZTF4dUlDQWdJSFpoY2lCaGNpQTlJSEpsYlc5MlpTQS9JQ2R5YlNjZ09pQW5ZV1JrSnp0Y2JpQWdJQ0IyWVhJZ2JXOTJJRDBnY21WdGIzWmxJRDhnSjNKbGJXOTJaVU5vYVd4a0p5QTZJQ2RoY0hCbGJtUkRhR2xzWkNjN1hHNGdJQ0FnYVdZZ0tISmxiVzkyWlNrZ2UxeHVJQ0FnSUNBZ2EyRnVlV1V1WTJ4bFlYSW9hMkZ1ZVdWRGIyNTBaWGgwS1R0Y2JpQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdhV1lnS0c4dWJXRnlhMlJ2ZDI0cElIc2dhMkZ1ZVdVdWIyNG9KMk50WkN0dEp5d2dhMkZ1ZVdWUGNIUnBiMjV6TENCdFlYSnJaRzkzYmsxdlpHVXBPeUI5WEc0Z0lDQWdJQ0JwWmlBb2J5NW9kRzFzS1NCN0lHdGhibmxsTG05dUtDZGpiV1FyYUNjc0lHdGhibmxsVDNCMGFXOXVjeXdnYUhSdGJFMXZaR1VwT3lCOVhHNGdJQ0FnSUNCcFppQW9ieTUzZVhOcGQzbG5LU0I3SUd0aGJubGxMbTl1S0NkamJXUXJjQ2NzSUd0aGJubGxUM0IwYVc5dWN5d2dkM2x6YVhkNVowMXZaR1VwT3lCOVhHNGdJQ0FnZlZ4dUlDQWdJR05zWVhOelpYTmJZWEpkS0hCaGNtVnVkQ3dnSjNkckxXTnZiblJoYVc1bGNpY3BPMXh1SUNBZ0lIQmhjbVZ1ZEZ0dGIzWmRLR1ZrYVhSaFlteGxLVHRjYmlBZ0lDQnBaaUFvY0d4aFkyVXBJSHNnY0dGeVpXNTBXMjF2ZGwwb2NHeGhZMlVwT3lCOVhHNGdJQ0FnY0dGeVpXNTBXMjF2ZGwwb1kyOXRiV0Z1WkhNcE8xeHVJQ0FnSUhCaGNtVnVkRnR0YjNaZEtITjNhWFJqYUdKdllYSmtLVHRjYmlBZ2ZWeHVYRzRnSUdaMWJtTjBhVzl1SUdSbGMzUnliM2tnS0NrZ2UxeHVJQ0FnSUdsbUlDaGxaR2wwYjNJdWJXOWtaU0FoUFQwZ0oyMWhjbXRrYjNkdUp5a2dlMXh1SUNBZ0lDQWdkR1Y0ZEdGeVpXRXVkbUZzZFdVZ1BTQm5aWFJOWVhKclpHOTNiaWdwTzF4dUlDQWdJSDFjYmlBZ0lDQmpiR0Z6YzJWekxuSnRLSFJsZUhSaGNtVmhMQ0FuZDJzdGFHbGtaU2NwTzF4dUlDQWdJR0pwYm1SRmRtVnVkSE1vZEhKMVpTazdYRzRnSUNBZ1pHVnNaWFJsSUdOaFkyaGxXMmtnTFNBeFhUdGNiaUFnZlZ4dVhHNGdJR1oxYm1OMGFXOXVJRzFoY210a2IzZHVUVzlrWlNBb1pTa2dleUJ3WlhKemFYTjBUVzlrWlNnbmJXRnlhMlJ2ZDI0bkxDQmxLVHNnZlZ4dUlDQm1kVzVqZEdsdmJpQm9kRzFzVFc5a1pTQW9aU2tnZXlCd1pYSnphWE4wVFc5a1pTZ25hSFJ0YkNjc0lHVXBPeUI5WEc0Z0lHWjFibU4wYVc5dUlIZDVjMmwzZVdkTmIyUmxJQ2hsS1NCN0lIQmxjbk5wYzNSTmIyUmxLQ2QzZVhOcGQzbG5KeXdnWlNrN0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCd1pYSnphWE4wVFc5a1pTQW9ibVY0ZEUxdlpHVXNJR1VwSUh0Y2JpQWdJQ0IyWVhJZ2NtVnpkRzl5WlZObGJHVmpkR2x2Ymp0Y2JpQWdJQ0IyWVhJZ1kzVnljbVZ1ZEUxdlpHVWdQU0JsWkdsMGIzSXViVzlrWlR0Y2JpQWdJQ0IyWVhJZ2IyeGtJRDBnYlc5a1pYTmJZM1Z5Y21WdWRFMXZaR1ZkTG1KMWRIUnZianRjYmlBZ0lDQjJZWElnWW5WMGRHOXVJRDBnYlc5a1pYTmJibVY0ZEUxdlpHVmRMbUoxZEhSdmJqdGNiaUFnSUNCMllYSWdabTlqZFhOcGJtY2dQU0FoSVdVZ2ZId2daRzlqTG1GamRHbDJaVVZzWlcxbGJuUWdQVDA5SUhSbGVIUmhjbVZoSUh4OElHUnZZeTVoWTNScGRtVkZiR1Z0Wlc1MElEMDlQU0JsWkdsMFlXSnNaVHRjYmx4dUlDQWdJSE4wYjNBb1pTazdYRzVjYmlBZ0lDQnBaaUFvWTNWeWNtVnVkRTF2WkdVZ1BUMDlJRzVsZUhSTmIyUmxLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNDdYRzRnSUNBZ2ZWeHVYRzRnSUNBZ2NtVnpkRzl5WlZObGJHVmpkR2x2YmlBOUlHWnZZM1Z6YVc1bklDWW1JSEpsYldWdFltVnlVMlZzWldOMGFXOXVLR2hwYzNSdmNua3NJRzhwTzF4dUlDQWdJSFJsZUhSaGNtVmhMbUpzZFhJb0tUc2dMeThnWVhabGNuUWdZMmh5YjIxbElISmxjR0ZwYm5RZ1luVm5jMXh1WEc0Z0lDQWdhV1lnS0c1bGVIUk5iMlJsSUQwOVBTQW5iV0Z5YTJSdmQyNG5LU0I3WEc0Z0lDQWdJQ0JwWmlBb1kzVnljbVZ1ZEUxdlpHVWdQVDA5SUNkb2RHMXNKeWtnZTF4dUlDQWdJQ0FnSUNCMFpYaDBZWEpsWVM1MllXeDFaU0E5SUc4dWNHRnljMlZJVkUxTUtIUmxlSFJoY21WaExuWmhiSFZsS1M1MGNtbHRLQ2s3WEc0Z0lDQWdJQ0I5SUdWc2MyVWdlMXh1SUNBZ0lDQWdJQ0IwWlhoMFlYSmxZUzUyWVd4MVpTQTlJRzh1Y0dGeWMyVklWRTFNS0dWa2FYUmhZbXhsS1M1MGNtbHRLQ2s3WEc0Z0lDQWdJQ0I5WEc0Z0lDQWdmU0JsYkhObElHbG1JQ2h1WlhoMFRXOWtaU0E5UFQwZ0oyaDBiV3duS1NCN1hHNGdJQ0FnSUNCcFppQW9ZM1Z5Y21WdWRFMXZaR1VnUFQwOUlDZHRZWEpyWkc5M2JpY3BJSHRjYmlBZ0lDQWdJQ0FnZEdWNGRHRnlaV0V1ZG1Gc2RXVWdQU0J2TG5CaGNuTmxUV0Z5YTJSdmQyNG9kR1Y0ZEdGeVpXRXVkbUZzZFdVcExuUnlhVzBvS1R0Y2JpQWdJQ0FnSUgwZ1pXeHpaU0I3WEc0Z0lDQWdJQ0FnSUhSbGVIUmhjbVZoTG5aaGJIVmxJRDBnWldScGRHRmliR1V1YVc1dVpYSklWRTFNTG5SeWFXMG9LVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlJR1ZzYzJVZ2FXWWdLRzVsZUhSTmIyUmxJRDA5UFNBbmQzbHphWGQ1WnljcElIdGNiaUFnSUNBZ0lHbG1JQ2hqZFhKeVpXNTBUVzlrWlNBOVBUMGdKMjFoY210a2IzZHVKeWtnZTF4dUlDQWdJQ0FnSUNCbFpHbDBZV0pzWlM1cGJtNWxja2hVVFV3Z1BTQnZMbkJoY25ObFRXRnlhMlJ2ZDI0b2RHVjRkR0Z5WldFdWRtRnNkV1VwTG5KbGNHeGhZMlVvY25CaGNtRm5jbUZ3YUN3Z0p5Y3BMblJ5YVcwb0tUdGNiaUFnSUNBZ0lIMGdaV3h6WlNCN1hHNGdJQ0FnSUNBZ0lHVmthWFJoWW14bExtbHVibVZ5U0ZSTlRDQTlJSFJsZUhSaGNtVmhMblpoYkhWbExuSmxjR3hoWTJVb2NuQmhjbUZuY21Gd2FDd2dKeWNwTG5SeWFXMG9LVHRjYmlBZ0lDQWdJSDFjYmlBZ0lDQjlYRzVjYmlBZ0lDQnBaaUFvYm1WNGRFMXZaR1VnUFQwOUlDZDNlWE5wZDNsbkp5a2dlMXh1SUNBZ0lDQWdZMnhoYzNObGN5NWhaR1FvZEdWNGRHRnlaV0VzSUNkM2F5MW9hV1JsSnlrN1hHNGdJQ0FnSUNCamJHRnpjMlZ6TG5KdEtHVmthWFJoWW14bExDQW5kMnN0YUdsa1pTY3BPMXh1SUNBZ0lDQWdhV1lnS0hCc1lXTmxLU0I3SUdOc1lYTnpaWE11Y20wb2NHeGhZMlVzSUNkM2F5MW9hV1JsSnlrN0lIMWNiaUFnSUNBZ0lHbG1JQ2htYjJOMWMybHVaeWtnZXlCelpYUlVhVzFsYjNWMEtHWnZZM1Z6UldScGRHRmliR1VzSURBcE95QjlYRzRnSUNBZ2ZTQmxiSE5sSUh0Y2JpQWdJQ0FnSUdOc1lYTnpaWE11Y20wb2RHVjRkR0Z5WldFc0lDZDNheTFvYVdSbEp5azdYRzRnSUNBZ0lDQmpiR0Z6YzJWekxtRmtaQ2hsWkdsMFlXSnNaU3dnSjNkckxXaHBaR1VuS1R0Y2JpQWdJQ0FnSUdsbUlDaHdiR0ZqWlNrZ2V5QmpiR0Z6YzJWekxtRmtaQ2h3YkdGalpTd2dKM2RyTFdocFpHVW5LVHNnZlZ4dUlDQWdJQ0FnYVdZZ0tHWnZZM1Z6YVc1bktTQjdJSFJsZUhSaGNtVmhMbVp2WTNWektDazdJSDFjYmlBZ0lDQjlYRzRnSUNBZ1kyeGhjM05sY3k1aFpHUW9ZblYwZEc5dUxDQW5kMnN0Ylc5a1pTMWhZM1JwZG1VbktUdGNiaUFnSUNCamJHRnpjMlZ6TG5KdEtHOXNaQ3dnSjNkckxXMXZaR1V0WVdOMGFYWmxKeWs3WEc0Z0lDQWdZMnhoYzNObGN5NWhaR1FvYjJ4a0xDQW5kMnN0Ylc5a1pTMXBibUZqZEdsMlpTY3BPMXh1SUNBZ0lHTnNZWE56WlhNdWNtMG9ZblYwZEc5dUxDQW5kMnN0Ylc5a1pTMXBibUZqZEdsMlpTY3BPMXh1SUNBZ0lHSjFkSFJ2Ymk1elpYUkJkSFJ5YVdKMWRHVW9KMlJwYzJGaWJHVmtKeXdnSjJScGMyRmliR1ZrSnlrN1hHNGdJQ0FnYjJ4a0xuSmxiVzkyWlVGMGRISnBZblYwWlNnblpHbHpZV0pzWldRbktUdGNiaUFnSUNCbFpHbDBiM0l1Ylc5a1pTQTlJRzVsZUhSTmIyUmxPMXh1WEc0Z0lDQWdhV1lnS0c4dWMzUnZjbUZuWlNrZ2V5QnNjeTV6WlhRb2J5NXpkRzl5WVdkbExDQnVaWGgwVFc5a1pTazdJSDFjYmx4dUlDQWdJR2hwYzNSdmNua3VjMlYwU1c1d2RYUk5iMlJsS0c1bGVIUk5iMlJsS1R0Y2JpQWdJQ0JwWmlBb2NtVnpkRzl5WlZObGJHVmpkR2x2YmlrZ2V5QnlaWE4wYjNKbFUyVnNaV04wYVc5dUtDazdJSDFjYmlBZ0lDQm1hWEpsVEdGMFpYSW9KM2R2YjJadFlYSnJMVzF2WkdVdFkyaGhibWRsSnlrN1hHNGdJSDFjYmx4dUlDQm1kVzVqZEdsdmJpQm1hWEpsVEdGMFpYSWdLSFI1Y0dVcElIdGNiaUFnSUNCelpYUlVhVzFsYjNWMEtHWjFibU4wYVc5dUlHWnBjbVVnS0NrZ2UxeHVJQ0FnSUNBZ1kzSnZjM04yWlc1MExtWmhZbkpwWTJGMFpTaDBaWGgwWVhKbFlTd2dkSGx3WlNrN1hHNGdJQ0FnZlN3Z01DazdYRzRnSUgxY2JseHVJQ0JtZFc1amRHbHZiaUJtYjJOMWMwVmthWFJoWW14bElDZ3BJSHRjYmlBZ0lDQmxaR2wwWVdKc1pTNW1iMk4xY3lncE8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdaMlYwVFdGeWEyUnZkMjRnS0NrZ2UxeHVJQ0FnSUdsbUlDaGxaR2wwYjNJdWJXOWtaU0E5UFQwZ0ozZDVjMmwzZVdjbktTQjdYRzRnSUNBZ0lDQnlaWFIxY200Z2J5NXdZWEp6WlVoVVRVd29aV1JwZEdGaWJHVXBPMXh1SUNBZ0lIMWNiaUFnSUNCcFppQW9aV1JwZEc5eUxtMXZaR1VnUFQwOUlDZG9kRzFzSnlrZ2UxeHVJQ0FnSUNBZ2NtVjBkWEp1SUc4dWNHRnljMlZJVkUxTUtIUmxlSFJoY21WaExuWmhiSFZsS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdjbVYwZFhKdUlIUmxlSFJoY21WaExuWmhiSFZsTzF4dUlDQjlYRzVjYmlBZ1puVnVZM1JwYjI0Z1lXUmtRMjl0YldGdVpFSjFkSFJ2YmlBb2FXUXNJR052YldKdkxDQm1iaWtnZTF4dUlDQWdJR2xtSUNoaGNtZDFiV1Z1ZEhNdWJHVnVaM1JvSUQwOVBTQXlLU0I3WEc0Z0lDQWdJQ0JtYmlBOUlHTnZiV0p2TzF4dUlDQWdJQ0FnWTI5dFltOGdQU0J1ZFd4c08xeHVJQ0FnSUgxY2JpQWdJQ0IyWVhJZ1luVjBkRzl1SUQwZ2RHRm5LSHNnZERvZ0oySjFkSFJ2Ymljc0lHTTZJQ2QzYXkxamIyMXRZVzVrSnl3Z2NEb2dZMjl0YldGdVpITWdmU2s3WEc0Z0lDQWdkbUZ5SUdOMWMzUnZiU0E5SUc4dWNtVnVaR1Z5TG1OdmJXMWhibVJ6TzF4dUlDQWdJSFpoY2lCeVpXNWtaWElnUFNCMGVYQmxiMllnWTNWemRHOXRJRDA5UFNBblpuVnVZM1JwYjI0bklEOGdZM1Z6ZEc5dElEb2djbVZ1WkdWeVpYSnpMbU52YlcxaGJtUnpPMXh1SUNBZ0lIWmhjaUIwYVhSc1pTQTlJSE4wY21sdVozTXVkR2wwYkdWelcybGtYVHRjYmlBZ0lDQnBaaUFvZEdsMGJHVXBJSHRjYmlBZ0lDQWdJR0oxZEhSdmJpNXpaWFJCZEhSeWFXSjFkR1VvSjNScGRHeGxKeXdnYldGaklEOGdiV0ZqYVdaNUtIUnBkR3hsS1NBNklIUnBkR3hsS1R0Y2JpQWdJQ0I5WEc0Z0lDQWdZblYwZEc5dUxuUjVjR1VnUFNBblluVjBkRzl1Snp0Y2JpQWdJQ0JpZFhSMGIyNHVkR0ZpU1c1a1pYZ2dQU0F0TVR0Y2JpQWdJQ0J5Wlc1a1pYSW9ZblYwZEc5dUxDQnBaQ2s3WEc0Z0lDQWdZM0p2YzNOMlpXNTBMbUZrWkNoaWRYUjBiMjRzSUNkamJHbGpheWNzSUdkbGRFTnZiVzFoYm1SSVlXNWtiR1Z5S0hOMWNtWmhZMlVzSUdocGMzUnZjbmtzSUdadUtTazdYRzRnSUNBZ2FXWWdLR052YldKdktTQjdYRzRnSUNBZ0lDQmhaR1JEYjIxdFlXNWtLR052YldKdkxDQm1iaWs3WEc0Z0lDQWdmVnh1SUNBZ0lISmxkSFZ5YmlCaWRYUjBiMjQ3WEc0Z0lIMWNibHh1SUNCbWRXNWpkR2x2YmlCaFpHUkRiMjF0WVc1a0lDaGpiMjFpYnl3Z1ptNHBJSHRjYmlBZ0lDQnJZVzU1WlM1dmJpaGpiMjFpYnl3Z2EyRnVlV1ZQY0hScGIyNXpMQ0JuWlhSRGIyMXRZVzVrU0dGdVpHeGxjaWh6ZFhKbVlXTmxMQ0JvYVhOMGIzSjVMQ0JtYmlrcE8xeHVJQ0I5WEc1Y2JpQWdablZ1WTNScGIyNGdjblZ1UTI5dGJXRnVaQ0FvWm00cElIdGNiaUFnSUNCblpYUkRiMjF0WVc1a1NHRnVaR3hsY2loemRYSm1ZV05sTENCb2FYTjBiM0o1TENCeVpXRnljbUZ1WjJVcEtHNTFiR3dwTzF4dUlDQWdJR1oxYm1OMGFXOXVJSEpsWVhKeVlXNW5aU0FvWlN3Z2JXOWtaU3dnWTJoMWJtdHpLU0I3WEc0Z0lDQWdJQ0J5WlhSMWNtNGdabTR1WTJGc2JDaDBhR2x6TENCamFIVnVhM01zSUcxdlpHVXBPMXh1SUNBZ0lIMWNiaUFnZlZ4dWZWeHVYRzVtZFc1amRHbHZiaUIwWVdjZ0tHOXdkR2x2Ym5NcElIdGNiaUFnZG1GeUlHOGdQU0J2Y0hScGIyNXpJSHg4SUh0OU8xeHVJQ0IyWVhJZ1pXd2dQU0JrYjJNdVkzSmxZWFJsUld4bGJXVnVkQ2h2TG5RZ2ZId2dKMlJwZGljcE8xeHVJQ0JsYkM1amJHRnpjMDVoYldVZ1BTQnZMbU1nZkh3Z0p5YzdYRzRnSUhObGRGUmxlSFFvWld3c0lHOHVlQ0I4ZkNBbkp5azdYRzRnSUdsbUlDaHZMbkFwSUhzZ2J5NXdMbUZ3Y0dWdVpFTm9hV3hrS0dWc0tUc2dmVnh1SUNCeVpYUjFjbTRnWld3N1hHNTlYRzVjYm1aMWJtTjBhVzl1SUhOMGIzQWdLR1VwSUh0Y2JpQWdhV1lnS0dVcElIc2daUzV3Y21WMlpXNTBSR1ZtWVhWc2RDZ3BPeUJsTG5OMGIzQlFjbTl3WVdkaGRHbHZiaWdwT3lCOVhHNTlYRzVjYm1aMWJtTjBhVzl1SUcxaFkybG1lU0FvZEdWNGRDa2dlMXh1SUNCeVpYUjFjbTRnZEdWNGRGeHVJQ0FnSUM1eVpYQnNZV05sS0M5Y1hHSmpkSEpzWEZ4aUwya3NJQ2RjWEhVeU16RTRKeWxjYmlBZ0lDQXVjbVZ3YkdGalpTZ3ZYRnhpWVd4MFhGeGlMMmtzSUNkY1hIVXlNekkxSnlsY2JpQWdJQ0F1Y21Wd2JHRmpaU2d2WEZ4aWMyaHBablJjWEdJdmFTd2dKMXhjZFRJeFpUY25LVHRjYm4xY2JseHVkMjl2Wm0xaGNtc3VabWx1WkNBOUlHWnBibVE3WEc1M2IyOW1iV0Z5YXk1emRISnBibWR6SUQwZ2MzUnlhVzVuY3p0Y2JuZHZiMlp0WVhKckxtZGxkRk5sYkdWamRHbHZiaUE5SUdkbGRGTmxiR1ZqZEdsdmJqdGNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdkMjl2Wm0xaGNtczdYRzRpWFgwPSIsIid1c2Ugc3RyaWN0JztcblxuZnVuY3Rpb24geGhyU3R1YiAob3B0aW9ucykge1xuICB0aHJvdyBuZXcgRXJyb3IoJ1dvb2ZtYXJrIGlzIG1pc3NpbmcgWEhSIGNvbmZpZ3VyYXRpb24uIENhblxcJ3QgcmVxdWVzdCAnICsgb3B0aW9ucy51cmwpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHhoclN0dWI7XG4iXX0=
