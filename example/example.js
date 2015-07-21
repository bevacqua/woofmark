void function () {
  'use strict';

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
