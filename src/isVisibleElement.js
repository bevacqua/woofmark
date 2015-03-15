'use strict';

function isVisibleElement (elem) {
  if (window.getComputedStyle) {
    return window.getComputedStyle(elem, null).getPropertyValue('display') !== 'none';
  } else if (elem.currentStyle) {
    return elem.currentStyle.display !== 'none';
  }
}

module.exports = isVisibleElement;
