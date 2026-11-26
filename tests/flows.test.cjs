const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const loadAppSource = require('./helpers/app-source.cjs');

function setup() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) elements.set(id, {
      value: '',
      textContent: '',
      innerHTML: '',
      className: '',
      classList: {
        classes: new Set(['hidden']),
        add(name) { this.classes.add(name); },
        remove(name) { this.classes.delete(name); },
        toggle(name, force) {
          if (force === undefined ? !this.classes.has(name) : force) this.classes.add(name);
          else this.classes.delete(name);
        },
        contains(name) { return this.classes.has(name); }
      }
    });
    return elements.get(id);
  }
  const filterButtons = ['전체', '초급', '중급', '고급', '산책로']
    .map(textContent => ({ textContent, className: '' }));
  const context = {
    console,
    Date,
    Promise,
    setTimeout: () => 1,
    clearTimeout() {},
    document: {
      getElementById: element,
      querySelectorAll(selector) {
        assert.equal(selector, '.diff-btn');
        return filterButtons;
      }
    },
    window: { addEventListener() {} },
    navigator: {}
  };
  vm.createContext(context);
  vm.runInContext(`${loadAppSource()}
    globalThis.flowTest = {
      filterCourses,
      goToStep,
      setRoomAccess(user, roomId) {
        currentUser = user;
        activeRoomCourseId = roomId;
      },
      setChat(client, user, roomId) {
        supabaseClient = client;
        currentUser = user;
        activeRoomCourseId = roomId;
      },
      sendChatMessage
    };`, context);
  return { context, element, filterButtons };
}

test('difficulty filters render only matching courses and all restores the list', () => {
  const app = setup();
  app.context.flowTest.filterCourses('초급');
  assert.match(app.element('course-list').innerHTML, /천주산/);
  assert.doesNotMatch(app.element('course-list').innerHTML, /무학산|황매산|용지호수/);

  app.context.flowTest.filterCourses('전체');
  assert.equal((app.element('course-list').innerHTML.match(/onclick="selectCourse\('/g) || []).length, 4);
});

test('course-room screen is gated until the signed-in user joins the selected room', () => {
  const app = setup();
  app.context.flowTest.goToStep(3);
  assert.equal(app.element('screen-3').classList.contains('hidden'), true);
  assert.match(app.element('toast').textContent, /코스를 선택하고 소통방 입장에 동의/);

  app.context.flowTest.setRoomAccess({ id: 'user_1' }, 'cheonjusan');
  app.context.flowTest.goToStep(3);
  assert.equal(app.element('screen-3').classList.contains('hidden'), false);
  assert.equal(app.element('screen-2').classList.contains('hidden'), true);
});

test('chat API failures are surfaced and oversized messages are not submitted', async () => {
  const app = setup();
  let inserted;
  const client = {
    from(table) {
      assert.equal(table, 'course_room_messages');
      return {
        insert(payload) {
          inserted = payload;
          return this;
        },
        select() { return this; },
        async single() { return { data: null, error: { message: 'offline' } }; }
      };
    }
  };
  app.context.flowTest.setChat(client, { id: 'user_1', username: 'hiker' }, 'hwangmaesan');

  assert.equal(await app.context.flowTest.sendChatMessage('오늘 기상 확인'), false);
  assert.equal(inserted.user_id, 'user_1');
  assert.equal(inserted.display_name, 'hiker');
  assert.equal(inserted.course_id, 'hwangmaesan');
  assert.match(app.element('chat-status').textContent, /offline/);

  inserted = undefined;
  assert.equal(await app.context.flowTest.sendChatMessage('a'.repeat(1001)), false);
  assert.equal(inserted, undefined);
  assert.match(app.element('toast').textContent, /1,000자 이내/);
});
