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
        dataService = window.TrailMateData.create(client);
        currentUser = user;
        activeRoomCourseId = roomId;
      },
      sendChatMessage,
      sendQuickStatus,
      subscribeToRoom,
      retryRoomConnection
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

test('quick status buttons send a message to the active course room', async () => {
  const app = setup();
  let inserted;
  const client = {
    from() {
      return {
        insert(payload) { inserted = payload; return this; },
        select() { return this; },
        async single() {
          return {
            data: { ...inserted, id: 1, created_at: new Date().toISOString() },
            error: null
          };
        }
      };
    }
  };
  app.context.flowTest.setChat(client, { id: 'user_1', username: 'hiker' }, 'cheonjusan');

  await app.context.flowTest.sendQuickStatus('정상 도착했어요!');

  assert.equal(inserted.course_id, 'cheonjusan');
  assert.equal(inserted.body, '정상 도착했어요!');
  assert.match(app.element('chat-messages').innerHTML, /정상 도착했어요!/);
});

test('realtime errors expose retry and reload messages before resubscribing', async () => {
  const app = setup();
  const statusCallbacks = [];
  let removeCount = 0;
  const client = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        order() { return this; },
        async limit() {
          return {
            data: [{ id: 1, user_id: 'user_2', display_name: 'hiker2', body: '다시 연결됨', created_at: new Date().toISOString() }],
            error: null
          };
        }
      };
    },
    channel() {
      const channel = {
        on() { return this; },
        subscribe(callback) {
          statusCallbacks.push(callback);
          return this;
        }
      };
      return channel;
    },
    async removeChannel() {
      removeCount++;
      return 'ok';
    }
  };
  app.context.flowTest.setChat(client, { id: 'user_1', username: 'hiker' }, 'cheonjusan');
  app.context.flowTest.subscribeToRoom('cheonjusan');
  statusCallbacks[0]('CHANNEL_ERROR');

  assert.equal(app.element('retry-chat-connection').classList.contains('hidden'), false);
  await app.context.flowTest.retryRoomConnection();

  assert.equal(removeCount, 1);
  assert.equal(statusCallbacks.length, 2);
  assert.match(app.element('chat-messages').innerHTML, /다시 연결됨/);
  assert.equal(app.element('retry-chat-connection').classList.contains('hidden'), true);
});
