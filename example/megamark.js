(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.megamark = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var MarkdownIt = require('markdown-it');
var hljs = require('highlight.js');
var tokenizeLinks = require('./tokenizeLinks');
var md = new MarkdownIt({
  html: true,
  xhtmlOut: true,
  linkify: true,
  typographer: true,
  langPrefix: 'md-lang-alias-',
  highlight: highlight.bind(null, false)
});
var ralias = / class="md-lang-alias-([^"]+)"/;
var aliases = {
  js: 'javascript',
  md: 'markdown',
  html: 'xml', // next best thing
  jade: 'css' // next best thing
};
var baseblock = md.renderer.rules.code_block;
var baseinline = md.renderer.rules.code_inline;
var basefence = md.renderer.rules.fence;
var basetext = md.renderer.rules.text;
var textcached = textparser([]);
var languages = [];
var context = {};

md.core.ruler.before('linkify', 'linkify-tokenizer', linkifyTokenizer, {});
md.renderer.rules.code_block = block;
md.renderer.rules.code_inline = inline;
md.renderer.rules.fence = fence;

hljs.configure({ tabReplace: 2, classPrefix: 'md-code-' });

function highlight (encoded, code, detected) {
  var lower = String(detected).toLowerCase();
  var lang = aliases[detected] || detected;
  var escaped = mark(code, encoded);
  try {
    var result = hljs.highlight(lang, escaped);
    var unescaped = unmark(result.value, true, encoded);
    return unescaped;
  } catch (e) {
    return unmark(mark(code, encoded), true, encoded);
  }
}

function encode (tag) {
  return tag.replace('<', '&lt;').replace('>', '&gt;');
}

function mark (code, encoded) {
  var opentag = '<mark>';
  var closetag = '</mark>';
  if (encoded) {
    opentag = encode(opentag);
    closetag = encode(closetag);
  }
  var ropen = new RegExp(opentag, 'g');
  var rclose = new RegExp(closetag, 'g');
  var open = 'highlightmarkisveryliteral';
  var close = 'highlightmarkwasveryliteral';
  return code.replace(ropen, open).replace(rclose, close);
}

function unmark (value, inCode) {
  var ropen = /highlightmarkisveryliteral/g;
  var rclose = /highlightmarkwasveryliteral/g;
  var classes = 'md-mark' + (inCode ? ' md-code-mark' : '');
  var open = '<mark class="' + classes + '">';
  var close = '</mark>';
  return value.replace(ropen, open).replace(rclose, close);
}

function block () {
  var base = baseblock.apply(this, arguments).substr(11); // starts with '<pre><code>'
  var left = base.substr(0, base.length - 14);
  var marked = highlight(true, base);
  var classed = '<pre class="md-code-block"><code class="md-code">' + marked + '</code></pre>';
  return classed;
}

function inline () {
  var base = baseinline.apply(this, arguments).substr(6); // starts with '<code>'
  var left = base.substr(0, base.length - 7); // ends with '</code>'
  var marked = highlight(true, left);
  var classed = '<code class="md-code md-code-inline">' + marked + '</code>';
  return classed;
}

function fence () {
  var base = basefence.apply(this, arguments).substr(5); // starts with '<pre>'
  var lang = base.substr(0, 6) !== '<code>'; // when the fence has a language class
  var rest = lang ? base : '<code class="md-code">' + base.substr(6);
  var classed = '<pre class="md-code-block">' + rest;
  var aliased = classed.replace(ralias, aliasing);
  return aliased;
}

function aliasing (all, language) {
  var name = aliases[language] || language || 'unknown';
  var lang = 'md-lang-' + name;
  if (languages.indexOf(lang) === -1) {
    languages.push(lang);
  }
  return ' class="md-code ' + lang + '"';
}

function textparser (tokenizers) {
  return function parseText () {
    var base = basetext.apply(this, arguments);
    var fancy = fanciful(base);
    var tokenized = tokenize(fancy, tokenizers);
    return tokenized;
  };
}

function fanciful (text) {
  return text
    .replace(/--/g, '\u2014')                            // em-dashes
    .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')      // opening singles
    .replace(/'/g, '\u2019')                             // closing singles & apostrophes
    .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c') // opening doubles
    .replace(/"/g, '\u201d')                             // closing doubles
    .replace(/\.{3}/g, '\u2026');                        // ellipses
}

function linkifyTokenizer (state) {
  tokenizeLinks(state, context);
}

function tokenize (text, tokenizers) {
  return tokenizers.reduce(use, text);
  function use (result, tok) {
    return result.replace(tok.token, tok.transform);
  }
}

function markdown (input, options) {
  var tok = options.tokenizers || [];
  var lin = options.linkifiers || [];
  var valid = input === null || input === void 0 ? '' : String(input);
  context.tokenizers = tok;
  context.linkifiers = lin;
  md.renderer.rules.text = tok.length ? textparser(tok) : textcached;
  var html = md.render(valid);
  return unmark(mark(html));
}

markdown.parser = md;
markdown.languages = languages;
module.exports = markdown;

},{"./tokenizeLinks":97,"highlight.js":6,"markdown-it":32}],2:[function(require,module,exports){
'use strict';

var insane = require('insane');
var assign = require('assignment');
var markdown = require('./markdown');
var hightokens = require('highlight.js-tokens').map(codeclass);

function codeclass (token) {
  return 'md-code-' + token;
}

function sanitize (html, o) {
  var options = assign({ allowedClasses: {} }, o);
  var ac = options.allowedClasses;

  add('mark', ['md-mark', 'md-code-mark']);
  add('pre', ['md-code-block']);
  add('code', markdown.languages);
  add('span', hightokens);

  return insane(html, options);

  function add (type, more) {
    ac[type] = (ac[type] || []).concat(more);
  }
}

function megamark (md, options) {
  var o = options || {};
  var html = markdown(md, o);
  var sane = sanitize(html, o.sanitizer);
  return sane;
}

markdown.languages.push('md-code', 'md-code-inline'); // only sanitizing purposes
megamark.parser = markdown.parser;
module.exports = megamark;

},{"./markdown":1,"assignment":3,"highlight.js-tokens":15,"insane":19}],3:[function(require,module,exports){
'use strict';

function assignment (result) {
  var stack = Array.prototype.slice.call(arguments, 1);
  var item;
  var key;
  while (stack.length) {
    item = stack.shift();
    for (key in item) {
      if (item.hasOwnProperty(key)) {
        if (typeof result[key] === 'object' && result[key] && Object.prototype.toString.call(result[key]) !== '[object Array]') {
          result[key] = assignment(result[key], item[key]);
        } else {
          result[key] = item[key];
        }
      }
    }
  }
  return result;
}

module.exports = assignment;

},{}],4:[function(require,module,exports){
(function (global){
/*! https://mths.be/punycode v1.3.2 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports &&
		!exports.nodeType && exports;
	var freeModule = typeof module == 'object' && module &&
		!module.nodeType && module;
	var freeGlobal = typeof global == 'object' && global;
	if (
		freeGlobal.global === freeGlobal ||
		freeGlobal.window === freeGlobal ||
		freeGlobal.self === freeGlobal
	) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		var result = [];
		while (length--) {
			result[length] = fn(array[length]);
		}
		return result;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings or email
	 * addresses.
	 * @private
	 * @param {String} domain The domain name or email address.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		var parts = string.split('@');
		var result = '';
		if (parts.length > 1) {
			// In email addresses, only the domain name should be punycoded. Leave
			// the local part (i.e. everything up to `@`) intact.
			result = parts[0] + '@';
			string = parts[1];
		}
		// Avoid `split(regex)` for IE8 compatibility. See #17.
		string = string.replace(regexSeparators, '\x2E');
		var labels = string.split('.');
		var encoded = map(labels, fn).join('.');
		return result + encoded;
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <https://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols (e.g. a domain name label) to a
	 * Punycode string of ASCII-only symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name or an email address
	 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
	 * it doesn't matter if you call it on a string that has already been
	 * converted to Unicode.
	 * @memberOf punycode
	 * @param {String} input The Punycoded domain name or email address to
	 * convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(input) {
		return mapDomain(input, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name or an email address to
	 * Punycode. Only the non-ASCII parts of the domain name will be converted,
	 * i.e. it doesn't matter if you call it with a domain that's already in
	 * ASCII.
	 * @memberOf punycode
	 * @param {String} input The domain name or email address to convert, as a
	 * Unicode string.
	 * @returns {String} The Punycode representation of the given domain name or
	 * email address.
	 */
	function toASCII(input) {
		return mapDomain(input, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.3.2',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && freeModule) {
		if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],5:[function(require,module,exports){
var Highlight = function() {

  /* Utility functions */

  function escape(value) {
    return value.replace(/&/gm, '&amp;').replace(/</gm, '&lt;').replace(/>/gm, '&gt;');
  }

  function tag(node) {
    return node.nodeName.toLowerCase();
  }

  function testRe(re, lexeme) {
    var match = re && re.exec(lexeme);
    return match && match.index == 0;
  }

  function blockText(block) {
    return Array.prototype.map.call(block.childNodes, function(node) {
      if (node.nodeType == 3) {
        return options.useBR ? node.nodeValue.replace(/\n/g, '') : node.nodeValue;
      }
      if (tag(node) == 'br') {
        return '\n';
      }
      return blockText(node);
    }).join('');
  }

  function blockLanguage(block) {
    var classes = (block.className + ' ' + (block.parentNode ? block.parentNode.className : '')).split(/\s+/);
    classes = classes.map(function(c) {return c.replace(/^language-/, '');});
    return classes.filter(function(c) {return getLanguage(c) || c == 'no-highlight';})[0];
  }

  function inherit(parent, obj) {
    var result = {};
    for (var key in parent)
      result[key] = parent[key];
    if (obj)
      for (var key in obj)
        result[key] = obj[key];
    return result;
  };

  /* Stream merging */

  function nodeStream(node) {
    var result = [];
    (function _nodeStream(node, offset) {
      for (var child = node.firstChild; child; child = child.nextSibling) {
        if (child.nodeType == 3)
          offset += child.nodeValue.length;
        else if (tag(child) == 'br')
          offset += 1;
        else if (child.nodeType == 1) {
          result.push({
            event: 'start',
            offset: offset,
            node: child
          });
          offset = _nodeStream(child, offset);
          result.push({
            event: 'stop',
            offset: offset,
            node: child
          });
        }
      }
      return offset;
    })(node, 0);
    return result;
  }

  function mergeStreams(original, highlighted, value) {
    var processed = 0;
    var result = '';
    var nodeStack = [];

    function selectStream() {
      if (!original.length || !highlighted.length) {
        return original.length ? original : highlighted;
      }
      if (original[0].offset != highlighted[0].offset) {
        return (original[0].offset < highlighted[0].offset) ? original : highlighted;
      }

      /*
      To avoid starting the stream just before it should stop the order is
      ensured that original always starts first and closes last:

      if (event1 == 'start' && event2 == 'start')
        return original;
      if (event1 == 'start' && event2 == 'stop')
        return highlighted;
      if (event1 == 'stop' && event2 == 'start')
        return original;
      if (event1 == 'stop' && event2 == 'stop')
        return highlighted;

      ... which is collapsed to:
      */
      return highlighted[0].event == 'start' ? original : highlighted;
    }

    function open(node) {
      function attr_str(a) {return ' ' + a.nodeName + '="' + escape(a.value) + '"';}
      result += '<' + tag(node) + Array.prototype.map.call(node.attributes, attr_str).join('') + '>';
    }

    function close(node) {
      result += '</' + tag(node) + '>';
    }

    function render(event) {
      (event.event == 'start' ? open : close)(event.node);
    }

    while (original.length || highlighted.length) {
      var stream = selectStream();
      result += escape(value.substr(processed, stream[0].offset - processed));
      processed = stream[0].offset;
      if (stream == original) {
        /*
        On any opening or closing tag of the original markup we first close
        the entire highlighted node stack, then render the original tag along
        with all the following original tags at the same offset and then
        reopen all the tags on the highlighted stack.
        */
        nodeStack.reverse().forEach(close);
        do {
          render(stream.splice(0, 1)[0]);
          stream = selectStream();
        } while (stream == original && stream.length && stream[0].offset == processed);
        nodeStack.reverse().forEach(open);
      } else {
        if (stream[0].event == 'start') {
          nodeStack.push(stream[0].node);
        } else {
          nodeStack.pop();
        }
        render(stream.splice(0, 1)[0]);
      }
    }
    return result + escape(value.substr(processed));
  }

  /* Initialization */

  function compileLanguage(language) {

    function reStr(re) {
        return (re && re.source) || re;
    }

    function langRe(value, global) {
      return RegExp(
        reStr(value),
        'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
      );
    }

    function compileMode(mode, parent) {
      if (mode.compiled)
        return;
      mode.compiled = true;

      mode.keywords = mode.keywords || mode.beginKeywords;
      if (mode.keywords) {
        var compiled_keywords = {};

        function flatten(className, str) {
          if (language.case_insensitive) {
            str = str.toLowerCase();
          }
          str.split(' ').forEach(function(kw) {
            var pair = kw.split('|');
            compiled_keywords[pair[0]] = [className, pair[1] ? Number(pair[1]) : 1];
          });
        }

        if (typeof mode.keywords == 'string') { // string
          flatten('keyword', mode.keywords);
        } else {
          Object.keys(mode.keywords).forEach(function (className) {
            flatten(className, mode.keywords[className]);
          });
        }
        mode.keywords = compiled_keywords;
      }
      mode.lexemesRe = langRe(mode.lexemes || /\b[A-Za-z0-9_]+\b/, true);

      if (parent) {
        if (mode.beginKeywords) {
          mode.begin = mode.beginKeywords.split(' ').join('|');
        }
        if (!mode.begin)
          mode.begin = /\B|\b/;
        mode.beginRe = langRe(mode.begin);
        if (!mode.end && !mode.endsWithParent)
          mode.end = /\B|\b/;
        if (mode.end)
          mode.endRe = langRe(mode.end);
        mode.terminator_end = reStr(mode.end) || '';
        if (mode.endsWithParent && parent.terminator_end)
          mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
      }
      if (mode.illegal)
        mode.illegalRe = langRe(mode.illegal);
      if (mode.relevance === undefined)
        mode.relevance = 1;
      if (!mode.contains) {
        mode.contains = [];
      }
      var expanded_contains = [];
      mode.contains.forEach(function(c) {
        if (c.variants) {
          c.variants.forEach(function(v) {expanded_contains.push(inherit(c, v));});
        } else {
          expanded_contains.push(c == 'self' ? mode : c);
        }
      });
      mode.contains = expanded_contains;
      mode.contains.forEach(function(c) {compileMode(c, mode);});

      if (mode.starts) {
        compileMode(mode.starts, parent);
      }

      var terminators =
        mode.contains.map(function(c) {
          return c.beginKeywords ? '\\.?\\b(' + c.begin + ')\\b\\.?' : c.begin;
        })
        .concat([mode.terminator_end])
        .concat([mode.illegal])
        .map(reStr)
        .filter(Boolean);
      mode.terminators = terminators.length ? langRe(terminators.join('|'), true) : {exec: function(s) {return null;}};

      mode.continuation = {};
    }

    compileMode(language);
  }

  /*
  Core highlighting function. Accepts a language name, or an alias, and a
  string with the code to highlight. Returns an object with the following
  properties:

  - relevance (int)
  - value (an HTML string with highlighting markup)

  */
  function highlight(name, value, ignore_illegals, continuation) {

    function subMode(lexeme, mode) {
      for (var i = 0; i < mode.contains.length; i++) {
        if (testRe(mode.contains[i].beginRe, lexeme)) {
          return mode.contains[i];
        }
      }
    }

    function endOfMode(mode, lexeme) {
      if (testRe(mode.endRe, lexeme)) {
        return mode;
      }
      if (mode.endsWithParent) {
        return endOfMode(mode.parent, lexeme);
      }
    }

    function isIllegal(lexeme, mode) {
      return !ignore_illegals && testRe(mode.illegalRe, lexeme);
    }

    function keywordMatch(mode, match) {
      var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
      return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
    }

    function buildSpan(classname, insideSpan, leaveOpen, noPrefix) {
      var classPrefix = noPrefix ? '' : options.classPrefix,
          openSpan    = '<span class="' + classPrefix,
          closeSpan   = leaveOpen ? '' : '</span>';

      openSpan += classname + '">';

      return openSpan + insideSpan + closeSpan;
    }

    function processKeywords() {
      var buffer = escape(mode_buffer);
      if (!top.keywords)
        return buffer;
      var result = '';
      var last_index = 0;
      top.lexemesRe.lastIndex = 0;
      var match = top.lexemesRe.exec(buffer);
      while (match) {
        result += buffer.substr(last_index, match.index - last_index);
        var keyword_match = keywordMatch(top, match);
        if (keyword_match) {
          relevance += keyword_match[1];
          result += buildSpan(keyword_match[0], match[0]);
        } else {
          result += match[0];
        }
        last_index = top.lexemesRe.lastIndex;
        match = top.lexemesRe.exec(buffer);
      }
      return result + buffer.substr(last_index);
    }

    function processSubLanguage() {
      if (top.subLanguage && !languages[top.subLanguage]) {
        return escape(mode_buffer);
      }
      var result = top.subLanguage ? highlight(top.subLanguage, mode_buffer, true, top.continuation.top) : highlightAuto(mode_buffer);
      // Counting embedded language score towards the host language may be disabled
      // with zeroing the containing mode relevance. Usecase in point is Markdown that
      // allows XML everywhere and makes every XML snippet to have a much larger Markdown
      // score.
      if (top.relevance > 0) {
        relevance += result.relevance;
      }
      if (top.subLanguageMode == 'continuous') {
        top.continuation.top = result.top;
      }
      return buildSpan(result.language, result.value, false, true);
    }

    function processBuffer() {
      return top.subLanguage !== undefined ? processSubLanguage() : processKeywords();
    }

    function startNewMode(mode, lexeme) {
      var markup = mode.className? buildSpan(mode.className, '', true): '';
      if (mode.returnBegin) {
        result += markup;
        mode_buffer = '';
      } else if (mode.excludeBegin) {
        result += escape(lexeme) + markup;
        mode_buffer = '';
      } else {
        result += markup;
        mode_buffer = lexeme;
      }
      top = Object.create(mode, {parent: {value: top}});
    }

    function processLexeme(buffer, lexeme) {

      mode_buffer += buffer;
      if (lexeme === undefined) {
        result += processBuffer();
        return 0;
      }

      var new_mode = subMode(lexeme, top);
      if (new_mode) {
        result += processBuffer();
        startNewMode(new_mode, lexeme);
        return new_mode.returnBegin ? 0 : lexeme.length;
      }

      var end_mode = endOfMode(top, lexeme);
      if (end_mode) {
        var origin = top;
        if (!(origin.returnEnd || origin.excludeEnd)) {
          mode_buffer += lexeme;
        }
        result += processBuffer();
        do {
          if (top.className) {
            result += '</span>';
          }
          relevance += top.relevance;
          top = top.parent;
        } while (top != end_mode.parent);
        if (origin.excludeEnd) {
          result += escape(lexeme);
        }
        mode_buffer = '';
        if (end_mode.starts) {
          startNewMode(end_mode.starts, '');
        }
        return origin.returnEnd ? 0 : lexeme.length;
      }

      if (isIllegal(lexeme, top))
        throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');

      /*
      Parser should not reach this point as all types of lexemes should be caught
      earlier, but if it does due to some bug make sure it advances at least one
      character forward to prevent infinite looping.
      */
      mode_buffer += lexeme;
      return lexeme.length || 1;
    }

    var language = getLanguage(name);
    if (!language) {
      throw new Error('Unknown language: "' + name + '"');
    }

    compileLanguage(language);
    var top = continuation || language;
    var result = '';
    for(var current = top; current != language; current = current.parent) {
      if (current.className) {
        result = buildSpan(current.className, result, true);
      }
    }
    var mode_buffer = '';
    var relevance = 0;
    try {
      var match, count, index = 0;
      while (true) {
        top.terminators.lastIndex = index;
        match = top.terminators.exec(value);
        if (!match)
          break;
        count = processLexeme(value.substr(index, match.index - index), match[0]);
        index = match.index + count;
      }
      processLexeme(value.substr(index));
      for(var current = top; current.parent; current = current.parent) { // close dangling modes
        if (current.className) {
          result += '</span>';
        }
      };
      return {
        relevance: relevance,
        value: result,
        language: name,
        top: top
      };
    } catch (e) {
      if (e.message.indexOf('Illegal') != -1) {
        return {
          relevance: 0,
          value: escape(value)
        };
      } else {
        throw e;
      }
    }
  }

  /*
  Highlighting with language detection. Accepts a string with the code to
  highlight. Returns an object with the following properties:

  - language (detected language)
  - relevance (int)
  - value (an HTML string with highlighting markup)
  - second_best (object with the same structure for second-best heuristically
    detected language, may be absent)

  */
  function highlightAuto(text, languageSubset) {
    languageSubset = languageSubset || options.languages || Object.keys(languages);
    var result = {
      relevance: 0,
      value: escape(text)
    };
    var second_best = result;
    languageSubset.forEach(function(name) {
      if (!getLanguage(name)) {
        return;
      }
      var current = highlight(name, text, false);
      current.language = name;
      if (current.relevance > second_best.relevance) {
        second_best = current;
      }
      if (current.relevance > result.relevance) {
        second_best = result;
        result = current;
      }
    });
    if (second_best.language) {
      result.second_best = second_best;
    }
    return result;
  }

  /*
  Post-processing of the highlighted markup:

  - replace TABs with something more useful
  - replace real line-breaks with '<br>' for non-pre containers

  */
  function fixMarkup(value) {
    if (options.tabReplace) {
      value = value.replace(/^((<[^>]+>|\t)+)/gm, function(match, p1, offset, s) {
        return p1.replace(/\t/g, options.tabReplace);
      });
    }
    if (options.useBR) {
      value = value.replace(/\n/g, '<br>');
    }
    return value;
  }

  /*
  Applies highlighting to a DOM node containing code. Accepts a DOM node and
  two optional parameters for fixMarkup.
  */
  function highlightBlock(block) {
    var text = blockText(block);
    var language = blockLanguage(block);
    if (language == 'no-highlight')
        return;
    var result = language ? highlight(language, text, true) : highlightAuto(text);
    var original = nodeStream(block);
    if (original.length) {
      var pre = document.createElementNS('http://www.w3.org/1999/xhtml', 'pre');
      pre.innerHTML = result.value;
      result.value = mergeStreams(original, nodeStream(pre), text);
    }
    result.value = fixMarkup(result.value);

    block.innerHTML = result.value;
    block.className += ' hljs ' + (!language && result.language || '');
    block.result = {
      language: result.language,
      re: result.relevance
    };
    if (result.second_best) {
      block.second_best = {
        language: result.second_best.language,
        re: result.second_best.relevance
      };
    }
  }

  var options = {
    classPrefix: 'hljs-',
    tabReplace: null,
    useBR: false,
    languages: undefined
  };

  /*
  Updates highlight.js global options with values passed in the form of an object
  */
  function configure(user_options) {
    options = inherit(options, user_options);
  }

  /*
  Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
  */
  function initHighlighting() {
    if (initHighlighting.called)
      return;
    initHighlighting.called = true;

    var blocks = document.querySelectorAll('pre code');
    Array.prototype.forEach.call(blocks, highlightBlock);
  }

  /*
  Attaches highlighting to the page load event.
  */
  function initHighlightingOnLoad() {
    addEventListener('DOMContentLoaded', initHighlighting, false);
    addEventListener('load', initHighlighting, false);
  }

  var languages = {};
  var aliases = {};

  function registerLanguage(name, language) {
    var lang = languages[name] = language(this);
    if (lang.aliases) {
      lang.aliases.forEach(function(alias) {aliases[alias] = name;});
    }
  }

  function getLanguage(name) {
    return languages[name] || languages[aliases[name]];
  }

  /* Interface definition */

  this.highlight = highlight;
  this.highlightAuto = highlightAuto;
  this.fixMarkup = fixMarkup;
  this.highlightBlock = highlightBlock;
  this.configure = configure;
  this.initHighlighting = initHighlighting;
  this.initHighlightingOnLoad = initHighlightingOnLoad;
  this.registerLanguage = registerLanguage;
  this.getLanguage = getLanguage;
  this.inherit = inherit;

  // Common regexps
  this.IDENT_RE = '[a-zA-Z][a-zA-Z0-9_]*';
  this.UNDERSCORE_IDENT_RE = '[a-zA-Z_][a-zA-Z0-9_]*';
  this.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
  this.C_NUMBER_RE = '(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
  this.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
  this.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

  // Common modes
  this.BACKSLASH_ESCAPE = {
    begin: '\\\\[\\s\\S]', relevance: 0
  };
  this.APOS_STRING_MODE = {
    className: 'string',
    begin: '\'', end: '\'',
    illegal: '\\n',
    contains: [this.BACKSLASH_ESCAPE]
  };
  this.QUOTE_STRING_MODE = {
    className: 'string',
    begin: '"', end: '"',
    illegal: '\\n',
    contains: [this.BACKSLASH_ESCAPE]
  };
  this.C_LINE_COMMENT_MODE = {
    className: 'comment',
    begin: '//', end: '$'
  };
  this.C_BLOCK_COMMENT_MODE = {
    className: 'comment',
    begin: '/\\*', end: '\\*/'
  };
  this.HASH_COMMENT_MODE = {
    className: 'comment',
    begin: '#', end: '$'
  };
  this.NUMBER_MODE = {
    className: 'number',
    begin: this.NUMBER_RE,
    relevance: 0
  };
  this.C_NUMBER_MODE = {
    className: 'number',
    begin: this.C_NUMBER_RE,
    relevance: 0
  };
  this.BINARY_NUMBER_MODE = {
    className: 'number',
    begin: this.BINARY_NUMBER_RE,
    relevance: 0
  };
  this.REGEXP_MODE = {
    className: 'regexp',
    begin: /\//, end: /\/[gim]*/,
    illegal: /\n/,
    contains: [
      this.BACKSLASH_ESCAPE,
      {
        begin: /\[/, end: /\]/,
        relevance: 0,
        contains: [this.BACKSLASH_ESCAPE]
      }
    ]
  };
  this.TITLE_MODE = {
    className: 'title',
    begin: this.IDENT_RE,
    relevance: 0
  };
  this.UNDERSCORE_TITLE_MODE = {
    className: 'title',
    begin: this.UNDERSCORE_IDENT_RE,
    relevance: 0
  };
};
module.exports = Highlight;
},{}],6:[function(require,module,exports){
var Highlight = require('./highlight');
var hljs = new Highlight();
hljs.registerLanguage('bash', require('./languages/bash.js'));
hljs.registerLanguage('javascript', require('./languages/javascript.js'));
hljs.registerLanguage('xml', require('./languages/xml.js'));
hljs.registerLanguage('markdown', require('./languages/markdown.js'));
hljs.registerLanguage('css', require('./languages/css.js'));
hljs.registerLanguage('http', require('./languages/http.js'));
hljs.registerLanguage('ini', require('./languages/ini.js'));
hljs.registerLanguage('json', require('./languages/json.js'));
module.exports = hljs;
},{"./highlight":5,"./languages/bash.js":7,"./languages/css.js":8,"./languages/http.js":9,"./languages/ini.js":10,"./languages/javascript.js":11,"./languages/json.js":12,"./languages/markdown.js":13,"./languages/xml.js":14}],7:[function(require,module,exports){
module.exports = function(hljs) {
  var VAR = {
    className: 'variable',
    variants: [
      {begin: /\$[\w\d#@][\w\d_]*/},
      {begin: /\$\{(.*?)\}/}
    ]
  };
  var QUOTE_STRING = {
    className: 'string',
    begin: /"/, end: /"/,
    contains: [
      hljs.BACKSLASH_ESCAPE,
      VAR,
      {
        className: 'variable',
        begin: /\$\(/, end: /\)/,
        contains: [hljs.BACKSLASH_ESCAPE]
      }
    ]
  };
  var APOS_STRING = {
    className: 'string',
    begin: /'/, end: /'/
  };

  return {
    lexemes: /-?[a-z\.]+/,
    keywords: {
      keyword:
        'if then else elif fi for break continue while in do done exit return set '+
        'declare case esac export exec',
      literal:
        'true false',
      built_in:
        'printf echo read cd pwd pushd popd dirs let eval unset typeset readonly '+
        'getopts source shopt caller type hash bind help sudo',
      operator:
        '-ne -eq -lt -gt -f -d -e -s -l -a' // relevance booster
    },
    contains: [
      {
        className: 'shebang',
        begin: /^#![^\n]+sh\s*$/,
        relevance: 10
      },
      {
        className: 'function',
        begin: /\w[\w\d_]*\s*\(\s*\)\s*\{/,
        returnBegin: true,
        contains: [hljs.inherit(hljs.TITLE_MODE, {begin: /\w[\w\d_]*/})],
        relevance: 0
      },
      hljs.HASH_COMMENT_MODE,
      hljs.NUMBER_MODE,
      QUOTE_STRING,
      APOS_STRING,
      VAR
    ]
  };
};
},{}],8:[function(require,module,exports){
module.exports = function(hljs) {
  var IDENT_RE = '[a-zA-Z-][a-zA-Z0-9_-]*';
  var FUNCTION = {
    className: 'function',
    begin: IDENT_RE + '\\(', end: '\\)',
    contains: ['self', hljs.NUMBER_MODE, hljs.APOS_STRING_MODE, hljs.QUOTE_STRING_MODE]
  };
  return {
    case_insensitive: true,
    illegal: '[=/|\']',
    contains: [
      hljs.C_BLOCK_COMMENT_MODE,
      {
        className: 'id', begin: '\\#[A-Za-z0-9_-]+'
      },
      {
        className: 'class', begin: '\\.[A-Za-z0-9_-]+',
        relevance: 0
      },
      {
        className: 'attr_selector',
        begin: '\\[', end: '\\]',
        illegal: '$'
      },
      {
        className: 'pseudo',
        begin: ':(:)?[a-zA-Z0-9\\_\\-\\+\\(\\)\\"\\\']+'
      },
      {
        className: 'at_rule',
        begin: '@(font-face|page)',
        lexemes: '[a-z-]+',
        keywords: 'font-face page'
      },
      {
        className: 'at_rule',
        begin: '@', end: '[{;]', // at_rule eating first "{" is a good thing
                                 // because it doesn’t let it to be parsed as
                                 // a rule set but instead drops parser into
                                 // the default mode which is how it should be.
        contains: [
          {
            className: 'keyword',
            begin: /\S+/
          },
          {
            begin: /\s/, endsWithParent: true, excludeEnd: true,
            relevance: 0,
            contains: [
              FUNCTION,
              hljs.APOS_STRING_MODE, hljs.QUOTE_STRING_MODE,
              hljs.NUMBER_MODE
            ]
          }
        ]
      },
      {
        className: 'tag', begin: IDENT_RE,
        relevance: 0
      },
      {
        className: 'rules',
        begin: '{', end: '}',
        illegal: '[^\\s]',
        relevance: 0,
        contains: [
          hljs.C_BLOCK_COMMENT_MODE,
          {
            className: 'rule',
            begin: '[^\\s]', returnBegin: true, end: ';', endsWithParent: true,
            contains: [
              {
                className: 'attribute',
                begin: '[A-Z\\_\\.\\-]+', end: ':',
                excludeEnd: true,
                illegal: '[^\\s]',
                starts: {
                  className: 'value',
                  endsWithParent: true, excludeEnd: true,
                  contains: [
                    FUNCTION,
                    hljs.NUMBER_MODE,
                    hljs.QUOTE_STRING_MODE,
                    hljs.APOS_STRING_MODE,
                    hljs.C_BLOCK_COMMENT_MODE,
                    {
                      className: 'hexcolor', begin: '#[0-9A-Fa-f]+'
                    },
                    {
                      className: 'important', begin: '!important'
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ]
  };
};
},{}],9:[function(require,module,exports){
module.exports = function(hljs) {
  return {
    illegal: '\\S',
    contains: [
      {
        className: 'status',
        begin: '^HTTP/[0-9\\.]+', end: '$',
        contains: [{className: 'number', begin: '\\b\\d{3}\\b'}]
      },
      {
        className: 'request',
        begin: '^[A-Z]+ (.*?) HTTP/[0-9\\.]+$', returnBegin: true, end: '$',
        contains: [
          {
            className: 'string',
            begin: ' ', end: ' ',
            excludeBegin: true, excludeEnd: true
          }
        ]
      },
      {
        className: 'attribute',
        begin: '^\\w', end: ': ', excludeEnd: true,
        illegal: '\\n|\\s|=',
        starts: {className: 'string', end: '$'}
      },
      {
        begin: '\\n\\n',
        starts: {subLanguage: '', endsWithParent: true}
      }
    ]
  };
};
},{}],10:[function(require,module,exports){
module.exports = function(hljs) {
  return {
    case_insensitive: true,
    illegal: /\S/,
    contains: [
      {
        className: 'comment',
        begin: ';', end: '$'
      },
      {
        className: 'title',
        begin: '^\\[', end: '\\]'
      },
      {
        className: 'setting',
        begin: '^[a-z0-9\\[\\]_-]+[ \\t]*=[ \\t]*', end: '$',
        contains: [
          {
            className: 'value',
            endsWithParent: true,
            keywords: 'on off true false yes no',
            contains: [hljs.QUOTE_STRING_MODE, hljs.NUMBER_MODE],
            relevance: 0
          }
        ]
      }
    ]
  };
};
},{}],11:[function(require,module,exports){
module.exports = function(hljs) {
  return {
    aliases: ['js'],
    keywords: {
      keyword:
        'in if for while finally var new function do return void else break catch ' +
        'instanceof with throw case default try this switch continue typeof delete ' +
        'let yield const class',
      literal:
        'true false null undefined NaN Infinity',
      built_in:
        'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
        'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
        'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
        'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
        'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
        'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require'
    },
    contains: [
      {
        className: 'pi',
        begin: /^\s*('|")use strict('|")/,
        relevance: 10
      },
      hljs.APOS_STRING_MODE,
      hljs.QUOTE_STRING_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      { // "value" container
        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
        keywords: 'return throw case',
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          hljs.REGEXP_MODE,
          { // E4X
            begin: /</, end: />;/,
            relevance: 0,
            subLanguage: 'xml'
          }
        ],
        relevance: 0
      },
      {
        className: 'function',
        beginKeywords: 'function', end: /\{/,
        contains: [
          hljs.inherit(hljs.TITLE_MODE, {begin: /[A-Za-z$_][0-9A-Za-z$_]*/}),
          {
            className: 'params',
            begin: /\(/, end: /\)/,
            contains: [
              hljs.C_LINE_COMMENT_MODE,
              hljs.C_BLOCK_COMMENT_MODE
            ],
            illegal: /["'\(]/
          }
        ],
        illegal: /\[|%/
      },
      {
        begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
      },
      {
        begin: '\\.' + hljs.IDENT_RE, relevance: 0 // hack: prevents detection of keywords after dots
      }
    ]
  };
};
},{}],12:[function(require,module,exports){
module.exports = function(hljs) {
  var LITERALS = {literal: 'true false null'};
  var TYPES = [
    hljs.QUOTE_STRING_MODE,
    hljs.C_NUMBER_MODE
  ];
  var VALUE_CONTAINER = {
    className: 'value',
    end: ',', endsWithParent: true, excludeEnd: true,
    contains: TYPES,
    keywords: LITERALS
  };
  var OBJECT = {
    begin: '{', end: '}',
    contains: [
      {
        className: 'attribute',
        begin: '\\s*"', end: '"\\s*:\\s*', excludeBegin: true, excludeEnd: true,
        contains: [hljs.BACKSLASH_ESCAPE],
        illegal: '\\n',
        starts: VALUE_CONTAINER
      }
    ],
    illegal: '\\S'
  };
  var ARRAY = {
    begin: '\\[', end: '\\]',
    contains: [hljs.inherit(VALUE_CONTAINER, {className: null})], // inherit is also a workaround for a bug that makes shared modes with endsWithParent compile only the ending of one of the parents
    illegal: '\\S'
  };
  TYPES.splice(TYPES.length, 0, OBJECT, ARRAY);
  return {
    contains: TYPES,
    keywords: LITERALS,
    illegal: '\\S'
  };
};
},{}],13:[function(require,module,exports){
module.exports = function(hljs) {
  return {
    contains: [
      // highlight headers
      {
        className: 'header',
        variants: [
          { begin: '^#{1,6}', end: '$' },
          { begin: '^.+?\\n[=-]{2,}$' }
        ]
      },
      // inline html
      {
        begin: '<', end: '>',
        subLanguage: 'xml',
        relevance: 0
      },
      // lists (indicators only)
      {
        className: 'bullet',
        begin: '^([*+-]|(\\d+\\.))\\s+'
      },
      // strong segments
      {
        className: 'strong',
        begin: '[*_]{2}.+?[*_]{2}'
      },
      // emphasis segments
      {
        className: 'emphasis',
        variants: [
          { begin: '\\*.+?\\*' },
          { begin: '_.+?_'
          , relevance: 0
          }
        ]
      },
      // blockquotes
      {
        className: 'blockquote',
        begin: '^>\\s+', end: '$'
      },
      // code snippets
      {
        className: 'code',
        variants: [
          { begin: '`.+?`' },
          { begin: '^( {4}|\t)', end: '$'
          , relevance: 0
          }
        ]
      },
      // horizontal rules
      {
        className: 'horizontal_rule',
        begin: '^[-\\*]{3,}', end: '$'
      },
      // using links - title and link
      {
        begin: '\\[.+?\\][\\(\\[].+?[\\)\\]]',
        returnBegin: true,
        contains: [
          {
            className: 'link_label',
            begin: '\\[', end: '\\]',
            excludeBegin: true,
            returnEnd: true,
            relevance: 0
          },
          {
            className: 'link_url',
            begin: '\\]\\(', end: '\\)',
            excludeBegin: true, excludeEnd: true
          },
          {
            className: 'link_reference',
            begin: '\\]\\[', end: '\\]',
            excludeBegin: true, excludeEnd: true,
          }
        ],
        relevance: 10
      },
      {
        begin: '^\\[\.+\\]:', end: '$',
        returnBegin: true,
        contains: [
          {
            className: 'link_reference',
            begin: '\\[', end: '\\]',
            excludeBegin: true, excludeEnd: true
          },
          {
            className: 'link_url',
            begin: '\\s', end: '$'
          }
        ]
      }
    ]
  };
};
},{}],14:[function(require,module,exports){
module.exports = function(hljs) {
  var XML_IDENT_RE = '[A-Za-z0-9\\._:-]+';
  var PHP = {
    begin: /<\?(php)?(?!\w)/, end: /\?>/,
    subLanguage: 'php', subLanguageMode: 'continuous'
  };
  var TAG_INTERNALS = {
    endsWithParent: true,
    illegal: /</,
    relevance: 0,
    contains: [
      PHP,
      {
        className: 'attribute',
        begin: XML_IDENT_RE,
        relevance: 0
      },
      {
        begin: '=',
        relevance: 0,
        contains: [
          {
            className: 'value',
            variants: [
              {begin: /"/, end: /"/},
              {begin: /'/, end: /'/},
              {begin: /[^\s\/>]+/}
            ]
          }
        ]
      }
    ]
  };
  return {
    aliases: ['html'],
    case_insensitive: true,
    contains: [
      {
        className: 'doctype',
        begin: '<!DOCTYPE', end: '>',
        relevance: 10,
        contains: [{begin: '\\[', end: '\\]'}]
      },
      {
        className: 'comment',
        begin: '<!--', end: '-->',
        relevance: 10
      },
      {
        className: 'cdata',
        begin: '<\\!\\[CDATA\\[', end: '\\]\\]>',
        relevance: 10
      },
      {
        className: 'tag',
        /*
        The lookahead pattern (?=...) ensures that 'begin' only matches
        '<style' as a single word, followed by a whitespace or an
        ending braket. The '$' is needed for the lexeme to be recognized
        by hljs.subMode() that tests lexemes outside the stream.
        */
        begin: '<style(?=\\s|>|$)', end: '>',
        keywords: {title: 'style'},
        contains: [TAG_INTERNALS],
        starts: {
          end: '</style>', returnEnd: true,
          subLanguage: 'css'
        }
      },
      {
        className: 'tag',
        // See the comment in the <style tag about the lookahead pattern
        begin: '<script(?=\\s|>|$)', end: '>',
        keywords: {title: 'script'},
        contains: [TAG_INTERNALS],
        starts: {
          end: '</script>', returnEnd: true,
          subLanguage: 'javascript'
        }
      },
      {
        begin: '<%', end: '%>',
        subLanguage: 'vbscript'
      },
      PHP,
      {
        className: 'pi',
        begin: /<\?\w+/, end: /\?>/,
        relevance: 10
      },
      {
        className: 'tag',
        begin: '</?', end: '/?>',
        contains: [
          {
            className: 'title', begin: '[^ /><]+', relevance: 0
          },
          TAG_INTERNALS
        ]
      }
    ]
  };
};
},{}],15:[function(require,module,exports){
// http://highlightjs.readthedocs.org/en/latest/css-classes-reference.html

module.exports = [
  'addition',
  'annotaion',
  'annotation',
  'argument',
  'array',
  'at_rule',
  'attr_selector',
  'attribute',
  'begin-block',
  'blockquote',
  'body',
  'built_in',
  'bullet',
  'cbracket',
  'cdata',
  'cell',
  'change',
  'char',
  'chunk',
  'class',
  'code',
  'collection',
  'command',
  'commands',
  'commen',
  'comment',
  'constant',
  'container',
  'dartdoc',
  'date',
  'decorator',
  'default',
  'deletion',
  'doctype',
  'emphasis',
  'end-block',
  'envvar',
  'expression',
  'filename',
  'filter',
  'flow',
  'foreign',
  'formula',
  'func',
  'function',
  'function_name',
  'generics',
  'header',
  'hexcolor',
  'horizontal_rule',
  'id',
  'import',
  'important',
  'infix',
  'inheritance',
  'input',
  'javadoc',
  'javadoctag',
  'keyword',
  'keywords',
  'label',
  'link_label',
  'link_reference',
  'link_url',
  'list',
  'literal',
  'localvars',
  'long_brackets',
  'matrix',
  'module',
  'number',
  'operator',
  'output',
  'package',
  'param',
  'parameter',
  'params',
  'parent',
  'phpdoc',
  'pi',
  'pod',
  'pp',
  'pragma',
  'preprocessor',
  'prompt',
  'property',
  'pseudo',
  'quoted',
  'record_name',
  'regex',
  'regexp',
  'request',
  'reserved',
  'rest_arg',
  'rules',
  'shader',
  'shading',
  'shebang',
  'special',
  'sqbracket',
  'status',
  'stl_container',
  'stream',
  'string',
  'strong',
  'sub',
  'subst',
  'summary',
  'symbol',
  'tag',
  'template_comment',
  'template_tag',
  'title',
  'type',
  'typedef',
  'typename',
  'value',
  'var_expand',
  'variable',
  'winutils',
  'xmlDocTag',
  'yardoctag'
]

},{}],16:[function(require,module,exports){
'use strict';

var toMap = require('./toMap');
var uris = ['background', 'base', 'cite', 'href', 'longdesc', 'src', 'usemap'];

module.exports = {
  uris: toMap(uris) // attributes that have an href and hence need to be sanitized
};

},{"./toMap":24}],17:[function(require,module,exports){
'use strict';

var defaults = {
  allowedAttributes: {
    a: ['href', 'name', 'target', 'title', 'aria-label'],
    iframe: ['allowfullscreen', 'frameborder', 'src'],
    img: ['src', 'alt', 'title', 'aria-label']
  },
  allowedClasses: {},
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedTags: [
    'a', 'article', 'b', 'blockquote', 'br', 'caption', 'code', 'del', 'details', 'div', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'main', 'mark',
    'ol', 'p', 'pre', 'section', 'span', 'strike', 'strong', 'sub', 'summary', 'sup', 'table',
    'tbody', 'td', 'th', 'thead', 'tr', 'ul'
  ],
  filter: null
};

module.exports = defaults;

},{}],18:[function(require,module,exports){
'use strict';

var toMap = require('./toMap');
var voids = ['area', 'br', 'col', 'hr', 'img', 'wbr', 'input', 'base', 'basefont', 'link', 'meta'];

module.exports = {
  voids: toMap(voids)
};

},{"./toMap":24}],19:[function(require,module,exports){
'use strict';

var he = require('he');
var assign = require('assignment');
var parser = require('./parser');
var sanitizer = require('./sanitizer');
var defaults = require('./defaults');

function insane (html, options, strict) {
  var buffer = [];
  var configuration = strict === true ? options : assign({}, defaults, options);
  var handler = sanitizer(buffer, configuration);

  parser(html, handler);

  return buffer.join('');
}

insane.defaults = defaults;
module.exports = insane;

},{"./defaults":17,"./parser":21,"./sanitizer":22,"assignment":3,"he":23}],20:[function(require,module,exports){
'use strict';

module.exports = function lowercase (string) {
  return typeof string === 'string' ? string.toLowerCase() : string;
};

},{}],21:[function(require,module,exports){
'use strict';

var he = require('he');
var lowercase = require('./lowercase');
var attributes = require('./attributes');
var elements = require('./elements');
var rstart = /^<\s*([\w:-]+)((?:\s+[\w:-]+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)\s*>/;
var rend = /^<\s*\/\s*([\w:-]+)[^>]*>/;
var rattrs = /([\w:-]+)(?:\s*=\s*(?:(?:"((?:[^"])*)")|(?:'((?:[^'])*)')|([^>\s]+)))?/g;
var rtag = /^</;
var rtagend = /^<\s*\//;

function createStack () {
  var stack = [];
  stack.lastItem = function lastItem () {
    return stack[stack.length - 1];
  };
  return stack;
}

function parser (html, handler) {
  var stack = createStack();
  var last = html;
  var chars;

  while (html) {
    parsePart();
  }
  parseEndTag(); // clean up any remaining tags

  function parsePart () {
    chars = true;
    parseTag();

    var same = html === last;
    last = html;

    if (same) { // discard, because it's invalid
      html = '';
    }
  }

  function parseTag () {
    if (html.substr(0, 4) === '<!--') { // comments
      parseComment();
    } else if (rtagend.test(html)) {
      parseEdge(rend, parseEndTag);
    } else if (rtag.test(html)) {
      parseEdge(rstart, parseStartTag);
    }
    parseTagDecode();
  }

  function parseEdge (regex, parser) {
    var match = html.match(regex);
    if (match) {
      html = html.substring(match[0].length);
      match[0].replace(regex, parser);
      chars = false;
    }
  }

  function parseComment () {
    var index = html.indexOf('-->');
    if (index >= 0) {
      if (handler.comment) {
        handler.comment(html.substring(4, index));
      }
      html = html.substring(index + 3);
      chars = false;
    }
  }

  function parseTagDecode () {
    if (!chars) {
      return;
    }
    var text;
    var index = html.indexOf('<');
    if (index >= 0) {
      text = html.substring(0, index);
      html = html.substring(index);
    } else {
      text = html;
      html = '';
    }
    if (handler.chars) {
      handler.chars(text);
    }
  }

  function parseStartTag (tag, tagName, rest, unary) {
    var attrs = {};
    var low = lowercase(tagName);
    var u = elements.voids[low] || !!unary;

    rest.replace(rattrs, attrReplacer);

    if (!u) {
      stack.push(low);
    }
    if (handler.start) {
      handler.start(low, attrs, u);
    }

    function attrReplacer (match, name, doubleQuotedValue, singleQuotedValue, unquotedValue) {
      if (doubleQuotedValue === void 0 && singleQuotedValue === void 0 && unquotedValue === void 0) {
        attrs[name] = void 0; // attribute is like <button disabled></button>
      } else {
        attrs[name] = he.decode(doubleQuotedValue || singleQuotedValue || unquotedValue || '');
      }
    }
  }

  function parseEndTag (tag, tagName) {
    var i;
    var pos = 0;
    var low = lowercase(tagName);
    if (low) {
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos] === low) {
          break; // find the closest opened tag of the same type
        }
      }
    }
    if (pos >= 0) {
      for (i = stack.length - 1; i >= pos; i--) {
        if (handler.end) { // close all the open elements, up the stack
          handler.end(stack[i]);
        }
      }
      stack.length = pos;
    }
  }
}

module.exports = parser;

},{"./attributes":16,"./elements":18,"./lowercase":20,"he":23}],22:[function(require,module,exports){
'use strict';

var he = require('he');
var lowercase = require('./lowercase');
var attributes = require('./attributes');

function sanitizer (buffer, options) {
  var last;
  var context;
  var o = options || {};

  reset();

  return {
    start: start,
    end: end,
    chars: chars
  };

  function out (value) {
    buffer.push(value);
  }

  function start (tag, attrs, unary) {
    var low = lowercase(tag);

    if (context.ignoring) {
      ignore(low); return;
    }
    if ((o.allowedTags || []).indexOf(low) === -1) {
      ignore(low); return;
    }
    if (o.filter && !o.filter({ tag: low, attrs: attrs })) {
      ignore(low); return;
    }

    out('<');
    out(low);
    Object.keys(attrs).forEach(parse);
    out(unary ? '/>' : '>');

    function parse (key) {
      var value = attrs[key];
      var classesOk = (o.allowedClasses || {})[low] || [];
      var attrsOk = (o.allowedAttributes || {})[low] || [];
      var valid;
      var lkey = lowercase(key);
      if (lkey === 'class' && attrsOk.indexOf(lkey) === -1) {
        value = value.split(' ').filter(isValidClass).join(' ').trim();
        valid = value.length;
      } else {
        valid = attrsOk.indexOf(lkey) !== -1 && (attributes.uris[lkey] !== true || testUrl(value));
      }
      if (valid) {
        out(' ');
        out(key);
        if (typeof value === 'string') {
          out('="');
          out(he.encode(value));
          out('"');
        }
      }
      function isValidClass (className) {
        return classesOk && classesOk.indexOf(className) !== -1;
      }
    }
  }

  function end (tag) {
    var low = lowercase(tag);
    var allowed = (o.allowedTags || []).indexOf(low) !== -1;
    if (allowed) {
      if (context.ignoring === false) {
        out('</');
        out(low);
        out('>');
      } else {
        unignore(low);
      }
    } else {
      unignore(low);
    }
  }

  function testUrl (text) {
    var start = text[0];
    if (start === '#' || start === '/') {
      return true;
    }
    var colon = text.indexOf(':');
    if (colon === -1) {
      return true;
    }
    var questionmark = text.indexOf('?');
    if (questionmark !== -1 && colon > questionmark) {
      return true;
    }
    var hash = text.indexOf('#');
    if (hash !== -1 && colon > hash) {
      return true;
    }
    return o.allowedSchemes.some(matches);

    function matches (scheme) {
      return text.indexOf(scheme + ':') === 0;
    }
  }

  function chars (text) {
    if (context.ignoring === false) {
      out(text);
    }
  }

  function ignore (tag) {
    if (context.ignoring === false) {
      context = { ignoring: tag, depth: 1 };
    } else if (context.ignoring === tag) {
      context.depth++;
    }
  }

  function unignore (tag) {
    if (context.ignoring === tag) {
      if (--context.depth <= 0) {
        reset();
      }
    }
  }

  function reset () {
    context = { ignoring: false, depth: 0 };
  }
}

module.exports = sanitizer;

},{"./attributes":16,"./lowercase":20,"he":23}],23:[function(require,module,exports){
'use strict';

var escapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};
var unescapes = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'"
};
var rescaped = /(&amp;|&lt;|&gt;|&quot;|&#39;)/g;
var runescaped = /[&<>"']/g;

function escapeHtmlChar (match) {
  return escapes[match];
}
function unescapeHtmlChar (match) {
  return unescapes[match];
}

function escapeHtml (text) {
  return text == null ? '' : String(text).replace(runescaped, escapeHtmlChar);
}

function unescapeHtml (html) {
  return html == null ? '' : String(html).replace(rescaped, unescapeHtmlChar);
}

escapeHtml.options = unescapeHtml.options = {};

module.exports = {
  encode: escapeHtml,
  escape: escapeHtml,
  decode: unescapeHtml,
  unescape: unescapeHtml,
  version: '1.0.0-browser'
};

},{}],24:[function(require,module,exports){
'use strict';

function toMap (list) {
  return list.reduce(asKey, {});
}

function asKey (accumulator, item) {
  accumulator[item] = true;
  return accumulator;
}

module.exports = toMap;

},{}],25:[function(require,module,exports){
'use strict';


////////////////////////////////////////////////////////////////////////////////
// Helpers

// Merge objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return; }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}

function _class(obj) { return Object.prototype.toString.call(obj); }
function isString(obj) { return _class(obj) === '[object String]'; }
function isObject(obj) { return _class(obj) === '[object Object]'; }
function isRegExp(obj) { return _class(obj) === '[object RegExp]'; }
function isFunction(obj) { return _class(obj) === '[object Function]'; }


function escapeRE (str) { return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&'); }

////////////////////////////////////////////////////////////////////////////////


var defaultSchemas = {
  'http:': {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.http) {
        // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.http =  new RegExp(
          '^\\/\\/' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length;
      }
      return 0;
    }
  },
  'https:':  'http:',
  'ftp:':    'http:',
  '//':      {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.no_http) {
      // compile lazily, becayse "host"-containing variables can change on tlds update.
        self.re.no_http =  new RegExp(
          '^' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }

      if (self.re.no_http.test(tail)) {
        // should not be `://`, that protects from errors in protocol name
        if (pos >= 3 && text[pos - 3] === ':') { return 0; }
        return tail.match(self.re.no_http)[0].length;
      }
      return 0;
    }
  },
  'mailto:': {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.mailto) {
        self.re.mailto =  new RegExp(
          '^' + self.re.src_email_name + '@' + self.re.src_host_strict, 'i'
        );
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length;
      }
      return 0;
    }
  }
};

// DON'T try to make PRs with changes. Extend TLDs with LinkifyIt.tlds() instead
var tlds_default = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф'.split('|');

////////////////////////////////////////////////////////////////////////////////

function resetScanCache(self) {
  self.__index__ = -1;
  self.__text_cache__   = '';
}

function createValidator(re) {
  return function (text, pos) {
    var tail = text.slice(pos);

    if (re.test(tail)) {
      return tail.match(re)[0].length;
    }
    return 0;
  };
}

function createNormalizer() {
  return function (match, self) {
    self.normalize(match);
  };
}

// Schemas compiler. Build regexps.
//
function compile(self) {

  // Load & clone RE patterns.
  var re = self.re = assign({}, require('./lib/re'));

  // Define dynamic patterns
  var tlds = self.__tlds__.slice();

  if (!self.__tlds_replaced__) {
    tlds.push('[a-z]{2}');
  }
  tlds.push(re.src_xn);

  re.src_tlds = tlds.join('|');

  function untpl(tpl) { return tpl.replace('%TLDS%', re.src_tlds); }

  re.email_fuzzy      = RegExp(untpl(re.tpl_email_fuzzy), 'i');
  re.link_fuzzy       = RegExp(untpl(re.tpl_link_fuzzy), 'i');
  re.host_fuzzy_test  = RegExp(untpl(re.tpl_host_fuzzy_test), 'i');

  //
  // Compile each schema
  //

  var aliases = [];

  self.__compiled__ = {}; // Reset compiled data

  function schemaError(name, val) {
    throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val);
  }

  Object.keys(self.__schemas__).forEach(function (name) {
    var val = self.__schemas__[name];

    // skip disabled methods
    if (val === null) { return; }

    var compiled = { validate: null, link: null };

    self.__compiled__[name] = compiled;

    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }

      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }

      return;
    }

    if (isString(val)) {
      aliases.push(name);
      return;
    }

    schemaError(name, val);
  });

  //
  // Compile postponed aliases
  //

  aliases.forEach(function (alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      // Silently fail on missed schemas to avoid errons on disable.
      // schemaError(alias, self.__schemas__[alias]);
      return;
    }

    self.__compiled__[alias].validate =
      self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize =
      self.__compiled__[self.__schemas__[alias]].normalize;
  });

  //
  // Fake record for guessed links
  //
  self.__compiled__[''] = { validate: null, normalize: createNormalizer() };

  //
  // Build schema condition
  //
  var slist = Object.keys(self.__compiled__)
                      .filter(function(name) {
                        // Filter disabled & fake schemas
                        return name.length > 0 && self.__compiled__[name];
                      })
                      .map(escapeRE)
                      .join('|');
  // (?!_) cause 1.5x slowdown
  self.re.schema_test   = RegExp('(^|(?!_)(?:>|' + re.src_ZPCcCf + '))(' + slist + ')', 'i');
  self.re.schema_search = RegExp('(^|(?!_)(?:>|' + re.src_ZPCcCf + '))(' + slist + ')', 'ig');

  //
  // Cleanup
  //

  resetScanCache(self);
}

/**
 * class Match
 *
 * Match result. Single element of array, returned by [[LinkifyIt#match]]
 **/
function Match(self, shift) {
  var start = self.__index__,
      end   = self.__last_index__,
      text  = self.__text_cache__.slice(start, end);

  /**
   * Match#schema -> String
   *
   * Prefix (protocol) for matched string.
   **/
  this.schema    = self.__schema__.toLowerCase();
  /**
   * Match#index -> Number
   *
   * First position of matched string.
   **/
  this.index     = start + shift;
  /**
   * Match#lastIndex -> Number
   *
   * Next position after matched string.
   **/
  this.lastIndex = end + shift;
  /**
   * Match#raw -> String
   *
   * Matched string.
   **/
  this.raw       = text;
  /**
   * Match#text -> String
   *
   * Notmalized text of matched string.
   **/
  this.text      = text;
  /**
   * Match#url -> String
   *
   * Normalized url of matched string.
   **/
  this.url       = text;
}

function createMatch(self, shift) {
  var match = new Match(self, shift);

  self.__compiled__[match.schema].normalize(match, self);

  return match;
}


/**
 * class LinkifyIt
 **/

/**
 * new LinkifyIt(schemas)
 * - schemas (Object): Optional. Additional schemas to validate (prefix/validator)
 *
 * Creates new linkifier instance with optional additional schemas.
 * Can be called without `new` keyword for convenience.
 *
 * By default understands:
 *
 * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
 * - "fuzzy" links and emails (example.com, foo@bar.com).
 *
 * `schemas` is an object, where each key/value describes protocol/rule:
 *
 * - __key__ - link prefix (usually, protocol name with `:` at the end, `skype:`
 *   for example). `linkify-it` makes shure that prefix is not preceeded with
 *   alphanumeric char and symbols. Only whitespaces and punctuation allowed.
 * - __value__ - rule to check tail after link prefix
 *   - _String_ - just alias to existing rule
 *   - _Object_
 *     - _validate_ - validator function (should return matched length on success),
 *       or `RegExp`.
 *     - _normalize_ - optional function to normalize text & url of matched result
 *       (for example, for @twitter mentions).
 **/
function LinkifyIt(schemas) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas);
  }

  // Cache last tested result. Used to skip repeating steps on next `match` call.
  this.__index__          = -1;
  this.__last_index__     = -1; // Next scan position
  this.__schema__         = '';
  this.__text_cache__     = '';

  this.__schemas__        = assign({}, defaultSchemas, schemas);
  this.__compiled__       = {};

  this.__tlds__           = tlds_default;
  this.__tlds_replaced__  = false;

  this.re = {};

  compile(this);
}


/** chainable
 * LinkifyIt#add(schema, definition)
 * - schema (String): rule name (fixed pattern prefix)
 * - definition (String|RegExp|Object): schema definition
 *
 * Add new rule definition. See constructor description for details.
 **/
LinkifyIt.prototype.add = function add(schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this;
};


/**
 * LinkifyIt#test(text) -> Boolean
 *
 * Searches linkifiable pattern and returns `true` on success or `false` on fail.
 **/
LinkifyIt.prototype.test = function test(text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__      = -1;

  if (!text.length) { return false; }

  var m, ml, me, len, shift, next, re, tld_pos, at_pos;

  // try to scan for link with schema - that's the most simple rule
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        this.__schema__     = m[2];
        this.__index__      = m.index + m[1].length;
        this.__last_index__ = m.index + m[0].length + len;
        break;
      }
    }
  }

  if (this.__compiled__['http:']) {
    // guess schemaless links
    tld_pos = text.search(this.re.host_fuzzy_test);
    if (tld_pos >= 0) {
      // if tld is located after found link - no need to check fuzzy pattern
      if (this.__index__ < 0 || tld_pos < this.__index__) {
        if ((ml = text.match(this.re.link_fuzzy)) !== null) {

          shift = ml.index + ml[1].length;

          if (this.__index__ < 0 || shift < this.__index__) {
            this.__schema__     = '';
            this.__index__      = shift;
            this.__last_index__ = ml.index + ml[0].length;
          }
        }
      }
    }
  }

  if (this.__compiled__['mailto:']) {
    // guess schemaless emails
    at_pos = text.indexOf('@');
    if (at_pos >= 0) {
      // We can't skip this check, because this cases are possible:
      // 192.168.1.1@gmail.com, my.in@example.com
      if ((me = text.match(this.re.email_fuzzy)) !== null) {

        shift = me.index + me[1].length;
        next  = me.index + me[0].length;

        if (this.__index__ < 0 || shift < this.__index__ ||
            (shift === this.__index__ && next > this.__last_index__)) {
          this.__schema__     = 'mailto:';
          this.__index__      = shift;
          this.__last_index__ = next;
        }
      }
    }
  }

  return this.__index__ >= 0;
};


/**
 * LinkifyIt#testSchemaAt(text, name, position) -> Number
 * - text (String): text to scan
 * - name (String): rule (schema) name
 * - position (Number): text offset to check from
 *
 * Similar to [[LinkifyIt#test]] but checks only specific protocol tail exactly
 * at given position. Returns length of found pattern (0 on fail).
 **/
LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text, schema, pos) {
  // If not supported schema check requested - terminate
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0;
  }
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this);
};


/**
 * LinkifyIt#match(text) -> Array|null
 *
 * Returns array of found link descriptions or `null` on fail. We strongly
 * to use [[LinkifyIt#test]] first, for best speed.
 *
 * ##### Result match description
 *
 * - __schema__ - link schema, can be empty for fuzzy links, or `//` for
 *   protocol-neutral  links.
 * - __index__ - offset of matched text
 * - __lastIndex__ - index of next char after mathch end
 * - __raw__ - matched text
 * - __text__ - normalized text
 * - __url__ - link, generated from matched text
 **/
LinkifyIt.prototype.match = function match(text) {
  var shift = 0, result = [];

  // Try to take previous element from cache, if .test() called before
  if (this.__index__ >= 0 && this.__text_cache__ === text) {
    result.push(createMatch(this, shift));
    shift = this.__last_index__;
  }

  // Cut head if cache was used
  var tail = shift ? text.slice(shift) : text;

  // Scan string until end reached
  while (this.test(tail)) {
    result.push(createMatch(this, shift));

    tail = tail.slice(this.__last_index__);
    shift += this.__last_index__;
  }

  if (result.length) {
    return result;
  }

  return null;
};


/** chainable
 * LinkifyIt#tlds(list [, keepOld]) -> this
 * - list (Array): list of tlds
 * - keepOld (Boolean): merge with current list if `true` (`false` by default)
 *
 * Load (or merge) new tlds list. Those are user for fuzzy links (without prefix)
 * to avoid false positives. By default this algorythm used:
 *
 * - hostname with any 2-letter root zones are ok.
 * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
 *   are ok.
 * - encoded (`xn--...`) root zones are ok.
 *
 * If list is replaced, then exact match for 2-chars root zones will be checked.
 **/
LinkifyIt.prototype.tlds = function tlds(list, keepOld) {
  list = Array.isArray(list) ? list : [ list ];

  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this;
  }

  this.__tlds__ = this.__tlds__.concat(list)
                                  .sort()
                                  .filter(function(el, idx, arr) {
                                    return el !== arr[idx - 1];
                                  })
                                  .reverse();

  compile(this);
  return this;
};

/**
 * LinkifyIt#normalize(match)
 *
 * Default normalizer (if schema does not define it's own).
 **/
LinkifyIt.prototype.normalize = function normalize(match) {

  // Do minimal possible changes by default. Need to collect feedback prior
  // to move forward https://github.com/markdown-it/linkify-it/issues/1

  if (!match.schema) { match.url = 'http://' + match.url; }

  if (match.schema === 'mailto:' && !/^mailto:/i.test(match.url)) {
    match.url = 'mailto:' + match.url;
  }
};


module.exports = LinkifyIt;

},{"./lib/re":26}],26:[function(require,module,exports){
'use strict';

// Use direct extract instead of `regenerate` to reduse browserified size
var src_Any = exports.src_Any = require('uc.micro/properties/Any/regex').source;
var src_Cc  = exports.src_Cc = require('uc.micro/categories/Cc/regex').source;
var src_Cf  = exports.src_Cf = require('uc.micro/categories/Cf/regex').source;
var src_Z   = exports.src_Z  = require('uc.micro/categories/Z/regex').source;
var src_P   = exports.src_P  = require('uc.micro/categories/P/regex').source;

// \p{\Z\P\Cc\CF} (white spaces + control + format + punctuation)
var src_ZPCcCf = exports.src_ZPCcCf = [ src_Z, src_P, src_Cc, src_Cf ].join('|');

// All possible word characters (everything without punctuation, spaces & controls)
// Defined via punctuation & spaces to save space
// Should be something like \p{\L\N\S\M} (\w but without `_`)
var src_pseudo_letter       = '(?:(?!' + src_ZPCcCf + ')' + src_Any + ')';
// The same as abothe but without [0-9]
var src_pseudo_letter_non_d = '(?:(?![0-9]|' + src_ZPCcCf + ')' + src_Any + ')';

////////////////////////////////////////////////////////////////////////////////

var src_ip4 = exports.src_ip4 =

  '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

exports.src_auth    = '(?:(?:(?!' + src_Z + ').)+@)?';

var src_port = exports.src_port =

  '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?';

var src_host_terminator = exports.src_host_terminator =

  '(?=$|' + src_ZPCcCf + ')(?!-|_|:\\d|\\.-|\\.(?!$|' + src_ZPCcCf + '))';

var src_path = exports.src_path =

  '(?:' +
    '[/?#]' +
      '(?:' +
        '(?!' + src_Z + '|[()[\\]{}.,"\'?!\\-]).|' +
        '\\[(?:(?!' + src_Z + '|\\]).)*\\]|' +
        '\\((?:(?!' + src_Z + '|[)]).)*\\)|' +
        '\\{(?:(?!' + src_Z + '|[}]).)*\\}|' +
        '\\"(?:(?!' + src_Z + '|["]).)+\\"|' +
        "\\'(?:(?!" + src_Z + "|[']).)+\\'|" +
        "\\'(?=" + src_pseudo_letter + ').|' +  // allow `I'm_king` if no pair found
        '\\.(?!' + src_Z + '|[.]).|' +
        '\\-(?!' + src_Z + '|--(?:[^-]|$))(?:[-]+|.)|' +  // `---` => long dash, terminate
        '\\,(?!' + src_Z + ').|' +      // allow `,,,` in paths
        '\\!(?!' + src_Z + '|[!]).|' +
        '\\?(?!' + src_Z + '|[?]).' +
      ')+' +
    '|\\/' +
  ')?';

var src_email_name = exports.src_email_name =

  '[\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]+';

var src_xn = exports.src_xn =

  'xn--[a-z0-9\\-]{1,59}';

// More to read about domain names
// http://serverfault.com/questions/638260/

var src_domain_root = exports.src_domain_root =

  // Can't have digits and dashes
  '(?:' +
    src_xn +
    '|' +
    src_pseudo_letter_non_d + '{1,63}' +
  ')';

var src_domain = exports.src_domain =

  '(?:' +
    src_xn +
    '|' +
    '(?:' + src_pseudo_letter + ')' +
    '|' +
    // don't allow `--` in domain names, because:
    // - that can conflict with markdown &mdash; / &ndash;
    // - nobody use those anyway
    '(?:' + src_pseudo_letter + '(?:-(?!-)|' + src_pseudo_letter + '){0,61}' + src_pseudo_letter + ')' +
  ')';

var src_host = exports.src_host =

  '(?:' +
    src_ip4 +
  '|' +
    '(?:(?:(?:' + src_domain + ')\\.)*' + src_domain_root + ')' +
  ')';

var tpl_host_fuzzy = exports.tpl_host_fuzzy =

  '(?:' +
    src_ip4 +
  '|' +
    '(?:(?:(?:' + src_domain + ')\\.)+(?:%TLDS%))' +
  ')';

exports.src_host_strict =

  src_host + src_host_terminator;

var tpl_host_fuzzy_strict = exports.tpl_host_fuzzy_strict =

  tpl_host_fuzzy + src_host_terminator;

exports.src_host_port_strict =

  src_host + src_port + src_host_terminator;

var tpl_host_port_fuzzy_strict = exports.tpl_host_port_fuzzy_strict =

  tpl_host_fuzzy + src_port + src_host_terminator;

////////////////////////////////////////////////////////////////////////////////
// Main rules

// Rude test fuzzy links by host, for quick deny
exports.tpl_host_fuzzy_test =

  'localhost|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + src_ZPCcCf + '|$))';

exports.tpl_email_fuzzy =

    '(^|>|' + src_Z + ')(' + src_email_name + '@' + tpl_host_fuzzy_strict + ')';

exports.tpl_link_fuzzy =
    // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|]|' + src_ZPCcCf + '))' +
    '((?![$+<=>^`|])' + tpl_host_port_fuzzy_strict + src_path + ')';

},{"uc.micro/categories/Cc/regex":27,"uc.micro/categories/Cf/regex":28,"uc.micro/categories/P/regex":29,"uc.micro/categories/Z/regex":30,"uc.micro/properties/Any/regex":31}],27:[function(require,module,exports){
module.exports=/[\0-\x1F\x7F-\x9F]/
},{}],28:[function(require,module,exports){
module.exports=/[\xAD\u0600-\u0605\u061C\u06DD\u070F\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF\uFFF9-\uFFFB]|\uD804\uDCBD|\uD82F[\uDCA0-\uDCA3]|\uD834[\uDD73-\uDD7A]|\uDB40[\uDC01\uDC20-\uDC7F]/
},{}],29:[function(require,module,exports){
module.exports=/[!-#%-\*,-/:;\?@\[-\]_\{\}\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC8\uDDCD\uDE38-\uDE3D]|\uD805[\uDCC6\uDDC1-\uDDC9\uDE41-\uDE43]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F/
},{}],30:[function(require,module,exports){
module.exports=/[ \xA0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000]/
},{}],31:[function(require,module,exports){
module.exports=/[\0-\uD7FF\uDC00-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF]/
},{}],32:[function(require,module,exports){
'use strict';


module.exports = require('./lib/');

},{"./lib/":42}],33:[function(require,module,exports){
// HTML5 entities map: { name -> utf16string }
//
'use strict';

/*eslint quotes:0*/
module.exports = require('entities/maps/entities.json');

},{"entities/maps/entities.json":83}],34:[function(require,module,exports){
// List of valid html blocks names, accorting to commonmark spec
// http://jgm.github.io/CommonMark/spec.html#html-blocks

'use strict';


module.exports = [
  'address',
  'article',
  'aside',
  'base',
  'basefont',
  'blockquote',
  'body',
  'caption',
  'center',
  'col',
  'colgroup',
  'dd',
  'details',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'frame',
  'frameset',
  'h1',
  'head',
  'header',
  'hr',
  'html',
  'legend',
  'li',
  'link',
  'main',
  'menu',
  'menuitem',
  'meta',
  'nav',
  'noframes',
  'ol',
  'optgroup',
  'option',
  'p',
  'param',
  'pre',
  'section',
  'source',
  'title',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'title',
  'tr',
  'track',
  'ul'
];

},{}],35:[function(require,module,exports){
// Regexps to match html elements

'use strict';

var attr_name     = '[a-zA-Z_:][a-zA-Z0-9:._-]*';

var unquoted      = '[^"\'=<>`\\x00-\\x20]+';
var single_quoted = "'[^']*'";
var double_quoted = '"[^"]*"';

var attr_value  = '(?:' + unquoted + '|' + single_quoted + '|' + double_quoted + ')';

var attribute   = '(?:\\s+' + attr_name + '(?:\\s*=\\s*' + attr_value + ')?)';

var open_tag    = '<[A-Za-z][A-Za-z0-9\\-]*' + attribute + '*\\s*\\/?>';

var close_tag   = '<\\/[A-Za-z][A-Za-z0-9\\-]*\\s*>';
var comment     = '<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->';
var processing  = '<[?].*?[?]>';
var declaration = '<![A-Z]+\\s+[^>]*>';
var cdata       = '<!\\[CDATA\\[[\\s\\S]*?\\]\\]>';

var HTML_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + '|' + comment +
                        '|' + processing + '|' + declaration + '|' + cdata + ')');
var HTML_OPEN_CLOSE_TAG_RE = new RegExp('^(?:' + open_tag + '|' + close_tag + ')');

module.exports.HTML_TAG_RE = HTML_TAG_RE;
module.exports.HTML_OPEN_CLOSE_TAG_RE = HTML_OPEN_CLOSE_TAG_RE;

},{}],36:[function(require,module,exports){
// List of valid url schemas, accorting to commonmark spec
// http://jgm.github.io/CommonMark/spec.html#autolinks

'use strict';


module.exports = [
  'coap',
  'doi',
  'javascript',
  'aaa',
  'aaas',
  'about',
  'acap',
  'cap',
  'cid',
  'crid',
  'data',
  'dav',
  'dict',
  'dns',
  'file',
  'ftp',
  'geo',
  'go',
  'gopher',
  'h323',
  'http',
  'https',
  'iax',
  'icap',
  'im',
  'imap',
  'info',
  'ipp',
  'iris',
  'iris.beep',
  'iris.xpc',
  'iris.xpcs',
  'iris.lwz',
  'ldap',
  'mailto',
  'mid',
  'msrp',
  'msrps',
  'mtqp',
  'mupdate',
  'news',
  'nfs',
  'ni',
  'nih',
  'nntp',
  'opaquelocktoken',
  'pop',
  'pres',
  'rtsp',
  'service',
  'session',
  'shttp',
  'sieve',
  'sip',
  'sips',
  'sms',
  'snmp',
  'soap.beep',
  'soap.beeps',
  'tag',
  'tel',
  'telnet',
  'tftp',
  'thismessage',
  'tn3270',
  'tip',
  'tv',
  'urn',
  'vemmi',
  'ws',
  'wss',
  'xcon',
  'xcon-userid',
  'xmlrpc.beep',
  'xmlrpc.beeps',
  'xmpp',
  'z39.50r',
  'z39.50s',
  'adiumxtra',
  'afp',
  'afs',
  'aim',
  'apt',
  'attachment',
  'aw',
  'beshare',
  'bitcoin',
  'bolo',
  'callto',
  'chrome',
  'chrome-extension',
  'com-eventbrite-attendee',
  'content',
  'cvs',
  'dlna-playsingle',
  'dlna-playcontainer',
  'dtn',
  'dvb',
  'ed2k',
  'facetime',
  'feed',
  'finger',
  'fish',
  'gg',
  'git',
  'gizmoproject',
  'gtalk',
  'hcp',
  'icon',
  'ipn',
  'irc',
  'irc6',
  'ircs',
  'itms',
  'jar',
  'jms',
  'keyparc',
  'lastfm',
  'ldaps',
  'magnet',
  'maps',
  'market',
  'message',
  'mms',
  'ms-help',
  'msnim',
  'mumble',
  'mvn',
  'notes',
  'oid',
  'palm',
  'paparazzi',
  'platform',
  'proxy',
  'psyc',
  'query',
  'res',
  'resource',
  'rmi',
  'rsync',
  'rtmp',
  'secondlife',
  'sftp',
  'sgn',
  'skype',
  'smb',
  'soldat',
  'spotify',
  'ssh',
  'steam',
  'svn',
  'teamspeak',
  'things',
  'udp',
  'unreal',
  'ut2004',
  'ventrilo',
  'view-source',
  'webcal',
  'wtai',
  'wyciwyg',
  'xfire',
  'xri',
  'ymsgr'
];

},{}],37:[function(require,module,exports){
// Utilities
//
'use strict';


function _class(obj) { return Object.prototype.toString.call(obj); }

function isString(obj) { return _class(obj) === '[object String]'; }

var _hasOwnProperty = Object.prototype.hasOwnProperty;

function has(object, key) {
  return _hasOwnProperty.call(object, key);
}

// Merge objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be object');
    }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}

// Remove element from array and put another array at those position.
// Useful for some operations with tokens
function arrayReplaceAt(src, pos, newElements) {
  return [].concat(src.slice(0, pos), newElements, src.slice(pos + 1));
}

////////////////////////////////////////////////////////////////////////////////

function isValidEntityCode(c) {
  /*eslint no-bitwise:0*/
  // broken sequence
  if (c >= 0xD800 && c <= 0xDFFF) { return false; }
  // never used
  if (c >= 0xFDD0 && c <= 0xFDEF) { return false; }
  if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) { return false; }
  // control codes
  if (c >= 0x00 && c <= 0x08) { return false; }
  if (c === 0x0B) { return false; }
  if (c >= 0x0E && c <= 0x1F) { return false; }
  if (c >= 0x7F && c <= 0x9F) { return false; }
  // out of range
  if (c > 0x10FFFF) { return false; }
  return true;
}

function fromCodePoint(c) {
  /*eslint no-bitwise:0*/
  if (c > 0xffff) {
    c -= 0x10000;
    var surrogate1 = 0xd800 + (c >> 10),
        surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}


var UNESCAPE_MD_RE  = /\\([!"#$%&'()*+,\-.\/:;<=>?@[\\\]^_`{|}~])/g;
var ENTITY_RE       = /&([a-z#][a-z0-9]{1,31});/gi;
var UNESCAPE_ALL_RE = new RegExp(UNESCAPE_MD_RE.source + '|' + ENTITY_RE.source, 'gi');

var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;

var entities = require('./entities');

function replaceEntityPattern(match, name) {
  var code = 0;

  if (has(entities, name)) {
    return entities[name];
  }

  if (name.charCodeAt(0) === 0x23/* # */ && DIGITAL_ENTITY_TEST_RE.test(name)) {
    code = name[1].toLowerCase() === 'x' ?
      parseInt(name.slice(2), 16)
    :
      parseInt(name.slice(1), 10);
    if (isValidEntityCode(code)) {
      return fromCodePoint(code);
    }
  }

  return match;
}

/*function replaceEntities(str) {
  if (str.indexOf('&') < 0) { return str; }

  return str.replace(ENTITY_RE, replaceEntityPattern);
}*/

function unescapeMd(str) {
  if (str.indexOf('\\') < 0) { return str; }
  return str.replace(UNESCAPE_MD_RE, '$1');
}

function unescapeAll(str) {
  if (str.indexOf('\\') < 0 && str.indexOf('&') < 0) { return str; }

  return str.replace(UNESCAPE_ALL_RE, function(match, escaped, entity) {
    if (escaped) { return escaped; }
    return replaceEntityPattern(match, entity);
  });
}

////////////////////////////////////////////////////////////////////////////////

var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}

function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) {
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  }
  return str;
}

////////////////////////////////////////////////////////////////////////////////

var REGEXP_ESCAPE_RE = /[.?*+^$[\]\\(){}|-]/g;

function escapeRE (str) {
  return str.replace(REGEXP_ESCAPE_RE, '\\$&');
}

////////////////////////////////////////////////////////////////////////////////

// Zs (unicode class) || [\t\f\v\r\n]
function isWhiteSpace(code) {
  if (code >= 0x2000 && code <= 0x200A) { return true; }
  switch (code) {
    case 0x09: // \t
    case 0x0A: // \n
    case 0x0B: // \v
    case 0x0C: // \f
    case 0x0D: // \r
    case 0x20:
    case 0xA0:
    case 0x1680:
    case 0x202F:
    case 0x205F:
    case 0x3000:
      return true;
  }
  return false;
}

////////////////////////////////////////////////////////////////////////////////

/*eslint-disable max-len*/
var UNICODE_PUNCT_RE = require('uc.micro/categories/P/regex');

// Currently without astral characters support.
function isPunctChar(char) {
  return UNICODE_PUNCT_RE.test(char);
}


// Markdown ASCII punctuation characters.
//
// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
//
// Don't confuse with unicode punctuation !!! It lacks some chars in ascii range.
//
function isMdAsciiPunct(ch) {
  switch (ch) {
    case 0x21/* ! */:
    case 0x22/* " */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x27/* ' */:
    case 0x28/* ( */:
    case 0x29/* ) */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2C/* , */:
    case 0x2D/* - */:
    case 0x2E/* . */:
    case 0x2F/* / */:
    case 0x3A/* : */:
    case 0x3B/* ; */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x3F/* ? */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7C/* | */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true;
    default:
      return false;
  }
}

// Hepler to unify [reference labels].
//
function normalizeReference(str) {
  // use .toUpperCase() instead of .toLowerCase()
  // here to avoid a conflict with Object.prototype
  // members (most notably, `__proto__`)
  return str.trim().replace(/\s+/g, ' ').toUpperCase();
}

////////////////////////////////////////////////////////////////////////////////

// Re-export libraries commonly used in both markdown-it and its plugins,
// so plugins won't have to depend on them explicitly, which reduces their
// bundled size (e.g. a browser build).
//
exports.lib                 = {};
exports.lib.mdurl           = require('mdurl');
exports.lib.ucmicro         = require('uc.micro');

exports.assign              = assign;
exports.isString            = isString;
exports.has                 = has;
exports.unescapeMd          = unescapeMd;
exports.unescapeAll         = unescapeAll;
exports.isValidEntityCode   = isValidEntityCode;
exports.fromCodePoint       = fromCodePoint;
// exports.replaceEntities     = replaceEntities;
exports.escapeHtml          = escapeHtml;
exports.arrayReplaceAt      = arrayReplaceAt;
exports.isWhiteSpace        = isWhiteSpace;
exports.isMdAsciiPunct      = isMdAsciiPunct;
exports.isPunctChar         = isPunctChar;
exports.escapeRE            = escapeRE;
exports.normalizeReference  = normalizeReference;

},{"./entities":33,"mdurl":89,"uc.micro":95,"uc.micro/categories/P/regex":93}],38:[function(require,module,exports){
// Just a shortcut for bulk export
'use strict';


exports.parseLinkLabel       = require('./parse_link_label');
exports.parseLinkDestination = require('./parse_link_destination');
exports.parseLinkTitle       = require('./parse_link_title');

},{"./parse_link_destination":39,"./parse_link_label":40,"./parse_link_title":41}],39:[function(require,module,exports){
// Parse link destination
//
'use strict';


var unescapeAll   = require('../common/utils').unescapeAll;


module.exports = function parseLinkDestination(str, pos, max) {
  var code, level,
      lines = 0,
      start = pos,
      result = {
        ok: false,
        pos: 0,
        lines: 0,
        str: ''
      };

  if (str.charCodeAt(pos) === 0x3C /* < */) {
    pos++;
    while (pos < max) {
      code = str.charCodeAt(pos);
      if (code === 0x0A /* \n */) { return result; }
      if (code === 0x3E /* > */) {
        result.pos = pos + 1;
        result.str = unescapeAll(str.slice(start + 1, pos));
        result.ok = true;
        return result;
      }
      if (code === 0x5C /* \ */ && pos + 1 < max) {
        pos += 2;
        continue;
      }

      pos++;
    }

    // no closing '>'
    return result;
  }

  // this should be ... } else { ... branch

  level = 0;
  while (pos < max) {
    code = str.charCodeAt(pos);

    if (code === 0x20) { break; }

    // ascii control characters
    if (code < 0x20 || code === 0x7F) { break; }

    if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos += 2;
      continue;
    }

    if (code === 0x28 /* ( */) {
      level++;
      if (level > 1) { break; }
    }

    if (code === 0x29 /* ) */) {
      level--;
      if (level < 0) { break; }
    }

    pos++;
  }

  if (start === pos) { return result; }

  result.str = unescapeAll(str.slice(start, pos));
  result.lines = lines;
  result.pos = pos;
  result.ok = true;
  return result;
};

},{"../common/utils":37}],40:[function(require,module,exports){
// Parse link label
//
// this function assumes that first character ("[") already matches;
// returns the end of the label
//
'use strict';

module.exports = function parseLinkLabel(state, start, disableNested) {
  var level, found, marker, prevPos,
      labelEnd = -1,
      max = state.posMax,
      oldPos = state.pos;

  state.pos = start + 1;
  level = 1;

  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 0x5D /* ] */) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }

    prevPos = state.pos;
    state.md.inline.skipToken(state);
    if (marker === 0x5B /* [ */) {
      if (prevPos === state.pos - 1) {
        // increase level if we find text `[`, which is not a part of any token
        level++;
      } else if (disableNested) {
        state.pos = oldPos;
        return -1;
      }
    }
  }

  if (found) {
    labelEnd = state.pos;
  }

  // restore old state
  state.pos = oldPos;

  return labelEnd;
};

},{}],41:[function(require,module,exports){
// Parse link title
//
'use strict';


var unescapeAll = require('../common/utils').unescapeAll;


module.exports = function parseLinkTitle(str, pos, max) {
  var code,
      marker,
      lines = 0,
      start = pos,
      result = {
        ok: false,
        pos: 0,
        lines: 0,
        str: ''
      };

  if (pos >= max) { return result; }

  marker = str.charCodeAt(pos);

  if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { return result; }

  pos++;

  // if opening marker is "(", switch it to closing marker ")"
  if (marker === 0x28) { marker = 0x29; }

  while (pos < max) {
    code = str.charCodeAt(pos);
    if (code === marker) {
      result.pos = pos + 1;
      result.lines = lines;
      result.str = unescapeAll(str.slice(start + 1, pos));
      result.ok = true;
      return result;
    } else if (code === 0x0A) {
      lines++;
    } else if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos++;
      if (str.charCodeAt(pos) === 0x0A) {
        lines++;
      }
    }

    pos++;
  }

  return result;
};

},{"../common/utils":37}],42:[function(require,module,exports){
// Main perser class

'use strict';


var utils        = require('./common/utils');
var helpers      = require('./helpers');
var Renderer     = require('./renderer');
var ParserCore   = require('./parser_core');
var ParserBlock  = require('./parser_block');
var ParserInline = require('./parser_inline');
var LinkifyIt    = require('linkify-it');
var mdurl        = require('mdurl');
var punycode     = require('punycode');


var config = {
  'default': require('./presets/default'),
  zero: require('./presets/zero'),
  commonmark: require('./presets/commonmark')
};

////////////////////////////////////////////////////////////////////////////////
//
// This validator can prohibit more than really needed to prevent XSS. It's a
// tradeoff to keep code simple and to be secure by default.
//
// If you need different setup - override validator method as you wish. Or
// replace it with dummy function and use external sanitizer.
//

var BAD_PROTO_RE = /^(vbscript|javascript|file|data):/;
var GOOD_DATA_RE = /^data:image\/(gif|png|jpeg|webp);/;

function validateLink(url) {
  // url should be normalized at this point, and existing entities are decoded
  var str = url.trim().toLowerCase();

  return BAD_PROTO_RE.test(str) ? (GOOD_DATA_RE.test(str) ? true : false) : true;
}

////////////////////////////////////////////////////////////////////////////////


var RECODE_HOSTNAME_FOR = [ 'http:', 'https:', 'mailto:' ];

function normalizeLink(url) {
  var parsed = mdurl.parse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toASCII(parsed.hostname);
      } catch(er) {}
    }
  }

  return mdurl.encode(mdurl.format(parsed));
}

function normalizeLinkText(url) {
  var parsed = mdurl.parse(url, true);

  if (parsed.hostname) {
    // Encode hostnames in urls like:
    // `http://host/`, `https://host/`, `mailto:user@host`, `//host/`
    //
    // We don't encode unknown schemas, because it's likely that we encode
    // something we shouldn't (e.g. `skype:name` treated as `skype:host`)
    //
    if (!parsed.protocol || RECODE_HOSTNAME_FOR.indexOf(parsed.protocol) >= 0) {
      try {
        parsed.hostname = punycode.toUnicode(parsed.hostname);
      } catch(er) {}
    }
  }

  return mdurl.decode(mdurl.format(parsed));
}


/**
 * class MarkdownIt
 *
 * Main parser/renderer class.
 *
 * ##### Usage
 *
 * ```javascript
 * // node.js, "classic" way:
 * var MarkdownIt = require('markdown-it'),
 *     md = new MarkdownIt();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // node.js, the same, but with sugar:
 * var md = require('markdown-it')();
 * var result = md.render('# markdown-it rulezz!');
 *
 * // browser without AMD, added to "window" on script load
 * // Note, there are no dash.
 * var md = window.markdownit();
 * var result = md.render('# markdown-it rulezz!');
 * ```
 *
 * Single line rendering, without paragraph wrap:
 *
 * ```javascript
 * var md = require('markdown-it')();
 * var result = md.renderInline('__markdown-it__ rulezz!');
 * ```
 **/

/**
 * new MarkdownIt([presetName, options])
 * - presetName (String): optional, `commonmark` / `zero`
 * - options (Object)
 *
 * Creates parser instanse with given config. Can be called without `new`.
 *
 * ##### presetName
 *
 * MarkdownIt provides named presets as a convenience to quickly
 * enable/disable active syntax rules and options for common use cases.
 *
 * - ["commonmark"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/commonmark.js) -
 *   configures parser to strict [CommonMark](http://commonmark.org/) mode.
 * - [default](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/default.js) -
 *   similar to GFM, used when no preset name given. Enables all available rules,
 *   but still without html, typographer & autolinker.
 * - ["zero"](https://github.com/markdown-it/markdown-it/blob/master/lib/presets/zero.js) -
 *   all rules disabled. Useful to quickly setup your config via `.enable()`.
 *   For example, when you need only `bold` and `italic` markup and nothing else.
 *
 * ##### options:
 *
 * - __html__ - `false`. Set `true` to enable HTML tags in source. Be careful!
 *   That's not safe! You may need external sanitizer to protect output from XSS.
 *   It's better to extend features via plugins, instead of enabling HTML.
 * - __xhtmlOut__ - `false`. Set `true` to add '/' when closing single tags
 *   (`<br />`). This is needed only for full CommonMark compatibility. In real
 *   world you will need HTML output.
 * - __breaks__ - `false`. Set `true` to convert `\n` in paragraphs into `<br>`.
 * - __langPrefix__ - `language-`. CSS language class prefix for fenced blocks.
 *   Can be useful for external highlighters.
 * - __linkify__ - `false`. Set `true` to autoconvert URL-like text to links.
 * - __typographer__  - `false`. Set `true` to enable [some language-neutral
 *   replacement](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/replacements.js) +
 *   quotes beautification (smartquotes).
 * - __quotes__ - `“”‘’`, String or Array. Double + single quotes replacement
 *   pairs, when typographer enabled and smartquotes on. For example, you can
 *   use `'«»„“'` for Russian, `'„“‚‘'` for German, and
 *   `['«\xA0', '\xA0»', '‹\xA0', '\xA0›']` for French (including nbsp).
 * - __highlight__ - `null`. Highlighter function for fenced code blocks.
 *   Highlighter `function (str, lang)` should return escaped HTML. It can also
 *   return empty string if the source was not changed and should be escaped externaly.
 *
 * ##### Example
 *
 * ```javascript
 * // commonmark mode
 * var md = require('markdown-it')('commonmark');
 *
 * // default mode
 * var md = require('markdown-it')();
 *
 * // enable everything
 * var md = require('markdown-it')({
 *   html: true,
 *   linkify: true,
 *   typographer: true
 * });
 * ```
 *
 * ##### Syntax highlighting
 *
 * ```js
 * var hljs = require('highlight.js') // https://highlightjs.org/
 *
 * var md = require('markdown-it')({
 *   highlight: function (str, lang) {
 *     if (lang && hljs.getLanguage(lang)) {
 *       try {
 *         return hljs.highlight(lang, str).value;
 *       } catch (__) {}
 *     }
 *
 *     try {
 *       return hljs.highlightAuto(str).value;
 *     } catch (__) {}
 *
 *     return ''; // use external default escaping
 *   }
 * });
 * ```
 **/
function MarkdownIt(presetName, options) {
  if (!(this instanceof MarkdownIt)) {
    return new MarkdownIt(presetName, options);
  }

  if (!options) {
    if (!utils.isString(presetName)) {
      options = presetName || {};
      presetName = 'default';
    }
  }

  /**
   * MarkdownIt#inline -> ParserInline
   *
   * Instance of [[ParserInline]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.inline = new ParserInline();

  /**
   * MarkdownIt#block -> ParserBlock
   *
   * Instance of [[ParserBlock]]. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.block = new ParserBlock();

  /**
   * MarkdownIt#core -> Core
   *
   * Instance of [[Core]] chain executor. You may need it to add new rules when
   * writing plugins. For simple rules control use [[MarkdownIt.disable]] and
   * [[MarkdownIt.enable]].
   **/
  this.core = new ParserCore();

  /**
   * MarkdownIt#renderer -> Renderer
   *
   * Instance of [[Renderer]]. Use it to modify output look. Or to add rendering
   * rules for new token types, generated by plugins.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * function myToken(tokens, idx, options, env, self) {
   *   //...
   *   return result;
   * };
   *
   * md.renderer.rules['my_token'] = myToken
   * ```
   *
   * See [[Renderer]] docs and [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js).
   **/
  this.renderer = new Renderer();

  /**
   * MarkdownIt#linkify -> LinkifyIt
   *
   * [linkify-it](https://github.com/markdown-it/linkify-it) instance.
   * Used by [linkify](https://github.com/markdown-it/markdown-it/blob/master/lib/rules_core/linkify.js)
   * rule.
   **/
  this.linkify = new LinkifyIt();

  /**
   * MarkdownIt#validateLink(url) -> Boolean
   *
   * Link validation function. CommonMark allows too much in links. By default
   * we disable `javascript:`, `vbscript:`, `file:` schemas, and almost all `data:...` schemas
   * except some embedded image types.
   *
   * You can change this behaviour:
   *
   * ```javascript
   * var md = require('markdown-it')();
   * // enable everything
   * md.validateLink = function () { return true; }
   * ```
   **/
  this.validateLink = validateLink;

  /**
   * MarkdownIt#normalizeLink(url) -> String
   *
   * Function used to encode link url to a machine-readable format,
   * which includes url-encoding, punycode, etc.
   **/
  this.normalizeLink = normalizeLink;

  /**
   * MarkdownIt#normalizeLinkText(url) -> String
   *
   * Function used to decode link url to a human-readable format`
   **/
  this.normalizeLinkText = normalizeLinkText;


  // Expose utils & helpers for easy acces from plugins

  /**
   * MarkdownIt#utils -> utils
   *
   * Assorted utility functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/common/utils.js).
   **/
  this.utils = utils;

  /**
   * MarkdownIt#helpers -> helpers
   *
   * Link components parser functions, useful to write plugins. See details
   * [here](https://github.com/markdown-it/markdown-it/blob/master/lib/helpers).
   **/
  this.helpers = helpers;


  this.options = {};
  this.configure(presetName);

  if (options) { this.set(options); }
}


/** chainable
 * MarkdownIt.set(options)
 *
 * Set parser options (in the same format as in constructor). Probably, you
 * will never need it, but you can change options after constructor call.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .set({ html: true, breaks: true })
 *             .set({ typographer, true });
 * ```
 *
 * __Note:__ To achieve the best possible performance, don't modify a
 * `markdown-it` instance options on the fly. If you need multiple configurations
 * it's best to create multiple instances and initialize each with separate
 * config.
 **/
MarkdownIt.prototype.set = function (options) {
  utils.assign(this.options, options);
  return this;
};


/** chainable, internal
 * MarkdownIt.configure(presets)
 *
 * Batch load of all options and compenent settings. This is internal method,
 * and you probably will not need it. But if you with - see available presets
 * and data structure [here](https://github.com/markdown-it/markdown-it/tree/master/lib/presets)
 *
 * We strongly recommend to use presets instead of direct config loads. That
 * will give better compatibility with next versions.
 **/
MarkdownIt.prototype.configure = function (presets) {
  var self = this, presetName;

  if (utils.isString(presets)) {
    presetName = presets;
    presets = config[presetName];
    if (!presets) { throw new Error('Wrong `markdown-it` preset "' + presetName + '", check name'); }
  }

  if (!presets) { throw new Error('Wrong `markdown-it` preset, can\'t be empty'); }

  if (presets.options) { self.set(presets.options); }

  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enableOnly(presets.components[name].rules);
      }
    });
  }
  return this;
};


/** chainable
 * MarkdownIt.enable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to enable
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable list or rules. It will automatically find appropriate components,
 * containing rules with given names. If rule not found, and `ignoreInvalid`
 * not set - throws exception.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')()
 *             .enable(['sub', 'sup'])
 *             .disable('smartquotes');
 * ```
 **/
MarkdownIt.prototype.enable = function (list, ignoreInvalid) {
  var result = [];

  if (!Array.isArray(list)) { list = [ list ]; }

  [ 'core', 'block', 'inline' ].forEach(function (chain) {
    result = result.concat(this[chain].ruler.enable(list, true));
  }, this);

  var missed = list.filter(function (name) { return result.indexOf(name) < 0; });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to enable unknown rule(s): ' + missed);
  }

  return this;
};


/** chainable
 * MarkdownIt.disable(list, ignoreInvalid)
 * - list (String|Array): rule name or list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * The same as [[MarkdownIt.enable]], but turn specified rules off.
 **/
MarkdownIt.prototype.disable = function (list, ignoreInvalid) {
  var result = [];

  if (!Array.isArray(list)) { list = [ list ]; }

  [ 'core', 'block', 'inline' ].forEach(function (chain) {
    result = result.concat(this[chain].ruler.disable(list, true));
  }, this);

  var missed = list.filter(function (name) { return result.indexOf(name) < 0; });

  if (missed.length && !ignoreInvalid) {
    throw new Error('MarkdownIt. Failed to disable unknown rule(s): ' + missed);
  }
  return this;
};


/** chainable
 * MarkdownIt.use(plugin, params)
 *
 * Load specified plugin with given params into current parser instance.
 * It's just a sugar to call `plugin(md, params)` with curring.
 *
 * ##### Example
 *
 * ```javascript
 * var iterator = require('markdown-it-for-inline');
 * var md = require('markdown-it')()
 *             .use(iterator, 'foo_replace', 'text', function (tokens, idx) {
 *               tokens[idx].content = tokens[idx].content.replace(/foo/g, 'bar');
 *             });
 * ```
 **/
MarkdownIt.prototype.use = function (plugin /*, params, ... */) {
  var args = [ this ].concat(Array.prototype.slice.call(arguments, 1));
  plugin.apply(plugin, args);
  return this;
};


/** internal
 * MarkdownIt.parse(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Parse input string and returns list of block tokens (special token type
 * "inline" will contain list of inline tokens). You should not call this
 * method directly, until you write custom renderer (for example, to produce
 * AST).
 *
 * `env` is used to pass data between "distributed" rules and return additional
 * metadata like reference info, needed for for renderer. It also can be used to
 * inject data in specific cases. Usually, you will be ok to pass `{}`,
 * and then pass updated object to renderer.
 **/
MarkdownIt.prototype.parse = function (src, env) {
  var state = new this.core.State(src, this, env);

  this.core.process(state);

  return state.tokens;
};


/**
 * MarkdownIt.render(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Render markdown string into html. It does all magic for you :).
 *
 * `env` can be used to inject additional metadata (`{}` by default).
 * But you will not need it with high probability. See also comment
 * in [[MarkdownIt.parse]].
 **/
MarkdownIt.prototype.render = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parse(src, env), this.options, env);
};


/** internal
 * MarkdownIt.parseInline(src, env) -> Array
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * The same as [[MarkdownIt.parse]] but skip all block rules. It returns the
 * block tokens list with the single `inline` element, containing parsed inline
 * tokens in `children` property. Also updates `env` object.
 **/
MarkdownIt.prototype.parseInline = function (src, env) {
  var state = new this.core.State(src, this, env);

  state.inlineMode = true;
  this.core.process(state);

  return state.tokens;
};


/**
 * MarkdownIt.renderInline(src [, env]) -> String
 * - src (String): source string
 * - env (Object): environment sandbox
 *
 * Similar to [[MarkdownIt.render]] but for single paragraph content. Result
 * will NOT be wrapped into `<p>` tags.
 **/
MarkdownIt.prototype.renderInline = function (src, env) {
  env = env || {};

  return this.renderer.render(this.parseInline(src, env), this.options, env);
};


module.exports = MarkdownIt;

},{"./common/utils":37,"./helpers":38,"./parser_block":43,"./parser_core":44,"./parser_inline":45,"./presets/commonmark":46,"./presets/default":47,"./presets/zero":48,"./renderer":49,"linkify-it":84,"mdurl":89,"punycode":4}],43:[function(require,module,exports){
/** internal
 * class ParserBlock
 *
 * Block-level tokenizer.
 **/
'use strict';


var Ruler           = require('./ruler');


var _rules = [
  // First 2 params - rule name & source. Secondary array - list of rules,
  // which can be terminated by this one.
  [ 'code',       require('./rules_block/code') ],
  [ 'fence',      require('./rules_block/fence'),      [ 'paragraph', 'reference', 'blockquote', 'list' ] ],
  [ 'blockquote', require('./rules_block/blockquote'), [ 'paragraph', 'reference', 'list' ] ],
  [ 'hr',         require('./rules_block/hr'),         [ 'paragraph', 'reference', 'blockquote', 'list' ] ],
  [ 'list',       require('./rules_block/list'),       [ 'paragraph', 'reference', 'blockquote' ] ],
  [ 'reference',  require('./rules_block/reference') ],
  [ 'heading',    require('./rules_block/heading'),    [ 'paragraph', 'reference', 'blockquote' ] ],
  [ 'lheading',   require('./rules_block/lheading') ],
  [ 'html_block', require('./rules_block/html_block'), [ 'paragraph', 'reference', 'blockquote' ] ],
  [ 'table',      require('./rules_block/table'),      [ 'paragraph', 'reference' ] ],
  [ 'paragraph',  require('./rules_block/paragraph') ]
];


/**
 * new ParserBlock()
 **/
function ParserBlock() {
  /**
   * ParserBlock#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of block rules.
   **/
  this.ruler = new Ruler();

  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1], { alt: (_rules[i][2] || []).slice() });
  }
}


// Generate tokens for input range
//
ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
  var ok, i,
      rules = this.ruler.getRules(''),
      len = rules.length,
      line = startLine,
      hasEmptyLines = false,
      maxNesting = state.md.options.maxNesting;

  while (line < endLine) {
    state.line = line = state.skipEmptyLines(line);
    if (line >= endLine) { break; }

    // Termination condition for nested calls.
    // Nested calls currently used for blockquotes & lists
    if (state.tShift[line] < state.blkIndent) { break; }

    // If nesting level exceeded - skip tail to the end. That's not ordinary
    // situation and we should not care about content.
    if (state.level >= maxNesting) {
      state.line = endLine;
      break;
    }

    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.line`
    // - update `state.tokens`
    // - return true

    for (i = 0; i < len; i++) {
      ok = rules[i](state, line, endLine, false);
      if (ok) { break; }
    }

    // set state.tight iff we had an empty line before current tag
    // i.e. latest empty line should not count
    state.tight = !hasEmptyLines;

    // paragraph might "eat" one newline after it in nested lists
    if (state.isEmpty(state.line - 1)) {
      hasEmptyLines = true;
    }

    line = state.line;

    if (line < endLine && state.isEmpty(line)) {
      hasEmptyLines = true;
      line++;

      // two empty lines should stop the parser in list mode
      if (line < endLine && state.parentType === 'list' && state.isEmpty(line)) { break; }
      state.line = line;
    }
  }
};


/**
 * ParserBlock.parse(str, md, env, outTokens)
 *
 * Process input string and push block tokens into `outTokens`
 **/
ParserBlock.prototype.parse = function (src, md, env, outTokens) {
  var state;

  if (!src) { return []; }

  state = new this.State(src, md, env, outTokens);

  this.tokenize(state, state.line, state.lineMax);
};


ParserBlock.prototype.State = require('./rules_block/state_block');


module.exports = ParserBlock;

},{"./ruler":50,"./rules_block/blockquote":51,"./rules_block/code":52,"./rules_block/fence":53,"./rules_block/heading":54,"./rules_block/hr":55,"./rules_block/html_block":56,"./rules_block/lheading":57,"./rules_block/list":58,"./rules_block/paragraph":59,"./rules_block/reference":60,"./rules_block/state_block":61,"./rules_block/table":62}],44:[function(require,module,exports){
/** internal
 * class Core
 *
 * Top-level rules executor. Glues block/inline parsers and does intermediate
 * transformations.
 **/
'use strict';


var Ruler  = require('./ruler');


var _rules = [
  [ 'normalize',      require('./rules_core/normalize')      ],
  [ 'block',          require('./rules_core/block')          ],
  [ 'inline',         require('./rules_core/inline')         ],
  [ 'linkify',        require('./rules_core/linkify')        ],
  [ 'replacements',   require('./rules_core/replacements')   ],
  [ 'smartquotes',    require('./rules_core/smartquotes')    ]
];


/**
 * new Core()
 **/
function Core() {
  /**
   * Core#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of core rules.
   **/
  this.ruler = new Ruler();

  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }
}


/**
 * Core.process(state)
 *
 * Executes core chain rules.
 **/
Core.prototype.process = function (state) {
  var i, l, rules;

  rules = this.ruler.getRules('');

  for (i = 0, l = rules.length; i < l; i++) {
    rules[i](state);
  }
};

Core.prototype.State = require('./rules_core/state_core');


module.exports = Core;

},{"./ruler":50,"./rules_core/block":63,"./rules_core/inline":64,"./rules_core/linkify":65,"./rules_core/normalize":66,"./rules_core/replacements":67,"./rules_core/smartquotes":68,"./rules_core/state_core":69}],45:[function(require,module,exports){
/** internal
 * class ParserInline
 *
 * Tokenizes paragraph content.
 **/
'use strict';


var Ruler           = require('./ruler');


////////////////////////////////////////////////////////////////////////////////
// Parser rules

var _rules = [
  [ 'text',            require('./rules_inline/text') ],
  [ 'newline',         require('./rules_inline/newline') ],
  [ 'escape',          require('./rules_inline/escape') ],
  [ 'backticks',       require('./rules_inline/backticks') ],
  [ 'strikethrough',   require('./rules_inline/strikethrough') ],
  [ 'emphasis',        require('./rules_inline/emphasis') ],
  [ 'link',            require('./rules_inline/link') ],
  [ 'image',           require('./rules_inline/image') ],
  [ 'autolink',        require('./rules_inline/autolink') ],
  [ 'html_inline',     require('./rules_inline/html_inline') ],
  [ 'entity',          require('./rules_inline/entity') ]
];


/**
 * new ParserInline()
 **/
function ParserInline() {
  /**
   * ParserInline#ruler -> Ruler
   *
   * [[Ruler]] instance. Keep configuration of inline rules.
   **/
  this.ruler = new Ruler();

  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }
}


// Skip single token by running all rules in validation mode;
// returns `true` if any rule reported success
//
ParserInline.prototype.skipToken = function (state) {
  var i, pos = state.pos,
      rules = this.ruler.getRules(''),
      len = rules.length,
      maxNesting = state.md.options.maxNesting,
      cache = state.cache;


  if (typeof cache[pos] !== 'undefined') {
    state.pos = cache[pos];
    return;
  }

  /*istanbul ignore else*/
  if (state.level < maxNesting) {
    for (i = 0; i < len; i++) {
      if (rules[i](state, true)) {
        cache[pos] = state.pos;
        return;
      }
    }
  }

  state.pos++;
  cache[pos] = state.pos;
};


// Generate tokens for input range
//
ParserInline.prototype.tokenize = function (state) {
  var ok, i,
      rules = this.ruler.getRules(''),
      len = rules.length,
      end = state.posMax,
      maxNesting = state.md.options.maxNesting;

  while (state.pos < end) {
    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.pos`
    // - update `state.tokens`
    // - return true

    if (state.level < maxNesting) {
      for (i = 0; i < len; i++) {
        ok = rules[i](state, false);
        if (ok) { break; }
      }
    }

    if (ok) {
      if (state.pos >= end) { break; }
      continue;
    }

    state.pending += state.src[state.pos++];
  }

  if (state.pending) {
    state.pushPending();
  }
};


/**
 * ParserInline.parse(str, md, env, outTokens)
 *
 * Process input string and push inline tokens into `outTokens`
 **/
ParserInline.prototype.parse = function (str, md, env, outTokens) {
  var state = new this.State(str, md, env, outTokens);

  this.tokenize(state);
};


ParserInline.prototype.State = require('./rules_inline/state_inline');


module.exports = ParserInline;

},{"./ruler":50,"./rules_inline/autolink":70,"./rules_inline/backticks":71,"./rules_inline/emphasis":72,"./rules_inline/entity":73,"./rules_inline/escape":74,"./rules_inline/html_inline":75,"./rules_inline/image":76,"./rules_inline/link":77,"./rules_inline/newline":78,"./rules_inline/state_inline":79,"./rules_inline/strikethrough":80,"./rules_inline/text":81}],46:[function(require,module,exports){
// Commonmark default options

'use strict';


module.exports = {
  options: {
    html:         true,         // Enable HTML tags in source
    xhtmlOut:     true,         // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      false,        // autoconvert URL-like texts to links

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019' /* “”‘’ */,

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline'
      ]
    },

    block: {
      rules: [
        'blockquote',
        'code',
        'fence',
        'heading',
        'hr',
        'html_block',
        'lheading',
        'list',
        'reference',
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'autolink',
        'backticks',
        'emphasis',
        'entity',
        'escape',
        'html_inline',
        'image',
        'link',
        'newline',
        'text'
      ]
    }
  }
};

},{}],47:[function(require,module,exports){
// markdown-it default options

'use strict';


module.exports = {
  options: {
    html:         false,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      false,        // autoconvert URL-like texts to links

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019' /* “”‘’ */,

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {},
    block: {},
    inline: {}
  }
};

},{}],48:[function(require,module,exports){
// "Zero" preset, with nothing enabled. Useful for manual configuring of simple
// modes. For example, to parse bold/italic only.

'use strict';


module.exports = {
  options: {
    html:         false,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkify:      false,        // autoconvert URL-like texts to links

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Could be either a String or an Array.
    //
    // For example, you can use '«»„“' for Russian, '„“‚‘' for German,
    // and ['«\xA0', '\xA0»', '‹\xA0', '\xA0›'] for French (including nbsp).
    quotes: '\u201c\u201d\u2018\u2019' /* “”‘’ */,

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {
      rules: [
        'normalize',
        'block',
        'inline'
      ]
    },

    block: {
      rules: [
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'text'
      ]
    }
  }
};

},{}],49:[function(require,module,exports){
/**
 * class Renderer
 *
 * Generates HTML from parsed token stream. Each instance has independent
 * copy of rules. Those can be rewritten with ease. Also, you can add new
 * rules if you create plugin and adds new token types.
 **/
'use strict';


var assign          = require('./common/utils').assign;
var unescapeAll     = require('./common/utils').unescapeAll;
var escapeHtml      = require('./common/utils').escapeHtml;


////////////////////////////////////////////////////////////////////////////////

var default_rules = {};


default_rules.code_inline = function (tokens, idx /*, options, env */) {
  return '<code>' + escapeHtml(tokens[idx].content) + '</code>';
};


default_rules.code_block = function (tokens, idx /*, options, env */) {
  return '<pre><code>' + escapeHtml(tokens[idx].content) + '</code></pre>\n';
};


default_rules.fence = function (tokens, idx, options, env, self) {
  var token = tokens[idx],
      info = token.info ? unescapeAll(token.info).trim() : '',
      langName = '',
      highlighted;

  if (info) {
    langName = info.split(/\s+/g)[0];
    token.attrPush([ 'class', options.langPrefix + langName ]);
  }

  if (options.highlight) {
    highlighted = options.highlight(token.content, langName) || escapeHtml(token.content);
  } else {
    highlighted = escapeHtml(token.content);
  }

  return  '<pre><code' + self.renderAttrs(token) + '>'
        + highlighted
        + '</code></pre>\n';
};


default_rules.image = function (tokens, idx, options, env, self) {
  var token = tokens[idx];

  // "alt" attr MUST be set, even if empty. Because it's mandatory and
  // should be placed on proper position for tests.
  //
  // Replace content with actual value

  token.attrs[token.attrIndex('alt')][1] =
    self.renderInlineAsText(token.children, options, env);

  return self.renderToken(tokens, idx, options);
};


default_rules.hardbreak = function (tokens, idx, options /*, env */) {
  return options.xhtmlOut ? '<br />\n' : '<br>\n';
};
default_rules.softbreak = function (tokens, idx, options /*, env */) {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n';
};


default_rules.text = function (tokens, idx /*, options, env */) {
  return escapeHtml(tokens[idx].content);
};


default_rules.html_block = function (tokens, idx /*, options, env */) {
  return tokens[idx].content;
};
default_rules.html_inline = function (tokens, idx /*, options, env */) {
  return tokens[idx].content;
};


/**
 * new Renderer()
 *
 * Creates new [[Renderer]] instance and fill [[Renderer#rules]] with defaults.
 **/
function Renderer() {

  /**
   * Renderer#rules -> Object
   *
   * Contains render rules for tokens. Can be updated and extended.
   *
   * ##### Example
   *
   * ```javascript
   * var md = require('markdown-it')();
   *
   * md.renderer.rules.strong_open  = function () { return '<b>'; };
   * md.renderer.rules.strong_close = function () { return '</b>'; };
   *
   * var result = md.renderInline(...);
   * ```
   *
   * Each rule is called as independed static function with fixed signature:
   *
   * ```javascript
   * function my_token_render(tokens, idx, options, env, renderer) {
   *   // ...
   *   return renderedHTML;
   * }
   * ```
   *
   * See [source code](https://github.com/markdown-it/markdown-it/blob/master/lib/renderer.js)
   * for more details and examples.
   **/
  this.rules = assign({}, default_rules);
}


/**
 * Renderer.renderAttrs(token) -> String
 *
 * Render token attributes to string.
 **/
Renderer.prototype.renderAttrs = function renderAttrs(token) {
  var i, l, result;

  if (!token.attrs) { return ''; }

  result = '';

  for (i = 0, l = token.attrs.length; i < l; i++) {
    result += ' ' + escapeHtml(token.attrs[i][0]) + '="' + escapeHtml(token.attrs[i][1]) + '"';
  }

  return result;
};


/**
 * Renderer.renderToken(tokens, idx, options) -> String
 * - tokens (Array): list of tokens
 * - idx (Numbed): token index to render
 * - options (Object): params of parser instance
 *
 * Default token renderer. Can be overriden by custom function
 * in [[Renderer#rules]].
 **/
Renderer.prototype.renderToken = function renderToken(tokens, idx, options) {
  var nextToken,
      result = '',
      needLf = false,
      token = tokens[idx];

  // Tight list paragraphs
  if (token.hidden) {
    return '';
  }

  // Insert a newline between hidden paragraph and subsequent opening
  // block-level tag.
  //
  // For example, here we should insert a newline before blockquote:
  //  - a
  //    >
  //
  if (token.block && token.nesting !== -1 && idx && tokens[idx - 1].hidden) {
    result += '\n';
  }

  // Add token name, e.g. `<img`
  result += (token.nesting === -1 ? '</' : '<') + token.tag;

  // Encode attributes, e.g. `<img src="foo"`
  result += this.renderAttrs(token);

  // Add a slash for self-closing tags, e.g. `<img src="foo" /`
  if (token.nesting === 0 && options.xhtmlOut) {
    result += ' /';
  }

  // Check if we need to add a newline after this tag
  if (token.block) {
    needLf = true;

    if (token.nesting === 1) {
      if (idx + 1 < tokens.length) {
        nextToken = tokens[idx + 1];

        if (nextToken.type === 'inline' || nextToken.hidden) {
          // Block-level tag containing an inline tag.
          //
          needLf = false;

        } else if (nextToken.nesting === -1 && nextToken.tag === token.tag) {
          // Opening tag + closing tag of the same type. E.g. `<li></li>`.
          //
          needLf = false;
        }
      }
    }
  }

  result += needLf ? '>\n' : '>';

  return result;
};


/**
 * Renderer.renderInline(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to renter
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * The same as [[Renderer.render]], but for single token of `inline` type.
 **/
Renderer.prototype.renderInline = function (tokens, options, env) {
  var type,
      result = '',
      rules = this.rules;

  for (var i = 0, len = tokens.length; i < len; i++) {
    type = tokens[i].type;

    if (typeof rules[type] !== 'undefined') {
      result += rules[type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options);
    }
  }

  return result;
};


/** internal
 * Renderer.renderInlineAsText(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to renter
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Special kludge for image `alt` attributes to conform CommonMark spec.
 * Don't try to use it! Spec requires to show `alt` content with stripped markup,
 * instead of simple escaping.
 **/
Renderer.prototype.renderInlineAsText = function (tokens, options, env) {
  var result = '',
      rules = this.rules;

  for (var i = 0, len = tokens.length; i < len; i++) {
    if (tokens[i].type === 'text') {
      result += rules.text(tokens, i, options, env, this);
    } else if (tokens[i].type === 'image') {
      result += this.renderInlineAsText(tokens[i].children, options, env);
    }
  }

  return result;
};


/**
 * Renderer.render(tokens, options, env) -> String
 * - tokens (Array): list on block tokens to renter
 * - options (Object): params of parser instance
 * - env (Object): additional data from parsed input (references, for example)
 *
 * Takes token stream and generates HTML. Probably, you will never need to call
 * this method directly.
 **/
Renderer.prototype.render = function (tokens, options, env) {
  var i, len, type,
      result = '',
      rules = this.rules;

  for (i = 0, len = tokens.length; i < len; i++) {
    type = tokens[i].type;

    if (type === 'inline') {
      result += this.renderInline(tokens[i].children, options, env);
    } else if (typeof rules[type] !== 'undefined') {
      result += rules[tokens[i].type](tokens, i, options, env, this);
    } else {
      result += this.renderToken(tokens, i, options, env);
    }
  }

  return result;
};

module.exports = Renderer;

},{"./common/utils":37}],50:[function(require,module,exports){
/**
 * class Ruler
 *
 * Helper class, used by [[MarkdownIt#core]], [[MarkdownIt#block]] and
 * [[MarkdownIt#inline]] to manage sequences of functions (rules):
 *
 * - keep rules in defined order
 * - assign the name to each rule
 * - enable/disable rules
 * - add/replace rules
 * - allow assign rules to additional named chains (in the same)
 * - cacheing lists of active rules
 *
 * You will not need use this class directly until write plugins. For simple
 * rules control use [[MarkdownIt.disable]], [[MarkdownIt.enable]] and
 * [[MarkdownIt.use]].
 **/
'use strict';


/**
 * new Ruler()
 **/
function Ruler() {
  // List of added rules. Each element is:
  //
  // {
  //   name: XXX,
  //   enabled: Boolean,
  //   fn: Function(),
  //   alt: [ name2, name3 ]
  // }
  //
  this.__rules__ = [];

  // Cached rule chains.
  //
  // First level - chain name, '' for default.
  // Second level - diginal anchor for fast filtering by charcodes.
  //
  this.__cache__ = null;
}

////////////////////////////////////////////////////////////////////////////////
// Helper methods, should not be used directly


// Find rule index by name
//
Ruler.prototype.__find__ = function (name) {
  for (var i = 0; i < this.__rules__.length; i++) {
    if (this.__rules__[i].name === name) {
      return i;
    }
  }
  return -1;
};


// Build rules lookup cache
//
Ruler.prototype.__compile__ = function () {
  var self = this;
  var chains = [ '' ];

  // collect unique names
  self.__rules__.forEach(function (rule) {
    if (!rule.enabled) { return; }

    rule.alt.forEach(function (altName) {
      if (chains.indexOf(altName) < 0) {
        chains.push(altName);
      }
    });
  });

  self.__cache__ = {};

  chains.forEach(function (chain) {
    self.__cache__[chain] = [];
    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) { return; }

      if (chain && rule.alt.indexOf(chain) < 0) { return; }

      self.__cache__[chain].push(rule.fn);
    });
  });
};


/**
 * Ruler.at(name, fn [, options])
 * - name (String): rule name to replace.
 * - fn (Function): new rule function.
 * - options (Object): new rule options (not mandatory).
 *
 * Replace rule by name with new function & options. Throws error if name not
 * found.
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * Replace existing typorgapher replacement rule with new one:
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.at('replacements', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.at = function (name, fn, options) {
  var index = this.__find__(name);
  var opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + name); }

  this.__rules__[index].fn = fn;
  this.__rules__[index].alt = opt.alt || [];
  this.__cache__ = null;
};


/**
 * Ruler.before(beforeName, ruleName, fn [, options])
 * - beforeName (String): new rule will be added before this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain before one with given name. See also
 * [[Ruler.after]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.block.ruler.before('paragraph', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
  var index = this.__find__(beforeName);
  var opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + beforeName); }

  this.__rules__.splice(index, 0, {
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};


/**
 * Ruler.after(afterName, ruleName, fn [, options])
 * - afterName (String): new rule will be added after this one.
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Add new rule to chain after one with given name. See also
 * [[Ruler.before]], [[Ruler.push]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.inline.ruler.after('text', 'my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.after = function (afterName, ruleName, fn, options) {
  var index = this.__find__(afterName);
  var opt = options || {};

  if (index === -1) { throw new Error('Parser rule not found: ' + afterName); }

  this.__rules__.splice(index + 1, 0, {
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Ruler.push(ruleName, fn [, options])
 * - ruleName (String): name of added rule.
 * - fn (Function): rule function.
 * - options (Object): rule options (not mandatory).
 *
 * Push new rule to the end of chain. See also
 * [[Ruler.before]], [[Ruler.after]].
 *
 * ##### Options:
 *
 * - __alt__ - array with names of "alternate" chains.
 *
 * ##### Example
 *
 * ```javascript
 * var md = require('markdown-it')();
 *
 * md.core.ruler.push('my_rule', function replace(state) {
 *   //...
 * });
 * ```
 **/
Ruler.prototype.push = function (ruleName, fn, options) {
  var opt = options || {};

  this.__rules__.push({
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};


/**
 * Ruler.enable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to enable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.disable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.enable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [ list ]; }

  var result = [];

  // Search by name and enable
  list.forEach(function (name) {
    var idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return; }
      throw new Error('Rules manager: invalid rule name ' + name);
    }
    this.__rules__[idx].enabled = true;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result;
};


/**
 * Ruler.enableOnly(list [, ignoreInvalid])
 * - list (String|Array): list of rule names to enable (whitelist).
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Enable rules with given names, and disable everything else. If any rule name
 * not found - throw Error. Errors can be disabled by second param.
 *
 * See also [[Ruler.disable]], [[Ruler.enable]].
 **/
Ruler.prototype.enableOnly = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [ list ]; }

  this.__rules__.forEach(function (rule) { rule.enabled = false; });

  this.enable(list, ignoreInvalid);
};


/**
 * Ruler.disable(list [, ignoreInvalid]) -> Array
 * - list (String|Array): list of rule names to disable.
 * - ignoreInvalid (Boolean): set `true` to ignore errors when rule not found.
 *
 * Disable rules with given names. If any rule name not found - throw Error.
 * Errors can be disabled by second param.
 *
 * Returns list of found rule names (if no exception happened).
 *
 * See also [[Ruler.enable]], [[Ruler.enableOnly]].
 **/
Ruler.prototype.disable = function (list, ignoreInvalid) {
  if (!Array.isArray(list)) { list = [ list ]; }

  var result = [];

  // Search by name and disable
  list.forEach(function (name) {
    var idx = this.__find__(name);

    if (idx < 0) {
      if (ignoreInvalid) { return; }
      throw new Error('Rules manager: invalid rule name ' + name);
    }
    this.__rules__[idx].enabled = false;
    result.push(name);
  }, this);

  this.__cache__ = null;
  return result;
};


/**
 * Ruler.getRules(chainName) -> Array
 *
 * Return array of active functions (rules) for given chain name. It analyzes
 * rules configuration, compiles caches if not exists and returns result.
 *
 * Default chain name is `''` (empty string). It can't be skipped. That's
 * done intentionally, to keep signature monomorphic for high speed.
 **/
Ruler.prototype.getRules = function (chainName) {
  if (this.__cache__ === null) {
    this.__compile__();
  }

  // Chain can be empty, if rules disabled. But we still have to return Array.
  return this.__cache__[chainName] || [];
};

module.exports = Ruler;

},{}],51:[function(require,module,exports){
// Block quotes

'use strict';


module.exports = function blockquote(state, startLine, endLine, silent) {
  var nextLine, lastLineEmpty, oldTShift, oldBMarks, oldIndent, oldParentType, lines,
      terminatorRules, token,
      i, l, terminate,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  // check the block quote marker
  if (state.src.charCodeAt(pos++) !== 0x3E/* > */) { return false; }

  // we know that it's going to be a valid blockquote,
  // so no point trying to find the end of it in silent mode
  if (silent) { return true; }

  // skip one optional space after '>'
  if (state.src.charCodeAt(pos) === 0x20) { pos++; }

  oldIndent = state.blkIndent;
  state.blkIndent = 0;

  oldBMarks = [ state.bMarks[startLine] ];
  state.bMarks[startLine] = pos;

  // check if we have an empty blockquote
  pos = pos < max ? state.skipSpaces(pos) : pos;
  lastLineEmpty = pos >= max;

  oldTShift = [ state.tShift[startLine] ];
  state.tShift[startLine] = pos - state.bMarks[startLine];

  terminatorRules = state.md.block.ruler.getRules('blockquote');

  // Search the end of the block
  //
  // Block ends with either:
  //  1. an empty line outside:
  //     ```
  //     > test
  //
  //     ```
  //  2. an empty line inside:
  //     ```
  //     >
  //     test
  //     ```
  //  3. another tag
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
    if (state.tShift[nextLine] < oldIndent) { break; }

    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos >= max) {
      // Case 1: line is not inside the blockquote, and this line is empty.
      break;
    }

    if (state.src.charCodeAt(pos++) === 0x3E/* > */) {
      // This line is inside the blockquote.

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20) { pos++; }

      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;

      pos = pos < max ? state.skipSpaces(pos) : pos;
      lastLineEmpty = pos >= max;

      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }

    // Case 2: line is not inside the blockquote, and the last line was empty.
    if (lastLineEmpty) { break; }

    // Case 3: another tag found.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    oldBMarks.push(state.bMarks[nextLine]);
    oldTShift.push(state.tShift[nextLine]);

    // A negative number means that this is a paragraph continuation;
    //
    // Any negative number will do the job here, but it's better for it
    // to be large enough to make any bugs obvious.
    state.tShift[nextLine] = -1;
  }

  oldParentType = state.parentType;
  state.parentType = 'blockquote';

  token        = state.push('blockquote_open', 'blockquote', 1);
  token.markup = '>';
  token.map    = lines = [ startLine, 0 ];

  state.md.block.tokenize(state, startLine, nextLine);

  token        = state.push('blockquote_close', 'blockquote', -1);
  token.markup = '>';

  state.parentType = oldParentType;
  lines[1] = state.line;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
  }
  state.blkIndent = oldIndent;

  return true;
};

},{}],52:[function(require,module,exports){
// Code block (4 spaces padded)

'use strict';


module.exports = function code(state, startLine, endLine/*, silent*/) {
  var nextLine, last, token;

  if (state.tShift[startLine] - state.blkIndent < 4) { return false; }

  last = nextLine = startLine + 1;

  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }

  state.line = nextLine;

  token         = state.push('code_block', 'code', 0);
  token.content = state.getLines(startLine, last, 4 + state.blkIndent, true);
  token.map     = [ startLine, state.line ];

  return true;
};

},{}],53:[function(require,module,exports){
// fences (``` lang, ~~~ lang)

'use strict';


module.exports = function fence(state, startLine, endLine, silent) {
  var marker, len, params, nextLine, mem, token, markup,
      haveEndMarker = false,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (pos + 3 > max) { return false; }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
    return false;
  }

  // scan marker length
  mem = pos;
  pos = state.skipChars(pos, marker);

  len = pos - mem;

  if (len < 3) { return false; }

  markup = state.src.slice(mem, pos);
  params = state.src.slice(pos, max);

  if (params.indexOf('`') >= 0) { return false; }

  // Since start is found, we can report success here in validation mode
  if (silent) { return true; }

  // search end of block
  nextLine = startLine;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed block should be autoclosed by end of document.
      // also block seems to be autoclosed by end of parent
      break;
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.tShift[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break;
    }

    if (state.src.charCodeAt(pos) !== marker) { continue; }

    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue;
    }

    pos = state.skipChars(pos, marker);

    // closing code fence must be at least as long as the opening one
    if (pos - mem < len) { continue; }

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) { continue; }

    haveEndMarker = true;
    // found!
    break;
  }

  // If a fence has heading spaces, they should be removed from its inner block
  len = state.tShift[startLine];

  state.line = nextLine + (haveEndMarker ? 1 : 0);

  token         = state.push('fence', 'code', 0);
  token.info    = params;
  token.content = state.getLines(startLine + 1, nextLine, len, true);
  token.markup  = markup;
  token.map     = [ startLine, state.line ];

  return true;
};

},{}],54:[function(require,module,exports){
// heading (#, ##, ...)

'use strict';


module.exports = function heading(state, startLine, endLine, silent) {
  var ch, level, tmp, token,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  ch  = state.src.charCodeAt(pos);

  if (ch !== 0x23/* # */ || pos >= max) { return false; }

  // count heading level
  level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 0x23/* # */ && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }

  if (level > 6 || (pos < max && ch !== 0x20/* space */)) { return false; }

  if (silent) { return true; }

  // Let's cut tails like '    ###  ' from the end of string

  max = state.skipCharsBack(max, 0x20, pos); // space
  tmp = state.skipCharsBack(max, 0x23, pos); // #
  if (tmp > pos && state.src.charCodeAt(tmp - 1) === 0x20/* space */) {
    max = tmp;
  }

  state.line = startLine + 1;

  token        = state.push('heading_open', 'h' + String(level), 1);
  token.markup = '########'.slice(0, level);
  token.map    = [ startLine, state.line ];

  token          = state.push('inline', '', 0);
  token.content  = state.src.slice(pos, max).trim();
  token.map      = [ startLine, state.line ];
  token.children = [];

  token        = state.push('heading_close', 'h' + String(level), -1);
  token.markup = '########'.slice(0, level);

  return true;
};

},{}],55:[function(require,module,exports){
// Horizontal rule

'use strict';


module.exports = function hr(state, startLine, endLine, silent) {
  var marker, cnt, ch, token,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  marker = state.src.charCodeAt(pos++);

  // Check hr marker
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x5F/* _ */) {
    return false;
  }

  // markers can be mixed with spaces, but there should be at least 3 one

  cnt = 1;
  while (pos < max) {
    ch = state.src.charCodeAt(pos++);
    if (ch !== marker && ch !== 0x20/* space */) { return false; }
    if (ch === marker) { cnt++; }
  }

  if (cnt < 3) { return false; }

  if (silent) { return true; }

  state.line = startLine + 1;

  token        = state.push('hr', 'hr', 0);
  token.map    = [ startLine, state.line ];
  token.markup = Array(cnt + 1).join(String.fromCharCode(marker));

  return true;
};

},{}],56:[function(require,module,exports){
// HTML block

'use strict';


var block_names = require('../common/html_blocks');
var HTML_OPEN_CLOSE_TAG_RE = require('../common/html_re').HTML_OPEN_CLOSE_TAG_RE;

// An array of opening and corresponding closing sequences for html tags,
// last argument defines whether it can terminate a paragraph or not
//
var HTML_SEQUENCES = [
  [ /^<(script|pre|style)(?=(\s|>|$))/i, /<\/(script|pre|style)>/i, true ],
  [ /^<!--/,        /-->/,   true ],
  [ /^<\?/,         /\?>/,   true ],
  [ /^<![A-Z]/,     />/,     true ],
  [ /^<!\[CDATA\[/, /\]\]>/, true ],
  [ new RegExp('^</?(' + block_names.join('|') + ')(?=(\\s|/?>|$))', 'i'), /^$/, true ],
  [ new RegExp(HTML_OPEN_CLOSE_TAG_RE.source + '\\s*$'),  /^$/, false ]
];


module.exports = function html_block(state, startLine, endLine, silent) {
  var i, nextLine, token, lineText,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (!state.md.options.html) { return false; }

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

  lineText = state.src.slice(pos, max);

  for (i = 0; i < HTML_SEQUENCES.length; i++) {
    if (HTML_SEQUENCES[i][0].test(lineText)) { break; }
  }

  if (i === HTML_SEQUENCES.length) { return false; }

  if (silent) {
    // true if this sequence can be a terminator, false otherwise
    return HTML_SEQUENCES[i][2];
  }

  nextLine = startLine + 1;

  // If we are here - we detected HTML block.
  // Let's roll down till block end.
  if (!HTML_SEQUENCES[i][1].test(lineText)) {
    for (; nextLine < endLine; nextLine++) {
      if (state.tShift[nextLine] < state.blkIndent) { break; }

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      max = state.eMarks[nextLine];
      lineText = state.src.slice(pos, max);

      if (HTML_SEQUENCES[i][1].test(lineText)) {
        if (lineText.length !== 0) { nextLine++; }
        break;
      }
    }
  }

  state.line = nextLine;

  token         = state.push('html_block', '', 0);
  token.map     = [ startLine, nextLine ];
  token.content = state.getLines(startLine, nextLine, state.blkIndent, true);

  return true;
};

},{"../common/html_blocks":34,"../common/html_re":35}],57:[function(require,module,exports){
// lheading (---, ===)

'use strict';


module.exports = function lheading(state, startLine, endLine/*, silent*/) {
  var marker, pos, max, token, level,
      next = startLine + 1;

  if (next >= endLine) { return false; }
  if (state.tShift[next] < state.blkIndent) { return false; }

  // Scan next line

  if (state.tShift[next] - state.blkIndent > 3) { return false; }

  pos = state.bMarks[next] + state.tShift[next];
  max = state.eMarks[next];

  if (pos >= max) { return false; }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x2D/* - */ && marker !== 0x3D/* = */) { return false; }

  pos = state.skipChars(pos, marker);

  pos = state.skipSpaces(pos);

  if (pos < max) { return false; }

  pos = state.bMarks[startLine] + state.tShift[startLine];

  state.line = next + 1;
  level = (marker === 0x3D/* = */ ? 1 : 2);

  token          = state.push('heading_open', 'h' + String(level), 1);
  token.markup   = String.fromCharCode(marker);
  token.map      = [ startLine, state.line ];

  token          = state.push('inline', '', 0);
  token.content  = state.src.slice(pos, state.eMarks[startLine]).trim();
  token.map      = [ startLine, state.line - 1 ];
  token.children = [];

  token          = state.push('heading_close', 'h' + String(level), -1);
  token.markup   = String.fromCharCode(marker);

  return true;
};

},{}],58:[function(require,module,exports){
// Lists

'use strict';


// Search `[-+*][\n ]`, returns next pos arter marker on success
// or -1 on fail.
function skipBulletListMarker(state, startLine) {
  var marker, pos, max;

  pos = state.bMarks[startLine] + state.tShift[startLine];
  max = state.eMarks[startLine];

  marker = state.src.charCodeAt(pos++);
  // Check bullet
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x2B/* + */) {
    return -1;
  }

  if (pos < max && state.src.charCodeAt(pos) !== 0x20) {
    // " 1.test " - is not a list item
    return -1;
  }

  return pos;
}

// Search `\d+[.)][\n ]`, returns next pos arter marker on success
// or -1 on fail.
function skipOrderedListMarker(state, startLine) {
  var ch,
      start = state.bMarks[startLine] + state.tShift[startLine],
      pos = start,
      max = state.eMarks[startLine];

  // List marker should have at least 2 chars (digit + dot)
  if (pos + 1 >= max) { return -1; }

  ch = state.src.charCodeAt(pos++);

  if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1; }

  for (;;) {
    // EOL -> fail
    if (pos >= max) { return -1; }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {

      // List marker should have no more than 9 digits
      // (prevents integer overflow in browsers)
      if (pos - start >= 10) { return -1; }

      continue;
    }

    // found valid marker
    if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
      break;
    }

    return -1;
  }


  if (pos < max && state.src.charCodeAt(pos) !== 0x20/* space */) {
    // " 1.test " - is not a list item
    return -1;
  }
  return pos;
}

function markTightParagraphs(state, idx) {
  var i, l,
      level = state.level + 2;

  for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].hidden = true;
      state.tokens[i].hidden = true;
      i += 2;
    }
  }
}


module.exports = function list(state, startLine, endLine, silent) {
  var nextLine,
      indent,
      oldTShift,
      oldIndent,
      oldTight,
      oldParentType,
      start,
      posAfterMarker,
      max,
      indentAfterMarker,
      markerValue,
      markerCharCode,
      isOrdered,
      contentStart,
      listTokIdx,
      prevEmptyEnd,
      listLines,
      itemLines,
      tight = true,
      terminatorRules,
      token,
      i, l, terminate;

  // Detect list type and position after marker
  if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
    isOrdered = true;
  } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
    isOrdered = false;
  } else {
    return false;
  }

  // We should terminate list on style change. Remember first one to compare.
  markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // For validation mode we can terminate immediately
  if (silent) { return true; }

  // Start list
  listTokIdx = state.tokens.length;

  if (isOrdered) {
    start = state.bMarks[startLine] + state.tShift[startLine];
    markerValue = Number(state.src.substr(start, posAfterMarker - start - 1));

    token       = state.push('ordered_list_open', 'ol', 1);
    if (markerValue !== 1) {
      token.attrs = [ [ 'start', markerValue ] ];
    }

  } else {
    token       = state.push('bullet_list_open', 'ul', 1);
  }

  token.map    = listLines = [ startLine, 0 ];
  token.markup = String.fromCharCode(markerCharCode);

  //
  // Iterate list items
  //

  nextLine = startLine;
  prevEmptyEnd = false;
  terminatorRules = state.md.block.ruler.getRules('list');

  while (nextLine < endLine) {
    contentStart = state.skipSpaces(posAfterMarker);
    max = state.eMarks[nextLine];

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = contentStart - posAfterMarker;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) { indentAfterMarker = 1; }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    indent = (posAfterMarker - state.bMarks[nextLine]) + indentAfterMarker;

    // Run subparser & write tokens
    token        = state.push('list_item_open', 'li', 1);
    token.markup = String.fromCharCode(markerCharCode);
    token.map    = itemLines = [ startLine, 0 ];

    oldIndent = state.blkIndent;
    oldTight = state.tight;
    oldTShift = state.tShift[startLine];
    oldParentType = state.parentType;
    state.tShift[startLine] = contentStart - state.bMarks[startLine];
    state.blkIndent = indent;
    state.tight = true;
    state.parentType = 'list';

    state.md.block.tokenize(state, startLine, endLine, true);

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = (state.line - startLine) > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = oldIndent;
    state.tShift[startLine] = oldTShift;
    state.tight = oldTight;
    state.parentType = oldParentType;

    token        = state.push('list_item_close', 'li', -1);
    token.markup = String.fromCharCode(markerCharCode);

    nextLine = startLine = state.line;
    itemLines[1] = nextLine;
    contentStart = state.bMarks[startLine];

    if (nextLine >= endLine) { break; }

    if (state.isEmpty(nextLine)) {
      break;
    }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.tShift[nextLine] < state.blkIndent) { break; }

    // fail if terminating block found
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break; }
  }

  // Finilize list
  if (isOrdered) {
    token = state.push('ordered_list_close', 'ol', -1);
  } else {
    token = state.push('bullet_list_close', 'ul', -1);
  }
  token.markup = String.fromCharCode(markerCharCode);

  listLines[1] = nextLine;
  state.line = nextLine;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true;
};

},{}],59:[function(require,module,exports){
// Paragraph

'use strict';


module.exports = function paragraph(state, startLine/*, endLine*/) {
  var content, terminate, i, l, token,
      nextLine = startLine + 1,
      terminatorRules = state.md.block.ruler.getRules('paragraph'),
      endLine = state.lineMax;

  // jump line-by-line until empty one or EOF
  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.tShift[nextLine] - state.blkIndent > 3) { continue; }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.tShift[nextLine] < 0) { continue; }

    // Some tags can terminate paragraph without empty line.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }
  }

  content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine;

  token          = state.push('paragraph_open', 'p', 1);
  token.map      = [ startLine, state.line ];

  token          = state.push('inline', '', 0);
  token.content  = content;
  token.map      = [ startLine, state.line ];
  token.children = [];

  token          = state.push('paragraph_close', 'p', -1);

  return true;
};

},{}],60:[function(require,module,exports){
'use strict';


var parseLinkDestination = require('../helpers/parse_link_destination');
var parseLinkTitle       = require('../helpers/parse_link_title');
var normalizeReference   = require('../common/utils').normalizeReference;


module.exports = function reference(state, startLine, _endLine, silent) {
  var ch,
      destEndPos,
      destEndLineNo,
      endLine,
      href,
      i,
      l,
      label,
      labelEnd,
      res,
      start,
      str,
      terminate,
      terminatorRules,
      title,
      lines = 0,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine],
      nextLine = startLine + 1;

  if (state.src.charCodeAt(pos) !== 0x5B/* [ */) { return false; }

  // Simple check to quickly interrupt scan on [link](url) at the start of line.
  // Can be useful on practice: https://github.com/markdown-it/markdown-it/issues/54
  while (++pos < max) {
    if (state.src.charCodeAt(pos) === 0x5D /* ] */ &&
        state.src.charCodeAt(pos - 1) !== 0x5C/* \ */) {
      if (pos + 1 === max) { return false; }
      if (state.src.charCodeAt(pos + 1) !== 0x3A/* : */) { return false; }
      break;
    }
  }

  endLine = state.lineMax;

  // jump line-by-line until empty one or EOF
  terminatorRules = state.md.block.ruler.getRules('reference');

  for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
    // this would be a code block normally, but after paragraph
    // it's considered a lazy continuation regardless of what's there
    if (state.tShift[nextLine] - state.blkIndent > 3) { continue; }

    // quirk for blockquotes, this line should already be checked by that rule
    if (state.tShift[nextLine] < 0) { continue; }

    // Some tags can terminate paragraph without empty line.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }
  }

  str = state.getLines(startLine, nextLine, state.blkIndent, false).trim();
  max = str.length;

  for (pos = 1; pos < max; pos++) {
    ch = str.charCodeAt(pos);
    if (ch === 0x5B /* [ */) {
      return false;
    } else if (ch === 0x5D /* ] */) {
      labelEnd = pos;
      break;
    } else if (ch === 0x0A /* \n */) {
      lines++;
    } else if (ch === 0x5C /* \ */) {
      pos++;
      if (pos < max && str.charCodeAt(pos) === 0x0A) {
        lines++;
      }
    }
  }

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return false; }

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      lines++;
    } else if (ch === 0x20) {
      /*eslint no-empty:0*/
    } else {
      break;
    }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  res = parseLinkDestination(str, pos, max);
  if (!res.ok) { return false; }

  href = state.md.normalizeLink(res.str);
  if (!state.md.validateLink(href)) { return false; }

  pos = res.pos;
  lines += res.lines;

  // save cursor state, we could require to rollback later
  destEndPos = pos;
  destEndLineNo = lines;

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  start = pos;
  for (; pos < max; pos++) {
    ch = str.charCodeAt(pos);
    if (ch === 0x0A) {
      lines++;
    } else if (ch === 0x20) {
      /*eslint no-empty:0*/
    } else {
      break;
    }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  res = parseLinkTitle(str, pos, max);
  if (pos < max && start !== pos && res.ok) {
    title = res.str;
    pos = res.pos;
    lines += res.lines;
  } else {
    title = '';
    pos = destEndPos;
    lines = destEndLineNo;
  }

  // skip trailing spaces until the rest of the line
  while (pos < max && str.charCodeAt(pos) === 0x20/* space */) { pos++; }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    if (title) {
      // garbage at the end of the line after title,
      // but it could still be a valid reference if we roll back
      title = '';
      pos = destEndPos;
      lines = destEndLineNo;
      while (pos < max && str.charCodeAt(pos) === 0x20/* space */) { pos++; }
    }
  }

  if (pos < max && str.charCodeAt(pos) !== 0x0A) {
    // garbage at the end of the line
    return false;
  }

  label = normalizeReference(str.slice(1, labelEnd));
  if (!label) {
    // CommonMark 0.20 disallows empty labels
    return false;
  }

  // Reference can not terminate anything. This check is for safety only.
  /*istanbul ignore if*/
  if (silent) { return true; }

  if (typeof state.env.references === 'undefined') {
    state.env.references = {};
  }
  if (typeof state.env.references[label] === 'undefined') {
    state.env.references[label] = { title: title, href: href };
  }

  state.line = startLine + lines + 1;
  return true;
};

},{"../common/utils":37,"../helpers/parse_link_destination":39,"../helpers/parse_link_title":41}],61:[function(require,module,exports){
// Parser state class

'use strict';

var Token = require('../token');


function StateBlock(src, md, env, tokens) {
  var ch, s, start, pos, len, indent, indent_found;

  this.src = src;

  // link to parser instance
  this.md     = md;

  this.env = env;

  //
  // Internal state vartiables
  //

  this.tokens = tokens;

  this.bMarks = [];  // line begin offsets for fast jumps
  this.eMarks = [];  // line end offsets for fast jumps
  this.tShift = [];  // indent for each line

  // block parser variables
  this.blkIndent  = 0; // required block content indent
                       // (for example, if we are in list)
  this.line       = 0; // line index in src
  this.lineMax    = 0; // lines count
  this.tight      = false;  // loose/tight mode for lists
  this.parentType = 'root'; // if `list`, block parser stops on two newlines
  this.ddIndent   = -1; // indent of the current dd block (-1 if there isn't any)

  this.level = 0;

  // renderer
  this.result = '';

  // Create caches
  // Generate markers.
  s = this.src;
  indent = 0;
  indent_found = false;

  for (start = pos = indent = 0, len = s.length; pos < len; pos++) {
    ch = s.charCodeAt(pos);

    if (!indent_found) {
      if (ch === 0x20/* space */) {
        indent++;
        continue;
      } else {
        indent_found = true;
      }
    }

    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++; }
      this.bMarks.push(start);
      this.eMarks.push(pos);
      this.tShift.push(indent);

      indent_found = false;
      indent = 0;
      start = pos + 1;
    }
  }

  // Push fake entry to simplify cache bounds checks
  this.bMarks.push(s.length);
  this.eMarks.push(s.length);
  this.tShift.push(0);

  this.lineMax = this.bMarks.length - 1; // don't count last fake line
}

// Push new token to "stream".
//
StateBlock.prototype.push = function (type, tag, nesting) {
  var token = new Token(type, tag, nesting);
  token.block = true;

  if (nesting < 0) { this.level--; }
  token.level = this.level;
  if (nesting > 0) { this.level++; }

  this.tokens.push(token);
  return token;
};

StateBlock.prototype.isEmpty = function isEmpty(line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
};

StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
  for (var max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break;
    }
  }
  return from;
};

// Skip spaces from given position.
StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
  for (var max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== 0x20/* space */) { break; }
  }
  return pos;
};

// Skip char codes from given position
StateBlock.prototype.skipChars = function skipChars(pos, code) {
  for (var max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break; }
  }
  return pos;
};

// Skip char codes reverse from given position - 1
StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code, min) {
  if (pos <= min) { return pos; }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1; }
  }
  return pos;
};

// cut lines range from source.
StateBlock.prototype.getLines = function getLines(begin, end, indent, keepLastLF) {
  var i, first, last, queue, shift,
      line = begin;

  if (begin >= end) {
    return '';
  }

  // Opt: don't use push queue for single line;
  if (line + 1 === end) {
    first = this.bMarks[line] + Math.min(this.tShift[line], indent);
    last = this.eMarks[end - 1] + (keepLastLF ? 1 : 0);
    return this.src.slice(first, last);
  }

  queue = new Array(end - begin);

  for (i = 0; line < end; line++, i++) {
    shift = this.tShift[line];
    if (shift > indent) { shift = indent; }
    if (shift < 0) { shift = 0; }

    first = this.bMarks[line] + shift;

    if (line + 1 < end || keepLastLF) {
      // No need for bounds check because we have fake entry on tail.
      last = this.eMarks[line] + 1;
    } else {
      last = this.eMarks[line];
    }

    queue[i] = this.src.slice(first, last);
  }

  return queue.join('');
};

// re-export Token class to use in block rules
StateBlock.prototype.Token = Token;


module.exports = StateBlock;

},{"../token":82}],62:[function(require,module,exports){
// GFM table, non-standard

'use strict';


function getLine(state, line) {
  var pos = state.bMarks[line] + state.blkIndent,
      max = state.eMarks[line];

  return state.src.substr(pos, max - pos);
}

function escapedSplit(str) {
  var result = [],
      pos = 0,
      max = str.length,
      ch,
      escapes = 0,
      lastPos = 0,
      backTicked = false,
      lastBackTick = 0;

  ch  = str.charCodeAt(pos);

  while (pos < max) {
    if (ch === 0x60/* ` */ && (escapes % 2 === 0)) {
      backTicked = !backTicked;
      lastBackTick = pos;
    } else if (ch === 0x7c/* | */ && (escapes % 2 === 0) && !backTicked) {
      result.push(str.substring(lastPos, pos));
      lastPos = pos + 1;
    } else if (ch === 0x5c/* \ */) {
      escapes++;
    } else {
      escapes = 0;
    }

    pos++;

    // If there was an un-closed backtick, go back to just after
    // the last backtick, but as if it was a normal character
    if (pos === max && backTicked) {
      backTicked = false;
      pos = lastBackTick + 1;
    }

    ch = str.charCodeAt(pos);
  }

  result.push(str.substring(lastPos));

  return result;
}


module.exports = function table(state, startLine, endLine, silent) {
  var ch, lineText, pos, i, nextLine, rows, token,
      aligns, t, tableLines, tbodyLines;

  // should have at least three lines
  if (startLine + 2 > endLine) { return false; }

  nextLine = startLine + 1;

  if (state.tShift[nextLine] < state.blkIndent) { return false; }

  // first character of the second line should be '|' or '-'

  pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) { return false; }

  ch = state.src.charCodeAt(pos);
  if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */) { return false; }

  lineText = getLine(state, startLine + 1);
  if (!/^[-:| ]+$/.test(lineText)) { return false; }

  rows = lineText.split('|');
  if (rows.length < 2) { return false; }
  aligns = [];
  for (i = 0; i < rows.length; i++) {
    t = rows[i].trim();
    if (!t) {
      // allow empty columns before and after table, but not in between columns;
      // e.g. allow ` |---| `, disallow ` ---||--- `
      if (i === 0 || i === rows.length - 1) {
        continue;
      } else {
        return false;
      }
    }

    if (!/^:?-+:?$/.test(t)) { return false; }
    if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
      aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
    } else if (t.charCodeAt(0) === 0x3A/* : */) {
      aligns.push('left');
    } else {
      aligns.push('');
    }
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf('|') === -1) { return false; }
  rows = escapedSplit(lineText.replace(/^\||\|$/g, ''));
  if (aligns.length !== rows.length) { return false; }
  if (silent) { return true; }

  token     = state.push('table_open', 'table', 1);
  token.map = tableLines = [ startLine, 0 ];

  token     = state.push('thead_open', 'thead', 1);
  token.map = [ startLine, startLine + 1 ];

  token     = state.push('tr_open', 'tr', 1);
  token.map = [ startLine, startLine + 1 ];

  for (i = 0; i < rows.length; i++) {
    token          = state.push('th_open', 'th', 1);
    token.map      = [ startLine, startLine + 1 ];
    if (aligns[i]) {
      token.attrs  = [ [ 'style', 'text-align:' + aligns[i] ] ];
    }

    token          = state.push('inline', '', 0);
    token.content  = rows[i].trim();
    token.map      = [ startLine, startLine + 1 ];
    token.children = [];

    token          = state.push('th_close', 'th', -1);
  }

  token     = state.push('tr_close', 'tr', -1);
  token     = state.push('thead_close', 'thead', -1);

  token     = state.push('tbody_open', 'tbody', 1);
  token.map = tbodyLines = [ startLine + 2, 0 ];

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.tShift[nextLine] < state.blkIndent) { break; }

    lineText = getLine(state, nextLine).trim();
    if (lineText.indexOf('|') === -1) { break; }
    rows = escapedSplit(lineText.replace(/^\||\|$/g, ''));

    // set number of columns to number of columns in header row
    rows.length = aligns.length;

    token = state.push('tr_open', 'tr', 1);
    for (i = 0; i < rows.length; i++) {
      token          = state.push('td_open', 'td', 1);
      if (aligns[i]) {
        token.attrs  = [ [ 'style', 'text-align:' + aligns[i] ] ];
      }

      token          = state.push('inline', '', 0);
      token.content  = rows[i] ? rows[i].trim() : '';
      token.children = [];

      token          = state.push('td_close', 'td', -1);
    }
    token = state.push('tr_close', 'tr', -1);
  }
  token = state.push('tbody_close', 'tbody', -1);
  token = state.push('table_close', 'table', -1);

  tableLines[1] = tbodyLines[1] = nextLine;
  state.line = nextLine;
  return true;
};

},{}],63:[function(require,module,exports){
'use strict';


module.exports = function block(state) {
  var token;

  if (state.inlineMode) {
    token          = new state.Token('inline', '', 0);
    token.content  = state.src;
    token.map      = [ 0, 1 ];
    token.children = [];
    state.tokens.push(token);
  } else {
    state.md.block.parse(state.src, state.md, state.env, state.tokens);
  }
};

},{}],64:[function(require,module,exports){
'use strict';

module.exports = function inline(state) {
  var tokens = state.tokens, tok, i, l;

  // Parse inlines
  for (i = 0, l = tokens.length; i < l; i++) {
    tok = tokens[i];
    if (tok.type === 'inline') {
      state.md.inline.parse(tok.content, state.md, state.env, tok.children);
    }
  }
};

},{}],65:[function(require,module,exports){
// Replace link-like texts with link nodes.
//
// Currently restricted by `md.validateLink()` to http/https/ftp
//
'use strict';


var arrayReplaceAt = require('../common/utils').arrayReplaceAt;


function isLinkOpen(str) {
  return /^<a[>\s]/i.test(str);
}
function isLinkClose(str) {
  return /^<\/a\s*>/i.test(str);
}


module.exports = function linkify(state) {
  var i, j, l, tokens, token, currentToken, nodes, ln, text, pos, lastPos,
      level, htmlLinkLevel, url, fullUrl, urlText,
      blockTokens = state.tokens,
      links;

  if (!state.md.options.linkify) { return; }

  for (j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline' ||
        !state.md.linkify.pretest(blockTokens[j].content)) {
      continue;
    }

    tokens = blockTokens[j].children;

    htmlLinkLevel = 0;

    // We scan from the end, to keep position when new tags added.
    // Use reversed logic in links start/end match
    for (i = tokens.length - 1; i >= 0; i--) {
      currentToken = tokens[i];

      // Skip content of markdown links
      if (currentToken.type === 'link_close') {
        i--;
        while (tokens[i].level !== currentToken.level && tokens[i].type !== 'link_open') {
          i--;
        }
        continue;
      }

      // Skip content of html tag links
      if (currentToken.type === 'html_inline') {
        if (isLinkOpen(currentToken.content) && htmlLinkLevel > 0) {
          htmlLinkLevel--;
        }
        if (isLinkClose(currentToken.content)) {
          htmlLinkLevel++;
        }
      }
      if (htmlLinkLevel > 0) { continue; }

      if (currentToken.type === 'text' && state.md.linkify.test(currentToken.content)) {

        text = currentToken.content;
        links = state.md.linkify.match(text);

        // Now split string to nodes
        nodes = [];
        level = currentToken.level;
        lastPos = 0;

        for (ln = 0; ln < links.length; ln++) {

          url = links[ln].url;
          fullUrl = state.md.normalizeLink(url);
          if (!state.md.validateLink(fullUrl)) { continue; }

          urlText = links[ln].text;

          // Linkifier might send raw hostnames like "example.com", where url
          // starts with domain name. So we prepend http:// in those cases,
          // and remove it afterwards.
          //
          if (!links[ln].schema) {
            urlText = state.md.normalizeLinkText('http://' + urlText).replace(/^http:\/\//, '');
          } else if (links[ln].schema === 'mailto:' && !/^mailto:/i.test(urlText)) {
            urlText = state.md.normalizeLinkText('mailto:' + urlText).replace(/^mailto:/, '');
          } else {
            urlText = state.md.normalizeLinkText(urlText);
          }

          pos = links[ln].index;

          if (pos > lastPos) {
            token         = new state.Token('text', '', 0);
            token.content = text.slice(lastPos, pos);
            token.level   = level;
            nodes.push(token);
          }

          token         = new state.Token('link_open', 'a', 1);
          token.attrs   = [ [ 'href', fullUrl ] ];
          token.level   = level++;
          token.markup  = 'linkify';
          token.info    = 'auto';
          nodes.push(token);

          token         = new state.Token('text', '', 0);
          token.content = urlText;
          token.level   = level;
          nodes.push(token);

          token         = new state.Token('link_close', 'a', -1);
          token.level   = --level;
          token.markup  = 'linkify';
          token.info    = 'auto';
          nodes.push(token);

          lastPos = links[ln].lastIndex;
        }
        if (lastPos < text.length) {
          token         = new state.Token('text', '', 0);
          token.content = text.slice(lastPos);
          token.level   = level;
          nodes.push(token);
        }

        // replace current node
        blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
      }
    }
  }
};

},{"../common/utils":37}],66:[function(require,module,exports){
// Normalize input string

'use strict';


var TABS_SCAN_RE = /[\n\t]/g;
var NEWLINES_RE  = /\r[\n\u0085]|[\u2424\u2028\u0085]/g;
var NULL_RE      = /\u0000/g;


module.exports = function inline(state) {
  var str, lineStart, lastTabPos;

  // Normalize newlines
  str = state.src.replace(NEWLINES_RE, '\n');

  // Replace NULL characters
  str = str.replace(NULL_RE, '\uFFFD');

  // Replace tabs with proper number of spaces (1..4)
  if (str.indexOf('\t') >= 0) {
    lineStart = 0;
    lastTabPos = 0;

    str = str.replace(TABS_SCAN_RE, function (match, offset) {
      var result;
      if (str.charCodeAt(offset) === 0x0A) {
        lineStart = offset + 1;
        lastTabPos = 0;
        return match;
      }
      result = '    '.slice((offset - lineStart - lastTabPos) % 4);
      lastTabPos = offset - lineStart + 1;
      return result;
    });
  }

  state.src = str;
};

},{}],67:[function(require,module,exports){
// Simple typographyc replacements
//
// (c) (C) → ©
// (tm) (TM) → ™
// (r) (R) → ®
// +- → ±
// (p) (P) -> §
// ... → … (also ?.... → ?.., !.... → !..)
// ???????? → ???, !!!!! → !!!, `,,` → `,`
// -- → &ndash;, --- → &mdash;
//
'use strict';

// TODO:
// - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
// - miltiplication 2 x 4 -> 2 × 4

var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;

// Workaround for phantomjs - need regex without /g flag,
// or root check will fail every second time
var SCOPED_ABBR_TEST_RE = /\((c|tm|r|p)\)/i;

var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
var SCOPED_ABBR = {
  'c': '©',
  'r': '®',
  'p': '§',
  'tm': '™'
};

function replaceFn(match, name) {
  return SCOPED_ABBR[name.toLowerCase()];
}

function replace_scoped(inlineTokens) {
  var i, token;

  for (i = inlineTokens.length - 1; i >= 0; i--) {
    token = inlineTokens[i];
    if (token.type === 'text') {
      token.content = token.content.replace(SCOPED_ABBR_RE, replaceFn);
    }
  }
}

function replace_rare(inlineTokens) {
  var i, token;

  for (i = inlineTokens.length - 1; i >= 0; i--) {
    token = inlineTokens[i];
    if (token.type === 'text') {
      if (RARE_RE.test(token.content)) {
        token.content = token.content
                    .replace(/\+-/g, '±')
                    // .., ..., ....... -> …
                    // but ?..... & !..... -> ?.. & !..
                    .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
                    .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
                    // em-dash
                    .replace(/(^|[^-])---([^-]|$)/mg, '$1\u2014$2')
                    // en-dash
                    .replace(/(^|\s)--(\s|$)/mg, '$1\u2013$2')
                    .replace(/(^|[^-\s])--([^-\s]|$)/mg, '$1\u2013$2');
      }
    }
  }
}


module.exports = function replace(state) {
  var blkIdx;

  if (!state.md.options.typographer) { return; }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

    if (state.tokens[blkIdx].type !== 'inline') { continue; }

    if (SCOPED_ABBR_TEST_RE.test(state.tokens[blkIdx].content)) {
      replace_scoped(state.tokens[blkIdx].children);
    }

    if (RARE_RE.test(state.tokens[blkIdx].content)) {
      replace_rare(state.tokens[blkIdx].children);
    }

  }
};

},{}],68:[function(require,module,exports){
// Convert straight quotation marks to typographic ones
//
'use strict';


var isWhiteSpace   = require('../common/utils').isWhiteSpace;
var isPunctChar    = require('../common/utils').isPunctChar;
var isMdAsciiPunct = require('../common/utils').isMdAsciiPunct;

var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var APOSTROPHE = '\u2019'; /* ’ */


function replaceAt(str, index, ch) {
  return str.substr(0, index) + ch + str.substr(index + 1);
}

function process_inlines(tokens, state) {
  var i, token, text, t, pos, max, thisLevel, item, lastChar, nextChar,
      isLastPunctChar, isNextPunctChar, isLastWhiteSpace, isNextWhiteSpace,
      canOpen, canClose, j, isSingle, stack, openQuote, closeQuote;

  stack = [];

  for (i = 0; i < tokens.length; i++) {
    token = tokens[i];

    thisLevel = tokens[i].level;

    for (j = stack.length - 1; j >= 0; j--) {
      if (stack[j].level <= thisLevel) { break; }
    }
    stack.length = j + 1;

    if (token.type !== 'text') { continue; }

    text = token.content;
    pos = 0;
    max = text.length;

    /*eslint no-labels:0,block-scoped-var:0*/
    OUTER:
    while (pos < max) {
      QUOTE_RE.lastIndex = pos;
      t = QUOTE_RE.exec(text);
      if (!t) { break; }

      canOpen = canClose = true;
      pos = t.index + 1;
      isSingle = (t[0] === "'");

      // treat begin/end of the line as a whitespace
      lastChar = t.index - 1 >= 0 ? text.charCodeAt(t.index - 1) : 0x20;
      nextChar = pos < max ? text.charCodeAt(pos) : 0x20;

      isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
      isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

      isLastWhiteSpace = isWhiteSpace(lastChar);
      isNextWhiteSpace = isWhiteSpace(nextChar);

      if (isNextWhiteSpace) {
        canOpen = false;
      } else if (isNextPunctChar) {
        if (!(isLastWhiteSpace || isLastPunctChar)) {
          canOpen = false;
        }
      }

      if (isLastWhiteSpace) {
        canClose = false;
      } else if (isLastPunctChar) {
        if (!(isNextWhiteSpace || isNextPunctChar)) {
          canClose = false;
        }
      }

      if (nextChar === 0x22 /* " */ && t[0] === '"') {
        if (lastChar >= 0x30 /* 0 */ && lastChar <= 0x39 /* 9 */) {
          // special case: 1"" - count first quote as an inch
          canClose = canOpen = false;
        }
      }

      if (canOpen && canClose) {
        // treat this as the middle of the word
        canOpen = false;
        canClose = isNextPunctChar;
      }

      if (!canOpen && !canClose) {
        // middle of word
        if (isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
        continue;
      }

      if (canClose) {
        // this could be a closing quote, rewind the stack to get a match
        for (j = stack.length - 1; j >= 0; j--) {
          item = stack[j];
          if (stack[j].level < thisLevel) { break; }
          if (item.single === isSingle && stack[j].level === thisLevel) {
            item = stack[j];

            if (isSingle) {
              openQuote = state.md.options.quotes[2];
              closeQuote = state.md.options.quotes[3];
            } else {
              openQuote = state.md.options.quotes[0];
              closeQuote = state.md.options.quotes[1];
            }

            // replace token.content *before* tokens[item.token].content,
            // because, if they are pointing at the same token, replaceAt
            // could mess up indices when quote length != 1
            token.content = replaceAt(token.content, t.index, closeQuote);
            tokens[item.token].content = replaceAt(
              tokens[item.token].content, item.pos, openQuote);

            pos += closeQuote.length - 1;
            if (item.token === i) { pos += openQuote.length - 1; }

            text = token.content;
            max = text.length;

            stack.length = j;
            continue OUTER;
          }
        }
      }

      if (canOpen) {
        stack.push({
          token: i,
          pos: t.index,
          single: isSingle,
          level: thisLevel
        });
      } else if (canClose && isSingle) {
        token.content = replaceAt(token.content, t.index, APOSTROPHE);
      }
    }
  }
}


module.exports = function smartquotes(state) {
  /*eslint max-depth:0*/
  var blkIdx;

  if (!state.md.options.typographer) { return; }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

    if (state.tokens[blkIdx].type !== 'inline' ||
        !QUOTE_TEST_RE.test(state.tokens[blkIdx].content)) {
      continue;
    }

    process_inlines(state.tokens[blkIdx].children, state);
  }
};

},{"../common/utils":37}],69:[function(require,module,exports){
// Core state object
//
'use strict';

var Token = require('../token');


function StateCore(src, md, env) {
  this.src = src;
  this.env = env;
  this.tokens = [];
  this.inlineMode = false;
  this.md = md; // link to parser instance
}

// re-export Token class to use in core rules
StateCore.prototype.Token = Token;


module.exports = StateCore;

},{"../token":82}],70:[function(require,module,exports){
// Process autolinks '<protocol:...>'

'use strict';

var url_schemas = require('../common/url_schemas');


/*eslint max-len:0*/
var EMAIL_RE    = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
var AUTOLINK_RE = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;


module.exports = function autolink(state, silent) {
  var tail, linkMatch, emailMatch, url, fullUrl, token,
      pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

  tail = state.src.slice(pos);

  if (tail.indexOf('>') < 0) { return false; }

  if (AUTOLINK_RE.test(tail)) {
    linkMatch = tail.match(AUTOLINK_RE);

    if (url_schemas.indexOf(linkMatch[1].toLowerCase()) < 0) { return false; }

    url = linkMatch[0].slice(1, -1);
    fullUrl = state.md.normalizeLink(url);
    if (!state.md.validateLink(fullUrl)) { return false; }

    if (!silent) {
      token         = state.push('link_open', 'a', 1);
      token.attrs   = [ [ 'href', fullUrl ] ];

      token         = state.push('text', '', 0);
      token.content = state.md.normalizeLinkText(url);

      token         = state.push('link_close', 'a', -1);
    }

    state.pos += linkMatch[0].length;
    return true;
  }

  if (EMAIL_RE.test(tail)) {
    emailMatch = tail.match(EMAIL_RE);

    url = emailMatch[0].slice(1, -1);
    fullUrl = state.md.normalizeLink('mailto:' + url);
    if (!state.md.validateLink(fullUrl)) { return false; }

    if (!silent) {
      token         = state.push('link_open', 'a', 1);
      token.attrs   = [ [ 'href', fullUrl ] ];
      token.markup  = 'autolink';
      token.info    = 'auto';

      token         = state.push('text', '', 0);
      token.content = state.md.normalizeLinkText(url);

      token         = state.push('link_close', 'a', -1);
      token.markup  = 'autolink';
      token.info    = 'auto';
    }

    state.pos += emailMatch[0].length;
    return true;
  }

  return false;
};

},{"../common/url_schemas":36}],71:[function(require,module,exports){
// Parse backticks

'use strict';

module.exports = function backtick(state, silent) {
  var start, max, marker, matchStart, matchEnd, token,
      pos = state.pos,
      ch = state.src.charCodeAt(pos);

  if (ch !== 0x60/* ` */) { return false; }

  start = pos;
  pos++;
  max = state.posMax;

  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++; }

  marker = state.src.slice(start, pos);

  matchStart = matchEnd = pos;

  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++; }

    if (matchEnd - matchStart === marker.length) {
      if (!silent) {
        token         = state.push('code_inline', 'code', 0);
        token.markup  = marker;
        token.content = state.src.slice(pos, matchStart)
                                 .replace(/[ \n]+/g, ' ')
                                 .trim();
      }
      state.pos = matchEnd;
      return true;
    }
  }

  if (!silent) { state.pending += marker; }
  state.pos += marker.length;
  return true;
};

},{}],72:[function(require,module,exports){
// Process *this* and _that_
//
'use strict';


var isWhiteSpace   = require('../common/utils').isWhiteSpace;
var isPunctChar    = require('../common/utils').isPunctChar;
var isMdAsciiPunct = require('../common/utils').isMdAsciiPunct;


// parse sequence of emphasis markers,
// "start" should point at a valid marker
function scanDelims(state, start) {
  var pos = start, lastChar, nextChar, count, can_open, can_close,
      isLastWhiteSpace, isLastPunctChar,
      isNextWhiteSpace, isNextPunctChar,
      left_flanking = true,
      right_flanking = true,
      max = state.posMax,
      marker = state.src.charCodeAt(start);

  // treat beginning of the line as a whitespace
  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : 0x20;

  while (pos < max && state.src.charCodeAt(pos) === marker) { pos++; }

  count = pos - start;

  // treat end of the line as a whitespace
  nextChar = pos < max ? state.src.charCodeAt(pos) : 0x20;

  isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
  isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

  isLastWhiteSpace = isWhiteSpace(lastChar);
  isNextWhiteSpace = isWhiteSpace(nextChar);

  if (isNextWhiteSpace) {
    left_flanking = false;
  } else if (isNextPunctChar) {
    if (!(isLastWhiteSpace || isLastPunctChar)) {
      left_flanking = false;
    }
  }

  if (isLastWhiteSpace) {
    right_flanking = false;
  } else if (isLastPunctChar) {
    if (!(isNextWhiteSpace || isNextPunctChar)) {
      right_flanking = false;
    }
  }

  if (marker === 0x5F /* _ */) {
    // "_" inside a word can neither open nor close an emphasis
    can_open  = left_flanking  && (!right_flanking || isLastPunctChar);
    can_close = right_flanking && (!left_flanking  || isNextPunctChar);
  } else {
    can_open  = left_flanking;
    can_close = right_flanking;
  }

  return {
    can_open: can_open,
    can_close: can_close,
    delims: count
  };
}

module.exports = function emphasis(state, silent) {
  var startCount,
      count,
      found,
      oldCount,
      newCount,
      stack,
      res,
      token,
      max = state.posMax,
      start = state.pos,
      marker = state.src.charCodeAt(start);

  if (marker !== 0x5F/* _ */ && marker !== 0x2A /* * */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode

  res = scanDelims(state, start);
  startCount = res.delims;
  if (!res.can_open) {
    state.pos += startCount;
    // Earlier we checked !silent, but this implementation does not need it
    state.pending += state.src.slice(start, state.pos);
    return true;
  }

  state.pos = start + startCount;
  stack = [ startCount ];

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === marker) {
      res = scanDelims(state, state.pos);
      count = res.delims;
      if (res.can_close) {
        oldCount = stack.pop();
        newCount = count;

        while (oldCount !== newCount) {
          if (newCount < oldCount) {
            stack.push(oldCount - newCount);
            break;
          }

          // assert(newCount > oldCount)
          newCount -= oldCount;

          if (stack.length === 0) { break; }
          state.pos += oldCount;
          oldCount = stack.pop();
        }

        if (stack.length === 0) {
          startCount = oldCount;
          found = true;
          break;
        }
        state.pos += count;
        continue;
      }

      if (res.can_open) { stack.push(count); }
      state.pos += count;
      continue;
    }

    state.md.inline.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + startCount;

  // Earlier we checked !silent, but this implementation does not need it

  // we have `startCount` starting and ending markers,
  // now trying to serialize them into tokens
  for (count = startCount; count > 1; count -= 2) {
    token        = state.push('strong_open', 'strong', 1);
    token.markup = String.fromCharCode(marker) + String.fromCharCode(marker);
  }
  if (count % 2) {
    token        = state.push('em_open', 'em', 1);
    token.markup = String.fromCharCode(marker);
  }

  state.md.inline.tokenize(state);

  if (count % 2) {
    token        = state.push('em_close', 'em', -1);
    token.markup = String.fromCharCode(marker);
  }
  for (count = startCount; count > 1; count -= 2) {
    token        = state.push('strong_close', 'strong', -1);
    token.markup = String.fromCharCode(marker) + String.fromCharCode(marker);
  }

  state.pos = state.posMax + startCount;
  state.posMax = max;
  return true;
};

},{"../common/utils":37}],73:[function(require,module,exports){
// Process html entity - &#123;, &#xAF;, &quot;, ...

'use strict';

var entities          = require('../common/entities');
var has               = require('../common/utils').has;
var isValidEntityCode = require('../common/utils').isValidEntityCode;
var fromCodePoint     = require('../common/utils').fromCodePoint;


var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i;
var NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i;


module.exports = function entity(state, silent) {
  var ch, code, match, pos = state.pos, max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x26/* & */) { return false; }

  if (pos + 1 < max) {
    ch = state.src.charCodeAt(pos + 1);

    if (ch === 0x23 /* # */) {
      match = state.src.slice(pos).match(DIGITAL_RE);
      if (match) {
        if (!silent) {
          code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
          state.pending += isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
        }
        state.pos += match[0].length;
        return true;
      }
    } else {
      match = state.src.slice(pos).match(NAMED_RE);
      if (match) {
        if (has(entities, match[1])) {
          if (!silent) { state.pending += entities[match[1]]; }
          state.pos += match[0].length;
          return true;
        }
      }
    }
  }

  if (!silent) { state.pending += '&'; }
  state.pos++;
  return true;
};

},{"../common/entities":33,"../common/utils":37}],74:[function(require,module,exports){
// Proceess escaped chars and hardbreaks

'use strict';

var ESCAPED = [];

for (var i = 0; i < 256; i++) { ESCAPED.push(0); }

'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function(ch) { ESCAPED[ch.charCodeAt(0)] = 1; });


module.exports = function escape(state, silent) {
  var ch, pos = state.pos, max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x5C/* \ */) { return false; }

  pos++;

  if (pos < max) {
    ch = state.src.charCodeAt(pos);

    if (ch < 256 && ESCAPED[ch] !== 0) {
      if (!silent) { state.pending += state.src[pos]; }
      state.pos += 2;
      return true;
    }

    if (ch === 0x0A) {
      if (!silent) {
        state.push('hardbreak', 'br', 0);
      }

      pos++;
      // skip leading whitespaces from next line
      while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

      state.pos = pos;
      return true;
    }
  }

  if (!silent) { state.pending += '\\'; }
  state.pos++;
  return true;
};

},{}],75:[function(require,module,exports){
// Process html tags

'use strict';


var HTML_TAG_RE = require('../common/html_re').HTML_TAG_RE;


function isLetter(ch) {
  /*eslint no-bitwise:0*/
  var lc = ch | 0x20; // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */);
}


module.exports = function html_inline(state, silent) {
  var ch, match, max, token,
      pos = state.pos;

  if (!state.md.options.html) { return false; }

  // Check start
  max = state.posMax;
  if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
      pos + 2 >= max) {
    return false;
  }

  // Quick fail on second char
  ch = state.src.charCodeAt(pos + 1);
  if (ch !== 0x21/* ! */ &&
      ch !== 0x3F/* ? */ &&
      ch !== 0x2F/* / */ &&
      !isLetter(ch)) {
    return false;
  }

  match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) { return false; }

  if (!silent) {
    token         = state.push('html_inline', '', 0);
    token.content = state.src.slice(pos, pos + match[0].length);
  }
  state.pos += match[0].length;
  return true;
};

},{"../common/html_re":35}],76:[function(require,module,exports){
// Process ![image](<src> "title")

'use strict';

var parseLinkLabel       = require('../helpers/parse_link_label');
var parseLinkDestination = require('../helpers/parse_link_destination');
var parseLinkTitle       = require('../helpers/parse_link_title');
var normalizeReference   = require('../common/utils').normalizeReference;


module.exports = function image(state, silent) {
  var attrs,
      code,
      label,
      labelEnd,
      labelStart,
      pos,
      ref,
      res,
      title,
      token,
      tokens,
      start,
      href = '',
      oldPos = state.pos,
      max = state.posMax;

  if (state.src.charCodeAt(state.pos) !== 0x21/* ! */) { return false; }
  if (state.src.charCodeAt(state.pos + 1) !== 0x5B/* [ */) { return false; }

  labelStart = state.pos + 2;
  labelEnd = parseLinkLabel(state, state.pos + 1, false);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false; }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }
    if (pos >= max) { return false; }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    res = parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false; }

    // [foo]  [bar]
    //      ^^ optional whitespace (can include newlines)
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    var newState = new state.md.inline.State(
      state.src.slice(labelStart, labelEnd),
      state.md,
      state.env,
      tokens = []
    );
    newState.md.inline.tokenize(newState);

    token          = state.push('image', 'img', 0);
    token.attrs    = attrs = [ [ 'src', href ], [ 'alt', '' ] ];
    token.children = tokens;
    if (title) {
      attrs.push([ 'title', title ]);
    }
  }

  state.pos = pos;
  state.posMax = max;
  return true;
};

},{"../common/utils":37,"../helpers/parse_link_destination":39,"../helpers/parse_link_label":40,"../helpers/parse_link_title":41}],77:[function(require,module,exports){
// Process [link](<to> "stuff")

'use strict';

var parseLinkLabel       = require('../helpers/parse_link_label');
var parseLinkDestination = require('../helpers/parse_link_destination');
var parseLinkTitle       = require('../helpers/parse_link_title');
var normalizeReference   = require('../common/utils').normalizeReference;


module.exports = function link(state, silent) {
  var attrs,
      code,
      label,
      labelEnd,
      labelStart,
      pos,
      res,
      ref,
      title,
      token,
      href = '',
      oldPos = state.pos,
      max = state.posMax,
      start = state.pos;

  if (state.src.charCodeAt(state.pos) !== 0x5B/* [ */) { return false; }

  labelStart = state.pos + 1;
  labelEnd = parseLinkLabel(state, state.pos, true);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false; }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }
    if (pos >= max) { return false; }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    res = parseLinkDestination(state.src, pos, state.posMax);
    if (res.ok) {
      href = state.md.normalizeLink(res.str);
      if (state.md.validateLink(href)) {
        pos = res.pos;
      } else {
        href = '';
      }
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    res = parseLinkTitle(state.src, pos, state.posMax);
    if (pos < max && start !== pos && res.ok) {
      title = res.str;
      pos = res.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    //
    // Link reference
    //
    if (typeof state.env.references === 'undefined') { return false; }

    // [foo]  [bar]
    //      ^^ optional whitespace (can include newlines)
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = labelEnd + 1;
      }
    } else {
      pos = labelEnd + 1;
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) { label = state.src.slice(labelStart, labelEnd); }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    token        = state.push('link_open', 'a', 1);
    token.attrs  = attrs = [ [ 'href', href ] ];
    if (title) {
      attrs.push([ 'title', title ]);
    }

    state.md.inline.tokenize(state);

    token        = state.push('link_close', 'a', -1);
  }

  state.pos = pos;
  state.posMax = max;
  return true;
};

},{"../common/utils":37,"../helpers/parse_link_destination":39,"../helpers/parse_link_label":40,"../helpers/parse_link_title":41}],78:[function(require,module,exports){
// Proceess '\n'

'use strict';

module.exports = function newline(state, silent) {
  var pmax, max, pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x0A/* \n */) { return false; }

  pmax = state.pending.length - 1;
  max = state.posMax;

  // '  \n' -> hardbreak
  // Lookup in pending chars is bad practice! Don't copy to other rules!
  // Pending string is stored in concat mode, indexed lookups will cause
  // convertion to flat mode.
  if (!silent) {
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
        state.pending = state.pending.replace(/ +$/, '');
        state.push('hardbreak', 'br', 0);
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push('softbreak', 'br', 0);
      }

    } else {
      state.push('softbreak', 'br', 0);
    }
  }

  pos++;

  // skip heading spaces for next line
  while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

  state.pos = pos;
  return true;
};

},{}],79:[function(require,module,exports){
// Inline parser state

'use strict';


var Token = require('../token');

function StateInline(src, md, env, outTokens) {
  this.src = src;
  this.env = env;
  this.md = md;
  this.tokens = outTokens;

  this.pos = 0;
  this.posMax = this.src.length;
  this.level = 0;
  this.pending = '';
  this.pendingLevel = 0;

  this.cache = {};        // Stores { start: end } pairs. Useful for backtrack
                          // optimization of pairs parse (emphasis, strikes).
}


// Flush pending text
//
StateInline.prototype.pushPending = function () {
  var token = new Token('text', '', 0);
  token.content = this.pending;
  token.level = this.pendingLevel;
  this.tokens.push(token);
  this.pending = '';
  return token;
};


// Push new token to "stream".
// If pending text exists - flush it as text token
//
StateInline.prototype.push = function (type, tag, nesting) {
  if (this.pending) {
    this.pushPending();
  }

  var token = new Token(type, tag, nesting);

  if (nesting < 0) { this.level--; }
  token.level = this.level;
  if (nesting > 0) { this.level++; }

  this.pendingLevel = this.level;
  this.tokens.push(token);
  return token;
};

// re-export Token class to use in block rules
StateInline.prototype.Token = Token;


module.exports = StateInline;

},{"../token":82}],80:[function(require,module,exports){
// ~~strike through~~
//
'use strict';


var isWhiteSpace   = require('../common/utils').isWhiteSpace;
var isPunctChar    = require('../common/utils').isPunctChar;
var isMdAsciiPunct = require('../common/utils').isMdAsciiPunct;


// parse sequence of markers,
// "start" should point at a valid marker
function scanDelims(state, start) {
  var pos = start, lastChar, nextChar, count,
      isLastWhiteSpace, isLastPunctChar,
      isNextWhiteSpace, isNextPunctChar,
      can_open = true,
      can_close = true,
      max = state.posMax,
      marker = state.src.charCodeAt(start);

  // treat beginning of the line as a whitespace
  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : 0x20;

  while (pos < max && state.src.charCodeAt(pos) === marker) { pos++; }

  if (pos >= max) {
    can_open = false;
  }

  count = pos - start;

  // treat end of the line as a whitespace
  nextChar = pos < max ? state.src.charCodeAt(pos) : 0x20;

  isLastPunctChar = isMdAsciiPunct(lastChar) || isPunctChar(String.fromCharCode(lastChar));
  isNextPunctChar = isMdAsciiPunct(nextChar) || isPunctChar(String.fromCharCode(nextChar));

  isLastWhiteSpace = isWhiteSpace(lastChar);
  isNextWhiteSpace = isWhiteSpace(nextChar);

  if (isNextWhiteSpace) {
    can_open = false;
  } else if (isNextPunctChar) {
    if (!(isLastWhiteSpace || isLastPunctChar)) {
      can_open = false;
    }
  }

  if (isLastWhiteSpace) {
    can_close = false;
  } else if (isLastPunctChar) {
    if (!(isNextWhiteSpace || isNextPunctChar)) {
      can_close = false;
    }
  }

  return {
    can_open: can_open,
    can_close: can_close,
    delims: count
  };
}


module.exports = function strikethrough(state, silent) {
  var startCount,
      count,
      tagCount,
      found,
      stack,
      res,
      token,
      max = state.posMax,
      start = state.pos,
      marker = state.src.charCodeAt(start);

  if (marker !== 0x7E/* ~ */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode

  res = scanDelims(state, start);
  startCount = res.delims;
  if (!res.can_open) {
    state.pos += startCount;
    // Earlier we checked !silent, but this implementation does not need it
    state.pending += state.src.slice(start, state.pos);
    return true;
  }

  stack = Math.floor(startCount / 2);
  if (stack <= 0) { return false; }
  state.pos = start + startCount;

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === marker) {
      res = scanDelims(state, state.pos);
      count = res.delims;
      tagCount = Math.floor(count / 2);
      if (res.can_close) {
        if (tagCount >= stack) {
          state.pos += count - 2;
          found = true;
          break;
        }
        stack -= tagCount;
        state.pos += count;
        continue;
      }

      if (res.can_open) { stack += tagCount; }
      state.pos += count;
      continue;
    }

    state.md.inline.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 2;

  // Earlier we checked !silent, but this implementation does not need it
  token        = state.push('s_open', 's', 1);
  token.markup = '~~';

  state.md.inline.tokenize(state);

  token        = state.push('s_close', 's', -1);
  token.markup = '~~';

  state.pos = state.posMax + 2;
  state.posMax = max;
  return true;
};

},{"../common/utils":37}],81:[function(require,module,exports){
// Skip text characters for text token, place those to pending buffer
// and increment current pos

'use strict';


// Rule to skip pure text
// '{}$%@~+=:' reserved for extentions

// !, ", #, $, %, &, ', (, ), *, +, ,, -, ., /, :, ;, <, =, >, ?, @, [, \, ], ^, _, `, {, |, }, or ~

// !!!! Don't confuse with "Markdown ASCII Punctuation" chars
// http://spec.commonmark.org/0.15/#ascii-punctuation-character
function isTerminatorChar(ch) {
  switch (ch) {
    case 0x0A/* \n */:
    case 0x21/* ! */:
    case 0x23/* # */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x26/* & */:
    case 0x2A/* * */:
    case 0x2B/* + */:
    case 0x2D/* - */:
    case 0x3A/* : */:
    case 0x3C/* < */:
    case 0x3D/* = */:
    case 0x3E/* > */:
    case 0x40/* @ */:
    case 0x5B/* [ */:
    case 0x5C/* \ */:
    case 0x5D/* ] */:
    case 0x5E/* ^ */:
    case 0x5F/* _ */:
    case 0x60/* ` */:
    case 0x7B/* { */:
    case 0x7D/* } */:
    case 0x7E/* ~ */:
      return true;
    default:
      return false;
  }
}

module.exports = function text(state, silent) {
  var pos = state.pos;

  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++;
  }

  if (pos === state.pos) { return false; }

  if (!silent) { state.pending += state.src.slice(state.pos, pos); }

  state.pos = pos;

  return true;
};

// Alternative implementation, for memory.
//
// It costs 10% of performance, but allows extend terminators list, if place it
// to `ParcerInline` property. Probably, will switch to it sometime, such
// flexibility required.

/*
var TERMINATOR_RE = /[\n!#$%&*+\-:<=>@[\\\]^_`{}~]/;

module.exports = function text(state, silent) {
  var pos = state.pos,
      idx = state.src.slice(pos).search(TERMINATOR_RE);

  // first char is terminator -> empty text
  if (idx === 0) { return false; }

  // no terminator -> text till end of string
  if (idx < 0) {
    if (!silent) { state.pending += state.src.slice(pos); }
    state.pos = state.src.length;
    return true;
  }

  if (!silent) { state.pending += state.src.slice(pos, pos + idx); }

  state.pos += idx;

  return true;
};*/

},{}],82:[function(require,module,exports){
// Token class

'use strict';


/**
 * class Token
 **/

/**
 * new Token(type, tag, nesting)
 *
 * Create new token and fill passed properties.
 **/
function Token(type, tag, nesting) {
  /**
   * Token#type -> String
   *
   * Type of the token (string, e.g. "paragraph_open")
   **/
  this.type     = type;

  /**
   * Token#tag -> String
   *
   * html tag name, e.g. "p"
   **/
  this.tag      = tag;

  /**
   * Token#attrs -> Array
   *
   * Html attributes. Format: `[ [ name1, value1 ], [ name2, value2 ] ]`
   **/
  this.attrs    = null;

  /**
   * Token#map -> Array
   *
   * Source map info. Format: `[ line_begin, line_end ]`
   **/
  this.map      = null;

  /**
   * Token#nesting -> Number
   *
   * Level change (number in {-1, 0, 1} set), where:
   *
   * -  `1` means the tag is opening
   * -  `0` means the tag is self-closing
   * - `-1` means the tag is closing
   **/
  this.nesting  = nesting;

  /**
   * Token#level -> Number
   *
   * nesting level, the same as `state.level`
   **/
  this.level    = 0;

  /**
   * Token#children -> Array
   *
   * An array of child nodes (inline and img tokens)
   **/
  this.children = null;

  /**
   * Token#content -> String
   *
   * In a case of self-closing tag (code, html, fence, etc.),
   * it has contents of this tag.
   **/
  this.content  = '';

  /**
   * Token#markup -> String
   *
   * '*' or '_' for emphasis, fence string for fence, etc.
   **/
  this.markup   = '';

  /**
   * Token#info -> String
   *
   * fence infostring
   **/
  this.info     = '';

  /**
   * Token#meta -> Object
   *
   * A place for plugins to store an arbitrary data
   **/
  this.meta     = null;

  /**
   * Token#block -> Boolean
   *
   * True for block-level tokens, false for inline tokens.
   * Used in renderer to calculate line breaks
   **/
  this.block    = false;

  /**
   * Token#hidden -> Boolean
   *
   * If it's true, ignore this element when rendering. Used for tight lists
   * to hide paragraphs.
   **/
  this.hidden   = false;
}


/**
 * Token.attrIndex(name) -> Number
 *
 * Search attribute index by name.
 **/
Token.prototype.attrIndex = function attrIndex(name) {
  var attrs, i, len;

  if (!this.attrs) { return -1; }

  attrs = this.attrs;

  for (i = 0, len = attrs.length; i < len; i++) {
    if (attrs[i][0] === name) { return i; }
  }
  return -1;
};


/**
 * Token.attrPush(attrData)
 *
 * Add `[ name, value ]` attribute to list. Init attrs if necessary
 **/
Token.prototype.attrPush = function attrPush(attrData) {
  if (this.attrs) {
    this.attrs.push(attrData);
  } else {
    this.attrs = [ attrData ];
  }
};


module.exports = Token;

},{}],83:[function(require,module,exports){
module.exports={"Aacute":"\u00C1","aacute":"\u00E1","Abreve":"\u0102","abreve":"\u0103","ac":"\u223E","acd":"\u223F","acE":"\u223E\u0333","Acirc":"\u00C2","acirc":"\u00E2","acute":"\u00B4","Acy":"\u0410","acy":"\u0430","AElig":"\u00C6","aelig":"\u00E6","af":"\u2061","Afr":"\uD835\uDD04","afr":"\uD835\uDD1E","Agrave":"\u00C0","agrave":"\u00E0","alefsym":"\u2135","aleph":"\u2135","Alpha":"\u0391","alpha":"\u03B1","Amacr":"\u0100","amacr":"\u0101","amalg":"\u2A3F","amp":"&","AMP":"&","andand":"\u2A55","And":"\u2A53","and":"\u2227","andd":"\u2A5C","andslope":"\u2A58","andv":"\u2A5A","ang":"\u2220","ange":"\u29A4","angle":"\u2220","angmsdaa":"\u29A8","angmsdab":"\u29A9","angmsdac":"\u29AA","angmsdad":"\u29AB","angmsdae":"\u29AC","angmsdaf":"\u29AD","angmsdag":"\u29AE","angmsdah":"\u29AF","angmsd":"\u2221","angrt":"\u221F","angrtvb":"\u22BE","angrtvbd":"\u299D","angsph":"\u2222","angst":"\u00C5","angzarr":"\u237C","Aogon":"\u0104","aogon":"\u0105","Aopf":"\uD835\uDD38","aopf":"\uD835\uDD52","apacir":"\u2A6F","ap":"\u2248","apE":"\u2A70","ape":"\u224A","apid":"\u224B","apos":"'","ApplyFunction":"\u2061","approx":"\u2248","approxeq":"\u224A","Aring":"\u00C5","aring":"\u00E5","Ascr":"\uD835\uDC9C","ascr":"\uD835\uDCB6","Assign":"\u2254","ast":"*","asymp":"\u2248","asympeq":"\u224D","Atilde":"\u00C3","atilde":"\u00E3","Auml":"\u00C4","auml":"\u00E4","awconint":"\u2233","awint":"\u2A11","backcong":"\u224C","backepsilon":"\u03F6","backprime":"\u2035","backsim":"\u223D","backsimeq":"\u22CD","Backslash":"\u2216","Barv":"\u2AE7","barvee":"\u22BD","barwed":"\u2305","Barwed":"\u2306","barwedge":"\u2305","bbrk":"\u23B5","bbrktbrk":"\u23B6","bcong":"\u224C","Bcy":"\u0411","bcy":"\u0431","bdquo":"\u201E","becaus":"\u2235","because":"\u2235","Because":"\u2235","bemptyv":"\u29B0","bepsi":"\u03F6","bernou":"\u212C","Bernoullis":"\u212C","Beta":"\u0392","beta":"\u03B2","beth":"\u2136","between":"\u226C","Bfr":"\uD835\uDD05","bfr":"\uD835\uDD1F","bigcap":"\u22C2","bigcirc":"\u25EF","bigcup":"\u22C3","bigodot":"\u2A00","bigoplus":"\u2A01","bigotimes":"\u2A02","bigsqcup":"\u2A06","bigstar":"\u2605","bigtriangledown":"\u25BD","bigtriangleup":"\u25B3","biguplus":"\u2A04","bigvee":"\u22C1","bigwedge":"\u22C0","bkarow":"\u290D","blacklozenge":"\u29EB","blacksquare":"\u25AA","blacktriangle":"\u25B4","blacktriangledown":"\u25BE","blacktriangleleft":"\u25C2","blacktriangleright":"\u25B8","blank":"\u2423","blk12":"\u2592","blk14":"\u2591","blk34":"\u2593","block":"\u2588","bne":"=\u20E5","bnequiv":"\u2261\u20E5","bNot":"\u2AED","bnot":"\u2310","Bopf":"\uD835\uDD39","bopf":"\uD835\uDD53","bot":"\u22A5","bottom":"\u22A5","bowtie":"\u22C8","boxbox":"\u29C9","boxdl":"\u2510","boxdL":"\u2555","boxDl":"\u2556","boxDL":"\u2557","boxdr":"\u250C","boxdR":"\u2552","boxDr":"\u2553","boxDR":"\u2554","boxh":"\u2500","boxH":"\u2550","boxhd":"\u252C","boxHd":"\u2564","boxhD":"\u2565","boxHD":"\u2566","boxhu":"\u2534","boxHu":"\u2567","boxhU":"\u2568","boxHU":"\u2569","boxminus":"\u229F","boxplus":"\u229E","boxtimes":"\u22A0","boxul":"\u2518","boxuL":"\u255B","boxUl":"\u255C","boxUL":"\u255D","boxur":"\u2514","boxuR":"\u2558","boxUr":"\u2559","boxUR":"\u255A","boxv":"\u2502","boxV":"\u2551","boxvh":"\u253C","boxvH":"\u256A","boxVh":"\u256B","boxVH":"\u256C","boxvl":"\u2524","boxvL":"\u2561","boxVl":"\u2562","boxVL":"\u2563","boxvr":"\u251C","boxvR":"\u255E","boxVr":"\u255F","boxVR":"\u2560","bprime":"\u2035","breve":"\u02D8","Breve":"\u02D8","brvbar":"\u00A6","bscr":"\uD835\uDCB7","Bscr":"\u212C","bsemi":"\u204F","bsim":"\u223D","bsime":"\u22CD","bsolb":"\u29C5","bsol":"\\","bsolhsub":"\u27C8","bull":"\u2022","bullet":"\u2022","bump":"\u224E","bumpE":"\u2AAE","bumpe":"\u224F","Bumpeq":"\u224E","bumpeq":"\u224F","Cacute":"\u0106","cacute":"\u0107","capand":"\u2A44","capbrcup":"\u2A49","capcap":"\u2A4B","cap":"\u2229","Cap":"\u22D2","capcup":"\u2A47","capdot":"\u2A40","CapitalDifferentialD":"\u2145","caps":"\u2229\uFE00","caret":"\u2041","caron":"\u02C7","Cayleys":"\u212D","ccaps":"\u2A4D","Ccaron":"\u010C","ccaron":"\u010D","Ccedil":"\u00C7","ccedil":"\u00E7","Ccirc":"\u0108","ccirc":"\u0109","Cconint":"\u2230","ccups":"\u2A4C","ccupssm":"\u2A50","Cdot":"\u010A","cdot":"\u010B","cedil":"\u00B8","Cedilla":"\u00B8","cemptyv":"\u29B2","cent":"\u00A2","centerdot":"\u00B7","CenterDot":"\u00B7","cfr":"\uD835\uDD20","Cfr":"\u212D","CHcy":"\u0427","chcy":"\u0447","check":"\u2713","checkmark":"\u2713","Chi":"\u03A7","chi":"\u03C7","circ":"\u02C6","circeq":"\u2257","circlearrowleft":"\u21BA","circlearrowright":"\u21BB","circledast":"\u229B","circledcirc":"\u229A","circleddash":"\u229D","CircleDot":"\u2299","circledR":"\u00AE","circledS":"\u24C8","CircleMinus":"\u2296","CirclePlus":"\u2295","CircleTimes":"\u2297","cir":"\u25CB","cirE":"\u29C3","cire":"\u2257","cirfnint":"\u2A10","cirmid":"\u2AEF","cirscir":"\u29C2","ClockwiseContourIntegral":"\u2232","CloseCurlyDoubleQuote":"\u201D","CloseCurlyQuote":"\u2019","clubs":"\u2663","clubsuit":"\u2663","colon":":","Colon":"\u2237","Colone":"\u2A74","colone":"\u2254","coloneq":"\u2254","comma":",","commat":"@","comp":"\u2201","compfn":"\u2218","complement":"\u2201","complexes":"\u2102","cong":"\u2245","congdot":"\u2A6D","Congruent":"\u2261","conint":"\u222E","Conint":"\u222F","ContourIntegral":"\u222E","copf":"\uD835\uDD54","Copf":"\u2102","coprod":"\u2210","Coproduct":"\u2210","copy":"\u00A9","COPY":"\u00A9","copysr":"\u2117","CounterClockwiseContourIntegral":"\u2233","crarr":"\u21B5","cross":"\u2717","Cross":"\u2A2F","Cscr":"\uD835\uDC9E","cscr":"\uD835\uDCB8","csub":"\u2ACF","csube":"\u2AD1","csup":"\u2AD0","csupe":"\u2AD2","ctdot":"\u22EF","cudarrl":"\u2938","cudarrr":"\u2935","cuepr":"\u22DE","cuesc":"\u22DF","cularr":"\u21B6","cularrp":"\u293D","cupbrcap":"\u2A48","cupcap":"\u2A46","CupCap":"\u224D","cup":"\u222A","Cup":"\u22D3","cupcup":"\u2A4A","cupdot":"\u228D","cupor":"\u2A45","cups":"\u222A\uFE00","curarr":"\u21B7","curarrm":"\u293C","curlyeqprec":"\u22DE","curlyeqsucc":"\u22DF","curlyvee":"\u22CE","curlywedge":"\u22CF","curren":"\u00A4","curvearrowleft":"\u21B6","curvearrowright":"\u21B7","cuvee":"\u22CE","cuwed":"\u22CF","cwconint":"\u2232","cwint":"\u2231","cylcty":"\u232D","dagger":"\u2020","Dagger":"\u2021","daleth":"\u2138","darr":"\u2193","Darr":"\u21A1","dArr":"\u21D3","dash":"\u2010","Dashv":"\u2AE4","dashv":"\u22A3","dbkarow":"\u290F","dblac":"\u02DD","Dcaron":"\u010E","dcaron":"\u010F","Dcy":"\u0414","dcy":"\u0434","ddagger":"\u2021","ddarr":"\u21CA","DD":"\u2145","dd":"\u2146","DDotrahd":"\u2911","ddotseq":"\u2A77","deg":"\u00B0","Del":"\u2207","Delta":"\u0394","delta":"\u03B4","demptyv":"\u29B1","dfisht":"\u297F","Dfr":"\uD835\uDD07","dfr":"\uD835\uDD21","dHar":"\u2965","dharl":"\u21C3","dharr":"\u21C2","DiacriticalAcute":"\u00B4","DiacriticalDot":"\u02D9","DiacriticalDoubleAcute":"\u02DD","DiacriticalGrave":"`","DiacriticalTilde":"\u02DC","diam":"\u22C4","diamond":"\u22C4","Diamond":"\u22C4","diamondsuit":"\u2666","diams":"\u2666","die":"\u00A8","DifferentialD":"\u2146","digamma":"\u03DD","disin":"\u22F2","div":"\u00F7","divide":"\u00F7","divideontimes":"\u22C7","divonx":"\u22C7","DJcy":"\u0402","djcy":"\u0452","dlcorn":"\u231E","dlcrop":"\u230D","dollar":"$","Dopf":"\uD835\uDD3B","dopf":"\uD835\uDD55","Dot":"\u00A8","dot":"\u02D9","DotDot":"\u20DC","doteq":"\u2250","doteqdot":"\u2251","DotEqual":"\u2250","dotminus":"\u2238","dotplus":"\u2214","dotsquare":"\u22A1","doublebarwedge":"\u2306","DoubleContourIntegral":"\u222F","DoubleDot":"\u00A8","DoubleDownArrow":"\u21D3","DoubleLeftArrow":"\u21D0","DoubleLeftRightArrow":"\u21D4","DoubleLeftTee":"\u2AE4","DoubleLongLeftArrow":"\u27F8","DoubleLongLeftRightArrow":"\u27FA","DoubleLongRightArrow":"\u27F9","DoubleRightArrow":"\u21D2","DoubleRightTee":"\u22A8","DoubleUpArrow":"\u21D1","DoubleUpDownArrow":"\u21D5","DoubleVerticalBar":"\u2225","DownArrowBar":"\u2913","downarrow":"\u2193","DownArrow":"\u2193","Downarrow":"\u21D3","DownArrowUpArrow":"\u21F5","DownBreve":"\u0311","downdownarrows":"\u21CA","downharpoonleft":"\u21C3","downharpoonright":"\u21C2","DownLeftRightVector":"\u2950","DownLeftTeeVector":"\u295E","DownLeftVectorBar":"\u2956","DownLeftVector":"\u21BD","DownRightTeeVector":"\u295F","DownRightVectorBar":"\u2957","DownRightVector":"\u21C1","DownTeeArrow":"\u21A7","DownTee":"\u22A4","drbkarow":"\u2910","drcorn":"\u231F","drcrop":"\u230C","Dscr":"\uD835\uDC9F","dscr":"\uD835\uDCB9","DScy":"\u0405","dscy":"\u0455","dsol":"\u29F6","Dstrok":"\u0110","dstrok":"\u0111","dtdot":"\u22F1","dtri":"\u25BF","dtrif":"\u25BE","duarr":"\u21F5","duhar":"\u296F","dwangle":"\u29A6","DZcy":"\u040F","dzcy":"\u045F","dzigrarr":"\u27FF","Eacute":"\u00C9","eacute":"\u00E9","easter":"\u2A6E","Ecaron":"\u011A","ecaron":"\u011B","Ecirc":"\u00CA","ecirc":"\u00EA","ecir":"\u2256","ecolon":"\u2255","Ecy":"\u042D","ecy":"\u044D","eDDot":"\u2A77","Edot":"\u0116","edot":"\u0117","eDot":"\u2251","ee":"\u2147","efDot":"\u2252","Efr":"\uD835\uDD08","efr":"\uD835\uDD22","eg":"\u2A9A","Egrave":"\u00C8","egrave":"\u00E8","egs":"\u2A96","egsdot":"\u2A98","el":"\u2A99","Element":"\u2208","elinters":"\u23E7","ell":"\u2113","els":"\u2A95","elsdot":"\u2A97","Emacr":"\u0112","emacr":"\u0113","empty":"\u2205","emptyset":"\u2205","EmptySmallSquare":"\u25FB","emptyv":"\u2205","EmptyVerySmallSquare":"\u25AB","emsp13":"\u2004","emsp14":"\u2005","emsp":"\u2003","ENG":"\u014A","eng":"\u014B","ensp":"\u2002","Eogon":"\u0118","eogon":"\u0119","Eopf":"\uD835\uDD3C","eopf":"\uD835\uDD56","epar":"\u22D5","eparsl":"\u29E3","eplus":"\u2A71","epsi":"\u03B5","Epsilon":"\u0395","epsilon":"\u03B5","epsiv":"\u03F5","eqcirc":"\u2256","eqcolon":"\u2255","eqsim":"\u2242","eqslantgtr":"\u2A96","eqslantless":"\u2A95","Equal":"\u2A75","equals":"=","EqualTilde":"\u2242","equest":"\u225F","Equilibrium":"\u21CC","equiv":"\u2261","equivDD":"\u2A78","eqvparsl":"\u29E5","erarr":"\u2971","erDot":"\u2253","escr":"\u212F","Escr":"\u2130","esdot":"\u2250","Esim":"\u2A73","esim":"\u2242","Eta":"\u0397","eta":"\u03B7","ETH":"\u00D0","eth":"\u00F0","Euml":"\u00CB","euml":"\u00EB","euro":"\u20AC","excl":"!","exist":"\u2203","Exists":"\u2203","expectation":"\u2130","exponentiale":"\u2147","ExponentialE":"\u2147","fallingdotseq":"\u2252","Fcy":"\u0424","fcy":"\u0444","female":"\u2640","ffilig":"\uFB03","fflig":"\uFB00","ffllig":"\uFB04","Ffr":"\uD835\uDD09","ffr":"\uD835\uDD23","filig":"\uFB01","FilledSmallSquare":"\u25FC","FilledVerySmallSquare":"\u25AA","fjlig":"fj","flat":"\u266D","fllig":"\uFB02","fltns":"\u25B1","fnof":"\u0192","Fopf":"\uD835\uDD3D","fopf":"\uD835\uDD57","forall":"\u2200","ForAll":"\u2200","fork":"\u22D4","forkv":"\u2AD9","Fouriertrf":"\u2131","fpartint":"\u2A0D","frac12":"\u00BD","frac13":"\u2153","frac14":"\u00BC","frac15":"\u2155","frac16":"\u2159","frac18":"\u215B","frac23":"\u2154","frac25":"\u2156","frac34":"\u00BE","frac35":"\u2157","frac38":"\u215C","frac45":"\u2158","frac56":"\u215A","frac58":"\u215D","frac78":"\u215E","frasl":"\u2044","frown":"\u2322","fscr":"\uD835\uDCBB","Fscr":"\u2131","gacute":"\u01F5","Gamma":"\u0393","gamma":"\u03B3","Gammad":"\u03DC","gammad":"\u03DD","gap":"\u2A86","Gbreve":"\u011E","gbreve":"\u011F","Gcedil":"\u0122","Gcirc":"\u011C","gcirc":"\u011D","Gcy":"\u0413","gcy":"\u0433","Gdot":"\u0120","gdot":"\u0121","ge":"\u2265","gE":"\u2267","gEl":"\u2A8C","gel":"\u22DB","geq":"\u2265","geqq":"\u2267","geqslant":"\u2A7E","gescc":"\u2AA9","ges":"\u2A7E","gesdot":"\u2A80","gesdoto":"\u2A82","gesdotol":"\u2A84","gesl":"\u22DB\uFE00","gesles":"\u2A94","Gfr":"\uD835\uDD0A","gfr":"\uD835\uDD24","gg":"\u226B","Gg":"\u22D9","ggg":"\u22D9","gimel":"\u2137","GJcy":"\u0403","gjcy":"\u0453","gla":"\u2AA5","gl":"\u2277","glE":"\u2A92","glj":"\u2AA4","gnap":"\u2A8A","gnapprox":"\u2A8A","gne":"\u2A88","gnE":"\u2269","gneq":"\u2A88","gneqq":"\u2269","gnsim":"\u22E7","Gopf":"\uD835\uDD3E","gopf":"\uD835\uDD58","grave":"`","GreaterEqual":"\u2265","GreaterEqualLess":"\u22DB","GreaterFullEqual":"\u2267","GreaterGreater":"\u2AA2","GreaterLess":"\u2277","GreaterSlantEqual":"\u2A7E","GreaterTilde":"\u2273","Gscr":"\uD835\uDCA2","gscr":"\u210A","gsim":"\u2273","gsime":"\u2A8E","gsiml":"\u2A90","gtcc":"\u2AA7","gtcir":"\u2A7A","gt":">","GT":">","Gt":"\u226B","gtdot":"\u22D7","gtlPar":"\u2995","gtquest":"\u2A7C","gtrapprox":"\u2A86","gtrarr":"\u2978","gtrdot":"\u22D7","gtreqless":"\u22DB","gtreqqless":"\u2A8C","gtrless":"\u2277","gtrsim":"\u2273","gvertneqq":"\u2269\uFE00","gvnE":"\u2269\uFE00","Hacek":"\u02C7","hairsp":"\u200A","half":"\u00BD","hamilt":"\u210B","HARDcy":"\u042A","hardcy":"\u044A","harrcir":"\u2948","harr":"\u2194","hArr":"\u21D4","harrw":"\u21AD","Hat":"^","hbar":"\u210F","Hcirc":"\u0124","hcirc":"\u0125","hearts":"\u2665","heartsuit":"\u2665","hellip":"\u2026","hercon":"\u22B9","hfr":"\uD835\uDD25","Hfr":"\u210C","HilbertSpace":"\u210B","hksearow":"\u2925","hkswarow":"\u2926","hoarr":"\u21FF","homtht":"\u223B","hookleftarrow":"\u21A9","hookrightarrow":"\u21AA","hopf":"\uD835\uDD59","Hopf":"\u210D","horbar":"\u2015","HorizontalLine":"\u2500","hscr":"\uD835\uDCBD","Hscr":"\u210B","hslash":"\u210F","Hstrok":"\u0126","hstrok":"\u0127","HumpDownHump":"\u224E","HumpEqual":"\u224F","hybull":"\u2043","hyphen":"\u2010","Iacute":"\u00CD","iacute":"\u00ED","ic":"\u2063","Icirc":"\u00CE","icirc":"\u00EE","Icy":"\u0418","icy":"\u0438","Idot":"\u0130","IEcy":"\u0415","iecy":"\u0435","iexcl":"\u00A1","iff":"\u21D4","ifr":"\uD835\uDD26","Ifr":"\u2111","Igrave":"\u00CC","igrave":"\u00EC","ii":"\u2148","iiiint":"\u2A0C","iiint":"\u222D","iinfin":"\u29DC","iiota":"\u2129","IJlig":"\u0132","ijlig":"\u0133","Imacr":"\u012A","imacr":"\u012B","image":"\u2111","ImaginaryI":"\u2148","imagline":"\u2110","imagpart":"\u2111","imath":"\u0131","Im":"\u2111","imof":"\u22B7","imped":"\u01B5","Implies":"\u21D2","incare":"\u2105","in":"\u2208","infin":"\u221E","infintie":"\u29DD","inodot":"\u0131","intcal":"\u22BA","int":"\u222B","Int":"\u222C","integers":"\u2124","Integral":"\u222B","intercal":"\u22BA","Intersection":"\u22C2","intlarhk":"\u2A17","intprod":"\u2A3C","InvisibleComma":"\u2063","InvisibleTimes":"\u2062","IOcy":"\u0401","iocy":"\u0451","Iogon":"\u012E","iogon":"\u012F","Iopf":"\uD835\uDD40","iopf":"\uD835\uDD5A","Iota":"\u0399","iota":"\u03B9","iprod":"\u2A3C","iquest":"\u00BF","iscr":"\uD835\uDCBE","Iscr":"\u2110","isin":"\u2208","isindot":"\u22F5","isinE":"\u22F9","isins":"\u22F4","isinsv":"\u22F3","isinv":"\u2208","it":"\u2062","Itilde":"\u0128","itilde":"\u0129","Iukcy":"\u0406","iukcy":"\u0456","Iuml":"\u00CF","iuml":"\u00EF","Jcirc":"\u0134","jcirc":"\u0135","Jcy":"\u0419","jcy":"\u0439","Jfr":"\uD835\uDD0D","jfr":"\uD835\uDD27","jmath":"\u0237","Jopf":"\uD835\uDD41","jopf":"\uD835\uDD5B","Jscr":"\uD835\uDCA5","jscr":"\uD835\uDCBF","Jsercy":"\u0408","jsercy":"\u0458","Jukcy":"\u0404","jukcy":"\u0454","Kappa":"\u039A","kappa":"\u03BA","kappav":"\u03F0","Kcedil":"\u0136","kcedil":"\u0137","Kcy":"\u041A","kcy":"\u043A","Kfr":"\uD835\uDD0E","kfr":"\uD835\uDD28","kgreen":"\u0138","KHcy":"\u0425","khcy":"\u0445","KJcy":"\u040C","kjcy":"\u045C","Kopf":"\uD835\uDD42","kopf":"\uD835\uDD5C","Kscr":"\uD835\uDCA6","kscr":"\uD835\uDCC0","lAarr":"\u21DA","Lacute":"\u0139","lacute":"\u013A","laemptyv":"\u29B4","lagran":"\u2112","Lambda":"\u039B","lambda":"\u03BB","lang":"\u27E8","Lang":"\u27EA","langd":"\u2991","langle":"\u27E8","lap":"\u2A85","Laplacetrf":"\u2112","laquo":"\u00AB","larrb":"\u21E4","larrbfs":"\u291F","larr":"\u2190","Larr":"\u219E","lArr":"\u21D0","larrfs":"\u291D","larrhk":"\u21A9","larrlp":"\u21AB","larrpl":"\u2939","larrsim":"\u2973","larrtl":"\u21A2","latail":"\u2919","lAtail":"\u291B","lat":"\u2AAB","late":"\u2AAD","lates":"\u2AAD\uFE00","lbarr":"\u290C","lBarr":"\u290E","lbbrk":"\u2772","lbrace":"{","lbrack":"[","lbrke":"\u298B","lbrksld":"\u298F","lbrkslu":"\u298D","Lcaron":"\u013D","lcaron":"\u013E","Lcedil":"\u013B","lcedil":"\u013C","lceil":"\u2308","lcub":"{","Lcy":"\u041B","lcy":"\u043B","ldca":"\u2936","ldquo":"\u201C","ldquor":"\u201E","ldrdhar":"\u2967","ldrushar":"\u294B","ldsh":"\u21B2","le":"\u2264","lE":"\u2266","LeftAngleBracket":"\u27E8","LeftArrowBar":"\u21E4","leftarrow":"\u2190","LeftArrow":"\u2190","Leftarrow":"\u21D0","LeftArrowRightArrow":"\u21C6","leftarrowtail":"\u21A2","LeftCeiling":"\u2308","LeftDoubleBracket":"\u27E6","LeftDownTeeVector":"\u2961","LeftDownVectorBar":"\u2959","LeftDownVector":"\u21C3","LeftFloor":"\u230A","leftharpoondown":"\u21BD","leftharpoonup":"\u21BC","leftleftarrows":"\u21C7","leftrightarrow":"\u2194","LeftRightArrow":"\u2194","Leftrightarrow":"\u21D4","leftrightarrows":"\u21C6","leftrightharpoons":"\u21CB","leftrightsquigarrow":"\u21AD","LeftRightVector":"\u294E","LeftTeeArrow":"\u21A4","LeftTee":"\u22A3","LeftTeeVector":"\u295A","leftthreetimes":"\u22CB","LeftTriangleBar":"\u29CF","LeftTriangle":"\u22B2","LeftTriangleEqual":"\u22B4","LeftUpDownVector":"\u2951","LeftUpTeeVector":"\u2960","LeftUpVectorBar":"\u2958","LeftUpVector":"\u21BF","LeftVectorBar":"\u2952","LeftVector":"\u21BC","lEg":"\u2A8B","leg":"\u22DA","leq":"\u2264","leqq":"\u2266","leqslant":"\u2A7D","lescc":"\u2AA8","les":"\u2A7D","lesdot":"\u2A7F","lesdoto":"\u2A81","lesdotor":"\u2A83","lesg":"\u22DA\uFE00","lesges":"\u2A93","lessapprox":"\u2A85","lessdot":"\u22D6","lesseqgtr":"\u22DA","lesseqqgtr":"\u2A8B","LessEqualGreater":"\u22DA","LessFullEqual":"\u2266","LessGreater":"\u2276","lessgtr":"\u2276","LessLess":"\u2AA1","lesssim":"\u2272","LessSlantEqual":"\u2A7D","LessTilde":"\u2272","lfisht":"\u297C","lfloor":"\u230A","Lfr":"\uD835\uDD0F","lfr":"\uD835\uDD29","lg":"\u2276","lgE":"\u2A91","lHar":"\u2962","lhard":"\u21BD","lharu":"\u21BC","lharul":"\u296A","lhblk":"\u2584","LJcy":"\u0409","ljcy":"\u0459","llarr":"\u21C7","ll":"\u226A","Ll":"\u22D8","llcorner":"\u231E","Lleftarrow":"\u21DA","llhard":"\u296B","lltri":"\u25FA","Lmidot":"\u013F","lmidot":"\u0140","lmoustache":"\u23B0","lmoust":"\u23B0","lnap":"\u2A89","lnapprox":"\u2A89","lne":"\u2A87","lnE":"\u2268","lneq":"\u2A87","lneqq":"\u2268","lnsim":"\u22E6","loang":"\u27EC","loarr":"\u21FD","lobrk":"\u27E6","longleftarrow":"\u27F5","LongLeftArrow":"\u27F5","Longleftarrow":"\u27F8","longleftrightarrow":"\u27F7","LongLeftRightArrow":"\u27F7","Longleftrightarrow":"\u27FA","longmapsto":"\u27FC","longrightarrow":"\u27F6","LongRightArrow":"\u27F6","Longrightarrow":"\u27F9","looparrowleft":"\u21AB","looparrowright":"\u21AC","lopar":"\u2985","Lopf":"\uD835\uDD43","lopf":"\uD835\uDD5D","loplus":"\u2A2D","lotimes":"\u2A34","lowast":"\u2217","lowbar":"_","LowerLeftArrow":"\u2199","LowerRightArrow":"\u2198","loz":"\u25CA","lozenge":"\u25CA","lozf":"\u29EB","lpar":"(","lparlt":"\u2993","lrarr":"\u21C6","lrcorner":"\u231F","lrhar":"\u21CB","lrhard":"\u296D","lrm":"\u200E","lrtri":"\u22BF","lsaquo":"\u2039","lscr":"\uD835\uDCC1","Lscr":"\u2112","lsh":"\u21B0","Lsh":"\u21B0","lsim":"\u2272","lsime":"\u2A8D","lsimg":"\u2A8F","lsqb":"[","lsquo":"\u2018","lsquor":"\u201A","Lstrok":"\u0141","lstrok":"\u0142","ltcc":"\u2AA6","ltcir":"\u2A79","lt":"<","LT":"<","Lt":"\u226A","ltdot":"\u22D6","lthree":"\u22CB","ltimes":"\u22C9","ltlarr":"\u2976","ltquest":"\u2A7B","ltri":"\u25C3","ltrie":"\u22B4","ltrif":"\u25C2","ltrPar":"\u2996","lurdshar":"\u294A","luruhar":"\u2966","lvertneqq":"\u2268\uFE00","lvnE":"\u2268\uFE00","macr":"\u00AF","male":"\u2642","malt":"\u2720","maltese":"\u2720","Map":"\u2905","map":"\u21A6","mapsto":"\u21A6","mapstodown":"\u21A7","mapstoleft":"\u21A4","mapstoup":"\u21A5","marker":"\u25AE","mcomma":"\u2A29","Mcy":"\u041C","mcy":"\u043C","mdash":"\u2014","mDDot":"\u223A","measuredangle":"\u2221","MediumSpace":"\u205F","Mellintrf":"\u2133","Mfr":"\uD835\uDD10","mfr":"\uD835\uDD2A","mho":"\u2127","micro":"\u00B5","midast":"*","midcir":"\u2AF0","mid":"\u2223","middot":"\u00B7","minusb":"\u229F","minus":"\u2212","minusd":"\u2238","minusdu":"\u2A2A","MinusPlus":"\u2213","mlcp":"\u2ADB","mldr":"\u2026","mnplus":"\u2213","models":"\u22A7","Mopf":"\uD835\uDD44","mopf":"\uD835\uDD5E","mp":"\u2213","mscr":"\uD835\uDCC2","Mscr":"\u2133","mstpos":"\u223E","Mu":"\u039C","mu":"\u03BC","multimap":"\u22B8","mumap":"\u22B8","nabla":"\u2207","Nacute":"\u0143","nacute":"\u0144","nang":"\u2220\u20D2","nap":"\u2249","napE":"\u2A70\u0338","napid":"\u224B\u0338","napos":"\u0149","napprox":"\u2249","natural":"\u266E","naturals":"\u2115","natur":"\u266E","nbsp":"\u00A0","nbump":"\u224E\u0338","nbumpe":"\u224F\u0338","ncap":"\u2A43","Ncaron":"\u0147","ncaron":"\u0148","Ncedil":"\u0145","ncedil":"\u0146","ncong":"\u2247","ncongdot":"\u2A6D\u0338","ncup":"\u2A42","Ncy":"\u041D","ncy":"\u043D","ndash":"\u2013","nearhk":"\u2924","nearr":"\u2197","neArr":"\u21D7","nearrow":"\u2197","ne":"\u2260","nedot":"\u2250\u0338","NegativeMediumSpace":"\u200B","NegativeThickSpace":"\u200B","NegativeThinSpace":"\u200B","NegativeVeryThinSpace":"\u200B","nequiv":"\u2262","nesear":"\u2928","nesim":"\u2242\u0338","NestedGreaterGreater":"\u226B","NestedLessLess":"\u226A","NewLine":"\n","nexist":"\u2204","nexists":"\u2204","Nfr":"\uD835\uDD11","nfr":"\uD835\uDD2B","ngE":"\u2267\u0338","nge":"\u2271","ngeq":"\u2271","ngeqq":"\u2267\u0338","ngeqslant":"\u2A7E\u0338","nges":"\u2A7E\u0338","nGg":"\u22D9\u0338","ngsim":"\u2275","nGt":"\u226B\u20D2","ngt":"\u226F","ngtr":"\u226F","nGtv":"\u226B\u0338","nharr":"\u21AE","nhArr":"\u21CE","nhpar":"\u2AF2","ni":"\u220B","nis":"\u22FC","nisd":"\u22FA","niv":"\u220B","NJcy":"\u040A","njcy":"\u045A","nlarr":"\u219A","nlArr":"\u21CD","nldr":"\u2025","nlE":"\u2266\u0338","nle":"\u2270","nleftarrow":"\u219A","nLeftarrow":"\u21CD","nleftrightarrow":"\u21AE","nLeftrightarrow":"\u21CE","nleq":"\u2270","nleqq":"\u2266\u0338","nleqslant":"\u2A7D\u0338","nles":"\u2A7D\u0338","nless":"\u226E","nLl":"\u22D8\u0338","nlsim":"\u2274","nLt":"\u226A\u20D2","nlt":"\u226E","nltri":"\u22EA","nltrie":"\u22EC","nLtv":"\u226A\u0338","nmid":"\u2224","NoBreak":"\u2060","NonBreakingSpace":"\u00A0","nopf":"\uD835\uDD5F","Nopf":"\u2115","Not":"\u2AEC","not":"\u00AC","NotCongruent":"\u2262","NotCupCap":"\u226D","NotDoubleVerticalBar":"\u2226","NotElement":"\u2209","NotEqual":"\u2260","NotEqualTilde":"\u2242\u0338","NotExists":"\u2204","NotGreater":"\u226F","NotGreaterEqual":"\u2271","NotGreaterFullEqual":"\u2267\u0338","NotGreaterGreater":"\u226B\u0338","NotGreaterLess":"\u2279","NotGreaterSlantEqual":"\u2A7E\u0338","NotGreaterTilde":"\u2275","NotHumpDownHump":"\u224E\u0338","NotHumpEqual":"\u224F\u0338","notin":"\u2209","notindot":"\u22F5\u0338","notinE":"\u22F9\u0338","notinva":"\u2209","notinvb":"\u22F7","notinvc":"\u22F6","NotLeftTriangleBar":"\u29CF\u0338","NotLeftTriangle":"\u22EA","NotLeftTriangleEqual":"\u22EC","NotLess":"\u226E","NotLessEqual":"\u2270","NotLessGreater":"\u2278","NotLessLess":"\u226A\u0338","NotLessSlantEqual":"\u2A7D\u0338","NotLessTilde":"\u2274","NotNestedGreaterGreater":"\u2AA2\u0338","NotNestedLessLess":"\u2AA1\u0338","notni":"\u220C","notniva":"\u220C","notnivb":"\u22FE","notnivc":"\u22FD","NotPrecedes":"\u2280","NotPrecedesEqual":"\u2AAF\u0338","NotPrecedesSlantEqual":"\u22E0","NotReverseElement":"\u220C","NotRightTriangleBar":"\u29D0\u0338","NotRightTriangle":"\u22EB","NotRightTriangleEqual":"\u22ED","NotSquareSubset":"\u228F\u0338","NotSquareSubsetEqual":"\u22E2","NotSquareSuperset":"\u2290\u0338","NotSquareSupersetEqual":"\u22E3","NotSubset":"\u2282\u20D2","NotSubsetEqual":"\u2288","NotSucceeds":"\u2281","NotSucceedsEqual":"\u2AB0\u0338","NotSucceedsSlantEqual":"\u22E1","NotSucceedsTilde":"\u227F\u0338","NotSuperset":"\u2283\u20D2","NotSupersetEqual":"\u2289","NotTilde":"\u2241","NotTildeEqual":"\u2244","NotTildeFullEqual":"\u2247","NotTildeTilde":"\u2249","NotVerticalBar":"\u2224","nparallel":"\u2226","npar":"\u2226","nparsl":"\u2AFD\u20E5","npart":"\u2202\u0338","npolint":"\u2A14","npr":"\u2280","nprcue":"\u22E0","nprec":"\u2280","npreceq":"\u2AAF\u0338","npre":"\u2AAF\u0338","nrarrc":"\u2933\u0338","nrarr":"\u219B","nrArr":"\u21CF","nrarrw":"\u219D\u0338","nrightarrow":"\u219B","nRightarrow":"\u21CF","nrtri":"\u22EB","nrtrie":"\u22ED","nsc":"\u2281","nsccue":"\u22E1","nsce":"\u2AB0\u0338","Nscr":"\uD835\uDCA9","nscr":"\uD835\uDCC3","nshortmid":"\u2224","nshortparallel":"\u2226","nsim":"\u2241","nsime":"\u2244","nsimeq":"\u2244","nsmid":"\u2224","nspar":"\u2226","nsqsube":"\u22E2","nsqsupe":"\u22E3","nsub":"\u2284","nsubE":"\u2AC5\u0338","nsube":"\u2288","nsubset":"\u2282\u20D2","nsubseteq":"\u2288","nsubseteqq":"\u2AC5\u0338","nsucc":"\u2281","nsucceq":"\u2AB0\u0338","nsup":"\u2285","nsupE":"\u2AC6\u0338","nsupe":"\u2289","nsupset":"\u2283\u20D2","nsupseteq":"\u2289","nsupseteqq":"\u2AC6\u0338","ntgl":"\u2279","Ntilde":"\u00D1","ntilde":"\u00F1","ntlg":"\u2278","ntriangleleft":"\u22EA","ntrianglelefteq":"\u22EC","ntriangleright":"\u22EB","ntrianglerighteq":"\u22ED","Nu":"\u039D","nu":"\u03BD","num":"#","numero":"\u2116","numsp":"\u2007","nvap":"\u224D\u20D2","nvdash":"\u22AC","nvDash":"\u22AD","nVdash":"\u22AE","nVDash":"\u22AF","nvge":"\u2265\u20D2","nvgt":">\u20D2","nvHarr":"\u2904","nvinfin":"\u29DE","nvlArr":"\u2902","nvle":"\u2264\u20D2","nvlt":"<\u20D2","nvltrie":"\u22B4\u20D2","nvrArr":"\u2903","nvrtrie":"\u22B5\u20D2","nvsim":"\u223C\u20D2","nwarhk":"\u2923","nwarr":"\u2196","nwArr":"\u21D6","nwarrow":"\u2196","nwnear":"\u2927","Oacute":"\u00D3","oacute":"\u00F3","oast":"\u229B","Ocirc":"\u00D4","ocirc":"\u00F4","ocir":"\u229A","Ocy":"\u041E","ocy":"\u043E","odash":"\u229D","Odblac":"\u0150","odblac":"\u0151","odiv":"\u2A38","odot":"\u2299","odsold":"\u29BC","OElig":"\u0152","oelig":"\u0153","ofcir":"\u29BF","Ofr":"\uD835\uDD12","ofr":"\uD835\uDD2C","ogon":"\u02DB","Ograve":"\u00D2","ograve":"\u00F2","ogt":"\u29C1","ohbar":"\u29B5","ohm":"\u03A9","oint":"\u222E","olarr":"\u21BA","olcir":"\u29BE","olcross":"\u29BB","oline":"\u203E","olt":"\u29C0","Omacr":"\u014C","omacr":"\u014D","Omega":"\u03A9","omega":"\u03C9","Omicron":"\u039F","omicron":"\u03BF","omid":"\u29B6","ominus":"\u2296","Oopf":"\uD835\uDD46","oopf":"\uD835\uDD60","opar":"\u29B7","OpenCurlyDoubleQuote":"\u201C","OpenCurlyQuote":"\u2018","operp":"\u29B9","oplus":"\u2295","orarr":"\u21BB","Or":"\u2A54","or":"\u2228","ord":"\u2A5D","order":"\u2134","orderof":"\u2134","ordf":"\u00AA","ordm":"\u00BA","origof":"\u22B6","oror":"\u2A56","orslope":"\u2A57","orv":"\u2A5B","oS":"\u24C8","Oscr":"\uD835\uDCAA","oscr":"\u2134","Oslash":"\u00D8","oslash":"\u00F8","osol":"\u2298","Otilde":"\u00D5","otilde":"\u00F5","otimesas":"\u2A36","Otimes":"\u2A37","otimes":"\u2297","Ouml":"\u00D6","ouml":"\u00F6","ovbar":"\u233D","OverBar":"\u203E","OverBrace":"\u23DE","OverBracket":"\u23B4","OverParenthesis":"\u23DC","para":"\u00B6","parallel":"\u2225","par":"\u2225","parsim":"\u2AF3","parsl":"\u2AFD","part":"\u2202","PartialD":"\u2202","Pcy":"\u041F","pcy":"\u043F","percnt":"%","period":".","permil":"\u2030","perp":"\u22A5","pertenk":"\u2031","Pfr":"\uD835\uDD13","pfr":"\uD835\uDD2D","Phi":"\u03A6","phi":"\u03C6","phiv":"\u03D5","phmmat":"\u2133","phone":"\u260E","Pi":"\u03A0","pi":"\u03C0","pitchfork":"\u22D4","piv":"\u03D6","planck":"\u210F","planckh":"\u210E","plankv":"\u210F","plusacir":"\u2A23","plusb":"\u229E","pluscir":"\u2A22","plus":"+","plusdo":"\u2214","plusdu":"\u2A25","pluse":"\u2A72","PlusMinus":"\u00B1","plusmn":"\u00B1","plussim":"\u2A26","plustwo":"\u2A27","pm":"\u00B1","Poincareplane":"\u210C","pointint":"\u2A15","popf":"\uD835\uDD61","Popf":"\u2119","pound":"\u00A3","prap":"\u2AB7","Pr":"\u2ABB","pr":"\u227A","prcue":"\u227C","precapprox":"\u2AB7","prec":"\u227A","preccurlyeq":"\u227C","Precedes":"\u227A","PrecedesEqual":"\u2AAF","PrecedesSlantEqual":"\u227C","PrecedesTilde":"\u227E","preceq":"\u2AAF","precnapprox":"\u2AB9","precneqq":"\u2AB5","precnsim":"\u22E8","pre":"\u2AAF","prE":"\u2AB3","precsim":"\u227E","prime":"\u2032","Prime":"\u2033","primes":"\u2119","prnap":"\u2AB9","prnE":"\u2AB5","prnsim":"\u22E8","prod":"\u220F","Product":"\u220F","profalar":"\u232E","profline":"\u2312","profsurf":"\u2313","prop":"\u221D","Proportional":"\u221D","Proportion":"\u2237","propto":"\u221D","prsim":"\u227E","prurel":"\u22B0","Pscr":"\uD835\uDCAB","pscr":"\uD835\uDCC5","Psi":"\u03A8","psi":"\u03C8","puncsp":"\u2008","Qfr":"\uD835\uDD14","qfr":"\uD835\uDD2E","qint":"\u2A0C","qopf":"\uD835\uDD62","Qopf":"\u211A","qprime":"\u2057","Qscr":"\uD835\uDCAC","qscr":"\uD835\uDCC6","quaternions":"\u210D","quatint":"\u2A16","quest":"?","questeq":"\u225F","quot":"\"","QUOT":"\"","rAarr":"\u21DB","race":"\u223D\u0331","Racute":"\u0154","racute":"\u0155","radic":"\u221A","raemptyv":"\u29B3","rang":"\u27E9","Rang":"\u27EB","rangd":"\u2992","range":"\u29A5","rangle":"\u27E9","raquo":"\u00BB","rarrap":"\u2975","rarrb":"\u21E5","rarrbfs":"\u2920","rarrc":"\u2933","rarr":"\u2192","Rarr":"\u21A0","rArr":"\u21D2","rarrfs":"\u291E","rarrhk":"\u21AA","rarrlp":"\u21AC","rarrpl":"\u2945","rarrsim":"\u2974","Rarrtl":"\u2916","rarrtl":"\u21A3","rarrw":"\u219D","ratail":"\u291A","rAtail":"\u291C","ratio":"\u2236","rationals":"\u211A","rbarr":"\u290D","rBarr":"\u290F","RBarr":"\u2910","rbbrk":"\u2773","rbrace":"}","rbrack":"]","rbrke":"\u298C","rbrksld":"\u298E","rbrkslu":"\u2990","Rcaron":"\u0158","rcaron":"\u0159","Rcedil":"\u0156","rcedil":"\u0157","rceil":"\u2309","rcub":"}","Rcy":"\u0420","rcy":"\u0440","rdca":"\u2937","rdldhar":"\u2969","rdquo":"\u201D","rdquor":"\u201D","rdsh":"\u21B3","real":"\u211C","realine":"\u211B","realpart":"\u211C","reals":"\u211D","Re":"\u211C","rect":"\u25AD","reg":"\u00AE","REG":"\u00AE","ReverseElement":"\u220B","ReverseEquilibrium":"\u21CB","ReverseUpEquilibrium":"\u296F","rfisht":"\u297D","rfloor":"\u230B","rfr":"\uD835\uDD2F","Rfr":"\u211C","rHar":"\u2964","rhard":"\u21C1","rharu":"\u21C0","rharul":"\u296C","Rho":"\u03A1","rho":"\u03C1","rhov":"\u03F1","RightAngleBracket":"\u27E9","RightArrowBar":"\u21E5","rightarrow":"\u2192","RightArrow":"\u2192","Rightarrow":"\u21D2","RightArrowLeftArrow":"\u21C4","rightarrowtail":"\u21A3","RightCeiling":"\u2309","RightDoubleBracket":"\u27E7","RightDownTeeVector":"\u295D","RightDownVectorBar":"\u2955","RightDownVector":"\u21C2","RightFloor":"\u230B","rightharpoondown":"\u21C1","rightharpoonup":"\u21C0","rightleftarrows":"\u21C4","rightleftharpoons":"\u21CC","rightrightarrows":"\u21C9","rightsquigarrow":"\u219D","RightTeeArrow":"\u21A6","RightTee":"\u22A2","RightTeeVector":"\u295B","rightthreetimes":"\u22CC","RightTriangleBar":"\u29D0","RightTriangle":"\u22B3","RightTriangleEqual":"\u22B5","RightUpDownVector":"\u294F","RightUpTeeVector":"\u295C","RightUpVectorBar":"\u2954","RightUpVector":"\u21BE","RightVectorBar":"\u2953","RightVector":"\u21C0","ring":"\u02DA","risingdotseq":"\u2253","rlarr":"\u21C4","rlhar":"\u21CC","rlm":"\u200F","rmoustache":"\u23B1","rmoust":"\u23B1","rnmid":"\u2AEE","roang":"\u27ED","roarr":"\u21FE","robrk":"\u27E7","ropar":"\u2986","ropf":"\uD835\uDD63","Ropf":"\u211D","roplus":"\u2A2E","rotimes":"\u2A35","RoundImplies":"\u2970","rpar":")","rpargt":"\u2994","rppolint":"\u2A12","rrarr":"\u21C9","Rrightarrow":"\u21DB","rsaquo":"\u203A","rscr":"\uD835\uDCC7","Rscr":"\u211B","rsh":"\u21B1","Rsh":"\u21B1","rsqb":"]","rsquo":"\u2019","rsquor":"\u2019","rthree":"\u22CC","rtimes":"\u22CA","rtri":"\u25B9","rtrie":"\u22B5","rtrif":"\u25B8","rtriltri":"\u29CE","RuleDelayed":"\u29F4","ruluhar":"\u2968","rx":"\u211E","Sacute":"\u015A","sacute":"\u015B","sbquo":"\u201A","scap":"\u2AB8","Scaron":"\u0160","scaron":"\u0161","Sc":"\u2ABC","sc":"\u227B","sccue":"\u227D","sce":"\u2AB0","scE":"\u2AB4","Scedil":"\u015E","scedil":"\u015F","Scirc":"\u015C","scirc":"\u015D","scnap":"\u2ABA","scnE":"\u2AB6","scnsim":"\u22E9","scpolint":"\u2A13","scsim":"\u227F","Scy":"\u0421","scy":"\u0441","sdotb":"\u22A1","sdot":"\u22C5","sdote":"\u2A66","searhk":"\u2925","searr":"\u2198","seArr":"\u21D8","searrow":"\u2198","sect":"\u00A7","semi":";","seswar":"\u2929","setminus":"\u2216","setmn":"\u2216","sext":"\u2736","Sfr":"\uD835\uDD16","sfr":"\uD835\uDD30","sfrown":"\u2322","sharp":"\u266F","SHCHcy":"\u0429","shchcy":"\u0449","SHcy":"\u0428","shcy":"\u0448","ShortDownArrow":"\u2193","ShortLeftArrow":"\u2190","shortmid":"\u2223","shortparallel":"\u2225","ShortRightArrow":"\u2192","ShortUpArrow":"\u2191","shy":"\u00AD","Sigma":"\u03A3","sigma":"\u03C3","sigmaf":"\u03C2","sigmav":"\u03C2","sim":"\u223C","simdot":"\u2A6A","sime":"\u2243","simeq":"\u2243","simg":"\u2A9E","simgE":"\u2AA0","siml":"\u2A9D","simlE":"\u2A9F","simne":"\u2246","simplus":"\u2A24","simrarr":"\u2972","slarr":"\u2190","SmallCircle":"\u2218","smallsetminus":"\u2216","smashp":"\u2A33","smeparsl":"\u29E4","smid":"\u2223","smile":"\u2323","smt":"\u2AAA","smte":"\u2AAC","smtes":"\u2AAC\uFE00","SOFTcy":"\u042C","softcy":"\u044C","solbar":"\u233F","solb":"\u29C4","sol":"/","Sopf":"\uD835\uDD4A","sopf":"\uD835\uDD64","spades":"\u2660","spadesuit":"\u2660","spar":"\u2225","sqcap":"\u2293","sqcaps":"\u2293\uFE00","sqcup":"\u2294","sqcups":"\u2294\uFE00","Sqrt":"\u221A","sqsub":"\u228F","sqsube":"\u2291","sqsubset":"\u228F","sqsubseteq":"\u2291","sqsup":"\u2290","sqsupe":"\u2292","sqsupset":"\u2290","sqsupseteq":"\u2292","square":"\u25A1","Square":"\u25A1","SquareIntersection":"\u2293","SquareSubset":"\u228F","SquareSubsetEqual":"\u2291","SquareSuperset":"\u2290","SquareSupersetEqual":"\u2292","SquareUnion":"\u2294","squarf":"\u25AA","squ":"\u25A1","squf":"\u25AA","srarr":"\u2192","Sscr":"\uD835\uDCAE","sscr":"\uD835\uDCC8","ssetmn":"\u2216","ssmile":"\u2323","sstarf":"\u22C6","Star":"\u22C6","star":"\u2606","starf":"\u2605","straightepsilon":"\u03F5","straightphi":"\u03D5","strns":"\u00AF","sub":"\u2282","Sub":"\u22D0","subdot":"\u2ABD","subE":"\u2AC5","sube":"\u2286","subedot":"\u2AC3","submult":"\u2AC1","subnE":"\u2ACB","subne":"\u228A","subplus":"\u2ABF","subrarr":"\u2979","subset":"\u2282","Subset":"\u22D0","subseteq":"\u2286","subseteqq":"\u2AC5","SubsetEqual":"\u2286","subsetneq":"\u228A","subsetneqq":"\u2ACB","subsim":"\u2AC7","subsub":"\u2AD5","subsup":"\u2AD3","succapprox":"\u2AB8","succ":"\u227B","succcurlyeq":"\u227D","Succeeds":"\u227B","SucceedsEqual":"\u2AB0","SucceedsSlantEqual":"\u227D","SucceedsTilde":"\u227F","succeq":"\u2AB0","succnapprox":"\u2ABA","succneqq":"\u2AB6","succnsim":"\u22E9","succsim":"\u227F","SuchThat":"\u220B","sum":"\u2211","Sum":"\u2211","sung":"\u266A","sup1":"\u00B9","sup2":"\u00B2","sup3":"\u00B3","sup":"\u2283","Sup":"\u22D1","supdot":"\u2ABE","supdsub":"\u2AD8","supE":"\u2AC6","supe":"\u2287","supedot":"\u2AC4","Superset":"\u2283","SupersetEqual":"\u2287","suphsol":"\u27C9","suphsub":"\u2AD7","suplarr":"\u297B","supmult":"\u2AC2","supnE":"\u2ACC","supne":"\u228B","supplus":"\u2AC0","supset":"\u2283","Supset":"\u22D1","supseteq":"\u2287","supseteqq":"\u2AC6","supsetneq":"\u228B","supsetneqq":"\u2ACC","supsim":"\u2AC8","supsub":"\u2AD4","supsup":"\u2AD6","swarhk":"\u2926","swarr":"\u2199","swArr":"\u21D9","swarrow":"\u2199","swnwar":"\u292A","szlig":"\u00DF","Tab":"\t","target":"\u2316","Tau":"\u03A4","tau":"\u03C4","tbrk":"\u23B4","Tcaron":"\u0164","tcaron":"\u0165","Tcedil":"\u0162","tcedil":"\u0163","Tcy":"\u0422","tcy":"\u0442","tdot":"\u20DB","telrec":"\u2315","Tfr":"\uD835\uDD17","tfr":"\uD835\uDD31","there4":"\u2234","therefore":"\u2234","Therefore":"\u2234","Theta":"\u0398","theta":"\u03B8","thetasym":"\u03D1","thetav":"\u03D1","thickapprox":"\u2248","thicksim":"\u223C","ThickSpace":"\u205F\u200A","ThinSpace":"\u2009","thinsp":"\u2009","thkap":"\u2248","thksim":"\u223C","THORN":"\u00DE","thorn":"\u00FE","tilde":"\u02DC","Tilde":"\u223C","TildeEqual":"\u2243","TildeFullEqual":"\u2245","TildeTilde":"\u2248","timesbar":"\u2A31","timesb":"\u22A0","times":"\u00D7","timesd":"\u2A30","tint":"\u222D","toea":"\u2928","topbot":"\u2336","topcir":"\u2AF1","top":"\u22A4","Topf":"\uD835\uDD4B","topf":"\uD835\uDD65","topfork":"\u2ADA","tosa":"\u2929","tprime":"\u2034","trade":"\u2122","TRADE":"\u2122","triangle":"\u25B5","triangledown":"\u25BF","triangleleft":"\u25C3","trianglelefteq":"\u22B4","triangleq":"\u225C","triangleright":"\u25B9","trianglerighteq":"\u22B5","tridot":"\u25EC","trie":"\u225C","triminus":"\u2A3A","TripleDot":"\u20DB","triplus":"\u2A39","trisb":"\u29CD","tritime":"\u2A3B","trpezium":"\u23E2","Tscr":"\uD835\uDCAF","tscr":"\uD835\uDCC9","TScy":"\u0426","tscy":"\u0446","TSHcy":"\u040B","tshcy":"\u045B","Tstrok":"\u0166","tstrok":"\u0167","twixt":"\u226C","twoheadleftarrow":"\u219E","twoheadrightarrow":"\u21A0","Uacute":"\u00DA","uacute":"\u00FA","uarr":"\u2191","Uarr":"\u219F","uArr":"\u21D1","Uarrocir":"\u2949","Ubrcy":"\u040E","ubrcy":"\u045E","Ubreve":"\u016C","ubreve":"\u016D","Ucirc":"\u00DB","ucirc":"\u00FB","Ucy":"\u0423","ucy":"\u0443","udarr":"\u21C5","Udblac":"\u0170","udblac":"\u0171","udhar":"\u296E","ufisht":"\u297E","Ufr":"\uD835\uDD18","ufr":"\uD835\uDD32","Ugrave":"\u00D9","ugrave":"\u00F9","uHar":"\u2963","uharl":"\u21BF","uharr":"\u21BE","uhblk":"\u2580","ulcorn":"\u231C","ulcorner":"\u231C","ulcrop":"\u230F","ultri":"\u25F8","Umacr":"\u016A","umacr":"\u016B","uml":"\u00A8","UnderBar":"_","UnderBrace":"\u23DF","UnderBracket":"\u23B5","UnderParenthesis":"\u23DD","Union":"\u22C3","UnionPlus":"\u228E","Uogon":"\u0172","uogon":"\u0173","Uopf":"\uD835\uDD4C","uopf":"\uD835\uDD66","UpArrowBar":"\u2912","uparrow":"\u2191","UpArrow":"\u2191","Uparrow":"\u21D1","UpArrowDownArrow":"\u21C5","updownarrow":"\u2195","UpDownArrow":"\u2195","Updownarrow":"\u21D5","UpEquilibrium":"\u296E","upharpoonleft":"\u21BF","upharpoonright":"\u21BE","uplus":"\u228E","UpperLeftArrow":"\u2196","UpperRightArrow":"\u2197","upsi":"\u03C5","Upsi":"\u03D2","upsih":"\u03D2","Upsilon":"\u03A5","upsilon":"\u03C5","UpTeeArrow":"\u21A5","UpTee":"\u22A5","upuparrows":"\u21C8","urcorn":"\u231D","urcorner":"\u231D","urcrop":"\u230E","Uring":"\u016E","uring":"\u016F","urtri":"\u25F9","Uscr":"\uD835\uDCB0","uscr":"\uD835\uDCCA","utdot":"\u22F0","Utilde":"\u0168","utilde":"\u0169","utri":"\u25B5","utrif":"\u25B4","uuarr":"\u21C8","Uuml":"\u00DC","uuml":"\u00FC","uwangle":"\u29A7","vangrt":"\u299C","varepsilon":"\u03F5","varkappa":"\u03F0","varnothing":"\u2205","varphi":"\u03D5","varpi":"\u03D6","varpropto":"\u221D","varr":"\u2195","vArr":"\u21D5","varrho":"\u03F1","varsigma":"\u03C2","varsubsetneq":"\u228A\uFE00","varsubsetneqq":"\u2ACB\uFE00","varsupsetneq":"\u228B\uFE00","varsupsetneqq":"\u2ACC\uFE00","vartheta":"\u03D1","vartriangleleft":"\u22B2","vartriangleright":"\u22B3","vBar":"\u2AE8","Vbar":"\u2AEB","vBarv":"\u2AE9","Vcy":"\u0412","vcy":"\u0432","vdash":"\u22A2","vDash":"\u22A8","Vdash":"\u22A9","VDash":"\u22AB","Vdashl":"\u2AE6","veebar":"\u22BB","vee":"\u2228","Vee":"\u22C1","veeeq":"\u225A","vellip":"\u22EE","verbar":"|","Verbar":"\u2016","vert":"|","Vert":"\u2016","VerticalBar":"\u2223","VerticalLine":"|","VerticalSeparator":"\u2758","VerticalTilde":"\u2240","VeryThinSpace":"\u200A","Vfr":"\uD835\uDD19","vfr":"\uD835\uDD33","vltri":"\u22B2","vnsub":"\u2282\u20D2","vnsup":"\u2283\u20D2","Vopf":"\uD835\uDD4D","vopf":"\uD835\uDD67","vprop":"\u221D","vrtri":"\u22B3","Vscr":"\uD835\uDCB1","vscr":"\uD835\uDCCB","vsubnE":"\u2ACB\uFE00","vsubne":"\u228A\uFE00","vsupnE":"\u2ACC\uFE00","vsupne":"\u228B\uFE00","Vvdash":"\u22AA","vzigzag":"\u299A","Wcirc":"\u0174","wcirc":"\u0175","wedbar":"\u2A5F","wedge":"\u2227","Wedge":"\u22C0","wedgeq":"\u2259","weierp":"\u2118","Wfr":"\uD835\uDD1A","wfr":"\uD835\uDD34","Wopf":"\uD835\uDD4E","wopf":"\uD835\uDD68","wp":"\u2118","wr":"\u2240","wreath":"\u2240","Wscr":"\uD835\uDCB2","wscr":"\uD835\uDCCC","xcap":"\u22C2","xcirc":"\u25EF","xcup":"\u22C3","xdtri":"\u25BD","Xfr":"\uD835\uDD1B","xfr":"\uD835\uDD35","xharr":"\u27F7","xhArr":"\u27FA","Xi":"\u039E","xi":"\u03BE","xlarr":"\u27F5","xlArr":"\u27F8","xmap":"\u27FC","xnis":"\u22FB","xodot":"\u2A00","Xopf":"\uD835\uDD4F","xopf":"\uD835\uDD69","xoplus":"\u2A01","xotime":"\u2A02","xrarr":"\u27F6","xrArr":"\u27F9","Xscr":"\uD835\uDCB3","xscr":"\uD835\uDCCD","xsqcup":"\u2A06","xuplus":"\u2A04","xutri":"\u25B3","xvee":"\u22C1","xwedge":"\u22C0","Yacute":"\u00DD","yacute":"\u00FD","YAcy":"\u042F","yacy":"\u044F","Ycirc":"\u0176","ycirc":"\u0177","Ycy":"\u042B","ycy":"\u044B","yen":"\u00A5","Yfr":"\uD835\uDD1C","yfr":"\uD835\uDD36","YIcy":"\u0407","yicy":"\u0457","Yopf":"\uD835\uDD50","yopf":"\uD835\uDD6A","Yscr":"\uD835\uDCB4","yscr":"\uD835\uDCCE","YUcy":"\u042E","yucy":"\u044E","yuml":"\u00FF","Yuml":"\u0178","Zacute":"\u0179","zacute":"\u017A","Zcaron":"\u017D","zcaron":"\u017E","Zcy":"\u0417","zcy":"\u0437","Zdot":"\u017B","zdot":"\u017C","zeetrf":"\u2128","ZeroWidthSpace":"\u200B","Zeta":"\u0396","zeta":"\u03B6","zfr":"\uD835\uDD37","Zfr":"\u2128","ZHcy":"\u0416","zhcy":"\u0436","zigrarr":"\u21DD","zopf":"\uD835\uDD6B","Zopf":"\u2124","Zscr":"\uD835\uDCB5","zscr":"\uD835\uDCCF","zwj":"\u200D","zwnj":"\u200C"}
},{}],84:[function(require,module,exports){
'use strict';


////////////////////////////////////////////////////////////////////////////////
// Helpers

// Merge objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = Array.prototype.slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return; }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}

function _class(obj) { return Object.prototype.toString.call(obj); }
function isString(obj) { return _class(obj) === '[object String]'; }
function isObject(obj) { return _class(obj) === '[object Object]'; }
function isRegExp(obj) { return _class(obj) === '[object RegExp]'; }
function isFunction(obj) { return _class(obj) === '[object Function]'; }


function escapeRE (str) { return str.replace(/[.?*+^$[\]\\(){}|-]/g, '\\$&'); }

////////////////////////////////////////////////////////////////////////////////


var defaultOptions = {
  fuzzyLink: true,
  fuzzyEmail: true,
  fuzzyIP: false
};


function isOptionsObj(obj) {
  return Object.keys(obj || {}).reduce(function (acc, k) {
    return acc || defaultOptions.hasOwnProperty(k);
  }, false);
}


var defaultSchemas = {
  'http:': {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.http) {
        // compile lazily, because "host"-containing variables can change on tlds update.
        self.re.http =  new RegExp(
          '^\\/\\/' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }
      if (self.re.http.test(tail)) {
        return tail.match(self.re.http)[0].length;
      }
      return 0;
    }
  },
  'https:':  'http:',
  'ftp:':    'http:',
  '//':      {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.no_http) {
      // compile lazily, becayse "host"-containing variables can change on tlds update.
        self.re.no_http =  new RegExp(
          '^' + self.re.src_auth + self.re.src_host_port_strict + self.re.src_path, 'i'
        );
      }

      if (self.re.no_http.test(tail)) {
        // should not be `://`, that protects from errors in protocol name
        if (pos >= 3 && text[pos - 3] === ':') { return 0; }
        return tail.match(self.re.no_http)[0].length;
      }
      return 0;
    }
  },
  'mailto:': {
    validate: function (text, pos, self) {
      var tail = text.slice(pos);

      if (!self.re.mailto) {
        self.re.mailto =  new RegExp(
          '^' + self.re.src_email_name + '@' + self.re.src_host_strict, 'i'
        );
      }
      if (self.re.mailto.test(tail)) {
        return tail.match(self.re.mailto)[0].length;
      }
      return 0;
    }
  }
};

/*eslint-disable max-len*/

// RE pattern for 2-character tlds (autogenerated by ./support/tlds_2char_gen.js)
var tlds_2ch_src_re = 'a[cdefgilmnoqrstuwxz]|b[abdefghijmnorstvwyz]|c[acdfghiklmnoruvwxyz]|d[ejkmoz]|e[cegrstu]|f[ijkmor]|g[abdefghilmnpqrstuwy]|h[kmnrtu]|i[delmnoqrst]|j[emop]|k[eghimnprwyz]|l[abcikrstuvy]|m[acdeghklmnopqrstuvwxyz]|n[acefgilopruz]|om|p[aefghklmnrstwy]|qa|r[eosuw]|s[abcdeghijklmnortuvxyz]|t[cdfghjklmnortvwz]|u[agksyz]|v[aceginu]|w[fs]|y[et]|z[amw]';

// DON'T try to make PRs with changes. Extend TLDs with LinkifyIt.tlds() instead
var tlds_default = 'biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф'.split('|');

/*eslint-enable max-len*/

////////////////////////////////////////////////////////////////////////////////

function resetScanCache(self) {
  self.__index__ = -1;
  self.__text_cache__   = '';
}

function createValidator(re) {
  return function (text, pos) {
    var tail = text.slice(pos);

    if (re.test(tail)) {
      return tail.match(re)[0].length;
    }
    return 0;
  };
}

function createNormalizer() {
  return function (match, self) {
    self.normalize(match);
  };
}

// Schemas compiler. Build regexps.
//
function compile(self) {

  // Load & clone RE patterns.
  var re = self.re = assign({}, require('./lib/re'));

  // Define dynamic patterns
  var tlds = self.__tlds__.slice();

  if (!self.__tlds_replaced__) {
    tlds.push(tlds_2ch_src_re);
  }
  tlds.push(re.src_xn);

  re.src_tlds = tlds.join('|');

  function untpl(tpl) { return tpl.replace('%TLDS%', re.src_tlds); }

  re.email_fuzzy      = RegExp(untpl(re.tpl_email_fuzzy), 'i');
  re.link_fuzzy       = RegExp(untpl(re.tpl_link_fuzzy), 'i');
  re.link_no_ip_fuzzy = RegExp(untpl(re.tpl_link_no_ip_fuzzy), 'i');
  re.host_fuzzy_test  = RegExp(untpl(re.tpl_host_fuzzy_test), 'i');

  //
  // Compile each schema
  //

  var aliases = [];

  self.__compiled__ = {}; // Reset compiled data

  function schemaError(name, val) {
    throw new Error('(LinkifyIt) Invalid schema "' + name + '": ' + val);
  }

  Object.keys(self.__schemas__).forEach(function (name) {
    var val = self.__schemas__[name];

    // skip disabled methods
    if (val === null) { return; }

    var compiled = { validate: null, link: null };

    self.__compiled__[name] = compiled;

    if (isObject(val)) {
      if (isRegExp(val.validate)) {
        compiled.validate = createValidator(val.validate);
      } else if (isFunction(val.validate)) {
        compiled.validate = val.validate;
      } else {
        schemaError(name, val);
      }

      if (isFunction(val.normalize)) {
        compiled.normalize = val.normalize;
      } else if (!val.normalize) {
        compiled.normalize = createNormalizer();
      } else {
        schemaError(name, val);
      }

      return;
    }

    if (isString(val)) {
      aliases.push(name);
      return;
    }

    schemaError(name, val);
  });

  //
  // Compile postponed aliases
  //

  aliases.forEach(function (alias) {
    if (!self.__compiled__[self.__schemas__[alias]]) {
      // Silently fail on missed schemas to avoid errons on disable.
      // schemaError(alias, self.__schemas__[alias]);
      return;
    }

    self.__compiled__[alias].validate =
      self.__compiled__[self.__schemas__[alias]].validate;
    self.__compiled__[alias].normalize =
      self.__compiled__[self.__schemas__[alias]].normalize;
  });

  //
  // Fake record for guessed links
  //
  self.__compiled__[''] = { validate: null, normalize: createNormalizer() };

  //
  // Build schema condition
  //
  var slist = Object.keys(self.__compiled__)
                      .filter(function(name) {
                        // Filter disabled & fake schemas
                        return name.length > 0 && self.__compiled__[name];
                      })
                      .map(escapeRE)
                      .join('|');
  // (?!_) cause 1.5x slowdown
  self.re.schema_test   = RegExp('(^|(?!_)(?:>|' + re.src_ZPCc + '))(' + slist + ')', 'i');
  self.re.schema_search = RegExp('(^|(?!_)(?:>|' + re.src_ZPCc + '))(' + slist + ')', 'ig');

  self.re.pretest       = RegExp(
                            '(' + self.re.schema_test.source + ')|' +
                            '(' + self.re.host_fuzzy_test.source + ')|' +
                            '@',
                            'i');

  //
  // Cleanup
  //

  resetScanCache(self);
}

/**
 * class Match
 *
 * Match result. Single element of array, returned by [[LinkifyIt#match]]
 **/
function Match(self, shift) {
  var start = self.__index__,
      end   = self.__last_index__,
      text  = self.__text_cache__.slice(start, end);

  /**
   * Match#schema -> String
   *
   * Prefix (protocol) for matched string.
   **/
  this.schema    = self.__schema__.toLowerCase();
  /**
   * Match#index -> Number
   *
   * First position of matched string.
   **/
  this.index     = start + shift;
  /**
   * Match#lastIndex -> Number
   *
   * Next position after matched string.
   **/
  this.lastIndex = end + shift;
  /**
   * Match#raw -> String
   *
   * Matched string.
   **/
  this.raw       = text;
  /**
   * Match#text -> String
   *
   * Notmalized text of matched string.
   **/
  this.text      = text;
  /**
   * Match#url -> String
   *
   * Normalized url of matched string.
   **/
  this.url       = text;
}

function createMatch(self, shift) {
  var match = new Match(self, shift);

  self.__compiled__[match.schema].normalize(match, self);

  return match;
}


/**
 * class LinkifyIt
 **/

/**
 * new LinkifyIt(schemas, options)
 * - schemas (Object): Optional. Additional schemas to validate (prefix/validator)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Creates new linkifier instance with optional additional schemas.
 * Can be called without `new` keyword for convenience.
 *
 * By default understands:
 *
 * - `http(s)://...` , `ftp://...`, `mailto:...` & `//...` links
 * - "fuzzy" links and emails (example.com, foo@bar.com).
 *
 * `schemas` is an object, where each key/value describes protocol/rule:
 *
 * - __key__ - link prefix (usually, protocol name with `:` at the end, `skype:`
 *   for example). `linkify-it` makes shure that prefix is not preceeded with
 *   alphanumeric char and symbols. Only whitespaces and punctuation allowed.
 * - __value__ - rule to check tail after link prefix
 *   - _String_ - just alias to existing rule
 *   - _Object_
 *     - _validate_ - validator function (should return matched length on success),
 *       or `RegExp`.
 *     - _normalize_ - optional function to normalize text & url of matched result
 *       (for example, for @twitter mentions).
 *
 * `options`:
 *
 * - __fuzzyLink__ - recognige URL-s without `http(s):` prefix. Default `true`.
 * - __fuzzyIP__ - allow IPs in fuzzy links above. Can conflict with some texts
 *   like version numbers. Default `false`.
 * - __fuzzyEmail__ - recognize emails without `mailto:` prefix.
 *
 **/
function LinkifyIt(schemas, options) {
  if (!(this instanceof LinkifyIt)) {
    return new LinkifyIt(schemas, options);
  }

  if (!options) {
    if (isOptionsObj(schemas)) {
      options = schemas;
      schemas = {};
    }
  }

  this.__opts__           = assign({}, defaultOptions, options);

  // Cache last tested result. Used to skip repeating steps on next `match` call.
  this.__index__          = -1;
  this.__last_index__     = -1; // Next scan position
  this.__schema__         = '';
  this.__text_cache__     = '';

  this.__schemas__        = assign({}, defaultSchemas, schemas);
  this.__compiled__       = {};

  this.__tlds__           = tlds_default;
  this.__tlds_replaced__  = false;

  this.re = {};

  compile(this);
}


/** chainable
 * LinkifyIt#add(schema, definition)
 * - schema (String): rule name (fixed pattern prefix)
 * - definition (String|RegExp|Object): schema definition
 *
 * Add new rule definition. See constructor description for details.
 **/
LinkifyIt.prototype.add = function add(schema, definition) {
  this.__schemas__[schema] = definition;
  compile(this);
  return this;
};


/** chainable
 * LinkifyIt#set(options)
 * - options (Object): { fuzzyLink|fuzzyEmail|fuzzyIP: true|false }
 *
 * Set recognition options for links without schema.
 **/
LinkifyIt.prototype.set = function set(options) {
  this.__opts__ = assign(this.__opts__, options);
  return this;
};


/**
 * LinkifyIt#test(text) -> Boolean
 *
 * Searches linkifiable pattern and returns `true` on success or `false` on fail.
 **/
LinkifyIt.prototype.test = function test(text) {
  // Reset scan cache
  this.__text_cache__ = text;
  this.__index__      = -1;

  if (!text.length) { return false; }

  var m, ml, me, len, shift, next, re, tld_pos, at_pos;

  // try to scan for link with schema - that's the most simple rule
  if (this.re.schema_test.test(text)) {
    re = this.re.schema_search;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      len = this.testSchemaAt(text, m[2], re.lastIndex);
      if (len) {
        this.__schema__     = m[2];
        this.__index__      = m.index + m[1].length;
        this.__last_index__ = m.index + m[0].length + len;
        break;
      }
    }
  }

  if (this.__opts__.fuzzyLink && this.__compiled__['http:']) {
    // guess schemaless links
    tld_pos = text.search(this.re.host_fuzzy_test);
    if (tld_pos >= 0) {
      // if tld is located after found link - no need to check fuzzy pattern
      if (this.__index__ < 0 || tld_pos < this.__index__) {
        if ((ml = text.match(this.__opts__.fuzzyIP ? this.re.link_fuzzy : this.re.link_no_ip_fuzzy)) !== null) {

          shift = ml.index + ml[1].length;

          if (this.__index__ < 0 || shift < this.__index__) {
            this.__schema__     = '';
            this.__index__      = shift;
            this.__last_index__ = ml.index + ml[0].length;
          }
        }
      }
    }
  }

  if (this.__opts__.fuzzyEmail && this.__compiled__['mailto:']) {
    // guess schemaless emails
    at_pos = text.indexOf('@');
    if (at_pos >= 0) {
      // We can't skip this check, because this cases are possible:
      // 192.168.1.1@gmail.com, my.in@example.com
      if ((me = text.match(this.re.email_fuzzy)) !== null) {

        shift = me.index + me[1].length;
        next  = me.index + me[0].length;

        if (this.__index__ < 0 || shift < this.__index__ ||
            (shift === this.__index__ && next > this.__last_index__)) {
          this.__schema__     = 'mailto:';
          this.__index__      = shift;
          this.__last_index__ = next;
        }
      }
    }
  }

  return this.__index__ >= 0;
};


/**
 * LinkifyIt#pretest(text) -> Boolean
 *
 * Very quick check, that can give false positives. Returns true if link MAY BE
 * can exists. Can be used for speed optimization, when you need to check that
 * link NOT exists.
 **/
LinkifyIt.prototype.pretest = function pretest(text) {
  return this.re.pretest.test(text);
};


/**
 * LinkifyIt#testSchemaAt(text, name, position) -> Number
 * - text (String): text to scan
 * - name (String): rule (schema) name
 * - position (Number): text offset to check from
 *
 * Similar to [[LinkifyIt#test]] but checks only specific protocol tail exactly
 * at given position. Returns length of found pattern (0 on fail).
 **/
LinkifyIt.prototype.testSchemaAt = function testSchemaAt(text, schema, pos) {
  // If not supported schema check requested - terminate
  if (!this.__compiled__[schema.toLowerCase()]) {
    return 0;
  }
  return this.__compiled__[schema.toLowerCase()].validate(text, pos, this);
};


/**
 * LinkifyIt#match(text) -> Array|null
 *
 * Returns array of found link descriptions or `null` on fail. We strongly
 * to use [[LinkifyIt#test]] first, for best speed.
 *
 * ##### Result match description
 *
 * - __schema__ - link schema, can be empty for fuzzy links, or `//` for
 *   protocol-neutral  links.
 * - __index__ - offset of matched text
 * - __lastIndex__ - index of next char after mathch end
 * - __raw__ - matched text
 * - __text__ - normalized text
 * - __url__ - link, generated from matched text
 **/
LinkifyIt.prototype.match = function match(text) {
  var shift = 0, result = [];

  // Try to take previous element from cache, if .test() called before
  if (this.__index__ >= 0 && this.__text_cache__ === text) {
    result.push(createMatch(this, shift));
    shift = this.__last_index__;
  }

  // Cut head if cache was used
  var tail = shift ? text.slice(shift) : text;

  // Scan string until end reached
  while (this.test(tail)) {
    result.push(createMatch(this, shift));

    tail = tail.slice(this.__last_index__);
    shift += this.__last_index__;
  }

  if (result.length) {
    return result;
  }

  return null;
};


/** chainable
 * LinkifyIt#tlds(list [, keepOld]) -> this
 * - list (Array): list of tlds
 * - keepOld (Boolean): merge with current list if `true` (`false` by default)
 *
 * Load (or merge) new tlds list. Those are user for fuzzy links (without prefix)
 * to avoid false positives. By default this algorythm used:
 *
 * - hostname with any 2-letter root zones are ok.
 * - biz|com|edu|gov|net|org|pro|web|xxx|aero|asia|coop|info|museum|name|shop|рф
 *   are ok.
 * - encoded (`xn--...`) root zones are ok.
 *
 * If list is replaced, then exact match for 2-chars root zones will be checked.
 **/
LinkifyIt.prototype.tlds = function tlds(list, keepOld) {
  list = Array.isArray(list) ? list : [ list ];

  if (!keepOld) {
    this.__tlds__ = list.slice();
    this.__tlds_replaced__ = true;
    compile(this);
    return this;
  }

  this.__tlds__ = this.__tlds__.concat(list)
                                  .sort()
                                  .filter(function(el, idx, arr) {
                                    return el !== arr[idx - 1];
                                  })
                                  .reverse();

  compile(this);
  return this;
};

/**
 * LinkifyIt#normalize(match)
 *
 * Default normalizer (if schema does not define it's own).
 **/
LinkifyIt.prototype.normalize = function normalize(match) {

  // Do minimal possible changes by default. Need to collect feedback prior
  // to move forward https://github.com/markdown-it/linkify-it/issues/1

  if (!match.schema) { match.url = 'http://' + match.url; }

  if (match.schema === 'mailto:' && !/^mailto:/i.test(match.url)) {
    match.url = 'mailto:' + match.url;
  }
};


module.exports = LinkifyIt;

},{"./lib/re":85}],85:[function(require,module,exports){
'use strict';

// Use direct extract instead of `regenerate` to reduse browserified size
var src_Any = exports.src_Any = require('uc.micro/properties/Any/regex').source;
var src_Cc  = exports.src_Cc = require('uc.micro/categories/Cc/regex').source;
var src_Z   = exports.src_Z  = require('uc.micro/categories/Z/regex').source;
var src_P   = exports.src_P  = require('uc.micro/categories/P/regex').source;

// \p{\Z\P\Cc\CF} (white spaces + control + format + punctuation)
var src_ZPCc = exports.src_ZPCc = [ src_Z, src_P, src_Cc ].join('|');

// \p{\Z\Cc} (white spaces + control)
var src_ZCc = exports.src_ZCc = [ src_Z, src_Cc ].join('|');

// All possible word characters (everything without punctuation, spaces & controls)
// Defined via punctuation & spaces to save space
// Should be something like \p{\L\N\S\M} (\w but without `_`)
var src_pseudo_letter       = '(?:(?!' + src_ZPCc + ')' + src_Any + ')';
// The same as abothe but without [0-9]
var src_pseudo_letter_non_d = '(?:(?![0-9]|' + src_ZPCc + ')' + src_Any + ')';

////////////////////////////////////////////////////////////////////////////////

var src_ip4 = exports.src_ip4 =

  '(?:(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)';

exports.src_auth    = '(?:(?:(?!' + src_ZCc + ').)+@)?';

var src_port = exports.src_port =

  '(?::(?:6(?:[0-4]\\d{3}|5(?:[0-4]\\d{2}|5(?:[0-2]\\d|3[0-5])))|[1-5]?\\d{1,4}))?';

var src_host_terminator = exports.src_host_terminator =

  '(?=$|' + src_ZPCc + ')(?!-|_|:\\d|\\.-|\\.(?!$|' + src_ZPCc + '))';

var src_path = exports.src_path =

  '(?:' +
    '[/?#]' +
      '(?:' +
        '(?!' + src_ZCc + '|[()[\\]{}.,"\'?!\\-]).|' +
        '\\[(?:(?!' + src_ZCc + '|\\]).)*\\]|' +
        '\\((?:(?!' + src_ZCc + '|[)]).)*\\)|' +
        '\\{(?:(?!' + src_ZCc + '|[}]).)*\\}|' +
        '\\"(?:(?!' + src_ZCc + '|["]).)+\\"|' +
        "\\'(?:(?!" + src_ZCc + "|[']).)+\\'|" +
        "\\'(?=" + src_pseudo_letter + ').|' +  // allow `I'm_king` if no pair found
        '\\.{2,3}[a-zA-Z0-9%/]|' + // github has ... in commit range links. Restrict to
                                   // - english
                                   // - percent-encoded
                                   // - parts of file path
                                   // until more examples found.
        '\\.(?!' + src_ZCc + '|[.]).|' +
        '\\-(?!--(?:[^-]|$))(?:-*)|' +  // `---` => long dash, terminate
        '\\,(?!' + src_ZCc + ').|' +      // allow `,,,` in paths
        '\\!(?!' + src_ZCc + '|[!]).|' +
        '\\?(?!' + src_ZCc + '|[?]).' +
      ')+' +
    '|\\/' +
  ')?';

var src_email_name = exports.src_email_name =

  '[\\-;:&=\\+\\$,\\"\\.a-zA-Z0-9_]+';

var src_xn = exports.src_xn =

  'xn--[a-z0-9\\-]{1,59}';

// More to read about domain names
// http://serverfault.com/questions/638260/

var src_domain_root = exports.src_domain_root =

  // Can't have digits and dashes
  '(?:' +
    src_xn +
    '|' +
    src_pseudo_letter_non_d + '{1,63}' +
  ')';

var src_domain = exports.src_domain =

  '(?:' +
    src_xn +
    '|' +
    '(?:' + src_pseudo_letter + ')' +
    '|' +
    // don't allow `--` in domain names, because:
    // - that can conflict with markdown &mdash; / &ndash;
    // - nobody use those anyway
    '(?:' + src_pseudo_letter + '(?:-(?!-)|' + src_pseudo_letter + '){0,61}' + src_pseudo_letter + ')' +
  ')';

var src_host = exports.src_host =

  '(?:' +
    src_ip4 +
  '|' +
    '(?:(?:(?:' + src_domain + ')\\.)*' + src_domain_root + ')' +
  ')';

var tpl_host_fuzzy = exports.tpl_host_fuzzy =

  '(?:' +
    src_ip4 +
  '|' +
    '(?:(?:(?:' + src_domain + ')\\.)+(?:%TLDS%))' +
  ')';

var tpl_host_no_ip_fuzzy = exports.tpl_host_no_ip_fuzzy =

  '(?:(?:(?:' + src_domain + ')\\.)+(?:%TLDS%))';

exports.src_host_strict =

  src_host + src_host_terminator;

var tpl_host_fuzzy_strict = exports.tpl_host_fuzzy_strict =

  tpl_host_fuzzy + src_host_terminator;

exports.src_host_port_strict =

  src_host + src_port + src_host_terminator;

var tpl_host_port_fuzzy_strict = exports.tpl_host_port_fuzzy_strict =

  tpl_host_fuzzy + src_port + src_host_terminator;

var tpl_host_port_no_ip_fuzzy_strict = exports.tpl_host_port_no_ip_fuzzy_strict =

  tpl_host_no_ip_fuzzy + src_port + src_host_terminator;


////////////////////////////////////////////////////////////////////////////////
// Main rules

// Rude test fuzzy links by host, for quick deny
exports.tpl_host_fuzzy_test =

  'localhost|\\.\\d{1,3}\\.|(?:\\.(?:%TLDS%)(?:' + src_ZPCc + '|$))';

exports.tpl_email_fuzzy =

    '(^|>|' + src_ZCc + ')(' + src_email_name + '@' + tpl_host_fuzzy_strict + ')';

exports.tpl_link_fuzzy =
    // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|]|' + src_ZPCc + '))' +
    '((?![$+<=>^`|])' + tpl_host_port_fuzzy_strict + src_path + ')';

exports.tpl_link_no_ip_fuzzy =
    // Fuzzy link can't be prepended with .:/\- and non punctuation.
    // but can start with > (markdown blockquote)
    '(^|(?![.:/\\-_@])(?:[$+<=>^`|]|' + src_ZPCc + '))' +
    '((?![$+<=>^`|])' + tpl_host_port_no_ip_fuzzy_strict + src_path + ')';

},{"uc.micro/categories/Cc/regex":91,"uc.micro/categories/P/regex":93,"uc.micro/categories/Z/regex":94,"uc.micro/properties/Any/regex":96}],86:[function(require,module,exports){

'use strict';


/* eslint-disable no-bitwise */

var decodeCache = {};

function getDecodeCache(exclude) {
  var i, ch, cache = decodeCache[exclude];
  if (cache) { return cache; }

  cache = decodeCache[exclude] = [];

  for (i = 0; i < 128; i++) {
    ch = String.fromCharCode(i);
    cache.push(ch);
  }

  for (i = 0; i < exclude.length; i++) {
    ch = exclude.charCodeAt(i);
    cache[ch] = '%' + ('0' + ch.toString(16).toUpperCase()).slice(-2);
  }

  return cache;
}


// Decode percent-encoded string.
//
function decode(string, exclude) {
  var cache;

  if (typeof exclude !== 'string') {
    exclude = decode.defaultChars;
  }

  cache = getDecodeCache(exclude);

  return string.replace(/(%[a-f0-9]{2})+/gi, function(seq) {
    var i, l, b1, b2, b3, b4, char,
        result = '';

    for (i = 0, l = seq.length; i < l; i += 3) {
      b1 = parseInt(seq.slice(i + 1, i + 3), 16);

      if (b1 < 0x80) {
        result += cache[b1];
        continue;
      }

      if ((b1 & 0xE0) === 0xC0 && (i + 3 < l)) {
        // 110xxxxx 10xxxxxx
        b2 = parseInt(seq.slice(i + 4, i + 6), 16);

        if ((b2 & 0xC0) === 0x80) {
          char = ((b1 << 6) & 0x7C0) | (b2 & 0x3F);

          if (char < 0x80) {
            result += '\ufffd\ufffd';
          } else {
            result += String.fromCharCode(char);
          }

          i += 3;
          continue;
        }
      }

      if ((b1 & 0xF0) === 0xE0 && (i + 6 < l)) {
        // 1110xxxx 10xxxxxx 10xxxxxx
        b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        b3 = parseInt(seq.slice(i + 7, i + 9), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80) {
          char = ((b1 << 12) & 0xF000) | ((b2 << 6) & 0xFC0) | (b3 & 0x3F);

          if (char < 0x800 || (char >= 0xD800 && char <= 0xDFFF)) {
            result += '\ufffd\ufffd\ufffd';
          } else {
            result += String.fromCharCode(char);
          }

          i += 6;
          continue;
        }
      }

      if ((b1 & 0xF8) === 0xF0 && (i + 9 < l)) {
        // 111110xx 10xxxxxx 10xxxxxx 10xxxxxx
        b2 = parseInt(seq.slice(i + 4, i + 6), 16);
        b3 = parseInt(seq.slice(i + 7, i + 9), 16);
        b4 = parseInt(seq.slice(i + 10, i + 12), 16);

        if ((b2 & 0xC0) === 0x80 && (b3 & 0xC0) === 0x80 && (b4 & 0xC0) === 0x80) {
          char = ((b1 << 18) & 0x1C0000) | ((b2 << 12) & 0x3F000) | ((b3 << 6) & 0xFC0) | (b4 & 0x3F);

          if (char < 0x10000 || char > 0x10FFFF) {
            result += '\ufffd\ufffd\ufffd\ufffd';
          } else {
            char -= 0x10000;
            result += String.fromCharCode(0xD800 + (char >> 10), 0xDC00 + (char & 0x3FF));
          }

          i += 9;
          continue;
        }
      }

      result += '\ufffd';
    }

    return result;
  });
}


decode.defaultChars   = ';/?:@&=+$,#';
decode.componentChars = '';


module.exports = decode;

},{}],87:[function(require,module,exports){

'use strict';


var encodeCache = {};


// Create a lookup array where anything but characters in `chars` string
// and alphanumeric chars is percent-encoded.
//
function getEncodeCache(exclude) {
  var i, ch, cache = encodeCache[exclude];
  if (cache) { return cache; }

  cache = encodeCache[exclude] = [];

  for (i = 0; i < 128; i++) {
    ch = String.fromCharCode(i);

    if (/^[0-9a-z]$/i.test(ch)) {
      // always allow unencoded alphanumeric characters
      cache.push(ch);
    } else {
      cache.push('%' + ('0' + i.toString(16).toUpperCase()).slice(-2));
    }
  }

  for (i = 0; i < exclude.length; i++) {
    cache[exclude.charCodeAt(i)] = exclude[i];
  }

  return cache;
}


// Encode unsafe characters with percent-encoding, skipping already
// encoded sequences.
//
//  - string       - string to encode
//  - exclude      - list of characters to ignore (in addition to a-zA-Z0-9)
//  - keepEscaped  - don't encode '%' in a correct escape sequence (default: true)
//
function encode(string, exclude, keepEscaped) {
  var i, l, code, nextCode, cache,
      result = '';

  if (typeof exclude !== 'string') {
    // encode(string, keepEscaped)
    keepEscaped  = exclude;
    exclude = encode.defaultChars;
  }

  if (typeof keepEscaped === 'undefined') {
    keepEscaped = true;
  }

  cache = getEncodeCache(exclude);

  for (i = 0, l = string.length; i < l; i++) {
    code = string.charCodeAt(i);

    if (keepEscaped && code === 0x25 /* % */ && i + 2 < l) {
      if (/^[0-9a-f]{2}$/i.test(string.slice(i + 1, i + 3))) {
        result += string.slice(i, i + 3);
        i += 2;
        continue;
      }
    }

    if (code < 128) {
      result += cache[code];
      continue;
    }

    if (code >= 0xD800 && code <= 0xDFFF) {
      if (code >= 0xD800 && code <= 0xDBFF && i + 1 < l) {
        nextCode = string.charCodeAt(i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          result += encodeURIComponent(string[i] + string[i + 1]);
          i++;
          continue;
        }
      }
      result += '%EF%BF%BD';
      continue;
    }

    result += encodeURIComponent(string[i]);
  }

  return result;
}

encode.defaultChars   = ";/?:@&=+$,-_.!~*'()#";
encode.componentChars = "-_.!~*'()";


module.exports = encode;

},{}],88:[function(require,module,exports){

'use strict';


module.exports = function format(url) {
  var result = '';

  result += url.protocol || '';
  result += url.slashes ? '//' : '';
  result += url.auth ? url.auth + '@' : '';

  if (url.hostname && url.hostname.indexOf(':') !== -1) {
    // ipv6 address
    result += '[' + url.hostname + ']';
  } else {
    result += url.hostname || '';
  }

  result += url.port ? ':' + url.port : '';
  result += url.pathname || '';
  result += url.search || '';
  result += url.hash || '';

  return result;
};

},{}],89:[function(require,module,exports){
'use strict';


module.exports.encode = require('./encode');
module.exports.decode = require('./decode');
module.exports.format = require('./format');
module.exports.parse  = require('./parse');

},{"./decode":86,"./encode":87,"./format":88,"./parse":90}],90:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

//
// Changes from joyent/node:
//
// 1. No leading slash in paths,
//    e.g. in `url.parse('http://foo?bar')` pathname is ``, not `/`
//
// 2. Backslashes are not replaced with slashes,
//    so `http:\\example.org\` is treated like a relative path
//
// 3. Trailing colon is treated like a part of the path,
//    i.e. in `http://example.org:foo` pathname is `:foo`
//
// 4. Nothing is URL-encoded in the resulting object,
//    (in joyent/node some chars in auth and paths are encoded)
//
// 5. `url.parse()` does not have `parseQueryString` argument
//
// 6. Removed extraneous result properties: `host`, `path`, `query`, etc.,
//    which can be constructed using other parts of the url.
//


function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.pathname = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // Special case for a simple path URL
    simplePathPattern = /^(\/\/?(?!\/)[^\?\s]*)(\?[^\s]*)?$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = [ '<', '>', '"', '`', ' ', '\r', '\n', '\t' ],

    // RFC 2396: characters not allowed for various reasons.
    unwise = [ '{', '}', '|', '\\', '^', '`' ].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = [ '\'' ].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = [ '%', '/', '?', ';', '#' ].concat(autoEscape),
    hostEndingChars = [ '/', '?', '#' ],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[+a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([+a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    /* eslint-disable no-script-url */
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    };
    /* eslint-enable no-script-url */

function urlParse(url, slashesDenoteHost) {
  if (url && url instanceof Url) { return url; }

  var u = new Url();
  u.parse(url, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, slashesDenoteHost) {
  var i, l, lowerProto, hec, slashes,
      rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  if (!slashesDenoteHost && url.split('#').length === 1) {
    // Try fast path regexp
    var simplePath = simplePathPattern.exec(rest);
    if (simplePath) {
      this.pathname = simplePath[1];
      if (simplePath[2]) {
        this.search = simplePath[2];
      }
      return this;
    }
  }

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    lowerProto = proto.toLowerCase();
    this.protocol = proto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (i = 0; i < hostEndingChars.length; i++) {
      hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = auth;
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (i = 0; i < nonHostChars.length; i++) {
      hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd)) {
        hostEnd = hec;
      }
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1) {
      hostEnd = rest.length;
    }

    if (rest[hostEnd - 1] === ':') { hostEnd--; }
    var host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost(host);

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) { continue; }
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    }

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
    }
  }

  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    rest = rest.slice(0, qm);
  }
  if (rest) { this.pathname = rest; }
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '';
  }

  return this;
};

Url.prototype.parseHost = function(host) {
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) { this.hostname = host; }
};

module.exports = urlParse;

},{}],91:[function(require,module,exports){
arguments[4][27][0].apply(exports,arguments)
},{"dup":27}],92:[function(require,module,exports){
arguments[4][28][0].apply(exports,arguments)
},{"dup":28}],93:[function(require,module,exports){
arguments[4][29][0].apply(exports,arguments)
},{"dup":29}],94:[function(require,module,exports){
arguments[4][30][0].apply(exports,arguments)
},{"dup":30}],95:[function(require,module,exports){

module.exports.Any = require('./properties/Any/regex');
module.exports.Cc  = require('./categories/Cc/regex');
module.exports.Cf  = require('./categories/Cf/regex');
module.exports.P   = require('./categories/P/regex');
module.exports.Z   = require('./categories/Z/regex');

},{"./categories/Cc/regex":91,"./categories/Cf/regex":92,"./categories/P/regex":93,"./categories/Z/regex":94,"./properties/Any/regex":96}],96:[function(require,module,exports){
arguments[4][31][0].apply(exports,arguments)
},{"dup":31}],97:[function(require,module,exports){
'use strict';

// the majority of this file was taken from markdown-it's linkify method
// https://github.com/markdown-it/markdown-it/blob/9159018e2a446fc97eb3c6e509a8cdc4cc3c358a/lib/rules_core/linkify.js

var linkify = require('linkify-it')();

function arrayReplaceAt (a, i, middle) {
  var left = a.slice(0, i);
  var right = a.slice(i + 1);
  return left.concat(middle, right);
}

function isLinkOpen (str) {
  return /^<a[>\s]/i.test(str);
}

function isLinkClose (str) {
  return /^<\/a\s*>/i.test(str);
}

function tokenizeLinks (state, context) {
  var i;
  var j;
  var l;
  var tokens;
  var token;
  var nodes;
  var ln;
  var text;
  var pos;
  var lastPos;
  var level;
  var links;
  var htmlLinkLevel;
  var blockTokens = state.tokens;
  var html;

  for (j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline') {
      continue;
    }

    tokens = blockTokens[j].children;
    htmlLinkLevel = 0;

    // we scan from the end, to keep position when new tags added.
    // use reversed logic in links start/end match
    for (i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];

      // skip content of markdown links
      if (token.type === 'link_close') {
        i--;
        while (tokens[i].level !== token.level && tokens[i].type !== 'link_open') {
          i--;
        }
        continue;
      }

      if (token.type === 'html_inline') { // skip content of html tag links
        if (isLinkOpen(token.content) && htmlLinkLevel > 0) {
          htmlLinkLevel--;
        }
        if (isLinkClose(token.content)) {
          htmlLinkLevel++;
        }
      }
      if (htmlLinkLevel > 0) {
        continue;
      }
      if (token.type !== 'text' || !linkify.test(token.content)) {
        continue;
      }

      text = token.content;
      links = linkify.match(text);
      nodes = [];
      level = token.level;
      lastPos = 0;

      for (ln = 0; ln < links.length; ln++) { // split string to nodes
        if (!state.md.validateLink(links[ln].url)) {
          continue;
        }

        pos = links[ln].index;

        if (pos > lastPos) {
          level = level;
          nodes.push({
            type: 'text',
            content: text.slice(lastPos, pos),
            level: level
          });
        }

        html = null;

        context.linkifiers.some(runUserLinkifier);

        if (typeof html === 'string') {
          nodes.push({
            type: 'html_block',
            content: html,
            level: level
          });
        } else {
          nodes.push({
            type: 'link_open',
            href: links[ln].url,
            target: '',
            title: '',
            level: level++
          });
          nodes.push({
            type: 'text',
            content: links[ln].text,
            level: level
          });
          nodes.push({
            type: 'link_close',
            level: --level
          });
        }

        lastPos = links[ln].lastIndex;
      }

      if (lastPos < text.length) {
        nodes.push({
          type: 'text',
          content: text.slice(lastPos),
          level: level
        });
      }

      blockTokens[j].children = tokens = arrayReplaceAt(tokens, i, nodes);
    }
  }

  function runUserLinkifier (linkifier) {
    html = linkifier(links[ln].url, links[ln].text);
    return typeof html === 'string';
  }
}

module.exports = tokenizeLinks;

},{"linkify-it":25}]},{},[2])(2)
});
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJtYXJrZG93bi5qcyIsIm1lZ2FtYXJrLmpzIiwibm9kZV9tb2R1bGVzL2Fzc2lnbm1lbnQvYXNzaWdubWVudC5qcyIsIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wdW55Y29kZS9wdW55Y29kZS5qcyIsIm5vZGVfbW9kdWxlcy9oaWdobGlnaHQtcmVkdXgvbGliL2hpZ2hsaWdodC5qcyIsIm5vZGVfbW9kdWxlcy9oaWdobGlnaHQtcmVkdXgvbGliL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2hpZ2hsaWdodC1yZWR1eC9saWIvbGFuZ3VhZ2VzL2Jhc2guanMiLCJub2RlX21vZHVsZXMvaGlnaGxpZ2h0LXJlZHV4L2xpYi9sYW5ndWFnZXMvY3NzLmpzIiwibm9kZV9tb2R1bGVzL2hpZ2hsaWdodC1yZWR1eC9saWIvbGFuZ3VhZ2VzL2h0dHAuanMiLCJub2RlX21vZHVsZXMvaGlnaGxpZ2h0LXJlZHV4L2xpYi9sYW5ndWFnZXMvaW5pLmpzIiwibm9kZV9tb2R1bGVzL2hpZ2hsaWdodC1yZWR1eC9saWIvbGFuZ3VhZ2VzL2phdmFzY3JpcHQuanMiLCJub2RlX21vZHVsZXMvaGlnaGxpZ2h0LXJlZHV4L2xpYi9sYW5ndWFnZXMvanNvbi5qcyIsIm5vZGVfbW9kdWxlcy9oaWdobGlnaHQtcmVkdXgvbGliL2xhbmd1YWdlcy9tYXJrZG93bi5qcyIsIm5vZGVfbW9kdWxlcy9oaWdobGlnaHQtcmVkdXgvbGliL2xhbmd1YWdlcy94bWwuanMiLCJub2RlX21vZHVsZXMvaGlnaGxpZ2h0LmpzLXRva2Vucy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9pbnNhbmUvYXR0cmlidXRlcy5qcyIsIm5vZGVfbW9kdWxlcy9pbnNhbmUvZGVmYXVsdHMuanMiLCJub2RlX21vZHVsZXMvaW5zYW5lL2VsZW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL2luc2FuZS9pbnNhbmUuanMiLCJub2RlX21vZHVsZXMvaW5zYW5lL2xvd2VyY2FzZS5qcyIsIm5vZGVfbW9kdWxlcy9pbnNhbmUvcGFyc2VyLmpzIiwibm9kZV9tb2R1bGVzL2luc2FuZS9zYW5pdGl6ZXIuanMiLCJub2RlX21vZHVsZXMvaW5zYW5lL3NoZS5qcyIsIm5vZGVfbW9kdWxlcy9pbnNhbmUvdG9NYXAuanMiLCJub2RlX21vZHVsZXMvbGlua2lmeS1pdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9saW5raWZ5LWl0L2xpYi9yZS5qcyIsIm5vZGVfbW9kdWxlcy9saW5raWZ5LWl0L25vZGVfbW9kdWxlcy91Yy5taWNyby9jYXRlZ29yaWVzL0NjL3JlZ2V4LmpzIiwibm9kZV9tb2R1bGVzL2xpbmtpZnktaXQvbm9kZV9tb2R1bGVzL3VjLm1pY3JvL2NhdGVnb3JpZXMvQ2YvcmVnZXguanMiLCJub2RlX21vZHVsZXMvbGlua2lmeS1pdC9ub2RlX21vZHVsZXMvdWMubWljcm8vY2F0ZWdvcmllcy9QL3JlZ2V4LmpzIiwibm9kZV9tb2R1bGVzL2xpbmtpZnktaXQvbm9kZV9tb2R1bGVzL3VjLm1pY3JvL2NhdGVnb3JpZXMvWi9yZWdleC5qcyIsIm5vZGVfbW9kdWxlcy9saW5raWZ5LWl0L25vZGVfbW9kdWxlcy91Yy5taWNyby9wcm9wZXJ0aWVzL0FueS9yZWdleC5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvY29tbW9uL2VudGl0aWVzLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9jb21tb24vaHRtbF9ibG9ja3MuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL2NvbW1vbi9odG1sX3JlLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9jb21tb24vdXJsX3NjaGVtYXMuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL2NvbW1vbi91dGlscy5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvaGVscGVycy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvaGVscGVycy9wYXJzZV9saW5rX2Rlc3RpbmF0aW9uLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9oZWxwZXJzL3BhcnNlX2xpbmtfbGFiZWwuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL2hlbHBlcnMvcGFyc2VfbGlua190aXRsZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3BhcnNlcl9ibG9jay5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcGFyc2VyX2NvcmUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3BhcnNlcl9pbmxpbmUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3ByZXNldHMvY29tbW9ubWFyay5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcHJlc2V0cy9kZWZhdWx0LmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9wcmVzZXRzL3plcm8uanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3JlbmRlcmVyLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlci5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfYmxvY2svYmxvY2txdW90ZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfYmxvY2svY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfYmxvY2svZmVuY2UuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2Jsb2NrL2hlYWRpbmcuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2Jsb2NrL2hyLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19ibG9jay9odG1sX2Jsb2NrLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19ibG9jay9saGVhZGluZy5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfYmxvY2svbGlzdC5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfYmxvY2svcGFyYWdyYXBoLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19ibG9jay9yZWZlcmVuY2UuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2Jsb2NrL3N0YXRlX2Jsb2NrLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19ibG9jay90YWJsZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfY29yZS9ibG9jay5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfY29yZS9pbmxpbmUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2NvcmUvbGlua2lmeS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfY29yZS9ub3JtYWxpemUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2NvcmUvcmVwbGFjZW1lbnRzLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19jb3JlL3NtYXJ0cXVvdGVzLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19jb3JlL3N0YXRlX2NvcmUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2lubGluZS9hdXRvbGluay5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfaW5saW5lL2JhY2t0aWNrcy5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfaW5saW5lL2VtcGhhc2lzLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19pbmxpbmUvZW50aXR5LmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19pbmxpbmUvZXNjYXBlLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19pbmxpbmUvaHRtbF9pbmxpbmUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2lubGluZS9pbWFnZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfaW5saW5lL2xpbmsuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3J1bGVzX2lubGluZS9uZXdsaW5lLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19pbmxpbmUvc3RhdGVfaW5saW5lLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L2xpYi9ydWxlc19pbmxpbmUvc3RyaWtldGhyb3VnaC5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9saWIvcnVsZXNfaW5saW5lL3RleHQuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbGliL3Rva2VuLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L25vZGVfbW9kdWxlcy9lbnRpdGllcy9tYXBzL2VudGl0aWVzLmpzb24iLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbm9kZV9tb2R1bGVzL2xpbmtpZnktaXQvaW5kZXguanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbm9kZV9tb2R1bGVzL2xpbmtpZnktaXQvbGliL3JlLmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L25vZGVfbW9kdWxlcy9tZHVybC9kZWNvZGUuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbm9kZV9tb2R1bGVzL21kdXJsL2VuY29kZS5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9ub2RlX21vZHVsZXMvbWR1cmwvZm9ybWF0LmpzIiwibm9kZV9tb2R1bGVzL21hcmtkb3duLWl0L25vZGVfbW9kdWxlcy9tZHVybC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9tYXJrZG93bi1pdC9ub2RlX21vZHVsZXMvbWR1cmwvcGFyc2UuanMiLCJub2RlX21vZHVsZXMvbWFya2Rvd24taXQvbm9kZV9tb2R1bGVzL3VjLm1pY3JvL2luZGV4LmpzIiwidG9rZW5pemVMaW5rcy5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUN0QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbGhCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcnFCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbGlCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxSUE7O0FDQUE7O0FDQUE7O0FDQUE7O0FDQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNOQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25FQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pRQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2aUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25JQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdTQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hXQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbklBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2pDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyUUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQy9DQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0tBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNiQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0NBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEtBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDNURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1SUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckpBOztBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeG1CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNQQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7Ozs7Ozs7OztBQ3hUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ05BO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgTWFya2Rvd25JdCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0Jyk7XG52YXIgaGxqcyA9IHJlcXVpcmUoJ2hpZ2hsaWdodC5qcycpO1xudmFyIHRva2VuaXplTGlua3MgPSByZXF1aXJlKCcuL3Rva2VuaXplTGlua3MnKTtcbnZhciBtZCA9IG5ldyBNYXJrZG93bkl0KHtcbiAgaHRtbDogdHJ1ZSxcbiAgeGh0bWxPdXQ6IHRydWUsXG4gIGxpbmtpZnk6IHRydWUsXG4gIHR5cG9ncmFwaGVyOiB0cnVlLFxuICBsYW5nUHJlZml4OiAnbWQtbGFuZy1hbGlhcy0nLFxuICBoaWdobGlnaHQ6IGhpZ2hsaWdodC5iaW5kKG51bGwsIGZhbHNlKVxufSk7XG52YXIgcmFsaWFzID0gLyBjbGFzcz1cIm1kLWxhbmctYWxpYXMtKFteXCJdKylcIi87XG52YXIgYWxpYXNlcyA9IHtcbiAganM6ICdqYXZhc2NyaXB0JyxcbiAgbWQ6ICdtYXJrZG93bicsXG4gIGh0bWw6ICd4bWwnLCAvLyBuZXh0IGJlc3QgdGhpbmdcbiAgamFkZTogJ2NzcycgLy8gbmV4dCBiZXN0IHRoaW5nXG59O1xudmFyIGJhc2VibG9jayA9IG1kLnJlbmRlcmVyLnJ1bGVzLmNvZGVfYmxvY2s7XG52YXIgYmFzZWlubGluZSA9IG1kLnJlbmRlcmVyLnJ1bGVzLmNvZGVfaW5saW5lO1xudmFyIGJhc2VmZW5jZSA9IG1kLnJlbmRlcmVyLnJ1bGVzLmZlbmNlO1xudmFyIGJhc2V0ZXh0ID0gbWQucmVuZGVyZXIucnVsZXMudGV4dDtcbnZhciB0ZXh0Y2FjaGVkID0gdGV4dHBhcnNlcihbXSk7XG52YXIgbGFuZ3VhZ2VzID0gW107XG52YXIgY29udGV4dCA9IHt9O1xuXG5tZC5jb3JlLnJ1bGVyLmJlZm9yZSgnbGlua2lmeScsICdsaW5raWZ5LXRva2VuaXplcicsIGxpbmtpZnlUb2tlbml6ZXIsIHt9KTtcbm1kLnJlbmRlcmVyLnJ1bGVzLmNvZGVfYmxvY2sgPSBibG9jaztcbm1kLnJlbmRlcmVyLnJ1bGVzLmNvZGVfaW5saW5lID0gaW5saW5lO1xubWQucmVuZGVyZXIucnVsZXMuZmVuY2UgPSBmZW5jZTtcblxuaGxqcy5jb25maWd1cmUoeyB0YWJSZXBsYWNlOiAyLCBjbGFzc1ByZWZpeDogJ21kLWNvZGUtJyB9KTtcblxuZnVuY3Rpb24gaGlnaGxpZ2h0IChlbmNvZGVkLCBjb2RlLCBkZXRlY3RlZCkge1xuICB2YXIgbG93ZXIgPSBTdHJpbmcoZGV0ZWN0ZWQpLnRvTG93ZXJDYXNlKCk7XG4gIHZhciBsYW5nID0gYWxpYXNlc1tkZXRlY3RlZF0gfHwgZGV0ZWN0ZWQ7XG4gIHZhciBlc2NhcGVkID0gbWFyayhjb2RlLCBlbmNvZGVkKTtcbiAgdHJ5IHtcbiAgICB2YXIgcmVzdWx0ID0gaGxqcy5oaWdobGlnaHQobGFuZywgZXNjYXBlZCk7XG4gICAgdmFyIHVuZXNjYXBlZCA9IHVubWFyayhyZXN1bHQudmFsdWUsIHRydWUsIGVuY29kZWQpO1xuICAgIHJldHVybiB1bmVzY2FwZWQ7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gdW5tYXJrKG1hcmsoY29kZSwgZW5jb2RlZCksIHRydWUsIGVuY29kZWQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGVuY29kZSAodGFnKSB7XG4gIHJldHVybiB0YWcucmVwbGFjZSgnPCcsICcmbHQ7JykucmVwbGFjZSgnPicsICcmZ3Q7Jyk7XG59XG5cbmZ1bmN0aW9uIG1hcmsgKGNvZGUsIGVuY29kZWQpIHtcbiAgdmFyIG9wZW50YWcgPSAnPG1hcms+JztcbiAgdmFyIGNsb3NldGFnID0gJzwvbWFyaz4nO1xuICBpZiAoZW5jb2RlZCkge1xuICAgIG9wZW50YWcgPSBlbmNvZGUob3BlbnRhZyk7XG4gICAgY2xvc2V0YWcgPSBlbmNvZGUoY2xvc2V0YWcpO1xuICB9XG4gIHZhciByb3BlbiA9IG5ldyBSZWdFeHAob3BlbnRhZywgJ2cnKTtcbiAgdmFyIHJjbG9zZSA9IG5ldyBSZWdFeHAoY2xvc2V0YWcsICdnJyk7XG4gIHZhciBvcGVuID0gJ2hpZ2hsaWdodG1hcmtpc3ZlcnlsaXRlcmFsJztcbiAgdmFyIGNsb3NlID0gJ2hpZ2hsaWdodG1hcmt3YXN2ZXJ5bGl0ZXJhbCc7XG4gIHJldHVybiBjb2RlLnJlcGxhY2Uocm9wZW4sIG9wZW4pLnJlcGxhY2UocmNsb3NlLCBjbG9zZSk7XG59XG5cbmZ1bmN0aW9uIHVubWFyayAodmFsdWUsIGluQ29kZSkge1xuICB2YXIgcm9wZW4gPSAvaGlnaGxpZ2h0bWFya2lzdmVyeWxpdGVyYWwvZztcbiAgdmFyIHJjbG9zZSA9IC9oaWdobGlnaHRtYXJrd2FzdmVyeWxpdGVyYWwvZztcbiAgdmFyIGNsYXNzZXMgPSAnbWQtbWFyaycgKyAoaW5Db2RlID8gJyBtZC1jb2RlLW1hcmsnIDogJycpO1xuICB2YXIgb3BlbiA9ICc8bWFyayBjbGFzcz1cIicgKyBjbGFzc2VzICsgJ1wiPic7XG4gIHZhciBjbG9zZSA9ICc8L21hcms+JztcbiAgcmV0dXJuIHZhbHVlLnJlcGxhY2Uocm9wZW4sIG9wZW4pLnJlcGxhY2UocmNsb3NlLCBjbG9zZSk7XG59XG5cbmZ1bmN0aW9uIGJsb2NrICgpIHtcbiAgdmFyIGJhc2UgPSBiYXNlYmxvY2suYXBwbHkodGhpcywgYXJndW1lbnRzKS5zdWJzdHIoMTEpOyAvLyBzdGFydHMgd2l0aCAnPHByZT48Y29kZT4nXG4gIHZhciBsZWZ0ID0gYmFzZS5zdWJzdHIoMCwgYmFzZS5sZW5ndGggLSAxNCk7XG4gIHZhciBtYXJrZWQgPSBoaWdobGlnaHQodHJ1ZSwgYmFzZSk7XG4gIHZhciBjbGFzc2VkID0gJzxwcmUgY2xhc3M9XCJtZC1jb2RlLWJsb2NrXCI+PGNvZGUgY2xhc3M9XCJtZC1jb2RlXCI+JyArIG1hcmtlZCArICc8L2NvZGU+PC9wcmU+JztcbiAgcmV0dXJuIGNsYXNzZWQ7XG59XG5cbmZ1bmN0aW9uIGlubGluZSAoKSB7XG4gIHZhciBiYXNlID0gYmFzZWlubGluZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpLnN1YnN0cig2KTsgLy8gc3RhcnRzIHdpdGggJzxjb2RlPidcbiAgdmFyIGxlZnQgPSBiYXNlLnN1YnN0cigwLCBiYXNlLmxlbmd0aCAtIDcpOyAvLyBlbmRzIHdpdGggJzwvY29kZT4nXG4gIHZhciBtYXJrZWQgPSBoaWdobGlnaHQodHJ1ZSwgbGVmdCk7XG4gIHZhciBjbGFzc2VkID0gJzxjb2RlIGNsYXNzPVwibWQtY29kZSBtZC1jb2RlLWlubGluZVwiPicgKyBtYXJrZWQgKyAnPC9jb2RlPic7XG4gIHJldHVybiBjbGFzc2VkO1xufVxuXG5mdW5jdGlvbiBmZW5jZSAoKSB7XG4gIHZhciBiYXNlID0gYmFzZWZlbmNlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cykuc3Vic3RyKDUpOyAvLyBzdGFydHMgd2l0aCAnPHByZT4nXG4gIHZhciBsYW5nID0gYmFzZS5zdWJzdHIoMCwgNikgIT09ICc8Y29kZT4nOyAvLyB3aGVuIHRoZSBmZW5jZSBoYXMgYSBsYW5ndWFnZSBjbGFzc1xuICB2YXIgcmVzdCA9IGxhbmcgPyBiYXNlIDogJzxjb2RlIGNsYXNzPVwibWQtY29kZVwiPicgKyBiYXNlLnN1YnN0cig2KTtcbiAgdmFyIGNsYXNzZWQgPSAnPHByZSBjbGFzcz1cIm1kLWNvZGUtYmxvY2tcIj4nICsgcmVzdDtcbiAgdmFyIGFsaWFzZWQgPSBjbGFzc2VkLnJlcGxhY2UocmFsaWFzLCBhbGlhc2luZyk7XG4gIHJldHVybiBhbGlhc2VkO1xufVxuXG5mdW5jdGlvbiBhbGlhc2luZyAoYWxsLCBsYW5ndWFnZSkge1xuICB2YXIgbmFtZSA9IGFsaWFzZXNbbGFuZ3VhZ2VdIHx8IGxhbmd1YWdlIHx8ICd1bmtub3duJztcbiAgdmFyIGxhbmcgPSAnbWQtbGFuZy0nICsgbmFtZTtcbiAgaWYgKGxhbmd1YWdlcy5pbmRleE9mKGxhbmcpID09PSAtMSkge1xuICAgIGxhbmd1YWdlcy5wdXNoKGxhbmcpO1xuICB9XG4gIHJldHVybiAnIGNsYXNzPVwibWQtY29kZSAnICsgbGFuZyArICdcIic7XG59XG5cbmZ1bmN0aW9uIHRleHRwYXJzZXIgKHRva2VuaXplcnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHBhcnNlVGV4dCAoKSB7XG4gICAgdmFyIGJhc2UgPSBiYXNldGV4dC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIHZhciBmYW5jeSA9IGZhbmNpZnVsKGJhc2UpO1xuICAgIHZhciB0b2tlbml6ZWQgPSB0b2tlbml6ZShmYW5jeSwgdG9rZW5pemVycyk7XG4gICAgcmV0dXJuIHRva2VuaXplZDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gZmFuY2lmdWwgKHRleHQpIHtcbiAgcmV0dXJuIHRleHRcbiAgICAucmVwbGFjZSgvLS0vZywgJ1xcdTIwMTQnKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBlbS1kYXNoZXNcbiAgICAucmVwbGFjZSgvKF58Wy1cXHUyMDE0LyhcXFt7XCJcXHNdKScvZywgJyQxXFx1MjAxOCcpICAgICAgLy8gb3BlbmluZyBzaW5nbGVzXG4gICAgLnJlcGxhY2UoLycvZywgJ1xcdTIwMTknKSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gY2xvc2luZyBzaW5nbGVzICYgYXBvc3Ryb3BoZXNcbiAgICAucmVwbGFjZSgvKF58Wy1cXHUyMDE0LyhcXFt7XFx1MjAxOFxcc10pXCIvZywgJyQxXFx1MjAxYycpIC8vIG9wZW5pbmcgZG91Ymxlc1xuICAgIC5yZXBsYWNlKC9cIi9nLCAnXFx1MjAxZCcpICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyBjbG9zaW5nIGRvdWJsZXNcbiAgICAucmVwbGFjZSgvXFwuezN9L2csICdcXHUyMDI2Jyk7ICAgICAgICAgICAgICAgICAgICAgICAgLy8gZWxsaXBzZXNcbn1cblxuZnVuY3Rpb24gbGlua2lmeVRva2VuaXplciAoc3RhdGUpIHtcbiAgdG9rZW5pemVMaW5rcyhzdGF0ZSwgY29udGV4dCk7XG59XG5cbmZ1bmN0aW9uIHRva2VuaXplICh0ZXh0LCB0b2tlbml6ZXJzKSB7XG4gIHJldHVybiB0b2tlbml6ZXJzLnJlZHVjZSh1c2UsIHRleHQpO1xuICBmdW5jdGlvbiB1c2UgKHJlc3VsdCwgdG9rKSB7XG4gICAgcmV0dXJuIHJlc3VsdC5yZXBsYWNlKHRvay50b2tlbiwgdG9rLnRyYW5zZm9ybSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gbWFya2Rvd24gKGlucHV0LCBvcHRpb25zKSB7XG4gIHZhciB0b2sgPSBvcHRpb25zLnRva2VuaXplcnMgfHwgW107XG4gIHZhciBsaW4gPSBvcHRpb25zLmxpbmtpZmllcnMgfHwgW107XG4gIHZhciB2YWxpZCA9IGlucHV0ID09PSBudWxsIHx8IGlucHV0ID09PSB2b2lkIDAgPyAnJyA6IFN0cmluZyhpbnB1dCk7XG4gIGNvbnRleHQudG9rZW5pemVycyA9IHRvaztcbiAgY29udGV4dC5saW5raWZpZXJzID0gbGluO1xuICBtZC5yZW5kZXJlci5ydWxlcy50ZXh0ID0gdG9rLmxlbmd0aCA/IHRleHRwYXJzZXIodG9rKSA6IHRleHRjYWNoZWQ7XG4gIHZhciBodG1sID0gbWQucmVuZGVyKHZhbGlkKTtcbiAgcmV0dXJuIHVubWFyayhtYXJrKGh0bWwpKTtcbn1cblxubWFya2Rvd24ucGFyc2VyID0gbWQ7XG5tYXJrZG93bi5sYW5ndWFnZXMgPSBsYW5ndWFnZXM7XG5tb2R1bGUuZXhwb3J0cyA9IG1hcmtkb3duO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaW5zYW5lID0gcmVxdWlyZSgnaW5zYW5lJyk7XG52YXIgYXNzaWduID0gcmVxdWlyZSgnYXNzaWdubWVudCcpO1xudmFyIG1hcmtkb3duID0gcmVxdWlyZSgnLi9tYXJrZG93bicpO1xudmFyIGhpZ2h0b2tlbnMgPSByZXF1aXJlKCdoaWdobGlnaHQuanMtdG9rZW5zJykubWFwKGNvZGVjbGFzcyk7XG5cbmZ1bmN0aW9uIGNvZGVjbGFzcyAodG9rZW4pIHtcbiAgcmV0dXJuICdtZC1jb2RlLScgKyB0b2tlbjtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemUgKGh0bWwsIG8pIHtcbiAgdmFyIG9wdGlvbnMgPSBhc3NpZ24oeyBhbGxvd2VkQ2xhc3Nlczoge30gfSwgbyk7XG4gIHZhciBhYyA9IG9wdGlvbnMuYWxsb3dlZENsYXNzZXM7XG5cbiAgYWRkKCdtYXJrJywgWydtZC1tYXJrJywgJ21kLWNvZGUtbWFyayddKTtcbiAgYWRkKCdwcmUnLCBbJ21kLWNvZGUtYmxvY2snXSk7XG4gIGFkZCgnY29kZScsIG1hcmtkb3duLmxhbmd1YWdlcyk7XG4gIGFkZCgnc3BhbicsIGhpZ2h0b2tlbnMpO1xuXG4gIHJldHVybiBpbnNhbmUoaHRtbCwgb3B0aW9ucyk7XG5cbiAgZnVuY3Rpb24gYWRkICh0eXBlLCBtb3JlKSB7XG4gICAgYWNbdHlwZV0gPSAoYWNbdHlwZV0gfHwgW10pLmNvbmNhdChtb3JlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtZWdhbWFyayAobWQsIG9wdGlvbnMpIHtcbiAgdmFyIG8gPSBvcHRpb25zIHx8IHt9O1xuICB2YXIgaHRtbCA9IG1hcmtkb3duKG1kLCBvKTtcbiAgdmFyIHNhbmUgPSBzYW5pdGl6ZShodG1sLCBvLnNhbml0aXplcik7XG4gIHJldHVybiBzYW5lO1xufVxuXG5tYXJrZG93bi5sYW5ndWFnZXMucHVzaCgnbWQtY29kZScsICdtZC1jb2RlLWlubGluZScpOyAvLyBvbmx5IHNhbml0aXppbmcgcHVycG9zZXNcbm1lZ2FtYXJrLnBhcnNlciA9IG1hcmtkb3duLnBhcnNlcjtcbm1vZHVsZS5leHBvcnRzID0gbWVnYW1hcms7XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIGFzc2lnbm1lbnQgKHJlc3VsdCkge1xuICB2YXIgc3RhY2sgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICB2YXIgaXRlbTtcbiAgdmFyIGtleTtcbiAgd2hpbGUgKHN0YWNrLmxlbmd0aCkge1xuICAgIGl0ZW0gPSBzdGFjay5zaGlmdCgpO1xuICAgIGZvciAoa2V5IGluIGl0ZW0pIHtcbiAgICAgIGlmIChpdGVtLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgaWYgKHR5cGVvZiByZXN1bHRba2V5XSA9PT0gJ29iamVjdCcgJiYgcmVzdWx0W2tleV0gJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHJlc3VsdFtrZXldKSAhPT0gJ1tvYmplY3QgQXJyYXldJykge1xuICAgICAgICAgIHJlc3VsdFtrZXldID0gYXNzaWdubWVudChyZXN1bHRba2V5XSwgaXRlbVtrZXldKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXN1bHRba2V5XSA9IGl0ZW1ba2V5XTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzdWx0O1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGFzc2lnbm1lbnQ7XG4iLCIvKiEgaHR0cHM6Ly9tdGhzLmJlL3B1bnljb2RlIHYxLjMuMiBieSBAbWF0aGlhcyAqL1xuOyhmdW5jdGlvbihyb290KSB7XG5cblx0LyoqIERldGVjdCBmcmVlIHZhcmlhYmxlcyAqL1xuXHR2YXIgZnJlZUV4cG9ydHMgPSB0eXBlb2YgZXhwb3J0cyA9PSAnb2JqZWN0JyAmJiBleHBvcnRzICYmXG5cdFx0IWV4cG9ydHMubm9kZVR5cGUgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdCFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuXHR2YXIgZnJlZUdsb2JhbCA9IHR5cGVvZiBnbG9iYWwgPT0gJ29iamVjdCcgJiYgZ2xvYmFsO1xuXHRpZiAoXG5cdFx0ZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHxcblx0XHRmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCB8fFxuXHRcdGZyZWVHbG9iYWwuc2VsZiA9PT0gZnJlZUdsb2JhbFxuXHQpIHtcblx0XHRyb290ID0gZnJlZUdsb2JhbDtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGUgYHB1bnljb2RlYCBvYmplY3QuXG5cdCAqIEBuYW1lIHB1bnljb2RlXG5cdCAqIEB0eXBlIE9iamVjdFxuXHQgKi9cblx0dmFyIHB1bnljb2RlLFxuXG5cdC8qKiBIaWdoZXN0IHBvc2l0aXZlIHNpZ25lZCAzMi1iaXQgZmxvYXQgdmFsdWUgKi9cblx0bWF4SW50ID0gMjE0NzQ4MzY0NywgLy8gYWthLiAweDdGRkZGRkZGIG9yIDJeMzEtMVxuXG5cdC8qKiBCb290c3RyaW5nIHBhcmFtZXRlcnMgKi9cblx0YmFzZSA9IDM2LFxuXHR0TWluID0gMSxcblx0dE1heCA9IDI2LFxuXHRza2V3ID0gMzgsXG5cdGRhbXAgPSA3MDAsXG5cdGluaXRpYWxCaWFzID0gNzIsXG5cdGluaXRpYWxOID0gMTI4LCAvLyAweDgwXG5cdGRlbGltaXRlciA9ICctJywgLy8gJ1xceDJEJ1xuXG5cdC8qKiBSZWd1bGFyIGV4cHJlc3Npb25zICovXG5cdHJlZ2V4UHVueWNvZGUgPSAvXnhuLS0vLFxuXHRyZWdleE5vbkFTQ0lJID0gL1teXFx4MjAtXFx4N0VdLywgLy8gdW5wcmludGFibGUgQVNDSUkgY2hhcnMgKyBub24tQVNDSUkgY2hhcnNcblx0cmVnZXhTZXBhcmF0b3JzID0gL1tcXHgyRVxcdTMwMDJcXHVGRjBFXFx1RkY2MV0vZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0dmFyIHJlc3VsdCA9IFtdO1xuXHRcdHdoaWxlIChsZW5ndGgtLSkge1xuXHRcdFx0cmVzdWx0W2xlbmd0aF0gPSBmbihhcnJheVtsZW5ndGhdKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3Mgb3IgZW1haWxcblx0ICogYWRkcmVzc2VzLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gZG9tYWluIFRoZSBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0dmFyIHBhcnRzID0gc3RyaW5nLnNwbGl0KCdAJyk7XG5cdFx0dmFyIHJlc3VsdCA9ICcnO1xuXHRcdGlmIChwYXJ0cy5sZW5ndGggPiAxKSB7XG5cdFx0XHQvLyBJbiBlbWFpbCBhZGRyZXNzZXMsIG9ubHkgdGhlIGRvbWFpbiBuYW1lIHNob3VsZCBiZSBwdW55Y29kZWQuIExlYXZlXG5cdFx0XHQvLyB0aGUgbG9jYWwgcGFydCAoaS5lLiBldmVyeXRoaW5nIHVwIHRvIGBAYCkgaW50YWN0LlxuXHRcdFx0cmVzdWx0ID0gcGFydHNbMF0gKyAnQCc7XG5cdFx0XHRzdHJpbmcgPSBwYXJ0c1sxXTtcblx0XHR9XG5cdFx0Ly8gQXZvaWQgYHNwbGl0KHJlZ2V4KWAgZm9yIElFOCBjb21wYXRpYmlsaXR5LiBTZWUgIzE3LlxuXHRcdHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKHJlZ2V4U2VwYXJhdG9ycywgJ1xceDJFJyk7XG5cdFx0dmFyIGxhYmVscyA9IHN0cmluZy5zcGxpdCgnLicpO1xuXHRcdHZhciBlbmNvZGVkID0gbWFwKGxhYmVscywgZm4pLmpvaW4oJy4nKTtcblx0XHRyZXR1cm4gcmVzdWx0ICsgZW5jb2RlZDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGUudWNzMlxuXHQgKiBAbmFtZSBkZWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IHN0cmluZyBUaGUgVW5pY29kZSBpbnB1dCBzdHJpbmcgKFVDUy0yKS5cblx0ICogQHJldHVybnMge0FycmF5fSBUaGUgbmV3IGFycmF5IG9mIGNvZGUgcG9pbnRzLlxuXHQgKi9cblx0ZnVuY3Rpb24gdWNzMmRlY29kZShzdHJpbmcpIHtcblx0XHR2YXIgb3V0cHV0ID0gW10sXG5cdFx0ICAgIGNvdW50ZXIgPSAwLFxuXHRcdCAgICBsZW5ndGggPSBzdHJpbmcubGVuZ3RoLFxuXHRcdCAgICB2YWx1ZSxcblx0XHQgICAgZXh0cmE7XG5cdFx0d2hpbGUgKGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdHZhbHVlID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdGlmICh2YWx1ZSA+PSAweEQ4MDAgJiYgdmFsdWUgPD0gMHhEQkZGICYmIGNvdW50ZXIgPCBsZW5ndGgpIHtcblx0XHRcdFx0Ly8gaGlnaCBzdXJyb2dhdGUsIGFuZCB0aGVyZSBpcyBhIG5leHQgY2hhcmFjdGVyXG5cdFx0XHRcdGV4dHJhID0gc3RyaW5nLmNoYXJDb2RlQXQoY291bnRlcisrKTtcblx0XHRcdFx0aWYgKChleHRyYSAmIDB4RkMwMCkgPT0gMHhEQzAwKSB7IC8vIGxvdyBzdXJyb2dhdGVcblx0XHRcdFx0XHRvdXRwdXQucHVzaCgoKHZhbHVlICYgMHgzRkYpIDw8IDEwKSArIChleHRyYSAmIDB4M0ZGKSArIDB4MTAwMDApO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdC8vIHVubWF0Y2hlZCBzdXJyb2dhdGU7IG9ubHkgYXBwZW5kIHRoaXMgY29kZSB1bml0LCBpbiBjYXNlIHRoZSBuZXh0XG5cdFx0XHRcdFx0Ly8gY29kZSB1bml0IGlzIHRoZSBoaWdoIHN1cnJvZ2F0ZSBvZiBhIHN1cnJvZ2F0ZSBwYWlyXG5cdFx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0XHRcdGNvdW50ZXItLTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b3V0cHV0LnB1c2godmFsdWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gb3V0cHV0O1xuXHR9XG5cblx0LyoqXG5cdCAqIENyZWF0ZXMgYSBzdHJpbmcgYmFzZWQgb24gYW4gYXJyYXkgb2YgbnVtZXJpYyBjb2RlIHBvaW50cy5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5kZWNvZGVgXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGVuY29kZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBjb2RlUG9pbnRzIFRoZSBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgbmV3IFVuaWNvZGUgc3RyaW5nIChVQ1MtMikuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZW5jb2RlKGFycmF5KSB7XG5cdFx0cmV0dXJuIG1hcChhcnJheSwgZnVuY3Rpb24odmFsdWUpIHtcblx0XHRcdHZhciBvdXRwdXQgPSAnJztcblx0XHRcdGlmICh2YWx1ZSA+IDB4RkZGRikge1xuXHRcdFx0XHR2YWx1ZSAtPSAweDEwMDAwO1xuXHRcdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlID4+PiAxMCAmIDB4M0ZGIHwgMHhEODAwKTtcblx0XHRcdFx0dmFsdWUgPSAweERDMDAgfCB2YWx1ZSAmIDB4M0ZGO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZSh2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gb3V0cHV0O1xuXHRcdH0pLmpvaW4oJycpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgYmFzaWMgY29kZSBwb2ludCBpbnRvIGEgZGlnaXQvaW50ZWdlci5cblx0ICogQHNlZSBgZGlnaXRUb0Jhc2ljKClgXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7TnVtYmVyfSBjb2RlUG9pbnQgVGhlIGJhc2ljIG51bWVyaWMgY29kZSBwb2ludCB2YWx1ZS5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50IChmb3IgdXNlIGluXG5cdCAqIHJlcHJlc2VudGluZyBpbnRlZ2VycykgaW4gdGhlIHJhbmdlIGAwYCB0byBgYmFzZSAtIDFgLCBvciBgYmFzZWAgaWZcblx0ICogdGhlIGNvZGUgcG9pbnQgZG9lcyBub3QgcmVwcmVzZW50IGEgdmFsdWUuXG5cdCAqL1xuXHRmdW5jdGlvbiBiYXNpY1RvRGlnaXQoY29kZVBvaW50KSB7XG5cdFx0aWYgKGNvZGVQb2ludCAtIDQ4IDwgMTApIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSAyMjtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDY1IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA2NTtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCAtIDk3IDwgMjYpIHtcblx0XHRcdHJldHVybiBjb2RlUG9pbnQgLSA5Nztcblx0XHR9XG5cdFx0cmV0dXJuIGJhc2U7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBkaWdpdC9pbnRlZ2VyIGludG8gYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAc2VlIGBiYXNpY1RvRGlnaXQoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGRpZ2l0IFRoZSBudW1lcmljIHZhbHVlIG9mIGEgYmFzaWMgY29kZSBwb2ludC5cblx0ICogQHJldHVybnMge051bWJlcn0gVGhlIGJhc2ljIGNvZGUgcG9pbnQgd2hvc2UgdmFsdWUgKHdoZW4gdXNlZCBmb3Jcblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpcyBgZGlnaXRgLCB3aGljaCBuZWVkcyB0byBiZSBpbiB0aGUgcmFuZ2Vcblx0ICogYDBgIHRvIGBiYXNlIC0gMWAuIElmIGBmbGFnYCBpcyBub24temVybywgdGhlIHVwcGVyY2FzZSBmb3JtIGlzXG5cdCAqIHVzZWQ7IGVsc2UsIHRoZSBsb3dlcmNhc2UgZm9ybSBpcyB1c2VkLiBUaGUgYmVoYXZpb3IgaXMgdW5kZWZpbmVkXG5cdCAqIGlmIGBmbGFnYCBpcyBub24temVybyBhbmQgYGRpZ2l0YCBoYXMgbm8gdXBwZXJjYXNlIGZvcm0uXG5cdCAqL1xuXHRmdW5jdGlvbiBkaWdpdFRvQmFzaWMoZGlnaXQsIGZsYWcpIHtcblx0XHQvLyAgMC4uMjUgbWFwIHRvIEFTQ0lJIGEuLnogb3IgQS4uWlxuXHRcdC8vIDI2Li4zNSBtYXAgdG8gQVNDSUkgMC4uOVxuXHRcdHJldHVybiBkaWdpdCArIDIyICsgNzUgKiAoZGlnaXQgPCAyNikgLSAoKGZsYWcgIT0gMCkgPDwgNSk7XG5cdH1cblxuXHQvKipcblx0ICogQmlhcyBhZGFwdGF0aW9uIGZ1bmN0aW9uIGFzIHBlciBzZWN0aW9uIDMuNCBvZiBSRkMgMzQ5Mi5cblx0ICogaHR0cDovL3Rvb2xzLmlldGYub3JnL2h0bWwvcmZjMzQ5MiNzZWN0aW9uLTMuNFxuXHQgKiBAcHJpdmF0ZVxuXHQgKi9cblx0ZnVuY3Rpb24gYWRhcHQoZGVsdGEsIG51bVBvaW50cywgZmlyc3RUaW1lKSB7XG5cdFx0dmFyIGsgPSAwO1xuXHRcdGRlbHRhID0gZmlyc3RUaW1lID8gZmxvb3IoZGVsdGEgLyBkYW1wKSA6IGRlbHRhID4+IDE7XG5cdFx0ZGVsdGEgKz0gZmxvb3IoZGVsdGEgLyBudW1Qb2ludHMpO1xuXHRcdGZvciAoLyogbm8gaW5pdGlhbGl6YXRpb24gKi87IGRlbHRhID4gYmFzZU1pbnVzVE1pbiAqIHRNYXggPj4gMTsgayArPSBiYXNlKSB7XG5cdFx0XHRkZWx0YSA9IGZsb29yKGRlbHRhIC8gYmFzZU1pbnVzVE1pbik7XG5cdFx0fVxuXHRcdHJldHVybiBmbG9vcihrICsgKGJhc2VNaW51c1RNaW4gKyAxKSAqIGRlbHRhIC8gKGRlbHRhICsgc2tldykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scyB0byBhIHN0cmluZyBvZiBVbmljb2RlXG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGRlY29kZShpbnB1dCkge1xuXHRcdC8vIERvbid0IHVzZSBVQ1MtMlxuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgaW5wdXRMZW5ndGggPSBpbnB1dC5sZW5ndGgsXG5cdFx0ICAgIG91dCxcblx0XHQgICAgaSA9IDAsXG5cdFx0ICAgIG4gPSBpbml0aWFsTixcblx0XHQgICAgYmlhcyA9IGluaXRpYWxCaWFzLFxuXHRcdCAgICBiYXNpYyxcblx0XHQgICAgaixcblx0XHQgICAgaW5kZXgsXG5cdFx0ICAgIG9sZGksXG5cdFx0ICAgIHcsXG5cdFx0ICAgIGssXG5cdFx0ICAgIGRpZ2l0LFxuXHRcdCAgICB0LFxuXHRcdCAgICAvKiogQ2FjaGVkIGNhbGN1bGF0aW9uIHJlc3VsdHMgKi9cblx0XHQgICAgYmFzZU1pbnVzVDtcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHM6IGxldCBgYmFzaWNgIGJlIHRoZSBudW1iZXIgb2YgaW5wdXQgY29kZVxuXHRcdC8vIHBvaW50cyBiZWZvcmUgdGhlIGxhc3QgZGVsaW1pdGVyLCBvciBgMGAgaWYgdGhlcmUgaXMgbm9uZSwgdGhlbiBjb3B5XG5cdFx0Ly8gdGhlIGZpcnN0IGJhc2ljIGNvZGUgcG9pbnRzIHRvIHRoZSBvdXRwdXQuXG5cblx0XHRiYXNpYyA9IGlucHV0Lmxhc3RJbmRleE9mKGRlbGltaXRlcik7XG5cdFx0aWYgKGJhc2ljIDwgMCkge1xuXHRcdFx0YmFzaWMgPSAwO1xuXHRcdH1cblxuXHRcdGZvciAoaiA9IDA7IGogPCBiYXNpYzsgKytqKSB7XG5cdFx0XHQvLyBpZiBpdCdzIG5vdCBhIGJhc2ljIGNvZGUgcG9pbnRcblx0XHRcdGlmIChpbnB1dC5jaGFyQ29kZUF0KGopID49IDB4ODApIHtcblx0XHRcdFx0ZXJyb3IoJ25vdC1iYXNpYycpO1xuXHRcdFx0fVxuXHRcdFx0b3V0cHV0LnB1c2goaW5wdXQuY2hhckNvZGVBdChqKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBkZWNvZGluZyBsb29wOiBzdGFydCBqdXN0IGFmdGVyIHRoZSBsYXN0IGRlbGltaXRlciBpZiBhbnkgYmFzaWMgY29kZVxuXHRcdC8vIHBvaW50cyB3ZXJlIGNvcGllZDsgc3RhcnQgYXQgdGhlIGJlZ2lubmluZyBvdGhlcndpc2UuXG5cblx0XHRmb3IgKGluZGV4ID0gYmFzaWMgPiAwID8gYmFzaWMgKyAxIDogMDsgaW5kZXggPCBpbnB1dExlbmd0aDsgLyogbm8gZmluYWwgZXhwcmVzc2lvbiAqLykge1xuXG5cdFx0XHQvLyBgaW5kZXhgIGlzIHRoZSBpbmRleCBvZiB0aGUgbmV4dCBjaGFyYWN0ZXIgdG8gYmUgY29uc3VtZWQuXG5cdFx0XHQvLyBEZWNvZGUgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlciBpbnRvIGBkZWx0YWAsXG5cdFx0XHQvLyB3aGljaCBnZXRzIGFkZGVkIHRvIGBpYC4gVGhlIG92ZXJmbG93IGNoZWNraW5nIGlzIGVhc2llclxuXHRcdFx0Ly8gaWYgd2UgaW5jcmVhc2UgYGlgIGFzIHdlIGdvLCB0aGVuIHN1YnRyYWN0IG9mZiBpdHMgc3RhcnRpbmdcblx0XHRcdC8vIHZhbHVlIGF0IHRoZSBlbmQgdG8gb2J0YWluIGBkZWx0YWAuXG5cdFx0XHRmb3IgKG9sZGkgPSBpLCB3ID0gMSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cblx0XHRcdFx0aWYgKGluZGV4ID49IGlucHV0TGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ2ludmFsaWQtaW5wdXQnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRpZ2l0ID0gYmFzaWNUb0RpZ2l0KGlucHV0LmNoYXJDb2RlQXQoaW5kZXgrKykpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA+PSBiYXNlIHx8IGRpZ2l0ID4gZmxvb3IoKG1heEludCAtIGkpIC8gdykpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGkgKz0gZGlnaXQgKiB3O1xuXHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblxuXHRcdFx0XHRpZiAoZGlnaXQgPCB0KSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRiYXNlTWludXNUID0gYmFzZSAtIHQ7XG5cdFx0XHRcdGlmICh3ID4gZmxvb3IobWF4SW50IC8gYmFzZU1pbnVzVCkpIHtcblx0XHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHcgKj0gYmFzZU1pbnVzVDtcblxuXHRcdFx0fVxuXG5cdFx0XHRvdXQgPSBvdXRwdXQubGVuZ3RoICsgMTtcblx0XHRcdGJpYXMgPSBhZGFwdChpIC0gb2xkaSwgb3V0LCBvbGRpID09IDApO1xuXG5cdFx0XHQvLyBgaWAgd2FzIHN1cHBvc2VkIHRvIHdyYXAgYXJvdW5kIGZyb20gYG91dGAgdG8gYDBgLFxuXHRcdFx0Ly8gaW5jcmVtZW50aW5nIGBuYCBlYWNoIHRpbWUsIHNvIHdlJ2xsIGZpeCB0aGF0IG5vdzpcblx0XHRcdGlmIChmbG9vcihpIC8gb3V0KSA+IG1heEludCAtIG4pIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdG4gKz0gZmxvb3IoaSAvIG91dCk7XG5cdFx0XHRpICU9IG91dDtcblxuXHRcdFx0Ly8gSW5zZXJ0IGBuYCBhdCBwb3NpdGlvbiBgaWAgb2YgdGhlIG91dHB1dFxuXHRcdFx0b3V0cHV0LnNwbGljZShpKyssIDAsIG4pO1xuXG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVjczJlbmNvZGUob3V0cHV0KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMgKGUuZy4gYSBkb21haW4gbmFtZSBsYWJlbCkgdG8gYVxuXHQgKiBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgcmVzdWx0aW5nIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5IHN5bWJvbHMuXG5cdCAqL1xuXHRmdW5jdGlvbiBlbmNvZGUoaW5wdXQpIHtcblx0XHR2YXIgbixcblx0XHQgICAgZGVsdGEsXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50LFxuXHRcdCAgICBiYXNpY0xlbmd0aCxcblx0XHQgICAgYmlhcyxcblx0XHQgICAgaixcblx0XHQgICAgbSxcblx0XHQgICAgcSxcblx0XHQgICAgayxcblx0XHQgICAgdCxcblx0XHQgICAgY3VycmVudFZhbHVlLFxuXHRcdCAgICBvdXRwdXQgPSBbXSxcblx0XHQgICAgLyoqIGBpbnB1dExlbmd0aGAgd2lsbCBob2xkIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgaW4gYGlucHV0YC4gKi9cblx0XHQgICAgaW5wdXRMZW5ndGgsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsXG5cdFx0ICAgIGJhc2VNaW51c1QsXG5cdFx0ICAgIHFNaW51c1Q7XG5cblx0XHQvLyBDb252ZXJ0IHRoZSBpbnB1dCBpbiBVQ1MtMiB0byBVbmljb2RlXG5cdFx0aW5wdXQgPSB1Y3MyZGVjb2RlKGlucHV0KTtcblxuXHRcdC8vIENhY2hlIHRoZSBsZW5ndGhcblx0XHRpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aDtcblxuXHRcdC8vIEluaXRpYWxpemUgdGhlIHN0YXRlXG5cdFx0biA9IGluaXRpYWxOO1xuXHRcdGRlbHRhID0gMDtcblx0XHRiaWFzID0gaW5pdGlhbEJpYXM7XG5cblx0XHQvLyBIYW5kbGUgdGhlIGJhc2ljIGNvZGUgcG9pbnRzXG5cdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdGN1cnJlbnRWYWx1ZSA9IGlucHV0W2pdO1xuXHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IDB4ODApIHtcblx0XHRcdFx0b3V0cHV0LnB1c2goc3RyaW5nRnJvbUNoYXJDb2RlKGN1cnJlbnRWYWx1ZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGhhbmRsZWRDUENvdW50ID0gYmFzaWNMZW5ndGggPSBvdXRwdXQubGVuZ3RoO1xuXG5cdFx0Ly8gYGhhbmRsZWRDUENvdW50YCBpcyB0aGUgbnVtYmVyIG9mIGNvZGUgcG9pbnRzIHRoYXQgaGF2ZSBiZWVuIGhhbmRsZWQ7XG5cdFx0Ly8gYGJhc2ljTGVuZ3RoYCBpcyB0aGUgbnVtYmVyIG9mIGJhc2ljIGNvZGUgcG9pbnRzLlxuXG5cdFx0Ly8gRmluaXNoIHRoZSBiYXNpYyBzdHJpbmcgLSBpZiBpdCBpcyBub3QgZW1wdHkgLSB3aXRoIGEgZGVsaW1pdGVyXG5cdFx0aWYgKGJhc2ljTGVuZ3RoKSB7XG5cdFx0XHRvdXRwdXQucHVzaChkZWxpbWl0ZXIpO1xuXHRcdH1cblxuXHRcdC8vIE1haW4gZW5jb2RpbmcgbG9vcDpcblx0XHR3aGlsZSAoaGFuZGxlZENQQ291bnQgPCBpbnB1dExlbmd0aCkge1xuXG5cdFx0XHQvLyBBbGwgbm9uLWJhc2ljIGNvZGUgcG9pbnRzIDwgbiBoYXZlIGJlZW4gaGFuZGxlZCBhbHJlYWR5LiBGaW5kIHRoZSBuZXh0XG5cdFx0XHQvLyBsYXJnZXIgb25lOlxuXHRcdFx0Zm9yIChtID0gbWF4SW50LCBqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRcdGlmIChjdXJyZW50VmFsdWUgPj0gbiAmJiBjdXJyZW50VmFsdWUgPCBtKSB7XG5cdFx0XHRcdFx0bSA9IGN1cnJlbnRWYWx1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBJbmNyZWFzZSBgZGVsdGFgIGVub3VnaCB0byBhZHZhbmNlIHRoZSBkZWNvZGVyJ3MgPG4saT4gc3RhdGUgdG8gPG0sMD4sXG5cdFx0XHQvLyBidXQgZ3VhcmQgYWdhaW5zdCBvdmVyZmxvd1xuXHRcdFx0aGFuZGxlZENQQ291bnRQbHVzT25lID0gaGFuZGxlZENQQ291bnQgKyAxO1xuXHRcdFx0aWYgKG0gLSBuID4gZmxvb3IoKG1heEludCAtIGRlbHRhKSAvIGhhbmRsZWRDUENvdW50UGx1c09uZSkpIHtcblx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHR9XG5cblx0XHRcdGRlbHRhICs9IChtIC0gbikgKiBoYW5kbGVkQ1BDb3VudFBsdXNPbmU7XG5cdFx0XHRuID0gbTtcblxuXHRcdFx0Zm9yIChqID0gMDsgaiA8IGlucHV0TGVuZ3RoOyArK2opIHtcblx0XHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA8IG4gJiYgKytkZWx0YSA+IG1heEludCkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA9PSBuKSB7XG5cdFx0XHRcdFx0Ly8gUmVwcmVzZW50IGRlbHRhIGFzIGEgZ2VuZXJhbGl6ZWQgdmFyaWFibGUtbGVuZ3RoIGludGVnZXJcblx0XHRcdFx0XHRmb3IgKHEgPSBkZWx0YSwgayA9IGJhc2U7IC8qIG5vIGNvbmRpdGlvbiAqLzsgayArPSBiYXNlKSB7XG5cdFx0XHRcdFx0XHR0ID0gayA8PSBiaWFzID8gdE1pbiA6IChrID49IGJpYXMgKyB0TWF4ID8gdE1heCA6IGsgLSBiaWFzKTtcblx0XHRcdFx0XHRcdGlmIChxIDwgdCkge1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHFNaW51c1QgPSBxIC0gdDtcblx0XHRcdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0XHRcdG91dHB1dC5wdXNoKFxuXHRcdFx0XHRcdFx0XHRzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHQgKyBxTWludXNUICUgYmFzZU1pbnVzVCwgMCkpXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdFx0cSA9IGZsb29yKHFNaW51c1QgLyBiYXNlTWludXNUKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoZGlnaXRUb0Jhc2ljKHEsIDApKSk7XG5cdFx0XHRcdFx0YmlhcyA9IGFkYXB0KGRlbHRhLCBoYW5kbGVkQ1BDb3VudFBsdXNPbmUsIGhhbmRsZWRDUENvdW50ID09IGJhc2ljTGVuZ3RoKTtcblx0XHRcdFx0XHRkZWx0YSA9IDA7XG5cdFx0XHRcdFx0KytoYW5kbGVkQ1BDb3VudDtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQrK2RlbHRhO1xuXHRcdFx0KytuO1xuXG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzc1xuXHQgKiB0byBVbmljb2RlLiBPbmx5IHRoZSBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGlucHV0IHdpbGwgYmUgY29udmVydGVkLCBpLmUuXG5cdCAqIGl0IGRvZXNuJ3QgbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlblxuXHQgKiBjb252ZXJ0ZWQgdG8gVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGVkIGRvbWFpbiBuYW1lIG9yIGVtYWlsIGFkZHJlc3MgdG9cblx0ICogY29udmVydCB0byBVbmljb2RlLlxuXHQgKiBAcmV0dXJucyB7U3RyaW5nfSBUaGUgVW5pY29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gUHVueWNvZGVcblx0ICogc3RyaW5nLlxuXHQgKi9cblx0ZnVuY3Rpb24gdG9Vbmljb2RlKGlucHV0KSB7XG5cdFx0cmV0dXJuIG1hcERvbWFpbihpbnB1dCwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgb3IgYW4gZW1haWwgYWRkcmVzcyB0b1xuXHQgKiBQdW55Y29kZS4gT25seSB0aGUgbm9uLUFTQ0lJIHBhcnRzIG9mIHRoZSBkb21haW4gbmFtZSB3aWxsIGJlIGNvbnZlcnRlZCxcblx0ICogaS5lLiBpdCBkb2Vzbid0IG1hdHRlciBpZiB5b3UgY2FsbCBpdCB3aXRoIGEgZG9tYWluIHRoYXQncyBhbHJlYWR5IGluXG5cdCAqIEFTQ0lJLlxuXHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0ICogQHBhcmFtIHtTdHJpbmd9IGlucHV0IFRoZSBkb21haW4gbmFtZSBvciBlbWFpbCBhZGRyZXNzIHRvIGNvbnZlcnQsIGFzIGFcblx0ICogVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUgb3Jcblx0ICogZW1haWwgYWRkcmVzcy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvQVNDSUkoaW5wdXQpIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGlucHV0LCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS4zLjInLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvamF2YXNjcmlwdC1lbmNvZGluZz5cblx0XHQgKiBAbWVtYmVyT2YgcHVueWNvZGVcblx0XHQgKiBAdHlwZSBPYmplY3Rcblx0XHQgKi9cblx0XHQndWNzMic6IHtcblx0XHRcdCdkZWNvZGUnOiB1Y3MyZGVjb2RlLFxuXHRcdFx0J2VuY29kZSc6IHVjczJlbmNvZGVcblx0XHR9LFxuXHRcdCdkZWNvZGUnOiBkZWNvZGUsXG5cdFx0J2VuY29kZSc6IGVuY29kZSxcblx0XHQndG9BU0NJSSc6IHRvQVNDSUksXG5cdFx0J3RvVW5pY29kZSc6IHRvVW5pY29kZVxuXHR9O1xuXG5cdC8qKiBFeHBvc2UgYHB1bnljb2RlYCAqL1xuXHQvLyBTb21lIEFNRCBidWlsZCBvcHRpbWl6ZXJzLCBsaWtlIHIuanMsIGNoZWNrIGZvciBzcGVjaWZpYyBjb25kaXRpb24gcGF0dGVybnNcblx0Ly8gbGlrZSB0aGUgZm9sbG93aW5nOlxuXHRpZiAoXG5cdFx0dHlwZW9mIGRlZmluZSA9PSAnZnVuY3Rpb24nICYmXG5cdFx0dHlwZW9mIGRlZmluZS5hbWQgPT0gJ29iamVjdCcgJiZcblx0XHRkZWZpbmUuYW1kXG5cdCkge1xuXHRcdGRlZmluZSgncHVueWNvZGUnLCBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBwdW55Y29kZTtcblx0XHR9KTtcblx0fSBlbHNlIGlmIChmcmVlRXhwb3J0cyAmJiBmcmVlTW9kdWxlKSB7XG5cdFx0aWYgKG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzKSB7IC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2UgeyAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHsgLy8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiIsInZhciBIaWdobGlnaHQgPSBmdW5jdGlvbigpIHtcblxuICAvKiBVdGlsaXR5IGZ1bmN0aW9ucyAqL1xuXG4gIGZ1bmN0aW9uIGVzY2FwZSh2YWx1ZSkge1xuICAgIHJldHVybiB2YWx1ZS5yZXBsYWNlKC8mL2dtLCAnJmFtcDsnKS5yZXBsYWNlKC88L2dtLCAnJmx0OycpLnJlcGxhY2UoLz4vZ20sICcmZ3Q7Jyk7XG4gIH1cblxuICBmdW5jdGlvbiB0YWcobm9kZSkge1xuICAgIHJldHVybiBub2RlLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCk7XG4gIH1cblxuICBmdW5jdGlvbiB0ZXN0UmUocmUsIGxleGVtZSkge1xuICAgIHZhciBtYXRjaCA9IHJlICYmIHJlLmV4ZWMobGV4ZW1lKTtcbiAgICByZXR1cm4gbWF0Y2ggJiYgbWF0Y2guaW5kZXggPT0gMDtcbiAgfVxuXG4gIGZ1bmN0aW9uIGJsb2NrVGV4dChibG9jaykge1xuICAgIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoYmxvY2suY2hpbGROb2RlcywgZnVuY3Rpb24obm9kZSkge1xuICAgICAgaWYgKG5vZGUubm9kZVR5cGUgPT0gMykge1xuICAgICAgICByZXR1cm4gb3B0aW9ucy51c2VCUiA/IG5vZGUubm9kZVZhbHVlLnJlcGxhY2UoL1xcbi9nLCAnJykgOiBub2RlLm5vZGVWYWx1ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0YWcobm9kZSkgPT0gJ2JyJykge1xuICAgICAgICByZXR1cm4gJ1xcbic7XG4gICAgICB9XG4gICAgICByZXR1cm4gYmxvY2tUZXh0KG5vZGUpO1xuICAgIH0pLmpvaW4oJycpO1xuICB9XG5cbiAgZnVuY3Rpb24gYmxvY2tMYW5ndWFnZShibG9jaykge1xuICAgIHZhciBjbGFzc2VzID0gKGJsb2NrLmNsYXNzTmFtZSArICcgJyArIChibG9jay5wYXJlbnROb2RlID8gYmxvY2sucGFyZW50Tm9kZS5jbGFzc05hbWUgOiAnJykpLnNwbGl0KC9cXHMrLyk7XG4gICAgY2xhc3NlcyA9IGNsYXNzZXMubWFwKGZ1bmN0aW9uKGMpIHtyZXR1cm4gYy5yZXBsYWNlKC9ebGFuZ3VhZ2UtLywgJycpO30pO1xuICAgIHJldHVybiBjbGFzc2VzLmZpbHRlcihmdW5jdGlvbihjKSB7cmV0dXJuIGdldExhbmd1YWdlKGMpIHx8IGMgPT0gJ25vLWhpZ2hsaWdodCc7fSlbMF07XG4gIH1cblxuICBmdW5jdGlvbiBpbmhlcml0KHBhcmVudCwgb2JqKSB7XG4gICAgdmFyIHJlc3VsdCA9IHt9O1xuICAgIGZvciAodmFyIGtleSBpbiBwYXJlbnQpXG4gICAgICByZXN1bHRba2V5XSA9IHBhcmVudFtrZXldO1xuICAgIGlmIChvYmopXG4gICAgICBmb3IgKHZhciBrZXkgaW4gb2JqKVxuICAgICAgICByZXN1bHRba2V5XSA9IG9ialtrZXldO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH07XG5cbiAgLyogU3RyZWFtIG1lcmdpbmcgKi9cblxuICBmdW5jdGlvbiBub2RlU3RyZWFtKG5vZGUpIHtcbiAgICB2YXIgcmVzdWx0ID0gW107XG4gICAgKGZ1bmN0aW9uIF9ub2RlU3RyZWFtKG5vZGUsIG9mZnNldCkge1xuICAgICAgZm9yICh2YXIgY2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQ7IGNoaWxkOyBjaGlsZCA9IGNoaWxkLm5leHRTaWJsaW5nKSB7XG4gICAgICAgIGlmIChjaGlsZC5ub2RlVHlwZSA9PSAzKVxuICAgICAgICAgIG9mZnNldCArPSBjaGlsZC5ub2RlVmFsdWUubGVuZ3RoO1xuICAgICAgICBlbHNlIGlmICh0YWcoY2hpbGQpID09ICdicicpXG4gICAgICAgICAgb2Zmc2V0ICs9IDE7XG4gICAgICAgIGVsc2UgaWYgKGNoaWxkLm5vZGVUeXBlID09IDEpIHtcbiAgICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICBldmVudDogJ3N0YXJ0JyxcbiAgICAgICAgICAgIG9mZnNldDogb2Zmc2V0LFxuICAgICAgICAgICAgbm9kZTogY2hpbGRcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBvZmZzZXQgPSBfbm9kZVN0cmVhbShjaGlsZCwgb2Zmc2V0KTtcbiAgICAgICAgICByZXN1bHQucHVzaCh7XG4gICAgICAgICAgICBldmVudDogJ3N0b3AnLFxuICAgICAgICAgICAgb2Zmc2V0OiBvZmZzZXQsXG4gICAgICAgICAgICBub2RlOiBjaGlsZFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICByZXR1cm4gb2Zmc2V0O1xuICAgIH0pKG5vZGUsIDApO1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICBmdW5jdGlvbiBtZXJnZVN0cmVhbXMob3JpZ2luYWwsIGhpZ2hsaWdodGVkLCB2YWx1ZSkge1xuICAgIHZhciBwcm9jZXNzZWQgPSAwO1xuICAgIHZhciByZXN1bHQgPSAnJztcbiAgICB2YXIgbm9kZVN0YWNrID0gW107XG5cbiAgICBmdW5jdGlvbiBzZWxlY3RTdHJlYW0oKSB7XG4gICAgICBpZiAoIW9yaWdpbmFsLmxlbmd0aCB8fCAhaGlnaGxpZ2h0ZWQubGVuZ3RoKSB7XG4gICAgICAgIHJldHVybiBvcmlnaW5hbC5sZW5ndGggPyBvcmlnaW5hbCA6IGhpZ2hsaWdodGVkO1xuICAgICAgfVxuICAgICAgaWYgKG9yaWdpbmFsWzBdLm9mZnNldCAhPSBoaWdobGlnaHRlZFswXS5vZmZzZXQpIHtcbiAgICAgICAgcmV0dXJuIChvcmlnaW5hbFswXS5vZmZzZXQgPCBoaWdobGlnaHRlZFswXS5vZmZzZXQpID8gb3JpZ2luYWwgOiBoaWdobGlnaHRlZDtcbiAgICAgIH1cblxuICAgICAgLypcbiAgICAgIFRvIGF2b2lkIHN0YXJ0aW5nIHRoZSBzdHJlYW0ganVzdCBiZWZvcmUgaXQgc2hvdWxkIHN0b3AgdGhlIG9yZGVyIGlzXG4gICAgICBlbnN1cmVkIHRoYXQgb3JpZ2luYWwgYWx3YXlzIHN0YXJ0cyBmaXJzdCBhbmQgY2xvc2VzIGxhc3Q6XG5cbiAgICAgIGlmIChldmVudDEgPT0gJ3N0YXJ0JyAmJiBldmVudDIgPT0gJ3N0YXJ0JylcbiAgICAgICAgcmV0dXJuIG9yaWdpbmFsO1xuICAgICAgaWYgKGV2ZW50MSA9PSAnc3RhcnQnICYmIGV2ZW50MiA9PSAnc3RvcCcpXG4gICAgICAgIHJldHVybiBoaWdobGlnaHRlZDtcbiAgICAgIGlmIChldmVudDEgPT0gJ3N0b3AnICYmIGV2ZW50MiA9PSAnc3RhcnQnKVxuICAgICAgICByZXR1cm4gb3JpZ2luYWw7XG4gICAgICBpZiAoZXZlbnQxID09ICdzdG9wJyAmJiBldmVudDIgPT0gJ3N0b3AnKVxuICAgICAgICByZXR1cm4gaGlnaGxpZ2h0ZWQ7XG5cbiAgICAgIC4uLiB3aGljaCBpcyBjb2xsYXBzZWQgdG86XG4gICAgICAqL1xuICAgICAgcmV0dXJuIGhpZ2hsaWdodGVkWzBdLmV2ZW50ID09ICdzdGFydCcgPyBvcmlnaW5hbCA6IGhpZ2hsaWdodGVkO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIG9wZW4obm9kZSkge1xuICAgICAgZnVuY3Rpb24gYXR0cl9zdHIoYSkge3JldHVybiAnICcgKyBhLm5vZGVOYW1lICsgJz1cIicgKyBlc2NhcGUoYS52YWx1ZSkgKyAnXCInO31cbiAgICAgIHJlc3VsdCArPSAnPCcgKyB0YWcobm9kZSkgKyBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwobm9kZS5hdHRyaWJ1dGVzLCBhdHRyX3N0cikuam9pbignJykgKyAnPic7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gY2xvc2Uobm9kZSkge1xuICAgICAgcmVzdWx0ICs9ICc8LycgKyB0YWcobm9kZSkgKyAnPic7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gcmVuZGVyKGV2ZW50KSB7XG4gICAgICAoZXZlbnQuZXZlbnQgPT0gJ3N0YXJ0JyA/IG9wZW4gOiBjbG9zZSkoZXZlbnQubm9kZSk7XG4gICAgfVxuXG4gICAgd2hpbGUgKG9yaWdpbmFsLmxlbmd0aCB8fCBoaWdobGlnaHRlZC5sZW5ndGgpIHtcbiAgICAgIHZhciBzdHJlYW0gPSBzZWxlY3RTdHJlYW0oKTtcbiAgICAgIHJlc3VsdCArPSBlc2NhcGUodmFsdWUuc3Vic3RyKHByb2Nlc3NlZCwgc3RyZWFtWzBdLm9mZnNldCAtIHByb2Nlc3NlZCkpO1xuICAgICAgcHJvY2Vzc2VkID0gc3RyZWFtWzBdLm9mZnNldDtcbiAgICAgIGlmIChzdHJlYW0gPT0gb3JpZ2luYWwpIHtcbiAgICAgICAgLypcbiAgICAgICAgT24gYW55IG9wZW5pbmcgb3IgY2xvc2luZyB0YWcgb2YgdGhlIG9yaWdpbmFsIG1hcmt1cCB3ZSBmaXJzdCBjbG9zZVxuICAgICAgICB0aGUgZW50aXJlIGhpZ2hsaWdodGVkIG5vZGUgc3RhY2ssIHRoZW4gcmVuZGVyIHRoZSBvcmlnaW5hbCB0YWcgYWxvbmdcbiAgICAgICAgd2l0aCBhbGwgdGhlIGZvbGxvd2luZyBvcmlnaW5hbCB0YWdzIGF0IHRoZSBzYW1lIG9mZnNldCBhbmQgdGhlblxuICAgICAgICByZW9wZW4gYWxsIHRoZSB0YWdzIG9uIHRoZSBoaWdobGlnaHRlZCBzdGFjay5cbiAgICAgICAgKi9cbiAgICAgICAgbm9kZVN0YWNrLnJldmVyc2UoKS5mb3JFYWNoKGNsb3NlKTtcbiAgICAgICAgZG8ge1xuICAgICAgICAgIHJlbmRlcihzdHJlYW0uc3BsaWNlKDAsIDEpWzBdKTtcbiAgICAgICAgICBzdHJlYW0gPSBzZWxlY3RTdHJlYW0oKTtcbiAgICAgICAgfSB3aGlsZSAoc3RyZWFtID09IG9yaWdpbmFsICYmIHN0cmVhbS5sZW5ndGggJiYgc3RyZWFtWzBdLm9mZnNldCA9PSBwcm9jZXNzZWQpO1xuICAgICAgICBub2RlU3RhY2sucmV2ZXJzZSgpLmZvckVhY2gob3Blbik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoc3RyZWFtWzBdLmV2ZW50ID09ICdzdGFydCcpIHtcbiAgICAgICAgICBub2RlU3RhY2sucHVzaChzdHJlYW1bMF0ubm9kZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbm9kZVN0YWNrLnBvcCgpO1xuICAgICAgICB9XG4gICAgICAgIHJlbmRlcihzdHJlYW0uc3BsaWNlKDAsIDEpWzBdKTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdCArIGVzY2FwZSh2YWx1ZS5zdWJzdHIocHJvY2Vzc2VkKSk7XG4gIH1cblxuICAvKiBJbml0aWFsaXphdGlvbiAqL1xuXG4gIGZ1bmN0aW9uIGNvbXBpbGVMYW5ndWFnZShsYW5ndWFnZSkge1xuXG4gICAgZnVuY3Rpb24gcmVTdHIocmUpIHtcbiAgICAgICAgcmV0dXJuIChyZSAmJiByZS5zb3VyY2UpIHx8IHJlO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGxhbmdSZSh2YWx1ZSwgZ2xvYmFsKSB7XG4gICAgICByZXR1cm4gUmVnRXhwKFxuICAgICAgICByZVN0cih2YWx1ZSksXG4gICAgICAgICdtJyArIChsYW5ndWFnZS5jYXNlX2luc2Vuc2l0aXZlID8gJ2knIDogJycpICsgKGdsb2JhbCA/ICdnJyA6ICcnKVxuICAgICAgKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBjb21waWxlTW9kZShtb2RlLCBwYXJlbnQpIHtcbiAgICAgIGlmIChtb2RlLmNvbXBpbGVkKVxuICAgICAgICByZXR1cm47XG4gICAgICBtb2RlLmNvbXBpbGVkID0gdHJ1ZTtcblxuICAgICAgbW9kZS5rZXl3b3JkcyA9IG1vZGUua2V5d29yZHMgfHwgbW9kZS5iZWdpbktleXdvcmRzO1xuICAgICAgaWYgKG1vZGUua2V5d29yZHMpIHtcbiAgICAgICAgdmFyIGNvbXBpbGVkX2tleXdvcmRzID0ge307XG5cbiAgICAgICAgZnVuY3Rpb24gZmxhdHRlbihjbGFzc05hbWUsIHN0cikge1xuICAgICAgICAgIGlmIChsYW5ndWFnZS5jYXNlX2luc2Vuc2l0aXZlKSB7XG4gICAgICAgICAgICBzdHIgPSBzdHIudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc3RyLnNwbGl0KCcgJykuZm9yRWFjaChmdW5jdGlvbihrdykge1xuICAgICAgICAgICAgdmFyIHBhaXIgPSBrdy5zcGxpdCgnfCcpO1xuICAgICAgICAgICAgY29tcGlsZWRfa2V5d29yZHNbcGFpclswXV0gPSBbY2xhc3NOYW1lLCBwYWlyWzFdID8gTnVtYmVyKHBhaXJbMV0pIDogMV07XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodHlwZW9mIG1vZGUua2V5d29yZHMgPT0gJ3N0cmluZycpIHsgLy8gc3RyaW5nXG4gICAgICAgICAgZmxhdHRlbigna2V5d29yZCcsIG1vZGUua2V5d29yZHMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIE9iamVjdC5rZXlzKG1vZGUua2V5d29yZHMpLmZvckVhY2goZnVuY3Rpb24gKGNsYXNzTmFtZSkge1xuICAgICAgICAgICAgZmxhdHRlbihjbGFzc05hbWUsIG1vZGUua2V5d29yZHNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgbW9kZS5rZXl3b3JkcyA9IGNvbXBpbGVkX2tleXdvcmRzO1xuICAgICAgfVxuICAgICAgbW9kZS5sZXhlbWVzUmUgPSBsYW5nUmUobW9kZS5sZXhlbWVzIHx8IC9cXGJbQS1aYS16MC05X10rXFxiLywgdHJ1ZSk7XG5cbiAgICAgIGlmIChwYXJlbnQpIHtcbiAgICAgICAgaWYgKG1vZGUuYmVnaW5LZXl3b3Jkcykge1xuICAgICAgICAgIG1vZGUuYmVnaW4gPSBtb2RlLmJlZ2luS2V5d29yZHMuc3BsaXQoJyAnKS5qb2luKCd8Jyk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCFtb2RlLmJlZ2luKVxuICAgICAgICAgIG1vZGUuYmVnaW4gPSAvXFxCfFxcYi87XG4gICAgICAgIG1vZGUuYmVnaW5SZSA9IGxhbmdSZShtb2RlLmJlZ2luKTtcbiAgICAgICAgaWYgKCFtb2RlLmVuZCAmJiAhbW9kZS5lbmRzV2l0aFBhcmVudClcbiAgICAgICAgICBtb2RlLmVuZCA9IC9cXEJ8XFxiLztcbiAgICAgICAgaWYgKG1vZGUuZW5kKVxuICAgICAgICAgIG1vZGUuZW5kUmUgPSBsYW5nUmUobW9kZS5lbmQpO1xuICAgICAgICBtb2RlLnRlcm1pbmF0b3JfZW5kID0gcmVTdHIobW9kZS5lbmQpIHx8ICcnO1xuICAgICAgICBpZiAobW9kZS5lbmRzV2l0aFBhcmVudCAmJiBwYXJlbnQudGVybWluYXRvcl9lbmQpXG4gICAgICAgICAgbW9kZS50ZXJtaW5hdG9yX2VuZCArPSAobW9kZS5lbmQgPyAnfCcgOiAnJykgKyBwYXJlbnQudGVybWluYXRvcl9lbmQ7XG4gICAgICB9XG4gICAgICBpZiAobW9kZS5pbGxlZ2FsKVxuICAgICAgICBtb2RlLmlsbGVnYWxSZSA9IGxhbmdSZShtb2RlLmlsbGVnYWwpO1xuICAgICAgaWYgKG1vZGUucmVsZXZhbmNlID09PSB1bmRlZmluZWQpXG4gICAgICAgIG1vZGUucmVsZXZhbmNlID0gMTtcbiAgICAgIGlmICghbW9kZS5jb250YWlucykge1xuICAgICAgICBtb2RlLmNvbnRhaW5zID0gW107XG4gICAgICB9XG4gICAgICB2YXIgZXhwYW5kZWRfY29udGFpbnMgPSBbXTtcbiAgICAgIG1vZGUuY29udGFpbnMuZm9yRWFjaChmdW5jdGlvbihjKSB7XG4gICAgICAgIGlmIChjLnZhcmlhbnRzKSB7XG4gICAgICAgICAgYy52YXJpYW50cy5mb3JFYWNoKGZ1bmN0aW9uKHYpIHtleHBhbmRlZF9jb250YWlucy5wdXNoKGluaGVyaXQoYywgdikpO30pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGV4cGFuZGVkX2NvbnRhaW5zLnB1c2goYyA9PSAnc2VsZicgPyBtb2RlIDogYyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgbW9kZS5jb250YWlucyA9IGV4cGFuZGVkX2NvbnRhaW5zO1xuICAgICAgbW9kZS5jb250YWlucy5mb3JFYWNoKGZ1bmN0aW9uKGMpIHtjb21waWxlTW9kZShjLCBtb2RlKTt9KTtcblxuICAgICAgaWYgKG1vZGUuc3RhcnRzKSB7XG4gICAgICAgIGNvbXBpbGVNb2RlKG1vZGUuc3RhcnRzLCBwYXJlbnQpO1xuICAgICAgfVxuXG4gICAgICB2YXIgdGVybWluYXRvcnMgPVxuICAgICAgICBtb2RlLmNvbnRhaW5zLm1hcChmdW5jdGlvbihjKSB7XG4gICAgICAgICAgcmV0dXJuIGMuYmVnaW5LZXl3b3JkcyA/ICdcXFxcLj9cXFxcYignICsgYy5iZWdpbiArICcpXFxcXGJcXFxcLj8nIDogYy5iZWdpbjtcbiAgICAgICAgfSlcbiAgICAgICAgLmNvbmNhdChbbW9kZS50ZXJtaW5hdG9yX2VuZF0pXG4gICAgICAgIC5jb25jYXQoW21vZGUuaWxsZWdhbF0pXG4gICAgICAgIC5tYXAocmVTdHIpXG4gICAgICAgIC5maWx0ZXIoQm9vbGVhbik7XG4gICAgICBtb2RlLnRlcm1pbmF0b3JzID0gdGVybWluYXRvcnMubGVuZ3RoID8gbGFuZ1JlKHRlcm1pbmF0b3JzLmpvaW4oJ3wnKSwgdHJ1ZSkgOiB7ZXhlYzogZnVuY3Rpb24ocykge3JldHVybiBudWxsO319O1xuXG4gICAgICBtb2RlLmNvbnRpbnVhdGlvbiA9IHt9O1xuICAgIH1cblxuICAgIGNvbXBpbGVNb2RlKGxhbmd1YWdlKTtcbiAgfVxuXG4gIC8qXG4gIENvcmUgaGlnaGxpZ2h0aW5nIGZ1bmN0aW9uLiBBY2NlcHRzIGEgbGFuZ3VhZ2UgbmFtZSwgb3IgYW4gYWxpYXMsIGFuZCBhXG4gIHN0cmluZyB3aXRoIHRoZSBjb2RlIHRvIGhpZ2hsaWdodC4gUmV0dXJucyBhbiBvYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nXG4gIHByb3BlcnRpZXM6XG5cbiAgLSByZWxldmFuY2UgKGludClcbiAgLSB2YWx1ZSAoYW4gSFRNTCBzdHJpbmcgd2l0aCBoaWdobGlnaHRpbmcgbWFya3VwKVxuXG4gICovXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodChuYW1lLCB2YWx1ZSwgaWdub3JlX2lsbGVnYWxzLCBjb250aW51YXRpb24pIHtcblxuICAgIGZ1bmN0aW9uIHN1Yk1vZGUobGV4ZW1lLCBtb2RlKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG1vZGUuY29udGFpbnMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgaWYgKHRlc3RSZShtb2RlLmNvbnRhaW5zW2ldLmJlZ2luUmUsIGxleGVtZSkpIHtcbiAgICAgICAgICByZXR1cm4gbW9kZS5jb250YWluc1tpXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cblxuICAgIGZ1bmN0aW9uIGVuZE9mTW9kZShtb2RlLCBsZXhlbWUpIHtcbiAgICAgIGlmICh0ZXN0UmUobW9kZS5lbmRSZSwgbGV4ZW1lKSkge1xuICAgICAgICByZXR1cm4gbW9kZTtcbiAgICAgIH1cbiAgICAgIGlmIChtb2RlLmVuZHNXaXRoUGFyZW50KSB7XG4gICAgICAgIHJldHVybiBlbmRPZk1vZGUobW9kZS5wYXJlbnQsIGxleGVtZSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gaXNJbGxlZ2FsKGxleGVtZSwgbW9kZSkge1xuICAgICAgcmV0dXJuICFpZ25vcmVfaWxsZWdhbHMgJiYgdGVzdFJlKG1vZGUuaWxsZWdhbFJlLCBsZXhlbWUpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGtleXdvcmRNYXRjaChtb2RlLCBtYXRjaCkge1xuICAgICAgdmFyIG1hdGNoX3N0ciA9IGxhbmd1YWdlLmNhc2VfaW5zZW5zaXRpdmUgPyBtYXRjaFswXS50b0xvd2VyQ2FzZSgpIDogbWF0Y2hbMF07XG4gICAgICByZXR1cm4gbW9kZS5rZXl3b3Jkcy5oYXNPd25Qcm9wZXJ0eShtYXRjaF9zdHIpICYmIG1vZGUua2V5d29yZHNbbWF0Y2hfc3RyXTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBidWlsZFNwYW4oY2xhc3NuYW1lLCBpbnNpZGVTcGFuLCBsZWF2ZU9wZW4sIG5vUHJlZml4KSB7XG4gICAgICB2YXIgY2xhc3NQcmVmaXggPSBub1ByZWZpeCA/ICcnIDogb3B0aW9ucy5jbGFzc1ByZWZpeCxcbiAgICAgICAgICBvcGVuU3BhbiAgICA9ICc8c3BhbiBjbGFzcz1cIicgKyBjbGFzc1ByZWZpeCxcbiAgICAgICAgICBjbG9zZVNwYW4gICA9IGxlYXZlT3BlbiA/ICcnIDogJzwvc3Bhbj4nO1xuXG4gICAgICBvcGVuU3BhbiArPSBjbGFzc25hbWUgKyAnXCI+JztcblxuICAgICAgcmV0dXJuIG9wZW5TcGFuICsgaW5zaWRlU3BhbiArIGNsb3NlU3BhbjtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzS2V5d29yZHMoKSB7XG4gICAgICB2YXIgYnVmZmVyID0gZXNjYXBlKG1vZGVfYnVmZmVyKTtcbiAgICAgIGlmICghdG9wLmtleXdvcmRzKVxuICAgICAgICByZXR1cm4gYnVmZmVyO1xuICAgICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgICAgdmFyIGxhc3RfaW5kZXggPSAwO1xuICAgICAgdG9wLmxleGVtZXNSZS5sYXN0SW5kZXggPSAwO1xuICAgICAgdmFyIG1hdGNoID0gdG9wLmxleGVtZXNSZS5leGVjKGJ1ZmZlcik7XG4gICAgICB3aGlsZSAobWF0Y2gpIHtcbiAgICAgICAgcmVzdWx0ICs9IGJ1ZmZlci5zdWJzdHIobGFzdF9pbmRleCwgbWF0Y2guaW5kZXggLSBsYXN0X2luZGV4KTtcbiAgICAgICAgdmFyIGtleXdvcmRfbWF0Y2ggPSBrZXl3b3JkTWF0Y2godG9wLCBtYXRjaCk7XG4gICAgICAgIGlmIChrZXl3b3JkX21hdGNoKSB7XG4gICAgICAgICAgcmVsZXZhbmNlICs9IGtleXdvcmRfbWF0Y2hbMV07XG4gICAgICAgICAgcmVzdWx0ICs9IGJ1aWxkU3BhbihrZXl3b3JkX21hdGNoWzBdLCBtYXRjaFswXSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzdWx0ICs9IG1hdGNoWzBdO1xuICAgICAgICB9XG4gICAgICAgIGxhc3RfaW5kZXggPSB0b3AubGV4ZW1lc1JlLmxhc3RJbmRleDtcbiAgICAgICAgbWF0Y2ggPSB0b3AubGV4ZW1lc1JlLmV4ZWMoYnVmZmVyKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiByZXN1bHQgKyBidWZmZXIuc3Vic3RyKGxhc3RfaW5kZXgpO1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIHByb2Nlc3NTdWJMYW5ndWFnZSgpIHtcbiAgICAgIGlmICh0b3Auc3ViTGFuZ3VhZ2UgJiYgIWxhbmd1YWdlc1t0b3Auc3ViTGFuZ3VhZ2VdKSB7XG4gICAgICAgIHJldHVybiBlc2NhcGUobW9kZV9idWZmZXIpO1xuICAgICAgfVxuICAgICAgdmFyIHJlc3VsdCA9IHRvcC5zdWJMYW5ndWFnZSA/IGhpZ2hsaWdodCh0b3Auc3ViTGFuZ3VhZ2UsIG1vZGVfYnVmZmVyLCB0cnVlLCB0b3AuY29udGludWF0aW9uLnRvcCkgOiBoaWdobGlnaHRBdXRvKG1vZGVfYnVmZmVyKTtcbiAgICAgIC8vIENvdW50aW5nIGVtYmVkZGVkIGxhbmd1YWdlIHNjb3JlIHRvd2FyZHMgdGhlIGhvc3QgbGFuZ3VhZ2UgbWF5IGJlIGRpc2FibGVkXG4gICAgICAvLyB3aXRoIHplcm9pbmcgdGhlIGNvbnRhaW5pbmcgbW9kZSByZWxldmFuY2UuIFVzZWNhc2UgaW4gcG9pbnQgaXMgTWFya2Rvd24gdGhhdFxuICAgICAgLy8gYWxsb3dzIFhNTCBldmVyeXdoZXJlIGFuZCBtYWtlcyBldmVyeSBYTUwgc25pcHBldCB0byBoYXZlIGEgbXVjaCBsYXJnZXIgTWFya2Rvd25cbiAgICAgIC8vIHNjb3JlLlxuICAgICAgaWYgKHRvcC5yZWxldmFuY2UgPiAwKSB7XG4gICAgICAgIHJlbGV2YW5jZSArPSByZXN1bHQucmVsZXZhbmNlO1xuICAgICAgfVxuICAgICAgaWYgKHRvcC5zdWJMYW5ndWFnZU1vZGUgPT0gJ2NvbnRpbnVvdXMnKSB7XG4gICAgICAgIHRvcC5jb250aW51YXRpb24udG9wID0gcmVzdWx0LnRvcDtcbiAgICAgIH1cbiAgICAgIHJldHVybiBidWlsZFNwYW4ocmVzdWx0Lmxhbmd1YWdlLCByZXN1bHQudmFsdWUsIGZhbHNlLCB0cnVlKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzQnVmZmVyKCkge1xuICAgICAgcmV0dXJuIHRvcC5zdWJMYW5ndWFnZSAhPT0gdW5kZWZpbmVkID8gcHJvY2Vzc1N1Ykxhbmd1YWdlKCkgOiBwcm9jZXNzS2V5d29yZHMoKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBzdGFydE5ld01vZGUobW9kZSwgbGV4ZW1lKSB7XG4gICAgICB2YXIgbWFya3VwID0gbW9kZS5jbGFzc05hbWU/IGJ1aWxkU3Bhbihtb2RlLmNsYXNzTmFtZSwgJycsIHRydWUpOiAnJztcbiAgICAgIGlmIChtb2RlLnJldHVybkJlZ2luKSB7XG4gICAgICAgIHJlc3VsdCArPSBtYXJrdXA7XG4gICAgICAgIG1vZGVfYnVmZmVyID0gJyc7XG4gICAgICB9IGVsc2UgaWYgKG1vZGUuZXhjbHVkZUJlZ2luKSB7XG4gICAgICAgIHJlc3VsdCArPSBlc2NhcGUobGV4ZW1lKSArIG1hcmt1cDtcbiAgICAgICAgbW9kZV9idWZmZXIgPSAnJztcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlc3VsdCArPSBtYXJrdXA7XG4gICAgICAgIG1vZGVfYnVmZmVyID0gbGV4ZW1lO1xuICAgICAgfVxuICAgICAgdG9wID0gT2JqZWN0LmNyZWF0ZShtb2RlLCB7cGFyZW50OiB7dmFsdWU6IHRvcH19KTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBwcm9jZXNzTGV4ZW1lKGJ1ZmZlciwgbGV4ZW1lKSB7XG5cbiAgICAgIG1vZGVfYnVmZmVyICs9IGJ1ZmZlcjtcbiAgICAgIGlmIChsZXhlbWUgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICByZXN1bHQgKz0gcHJvY2Vzc0J1ZmZlcigpO1xuICAgICAgICByZXR1cm4gMDtcbiAgICAgIH1cblxuICAgICAgdmFyIG5ld19tb2RlID0gc3ViTW9kZShsZXhlbWUsIHRvcCk7XG4gICAgICBpZiAobmV3X21vZGUpIHtcbiAgICAgICAgcmVzdWx0ICs9IHByb2Nlc3NCdWZmZXIoKTtcbiAgICAgICAgc3RhcnROZXdNb2RlKG5ld19tb2RlLCBsZXhlbWUpO1xuICAgICAgICByZXR1cm4gbmV3X21vZGUucmV0dXJuQmVnaW4gPyAwIDogbGV4ZW1lLmxlbmd0aDtcbiAgICAgIH1cblxuICAgICAgdmFyIGVuZF9tb2RlID0gZW5kT2ZNb2RlKHRvcCwgbGV4ZW1lKTtcbiAgICAgIGlmIChlbmRfbW9kZSkge1xuICAgICAgICB2YXIgb3JpZ2luID0gdG9wO1xuICAgICAgICBpZiAoIShvcmlnaW4ucmV0dXJuRW5kIHx8IG9yaWdpbi5leGNsdWRlRW5kKSkge1xuICAgICAgICAgIG1vZGVfYnVmZmVyICs9IGxleGVtZTtcbiAgICAgICAgfVxuICAgICAgICByZXN1bHQgKz0gcHJvY2Vzc0J1ZmZlcigpO1xuICAgICAgICBkbyB7XG4gICAgICAgICAgaWYgKHRvcC5jbGFzc05hbWUpIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSAnPC9zcGFuPic7XG4gICAgICAgICAgfVxuICAgICAgICAgIHJlbGV2YW5jZSArPSB0b3AucmVsZXZhbmNlO1xuICAgICAgICAgIHRvcCA9IHRvcC5wYXJlbnQ7XG4gICAgICAgIH0gd2hpbGUgKHRvcCAhPSBlbmRfbW9kZS5wYXJlbnQpO1xuICAgICAgICBpZiAob3JpZ2luLmV4Y2x1ZGVFbmQpIHtcbiAgICAgICAgICByZXN1bHQgKz0gZXNjYXBlKGxleGVtZSk7XG4gICAgICAgIH1cbiAgICAgICAgbW9kZV9idWZmZXIgPSAnJztcbiAgICAgICAgaWYgKGVuZF9tb2RlLnN0YXJ0cykge1xuICAgICAgICAgIHN0YXJ0TmV3TW9kZShlbmRfbW9kZS5zdGFydHMsICcnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gb3JpZ2luLnJldHVybkVuZCA/IDAgOiBsZXhlbWUubGVuZ3RoO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNJbGxlZ2FsKGxleGVtZSwgdG9wKSlcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGxleGVtZSBcIicgKyBsZXhlbWUgKyAnXCIgZm9yIG1vZGUgXCInICsgKHRvcC5jbGFzc05hbWUgfHwgJzx1bm5hbWVkPicpICsgJ1wiJyk7XG5cbiAgICAgIC8qXG4gICAgICBQYXJzZXIgc2hvdWxkIG5vdCByZWFjaCB0aGlzIHBvaW50IGFzIGFsbCB0eXBlcyBvZiBsZXhlbWVzIHNob3VsZCBiZSBjYXVnaHRcbiAgICAgIGVhcmxpZXIsIGJ1dCBpZiBpdCBkb2VzIGR1ZSB0byBzb21lIGJ1ZyBtYWtlIHN1cmUgaXQgYWR2YW5jZXMgYXQgbGVhc3Qgb25lXG4gICAgICBjaGFyYWN0ZXIgZm9yd2FyZCB0byBwcmV2ZW50IGluZmluaXRlIGxvb3BpbmcuXG4gICAgICAqL1xuICAgICAgbW9kZV9idWZmZXIgKz0gbGV4ZW1lO1xuICAgICAgcmV0dXJuIGxleGVtZS5sZW5ndGggfHwgMTtcbiAgICB9XG5cbiAgICB2YXIgbGFuZ3VhZ2UgPSBnZXRMYW5ndWFnZShuYW1lKTtcbiAgICBpZiAoIWxhbmd1YWdlKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbGFuZ3VhZ2U6IFwiJyArIG5hbWUgKyAnXCInKTtcbiAgICB9XG5cbiAgICBjb21waWxlTGFuZ3VhZ2UobGFuZ3VhZ2UpO1xuICAgIHZhciB0b3AgPSBjb250aW51YXRpb24gfHwgbGFuZ3VhZ2U7XG4gICAgdmFyIHJlc3VsdCA9ICcnO1xuICAgIGZvcih2YXIgY3VycmVudCA9IHRvcDsgY3VycmVudCAhPSBsYW5ndWFnZTsgY3VycmVudCA9IGN1cnJlbnQucGFyZW50KSB7XG4gICAgICBpZiAoY3VycmVudC5jbGFzc05hbWUpIHtcbiAgICAgICAgcmVzdWx0ID0gYnVpbGRTcGFuKGN1cnJlbnQuY2xhc3NOYW1lLCByZXN1bHQsIHRydWUpO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgbW9kZV9idWZmZXIgPSAnJztcbiAgICB2YXIgcmVsZXZhbmNlID0gMDtcbiAgICB0cnkge1xuICAgICAgdmFyIG1hdGNoLCBjb3VudCwgaW5kZXggPSAwO1xuICAgICAgd2hpbGUgKHRydWUpIHtcbiAgICAgICAgdG9wLnRlcm1pbmF0b3JzLmxhc3RJbmRleCA9IGluZGV4O1xuICAgICAgICBtYXRjaCA9IHRvcC50ZXJtaW5hdG9ycy5leGVjKHZhbHVlKTtcbiAgICAgICAgaWYgKCFtYXRjaClcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgY291bnQgPSBwcm9jZXNzTGV4ZW1lKHZhbHVlLnN1YnN0cihpbmRleCwgbWF0Y2guaW5kZXggLSBpbmRleCksIG1hdGNoWzBdKTtcbiAgICAgICAgaW5kZXggPSBtYXRjaC5pbmRleCArIGNvdW50O1xuICAgICAgfVxuICAgICAgcHJvY2Vzc0xleGVtZSh2YWx1ZS5zdWJzdHIoaW5kZXgpKTtcbiAgICAgIGZvcih2YXIgY3VycmVudCA9IHRvcDsgY3VycmVudC5wYXJlbnQ7IGN1cnJlbnQgPSBjdXJyZW50LnBhcmVudCkgeyAvLyBjbG9zZSBkYW5nbGluZyBtb2Rlc1xuICAgICAgICBpZiAoY3VycmVudC5jbGFzc05hbWUpIHtcbiAgICAgICAgICByZXN1bHQgKz0gJzwvc3Bhbj4nO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgcmVsZXZhbmNlOiByZWxldmFuY2UsXG4gICAgICAgIHZhbHVlOiByZXN1bHQsXG4gICAgICAgIGxhbmd1YWdlOiBuYW1lLFxuICAgICAgICB0b3A6IHRvcFxuICAgICAgfTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5tZXNzYWdlLmluZGV4T2YoJ0lsbGVnYWwnKSAhPSAtMSkge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHJlbGV2YW5jZTogMCxcbiAgICAgICAgICB2YWx1ZTogZXNjYXBlKHZhbHVlKVxuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKlxuICBIaWdobGlnaHRpbmcgd2l0aCBsYW5ndWFnZSBkZXRlY3Rpb24uIEFjY2VwdHMgYSBzdHJpbmcgd2l0aCB0aGUgY29kZSB0b1xuICBoaWdobGlnaHQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGggdGhlIGZvbGxvd2luZyBwcm9wZXJ0aWVzOlxuXG4gIC0gbGFuZ3VhZ2UgKGRldGVjdGVkIGxhbmd1YWdlKVxuICAtIHJlbGV2YW5jZSAoaW50KVxuICAtIHZhbHVlIChhbiBIVE1MIHN0cmluZyB3aXRoIGhpZ2hsaWdodGluZyBtYXJrdXApXG4gIC0gc2Vjb25kX2Jlc3QgKG9iamVjdCB3aXRoIHRoZSBzYW1lIHN0cnVjdHVyZSBmb3Igc2Vjb25kLWJlc3QgaGV1cmlzdGljYWxseVxuICAgIGRldGVjdGVkIGxhbmd1YWdlLCBtYXkgYmUgYWJzZW50KVxuXG4gICovXG4gIGZ1bmN0aW9uIGhpZ2hsaWdodEF1dG8odGV4dCwgbGFuZ3VhZ2VTdWJzZXQpIHtcbiAgICBsYW5ndWFnZVN1YnNldCA9IGxhbmd1YWdlU3Vic2V0IHx8IG9wdGlvbnMubGFuZ3VhZ2VzIHx8IE9iamVjdC5rZXlzKGxhbmd1YWdlcyk7XG4gICAgdmFyIHJlc3VsdCA9IHtcbiAgICAgIHJlbGV2YW5jZTogMCxcbiAgICAgIHZhbHVlOiBlc2NhcGUodGV4dClcbiAgICB9O1xuICAgIHZhciBzZWNvbmRfYmVzdCA9IHJlc3VsdDtcbiAgICBsYW5ndWFnZVN1YnNldC5mb3JFYWNoKGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmICghZ2V0TGFuZ3VhZ2UobmFtZSkpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIGN1cnJlbnQgPSBoaWdobGlnaHQobmFtZSwgdGV4dCwgZmFsc2UpO1xuICAgICAgY3VycmVudC5sYW5ndWFnZSA9IG5hbWU7XG4gICAgICBpZiAoY3VycmVudC5yZWxldmFuY2UgPiBzZWNvbmRfYmVzdC5yZWxldmFuY2UpIHtcbiAgICAgICAgc2Vjb25kX2Jlc3QgPSBjdXJyZW50O1xuICAgICAgfVxuICAgICAgaWYgKGN1cnJlbnQucmVsZXZhbmNlID4gcmVzdWx0LnJlbGV2YW5jZSkge1xuICAgICAgICBzZWNvbmRfYmVzdCA9IHJlc3VsdDtcbiAgICAgICAgcmVzdWx0ID0gY3VycmVudDtcbiAgICAgIH1cbiAgICB9KTtcbiAgICBpZiAoc2Vjb25kX2Jlc3QubGFuZ3VhZ2UpIHtcbiAgICAgIHJlc3VsdC5zZWNvbmRfYmVzdCA9IHNlY29uZF9iZXN0O1xuICAgIH1cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgLypcbiAgUG9zdC1wcm9jZXNzaW5nIG9mIHRoZSBoaWdobGlnaHRlZCBtYXJrdXA6XG5cbiAgLSByZXBsYWNlIFRBQnMgd2l0aCBzb21ldGhpbmcgbW9yZSB1c2VmdWxcbiAgLSByZXBsYWNlIHJlYWwgbGluZS1icmVha3Mgd2l0aCAnPGJyPicgZm9yIG5vbi1wcmUgY29udGFpbmVyc1xuXG4gICovXG4gIGZ1bmN0aW9uIGZpeE1hcmt1cCh2YWx1ZSkge1xuICAgIGlmIChvcHRpb25zLnRhYlJlcGxhY2UpIHtcbiAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvXigoPFtePl0rPnxcXHQpKykvZ20sIGZ1bmN0aW9uKG1hdGNoLCBwMSwgb2Zmc2V0LCBzKSB7XG4gICAgICAgIHJldHVybiBwMS5yZXBsYWNlKC9cXHQvZywgb3B0aW9ucy50YWJSZXBsYWNlKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgICBpZiAob3B0aW9ucy51c2VCUikge1xuICAgICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9cXG4vZywgJzxicj4nKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9XG5cbiAgLypcbiAgQXBwbGllcyBoaWdobGlnaHRpbmcgdG8gYSBET00gbm9kZSBjb250YWluaW5nIGNvZGUuIEFjY2VwdHMgYSBET00gbm9kZSBhbmRcbiAgdHdvIG9wdGlvbmFsIHBhcmFtZXRlcnMgZm9yIGZpeE1hcmt1cC5cbiAgKi9cbiAgZnVuY3Rpb24gaGlnaGxpZ2h0QmxvY2soYmxvY2spIHtcbiAgICB2YXIgdGV4dCA9IGJsb2NrVGV4dChibG9jayk7XG4gICAgdmFyIGxhbmd1YWdlID0gYmxvY2tMYW5ndWFnZShibG9jayk7XG4gICAgaWYgKGxhbmd1YWdlID09ICduby1oaWdobGlnaHQnKVxuICAgICAgICByZXR1cm47XG4gICAgdmFyIHJlc3VsdCA9IGxhbmd1YWdlID8gaGlnaGxpZ2h0KGxhbmd1YWdlLCB0ZXh0LCB0cnVlKSA6IGhpZ2hsaWdodEF1dG8odGV4dCk7XG4gICAgdmFyIG9yaWdpbmFsID0gbm9kZVN0cmVhbShibG9jayk7XG4gICAgaWYgKG9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgdmFyIHByZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUygnaHR0cDovL3d3dy53My5vcmcvMTk5OS94aHRtbCcsICdwcmUnKTtcbiAgICAgIHByZS5pbm5lckhUTUwgPSByZXN1bHQudmFsdWU7XG4gICAgICByZXN1bHQudmFsdWUgPSBtZXJnZVN0cmVhbXMob3JpZ2luYWwsIG5vZGVTdHJlYW0ocHJlKSwgdGV4dCk7XG4gICAgfVxuICAgIHJlc3VsdC52YWx1ZSA9IGZpeE1hcmt1cChyZXN1bHQudmFsdWUpO1xuXG4gICAgYmxvY2suaW5uZXJIVE1MID0gcmVzdWx0LnZhbHVlO1xuICAgIGJsb2NrLmNsYXNzTmFtZSArPSAnIGhsanMgJyArICghbGFuZ3VhZ2UgJiYgcmVzdWx0Lmxhbmd1YWdlIHx8ICcnKTtcbiAgICBibG9jay5yZXN1bHQgPSB7XG4gICAgICBsYW5ndWFnZTogcmVzdWx0Lmxhbmd1YWdlLFxuICAgICAgcmU6IHJlc3VsdC5yZWxldmFuY2VcbiAgICB9O1xuICAgIGlmIChyZXN1bHQuc2Vjb25kX2Jlc3QpIHtcbiAgICAgIGJsb2NrLnNlY29uZF9iZXN0ID0ge1xuICAgICAgICBsYW5ndWFnZTogcmVzdWx0LnNlY29uZF9iZXN0Lmxhbmd1YWdlLFxuICAgICAgICByZTogcmVzdWx0LnNlY29uZF9iZXN0LnJlbGV2YW5jZVxuICAgICAgfTtcbiAgICB9XG4gIH1cblxuICB2YXIgb3B0aW9ucyA9IHtcbiAgICBjbGFzc1ByZWZpeDogJ2hsanMtJyxcbiAgICB0YWJSZXBsYWNlOiBudWxsLFxuICAgIHVzZUJSOiBmYWxzZSxcbiAgICBsYW5ndWFnZXM6IHVuZGVmaW5lZFxuICB9O1xuXG4gIC8qXG4gIFVwZGF0ZXMgaGlnaGxpZ2h0LmpzIGdsb2JhbCBvcHRpb25zIHdpdGggdmFsdWVzIHBhc3NlZCBpbiB0aGUgZm9ybSBvZiBhbiBvYmplY3RcbiAgKi9cbiAgZnVuY3Rpb24gY29uZmlndXJlKHVzZXJfb3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBpbmhlcml0KG9wdGlvbnMsIHVzZXJfb3B0aW9ucyk7XG4gIH1cblxuICAvKlxuICBBcHBsaWVzIGhpZ2hsaWdodGluZyB0byBhbGwgPHByZT48Y29kZT4uLjwvY29kZT48L3ByZT4gYmxvY2tzIG9uIGEgcGFnZS5cbiAgKi9cbiAgZnVuY3Rpb24gaW5pdEhpZ2hsaWdodGluZygpIHtcbiAgICBpZiAoaW5pdEhpZ2hsaWdodGluZy5jYWxsZWQpXG4gICAgICByZXR1cm47XG4gICAgaW5pdEhpZ2hsaWdodGluZy5jYWxsZWQgPSB0cnVlO1xuXG4gICAgdmFyIGJsb2NrcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ3ByZSBjb2RlJyk7XG4gICAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChibG9ja3MsIGhpZ2hsaWdodEJsb2NrKTtcbiAgfVxuXG4gIC8qXG4gIEF0dGFjaGVzIGhpZ2hsaWdodGluZyB0byB0aGUgcGFnZSBsb2FkIGV2ZW50LlxuICAqL1xuICBmdW5jdGlvbiBpbml0SGlnaGxpZ2h0aW5nT25Mb2FkKCkge1xuICAgIGFkZEV2ZW50TGlzdGVuZXIoJ0RPTUNvbnRlbnRMb2FkZWQnLCBpbml0SGlnaGxpZ2h0aW5nLCBmYWxzZSk7XG4gICAgYWRkRXZlbnRMaXN0ZW5lcignbG9hZCcsIGluaXRIaWdobGlnaHRpbmcsIGZhbHNlKTtcbiAgfVxuXG4gIHZhciBsYW5ndWFnZXMgPSB7fTtcbiAgdmFyIGFsaWFzZXMgPSB7fTtcblxuICBmdW5jdGlvbiByZWdpc3Rlckxhbmd1YWdlKG5hbWUsIGxhbmd1YWdlKSB7XG4gICAgdmFyIGxhbmcgPSBsYW5ndWFnZXNbbmFtZV0gPSBsYW5ndWFnZSh0aGlzKTtcbiAgICBpZiAobGFuZy5hbGlhc2VzKSB7XG4gICAgICBsYW5nLmFsaWFzZXMuZm9yRWFjaChmdW5jdGlvbihhbGlhcykge2FsaWFzZXNbYWxpYXNdID0gbmFtZTt9KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBnZXRMYW5ndWFnZShuYW1lKSB7XG4gICAgcmV0dXJuIGxhbmd1YWdlc1tuYW1lXSB8fCBsYW5ndWFnZXNbYWxpYXNlc1tuYW1lXV07XG4gIH1cblxuICAvKiBJbnRlcmZhY2UgZGVmaW5pdGlvbiAqL1xuXG4gIHRoaXMuaGlnaGxpZ2h0ID0gaGlnaGxpZ2h0O1xuICB0aGlzLmhpZ2hsaWdodEF1dG8gPSBoaWdobGlnaHRBdXRvO1xuICB0aGlzLmZpeE1hcmt1cCA9IGZpeE1hcmt1cDtcbiAgdGhpcy5oaWdobGlnaHRCbG9jayA9IGhpZ2hsaWdodEJsb2NrO1xuICB0aGlzLmNvbmZpZ3VyZSA9IGNvbmZpZ3VyZTtcbiAgdGhpcy5pbml0SGlnaGxpZ2h0aW5nID0gaW5pdEhpZ2hsaWdodGluZztcbiAgdGhpcy5pbml0SGlnaGxpZ2h0aW5nT25Mb2FkID0gaW5pdEhpZ2hsaWdodGluZ09uTG9hZDtcbiAgdGhpcy5yZWdpc3Rlckxhbmd1YWdlID0gcmVnaXN0ZXJMYW5ndWFnZTtcbiAgdGhpcy5nZXRMYW5ndWFnZSA9IGdldExhbmd1YWdlO1xuICB0aGlzLmluaGVyaXQgPSBpbmhlcml0O1xuXG4gIC8vIENvbW1vbiByZWdleHBzXG4gIHRoaXMuSURFTlRfUkUgPSAnW2EtekEtWl1bYS16QS1aMC05X10qJztcbiAgdGhpcy5VTkRFUlNDT1JFX0lERU5UX1JFID0gJ1thLXpBLVpfXVthLXpBLVowLTlfXSonO1xuICB0aGlzLk5VTUJFUl9SRSA9ICdcXFxcYlxcXFxkKyhcXFxcLlxcXFxkKyk/JztcbiAgdGhpcy5DX05VTUJFUl9SRSA9ICcoXFxcXGIwW3hYXVthLWZBLUYwLTldK3woXFxcXGJcXFxcZCsoXFxcXC5cXFxcZCopP3xcXFxcLlxcXFxkKykoW2VFXVstK10/XFxcXGQrKT8pJzsgLy8gMHguLi4sIDAuLi4sIGRlY2ltYWwsIGZsb2F0XG4gIHRoaXMuQklOQVJZX05VTUJFUl9SRSA9ICdcXFxcYigwYlswMV0rKSc7IC8vIDBiLi4uXG4gIHRoaXMuUkVfU1RBUlRFUlNfUkUgPSAnIXwhPXwhPT18JXwlPXwmfCYmfCY9fFxcXFwqfFxcXFwqPXxcXFxcK3xcXFxcKz18LHwtfC09fC89fC98Onw7fDw8fDw8PXw8PXw8fD09PXw9PXw9fD4+Pj18Pj49fD49fD4+Pnw+Pnw+fFxcXFw/fFxcXFxbfFxcXFx7fFxcXFwofFxcXFxefFxcXFxePXxcXFxcfHxcXFxcfD18XFxcXHxcXFxcfHx+JztcblxuICAvLyBDb21tb24gbW9kZXNcbiAgdGhpcy5CQUNLU0xBU0hfRVNDQVBFID0ge1xuICAgIGJlZ2luOiAnXFxcXFxcXFxbXFxcXHNcXFxcU10nLCByZWxldmFuY2U6IDBcbiAgfTtcbiAgdGhpcy5BUE9TX1NUUklOR19NT0RFID0ge1xuICAgIGNsYXNzTmFtZTogJ3N0cmluZycsXG4gICAgYmVnaW46ICdcXCcnLCBlbmQ6ICdcXCcnLFxuICAgIGlsbGVnYWw6ICdcXFxcbicsXG4gICAgY29udGFpbnM6IFt0aGlzLkJBQ0tTTEFTSF9FU0NBUEVdXG4gIH07XG4gIHRoaXMuUVVPVEVfU1RSSU5HX01PREUgPSB7XG4gICAgY2xhc3NOYW1lOiAnc3RyaW5nJyxcbiAgICBiZWdpbjogJ1wiJywgZW5kOiAnXCInLFxuICAgIGlsbGVnYWw6ICdcXFxcbicsXG4gICAgY29udGFpbnM6IFt0aGlzLkJBQ0tTTEFTSF9FU0NBUEVdXG4gIH07XG4gIHRoaXMuQ19MSU5FX0NPTU1FTlRfTU9ERSA9IHtcbiAgICBjbGFzc05hbWU6ICdjb21tZW50JyxcbiAgICBiZWdpbjogJy8vJywgZW5kOiAnJCdcbiAgfTtcbiAgdGhpcy5DX0JMT0NLX0NPTU1FTlRfTU9ERSA9IHtcbiAgICBjbGFzc05hbWU6ICdjb21tZW50JyxcbiAgICBiZWdpbjogJy9cXFxcKicsIGVuZDogJ1xcXFwqLydcbiAgfTtcbiAgdGhpcy5IQVNIX0NPTU1FTlRfTU9ERSA9IHtcbiAgICBjbGFzc05hbWU6ICdjb21tZW50JyxcbiAgICBiZWdpbjogJyMnLCBlbmQ6ICckJ1xuICB9O1xuICB0aGlzLk5VTUJFUl9NT0RFID0ge1xuICAgIGNsYXNzTmFtZTogJ251bWJlcicsXG4gICAgYmVnaW46IHRoaXMuTlVNQkVSX1JFLFxuICAgIHJlbGV2YW5jZTogMFxuICB9O1xuICB0aGlzLkNfTlVNQkVSX01PREUgPSB7XG4gICAgY2xhc3NOYW1lOiAnbnVtYmVyJyxcbiAgICBiZWdpbjogdGhpcy5DX05VTUJFUl9SRSxcbiAgICByZWxldmFuY2U6IDBcbiAgfTtcbiAgdGhpcy5CSU5BUllfTlVNQkVSX01PREUgPSB7XG4gICAgY2xhc3NOYW1lOiAnbnVtYmVyJyxcbiAgICBiZWdpbjogdGhpcy5CSU5BUllfTlVNQkVSX1JFLFxuICAgIHJlbGV2YW5jZTogMFxuICB9O1xuICB0aGlzLlJFR0VYUF9NT0RFID0ge1xuICAgIGNsYXNzTmFtZTogJ3JlZ2V4cCcsXG4gICAgYmVnaW46IC9cXC8vLCBlbmQ6IC9cXC9bZ2ltXSovLFxuICAgIGlsbGVnYWw6IC9cXG4vLFxuICAgIGNvbnRhaW5zOiBbXG4gICAgICB0aGlzLkJBQ0tTTEFTSF9FU0NBUEUsXG4gICAgICB7XG4gICAgICAgIGJlZ2luOiAvXFxbLywgZW5kOiAvXFxdLyxcbiAgICAgICAgcmVsZXZhbmNlOiAwLFxuICAgICAgICBjb250YWluczogW3RoaXMuQkFDS1NMQVNIX0VTQ0FQRV1cbiAgICAgIH1cbiAgICBdXG4gIH07XG4gIHRoaXMuVElUTEVfTU9ERSA9IHtcbiAgICBjbGFzc05hbWU6ICd0aXRsZScsXG4gICAgYmVnaW46IHRoaXMuSURFTlRfUkUsXG4gICAgcmVsZXZhbmNlOiAwXG4gIH07XG4gIHRoaXMuVU5ERVJTQ09SRV9USVRMRV9NT0RFID0ge1xuICAgIGNsYXNzTmFtZTogJ3RpdGxlJyxcbiAgICBiZWdpbjogdGhpcy5VTkRFUlNDT1JFX0lERU5UX1JFLFxuICAgIHJlbGV2YW5jZTogMFxuICB9O1xufTtcbm1vZHVsZS5leHBvcnRzID0gSGlnaGxpZ2h0OyIsInZhciBIaWdobGlnaHQgPSByZXF1aXJlKCcuL2hpZ2hsaWdodCcpO1xudmFyIGhsanMgPSBuZXcgSGlnaGxpZ2h0KCk7XG5obGpzLnJlZ2lzdGVyTGFuZ3VhZ2UoJ2Jhc2gnLCByZXF1aXJlKCcuL2xhbmd1YWdlcy9iYXNoLmpzJykpO1xuaGxqcy5yZWdpc3Rlckxhbmd1YWdlKCdqYXZhc2NyaXB0JywgcmVxdWlyZSgnLi9sYW5ndWFnZXMvamF2YXNjcmlwdC5qcycpKTtcbmhsanMucmVnaXN0ZXJMYW5ndWFnZSgneG1sJywgcmVxdWlyZSgnLi9sYW5ndWFnZXMveG1sLmpzJykpO1xuaGxqcy5yZWdpc3Rlckxhbmd1YWdlKCdtYXJrZG93bicsIHJlcXVpcmUoJy4vbGFuZ3VhZ2VzL21hcmtkb3duLmpzJykpO1xuaGxqcy5yZWdpc3Rlckxhbmd1YWdlKCdjc3MnLCByZXF1aXJlKCcuL2xhbmd1YWdlcy9jc3MuanMnKSk7XG5obGpzLnJlZ2lzdGVyTGFuZ3VhZ2UoJ2h0dHAnLCByZXF1aXJlKCcuL2xhbmd1YWdlcy9odHRwLmpzJykpO1xuaGxqcy5yZWdpc3Rlckxhbmd1YWdlKCdpbmknLCByZXF1aXJlKCcuL2xhbmd1YWdlcy9pbmkuanMnKSk7XG5obGpzLnJlZ2lzdGVyTGFuZ3VhZ2UoJ2pzb24nLCByZXF1aXJlKCcuL2xhbmd1YWdlcy9qc29uLmpzJykpO1xubW9kdWxlLmV4cG9ydHMgPSBobGpzOyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaGxqcykge1xuICB2YXIgVkFSID0ge1xuICAgIGNsYXNzTmFtZTogJ3ZhcmlhYmxlJyxcbiAgICB2YXJpYW50czogW1xuICAgICAge2JlZ2luOiAvXFwkW1xcd1xcZCNAXVtcXHdcXGRfXSovfSxcbiAgICAgIHtiZWdpbjogL1xcJFxceyguKj8pXFx9L31cbiAgICBdXG4gIH07XG4gIHZhciBRVU9URV9TVFJJTkcgPSB7XG4gICAgY2xhc3NOYW1lOiAnc3RyaW5nJyxcbiAgICBiZWdpbjogL1wiLywgZW5kOiAvXCIvLFxuICAgIGNvbnRhaW5zOiBbXG4gICAgICBobGpzLkJBQ0tTTEFTSF9FU0NBUEUsXG4gICAgICBWQVIsXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ3ZhcmlhYmxlJyxcbiAgICAgICAgYmVnaW46IC9cXCRcXCgvLCBlbmQ6IC9cXCkvLFxuICAgICAgICBjb250YWluczogW2hsanMuQkFDS1NMQVNIX0VTQ0FQRV1cbiAgICAgIH1cbiAgICBdXG4gIH07XG4gIHZhciBBUE9TX1NUUklORyA9IHtcbiAgICBjbGFzc05hbWU6ICdzdHJpbmcnLFxuICAgIGJlZ2luOiAvJy8sIGVuZDogLycvXG4gIH07XG5cbiAgcmV0dXJuIHtcbiAgICBsZXhlbWVzOiAvLT9bYS16XFwuXSsvLFxuICAgIGtleXdvcmRzOiB7XG4gICAgICBrZXl3b3JkOlxuICAgICAgICAnaWYgdGhlbiBlbHNlIGVsaWYgZmkgZm9yIGJyZWFrIGNvbnRpbnVlIHdoaWxlIGluIGRvIGRvbmUgZXhpdCByZXR1cm4gc2V0ICcrXG4gICAgICAgICdkZWNsYXJlIGNhc2UgZXNhYyBleHBvcnQgZXhlYycsXG4gICAgICBsaXRlcmFsOlxuICAgICAgICAndHJ1ZSBmYWxzZScsXG4gICAgICBidWlsdF9pbjpcbiAgICAgICAgJ3ByaW50ZiBlY2hvIHJlYWQgY2QgcHdkIHB1c2hkIHBvcGQgZGlycyBsZXQgZXZhbCB1bnNldCB0eXBlc2V0IHJlYWRvbmx5ICcrXG4gICAgICAgICdnZXRvcHRzIHNvdXJjZSBzaG9wdCBjYWxsZXIgdHlwZSBoYXNoIGJpbmQgaGVscCBzdWRvJyxcbiAgICAgIG9wZXJhdG9yOlxuICAgICAgICAnLW5lIC1lcSAtbHQgLWd0IC1mIC1kIC1lIC1zIC1sIC1hJyAvLyByZWxldmFuY2UgYm9vc3RlclxuICAgIH0sXG4gICAgY29udGFpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnc2hlYmFuZycsXG4gICAgICAgIGJlZ2luOiAvXiMhW15cXG5dK3NoXFxzKiQvLFxuICAgICAgICByZWxldmFuY2U6IDEwXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBjbGFzc05hbWU6ICdmdW5jdGlvbicsXG4gICAgICAgIGJlZ2luOiAvXFx3W1xcd1xcZF9dKlxccypcXChcXHMqXFwpXFxzKlxcey8sXG4gICAgICAgIHJldHVybkJlZ2luOiB0cnVlLFxuICAgICAgICBjb250YWluczogW2hsanMuaW5oZXJpdChobGpzLlRJVExFX01PREUsIHtiZWdpbjogL1xcd1tcXHdcXGRfXSovfSldLFxuICAgICAgICByZWxldmFuY2U6IDBcbiAgICAgIH0sXG4gICAgICBobGpzLkhBU0hfQ09NTUVOVF9NT0RFLFxuICAgICAgaGxqcy5OVU1CRVJfTU9ERSxcbiAgICAgIFFVT1RFX1NUUklORyxcbiAgICAgIEFQT1NfU1RSSU5HLFxuICAgICAgVkFSXG4gICAgXVxuICB9O1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGhsanMpIHtcbiAgdmFyIElERU5UX1JFID0gJ1thLXpBLVotXVthLXpBLVowLTlfLV0qJztcbiAgdmFyIEZVTkNUSU9OID0ge1xuICAgIGNsYXNzTmFtZTogJ2Z1bmN0aW9uJyxcbiAgICBiZWdpbjogSURFTlRfUkUgKyAnXFxcXCgnLCBlbmQ6ICdcXFxcKScsXG4gICAgY29udGFpbnM6IFsnc2VsZicsIGhsanMuTlVNQkVSX01PREUsIGhsanMuQVBPU19TVFJJTkdfTU9ERSwgaGxqcy5RVU9URV9TVFJJTkdfTU9ERV1cbiAgfTtcbiAgcmV0dXJuIHtcbiAgICBjYXNlX2luc2Vuc2l0aXZlOiB0cnVlLFxuICAgIGlsbGVnYWw6ICdbPS98XFwnXScsXG4gICAgY29udGFpbnM6IFtcbiAgICAgIGhsanMuQ19CTE9DS19DT01NRU5UX01PREUsXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2lkJywgYmVnaW46ICdcXFxcI1tBLVphLXowLTlfLV0rJ1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnY2xhc3MnLCBiZWdpbjogJ1xcXFwuW0EtWmEtejAtOV8tXSsnLFxuICAgICAgICByZWxldmFuY2U6IDBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2F0dHJfc2VsZWN0b3InLFxuICAgICAgICBiZWdpbjogJ1xcXFxbJywgZW5kOiAnXFxcXF0nLFxuICAgICAgICBpbGxlZ2FsOiAnJCdcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ3BzZXVkbycsXG4gICAgICAgIGJlZ2luOiAnOig6KT9bYS16QS1aMC05XFxcXF9cXFxcLVxcXFwrXFxcXChcXFxcKVxcXFxcIlxcXFxcXCddKydcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2F0X3J1bGUnLFxuICAgICAgICBiZWdpbjogJ0AoZm9udC1mYWNlfHBhZ2UpJyxcbiAgICAgICAgbGV4ZW1lczogJ1thLXotXSsnLFxuICAgICAgICBrZXl3b3JkczogJ2ZvbnQtZmFjZSBwYWdlJ1xuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnYXRfcnVsZScsXG4gICAgICAgIGJlZ2luOiAnQCcsIGVuZDogJ1t7O10nLCAvLyBhdF9ydWxlIGVhdGluZyBmaXJzdCBcIntcIiBpcyBhIGdvb2QgdGhpbmdcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGJlY2F1c2UgaXQgZG9lc27igJl0IGxldCBpdCB0byBiZSBwYXJzZWQgYXNcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIGEgcnVsZSBzZXQgYnV0IGluc3RlYWQgZHJvcHMgcGFyc2VyIGludG9cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIHRoZSBkZWZhdWx0IG1vZGUgd2hpY2ggaXMgaG93IGl0IHNob3VsZCBiZS5cbiAgICAgICAgY29udGFpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjbGFzc05hbWU6ICdrZXl3b3JkJyxcbiAgICAgICAgICAgIGJlZ2luOiAvXFxTKy9cbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGJlZ2luOiAvXFxzLywgZW5kc1dpdGhQYXJlbnQ6IHRydWUsIGV4Y2x1ZGVFbmQ6IHRydWUsXG4gICAgICAgICAgICByZWxldmFuY2U6IDAsXG4gICAgICAgICAgICBjb250YWluczogW1xuICAgICAgICAgICAgICBGVU5DVElPTixcbiAgICAgICAgICAgICAgaGxqcy5BUE9TX1NUUklOR19NT0RFLCBobGpzLlFVT1RFX1NUUklOR19NT0RFLFxuICAgICAgICAgICAgICBobGpzLk5VTUJFUl9NT0RFXG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBjbGFzc05hbWU6ICd0YWcnLCBiZWdpbjogSURFTlRfUkUsXG4gICAgICAgIHJlbGV2YW5jZTogMFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAncnVsZXMnLFxuICAgICAgICBiZWdpbjogJ3snLCBlbmQ6ICd9JyxcbiAgICAgICAgaWxsZWdhbDogJ1teXFxcXHNdJyxcbiAgICAgICAgcmVsZXZhbmNlOiAwLFxuICAgICAgICBjb250YWluczogW1xuICAgICAgICAgIGhsanMuQ19CTE9DS19DT01NRU5UX01PREUsXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2xhc3NOYW1lOiAncnVsZScsXG4gICAgICAgICAgICBiZWdpbjogJ1teXFxcXHNdJywgcmV0dXJuQmVnaW46IHRydWUsIGVuZDogJzsnLCBlbmRzV2l0aFBhcmVudDogdHJ1ZSxcbiAgICAgICAgICAgIGNvbnRhaW5zOiBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU6ICdhdHRyaWJ1dGUnLFxuICAgICAgICAgICAgICAgIGJlZ2luOiAnW0EtWlxcXFxfXFxcXC5cXFxcLV0rJywgZW5kOiAnOicsXG4gICAgICAgICAgICAgICAgZXhjbHVkZUVuZDogdHJ1ZSxcbiAgICAgICAgICAgICAgICBpbGxlZ2FsOiAnW15cXFxcc10nLFxuICAgICAgICAgICAgICAgIHN0YXJ0czoge1xuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiAndmFsdWUnLFxuICAgICAgICAgICAgICAgICAgZW5kc1dpdGhQYXJlbnQ6IHRydWUsIGV4Y2x1ZGVFbmQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICBjb250YWluczogW1xuICAgICAgICAgICAgICAgICAgICBGVU5DVElPTixcbiAgICAgICAgICAgICAgICAgICAgaGxqcy5OVU1CRVJfTU9ERSxcbiAgICAgICAgICAgICAgICAgICAgaGxqcy5RVU9URV9TVFJJTkdfTU9ERSxcbiAgICAgICAgICAgICAgICAgICAgaGxqcy5BUE9TX1NUUklOR19NT0RFLFxuICAgICAgICAgICAgICAgICAgICBobGpzLkNfQkxPQ0tfQ09NTUVOVF9NT0RFLFxuICAgICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lOiAnaGV4Y29sb3InLCBiZWdpbjogJyNbMC05QS1GYS1mXSsnXG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU6ICdpbXBvcnRhbnQnLCBiZWdpbjogJyFpbXBvcnRhbnQnXG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIF1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIF1cbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH1cbiAgICBdXG4gIH07XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaGxqcykge1xuICByZXR1cm4ge1xuICAgIGlsbGVnYWw6ICdcXFxcUycsXG4gICAgY29udGFpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnc3RhdHVzJyxcbiAgICAgICAgYmVnaW46ICdeSFRUUC9bMC05XFxcXC5dKycsIGVuZDogJyQnLFxuICAgICAgICBjb250YWluczogW3tjbGFzc05hbWU6ICdudW1iZXInLCBiZWdpbjogJ1xcXFxiXFxcXGR7M31cXFxcYid9XVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAncmVxdWVzdCcsXG4gICAgICAgIGJlZ2luOiAnXltBLVpdKyAoLio/KSBIVFRQL1swLTlcXFxcLl0rJCcsIHJldHVybkJlZ2luOiB0cnVlLCBlbmQ6ICckJyxcbiAgICAgICAgY29udGFpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjbGFzc05hbWU6ICdzdHJpbmcnLFxuICAgICAgICAgICAgYmVnaW46ICcgJywgZW5kOiAnICcsXG4gICAgICAgICAgICBleGNsdWRlQmVnaW46IHRydWUsIGV4Y2x1ZGVFbmQ6IHRydWVcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2F0dHJpYnV0ZScsXG4gICAgICAgIGJlZ2luOiAnXlxcXFx3JywgZW5kOiAnOiAnLCBleGNsdWRlRW5kOiB0cnVlLFxuICAgICAgICBpbGxlZ2FsOiAnXFxcXG58XFxcXHN8PScsXG4gICAgICAgIHN0YXJ0czoge2NsYXNzTmFtZTogJ3N0cmluZycsIGVuZDogJyQnfVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYmVnaW46ICdcXFxcblxcXFxuJyxcbiAgICAgICAgc3RhcnRzOiB7c3ViTGFuZ3VhZ2U6ICcnLCBlbmRzV2l0aFBhcmVudDogdHJ1ZX1cbiAgICAgIH1cbiAgICBdXG4gIH07XG59OyIsIm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24oaGxqcykge1xuICByZXR1cm4ge1xuICAgIGNhc2VfaW5zZW5zaXRpdmU6IHRydWUsXG4gICAgaWxsZWdhbDogL1xcUy8sXG4gICAgY29udGFpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnY29tbWVudCcsXG4gICAgICAgIGJlZ2luOiAnOycsIGVuZDogJyQnXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBjbGFzc05hbWU6ICd0aXRsZScsXG4gICAgICAgIGJlZ2luOiAnXlxcXFxbJywgZW5kOiAnXFxcXF0nXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBjbGFzc05hbWU6ICdzZXR0aW5nJyxcbiAgICAgICAgYmVnaW46ICdeW2EtejAtOVxcXFxbXFxcXF1fLV0rWyBcXFxcdF0qPVsgXFxcXHRdKicsIGVuZDogJyQnLFxuICAgICAgICBjb250YWluczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZTogJ3ZhbHVlJyxcbiAgICAgICAgICAgIGVuZHNXaXRoUGFyZW50OiB0cnVlLFxuICAgICAgICAgICAga2V5d29yZHM6ICdvbiBvZmYgdHJ1ZSBmYWxzZSB5ZXMgbm8nLFxuICAgICAgICAgICAgY29udGFpbnM6IFtobGpzLlFVT1RFX1NUUklOR19NT0RFLCBobGpzLk5VTUJFUl9NT0RFXSxcbiAgICAgICAgICAgIHJlbGV2YW5jZTogMFxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIF1cbiAgfTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihobGpzKSB7XG4gIHJldHVybiB7XG4gICAgYWxpYXNlczogWydqcyddLFxuICAgIGtleXdvcmRzOiB7XG4gICAgICBrZXl3b3JkOlxuICAgICAgICAnaW4gaWYgZm9yIHdoaWxlIGZpbmFsbHkgdmFyIG5ldyBmdW5jdGlvbiBkbyByZXR1cm4gdm9pZCBlbHNlIGJyZWFrIGNhdGNoICcgK1xuICAgICAgICAnaW5zdGFuY2VvZiB3aXRoIHRocm93IGNhc2UgZGVmYXVsdCB0cnkgdGhpcyBzd2l0Y2ggY29udGludWUgdHlwZW9mIGRlbGV0ZSAnICtcbiAgICAgICAgJ2xldCB5aWVsZCBjb25zdCBjbGFzcycsXG4gICAgICBsaXRlcmFsOlxuICAgICAgICAndHJ1ZSBmYWxzZSBudWxsIHVuZGVmaW5lZCBOYU4gSW5maW5pdHknLFxuICAgICAgYnVpbHRfaW46XG4gICAgICAgICdldmFsIGlzRmluaXRlIGlzTmFOIHBhcnNlRmxvYXQgcGFyc2VJbnQgZGVjb2RlVVJJIGRlY29kZVVSSUNvbXBvbmVudCAnICtcbiAgICAgICAgJ2VuY29kZVVSSSBlbmNvZGVVUklDb21wb25lbnQgZXNjYXBlIHVuZXNjYXBlIE9iamVjdCBGdW5jdGlvbiBCb29sZWFuIEVycm9yICcgK1xuICAgICAgICAnRXZhbEVycm9yIEludGVybmFsRXJyb3IgUmFuZ2VFcnJvciBSZWZlcmVuY2VFcnJvciBTdG9wSXRlcmF0aW9uIFN5bnRheEVycm9yICcgK1xuICAgICAgICAnVHlwZUVycm9yIFVSSUVycm9yIE51bWJlciBNYXRoIERhdGUgU3RyaW5nIFJlZ0V4cCBBcnJheSBGbG9hdDMyQXJyYXkgJyArXG4gICAgICAgICdGbG9hdDY0QXJyYXkgSW50MTZBcnJheSBJbnQzMkFycmF5IEludDhBcnJheSBVaW50MTZBcnJheSBVaW50MzJBcnJheSAnICtcbiAgICAgICAgJ1VpbnQ4QXJyYXkgVWludDhDbGFtcGVkQXJyYXkgQXJyYXlCdWZmZXIgRGF0YVZpZXcgSlNPTiBJbnRsIGFyZ3VtZW50cyByZXF1aXJlJ1xuICAgIH0sXG4gICAgY29udGFpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAncGknLFxuICAgICAgICBiZWdpbjogL15cXHMqKCd8XCIpdXNlIHN0cmljdCgnfFwiKS8sXG4gICAgICAgIHJlbGV2YW5jZTogMTBcbiAgICAgIH0sXG4gICAgICBobGpzLkFQT1NfU1RSSU5HX01PREUsXG4gICAgICBobGpzLlFVT1RFX1NUUklOR19NT0RFLFxuICAgICAgaGxqcy5DX0xJTkVfQ09NTUVOVF9NT0RFLFxuICAgICAgaGxqcy5DX0JMT0NLX0NPTU1FTlRfTU9ERSxcbiAgICAgIGhsanMuQ19OVU1CRVJfTU9ERSxcbiAgICAgIHsgLy8gXCJ2YWx1ZVwiIGNvbnRhaW5lclxuICAgICAgICBiZWdpbjogJygnICsgaGxqcy5SRV9TVEFSVEVSU19SRSArICd8XFxcXGIoY2FzZXxyZXR1cm58dGhyb3cpXFxcXGIpXFxcXHMqJyxcbiAgICAgICAga2V5d29yZHM6ICdyZXR1cm4gdGhyb3cgY2FzZScsXG4gICAgICAgIGNvbnRhaW5zOiBbXG4gICAgICAgICAgaGxqcy5DX0xJTkVfQ09NTUVOVF9NT0RFLFxuICAgICAgICAgIGhsanMuQ19CTE9DS19DT01NRU5UX01PREUsXG4gICAgICAgICAgaGxqcy5SRUdFWFBfTU9ERSxcbiAgICAgICAgICB7IC8vIEU0WFxuICAgICAgICAgICAgYmVnaW46IC88LywgZW5kOiAvPjsvLFxuICAgICAgICAgICAgcmVsZXZhbmNlOiAwLFxuICAgICAgICAgICAgc3ViTGFuZ3VhZ2U6ICd4bWwnXG4gICAgICAgICAgfVxuICAgICAgICBdLFxuICAgICAgICByZWxldmFuY2U6IDBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2Z1bmN0aW9uJyxcbiAgICAgICAgYmVnaW5LZXl3b3JkczogJ2Z1bmN0aW9uJywgZW5kOiAvXFx7LyxcbiAgICAgICAgY29udGFpbnM6IFtcbiAgICAgICAgICBobGpzLmluaGVyaXQoaGxqcy5USVRMRV9NT0RFLCB7YmVnaW46IC9bQS1aYS16JF9dWzAtOUEtWmEteiRfXSovfSksXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2xhc3NOYW1lOiAncGFyYW1zJyxcbiAgICAgICAgICAgIGJlZ2luOiAvXFwoLywgZW5kOiAvXFwpLyxcbiAgICAgICAgICAgIGNvbnRhaW5zOiBbXG4gICAgICAgICAgICAgIGhsanMuQ19MSU5FX0NPTU1FTlRfTU9ERSxcbiAgICAgICAgICAgICAgaGxqcy5DX0JMT0NLX0NPTU1FTlRfTU9ERVxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIGlsbGVnYWw6IC9bXCInXFwoXS9cbiAgICAgICAgICB9XG4gICAgICAgIF0sXG4gICAgICAgIGlsbGVnYWw6IC9cXFt8JS9cbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGJlZ2luOiAvXFwkWyguXS8gLy8gcmVsZXZhbmNlIGJvb3N0ZXIgZm9yIGEgcGF0dGVybiBjb21tb24gdG8gSlMgbGliczogYCQoc29tZXRoaW5nKWAgYW5kIGAkLnNvbWV0aGluZ2BcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGJlZ2luOiAnXFxcXC4nICsgaGxqcy5JREVOVF9SRSwgcmVsZXZhbmNlOiAwIC8vIGhhY2s6IHByZXZlbnRzIGRldGVjdGlvbiBvZiBrZXl3b3JkcyBhZnRlciBkb3RzXG4gICAgICB9XG4gICAgXVxuICB9O1xufTsiLCJtb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKGhsanMpIHtcbiAgdmFyIExJVEVSQUxTID0ge2xpdGVyYWw6ICd0cnVlIGZhbHNlIG51bGwnfTtcbiAgdmFyIFRZUEVTID0gW1xuICAgIGhsanMuUVVPVEVfU1RSSU5HX01PREUsXG4gICAgaGxqcy5DX05VTUJFUl9NT0RFXG4gIF07XG4gIHZhciBWQUxVRV9DT05UQUlORVIgPSB7XG4gICAgY2xhc3NOYW1lOiAndmFsdWUnLFxuICAgIGVuZDogJywnLCBlbmRzV2l0aFBhcmVudDogdHJ1ZSwgZXhjbHVkZUVuZDogdHJ1ZSxcbiAgICBjb250YWluczogVFlQRVMsXG4gICAga2V5d29yZHM6IExJVEVSQUxTXG4gIH07XG4gIHZhciBPQkpFQ1QgPSB7XG4gICAgYmVnaW46ICd7JywgZW5kOiAnfScsXG4gICAgY29udGFpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnYXR0cmlidXRlJyxcbiAgICAgICAgYmVnaW46ICdcXFxccypcIicsIGVuZDogJ1wiXFxcXHMqOlxcXFxzKicsIGV4Y2x1ZGVCZWdpbjogdHJ1ZSwgZXhjbHVkZUVuZDogdHJ1ZSxcbiAgICAgICAgY29udGFpbnM6IFtobGpzLkJBQ0tTTEFTSF9FU0NBUEVdLFxuICAgICAgICBpbGxlZ2FsOiAnXFxcXG4nLFxuICAgICAgICBzdGFydHM6IFZBTFVFX0NPTlRBSU5FUlxuICAgICAgfVxuICAgIF0sXG4gICAgaWxsZWdhbDogJ1xcXFxTJ1xuICB9O1xuICB2YXIgQVJSQVkgPSB7XG4gICAgYmVnaW46ICdcXFxcWycsIGVuZDogJ1xcXFxdJyxcbiAgICBjb250YWluczogW2hsanMuaW5oZXJpdChWQUxVRV9DT05UQUlORVIsIHtjbGFzc05hbWU6IG51bGx9KV0sIC8vIGluaGVyaXQgaXMgYWxzbyBhIHdvcmthcm91bmQgZm9yIGEgYnVnIHRoYXQgbWFrZXMgc2hhcmVkIG1vZGVzIHdpdGggZW5kc1dpdGhQYXJlbnQgY29tcGlsZSBvbmx5IHRoZSBlbmRpbmcgb2Ygb25lIG9mIHRoZSBwYXJlbnRzXG4gICAgaWxsZWdhbDogJ1xcXFxTJ1xuICB9O1xuICBUWVBFUy5zcGxpY2UoVFlQRVMubGVuZ3RoLCAwLCBPQkpFQ1QsIEFSUkFZKTtcbiAgcmV0dXJuIHtcbiAgICBjb250YWluczogVFlQRVMsXG4gICAga2V5d29yZHM6IExJVEVSQUxTLFxuICAgIGlsbGVnYWw6ICdcXFxcUydcbiAgfTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihobGpzKSB7XG4gIHJldHVybiB7XG4gICAgY29udGFpbnM6IFtcbiAgICAgIC8vIGhpZ2hsaWdodCBoZWFkZXJzXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2hlYWRlcicsXG4gICAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgICAgeyBiZWdpbjogJ14jezEsNn0nLCBlbmQ6ICckJyB9LFxuICAgICAgICAgIHsgYmVnaW46ICdeLis/XFxcXG5bPS1dezIsfSQnIH1cbiAgICAgICAgXVxuICAgICAgfSxcbiAgICAgIC8vIGlubGluZSBodG1sXG4gICAgICB7XG4gICAgICAgIGJlZ2luOiAnPCcsIGVuZDogJz4nLFxuICAgICAgICBzdWJMYW5ndWFnZTogJ3htbCcsXG4gICAgICAgIHJlbGV2YW5jZTogMFxuICAgICAgfSxcbiAgICAgIC8vIGxpc3RzIChpbmRpY2F0b3JzIG9ubHkpXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2J1bGxldCcsXG4gICAgICAgIGJlZ2luOiAnXihbKistXXwoXFxcXGQrXFxcXC4pKVxcXFxzKydcbiAgICAgIH0sXG4gICAgICAvLyBzdHJvbmcgc2VnbWVudHNcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnc3Ryb25nJyxcbiAgICAgICAgYmVnaW46ICdbKl9dezJ9Lis/WypfXXsyfSdcbiAgICAgIH0sXG4gICAgICAvLyBlbXBoYXNpcyBzZWdtZW50c1xuICAgICAge1xuICAgICAgICBjbGFzc05hbWU6ICdlbXBoYXNpcycsXG4gICAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgICAgeyBiZWdpbjogJ1xcXFwqLis/XFxcXConIH0sXG4gICAgICAgICAgeyBiZWdpbjogJ18uKz9fJ1xuICAgICAgICAgICwgcmVsZXZhbmNlOiAwXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9LFxuICAgICAgLy8gYmxvY2txdW90ZXNcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnYmxvY2txdW90ZScsXG4gICAgICAgIGJlZ2luOiAnXj5cXFxccysnLCBlbmQ6ICckJ1xuICAgICAgfSxcbiAgICAgIC8vIGNvZGUgc25pcHBldHNcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnY29kZScsXG4gICAgICAgIHZhcmlhbnRzOiBbXG4gICAgICAgICAgeyBiZWdpbjogJ2AuKz9gJyB9LFxuICAgICAgICAgIHsgYmVnaW46ICdeKCB7NH18XFx0KScsIGVuZDogJyQnXG4gICAgICAgICAgLCByZWxldmFuY2U6IDBcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH0sXG4gICAgICAvLyBob3Jpem9udGFsIHJ1bGVzXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2hvcml6b250YWxfcnVsZScsXG4gICAgICAgIGJlZ2luOiAnXlstXFxcXCpdezMsfScsIGVuZDogJyQnXG4gICAgICB9LFxuICAgICAgLy8gdXNpbmcgbGlua3MgLSB0aXRsZSBhbmQgbGlua1xuICAgICAge1xuICAgICAgICBiZWdpbjogJ1xcXFxbLis/XFxcXF1bXFxcXChcXFxcW10uKz9bXFxcXClcXFxcXV0nLFxuICAgICAgICByZXR1cm5CZWdpbjogdHJ1ZSxcbiAgICAgICAgY29udGFpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjbGFzc05hbWU6ICdsaW5rX2xhYmVsJyxcbiAgICAgICAgICAgIGJlZ2luOiAnXFxcXFsnLCBlbmQ6ICdcXFxcXScsXG4gICAgICAgICAgICBleGNsdWRlQmVnaW46IHRydWUsXG4gICAgICAgICAgICByZXR1cm5FbmQ6IHRydWUsXG4gICAgICAgICAgICByZWxldmFuY2U6IDBcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZTogJ2xpbmtfdXJsJyxcbiAgICAgICAgICAgIGJlZ2luOiAnXFxcXF1cXFxcKCcsIGVuZDogJ1xcXFwpJyxcbiAgICAgICAgICAgIGV4Y2x1ZGVCZWdpbjogdHJ1ZSwgZXhjbHVkZUVuZDogdHJ1ZVxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2xhc3NOYW1lOiAnbGlua19yZWZlcmVuY2UnLFxuICAgICAgICAgICAgYmVnaW46ICdcXFxcXVxcXFxbJywgZW5kOiAnXFxcXF0nLFxuICAgICAgICAgICAgZXhjbHVkZUJlZ2luOiB0cnVlLCBleGNsdWRlRW5kOiB0cnVlLFxuICAgICAgICAgIH1cbiAgICAgICAgXSxcbiAgICAgICAgcmVsZXZhbmNlOiAxMFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgYmVnaW46ICdeXFxcXFtcXC4rXFxcXF06JywgZW5kOiAnJCcsXG4gICAgICAgIHJldHVybkJlZ2luOiB0cnVlLFxuICAgICAgICBjb250YWluczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZTogJ2xpbmtfcmVmZXJlbmNlJyxcbiAgICAgICAgICAgIGJlZ2luOiAnXFxcXFsnLCBlbmQ6ICdcXFxcXScsXG4gICAgICAgICAgICBleGNsdWRlQmVnaW46IHRydWUsIGV4Y2x1ZGVFbmQ6IHRydWVcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNsYXNzTmFtZTogJ2xpbmtfdXJsJyxcbiAgICAgICAgICAgIGJlZ2luOiAnXFxcXHMnLCBlbmQ6ICckJ1xuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfVxuICAgIF1cbiAgfTtcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihobGpzKSB7XG4gIHZhciBYTUxfSURFTlRfUkUgPSAnW0EtWmEtejAtOVxcXFwuXzotXSsnO1xuICB2YXIgUEhQID0ge1xuICAgIGJlZ2luOiAvPFxcPyhwaHApPyg/IVxcdykvLCBlbmQ6IC9cXD8+LyxcbiAgICBzdWJMYW5ndWFnZTogJ3BocCcsIHN1Ykxhbmd1YWdlTW9kZTogJ2NvbnRpbnVvdXMnXG4gIH07XG4gIHZhciBUQUdfSU5URVJOQUxTID0ge1xuICAgIGVuZHNXaXRoUGFyZW50OiB0cnVlLFxuICAgIGlsbGVnYWw6IC88LyxcbiAgICByZWxldmFuY2U6IDAsXG4gICAgY29udGFpbnM6IFtcbiAgICAgIFBIUCxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnYXR0cmlidXRlJyxcbiAgICAgICAgYmVnaW46IFhNTF9JREVOVF9SRSxcbiAgICAgICAgcmVsZXZhbmNlOiAwXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBiZWdpbjogJz0nLFxuICAgICAgICByZWxldmFuY2U6IDAsXG4gICAgICAgIGNvbnRhaW5zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2xhc3NOYW1lOiAndmFsdWUnLFxuICAgICAgICAgICAgdmFyaWFudHM6IFtcbiAgICAgICAgICAgICAge2JlZ2luOiAvXCIvLCBlbmQ6IC9cIi99LFxuICAgICAgICAgICAgICB7YmVnaW46IC8nLywgZW5kOiAvJy99LFxuICAgICAgICAgICAgICB7YmVnaW46IC9bXlxcc1xcLz5dKy99XG4gICAgICAgICAgICBdXG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9XG4gICAgXVxuICB9O1xuICByZXR1cm4ge1xuICAgIGFsaWFzZXM6IFsnaHRtbCddLFxuICAgIGNhc2VfaW5zZW5zaXRpdmU6IHRydWUsXG4gICAgY29udGFpbnM6IFtcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnZG9jdHlwZScsXG4gICAgICAgIGJlZ2luOiAnPCFET0NUWVBFJywgZW5kOiAnPicsXG4gICAgICAgIHJlbGV2YW5jZTogMTAsXG4gICAgICAgIGNvbnRhaW5zOiBbe2JlZ2luOiAnXFxcXFsnLCBlbmQ6ICdcXFxcXSd9XVxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAnY29tbWVudCcsXG4gICAgICAgIGJlZ2luOiAnPCEtLScsIGVuZDogJy0tPicsXG4gICAgICAgIHJlbGV2YW5jZTogMTBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ2NkYXRhJyxcbiAgICAgICAgYmVnaW46ICc8XFxcXCFcXFxcW0NEQVRBXFxcXFsnLCBlbmQ6ICdcXFxcXVxcXFxdPicsXG4gICAgICAgIHJlbGV2YW5jZTogMTBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ3RhZycsXG4gICAgICAgIC8qXG4gICAgICAgIFRoZSBsb29rYWhlYWQgcGF0dGVybiAoPz0uLi4pIGVuc3VyZXMgdGhhdCAnYmVnaW4nIG9ubHkgbWF0Y2hlc1xuICAgICAgICAnPHN0eWxlJyBhcyBhIHNpbmdsZSB3b3JkLCBmb2xsb3dlZCBieSBhIHdoaXRlc3BhY2Ugb3IgYW5cbiAgICAgICAgZW5kaW5nIGJyYWtldC4gVGhlICckJyBpcyBuZWVkZWQgZm9yIHRoZSBsZXhlbWUgdG8gYmUgcmVjb2duaXplZFxuICAgICAgICBieSBobGpzLnN1Yk1vZGUoKSB0aGF0IHRlc3RzIGxleGVtZXMgb3V0c2lkZSB0aGUgc3RyZWFtLlxuICAgICAgICAqL1xuICAgICAgICBiZWdpbjogJzxzdHlsZSg/PVxcXFxzfD58JCknLCBlbmQ6ICc+JyxcbiAgICAgICAga2V5d29yZHM6IHt0aXRsZTogJ3N0eWxlJ30sXG4gICAgICAgIGNvbnRhaW5zOiBbVEFHX0lOVEVSTkFMU10sXG4gICAgICAgIHN0YXJ0czoge1xuICAgICAgICAgIGVuZDogJzwvc3R5bGU+JywgcmV0dXJuRW5kOiB0cnVlLFxuICAgICAgICAgIHN1Ykxhbmd1YWdlOiAnY3NzJ1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBjbGFzc05hbWU6ICd0YWcnLFxuICAgICAgICAvLyBTZWUgdGhlIGNvbW1lbnQgaW4gdGhlIDxzdHlsZSB0YWcgYWJvdXQgdGhlIGxvb2thaGVhZCBwYXR0ZXJuXG4gICAgICAgIGJlZ2luOiAnPHNjcmlwdCg/PVxcXFxzfD58JCknLCBlbmQ6ICc+JyxcbiAgICAgICAga2V5d29yZHM6IHt0aXRsZTogJ3NjcmlwdCd9LFxuICAgICAgICBjb250YWluczogW1RBR19JTlRFUk5BTFNdLFxuICAgICAgICBzdGFydHM6IHtcbiAgICAgICAgICBlbmQ6ICc8L3NjcmlwdD4nLCByZXR1cm5FbmQ6IHRydWUsXG4gICAgICAgICAgc3ViTGFuZ3VhZ2U6ICdqYXZhc2NyaXB0J1xuICAgICAgICB9XG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBiZWdpbjogJzwlJywgZW5kOiAnJT4nLFxuICAgICAgICBzdWJMYW5ndWFnZTogJ3Zic2NyaXB0J1xuICAgICAgfSxcbiAgICAgIFBIUCxcbiAgICAgIHtcbiAgICAgICAgY2xhc3NOYW1lOiAncGknLFxuICAgICAgICBiZWdpbjogLzxcXD9cXHcrLywgZW5kOiAvXFw/Pi8sXG4gICAgICAgIHJlbGV2YW5jZTogMTBcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGNsYXNzTmFtZTogJ3RhZycsXG4gICAgICAgIGJlZ2luOiAnPC8/JywgZW5kOiAnLz8+JyxcbiAgICAgICAgY29udGFpbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBjbGFzc05hbWU6ICd0aXRsZScsIGJlZ2luOiAnW14gLz48XSsnLCByZWxldmFuY2U6IDBcbiAgICAgICAgICB9LFxuICAgICAgICAgIFRBR19JTlRFUk5BTFNcbiAgICAgICAgXVxuICAgICAgfVxuICAgIF1cbiAgfTtcbn07IiwiLy8gaHR0cDovL2hpZ2hsaWdodGpzLnJlYWR0aGVkb2NzLm9yZy9lbi9sYXRlc3QvY3NzLWNsYXNzZXMtcmVmZXJlbmNlLmh0bWxcblxubW9kdWxlLmV4cG9ydHMgPSBbXG4gICdhZGRpdGlvbicsXG4gICdhbm5vdGFpb24nLFxuICAnYW5ub3RhdGlvbicsXG4gICdhcmd1bWVudCcsXG4gICdhcnJheScsXG4gICdhdF9ydWxlJyxcbiAgJ2F0dHJfc2VsZWN0b3InLFxuICAnYXR0cmlidXRlJyxcbiAgJ2JlZ2luLWJsb2NrJyxcbiAgJ2Jsb2NrcXVvdGUnLFxuICAnYm9keScsXG4gICdidWlsdF9pbicsXG4gICdidWxsZXQnLFxuICAnY2JyYWNrZXQnLFxuICAnY2RhdGEnLFxuICAnY2VsbCcsXG4gICdjaGFuZ2UnLFxuICAnY2hhcicsXG4gICdjaHVuaycsXG4gICdjbGFzcycsXG4gICdjb2RlJyxcbiAgJ2NvbGxlY3Rpb24nLFxuICAnY29tbWFuZCcsXG4gICdjb21tYW5kcycsXG4gICdjb21tZW4nLFxuICAnY29tbWVudCcsXG4gICdjb25zdGFudCcsXG4gICdjb250YWluZXInLFxuICAnZGFydGRvYycsXG4gICdkYXRlJyxcbiAgJ2RlY29yYXRvcicsXG4gICdkZWZhdWx0JyxcbiAgJ2RlbGV0aW9uJyxcbiAgJ2RvY3R5cGUnLFxuICAnZW1waGFzaXMnLFxuICAnZW5kLWJsb2NrJyxcbiAgJ2VudnZhcicsXG4gICdleHByZXNzaW9uJyxcbiAgJ2ZpbGVuYW1lJyxcbiAgJ2ZpbHRlcicsXG4gICdmbG93JyxcbiAgJ2ZvcmVpZ24nLFxuICAnZm9ybXVsYScsXG4gICdmdW5jJyxcbiAgJ2Z1bmN0aW9uJyxcbiAgJ2Z1bmN0aW9uX25hbWUnLFxuICAnZ2VuZXJpY3MnLFxuICAnaGVhZGVyJyxcbiAgJ2hleGNvbG9yJyxcbiAgJ2hvcml6b250YWxfcnVsZScsXG4gICdpZCcsXG4gICdpbXBvcnQnLFxuICAnaW1wb3J0YW50JyxcbiAgJ2luZml4JyxcbiAgJ2luaGVyaXRhbmNlJyxcbiAgJ2lucHV0JyxcbiAgJ2phdmFkb2MnLFxuICAnamF2YWRvY3RhZycsXG4gICdrZXl3b3JkJyxcbiAgJ2tleXdvcmRzJyxcbiAgJ2xhYmVsJyxcbiAgJ2xpbmtfbGFiZWwnLFxuICAnbGlua19yZWZlcmVuY2UnLFxuICAnbGlua191cmwnLFxuICAnbGlzdCcsXG4gICdsaXRlcmFsJyxcbiAgJ2xvY2FsdmFycycsXG4gICdsb25nX2JyYWNrZXRzJyxcbiAgJ21hdHJpeCcsXG4gICdtb2R1bGUnLFxuICAnbnVtYmVyJyxcbiAgJ29wZXJhdG9yJyxcbiAgJ291dHB1dCcsXG4gICdwYWNrYWdlJyxcbiAgJ3BhcmFtJyxcbiAgJ3BhcmFtZXRlcicsXG4gICdwYXJhbXMnLFxuICAncGFyZW50JyxcbiAgJ3BocGRvYycsXG4gICdwaScsXG4gICdwb2QnLFxuICAncHAnLFxuICAncHJhZ21hJyxcbiAgJ3ByZXByb2Nlc3NvcicsXG4gICdwcm9tcHQnLFxuICAncHJvcGVydHknLFxuICAncHNldWRvJyxcbiAgJ3F1b3RlZCcsXG4gICdyZWNvcmRfbmFtZScsXG4gICdyZWdleCcsXG4gICdyZWdleHAnLFxuICAncmVxdWVzdCcsXG4gICdyZXNlcnZlZCcsXG4gICdyZXN0X2FyZycsXG4gICdydWxlcycsXG4gICdzaGFkZXInLFxuICAnc2hhZGluZycsXG4gICdzaGViYW5nJyxcbiAgJ3NwZWNpYWwnLFxuICAnc3FicmFja2V0JyxcbiAgJ3N0YXR1cycsXG4gICdzdGxfY29udGFpbmVyJyxcbiAgJ3N0cmVhbScsXG4gICdzdHJpbmcnLFxuICAnc3Ryb25nJyxcbiAgJ3N1YicsXG4gICdzdWJzdCcsXG4gICdzdW1tYXJ5JyxcbiAgJ3N5bWJvbCcsXG4gICd0YWcnLFxuICAndGVtcGxhdGVfY29tbWVudCcsXG4gICd0ZW1wbGF0ZV90YWcnLFxuICAndGl0bGUnLFxuICAndHlwZScsXG4gICd0eXBlZGVmJyxcbiAgJ3R5cGVuYW1lJyxcbiAgJ3ZhbHVlJyxcbiAgJ3Zhcl9leHBhbmQnLFxuICAndmFyaWFibGUnLFxuICAnd2ludXRpbHMnLFxuICAneG1sRG9jVGFnJyxcbiAgJ3lhcmRvY3RhZydcbl1cbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIHRvTWFwID0gcmVxdWlyZSgnLi90b01hcCcpO1xudmFyIHVyaXMgPSBbJ2JhY2tncm91bmQnLCAnYmFzZScsICdjaXRlJywgJ2hyZWYnLCAnbG9uZ2Rlc2MnLCAnc3JjJywgJ3VzZW1hcCddO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgdXJpczogdG9NYXAodXJpcykgLy8gYXR0cmlidXRlcyB0aGF0IGhhdmUgYW4gaHJlZiBhbmQgaGVuY2UgbmVlZCB0byBiZSBzYW5pdGl6ZWRcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBkZWZhdWx0cyA9IHtcbiAgYWxsb3dlZEF0dHJpYnV0ZXM6IHtcbiAgICBhOiBbJ2hyZWYnLCAnbmFtZScsICd0YXJnZXQnLCAndGl0bGUnLCAnYXJpYS1sYWJlbCddLFxuICAgIGlmcmFtZTogWydhbGxvd2Z1bGxzY3JlZW4nLCAnZnJhbWVib3JkZXInLCAnc3JjJ10sXG4gICAgaW1nOiBbJ3NyYycsICdhbHQnLCAndGl0bGUnLCAnYXJpYS1sYWJlbCddXG4gIH0sXG4gIGFsbG93ZWRDbGFzc2VzOiB7fSxcbiAgYWxsb3dlZFNjaGVtZXM6IFsnaHR0cCcsICdodHRwcycsICdtYWlsdG8nXSxcbiAgYWxsb3dlZFRhZ3M6IFtcbiAgICAnYScsICdhcnRpY2xlJywgJ2InLCAnYmxvY2txdW90ZScsICdicicsICdjYXB0aW9uJywgJ2NvZGUnLCAnZGVsJywgJ2RldGFpbHMnLCAnZGl2JywgJ2VtJyxcbiAgICAnaDEnLCAnaDInLCAnaDMnLCAnaDQnLCAnaDUnLCAnaDYnLCAnaHInLCAnaScsICdpbWcnLCAnaW5zJywgJ2tiZCcsICdsaScsICdtYWluJywgJ21hcmsnLFxuICAgICdvbCcsICdwJywgJ3ByZScsICdzZWN0aW9uJywgJ3NwYW4nLCAnc3RyaWtlJywgJ3N0cm9uZycsICdzdWInLCAnc3VtbWFyeScsICdzdXAnLCAndGFibGUnLFxuICAgICd0Ym9keScsICd0ZCcsICd0aCcsICd0aGVhZCcsICd0cicsICd1bCdcbiAgXSxcbiAgZmlsdGVyOiBudWxsXG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGRlZmF1bHRzO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgdG9NYXAgPSByZXF1aXJlKCcuL3RvTWFwJyk7XG52YXIgdm9pZHMgPSBbJ2FyZWEnLCAnYnInLCAnY29sJywgJ2hyJywgJ2ltZycsICd3YnInLCAnaW5wdXQnLCAnYmFzZScsICdiYXNlZm9udCcsICdsaW5rJywgJ21ldGEnXTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHZvaWRzOiB0b01hcCh2b2lkcylcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoZSA9IHJlcXVpcmUoJ2hlJyk7XG52YXIgYXNzaWduID0gcmVxdWlyZSgnYXNzaWdubWVudCcpO1xudmFyIHBhcnNlciA9IHJlcXVpcmUoJy4vcGFyc2VyJyk7XG52YXIgc2FuaXRpemVyID0gcmVxdWlyZSgnLi9zYW5pdGl6ZXInKTtcbnZhciBkZWZhdWx0cyA9IHJlcXVpcmUoJy4vZGVmYXVsdHMnKTtcblxuZnVuY3Rpb24gaW5zYW5lIChodG1sLCBvcHRpb25zLCBzdHJpY3QpIHtcbiAgdmFyIGJ1ZmZlciA9IFtdO1xuICB2YXIgY29uZmlndXJhdGlvbiA9IHN0cmljdCA9PT0gdHJ1ZSA/IG9wdGlvbnMgOiBhc3NpZ24oe30sIGRlZmF1bHRzLCBvcHRpb25zKTtcbiAgdmFyIGhhbmRsZXIgPSBzYW5pdGl6ZXIoYnVmZmVyLCBjb25maWd1cmF0aW9uKTtcblxuICBwYXJzZXIoaHRtbCwgaGFuZGxlcik7XG5cbiAgcmV0dXJuIGJ1ZmZlci5qb2luKCcnKTtcbn1cblxuaW5zYW5lLmRlZmF1bHRzID0gZGVmYXVsdHM7XG5tb2R1bGUuZXhwb3J0cyA9IGluc2FuZTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBsb3dlcmNhc2UgKHN0cmluZykge1xuICByZXR1cm4gdHlwZW9mIHN0cmluZyA9PT0gJ3N0cmluZycgPyBzdHJpbmcudG9Mb3dlckNhc2UoKSA6IHN0cmluZztcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBoZSA9IHJlcXVpcmUoJ2hlJyk7XG52YXIgbG93ZXJjYXNlID0gcmVxdWlyZSgnLi9sb3dlcmNhc2UnKTtcbnZhciBhdHRyaWJ1dGVzID0gcmVxdWlyZSgnLi9hdHRyaWJ1dGVzJyk7XG52YXIgZWxlbWVudHMgPSByZXF1aXJlKCcuL2VsZW1lbnRzJyk7XG52YXIgcnN0YXJ0ID0gL148XFxzKihbXFx3Oi1dKykoKD86XFxzK1tcXHc6LV0rKD86XFxzKj1cXHMqKD86KD86XCJbXlwiXSpcIil8KD86J1teJ10qJyl8W14+XFxzXSspKT8pKilcXHMqKFxcLz8pXFxzKj4vO1xudmFyIHJlbmQgPSAvXjxcXHMqXFwvXFxzKihbXFx3Oi1dKylbXj5dKj4vO1xudmFyIHJhdHRycyA9IC8oW1xcdzotXSspKD86XFxzKj1cXHMqKD86KD86XCIoKD86W15cIl0pKilcIil8KD86JygoPzpbXiddKSopJyl8KFtePlxcc10rKSkpPy9nO1xudmFyIHJ0YWcgPSAvXjwvO1xudmFyIHJ0YWdlbmQgPSAvXjxcXHMqXFwvLztcblxuZnVuY3Rpb24gY3JlYXRlU3RhY2sgKCkge1xuICB2YXIgc3RhY2sgPSBbXTtcbiAgc3RhY2subGFzdEl0ZW0gPSBmdW5jdGlvbiBsYXN0SXRlbSAoKSB7XG4gICAgcmV0dXJuIHN0YWNrW3N0YWNrLmxlbmd0aCAtIDFdO1xuICB9O1xuICByZXR1cm4gc3RhY2s7XG59XG5cbmZ1bmN0aW9uIHBhcnNlciAoaHRtbCwgaGFuZGxlcikge1xuICB2YXIgc3RhY2sgPSBjcmVhdGVTdGFjaygpO1xuICB2YXIgbGFzdCA9IGh0bWw7XG4gIHZhciBjaGFycztcblxuICB3aGlsZSAoaHRtbCkge1xuICAgIHBhcnNlUGFydCgpO1xuICB9XG4gIHBhcnNlRW5kVGFnKCk7IC8vIGNsZWFuIHVwIGFueSByZW1haW5pbmcgdGFnc1xuXG4gIGZ1bmN0aW9uIHBhcnNlUGFydCAoKSB7XG4gICAgY2hhcnMgPSB0cnVlO1xuICAgIHBhcnNlVGFnKCk7XG5cbiAgICB2YXIgc2FtZSA9IGh0bWwgPT09IGxhc3Q7XG4gICAgbGFzdCA9IGh0bWw7XG5cbiAgICBpZiAoc2FtZSkgeyAvLyBkaXNjYXJkLCBiZWNhdXNlIGl0J3MgaW52YWxpZFxuICAgICAgaHRtbCA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlVGFnICgpIHtcbiAgICBpZiAoaHRtbC5zdWJzdHIoMCwgNCkgPT09ICc8IS0tJykgeyAvLyBjb21tZW50c1xuICAgICAgcGFyc2VDb21tZW50KCk7XG4gICAgfSBlbHNlIGlmIChydGFnZW5kLnRlc3QoaHRtbCkpIHtcbiAgICAgIHBhcnNlRWRnZShyZW5kLCBwYXJzZUVuZFRhZyk7XG4gICAgfSBlbHNlIGlmIChydGFnLnRlc3QoaHRtbCkpIHtcbiAgICAgIHBhcnNlRWRnZShyc3RhcnQsIHBhcnNlU3RhcnRUYWcpO1xuICAgIH1cbiAgICBwYXJzZVRhZ0RlY29kZSgpO1xuICB9XG5cbiAgZnVuY3Rpb24gcGFyc2VFZGdlIChyZWdleCwgcGFyc2VyKSB7XG4gICAgdmFyIG1hdGNoID0gaHRtbC5tYXRjaChyZWdleCk7XG4gICAgaWYgKG1hdGNoKSB7XG4gICAgICBodG1sID0gaHRtbC5zdWJzdHJpbmcobWF0Y2hbMF0ubGVuZ3RoKTtcbiAgICAgIG1hdGNoWzBdLnJlcGxhY2UocmVnZXgsIHBhcnNlcik7XG4gICAgICBjaGFycyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlQ29tbWVudCAoKSB7XG4gICAgdmFyIGluZGV4ID0gaHRtbC5pbmRleE9mKCctLT4nKTtcbiAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgaWYgKGhhbmRsZXIuY29tbWVudCkge1xuICAgICAgICBoYW5kbGVyLmNvbW1lbnQoaHRtbC5zdWJzdHJpbmcoNCwgaW5kZXgpKTtcbiAgICAgIH1cbiAgICAgIGh0bWwgPSBodG1sLnN1YnN0cmluZyhpbmRleCArIDMpO1xuICAgICAgY2hhcnMgPSBmYWxzZTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZVRhZ0RlY29kZSAoKSB7XG4gICAgaWYgKCFjaGFycykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICB2YXIgdGV4dDtcbiAgICB2YXIgaW5kZXggPSBodG1sLmluZGV4T2YoJzwnKTtcbiAgICBpZiAoaW5kZXggPj0gMCkge1xuICAgICAgdGV4dCA9IGh0bWwuc3Vic3RyaW5nKDAsIGluZGV4KTtcbiAgICAgIGh0bWwgPSBodG1sLnN1YnN0cmluZyhpbmRleCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRleHQgPSBodG1sO1xuICAgICAgaHRtbCA9ICcnO1xuICAgIH1cbiAgICBpZiAoaGFuZGxlci5jaGFycykge1xuICAgICAgaGFuZGxlci5jaGFycyh0ZXh0KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBwYXJzZVN0YXJ0VGFnICh0YWcsIHRhZ05hbWUsIHJlc3QsIHVuYXJ5KSB7XG4gICAgdmFyIGF0dHJzID0ge307XG4gICAgdmFyIGxvdyA9IGxvd2VyY2FzZSh0YWdOYW1lKTtcbiAgICB2YXIgdSA9IGVsZW1lbnRzLnZvaWRzW2xvd10gfHwgISF1bmFyeTtcblxuICAgIHJlc3QucmVwbGFjZShyYXR0cnMsIGF0dHJSZXBsYWNlcik7XG5cbiAgICBpZiAoIXUpIHtcbiAgICAgIHN0YWNrLnB1c2gobG93KTtcbiAgICB9XG4gICAgaWYgKGhhbmRsZXIuc3RhcnQpIHtcbiAgICAgIGhhbmRsZXIuc3RhcnQobG93LCBhdHRycywgdSk7XG4gICAgfVxuXG4gICAgZnVuY3Rpb24gYXR0clJlcGxhY2VyIChtYXRjaCwgbmFtZSwgZG91YmxlUXVvdGVkVmFsdWUsIHNpbmdsZVF1b3RlZFZhbHVlLCB1bnF1b3RlZFZhbHVlKSB7XG4gICAgICBpZiAoZG91YmxlUXVvdGVkVmFsdWUgPT09IHZvaWQgMCAmJiBzaW5nbGVRdW90ZWRWYWx1ZSA9PT0gdm9pZCAwICYmIHVucXVvdGVkVmFsdWUgPT09IHZvaWQgMCkge1xuICAgICAgICBhdHRyc1tuYW1lXSA9IHZvaWQgMDsgLy8gYXR0cmlidXRlIGlzIGxpa2UgPGJ1dHRvbiBkaXNhYmxlZD48L2J1dHRvbj5cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGF0dHJzW25hbWVdID0gaGUuZGVjb2RlKGRvdWJsZVF1b3RlZFZhbHVlIHx8IHNpbmdsZVF1b3RlZFZhbHVlIHx8IHVucXVvdGVkVmFsdWUgfHwgJycpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHBhcnNlRW5kVGFnICh0YWcsIHRhZ05hbWUpIHtcbiAgICB2YXIgaTtcbiAgICB2YXIgcG9zID0gMDtcbiAgICB2YXIgbG93ID0gbG93ZXJjYXNlKHRhZ05hbWUpO1xuICAgIGlmIChsb3cpIHtcbiAgICAgIGZvciAocG9zID0gc3RhY2subGVuZ3RoIC0gMTsgcG9zID49IDA7IHBvcy0tKSB7XG4gICAgICAgIGlmIChzdGFja1twb3NdID09PSBsb3cpIHtcbiAgICAgICAgICBicmVhazsgLy8gZmluZCB0aGUgY2xvc2VzdCBvcGVuZWQgdGFnIG9mIHRoZSBzYW1lIHR5cGVcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBpZiAocG9zID49IDApIHtcbiAgICAgIGZvciAoaSA9IHN0YWNrLmxlbmd0aCAtIDE7IGkgPj0gcG9zOyBpLS0pIHtcbiAgICAgICAgaWYgKGhhbmRsZXIuZW5kKSB7IC8vIGNsb3NlIGFsbCB0aGUgb3BlbiBlbGVtZW50cywgdXAgdGhlIHN0YWNrXG4gICAgICAgICAgaGFuZGxlci5lbmQoc3RhY2tbaV0pO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBzdGFjay5sZW5ndGggPSBwb3M7XG4gICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gcGFyc2VyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgaGUgPSByZXF1aXJlKCdoZScpO1xudmFyIGxvd2VyY2FzZSA9IHJlcXVpcmUoJy4vbG93ZXJjYXNlJyk7XG52YXIgYXR0cmlidXRlcyA9IHJlcXVpcmUoJy4vYXR0cmlidXRlcycpO1xuXG5mdW5jdGlvbiBzYW5pdGl6ZXIgKGJ1ZmZlciwgb3B0aW9ucykge1xuICB2YXIgbGFzdDtcbiAgdmFyIGNvbnRleHQ7XG4gIHZhciBvID0gb3B0aW9ucyB8fCB7fTtcblxuICByZXNldCgpO1xuXG4gIHJldHVybiB7XG4gICAgc3RhcnQ6IHN0YXJ0LFxuICAgIGVuZDogZW5kLFxuICAgIGNoYXJzOiBjaGFyc1xuICB9O1xuXG4gIGZ1bmN0aW9uIG91dCAodmFsdWUpIHtcbiAgICBidWZmZXIucHVzaCh2YWx1ZSk7XG4gIH1cblxuICBmdW5jdGlvbiBzdGFydCAodGFnLCBhdHRycywgdW5hcnkpIHtcbiAgICB2YXIgbG93ID0gbG93ZXJjYXNlKHRhZyk7XG5cbiAgICBpZiAoY29udGV4dC5pZ25vcmluZykge1xuICAgICAgaWdub3JlKGxvdyk7IHJldHVybjtcbiAgICB9XG4gICAgaWYgKChvLmFsbG93ZWRUYWdzIHx8IFtdKS5pbmRleE9mKGxvdykgPT09IC0xKSB7XG4gICAgICBpZ25vcmUobG93KTsgcmV0dXJuO1xuICAgIH1cbiAgICBpZiAoby5maWx0ZXIgJiYgIW8uZmlsdGVyKHsgdGFnOiBsb3csIGF0dHJzOiBhdHRycyB9KSkge1xuICAgICAgaWdub3JlKGxvdyk7IHJldHVybjtcbiAgICB9XG5cbiAgICBvdXQoJzwnKTtcbiAgICBvdXQobG93KTtcbiAgICBPYmplY3Qua2V5cyhhdHRycykuZm9yRWFjaChwYXJzZSk7XG4gICAgb3V0KHVuYXJ5ID8gJy8+JyA6ICc+Jyk7XG5cbiAgICBmdW5jdGlvbiBwYXJzZSAoa2V5KSB7XG4gICAgICB2YXIgdmFsdWUgPSBhdHRyc1trZXldO1xuICAgICAgdmFyIGNsYXNzZXNPayA9IChvLmFsbG93ZWRDbGFzc2VzIHx8IHt9KVtsb3ddIHx8IFtdO1xuICAgICAgdmFyIGF0dHJzT2sgPSAoby5hbGxvd2VkQXR0cmlidXRlcyB8fCB7fSlbbG93XSB8fCBbXTtcbiAgICAgIHZhciB2YWxpZDtcbiAgICAgIHZhciBsa2V5ID0gbG93ZXJjYXNlKGtleSk7XG4gICAgICBpZiAobGtleSA9PT0gJ2NsYXNzJyAmJiBhdHRyc09rLmluZGV4T2YobGtleSkgPT09IC0xKSB7XG4gICAgICAgIHZhbHVlID0gdmFsdWUuc3BsaXQoJyAnKS5maWx0ZXIoaXNWYWxpZENsYXNzKS5qb2luKCcgJykudHJpbSgpO1xuICAgICAgICB2YWxpZCA9IHZhbHVlLmxlbmd0aDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbGlkID0gYXR0cnNPay5pbmRleE9mKGxrZXkpICE9PSAtMSAmJiAoYXR0cmlidXRlcy51cmlzW2xrZXldICE9PSB0cnVlIHx8IHRlc3RVcmwodmFsdWUpKTtcbiAgICAgIH1cbiAgICAgIGlmICh2YWxpZCkge1xuICAgICAgICBvdXQoJyAnKTtcbiAgICAgICAgb3V0KGtleSk7XG4gICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgb3V0KCc9XCInKTtcbiAgICAgICAgICBvdXQoaGUuZW5jb2RlKHZhbHVlKSk7XG4gICAgICAgICAgb3V0KCdcIicpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmdW5jdGlvbiBpc1ZhbGlkQ2xhc3MgKGNsYXNzTmFtZSkge1xuICAgICAgICByZXR1cm4gY2xhc3Nlc09rICYmIGNsYXNzZXNPay5pbmRleE9mKGNsYXNzTmFtZSkgIT09IC0xO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIGVuZCAodGFnKSB7XG4gICAgdmFyIGxvdyA9IGxvd2VyY2FzZSh0YWcpO1xuICAgIHZhciBhbGxvd2VkID0gKG8uYWxsb3dlZFRhZ3MgfHwgW10pLmluZGV4T2YobG93KSAhPT0gLTE7XG4gICAgaWYgKGFsbG93ZWQpIHtcbiAgICAgIGlmIChjb250ZXh0Lmlnbm9yaW5nID09PSBmYWxzZSkge1xuICAgICAgICBvdXQoJzwvJyk7XG4gICAgICAgIG91dChsb3cpO1xuICAgICAgICBvdXQoJz4nKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHVuaWdub3JlKGxvdyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHVuaWdub3JlKGxvdyk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gdGVzdFVybCAodGV4dCkge1xuICAgIHZhciBzdGFydCA9IHRleHRbMF07XG4gICAgaWYgKHN0YXJ0ID09PSAnIycgfHwgc3RhcnQgPT09ICcvJykge1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICAgIHZhciBjb2xvbiA9IHRleHQuaW5kZXhPZignOicpO1xuICAgIGlmIChjb2xvbiA9PT0gLTEpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICB2YXIgcXVlc3Rpb25tYXJrID0gdGV4dC5pbmRleE9mKCc/Jyk7XG4gICAgaWYgKHF1ZXN0aW9ubWFyayAhPT0gLTEgJiYgY29sb24gPiBxdWVzdGlvbm1hcmspIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICB2YXIgaGFzaCA9IHRleHQuaW5kZXhPZignIycpO1xuICAgIGlmIChoYXNoICE9PSAtMSAmJiBjb2xvbiA+IGhhc2gpIHtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgICByZXR1cm4gby5hbGxvd2VkU2NoZW1lcy5zb21lKG1hdGNoZXMpO1xuXG4gICAgZnVuY3Rpb24gbWF0Y2hlcyAoc2NoZW1lKSB7XG4gICAgICByZXR1cm4gdGV4dC5pbmRleE9mKHNjaGVtZSArICc6JykgPT09IDA7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gY2hhcnMgKHRleHQpIHtcbiAgICBpZiAoY29udGV4dC5pZ25vcmluZyA9PT0gZmFsc2UpIHtcbiAgICAgIG91dCh0ZXh0KTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBpZ25vcmUgKHRhZykge1xuICAgIGlmIChjb250ZXh0Lmlnbm9yaW5nID09PSBmYWxzZSkge1xuICAgICAgY29udGV4dCA9IHsgaWdub3Jpbmc6IHRhZywgZGVwdGg6IDEgfTtcbiAgICB9IGVsc2UgaWYgKGNvbnRleHQuaWdub3JpbmcgPT09IHRhZykge1xuICAgICAgY29udGV4dC5kZXB0aCsrO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHVuaWdub3JlICh0YWcpIHtcbiAgICBpZiAoY29udGV4dC5pZ25vcmluZyA9PT0gdGFnKSB7XG4gICAgICBpZiAoLS1jb250ZXh0LmRlcHRoIDw9IDApIHtcbiAgICAgICAgcmVzZXQoKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiByZXNldCAoKSB7XG4gICAgY29udGV4dCA9IHsgaWdub3Jpbmc6IGZhbHNlLCBkZXB0aDogMCB9O1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gc2FuaXRpemVyO1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIgZXNjYXBlcyA9IHtcbiAgJyYnOiAnJmFtcDsnLFxuICAnPCc6ICcmbHQ7JyxcbiAgJz4nOiAnJmd0OycsXG4gICdcIic6ICcmcXVvdDsnLFxuICBcIidcIjogJyYjMzk7J1xufTtcbnZhciB1bmVzY2FwZXMgPSB7XG4gICcmYW1wOyc6ICcmJyxcbiAgJyZsdDsnOiAnPCcsXG4gICcmZ3Q7JzogJz4nLFxuICAnJnF1b3Q7JzogJ1wiJyxcbiAgJyYjMzk7JzogXCInXCJcbn07XG52YXIgcmVzY2FwZWQgPSAvKCZhbXA7fCZsdDt8Jmd0O3wmcXVvdDt8JiMzOTspL2c7XG52YXIgcnVuZXNjYXBlZCA9IC9bJjw+XCInXS9nO1xuXG5mdW5jdGlvbiBlc2NhcGVIdG1sQ2hhciAobWF0Y2gpIHtcbiAgcmV0dXJuIGVzY2FwZXNbbWF0Y2hdO1xufVxuZnVuY3Rpb24gdW5lc2NhcGVIdG1sQ2hhciAobWF0Y2gpIHtcbiAgcmV0dXJuIHVuZXNjYXBlc1ttYXRjaF07XG59XG5cbmZ1bmN0aW9uIGVzY2FwZUh0bWwgKHRleHQpIHtcbiAgcmV0dXJuIHRleHQgPT0gbnVsbCA/ICcnIDogU3RyaW5nKHRleHQpLnJlcGxhY2UocnVuZXNjYXBlZCwgZXNjYXBlSHRtbENoYXIpO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZUh0bWwgKGh0bWwpIHtcbiAgcmV0dXJuIGh0bWwgPT0gbnVsbCA/ICcnIDogU3RyaW5nKGh0bWwpLnJlcGxhY2UocmVzY2FwZWQsIHVuZXNjYXBlSHRtbENoYXIpO1xufVxuXG5lc2NhcGVIdG1sLm9wdGlvbnMgPSB1bmVzY2FwZUh0bWwub3B0aW9ucyA9IHt9O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgZW5jb2RlOiBlc2NhcGVIdG1sLFxuICBlc2NhcGU6IGVzY2FwZUh0bWwsXG4gIGRlY29kZTogdW5lc2NhcGVIdG1sLFxuICB1bmVzY2FwZTogdW5lc2NhcGVIdG1sLFxuICB2ZXJzaW9uOiAnMS4wLjAtYnJvd3Nlcidcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbmZ1bmN0aW9uIHRvTWFwIChsaXN0KSB7XG4gIHJldHVybiBsaXN0LnJlZHVjZShhc0tleSwge30pO1xufVxuXG5mdW5jdGlvbiBhc0tleSAoYWNjdW11bGF0b3IsIGl0ZW0pIHtcbiAgYWNjdW11bGF0b3JbaXRlbV0gPSB0cnVlO1xuICByZXR1cm4gYWNjdW11bGF0b3I7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gdG9NYXA7XG4iLCIndXNlIHN0cmljdCc7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIEhlbHBlcnNcblxuLy8gTWVyZ2Ugb2JqZWN0c1xuLy9cbmZ1bmN0aW9uIGFzc2lnbihvYmogLypmcm9tMSwgZnJvbTIsIGZyb20zLCAuLi4qLykge1xuICB2YXIgc291cmNlcyA9IEFycmF5LnByb3RvdHlwZS5zbGljZS5jYWxsKGFyZ3VtZW50cywgMSk7XG5cbiAgc291cmNlcy5mb3JFYWNoKGZ1bmN0aW9uIChzb3VyY2UpIHtcbiAgICBpZiAoIXNvdXJjZSkgeyByZXR1cm47IH1cblxuICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBvYmpba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gb2JqO1xufVxuXG5mdW5jdGlvbiBfY2xhc3Mob2JqKSB7IHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwob2JqKTsgfVxuZnVuY3Rpb24gaXNTdHJpbmcob2JqKSB7IHJldHVybiBfY2xhc3Mob2JqKSA9PT0gJ1tvYmplY3QgU3RyaW5nXSc7IH1cbmZ1bmN0aW9uIGlzT2JqZWN0KG9iaikgeyByZXR1cm4gX2NsYXNzKG9iaikgPT09ICdbb2JqZWN0IE9iamVjdF0nOyB9XG5mdW5jdGlvbiBpc1JlZ0V4cChvYmopIHsgcmV0dXJuIF9jbGFzcyhvYmopID09PSAnW29iamVjdCBSZWdFeHBdJzsgfVxuZnVuY3Rpb24gaXNGdW5jdGlvbihvYmopIHsgcmV0dXJuIF9jbGFzcyhvYmopID09PSAnW29iamVjdCBGdW5jdGlvbl0nOyB9XG5cblxuZnVuY3Rpb24gZXNjYXBlUkUgKHN0cikgeyByZXR1cm4gc3RyLnJlcGxhY2UoL1suPyorXiRbXFxdXFxcXCgpe318LV0vZywgJ1xcXFwkJicpOyB9XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxudmFyIGRlZmF1bHRTY2hlbWFzID0ge1xuICAnaHR0cDonOiB7XG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uICh0ZXh0LCBwb3MsIHNlbGYpIHtcbiAgICAgIHZhciB0YWlsID0gdGV4dC5zbGljZShwb3MpO1xuXG4gICAgICBpZiAoIXNlbGYucmUuaHR0cCkge1xuICAgICAgICAvLyBjb21waWxlIGxhemlseSwgYmVjYXVzZSBcImhvc3RcIi1jb250YWluaW5nIHZhcmlhYmxlcyBjYW4gY2hhbmdlIG9uIHRsZHMgdXBkYXRlLlxuICAgICAgICBzZWxmLnJlLmh0dHAgPSAgbmV3IFJlZ0V4cChcbiAgICAgICAgICAnXlxcXFwvXFxcXC8nICsgc2VsZi5yZS5zcmNfYXV0aCArIHNlbGYucmUuc3JjX2hvc3RfcG9ydF9zdHJpY3QgKyBzZWxmLnJlLnNyY19wYXRoLCAnaSdcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChzZWxmLnJlLmh0dHAudGVzdCh0YWlsKSkge1xuICAgICAgICByZXR1cm4gdGFpbC5tYXRjaChzZWxmLnJlLmh0dHApWzBdLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgfSxcbiAgJ2h0dHBzOic6ICAnaHR0cDonLFxuICAnZnRwOic6ICAgICdodHRwOicsXG4gICcvLyc6ICAgICAge1xuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAodGV4dCwgcG9zLCBzZWxmKSB7XG4gICAgICB2YXIgdGFpbCA9IHRleHQuc2xpY2UocG9zKTtcblxuICAgICAgaWYgKCFzZWxmLnJlLm5vX2h0dHApIHtcbiAgICAgIC8vIGNvbXBpbGUgbGF6aWx5LCBiZWNheXNlIFwiaG9zdFwiLWNvbnRhaW5pbmcgdmFyaWFibGVzIGNhbiBjaGFuZ2Ugb24gdGxkcyB1cGRhdGUuXG4gICAgICAgIHNlbGYucmUubm9faHR0cCA9ICBuZXcgUmVnRXhwKFxuICAgICAgICAgICdeJyArIHNlbGYucmUuc3JjX2F1dGggKyBzZWxmLnJlLnNyY19ob3N0X3BvcnRfc3RyaWN0ICsgc2VsZi5yZS5zcmNfcGF0aCwgJ2knXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIGlmIChzZWxmLnJlLm5vX2h0dHAudGVzdCh0YWlsKSkge1xuICAgICAgICAvLyBzaG91bGQgbm90IGJlIGA6Ly9gLCB0aGF0IHByb3RlY3RzIGZyb20gZXJyb3JzIGluIHByb3RvY29sIG5hbWVcbiAgICAgICAgaWYgKHBvcyA+PSAzICYmIHRleHRbcG9zIC0gM10gPT09ICc6JykgeyByZXR1cm4gMDsgfVxuICAgICAgICByZXR1cm4gdGFpbC5tYXRjaChzZWxmLnJlLm5vX2h0dHApWzBdLmxlbmd0aDtcbiAgICAgIH1cbiAgICAgIHJldHVybiAwO1xuICAgIH1cbiAgfSxcbiAgJ21haWx0bzonOiB7XG4gICAgdmFsaWRhdGU6IGZ1bmN0aW9uICh0ZXh0LCBwb3MsIHNlbGYpIHtcbiAgICAgIHZhciB0YWlsID0gdGV4dC5zbGljZShwb3MpO1xuXG4gICAgICBpZiAoIXNlbGYucmUubWFpbHRvKSB7XG4gICAgICAgIHNlbGYucmUubWFpbHRvID0gIG5ldyBSZWdFeHAoXG4gICAgICAgICAgJ14nICsgc2VsZi5yZS5zcmNfZW1haWxfbmFtZSArICdAJyArIHNlbGYucmUuc3JjX2hvc3Rfc3RyaWN0LCAnaSdcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICAgIGlmIChzZWxmLnJlLm1haWx0by50ZXN0KHRhaWwpKSB7XG4gICAgICAgIHJldHVybiB0YWlsLm1hdGNoKHNlbGYucmUubWFpbHRvKVswXS5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH1cbn07XG5cbi8vIERPTidUIHRyeSB0byBtYWtlIFBScyB3aXRoIGNoYW5nZXMuIEV4dGVuZCBUTERzIHdpdGggTGlua2lmeUl0LnRsZHMoKSBpbnN0ZWFkXG52YXIgdGxkc19kZWZhdWx0ID0gJ2Jpenxjb218ZWR1fGdvdnxuZXR8b3JnfHByb3x3ZWJ8eHh4fGFlcm98YXNpYXxjb29wfGluZm98bXVzZXVtfG5hbWV8c2hvcHzRgNGEJy5zcGxpdCgnfCcpO1xuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5mdW5jdGlvbiByZXNldFNjYW5DYWNoZShzZWxmKSB7XG4gIHNlbGYuX19pbmRleF9fID0gLTE7XG4gIHNlbGYuX190ZXh0X2NhY2hlX18gICA9ICcnO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVWYWxpZGF0b3IocmUpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uICh0ZXh0LCBwb3MpIHtcbiAgICB2YXIgdGFpbCA9IHRleHQuc2xpY2UocG9zKTtcblxuICAgIGlmIChyZS50ZXN0KHRhaWwpKSB7XG4gICAgICByZXR1cm4gdGFpbC5tYXRjaChyZSlbMF0ubGVuZ3RoO1xuICAgIH1cbiAgICByZXR1cm4gMDtcbiAgfTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTm9ybWFsaXplcigpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChtYXRjaCwgc2VsZikge1xuICAgIHNlbGYubm9ybWFsaXplKG1hdGNoKTtcbiAgfTtcbn1cblxuLy8gU2NoZW1hcyBjb21waWxlci4gQnVpbGQgcmVnZXhwcy5cbi8vXG5mdW5jdGlvbiBjb21waWxlKHNlbGYpIHtcblxuICAvLyBMb2FkICYgY2xvbmUgUkUgcGF0dGVybnMuXG4gIHZhciByZSA9IHNlbGYucmUgPSBhc3NpZ24oe30sIHJlcXVpcmUoJy4vbGliL3JlJykpO1xuXG4gIC8vIERlZmluZSBkeW5hbWljIHBhdHRlcm5zXG4gIHZhciB0bGRzID0gc2VsZi5fX3RsZHNfXy5zbGljZSgpO1xuXG4gIGlmICghc2VsZi5fX3RsZHNfcmVwbGFjZWRfXykge1xuICAgIHRsZHMucHVzaCgnW2Etel17Mn0nKTtcbiAgfVxuICB0bGRzLnB1c2gocmUuc3JjX3huKTtcblxuICByZS5zcmNfdGxkcyA9IHRsZHMuam9pbignfCcpO1xuXG4gIGZ1bmN0aW9uIHVudHBsKHRwbCkgeyByZXR1cm4gdHBsLnJlcGxhY2UoJyVUTERTJScsIHJlLnNyY190bGRzKTsgfVxuXG4gIHJlLmVtYWlsX2Z1enp5ICAgICAgPSBSZWdFeHAodW50cGwocmUudHBsX2VtYWlsX2Z1enp5KSwgJ2knKTtcbiAgcmUubGlua19mdXp6eSAgICAgICA9IFJlZ0V4cCh1bnRwbChyZS50cGxfbGlua19mdXp6eSksICdpJyk7XG4gIHJlLmhvc3RfZnV6enlfdGVzdCAgPSBSZWdFeHAodW50cGwocmUudHBsX2hvc3RfZnV6enlfdGVzdCksICdpJyk7XG5cbiAgLy9cbiAgLy8gQ29tcGlsZSBlYWNoIHNjaGVtYVxuICAvL1xuXG4gIHZhciBhbGlhc2VzID0gW107XG5cbiAgc2VsZi5fX2NvbXBpbGVkX18gPSB7fTsgLy8gUmVzZXQgY29tcGlsZWQgZGF0YVxuXG4gIGZ1bmN0aW9uIHNjaGVtYUVycm9yKG5hbWUsIHZhbCkge1xuICAgIHRocm93IG5ldyBFcnJvcignKExpbmtpZnlJdCkgSW52YWxpZCBzY2hlbWEgXCInICsgbmFtZSArICdcIjogJyArIHZhbCk7XG4gIH1cblxuICBPYmplY3Qua2V5cyhzZWxmLl9fc2NoZW1hc19fKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIHZhbCA9IHNlbGYuX19zY2hlbWFzX19bbmFtZV07XG5cbiAgICAvLyBza2lwIGRpc2FibGVkIG1ldGhvZHNcbiAgICBpZiAodmFsID09PSBudWxsKSB7IHJldHVybjsgfVxuXG4gICAgdmFyIGNvbXBpbGVkID0geyB2YWxpZGF0ZTogbnVsbCwgbGluazogbnVsbCB9O1xuXG4gICAgc2VsZi5fX2NvbXBpbGVkX19bbmFtZV0gPSBjb21waWxlZDtcblxuICAgIGlmIChpc09iamVjdCh2YWwpKSB7XG4gICAgICBpZiAoaXNSZWdFeHAodmFsLnZhbGlkYXRlKSkge1xuICAgICAgICBjb21waWxlZC52YWxpZGF0ZSA9IGNyZWF0ZVZhbGlkYXRvcih2YWwudmFsaWRhdGUpO1xuICAgICAgfSBlbHNlIGlmIChpc0Z1bmN0aW9uKHZhbC52YWxpZGF0ZSkpIHtcbiAgICAgICAgY29tcGlsZWQudmFsaWRhdGUgPSB2YWwudmFsaWRhdGU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzY2hlbWFFcnJvcihuYW1lLCB2YWwpO1xuICAgICAgfVxuXG4gICAgICBpZiAoaXNGdW5jdGlvbih2YWwubm9ybWFsaXplKSkge1xuICAgICAgICBjb21waWxlZC5ub3JtYWxpemUgPSB2YWwubm9ybWFsaXplO1xuICAgICAgfSBlbHNlIGlmICghdmFsLm5vcm1hbGl6ZSkge1xuICAgICAgICBjb21waWxlZC5ub3JtYWxpemUgPSBjcmVhdGVOb3JtYWxpemVyKCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzY2hlbWFFcnJvcihuYW1lLCB2YWwpO1xuICAgICAgfVxuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGlzU3RyaW5nKHZhbCkpIHtcbiAgICAgIGFsaWFzZXMucHVzaChuYW1lKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzY2hlbWFFcnJvcihuYW1lLCB2YWwpO1xuICB9KTtcblxuICAvL1xuICAvLyBDb21waWxlIHBvc3Rwb25lZCBhbGlhc2VzXG4gIC8vXG5cbiAgYWxpYXNlcy5mb3JFYWNoKGZ1bmN0aW9uIChhbGlhcykge1xuICAgIGlmICghc2VsZi5fX2NvbXBpbGVkX19bc2VsZi5fX3NjaGVtYXNfX1thbGlhc11dKSB7XG4gICAgICAvLyBTaWxlbnRseSBmYWlsIG9uIG1pc3NlZCBzY2hlbWFzIHRvIGF2b2lkIGVycm9ucyBvbiBkaXNhYmxlLlxuICAgICAgLy8gc2NoZW1hRXJyb3IoYWxpYXMsIHNlbGYuX19zY2hlbWFzX19bYWxpYXNdKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBzZWxmLl9fY29tcGlsZWRfX1thbGlhc10udmFsaWRhdGUgPVxuICAgICAgc2VsZi5fX2NvbXBpbGVkX19bc2VsZi5fX3NjaGVtYXNfX1thbGlhc11dLnZhbGlkYXRlO1xuICAgIHNlbGYuX19jb21waWxlZF9fW2FsaWFzXS5ub3JtYWxpemUgPVxuICAgICAgc2VsZi5fX2NvbXBpbGVkX19bc2VsZi5fX3NjaGVtYXNfX1thbGlhc11dLm5vcm1hbGl6ZTtcbiAgfSk7XG5cbiAgLy9cbiAgLy8gRmFrZSByZWNvcmQgZm9yIGd1ZXNzZWQgbGlua3NcbiAgLy9cbiAgc2VsZi5fX2NvbXBpbGVkX19bJyddID0geyB2YWxpZGF0ZTogbnVsbCwgbm9ybWFsaXplOiBjcmVhdGVOb3JtYWxpemVyKCkgfTtcblxuICAvL1xuICAvLyBCdWlsZCBzY2hlbWEgY29uZGl0aW9uXG4gIC8vXG4gIHZhciBzbGlzdCA9IE9iamVjdC5rZXlzKHNlbGYuX19jb21waWxlZF9fKVxuICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgLy8gRmlsdGVyIGRpc2FibGVkICYgZmFrZSBzY2hlbWFzXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmFtZS5sZW5ndGggPiAwICYmIHNlbGYuX19jb21waWxlZF9fW25hbWVdO1xuICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgLm1hcChlc2NhcGVSRSlcbiAgICAgICAgICAgICAgICAgICAgICAuam9pbignfCcpO1xuICAvLyAoPyFfKSBjYXVzZSAxLjV4IHNsb3dkb3duXG4gIHNlbGYucmUuc2NoZW1hX3Rlc3QgICA9IFJlZ0V4cCgnKF58KD8hXykoPzo+fCcgKyByZS5zcmNfWlBDY0NmICsgJykpKCcgKyBzbGlzdCArICcpJywgJ2knKTtcbiAgc2VsZi5yZS5zY2hlbWFfc2VhcmNoID0gUmVnRXhwKCcoXnwoPyFfKSg/Oj58JyArIHJlLnNyY19aUENjQ2YgKyAnKSkoJyArIHNsaXN0ICsgJyknLCAnaWcnKTtcblxuICAvL1xuICAvLyBDbGVhbnVwXG4gIC8vXG5cbiAgcmVzZXRTY2FuQ2FjaGUoc2VsZik7XG59XG5cbi8qKlxuICogY2xhc3MgTWF0Y2hcbiAqXG4gKiBNYXRjaCByZXN1bHQuIFNpbmdsZSBlbGVtZW50IG9mIGFycmF5LCByZXR1cm5lZCBieSBbW0xpbmtpZnlJdCNtYXRjaF1dXG4gKiovXG5mdW5jdGlvbiBNYXRjaChzZWxmLCBzaGlmdCkge1xuICB2YXIgc3RhcnQgPSBzZWxmLl9faW5kZXhfXyxcbiAgICAgIGVuZCAgID0gc2VsZi5fX2xhc3RfaW5kZXhfXyxcbiAgICAgIHRleHQgID0gc2VsZi5fX3RleHRfY2FjaGVfXy5zbGljZShzdGFydCwgZW5kKTtcblxuICAvKipcbiAgICogTWF0Y2gjc2NoZW1hIC0+IFN0cmluZ1xuICAgKlxuICAgKiBQcmVmaXggKHByb3RvY29sKSBmb3IgbWF0Y2hlZCBzdHJpbmcuXG4gICAqKi9cbiAgdGhpcy5zY2hlbWEgICAgPSBzZWxmLl9fc2NoZW1hX18udG9Mb3dlckNhc2UoKTtcbiAgLyoqXG4gICAqIE1hdGNoI2luZGV4IC0+IE51bWJlclxuICAgKlxuICAgKiBGaXJzdCBwb3NpdGlvbiBvZiBtYXRjaGVkIHN0cmluZy5cbiAgICoqL1xuICB0aGlzLmluZGV4ICAgICA9IHN0YXJ0ICsgc2hpZnQ7XG4gIC8qKlxuICAgKiBNYXRjaCNsYXN0SW5kZXggLT4gTnVtYmVyXG4gICAqXG4gICAqIE5leHQgcG9zaXRpb24gYWZ0ZXIgbWF0Y2hlZCBzdHJpbmcuXG4gICAqKi9cbiAgdGhpcy5sYXN0SW5kZXggPSBlbmQgKyBzaGlmdDtcbiAgLyoqXG4gICAqIE1hdGNoI3JhdyAtPiBTdHJpbmdcbiAgICpcbiAgICogTWF0Y2hlZCBzdHJpbmcuXG4gICAqKi9cbiAgdGhpcy5yYXcgICAgICAgPSB0ZXh0O1xuICAvKipcbiAgICogTWF0Y2gjdGV4dCAtPiBTdHJpbmdcbiAgICpcbiAgICogTm90bWFsaXplZCB0ZXh0IG9mIG1hdGNoZWQgc3RyaW5nLlxuICAgKiovXG4gIHRoaXMudGV4dCAgICAgID0gdGV4dDtcbiAgLyoqXG4gICAqIE1hdGNoI3VybCAtPiBTdHJpbmdcbiAgICpcbiAgICogTm9ybWFsaXplZCB1cmwgb2YgbWF0Y2hlZCBzdHJpbmcuXG4gICAqKi9cbiAgdGhpcy51cmwgICAgICAgPSB0ZXh0O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNYXRjaChzZWxmLCBzaGlmdCkge1xuICB2YXIgbWF0Y2ggPSBuZXcgTWF0Y2goc2VsZiwgc2hpZnQpO1xuXG4gIHNlbGYuX19jb21waWxlZF9fW21hdGNoLnNjaGVtYV0ubm9ybWFsaXplKG1hdGNoLCBzZWxmKTtcblxuICByZXR1cm4gbWF0Y2g7XG59XG5cblxuLyoqXG4gKiBjbGFzcyBMaW5raWZ5SXRcbiAqKi9cblxuLyoqXG4gKiBuZXcgTGlua2lmeUl0KHNjaGVtYXMpXG4gKiAtIHNjaGVtYXMgKE9iamVjdCk6IE9wdGlvbmFsLiBBZGRpdGlvbmFsIHNjaGVtYXMgdG8gdmFsaWRhdGUgKHByZWZpeC92YWxpZGF0b3IpXG4gKlxuICogQ3JlYXRlcyBuZXcgbGlua2lmaWVyIGluc3RhbmNlIHdpdGggb3B0aW9uYWwgYWRkaXRpb25hbCBzY2hlbWFzLlxuICogQ2FuIGJlIGNhbGxlZCB3aXRob3V0IGBuZXdgIGtleXdvcmQgZm9yIGNvbnZlbmllbmNlLlxuICpcbiAqIEJ5IGRlZmF1bHQgdW5kZXJzdGFuZHM6XG4gKlxuICogLSBgaHR0cChzKTovLy4uLmAgLCBgZnRwOi8vLi4uYCwgYG1haWx0bzouLi5gICYgYC8vLi4uYCBsaW5rc1xuICogLSBcImZ1enp5XCIgbGlua3MgYW5kIGVtYWlscyAoZXhhbXBsZS5jb20sIGZvb0BiYXIuY29tKS5cbiAqXG4gKiBgc2NoZW1hc2AgaXMgYW4gb2JqZWN0LCB3aGVyZSBlYWNoIGtleS92YWx1ZSBkZXNjcmliZXMgcHJvdG9jb2wvcnVsZTpcbiAqXG4gKiAtIF9fa2V5X18gLSBsaW5rIHByZWZpeCAodXN1YWxseSwgcHJvdG9jb2wgbmFtZSB3aXRoIGA6YCBhdCB0aGUgZW5kLCBgc2t5cGU6YFxuICogICBmb3IgZXhhbXBsZSkuIGBsaW5raWZ5LWl0YCBtYWtlcyBzaHVyZSB0aGF0IHByZWZpeCBpcyBub3QgcHJlY2VlZGVkIHdpdGhcbiAqICAgYWxwaGFudW1lcmljIGNoYXIgYW5kIHN5bWJvbHMuIE9ubHkgd2hpdGVzcGFjZXMgYW5kIHB1bmN0dWF0aW9uIGFsbG93ZWQuXG4gKiAtIF9fdmFsdWVfXyAtIHJ1bGUgdG8gY2hlY2sgdGFpbCBhZnRlciBsaW5rIHByZWZpeFxuICogICAtIF9TdHJpbmdfIC0ganVzdCBhbGlhcyB0byBleGlzdGluZyBydWxlXG4gKiAgIC0gX09iamVjdF9cbiAqICAgICAtIF92YWxpZGF0ZV8gLSB2YWxpZGF0b3IgZnVuY3Rpb24gKHNob3VsZCByZXR1cm4gbWF0Y2hlZCBsZW5ndGggb24gc3VjY2VzcyksXG4gKiAgICAgICBvciBgUmVnRXhwYC5cbiAqICAgICAtIF9ub3JtYWxpemVfIC0gb3B0aW9uYWwgZnVuY3Rpb24gdG8gbm9ybWFsaXplIHRleHQgJiB1cmwgb2YgbWF0Y2hlZCByZXN1bHRcbiAqICAgICAgIChmb3IgZXhhbXBsZSwgZm9yIEB0d2l0dGVyIG1lbnRpb25zKS5cbiAqKi9cbmZ1bmN0aW9uIExpbmtpZnlJdChzY2hlbWFzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBMaW5raWZ5SXQpKSB7XG4gICAgcmV0dXJuIG5ldyBMaW5raWZ5SXQoc2NoZW1hcyk7XG4gIH1cblxuICAvLyBDYWNoZSBsYXN0IHRlc3RlZCByZXN1bHQuIFVzZWQgdG8gc2tpcCByZXBlYXRpbmcgc3RlcHMgb24gbmV4dCBgbWF0Y2hgIGNhbGwuXG4gIHRoaXMuX19pbmRleF9fICAgICAgICAgID0gLTE7XG4gIHRoaXMuX19sYXN0X2luZGV4X18gICAgID0gLTE7IC8vIE5leHQgc2NhbiBwb3NpdGlvblxuICB0aGlzLl9fc2NoZW1hX18gICAgICAgICA9ICcnO1xuICB0aGlzLl9fdGV4dF9jYWNoZV9fICAgICA9ICcnO1xuXG4gIHRoaXMuX19zY2hlbWFzX18gICAgICAgID0gYXNzaWduKHt9LCBkZWZhdWx0U2NoZW1hcywgc2NoZW1hcyk7XG4gIHRoaXMuX19jb21waWxlZF9fICAgICAgID0ge307XG5cbiAgdGhpcy5fX3RsZHNfXyAgICAgICAgICAgPSB0bGRzX2RlZmF1bHQ7XG4gIHRoaXMuX190bGRzX3JlcGxhY2VkX18gID0gZmFsc2U7XG5cbiAgdGhpcy5yZSA9IHt9O1xuXG4gIGNvbXBpbGUodGhpcyk7XG59XG5cblxuLyoqIGNoYWluYWJsZVxuICogTGlua2lmeUl0I2FkZChzY2hlbWEsIGRlZmluaXRpb24pXG4gKiAtIHNjaGVtYSAoU3RyaW5nKTogcnVsZSBuYW1lIChmaXhlZCBwYXR0ZXJuIHByZWZpeClcbiAqIC0gZGVmaW5pdGlvbiAoU3RyaW5nfFJlZ0V4cHxPYmplY3QpOiBzY2hlbWEgZGVmaW5pdGlvblxuICpcbiAqIEFkZCBuZXcgcnVsZSBkZWZpbml0aW9uLiBTZWUgY29uc3RydWN0b3IgZGVzY3JpcHRpb24gZm9yIGRldGFpbHMuXG4gKiovXG5MaW5raWZ5SXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIGFkZChzY2hlbWEsIGRlZmluaXRpb24pIHtcbiAgdGhpcy5fX3NjaGVtYXNfX1tzY2hlbWFdID0gZGVmaW5pdGlvbjtcbiAgY29tcGlsZSh0aGlzKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5cbi8qKlxuICogTGlua2lmeUl0I3Rlc3QodGV4dCkgLT4gQm9vbGVhblxuICpcbiAqIFNlYXJjaGVzIGxpbmtpZmlhYmxlIHBhdHRlcm4gYW5kIHJldHVybnMgYHRydWVgIG9uIHN1Y2Nlc3Mgb3IgYGZhbHNlYCBvbiBmYWlsLlxuICoqL1xuTGlua2lmeUl0LnByb3RvdHlwZS50ZXN0ID0gZnVuY3Rpb24gdGVzdCh0ZXh0KSB7XG4gIC8vIFJlc2V0IHNjYW4gY2FjaGVcbiAgdGhpcy5fX3RleHRfY2FjaGVfXyA9IHRleHQ7XG4gIHRoaXMuX19pbmRleF9fICAgICAgPSAtMTtcblxuICBpZiAoIXRleHQubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHZhciBtLCBtbCwgbWUsIGxlbiwgc2hpZnQsIG5leHQsIHJlLCB0bGRfcG9zLCBhdF9wb3M7XG5cbiAgLy8gdHJ5IHRvIHNjYW4gZm9yIGxpbmsgd2l0aCBzY2hlbWEgLSB0aGF0J3MgdGhlIG1vc3Qgc2ltcGxlIHJ1bGVcbiAgaWYgKHRoaXMucmUuc2NoZW1hX3Rlc3QudGVzdCh0ZXh0KSkge1xuICAgIHJlID0gdGhpcy5yZS5zY2hlbWFfc2VhcmNoO1xuICAgIHJlLmxhc3RJbmRleCA9IDA7XG4gICAgd2hpbGUgKChtID0gcmUuZXhlYyh0ZXh0KSkgIT09IG51bGwpIHtcbiAgICAgIGxlbiA9IHRoaXMudGVzdFNjaGVtYUF0KHRleHQsIG1bMl0sIHJlLmxhc3RJbmRleCk7XG4gICAgICBpZiAobGVuKSB7XG4gICAgICAgIHRoaXMuX19zY2hlbWFfXyAgICAgPSBtWzJdO1xuICAgICAgICB0aGlzLl9faW5kZXhfXyAgICAgID0gbS5pbmRleCArIG1bMV0ubGVuZ3RoO1xuICAgICAgICB0aGlzLl9fbGFzdF9pbmRleF9fID0gbS5pbmRleCArIG1bMF0ubGVuZ3RoICsgbGVuO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAodGhpcy5fX2NvbXBpbGVkX19bJ2h0dHA6J10pIHtcbiAgICAvLyBndWVzcyBzY2hlbWFsZXNzIGxpbmtzXG4gICAgdGxkX3BvcyA9IHRleHQuc2VhcmNoKHRoaXMucmUuaG9zdF9mdXp6eV90ZXN0KTtcbiAgICBpZiAodGxkX3BvcyA+PSAwKSB7XG4gICAgICAvLyBpZiB0bGQgaXMgbG9jYXRlZCBhZnRlciBmb3VuZCBsaW5rIC0gbm8gbmVlZCB0byBjaGVjayBmdXp6eSBwYXR0ZXJuXG4gICAgICBpZiAodGhpcy5fX2luZGV4X18gPCAwIHx8IHRsZF9wb3MgPCB0aGlzLl9faW5kZXhfXykge1xuICAgICAgICBpZiAoKG1sID0gdGV4dC5tYXRjaCh0aGlzLnJlLmxpbmtfZnV6enkpKSAhPT0gbnVsbCkge1xuXG4gICAgICAgICAgc2hpZnQgPSBtbC5pbmRleCArIG1sWzFdLmxlbmd0aDtcblxuICAgICAgICAgIGlmICh0aGlzLl9faW5kZXhfXyA8IDAgfHwgc2hpZnQgPCB0aGlzLl9faW5kZXhfXykge1xuICAgICAgICAgICAgdGhpcy5fX3NjaGVtYV9fICAgICA9ICcnO1xuICAgICAgICAgICAgdGhpcy5fX2luZGV4X18gICAgICA9IHNoaWZ0O1xuICAgICAgICAgICAgdGhpcy5fX2xhc3RfaW5kZXhfXyA9IG1sLmluZGV4ICsgbWxbMF0ubGVuZ3RoO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmICh0aGlzLl9fY29tcGlsZWRfX1snbWFpbHRvOiddKSB7XG4gICAgLy8gZ3Vlc3Mgc2NoZW1hbGVzcyBlbWFpbHNcbiAgICBhdF9wb3MgPSB0ZXh0LmluZGV4T2YoJ0AnKTtcbiAgICBpZiAoYXRfcG9zID49IDApIHtcbiAgICAgIC8vIFdlIGNhbid0IHNraXAgdGhpcyBjaGVjaywgYmVjYXVzZSB0aGlzIGNhc2VzIGFyZSBwb3NzaWJsZTpcbiAgICAgIC8vIDE5Mi4xNjguMS4xQGdtYWlsLmNvbSwgbXkuaW5AZXhhbXBsZS5jb21cbiAgICAgIGlmICgobWUgPSB0ZXh0Lm1hdGNoKHRoaXMucmUuZW1haWxfZnV6enkpKSAhPT0gbnVsbCkge1xuXG4gICAgICAgIHNoaWZ0ID0gbWUuaW5kZXggKyBtZVsxXS5sZW5ndGg7XG4gICAgICAgIG5leHQgID0gbWUuaW5kZXggKyBtZVswXS5sZW5ndGg7XG5cbiAgICAgICAgaWYgKHRoaXMuX19pbmRleF9fIDwgMCB8fCBzaGlmdCA8IHRoaXMuX19pbmRleF9fIHx8XG4gICAgICAgICAgICAoc2hpZnQgPT09IHRoaXMuX19pbmRleF9fICYmIG5leHQgPiB0aGlzLl9fbGFzdF9pbmRleF9fKSkge1xuICAgICAgICAgIHRoaXMuX19zY2hlbWFfXyAgICAgPSAnbWFpbHRvOic7XG4gICAgICAgICAgdGhpcy5fX2luZGV4X18gICAgICA9IHNoaWZ0O1xuICAgICAgICAgIHRoaXMuX19sYXN0X2luZGV4X18gPSBuZXh0O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHRoaXMuX19pbmRleF9fID49IDA7XG59O1xuXG5cbi8qKlxuICogTGlua2lmeUl0I3Rlc3RTY2hlbWFBdCh0ZXh0LCBuYW1lLCBwb3NpdGlvbikgLT4gTnVtYmVyXG4gKiAtIHRleHQgKFN0cmluZyk6IHRleHQgdG8gc2NhblxuICogLSBuYW1lIChTdHJpbmcpOiBydWxlIChzY2hlbWEpIG5hbWVcbiAqIC0gcG9zaXRpb24gKE51bWJlcik6IHRleHQgb2Zmc2V0IHRvIGNoZWNrIGZyb21cbiAqXG4gKiBTaW1pbGFyIHRvIFtbTGlua2lmeUl0I3Rlc3RdXSBidXQgY2hlY2tzIG9ubHkgc3BlY2lmaWMgcHJvdG9jb2wgdGFpbCBleGFjdGx5XG4gKiBhdCBnaXZlbiBwb3NpdGlvbi4gUmV0dXJucyBsZW5ndGggb2YgZm91bmQgcGF0dGVybiAoMCBvbiBmYWlsKS5cbiAqKi9cbkxpbmtpZnlJdC5wcm90b3R5cGUudGVzdFNjaGVtYUF0ID0gZnVuY3Rpb24gdGVzdFNjaGVtYUF0KHRleHQsIHNjaGVtYSwgcG9zKSB7XG4gIC8vIElmIG5vdCBzdXBwb3J0ZWQgc2NoZW1hIGNoZWNrIHJlcXVlc3RlZCAtIHRlcm1pbmF0ZVxuICBpZiAoIXRoaXMuX19jb21waWxlZF9fW3NjaGVtYS50b0xvd2VyQ2FzZSgpXSkge1xuICAgIHJldHVybiAwO1xuICB9XG4gIHJldHVybiB0aGlzLl9fY29tcGlsZWRfX1tzY2hlbWEudG9Mb3dlckNhc2UoKV0udmFsaWRhdGUodGV4dCwgcG9zLCB0aGlzKTtcbn07XG5cblxuLyoqXG4gKiBMaW5raWZ5SXQjbWF0Y2godGV4dCkgLT4gQXJyYXl8bnVsbFxuICpcbiAqIFJldHVybnMgYXJyYXkgb2YgZm91bmQgbGluayBkZXNjcmlwdGlvbnMgb3IgYG51bGxgIG9uIGZhaWwuIFdlIHN0cm9uZ2x5XG4gKiB0byB1c2UgW1tMaW5raWZ5SXQjdGVzdF1dIGZpcnN0LCBmb3IgYmVzdCBzcGVlZC5cbiAqXG4gKiAjIyMjIyBSZXN1bHQgbWF0Y2ggZGVzY3JpcHRpb25cbiAqXG4gKiAtIF9fc2NoZW1hX18gLSBsaW5rIHNjaGVtYSwgY2FuIGJlIGVtcHR5IGZvciBmdXp6eSBsaW5rcywgb3IgYC8vYCBmb3JcbiAqICAgcHJvdG9jb2wtbmV1dHJhbCAgbGlua3MuXG4gKiAtIF9faW5kZXhfXyAtIG9mZnNldCBvZiBtYXRjaGVkIHRleHRcbiAqIC0gX19sYXN0SW5kZXhfXyAtIGluZGV4IG9mIG5leHQgY2hhciBhZnRlciBtYXRoY2ggZW5kXG4gKiAtIF9fcmF3X18gLSBtYXRjaGVkIHRleHRcbiAqIC0gX190ZXh0X18gLSBub3JtYWxpemVkIHRleHRcbiAqIC0gX191cmxfXyAtIGxpbmssIGdlbmVyYXRlZCBmcm9tIG1hdGNoZWQgdGV4dFxuICoqL1xuTGlua2lmeUl0LnByb3RvdHlwZS5tYXRjaCA9IGZ1bmN0aW9uIG1hdGNoKHRleHQpIHtcbiAgdmFyIHNoaWZ0ID0gMCwgcmVzdWx0ID0gW107XG5cbiAgLy8gVHJ5IHRvIHRha2UgcHJldmlvdXMgZWxlbWVudCBmcm9tIGNhY2hlLCBpZiAudGVzdCgpIGNhbGxlZCBiZWZvcmVcbiAgaWYgKHRoaXMuX19pbmRleF9fID49IDAgJiYgdGhpcy5fX3RleHRfY2FjaGVfXyA9PT0gdGV4dCkge1xuICAgIHJlc3VsdC5wdXNoKGNyZWF0ZU1hdGNoKHRoaXMsIHNoaWZ0KSk7XG4gICAgc2hpZnQgPSB0aGlzLl9fbGFzdF9pbmRleF9fO1xuICB9XG5cbiAgLy8gQ3V0IGhlYWQgaWYgY2FjaGUgd2FzIHVzZWRcbiAgdmFyIHRhaWwgPSBzaGlmdCA/IHRleHQuc2xpY2Uoc2hpZnQpIDogdGV4dDtcblxuICAvLyBTY2FuIHN0cmluZyB1bnRpbCBlbmQgcmVhY2hlZFxuICB3aGlsZSAodGhpcy50ZXN0KHRhaWwpKSB7XG4gICAgcmVzdWx0LnB1c2goY3JlYXRlTWF0Y2godGhpcywgc2hpZnQpKTtcblxuICAgIHRhaWwgPSB0YWlsLnNsaWNlKHRoaXMuX19sYXN0X2luZGV4X18pO1xuICAgIHNoaWZ0ICs9IHRoaXMuX19sYXN0X2luZGV4X187XG4gIH1cblxuICBpZiAocmVzdWx0Lmxlbmd0aCkge1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn07XG5cblxuLyoqIGNoYWluYWJsZVxuICogTGlua2lmeUl0I3RsZHMobGlzdCBbLCBrZWVwT2xkXSkgLT4gdGhpc1xuICogLSBsaXN0IChBcnJheSk6IGxpc3Qgb2YgdGxkc1xuICogLSBrZWVwT2xkIChCb29sZWFuKTogbWVyZ2Ugd2l0aCBjdXJyZW50IGxpc3QgaWYgYHRydWVgIChgZmFsc2VgIGJ5IGRlZmF1bHQpXG4gKlxuICogTG9hZCAob3IgbWVyZ2UpIG5ldyB0bGRzIGxpc3QuIFRob3NlIGFyZSB1c2VyIGZvciBmdXp6eSBsaW5rcyAod2l0aG91dCBwcmVmaXgpXG4gKiB0byBhdm9pZCBmYWxzZSBwb3NpdGl2ZXMuIEJ5IGRlZmF1bHQgdGhpcyBhbGdvcnl0aG0gdXNlZDpcbiAqXG4gKiAtIGhvc3RuYW1lIHdpdGggYW55IDItbGV0dGVyIHJvb3Qgem9uZXMgYXJlIG9rLlxuICogLSBiaXp8Y29tfGVkdXxnb3Z8bmV0fG9yZ3xwcm98d2VifHh4eHxhZXJvfGFzaWF8Y29vcHxpbmZvfG11c2V1bXxuYW1lfHNob3B80YDRhFxuICogICBhcmUgb2suXG4gKiAtIGVuY29kZWQgKGB4bi0tLi4uYCkgcm9vdCB6b25lcyBhcmUgb2suXG4gKlxuICogSWYgbGlzdCBpcyByZXBsYWNlZCwgdGhlbiBleGFjdCBtYXRjaCBmb3IgMi1jaGFycyByb290IHpvbmVzIHdpbGwgYmUgY2hlY2tlZC5cbiAqKi9cbkxpbmtpZnlJdC5wcm90b3R5cGUudGxkcyA9IGZ1bmN0aW9uIHRsZHMobGlzdCwga2VlcE9sZCkge1xuICBsaXN0ID0gQXJyYXkuaXNBcnJheShsaXN0KSA/IGxpc3QgOiBbIGxpc3QgXTtcblxuICBpZiAoIWtlZXBPbGQpIHtcbiAgICB0aGlzLl9fdGxkc19fID0gbGlzdC5zbGljZSgpO1xuICAgIHRoaXMuX190bGRzX3JlcGxhY2VkX18gPSB0cnVlO1xuICAgIGNvbXBpbGUodGhpcyk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICB0aGlzLl9fdGxkc19fID0gdGhpcy5fX3RsZHNfXy5jb25jYXQobGlzdClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAuc29ydCgpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihmdW5jdGlvbihlbCwgaWR4LCBhcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBlbCAhPT0gYXJyW2lkeCAtIDFdO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnJldmVyc2UoKTtcblxuICBjb21waWxlKHRoaXMpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogTGlua2lmeUl0I25vcm1hbGl6ZShtYXRjaClcbiAqXG4gKiBEZWZhdWx0IG5vcm1hbGl6ZXIgKGlmIHNjaGVtYSBkb2VzIG5vdCBkZWZpbmUgaXQncyBvd24pLlxuICoqL1xuTGlua2lmeUl0LnByb3RvdHlwZS5ub3JtYWxpemUgPSBmdW5jdGlvbiBub3JtYWxpemUobWF0Y2gpIHtcblxuICAvLyBEbyBtaW5pbWFsIHBvc3NpYmxlIGNoYW5nZXMgYnkgZGVmYXVsdC4gTmVlZCB0byBjb2xsZWN0IGZlZWRiYWNrIHByaW9yXG4gIC8vIHRvIG1vdmUgZm9yd2FyZCBodHRwczovL2dpdGh1Yi5jb20vbWFya2Rvd24taXQvbGlua2lmeS1pdC9pc3N1ZXMvMVxuXG4gIGlmICghbWF0Y2guc2NoZW1hKSB7IG1hdGNoLnVybCA9ICdodHRwOi8vJyArIG1hdGNoLnVybDsgfVxuXG4gIGlmIChtYXRjaC5zY2hlbWEgPT09ICdtYWlsdG86JyAmJiAhL15tYWlsdG86L2kudGVzdChtYXRjaC51cmwpKSB7XG4gICAgbWF0Y2gudXJsID0gJ21haWx0bzonICsgbWF0Y2gudXJsO1xuICB9XG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0gTGlua2lmeUl0O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG4vLyBVc2UgZGlyZWN0IGV4dHJhY3QgaW5zdGVhZCBvZiBgcmVnZW5lcmF0ZWAgdG8gcmVkdXNlIGJyb3dzZXJpZmllZCBzaXplXG52YXIgc3JjX0FueSA9IGV4cG9ydHMuc3JjX0FueSA9IHJlcXVpcmUoJ3VjLm1pY3JvL3Byb3BlcnRpZXMvQW55L3JlZ2V4Jykuc291cmNlO1xudmFyIHNyY19DYyAgPSBleHBvcnRzLnNyY19DYyA9IHJlcXVpcmUoJ3VjLm1pY3JvL2NhdGVnb3JpZXMvQ2MvcmVnZXgnKS5zb3VyY2U7XG52YXIgc3JjX0NmICA9IGV4cG9ydHMuc3JjX0NmID0gcmVxdWlyZSgndWMubWljcm8vY2F0ZWdvcmllcy9DZi9yZWdleCcpLnNvdXJjZTtcbnZhciBzcmNfWiAgID0gZXhwb3J0cy5zcmNfWiAgPSByZXF1aXJlKCd1Yy5taWNyby9jYXRlZ29yaWVzL1ovcmVnZXgnKS5zb3VyY2U7XG52YXIgc3JjX1AgICA9IGV4cG9ydHMuc3JjX1AgID0gcmVxdWlyZSgndWMubWljcm8vY2F0ZWdvcmllcy9QL3JlZ2V4Jykuc291cmNlO1xuXG4vLyBcXHB7XFxaXFxQXFxDY1xcQ0Z9ICh3aGl0ZSBzcGFjZXMgKyBjb250cm9sICsgZm9ybWF0ICsgcHVuY3R1YXRpb24pXG52YXIgc3JjX1pQQ2NDZiA9IGV4cG9ydHMuc3JjX1pQQ2NDZiA9IFsgc3JjX1osIHNyY19QLCBzcmNfQ2MsIHNyY19DZiBdLmpvaW4oJ3wnKTtcblxuLy8gQWxsIHBvc3NpYmxlIHdvcmQgY2hhcmFjdGVycyAoZXZlcnl0aGluZyB3aXRob3V0IHB1bmN0dWF0aW9uLCBzcGFjZXMgJiBjb250cm9scylcbi8vIERlZmluZWQgdmlhIHB1bmN0dWF0aW9uICYgc3BhY2VzIHRvIHNhdmUgc3BhY2Vcbi8vIFNob3VsZCBiZSBzb21ldGhpbmcgbGlrZSBcXHB7XFxMXFxOXFxTXFxNfSAoXFx3IGJ1dCB3aXRob3V0IGBfYClcbnZhciBzcmNfcHNldWRvX2xldHRlciAgICAgICA9ICcoPzooPyEnICsgc3JjX1pQQ2NDZiArICcpJyArIHNyY19BbnkgKyAnKSc7XG4vLyBUaGUgc2FtZSBhcyBhYm90aGUgYnV0IHdpdGhvdXQgWzAtOV1cbnZhciBzcmNfcHNldWRvX2xldHRlcl9ub25fZCA9ICcoPzooPyFbMC05XXwnICsgc3JjX1pQQ2NDZiArICcpJyArIHNyY19BbnkgKyAnKSc7XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbnZhciBzcmNfaXA0ID0gZXhwb3J0cy5zcmNfaXA0ID1cblxuICAnKD86KDI1WzAtNV18MlswLTRdWzAtOV18WzAxXT9bMC05XVswLTldPylcXFxcLil7M30oMjVbMC01XXwyWzAtNF1bMC05XXxbMDFdP1swLTldWzAtOV0/KSc7XG5cbmV4cG9ydHMuc3JjX2F1dGggICAgPSAnKD86KD86KD8hJyArIHNyY19aICsgJykuKStAKT8nO1xuXG52YXIgc3JjX3BvcnQgPSBleHBvcnRzLnNyY19wb3J0ID1cblxuICAnKD86Oig/OjYoPzpbMC00XVxcXFxkezN9fDUoPzpbMC00XVxcXFxkezJ9fDUoPzpbMC0yXVxcXFxkfDNbMC01XSkpKXxbMS01XT9cXFxcZHsxLDR9KSk/JztcblxudmFyIHNyY19ob3N0X3Rlcm1pbmF0b3IgPSBleHBvcnRzLnNyY19ob3N0X3Rlcm1pbmF0b3IgPVxuXG4gICcoPz0kfCcgKyBzcmNfWlBDY0NmICsgJykoPyEtfF98OlxcXFxkfFxcXFwuLXxcXFxcLig/ISR8JyArIHNyY19aUENjQ2YgKyAnKSknO1xuXG52YXIgc3JjX3BhdGggPSBleHBvcnRzLnNyY19wYXRoID1cblxuICAnKD86JyArXG4gICAgJ1svPyNdJyArXG4gICAgICAnKD86JyArXG4gICAgICAgICcoPyEnICsgc3JjX1ogKyAnfFsoKVtcXFxcXXt9LixcIlxcJz8hXFxcXC1dKS58JyArXG4gICAgICAgICdcXFxcWyg/Oig/IScgKyBzcmNfWiArICd8XFxcXF0pLikqXFxcXF18JyArXG4gICAgICAgICdcXFxcKCg/Oig/IScgKyBzcmNfWiArICd8WyldKS4pKlxcXFwpfCcgK1xuICAgICAgICAnXFxcXHsoPzooPyEnICsgc3JjX1ogKyAnfFt9XSkuKSpcXFxcfXwnICtcbiAgICAgICAgJ1xcXFxcIig/Oig/IScgKyBzcmNfWiArICd8W1wiXSkuKStcXFxcXCJ8JyArXG4gICAgICAgIFwiXFxcXCcoPzooPyFcIiArIHNyY19aICsgXCJ8WyddKS4pK1xcXFwnfFwiICtcbiAgICAgICAgXCJcXFxcJyg/PVwiICsgc3JjX3BzZXVkb19sZXR0ZXIgKyAnKS58JyArICAvLyBhbGxvdyBgSSdtX2tpbmdgIGlmIG5vIHBhaXIgZm91bmRcbiAgICAgICAgJ1xcXFwuKD8hJyArIHNyY19aICsgJ3xbLl0pLnwnICtcbiAgICAgICAgJ1xcXFwtKD8hJyArIHNyY19aICsgJ3wtLSg/OlteLV18JCkpKD86Wy1dK3wuKXwnICsgIC8vIGAtLS1gID0+IGxvbmcgZGFzaCwgdGVybWluYXRlXG4gICAgICAgICdcXFxcLCg/IScgKyBzcmNfWiArICcpLnwnICsgICAgICAvLyBhbGxvdyBgLCwsYCBpbiBwYXRoc1xuICAgICAgICAnXFxcXCEoPyEnICsgc3JjX1ogKyAnfFshXSkufCcgK1xuICAgICAgICAnXFxcXD8oPyEnICsgc3JjX1ogKyAnfFs/XSkuJyArXG4gICAgICAnKSsnICtcbiAgICAnfFxcXFwvJyArXG4gICcpPyc7XG5cbnZhciBzcmNfZW1haWxfbmFtZSA9IGV4cG9ydHMuc3JjX2VtYWlsX25hbWUgPVxuXG4gICdbXFxcXC07OiY9XFxcXCtcXFxcJCxcXFxcXCJcXFxcLmEtekEtWjAtOV9dKyc7XG5cbnZhciBzcmNfeG4gPSBleHBvcnRzLnNyY194biA9XG5cbiAgJ3huLS1bYS16MC05XFxcXC1dezEsNTl9JztcblxuLy8gTW9yZSB0byByZWFkIGFib3V0IGRvbWFpbiBuYW1lc1xuLy8gaHR0cDovL3NlcnZlcmZhdWx0LmNvbS9xdWVzdGlvbnMvNjM4MjYwL1xuXG52YXIgc3JjX2RvbWFpbl9yb290ID0gZXhwb3J0cy5zcmNfZG9tYWluX3Jvb3QgPVxuXG4gIC8vIENhbid0IGhhdmUgZGlnaXRzIGFuZCBkYXNoZXNcbiAgJyg/OicgK1xuICAgIHNyY194biArXG4gICAgJ3wnICtcbiAgICBzcmNfcHNldWRvX2xldHRlcl9ub25fZCArICd7MSw2M30nICtcbiAgJyknO1xuXG52YXIgc3JjX2RvbWFpbiA9IGV4cG9ydHMuc3JjX2RvbWFpbiA9XG5cbiAgJyg/OicgK1xuICAgIHNyY194biArXG4gICAgJ3wnICtcbiAgICAnKD86JyArIHNyY19wc2V1ZG9fbGV0dGVyICsgJyknICtcbiAgICAnfCcgK1xuICAgIC8vIGRvbid0IGFsbG93IGAtLWAgaW4gZG9tYWluIG5hbWVzLCBiZWNhdXNlOlxuICAgIC8vIC0gdGhhdCBjYW4gY29uZmxpY3Qgd2l0aCBtYXJrZG93biAmbWRhc2g7IC8gJm5kYXNoO1xuICAgIC8vIC0gbm9ib2R5IHVzZSB0aG9zZSBhbnl3YXlcbiAgICAnKD86JyArIHNyY19wc2V1ZG9fbGV0dGVyICsgJyg/Oi0oPyEtKXwnICsgc3JjX3BzZXVkb19sZXR0ZXIgKyAnKXswLDYxfScgKyBzcmNfcHNldWRvX2xldHRlciArICcpJyArXG4gICcpJztcblxudmFyIHNyY19ob3N0ID0gZXhwb3J0cy5zcmNfaG9zdCA9XG5cbiAgJyg/OicgK1xuICAgIHNyY19pcDQgK1xuICAnfCcgK1xuICAgICcoPzooPzooPzonICsgc3JjX2RvbWFpbiArICcpXFxcXC4pKicgKyBzcmNfZG9tYWluX3Jvb3QgKyAnKScgK1xuICAnKSc7XG5cbnZhciB0cGxfaG9zdF9mdXp6eSA9IGV4cG9ydHMudHBsX2hvc3RfZnV6enkgPVxuXG4gICcoPzonICtcbiAgICBzcmNfaXA0ICtcbiAgJ3wnICtcbiAgICAnKD86KD86KD86JyArIHNyY19kb21haW4gKyAnKVxcXFwuKSsoPzolVExEUyUpKScgK1xuICAnKSc7XG5cbmV4cG9ydHMuc3JjX2hvc3Rfc3RyaWN0ID1cblxuICBzcmNfaG9zdCArIHNyY19ob3N0X3Rlcm1pbmF0b3I7XG5cbnZhciB0cGxfaG9zdF9mdXp6eV9zdHJpY3QgPSBleHBvcnRzLnRwbF9ob3N0X2Z1enp5X3N0cmljdCA9XG5cbiAgdHBsX2hvc3RfZnV6enkgKyBzcmNfaG9zdF90ZXJtaW5hdG9yO1xuXG5leHBvcnRzLnNyY19ob3N0X3BvcnRfc3RyaWN0ID1cblxuICBzcmNfaG9zdCArIHNyY19wb3J0ICsgc3JjX2hvc3RfdGVybWluYXRvcjtcblxudmFyIHRwbF9ob3N0X3BvcnRfZnV6enlfc3RyaWN0ID0gZXhwb3J0cy50cGxfaG9zdF9wb3J0X2Z1enp5X3N0cmljdCA9XG5cbiAgdHBsX2hvc3RfZnV6enkgKyBzcmNfcG9ydCArIHNyY19ob3N0X3Rlcm1pbmF0b3I7XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBNYWluIHJ1bGVzXG5cbi8vIFJ1ZGUgdGVzdCBmdXp6eSBsaW5rcyBieSBob3N0LCBmb3IgcXVpY2sgZGVueVxuZXhwb3J0cy50cGxfaG9zdF9mdXp6eV90ZXN0ID1cblxuICAnbG9jYWxob3N0fFxcXFwuXFxcXGR7MSwzfVxcXFwufCg/OlxcXFwuKD86JVRMRFMlKSg/OicgKyBzcmNfWlBDY0NmICsgJ3wkKSknO1xuXG5leHBvcnRzLnRwbF9lbWFpbF9mdXp6eSA9XG5cbiAgICAnKF58PnwnICsgc3JjX1ogKyAnKSgnICsgc3JjX2VtYWlsX25hbWUgKyAnQCcgKyB0cGxfaG9zdF9mdXp6eV9zdHJpY3QgKyAnKSc7XG5cbmV4cG9ydHMudHBsX2xpbmtfZnV6enkgPVxuICAgIC8vIEZ1enp5IGxpbmsgY2FuJ3QgYmUgcHJlcGVuZGVkIHdpdGggLjovXFwtIGFuZCBub24gcHVuY3R1YXRpb24uXG4gICAgLy8gYnV0IGNhbiBzdGFydCB3aXRoID4gKG1hcmtkb3duIGJsb2NrcXVvdGUpXG4gICAgJyhefCg/IVsuOi9cXFxcLV9AXSkoPzpbJCs8PT5eYHxdfCcgKyBzcmNfWlBDY0NmICsgJykpJyArXG4gICAgJygoPyFbJCs8PT5eYHxdKScgKyB0cGxfaG9zdF9wb3J0X2Z1enp5X3N0cmljdCArIHNyY19wYXRoICsgJyknO1xuIiwibW9kdWxlLmV4cG9ydHM9L1tcXDAtXFx4MUZcXHg3Ri1cXHg5Rl0vIiwibW9kdWxlLmV4cG9ydHM9L1tcXHhBRFxcdTA2MDAtXFx1MDYwNVxcdTA2MUNcXHUwNkREXFx1MDcwRlxcdTE4MEVcXHUyMDBCLVxcdTIwMEZcXHUyMDJBLVxcdTIwMkVcXHUyMDYwLVxcdTIwNjRcXHUyMDY2LVxcdTIwNkZcXHVGRUZGXFx1RkZGOS1cXHVGRkZCXXxcXHVEODA0XFx1RENCRHxcXHVEODJGW1xcdURDQTAtXFx1RENBM118XFx1RDgzNFtcXHVERDczLVxcdUREN0FdfFxcdURCNDBbXFx1REMwMVxcdURDMjAtXFx1REM3Rl0vIiwibW9kdWxlLmV4cG9ydHM9L1shLSMlLVxcKiwtLzo7XFw/QFxcWy1cXF1fXFx7XFx9XFx4QTFcXHhBN1xceEFCXFx4QjZcXHhCN1xceEJCXFx4QkZcXHUwMzdFXFx1MDM4N1xcdTA1NUEtXFx1MDU1RlxcdTA1ODlcXHUwNThBXFx1MDVCRVxcdTA1QzBcXHUwNUMzXFx1MDVDNlxcdTA1RjNcXHUwNUY0XFx1MDYwOVxcdTA2MEFcXHUwNjBDXFx1MDYwRFxcdTA2MUJcXHUwNjFFXFx1MDYxRlxcdTA2NkEtXFx1MDY2RFxcdTA2RDRcXHUwNzAwLVxcdTA3MERcXHUwN0Y3LVxcdTA3RjlcXHUwODMwLVxcdTA4M0VcXHUwODVFXFx1MDk2NFxcdTA5NjVcXHUwOTcwXFx1MEFGMFxcdTBERjRcXHUwRTRGXFx1MEU1QVxcdTBFNUJcXHUwRjA0LVxcdTBGMTJcXHUwRjE0XFx1MEYzQS1cXHUwRjNEXFx1MEY4NVxcdTBGRDAtXFx1MEZENFxcdTBGRDlcXHUwRkRBXFx1MTA0QS1cXHUxMDRGXFx1MTBGQlxcdTEzNjAtXFx1MTM2OFxcdTE0MDBcXHUxNjZEXFx1MTY2RVxcdTE2OUJcXHUxNjlDXFx1MTZFQi1cXHUxNkVEXFx1MTczNVxcdTE3MzZcXHUxN0Q0LVxcdTE3RDZcXHUxN0Q4LVxcdTE3REFcXHUxODAwLVxcdTE4MEFcXHUxOTQ0XFx1MTk0NVxcdTFBMUVcXHUxQTFGXFx1MUFBMC1cXHUxQUE2XFx1MUFBOC1cXHUxQUFEXFx1MUI1QS1cXHUxQjYwXFx1MUJGQy1cXHUxQkZGXFx1MUMzQi1cXHUxQzNGXFx1MUM3RVxcdTFDN0ZcXHUxQ0MwLVxcdTFDQzdcXHUxQ0QzXFx1MjAxMC1cXHUyMDI3XFx1MjAzMC1cXHUyMDQzXFx1MjA0NS1cXHUyMDUxXFx1MjA1My1cXHUyMDVFXFx1MjA3RFxcdTIwN0VcXHUyMDhEXFx1MjA4RVxcdTIzMDgtXFx1MjMwQlxcdTIzMjlcXHUyMzJBXFx1Mjc2OC1cXHUyNzc1XFx1MjdDNVxcdTI3QzZcXHUyN0U2LVxcdTI3RUZcXHUyOTgzLVxcdTI5OThcXHUyOUQ4LVxcdTI5REJcXHUyOUZDXFx1MjlGRFxcdTJDRjktXFx1MkNGQ1xcdTJDRkVcXHUyQ0ZGXFx1MkQ3MFxcdTJFMDAtXFx1MkUyRVxcdTJFMzAtXFx1MkU0MlxcdTMwMDEtXFx1MzAwM1xcdTMwMDgtXFx1MzAxMVxcdTMwMTQtXFx1MzAxRlxcdTMwMzBcXHUzMDNEXFx1MzBBMFxcdTMwRkJcXHVBNEZFXFx1QTRGRlxcdUE2MEQtXFx1QTYwRlxcdUE2NzNcXHVBNjdFXFx1QTZGMi1cXHVBNkY3XFx1QTg3NC1cXHVBODc3XFx1QThDRVxcdUE4Q0ZcXHVBOEY4LVxcdUE4RkFcXHVBOTJFXFx1QTkyRlxcdUE5NUZcXHVBOUMxLVxcdUE5Q0RcXHVBOURFXFx1QTlERlxcdUFBNUMtXFx1QUE1RlxcdUFBREVcXHVBQURGXFx1QUFGMFxcdUFBRjFcXHVBQkVCXFx1RkQzRVxcdUZEM0ZcXHVGRTEwLVxcdUZFMTlcXHVGRTMwLVxcdUZFNTJcXHVGRTU0LVxcdUZFNjFcXHVGRTYzXFx1RkU2OFxcdUZFNkFcXHVGRTZCXFx1RkYwMS1cXHVGRjAzXFx1RkYwNS1cXHVGRjBBXFx1RkYwQy1cXHVGRjBGXFx1RkYxQVxcdUZGMUJcXHVGRjFGXFx1RkYyMFxcdUZGM0ItXFx1RkYzRFxcdUZGM0ZcXHVGRjVCXFx1RkY1RFxcdUZGNUYtXFx1RkY2NV18XFx1RDgwMFtcXHVERDAwLVxcdUREMDJcXHVERjlGXFx1REZEMF18XFx1RDgwMVxcdURENkZ8XFx1RDgwMltcXHVEQzU3XFx1REQxRlxcdUREM0ZcXHVERTUwLVxcdURFNThcXHVERTdGXFx1REVGMC1cXHVERUY2XFx1REYzOS1cXHVERjNGXFx1REY5OS1cXHVERjlDXXxcXHVEODA0W1xcdURDNDctXFx1REM0RFxcdURDQkJcXHVEQ0JDXFx1RENCRS1cXHVEQ0MxXFx1REQ0MC1cXHVERDQzXFx1REQ3NFxcdURENzVcXHVEREM1LVxcdUREQzhcXHVERENEXFx1REUzOC1cXHVERTNEXXxcXHVEODA1W1xcdURDQzZcXHVEREMxLVxcdUREQzlcXHVERTQxLVxcdURFNDNdfFxcdUQ4MDlbXFx1REM3MC1cXHVEQzc0XXxcXHVEODFBW1xcdURFNkVcXHVERTZGXFx1REVGNVxcdURGMzctXFx1REYzQlxcdURGNDRdfFxcdUQ4MkZcXHVEQzlGLyIsIm1vZHVsZS5leHBvcnRzPS9bIFxceEEwXFx1MTY4MFxcdTIwMDAtXFx1MjAwQVxcdTIwMjhcXHUyMDI5XFx1MjAyRlxcdTIwNUZcXHUzMDAwXS8iLCJtb2R1bGUuZXhwb3J0cz0vW1xcMC1cXHVEN0ZGXFx1REMwMC1cXHVGRkZGXXxbXFx1RDgwMC1cXHVEQkZGXVtcXHVEQzAwLVxcdURGRkZdfFtcXHVEODAwLVxcdURCRkZdLyIsIid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vbGliLycpO1xuIiwiLy8gSFRNTDUgZW50aXRpZXMgbWFwOiB7IG5hbWUgLT4gdXRmMTZzdHJpbmcgfVxuLy9cbid1c2Ugc3RyaWN0JztcblxuLyplc2xpbnQgcXVvdGVzOjAqL1xubW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCdlbnRpdGllcy9tYXBzL2VudGl0aWVzLmpzb24nKTtcbiIsIi8vIExpc3Qgb2YgdmFsaWQgaHRtbCBibG9ja3MgbmFtZXMsIGFjY29ydGluZyB0byBjb21tb25tYXJrIHNwZWNcbi8vIGh0dHA6Ly9qZ20uZ2l0aHViLmlvL0NvbW1vbk1hcmsvc3BlYy5odG1sI2h0bWwtYmxvY2tzXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFtcbiAgJ2FkZHJlc3MnLFxuICAnYXJ0aWNsZScsXG4gICdhc2lkZScsXG4gICdiYXNlJyxcbiAgJ2Jhc2Vmb250JyxcbiAgJ2Jsb2NrcXVvdGUnLFxuICAnYm9keScsXG4gICdjYXB0aW9uJyxcbiAgJ2NlbnRlcicsXG4gICdjb2wnLFxuICAnY29sZ3JvdXAnLFxuICAnZGQnLFxuICAnZGV0YWlscycsXG4gICdkaWFsb2cnLFxuICAnZGlyJyxcbiAgJ2RpdicsXG4gICdkbCcsXG4gICdkdCcsXG4gICdmaWVsZHNldCcsXG4gICdmaWdjYXB0aW9uJyxcbiAgJ2ZpZ3VyZScsXG4gICdmb290ZXInLFxuICAnZm9ybScsXG4gICdmcmFtZScsXG4gICdmcmFtZXNldCcsXG4gICdoMScsXG4gICdoZWFkJyxcbiAgJ2hlYWRlcicsXG4gICdocicsXG4gICdodG1sJyxcbiAgJ2xlZ2VuZCcsXG4gICdsaScsXG4gICdsaW5rJyxcbiAgJ21haW4nLFxuICAnbWVudScsXG4gICdtZW51aXRlbScsXG4gICdtZXRhJyxcbiAgJ25hdicsXG4gICdub2ZyYW1lcycsXG4gICdvbCcsXG4gICdvcHRncm91cCcsXG4gICdvcHRpb24nLFxuICAncCcsXG4gICdwYXJhbScsXG4gICdwcmUnLFxuICAnc2VjdGlvbicsXG4gICdzb3VyY2UnLFxuICAndGl0bGUnLFxuICAnc3VtbWFyeScsXG4gICd0YWJsZScsXG4gICd0Ym9keScsXG4gICd0ZCcsXG4gICd0Zm9vdCcsXG4gICd0aCcsXG4gICd0aGVhZCcsXG4gICd0aXRsZScsXG4gICd0cicsXG4gICd0cmFjaycsXG4gICd1bCdcbl07XG4iLCIvLyBSZWdleHBzIHRvIG1hdGNoIGh0bWwgZWxlbWVudHNcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgYXR0cl9uYW1lICAgICA9ICdbYS16QS1aXzpdW2EtekEtWjAtOTouXy1dKic7XG5cbnZhciB1bnF1b3RlZCAgICAgID0gJ1teXCJcXCc9PD5gXFxcXHgwMC1cXFxceDIwXSsnO1xudmFyIHNpbmdsZV9xdW90ZWQgPSBcIidbXiddKidcIjtcbnZhciBkb3VibGVfcXVvdGVkID0gJ1wiW15cIl0qXCInO1xuXG52YXIgYXR0cl92YWx1ZSAgPSAnKD86JyArIHVucXVvdGVkICsgJ3wnICsgc2luZ2xlX3F1b3RlZCArICd8JyArIGRvdWJsZV9xdW90ZWQgKyAnKSc7XG5cbnZhciBhdHRyaWJ1dGUgICA9ICcoPzpcXFxccysnICsgYXR0cl9uYW1lICsgJyg/OlxcXFxzKj1cXFxccyonICsgYXR0cl92YWx1ZSArICcpPyknO1xuXG52YXIgb3Blbl90YWcgICAgPSAnPFtBLVphLXpdW0EtWmEtejAtOVxcXFwtXSonICsgYXR0cmlidXRlICsgJypcXFxccypcXFxcLz8+JztcblxudmFyIGNsb3NlX3RhZyAgID0gJzxcXFxcL1tBLVphLXpdW0EtWmEtejAtOVxcXFwtXSpcXFxccyo+JztcbnZhciBjb21tZW50ICAgICA9ICc8IS0tLS0+fDwhLS0oPzotP1tePi1dKSg/Oi0/W14tXSkqLS0+JztcbnZhciBwcm9jZXNzaW5nICA9ICc8Wz9dLio/Wz9dPic7XG52YXIgZGVjbGFyYXRpb24gPSAnPCFbQS1aXStcXFxccytbXj5dKj4nO1xudmFyIGNkYXRhICAgICAgID0gJzwhXFxcXFtDREFUQVxcXFxbW1xcXFxzXFxcXFNdKj9cXFxcXVxcXFxdPic7XG5cbnZhciBIVE1MX1RBR19SRSA9IG5ldyBSZWdFeHAoJ14oPzonICsgb3Blbl90YWcgKyAnfCcgKyBjbG9zZV90YWcgKyAnfCcgKyBjb21tZW50ICtcbiAgICAgICAgICAgICAgICAgICAgICAgICd8JyArIHByb2Nlc3NpbmcgKyAnfCcgKyBkZWNsYXJhdGlvbiArICd8JyArIGNkYXRhICsgJyknKTtcbnZhciBIVE1MX09QRU5fQ0xPU0VfVEFHX1JFID0gbmV3IFJlZ0V4cCgnXig/OicgKyBvcGVuX3RhZyArICd8JyArIGNsb3NlX3RhZyArICcpJyk7XG5cbm1vZHVsZS5leHBvcnRzLkhUTUxfVEFHX1JFID0gSFRNTF9UQUdfUkU7XG5tb2R1bGUuZXhwb3J0cy5IVE1MX09QRU5fQ0xPU0VfVEFHX1JFID0gSFRNTF9PUEVOX0NMT1NFX1RBR19SRTtcbiIsIi8vIExpc3Qgb2YgdmFsaWQgdXJsIHNjaGVtYXMsIGFjY29ydGluZyB0byBjb21tb25tYXJrIHNwZWNcbi8vIGh0dHA6Ly9qZ20uZ2l0aHViLmlvL0NvbW1vbk1hcmsvc3BlYy5odG1sI2F1dG9saW5rc1xuXG4ndXNlIHN0cmljdCc7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBbXG4gICdjb2FwJyxcbiAgJ2RvaScsXG4gICdqYXZhc2NyaXB0JyxcbiAgJ2FhYScsXG4gICdhYWFzJyxcbiAgJ2Fib3V0JyxcbiAgJ2FjYXAnLFxuICAnY2FwJyxcbiAgJ2NpZCcsXG4gICdjcmlkJyxcbiAgJ2RhdGEnLFxuICAnZGF2JyxcbiAgJ2RpY3QnLFxuICAnZG5zJyxcbiAgJ2ZpbGUnLFxuICAnZnRwJyxcbiAgJ2dlbycsXG4gICdnbycsXG4gICdnb3BoZXInLFxuICAnaDMyMycsXG4gICdodHRwJyxcbiAgJ2h0dHBzJyxcbiAgJ2lheCcsXG4gICdpY2FwJyxcbiAgJ2ltJyxcbiAgJ2ltYXAnLFxuICAnaW5mbycsXG4gICdpcHAnLFxuICAnaXJpcycsXG4gICdpcmlzLmJlZXAnLFxuICAnaXJpcy54cGMnLFxuICAnaXJpcy54cGNzJyxcbiAgJ2lyaXMubHd6JyxcbiAgJ2xkYXAnLFxuICAnbWFpbHRvJyxcbiAgJ21pZCcsXG4gICdtc3JwJyxcbiAgJ21zcnBzJyxcbiAgJ210cXAnLFxuICAnbXVwZGF0ZScsXG4gICduZXdzJyxcbiAgJ25mcycsXG4gICduaScsXG4gICduaWgnLFxuICAnbm50cCcsXG4gICdvcGFxdWVsb2NrdG9rZW4nLFxuICAncG9wJyxcbiAgJ3ByZXMnLFxuICAncnRzcCcsXG4gICdzZXJ2aWNlJyxcbiAgJ3Nlc3Npb24nLFxuICAnc2h0dHAnLFxuICAnc2lldmUnLFxuICAnc2lwJyxcbiAgJ3NpcHMnLFxuICAnc21zJyxcbiAgJ3NubXAnLFxuICAnc29hcC5iZWVwJyxcbiAgJ3NvYXAuYmVlcHMnLFxuICAndGFnJyxcbiAgJ3RlbCcsXG4gICd0ZWxuZXQnLFxuICAndGZ0cCcsXG4gICd0aGlzbWVzc2FnZScsXG4gICd0bjMyNzAnLFxuICAndGlwJyxcbiAgJ3R2JyxcbiAgJ3VybicsXG4gICd2ZW1taScsXG4gICd3cycsXG4gICd3c3MnLFxuICAneGNvbicsXG4gICd4Y29uLXVzZXJpZCcsXG4gICd4bWxycGMuYmVlcCcsXG4gICd4bWxycGMuYmVlcHMnLFxuICAneG1wcCcsXG4gICd6MzkuNTByJyxcbiAgJ3ozOS41MHMnLFxuICAnYWRpdW14dHJhJyxcbiAgJ2FmcCcsXG4gICdhZnMnLFxuICAnYWltJyxcbiAgJ2FwdCcsXG4gICdhdHRhY2htZW50JyxcbiAgJ2F3JyxcbiAgJ2Jlc2hhcmUnLFxuICAnYml0Y29pbicsXG4gICdib2xvJyxcbiAgJ2NhbGx0bycsXG4gICdjaHJvbWUnLFxuICAnY2hyb21lLWV4dGVuc2lvbicsXG4gICdjb20tZXZlbnRicml0ZS1hdHRlbmRlZScsXG4gICdjb250ZW50JyxcbiAgJ2N2cycsXG4gICdkbG5hLXBsYXlzaW5nbGUnLFxuICAnZGxuYS1wbGF5Y29udGFpbmVyJyxcbiAgJ2R0bicsXG4gICdkdmInLFxuICAnZWQyaycsXG4gICdmYWNldGltZScsXG4gICdmZWVkJyxcbiAgJ2ZpbmdlcicsXG4gICdmaXNoJyxcbiAgJ2dnJyxcbiAgJ2dpdCcsXG4gICdnaXptb3Byb2plY3QnLFxuICAnZ3RhbGsnLFxuICAnaGNwJyxcbiAgJ2ljb24nLFxuICAnaXBuJyxcbiAgJ2lyYycsXG4gICdpcmM2JyxcbiAgJ2lyY3MnLFxuICAnaXRtcycsXG4gICdqYXInLFxuICAnam1zJyxcbiAgJ2tleXBhcmMnLFxuICAnbGFzdGZtJyxcbiAgJ2xkYXBzJyxcbiAgJ21hZ25ldCcsXG4gICdtYXBzJyxcbiAgJ21hcmtldCcsXG4gICdtZXNzYWdlJyxcbiAgJ21tcycsXG4gICdtcy1oZWxwJyxcbiAgJ21zbmltJyxcbiAgJ211bWJsZScsXG4gICdtdm4nLFxuICAnbm90ZXMnLFxuICAnb2lkJyxcbiAgJ3BhbG0nLFxuICAncGFwYXJhenppJyxcbiAgJ3BsYXRmb3JtJyxcbiAgJ3Byb3h5JyxcbiAgJ3BzeWMnLFxuICAncXVlcnknLFxuICAncmVzJyxcbiAgJ3Jlc291cmNlJyxcbiAgJ3JtaScsXG4gICdyc3luYycsXG4gICdydG1wJyxcbiAgJ3NlY29uZGxpZmUnLFxuICAnc2Z0cCcsXG4gICdzZ24nLFxuICAnc2t5cGUnLFxuICAnc21iJyxcbiAgJ3NvbGRhdCcsXG4gICdzcG90aWZ5JyxcbiAgJ3NzaCcsXG4gICdzdGVhbScsXG4gICdzdm4nLFxuICAndGVhbXNwZWFrJyxcbiAgJ3RoaW5ncycsXG4gICd1ZHAnLFxuICAndW5yZWFsJyxcbiAgJ3V0MjAwNCcsXG4gICd2ZW50cmlsbycsXG4gICd2aWV3LXNvdXJjZScsXG4gICd3ZWJjYWwnLFxuICAnd3RhaScsXG4gICd3eWNpd3lnJyxcbiAgJ3hmaXJlJyxcbiAgJ3hyaScsXG4gICd5bXNncidcbl07XG4iLCIvLyBVdGlsaXRpZXNcbi8vXG4ndXNlIHN0cmljdCc7XG5cblxuZnVuY3Rpb24gX2NsYXNzKG9iaikgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7IH1cblxuZnVuY3Rpb24gaXNTdHJpbmcob2JqKSB7IHJldHVybiBfY2xhc3Mob2JqKSA9PT0gJ1tvYmplY3QgU3RyaW5nXSc7IH1cblxudmFyIF9oYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHk7XG5cbmZ1bmN0aW9uIGhhcyhvYmplY3QsIGtleSkge1xuICByZXR1cm4gX2hhc093blByb3BlcnR5LmNhbGwob2JqZWN0LCBrZXkpO1xufVxuXG4vLyBNZXJnZSBvYmplY3RzXG4vL1xuZnVuY3Rpb24gYXNzaWduKG9iaiAvKmZyb20xLCBmcm9tMiwgZnJvbTMsIC4uLiovKSB7XG4gIHZhciBzb3VyY2VzID0gQXJyYXkucHJvdG90eXBlLnNsaWNlLmNhbGwoYXJndW1lbnRzLCAxKTtcblxuICBzb3VyY2VzLmZvckVhY2goZnVuY3Rpb24gKHNvdXJjZSkge1xuICAgIGlmICghc291cmNlKSB7IHJldHVybjsgfVxuXG4gICAgaWYgKHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnKSB7XG4gICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKHNvdXJjZSArICdtdXN0IGJlIG9iamVjdCcpO1xuICAgIH1cblxuICAgIE9iamVjdC5rZXlzKHNvdXJjZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBvYmpba2V5XSA9IHNvdXJjZVtrZXldO1xuICAgIH0pO1xuICB9KTtcblxuICByZXR1cm4gb2JqO1xufVxuXG4vLyBSZW1vdmUgZWxlbWVudCBmcm9tIGFycmF5IGFuZCBwdXQgYW5vdGhlciBhcnJheSBhdCB0aG9zZSBwb3NpdGlvbi5cbi8vIFVzZWZ1bCBmb3Igc29tZSBvcGVyYXRpb25zIHdpdGggdG9rZW5zXG5mdW5jdGlvbiBhcnJheVJlcGxhY2VBdChzcmMsIHBvcywgbmV3RWxlbWVudHMpIHtcbiAgcmV0dXJuIFtdLmNvbmNhdChzcmMuc2xpY2UoMCwgcG9zKSwgbmV3RWxlbWVudHMsIHNyYy5zbGljZShwb3MgKyAxKSk7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmZ1bmN0aW9uIGlzVmFsaWRFbnRpdHlDb2RlKGMpIHtcbiAgLyplc2xpbnQgbm8tYml0d2lzZTowKi9cbiAgLy8gYnJva2VuIHNlcXVlbmNlXG4gIGlmIChjID49IDB4RDgwMCAmJiBjIDw9IDB4REZGRikgeyByZXR1cm4gZmFsc2U7IH1cbiAgLy8gbmV2ZXIgdXNlZFxuICBpZiAoYyA+PSAweEZERDAgJiYgYyA8PSAweEZERUYpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIGlmICgoYyAmIDB4RkZGRikgPT09IDB4RkZGRiB8fCAoYyAmIDB4RkZGRikgPT09IDB4RkZGRSkgeyByZXR1cm4gZmFsc2U7IH1cbiAgLy8gY29udHJvbCBjb2Rlc1xuICBpZiAoYyA+PSAweDAwICYmIGMgPD0gMHgwOCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgaWYgKGMgPT09IDB4MEIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIGlmIChjID49IDB4MEUgJiYgYyA8PSAweDFGKSB7IHJldHVybiBmYWxzZTsgfVxuICBpZiAoYyA+PSAweDdGICYmIGMgPD0gMHg5RikgeyByZXR1cm4gZmFsc2U7IH1cbiAgLy8gb3V0IG9mIHJhbmdlXG4gIGlmIChjID4gMHgxMEZGRkYpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHJldHVybiB0cnVlO1xufVxuXG5mdW5jdGlvbiBmcm9tQ29kZVBvaW50KGMpIHtcbiAgLyplc2xpbnQgbm8tYml0d2lzZTowKi9cbiAgaWYgKGMgPiAweGZmZmYpIHtcbiAgICBjIC09IDB4MTAwMDA7XG4gICAgdmFyIHN1cnJvZ2F0ZTEgPSAweGQ4MDAgKyAoYyA+PiAxMCksXG4gICAgICAgIHN1cnJvZ2F0ZTIgPSAweGRjMDAgKyAoYyAmIDB4M2ZmKTtcblxuICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKHN1cnJvZ2F0ZTEsIHN1cnJvZ2F0ZTIpO1xuICB9XG4gIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGMpO1xufVxuXG5cbnZhciBVTkVTQ0FQRV9NRF9SRSAgPSAvXFxcXChbIVwiIyQlJicoKSorLFxcLS5cXC86Ozw9Pj9AW1xcXFxcXF1eX2B7fH1+XSkvZztcbnZhciBFTlRJVFlfUkUgICAgICAgPSAvJihbYS16I11bYS16MC05XXsxLDMxfSk7L2dpO1xudmFyIFVORVNDQVBFX0FMTF9SRSA9IG5ldyBSZWdFeHAoVU5FU0NBUEVfTURfUkUuc291cmNlICsgJ3wnICsgRU5USVRZX1JFLnNvdXJjZSwgJ2dpJyk7XG5cbnZhciBESUdJVEFMX0VOVElUWV9URVNUX1JFID0gL14jKCg/OnhbYS1mMC05XXsxLDh9fFswLTldezEsOH0pKS9pO1xuXG52YXIgZW50aXRpZXMgPSByZXF1aXJlKCcuL2VudGl0aWVzJyk7XG5cbmZ1bmN0aW9uIHJlcGxhY2VFbnRpdHlQYXR0ZXJuKG1hdGNoLCBuYW1lKSB7XG4gIHZhciBjb2RlID0gMDtcblxuICBpZiAoaGFzKGVudGl0aWVzLCBuYW1lKSkge1xuICAgIHJldHVybiBlbnRpdGllc1tuYW1lXTtcbiAgfVxuXG4gIGlmIChuYW1lLmNoYXJDb2RlQXQoMCkgPT09IDB4MjMvKiAjICovICYmIERJR0lUQUxfRU5USVRZX1RFU1RfUkUudGVzdChuYW1lKSkge1xuICAgIGNvZGUgPSBuYW1lWzFdLnRvTG93ZXJDYXNlKCkgPT09ICd4JyA/XG4gICAgICBwYXJzZUludChuYW1lLnNsaWNlKDIpLCAxNilcbiAgICA6XG4gICAgICBwYXJzZUludChuYW1lLnNsaWNlKDEpLCAxMCk7XG4gICAgaWYgKGlzVmFsaWRFbnRpdHlDb2RlKGNvZGUpKSB7XG4gICAgICByZXR1cm4gZnJvbUNvZGVQb2ludChjb2RlKTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gbWF0Y2g7XG59XG5cbi8qZnVuY3Rpb24gcmVwbGFjZUVudGl0aWVzKHN0cikge1xuICBpZiAoc3RyLmluZGV4T2YoJyYnKSA8IDApIHsgcmV0dXJuIHN0cjsgfVxuXG4gIHJldHVybiBzdHIucmVwbGFjZShFTlRJVFlfUkUsIHJlcGxhY2VFbnRpdHlQYXR0ZXJuKTtcbn0qL1xuXG5mdW5jdGlvbiB1bmVzY2FwZU1kKHN0cikge1xuICBpZiAoc3RyLmluZGV4T2YoJ1xcXFwnKSA8IDApIHsgcmV0dXJuIHN0cjsgfVxuICByZXR1cm4gc3RyLnJlcGxhY2UoVU5FU0NBUEVfTURfUkUsICckMScpO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZUFsbChzdHIpIHtcbiAgaWYgKHN0ci5pbmRleE9mKCdcXFxcJykgPCAwICYmIHN0ci5pbmRleE9mKCcmJykgPCAwKSB7IHJldHVybiBzdHI7IH1cblxuICByZXR1cm4gc3RyLnJlcGxhY2UoVU5FU0NBUEVfQUxMX1JFLCBmdW5jdGlvbihtYXRjaCwgZXNjYXBlZCwgZW50aXR5KSB7XG4gICAgaWYgKGVzY2FwZWQpIHsgcmV0dXJuIGVzY2FwZWQ7IH1cbiAgICByZXR1cm4gcmVwbGFjZUVudGl0eVBhdHRlcm4obWF0Y2gsIGVudGl0eSk7XG4gIH0pO1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG52YXIgSFRNTF9FU0NBUEVfVEVTVF9SRSA9IC9bJjw+XCJdLztcbnZhciBIVE1MX0VTQ0FQRV9SRVBMQUNFX1JFID0gL1smPD5cIl0vZztcbnZhciBIVE1MX1JFUExBQ0VNRU5UUyA9IHtcbiAgJyYnOiAnJmFtcDsnLFxuICAnPCc6ICcmbHQ7JyxcbiAgJz4nOiAnJmd0OycsXG4gICdcIic6ICcmcXVvdDsnXG59O1xuXG5mdW5jdGlvbiByZXBsYWNlVW5zYWZlQ2hhcihjaCkge1xuICByZXR1cm4gSFRNTF9SRVBMQUNFTUVOVFNbY2hdO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVIdG1sKHN0cikge1xuICBpZiAoSFRNTF9FU0NBUEVfVEVTVF9SRS50ZXN0KHN0cikpIHtcbiAgICByZXR1cm4gc3RyLnJlcGxhY2UoSFRNTF9FU0NBUEVfUkVQTEFDRV9SRSwgcmVwbGFjZVVuc2FmZUNoYXIpO1xuICB9XG4gIHJldHVybiBzdHI7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbnZhciBSRUdFWFBfRVNDQVBFX1JFID0gL1suPyorXiRbXFxdXFxcXCgpe318LV0vZztcblxuZnVuY3Rpb24gZXNjYXBlUkUgKHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoUkVHRVhQX0VTQ0FQRV9SRSwgJ1xcXFwkJicpO1xufVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG4vLyBacyAodW5pY29kZSBjbGFzcykgfHwgW1xcdFxcZlxcdlxcclxcbl1cbmZ1bmN0aW9uIGlzV2hpdGVTcGFjZShjb2RlKSB7XG4gIGlmIChjb2RlID49IDB4MjAwMCAmJiBjb2RlIDw9IDB4MjAwQSkgeyByZXR1cm4gdHJ1ZTsgfVxuICBzd2l0Y2ggKGNvZGUpIHtcbiAgICBjYXNlIDB4MDk6IC8vIFxcdFxuICAgIGNhc2UgMHgwQTogLy8gXFxuXG4gICAgY2FzZSAweDBCOiAvLyBcXHZcbiAgICBjYXNlIDB4MEM6IC8vIFxcZlxuICAgIGNhc2UgMHgwRDogLy8gXFxyXG4gICAgY2FzZSAweDIwOlxuICAgIGNhc2UgMHhBMDpcbiAgICBjYXNlIDB4MTY4MDpcbiAgICBjYXNlIDB4MjAyRjpcbiAgICBjYXNlIDB4MjA1RjpcbiAgICBjYXNlIDB4MzAwMDpcbiAgICAgIHJldHVybiB0cnVlO1xuICB9XG4gIHJldHVybiBmYWxzZTtcbn1cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxuLyplc2xpbnQtZGlzYWJsZSBtYXgtbGVuKi9cbnZhciBVTklDT0RFX1BVTkNUX1JFID0gcmVxdWlyZSgndWMubWljcm8vY2F0ZWdvcmllcy9QL3JlZ2V4Jyk7XG5cbi8vIEN1cnJlbnRseSB3aXRob3V0IGFzdHJhbCBjaGFyYWN0ZXJzIHN1cHBvcnQuXG5mdW5jdGlvbiBpc1B1bmN0Q2hhcihjaGFyKSB7XG4gIHJldHVybiBVTklDT0RFX1BVTkNUX1JFLnRlc3QoY2hhcik7XG59XG5cblxuLy8gTWFya2Rvd24gQVNDSUkgcHVuY3R1YXRpb24gY2hhcmFjdGVycy5cbi8vXG4vLyAhLCBcIiwgIywgJCwgJSwgJiwgJywgKCwgKSwgKiwgKywgLCwgLSwgLiwgLywgOiwgOywgPCwgPSwgPiwgPywgQCwgWywgXFwsIF0sIF4sIF8sIGAsIHssIHwsIH0sIG9yIH5cbi8vIGh0dHA6Ly9zcGVjLmNvbW1vbm1hcmsub3JnLzAuMTUvI2FzY2lpLXB1bmN0dWF0aW9uLWNoYXJhY3RlclxuLy9cbi8vIERvbid0IGNvbmZ1c2Ugd2l0aCB1bmljb2RlIHB1bmN0dWF0aW9uICEhISBJdCBsYWNrcyBzb21lIGNoYXJzIGluIGFzY2lpIHJhbmdlLlxuLy9cbmZ1bmN0aW9uIGlzTWRBc2NpaVB1bmN0KGNoKSB7XG4gIHN3aXRjaCAoY2gpIHtcbiAgICBjYXNlIDB4MjEvKiAhICovOlxuICAgIGNhc2UgMHgyMi8qIFwiICovOlxuICAgIGNhc2UgMHgyMy8qICMgKi86XG4gICAgY2FzZSAweDI0LyogJCAqLzpcbiAgICBjYXNlIDB4MjUvKiAlICovOlxuICAgIGNhc2UgMHgyNi8qICYgKi86XG4gICAgY2FzZSAweDI3LyogJyAqLzpcbiAgICBjYXNlIDB4MjgvKiAoICovOlxuICAgIGNhc2UgMHgyOS8qICkgKi86XG4gICAgY2FzZSAweDJBLyogKiAqLzpcbiAgICBjYXNlIDB4MkIvKiArICovOlxuICAgIGNhc2UgMHgyQy8qICwgKi86XG4gICAgY2FzZSAweDJELyogLSAqLzpcbiAgICBjYXNlIDB4MkUvKiAuICovOlxuICAgIGNhc2UgMHgyRi8qIC8gKi86XG4gICAgY2FzZSAweDNBLyogOiAqLzpcbiAgICBjYXNlIDB4M0IvKiA7ICovOlxuICAgIGNhc2UgMHgzQy8qIDwgKi86XG4gICAgY2FzZSAweDNELyogPSAqLzpcbiAgICBjYXNlIDB4M0UvKiA+ICovOlxuICAgIGNhc2UgMHgzRi8qID8gKi86XG4gICAgY2FzZSAweDQwLyogQCAqLzpcbiAgICBjYXNlIDB4NUIvKiBbICovOlxuICAgIGNhc2UgMHg1Qy8qIFxcICovOlxuICAgIGNhc2UgMHg1RC8qIF0gKi86XG4gICAgY2FzZSAweDVFLyogXiAqLzpcbiAgICBjYXNlIDB4NUYvKiBfICovOlxuICAgIGNhc2UgMHg2MC8qIGAgKi86XG4gICAgY2FzZSAweDdCLyogeyAqLzpcbiAgICBjYXNlIDB4N0MvKiB8ICovOlxuICAgIGNhc2UgMHg3RC8qIH0gKi86XG4gICAgY2FzZSAweDdFLyogfiAqLzpcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn1cblxuLy8gSGVwbGVyIHRvIHVuaWZ5IFtyZWZlcmVuY2UgbGFiZWxzXS5cbi8vXG5mdW5jdGlvbiBub3JtYWxpemVSZWZlcmVuY2Uoc3RyKSB7XG4gIC8vIHVzZSAudG9VcHBlckNhc2UoKSBpbnN0ZWFkIG9mIC50b0xvd2VyQ2FzZSgpXG4gIC8vIGhlcmUgdG8gYXZvaWQgYSBjb25mbGljdCB3aXRoIE9iamVjdC5wcm90b3R5cGVcbiAgLy8gbWVtYmVycyAobW9zdCBub3RhYmx5LCBgX19wcm90b19fYClcbiAgcmV0dXJuIHN0ci50cmltKCkucmVwbGFjZSgvXFxzKy9nLCAnICcpLnRvVXBwZXJDYXNlKCk7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbi8vIFJlLWV4cG9ydCBsaWJyYXJpZXMgY29tbW9ubHkgdXNlZCBpbiBib3RoIG1hcmtkb3duLWl0IGFuZCBpdHMgcGx1Z2lucyxcbi8vIHNvIHBsdWdpbnMgd29uJ3QgaGF2ZSB0byBkZXBlbmQgb24gdGhlbSBleHBsaWNpdGx5LCB3aGljaCByZWR1Y2VzIHRoZWlyXG4vLyBidW5kbGVkIHNpemUgKGUuZy4gYSBicm93c2VyIGJ1aWxkKS5cbi8vXG5leHBvcnRzLmxpYiAgICAgICAgICAgICAgICAgPSB7fTtcbmV4cG9ydHMubGliLm1kdXJsICAgICAgICAgICA9IHJlcXVpcmUoJ21kdXJsJyk7XG5leHBvcnRzLmxpYi51Y21pY3JvICAgICAgICAgPSByZXF1aXJlKCd1Yy5taWNybycpO1xuXG5leHBvcnRzLmFzc2lnbiAgICAgICAgICAgICAgPSBhc3NpZ247XG5leHBvcnRzLmlzU3RyaW5nICAgICAgICAgICAgPSBpc1N0cmluZztcbmV4cG9ydHMuaGFzICAgICAgICAgICAgICAgICA9IGhhcztcbmV4cG9ydHMudW5lc2NhcGVNZCAgICAgICAgICA9IHVuZXNjYXBlTWQ7XG5leHBvcnRzLnVuZXNjYXBlQWxsICAgICAgICAgPSB1bmVzY2FwZUFsbDtcbmV4cG9ydHMuaXNWYWxpZEVudGl0eUNvZGUgICA9IGlzVmFsaWRFbnRpdHlDb2RlO1xuZXhwb3J0cy5mcm9tQ29kZVBvaW50ICAgICAgID0gZnJvbUNvZGVQb2ludDtcbi8vIGV4cG9ydHMucmVwbGFjZUVudGl0aWVzICAgICA9IHJlcGxhY2VFbnRpdGllcztcbmV4cG9ydHMuZXNjYXBlSHRtbCAgICAgICAgICA9IGVzY2FwZUh0bWw7XG5leHBvcnRzLmFycmF5UmVwbGFjZUF0ICAgICAgPSBhcnJheVJlcGxhY2VBdDtcbmV4cG9ydHMuaXNXaGl0ZVNwYWNlICAgICAgICA9IGlzV2hpdGVTcGFjZTtcbmV4cG9ydHMuaXNNZEFzY2lpUHVuY3QgICAgICA9IGlzTWRBc2NpaVB1bmN0O1xuZXhwb3J0cy5pc1B1bmN0Q2hhciAgICAgICAgID0gaXNQdW5jdENoYXI7XG5leHBvcnRzLmVzY2FwZVJFICAgICAgICAgICAgPSBlc2NhcGVSRTtcbmV4cG9ydHMubm9ybWFsaXplUmVmZXJlbmNlICA9IG5vcm1hbGl6ZVJlZmVyZW5jZTtcbiIsIi8vIEp1c3QgYSBzaG9ydGN1dCBmb3IgYnVsayBleHBvcnRcbid1c2Ugc3RyaWN0JztcblxuXG5leHBvcnRzLnBhcnNlTGlua0xhYmVsICAgICAgID0gcmVxdWlyZSgnLi9wYXJzZV9saW5rX2xhYmVsJyk7XG5leHBvcnRzLnBhcnNlTGlua0Rlc3RpbmF0aW9uID0gcmVxdWlyZSgnLi9wYXJzZV9saW5rX2Rlc3RpbmF0aW9uJyk7XG5leHBvcnRzLnBhcnNlTGlua1RpdGxlICAgICAgID0gcmVxdWlyZSgnLi9wYXJzZV9saW5rX3RpdGxlJyk7XG4iLCIvLyBQYXJzZSBsaW5rIGRlc3RpbmF0aW9uXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciB1bmVzY2FwZUFsbCAgID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykudW5lc2NhcGVBbGw7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJzZUxpbmtEZXN0aW5hdGlvbihzdHIsIHBvcywgbWF4KSB7XG4gIHZhciBjb2RlLCBsZXZlbCxcbiAgICAgIGxpbmVzID0gMCxcbiAgICAgIHN0YXJ0ID0gcG9zLFxuICAgICAgcmVzdWx0ID0ge1xuICAgICAgICBvazogZmFsc2UsXG4gICAgICAgIHBvczogMCxcbiAgICAgICAgbGluZXM6IDAsXG4gICAgICAgIHN0cjogJydcbiAgICAgIH07XG5cbiAgaWYgKHN0ci5jaGFyQ29kZUF0KHBvcykgPT09IDB4M0MgLyogPCAqLykge1xuICAgIHBvcysrO1xuICAgIHdoaWxlIChwb3MgPCBtYXgpIHtcbiAgICAgIGNvZGUgPSBzdHIuY2hhckNvZGVBdChwb3MpO1xuICAgICAgaWYgKGNvZGUgPT09IDB4MEEgLyogXFxuICovKSB7IHJldHVybiByZXN1bHQ7IH1cbiAgICAgIGlmIChjb2RlID09PSAweDNFIC8qID4gKi8pIHtcbiAgICAgICAgcmVzdWx0LnBvcyA9IHBvcyArIDE7XG4gICAgICAgIHJlc3VsdC5zdHIgPSB1bmVzY2FwZUFsbChzdHIuc2xpY2Uoc3RhcnQgKyAxLCBwb3MpKTtcbiAgICAgICAgcmVzdWx0Lm9rID0gdHJ1ZTtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICAgIGlmIChjb2RlID09PSAweDVDIC8qIFxcICovICYmIHBvcyArIDEgPCBtYXgpIHtcbiAgICAgICAgcG9zICs9IDI7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICBwb3MrKztcbiAgICB9XG5cbiAgICAvLyBubyBjbG9zaW5nICc+J1xuICAgIHJldHVybiByZXN1bHQ7XG4gIH1cblxuICAvLyB0aGlzIHNob3VsZCBiZSAuLi4gfSBlbHNlIHsgLi4uIGJyYW5jaFxuXG4gIGxldmVsID0gMDtcbiAgd2hpbGUgKHBvcyA8IG1heCkge1xuICAgIGNvZGUgPSBzdHIuY2hhckNvZGVBdChwb3MpO1xuXG4gICAgaWYgKGNvZGUgPT09IDB4MjApIHsgYnJlYWs7IH1cblxuICAgIC8vIGFzY2lpIGNvbnRyb2wgY2hhcmFjdGVyc1xuICAgIGlmIChjb2RlIDwgMHgyMCB8fCBjb2RlID09PSAweDdGKSB7IGJyZWFrOyB9XG5cbiAgICBpZiAoY29kZSA9PT0gMHg1QyAvKiBcXCAqLyAmJiBwb3MgKyAxIDwgbWF4KSB7XG4gICAgICBwb3MgKz0gMjtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjb2RlID09PSAweDI4IC8qICggKi8pIHtcbiAgICAgIGxldmVsKys7XG4gICAgICBpZiAobGV2ZWwgPiAxKSB7IGJyZWFrOyB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGUgPT09IDB4MjkgLyogKSAqLykge1xuICAgICAgbGV2ZWwtLTtcbiAgICAgIGlmIChsZXZlbCA8IDApIHsgYnJlYWs7IH1cbiAgICB9XG5cbiAgICBwb3MrKztcbiAgfVxuXG4gIGlmIChzdGFydCA9PT0gcG9zKSB7IHJldHVybiByZXN1bHQ7IH1cblxuICByZXN1bHQuc3RyID0gdW5lc2NhcGVBbGwoc3RyLnNsaWNlKHN0YXJ0LCBwb3MpKTtcbiAgcmVzdWx0LmxpbmVzID0gbGluZXM7XG4gIHJlc3VsdC5wb3MgPSBwb3M7XG4gIHJlc3VsdC5vayA9IHRydWU7XG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwiLy8gUGFyc2UgbGluayBsYWJlbFxuLy9cbi8vIHRoaXMgZnVuY3Rpb24gYXNzdW1lcyB0aGF0IGZpcnN0IGNoYXJhY3RlciAoXCJbXCIpIGFscmVhZHkgbWF0Y2hlcztcbi8vIHJldHVybnMgdGhlIGVuZCBvZiB0aGUgbGFiZWxcbi8vXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyc2VMaW5rTGFiZWwoc3RhdGUsIHN0YXJ0LCBkaXNhYmxlTmVzdGVkKSB7XG4gIHZhciBsZXZlbCwgZm91bmQsIG1hcmtlciwgcHJldlBvcyxcbiAgICAgIGxhYmVsRW5kID0gLTEsXG4gICAgICBtYXggPSBzdGF0ZS5wb3NNYXgsXG4gICAgICBvbGRQb3MgPSBzdGF0ZS5wb3M7XG5cbiAgc3RhdGUucG9zID0gc3RhcnQgKyAxO1xuICBsZXZlbCA9IDE7XG5cbiAgd2hpbGUgKHN0YXRlLnBvcyA8IG1heCkge1xuICAgIG1hcmtlciA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXRlLnBvcyk7XG4gICAgaWYgKG1hcmtlciA9PT0gMHg1RCAvKiBdICovKSB7XG4gICAgICBsZXZlbC0tO1xuICAgICAgaWYgKGxldmVsID09PSAwKSB7XG4gICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcHJldlBvcyA9IHN0YXRlLnBvcztcbiAgICBzdGF0ZS5tZC5pbmxpbmUuc2tpcFRva2VuKHN0YXRlKTtcbiAgICBpZiAobWFya2VyID09PSAweDVCIC8qIFsgKi8pIHtcbiAgICAgIGlmIChwcmV2UG9zID09PSBzdGF0ZS5wb3MgLSAxKSB7XG4gICAgICAgIC8vIGluY3JlYXNlIGxldmVsIGlmIHdlIGZpbmQgdGV4dCBgW2AsIHdoaWNoIGlzIG5vdCBhIHBhcnQgb2YgYW55IHRva2VuXG4gICAgICAgIGxldmVsKys7XG4gICAgICB9IGVsc2UgaWYgKGRpc2FibGVOZXN0ZWQpIHtcbiAgICAgICAgc3RhdGUucG9zID0gb2xkUG9zO1xuICAgICAgICByZXR1cm4gLTE7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKGZvdW5kKSB7XG4gICAgbGFiZWxFbmQgPSBzdGF0ZS5wb3M7XG4gIH1cblxuICAvLyByZXN0b3JlIG9sZCBzdGF0ZVxuICBzdGF0ZS5wb3MgPSBvbGRQb3M7XG5cbiAgcmV0dXJuIGxhYmVsRW5kO1xufTtcbiIsIi8vIFBhcnNlIGxpbmsgdGl0bGVcbi8vXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIHVuZXNjYXBlQWxsID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykudW5lc2NhcGVBbGw7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBwYXJzZUxpbmtUaXRsZShzdHIsIHBvcywgbWF4KSB7XG4gIHZhciBjb2RlLFxuICAgICAgbWFya2VyLFxuICAgICAgbGluZXMgPSAwLFxuICAgICAgc3RhcnQgPSBwb3MsXG4gICAgICByZXN1bHQgPSB7XG4gICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgcG9zOiAwLFxuICAgICAgICBsaW5lczogMCxcbiAgICAgICAgc3RyOiAnJ1xuICAgICAgfTtcblxuICBpZiAocG9zID49IG1heCkgeyByZXR1cm4gcmVzdWx0OyB9XG5cbiAgbWFya2VyID0gc3RyLmNoYXJDb2RlQXQocG9zKTtcblxuICBpZiAobWFya2VyICE9PSAweDIyIC8qIFwiICovICYmIG1hcmtlciAhPT0gMHgyNyAvKiAnICovICYmIG1hcmtlciAhPT0gMHgyOCAvKiAoICovKSB7IHJldHVybiByZXN1bHQ7IH1cblxuICBwb3MrKztcblxuICAvLyBpZiBvcGVuaW5nIG1hcmtlciBpcyBcIihcIiwgc3dpdGNoIGl0IHRvIGNsb3NpbmcgbWFya2VyIFwiKVwiXG4gIGlmIChtYXJrZXIgPT09IDB4MjgpIHsgbWFya2VyID0gMHgyOTsgfVxuXG4gIHdoaWxlIChwb3MgPCBtYXgpIHtcbiAgICBjb2RlID0gc3RyLmNoYXJDb2RlQXQocG9zKTtcbiAgICBpZiAoY29kZSA9PT0gbWFya2VyKSB7XG4gICAgICByZXN1bHQucG9zID0gcG9zICsgMTtcbiAgICAgIHJlc3VsdC5saW5lcyA9IGxpbmVzO1xuICAgICAgcmVzdWx0LnN0ciA9IHVuZXNjYXBlQWxsKHN0ci5zbGljZShzdGFydCArIDEsIHBvcykpO1xuICAgICAgcmVzdWx0Lm9rID0gdHJ1ZTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSBlbHNlIGlmIChjb2RlID09PSAweDBBKSB7XG4gICAgICBsaW5lcysrO1xuICAgIH0gZWxzZSBpZiAoY29kZSA9PT0gMHg1QyAvKiBcXCAqLyAmJiBwb3MgKyAxIDwgbWF4KSB7XG4gICAgICBwb3MrKztcbiAgICAgIGlmIChzdHIuY2hhckNvZGVBdChwb3MpID09PSAweDBBKSB7XG4gICAgICAgIGxpbmVzKys7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcG9zKys7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufTtcbiIsIi8vIE1haW4gcGVyc2VyIGNsYXNzXG5cbid1c2Ugc3RyaWN0JztcblxuXG52YXIgdXRpbHMgICAgICAgID0gcmVxdWlyZSgnLi9jb21tb24vdXRpbHMnKTtcbnZhciBoZWxwZXJzICAgICAgPSByZXF1aXJlKCcuL2hlbHBlcnMnKTtcbnZhciBSZW5kZXJlciAgICAgPSByZXF1aXJlKCcuL3JlbmRlcmVyJyk7XG52YXIgUGFyc2VyQ29yZSAgID0gcmVxdWlyZSgnLi9wYXJzZXJfY29yZScpO1xudmFyIFBhcnNlckJsb2NrICA9IHJlcXVpcmUoJy4vcGFyc2VyX2Jsb2NrJyk7XG52YXIgUGFyc2VySW5saW5lID0gcmVxdWlyZSgnLi9wYXJzZXJfaW5saW5lJyk7XG52YXIgTGlua2lmeUl0ICAgID0gcmVxdWlyZSgnbGlua2lmeS1pdCcpO1xudmFyIG1kdXJsICAgICAgICA9IHJlcXVpcmUoJ21kdXJsJyk7XG52YXIgcHVueWNvZGUgICAgID0gcmVxdWlyZSgncHVueWNvZGUnKTtcblxuXG52YXIgY29uZmlnID0ge1xuICAnZGVmYXVsdCc6IHJlcXVpcmUoJy4vcHJlc2V0cy9kZWZhdWx0JyksXG4gIHplcm86IHJlcXVpcmUoJy4vcHJlc2V0cy96ZXJvJyksXG4gIGNvbW1vbm1hcms6IHJlcXVpcmUoJy4vcHJlc2V0cy9jb21tb25tYXJrJylcbn07XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vL1xuLy8gVGhpcyB2YWxpZGF0b3IgY2FuIHByb2hpYml0IG1vcmUgdGhhbiByZWFsbHkgbmVlZGVkIHRvIHByZXZlbnQgWFNTLiBJdCdzIGFcbi8vIHRyYWRlb2ZmIHRvIGtlZXAgY29kZSBzaW1wbGUgYW5kIHRvIGJlIHNlY3VyZSBieSBkZWZhdWx0LlxuLy9cbi8vIElmIHlvdSBuZWVkIGRpZmZlcmVudCBzZXR1cCAtIG92ZXJyaWRlIHZhbGlkYXRvciBtZXRob2QgYXMgeW91IHdpc2guIE9yXG4vLyByZXBsYWNlIGl0IHdpdGggZHVtbXkgZnVuY3Rpb24gYW5kIHVzZSBleHRlcm5hbCBzYW5pdGl6ZXIuXG4vL1xuXG52YXIgQkFEX1BST1RPX1JFID0gL14odmJzY3JpcHR8amF2YXNjcmlwdHxmaWxlfGRhdGEpOi87XG52YXIgR09PRF9EQVRBX1JFID0gL15kYXRhOmltYWdlXFwvKGdpZnxwbmd8anBlZ3x3ZWJwKTsvO1xuXG5mdW5jdGlvbiB2YWxpZGF0ZUxpbmsodXJsKSB7XG4gIC8vIHVybCBzaG91bGQgYmUgbm9ybWFsaXplZCBhdCB0aGlzIHBvaW50LCBhbmQgZXhpc3RpbmcgZW50aXRpZXMgYXJlIGRlY29kZWRcbiAgdmFyIHN0ciA9IHVybC50cmltKCkudG9Mb3dlckNhc2UoKTtcblxuICByZXR1cm4gQkFEX1BST1RPX1JFLnRlc3Qoc3RyKSA/IChHT09EX0RBVEFfUkUudGVzdChzdHIpID8gdHJ1ZSA6IGZhbHNlKSA6IHRydWU7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cblxudmFyIFJFQ09ERV9IT1NUTkFNRV9GT1IgPSBbICdodHRwOicsICdodHRwczonLCAnbWFpbHRvOicgXTtcblxuZnVuY3Rpb24gbm9ybWFsaXplTGluayh1cmwpIHtcbiAgdmFyIHBhcnNlZCA9IG1kdXJsLnBhcnNlKHVybCwgdHJ1ZSk7XG5cbiAgaWYgKHBhcnNlZC5ob3N0bmFtZSkge1xuICAgIC8vIEVuY29kZSBob3N0bmFtZXMgaW4gdXJscyBsaWtlOlxuICAgIC8vIGBodHRwOi8vaG9zdC9gLCBgaHR0cHM6Ly9ob3N0L2AsIGBtYWlsdG86dXNlckBob3N0YCwgYC8vaG9zdC9gXG4gICAgLy9cbiAgICAvLyBXZSBkb24ndCBlbmNvZGUgdW5rbm93biBzY2hlbWFzLCBiZWNhdXNlIGl0J3MgbGlrZWx5IHRoYXQgd2UgZW5jb2RlXG4gICAgLy8gc29tZXRoaW5nIHdlIHNob3VsZG4ndCAoZS5nLiBgc2t5cGU6bmFtZWAgdHJlYXRlZCBhcyBgc2t5cGU6aG9zdGApXG4gICAgLy9cbiAgICBpZiAoIXBhcnNlZC5wcm90b2NvbCB8fCBSRUNPREVfSE9TVE5BTUVfRk9SLmluZGV4T2YocGFyc2VkLnByb3RvY29sKSA+PSAwKSB7XG4gICAgICB0cnkge1xuICAgICAgICBwYXJzZWQuaG9zdG5hbWUgPSBwdW55Y29kZS50b0FTQ0lJKHBhcnNlZC5ob3N0bmFtZSk7XG4gICAgICB9IGNhdGNoKGVyKSB7fVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtZHVybC5lbmNvZGUobWR1cmwuZm9ybWF0KHBhcnNlZCkpO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVMaW5rVGV4dCh1cmwpIHtcbiAgdmFyIHBhcnNlZCA9IG1kdXJsLnBhcnNlKHVybCwgdHJ1ZSk7XG5cbiAgaWYgKHBhcnNlZC5ob3N0bmFtZSkge1xuICAgIC8vIEVuY29kZSBob3N0bmFtZXMgaW4gdXJscyBsaWtlOlxuICAgIC8vIGBodHRwOi8vaG9zdC9gLCBgaHR0cHM6Ly9ob3N0L2AsIGBtYWlsdG86dXNlckBob3N0YCwgYC8vaG9zdC9gXG4gICAgLy9cbiAgICAvLyBXZSBkb24ndCBlbmNvZGUgdW5rbm93biBzY2hlbWFzLCBiZWNhdXNlIGl0J3MgbGlrZWx5IHRoYXQgd2UgZW5jb2RlXG4gICAgLy8gc29tZXRoaW5nIHdlIHNob3VsZG4ndCAoZS5nLiBgc2t5cGU6bmFtZWAgdHJlYXRlZCBhcyBgc2t5cGU6aG9zdGApXG4gICAgLy9cbiAgICBpZiAoIXBhcnNlZC5wcm90b2NvbCB8fCBSRUNPREVfSE9TVE5BTUVfRk9SLmluZGV4T2YocGFyc2VkLnByb3RvY29sKSA+PSAwKSB7XG4gICAgICB0cnkge1xuICAgICAgICBwYXJzZWQuaG9zdG5hbWUgPSBwdW55Y29kZS50b1VuaWNvZGUocGFyc2VkLmhvc3RuYW1lKTtcbiAgICAgIH0gY2F0Y2goZXIpIHt9XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIG1kdXJsLmRlY29kZShtZHVybC5mb3JtYXQocGFyc2VkKSk7XG59XG5cblxuLyoqXG4gKiBjbGFzcyBNYXJrZG93bkl0XG4gKlxuICogTWFpbiBwYXJzZXIvcmVuZGVyZXIgY2xhc3MuXG4gKlxuICogIyMjIyMgVXNhZ2VcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiAvLyBub2RlLmpzLCBcImNsYXNzaWNcIiB3YXk6XG4gKiB2YXIgTWFya2Rvd25JdCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0JyksXG4gKiAgICAgbWQgPSBuZXcgTWFya2Rvd25JdCgpO1xuICogdmFyIHJlc3VsdCA9IG1kLnJlbmRlcignIyBtYXJrZG93bi1pdCBydWxlenohJyk7XG4gKlxuICogLy8gbm9kZS5qcywgdGhlIHNhbWUsIGJ1dCB3aXRoIHN1Z2FyOlxuICogdmFyIG1kID0gcmVxdWlyZSgnbWFya2Rvd24taXQnKSgpO1xuICogdmFyIHJlc3VsdCA9IG1kLnJlbmRlcignIyBtYXJrZG93bi1pdCBydWxlenohJyk7XG4gKlxuICogLy8gYnJvd3NlciB3aXRob3V0IEFNRCwgYWRkZWQgdG8gXCJ3aW5kb3dcIiBvbiBzY3JpcHQgbG9hZFxuICogLy8gTm90ZSwgdGhlcmUgYXJlIG5vIGRhc2guXG4gKiB2YXIgbWQgPSB3aW5kb3cubWFya2Rvd25pdCgpO1xuICogdmFyIHJlc3VsdCA9IG1kLnJlbmRlcignIyBtYXJrZG93bi1pdCBydWxlenohJyk7XG4gKiBgYGBcbiAqXG4gKiBTaW5nbGUgbGluZSByZW5kZXJpbmcsIHdpdGhvdXQgcGFyYWdyYXBoIHdyYXA6XG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogdmFyIG1kID0gcmVxdWlyZSgnbWFya2Rvd24taXQnKSgpO1xuICogdmFyIHJlc3VsdCA9IG1kLnJlbmRlcklubGluZSgnX19tYXJrZG93bi1pdF9fIHJ1bGV6eiEnKTtcbiAqIGBgYFxuICoqL1xuXG4vKipcbiAqIG5ldyBNYXJrZG93bkl0KFtwcmVzZXROYW1lLCBvcHRpb25zXSlcbiAqIC0gcHJlc2V0TmFtZSAoU3RyaW5nKTogb3B0aW9uYWwsIGBjb21tb25tYXJrYCAvIGB6ZXJvYFxuICogLSBvcHRpb25zIChPYmplY3QpXG4gKlxuICogQ3JlYXRlcyBwYXJzZXIgaW5zdGFuc2Ugd2l0aCBnaXZlbiBjb25maWcuIENhbiBiZSBjYWxsZWQgd2l0aG91dCBgbmV3YC5cbiAqXG4gKiAjIyMjIyBwcmVzZXROYW1lXG4gKlxuICogTWFya2Rvd25JdCBwcm92aWRlcyBuYW1lZCBwcmVzZXRzIGFzIGEgY29udmVuaWVuY2UgdG8gcXVpY2tseVxuICogZW5hYmxlL2Rpc2FibGUgYWN0aXZlIHN5bnRheCBydWxlcyBhbmQgb3B0aW9ucyBmb3IgY29tbW9uIHVzZSBjYXNlcy5cbiAqXG4gKiAtIFtcImNvbW1vbm1hcmtcIl0oaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L21hcmtkb3duLWl0L2Jsb2IvbWFzdGVyL2xpYi9wcmVzZXRzL2NvbW1vbm1hcmsuanMpIC1cbiAqICAgY29uZmlndXJlcyBwYXJzZXIgdG8gc3RyaWN0IFtDb21tb25NYXJrXShodHRwOi8vY29tbW9ubWFyay5vcmcvKSBtb2RlLlxuICogLSBbZGVmYXVsdF0oaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L21hcmtkb3duLWl0L2Jsb2IvbWFzdGVyL2xpYi9wcmVzZXRzL2RlZmF1bHQuanMpIC1cbiAqICAgc2ltaWxhciB0byBHRk0sIHVzZWQgd2hlbiBubyBwcmVzZXQgbmFtZSBnaXZlbi4gRW5hYmxlcyBhbGwgYXZhaWxhYmxlIHJ1bGVzLFxuICogICBidXQgc3RpbGwgd2l0aG91dCBodG1sLCB0eXBvZ3JhcGhlciAmIGF1dG9saW5rZXIuXG4gKiAtIFtcInplcm9cIl0oaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L21hcmtkb3duLWl0L2Jsb2IvbWFzdGVyL2xpYi9wcmVzZXRzL3plcm8uanMpIC1cbiAqICAgYWxsIHJ1bGVzIGRpc2FibGVkLiBVc2VmdWwgdG8gcXVpY2tseSBzZXR1cCB5b3VyIGNvbmZpZyB2aWEgYC5lbmFibGUoKWAuXG4gKiAgIEZvciBleGFtcGxlLCB3aGVuIHlvdSBuZWVkIG9ubHkgYGJvbGRgIGFuZCBgaXRhbGljYCBtYXJrdXAgYW5kIG5vdGhpbmcgZWxzZS5cbiAqXG4gKiAjIyMjIyBvcHRpb25zOlxuICpcbiAqIC0gX19odG1sX18gLSBgZmFsc2VgLiBTZXQgYHRydWVgIHRvIGVuYWJsZSBIVE1MIHRhZ3MgaW4gc291cmNlLiBCZSBjYXJlZnVsIVxuICogICBUaGF0J3Mgbm90IHNhZmUhIFlvdSBtYXkgbmVlZCBleHRlcm5hbCBzYW5pdGl6ZXIgdG8gcHJvdGVjdCBvdXRwdXQgZnJvbSBYU1MuXG4gKiAgIEl0J3MgYmV0dGVyIHRvIGV4dGVuZCBmZWF0dXJlcyB2aWEgcGx1Z2lucywgaW5zdGVhZCBvZiBlbmFibGluZyBIVE1MLlxuICogLSBfX3hodG1sT3V0X18gLSBgZmFsc2VgLiBTZXQgYHRydWVgIHRvIGFkZCAnLycgd2hlbiBjbG9zaW5nIHNpbmdsZSB0YWdzXG4gKiAgIChgPGJyIC8+YCkuIFRoaXMgaXMgbmVlZGVkIG9ubHkgZm9yIGZ1bGwgQ29tbW9uTWFyayBjb21wYXRpYmlsaXR5LiBJbiByZWFsXG4gKiAgIHdvcmxkIHlvdSB3aWxsIG5lZWQgSFRNTCBvdXRwdXQuXG4gKiAtIF9fYnJlYWtzX18gLSBgZmFsc2VgLiBTZXQgYHRydWVgIHRvIGNvbnZlcnQgYFxcbmAgaW4gcGFyYWdyYXBocyBpbnRvIGA8YnI+YC5cbiAqIC0gX19sYW5nUHJlZml4X18gLSBgbGFuZ3VhZ2UtYC4gQ1NTIGxhbmd1YWdlIGNsYXNzIHByZWZpeCBmb3IgZmVuY2VkIGJsb2Nrcy5cbiAqICAgQ2FuIGJlIHVzZWZ1bCBmb3IgZXh0ZXJuYWwgaGlnaGxpZ2h0ZXJzLlxuICogLSBfX2xpbmtpZnlfXyAtIGBmYWxzZWAuIFNldCBgdHJ1ZWAgdG8gYXV0b2NvbnZlcnQgVVJMLWxpa2UgdGV4dCB0byBsaW5rcy5cbiAqIC0gX190eXBvZ3JhcGhlcl9fICAtIGBmYWxzZWAuIFNldCBgdHJ1ZWAgdG8gZW5hYmxlIFtzb21lIGxhbmd1YWdlLW5ldXRyYWxcbiAqICAgcmVwbGFjZW1lbnRdKGh0dHBzOi8vZ2l0aHViLmNvbS9tYXJrZG93bi1pdC9tYXJrZG93bi1pdC9ibG9iL21hc3Rlci9saWIvcnVsZXNfY29yZS9yZXBsYWNlbWVudHMuanMpICtcbiAqICAgcXVvdGVzIGJlYXV0aWZpY2F0aW9uIChzbWFydHF1b3RlcykuXG4gKiAtIF9fcXVvdGVzX18gLSBg4oCc4oCd4oCY4oCZYCwgU3RyaW5nIG9yIEFycmF5LiBEb3VibGUgKyBzaW5nbGUgcXVvdGVzIHJlcGxhY2VtZW50XG4gKiAgIHBhaXJzLCB3aGVuIHR5cG9ncmFwaGVyIGVuYWJsZWQgYW5kIHNtYXJ0cXVvdGVzIG9uLiBGb3IgZXhhbXBsZSwgeW91IGNhblxuICogICB1c2UgYCfCq8K74oCe4oCcJ2AgZm9yIFJ1c3NpYW4sIGAn4oCe4oCc4oCa4oCYJ2AgZm9yIEdlcm1hbiwgYW5kXG4gKiAgIGBbJ8KrXFx4QTAnLCAnXFx4QTDCuycsICfigLlcXHhBMCcsICdcXHhBMOKAuiddYCBmb3IgRnJlbmNoIChpbmNsdWRpbmcgbmJzcCkuXG4gKiAtIF9faGlnaGxpZ2h0X18gLSBgbnVsbGAuIEhpZ2hsaWdodGVyIGZ1bmN0aW9uIGZvciBmZW5jZWQgY29kZSBibG9ja3MuXG4gKiAgIEhpZ2hsaWdodGVyIGBmdW5jdGlvbiAoc3RyLCBsYW5nKWAgc2hvdWxkIHJldHVybiBlc2NhcGVkIEhUTUwuIEl0IGNhbiBhbHNvXG4gKiAgIHJldHVybiBlbXB0eSBzdHJpbmcgaWYgdGhlIHNvdXJjZSB3YXMgbm90IGNoYW5nZWQgYW5kIHNob3VsZCBiZSBlc2NhcGVkIGV4dGVybmFseS5cbiAqXG4gKiAjIyMjIyBFeGFtcGxlXG4gKlxuICogYGBgamF2YXNjcmlwdFxuICogLy8gY29tbW9ubWFyayBtb2RlXG4gKiB2YXIgbWQgPSByZXF1aXJlKCdtYXJrZG93bi1pdCcpKCdjb21tb25tYXJrJyk7XG4gKlxuICogLy8gZGVmYXVsdCBtb2RlXG4gKiB2YXIgbWQgPSByZXF1aXJlKCdtYXJrZG93bi1pdCcpKCk7XG4gKlxuICogLy8gZW5hYmxlIGV2ZXJ5dGhpbmdcbiAqIHZhciBtZCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0Jykoe1xuICogICBodG1sOiB0cnVlLFxuICogICBsaW5raWZ5OiB0cnVlLFxuICogICB0eXBvZ3JhcGhlcjogdHJ1ZVxuICogfSk7XG4gKiBgYGBcbiAqXG4gKiAjIyMjIyBTeW50YXggaGlnaGxpZ2h0aW5nXG4gKlxuICogYGBganNcbiAqIHZhciBobGpzID0gcmVxdWlyZSgnaGlnaGxpZ2h0LmpzJykgLy8gaHR0cHM6Ly9oaWdobGlnaHRqcy5vcmcvXG4gKlxuICogdmFyIG1kID0gcmVxdWlyZSgnbWFya2Rvd24taXQnKSh7XG4gKiAgIGhpZ2hsaWdodDogZnVuY3Rpb24gKHN0ciwgbGFuZykge1xuICogICAgIGlmIChsYW5nICYmIGhsanMuZ2V0TGFuZ3VhZ2UobGFuZykpIHtcbiAqICAgICAgIHRyeSB7XG4gKiAgICAgICAgIHJldHVybiBobGpzLmhpZ2hsaWdodChsYW5nLCBzdHIpLnZhbHVlO1xuICogICAgICAgfSBjYXRjaCAoX18pIHt9XG4gKiAgICAgfVxuICpcbiAqICAgICB0cnkge1xuICogICAgICAgcmV0dXJuIGhsanMuaGlnaGxpZ2h0QXV0byhzdHIpLnZhbHVlO1xuICogICAgIH0gY2F0Y2ggKF9fKSB7fVxuICpcbiAqICAgICByZXR1cm4gJyc7IC8vIHVzZSBleHRlcm5hbCBkZWZhdWx0IGVzY2FwaW5nXG4gKiAgIH1cbiAqIH0pO1xuICogYGBgXG4gKiovXG5mdW5jdGlvbiBNYXJrZG93bkl0KHByZXNldE5hbWUsIG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIE1hcmtkb3duSXQpKSB7XG4gICAgcmV0dXJuIG5ldyBNYXJrZG93bkl0KHByZXNldE5hbWUsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zKSB7XG4gICAgaWYgKCF1dGlscy5pc1N0cmluZyhwcmVzZXROYW1lKSkge1xuICAgICAgb3B0aW9ucyA9IHByZXNldE5hbWUgfHwge307XG4gICAgICBwcmVzZXROYW1lID0gJ2RlZmF1bHQnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBNYXJrZG93bkl0I2lubGluZSAtPiBQYXJzZXJJbmxpbmVcbiAgICpcbiAgICogSW5zdGFuY2Ugb2YgW1tQYXJzZXJJbmxpbmVdXS4gWW91IG1heSBuZWVkIGl0IHRvIGFkZCBuZXcgcnVsZXMgd2hlblxuICAgKiB3cml0aW5nIHBsdWdpbnMuIEZvciBzaW1wbGUgcnVsZXMgY29udHJvbCB1c2UgW1tNYXJrZG93bkl0LmRpc2FibGVdXSBhbmRcbiAgICogW1tNYXJrZG93bkl0LmVuYWJsZV1dLlxuICAgKiovXG4gIHRoaXMuaW5saW5lID0gbmV3IFBhcnNlcklubGluZSgpO1xuXG4gIC8qKlxuICAgKiBNYXJrZG93bkl0I2Jsb2NrIC0+IFBhcnNlckJsb2NrXG4gICAqXG4gICAqIEluc3RhbmNlIG9mIFtbUGFyc2VyQmxvY2tdXS4gWW91IG1heSBuZWVkIGl0IHRvIGFkZCBuZXcgcnVsZXMgd2hlblxuICAgKiB3cml0aW5nIHBsdWdpbnMuIEZvciBzaW1wbGUgcnVsZXMgY29udHJvbCB1c2UgW1tNYXJrZG93bkl0LmRpc2FibGVdXSBhbmRcbiAgICogW1tNYXJrZG93bkl0LmVuYWJsZV1dLlxuICAgKiovXG4gIHRoaXMuYmxvY2sgPSBuZXcgUGFyc2VyQmxvY2soKTtcblxuICAvKipcbiAgICogTWFya2Rvd25JdCNjb3JlIC0+IENvcmVcbiAgICpcbiAgICogSW5zdGFuY2Ugb2YgW1tDb3JlXV0gY2hhaW4gZXhlY3V0b3IuIFlvdSBtYXkgbmVlZCBpdCB0byBhZGQgbmV3IHJ1bGVzIHdoZW5cbiAgICogd3JpdGluZyBwbHVnaW5zLiBGb3Igc2ltcGxlIHJ1bGVzIGNvbnRyb2wgdXNlIFtbTWFya2Rvd25JdC5kaXNhYmxlXV0gYW5kXG4gICAqIFtbTWFya2Rvd25JdC5lbmFibGVdXS5cbiAgICoqL1xuICB0aGlzLmNvcmUgPSBuZXcgUGFyc2VyQ29yZSgpO1xuXG4gIC8qKlxuICAgKiBNYXJrZG93bkl0I3JlbmRlcmVyIC0+IFJlbmRlcmVyXG4gICAqXG4gICAqIEluc3RhbmNlIG9mIFtbUmVuZGVyZXJdXS4gVXNlIGl0IHRvIG1vZGlmeSBvdXRwdXQgbG9vay4gT3IgdG8gYWRkIHJlbmRlcmluZ1xuICAgKiBydWxlcyBmb3IgbmV3IHRva2VuIHR5cGVzLCBnZW5lcmF0ZWQgYnkgcGx1Z2lucy5cbiAgICpcbiAgICogIyMjIyMgRXhhbXBsZVxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIHZhciBtZCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0JykoKTtcbiAgICpcbiAgICogZnVuY3Rpb24gbXlUb2tlbih0b2tlbnMsIGlkeCwgb3B0aW9ucywgZW52LCBzZWxmKSB7XG4gICAqICAgLy8uLi5cbiAgICogICByZXR1cm4gcmVzdWx0O1xuICAgKiB9O1xuICAgKlxuICAgKiBtZC5yZW5kZXJlci5ydWxlc1snbXlfdG9rZW4nXSA9IG15VG9rZW5cbiAgICogYGBgXG4gICAqXG4gICAqIFNlZSBbW1JlbmRlcmVyXV0gZG9jcyBhbmQgW3NvdXJjZSBjb2RlXShodHRwczovL2dpdGh1Yi5jb20vbWFya2Rvd24taXQvbWFya2Rvd24taXQvYmxvYi9tYXN0ZXIvbGliL3JlbmRlcmVyLmpzKS5cbiAgICoqL1xuICB0aGlzLnJlbmRlcmVyID0gbmV3IFJlbmRlcmVyKCk7XG5cbiAgLyoqXG4gICAqIE1hcmtkb3duSXQjbGlua2lmeSAtPiBMaW5raWZ5SXRcbiAgICpcbiAgICogW2xpbmtpZnktaXRdKGh0dHBzOi8vZ2l0aHViLmNvbS9tYXJrZG93bi1pdC9saW5raWZ5LWl0KSBpbnN0YW5jZS5cbiAgICogVXNlZCBieSBbbGlua2lmeV0oaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L21hcmtkb3duLWl0L2Jsb2IvbWFzdGVyL2xpYi9ydWxlc19jb3JlL2xpbmtpZnkuanMpXG4gICAqIHJ1bGUuXG4gICAqKi9cbiAgdGhpcy5saW5raWZ5ID0gbmV3IExpbmtpZnlJdCgpO1xuXG4gIC8qKlxuICAgKiBNYXJrZG93bkl0I3ZhbGlkYXRlTGluayh1cmwpIC0+IEJvb2xlYW5cbiAgICpcbiAgICogTGluayB2YWxpZGF0aW9uIGZ1bmN0aW9uLiBDb21tb25NYXJrIGFsbG93cyB0b28gbXVjaCBpbiBsaW5rcy4gQnkgZGVmYXVsdFxuICAgKiB3ZSBkaXNhYmxlIGBqYXZhc2NyaXB0OmAsIGB2YnNjcmlwdDpgLCBgZmlsZTpgIHNjaGVtYXMsIGFuZCBhbG1vc3QgYWxsIGBkYXRhOi4uLmAgc2NoZW1hc1xuICAgKiBleGNlcHQgc29tZSBlbWJlZGRlZCBpbWFnZSB0eXBlcy5cbiAgICpcbiAgICogWW91IGNhbiBjaGFuZ2UgdGhpcyBiZWhhdmlvdXI6XG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogdmFyIG1kID0gcmVxdWlyZSgnbWFya2Rvd24taXQnKSgpO1xuICAgKiAvLyBlbmFibGUgZXZlcnl0aGluZ1xuICAgKiBtZC52YWxpZGF0ZUxpbmsgPSBmdW5jdGlvbiAoKSB7IHJldHVybiB0cnVlOyB9XG4gICAqIGBgYFxuICAgKiovXG4gIHRoaXMudmFsaWRhdGVMaW5rID0gdmFsaWRhdGVMaW5rO1xuXG4gIC8qKlxuICAgKiBNYXJrZG93bkl0I25vcm1hbGl6ZUxpbmsodXJsKSAtPiBTdHJpbmdcbiAgICpcbiAgICogRnVuY3Rpb24gdXNlZCB0byBlbmNvZGUgbGluayB1cmwgdG8gYSBtYWNoaW5lLXJlYWRhYmxlIGZvcm1hdCxcbiAgICogd2hpY2ggaW5jbHVkZXMgdXJsLWVuY29kaW5nLCBwdW55Y29kZSwgZXRjLlxuICAgKiovXG4gIHRoaXMubm9ybWFsaXplTGluayA9IG5vcm1hbGl6ZUxpbms7XG5cbiAgLyoqXG4gICAqIE1hcmtkb3duSXQjbm9ybWFsaXplTGlua1RleHQodXJsKSAtPiBTdHJpbmdcbiAgICpcbiAgICogRnVuY3Rpb24gdXNlZCB0byBkZWNvZGUgbGluayB1cmwgdG8gYSBodW1hbi1yZWFkYWJsZSBmb3JtYXRgXG4gICAqKi9cbiAgdGhpcy5ub3JtYWxpemVMaW5rVGV4dCA9IG5vcm1hbGl6ZUxpbmtUZXh0O1xuXG5cbiAgLy8gRXhwb3NlIHV0aWxzICYgaGVscGVycyBmb3IgZWFzeSBhY2NlcyBmcm9tIHBsdWdpbnNcblxuICAvKipcbiAgICogTWFya2Rvd25JdCN1dGlscyAtPiB1dGlsc1xuICAgKlxuICAgKiBBc3NvcnRlZCB1dGlsaXR5IGZ1bmN0aW9ucywgdXNlZnVsIHRvIHdyaXRlIHBsdWdpbnMuIFNlZSBkZXRhaWxzXG4gICAqIFtoZXJlXShodHRwczovL2dpdGh1Yi5jb20vbWFya2Rvd24taXQvbWFya2Rvd24taXQvYmxvYi9tYXN0ZXIvbGliL2NvbW1vbi91dGlscy5qcykuXG4gICAqKi9cbiAgdGhpcy51dGlscyA9IHV0aWxzO1xuXG4gIC8qKlxuICAgKiBNYXJrZG93bkl0I2hlbHBlcnMgLT4gaGVscGVyc1xuICAgKlxuICAgKiBMaW5rIGNvbXBvbmVudHMgcGFyc2VyIGZ1bmN0aW9ucywgdXNlZnVsIHRvIHdyaXRlIHBsdWdpbnMuIFNlZSBkZXRhaWxzXG4gICAqIFtoZXJlXShodHRwczovL2dpdGh1Yi5jb20vbWFya2Rvd24taXQvbWFya2Rvd24taXQvYmxvYi9tYXN0ZXIvbGliL2hlbHBlcnMpLlxuICAgKiovXG4gIHRoaXMuaGVscGVycyA9IGhlbHBlcnM7XG5cblxuICB0aGlzLm9wdGlvbnMgPSB7fTtcbiAgdGhpcy5jb25maWd1cmUocHJlc2V0TmFtZSk7XG5cbiAgaWYgKG9wdGlvbnMpIHsgdGhpcy5zZXQob3B0aW9ucyk7IH1cbn1cblxuXG4vKiogY2hhaW5hYmxlXG4gKiBNYXJrZG93bkl0LnNldChvcHRpb25zKVxuICpcbiAqIFNldCBwYXJzZXIgb3B0aW9ucyAoaW4gdGhlIHNhbWUgZm9ybWF0IGFzIGluIGNvbnN0cnVjdG9yKS4gUHJvYmFibHksIHlvdVxuICogd2lsbCBuZXZlciBuZWVkIGl0LCBidXQgeW91IGNhbiBjaGFuZ2Ugb3B0aW9ucyBhZnRlciBjb25zdHJ1Y3RvciBjYWxsLlxuICpcbiAqICMjIyMjIEV4YW1wbGVcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgbWQgPSByZXF1aXJlKCdtYXJrZG93bi1pdCcpKClcbiAqICAgICAgICAgICAgIC5zZXQoeyBodG1sOiB0cnVlLCBicmVha3M6IHRydWUgfSlcbiAqICAgICAgICAgICAgIC5zZXQoeyB0eXBvZ3JhcGhlciwgdHJ1ZSB9KTtcbiAqIGBgYFxuICpcbiAqIF9fTm90ZTpfXyBUbyBhY2hpZXZlIHRoZSBiZXN0IHBvc3NpYmxlIHBlcmZvcm1hbmNlLCBkb24ndCBtb2RpZnkgYVxuICogYG1hcmtkb3duLWl0YCBpbnN0YW5jZSBvcHRpb25zIG9uIHRoZSBmbHkuIElmIHlvdSBuZWVkIG11bHRpcGxlIGNvbmZpZ3VyYXRpb25zXG4gKiBpdCdzIGJlc3QgdG8gY3JlYXRlIG11bHRpcGxlIGluc3RhbmNlcyBhbmQgaW5pdGlhbGl6ZSBlYWNoIHdpdGggc2VwYXJhdGVcbiAqIGNvbmZpZy5cbiAqKi9cbk1hcmtkb3duSXQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHV0aWxzLmFzc2lnbih0aGlzLm9wdGlvbnMsIG9wdGlvbnMpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblxuLyoqIGNoYWluYWJsZSwgaW50ZXJuYWxcbiAqIE1hcmtkb3duSXQuY29uZmlndXJlKHByZXNldHMpXG4gKlxuICogQmF0Y2ggbG9hZCBvZiBhbGwgb3B0aW9ucyBhbmQgY29tcGVuZW50IHNldHRpbmdzLiBUaGlzIGlzIGludGVybmFsIG1ldGhvZCxcbiAqIGFuZCB5b3UgcHJvYmFibHkgd2lsbCBub3QgbmVlZCBpdC4gQnV0IGlmIHlvdSB3aXRoIC0gc2VlIGF2YWlsYWJsZSBwcmVzZXRzXG4gKiBhbmQgZGF0YSBzdHJ1Y3R1cmUgW2hlcmVdKGh0dHBzOi8vZ2l0aHViLmNvbS9tYXJrZG93bi1pdC9tYXJrZG93bi1pdC90cmVlL21hc3Rlci9saWIvcHJlc2V0cylcbiAqXG4gKiBXZSBzdHJvbmdseSByZWNvbW1lbmQgdG8gdXNlIHByZXNldHMgaW5zdGVhZCBvZiBkaXJlY3QgY29uZmlnIGxvYWRzLiBUaGF0XG4gKiB3aWxsIGdpdmUgYmV0dGVyIGNvbXBhdGliaWxpdHkgd2l0aCBuZXh0IHZlcnNpb25zLlxuICoqL1xuTWFya2Rvd25JdC5wcm90b3R5cGUuY29uZmlndXJlID0gZnVuY3Rpb24gKHByZXNldHMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzLCBwcmVzZXROYW1lO1xuXG4gIGlmICh1dGlscy5pc1N0cmluZyhwcmVzZXRzKSkge1xuICAgIHByZXNldE5hbWUgPSBwcmVzZXRzO1xuICAgIHByZXNldHMgPSBjb25maWdbcHJlc2V0TmFtZV07XG4gICAgaWYgKCFwcmVzZXRzKSB7IHRocm93IG5ldyBFcnJvcignV3JvbmcgYG1hcmtkb3duLWl0YCBwcmVzZXQgXCInICsgcHJlc2V0TmFtZSArICdcIiwgY2hlY2sgbmFtZScpOyB9XG4gIH1cblxuICBpZiAoIXByZXNldHMpIHsgdGhyb3cgbmV3IEVycm9yKCdXcm9uZyBgbWFya2Rvd24taXRgIHByZXNldCwgY2FuXFwndCBiZSBlbXB0eScpOyB9XG5cbiAgaWYgKHByZXNldHMub3B0aW9ucykgeyBzZWxmLnNldChwcmVzZXRzLm9wdGlvbnMpOyB9XG5cbiAgaWYgKHByZXNldHMuY29tcG9uZW50cykge1xuICAgIE9iamVjdC5rZXlzKHByZXNldHMuY29tcG9uZW50cykuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgICAgaWYgKHByZXNldHMuY29tcG9uZW50c1tuYW1lXS5ydWxlcykge1xuICAgICAgICBzZWxmW25hbWVdLnJ1bGVyLmVuYWJsZU9ubHkocHJlc2V0cy5jb21wb25lbnRzW25hbWVdLnJ1bGVzKTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cblxuLyoqIGNoYWluYWJsZVxuICogTWFya2Rvd25JdC5lbmFibGUobGlzdCwgaWdub3JlSW52YWxpZClcbiAqIC0gbGlzdCAoU3RyaW5nfEFycmF5KTogcnVsZSBuYW1lIG9yIGxpc3Qgb2YgcnVsZSBuYW1lcyB0byBlbmFibGVcbiAqIC0gaWdub3JlSW52YWxpZCAoQm9vbGVhbik6IHNldCBgdHJ1ZWAgdG8gaWdub3JlIGVycm9ycyB3aGVuIHJ1bGUgbm90IGZvdW5kLlxuICpcbiAqIEVuYWJsZSBsaXN0IG9yIHJ1bGVzLiBJdCB3aWxsIGF1dG9tYXRpY2FsbHkgZmluZCBhcHByb3ByaWF0ZSBjb21wb25lbnRzLFxuICogY29udGFpbmluZyBydWxlcyB3aXRoIGdpdmVuIG5hbWVzLiBJZiBydWxlIG5vdCBmb3VuZCwgYW5kIGBpZ25vcmVJbnZhbGlkYFxuICogbm90IHNldCAtIHRocm93cyBleGNlcHRpb24uXG4gKlxuICogIyMjIyMgRXhhbXBsZVxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBtZCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0JykoKVxuICogICAgICAgICAgICAgLmVuYWJsZShbJ3N1YicsICdzdXAnXSlcbiAqICAgICAgICAgICAgIC5kaXNhYmxlKCdzbWFydHF1b3RlcycpO1xuICogYGBgXG4gKiovXG5NYXJrZG93bkl0LnByb3RvdHlwZS5lbmFibGUgPSBmdW5jdGlvbiAobGlzdCwgaWdub3JlSW52YWxpZCkge1xuICB2YXIgcmVzdWx0ID0gW107XG5cbiAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3QpKSB7IGxpc3QgPSBbIGxpc3QgXTsgfVxuXG4gIFsgJ2NvcmUnLCAnYmxvY2snLCAnaW5saW5lJyBdLmZvckVhY2goZnVuY3Rpb24gKGNoYWluKSB7XG4gICAgcmVzdWx0ID0gcmVzdWx0LmNvbmNhdCh0aGlzW2NoYWluXS5ydWxlci5lbmFibGUobGlzdCwgdHJ1ZSkpO1xuICB9LCB0aGlzKTtcblxuICB2YXIgbWlzc2VkID0gbGlzdC5maWx0ZXIoZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIHJlc3VsdC5pbmRleE9mKG5hbWUpIDwgMDsgfSk7XG5cbiAgaWYgKG1pc3NlZC5sZW5ndGggJiYgIWlnbm9yZUludmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01hcmtkb3duSXQuIEZhaWxlZCB0byBlbmFibGUgdW5rbm93biBydWxlKHMpOiAnICsgbWlzc2VkKTtcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKiogY2hhaW5hYmxlXG4gKiBNYXJrZG93bkl0LmRpc2FibGUobGlzdCwgaWdub3JlSW52YWxpZClcbiAqIC0gbGlzdCAoU3RyaW5nfEFycmF5KTogcnVsZSBuYW1lIG9yIGxpc3Qgb2YgcnVsZSBuYW1lcyB0byBkaXNhYmxlLlxuICogLSBpZ25vcmVJbnZhbGlkIChCb29sZWFuKTogc2V0IGB0cnVlYCB0byBpZ25vcmUgZXJyb3JzIHdoZW4gcnVsZSBub3QgZm91bmQuXG4gKlxuICogVGhlIHNhbWUgYXMgW1tNYXJrZG93bkl0LmVuYWJsZV1dLCBidXQgdHVybiBzcGVjaWZpZWQgcnVsZXMgb2ZmLlxuICoqL1xuTWFya2Rvd25JdC5wcm90b3R5cGUuZGlzYWJsZSA9IGZ1bmN0aW9uIChsaXN0LCBpZ25vcmVJbnZhbGlkKSB7XG4gIHZhciByZXN1bHQgPSBbXTtcblxuICBpZiAoIUFycmF5LmlzQXJyYXkobGlzdCkpIHsgbGlzdCA9IFsgbGlzdCBdOyB9XG5cbiAgWyAnY29yZScsICdibG9jaycsICdpbmxpbmUnIF0uZm9yRWFjaChmdW5jdGlvbiAoY2hhaW4pIHtcbiAgICByZXN1bHQgPSByZXN1bHQuY29uY2F0KHRoaXNbY2hhaW5dLnJ1bGVyLmRpc2FibGUobGlzdCwgdHJ1ZSkpO1xuICB9LCB0aGlzKTtcblxuICB2YXIgbWlzc2VkID0gbGlzdC5maWx0ZXIoZnVuY3Rpb24gKG5hbWUpIHsgcmV0dXJuIHJlc3VsdC5pbmRleE9mKG5hbWUpIDwgMDsgfSk7XG5cbiAgaWYgKG1pc3NlZC5sZW5ndGggJiYgIWlnbm9yZUludmFsaWQpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ01hcmtkb3duSXQuIEZhaWxlZCB0byBkaXNhYmxlIHVua25vd24gcnVsZShzKTogJyArIG1pc3NlZCk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5cbi8qKiBjaGFpbmFibGVcbiAqIE1hcmtkb3duSXQudXNlKHBsdWdpbiwgcGFyYW1zKVxuICpcbiAqIExvYWQgc3BlY2lmaWVkIHBsdWdpbiB3aXRoIGdpdmVuIHBhcmFtcyBpbnRvIGN1cnJlbnQgcGFyc2VyIGluc3RhbmNlLlxuICogSXQncyBqdXN0IGEgc3VnYXIgdG8gY2FsbCBgcGx1Z2luKG1kLCBwYXJhbXMpYCB3aXRoIGN1cnJpbmcuXG4gKlxuICogIyMjIyMgRXhhbXBsZVxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBpdGVyYXRvciA9IHJlcXVpcmUoJ21hcmtkb3duLWl0LWZvci1pbmxpbmUnKTtcbiAqIHZhciBtZCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0JykoKVxuICogICAgICAgICAgICAgLnVzZShpdGVyYXRvciwgJ2Zvb19yZXBsYWNlJywgJ3RleHQnLCBmdW5jdGlvbiAodG9rZW5zLCBpZHgpIHtcbiAqICAgICAgICAgICAgICAgdG9rZW5zW2lkeF0uY29udGVudCA9IHRva2Vuc1tpZHhdLmNvbnRlbnQucmVwbGFjZSgvZm9vL2csICdiYXInKTtcbiAqICAgICAgICAgICAgIH0pO1xuICogYGBgXG4gKiovXG5NYXJrZG93bkl0LnByb3RvdHlwZS51c2UgPSBmdW5jdGlvbiAocGx1Z2luIC8qLCBwYXJhbXMsIC4uLiAqLykge1xuICB2YXIgYXJncyA9IFsgdGhpcyBdLmNvbmNhdChBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpKTtcbiAgcGx1Z2luLmFwcGx5KHBsdWdpbiwgYXJncyk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKiogaW50ZXJuYWxcbiAqIE1hcmtkb3duSXQucGFyc2Uoc3JjLCBlbnYpIC0+IEFycmF5XG4gKiAtIHNyYyAoU3RyaW5nKTogc291cmNlIHN0cmluZ1xuICogLSBlbnYgKE9iamVjdCk6IGVudmlyb25tZW50IHNhbmRib3hcbiAqXG4gKiBQYXJzZSBpbnB1dCBzdHJpbmcgYW5kIHJldHVybnMgbGlzdCBvZiBibG9jayB0b2tlbnMgKHNwZWNpYWwgdG9rZW4gdHlwZVxuICogXCJpbmxpbmVcIiB3aWxsIGNvbnRhaW4gbGlzdCBvZiBpbmxpbmUgdG9rZW5zKS4gWW91IHNob3VsZCBub3QgY2FsbCB0aGlzXG4gKiBtZXRob2QgZGlyZWN0bHksIHVudGlsIHlvdSB3cml0ZSBjdXN0b20gcmVuZGVyZXIgKGZvciBleGFtcGxlLCB0byBwcm9kdWNlXG4gKiBBU1QpLlxuICpcbiAqIGBlbnZgIGlzIHVzZWQgdG8gcGFzcyBkYXRhIGJldHdlZW4gXCJkaXN0cmlidXRlZFwiIHJ1bGVzIGFuZCByZXR1cm4gYWRkaXRpb25hbFxuICogbWV0YWRhdGEgbGlrZSByZWZlcmVuY2UgaW5mbywgbmVlZGVkIGZvciBmb3IgcmVuZGVyZXIuIEl0IGFsc28gY2FuIGJlIHVzZWQgdG9cbiAqIGluamVjdCBkYXRhIGluIHNwZWNpZmljIGNhc2VzLiBVc3VhbGx5LCB5b3Ugd2lsbCBiZSBvayB0byBwYXNzIGB7fWAsXG4gKiBhbmQgdGhlbiBwYXNzIHVwZGF0ZWQgb2JqZWN0IHRvIHJlbmRlcmVyLlxuICoqL1xuTWFya2Rvd25JdC5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoc3JjLCBlbnYpIHtcbiAgdmFyIHN0YXRlID0gbmV3IHRoaXMuY29yZS5TdGF0ZShzcmMsIHRoaXMsIGVudik7XG5cbiAgdGhpcy5jb3JlLnByb2Nlc3Moc3RhdGUpO1xuXG4gIHJldHVybiBzdGF0ZS50b2tlbnM7XG59O1xuXG5cbi8qKlxuICogTWFya2Rvd25JdC5yZW5kZXIoc3JjIFssIGVudl0pIC0+IFN0cmluZ1xuICogLSBzcmMgKFN0cmluZyk6IHNvdXJjZSBzdHJpbmdcbiAqIC0gZW52IChPYmplY3QpOiBlbnZpcm9ubWVudCBzYW5kYm94XG4gKlxuICogUmVuZGVyIG1hcmtkb3duIHN0cmluZyBpbnRvIGh0bWwuIEl0IGRvZXMgYWxsIG1hZ2ljIGZvciB5b3UgOikuXG4gKlxuICogYGVudmAgY2FuIGJlIHVzZWQgdG8gaW5qZWN0IGFkZGl0aW9uYWwgbWV0YWRhdGEgKGB7fWAgYnkgZGVmYXVsdCkuXG4gKiBCdXQgeW91IHdpbGwgbm90IG5lZWQgaXQgd2l0aCBoaWdoIHByb2JhYmlsaXR5LiBTZWUgYWxzbyBjb21tZW50XG4gKiBpbiBbW01hcmtkb3duSXQucGFyc2VdXS5cbiAqKi9cbk1hcmtkb3duSXQucHJvdG90eXBlLnJlbmRlciA9IGZ1bmN0aW9uIChzcmMsIGVudikge1xuICBlbnYgPSBlbnYgfHwge307XG5cbiAgcmV0dXJuIHRoaXMucmVuZGVyZXIucmVuZGVyKHRoaXMucGFyc2Uoc3JjLCBlbnYpLCB0aGlzLm9wdGlvbnMsIGVudik7XG59O1xuXG5cbi8qKiBpbnRlcm5hbFxuICogTWFya2Rvd25JdC5wYXJzZUlubGluZShzcmMsIGVudikgLT4gQXJyYXlcbiAqIC0gc3JjIChTdHJpbmcpOiBzb3VyY2Ugc3RyaW5nXG4gKiAtIGVudiAoT2JqZWN0KTogZW52aXJvbm1lbnQgc2FuZGJveFxuICpcbiAqIFRoZSBzYW1lIGFzIFtbTWFya2Rvd25JdC5wYXJzZV1dIGJ1dCBza2lwIGFsbCBibG9jayBydWxlcy4gSXQgcmV0dXJucyB0aGVcbiAqIGJsb2NrIHRva2VucyBsaXN0IHdpdGggdGhlIHNpbmdsZSBgaW5saW5lYCBlbGVtZW50LCBjb250YWluaW5nIHBhcnNlZCBpbmxpbmVcbiAqIHRva2VucyBpbiBgY2hpbGRyZW5gIHByb3BlcnR5LiBBbHNvIHVwZGF0ZXMgYGVudmAgb2JqZWN0LlxuICoqL1xuTWFya2Rvd25JdC5wcm90b3R5cGUucGFyc2VJbmxpbmUgPSBmdW5jdGlvbiAoc3JjLCBlbnYpIHtcbiAgdmFyIHN0YXRlID0gbmV3IHRoaXMuY29yZS5TdGF0ZShzcmMsIHRoaXMsIGVudik7XG5cbiAgc3RhdGUuaW5saW5lTW9kZSA9IHRydWU7XG4gIHRoaXMuY29yZS5wcm9jZXNzKHN0YXRlKTtcblxuICByZXR1cm4gc3RhdGUudG9rZW5zO1xufTtcblxuXG4vKipcbiAqIE1hcmtkb3duSXQucmVuZGVySW5saW5lKHNyYyBbLCBlbnZdKSAtPiBTdHJpbmdcbiAqIC0gc3JjIChTdHJpbmcpOiBzb3VyY2Ugc3RyaW5nXG4gKiAtIGVudiAoT2JqZWN0KTogZW52aXJvbm1lbnQgc2FuZGJveFxuICpcbiAqIFNpbWlsYXIgdG8gW1tNYXJrZG93bkl0LnJlbmRlcl1dIGJ1dCBmb3Igc2luZ2xlIHBhcmFncmFwaCBjb250ZW50LiBSZXN1bHRcbiAqIHdpbGwgTk9UIGJlIHdyYXBwZWQgaW50byBgPHA+YCB0YWdzLlxuICoqL1xuTWFya2Rvd25JdC5wcm90b3R5cGUucmVuZGVySW5saW5lID0gZnVuY3Rpb24gKHNyYywgZW52KSB7XG4gIGVudiA9IGVudiB8fCB7fTtcblxuICByZXR1cm4gdGhpcy5yZW5kZXJlci5yZW5kZXIodGhpcy5wYXJzZUlubGluZShzcmMsIGVudiksIHRoaXMub3B0aW9ucywgZW52KTtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBNYXJrZG93bkl0O1xuIiwiLyoqIGludGVybmFsXG4gKiBjbGFzcyBQYXJzZXJCbG9ja1xuICpcbiAqIEJsb2NrLWxldmVsIHRva2VuaXplci5cbiAqKi9cbid1c2Ugc3RyaWN0JztcblxuXG52YXIgUnVsZXIgICAgICAgICAgID0gcmVxdWlyZSgnLi9ydWxlcicpO1xuXG5cbnZhciBfcnVsZXMgPSBbXG4gIC8vIEZpcnN0IDIgcGFyYW1zIC0gcnVsZSBuYW1lICYgc291cmNlLiBTZWNvbmRhcnkgYXJyYXkgLSBsaXN0IG9mIHJ1bGVzLFxuICAvLyB3aGljaCBjYW4gYmUgdGVybWluYXRlZCBieSB0aGlzIG9uZS5cbiAgWyAnY29kZScsICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfYmxvY2svY29kZScpIF0sXG4gIFsgJ2ZlbmNlJywgICAgICByZXF1aXJlKCcuL3J1bGVzX2Jsb2NrL2ZlbmNlJyksICAgICAgWyAncGFyYWdyYXBoJywgJ3JlZmVyZW5jZScsICdibG9ja3F1b3RlJywgJ2xpc3QnIF0gXSxcbiAgWyAnYmxvY2txdW90ZScsIHJlcXVpcmUoJy4vcnVsZXNfYmxvY2svYmxvY2txdW90ZScpLCBbICdwYXJhZ3JhcGgnLCAncmVmZXJlbmNlJywgJ2xpc3QnIF0gXSxcbiAgWyAnaHInLCAgICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfYmxvY2svaHInKSwgICAgICAgICBbICdwYXJhZ3JhcGgnLCAncmVmZXJlbmNlJywgJ2Jsb2NrcXVvdGUnLCAnbGlzdCcgXSBdLFxuICBbICdsaXN0JywgICAgICAgcmVxdWlyZSgnLi9ydWxlc19ibG9jay9saXN0JyksICAgICAgIFsgJ3BhcmFncmFwaCcsICdyZWZlcmVuY2UnLCAnYmxvY2txdW90ZScgXSBdLFxuICBbICdyZWZlcmVuY2UnLCAgcmVxdWlyZSgnLi9ydWxlc19ibG9jay9yZWZlcmVuY2UnKSBdLFxuICBbICdoZWFkaW5nJywgICAgcmVxdWlyZSgnLi9ydWxlc19ibG9jay9oZWFkaW5nJyksICAgIFsgJ3BhcmFncmFwaCcsICdyZWZlcmVuY2UnLCAnYmxvY2txdW90ZScgXSBdLFxuICBbICdsaGVhZGluZycsICAgcmVxdWlyZSgnLi9ydWxlc19ibG9jay9saGVhZGluZycpIF0sXG4gIFsgJ2h0bWxfYmxvY2snLCByZXF1aXJlKCcuL3J1bGVzX2Jsb2NrL2h0bWxfYmxvY2snKSwgWyAncGFyYWdyYXBoJywgJ3JlZmVyZW5jZScsICdibG9ja3F1b3RlJyBdIF0sXG4gIFsgJ3RhYmxlJywgICAgICByZXF1aXJlKCcuL3J1bGVzX2Jsb2NrL3RhYmxlJyksICAgICAgWyAncGFyYWdyYXBoJywgJ3JlZmVyZW5jZScgXSBdLFxuICBbICdwYXJhZ3JhcGgnLCAgcmVxdWlyZSgnLi9ydWxlc19ibG9jay9wYXJhZ3JhcGgnKSBdXG5dO1xuXG5cbi8qKlxuICogbmV3IFBhcnNlckJsb2NrKClcbiAqKi9cbmZ1bmN0aW9uIFBhcnNlckJsb2NrKCkge1xuICAvKipcbiAgICogUGFyc2VyQmxvY2sjcnVsZXIgLT4gUnVsZXJcbiAgICpcbiAgICogW1tSdWxlcl1dIGluc3RhbmNlLiBLZWVwIGNvbmZpZ3VyYXRpb24gb2YgYmxvY2sgcnVsZXMuXG4gICAqKi9cbiAgdGhpcy5ydWxlciA9IG5ldyBSdWxlcigpO1xuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgX3J1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgdGhpcy5ydWxlci5wdXNoKF9ydWxlc1tpXVswXSwgX3J1bGVzW2ldWzFdLCB7IGFsdDogKF9ydWxlc1tpXVsyXSB8fCBbXSkuc2xpY2UoKSB9KTtcbiAgfVxufVxuXG5cbi8vIEdlbmVyYXRlIHRva2VucyBmb3IgaW5wdXQgcmFuZ2Vcbi8vXG5QYXJzZXJCbG9jay5wcm90b3R5cGUudG9rZW5pemUgPSBmdW5jdGlvbiAoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSkge1xuICB2YXIgb2ssIGksXG4gICAgICBydWxlcyA9IHRoaXMucnVsZXIuZ2V0UnVsZXMoJycpLFxuICAgICAgbGVuID0gcnVsZXMubGVuZ3RoLFxuICAgICAgbGluZSA9IHN0YXJ0TGluZSxcbiAgICAgIGhhc0VtcHR5TGluZXMgPSBmYWxzZSxcbiAgICAgIG1heE5lc3RpbmcgPSBzdGF0ZS5tZC5vcHRpb25zLm1heE5lc3Rpbmc7XG5cbiAgd2hpbGUgKGxpbmUgPCBlbmRMaW5lKSB7XG4gICAgc3RhdGUubGluZSA9IGxpbmUgPSBzdGF0ZS5za2lwRW1wdHlMaW5lcyhsaW5lKTtcbiAgICBpZiAobGluZSA+PSBlbmRMaW5lKSB7IGJyZWFrOyB9XG5cbiAgICAvLyBUZXJtaW5hdGlvbiBjb25kaXRpb24gZm9yIG5lc3RlZCBjYWxscy5cbiAgICAvLyBOZXN0ZWQgY2FsbHMgY3VycmVudGx5IHVzZWQgZm9yIGJsb2NrcXVvdGVzICYgbGlzdHNcbiAgICBpZiAoc3RhdGUudFNoaWZ0W2xpbmVdIDwgc3RhdGUuYmxrSW5kZW50KSB7IGJyZWFrOyB9XG5cbiAgICAvLyBJZiBuZXN0aW5nIGxldmVsIGV4Y2VlZGVkIC0gc2tpcCB0YWlsIHRvIHRoZSBlbmQuIFRoYXQncyBub3Qgb3JkaW5hcnlcbiAgICAvLyBzaXR1YXRpb24gYW5kIHdlIHNob3VsZCBub3QgY2FyZSBhYm91dCBjb250ZW50LlxuICAgIGlmIChzdGF0ZS5sZXZlbCA+PSBtYXhOZXN0aW5nKSB7XG4gICAgICBzdGF0ZS5saW5lID0gZW5kTGluZTtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vIFRyeSBhbGwgcG9zc2libGUgcnVsZXMuXG4gICAgLy8gT24gc3VjY2VzcywgcnVsZSBzaG91bGQ6XG4gICAgLy9cbiAgICAvLyAtIHVwZGF0ZSBgc3RhdGUubGluZWBcbiAgICAvLyAtIHVwZGF0ZSBgc3RhdGUudG9rZW5zYFxuICAgIC8vIC0gcmV0dXJuIHRydWVcblxuICAgIGZvciAoaSA9IDA7IGkgPCBsZW47IGkrKykge1xuICAgICAgb2sgPSBydWxlc1tpXShzdGF0ZSwgbGluZSwgZW5kTGluZSwgZmFsc2UpO1xuICAgICAgaWYgKG9rKSB7IGJyZWFrOyB9XG4gICAgfVxuXG4gICAgLy8gc2V0IHN0YXRlLnRpZ2h0IGlmZiB3ZSBoYWQgYW4gZW1wdHkgbGluZSBiZWZvcmUgY3VycmVudCB0YWdcbiAgICAvLyBpLmUuIGxhdGVzdCBlbXB0eSBsaW5lIHNob3VsZCBub3QgY291bnRcbiAgICBzdGF0ZS50aWdodCA9ICFoYXNFbXB0eUxpbmVzO1xuXG4gICAgLy8gcGFyYWdyYXBoIG1pZ2h0IFwiZWF0XCIgb25lIG5ld2xpbmUgYWZ0ZXIgaXQgaW4gbmVzdGVkIGxpc3RzXG4gICAgaWYgKHN0YXRlLmlzRW1wdHkoc3RhdGUubGluZSAtIDEpKSB7XG4gICAgICBoYXNFbXB0eUxpbmVzID0gdHJ1ZTtcbiAgICB9XG5cbiAgICBsaW5lID0gc3RhdGUubGluZTtcblxuICAgIGlmIChsaW5lIDwgZW5kTGluZSAmJiBzdGF0ZS5pc0VtcHR5KGxpbmUpKSB7XG4gICAgICBoYXNFbXB0eUxpbmVzID0gdHJ1ZTtcbiAgICAgIGxpbmUrKztcblxuICAgICAgLy8gdHdvIGVtcHR5IGxpbmVzIHNob3VsZCBzdG9wIHRoZSBwYXJzZXIgaW4gbGlzdCBtb2RlXG4gICAgICBpZiAobGluZSA8IGVuZExpbmUgJiYgc3RhdGUucGFyZW50VHlwZSA9PT0gJ2xpc3QnICYmIHN0YXRlLmlzRW1wdHkobGluZSkpIHsgYnJlYWs7IH1cbiAgICAgIHN0YXRlLmxpbmUgPSBsaW5lO1xuICAgIH1cbiAgfVxufTtcblxuXG4vKipcbiAqIFBhcnNlckJsb2NrLnBhcnNlKHN0ciwgbWQsIGVudiwgb3V0VG9rZW5zKVxuICpcbiAqIFByb2Nlc3MgaW5wdXQgc3RyaW5nIGFuZCBwdXNoIGJsb2NrIHRva2VucyBpbnRvIGBvdXRUb2tlbnNgXG4gKiovXG5QYXJzZXJCbG9jay5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbiAoc3JjLCBtZCwgZW52LCBvdXRUb2tlbnMpIHtcbiAgdmFyIHN0YXRlO1xuXG4gIGlmICghc3JjKSB7IHJldHVybiBbXTsgfVxuXG4gIHN0YXRlID0gbmV3IHRoaXMuU3RhdGUoc3JjLCBtZCwgZW52LCBvdXRUb2tlbnMpO1xuXG4gIHRoaXMudG9rZW5pemUoc3RhdGUsIHN0YXRlLmxpbmUsIHN0YXRlLmxpbmVNYXgpO1xufTtcblxuXG5QYXJzZXJCbG9jay5wcm90b3R5cGUuU3RhdGUgPSByZXF1aXJlKCcuL3J1bGVzX2Jsb2NrL3N0YXRlX2Jsb2NrJyk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBQYXJzZXJCbG9jaztcbiIsIi8qKiBpbnRlcm5hbFxuICogY2xhc3MgQ29yZVxuICpcbiAqIFRvcC1sZXZlbCBydWxlcyBleGVjdXRvci4gR2x1ZXMgYmxvY2svaW5saW5lIHBhcnNlcnMgYW5kIGRvZXMgaW50ZXJtZWRpYXRlXG4gKiB0cmFuc2Zvcm1hdGlvbnMuXG4gKiovXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIFJ1bGVyICA9IHJlcXVpcmUoJy4vcnVsZXInKTtcblxuXG52YXIgX3J1bGVzID0gW1xuICBbICdub3JtYWxpemUnLCAgICAgIHJlcXVpcmUoJy4vcnVsZXNfY29yZS9ub3JtYWxpemUnKSAgICAgIF0sXG4gIFsgJ2Jsb2NrJywgICAgICAgICAgcmVxdWlyZSgnLi9ydWxlc19jb3JlL2Jsb2NrJykgICAgICAgICAgXSxcbiAgWyAnaW5saW5lJywgICAgICAgICByZXF1aXJlKCcuL3J1bGVzX2NvcmUvaW5saW5lJykgICAgICAgICBdLFxuICBbICdsaW5raWZ5JywgICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfY29yZS9saW5raWZ5JykgICAgICAgIF0sXG4gIFsgJ3JlcGxhY2VtZW50cycsICAgcmVxdWlyZSgnLi9ydWxlc19jb3JlL3JlcGxhY2VtZW50cycpICAgXSxcbiAgWyAnc21hcnRxdW90ZXMnLCAgICByZXF1aXJlKCcuL3J1bGVzX2NvcmUvc21hcnRxdW90ZXMnKSAgICBdXG5dO1xuXG5cbi8qKlxuICogbmV3IENvcmUoKVxuICoqL1xuZnVuY3Rpb24gQ29yZSgpIHtcbiAgLyoqXG4gICAqIENvcmUjcnVsZXIgLT4gUnVsZXJcbiAgICpcbiAgICogW1tSdWxlcl1dIGluc3RhbmNlLiBLZWVwIGNvbmZpZ3VyYXRpb24gb2YgY29yZSBydWxlcy5cbiAgICoqL1xuICB0aGlzLnJ1bGVyID0gbmV3IFJ1bGVyKCk7XG5cbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBfcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICB0aGlzLnJ1bGVyLnB1c2goX3J1bGVzW2ldWzBdLCBfcnVsZXNbaV1bMV0pO1xuICB9XG59XG5cblxuLyoqXG4gKiBDb3JlLnByb2Nlc3Moc3RhdGUpXG4gKlxuICogRXhlY3V0ZXMgY29yZSBjaGFpbiBydWxlcy5cbiAqKi9cbkNvcmUucHJvdG90eXBlLnByb2Nlc3MgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIGksIGwsIHJ1bGVzO1xuXG4gIHJ1bGVzID0gdGhpcy5ydWxlci5nZXRSdWxlcygnJyk7XG5cbiAgZm9yIChpID0gMCwgbCA9IHJ1bGVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHJ1bGVzW2ldKHN0YXRlKTtcbiAgfVxufTtcblxuQ29yZS5wcm90b3R5cGUuU3RhdGUgPSByZXF1aXJlKCcuL3J1bGVzX2NvcmUvc3RhdGVfY29yZScpO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gQ29yZTtcbiIsIi8qKiBpbnRlcm5hbFxuICogY2xhc3MgUGFyc2VySW5saW5lXG4gKlxuICogVG9rZW5pemVzIHBhcmFncmFwaCBjb250ZW50LlxuICoqL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBSdWxlciAgICAgICAgICAgPSByZXF1aXJlKCcuL3J1bGVyJyk7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cbi8vIFBhcnNlciBydWxlc1xuXG52YXIgX3J1bGVzID0gW1xuICBbICd0ZXh0JywgICAgICAgICAgICByZXF1aXJlKCcuL3J1bGVzX2lubGluZS90ZXh0JykgXSxcbiAgWyAnbmV3bGluZScsICAgICAgICAgcmVxdWlyZSgnLi9ydWxlc19pbmxpbmUvbmV3bGluZScpIF0sXG4gIFsgJ2VzY2FwZScsICAgICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfaW5saW5lL2VzY2FwZScpIF0sXG4gIFsgJ2JhY2t0aWNrcycsICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfaW5saW5lL2JhY2t0aWNrcycpIF0sXG4gIFsgJ3N0cmlrZXRocm91Z2gnLCAgIHJlcXVpcmUoJy4vcnVsZXNfaW5saW5lL3N0cmlrZXRocm91Z2gnKSBdLFxuICBbICdlbXBoYXNpcycsICAgICAgICByZXF1aXJlKCcuL3J1bGVzX2lubGluZS9lbXBoYXNpcycpIF0sXG4gIFsgJ2xpbmsnLCAgICAgICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfaW5saW5lL2xpbmsnKSBdLFxuICBbICdpbWFnZScsICAgICAgICAgICByZXF1aXJlKCcuL3J1bGVzX2lubGluZS9pbWFnZScpIF0sXG4gIFsgJ2F1dG9saW5rJywgICAgICAgIHJlcXVpcmUoJy4vcnVsZXNfaW5saW5lL2F1dG9saW5rJykgXSxcbiAgWyAnaHRtbF9pbmxpbmUnLCAgICAgcmVxdWlyZSgnLi9ydWxlc19pbmxpbmUvaHRtbF9pbmxpbmUnKSBdLFxuICBbICdlbnRpdHknLCAgICAgICAgICByZXF1aXJlKCcuL3J1bGVzX2lubGluZS9lbnRpdHknKSBdXG5dO1xuXG5cbi8qKlxuICogbmV3IFBhcnNlcklubGluZSgpXG4gKiovXG5mdW5jdGlvbiBQYXJzZXJJbmxpbmUoKSB7XG4gIC8qKlxuICAgKiBQYXJzZXJJbmxpbmUjcnVsZXIgLT4gUnVsZXJcbiAgICpcbiAgICogW1tSdWxlcl1dIGluc3RhbmNlLiBLZWVwIGNvbmZpZ3VyYXRpb24gb2YgaW5saW5lIHJ1bGVzLlxuICAgKiovXG4gIHRoaXMucnVsZXIgPSBuZXcgUnVsZXIoKTtcblxuICBmb3IgKHZhciBpID0gMDsgaSA8IF9ydWxlcy5sZW5ndGg7IGkrKykge1xuICAgIHRoaXMucnVsZXIucHVzaChfcnVsZXNbaV1bMF0sIF9ydWxlc1tpXVsxXSk7XG4gIH1cbn1cblxuXG4vLyBTa2lwIHNpbmdsZSB0b2tlbiBieSBydW5uaW5nIGFsbCBydWxlcyBpbiB2YWxpZGF0aW9uIG1vZGU7XG4vLyByZXR1cm5zIGB0cnVlYCBpZiBhbnkgcnVsZSByZXBvcnRlZCBzdWNjZXNzXG4vL1xuUGFyc2VySW5saW5lLnByb3RvdHlwZS5za2lwVG9rZW4gPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIGksIHBvcyA9IHN0YXRlLnBvcyxcbiAgICAgIHJ1bGVzID0gdGhpcy5ydWxlci5nZXRSdWxlcygnJyksXG4gICAgICBsZW4gPSBydWxlcy5sZW5ndGgsXG4gICAgICBtYXhOZXN0aW5nID0gc3RhdGUubWQub3B0aW9ucy5tYXhOZXN0aW5nLFxuICAgICAgY2FjaGUgPSBzdGF0ZS5jYWNoZTtcblxuXG4gIGlmICh0eXBlb2YgY2FjaGVbcG9zXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzdGF0ZS5wb3MgPSBjYWNoZVtwb3NdO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIC8qaXN0YW5idWwgaWdub3JlIGVsc2UqL1xuICBpZiAoc3RhdGUubGV2ZWwgPCBtYXhOZXN0aW5nKSB7XG4gICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICBpZiAocnVsZXNbaV0oc3RhdGUsIHRydWUpKSB7XG4gICAgICAgIGNhY2hlW3Bvc10gPSBzdGF0ZS5wb3M7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBzdGF0ZS5wb3MrKztcbiAgY2FjaGVbcG9zXSA9IHN0YXRlLnBvcztcbn07XG5cblxuLy8gR2VuZXJhdGUgdG9rZW5zIGZvciBpbnB1dCByYW5nZVxuLy9cblBhcnNlcklubGluZS5wcm90b3R5cGUudG9rZW5pemUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgdmFyIG9rLCBpLFxuICAgICAgcnVsZXMgPSB0aGlzLnJ1bGVyLmdldFJ1bGVzKCcnKSxcbiAgICAgIGxlbiA9IHJ1bGVzLmxlbmd0aCxcbiAgICAgIGVuZCA9IHN0YXRlLnBvc01heCxcbiAgICAgIG1heE5lc3RpbmcgPSBzdGF0ZS5tZC5vcHRpb25zLm1heE5lc3Rpbmc7XG5cbiAgd2hpbGUgKHN0YXRlLnBvcyA8IGVuZCkge1xuICAgIC8vIFRyeSBhbGwgcG9zc2libGUgcnVsZXMuXG4gICAgLy8gT24gc3VjY2VzcywgcnVsZSBzaG91bGQ6XG4gICAgLy9cbiAgICAvLyAtIHVwZGF0ZSBgc3RhdGUucG9zYFxuICAgIC8vIC0gdXBkYXRlIGBzdGF0ZS50b2tlbnNgXG4gICAgLy8gLSByZXR1cm4gdHJ1ZVxuXG4gICAgaWYgKHN0YXRlLmxldmVsIDwgbWF4TmVzdGluZykge1xuICAgICAgZm9yIChpID0gMDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIG9rID0gcnVsZXNbaV0oc3RhdGUsIGZhbHNlKTtcbiAgICAgICAgaWYgKG9rKSB7IGJyZWFrOyB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG9rKSB7XG4gICAgICBpZiAoc3RhdGUucG9zID49IGVuZCkgeyBicmVhazsgfVxuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgc3RhdGUucGVuZGluZyArPSBzdGF0ZS5zcmNbc3RhdGUucG9zKytdO1xuICB9XG5cbiAgaWYgKHN0YXRlLnBlbmRpbmcpIHtcbiAgICBzdGF0ZS5wdXNoUGVuZGluZygpO1xuICB9XG59O1xuXG5cbi8qKlxuICogUGFyc2VySW5saW5lLnBhcnNlKHN0ciwgbWQsIGVudiwgb3V0VG9rZW5zKVxuICpcbiAqIFByb2Nlc3MgaW5wdXQgc3RyaW5nIGFuZCBwdXNoIGlubGluZSB0b2tlbnMgaW50byBgb3V0VG9rZW5zYFxuICoqL1xuUGFyc2VySW5saW5lLnByb3RvdHlwZS5wYXJzZSA9IGZ1bmN0aW9uIChzdHIsIG1kLCBlbnYsIG91dFRva2Vucykge1xuICB2YXIgc3RhdGUgPSBuZXcgdGhpcy5TdGF0ZShzdHIsIG1kLCBlbnYsIG91dFRva2Vucyk7XG5cbiAgdGhpcy50b2tlbml6ZShzdGF0ZSk7XG59O1xuXG5cblBhcnNlcklubGluZS5wcm90b3R5cGUuU3RhdGUgPSByZXF1aXJlKCcuL3J1bGVzX2lubGluZS9zdGF0ZV9pbmxpbmUnKTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnNlcklubGluZTtcbiIsIi8vIENvbW1vbm1hcmsgZGVmYXVsdCBvcHRpb25zXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgb3B0aW9uczoge1xuICAgIGh0bWw6ICAgICAgICAgdHJ1ZSwgICAgICAgICAvLyBFbmFibGUgSFRNTCB0YWdzIGluIHNvdXJjZVxuICAgIHhodG1sT3V0OiAgICAgdHJ1ZSwgICAgICAgICAvLyBVc2UgJy8nIHRvIGNsb3NlIHNpbmdsZSB0YWdzICg8YnIgLz4pXG4gICAgYnJlYWtzOiAgICAgICBmYWxzZSwgICAgICAgIC8vIENvbnZlcnQgJ1xcbicgaW4gcGFyYWdyYXBocyBpbnRvIDxicj5cbiAgICBsYW5nUHJlZml4OiAgICdsYW5ndWFnZS0nLCAgLy8gQ1NTIGxhbmd1YWdlIHByZWZpeCBmb3IgZmVuY2VkIGJsb2Nrc1xuICAgIGxpbmtpZnk6ICAgICAgZmFsc2UsICAgICAgICAvLyBhdXRvY29udmVydCBVUkwtbGlrZSB0ZXh0cyB0byBsaW5rc1xuXG4gICAgLy8gRW5hYmxlIHNvbWUgbGFuZ3VhZ2UtbmV1dHJhbCByZXBsYWNlbWVudHMgKyBxdW90ZXMgYmVhdXRpZmljYXRpb25cbiAgICB0eXBvZ3JhcGhlcjogIGZhbHNlLFxuXG4gICAgLy8gRG91YmxlICsgc2luZ2xlIHF1b3RlcyByZXBsYWNlbWVudCBwYWlycywgd2hlbiB0eXBvZ3JhcGhlciBlbmFibGVkLFxuICAgIC8vIGFuZCBzbWFydHF1b3RlcyBvbi4gQ291bGQgYmUgZWl0aGVyIGEgU3RyaW5nIG9yIGFuIEFycmF5LlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGUsIHlvdSBjYW4gdXNlICfCq8K74oCe4oCcJyBmb3IgUnVzc2lhbiwgJ+KAnuKAnOKAmuKAmCcgZm9yIEdlcm1hbixcbiAgICAvLyBhbmQgWyfCq1xceEEwJywgJ1xceEEwwrsnLCAn4oC5XFx4QTAnLCAnXFx4QTDigLonXSBmb3IgRnJlbmNoIChpbmNsdWRpbmcgbmJzcCkuXG4gICAgcXVvdGVzOiAnXFx1MjAxY1xcdTIwMWRcXHUyMDE4XFx1MjAxOScgLyog4oCc4oCd4oCY4oCZICovLFxuXG4gICAgLy8gSGlnaGxpZ2h0ZXIgZnVuY3Rpb24uIFNob3VsZCByZXR1cm4gZXNjYXBlZCBIVE1MLFxuICAgIC8vIG9yICcnIGlmIGlucHV0IG5vdCBjaGFuZ2VkXG4gICAgLy9cbiAgICAvLyBmdW5jdGlvbiAoLypzdHIsIGxhbmcqLykgeyByZXR1cm4gJyc7IH1cbiAgICAvL1xuICAgIGhpZ2hsaWdodDogbnVsbCxcblxuICAgIG1heE5lc3Rpbmc6ICAgMjAgICAgICAgICAgICAvLyBJbnRlcm5hbCBwcm90ZWN0aW9uLCByZWN1cnNpb24gbGltaXRcbiAgfSxcblxuICBjb21wb25lbnRzOiB7XG5cbiAgICBjb3JlOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICAnbm9ybWFsaXplJyxcbiAgICAgICAgJ2Jsb2NrJyxcbiAgICAgICAgJ2lubGluZSdcbiAgICAgIF1cbiAgICB9LFxuXG4gICAgYmxvY2s6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgICdibG9ja3F1b3RlJyxcbiAgICAgICAgJ2NvZGUnLFxuICAgICAgICAnZmVuY2UnLFxuICAgICAgICAnaGVhZGluZycsXG4gICAgICAgICdocicsXG4gICAgICAgICdodG1sX2Jsb2NrJyxcbiAgICAgICAgJ2xoZWFkaW5nJyxcbiAgICAgICAgJ2xpc3QnLFxuICAgICAgICAncmVmZXJlbmNlJyxcbiAgICAgICAgJ3BhcmFncmFwaCdcbiAgICAgIF1cbiAgICB9LFxuXG4gICAgaW5saW5lOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICAnYXV0b2xpbmsnLFxuICAgICAgICAnYmFja3RpY2tzJyxcbiAgICAgICAgJ2VtcGhhc2lzJyxcbiAgICAgICAgJ2VudGl0eScsXG4gICAgICAgICdlc2NhcGUnLFxuICAgICAgICAnaHRtbF9pbmxpbmUnLFxuICAgICAgICAnaW1hZ2UnLFxuICAgICAgICAnbGluaycsXG4gICAgICAgICduZXdsaW5lJyxcbiAgICAgICAgJ3RleHQnXG4gICAgICBdXG4gICAgfVxuICB9XG59O1xuIiwiLy8gbWFya2Rvd24taXQgZGVmYXVsdCBvcHRpb25zXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgb3B0aW9uczoge1xuICAgIGh0bWw6ICAgICAgICAgZmFsc2UsICAgICAgICAvLyBFbmFibGUgSFRNTCB0YWdzIGluIHNvdXJjZVxuICAgIHhodG1sT3V0OiAgICAgZmFsc2UsICAgICAgICAvLyBVc2UgJy8nIHRvIGNsb3NlIHNpbmdsZSB0YWdzICg8YnIgLz4pXG4gICAgYnJlYWtzOiAgICAgICBmYWxzZSwgICAgICAgIC8vIENvbnZlcnQgJ1xcbicgaW4gcGFyYWdyYXBocyBpbnRvIDxicj5cbiAgICBsYW5nUHJlZml4OiAgICdsYW5ndWFnZS0nLCAgLy8gQ1NTIGxhbmd1YWdlIHByZWZpeCBmb3IgZmVuY2VkIGJsb2Nrc1xuICAgIGxpbmtpZnk6ICAgICAgZmFsc2UsICAgICAgICAvLyBhdXRvY29udmVydCBVUkwtbGlrZSB0ZXh0cyB0byBsaW5rc1xuXG4gICAgLy8gRW5hYmxlIHNvbWUgbGFuZ3VhZ2UtbmV1dHJhbCByZXBsYWNlbWVudHMgKyBxdW90ZXMgYmVhdXRpZmljYXRpb25cbiAgICB0eXBvZ3JhcGhlcjogIGZhbHNlLFxuXG4gICAgLy8gRG91YmxlICsgc2luZ2xlIHF1b3RlcyByZXBsYWNlbWVudCBwYWlycywgd2hlbiB0eXBvZ3JhcGhlciBlbmFibGVkLFxuICAgIC8vIGFuZCBzbWFydHF1b3RlcyBvbi4gQ291bGQgYmUgZWl0aGVyIGEgU3RyaW5nIG9yIGFuIEFycmF5LlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGUsIHlvdSBjYW4gdXNlICfCq8K74oCe4oCcJyBmb3IgUnVzc2lhbiwgJ+KAnuKAnOKAmuKAmCcgZm9yIEdlcm1hbixcbiAgICAvLyBhbmQgWyfCq1xceEEwJywgJ1xceEEwwrsnLCAn4oC5XFx4QTAnLCAnXFx4QTDigLonXSBmb3IgRnJlbmNoIChpbmNsdWRpbmcgbmJzcCkuXG4gICAgcXVvdGVzOiAnXFx1MjAxY1xcdTIwMWRcXHUyMDE4XFx1MjAxOScgLyog4oCc4oCd4oCY4oCZICovLFxuXG4gICAgLy8gSGlnaGxpZ2h0ZXIgZnVuY3Rpb24uIFNob3VsZCByZXR1cm4gZXNjYXBlZCBIVE1MLFxuICAgIC8vIG9yICcnIGlmIGlucHV0IG5vdCBjaGFuZ2VkXG4gICAgLy9cbiAgICAvLyBmdW5jdGlvbiAoLypzdHIsIGxhbmcqLykgeyByZXR1cm4gJyc7IH1cbiAgICAvL1xuICAgIGhpZ2hsaWdodDogbnVsbCxcblxuICAgIG1heE5lc3Rpbmc6ICAgMjAgICAgICAgICAgICAvLyBJbnRlcm5hbCBwcm90ZWN0aW9uLCByZWN1cnNpb24gbGltaXRcbiAgfSxcblxuICBjb21wb25lbnRzOiB7XG5cbiAgICBjb3JlOiB7fSxcbiAgICBibG9jazoge30sXG4gICAgaW5saW5lOiB7fVxuICB9XG59O1xuIiwiLy8gXCJaZXJvXCIgcHJlc2V0LCB3aXRoIG5vdGhpbmcgZW5hYmxlZC4gVXNlZnVsIGZvciBtYW51YWwgY29uZmlndXJpbmcgb2Ygc2ltcGxlXG4vLyBtb2Rlcy4gRm9yIGV4YW1wbGUsIHRvIHBhcnNlIGJvbGQvaXRhbGljIG9ubHkuXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgb3B0aW9uczoge1xuICAgIGh0bWw6ICAgICAgICAgZmFsc2UsICAgICAgICAvLyBFbmFibGUgSFRNTCB0YWdzIGluIHNvdXJjZVxuICAgIHhodG1sT3V0OiAgICAgZmFsc2UsICAgICAgICAvLyBVc2UgJy8nIHRvIGNsb3NlIHNpbmdsZSB0YWdzICg8YnIgLz4pXG4gICAgYnJlYWtzOiAgICAgICBmYWxzZSwgICAgICAgIC8vIENvbnZlcnQgJ1xcbicgaW4gcGFyYWdyYXBocyBpbnRvIDxicj5cbiAgICBsYW5nUHJlZml4OiAgICdsYW5ndWFnZS0nLCAgLy8gQ1NTIGxhbmd1YWdlIHByZWZpeCBmb3IgZmVuY2VkIGJsb2Nrc1xuICAgIGxpbmtpZnk6ICAgICAgZmFsc2UsICAgICAgICAvLyBhdXRvY29udmVydCBVUkwtbGlrZSB0ZXh0cyB0byBsaW5rc1xuXG4gICAgLy8gRW5hYmxlIHNvbWUgbGFuZ3VhZ2UtbmV1dHJhbCByZXBsYWNlbWVudHMgKyBxdW90ZXMgYmVhdXRpZmljYXRpb25cbiAgICB0eXBvZ3JhcGhlcjogIGZhbHNlLFxuXG4gICAgLy8gRG91YmxlICsgc2luZ2xlIHF1b3RlcyByZXBsYWNlbWVudCBwYWlycywgd2hlbiB0eXBvZ3JhcGhlciBlbmFibGVkLFxuICAgIC8vIGFuZCBzbWFydHF1b3RlcyBvbi4gQ291bGQgYmUgZWl0aGVyIGEgU3RyaW5nIG9yIGFuIEFycmF5LlxuICAgIC8vXG4gICAgLy8gRm9yIGV4YW1wbGUsIHlvdSBjYW4gdXNlICfCq8K74oCe4oCcJyBmb3IgUnVzc2lhbiwgJ+KAnuKAnOKAmuKAmCcgZm9yIEdlcm1hbixcbiAgICAvLyBhbmQgWyfCq1xceEEwJywgJ1xceEEwwrsnLCAn4oC5XFx4QTAnLCAnXFx4QTDigLonXSBmb3IgRnJlbmNoIChpbmNsdWRpbmcgbmJzcCkuXG4gICAgcXVvdGVzOiAnXFx1MjAxY1xcdTIwMWRcXHUyMDE4XFx1MjAxOScgLyog4oCc4oCd4oCY4oCZICovLFxuXG4gICAgLy8gSGlnaGxpZ2h0ZXIgZnVuY3Rpb24uIFNob3VsZCByZXR1cm4gZXNjYXBlZCBIVE1MLFxuICAgIC8vIG9yICcnIGlmIGlucHV0IG5vdCBjaGFuZ2VkXG4gICAgLy9cbiAgICAvLyBmdW5jdGlvbiAoLypzdHIsIGxhbmcqLykgeyByZXR1cm4gJyc7IH1cbiAgICAvL1xuICAgIGhpZ2hsaWdodDogbnVsbCxcblxuICAgIG1heE5lc3Rpbmc6ICAgMjAgICAgICAgICAgICAvLyBJbnRlcm5hbCBwcm90ZWN0aW9uLCByZWN1cnNpb24gbGltaXRcbiAgfSxcblxuICBjb21wb25lbnRzOiB7XG5cbiAgICBjb3JlOiB7XG4gICAgICBydWxlczogW1xuICAgICAgICAnbm9ybWFsaXplJyxcbiAgICAgICAgJ2Jsb2NrJyxcbiAgICAgICAgJ2lubGluZSdcbiAgICAgIF1cbiAgICB9LFxuXG4gICAgYmxvY2s6IHtcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgICdwYXJhZ3JhcGgnXG4gICAgICBdXG4gICAgfSxcblxuICAgIGlubGluZToge1xuICAgICAgcnVsZXM6IFtcbiAgICAgICAgJ3RleHQnXG4gICAgICBdXG4gICAgfVxuICB9XG59O1xuIiwiLyoqXG4gKiBjbGFzcyBSZW5kZXJlclxuICpcbiAqIEdlbmVyYXRlcyBIVE1MIGZyb20gcGFyc2VkIHRva2VuIHN0cmVhbS4gRWFjaCBpbnN0YW5jZSBoYXMgaW5kZXBlbmRlbnRcbiAqIGNvcHkgb2YgcnVsZXMuIFRob3NlIGNhbiBiZSByZXdyaXR0ZW4gd2l0aCBlYXNlLiBBbHNvLCB5b3UgY2FuIGFkZCBuZXdcbiAqIHJ1bGVzIGlmIHlvdSBjcmVhdGUgcGx1Z2luIGFuZCBhZGRzIG5ldyB0b2tlbiB0eXBlcy5cbiAqKi9cbid1c2Ugc3RyaWN0JztcblxuXG52YXIgYXNzaWduICAgICAgICAgID0gcmVxdWlyZSgnLi9jb21tb24vdXRpbHMnKS5hc3NpZ247XG52YXIgdW5lc2NhcGVBbGwgICAgID0gcmVxdWlyZSgnLi9jb21tb24vdXRpbHMnKS51bmVzY2FwZUFsbDtcbnZhciBlc2NhcGVIdG1sICAgICAgPSByZXF1aXJlKCcuL2NvbW1vbi91dGlscycpLmVzY2FwZUh0bWw7XG5cblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxudmFyIGRlZmF1bHRfcnVsZXMgPSB7fTtcblxuXG5kZWZhdWx0X3J1bGVzLmNvZGVfaW5saW5lID0gZnVuY3Rpb24gKHRva2VucywgaWR4IC8qLCBvcHRpb25zLCBlbnYgKi8pIHtcbiAgcmV0dXJuICc8Y29kZT4nICsgZXNjYXBlSHRtbCh0b2tlbnNbaWR4XS5jb250ZW50KSArICc8L2NvZGU+Jztcbn07XG5cblxuZGVmYXVsdF9ydWxlcy5jb2RlX2Jsb2NrID0gZnVuY3Rpb24gKHRva2VucywgaWR4IC8qLCBvcHRpb25zLCBlbnYgKi8pIHtcbiAgcmV0dXJuICc8cHJlPjxjb2RlPicgKyBlc2NhcGVIdG1sKHRva2Vuc1tpZHhdLmNvbnRlbnQpICsgJzwvY29kZT48L3ByZT5cXG4nO1xufTtcblxuXG5kZWZhdWx0X3J1bGVzLmZlbmNlID0gZnVuY3Rpb24gKHRva2VucywgaWR4LCBvcHRpb25zLCBlbnYsIHNlbGYpIHtcbiAgdmFyIHRva2VuID0gdG9rZW5zW2lkeF0sXG4gICAgICBpbmZvID0gdG9rZW4uaW5mbyA/IHVuZXNjYXBlQWxsKHRva2VuLmluZm8pLnRyaW0oKSA6ICcnLFxuICAgICAgbGFuZ05hbWUgPSAnJyxcbiAgICAgIGhpZ2hsaWdodGVkO1xuXG4gIGlmIChpbmZvKSB7XG4gICAgbGFuZ05hbWUgPSBpbmZvLnNwbGl0KC9cXHMrL2cpWzBdO1xuICAgIHRva2VuLmF0dHJQdXNoKFsgJ2NsYXNzJywgb3B0aW9ucy5sYW5nUHJlZml4ICsgbGFuZ05hbWUgXSk7XG4gIH1cblxuICBpZiAob3B0aW9ucy5oaWdobGlnaHQpIHtcbiAgICBoaWdobGlnaHRlZCA9IG9wdGlvbnMuaGlnaGxpZ2h0KHRva2VuLmNvbnRlbnQsIGxhbmdOYW1lKSB8fCBlc2NhcGVIdG1sKHRva2VuLmNvbnRlbnQpO1xuICB9IGVsc2Uge1xuICAgIGhpZ2hsaWdodGVkID0gZXNjYXBlSHRtbCh0b2tlbi5jb250ZW50KTtcbiAgfVxuXG4gIHJldHVybiAgJzxwcmU+PGNvZGUnICsgc2VsZi5yZW5kZXJBdHRycyh0b2tlbikgKyAnPidcbiAgICAgICAgKyBoaWdobGlnaHRlZFxuICAgICAgICArICc8L2NvZGU+PC9wcmU+XFxuJztcbn07XG5cblxuZGVmYXVsdF9ydWxlcy5pbWFnZSA9IGZ1bmN0aW9uICh0b2tlbnMsIGlkeCwgb3B0aW9ucywgZW52LCBzZWxmKSB7XG4gIHZhciB0b2tlbiA9IHRva2Vuc1tpZHhdO1xuXG4gIC8vIFwiYWx0XCIgYXR0ciBNVVNUIGJlIHNldCwgZXZlbiBpZiBlbXB0eS4gQmVjYXVzZSBpdCdzIG1hbmRhdG9yeSBhbmRcbiAgLy8gc2hvdWxkIGJlIHBsYWNlZCBvbiBwcm9wZXIgcG9zaXRpb24gZm9yIHRlc3RzLlxuICAvL1xuICAvLyBSZXBsYWNlIGNvbnRlbnQgd2l0aCBhY3R1YWwgdmFsdWVcblxuICB0b2tlbi5hdHRyc1t0b2tlbi5hdHRySW5kZXgoJ2FsdCcpXVsxXSA9XG4gICAgc2VsZi5yZW5kZXJJbmxpbmVBc1RleHQodG9rZW4uY2hpbGRyZW4sIG9wdGlvbnMsIGVudik7XG5cbiAgcmV0dXJuIHNlbGYucmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdGlvbnMpO1xufTtcblxuXG5kZWZhdWx0X3J1bGVzLmhhcmRicmVhayA9IGZ1bmN0aW9uICh0b2tlbnMsIGlkeCwgb3B0aW9ucyAvKiwgZW52ICovKSB7XG4gIHJldHVybiBvcHRpb25zLnhodG1sT3V0ID8gJzxiciAvPlxcbicgOiAnPGJyPlxcbic7XG59O1xuZGVmYXVsdF9ydWxlcy5zb2Z0YnJlYWsgPSBmdW5jdGlvbiAodG9rZW5zLCBpZHgsIG9wdGlvbnMgLyosIGVudiAqLykge1xuICByZXR1cm4gb3B0aW9ucy5icmVha3MgPyAob3B0aW9ucy54aHRtbE91dCA/ICc8YnIgLz5cXG4nIDogJzxicj5cXG4nKSA6ICdcXG4nO1xufTtcblxuXG5kZWZhdWx0X3J1bGVzLnRleHQgPSBmdW5jdGlvbiAodG9rZW5zLCBpZHggLyosIG9wdGlvbnMsIGVudiAqLykge1xuICByZXR1cm4gZXNjYXBlSHRtbCh0b2tlbnNbaWR4XS5jb250ZW50KTtcbn07XG5cblxuZGVmYXVsdF9ydWxlcy5odG1sX2Jsb2NrID0gZnVuY3Rpb24gKHRva2VucywgaWR4IC8qLCBvcHRpb25zLCBlbnYgKi8pIHtcbiAgcmV0dXJuIHRva2Vuc1tpZHhdLmNvbnRlbnQ7XG59O1xuZGVmYXVsdF9ydWxlcy5odG1sX2lubGluZSA9IGZ1bmN0aW9uICh0b2tlbnMsIGlkeCAvKiwgb3B0aW9ucywgZW52ICovKSB7XG4gIHJldHVybiB0b2tlbnNbaWR4XS5jb250ZW50O1xufTtcblxuXG4vKipcbiAqIG5ldyBSZW5kZXJlcigpXG4gKlxuICogQ3JlYXRlcyBuZXcgW1tSZW5kZXJlcl1dIGluc3RhbmNlIGFuZCBmaWxsIFtbUmVuZGVyZXIjcnVsZXNdXSB3aXRoIGRlZmF1bHRzLlxuICoqL1xuZnVuY3Rpb24gUmVuZGVyZXIoKSB7XG5cbiAgLyoqXG4gICAqIFJlbmRlcmVyI3J1bGVzIC0+IE9iamVjdFxuICAgKlxuICAgKiBDb250YWlucyByZW5kZXIgcnVsZXMgZm9yIHRva2Vucy4gQ2FuIGJlIHVwZGF0ZWQgYW5kIGV4dGVuZGVkLlxuICAgKlxuICAgKiAjIyMjIyBFeGFtcGxlXG4gICAqXG4gICAqIGBgYGphdmFzY3JpcHRcbiAgICogdmFyIG1kID0gcmVxdWlyZSgnbWFya2Rvd24taXQnKSgpO1xuICAgKlxuICAgKiBtZC5yZW5kZXJlci5ydWxlcy5zdHJvbmdfb3BlbiAgPSBmdW5jdGlvbiAoKSB7IHJldHVybiAnPGI+JzsgfTtcbiAgICogbWQucmVuZGVyZXIucnVsZXMuc3Ryb25nX2Nsb3NlID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJzwvYj4nOyB9O1xuICAgKlxuICAgKiB2YXIgcmVzdWx0ID0gbWQucmVuZGVySW5saW5lKC4uLik7XG4gICAqIGBgYFxuICAgKlxuICAgKiBFYWNoIHJ1bGUgaXMgY2FsbGVkIGFzIGluZGVwZW5kZWQgc3RhdGljIGZ1bmN0aW9uIHdpdGggZml4ZWQgc2lnbmF0dXJlOlxuICAgKlxuICAgKiBgYGBqYXZhc2NyaXB0XG4gICAqIGZ1bmN0aW9uIG15X3Rva2VuX3JlbmRlcih0b2tlbnMsIGlkeCwgb3B0aW9ucywgZW52LCByZW5kZXJlcikge1xuICAgKiAgIC8vIC4uLlxuICAgKiAgIHJldHVybiByZW5kZXJlZEhUTUw7XG4gICAqIH1cbiAgICogYGBgXG4gICAqXG4gICAqIFNlZSBbc291cmNlIGNvZGVdKGh0dHBzOi8vZ2l0aHViLmNvbS9tYXJrZG93bi1pdC9tYXJrZG93bi1pdC9ibG9iL21hc3Rlci9saWIvcmVuZGVyZXIuanMpXG4gICAqIGZvciBtb3JlIGRldGFpbHMgYW5kIGV4YW1wbGVzLlxuICAgKiovXG4gIHRoaXMucnVsZXMgPSBhc3NpZ24oe30sIGRlZmF1bHRfcnVsZXMpO1xufVxuXG5cbi8qKlxuICogUmVuZGVyZXIucmVuZGVyQXR0cnModG9rZW4pIC0+IFN0cmluZ1xuICpcbiAqIFJlbmRlciB0b2tlbiBhdHRyaWJ1dGVzIHRvIHN0cmluZy5cbiAqKi9cblJlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXJBdHRycyA9IGZ1bmN0aW9uIHJlbmRlckF0dHJzKHRva2VuKSB7XG4gIHZhciBpLCBsLCByZXN1bHQ7XG5cbiAgaWYgKCF0b2tlbi5hdHRycykgeyByZXR1cm4gJyc7IH1cblxuICByZXN1bHQgPSAnJztcblxuICBmb3IgKGkgPSAwLCBsID0gdG9rZW4uYXR0cnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgcmVzdWx0ICs9ICcgJyArIGVzY2FwZUh0bWwodG9rZW4uYXR0cnNbaV1bMF0pICsgJz1cIicgKyBlc2NhcGVIdG1sKHRva2VuLmF0dHJzW2ldWzFdKSArICdcIic7XG4gIH1cblxuICByZXR1cm4gcmVzdWx0O1xufTtcblxuXG4vKipcbiAqIFJlbmRlcmVyLnJlbmRlclRva2VuKHRva2VucywgaWR4LCBvcHRpb25zKSAtPiBTdHJpbmdcbiAqIC0gdG9rZW5zIChBcnJheSk6IGxpc3Qgb2YgdG9rZW5zXG4gKiAtIGlkeCAoTnVtYmVkKTogdG9rZW4gaW5kZXggdG8gcmVuZGVyXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHBhcmFtcyBvZiBwYXJzZXIgaW5zdGFuY2VcbiAqXG4gKiBEZWZhdWx0IHRva2VuIHJlbmRlcmVyLiBDYW4gYmUgb3ZlcnJpZGVuIGJ5IGN1c3RvbSBmdW5jdGlvblxuICogaW4gW1tSZW5kZXJlciNydWxlc11dLlxuICoqL1xuUmVuZGVyZXIucHJvdG90eXBlLnJlbmRlclRva2VuID0gZnVuY3Rpb24gcmVuZGVyVG9rZW4odG9rZW5zLCBpZHgsIG9wdGlvbnMpIHtcbiAgdmFyIG5leHRUb2tlbixcbiAgICAgIHJlc3VsdCA9ICcnLFxuICAgICAgbmVlZExmID0gZmFsc2UsXG4gICAgICB0b2tlbiA9IHRva2Vuc1tpZHhdO1xuXG4gIC8vIFRpZ2h0IGxpc3QgcGFyYWdyYXBoc1xuICBpZiAodG9rZW4uaGlkZGVuKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgLy8gSW5zZXJ0IGEgbmV3bGluZSBiZXR3ZWVuIGhpZGRlbiBwYXJhZ3JhcGggYW5kIHN1YnNlcXVlbnQgb3BlbmluZ1xuICAvLyBibG9jay1sZXZlbCB0YWcuXG4gIC8vXG4gIC8vIEZvciBleGFtcGxlLCBoZXJlIHdlIHNob3VsZCBpbnNlcnQgYSBuZXdsaW5lIGJlZm9yZSBibG9ja3F1b3RlOlxuICAvLyAgLSBhXG4gIC8vICAgID5cbiAgLy9cbiAgaWYgKHRva2VuLmJsb2NrICYmIHRva2VuLm5lc3RpbmcgIT09IC0xICYmIGlkeCAmJiB0b2tlbnNbaWR4IC0gMV0uaGlkZGVuKSB7XG4gICAgcmVzdWx0ICs9ICdcXG4nO1xuICB9XG5cbiAgLy8gQWRkIHRva2VuIG5hbWUsIGUuZy4gYDxpbWdgXG4gIHJlc3VsdCArPSAodG9rZW4ubmVzdGluZyA9PT0gLTEgPyAnPC8nIDogJzwnKSArIHRva2VuLnRhZztcblxuICAvLyBFbmNvZGUgYXR0cmlidXRlcywgZS5nLiBgPGltZyBzcmM9XCJmb29cImBcbiAgcmVzdWx0ICs9IHRoaXMucmVuZGVyQXR0cnModG9rZW4pO1xuXG4gIC8vIEFkZCBhIHNsYXNoIGZvciBzZWxmLWNsb3NpbmcgdGFncywgZS5nLiBgPGltZyBzcmM9XCJmb29cIiAvYFxuICBpZiAodG9rZW4ubmVzdGluZyA9PT0gMCAmJiBvcHRpb25zLnhodG1sT3V0KSB7XG4gICAgcmVzdWx0ICs9ICcgLyc7XG4gIH1cblxuICAvLyBDaGVjayBpZiB3ZSBuZWVkIHRvIGFkZCBhIG5ld2xpbmUgYWZ0ZXIgdGhpcyB0YWdcbiAgaWYgKHRva2VuLmJsb2NrKSB7XG4gICAgbmVlZExmID0gdHJ1ZTtcblxuICAgIGlmICh0b2tlbi5uZXN0aW5nID09PSAxKSB7XG4gICAgICBpZiAoaWR4ICsgMSA8IHRva2Vucy5sZW5ndGgpIHtcbiAgICAgICAgbmV4dFRva2VuID0gdG9rZW5zW2lkeCArIDFdO1xuXG4gICAgICAgIGlmIChuZXh0VG9rZW4udHlwZSA9PT0gJ2lubGluZScgfHwgbmV4dFRva2VuLmhpZGRlbikge1xuICAgICAgICAgIC8vIEJsb2NrLWxldmVsIHRhZyBjb250YWluaW5nIGFuIGlubGluZSB0YWcuXG4gICAgICAgICAgLy9cbiAgICAgICAgICBuZWVkTGYgPSBmYWxzZTtcblxuICAgICAgICB9IGVsc2UgaWYgKG5leHRUb2tlbi5uZXN0aW5nID09PSAtMSAmJiBuZXh0VG9rZW4udGFnID09PSB0b2tlbi50YWcpIHtcbiAgICAgICAgICAvLyBPcGVuaW5nIHRhZyArIGNsb3NpbmcgdGFnIG9mIHRoZSBzYW1lIHR5cGUuIEUuZy4gYDxsaT48L2xpPmAuXG4gICAgICAgICAgLy9cbiAgICAgICAgICBuZWVkTGYgPSBmYWxzZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJlc3VsdCArPSBuZWVkTGYgPyAnPlxcbicgOiAnPic7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuLyoqXG4gKiBSZW5kZXJlci5yZW5kZXJJbmxpbmUodG9rZW5zLCBvcHRpb25zLCBlbnYpIC0+IFN0cmluZ1xuICogLSB0b2tlbnMgKEFycmF5KTogbGlzdCBvbiBibG9jayB0b2tlbnMgdG8gcmVudGVyXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHBhcmFtcyBvZiBwYXJzZXIgaW5zdGFuY2VcbiAqIC0gZW52IChPYmplY3QpOiBhZGRpdGlvbmFsIGRhdGEgZnJvbSBwYXJzZWQgaW5wdXQgKHJlZmVyZW5jZXMsIGZvciBleGFtcGxlKVxuICpcbiAqIFRoZSBzYW1lIGFzIFtbUmVuZGVyZXIucmVuZGVyXV0sIGJ1dCBmb3Igc2luZ2xlIHRva2VuIG9mIGBpbmxpbmVgIHR5cGUuXG4gKiovXG5SZW5kZXJlci5wcm90b3R5cGUucmVuZGVySW5saW5lID0gZnVuY3Rpb24gKHRva2Vucywgb3B0aW9ucywgZW52KSB7XG4gIHZhciB0eXBlLFxuICAgICAgcmVzdWx0ID0gJycsXG4gICAgICBydWxlcyA9IHRoaXMucnVsZXM7XG5cbiAgZm9yICh2YXIgaSA9IDAsIGxlbiA9IHRva2Vucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHR5cGUgPSB0b2tlbnNbaV0udHlwZTtcblxuICAgIGlmICh0eXBlb2YgcnVsZXNbdHlwZV0gIT09ICd1bmRlZmluZWQnKSB7XG4gICAgICByZXN1bHQgKz0gcnVsZXNbdHlwZV0odG9rZW5zLCBpLCBvcHRpb25zLCBlbnYsIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5yZW5kZXJUb2tlbih0b2tlbnMsIGksIG9wdGlvbnMpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5cbi8qKiBpbnRlcm5hbFxuICogUmVuZGVyZXIucmVuZGVySW5saW5lQXNUZXh0KHRva2Vucywgb3B0aW9ucywgZW52KSAtPiBTdHJpbmdcbiAqIC0gdG9rZW5zIChBcnJheSk6IGxpc3Qgb24gYmxvY2sgdG9rZW5zIHRvIHJlbnRlclxuICogLSBvcHRpb25zIChPYmplY3QpOiBwYXJhbXMgb2YgcGFyc2VyIGluc3RhbmNlXG4gKiAtIGVudiAoT2JqZWN0KTogYWRkaXRpb25hbCBkYXRhIGZyb20gcGFyc2VkIGlucHV0IChyZWZlcmVuY2VzLCBmb3IgZXhhbXBsZSlcbiAqXG4gKiBTcGVjaWFsIGtsdWRnZSBmb3IgaW1hZ2UgYGFsdGAgYXR0cmlidXRlcyB0byBjb25mb3JtIENvbW1vbk1hcmsgc3BlYy5cbiAqIERvbid0IHRyeSB0byB1c2UgaXQhIFNwZWMgcmVxdWlyZXMgdG8gc2hvdyBgYWx0YCBjb250ZW50IHdpdGggc3RyaXBwZWQgbWFya3VwLFxuICogaW5zdGVhZCBvZiBzaW1wbGUgZXNjYXBpbmcuXG4gKiovXG5SZW5kZXJlci5wcm90b3R5cGUucmVuZGVySW5saW5lQXNUZXh0ID0gZnVuY3Rpb24gKHRva2Vucywgb3B0aW9ucywgZW52KSB7XG4gIHZhciByZXN1bHQgPSAnJyxcbiAgICAgIHJ1bGVzID0gdGhpcy5ydWxlcztcblxuICBmb3IgKHZhciBpID0gMCwgbGVuID0gdG9rZW5zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgaWYgKHRva2Vuc1tpXS50eXBlID09PSAndGV4dCcpIHtcbiAgICAgIHJlc3VsdCArPSBydWxlcy50ZXh0KHRva2VucywgaSwgb3B0aW9ucywgZW52LCB0aGlzKTtcbiAgICB9IGVsc2UgaWYgKHRva2Vuc1tpXS50eXBlID09PSAnaW1hZ2UnKSB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5yZW5kZXJJbmxpbmVBc1RleHQodG9rZW5zW2ldLmNoaWxkcmVuLCBvcHRpb25zLCBlbnYpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuXG5cbi8qKlxuICogUmVuZGVyZXIucmVuZGVyKHRva2Vucywgb3B0aW9ucywgZW52KSAtPiBTdHJpbmdcbiAqIC0gdG9rZW5zIChBcnJheSk6IGxpc3Qgb24gYmxvY2sgdG9rZW5zIHRvIHJlbnRlclxuICogLSBvcHRpb25zIChPYmplY3QpOiBwYXJhbXMgb2YgcGFyc2VyIGluc3RhbmNlXG4gKiAtIGVudiAoT2JqZWN0KTogYWRkaXRpb25hbCBkYXRhIGZyb20gcGFyc2VkIGlucHV0IChyZWZlcmVuY2VzLCBmb3IgZXhhbXBsZSlcbiAqXG4gKiBUYWtlcyB0b2tlbiBzdHJlYW0gYW5kIGdlbmVyYXRlcyBIVE1MLiBQcm9iYWJseSwgeW91IHdpbGwgbmV2ZXIgbmVlZCB0byBjYWxsXG4gKiB0aGlzIG1ldGhvZCBkaXJlY3RseS5cbiAqKi9cblJlbmRlcmVyLnByb3RvdHlwZS5yZW5kZXIgPSBmdW5jdGlvbiAodG9rZW5zLCBvcHRpb25zLCBlbnYpIHtcbiAgdmFyIGksIGxlbiwgdHlwZSxcbiAgICAgIHJlc3VsdCA9ICcnLFxuICAgICAgcnVsZXMgPSB0aGlzLnJ1bGVzO1xuXG4gIGZvciAoaSA9IDAsIGxlbiA9IHRva2Vucy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgIHR5cGUgPSB0b2tlbnNbaV0udHlwZTtcblxuICAgIGlmICh0eXBlID09PSAnaW5saW5lJykge1xuICAgICAgcmVzdWx0ICs9IHRoaXMucmVuZGVySW5saW5lKHRva2Vuc1tpXS5jaGlsZHJlbiwgb3B0aW9ucywgZW52KTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBydWxlc1t0eXBlXSAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICAgIHJlc3VsdCArPSBydWxlc1t0b2tlbnNbaV0udHlwZV0odG9rZW5zLCBpLCBvcHRpb25zLCBlbnYsIHRoaXMpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQgKz0gdGhpcy5yZW5kZXJUb2tlbih0b2tlbnMsIGksIG9wdGlvbnMsIGVudik7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gUmVuZGVyZXI7XG4iLCIvKipcbiAqIGNsYXNzIFJ1bGVyXG4gKlxuICogSGVscGVyIGNsYXNzLCB1c2VkIGJ5IFtbTWFya2Rvd25JdCNjb3JlXV0sIFtbTWFya2Rvd25JdCNibG9ja11dIGFuZFxuICogW1tNYXJrZG93bkl0I2lubGluZV1dIHRvIG1hbmFnZSBzZXF1ZW5jZXMgb2YgZnVuY3Rpb25zIChydWxlcyk6XG4gKlxuICogLSBrZWVwIHJ1bGVzIGluIGRlZmluZWQgb3JkZXJcbiAqIC0gYXNzaWduIHRoZSBuYW1lIHRvIGVhY2ggcnVsZVxuICogLSBlbmFibGUvZGlzYWJsZSBydWxlc1xuICogLSBhZGQvcmVwbGFjZSBydWxlc1xuICogLSBhbGxvdyBhc3NpZ24gcnVsZXMgdG8gYWRkaXRpb25hbCBuYW1lZCBjaGFpbnMgKGluIHRoZSBzYW1lKVxuICogLSBjYWNoZWluZyBsaXN0cyBvZiBhY3RpdmUgcnVsZXNcbiAqXG4gKiBZb3Ugd2lsbCBub3QgbmVlZCB1c2UgdGhpcyBjbGFzcyBkaXJlY3RseSB1bnRpbCB3cml0ZSBwbHVnaW5zLiBGb3Igc2ltcGxlXG4gKiBydWxlcyBjb250cm9sIHVzZSBbW01hcmtkb3duSXQuZGlzYWJsZV1dLCBbW01hcmtkb3duSXQuZW5hYmxlXV0gYW5kXG4gKiBbW01hcmtkb3duSXQudXNlXV0uXG4gKiovXG4ndXNlIHN0cmljdCc7XG5cblxuLyoqXG4gKiBuZXcgUnVsZXIoKVxuICoqL1xuZnVuY3Rpb24gUnVsZXIoKSB7XG4gIC8vIExpc3Qgb2YgYWRkZWQgcnVsZXMuIEVhY2ggZWxlbWVudCBpczpcbiAgLy9cbiAgLy8ge1xuICAvLyAgIG5hbWU6IFhYWCxcbiAgLy8gICBlbmFibGVkOiBCb29sZWFuLFxuICAvLyAgIGZuOiBGdW5jdGlvbigpLFxuICAvLyAgIGFsdDogWyBuYW1lMiwgbmFtZTMgXVxuICAvLyB9XG4gIC8vXG4gIHRoaXMuX19ydWxlc19fID0gW107XG5cbiAgLy8gQ2FjaGVkIHJ1bGUgY2hhaW5zLlxuICAvL1xuICAvLyBGaXJzdCBsZXZlbCAtIGNoYWluIG5hbWUsICcnIGZvciBkZWZhdWx0LlxuICAvLyBTZWNvbmQgbGV2ZWwgLSBkaWdpbmFsIGFuY2hvciBmb3IgZmFzdCBmaWx0ZXJpbmcgYnkgY2hhcmNvZGVzLlxuICAvL1xuICB0aGlzLl9fY2FjaGVfXyA9IG51bGw7XG59XG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBIZWxwZXIgbWV0aG9kcywgc2hvdWxkIG5vdCBiZSB1c2VkIGRpcmVjdGx5XG5cblxuLy8gRmluZCBydWxlIGluZGV4IGJ5IG5hbWVcbi8vXG5SdWxlci5wcm90b3R5cGUuX19maW5kX18gPSBmdW5jdGlvbiAobmFtZSkge1xuICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMuX19ydWxlc19fLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKHRoaXMuX19ydWxlc19fW2ldLm5hbWUgPT09IG5hbWUpIHtcbiAgICAgIHJldHVybiBpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gLTE7XG59O1xuXG5cbi8vIEJ1aWxkIHJ1bGVzIGxvb2t1cCBjYWNoZVxuLy9cblJ1bGVyLnByb3RvdHlwZS5fX2NvbXBpbGVfXyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB2YXIgY2hhaW5zID0gWyAnJyBdO1xuXG4gIC8vIGNvbGxlY3QgdW5pcXVlIG5hbWVzXG4gIHNlbGYuX19ydWxlc19fLmZvckVhY2goZnVuY3Rpb24gKHJ1bGUpIHtcbiAgICBpZiAoIXJ1bGUuZW5hYmxlZCkgeyByZXR1cm47IH1cblxuICAgIHJ1bGUuYWx0LmZvckVhY2goZnVuY3Rpb24gKGFsdE5hbWUpIHtcbiAgICAgIGlmIChjaGFpbnMuaW5kZXhPZihhbHROYW1lKSA8IDApIHtcbiAgICAgICAgY2hhaW5zLnB1c2goYWx0TmFtZSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0pO1xuXG4gIHNlbGYuX19jYWNoZV9fID0ge307XG5cbiAgY2hhaW5zLmZvckVhY2goZnVuY3Rpb24gKGNoYWluKSB7XG4gICAgc2VsZi5fX2NhY2hlX19bY2hhaW5dID0gW107XG4gICAgc2VsZi5fX3J1bGVzX18uZm9yRWFjaChmdW5jdGlvbiAocnVsZSkge1xuICAgICAgaWYgKCFydWxlLmVuYWJsZWQpIHsgcmV0dXJuOyB9XG5cbiAgICAgIGlmIChjaGFpbiAmJiBydWxlLmFsdC5pbmRleE9mKGNoYWluKSA8IDApIHsgcmV0dXJuOyB9XG5cbiAgICAgIHNlbGYuX19jYWNoZV9fW2NoYWluXS5wdXNoKHJ1bGUuZm4pO1xuICAgIH0pO1xuICB9KTtcbn07XG5cblxuLyoqXG4gKiBSdWxlci5hdChuYW1lLCBmbiBbLCBvcHRpb25zXSlcbiAqIC0gbmFtZSAoU3RyaW5nKTogcnVsZSBuYW1lIHRvIHJlcGxhY2UuXG4gKiAtIGZuIChGdW5jdGlvbik6IG5ldyBydWxlIGZ1bmN0aW9uLlxuICogLSBvcHRpb25zIChPYmplY3QpOiBuZXcgcnVsZSBvcHRpb25zIChub3QgbWFuZGF0b3J5KS5cbiAqXG4gKiBSZXBsYWNlIHJ1bGUgYnkgbmFtZSB3aXRoIG5ldyBmdW5jdGlvbiAmIG9wdGlvbnMuIFRocm93cyBlcnJvciBpZiBuYW1lIG5vdFxuICogZm91bmQuXG4gKlxuICogIyMjIyMgT3B0aW9uczpcbiAqXG4gKiAtIF9fYWx0X18gLSBhcnJheSB3aXRoIG5hbWVzIG9mIFwiYWx0ZXJuYXRlXCIgY2hhaW5zLlxuICpcbiAqICMjIyMjIEV4YW1wbGVcbiAqXG4gKiBSZXBsYWNlIGV4aXN0aW5nIHR5cG9yZ2FwaGVyIHJlcGxhY2VtZW50IHJ1bGUgd2l0aCBuZXcgb25lOlxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBtZCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0JykoKTtcbiAqXG4gKiBtZC5jb3JlLnJ1bGVyLmF0KCdyZXBsYWNlbWVudHMnLCBmdW5jdGlvbiByZXBsYWNlKHN0YXRlKSB7XG4gKiAgIC8vLi4uXG4gKiB9KTtcbiAqIGBgYFxuICoqL1xuUnVsZXIucHJvdG90eXBlLmF0ID0gZnVuY3Rpb24gKG5hbWUsIGZuLCBvcHRpb25zKSB7XG4gIHZhciBpbmRleCA9IHRoaXMuX19maW5kX18obmFtZSk7XG4gIHZhciBvcHQgPSBvcHRpb25zIHx8IHt9O1xuXG4gIGlmIChpbmRleCA9PT0gLTEpIHsgdGhyb3cgbmV3IEVycm9yKCdQYXJzZXIgcnVsZSBub3QgZm91bmQ6ICcgKyBuYW1lKTsgfVxuXG4gIHRoaXMuX19ydWxlc19fW2luZGV4XS5mbiA9IGZuO1xuICB0aGlzLl9fcnVsZXNfX1tpbmRleF0uYWx0ID0gb3B0LmFsdCB8fCBbXTtcbiAgdGhpcy5fX2NhY2hlX18gPSBudWxsO1xufTtcblxuXG4vKipcbiAqIFJ1bGVyLmJlZm9yZShiZWZvcmVOYW1lLCBydWxlTmFtZSwgZm4gWywgb3B0aW9uc10pXG4gKiAtIGJlZm9yZU5hbWUgKFN0cmluZyk6IG5ldyBydWxlIHdpbGwgYmUgYWRkZWQgYmVmb3JlIHRoaXMgb25lLlxuICogLSBydWxlTmFtZSAoU3RyaW5nKTogbmFtZSBvZiBhZGRlZCBydWxlLlxuICogLSBmbiAoRnVuY3Rpb24pOiBydWxlIGZ1bmN0aW9uLlxuICogLSBvcHRpb25zIChPYmplY3QpOiBydWxlIG9wdGlvbnMgKG5vdCBtYW5kYXRvcnkpLlxuICpcbiAqIEFkZCBuZXcgcnVsZSB0byBjaGFpbiBiZWZvcmUgb25lIHdpdGggZ2l2ZW4gbmFtZS4gU2VlIGFsc29cbiAqIFtbUnVsZXIuYWZ0ZXJdXSwgW1tSdWxlci5wdXNoXV0uXG4gKlxuICogIyMjIyMgT3B0aW9uczpcbiAqXG4gKiAtIF9fYWx0X18gLSBhcnJheSB3aXRoIG5hbWVzIG9mIFwiYWx0ZXJuYXRlXCIgY2hhaW5zLlxuICpcbiAqICMjIyMjIEV4YW1wbGVcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgbWQgPSByZXF1aXJlKCdtYXJrZG93bi1pdCcpKCk7XG4gKlxuICogbWQuYmxvY2sucnVsZXIuYmVmb3JlKCdwYXJhZ3JhcGgnLCAnbXlfcnVsZScsIGZ1bmN0aW9uIHJlcGxhY2Uoc3RhdGUpIHtcbiAqICAgLy8uLi5cbiAqIH0pO1xuICogYGBgXG4gKiovXG5SdWxlci5wcm90b3R5cGUuYmVmb3JlID0gZnVuY3Rpb24gKGJlZm9yZU5hbWUsIHJ1bGVOYW1lLCBmbiwgb3B0aW9ucykge1xuICB2YXIgaW5kZXggPSB0aGlzLl9fZmluZF9fKGJlZm9yZU5hbWUpO1xuICB2YXIgb3B0ID0gb3B0aW9ucyB8fCB7fTtcblxuICBpZiAoaW5kZXggPT09IC0xKSB7IHRocm93IG5ldyBFcnJvcignUGFyc2VyIHJ1bGUgbm90IGZvdW5kOiAnICsgYmVmb3JlTmFtZSk7IH1cblxuICB0aGlzLl9fcnVsZXNfXy5zcGxpY2UoaW5kZXgsIDAsIHtcbiAgICBuYW1lOiBydWxlTmFtZSxcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIGZuOiBmbixcbiAgICBhbHQ6IG9wdC5hbHQgfHwgW11cbiAgfSk7XG5cbiAgdGhpcy5fX2NhY2hlX18gPSBudWxsO1xufTtcblxuXG4vKipcbiAqIFJ1bGVyLmFmdGVyKGFmdGVyTmFtZSwgcnVsZU5hbWUsIGZuIFssIG9wdGlvbnNdKVxuICogLSBhZnRlck5hbWUgKFN0cmluZyk6IG5ldyBydWxlIHdpbGwgYmUgYWRkZWQgYWZ0ZXIgdGhpcyBvbmUuXG4gKiAtIHJ1bGVOYW1lIChTdHJpbmcpOiBuYW1lIG9mIGFkZGVkIHJ1bGUuXG4gKiAtIGZuIChGdW5jdGlvbik6IHJ1bGUgZnVuY3Rpb24uXG4gKiAtIG9wdGlvbnMgKE9iamVjdCk6IHJ1bGUgb3B0aW9ucyAobm90IG1hbmRhdG9yeSkuXG4gKlxuICogQWRkIG5ldyBydWxlIHRvIGNoYWluIGFmdGVyIG9uZSB3aXRoIGdpdmVuIG5hbWUuIFNlZSBhbHNvXG4gKiBbW1J1bGVyLmJlZm9yZV1dLCBbW1J1bGVyLnB1c2hdXS5cbiAqXG4gKiAjIyMjIyBPcHRpb25zOlxuICpcbiAqIC0gX19hbHRfXyAtIGFycmF5IHdpdGggbmFtZXMgb2YgXCJhbHRlcm5hdGVcIiBjaGFpbnMuXG4gKlxuICogIyMjIyMgRXhhbXBsZVxuICpcbiAqIGBgYGphdmFzY3JpcHRcbiAqIHZhciBtZCA9IHJlcXVpcmUoJ21hcmtkb3duLWl0JykoKTtcbiAqXG4gKiBtZC5pbmxpbmUucnVsZXIuYWZ0ZXIoJ3RleHQnLCAnbXlfcnVsZScsIGZ1bmN0aW9uIHJlcGxhY2Uoc3RhdGUpIHtcbiAqICAgLy8uLi5cbiAqIH0pO1xuICogYGBgXG4gKiovXG5SdWxlci5wcm90b3R5cGUuYWZ0ZXIgPSBmdW5jdGlvbiAoYWZ0ZXJOYW1lLCBydWxlTmFtZSwgZm4sIG9wdGlvbnMpIHtcbiAgdmFyIGluZGV4ID0gdGhpcy5fX2ZpbmRfXyhhZnRlck5hbWUpO1xuICB2YXIgb3B0ID0gb3B0aW9ucyB8fCB7fTtcblxuICBpZiAoaW5kZXggPT09IC0xKSB7IHRocm93IG5ldyBFcnJvcignUGFyc2VyIHJ1bGUgbm90IGZvdW5kOiAnICsgYWZ0ZXJOYW1lKTsgfVxuXG4gIHRoaXMuX19ydWxlc19fLnNwbGljZShpbmRleCArIDEsIDAsIHtcbiAgICBuYW1lOiBydWxlTmFtZSxcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIGZuOiBmbixcbiAgICBhbHQ6IG9wdC5hbHQgfHwgW11cbiAgfSk7XG5cbiAgdGhpcy5fX2NhY2hlX18gPSBudWxsO1xufTtcblxuLyoqXG4gKiBSdWxlci5wdXNoKHJ1bGVOYW1lLCBmbiBbLCBvcHRpb25zXSlcbiAqIC0gcnVsZU5hbWUgKFN0cmluZyk6IG5hbWUgb2YgYWRkZWQgcnVsZS5cbiAqIC0gZm4gKEZ1bmN0aW9uKTogcnVsZSBmdW5jdGlvbi5cbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogcnVsZSBvcHRpb25zIChub3QgbWFuZGF0b3J5KS5cbiAqXG4gKiBQdXNoIG5ldyBydWxlIHRvIHRoZSBlbmQgb2YgY2hhaW4uIFNlZSBhbHNvXG4gKiBbW1J1bGVyLmJlZm9yZV1dLCBbW1J1bGVyLmFmdGVyXV0uXG4gKlxuICogIyMjIyMgT3B0aW9uczpcbiAqXG4gKiAtIF9fYWx0X18gLSBhcnJheSB3aXRoIG5hbWVzIG9mIFwiYWx0ZXJuYXRlXCIgY2hhaW5zLlxuICpcbiAqICMjIyMjIEV4YW1wbGVcbiAqXG4gKiBgYGBqYXZhc2NyaXB0XG4gKiB2YXIgbWQgPSByZXF1aXJlKCdtYXJrZG93bi1pdCcpKCk7XG4gKlxuICogbWQuY29yZS5ydWxlci5wdXNoKCdteV9ydWxlJywgZnVuY3Rpb24gcmVwbGFjZShzdGF0ZSkge1xuICogICAvLy4uLlxuICogfSk7XG4gKiBgYGBcbiAqKi9cblJ1bGVyLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKHJ1bGVOYW1lLCBmbiwgb3B0aW9ucykge1xuICB2YXIgb3B0ID0gb3B0aW9ucyB8fCB7fTtcblxuICB0aGlzLl9fcnVsZXNfXy5wdXNoKHtcbiAgICBuYW1lOiBydWxlTmFtZSxcbiAgICBlbmFibGVkOiB0cnVlLFxuICAgIGZuOiBmbixcbiAgICBhbHQ6IG9wdC5hbHQgfHwgW11cbiAgfSk7XG5cbiAgdGhpcy5fX2NhY2hlX18gPSBudWxsO1xufTtcblxuXG4vKipcbiAqIFJ1bGVyLmVuYWJsZShsaXN0IFssIGlnbm9yZUludmFsaWRdKSAtPiBBcnJheVxuICogLSBsaXN0IChTdHJpbmd8QXJyYXkpOiBsaXN0IG9mIHJ1bGUgbmFtZXMgdG8gZW5hYmxlLlxuICogLSBpZ25vcmVJbnZhbGlkIChCb29sZWFuKTogc2V0IGB0cnVlYCB0byBpZ25vcmUgZXJyb3JzIHdoZW4gcnVsZSBub3QgZm91bmQuXG4gKlxuICogRW5hYmxlIHJ1bGVzIHdpdGggZ2l2ZW4gbmFtZXMuIElmIGFueSBydWxlIG5hbWUgbm90IGZvdW5kIC0gdGhyb3cgRXJyb3IuXG4gKiBFcnJvcnMgY2FuIGJlIGRpc2FibGVkIGJ5IHNlY29uZCBwYXJhbS5cbiAqXG4gKiBSZXR1cm5zIGxpc3Qgb2YgZm91bmQgcnVsZSBuYW1lcyAoaWYgbm8gZXhjZXB0aW9uIGhhcHBlbmVkKS5cbiAqXG4gKiBTZWUgYWxzbyBbW1J1bGVyLmRpc2FibGVdXSwgW1tSdWxlci5lbmFibGVPbmx5XV0uXG4gKiovXG5SdWxlci5wcm90b3R5cGUuZW5hYmxlID0gZnVuY3Rpb24gKGxpc3QsIGlnbm9yZUludmFsaWQpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KGxpc3QpKSB7IGxpc3QgPSBbIGxpc3QgXTsgfVxuXG4gIHZhciByZXN1bHQgPSBbXTtcblxuICAvLyBTZWFyY2ggYnkgbmFtZSBhbmQgZW5hYmxlXG4gIGxpc3QuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgIHZhciBpZHggPSB0aGlzLl9fZmluZF9fKG5hbWUpO1xuXG4gICAgaWYgKGlkeCA8IDApIHtcbiAgICAgIGlmIChpZ25vcmVJbnZhbGlkKSB7IHJldHVybjsgfVxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdSdWxlcyBtYW5hZ2VyOiBpbnZhbGlkIHJ1bGUgbmFtZSAnICsgbmFtZSk7XG4gICAgfVxuICAgIHRoaXMuX19ydWxlc19fW2lkeF0uZW5hYmxlZCA9IHRydWU7XG4gICAgcmVzdWx0LnB1c2gobmFtZSk7XG4gIH0sIHRoaXMpO1xuXG4gIHRoaXMuX19jYWNoZV9fID0gbnVsbDtcbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuLyoqXG4gKiBSdWxlci5lbmFibGVPbmx5KGxpc3QgWywgaWdub3JlSW52YWxpZF0pXG4gKiAtIGxpc3QgKFN0cmluZ3xBcnJheSk6IGxpc3Qgb2YgcnVsZSBuYW1lcyB0byBlbmFibGUgKHdoaXRlbGlzdCkuXG4gKiAtIGlnbm9yZUludmFsaWQgKEJvb2xlYW4pOiBzZXQgYHRydWVgIHRvIGlnbm9yZSBlcnJvcnMgd2hlbiBydWxlIG5vdCBmb3VuZC5cbiAqXG4gKiBFbmFibGUgcnVsZXMgd2l0aCBnaXZlbiBuYW1lcywgYW5kIGRpc2FibGUgZXZlcnl0aGluZyBlbHNlLiBJZiBhbnkgcnVsZSBuYW1lXG4gKiBub3QgZm91bmQgLSB0aHJvdyBFcnJvci4gRXJyb3JzIGNhbiBiZSBkaXNhYmxlZCBieSBzZWNvbmQgcGFyYW0uXG4gKlxuICogU2VlIGFsc28gW1tSdWxlci5kaXNhYmxlXV0sIFtbUnVsZXIuZW5hYmxlXV0uXG4gKiovXG5SdWxlci5wcm90b3R5cGUuZW5hYmxlT25seSA9IGZ1bmN0aW9uIChsaXN0LCBpZ25vcmVJbnZhbGlkKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShsaXN0KSkgeyBsaXN0ID0gWyBsaXN0IF07IH1cblxuICB0aGlzLl9fcnVsZXNfXy5mb3JFYWNoKGZ1bmN0aW9uIChydWxlKSB7IHJ1bGUuZW5hYmxlZCA9IGZhbHNlOyB9KTtcblxuICB0aGlzLmVuYWJsZShsaXN0LCBpZ25vcmVJbnZhbGlkKTtcbn07XG5cblxuLyoqXG4gKiBSdWxlci5kaXNhYmxlKGxpc3QgWywgaWdub3JlSW52YWxpZF0pIC0+IEFycmF5XG4gKiAtIGxpc3QgKFN0cmluZ3xBcnJheSk6IGxpc3Qgb2YgcnVsZSBuYW1lcyB0byBkaXNhYmxlLlxuICogLSBpZ25vcmVJbnZhbGlkIChCb29sZWFuKTogc2V0IGB0cnVlYCB0byBpZ25vcmUgZXJyb3JzIHdoZW4gcnVsZSBub3QgZm91bmQuXG4gKlxuICogRGlzYWJsZSBydWxlcyB3aXRoIGdpdmVuIG5hbWVzLiBJZiBhbnkgcnVsZSBuYW1lIG5vdCBmb3VuZCAtIHRocm93IEVycm9yLlxuICogRXJyb3JzIGNhbiBiZSBkaXNhYmxlZCBieSBzZWNvbmQgcGFyYW0uXG4gKlxuICogUmV0dXJucyBsaXN0IG9mIGZvdW5kIHJ1bGUgbmFtZXMgKGlmIG5vIGV4Y2VwdGlvbiBoYXBwZW5lZCkuXG4gKlxuICogU2VlIGFsc28gW1tSdWxlci5lbmFibGVdXSwgW1tSdWxlci5lbmFibGVPbmx5XV0uXG4gKiovXG5SdWxlci5wcm90b3R5cGUuZGlzYWJsZSA9IGZ1bmN0aW9uIChsaXN0LCBpZ25vcmVJbnZhbGlkKSB7XG4gIGlmICghQXJyYXkuaXNBcnJheShsaXN0KSkgeyBsaXN0ID0gWyBsaXN0IF07IH1cblxuICB2YXIgcmVzdWx0ID0gW107XG5cbiAgLy8gU2VhcmNoIGJ5IG5hbWUgYW5kIGRpc2FibGVcbiAgbGlzdC5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgdmFyIGlkeCA9IHRoaXMuX19maW5kX18obmFtZSk7XG5cbiAgICBpZiAoaWR4IDwgMCkge1xuICAgICAgaWYgKGlnbm9yZUludmFsaWQpIHsgcmV0dXJuOyB9XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ1J1bGVzIG1hbmFnZXI6IGludmFsaWQgcnVsZSBuYW1lICcgKyBuYW1lKTtcbiAgICB9XG4gICAgdGhpcy5fX3J1bGVzX19baWR4XS5lbmFibGVkID0gZmFsc2U7XG4gICAgcmVzdWx0LnB1c2gobmFtZSk7XG4gIH0sIHRoaXMpO1xuXG4gIHRoaXMuX19jYWNoZV9fID0gbnVsbDtcbiAgcmV0dXJuIHJlc3VsdDtcbn07XG5cblxuLyoqXG4gKiBSdWxlci5nZXRSdWxlcyhjaGFpbk5hbWUpIC0+IEFycmF5XG4gKlxuICogUmV0dXJuIGFycmF5IG9mIGFjdGl2ZSBmdW5jdGlvbnMgKHJ1bGVzKSBmb3IgZ2l2ZW4gY2hhaW4gbmFtZS4gSXQgYW5hbHl6ZXNcbiAqIHJ1bGVzIGNvbmZpZ3VyYXRpb24sIGNvbXBpbGVzIGNhY2hlcyBpZiBub3QgZXhpc3RzIGFuZCByZXR1cm5zIHJlc3VsdC5cbiAqXG4gKiBEZWZhdWx0IGNoYWluIG5hbWUgaXMgYCcnYCAoZW1wdHkgc3RyaW5nKS4gSXQgY2FuJ3QgYmUgc2tpcHBlZC4gVGhhdCdzXG4gKiBkb25lIGludGVudGlvbmFsbHksIHRvIGtlZXAgc2lnbmF0dXJlIG1vbm9tb3JwaGljIGZvciBoaWdoIHNwZWVkLlxuICoqL1xuUnVsZXIucHJvdG90eXBlLmdldFJ1bGVzID0gZnVuY3Rpb24gKGNoYWluTmFtZSkge1xuICBpZiAodGhpcy5fX2NhY2hlX18gPT09IG51bGwpIHtcbiAgICB0aGlzLl9fY29tcGlsZV9fKCk7XG4gIH1cblxuICAvLyBDaGFpbiBjYW4gYmUgZW1wdHksIGlmIHJ1bGVzIGRpc2FibGVkLiBCdXQgd2Ugc3RpbGwgaGF2ZSB0byByZXR1cm4gQXJyYXkuXG4gIHJldHVybiB0aGlzLl9fY2FjaGVfX1tjaGFpbk5hbWVdIHx8IFtdO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBSdWxlcjtcbiIsIi8vIEJsb2NrIHF1b3Rlc1xuXG4ndXNlIHN0cmljdCc7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBibG9ja3F1b3RlKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICB2YXIgbmV4dExpbmUsIGxhc3RMaW5lRW1wdHksIG9sZFRTaGlmdCwgb2xkQk1hcmtzLCBvbGRJbmRlbnQsIG9sZFBhcmVudFR5cGUsIGxpbmVzLFxuICAgICAgdGVybWluYXRvclJ1bGVzLCB0b2tlbixcbiAgICAgIGksIGwsIHRlcm1pbmF0ZSxcbiAgICAgIHBvcyA9IHN0YXRlLmJNYXJrc1tzdGFydExpbmVdICsgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0sXG4gICAgICBtYXggPSBzdGF0ZS5lTWFya3Nbc3RhcnRMaW5lXTtcblxuICAvLyBjaGVjayB0aGUgYmxvY2sgcXVvdGUgbWFya2VyXG4gIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MrKykgIT09IDB4M0UvKiA+ICovKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIC8vIHdlIGtub3cgdGhhdCBpdCdzIGdvaW5nIHRvIGJlIGEgdmFsaWQgYmxvY2txdW90ZSxcbiAgLy8gc28gbm8gcG9pbnQgdHJ5aW5nIHRvIGZpbmQgdGhlIGVuZCBvZiBpdCBpbiBzaWxlbnQgbW9kZVxuICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG5cbiAgLy8gc2tpcCBvbmUgb3B0aW9uYWwgc3BhY2UgYWZ0ZXIgJz4nXG4gIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpID09PSAweDIwKSB7IHBvcysrOyB9XG5cbiAgb2xkSW5kZW50ID0gc3RhdGUuYmxrSW5kZW50O1xuICBzdGF0ZS5ibGtJbmRlbnQgPSAwO1xuXG4gIG9sZEJNYXJrcyA9IFsgc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gXTtcbiAgc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gPSBwb3M7XG5cbiAgLy8gY2hlY2sgaWYgd2UgaGF2ZSBhbiBlbXB0eSBibG9ja3F1b3RlXG4gIHBvcyA9IHBvcyA8IG1heCA/IHN0YXRlLnNraXBTcGFjZXMocG9zKSA6IHBvcztcbiAgbGFzdExpbmVFbXB0eSA9IHBvcyA+PSBtYXg7XG5cbiAgb2xkVFNoaWZ0ID0gWyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSBdO1xuICBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSA9IHBvcyAtIHN0YXRlLmJNYXJrc1tzdGFydExpbmVdO1xuXG4gIHRlcm1pbmF0b3JSdWxlcyA9IHN0YXRlLm1kLmJsb2NrLnJ1bGVyLmdldFJ1bGVzKCdibG9ja3F1b3RlJyk7XG5cbiAgLy8gU2VhcmNoIHRoZSBlbmQgb2YgdGhlIGJsb2NrXG4gIC8vXG4gIC8vIEJsb2NrIGVuZHMgd2l0aCBlaXRoZXI6XG4gIC8vICAxLiBhbiBlbXB0eSBsaW5lIG91dHNpZGU6XG4gIC8vICAgICBgYGBcbiAgLy8gICAgID4gdGVzdFxuICAvL1xuICAvLyAgICAgYGBgXG4gIC8vICAyLiBhbiBlbXB0eSBsaW5lIGluc2lkZTpcbiAgLy8gICAgIGBgYFxuICAvLyAgICAgPlxuICAvLyAgICAgdGVzdFxuICAvLyAgICAgYGBgXG4gIC8vICAzLiBhbm90aGVyIHRhZ1xuICAvLyAgICAgYGBgXG4gIC8vICAgICA+IHRlc3RcbiAgLy8gICAgICAtIC0gLVxuICAvLyAgICAgYGBgXG4gIGZvciAobmV4dExpbmUgPSBzdGFydExpbmUgKyAxOyBuZXh0TGluZSA8IGVuZExpbmU7IG5leHRMaW5lKyspIHtcbiAgICBpZiAoc3RhdGUudFNoaWZ0W25leHRMaW5lXSA8IG9sZEluZGVudCkgeyBicmVhazsgfVxuXG4gICAgcG9zID0gc3RhdGUuYk1hcmtzW25leHRMaW5lXSArIHN0YXRlLnRTaGlmdFtuZXh0TGluZV07XG4gICAgbWF4ID0gc3RhdGUuZU1hcmtzW25leHRMaW5lXTtcblxuICAgIGlmIChwb3MgPj0gbWF4KSB7XG4gICAgICAvLyBDYXNlIDE6IGxpbmUgaXMgbm90IGluc2lkZSB0aGUgYmxvY2txdW90ZSwgYW5kIHRoaXMgbGluZSBpcyBlbXB0eS5cbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MrKykgPT09IDB4M0UvKiA+ICovKSB7XG4gICAgICAvLyBUaGlzIGxpbmUgaXMgaW5zaWRlIHRoZSBibG9ja3F1b3RlLlxuXG4gICAgICAvLyBza2lwIG9uZSBvcHRpb25hbCBzcGFjZSBhZnRlciAnPidcbiAgICAgIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpID09PSAweDIwKSB7IHBvcysrOyB9XG5cbiAgICAgIG9sZEJNYXJrcy5wdXNoKHN0YXRlLmJNYXJrc1tuZXh0TGluZV0pO1xuICAgICAgc3RhdGUuYk1hcmtzW25leHRMaW5lXSA9IHBvcztcblxuICAgICAgcG9zID0gcG9zIDwgbWF4ID8gc3RhdGUuc2tpcFNwYWNlcyhwb3MpIDogcG9zO1xuICAgICAgbGFzdExpbmVFbXB0eSA9IHBvcyA+PSBtYXg7XG5cbiAgICAgIG9sZFRTaGlmdC5wdXNoKHN0YXRlLnRTaGlmdFtuZXh0TGluZV0pO1xuICAgICAgc3RhdGUudFNoaWZ0W25leHRMaW5lXSA9IHBvcyAtIHN0YXRlLmJNYXJrc1tuZXh0TGluZV07XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBDYXNlIDI6IGxpbmUgaXMgbm90IGluc2lkZSB0aGUgYmxvY2txdW90ZSwgYW5kIHRoZSBsYXN0IGxpbmUgd2FzIGVtcHR5LlxuICAgIGlmIChsYXN0TGluZUVtcHR5KSB7IGJyZWFrOyB9XG5cbiAgICAvLyBDYXNlIDM6IGFub3RoZXIgdGFnIGZvdW5kLlxuICAgIHRlcm1pbmF0ZSA9IGZhbHNlO1xuICAgIGZvciAoaSA9IDAsIGwgPSB0ZXJtaW5hdG9yUnVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAodGVybWluYXRvclJ1bGVzW2ldKHN0YXRlLCBuZXh0TGluZSwgZW5kTGluZSwgdHJ1ZSkpIHtcbiAgICAgICAgdGVybWluYXRlID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZXJtaW5hdGUpIHsgYnJlYWs7IH1cblxuICAgIG9sZEJNYXJrcy5wdXNoKHN0YXRlLmJNYXJrc1tuZXh0TGluZV0pO1xuICAgIG9sZFRTaGlmdC5wdXNoKHN0YXRlLnRTaGlmdFtuZXh0TGluZV0pO1xuXG4gICAgLy8gQSBuZWdhdGl2ZSBudW1iZXIgbWVhbnMgdGhhdCB0aGlzIGlzIGEgcGFyYWdyYXBoIGNvbnRpbnVhdGlvbjtcbiAgICAvL1xuICAgIC8vIEFueSBuZWdhdGl2ZSBudW1iZXIgd2lsbCBkbyB0aGUgam9iIGhlcmUsIGJ1dCBpdCdzIGJldHRlciBmb3IgaXRcbiAgICAvLyB0byBiZSBsYXJnZSBlbm91Z2ggdG8gbWFrZSBhbnkgYnVncyBvYnZpb3VzLlxuICAgIHN0YXRlLnRTaGlmdFtuZXh0TGluZV0gPSAtMTtcbiAgfVxuXG4gIG9sZFBhcmVudFR5cGUgPSBzdGF0ZS5wYXJlbnRUeXBlO1xuICBzdGF0ZS5wYXJlbnRUeXBlID0gJ2Jsb2NrcXVvdGUnO1xuXG4gIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ2Jsb2NrcXVvdGVfb3BlbicsICdibG9ja3F1b3RlJywgMSk7XG4gIHRva2VuLm1hcmt1cCA9ICc+JztcbiAgdG9rZW4ubWFwICAgID0gbGluZXMgPSBbIHN0YXJ0TGluZSwgMCBdO1xuXG4gIHN0YXRlLm1kLmJsb2NrLnRva2VuaXplKHN0YXRlLCBzdGFydExpbmUsIG5leHRMaW5lKTtcblxuICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdibG9ja3F1b3RlX2Nsb3NlJywgJ2Jsb2NrcXVvdGUnLCAtMSk7XG4gIHRva2VuLm1hcmt1cCA9ICc+JztcblxuICBzdGF0ZS5wYXJlbnRUeXBlID0gb2xkUGFyZW50VHlwZTtcbiAgbGluZXNbMV0gPSBzdGF0ZS5saW5lO1xuXG4gIC8vIFJlc3RvcmUgb3JpZ2luYWwgdFNoaWZ0OyB0aGlzIG1pZ2h0IG5vdCBiZSBuZWNlc3Nhcnkgc2luY2UgdGhlIHBhcnNlclxuICAvLyBoYXMgYWxyZWFkeSBiZWVuIGhlcmUsIGJ1dCBqdXN0IHRvIG1ha2Ugc3VyZSB3ZSBjYW4gZG8gdGhhdC5cbiAgZm9yIChpID0gMDsgaSA8IG9sZFRTaGlmdC5sZW5ndGg7IGkrKykge1xuICAgIHN0YXRlLmJNYXJrc1tpICsgc3RhcnRMaW5lXSA9IG9sZEJNYXJrc1tpXTtcbiAgICBzdGF0ZS50U2hpZnRbaSArIHN0YXJ0TGluZV0gPSBvbGRUU2hpZnRbaV07XG4gIH1cbiAgc3RhdGUuYmxrSW5kZW50ID0gb2xkSW5kZW50O1xuXG4gIHJldHVybiB0cnVlO1xufTtcbiIsIi8vIENvZGUgYmxvY2sgKDQgc3BhY2VzIHBhZGRlZClcblxuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gY29kZShzdGF0ZSwgc3RhcnRMaW5lLCBlbmRMaW5lLyosIHNpbGVudCovKSB7XG4gIHZhciBuZXh0TGluZSwgbGFzdCwgdG9rZW47XG5cbiAgaWYgKHN0YXRlLnRTaGlmdFtzdGFydExpbmVdIC0gc3RhdGUuYmxrSW5kZW50IDwgNCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICBsYXN0ID0gbmV4dExpbmUgPSBzdGFydExpbmUgKyAxO1xuXG4gIHdoaWxlIChuZXh0TGluZSA8IGVuZExpbmUpIHtcbiAgICBpZiAoc3RhdGUuaXNFbXB0eShuZXh0TGluZSkpIHtcbiAgICAgIG5leHRMaW5lKys7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG4gICAgaWYgKHN0YXRlLnRTaGlmdFtuZXh0TGluZV0gLSBzdGF0ZS5ibGtJbmRlbnQgPj0gNCkge1xuICAgICAgbmV4dExpbmUrKztcbiAgICAgIGxhc3QgPSBuZXh0TGluZTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cbiAgICBicmVhaztcbiAgfVxuXG4gIHN0YXRlLmxpbmUgPSBuZXh0TGluZTtcblxuICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgnY29kZV9ibG9jaycsICdjb2RlJywgMCk7XG4gIHRva2VuLmNvbnRlbnQgPSBzdGF0ZS5nZXRMaW5lcyhzdGFydExpbmUsIGxhc3QsIDQgKyBzdGF0ZS5ibGtJbmRlbnQsIHRydWUpO1xuICB0b2tlbi5tYXAgICAgID0gWyBzdGFydExpbmUsIHN0YXRlLmxpbmUgXTtcblxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBmZW5jZXMgKGBgYCBsYW5nLCB+fn4gbGFuZylcblxuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZmVuY2Uoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50KSB7XG4gIHZhciBtYXJrZXIsIGxlbiwgcGFyYW1zLCBuZXh0TGluZSwgbWVtLCB0b2tlbiwgbWFya3VwLFxuICAgICAgaGF2ZUVuZE1hcmtlciA9IGZhbHNlLFxuICAgICAgcG9zID0gc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gKyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSxcbiAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tzdGFydExpbmVdO1xuXG4gIGlmIChwb3MgKyAzID4gbWF4KSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIG1hcmtlciA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcyk7XG5cbiAgaWYgKG1hcmtlciAhPT0gMHg3RS8qIH4gKi8gJiYgbWFya2VyICE9PSAweDYwIC8qIGAgKi8pIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBzY2FuIG1hcmtlciBsZW5ndGhcbiAgbWVtID0gcG9zO1xuICBwb3MgPSBzdGF0ZS5za2lwQ2hhcnMocG9zLCBtYXJrZXIpO1xuXG4gIGxlbiA9IHBvcyAtIG1lbTtcblxuICBpZiAobGVuIDwgMykgeyByZXR1cm4gZmFsc2U7IH1cblxuICBtYXJrdXAgPSBzdGF0ZS5zcmMuc2xpY2UobWVtLCBwb3MpO1xuICBwYXJhbXMgPSBzdGF0ZS5zcmMuc2xpY2UocG9zLCBtYXgpO1xuXG4gIGlmIChwYXJhbXMuaW5kZXhPZignYCcpID49IDApIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgLy8gU2luY2Ugc3RhcnQgaXMgZm91bmQsIHdlIGNhbiByZXBvcnQgc3VjY2VzcyBoZXJlIGluIHZhbGlkYXRpb24gbW9kZVxuICBpZiAoc2lsZW50KSB7IHJldHVybiB0cnVlOyB9XG5cbiAgLy8gc2VhcmNoIGVuZCBvZiBibG9ja1xuICBuZXh0TGluZSA9IHN0YXJ0TGluZTtcblxuICBmb3IgKDs7KSB7XG4gICAgbmV4dExpbmUrKztcbiAgICBpZiAobmV4dExpbmUgPj0gZW5kTGluZSkge1xuICAgICAgLy8gdW5jbG9zZWQgYmxvY2sgc2hvdWxkIGJlIGF1dG9jbG9zZWQgYnkgZW5kIG9mIGRvY3VtZW50LlxuICAgICAgLy8gYWxzbyBibG9jayBzZWVtcyB0byBiZSBhdXRvY2xvc2VkIGJ5IGVuZCBvZiBwYXJlbnRcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIHBvcyA9IG1lbSA9IHN0YXRlLmJNYXJrc1tuZXh0TGluZV0gKyBzdGF0ZS50U2hpZnRbbmV4dExpbmVdO1xuICAgIG1heCA9IHN0YXRlLmVNYXJrc1tuZXh0TGluZV07XG5cbiAgICBpZiAocG9zIDwgbWF4ICYmIHN0YXRlLnRTaGlmdFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHtcbiAgICAgIC8vIG5vbi1lbXB0eSBsaW5lIHdpdGggbmVnYXRpdmUgaW5kZW50IHNob3VsZCBzdG9wIHRoZSBsaXN0OlxuICAgICAgLy8gLSBgYGBcbiAgICAgIC8vICB0ZXN0XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICBpZiAoc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSAhPT0gbWFya2VyKSB7IGNvbnRpbnVlOyB9XG5cbiAgICBpZiAoc3RhdGUudFNoaWZ0W25leHRMaW5lXSAtIHN0YXRlLmJsa0luZGVudCA+PSA0KSB7XG4gICAgICAvLyBjbG9zaW5nIGZlbmNlIHNob3VsZCBiZSBpbmRlbnRlZCBsZXNzIHRoYW4gNCBzcGFjZXNcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHBvcyA9IHN0YXRlLnNraXBDaGFycyhwb3MsIG1hcmtlcik7XG5cbiAgICAvLyBjbG9zaW5nIGNvZGUgZmVuY2UgbXVzdCBiZSBhdCBsZWFzdCBhcyBsb25nIGFzIHRoZSBvcGVuaW5nIG9uZVxuICAgIGlmIChwb3MgLSBtZW0gPCBsZW4pIHsgY29udGludWU7IH1cblxuICAgIC8vIG1ha2Ugc3VyZSB0YWlsIGhhcyBzcGFjZXMgb25seVxuICAgIHBvcyA9IHN0YXRlLnNraXBTcGFjZXMocG9zKTtcblxuICAgIGlmIChwb3MgPCBtYXgpIHsgY29udGludWU7IH1cblxuICAgIGhhdmVFbmRNYXJrZXIgPSB0cnVlO1xuICAgIC8vIGZvdW5kIVxuICAgIGJyZWFrO1xuICB9XG5cbiAgLy8gSWYgYSBmZW5jZSBoYXMgaGVhZGluZyBzcGFjZXMsIHRoZXkgc2hvdWxkIGJlIHJlbW92ZWQgZnJvbSBpdHMgaW5uZXIgYmxvY2tcbiAgbGVuID0gc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV07XG5cbiAgc3RhdGUubGluZSA9IG5leHRMaW5lICsgKGhhdmVFbmRNYXJrZXIgPyAxIDogMCk7XG5cbiAgdG9rZW4gICAgICAgICA9IHN0YXRlLnB1c2goJ2ZlbmNlJywgJ2NvZGUnLCAwKTtcbiAgdG9rZW4uaW5mbyAgICA9IHBhcmFtcztcbiAgdG9rZW4uY29udGVudCA9IHN0YXRlLmdldExpbmVzKHN0YXJ0TGluZSArIDEsIG5leHRMaW5lLCBsZW4sIHRydWUpO1xuICB0b2tlbi5tYXJrdXAgID0gbWFya3VwO1xuICB0b2tlbi5tYXAgICAgID0gWyBzdGFydExpbmUsIHN0YXRlLmxpbmUgXTtcblxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBoZWFkaW5nICgjLCAjIywgLi4uKVxuXG4ndXNlIHN0cmljdCc7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBoZWFkaW5nKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICB2YXIgY2gsIGxldmVsLCB0bXAsIHRva2VuLFxuICAgICAgcG9zID0gc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gKyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSxcbiAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tzdGFydExpbmVdO1xuXG4gIGNoICA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcyk7XG5cbiAgaWYgKGNoICE9PSAweDIzLyogIyAqLyB8fCBwb3MgPj0gbWF4KSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIC8vIGNvdW50IGhlYWRpbmcgbGV2ZWxcbiAgbGV2ZWwgPSAxO1xuICBjaCA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KCsrcG9zKTtcbiAgd2hpbGUgKGNoID09PSAweDIzLyogIyAqLyAmJiBwb3MgPCBtYXggJiYgbGV2ZWwgPD0gNikge1xuICAgIGxldmVsKys7XG4gICAgY2ggPSBzdGF0ZS5zcmMuY2hhckNvZGVBdCgrK3Bvcyk7XG4gIH1cblxuICBpZiAobGV2ZWwgPiA2IHx8IChwb3MgPCBtYXggJiYgY2ggIT09IDB4MjAvKiBzcGFjZSAqLykpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gIC8vIExldCdzIGN1dCB0YWlscyBsaWtlICcgICAgIyMjICAnIGZyb20gdGhlIGVuZCBvZiBzdHJpbmdcblxuICBtYXggPSBzdGF0ZS5za2lwQ2hhcnNCYWNrKG1heCwgMHgyMCwgcG9zKTsgLy8gc3BhY2VcbiAgdG1wID0gc3RhdGUuc2tpcENoYXJzQmFjayhtYXgsIDB4MjMsIHBvcyk7IC8vICNcbiAgaWYgKHRtcCA+IHBvcyAmJiBzdGF0ZS5zcmMuY2hhckNvZGVBdCh0bXAgLSAxKSA9PT0gMHgyMC8qIHNwYWNlICovKSB7XG4gICAgbWF4ID0gdG1wO1xuICB9XG5cbiAgc3RhdGUubGluZSA9IHN0YXJ0TGluZSArIDE7XG5cbiAgdG9rZW4gICAgICAgID0gc3RhdGUucHVzaCgnaGVhZGluZ19vcGVuJywgJ2gnICsgU3RyaW5nKGxldmVsKSwgMSk7XG4gIHRva2VuLm1hcmt1cCA9ICcjIyMjIyMjIycuc2xpY2UoMCwgbGV2ZWwpO1xuICB0b2tlbi5tYXAgICAgPSBbIHN0YXJ0TGluZSwgc3RhdGUubGluZSBdO1xuXG4gIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnaW5saW5lJywgJycsIDApO1xuICB0b2tlbi5jb250ZW50ICA9IHN0YXRlLnNyYy5zbGljZShwb3MsIG1heCkudHJpbSgpO1xuICB0b2tlbi5tYXAgICAgICA9IFsgc3RhcnRMaW5lLCBzdGF0ZS5saW5lIF07XG4gIHRva2VuLmNoaWxkcmVuID0gW107XG5cbiAgdG9rZW4gICAgICAgID0gc3RhdGUucHVzaCgnaGVhZGluZ19jbG9zZScsICdoJyArIFN0cmluZyhsZXZlbCksIC0xKTtcbiAgdG9rZW4ubWFya3VwID0gJyMjIyMjIyMjJy5zbGljZSgwLCBsZXZlbCk7XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiLy8gSG9yaXpvbnRhbCBydWxlXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGhyKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICB2YXIgbWFya2VyLCBjbnQsIGNoLCB0b2tlbixcbiAgICAgIHBvcyA9IHN0YXRlLmJNYXJrc1tzdGFydExpbmVdICsgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0sXG4gICAgICBtYXggPSBzdGF0ZS5lTWFya3Nbc3RhcnRMaW5lXTtcblxuICBtYXJrZXIgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MrKyk7XG5cbiAgLy8gQ2hlY2sgaHIgbWFya2VyXG4gIGlmIChtYXJrZXIgIT09IDB4MkEvKiAqICovICYmXG4gICAgICBtYXJrZXIgIT09IDB4MkQvKiAtICovICYmXG4gICAgICBtYXJrZXIgIT09IDB4NUYvKiBfICovKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gbWFya2VycyBjYW4gYmUgbWl4ZWQgd2l0aCBzcGFjZXMsIGJ1dCB0aGVyZSBzaG91bGQgYmUgYXQgbGVhc3QgMyBvbmVcblxuICBjbnQgPSAxO1xuICB3aGlsZSAocG9zIDwgbWF4KSB7XG4gICAgY2ggPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MrKyk7XG4gICAgaWYgKGNoICE9PSBtYXJrZXIgJiYgY2ggIT09IDB4MjAvKiBzcGFjZSAqLykgeyByZXR1cm4gZmFsc2U7IH1cbiAgICBpZiAoY2ggPT09IG1hcmtlcikgeyBjbnQrKzsgfVxuICB9XG5cbiAgaWYgKGNudCA8IDMpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gIHN0YXRlLmxpbmUgPSBzdGFydExpbmUgKyAxO1xuXG4gIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ2hyJywgJ2hyJywgMCk7XG4gIHRva2VuLm1hcCAgICA9IFsgc3RhcnRMaW5lLCBzdGF0ZS5saW5lIF07XG4gIHRva2VuLm1hcmt1cCA9IEFycmF5KGNudCArIDEpLmpvaW4oU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXIpKTtcblxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBIVE1MIGJsb2NrXG5cbid1c2Ugc3RyaWN0JztcblxuXG52YXIgYmxvY2tfbmFtZXMgPSByZXF1aXJlKCcuLi9jb21tb24vaHRtbF9ibG9ja3MnKTtcbnZhciBIVE1MX09QRU5fQ0xPU0VfVEFHX1JFID0gcmVxdWlyZSgnLi4vY29tbW9uL2h0bWxfcmUnKS5IVE1MX09QRU5fQ0xPU0VfVEFHX1JFO1xuXG4vLyBBbiBhcnJheSBvZiBvcGVuaW5nIGFuZCBjb3JyZXNwb25kaW5nIGNsb3Npbmcgc2VxdWVuY2VzIGZvciBodG1sIHRhZ3MsXG4vLyBsYXN0IGFyZ3VtZW50IGRlZmluZXMgd2hldGhlciBpdCBjYW4gdGVybWluYXRlIGEgcGFyYWdyYXBoIG9yIG5vdFxuLy9cbnZhciBIVE1MX1NFUVVFTkNFUyA9IFtcbiAgWyAvXjwoc2NyaXB0fHByZXxzdHlsZSkoPz0oXFxzfD58JCkpL2ksIC88XFwvKHNjcmlwdHxwcmV8c3R5bGUpPi9pLCB0cnVlIF0sXG4gIFsgL148IS0tLywgICAgICAgIC8tLT4vLCAgIHRydWUgXSxcbiAgWyAvXjxcXD8vLCAgICAgICAgIC9cXD8+LywgICB0cnVlIF0sXG4gIFsgL148IVtBLVpdLywgICAgIC8+LywgICAgIHRydWUgXSxcbiAgWyAvXjwhXFxbQ0RBVEFcXFsvLCAvXFxdXFxdPi8sIHRydWUgXSxcbiAgWyBuZXcgUmVnRXhwKCdePC8/KCcgKyBibG9ja19uYW1lcy5qb2luKCd8JykgKyAnKSg/PShcXFxcc3wvPz58JCkpJywgJ2knKSwgL14kLywgdHJ1ZSBdLFxuICBbIG5ldyBSZWdFeHAoSFRNTF9PUEVOX0NMT1NFX1RBR19SRS5zb3VyY2UgKyAnXFxcXHMqJCcpLCAgL14kLywgZmFsc2UgXVxuXTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGh0bWxfYmxvY2soc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50KSB7XG4gIHZhciBpLCBuZXh0TGluZSwgdG9rZW4sIGxpbmVUZXh0LFxuICAgICAgcG9zID0gc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gKyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXSxcbiAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tzdGFydExpbmVdO1xuXG4gIGlmICghc3RhdGUubWQub3B0aW9ucy5odG1sKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpICE9PSAweDNDLyogPCAqLykgeyByZXR1cm4gZmFsc2U7IH1cblxuICBsaW5lVGV4dCA9IHN0YXRlLnNyYy5zbGljZShwb3MsIG1heCk7XG5cbiAgZm9yIChpID0gMDsgaSA8IEhUTUxfU0VRVUVOQ0VTLmxlbmd0aDsgaSsrKSB7XG4gICAgaWYgKEhUTUxfU0VRVUVOQ0VTW2ldWzBdLnRlc3QobGluZVRleHQpKSB7IGJyZWFrOyB9XG4gIH1cblxuICBpZiAoaSA9PT0gSFRNTF9TRVFVRU5DRVMubGVuZ3RoKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGlmIChzaWxlbnQpIHtcbiAgICAvLyB0cnVlIGlmIHRoaXMgc2VxdWVuY2UgY2FuIGJlIGEgdGVybWluYXRvciwgZmFsc2Ugb3RoZXJ3aXNlXG4gICAgcmV0dXJuIEhUTUxfU0VRVUVOQ0VTW2ldWzJdO1xuICB9XG5cbiAgbmV4dExpbmUgPSBzdGFydExpbmUgKyAxO1xuXG4gIC8vIElmIHdlIGFyZSBoZXJlIC0gd2UgZGV0ZWN0ZWQgSFRNTCBibG9jay5cbiAgLy8gTGV0J3Mgcm9sbCBkb3duIHRpbGwgYmxvY2sgZW5kLlxuICBpZiAoIUhUTUxfU0VRVUVOQ0VTW2ldWzFdLnRlc3QobGluZVRleHQpKSB7XG4gICAgZm9yICg7IG5leHRMaW5lIDwgZW5kTGluZTsgbmV4dExpbmUrKykge1xuICAgICAgaWYgKHN0YXRlLnRTaGlmdFtuZXh0TGluZV0gPCBzdGF0ZS5ibGtJbmRlbnQpIHsgYnJlYWs7IH1cblxuICAgICAgcG9zID0gc3RhdGUuYk1hcmtzW25leHRMaW5lXSArIHN0YXRlLnRTaGlmdFtuZXh0TGluZV07XG4gICAgICBtYXggPSBzdGF0ZS5lTWFya3NbbmV4dExpbmVdO1xuICAgICAgbGluZVRleHQgPSBzdGF0ZS5zcmMuc2xpY2UocG9zLCBtYXgpO1xuXG4gICAgICBpZiAoSFRNTF9TRVFVRU5DRVNbaV1bMV0udGVzdChsaW5lVGV4dCkpIHtcbiAgICAgICAgaWYgKGxpbmVUZXh0Lmxlbmd0aCAhPT0gMCkgeyBuZXh0TGluZSsrOyB9XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHN0YXRlLmxpbmUgPSBuZXh0TGluZTtcblxuICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgnaHRtbF9ibG9jaycsICcnLCAwKTtcbiAgdG9rZW4ubWFwICAgICA9IFsgc3RhcnRMaW5lLCBuZXh0TGluZSBdO1xuICB0b2tlbi5jb250ZW50ID0gc3RhdGUuZ2V0TGluZXMoc3RhcnRMaW5lLCBuZXh0TGluZSwgc3RhdGUuYmxrSW5kZW50LCB0cnVlKTtcblxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBsaGVhZGluZyAoLS0tLCA9PT0pXG5cbid1c2Ugc3RyaWN0JztcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGxoZWFkaW5nKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUvKiwgc2lsZW50Ki8pIHtcbiAgdmFyIG1hcmtlciwgcG9zLCBtYXgsIHRva2VuLCBsZXZlbCxcbiAgICAgIG5leHQgPSBzdGFydExpbmUgKyAxO1xuXG4gIGlmIChuZXh0ID49IGVuZExpbmUpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIGlmIChzdGF0ZS50U2hpZnRbbmV4dF0gPCBzdGF0ZS5ibGtJbmRlbnQpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgLy8gU2NhbiBuZXh0IGxpbmVcblxuICBpZiAoc3RhdGUudFNoaWZ0W25leHRdIC0gc3RhdGUuYmxrSW5kZW50ID4gMykgeyByZXR1cm4gZmFsc2U7IH1cblxuICBwb3MgPSBzdGF0ZS5iTWFya3NbbmV4dF0gKyBzdGF0ZS50U2hpZnRbbmV4dF07XG4gIG1heCA9IHN0YXRlLmVNYXJrc1tuZXh0XTtcblxuICBpZiAocG9zID49IG1heCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICBtYXJrZXIgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuXG4gIGlmIChtYXJrZXIgIT09IDB4MkQvKiAtICovICYmIG1hcmtlciAhPT0gMHgzRC8qID0gKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgcG9zID0gc3RhdGUuc2tpcENoYXJzKHBvcywgbWFya2VyKTtcblxuICBwb3MgPSBzdGF0ZS5za2lwU3BhY2VzKHBvcyk7XG5cbiAgaWYgKHBvcyA8IG1heCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICBwb3MgPSBzdGF0ZS5iTWFya3Nbc3RhcnRMaW5lXSArIHN0YXRlLnRTaGlmdFtzdGFydExpbmVdO1xuXG4gIHN0YXRlLmxpbmUgPSBuZXh0ICsgMTtcbiAgbGV2ZWwgPSAobWFya2VyID09PSAweDNELyogPSAqLyA/IDEgOiAyKTtcblxuICB0b2tlbiAgICAgICAgICA9IHN0YXRlLnB1c2goJ2hlYWRpbmdfb3BlbicsICdoJyArIFN0cmluZyhsZXZlbCksIDEpO1xuICB0b2tlbi5tYXJrdXAgICA9IFN0cmluZy5mcm9tQ2hhckNvZGUobWFya2VyKTtcbiAgdG9rZW4ubWFwICAgICAgPSBbIHN0YXJ0TGluZSwgc3RhdGUubGluZSBdO1xuXG4gIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnaW5saW5lJywgJycsIDApO1xuICB0b2tlbi5jb250ZW50ICA9IHN0YXRlLnNyYy5zbGljZShwb3MsIHN0YXRlLmVNYXJrc1tzdGFydExpbmVdKS50cmltKCk7XG4gIHRva2VuLm1hcCAgICAgID0gWyBzdGFydExpbmUsIHN0YXRlLmxpbmUgLSAxIF07XG4gIHRva2VuLmNoaWxkcmVuID0gW107XG5cbiAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdoZWFkaW5nX2Nsb3NlJywgJ2gnICsgU3RyaW5nKGxldmVsKSwgLTEpO1xuICB0b2tlbi5tYXJrdXAgICA9IFN0cmluZy5mcm9tQ2hhckNvZGUobWFya2VyKTtcblxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBMaXN0c1xuXG4ndXNlIHN0cmljdCc7XG5cblxuLy8gU2VhcmNoIGBbLSsqXVtcXG4gXWAsIHJldHVybnMgbmV4dCBwb3MgYXJ0ZXIgbWFya2VyIG9uIHN1Y2Nlc3Ncbi8vIG9yIC0xIG9uIGZhaWwuXG5mdW5jdGlvbiBza2lwQnVsbGV0TGlzdE1hcmtlcihzdGF0ZSwgc3RhcnRMaW5lKSB7XG4gIHZhciBtYXJrZXIsIHBvcywgbWF4O1xuXG4gIHBvcyA9IHN0YXRlLmJNYXJrc1tzdGFydExpbmVdICsgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV07XG4gIG1heCA9IHN0YXRlLmVNYXJrc1tzdGFydExpbmVdO1xuXG4gIG1hcmtlciA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcysrKTtcbiAgLy8gQ2hlY2sgYnVsbGV0XG4gIGlmIChtYXJrZXIgIT09IDB4MkEvKiAqICovICYmXG4gICAgICBtYXJrZXIgIT09IDB4MkQvKiAtICovICYmXG4gICAgICBtYXJrZXIgIT09IDB4MkIvKiArICovKSB7XG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgaWYgKHBvcyA8IG1heCAmJiBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpICE9PSAweDIwKSB7XG4gICAgLy8gXCIgMS50ZXN0IFwiIC0gaXMgbm90IGEgbGlzdCBpdGVtXG4gICAgcmV0dXJuIC0xO1xuICB9XG5cbiAgcmV0dXJuIHBvcztcbn1cblxuLy8gU2VhcmNoIGBcXGQrWy4pXVtcXG4gXWAsIHJldHVybnMgbmV4dCBwb3MgYXJ0ZXIgbWFya2VyIG9uIHN1Y2Nlc3Ncbi8vIG9yIC0xIG9uIGZhaWwuXG5mdW5jdGlvbiBza2lwT3JkZXJlZExpc3RNYXJrZXIoc3RhdGUsIHN0YXJ0TGluZSkge1xuICB2YXIgY2gsXG4gICAgICBzdGFydCA9IHN0YXRlLmJNYXJrc1tzdGFydExpbmVdICsgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0sXG4gICAgICBwb3MgPSBzdGFydCxcbiAgICAgIG1heCA9IHN0YXRlLmVNYXJrc1tzdGFydExpbmVdO1xuXG4gIC8vIExpc3QgbWFya2VyIHNob3VsZCBoYXZlIGF0IGxlYXN0IDIgY2hhcnMgKGRpZ2l0ICsgZG90KVxuICBpZiAocG9zICsgMSA+PSBtYXgpIHsgcmV0dXJuIC0xOyB9XG5cbiAgY2ggPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MrKyk7XG5cbiAgaWYgKGNoIDwgMHgzMC8qIDAgKi8gfHwgY2ggPiAweDM5LyogOSAqLykgeyByZXR1cm4gLTE7IH1cblxuICBmb3IgKDs7KSB7XG4gICAgLy8gRU9MIC0+IGZhaWxcbiAgICBpZiAocG9zID49IG1heCkgeyByZXR1cm4gLTE7IH1cblxuICAgIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKyspO1xuXG4gICAgaWYgKGNoID49IDB4MzAvKiAwICovICYmIGNoIDw9IDB4MzkvKiA5ICovKSB7XG5cbiAgICAgIC8vIExpc3QgbWFya2VyIHNob3VsZCBoYXZlIG5vIG1vcmUgdGhhbiA5IGRpZ2l0c1xuICAgICAgLy8gKHByZXZlbnRzIGludGVnZXIgb3ZlcmZsb3cgaW4gYnJvd3NlcnMpXG4gICAgICBpZiAocG9zIC0gc3RhcnQgPj0gMTApIHsgcmV0dXJuIC0xOyB9XG5cbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIC8vIGZvdW5kIHZhbGlkIG1hcmtlclxuICAgIGlmIChjaCA9PT0gMHgyOS8qICkgKi8gfHwgY2ggPT09IDB4MmUvKiAuICovKSB7XG4gICAgICBicmVhaztcbiAgICB9XG5cbiAgICByZXR1cm4gLTE7XG4gIH1cblxuXG4gIGlmIChwb3MgPCBtYXggJiYgc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSAhPT0gMHgyMC8qIHNwYWNlICovKSB7XG4gICAgLy8gXCIgMS50ZXN0IFwiIC0gaXMgbm90IGEgbGlzdCBpdGVtXG4gICAgcmV0dXJuIC0xO1xuICB9XG4gIHJldHVybiBwb3M7XG59XG5cbmZ1bmN0aW9uIG1hcmtUaWdodFBhcmFncmFwaHMoc3RhdGUsIGlkeCkge1xuICB2YXIgaSwgbCxcbiAgICAgIGxldmVsID0gc3RhdGUubGV2ZWwgKyAyO1xuXG4gIGZvciAoaSA9IGlkeCArIDIsIGwgPSBzdGF0ZS50b2tlbnMubGVuZ3RoIC0gMjsgaSA8IGw7IGkrKykge1xuICAgIGlmIChzdGF0ZS50b2tlbnNbaV0ubGV2ZWwgPT09IGxldmVsICYmIHN0YXRlLnRva2Vuc1tpXS50eXBlID09PSAncGFyYWdyYXBoX29wZW4nKSB7XG4gICAgICBzdGF0ZS50b2tlbnNbaSArIDJdLmhpZGRlbiA9IHRydWU7XG4gICAgICBzdGF0ZS50b2tlbnNbaV0uaGlkZGVuID0gdHJ1ZTtcbiAgICAgIGkgKz0gMjtcbiAgICB9XG4gIH1cbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGxpc3Qoc3RhdGUsIHN0YXJ0TGluZSwgZW5kTGluZSwgc2lsZW50KSB7XG4gIHZhciBuZXh0TGluZSxcbiAgICAgIGluZGVudCxcbiAgICAgIG9sZFRTaGlmdCxcbiAgICAgIG9sZEluZGVudCxcbiAgICAgIG9sZFRpZ2h0LFxuICAgICAgb2xkUGFyZW50VHlwZSxcbiAgICAgIHN0YXJ0LFxuICAgICAgcG9zQWZ0ZXJNYXJrZXIsXG4gICAgICBtYXgsXG4gICAgICBpbmRlbnRBZnRlck1hcmtlcixcbiAgICAgIG1hcmtlclZhbHVlLFxuICAgICAgbWFya2VyQ2hhckNvZGUsXG4gICAgICBpc09yZGVyZWQsXG4gICAgICBjb250ZW50U3RhcnQsXG4gICAgICBsaXN0VG9rSWR4LFxuICAgICAgcHJldkVtcHR5RW5kLFxuICAgICAgbGlzdExpbmVzLFxuICAgICAgaXRlbUxpbmVzLFxuICAgICAgdGlnaHQgPSB0cnVlLFxuICAgICAgdGVybWluYXRvclJ1bGVzLFxuICAgICAgdG9rZW4sXG4gICAgICBpLCBsLCB0ZXJtaW5hdGU7XG5cbiAgLy8gRGV0ZWN0IGxpc3QgdHlwZSBhbmQgcG9zaXRpb24gYWZ0ZXIgbWFya2VyXG4gIGlmICgocG9zQWZ0ZXJNYXJrZXIgPSBza2lwT3JkZXJlZExpc3RNYXJrZXIoc3RhdGUsIHN0YXJ0TGluZSkpID49IDApIHtcbiAgICBpc09yZGVyZWQgPSB0cnVlO1xuICB9IGVsc2UgaWYgKChwb3NBZnRlck1hcmtlciA9IHNraXBCdWxsZXRMaXN0TWFya2VyKHN0YXRlLCBzdGFydExpbmUpKSA+PSAwKSB7XG4gICAgaXNPcmRlcmVkID0gZmFsc2U7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gV2Ugc2hvdWxkIHRlcm1pbmF0ZSBsaXN0IG9uIHN0eWxlIGNoYW5nZS4gUmVtZW1iZXIgZmlyc3Qgb25lIHRvIGNvbXBhcmUuXG4gIG1hcmtlckNoYXJDb2RlID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zQWZ0ZXJNYXJrZXIgLSAxKTtcblxuICAvLyBGb3IgdmFsaWRhdGlvbiBtb2RlIHdlIGNhbiB0ZXJtaW5hdGUgaW1tZWRpYXRlbHlcbiAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gIC8vIFN0YXJ0IGxpc3RcbiAgbGlzdFRva0lkeCA9IHN0YXRlLnRva2Vucy5sZW5ndGg7XG5cbiAgaWYgKGlzT3JkZXJlZCkge1xuICAgIHN0YXJ0ID0gc3RhdGUuYk1hcmtzW3N0YXJ0TGluZV0gKyBzdGF0ZS50U2hpZnRbc3RhcnRMaW5lXTtcbiAgICBtYXJrZXJWYWx1ZSA9IE51bWJlcihzdGF0ZS5zcmMuc3Vic3RyKHN0YXJ0LCBwb3NBZnRlck1hcmtlciAtIHN0YXJ0IC0gMSkpO1xuXG4gICAgdG9rZW4gICAgICAgPSBzdGF0ZS5wdXNoKCdvcmRlcmVkX2xpc3Rfb3BlbicsICdvbCcsIDEpO1xuICAgIGlmIChtYXJrZXJWYWx1ZSAhPT0gMSkge1xuICAgICAgdG9rZW4uYXR0cnMgPSBbIFsgJ3N0YXJ0JywgbWFya2VyVmFsdWUgXSBdO1xuICAgIH1cblxuICB9IGVsc2Uge1xuICAgIHRva2VuICAgICAgID0gc3RhdGUucHVzaCgnYnVsbGV0X2xpc3Rfb3BlbicsICd1bCcsIDEpO1xuICB9XG5cbiAgdG9rZW4ubWFwICAgID0gbGlzdExpbmVzID0gWyBzdGFydExpbmUsIDAgXTtcbiAgdG9rZW4ubWFya3VwID0gU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXJDaGFyQ29kZSk7XG5cbiAgLy9cbiAgLy8gSXRlcmF0ZSBsaXN0IGl0ZW1zXG4gIC8vXG5cbiAgbmV4dExpbmUgPSBzdGFydExpbmU7XG4gIHByZXZFbXB0eUVuZCA9IGZhbHNlO1xuICB0ZXJtaW5hdG9yUnVsZXMgPSBzdGF0ZS5tZC5ibG9jay5ydWxlci5nZXRSdWxlcygnbGlzdCcpO1xuXG4gIHdoaWxlIChuZXh0TGluZSA8IGVuZExpbmUpIHtcbiAgICBjb250ZW50U3RhcnQgPSBzdGF0ZS5za2lwU3BhY2VzKHBvc0FmdGVyTWFya2VyKTtcbiAgICBtYXggPSBzdGF0ZS5lTWFya3NbbmV4dExpbmVdO1xuXG4gICAgaWYgKGNvbnRlbnRTdGFydCA+PSBtYXgpIHtcbiAgICAgIC8vIHRyaW1taW5nIHNwYWNlIGluIFwiLSAgICBcXG4gIDNcIiBjYXNlLCBpbmRlbnQgaXMgMSBoZXJlXG4gICAgICBpbmRlbnRBZnRlck1hcmtlciA9IDE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluZGVudEFmdGVyTWFya2VyID0gY29udGVudFN0YXJ0IC0gcG9zQWZ0ZXJNYXJrZXI7XG4gICAgfVxuXG4gICAgLy8gSWYgd2UgaGF2ZSBtb3JlIHRoYW4gNCBzcGFjZXMsIHRoZSBpbmRlbnQgaXMgMVxuICAgIC8vICh0aGUgcmVzdCBpcyBqdXN0IGluZGVudGVkIGNvZGUgYmxvY2spXG4gICAgaWYgKGluZGVudEFmdGVyTWFya2VyID4gNCkgeyBpbmRlbnRBZnRlck1hcmtlciA9IDE7IH1cblxuICAgIC8vIFwiICAtICB0ZXN0XCJcbiAgICAvLyAgXl5eXl4gLSBjYWxjdWxhdGluZyB0b3RhbCBsZW5ndGggb2YgdGhpcyB0aGluZ1xuICAgIGluZGVudCA9IChwb3NBZnRlck1hcmtlciAtIHN0YXRlLmJNYXJrc1tuZXh0TGluZV0pICsgaW5kZW50QWZ0ZXJNYXJrZXI7XG5cbiAgICAvLyBSdW4gc3VicGFyc2VyICYgd3JpdGUgdG9rZW5zXG4gICAgdG9rZW4gICAgICAgID0gc3RhdGUucHVzaCgnbGlzdF9pdGVtX29wZW4nLCAnbGknLCAxKTtcbiAgICB0b2tlbi5tYXJrdXAgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKG1hcmtlckNoYXJDb2RlKTtcbiAgICB0b2tlbi5tYXAgICAgPSBpdGVtTGluZXMgPSBbIHN0YXJ0TGluZSwgMCBdO1xuXG4gICAgb2xkSW5kZW50ID0gc3RhdGUuYmxrSW5kZW50O1xuICAgIG9sZFRpZ2h0ID0gc3RhdGUudGlnaHQ7XG4gICAgb2xkVFNoaWZ0ID0gc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV07XG4gICAgb2xkUGFyZW50VHlwZSA9IHN0YXRlLnBhcmVudFR5cGU7XG4gICAgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0gPSBjb250ZW50U3RhcnQgLSBzdGF0ZS5iTWFya3Nbc3RhcnRMaW5lXTtcbiAgICBzdGF0ZS5ibGtJbmRlbnQgPSBpbmRlbnQ7XG4gICAgc3RhdGUudGlnaHQgPSB0cnVlO1xuICAgIHN0YXRlLnBhcmVudFR5cGUgPSAnbGlzdCc7XG5cbiAgICBzdGF0ZS5tZC5ibG9jay50b2tlbml6ZShzdGF0ZSwgc3RhcnRMaW5lLCBlbmRMaW5lLCB0cnVlKTtcblxuICAgIC8vIElmIGFueSBvZiBsaXN0IGl0ZW0gaXMgdGlnaHQsIG1hcmsgbGlzdCBhcyB0aWdodFxuICAgIGlmICghc3RhdGUudGlnaHQgfHwgcHJldkVtcHR5RW5kKSB7XG4gICAgICB0aWdodCA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBJdGVtIGJlY29tZSBsb29zZSBpZiBmaW5pc2ggd2l0aCBlbXB0eSBsaW5lLFxuICAgIC8vIGJ1dCB3ZSBzaG91bGQgZmlsdGVyIGxhc3QgZWxlbWVudCwgYmVjYXVzZSBpdCBtZWFucyBsaXN0IGZpbmlzaFxuICAgIHByZXZFbXB0eUVuZCA9IChzdGF0ZS5saW5lIC0gc3RhcnRMaW5lKSA+IDEgJiYgc3RhdGUuaXNFbXB0eShzdGF0ZS5saW5lIC0gMSk7XG5cbiAgICBzdGF0ZS5ibGtJbmRlbnQgPSBvbGRJbmRlbnQ7XG4gICAgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0gPSBvbGRUU2hpZnQ7XG4gICAgc3RhdGUudGlnaHQgPSBvbGRUaWdodDtcbiAgICBzdGF0ZS5wYXJlbnRUeXBlID0gb2xkUGFyZW50VHlwZTtcblxuICAgIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ2xpc3RfaXRlbV9jbG9zZScsICdsaScsIC0xKTtcbiAgICB0b2tlbi5tYXJrdXAgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKG1hcmtlckNoYXJDb2RlKTtcblxuICAgIG5leHRMaW5lID0gc3RhcnRMaW5lID0gc3RhdGUubGluZTtcbiAgICBpdGVtTGluZXNbMV0gPSBuZXh0TGluZTtcbiAgICBjb250ZW50U3RhcnQgPSBzdGF0ZS5iTWFya3Nbc3RhcnRMaW5lXTtcblxuICAgIGlmIChuZXh0TGluZSA+PSBlbmRMaW5lKSB7IGJyZWFrOyB9XG5cbiAgICBpZiAoc3RhdGUuaXNFbXB0eShuZXh0TGluZSkpIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cblxuICAgIC8vXG4gICAgLy8gVHJ5IHRvIGNoZWNrIGlmIGxpc3QgaXMgdGVybWluYXRlZCBvciBjb250aW51ZWQuXG4gICAgLy9cbiAgICBpZiAoc3RhdGUudFNoaWZ0W25leHRMaW5lXSA8IHN0YXRlLmJsa0luZGVudCkgeyBicmVhazsgfVxuXG4gICAgLy8gZmFpbCBpZiB0ZXJtaW5hdGluZyBibG9jayBmb3VuZFxuICAgIHRlcm1pbmF0ZSA9IGZhbHNlO1xuICAgIGZvciAoaSA9IDAsIGwgPSB0ZXJtaW5hdG9yUnVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAodGVybWluYXRvclJ1bGVzW2ldKHN0YXRlLCBuZXh0TGluZSwgZW5kTGluZSwgdHJ1ZSkpIHtcbiAgICAgICAgdGVybWluYXRlID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZXJtaW5hdGUpIHsgYnJlYWs7IH1cblxuICAgIC8vIGZhaWwgaWYgbGlzdCBoYXMgYW5vdGhlciB0eXBlXG4gICAgaWYgKGlzT3JkZXJlZCkge1xuICAgICAgcG9zQWZ0ZXJNYXJrZXIgPSBza2lwT3JkZXJlZExpc3RNYXJrZXIoc3RhdGUsIG5leHRMaW5lKTtcbiAgICAgIGlmIChwb3NBZnRlck1hcmtlciA8IDApIHsgYnJlYWs7IH1cbiAgICB9IGVsc2Uge1xuICAgICAgcG9zQWZ0ZXJNYXJrZXIgPSBza2lwQnVsbGV0TGlzdE1hcmtlcihzdGF0ZSwgbmV4dExpbmUpO1xuICAgICAgaWYgKHBvc0FmdGVyTWFya2VyIDwgMCkgeyBicmVhazsgfVxuICAgIH1cblxuICAgIGlmIChtYXJrZXJDaGFyQ29kZSAhPT0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zQWZ0ZXJNYXJrZXIgLSAxKSkgeyBicmVhazsgfVxuICB9XG5cbiAgLy8gRmluaWxpemUgbGlzdFxuICBpZiAoaXNPcmRlcmVkKSB7XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCdvcmRlcmVkX2xpc3RfY2xvc2UnLCAnb2wnLCAtMSk7XG4gIH0gZWxzZSB7XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCdidWxsZXRfbGlzdF9jbG9zZScsICd1bCcsIC0xKTtcbiAgfVxuICB0b2tlbi5tYXJrdXAgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKG1hcmtlckNoYXJDb2RlKTtcblxuICBsaXN0TGluZXNbMV0gPSBuZXh0TGluZTtcbiAgc3RhdGUubGluZSA9IG5leHRMaW5lO1xuXG4gIC8vIG1hcmsgcGFyYWdyYXBocyB0aWdodCBpZiBuZWVkZWRcbiAgaWYgKHRpZ2h0KSB7XG4gICAgbWFya1RpZ2h0UGFyYWdyYXBocyhzdGF0ZSwgbGlzdFRva0lkeCk7XG4gIH1cblxuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBQYXJhZ3JhcGhcblxuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gcGFyYWdyYXBoKHN0YXRlLCBzdGFydExpbmUvKiwgZW5kTGluZSovKSB7XG4gIHZhciBjb250ZW50LCB0ZXJtaW5hdGUsIGksIGwsIHRva2VuLFxuICAgICAgbmV4dExpbmUgPSBzdGFydExpbmUgKyAxLFxuICAgICAgdGVybWluYXRvclJ1bGVzID0gc3RhdGUubWQuYmxvY2sucnVsZXIuZ2V0UnVsZXMoJ3BhcmFncmFwaCcpLFxuICAgICAgZW5kTGluZSA9IHN0YXRlLmxpbmVNYXg7XG5cbiAgLy8ganVtcCBsaW5lLWJ5LWxpbmUgdW50aWwgZW1wdHkgb25lIG9yIEVPRlxuICBmb3IgKDsgbmV4dExpbmUgPCBlbmRMaW5lICYmICFzdGF0ZS5pc0VtcHR5KG5leHRMaW5lKTsgbmV4dExpbmUrKykge1xuICAgIC8vIHRoaXMgd291bGQgYmUgYSBjb2RlIGJsb2NrIG5vcm1hbGx5LCBidXQgYWZ0ZXIgcGFyYWdyYXBoXG4gICAgLy8gaXQncyBjb25zaWRlcmVkIGEgbGF6eSBjb250aW51YXRpb24gcmVnYXJkbGVzcyBvZiB3aGF0J3MgdGhlcmVcbiAgICBpZiAoc3RhdGUudFNoaWZ0W25leHRMaW5lXSAtIHN0YXRlLmJsa0luZGVudCA+IDMpIHsgY29udGludWU7IH1cblxuICAgIC8vIHF1aXJrIGZvciBibG9ja3F1b3RlcywgdGhpcyBsaW5lIHNob3VsZCBhbHJlYWR5IGJlIGNoZWNrZWQgYnkgdGhhdCBydWxlXG4gICAgaWYgKHN0YXRlLnRTaGlmdFtuZXh0TGluZV0gPCAwKSB7IGNvbnRpbnVlOyB9XG5cbiAgICAvLyBTb21lIHRhZ3MgY2FuIHRlcm1pbmF0ZSBwYXJhZ3JhcGggd2l0aG91dCBlbXB0eSBsaW5lLlxuICAgIHRlcm1pbmF0ZSA9IGZhbHNlO1xuICAgIGZvciAoaSA9IDAsIGwgPSB0ZXJtaW5hdG9yUnVsZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBpZiAodGVybWluYXRvclJ1bGVzW2ldKHN0YXRlLCBuZXh0TGluZSwgZW5kTGluZSwgdHJ1ZSkpIHtcbiAgICAgICAgdGVybWluYXRlID0gdHJ1ZTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh0ZXJtaW5hdGUpIHsgYnJlYWs7IH1cbiAgfVxuXG4gIGNvbnRlbnQgPSBzdGF0ZS5nZXRMaW5lcyhzdGFydExpbmUsIG5leHRMaW5lLCBzdGF0ZS5ibGtJbmRlbnQsIGZhbHNlKS50cmltKCk7XG5cbiAgc3RhdGUubGluZSA9IG5leHRMaW5lO1xuXG4gIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgncGFyYWdyYXBoX29wZW4nLCAncCcsIDEpO1xuICB0b2tlbi5tYXAgICAgICA9IFsgc3RhcnRMaW5lLCBzdGF0ZS5saW5lIF07XG5cbiAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdpbmxpbmUnLCAnJywgMCk7XG4gIHRva2VuLmNvbnRlbnQgID0gY29udGVudDtcbiAgdG9rZW4ubWFwICAgICAgPSBbIHN0YXJ0TGluZSwgc3RhdGUubGluZSBdO1xuICB0b2tlbi5jaGlsZHJlbiA9IFtdO1xuXG4gIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgncGFyYWdyYXBoX2Nsb3NlJywgJ3AnLCAtMSk7XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBwYXJzZUxpbmtEZXN0aW5hdGlvbiA9IHJlcXVpcmUoJy4uL2hlbHBlcnMvcGFyc2VfbGlua19kZXN0aW5hdGlvbicpO1xudmFyIHBhcnNlTGlua1RpdGxlICAgICAgID0gcmVxdWlyZSgnLi4vaGVscGVycy9wYXJzZV9saW5rX3RpdGxlJyk7XG52YXIgbm9ybWFsaXplUmVmZXJlbmNlICAgPSByZXF1aXJlKCcuLi9jb21tb24vdXRpbHMnKS5ub3JtYWxpemVSZWZlcmVuY2U7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZWZlcmVuY2Uoc3RhdGUsIHN0YXJ0TGluZSwgX2VuZExpbmUsIHNpbGVudCkge1xuICB2YXIgY2gsXG4gICAgICBkZXN0RW5kUG9zLFxuICAgICAgZGVzdEVuZExpbmVObyxcbiAgICAgIGVuZExpbmUsXG4gICAgICBocmVmLFxuICAgICAgaSxcbiAgICAgIGwsXG4gICAgICBsYWJlbCxcbiAgICAgIGxhYmVsRW5kLFxuICAgICAgcmVzLFxuICAgICAgc3RhcnQsXG4gICAgICBzdHIsXG4gICAgICB0ZXJtaW5hdGUsXG4gICAgICB0ZXJtaW5hdG9yUnVsZXMsXG4gICAgICB0aXRsZSxcbiAgICAgIGxpbmVzID0gMCxcbiAgICAgIHBvcyA9IHN0YXRlLmJNYXJrc1tzdGFydExpbmVdICsgc3RhdGUudFNoaWZ0W3N0YXJ0TGluZV0sXG4gICAgICBtYXggPSBzdGF0ZS5lTWFya3Nbc3RhcnRMaW5lXSxcbiAgICAgIG5leHRMaW5lID0gc3RhcnRMaW5lICsgMTtcblxuICBpZiAoc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSAhPT0gMHg1Qi8qIFsgKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgLy8gU2ltcGxlIGNoZWNrIHRvIHF1aWNrbHkgaW50ZXJydXB0IHNjYW4gb24gW2xpbmtdKHVybCkgYXQgdGhlIHN0YXJ0IG9mIGxpbmUuXG4gIC8vIENhbiBiZSB1c2VmdWwgb24gcHJhY3RpY2U6IGh0dHBzOi8vZ2l0aHViLmNvbS9tYXJrZG93bi1pdC9tYXJrZG93bi1pdC9pc3N1ZXMvNTRcbiAgd2hpbGUgKCsrcG9zIDwgbWF4KSB7XG4gICAgaWYgKHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgPT09IDB4NUQgLyogXSAqLyAmJlxuICAgICAgICBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MgLSAxKSAhPT0gMHg1Qy8qIFxcICovKSB7XG4gICAgICBpZiAocG9zICsgMSA9PT0gbWF4KSB7IHJldHVybiBmYWxzZTsgfVxuICAgICAgaWYgKHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcyArIDEpICE9PSAweDNBLyogOiAqLykgeyByZXR1cm4gZmFsc2U7IH1cbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIGVuZExpbmUgPSBzdGF0ZS5saW5lTWF4O1xuXG4gIC8vIGp1bXAgbGluZS1ieS1saW5lIHVudGlsIGVtcHR5IG9uZSBvciBFT0ZcbiAgdGVybWluYXRvclJ1bGVzID0gc3RhdGUubWQuYmxvY2sucnVsZXIuZ2V0UnVsZXMoJ3JlZmVyZW5jZScpO1xuXG4gIGZvciAoOyBuZXh0TGluZSA8IGVuZExpbmUgJiYgIXN0YXRlLmlzRW1wdHkobmV4dExpbmUpOyBuZXh0TGluZSsrKSB7XG4gICAgLy8gdGhpcyB3b3VsZCBiZSBhIGNvZGUgYmxvY2sgbm9ybWFsbHksIGJ1dCBhZnRlciBwYXJhZ3JhcGhcbiAgICAvLyBpdCdzIGNvbnNpZGVyZWQgYSBsYXp5IGNvbnRpbnVhdGlvbiByZWdhcmRsZXNzIG9mIHdoYXQncyB0aGVyZVxuICAgIGlmIChzdGF0ZS50U2hpZnRbbmV4dExpbmVdIC0gc3RhdGUuYmxrSW5kZW50ID4gMykgeyBjb250aW51ZTsgfVxuXG4gICAgLy8gcXVpcmsgZm9yIGJsb2NrcXVvdGVzLCB0aGlzIGxpbmUgc2hvdWxkIGFscmVhZHkgYmUgY2hlY2tlZCBieSB0aGF0IHJ1bGVcbiAgICBpZiAoc3RhdGUudFNoaWZ0W25leHRMaW5lXSA8IDApIHsgY29udGludWU7IH1cblxuICAgIC8vIFNvbWUgdGFncyBjYW4gdGVybWluYXRlIHBhcmFncmFwaCB3aXRob3V0IGVtcHR5IGxpbmUuXG4gICAgdGVybWluYXRlID0gZmFsc2U7XG4gICAgZm9yIChpID0gMCwgbCA9IHRlcm1pbmF0b3JSdWxlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGlmICh0ZXJtaW5hdG9yUnVsZXNbaV0oc3RhdGUsIG5leHRMaW5lLCBlbmRMaW5lLCB0cnVlKSkge1xuICAgICAgICB0ZXJtaW5hdGUgPSB0cnVlO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gICAgaWYgKHRlcm1pbmF0ZSkgeyBicmVhazsgfVxuICB9XG5cbiAgc3RyID0gc3RhdGUuZ2V0TGluZXMoc3RhcnRMaW5lLCBuZXh0TGluZSwgc3RhdGUuYmxrSW5kZW50LCBmYWxzZSkudHJpbSgpO1xuICBtYXggPSBzdHIubGVuZ3RoO1xuXG4gIGZvciAocG9zID0gMTsgcG9zIDwgbWF4OyBwb3MrKykge1xuICAgIGNoID0gc3RyLmNoYXJDb2RlQXQocG9zKTtcbiAgICBpZiAoY2ggPT09IDB4NUIgLyogWyAqLykge1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH0gZWxzZSBpZiAoY2ggPT09IDB4NUQgLyogXSAqLykge1xuICAgICAgbGFiZWxFbmQgPSBwb3M7XG4gICAgICBicmVhaztcbiAgICB9IGVsc2UgaWYgKGNoID09PSAweDBBIC8qIFxcbiAqLykge1xuICAgICAgbGluZXMrKztcbiAgICB9IGVsc2UgaWYgKGNoID09PSAweDVDIC8qIFxcICovKSB7XG4gICAgICBwb3MrKztcbiAgICAgIGlmIChwb3MgPCBtYXggJiYgc3RyLmNoYXJDb2RlQXQocG9zKSA9PT0gMHgwQSkge1xuICAgICAgICBsaW5lcysrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChsYWJlbEVuZCA8IDAgfHwgc3RyLmNoYXJDb2RlQXQobGFiZWxFbmQgKyAxKSAhPT0gMHgzQS8qIDogKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgLy8gW2xhYmVsXTogICBkZXN0aW5hdGlvbiAgICd0aXRsZSdcbiAgLy8gICAgICAgICBeXl4gc2tpcCBvcHRpb25hbCB3aGl0ZXNwYWNlIGhlcmVcbiAgZm9yIChwb3MgPSBsYWJlbEVuZCArIDI7IHBvcyA8IG1heDsgcG9zKyspIHtcbiAgICBjaCA9IHN0ci5jaGFyQ29kZUF0KHBvcyk7XG4gICAgaWYgKGNoID09PSAweDBBKSB7XG4gICAgICBsaW5lcysrO1xuICAgIH0gZWxzZSBpZiAoY2ggPT09IDB4MjApIHtcbiAgICAgIC8qZXNsaW50IG5vLWVtcHR5OjAqL1xuICAgIH0gZWxzZSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cblxuICAvLyBbbGFiZWxdOiAgIGRlc3RpbmF0aW9uICAgJ3RpdGxlJ1xuICAvLyAgICAgICAgICAgIF5eXl5eXl5eXl5eIHBhcnNlIHRoaXNcbiAgcmVzID0gcGFyc2VMaW5rRGVzdGluYXRpb24oc3RyLCBwb3MsIG1heCk7XG4gIGlmICghcmVzLm9rKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGhyZWYgPSBzdGF0ZS5tZC5ub3JtYWxpemVMaW5rKHJlcy5zdHIpO1xuICBpZiAoIXN0YXRlLm1kLnZhbGlkYXRlTGluayhocmVmKSkgeyByZXR1cm4gZmFsc2U7IH1cblxuICBwb3MgPSByZXMucG9zO1xuICBsaW5lcyArPSByZXMubGluZXM7XG5cbiAgLy8gc2F2ZSBjdXJzb3Igc3RhdGUsIHdlIGNvdWxkIHJlcXVpcmUgdG8gcm9sbGJhY2sgbGF0ZXJcbiAgZGVzdEVuZFBvcyA9IHBvcztcbiAgZGVzdEVuZExpbmVObyA9IGxpbmVzO1xuXG4gIC8vIFtsYWJlbF06ICAgZGVzdGluYXRpb24gICAndGl0bGUnXG4gIC8vICAgICAgICAgICAgICAgICAgICAgICBeXl4gc2tpcHBpbmcgdGhvc2Ugc3BhY2VzXG4gIHN0YXJ0ID0gcG9zO1xuICBmb3IgKDsgcG9zIDwgbWF4OyBwb3MrKykge1xuICAgIGNoID0gc3RyLmNoYXJDb2RlQXQocG9zKTtcbiAgICBpZiAoY2ggPT09IDB4MEEpIHtcbiAgICAgIGxpbmVzKys7XG4gICAgfSBlbHNlIGlmIChjaCA9PT0gMHgyMCkge1xuICAgICAgLyplc2xpbnQgbm8tZW1wdHk6MCovXG4gICAgfSBlbHNlIHtcbiAgICAgIGJyZWFrO1xuICAgIH1cbiAgfVxuXG4gIC8vIFtsYWJlbF06ICAgZGVzdGluYXRpb24gICAndGl0bGUnXG4gIC8vICAgICAgICAgICAgICAgICAgICAgICAgICBeXl5eXl5eIHBhcnNlIHRoaXNcbiAgcmVzID0gcGFyc2VMaW5rVGl0bGUoc3RyLCBwb3MsIG1heCk7XG4gIGlmIChwb3MgPCBtYXggJiYgc3RhcnQgIT09IHBvcyAmJiByZXMub2spIHtcbiAgICB0aXRsZSA9IHJlcy5zdHI7XG4gICAgcG9zID0gcmVzLnBvcztcbiAgICBsaW5lcyArPSByZXMubGluZXM7XG4gIH0gZWxzZSB7XG4gICAgdGl0bGUgPSAnJztcbiAgICBwb3MgPSBkZXN0RW5kUG9zO1xuICAgIGxpbmVzID0gZGVzdEVuZExpbmVObztcbiAgfVxuXG4gIC8vIHNraXAgdHJhaWxpbmcgc3BhY2VzIHVudGlsIHRoZSByZXN0IG9mIHRoZSBsaW5lXG4gIHdoaWxlIChwb3MgPCBtYXggJiYgc3RyLmNoYXJDb2RlQXQocG9zKSA9PT0gMHgyMC8qIHNwYWNlICovKSB7IHBvcysrOyB9XG5cbiAgaWYgKHBvcyA8IG1heCAmJiBzdHIuY2hhckNvZGVBdChwb3MpICE9PSAweDBBKSB7XG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICAvLyBnYXJiYWdlIGF0IHRoZSBlbmQgb2YgdGhlIGxpbmUgYWZ0ZXIgdGl0bGUsXG4gICAgICAvLyBidXQgaXQgY291bGQgc3RpbGwgYmUgYSB2YWxpZCByZWZlcmVuY2UgaWYgd2Ugcm9sbCBiYWNrXG4gICAgICB0aXRsZSA9ICcnO1xuICAgICAgcG9zID0gZGVzdEVuZFBvcztcbiAgICAgIGxpbmVzID0gZGVzdEVuZExpbmVObztcbiAgICAgIHdoaWxlIChwb3MgPCBtYXggJiYgc3RyLmNoYXJDb2RlQXQocG9zKSA9PT0gMHgyMC8qIHNwYWNlICovKSB7IHBvcysrOyB9XG4gICAgfVxuICB9XG5cbiAgaWYgKHBvcyA8IG1heCAmJiBzdHIuY2hhckNvZGVBdChwb3MpICE9PSAweDBBKSB7XG4gICAgLy8gZ2FyYmFnZSBhdCB0aGUgZW5kIG9mIHRoZSBsaW5lXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgbGFiZWwgPSBub3JtYWxpemVSZWZlcmVuY2Uoc3RyLnNsaWNlKDEsIGxhYmVsRW5kKSk7XG4gIGlmICghbGFiZWwpIHtcbiAgICAvLyBDb21tb25NYXJrIDAuMjAgZGlzYWxsb3dzIGVtcHR5IGxhYmVsc1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIFJlZmVyZW5jZSBjYW4gbm90IHRlcm1pbmF0ZSBhbnl0aGluZy4gVGhpcyBjaGVjayBpcyBmb3Igc2FmZXR5IG9ubHkuXG4gIC8qaXN0YW5idWwgaWdub3JlIGlmKi9cbiAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gIGlmICh0eXBlb2Ygc3RhdGUuZW52LnJlZmVyZW5jZXMgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgc3RhdGUuZW52LnJlZmVyZW5jZXMgPSB7fTtcbiAgfVxuICBpZiAodHlwZW9mIHN0YXRlLmVudi5yZWZlcmVuY2VzW2xhYmVsXSA9PT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBzdGF0ZS5lbnYucmVmZXJlbmNlc1tsYWJlbF0gPSB7IHRpdGxlOiB0aXRsZSwgaHJlZjogaHJlZiB9O1xuICB9XG5cbiAgc3RhdGUubGluZSA9IHN0YXJ0TGluZSArIGxpbmVzICsgMTtcbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiLy8gUGFyc2VyIHN0YXRlIGNsYXNzXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIFRva2VuID0gcmVxdWlyZSgnLi4vdG9rZW4nKTtcblxuXG5mdW5jdGlvbiBTdGF0ZUJsb2NrKHNyYywgbWQsIGVudiwgdG9rZW5zKSB7XG4gIHZhciBjaCwgcywgc3RhcnQsIHBvcywgbGVuLCBpbmRlbnQsIGluZGVudF9mb3VuZDtcblxuICB0aGlzLnNyYyA9IHNyYztcblxuICAvLyBsaW5rIHRvIHBhcnNlciBpbnN0YW5jZVxuICB0aGlzLm1kICAgICA9IG1kO1xuXG4gIHRoaXMuZW52ID0gZW52O1xuXG4gIC8vXG4gIC8vIEludGVybmFsIHN0YXRlIHZhcnRpYWJsZXNcbiAgLy9cblxuICB0aGlzLnRva2VucyA9IHRva2VucztcblxuICB0aGlzLmJNYXJrcyA9IFtdOyAgLy8gbGluZSBiZWdpbiBvZmZzZXRzIGZvciBmYXN0IGp1bXBzXG4gIHRoaXMuZU1hcmtzID0gW107ICAvLyBsaW5lIGVuZCBvZmZzZXRzIGZvciBmYXN0IGp1bXBzXG4gIHRoaXMudFNoaWZ0ID0gW107ICAvLyBpbmRlbnQgZm9yIGVhY2ggbGluZVxuXG4gIC8vIGJsb2NrIHBhcnNlciB2YXJpYWJsZXNcbiAgdGhpcy5ibGtJbmRlbnQgID0gMDsgLy8gcmVxdWlyZWQgYmxvY2sgY29udGVudCBpbmRlbnRcbiAgICAgICAgICAgICAgICAgICAgICAgLy8gKGZvciBleGFtcGxlLCBpZiB3ZSBhcmUgaW4gbGlzdClcbiAgdGhpcy5saW5lICAgICAgID0gMDsgLy8gbGluZSBpbmRleCBpbiBzcmNcbiAgdGhpcy5saW5lTWF4ICAgID0gMDsgLy8gbGluZXMgY291bnRcbiAgdGhpcy50aWdodCAgICAgID0gZmFsc2U7ICAvLyBsb29zZS90aWdodCBtb2RlIGZvciBsaXN0c1xuICB0aGlzLnBhcmVudFR5cGUgPSAncm9vdCc7IC8vIGlmIGBsaXN0YCwgYmxvY2sgcGFyc2VyIHN0b3BzIG9uIHR3byBuZXdsaW5lc1xuICB0aGlzLmRkSW5kZW50ICAgPSAtMTsgLy8gaW5kZW50IG9mIHRoZSBjdXJyZW50IGRkIGJsb2NrICgtMSBpZiB0aGVyZSBpc24ndCBhbnkpXG5cbiAgdGhpcy5sZXZlbCA9IDA7XG5cbiAgLy8gcmVuZGVyZXJcbiAgdGhpcy5yZXN1bHQgPSAnJztcblxuICAvLyBDcmVhdGUgY2FjaGVzXG4gIC8vIEdlbmVyYXRlIG1hcmtlcnMuXG4gIHMgPSB0aGlzLnNyYztcbiAgaW5kZW50ID0gMDtcbiAgaW5kZW50X2ZvdW5kID0gZmFsc2U7XG5cbiAgZm9yIChzdGFydCA9IHBvcyA9IGluZGVudCA9IDAsIGxlbiA9IHMubGVuZ3RoOyBwb3MgPCBsZW47IHBvcysrKSB7XG4gICAgY2ggPSBzLmNoYXJDb2RlQXQocG9zKTtcblxuICAgIGlmICghaW5kZW50X2ZvdW5kKSB7XG4gICAgICBpZiAoY2ggPT09IDB4MjAvKiBzcGFjZSAqLykge1xuICAgICAgICBpbmRlbnQrKztcbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpbmRlbnRfZm91bmQgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChjaCA9PT0gMHgwQSB8fCBwb3MgPT09IGxlbiAtIDEpIHtcbiAgICAgIGlmIChjaCAhPT0gMHgwQSkgeyBwb3MrKzsgfVxuICAgICAgdGhpcy5iTWFya3MucHVzaChzdGFydCk7XG4gICAgICB0aGlzLmVNYXJrcy5wdXNoKHBvcyk7XG4gICAgICB0aGlzLnRTaGlmdC5wdXNoKGluZGVudCk7XG5cbiAgICAgIGluZGVudF9mb3VuZCA9IGZhbHNlO1xuICAgICAgaW5kZW50ID0gMDtcbiAgICAgIHN0YXJ0ID0gcG9zICsgMTtcbiAgICB9XG4gIH1cblxuICAvLyBQdXNoIGZha2UgZW50cnkgdG8gc2ltcGxpZnkgY2FjaGUgYm91bmRzIGNoZWNrc1xuICB0aGlzLmJNYXJrcy5wdXNoKHMubGVuZ3RoKTtcbiAgdGhpcy5lTWFya3MucHVzaChzLmxlbmd0aCk7XG4gIHRoaXMudFNoaWZ0LnB1c2goMCk7XG5cbiAgdGhpcy5saW5lTWF4ID0gdGhpcy5iTWFya3MubGVuZ3RoIC0gMTsgLy8gZG9uJ3QgY291bnQgbGFzdCBmYWtlIGxpbmVcbn1cblxuLy8gUHVzaCBuZXcgdG9rZW4gdG8gXCJzdHJlYW1cIi5cbi8vXG5TdGF0ZUJsb2NrLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24gKHR5cGUsIHRhZywgbmVzdGluZykge1xuICB2YXIgdG9rZW4gPSBuZXcgVG9rZW4odHlwZSwgdGFnLCBuZXN0aW5nKTtcbiAgdG9rZW4uYmxvY2sgPSB0cnVlO1xuXG4gIGlmIChuZXN0aW5nIDwgMCkgeyB0aGlzLmxldmVsLS07IH1cbiAgdG9rZW4ubGV2ZWwgPSB0aGlzLmxldmVsO1xuICBpZiAobmVzdGluZyA+IDApIHsgdGhpcy5sZXZlbCsrOyB9XG5cbiAgdGhpcy50b2tlbnMucHVzaCh0b2tlbik7XG4gIHJldHVybiB0b2tlbjtcbn07XG5cblN0YXRlQmxvY2sucHJvdG90eXBlLmlzRW1wdHkgPSBmdW5jdGlvbiBpc0VtcHR5KGxpbmUpIHtcbiAgcmV0dXJuIHRoaXMuYk1hcmtzW2xpbmVdICsgdGhpcy50U2hpZnRbbGluZV0gPj0gdGhpcy5lTWFya3NbbGluZV07XG59O1xuXG5TdGF0ZUJsb2NrLnByb3RvdHlwZS5za2lwRW1wdHlMaW5lcyA9IGZ1bmN0aW9uIHNraXBFbXB0eUxpbmVzKGZyb20pIHtcbiAgZm9yICh2YXIgbWF4ID0gdGhpcy5saW5lTWF4OyBmcm9tIDwgbWF4OyBmcm9tKyspIHtcbiAgICBpZiAodGhpcy5iTWFya3NbZnJvbV0gKyB0aGlzLnRTaGlmdFtmcm9tXSA8IHRoaXMuZU1hcmtzW2Zyb21dKSB7XG4gICAgICBicmVhaztcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGZyb207XG59O1xuXG4vLyBTa2lwIHNwYWNlcyBmcm9tIGdpdmVuIHBvc2l0aW9uLlxuU3RhdGVCbG9jay5wcm90b3R5cGUuc2tpcFNwYWNlcyA9IGZ1bmN0aW9uIHNraXBTcGFjZXMocG9zKSB7XG4gIGZvciAodmFyIG1heCA9IHRoaXMuc3JjLmxlbmd0aDsgcG9zIDwgbWF4OyBwb3MrKykge1xuICAgIGlmICh0aGlzLnNyYy5jaGFyQ29kZUF0KHBvcykgIT09IDB4MjAvKiBzcGFjZSAqLykgeyBicmVhazsgfVxuICB9XG4gIHJldHVybiBwb3M7XG59O1xuXG4vLyBTa2lwIGNoYXIgY29kZXMgZnJvbSBnaXZlbiBwb3NpdGlvblxuU3RhdGVCbG9jay5wcm90b3R5cGUuc2tpcENoYXJzID0gZnVuY3Rpb24gc2tpcENoYXJzKHBvcywgY29kZSkge1xuICBmb3IgKHZhciBtYXggPSB0aGlzLnNyYy5sZW5ndGg7IHBvcyA8IG1heDsgcG9zKyspIHtcbiAgICBpZiAodGhpcy5zcmMuY2hhckNvZGVBdChwb3MpICE9PSBjb2RlKSB7IGJyZWFrOyB9XG4gIH1cbiAgcmV0dXJuIHBvcztcbn07XG5cbi8vIFNraXAgY2hhciBjb2RlcyByZXZlcnNlIGZyb20gZ2l2ZW4gcG9zaXRpb24gLSAxXG5TdGF0ZUJsb2NrLnByb3RvdHlwZS5za2lwQ2hhcnNCYWNrID0gZnVuY3Rpb24gc2tpcENoYXJzQmFjayhwb3MsIGNvZGUsIG1pbikge1xuICBpZiAocG9zIDw9IG1pbikgeyByZXR1cm4gcG9zOyB9XG5cbiAgd2hpbGUgKHBvcyA+IG1pbikge1xuICAgIGlmIChjb2RlICE9PSB0aGlzLnNyYy5jaGFyQ29kZUF0KC0tcG9zKSkgeyByZXR1cm4gcG9zICsgMTsgfVxuICB9XG4gIHJldHVybiBwb3M7XG59O1xuXG4vLyBjdXQgbGluZXMgcmFuZ2UgZnJvbSBzb3VyY2UuXG5TdGF0ZUJsb2NrLnByb3RvdHlwZS5nZXRMaW5lcyA9IGZ1bmN0aW9uIGdldExpbmVzKGJlZ2luLCBlbmQsIGluZGVudCwga2VlcExhc3RMRikge1xuICB2YXIgaSwgZmlyc3QsIGxhc3QsIHF1ZXVlLCBzaGlmdCxcbiAgICAgIGxpbmUgPSBiZWdpbjtcblxuICBpZiAoYmVnaW4gPj0gZW5kKSB7XG4gICAgcmV0dXJuICcnO1xuICB9XG5cbiAgLy8gT3B0OiBkb24ndCB1c2UgcHVzaCBxdWV1ZSBmb3Igc2luZ2xlIGxpbmU7XG4gIGlmIChsaW5lICsgMSA9PT0gZW5kKSB7XG4gICAgZmlyc3QgPSB0aGlzLmJNYXJrc1tsaW5lXSArIE1hdGgubWluKHRoaXMudFNoaWZ0W2xpbmVdLCBpbmRlbnQpO1xuICAgIGxhc3QgPSB0aGlzLmVNYXJrc1tlbmQgLSAxXSArIChrZWVwTGFzdExGID8gMSA6IDApO1xuICAgIHJldHVybiB0aGlzLnNyYy5zbGljZShmaXJzdCwgbGFzdCk7XG4gIH1cblxuICBxdWV1ZSA9IG5ldyBBcnJheShlbmQgLSBiZWdpbik7XG5cbiAgZm9yIChpID0gMDsgbGluZSA8IGVuZDsgbGluZSsrLCBpKyspIHtcbiAgICBzaGlmdCA9IHRoaXMudFNoaWZ0W2xpbmVdO1xuICAgIGlmIChzaGlmdCA+IGluZGVudCkgeyBzaGlmdCA9IGluZGVudDsgfVxuICAgIGlmIChzaGlmdCA8IDApIHsgc2hpZnQgPSAwOyB9XG5cbiAgICBmaXJzdCA9IHRoaXMuYk1hcmtzW2xpbmVdICsgc2hpZnQ7XG5cbiAgICBpZiAobGluZSArIDEgPCBlbmQgfHwga2VlcExhc3RMRikge1xuICAgICAgLy8gTm8gbmVlZCBmb3IgYm91bmRzIGNoZWNrIGJlY2F1c2Ugd2UgaGF2ZSBmYWtlIGVudHJ5IG9uIHRhaWwuXG4gICAgICBsYXN0ID0gdGhpcy5lTWFya3NbbGluZV0gKyAxO1xuICAgIH0gZWxzZSB7XG4gICAgICBsYXN0ID0gdGhpcy5lTWFya3NbbGluZV07XG4gICAgfVxuXG4gICAgcXVldWVbaV0gPSB0aGlzLnNyYy5zbGljZShmaXJzdCwgbGFzdCk7XG4gIH1cblxuICByZXR1cm4gcXVldWUuam9pbignJyk7XG59O1xuXG4vLyByZS1leHBvcnQgVG9rZW4gY2xhc3MgdG8gdXNlIGluIGJsb2NrIHJ1bGVzXG5TdGF0ZUJsb2NrLnByb3RvdHlwZS5Ub2tlbiA9IFRva2VuO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVCbG9jaztcbiIsIi8vIEdGTSB0YWJsZSwgbm9uLXN0YW5kYXJkXG5cbid1c2Ugc3RyaWN0JztcblxuXG5mdW5jdGlvbiBnZXRMaW5lKHN0YXRlLCBsaW5lKSB7XG4gIHZhciBwb3MgPSBzdGF0ZS5iTWFya3NbbGluZV0gKyBzdGF0ZS5ibGtJbmRlbnQsXG4gICAgICBtYXggPSBzdGF0ZS5lTWFya3NbbGluZV07XG5cbiAgcmV0dXJuIHN0YXRlLnNyYy5zdWJzdHIocG9zLCBtYXggLSBwb3MpO1xufVxuXG5mdW5jdGlvbiBlc2NhcGVkU3BsaXQoc3RyKSB7XG4gIHZhciByZXN1bHQgPSBbXSxcbiAgICAgIHBvcyA9IDAsXG4gICAgICBtYXggPSBzdHIubGVuZ3RoLFxuICAgICAgY2gsXG4gICAgICBlc2NhcGVzID0gMCxcbiAgICAgIGxhc3RQb3MgPSAwLFxuICAgICAgYmFja1RpY2tlZCA9IGZhbHNlLFxuICAgICAgbGFzdEJhY2tUaWNrID0gMDtcblxuICBjaCAgPSBzdHIuY2hhckNvZGVBdChwb3MpO1xuXG4gIHdoaWxlIChwb3MgPCBtYXgpIHtcbiAgICBpZiAoY2ggPT09IDB4NjAvKiBgICovICYmIChlc2NhcGVzICUgMiA9PT0gMCkpIHtcbiAgICAgIGJhY2tUaWNrZWQgPSAhYmFja1RpY2tlZDtcbiAgICAgIGxhc3RCYWNrVGljayA9IHBvcztcbiAgICB9IGVsc2UgaWYgKGNoID09PSAweDdjLyogfCAqLyAmJiAoZXNjYXBlcyAlIDIgPT09IDApICYmICFiYWNrVGlja2VkKSB7XG4gICAgICByZXN1bHQucHVzaChzdHIuc3Vic3RyaW5nKGxhc3RQb3MsIHBvcykpO1xuICAgICAgbGFzdFBvcyA9IHBvcyArIDE7XG4gICAgfSBlbHNlIGlmIChjaCA9PT0gMHg1Yy8qIFxcICovKSB7XG4gICAgICBlc2NhcGVzKys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGVzY2FwZXMgPSAwO1xuICAgIH1cblxuICAgIHBvcysrO1xuXG4gICAgLy8gSWYgdGhlcmUgd2FzIGFuIHVuLWNsb3NlZCBiYWNrdGljaywgZ28gYmFjayB0byBqdXN0IGFmdGVyXG4gICAgLy8gdGhlIGxhc3QgYmFja3RpY2ssIGJ1dCBhcyBpZiBpdCB3YXMgYSBub3JtYWwgY2hhcmFjdGVyXG4gICAgaWYgKHBvcyA9PT0gbWF4ICYmIGJhY2tUaWNrZWQpIHtcbiAgICAgIGJhY2tUaWNrZWQgPSBmYWxzZTtcbiAgICAgIHBvcyA9IGxhc3RCYWNrVGljayArIDE7XG4gICAgfVxuXG4gICAgY2ggPSBzdHIuY2hhckNvZGVBdChwb3MpO1xuICB9XG5cbiAgcmVzdWx0LnB1c2goc3RyLnN1YnN0cmluZyhsYXN0UG9zKSk7XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRhYmxlKHN0YXRlLCBzdGFydExpbmUsIGVuZExpbmUsIHNpbGVudCkge1xuICB2YXIgY2gsIGxpbmVUZXh0LCBwb3MsIGksIG5leHRMaW5lLCByb3dzLCB0b2tlbixcbiAgICAgIGFsaWducywgdCwgdGFibGVMaW5lcywgdGJvZHlMaW5lcztcblxuICAvLyBzaG91bGQgaGF2ZSBhdCBsZWFzdCB0aHJlZSBsaW5lc1xuICBpZiAoc3RhcnRMaW5lICsgMiA+IGVuZExpbmUpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgbmV4dExpbmUgPSBzdGFydExpbmUgKyAxO1xuXG4gIGlmIChzdGF0ZS50U2hpZnRbbmV4dExpbmVdIDwgc3RhdGUuYmxrSW5kZW50KSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIC8vIGZpcnN0IGNoYXJhY3RlciBvZiB0aGUgc2Vjb25kIGxpbmUgc2hvdWxkIGJlICd8JyBvciAnLSdcblxuICBwb3MgPSBzdGF0ZS5iTWFya3NbbmV4dExpbmVdICsgc3RhdGUudFNoaWZ0W25leHRMaW5lXTtcbiAgaWYgKHBvcyA+PSBzdGF0ZS5lTWFya3NbbmV4dExpbmVdKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKTtcbiAgaWYgKGNoICE9PSAweDdDLyogfCAqLyAmJiBjaCAhPT0gMHgyRC8qIC0gKi8gJiYgY2ggIT09IDB4M0EvKiA6ICovKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGxpbmVUZXh0ID0gZ2V0TGluZShzdGF0ZSwgc3RhcnRMaW5lICsgMSk7XG4gIGlmICghL15bLTp8IF0rJC8udGVzdChsaW5lVGV4dCkpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgcm93cyA9IGxpbmVUZXh0LnNwbGl0KCd8Jyk7XG4gIGlmIChyb3dzLmxlbmd0aCA8IDIpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIGFsaWducyA9IFtdO1xuICBmb3IgKGkgPSAwOyBpIDwgcm93cy5sZW5ndGg7IGkrKykge1xuICAgIHQgPSByb3dzW2ldLnRyaW0oKTtcbiAgICBpZiAoIXQpIHtcbiAgICAgIC8vIGFsbG93IGVtcHR5IGNvbHVtbnMgYmVmb3JlIGFuZCBhZnRlciB0YWJsZSwgYnV0IG5vdCBpbiBiZXR3ZWVuIGNvbHVtbnM7XG4gICAgICAvLyBlLmcuIGFsbG93IGAgfC0tLXwgYCwgZGlzYWxsb3cgYCAtLS18fC0tLSBgXG4gICAgICBpZiAoaSA9PT0gMCB8fCBpID09PSByb3dzLmxlbmd0aCAtIDEpIHtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKCEvXjo/LSs6PyQvLnRlc3QodCkpIHsgcmV0dXJuIGZhbHNlOyB9XG4gICAgaWYgKHQuY2hhckNvZGVBdCh0Lmxlbmd0aCAtIDEpID09PSAweDNBLyogOiAqLykge1xuICAgICAgYWxpZ25zLnB1c2godC5jaGFyQ29kZUF0KDApID09PSAweDNBLyogOiAqLyA/ICdjZW50ZXInIDogJ3JpZ2h0Jyk7XG4gICAgfSBlbHNlIGlmICh0LmNoYXJDb2RlQXQoMCkgPT09IDB4M0EvKiA6ICovKSB7XG4gICAgICBhbGlnbnMucHVzaCgnbGVmdCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICBhbGlnbnMucHVzaCgnJyk7XG4gICAgfVxuICB9XG5cbiAgbGluZVRleHQgPSBnZXRMaW5lKHN0YXRlLCBzdGFydExpbmUpLnRyaW0oKTtcbiAgaWYgKGxpbmVUZXh0LmluZGV4T2YoJ3wnKSA9PT0gLTEpIHsgcmV0dXJuIGZhbHNlOyB9XG4gIHJvd3MgPSBlc2NhcGVkU3BsaXQobGluZVRleHQucmVwbGFjZSgvXlxcfHxcXHwkL2csICcnKSk7XG4gIGlmIChhbGlnbnMubGVuZ3RoICE9PSByb3dzLmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgaWYgKHNpbGVudCkgeyByZXR1cm4gdHJ1ZTsgfVxuXG4gIHRva2VuICAgICA9IHN0YXRlLnB1c2goJ3RhYmxlX29wZW4nLCAndGFibGUnLCAxKTtcbiAgdG9rZW4ubWFwID0gdGFibGVMaW5lcyA9IFsgc3RhcnRMaW5lLCAwIF07XG5cbiAgdG9rZW4gICAgID0gc3RhdGUucHVzaCgndGhlYWRfb3BlbicsICd0aGVhZCcsIDEpO1xuICB0b2tlbi5tYXAgPSBbIHN0YXJ0TGluZSwgc3RhcnRMaW5lICsgMSBdO1xuXG4gIHRva2VuICAgICA9IHN0YXRlLnB1c2goJ3RyX29wZW4nLCAndHInLCAxKTtcbiAgdG9rZW4ubWFwID0gWyBzdGFydExpbmUsIHN0YXJ0TGluZSArIDEgXTtcblxuICBmb3IgKGkgPSAwOyBpIDwgcm93cy5sZW5ndGg7IGkrKykge1xuICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgndGhfb3BlbicsICd0aCcsIDEpO1xuICAgIHRva2VuLm1hcCAgICAgID0gWyBzdGFydExpbmUsIHN0YXJ0TGluZSArIDEgXTtcbiAgICBpZiAoYWxpZ25zW2ldKSB7XG4gICAgICB0b2tlbi5hdHRycyAgPSBbIFsgJ3N0eWxlJywgJ3RleHQtYWxpZ246JyArIGFsaWduc1tpXSBdIF07XG4gICAgfVxuXG4gICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdpbmxpbmUnLCAnJywgMCk7XG4gICAgdG9rZW4uY29udGVudCAgPSByb3dzW2ldLnRyaW0oKTtcbiAgICB0b2tlbi5tYXAgICAgICA9IFsgc3RhcnRMaW5lLCBzdGFydExpbmUgKyAxIF07XG4gICAgdG9rZW4uY2hpbGRyZW4gPSBbXTtcblxuICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgndGhfY2xvc2UnLCAndGgnLCAtMSk7XG4gIH1cblxuICB0b2tlbiAgICAgPSBzdGF0ZS5wdXNoKCd0cl9jbG9zZScsICd0cicsIC0xKTtcbiAgdG9rZW4gICAgID0gc3RhdGUucHVzaCgndGhlYWRfY2xvc2UnLCAndGhlYWQnLCAtMSk7XG5cbiAgdG9rZW4gICAgID0gc3RhdGUucHVzaCgndGJvZHlfb3BlbicsICd0Ym9keScsIDEpO1xuICB0b2tlbi5tYXAgPSB0Ym9keUxpbmVzID0gWyBzdGFydExpbmUgKyAyLCAwIF07XG5cbiAgZm9yIChuZXh0TGluZSA9IHN0YXJ0TGluZSArIDI7IG5leHRMaW5lIDwgZW5kTGluZTsgbmV4dExpbmUrKykge1xuICAgIGlmIChzdGF0ZS50U2hpZnRbbmV4dExpbmVdIDwgc3RhdGUuYmxrSW5kZW50KSB7IGJyZWFrOyB9XG5cbiAgICBsaW5lVGV4dCA9IGdldExpbmUoc3RhdGUsIG5leHRMaW5lKS50cmltKCk7XG4gICAgaWYgKGxpbmVUZXh0LmluZGV4T2YoJ3wnKSA9PT0gLTEpIHsgYnJlYWs7IH1cbiAgICByb3dzID0gZXNjYXBlZFNwbGl0KGxpbmVUZXh0LnJlcGxhY2UoL15cXHx8XFx8JC9nLCAnJykpO1xuXG4gICAgLy8gc2V0IG51bWJlciBvZiBjb2x1bW5zIHRvIG51bWJlciBvZiBjb2x1bW5zIGluIGhlYWRlciByb3dcbiAgICByb3dzLmxlbmd0aCA9IGFsaWducy5sZW5ndGg7XG5cbiAgICB0b2tlbiA9IHN0YXRlLnB1c2goJ3RyX29wZW4nLCAndHInLCAxKTtcbiAgICBmb3IgKGkgPSAwOyBpIDwgcm93cy5sZW5ndGg7IGkrKykge1xuICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCd0ZF9vcGVuJywgJ3RkJywgMSk7XG4gICAgICBpZiAoYWxpZ25zW2ldKSB7XG4gICAgICAgIHRva2VuLmF0dHJzICA9IFsgWyAnc3R5bGUnLCAndGV4dC1hbGlnbjonICsgYWxpZ25zW2ldIF0gXTtcbiAgICAgIH1cblxuICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCdpbmxpbmUnLCAnJywgMCk7XG4gICAgICB0b2tlbi5jb250ZW50ICA9IHJvd3NbaV0gPyByb3dzW2ldLnRyaW0oKSA6ICcnO1xuICAgICAgdG9rZW4uY2hpbGRyZW4gPSBbXTtcblxuICAgICAgdG9rZW4gICAgICAgICAgPSBzdGF0ZS5wdXNoKCd0ZF9jbG9zZScsICd0ZCcsIC0xKTtcbiAgICB9XG4gICAgdG9rZW4gPSBzdGF0ZS5wdXNoKCd0cl9jbG9zZScsICd0cicsIC0xKTtcbiAgfVxuICB0b2tlbiA9IHN0YXRlLnB1c2goJ3Rib2R5X2Nsb3NlJywgJ3Rib2R5JywgLTEpO1xuICB0b2tlbiA9IHN0YXRlLnB1c2goJ3RhYmxlX2Nsb3NlJywgJ3RhYmxlJywgLTEpO1xuXG4gIHRhYmxlTGluZXNbMV0gPSB0Ym9keUxpbmVzWzFdID0gbmV4dExpbmU7XG4gIHN0YXRlLmxpbmUgPSBuZXh0TGluZTtcbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gYmxvY2soc3RhdGUpIHtcbiAgdmFyIHRva2VuO1xuXG4gIGlmIChzdGF0ZS5pbmxpbmVNb2RlKSB7XG4gICAgdG9rZW4gICAgICAgICAgPSBuZXcgc3RhdGUuVG9rZW4oJ2lubGluZScsICcnLCAwKTtcbiAgICB0b2tlbi5jb250ZW50ICA9IHN0YXRlLnNyYztcbiAgICB0b2tlbi5tYXAgICAgICA9IFsgMCwgMSBdO1xuICAgIHRva2VuLmNoaWxkcmVuID0gW107XG4gICAgc3RhdGUudG9rZW5zLnB1c2godG9rZW4pO1xuICB9IGVsc2Uge1xuICAgIHN0YXRlLm1kLmJsb2NrLnBhcnNlKHN0YXRlLnNyYywgc3RhdGUubWQsIHN0YXRlLmVudiwgc3RhdGUudG9rZW5zKTtcbiAgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpbmxpbmUoc3RhdGUpIHtcbiAgdmFyIHRva2VucyA9IHN0YXRlLnRva2VucywgdG9rLCBpLCBsO1xuXG4gIC8vIFBhcnNlIGlubGluZXNcbiAgZm9yIChpID0gMCwgbCA9IHRva2Vucy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICB0b2sgPSB0b2tlbnNbaV07XG4gICAgaWYgKHRvay50eXBlID09PSAnaW5saW5lJykge1xuICAgICAgc3RhdGUubWQuaW5saW5lLnBhcnNlKHRvay5jb250ZW50LCBzdGF0ZS5tZCwgc3RhdGUuZW52LCB0b2suY2hpbGRyZW4pO1xuICAgIH1cbiAgfVxufTtcbiIsIi8vIFJlcGxhY2UgbGluay1saWtlIHRleHRzIHdpdGggbGluayBub2Rlcy5cbi8vXG4vLyBDdXJyZW50bHkgcmVzdHJpY3RlZCBieSBgbWQudmFsaWRhdGVMaW5rKClgIHRvIGh0dHAvaHR0cHMvZnRwXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBhcnJheVJlcGxhY2VBdCA9IHJlcXVpcmUoJy4uL2NvbW1vbi91dGlscycpLmFycmF5UmVwbGFjZUF0O1xuXG5cbmZ1bmN0aW9uIGlzTGlua09wZW4oc3RyKSB7XG4gIHJldHVybiAvXjxhWz5cXHNdL2kudGVzdChzdHIpO1xufVxuZnVuY3Rpb24gaXNMaW5rQ2xvc2Uoc3RyKSB7XG4gIHJldHVybiAvXjxcXC9hXFxzKj4vaS50ZXN0KHN0cik7XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBsaW5raWZ5KHN0YXRlKSB7XG4gIHZhciBpLCBqLCBsLCB0b2tlbnMsIHRva2VuLCBjdXJyZW50VG9rZW4sIG5vZGVzLCBsbiwgdGV4dCwgcG9zLCBsYXN0UG9zLFxuICAgICAgbGV2ZWwsIGh0bWxMaW5rTGV2ZWwsIHVybCwgZnVsbFVybCwgdXJsVGV4dCxcbiAgICAgIGJsb2NrVG9rZW5zID0gc3RhdGUudG9rZW5zLFxuICAgICAgbGlua3M7XG5cbiAgaWYgKCFzdGF0ZS5tZC5vcHRpb25zLmxpbmtpZnkpIHsgcmV0dXJuOyB9XG5cbiAgZm9yIChqID0gMCwgbCA9IGJsb2NrVG9rZW5zLmxlbmd0aDsgaiA8IGw7IGorKykge1xuICAgIGlmIChibG9ja1Rva2Vuc1tqXS50eXBlICE9PSAnaW5saW5lJyB8fFxuICAgICAgICAhc3RhdGUubWQubGlua2lmeS5wcmV0ZXN0KGJsb2NrVG9rZW5zW2pdLmNvbnRlbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICB0b2tlbnMgPSBibG9ja1Rva2Vuc1tqXS5jaGlsZHJlbjtcblxuICAgIGh0bWxMaW5rTGV2ZWwgPSAwO1xuXG4gICAgLy8gV2Ugc2NhbiBmcm9tIHRoZSBlbmQsIHRvIGtlZXAgcG9zaXRpb24gd2hlbiBuZXcgdGFncyBhZGRlZC5cbiAgICAvLyBVc2UgcmV2ZXJzZWQgbG9naWMgaW4gbGlua3Mgc3RhcnQvZW5kIG1hdGNoXG4gICAgZm9yIChpID0gdG9rZW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICBjdXJyZW50VG9rZW4gPSB0b2tlbnNbaV07XG5cbiAgICAgIC8vIFNraXAgY29udGVudCBvZiBtYXJrZG93biBsaW5rc1xuICAgICAgaWYgKGN1cnJlbnRUb2tlbi50eXBlID09PSAnbGlua19jbG9zZScpIHtcbiAgICAgICAgaS0tO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2ldLmxldmVsICE9PSBjdXJyZW50VG9rZW4ubGV2ZWwgJiYgdG9rZW5zW2ldLnR5cGUgIT09ICdsaW5rX29wZW4nKSB7XG4gICAgICAgICAgaS0tO1xuICAgICAgICB9XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICAvLyBTa2lwIGNvbnRlbnQgb2YgaHRtbCB0YWcgbGlua3NcbiAgICAgIGlmIChjdXJyZW50VG9rZW4udHlwZSA9PT0gJ2h0bWxfaW5saW5lJykge1xuICAgICAgICBpZiAoaXNMaW5rT3BlbihjdXJyZW50VG9rZW4uY29udGVudCkgJiYgaHRtbExpbmtMZXZlbCA+IDApIHtcbiAgICAgICAgICBodG1sTGlua0xldmVsLS07XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzTGlua0Nsb3NlKGN1cnJlbnRUb2tlbi5jb250ZW50KSkge1xuICAgICAgICAgIGh0bWxMaW5rTGV2ZWwrKztcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgaWYgKGh0bWxMaW5rTGV2ZWwgPiAwKSB7IGNvbnRpbnVlOyB9XG5cbiAgICAgIGlmIChjdXJyZW50VG9rZW4udHlwZSA9PT0gJ3RleHQnICYmIHN0YXRlLm1kLmxpbmtpZnkudGVzdChjdXJyZW50VG9rZW4uY29udGVudCkpIHtcblxuICAgICAgICB0ZXh0ID0gY3VycmVudFRva2VuLmNvbnRlbnQ7XG4gICAgICAgIGxpbmtzID0gc3RhdGUubWQubGlua2lmeS5tYXRjaCh0ZXh0KTtcblxuICAgICAgICAvLyBOb3cgc3BsaXQgc3RyaW5nIHRvIG5vZGVzXG4gICAgICAgIG5vZGVzID0gW107XG4gICAgICAgIGxldmVsID0gY3VycmVudFRva2VuLmxldmVsO1xuICAgICAgICBsYXN0UG9zID0gMDtcblxuICAgICAgICBmb3IgKGxuID0gMDsgbG4gPCBsaW5rcy5sZW5ndGg7IGxuKyspIHtcblxuICAgICAgICAgIHVybCA9IGxpbmtzW2xuXS51cmw7XG4gICAgICAgICAgZnVsbFVybCA9IHN0YXRlLm1kLm5vcm1hbGl6ZUxpbmsodXJsKTtcbiAgICAgICAgICBpZiAoIXN0YXRlLm1kLnZhbGlkYXRlTGluayhmdWxsVXJsKSkgeyBjb250aW51ZTsgfVxuXG4gICAgICAgICAgdXJsVGV4dCA9IGxpbmtzW2xuXS50ZXh0O1xuXG4gICAgICAgICAgLy8gTGlua2lmaWVyIG1pZ2h0IHNlbmQgcmF3IGhvc3RuYW1lcyBsaWtlIFwiZXhhbXBsZS5jb21cIiwgd2hlcmUgdXJsXG4gICAgICAgICAgLy8gc3RhcnRzIHdpdGggZG9tYWluIG5hbWUuIFNvIHdlIHByZXBlbmQgaHR0cDovLyBpbiB0aG9zZSBjYXNlcyxcbiAgICAgICAgICAvLyBhbmQgcmVtb3ZlIGl0IGFmdGVyd2FyZHMuXG4gICAgICAgICAgLy9cbiAgICAgICAgICBpZiAoIWxpbmtzW2xuXS5zY2hlbWEpIHtcbiAgICAgICAgICAgIHVybFRleHQgPSBzdGF0ZS5tZC5ub3JtYWxpemVMaW5rVGV4dCgnaHR0cDovLycgKyB1cmxUZXh0KS5yZXBsYWNlKC9eaHR0cDpcXC9cXC8vLCAnJyk7XG4gICAgICAgICAgfSBlbHNlIGlmIChsaW5rc1tsbl0uc2NoZW1hID09PSAnbWFpbHRvOicgJiYgIS9ebWFpbHRvOi9pLnRlc3QodXJsVGV4dCkpIHtcbiAgICAgICAgICAgIHVybFRleHQgPSBzdGF0ZS5tZC5ub3JtYWxpemVMaW5rVGV4dCgnbWFpbHRvOicgKyB1cmxUZXh0KS5yZXBsYWNlKC9ebWFpbHRvOi8sICcnKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdXJsVGV4dCA9IHN0YXRlLm1kLm5vcm1hbGl6ZUxpbmtUZXh0KHVybFRleHQpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHBvcyA9IGxpbmtzW2xuXS5pbmRleDtcblxuICAgICAgICAgIGlmIChwb3MgPiBsYXN0UG9zKSB7XG4gICAgICAgICAgICB0b2tlbiAgICAgICAgID0gbmV3IHN0YXRlLlRva2VuKCd0ZXh0JywgJycsIDApO1xuICAgICAgICAgICAgdG9rZW4uY29udGVudCA9IHRleHQuc2xpY2UobGFzdFBvcywgcG9zKTtcbiAgICAgICAgICAgIHRva2VuLmxldmVsICAgPSBsZXZlbDtcbiAgICAgICAgICAgIG5vZGVzLnB1c2godG9rZW4pO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHRva2VuICAgICAgICAgPSBuZXcgc3RhdGUuVG9rZW4oJ2xpbmtfb3BlbicsICdhJywgMSk7XG4gICAgICAgICAgdG9rZW4uYXR0cnMgICA9IFsgWyAnaHJlZicsIGZ1bGxVcmwgXSBdO1xuICAgICAgICAgIHRva2VuLmxldmVsICAgPSBsZXZlbCsrO1xuICAgICAgICAgIHRva2VuLm1hcmt1cCAgPSAnbGlua2lmeSc7XG4gICAgICAgICAgdG9rZW4uaW5mbyAgICA9ICdhdXRvJztcbiAgICAgICAgICBub2Rlcy5wdXNoKHRva2VuKTtcblxuICAgICAgICAgIHRva2VuICAgICAgICAgPSBuZXcgc3RhdGUuVG9rZW4oJ3RleHQnLCAnJywgMCk7XG4gICAgICAgICAgdG9rZW4uY29udGVudCA9IHVybFRleHQ7XG4gICAgICAgICAgdG9rZW4ubGV2ZWwgICA9IGxldmVsO1xuICAgICAgICAgIG5vZGVzLnB1c2godG9rZW4pO1xuXG4gICAgICAgICAgdG9rZW4gICAgICAgICA9IG5ldyBzdGF0ZS5Ub2tlbignbGlua19jbG9zZScsICdhJywgLTEpO1xuICAgICAgICAgIHRva2VuLmxldmVsICAgPSAtLWxldmVsO1xuICAgICAgICAgIHRva2VuLm1hcmt1cCAgPSAnbGlua2lmeSc7XG4gICAgICAgICAgdG9rZW4uaW5mbyAgICA9ICdhdXRvJztcbiAgICAgICAgICBub2Rlcy5wdXNoKHRva2VuKTtcblxuICAgICAgICAgIGxhc3RQb3MgPSBsaW5rc1tsbl0ubGFzdEluZGV4O1xuICAgICAgICB9XG4gICAgICAgIGlmIChsYXN0UG9zIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgICAgICB0b2tlbiAgICAgICAgID0gbmV3IHN0YXRlLlRva2VuKCd0ZXh0JywgJycsIDApO1xuICAgICAgICAgIHRva2VuLmNvbnRlbnQgPSB0ZXh0LnNsaWNlKGxhc3RQb3MpO1xuICAgICAgICAgIHRva2VuLmxldmVsICAgPSBsZXZlbDtcbiAgICAgICAgICBub2Rlcy5wdXNoKHRva2VuKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIHJlcGxhY2UgY3VycmVudCBub2RlXG4gICAgICAgIGJsb2NrVG9rZW5zW2pdLmNoaWxkcmVuID0gdG9rZW5zID0gYXJyYXlSZXBsYWNlQXQodG9rZW5zLCBpLCBub2Rlcyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuIiwiLy8gTm9ybWFsaXplIGlucHV0IHN0cmluZ1xuXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIFRBQlNfU0NBTl9SRSA9IC9bXFxuXFx0XS9nO1xudmFyIE5FV0xJTkVTX1JFICA9IC9cXHJbXFxuXFx1MDA4NV18W1xcdTI0MjRcXHUyMDI4XFx1MDA4NV0vZztcbnZhciBOVUxMX1JFICAgICAgPSAvXFx1MDAwMC9nO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW5saW5lKHN0YXRlKSB7XG4gIHZhciBzdHIsIGxpbmVTdGFydCwgbGFzdFRhYlBvcztcblxuICAvLyBOb3JtYWxpemUgbmV3bGluZXNcbiAgc3RyID0gc3RhdGUuc3JjLnJlcGxhY2UoTkVXTElORVNfUkUsICdcXG4nKTtcblxuICAvLyBSZXBsYWNlIE5VTEwgY2hhcmFjdGVyc1xuICBzdHIgPSBzdHIucmVwbGFjZShOVUxMX1JFLCAnXFx1RkZGRCcpO1xuXG4gIC8vIFJlcGxhY2UgdGFicyB3aXRoIHByb3BlciBudW1iZXIgb2Ygc3BhY2VzICgxLi40KVxuICBpZiAoc3RyLmluZGV4T2YoJ1xcdCcpID49IDApIHtcbiAgICBsaW5lU3RhcnQgPSAwO1xuICAgIGxhc3RUYWJQb3MgPSAwO1xuXG4gICAgc3RyID0gc3RyLnJlcGxhY2UoVEFCU19TQ0FOX1JFLCBmdW5jdGlvbiAobWF0Y2gsIG9mZnNldCkge1xuICAgICAgdmFyIHJlc3VsdDtcbiAgICAgIGlmIChzdHIuY2hhckNvZGVBdChvZmZzZXQpID09PSAweDBBKSB7XG4gICAgICAgIGxpbmVTdGFydCA9IG9mZnNldCArIDE7XG4gICAgICAgIGxhc3RUYWJQb3MgPSAwO1xuICAgICAgICByZXR1cm4gbWF0Y2g7XG4gICAgICB9XG4gICAgICByZXN1bHQgPSAnICAgICcuc2xpY2UoKG9mZnNldCAtIGxpbmVTdGFydCAtIGxhc3RUYWJQb3MpICUgNCk7XG4gICAgICBsYXN0VGFiUG9zID0gb2Zmc2V0IC0gbGluZVN0YXJ0ICsgMTtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfSk7XG4gIH1cblxuICBzdGF0ZS5zcmMgPSBzdHI7XG59O1xuIiwiLy8gU2ltcGxlIHR5cG9ncmFwaHljIHJlcGxhY2VtZW50c1xuLy9cbi8vIChjKSAoQykg4oaSIMKpXG4vLyAodG0pIChUTSkg4oaSIOKEolxuLy8gKHIpIChSKSDihpIgwq5cbi8vICstIOKGkiDCsVxuLy8gKHApIChQKSAtPiDCp1xuLy8gLi4uIOKGkiDigKYgKGFsc28gPy4uLi4g4oaSID8uLiwgIS4uLi4g4oaSICEuLilcbi8vID8/Pz8/Pz8/IOKGkiA/Pz8sICEhISEhIOKGkiAhISEsIGAsLGAg4oaSIGAsYFxuLy8gLS0g4oaSICZuZGFzaDssIC0tLSDihpIgJm1kYXNoO1xuLy9cbid1c2Ugc3RyaWN0JztcblxuLy8gVE9ETzpcbi8vIC0gZnJhY3Rpb25hbHMgMS8yLCAxLzQsIDMvNCAtPiDCvSwgwrwsIMK+XG4vLyAtIG1pbHRpcGxpY2F0aW9uIDIgeCA0IC0+IDIgw5cgNFxuXG52YXIgUkFSRV9SRSA9IC9cXCstfFxcLlxcLnxcXD9cXD9cXD9cXD98ISEhIXwsLHwtLS87XG5cbi8vIFdvcmthcm91bmQgZm9yIHBoYW50b21qcyAtIG5lZWQgcmVnZXggd2l0aG91dCAvZyBmbGFnLFxuLy8gb3Igcm9vdCBjaGVjayB3aWxsIGZhaWwgZXZlcnkgc2Vjb25kIHRpbWVcbnZhciBTQ09QRURfQUJCUl9URVNUX1JFID0gL1xcKChjfHRtfHJ8cClcXCkvaTtcblxudmFyIFNDT1BFRF9BQkJSX1JFID0gL1xcKChjfHRtfHJ8cClcXCkvaWc7XG52YXIgU0NPUEVEX0FCQlIgPSB7XG4gICdjJzogJ8KpJyxcbiAgJ3InOiAnwq4nLFxuICAncCc6ICfCpycsXG4gICd0bSc6ICfihKInXG59O1xuXG5mdW5jdGlvbiByZXBsYWNlRm4obWF0Y2gsIG5hbWUpIHtcbiAgcmV0dXJuIFNDT1BFRF9BQkJSW25hbWUudG9Mb3dlckNhc2UoKV07XG59XG5cbmZ1bmN0aW9uIHJlcGxhY2Vfc2NvcGVkKGlubGluZVRva2Vucykge1xuICB2YXIgaSwgdG9rZW47XG5cbiAgZm9yIChpID0gaW5saW5lVG9rZW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdG9rZW4gPSBpbmxpbmVUb2tlbnNbaV07XG4gICAgaWYgKHRva2VuLnR5cGUgPT09ICd0ZXh0Jykge1xuICAgICAgdG9rZW4uY29udGVudCA9IHRva2VuLmNvbnRlbnQucmVwbGFjZShTQ09QRURfQUJCUl9SRSwgcmVwbGFjZUZuKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVwbGFjZV9yYXJlKGlubGluZVRva2Vucykge1xuICB2YXIgaSwgdG9rZW47XG5cbiAgZm9yIChpID0gaW5saW5lVG9rZW5zLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgdG9rZW4gPSBpbmxpbmVUb2tlbnNbaV07XG4gICAgaWYgKHRva2VuLnR5cGUgPT09ICd0ZXh0Jykge1xuICAgICAgaWYgKFJBUkVfUkUudGVzdCh0b2tlbi5jb250ZW50KSkge1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gdG9rZW4uY29udGVudFxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFwrLS9nLCAnwrEnKVxuICAgICAgICAgICAgICAgICAgICAvLyAuLiwgLi4uLCAuLi4uLi4uIC0+IOKAplxuICAgICAgICAgICAgICAgICAgICAvLyBidXQgPy4uLi4uICYgIS4uLi4uIC0+ID8uLiAmICEuLlxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFwuezIsfS9nLCAn4oCmJykucmVwbGFjZSgvKFs/IV0p4oCmL2csICckMS4uJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyhbPyFdKXs0LH0vZywgJyQxJDEkMScpLnJlcGxhY2UoLyx7Mix9L2csICcsJylcbiAgICAgICAgICAgICAgICAgICAgLy8gZW0tZGFzaFxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF58W14tXSktLS0oW14tXXwkKS9tZywgJyQxXFx1MjAxNCQyJylcbiAgICAgICAgICAgICAgICAgICAgLy8gZW4tZGFzaFxuICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvKF58XFxzKS0tKFxcc3wkKS9tZywgJyQxXFx1MjAxMyQyJylcbiAgICAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyhefFteLVxcc10pLS0oW14tXFxzXXwkKS9tZywgJyQxXFx1MjAxMyQyJyk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiByZXBsYWNlKHN0YXRlKSB7XG4gIHZhciBibGtJZHg7XG5cbiAgaWYgKCFzdGF0ZS5tZC5vcHRpb25zLnR5cG9ncmFwaGVyKSB7IHJldHVybjsgfVxuXG4gIGZvciAoYmxrSWR4ID0gc3RhdGUudG9rZW5zLmxlbmd0aCAtIDE7IGJsa0lkeCA+PSAwOyBibGtJZHgtLSkge1xuXG4gICAgaWYgKHN0YXRlLnRva2Vuc1tibGtJZHhdLnR5cGUgIT09ICdpbmxpbmUnKSB7IGNvbnRpbnVlOyB9XG5cbiAgICBpZiAoU0NPUEVEX0FCQlJfVEVTVF9SRS50ZXN0KHN0YXRlLnRva2Vuc1tibGtJZHhdLmNvbnRlbnQpKSB7XG4gICAgICByZXBsYWNlX3Njb3BlZChzdGF0ZS50b2tlbnNbYmxrSWR4XS5jaGlsZHJlbik7XG4gICAgfVxuXG4gICAgaWYgKFJBUkVfUkUudGVzdChzdGF0ZS50b2tlbnNbYmxrSWR4XS5jb250ZW50KSkge1xuICAgICAgcmVwbGFjZV9yYXJlKHN0YXRlLnRva2Vuc1tibGtJZHhdLmNoaWxkcmVuKTtcbiAgICB9XG5cbiAgfVxufTtcbiIsIi8vIENvbnZlcnQgc3RyYWlnaHQgcXVvdGF0aW9uIG1hcmtzIHRvIHR5cG9ncmFwaGljIG9uZXNcbi8vXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIGlzV2hpdGVTcGFjZSAgID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykuaXNXaGl0ZVNwYWNlO1xudmFyIGlzUHVuY3RDaGFyICAgID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykuaXNQdW5jdENoYXI7XG52YXIgaXNNZEFzY2lpUHVuY3QgPSByZXF1aXJlKCcuLi9jb21tb24vdXRpbHMnKS5pc01kQXNjaWlQdW5jdDtcblxudmFyIFFVT1RFX1RFU1RfUkUgPSAvWydcIl0vO1xudmFyIFFVT1RFX1JFID0gL1snXCJdL2c7XG52YXIgQVBPU1RST1BIRSA9ICdcXHUyMDE5JzsgLyog4oCZICovXG5cblxuZnVuY3Rpb24gcmVwbGFjZUF0KHN0ciwgaW5kZXgsIGNoKSB7XG4gIHJldHVybiBzdHIuc3Vic3RyKDAsIGluZGV4KSArIGNoICsgc3RyLnN1YnN0cihpbmRleCArIDEpO1xufVxuXG5mdW5jdGlvbiBwcm9jZXNzX2lubGluZXModG9rZW5zLCBzdGF0ZSkge1xuICB2YXIgaSwgdG9rZW4sIHRleHQsIHQsIHBvcywgbWF4LCB0aGlzTGV2ZWwsIGl0ZW0sIGxhc3RDaGFyLCBuZXh0Q2hhcixcbiAgICAgIGlzTGFzdFB1bmN0Q2hhciwgaXNOZXh0UHVuY3RDaGFyLCBpc0xhc3RXaGl0ZVNwYWNlLCBpc05leHRXaGl0ZVNwYWNlLFxuICAgICAgY2FuT3BlbiwgY2FuQ2xvc2UsIGosIGlzU2luZ2xlLCBzdGFjaywgb3BlblF1b3RlLCBjbG9zZVF1b3RlO1xuXG4gIHN0YWNrID0gW107XG5cbiAgZm9yIChpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgdGhpc0xldmVsID0gdG9rZW5zW2ldLmxldmVsO1xuXG4gICAgZm9yIChqID0gc3RhY2subGVuZ3RoIC0gMTsgaiA+PSAwOyBqLS0pIHtcbiAgICAgIGlmIChzdGFja1tqXS5sZXZlbCA8PSB0aGlzTGV2ZWwpIHsgYnJlYWs7IH1cbiAgICB9XG4gICAgc3RhY2subGVuZ3RoID0gaiArIDE7XG5cbiAgICBpZiAodG9rZW4udHlwZSAhPT0gJ3RleHQnKSB7IGNvbnRpbnVlOyB9XG5cbiAgICB0ZXh0ID0gdG9rZW4uY29udGVudDtcbiAgICBwb3MgPSAwO1xuICAgIG1heCA9IHRleHQubGVuZ3RoO1xuXG4gICAgLyplc2xpbnQgbm8tbGFiZWxzOjAsYmxvY2stc2NvcGVkLXZhcjowKi9cbiAgICBPVVRFUjpcbiAgICB3aGlsZSAocG9zIDwgbWF4KSB7XG4gICAgICBRVU9URV9SRS5sYXN0SW5kZXggPSBwb3M7XG4gICAgICB0ID0gUVVPVEVfUkUuZXhlYyh0ZXh0KTtcbiAgICAgIGlmICghdCkgeyBicmVhazsgfVxuXG4gICAgICBjYW5PcGVuID0gY2FuQ2xvc2UgPSB0cnVlO1xuICAgICAgcG9zID0gdC5pbmRleCArIDE7XG4gICAgICBpc1NpbmdsZSA9ICh0WzBdID09PSBcIidcIik7XG5cbiAgICAgIC8vIHRyZWF0IGJlZ2luL2VuZCBvZiB0aGUgbGluZSBhcyBhIHdoaXRlc3BhY2VcbiAgICAgIGxhc3RDaGFyID0gdC5pbmRleCAtIDEgPj0gMCA/IHRleHQuY2hhckNvZGVBdCh0LmluZGV4IC0gMSkgOiAweDIwO1xuICAgICAgbmV4dENoYXIgPSBwb3MgPCBtYXggPyB0ZXh0LmNoYXJDb2RlQXQocG9zKSA6IDB4MjA7XG5cbiAgICAgIGlzTGFzdFB1bmN0Q2hhciA9IGlzTWRBc2NpaVB1bmN0KGxhc3RDaGFyKSB8fCBpc1B1bmN0Q2hhcihTdHJpbmcuZnJvbUNoYXJDb2RlKGxhc3RDaGFyKSk7XG4gICAgICBpc05leHRQdW5jdENoYXIgPSBpc01kQXNjaWlQdW5jdChuZXh0Q2hhcikgfHwgaXNQdW5jdENoYXIoU3RyaW5nLmZyb21DaGFyQ29kZShuZXh0Q2hhcikpO1xuXG4gICAgICBpc0xhc3RXaGl0ZVNwYWNlID0gaXNXaGl0ZVNwYWNlKGxhc3RDaGFyKTtcbiAgICAgIGlzTmV4dFdoaXRlU3BhY2UgPSBpc1doaXRlU3BhY2UobmV4dENoYXIpO1xuXG4gICAgICBpZiAoaXNOZXh0V2hpdGVTcGFjZSkge1xuICAgICAgICBjYW5PcGVuID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGlzTmV4dFB1bmN0Q2hhcikge1xuICAgICAgICBpZiAoIShpc0xhc3RXaGl0ZVNwYWNlIHx8IGlzTGFzdFB1bmN0Q2hhcikpIHtcbiAgICAgICAgICBjYW5PcGVuID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGlzTGFzdFdoaXRlU3BhY2UpIHtcbiAgICAgICAgY2FuQ2xvc2UgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoaXNMYXN0UHVuY3RDaGFyKSB7XG4gICAgICAgIGlmICghKGlzTmV4dFdoaXRlU3BhY2UgfHwgaXNOZXh0UHVuY3RDaGFyKSkge1xuICAgICAgICAgIGNhbkNsb3NlID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKG5leHRDaGFyID09PSAweDIyIC8qIFwiICovICYmIHRbMF0gPT09ICdcIicpIHtcbiAgICAgICAgaWYgKGxhc3RDaGFyID49IDB4MzAgLyogMCAqLyAmJiBsYXN0Q2hhciA8PSAweDM5IC8qIDkgKi8pIHtcbiAgICAgICAgICAvLyBzcGVjaWFsIGNhc2U6IDFcIlwiIC0gY291bnQgZmlyc3QgcXVvdGUgYXMgYW4gaW5jaFxuICAgICAgICAgIGNhbkNsb3NlID0gY2FuT3BlbiA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChjYW5PcGVuICYmIGNhbkNsb3NlKSB7XG4gICAgICAgIC8vIHRyZWF0IHRoaXMgYXMgdGhlIG1pZGRsZSBvZiB0aGUgd29yZFxuICAgICAgICBjYW5PcGVuID0gZmFsc2U7XG4gICAgICAgIGNhbkNsb3NlID0gaXNOZXh0UHVuY3RDaGFyO1xuICAgICAgfVxuXG4gICAgICBpZiAoIWNhbk9wZW4gJiYgIWNhbkNsb3NlKSB7XG4gICAgICAgIC8vIG1pZGRsZSBvZiB3b3JkXG4gICAgICAgIGlmIChpc1NpbmdsZSkge1xuICAgICAgICAgIHRva2VuLmNvbnRlbnQgPSByZXBsYWNlQXQodG9rZW4uY29udGVudCwgdC5pbmRleCwgQVBPU1RST1BIRSk7XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChjYW5DbG9zZSkge1xuICAgICAgICAvLyB0aGlzIGNvdWxkIGJlIGEgY2xvc2luZyBxdW90ZSwgcmV3aW5kIHRoZSBzdGFjayB0byBnZXQgYSBtYXRjaFxuICAgICAgICBmb3IgKGogPSBzdGFjay5sZW5ndGggLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgICAgIGl0ZW0gPSBzdGFja1tqXTtcbiAgICAgICAgICBpZiAoc3RhY2tbal0ubGV2ZWwgPCB0aGlzTGV2ZWwpIHsgYnJlYWs7IH1cbiAgICAgICAgICBpZiAoaXRlbS5zaW5nbGUgPT09IGlzU2luZ2xlICYmIHN0YWNrW2pdLmxldmVsID09PSB0aGlzTGV2ZWwpIHtcbiAgICAgICAgICAgIGl0ZW0gPSBzdGFja1tqXTtcblxuICAgICAgICAgICAgaWYgKGlzU2luZ2xlKSB7XG4gICAgICAgICAgICAgIG9wZW5RdW90ZSA9IHN0YXRlLm1kLm9wdGlvbnMucXVvdGVzWzJdO1xuICAgICAgICAgICAgICBjbG9zZVF1b3RlID0gc3RhdGUubWQub3B0aW9ucy5xdW90ZXNbM107XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvcGVuUXVvdGUgPSBzdGF0ZS5tZC5vcHRpb25zLnF1b3Rlc1swXTtcbiAgICAgICAgICAgICAgY2xvc2VRdW90ZSA9IHN0YXRlLm1kLm9wdGlvbnMucXVvdGVzWzFdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyByZXBsYWNlIHRva2VuLmNvbnRlbnQgKmJlZm9yZSogdG9rZW5zW2l0ZW0udG9rZW5dLmNvbnRlbnQsXG4gICAgICAgICAgICAvLyBiZWNhdXNlLCBpZiB0aGV5IGFyZSBwb2ludGluZyBhdCB0aGUgc2FtZSB0b2tlbiwgcmVwbGFjZUF0XG4gICAgICAgICAgICAvLyBjb3VsZCBtZXNzIHVwIGluZGljZXMgd2hlbiBxdW90ZSBsZW5ndGggIT0gMVxuICAgICAgICAgICAgdG9rZW4uY29udGVudCA9IHJlcGxhY2VBdCh0b2tlbi5jb250ZW50LCB0LmluZGV4LCBjbG9zZVF1b3RlKTtcbiAgICAgICAgICAgIHRva2Vuc1tpdGVtLnRva2VuXS5jb250ZW50ID0gcmVwbGFjZUF0KFxuICAgICAgICAgICAgICB0b2tlbnNbaXRlbS50b2tlbl0uY29udGVudCwgaXRlbS5wb3MsIG9wZW5RdW90ZSk7XG5cbiAgICAgICAgICAgIHBvcyArPSBjbG9zZVF1b3RlLmxlbmd0aCAtIDE7XG4gICAgICAgICAgICBpZiAoaXRlbS50b2tlbiA9PT0gaSkgeyBwb3MgKz0gb3BlblF1b3RlLmxlbmd0aCAtIDE7IH1cblxuICAgICAgICAgICAgdGV4dCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICAgICAgICBtYXggPSB0ZXh0Lmxlbmd0aDtcblxuICAgICAgICAgICAgc3RhY2subGVuZ3RoID0gajtcbiAgICAgICAgICAgIGNvbnRpbnVlIE9VVEVSO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoY2FuT3Blbikge1xuICAgICAgICBzdGFjay5wdXNoKHtcbiAgICAgICAgICB0b2tlbjogaSxcbiAgICAgICAgICBwb3M6IHQuaW5kZXgsXG4gICAgICAgICAgc2luZ2xlOiBpc1NpbmdsZSxcbiAgICAgICAgICBsZXZlbDogdGhpc0xldmVsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChjYW5DbG9zZSAmJiBpc1NpbmdsZSkge1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gcmVwbGFjZUF0KHRva2VuLmNvbnRlbnQsIHQuaW5kZXgsIEFQT1NUUk9QSEUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gc21hcnRxdW90ZXMoc3RhdGUpIHtcbiAgLyplc2xpbnQgbWF4LWRlcHRoOjAqL1xuICB2YXIgYmxrSWR4O1xuXG4gIGlmICghc3RhdGUubWQub3B0aW9ucy50eXBvZ3JhcGhlcikgeyByZXR1cm47IH1cblxuICBmb3IgKGJsa0lkeCA9IHN0YXRlLnRva2Vucy5sZW5ndGggLSAxOyBibGtJZHggPj0gMDsgYmxrSWR4LS0pIHtcblxuICAgIGlmIChzdGF0ZS50b2tlbnNbYmxrSWR4XS50eXBlICE9PSAnaW5saW5lJyB8fFxuICAgICAgICAhUVVPVEVfVEVTVF9SRS50ZXN0KHN0YXRlLnRva2Vuc1tibGtJZHhdLmNvbnRlbnQpKSB7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwcm9jZXNzX2lubGluZXMoc3RhdGUudG9rZW5zW2Jsa0lkeF0uY2hpbGRyZW4sIHN0YXRlKTtcbiAgfVxufTtcbiIsIi8vIENvcmUgc3RhdGUgb2JqZWN0XG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG52YXIgVG9rZW4gPSByZXF1aXJlKCcuLi90b2tlbicpO1xuXG5cbmZ1bmN0aW9uIFN0YXRlQ29yZShzcmMsIG1kLCBlbnYpIHtcbiAgdGhpcy5zcmMgPSBzcmM7XG4gIHRoaXMuZW52ID0gZW52O1xuICB0aGlzLnRva2VucyA9IFtdO1xuICB0aGlzLmlubGluZU1vZGUgPSBmYWxzZTtcbiAgdGhpcy5tZCA9IG1kOyAvLyBsaW5rIHRvIHBhcnNlciBpbnN0YW5jZVxufVxuXG4vLyByZS1leHBvcnQgVG9rZW4gY2xhc3MgdG8gdXNlIGluIGNvcmUgcnVsZXNcblN0YXRlQ29yZS5wcm90b3R5cGUuVG9rZW4gPSBUb2tlbjtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlQ29yZTtcbiIsIi8vIFByb2Nlc3MgYXV0b2xpbmtzICc8cHJvdG9jb2w6Li4uPidcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgdXJsX3NjaGVtYXMgPSByZXF1aXJlKCcuLi9jb21tb24vdXJsX3NjaGVtYXMnKTtcblxuXG4vKmVzbGludCBtYXgtbGVuOjAqL1xudmFyIEVNQUlMX1JFICAgID0gL148KFthLXpBLVowLTkuISMkJSYnKitcXC89P15fYHt8fX4tXStAW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KD86XFwuW2EtekEtWjAtOV0oPzpbYS16QS1aMC05LV17MCw2MX1bYS16QS1aMC05XSk/KSopPi87XG52YXIgQVVUT0xJTktfUkUgPSAvXjwoW2EtekEtWi5cXC1dezEsMjV9KTooW148PlxceDAwLVxceDIwXSopPi87XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBhdXRvbGluayhzdGF0ZSwgc2lsZW50KSB7XG4gIHZhciB0YWlsLCBsaW5rTWF0Y2gsIGVtYWlsTWF0Y2gsIHVybCwgZnVsbFVybCwgdG9rZW4sXG4gICAgICBwb3MgPSBzdGF0ZS5wb3M7XG5cbiAgaWYgKHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgIT09IDB4M0MvKiA8ICovKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHRhaWwgPSBzdGF0ZS5zcmMuc2xpY2UocG9zKTtcblxuICBpZiAodGFpbC5pbmRleE9mKCc+JykgPCAwKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGlmIChBVVRPTElOS19SRS50ZXN0KHRhaWwpKSB7XG4gICAgbGlua01hdGNoID0gdGFpbC5tYXRjaChBVVRPTElOS19SRSk7XG5cbiAgICBpZiAodXJsX3NjaGVtYXMuaW5kZXhPZihsaW5rTWF0Y2hbMV0udG9Mb3dlckNhc2UoKSkgPCAwKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgdXJsID0gbGlua01hdGNoWzBdLnNsaWNlKDEsIC0xKTtcbiAgICBmdWxsVXJsID0gc3RhdGUubWQubm9ybWFsaXplTGluayh1cmwpO1xuICAgIGlmICghc3RhdGUubWQudmFsaWRhdGVMaW5rKGZ1bGxVcmwpKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgaWYgKCFzaWxlbnQpIHtcbiAgICAgIHRva2VuICAgICAgICAgPSBzdGF0ZS5wdXNoKCdsaW5rX29wZW4nLCAnYScsIDEpO1xuICAgICAgdG9rZW4uYXR0cnMgICA9IFsgWyAnaHJlZicsIGZ1bGxVcmwgXSBdO1xuXG4gICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgndGV4dCcsICcnLCAwKTtcbiAgICAgIHRva2VuLmNvbnRlbnQgPSBzdGF0ZS5tZC5ub3JtYWxpemVMaW5rVGV4dCh1cmwpO1xuXG4gICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgnbGlua19jbG9zZScsICdhJywgLTEpO1xuICAgIH1cblxuICAgIHN0YXRlLnBvcyArPSBsaW5rTWF0Y2hbMF0ubGVuZ3RoO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKEVNQUlMX1JFLnRlc3QodGFpbCkpIHtcbiAgICBlbWFpbE1hdGNoID0gdGFpbC5tYXRjaChFTUFJTF9SRSk7XG5cbiAgICB1cmwgPSBlbWFpbE1hdGNoWzBdLnNsaWNlKDEsIC0xKTtcbiAgICBmdWxsVXJsID0gc3RhdGUubWQubm9ybWFsaXplTGluaygnbWFpbHRvOicgKyB1cmwpO1xuICAgIGlmICghc3RhdGUubWQudmFsaWRhdGVMaW5rKGZ1bGxVcmwpKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgaWYgKCFzaWxlbnQpIHtcbiAgICAgIHRva2VuICAgICAgICAgPSBzdGF0ZS5wdXNoKCdsaW5rX29wZW4nLCAnYScsIDEpO1xuICAgICAgdG9rZW4uYXR0cnMgICA9IFsgWyAnaHJlZicsIGZ1bGxVcmwgXSBdO1xuICAgICAgdG9rZW4ubWFya3VwICA9ICdhdXRvbGluayc7XG4gICAgICB0b2tlbi5pbmZvICAgID0gJ2F1dG8nO1xuXG4gICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgndGV4dCcsICcnLCAwKTtcbiAgICAgIHRva2VuLmNvbnRlbnQgPSBzdGF0ZS5tZC5ub3JtYWxpemVMaW5rVGV4dCh1cmwpO1xuXG4gICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgnbGlua19jbG9zZScsICdhJywgLTEpO1xuICAgICAgdG9rZW4ubWFya3VwICA9ICdhdXRvbGluayc7XG4gICAgICB0b2tlbi5pbmZvICAgID0gJ2F1dG8nO1xuICAgIH1cblxuICAgIHN0YXRlLnBvcyArPSBlbWFpbE1hdGNoWzBdLmxlbmd0aDtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxuXG4gIHJldHVybiBmYWxzZTtcbn07XG4iLCIvLyBQYXJzZSBiYWNrdGlja3NcblxuJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGJhY2t0aWNrKHN0YXRlLCBzaWxlbnQpIHtcbiAgdmFyIHN0YXJ0LCBtYXgsIG1hcmtlciwgbWF0Y2hTdGFydCwgbWF0Y2hFbmQsIHRva2VuLFxuICAgICAgcG9zID0gc3RhdGUucG9zLFxuICAgICAgY2ggPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuXG4gIGlmIChjaCAhPT0gMHg2MC8qIGAgKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgc3RhcnQgPSBwb3M7XG4gIHBvcysrO1xuICBtYXggPSBzdGF0ZS5wb3NNYXg7XG5cbiAgd2hpbGUgKHBvcyA8IG1heCAmJiBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpID09PSAweDYwLyogYCAqLykgeyBwb3MrKzsgfVxuXG4gIG1hcmtlciA9IHN0YXRlLnNyYy5zbGljZShzdGFydCwgcG9zKTtcblxuICBtYXRjaFN0YXJ0ID0gbWF0Y2hFbmQgPSBwb3M7XG5cbiAgd2hpbGUgKChtYXRjaFN0YXJ0ID0gc3RhdGUuc3JjLmluZGV4T2YoJ2AnLCBtYXRjaEVuZCkpICE9PSAtMSkge1xuICAgIG1hdGNoRW5kID0gbWF0Y2hTdGFydCArIDE7XG5cbiAgICB3aGlsZSAobWF0Y2hFbmQgPCBtYXggJiYgc3RhdGUuc3JjLmNoYXJDb2RlQXQobWF0Y2hFbmQpID09PSAweDYwLyogYCAqLykgeyBtYXRjaEVuZCsrOyB9XG5cbiAgICBpZiAobWF0Y2hFbmQgLSBtYXRjaFN0YXJ0ID09PSBtYXJrZXIubGVuZ3RoKSB7XG4gICAgICBpZiAoIXNpbGVudCkge1xuICAgICAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgnY29kZV9pbmxpbmUnLCAnY29kZScsIDApO1xuICAgICAgICB0b2tlbi5tYXJrdXAgID0gbWFya2VyO1xuICAgICAgICB0b2tlbi5jb250ZW50ID0gc3RhdGUuc3JjLnNsaWNlKHBvcywgbWF0Y2hTdGFydClcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9bIFxcbl0rL2csICcgJylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC50cmltKCk7XG4gICAgICB9XG4gICAgICBzdGF0ZS5wb3MgPSBtYXRjaEVuZDtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghc2lsZW50KSB7IHN0YXRlLnBlbmRpbmcgKz0gbWFya2VyOyB9XG4gIHN0YXRlLnBvcyArPSBtYXJrZXIubGVuZ3RoO1xuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBQcm9jZXNzICp0aGlzKiBhbmQgX3RoYXRfXG4vL1xuJ3VzZSBzdHJpY3QnO1xuXG5cbnZhciBpc1doaXRlU3BhY2UgICA9IHJlcXVpcmUoJy4uL2NvbW1vbi91dGlscycpLmlzV2hpdGVTcGFjZTtcbnZhciBpc1B1bmN0Q2hhciAgICA9IHJlcXVpcmUoJy4uL2NvbW1vbi91dGlscycpLmlzUHVuY3RDaGFyO1xudmFyIGlzTWRBc2NpaVB1bmN0ID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykuaXNNZEFzY2lpUHVuY3Q7XG5cblxuLy8gcGFyc2Ugc2VxdWVuY2Ugb2YgZW1waGFzaXMgbWFya2Vycyxcbi8vIFwic3RhcnRcIiBzaG91bGQgcG9pbnQgYXQgYSB2YWxpZCBtYXJrZXJcbmZ1bmN0aW9uIHNjYW5EZWxpbXMoc3RhdGUsIHN0YXJ0KSB7XG4gIHZhciBwb3MgPSBzdGFydCwgbGFzdENoYXIsIG5leHRDaGFyLCBjb3VudCwgY2FuX29wZW4sIGNhbl9jbG9zZSxcbiAgICAgIGlzTGFzdFdoaXRlU3BhY2UsIGlzTGFzdFB1bmN0Q2hhcixcbiAgICAgIGlzTmV4dFdoaXRlU3BhY2UsIGlzTmV4dFB1bmN0Q2hhcixcbiAgICAgIGxlZnRfZmxhbmtpbmcgPSB0cnVlLFxuICAgICAgcmlnaHRfZmxhbmtpbmcgPSB0cnVlLFxuICAgICAgbWF4ID0gc3RhdGUucG9zTWF4LFxuICAgICAgbWFya2VyID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhcnQpO1xuXG4gIC8vIHRyZWF0IGJlZ2lubmluZyBvZiB0aGUgbGluZSBhcyBhIHdoaXRlc3BhY2VcbiAgbGFzdENoYXIgPSBzdGFydCA+IDAgPyBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCAtIDEpIDogMHgyMDtcblxuICB3aGlsZSAocG9zIDwgbWF4ICYmIHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgPT09IG1hcmtlcikgeyBwb3MrKzsgfVxuXG4gIGNvdW50ID0gcG9zIC0gc3RhcnQ7XG5cbiAgLy8gdHJlYXQgZW5kIG9mIHRoZSBsaW5lIGFzIGEgd2hpdGVzcGFjZVxuICBuZXh0Q2hhciA9IHBvcyA8IG1heCA/IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgOiAweDIwO1xuXG4gIGlzTGFzdFB1bmN0Q2hhciA9IGlzTWRBc2NpaVB1bmN0KGxhc3RDaGFyKSB8fCBpc1B1bmN0Q2hhcihTdHJpbmcuZnJvbUNoYXJDb2RlKGxhc3RDaGFyKSk7XG4gIGlzTmV4dFB1bmN0Q2hhciA9IGlzTWRBc2NpaVB1bmN0KG5leHRDaGFyKSB8fCBpc1B1bmN0Q2hhcihTdHJpbmcuZnJvbUNoYXJDb2RlKG5leHRDaGFyKSk7XG5cbiAgaXNMYXN0V2hpdGVTcGFjZSA9IGlzV2hpdGVTcGFjZShsYXN0Q2hhcik7XG4gIGlzTmV4dFdoaXRlU3BhY2UgPSBpc1doaXRlU3BhY2UobmV4dENoYXIpO1xuXG4gIGlmIChpc05leHRXaGl0ZVNwYWNlKSB7XG4gICAgbGVmdF9mbGFua2luZyA9IGZhbHNlO1xuICB9IGVsc2UgaWYgKGlzTmV4dFB1bmN0Q2hhcikge1xuICAgIGlmICghKGlzTGFzdFdoaXRlU3BhY2UgfHwgaXNMYXN0UHVuY3RDaGFyKSkge1xuICAgICAgbGVmdF9mbGFua2luZyA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIGlmIChpc0xhc3RXaGl0ZVNwYWNlKSB7XG4gICAgcmlnaHRfZmxhbmtpbmcgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChpc0xhc3RQdW5jdENoYXIpIHtcbiAgICBpZiAoIShpc05leHRXaGl0ZVNwYWNlIHx8IGlzTmV4dFB1bmN0Q2hhcikpIHtcbiAgICAgIHJpZ2h0X2ZsYW5raW5nID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKG1hcmtlciA9PT0gMHg1RiAvKiBfICovKSB7XG4gICAgLy8gXCJfXCIgaW5zaWRlIGEgd29yZCBjYW4gbmVpdGhlciBvcGVuIG5vciBjbG9zZSBhbiBlbXBoYXNpc1xuICAgIGNhbl9vcGVuICA9IGxlZnRfZmxhbmtpbmcgICYmICghcmlnaHRfZmxhbmtpbmcgfHwgaXNMYXN0UHVuY3RDaGFyKTtcbiAgICBjYW5fY2xvc2UgPSByaWdodF9mbGFua2luZyAmJiAoIWxlZnRfZmxhbmtpbmcgIHx8IGlzTmV4dFB1bmN0Q2hhcik7XG4gIH0gZWxzZSB7XG4gICAgY2FuX29wZW4gID0gbGVmdF9mbGFua2luZztcbiAgICBjYW5fY2xvc2UgPSByaWdodF9mbGFua2luZztcbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY2FuX29wZW46IGNhbl9vcGVuLFxuICAgIGNhbl9jbG9zZTogY2FuX2Nsb3NlLFxuICAgIGRlbGltczogY291bnRcbiAgfTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlbXBoYXNpcyhzdGF0ZSwgc2lsZW50KSB7XG4gIHZhciBzdGFydENvdW50LFxuICAgICAgY291bnQsXG4gICAgICBmb3VuZCxcbiAgICAgIG9sZENvdW50LFxuICAgICAgbmV3Q291bnQsXG4gICAgICBzdGFjayxcbiAgICAgIHJlcyxcbiAgICAgIHRva2VuLFxuICAgICAgbWF4ID0gc3RhdGUucG9zTWF4LFxuICAgICAgc3RhcnQgPSBzdGF0ZS5wb3MsXG4gICAgICBtYXJrZXIgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCk7XG5cbiAgaWYgKG1hcmtlciAhPT0gMHg1Ri8qIF8gKi8gJiYgbWFya2VyICE9PSAweDJBIC8qICogKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG4gIGlmIChzaWxlbnQpIHsgcmV0dXJuIGZhbHNlOyB9IC8vIGRvbid0IHJ1biBhbnkgcGFpcnMgaW4gdmFsaWRhdGlvbiBtb2RlXG5cbiAgcmVzID0gc2NhbkRlbGltcyhzdGF0ZSwgc3RhcnQpO1xuICBzdGFydENvdW50ID0gcmVzLmRlbGltcztcbiAgaWYgKCFyZXMuY2FuX29wZW4pIHtcbiAgICBzdGF0ZS5wb3MgKz0gc3RhcnRDb3VudDtcbiAgICAvLyBFYXJsaWVyIHdlIGNoZWNrZWQgIXNpbGVudCwgYnV0IHRoaXMgaW1wbGVtZW50YXRpb24gZG9lcyBub3QgbmVlZCBpdFxuICAgIHN0YXRlLnBlbmRpbmcgKz0gc3RhdGUuc3JjLnNsaWNlKHN0YXJ0LCBzdGF0ZS5wb3MpO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgc3RhdGUucG9zID0gc3RhcnQgKyBzdGFydENvdW50O1xuICBzdGFjayA9IFsgc3RhcnRDb3VudCBdO1xuXG4gIHdoaWxlIChzdGF0ZS5wb3MgPCBtYXgpIHtcbiAgICBpZiAoc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhdGUucG9zKSA9PT0gbWFya2VyKSB7XG4gICAgICByZXMgPSBzY2FuRGVsaW1zKHN0YXRlLCBzdGF0ZS5wb3MpO1xuICAgICAgY291bnQgPSByZXMuZGVsaW1zO1xuICAgICAgaWYgKHJlcy5jYW5fY2xvc2UpIHtcbiAgICAgICAgb2xkQ291bnQgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgbmV3Q291bnQgPSBjb3VudDtcblxuICAgICAgICB3aGlsZSAob2xkQ291bnQgIT09IG5ld0NvdW50KSB7XG4gICAgICAgICAgaWYgKG5ld0NvdW50IDwgb2xkQ291bnQpIHtcbiAgICAgICAgICAgIHN0YWNrLnB1c2gob2xkQ291bnQgLSBuZXdDb3VudCk7XG4gICAgICAgICAgICBicmVhaztcbiAgICAgICAgICB9XG5cbiAgICAgICAgICAvLyBhc3NlcnQobmV3Q291bnQgPiBvbGRDb3VudClcbiAgICAgICAgICBuZXdDb3VudCAtPSBvbGRDb3VudDtcblxuICAgICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHsgYnJlYWs7IH1cbiAgICAgICAgICBzdGF0ZS5wb3MgKz0gb2xkQ291bnQ7XG4gICAgICAgICAgb2xkQ291bnQgPSBzdGFjay5wb3AoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzdGFjay5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBzdGFydENvdW50ID0gb2xkQ291bnQ7XG4gICAgICAgICAgZm91bmQgPSB0cnVlO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICB9XG4gICAgICAgIHN0YXRlLnBvcyArPSBjb3VudDtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXMuY2FuX29wZW4pIHsgc3RhY2sucHVzaChjb3VudCk7IH1cbiAgICAgIHN0YXRlLnBvcyArPSBjb3VudDtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIHN0YXRlLm1kLmlubGluZS5za2lwVG9rZW4oc3RhdGUpO1xuICB9XG5cbiAgaWYgKCFmb3VuZCkge1xuICAgIC8vIHBhcnNlciBmYWlsZWQgdG8gZmluZCBlbmRpbmcgdGFnLCBzbyBpdCdzIG5vdCB2YWxpZCBlbXBoYXNpc1xuICAgIHN0YXRlLnBvcyA9IHN0YXJ0O1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIGZvdW5kIVxuICBzdGF0ZS5wb3NNYXggPSBzdGF0ZS5wb3M7XG4gIHN0YXRlLnBvcyA9IHN0YXJ0ICsgc3RhcnRDb3VudDtcblxuICAvLyBFYXJsaWVyIHdlIGNoZWNrZWQgIXNpbGVudCwgYnV0IHRoaXMgaW1wbGVtZW50YXRpb24gZG9lcyBub3QgbmVlZCBpdFxuXG4gIC8vIHdlIGhhdmUgYHN0YXJ0Q291bnRgIHN0YXJ0aW5nIGFuZCBlbmRpbmcgbWFya2VycyxcbiAgLy8gbm93IHRyeWluZyB0byBzZXJpYWxpemUgdGhlbSBpbnRvIHRva2Vuc1xuICBmb3IgKGNvdW50ID0gc3RhcnRDb3VudDsgY291bnQgPiAxOyBjb3VudCAtPSAyKSB7XG4gICAgdG9rZW4gICAgICAgID0gc3RhdGUucHVzaCgnc3Ryb25nX29wZW4nLCAnc3Ryb25nJywgMSk7XG4gICAgdG9rZW4ubWFya3VwID0gU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXIpICsgU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXIpO1xuICB9XG4gIGlmIChjb3VudCAlIDIpIHtcbiAgICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdlbV9vcGVuJywgJ2VtJywgMSk7XG4gICAgdG9rZW4ubWFya3VwID0gU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXIpO1xuICB9XG5cbiAgc3RhdGUubWQuaW5saW5lLnRva2VuaXplKHN0YXRlKTtcblxuICBpZiAoY291bnQgJSAyKSB7XG4gICAgdG9rZW4gICAgICAgID0gc3RhdGUucHVzaCgnZW1fY2xvc2UnLCAnZW0nLCAtMSk7XG4gICAgdG9rZW4ubWFya3VwID0gU3RyaW5nLmZyb21DaGFyQ29kZShtYXJrZXIpO1xuICB9XG4gIGZvciAoY291bnQgPSBzdGFydENvdW50OyBjb3VudCA+IDE7IGNvdW50IC09IDIpIHtcbiAgICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdzdHJvbmdfY2xvc2UnLCAnc3Ryb25nJywgLTEpO1xuICAgIHRva2VuLm1hcmt1cCA9IFN0cmluZy5mcm9tQ2hhckNvZGUobWFya2VyKSArIFN0cmluZy5mcm9tQ2hhckNvZGUobWFya2VyKTtcbiAgfVxuXG4gIHN0YXRlLnBvcyA9IHN0YXRlLnBvc01heCArIHN0YXJ0Q291bnQ7XG4gIHN0YXRlLnBvc01heCA9IG1heDtcbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiLy8gUHJvY2VzcyBodG1sIGVudGl0eSAtICYjMTIzOywgJiN4QUY7LCAmcXVvdDssIC4uLlxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBlbnRpdGllcyAgICAgICAgICA9IHJlcXVpcmUoJy4uL2NvbW1vbi9lbnRpdGllcycpO1xudmFyIGhhcyAgICAgICAgICAgICAgID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykuaGFzO1xudmFyIGlzVmFsaWRFbnRpdHlDb2RlID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykuaXNWYWxpZEVudGl0eUNvZGU7XG52YXIgZnJvbUNvZGVQb2ludCAgICAgPSByZXF1aXJlKCcuLi9jb21tb24vdXRpbHMnKS5mcm9tQ29kZVBvaW50O1xuXG5cbnZhciBESUdJVEFMX1JFID0gL14mIygoPzp4W2EtZjAtOV17MSw4fXxbMC05XXsxLDh9KSk7L2k7XG52YXIgTkFNRURfUkUgICA9IC9eJihbYS16XVthLXowLTldezEsMzF9KTsvaTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGVudGl0eShzdGF0ZSwgc2lsZW50KSB7XG4gIHZhciBjaCwgY29kZSwgbWF0Y2gsIHBvcyA9IHN0YXRlLnBvcywgbWF4ID0gc3RhdGUucG9zTWF4O1xuXG4gIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpICE9PSAweDI2LyogJiAqLykgeyByZXR1cm4gZmFsc2U7IH1cblxuICBpZiAocG9zICsgMSA8IG1heCkge1xuICAgIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zICsgMSk7XG5cbiAgICBpZiAoY2ggPT09IDB4MjMgLyogIyAqLykge1xuICAgICAgbWF0Y2ggPSBzdGF0ZS5zcmMuc2xpY2UocG9zKS5tYXRjaChESUdJVEFMX1JFKTtcbiAgICAgIGlmIChtYXRjaCkge1xuICAgICAgICBpZiAoIXNpbGVudCkge1xuICAgICAgICAgIGNvZGUgPSBtYXRjaFsxXVswXS50b0xvd2VyQ2FzZSgpID09PSAneCcgPyBwYXJzZUludChtYXRjaFsxXS5zbGljZSgxKSwgMTYpIDogcGFyc2VJbnQobWF0Y2hbMV0sIDEwKTtcbiAgICAgICAgICBzdGF0ZS5wZW5kaW5nICs9IGlzVmFsaWRFbnRpdHlDb2RlKGNvZGUpID8gZnJvbUNvZGVQb2ludChjb2RlKSA6IGZyb21Db2RlUG9pbnQoMHhGRkZEKTtcbiAgICAgICAgfVxuICAgICAgICBzdGF0ZS5wb3MgKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbWF0Y2ggPSBzdGF0ZS5zcmMuc2xpY2UocG9zKS5tYXRjaChOQU1FRF9SRSk7XG4gICAgICBpZiAobWF0Y2gpIHtcbiAgICAgICAgaWYgKGhhcyhlbnRpdGllcywgbWF0Y2hbMV0pKSB7XG4gICAgICAgICAgaWYgKCFzaWxlbnQpIHsgc3RhdGUucGVuZGluZyArPSBlbnRpdGllc1ttYXRjaFsxXV07IH1cbiAgICAgICAgICBzdGF0ZS5wb3MgKz0gbWF0Y2hbMF0ubGVuZ3RoO1xuICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKCFzaWxlbnQpIHsgc3RhdGUucGVuZGluZyArPSAnJic7IH1cbiAgc3RhdGUucG9zKys7XG4gIHJldHVybiB0cnVlO1xufTtcbiIsIi8vIFByb2NlZXNzIGVzY2FwZWQgY2hhcnMgYW5kIGhhcmRicmVha3NcblxuJ3VzZSBzdHJpY3QnO1xuXG52YXIgRVNDQVBFRCA9IFtdO1xuXG5mb3IgKHZhciBpID0gMDsgaSA8IDI1NjsgaSsrKSB7IEVTQ0FQRUQucHVzaCgwKTsgfVxuXG4nXFxcXCFcIiMkJSZcXCcoKSorLC4vOjs8PT4/QFtdXl9ge3x9fi0nXG4gIC5zcGxpdCgnJykuZm9yRWFjaChmdW5jdGlvbihjaCkgeyBFU0NBUEVEW2NoLmNoYXJDb2RlQXQoMCldID0gMTsgfSk7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBlc2NhcGUoc3RhdGUsIHNpbGVudCkge1xuICB2YXIgY2gsIHBvcyA9IHN0YXRlLnBvcywgbWF4ID0gc3RhdGUucG9zTWF4O1xuXG4gIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpICE9PSAweDVDLyogXFwgKi8pIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgcG9zKys7XG5cbiAgaWYgKHBvcyA8IG1heCkge1xuICAgIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKTtcblxuICAgIGlmIChjaCA8IDI1NiAmJiBFU0NBUEVEW2NoXSAhPT0gMCkge1xuICAgICAgaWYgKCFzaWxlbnQpIHsgc3RhdGUucGVuZGluZyArPSBzdGF0ZS5zcmNbcG9zXTsgfVxuICAgICAgc3RhdGUucG9zICs9IDI7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG5cbiAgICBpZiAoY2ggPT09IDB4MEEpIHtcbiAgICAgIGlmICghc2lsZW50KSB7XG4gICAgICAgIHN0YXRlLnB1c2goJ2hhcmRicmVhaycsICdicicsIDApO1xuICAgICAgfVxuXG4gICAgICBwb3MrKztcbiAgICAgIC8vIHNraXAgbGVhZGluZyB3aGl0ZXNwYWNlcyBmcm9tIG5leHQgbGluZVxuICAgICAgd2hpbGUgKHBvcyA8IG1heCAmJiBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpID09PSAweDIwKSB7IHBvcysrOyB9XG5cbiAgICAgIHN0YXRlLnBvcyA9IHBvcztcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cbiAgfVxuXG4gIGlmICghc2lsZW50KSB7IHN0YXRlLnBlbmRpbmcgKz0gJ1xcXFwnOyB9XG4gIHN0YXRlLnBvcysrO1xuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBQcm9jZXNzIGh0bWwgdGFnc1xuXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIEhUTUxfVEFHX1JFID0gcmVxdWlyZSgnLi4vY29tbW9uL2h0bWxfcmUnKS5IVE1MX1RBR19SRTtcblxuXG5mdW5jdGlvbiBpc0xldHRlcihjaCkge1xuICAvKmVzbGludCBuby1iaXR3aXNlOjAqL1xuICB2YXIgbGMgPSBjaCB8IDB4MjA7IC8vIHRvIGxvd2VyIGNhc2VcbiAgcmV0dXJuIChsYyA+PSAweDYxLyogYSAqLykgJiYgKGxjIDw9IDB4N2EvKiB6ICovKTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGh0bWxfaW5saW5lKHN0YXRlLCBzaWxlbnQpIHtcbiAgdmFyIGNoLCBtYXRjaCwgbWF4LCB0b2tlbixcbiAgICAgIHBvcyA9IHN0YXRlLnBvcztcblxuICBpZiAoIXN0YXRlLm1kLm9wdGlvbnMuaHRtbCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAvLyBDaGVjayBzdGFydFxuICBtYXggPSBzdGF0ZS5wb3NNYXg7XG4gIGlmIChzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpICE9PSAweDNDLyogPCAqLyB8fFxuICAgICAgcG9zICsgMiA+PSBtYXgpIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvLyBRdWljayBmYWlsIG9uIHNlY29uZCBjaGFyXG4gIGNoID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zICsgMSk7XG4gIGlmIChjaCAhPT0gMHgyMS8qICEgKi8gJiZcbiAgICAgIGNoICE9PSAweDNGLyogPyAqLyAmJlxuICAgICAgY2ggIT09IDB4MkYvKiAvICovICYmXG4gICAgICAhaXNMZXR0ZXIoY2gpKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgbWF0Y2ggPSBzdGF0ZS5zcmMuc2xpY2UocG9zKS5tYXRjaChIVE1MX1RBR19SRSk7XG4gIGlmICghbWF0Y2gpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgaWYgKCFzaWxlbnQpIHtcbiAgICB0b2tlbiAgICAgICAgID0gc3RhdGUucHVzaCgnaHRtbF9pbmxpbmUnLCAnJywgMCk7XG4gICAgdG9rZW4uY29udGVudCA9IHN0YXRlLnNyYy5zbGljZShwb3MsIHBvcyArIG1hdGNoWzBdLmxlbmd0aCk7XG4gIH1cbiAgc3RhdGUucG9zICs9IG1hdGNoWzBdLmxlbmd0aDtcbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiLy8gUHJvY2VzcyAhW2ltYWdlXSg8c3JjPiBcInRpdGxlXCIpXG5cbid1c2Ugc3RyaWN0JztcblxudmFyIHBhcnNlTGlua0xhYmVsICAgICAgID0gcmVxdWlyZSgnLi4vaGVscGVycy9wYXJzZV9saW5rX2xhYmVsJyk7XG52YXIgcGFyc2VMaW5rRGVzdGluYXRpb24gPSByZXF1aXJlKCcuLi9oZWxwZXJzL3BhcnNlX2xpbmtfZGVzdGluYXRpb24nKTtcbnZhciBwYXJzZUxpbmtUaXRsZSAgICAgICA9IHJlcXVpcmUoJy4uL2hlbHBlcnMvcGFyc2VfbGlua190aXRsZScpO1xudmFyIG5vcm1hbGl6ZVJlZmVyZW5jZSAgID0gcmVxdWlyZSgnLi4vY29tbW9uL3V0aWxzJykubm9ybWFsaXplUmVmZXJlbmNlO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaW1hZ2Uoc3RhdGUsIHNpbGVudCkge1xuICB2YXIgYXR0cnMsXG4gICAgICBjb2RlLFxuICAgICAgbGFiZWwsXG4gICAgICBsYWJlbEVuZCxcbiAgICAgIGxhYmVsU3RhcnQsXG4gICAgICBwb3MsXG4gICAgICByZWYsXG4gICAgICByZXMsXG4gICAgICB0aXRsZSxcbiAgICAgIHRva2VuLFxuICAgICAgdG9rZW5zLFxuICAgICAgc3RhcnQsXG4gICAgICBocmVmID0gJycsXG4gICAgICBvbGRQb3MgPSBzdGF0ZS5wb3MsXG4gICAgICBtYXggPSBzdGF0ZS5wb3NNYXg7XG5cbiAgaWYgKHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXRlLnBvcykgIT09IDB4MjEvKiAhICovKSB7IHJldHVybiBmYWxzZTsgfVxuICBpZiAoc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhdGUucG9zICsgMSkgIT09IDB4NUIvKiBbICovKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGxhYmVsU3RhcnQgPSBzdGF0ZS5wb3MgKyAyO1xuICBsYWJlbEVuZCA9IHBhcnNlTGlua0xhYmVsKHN0YXRlLCBzdGF0ZS5wb3MgKyAxLCBmYWxzZSk7XG5cbiAgLy8gcGFyc2VyIGZhaWxlZCB0byBmaW5kICddJywgc28gaXQncyBub3QgYSB2YWxpZCBsaW5rXG4gIGlmIChsYWJlbEVuZCA8IDApIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgcG9zID0gbGFiZWxFbmQgKyAxO1xuICBpZiAocG9zIDwgbWF4ICYmIHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgPT09IDB4MjgvKiAoICovKSB7XG4gICAgLy9cbiAgICAvLyBJbmxpbmUgbGlua1xuICAgIC8vXG5cbiAgICAvLyBbbGlua10oICA8aHJlZj4gIFwidGl0bGVcIiAgKVxuICAgIC8vICAgICAgICBeXiBza2lwcGluZyB0aGVzZSBzcGFjZXNcbiAgICBwb3MrKztcbiAgICBmb3IgKDsgcG9zIDwgbWF4OyBwb3MrKykge1xuICAgICAgY29kZSA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcyk7XG4gICAgICBpZiAoY29kZSAhPT0gMHgyMCAmJiBjb2RlICE9PSAweDBBKSB7IGJyZWFrOyB9XG4gICAgfVxuICAgIGlmIChwb3MgPj0gbWF4KSB7IHJldHVybiBmYWxzZTsgfVxuXG4gICAgLy8gW2xpbmtdKCAgPGhyZWY+ICBcInRpdGxlXCIgIClcbiAgICAvLyAgICAgICAgICBeXl5eXl4gcGFyc2luZyBsaW5rIGRlc3RpbmF0aW9uXG4gICAgc3RhcnQgPSBwb3M7XG4gICAgcmVzID0gcGFyc2VMaW5rRGVzdGluYXRpb24oc3RhdGUuc3JjLCBwb3MsIHN0YXRlLnBvc01heCk7XG4gICAgaWYgKHJlcy5vaykge1xuICAgICAgaHJlZiA9IHN0YXRlLm1kLm5vcm1hbGl6ZUxpbmsocmVzLnN0cik7XG4gICAgICBpZiAoc3RhdGUubWQudmFsaWRhdGVMaW5rKGhyZWYpKSB7XG4gICAgICAgIHBvcyA9IHJlcy5wb3M7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBocmVmID0gJyc7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gW2xpbmtdKCAgPGhyZWY+ICBcInRpdGxlXCIgIClcbiAgICAvLyAgICAgICAgICAgICAgICBeXiBza2lwcGluZyB0aGVzZSBzcGFjZXNcbiAgICBzdGFydCA9IHBvcztcbiAgICBmb3IgKDsgcG9zIDwgbWF4OyBwb3MrKykge1xuICAgICAgY29kZSA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcyk7XG4gICAgICBpZiAoY29kZSAhPT0gMHgyMCAmJiBjb2RlICE9PSAweDBBKSB7IGJyZWFrOyB9XG4gICAgfVxuXG4gICAgLy8gW2xpbmtdKCAgPGhyZWY+ICBcInRpdGxlXCIgIClcbiAgICAvLyAgICAgICAgICAgICAgICAgIF5eXl5eXl4gcGFyc2luZyBsaW5rIHRpdGxlXG4gICAgcmVzID0gcGFyc2VMaW5rVGl0bGUoc3RhdGUuc3JjLCBwb3MsIHN0YXRlLnBvc01heCk7XG4gICAgaWYgKHBvcyA8IG1heCAmJiBzdGFydCAhPT0gcG9zICYmIHJlcy5vaykge1xuICAgICAgdGl0bGUgPSByZXMuc3RyO1xuICAgICAgcG9zID0gcmVzLnBvcztcblxuICAgICAgLy8gW2xpbmtdKCAgPGhyZWY+ICBcInRpdGxlXCIgIClcbiAgICAgIC8vICAgICAgICAgICAgICAgICAgICAgICAgIF5eIHNraXBwaW5nIHRoZXNlIHNwYWNlc1xuICAgICAgZm9yICg7IHBvcyA8IG1heDsgcG9zKyspIHtcbiAgICAgICAgY29kZSA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcyk7XG4gICAgICAgIGlmIChjb2RlICE9PSAweDIwICYmIGNvZGUgIT09IDB4MEEpIHsgYnJlYWs7IH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGl0bGUgPSAnJztcbiAgICB9XG5cbiAgICBpZiAocG9zID49IG1heCB8fCBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpICE9PSAweDI5LyogKSAqLykge1xuICAgICAgc3RhdGUucG9zID0gb2xkUG9zO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBwb3MrKztcbiAgfSBlbHNlIHtcbiAgICAvL1xuICAgIC8vIExpbmsgcmVmZXJlbmNlXG4gICAgLy9cbiAgICBpZiAodHlwZW9mIHN0YXRlLmVudi5yZWZlcmVuY2VzID09PSAndW5kZWZpbmVkJykgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIC8vIFtmb29dICBbYmFyXVxuICAgIC8vICAgICAgXl4gb3B0aW9uYWwgd2hpdGVzcGFjZSAoY2FuIGluY2x1ZGUgbmV3bGluZXMpXG4gICAgZm9yICg7IHBvcyA8IG1heDsgcG9zKyspIHtcbiAgICAgIGNvZGUgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuICAgICAgaWYgKGNvZGUgIT09IDB4MjAgJiYgY29kZSAhPT0gMHgwQSkgeyBicmVhazsgfVxuICAgIH1cblxuICAgIGlmIChwb3MgPCBtYXggJiYgc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSA9PT0gMHg1Qi8qIFsgKi8pIHtcbiAgICAgIHN0YXJ0ID0gcG9zICsgMTtcbiAgICAgIHBvcyA9IHBhcnNlTGlua0xhYmVsKHN0YXRlLCBwb3MpO1xuICAgICAgaWYgKHBvcyA+PSAwKSB7XG4gICAgICAgIGxhYmVsID0gc3RhdGUuc3JjLnNsaWNlKHN0YXJ0LCBwb3MrKyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBwb3MgPSBsYWJlbEVuZCArIDE7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHBvcyA9IGxhYmVsRW5kICsgMTtcbiAgICB9XG5cbiAgICAvLyBjb3ZlcnMgbGFiZWwgPT09ICcnIGFuZCBsYWJlbCA9PT0gdW5kZWZpbmVkXG4gICAgLy8gKGNvbGxhcHNlZCByZWZlcmVuY2UgbGluayBhbmQgc2hvcnRjdXQgcmVmZXJlbmNlIGxpbmsgcmVzcGVjdGl2ZWx5KVxuICAgIGlmICghbGFiZWwpIHsgbGFiZWwgPSBzdGF0ZS5zcmMuc2xpY2UobGFiZWxTdGFydCwgbGFiZWxFbmQpOyB9XG5cbiAgICByZWYgPSBzdGF0ZS5lbnYucmVmZXJlbmNlc1tub3JtYWxpemVSZWZlcmVuY2UobGFiZWwpXTtcbiAgICBpZiAoIXJlZikge1xuICAgICAgc3RhdGUucG9zID0gb2xkUG9zO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgICBocmVmID0gcmVmLmhyZWY7XG4gICAgdGl0bGUgPSByZWYudGl0bGU7XG4gIH1cblxuICAvL1xuICAvLyBXZSBmb3VuZCB0aGUgZW5kIG9mIHRoZSBsaW5rLCBhbmQga25vdyBmb3IgYSBmYWN0IGl0J3MgYSB2YWxpZCBsaW5rO1xuICAvLyBzbyBhbGwgdGhhdCdzIGxlZnQgdG8gZG8gaXMgdG8gY2FsbCB0b2tlbml6ZXIuXG4gIC8vXG4gIGlmICghc2lsZW50KSB7XG4gICAgc3RhdGUucG9zID0gbGFiZWxTdGFydDtcbiAgICBzdGF0ZS5wb3NNYXggPSBsYWJlbEVuZDtcblxuICAgIHZhciBuZXdTdGF0ZSA9IG5ldyBzdGF0ZS5tZC5pbmxpbmUuU3RhdGUoXG4gICAgICBzdGF0ZS5zcmMuc2xpY2UobGFiZWxTdGFydCwgbGFiZWxFbmQpLFxuICAgICAgc3RhdGUubWQsXG4gICAgICBzdGF0ZS5lbnYsXG4gICAgICB0b2tlbnMgPSBbXVxuICAgICk7XG4gICAgbmV3U3RhdGUubWQuaW5saW5lLnRva2VuaXplKG5ld1N0YXRlKTtcblxuICAgIHRva2VuICAgICAgICAgID0gc3RhdGUucHVzaCgnaW1hZ2UnLCAnaW1nJywgMCk7XG4gICAgdG9rZW4uYXR0cnMgICAgPSBhdHRycyA9IFsgWyAnc3JjJywgaHJlZiBdLCBbICdhbHQnLCAnJyBdIF07XG4gICAgdG9rZW4uY2hpbGRyZW4gPSB0b2tlbnM7XG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICBhdHRycy5wdXNoKFsgJ3RpdGxlJywgdGl0bGUgXSk7XG4gICAgfVxuICB9XG5cbiAgc3RhdGUucG9zID0gcG9zO1xuICBzdGF0ZS5wb3NNYXggPSBtYXg7XG4gIHJldHVybiB0cnVlO1xufTtcbiIsIi8vIFByb2Nlc3MgW2xpbmtdKDx0bz4gXCJzdHVmZlwiKVxuXG4ndXNlIHN0cmljdCc7XG5cbnZhciBwYXJzZUxpbmtMYWJlbCAgICAgICA9IHJlcXVpcmUoJy4uL2hlbHBlcnMvcGFyc2VfbGlua19sYWJlbCcpO1xudmFyIHBhcnNlTGlua0Rlc3RpbmF0aW9uID0gcmVxdWlyZSgnLi4vaGVscGVycy9wYXJzZV9saW5rX2Rlc3RpbmF0aW9uJyk7XG52YXIgcGFyc2VMaW5rVGl0bGUgICAgICAgPSByZXF1aXJlKCcuLi9oZWxwZXJzL3BhcnNlX2xpbmtfdGl0bGUnKTtcbnZhciBub3JtYWxpemVSZWZlcmVuY2UgICA9IHJlcXVpcmUoJy4uL2NvbW1vbi91dGlscycpLm5vcm1hbGl6ZVJlZmVyZW5jZTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIGxpbmsoc3RhdGUsIHNpbGVudCkge1xuICB2YXIgYXR0cnMsXG4gICAgICBjb2RlLFxuICAgICAgbGFiZWwsXG4gICAgICBsYWJlbEVuZCxcbiAgICAgIGxhYmVsU3RhcnQsXG4gICAgICBwb3MsXG4gICAgICByZXMsXG4gICAgICByZWYsXG4gICAgICB0aXRsZSxcbiAgICAgIHRva2VuLFxuICAgICAgaHJlZiA9ICcnLFxuICAgICAgb2xkUG9zID0gc3RhdGUucG9zLFxuICAgICAgbWF4ID0gc3RhdGUucG9zTWF4LFxuICAgICAgc3RhcnQgPSBzdGF0ZS5wb3M7XG5cbiAgaWYgKHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXRlLnBvcykgIT09IDB4NUIvKiBbICovKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIGxhYmVsU3RhcnQgPSBzdGF0ZS5wb3MgKyAxO1xuICBsYWJlbEVuZCA9IHBhcnNlTGlua0xhYmVsKHN0YXRlLCBzdGF0ZS5wb3MsIHRydWUpO1xuXG4gIC8vIHBhcnNlciBmYWlsZWQgdG8gZmluZCAnXScsIHNvIGl0J3Mgbm90IGEgdmFsaWQgbGlua1xuICBpZiAobGFiZWxFbmQgPCAwKSB7IHJldHVybiBmYWxzZTsgfVxuXG4gIHBvcyA9IGxhYmVsRW5kICsgMTtcbiAgaWYgKHBvcyA8IG1heCAmJiBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpID09PSAweDI4LyogKCAqLykge1xuICAgIC8vXG4gICAgLy8gSW5saW5lIGxpbmtcbiAgICAvL1xuXG4gICAgLy8gW2xpbmtdKCAgPGhyZWY+ICBcInRpdGxlXCIgIClcbiAgICAvLyAgICAgICAgXl4gc2tpcHBpbmcgdGhlc2Ugc3BhY2VzXG4gICAgcG9zKys7XG4gICAgZm9yICg7IHBvcyA8IG1heDsgcG9zKyspIHtcbiAgICAgIGNvZGUgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuICAgICAgaWYgKGNvZGUgIT09IDB4MjAgJiYgY29kZSAhPT0gMHgwQSkgeyBicmVhazsgfVxuICAgIH1cbiAgICBpZiAocG9zID49IG1heCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICAgIC8vIFtsaW5rXSggIDxocmVmPiAgXCJ0aXRsZVwiICApXG4gICAgLy8gICAgICAgICAgXl5eXl5eIHBhcnNpbmcgbGluayBkZXN0aW5hdGlvblxuICAgIHN0YXJ0ID0gcG9zO1xuICAgIHJlcyA9IHBhcnNlTGlua0Rlc3RpbmF0aW9uKHN0YXRlLnNyYywgcG9zLCBzdGF0ZS5wb3NNYXgpO1xuICAgIGlmIChyZXMub2spIHtcbiAgICAgIGhyZWYgPSBzdGF0ZS5tZC5ub3JtYWxpemVMaW5rKHJlcy5zdHIpO1xuICAgICAgaWYgKHN0YXRlLm1kLnZhbGlkYXRlTGluayhocmVmKSkge1xuICAgICAgICBwb3MgPSByZXMucG9zO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgaHJlZiA9ICcnO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIFtsaW5rXSggIDxocmVmPiAgXCJ0aXRsZVwiICApXG4gICAgLy8gICAgICAgICAgICAgICAgXl4gc2tpcHBpbmcgdGhlc2Ugc3BhY2VzXG4gICAgc3RhcnQgPSBwb3M7XG4gICAgZm9yICg7IHBvcyA8IG1heDsgcG9zKyspIHtcbiAgICAgIGNvZGUgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuICAgICAgaWYgKGNvZGUgIT09IDB4MjAgJiYgY29kZSAhPT0gMHgwQSkgeyBicmVhazsgfVxuICAgIH1cblxuICAgIC8vIFtsaW5rXSggIDxocmVmPiAgXCJ0aXRsZVwiICApXG4gICAgLy8gICAgICAgICAgICAgICAgICBeXl5eXl5eIHBhcnNpbmcgbGluayB0aXRsZVxuICAgIHJlcyA9IHBhcnNlTGlua1RpdGxlKHN0YXRlLnNyYywgcG9zLCBzdGF0ZS5wb3NNYXgpO1xuICAgIGlmIChwb3MgPCBtYXggJiYgc3RhcnQgIT09IHBvcyAmJiByZXMub2spIHtcbiAgICAgIHRpdGxlID0gcmVzLnN0cjtcbiAgICAgIHBvcyA9IHJlcy5wb3M7XG5cbiAgICAgIC8vIFtsaW5rXSggIDxocmVmPiAgXCJ0aXRsZVwiICApXG4gICAgICAvLyAgICAgICAgICAgICAgICAgICAgICAgICBeXiBza2lwcGluZyB0aGVzZSBzcGFjZXNcbiAgICAgIGZvciAoOyBwb3MgPCBtYXg7IHBvcysrKSB7XG4gICAgICAgIGNvZGUgPSBzdGF0ZS5zcmMuY2hhckNvZGVBdChwb3MpO1xuICAgICAgICBpZiAoY29kZSAhPT0gMHgyMCAmJiBjb2RlICE9PSAweDBBKSB7IGJyZWFrOyB9XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRpdGxlID0gJyc7XG4gICAgfVxuXG4gICAgaWYgKHBvcyA+PSBtYXggfHwgc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSAhPT0gMHgyOS8qICkgKi8pIHtcbiAgICAgIHN0YXRlLnBvcyA9IG9sZFBvcztcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgcG9zKys7XG4gIH0gZWxzZSB7XG4gICAgLy9cbiAgICAvLyBMaW5rIHJlZmVyZW5jZVxuICAgIC8vXG4gICAgaWYgKHR5cGVvZiBzdGF0ZS5lbnYucmVmZXJlbmNlcyA9PT0gJ3VuZGVmaW5lZCcpIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgICAvLyBbZm9vXSAgW2Jhcl1cbiAgICAvLyAgICAgIF5eIG9wdGlvbmFsIHdoaXRlc3BhY2UgKGNhbiBpbmNsdWRlIG5ld2xpbmVzKVxuICAgIGZvciAoOyBwb3MgPCBtYXg7IHBvcysrKSB7XG4gICAgICBjb2RlID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKTtcbiAgICAgIGlmIChjb2RlICE9PSAweDIwICYmIGNvZGUgIT09IDB4MEEpIHsgYnJlYWs7IH1cbiAgICB9XG5cbiAgICBpZiAocG9zIDwgbWF4ICYmIHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgPT09IDB4NUIvKiBbICovKSB7XG4gICAgICBzdGFydCA9IHBvcyArIDE7XG4gICAgICBwb3MgPSBwYXJzZUxpbmtMYWJlbChzdGF0ZSwgcG9zKTtcbiAgICAgIGlmIChwb3MgPj0gMCkge1xuICAgICAgICBsYWJlbCA9IHN0YXRlLnNyYy5zbGljZShzdGFydCwgcG9zKyspO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcG9zID0gbGFiZWxFbmQgKyAxO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBwb3MgPSBsYWJlbEVuZCArIDE7XG4gICAgfVxuXG4gICAgLy8gY292ZXJzIGxhYmVsID09PSAnJyBhbmQgbGFiZWwgPT09IHVuZGVmaW5lZFxuICAgIC8vIChjb2xsYXBzZWQgcmVmZXJlbmNlIGxpbmsgYW5kIHNob3J0Y3V0IHJlZmVyZW5jZSBsaW5rIHJlc3BlY3RpdmVseSlcbiAgICBpZiAoIWxhYmVsKSB7IGxhYmVsID0gc3RhdGUuc3JjLnNsaWNlKGxhYmVsU3RhcnQsIGxhYmVsRW5kKTsgfVxuXG4gICAgcmVmID0gc3RhdGUuZW52LnJlZmVyZW5jZXNbbm9ybWFsaXplUmVmZXJlbmNlKGxhYmVsKV07XG4gICAgaWYgKCFyZWYpIHtcbiAgICAgIHN0YXRlLnBvcyA9IG9sZFBvcztcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICB9XG4gICAgaHJlZiA9IHJlZi5ocmVmO1xuICAgIHRpdGxlID0gcmVmLnRpdGxlO1xuICB9XG5cbiAgLy9cbiAgLy8gV2UgZm91bmQgdGhlIGVuZCBvZiB0aGUgbGluaywgYW5kIGtub3cgZm9yIGEgZmFjdCBpdCdzIGEgdmFsaWQgbGluaztcbiAgLy8gc28gYWxsIHRoYXQncyBsZWZ0IHRvIGRvIGlzIHRvIGNhbGwgdG9rZW5pemVyLlxuICAvL1xuICBpZiAoIXNpbGVudCkge1xuICAgIHN0YXRlLnBvcyA9IGxhYmVsU3RhcnQ7XG4gICAgc3RhdGUucG9zTWF4ID0gbGFiZWxFbmQ7XG5cbiAgICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdsaW5rX29wZW4nLCAnYScsIDEpO1xuICAgIHRva2VuLmF0dHJzICA9IGF0dHJzID0gWyBbICdocmVmJywgaHJlZiBdIF07XG4gICAgaWYgKHRpdGxlKSB7XG4gICAgICBhdHRycy5wdXNoKFsgJ3RpdGxlJywgdGl0bGUgXSk7XG4gICAgfVxuXG4gICAgc3RhdGUubWQuaW5saW5lLnRva2VuaXplKHN0YXRlKTtcblxuICAgIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ2xpbmtfY2xvc2UnLCAnYScsIC0xKTtcbiAgfVxuXG4gIHN0YXRlLnBvcyA9IHBvcztcbiAgc3RhdGUucG9zTWF4ID0gbWF4O1xuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBQcm9jZWVzcyAnXFxuJ1xuXG4ndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gbmV3bGluZShzdGF0ZSwgc2lsZW50KSB7XG4gIHZhciBwbWF4LCBtYXgsIHBvcyA9IHN0YXRlLnBvcztcblxuICBpZiAoc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSAhPT0gMHgwQS8qIFxcbiAqLykgeyByZXR1cm4gZmFsc2U7IH1cblxuICBwbWF4ID0gc3RhdGUucGVuZGluZy5sZW5ndGggLSAxO1xuICBtYXggPSBzdGF0ZS5wb3NNYXg7XG5cbiAgLy8gJyAgXFxuJyAtPiBoYXJkYnJlYWtcbiAgLy8gTG9va3VwIGluIHBlbmRpbmcgY2hhcnMgaXMgYmFkIHByYWN0aWNlISBEb24ndCBjb3B5IHRvIG90aGVyIHJ1bGVzIVxuICAvLyBQZW5kaW5nIHN0cmluZyBpcyBzdG9yZWQgaW4gY29uY2F0IG1vZGUsIGluZGV4ZWQgbG9va3VwcyB3aWxsIGNhdXNlXG4gIC8vIGNvbnZlcnRpb24gdG8gZmxhdCBtb2RlLlxuICBpZiAoIXNpbGVudCkge1xuICAgIGlmIChwbWF4ID49IDAgJiYgc3RhdGUucGVuZGluZy5jaGFyQ29kZUF0KHBtYXgpID09PSAweDIwKSB7XG4gICAgICBpZiAocG1heCA+PSAxICYmIHN0YXRlLnBlbmRpbmcuY2hhckNvZGVBdChwbWF4IC0gMSkgPT09IDB4MjApIHtcbiAgICAgICAgc3RhdGUucGVuZGluZyA9IHN0YXRlLnBlbmRpbmcucmVwbGFjZSgvICskLywgJycpO1xuICAgICAgICBzdGF0ZS5wdXNoKCdoYXJkYnJlYWsnLCAnYnInLCAwKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN0YXRlLnBlbmRpbmcgPSBzdGF0ZS5wZW5kaW5nLnNsaWNlKDAsIC0xKTtcbiAgICAgICAgc3RhdGUucHVzaCgnc29mdGJyZWFrJywgJ2JyJywgMCk7XG4gICAgICB9XG5cbiAgICB9IGVsc2Uge1xuICAgICAgc3RhdGUucHVzaCgnc29mdGJyZWFrJywgJ2JyJywgMCk7XG4gICAgfVxuICB9XG5cbiAgcG9zKys7XG5cbiAgLy8gc2tpcCBoZWFkaW5nIHNwYWNlcyBmb3IgbmV4dCBsaW5lXG4gIHdoaWxlIChwb3MgPCBtYXggJiYgc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSA9PT0gMHgyMCkgeyBwb3MrKzsgfVxuXG4gIHN0YXRlLnBvcyA9IHBvcztcbiAgcmV0dXJuIHRydWU7XG59O1xuIiwiLy8gSW5saW5lIHBhcnNlciBzdGF0ZVxuXG4ndXNlIHN0cmljdCc7XG5cblxudmFyIFRva2VuID0gcmVxdWlyZSgnLi4vdG9rZW4nKTtcblxuZnVuY3Rpb24gU3RhdGVJbmxpbmUoc3JjLCBtZCwgZW52LCBvdXRUb2tlbnMpIHtcbiAgdGhpcy5zcmMgPSBzcmM7XG4gIHRoaXMuZW52ID0gZW52O1xuICB0aGlzLm1kID0gbWQ7XG4gIHRoaXMudG9rZW5zID0gb3V0VG9rZW5zO1xuXG4gIHRoaXMucG9zID0gMDtcbiAgdGhpcy5wb3NNYXggPSB0aGlzLnNyYy5sZW5ndGg7XG4gIHRoaXMubGV2ZWwgPSAwO1xuICB0aGlzLnBlbmRpbmcgPSAnJztcbiAgdGhpcy5wZW5kaW5nTGV2ZWwgPSAwO1xuXG4gIHRoaXMuY2FjaGUgPSB7fTsgICAgICAgIC8vIFN0b3JlcyB7IHN0YXJ0OiBlbmQgfSBwYWlycy4gVXNlZnVsIGZvciBiYWNrdHJhY2tcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gb3B0aW1pemF0aW9uIG9mIHBhaXJzIHBhcnNlIChlbXBoYXNpcywgc3RyaWtlcykuXG59XG5cblxuLy8gRmx1c2ggcGVuZGluZyB0ZXh0XG4vL1xuU3RhdGVJbmxpbmUucHJvdG90eXBlLnB1c2hQZW5kaW5nID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdG9rZW4gPSBuZXcgVG9rZW4oJ3RleHQnLCAnJywgMCk7XG4gIHRva2VuLmNvbnRlbnQgPSB0aGlzLnBlbmRpbmc7XG4gIHRva2VuLmxldmVsID0gdGhpcy5wZW5kaW5nTGV2ZWw7XG4gIHRoaXMudG9rZW5zLnB1c2godG9rZW4pO1xuICB0aGlzLnBlbmRpbmcgPSAnJztcbiAgcmV0dXJuIHRva2VuO1xufTtcblxuXG4vLyBQdXNoIG5ldyB0b2tlbiB0byBcInN0cmVhbVwiLlxuLy8gSWYgcGVuZGluZyB0ZXh0IGV4aXN0cyAtIGZsdXNoIGl0IGFzIHRleHQgdG9rZW5cbi8vXG5TdGF0ZUlubGluZS5wcm90b3R5cGUucHVzaCA9IGZ1bmN0aW9uICh0eXBlLCB0YWcsIG5lc3RpbmcpIHtcbiAgaWYgKHRoaXMucGVuZGluZykge1xuICAgIHRoaXMucHVzaFBlbmRpbmcoKTtcbiAgfVxuXG4gIHZhciB0b2tlbiA9IG5ldyBUb2tlbih0eXBlLCB0YWcsIG5lc3RpbmcpO1xuXG4gIGlmIChuZXN0aW5nIDwgMCkgeyB0aGlzLmxldmVsLS07IH1cbiAgdG9rZW4ubGV2ZWwgPSB0aGlzLmxldmVsO1xuICBpZiAobmVzdGluZyA+IDApIHsgdGhpcy5sZXZlbCsrOyB9XG5cbiAgdGhpcy5wZW5kaW5nTGV2ZWwgPSB0aGlzLmxldmVsO1xuICB0aGlzLnRva2Vucy5wdXNoKHRva2VuKTtcbiAgcmV0dXJuIHRva2VuO1xufTtcblxuLy8gcmUtZXhwb3J0IFRva2VuIGNsYXNzIHRvIHVzZSBpbiBibG9jayBydWxlc1xuU3RhdGVJbmxpbmUucHJvdG90eXBlLlRva2VuID0gVG9rZW47XG5cblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZUlubGluZTtcbiIsIi8vIH5+c3RyaWtlIHRocm91Z2h+flxuLy9cbid1c2Ugc3RyaWN0JztcblxuXG52YXIgaXNXaGl0ZVNwYWNlICAgPSByZXF1aXJlKCcuLi9jb21tb24vdXRpbHMnKS5pc1doaXRlU3BhY2U7XG52YXIgaXNQdW5jdENoYXIgICAgPSByZXF1aXJlKCcuLi9jb21tb24vdXRpbHMnKS5pc1B1bmN0Q2hhcjtcbnZhciBpc01kQXNjaWlQdW5jdCA9IHJlcXVpcmUoJy4uL2NvbW1vbi91dGlscycpLmlzTWRBc2NpaVB1bmN0O1xuXG5cbi8vIHBhcnNlIHNlcXVlbmNlIG9mIG1hcmtlcnMsXG4vLyBcInN0YXJ0XCIgc2hvdWxkIHBvaW50IGF0IGEgdmFsaWQgbWFya2VyXG5mdW5jdGlvbiBzY2FuRGVsaW1zKHN0YXRlLCBzdGFydCkge1xuICB2YXIgcG9zID0gc3RhcnQsIGxhc3RDaGFyLCBuZXh0Q2hhciwgY291bnQsXG4gICAgICBpc0xhc3RXaGl0ZVNwYWNlLCBpc0xhc3RQdW5jdENoYXIsXG4gICAgICBpc05leHRXaGl0ZVNwYWNlLCBpc05leHRQdW5jdENoYXIsXG4gICAgICBjYW5fb3BlbiA9IHRydWUsXG4gICAgICBjYW5fY2xvc2UgPSB0cnVlLFxuICAgICAgbWF4ID0gc3RhdGUucG9zTWF4LFxuICAgICAgbWFya2VyID0gc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhcnQpO1xuXG4gIC8vIHRyZWF0IGJlZ2lubmluZyBvZiB0aGUgbGluZSBhcyBhIHdoaXRlc3BhY2VcbiAgbGFzdENoYXIgPSBzdGFydCA+IDAgPyBzdGF0ZS5zcmMuY2hhckNvZGVBdChzdGFydCAtIDEpIDogMHgyMDtcblxuICB3aGlsZSAocG9zIDwgbWF4ICYmIHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgPT09IG1hcmtlcikgeyBwb3MrKzsgfVxuXG4gIGlmIChwb3MgPj0gbWF4KSB7XG4gICAgY2FuX29wZW4gPSBmYWxzZTtcbiAgfVxuXG4gIGNvdW50ID0gcG9zIC0gc3RhcnQ7XG5cbiAgLy8gdHJlYXQgZW5kIG9mIHRoZSBsaW5lIGFzIGEgd2hpdGVzcGFjZVxuICBuZXh0Q2hhciA9IHBvcyA8IG1heCA/IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHBvcykgOiAweDIwO1xuXG4gIGlzTGFzdFB1bmN0Q2hhciA9IGlzTWRBc2NpaVB1bmN0KGxhc3RDaGFyKSB8fCBpc1B1bmN0Q2hhcihTdHJpbmcuZnJvbUNoYXJDb2RlKGxhc3RDaGFyKSk7XG4gIGlzTmV4dFB1bmN0Q2hhciA9IGlzTWRBc2NpaVB1bmN0KG5leHRDaGFyKSB8fCBpc1B1bmN0Q2hhcihTdHJpbmcuZnJvbUNoYXJDb2RlKG5leHRDaGFyKSk7XG5cbiAgaXNMYXN0V2hpdGVTcGFjZSA9IGlzV2hpdGVTcGFjZShsYXN0Q2hhcik7XG4gIGlzTmV4dFdoaXRlU3BhY2UgPSBpc1doaXRlU3BhY2UobmV4dENoYXIpO1xuXG4gIGlmIChpc05leHRXaGl0ZVNwYWNlKSB7XG4gICAgY2FuX29wZW4gPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChpc05leHRQdW5jdENoYXIpIHtcbiAgICBpZiAoIShpc0xhc3RXaGl0ZVNwYWNlIHx8IGlzTGFzdFB1bmN0Q2hhcikpIHtcbiAgICAgIGNhbl9vcGVuID0gZmFsc2U7XG4gICAgfVxuICB9XG5cbiAgaWYgKGlzTGFzdFdoaXRlU3BhY2UpIHtcbiAgICBjYW5fY2xvc2UgPSBmYWxzZTtcbiAgfSBlbHNlIGlmIChpc0xhc3RQdW5jdENoYXIpIHtcbiAgICBpZiAoIShpc05leHRXaGl0ZVNwYWNlIHx8IGlzTmV4dFB1bmN0Q2hhcikpIHtcbiAgICAgIGNhbl9jbG9zZSA9IGZhbHNlO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiB7XG4gICAgY2FuX29wZW46IGNhbl9vcGVuLFxuICAgIGNhbl9jbG9zZTogY2FuX2Nsb3NlLFxuICAgIGRlbGltczogY291bnRcbiAgfTtcbn1cblxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHN0cmlrZXRocm91Z2goc3RhdGUsIHNpbGVudCkge1xuICB2YXIgc3RhcnRDb3VudCxcbiAgICAgIGNvdW50LFxuICAgICAgdGFnQ291bnQsXG4gICAgICBmb3VuZCxcbiAgICAgIHN0YWNrLFxuICAgICAgcmVzLFxuICAgICAgdG9rZW4sXG4gICAgICBtYXggPSBzdGF0ZS5wb3NNYXgsXG4gICAgICBzdGFydCA9IHN0YXRlLnBvcyxcbiAgICAgIG1hcmtlciA9IHN0YXRlLnNyYy5jaGFyQ29kZUF0KHN0YXJ0KTtcblxuICBpZiAobWFya2VyICE9PSAweDdFLyogfiAqLykgeyByZXR1cm4gZmFsc2U7IH1cbiAgaWYgKHNpbGVudCkgeyByZXR1cm4gZmFsc2U7IH0gLy8gZG9uJ3QgcnVuIGFueSBwYWlycyBpbiB2YWxpZGF0aW9uIG1vZGVcblxuICByZXMgPSBzY2FuRGVsaW1zKHN0YXRlLCBzdGFydCk7XG4gIHN0YXJ0Q291bnQgPSByZXMuZGVsaW1zO1xuICBpZiAoIXJlcy5jYW5fb3Blbikge1xuICAgIHN0YXRlLnBvcyArPSBzdGFydENvdW50O1xuICAgIC8vIEVhcmxpZXIgd2UgY2hlY2tlZCAhc2lsZW50LCBidXQgdGhpcyBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdCBuZWVkIGl0XG4gICAgc3RhdGUucGVuZGluZyArPSBzdGF0ZS5zcmMuc2xpY2Uoc3RhcnQsIHN0YXRlLnBvcyk7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICBzdGFjayA9IE1hdGguZmxvb3Ioc3RhcnRDb3VudCAvIDIpO1xuICBpZiAoc3RhY2sgPD0gMCkgeyByZXR1cm4gZmFsc2U7IH1cbiAgc3RhdGUucG9zID0gc3RhcnQgKyBzdGFydENvdW50O1xuXG4gIHdoaWxlIChzdGF0ZS5wb3MgPCBtYXgpIHtcbiAgICBpZiAoc3RhdGUuc3JjLmNoYXJDb2RlQXQoc3RhdGUucG9zKSA9PT0gbWFya2VyKSB7XG4gICAgICByZXMgPSBzY2FuRGVsaW1zKHN0YXRlLCBzdGF0ZS5wb3MpO1xuICAgICAgY291bnQgPSByZXMuZGVsaW1zO1xuICAgICAgdGFnQ291bnQgPSBNYXRoLmZsb29yKGNvdW50IC8gMik7XG4gICAgICBpZiAocmVzLmNhbl9jbG9zZSkge1xuICAgICAgICBpZiAodGFnQ291bnQgPj0gc3RhY2spIHtcbiAgICAgICAgICBzdGF0ZS5wb3MgKz0gY291bnQgLSAyO1xuICAgICAgICAgIGZvdW5kID0gdHJ1ZTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgICBzdGFjayAtPSB0YWdDb3VudDtcbiAgICAgICAgc3RhdGUucG9zICs9IGNvdW50O1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKHJlcy5jYW5fb3BlbikgeyBzdGFjayArPSB0YWdDb3VudDsgfVxuICAgICAgc3RhdGUucG9zICs9IGNvdW50O1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgc3RhdGUubWQuaW5saW5lLnNraXBUb2tlbihzdGF0ZSk7XG4gIH1cblxuICBpZiAoIWZvdW5kKSB7XG4gICAgLy8gcGFyc2VyIGZhaWxlZCB0byBmaW5kIGVuZGluZyB0YWcsIHNvIGl0J3Mgbm90IHZhbGlkIGVtcGhhc2lzXG4gICAgc3RhdGUucG9zID0gc3RhcnQ7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLy8gZm91bmQhXG4gIHN0YXRlLnBvc01heCA9IHN0YXRlLnBvcztcbiAgc3RhdGUucG9zID0gc3RhcnQgKyAyO1xuXG4gIC8vIEVhcmxpZXIgd2UgY2hlY2tlZCAhc2lsZW50LCBidXQgdGhpcyBpbXBsZW1lbnRhdGlvbiBkb2VzIG5vdCBuZWVkIGl0XG4gIHRva2VuICAgICAgICA9IHN0YXRlLnB1c2goJ3Nfb3BlbicsICdzJywgMSk7XG4gIHRva2VuLm1hcmt1cCA9ICd+fic7XG5cbiAgc3RhdGUubWQuaW5saW5lLnRva2VuaXplKHN0YXRlKTtcblxuICB0b2tlbiAgICAgICAgPSBzdGF0ZS5wdXNoKCdzX2Nsb3NlJywgJ3MnLCAtMSk7XG4gIHRva2VuLm1hcmt1cCA9ICd+fic7XG5cbiAgc3RhdGUucG9zID0gc3RhdGUucG9zTWF4ICsgMjtcbiAgc3RhdGUucG9zTWF4ID0gbWF4O1xuICByZXR1cm4gdHJ1ZTtcbn07XG4iLCIvLyBTa2lwIHRleHQgY2hhcmFjdGVycyBmb3IgdGV4dCB0b2tlbiwgcGxhY2UgdGhvc2UgdG8gcGVuZGluZyBidWZmZXJcbi8vIGFuZCBpbmNyZW1lbnQgY3VycmVudCBwb3NcblxuJ3VzZSBzdHJpY3QnO1xuXG5cbi8vIFJ1bGUgdG8gc2tpcCBwdXJlIHRleHRcbi8vICd7fSQlQH4rPTonIHJlc2VydmVkIGZvciBleHRlbnRpb25zXG5cbi8vICEsIFwiLCAjLCAkLCAlLCAmLCAnLCAoLCApLCAqLCArLCAsLCAtLCAuLCAvLCA6LCA7LCA8LCA9LCA+LCA/LCBALCBbLCBcXCwgXSwgXiwgXywgYCwgeywgfCwgfSwgb3IgflxuXG4vLyAhISEhIERvbid0IGNvbmZ1c2Ugd2l0aCBcIk1hcmtkb3duIEFTQ0lJIFB1bmN0dWF0aW9uXCIgY2hhcnNcbi8vIGh0dHA6Ly9zcGVjLmNvbW1vbm1hcmsub3JnLzAuMTUvI2FzY2lpLXB1bmN0dWF0aW9uLWNoYXJhY3RlclxuZnVuY3Rpb24gaXNUZXJtaW5hdG9yQ2hhcihjaCkge1xuICBzd2l0Y2ggKGNoKSB7XG4gICAgY2FzZSAweDBBLyogXFxuICovOlxuICAgIGNhc2UgMHgyMS8qICEgKi86XG4gICAgY2FzZSAweDIzLyogIyAqLzpcbiAgICBjYXNlIDB4MjQvKiAkICovOlxuICAgIGNhc2UgMHgyNS8qICUgKi86XG4gICAgY2FzZSAweDI2LyogJiAqLzpcbiAgICBjYXNlIDB4MkEvKiAqICovOlxuICAgIGNhc2UgMHgyQi8qICsgKi86XG4gICAgY2FzZSAweDJELyogLSAqLzpcbiAgICBjYXNlIDB4M0EvKiA6ICovOlxuICAgIGNhc2UgMHgzQy8qIDwgKi86XG4gICAgY2FzZSAweDNELyogPSAqLzpcbiAgICBjYXNlIDB4M0UvKiA+ICovOlxuICAgIGNhc2UgMHg0MC8qIEAgKi86XG4gICAgY2FzZSAweDVCLyogWyAqLzpcbiAgICBjYXNlIDB4NUMvKiBcXCAqLzpcbiAgICBjYXNlIDB4NUQvKiBdICovOlxuICAgIGNhc2UgMHg1RS8qIF4gKi86XG4gICAgY2FzZSAweDVGLyogXyAqLzpcbiAgICBjYXNlIDB4NjAvKiBgICovOlxuICAgIGNhc2UgMHg3Qi8qIHsgKi86XG4gICAgY2FzZSAweDdELyogfSAqLzpcbiAgICBjYXNlIDB4N0UvKiB+ICovOlxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRleHQoc3RhdGUsIHNpbGVudCkge1xuICB2YXIgcG9zID0gc3RhdGUucG9zO1xuXG4gIHdoaWxlIChwb3MgPCBzdGF0ZS5wb3NNYXggJiYgIWlzVGVybWluYXRvckNoYXIoc3RhdGUuc3JjLmNoYXJDb2RlQXQocG9zKSkpIHtcbiAgICBwb3MrKztcbiAgfVxuXG4gIGlmIChwb3MgPT09IHN0YXRlLnBvcykgeyByZXR1cm4gZmFsc2U7IH1cblxuICBpZiAoIXNpbGVudCkgeyBzdGF0ZS5wZW5kaW5nICs9IHN0YXRlLnNyYy5zbGljZShzdGF0ZS5wb3MsIHBvcyk7IH1cblxuICBzdGF0ZS5wb3MgPSBwb3M7XG5cbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyBBbHRlcm5hdGl2ZSBpbXBsZW1lbnRhdGlvbiwgZm9yIG1lbW9yeS5cbi8vXG4vLyBJdCBjb3N0cyAxMCUgb2YgcGVyZm9ybWFuY2UsIGJ1dCBhbGxvd3MgZXh0ZW5kIHRlcm1pbmF0b3JzIGxpc3QsIGlmIHBsYWNlIGl0XG4vLyB0byBgUGFyY2VySW5saW5lYCBwcm9wZXJ0eS4gUHJvYmFibHksIHdpbGwgc3dpdGNoIHRvIGl0IHNvbWV0aW1lLCBzdWNoXG4vLyBmbGV4aWJpbGl0eSByZXF1aXJlZC5cblxuLypcbnZhciBURVJNSU5BVE9SX1JFID0gL1tcXG4hIyQlJiorXFwtOjw9PkBbXFxcXFxcXV5fYHt9fl0vO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIHRleHQoc3RhdGUsIHNpbGVudCkge1xuICB2YXIgcG9zID0gc3RhdGUucG9zLFxuICAgICAgaWR4ID0gc3RhdGUuc3JjLnNsaWNlKHBvcykuc2VhcmNoKFRFUk1JTkFUT1JfUkUpO1xuXG4gIC8vIGZpcnN0IGNoYXIgaXMgdGVybWluYXRvciAtPiBlbXB0eSB0ZXh0XG4gIGlmIChpZHggPT09IDApIHsgcmV0dXJuIGZhbHNlOyB9XG5cbiAgLy8gbm8gdGVybWluYXRvciAtPiB0ZXh0IHRpbGwgZW5kIG9mIHN0cmluZ1xuICBpZiAoaWR4IDwgMCkge1xuICAgIGlmICghc2lsZW50KSB7IHN0YXRlLnBlbmRpbmcgKz0gc3RhdGUuc3JjLnNsaWNlKHBvcyk7IH1cbiAgICBzdGF0ZS5wb3MgPSBzdGF0ZS5zcmMubGVuZ3RoO1xuICAgIHJldHVybiB0cnVlO1xuICB9XG5cbiAgaWYgKCFzaWxlbnQpIHsgc3RhdGUucGVuZGluZyArPSBzdGF0ZS5zcmMuc2xpY2UocG9zLCBwb3MgKyBpZHgpOyB9XG5cbiAgc3RhdGUucG9zICs9IGlkeDtcblxuICByZXR1cm4gdHJ1ZTtcbn07Ki9cbiIsIi8vIFRva2VuIGNsYXNzXG5cbid1c2Ugc3RyaWN0JztcblxuXG4vKipcbiAqIGNsYXNzIFRva2VuXG4gKiovXG5cbi8qKlxuICogbmV3IFRva2VuKHR5cGUsIHRhZywgbmVzdGluZylcbiAqXG4gKiBDcmVhdGUgbmV3IHRva2VuIGFuZCBmaWxsIHBhc3NlZCBwcm9wZXJ0aWVzLlxuICoqL1xuZnVuY3Rpb24gVG9rZW4odHlwZSwgdGFnLCBuZXN0aW5nKSB7XG4gIC8qKlxuICAgKiBUb2tlbiN0eXBlIC0+IFN0cmluZ1xuICAgKlxuICAgKiBUeXBlIG9mIHRoZSB0b2tlbiAoc3RyaW5nLCBlLmcuIFwicGFyYWdyYXBoX29wZW5cIilcbiAgICoqL1xuICB0aGlzLnR5cGUgICAgID0gdHlwZTtcblxuICAvKipcbiAgICogVG9rZW4jdGFnIC0+IFN0cmluZ1xuICAgKlxuICAgKiBodG1sIHRhZyBuYW1lLCBlLmcuIFwicFwiXG4gICAqKi9cbiAgdGhpcy50YWcgICAgICA9IHRhZztcblxuICAvKipcbiAgICogVG9rZW4jYXR0cnMgLT4gQXJyYXlcbiAgICpcbiAgICogSHRtbCBhdHRyaWJ1dGVzLiBGb3JtYXQ6IGBbIFsgbmFtZTEsIHZhbHVlMSBdLCBbIG5hbWUyLCB2YWx1ZTIgXSBdYFxuICAgKiovXG4gIHRoaXMuYXR0cnMgICAgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBUb2tlbiNtYXAgLT4gQXJyYXlcbiAgICpcbiAgICogU291cmNlIG1hcCBpbmZvLiBGb3JtYXQ6IGBbIGxpbmVfYmVnaW4sIGxpbmVfZW5kIF1gXG4gICAqKi9cbiAgdGhpcy5tYXAgICAgICA9IG51bGw7XG5cbiAgLyoqXG4gICAqIFRva2VuI25lc3RpbmcgLT4gTnVtYmVyXG4gICAqXG4gICAqIExldmVsIGNoYW5nZSAobnVtYmVyIGluIHstMSwgMCwgMX0gc2V0KSwgd2hlcmU6XG4gICAqXG4gICAqIC0gIGAxYCBtZWFucyB0aGUgdGFnIGlzIG9wZW5pbmdcbiAgICogLSAgYDBgIG1lYW5zIHRoZSB0YWcgaXMgc2VsZi1jbG9zaW5nXG4gICAqIC0gYC0xYCBtZWFucyB0aGUgdGFnIGlzIGNsb3NpbmdcbiAgICoqL1xuICB0aGlzLm5lc3RpbmcgID0gbmVzdGluZztcblxuICAvKipcbiAgICogVG9rZW4jbGV2ZWwgLT4gTnVtYmVyXG4gICAqXG4gICAqIG5lc3RpbmcgbGV2ZWwsIHRoZSBzYW1lIGFzIGBzdGF0ZS5sZXZlbGBcbiAgICoqL1xuICB0aGlzLmxldmVsICAgID0gMDtcblxuICAvKipcbiAgICogVG9rZW4jY2hpbGRyZW4gLT4gQXJyYXlcbiAgICpcbiAgICogQW4gYXJyYXkgb2YgY2hpbGQgbm9kZXMgKGlubGluZSBhbmQgaW1nIHRva2VucylcbiAgICoqL1xuICB0aGlzLmNoaWxkcmVuID0gbnVsbDtcblxuICAvKipcbiAgICogVG9rZW4jY29udGVudCAtPiBTdHJpbmdcbiAgICpcbiAgICogSW4gYSBjYXNlIG9mIHNlbGYtY2xvc2luZyB0YWcgKGNvZGUsIGh0bWwsIGZlbmNlLCBldGMuKSxcbiAgICogaXQgaGFzIGNvbnRlbnRzIG9mIHRoaXMgdGFnLlxuICAgKiovXG4gIHRoaXMuY29udGVudCAgPSAnJztcblxuICAvKipcbiAgICogVG9rZW4jbWFya3VwIC0+IFN0cmluZ1xuICAgKlxuICAgKiAnKicgb3IgJ18nIGZvciBlbXBoYXNpcywgZmVuY2Ugc3RyaW5nIGZvciBmZW5jZSwgZXRjLlxuICAgKiovXG4gIHRoaXMubWFya3VwICAgPSAnJztcblxuICAvKipcbiAgICogVG9rZW4jaW5mbyAtPiBTdHJpbmdcbiAgICpcbiAgICogZmVuY2UgaW5mb3N0cmluZ1xuICAgKiovXG4gIHRoaXMuaW5mbyAgICAgPSAnJztcblxuICAvKipcbiAgICogVG9rZW4jbWV0YSAtPiBPYmplY3RcbiAgICpcbiAgICogQSBwbGFjZSBmb3IgcGx1Z2lucyB0byBzdG9yZSBhbiBhcmJpdHJhcnkgZGF0YVxuICAgKiovXG4gIHRoaXMubWV0YSAgICAgPSBudWxsO1xuXG4gIC8qKlxuICAgKiBUb2tlbiNibG9jayAtPiBCb29sZWFuXG4gICAqXG4gICAqIFRydWUgZm9yIGJsb2NrLWxldmVsIHRva2VucywgZmFsc2UgZm9yIGlubGluZSB0b2tlbnMuXG4gICAqIFVzZWQgaW4gcmVuZGVyZXIgdG8gY2FsY3VsYXRlIGxpbmUgYnJlYWtzXG4gICAqKi9cbiAgdGhpcy5ibG9jayAgICA9IGZhbHNlO1xuXG4gIC8qKlxuICAgKiBUb2tlbiNoaWRkZW4gLT4gQm9vbGVhblxuICAgKlxuICAgKiBJZiBpdCdzIHRydWUsIGlnbm9yZSB0aGlzIGVsZW1lbnQgd2hlbiByZW5kZXJpbmcuIFVzZWQgZm9yIHRpZ2h0IGxpc3RzXG4gICAqIHRvIGhpZGUgcGFyYWdyYXBocy5cbiAgICoqL1xuICB0aGlzLmhpZGRlbiAgID0gZmFsc2U7XG59XG5cblxuLyoqXG4gKiBUb2tlbi5hdHRySW5kZXgobmFtZSkgLT4gTnVtYmVyXG4gKlxuICogU2VhcmNoIGF0dHJpYnV0ZSBpbmRleCBieSBuYW1lLlxuICoqL1xuVG9rZW4ucHJvdG90eXBlLmF0dHJJbmRleCA9IGZ1bmN0aW9uIGF0dHJJbmRleChuYW1lKSB7XG4gIHZhciBhdHRycywgaSwgbGVuO1xuXG4gIGlmICghdGhpcy5hdHRycykgeyByZXR1cm4gLTE7IH1cblxuICBhdHRycyA9IHRoaXMuYXR0cnM7XG5cbiAgZm9yIChpID0gMCwgbGVuID0gYXR0cnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICBpZiAoYXR0cnNbaV1bMF0gPT09IG5hbWUpIHsgcmV0dXJuIGk7IH1cbiAgfVxuICByZXR1cm4gLTE7XG59O1xuXG5cbi8qKlxuICogVG9rZW4uYXR0clB1c2goYXR0ckRhdGEpXG4gKlxuICogQWRkIGBbIG5hbWUsIHZhbHVlIF1gIGF0dHJpYnV0ZSB0byBsaXN0LiBJbml0IGF0dHJzIGlmIG5lY2Vzc2FyeVxuICoqL1xuVG9rZW4ucHJvdG90eXBlLmF0dHJQdXNoID0gZnVuY3Rpb24gYXR0clB1c2goYXR0ckRhdGEpIHtcbiAgaWYgKHRoaXMuYXR0cnMpIHtcbiAgICB0aGlzLmF0dHJzLnB1c2goYXR0ckRhdGEpO1xuICB9IGVsc2Uge1xuICAgIHRoaXMuYXR0cnMgPSBbIGF0dHJEYXRhIF07XG4gIH1cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBUb2tlbjtcbiIsIm1vZHVsZS5leHBvcnRzPXtcIkFhY3V0ZVwiOlwiXFx1MDBDMVwiLFwiYWFjdXRlXCI6XCJcXHUwMEUxXCIsXCJBYnJldmVcIjpcIlxcdTAxMDJcIixcImFicmV2ZVwiOlwiXFx1MDEwM1wiLFwiYWNcIjpcIlxcdTIyM0VcIixcImFjZFwiOlwiXFx1MjIzRlwiLFwiYWNFXCI6XCJcXHUyMjNFXFx1MDMzM1wiLFwiQWNpcmNcIjpcIlxcdTAwQzJcIixcImFjaXJjXCI6XCJcXHUwMEUyXCIsXCJhY3V0ZVwiOlwiXFx1MDBCNFwiLFwiQWN5XCI6XCJcXHUwNDEwXCIsXCJhY3lcIjpcIlxcdTA0MzBcIixcIkFFbGlnXCI6XCJcXHUwMEM2XCIsXCJhZWxpZ1wiOlwiXFx1MDBFNlwiLFwiYWZcIjpcIlxcdTIwNjFcIixcIkFmclwiOlwiXFx1RDgzNVxcdUREMDRcIixcImFmclwiOlwiXFx1RDgzNVxcdUREMUVcIixcIkFncmF2ZVwiOlwiXFx1MDBDMFwiLFwiYWdyYXZlXCI6XCJcXHUwMEUwXCIsXCJhbGVmc3ltXCI6XCJcXHUyMTM1XCIsXCJhbGVwaFwiOlwiXFx1MjEzNVwiLFwiQWxwaGFcIjpcIlxcdTAzOTFcIixcImFscGhhXCI6XCJcXHUwM0IxXCIsXCJBbWFjclwiOlwiXFx1MDEwMFwiLFwiYW1hY3JcIjpcIlxcdTAxMDFcIixcImFtYWxnXCI6XCJcXHUyQTNGXCIsXCJhbXBcIjpcIiZcIixcIkFNUFwiOlwiJlwiLFwiYW5kYW5kXCI6XCJcXHUyQTU1XCIsXCJBbmRcIjpcIlxcdTJBNTNcIixcImFuZFwiOlwiXFx1MjIyN1wiLFwiYW5kZFwiOlwiXFx1MkE1Q1wiLFwiYW5kc2xvcGVcIjpcIlxcdTJBNThcIixcImFuZHZcIjpcIlxcdTJBNUFcIixcImFuZ1wiOlwiXFx1MjIyMFwiLFwiYW5nZVwiOlwiXFx1MjlBNFwiLFwiYW5nbGVcIjpcIlxcdTIyMjBcIixcImFuZ21zZGFhXCI6XCJcXHUyOUE4XCIsXCJhbmdtc2RhYlwiOlwiXFx1MjlBOVwiLFwiYW5nbXNkYWNcIjpcIlxcdTI5QUFcIixcImFuZ21zZGFkXCI6XCJcXHUyOUFCXCIsXCJhbmdtc2RhZVwiOlwiXFx1MjlBQ1wiLFwiYW5nbXNkYWZcIjpcIlxcdTI5QURcIixcImFuZ21zZGFnXCI6XCJcXHUyOUFFXCIsXCJhbmdtc2RhaFwiOlwiXFx1MjlBRlwiLFwiYW5nbXNkXCI6XCJcXHUyMjIxXCIsXCJhbmdydFwiOlwiXFx1MjIxRlwiLFwiYW5ncnR2YlwiOlwiXFx1MjJCRVwiLFwiYW5ncnR2YmRcIjpcIlxcdTI5OURcIixcImFuZ3NwaFwiOlwiXFx1MjIyMlwiLFwiYW5nc3RcIjpcIlxcdTAwQzVcIixcImFuZ3phcnJcIjpcIlxcdTIzN0NcIixcIkFvZ29uXCI6XCJcXHUwMTA0XCIsXCJhb2dvblwiOlwiXFx1MDEwNVwiLFwiQW9wZlwiOlwiXFx1RDgzNVxcdUREMzhcIixcImFvcGZcIjpcIlxcdUQ4MzVcXHVERDUyXCIsXCJhcGFjaXJcIjpcIlxcdTJBNkZcIixcImFwXCI6XCJcXHUyMjQ4XCIsXCJhcEVcIjpcIlxcdTJBNzBcIixcImFwZVwiOlwiXFx1MjI0QVwiLFwiYXBpZFwiOlwiXFx1MjI0QlwiLFwiYXBvc1wiOlwiJ1wiLFwiQXBwbHlGdW5jdGlvblwiOlwiXFx1MjA2MVwiLFwiYXBwcm94XCI6XCJcXHUyMjQ4XCIsXCJhcHByb3hlcVwiOlwiXFx1MjI0QVwiLFwiQXJpbmdcIjpcIlxcdTAwQzVcIixcImFyaW5nXCI6XCJcXHUwMEU1XCIsXCJBc2NyXCI6XCJcXHVEODM1XFx1REM5Q1wiLFwiYXNjclwiOlwiXFx1RDgzNVxcdURDQjZcIixcIkFzc2lnblwiOlwiXFx1MjI1NFwiLFwiYXN0XCI6XCIqXCIsXCJhc3ltcFwiOlwiXFx1MjI0OFwiLFwiYXN5bXBlcVwiOlwiXFx1MjI0RFwiLFwiQXRpbGRlXCI6XCJcXHUwMEMzXCIsXCJhdGlsZGVcIjpcIlxcdTAwRTNcIixcIkF1bWxcIjpcIlxcdTAwQzRcIixcImF1bWxcIjpcIlxcdTAwRTRcIixcImF3Y29uaW50XCI6XCJcXHUyMjMzXCIsXCJhd2ludFwiOlwiXFx1MkExMVwiLFwiYmFja2NvbmdcIjpcIlxcdTIyNENcIixcImJhY2tlcHNpbG9uXCI6XCJcXHUwM0Y2XCIsXCJiYWNrcHJpbWVcIjpcIlxcdTIwMzVcIixcImJhY2tzaW1cIjpcIlxcdTIyM0RcIixcImJhY2tzaW1lcVwiOlwiXFx1MjJDRFwiLFwiQmFja3NsYXNoXCI6XCJcXHUyMjE2XCIsXCJCYXJ2XCI6XCJcXHUyQUU3XCIsXCJiYXJ2ZWVcIjpcIlxcdTIyQkRcIixcImJhcndlZFwiOlwiXFx1MjMwNVwiLFwiQmFyd2VkXCI6XCJcXHUyMzA2XCIsXCJiYXJ3ZWRnZVwiOlwiXFx1MjMwNVwiLFwiYmJya1wiOlwiXFx1MjNCNVwiLFwiYmJya3RicmtcIjpcIlxcdTIzQjZcIixcImJjb25nXCI6XCJcXHUyMjRDXCIsXCJCY3lcIjpcIlxcdTA0MTFcIixcImJjeVwiOlwiXFx1MDQzMVwiLFwiYmRxdW9cIjpcIlxcdTIwMUVcIixcImJlY2F1c1wiOlwiXFx1MjIzNVwiLFwiYmVjYXVzZVwiOlwiXFx1MjIzNVwiLFwiQmVjYXVzZVwiOlwiXFx1MjIzNVwiLFwiYmVtcHR5dlwiOlwiXFx1MjlCMFwiLFwiYmVwc2lcIjpcIlxcdTAzRjZcIixcImJlcm5vdVwiOlwiXFx1MjEyQ1wiLFwiQmVybm91bGxpc1wiOlwiXFx1MjEyQ1wiLFwiQmV0YVwiOlwiXFx1MDM5MlwiLFwiYmV0YVwiOlwiXFx1MDNCMlwiLFwiYmV0aFwiOlwiXFx1MjEzNlwiLFwiYmV0d2VlblwiOlwiXFx1MjI2Q1wiLFwiQmZyXCI6XCJcXHVEODM1XFx1REQwNVwiLFwiYmZyXCI6XCJcXHVEODM1XFx1REQxRlwiLFwiYmlnY2FwXCI6XCJcXHUyMkMyXCIsXCJiaWdjaXJjXCI6XCJcXHUyNUVGXCIsXCJiaWdjdXBcIjpcIlxcdTIyQzNcIixcImJpZ29kb3RcIjpcIlxcdTJBMDBcIixcImJpZ29wbHVzXCI6XCJcXHUyQTAxXCIsXCJiaWdvdGltZXNcIjpcIlxcdTJBMDJcIixcImJpZ3NxY3VwXCI6XCJcXHUyQTA2XCIsXCJiaWdzdGFyXCI6XCJcXHUyNjA1XCIsXCJiaWd0cmlhbmdsZWRvd25cIjpcIlxcdTI1QkRcIixcImJpZ3RyaWFuZ2xldXBcIjpcIlxcdTI1QjNcIixcImJpZ3VwbHVzXCI6XCJcXHUyQTA0XCIsXCJiaWd2ZWVcIjpcIlxcdTIyQzFcIixcImJpZ3dlZGdlXCI6XCJcXHUyMkMwXCIsXCJia2Fyb3dcIjpcIlxcdTI5MERcIixcImJsYWNrbG96ZW5nZVwiOlwiXFx1MjlFQlwiLFwiYmxhY2tzcXVhcmVcIjpcIlxcdTI1QUFcIixcImJsYWNrdHJpYW5nbGVcIjpcIlxcdTI1QjRcIixcImJsYWNrdHJpYW5nbGVkb3duXCI6XCJcXHUyNUJFXCIsXCJibGFja3RyaWFuZ2xlbGVmdFwiOlwiXFx1MjVDMlwiLFwiYmxhY2t0cmlhbmdsZXJpZ2h0XCI6XCJcXHUyNUI4XCIsXCJibGFua1wiOlwiXFx1MjQyM1wiLFwiYmxrMTJcIjpcIlxcdTI1OTJcIixcImJsazE0XCI6XCJcXHUyNTkxXCIsXCJibGszNFwiOlwiXFx1MjU5M1wiLFwiYmxvY2tcIjpcIlxcdTI1ODhcIixcImJuZVwiOlwiPVxcdTIwRTVcIixcImJuZXF1aXZcIjpcIlxcdTIyNjFcXHUyMEU1XCIsXCJiTm90XCI6XCJcXHUyQUVEXCIsXCJibm90XCI6XCJcXHUyMzEwXCIsXCJCb3BmXCI6XCJcXHVEODM1XFx1REQzOVwiLFwiYm9wZlwiOlwiXFx1RDgzNVxcdURENTNcIixcImJvdFwiOlwiXFx1MjJBNVwiLFwiYm90dG9tXCI6XCJcXHUyMkE1XCIsXCJib3d0aWVcIjpcIlxcdTIyQzhcIixcImJveGJveFwiOlwiXFx1MjlDOVwiLFwiYm94ZGxcIjpcIlxcdTI1MTBcIixcImJveGRMXCI6XCJcXHUyNTU1XCIsXCJib3hEbFwiOlwiXFx1MjU1NlwiLFwiYm94RExcIjpcIlxcdTI1NTdcIixcImJveGRyXCI6XCJcXHUyNTBDXCIsXCJib3hkUlwiOlwiXFx1MjU1MlwiLFwiYm94RHJcIjpcIlxcdTI1NTNcIixcImJveERSXCI6XCJcXHUyNTU0XCIsXCJib3hoXCI6XCJcXHUyNTAwXCIsXCJib3hIXCI6XCJcXHUyNTUwXCIsXCJib3hoZFwiOlwiXFx1MjUyQ1wiLFwiYm94SGRcIjpcIlxcdTI1NjRcIixcImJveGhEXCI6XCJcXHUyNTY1XCIsXCJib3hIRFwiOlwiXFx1MjU2NlwiLFwiYm94aHVcIjpcIlxcdTI1MzRcIixcImJveEh1XCI6XCJcXHUyNTY3XCIsXCJib3hoVVwiOlwiXFx1MjU2OFwiLFwiYm94SFVcIjpcIlxcdTI1NjlcIixcImJveG1pbnVzXCI6XCJcXHUyMjlGXCIsXCJib3hwbHVzXCI6XCJcXHUyMjlFXCIsXCJib3h0aW1lc1wiOlwiXFx1MjJBMFwiLFwiYm94dWxcIjpcIlxcdTI1MThcIixcImJveHVMXCI6XCJcXHUyNTVCXCIsXCJib3hVbFwiOlwiXFx1MjU1Q1wiLFwiYm94VUxcIjpcIlxcdTI1NURcIixcImJveHVyXCI6XCJcXHUyNTE0XCIsXCJib3h1UlwiOlwiXFx1MjU1OFwiLFwiYm94VXJcIjpcIlxcdTI1NTlcIixcImJveFVSXCI6XCJcXHUyNTVBXCIsXCJib3h2XCI6XCJcXHUyNTAyXCIsXCJib3hWXCI6XCJcXHUyNTUxXCIsXCJib3h2aFwiOlwiXFx1MjUzQ1wiLFwiYm94dkhcIjpcIlxcdTI1NkFcIixcImJveFZoXCI6XCJcXHUyNTZCXCIsXCJib3hWSFwiOlwiXFx1MjU2Q1wiLFwiYm94dmxcIjpcIlxcdTI1MjRcIixcImJveHZMXCI6XCJcXHUyNTYxXCIsXCJib3hWbFwiOlwiXFx1MjU2MlwiLFwiYm94VkxcIjpcIlxcdTI1NjNcIixcImJveHZyXCI6XCJcXHUyNTFDXCIsXCJib3h2UlwiOlwiXFx1MjU1RVwiLFwiYm94VnJcIjpcIlxcdTI1NUZcIixcImJveFZSXCI6XCJcXHUyNTYwXCIsXCJicHJpbWVcIjpcIlxcdTIwMzVcIixcImJyZXZlXCI6XCJcXHUwMkQ4XCIsXCJCcmV2ZVwiOlwiXFx1MDJEOFwiLFwiYnJ2YmFyXCI6XCJcXHUwMEE2XCIsXCJic2NyXCI6XCJcXHVEODM1XFx1RENCN1wiLFwiQnNjclwiOlwiXFx1MjEyQ1wiLFwiYnNlbWlcIjpcIlxcdTIwNEZcIixcImJzaW1cIjpcIlxcdTIyM0RcIixcImJzaW1lXCI6XCJcXHUyMkNEXCIsXCJic29sYlwiOlwiXFx1MjlDNVwiLFwiYnNvbFwiOlwiXFxcXFwiLFwiYnNvbGhzdWJcIjpcIlxcdTI3QzhcIixcImJ1bGxcIjpcIlxcdTIwMjJcIixcImJ1bGxldFwiOlwiXFx1MjAyMlwiLFwiYnVtcFwiOlwiXFx1MjI0RVwiLFwiYnVtcEVcIjpcIlxcdTJBQUVcIixcImJ1bXBlXCI6XCJcXHUyMjRGXCIsXCJCdW1wZXFcIjpcIlxcdTIyNEVcIixcImJ1bXBlcVwiOlwiXFx1MjI0RlwiLFwiQ2FjdXRlXCI6XCJcXHUwMTA2XCIsXCJjYWN1dGVcIjpcIlxcdTAxMDdcIixcImNhcGFuZFwiOlwiXFx1MkE0NFwiLFwiY2FwYnJjdXBcIjpcIlxcdTJBNDlcIixcImNhcGNhcFwiOlwiXFx1MkE0QlwiLFwiY2FwXCI6XCJcXHUyMjI5XCIsXCJDYXBcIjpcIlxcdTIyRDJcIixcImNhcGN1cFwiOlwiXFx1MkE0N1wiLFwiY2FwZG90XCI6XCJcXHUyQTQwXCIsXCJDYXBpdGFsRGlmZmVyZW50aWFsRFwiOlwiXFx1MjE0NVwiLFwiY2Fwc1wiOlwiXFx1MjIyOVxcdUZFMDBcIixcImNhcmV0XCI6XCJcXHUyMDQxXCIsXCJjYXJvblwiOlwiXFx1MDJDN1wiLFwiQ2F5bGV5c1wiOlwiXFx1MjEyRFwiLFwiY2NhcHNcIjpcIlxcdTJBNERcIixcIkNjYXJvblwiOlwiXFx1MDEwQ1wiLFwiY2Nhcm9uXCI6XCJcXHUwMTBEXCIsXCJDY2VkaWxcIjpcIlxcdTAwQzdcIixcImNjZWRpbFwiOlwiXFx1MDBFN1wiLFwiQ2NpcmNcIjpcIlxcdTAxMDhcIixcImNjaXJjXCI6XCJcXHUwMTA5XCIsXCJDY29uaW50XCI6XCJcXHUyMjMwXCIsXCJjY3Vwc1wiOlwiXFx1MkE0Q1wiLFwiY2N1cHNzbVwiOlwiXFx1MkE1MFwiLFwiQ2RvdFwiOlwiXFx1MDEwQVwiLFwiY2RvdFwiOlwiXFx1MDEwQlwiLFwiY2VkaWxcIjpcIlxcdTAwQjhcIixcIkNlZGlsbGFcIjpcIlxcdTAwQjhcIixcImNlbXB0eXZcIjpcIlxcdTI5QjJcIixcImNlbnRcIjpcIlxcdTAwQTJcIixcImNlbnRlcmRvdFwiOlwiXFx1MDBCN1wiLFwiQ2VudGVyRG90XCI6XCJcXHUwMEI3XCIsXCJjZnJcIjpcIlxcdUQ4MzVcXHVERDIwXCIsXCJDZnJcIjpcIlxcdTIxMkRcIixcIkNIY3lcIjpcIlxcdTA0MjdcIixcImNoY3lcIjpcIlxcdTA0NDdcIixcImNoZWNrXCI6XCJcXHUyNzEzXCIsXCJjaGVja21hcmtcIjpcIlxcdTI3MTNcIixcIkNoaVwiOlwiXFx1MDNBN1wiLFwiY2hpXCI6XCJcXHUwM0M3XCIsXCJjaXJjXCI6XCJcXHUwMkM2XCIsXCJjaXJjZXFcIjpcIlxcdTIyNTdcIixcImNpcmNsZWFycm93bGVmdFwiOlwiXFx1MjFCQVwiLFwiY2lyY2xlYXJyb3dyaWdodFwiOlwiXFx1MjFCQlwiLFwiY2lyY2xlZGFzdFwiOlwiXFx1MjI5QlwiLFwiY2lyY2xlZGNpcmNcIjpcIlxcdTIyOUFcIixcImNpcmNsZWRkYXNoXCI6XCJcXHUyMjlEXCIsXCJDaXJjbGVEb3RcIjpcIlxcdTIyOTlcIixcImNpcmNsZWRSXCI6XCJcXHUwMEFFXCIsXCJjaXJjbGVkU1wiOlwiXFx1MjRDOFwiLFwiQ2lyY2xlTWludXNcIjpcIlxcdTIyOTZcIixcIkNpcmNsZVBsdXNcIjpcIlxcdTIyOTVcIixcIkNpcmNsZVRpbWVzXCI6XCJcXHUyMjk3XCIsXCJjaXJcIjpcIlxcdTI1Q0JcIixcImNpckVcIjpcIlxcdTI5QzNcIixcImNpcmVcIjpcIlxcdTIyNTdcIixcImNpcmZuaW50XCI6XCJcXHUyQTEwXCIsXCJjaXJtaWRcIjpcIlxcdTJBRUZcIixcImNpcnNjaXJcIjpcIlxcdTI5QzJcIixcIkNsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbFwiOlwiXFx1MjIzMlwiLFwiQ2xvc2VDdXJseURvdWJsZVF1b3RlXCI6XCJcXHUyMDFEXCIsXCJDbG9zZUN1cmx5UXVvdGVcIjpcIlxcdTIwMTlcIixcImNsdWJzXCI6XCJcXHUyNjYzXCIsXCJjbHVic3VpdFwiOlwiXFx1MjY2M1wiLFwiY29sb25cIjpcIjpcIixcIkNvbG9uXCI6XCJcXHUyMjM3XCIsXCJDb2xvbmVcIjpcIlxcdTJBNzRcIixcImNvbG9uZVwiOlwiXFx1MjI1NFwiLFwiY29sb25lcVwiOlwiXFx1MjI1NFwiLFwiY29tbWFcIjpcIixcIixcImNvbW1hdFwiOlwiQFwiLFwiY29tcFwiOlwiXFx1MjIwMVwiLFwiY29tcGZuXCI6XCJcXHUyMjE4XCIsXCJjb21wbGVtZW50XCI6XCJcXHUyMjAxXCIsXCJjb21wbGV4ZXNcIjpcIlxcdTIxMDJcIixcImNvbmdcIjpcIlxcdTIyNDVcIixcImNvbmdkb3RcIjpcIlxcdTJBNkRcIixcIkNvbmdydWVudFwiOlwiXFx1MjI2MVwiLFwiY29uaW50XCI6XCJcXHUyMjJFXCIsXCJDb25pbnRcIjpcIlxcdTIyMkZcIixcIkNvbnRvdXJJbnRlZ3JhbFwiOlwiXFx1MjIyRVwiLFwiY29wZlwiOlwiXFx1RDgzNVxcdURENTRcIixcIkNvcGZcIjpcIlxcdTIxMDJcIixcImNvcHJvZFwiOlwiXFx1MjIxMFwiLFwiQ29wcm9kdWN0XCI6XCJcXHUyMjEwXCIsXCJjb3B5XCI6XCJcXHUwMEE5XCIsXCJDT1BZXCI6XCJcXHUwMEE5XCIsXCJjb3B5c3JcIjpcIlxcdTIxMTdcIixcIkNvdW50ZXJDbG9ja3dpc2VDb250b3VySW50ZWdyYWxcIjpcIlxcdTIyMzNcIixcImNyYXJyXCI6XCJcXHUyMUI1XCIsXCJjcm9zc1wiOlwiXFx1MjcxN1wiLFwiQ3Jvc3NcIjpcIlxcdTJBMkZcIixcIkNzY3JcIjpcIlxcdUQ4MzVcXHVEQzlFXCIsXCJjc2NyXCI6XCJcXHVEODM1XFx1RENCOFwiLFwiY3N1YlwiOlwiXFx1MkFDRlwiLFwiY3N1YmVcIjpcIlxcdTJBRDFcIixcImNzdXBcIjpcIlxcdTJBRDBcIixcImNzdXBlXCI6XCJcXHUyQUQyXCIsXCJjdGRvdFwiOlwiXFx1MjJFRlwiLFwiY3VkYXJybFwiOlwiXFx1MjkzOFwiLFwiY3VkYXJyclwiOlwiXFx1MjkzNVwiLFwiY3VlcHJcIjpcIlxcdTIyREVcIixcImN1ZXNjXCI6XCJcXHUyMkRGXCIsXCJjdWxhcnJcIjpcIlxcdTIxQjZcIixcImN1bGFycnBcIjpcIlxcdTI5M0RcIixcImN1cGJyY2FwXCI6XCJcXHUyQTQ4XCIsXCJjdXBjYXBcIjpcIlxcdTJBNDZcIixcIkN1cENhcFwiOlwiXFx1MjI0RFwiLFwiY3VwXCI6XCJcXHUyMjJBXCIsXCJDdXBcIjpcIlxcdTIyRDNcIixcImN1cGN1cFwiOlwiXFx1MkE0QVwiLFwiY3VwZG90XCI6XCJcXHUyMjhEXCIsXCJjdXBvclwiOlwiXFx1MkE0NVwiLFwiY3Vwc1wiOlwiXFx1MjIyQVxcdUZFMDBcIixcImN1cmFyclwiOlwiXFx1MjFCN1wiLFwiY3VyYXJybVwiOlwiXFx1MjkzQ1wiLFwiY3VybHllcXByZWNcIjpcIlxcdTIyREVcIixcImN1cmx5ZXFzdWNjXCI6XCJcXHUyMkRGXCIsXCJjdXJseXZlZVwiOlwiXFx1MjJDRVwiLFwiY3VybHl3ZWRnZVwiOlwiXFx1MjJDRlwiLFwiY3VycmVuXCI6XCJcXHUwMEE0XCIsXCJjdXJ2ZWFycm93bGVmdFwiOlwiXFx1MjFCNlwiLFwiY3VydmVhcnJvd3JpZ2h0XCI6XCJcXHUyMUI3XCIsXCJjdXZlZVwiOlwiXFx1MjJDRVwiLFwiY3V3ZWRcIjpcIlxcdTIyQ0ZcIixcImN3Y29uaW50XCI6XCJcXHUyMjMyXCIsXCJjd2ludFwiOlwiXFx1MjIzMVwiLFwiY3lsY3R5XCI6XCJcXHUyMzJEXCIsXCJkYWdnZXJcIjpcIlxcdTIwMjBcIixcIkRhZ2dlclwiOlwiXFx1MjAyMVwiLFwiZGFsZXRoXCI6XCJcXHUyMTM4XCIsXCJkYXJyXCI6XCJcXHUyMTkzXCIsXCJEYXJyXCI6XCJcXHUyMUExXCIsXCJkQXJyXCI6XCJcXHUyMUQzXCIsXCJkYXNoXCI6XCJcXHUyMDEwXCIsXCJEYXNodlwiOlwiXFx1MkFFNFwiLFwiZGFzaHZcIjpcIlxcdTIyQTNcIixcImRia2Fyb3dcIjpcIlxcdTI5MEZcIixcImRibGFjXCI6XCJcXHUwMkREXCIsXCJEY2Fyb25cIjpcIlxcdTAxMEVcIixcImRjYXJvblwiOlwiXFx1MDEwRlwiLFwiRGN5XCI6XCJcXHUwNDE0XCIsXCJkY3lcIjpcIlxcdTA0MzRcIixcImRkYWdnZXJcIjpcIlxcdTIwMjFcIixcImRkYXJyXCI6XCJcXHUyMUNBXCIsXCJERFwiOlwiXFx1MjE0NVwiLFwiZGRcIjpcIlxcdTIxNDZcIixcIkREb3RyYWhkXCI6XCJcXHUyOTExXCIsXCJkZG90c2VxXCI6XCJcXHUyQTc3XCIsXCJkZWdcIjpcIlxcdTAwQjBcIixcIkRlbFwiOlwiXFx1MjIwN1wiLFwiRGVsdGFcIjpcIlxcdTAzOTRcIixcImRlbHRhXCI6XCJcXHUwM0I0XCIsXCJkZW1wdHl2XCI6XCJcXHUyOUIxXCIsXCJkZmlzaHRcIjpcIlxcdTI5N0ZcIixcIkRmclwiOlwiXFx1RDgzNVxcdUREMDdcIixcImRmclwiOlwiXFx1RDgzNVxcdUREMjFcIixcImRIYXJcIjpcIlxcdTI5NjVcIixcImRoYXJsXCI6XCJcXHUyMUMzXCIsXCJkaGFyclwiOlwiXFx1MjFDMlwiLFwiRGlhY3JpdGljYWxBY3V0ZVwiOlwiXFx1MDBCNFwiLFwiRGlhY3JpdGljYWxEb3RcIjpcIlxcdTAyRDlcIixcIkRpYWNyaXRpY2FsRG91YmxlQWN1dGVcIjpcIlxcdTAyRERcIixcIkRpYWNyaXRpY2FsR3JhdmVcIjpcImBcIixcIkRpYWNyaXRpY2FsVGlsZGVcIjpcIlxcdTAyRENcIixcImRpYW1cIjpcIlxcdTIyQzRcIixcImRpYW1vbmRcIjpcIlxcdTIyQzRcIixcIkRpYW1vbmRcIjpcIlxcdTIyQzRcIixcImRpYW1vbmRzdWl0XCI6XCJcXHUyNjY2XCIsXCJkaWFtc1wiOlwiXFx1MjY2NlwiLFwiZGllXCI6XCJcXHUwMEE4XCIsXCJEaWZmZXJlbnRpYWxEXCI6XCJcXHUyMTQ2XCIsXCJkaWdhbW1hXCI6XCJcXHUwM0REXCIsXCJkaXNpblwiOlwiXFx1MjJGMlwiLFwiZGl2XCI6XCJcXHUwMEY3XCIsXCJkaXZpZGVcIjpcIlxcdTAwRjdcIixcImRpdmlkZW9udGltZXNcIjpcIlxcdTIyQzdcIixcImRpdm9ueFwiOlwiXFx1MjJDN1wiLFwiREpjeVwiOlwiXFx1MDQwMlwiLFwiZGpjeVwiOlwiXFx1MDQ1MlwiLFwiZGxjb3JuXCI6XCJcXHUyMzFFXCIsXCJkbGNyb3BcIjpcIlxcdTIzMERcIixcImRvbGxhclwiOlwiJFwiLFwiRG9wZlwiOlwiXFx1RDgzNVxcdUREM0JcIixcImRvcGZcIjpcIlxcdUQ4MzVcXHVERDU1XCIsXCJEb3RcIjpcIlxcdTAwQThcIixcImRvdFwiOlwiXFx1MDJEOVwiLFwiRG90RG90XCI6XCJcXHUyMERDXCIsXCJkb3RlcVwiOlwiXFx1MjI1MFwiLFwiZG90ZXFkb3RcIjpcIlxcdTIyNTFcIixcIkRvdEVxdWFsXCI6XCJcXHUyMjUwXCIsXCJkb3RtaW51c1wiOlwiXFx1MjIzOFwiLFwiZG90cGx1c1wiOlwiXFx1MjIxNFwiLFwiZG90c3F1YXJlXCI6XCJcXHUyMkExXCIsXCJkb3VibGViYXJ3ZWRnZVwiOlwiXFx1MjMwNlwiLFwiRG91YmxlQ29udG91ckludGVncmFsXCI6XCJcXHUyMjJGXCIsXCJEb3VibGVEb3RcIjpcIlxcdTAwQThcIixcIkRvdWJsZURvd25BcnJvd1wiOlwiXFx1MjFEM1wiLFwiRG91YmxlTGVmdEFycm93XCI6XCJcXHUyMUQwXCIsXCJEb3VibGVMZWZ0UmlnaHRBcnJvd1wiOlwiXFx1MjFENFwiLFwiRG91YmxlTGVmdFRlZVwiOlwiXFx1MkFFNFwiLFwiRG91YmxlTG9uZ0xlZnRBcnJvd1wiOlwiXFx1MjdGOFwiLFwiRG91YmxlTG9uZ0xlZnRSaWdodEFycm93XCI6XCJcXHUyN0ZBXCIsXCJEb3VibGVMb25nUmlnaHRBcnJvd1wiOlwiXFx1MjdGOVwiLFwiRG91YmxlUmlnaHRBcnJvd1wiOlwiXFx1MjFEMlwiLFwiRG91YmxlUmlnaHRUZWVcIjpcIlxcdTIyQThcIixcIkRvdWJsZVVwQXJyb3dcIjpcIlxcdTIxRDFcIixcIkRvdWJsZVVwRG93bkFycm93XCI6XCJcXHUyMUQ1XCIsXCJEb3VibGVWZXJ0aWNhbEJhclwiOlwiXFx1MjIyNVwiLFwiRG93bkFycm93QmFyXCI6XCJcXHUyOTEzXCIsXCJkb3duYXJyb3dcIjpcIlxcdTIxOTNcIixcIkRvd25BcnJvd1wiOlwiXFx1MjE5M1wiLFwiRG93bmFycm93XCI6XCJcXHUyMUQzXCIsXCJEb3duQXJyb3dVcEFycm93XCI6XCJcXHUyMUY1XCIsXCJEb3duQnJldmVcIjpcIlxcdTAzMTFcIixcImRvd25kb3duYXJyb3dzXCI6XCJcXHUyMUNBXCIsXCJkb3duaGFycG9vbmxlZnRcIjpcIlxcdTIxQzNcIixcImRvd25oYXJwb29ucmlnaHRcIjpcIlxcdTIxQzJcIixcIkRvd25MZWZ0UmlnaHRWZWN0b3JcIjpcIlxcdTI5NTBcIixcIkRvd25MZWZ0VGVlVmVjdG9yXCI6XCJcXHUyOTVFXCIsXCJEb3duTGVmdFZlY3RvckJhclwiOlwiXFx1Mjk1NlwiLFwiRG93bkxlZnRWZWN0b3JcIjpcIlxcdTIxQkRcIixcIkRvd25SaWdodFRlZVZlY3RvclwiOlwiXFx1Mjk1RlwiLFwiRG93blJpZ2h0VmVjdG9yQmFyXCI6XCJcXHUyOTU3XCIsXCJEb3duUmlnaHRWZWN0b3JcIjpcIlxcdTIxQzFcIixcIkRvd25UZWVBcnJvd1wiOlwiXFx1MjFBN1wiLFwiRG93blRlZVwiOlwiXFx1MjJBNFwiLFwiZHJia2Fyb3dcIjpcIlxcdTI5MTBcIixcImRyY29yblwiOlwiXFx1MjMxRlwiLFwiZHJjcm9wXCI6XCJcXHUyMzBDXCIsXCJEc2NyXCI6XCJcXHVEODM1XFx1REM5RlwiLFwiZHNjclwiOlwiXFx1RDgzNVxcdURDQjlcIixcIkRTY3lcIjpcIlxcdTA0MDVcIixcImRzY3lcIjpcIlxcdTA0NTVcIixcImRzb2xcIjpcIlxcdTI5RjZcIixcIkRzdHJva1wiOlwiXFx1MDExMFwiLFwiZHN0cm9rXCI6XCJcXHUwMTExXCIsXCJkdGRvdFwiOlwiXFx1MjJGMVwiLFwiZHRyaVwiOlwiXFx1MjVCRlwiLFwiZHRyaWZcIjpcIlxcdTI1QkVcIixcImR1YXJyXCI6XCJcXHUyMUY1XCIsXCJkdWhhclwiOlwiXFx1Mjk2RlwiLFwiZHdhbmdsZVwiOlwiXFx1MjlBNlwiLFwiRFpjeVwiOlwiXFx1MDQwRlwiLFwiZHpjeVwiOlwiXFx1MDQ1RlwiLFwiZHppZ3JhcnJcIjpcIlxcdTI3RkZcIixcIkVhY3V0ZVwiOlwiXFx1MDBDOVwiLFwiZWFjdXRlXCI6XCJcXHUwMEU5XCIsXCJlYXN0ZXJcIjpcIlxcdTJBNkVcIixcIkVjYXJvblwiOlwiXFx1MDExQVwiLFwiZWNhcm9uXCI6XCJcXHUwMTFCXCIsXCJFY2lyY1wiOlwiXFx1MDBDQVwiLFwiZWNpcmNcIjpcIlxcdTAwRUFcIixcImVjaXJcIjpcIlxcdTIyNTZcIixcImVjb2xvblwiOlwiXFx1MjI1NVwiLFwiRWN5XCI6XCJcXHUwNDJEXCIsXCJlY3lcIjpcIlxcdTA0NERcIixcImVERG90XCI6XCJcXHUyQTc3XCIsXCJFZG90XCI6XCJcXHUwMTE2XCIsXCJlZG90XCI6XCJcXHUwMTE3XCIsXCJlRG90XCI6XCJcXHUyMjUxXCIsXCJlZVwiOlwiXFx1MjE0N1wiLFwiZWZEb3RcIjpcIlxcdTIyNTJcIixcIkVmclwiOlwiXFx1RDgzNVxcdUREMDhcIixcImVmclwiOlwiXFx1RDgzNVxcdUREMjJcIixcImVnXCI6XCJcXHUyQTlBXCIsXCJFZ3JhdmVcIjpcIlxcdTAwQzhcIixcImVncmF2ZVwiOlwiXFx1MDBFOFwiLFwiZWdzXCI6XCJcXHUyQTk2XCIsXCJlZ3Nkb3RcIjpcIlxcdTJBOThcIixcImVsXCI6XCJcXHUyQTk5XCIsXCJFbGVtZW50XCI6XCJcXHUyMjA4XCIsXCJlbGludGVyc1wiOlwiXFx1MjNFN1wiLFwiZWxsXCI6XCJcXHUyMTEzXCIsXCJlbHNcIjpcIlxcdTJBOTVcIixcImVsc2RvdFwiOlwiXFx1MkE5N1wiLFwiRW1hY3JcIjpcIlxcdTAxMTJcIixcImVtYWNyXCI6XCJcXHUwMTEzXCIsXCJlbXB0eVwiOlwiXFx1MjIwNVwiLFwiZW1wdHlzZXRcIjpcIlxcdTIyMDVcIixcIkVtcHR5U21hbGxTcXVhcmVcIjpcIlxcdTI1RkJcIixcImVtcHR5dlwiOlwiXFx1MjIwNVwiLFwiRW1wdHlWZXJ5U21hbGxTcXVhcmVcIjpcIlxcdTI1QUJcIixcImVtc3AxM1wiOlwiXFx1MjAwNFwiLFwiZW1zcDE0XCI6XCJcXHUyMDA1XCIsXCJlbXNwXCI6XCJcXHUyMDAzXCIsXCJFTkdcIjpcIlxcdTAxNEFcIixcImVuZ1wiOlwiXFx1MDE0QlwiLFwiZW5zcFwiOlwiXFx1MjAwMlwiLFwiRW9nb25cIjpcIlxcdTAxMThcIixcImVvZ29uXCI6XCJcXHUwMTE5XCIsXCJFb3BmXCI6XCJcXHVEODM1XFx1REQzQ1wiLFwiZW9wZlwiOlwiXFx1RDgzNVxcdURENTZcIixcImVwYXJcIjpcIlxcdTIyRDVcIixcImVwYXJzbFwiOlwiXFx1MjlFM1wiLFwiZXBsdXNcIjpcIlxcdTJBNzFcIixcImVwc2lcIjpcIlxcdTAzQjVcIixcIkVwc2lsb25cIjpcIlxcdTAzOTVcIixcImVwc2lsb25cIjpcIlxcdTAzQjVcIixcImVwc2l2XCI6XCJcXHUwM0Y1XCIsXCJlcWNpcmNcIjpcIlxcdTIyNTZcIixcImVxY29sb25cIjpcIlxcdTIyNTVcIixcImVxc2ltXCI6XCJcXHUyMjQyXCIsXCJlcXNsYW50Z3RyXCI6XCJcXHUyQTk2XCIsXCJlcXNsYW50bGVzc1wiOlwiXFx1MkE5NVwiLFwiRXF1YWxcIjpcIlxcdTJBNzVcIixcImVxdWFsc1wiOlwiPVwiLFwiRXF1YWxUaWxkZVwiOlwiXFx1MjI0MlwiLFwiZXF1ZXN0XCI6XCJcXHUyMjVGXCIsXCJFcXVpbGlicml1bVwiOlwiXFx1MjFDQ1wiLFwiZXF1aXZcIjpcIlxcdTIyNjFcIixcImVxdWl2RERcIjpcIlxcdTJBNzhcIixcImVxdnBhcnNsXCI6XCJcXHUyOUU1XCIsXCJlcmFyclwiOlwiXFx1Mjk3MVwiLFwiZXJEb3RcIjpcIlxcdTIyNTNcIixcImVzY3JcIjpcIlxcdTIxMkZcIixcIkVzY3JcIjpcIlxcdTIxMzBcIixcImVzZG90XCI6XCJcXHUyMjUwXCIsXCJFc2ltXCI6XCJcXHUyQTczXCIsXCJlc2ltXCI6XCJcXHUyMjQyXCIsXCJFdGFcIjpcIlxcdTAzOTdcIixcImV0YVwiOlwiXFx1MDNCN1wiLFwiRVRIXCI6XCJcXHUwMEQwXCIsXCJldGhcIjpcIlxcdTAwRjBcIixcIkV1bWxcIjpcIlxcdTAwQ0JcIixcImV1bWxcIjpcIlxcdTAwRUJcIixcImV1cm9cIjpcIlxcdTIwQUNcIixcImV4Y2xcIjpcIiFcIixcImV4aXN0XCI6XCJcXHUyMjAzXCIsXCJFeGlzdHNcIjpcIlxcdTIyMDNcIixcImV4cGVjdGF0aW9uXCI6XCJcXHUyMTMwXCIsXCJleHBvbmVudGlhbGVcIjpcIlxcdTIxNDdcIixcIkV4cG9uZW50aWFsRVwiOlwiXFx1MjE0N1wiLFwiZmFsbGluZ2RvdHNlcVwiOlwiXFx1MjI1MlwiLFwiRmN5XCI6XCJcXHUwNDI0XCIsXCJmY3lcIjpcIlxcdTA0NDRcIixcImZlbWFsZVwiOlwiXFx1MjY0MFwiLFwiZmZpbGlnXCI6XCJcXHVGQjAzXCIsXCJmZmxpZ1wiOlwiXFx1RkIwMFwiLFwiZmZsbGlnXCI6XCJcXHVGQjA0XCIsXCJGZnJcIjpcIlxcdUQ4MzVcXHVERDA5XCIsXCJmZnJcIjpcIlxcdUQ4MzVcXHVERDIzXCIsXCJmaWxpZ1wiOlwiXFx1RkIwMVwiLFwiRmlsbGVkU21hbGxTcXVhcmVcIjpcIlxcdTI1RkNcIixcIkZpbGxlZFZlcnlTbWFsbFNxdWFyZVwiOlwiXFx1MjVBQVwiLFwiZmpsaWdcIjpcImZqXCIsXCJmbGF0XCI6XCJcXHUyNjZEXCIsXCJmbGxpZ1wiOlwiXFx1RkIwMlwiLFwiZmx0bnNcIjpcIlxcdTI1QjFcIixcImZub2ZcIjpcIlxcdTAxOTJcIixcIkZvcGZcIjpcIlxcdUQ4MzVcXHVERDNEXCIsXCJmb3BmXCI6XCJcXHVEODM1XFx1REQ1N1wiLFwiZm9yYWxsXCI6XCJcXHUyMjAwXCIsXCJGb3JBbGxcIjpcIlxcdTIyMDBcIixcImZvcmtcIjpcIlxcdTIyRDRcIixcImZvcmt2XCI6XCJcXHUyQUQ5XCIsXCJGb3VyaWVydHJmXCI6XCJcXHUyMTMxXCIsXCJmcGFydGludFwiOlwiXFx1MkEwRFwiLFwiZnJhYzEyXCI6XCJcXHUwMEJEXCIsXCJmcmFjMTNcIjpcIlxcdTIxNTNcIixcImZyYWMxNFwiOlwiXFx1MDBCQ1wiLFwiZnJhYzE1XCI6XCJcXHUyMTU1XCIsXCJmcmFjMTZcIjpcIlxcdTIxNTlcIixcImZyYWMxOFwiOlwiXFx1MjE1QlwiLFwiZnJhYzIzXCI6XCJcXHUyMTU0XCIsXCJmcmFjMjVcIjpcIlxcdTIxNTZcIixcImZyYWMzNFwiOlwiXFx1MDBCRVwiLFwiZnJhYzM1XCI6XCJcXHUyMTU3XCIsXCJmcmFjMzhcIjpcIlxcdTIxNUNcIixcImZyYWM0NVwiOlwiXFx1MjE1OFwiLFwiZnJhYzU2XCI6XCJcXHUyMTVBXCIsXCJmcmFjNThcIjpcIlxcdTIxNURcIixcImZyYWM3OFwiOlwiXFx1MjE1RVwiLFwiZnJhc2xcIjpcIlxcdTIwNDRcIixcImZyb3duXCI6XCJcXHUyMzIyXCIsXCJmc2NyXCI6XCJcXHVEODM1XFx1RENCQlwiLFwiRnNjclwiOlwiXFx1MjEzMVwiLFwiZ2FjdXRlXCI6XCJcXHUwMUY1XCIsXCJHYW1tYVwiOlwiXFx1MDM5M1wiLFwiZ2FtbWFcIjpcIlxcdTAzQjNcIixcIkdhbW1hZFwiOlwiXFx1MDNEQ1wiLFwiZ2FtbWFkXCI6XCJcXHUwM0REXCIsXCJnYXBcIjpcIlxcdTJBODZcIixcIkdicmV2ZVwiOlwiXFx1MDExRVwiLFwiZ2JyZXZlXCI6XCJcXHUwMTFGXCIsXCJHY2VkaWxcIjpcIlxcdTAxMjJcIixcIkdjaXJjXCI6XCJcXHUwMTFDXCIsXCJnY2lyY1wiOlwiXFx1MDExRFwiLFwiR2N5XCI6XCJcXHUwNDEzXCIsXCJnY3lcIjpcIlxcdTA0MzNcIixcIkdkb3RcIjpcIlxcdTAxMjBcIixcImdkb3RcIjpcIlxcdTAxMjFcIixcImdlXCI6XCJcXHUyMjY1XCIsXCJnRVwiOlwiXFx1MjI2N1wiLFwiZ0VsXCI6XCJcXHUyQThDXCIsXCJnZWxcIjpcIlxcdTIyREJcIixcImdlcVwiOlwiXFx1MjI2NVwiLFwiZ2VxcVwiOlwiXFx1MjI2N1wiLFwiZ2Vxc2xhbnRcIjpcIlxcdTJBN0VcIixcImdlc2NjXCI6XCJcXHUyQUE5XCIsXCJnZXNcIjpcIlxcdTJBN0VcIixcImdlc2RvdFwiOlwiXFx1MkE4MFwiLFwiZ2VzZG90b1wiOlwiXFx1MkE4MlwiLFwiZ2VzZG90b2xcIjpcIlxcdTJBODRcIixcImdlc2xcIjpcIlxcdTIyREJcXHVGRTAwXCIsXCJnZXNsZXNcIjpcIlxcdTJBOTRcIixcIkdmclwiOlwiXFx1RDgzNVxcdUREMEFcIixcImdmclwiOlwiXFx1RDgzNVxcdUREMjRcIixcImdnXCI6XCJcXHUyMjZCXCIsXCJHZ1wiOlwiXFx1MjJEOVwiLFwiZ2dnXCI6XCJcXHUyMkQ5XCIsXCJnaW1lbFwiOlwiXFx1MjEzN1wiLFwiR0pjeVwiOlwiXFx1MDQwM1wiLFwiZ2pjeVwiOlwiXFx1MDQ1M1wiLFwiZ2xhXCI6XCJcXHUyQUE1XCIsXCJnbFwiOlwiXFx1MjI3N1wiLFwiZ2xFXCI6XCJcXHUyQTkyXCIsXCJnbGpcIjpcIlxcdTJBQTRcIixcImduYXBcIjpcIlxcdTJBOEFcIixcImduYXBwcm94XCI6XCJcXHUyQThBXCIsXCJnbmVcIjpcIlxcdTJBODhcIixcImduRVwiOlwiXFx1MjI2OVwiLFwiZ25lcVwiOlwiXFx1MkE4OFwiLFwiZ25lcXFcIjpcIlxcdTIyNjlcIixcImduc2ltXCI6XCJcXHUyMkU3XCIsXCJHb3BmXCI6XCJcXHVEODM1XFx1REQzRVwiLFwiZ29wZlwiOlwiXFx1RDgzNVxcdURENThcIixcImdyYXZlXCI6XCJgXCIsXCJHcmVhdGVyRXF1YWxcIjpcIlxcdTIyNjVcIixcIkdyZWF0ZXJFcXVhbExlc3NcIjpcIlxcdTIyREJcIixcIkdyZWF0ZXJGdWxsRXF1YWxcIjpcIlxcdTIyNjdcIixcIkdyZWF0ZXJHcmVhdGVyXCI6XCJcXHUyQUEyXCIsXCJHcmVhdGVyTGVzc1wiOlwiXFx1MjI3N1wiLFwiR3JlYXRlclNsYW50RXF1YWxcIjpcIlxcdTJBN0VcIixcIkdyZWF0ZXJUaWxkZVwiOlwiXFx1MjI3M1wiLFwiR3NjclwiOlwiXFx1RDgzNVxcdURDQTJcIixcImdzY3JcIjpcIlxcdTIxMEFcIixcImdzaW1cIjpcIlxcdTIyNzNcIixcImdzaW1lXCI6XCJcXHUyQThFXCIsXCJnc2ltbFwiOlwiXFx1MkE5MFwiLFwiZ3RjY1wiOlwiXFx1MkFBN1wiLFwiZ3RjaXJcIjpcIlxcdTJBN0FcIixcImd0XCI6XCI+XCIsXCJHVFwiOlwiPlwiLFwiR3RcIjpcIlxcdTIyNkJcIixcImd0ZG90XCI6XCJcXHUyMkQ3XCIsXCJndGxQYXJcIjpcIlxcdTI5OTVcIixcImd0cXVlc3RcIjpcIlxcdTJBN0NcIixcImd0cmFwcHJveFwiOlwiXFx1MkE4NlwiLFwiZ3RyYXJyXCI6XCJcXHUyOTc4XCIsXCJndHJkb3RcIjpcIlxcdTIyRDdcIixcImd0cmVxbGVzc1wiOlwiXFx1MjJEQlwiLFwiZ3RyZXFxbGVzc1wiOlwiXFx1MkE4Q1wiLFwiZ3RybGVzc1wiOlwiXFx1MjI3N1wiLFwiZ3Ryc2ltXCI6XCJcXHUyMjczXCIsXCJndmVydG5lcXFcIjpcIlxcdTIyNjlcXHVGRTAwXCIsXCJndm5FXCI6XCJcXHUyMjY5XFx1RkUwMFwiLFwiSGFjZWtcIjpcIlxcdTAyQzdcIixcImhhaXJzcFwiOlwiXFx1MjAwQVwiLFwiaGFsZlwiOlwiXFx1MDBCRFwiLFwiaGFtaWx0XCI6XCJcXHUyMTBCXCIsXCJIQVJEY3lcIjpcIlxcdTA0MkFcIixcImhhcmRjeVwiOlwiXFx1MDQ0QVwiLFwiaGFycmNpclwiOlwiXFx1Mjk0OFwiLFwiaGFyclwiOlwiXFx1MjE5NFwiLFwiaEFyclwiOlwiXFx1MjFENFwiLFwiaGFycndcIjpcIlxcdTIxQURcIixcIkhhdFwiOlwiXlwiLFwiaGJhclwiOlwiXFx1MjEwRlwiLFwiSGNpcmNcIjpcIlxcdTAxMjRcIixcImhjaXJjXCI6XCJcXHUwMTI1XCIsXCJoZWFydHNcIjpcIlxcdTI2NjVcIixcImhlYXJ0c3VpdFwiOlwiXFx1MjY2NVwiLFwiaGVsbGlwXCI6XCJcXHUyMDI2XCIsXCJoZXJjb25cIjpcIlxcdTIyQjlcIixcImhmclwiOlwiXFx1RDgzNVxcdUREMjVcIixcIkhmclwiOlwiXFx1MjEwQ1wiLFwiSGlsYmVydFNwYWNlXCI6XCJcXHUyMTBCXCIsXCJoa3NlYXJvd1wiOlwiXFx1MjkyNVwiLFwiaGtzd2Fyb3dcIjpcIlxcdTI5MjZcIixcImhvYXJyXCI6XCJcXHUyMUZGXCIsXCJob210aHRcIjpcIlxcdTIyM0JcIixcImhvb2tsZWZ0YXJyb3dcIjpcIlxcdTIxQTlcIixcImhvb2tyaWdodGFycm93XCI6XCJcXHUyMUFBXCIsXCJob3BmXCI6XCJcXHVEODM1XFx1REQ1OVwiLFwiSG9wZlwiOlwiXFx1MjEwRFwiLFwiaG9yYmFyXCI6XCJcXHUyMDE1XCIsXCJIb3Jpem9udGFsTGluZVwiOlwiXFx1MjUwMFwiLFwiaHNjclwiOlwiXFx1RDgzNVxcdURDQkRcIixcIkhzY3JcIjpcIlxcdTIxMEJcIixcImhzbGFzaFwiOlwiXFx1MjEwRlwiLFwiSHN0cm9rXCI6XCJcXHUwMTI2XCIsXCJoc3Ryb2tcIjpcIlxcdTAxMjdcIixcIkh1bXBEb3duSHVtcFwiOlwiXFx1MjI0RVwiLFwiSHVtcEVxdWFsXCI6XCJcXHUyMjRGXCIsXCJoeWJ1bGxcIjpcIlxcdTIwNDNcIixcImh5cGhlblwiOlwiXFx1MjAxMFwiLFwiSWFjdXRlXCI6XCJcXHUwMENEXCIsXCJpYWN1dGVcIjpcIlxcdTAwRURcIixcImljXCI6XCJcXHUyMDYzXCIsXCJJY2lyY1wiOlwiXFx1MDBDRVwiLFwiaWNpcmNcIjpcIlxcdTAwRUVcIixcIkljeVwiOlwiXFx1MDQxOFwiLFwiaWN5XCI6XCJcXHUwNDM4XCIsXCJJZG90XCI6XCJcXHUwMTMwXCIsXCJJRWN5XCI6XCJcXHUwNDE1XCIsXCJpZWN5XCI6XCJcXHUwNDM1XCIsXCJpZXhjbFwiOlwiXFx1MDBBMVwiLFwiaWZmXCI6XCJcXHUyMUQ0XCIsXCJpZnJcIjpcIlxcdUQ4MzVcXHVERDI2XCIsXCJJZnJcIjpcIlxcdTIxMTFcIixcIklncmF2ZVwiOlwiXFx1MDBDQ1wiLFwiaWdyYXZlXCI6XCJcXHUwMEVDXCIsXCJpaVwiOlwiXFx1MjE0OFwiLFwiaWlpaW50XCI6XCJcXHUyQTBDXCIsXCJpaWludFwiOlwiXFx1MjIyRFwiLFwiaWluZmluXCI6XCJcXHUyOURDXCIsXCJpaW90YVwiOlwiXFx1MjEyOVwiLFwiSUpsaWdcIjpcIlxcdTAxMzJcIixcImlqbGlnXCI6XCJcXHUwMTMzXCIsXCJJbWFjclwiOlwiXFx1MDEyQVwiLFwiaW1hY3JcIjpcIlxcdTAxMkJcIixcImltYWdlXCI6XCJcXHUyMTExXCIsXCJJbWFnaW5hcnlJXCI6XCJcXHUyMTQ4XCIsXCJpbWFnbGluZVwiOlwiXFx1MjExMFwiLFwiaW1hZ3BhcnRcIjpcIlxcdTIxMTFcIixcImltYXRoXCI6XCJcXHUwMTMxXCIsXCJJbVwiOlwiXFx1MjExMVwiLFwiaW1vZlwiOlwiXFx1MjJCN1wiLFwiaW1wZWRcIjpcIlxcdTAxQjVcIixcIkltcGxpZXNcIjpcIlxcdTIxRDJcIixcImluY2FyZVwiOlwiXFx1MjEwNVwiLFwiaW5cIjpcIlxcdTIyMDhcIixcImluZmluXCI6XCJcXHUyMjFFXCIsXCJpbmZpbnRpZVwiOlwiXFx1MjlERFwiLFwiaW5vZG90XCI6XCJcXHUwMTMxXCIsXCJpbnRjYWxcIjpcIlxcdTIyQkFcIixcImludFwiOlwiXFx1MjIyQlwiLFwiSW50XCI6XCJcXHUyMjJDXCIsXCJpbnRlZ2Vyc1wiOlwiXFx1MjEyNFwiLFwiSW50ZWdyYWxcIjpcIlxcdTIyMkJcIixcImludGVyY2FsXCI6XCJcXHUyMkJBXCIsXCJJbnRlcnNlY3Rpb25cIjpcIlxcdTIyQzJcIixcImludGxhcmhrXCI6XCJcXHUyQTE3XCIsXCJpbnRwcm9kXCI6XCJcXHUyQTNDXCIsXCJJbnZpc2libGVDb21tYVwiOlwiXFx1MjA2M1wiLFwiSW52aXNpYmxlVGltZXNcIjpcIlxcdTIwNjJcIixcIklPY3lcIjpcIlxcdTA0MDFcIixcImlvY3lcIjpcIlxcdTA0NTFcIixcIklvZ29uXCI6XCJcXHUwMTJFXCIsXCJpb2dvblwiOlwiXFx1MDEyRlwiLFwiSW9wZlwiOlwiXFx1RDgzNVxcdURENDBcIixcImlvcGZcIjpcIlxcdUQ4MzVcXHVERDVBXCIsXCJJb3RhXCI6XCJcXHUwMzk5XCIsXCJpb3RhXCI6XCJcXHUwM0I5XCIsXCJpcHJvZFwiOlwiXFx1MkEzQ1wiLFwiaXF1ZXN0XCI6XCJcXHUwMEJGXCIsXCJpc2NyXCI6XCJcXHVEODM1XFx1RENCRVwiLFwiSXNjclwiOlwiXFx1MjExMFwiLFwiaXNpblwiOlwiXFx1MjIwOFwiLFwiaXNpbmRvdFwiOlwiXFx1MjJGNVwiLFwiaXNpbkVcIjpcIlxcdTIyRjlcIixcImlzaW5zXCI6XCJcXHUyMkY0XCIsXCJpc2luc3ZcIjpcIlxcdTIyRjNcIixcImlzaW52XCI6XCJcXHUyMjA4XCIsXCJpdFwiOlwiXFx1MjA2MlwiLFwiSXRpbGRlXCI6XCJcXHUwMTI4XCIsXCJpdGlsZGVcIjpcIlxcdTAxMjlcIixcIkl1a2N5XCI6XCJcXHUwNDA2XCIsXCJpdWtjeVwiOlwiXFx1MDQ1NlwiLFwiSXVtbFwiOlwiXFx1MDBDRlwiLFwiaXVtbFwiOlwiXFx1MDBFRlwiLFwiSmNpcmNcIjpcIlxcdTAxMzRcIixcImpjaXJjXCI6XCJcXHUwMTM1XCIsXCJKY3lcIjpcIlxcdTA0MTlcIixcImpjeVwiOlwiXFx1MDQzOVwiLFwiSmZyXCI6XCJcXHVEODM1XFx1REQwRFwiLFwiamZyXCI6XCJcXHVEODM1XFx1REQyN1wiLFwiam1hdGhcIjpcIlxcdTAyMzdcIixcIkpvcGZcIjpcIlxcdUQ4MzVcXHVERDQxXCIsXCJqb3BmXCI6XCJcXHVEODM1XFx1REQ1QlwiLFwiSnNjclwiOlwiXFx1RDgzNVxcdURDQTVcIixcImpzY3JcIjpcIlxcdUQ4MzVcXHVEQ0JGXCIsXCJKc2VyY3lcIjpcIlxcdTA0MDhcIixcImpzZXJjeVwiOlwiXFx1MDQ1OFwiLFwiSnVrY3lcIjpcIlxcdTA0MDRcIixcImp1a2N5XCI6XCJcXHUwNDU0XCIsXCJLYXBwYVwiOlwiXFx1MDM5QVwiLFwia2FwcGFcIjpcIlxcdTAzQkFcIixcImthcHBhdlwiOlwiXFx1MDNGMFwiLFwiS2NlZGlsXCI6XCJcXHUwMTM2XCIsXCJrY2VkaWxcIjpcIlxcdTAxMzdcIixcIktjeVwiOlwiXFx1MDQxQVwiLFwia2N5XCI6XCJcXHUwNDNBXCIsXCJLZnJcIjpcIlxcdUQ4MzVcXHVERDBFXCIsXCJrZnJcIjpcIlxcdUQ4MzVcXHVERDI4XCIsXCJrZ3JlZW5cIjpcIlxcdTAxMzhcIixcIktIY3lcIjpcIlxcdTA0MjVcIixcImtoY3lcIjpcIlxcdTA0NDVcIixcIktKY3lcIjpcIlxcdTA0MENcIixcImtqY3lcIjpcIlxcdTA0NUNcIixcIktvcGZcIjpcIlxcdUQ4MzVcXHVERDQyXCIsXCJrb3BmXCI6XCJcXHVEODM1XFx1REQ1Q1wiLFwiS3NjclwiOlwiXFx1RDgzNVxcdURDQTZcIixcImtzY3JcIjpcIlxcdUQ4MzVcXHVEQ0MwXCIsXCJsQWFyclwiOlwiXFx1MjFEQVwiLFwiTGFjdXRlXCI6XCJcXHUwMTM5XCIsXCJsYWN1dGVcIjpcIlxcdTAxM0FcIixcImxhZW1wdHl2XCI6XCJcXHUyOUI0XCIsXCJsYWdyYW5cIjpcIlxcdTIxMTJcIixcIkxhbWJkYVwiOlwiXFx1MDM5QlwiLFwibGFtYmRhXCI6XCJcXHUwM0JCXCIsXCJsYW5nXCI6XCJcXHUyN0U4XCIsXCJMYW5nXCI6XCJcXHUyN0VBXCIsXCJsYW5nZFwiOlwiXFx1Mjk5MVwiLFwibGFuZ2xlXCI6XCJcXHUyN0U4XCIsXCJsYXBcIjpcIlxcdTJBODVcIixcIkxhcGxhY2V0cmZcIjpcIlxcdTIxMTJcIixcImxhcXVvXCI6XCJcXHUwMEFCXCIsXCJsYXJyYlwiOlwiXFx1MjFFNFwiLFwibGFycmJmc1wiOlwiXFx1MjkxRlwiLFwibGFyclwiOlwiXFx1MjE5MFwiLFwiTGFyclwiOlwiXFx1MjE5RVwiLFwibEFyclwiOlwiXFx1MjFEMFwiLFwibGFycmZzXCI6XCJcXHUyOTFEXCIsXCJsYXJyaGtcIjpcIlxcdTIxQTlcIixcImxhcnJscFwiOlwiXFx1MjFBQlwiLFwibGFycnBsXCI6XCJcXHUyOTM5XCIsXCJsYXJyc2ltXCI6XCJcXHUyOTczXCIsXCJsYXJydGxcIjpcIlxcdTIxQTJcIixcImxhdGFpbFwiOlwiXFx1MjkxOVwiLFwibEF0YWlsXCI6XCJcXHUyOTFCXCIsXCJsYXRcIjpcIlxcdTJBQUJcIixcImxhdGVcIjpcIlxcdTJBQURcIixcImxhdGVzXCI6XCJcXHUyQUFEXFx1RkUwMFwiLFwibGJhcnJcIjpcIlxcdTI5MENcIixcImxCYXJyXCI6XCJcXHUyOTBFXCIsXCJsYmJya1wiOlwiXFx1Mjc3MlwiLFwibGJyYWNlXCI6XCJ7XCIsXCJsYnJhY2tcIjpcIltcIixcImxicmtlXCI6XCJcXHUyOThCXCIsXCJsYnJrc2xkXCI6XCJcXHUyOThGXCIsXCJsYnJrc2x1XCI6XCJcXHUyOThEXCIsXCJMY2Fyb25cIjpcIlxcdTAxM0RcIixcImxjYXJvblwiOlwiXFx1MDEzRVwiLFwiTGNlZGlsXCI6XCJcXHUwMTNCXCIsXCJsY2VkaWxcIjpcIlxcdTAxM0NcIixcImxjZWlsXCI6XCJcXHUyMzA4XCIsXCJsY3ViXCI6XCJ7XCIsXCJMY3lcIjpcIlxcdTA0MUJcIixcImxjeVwiOlwiXFx1MDQzQlwiLFwibGRjYVwiOlwiXFx1MjkzNlwiLFwibGRxdW9cIjpcIlxcdTIwMUNcIixcImxkcXVvclwiOlwiXFx1MjAxRVwiLFwibGRyZGhhclwiOlwiXFx1Mjk2N1wiLFwibGRydXNoYXJcIjpcIlxcdTI5NEJcIixcImxkc2hcIjpcIlxcdTIxQjJcIixcImxlXCI6XCJcXHUyMjY0XCIsXCJsRVwiOlwiXFx1MjI2NlwiLFwiTGVmdEFuZ2xlQnJhY2tldFwiOlwiXFx1MjdFOFwiLFwiTGVmdEFycm93QmFyXCI6XCJcXHUyMUU0XCIsXCJsZWZ0YXJyb3dcIjpcIlxcdTIxOTBcIixcIkxlZnRBcnJvd1wiOlwiXFx1MjE5MFwiLFwiTGVmdGFycm93XCI6XCJcXHUyMUQwXCIsXCJMZWZ0QXJyb3dSaWdodEFycm93XCI6XCJcXHUyMUM2XCIsXCJsZWZ0YXJyb3d0YWlsXCI6XCJcXHUyMUEyXCIsXCJMZWZ0Q2VpbGluZ1wiOlwiXFx1MjMwOFwiLFwiTGVmdERvdWJsZUJyYWNrZXRcIjpcIlxcdTI3RTZcIixcIkxlZnREb3duVGVlVmVjdG9yXCI6XCJcXHUyOTYxXCIsXCJMZWZ0RG93blZlY3RvckJhclwiOlwiXFx1Mjk1OVwiLFwiTGVmdERvd25WZWN0b3JcIjpcIlxcdTIxQzNcIixcIkxlZnRGbG9vclwiOlwiXFx1MjMwQVwiLFwibGVmdGhhcnBvb25kb3duXCI6XCJcXHUyMUJEXCIsXCJsZWZ0aGFycG9vbnVwXCI6XCJcXHUyMUJDXCIsXCJsZWZ0bGVmdGFycm93c1wiOlwiXFx1MjFDN1wiLFwibGVmdHJpZ2h0YXJyb3dcIjpcIlxcdTIxOTRcIixcIkxlZnRSaWdodEFycm93XCI6XCJcXHUyMTk0XCIsXCJMZWZ0cmlnaHRhcnJvd1wiOlwiXFx1MjFENFwiLFwibGVmdHJpZ2h0YXJyb3dzXCI6XCJcXHUyMUM2XCIsXCJsZWZ0cmlnaHRoYXJwb29uc1wiOlwiXFx1MjFDQlwiLFwibGVmdHJpZ2h0c3F1aWdhcnJvd1wiOlwiXFx1MjFBRFwiLFwiTGVmdFJpZ2h0VmVjdG9yXCI6XCJcXHUyOTRFXCIsXCJMZWZ0VGVlQXJyb3dcIjpcIlxcdTIxQTRcIixcIkxlZnRUZWVcIjpcIlxcdTIyQTNcIixcIkxlZnRUZWVWZWN0b3JcIjpcIlxcdTI5NUFcIixcImxlZnR0aHJlZXRpbWVzXCI6XCJcXHUyMkNCXCIsXCJMZWZ0VHJpYW5nbGVCYXJcIjpcIlxcdTI5Q0ZcIixcIkxlZnRUcmlhbmdsZVwiOlwiXFx1MjJCMlwiLFwiTGVmdFRyaWFuZ2xlRXF1YWxcIjpcIlxcdTIyQjRcIixcIkxlZnRVcERvd25WZWN0b3JcIjpcIlxcdTI5NTFcIixcIkxlZnRVcFRlZVZlY3RvclwiOlwiXFx1Mjk2MFwiLFwiTGVmdFVwVmVjdG9yQmFyXCI6XCJcXHUyOTU4XCIsXCJMZWZ0VXBWZWN0b3JcIjpcIlxcdTIxQkZcIixcIkxlZnRWZWN0b3JCYXJcIjpcIlxcdTI5NTJcIixcIkxlZnRWZWN0b3JcIjpcIlxcdTIxQkNcIixcImxFZ1wiOlwiXFx1MkE4QlwiLFwibGVnXCI6XCJcXHUyMkRBXCIsXCJsZXFcIjpcIlxcdTIyNjRcIixcImxlcXFcIjpcIlxcdTIyNjZcIixcImxlcXNsYW50XCI6XCJcXHUyQTdEXCIsXCJsZXNjY1wiOlwiXFx1MkFBOFwiLFwibGVzXCI6XCJcXHUyQTdEXCIsXCJsZXNkb3RcIjpcIlxcdTJBN0ZcIixcImxlc2RvdG9cIjpcIlxcdTJBODFcIixcImxlc2RvdG9yXCI6XCJcXHUyQTgzXCIsXCJsZXNnXCI6XCJcXHUyMkRBXFx1RkUwMFwiLFwibGVzZ2VzXCI6XCJcXHUyQTkzXCIsXCJsZXNzYXBwcm94XCI6XCJcXHUyQTg1XCIsXCJsZXNzZG90XCI6XCJcXHUyMkQ2XCIsXCJsZXNzZXFndHJcIjpcIlxcdTIyREFcIixcImxlc3NlcXFndHJcIjpcIlxcdTJBOEJcIixcIkxlc3NFcXVhbEdyZWF0ZXJcIjpcIlxcdTIyREFcIixcIkxlc3NGdWxsRXF1YWxcIjpcIlxcdTIyNjZcIixcIkxlc3NHcmVhdGVyXCI6XCJcXHUyMjc2XCIsXCJsZXNzZ3RyXCI6XCJcXHUyMjc2XCIsXCJMZXNzTGVzc1wiOlwiXFx1MkFBMVwiLFwibGVzc3NpbVwiOlwiXFx1MjI3MlwiLFwiTGVzc1NsYW50RXF1YWxcIjpcIlxcdTJBN0RcIixcIkxlc3NUaWxkZVwiOlwiXFx1MjI3MlwiLFwibGZpc2h0XCI6XCJcXHUyOTdDXCIsXCJsZmxvb3JcIjpcIlxcdTIzMEFcIixcIkxmclwiOlwiXFx1RDgzNVxcdUREMEZcIixcImxmclwiOlwiXFx1RDgzNVxcdUREMjlcIixcImxnXCI6XCJcXHUyMjc2XCIsXCJsZ0VcIjpcIlxcdTJBOTFcIixcImxIYXJcIjpcIlxcdTI5NjJcIixcImxoYXJkXCI6XCJcXHUyMUJEXCIsXCJsaGFydVwiOlwiXFx1MjFCQ1wiLFwibGhhcnVsXCI6XCJcXHUyOTZBXCIsXCJsaGJsa1wiOlwiXFx1MjU4NFwiLFwiTEpjeVwiOlwiXFx1MDQwOVwiLFwibGpjeVwiOlwiXFx1MDQ1OVwiLFwibGxhcnJcIjpcIlxcdTIxQzdcIixcImxsXCI6XCJcXHUyMjZBXCIsXCJMbFwiOlwiXFx1MjJEOFwiLFwibGxjb3JuZXJcIjpcIlxcdTIzMUVcIixcIkxsZWZ0YXJyb3dcIjpcIlxcdTIxREFcIixcImxsaGFyZFwiOlwiXFx1Mjk2QlwiLFwibGx0cmlcIjpcIlxcdTI1RkFcIixcIkxtaWRvdFwiOlwiXFx1MDEzRlwiLFwibG1pZG90XCI6XCJcXHUwMTQwXCIsXCJsbW91c3RhY2hlXCI6XCJcXHUyM0IwXCIsXCJsbW91c3RcIjpcIlxcdTIzQjBcIixcImxuYXBcIjpcIlxcdTJBODlcIixcImxuYXBwcm94XCI6XCJcXHUyQTg5XCIsXCJsbmVcIjpcIlxcdTJBODdcIixcImxuRVwiOlwiXFx1MjI2OFwiLFwibG5lcVwiOlwiXFx1MkE4N1wiLFwibG5lcXFcIjpcIlxcdTIyNjhcIixcImxuc2ltXCI6XCJcXHUyMkU2XCIsXCJsb2FuZ1wiOlwiXFx1MjdFQ1wiLFwibG9hcnJcIjpcIlxcdTIxRkRcIixcImxvYnJrXCI6XCJcXHUyN0U2XCIsXCJsb25nbGVmdGFycm93XCI6XCJcXHUyN0Y1XCIsXCJMb25nTGVmdEFycm93XCI6XCJcXHUyN0Y1XCIsXCJMb25nbGVmdGFycm93XCI6XCJcXHUyN0Y4XCIsXCJsb25nbGVmdHJpZ2h0YXJyb3dcIjpcIlxcdTI3RjdcIixcIkxvbmdMZWZ0UmlnaHRBcnJvd1wiOlwiXFx1MjdGN1wiLFwiTG9uZ2xlZnRyaWdodGFycm93XCI6XCJcXHUyN0ZBXCIsXCJsb25nbWFwc3RvXCI6XCJcXHUyN0ZDXCIsXCJsb25ncmlnaHRhcnJvd1wiOlwiXFx1MjdGNlwiLFwiTG9uZ1JpZ2h0QXJyb3dcIjpcIlxcdTI3RjZcIixcIkxvbmdyaWdodGFycm93XCI6XCJcXHUyN0Y5XCIsXCJsb29wYXJyb3dsZWZ0XCI6XCJcXHUyMUFCXCIsXCJsb29wYXJyb3dyaWdodFwiOlwiXFx1MjFBQ1wiLFwibG9wYXJcIjpcIlxcdTI5ODVcIixcIkxvcGZcIjpcIlxcdUQ4MzVcXHVERDQzXCIsXCJsb3BmXCI6XCJcXHVEODM1XFx1REQ1RFwiLFwibG9wbHVzXCI6XCJcXHUyQTJEXCIsXCJsb3RpbWVzXCI6XCJcXHUyQTM0XCIsXCJsb3dhc3RcIjpcIlxcdTIyMTdcIixcImxvd2JhclwiOlwiX1wiLFwiTG93ZXJMZWZ0QXJyb3dcIjpcIlxcdTIxOTlcIixcIkxvd2VyUmlnaHRBcnJvd1wiOlwiXFx1MjE5OFwiLFwibG96XCI6XCJcXHUyNUNBXCIsXCJsb3plbmdlXCI6XCJcXHUyNUNBXCIsXCJsb3pmXCI6XCJcXHUyOUVCXCIsXCJscGFyXCI6XCIoXCIsXCJscGFybHRcIjpcIlxcdTI5OTNcIixcImxyYXJyXCI6XCJcXHUyMUM2XCIsXCJscmNvcm5lclwiOlwiXFx1MjMxRlwiLFwibHJoYXJcIjpcIlxcdTIxQ0JcIixcImxyaGFyZFwiOlwiXFx1Mjk2RFwiLFwibHJtXCI6XCJcXHUyMDBFXCIsXCJscnRyaVwiOlwiXFx1MjJCRlwiLFwibHNhcXVvXCI6XCJcXHUyMDM5XCIsXCJsc2NyXCI6XCJcXHVEODM1XFx1RENDMVwiLFwiTHNjclwiOlwiXFx1MjExMlwiLFwibHNoXCI6XCJcXHUyMUIwXCIsXCJMc2hcIjpcIlxcdTIxQjBcIixcImxzaW1cIjpcIlxcdTIyNzJcIixcImxzaW1lXCI6XCJcXHUyQThEXCIsXCJsc2ltZ1wiOlwiXFx1MkE4RlwiLFwibHNxYlwiOlwiW1wiLFwibHNxdW9cIjpcIlxcdTIwMThcIixcImxzcXVvclwiOlwiXFx1MjAxQVwiLFwiTHN0cm9rXCI6XCJcXHUwMTQxXCIsXCJsc3Ryb2tcIjpcIlxcdTAxNDJcIixcImx0Y2NcIjpcIlxcdTJBQTZcIixcImx0Y2lyXCI6XCJcXHUyQTc5XCIsXCJsdFwiOlwiPFwiLFwiTFRcIjpcIjxcIixcIkx0XCI6XCJcXHUyMjZBXCIsXCJsdGRvdFwiOlwiXFx1MjJENlwiLFwibHRocmVlXCI6XCJcXHUyMkNCXCIsXCJsdGltZXNcIjpcIlxcdTIyQzlcIixcImx0bGFyclwiOlwiXFx1Mjk3NlwiLFwibHRxdWVzdFwiOlwiXFx1MkE3QlwiLFwibHRyaVwiOlwiXFx1MjVDM1wiLFwibHRyaWVcIjpcIlxcdTIyQjRcIixcImx0cmlmXCI6XCJcXHUyNUMyXCIsXCJsdHJQYXJcIjpcIlxcdTI5OTZcIixcImx1cmRzaGFyXCI6XCJcXHUyOTRBXCIsXCJsdXJ1aGFyXCI6XCJcXHUyOTY2XCIsXCJsdmVydG5lcXFcIjpcIlxcdTIyNjhcXHVGRTAwXCIsXCJsdm5FXCI6XCJcXHUyMjY4XFx1RkUwMFwiLFwibWFjclwiOlwiXFx1MDBBRlwiLFwibWFsZVwiOlwiXFx1MjY0MlwiLFwibWFsdFwiOlwiXFx1MjcyMFwiLFwibWFsdGVzZVwiOlwiXFx1MjcyMFwiLFwiTWFwXCI6XCJcXHUyOTA1XCIsXCJtYXBcIjpcIlxcdTIxQTZcIixcIm1hcHN0b1wiOlwiXFx1MjFBNlwiLFwibWFwc3RvZG93blwiOlwiXFx1MjFBN1wiLFwibWFwc3RvbGVmdFwiOlwiXFx1MjFBNFwiLFwibWFwc3RvdXBcIjpcIlxcdTIxQTVcIixcIm1hcmtlclwiOlwiXFx1MjVBRVwiLFwibWNvbW1hXCI6XCJcXHUyQTI5XCIsXCJNY3lcIjpcIlxcdTA0MUNcIixcIm1jeVwiOlwiXFx1MDQzQ1wiLFwibWRhc2hcIjpcIlxcdTIwMTRcIixcIm1ERG90XCI6XCJcXHUyMjNBXCIsXCJtZWFzdXJlZGFuZ2xlXCI6XCJcXHUyMjIxXCIsXCJNZWRpdW1TcGFjZVwiOlwiXFx1MjA1RlwiLFwiTWVsbGludHJmXCI6XCJcXHUyMTMzXCIsXCJNZnJcIjpcIlxcdUQ4MzVcXHVERDEwXCIsXCJtZnJcIjpcIlxcdUQ4MzVcXHVERDJBXCIsXCJtaG9cIjpcIlxcdTIxMjdcIixcIm1pY3JvXCI6XCJcXHUwMEI1XCIsXCJtaWRhc3RcIjpcIipcIixcIm1pZGNpclwiOlwiXFx1MkFGMFwiLFwibWlkXCI6XCJcXHUyMjIzXCIsXCJtaWRkb3RcIjpcIlxcdTAwQjdcIixcIm1pbnVzYlwiOlwiXFx1MjI5RlwiLFwibWludXNcIjpcIlxcdTIyMTJcIixcIm1pbnVzZFwiOlwiXFx1MjIzOFwiLFwibWludXNkdVwiOlwiXFx1MkEyQVwiLFwiTWludXNQbHVzXCI6XCJcXHUyMjEzXCIsXCJtbGNwXCI6XCJcXHUyQURCXCIsXCJtbGRyXCI6XCJcXHUyMDI2XCIsXCJtbnBsdXNcIjpcIlxcdTIyMTNcIixcIm1vZGVsc1wiOlwiXFx1MjJBN1wiLFwiTW9wZlwiOlwiXFx1RDgzNVxcdURENDRcIixcIm1vcGZcIjpcIlxcdUQ4MzVcXHVERDVFXCIsXCJtcFwiOlwiXFx1MjIxM1wiLFwibXNjclwiOlwiXFx1RDgzNVxcdURDQzJcIixcIk1zY3JcIjpcIlxcdTIxMzNcIixcIm1zdHBvc1wiOlwiXFx1MjIzRVwiLFwiTXVcIjpcIlxcdTAzOUNcIixcIm11XCI6XCJcXHUwM0JDXCIsXCJtdWx0aW1hcFwiOlwiXFx1MjJCOFwiLFwibXVtYXBcIjpcIlxcdTIyQjhcIixcIm5hYmxhXCI6XCJcXHUyMjA3XCIsXCJOYWN1dGVcIjpcIlxcdTAxNDNcIixcIm5hY3V0ZVwiOlwiXFx1MDE0NFwiLFwibmFuZ1wiOlwiXFx1MjIyMFxcdTIwRDJcIixcIm5hcFwiOlwiXFx1MjI0OVwiLFwibmFwRVwiOlwiXFx1MkE3MFxcdTAzMzhcIixcIm5hcGlkXCI6XCJcXHUyMjRCXFx1MDMzOFwiLFwibmFwb3NcIjpcIlxcdTAxNDlcIixcIm5hcHByb3hcIjpcIlxcdTIyNDlcIixcIm5hdHVyYWxcIjpcIlxcdTI2NkVcIixcIm5hdHVyYWxzXCI6XCJcXHUyMTE1XCIsXCJuYXR1clwiOlwiXFx1MjY2RVwiLFwibmJzcFwiOlwiXFx1MDBBMFwiLFwibmJ1bXBcIjpcIlxcdTIyNEVcXHUwMzM4XCIsXCJuYnVtcGVcIjpcIlxcdTIyNEZcXHUwMzM4XCIsXCJuY2FwXCI6XCJcXHUyQTQzXCIsXCJOY2Fyb25cIjpcIlxcdTAxNDdcIixcIm5jYXJvblwiOlwiXFx1MDE0OFwiLFwiTmNlZGlsXCI6XCJcXHUwMTQ1XCIsXCJuY2VkaWxcIjpcIlxcdTAxNDZcIixcIm5jb25nXCI6XCJcXHUyMjQ3XCIsXCJuY29uZ2RvdFwiOlwiXFx1MkE2RFxcdTAzMzhcIixcIm5jdXBcIjpcIlxcdTJBNDJcIixcIk5jeVwiOlwiXFx1MDQxRFwiLFwibmN5XCI6XCJcXHUwNDNEXCIsXCJuZGFzaFwiOlwiXFx1MjAxM1wiLFwibmVhcmhrXCI6XCJcXHUyOTI0XCIsXCJuZWFyclwiOlwiXFx1MjE5N1wiLFwibmVBcnJcIjpcIlxcdTIxRDdcIixcIm5lYXJyb3dcIjpcIlxcdTIxOTdcIixcIm5lXCI6XCJcXHUyMjYwXCIsXCJuZWRvdFwiOlwiXFx1MjI1MFxcdTAzMzhcIixcIk5lZ2F0aXZlTWVkaXVtU3BhY2VcIjpcIlxcdTIwMEJcIixcIk5lZ2F0aXZlVGhpY2tTcGFjZVwiOlwiXFx1MjAwQlwiLFwiTmVnYXRpdmVUaGluU3BhY2VcIjpcIlxcdTIwMEJcIixcIk5lZ2F0aXZlVmVyeVRoaW5TcGFjZVwiOlwiXFx1MjAwQlwiLFwibmVxdWl2XCI6XCJcXHUyMjYyXCIsXCJuZXNlYXJcIjpcIlxcdTI5MjhcIixcIm5lc2ltXCI6XCJcXHUyMjQyXFx1MDMzOFwiLFwiTmVzdGVkR3JlYXRlckdyZWF0ZXJcIjpcIlxcdTIyNkJcIixcIk5lc3RlZExlc3NMZXNzXCI6XCJcXHUyMjZBXCIsXCJOZXdMaW5lXCI6XCJcXG5cIixcIm5leGlzdFwiOlwiXFx1MjIwNFwiLFwibmV4aXN0c1wiOlwiXFx1MjIwNFwiLFwiTmZyXCI6XCJcXHVEODM1XFx1REQxMVwiLFwibmZyXCI6XCJcXHVEODM1XFx1REQyQlwiLFwibmdFXCI6XCJcXHUyMjY3XFx1MDMzOFwiLFwibmdlXCI6XCJcXHUyMjcxXCIsXCJuZ2VxXCI6XCJcXHUyMjcxXCIsXCJuZ2VxcVwiOlwiXFx1MjI2N1xcdTAzMzhcIixcIm5nZXFzbGFudFwiOlwiXFx1MkE3RVxcdTAzMzhcIixcIm5nZXNcIjpcIlxcdTJBN0VcXHUwMzM4XCIsXCJuR2dcIjpcIlxcdTIyRDlcXHUwMzM4XCIsXCJuZ3NpbVwiOlwiXFx1MjI3NVwiLFwibkd0XCI6XCJcXHUyMjZCXFx1MjBEMlwiLFwibmd0XCI6XCJcXHUyMjZGXCIsXCJuZ3RyXCI6XCJcXHUyMjZGXCIsXCJuR3R2XCI6XCJcXHUyMjZCXFx1MDMzOFwiLFwibmhhcnJcIjpcIlxcdTIxQUVcIixcIm5oQXJyXCI6XCJcXHUyMUNFXCIsXCJuaHBhclwiOlwiXFx1MkFGMlwiLFwibmlcIjpcIlxcdTIyMEJcIixcIm5pc1wiOlwiXFx1MjJGQ1wiLFwibmlzZFwiOlwiXFx1MjJGQVwiLFwibml2XCI6XCJcXHUyMjBCXCIsXCJOSmN5XCI6XCJcXHUwNDBBXCIsXCJuamN5XCI6XCJcXHUwNDVBXCIsXCJubGFyclwiOlwiXFx1MjE5QVwiLFwibmxBcnJcIjpcIlxcdTIxQ0RcIixcIm5sZHJcIjpcIlxcdTIwMjVcIixcIm5sRVwiOlwiXFx1MjI2NlxcdTAzMzhcIixcIm5sZVwiOlwiXFx1MjI3MFwiLFwibmxlZnRhcnJvd1wiOlwiXFx1MjE5QVwiLFwibkxlZnRhcnJvd1wiOlwiXFx1MjFDRFwiLFwibmxlZnRyaWdodGFycm93XCI6XCJcXHUyMUFFXCIsXCJuTGVmdHJpZ2h0YXJyb3dcIjpcIlxcdTIxQ0VcIixcIm5sZXFcIjpcIlxcdTIyNzBcIixcIm5sZXFxXCI6XCJcXHUyMjY2XFx1MDMzOFwiLFwibmxlcXNsYW50XCI6XCJcXHUyQTdEXFx1MDMzOFwiLFwibmxlc1wiOlwiXFx1MkE3RFxcdTAzMzhcIixcIm5sZXNzXCI6XCJcXHUyMjZFXCIsXCJuTGxcIjpcIlxcdTIyRDhcXHUwMzM4XCIsXCJubHNpbVwiOlwiXFx1MjI3NFwiLFwibkx0XCI6XCJcXHUyMjZBXFx1MjBEMlwiLFwibmx0XCI6XCJcXHUyMjZFXCIsXCJubHRyaVwiOlwiXFx1MjJFQVwiLFwibmx0cmllXCI6XCJcXHUyMkVDXCIsXCJuTHR2XCI6XCJcXHUyMjZBXFx1MDMzOFwiLFwibm1pZFwiOlwiXFx1MjIyNFwiLFwiTm9CcmVha1wiOlwiXFx1MjA2MFwiLFwiTm9uQnJlYWtpbmdTcGFjZVwiOlwiXFx1MDBBMFwiLFwibm9wZlwiOlwiXFx1RDgzNVxcdURENUZcIixcIk5vcGZcIjpcIlxcdTIxMTVcIixcIk5vdFwiOlwiXFx1MkFFQ1wiLFwibm90XCI6XCJcXHUwMEFDXCIsXCJOb3RDb25ncnVlbnRcIjpcIlxcdTIyNjJcIixcIk5vdEN1cENhcFwiOlwiXFx1MjI2RFwiLFwiTm90RG91YmxlVmVydGljYWxCYXJcIjpcIlxcdTIyMjZcIixcIk5vdEVsZW1lbnRcIjpcIlxcdTIyMDlcIixcIk5vdEVxdWFsXCI6XCJcXHUyMjYwXCIsXCJOb3RFcXVhbFRpbGRlXCI6XCJcXHUyMjQyXFx1MDMzOFwiLFwiTm90RXhpc3RzXCI6XCJcXHUyMjA0XCIsXCJOb3RHcmVhdGVyXCI6XCJcXHUyMjZGXCIsXCJOb3RHcmVhdGVyRXF1YWxcIjpcIlxcdTIyNzFcIixcIk5vdEdyZWF0ZXJGdWxsRXF1YWxcIjpcIlxcdTIyNjdcXHUwMzM4XCIsXCJOb3RHcmVhdGVyR3JlYXRlclwiOlwiXFx1MjI2QlxcdTAzMzhcIixcIk5vdEdyZWF0ZXJMZXNzXCI6XCJcXHUyMjc5XCIsXCJOb3RHcmVhdGVyU2xhbnRFcXVhbFwiOlwiXFx1MkE3RVxcdTAzMzhcIixcIk5vdEdyZWF0ZXJUaWxkZVwiOlwiXFx1MjI3NVwiLFwiTm90SHVtcERvd25IdW1wXCI6XCJcXHUyMjRFXFx1MDMzOFwiLFwiTm90SHVtcEVxdWFsXCI6XCJcXHUyMjRGXFx1MDMzOFwiLFwibm90aW5cIjpcIlxcdTIyMDlcIixcIm5vdGluZG90XCI6XCJcXHUyMkY1XFx1MDMzOFwiLFwibm90aW5FXCI6XCJcXHUyMkY5XFx1MDMzOFwiLFwibm90aW52YVwiOlwiXFx1MjIwOVwiLFwibm90aW52YlwiOlwiXFx1MjJGN1wiLFwibm90aW52Y1wiOlwiXFx1MjJGNlwiLFwiTm90TGVmdFRyaWFuZ2xlQmFyXCI6XCJcXHUyOUNGXFx1MDMzOFwiLFwiTm90TGVmdFRyaWFuZ2xlXCI6XCJcXHUyMkVBXCIsXCJOb3RMZWZ0VHJpYW5nbGVFcXVhbFwiOlwiXFx1MjJFQ1wiLFwiTm90TGVzc1wiOlwiXFx1MjI2RVwiLFwiTm90TGVzc0VxdWFsXCI6XCJcXHUyMjcwXCIsXCJOb3RMZXNzR3JlYXRlclwiOlwiXFx1MjI3OFwiLFwiTm90TGVzc0xlc3NcIjpcIlxcdTIyNkFcXHUwMzM4XCIsXCJOb3RMZXNzU2xhbnRFcXVhbFwiOlwiXFx1MkE3RFxcdTAzMzhcIixcIk5vdExlc3NUaWxkZVwiOlwiXFx1MjI3NFwiLFwiTm90TmVzdGVkR3JlYXRlckdyZWF0ZXJcIjpcIlxcdTJBQTJcXHUwMzM4XCIsXCJOb3ROZXN0ZWRMZXNzTGVzc1wiOlwiXFx1MkFBMVxcdTAzMzhcIixcIm5vdG5pXCI6XCJcXHUyMjBDXCIsXCJub3RuaXZhXCI6XCJcXHUyMjBDXCIsXCJub3RuaXZiXCI6XCJcXHUyMkZFXCIsXCJub3RuaXZjXCI6XCJcXHUyMkZEXCIsXCJOb3RQcmVjZWRlc1wiOlwiXFx1MjI4MFwiLFwiTm90UHJlY2VkZXNFcXVhbFwiOlwiXFx1MkFBRlxcdTAzMzhcIixcIk5vdFByZWNlZGVzU2xhbnRFcXVhbFwiOlwiXFx1MjJFMFwiLFwiTm90UmV2ZXJzZUVsZW1lbnRcIjpcIlxcdTIyMENcIixcIk5vdFJpZ2h0VHJpYW5nbGVCYXJcIjpcIlxcdTI5RDBcXHUwMzM4XCIsXCJOb3RSaWdodFRyaWFuZ2xlXCI6XCJcXHUyMkVCXCIsXCJOb3RSaWdodFRyaWFuZ2xlRXF1YWxcIjpcIlxcdTIyRURcIixcIk5vdFNxdWFyZVN1YnNldFwiOlwiXFx1MjI4RlxcdTAzMzhcIixcIk5vdFNxdWFyZVN1YnNldEVxdWFsXCI6XCJcXHUyMkUyXCIsXCJOb3RTcXVhcmVTdXBlcnNldFwiOlwiXFx1MjI5MFxcdTAzMzhcIixcIk5vdFNxdWFyZVN1cGVyc2V0RXF1YWxcIjpcIlxcdTIyRTNcIixcIk5vdFN1YnNldFwiOlwiXFx1MjI4MlxcdTIwRDJcIixcIk5vdFN1YnNldEVxdWFsXCI6XCJcXHUyMjg4XCIsXCJOb3RTdWNjZWVkc1wiOlwiXFx1MjI4MVwiLFwiTm90U3VjY2VlZHNFcXVhbFwiOlwiXFx1MkFCMFxcdTAzMzhcIixcIk5vdFN1Y2NlZWRzU2xhbnRFcXVhbFwiOlwiXFx1MjJFMVwiLFwiTm90U3VjY2VlZHNUaWxkZVwiOlwiXFx1MjI3RlxcdTAzMzhcIixcIk5vdFN1cGVyc2V0XCI6XCJcXHUyMjgzXFx1MjBEMlwiLFwiTm90U3VwZXJzZXRFcXVhbFwiOlwiXFx1MjI4OVwiLFwiTm90VGlsZGVcIjpcIlxcdTIyNDFcIixcIk5vdFRpbGRlRXF1YWxcIjpcIlxcdTIyNDRcIixcIk5vdFRpbGRlRnVsbEVxdWFsXCI6XCJcXHUyMjQ3XCIsXCJOb3RUaWxkZVRpbGRlXCI6XCJcXHUyMjQ5XCIsXCJOb3RWZXJ0aWNhbEJhclwiOlwiXFx1MjIyNFwiLFwibnBhcmFsbGVsXCI6XCJcXHUyMjI2XCIsXCJucGFyXCI6XCJcXHUyMjI2XCIsXCJucGFyc2xcIjpcIlxcdTJBRkRcXHUyMEU1XCIsXCJucGFydFwiOlwiXFx1MjIwMlxcdTAzMzhcIixcIm5wb2xpbnRcIjpcIlxcdTJBMTRcIixcIm5wclwiOlwiXFx1MjI4MFwiLFwibnByY3VlXCI6XCJcXHUyMkUwXCIsXCJucHJlY1wiOlwiXFx1MjI4MFwiLFwibnByZWNlcVwiOlwiXFx1MkFBRlxcdTAzMzhcIixcIm5wcmVcIjpcIlxcdTJBQUZcXHUwMzM4XCIsXCJucmFycmNcIjpcIlxcdTI5MzNcXHUwMzM4XCIsXCJucmFyclwiOlwiXFx1MjE5QlwiLFwibnJBcnJcIjpcIlxcdTIxQ0ZcIixcIm5yYXJyd1wiOlwiXFx1MjE5RFxcdTAzMzhcIixcIm5yaWdodGFycm93XCI6XCJcXHUyMTlCXCIsXCJuUmlnaHRhcnJvd1wiOlwiXFx1MjFDRlwiLFwibnJ0cmlcIjpcIlxcdTIyRUJcIixcIm5ydHJpZVwiOlwiXFx1MjJFRFwiLFwibnNjXCI6XCJcXHUyMjgxXCIsXCJuc2NjdWVcIjpcIlxcdTIyRTFcIixcIm5zY2VcIjpcIlxcdTJBQjBcXHUwMzM4XCIsXCJOc2NyXCI6XCJcXHVEODM1XFx1RENBOVwiLFwibnNjclwiOlwiXFx1RDgzNVxcdURDQzNcIixcIm5zaG9ydG1pZFwiOlwiXFx1MjIyNFwiLFwibnNob3J0cGFyYWxsZWxcIjpcIlxcdTIyMjZcIixcIm5zaW1cIjpcIlxcdTIyNDFcIixcIm5zaW1lXCI6XCJcXHUyMjQ0XCIsXCJuc2ltZXFcIjpcIlxcdTIyNDRcIixcIm5zbWlkXCI6XCJcXHUyMjI0XCIsXCJuc3BhclwiOlwiXFx1MjIyNlwiLFwibnNxc3ViZVwiOlwiXFx1MjJFMlwiLFwibnNxc3VwZVwiOlwiXFx1MjJFM1wiLFwibnN1YlwiOlwiXFx1MjI4NFwiLFwibnN1YkVcIjpcIlxcdTJBQzVcXHUwMzM4XCIsXCJuc3ViZVwiOlwiXFx1MjI4OFwiLFwibnN1YnNldFwiOlwiXFx1MjI4MlxcdTIwRDJcIixcIm5zdWJzZXRlcVwiOlwiXFx1MjI4OFwiLFwibnN1YnNldGVxcVwiOlwiXFx1MkFDNVxcdTAzMzhcIixcIm5zdWNjXCI6XCJcXHUyMjgxXCIsXCJuc3VjY2VxXCI6XCJcXHUyQUIwXFx1MDMzOFwiLFwibnN1cFwiOlwiXFx1MjI4NVwiLFwibnN1cEVcIjpcIlxcdTJBQzZcXHUwMzM4XCIsXCJuc3VwZVwiOlwiXFx1MjI4OVwiLFwibnN1cHNldFwiOlwiXFx1MjI4M1xcdTIwRDJcIixcIm5zdXBzZXRlcVwiOlwiXFx1MjI4OVwiLFwibnN1cHNldGVxcVwiOlwiXFx1MkFDNlxcdTAzMzhcIixcIm50Z2xcIjpcIlxcdTIyNzlcIixcIk50aWxkZVwiOlwiXFx1MDBEMVwiLFwibnRpbGRlXCI6XCJcXHUwMEYxXCIsXCJudGxnXCI6XCJcXHUyMjc4XCIsXCJudHJpYW5nbGVsZWZ0XCI6XCJcXHUyMkVBXCIsXCJudHJpYW5nbGVsZWZ0ZXFcIjpcIlxcdTIyRUNcIixcIm50cmlhbmdsZXJpZ2h0XCI6XCJcXHUyMkVCXCIsXCJudHJpYW5nbGVyaWdodGVxXCI6XCJcXHUyMkVEXCIsXCJOdVwiOlwiXFx1MDM5RFwiLFwibnVcIjpcIlxcdTAzQkRcIixcIm51bVwiOlwiI1wiLFwibnVtZXJvXCI6XCJcXHUyMTE2XCIsXCJudW1zcFwiOlwiXFx1MjAwN1wiLFwibnZhcFwiOlwiXFx1MjI0RFxcdTIwRDJcIixcIm52ZGFzaFwiOlwiXFx1MjJBQ1wiLFwibnZEYXNoXCI6XCJcXHUyMkFEXCIsXCJuVmRhc2hcIjpcIlxcdTIyQUVcIixcIm5WRGFzaFwiOlwiXFx1MjJBRlwiLFwibnZnZVwiOlwiXFx1MjI2NVxcdTIwRDJcIixcIm52Z3RcIjpcIj5cXHUyMEQyXCIsXCJudkhhcnJcIjpcIlxcdTI5MDRcIixcIm52aW5maW5cIjpcIlxcdTI5REVcIixcIm52bEFyclwiOlwiXFx1MjkwMlwiLFwibnZsZVwiOlwiXFx1MjI2NFxcdTIwRDJcIixcIm52bHRcIjpcIjxcXHUyMEQyXCIsXCJudmx0cmllXCI6XCJcXHUyMkI0XFx1MjBEMlwiLFwibnZyQXJyXCI6XCJcXHUyOTAzXCIsXCJudnJ0cmllXCI6XCJcXHUyMkI1XFx1MjBEMlwiLFwibnZzaW1cIjpcIlxcdTIyM0NcXHUyMEQyXCIsXCJud2FyaGtcIjpcIlxcdTI5MjNcIixcIm53YXJyXCI6XCJcXHUyMTk2XCIsXCJud0FyclwiOlwiXFx1MjFENlwiLFwibndhcnJvd1wiOlwiXFx1MjE5NlwiLFwibnduZWFyXCI6XCJcXHUyOTI3XCIsXCJPYWN1dGVcIjpcIlxcdTAwRDNcIixcIm9hY3V0ZVwiOlwiXFx1MDBGM1wiLFwib2FzdFwiOlwiXFx1MjI5QlwiLFwiT2NpcmNcIjpcIlxcdTAwRDRcIixcIm9jaXJjXCI6XCJcXHUwMEY0XCIsXCJvY2lyXCI6XCJcXHUyMjlBXCIsXCJPY3lcIjpcIlxcdTA0MUVcIixcIm9jeVwiOlwiXFx1MDQzRVwiLFwib2Rhc2hcIjpcIlxcdTIyOURcIixcIk9kYmxhY1wiOlwiXFx1MDE1MFwiLFwib2RibGFjXCI6XCJcXHUwMTUxXCIsXCJvZGl2XCI6XCJcXHUyQTM4XCIsXCJvZG90XCI6XCJcXHUyMjk5XCIsXCJvZHNvbGRcIjpcIlxcdTI5QkNcIixcIk9FbGlnXCI6XCJcXHUwMTUyXCIsXCJvZWxpZ1wiOlwiXFx1MDE1M1wiLFwib2ZjaXJcIjpcIlxcdTI5QkZcIixcIk9mclwiOlwiXFx1RDgzNVxcdUREMTJcIixcIm9mclwiOlwiXFx1RDgzNVxcdUREMkNcIixcIm9nb25cIjpcIlxcdTAyREJcIixcIk9ncmF2ZVwiOlwiXFx1MDBEMlwiLFwib2dyYXZlXCI6XCJcXHUwMEYyXCIsXCJvZ3RcIjpcIlxcdTI5QzFcIixcIm9oYmFyXCI6XCJcXHUyOUI1XCIsXCJvaG1cIjpcIlxcdTAzQTlcIixcIm9pbnRcIjpcIlxcdTIyMkVcIixcIm9sYXJyXCI6XCJcXHUyMUJBXCIsXCJvbGNpclwiOlwiXFx1MjlCRVwiLFwib2xjcm9zc1wiOlwiXFx1MjlCQlwiLFwib2xpbmVcIjpcIlxcdTIwM0VcIixcIm9sdFwiOlwiXFx1MjlDMFwiLFwiT21hY3JcIjpcIlxcdTAxNENcIixcIm9tYWNyXCI6XCJcXHUwMTREXCIsXCJPbWVnYVwiOlwiXFx1MDNBOVwiLFwib21lZ2FcIjpcIlxcdTAzQzlcIixcIk9taWNyb25cIjpcIlxcdTAzOUZcIixcIm9taWNyb25cIjpcIlxcdTAzQkZcIixcIm9taWRcIjpcIlxcdTI5QjZcIixcIm9taW51c1wiOlwiXFx1MjI5NlwiLFwiT29wZlwiOlwiXFx1RDgzNVxcdURENDZcIixcIm9vcGZcIjpcIlxcdUQ4MzVcXHVERDYwXCIsXCJvcGFyXCI6XCJcXHUyOUI3XCIsXCJPcGVuQ3VybHlEb3VibGVRdW90ZVwiOlwiXFx1MjAxQ1wiLFwiT3BlbkN1cmx5UXVvdGVcIjpcIlxcdTIwMThcIixcIm9wZXJwXCI6XCJcXHUyOUI5XCIsXCJvcGx1c1wiOlwiXFx1MjI5NVwiLFwib3JhcnJcIjpcIlxcdTIxQkJcIixcIk9yXCI6XCJcXHUyQTU0XCIsXCJvclwiOlwiXFx1MjIyOFwiLFwib3JkXCI6XCJcXHUyQTVEXCIsXCJvcmRlclwiOlwiXFx1MjEzNFwiLFwib3JkZXJvZlwiOlwiXFx1MjEzNFwiLFwib3JkZlwiOlwiXFx1MDBBQVwiLFwib3JkbVwiOlwiXFx1MDBCQVwiLFwib3JpZ29mXCI6XCJcXHUyMkI2XCIsXCJvcm9yXCI6XCJcXHUyQTU2XCIsXCJvcnNsb3BlXCI6XCJcXHUyQTU3XCIsXCJvcnZcIjpcIlxcdTJBNUJcIixcIm9TXCI6XCJcXHUyNEM4XCIsXCJPc2NyXCI6XCJcXHVEODM1XFx1RENBQVwiLFwib3NjclwiOlwiXFx1MjEzNFwiLFwiT3NsYXNoXCI6XCJcXHUwMEQ4XCIsXCJvc2xhc2hcIjpcIlxcdTAwRjhcIixcIm9zb2xcIjpcIlxcdTIyOThcIixcIk90aWxkZVwiOlwiXFx1MDBENVwiLFwib3RpbGRlXCI6XCJcXHUwMEY1XCIsXCJvdGltZXNhc1wiOlwiXFx1MkEzNlwiLFwiT3RpbWVzXCI6XCJcXHUyQTM3XCIsXCJvdGltZXNcIjpcIlxcdTIyOTdcIixcIk91bWxcIjpcIlxcdTAwRDZcIixcIm91bWxcIjpcIlxcdTAwRjZcIixcIm92YmFyXCI6XCJcXHUyMzNEXCIsXCJPdmVyQmFyXCI6XCJcXHUyMDNFXCIsXCJPdmVyQnJhY2VcIjpcIlxcdTIzREVcIixcIk92ZXJCcmFja2V0XCI6XCJcXHUyM0I0XCIsXCJPdmVyUGFyZW50aGVzaXNcIjpcIlxcdTIzRENcIixcInBhcmFcIjpcIlxcdTAwQjZcIixcInBhcmFsbGVsXCI6XCJcXHUyMjI1XCIsXCJwYXJcIjpcIlxcdTIyMjVcIixcInBhcnNpbVwiOlwiXFx1MkFGM1wiLFwicGFyc2xcIjpcIlxcdTJBRkRcIixcInBhcnRcIjpcIlxcdTIyMDJcIixcIlBhcnRpYWxEXCI6XCJcXHUyMjAyXCIsXCJQY3lcIjpcIlxcdTA0MUZcIixcInBjeVwiOlwiXFx1MDQzRlwiLFwicGVyY250XCI6XCIlXCIsXCJwZXJpb2RcIjpcIi5cIixcInBlcm1pbFwiOlwiXFx1MjAzMFwiLFwicGVycFwiOlwiXFx1MjJBNVwiLFwicGVydGVua1wiOlwiXFx1MjAzMVwiLFwiUGZyXCI6XCJcXHVEODM1XFx1REQxM1wiLFwicGZyXCI6XCJcXHVEODM1XFx1REQyRFwiLFwiUGhpXCI6XCJcXHUwM0E2XCIsXCJwaGlcIjpcIlxcdTAzQzZcIixcInBoaXZcIjpcIlxcdTAzRDVcIixcInBobW1hdFwiOlwiXFx1MjEzM1wiLFwicGhvbmVcIjpcIlxcdTI2MEVcIixcIlBpXCI6XCJcXHUwM0EwXCIsXCJwaVwiOlwiXFx1MDNDMFwiLFwicGl0Y2hmb3JrXCI6XCJcXHUyMkQ0XCIsXCJwaXZcIjpcIlxcdTAzRDZcIixcInBsYW5ja1wiOlwiXFx1MjEwRlwiLFwicGxhbmNraFwiOlwiXFx1MjEwRVwiLFwicGxhbmt2XCI6XCJcXHUyMTBGXCIsXCJwbHVzYWNpclwiOlwiXFx1MkEyM1wiLFwicGx1c2JcIjpcIlxcdTIyOUVcIixcInBsdXNjaXJcIjpcIlxcdTJBMjJcIixcInBsdXNcIjpcIitcIixcInBsdXNkb1wiOlwiXFx1MjIxNFwiLFwicGx1c2R1XCI6XCJcXHUyQTI1XCIsXCJwbHVzZVwiOlwiXFx1MkE3MlwiLFwiUGx1c01pbnVzXCI6XCJcXHUwMEIxXCIsXCJwbHVzbW5cIjpcIlxcdTAwQjFcIixcInBsdXNzaW1cIjpcIlxcdTJBMjZcIixcInBsdXN0d29cIjpcIlxcdTJBMjdcIixcInBtXCI6XCJcXHUwMEIxXCIsXCJQb2luY2FyZXBsYW5lXCI6XCJcXHUyMTBDXCIsXCJwb2ludGludFwiOlwiXFx1MkExNVwiLFwicG9wZlwiOlwiXFx1RDgzNVxcdURENjFcIixcIlBvcGZcIjpcIlxcdTIxMTlcIixcInBvdW5kXCI6XCJcXHUwMEEzXCIsXCJwcmFwXCI6XCJcXHUyQUI3XCIsXCJQclwiOlwiXFx1MkFCQlwiLFwicHJcIjpcIlxcdTIyN0FcIixcInByY3VlXCI6XCJcXHUyMjdDXCIsXCJwcmVjYXBwcm94XCI6XCJcXHUyQUI3XCIsXCJwcmVjXCI6XCJcXHUyMjdBXCIsXCJwcmVjY3VybHllcVwiOlwiXFx1MjI3Q1wiLFwiUHJlY2VkZXNcIjpcIlxcdTIyN0FcIixcIlByZWNlZGVzRXF1YWxcIjpcIlxcdTJBQUZcIixcIlByZWNlZGVzU2xhbnRFcXVhbFwiOlwiXFx1MjI3Q1wiLFwiUHJlY2VkZXNUaWxkZVwiOlwiXFx1MjI3RVwiLFwicHJlY2VxXCI6XCJcXHUyQUFGXCIsXCJwcmVjbmFwcHJveFwiOlwiXFx1MkFCOVwiLFwicHJlY25lcXFcIjpcIlxcdTJBQjVcIixcInByZWNuc2ltXCI6XCJcXHUyMkU4XCIsXCJwcmVcIjpcIlxcdTJBQUZcIixcInByRVwiOlwiXFx1MkFCM1wiLFwicHJlY3NpbVwiOlwiXFx1MjI3RVwiLFwicHJpbWVcIjpcIlxcdTIwMzJcIixcIlByaW1lXCI6XCJcXHUyMDMzXCIsXCJwcmltZXNcIjpcIlxcdTIxMTlcIixcInBybmFwXCI6XCJcXHUyQUI5XCIsXCJwcm5FXCI6XCJcXHUyQUI1XCIsXCJwcm5zaW1cIjpcIlxcdTIyRThcIixcInByb2RcIjpcIlxcdTIyMEZcIixcIlByb2R1Y3RcIjpcIlxcdTIyMEZcIixcInByb2ZhbGFyXCI6XCJcXHUyMzJFXCIsXCJwcm9mbGluZVwiOlwiXFx1MjMxMlwiLFwicHJvZnN1cmZcIjpcIlxcdTIzMTNcIixcInByb3BcIjpcIlxcdTIyMURcIixcIlByb3BvcnRpb25hbFwiOlwiXFx1MjIxRFwiLFwiUHJvcG9ydGlvblwiOlwiXFx1MjIzN1wiLFwicHJvcHRvXCI6XCJcXHUyMjFEXCIsXCJwcnNpbVwiOlwiXFx1MjI3RVwiLFwicHJ1cmVsXCI6XCJcXHUyMkIwXCIsXCJQc2NyXCI6XCJcXHVEODM1XFx1RENBQlwiLFwicHNjclwiOlwiXFx1RDgzNVxcdURDQzVcIixcIlBzaVwiOlwiXFx1MDNBOFwiLFwicHNpXCI6XCJcXHUwM0M4XCIsXCJwdW5jc3BcIjpcIlxcdTIwMDhcIixcIlFmclwiOlwiXFx1RDgzNVxcdUREMTRcIixcInFmclwiOlwiXFx1RDgzNVxcdUREMkVcIixcInFpbnRcIjpcIlxcdTJBMENcIixcInFvcGZcIjpcIlxcdUQ4MzVcXHVERDYyXCIsXCJRb3BmXCI6XCJcXHUyMTFBXCIsXCJxcHJpbWVcIjpcIlxcdTIwNTdcIixcIlFzY3JcIjpcIlxcdUQ4MzVcXHVEQ0FDXCIsXCJxc2NyXCI6XCJcXHVEODM1XFx1RENDNlwiLFwicXVhdGVybmlvbnNcIjpcIlxcdTIxMERcIixcInF1YXRpbnRcIjpcIlxcdTJBMTZcIixcInF1ZXN0XCI6XCI/XCIsXCJxdWVzdGVxXCI6XCJcXHUyMjVGXCIsXCJxdW90XCI6XCJcXFwiXCIsXCJRVU9UXCI6XCJcXFwiXCIsXCJyQWFyclwiOlwiXFx1MjFEQlwiLFwicmFjZVwiOlwiXFx1MjIzRFxcdTAzMzFcIixcIlJhY3V0ZVwiOlwiXFx1MDE1NFwiLFwicmFjdXRlXCI6XCJcXHUwMTU1XCIsXCJyYWRpY1wiOlwiXFx1MjIxQVwiLFwicmFlbXB0eXZcIjpcIlxcdTI5QjNcIixcInJhbmdcIjpcIlxcdTI3RTlcIixcIlJhbmdcIjpcIlxcdTI3RUJcIixcInJhbmdkXCI6XCJcXHUyOTkyXCIsXCJyYW5nZVwiOlwiXFx1MjlBNVwiLFwicmFuZ2xlXCI6XCJcXHUyN0U5XCIsXCJyYXF1b1wiOlwiXFx1MDBCQlwiLFwicmFycmFwXCI6XCJcXHUyOTc1XCIsXCJyYXJyYlwiOlwiXFx1MjFFNVwiLFwicmFycmJmc1wiOlwiXFx1MjkyMFwiLFwicmFycmNcIjpcIlxcdTI5MzNcIixcInJhcnJcIjpcIlxcdTIxOTJcIixcIlJhcnJcIjpcIlxcdTIxQTBcIixcInJBcnJcIjpcIlxcdTIxRDJcIixcInJhcnJmc1wiOlwiXFx1MjkxRVwiLFwicmFycmhrXCI6XCJcXHUyMUFBXCIsXCJyYXJybHBcIjpcIlxcdTIxQUNcIixcInJhcnJwbFwiOlwiXFx1Mjk0NVwiLFwicmFycnNpbVwiOlwiXFx1Mjk3NFwiLFwiUmFycnRsXCI6XCJcXHUyOTE2XCIsXCJyYXJydGxcIjpcIlxcdTIxQTNcIixcInJhcnJ3XCI6XCJcXHUyMTlEXCIsXCJyYXRhaWxcIjpcIlxcdTI5MUFcIixcInJBdGFpbFwiOlwiXFx1MjkxQ1wiLFwicmF0aW9cIjpcIlxcdTIyMzZcIixcInJhdGlvbmFsc1wiOlwiXFx1MjExQVwiLFwicmJhcnJcIjpcIlxcdTI5MERcIixcInJCYXJyXCI6XCJcXHUyOTBGXCIsXCJSQmFyclwiOlwiXFx1MjkxMFwiLFwicmJicmtcIjpcIlxcdTI3NzNcIixcInJicmFjZVwiOlwifVwiLFwicmJyYWNrXCI6XCJdXCIsXCJyYnJrZVwiOlwiXFx1Mjk4Q1wiLFwicmJya3NsZFwiOlwiXFx1Mjk4RVwiLFwicmJya3NsdVwiOlwiXFx1Mjk5MFwiLFwiUmNhcm9uXCI6XCJcXHUwMTU4XCIsXCJyY2Fyb25cIjpcIlxcdTAxNTlcIixcIlJjZWRpbFwiOlwiXFx1MDE1NlwiLFwicmNlZGlsXCI6XCJcXHUwMTU3XCIsXCJyY2VpbFwiOlwiXFx1MjMwOVwiLFwicmN1YlwiOlwifVwiLFwiUmN5XCI6XCJcXHUwNDIwXCIsXCJyY3lcIjpcIlxcdTA0NDBcIixcInJkY2FcIjpcIlxcdTI5MzdcIixcInJkbGRoYXJcIjpcIlxcdTI5NjlcIixcInJkcXVvXCI6XCJcXHUyMDFEXCIsXCJyZHF1b3JcIjpcIlxcdTIwMURcIixcInJkc2hcIjpcIlxcdTIxQjNcIixcInJlYWxcIjpcIlxcdTIxMUNcIixcInJlYWxpbmVcIjpcIlxcdTIxMUJcIixcInJlYWxwYXJ0XCI6XCJcXHUyMTFDXCIsXCJyZWFsc1wiOlwiXFx1MjExRFwiLFwiUmVcIjpcIlxcdTIxMUNcIixcInJlY3RcIjpcIlxcdTI1QURcIixcInJlZ1wiOlwiXFx1MDBBRVwiLFwiUkVHXCI6XCJcXHUwMEFFXCIsXCJSZXZlcnNlRWxlbWVudFwiOlwiXFx1MjIwQlwiLFwiUmV2ZXJzZUVxdWlsaWJyaXVtXCI6XCJcXHUyMUNCXCIsXCJSZXZlcnNlVXBFcXVpbGlicml1bVwiOlwiXFx1Mjk2RlwiLFwicmZpc2h0XCI6XCJcXHUyOTdEXCIsXCJyZmxvb3JcIjpcIlxcdTIzMEJcIixcInJmclwiOlwiXFx1RDgzNVxcdUREMkZcIixcIlJmclwiOlwiXFx1MjExQ1wiLFwickhhclwiOlwiXFx1Mjk2NFwiLFwicmhhcmRcIjpcIlxcdTIxQzFcIixcInJoYXJ1XCI6XCJcXHUyMUMwXCIsXCJyaGFydWxcIjpcIlxcdTI5NkNcIixcIlJob1wiOlwiXFx1MDNBMVwiLFwicmhvXCI6XCJcXHUwM0MxXCIsXCJyaG92XCI6XCJcXHUwM0YxXCIsXCJSaWdodEFuZ2xlQnJhY2tldFwiOlwiXFx1MjdFOVwiLFwiUmlnaHRBcnJvd0JhclwiOlwiXFx1MjFFNVwiLFwicmlnaHRhcnJvd1wiOlwiXFx1MjE5MlwiLFwiUmlnaHRBcnJvd1wiOlwiXFx1MjE5MlwiLFwiUmlnaHRhcnJvd1wiOlwiXFx1MjFEMlwiLFwiUmlnaHRBcnJvd0xlZnRBcnJvd1wiOlwiXFx1MjFDNFwiLFwicmlnaHRhcnJvd3RhaWxcIjpcIlxcdTIxQTNcIixcIlJpZ2h0Q2VpbGluZ1wiOlwiXFx1MjMwOVwiLFwiUmlnaHREb3VibGVCcmFja2V0XCI6XCJcXHUyN0U3XCIsXCJSaWdodERvd25UZWVWZWN0b3JcIjpcIlxcdTI5NURcIixcIlJpZ2h0RG93blZlY3RvckJhclwiOlwiXFx1Mjk1NVwiLFwiUmlnaHREb3duVmVjdG9yXCI6XCJcXHUyMUMyXCIsXCJSaWdodEZsb29yXCI6XCJcXHUyMzBCXCIsXCJyaWdodGhhcnBvb25kb3duXCI6XCJcXHUyMUMxXCIsXCJyaWdodGhhcnBvb251cFwiOlwiXFx1MjFDMFwiLFwicmlnaHRsZWZ0YXJyb3dzXCI6XCJcXHUyMUM0XCIsXCJyaWdodGxlZnRoYXJwb29uc1wiOlwiXFx1MjFDQ1wiLFwicmlnaHRyaWdodGFycm93c1wiOlwiXFx1MjFDOVwiLFwicmlnaHRzcXVpZ2Fycm93XCI6XCJcXHUyMTlEXCIsXCJSaWdodFRlZUFycm93XCI6XCJcXHUyMUE2XCIsXCJSaWdodFRlZVwiOlwiXFx1MjJBMlwiLFwiUmlnaHRUZWVWZWN0b3JcIjpcIlxcdTI5NUJcIixcInJpZ2h0dGhyZWV0aW1lc1wiOlwiXFx1MjJDQ1wiLFwiUmlnaHRUcmlhbmdsZUJhclwiOlwiXFx1MjlEMFwiLFwiUmlnaHRUcmlhbmdsZVwiOlwiXFx1MjJCM1wiLFwiUmlnaHRUcmlhbmdsZUVxdWFsXCI6XCJcXHUyMkI1XCIsXCJSaWdodFVwRG93blZlY3RvclwiOlwiXFx1Mjk0RlwiLFwiUmlnaHRVcFRlZVZlY3RvclwiOlwiXFx1Mjk1Q1wiLFwiUmlnaHRVcFZlY3RvckJhclwiOlwiXFx1Mjk1NFwiLFwiUmlnaHRVcFZlY3RvclwiOlwiXFx1MjFCRVwiLFwiUmlnaHRWZWN0b3JCYXJcIjpcIlxcdTI5NTNcIixcIlJpZ2h0VmVjdG9yXCI6XCJcXHUyMUMwXCIsXCJyaW5nXCI6XCJcXHUwMkRBXCIsXCJyaXNpbmdkb3RzZXFcIjpcIlxcdTIyNTNcIixcInJsYXJyXCI6XCJcXHUyMUM0XCIsXCJybGhhclwiOlwiXFx1MjFDQ1wiLFwicmxtXCI6XCJcXHUyMDBGXCIsXCJybW91c3RhY2hlXCI6XCJcXHUyM0IxXCIsXCJybW91c3RcIjpcIlxcdTIzQjFcIixcInJubWlkXCI6XCJcXHUyQUVFXCIsXCJyb2FuZ1wiOlwiXFx1MjdFRFwiLFwicm9hcnJcIjpcIlxcdTIxRkVcIixcInJvYnJrXCI6XCJcXHUyN0U3XCIsXCJyb3BhclwiOlwiXFx1Mjk4NlwiLFwicm9wZlwiOlwiXFx1RDgzNVxcdURENjNcIixcIlJvcGZcIjpcIlxcdTIxMURcIixcInJvcGx1c1wiOlwiXFx1MkEyRVwiLFwicm90aW1lc1wiOlwiXFx1MkEzNVwiLFwiUm91bmRJbXBsaWVzXCI6XCJcXHUyOTcwXCIsXCJycGFyXCI6XCIpXCIsXCJycGFyZ3RcIjpcIlxcdTI5OTRcIixcInJwcG9saW50XCI6XCJcXHUyQTEyXCIsXCJycmFyclwiOlwiXFx1MjFDOVwiLFwiUnJpZ2h0YXJyb3dcIjpcIlxcdTIxREJcIixcInJzYXF1b1wiOlwiXFx1MjAzQVwiLFwicnNjclwiOlwiXFx1RDgzNVxcdURDQzdcIixcIlJzY3JcIjpcIlxcdTIxMUJcIixcInJzaFwiOlwiXFx1MjFCMVwiLFwiUnNoXCI6XCJcXHUyMUIxXCIsXCJyc3FiXCI6XCJdXCIsXCJyc3F1b1wiOlwiXFx1MjAxOVwiLFwicnNxdW9yXCI6XCJcXHUyMDE5XCIsXCJydGhyZWVcIjpcIlxcdTIyQ0NcIixcInJ0aW1lc1wiOlwiXFx1MjJDQVwiLFwicnRyaVwiOlwiXFx1MjVCOVwiLFwicnRyaWVcIjpcIlxcdTIyQjVcIixcInJ0cmlmXCI6XCJcXHUyNUI4XCIsXCJydHJpbHRyaVwiOlwiXFx1MjlDRVwiLFwiUnVsZURlbGF5ZWRcIjpcIlxcdTI5RjRcIixcInJ1bHVoYXJcIjpcIlxcdTI5NjhcIixcInJ4XCI6XCJcXHUyMTFFXCIsXCJTYWN1dGVcIjpcIlxcdTAxNUFcIixcInNhY3V0ZVwiOlwiXFx1MDE1QlwiLFwic2JxdW9cIjpcIlxcdTIwMUFcIixcInNjYXBcIjpcIlxcdTJBQjhcIixcIlNjYXJvblwiOlwiXFx1MDE2MFwiLFwic2Nhcm9uXCI6XCJcXHUwMTYxXCIsXCJTY1wiOlwiXFx1MkFCQ1wiLFwic2NcIjpcIlxcdTIyN0JcIixcInNjY3VlXCI6XCJcXHUyMjdEXCIsXCJzY2VcIjpcIlxcdTJBQjBcIixcInNjRVwiOlwiXFx1MkFCNFwiLFwiU2NlZGlsXCI6XCJcXHUwMTVFXCIsXCJzY2VkaWxcIjpcIlxcdTAxNUZcIixcIlNjaXJjXCI6XCJcXHUwMTVDXCIsXCJzY2lyY1wiOlwiXFx1MDE1RFwiLFwic2NuYXBcIjpcIlxcdTJBQkFcIixcInNjbkVcIjpcIlxcdTJBQjZcIixcInNjbnNpbVwiOlwiXFx1MjJFOVwiLFwic2Nwb2xpbnRcIjpcIlxcdTJBMTNcIixcInNjc2ltXCI6XCJcXHUyMjdGXCIsXCJTY3lcIjpcIlxcdTA0MjFcIixcInNjeVwiOlwiXFx1MDQ0MVwiLFwic2RvdGJcIjpcIlxcdTIyQTFcIixcInNkb3RcIjpcIlxcdTIyQzVcIixcInNkb3RlXCI6XCJcXHUyQTY2XCIsXCJzZWFyaGtcIjpcIlxcdTI5MjVcIixcInNlYXJyXCI6XCJcXHUyMTk4XCIsXCJzZUFyclwiOlwiXFx1MjFEOFwiLFwic2VhcnJvd1wiOlwiXFx1MjE5OFwiLFwic2VjdFwiOlwiXFx1MDBBN1wiLFwic2VtaVwiOlwiO1wiLFwic2Vzd2FyXCI6XCJcXHUyOTI5XCIsXCJzZXRtaW51c1wiOlwiXFx1MjIxNlwiLFwic2V0bW5cIjpcIlxcdTIyMTZcIixcInNleHRcIjpcIlxcdTI3MzZcIixcIlNmclwiOlwiXFx1RDgzNVxcdUREMTZcIixcInNmclwiOlwiXFx1RDgzNVxcdUREMzBcIixcInNmcm93blwiOlwiXFx1MjMyMlwiLFwic2hhcnBcIjpcIlxcdTI2NkZcIixcIlNIQ0hjeVwiOlwiXFx1MDQyOVwiLFwic2hjaGN5XCI6XCJcXHUwNDQ5XCIsXCJTSGN5XCI6XCJcXHUwNDI4XCIsXCJzaGN5XCI6XCJcXHUwNDQ4XCIsXCJTaG9ydERvd25BcnJvd1wiOlwiXFx1MjE5M1wiLFwiU2hvcnRMZWZ0QXJyb3dcIjpcIlxcdTIxOTBcIixcInNob3J0bWlkXCI6XCJcXHUyMjIzXCIsXCJzaG9ydHBhcmFsbGVsXCI6XCJcXHUyMjI1XCIsXCJTaG9ydFJpZ2h0QXJyb3dcIjpcIlxcdTIxOTJcIixcIlNob3J0VXBBcnJvd1wiOlwiXFx1MjE5MVwiLFwic2h5XCI6XCJcXHUwMEFEXCIsXCJTaWdtYVwiOlwiXFx1MDNBM1wiLFwic2lnbWFcIjpcIlxcdTAzQzNcIixcInNpZ21hZlwiOlwiXFx1MDNDMlwiLFwic2lnbWF2XCI6XCJcXHUwM0MyXCIsXCJzaW1cIjpcIlxcdTIyM0NcIixcInNpbWRvdFwiOlwiXFx1MkE2QVwiLFwic2ltZVwiOlwiXFx1MjI0M1wiLFwic2ltZXFcIjpcIlxcdTIyNDNcIixcInNpbWdcIjpcIlxcdTJBOUVcIixcInNpbWdFXCI6XCJcXHUyQUEwXCIsXCJzaW1sXCI6XCJcXHUyQTlEXCIsXCJzaW1sRVwiOlwiXFx1MkE5RlwiLFwic2ltbmVcIjpcIlxcdTIyNDZcIixcInNpbXBsdXNcIjpcIlxcdTJBMjRcIixcInNpbXJhcnJcIjpcIlxcdTI5NzJcIixcInNsYXJyXCI6XCJcXHUyMTkwXCIsXCJTbWFsbENpcmNsZVwiOlwiXFx1MjIxOFwiLFwic21hbGxzZXRtaW51c1wiOlwiXFx1MjIxNlwiLFwic21hc2hwXCI6XCJcXHUyQTMzXCIsXCJzbWVwYXJzbFwiOlwiXFx1MjlFNFwiLFwic21pZFwiOlwiXFx1MjIyM1wiLFwic21pbGVcIjpcIlxcdTIzMjNcIixcInNtdFwiOlwiXFx1MkFBQVwiLFwic210ZVwiOlwiXFx1MkFBQ1wiLFwic210ZXNcIjpcIlxcdTJBQUNcXHVGRTAwXCIsXCJTT0ZUY3lcIjpcIlxcdTA0MkNcIixcInNvZnRjeVwiOlwiXFx1MDQ0Q1wiLFwic29sYmFyXCI6XCJcXHUyMzNGXCIsXCJzb2xiXCI6XCJcXHUyOUM0XCIsXCJzb2xcIjpcIi9cIixcIlNvcGZcIjpcIlxcdUQ4MzVcXHVERDRBXCIsXCJzb3BmXCI6XCJcXHVEODM1XFx1REQ2NFwiLFwic3BhZGVzXCI6XCJcXHUyNjYwXCIsXCJzcGFkZXN1aXRcIjpcIlxcdTI2NjBcIixcInNwYXJcIjpcIlxcdTIyMjVcIixcInNxY2FwXCI6XCJcXHUyMjkzXCIsXCJzcWNhcHNcIjpcIlxcdTIyOTNcXHVGRTAwXCIsXCJzcWN1cFwiOlwiXFx1MjI5NFwiLFwic3FjdXBzXCI6XCJcXHUyMjk0XFx1RkUwMFwiLFwiU3FydFwiOlwiXFx1MjIxQVwiLFwic3FzdWJcIjpcIlxcdTIyOEZcIixcInNxc3ViZVwiOlwiXFx1MjI5MVwiLFwic3FzdWJzZXRcIjpcIlxcdTIyOEZcIixcInNxc3Vic2V0ZXFcIjpcIlxcdTIyOTFcIixcInNxc3VwXCI6XCJcXHUyMjkwXCIsXCJzcXN1cGVcIjpcIlxcdTIyOTJcIixcInNxc3Vwc2V0XCI6XCJcXHUyMjkwXCIsXCJzcXN1cHNldGVxXCI6XCJcXHUyMjkyXCIsXCJzcXVhcmVcIjpcIlxcdTI1QTFcIixcIlNxdWFyZVwiOlwiXFx1MjVBMVwiLFwiU3F1YXJlSW50ZXJzZWN0aW9uXCI6XCJcXHUyMjkzXCIsXCJTcXVhcmVTdWJzZXRcIjpcIlxcdTIyOEZcIixcIlNxdWFyZVN1YnNldEVxdWFsXCI6XCJcXHUyMjkxXCIsXCJTcXVhcmVTdXBlcnNldFwiOlwiXFx1MjI5MFwiLFwiU3F1YXJlU3VwZXJzZXRFcXVhbFwiOlwiXFx1MjI5MlwiLFwiU3F1YXJlVW5pb25cIjpcIlxcdTIyOTRcIixcInNxdWFyZlwiOlwiXFx1MjVBQVwiLFwic3F1XCI6XCJcXHUyNUExXCIsXCJzcXVmXCI6XCJcXHUyNUFBXCIsXCJzcmFyclwiOlwiXFx1MjE5MlwiLFwiU3NjclwiOlwiXFx1RDgzNVxcdURDQUVcIixcInNzY3JcIjpcIlxcdUQ4MzVcXHVEQ0M4XCIsXCJzc2V0bW5cIjpcIlxcdTIyMTZcIixcInNzbWlsZVwiOlwiXFx1MjMyM1wiLFwic3N0YXJmXCI6XCJcXHUyMkM2XCIsXCJTdGFyXCI6XCJcXHUyMkM2XCIsXCJzdGFyXCI6XCJcXHUyNjA2XCIsXCJzdGFyZlwiOlwiXFx1MjYwNVwiLFwic3RyYWlnaHRlcHNpbG9uXCI6XCJcXHUwM0Y1XCIsXCJzdHJhaWdodHBoaVwiOlwiXFx1MDNENVwiLFwic3RybnNcIjpcIlxcdTAwQUZcIixcInN1YlwiOlwiXFx1MjI4MlwiLFwiU3ViXCI6XCJcXHUyMkQwXCIsXCJzdWJkb3RcIjpcIlxcdTJBQkRcIixcInN1YkVcIjpcIlxcdTJBQzVcIixcInN1YmVcIjpcIlxcdTIyODZcIixcInN1YmVkb3RcIjpcIlxcdTJBQzNcIixcInN1Ym11bHRcIjpcIlxcdTJBQzFcIixcInN1Ym5FXCI6XCJcXHUyQUNCXCIsXCJzdWJuZVwiOlwiXFx1MjI4QVwiLFwic3VicGx1c1wiOlwiXFx1MkFCRlwiLFwic3VicmFyclwiOlwiXFx1Mjk3OVwiLFwic3Vic2V0XCI6XCJcXHUyMjgyXCIsXCJTdWJzZXRcIjpcIlxcdTIyRDBcIixcInN1YnNldGVxXCI6XCJcXHUyMjg2XCIsXCJzdWJzZXRlcXFcIjpcIlxcdTJBQzVcIixcIlN1YnNldEVxdWFsXCI6XCJcXHUyMjg2XCIsXCJzdWJzZXRuZXFcIjpcIlxcdTIyOEFcIixcInN1YnNldG5lcXFcIjpcIlxcdTJBQ0JcIixcInN1YnNpbVwiOlwiXFx1MkFDN1wiLFwic3Vic3ViXCI6XCJcXHUyQUQ1XCIsXCJzdWJzdXBcIjpcIlxcdTJBRDNcIixcInN1Y2NhcHByb3hcIjpcIlxcdTJBQjhcIixcInN1Y2NcIjpcIlxcdTIyN0JcIixcInN1Y2NjdXJseWVxXCI6XCJcXHUyMjdEXCIsXCJTdWNjZWVkc1wiOlwiXFx1MjI3QlwiLFwiU3VjY2VlZHNFcXVhbFwiOlwiXFx1MkFCMFwiLFwiU3VjY2VlZHNTbGFudEVxdWFsXCI6XCJcXHUyMjdEXCIsXCJTdWNjZWVkc1RpbGRlXCI6XCJcXHUyMjdGXCIsXCJzdWNjZXFcIjpcIlxcdTJBQjBcIixcInN1Y2NuYXBwcm94XCI6XCJcXHUyQUJBXCIsXCJzdWNjbmVxcVwiOlwiXFx1MkFCNlwiLFwic3VjY25zaW1cIjpcIlxcdTIyRTlcIixcInN1Y2NzaW1cIjpcIlxcdTIyN0ZcIixcIlN1Y2hUaGF0XCI6XCJcXHUyMjBCXCIsXCJzdW1cIjpcIlxcdTIyMTFcIixcIlN1bVwiOlwiXFx1MjIxMVwiLFwic3VuZ1wiOlwiXFx1MjY2QVwiLFwic3VwMVwiOlwiXFx1MDBCOVwiLFwic3VwMlwiOlwiXFx1MDBCMlwiLFwic3VwM1wiOlwiXFx1MDBCM1wiLFwic3VwXCI6XCJcXHUyMjgzXCIsXCJTdXBcIjpcIlxcdTIyRDFcIixcInN1cGRvdFwiOlwiXFx1MkFCRVwiLFwic3VwZHN1YlwiOlwiXFx1MkFEOFwiLFwic3VwRVwiOlwiXFx1MkFDNlwiLFwic3VwZVwiOlwiXFx1MjI4N1wiLFwic3VwZWRvdFwiOlwiXFx1MkFDNFwiLFwiU3VwZXJzZXRcIjpcIlxcdTIyODNcIixcIlN1cGVyc2V0RXF1YWxcIjpcIlxcdTIyODdcIixcInN1cGhzb2xcIjpcIlxcdTI3QzlcIixcInN1cGhzdWJcIjpcIlxcdTJBRDdcIixcInN1cGxhcnJcIjpcIlxcdTI5N0JcIixcInN1cG11bHRcIjpcIlxcdTJBQzJcIixcInN1cG5FXCI6XCJcXHUyQUNDXCIsXCJzdXBuZVwiOlwiXFx1MjI4QlwiLFwic3VwcGx1c1wiOlwiXFx1MkFDMFwiLFwic3Vwc2V0XCI6XCJcXHUyMjgzXCIsXCJTdXBzZXRcIjpcIlxcdTIyRDFcIixcInN1cHNldGVxXCI6XCJcXHUyMjg3XCIsXCJzdXBzZXRlcXFcIjpcIlxcdTJBQzZcIixcInN1cHNldG5lcVwiOlwiXFx1MjI4QlwiLFwic3Vwc2V0bmVxcVwiOlwiXFx1MkFDQ1wiLFwic3Vwc2ltXCI6XCJcXHUyQUM4XCIsXCJzdXBzdWJcIjpcIlxcdTJBRDRcIixcInN1cHN1cFwiOlwiXFx1MkFENlwiLFwic3dhcmhrXCI6XCJcXHUyOTI2XCIsXCJzd2FyclwiOlwiXFx1MjE5OVwiLFwic3dBcnJcIjpcIlxcdTIxRDlcIixcInN3YXJyb3dcIjpcIlxcdTIxOTlcIixcInN3bndhclwiOlwiXFx1MjkyQVwiLFwic3psaWdcIjpcIlxcdTAwREZcIixcIlRhYlwiOlwiXFx0XCIsXCJ0YXJnZXRcIjpcIlxcdTIzMTZcIixcIlRhdVwiOlwiXFx1MDNBNFwiLFwidGF1XCI6XCJcXHUwM0M0XCIsXCJ0YnJrXCI6XCJcXHUyM0I0XCIsXCJUY2Fyb25cIjpcIlxcdTAxNjRcIixcInRjYXJvblwiOlwiXFx1MDE2NVwiLFwiVGNlZGlsXCI6XCJcXHUwMTYyXCIsXCJ0Y2VkaWxcIjpcIlxcdTAxNjNcIixcIlRjeVwiOlwiXFx1MDQyMlwiLFwidGN5XCI6XCJcXHUwNDQyXCIsXCJ0ZG90XCI6XCJcXHUyMERCXCIsXCJ0ZWxyZWNcIjpcIlxcdTIzMTVcIixcIlRmclwiOlwiXFx1RDgzNVxcdUREMTdcIixcInRmclwiOlwiXFx1RDgzNVxcdUREMzFcIixcInRoZXJlNFwiOlwiXFx1MjIzNFwiLFwidGhlcmVmb3JlXCI6XCJcXHUyMjM0XCIsXCJUaGVyZWZvcmVcIjpcIlxcdTIyMzRcIixcIlRoZXRhXCI6XCJcXHUwMzk4XCIsXCJ0aGV0YVwiOlwiXFx1MDNCOFwiLFwidGhldGFzeW1cIjpcIlxcdTAzRDFcIixcInRoZXRhdlwiOlwiXFx1MDNEMVwiLFwidGhpY2thcHByb3hcIjpcIlxcdTIyNDhcIixcInRoaWNrc2ltXCI6XCJcXHUyMjNDXCIsXCJUaGlja1NwYWNlXCI6XCJcXHUyMDVGXFx1MjAwQVwiLFwiVGhpblNwYWNlXCI6XCJcXHUyMDA5XCIsXCJ0aGluc3BcIjpcIlxcdTIwMDlcIixcInRoa2FwXCI6XCJcXHUyMjQ4XCIsXCJ0aGtzaW1cIjpcIlxcdTIyM0NcIixcIlRIT1JOXCI6XCJcXHUwMERFXCIsXCJ0aG9yblwiOlwiXFx1MDBGRVwiLFwidGlsZGVcIjpcIlxcdTAyRENcIixcIlRpbGRlXCI6XCJcXHUyMjNDXCIsXCJUaWxkZUVxdWFsXCI6XCJcXHUyMjQzXCIsXCJUaWxkZUZ1bGxFcXVhbFwiOlwiXFx1MjI0NVwiLFwiVGlsZGVUaWxkZVwiOlwiXFx1MjI0OFwiLFwidGltZXNiYXJcIjpcIlxcdTJBMzFcIixcInRpbWVzYlwiOlwiXFx1MjJBMFwiLFwidGltZXNcIjpcIlxcdTAwRDdcIixcInRpbWVzZFwiOlwiXFx1MkEzMFwiLFwidGludFwiOlwiXFx1MjIyRFwiLFwidG9lYVwiOlwiXFx1MjkyOFwiLFwidG9wYm90XCI6XCJcXHUyMzM2XCIsXCJ0b3BjaXJcIjpcIlxcdTJBRjFcIixcInRvcFwiOlwiXFx1MjJBNFwiLFwiVG9wZlwiOlwiXFx1RDgzNVxcdURENEJcIixcInRvcGZcIjpcIlxcdUQ4MzVcXHVERDY1XCIsXCJ0b3Bmb3JrXCI6XCJcXHUyQURBXCIsXCJ0b3NhXCI6XCJcXHUyOTI5XCIsXCJ0cHJpbWVcIjpcIlxcdTIwMzRcIixcInRyYWRlXCI6XCJcXHUyMTIyXCIsXCJUUkFERVwiOlwiXFx1MjEyMlwiLFwidHJpYW5nbGVcIjpcIlxcdTI1QjVcIixcInRyaWFuZ2xlZG93blwiOlwiXFx1MjVCRlwiLFwidHJpYW5nbGVsZWZ0XCI6XCJcXHUyNUMzXCIsXCJ0cmlhbmdsZWxlZnRlcVwiOlwiXFx1MjJCNFwiLFwidHJpYW5nbGVxXCI6XCJcXHUyMjVDXCIsXCJ0cmlhbmdsZXJpZ2h0XCI6XCJcXHUyNUI5XCIsXCJ0cmlhbmdsZXJpZ2h0ZXFcIjpcIlxcdTIyQjVcIixcInRyaWRvdFwiOlwiXFx1MjVFQ1wiLFwidHJpZVwiOlwiXFx1MjI1Q1wiLFwidHJpbWludXNcIjpcIlxcdTJBM0FcIixcIlRyaXBsZURvdFwiOlwiXFx1MjBEQlwiLFwidHJpcGx1c1wiOlwiXFx1MkEzOVwiLFwidHJpc2JcIjpcIlxcdTI5Q0RcIixcInRyaXRpbWVcIjpcIlxcdTJBM0JcIixcInRycGV6aXVtXCI6XCJcXHUyM0UyXCIsXCJUc2NyXCI6XCJcXHVEODM1XFx1RENBRlwiLFwidHNjclwiOlwiXFx1RDgzNVxcdURDQzlcIixcIlRTY3lcIjpcIlxcdTA0MjZcIixcInRzY3lcIjpcIlxcdTA0NDZcIixcIlRTSGN5XCI6XCJcXHUwNDBCXCIsXCJ0c2hjeVwiOlwiXFx1MDQ1QlwiLFwiVHN0cm9rXCI6XCJcXHUwMTY2XCIsXCJ0c3Ryb2tcIjpcIlxcdTAxNjdcIixcInR3aXh0XCI6XCJcXHUyMjZDXCIsXCJ0d29oZWFkbGVmdGFycm93XCI6XCJcXHUyMTlFXCIsXCJ0d29oZWFkcmlnaHRhcnJvd1wiOlwiXFx1MjFBMFwiLFwiVWFjdXRlXCI6XCJcXHUwMERBXCIsXCJ1YWN1dGVcIjpcIlxcdTAwRkFcIixcInVhcnJcIjpcIlxcdTIxOTFcIixcIlVhcnJcIjpcIlxcdTIxOUZcIixcInVBcnJcIjpcIlxcdTIxRDFcIixcIlVhcnJvY2lyXCI6XCJcXHUyOTQ5XCIsXCJVYnJjeVwiOlwiXFx1MDQwRVwiLFwidWJyY3lcIjpcIlxcdTA0NUVcIixcIlVicmV2ZVwiOlwiXFx1MDE2Q1wiLFwidWJyZXZlXCI6XCJcXHUwMTZEXCIsXCJVY2lyY1wiOlwiXFx1MDBEQlwiLFwidWNpcmNcIjpcIlxcdTAwRkJcIixcIlVjeVwiOlwiXFx1MDQyM1wiLFwidWN5XCI6XCJcXHUwNDQzXCIsXCJ1ZGFyclwiOlwiXFx1MjFDNVwiLFwiVWRibGFjXCI6XCJcXHUwMTcwXCIsXCJ1ZGJsYWNcIjpcIlxcdTAxNzFcIixcInVkaGFyXCI6XCJcXHUyOTZFXCIsXCJ1ZmlzaHRcIjpcIlxcdTI5N0VcIixcIlVmclwiOlwiXFx1RDgzNVxcdUREMThcIixcInVmclwiOlwiXFx1RDgzNVxcdUREMzJcIixcIlVncmF2ZVwiOlwiXFx1MDBEOVwiLFwidWdyYXZlXCI6XCJcXHUwMEY5XCIsXCJ1SGFyXCI6XCJcXHUyOTYzXCIsXCJ1aGFybFwiOlwiXFx1MjFCRlwiLFwidWhhcnJcIjpcIlxcdTIxQkVcIixcInVoYmxrXCI6XCJcXHUyNTgwXCIsXCJ1bGNvcm5cIjpcIlxcdTIzMUNcIixcInVsY29ybmVyXCI6XCJcXHUyMzFDXCIsXCJ1bGNyb3BcIjpcIlxcdTIzMEZcIixcInVsdHJpXCI6XCJcXHUyNUY4XCIsXCJVbWFjclwiOlwiXFx1MDE2QVwiLFwidW1hY3JcIjpcIlxcdTAxNkJcIixcInVtbFwiOlwiXFx1MDBBOFwiLFwiVW5kZXJCYXJcIjpcIl9cIixcIlVuZGVyQnJhY2VcIjpcIlxcdTIzREZcIixcIlVuZGVyQnJhY2tldFwiOlwiXFx1MjNCNVwiLFwiVW5kZXJQYXJlbnRoZXNpc1wiOlwiXFx1MjNERFwiLFwiVW5pb25cIjpcIlxcdTIyQzNcIixcIlVuaW9uUGx1c1wiOlwiXFx1MjI4RVwiLFwiVW9nb25cIjpcIlxcdTAxNzJcIixcInVvZ29uXCI6XCJcXHUwMTczXCIsXCJVb3BmXCI6XCJcXHVEODM1XFx1REQ0Q1wiLFwidW9wZlwiOlwiXFx1RDgzNVxcdURENjZcIixcIlVwQXJyb3dCYXJcIjpcIlxcdTI5MTJcIixcInVwYXJyb3dcIjpcIlxcdTIxOTFcIixcIlVwQXJyb3dcIjpcIlxcdTIxOTFcIixcIlVwYXJyb3dcIjpcIlxcdTIxRDFcIixcIlVwQXJyb3dEb3duQXJyb3dcIjpcIlxcdTIxQzVcIixcInVwZG93bmFycm93XCI6XCJcXHUyMTk1XCIsXCJVcERvd25BcnJvd1wiOlwiXFx1MjE5NVwiLFwiVXBkb3duYXJyb3dcIjpcIlxcdTIxRDVcIixcIlVwRXF1aWxpYnJpdW1cIjpcIlxcdTI5NkVcIixcInVwaGFycG9vbmxlZnRcIjpcIlxcdTIxQkZcIixcInVwaGFycG9vbnJpZ2h0XCI6XCJcXHUyMUJFXCIsXCJ1cGx1c1wiOlwiXFx1MjI4RVwiLFwiVXBwZXJMZWZ0QXJyb3dcIjpcIlxcdTIxOTZcIixcIlVwcGVyUmlnaHRBcnJvd1wiOlwiXFx1MjE5N1wiLFwidXBzaVwiOlwiXFx1MDNDNVwiLFwiVXBzaVwiOlwiXFx1MDNEMlwiLFwidXBzaWhcIjpcIlxcdTAzRDJcIixcIlVwc2lsb25cIjpcIlxcdTAzQTVcIixcInVwc2lsb25cIjpcIlxcdTAzQzVcIixcIlVwVGVlQXJyb3dcIjpcIlxcdTIxQTVcIixcIlVwVGVlXCI6XCJcXHUyMkE1XCIsXCJ1cHVwYXJyb3dzXCI6XCJcXHUyMUM4XCIsXCJ1cmNvcm5cIjpcIlxcdTIzMURcIixcInVyY29ybmVyXCI6XCJcXHUyMzFEXCIsXCJ1cmNyb3BcIjpcIlxcdTIzMEVcIixcIlVyaW5nXCI6XCJcXHUwMTZFXCIsXCJ1cmluZ1wiOlwiXFx1MDE2RlwiLFwidXJ0cmlcIjpcIlxcdTI1RjlcIixcIlVzY3JcIjpcIlxcdUQ4MzVcXHVEQ0IwXCIsXCJ1c2NyXCI6XCJcXHVEODM1XFx1RENDQVwiLFwidXRkb3RcIjpcIlxcdTIyRjBcIixcIlV0aWxkZVwiOlwiXFx1MDE2OFwiLFwidXRpbGRlXCI6XCJcXHUwMTY5XCIsXCJ1dHJpXCI6XCJcXHUyNUI1XCIsXCJ1dHJpZlwiOlwiXFx1MjVCNFwiLFwidXVhcnJcIjpcIlxcdTIxQzhcIixcIlV1bWxcIjpcIlxcdTAwRENcIixcInV1bWxcIjpcIlxcdTAwRkNcIixcInV3YW5nbGVcIjpcIlxcdTI5QTdcIixcInZhbmdydFwiOlwiXFx1Mjk5Q1wiLFwidmFyZXBzaWxvblwiOlwiXFx1MDNGNVwiLFwidmFya2FwcGFcIjpcIlxcdTAzRjBcIixcInZhcm5vdGhpbmdcIjpcIlxcdTIyMDVcIixcInZhcnBoaVwiOlwiXFx1MDNENVwiLFwidmFycGlcIjpcIlxcdTAzRDZcIixcInZhcnByb3B0b1wiOlwiXFx1MjIxRFwiLFwidmFyclwiOlwiXFx1MjE5NVwiLFwidkFyclwiOlwiXFx1MjFENVwiLFwidmFycmhvXCI6XCJcXHUwM0YxXCIsXCJ2YXJzaWdtYVwiOlwiXFx1MDNDMlwiLFwidmFyc3Vic2V0bmVxXCI6XCJcXHUyMjhBXFx1RkUwMFwiLFwidmFyc3Vic2V0bmVxcVwiOlwiXFx1MkFDQlxcdUZFMDBcIixcInZhcnN1cHNldG5lcVwiOlwiXFx1MjI4QlxcdUZFMDBcIixcInZhcnN1cHNldG5lcXFcIjpcIlxcdTJBQ0NcXHVGRTAwXCIsXCJ2YXJ0aGV0YVwiOlwiXFx1MDNEMVwiLFwidmFydHJpYW5nbGVsZWZ0XCI6XCJcXHUyMkIyXCIsXCJ2YXJ0cmlhbmdsZXJpZ2h0XCI6XCJcXHUyMkIzXCIsXCJ2QmFyXCI6XCJcXHUyQUU4XCIsXCJWYmFyXCI6XCJcXHUyQUVCXCIsXCJ2QmFydlwiOlwiXFx1MkFFOVwiLFwiVmN5XCI6XCJcXHUwNDEyXCIsXCJ2Y3lcIjpcIlxcdTA0MzJcIixcInZkYXNoXCI6XCJcXHUyMkEyXCIsXCJ2RGFzaFwiOlwiXFx1MjJBOFwiLFwiVmRhc2hcIjpcIlxcdTIyQTlcIixcIlZEYXNoXCI6XCJcXHUyMkFCXCIsXCJWZGFzaGxcIjpcIlxcdTJBRTZcIixcInZlZWJhclwiOlwiXFx1MjJCQlwiLFwidmVlXCI6XCJcXHUyMjI4XCIsXCJWZWVcIjpcIlxcdTIyQzFcIixcInZlZWVxXCI6XCJcXHUyMjVBXCIsXCJ2ZWxsaXBcIjpcIlxcdTIyRUVcIixcInZlcmJhclwiOlwifFwiLFwiVmVyYmFyXCI6XCJcXHUyMDE2XCIsXCJ2ZXJ0XCI6XCJ8XCIsXCJWZXJ0XCI6XCJcXHUyMDE2XCIsXCJWZXJ0aWNhbEJhclwiOlwiXFx1MjIyM1wiLFwiVmVydGljYWxMaW5lXCI6XCJ8XCIsXCJWZXJ0aWNhbFNlcGFyYXRvclwiOlwiXFx1Mjc1OFwiLFwiVmVydGljYWxUaWxkZVwiOlwiXFx1MjI0MFwiLFwiVmVyeVRoaW5TcGFjZVwiOlwiXFx1MjAwQVwiLFwiVmZyXCI6XCJcXHVEODM1XFx1REQxOVwiLFwidmZyXCI6XCJcXHVEODM1XFx1REQzM1wiLFwidmx0cmlcIjpcIlxcdTIyQjJcIixcInZuc3ViXCI6XCJcXHUyMjgyXFx1MjBEMlwiLFwidm5zdXBcIjpcIlxcdTIyODNcXHUyMEQyXCIsXCJWb3BmXCI6XCJcXHVEODM1XFx1REQ0RFwiLFwidm9wZlwiOlwiXFx1RDgzNVxcdURENjdcIixcInZwcm9wXCI6XCJcXHUyMjFEXCIsXCJ2cnRyaVwiOlwiXFx1MjJCM1wiLFwiVnNjclwiOlwiXFx1RDgzNVxcdURDQjFcIixcInZzY3JcIjpcIlxcdUQ4MzVcXHVEQ0NCXCIsXCJ2c3VibkVcIjpcIlxcdTJBQ0JcXHVGRTAwXCIsXCJ2c3VibmVcIjpcIlxcdTIyOEFcXHVGRTAwXCIsXCJ2c3VwbkVcIjpcIlxcdTJBQ0NcXHVGRTAwXCIsXCJ2c3VwbmVcIjpcIlxcdTIyOEJcXHVGRTAwXCIsXCJWdmRhc2hcIjpcIlxcdTIyQUFcIixcInZ6aWd6YWdcIjpcIlxcdTI5OUFcIixcIldjaXJjXCI6XCJcXHUwMTc0XCIsXCJ3Y2lyY1wiOlwiXFx1MDE3NVwiLFwid2VkYmFyXCI6XCJcXHUyQTVGXCIsXCJ3ZWRnZVwiOlwiXFx1MjIyN1wiLFwiV2VkZ2VcIjpcIlxcdTIyQzBcIixcIndlZGdlcVwiOlwiXFx1MjI1OVwiLFwid2VpZXJwXCI6XCJcXHUyMTE4XCIsXCJXZnJcIjpcIlxcdUQ4MzVcXHVERDFBXCIsXCJ3ZnJcIjpcIlxcdUQ4MzVcXHVERDM0XCIsXCJXb3BmXCI6XCJcXHVEODM1XFx1REQ0RVwiLFwid29wZlwiOlwiXFx1RDgzNVxcdURENjhcIixcIndwXCI6XCJcXHUyMTE4XCIsXCJ3clwiOlwiXFx1MjI0MFwiLFwid3JlYXRoXCI6XCJcXHUyMjQwXCIsXCJXc2NyXCI6XCJcXHVEODM1XFx1RENCMlwiLFwid3NjclwiOlwiXFx1RDgzNVxcdURDQ0NcIixcInhjYXBcIjpcIlxcdTIyQzJcIixcInhjaXJjXCI6XCJcXHUyNUVGXCIsXCJ4Y3VwXCI6XCJcXHUyMkMzXCIsXCJ4ZHRyaVwiOlwiXFx1MjVCRFwiLFwiWGZyXCI6XCJcXHVEODM1XFx1REQxQlwiLFwieGZyXCI6XCJcXHVEODM1XFx1REQzNVwiLFwieGhhcnJcIjpcIlxcdTI3RjdcIixcInhoQXJyXCI6XCJcXHUyN0ZBXCIsXCJYaVwiOlwiXFx1MDM5RVwiLFwieGlcIjpcIlxcdTAzQkVcIixcInhsYXJyXCI6XCJcXHUyN0Y1XCIsXCJ4bEFyclwiOlwiXFx1MjdGOFwiLFwieG1hcFwiOlwiXFx1MjdGQ1wiLFwieG5pc1wiOlwiXFx1MjJGQlwiLFwieG9kb3RcIjpcIlxcdTJBMDBcIixcIlhvcGZcIjpcIlxcdUQ4MzVcXHVERDRGXCIsXCJ4b3BmXCI6XCJcXHVEODM1XFx1REQ2OVwiLFwieG9wbHVzXCI6XCJcXHUyQTAxXCIsXCJ4b3RpbWVcIjpcIlxcdTJBMDJcIixcInhyYXJyXCI6XCJcXHUyN0Y2XCIsXCJ4ckFyclwiOlwiXFx1MjdGOVwiLFwiWHNjclwiOlwiXFx1RDgzNVxcdURDQjNcIixcInhzY3JcIjpcIlxcdUQ4MzVcXHVEQ0NEXCIsXCJ4c3FjdXBcIjpcIlxcdTJBMDZcIixcInh1cGx1c1wiOlwiXFx1MkEwNFwiLFwieHV0cmlcIjpcIlxcdTI1QjNcIixcInh2ZWVcIjpcIlxcdTIyQzFcIixcInh3ZWRnZVwiOlwiXFx1MjJDMFwiLFwiWWFjdXRlXCI6XCJcXHUwMEREXCIsXCJ5YWN1dGVcIjpcIlxcdTAwRkRcIixcIllBY3lcIjpcIlxcdTA0MkZcIixcInlhY3lcIjpcIlxcdTA0NEZcIixcIlljaXJjXCI6XCJcXHUwMTc2XCIsXCJ5Y2lyY1wiOlwiXFx1MDE3N1wiLFwiWWN5XCI6XCJcXHUwNDJCXCIsXCJ5Y3lcIjpcIlxcdTA0NEJcIixcInllblwiOlwiXFx1MDBBNVwiLFwiWWZyXCI6XCJcXHVEODM1XFx1REQxQ1wiLFwieWZyXCI6XCJcXHVEODM1XFx1REQzNlwiLFwiWUljeVwiOlwiXFx1MDQwN1wiLFwieWljeVwiOlwiXFx1MDQ1N1wiLFwiWW9wZlwiOlwiXFx1RDgzNVxcdURENTBcIixcInlvcGZcIjpcIlxcdUQ4MzVcXHVERDZBXCIsXCJZc2NyXCI6XCJcXHVEODM1XFx1RENCNFwiLFwieXNjclwiOlwiXFx1RDgzNVxcdURDQ0VcIixcIllVY3lcIjpcIlxcdTA0MkVcIixcInl1Y3lcIjpcIlxcdTA0NEVcIixcInl1bWxcIjpcIlxcdTAwRkZcIixcIll1bWxcIjpcIlxcdTAxNzhcIixcIlphY3V0ZVwiOlwiXFx1MDE3OVwiLFwiemFjdXRlXCI6XCJcXHUwMTdBXCIsXCJaY2Fyb25cIjpcIlxcdTAxN0RcIixcInpjYXJvblwiOlwiXFx1MDE3RVwiLFwiWmN5XCI6XCJcXHUwNDE3XCIsXCJ6Y3lcIjpcIlxcdTA0MzdcIixcIlpkb3RcIjpcIlxcdTAxN0JcIixcInpkb3RcIjpcIlxcdTAxN0NcIixcInplZXRyZlwiOlwiXFx1MjEyOFwiLFwiWmVyb1dpZHRoU3BhY2VcIjpcIlxcdTIwMEJcIixcIlpldGFcIjpcIlxcdTAzOTZcIixcInpldGFcIjpcIlxcdTAzQjZcIixcInpmclwiOlwiXFx1RDgzNVxcdUREMzdcIixcIlpmclwiOlwiXFx1MjEyOFwiLFwiWkhjeVwiOlwiXFx1MDQxNlwiLFwiemhjeVwiOlwiXFx1MDQzNlwiLFwiemlncmFyclwiOlwiXFx1MjFERFwiLFwiem9wZlwiOlwiXFx1RDgzNVxcdURENkJcIixcIlpvcGZcIjpcIlxcdTIxMjRcIixcIlpzY3JcIjpcIlxcdUQ4MzVcXHVEQ0I1XCIsXCJ6c2NyXCI6XCJcXHVEODM1XFx1RENDRlwiLFwiendqXCI6XCJcXHUyMDBEXCIsXCJ6d25qXCI6XCJcXHUyMDBDXCJ9IiwiJ3VzZSBzdHJpY3QnO1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBIZWxwZXJzXG5cbi8vIE1lcmdlIG9iamVjdHNcbi8vXG5mdW5jdGlvbiBhc3NpZ24ob2JqIC8qZnJvbTEsIGZyb20yLCBmcm9tMywgLi4uKi8pIHtcbiAgdmFyIHNvdXJjZXMgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuXG4gIHNvdXJjZXMuZm9yRWFjaChmdW5jdGlvbiAoc291cmNlKSB7XG4gICAgaWYgKCFzb3VyY2UpIHsgcmV0dXJuOyB9XG5cbiAgICBPYmplY3Qua2V5cyhzb3VyY2UpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgb2JqW2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIG9iajtcbn1cblxuZnVuY3Rpb24gX2NsYXNzKG9iaikgeyByZXR1cm4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKG9iaik7IH1cbmZ1bmN0aW9uIGlzU3RyaW5nKG9iaikgeyByZXR1cm4gX2NsYXNzKG9iaikgPT09ICdbb2JqZWN0IFN0cmluZ10nOyB9XG5mdW5jdGlvbiBpc09iamVjdChvYmopIHsgcmV0dXJuIF9jbGFzcyhvYmopID09PSAnW29iamVjdCBPYmplY3RdJzsgfVxuZnVuY3Rpb24gaXNSZWdFeHAob2JqKSB7IHJldHVybiBfY2xhc3Mob2JqKSA9PT0gJ1tvYmplY3QgUmVnRXhwXSc7IH1cbmZ1bmN0aW9uIGlzRnVuY3Rpb24ob2JqKSB7IHJldHVybiBfY2xhc3Mob2JqKSA9PT0gJ1tvYmplY3QgRnVuY3Rpb25dJzsgfVxuXG5cbmZ1bmN0aW9uIGVzY2FwZVJFIChzdHIpIHsgcmV0dXJuIHN0ci5yZXBsYWNlKC9bLj8qK14kW1xcXVxcXFwoKXt9fC1dL2csICdcXFxcJCYnKTsgfVxuXG4vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vL1xuXG5cbnZhciBkZWZhdWx0T3B0aW9ucyA9IHtcbiAgZnV6enlMaW5rOiB0cnVlLFxuICBmdXp6eUVtYWlsOiB0cnVlLFxuICBmdXp6eUlQOiBmYWxzZVxufTtcblxuXG5mdW5jdGlvbiBpc09wdGlvbnNPYmoob2JqKSB7XG4gIHJldHVybiBPYmplY3Qua2V5cyhvYmogfHwge30pLnJlZHVjZShmdW5jdGlvbiAoYWNjLCBrKSB7XG4gICAgcmV0dXJuIGFjYyB8fCBkZWZhdWx0T3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShrKTtcbiAgfSwgZmFsc2UpO1xufVxuXG5cbnZhciBkZWZhdWx0U2NoZW1hcyA9IHtcbiAgJ2h0dHA6Jzoge1xuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAodGV4dCwgcG9zLCBzZWxmKSB7XG4gICAgICB2YXIgdGFpbCA9IHRleHQuc2xpY2UocG9zKTtcblxuICAgICAgaWYgKCFzZWxmLnJlLmh0dHApIHtcbiAgICAgICAgLy8gY29tcGlsZSBsYXppbHksIGJlY2F1c2UgXCJob3N0XCItY29udGFpbmluZyB2YXJpYWJsZXMgY2FuIGNoYW5nZSBvbiB0bGRzIHVwZGF0ZS5cbiAgICAgICAgc2VsZi5yZS5odHRwID0gIG5ldyBSZWdFeHAoXG4gICAgICAgICAgJ15cXFxcL1xcXFwvJyArIHNlbGYucmUuc3JjX2F1dGggKyBzZWxmLnJlLnNyY19ob3N0X3BvcnRfc3RyaWN0ICsgc2VsZi5yZS5zcmNfcGF0aCwgJ2knXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoc2VsZi5yZS5odHRwLnRlc3QodGFpbCkpIHtcbiAgICAgICAgcmV0dXJuIHRhaWwubWF0Y2goc2VsZi5yZS5odHRwKVswXS5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH0sXG4gICdodHRwczonOiAgJ2h0dHA6JyxcbiAgJ2Z0cDonOiAgICAnaHR0cDonLFxuICAnLy8nOiAgICAgIHtcbiAgICB2YWxpZGF0ZTogZnVuY3Rpb24gKHRleHQsIHBvcywgc2VsZikge1xuICAgICAgdmFyIHRhaWwgPSB0ZXh0LnNsaWNlKHBvcyk7XG5cbiAgICAgIGlmICghc2VsZi5yZS5ub19odHRwKSB7XG4gICAgICAvLyBjb21waWxlIGxhemlseSwgYmVjYXlzZSBcImhvc3RcIi1jb250YWluaW5nIHZhcmlhYmxlcyBjYW4gY2hhbmdlIG9uIHRsZHMgdXBkYXRlLlxuICAgICAgICBzZWxmLnJlLm5vX2h0dHAgPSAgbmV3IFJlZ0V4cChcbiAgICAgICAgICAnXicgKyBzZWxmLnJlLnNyY19hdXRoICsgc2VsZi5yZS5zcmNfaG9zdF9wb3J0X3N0cmljdCArIHNlbGYucmUuc3JjX3BhdGgsICdpJ1xuICAgICAgICApO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5yZS5ub19odHRwLnRlc3QodGFpbCkpIHtcbiAgICAgICAgLy8gc2hvdWxkIG5vdCBiZSBgOi8vYCwgdGhhdCBwcm90ZWN0cyBmcm9tIGVycm9ycyBpbiBwcm90b2NvbCBuYW1lXG4gICAgICAgIGlmIChwb3MgPj0gMyAmJiB0ZXh0W3BvcyAtIDNdID09PSAnOicpIHsgcmV0dXJuIDA7IH1cbiAgICAgICAgcmV0dXJuIHRhaWwubWF0Y2goc2VsZi5yZS5ub19odHRwKVswXS5sZW5ndGg7XG4gICAgICB9XG4gICAgICByZXR1cm4gMDtcbiAgICB9XG4gIH0sXG4gICdtYWlsdG86Jzoge1xuICAgIHZhbGlkYXRlOiBmdW5jdGlvbiAodGV4dCwgcG9zLCBzZWxmKSB7XG4gICAgICB2YXIgdGFpbCA9IHRleHQuc2xpY2UocG9zKTtcblxuICAgICAgaWYgKCFzZWxmLnJlLm1haWx0bykge1xuICAgICAgICBzZWxmLnJlLm1haWx0byA9ICBuZXcgUmVnRXhwKFxuICAgICAgICAgICdeJyArIHNlbGYucmUuc3JjX2VtYWlsX25hbWUgKyAnQCcgKyBzZWxmLnJlLnNyY19ob3N0X3N0cmljdCwgJ2knXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBpZiAoc2VsZi5yZS5tYWlsdG8udGVzdCh0YWlsKSkge1xuICAgICAgICByZXR1cm4gdGFpbC5tYXRjaChzZWxmLnJlLm1haWx0bylbMF0ubGVuZ3RoO1xuICAgICAgfVxuICAgICAgcmV0dXJuIDA7XG4gICAgfVxuICB9XG59O1xuXG4vKmVzbGludC1kaXNhYmxlIG1heC1sZW4qL1xuXG4vLyBSRSBwYXR0ZXJuIGZvciAyLWNoYXJhY3RlciB0bGRzIChhdXRvZ2VuZXJhdGVkIGJ5IC4vc3VwcG9ydC90bGRzXzJjaGFyX2dlbi5qcylcbnZhciB0bGRzXzJjaF9zcmNfcmUgPSAnYVtjZGVmZ2lsbW5vcXJzdHV3eHpdfGJbYWJkZWZnaGlqbW5vcnN0dnd5el18Y1thY2RmZ2hpa2xtbm9ydXZ3eHl6XXxkW2Vqa21vel18ZVtjZWdyc3R1XXxmW2lqa21vcl18Z1thYmRlZmdoaWxtbnBxcnN0dXd5XXxoW2ttbnJ0dV18aVtkZWxtbm9xcnN0XXxqW2Vtb3BdfGtbZWdoaW1ucHJ3eXpdfGxbYWJjaWtyc3R1dnldfG1bYWNkZWdoa2xtbm9wcXJzdHV2d3h5el18blthY2VmZ2lsb3BydXpdfG9tfHBbYWVmZ2hrbG1ucnN0d3ldfHFhfHJbZW9zdXddfHNbYWJjZGVnaGlqa2xtbm9ydHV2eHl6XXx0W2NkZmdoamtsbW5vcnR2d3pdfHVbYWdrc3l6XXx2W2FjZWdpbnVdfHdbZnNdfHlbZXRdfHpbYW13XSc7XG5cbi8vIERPTidUIHRyeSB0byBtYWtlIFBScyB3aXRoIGNoYW5nZXMuIEV4dGVuZCBUTERzIHdpdGggTGlua2lmeUl0LnRsZHMoKSBpbnN0ZWFkXG52YXIgdGxkc19kZWZhdWx0ID0gJ2Jpenxjb218ZWR1fGdvdnxuZXR8b3JnfHByb3x3ZWJ8eHh4fGFlcm98YXNpYXxjb29wfGluZm98bXVzZXVtfG5hbWV8c2hvcHzRgNGEJy5zcGxpdCgnfCcpO1xuXG4vKmVzbGludC1lbmFibGUgbWF4LWxlbiovXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG5cbmZ1bmN0aW9uIHJlc2V0U2NhbkNhY2hlKHNlbGYpIHtcbiAgc2VsZi5fX2luZGV4X18gPSAtMTtcbiAgc2VsZi5fX3RleHRfY2FjaGVfXyAgID0gJyc7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVZhbGlkYXRvcihyZSkge1xuICByZXR1cm4gZnVuY3Rpb24gKHRleHQsIHBvcykge1xuICAgIHZhciB0YWlsID0gdGV4dC5zbGljZShwb3MpO1xuXG4gICAgaWYgKHJlLnRlc3QodGFpbCkpIHtcbiAgICAgIHJldHVybiB0YWlsLm1hdGNoKHJlKVswXS5sZW5ndGg7XG4gICAgfVxuICAgIHJldHVybiAwO1xuICB9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVOb3JtYWxpemVyKCkge1xuICByZXR1cm4gZnVuY3Rpb24gKG1hdGNoLCBzZWxmKSB7XG4gICAgc2VsZi5ub3JtYWxpemUobWF0Y2gpO1xuICB9O1xufVxuXG4vLyBTY2hlbWFzIGNvbXBpbGVyLiBCdWlsZCByZWdleHBzLlxuLy9cbmZ1bmN0aW9uIGNvbXBpbGUoc2VsZikge1xuXG4gIC8vIExvYWQgJiBjbG9uZSBSRSBwYXR0ZXJucy5cbiAgdmFyIHJlID0gc2VsZi5yZSA9IGFzc2lnbih7fSwgcmVxdWlyZSgnLi9saWIvcmUnKSk7XG5cbiAgLy8gRGVmaW5lIGR5bmFtaWMgcGF0dGVybnNcbiAgdmFyIHRsZHMgPSBzZWxmLl9fdGxkc19fLnNsaWNlKCk7XG5cbiAgaWYgKCFzZWxmLl9fdGxkc19yZXBsYWNlZF9fKSB7XG4gICAgdGxkcy5wdXNoKHRsZHNfMmNoX3NyY19yZSk7XG4gIH1cbiAgdGxkcy5wdXNoKHJlLnNyY194bik7XG5cbiAgcmUuc3JjX3RsZHMgPSB0bGRzLmpvaW4oJ3wnKTtcblxuICBmdW5jdGlvbiB1bnRwbCh0cGwpIHsgcmV0dXJuIHRwbC5yZXBsYWNlKCclVExEUyUnLCByZS5zcmNfdGxkcyk7IH1cblxuICByZS5lbWFpbF9mdXp6eSAgICAgID0gUmVnRXhwKHVudHBsKHJlLnRwbF9lbWFpbF9mdXp6eSksICdpJyk7XG4gIHJlLmxpbmtfZnV6enkgICAgICAgPSBSZWdFeHAodW50cGwocmUudHBsX2xpbmtfZnV6enkpLCAnaScpO1xuICByZS5saW5rX25vX2lwX2Z1enp5ID0gUmVnRXhwKHVudHBsKHJlLnRwbF9saW5rX25vX2lwX2Z1enp5KSwgJ2knKTtcbiAgcmUuaG9zdF9mdXp6eV90ZXN0ICA9IFJlZ0V4cCh1bnRwbChyZS50cGxfaG9zdF9mdXp6eV90ZXN0KSwgJ2knKTtcblxuICAvL1xuICAvLyBDb21waWxlIGVhY2ggc2NoZW1hXG4gIC8vXG5cbiAgdmFyIGFsaWFzZXMgPSBbXTtcblxuICBzZWxmLl9fY29tcGlsZWRfXyA9IHt9OyAvLyBSZXNldCBjb21waWxlZCBkYXRhXG5cbiAgZnVuY3Rpb24gc2NoZW1hRXJyb3IobmFtZSwgdmFsKSB7XG4gICAgdGhyb3cgbmV3IEVycm9yKCcoTGlua2lmeUl0KSBJbnZhbGlkIHNjaGVtYSBcIicgKyBuYW1lICsgJ1wiOiAnICsgdmFsKTtcbiAgfVxuXG4gIE9iamVjdC5rZXlzKHNlbGYuX19zY2hlbWFzX18pLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICB2YXIgdmFsID0gc2VsZi5fX3NjaGVtYXNfX1tuYW1lXTtcblxuICAgIC8vIHNraXAgZGlzYWJsZWQgbWV0aG9kc1xuICAgIGlmICh2YWwgPT09IG51bGwpIHsgcmV0dXJuOyB9XG5cbiAgICB2YXIgY29tcGlsZWQgPSB7IHZhbGlkYXRlOiBudWxsLCBsaW5rOiBudWxsIH07XG5cbiAgICBzZWxmLl9fY29tcGlsZWRfX1tuYW1lXSA9IGNvbXBpbGVkO1xuXG4gICAgaWYgKGlzT2JqZWN0KHZhbCkpIHtcbiAgICAgIGlmIChpc1JlZ0V4cCh2YWwudmFsaWRhdGUpKSB7XG4gICAgICAgIGNvbXBpbGVkLnZhbGlkYXRlID0gY3JlYXRlVmFsaWRhdG9yKHZhbC52YWxpZGF0ZSk7XG4gICAgICB9IGVsc2UgaWYgKGlzRnVuY3Rpb24odmFsLnZhbGlkYXRlKSkge1xuICAgICAgICBjb21waWxlZC52YWxpZGF0ZSA9IHZhbC52YWxpZGF0ZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNjaGVtYUVycm9yKG5hbWUsIHZhbCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChpc0Z1bmN0aW9uKHZhbC5ub3JtYWxpemUpKSB7XG4gICAgICAgIGNvbXBpbGVkLm5vcm1hbGl6ZSA9IHZhbC5ub3JtYWxpemU7XG4gICAgICB9IGVsc2UgaWYgKCF2YWwubm9ybWFsaXplKSB7XG4gICAgICAgIGNvbXBpbGVkLm5vcm1hbGl6ZSA9IGNyZWF0ZU5vcm1hbGl6ZXIoKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNjaGVtYUVycm9yKG5hbWUsIHZhbCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoaXNTdHJpbmcodmFsKSkge1xuICAgICAgYWxpYXNlcy5wdXNoKG5hbWUpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNjaGVtYUVycm9yKG5hbWUsIHZhbCk7XG4gIH0pO1xuXG4gIC8vXG4gIC8vIENvbXBpbGUgcG9zdHBvbmVkIGFsaWFzZXNcbiAgLy9cblxuICBhbGlhc2VzLmZvckVhY2goZnVuY3Rpb24gKGFsaWFzKSB7XG4gICAgaWYgKCFzZWxmLl9fY29tcGlsZWRfX1tzZWxmLl9fc2NoZW1hc19fW2FsaWFzXV0pIHtcbiAgICAgIC8vIFNpbGVudGx5IGZhaWwgb24gbWlzc2VkIHNjaGVtYXMgdG8gYXZvaWQgZXJyb25zIG9uIGRpc2FibGUuXG4gICAgICAvLyBzY2hlbWFFcnJvcihhbGlhcywgc2VsZi5fX3NjaGVtYXNfX1thbGlhc10pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHNlbGYuX19jb21waWxlZF9fW2FsaWFzXS52YWxpZGF0ZSA9XG4gICAgICBzZWxmLl9fY29tcGlsZWRfX1tzZWxmLl9fc2NoZW1hc19fW2FsaWFzXV0udmFsaWRhdGU7XG4gICAgc2VsZi5fX2NvbXBpbGVkX19bYWxpYXNdLm5vcm1hbGl6ZSA9XG4gICAgICBzZWxmLl9fY29tcGlsZWRfX1tzZWxmLl9fc2NoZW1hc19fW2FsaWFzXV0ubm9ybWFsaXplO1xuICB9KTtcblxuICAvL1xuICAvLyBGYWtlIHJlY29yZCBmb3IgZ3Vlc3NlZCBsaW5rc1xuICAvL1xuICBzZWxmLl9fY29tcGlsZWRfX1snJ10gPSB7IHZhbGlkYXRlOiBudWxsLCBub3JtYWxpemU6IGNyZWF0ZU5vcm1hbGl6ZXIoKSB9O1xuXG4gIC8vXG4gIC8vIEJ1aWxkIHNjaGVtYSBjb25kaXRpb25cbiAgLy9cbiAgdmFyIHNsaXN0ID0gT2JqZWN0LmtleXMoc2VsZi5fX2NvbXBpbGVkX18pXG4gICAgICAgICAgICAgICAgICAgICAgLmZpbHRlcihmdW5jdGlvbihuYW1lKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBGaWx0ZXIgZGlzYWJsZWQgJiBmYWtlIHNjaGVtYXNcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBuYW1lLmxlbmd0aCA+IDAgJiYgc2VsZi5fX2NvbXBpbGVkX19bbmFtZV07XG4gICAgICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICAgICAgICAubWFwKGVzY2FwZVJFKVxuICAgICAgICAgICAgICAgICAgICAgIC5qb2luKCd8Jyk7XG4gIC8vICg/IV8pIGNhdXNlIDEuNXggc2xvd2Rvd25cbiAgc2VsZi5yZS5zY2hlbWFfdGVzdCAgID0gUmVnRXhwKCcoXnwoPyFfKSg/Oj58JyArIHJlLnNyY19aUENjICsgJykpKCcgKyBzbGlzdCArICcpJywgJ2knKTtcbiAgc2VsZi5yZS5zY2hlbWFfc2VhcmNoID0gUmVnRXhwKCcoXnwoPyFfKSg/Oj58JyArIHJlLnNyY19aUENjICsgJykpKCcgKyBzbGlzdCArICcpJywgJ2lnJyk7XG5cbiAgc2VsZi5yZS5wcmV0ZXN0ICAgICAgID0gUmVnRXhwKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICcoJyArIHNlbGYucmUuc2NoZW1hX3Rlc3Quc291cmNlICsgJyl8JyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJygnICsgc2VsZi5yZS5ob3N0X2Z1enp5X3Rlc3Quc291cmNlICsgJyl8JyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ0AnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICdpJyk7XG5cbiAgLy9cbiAgLy8gQ2xlYW51cFxuICAvL1xuXG4gIHJlc2V0U2NhbkNhY2hlKHNlbGYpO1xufVxuXG4vKipcbiAqIGNsYXNzIE1hdGNoXG4gKlxuICogTWF0Y2ggcmVzdWx0LiBTaW5nbGUgZWxlbWVudCBvZiBhcnJheSwgcmV0dXJuZWQgYnkgW1tMaW5raWZ5SXQjbWF0Y2hdXVxuICoqL1xuZnVuY3Rpb24gTWF0Y2goc2VsZiwgc2hpZnQpIHtcbiAgdmFyIHN0YXJ0ID0gc2VsZi5fX2luZGV4X18sXG4gICAgICBlbmQgICA9IHNlbGYuX19sYXN0X2luZGV4X18sXG4gICAgICB0ZXh0ICA9IHNlbGYuX190ZXh0X2NhY2hlX18uc2xpY2Uoc3RhcnQsIGVuZCk7XG5cbiAgLyoqXG4gICAqIE1hdGNoI3NjaGVtYSAtPiBTdHJpbmdcbiAgICpcbiAgICogUHJlZml4IChwcm90b2NvbCkgZm9yIG1hdGNoZWQgc3RyaW5nLlxuICAgKiovXG4gIHRoaXMuc2NoZW1hICAgID0gc2VsZi5fX3NjaGVtYV9fLnRvTG93ZXJDYXNlKCk7XG4gIC8qKlxuICAgKiBNYXRjaCNpbmRleCAtPiBOdW1iZXJcbiAgICpcbiAgICogRmlyc3QgcG9zaXRpb24gb2YgbWF0Y2hlZCBzdHJpbmcuXG4gICAqKi9cbiAgdGhpcy5pbmRleCAgICAgPSBzdGFydCArIHNoaWZ0O1xuICAvKipcbiAgICogTWF0Y2gjbGFzdEluZGV4IC0+IE51bWJlclxuICAgKlxuICAgKiBOZXh0IHBvc2l0aW9uIGFmdGVyIG1hdGNoZWQgc3RyaW5nLlxuICAgKiovXG4gIHRoaXMubGFzdEluZGV4ID0gZW5kICsgc2hpZnQ7XG4gIC8qKlxuICAgKiBNYXRjaCNyYXcgLT4gU3RyaW5nXG4gICAqXG4gICAqIE1hdGNoZWQgc3RyaW5nLlxuICAgKiovXG4gIHRoaXMucmF3ICAgICAgID0gdGV4dDtcbiAgLyoqXG4gICAqIE1hdGNoI3RleHQgLT4gU3RyaW5nXG4gICAqXG4gICAqIE5vdG1hbGl6ZWQgdGV4dCBvZiBtYXRjaGVkIHN0cmluZy5cbiAgICoqL1xuICB0aGlzLnRleHQgICAgICA9IHRleHQ7XG4gIC8qKlxuICAgKiBNYXRjaCN1cmwgLT4gU3RyaW5nXG4gICAqXG4gICAqIE5vcm1hbGl6ZWQgdXJsIG9mIG1hdGNoZWQgc3RyaW5nLlxuICAgKiovXG4gIHRoaXMudXJsICAgICAgID0gdGV4dDtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTWF0Y2goc2VsZiwgc2hpZnQpIHtcbiAgdmFyIG1hdGNoID0gbmV3IE1hdGNoKHNlbGYsIHNoaWZ0KTtcblxuICBzZWxmLl9fY29tcGlsZWRfX1ttYXRjaC5zY2hlbWFdLm5vcm1hbGl6ZShtYXRjaCwgc2VsZik7XG5cbiAgcmV0dXJuIG1hdGNoO1xufVxuXG5cbi8qKlxuICogY2xhc3MgTGlua2lmeUl0XG4gKiovXG5cbi8qKlxuICogbmV3IExpbmtpZnlJdChzY2hlbWFzLCBvcHRpb25zKVxuICogLSBzY2hlbWFzIChPYmplY3QpOiBPcHRpb25hbC4gQWRkaXRpb25hbCBzY2hlbWFzIHRvIHZhbGlkYXRlIChwcmVmaXgvdmFsaWRhdG9yKVxuICogLSBvcHRpb25zIChPYmplY3QpOiB7IGZ1enp5TGlua3xmdXp6eUVtYWlsfGZ1enp5SVA6IHRydWV8ZmFsc2UgfVxuICpcbiAqIENyZWF0ZXMgbmV3IGxpbmtpZmllciBpbnN0YW5jZSB3aXRoIG9wdGlvbmFsIGFkZGl0aW9uYWwgc2NoZW1hcy5cbiAqIENhbiBiZSBjYWxsZWQgd2l0aG91dCBgbmV3YCBrZXl3b3JkIGZvciBjb252ZW5pZW5jZS5cbiAqXG4gKiBCeSBkZWZhdWx0IHVuZGVyc3RhbmRzOlxuICpcbiAqIC0gYGh0dHAocyk6Ly8uLi5gICwgYGZ0cDovLy4uLmAsIGBtYWlsdG86Li4uYCAmIGAvLy4uLmAgbGlua3NcbiAqIC0gXCJmdXp6eVwiIGxpbmtzIGFuZCBlbWFpbHMgKGV4YW1wbGUuY29tLCBmb29AYmFyLmNvbSkuXG4gKlxuICogYHNjaGVtYXNgIGlzIGFuIG9iamVjdCwgd2hlcmUgZWFjaCBrZXkvdmFsdWUgZGVzY3JpYmVzIHByb3RvY29sL3J1bGU6XG4gKlxuICogLSBfX2tleV9fIC0gbGluayBwcmVmaXggKHVzdWFsbHksIHByb3RvY29sIG5hbWUgd2l0aCBgOmAgYXQgdGhlIGVuZCwgYHNreXBlOmBcbiAqICAgZm9yIGV4YW1wbGUpLiBgbGlua2lmeS1pdGAgbWFrZXMgc2h1cmUgdGhhdCBwcmVmaXggaXMgbm90IHByZWNlZWRlZCB3aXRoXG4gKiAgIGFscGhhbnVtZXJpYyBjaGFyIGFuZCBzeW1ib2xzLiBPbmx5IHdoaXRlc3BhY2VzIGFuZCBwdW5jdHVhdGlvbiBhbGxvd2VkLlxuICogLSBfX3ZhbHVlX18gLSBydWxlIHRvIGNoZWNrIHRhaWwgYWZ0ZXIgbGluayBwcmVmaXhcbiAqICAgLSBfU3RyaW5nXyAtIGp1c3QgYWxpYXMgdG8gZXhpc3RpbmcgcnVsZVxuICogICAtIF9PYmplY3RfXG4gKiAgICAgLSBfdmFsaWRhdGVfIC0gdmFsaWRhdG9yIGZ1bmN0aW9uIChzaG91bGQgcmV0dXJuIG1hdGNoZWQgbGVuZ3RoIG9uIHN1Y2Nlc3MpLFxuICogICAgICAgb3IgYFJlZ0V4cGAuXG4gKiAgICAgLSBfbm9ybWFsaXplXyAtIG9wdGlvbmFsIGZ1bmN0aW9uIHRvIG5vcm1hbGl6ZSB0ZXh0ICYgdXJsIG9mIG1hdGNoZWQgcmVzdWx0XG4gKiAgICAgICAoZm9yIGV4YW1wbGUsIGZvciBAdHdpdHRlciBtZW50aW9ucykuXG4gKlxuICogYG9wdGlvbnNgOlxuICpcbiAqIC0gX19mdXp6eUxpbmtfXyAtIHJlY29nbmlnZSBVUkwtcyB3aXRob3V0IGBodHRwKHMpOmAgcHJlZml4LiBEZWZhdWx0IGB0cnVlYC5cbiAqIC0gX19mdXp6eUlQX18gLSBhbGxvdyBJUHMgaW4gZnV6enkgbGlua3MgYWJvdmUuIENhbiBjb25mbGljdCB3aXRoIHNvbWUgdGV4dHNcbiAqICAgbGlrZSB2ZXJzaW9uIG51bWJlcnMuIERlZmF1bHQgYGZhbHNlYC5cbiAqIC0gX19mdXp6eUVtYWlsX18gLSByZWNvZ25pemUgZW1haWxzIHdpdGhvdXQgYG1haWx0bzpgIHByZWZpeC5cbiAqXG4gKiovXG5mdW5jdGlvbiBMaW5raWZ5SXQoc2NoZW1hcywgb3B0aW9ucykge1xuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgTGlua2lmeUl0KSkge1xuICAgIHJldHVybiBuZXcgTGlua2lmeUl0KHNjaGVtYXMsIG9wdGlvbnMpO1xuICB9XG5cbiAgaWYgKCFvcHRpb25zKSB7XG4gICAgaWYgKGlzT3B0aW9uc09iaihzY2hlbWFzKSkge1xuICAgICAgb3B0aW9ucyA9IHNjaGVtYXM7XG4gICAgICBzY2hlbWFzID0ge307XG4gICAgfVxuICB9XG5cbiAgdGhpcy5fX29wdHNfXyAgICAgICAgICAgPSBhc3NpZ24oe30sIGRlZmF1bHRPcHRpb25zLCBvcHRpb25zKTtcblxuICAvLyBDYWNoZSBsYXN0IHRlc3RlZCByZXN1bHQuIFVzZWQgdG8gc2tpcCByZXBlYXRpbmcgc3RlcHMgb24gbmV4dCBgbWF0Y2hgIGNhbGwuXG4gIHRoaXMuX19pbmRleF9fICAgICAgICAgID0gLTE7XG4gIHRoaXMuX19sYXN0X2luZGV4X18gICAgID0gLTE7IC8vIE5leHQgc2NhbiBwb3NpdGlvblxuICB0aGlzLl9fc2NoZW1hX18gICAgICAgICA9ICcnO1xuICB0aGlzLl9fdGV4dF9jYWNoZV9fICAgICA9ICcnO1xuXG4gIHRoaXMuX19zY2hlbWFzX18gICAgICAgID0gYXNzaWduKHt9LCBkZWZhdWx0U2NoZW1hcywgc2NoZW1hcyk7XG4gIHRoaXMuX19jb21waWxlZF9fICAgICAgID0ge307XG5cbiAgdGhpcy5fX3RsZHNfXyAgICAgICAgICAgPSB0bGRzX2RlZmF1bHQ7XG4gIHRoaXMuX190bGRzX3JlcGxhY2VkX18gID0gZmFsc2U7XG5cbiAgdGhpcy5yZSA9IHt9O1xuXG4gIGNvbXBpbGUodGhpcyk7XG59XG5cblxuLyoqIGNoYWluYWJsZVxuICogTGlua2lmeUl0I2FkZChzY2hlbWEsIGRlZmluaXRpb24pXG4gKiAtIHNjaGVtYSAoU3RyaW5nKTogcnVsZSBuYW1lIChmaXhlZCBwYXR0ZXJuIHByZWZpeClcbiAqIC0gZGVmaW5pdGlvbiAoU3RyaW5nfFJlZ0V4cHxPYmplY3QpOiBzY2hlbWEgZGVmaW5pdGlvblxuICpcbiAqIEFkZCBuZXcgcnVsZSBkZWZpbml0aW9uLiBTZWUgY29uc3RydWN0b3IgZGVzY3JpcHRpb24gZm9yIGRldGFpbHMuXG4gKiovXG5MaW5raWZ5SXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIGFkZChzY2hlbWEsIGRlZmluaXRpb24pIHtcbiAgdGhpcy5fX3NjaGVtYXNfX1tzY2hlbWFdID0gZGVmaW5pdGlvbjtcbiAgY29tcGlsZSh0aGlzKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5cbi8qKiBjaGFpbmFibGVcbiAqIExpbmtpZnlJdCNzZXQob3B0aW9ucylcbiAqIC0gb3B0aW9ucyAoT2JqZWN0KTogeyBmdXp6eUxpbmt8ZnV6enlFbWFpbHxmdXp6eUlQOiB0cnVlfGZhbHNlIH1cbiAqXG4gKiBTZXQgcmVjb2duaXRpb24gb3B0aW9ucyBmb3IgbGlua3Mgd2l0aG91dCBzY2hlbWEuXG4gKiovXG5MaW5raWZ5SXQucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIHNldChvcHRpb25zKSB7XG4gIHRoaXMuX19vcHRzX18gPSBhc3NpZ24odGhpcy5fX29wdHNfXywgb3B0aW9ucyk7XG4gIHJldHVybiB0aGlzO1xufTtcblxuXG4vKipcbiAqIExpbmtpZnlJdCN0ZXN0KHRleHQpIC0+IEJvb2xlYW5cbiAqXG4gKiBTZWFyY2hlcyBsaW5raWZpYWJsZSBwYXR0ZXJuIGFuZCByZXR1cm5zIGB0cnVlYCBvbiBzdWNjZXNzIG9yIGBmYWxzZWAgb24gZmFpbC5cbiAqKi9cbkxpbmtpZnlJdC5wcm90b3R5cGUudGVzdCA9IGZ1bmN0aW9uIHRlc3QodGV4dCkge1xuICAvLyBSZXNldCBzY2FuIGNhY2hlXG4gIHRoaXMuX190ZXh0X2NhY2hlX18gPSB0ZXh0O1xuICB0aGlzLl9faW5kZXhfXyAgICAgID0gLTE7XG5cbiAgaWYgKCF0ZXh0Lmxlbmd0aCkgeyByZXR1cm4gZmFsc2U7IH1cblxuICB2YXIgbSwgbWwsIG1lLCBsZW4sIHNoaWZ0LCBuZXh0LCByZSwgdGxkX3BvcywgYXRfcG9zO1xuXG4gIC8vIHRyeSB0byBzY2FuIGZvciBsaW5rIHdpdGggc2NoZW1hIC0gdGhhdCdzIHRoZSBtb3N0IHNpbXBsZSBydWxlXG4gIGlmICh0aGlzLnJlLnNjaGVtYV90ZXN0LnRlc3QodGV4dCkpIHtcbiAgICByZSA9IHRoaXMucmUuc2NoZW1hX3NlYXJjaDtcbiAgICByZS5sYXN0SW5kZXggPSAwO1xuICAgIHdoaWxlICgobSA9IHJlLmV4ZWModGV4dCkpICE9PSBudWxsKSB7XG4gICAgICBsZW4gPSB0aGlzLnRlc3RTY2hlbWFBdCh0ZXh0LCBtWzJdLCByZS5sYXN0SW5kZXgpO1xuICAgICAgaWYgKGxlbikge1xuICAgICAgICB0aGlzLl9fc2NoZW1hX18gICAgID0gbVsyXTtcbiAgICAgICAgdGhpcy5fX2luZGV4X18gICAgICA9IG0uaW5kZXggKyBtWzFdLmxlbmd0aDtcbiAgICAgICAgdGhpcy5fX2xhc3RfaW5kZXhfXyA9IG0uaW5kZXggKyBtWzBdLmxlbmd0aCArIGxlbjtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgaWYgKHRoaXMuX19vcHRzX18uZnV6enlMaW5rICYmIHRoaXMuX19jb21waWxlZF9fWydodHRwOiddKSB7XG4gICAgLy8gZ3Vlc3Mgc2NoZW1hbGVzcyBsaW5rc1xuICAgIHRsZF9wb3MgPSB0ZXh0LnNlYXJjaCh0aGlzLnJlLmhvc3RfZnV6enlfdGVzdCk7XG4gICAgaWYgKHRsZF9wb3MgPj0gMCkge1xuICAgICAgLy8gaWYgdGxkIGlzIGxvY2F0ZWQgYWZ0ZXIgZm91bmQgbGluayAtIG5vIG5lZWQgdG8gY2hlY2sgZnV6enkgcGF0dGVyblxuICAgICAgaWYgKHRoaXMuX19pbmRleF9fIDwgMCB8fCB0bGRfcG9zIDwgdGhpcy5fX2luZGV4X18pIHtcbiAgICAgICAgaWYgKChtbCA9IHRleHQubWF0Y2godGhpcy5fX29wdHNfXy5mdXp6eUlQID8gdGhpcy5yZS5saW5rX2Z1enp5IDogdGhpcy5yZS5saW5rX25vX2lwX2Z1enp5KSkgIT09IG51bGwpIHtcblxuICAgICAgICAgIHNoaWZ0ID0gbWwuaW5kZXggKyBtbFsxXS5sZW5ndGg7XG5cbiAgICAgICAgICBpZiAodGhpcy5fX2luZGV4X18gPCAwIHx8IHNoaWZ0IDwgdGhpcy5fX2luZGV4X18pIHtcbiAgICAgICAgICAgIHRoaXMuX19zY2hlbWFfXyAgICAgPSAnJztcbiAgICAgICAgICAgIHRoaXMuX19pbmRleF9fICAgICAgPSBzaGlmdDtcbiAgICAgICAgICAgIHRoaXMuX19sYXN0X2luZGV4X18gPSBtbC5pbmRleCArIG1sWzBdLmxlbmd0aDtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAodGhpcy5fX29wdHNfXy5mdXp6eUVtYWlsICYmIHRoaXMuX19jb21waWxlZF9fWydtYWlsdG86J10pIHtcbiAgICAvLyBndWVzcyBzY2hlbWFsZXNzIGVtYWlsc1xuICAgIGF0X3BvcyA9IHRleHQuaW5kZXhPZignQCcpO1xuICAgIGlmIChhdF9wb3MgPj0gMCkge1xuICAgICAgLy8gV2UgY2FuJ3Qgc2tpcCB0aGlzIGNoZWNrLCBiZWNhdXNlIHRoaXMgY2FzZXMgYXJlIHBvc3NpYmxlOlxuICAgICAgLy8gMTkyLjE2OC4xLjFAZ21haWwuY29tLCBteS5pbkBleGFtcGxlLmNvbVxuICAgICAgaWYgKChtZSA9IHRleHQubWF0Y2godGhpcy5yZS5lbWFpbF9mdXp6eSkpICE9PSBudWxsKSB7XG5cbiAgICAgICAgc2hpZnQgPSBtZS5pbmRleCArIG1lWzFdLmxlbmd0aDtcbiAgICAgICAgbmV4dCAgPSBtZS5pbmRleCArIG1lWzBdLmxlbmd0aDtcblxuICAgICAgICBpZiAodGhpcy5fX2luZGV4X18gPCAwIHx8IHNoaWZ0IDwgdGhpcy5fX2luZGV4X18gfHxcbiAgICAgICAgICAgIChzaGlmdCA9PT0gdGhpcy5fX2luZGV4X18gJiYgbmV4dCA+IHRoaXMuX19sYXN0X2luZGV4X18pKSB7XG4gICAgICAgICAgdGhpcy5fX3NjaGVtYV9fICAgICA9ICdtYWlsdG86JztcbiAgICAgICAgICB0aGlzLl9faW5kZXhfXyAgICAgID0gc2hpZnQ7XG4gICAgICAgICAgdGhpcy5fX2xhc3RfaW5kZXhfXyA9IG5leHQ7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gdGhpcy5fX2luZGV4X18gPj0gMDtcbn07XG5cblxuLyoqXG4gKiBMaW5raWZ5SXQjcHJldGVzdCh0ZXh0KSAtPiBCb29sZWFuXG4gKlxuICogVmVyeSBxdWljayBjaGVjaywgdGhhdCBjYW4gZ2l2ZSBmYWxzZSBwb3NpdGl2ZXMuIFJldHVybnMgdHJ1ZSBpZiBsaW5rIE1BWSBCRVxuICogY2FuIGV4aXN0cy4gQ2FuIGJlIHVzZWQgZm9yIHNwZWVkIG9wdGltaXphdGlvbiwgd2hlbiB5b3UgbmVlZCB0byBjaGVjayB0aGF0XG4gKiBsaW5rIE5PVCBleGlzdHMuXG4gKiovXG5MaW5raWZ5SXQucHJvdG90eXBlLnByZXRlc3QgPSBmdW5jdGlvbiBwcmV0ZXN0KHRleHQpIHtcbiAgcmV0dXJuIHRoaXMucmUucHJldGVzdC50ZXN0KHRleHQpO1xufTtcblxuXG4vKipcbiAqIExpbmtpZnlJdCN0ZXN0U2NoZW1hQXQodGV4dCwgbmFtZSwgcG9zaXRpb24pIC0+IE51bWJlclxuICogLSB0ZXh0IChTdHJpbmcpOiB0ZXh0IHRvIHNjYW5cbiAqIC0gbmFtZSAoU3RyaW5nKTogcnVsZSAoc2NoZW1hKSBuYW1lXG4gKiAtIHBvc2l0aW9uIChOdW1iZXIpOiB0ZXh0IG9mZnNldCB0byBjaGVjayBmcm9tXG4gKlxuICogU2ltaWxhciB0byBbW0xpbmtpZnlJdCN0ZXN0XV0gYnV0IGNoZWNrcyBvbmx5IHNwZWNpZmljIHByb3RvY29sIHRhaWwgZXhhY3RseVxuICogYXQgZ2l2ZW4gcG9zaXRpb24uIFJldHVybnMgbGVuZ3RoIG9mIGZvdW5kIHBhdHRlcm4gKDAgb24gZmFpbCkuXG4gKiovXG5MaW5raWZ5SXQucHJvdG90eXBlLnRlc3RTY2hlbWFBdCA9IGZ1bmN0aW9uIHRlc3RTY2hlbWFBdCh0ZXh0LCBzY2hlbWEsIHBvcykge1xuICAvLyBJZiBub3Qgc3VwcG9ydGVkIHNjaGVtYSBjaGVjayByZXF1ZXN0ZWQgLSB0ZXJtaW5hdGVcbiAgaWYgKCF0aGlzLl9fY29tcGlsZWRfX1tzY2hlbWEudG9Mb3dlckNhc2UoKV0pIHtcbiAgICByZXR1cm4gMDtcbiAgfVxuICByZXR1cm4gdGhpcy5fX2NvbXBpbGVkX19bc2NoZW1hLnRvTG93ZXJDYXNlKCldLnZhbGlkYXRlKHRleHQsIHBvcywgdGhpcyk7XG59O1xuXG5cbi8qKlxuICogTGlua2lmeUl0I21hdGNoKHRleHQpIC0+IEFycmF5fG51bGxcbiAqXG4gKiBSZXR1cm5zIGFycmF5IG9mIGZvdW5kIGxpbmsgZGVzY3JpcHRpb25zIG9yIGBudWxsYCBvbiBmYWlsLiBXZSBzdHJvbmdseVxuICogdG8gdXNlIFtbTGlua2lmeUl0I3Rlc3RdXSBmaXJzdCwgZm9yIGJlc3Qgc3BlZWQuXG4gKlxuICogIyMjIyMgUmVzdWx0IG1hdGNoIGRlc2NyaXB0aW9uXG4gKlxuICogLSBfX3NjaGVtYV9fIC0gbGluayBzY2hlbWEsIGNhbiBiZSBlbXB0eSBmb3IgZnV6enkgbGlua3MsIG9yIGAvL2AgZm9yXG4gKiAgIHByb3RvY29sLW5ldXRyYWwgIGxpbmtzLlxuICogLSBfX2luZGV4X18gLSBvZmZzZXQgb2YgbWF0Y2hlZCB0ZXh0XG4gKiAtIF9fbGFzdEluZGV4X18gLSBpbmRleCBvZiBuZXh0IGNoYXIgYWZ0ZXIgbWF0aGNoIGVuZFxuICogLSBfX3Jhd19fIC0gbWF0Y2hlZCB0ZXh0XG4gKiAtIF9fdGV4dF9fIC0gbm9ybWFsaXplZCB0ZXh0XG4gKiAtIF9fdXJsX18gLSBsaW5rLCBnZW5lcmF0ZWQgZnJvbSBtYXRjaGVkIHRleHRcbiAqKi9cbkxpbmtpZnlJdC5wcm90b3R5cGUubWF0Y2ggPSBmdW5jdGlvbiBtYXRjaCh0ZXh0KSB7XG4gIHZhciBzaGlmdCA9IDAsIHJlc3VsdCA9IFtdO1xuXG4gIC8vIFRyeSB0byB0YWtlIHByZXZpb3VzIGVsZW1lbnQgZnJvbSBjYWNoZSwgaWYgLnRlc3QoKSBjYWxsZWQgYmVmb3JlXG4gIGlmICh0aGlzLl9faW5kZXhfXyA+PSAwICYmIHRoaXMuX190ZXh0X2NhY2hlX18gPT09IHRleHQpIHtcbiAgICByZXN1bHQucHVzaChjcmVhdGVNYXRjaCh0aGlzLCBzaGlmdCkpO1xuICAgIHNoaWZ0ID0gdGhpcy5fX2xhc3RfaW5kZXhfXztcbiAgfVxuXG4gIC8vIEN1dCBoZWFkIGlmIGNhY2hlIHdhcyB1c2VkXG4gIHZhciB0YWlsID0gc2hpZnQgPyB0ZXh0LnNsaWNlKHNoaWZ0KSA6IHRleHQ7XG5cbiAgLy8gU2NhbiBzdHJpbmcgdW50aWwgZW5kIHJlYWNoZWRcbiAgd2hpbGUgKHRoaXMudGVzdCh0YWlsKSkge1xuICAgIHJlc3VsdC5wdXNoKGNyZWF0ZU1hdGNoKHRoaXMsIHNoaWZ0KSk7XG5cbiAgICB0YWlsID0gdGFpbC5zbGljZSh0aGlzLl9fbGFzdF9pbmRleF9fKTtcbiAgICBzaGlmdCArPSB0aGlzLl9fbGFzdF9pbmRleF9fO1xuICB9XG5cbiAgaWYgKHJlc3VsdC5sZW5ndGgpIHtcbiAgICByZXR1cm4gcmVzdWx0O1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59O1xuXG5cbi8qKiBjaGFpbmFibGVcbiAqIExpbmtpZnlJdCN0bGRzKGxpc3QgWywga2VlcE9sZF0pIC0+IHRoaXNcbiAqIC0gbGlzdCAoQXJyYXkpOiBsaXN0IG9mIHRsZHNcbiAqIC0ga2VlcE9sZCAoQm9vbGVhbik6IG1lcmdlIHdpdGggY3VycmVudCBsaXN0IGlmIGB0cnVlYCAoYGZhbHNlYCBieSBkZWZhdWx0KVxuICpcbiAqIExvYWQgKG9yIG1lcmdlKSBuZXcgdGxkcyBsaXN0LiBUaG9zZSBhcmUgdXNlciBmb3IgZnV6enkgbGlua3MgKHdpdGhvdXQgcHJlZml4KVxuICogdG8gYXZvaWQgZmFsc2UgcG9zaXRpdmVzLiBCeSBkZWZhdWx0IHRoaXMgYWxnb3J5dGhtIHVzZWQ6XG4gKlxuICogLSBob3N0bmFtZSB3aXRoIGFueSAyLWxldHRlciByb290IHpvbmVzIGFyZSBvay5cbiAqIC0gYml6fGNvbXxlZHV8Z292fG5ldHxvcmd8cHJvfHdlYnx4eHh8YWVyb3xhc2lhfGNvb3B8aW5mb3xtdXNldW18bmFtZXxzaG9wfNGA0YRcbiAqICAgYXJlIG9rLlxuICogLSBlbmNvZGVkIChgeG4tLS4uLmApIHJvb3Qgem9uZXMgYXJlIG9rLlxuICpcbiAqIElmIGxpc3QgaXMgcmVwbGFjZWQsIHRoZW4gZXhhY3QgbWF0Y2ggZm9yIDItY2hhcnMgcm9vdCB6b25lcyB3aWxsIGJlIGNoZWNrZWQuXG4gKiovXG5MaW5raWZ5SXQucHJvdG90eXBlLnRsZHMgPSBmdW5jdGlvbiB0bGRzKGxpc3QsIGtlZXBPbGQpIHtcbiAgbGlzdCA9IEFycmF5LmlzQXJyYXkobGlzdCkgPyBsaXN0IDogWyBsaXN0IF07XG5cbiAgaWYgKCFrZWVwT2xkKSB7XG4gICAgdGhpcy5fX3RsZHNfXyA9IGxpc3Quc2xpY2UoKTtcbiAgICB0aGlzLl9fdGxkc19yZXBsYWNlZF9fID0gdHJ1ZTtcbiAgICBjb21waWxlKHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgdGhpcy5fX3RsZHNfXyA9IHRoaXMuX190bGRzX18uY29uY2F0KGxpc3QpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLnNvcnQoKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5maWx0ZXIoZnVuY3Rpb24oZWwsIGlkeCwgYXJyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZWwgIT09IGFycltpZHggLSAxXTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC5yZXZlcnNlKCk7XG5cbiAgY29tcGlsZSh0aGlzKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIExpbmtpZnlJdCNub3JtYWxpemUobWF0Y2gpXG4gKlxuICogRGVmYXVsdCBub3JtYWxpemVyIChpZiBzY2hlbWEgZG9lcyBub3QgZGVmaW5lIGl0J3Mgb3duKS5cbiAqKi9cbkxpbmtpZnlJdC5wcm90b3R5cGUubm9ybWFsaXplID0gZnVuY3Rpb24gbm9ybWFsaXplKG1hdGNoKSB7XG5cbiAgLy8gRG8gbWluaW1hbCBwb3NzaWJsZSBjaGFuZ2VzIGJ5IGRlZmF1bHQuIE5lZWQgdG8gY29sbGVjdCBmZWVkYmFjayBwcmlvclxuICAvLyB0byBtb3ZlIGZvcndhcmQgaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L2xpbmtpZnktaXQvaXNzdWVzLzFcblxuICBpZiAoIW1hdGNoLnNjaGVtYSkgeyBtYXRjaC51cmwgPSAnaHR0cDovLycgKyBtYXRjaC51cmw7IH1cblxuICBpZiAobWF0Y2guc2NoZW1hID09PSAnbWFpbHRvOicgJiYgIS9ebWFpbHRvOi9pLnRlc3QobWF0Y2gudXJsKSkge1xuICAgIG1hdGNoLnVybCA9ICdtYWlsdG86JyArIG1hdGNoLnVybDtcbiAgfVxufTtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IExpbmtpZnlJdDtcbiIsIid1c2Ugc3RyaWN0JztcblxuLy8gVXNlIGRpcmVjdCBleHRyYWN0IGluc3RlYWQgb2YgYHJlZ2VuZXJhdGVgIHRvIHJlZHVzZSBicm93c2VyaWZpZWQgc2l6ZVxudmFyIHNyY19BbnkgPSBleHBvcnRzLnNyY19BbnkgPSByZXF1aXJlKCd1Yy5taWNyby9wcm9wZXJ0aWVzL0FueS9yZWdleCcpLnNvdXJjZTtcbnZhciBzcmNfQ2MgID0gZXhwb3J0cy5zcmNfQ2MgPSByZXF1aXJlKCd1Yy5taWNyby9jYXRlZ29yaWVzL0NjL3JlZ2V4Jykuc291cmNlO1xudmFyIHNyY19aICAgPSBleHBvcnRzLnNyY19aICA9IHJlcXVpcmUoJ3VjLm1pY3JvL2NhdGVnb3JpZXMvWi9yZWdleCcpLnNvdXJjZTtcbnZhciBzcmNfUCAgID0gZXhwb3J0cy5zcmNfUCAgPSByZXF1aXJlKCd1Yy5taWNyby9jYXRlZ29yaWVzL1AvcmVnZXgnKS5zb3VyY2U7XG5cbi8vIFxccHtcXFpcXFBcXENjXFxDRn0gKHdoaXRlIHNwYWNlcyArIGNvbnRyb2wgKyBmb3JtYXQgKyBwdW5jdHVhdGlvbilcbnZhciBzcmNfWlBDYyA9IGV4cG9ydHMuc3JjX1pQQ2MgPSBbIHNyY19aLCBzcmNfUCwgc3JjX0NjIF0uam9pbignfCcpO1xuXG4vLyBcXHB7XFxaXFxDY30gKHdoaXRlIHNwYWNlcyArIGNvbnRyb2wpXG52YXIgc3JjX1pDYyA9IGV4cG9ydHMuc3JjX1pDYyA9IFsgc3JjX1osIHNyY19DYyBdLmpvaW4oJ3wnKTtcblxuLy8gQWxsIHBvc3NpYmxlIHdvcmQgY2hhcmFjdGVycyAoZXZlcnl0aGluZyB3aXRob3V0IHB1bmN0dWF0aW9uLCBzcGFjZXMgJiBjb250cm9scylcbi8vIERlZmluZWQgdmlhIHB1bmN0dWF0aW9uICYgc3BhY2VzIHRvIHNhdmUgc3BhY2Vcbi8vIFNob3VsZCBiZSBzb21ldGhpbmcgbGlrZSBcXHB7XFxMXFxOXFxTXFxNfSAoXFx3IGJ1dCB3aXRob3V0IGBfYClcbnZhciBzcmNfcHNldWRvX2xldHRlciAgICAgICA9ICcoPzooPyEnICsgc3JjX1pQQ2MgKyAnKScgKyBzcmNfQW55ICsgJyknO1xuLy8gVGhlIHNhbWUgYXMgYWJvdGhlIGJ1dCB3aXRob3V0IFswLTldXG52YXIgc3JjX3BzZXVkb19sZXR0ZXJfbm9uX2QgPSAnKD86KD8hWzAtOV18JyArIHNyY19aUENjICsgJyknICsgc3JjX0FueSArICcpJztcblxuLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy9cblxudmFyIHNyY19pcDQgPSBleHBvcnRzLnNyY19pcDQgPVxuXG4gICcoPzooMjVbMC01XXwyWzAtNF1bMC05XXxbMDFdP1swLTldWzAtOV0/KVxcXFwuKXszfSgyNVswLTVdfDJbMC00XVswLTldfFswMV0/WzAtOV1bMC05XT8pJztcblxuZXhwb3J0cy5zcmNfYXV0aCAgICA9ICcoPzooPzooPyEnICsgc3JjX1pDYyArICcpLikrQCk/JztcblxudmFyIHNyY19wb3J0ID0gZXhwb3J0cy5zcmNfcG9ydCA9XG5cbiAgJyg/OjooPzo2KD86WzAtNF1cXFxcZHszfXw1KD86WzAtNF1cXFxcZHsyfXw1KD86WzAtMl1cXFxcZHwzWzAtNV0pKSl8WzEtNV0/XFxcXGR7MSw0fSkpPyc7XG5cbnZhciBzcmNfaG9zdF90ZXJtaW5hdG9yID0gZXhwb3J0cy5zcmNfaG9zdF90ZXJtaW5hdG9yID1cblxuICAnKD89JHwnICsgc3JjX1pQQ2MgKyAnKSg/IS18X3w6XFxcXGR8XFxcXC4tfFxcXFwuKD8hJHwnICsgc3JjX1pQQ2MgKyAnKSknO1xuXG52YXIgc3JjX3BhdGggPSBleHBvcnRzLnNyY19wYXRoID1cblxuICAnKD86JyArXG4gICAgJ1svPyNdJyArXG4gICAgICAnKD86JyArXG4gICAgICAgICcoPyEnICsgc3JjX1pDYyArICd8WygpW1xcXFxde30uLFwiXFwnPyFcXFxcLV0pLnwnICtcbiAgICAgICAgJ1xcXFxbKD86KD8hJyArIHNyY19aQ2MgKyAnfFxcXFxdKS4pKlxcXFxdfCcgK1xuICAgICAgICAnXFxcXCgoPzooPyEnICsgc3JjX1pDYyArICd8WyldKS4pKlxcXFwpfCcgK1xuICAgICAgICAnXFxcXHsoPzooPyEnICsgc3JjX1pDYyArICd8W31dKS4pKlxcXFx9fCcgK1xuICAgICAgICAnXFxcXFwiKD86KD8hJyArIHNyY19aQ2MgKyAnfFtcIl0pLikrXFxcXFwifCcgK1xuICAgICAgICBcIlxcXFwnKD86KD8hXCIgKyBzcmNfWkNjICsgXCJ8WyddKS4pK1xcXFwnfFwiICtcbiAgICAgICAgXCJcXFxcJyg/PVwiICsgc3JjX3BzZXVkb19sZXR0ZXIgKyAnKS58JyArICAvLyBhbGxvdyBgSSdtX2tpbmdgIGlmIG5vIHBhaXIgZm91bmRcbiAgICAgICAgJ1xcXFwuezIsM31bYS16QS1aMC05JS9dfCcgKyAvLyBnaXRodWIgaGFzIC4uLiBpbiBjb21taXQgcmFuZ2UgbGlua3MuIFJlc3RyaWN0IHRvXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8vIC0gZW5nbGlzaFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAtIHBlcmNlbnQtZW5jb2RlZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyAtIHBhcnRzIG9mIGZpbGUgcGF0aFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvLyB1bnRpbCBtb3JlIGV4YW1wbGVzIGZvdW5kLlxuICAgICAgICAnXFxcXC4oPyEnICsgc3JjX1pDYyArICd8Wy5dKS58JyArXG4gICAgICAgICdcXFxcLSg/IS0tKD86W14tXXwkKSkoPzotKil8JyArICAvLyBgLS0tYCA9PiBsb25nIGRhc2gsIHRlcm1pbmF0ZVxuICAgICAgICAnXFxcXCwoPyEnICsgc3JjX1pDYyArICcpLnwnICsgICAgICAvLyBhbGxvdyBgLCwsYCBpbiBwYXRoc1xuICAgICAgICAnXFxcXCEoPyEnICsgc3JjX1pDYyArICd8WyFdKS58JyArXG4gICAgICAgICdcXFxcPyg/IScgKyBzcmNfWkNjICsgJ3xbP10pLicgK1xuICAgICAgJykrJyArXG4gICAgJ3xcXFxcLycgK1xuICAnKT8nO1xuXG52YXIgc3JjX2VtYWlsX25hbWUgPSBleHBvcnRzLnNyY19lbWFpbF9uYW1lID1cblxuICAnW1xcXFwtOzomPVxcXFwrXFxcXCQsXFxcXFwiXFxcXC5hLXpBLVowLTlfXSsnO1xuXG52YXIgc3JjX3huID0gZXhwb3J0cy5zcmNfeG4gPVxuXG4gICd4bi0tW2EtejAtOVxcXFwtXXsxLDU5fSc7XG5cbi8vIE1vcmUgdG8gcmVhZCBhYm91dCBkb21haW4gbmFtZXNcbi8vIGh0dHA6Ly9zZXJ2ZXJmYXVsdC5jb20vcXVlc3Rpb25zLzYzODI2MC9cblxudmFyIHNyY19kb21haW5fcm9vdCA9IGV4cG9ydHMuc3JjX2RvbWFpbl9yb290ID1cblxuICAvLyBDYW4ndCBoYXZlIGRpZ2l0cyBhbmQgZGFzaGVzXG4gICcoPzonICtcbiAgICBzcmNfeG4gK1xuICAgICd8JyArXG4gICAgc3JjX3BzZXVkb19sZXR0ZXJfbm9uX2QgKyAnezEsNjN9JyArXG4gICcpJztcblxudmFyIHNyY19kb21haW4gPSBleHBvcnRzLnNyY19kb21haW4gPVxuXG4gICcoPzonICtcbiAgICBzcmNfeG4gK1xuICAgICd8JyArXG4gICAgJyg/OicgKyBzcmNfcHNldWRvX2xldHRlciArICcpJyArXG4gICAgJ3wnICtcbiAgICAvLyBkb24ndCBhbGxvdyBgLS1gIGluIGRvbWFpbiBuYW1lcywgYmVjYXVzZTpcbiAgICAvLyAtIHRoYXQgY2FuIGNvbmZsaWN0IHdpdGggbWFya2Rvd24gJm1kYXNoOyAvICZuZGFzaDtcbiAgICAvLyAtIG5vYm9keSB1c2UgdGhvc2UgYW55d2F5XG4gICAgJyg/OicgKyBzcmNfcHNldWRvX2xldHRlciArICcoPzotKD8hLSl8JyArIHNyY19wc2V1ZG9fbGV0dGVyICsgJyl7MCw2MX0nICsgc3JjX3BzZXVkb19sZXR0ZXIgKyAnKScgK1xuICAnKSc7XG5cbnZhciBzcmNfaG9zdCA9IGV4cG9ydHMuc3JjX2hvc3QgPVxuXG4gICcoPzonICtcbiAgICBzcmNfaXA0ICtcbiAgJ3wnICtcbiAgICAnKD86KD86KD86JyArIHNyY19kb21haW4gKyAnKVxcXFwuKSonICsgc3JjX2RvbWFpbl9yb290ICsgJyknICtcbiAgJyknO1xuXG52YXIgdHBsX2hvc3RfZnV6enkgPSBleHBvcnRzLnRwbF9ob3N0X2Z1enp5ID1cblxuICAnKD86JyArXG4gICAgc3JjX2lwNCArXG4gICd8JyArXG4gICAgJyg/Oig/Oig/OicgKyBzcmNfZG9tYWluICsgJylcXFxcLikrKD86JVRMRFMlKSknICtcbiAgJyknO1xuXG52YXIgdHBsX2hvc3Rfbm9faXBfZnV6enkgPSBleHBvcnRzLnRwbF9ob3N0X25vX2lwX2Z1enp5ID1cblxuICAnKD86KD86KD86JyArIHNyY19kb21haW4gKyAnKVxcXFwuKSsoPzolVExEUyUpKSc7XG5cbmV4cG9ydHMuc3JjX2hvc3Rfc3RyaWN0ID1cblxuICBzcmNfaG9zdCArIHNyY19ob3N0X3Rlcm1pbmF0b3I7XG5cbnZhciB0cGxfaG9zdF9mdXp6eV9zdHJpY3QgPSBleHBvcnRzLnRwbF9ob3N0X2Z1enp5X3N0cmljdCA9XG5cbiAgdHBsX2hvc3RfZnV6enkgKyBzcmNfaG9zdF90ZXJtaW5hdG9yO1xuXG5leHBvcnRzLnNyY19ob3N0X3BvcnRfc3RyaWN0ID1cblxuICBzcmNfaG9zdCArIHNyY19wb3J0ICsgc3JjX2hvc3RfdGVybWluYXRvcjtcblxudmFyIHRwbF9ob3N0X3BvcnRfZnV6enlfc3RyaWN0ID0gZXhwb3J0cy50cGxfaG9zdF9wb3J0X2Z1enp5X3N0cmljdCA9XG5cbiAgdHBsX2hvc3RfZnV6enkgKyBzcmNfcG9ydCArIHNyY19ob3N0X3Rlcm1pbmF0b3I7XG5cbnZhciB0cGxfaG9zdF9wb3J0X25vX2lwX2Z1enp5X3N0cmljdCA9IGV4cG9ydHMudHBsX2hvc3RfcG9ydF9ub19pcF9mdXp6eV9zdHJpY3QgPVxuXG4gIHRwbF9ob3N0X25vX2lwX2Z1enp5ICsgc3JjX3BvcnQgKyBzcmNfaG9zdF90ZXJtaW5hdG9yO1xuXG5cbi8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vLy8vXG4vLyBNYWluIHJ1bGVzXG5cbi8vIFJ1ZGUgdGVzdCBmdXp6eSBsaW5rcyBieSBob3N0LCBmb3IgcXVpY2sgZGVueVxuZXhwb3J0cy50cGxfaG9zdF9mdXp6eV90ZXN0ID1cblxuICAnbG9jYWxob3N0fFxcXFwuXFxcXGR7MSwzfVxcXFwufCg/OlxcXFwuKD86JVRMRFMlKSg/OicgKyBzcmNfWlBDYyArICd8JCkpJztcblxuZXhwb3J0cy50cGxfZW1haWxfZnV6enkgPVxuXG4gICAgJyhefD58JyArIHNyY19aQ2MgKyAnKSgnICsgc3JjX2VtYWlsX25hbWUgKyAnQCcgKyB0cGxfaG9zdF9mdXp6eV9zdHJpY3QgKyAnKSc7XG5cbmV4cG9ydHMudHBsX2xpbmtfZnV6enkgPVxuICAgIC8vIEZ1enp5IGxpbmsgY2FuJ3QgYmUgcHJlcGVuZGVkIHdpdGggLjovXFwtIGFuZCBub24gcHVuY3R1YXRpb24uXG4gICAgLy8gYnV0IGNhbiBzdGFydCB3aXRoID4gKG1hcmtkb3duIGJsb2NrcXVvdGUpXG4gICAgJyhefCg/IVsuOi9cXFxcLV9AXSkoPzpbJCs8PT5eYHxdfCcgKyBzcmNfWlBDYyArICcpKScgK1xuICAgICcoKD8hWyQrPD0+XmB8XSknICsgdHBsX2hvc3RfcG9ydF9mdXp6eV9zdHJpY3QgKyBzcmNfcGF0aCArICcpJztcblxuZXhwb3J0cy50cGxfbGlua19ub19pcF9mdXp6eSA9XG4gICAgLy8gRnV6enkgbGluayBjYW4ndCBiZSBwcmVwZW5kZWQgd2l0aCAuOi9cXC0gYW5kIG5vbiBwdW5jdHVhdGlvbi5cbiAgICAvLyBidXQgY2FuIHN0YXJ0IHdpdGggPiAobWFya2Rvd24gYmxvY2txdW90ZSlcbiAgICAnKF58KD8hWy46L1xcXFwtX0BdKSg/OlskKzw9Pl5gfF18JyArIHNyY19aUENjICsgJykpJyArXG4gICAgJygoPyFbJCs8PT5eYHxdKScgKyB0cGxfaG9zdF9wb3J0X25vX2lwX2Z1enp5X3N0cmljdCArIHNyY19wYXRoICsgJyknO1xuIiwiXG4ndXNlIHN0cmljdCc7XG5cblxuLyogZXNsaW50LWRpc2FibGUgbm8tYml0d2lzZSAqL1xuXG52YXIgZGVjb2RlQ2FjaGUgPSB7fTtcblxuZnVuY3Rpb24gZ2V0RGVjb2RlQ2FjaGUoZXhjbHVkZSkge1xuICB2YXIgaSwgY2gsIGNhY2hlID0gZGVjb2RlQ2FjaGVbZXhjbHVkZV07XG4gIGlmIChjYWNoZSkgeyByZXR1cm4gY2FjaGU7IH1cblxuICBjYWNoZSA9IGRlY29kZUNhY2hlW2V4Y2x1ZGVdID0gW107XG5cbiAgZm9yIChpID0gMDsgaSA8IDEyODsgaSsrKSB7XG4gICAgY2ggPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGkpO1xuICAgIGNhY2hlLnB1c2goY2gpO1xuICB9XG5cbiAgZm9yIChpID0gMDsgaSA8IGV4Y2x1ZGUubGVuZ3RoOyBpKyspIHtcbiAgICBjaCA9IGV4Y2x1ZGUuY2hhckNvZGVBdChpKTtcbiAgICBjYWNoZVtjaF0gPSAnJScgKyAoJzAnICsgY2gudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkpLnNsaWNlKC0yKTtcbiAgfVxuXG4gIHJldHVybiBjYWNoZTtcbn1cblxuXG4vLyBEZWNvZGUgcGVyY2VudC1lbmNvZGVkIHN0cmluZy5cbi8vXG5mdW5jdGlvbiBkZWNvZGUoc3RyaW5nLCBleGNsdWRlKSB7XG4gIHZhciBjYWNoZTtcblxuICBpZiAodHlwZW9mIGV4Y2x1ZGUgIT09ICdzdHJpbmcnKSB7XG4gICAgZXhjbHVkZSA9IGRlY29kZS5kZWZhdWx0Q2hhcnM7XG4gIH1cblxuICBjYWNoZSA9IGdldERlY29kZUNhY2hlKGV4Y2x1ZGUpO1xuXG4gIHJldHVybiBzdHJpbmcucmVwbGFjZSgvKCVbYS1mMC05XXsyfSkrL2dpLCBmdW5jdGlvbihzZXEpIHtcbiAgICB2YXIgaSwgbCwgYjEsIGIyLCBiMywgYjQsIGNoYXIsXG4gICAgICAgIHJlc3VsdCA9ICcnO1xuXG4gICAgZm9yIChpID0gMCwgbCA9IHNlcS5sZW5ndGg7IGkgPCBsOyBpICs9IDMpIHtcbiAgICAgIGIxID0gcGFyc2VJbnQoc2VxLnNsaWNlKGkgKyAxLCBpICsgMyksIDE2KTtcblxuICAgICAgaWYgKGIxIDwgMHg4MCkge1xuICAgICAgICByZXN1bHQgKz0gY2FjaGVbYjFdO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgaWYgKChiMSAmIDB4RTApID09PSAweEMwICYmIChpICsgMyA8IGwpKSB7XG4gICAgICAgIC8vIDExMHh4eHh4IDEweHh4eHh4XG4gICAgICAgIGIyID0gcGFyc2VJbnQoc2VxLnNsaWNlKGkgKyA0LCBpICsgNiksIDE2KTtcblxuICAgICAgICBpZiAoKGIyICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICBjaGFyID0gKChiMSA8PCA2KSAmIDB4N0MwKSB8IChiMiAmIDB4M0YpO1xuXG4gICAgICAgICAgaWYgKGNoYXIgPCAweDgwKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gJ1xcdWZmZmRcXHVmZmZkJztcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmVzdWx0ICs9IFN0cmluZy5mcm9tQ2hhckNvZGUoY2hhcik7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaSArPSAzO1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmICgoYjEgJiAweEYwKSA9PT0gMHhFMCAmJiAoaSArIDYgPCBsKSkge1xuICAgICAgICAvLyAxMTEweHh4eCAxMHh4eHh4eCAxMHh4eHh4eFxuICAgICAgICBiMiA9IHBhcnNlSW50KHNlcS5zbGljZShpICsgNCwgaSArIDYpLCAxNik7XG4gICAgICAgIGIzID0gcGFyc2VJbnQoc2VxLnNsaWNlKGkgKyA3LCBpICsgOSksIDE2KTtcblxuICAgICAgICBpZiAoKGIyICYgMHhDMCkgPT09IDB4ODAgJiYgKGIzICYgMHhDMCkgPT09IDB4ODApIHtcbiAgICAgICAgICBjaGFyID0gKChiMSA8PCAxMikgJiAweEYwMDApIHwgKChiMiA8PCA2KSAmIDB4RkMwKSB8IChiMyAmIDB4M0YpO1xuXG4gICAgICAgICAgaWYgKGNoYXIgPCAweDgwMCB8fCAoY2hhciA+PSAweEQ4MDAgJiYgY2hhciA8PSAweERGRkYpKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gJ1xcdWZmZmRcXHVmZmZkXFx1ZmZmZCc7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSBTdHJpbmcuZnJvbUNoYXJDb2RlKGNoYXIpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGkgKz0gNjtcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoKGIxICYgMHhGOCkgPT09IDB4RjAgJiYgKGkgKyA5IDwgbCkpIHtcbiAgICAgICAgLy8gMTExMTEweHggMTB4eHh4eHggMTB4eHh4eHggMTB4eHh4eHhcbiAgICAgICAgYjIgPSBwYXJzZUludChzZXEuc2xpY2UoaSArIDQsIGkgKyA2KSwgMTYpO1xuICAgICAgICBiMyA9IHBhcnNlSW50KHNlcS5zbGljZShpICsgNywgaSArIDkpLCAxNik7XG4gICAgICAgIGI0ID0gcGFyc2VJbnQoc2VxLnNsaWNlKGkgKyAxMCwgaSArIDEyKSwgMTYpO1xuXG4gICAgICAgIGlmICgoYjIgJiAweEMwKSA9PT0gMHg4MCAmJiAoYjMgJiAweEMwKSA9PT0gMHg4MCAmJiAoYjQgJiAweEMwKSA9PT0gMHg4MCkge1xuICAgICAgICAgIGNoYXIgPSAoKGIxIDw8IDE4KSAmIDB4MUMwMDAwKSB8ICgoYjIgPDwgMTIpICYgMHgzRjAwMCkgfCAoKGIzIDw8IDYpICYgMHhGQzApIHwgKGI0ICYgMHgzRik7XG5cbiAgICAgICAgICBpZiAoY2hhciA8IDB4MTAwMDAgfHwgY2hhciA+IDB4MTBGRkZGKSB7XG4gICAgICAgICAgICByZXN1bHQgKz0gJ1xcdWZmZmRcXHVmZmZkXFx1ZmZmZFxcdWZmZmQnO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjaGFyIC09IDB4MTAwMDA7XG4gICAgICAgICAgICByZXN1bHQgKz0gU3RyaW5nLmZyb21DaGFyQ29kZSgweEQ4MDAgKyAoY2hhciA+PiAxMCksIDB4REMwMCArIChjaGFyICYgMHgzRkYpKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpICs9IDk7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmVzdWx0ICs9ICdcXHVmZmZkJztcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9KTtcbn1cblxuXG5kZWNvZGUuZGVmYXVsdENoYXJzICAgPSAnOy8/OkAmPSskLCMnO1xuZGVjb2RlLmNvbXBvbmVudENoYXJzID0gJyc7XG5cblxubW9kdWxlLmV4cG9ydHMgPSBkZWNvZGU7XG4iLCJcbid1c2Ugc3RyaWN0JztcblxuXG52YXIgZW5jb2RlQ2FjaGUgPSB7fTtcblxuXG4vLyBDcmVhdGUgYSBsb29rdXAgYXJyYXkgd2hlcmUgYW55dGhpbmcgYnV0IGNoYXJhY3RlcnMgaW4gYGNoYXJzYCBzdHJpbmdcbi8vIGFuZCBhbHBoYW51bWVyaWMgY2hhcnMgaXMgcGVyY2VudC1lbmNvZGVkLlxuLy9cbmZ1bmN0aW9uIGdldEVuY29kZUNhY2hlKGV4Y2x1ZGUpIHtcbiAgdmFyIGksIGNoLCBjYWNoZSA9IGVuY29kZUNhY2hlW2V4Y2x1ZGVdO1xuICBpZiAoY2FjaGUpIHsgcmV0dXJuIGNhY2hlOyB9XG5cbiAgY2FjaGUgPSBlbmNvZGVDYWNoZVtleGNsdWRlXSA9IFtdO1xuXG4gIGZvciAoaSA9IDA7IGkgPCAxMjg7IGkrKykge1xuICAgIGNoID0gU3RyaW5nLmZyb21DaGFyQ29kZShpKTtcblxuICAgIGlmICgvXlswLTlhLXpdJC9pLnRlc3QoY2gpKSB7XG4gICAgICAvLyBhbHdheXMgYWxsb3cgdW5lbmNvZGVkIGFscGhhbnVtZXJpYyBjaGFyYWN0ZXJzXG4gICAgICBjYWNoZS5wdXNoKGNoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FjaGUucHVzaCgnJScgKyAoJzAnICsgaS50b1N0cmluZygxNikudG9VcHBlckNhc2UoKSkuc2xpY2UoLTIpKTtcbiAgICB9XG4gIH1cblxuICBmb3IgKGkgPSAwOyBpIDwgZXhjbHVkZS5sZW5ndGg7IGkrKykge1xuICAgIGNhY2hlW2V4Y2x1ZGUuY2hhckNvZGVBdChpKV0gPSBleGNsdWRlW2ldO1xuICB9XG5cbiAgcmV0dXJuIGNhY2hlO1xufVxuXG5cbi8vIEVuY29kZSB1bnNhZmUgY2hhcmFjdGVycyB3aXRoIHBlcmNlbnQtZW5jb2RpbmcsIHNraXBwaW5nIGFscmVhZHlcbi8vIGVuY29kZWQgc2VxdWVuY2VzLlxuLy9cbi8vICAtIHN0cmluZyAgICAgICAtIHN0cmluZyB0byBlbmNvZGVcbi8vICAtIGV4Y2x1ZGUgICAgICAtIGxpc3Qgb2YgY2hhcmFjdGVycyB0byBpZ25vcmUgKGluIGFkZGl0aW9uIHRvIGEtekEtWjAtOSlcbi8vICAtIGtlZXBFc2NhcGVkICAtIGRvbid0IGVuY29kZSAnJScgaW4gYSBjb3JyZWN0IGVzY2FwZSBzZXF1ZW5jZSAoZGVmYXVsdDogdHJ1ZSlcbi8vXG5mdW5jdGlvbiBlbmNvZGUoc3RyaW5nLCBleGNsdWRlLCBrZWVwRXNjYXBlZCkge1xuICB2YXIgaSwgbCwgY29kZSwgbmV4dENvZGUsIGNhY2hlLFxuICAgICAgcmVzdWx0ID0gJyc7XG5cbiAgaWYgKHR5cGVvZiBleGNsdWRlICE9PSAnc3RyaW5nJykge1xuICAgIC8vIGVuY29kZShzdHJpbmcsIGtlZXBFc2NhcGVkKVxuICAgIGtlZXBFc2NhcGVkICA9IGV4Y2x1ZGU7XG4gICAgZXhjbHVkZSA9IGVuY29kZS5kZWZhdWx0Q2hhcnM7XG4gIH1cblxuICBpZiAodHlwZW9mIGtlZXBFc2NhcGVkID09PSAndW5kZWZpbmVkJykge1xuICAgIGtlZXBFc2NhcGVkID0gdHJ1ZTtcbiAgfVxuXG4gIGNhY2hlID0gZ2V0RW5jb2RlQ2FjaGUoZXhjbHVkZSk7XG5cbiAgZm9yIChpID0gMCwgbCA9IHN0cmluZy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBjb2RlID0gc3RyaW5nLmNoYXJDb2RlQXQoaSk7XG5cbiAgICBpZiAoa2VlcEVzY2FwZWQgJiYgY29kZSA9PT0gMHgyNSAvKiAlICovICYmIGkgKyAyIDwgbCkge1xuICAgICAgaWYgKC9eWzAtOWEtZl17Mn0kL2kudGVzdChzdHJpbmcuc2xpY2UoaSArIDEsIGkgKyAzKSkpIHtcbiAgICAgICAgcmVzdWx0ICs9IHN0cmluZy5zbGljZShpLCBpICsgMyk7XG4gICAgICAgIGkgKz0gMjtcbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGNvZGUgPCAxMjgpIHtcbiAgICAgIHJlc3VsdCArPSBjYWNoZVtjb2RlXTtcbiAgICAgIGNvbnRpbnVlO1xuICAgIH1cblxuICAgIGlmIChjb2RlID49IDB4RDgwMCAmJiBjb2RlIDw9IDB4REZGRikge1xuICAgICAgaWYgKGNvZGUgPj0gMHhEODAwICYmIGNvZGUgPD0gMHhEQkZGICYmIGkgKyAxIDwgbCkge1xuICAgICAgICBuZXh0Q29kZSA9IHN0cmluZy5jaGFyQ29kZUF0KGkgKyAxKTtcbiAgICAgICAgaWYgKG5leHRDb2RlID49IDB4REMwMCAmJiBuZXh0Q29kZSA8PSAweERGRkYpIHtcbiAgICAgICAgICByZXN1bHQgKz0gZW5jb2RlVVJJQ29tcG9uZW50KHN0cmluZ1tpXSArIHN0cmluZ1tpICsgMV0pO1xuICAgICAgICAgIGkrKztcbiAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmVzdWx0ICs9ICclRUYlQkYlQkQnO1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgcmVzdWx0ICs9IGVuY29kZVVSSUNvbXBvbmVudChzdHJpbmdbaV0pO1xuICB9XG5cbiAgcmV0dXJuIHJlc3VsdDtcbn1cblxuZW5jb2RlLmRlZmF1bHRDaGFycyAgID0gXCI7Lz86QCY9KyQsLV8uIX4qJygpI1wiO1xuZW5jb2RlLmNvbXBvbmVudENoYXJzID0gXCItXy4hfionKClcIjtcblxuXG5tb2R1bGUuZXhwb3J0cyA9IGVuY29kZTtcbiIsIlxuJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gZm9ybWF0KHVybCkge1xuICB2YXIgcmVzdWx0ID0gJyc7XG5cbiAgcmVzdWx0ICs9IHVybC5wcm90b2NvbCB8fCAnJztcbiAgcmVzdWx0ICs9IHVybC5zbGFzaGVzID8gJy8vJyA6ICcnO1xuICByZXN1bHQgKz0gdXJsLmF1dGggPyB1cmwuYXV0aCArICdAJyA6ICcnO1xuXG4gIGlmICh1cmwuaG9zdG5hbWUgJiYgdXJsLmhvc3RuYW1lLmluZGV4T2YoJzonKSAhPT0gLTEpIHtcbiAgICAvLyBpcHY2IGFkZHJlc3NcbiAgICByZXN1bHQgKz0gJ1snICsgdXJsLmhvc3RuYW1lICsgJ10nO1xuICB9IGVsc2Uge1xuICAgIHJlc3VsdCArPSB1cmwuaG9zdG5hbWUgfHwgJyc7XG4gIH1cblxuICByZXN1bHQgKz0gdXJsLnBvcnQgPyAnOicgKyB1cmwucG9ydCA6ICcnO1xuICByZXN1bHQgKz0gdXJsLnBhdGhuYW1lIHx8ICcnO1xuICByZXN1bHQgKz0gdXJsLnNlYXJjaCB8fCAnJztcbiAgcmVzdWx0ICs9IHVybC5oYXNoIHx8ICcnO1xuXG4gIHJldHVybiByZXN1bHQ7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5cbm1vZHVsZS5leHBvcnRzLmVuY29kZSA9IHJlcXVpcmUoJy4vZW5jb2RlJyk7XG5tb2R1bGUuZXhwb3J0cy5kZWNvZGUgPSByZXF1aXJlKCcuL2RlY29kZScpO1xubW9kdWxlLmV4cG9ydHMuZm9ybWF0ID0gcmVxdWlyZSgnLi9mb3JtYXQnKTtcbm1vZHVsZS5leHBvcnRzLnBhcnNlICA9IHJlcXVpcmUoJy4vcGFyc2UnKTtcbiIsIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4ndXNlIHN0cmljdCc7XG5cbi8vXG4vLyBDaGFuZ2VzIGZyb20gam95ZW50L25vZGU6XG4vL1xuLy8gMS4gTm8gbGVhZGluZyBzbGFzaCBpbiBwYXRocyxcbi8vICAgIGUuZy4gaW4gYHVybC5wYXJzZSgnaHR0cDovL2Zvbz9iYXInKWAgcGF0aG5hbWUgaXMgYGAsIG5vdCBgL2Bcbi8vXG4vLyAyLiBCYWNrc2xhc2hlcyBhcmUgbm90IHJlcGxhY2VkIHdpdGggc2xhc2hlcyxcbi8vICAgIHNvIGBodHRwOlxcXFxleGFtcGxlLm9yZ1xcYCBpcyB0cmVhdGVkIGxpa2UgYSByZWxhdGl2ZSBwYXRoXG4vL1xuLy8gMy4gVHJhaWxpbmcgY29sb24gaXMgdHJlYXRlZCBsaWtlIGEgcGFydCBvZiB0aGUgcGF0aCxcbi8vICAgIGkuZS4gaW4gYGh0dHA6Ly9leGFtcGxlLm9yZzpmb29gIHBhdGhuYW1lIGlzIGA6Zm9vYFxuLy9cbi8vIDQuIE5vdGhpbmcgaXMgVVJMLWVuY29kZWQgaW4gdGhlIHJlc3VsdGluZyBvYmplY3QsXG4vLyAgICAoaW4gam95ZW50L25vZGUgc29tZSBjaGFycyBpbiBhdXRoIGFuZCBwYXRocyBhcmUgZW5jb2RlZClcbi8vXG4vLyA1LiBgdXJsLnBhcnNlKClgIGRvZXMgbm90IGhhdmUgYHBhcnNlUXVlcnlTdHJpbmdgIGFyZ3VtZW50XG4vL1xuLy8gNi4gUmVtb3ZlZCBleHRyYW5lb3VzIHJlc3VsdCBwcm9wZXJ0aWVzOiBgaG9zdGAsIGBwYXRoYCwgYHF1ZXJ5YCwgZXRjLixcbi8vICAgIHdoaWNoIGNhbiBiZSBjb25zdHJ1Y3RlZCB1c2luZyBvdGhlciBwYXJ0cyBvZiB0aGUgdXJsLlxuLy9cblxuXG5mdW5jdGlvbiBVcmwoKSB7XG4gIHRoaXMucHJvdG9jb2wgPSBudWxsO1xuICB0aGlzLnNsYXNoZXMgPSBudWxsO1xuICB0aGlzLmF1dGggPSBudWxsO1xuICB0aGlzLnBvcnQgPSBudWxsO1xuICB0aGlzLmhvc3RuYW1lID0gbnVsbDtcbiAgdGhpcy5oYXNoID0gbnVsbDtcbiAgdGhpcy5zZWFyY2ggPSBudWxsO1xuICB0aGlzLnBhdGhuYW1lID0gbnVsbDtcbn1cblxuLy8gUmVmZXJlbmNlOiBSRkMgMzk4NiwgUkZDIDE4MDgsIFJGQyAyMzk2XG5cbi8vIGRlZmluZSB0aGVzZSBoZXJlIHNvIGF0IGxlYXN0IHRoZXkgb25seSBoYXZlIHRvIGJlXG4vLyBjb21waWxlZCBvbmNlIG9uIHRoZSBmaXJzdCBtb2R1bGUgbG9hZC5cbnZhciBwcm90b2NvbFBhdHRlcm4gPSAvXihbYS16MC05ListXSs6KS9pLFxuICAgIHBvcnRQYXR0ZXJuID0gLzpbMC05XSokLyxcblxuICAgIC8vIFNwZWNpYWwgY2FzZSBmb3IgYSBzaW1wbGUgcGF0aCBVUkxcbiAgICBzaW1wbGVQYXRoUGF0dGVybiA9IC9eKFxcL1xcLz8oPyFcXC8pW15cXD9cXHNdKikoXFw/W15cXHNdKik/JC8sXG5cbiAgICAvLyBSRkMgMjM5NjogY2hhcmFjdGVycyByZXNlcnZlZCBmb3IgZGVsaW1pdGluZyBVUkxzLlxuICAgIC8vIFdlIGFjdHVhbGx5IGp1c3QgYXV0by1lc2NhcGUgdGhlc2UuXG4gICAgZGVsaW1zID0gWyAnPCcsICc+JywgJ1wiJywgJ2AnLCAnICcsICdcXHInLCAnXFxuJywgJ1xcdCcgXSxcblxuICAgIC8vIFJGQyAyMzk2OiBjaGFyYWN0ZXJzIG5vdCBhbGxvd2VkIGZvciB2YXJpb3VzIHJlYXNvbnMuXG4gICAgdW53aXNlID0gWyAneycsICd9JywgJ3wnLCAnXFxcXCcsICdeJywgJ2AnIF0uY29uY2F0KGRlbGltcyksXG5cbiAgICAvLyBBbGxvd2VkIGJ5IFJGQ3MsIGJ1dCBjYXVzZSBvZiBYU1MgYXR0YWNrcy4gIEFsd2F5cyBlc2NhcGUgdGhlc2UuXG4gICAgYXV0b0VzY2FwZSA9IFsgJ1xcJycgXS5jb25jYXQodW53aXNlKSxcbiAgICAvLyBDaGFyYWN0ZXJzIHRoYXQgYXJlIG5ldmVyIGV2ZXIgYWxsb3dlZCBpbiBhIGhvc3RuYW1lLlxuICAgIC8vIE5vdGUgdGhhdCBhbnkgaW52YWxpZCBjaGFycyBhcmUgYWxzbyBoYW5kbGVkLCBidXQgdGhlc2VcbiAgICAvLyBhcmUgdGhlIG9uZXMgdGhhdCBhcmUgKmV4cGVjdGVkKiB0byBiZSBzZWVuLCBzbyB3ZSBmYXN0LXBhdGhcbiAgICAvLyB0aGVtLlxuICAgIG5vbkhvc3RDaGFycyA9IFsgJyUnLCAnLycsICc/JywgJzsnLCAnIycgXS5jb25jYXQoYXV0b0VzY2FwZSksXG4gICAgaG9zdEVuZGluZ0NoYXJzID0gWyAnLycsICc/JywgJyMnIF0sXG4gICAgaG9zdG5hbWVNYXhMZW4gPSAyNTUsXG4gICAgaG9zdG5hbWVQYXJ0UGF0dGVybiA9IC9eWythLXowLTlBLVpfLV17MCw2M30kLyxcbiAgICBob3N0bmFtZVBhcnRTdGFydCA9IC9eKFsrYS16MC05QS1aXy1dezAsNjN9KSguKikkLyxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBjYW4gYWxsb3cgXCJ1bnNhZmVcIiBhbmQgXCJ1bndpc2VcIiBjaGFycy5cbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1zY3JpcHQtdXJsICovXG4gICAgLy8gcHJvdG9jb2xzIHRoYXQgbmV2ZXIgaGF2ZSBhIGhvc3RuYW1lLlxuICAgIGhvc3RsZXNzUHJvdG9jb2wgPSB7XG4gICAgICAnamF2YXNjcmlwdCc6IHRydWUsXG4gICAgICAnamF2YXNjcmlwdDonOiB0cnVlXG4gICAgfSxcbiAgICAvLyBwcm90b2NvbHMgdGhhdCBhbHdheXMgY29udGFpbiBhIC8vIGJpdC5cbiAgICBzbGFzaGVkUHJvdG9jb2wgPSB7XG4gICAgICAnaHR0cCc6IHRydWUsXG4gICAgICAnaHR0cHMnOiB0cnVlLFxuICAgICAgJ2Z0cCc6IHRydWUsXG4gICAgICAnZ29waGVyJzogdHJ1ZSxcbiAgICAgICdmaWxlJzogdHJ1ZSxcbiAgICAgICdodHRwOic6IHRydWUsXG4gICAgICAnaHR0cHM6JzogdHJ1ZSxcbiAgICAgICdmdHA6JzogdHJ1ZSxcbiAgICAgICdnb3BoZXI6JzogdHJ1ZSxcbiAgICAgICdmaWxlOic6IHRydWVcbiAgICB9O1xuICAgIC8qIGVzbGludC1lbmFibGUgbm8tc2NyaXB0LXVybCAqL1xuXG5mdW5jdGlvbiB1cmxQYXJzZSh1cmwsIHNsYXNoZXNEZW5vdGVIb3N0KSB7XG4gIGlmICh1cmwgJiYgdXJsIGluc3RhbmNlb2YgVXJsKSB7IHJldHVybiB1cmw7IH1cblxuICB2YXIgdSA9IG5ldyBVcmwoKTtcbiAgdS5wYXJzZSh1cmwsIHNsYXNoZXNEZW5vdGVIb3N0KTtcbiAgcmV0dXJuIHU7XG59XG5cblVybC5wcm90b3R5cGUucGFyc2UgPSBmdW5jdGlvbih1cmwsIHNsYXNoZXNEZW5vdGVIb3N0KSB7XG4gIHZhciBpLCBsLCBsb3dlclByb3RvLCBoZWMsIHNsYXNoZXMsXG4gICAgICByZXN0ID0gdXJsO1xuXG4gIC8vIHRyaW0gYmVmb3JlIHByb2NlZWRpbmcuXG4gIC8vIFRoaXMgaXMgdG8gc3VwcG9ydCBwYXJzZSBzdHVmZiBsaWtlIFwiICBodHRwOi8vZm9vLmNvbSAgXFxuXCJcbiAgcmVzdCA9IHJlc3QudHJpbSgpO1xuXG4gIGlmICghc2xhc2hlc0Rlbm90ZUhvc3QgJiYgdXJsLnNwbGl0KCcjJykubGVuZ3RoID09PSAxKSB7XG4gICAgLy8gVHJ5IGZhc3QgcGF0aCByZWdleHBcbiAgICB2YXIgc2ltcGxlUGF0aCA9IHNpbXBsZVBhdGhQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gICAgaWYgKHNpbXBsZVBhdGgpIHtcbiAgICAgIHRoaXMucGF0aG5hbWUgPSBzaW1wbGVQYXRoWzFdO1xuICAgICAgaWYgKHNpbXBsZVBhdGhbMl0pIHtcbiAgICAgICAgdGhpcy5zZWFyY2ggPSBzaW1wbGVQYXRoWzJdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuICB9XG5cbiAgdmFyIHByb3RvID0gcHJvdG9jb2xQYXR0ZXJuLmV4ZWMocmVzdCk7XG4gIGlmIChwcm90bykge1xuICAgIHByb3RvID0gcHJvdG9bMF07XG4gICAgbG93ZXJQcm90byA9IHByb3RvLnRvTG93ZXJDYXNlKCk7XG4gICAgdGhpcy5wcm90b2NvbCA9IHByb3RvO1xuICAgIHJlc3QgPSByZXN0LnN1YnN0cihwcm90by5sZW5ndGgpO1xuICB9XG5cbiAgLy8gZmlndXJlIG91dCBpZiBpdCdzIGdvdCBhIGhvc3RcbiAgLy8gdXNlckBzZXJ2ZXIgaXMgKmFsd2F5cyogaW50ZXJwcmV0ZWQgYXMgYSBob3N0bmFtZSwgYW5kIHVybFxuICAvLyByZXNvbHV0aW9uIHdpbGwgdHJlYXQgLy9mb28vYmFyIGFzIGhvc3Q9Zm9vLHBhdGg9YmFyIGJlY2F1c2UgdGhhdCdzXG4gIC8vIGhvdyB0aGUgYnJvd3NlciByZXNvbHZlcyByZWxhdGl2ZSBVUkxzLlxuICBpZiAoc2xhc2hlc0Rlbm90ZUhvc3QgfHwgcHJvdG8gfHwgcmVzdC5tYXRjaCgvXlxcL1xcL1teQFxcL10rQFteQFxcL10rLykpIHtcbiAgICBzbGFzaGVzID0gcmVzdC5zdWJzdHIoMCwgMikgPT09ICcvLyc7XG4gICAgaWYgKHNsYXNoZXMgJiYgIShwcm90byAmJiBob3N0bGVzc1Byb3RvY29sW3Byb3RvXSkpIHtcbiAgICAgIHJlc3QgPSByZXN0LnN1YnN0cigyKTtcbiAgICAgIHRoaXMuc2xhc2hlcyA9IHRydWU7XG4gICAgfVxuICB9XG5cbiAgaWYgKCFob3N0bGVzc1Byb3RvY29sW3Byb3RvXSAmJlxuICAgICAgKHNsYXNoZXMgfHwgKHByb3RvICYmICFzbGFzaGVkUHJvdG9jb2xbcHJvdG9dKSkpIHtcblxuICAgIC8vIHRoZXJlJ3MgYSBob3N0bmFtZS5cbiAgICAvLyB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgLywgPywgOywgb3IgIyBlbmRzIHRoZSBob3N0LlxuICAgIC8vXG4gICAgLy8gSWYgdGhlcmUgaXMgYW4gQCBpbiB0aGUgaG9zdG5hbWUsIHRoZW4gbm9uLWhvc3QgY2hhcnMgKmFyZSogYWxsb3dlZFxuICAgIC8vIHRvIHRoZSBsZWZ0IG9mIHRoZSBsYXN0IEAgc2lnbiwgdW5sZXNzIHNvbWUgaG9zdC1lbmRpbmcgY2hhcmFjdGVyXG4gICAgLy8gY29tZXMgKmJlZm9yZSogdGhlIEAtc2lnbi5cbiAgICAvLyBVUkxzIGFyZSBvYm5veGlvdXMuXG4gICAgLy9cbiAgICAvLyBleDpcbiAgICAvLyBodHRwOi8vYUBiQGMvID0+IHVzZXI6YUBiIGhvc3Q6Y1xuICAgIC8vIGh0dHA6Ly9hQGI/QGMgPT4gdXNlcjphIGhvc3Q6YyBwYXRoOi8/QGNcblxuICAgIC8vIHYwLjEyIFRPRE8oaXNhYWNzKTogVGhpcyBpcyBub3QgcXVpdGUgaG93IENocm9tZSBkb2VzIHRoaW5ncy5cbiAgICAvLyBSZXZpZXcgb3VyIHRlc3QgY2FzZSBhZ2FpbnN0IGJyb3dzZXJzIG1vcmUgY29tcHJlaGVuc2l2ZWx5LlxuXG4gICAgLy8gZmluZCB0aGUgZmlyc3QgaW5zdGFuY2Ugb2YgYW55IGhvc3RFbmRpbmdDaGFyc1xuICAgIHZhciBob3N0RW5kID0gLTE7XG4gICAgZm9yIChpID0gMDsgaSA8IGhvc3RFbmRpbmdDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgaGVjID0gcmVzdC5pbmRleE9mKGhvc3RFbmRpbmdDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpIHtcbiAgICAgICAgaG9zdEVuZCA9IGhlYztcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBhdCB0aGlzIHBvaW50LCBlaXRoZXIgd2UgaGF2ZSBhbiBleHBsaWNpdCBwb2ludCB3aGVyZSB0aGVcbiAgICAvLyBhdXRoIHBvcnRpb24gY2Fubm90IGdvIHBhc3QsIG9yIHRoZSBsYXN0IEAgY2hhciBpcyB0aGUgZGVjaWRlci5cbiAgICB2YXIgYXV0aCwgYXRTaWduO1xuICAgIGlmIChob3N0RW5kID09PSAtMSkge1xuICAgICAgLy8gYXRTaWduIGNhbiBiZSBhbnl3aGVyZS5cbiAgICAgIGF0U2lnbiA9IHJlc3QubGFzdEluZGV4T2YoJ0AnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gYXRTaWduIG11c3QgYmUgaW4gYXV0aCBwb3J0aW9uLlxuICAgICAgLy8gaHR0cDovL2FAYi9jQGQgPT4gaG9zdDpiIGF1dGg6YSBwYXRoOi9jQGRcbiAgICAgIGF0U2lnbiA9IHJlc3QubGFzdEluZGV4T2YoJ0AnLCBob3N0RW5kKTtcbiAgICB9XG5cbiAgICAvLyBOb3cgd2UgaGF2ZSBhIHBvcnRpb24gd2hpY2ggaXMgZGVmaW5pdGVseSB0aGUgYXV0aC5cbiAgICAvLyBQdWxsIHRoYXQgb2ZmLlxuICAgIGlmIChhdFNpZ24gIT09IC0xKSB7XG4gICAgICBhdXRoID0gcmVzdC5zbGljZSgwLCBhdFNpZ24pO1xuICAgICAgcmVzdCA9IHJlc3Quc2xpY2UoYXRTaWduICsgMSk7XG4gICAgICB0aGlzLmF1dGggPSBhdXRoO1xuICAgIH1cblxuICAgIC8vIHRoZSBob3N0IGlzIHRoZSByZW1haW5pbmcgdG8gdGhlIGxlZnQgb2YgdGhlIGZpcnN0IG5vbi1ob3N0IGNoYXJcbiAgICBob3N0RW5kID0gLTE7XG4gICAgZm9yIChpID0gMDsgaSA8IG5vbkhvc3RDaGFycy5sZW5ndGg7IGkrKykge1xuICAgICAgaGVjID0gcmVzdC5pbmRleE9mKG5vbkhvc3RDaGFyc1tpXSk7XG4gICAgICBpZiAoaGVjICE9PSAtMSAmJiAoaG9zdEVuZCA9PT0gLTEgfHwgaGVjIDwgaG9zdEVuZCkpIHtcbiAgICAgICAgaG9zdEVuZCA9IGhlYztcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gaWYgd2Ugc3RpbGwgaGF2ZSBub3QgaGl0IGl0LCB0aGVuIHRoZSBlbnRpcmUgdGhpbmcgaXMgYSBob3N0LlxuICAgIGlmIChob3N0RW5kID09PSAtMSkge1xuICAgICAgaG9zdEVuZCA9IHJlc3QubGVuZ3RoO1xuICAgIH1cblxuICAgIGlmIChyZXN0W2hvc3RFbmQgLSAxXSA9PT0gJzonKSB7IGhvc3RFbmQtLTsgfVxuICAgIHZhciBob3N0ID0gcmVzdC5zbGljZSgwLCBob3N0RW5kKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZShob3N0RW5kKTtcblxuICAgIC8vIHB1bGwgb3V0IHBvcnQuXG4gICAgdGhpcy5wYXJzZUhvc3QoaG9zdCk7XG5cbiAgICAvLyB3ZSd2ZSBpbmRpY2F0ZWQgdGhhdCB0aGVyZSBpcyBhIGhvc3RuYW1lLFxuICAgIC8vIHNvIGV2ZW4gaWYgaXQncyBlbXB0eSwgaXQgaGFzIHRvIGJlIHByZXNlbnQuXG4gICAgdGhpcy5ob3N0bmFtZSA9IHRoaXMuaG9zdG5hbWUgfHwgJyc7XG5cbiAgICAvLyBpZiBob3N0bmFtZSBiZWdpbnMgd2l0aCBbIGFuZCBlbmRzIHdpdGggXVxuICAgIC8vIGFzc3VtZSB0aGF0IGl0J3MgYW4gSVB2NiBhZGRyZXNzLlxuICAgIHZhciBpcHY2SG9zdG5hbWUgPSB0aGlzLmhvc3RuYW1lWzBdID09PSAnWycgJiZcbiAgICAgICAgdGhpcy5ob3N0bmFtZVt0aGlzLmhvc3RuYW1lLmxlbmd0aCAtIDFdID09PSAnXSc7XG5cbiAgICAvLyB2YWxpZGF0ZSBhIGxpdHRsZS5cbiAgICBpZiAoIWlwdjZIb3N0bmFtZSkge1xuICAgICAgdmFyIGhvc3RwYXJ0cyA9IHRoaXMuaG9zdG5hbWUuc3BsaXQoL1xcLi8pO1xuICAgICAgZm9yIChpID0gMCwgbCA9IGhvc3RwYXJ0cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgdmFyIHBhcnQgPSBob3N0cGFydHNbaV07XG4gICAgICAgIGlmICghcGFydCkgeyBjb250aW51ZTsgfVxuICAgICAgICBpZiAoIXBhcnQubWF0Y2goaG9zdG5hbWVQYXJ0UGF0dGVybikpIHtcbiAgICAgICAgICB2YXIgbmV3cGFydCA9ICcnO1xuICAgICAgICAgIGZvciAodmFyIGogPSAwLCBrID0gcGFydC5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgIGlmIChwYXJ0LmNoYXJDb2RlQXQoaikgPiAxMjcpIHtcbiAgICAgICAgICAgICAgLy8gd2UgcmVwbGFjZSBub24tQVNDSUkgY2hhciB3aXRoIGEgdGVtcG9yYXJ5IHBsYWNlaG9sZGVyXG4gICAgICAgICAgICAgIC8vIHdlIG5lZWQgdGhpcyB0byBtYWtlIHN1cmUgc2l6ZSBvZiBob3N0bmFtZSBpcyBub3RcbiAgICAgICAgICAgICAgLy8gYnJva2VuIGJ5IHJlcGxhY2luZyBub24tQVNDSUkgYnkgbm90aGluZ1xuICAgICAgICAgICAgICBuZXdwYXJ0ICs9ICd4JztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG5ld3BhcnQgKz0gcGFydFtqXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy8gd2UgdGVzdCBhZ2FpbiB3aXRoIEFTQ0lJIGNoYXIgb25seVxuICAgICAgICAgIGlmICghbmV3cGFydC5tYXRjaChob3N0bmFtZVBhcnRQYXR0ZXJuKSkge1xuICAgICAgICAgICAgdmFyIHZhbGlkUGFydHMgPSBob3N0cGFydHMuc2xpY2UoMCwgaSk7XG4gICAgICAgICAgICB2YXIgbm90SG9zdCA9IGhvc3RwYXJ0cy5zbGljZShpICsgMSk7XG4gICAgICAgICAgICB2YXIgYml0ID0gcGFydC5tYXRjaChob3N0bmFtZVBhcnRTdGFydCk7XG4gICAgICAgICAgICBpZiAoYml0KSB7XG4gICAgICAgICAgICAgIHZhbGlkUGFydHMucHVzaChiaXRbMV0pO1xuICAgICAgICAgICAgICBub3RIb3N0LnVuc2hpZnQoYml0WzJdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChub3RIb3N0Lmxlbmd0aCkge1xuICAgICAgICAgICAgICByZXN0ID0gbm90SG9zdC5qb2luKCcuJykgKyByZXN0O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5ob3N0bmFtZSA9IHZhbGlkUGFydHMuam9pbignLicpO1xuICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuaG9zdG5hbWUubGVuZ3RoID4gaG9zdG5hbWVNYXhMZW4pIHtcbiAgICAgIHRoaXMuaG9zdG5hbWUgPSAnJztcbiAgICB9XG5cbiAgICAvLyBzdHJpcCBbIGFuZCBdIGZyb20gdGhlIGhvc3RuYW1lXG4gICAgLy8gdGhlIGhvc3QgZmllbGQgc3RpbGwgcmV0YWlucyB0aGVtLCB0aG91Z2hcbiAgICBpZiAoaXB2Nkhvc3RuYW1lKSB7XG4gICAgICB0aGlzLmhvc3RuYW1lID0gdGhpcy5ob3N0bmFtZS5zdWJzdHIoMSwgdGhpcy5ob3N0bmFtZS5sZW5ndGggLSAyKTtcbiAgICB9XG4gIH1cblxuICAvLyBjaG9wIG9mZiBmcm9tIHRoZSB0YWlsIGZpcnN0LlxuICB2YXIgaGFzaCA9IHJlc3QuaW5kZXhPZignIycpO1xuICBpZiAoaGFzaCAhPT0gLTEpIHtcbiAgICAvLyBnb3QgYSBmcmFnbWVudCBzdHJpbmcuXG4gICAgdGhpcy5oYXNoID0gcmVzdC5zdWJzdHIoaGFzaCk7XG4gICAgcmVzdCA9IHJlc3Quc2xpY2UoMCwgaGFzaCk7XG4gIH1cbiAgdmFyIHFtID0gcmVzdC5pbmRleE9mKCc/Jyk7XG4gIGlmIChxbSAhPT0gLTEpIHtcbiAgICB0aGlzLnNlYXJjaCA9IHJlc3Quc3Vic3RyKHFtKTtcbiAgICByZXN0ID0gcmVzdC5zbGljZSgwLCBxbSk7XG4gIH1cbiAgaWYgKHJlc3QpIHsgdGhpcy5wYXRobmFtZSA9IHJlc3Q7IH1cbiAgaWYgKHNsYXNoZWRQcm90b2NvbFtsb3dlclByb3RvXSAmJlxuICAgICAgdGhpcy5ob3N0bmFtZSAmJiAhdGhpcy5wYXRobmFtZSkge1xuICAgIHRoaXMucGF0aG5hbWUgPSAnJztcbiAgfVxuXG4gIHJldHVybiB0aGlzO1xufTtcblxuVXJsLnByb3RvdHlwZS5wYXJzZUhvc3QgPSBmdW5jdGlvbihob3N0KSB7XG4gIHZhciBwb3J0ID0gcG9ydFBhdHRlcm4uZXhlYyhob3N0KTtcbiAgaWYgKHBvcnQpIHtcbiAgICBwb3J0ID0gcG9ydFswXTtcbiAgICBpZiAocG9ydCAhPT0gJzonKSB7XG4gICAgICB0aGlzLnBvcnQgPSBwb3J0LnN1YnN0cigxKTtcbiAgICB9XG4gICAgaG9zdCA9IGhvc3Quc3Vic3RyKDAsIGhvc3QubGVuZ3RoIC0gcG9ydC5sZW5ndGgpO1xuICB9XG4gIGlmIChob3N0KSB7IHRoaXMuaG9zdG5hbWUgPSBob3N0OyB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IHVybFBhcnNlO1xuIiwiXG5tb2R1bGUuZXhwb3J0cy5BbnkgPSByZXF1aXJlKCcuL3Byb3BlcnRpZXMvQW55L3JlZ2V4Jyk7XG5tb2R1bGUuZXhwb3J0cy5DYyAgPSByZXF1aXJlKCcuL2NhdGVnb3JpZXMvQ2MvcmVnZXgnKTtcbm1vZHVsZS5leHBvcnRzLkNmICA9IHJlcXVpcmUoJy4vY2F0ZWdvcmllcy9DZi9yZWdleCcpO1xubW9kdWxlLmV4cG9ydHMuUCAgID0gcmVxdWlyZSgnLi9jYXRlZ29yaWVzL1AvcmVnZXgnKTtcbm1vZHVsZS5leHBvcnRzLlogICA9IHJlcXVpcmUoJy4vY2F0ZWdvcmllcy9aL3JlZ2V4Jyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbi8vIHRoZSBtYWpvcml0eSBvZiB0aGlzIGZpbGUgd2FzIHRha2VuIGZyb20gbWFya2Rvd24taXQncyBsaW5raWZ5IG1ldGhvZFxuLy8gaHR0cHM6Ly9naXRodWIuY29tL21hcmtkb3duLWl0L21hcmtkb3duLWl0L2Jsb2IvOTE1OTAxOGUyYTQ0NmZjOTdlYjNjNmU1MDlhOGNkYzRjYzNjMzU4YS9saWIvcnVsZXNfY29yZS9saW5raWZ5LmpzXG5cbnZhciBsaW5raWZ5ID0gcmVxdWlyZSgnbGlua2lmeS1pdCcpKCk7XG5cbmZ1bmN0aW9uIGFycmF5UmVwbGFjZUF0IChhLCBpLCBtaWRkbGUpIHtcbiAgdmFyIGxlZnQgPSBhLnNsaWNlKDAsIGkpO1xuICB2YXIgcmlnaHQgPSBhLnNsaWNlKGkgKyAxKTtcbiAgcmV0dXJuIGxlZnQuY29uY2F0KG1pZGRsZSwgcmlnaHQpO1xufVxuXG5mdW5jdGlvbiBpc0xpbmtPcGVuIChzdHIpIHtcbiAgcmV0dXJuIC9ePGFbPlxcc10vaS50ZXN0KHN0cik7XG59XG5cbmZ1bmN0aW9uIGlzTGlua0Nsb3NlIChzdHIpIHtcbiAgcmV0dXJuIC9ePFxcL2FcXHMqPi9pLnRlc3Qoc3RyKTtcbn1cblxuZnVuY3Rpb24gdG9rZW5pemVMaW5rcyAoc3RhdGUsIGNvbnRleHQpIHtcbiAgdmFyIGk7XG4gIHZhciBqO1xuICB2YXIgbDtcbiAgdmFyIHRva2VucztcbiAgdmFyIHRva2VuO1xuICB2YXIgbm9kZXM7XG4gIHZhciBsbjtcbiAgdmFyIHRleHQ7XG4gIHZhciBwb3M7XG4gIHZhciBsYXN0UG9zO1xuICB2YXIgbGV2ZWw7XG4gIHZhciBsaW5rcztcbiAgdmFyIGh0bWxMaW5rTGV2ZWw7XG4gIHZhciBibG9ja1Rva2VucyA9IHN0YXRlLnRva2VucztcbiAgdmFyIGh0bWw7XG5cbiAgZm9yIChqID0gMCwgbCA9IGJsb2NrVG9rZW5zLmxlbmd0aDsgaiA8IGw7IGorKykge1xuICAgIGlmIChibG9ja1Rva2Vuc1tqXS50eXBlICE9PSAnaW5saW5lJykge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgdG9rZW5zID0gYmxvY2tUb2tlbnNbal0uY2hpbGRyZW47XG4gICAgaHRtbExpbmtMZXZlbCA9IDA7XG5cbiAgICAvLyB3ZSBzY2FuIGZyb20gdGhlIGVuZCwgdG8ga2VlcCBwb3NpdGlvbiB3aGVuIG5ldyB0YWdzIGFkZGVkLlxuICAgIC8vIHVzZSByZXZlcnNlZCBsb2dpYyBpbiBsaW5rcyBzdGFydC9lbmQgbWF0Y2hcbiAgICBmb3IgKGkgPSB0b2tlbnMubGVuZ3RoIC0gMTsgaSA+PSAwOyBpLS0pIHtcbiAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuXG4gICAgICAvLyBza2lwIGNvbnRlbnQgb2YgbWFya2Rvd24gbGlua3NcbiAgICAgIGlmICh0b2tlbi50eXBlID09PSAnbGlua19jbG9zZScpIHtcbiAgICAgICAgaS0tO1xuICAgICAgICB3aGlsZSAodG9rZW5zW2ldLmxldmVsICE9PSB0b2tlbi5sZXZlbCAmJiB0b2tlbnNbaV0udHlwZSAhPT0gJ2xpbmtfb3BlbicpIHtcbiAgICAgICAgICBpLS07XG4gICAgICAgIH1cbiAgICAgICAgY29udGludWU7XG4gICAgICB9XG5cbiAgICAgIGlmICh0b2tlbi50eXBlID09PSAnaHRtbF9pbmxpbmUnKSB7IC8vIHNraXAgY29udGVudCBvZiBodG1sIHRhZyBsaW5rc1xuICAgICAgICBpZiAoaXNMaW5rT3Blbih0b2tlbi5jb250ZW50KSAmJiBodG1sTGlua0xldmVsID4gMCkge1xuICAgICAgICAgIGh0bWxMaW5rTGV2ZWwtLTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoaXNMaW5rQ2xvc2UodG9rZW4uY29udGVudCkpIHtcbiAgICAgICAgICBodG1sTGlua0xldmVsKys7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICAgIGlmIChodG1sTGlua0xldmVsID4gMCkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIGlmICh0b2tlbi50eXBlICE9PSAndGV4dCcgfHwgIWxpbmtpZnkudGVzdCh0b2tlbi5jb250ZW50KSkge1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgdGV4dCA9IHRva2VuLmNvbnRlbnQ7XG4gICAgICBsaW5rcyA9IGxpbmtpZnkubWF0Y2godGV4dCk7XG4gICAgICBub2RlcyA9IFtdO1xuICAgICAgbGV2ZWwgPSB0b2tlbi5sZXZlbDtcbiAgICAgIGxhc3RQb3MgPSAwO1xuXG4gICAgICBmb3IgKGxuID0gMDsgbG4gPCBsaW5rcy5sZW5ndGg7IGxuKyspIHsgLy8gc3BsaXQgc3RyaW5nIHRvIG5vZGVzXG4gICAgICAgIGlmICghc3RhdGUubWQudmFsaWRhdGVMaW5rKGxpbmtzW2xuXS51cmwpKSB7XG4gICAgICAgICAgY29udGludWU7XG4gICAgICAgIH1cblxuICAgICAgICBwb3MgPSBsaW5rc1tsbl0uaW5kZXg7XG5cbiAgICAgICAgaWYgKHBvcyA+IGxhc3RQb3MpIHtcbiAgICAgICAgICBsZXZlbCA9IGxldmVsO1xuICAgICAgICAgIG5vZGVzLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgICAgY29udGVudDogdGV4dC5zbGljZShsYXN0UG9zLCBwb3MpLFxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBodG1sID0gbnVsbDtcblxuICAgICAgICBjb250ZXh0LmxpbmtpZmllcnMuc29tZShydW5Vc2VyTGlua2lmaWVyKTtcblxuICAgICAgICBpZiAodHlwZW9mIGh0bWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiAnaHRtbF9ibG9jaycsXG4gICAgICAgICAgICBjb250ZW50OiBodG1sLFxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsXG4gICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiAnbGlua19vcGVuJyxcbiAgICAgICAgICAgIGhyZWY6IGxpbmtzW2xuXS51cmwsXG4gICAgICAgICAgICB0YXJnZXQ6ICcnLFxuICAgICAgICAgICAgdGl0bGU6ICcnLFxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsKytcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBub2Rlcy5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgICAgIGNvbnRlbnQ6IGxpbmtzW2xuXS50ZXh0LFxuICAgICAgICAgICAgbGV2ZWw6IGxldmVsXG4gICAgICAgICAgfSk7XG4gICAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgICB0eXBlOiAnbGlua19jbG9zZScsXG4gICAgICAgICAgICBsZXZlbDogLS1sZXZlbFxuICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgbGFzdFBvcyA9IGxpbmtzW2xuXS5sYXN0SW5kZXg7XG4gICAgICB9XG5cbiAgICAgIGlmIChsYXN0UG9zIDwgdGV4dC5sZW5ndGgpIHtcbiAgICAgICAgbm9kZXMucHVzaCh7XG4gICAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICAgIGNvbnRlbnQ6IHRleHQuc2xpY2UobGFzdFBvcyksXG4gICAgICAgICAgbGV2ZWw6IGxldmVsXG4gICAgICAgIH0pO1xuICAgICAgfVxuXG4gICAgICBibG9ja1Rva2Vuc1tqXS5jaGlsZHJlbiA9IHRva2VucyA9IGFycmF5UmVwbGFjZUF0KHRva2VucywgaSwgbm9kZXMpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIHJ1blVzZXJMaW5raWZpZXIgKGxpbmtpZmllcikge1xuICAgIGh0bWwgPSBsaW5raWZpZXIobGlua3NbbG5dLnVybCwgbGlua3NbbG5dLnRleHQpO1xuICAgIHJldHVybiB0eXBlb2YgaHRtbCA9PT0gJ3N0cmluZyc7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB0b2tlbml6ZUxpbmtzO1xuIl19
