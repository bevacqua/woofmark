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
      this.noTrailingWhitespace = false;
      return this.output('|' + this.tableCols.reduce(function (th, tc) {
        return th + '-'.repeat(tc + 2) + '|';
      }, '') + '\n');
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
      this.noTrailingWhitespace = false;
      this.output('\n');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJkb21hZG9yLmpzIiwibm9kZV9tb2R1bGVzL3N0cmluZy5wcm90b3R5cGUucmVwZWF0L3JlcGVhdC5qcyIsIndpbmRvd0NvbnRleHQuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNybEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIid1c2Ugc3RyaWN0JztcblxucmVxdWlyZSgnc3RyaW5nLnByb3RvdHlwZS5yZXBlYXQnKTtcblxudmFyIHJlcGxhY2VtZW50cyA9IHtcbiAgJ1xcXFxcXFxcJzogJ1xcXFxcXFxcJyxcbiAgJ1xcXFxbJzogJ1xcXFxbJyxcbiAgJ1xcXFxdJzogJ1xcXFxdJyxcbiAgJz4nOiAnXFxcXD4nLFxuICAnXyc6ICdcXFxcXycsXG4gICdcXFxcKic6ICdcXFxcKicsXG4gICdgJzogJ1xcXFxgJyxcbiAgJyMnOiAnXFxcXCMnLFxuICAnKFswLTldKVxcXFwuKFxcXFxzfCQpJzogJyQxXFxcXC4kMicsXG4gICdcXHUwMGE5JzogJyhjKScsXG4gICdcXHUwMGFlJzogJyhyKScsXG4gICdcXHUyMTIyJzogJyh0bSknLFxuICAnXFx1MDBhMCc6ICcgJyxcbiAgJ1xcdTAwYjcnOiAnXFxcXConLFxuICAnXFx1MjAwMic6ICcgJyxcbiAgJ1xcdTIwMDMnOiAnICcsXG4gICdcXHUyMDA5JzogJyAnLFxuICAnXFx1MjAxOCc6ICdcXCcnLFxuICAnXFx1MjAxOSc6ICdcXCcnLFxuICAnXFx1MjAxYyc6ICdcIicsXG4gICdcXHUyMDFkJzogJ1wiJyxcbiAgJ1xcdTIwMjYnOiAnLi4uJyxcbiAgJ1xcdTIwMTMnOiAnLS0nLFxuICAnXFx1MjAxNCc6ICctLS0nXG59O1xudmFyIHJlcGxhY2VycyA9IE9iamVjdC5rZXlzKHJlcGxhY2VtZW50cykucmVkdWNlKHJlcGxhY2VyLCB7fSk7XG52YXIgcnNwYWNlcyA9IC9eXFxzK3xcXHMrJC9nO1xudmFyIHJkaXNwbGF5ID0gLyhkaXNwbGF5fHZpc2liaWxpdHkpXFxzKjpcXHMqW2Etel0rL2dpO1xudmFyIHJoaWRkZW4gPSAvKG5vbmV8aGlkZGVuKVxccyokL2k7XG52YXIgcmhlYWRpbmcgPSAvXkgoWzEtNl0pJC87XG52YXIgc2hhbGxvd1RhZ3MgPSBbXG4gICdBUFBMRVQnLCAnQVJFQScsICdBVURJTycsICdCVVRUT04nLCAnQ0FOVkFTJywgJ0RBVEFMSVNUJywgJ0VNQkVEJywgJ0hFQUQnLCAnSU5QVVQnLCAnTUFQJyxcbiAgJ01FTlUnLCAnTUVURVInLCAnTk9GUkFNRVMnLCAnTk9TQ1JJUFQnLCAnT0JKRUNUJywgJ09QVEdST1VQJywgJ09QVElPTicsICdQQVJBTScsICdQUk9HUkVTUycsXG4gICdSUCcsICdSVCcsICdSVUJZJywgJ1NDUklQVCcsICdTRUxFQ1QnLCAnU1RZTEUnLCAnVEVYVEFSRUEnLCAnVElUTEUnLCAnVklERU8nXG5dO1xudmFyIHBhcmFncmFwaFRhZ3MgPSBbXG4gICdBRERSRVNTJywgJ0FSVElDTEUnLCAnQVNJREUnLCAnRElWJywgJ0ZJRUxEU0VUJywgJ0ZPT1RFUicsICdIRUFERVInLCAnTkFWJywgJ1AnLCAnU0VDVElPTidcbl07XG52YXIgd2luZG93Q29udGV4dCA9IHJlcXVpcmUoJy4vdmlydHVhbFdpbmRvd0NvbnRleHQnKTtcblxuZnVuY3Rpb24gcmVwbGFjZXIgKHJlc3VsdCwga2V5KSB7XG4gIHJlc3VsdFtrZXldID0gbmV3IFJlZ0V4cChrZXksICdnJyk7IHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIG1hbnkgKHRleHQsIHRpbWVzKSB7XG4gIHJldHVybiBuZXcgQXJyYXkodGltZXMgKyAxKS5qb2luKHRleHQpO1xufVxuXG5mdW5jdGlvbiBwYWRMZWZ0ICh0ZXh0LCB0aW1lcykge1xuICByZXR1cm4gbWFueSgnICcsIHRpbWVzKSArIHRleHQ7XG59XG5cbmZ1bmN0aW9uIHRyaW0gKHRleHQpIHtcbiAgaWYgKHRleHQudHJpbSkge1xuICAgIHJldHVybiB0ZXh0LnRyaW0oKTtcbiAgfVxuICByZXR1cm4gdGV4dC5yZXBsYWNlKHJzcGFjZXMsICcnKTtcbn1cblxuZnVuY3Rpb24gYXR0ciAoZWwsIHByb3AsIGRpcmVjdCkge1xuICB2YXIgcHJvcGVyID0gZGlyZWN0ID09PSB2b2lkIDAgfHwgZGlyZWN0O1xuICBpZiAocHJvcGVyIHx8IHR5cGVvZiBlbC5nZXRBdHRyaWJ1dGUgIT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gZWxbcHJvcF0gfHwgJyc7XG4gIH1cbiAgcmV0dXJuIGVsLmdldEF0dHJpYnV0ZShwcm9wKSB8fCAnJztcbn1cblxuZnVuY3Rpb24gaGFzIChlbCwgcHJvcCwgZGlyZWN0KSB7XG4gIHZhciBwcm9wZXIgPSBkaXJlY3QgPT09IHZvaWQgMCB8fCBkaXJlY3Q7XG4gIGlmIChwcm9wZXIgfHwgdHlwZW9mIGVsLmhhc0F0dHJpYnV0ZSAhPT0gJ2Z1bmN0aW9uJykge1xuICAgIHJldHVybiBlbC5oYXNPd25Qcm9wZXJ0eShwcm9wKTtcbiAgfVxuICByZXR1cm4gZWwuaGFzQXR0cmlidXRlKHByb3ApO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzUGxhaW5UZXh0ICh0ZXh0LCB0YWdOYW1lKSB7XG4gIHZhciBrZXk7XG4gIHZhciBibG9jayA9IHBhcmFncmFwaFRhZ3MuaW5kZXhPZih0YWdOYW1lKSAhPT0gLTEgfHwgdGFnTmFtZSA9PT0gJ0JMT0NLUVVPVEUnO1xuICB0ZXh0ID0gdGV4dC5yZXBsYWNlKC9cXG4oWyBcXHRdKlxcbikrL2csICdcXG4nKTtcbiAgdGV4dCA9IHRleHQucmVwbGFjZSgvXFxuWyBcXHRdKy9nLCAnXFxuJyk7XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoL1sgXFx0XSsvZywgJyAnKTtcbiAgZm9yIChrZXkgaW4gcmVwbGFjZW1lbnRzKSB7XG4gICAgdGV4dCA9IHRleHQucmVwbGFjZShyZXBsYWNlcnNba2V5XSwgcmVwbGFjZW1lbnRzW2tleV0pO1xuICB9XG4gIHRleHQgPSB0ZXh0LnJlcGxhY2UoLyhcXHMqKVxcXFwjL2csIGJsb2NrID8gcmVtb3ZlVW5uZWNlc3NhcnlFc2NhcGVzIDogJyQxIycpO1xuICByZXR1cm4gdGV4dDtcblxuICBmdW5jdGlvbiByZW1vdmVVbm5lY2Vzc2FyeUVzY2FwZXMgKGVzY2FwZWQsIHNwYWNlcywgaSkge1xuICAgIHJldHVybiBpID8gc3BhY2VzICsgJyMnIDogZXNjYXBlZDtcbiAgfVxufVxuXG5mdW5jdGlvbiBwcm9jZXNzQ29kZSAodGV4dCkge1xuICByZXR1cm4gdGV4dC5yZXBsYWNlKC9gL2csICdcXFxcYCcpO1xufVxuXG5mdW5jdGlvbiBub29wICgpIHt9XG5cbmZ1bmN0aW9uIHBhcnNlIChodG1sLCBvcHRpb25zKSB7XG4gIHJldHVybiBuZXcgRG9tYWRvcihodG1sLCBvcHRpb25zKS5wYXJzZSgpO1xufVxuXG5mdW5jdGlvbiBEb21hZG9yIChodG1sLCBvcHRpb25zKSB7XG4gIHRoaXMuaHRtbCA9IGh0bWwgIT0gbnVsbCA/IGh0bWwgOiAnJztcbiAgdGhpcy5vcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcbiAgdGhpcy53aW5kb3dDb250ZXh0ID0gd2luZG93Q29udGV4dCh0aGlzLm9wdGlvbnMpO1xuICB0aGlzLmF0TGVmdCA9IHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLmF0UCA9IHRydWU7XG4gIHRoaXMuYnVmZmVyID0gdGhpcy5jaGlsZEJ1ZmZlciA9ICcnO1xuICB0aGlzLmV4Y2VwdGlvbnMgPSBbXTtcbiAgdGhpcy5vcmRlciA9IDE7XG4gIHRoaXMubGlzdERlcHRoID0gMDtcbiAgdGhpcy5pbkNvZGUgPSB0aGlzLmluUHJlID0gdGhpcy5pbk9yZGVyZWRMaXN0ID0gZmFsc2U7XG4gIHRoaXMubGFzdCA9IG51bGw7XG4gIHRoaXMubGVmdCA9ICdcXG4nO1xuICB0aGlzLmxpbmtzID0gW107XG4gIHRoaXMubGlua01hcCA9IHt9O1xuICB0aGlzLnVuaGFuZGxlZCA9IHt9O1xuICBpZiAodGhpcy5vcHRpb25zLmFic29sdXRlID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLmFic29sdXRlID0gZmFsc2U7IH1cbiAgaWYgKHRoaXMub3B0aW9ucy5mZW5jaW5nID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLmZlbmNpbmcgPSBmYWxzZTsgfVxuICBpZiAodGhpcy5vcHRpb25zLmZlbmNpbmdsYW5ndWFnZSA9PT0gdm9pZCAwKSB7IHRoaXMub3B0aW9ucy5mZW5jaW5nbGFuZ3VhZ2UgPSBub29wOyB9XG4gIGlmICh0aGlzLm9wdGlvbnMudHJhbnNmb3JtID09PSB2b2lkIDApIHsgdGhpcy5vcHRpb25zLnRyYW5zZm9ybSA9IG5vb3A7IH1cbn1cblxuRG9tYWRvci5wcm90b3R5cGUuYXBwZW5kID0gZnVuY3Rpb24gYXBwZW5kICh0ZXh0KSB7XG4gIGlmICh0aGlzLmxhc3QgIT0gbnVsbCkge1xuICAgIHRoaXMuYnVmZmVyICs9IHRoaXMubGFzdDtcbiAgfVxuICB0aGlzLmNoaWxkQnVmZmVyICs9IHRleHQ7XG4gIHJldHVybiB0aGlzLmxhc3QgPSB0ZXh0O1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUuYnIgPSBmdW5jdGlvbiBiciAoKSB7XG4gIHRoaXMuYXBwZW5kKCcgICcgKyAgdGhpcy5sZWZ0KTtcbiAgcmV0dXJuIHRoaXMuYXRMZWZ0ID0gdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5jb2RlID0gZnVuY3Rpb24gY29kZSAoKSB7XG4gIHZhciBvbGQ7XG4gIG9sZCA9IHRoaXMuaW5Db2RlO1xuICB0aGlzLmluQ29kZSA9IHRydWU7XG4gIHJldHVybiAoZnVuY3Rpb24oX3RoaXMpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgcmV0dXJuIF90aGlzLmluQ29kZSA9IG9sZDtcbiAgICB9O1xuICB9KSh0aGlzKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLmxpID0gZnVuY3Rpb24gbGkgKCkge1xuICB2YXIgcmVzdWx0O1xuICByZXN1bHQgPSB0aGlzLmluT3JkZXJlZExpc3QgPyAodGhpcy5vcmRlcisrKSArICcuICcgOiAnKiAnO1xuICByZXN1bHQgPSBwYWRMZWZ0KHJlc3VsdCwgKHRoaXMubGlzdERlcHRoIC0gMSkgKiAyKTtcbiAgcmV0dXJuIHRoaXMuYXBwZW5kKHJlc3VsdCk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS50ZCA9IGZ1bmN0aW9uIHRkIChoZWFkZXIpIHtcbiAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IGZhbHNlO1xuICB0aGlzLm91dHB1dCgnICcpO1xuICB0aGlzLmNoaWxkQnVmZmVyID0gJyc7XG4gIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSBmYWxzZTtcbiAgcmV0dXJuIGZ1bmN0aW9uIGFmdGVyICgpIHtcbiAgICB2YXIgc3BhY2VzID0gaGVhZGVyID8gMCA6IE1hdGgubWF4KDAsIHRoaXMudGFibGVDb2xzW3RoaXMudGFibGVDb2wrK10gLSB0aGlzLmNoaWxkQnVmZmVyLmxlbmd0aCk7XG4gICAgdGhpcy5pblByZSA9IHRydWU7XG4gICAgdGhpcy5vdXRwdXQoJyAnLnJlcGVhdChzcGFjZXMgKyAxKSArICd8Jyk7XG4gICAgdGhpcy5pblByZSA9IGZhbHNlO1xuICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICB9O1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUub2wgPSBmdW5jdGlvbiBvbCAoKSB7XG4gIHZhciBpbk9yZGVyZWRMaXN0LCBvcmRlcjtcbiAgaWYgKHRoaXMubGlzdERlcHRoID09PSAwKSB7XG4gICAgdGhpcy5wKCk7XG4gIH1cbiAgaW5PcmRlcmVkTGlzdCA9IHRoaXMuaW5PcmRlcmVkTGlzdDtcbiAgb3JkZXIgPSB0aGlzLm9yZGVyO1xuICB0aGlzLmluT3JkZXJlZExpc3QgPSB0cnVlO1xuICB0aGlzLm9yZGVyID0gMTtcbiAgdGhpcy5saXN0RGVwdGgrKztcbiAgcmV0dXJuIChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhZnRlciAoKSB7XG4gICAgICBfdGhpcy5pbk9yZGVyZWRMaXN0ID0gaW5PcmRlcmVkTGlzdDtcbiAgICAgIF90aGlzLm9yZGVyID0gb3JkZXI7XG4gICAgICByZXR1cm4gX3RoaXMubGlzdERlcHRoLS07XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS51bCA9IGZ1bmN0aW9uIHVsICgpIHtcbiAgdmFyIGluT3JkZXJlZExpc3QsIG9yZGVyO1xuICBpZiAodGhpcy5saXN0RGVwdGggPT09IDApIHtcbiAgICB0aGlzLnAoKTtcbiAgfVxuICBpbk9yZGVyZWRMaXN0ID0gdGhpcy5pbk9yZGVyZWRMaXN0O1xuICBvcmRlciA9IHRoaXMub3JkZXI7XG4gIHRoaXMuaW5PcmRlcmVkTGlzdCA9IGZhbHNlO1xuICB0aGlzLm9yZGVyID0gMTtcbiAgdGhpcy5saXN0RGVwdGgrKztcbiAgcmV0dXJuIChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhZnRlciAoKSB7XG4gICAgICBfdGhpcy5pbk9yZGVyZWRMaXN0ID0gaW5PcmRlcmVkTGlzdDtcbiAgICAgIF90aGlzLm9yZGVyID0gb3JkZXI7XG4gICAgICByZXR1cm4gX3RoaXMubGlzdERlcHRoLS07XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5vdXRwdXQgPSBmdW5jdGlvbiBvdXRwdXQgKHRleHQpIHtcbiAgaWYgKCF0ZXh0KSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIGlmICghdGhpcy5pblByZSkge1xuICAgIHRleHQgPSB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID8gdGV4dC5yZXBsYWNlKC9eWyBcXHRcXG5dKy8sICcnKSA6IC9eWyBcXHRdKlxcbi8udGVzdCh0ZXh0KSA/IHRleHQucmVwbGFjZSgvXlsgXFx0XFxuXSsvLCAnXFxuJykgOiB0ZXh0LnJlcGxhY2UoL15bIFxcdF0rLywgJyAnKTtcbiAgfVxuICBpZiAodGV4dCA9PT0gJycpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdGhpcy5hdFAgPSAvXFxuXFxuJC8udGVzdCh0ZXh0KTtcbiAgdGhpcy5hdExlZnQgPSAvXFxuJC8udGVzdCh0ZXh0KTtcbiAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IC9bIFxcdFxcbl0kLy50ZXN0KHRleHQpO1xuICByZXR1cm4gdGhpcy5hcHBlbmQodGV4dC5yZXBsYWNlKC9cXG4vZywgdGhpcy5sZWZ0KSk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5vdXRwdXRMYXRlciA9IGZ1bmN0aW9uIG91dHB1dExhdGVyICh0ZXh0KSB7XG4gIHJldHVybiAoZnVuY3Rpb24oc2VsZikge1xuICAgIHJldHVybiBmdW5jdGlvbiBhZnRlciAoKSB7XG4gICAgICByZXR1cm4gc2VsZi5vdXRwdXQodGV4dCk7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5wID0gZnVuY3Rpb24gcCAoKSB7XG4gIGlmICh0aGlzLmF0UCkge1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAodGhpcy5zdGFydGluZ0Jsb2NrcXVvdGUpIHtcbiAgICB0aGlzLmFwcGVuZCgnXFxuJyk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy5hcHBlbmQodGhpcy5sZWZ0KTtcbiAgfVxuICBpZiAoIXRoaXMuYXRMZWZ0KSB7XG4gICAgdGhpcy5hcHBlbmQodGhpcy5sZWZ0KTtcbiAgICB0aGlzLmF0TGVmdCA9IHRydWU7XG4gIH1cbiAgcmV0dXJuIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0aGlzLmF0UCA9IHRydWU7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIHBhcnNlICgpIHtcbiAgdmFyIGNvbnRhaW5lcjtcbiAgdmFyIGk7XG4gIHZhciBsaW5rO1xuICB2YXIgcmVmO1xuICB0aGlzLmJ1ZmZlciA9ICcnO1xuICBpZiAoIXRoaXMuaHRtbCkge1xuICAgIHJldHVybiB0aGlzLmJ1ZmZlcjtcbiAgfVxuICBpZiAodHlwZW9mIHRoaXMuaHRtbCA9PT0gJ3N0cmluZycpIHtcbiAgICBjb250YWluZXIgPSB0aGlzLndpbmRvd0NvbnRleHQuZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgY29udGFpbmVyLmlubmVySFRNTCA9IHRoaXMuaHRtbDtcbiAgfSBlbHNlIHtcbiAgICBjb250YWluZXIgPSB0aGlzLmh0bWw7XG4gIH1cbiAgdGhpcy5wcm9jZXNzKGNvbnRhaW5lcik7XG4gIGlmICh0aGlzLmxpbmtzLmxlbmd0aCkge1xuICAgIHdoaWxlICh0aGlzLmxhc3RFbGVtZW50LnBhcmVudEVsZW1lbnQgIT09IGNvbnRhaW5lciAmJiB0aGlzLmxhc3RFbGVtZW50LnRhZ05hbWUgIT09ICdCTE9DS1FVT1RFJykge1xuICAgICAgdGhpcy5sYXN0RWxlbWVudCA9IHRoaXMubGFzdEVsZW1lbnQucGFyZW50RWxlbWVudDtcbiAgICB9XG4gICAgaWYgKHRoaXMubGFzdEVsZW1lbnQudGFnTmFtZSAhPT0gJ0JMT0NLUVVPVEUnKSB7XG4gICAgICB0aGlzLmFwcGVuZCgnXFxuXFxuJyk7XG4gICAgfVxuICAgIHJlZiA9IHRoaXMubGlua3M7XG4gICAgZm9yIChpID0gMDsgaSA8IHJlZi5sZW5ndGg7IGkrKykge1xuICAgICAgbGluayA9IHJlZltpXTtcbiAgICAgIGlmIChsaW5rKSB7XG4gICAgICAgIHRoaXMuYXBwZW5kKCdbJyArIChpICsgMSkgKyAnXTogJyArIGxpbmsgKyAnXFxuJyk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHRoaXMuYXBwZW5kKCcnKTtcbiAgcmV0dXJuIHRoaXMuYnVmZmVyID0gdHJpbSh0aGlzLmJ1ZmZlcik7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5wcmUgPSBmdW5jdGlvbiBwcmUgKCkge1xuICB2YXIgb2xkO1xuICBvbGQgPSB0aGlzLmluUHJlO1xuICB0aGlzLmluUHJlID0gdHJ1ZTtcbiAgcmV0dXJuIChmdW5jdGlvbihfdGhpcykge1xuICAgIHJldHVybiBmdW5jdGlvbiBhZnRlciAoKSB7XG4gICAgICByZXR1cm4gX3RoaXMuaW5QcmUgPSBvbGQ7XG4gICAgfTtcbiAgfSkodGhpcyk7XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5odG1sVGFnID0gZnVuY3Rpb24gaHRtbFRhZyAodHlwZSkge1xuICB0aGlzLm91dHB1dCgnPCcgKyB0eXBlICsgJz4nKTtcbiAgcmV0dXJuIHRoaXMub3V0cHV0TGF0ZXIoJzwvJyArIHR5cGUgKyAnPicpO1xufTtcblxuRG9tYWRvci5wcm90b3R5cGUucHJvY2VzcyA9IGZ1bmN0aW9uIHByb2Nlc3MgKGVsKSB7XG4gIHZhciBhZnRlcjtcbiAgdmFyIGJhc2U7XG4gIHZhciBocmVmO1xuICB2YXIgaTtcbiAgdmFyIHJlZjtcbiAgdmFyIHN1ZmZpeDtcbiAgdmFyIHN1bW1hcnk7XG4gIHZhciB0aXRsZTtcbiAgdmFyIGZyYW1lU3JjO1xuXG4gIGlmICghdGhpcy5pc1Zpc2libGUoZWwpKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgaWYgKGVsLm5vZGVUeXBlID09PSB0aGlzLndpbmRvd0NvbnRleHQuTm9kZS5URVhUX05PREUpIHtcbiAgICBpZiAoZWwubm9kZVZhbHVlLnJlcGxhY2UoL1xcbi9nLCAnJykubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzLmluUHJlKSB7XG4gICAgICByZXR1cm4gdGhpcy5vdXRwdXQoZWwubm9kZVZhbHVlKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuaW5Db2RlKSB7XG4gICAgICByZXR1cm4gdGhpcy5vdXRwdXQocHJvY2Vzc0NvZGUoZWwubm9kZVZhbHVlKSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzLm91dHB1dChwcm9jZXNzUGxhaW5UZXh0KGVsLm5vZGVWYWx1ZSwgZWwucGFyZW50RWxlbWVudCAmJiBlbC5wYXJlbnRFbGVtZW50LnRhZ05hbWUpKTtcbiAgfVxuXG4gIGlmIChlbC5ub2RlVHlwZSAhPT0gdGhpcy53aW5kb3dDb250ZXh0Lk5vZGUuRUxFTUVOVF9OT0RFKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgdGhpcy5sYXN0RWxlbWVudCA9IGVsO1xuXG4gIHZhciB0cmFuc2Zvcm1lZCA9IHRoaXMub3B0aW9ucy50cmFuc2Zvcm0oZWwpO1xuICBpZiAodHJhbnNmb3JtZWQgIT09IHZvaWQgMCkge1xuICAgIHJldHVybiB0aGlzLm91dHB1dCh0cmFuc2Zvcm1lZCk7XG4gIH1cbiAgaWYgKHNoYWxsb3dUYWdzLmluZGV4T2YoZWwudGFnTmFtZSkgIT09IC0xKSB7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgc3dpdGNoIChlbC50YWdOYW1lKSB7XG4gICAgY2FzZSAnSDEnOlxuICAgIGNhc2UgJ0gyJzpcbiAgICBjYXNlICdIMyc6XG4gICAgY2FzZSAnSDQnOlxuICAgIGNhc2UgJ0g1JzpcbiAgICBjYXNlICdINic6XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIHRoaXMub3V0cHV0KG1hbnkoJyMnLCBwYXJzZUludChlbC50YWdOYW1lLm1hdGNoKHJoZWFkaW5nKVsxXSkpICsgJyAnKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0FERFJFU1MnOlxuICAgIGNhc2UgJ0FSVElDTEUnOlxuICAgIGNhc2UgJ0FTSURFJzpcbiAgICBjYXNlICdESVYnOlxuICAgIGNhc2UgJ0ZJRUxEU0VUJzpcbiAgICBjYXNlICdGT09URVInOlxuICAgIGNhc2UgJ0hFQURFUic6XG4gICAgY2FzZSAnTkFWJzpcbiAgICBjYXNlICdQJzpcbiAgICBjYXNlICdTRUNUSU9OJzpcbiAgICAgIHRoaXMucCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQk9EWSc6XG4gICAgY2FzZSAnRk9STSc6XG4gICAgICBicmVhaztcbiAgICBjYXNlICdERVRBSUxTJzpcbiAgICAgIHRoaXMucCgpO1xuICAgICAgaWYgKCFoYXMoZWwsICdvcGVuJywgZmFsc2UpKSB7XG4gICAgICAgIHN1bW1hcnkgPSBlbC5nZXRFbGVtZW50c0J5VGFnTmFtZSgnc3VtbWFyeScpWzBdO1xuICAgICAgICBpZiAoc3VtbWFyeSkge1xuICAgICAgICAgIHRoaXMucHJvY2VzcyhzdW1tYXJ5KTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBicmVhaztcbiAgICBjYXNlICdCUic6XG4gICAgICB0aGlzLmJyKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdIUic6XG4gICAgICB0aGlzLnAoKTtcbiAgICAgIHRoaXMub3V0cHV0KCctLS0tLS0tLS0nKTtcbiAgICAgIHRoaXMucCgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnQ0lURSc6XG4gICAgY2FzZSAnREZOJzpcbiAgICBjYXNlICdFTSc6XG4gICAgY2FzZSAnSSc6XG4gICAgY2FzZSAnVSc6XG4gICAgY2FzZSAnVkFSJzpcbiAgICAgIHRoaXMub3V0cHV0KCdfJyk7XG4gICAgICB0aGlzLm5vVHJhaWxpbmdXaGl0ZXNwYWNlID0gdHJ1ZTtcbiAgICAgIGFmdGVyID0gdGhpcy5vdXRwdXRMYXRlcignXycpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnTUFSSyc6XG4gICAgICB0aGlzLm91dHB1dCgnPG1hcms+Jyk7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJzwvbWFyaz4nKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0RUJzpcbiAgICBjYXNlICdCJzpcbiAgICBjYXNlICdTVFJPTkcnOlxuICAgICAgaWYgKGVsLnRhZ05hbWUgPT09ICdEVCcpIHtcbiAgICAgICAgdGhpcy5wKCk7XG4gICAgICB9XG4gICAgICB0aGlzLm91dHB1dCgnKionKTtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCcqKicpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUSc6XG4gICAgICB0aGlzLm91dHB1dCgnXCInKTtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSB0cnVlO1xuICAgICAgYWZ0ZXIgPSB0aGlzLm91dHB1dExhdGVyKCdcIicpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnT0wnOlxuICAgICAgYWZ0ZXIgPSB0aGlzLm9sKCk7XG4gICAgICBicmVhaztcbiAgICBjYXNlICdVTCc6XG4gICAgICBhZnRlciA9IHRoaXMudWwoKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0xJJzpcbiAgICAgIHRoaXMucmVwbGFjZUxlZnQoJ1xcbicpO1xuICAgICAgdGhpcy5saSgpO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnUFJFJzpcbiAgICAgIGlmICh0aGlzLm9wdGlvbnMuZmVuY2luZykge1xuICAgICAgICB0aGlzLmFwcGVuZCgnXFxuXFxuJyk7XG4gICAgICAgIHRoaXMub3V0cHV0KFsnYGBgJywgJ1xcbiddLmpvaW4odGhpcy5vcHRpb25zLmZlbmNpbmdsYW5ndWFnZShlbCkgfHwgJycpKTtcbiAgICAgICAgYWZ0ZXIgPSBbdGhpcy5wcmUoKSwgdGhpcy5vdXRwdXRMYXRlcignXFxuYGBgJyldO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWZ0ZXIgPSBbdGhpcy5wdXNoTGVmdCgnICAgICcpLCB0aGlzLnByZSgpXTtcbiAgICAgIH1cbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0NPREUnOlxuICAgIGNhc2UgJ1NBTVAnOlxuICAgICAgaWYgKHRoaXMuaW5QcmUpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB0aGlzLm91dHB1dCgnYCcpO1xuICAgICAgYWZ0ZXIgPSBbdGhpcy5jb2RlKCksIHRoaXMub3V0cHV0TGF0ZXIoJ2AnKV07XG4gICAgICBicmVhaztcbiAgICBjYXNlICdCTE9DS1FVT1RFJzpcbiAgICBjYXNlICdERCc6XG4gICAgICB0aGlzLnN0YXJ0aW5nQmxvY2txdW90ZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMucHVzaExlZnQoJz4gJyk7XG4gICAgICB0aGlzLnN0YXJ0aW5nQmxvY2txdW90ZSA9IGZhbHNlO1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAnS0JEJzpcbiAgICAgIGFmdGVyID0gdGhpcy5odG1sVGFnKCdrYmQnKTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0EnOlxuICAgIGNhc2UgJ0lNRyc6XG4gICAgICBocmVmID0gYXR0cihlbCwgZWwudGFnTmFtZSA9PT0gJ0EnID8gJ2hyZWYnIDogJ3NyYycsIHRoaXMub3B0aW9ucy5hYnNvbHV0ZSk7XG4gICAgICBpZiAoIWhyZWYpIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgICB0aXRsZSA9IGF0dHIoZWwsICd0aXRsZScpO1xuICAgICAgaWYgKHRpdGxlKSB7XG4gICAgICAgIGhyZWYgKz0gJyBcIicgKyB0aXRsZSArICdcIic7XG4gICAgICB9XG4gICAgICBpZiAodGhpcy5vcHRpb25zLmlubGluZSkge1xuICAgICAgICBzdWZmaXggPSAnKCcgKyBocmVmICsgJyknO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3VmZml4ID0gJ1snICsgKChiYXNlID0gdGhpcy5saW5rTWFwKVtocmVmXSAhPSBudWxsID8gYmFzZVtocmVmXSA6IGJhc2VbaHJlZl0gPSB0aGlzLmxpbmtzLnB1c2goaHJlZikpICsgJ10nO1xuICAgICAgfVxuICAgICAgaWYgKGVsLnRhZ05hbWUgPT09ICdJTUcnKSB7XG4gICAgICAgIHRoaXMub3V0cHV0KCchWycgKyBhdHRyKGVsLCAnYWx0JykgKyAnXScgKyBzdWZmaXgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICB0aGlzLm91dHB1dCgnWycpO1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgICBhZnRlciA9IHRoaXMub3V0cHV0TGF0ZXIoJ10nICsgc3VmZml4KTtcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgJ0lGUkFNRSc6XG4gICAgICB0cnkge1xuICAgICAgICBpZiAoKHJlZiA9IGVsLmNvbnRlbnREb2N1bWVudCkgIT0gbnVsbCA/IHJlZi5kb2N1bWVudEVsZW1lbnQgOiB2b2lkIDApIHtcbiAgICAgICAgICB0aGlzLnByb2Nlc3MoZWwuY29udGVudERvY3VtZW50LmRvY3VtZW50RWxlbWVudCk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZnJhbWVTcmMgPSBhdHRyKGVsLCAnc3JjJyk7XG4gICAgICAgICAgaWYgKGZyYW1lU3JjICYmIHRoaXMub3B0aW9ucy5hbGxvd0ZyYW1lICYmIHRoaXMub3B0aW9ucy5hbGxvd0ZyYW1lKGZyYW1lU3JjKSkge1xuICAgICAgICAgICAgdGhpcy5vdXRwdXQoJzxpZnJhbWUgc3JjPVwiJyArIGZyYW1lU3JjICsgJ1wiPjwvaWZyYW1lPicpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB9XG4gICAgICByZXR1cm47XG4gIH1cblxuICBhZnRlciA9IHRoaXMudGFibGVzKGVsKSB8fCBhZnRlcjtcblxuICBmb3IgKGkgPSAwOyBpIDwgZWwuY2hpbGROb2Rlcy5sZW5ndGg7IGkrKykge1xuICAgIHRoaXMucHJvY2VzcyhlbC5jaGlsZE5vZGVzW2ldKTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgYWZ0ZXIgPT09ICdmdW5jdGlvbicpIHtcbiAgICBhZnRlciA9IFthZnRlcl07XG4gIH1cbiAgd2hpbGUgKGFmdGVyICYmIGFmdGVyLmxlbmd0aCkge1xuICAgIGFmdGVyLnNoaWZ0KCkuY2FsbCh0aGlzKTtcbiAgfVxufTtcblxuRG9tYWRvci5wcm90b3R5cGUudGFibGVzID0gZnVuY3Rpb24gdGFibGVzIChlbCkge1xuICBpZiAodGhpcy5vcHRpb25zLnRhYmxlcyA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICB2YXIgbmFtZSA9IGVsLnRhZ05hbWU7XG4gIGlmIChuYW1lID09PSAnVEFCTEUnKSB7XG4gICAgdGhpcy50YWJsZUNvbHMgPSBbXTtcbiAgICByZXR1cm47XG4gIH1cbiAgaWYgKG5hbWUgPT09ICdUSEVBRCcpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gYWZ0ZXIgKCkge1xuICAgICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IGZhbHNlO1xuICAgICAgcmV0dXJuIHRoaXMub3V0cHV0KCd8JyArIHRoaXMudGFibGVDb2xzLnJlZHVjZShmdW5jdGlvbiAodGgsIHRjKSB7XG4gICAgICAgIHJldHVybiB0aCArICctJy5yZXBlYXQodGMgKyAyKSArICd8JztcbiAgICAgIH0sICcnKSArICdcXG4nKTtcbiAgICB9O1xuICB9XG4gIGlmIChuYW1lID09PSAnVEgnKSB7XG4gICAgcmV0dXJuIFtmdW5jdGlvbiBhZnRlciAoKSB7XG4gICAgICB0aGlzLnRhYmxlQ29scy5wdXNoKHRoaXMuY2hpbGRCdWZmZXIubGVuZ3RoKTtcbiAgICB9LCB0aGlzLnRkKHRydWUpXTtcbiAgfVxuICBpZiAobmFtZSA9PT0gJ1RSJykge1xuICAgIHRoaXMudGFibGVDb2wgPSAwO1xuICAgIHRoaXMub3V0cHV0KCd8Jyk7XG4gICAgdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWU7XG4gICAgcmV0dXJuIGZ1bmN0aW9uIGFmdGVyICgpIHtcbiAgICAgIHRoaXMubm9UcmFpbGluZ1doaXRlc3BhY2UgPSBmYWxzZTtcbiAgICAgIHRoaXMub3V0cHV0KCdcXG4nKTtcbiAgICB9O1xuICB9XG4gIGlmIChuYW1lID09PSAnVEQnKSB7XG4gICAgcmV0dXJuIHRoaXMudGQoKTtcbiAgfVxufTtcblxuRG9tYWRvci5wcm90b3R5cGUucHVzaExlZnQgPSBmdW5jdGlvbiBwdXNoTGVmdCAodGV4dCkge1xuICB2YXIgb2xkO1xuICBvbGQgPSB0aGlzLmxlZnQ7XG4gIHRoaXMubGVmdCArPSB0ZXh0O1xuICBpZiAodGhpcy5hdFApIHtcbiAgICB0aGlzLmFwcGVuZCh0ZXh0KTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLnAoKTtcbiAgfVxuICByZXR1cm4gKGZ1bmN0aW9uKF90aGlzKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgX3RoaXMubGVmdCA9IG9sZDtcbiAgICAgIF90aGlzLmF0TGVmdCA9IF90aGlzLmF0UCA9IGZhbHNlO1xuICAgICAgcmV0dXJuIF90aGlzLnAoKTtcbiAgICB9O1xuICB9KSh0aGlzKTtcbn07XG5cbkRvbWFkb3IucHJvdG90eXBlLnJlcGxhY2VMZWZ0ID0gZnVuY3Rpb24gcmVwbGFjZUxlZnQgKHRleHQpIHtcbiAgaWYgKCF0aGlzLmF0TGVmdCkge1xuICAgIHRoaXMuYXBwZW5kKHRoaXMubGVmdC5yZXBsYWNlKC9bIF17Miw0fSQvLCB0ZXh0KSk7XG4gICAgcmV0dXJuIHRoaXMuYXRMZWZ0ID0gdGhpcy5ub1RyYWlsaW5nV2hpdGVzcGFjZSA9IHRoaXMuYXRQID0gdHJ1ZTtcbiAgfSBlbHNlIGlmICh0aGlzLmxhc3QpIHtcbiAgICByZXR1cm4gdGhpcy5sYXN0ID0gdGhpcy5sYXN0LnJlcGxhY2UoL1sgXXsyLDR9JC8sIHRleHQpO1xuICB9XG59O1xuXG5Eb21hZG9yLnByb3RvdHlwZS5pc1Zpc2libGUgPSBmdW5jdGlvbiBpc1Zpc2libGUgKGVsKSB7XG4gIHZhciBkaXNwbGF5O1xuICB2YXIgaTtcbiAgdmFyIHByb3BlcnR5O1xuICB2YXIgdmlzaWJpbGl0eTtcbiAgdmFyIHZpc2libGUgPSB0cnVlO1xuICB2YXIgc3R5bGUgPSBhdHRyKGVsLCAnc3R5bGUnLCBmYWxzZSk7XG4gIHZhciBwcm9wZXJ0aWVzID0gc3R5bGUgIT0gbnVsbCA/IHR5cGVvZiBzdHlsZS5tYXRjaCA9PT0gJ2Z1bmN0aW9uJyA/IHN0eWxlLm1hdGNoKHJkaXNwbGF5KSA6IHZvaWQgMCA6IHZvaWQgMDtcbiAgaWYgKHByb3BlcnRpZXMgIT0gbnVsbCkge1xuICAgIGZvciAoaSA9IDA7IGkgPCBwcm9wZXJ0aWVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBwcm9wZXJ0eSA9IHByb3BlcnRpZXNbaV07XG4gICAgICB2aXNpYmxlID0gIXJoaWRkZW4udGVzdChwcm9wZXJ0eSk7XG4gICAgfVxuICB9XG4gIGlmICh2aXNpYmxlICYmIHR5cGVvZiB0aGlzLndpbmRvd0NvbnRleHQuZ2V0Q29tcHV0ZWRTdHlsZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgIHRyeSB7XG4gICAgICBzdHlsZSA9IHRoaXMud2luZG93Q29udGV4dC5nZXRDb21wdXRlZFN0eWxlKGVsLCBudWxsKTtcbiAgICAgIGlmICh0eXBlb2YgKHN0eWxlICE9IG51bGwgPyBzdHlsZS5nZXRQcm9wZXJ0eVZhbHVlIDogdm9pZCAwKSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBkaXNwbGF5ID0gc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgnZGlzcGxheScpO1xuICAgICAgICB2aXNpYmlsaXR5ID0gc3R5bGUuZ2V0UHJvcGVydHlWYWx1ZSgndmlzaWJpbGl0eScpO1xuICAgICAgICB2aXNpYmxlID0gZGlzcGxheSAhPT0gJ25vbmUnICYmIHZpc2liaWxpdHkgIT09ICdoaWRkZW4nO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmlzaWJsZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2U7XG4iLCIvKiEgaHR0cDovL210aHMuYmUvcmVwZWF0IHYwLjIuMCBieSBAbWF0aGlhcyAqL1xuaWYgKCFTdHJpbmcucHJvdG90eXBlLnJlcGVhdCkge1xuXHQoZnVuY3Rpb24oKSB7XG5cdFx0J3VzZSBzdHJpY3QnOyAvLyBuZWVkZWQgdG8gc3VwcG9ydCBgYXBwbHlgL2BjYWxsYCB3aXRoIGB1bmRlZmluZWRgL2BudWxsYFxuXHRcdHZhciBkZWZpbmVQcm9wZXJ0eSA9IChmdW5jdGlvbigpIHtcblx0XHRcdC8vIElFIDggb25seSBzdXBwb3J0cyBgT2JqZWN0LmRlZmluZVByb3BlcnR5YCBvbiBET00gZWxlbWVudHNcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciBvYmplY3QgPSB7fTtcblx0XHRcdFx0dmFyICRkZWZpbmVQcm9wZXJ0eSA9IE9iamVjdC5kZWZpbmVQcm9wZXJ0eTtcblx0XHRcdFx0dmFyIHJlc3VsdCA9ICRkZWZpbmVQcm9wZXJ0eShvYmplY3QsIG9iamVjdCwgb2JqZWN0KSAmJiAkZGVmaW5lUHJvcGVydHk7XG5cdFx0XHR9IGNhdGNoKGVycm9yKSB7fVxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9KCkpO1xuXHRcdHZhciByZXBlYXQgPSBmdW5jdGlvbihjb3VudCkge1xuXHRcdFx0aWYgKHRoaXMgPT0gbnVsbCkge1xuXHRcdFx0XHR0aHJvdyBUeXBlRXJyb3IoKTtcblx0XHRcdH1cblx0XHRcdHZhciBzdHJpbmcgPSBTdHJpbmcodGhpcyk7XG5cdFx0XHQvLyBgVG9JbnRlZ2VyYFxuXHRcdFx0dmFyIG4gPSBjb3VudCA/IE51bWJlcihjb3VudCkgOiAwO1xuXHRcdFx0aWYgKG4gIT0gbikgeyAvLyBiZXR0ZXIgYGlzTmFOYFxuXHRcdFx0XHRuID0gMDtcblx0XHRcdH1cblx0XHRcdC8vIEFjY291bnQgZm9yIG91dC1vZi1ib3VuZHMgaW5kaWNlc1xuXHRcdFx0aWYgKG4gPCAwIHx8IG4gPT0gSW5maW5pdHkpIHtcblx0XHRcdFx0dGhyb3cgUmFuZ2VFcnJvcigpO1xuXHRcdFx0fVxuXHRcdFx0dmFyIHJlc3VsdCA9ICcnO1xuXHRcdFx0d2hpbGUgKG4pIHtcblx0XHRcdFx0aWYgKG4gJSAyID09IDEpIHtcblx0XHRcdFx0XHRyZXN1bHQgKz0gc3RyaW5nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChuID4gMSkge1xuXHRcdFx0XHRcdHN0cmluZyArPSBzdHJpbmc7XG5cdFx0XHRcdH1cblx0XHRcdFx0biA+Pj0gMTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fTtcblx0XHRpZiAoZGVmaW5lUHJvcGVydHkpIHtcblx0XHRcdGRlZmluZVByb3BlcnR5KFN0cmluZy5wcm90b3R5cGUsICdyZXBlYXQnLCB7XG5cdFx0XHRcdCd2YWx1ZSc6IHJlcGVhdCxcblx0XHRcdFx0J2NvbmZpZ3VyYWJsZSc6IHRydWUsXG5cdFx0XHRcdCd3cml0YWJsZSc6IHRydWVcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRTdHJpbmcucHJvdG90eXBlLnJlcGVhdCA9IHJlcGVhdDtcblx0XHR9XG5cdH0oKSk7XG59XG4iLCIndXNlIHN0cmljdCc7XG5cbmlmICghd2luZG93Lk5vZGUpIHtcbiAgd2luZG93Lk5vZGUgPSB7XG4gICAgRUxFTUVOVF9OT0RFOiAxLFxuICAgIFRFWFRfTk9ERTogM1xuICB9O1xufVxuXG5mdW5jdGlvbiB3aW5kb3dDb250ZXh0ICgpIHtcbiAgcmV0dXJuIHdpbmRvdztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB3aW5kb3dDb250ZXh0O1xuIl19
