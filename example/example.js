'use strict';

var woofmark = require('..');
var megamark = require('megamark');
var domador = require('domador');
var demo = 'https://raw.githubusercontent.com/bevacqua/woofmark/master/resources/demo.png';
var rfence = /(^|\s)md-lang-((?:[^\s]|$)+)/;
var rimage = /^image\/(gif|png|p?jpe?g)$/i;

woofmark(document.querySelector('#ta'), {
  parseMarkdown: megamark,
  parseHTML: parseHTML,
  fencing: true,
  defaultMode: 'wysiwyg',
  images: {
    url: '/uploads/images',
    validate: imageValidator
  },
  attachments: {
    url: '/uploads/attachments'
  },
  xhr: mockXhr
});

function parseHTML (value, options) {
  return domador(value, {
    fencing: true,
    fencinglanguage: fences,
    markers: options.markers
  });
}

function fences (el) {
  var match = el.firstChild.className.match(rfence);
  if (match) {
    return match.pop();
  }
}

function mockXhr (options, done) {
  setTimeout(function uploading () {
    done(null, {
      statusCode: 200
    }, {
      title: 'Surely you should be using real XHR!',
      href: demo + '?t=' + new Date().valueOf()
    });
  }, 2500);
}

function imageValidator (file) {
  return rimage.test(file.type);
}
