const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('satellite map integrations are removed while safety guidance remains', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const readme = fs.readFileSync('README.md', 'utf8');

  assert.doesNotMatch(html, /GOOGLE_MAPS_API_KEY|maps\.googleapis\.com|course-map|mapCenter|mapZoom|위성지도|위성 지도|위성사진/);
  assert.doesNotMatch(readme, /Google 위성 지도 설정|GOOGLE_MAPS_API_KEY|위성지도 API/i);
  assert.match(html, /id="screen-4"/);
  assert.match(html, /id="altitude-slider"/);
  assert.match(html, /openModal\('modal-sos'\)/);
});
