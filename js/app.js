    const COURSES = window.TRAILMATE_COURSES;

    const SUPABASE_URL = 'https://vfhjvelxirfgastdqohq.supabase.co';
    const SUPABASE_PUBLIC_KEY = 'sb_publishable_n5qdZiWcLJ9oA6swElKrBg_venzzx-O';

    let selectedCourse = COURSES[0];
    let currentFilter = '전체';
    let hasSelectedCourse = false;
    let isGpsConsentOn = false;
    let supabaseClient = null;
    let dataService = null;
    let clerkReady = false;
    let currentUser = null;
    let pendingRoomCourseId = null;
    let activeRoomCourseId = null;
    let chatSubscription = null;
    let chatMessages = [];
    let authMode = 'signin';
    let activeTracking = null;
    let trackingReady = false;
    let trackingBusy = false;
    let profileLoadVersion = 0;
    let altitudeWatchId = null;
    let altitudeWatchSessionId = null;
    let altitudeTimer = null;
    let altitudeSavePromise = null;
    let observedAltitude = null;

    function isSupabaseConfigured() {
      return window.supabase && clerkReady && supabaseClient && dataService
        && SUPABASE_URL.startsWith('https://')
        && !SUPABASE_URL.includes('YOUR_PROJECT_ID')
        && SUPABASE_PUBLIC_KEY
        && !SUPABASE_PUBLIC_KEY.includes('YOUR_SUPABASE_');
    }

    function showChatStatus(message, type = 'error', retryable = false) {
      const status = document.getElementById('chat-status');
      status.textContent = message;
      status.className = `text-[11px] rounded-xl px-3 py-2 ${type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-forest-50 text-forest-800 border border-forest-200'}`;
      status.classList.remove('hidden');
      const retryButton = document.getElementById('retry-chat-connection');
      if (retryButton) retryButton.classList.toggle('hidden', !retryable || !activeRoomCourseId);
    }

    function showToast(msg) {
      const el = document.getElementById('toast');
      el.textContent = msg;
      el.classList.remove('opacity-0');
      clearTimeout(window._toastTimer);
      window._toastTimer = setTimeout(() => el.classList.add('opacity-0'), 2400);
    }

    function escapeHTML(value) {
      return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]);
    }

    function setViewMode(mode) {
      const singleEl = document.getElementById('single-mode-container');
      const flowEl = document.getElementById('flow-mode-container');
      const btnSingle = document.getElementById('btn-mode-single');
      const btnFlow = document.getElementById('btn-mode-flow');

      if (mode === 'single') {
        singleEl.classList.remove('hidden');
        flowEl.classList.add('hidden');
        btnSingle.className = 'flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition bg-forest-700 text-white shadow-sm';
        btnFlow.className = 'flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition text-slate-600 hover:text-slate-900';
      } else {
        singleEl.classList.add('hidden');
        flowEl.classList.remove('hidden');
        btnFlow.className = 'flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition bg-forest-700 text-white shadow-sm';
        btnSingle.className = 'flex-1 md:flex-initial px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition text-slate-600 hover:text-slate-900';
      }
    }

    function selectCondition(label, diff) {
      document.getElementById('condition-badge').textContent = label;
      document.querySelectorAll('.cond-btn').forEach(btn => {
        btn.className = 'cond-btn py-2 px-2 rounded-xl font-medium border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition';
      });
      event.currentTarget.className = 'cond-btn py-2 px-2 rounded-xl font-semibold border border-forest-600 bg-forest-50 text-forest-800 transition';
      filterCourses(diff);
      showToast(`'${label}' 컨디션에 맞는 ${diff} 코스를 추천합니다.`);
    }

    function filterCourses(diff) {
      currentFilter = diff;
      document.querySelectorAll('.diff-btn').forEach(btn => {
        if (btn.textContent.startsWith(diff)) {
          btn.className = 'diff-btn px-3 py-1.5 rounded-full text-xs font-bold bg-forest-700 text-white shrink-0';
        } else {
          btn.className = 'diff-btn px-3 py-1.5 rounded-full text-xs font-semibold bg-white text-slate-600 border border-slate-200 shrink-0';
        }
      });
      renderCourses();
    }

    function renderCourses() {
      const container = document.getElementById('course-list');
      const filtered = window.TrailMateRecommendations.filterCourses(COURSES, currentFilter);

      container.innerHTML = filtered.map(c => `
        <div onclick="selectCourse('${c.id}')" class="cursor-pointer bg-white hover:border-forest-500 border border-slate-200 rounded-2xl p-3.5 shadow-sm transition group">
          <div class="flex items-start justify-between gap-2">
            <div>
              <span class="text-[10px] text-slate-400 font-medium">${c.region}</span>
              <h4 class="text-sm font-extrabold text-slate-900 group-hover:text-forest-700 transition">${c.title}</h4>
            </div>
            <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${c.badgeClass}">${c.difficulty}</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-600 mt-2 font-medium">
            <span>📏 ${c.distance}</span>
            <span>⏱️ ${c.duration}</span>
            <span>⛰️ ${c.elevation}</span>
          </div>
          <div class="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100">
            <div class="flex gap-1 flex-wrap">
              ${c.tags.map(t => `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">#${t}</span>`).join('')}
            </div>
            <span class="text-[11px] font-bold text-forest-700 shrink-0">상세 보기 →</span>
          </div>
        </div>
      `).join('');
    }

    function selectCourse(id) {
      const found = COURSES.find(c => c.id === id);
      if (!found) return;
      selectedCourse = found;
      hasSelectedCourse = true;
      activeRoomCourseId = null;
      chatMessages = [];
      void stopRoomSubscription().catch(error => {
        showChatStatus(`실시간 연결을 종료하지 못했습니다: ${error.message}`);
      });
      updateCourseBoundUI();
      goToStep(2);
      requestCourseRoomEntry();
    }

    function updateCourseBoundUI() {
      // Step 2 UI
      document.getElementById('detail-region').textContent = selectedCourse.region;
      document.getElementById('detail-title').textContent = selectedCourse.title;
      document.getElementById('safety-data-course-title').textContent = selectedCourse.title;
      const mountainName = selectedCourse.title.split(' ')[1] || selectedCourse.title;
      document.getElementById('safety-map-title').textContent = `${mountainName} 안전 안내도`;
      document.getElementById('detail-desc').textContent = selectedCourse.desc;
      document.getElementById('detail-distance').textContent = selectedCourse.distance;
      document.getElementById('detail-duration').textContent = selectedCourse.duration;
      document.getElementById('detail-elevation').textContent = selectedCourse.elevation;
      const badge = document.getElementById('detail-diff-badge');
      badge.textContent = selectedCourse.difficulty;
      badge.className = `text-xs font-bold px-2.5 py-0.5 rounded-full ${selectedCourse.badgeClass}`;

      document.getElementById('detail-cautions').innerHTML = selectedCourse.cautions.map(item => `
        <li class="flex items-start gap-2"><span class="text-amber-500 font-bold">•</span> <span>${item}</span></li>
      `).join('');

      // Step 3 UI
      document.getElementById('chat-room-title').textContent = `${selectedCourse.title.split(' ')[1] || selectedCourse.title} 2030 크루방`;
    }

    function requestCourseRoomEntry() {
      if (!hasSelectedCourse) {
        showToast('먼저 참여할 코스를 선택해 주세요.');
        return;
      }

      document.getElementById('room-confirm-course').textContent = selectedCourse.title;
      const warning = document.getElementById('room-config-warning');
      const confirmButton = document.getElementById('btn-confirm-room-entry');
      const configured = isSupabaseConfigured();
      warning.textContent = '로그인 또는 채팅 서버에 연결할 수 없습니다. 새로고침 후 다시 시도해 주세요.';
      warning.classList.toggle('hidden', configured);
      confirmButton.disabled = !configured;
      confirmButton.classList.toggle('opacity-50', !configured);
      confirmButton.classList.toggle('cursor-not-allowed', !configured);
      openModal('modal-room-confirm');
    }

    async function confirmCourseRoomEntry() {
      if (!isSupabaseConfigured()) {
        showToast('실시간 채팅 서버 설정이 필요합니다.');
        return;
      }

      if (!currentUser) {
        pendingRoomCourseId = selectedCourse.id;
        localStorage.setItem('pending-course-room-id', pendingRoomCourseId);
        setAuthMode('signin');
        document.getElementById('auth-context').textContent = `${selectedCourse.title} 소통방에 입장하려면 로그인하거나 회원가입해 주세요.`;
        closeAllModals();
        openModal('modal-auth');
        return;
      }

      await enterCourseRoom(selectedCourse.id);
    }

    function goToStep(step) {
      if (step === 3 && (!currentUser || activeRoomCourseId !== selectedCourse.id)) {
        showToast('코스를 선택하고 소통방 입장에 동의해 주세요.');
        return;
      }

      [1, 2, 3, 4, 5].forEach(n => {
        const sec = document.getElementById(`screen-${n}`);
        const pill = document.getElementById(`step-pill-${n}`);
        const nav = document.getElementById(`nav-btn-${n}`);
        if (n === step) {
          sec.classList.remove('hidden');
          if (pill) pill.className = 'step-pill py-1.5 px-1 rounded-lg font-bold text-center transition bg-white text-forest-800 shadow-sm';
          if (nav) nav.className = 'nav-btn flex flex-col items-center justify-center text-forest-700 font-bold';
        } else {
          sec.classList.add('hidden');
          if (pill) pill.className = 'step-pill py-1.5 px-1 rounded-lg font-medium text-center transition text-forest-100 hover:bg-white/10';
          if (nav) nav.className = 'nav-btn flex flex-col items-center justify-center text-slate-400 font-medium';
        }
      });
      document.getElementById('screen-body').scrollTop = 0;
      if (step === 3) renderChat();
      if (step === 4) window.TrailMateSafety.updateTerrainProfile(selectedCourse);
    }

    function toggleGpsConsent(consented) {
      isGpsConsentOn = consented === true;
      const sub = document.getElementById('gps-consent-sub');
      if (isGpsConsentOn) {
        sub.textContent = '동의 켜짐 · 직접 시작을 누르기 전에는 위치를 요청하지 않습니다';
        if (activeTracking) startAltitudeWatch();
        showToast('GPS 기록에 동의했습니다. 시작 버튼을 눌러 기록을 시작하세요.');
      } else {
        stopAltitudeWatch();
        sub.textContent = '동의 꺼짐 · 추가 위치 수집을 중단하고 위치 없이 종료할 수 있습니다';
        showToast('GPS 기록 동의를 해제했습니다. 추가 위치 수집을 중단합니다.');
      }
      renderActiveTracking();
    }

    function renderChat() {
      const box = document.getElementById('chat-messages');
      if (chatMessages.length === 0) {
        box.innerHTML = '<p class="text-center text-xs text-slate-400 py-8">첫 메시지를 남겨 보세요.</p>';
        return;
      }

      box.innerHTML = chatMessages.map(message => {
        const isMe = message.user_id === currentUser?.id;
        const time = new Date(message.created_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        return `
          <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
            ${isMe ? '' : `<span class="text-[10px] font-bold text-slate-600 mb-0.5">${escapeHTML(message.display_name)}</span>`}
            <div class="${isMe ? 'bg-forest-700 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'} text-xs px-3 py-2 rounded-2xl max-w-[82%] shadow-xs break-words">
              ${escapeHTML(message.body)}
            </div>
            <span class="text-[10px] text-slate-400 mt-0.5">${escapeHTML(time)}</span>
          </div>
        `;
      }).join('');
      box.scrollTop = box.scrollHeight;
    }

    function appendChatMessage(message) {
      if (chatMessages.some(existing => existing.id === message.id)) return;
      chatMessages.push(message);
      chatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      renderChat();
    }

    async function handleSendChat(e) {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      if (await sendChatMessage(text)) input.value = '';
    }

    async function sendQuickStatus(text) {
      await sendChatMessage(text);
    }

    async function sendChatMessage(text) {
      if (!currentUser || !activeRoomCourseId || !dataService) {
        showToast('코스 소통방에 입장한 뒤 메시지를 보낼 수 있습니다.');
        return false;
      }
      if (text.length > 1000) {
        showToast('메시지는 1,000자 이내로 입력해 주세요.');
        return false;
      }

      try {
        const data = await dataService.sendRoomMessage({
          course_id: activeRoomCourseId,
          user_id: currentUser.id,
          display_name: getDisplayName(currentUser),
          body: text
        })
        appendChatMessage(data);
        return true;
      } catch (error) {
        showChatStatus(`메시지를 보내지 못했습니다: ${error.message}`, 'error', true);
        return false;
      }
    }

    function getDisplayName(user) {
      const name = user.unsafeMetadata?.display_name || user.username || '회원';
      return name.trim().slice(0, 30) || '회원';
    }

    function setPageStatus(id, message, error = false) {
      const el = document.getElementById(id);
      el.textContent = message;
      el.className = `text-xs ${error ? 'text-red-700' : 'text-forest-700'}`;
      el.classList.toggle('hidden', !message);
    }

    function renderProfile() {
      if (!currentUser) return;
      document.getElementById('profile-image').src = currentUser.imageUrl;
      document.getElementById('profile-name').textContent = getDisplayName(currentUser);
      document.getElementById('profile-username').textContent = `@${currentUser.username || '회원'}`;
      document.getElementById('profile-nickname').value = getDisplayName(currentUser);
    }

    function openMyPage() {
      if (!currentUser) {
        handleAccountAction();
        return;
      }
      const now = new Date();
      document.getElementById('tracking-month').value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      renderProfile();
      setPageStatus('profile-status', '');
      goToStep(5);
      void refreshTracking();
    }

    async function saveNickname(event) {
      event.preventDefault();
      const user = currentUser;
      const name = document.getElementById('profile-nickname').value.trim();
      if (!user || !name || name.length > 30) {
        setPageStatus('profile-status', '닉네임을 1~30자로 입력해 주세요.', true);
        return;
      }
      const button = document.getElementById('save-nickname');
      button.disabled = true;
      try {
        await user.update({ unsafeMetadata: { ...user.unsafeMetadata, display_name: name } });
        if (currentUser?.id !== user.id) return;
        currentUser = window.Clerk.user;
        renderProfile();
        setPageStatus('profile-status', '닉네임을 저장했습니다.');
      } catch (error) {
        setPageStatus('profile-status', `닉네임을 저장하지 못했습니다: ${error.message}`, true);
      } finally {
        button.disabled = false;
      }
    }

    async function saveProfileImage(event) {
      event.preventDefault();
      const user = currentUser;
      const fileInput = document.getElementById('profile-image-file');
      const file = fileInput.files[0];
      if (!user || !file) return;
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        setPageStatus('profile-status', 'JPG, PNG 또는 WebP 사진을 5MB 이하로 선택해 주세요.', true);
        return;
      }
      const button = document.getElementById('save-profile-image');
      button.disabled = true;
      try {
        await user.setProfileImage({ file });
        if (currentUser?.id !== user.id) return;
        currentUser = window.Clerk.user;
        renderProfile();
        fileInput.value = '';
        setPageStatus('profile-status', '프로필 사진을 저장했습니다.');
      } catch (error) {
        setPageStatus('profile-status', `사진을 저장하지 못했습니다: ${error.message}`, true);
      } finally {
        button.disabled = false;
      }
    }

    function renderActiveTracking() {
      const button = document.getElementById('tracking-button');
      const chatButton = document.getElementById('chat-tracking-button');
      button.disabled = !trackingReady || trackingBusy || !activeTracking;
      document.getElementById('refresh-tracking').disabled = trackingBusy;
      ['gps-tracking-consent', 'gps-tracking-consent-profile'].forEach(id => {
        const consentInput = document.getElementById(id);
        if (consentInput) consentInput.checked = isGpsConsentOn;
      });
      chatButton.disabled = trackingBusy || (!activeTracking && (!trackingReady || !activeRoomCourseId || !isGpsConsentOn));
      chatButton.textContent = trackingBusy ? '처리 중...' : activeTracking ? '산행 종료' : !trackingReady ? '기록 다시 확인' : isGpsConsentOn ? 'GPS 기록 시작' : 'GPS 기록 동의 후 시작';
      const course = COURSES.find(item => item.id === activeTracking?.course_id);
      const text = activeTracking
        ? `${course?.title || activeTracking.course_id} · ${new Date(activeTracking.started_at).toLocaleString('ko-KR')} 시작`
        : '진행 중인 산행 기록이 없습니다.';
      document.getElementById('tracking-active').textContent = text;
      document.getElementById('chat-tracking-active').textContent = text;
    }

    function setTrackingStatus(message, error = false) {
      setPageStatus('tracking-status', message, error);
      setPageStatus('chat-tracking-status', message, error);
    }

    function stopAltitudeWatch() {
      if (altitudeWatchId !== null) navigator.geolocation.clearWatch(altitudeWatchId);
      altitudeWatchId = null;
      altitudeWatchSessionId = null;
      clearTimeout(altitudeTimer);
      altitudeTimer = null;
    }

    function rememberAltitude(position) {
      const altitude = position.coords.altitude;
      if (typeof altitude !== 'number' || !Number.isFinite(altitude)) return;
      observedAltitude = observedAltitude === null ? altitude : Math.max(observedAltitude, altitude);
      if (activeTracking && (activeTracking.max_altitude_m === null || observedAltitude > activeTracking.max_altitude_m) && !altitudeTimer) {
        altitudeTimer = setTimeout(() => {
          altitudeTimer = null;
          void saveObservedAltitude();
        }, 15000);
      }
    }

    async function saveObservedAltitude() {
      if (altitudeSavePromise || !activeTracking || !dataService || observedAltitude === null || trackingBusy) return;
      const sessionId = activeTracking.id;
      const userId = currentUser?.id;
      const altitude = observedAltitude;
      altitudeSavePromise = dataService.updateTrackingAltitude(sessionId, userId, altitude);
      try {
        const data = await altitudeSavePromise;
        if (activeTracking?.id !== sessionId || currentUser?.id !== userId) return;
        activeTracking.max_altitude_m = data.max_altitude_m;
        if (observedAltitude > data.max_altitude_m && !altitudeTimer) {
          altitudeTimer = setTimeout(() => {
            altitudeTimer = null;
            void saveObservedAltitude();
          }, 15000);
        }
      } catch (error) {
        if (activeTracking?.id === sessionId && currentUser?.id === userId) {
          setTrackingStatus(`GPS 고도를 저장하지 못했습니다: ${error.message}. 연결을 확인해 주세요.`, true);
        }
      } finally {
        altitudeSavePromise = null;
      }
    }

    function startAltitudeWatch() {
      if (!isGpsConsentOn || !activeTracking || !navigator.geolocation || altitudeWatchSessionId === activeTracking.id) return;
      stopAltitudeWatch();
      const sessionId = activeTracking.id;
      const userId = currentUser?.id;
      altitudeWatchSessionId = sessionId;
      altitudeWatchId = navigator.geolocation.watchPosition(position => {
        if (activeTracking?.id === sessionId && currentUser?.id === userId) rememberAltitude(position);
      }, error => {
        if (activeTracking?.id === sessionId && currentUser?.id === userId) {
          setTrackingStatus(`GPS 고도 측정이 중단되었거나 지연되고 있습니다: ${error.message}. 위치 권한과 신호를 확인해 주세요.`, true);
          if (error.code === 1) stopAltitudeWatch();
        }
      }, { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 });
    }

    async function refreshTracking() {
      if (trackingBusy || !currentUser || !dataService) return false;
      const userId = currentUser?.id;
      const version = ++profileLoadVersion;
      trackingReady = false;
      renderActiveTracking();
      setTrackingStatus('기록을 불러오는 중입니다.');
      try {
        const data = await dataService.getActiveTracking(userId);
        if (currentUser?.id !== userId || version !== profileLoadVersion) return false;
        if (activeTracking?.id !== data?.id) {
          stopAltitudeWatch();
          observedAltitude = data?.max_altitude_m ?? null;
        }
        activeTracking = data;
        trackingReady = true;
        setTrackingStatus('');
        renderActiveTracking();
        if (isGpsConsentOn) startAltitudeWatch();
        await loadTrackingHistory();
        return true;
      } catch (error) {
        if (currentUser?.id !== userId || version !== profileLoadVersion) return false;
        setTrackingStatus(`기록을 불러오지 못했습니다: ${error.message} (데이터베이스 설정을 확인해 주세요.)`, true);
        document.getElementById('tracking-summary').textContent = '기록을 불러오지 못했습니다.';
        return false;
      }
    }

    async function loadTrackingHistory() {
      const userId = currentUser?.id;
      const month = document.getElementById('tracking-month').value;
      if (!userId || !/^\d{4}-\d{2}$/.test(month)) return;
      const [year, monthNumber] = month.split('-').map(Number);
      const start = new Date(year, monthNumber - 1, 1);
      const end = new Date(year, monthNumber, 1);
      const summary = document.getElementById('tracking-summary');
      const history = document.getElementById('tracking-history');
      summary.textContent = '기록을 불러오는 중입니다.';
      history.textContent = '';
      try {
        const data = await dataService.listTrackingHistory(userId, start.toISOString(), end.toISOString());
        if (currentUser?.id !== userId || document.getElementById('tracking-month').value !== month) return;
        summary.textContent = `${monthNumber}월 총 ${data.length}회`;
        history.innerHTML = data.length ? data.map(row => {
          const course = COURSES.find(item => item.id === row.course_id);
          const minutes = Math.max(0, Math.floor((new Date(row.ended_at) - new Date(row.started_at)) / 60000));
          const altitude = row.max_altitude_m === null ? '고도 측정값 없음' : `GPS 최고 고도 약 ${Math.round(row.max_altitude_m)}m`;
          return `<div class="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs"><div class="font-bold text-slate-800">${escapeHTML(course?.title || row.course_id)}</div><div class="text-slate-500 mt-1">${escapeHTML(new Date(row.started_at).toLocaleString('ko-KR'))} · ${minutes}분 · ${escapeHTML(altitude)}</div></div>`;
        }).join('') : '<p class="text-xs text-slate-500">이 달의 완료된 기록이 없습니다.</p>';
      } catch (error) {
        if (currentUser?.id === userId && document.getElementById('tracking-month').value === month) {
          summary.textContent = `기록을 불러오지 못했습니다: ${error.message}`;
        }
      }
    }

    function getTrackingPosition() {
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error('이 기기에서 GPS 위치를 사용할 수 없습니다.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, error => {
          const message = error.code === 1 ? '위치 권한이 거부되었습니다. 브라우저 설정에서 허용해 주세요.'
            : error.code === 3 ? '위치 확인 시간이 초과되었습니다. 다시 시도해 주세요.'
            : '현재 위치를 확인하지 못했습니다. GPS와 네트워크를 확인해 주세요.';
          reject(new Error(message));
        }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
      });
    }

    async function handleChatTracking() {
      if (!trackingReady) {
        await refreshTracking();
        return;
      }
      if (activeTracking) await finishTracking();
      else if (activeRoomCourseId) await beginRoomTracking(activeRoomCourseId);
    }

    async function beginRoomTracking(courseId) {
      if (trackingBusy || !currentUser || activeRoomCourseId !== courseId) return;
      if (!isGpsConsentOn) {
        setTrackingStatus('산행 GPS 기록을 시작하려면 별도 동의를 켜 주세요.');
        return;
      }
      if (!await refreshTracking() || activeRoomCourseId !== courseId) return;
      if (trackingBusy || !currentUser) return;
      if (activeTracking) {
        setTrackingStatus(activeTracking.course_id === courseId
          ? '진행 중인 산행 기록을 이어갑니다.'
          : '다른 코스의 산행이 진행 중입니다. 기존 산행을 종료한 뒤 이 코스에서 기록을 시작하세요.', activeTracking.course_id !== courseId);
        return;
      }
      const userId = currentUser.id;
      trackingBusy = true;
      renderActiveTracking();
      setTrackingStatus('GPS 위치를 확인하는 중입니다.');
      try {
        const position = await getTrackingPosition();
        if (currentUser?.id !== userId || activeRoomCourseId !== courseId) return;
        const { latitude, longitude, altitude } = position.coords;
        const maxAltitude = typeof altitude === 'number' && Number.isFinite(altitude) ? altitude : null;
        const data = await dataService.startTracking({
          user_id: userId,
          course_id: courseId,
          start_lat: latitude,
          start_lng: longitude,
          max_altitude_m: maxAltitude
        });
        if (currentUser?.id !== userId) return;
        activeTracking = data;
        observedAltitude = data.max_altitude_m;
        setTrackingStatus('GPS 산행 기록을 시작했습니다. 산행 후 종료 버튼을 눌러 주세요.');
        startAltitudeWatch();
      } catch (error) {
        if (currentUser?.id === userId) {
          setTrackingStatus(`산행 기록을 시작하지 못했습니다: ${error.message} 채팅은 이용할 수 있으며, GPS 기록을 다시 시작해 주세요.`, true);
        }
      } finally {
        trackingBusy = false;
        renderActiveTracking();
      }
    }

    async function finishTracking() {
      if (trackingBusy || !trackingReady || !currentUser || !activeTracking) return;
      const userId = currentUser.id;
      const session = activeTracking;
      trackingBusy = true;
      renderActiveTracking();
      setTrackingStatus(isGpsConsentOn ? '종료 위치를 확인하는 중입니다.' : 'GPS 동의가 꺼져 있어 종료 위치 없이 기록을 마칩니다.');
      try {
        const position = isGpsConsentOn ? await getTrackingPosition() : null;
        if (currentUser?.id !== userId || activeTracking?.id !== session.id) return;
        if (position) rememberAltitude(position);
        stopAltitudeWatch();
        const data = await dataService.finishTracking(session.id, userId, {
            ended_at: new Date().toISOString(),
            end_lat: position?.coords.latitude ?? null,
            end_lng: position?.coords.longitude ?? null,
            max_altitude_m: observedAltitude
          })
        if (!data) throw new Error('진행 중인 산행을 찾을 수 없습니다.');
        if (currentUser?.id !== userId) return;
        activeTracking = null;
        observedAltitude = null;
        setTrackingStatus('산행을 종료하고 기록을 저장했습니다.');
        await loadTrackingHistory();
      } catch (error) {
        if (currentUser?.id === userId) {
          setTrackingStatus(`산행을 종료하지 못했습니다: ${error.message} 다시 시도해 주세요.`, true);
          startAltitudeWatch();
        }
      } finally {
        trackingBusy = false;
        renderActiveTracking();
      }
    }

    function updateAccountButton() {
      const button = document.getElementById('btn-account');
      if (!button) return;
      button.textContent = currentUser ? '로그아웃' : '로그인 / 가입';
      button.title = currentUser?.username || '회원 로그인';
    }

    function setAuthFeedback(message, type = 'error') {
      const feedback = document.getElementById('auth-feedback');
      feedback.textContent = message;
      feedback.className = `text-xs rounded-xl p-2.5 ${type === 'error' ? 'bg-red-50 text-red-700' : 'bg-forest-50 text-forest-800'}`;
    }

    function authErrorMessage(error, mode) {
      const detail = error.errors?.[0]?.longMessage || error.errors?.[0]?.message || error.message;
      return `${mode === 'signup' ? '회원가입' : '로그인'}에 실패했습니다: ${detail || '인증 서버 오류'}`;
    }

    function setAuthMode(mode) {
      authMode = mode;
      const isSignup = mode === 'signup';
      document.getElementById('auth-title').textContent = isSignup ? '회원가입' : '로그인';
      document.getElementById('auth-name-wrap').classList.toggle('hidden', !isSignup);
      document.getElementById('auth-display-name').required = isSignup;
      document.getElementById('auth-password').autocomplete = isSignup ? 'new-password' : 'current-password';
      document.getElementById('auth-password').minLength = isSignup ? 8 : 1;
      document.getElementById('auth-password-label').textContent = isSignup ? '비밀번호 (8자 이상)' : '비밀번호';
      document.getElementById('btn-submit-auth').textContent = isSignup ? '회원가입' : '로그인';
      document.getElementById('btn-toggle-auth-mode').textContent = isSignup
        ? '이미 계정이 있으신가요? 로그인'
        : '계정이 없으신가요? 회원가입';
      document.getElementById('auth-feedback').classList.add('hidden');
    }

    function toggleAuthMode() {
      setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
    }

    async function handleAccountAction() {
      if (!isSupabaseConfigured() || !supabaseClient) {
        showToast('로그인 서버 설정이 필요합니다.');
        return;
      }
      if (currentUser) {
        try {
          await window.Clerk.signOut();
        } catch (error) {
          showToast(`로그아웃하지 못했습니다: ${error.message}`);
        }
        return;
      }

      pendingRoomCourseId = null;
      document.getElementById('auth-context').textContent = '로그인하면 코스별 회원 전용 소통방을 이용할 수 있습니다.';
      setAuthMode('signin');
      openModal('modal-auth');
    }

    async function submitAuth(event) {
      event.preventDefault();
      if (!supabaseClient) {
        setAuthFeedback('Supabase 설정을 먼저 완료해 주세요.');
        return;
      }

      const button = document.getElementById('btn-submit-auth');
      const username = document.getElementById('auth-username').value.trim();
      const password = document.getElementById('auth-password').value;
      const displayName = document.getElementById('auth-display-name').value.trim();
      if (authMode === 'signup' && !displayName) {
        setAuthFeedback('닉네임을 입력해 주세요.');
        return;
      }
      button.disabled = true;
      button.classList.add('opacity-50');
      document.getElementById('auth-feedback').classList.add('hidden');

      try {
        const result = authMode === 'signup'
          ? await window.Clerk.client.signUp.create({ username, password, unsafeMetadata: { display_name: displayName } })
          : await window.Clerk.client.signIn.create({ identifier: username, password });
        if (result.status !== 'complete' || !result.createdSessionId) {
          setAuthFeedback('추가 인증 또는 가입 설정이 필요합니다. 관리자에게 문의해 주세요.');
          return;
        }

        await window.Clerk.setActive({ session: result.createdSessionId });
        currentUser = window.Clerk.user;
        updateAccountButton();
        closeAllModals();
        const courseId = pendingRoomCourseId || localStorage.getItem('pending-course-room-id');
        pendingRoomCourseId = null;
        if (courseId) {
          localStorage.removeItem('pending-course-room-id');
          await enterCourseRoom(courseId);
        } else {
          showToast('로그인되었습니다.');
        }
      } catch (error) {
        setAuthFeedback(authErrorMessage(error, authMode));
      } finally {
        button.disabled = false;
        button.classList.remove('opacity-50');
      }
    }

    async function enterCourseRoom(courseId) {
      const course = COURSES.find(item => item.id === courseId);
      if (!course || !currentUser || !dataService) {
        showToast('로그인과 코스 선택을 확인해 주세요.');
        return;
      }

      selectedCourse = course;
      hasSelectedCourse = true;
      updateCourseBoundUI();
      showToast('코스 소통방 입장을 확인하는 중입니다.');

      try {
        const membership = await dataService.getRoomMembership(courseId, currentUser.id);

        if (!membership) {
          await dataService.joinRoom(courseId, currentUser.id, getDisplayName(currentUser));
        }

        activeRoomCourseId = courseId;
        closeAllModals();
        goToStep(3);
        await stopRoomSubscription();
        await loadRoomMessages(courseId);
        subscribeToRoom(courseId);
        showChatStatus(`${course.title} 실시간 소통방에 입장했습니다.`, 'success');
        void refreshTracking();
      } catch (error) {
        activeRoomCourseId = null;
        goToStep(2);
        showToast(`소통방에 입장하지 못했습니다: ${error.message}`);
      }
    }

    async function loadRoomMessages(courseId) {
      chatMessages = [];
      renderChat();
      chatMessages = await dataService.listRoomMessages(courseId);
      renderChat();
    }

    function subscribeToRoom(courseId) {
      let channel;
      channel = dataService.subscribeToRoomMessages(courseId, appendChatMessage, status => {
        if (chatSubscription && chatSubscription !== channel) return;
        if (status === 'SUBSCRIBED') {
          showChatStatus('실시간 소통방에 연결되었습니다.', 'success');
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          showChatStatus('실시간 연결이 끊겼습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.', 'error', true);
        }
      });
      chatSubscription = channel;
    }

    async function stopRoomSubscription() {
      if (!chatSubscription || !dataService) return;
      const channel = chatSubscription;
      await dataService.removeRoomChannel(channel);
      if (chatSubscription === channel) chatSubscription = null;
    }

    async function retryRoomConnection() {
      const courseId = activeRoomCourseId;
      if (!courseId || !currentUser || !dataService) {
        showChatStatus('코스 소통방에 다시 입장한 뒤 연결을 시도해 주세요.');
        return;
      }

      const button = document.getElementById('retry-chat-connection');
      button.disabled = true;
      button.textContent = '연결 중...';
      try {
        await stopRoomSubscription();
        await loadRoomMessages(courseId);
        subscribeToRoom(courseId);
        showChatStatus('이전 메시지를 불러왔습니다. 실시간 연결을 확인하고 있습니다.', 'success');
      } catch (error) {
        showChatStatus(`실시간 연결을 복구하지 못했습니다: ${error.message}`, 'error', true);
      } finally {
        button.disabled = false;
        button.textContent = '실시간 연결 다시 시도';
      }
    }

    async function leaveCourseRoom() {
      if (!currentUser || !activeRoomCourseId || !dataService) {
        goToStep(2);
        return;
      }

      const courseId = activeRoomCourseId;
      try {
        await dataService.leaveRoom(courseId, currentUser.id);
      } catch (error) {
        showChatStatus(`방에서 나가지 못했습니다: ${error.message}`, 'error', true);
        return;
      }

      activeRoomCourseId = null;
      try {
        await stopRoomSubscription();
      } catch (error) {
        showChatStatus(`실시간 연결을 종료하지 못했습니다: ${error.message}`);
      }
      goToStep(2);
      showToast('소통방에서 나왔습니다. 다시 입장하려면 동의가 필요합니다.');
    }

    function openModal(id) {
      document.getElementById('modal-backdrop').classList.remove('hidden');
      document.querySelectorAll('.app-modal').forEach(modal => {
        modal.classList.toggle('hidden', modal.id !== id);
      });
    }

    function closeAllModals() {
      document.getElementById('modal-backdrop').classList.add('hidden');
    }

    async function initializeSupabase() {
      try {
        if (!window.Clerk || !window.supabase) throw new Error('인증 또는 채팅 라이브러리를 불러오지 못했습니다.');
        await window.Clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
          accessToken: async () => await window.Clerk.session?.getToken() ?? null
        });
        dataService = window.TrailMateData.create(supabaseClient);
        clerkReady = true;
        currentUser = window.Clerk.user;
        updateAccountButton();
        if (currentUser) void refreshTracking();
        window.Clerk.addListener(({ user }) => {
          const previousUserId = currentUser?.id;
          currentUser = user;
          updateAccountButton();
          if (previousUserId && previousUserId !== user?.id) {
            profileLoadVersion++;
            stopAltitudeWatch();
            activeTracking = null;
            observedAltitude = null;
            trackingReady = false;
            if (!document.getElementById('screen-5').classList.contains('hidden')) goToStep(1);
          }
          if (user && previousUserId !== user.id) void refreshTracking();
          if (!user && activeRoomCourseId) {
            activeRoomCourseId = null;
            void stopRoomSubscription().catch(error => {
              showChatStatus(`실시간 연결을 종료하지 못했습니다: ${error.message}`);
            });
            if (!document.getElementById('screen-3').classList.contains('hidden')) goToStep(2);
          }
        });
        const pendingCourseId = localStorage.getItem('pending-course-room-id');
        if (currentUser && pendingCourseId) {
          localStorage.removeItem('pending-course-room-id');
          await enterCourseRoom(pendingCourseId);
        }
      } catch (error) {
        showToast(`로그인 서버에 연결하지 못했습니다: ${error.message}`);
      }
    }

    // Initialize on load
    window.addEventListener('DOMContentLoaded', async () => {
      renderCourses();
      updateCourseBoundUI();
      renderChat();
      await initializeSupabase();
    });
