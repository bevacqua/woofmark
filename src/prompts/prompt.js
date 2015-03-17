'use strict';

var crossvent = require('crossvent');
var render = require('./render');
var strings = require('../strings');
var ENTER_KEY = 13;
var ESCAPE_KEY = 27;
var dragClass = 'bk-prompt-upload-dragging';

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
    id: 'bk-prompt-' + options.type,
    title: text.title,
    description: text.description,
    placeholder: text.placeholder
  });
  var domup;

  crossvent.add(dom.cancel, 'click', remove);
  crossvent.add(dom.close, 'click', remove);
  crossvent.add(dom.ok, 'click', ok);
  crossvent.add(dom.input, 'keypress', enter);
  crossvent.add(dom.input, 'keydown', esc);
  classify(dom, options.classes);

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
    domup.warning.classList.add('bk-prompt-error-show');
  }
  function dragging () {
    domup.area.classList.add(dragClass);
  }
  function dragstop () {
    domup.area.classList.remove(dragClass);
  }

  function arrangeUploads (dom, done) {
    domup = render.uploads(dom, strings.prompts.types + (upload.restriction || options.type + 's'));
    bindUploadEvents();
    crossvent.add(domup.fileinput, 'change', handleChange, false);
    crossvent.add(domup.area, 'dragover', handleDragOver, false);
    crossvent.add(domup.area, 'drop', handleFileSelect, false);
    classify(domup, options.classes);

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
      domup.warning.classList.remove('bk-prompt-error-show');
      for (i = 0; i < files.length; i++) {
        if ((upload.validate || okop)(files[i])) {
          return files[i];
        }
      }
      warn();
    }

    function submit (files) {
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
      domup.area.classList.add('bk-prompt-uploading');
      xhr(options, handleResponse);

      function handleResponse (err, res, body) {
        domup.area.classList.remove('bk-prompt-uploading');
        if (err || res.statusCode < 200 || res.statusCode > 299) {
          domup.failed.classList.add('bk-prompt-error-show');
          return;
        }
        dom.input.value = body.href + ' "' + body.title + '"';
        remove();
        done(dom.input.value);
      }
    }
  }
}

module.exports = prompt;
