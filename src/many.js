'use strict';

function many (text, times) {
  return new Array(times + 1).join(text);
}

module.exports = many;
