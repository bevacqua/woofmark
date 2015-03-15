'use strict';

function setText (el, value) {
  el.innerText = el.textContent = value;
}

module.exports = setText;
