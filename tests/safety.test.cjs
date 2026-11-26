const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('satellite map integrations are removed while safety guidance remains', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const readme = fs.readFileSync('README.md', 'utf8');

  assert.doesNotMatch(html, /GOOGLE_MAPS_API_KEY|maps\.googleapis\.com|course-map|mapCenter|mapZoom|위성지도|위성 지도|위성사진/);
  assert.doesNotMatch(readme, /Google 위성 지도 설정|GOOGLE_MAPS_API_KEY|위성지도 API/i);
  assert.match(html, /id="screen-4"/);
  assert.match(html, /id="altitude-slider"/);
  assert.match(html, /openModal\('modal-sos'\)/);
  assert.match(html, /id="terrain-profile-chart"/);
  assert.match(html, /참고용 추정/);
  assert.match(html, /id="safety-data-course-title"/);
  assert.match(html, /위치를 표시하지 않습니다/);
  assert.match(html, /임의로 생성하지 않습니다/);
});

test('terrain profiles update for each selected course and use the course distance', () => {
  const html = fs.readFileSync('index.html', 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .map(match => match[1]).find(text => text.includes('const COURSES'));
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      textContent: '',
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = value; }
    });
    return elements.get(id);
  }
  const context = {
    console, Date, Promise, setTimeout, clearTimeout,
    document: { getElementById: element },
    window: { addEventListener() {} }, navigator: {}
  };
  vm.createContext(context);
  vm.runInContext(`${script}
    globalThis.profileTest = {
      courses: COURSES,
      select(id) {
        selectedCourse = COURSES.find(course => course.id === id);
        updateTerrainProfile();
        updateCourseBoundUI();
      }
    };`, context);

  const expectedDistances = { cheonjusan: '4.2 km', muhaksan: '6.8 km', hwangmaesan: '9.5 km', yongji: '3.1 km' };
  for (const [id, distance] of Object.entries(expectedDistances)) {
    context.profileTest.select(id);
    assert.equal(element('terrain-profile-end').textContent, `종점 · ${Number.parseFloat(distance)} km`);
    assert.match(element('terrain-profile-line').attributes.d, /^M.+L/);
    assert.match(element('terrain-profile-area').attributes.d, /Z$/);
    assert.match(element('terrain-profile-title').textContent, /지형 단면$/);
    assert.equal(element('safety-data-course-title').textContent, context.profileTest.courses.find(course => course.id === id).title);
  }
});
