!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.domador=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

require('string.prototype.repeat');

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
  this.windowContext = windowContext(this.options);
  this.atLeft = this.noTrailingWhitespace = this.atP = true;
  this.buffer = this.childBuffer = '';
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

Domador.prototype.append = function append (text) {
  if (this.last != null) {
    this.buffer += this.last;
  }
  this.childBuffer += text;
  return this.last = text;
};

Domador.prototype.br = function br () {
  this.append('  ' +  this.left);
  return this.atLeft = this.noTrailingWhitespace = true;
};

Domador.prototype.code = function code () {
  var old;
  old = this.inCode;
  this.inCode = true;
  return (function(_this) {
    return function after () {
      return _this.inCode = old;
    };
  })(this);
};

Domador.prototype.li = function li () {
  var result;
  result = this.inOrderedList ? (this.order++) + '. ' : '* ';
  result = padLeft(result, (this.listDepth - 1) * 2);
  return this.append(result);
};

Domador.prototype.td = function td (header) {
  this.noTrailingWhitespace = false;
  this.output(' ');
  this.childBuffer = '';
  this.noTrailingWhitespace = false;
  return function after () {
    var spaces = header ? 0 : Math.max(0, this.tableCols[this.tableCol++] - this.childBuffer.length);
    this.inPre = true;
    this.output(' '.repeat(spaces + 1) + '|');
    this.inPre = false;
    this.noTrailingWhitespace = true;
  };
};

Domador.prototype.ol = function ol () {
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
    return function after () {
      _this.inOrderedList = inOrderedList;
      _this.order = order;
      return _this.listDepth--;
    };
  })(this);
};

Domador.prototype.ul = function ul () {
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
    return function after () {
      _this.inOrderedList = inOrderedList;
      _this.order = order;
      return _this.listDepth--;
    };
  })(this);
};

