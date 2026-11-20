    // ===== ERP(ECOUNT) 시간 로그 자동입력 =====
    // 동작 방식: 즐겨찾기 버튼(북마클릿)을 ERP 화면에서 누르면, 클립보드에 복사해 둔
    // 이 날짜의 시간로그를 읽어 「시간 로그입력」 표의 빈 줄부터 대신 채운다. 저장은 사람이 직접 한다.
    // ERP 칸 매핑: 작업=작업번호 / 업무=운영별 「ERP 업무」(기본값 '운영') / 거래=운영번호 / 시간(분)=총 시간 / 종료 예정일=완료일자 / 비고=메모
    // (카테고리는 TimeLog에 없는 항목이라 비워 두고 넘어간다.)

    const ERP_PREFIX = 'TLERP:';
    const ERP_BIZZ = '운영';            // 업무 칸 기본값 (운영 설정에서 운영별로 바꿀 수 있음)
    const ERP_KEY_STORAGE = 'timelog-erp-key';

    // ERP 화면에서 실행되는 본체. 함수로 적고 toString()으로 문자열을 만든다(따옴표 이스케이프를 피하려고).
    function TIMELOG_ERP_FILL() {
        if (window.__tlPanel && document.body.contains(window.__tlPanel)) window.__tlPanel.remove();
        // 한 번에 하나만 실행: 즐겨찾기를 다시 누르거나 닫으면 이전에 돌던 채우기는 바로 멈춘다
        const RUN = (window.__tlRun = (window.__tlRun || 0) + 1), ABORT = '__tlAbort';

        // 창이 비활성이어도 멈추지 않는 타이머(비활성 탭에서 setTimeout이 느려지는 것을 피함)
        const S = (() => {
            let w = null, id = 0; const cb = new Map();
            try {
                w = new Worker(URL.createObjectURL(new Blob(['onmessage=function(e){setTimeout(function(){postMessage(e.data.i)},e.data.ms)}'], { type: 'text/javascript' })));
                w.onmessage = (e) => { const f = cb.get(e.data); cb.delete(e.data); f && f(); };
            } catch (e) { w = null; }
            return (ms) => new Promise((done, fail) => {
                const r = () => (window.__tlRun !== RUN ? fail(new Error(ABORT)) : done());
                if (!w) return setTimeout(r, ms);
                const i = ++id; cb.set(i, r); w.postMessage({ i, ms });
            });
        })();

        const josa = (w, withB, noB) => { const m = String(w).match(/[가-힣](?=[^가-힣]*$)/); return w + (m && (m[0].charCodeAt(0) - 0xAC00) % 28 ? withB : noB); };
        const esc = (x) => String(x == null ? '' : x).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
        // ERP 표의 각 칸을 가리키는 내부 키
        const K = {
            job: 'conn_data_002_boardXdetail', bizz: 'dynamic_bizz_boardXdetail', trx: 'dynamic_trx_boardXdetail',
            cat: 'cd_001_boardXdetail', min: 'num_001_boardXdetail', dt: 'dt_001_boardXdetail', note: 'atxt_001_boardXdetail'
        };
        const iset = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
        const tset = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;

        const findDlg = () => [...document.querySelectorAll('.ui-dialog')].find((d) => d.offsetWidth > 0 && d.querySelector('[data-item-key="' + K.job + '"]'));
        const dataRows = () => { const d = findDlg(); return d ? [...d.querySelectorAll('table.table-grid-input tbody tr')].filter((tr) => tr.querySelector('[data-item-key="' + K.job + '"]')) : []; };
        const popups = () => { const d = findDlg(); return [...document.querySelectorAll('.ui-dialog')].filter((x) => x !== d && x.offsetWidth > 0 && !(d && d.contains(x))); };
        const press = (el, key) => { const code = key === 'Enter' ? 13 : key === 'Escape' ? 27 : 9; el.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, keyCode: code, which: code, bubbles: true, cancelable: true })); };
        const waitFor = async (fn, ms) => { for (let t = 0; t < (ms || 3000); t += 100) { let v; try { v = fn(); } catch (e) { v = null; } if (v) return v; await S(100); } return null; };
        const keyOf = (el) => el && (el.getAttribute && el.getAttribute('data-item-key') || (el.closest && el.closest('[data-item-key]') ? el.closest('[data-item-key]').getAttribute('data-item-key') : ''));
        const activeIs = (k) => { const a = document.activeElement; return a && keyOf(a) === k ? a : null; };
        const rowIndexOf = (el) => dataRows().findIndex((tr) => tr.contains(el));
        const cellText = (tr, k) => { const el = tr.querySelector('[data-item-key="' + k + '"]'); if (!el) return ''; const td = el.closest('td'); const inp = td.querySelector('input,textarea'); return ((inp && inp.value) || td.textContent || '').trim(); };

        // ---------- 안내 패널 ----------
        const panel = document.createElement('div'); window.__tlPanel = panel;
        panel.style.cssText = 'position:fixed;right:24px;bottom:24px;z-index:2147483647;width:330px;background:#fff;color:#222;border:2px solid #0f172a;border-radius:10px;box-shadow:0 8px 30px rgba(0,0,0,.25);font:13px/1.55 "Malgun Gothic",sans-serif;padding:14px 16px';
        panel.innerHTML = '<div style="font-weight:700;font-size:14px;margin-bottom:6px">TimeLog → ERP 자동입력</div><div data-tl="msg"></div><div style="display:flex;gap:8px;margin-top:10px"><button data-tl="go" style="flex:1;padding:8px;border:0;border-radius:6px;background:#0f172a;color:#fff;font-weight:700;cursor:pointer">채우기 시작</button><button data-tl="x" style="padding:8px 12px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer">닫기</button></div>';
        document.body.appendChild(panel);
        const msg = (h) => { panel.querySelector('[data-tl="msg"]').innerHTML = h; };

        // 패널을 눌러도 ERP가 편집 중인 칸을 닫지 않게: 패널 안의 마우스 누름은 ERP에 전달하지 않는다
        const guard = (e) => { if (panel.contains(e.target)) { if (e.target.tagName === 'BUTTON') e.preventDefault(); e.stopImmediatePropagation(); } };
        if (window.__tlGuard) ['pointerdown', 'mousedown'].forEach((t) => window.removeEventListener(t, window.__tlGuard, true));
        window.__tlGuard = guard; ['pointerdown', 'mousedown'].forEach((t) => window.addEventListener(t, guard, true));

        // 채우는 동안 다른 창으로 넘어가도 계속 진행되도록:
        // 브라우저 창이 비활성이 될 때 생기는 blur/focusout은 ERP에 전달하지 않는다(ERP가 편집 칸을 닫아버림).
        const blk = (e) => { if (window.__tlFilling && !e.__tlSynth && (e.target === window || !document.hasFocus())) e.stopImmediatePropagation(); };
        // 비활성 창에서는 focus()/blur()를 해도 브라우저가 신호를 보내지 않는다 → 직접 만들어 보낸다
        const synth = (el, type, rel) => { try { const ev = new FocusEvent(type, { bubbles: type === 'focusin' || type === 'focusout', relatedTarget: rel || null }); ev.__tlSynth = true; el.dispatchEvent(ev); } catch (e) {} };
        if (!window.__tlFocusPatch) {
            window.__tlFocusPatch = { focus: HTMLElement.prototype.focus, blur: HTMLElement.prototype.blur };
            HTMLElement.prototype.focus = function (...a) {
                const before = document.activeElement, r = window.__tlFocusPatch.focus.apply(this, a); this.__tlBlurred = 0;
                try {
                    if (window.__tlFilling && !document.hasFocus() && document.activeElement === this && before !== this) {
                        if (before && before !== document.body && before.dispatchEvent) { synth(before, 'blur', this); synth(before, 'focusout', this); }
                        synth(this, 'focus', before); synth(this, 'focusin', before);
                    }
                } catch (e) {}
                return r;
            };
            HTMLElement.prototype.blur = function (...a) {
                const was = document.activeElement === this, r = window.__tlFocusPatch.blur.apply(this, a);
                try { if (window.__tlFilling && !document.hasFocus() && was && !this.__tlBlurred) { this.__tlBlurred = 1; synth(this, 'blur'); synth(this, 'focusout'); } } catch (e) {}
                return r;
            };
        }
        // ERP는 칸이 화면에서 지워질 때 오는 blur 신호로 값을 확정한다 → 지워지기 직전에 대신 보낸다
        const rmHook = (node) => { try { if (!window.__tlFilling || document.hasFocus()) return; const a = document.activeElement; if (a && a !== document.body && node && node.contains && node.contains(a) && !a.__tlBlurred) { a.__tlBlurred = 1; synth(a, 'blur'); synth(a, 'focusout'); } } catch (e) {} };
        if (!window.__tlRmHook) {
            window.__tlRmHook = 1;
            const rc = Node.prototype.removeChild, rp = Node.prototype.replaceChild, er = Element.prototype.remove;
            Node.prototype.removeChild = function (c) { rmHook(c); return rc.call(this, c); };
            Node.prototype.replaceChild = function (n, o) { rmHook(o); return rp.call(this, n, o); };
            Element.prototype.remove = function () { rmHook(this); return er.call(this); };
        }
        if (window.__tlBlk) ['blur', 'focusout'].forEach((t) => window.removeEventListener(t, window.__tlBlk, true));
        window.__tlBlk = blk; ['blur', 'focusout'].forEach((t) => window.addEventListener(t, blk, true));

        const gotF = new WeakSet();
        if (window.__tlGotF) { document.removeEventListener('focusin', window.__tlGotF[0], true); document.removeEventListener('focusout', window.__tlGotF[1], true); }
        window.__tlGotF = [(e) => gotF.add(e.target), (e) => gotF.delete(e.target)];
        document.addEventListener('focusin', window.__tlGotF[0], true); document.addEventListener('focusout', window.__tlGotF[1], true);
        const nudge = (el) => { if (el && !document.hasFocus() && !gotF.has(el)) { synth(el, 'focus'); synth(el, 'focusin'); } };

        panel.querySelector('[data-tl="x"]').onclick = () => { if (window.__tlRun === RUN) window.__tlRun++; panel.remove(); };
        const goBtn = panel.querySelector('[data-tl="go"]');

        let pack = null, lastSig = null, busy = false, confirmKind = null;
        const sig = (p) => p ? JSON.stringify([p.date, p.rows]) : '';
        const setGo = (t) => { goBtn.textContent = t; };
        // 이 패널을 띄운 코드. TimeLog를 새 버전으로 바꾼 뒤 복사하면 코드가 달라진다 → 옛 코드로 채우지 않게 안내
        const MYCODE = (() => { try { return JSON.parse(String(window.__TL_ERP_DATA || '').slice(6)).code || null; } catch (e) { return null; } })();
        let stale = false;
        const staleMsg = () => { goBtn.disabled = true; goBtn.style.opacity = .5; msg('<b style="color:#c00">TimeLog가 새 버전으로 바뀌었어요.</b><br>이 안내창을 <b>닫고</b> 즐겨찾기 「TimeLog→ERP」를 <b>다시</b> 눌러 주세요.'); };
        // 클립보드 읽기는 권한이 막히면 아무 답도 없이 멈춰 있을 수 있다 → 3초 안에 답이 없으면 포기한다
        const readClip = (ms) => {
            if (!(navigator.clipboard && navigator.clipboard.readText)) return Promise.resolve(null);
            return Promise.race([
                navigator.clipboard.readText().catch(() => null),
                new Promise((r) => setTimeout(() => r(null), ms || 3000))
            ]);
        };
        const load = (raw) => { if (!String(raw || '').startsWith('TLERP:')) return false; try { pack = JSON.parse(String(raw).slice(6)); return !!(pack && pack.rows && pack.rows.length); } catch (e) { return false; } };
        const ready = (fresh) => {
            confirmKind = null; setGo('채우기 시작');
            msg((fresh ? '<span style="color:#2e7d32;font-weight:700">새로 복사한 날짜를 불러왔어요.</span><br>' : '')
                + '<b>' + esc(pack.date) + ' · ' + pack.rows.length + '줄</b>을 채울게요.<br>「채우기 시작」을 누르면 ERP 표의 <b>비어 있는 첫 줄</b>부터 채우고, 줄이 모자라면 늘려요.<br>'
                + '<span style="color:#888">저장은 하지 않아요. 다 채운 뒤 확인하고 「저장(F8)」을 눌러 주세요.</span>'
                + (findDlg() ? '' : '<br><b style="color:#c00">ERP 「시간 로그입력」 창이 아직 열려 있지 않아요. 먼저 열어 주세요.</b>'));
            goBtn.disabled = false; goBtn.style.opacity = 1;
        };
        const askPaste = () => {
            msg('클립보드에서 TimeLog 내용을 찾지 못했어요.<br>TimeLog 시간로그 탭 → ERP 자동입력 → <b>「이 날짜 복사」</b>를 누른 뒤, 아래 칸에 붙여 넣어 주세요(Ctrl+V).<textarea data-tl="paste" style="width:100%;height:60px;margin-top:6px;font-size:12px"></textarea>');
            goBtn.disabled = true; goBtn.style.opacity = .5;
            const ta = panel.querySelector('[data-tl="paste"]');
            ta.addEventListener('input', () => { if (load(ta.value)) ready(); });
            setTimeout(() => ta.focus(), 50);
        };
        if (window.__TL_ERP_DATA && load(window.__TL_ERP_DATA)) ready();
        else readClip().then((t) => (load(t) ? ready() : askPaste()));

        // TimeLog에서 다른 날짜를 복사하고 돌아오면 자동으로 새 내용을 불러온다
        const reread = async (ms) => {
            if (busy || !(navigator.clipboard && navigator.clipboard.readText)) return false;
            try {
                const t = await readClip(ms);
                if (!String(t || '').startsWith('TLERP:')) return false;
                try { const c = JSON.parse(String(t).slice(6)).code; if (MYCODE && c && c !== MYCODE) { stale = true; staleMsg(); return false; } } catch (e) {}
                const before = sig(pack);
                if (!load(t)) return false;
                if (sig(pack) !== before) { ready(true); return true; }
            } catch (e) {}
            return false;
        };
        if (window.__tlReread) { window.removeEventListener('focus', window.__tlReread); document.removeEventListener('visibilitychange', window.__tlReread); }
        window.__tlReread = () => { if (document.visibilityState === 'visible' && document.body.contains(panel)) setTimeout(reread, 150); };
        window.addEventListener('focus', window.__tlReread); document.addEventListener('visibilitychange', window.__tlReread);

        // ---------- 검색 창에서 고르기 ----------
        // 글자가 똑같은 항목만 고른다. 애매하면 짐작하지 않고 멈춰서 사람에게 맡긴다.
        const norm = (x) => String(x || '').replace(/\s+/g, '').toLowerCase();
        const pickLoose = (L, v) => { const m = L.filter((a) => norm(a.textContent) === norm(v)); return m.length === 1 ? m[0] : null; };
        // 번호로 검색하면 제목에 그 번호가 들어간 글도 같이 나온다 → 값이 번호와 정확히 같은 줄만 고른다
        const pickRow = (pop, v) => {
            const rows = [...pop.querySelectorAll('tbody tr')].filter((tr) => tr.offsetWidth > 0), cells = (tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim());
            const m = rows.filter((tr) => cells(tr).includes(v)); const pick = (tr) => tr.querySelector('a') || tr.querySelector('td');
            if (m.length === 1) return pick(m[0]); if (m.length < 2) return null;
            const grid = rows.map(cells), cols = Math.max(...grid.map((r) => r.length));
            for (let c = 0; c < cols; c++) {
                const col = grid.map((r) => r[c] || '');
                if (!col.every((x) => /^\d+$/.test(x)) || new Set(col).size !== col.length) continue;
                const hit = rows.filter((tr, i) => grid[i][c] === v);
                if (hit.length === 1) return pick(hit[0]);
            }
            return null;
        };
        // 글 번호 칸의 내부 키는 board_s$data_no. 「…$board_s$data_no」는 연결된 작업번호라 제외
        const ownNo = (td) => /(?:^|[^$])board_s\$data_no_cell/.test(td.getAttribute('data-columnid') || '');
        const hasNoCol = (pop) => [...pop.querySelectorAll('td[data-columnid]')].some(ownNo);
        const pickByNo = (pop, v) => { const m = [...pop.querySelectorAll('tbody tr')].filter((tr) => tr.offsetWidth > 0 && [...tr.querySelectorAll('td')].some((td) => ownNo(td) && td.textContent.trim() === v)); return m.length === 1 ? (m[0].querySelector('a') || m[0].querySelector('td')) : null; };
        const pickExact = (pop, v) => {
            if (/^\d+$/.test(v) && hasNoCol(pop)) return pickByNo(pop, v);
            const L = [...pop.querySelectorAll('tbody a')].filter((a) => a.offsetWidth > 0 && a.textContent.trim());
            const ex = L.filter((a) => a.textContent.trim() === v);
            if (ex.length) { const rows = new Set(ex.map((a) => a.closest('tr'))); return rows.size === 1 ? ex[0] : null; }
            return pickRow(pop, v) || pickLoose(L, v);
        };
        // 기본 기간(최근 1년)에 없으면 Search(F3)로 게시일을 6개월씩 과거로 옮기며 최대 4번 더 찾는다
        const deepSearch = async (pop, v) => {
            const btnS = pop.querySelector('[data-item-key="search_header_data_model"]');
            const formF = () => pop.querySelector('[data-item-key="data_dt_boardXlist_search"]');
            if (!btnS) return null;
            for (let k = 0; k < 4; k++) {
                if (!pop.isConnected || pop.offsetWidth === 0) return null;
                if (!formF() || formF().offsetWidth === 0) { btnS.click(); await waitFor(() => formF() && formF().offsetWidth > 0, 3000); }
                const f = formF(), dn = pop.querySelector('input[data-item-key="data_no_boardXlist_search"]'), go = pop.querySelector('[data-item-key="header_search_boardXlist_search"]');
                if (!f || !dn || !go) return null;
                const pk = [...f.querySelectorAll('.wrapper-datepicker > .wrapper-datepicker')]; if (pk.length < 2) return null;
                const now = new Date(), end = new Date(now.getFullYear(), now.getMonth() - 6 * k, 1), st = new Date(now.getFullYear(), now.getMonth() - 6 * (k + 1), 1);
                const ym = (d) => [String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, '0')];
                const sel = async (btn, want) => {
                    if (!btn) return false;
                    if ((btn.textContent || '').trim() === want) return true;
                    btn.click(); let c = [];
                    for (let t = 0; t < 15 && !c.length; t++) { await S(150); c = [...document.querySelectorAll('li, a, span, div, label')].filter((e) => e.offsetWidth > 0 && !btn.contains(e) && !f.contains(e) && (e.textContent || '').trim() === want); }
                    if (!c.length) { document.body.click(); await S(200); return false; }
                    c[c.length - 1].click(); await S(300); return (btn.textContent || '').trim() === want;
                };
                const [ey, em] = ym(end), [sy, sm] = ym(st);
                // 끝 → 시작 순서로 바꿔야 잠깐이라도 기간이 1년을 넘지 않는다
                const ok = (await sel(pk[1].querySelector('button[data-id="year"]'), ey)) && (await sel(pk[1].querySelector('button[data-id="month"]'), em))
                    && (await sel(pk[0].querySelector('button[data-id="year"]'), sy)) && (await sel(pk[0].querySelector('button[data-id="month"]'), sm));
                if (!ok) return null;
                dn.focus(); iset.call(dn, v); dn.dispatchEvent(new Event('input', { bubbles: true })); dn.dispatchEvent(new Event('change', { bubbles: true })); dn.blur(); await S(200);
                const rg = () => { const t = pop.querySelector('.grid-top-html'), m = t && t.textContent.match(/(\d{4})\/(\d{2})\/\d{2}\s*~\s*(\d{4})\/(\d{2})\/\d{2}/); return m && m[1] === sy && m[2] === sm && m[3] === ey && m[4] === em ? 1 : null; };
                go.click(); await waitFor(rg, 8000); await S(800);
                const hit = pickByNo(pop, v); if (hit) return hit;
            }
            return null;
        };
        const pickInPopup = async (pop, val) => {
            const v = String(val).trim();
            let hit = await waitFor(() => pickExact(pop, v), 4000);
            if (!hit && /^\d+$/.test(v) && hasNoCol(pop)) hit = await deepSearch(pop, v);
            if (!hit) return false;
            hit.click(); await waitFor(() => !pop.isConnected || pop.offsetWidth === 0, 3000); await S(300); return true;
        };
        const ours = new WeakSet(), oursOpen = () => popups().some((x) => ours.has(x)); // 내가 띄운 검색 창만 (ERP 알림 창은 건드리지 않음)
        const clickClose = (pp) => {
            const b = pp.querySelector('.ui-dialog-titlebar-close, [data-cid="close"], button[title="닫기"], a[title="닫기"]') || [...pp.querySelectorAll('button,a')].find((x) => /^(닫기|Close|취소)$/.test((x.textContent || '').trim()));
            if (b) b.click(); else press(pp.querySelector('input') || pp, 'Escape');
        };
        const closePop = async (pp) => { clickClose(pp); await waitFor(() => !pp.isConnected || pp.offsetWidth === 0, 2500); await S(200); };
        const closeOurs = async () => { popups().filter((x) => ours.has(x)).forEach(clickClose); await waitFor(() => !oursOpen(), 2500); };
        const qOf = (pp) => { const q = pp.querySelector('input[data-item-key="quick_search_header_data_model"]'); return q ? String(q.value || '').trim() : null; };
        const isSearchPop = (pp) => !!(pp.querySelector('input[data-item-key="quick_search_header_data_model"]') || pp.querySelector('table tbody'));
        const sameQ = (a, b) => { a = norm(a); b = norm(b); return !a || !b || a === b || a.includes(b) || b.includes(a); };

        let curRi = -1; // 지금 채우는 줄 (다른 줄의 같은 칸에 입력하지 않도록)
        const here = (k) => { const a = activeIs(k); return a && (curRi < 0 || rowIndexOf(a) === curRi) ? a : null; };

        // 그 줄의 칸을 눌러 편집 상태로 만들고 커서를 넣는다
        const focusCell = async (ri, k) => {
            const inCell = () => { const a = document.activeElement; return a && a.closest && a.closest('[data-item-key="' + k + '"]') && rowIndexOf(a) === ri ? a : null; };
            for (let t = 0; t < 2 && !inCell(); t++) {
                const tr = dataRows()[ri]; if (!tr) return null;
                const el = tr.querySelector('[data-item-key="' + k + '"]'); if (!el) return null;
                const td = el.closest('td') || el;
                for (const x of [el, td]) for (const ev of ['mousedown', 'mouseup', 'click']) x.dispatchEvent(new MouseEvent(ev, { bubbles: true, cancelable: true, view: window }));
                await S(400);
                if (inCell()) nudge(document.activeElement);
                if (!inCell()) { const tr2 = dataRows()[ri], f = tr2 && tr2.querySelector('[data-item-key="' + k + '"] input, input[data-item-key="' + k + '"], textarea[data-item-key="' + k + '"], [data-item-key="' + k + '"] textarea'); f && f.focus && (f.focus(), nudge(f)); await S(250); }
            }
            return inCell();
        };

        // 한 칸 채우기: 값을 넣고 Enter → 검색 창이 뜨면 고르고, 아니면 다음 칸으로 넘어간 것을 확인
        const step = async (k, val, nextK) => {
            const el = await waitFor(() => here(k), 6000); if (!el) return 'lost';
            nudge(el); await S(150);
            const v = String(val == null ? '' : val).trim();
            if (!v) { press(el, 'Tab'); await waitFor(() => !activeIs(k), 3000); return 'skip'; }
            (el.tagName === 'TEXTAREA' ? tset : iset).call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); await S(250);
            const before = popups(), skipP = new Set(), fresh = () => popups().filter((x) => !before.includes(x) && !skipP.has(x));
            press(el, 'Enter');
            const inNext = () => nextK === '__date' ? (() => { const a = document.activeElement; return a && a.closest && a.closest('[data-item-key="' + K.dt + '"]'); })() : here(nextK);
            const seen = () => (fresh().length ? 'pop' : inNext() ? 'next' : null);
            let r = await waitFor(seen, 6000);
            if (!r) {
                const e2 = here(k); if (!e2) return 'lost';
                nudge(e2); await S(1500);
                if (e2.value !== v) { (e2.tagName === 'TEXTAREA' ? tset : iset).call(e2, v); e2.dispatchEvent(new Event('input', { bubbles: true })); await S(250); }
                press(e2, 'Enter'); r = await waitFor(seen, 8000); if (!r) return 'lost';
            }
            // 새로 뜬 창이 검색 창이 아니면(알림·공지 등) 건드리지 않고 계속 기다린다
            let pp = null;
            for (let g = 0; r === 'pop' && g < 5; g++) {
                pp = fresh().slice(-1)[0];
                await waitFor(() => (isSearchPop(pp) && qOf(pp) !== '') || !pp.isConnected || pp.offsetWidth === 0 ? 1 : null, 3000);
                if (pp.isConnected && pp.offsetWidth > 0 && isSearchPop(pp)) break;
                skipP.add(pp); pp = null; r = await waitFor(seen, 6000); if (!r) return 'lost';
            }
            if (r === 'pop' && pp) {
                const q = qOf(pp);
                if (q && !sameQ(q, v)) {
                    // 이 칸 값은 이미 받아들여졌고, 다음 칸이 저절로 검색 창을 띄운 것 → 닫고 다음 칸을 이어서 채운다
                    await closePop(pp);
                    const nk = nextK === '__date' ? K.dt : nextK;
                    if (nk && curRi >= 0 && !inNext()) await focusCell(curRi, nk);
                    return 'ok';
                }
                ours.add(pp);
                if (!(await pickInPopup(pp, v))) return 'popup';
            } else if (r === 'pop') return 'lost';
            return 'ok';
        };

        // 연·월 버튼을 눌러 목록에서 want를 고른다. scope를 주면 그 안의 글자는 후보에서 빼고, 바뀌었는지 한 번 더 확인한다(위쪽 「일자」용)
        const isWant = (t, want) => t === want || t === want.padStart(2, '0');
        const pickDropdown = async (b, want, scope) => {
            if (!b) return false;
            if (isWant((b.textContent || '').trim(), want)) return true;
            b.click(); await S(400);
            const c = [...document.querySelectorAll('li, a, span, div')].filter((e) => e.offsetWidth > 0 && e.children.length === 0 && !b.contains(e) && !(scope && scope.contains(e)) && isWant((e.textContent || '').trim(), want));
            if (!c.length) { press(b, 'Escape'); return false; }
            c[c.length - 1].click(); await S(300);
            return !scope || isWant((b.textContent || '').trim(), want);
        };

        const fillDate = async (ymd) => {
            const w = await waitFor(() => { const a = document.activeElement; return a && a.closest && a.closest('[data-item-key="' + K.dt + '"]'); }, 6000);
            if (!w) return 'lost';
            const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
            let ok = true;
            if (m) {
                ok = (await pickDropdown(w.querySelector('button[data-id="year"]'), m[1])) && ok;
                ok = (await pickDropdown(w.querySelector('button[data-id="month"]'), String(+m[2]))) && ok;
            }
            const dy = w.querySelector('input[data-id="day"]'); if (!dy) return 'lost';
            dy.focus(); nudge(dy); await S(100);
            if (m) { iset.call(dy, m[3]); dy.dispatchEvent(new Event('input', { bubbles: true })); await S(250); }
            press(dy, 'Enter');
            if (!(await waitFor(() => activeIs(K.note), 4000))) return 'lost';
            return ok ? 'ok' : 'date';
        };

        const note = async (val, last) => {
            const el = await waitFor(() => activeIs(K.note), 4000); if (!el) return 'lost';
            nudge(el);
            const v = String(val == null ? '' : val);
            if (v) { tset.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); await S(250); }
            if (!last) { press(el, 'Tab'); if (!(await waitFor(() => activeIs(K.job), 4000))) return 'lost'; } else el.blur();
            return 'ok';
        };

        const digits = (x) => String(x == null ? '' : x).replace(/[^\d]/g, '');
        // 한 줄을 다 채운 뒤 실제로 들어갔는지 확인 → 빠진 첫 칸 번호(0 작업 … 6 비고), 다 맞으면 -1
        const badField = (tr, r, skip) => {
            if (!tr) return -1;
            const chosen = (k, raw) => { const g = cellText(tr, k); return g && g !== String(raw).trim() ? g : ''; }; // 검색어(번호)만 남아 있으면 아직 안 고른 것
            const dOk = () => { const d = digits(cellText(tr, K.dt)), w = digits(r.end); return d.endsWith(w) || (d.length <= 2 && d === w.slice(-2)) ? 'ok' : ''; };
            const C = [
                [0, r.job, () => chosen(K.job, r.job)],
                [1, r.bizz, () => cellText(tr, K.bizz)],
                [2, r.trx, () => chosen(K.trx, r.trx)],
                [3, r.cat, () => chosen(K.cat, r.cat)],
                [4, r.min, () => digits(cellText(tr, K.min)) === digits(r.min) ? 'ok' : ''],
                [5, /^\d{4}-\d{2}-\d{2}$/.test(String(r.end || '')) ? r.end : '', dOk],
                [6, String(r.note || '').trim(), () => cellText(tr, K.note)]
            ];
            for (const [i, want, got] of C) {
                if (skip && skip.has(i)) continue;
                if (want == null || String(want).trim() === '') continue;
                let g = ''; try { g = got(); } catch (e) {}
                if (!String(g || '').trim()) return i;
            }
            return -1;
        };

        // 사람이 직접 처리할 때까지 기다린다: 검색 창이 닫히고 커서가 다음 칸에 오면 이어서 진행
        const waitUser = async (html, nk, opt) => {
            let stop = false, ans = null;
            const B = 'padding:5px 10px;border:1px solid #ccc;border-radius:6px;background:#fff;cursor:pointer;font:inherit';
            msg(html
                + (opt ? '<div style="margin-top:8px;padding:8px;background:#f1f5f9;border-radius:6px">값을 고쳐 다시 시도할 수 있어요<div style="display:flex;gap:6px;margin-top:6px"><input data-tl="rv" style="flex:1;min-width:0;padding:5px 8px;border:1px solid #ccc;border-radius:6px;font:inherit"><button data-tl="retry" style="' + B + ';background:#0f172a;color:#fff;border-color:#0f172a">다시 시도</button></div></div>' : '')
                + '<div style="margin-top:8px;display:flex;gap:6px">' + (opt ? '<button data-tl="skip" style="' + B + '">이 칸 건너뛰기</button>' : '') + '<button data-tl="stop" style="' + B + '">그만하기</button></div>');
            const sb = panel.querySelector('[data-tl="stop"]'); if (sb) sb.onclick = () => { stop = true; };
            if (opt) {
                const rv = panel.querySelector('[data-tl="rv"]');
                rv.value = String(opt.val == null ? '' : opt.val);
                const go = () => { ans = { retry: rv.value.trim() }; };
                panel.querySelector('[data-tl="retry"]').onclick = go;
                rv.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); go(); } };
                panel.querySelector('[data-tl="skip"]').onclick = () => { ans = { skip: true }; };
            }
            const atNext = () => { const a = document.activeElement; if (!a) return false; return nk === '__date' ? !!(a.closest && a.closest('[data-item-key="' + K.dt + '"]')) : keyOf(a) === nk; };
            for (let t = 0; t < 600000 && !stop; t += 300) {
                if (ans) return ans;
                if (!oursOpen() && atNext()) { await S(400); if (!oursOpen() && atNext()) return true; }
                await S(300);
            }
            return false;
        };

        const run = async () => {
            if (busy) return;
            if (!confirmKind) await reread(1000);
            if (stale) { staleMsg(); return; }
            if (!pack) return;
            if (!findDlg()) { msg('<b style="color:#c00">ERP 「시간 로그입력」 창을 먼저 열어 주세요.</b>'); return; }
            const filledNow = dataRows().filter((tr) => cellText(tr, K.job) || cellText(tr, K.trx) || cellText(tr, K.min)).length;
            if (lastSig && sig(pack) === lastSig && confirmKind !== 'same') {
                confirmKind = 'same'; setGo('그래도 다시 채우기');
                msg('<b style="color:#c00">이 날짜(' + esc(pack.date) + ')는 방금 채운 날짜예요.</b><br>다음 날짜를 넣으려면 TimeLog에서 그 날짜로 바꿔 <b>「이 날짜 복사」</b>를 누른 뒤 이 화면으로 돌아오세요. 자동으로 불러와요.<br><span style="color:#888">같은 내용을 한 번 더 넣으려면 아래 버튼을 누르세요.</span>');
                return;
            }
            if (lastSig && sig(pack) !== lastSig && filledNow > 0 && confirmKind !== 'left') {
                confirmKind = 'left'; setGo('이어서 채우기');
                msg('<b style="color:#c00">ERP 표에 아직 ' + filledNow + '줄이 남아 있어요.</b><br>앞 날짜를 「저장(F8)」했는지 확인해 주세요.<br><span style="color:#888">남은 줄 아래에 이어서 넣으려면 아래 버튼을 누르세요.</span>');
                return;
            }
            confirmKind = null; setGo('채우기 시작'); busy = true; curRi = -1; window.__tlFilling = RUN;
            goBtn.disabled = true; goBtn.style.opacity = .5;
            const reset = () => { busy = false; window.__tlFilling = 0; goBtn.disabled = false; goBtn.style.opacity = 1; };
            msg('준비하는 중…');

            // 1) 시작 줄 = 비어 있는 첫 줄. 앞에서 멈춘 채우기가 남긴 덜 찬 줄이 있으면 그 줄부터 다시 채운다
            const isEmptyRow = (tr) => !cellText(tr, K.job) && !cellText(tr, K.trx) && !cellText(tr, K.min);
            const isPartial = (tr) => !cellText(tr, K.min) && !cellText(tr, K.trx);
            let startIdx = dataRows().findIndex(isEmptyRow); if (startIdx < 0) startIdx = dataRows().length;
            while (startIdx > 0 && isPartial(dataRows()[startIdx - 1])) startIdx--;
            const need = startIdx + pack.rows.length;

            // 2) 줄이 모자라면 마지막 줄의 ⊕를 눌러 늘린다
            for (let g = 0; dataRows().length < need && g < 40; g++) {
                const rs = dataRows(), n0 = rs.length, plus = n0 && rs[n0 - 1].querySelector('[data-columnid^="layout_grid_row_move_cell"] a');
                if (!plus) break;
                plus.click(); await waitFor(() => dataRows().length > n0, 3000); await S(300);
            }
            if (dataRows().length < need) { reset(); msg('<b style="color:#c00">ERP 표의 줄을 늘리지 못했어요.</b><br>표의 ⊕로 <b>' + (need - dataRows().length) + '줄</b> 이상 늘린 뒤 「채우기 시작」을 다시 눌러 주세요.'); return; }

            // 3) ERP 위쪽 「일자」를 TimeLog 날짜로 맞춘다
            let dateNote = '';
            const hm = String(pack.date || '').match(/^(\d{4})-(\d{2})-(\d{2})$/), hw = findDlg().querySelector('[data-item-key="dt_001_boardXmaster"]');
            if (hm && hw) {
                let ok = (await pickDropdown(hw.querySelector('button[data-id="year"]'), hm[1], hw)) && (await pickDropdown(hw.querySelector('button[data-id="month"]'), String(+hm[2]), hw));
                const dy = hw.querySelector('input[data-id="day"]');
                if (ok && dy) {
                    if (dy.value !== hm[3]) { dy.focus(); await S(100); iset.call(dy, hm[3]); dy.dispatchEvent(new Event('input', { bubbles: true })); await S(200); press(dy, 'Enter'); await S(500); }
                    ok = dy.value === hm[3];
                } else ok = false;
                if (!ok) dateNote = '<b style="color:#c00">ERP 위쪽 「일자」를 TimeLog 날짜(' + esc(pack.date) + ')에 맞추지 못했어요. 직접 맞춰 주세요.</b>';
            }

            // 4) 시작 줄의 「작업」 칸으로 이동
            const atStart = () => !!activeIs(K.job) && rowIndexOf(document.activeElement) === startIdx;
            for (let t = 0; t < 3 && !atStart(); t++) { await focusCell(startIdx, K.job); if (!atStart()) await S(500); }
            if (!atStart()) {
                const u = findDlg().querySelector('input[data-item-key="num_001_boardXmaster"]');
                if (u) { u.focus(); await S(200); press(u, 'Enter'); await waitFor(() => activeIs(K.job), 3000); }
                for (let i = 0; i < 9 * startIdx + 20 && !atStart(); i++) { const ri = rowIndexOf(document.activeElement); if (ri < 0 || ri > startIdx) break; press(document.activeElement, 'Tab'); await S(250); }
            }
            if (!atStart()) { reset(); msg('<b style="color:#c00">' + (startIdx + 1) + '번 줄의 「작업」 칸으로 가지 못했어요.</b><br>그 칸을 클릭한 뒤 「채우기 시작」을 다시 눌러 주세요.'); return; }

            const notes = []; let done = 0;
            const rows = pack.rows.map((x) => Object.assign({}, x)); // 다시 시도에서 값을 고칠 수 있게 복사본으로
            // TimeLog에 값이 없어 비워 두고 넘어가는 칸은 끝난 뒤 함께 알려 준다
            rows.forEach((r, n) => {
                const empty = [!r.job && '「작업」', !r.trx && '「거래」', !r.end && '「종료 예정일」'].filter(Boolean);
                if (empty.length) notes.push((startIdx + n + 1) + '번 줄(' + esc(r.title || '') + '): TimeLog에 값이 없어 ' + josa(empty.join('·'), '은', '는') + ' 넣지 않았어요. 확인해 주세요.');
            });

            for (let n = 0; n < rows.length; n++) {
                const r = rows[n], label = (startIdx + n + 1) + '번 줄(' + esc(r.title || r.job || '') + ')';
                msg('채우는 중… ' + (n + 1) + ' / ' + rows.length + '<br><span style="color:#888">끝날 때까지 ERP 화면을 누르지 말아 주세요.</span>');
                const last = n === rows.length - 1;
                const seq = [
                    ['작업', () => step(K.job, r.job, K.bizz), K.bizz, '업무'],
                    ['업무', () => step(K.bizz, r.bizz, K.trx), K.trx, '거래'],
                    ['거래', () => step(K.trx, r.trx, K.cat), K.cat, '카테고리'],
                    ['카테고리', () => step(K.cat, r.cat, K.min), K.min, '시간(분)'],
                    ['시간(분)', () => step(K.min, r.min, '__date'), '__date', '종료 예정일'],
                    ['종료 예정일', () => fillDate(r.end), K.note, '비고'],
                    ['비고', () => note(r.note, last), last ? null : K.job, '다음 줄의 작업']
                ];
                const KEYS = [K.job, K.bizz, K.trx, K.cat, K.min, K.dt, K.note], ri = startIdx + n, skipped = new Set();
                curRi = ri;

                const attempt = async (fn) => { try { return await fn(); } catch (e) { if (e && e.message === ABORT) throw e; return 'lost'; } };
                const runSeq = async (from) => {
                    for (let si = from; si < seq.length; si++) {
                        const [name, fn, nk, nn] = seq[si];
                        let res = await attempt(fn);
                        // 알림 창 등으로 커서가 빠져나가면 그 칸을 다시 눌러 한 번 더 (사람에게 묻기 전에)
                        if (res === 'lost' && !oursOpen()) {
                            msg('커서가 다른 곳으로 가서 ' + label + '의 「' + name + '」 칸으로 돌아가는 중…');
                            let got = await focusCell(ri, KEYS[si]);
                            if (!got && !document.hasFocus()) {
                                msg('<b>ERP 칸을 다시 열지 못했어요.</b><br>ERP 창을 한 번 누르면 ' + label + '의 「' + name + '」부터 이어서 채워요.<br><span style="color:#888">(' + done + '줄 채움)</span>');
                                await waitFor(() => document.hasFocus(), 600000); await S(500); got = await focusCell(ri, KEYS[si]);
                            }
                            if (got) res = await attempt(fn);
                        }
                        if (res === 'date') notes.push(label + ': 종료 예정일 날짜를 확인해 주세요.');
                        if (res !== 'popup' && res !== 'lost') continue;
                        if (!nk) { notes.push(label + ': 「' + name + '」 칸을 확인해 주세요.'); break; }
                        const FIELD = ['job', 'bizz', 'trx', 'cat', 'min', 'end', 'note'][si], fv = esc(r[FIELD]);
                        const why = res === 'popup'
                            ? '<b style="color:#c00">' + label + '의 「' + name + '」 값(<u>' + fv + '</u>)을 ERP에서 찾지 못했어요.</b><br>값이 맞는지 확인해 주세요. 아래에서 고쳐 「다시 시도」하거나, 열린 검색 창에서 <b>직접 고르면</b> 「' + nn + '」부터 이어서 채워요.'
                            : '<b style="color:#c00">' + label + '의 「' + name + '」에서 멈췄어요.</b><br>그 칸을 <b>직접 채운 뒤 「' + nn + '」 칸을 클릭</b>하면 거기서부터 이어서 채워요.';
                        const ok = await waitUser(why + '<br><span style="color:#888">(' + done + '줄 채움 · 이어서 채우는 동안 ERP 화면을 누르지 말아 주세요)</span>', nk, { val: r[FIELD] });
                        if (ok && ok.retry != null) {
                            r[FIELD] = ok.retry; await closeOurs();
                            msg('다시 시도하는 중… ' + label + '의 「' + name + '」');
                            if (await focusCell(ri, KEYS[si])) { si--; continue; }
                            msg('<b style="color:#c00">' + label + '의 「' + name + '」 칸으로 가지 못했어요.</b><br>그 칸을 클릭한 뒤 다시 시도해 주세요.'); si--; await S(300); continue;
                        }
                        let ok2 = ok;
                        if (ok && ok.skip) {
                            await closeOurs(); skipped.add(si);
                            const nri = si === 6 ? ri + 1 : ri, nkk = nk === '__date' ? K.dt : nk;
                            notes.push(label + ': ' + josa('「' + name + '」', '은', '는') + ' 건너뛰었어요. 직접 채워 주세요.');
                            if (!nkk || (await focusCell(nri, nkk))) continue;
                            ok2 = await waitUser('「' + nn + '」 칸을 <b>클릭</b>해 주세요. 거기서부터 이어서 채워요.', nk);
                        }
                        if (!ok2) { reset(); msg('<b>' + done + '줄</b>을 채우고 멈췄어요.' + (notes.length ? '<br>- ' + notes.join('<br>- ') : '') + '<br>나머지는 직접 채우거나, 이어서 할 줄의 「작업」 칸을 클릭한 뒤 「채우기 시작」을 다시 눌러 주세요.'); return false; }
                        msg('이어서 채우는 중… ' + (n + 1) + ' / ' + rows.length);
                    }
                    return true;
                };
                if (!(await runSeq(0))) return;

                // 확인: ERP가 화면을 다시 그리면 넣은 값이 사라질 수 있다 → 빠진 칸부터 다시 채운다
                for (let fix = 0; fix < 2; fix++) {
                    await S(500);
                    const bi = badField(dataRows()[ri], r, skipped); if (bi < 0) break;
                    const bname = seq[bi][0];
                    msg(label + '의 ' + josa('「' + bname + '」', '이', '가') + ' 비어 있어 다시 넣는 중…');
                    let got = await focusCell(ri, KEYS[bi]);
                    if (!got) {
                        const ok = await waitUser('<b style="color:#c00">' + label + '의 ' + josa('「' + bname + '」', '이', '가') + ' 비어 있어요.</b><br>그 칸을 <b>클릭</b>하면 거기서부터 다시 채워요.<br><span style="color:#888">(' + done + '줄 채움)</span>', KEYS[bi]);
                        if (!ok) { reset(); msg('<b>' + done + '줄</b>을 채우고 멈췄어요. ' + label + '의 「' + bname + '」부터 직접 확인해 주세요.'); return; }
                    }
                    if (!(await runSeq(bi))) return;
                    const still = fix === 1 ? badField(dataRows()[ri], r, skipped) : -1;
                    if (still >= 0) notes.push(label + ': ' + josa('「' + seq[still][0] + '」', '이', '가') + ' 비어 있어요. 확인해 주세요.');
                }
                done++;
            }
            if (popups().some((x) => !ours.has(x))) notes.push('ERP에 다른 알림 창이 떠 있어요. 내용을 확인하고 닫아 주세요.');
            if (dateNote) notes.push(dateNote); else if (pack.date) notes.push('ERP 위쪽 「일자」도 TimeLog 날짜(' + esc(pack.date) + ')에 맞췄어요.');
            lastSig = sig(pack); reset();
            msg('<b>' + done + '줄</b>을 다 채웠어요.' + (notes.length ? '<br>- ' + notes.join('<br>- ') : '') + '<br><br>내용을 확인하고 <b>「저장(F8)」</b>을 눌러 주세요.<div style="margin-top:8px;padding:8px 10px;background:#f1f5f9;border-radius:6px"><b>다음 날짜도 넣으려면</b><br>① 「저장(F8)」 → ② TimeLog에서 다음 날짜로 바꿔 「이 날짜 복사」 → ③ 이 화면으로 돌아오면 자동으로 불러와요. 「채우기 시작」만 누르면 돼요.<br><span style="color:#888">이 안내창은 닫지 않아도 돼요.</span></div>');
        };

        goBtn.onclick = async () => {
            if (busy) return;
            try { await run(); }
            catch (e) { if (e && e.message === ABORT) return; msg('<b style="color:#c00">문제가 생겨 멈췄어요.</b> <span style="color:#888">(' + esc(String(e && e.message || e)) + ')</span><br>이어서 할 줄의 「작업」 칸을 클릭한 뒤 「채우기 시작」을 다시 눌러 주세요.'); }
            finally { busy = false; if (window.__tlFilling === RUN) window.__tlFilling = 0; goBtn.disabled = false; goBtn.style.opacity = 1; }
        };
    }

    // 즐겨찾기 버튼(북마클릿) 본체. 클립보드의 내용이 이 브라우저의 TimeLog가 만든 것인지 서명으로 확인한 뒤에만 실행한다.
    function TIMELOG_ERP_LOADER(K) {
        (async () => {
            const old = document.getElementById('tl-erp-loader'); old && old.remove();
            const run = async (t, say) => {
                let p = null; try { p = JSON.parse(t.slice(6)); } catch (e) {}
                if (!p || !p.code || !p.sig) return say('TimeLog 시간로그 탭 → ERP 자동입력에서 「이 날짜 복사」를 다시 눌러 주세요.');
                const en = new TextEncoder(), key = await crypto.subtle.importKey('raw', en.encode(K), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
                const h = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, en.encode(p.code)))].map((b) => b.toString(16).padStart(2, '0')).join('');
                if (h !== p.sig) return say('이 즐겨찾기는 다른 PC나 브라우저의 TimeLog에서 만든 거예요. 지금 쓰는 TimeLog의 ERP 자동입력 창에서 「TimeLog→ERP」를 즐겨찾기 막대로 다시 끌어다 놓아 주세요.');
                window.__TL_ERP_DATA = t;
                const s = document.createElement('script'); s.textContent = p.code; (document.head || document.body).appendChild(s); s.remove();
                return true;
            };
            // 권한이 막히면 답이 없을 수 있으므로 3초까지만 기다린다
            const read = async () => {
                if (!(navigator.clipboard && navigator.clipboard.readText)) return null;
                const t = await Promise.race([navigator.clipboard.readText().catch(() => null), new Promise((r) => setTimeout(() => r(null), 3000))]);
                return t == null ? null : String(t);
            };
            const first = await read();
            if (first && first.startsWith('TLERP:')) return run(first, (m) => alert(m));
            // 브라우저가 바로 읽게 해 주지 않으면 작은 창에서 한 번 더
            const box = document.createElement('div'); box.id = 'tl-erp-loader';
            box.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:2147483647;width:330px;background:#fff;border:2px solid #0f172a;border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.25);padding:14px 16px;font:13px/1.55 "Malgun Gothic",sans-serif;color:#222';
            box.innerHTML = '<b style="font-size:14px">TimeLog → ERP 자동입력</b><div data-m style="margin:6px 0 10px">아래 버튼을 누르면 TimeLog에서 복사한 내용을 불러와요.</div><button data-b style="width:100%;padding:9px;border:0;border-radius:6px;background:#0f172a;color:#fff;font:inherit;font-weight:700;cursor:pointer">복사한 내용 불러오기</button><textarea data-t placeholder="안 되면 여기를 누르고 Ctrl+V" style="width:100%;height:42px;margin-top:8px;box-sizing:border-box;font:inherit;font-size:12px;border:1px solid #ccc;border-radius:6px;padding:6px;resize:none"></textarea><div style="text-align:right;margin-top:4px"><a data-x href="#" style="color:#888;font-size:12px">닫기</a></div>';
            document.body.appendChild(box);
            const M = box.querySelector('[data-m]'), say = (m) => { M.innerHTML = '<b style="color:#c00">' + m + '</b>'; };
            if (first) say('클립보드에 TimeLog 내용이 없어요. TimeLog에서 「이 날짜 복사」를 누른 뒤 아래 버튼을 눌러 주세요.');
            let busy = false;
            const use = async (t) => {
                if (busy) return;
                if (t == null) return say('브라우저가 클립보드 읽기를 막았어요. 아래 칸을 누르고 Ctrl+V 해 주세요.');
                if (!t.startsWith('TLERP:')) return say('TimeLog에서 복사한 내용이 아니에요. 「이 날짜 복사」를 누른 뒤 다시 눌러 주세요.');
                busy = true; const ok = await run(t, say); busy = false;
                if (ok === true) { box.remove(); window.removeEventListener('focus', onF); }
            };
            const onF = async () => { const t = await read(); t && t.startsWith('TLERP:') && use(t); };
            box.querySelector('[data-b]').onclick = async () => use(await read());
            box.querySelector('[data-t]').addEventListener('paste', (e) => { e.preventDefault(); use(String((e.clipboardData || window.clipboardData).getData('text') || '')); });
            box.querySelector('[data-x]').onclick = (e) => { e.preventDefault(); box.remove(); window.removeEventListener('focus', onF); };
            window.addEventListener('focus', onF);
        })();
    }

    const ERP_FILL_JS = '(' + TIMELOG_ERP_FILL.toString() + ')();';

    // 이 브라우저만의 열쇠. 다른 사람이 만든 코드가 즐겨찾기 버튼으로 실행되는 것을 막는다.
    function getErpKey() {
        try {
            let k = localStorage.getItem(ERP_KEY_STORAGE);
            if (!/^[0-9a-f]{32}$/.test(k || '')) {
                k = [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');
                localStorage.setItem(ERP_KEY_STORAGE, k);
            }
            return k;
        } catch (e) { return 'timelog-local'; }
    }

    async function signErpCode(code) {
        const en = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', en.encode(getErpKey()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
        const sig = await crypto.subtle.sign('HMAC', key, en.encode(code));
        return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function buildErpBookmarklet() {
        const js = '(' + TIMELOG_ERP_LOADER.toString() + ')(' + JSON.stringify(getErpKey()) + ');';
        return 'javascript:' + encodeURIComponent(js);
    }

    // ERP 검색은 글 번호로 한다. 「OP-2410」·「운영_3928」처럼 앞에 글자가 붙어 있으면 끝의 번호만 쓴다.
    function erpNumber(x) {
        const t = String(x || '').trim(), m = t.match(/^\D+?[_\-\s]+(\d+)$/);
        return m ? m[1] : t;
    }

    // 시간로그 표 → ERP 표의 한 줄씩 (시간이 0분인 줄은 뺀다)
    function buildErpRows(dateStr) {
        const presets = getPresets();
        return sortTimeLogRows(buildTimeLogTableRows(dateStr))
            .filter(r => Number(r.minutes) > 0)
            .map(r => ({
                title: r.opsName || r.taskName || '',
                job: erpNumber(r.taskCode),                // 작업
                bizz: ((presets.find(p => p.id === r.jobId) || {}).erpBizz || '').trim() || ERP_BIZZ, // 업무 (운영별, 없으면 '운영')
                trx: erpNumber(r.opsCode),                 // 거래
                cat: '',                                   // 카테고리 (TimeLog에 없음 → 비워 둠)
                min: String(r.minutes || ''),              // 시간(분)
                end: r.endDate || '',                      // 종료 예정일
                note: r.memo || ''                         // 비고
            }));
    }

    // ---------- ERP 자동입력 창 ----------
    let erpModalDate = '';

    function openErpFillModal(dateStr) {
        erpModalDate = dateStr || timelogTabDate || getTodayIso();
        renderErpFillModal();
        openModal('erpFillModal');
    }

    function renderErpFillModal() {
        const rows = buildErpRows(erpModalDate);
        document.getElementById('erpFillDate').textContent = rows.length ? `${erpModalDate} · ${rows.length}줄` : erpModalDate;
        document.getElementById('erpBookmarkLink').setAttribute('href', buildErpBookmarklet());

        // 미리보기: 실제로 ERP에 넣을 값 그대로. 빈 칸이 있는 줄은 빨갛게 표시한다
        const isMissing = (r) => !r.job || !r.trx || !r.end;
        document.getElementById('erpFillList').innerHTML = rows.length
            ? rows.map((r, i) => `
                <div class="erp-row ${isMissing(r) ? 'is-missing' : ''}">
                    <span class="erp-row-no">${i + 1}</span>
                    <span class="erp-row-main">
                        <span class="erp-row-title">${escapeHtml(r.title || '-')}</span>
                        <span class="erp-row-meta">작업 ${escapeHtml(r.job || '없음')}<span class="sep">·</span>업무 ${escapeHtml(r.bizz)}<span class="sep">·</span>거래 ${escapeHtml(r.trx || '없음')}<span class="sep">·</span>${escapeHtml(r.min)}분<span class="sep">·</span>종료 예정일 ${escapeHtml(r.end || '없음')}</span>
                    </span>
                </div>`).join('')
            : '<div class="erp-empty">이 날짜에는 기록이 없어요.</div>';

        const missing = rows.filter(isMissing).length;
        const warn = document.getElementById('erpFillWarn');
        warn.innerHTML = missing
            ? `<b>${missing}줄</b>에 작업번호·운영번호·완료일자 중 빈 값이 있어요. 그 칸은 ERP에서도 비워 두니, 필요하면 운영 관리나 시간로그 탭에서 먼저 채워 주세요.`
            : '';
        warn.classList.toggle('hidden', !missing);

        const copyBtn = document.getElementById('erpCopyBtn');
        copyBtn.disabled = !rows.length;
        copyBtn.textContent = '이 날짜 복사';
    }

    async function copyErpPayload() {
        const rows = buildErpRows(erpModalDate);
        if (!rows.length) return;
        if (!(window.crypto && crypto.subtle)) { showToast('https 주소에서만 복사할 수 있습니다'); return; }
        const btn = document.getElementById('erpCopyBtn');
        try {
            const sig = await signErpCode(ERP_FILL_JS);
            await copyTextToClipboard(ERP_PREFIX + JSON.stringify({ date: erpModalDate, rows, code: ERP_FILL_JS, sig }));
            btn.textContent = '복사됨 ✓';
            showToast('복사했습니다. ERP 화면에서 즐겨찾기 「TimeLog→ERP」를 누르세요');
        } catch (e) {
            btn.textContent = '이 날짜 복사';
            showToast('복사하지 못했습니다');
        }
    }

    async function copyErpBookmarklet() {
        try {
            await copyTextToClipboard(buildErpBookmarklet());
            showToast('주소를 복사했습니다. 새 즐겨찾기의 URL 칸에 붙여 넣으세요');
        } catch (e) { showToast('복사하지 못했습니다'); }
    }
