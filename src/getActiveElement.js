'use strict';

function getActiveElement(root) {
  var activeEl = (root || document).activeElement;

  if (!activeEl) {
    return null;
  }

  if (activeEl.shadowRoot) {
    return getActiveElement(activeEl.shadowRoot);
  } else {
    return activeEl;
  }
}

module.exports = getActiveElement;
