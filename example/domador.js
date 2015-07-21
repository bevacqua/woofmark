!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.domador=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var replacements = {
  '\\\\': '\\\\',
  '\\[': '\\[',
  '\\]': '\\]',
  '>': '\\>',
  '_': '\\_',
  '\\*': '\\*',
  '`': '\\`',
  '#': '\\#',
  '([0-9])\\.(\\s|$)': '$1\\.$2',
  '\u00a9': '(c)',
  '\u00ae': '(r)',
  '\u2122': '(tm)',
  '\u00a0': ' ',
  '\u00b7': '\\*',
  '\u2002': ' ',
  '\u2003': ' ',
  '\u2009': ' ',
  '\u2018': '\'',
  '\u2019': '\'',
  '\u201c': '"',
  '\u201d': '"',
  '\u2026': '...',
  '\u2013': '--',
  '\u2014': '---'
};
var replacers = Object.keys(replacements).reduce(replacer, {});
var rspaces = /^\s+|\s+$/g;
var rdisplay = /(display|visibility)\s*:\s*[a-z]+/gi;
var rhidden = /(none|hidden)\s*$/i;
var rheading = /^H([1-6])$/;
var shallowTags = [
  'APPLET', 'AREA', 'AUDIO', 'BUTTON', 'CANVAS', 'DATALIST', 'EMBED', 'HEAD', 'INPUT', 'MAP',
  'MENU', 'METER', 'NOFRAMES', 'NOSCRIPT', 'OBJECT', 'OPTGROUP', 'OPTION', 'PARAM', 'PROGRESS',
  'RP', 'RT', 'RUBY', 'SCRIPT', 'SELECT', 'STYLE', 'TEXTAREA', 'TITLE', 'VIDEO'
];
var paragraphTags = [
  'ADDRESS', 'ARTICLE', 'ASIDE', 'DIV', 'FIELDSET', 'FOOTER', 'HEADER', 'NAV', 'P', 'SECTION'
];
var windowContext = require('./virtualWindowContext');

function replacer (result, key) {
  result[key] = new RegExp(key, 'g'); return result;
}

function many (text, times) {
  return new Array(times + 1).join(text);
}

function padLeft (text, times) {
  return many(' ', times) + text;
}

function trim (text) {
  if (text.trim) {
    return text.trim();
  }
  return text.replace(rspaces, '');
}

function attr (el, prop, direct) {
  var proper = direct === void 0 || direct;
  if (proper || typeof el.getAttribute !== 'function') {
    return el[prop] || '';
  }
  return el.getAttribute(prop) || '';
}

function has (el, prop, direct) {
  var proper = direct === void 0 || direct;
  if (proper || typeof el.hasAttribute !== 'function') {
    return el.hasOwnProperty(prop);
  }
  return el.hasAttribute(prop);
}

function isVisible (el) {
  var display;
  var i;
  var property;
  var visibility;
  var visible = true;
  var style = attr(el, 'style', false);
  var properties = style != null ? typeof style.match === 'function' ? style.match(rdisplay) : void 0 : void 0;
  if (properties != null) {
    for (i = 0; i < properties.length; i++) {
      property = properties[i];
      visible = !rhidden.test(property);
    }
  }
  if (visible && typeof windowContext.getComputedStyle === 'function') {
    try {
      style = windowContext.getComputedStyle(el, null);
      if (typeof (style != null ? style.getPropertyValue : void 0) === 'function') {
        display = style.getPropertyValue('display');
        visibility = style.getPropertyValue('visibility');
        visible = display !== 'none' && visibility !== 'hidden';
      }
    } catch (err) {
    }
  }
  return visible;
}

