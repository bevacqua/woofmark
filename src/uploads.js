'use strict';

var crossvent = require('crossvent');
var classes = require('./classes');
var dragClass = 'wk-dragging';
var dragClassSpecific = 'wk-container-dragging';
var root = document.documentElement;
var dragginCss = 0; // variable to count the enter and leaving numbers.

function uploads (container, droparea, editor, options, remove) {
  var op = remove ? 'remove' : 'add';
  crossvent[op](root, 'dragend', dragstopforce);
  crossvent[op](root, 'mouseout', dragstopforce);
  crossvent[op](container, 'dragover', handleDragOver, false);
  crossvent[op](container, 'dragenter', dragging, false);  // whenever the drag with components enter the container
  crossvent[op](container, 'dragleave', dragstop, false);  // whenever the drag with components moves out of container
  crossvent[op](droparea, 'drop', handleFileSelect, false);

  function dragging () {
    dragginCss++;
    classes.add(droparea, dragClass);
    classes.add(droparea, dragClassSpecific);
  }
  function dragstop () {
    dragginCss--;
    if(dragginCss === 0){
      dragstopper(droparea);
    }
  }
  function dragstopforce () {
    dragstopper(droparea);
  }
  function handleDragOver (e) {
    stop(e);
    classes.add(droparea, dragClass);
    classes.add(droparea, dragClassSpecific);
    e.dataTransfer.dropEffect = 'copy';
  }
  function handleFileSelect (e) {
    dragstop();
    stop(e);
    editor.runCommand(function runner (chunks, mode) {
      var files = Array.prototype.slice.call(e.dataTransfer.files);
      var type = inferType(files);
      editor.linkOrImageOrAttachment(type, files).call(this, mode, chunks);
    });
  }
  function inferType (files) {
    if (options.images && !options.attachments) {
      return 'image';
    }
    if (!options.images && options.attachments) {
      return 'attachment';
    }
    if (files.every(matches(options.images.validate || never))) {
      return 'image';
    }
    return 'attachment';
  }
}

function matches (fn) {
  return function matcher (file) { return fn(file); };
}
function never () {
  return false;
}
function stop (e) {
  e.stopPropagation();
  e.preventDefault();
}
function dragstopper (droparea) {
  classes.rm(droparea, dragClass);
  classes.rm(droparea, dragClassSpecific);
}

uploads.stop = dragstopper;
module.exports = uploads;
