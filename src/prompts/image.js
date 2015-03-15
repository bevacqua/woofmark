'use strict';

// var xhr = require('xhr');
// var configure = require('./configure');
var link = require('./link');
var render = require('./render');

function imagePrompt (done) {
  var dom = render({
    id: 'bk-prompt-image',
    title: 'Insert Image',
    description: 'Type or paste the url to your image',
    placeholder: 'http://example.com/public/image.png "title"'
  });

  link.init(dom, done);

  // if (configure.imageUploads) {
  //   arrangeImageUpload(dom, done);
  // }
}

// function arrangeImageUpload (dom, done) {
//   var up = render.uploads(dom, 'Only GIF, JPEG and PNG images are allowed');
//   var dragClass = 'bk-prompt-upload-dragging';

//   document.body.addEventListener('dragenter', dragging);
//   document.body.addEventListener('dragend', dragstop);

//   up.input.addEventListener('change', handleChange, false);
//   up.upload.addEventListener('dragover', handleDragOver, false);
//   up.upload.addEventListener('drop', handleFileSelect, false);

//   function handleChange (e) {
//     e.stopPropagation();
//     e.preventDefault();
//     go(e.target.files);
//   }

//   function handleDragOver (e) {
//     e.stopPropagation();
//     e.preventDefault();
//     e.dataTransfer.dropEffect = 'copy';
//   }

//   function handleFileSelect (e) {
//     e.stopPropagation();
//     e.preventDefault();
//     go(e.dataTransfer.files);
//   }

//   function valid (files) {
//     var mime = /^image\//i, i, file;

//     up.warning.classList.remove('bk-prompt-error-show');

//     for (i = 0; i < files.length; i++) {
//       file = files[i];

//       if (mime.test(file.type)) {
//         return file;
//       }
//     }
//     warn();
//   }

//   function warn (message) {
//     up.warning.classList.add('bk-prompt-error-show');
//   }

//   function dragging () {
//     up.upload.classList.add(dragClass);
//   }

//   function dragstop () {
//     up.upload.classList.remove(dragClass);
//   }

//   function remove () {
//     dom.dialog.parentElement.removeChild(dom.dialog);
//   }

//   function go (files) {
//     var file = valid(files);
//     if (!file) {
//       return;
//     }
//     var form = new FormData();
//     var options = {
//       'Content-Type': 'multipart/form-data',
//       headers: {
//         Accept: 'application/json'
//       },
//       method: configure.imageUploads.method,
//       url: configure.imageUploads.url,
//       timeout: configure.imageUploads.timeout,
//       body: form
//     };
//     form.append(configure.imageUploads.key, file, file.name);
//     up.upload.classList.add('bk-prompt-uploading');
//     xhr(options, done);

//     function done (err, xhr, body) {
//       up.upload.classList.remove('bk-prompt-uploading');
//       if (err) {
//         up.failed.classList.add('bk-prompt-error-show');
//         return;
//       }
//       var json = JSON.parse(body);
//       dom.input.value = json.url + ' "' + json.alt + '"';
//       remove();
//       done(dom.input.value);
//     }
//   }
// }

module.exports = imagePrompt;
