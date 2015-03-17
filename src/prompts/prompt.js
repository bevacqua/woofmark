'use strict';

var crossvent = require('crossvent');
var render = require('./render');
var strings = require('../strings');
var ENTER_KEY = 13;
var ESCAPE_KEY = 27;

function prompt (options, done) {
  var text = strings.placeholder.prompts[options.type];
  var dom = render({
    id: 'bk-prompt-' + options.type,
    title: text.title,
    description: text.description,
    placeholder: text.placeholder
  });

  crossvent.add(dom.cancel, 'click', remove);
  crossvent.add(dom.close, 'click', remove);
  crossvent.add(dom.ok, 'click', ok);
  crossvent.add(dom.input, 'keypress', enter);
  crossvent.add(dom.input, 'keydown', esc);

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
    done(dom.input.value);
  }

  function remove () {
    bindUploadEvents(true);
    dom.dialog.parentElement.removeChild(dom.dialog);
    options.surface.focus(options.mode);
  }

  function bindUploadEvents (remove) {
    var op = remove ? 'remove' : 'add';
    crossvent[op](document.body, 'dragenter', dragging);
    crossvent[op](document.body, 'dragend', dragstop);
  }

  function arrangeUploads (dom, done) {
    var up = render.uploads(dom, 'Only GIF, JPEG and PNG images are allowed');
    var dragClass = 'bk-prompt-upload-dragging';

    bindUploadEvents();
    crossvent.add(up.input, 'change', handleChange, false);
    crossvent.add(up.upload, 'dragover', handleDragOver, false);
    crossvent.add(up.upload, 'drop', handleFileSelect, false);

    function handleChange (e) {
      e.stopPropagation();
      e.preventDefault();
      go(e.target.files);
    }

    function handleDragOver (e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }

    function handleFileSelect (e) {
      e.stopPropagation();
      e.preventDefault();
      go(e.dataTransfer.files);
    }

    function valid (files) {
      var mime = /^image\//i;
      var i;
      var file;

      up.warning.classList.remove('bk-prompt-error-show');

      for (i = 0; i < files.length; i++) {
        file = files[i];

        if (mime.test(file.type)) {
          return file;
        }
      }
      warn();
    }

    function warn (message) {
      up.warning.classList.add('bk-prompt-error-show');
    }
    function dragging () {
      up.upload.classList.add(dragClass);
    }
    function dragstop () {
      up.upload.classList.remove(dragClass);
    }
    function remove () {
      dom.dialog.parentElement.removeChild(dom.dialog);
    }

    function go (files) {
      var file = valid(files);
      if (!file) {
        return;
      }
      var form = new FormData();
      var options = {
        'Content-Type': 'multipart/form-data',
        headers: {
          Accept: 'application/json'
        },
        method: upload.method || 'PUT',
        url: upload.url,
        body: form
      };
      form.append(upload.key || 'barkup_upload', file, file.name);
      up.upload.classList.add('bk-prompt-uploading');
      xhr(options, done);

      function done (err, xhr, body) {
        up.upload.classList.remove('bk-prompt-uploading');
        if (err) {
          up.failed.classList.add('bk-prompt-error-show');
          return;
        }
        var json = JSON.parse(body);
        dom.input.value = json.href + ' "' + json.title + '"';
        remove();
        done(dom.input.value);
      }
    }
  }
}

module.exports = prompt;
