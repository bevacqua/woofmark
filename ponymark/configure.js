'use strict';

function configure (opts) {
  var uploads;
  var o = opts || {};
  if (o.imageUploads) {
    if (typeof o.imageUploads === 'string') {
      uploads = { url: o.imageUploads };
    } else {
      uploads = o.imageUploads;
    }
    if (!uploads.url) { throw new Error('Required imageUploads.url property missing'); }
    if (!uploads.method) { uploads.method = 'PUT'; }
    if (!uploads.key) { uploads.key = 'image'; }
    if (!uploads.timeout) { uploads.timeout = 15000; }
    configure.imageUploads = uploads;
  }
  if (o.markdown) {
    configure.markdown = o.markdown;
  }
}

module.exports = configure;
