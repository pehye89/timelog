    function getTodayIso() { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; }
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
            if (p.status === 'completed') {
                if (!p.endDate) return true;
                return p.endDate >= sel;
            }
            return false;
        });
    }

    function buildBulletHTML(arr) { 
        if(!arr || !arr.length) return '';
        const uniqueArr = [...new Set(arr.map(b => b.replace(/^[•\-\*]\s*/, '')))];
        return `<ul class="clean-list">${uniqueArr.map(b => `<li>${escapeHtml(b).replace(/\n/g, '<br>')}</li>`).join('')}</ul>`; 
    }

    function buildDotLines(arr) {
        if(!arr || !arr.length) return '-';
        const uniqueArr = [...new Set(arr.map(b => b.replace(/^[•\-\*]\s*/, '')))];
        return uniqueArr.map(b => `<div class="bullet-line"><span class="bullet-line-dot"></span><span class="bullet-line-text">${escapeHtml(b).replace(/\n/g, '<br>')}</span></div>`).join('');
    }

    // Splits raw text into bullets (used only for pasted multi-line text inside a row).
    function splitPastedTextIntoBullets(text) {
        return text.split('\n').map(s => s.replace(/^[•\-\*]\s*/, '').trim()).filter(s => s.length > 0);
    }

    function timeToMins(timeStr) { const [h, m] = timeStr.split(':').map(Number); return h * 60 + m; }
    function getRandomColor() { return appSettings.palette[Math.floor(Math.random() * appSettings.palette.length)]; }

    // Obsidian-style bullet list editor: each bullet is its own row with a
    // visual "•" marker to its left (not typed text). Enter creates a new
    // bullet row; Shift+Enter inserts a soft line break within the same
    // bullet; Backspace at the start of a row merges it into the previous one.
    function createBulletEditor(containerEl, options = {}) {
        if (!containerEl) return null;
        containerEl.classList.add('bullet-editor');
        containerEl.innerHTML = '';

        function autoResize(ta) {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        }

        function getRows() {
            return Array.from(containerEl.querySelectorAll('.bullet-input'));
        }

        function emitChange() {
            if (options.onChange) options.onChange(controller.getBullets());
        }

        function buildRow(text) {
            const row = document.createElement('div');
            row.className = 'bullet-row';
            const dot = document.createElement('span');
            dot.className = 'bullet-dot';
            const ta = document.createElement('textarea');
            ta.className = 'bullet-input';
            ta.rows = 1;
            ta.value = text || '';
            if (options.placeholder) ta.placeholder = options.placeholder;
            row.appendChild(dot);
            row.appendChild(ta);

            ta.addEventListener('input', () => { autoResize(ta); emitChange(); });
            ta.addEventListener('click', (e) => e.stopPropagation());

            ta.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const newRow = buildRow('');
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
            getBullets: () => getRows().map(t => t.value.trim()).filter(v => v.length > 0),
            setBullets: (arr) => {
                containerEl.innerHTML = '';
                const list = (arr && arr.length) ? arr : [''];
                list.forEach(b => containerEl.appendChild(buildRow(b)));
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
