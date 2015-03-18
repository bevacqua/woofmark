'use strict';

function getText (el) {
  return el.innerText || el.textContent;
}

module.exports = getText;