function processPlainText (text, tagName) {
  var key;
  var block = paragraphTags.indexOf(tagName) !== -1 || tagName === 'BLOCKQUOTE';
  text = text.replace(/\n([ \t]*\n)+/g, '\n');
  text = text.replace(/\n[ \t]+/g, '\n');
  text = text.replace(/[ \t]+/g, ' ');
  for (key in replacements) {
    text = text.replace(replacers[key], replacements[key]);
  }
  text = text.replace(/(\s*)\\#/g, block ? removeUnnecessaryEscapes : '$1#');
  return text;

  function removeUnnecessaryEscapes (escaped, spaces, i) {
    return i ? spaces + '#' : escaped;
  }
}

function processCode (text) {
  return text.replace(/`/g, '\\`');
}

function noop () {}

function parse (html, options) {
  return new Domador(html, options).parse();
}

function Domador (html, options) {
  this.html = html != null ? html : '';
  this.options = options || {};
  this.atLeft = this.noTrailingWhitespace = this.atP = true;
  this.buffer = '';
  this.exceptions = [];
  this.order = 1;
  this.listDepth = 0;
  this.inCode = this.inPre = this.inOrderedList = false;
  this.last = null;
  this.left = '\n';
  this.links = [];
  this.linkMap = {};
  this.unhandled = {};
  if (this.options.absolute === void 0) { this.options.absolute = false; }
  if (this.options.fencing === void 0) { this.options.fencing = false; }
  if (this.options.fencinglanguage === void 0) { this.options.fencinglanguage = noop; }
  if (this.options.transform === void 0) { this.options.transform = noop; }
}

Domador.prototype.append = function (text) {
  if (this.last != null) {
    this.buffer += this.last;
  }
  return this.last = text;
};

Domador.prototype.br = function () {
  this.append('  ' +  this.left);
  return this.atLeft = this.noTrailingWhitespace = true;
};

Domador.prototype.code = function () {
  var old;
  old = this.inCode;
  this.inCode = true;
  return (function(_this) {
    return function() {
      return _this.inCode = old;
    };
  })(this);
};

Domador.prototype.li = function () {
  var result;
  result = this.inOrderedList ? (this.order++) + '. ' : '* ';
  result = padLeft(result, (this.listDepth - 1) * 2);
  return this.append(result);
};

Domador.prototype.ol = function () {
  var inOrderedList, order;
  if (this.listDepth === 0) {
    this.p();
  }
  inOrderedList = this.inOrderedList;
  order = this.order;
  this.inOrderedList = true;
  this.order = 1;
  this.listDepth++;
  return (function(_this) {
    return function() {
      _this.inOrderedList = inOrderedList;
      _this.order = order;
      return _this.listDepth--;
    };
  })(this);
};

Domador.prototype.output = function (text) {
  if (!text) {
    return;
  }
  if (!this.inPre) {
    text = this.noTrailingWhitespace ? text.replace(/^[ \t\n]+/, '') : /^[ \t]*\n/.test(text) ? text.replace(/^[ \t\n]+/, '\n') : text.replace(/^[ \t]+/, ' ');
  }
  if (text === '') {
    return;
  }
  this.atP = /\n\n$/.test(text);
  this.atLeft = /\n$/.test(text);
  this.noTrailingWhitespace = /[ \t\n]$/.test(text);
  return this.append(text.replace(/\n/g, this.left));
};

Domador.prototype.outputLater = function (text) {
  return (function(self) {
    return function () {
      return self.output(text);
    };
  })(this);
};

Domador.prototype.p = function () {
  if (this.atP) {
    return;
  }
  if (this.startingBlockquote) {
    this.append('\n');
  } else {
    this.append(this.left);
  }
  if (!this.atLeft) {
    this.append(this.left);
    this.atLeft = true;
  }
  return this.noTrailingWhitespace = this.atP = true;
};

Domador.prototype.parse = function () {
  var container;
  var i;
  var link;
  var ref;
  this.buffer = '';
  if (!this.html) {
    return this.buffer;
  }
  if (typeof this.html === 'string') {
    container = windowContext.document.createElement('div');
    container.innerHTML = this.html;
  } else {
    container = this.html;
  }
  this.process(container);
  if (this.links.length) {
    while (this.lastElement.parentElement !== container && this.lastElement.tagName !== 'BLOCKQUOTE') {
      this.lastElement = this.lastElement.parentElement;
    }
    if (this.lastElement.tagName !== 'BLOCKQUOTE') {
      this.append('\n\n');
    }
    ref = this.links;
    for (i = 0; i < ref.length; i++) {
      link = ref[i];
      if (link) {
        this.append('[' + (i + 1) + ']: ' + link + '\n');
      }
    }
  }
  this.append('');
  return this.buffer = trim(this.buffer);
};

Domador.prototype.pre = function () {
  var old;
  old = this.inPre;
  this.inPre = true;
  return (function(_this) {
    return function() {
      return _this.inPre = old;
    };
  })(this);
};

Domador.prototype.htmlTag = function (type) {
  this.output('<' + type + '>');
  return this.outputLater('</' + type + '>');
};

Domador.prototype.process = function (el) {
  var after;
  var after1;
  var after2;
  var base;
  var href;
  var i;
  var ref;
  var suffix;
  var summary;
  var title;

  if (!isVisible(el)) {
    return;
  }

  if (el.nodeType === windowContext.Node.TEXT_NODE) {
    if (el.nodeValue.replace(/\n/g, '').length === 0) {
      return;
    }
    if (this.inPre) {
      return this.output(el.nodeValue);
    }
    if (this.inCode) {
      return this.output(processCode(el.nodeValue));
    }
    return this.output(processPlainText(el.nodeValue, el.parentElement && el.parentElement.tagName));
  }

  if (el.nodeType !== windowContext.Node.ELEMENT_NODE) {
    return;
  }

  this.lastElement = el;

  var transformed = this.options.transform(el);
  if (transformed !== void 0) {
    return this.output(transformed);
  }
  if (shallowTags.indexOf(el.tagName) !== -1) {
    return;
  }

  switch (el.tagName) {
    case 'H1':
    case 'H2':
    case 'H3':
    case 'H4':
    case 'H5':
    case 'H6':
      this.p();
      this.output(many('#', parseInt(el.tagName.match(rheading)[1])) + ' ');
      break;
    case 'ADDRESS':
    case 'ARTICLE':
    case 'ASIDE':
    case 'DIV':
    case 'FIELDSET':
    case 'FOOTER':
    case 'HEADER':
    case 'NAV':
    case 'P':
    case 'SECTION':
      this.p();
      break;
    case 'BODY':
    case 'FORM':
      break;
    case 'DETAILS':
      this.p();
      if (!has(el, 'open', false)) {
        summary = el.getElementsByTagName('summary')[0];
        if (summary) {
          this.process(summary);
        }
        return;
      }
      break;
    case 'BR':
      this.br();
      break;
    case 'HR':
      this.p();
      this.output('---------');
      this.p();
      break;
    case 'CITE':
    case 'DFN':
    case 'EM':
    case 'I':
    case 'U':
    case 'VAR':
      this.output('_');
      this.noTrailingWhitespace = true;
      after = this.outputLater('_');
      break;
    case 'DT':
    case 'B':
    case 'STRONG':
      if (el.tagName === 'DT') {
        this.p();
      }
      this.output('**');
      this.noTrailingWhitespace = true;
      after = this.outputLater('**');
      break;
    case 'Q':
      this.output('"');
      this.noTrailingWhitespace = true;
      after = this.outputLater('"');
      break;
    case 'OL':
      after = this.ol();
      break;
    case 'UL':
      after = this.ul();
      break;
    case 'LI':
      this.replaceLeft('\n');
      this.li();
      break;
    case 'PRE':
      if (this.options.fencing) {
        this.append('\n\n');
        this.output(['```', '\n'].join(this.options.fencinglanguage(el) || ''));
        after1 = this.pre();
        after2 = this.outputLater('\n```');
      } else {
        after1 = this.pushLeft('    ');
        after2 = this.pre();
      }
      after = function() {
        after1();
        return after2();
      };
      break;
    case 'CODE':
    case 'SAMP':
      if (this.inPre) {
        break;
      }
      this.output('`');
      after1 = this.code();
      after2 = this.outputLater('`');
      after = function() {
        after1();
        return after2();
      };
      break;
    case 'BLOCKQUOTE':
    case 'DD':
      this.startingBlockquote = true;
      after = this.pushLeft('> ');
      this.startingBlockquote = false;
      break;
    case 'KBD':
      after = this.htmlTag('kbd');
      break;
    case 'A':
    case 'IMG':
      href = attr(el, el.tagName === 'A' ? 'href' : 'src', this.options.absolute);
      if (!href) {
        break;
      }
      title = attr(el, 'title');
      if (title) {
        href += ' "' + title + '"';
      }
      if (this.options.inline) {
        suffix = '(' + href + ')';
      } else {
        suffix = '[' + ((base = this.linkMap)[href] != null ? base[href] : base[href] = this.links.push(href)) + ']';
      }
      if (el.tagName === 'IMG') {
        this.output('![' + attr(el, 'alt') + ']' + suffix);
        return;
      }
      this.output('[');
      this.noTrailingWhitespace = true;
      after = this.outputLater(']' + suffix);
      break;
    case 'FRAME':
    case 'IFRAME':
      try {
        if ((ref = el.contentDocument) != null ? ref.documentElement : void 0) {
          this.process(el.contentDocument.documentElement);
        }
      } catch (err) {
      }
      return;
    case 'TR':
      after = this.p;
      break;
  }

  for (i = 0; i < el.childNodes.length; i++) {
    this.process(el.childNodes[i]);
  }

  if (after) {
    return after.call(this);
  }
};

Domador.prototype.pushLeft = function (text) {
  var old;
  old = this.left;
  this.left += text;
  if (this.atP) {
    this.append(text);
  } else {
    this.p();
  }
  return (function(_this) {
    return function() {
      _this.left = old;
      _this.atLeft = _this.atP = false;
      return _this.p();
    };
  })(this);
};

Domador.prototype.replaceLeft = function (text) {
  if (!this.atLeft) {
    this.append(this.left.replace(/[ ]{2,4}$/, text));
    return this.atLeft = this.noTrailingWhitespace = this.atP = true;
  } else if (this.last) {
    return this.last = this.last.replace(/[ ]{2,4}$/, text);
  }
};

Domador.prototype.ul = function () {
  var inOrderedList, order;
  if (this.listDepth === 0) {
    this.p();
  }
  inOrderedList = this.inOrderedList;
  order = this.order;
  this.inOrderedList = false;
  this.order = 1;
  this.listDepth++;
  return (function(_this) {
    return function() {
      _this.inOrderedList = inOrderedList;
      _this.order = order;
      return _this.listDepth--;
    };
  })(this);
};

module.exports = parse;

},{"./virtualWindowContext":2}],2:[function(require,module,exports){
'use strict';

module.exports = window;

if (!window.Node) {
  window.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
  };
}

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkb21hZG9yLmpzIiwid2luZG93Q29udGV4dC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaGlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxudmFyIHJlcGxhY2VtZW50cyA9IHtcbiAgJ1xcXFxcXFxcJzogJ1xcXFxcXFxcJyxcbiAgJ1xcXFxbJzogJ1xcXFxbJyxcbiAgJ1xcXFxdJzogJ1xcXFxdJyxcbiAgJz4nOiAnXFxcXD4nLFxuICAnXyc6ICdcXFxcXycsXG4gICdcXFxcKic6ICdcXFxcKicsXG4gICdgJzogJ1xcXFxgJyxcbiAgJyMnOiAnXFxcXCMnLFxuICAnKFswLTldKVxcXFwuKFxcXFxzfCQpJzogJyQxXFxcXC4kMicsXG4gICdcXHUwMGE5JzogJyhjKScsXG4gICdcXHUwMGFlJzogJyhyKScsXG4gICdcXHUyMTIyJzogJyh0bSknLFxuICAnXFx1MDBhMCc6ICcgJyxcbiAgJ1xcdTAwYjcnOiAnXFxcXConLFxuICAnXFx1MjAwMic6ICcgJyxcbiAgJ1xcdTIwMDMnOiAnICcsXG4gICdcXHUyMDA5JzogJyAnLFxuICAnXFx1MjAxOCc6ICdcXCcnLFxuICAnXFx1MjAxOSc6ICdcXCcnLFxuICAnXFx1MjAxYyc6ICdcIicsXG4gICdcXHUyMDFkJzogJ1wiJyxcbiAgJ1xcdTIwMjYnOiAnLi4uJyxcbiAgJ1xcdTIwMTMnOiAnLS0nLFxuICAnXFx1MjAxNCc6ICctLS0nXG59O1xudmFyIHJlcGxhY2VycyA9IE9iamVjdC5rZXlzKHJlcGxhY2VtZW50cykucmVkdWNlKHJlcGxhY2VyLCB7fSk7XG52YXIgcnNwYWNlcyA9IC9eXFxzK3xcXHMrJC9nO1xudmFyIHJkaXNwbGF5ID0gLyhkaXNwbGF5fHZpc2liaWxpdHkpXFxzKjpcXHMqW2Etel0rL2dpO1xudmFyIHJoaWRkZW4gPSAvKG5vbmV8aGlkZGVuKVxccyokL2k7XG52YXIgcmhlYWRpbmcgPSAvXkgoWzEtNl0pJC87XG52YXIgc2hhbGxvd1RhZ3MgPSBbXG4gICdBUFBMRVQnLCAnQVJFQScsICdBVURJTycsICdCVVRUT04nLCAnQ0FOVkFTJywgJ0RBVEFMSVNUJywgJ0VNQkVEJywgJ0hFQUQnLCAnSU5QVVQnLCAnTUFQJyxcbiAgJ01FTlUnLCAnTUVURVInLCAnTk9GUkFNRVMnLCAnTk9TQ1JJUFQnLCAnT0JKRUNUJywgJ09QVEdST1VQJywgJ09QVElPTicsICdQQVJBTScsICdQUk9HUkVTUycsXG4gICdSUCcsICdSVCcsICdSVUJZJywgJ1NDUklQVCcsICdTRUxFQ1QnLCAnU1RZTEUnLCAnVEVYVEFSRUEnLCAnVElUTEUnLCAnVklERU8nXG5dO1xudmFyIHBhcmFncmFwaFRhZ3MgPSBbXG4gICdBRERSRVNTJywgJ0FSVElDTEUnLCAnQVNJREUnLCAnRElWJywgJ0ZJRUxEU0VUJywgJ0ZPT1RFUicsICdIRUFERVInLCAnTkFWJywgJ1AnLCAnU0VDVElPTidcbl07XG52YXIgd2luZG93Q29udGV4dCA9IHJlcXVpcmUoJy4vdmlydHVhbFdpbmRvd0NvbnRleHQnKTtcblxuZnVuY3Rpb24gcmVwbGFjZXIgKHJlc3VsdCwga2V5KSB7XG4gIHJlc3VsdFtrZXldID0gbmV3IFJlZ0V4cChrZXksICdnJyk7IHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIG1hbnkgKHRleHQsIHRpbWVzKSB7XG4gIHJldHVybiBuZXcgQXJyYXkodGltZXMgKyAxKS5qb2luKHRleHQpO1xufVxuXG5mdW5jdGlvbiBwYWRMZWZ0ICh0ZXh0LCB0aW1lcykge1xuICByZXR1cm4gbWFueSgnICcsIHRpbWVzKSArIHRleHQ7XG59XG5cbmZ1bmN0aW9uIHRyaW0gKHRleHQpIHtcbiAgaWYgKHRleHQudHJpbSkge1xuICAgIHJldHVybiB0ZXh0LnRyaW0oKTtcbiAgfVxuICByZXR1cm4gdGV4dC5yZXBsYWNlKHJzcGFjZXMsICcnKTtcbn1cblxuZnVuY3Rpb24gYXR0ciAoZWwsIHByb3AsIGRpcmVjdCkge1xuICB2YXIgcHJvcGVyID0gZGlyZWN0ID09PSB2b2lkIDAgfHwgZGlyZWN0O1xuICBpZiAocHJvcGVyIHx8IHR5cGVvZiBlbC5nZXRBdHRyaWJ1dGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZWxbcHJvcF0gfHwgJyc7XG4gIH1cbiAgcmV0dXJuIGVsLmdldEF0dHJpYnV0ZShwcm9wKSB8fCAnJztcbn1cblxuZnVuY3Rpb24gaGFzIChlbCwgcHJvcCwgZGlyZWN0KSB7XG4gIHZhciBwcm9wZXIgPSBkaXJlY3QgPT09IHZvaWQgMCB8fCBkaXJlY3Q7XG4gIGlmIChwcm9wZXIgfHwgdHlwZW9mIGVsLmhhc0F0dHJpYnV0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBlbC5oYXNPd25Qcm9wZXJ0eShwcm9wKTtcbiAgfVxuICByZXR1cm4gZWwuaGFzQXR0cmlidXRlKHByb3ApO1xufVxuXG5mdW5jdGlvbiBpc1Zpc2libGUgKGVsKSB7XG4gIHZhciBkaXNwbGF5O1xuICB2YXIgaTtcbiAgdmFyIHByb3BlcnR5O1xuICB2YXIgdmlzaWJpbGl0eTtcbiAgdmFyIHZpc2libGUgPSB0cnVlO1xuICB2YXIgc3R5bGUgPSBhdHRyKGVsLCAnc3R5bGUnLCBmYWxzZSk7XG4gIHZhciBwcm9wZXJ0aWVzID0gc3R5bGUgIT0gbnVsbCA/IHR5cGVvZiBzdHlsZS5tYXRjaCA9PT0gJ2Z1bmN0aW9uJyA/IHN0eWxlLm1hdGNoKHJkaXNwbGF5KSA6IHZvaWQgMCA6IHZvaWQgMDtcbiAgaWYgKHByb3BlcnRpZXMgIT0gbnVsbCkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9wZXJ0eSA9IHByb3BlcnRpZXNbaV07XG4gICAgICB2aXNpYmxlID0gIXJoaWRkZW4udGVzdChwcm9wZXJ0eSk7XG4gICAgfVxuICB9XG4gIGlmICh2aXNpYmxlICYmIHR5cGVvZiB3aW5kb3dDb250ZXh0LmdldENvbXB1dGVkU3R5bGUgPT09ICdmdW5jdGlvbicpIHtcbiAgICB0cnkge1xuICAgICAgc3R5bGUgPSB3aW5kb3dDb250ZXh0LmdldENvbXB1dGVkU3R5bGUoZWwsIG51bGwpO1xuICAgICAgaWYgKHR5cGVvZiAoc3R5bGUgIT0gbnVsbCA/IHN0eWxlLmdldFByb3BlcnR5VmFsdWUgOiB2b2lkIDApID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGRpc3BsYXkgPSBzdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdkaXNwbGF5Jyk7XG4gICAgICAgIHZpc2liaWxpdHkgPSBzdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCd2aXNpYmlsaXR5Jyk7XG4gICAgICAgIHZpc2libGUgPSBkaXNwbGF5ICE9PSAnbm9uZScgJiYgdmlzaWJpbGl0eSAhPT0gJ2hpZGRlbic7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgfVxuICB9XG4gIHJldHVybiB2aXNpYmxlO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzUGxhaW5UZXh0ICh0ZXh0LCB0YWdOYW1lKSB7XG4gIHZhciBrZXk7XG4gIHZhciBibG9jayA9IHBhcmFncmFwaFRhZ3MuaW5kZXhPZih0YWdOYW1lKSAhPT0gLTEgfHwgdGFnTmFtZSA9PT0gJ0JMT0NLUVVPVEUnO1xuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC9cXG4oWyBcXHRdKlxcbikrL2csICdcXG4nKTtcbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvXFxuWyBcXHRdKy9nLCAnXFxuJyk7XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoL1sgXFx0XSsvZywgJyAnKTtcbiAgZm9yIChrZXkgaW4gcmVwbGFjZW1lbnRzKSB7XG4gICAgdGV4dCA9IHRleHQucmVwbGFjZShyZXBsYWNlcnNba2V5XSwgcmVwbGFjZW1lbnRzW2tleV0pO1xuICB9XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoLyhcXHMqKVxcXFwjL2csIGJsb2NrID8gcmVtb3ZlVW5uZWNlc3NhcnlFc2NhcGVzIDogJyQxIycpO1xuICByZXR1cm4gdGV4dDtcblxuICBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeUVzY2FwZXMgKGVzY2FwZWQsIHNwYWNlcywgaSkge1xuICAgIHJldHVybiBpID8gc3BhY2VzICsgJyMnIDogZXNjYXBlZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzQ29kZSAodGV4dCkge1xuICByZXR1cm4gdGV4dC5yZXBsYWNlKC9gL2csICdcXFxcYCcpO1xufVxuXG5mdW5jdGlvbiBub29wICgpIHt9XG5cbmZ1bmN0aW9uIHBhcnNlIChodG1sLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgRG9tYWRvcihodG1sLCBvcHRpb25zKS5wYXJzZSgpO1xufVxuXG5mdW5jdGlvbiBEb21hZG9yIChodG1sLCBvcHRpb25zKSB7XG4gIHRoaXMuaHRtbCA9IGh0bWwgIT0gbnVsbCA/IGh0bWwgOiAnJztcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdGhpcy5hdExlZnQgPSB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdGhpcy5hdFAgPSB0cnVlO1xuICB0aGlzLmJ1ZmZlciA9ICcnO1xuICB0aGlzLmV4Y2VwdGlvbnMgPSBbXTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoID0gMDtcbiAgdGhpcy5pbkNvZGUgPSB0aGlzLmluUHJlID0gdGhpcy5pbk9yZGVyZWRMaXN0ID0gZmFsc2U7XG4gIHRoaXMubGFzdCA9IG51bGw7XG4gIHRoaXMubGVmdCA9ICdcXG4nO1xuICB0aGlzLmxpbmtzID0gW107XG4gIHRoaXMubGlua01hcCA9IHt9O1xuICB0aGlzLnVuaGFuZGxlZCA9IHt9O1xuICBpZiAodGhpcy5vcHRpb25zLmFic29sdXRlID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLmFic29sdXRlID0gZmFsc2U7IH1cbiAgaWYgKHRoaXMub3B0aW9ucy5mZW5jaW5nID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLmZlbmNpbmcgPSBmYWxzZTsgfVxuICBpZiAodGhpcy5vcHRpb25zLmZlbmNpbmdsYW5ndWFnZSA9PT0gdm9pZCAwKSB7IHRoaXMub3B0aW9ucy5mZW5jaW5nbGFuZ3VhZ2UgPSBub29wOyB9XG4gIGlmICh0aGlzLm9wdGlvbnMudHJhbnNmb3JtID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLnRyYW5zZm9ybSA9IG5vb3A7IH1cbn1cblxuRG9tYWRvci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgaWYgKHRoaXMubGFzdCAhPSBudWxsKSB7XG4gICAgdGhpcy5idWZmZXIgKz0gdGhpcy5sYXN0O1xuICB9XG4gIHJldHVybiB0aGlzLmxhc3QgPSB0ZXh0O1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUuYnIgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuYXBwZW5kKCcgICcgKyAgdGhpcy5sZWZ0KTtcbiAgcmV0dXJuIHRoaXMuYXRMZWZ0ID0gdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5jb2RlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb2xkO1xuICBvbGQgPSB0aGlzLmluQ29kZTtcbiAgdGhpcy5pbkNvZGUgPSB0cnVlO1xuICByZXR1cm4gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIF90aGlzLmluQ29kZSA9IG9sZDtcbiAgICB9O1xuICB9KSh0aGlzKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLmxpID0gZnVuY3Rpb24gKCkge1xuICB2YXIgcmVzdWx0O1xuICByZXN1bHQgPSB0aGlzLmluT3JkZXJlZExpc3QgPyAodGhpcy5vcmRlcisrKSArICcuICcgOiAnKiAnO1xuICByZXN1bHQgPSBwYWRMZWZ0KHJlc3VsdCwgKHRoaXMubGlzdERlcHRoIC0gMSkgKiAyKTtcbiAgcmV0dXJuIHRoaXMuYXBwZW5kKHJlc3VsdCk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5vbCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGluT3JkZXJlZExpc3QsIG9yZGVyO1xuICBpZiAodGhpcy5saXN0RGVwdGggPT09IDApIHtcbiAgICB0aGlzLnAoKTtcbiAgfVxuICBpbk9yZGVyZWRMaXN0ID0gdGhpcy5pbk9yZGVyZWRMaXN0O1xuICBvcmRlciA9IHRoaXMub3JkZXI7XG4gIHRoaXMuaW5PcmRlcmVkTGlzdCA9IHRydWU7XG4gIHRoaXMub3JkZXIgPSAxO1xuICB0aGlzLmxpc3REZXB0aCsrO1xuICByZXR1cm4gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgX3RoaXMuaW5PcmRlcmVkTGlzdCA9IGluT3JkZXJlZExpc3Q7XG4gICAgICBfdGhpcy5vcmRlciA9IG9yZGVyO1xuICAgICAgcmV0dXJuIF90aGlzLmxpc3REZXB0aC0tO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUub3V0cHV0ID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgaWYgKCF0ZXh0KSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghdGhpcy5pblByZSkge1xuICAgIHRleHQgPSB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID8gdGV4dC5yZXBsYWNlKC9eWyBcXHRcXG5dKy8sICcnKSA6IC9eWyBcXHRdKlxcbi8udGVzdCh0ZXh0KSA/IHRleHQucmVwbGFjZSgvXlsgXFx0XFxuXSsvLCAnXFxuJykgOiB0ZXh0LnJlcGxhY2UoL15bIFxcdF0rLywgJyAnKTtcbiAgfVxuICBpZiAodGV4dCA9PT0gJycpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdGhpcy5hdFAgPSAvXFxuXFxuJC8udGVzdCh0ZXh0KTtcbiAgdGhpcy5hdExlZnQgPSAvXFxuJC8udGVzdCh0ZXh0KTtcbiAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IC9bIFxcdFxcbl0kLy50ZXN0KHRleHQpO1xuICByZXR1cm4gdGhpcy5hcHBlbmQodGV4dC5yZXBsYWNlKC9cXG4vZywgdGhpcy5sZWZ0KSk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5vdXRwdXRMYXRlciA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gIHJldHVybiAoZnVuY3Rpb24oc2VsZikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gc2VsZi5vdXRwdXQodGV4dCk7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5wID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5hdFApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHRoaXMuc3RhcnRpbmdCbG9ja3F1b3RlKSB7XG4gICAgdGhpcy5hcHBlbmQoJ1xcbicpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuYXBwZW5kKHRoaXMubGVmdCk7XG4gIH1cbiAgaWYgKCF0aGlzLmF0TGVmdCkge1xuICAgIHRoaXMuYXBwZW5kKHRoaXMubGVmdCk7XG4gICAgdGhpcy5hdExlZnQgPSB0cnVlO1xuICB9XG4gIHJldHVybiB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdGhpcy5hdFAgPSB0cnVlO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBjb250YWluZXI7XG4gIHZhciBpO1xuICB2YXIgbGluaztcbiAgdmFyIHJlZjtcbiAgdGhpcy5idWZmZXIgPSAnJztcbiAgaWYgKCF0aGlzLmh0bWwpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXI7XG4gIH1cbiAgaWYgKHR5cGVvZiB0aGlzLmh0bWwgPT09ICdzdHJpbmcnKSB7XG4gICAgY29udGFpbmVyID0gd2luZG93Q29udGV4dC5kb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgICBjb250YWluZXIuaW5uZXJIVE1MID0gdGhpcy5odG1sO1xuICB9IGVsc2Uge1xuICAgIGNvbnRhaW5lciA9IHRoaXMuaHRtbDtcbiAgfVxuICB0aGlzLnByb2Nlc3MoY29udGFpbmVyKTtcbiAgaWYgKHRoaXMubGlua3MubGVuZ3RoKSB7XG4gICAgd2hpbGUgKHRoaXMubGFzdEVsZW1lbnQucGFyZW50RWxlbWVudCAhPT0gY29udGFpbmVyICYmIHRoaXMubGFzdEVsZW1lbnQudGFnTmFtZSAhPT0gJ0JMT0NLUVVPVEUnKSB7XG4gICAgICB0aGlzLmxhc3RFbGVtZW50ID0gdGhpcy5sYXN0RWxlbWVudC5wYXJlbnRFbGVtZW50O1xuICAgIH1cbiAgICBpZiAodGhpcy5sYXN0RWxlbWVudC50YWdOYW1lICE9PSAnQkxPQ0tRVU9URScpIHtcbiAgICAgIHRoaXMuYXBwZW5kKCdcXG5cXG4nKTtcbiAgICB9XG4gICAgcmVmID0gdGhpcy5saW5rcztcbiAgICBmb3IgKGkgPSAwOyBpIDwgcmVmLmxlbmd0aDsgaSsrKSB7XG4gICAgICBsaW5rID0gcmVmW2ldO1xuICAgICAgaWYgKGxpbmspIHtcbiAgICAgICAgdGhpcy5hcHBlbmQoJ1snICsgKGkgKyAxKSArICddOiAnICsgbGluayArICdcXG4nKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgdGhpcy5hcHBlbmQoJycpO1xuICByZXR1cm4gdGhpcy5idWZmZXIgPSB0cmltKHRoaXMuYnVmZmVyKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnByZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIG9sZDtcbiAgb2xkID0gdGhpcy5pblByZTtcbiAgdGhpcy5pblByZSA9IHRydWU7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gX3RoaXMuaW5QcmUgPSBvbGQ7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5odG1sVGFnID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgdGhpcy5vdXRwdXQoJzwnICsgdHlwZSArICc+Jyk7XG4gIHJldHVybiB0aGlzLm91dHB1dExhdGVyKCc8LycgKyB0eXBlICsgJz4nKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnByb2Nlc3MgPSBmdW5jdGlvbiAoZWwpIHtcbiAgdmFyIGFmdGVyO1xuICB2YXIgYWZ0ZXIxO1xuICB2YXIgYWZ0ZXIyO1xuICB2YXIgYmFzZTtcbiAgdmFyIGhyZWY7XG4gIHZhciBpO1xuICB2YXIgcmVmO1xuICB2YXIgc3VmZml4O1xuICB2YXIgc3VtbWFyeTtcbiAgdmFyIHRpdGxlO1xuXG4gIGlmICghaXNWaXNpYmxlKGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChlbC5ub2RlVHlwZSA9PT0gd2luZG93Q29udGV4dC5Ob2RlLlRFWFRfTk9ERSkge1xuICAgIGlmIChlbC5ub2RlVmFsdWUucmVwbGFjZSgvXFxuL2csICcnKS5sZW5ndGggPT09IDApIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHRoaXMuaW5QcmUpIHtcbiAgICAgIHJldHVybiB0aGlzLm91dHB1dChlbC5ub2RlVmFsdWUpO1xuICAgIH1cbiAgICBpZiAodGhpcy5pbkNvZGUpIHtcbiAgICAgIHJldHVybiB0aGlzLm91dHB1dChwcm9jZXNzQ29kZShlbC5ub2RlVmFsdWUpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMub3V0cHV0KHByb2Nlc3NQbGFpblRleHQoZWwubm9kZVZhbHVlLCBlbC5wYXJlbnRFbGVtZW50ICYmIGVsLnBhcmVudEVsZW1lbnQudGFnTmFtZSkpO1xuICB9XG5cbiAgaWYgKGVsLm5vZGVUeXBlICE9PSB3aW5kb3dDb250ZXh0Lk5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5sYXN0RWxlbWVudCA9IGVsO1xuXG4gIHZhciB0cmFuc2Zvcm1lZCA9IHRoaXMub3B0aW9ucy50cmFuc2Zvcm0oZWwpO1xuICBpZiAodHJhbnNmb3JtZWQgIT09IHZvaWQgMCkge1xuICAgIHJldHVybiB0aGlzLm91dHB1dCh0cmFuc2Zvcm1lZCk7XG4gIH1cbiAgaWYgKHNoYWxsb3dUYWdzLmluZGV4T2YoZWwudGFnTmFtZSkgIT09IC0xKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3dpdGNoIChlbC50YWdOYW1lKSB7XG4gICAgY2FzZSAnSDEnOlxuICAgIGNhc2UgJ0gyJzpcbiAgICBjYXNlICdIMyc6XG4gICAgY2FzZSAnSDQnOlxuICAgIGNhc2UgJ0g1JzpcbiAgICBjYXNlICdINic6XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIHRoaXMub3V0cHV0KG1hbnkoJyMnLCBwYXJzZUludChlbC50YWdOYW1lLm1hdGNoKHJoZWFkaW5nKVsxXSkpICsgJyAnKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0FERFJFU1MnOlxuICAgIGNhc2UgJ0FSVElDTEUnOlxuICAgIGNhc2UgJ0FTSURFJzpcbiAgICBjYXNlICdESVYnOlxuICAgIGNhc2UgJ0ZJRUxEU0VUJzpcbiAgICBjYXNlICdGT09URVInOlxuICAgIGNhc2UgJ0hFQURFUic6XG4gICAgY2FzZSAnTkFWJzpcbiAgICBjYXNlICdQJzpcbiAgICBjYXNlICdTRUNUSU9OJzpcbiAgICAgIHRoaXMucCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQk9EWSc6XG4gICAgY2FzZSAnRk9STSc6XG4gICAgICBicmVhaztcbiAgICBjYXNlICdERVRBSUxTJzpcbiAgICAgIHRoaXMucCgpO1xuICAgICAgaWYgKCFoYXMoZWwsICdvcGVuJywgZmFsc2UpKSB7XG4gICAgICAgIHN1bW1hcnkgPSBlbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc3VtbWFyeScpWzBdO1xuICAgICAgICBpZiAoc3VtbWFyeSkge1xuICAgICAgICAgIHRoaXMucHJvY2VzcyhzdW1tYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdCUic6XG4gICAgICB0aGlzLmJyKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdIUic6XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIHRoaXMub3V0cHV0KCctLS0tLS0tLS0nKTtcbiAgICAgIHRoaXMucCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQ0lURSc6XG4gICAgY2FzZSAnREZOJzpcbiAgICBjYXNlICdFTSc6XG4gICAgY2FzZSAnSSc6XG4gICAgY2FzZSAnVSc6XG4gICAgY2FzZSAnVkFSJzpcbiAgICAgIHRoaXMub3V0cHV0KCdfJyk7XG4gICAgICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgICAgIGFmdGVyID0gdGhpcy5vdXRwdXRMYXRlcignXycpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRFQnOlxuICAgIGNhc2UgJ0InOlxuICAgIGNhc2UgJ1NUUk9ORyc6XG4gICAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ0RUJykge1xuICAgICAgICB0aGlzLnAoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub3V0cHV0KCcqKicpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJyoqJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdRJzpcbiAgICAgIHRoaXMub3V0cHV0KCdcIicpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJ1wiJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdPTCc6XG4gICAgICBhZnRlciA9IHRoaXMub2woKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1VMJzpcbiAgICAgIGFmdGVyID0gdGhpcy51bCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTEknOlxuICAgICAgdGhpcy5yZXBsYWNlTGVmdCgnXFxuJyk7XG4gICAgICB0aGlzLmxpKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdQUkUnOlxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5mZW5jaW5nKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKCdcXG5cXG4nKTtcbiAgICAgICAgdGhpcy5vdXRwdXQoWydgYGAnLCAnXFxuJ10uam9pbih0aGlzLm9wdGlvbnMuZmVuY2luZ2xhbmd1YWdlKGVsKSB8fCAnJykpO1xuICAgICAgICBhZnRlcjEgPSB0aGlzLnByZSgpO1xuICAgICAgICBhZnRlcjIgPSB0aGlzLm91dHB1dExhdGVyKCdcXG5gYGAnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFmdGVyMSA9IHRoaXMucHVzaExlZnQoJyAgICAnKTtcbiAgICAgICAgYWZ0ZXIyID0gdGhpcy5wcmUoKTtcbiAgICAgIH1cbiAgICAgIGFmdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFmdGVyMSgpO1xuICAgICAgICByZXR1cm4gYWZ0ZXIyKCk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQ09ERSc6XG4gICAgY2FzZSAnU0FNUCc6XG4gICAgICBpZiAodGhpcy5pblByZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHRoaXMub3V0cHV0KCdgJyk7XG4gICAgICBhZnRlcjEgPSB0aGlzLmNvZGUoKTtcbiAgICAgIGFmdGVyMiA9IHRoaXMub3V0cHV0TGF0ZXIoJ2AnKTtcbiAgICAgIGFmdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFmdGVyMSgpO1xuICAgICAgICByZXR1cm4gYWZ0ZXIyKCk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQkxPQ0tRVU9URSc6XG4gICAgY2FzZSAnREQnOlxuICAgICAgdGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLnB1c2hMZWZ0KCc+ICcpO1xuICAgICAgdGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUgPSBmYWxzZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0tCRCc6XG4gICAgICBhZnRlciA9IHRoaXMuaHRtbFRhZygna2JkJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdBJzpcbiAgICBjYXNlICdJTUcnOlxuICAgICAgaHJlZiA9IGF0dHIoZWwsIGVsLnRhZ05hbWUgPT09ICdBJyA/ICdocmVmJyA6ICdzcmMnLCB0aGlzLm9wdGlvbnMuYWJzb2x1dGUpO1xuICAgICAgaWYgKCFocmVmKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGl0bGUgPSBhdHRyKGVsLCAndGl0bGUnKTtcbiAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICBocmVmICs9ICcgXCInICsgdGl0bGUgKyAnXCInO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5pbmxpbmUpIHtcbiAgICAgICAgc3VmZml4ID0gJygnICsgaHJlZiArICcpJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1ZmZpeCA9ICdbJyArICgoYmFzZSA9IHRoaXMubGlua01hcClbaHJlZl0gIT0gbnVsbCA/IGJhc2VbaHJlZl0gOiBiYXNlW2hyZWZdID0gdGhpcy5saW5rcy5wdXNoKGhyZWYpKSArICddJztcbiAgICAgIH1cbiAgICAgIGlmIChlbC50YWdOYW1lID09PSAnSU1HJykge1xuICAgICAgICB0aGlzLm91dHB1dCgnIVsnICsgYXR0cihlbCwgJ2FsdCcpICsgJ10nICsgc3VmZml4KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5vdXRwdXQoJ1snKTtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCddJyArIHN1ZmZpeCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGUkFNRSc6XG4gICAgY2FzZSAnSUZSQU1FJzpcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICgocmVmID0gZWwuY29udGVudERvY3VtZW50KSAhPSBudWxsID8gcmVmLmRvY3VtZW50RWxlbWVudCA6IHZvaWQgMCkge1xuICAgICAgICAgIHRoaXMucHJvY2VzcyhlbC5jb250ZW50RG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAnVFInOlxuICAgICAgYWZ0ZXIgPSB0aGlzLnA7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIGZvciAoaSA9IDA7IGkgPCBlbC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy5wcm9jZXNzKGVsLmNoaWxkTm9kZXNbaV0pO1xuICB9XG5cbiAgaWYgKGFmdGVyKSB7XG4gICAgcmV0dXJuIGFmdGVyLmNhbGwodGhpcyk7XG4gIH1cbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnB1c2hMZWZ0ID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgdmFyIG9sZDtcbiAgb2xkID0gdGhpcy5sZWZ0O1xuICB0aGlzLmxlZnQgKz0gdGV4dDtcbiAgaWYgKHRoaXMuYXRQKSB7XG4gICAgdGhpcy5hcHBlbmQodGV4dCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5wKCk7XG4gIH1cbiAgcmV0dXJuIChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIF90aGlzLmxlZnQgPSBvbGQ7XG4gICAgICBfdGhpcy5hdExlZnQgPSBfdGhpcy5hdFAgPSBmYWxzZTtcbiAgICAgIHJldHVybiBfdGhpcy5wKCk7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5yZXBsYWNlTGVmdCA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gIGlmICghdGhpcy5hdExlZnQpIHtcbiAgICB0aGlzLmFwcGVuZCh0aGlzLmxlZnQucmVwbGFjZSgvWyBdezIsNH0kLywgdGV4dCkpO1xuICAgIHJldHVybiB0aGlzLmF0TGVmdCA9IHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLmF0UCA9IHRydWU7XG4gIH0gZWxzZSBpZiAodGhpcy5sYXN0KSB7XG4gICAgcmV0dXJuIHRoaXMubGFzdCA9IHRoaXMubGFzdC5yZXBsYWNlKC9bIF17Miw0fSQvLCB0ZXh0KTtcbiAgfVxufTtcblxuRG9tYWRvci5wcm90b3R5cGUudWwgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBpbk9yZGVyZWRMaXN0LCBvcmRlcjtcbiAgaWYgKHRoaXMubGlzdERlcHRoID09PSAwKSB7XG4gICAgdGhpcy5wKCk7XG4gIH1cbiAgaW5PcmRlcmVkTGlzdCA9IHRoaXMuaW5PcmRlcmVkTGlzdDtcbiAgb3JkZXIgPSB0aGlzLm9yZGVyO1xuICB0aGlzLmluT3JkZXJlZExpc3QgPSBmYWxzZTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoKys7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBfdGhpcy5pbk9yZGVyZWRMaXN0ID0gaW5PcmRlcmVkTGlzdDtcbiAgICAgIF90aGlzLm9yZGVyID0gb3JkZXI7XG4gICAgICByZXR1cm4gX3RoaXMubGlzdERlcHRoLS07XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHdpbmRvdztcblxuaWYgKCF3aW5kb3cuTm9kZSkge1xuICB3aW5kb3cuTm9kZSA9IHtcbiAgICBFTEVNRU5UX05PREU6IDEsXG4gICAgVEVYVF9OT0RFOiAzXG4gIH07XG59XG4iXX0=
