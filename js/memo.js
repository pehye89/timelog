    // ---- 메모 탭: 적은 메모를 날짜별로 묶어 시간순 타임라인으로 본다 ----
    // 메모는 { id, date, time, bullets } 로 따로 저장한다. 왼쪽 캘린더(또는 그 밑의 전체·금일·금주·금월)로 기간을 고르고,
    // 원하면 그 기간의 업무 기록 메모도 같은 타임라인에 함께 보여준다. 날짜는 최신이 위로, 하루 안은 시간 순이며 오늘의 맨 아래 줄에 바로 써서 Enter로 저장한다.

    const STORAGE_KEY_MEMOS = 'wt_minimal_memos_v1';
    const STORAGE_KEY_MEMO_SHOW_LOGS = 'wt_minimal_memo_show_logs';
    const STORAGE_KEY_MEMO_PERIOD = 'wt_minimal_memo_period';

    let memoEditingId = null;
    let memoPeriod = { preset: 'all', from: '', to: '' };

    function getMemos() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY_MEMOS)) || []; } catch (e) { return []; } }
    function saveMemos(memos) { localStorage.setItem(STORAGE_KEY_MEMOS, JSON.stringify(memos)); }

    // ---------- 기간 필터 ----------
    // 금일·금주·금월은 고를 때마다 오늘 기준으로 다시 계산한다 (저장해 둔 것도 다음 날 열면 그날 기준)
    function memoPresetRange(preset) {
        const today = new Date();
        if (preset === 'today') return { from: dateToIso(today), to: dateToIso(today) };
        if (preset === 'week') {
            const mon = new Date(today); mon.setDate(today.getDate() - ((today.getDay() + 6) % 7));
            const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
            return { from: dateToIso(mon), to: dateToIso(sun) };
        }
        if (preset === 'month') {
            return { from: dateToIso(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateToIso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) };
        }
        return { from: '', to: '' }; // 전체
    }

    function loadMemoPeriod() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_MEMO_PERIOD) || 'null');
            if (saved && ['all', 'today', 'week', 'month', 'custom'].includes(saved.preset)) memoPeriod = saved;
        } catch (e) {}
        if (memoPeriod.preset !== 'custom') memoPeriod = { preset: memoPeriod.preset, ...memoPresetRange(memoPeriod.preset) };
    }
    loadMemoPeriod();
    function saveMemoPeriod() { try { localStorage.setItem(STORAGE_KEY_MEMO_PERIOD, JSON.stringify(memoPeriod)); } catch (e) {} }

    function setMemoPeriod(preset) {
        memoPeriod = { preset, ...memoPresetRange(preset) };
        memoPickingRange = false;
        const base = memoPeriod.to ? isoToDate(memoPeriod.to) : new Date(); // 그 기간이 있는 달로 캘린더를 옮긴다
        memoCalMonth = new Date(base.getFullYear(), base.getMonth(), 1);
        saveMemoPeriod(); renderMemoTab();
    }

    function renderMemoPeriodBar() {
        document.querySelectorAll('#memoPeriodBar [data-period]').forEach(btn =>
            btn.classList.toggle('active', btn.dataset.period === memoPeriod.preset));
    }

    // ---------- 왼쪽 캘린더 ----------
    // 날짜를 한 번 누르면 그 하루, 이어서 다른 날을 누르면 두 날 사이 기간이 된다. 메모가 있는 날에는 점이 찍힌다.
    let memoCalMonth = null;      // 보고 있는 달의 1일
    let memoPickingRange = false; // 시작일을 고르고 끝날을 기다리는 중

    function shiftMemoCalMonth(delta) {
        memoCalMonth = new Date(memoCalMonth.getFullYear(), memoCalMonth.getMonth() + delta, 1);
        renderMemoCalendar();
    }

    function pickMemoCalDay(iso) {
        if (memoPickingRange && memoPeriod.from) {
            const [from, to] = iso < memoPeriod.from ? [iso, memoPeriod.from] : [memoPeriod.from, iso];
            memoPeriod = { preset: 'custom', from, to };
            memoPickingRange = false;
        } else {
            memoPeriod = { preset: 'custom', from: iso, to: iso };
            memoPickingRange = true;
        }
        saveMemoPeriod(); renderMemoTab();
    }

    function renderMemoCalendar() {
        if (!memoCalMonth) {
            const base = memoPeriod.to ? isoToDate(memoPeriod.to) : new Date();
            memoCalMonth = new Date(base.getFullYear(), base.getMonth(), 1);
        }
        const y = memoCalMonth.getFullYear(), mo = memoCalMonth.getMonth();
        document.getElementById('memoCalTitle').textContent = `${y}.${String(mo + 1).padStart(2, '0')}`;

        const hasMemo = new Set(getMemos().map(m => m.date));
        const today = getTodayIso(), { from, to } = memoPeriod;
        const lead = (new Date(y, mo, 1).getDay() + 6) % 7; // 월요일 시작
        const cells = Array.from({ length: lead }, () => '<span class="cal-cell cal-cell--empty"></span>');
        for (let day = 1; day <= new Date(y, mo + 1, 0).getDate(); day++) {
            const iso = dateToIso(new Date(y, mo, day));
            const cls = ['cal-cell', 'cal-day', 'memo-cal-day'];
            if (from && to && iso >= from && iso <= to) cls.push('in-range');
            if (iso === from) cls.push('range-start');
            if (iso === to) cls.push('range-end');
            if (iso === today) cls.push('is-today');
            if (hasMemo.has(iso)) cls.push('has-memo');
            cells.push(`<button type="button" class="${cls.join(' ')}" onclick="pickMemoCalDay('${iso}')"><span>${day}</span></button>`);
        }
        document.getElementById('memoCalGrid').innerHTML = cells.join('');
    }

    // 메모 패널 제목 밑에 보이는 지금 기간
    function memoPeriodLabel() {
        const fmt = (iso) => iso.replace(/-/g, '.'), { from, to } = memoPeriod;
        if (memoPickingRange) return `${fmt(from)} · 끝 날짜를 누르면 기간이 됩니다`;
        if (!from) return '전체 기간';
        return from === to ? fmt(from) : `${fmt(from)} ~ ${fmt(to)}`;
    }

    // ---------- 추가·수정·삭제 ----------
    // 오늘 타임라인 맨 아래(지금 시각) 줄에 바로 쓰고 Enter를 누르면 그 순간의 시각으로 저장된다.
    // Tab을 누르면 입력 칸이 바로 위 메모(오늘 가장 늦은 메모)의 항목들 밑으로 들어가고,
    // 거기서 Enter로 하위 항목을 계속 붙인다. 빈 칸에서 Enter·Backspace·Shift+Tab → 한 단계 위로.
    let memoEditEditor = null;
    const MEMO_MAX_LEVEL = 2;
    let memoDraft = { text: '', level: 0, parentId: null }; // 다시 그려도 쓰던 내용이 남도록
    const sameId = (a, b) => String(a) === String(b);

    // 예전 형식({ text })의 메모도 항목 목록으로 읽는다
    function memoBullets(m) {
        if (Array.isArray(m.bullets)) return m.bullets;
        return String(m.text || '').split('\n').filter(Boolean);
    }

    function memoQuickInput() { return document.getElementById('memoQuickInput'); }
    function focusMemoQuickInput() {
        const el = memoQuickInput(); if (!el) return;
        el.focus(); el.setSelectionRange(el.value.length, el.value.length);
    }

    function memoQuickKeydown(e) {
        const el = e.target;
        if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter는 글자 확정용
        const empty = !el.value.trim();
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (empty && memoDraft.level) setMemoDraftLevel(memoDraft.level - 1);
            else saveQuickMemo();
        }
        else if (e.key === 'Tab') { e.preventDefault(); setMemoDraftLevel(memoDraft.level + (e.shiftKey ? -1 : 1)); }
        else if (e.key === 'Backspace' && memoDraft.level && el.selectionStart === 0 && el.selectionEnd === 0) { e.preventDefault(); setMemoDraftLevel(memoDraft.level - 1); }
        else if (e.key === 'Escape') { e.preventDefault(); el.value = ''; memoDraft.text = ''; setMemoDraftLevel(0); }
    }
    function memoQuickInputChanged(el) {
        memoDraft.text = el.value;
        el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`;
    }

    function latestTodayMemo() {
        const today = getTodayIso();
        // 화면에서 입력 칸 바로 위에 보이는 메모 = 오늘 시간이 가장 늦은(같으면 나중에 적은) 메모
        return getMemos().filter(m => m.date === today)
            .sort((a, b) => String(b.time || '').localeCompare(String(a.time || '')) || (Number(b.id) || 0) - (Number(a.id) || 0))[0] || null;
    }

    // 들여쓰기 단계를 바꾸면 입력 칸이 그 자리로 옮겨 그려진다
    function setMemoDraftLevel(level) {
        level = Math.max(0, Math.min(MEMO_MAX_LEVEL, level));
        if (level > 0 && !memoDraft.parentId) {
            const parent = latestTodayMemo();
            if (!parent) { showToast('오늘 적은 메모가 있어야 하위 항목을 붙일 수 있어요'); return; }
            memoDraft.parentId = parent.id;
        }
        if (level === 0) memoDraft.parentId = null;
        if (level === memoDraft.level) return;
        memoDraft.level = level;
        renderMemoTab();
        focusMemoQuickInput();
    }

    function saveQuickMemo() {
        const text = memoDraft.text.trim();
        if (!text) return;
        const memos = getMemos();
        const now = new Date(), today = dateToIso(now);
        const parent = memoDraft.level ? memos.find(m => sameId(m.id, memoDraft.parentId)) : null;
        if (parent) {
            parent.bullets = [...memoBullets(parent), '\t'.repeat(memoDraft.level) + text];
            delete parent.text;
        } else {
            // id는 항상 늘어나게(같은 분 안에서도 나중에 쓴 것이 위로)
            const id = Math.max(Date.now(), ...memos.map(m => (Number(m.id) || 0) + 1));
            memos.push({ id, date: today, time: dateToHHMM(now), bullets: [text] });
            memoDraft.level = 0; memoDraft.parentId = null;
        }
        saveMemos(memos);
        memoDraft.text = '';
        renderMemoTab();
        focusMemoQuickInput();
        if (!inDateRange(today, memoPeriod.from, memoPeriod.to)) showToast('저장했습니다. 오늘이 지금 기간에 포함되지 않아 목록에는 보이지 않습니다');
    }

    // 기존 메모는 눌러서 고치고, 다른 곳을 누르면 바로 저장된다 (Esc는 취소)
    function startMemoEdit(id) { memoEditingId = id; renderMemoTab(); }
    const findMemoIndex = (memos, id) => memos.findIndex(m => sameId(m.id, id));
    function cancelMemoEdit() { memoEditingId = null; memoEditEditor = null; renderMemoTab(); }

    function saveMemoEdit(id) {
        if (!sameId(memoEditingId, id) || !memoEditEditor) return;
        const bullets = memoEditEditor.getBullets();
        memoEditingId = null; memoEditEditor = null;
        const memos = getMemos();
        if (!bullets.length) { renderMemoTab(); deleteMemo(id); return; } // 다 지우면 삭제 (되돌리기 가능)
        const m = memos[findMemoIndex(memos, id)];
        if (m) { m.bullets = bullets; delete m.text; saveMemos(memos); }
        renderMemoTab();
    }

    // 확인 창 없이 바로 지우고, 알림의 '되돌리기'로 복구한다
    // (확인 창이 막힌 환경에서도 삭제가 되도록)
    function deleteMemo(id) {
        const memos = getMemos();
        const idx = findMemoIndex(memos, id);
        if (idx < 0) return;
        const [removed] = memos.splice(idx, 1);
        saveMemos(memos);
        if (sameId(memoDraft.parentId, id)) { memoDraft.level = 0; memoDraft.parentId = null; }
        memoEditingId = null; memoEditEditor = null;
        renderMemoTab();
        showToast('메모를 삭제했습니다', { actionLabel: '되돌리기', onAction: () => {
            const cur = getMemos();
            if (findMemoIndex(cur, removed.id) < 0) { cur.push(removed); saveMemos(cur); }
            renderMemoTab();
        } });
    }

    // 입력 줄의 시각은 지금 시각을 따라간다
    setInterval(() => { const t = document.getElementById('memoNowTime'); if (t) t.textContent = dateToHHMM(new Date()); }, 30000);

    // ---------- 업무 기록 메모 함께 보기 ----------
    function isMemoShowingLogs() {
        try { return localStorage.getItem(STORAGE_KEY_MEMO_SHOW_LOGS) !== '0'; } catch (e) { return true; }
    }
    function toggleMemoShowLogs(checked) {
        try { localStorage.setItem(STORAGE_KEY_MEMO_SHOW_LOGS, checked ? '1' : '0'); } catch (e) {}
        renderMemoTab();
    }

    // ---------- 그리기 ----------
    function renderMemoTab() {
        if (document.getElementById('tabMemoView').classList.contains('hidden')) return;
        const hadFocus = document.activeElement === memoQuickInput();
        // 고치던 내용은 다시 그려도 그대로 이어지게
        const editDraft = memoEditingId && memoEditEditor ? memoEditEditor.getBullets() : null;
        renderMemoCalendar();
        renderMemoPeriodBar();

        const showLogs = isMemoShowingLogs();
        document.getElementById('memoShowLogs').checked = showLogs;
        const inPeriod = (date) => inDateRange(date, memoPeriod.from, memoPeriod.to);

        const memos = getMemos().filter(m => inPeriod(m.date))
            .map(m => ({ kind: 'memo', date: m.date, time: m.time || '00:00', memo: m }));
        let logs = [];
        if (showLogs) {
            const presetsMap = {};
            getPresets().forEach(p => { presetsMap[p.id] = p; });
            logs = getHistory()
                .filter(h => inPeriod(h.date) && h.bullets && h.bullets.length)
                .map(h => ({ kind: 'log', date: h.date, time: h.startTime || '00:00', log: h, job: presetsMap[h.jobId] || h }));
        }

        document.getElementById('memoTabSub').textContent = memoPeriodLabel() + (memos.length ? ` · 메모 ${memos.length}개` : '');

        // 날짜는 최신이 위로, 한 날짜 안에서는 시간 순(위→아래)으로 이어 쓰고, 입력 칸은 오늘의 맨 끝
        // (같은 시각이면 업무 기록 → 먼저 적은 메모 순)
        const today = getTodayIso();
        const byDate = { [today]: [] };
        [...logs, ...memos].forEach(it => { (byDate[it.date] = byDate[it.date] || []).push(it); });
        const rank = (it) => (it.kind === 'memo' ? 1 : 0);
        const dayHtml = (date, items, withInput) => {
            const d = isoToDate(date);
            items.sort((a, b) => a.time.localeCompare(b.time) || rank(a) - rank(b) || (a.memo && b.memo ? a.memo.id - b.memo.id : 0));
            return `
                <div class="memo-day">
                    <div class="memo-day-head">${date.replace(/-/g, '.')} ${DAYS_EN[d.getDay()]}${date === today ? '<span class="memo-day-today">오늘</span>' : ''}</div>
                    <div class="memo-day-items">${items.map(it => it.kind === 'memo' ? memoItemHtml(it.memo) : logItemHtml(it.log, it.job)).join('')}${withInput && !memoDraft.level ? quickInputHtml() : ''}</div>
                </div>`;
        };
        const otherDates = Object.keys(byDate).filter(d => d !== today).sort().reverse();
        const list = document.getElementById('memoTimeline');
        list.innerHTML = dayHtml(today, byDate[today], true)
            + otherDates.map(d => dayHtml(d, byDate[d], false)).join('')
            + (!memos.length && !logs.length && !inPeriod(today) ? '<div class="memo-empty">이 기간에 적은 메모가 없습니다.</div>' : '');

        // 하위 항목을 붙이던 메모가 화면에 없으면(삭제·기간 밖) 새 메모 입력으로 돌아간다
        if (memoDraft.level && !memoQuickInput()) { memoDraft.level = 0; memoDraft.parentId = null; renderMemoTab(); return; }
        const input = memoQuickInput();
        input.value = memoDraft.text;
        memoQuickInputChanged(input);
        if (hadFocus) focusMemoQuickInput();

        const editEl = memoEditingId && document.getElementById(`memoEditBullets_${memoEditingId}`);
        if (editEl) {
            const m = getMemos().find(x => sameId(x.id, memoEditingId));
            const id = memoEditingId;
            memoEditEditor = createBulletEditor(editEl, { initialBullets: editDraft || memoBullets(m) });
            editEl.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancelMemoEdit(); }
            }, true);
            // 편집 칸 밖으로 포커스가 나가면 저장. 나가는 곳을 알면 바로(그 클릭이 화면을 다시 그리기 전에),
            // 모르면(빈 곳 클릭 등) 포커스가 자리 잡은 뒤에 확인한다
            editEl.addEventListener('focusout', (e) => {
                if (e.relatedTarget && editEl.contains(e.relatedTarget)) return;
                if (e.relatedTarget) { saveMemoEdit(id); return; }
                setTimeout(() => { if (editEl.isConnected && !editEl.contains(document.activeElement)) saveMemoEdit(id); }, 0);
            });
            memoEditEditor.focus();
        } else { memoEditEditor = null; }
    }

    function quickInputHtml() {
        return `
            <div class="memo-item memo-item--quick" id="memoQuickRow">
                <div class="memo-time" id="memoNowTime">${dateToHHMM(new Date())}</div>
                <div class="memo-rail"><span class="memo-dot"></span></div>
                <div class="memo-body">
                    <textarea id="memoQuickInput" class="memo-quick-input" rows="1" placeholder="메모를 입력하세요"
                        oninput="memoQuickInputChanged(this)" onkeydown="memoQuickKeydown(event)"></textarea>
                </div>
            </div>`;
    }

    // 하위 항목 입력 칸: 붙일 메모의 항목들 바로 밑에, 단계만큼 들여서
    function subInputHtml() {
        return `
            <div class="memo-sub-input" style="margin-left:${memoDraft.level * 16}px;">
                <span class="bullet-line-dot bullet-line-dot--sub"></span>
                <textarea id="memoQuickInput" class="memo-quick-input" rows="1" placeholder="하위 항목을 입력하세요"
                    oninput="memoQuickInputChanged(this)" onkeydown="memoQuickKeydown(event)"></textarea>
            </div>`;
    }

    function memoItemHtml(m) {
        const id = escapeHtml(JSON.stringify(m.id));
        if (sameId(m.id, memoEditingId)) {
            return `
                <div class="memo-item memo-item--memo is-editing">
                    <div class="memo-time">${escapeHtml(m.time || '')}</div>
                    <div class="memo-rail"><span class="memo-dot"></span></div>
                    <div class="memo-body"><div class="memo-edit-box" id="memoEditBullets_${m.id}"></div></div>
                </div>`;
        }
        return `
            <div class="memo-item memo-item--memo">
                <div class="memo-time">${escapeHtml(m.time || '')}</div>
                <div class="memo-rail"><span class="memo-dot"></span></div>
                <div class="memo-body">
                    <div class="memo-bullets" onclick="startMemoEdit(${id})" title="눌러서 수정">${buildDotLines(memoBullets(m))}</div>
                    ${memoDraft.level && sameId(m.id, memoDraft.parentId) ? subInputHtml() : ''}
                    <div class="memo-item-actions">
                        <button class="btn-text" onclick="startMemoEdit(${id})">수정</button>
                        <button class="btn-text btn-text--danger" onclick="deleteMemo(${id})">삭제</button>
                    </div>
                </div>
            </div>`;
    }

    function logItemHtml(h, job) {
        const color = (job && job.color) || 'var(--text-muted)';
        return `
            <div class="memo-item memo-item--log">
                <div class="memo-time">${escapeHtml(h.startTime || '')}</div>
                <div class="memo-rail"><span class="memo-dot" style="--memo-dot-color: ${color};"></span></div>
                <div class="memo-body">
                    <div class="memo-log-head">
                        <span class="memo-log-name">${escapeHtml(job.opsName || '')}</span>
                        <span class="memo-log-range">${escapeHtml(h.startTime || '')}–${escapeHtml(h.endTime || '')}</span>
                    </div>
                    <div class="memo-log-bullets">${buildDotLines(h.bullets)}</div>
                </div>
            </div>`;
    }
