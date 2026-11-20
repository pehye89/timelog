    function getTodayIso() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
    function dateToIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    function dateToHHMM(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
    // 'YYYY-MM-DD'를 그 지역의 자정으로 읽는다 (new Date('YYYY-MM-DD')는 UTC 자정이라 요일·날짜가 어긋날 수 있음)
    function isoToDate(iso) { return new Date(`${iso}T00:00:00`); }
    // 주말이면 direction(+1/-1) 방향으로 평일까지 옮긴다
    function skipWeekend(d, direction) {
        while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + direction);
        return d;
    }
    // 속성값(title="…") 안에도 쓰이므로 큰따옴표까지 이스케이프한다
    function escapeHtml(str) { return str ? String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : ''; }

    // Brief, non-blocking toast notification that fades in and auto-dismisses after ~1.5s.
    function showToast(message) {
        const el = document.createElement('div');
        el.className = 'toast-notice';
        el.textContent = message;
        document.body.appendChild(el);
        requestAnimationFrame(() => el.classList.add('toast-notice--visible'));
        setTimeout(() => {
            el.classList.remove('toast-notice--visible');
            setTimeout(() => el.remove(), 200);
        }, 1500);
    }

    function truncate(str, max) { if(!str) return ''; return str.length > max ? str.substring(0, max) + '...' : str; }
    
    // 운영 시작일: 사용자가 직접 수정(startDateManual)하기 전까지는 '첫 기록이 남겨진 날'을 쓴다.
    // 기록이 아직 없으면 저장된 시작일(생성 시 선택한 날짜)을 그대로 보여준다.
    function getEffectiveStartDate(job, history) {
        if (!job || job.status === 'admin') return '';
        if (job.startDateManual && job.startDate) return job.startDate;
        let first = '';
        (history || getHistory()).forEach(h => { if (h.jobId === job.id && h.date && (!first || h.date < first)) first = h.date; });
        return first || job.startDate || '';
    }

    // 기간 표기: "2026-10-22 ~ 2026-10-30" (완료 전에는 "2026-10-22 ~")
    function formatPeriod(start, end) {
        return `${start || '-'} ~${end ? ' ' + end : ''}`;
    }

    function formatDuration(ms) {
        const totalMins = Math.round(ms / 60000);
        return `${totalMins}분`;
    }

    function renderOpTaskMeta(opsCode, taskName, taskCode) {
        const code = escapeHtml(opsCode || '');
        const tName = escapeHtml(taskName || '');
        const tCode = escapeHtml(taskCode || '');
        let parts = [];
        if(code) parts.push(`<strong class="op-meta-code">${code}</strong>`);
        if(tCode) parts.push(tCode);
        if(tName) parts.push(tName);
        return `<span class="op-meta">${parts.join(' ')}</span>`;
    }

    function getVisiblePresetsForDate(selectedDate, includeAllCompleted, includeSuspended) {
        const sel = selectedDate || document.getElementById('hiddenDateInput').value || getTodayIso();
        // 완료 포함이면 오늘 기준 최근 N일 안에 완료된 것, 아니면 보고 있는 날짜 이후에 완료된 것만
        const recent = new Date(); recent.setDate(recent.getDate() - TRACKER_COMPLETED_VISIBLE_DAYS);
        const completedFrom = includeAllCompleted ? dateToIso(recent) : sel;
        return getPresets().filter(p => {
            if (p.status === 'active' || p.status === 'admin') return true;
            if (p.status === 'suspended') return !!includeSuspended;
            if (p.status === 'completed') return !p.endDate || p.endDate >= completedFrom;
            return false;
        });
    }

    // 타이머 탭 운영목록 전용 정렬: 완료된 운영은 항상 맨 아래로 밀리고, 완료 항목끼리는 가장 최근에
    // 완료된 것이 위로 온다. 완료가 아닌 항목(진행중/관리업무)은 항상 운영번호(opsCode) 순으로 정렬된다.
    function sortTodoListItems(jobs) {
        return [...jobs].sort((a, b) => {
            const aDone = a.status === 'completed';
            const bDone = b.status === 'completed';
            if (aDone !== bDone) return aDone ? 1 : -1;

            if (aDone && bDone) {
                const ad = a.endDate || ''; const bd = b.endDate || '';
                if (ad !== bd) return bd.localeCompare(ad); // most recently completed first
                return (a.opsCode || '').localeCompare(b.opsCode || '');
            }

            if ((a.opsCode || '') !== (b.opsCode || '')) return (a.opsCode || '').localeCompare(b.opsCode || '');
            if ((a.taskCode || '') !== (b.taskCode || '')) return (a.taskCode || '').localeCompare(b.taskCode || '');
            return (a.opsName || '').localeCompare(b.opsName || '');
        });
    }

    // 타이머 탭 운영목록의 필터·정렬 팝오버에서 고를 수 있는 정렬 옵션.
    // 상태 정렬의 정석 순서(오름차순): 관리업무 > 진행중 > 중단 > 완료. 같은 상태끼리는 운영번호 순.
    const STATUS_CANONICAL_ORDER = { admin: 0, active: 1, suspended: 2, completed: 3 };
    function sortJobsByCanonicalStatus(jobs) {
        return [...jobs].sort((a, b) => {
            const oa = STATUS_CANONICAL_ORDER[a.status] ?? 4; const ob = STATUS_CANONICAL_ORDER[b.status] ?? 4;
            if (oa !== ob) return oa - ob;
            return (a.opsCode || '').localeCompare(b.opsCode || '');
        });
    }

    // 타이머 탭 운영목록과 운영 관리 탭이 함께 쓰는 정렬 옵션. 「기본값」만 탭마다 다르다.
    // defaultDir이 있는 항목(기본값)은 고르면 정렬 방향도 기본 방향으로 되돌린다.
    const byText = (key) => (jobs) => [...jobs].sort((a, b) => (a[key] || '').localeCompare(b[key] || ''));
    const COMMON_SORT_OPTIONS = {
        status: { label: '상태순', fn: sortJobsByCanonicalStatus },
        opsCode: { label: '운영번호순', fn: byText('opsCode') },
        name: { label: '이름순', fn: byText('opsName') },
        recent: { label: '최근 등록순', fn: (jobs) => [...jobs].sort((a, b) => (b.id || 0) - (a.id || 0)) }
    };
    const TRACKER_SORT_OPTIONS = { default: { label: '기본값', defaultDir: 'asc', fn: sortTodoListItems }, ...COMMON_SORT_OPTIONS };
    const MGMT_SORT_OPTIONS = { default: { label: '기본값', defaultDir: 'desc', fn: byText('opsCode') }, ...COMMON_SORT_OPTIONS };

    function sortJobsWith(options, jobs, sortKey, direction) {
        const sorted = (options[sortKey] || options.default).fn(jobs);
        return direction === 'desc' ? sorted.reverse() : sorted;
    }
    function sortJobsForTracker(jobs, sortKey, direction) { return sortJobsWith(TRACKER_SORT_OPTIONS, jobs, sortKey, direction); }
    function sortJobsForManagement(jobs, sortKey, direction) { return sortJobsWith(MGMT_SORT_OPTIONS, jobs, sortKey, direction); }

    // 운영번호·운영명·작업번호·작업명 중 하나라도 검색어를 포함하면 true (대소문자 무시)
    function matchesSearch(job, search) {
        const q = (search || '').trim().toLowerCase();
        if (!q) return true;
        return [job.opsCode, job.opsName, job.taskCode, job.taskName].filter(Boolean).join(' ').toLowerCase().includes(q);
    }

    // dateStr(YYYY-MM-DD)이 [from, to] 안에 있으면 true. 비어 있는 쪽은 제한 없음
    function inDateRange(dateStr, from, to) {
        return !(from && dateStr < from) && !(to && dateStr > to);
    }

    // 정렬 팝오버 공통: 옵션 버튼 목록 / 오름·내림차순 버튼 표시
    function renderSortOptionButtons(wrapId, options, currentKey, onPick) {
        const wrap = document.getElementById(wrapId);
        if (!wrap) return;
        wrap.innerHTML = '';
        Object.keys(options).forEach(key => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sort-option-item' + (currentKey === key ? ' active' : '');
            btn.textContent = options[key].label;
            btn.onclick = () => onPick(key);
            wrap.appendChild(btn);
        });
    }
    function updateSortDirButton(btnId, direction) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.classList.toggle('desc', direction === 'desc');
        btn.title = direction === 'asc' ? '오름차순 (클릭 시 내림차순)' : '내림차순 (클릭 시 오름차순)';
    }

    // 팝오버 바깥을 누르면 닫는다. composedPath()는 클릭한 순간의 경로라,
    // 클릭 직후 다시 그려져 DOM에서 빠진 옵션 버튼도 '팝오버 안' 클릭으로 인식한다.
    function closeOnOutsideClick(wrapId, popoverId) {
        document.addEventListener('click', (e) => {
            const wrap = document.getElementById(wrapId);
            const popover = document.getElementById(popoverId);
            if (!wrap || !popover || !popover.classList.contains('open')) return;
            if (!e.composedPath().includes(wrap)) popover.classList.remove('open');
        });
    }

    // 페이지 번호 버튼 (운영목록·운영 관리 공통)
    function renderPagination(el, totalPages, currentPage, handlerName) {
        el.innerHTML = totalPages > 1
            ? Array.from({ length: totalPages }, (_, i) => i + 1)
                .map(i => `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="${handlerName}(${i})">${i}</button>`).join('')
            : '';
    }

    // 접기·펼치기 화살표
    function chevronSvg(expanded) {
        return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${expanded ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'}"/></svg>`;
    }

    // 운영 관리·주간보고의 날짜별 기록 표: 날짜 | 소요 시간 | 메모
    function buildDailyLogTable(logs, dateLabel, extraClass) {
        if (!logs.length) return '<div class="log-detail-empty">해당 조건에 기록된 업무가 없습니다.</div>';
        const byDate = {};
        logs.forEach(l => {
            const g = byDate[l.date] || (byDate[l.date] = { ms: 0, bullets: [] });
            g.ms += l.durationMs || 0;
            if (l.bullets) g.bullets.push(...l.bullets);
        });
        const rows = Object.keys(byDate).sort().map(d =>
            `<tr><td class="col-date">${dateLabel(d)}</td><td class="col-duration">${formatDuration(byDate[d].ms)}</td><td class="col-content">${buildDotLines(byDate[d].bullets)}</td></tr>`);
        return `<table class="log-detail-table ${extraClass || ''}">${rows.join('')}</table>`;
    }

    // 진행상태 quick-menu labels, shared by the status button and its dropdown options.
    const STATUS_QUICK_LABELS = { active: '진행중', completed: '완료', suspended: '중단' };

    // 주간보고용 '그 주 기준' 상태: referenceDateStr(그 주 일요일)까지 완료일이 지났으면 완료, 아니면 진행중.
    // 관리업무는 날짜가 없어 항상 관리업무. (흐리게 할지는 weekly.js에서 '주 시작 전에 완료'인지로 따로 판단)
    function getStatusAsOfDate(job, referenceDateStr) {
        if (job.status === 'admin') return 'admin';
        if (job.endDate && job.endDate <= referenceDateStr) return 'completed';
        return 'active';
    }

    const STATUS_PILL_INFO = {
        active: { label: '진행중', cls: 'active' },
        completed: { label: '완료', cls: 'completed' },
        suspended: { label: '중단', cls: 'suspended' },
        admin: { label: '관리업무', cls: 'admin' }
    };
    function statusPillHtml(status) {
        const info = STATUS_PILL_INFO[status] || STATUS_PILL_INFO.active;
        return `<span class="status-pill status-pill--${info.cls}">${info.label}</span>`;
    }

    // Bullets can carry an indent level, encoded as leading tab characters (one \t per level).
    // This keeps the on-disk format a plain string array while supporting nested sub-bullets.
    function parseBulletLevel(raw) {
        const str = raw || '';
        const match = /^(\t+)/.exec(str);
        const level = match ? match[1].length : 0;
        const text = str.replace(/^\t+/, '').replace(/^[•\-\*]\s*/, '');
        return { level, text };
    }

    function buildDotLines(arr) {
        if(!arr || !arr.length) return '-';
        const uniqueArr = [...new Set(arr)];
        return uniqueArr.map(b => {
            const { level, text } = parseBulletLevel(b);
            const indentStyle = level > 0 ? ` style="margin-left:${level * 16}px;"` : '';
            const dotClass = level > 0 ? 'bullet-line-dot bullet-line-dot--sub' : 'bullet-line-dot';
            return `<div class="bullet-line"${indentStyle}><span class="${dotClass}"></span><span class="bullet-line-text">${escapeHtml(text).replace(/\n/g, '<br>')}</span></div>`;
        }).join('');
    }

    // 메모(bullets)를 복사·붙여넣기용 평문으로 변환: 각 항목은 "· 내용", 하위 단계마다 스페이스 4칸 들여쓰기.
    // 한 항목 안의 줄바꿈(Shift+Enter)은 "· " 뒤 글자 위치에 맞춰 이어지도록 들여쓴다.
    const MEMO_INDENT = '    ';
    function formatMemoPlainText(arr) {
        if (!arr || !arr.length) return '';
        return [...new Set(arr)]
            .map(b => parseBulletLevel(b))
            .filter(({ text }) => text.trim().length > 0)
            .map(({ level, text }) => {
                const indent = MEMO_INDENT.repeat(level);
                const [first, ...rest] = text.split('\n');
                return [`${indent}· ${first}`, ...rest.map(line => `${indent}  ${line}`)].join('\n');
            })
            .join('\n');
    }

    // 클립보드 복사: https(GitHub Pages)에서는 Clipboard API, 그 외(file:// 등)에서는 textarea 방식으로 대체.
    function copyTextToClipboard(text) {
        const fallback = () => new Promise((resolve, reject) => {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.setAttribute('readonly', '');
            ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy') ? resolve() : reject(new Error('copy failed')); }
            catch (e) { reject(e); }
            finally { ta.remove(); }
        });
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(fallback);
        }
        return fallback();
    }

    // Splits raw text into bullets (used only for pasted multi-line text inside a row).
    function splitPastedTextIntoBullets(text) {
        return text.split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(s => s.length > 0);
    }

    function timeToMins(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
    function getRandomColor() { return appSettings.palette[Math.floor(Math.random() * appSettings.palette.length)]; }

    // Tab을 한 번이라도 쓰면 안내 문구("Tab을 누르면…")를 모든 편집기에서 영구히 숨긴다.
    // 브라우저에 저장하므로 새로고침·재접속 후에도 다시 나오지 않는다.
    const STORAGE_KEY_TAB_HINT_DONE = 'wt_minimal_tab_hint_done_v1';
    let hasEverUsedTabHint = (() => { try { return localStorage.getItem(STORAGE_KEY_TAB_HINT_DONE) === '1'; } catch (e) { return false; } })();
    function markTabHintUsed() {
        hasEverUsedTabHint = true;
        try { localStorage.setItem(STORAGE_KEY_TAB_HINT_DONE, '1'); } catch (e) { /* 저장 불가 시 이번 접속 동안만 숨김 */ }
    }

    // Obsidian-style bullet list editor: each bullet is its own row with a
    // visual "•" marker to its left (not typed text). Enter creates a new
    // bullet row (inheriting the current row's indent level); Shift+Enter
    // inserts a soft line break within the same bullet; Tab indents the
    // current row into a sub-bullet of the previous row (Shift+Tab outdents);
    // Backspace at the start of a row merges it into the previous one.
    function createBulletEditor(containerEl, options = {}) {
        if (!containerEl) return null;
        containerEl.classList.add('bullet-editor');
        containerEl.innerHTML = '';
        const INDENT_PX = 20;

        // Tab으로 하위 항목을 만들 수 있다는 안내. 두 번째 줄부터 보이고, Tab을 한 번이라도 쓰면 다시 안 보인다.
        const hintEl = document.createElement('div');
        hintEl.className = 'bullet-tab-hint hidden';
        hintEl.textContent = 'Tab을 누르면 하위 항목으로 정리할 수 있어요';
        containerEl.insertAdjacentElement('afterend', hintEl);

        function updateTabHint() {
            hintEl.classList.toggle('hidden', hasEverUsedTabHint || getRowEls().length < 2);
        }

        function autoResize(ta) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }

        function getRows() {
            return Array.from(containerEl.querySelectorAll('.bullet-input'));
        }

        function getRowEls() {
            return Array.from(containerEl.querySelectorAll('.bullet-row'));
        }

        function getLevel(rowEl) { return parseInt(rowEl.dataset.level || '0', 10); }

        function applyIndent(rowEl) {
            const level = getLevel(rowEl);
            rowEl.style.marginLeft = level > 0 ? (level * INDENT_PX) + 'px' : '';
            const dot = rowEl.querySelector('.bullet-dot');
            if (dot) dot.classList.toggle('bullet-dot--sub', level > 0);
        }

        function setLevel(rowEl, level) {
            rowEl.dataset.level = String(Math.max(0, level));
            applyIndent(rowEl);
        }

        function emitChange() {
            if (options.onChange) options.onChange(controller.getBullets());
        }

        function buildRow(text, level) {
            const row = document.createElement('div');
            row.className = 'bullet-row';
            row.dataset.level = String(level || 0);
            const dot = document.createElement('span');
            dot.className = 'bullet-dot';
            const ta = document.createElement('textarea');
            ta.className = 'bullet-input';
            ta.rows = 1;
            ta.value = text || '';
            if (options.placeholder) ta.placeholder = options.placeholder;
            row.appendChild(dot);
            row.appendChild(ta);
            applyIndent(row);

            ta.addEventListener('input', () => { autoResize(ta); emitChange(); });
            ta.addEventListener('click', (e) => e.stopPropagation());

            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    markTabHintUsed();
                    updateTabHint();
                    const rowEls = getRowEls();
                    const idx = rowEls.indexOf(row);
                    if (e.shiftKey) {
                        setLevel(row, getLevel(row) - 1);
                    } else if (idx > 0) {
                        const prevLevel = getLevel(rowEls[idx - 1]);
                        setLevel(row, Math.min(getLevel(row) + 1, prevLevel + 1));
                    }
                    emitChange();
                } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newRow = buildRow('', getLevel(row));
                    row.after(newRow);
                    autoResize(newRow.querySelector('.bullet-input'));
                    newRow.querySelector('.bullet-input').focus();
                    updateTabHint();
                    emitChange();
                } else if (e.key === 'Backspace' && ta.selectionStart === 0 && ta.selectionEnd === 0) {
                    const rows = getRows();
                    const idx = rows.indexOf(ta);
                    if (idx > 0) {
                        e.preventDefault();
                        const prevTa = rows[idx - 1];
                        const mergePos = prevTa.value.length;
                        prevTa.value += ta.value;
                        autoResize(prevTa);
                        row.remove();
                        prevTa.focus();
                        prevTa.selectionStart = prevTa.selectionEnd = mergePos;
                        updateTabHint();
                        emitChange();
                    }
                }
            });

            return row;
        }

        const controller = {
            getBullets: () => getRowEls().map(rowEl => {
                const ta = rowEl.querySelector('.bullet-input');
                const text = ta.value.trim();
                if (!text) return null;
                const level = getLevel(rowEl);
                return (level > 0 ? '\t'.repeat(level) : '') + text;
            }).filter(Boolean),
            setBullets: (arr) => {
                containerEl.innerHTML = '';
                const list = (arr && arr.length) ? arr : [''];
                list.forEach(raw => {
                    const match = /^(\t+)/.exec(raw || '');
                    const level = match ? match[1].length : 0;
                    const text = (raw || '').replace(/^\t+/, '');
                    containerEl.appendChild(buildRow(text, level));
                });
                getRows().forEach(autoResize);
                updateTabHint();
            },
            focus: () => {
                const rows = getRows();
                if (rows.length) rows[rows.length - 1].focus();
            },
            isEmpty: () => controller.getBullets().length === 0
        };

        controller.setBullets(options.initialBullets || []);
        return controller;
    }
