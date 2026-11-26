const fs = require('node:fs');

module.exports = function loadAppSource() {
  return ['js/courses.js', 'js/app.js']
    .map(path => fs.readFileSync(path, 'utf8'))
    .join('\n');
};
