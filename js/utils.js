    function getTodayIso() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
    function dateToIso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
    function dateToHHMM(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
    function escapeHtml(str) { return str ? String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;") : ''; }
    function truncate(str, max) { if(!str) return ''; return str.length > max ? str.substring(0, max) + '...' : str; }
    
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

    function getVisiblePresetsForDate(selectedDate) {
        const sel = selectedDate || document.getElementById('hiddenDateInput').value || getTodayIso();
        return getPresets().filter(p => {
            if (p.status === 'active') return true;
            if (p.status === 'admin') return true;
            if (p.status === 'completed') {
                if (!p.endDate) return true;
                return p.endDate >= sel;
            }
            return false;
        });
    }

    // Returns true if the job's opsCode/opsName/taskCode/taskName contains the search term (case-insensitive).
    function matchesSearch(job, search) {
        if (!search) return true;
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const haystack = [job.opsCode, job.opsName, job.taskCode, job.taskName].filter(Boolean).join(' ').toLowerCase();
        return haystack.includes(q);
    }

    // Returns true if dateStr (YYYY-MM-DD) falls within [from, to] (inclusive). Empty bounds are unbounded.
    function inDateRange(dateStr, from, to) {
        if (from && dateStr < from) return false;
        if (to && dateStr > to) return false;
        return true;
    }

    // Shared sort order used across all tabs: 관리업무 > 완료 > 진행중, then by 운영번호(opsCode).
    const STATUS_SORT_ORDER = { admin: 0, completed: 1, active: 2 };
    function sortJobsByStatusAndCode(jobs) {
        return [...jobs].sort((a, b) => {
            const oa = STATUS_SORT_ORDER[a.status] ?? 3; const ob = STATUS_SORT_ORDER[b.status] ?? 3;
            if (oa !== ob) return oa - ob;
            return (a.opsCode || '').localeCompare(b.opsCode || '');
        });
    }

    // The current status a job carries (job.status) reflects "right now" — but a report for a past
    // period should show what the status was AS OF that period, not today. 관리업무 has no dates and
    // is always shown as such. Otherwise: if the job's completion date is on or before the reference
    // date, it had already been marked 완료 by then; if not (or no end date yet), it was still 진행중.
    function getStatusAsOfDate(job, referenceDateStr) {
        if (job.status === 'admin') return 'admin';
        if (job.endDate && job.endDate <= referenceDateStr) return 'completed';
        return 'active';
    }

    const STATUS_PILL_INFO = {
        active: { label: '진행중', cls: 'active' },
        completed: { label: '완료', cls: 'completed' },
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

    function buildBulletHTML(arr) { 
        if(!arr || !arr.length) return '';
        const uniqueArr = [...new Set(arr)];
        return `<ul class="clean-list">${uniqueArr.map(b => {
            const { level, text } = parseBulletLevel(b);
            const indentStyle = level > 0 ? ` style="margin-left:${level * 16}px;"` : '';
            return `<li${indentStyle}>${escapeHtml(text).replace(/\n/g, '<br>')}</li>`;
        }).join('')}</ul>`; 
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

    // Splits raw text into bullets (used only for pasted multi-line text inside a row).
    function splitPastedTextIntoBullets(text) {
        return text.split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(s => s.length > 0);
    }

    function timeToMins(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
    function getRandomColor() { return appSettings.palette[Math.floor(Math.random() * appSettings.palette.length)]; }

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
