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
  assert.match(html, /id="safety-map-title"/);
  assert.match(html, /id="safety-map-description"/);
  assert.match(html, /시연용 가상 안내도입니다/);
  assert.doesNotMatch(html, /마산 다바 8412 9104/);
  assert.match(html, /id="terrain-profile-chart"/);
  assert.match(html, /참고용 추정/);
  assert.match(html, /id="terrain-profile-facility-marker"/);
  assert.match(html, /id="terrain-profile-accident-marker"/);
  assert.match(html, /휴게시설 예시 \(가상\)/);
  assert.match(html, /사고 구간 예시 \(가상\)/);
  assert.match(html, /id="safety-data-course-title"/);
  assert.match(html, /시연용 가상 데이터/);
  assert.match(html, /실제 위치·사고 통계가 아닙니다/);
  assert.match(html, /사고 다발 구간 예시 A/);
  assert.match(html, /휴게시설 위치 예시 A/);
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
    const course = context.profileTest.courses.find(item => item.id === id);
    assert.equal(element('safety-data-course-title').textContent, course.title);
    assert.equal(element('safety-map-title').textContent, `${course.title.split(' ')[1] || course.title} 안전 안내도`);
    for (const type of ['facility', 'accident']) {
      assert.equal(element(`terrain-profile-${type}-marker`).attributes.visibility, 'visible');
      const markerLine = element(`terrain-profile-${type}-marker-line`).attributes;
      const markerCircle = element(`terrain-profile-${type}-marker-circle`).attributes;
      assert.equal(markerLine.x1, markerLine.x2);
      assert.equal(markerLine.y1, markerCircle.cy);
      assert.equal(markerLine.y2, '100.0');
    }
    assert.notEqual(
      element('terrain-profile-facility-marker-circle').attributes.cx,
      element('terrain-profile-accident-marker-circle').attributes.cx
    );
  }
});
