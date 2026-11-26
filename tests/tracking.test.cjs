const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const html = fs.readFileSync('index.html', 'utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)]
    .map(match => match[1]).find(text => text.includes('const COURSES'));
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '', textContent: '', innerHTML: '', className: '', disabled: false,
      classList: { toggle() {}, add() {}, remove() {}, contains() { return false; } }
    });
    return elements.get(id);
  }
  const rows = [];
  let watchCallback;
  let altitude = 120;
  let denied = false;
  const db = {
    from(table) {
      if (table === 'course_room_members') {
        const query = { select() { return query; }, eq() { return query; }, maybeSingle: async () => ({ data: { user_id: 'user_1' }, error: null }) };
        return query;
      }
      if (table === 'course_room_messages') {
        const query = { select() { return query; }, eq() { return query; }, order() { return query; }, limit: async () => ({ data: [], error: null }) };
        return query;
      }
      assert.equal(table, 'tracking_sessions');
      let operation = 'read', payload, filters = [], one = false;
      const query = {
        select() { return query; },
        eq(key, value) { filters.push(row => row[key] === value); return query; },
        is(key, value) { filters.push(row => row[key] === value); return query; },
        not(key, operator, value) { filters.push(row => row[key] !== value); return query; },
        gte(key, value) { filters.push(row => row[key] >= value); return query; },
        lt(key, value) { filters.push(row => row[key] < value); return query; },
        order() { return query; },
        insert(value) { operation = 'insert'; payload = value; return query; },
        update(value) { operation = 'update'; payload = value; return query; },
        single() { one = true; return query; },
        maybeSingle() { one = true; return query; },
        then(resolve) {
          let found = rows.filter(row => filters.every(filter => filter(row)));
          if (operation === 'insert') {
            const row = { ...payload, id: rows.length + 1, started_at: new Date().toISOString(), ended_at: null };
            rows.push(row);
            found = [row];
          }
          if (operation === 'update') found.forEach(row => {
            const previous = row.max_altitude_m;
            Object.assign(row, payload);
            if (previous !== null && row.max_altitude_m !== null) row.max_altitude_m = Math.max(previous, row.max_altitude_m);
          });
          resolve({ data: one ? found[0] || null : found, error: null });
        }
      };
      return query;
    },
    channel() {
      const channel = { on() { return channel; }, subscribe() { return channel; } };
      return channel;
    }
  };
  const geolocation = {
    getCurrentPosition(success, failure) {
      if (denied) failure({ code: 1 });
      else success({ coords: { latitude: 35, longitude: 128, altitude } });
    },
    watchPosition(success) { watchCallback = success; return 1; },
    clearWatch() { watchCallback = null; }
  };
  const context = {
    console, Date, Promise, setTimeout: () => 1, clearTimeout() {},
    document: { getElementById: element },
    window: { addEventListener() {} }, navigator: { geolocation }
  };
  vm.createContext(context);
  vm.runInContext(`${script}
    globalThis.trackingTest = {
      setup(client) { supabaseClient = client; currentUser = { id: 'user_1' }; activeRoomCourseId = 'cheonjusan'; },
      setRoom(id) { activeRoomCourseId = id; },
      enterCourseRoom, beginRoomTracking, refreshTracking, finishTracking, saveObservedAltitude,
      state() { return { activeTracking, trackingReady }; }
    };`, context);
  context.trackingTest.setup(db);
  const now = new Date();
  element('tracking-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return {
    api: context.trackingTest, rows, element,
    setAltitude(value) { altitude = value; },
    setDenied(value) { denied = value; },
    watch(value) { watchCallback({ coords: { altitude: value } }); }
  };
}

test('room entry starts GPS and saves the observed maximum until the user finishes', async () => {
  const app = setup();
  await app.api.enterCourseRoom('cheonjusan');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(app.rows.length, 1, app.element('toast').textContent);
  assert.equal(app.rows[0].course_id, 'cheonjusan');
  app.watch(180);
  app.watch(140);
  await app.api.saveObservedAltitude();
  assert.equal(app.rows[0].max_altitude_m, 180);
  app.setAltitude(210);
  await app.api.finishTracking();
  assert.equal(app.rows[0].max_altitude_m, 210);
  assert.equal(app.api.state().activeTracking, null);
  assert.match(app.element('tracking-summary').textContent, /총 1회/);
  assert.match(app.element('tracking-history').innerHTML, /210m/);
});

test('an existing active hike is restored and a different room cannot start another', async () => {
  const app = setup();
  await app.api.beginRoomTracking('cheonjusan');
  await app.api.refreshTracking();
  app.api.setRoom('muhaksan');
  await app.api.beginRoomTracking('muhaksan');
  assert.equal(app.rows.length, 1);
  assert.match(app.element('chat-tracking-status').textContent, /다른 코스/);
});

test('denied GPS does not create a record and can be retried', async () => {
  const app = setup();
  app.setDenied(true);
  await app.api.beginRoomTracking('cheonjusan');
  assert.equal(app.rows.length, 0);
  assert.match(app.element('chat-tracking-status').textContent, /권한이 거부/);
  app.setDenied(false);
  await app.api.beginRoomTracking('cheonjusan');
  assert.equal(app.rows.length, 1);
});
