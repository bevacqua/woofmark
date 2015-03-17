'use strict';

function xhrStub (options) {
  throw new Error('Barkup is missing XHR configuration. Can\'t request ' + options.url);
}

module.exports = xhrStub;