Domador.prototype.output = function output (text) {
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

Domador.prototype.outputLater = function outputLater (text) {
  return (function(self) {
    return function after () {
      return self.output(text);
    };
  })(this);
};

Domador.prototype.p = function p () {
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

Domador.prototype.parse = function parse () {
  var container;
  var i;
  var link;
  var ref;
  this.buffer = '';
  if (!this.html) {
    return this.buffer;
  }
  if (typeof this.html === 'string') {
    container = this.windowContext.document.createElement('div');
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

Domador.prototype.pre = function pre () {
  var old;
  old = this.inPre;
  this.inPre = true;
  return (function(_this) {
    return function after () {
      return _this.inPre = old;
    };
  })(this);
};

Domador.prototype.htmlTag = function htmlTag (type) {
  this.output('<' + type + '>');
  return this.outputLater('</' + type + '>');
};

Domador.prototype.process = function process (el) {
  var after;
  var base;
  var href;
  var i;
  var ref;
  var suffix;
  var summary;
  var title;
  var frameSrc;

  if (!this.isVisible(el)) {
    return;
  }

  if (el.nodeType === this.windowContext.Node.TEXT_NODE) {
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

  if (el.nodeType !== this.windowContext.Node.ELEMENT_NODE) {
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
        after = [this.pre(), this.outputLater('\n```')];
      } else {
        after = [this.pushLeft('    '), this.pre()];
      }
      break;
    case 'CODE':
    case 'SAMP':
      if (this.inPre) {
        break;
      }
      this.output('`');
      after = [this.code(), this.outputLater('`')];
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
    case 'IFRAME':
      try {
        if ((ref = el.contentDocument) != null ? ref.documentElement : void 0) {
          this.process(el.contentDocument.documentElement);
        } else {
          frameSrc = attr(el, 'src');
          if (frameSrc && this.options.allowFrame && this.options.allowFrame(frameSrc)) {
            this.output('<iframe src="' + frameSrc + '"></iframe>');
          }
        }
      } catch (err) {
      }
      return;
  }

  after = this.tables(el) || after;

  for (i = 0; i < el.childNodes.length; i++) {
    this.process(el.childNodes[i]);
  }

  if (typeof after === 'function') {
    after = [after];
  }
  while (after && after.length) {
    after.shift().call(this);
  }
};

Domador.prototype.tables = function tables (el) {
  if (this.options.tables === false) {
    return;
  }

  var name = el.tagName;
  if (name === 'TABLE') {
    this.tableCols = [];
    return;
  }
  if (name === 'THEAD') {
    return function after () {
      return this.output('|' + this.tableCols.reduce(function (th, tc) {
        return th + '-'.repeat(tc + 2) + '|';
      }, ''));
    };
  }
  if (name === 'TH') {
    return [function after () {
      this.tableCols.push(this.childBuffer.length);
    }, this.td(true)];
  }
  if (name === 'TR') {
    this.tableCol = 0;
    this.output('|');
    this.noTrailingWhitespace = true;
    return function after () {
      this.output('\n');
      this.noTrailingWhitespace = false;
    };
  }
  if (name === 'TD') {
    return this.td();
  }
};

Domador.prototype.pushLeft = function pushLeft (text) {
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

Domador.prototype.replaceLeft = function replaceLeft (text) {
  if (!this.atLeft) {
    this.append(this.left.replace(/[ ]{2,4}$/, text));
    return this.atLeft = this.noTrailingWhitespace = this.atP = true;
  } else if (this.last) {
    return this.last = this.last.replace(/[ ]{2,4}$/, text);
  }
};

Domador.prototype.isVisible = function isVisible (el) {
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
  if (visible && typeof this.windowContext.getComputedStyle === 'function') {
    try {
      style = this.windowContext.getComputedStyle(el, null);
      if (typeof (style != null ? style.getPropertyValue : void 0) === 'function') {
        display = style.getPropertyValue('display');
        visibility = style.getPropertyValue('visibility');
        visible = display !== 'none' && visibility !== 'hidden';
      }
    } catch (err) {
    }
  }
  return visible;
};

module.exports = parse;

},{"./virtualWindowContext":3,"string.prototype.repeat":2}],2:[function(require,module,exports){
/*! http://mths.be/repeat v0.2.0 by @mathias */
if (!String.prototype.repeat) {
	(function() {
		'use strict'; // needed to support `apply`/`call` with `undefined`/`null`
		var defineProperty = (function() {
			// IE 8 only supports `Object.defineProperty` on DOM elements
			try {
				var object = {};
				var $defineProperty = Object.defineProperty;
				var result = $defineProperty(object, object, object) && $defineProperty;
			} catch(error) {}
			return result;
		}());
		var repeat = function(count) {
			if (this == null) {
				throw TypeError();
			}
			var string = String(this);
			// `ToInteger`
			var n = count ? Number(count) : 0;
			if (n != n) { // better `isNaN`
				n = 0;
			}
			// Account for out-of-bounds indices
			if (n < 0 || n == Infinity) {
				throw RangeError();
			}
			var result = '';
			while (n) {
				if (n % 2 == 1) {
					result += string;
				}
				if (n > 1) {
					string += string;
				}
				n >>= 1;
			}
			return result;
		};
		if (defineProperty) {
			defineProperty(String.prototype, 'repeat', {
				'value': repeat,
				'configurable': true,
				'writable': true
			});
		} else {
			String.prototype.repeat = repeat;
		}
	}());
}

},{}],3:[function(require,module,exports){
'use strict';

if (!window.Node) {
  window.Node = {
    ELEMENT_NODE: 1,
    TEXT_NODE: 3
  };
}

function windowContext () {
  return window;
}

module.exports = windowContext;

},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkb21hZG9yLmpzIiwibm9kZV9tb2R1bGVzL3N0cmluZy5wcm90b3R5cGUucmVwZWF0L3JlcGVhdC5qcyIsIndpbmRvd0NvbnRleHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcGxCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCIndXNlIHN0cmljdCc7XG5cbnJlcXVpcmUoJ3N0cmluZy5wcm90b3R5cGUucmVwZWF0Jyk7XG5cbnZhciByZXBsYWNlbWVudHMgPSB7XG4gICdcXFxcXFxcXCc6ICdcXFxcXFxcXCcsXG4gICdcXFxcWyc6ICdcXFxcWycsXG4gICdcXFxcXSc6ICdcXFxcXScsXG4gICc+JzogJ1xcXFw+JyxcbiAgJ18nOiAnXFxcXF8nLFxuICAnXFxcXConOiAnXFxcXConLFxuICAnYCc6ICdcXFxcYCcsXG4gICcjJzogJ1xcXFwjJyxcbiAgJyhbMC05XSlcXFxcLihcXFxcc3wkKSc6ICckMVxcXFwuJDInLFxuICAnXFx1MDBhOSc6ICcoYyknLFxuICAnXFx1MDBhZSc6ICcociknLFxuICAnXFx1MjEyMic6ICcodG0pJyxcbiAgJ1xcdTAwYTAnOiAnICcsXG4gICdcXHUwMGI3JzogJ1xcXFwqJyxcbiAgJ1xcdTIwMDInOiAnICcsXG4gICdcXHUyMDAzJzogJyAnLFxuICAnXFx1MjAwOSc6ICcgJyxcbiAgJ1xcdTIwMTgnOiAnXFwnJyxcbiAgJ1xcdTIwMTknOiAnXFwnJyxcbiAgJ1xcdTIwMWMnOiAnXCInLFxuICAnXFx1MjAxZCc6ICdcIicsXG4gICdcXHUyMDI2JzogJy4uLicsXG4gICdcXHUyMDEzJzogJy0tJyxcbiAgJ1xcdTIwMTQnOiAnLS0tJ1xufTtcbnZhciByZXBsYWNlcnMgPSBPYmplY3Qua2V5cyhyZXBsYWNlbWVudHMpLnJlZHVjZShyZXBsYWNlciwge30pO1xudmFyIHJzcGFjZXMgPSAvXlxccyt8XFxzKyQvZztcbnZhciByZGlzcGxheSA9IC8oZGlzcGxheXx2aXNpYmlsaXR5KVxccyo6XFxzKlthLXpdKy9naTtcbnZhciByaGlkZGVuID0gLyhub25lfGhpZGRlbilcXHMqJC9pO1xudmFyIHJoZWFkaW5nID0gL15IKFsxLTZdKSQvO1xudmFyIHNoYWxsb3dUYWdzID0gW1xuICAnQVBQTEVUJywgJ0FSRUEnLCAnQVVESU8nLCAnQlVUVE9OJywgJ0NBTlZBUycsICdEQVRBTElTVCcsICdFTUJFRCcsICdIRUFEJywgJ0lOUFVUJywgJ01BUCcsXG4gICdNRU5VJywgJ01FVEVSJywgJ05PRlJBTUVTJywgJ05PU0NSSVBUJywgJ09CSkVDVCcsICdPUFRHUk9VUCcsICdPUFRJT04nLCAnUEFSQU0nLCAnUFJPR1JFU1MnLFxuICAnUlAnLCAnUlQnLCAnUlVCWScsICdTQ1JJUFQnLCAnU0VMRUNUJywgJ1NUWUxFJywgJ1RFWFRBUkVBJywgJ1RJVExFJywgJ1ZJREVPJ1xuXTtcbnZhciBwYXJhZ3JhcGhUYWdzID0gW1xuICAnQUREUkVTUycsICdBUlRJQ0xFJywgJ0FTSURFJywgJ0RJVicsICdGSUVMRFNFVCcsICdGT09URVInLCAnSEVBREVSJywgJ05BVicsICdQJywgJ1NFQ1RJT04nXG5dO1xudmFyIHdpbmRvd0NvbnRleHQgPSByZXF1aXJlKCcuL3ZpcnR1YWxXaW5kb3dDb250ZXh0Jyk7XG5cbmZ1bmN0aW9uIHJlcGxhY2VyIChyZXN1bHQsIGtleSkge1xuICByZXN1bHRba2V5XSA9IG5ldyBSZWdFeHAoa2V5LCAnZycpOyByZXR1cm4gcmVzdWx0O1xufVxuXG5mdW5jdGlvbiBtYW55ICh0ZXh0LCB0aW1lcykge1xuICByZXR1cm4gbmV3IEFycmF5KHRpbWVzICsgMSkuam9pbih0ZXh0KTtcbn1cblxuZnVuY3Rpb24gcGFkTGVmdCAodGV4dCwgdGltZXMpIHtcbiAgcmV0dXJuIG1hbnkoJyAnLCB0aW1lcykgKyB0ZXh0O1xufVxuXG5mdW5jdGlvbiB0cmltICh0ZXh0KSB7XG4gIGlmICh0ZXh0LnRyaW0pIHtcbiAgICByZXR1cm4gdGV4dC50cmltKCk7XG4gIH1cbiAgcmV0dXJuIHRleHQucmVwbGFjZShyc3BhY2VzLCAnJyk7XG59XG5cbmZ1bmN0aW9uIGF0dHIgKGVsLCBwcm9wLCBkaXJlY3QpIHtcbiAgdmFyIHByb3BlciA9IGRpcmVjdCA9PT0gdm9pZCAwIHx8IGRpcmVjdDtcbiAgaWYgKHByb3BlciB8fCB0eXBlb2YgZWwuZ2V0QXR0cmlidXRlICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgcmV0dXJuIGVsW3Byb3BdIHx8ICcnO1xuICB9XG4gIHJldHVybiBlbC5nZXRBdHRyaWJ1dGUocHJvcCkgfHwgJyc7XG59XG5cbmZ1bmN0aW9uIGhhcyAoZWwsIHByb3AsIGRpcmVjdCkge1xuICB2YXIgcHJvcGVyID0gZGlyZWN0ID09PSB2b2lkIDAgfHwgZGlyZWN0O1xuICBpZiAocHJvcGVyIHx8IHR5cGVvZiBlbC5oYXNBdHRyaWJ1dGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZWwuaGFzT3duUHJvcGVydHkocHJvcCk7XG4gIH1cbiAgcmV0dXJuIGVsLmhhc0F0dHJpYnV0ZShwcm9wKTtcbn1cblxuZnVuY3Rpb24gcHJvY2Vzc1BsYWluVGV4dCAodGV4dCwgdGFnTmFtZSkge1xuICB2YXIga2V5O1xuICB2YXIgYmxvY2sgPSBwYXJhZ3JhcGhUYWdzLmluZGV4T2YodGFnTmFtZSkgIT09IC0xIHx8IHRhZ05hbWUgPT09ICdCTE9DS1FVT1RFJztcbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvXFxuKFsgXFx0XSpcXG4pKy9nLCAnXFxuJyk7XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoL1xcblsgXFx0XSsvZywgJ1xcbicpO1xuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC9bIFxcdF0rL2csICcgJyk7XG4gIGZvciAoa2V5IGluIHJlcGxhY2VtZW50cykge1xuICAgIHRleHQgPSB0ZXh0LnJlcGxhY2UocmVwbGFjZXJzW2tleV0sIHJlcGxhY2VtZW50c1trZXldKTtcbiAgfVxuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC8oXFxzKilcXFxcIy9nLCBibG9jayA/IHJlbW92ZVVubmVjZXNzYXJ5RXNjYXBlcyA6ICckMSMnKTtcbiAgcmV0dXJuIHRleHQ7XG5cbiAgZnVuY3Rpb24gcmVtb3ZlVW5uZWNlc3NhcnlFc2NhcGVzIChlc2NhcGVkLCBzcGFjZXMsIGkpIHtcbiAgICByZXR1cm4gaSA/IHNwYWNlcyArICcjJyA6IGVzY2FwZWQ7XG4gIH1cbn1cblxuZnVuY3Rpb24gcHJvY2Vzc0NvZGUgKHRleHQpIHtcbiAgcmV0dXJuIHRleHQucmVwbGFjZSgvYC9nLCAnXFxcXGAnKTtcbn1cblxuZnVuY3Rpb24gbm9vcCAoKSB7fVxuXG5mdW5jdGlvbiBwYXJzZSAoaHRtbCwgb3B0aW9ucykge1xuICByZXR1cm4gbmV3IERvbWFkb3IoaHRtbCwgb3B0aW9ucykucGFyc2UoKTtcbn1cblxuZnVuY3Rpb24gRG9tYWRvciAoaHRtbCwgb3B0aW9ucykge1xuICB0aGlzLmh0bWwgPSBodG1sICE9IG51bGwgPyBodG1sIDogJyc7XG4gIHRoaXMub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG4gIHRoaXMud2luZG93Q29udGV4dCA9IHdpbmRvd0NvbnRleHQodGhpcy5vcHRpb25zKTtcbiAgdGhpcy5hdExlZnQgPSB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdGhpcy5hdFAgPSB0cnVlO1xuICB0aGlzLmJ1ZmZlciA9IHRoaXMuY2hpbGRCdWZmZXIgPSAnJztcbiAgdGhpcy5leGNlcHRpb25zID0gW107XG4gIHRoaXMub3JkZXIgPSAxO1xuICB0aGlzLmxpc3REZXB0aCA9IDA7XG4gIHRoaXMuaW5Db2RlID0gdGhpcy5pblByZSA9IHRoaXMuaW5PcmRlcmVkTGlzdCA9IGZhbHNlO1xuICB0aGlzLmxhc3QgPSBudWxsO1xuICB0aGlzLmxlZnQgPSAnXFxuJztcbiAgdGhpcy5saW5rcyA9IFtdO1xuICB0aGlzLmxpbmtNYXAgPSB7fTtcbiAgdGhpcy51bmhhbmRsZWQgPSB7fTtcbiAgaWYgKHRoaXMub3B0aW9ucy5hYnNvbHV0ZSA9PT0gdm9pZCAwKSB7IHRoaXMub3B0aW9ucy5hYnNvbHV0ZSA9IGZhbHNlOyB9XG4gIGlmICh0aGlzLm9wdGlvbnMuZmVuY2luZyA9PT0gdm9pZCAwKSB7IHRoaXMub3B0aW9ucy5mZW5jaW5nID0gZmFsc2U7IH1cbiAgaWYgKHRoaXMub3B0aW9ucy5mZW5jaW5nbGFuZ3VhZ2UgPT09IHZvaWQgMCkgeyB0aGlzLm9wdGlvbnMuZmVuY2luZ2xhbmd1YWdlID0gbm9vcDsgfVxuICBpZiAodGhpcy5vcHRpb25zLnRyYW5zZm9ybSA9PT0gdm9pZCAwKSB7IHRoaXMub3B0aW9ucy50cmFuc2Zvcm0gPSBub29wOyB9XG59XG5cbkRvbWFkb3IucHJvdG90eXBlLmFwcGVuZCA9IGZ1bmN0aW9uIGFwcGVuZCAodGV4dCkge1xuICBpZiAodGhpcy5sYXN0ICE9IG51bGwpIHtcbiAgICB0aGlzLmJ1ZmZlciArPSB0aGlzLmxhc3Q7XG4gIH1cbiAgdGhpcy5jaGlsZEJ1ZmZlciArPSB0ZXh0O1xuICByZXR1cm4gdGhpcy5sYXN0ID0gdGV4dDtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLmJyID0gZnVuY3Rpb24gYnIgKCkge1xuICB0aGlzLmFwcGVuZCgnICAnICsgIHRoaXMubGVmdCk7XG4gIHJldHVybiB0aGlzLmF0TGVmdCA9IHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUuY29kZSA9IGZ1bmN0aW9uIGNvZGUgKCkge1xuICB2YXIgb2xkO1xuICBvbGQgPSB0aGlzLmluQ29kZTtcbiAgdGhpcy5pbkNvZGUgPSB0cnVlO1xuICByZXR1cm4gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGFmdGVyICgpIHtcbiAgICAgIHJldHVybiBfdGhpcy5pbkNvZGUgPSBvbGQ7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5saSA9IGZ1bmN0aW9uIGxpICgpIHtcbiAgdmFyIHJlc3VsdDtcbiAgcmVzdWx0ID0gdGhpcy5pbk9yZGVyZWRMaXN0ID8gKHRoaXMub3JkZXIrKykgKyAnLiAnIDogJyogJztcbiAgcmVzdWx0ID0gcGFkTGVmdChyZXN1bHQsICh0aGlzLmxpc3REZXB0aCAtIDEpICogMik7XG4gIHJldHVybiB0aGlzLmFwcGVuZChyZXN1bHQpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUudGQgPSBmdW5jdGlvbiB0ZCAoaGVhZGVyKSB7XG4gIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSBmYWxzZTtcbiAgdGhpcy5vdXRwdXQoJyAnKTtcbiAgdGhpcy5jaGlsZEJ1ZmZlciA9ICcnO1xuICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gZmFsc2U7XG4gIHJldHVybiBmdW5jdGlvbiBhZnRlciAoKSB7XG4gICAgdmFyIHNwYWNlcyA9IGhlYWRlciA/IDAgOiBNYXRoLm1heCgwLCB0aGlzLnRhYmxlQ29sc1t0aGlzLnRhYmxlQ29sKytdIC0gdGhpcy5jaGlsZEJ1ZmZlci5sZW5ndGgpO1xuICAgIHRoaXMuaW5QcmUgPSB0cnVlO1xuICAgIHRoaXMub3V0cHV0KCcgJy5yZXBlYXQoc3BhY2VzICsgMSkgKyAnfCcpO1xuICAgIHRoaXMuaW5QcmUgPSBmYWxzZTtcbiAgICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgfTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLm9sID0gZnVuY3Rpb24gb2wgKCkge1xuICB2YXIgaW5PcmRlcmVkTGlzdCwgb3JkZXI7XG4gIGlmICh0aGlzLmxpc3REZXB0aCA9PT0gMCkge1xuICAgIHRoaXMucCgpO1xuICB9XG4gIGluT3JkZXJlZExpc3QgPSB0aGlzLmluT3JkZXJlZExpc3Q7XG4gIG9yZGVyID0gdGhpcy5vcmRlcjtcbiAgdGhpcy5pbk9yZGVyZWRMaXN0ID0gdHJ1ZTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoKys7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgX3RoaXMuaW5PcmRlcmVkTGlzdCA9IGluT3JkZXJlZExpc3Q7XG4gICAgICBfdGhpcy5vcmRlciA9IG9yZGVyO1xuICAgICAgcmV0dXJuIF90aGlzLmxpc3REZXB0aC0tO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUudWwgPSBmdW5jdGlvbiB1bCAoKSB7XG4gIHZhciBpbk9yZGVyZWRMaXN0LCBvcmRlcjtcbiAgaWYgKHRoaXMubGlzdERlcHRoID09PSAwKSB7XG4gICAgdGhpcy5wKCk7XG4gIH1cbiAgaW5PcmRlcmVkTGlzdCA9IHRoaXMuaW5PcmRlcmVkTGlzdDtcbiAgb3JkZXIgPSB0aGlzLm9yZGVyO1xuICB0aGlzLmluT3JkZXJlZExpc3QgPSBmYWxzZTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoKys7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgX3RoaXMuaW5PcmRlcmVkTGlzdCA9IGluT3JkZXJlZExpc3Q7XG4gICAgICBfdGhpcy5vcmRlciA9IG9yZGVyO1xuICAgICAgcmV0dXJuIF90aGlzLmxpc3REZXB0aC0tO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUub3V0cHV0ID0gZnVuY3Rpb24gb3V0cHV0ICh0ZXh0KSB7XG4gIGlmICghdGV4dCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAoIXRoaXMuaW5QcmUpIHtcbiAgICB0ZXh0ID0gdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA/IHRleHQucmVwbGFjZSgvXlsgXFx0XFxuXSsvLCAnJykgOiAvXlsgXFx0XSpcXG4vLnRlc3QodGV4dCkgPyB0ZXh0LnJlcGxhY2UoL15bIFxcdFxcbl0rLywgJ1xcbicpIDogdGV4dC5yZXBsYWNlKC9eWyBcXHRdKy8sICcgJyk7XG4gIH1cbiAgaWYgKHRleHQgPT09ICcnKSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHRoaXMuYXRQID0gL1xcblxcbiQvLnRlc3QodGV4dCk7XG4gIHRoaXMuYXRMZWZ0ID0gL1xcbiQvLnRlc3QodGV4dCk7XG4gIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSAvWyBcXHRcXG5dJC8udGVzdCh0ZXh0KTtcbiAgcmV0dXJuIHRoaXMuYXBwZW5kKHRleHQucmVwbGFjZSgvXFxuL2csIHRoaXMubGVmdCkpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUub3V0cHV0TGF0ZXIgPSBmdW5jdGlvbiBvdXRwdXRMYXRlciAodGV4dCkge1xuICByZXR1cm4gKGZ1bmN0aW9uKHNlbGYpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgcmV0dXJuIHNlbGYub3V0cHV0KHRleHQpO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucCA9IGZ1bmN0aW9uIHAgKCkge1xuICBpZiAodGhpcy5hdFApIHtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKHRoaXMuc3RhcnRpbmdCbG9ja3F1b3RlKSB7XG4gICAgdGhpcy5hcHBlbmQoJ1xcbicpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuYXBwZW5kKHRoaXMubGVmdCk7XG4gIH1cbiAgaWYgKCF0aGlzLmF0TGVmdCkge1xuICAgIHRoaXMuYXBwZW5kKHRoaXMubGVmdCk7XG4gICAgdGhpcy5hdExlZnQgPSB0cnVlO1xuICB9XG4gIHJldHVybiB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdGhpcy5hdFAgPSB0cnVlO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiBwYXJzZSAoKSB7XG4gIHZhciBjb250YWluZXI7XG4gIHZhciBpO1xuICB2YXIgbGluaztcbiAgdmFyIHJlZjtcbiAgdGhpcy5idWZmZXIgPSAnJztcbiAgaWYgKCF0aGlzLmh0bWwpIHtcbiAgICByZXR1cm4gdGhpcy5idWZmZXI7XG4gIH1cbiAgaWYgKHR5cGVvZiB0aGlzLmh0bWwgPT09ICdzdHJpbmcnKSB7XG4gICAgY29udGFpbmVyID0gdGhpcy53aW5kb3dDb250ZXh0LmRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnRhaW5lci5pbm5lckhUTUwgPSB0aGlzLmh0bWw7XG4gIH0gZWxzZSB7XG4gICAgY29udGFpbmVyID0gdGhpcy5odG1sO1xuICB9XG4gIHRoaXMucHJvY2Vzcyhjb250YWluZXIpO1xuICBpZiAodGhpcy5saW5rcy5sZW5ndGgpIHtcbiAgICB3aGlsZSAodGhpcy5sYXN0RWxlbWVudC5wYXJlbnRFbGVtZW50ICE9PSBjb250YWluZXIgJiYgdGhpcy5sYXN0RWxlbWVudC50YWdOYW1lICE9PSAnQkxPQ0tRVU9URScpIHtcbiAgICAgIHRoaXMubGFzdEVsZW1lbnQgPSB0aGlzLmxhc3RFbGVtZW50LnBhcmVudEVsZW1lbnQ7XG4gICAgfVxuICAgIGlmICh0aGlzLmxhc3RFbGVtZW50LnRhZ05hbWUgIT09ICdCTE9DS1FVT1RFJykge1xuICAgICAgdGhpcy5hcHBlbmQoJ1xcblxcbicpO1xuICAgIH1cbiAgICByZWYgPSB0aGlzLmxpbmtzO1xuICAgIGZvciAoaSA9IDA7IGkgPCByZWYubGVuZ3RoOyBpKyspIHtcbiAgICAgIGxpbmsgPSByZWZbaV07XG4gICAgICBpZiAobGluaykge1xuICAgICAgICB0aGlzLmFwcGVuZCgnWycgKyAoaSArIDEpICsgJ106ICcgKyBsaW5rICsgJ1xcbicpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICB0aGlzLmFwcGVuZCgnJyk7XG4gIHJldHVybiB0aGlzLmJ1ZmZlciA9IHRyaW0odGhpcy5idWZmZXIpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucHJlID0gZnVuY3Rpb24gcHJlICgpIHtcbiAgdmFyIG9sZDtcbiAgb2xkID0gdGhpcy5pblByZTtcbiAgdGhpcy5pblByZSA9IHRydWU7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgcmV0dXJuIF90aGlzLmluUHJlID0gb2xkO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUuaHRtbFRhZyA9IGZ1bmN0aW9uIGh0bWxUYWcgKHR5cGUpIHtcbiAgdGhpcy5vdXRwdXQoJzwnICsgdHlwZSArICc+Jyk7XG4gIHJldHVybiB0aGlzLm91dHB1dExhdGVyKCc8LycgKyB0eXBlICsgJz4nKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnByb2Nlc3MgPSBmdW5jdGlvbiBwcm9jZXNzIChlbCkge1xuICB2YXIgYWZ0ZXI7XG4gIHZhciBiYXNlO1xuICB2YXIgaHJlZjtcbiAgdmFyIGk7XG4gIHZhciByZWY7XG4gIHZhciBzdWZmaXg7XG4gIHZhciBzdW1tYXJ5O1xuICB2YXIgdGl0bGU7XG4gIHZhciBmcmFtZVNyYztcblxuICBpZiAoIXRoaXMuaXNWaXNpYmxlKGVsKSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGlmIChlbC5ub2RlVHlwZSA9PT0gdGhpcy53aW5kb3dDb250ZXh0Lk5vZGUuVEVYVF9OT0RFKSB7XG4gICAgaWYgKGVsLm5vZGVWYWx1ZS5yZXBsYWNlKC9cXG4vZywgJycpLmxlbmd0aCA9PT0gMCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAodGhpcy5pblByZSkge1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0KGVsLm5vZGVWYWx1ZSk7XG4gICAgfVxuICAgIGlmICh0aGlzLmluQ29kZSkge1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0KHByb2Nlc3NDb2RlKGVsLm5vZGVWYWx1ZSkpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5vdXRwdXQocHJvY2Vzc1BsYWluVGV4dChlbC5ub2RlVmFsdWUsIGVsLnBhcmVudEVsZW1lbnQgJiYgZWwucGFyZW50RWxlbWVudC50YWdOYW1lKSk7XG4gIH1cblxuICBpZiAoZWwubm9kZVR5cGUgIT09IHRoaXMud2luZG93Q29udGV4dC5Ob2RlLkVMRU1FTlRfTk9ERSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHRoaXMubGFzdEVsZW1lbnQgPSBlbDtcblxuICB2YXIgdHJhbnNmb3JtZWQgPSB0aGlzLm9wdGlvbnMudHJhbnNmb3JtKGVsKTtcbiAgaWYgKHRyYW5zZm9ybWVkICE9PSB2b2lkIDApIHtcbiAgICByZXR1cm4gdGhpcy5vdXRwdXQodHJhbnNmb3JtZWQpO1xuICB9XG4gIGlmIChzaGFsbG93VGFncy5pbmRleE9mKGVsLnRhZ05hbWUpICE9PSAtMSkge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHN3aXRjaCAoZWwudGFnTmFtZSkge1xuICAgIGNhc2UgJ0gxJzpcbiAgICBjYXNlICdIMic6XG4gICAgY2FzZSAnSDMnOlxuICAgIGNhc2UgJ0g0JzpcbiAgICBjYXNlICdINSc6XG4gICAgY2FzZSAnSDYnOlxuICAgICAgdGhpcy5wKCk7XG4gICAgICB0aGlzLm91dHB1dChtYW55KCcjJywgcGFyc2VJbnQoZWwudGFnTmFtZS5tYXRjaChyaGVhZGluZylbMV0pKSArICcgJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdBRERSRVNTJzpcbiAgICBjYXNlICdBUlRJQ0xFJzpcbiAgICBjYXNlICdBU0lERSc6XG4gICAgY2FzZSAnRElWJzpcbiAgICBjYXNlICdGSUVMRFNFVCc6XG4gICAgY2FzZSAnRk9PVEVSJzpcbiAgICBjYXNlICdIRUFERVInOlxuICAgIGNhc2UgJ05BVic6XG4gICAgY2FzZSAnUCc6XG4gICAgY2FzZSAnU0VDVElPTic6XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0JPRFknOlxuICAgIGNhc2UgJ0ZPUk0nOlxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnREVUQUlMUyc6XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIGlmICghaGFzKGVsLCAnb3BlbicsIGZhbHNlKSkge1xuICAgICAgICBzdW1tYXJ5ID0gZWwuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3N1bW1hcnknKVswXTtcbiAgICAgICAgaWYgKHN1bW1hcnkpIHtcbiAgICAgICAgICB0aGlzLnByb2Nlc3Moc3VtbWFyeSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQlInOlxuICAgICAgdGhpcy5icigpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnSFInOlxuICAgICAgdGhpcy5wKCk7XG4gICAgICB0aGlzLm91dHB1dCgnLS0tLS0tLS0tJyk7XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0NJVEUnOlxuICAgIGNhc2UgJ0RGTic6XG4gICAgY2FzZSAnRU0nOlxuICAgIGNhc2UgJ0knOlxuICAgIGNhc2UgJ1UnOlxuICAgIGNhc2UgJ1ZBUic6XG4gICAgICB0aGlzLm91dHB1dCgnXycpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJ18nKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ01BUksnOlxuICAgICAgdGhpcy5vdXRwdXQoJzxtYXJrPicpO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCc8L21hcms+Jyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdEVCc6XG4gICAgY2FzZSAnQic6XG4gICAgY2FzZSAnU1RST05HJzpcbiAgICAgIGlmIChlbC50YWdOYW1lID09PSAnRFQnKSB7XG4gICAgICAgIHRoaXMucCgpO1xuICAgICAgfVxuICAgICAgdGhpcy5vdXRwdXQoJyoqJyk7XG4gICAgICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgICAgIGFmdGVyID0gdGhpcy5vdXRwdXRMYXRlcignKionKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1EnOlxuICAgICAgdGhpcy5vdXRwdXQoJ1wiJyk7XG4gICAgICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgICAgIGFmdGVyID0gdGhpcy5vdXRwdXRMYXRlcignXCInKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ09MJzpcbiAgICAgIGFmdGVyID0gdGhpcy5vbCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnVUwnOlxuICAgICAgYWZ0ZXIgPSB0aGlzLnVsKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdMSSc6XG4gICAgICB0aGlzLnJlcGxhY2VMZWZ0KCdcXG4nKTtcbiAgICAgIHRoaXMubGkoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ1BSRSc6XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmZlbmNpbmcpIHtcbiAgICAgICAgdGhpcy5hcHBlbmQoJ1xcblxcbicpO1xuICAgICAgICB0aGlzLm91dHB1dChbJ2BgYCcsICdcXG4nXS5qb2luKHRoaXMub3B0aW9ucy5mZW5jaW5nbGFuZ3VhZ2UoZWwpIHx8ICcnKSk7XG4gICAgICAgIGFmdGVyID0gW3RoaXMucHJlKCksIHRoaXMub3V0cHV0TGF0ZXIoJ1xcbmBgYCcpXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGFmdGVyID0gW3RoaXMucHVzaExlZnQoJyAgICAnKSwgdGhpcy5wcmUoKV07XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdDT0RFJzpcbiAgICBjYXNlICdTQU1QJzpcbiAgICAgIGlmICh0aGlzLmluUHJlKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGhpcy5vdXRwdXQoJ2AnKTtcbiAgICAgIGFmdGVyID0gW3RoaXMuY29kZSgpLCB0aGlzLm91dHB1dExhdGVyKCdgJyldO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQkxPQ0tRVU9URSc6XG4gICAgY2FzZSAnREQnOlxuICAgICAgdGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLnB1c2hMZWZ0KCc+ICcpO1xuICAgICAgdGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUgPSBmYWxzZTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0tCRCc6XG4gICAgICBhZnRlciA9IHRoaXMuaHRtbFRhZygna2JkJyk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdBJzpcbiAgICBjYXNlICdJTUcnOlxuICAgICAgaHJlZiA9IGF0dHIoZWwsIGVsLnRhZ05hbWUgPT09ICdBJyA/ICdocmVmJyA6ICdzcmMnLCB0aGlzLm9wdGlvbnMuYWJzb2x1dGUpO1xuICAgICAgaWYgKCFocmVmKSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgICAgdGl0bGUgPSBhdHRyKGVsLCAndGl0bGUnKTtcbiAgICAgIGlmICh0aXRsZSkge1xuICAgICAgICBocmVmICs9ICcgXCInICsgdGl0bGUgKyAnXCInO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMub3B0aW9ucy5pbmxpbmUpIHtcbiAgICAgICAgc3VmZml4ID0gJygnICsgaHJlZiArICcpJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1ZmZpeCA9ICdbJyArICgoYmFzZSA9IHRoaXMubGlua01hcClbaHJlZl0gIT0gbnVsbCA/IGJhc2VbaHJlZl0gOiBiYXNlW2hyZWZdID0gdGhpcy5saW5rcy5wdXNoKGhyZWYpKSArICddJztcbiAgICAgIH1cbiAgICAgIGlmIChlbC50YWdOYW1lID09PSAnSU1HJykge1xuICAgICAgICB0aGlzLm91dHB1dCgnIVsnICsgYXR0cihlbCwgJ2FsdCcpICsgJ10nICsgc3VmZml4KTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdGhpcy5vdXRwdXQoJ1snKTtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCddJyArIHN1ZmZpeCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdJRlJBTUUnOlxuICAgICAgdHJ5IHtcbiAgICAgICAgaWYgKChyZWYgPSBlbC5jb250ZW50RG9jdW1lbnQpICE9IG51bGwgPyByZWYuZG9jdW1lbnRFbGVtZW50IDogdm9pZCAwKSB7XG4gICAgICAgICAgdGhpcy5wcm9jZXNzKGVsLmNvbnRlbnREb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZyYW1lU3JjID0gYXR0cihlbCwgJ3NyYycpO1xuICAgICAgICAgIGlmIChmcmFtZVNyYyAmJiB0aGlzLm9wdGlvbnMuYWxsb3dGcmFtZSAmJiB0aGlzLm9wdGlvbnMuYWxsb3dGcmFtZShmcmFtZVNyYykpIHtcbiAgICAgICAgICAgIHRoaXMub3V0cHV0KCc8aWZyYW1lIHNyYz1cIicgKyBmcmFtZVNyYyArICdcIj48L2lmcmFtZT4nKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICB9XG5cbiAgYWZ0ZXIgPSB0aGlzLnRhYmxlcyhlbCkgfHwgYWZ0ZXI7XG5cbiAgZm9yIChpID0gMDsgaSA8IGVsLmNoaWxkTm9kZXMubGVuZ3RoOyBpKyspIHtcbiAgICB0aGlzLnByb2Nlc3MoZWwuY2hpbGROb2Rlc1tpXSk7XG4gIH1cblxuICBpZiAodHlwZW9mIGFmdGVyID09PSAnZnVuY3Rpb24nKSB7XG4gICAgYWZ0ZXIgPSBbYWZ0ZXJdO1xuICB9XG4gIHdoaWxlIChhZnRlciAmJiBhZnRlci5sZW5ndGgpIHtcbiAgICBhZnRlci5zaGlmdCgpLmNhbGwodGhpcyk7XG4gIH1cbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnRhYmxlcyA9IGZ1bmN0aW9uIHRhYmxlcyAoZWwpIHtcbiAgaWYgKHRoaXMub3B0aW9ucy50YWJsZXMgPT09IGZhbHNlKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdmFyIG5hbWUgPSBlbC50YWdOYW1lO1xuICBpZiAobmFtZSA9PT0gJ1RBQkxFJykge1xuICAgIHRoaXMudGFibGVDb2xzID0gW107XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmIChuYW1lID09PSAnVEhFQUQnKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGFmdGVyICgpIHtcbiAgICAgIHJldHVybiB0aGlzLm91dHB1dCgnfCcgKyB0aGlzLnRhYmxlQ29scy5yZWR1Y2UoZnVuY3Rpb24gKHRoLCB0Yykge1xuICAgICAgICByZXR1cm4gdGggKyAnLScucmVwZWF0KHRjICsgMikgKyAnfCc7XG4gICAgICB9LCAnJykpO1xuICAgIH07XG4gIH1cbiAgaWYgKG5hbWUgPT09ICdUSCcpIHtcbiAgICByZXR1cm4gW2Z1bmN0aW9uIGFmdGVyICgpIHtcbiAgICAgIHRoaXMudGFibGVDb2xzLnB1c2godGhpcy5jaGlsZEJ1ZmZlci5sZW5ndGgpO1xuICAgIH0sIHRoaXMudGQodHJ1ZSldO1xuICB9XG4gIGlmIChuYW1lID09PSAnVFInKSB7XG4gICAgdGhpcy50YWJsZUNvbCA9IDA7XG4gICAgdGhpcy5vdXRwdXQoJ3wnKTtcbiAgICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgdGhpcy5vdXRwdXQoJ1xcbicpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IGZhbHNlO1xuICAgIH07XG4gIH1cbiAgaWYgKG5hbWUgPT09ICdURCcpIHtcbiAgICByZXR1cm4gdGhpcy50ZCgpO1xuICB9XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5wdXNoTGVmdCA9IGZ1bmN0aW9uIHB1c2hMZWZ0ICh0ZXh0KSB7XG4gIHZhciBvbGQ7XG4gIG9sZCA9IHRoaXMubGVmdDtcbiAgdGhpcy5sZWZ0ICs9IHRleHQ7XG4gIGlmICh0aGlzLmF0UCkge1xuICAgIHRoaXMuYXBwZW5kKHRleHQpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMucCgpO1xuICB9XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICBfdGhpcy5sZWZ0ID0gb2xkO1xuICAgICAgX3RoaXMuYXRMZWZ0ID0gX3RoaXMuYXRQID0gZmFsc2U7XG4gICAgICByZXR1cm4gX3RoaXMucCgpO1xuICAgIH07XG4gIH0pKHRoaXMpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucmVwbGFjZUxlZnQgPSBmdW5jdGlvbiByZXBsYWNlTGVmdCAodGV4dCkge1xuICBpZiAoIXRoaXMuYXRMZWZ0KSB7XG4gICAgdGhpcy5hcHBlbmQodGhpcy5sZWZ0LnJlcGxhY2UoL1sgXXsyLDR9JC8sIHRleHQpKTtcbiAgICByZXR1cm4gdGhpcy5hdExlZnQgPSB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdGhpcy5hdFAgPSB0cnVlO1xuICB9IGVsc2UgaWYgKHRoaXMubGFzdCkge1xuICAgIHJldHVybiB0aGlzLmxhc3QgPSB0aGlzLmxhc3QucmVwbGFjZSgvWyBdezIsNH0kLywgdGV4dCk7XG4gIH1cbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLmlzVmlzaWJsZSA9IGZ1bmN0aW9uIGlzVmlzaWJsZSAoZWwpIHtcbiAgdmFyIGRpc3BsYXk7XG4gIHZhciBpO1xuICB2YXIgcHJvcGVydHk7XG4gIHZhciB2aXNpYmlsaXR5O1xuICB2YXIgdmlzaWJsZSA9IHRydWU7XG4gIHZhciBzdHlsZSA9IGF0dHIoZWwsICdzdHlsZScsIGZhbHNlKTtcbiAgdmFyIHByb3BlcnRpZXMgPSBzdHlsZSAhPSBudWxsID8gdHlwZW9mIHN0eWxlLm1hdGNoID09PSAnZnVuY3Rpb24nID8gc3R5bGUubWF0Y2gocmRpc3BsYXkpIDogdm9pZCAwIDogdm9pZCAwO1xuICBpZiAocHJvcGVydGllcyAhPSBudWxsKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IHByb3BlcnRpZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIHByb3BlcnR5ID0gcHJvcGVydGllc1tpXTtcbiAgICAgIHZpc2libGUgPSAhcmhpZGRlbi50ZXN0KHByb3BlcnR5KTtcbiAgICB9XG4gIH1cbiAgaWYgKHZpc2libGUgJiYgdHlwZW9mIHRoaXMud2luZG93Q29udGV4dC5nZXRDb21wdXRlZFN0eWxlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdHJ5IHtcbiAgICAgIHN0eWxlID0gdGhpcy53aW5kb3dDb250ZXh0LmdldENvbXB1dGVkU3R5bGUoZWwsIG51bGwpO1xuICAgICAgaWYgKHR5cGVvZiAoc3R5bGUgIT0gbnVsbCA/IHN0eWxlLmdldFByb3BlcnR5VmFsdWUgOiB2b2lkIDApID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIGRpc3BsYXkgPSBzdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCdkaXNwbGF5Jyk7XG4gICAgICAgIHZpc2liaWxpdHkgPSBzdHlsZS5nZXRQcm9wZXJ0eVZhbHVlKCd2aXNpYmlsaXR5Jyk7XG4gICAgICAgIHZpc2libGUgPSBkaXNwbGF5ICE9PSAnbm9uZScgJiYgdmlzaWJpbGl0eSAhPT0gJ2hpZGRlbic7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgfVxuICB9XG4gIHJldHVybiB2aXNpYmxlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBwYXJzZTtcbiIsIi8qISBodHRwOi8vbXRocy5iZS9yZXBlYXQgdjAuMi4wIGJ5IEBtYXRoaWFzICovXG5pZiAoIVN0cmluZy5wcm90b3R5cGUucmVwZWF0KSB7XG5cdChmdW5jdGlvbigpIHtcblx0XHQndXNlIHN0cmljdCc7IC8vIG5lZWRlZCB0byBzdXBwb3J0IGBhcHBseWAvYGNhbGxgIHdpdGggYHVuZGVmaW5lZGAvYG51bGxgXG5cdFx0dmFyIGRlZmluZVByb3BlcnR5ID0gKGZ1bmN0aW9uKCkge1xuXHRcdFx0Ly8gSUUgOCBvbmx5IHN1cHBvcnRzIGBPYmplY3QuZGVmaW5lUHJvcGVydHlgIG9uIERPTSBlbGVtZW50c1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dmFyIG9iamVjdCA9IHt9O1xuXHRcdFx0XHR2YXIgJGRlZmluZVByb3BlcnR5ID0gT2JqZWN0LmRlZmluZVByb3BlcnR5O1xuXHRcdFx0XHR2YXIgcmVzdWx0ID0gJGRlZmluZVByb3BlcnR5KG9iamVjdCwgb2JqZWN0LCBvYmplY3QpICYmICRkZWZpbmVQcm9wZXJ0eTtcblx0XHRcdH0gY2F0Y2goZXJyb3IpIHt9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0oKSk7XG5cdFx0dmFyIHJlcGVhdCA9IGZ1bmN0aW9uKGNvdW50KSB7XG5cdFx0XHRpZiAodGhpcyA9PSBudWxsKSB7XG5cdFx0XHRcdHRocm93IFR5cGVFcnJvcigpO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHN0cmluZyA9IFN0cmluZyh0aGlzKTtcblx0XHRcdC8vIGBUb0ludGVnZXJgXG5cdFx0XHR2YXIgbiA9IGNvdW50ID8gTnVtYmVyKGNvdW50KSA6IDA7XG5cdFx0XHRpZiAobiAhPSBuKSB7IC8vIGJldHRlciBgaXNOYU5gXG5cdFx0XHRcdG4gPSAwO1xuXHRcdFx0fVxuXHRcdFx0Ly8gQWNjb3VudCBmb3Igb3V0LW9mLWJvdW5kcyBpbmRpY2VzXG5cdFx0XHRpZiAobiA8IDAgfHwgbiA9PSBJbmZpbml0eSkge1xuXHRcdFx0XHR0aHJvdyBSYW5nZUVycm9yKCk7XG5cdFx0XHR9XG5cdFx0XHR2YXIgcmVzdWx0ID0gJyc7XG5cdFx0XHR3aGlsZSAobikge1xuXHRcdFx0XHRpZiAobiAlIDIgPT0gMSkge1xuXHRcdFx0XHRcdHJlc3VsdCArPSBzdHJpbmc7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG4gPiAxKSB7XG5cdFx0XHRcdFx0c3RyaW5nICs9IHN0cmluZztcblx0XHRcdFx0fVxuXHRcdFx0XHRuID4+PSAxO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9O1xuXHRcdGlmIChkZWZpbmVQcm9wZXJ0eSkge1xuXHRcdFx0ZGVmaW5lUHJvcGVydHkoU3RyaW5nLnByb3RvdHlwZSwgJ3JlcGVhdCcsIHtcblx0XHRcdFx0J3ZhbHVlJzogcmVwZWF0LFxuXHRcdFx0XHQnY29uZmlndXJhYmxlJzogdHJ1ZSxcblx0XHRcdFx0J3dyaXRhYmxlJzogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdFN0cmluZy5wcm90b3R5cGUucmVwZWF0ID0gcmVwZWF0O1xuXHRcdH1cblx0fSgpKTtcbn1cbiIsIid1c2Ugc3RyaWN0JztcblxuaWYgKCF3aW5kb3cuTm9kZSkge1xuICB3aW5kb3cuTm9kZSA9IHtcbiAgICBFTEVNRU5UX05PREU6IDEsXG4gICAgVEVYVF9OT0RFOiAzXG4gIH07XG59XG5cbmZ1bmN0aW9uIHdpbmRvd0NvbnRleHQgKCkge1xuICByZXR1cm4gd2luZG93O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHdpbmRvd0NvbnRleHQ7XG4iXX0=
