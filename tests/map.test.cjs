const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setupMap(apiKey = 'test-map-key') {
  const html = fs.readFileSync('index.html', 'utf8');
  const original = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .map(match => match[1]).find(text => text.includes('const COURSES'));
  const script = original.replace("'__MAPTILER_API_KEY__'", JSON.stringify(apiKey));
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', innerHTML: '', className: '',
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } }
    });
    return elements.get(id);
  }
  const calls = { setView: [], markers: [], layers: [] };
  const leaflet = {
    map(id) {
      calls.container = id;
      return {
        setView(center, zoom) { calls.setView.push({ center, zoom }); return this; },
        invalidateSize() {}
      };
    },
    tileLayer(url, options) {
      const layer = {
        on(event, handler) { calls.tileErrorHandler = handler; return layer; },
        addTo(map) { calls.layers.push({ url, options, map }); return layer; }
      };
      return layer;
    },
    marker(position) {
      const marker = {
        addTo(map) { calls.markers.push({ position, map }); return marker; },
        bindPopup(content) { calls.popup = content; return marker; },
        setLatLng(value) { calls.markerPosition = value; return marker; }
      };
      return marker;
    }
  };
  const context = {
    console, Date, Promise, setTimeout, clearTimeout,
    document: { getElementById: element },
    window: { L: leaflet, addEventListener() {} }, navigator: {}
  };
  vm.createContext(context);
  vm.runInContext(`${script}
    globalThis.mapTest = {
      initializeCourseMap, updateCourseMapLocation,
      selectCourseValue(course) { selectedCourse = course; },
      course(id) { return COURSES.find(item => item.id === id); }
    };`, context);
  return { map: context.mapTest, elements, calls };
}

test('MapTiler satellite map loads with the selected course and attribution', async () => {
  const app = setupMap();
  await app.map.initializeCourseMap();
  assert.equal(app.calls.container, 'course-map');
  assert.match(app.calls.layers[0].url, /tiles\/satellite-v2\/\{z\}\/\{x\}\/\{y\}\.jpg\?key=test-map-key/);
  assert.match(app.calls.layers[0].options.attribution, /MapTiler/);
  assert.match(app.calls.layers[0].options.attribution, /OpenStreetMap contributors/);
  assert.equal(JSON.stringify(app.calls.setView[0]), JSON.stringify({ center: [35.287, 128.609], zoom: 14 }));
});

test('map recenters its marker and external link for a new course', async () => {
  const app = setupMap();
  await app.map.initializeCourseMap();
  app.map.selectCourseValue(app.map.course('muhaksan'));
  app.map.updateCourseMapLocation();
  assert.equal(JSON.stringify(app.calls.setView.at(-1)), JSON.stringify({ center: [35.210966, 128.561859], zoom: 14 }));
  assert.equal(JSON.stringify(app.calls.markerPosition), JSON.stringify([35.210966, 128.561859]));
  assert.equal(app.elements.get('open-course-map').href, 'https://www.google.com/maps/search/?api=1&query=35.210966%2C128.561859');
});

test('map gives a setup message when no API key is injected', async () => {
  const app = setupMap('__MAPTILER_API_KEY__');
  await app.map.initializeCourseMap();
  assert.match(app.elements.get('map-status').textContent, /MapTiler 키가 배포 설정에 없습니다/);
  assert.equal(app.calls.layers.length, 0);
});
