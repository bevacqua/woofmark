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
    case 'MARK':
      this.output('<mark>');
      after = this.outputLater('</mark>');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkb21hZG9yLmpzIiwid2luZG93Q29udGV4dC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwaUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgcmVwbGFjZW1lbnRzID0ge1xuICAnXFxcXFxcXFwnOiAnXFxcXFxcXFwnLFxuICAnXFxcXFsnOiAnXFxcXFsnLFxuICAnXFxcXF0nOiAnXFxcXF0nLFxuICAnPic6ICdcXFxcPicsXG4gICdfJzogJ1xcXFxfJyxcbiAgJ1xcXFwqJzogJ1xcXFwqJyxcbiAgJ2AnOiAnXFxcXGAnLFxuICAnIyc6ICdcXFxcIycsXG4gICcoWzAtOV0pXFxcXC4oXFxcXHN8JCknOiAnJDFcXFxcLiQyJyxcbiAgJ1xcdTAwYTknOiAnKGMpJyxcbiAgJ1xcdTAwYWUnOiAnKHIpJyxcbiAgJ1xcdTIxMjInOiAnKHRtKScsXG4gICdcXHUwMGEwJzogJyAnLFxuICAnXFx1MDBiNyc6ICdcXFxcKicsXG4gICdcXHUyMDAyJzogJyAnLFxuICAnXFx1MjAwMyc6ICcgJyxcbiAgJ1xcdTIwMDknOiAnICcsXG4gICdcXHUyMDE4JzogJ1xcJycsXG4gICdcXHUyMDE5JzogJ1xcJycsXG4gICdcXHUyMDFjJzogJ1wiJyxcbiAgJ1xcdTIwMWQnOiAnXCInLFxuICAnXFx1MjAyNic6ICcuLi4nLFxuICAnXFx1MjAxMyc6ICctLScsXG4gICdcXHUyMDE0JzogJy0tLSdcbn07XG52YXIgcmVwbGFjZXJzID0gT2JqZWN0LmtleXMocmVwbGFjZW1lbnRzKS5yZWR1Y2UocmVwbGFjZXIsIHt9KTtcbnZhciByc3BhY2VzID0gL15cXHMrfFxccyskL2c7XG52YXIgcmRpc3BsYXkgPSAvKGRpc3BsYXl8dmlzaWJpbGl0eSlcXHMqOlxccypbYS16XSsvZ2k7XG52YXIgcmhpZGRlbiA9IC8obm9uZXxoaWRkZW4pXFxzKiQvaTtcbnZhciByaGVhZGluZyA9IC9eSChbMS02XSkkLztcbnZhciBzaGFsbG93VGFncyA9IFtcbiAgJ0FQUExFVCcsICdBUkVBJywgJ0FVRElPJywgJ0JVVFRPTicsICdDQU5WQVMnLCAnREFUQUxJU1QnLCAnRU1CRUQnLCAnSEVBRCcsICdJTlBVVCcsICdNQVAnLFxuICAnTUVOVScsICdNRVRFUicsICdOT0ZSQU1FUycsICdOT1NDUklQVCcsICdPQkpFQ1QnLCAnT1BUR1JPVVAnLCAnT1BUSU9OJywgJ1BBUkFNJywgJ1BST0dSRVNTJyxcbiAgJ1JQJywgJ1JUJywgJ1JVQlknLCAnU0NSSVBUJywgJ1NFTEVDVCcsICdTVFlMRScsICdURVhUQVJFQScsICdUSVRMRScsICdWSURFTydcbl07XG52YXIgcGFyYWdyYXBoVGFncyA9IFtcbiAgJ0FERFJFU1MnLCAnQVJUSUNMRScsICdBU0lERScsICdESVYnLCAnRklFTERTRVQnLCAnRk9PVEVSJywgJ0hFQURFUicsICdOQVYnLCAnUCcsICdTRUNUSU9OJ1xuXTtcbnZhciB3aW5kb3dDb250ZXh0ID0gcmVxdWlyZSgnLi92aXJ0dWFsV2luZG93Q29udGV4dCcpO1xuXG5mdW5jdGlvbiByZXBsYWNlciAocmVzdWx0LCBrZXkpIHtcbiAgcmVzdWx0W2tleV0gPSBuZXcgUmVnRXhwKGtleSwgJ2cnKTsgcmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gbWFueSAodGV4dCwgdGltZXMpIHtcbiAgcmV0dXJuIG5ldyBBcnJheSh0aW1lcyArIDEpLmpvaW4odGV4dCk7XG59XG5cbmZ1bmN0aW9uIHBhZExlZnQgKHRleHQsIHRpbWVzKSB7XG4gIHJldHVybiBtYW55KCcgJywgdGltZXMpICsgdGV4dDtcbn1cblxuZnVuY3Rpb24gdHJpbSAodGV4dCkge1xuICBpZiAodGV4dC50cmltKSB7XG4gICAgcmV0dXJuIHRleHQudHJpbSgpO1xuICB9XG4gIHJldHVybiB0ZXh0LnJlcGxhY2UocnNwYWNlcywgJycpO1xufVxuXG5mdW5jdGlvbiBhdHRyIChlbCwgcHJvcCwgZGlyZWN0KSB7XG4gIHZhciBwcm9wZXIgPSBkaXJlY3QgPT09IHZvaWQgMCB8fCBkaXJlY3Q7XG4gIGlmIChwcm9wZXIgfHwgdHlwZW9mIGVsLmdldEF0dHJpYnV0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBlbFtwcm9wXSB8fCAnJztcbiAgfVxuICByZXR1cm4gZWwuZ2V0QXR0cmlidXRlKHByb3ApIHx8ICcnO1xufVxuXG5mdW5jdGlvbiBoYXMgKGVsLCBwcm9wLCBkaXJlY3QpIHtcbiAgdmFyIHByb3BlciA9IGRpcmVjdCA9PT0gdm9pZCAwIHx8IGRpcmVjdDtcbiAgaWYgKHByb3BlciB8fCB0eXBlb2YgZWwuaGFzQXR0cmlidXRlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGVsLmhhc093blByb3BlcnR5KHByb3ApO1xuICB9XG4gIHJldHVybiBlbC5oYXNBdHRyaWJ1dGUocHJvcCk7XG59XG5cbmZ1bmN0aW9uIGlzVmlzaWJsZSAoZWwpIHtcbiAgdmFyIGRpc3BsYXk7XG4gIHZhciBpO1xuICB2YXIgcHJvcGVydHk7XG4gIHZhciB2aXNpYmlsaXR5O1xuICB2YXIgdmlzaWJsZSA9IHRydWU7XG4gIHZhciBzdHlsZSA9IGF0dHIoZWwsICdzdHlsZScsIGZhbHNlKTtcbiAgdmFyIHByb3BlcnRpZXMgPSBzdHlsZSAhPSBudWxsID8gdHlwZW9mIHN0eWxlLm1hdGNoID09PSAnZnVuY3Rpb24nID8gc3R5bGUubWF0Y2gocmRpc3BsYXkpIDogdm9pZCAwIDogdm9pZCAwO1xuICBpZiAocHJvcGVydGllcyAhPSBudWxsKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IHByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHByb3BlcnR5ID0gcHJvcGVydGllc1tpXTtcbiAgICAgIHZpc2libGUgPSAhcmhpZGRlbi50ZXN0KHByb3BlcnR5KTtcbiAgICB9XG4gIH1cbiAgaWYgKHZpc2libGUgJiYgdHlwZW9mIHdpbmRvd0NvbnRleHQuZ2V0Q29tcHV0ZWRTdHlsZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRyeSB7XG4gICAgICBzdHlsZSA9IHdpbmRvd0NvbnRleHQuZ2V0Q29tcHV0ZWRTdHlsZShlbCwgbnVsbCk7XG4gICAgICBpZiAodHlwZW9mIChzdHlsZSAhPSBudWxsID8gc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSA6IHZvaWQgMCkgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgZGlzcGxheSA9IHN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ2Rpc3BsYXknKTtcbiAgICAgICAgdmlzaWJpbGl0eSA9IHN0eWxlLmdldFByb3BlcnR5VmFsdWUoJ3Zpc2liaWxpdHknKTtcbiAgICAgICAgdmlzaWJsZSA9IGRpc3BsYXkgIT09ICdub25lJyAmJiB2aXNpYmlsaXR5ICE9PSAnaGlkZGVuJztcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHZpc2libGU7XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NQbGFpblRleHQgKHRleHQsIHRhZ05hbWUpIHtcbiAgdmFyIGtleTtcbiAgdmFyIGJsb2NrID0gcGFyYWdyYXBoVGFncy5pbmRleE9mKHRhZ05hbWUpICE9PSAtMSB8fCB0YWdOYW1lID09PSAnQkxPQ0tRVU9URSc7XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoL1xcbihbIFxcdF0qXFxuKSsvZywgJ1xcbicpO1xuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC9cXG5bIFxcdF0rL2csICdcXG4nKTtcbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvWyBcXHRdKy9nLCAnICcpO1xuICBmb3IgKGtleSBpbiByZXBsYWNlbWVudHMpIHtcbiAgICB0ZXh0ID0gdGV4dC5yZXBsYWNlKHJlcGxhY2Vyc1trZXldLCByZXBsYWNlbWVudHNba2V5XSk7XG4gIH1cbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvKFxccyopXFxcXCMvZywgYmxvY2sgPyByZW1vdmVVbm5lY2Vzc2FyeUVzY2FwZXMgOiAnJDEjJyk7XG4gIHJldHVybiB0ZXh0O1xuXG4gIGZ1bmN0aW9uIHJlbW92ZVVubmVjZXNzYXJ5RXNjYXBlcyAoZXNjYXBlZCwgc3BhY2VzLCBpKSB7XG4gICAgcmV0dXJuIGkgPyBzcGFjZXMgKyAnIycgOiBlc2NhcGVkO1xuICB9XG59XG5cbmZ1bmN0aW9uIHByb2Nlc3NDb2RlICh0ZXh0KSB7XG4gIHJldHVybiB0ZXh0LnJlcGxhY2UoL2AvZywgJ1xcXFxgJyk7XG59XG5cbmZ1bmN0aW9uIG5vb3AgKCkge31cblxuZnVuY3Rpb24gcGFyc2UgKGh0bWwsIG9wdGlvbnMpIHtcbiAgcmV0dXJuIG5ldyBEb21hZG9yKGh0bWwsIG9wdGlvbnMpLnBhcnNlKCk7XG59XG5cbmZ1bmN0aW9uIERvbWFkb3IgKGh0bWwsIG9wdGlvbnMpIHtcbiAgdGhpcy5odG1sID0gaHRtbCAhPSBudWxsID8gaHRtbCA6ICcnO1xuICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICB0aGlzLmF0TGVmdCA9IHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLmF0UCA9IHRydWU7XG4gIHRoaXMuYnVmZmVyID0gJyc7XG4gIHRoaXMuZXhjZXB0aW9ucyA9IFtdO1xuICB0aGlzLm9yZGVyID0gMTtcbiAgdGhpcy5saXN0RGVwdGggPSAwO1xuICB0aGlzLmluQ29kZSA9IHRoaXMuaW5QcmUgPSB0aGlzLmluT3JkZXJlZExpc3QgPSBmYWxzZTtcbiAgdGhpcy5sYXN0ID0gbnVsbDtcbiAgdGhpcy5sZWZ0ID0gJ1xcbic7XG4gIHRoaXMubGlua3MgPSBbXTtcbiAgdGhpcy5saW5rTWFwID0ge307XG4gIHRoaXMudW5oYW5kbGVkID0ge307XG4gIGlmICh0aGlzLm9wdGlvbnMuYWJzb2x1dGUgPT09IHZvaWQgMCkgeyB0aGlzLm9wdGlvbnMuYWJzb2x1dGUgPSBmYWxzZTsgfVxuICBpZiAodGhpcy5vcHRpb25zLmZlbmNpbmcgPT09IHZvaWQgMCkgeyB0aGlzLm9wdGlvbnMuZmVuY2luZyA9IGZhbHNlOyB9XG4gIGlmICh0aGlzLm9wdGlvbnMuZmVuY2luZ2xhbmd1YWdlID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLmZlbmNpbmdsYW5ndWFnZSA9IG5vb3A7IH1cbiAgaWYgKHRoaXMub3B0aW9ucy50cmFuc2Zvcm0gPT09IHZvaWQgMCkgeyB0aGlzLm9wdGlvbnMudHJhbnNmb3JtID0gbm9vcDsgfVxufVxuXG5Eb21hZG9yLnByb3RvdHlwZS5hcHBlbmQgPSBmdW5jdGlvbiAodGV4dCkge1xuICBpZiAodGhpcy5sYXN0ICE9IG51bGwpIHtcbiAgICB0aGlzLmJ1ZmZlciArPSB0aGlzLmxhc3Q7XG4gIH1cbiAgcmV0dXJuIHRoaXMubGFzdCA9IHRleHQ7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5iciA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5hcHBlbmQoJyAgJyArICB0aGlzLmxlZnQpO1xuICByZXR1cm4gdGhpcy5hdExlZnQgPSB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLmNvZGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBvbGQ7XG4gIG9sZCA9IHRoaXMuaW5Db2RlO1xuICB0aGlzLmluQ29kZSA9IHRydWU7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gX3RoaXMuaW5Db2RlID0gb2xkO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUubGkgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciByZXN1bHQ7XG4gIHJlc3VsdCA9IHRoaXMuaW5PcmRlcmVkTGlzdCA/ICh0aGlzLm9yZGVyKyspICsgJy4gJyA6ICcqICc7XG4gIHJlc3VsdCA9IHBhZExlZnQocmVzdWx0LCAodGhpcy5saXN0RGVwdGggLSAxKSAqIDIpO1xuICByZXR1cm4gdGhpcy5hcHBlbmQocmVzdWx0KTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLm9sID0gZnVuY3Rpb24gKCkge1xuICB2YXIgaW5PcmRlcmVkTGlzdCwgb3JkZXI7XG4gIGlmICh0aGlzLmxpc3REZXB0aCA9PT0gMCkge1xuICAgIHRoaXMucCgpO1xuICB9XG4gIGluT3JkZXJlZExpc3QgPSB0aGlzLmluT3JkZXJlZExpc3Q7XG4gIG9yZGVyID0gdGhpcy5vcmRlcjtcbiAgdGhpcy5pbk9yZGVyZWRMaXN0ID0gdHJ1ZTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoKys7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBfdGhpcy5pbk9yZGVyZWRMaXN0ID0gaW5PcmRlcmVkTGlzdDtcbiAgICAgIF90aGlzLm9yZGVyID0gb3JkZXI7XG4gICAgICByZXR1cm4gX3RoaXMubGlzdERlcHRoLS07XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5vdXRwdXQgPSBmdW5jdGlvbiAodGV4dCkge1xuICBpZiAoIXRleHQpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKCF0aGlzLmluUHJlKSB7XG4gICAgdGV4dCA9IHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPyB0ZXh0LnJlcGxhY2UoL15bIFxcdFxcbl0rLywgJycpIDogL15bIFxcdF0qXFxuLy50ZXN0KHRleHQpID8gdGV4dC5yZXBsYWNlKC9eWyBcXHRcXG5dKy8sICdcXG4nKSA6IHRleHQucmVwbGFjZSgvXlsgXFx0XSsvLCAnICcpO1xuICB9XG4gIGlmICh0ZXh0ID09PSAnJykge1xuICAgIHJldHVybjtcbiAgfVxuICB0aGlzLmF0UCA9IC9cXG5cXG4kLy50ZXN0KHRleHQpO1xuICB0aGlzLmF0TGVmdCA9IC9cXG4kLy50ZXN0KHRleHQpO1xuICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gL1sgXFx0XFxuXSQvLnRlc3QodGV4dCk7XG4gIHJldHVybiB0aGlzLmFwcGVuZCh0ZXh0LnJlcGxhY2UoL1xcbi9nLCB0aGlzLmxlZnQpKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLm91dHB1dExhdGVyID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgcmV0dXJuIChmdW5jdGlvbihzZWxmKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBzZWxmLm91dHB1dCh0ZXh0KTtcbiAgICB9O1xuICB9KSh0aGlzKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnAgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmF0UCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUpIHtcbiAgICB0aGlzLmFwcGVuZCgnXFxuJyk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5hcHBlbmQodGhpcy5sZWZ0KTtcbiAgfVxuICBpZiAoIXRoaXMuYXRMZWZ0KSB7XG4gICAgdGhpcy5hcHBlbmQodGhpcy5sZWZ0KTtcbiAgICB0aGlzLmF0TGVmdCA9IHRydWU7XG4gIH1cbiAgcmV0dXJuIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLmF0UCA9IHRydWU7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGNvbnRhaW5lcjtcbiAgdmFyIGk7XG4gIHZhciBsaW5rO1xuICB2YXIgcmVmO1xuICB0aGlzLmJ1ZmZlciA9ICcnO1xuICBpZiAoIXRoaXMuaHRtbCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlcjtcbiAgfVxuICBpZiAodHlwZW9mIHRoaXMuaHRtbCA9PT0gJ3N0cmluZycpIHtcbiAgICBjb250YWluZXIgPSB3aW5kb3dDb250ZXh0LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSB0aGlzLmh0bWw7XG4gIH0gZWxzZSB7XG4gICAgY29udGFpbmVyID0gdGhpcy5odG1sO1xuICB9XG4gIHRoaXMucHJvY2Vzcyhjb250YWluZXIpO1xuICBpZiAodGhpcy5saW5rcy5sZW5ndGgpIHtcbiAgICB3aGlsZSAodGhpcy5sYXN0RWxlbWVudC5wYXJlbnRFbGVtZW50ICE9PSBjb250YWluZXIgJiYgdGhpcy5sYXN0RWxlbWVudC50YWdOYW1lICE9PSAnQkxPQ0tRVU9URScpIHtcbiAgICAgIHRoaXMubGFzdEVsZW1lbnQgPSB0aGlzLmxhc3RFbGVtZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuICAgIGlmICh0aGlzLmxhc3RFbGVtZW50LnRhZ05hbWUgIT09ICdCTE9DS1FVT1RFJykge1xuICAgICAgdGhpcy5hcHBlbmQoJ1xcblxcbicpO1xuICAgIH1cbiAgICByZWYgPSB0aGlzLmxpbmtzO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZWYubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxpbmsgPSByZWZbaV07XG4gICAgICBpZiAobGluaykge1xuICAgICAgICB0aGlzLmFwcGVuZCgnWycgKyAoaSArIDEpICsgJ106ICcgKyBsaW5rICsgJ1xcbicpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB0aGlzLmFwcGVuZCgnJyk7XG4gIHJldHVybiB0aGlzLmJ1ZmZlciA9IHRyaW0odGhpcy5idWZmZXIpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucHJlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgb2xkO1xuICBvbGQgPSB0aGlzLmluUHJlO1xuICB0aGlzLmluUHJlID0gdHJ1ZTtcbiAgcmV0dXJuIChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBfdGhpcy5pblByZSA9IG9sZDtcbiAgICB9O1xuICB9KSh0aGlzKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLmh0bWxUYWcgPSBmdW5jdGlvbiAodHlwZSkge1xuICB0aGlzLm91dHB1dCgnPCcgKyB0eXBlICsgJz4nKTtcbiAgcmV0dXJuIHRoaXMub3V0cHV0TGF0ZXIoJzwvJyArIHR5cGUgKyAnPicpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucHJvY2VzcyA9IGZ1bmN0aW9uIChlbCkge1xuICB2YXIgYWZ0ZXI7XG4gIHZhciBhZnRlcjE7XG4gIHZhciBhZnRlcjI7XG4gIHZhciBiYXNlO1xuICB2YXIgaHJlZjtcbiAgdmFyIGk7XG4gIHZhciByZWY7XG4gIHZhciBzdWZmaXg7XG4gIHZhciBzdW1tYXJ5O1xuICB2YXIgdGl0bGU7XG5cbiAgaWYgKCFpc1Zpc2libGUoZWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGVsLm5vZGVUeXBlID09PSB3aW5kb3dDb250ZXh0Lk5vZGUuVEVYVF9OT0RFKSB7XG4gICAgaWYgKGVsLm5vZGVWYWx1ZS5yZXBsYWNlKC9cXG4vZywgJycpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5pblByZSkge1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0KGVsLm5vZGVWYWx1ZSk7XG4gICAgfVxuICAgIGlmICh0aGlzLmluQ29kZSkge1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0KHByb2Nlc3NDb2RlKGVsLm5vZGVWYWx1ZSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5vdXRwdXQocHJvY2Vzc1BsYWluVGV4dChlbC5ub2RlVmFsdWUsIGVsLnBhcmVudEVsZW1lbnQgJiYgZWwucGFyZW50RWxlbWVudC50YWdOYW1lKSk7XG4gIH1cblxuICBpZiAoZWwubm9kZVR5cGUgIT09IHdpbmRvd0NvbnRleHQuTm9kZS5FTEVNRU5UX05PREUpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB0aGlzLmxhc3RFbGVtZW50ID0gZWw7XG5cbiAgdmFyIHRyYW5zZm9ybWVkID0gdGhpcy5vcHRpb25zLnRyYW5zZm9ybShlbCk7XG4gIGlmICh0cmFuc2Zvcm1lZCAhPT0gdm9pZCAwKSB7XG4gICAgcmV0dXJuIHRoaXMub3V0cHV0KHRyYW5zZm9ybWVkKTtcbiAgfVxuICBpZiAoc2hhbGxvd1RhZ3MuaW5kZXhPZihlbC50YWdOYW1lKSAhPT0gLTEpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICBzd2l0Y2ggKGVsLnRhZ05hbWUpIHtcbiAgICBjYXNlICdIMSc6XG4gICAgY2FzZSAnSDInOlxuICAgIGNhc2UgJ0gzJzpcbiAgICBjYXNlICdINCc6XG4gICAgY2FzZSAnSDUnOlxuICAgIGNhc2UgJ0g2JzpcbiAgICAgIHRoaXMucCgpO1xuICAgICAgdGhpcy5vdXRwdXQobWFueSgnIycsIHBhcnNlSW50KGVsLnRhZ05hbWUubWF0Y2gocmhlYWRpbmcpWzFdKSkgKyAnICcpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQUREUkVTUyc6XG4gICAgY2FzZSAnQVJUSUNMRSc6XG4gICAgY2FzZSAnQVNJREUnOlxuICAgIGNhc2UgJ0RJVic6XG4gICAgY2FzZSAnRklFTERTRVQnOlxuICAgIGNhc2UgJ0ZPT1RFUic6XG4gICAgY2FzZSAnSEVBREVSJzpcbiAgICBjYXNlICdOQVYnOlxuICAgIGNhc2UgJ1AnOlxuICAgIGNhc2UgJ1NFQ1RJT04nOlxuICAgICAgdGhpcy5wKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdCT0RZJzpcbiAgICBjYXNlICdGT1JNJzpcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0RFVEFJTFMnOlxuICAgICAgdGhpcy5wKCk7XG4gICAgICBpZiAoIWhhcyhlbCwgJ29wZW4nLCBmYWxzZSkpIHtcbiAgICAgICAgc3VtbWFyeSA9IGVsLmdldEVsZW1lbnRzQnlUYWdOYW1lKCdzdW1tYXJ5JylbMF07XG4gICAgICAgIGlmIChzdW1tYXJ5KSB7XG4gICAgICAgICAgdGhpcy5wcm9jZXNzKHN1bW1hcnkpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0JSJzpcbiAgICAgIHRoaXMuYnIoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0hSJzpcbiAgICAgIHRoaXMucCgpO1xuICAgICAgdGhpcy5vdXRwdXQoJy0tLS0tLS0tLScpO1xuICAgICAgdGhpcy5wKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdDSVRFJzpcbiAgICBjYXNlICdERk4nOlxuICAgIGNhc2UgJ0VNJzpcbiAgICBjYXNlICdJJzpcbiAgICBjYXNlICdVJzpcbiAgICBjYXNlICdWQVInOlxuICAgICAgdGhpcy5vdXRwdXQoJ18nKTtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCdfJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdNQVJLJzpcbiAgICAgIHRoaXMub3V0cHV0KCc8bWFyaz4nKTtcbiAgICAgIGFmdGVyID0gdGhpcy5vdXRwdXRMYXRlcignPC9tYXJrPicpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnRFQnOlxuICAgIGNhc2UgJ0InOlxuICAgIGNhc2UgJ1NUUk9ORyc6XG4gICAgICBpZiAoZWwudGFnTmFtZSA9PT0gJ0RUJykge1xuICAgICAgICB0aGlzLnAoKTtcbiAgICAgIH1cbiAgICAgIHRoaXMub3V0cHV0KCcqKicpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJyoqJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdRJzpcbiAgICAgIHRoaXMub3V0cHV0KCdcIicpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJ1wiJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdPTCc6XG4gICAgICBhZnRlciA9IHRoaXMub2woKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1VMJzpcbiAgICAgIGFmdGVyID0gdGhpcy51bCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTEknOlxuICAgICAgdGhpcy5yZXBsYWNlTGVmdCgnXFxuJyk7XG4gICAgICB0aGlzLmxpKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdQUkUnOlxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5mZW5jaW5nKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKCdcXG5cXG4nKTtcbiAgICAgICAgdGhpcy5vdXRwdXQoWydgYGAnLCAnXFxuJ10uam9pbih0aGlzLm9wdGlvbnMuZmVuY2luZ2xhbmd1YWdlKGVsKSB8fCAnJykpO1xuICAgICAgICBhZnRlcjEgPSB0aGlzLnByZSgpO1xuICAgICAgICBhZnRlcjIgPSB0aGlzLm91dHB1dExhdGVyKCdcXG5gYGAnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFmdGVyMSA9IHRoaXMucHVzaExlZnQoJyAgICAnKTtcbiAgICAgICAgYWZ0ZXIyID0gdGhpcy5wcmUoKTtcbiAgICAgIH1cbiAgICAgIGFmdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFmdGVyMSgpO1xuICAgICAgICByZXR1cm4gYWZ0ZXIyKCk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQ09ERSc6XG4gICAgY2FzZSAnU0FNUCc6XG4gICAgICBpZiAodGhpcy5pblByZSkge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICAgIHRoaXMub3V0cHV0KCdgJyk7XG4gICAgICBhZnRlcjEgPSB0aGlzLmNvZGUoKTtcbiAgICAgIGFmdGVyMiA9IHRoaXMub3V0cHV0TGF0ZXIoJ2AnKTtcbiAgICAgIGFmdGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIGFmdGVyMSgpO1xuICAgICAgICByZXR1cm4gYWZ0ZXIyKCk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQkxPQ0tRVU9URSc6XG4gICAgY2FzZSAnREQnOlxuICAgICAgdGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLnB1c2hMZWZ0KCc+ICcpO1xuICAgICAgdGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUgPSBmYWxzZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0tCRCc6XG4gICAgICBhZnRlciA9IHRoaXMuaHRtbFRhZygna2JkJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdBJzpcbiAgICBjYXNlICdJTUcnOlxuICAgICAgaHJlZiA9IGF0dHIoZWwsIGVsLnRhZ05hbWUgPT09ICdBJyA/ICdocmVmJyA6ICdzcmMnLCB0aGlzLm9wdGlvbnMuYWJzb2x1dGUpO1xuICAgICAgaWYgKCFocmVmKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGl0bGUgPSBhdHRyKGVsLCAndGl0bGUnKTtcbiAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICBocmVmICs9ICcgXCInICsgdGl0bGUgKyAnXCInO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5pbmxpbmUpIHtcbiAgICAgICAgc3VmZml4ID0gJygnICsgaHJlZiArICcpJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1ZmZpeCA9ICdbJyArICgoYmFzZSA9IHRoaXMubGlua01hcClbaHJlZl0gIT0gbnVsbCA/IGJhc2VbaHJlZl0gOiBiYXNlW2hyZWZdID0gdGhpcy5saW5rcy5wdXNoKGhyZWYpKSArICddJztcbiAgICAgIH1cbiAgICAgIGlmIChlbC50YWdOYW1lID09PSAnSU1HJykge1xuICAgICAgICB0aGlzLm91dHB1dCgnIVsnICsgYXR0cihlbCwgJ2FsdCcpICsgJ10nICsgc3VmZml4KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5vdXRwdXQoJ1snKTtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCddJyArIHN1ZmZpeCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdGUkFNRSc6XG4gICAgY2FzZSAnSUZSQU1FJzpcbiAgICAgIHRyeSB7XG4gICAgICAgIGlmICgocmVmID0gZWwuY29udGVudERvY3VtZW50KSAhPSBudWxsID8gcmVmLmRvY3VtZW50RWxlbWVudCA6IHZvaWQgMCkge1xuICAgICAgICAgIHRoaXMucHJvY2VzcyhlbC5jb250ZW50RG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KTtcbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gICAgY2FzZSAnVFInOlxuICAgICAgYWZ0ZXIgPSB0aGlzLnA7XG4gICAgICBicmVhaztcbiAgfVxuXG4gIGZvciAoaSA9IDA7IGkgPCBlbC5jaGlsZE5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy5wcm9jZXNzKGVsLmNoaWxkTm9kZXNbaV0pO1xuICB9XG5cbiAgaWYgKGFmdGVyKSB7XG4gICAgcmV0dXJuIGFmdGVyLmNhbGwodGhpcyk7XG4gIH1cbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnB1c2hMZWZ0ID0gZnVuY3Rpb24gKHRleHQpIHtcbiAgdmFyIG9sZDtcbiAgb2xkID0gdGhpcy5sZWZ0O1xuICB0aGlzLmxlZnQgKz0gdGV4dDtcbiAgaWYgKHRoaXMuYXRQKSB7XG4gICAgdGhpcy5hcHBlbmQodGV4dCk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5wKCk7XG4gIH1cbiAgcmV0dXJuIChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIF90aGlzLmxlZnQgPSBvbGQ7XG4gICAgICBfdGhpcy5hdExlZnQgPSBfdGhpcy5hdFAgPSBmYWxzZTtcbiAgICAgIHJldHVybiBfdGhpcy5wKCk7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5yZXBsYWNlTGVmdCA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gIGlmICghdGhpcy5hdExlZnQpIHtcbiAgICB0aGlzLmFwcGVuZCh0aGlzLmxlZnQucmVwbGFjZSgvWyBdezIsNH0kLywgdGV4dCkpO1xuICAgIHJldHVybiB0aGlzLmF0TGVmdCA9IHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLmF0UCA9IHRydWU7XG4gIH0gZWxzZSBpZiAodGhpcy5sYXN0KSB7XG4gICAgcmV0dXJuIHRoaXMubGFzdCA9IHRoaXMubGFzdC5yZXBsYWNlKC9bIF17Miw0fSQvLCB0ZXh0KTtcbiAgfVxufTtcblxuRG9tYWRvci5wcm90b3R5cGUudWwgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBpbk9yZGVyZWRMaXN0LCBvcmRlcjtcbiAgaWYgKHRoaXMubGlzdERlcHRoID09PSAwKSB7XG4gICAgdGhpcy5wKCk7XG4gIH1cbiAgaW5PcmRlcmVkTGlzdCA9IHRoaXMuaW5PcmRlcmVkTGlzdDtcbiAgb3JkZXIgPSB0aGlzLm9yZGVyO1xuICB0aGlzLmluT3JkZXJlZExpc3QgPSBmYWxzZTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoKys7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBfdGhpcy5pbk9yZGVyZWRMaXN0ID0gaW5PcmRlcmVkTGlzdDtcbiAgICAgIF90aGlzLm9yZGVyID0gb3JkZXI7XG4gICAgICByZXR1cm4gX3RoaXMubGlzdERlcHRoLS07XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHBhcnNlO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHdpbmRvdztcblxuaWYgKCF3aW5kb3cuTm9kZSkge1xuICB3aW5kb3cuTm9kZSA9IHtcbiAgICBFTEVNRU5UX05PREU6IDEsXG4gICAgVEVYVF9OT0RFOiAzXG4gIH07XG59XG4iXX0=
