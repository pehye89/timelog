    // ---- 메모 탭: 적은 메모를 날짜별로 묶어 시간순 타임라인으로 본다 ----
    // 메모는 { id, date, time, bullets } 로 따로 저장한다. 왼쪽 캘린더(또는 그 밑의 전체·금일·금주·금월)로 기간을 고르고,
    // 원하면 그 기간의 업무 기록 메모도 같은 타임라인에 함께 보여준다. 새 메모는 항상 오늘·지금 시각으로 기록된다.

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
    // 메모는 타임로그 메모처럼 항목(bullet) 목록으로 쓰고, 시각은 항상 추가한 순간으로 찍힌다.
    let memoComposeEditor = null;
    let memoEditEditor = null;

    // 예전 형식({ text })의 메모도 항목 목록으로 읽는다
    function memoBullets(m) {
        if (Array.isArray(m.bullets)) return m.bullets;
        return String(m.text || '').split('\n').filter(Boolean);
    }

    // Ctrl(⌘)+Enter / Esc를 항목 편집기보다 먼저 받는다 (편집기의 Enter는 다음 항목 만들기)
    function bindMemoKeys(containerEl, onSubmit, onCancel) {
        containerEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.stopPropagation(); onSubmit(); }
            else if (e.key === 'Escape' && onCancel) { e.preventDefault(); e.stopPropagation(); onCancel(); }
        }, true);
    }

    function ensureMemoComposer() {
        if (memoComposeEditor) return;
        const el = document.getElementById('memoBullets');
        memoComposeEditor = createBulletEditor(el, { placeholder: '메모를 입력하세요' });
        bindMemoKeys(el, addMemo);
    }

    function addMemo() {
        const bullets = memoComposeEditor.getBullets();
        if (!bullets.length) { memoComposeEditor.focus(); return; }
        const memos = getMemos();
        const now = new Date();
        memos.push({ id: Date.now() + Math.floor(Math.random() * 1000), date: dateToIso(now), time: dateToHHMM(now), bullets });
        saveMemos(memos);
        memoComposeEditor.setBullets([]);
        renderMemoTab();
        memoComposeEditor.focus();
        if (!inDateRange(dateToIso(now), memoPeriod.from, memoPeriod.to)) showToast('추가했습니다. 오늘이 지금 기간에 포함되지 않아 목록에는 보이지 않습니다');
    }

    function startMemoEdit(id) { memoEditingId = id; renderMemoTab(); }
    function cancelMemoEdit() { memoEditingId = null; memoEditEditor = null; renderMemoTab(); }

    function saveMemoEdit(id) {
        const bullets = memoEditEditor ? memoEditEditor.getBullets() : [];
        if (!bullets.length) { deleteMemo(id); return; }
        const memos = getMemos();
        const m = memos.find(x => x.id === id);
        if (m) { m.bullets = bullets; delete m.text; saveMemos(memos); }
        memoEditingId = null; memoEditEditor = null;
        renderMemoTab();
    }

    function deleteMemo(id) {
        if (!confirm('이 메모를 삭제할까요?')) return;
        saveMemos(getMemos().filter(m => m.id !== id));
        memoEditingId = null; memoEditEditor = null;
        renderMemoTab();
    }

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
        ensureMemoComposer();
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

        const list = document.getElementById('memoTimeline');
        if (!memos.length && !logs.length) {
            list.innerHTML = `<div class="memo-empty">${memoPeriod.preset === 'all' ? '아직 적은 메모가 없습니다.' : '이 기간에 적은 메모가 없습니다.'}</div>`;
            return;
        }

        // 최근 날짜가 위로, 한 날짜 안에서는 시간순 (같은 시각이면 업무 기록 먼저, 그다음 메모는 적은 순서)
        const byDate = {};
        [...logs, ...memos].forEach(it => { (byDate[it.date] = byDate[it.date] || []).push(it); });
        const today = getTodayIso();
        list.innerHTML = Object.keys(byDate).sort().reverse().map(date => {
            const items = byDate[date].sort((a, b) =>
                a.time.localeCompare(b.time) || (a.kind === b.kind ? 0 : a.kind === 'log' ? -1 : 1)
                || (a.memo && b.memo ? a.memo.id - b.memo.id : 0));
            const d = isoToDate(date);
            return `
                <div class="memo-day">
                    <div class="memo-day-head">${date.replace(/-/g, '.')} ${DAYS_EN[d.getDay()]}${date === today ? '<span class="memo-day-today">오늘</span>' : ''}</div>
                    <div class="memo-day-items">${items.map(it => it.kind === 'memo' ? memoItemHtml(it.memo) : logItemHtml(it.log, it.job)).join('')}</div>
                </div>`;
        }).join('');

        const editEl = memoEditingId && document.getElementById(`memoEditBullets_${memoEditingId}`);
        if (editEl) {
            const m = getMemos().find(x => x.id === memoEditingId);
            const id = memoEditingId;
            memoEditEditor = createBulletEditor(editEl, { initialBullets: memoBullets(m) });
            bindMemoKeys(editEl, () => saveMemoEdit(id), cancelMemoEdit);
            memoEditEditor.focus();
        } else { memoEditEditor = null; }
    }

    function memoItemHtml(m) {
        if (m.id === memoEditingId) {
            return `
                <div class="memo-item memo-item--memo is-editing">
                    <div class="memo-time">${escapeHtml(m.time || '')}</div>
                    <div class="memo-rail"><span class="memo-dot"></span></div>
                    <div class="memo-body">
                        <div class="memo-edit-box" id="memoEditBullets_${m.id}"></div>
                        <div class="memo-edit-actions">
                            <span class="memo-hint">Ctrl+Enter 저장 · Esc 취소</span>
                            <button class="btn-ghost btn-ghost--xs" onclick="cancelMemoEdit()">취소</button>
                            <button class="btn-solid btn-solid--sm" onclick="saveMemoEdit(${m.id})">저장</button>
                        </div>
                    </div>
                </div>`;
        }
        return `
            <div class="memo-item memo-item--memo">
                <div class="memo-time">${escapeHtml(m.time || '')}</div>
                <div class="memo-rail"><span class="memo-dot"></span></div>
                <div class="memo-body">
                    <div class="memo-bullets" onclick="startMemoEdit(${m.id})" title="눌러서 수정">${buildDotLines(memoBullets(m))}</div>
                    <div class="memo-item-actions">
                        <button class="btn-text" onclick="startMemoEdit(${m.id})">수정</button>
                        <button class="btn-text btn-text--danger" onclick="deleteMemo(${m.id})">삭제</button>
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
