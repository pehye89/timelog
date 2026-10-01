    // ---- 커스텀 캘린더 (일자 표시를 눌렀을 때 뜨는 날짜 선택기) ----
    // 브라우저 기본 date 팝업 대신 앱 디자인(토큰)에 맞춘 팝오버를 쓴다.
    // 값은 기존과 같이 hidden date input에 저장되고, 선택 시 onPick(isoString)만 호출한다.
    const CAL_WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'];
    let calState = { el: null, anchor: null, year: 0, month: 0, selected: '', onPick: null };

    function openCalendar(anchor, selectedIso, onPick) {
        // 같은 앵커를 다시 누르면 토글
        if (calState.el && calState.anchor === anchor) { closeCalendar(); return; }
        closeCalendar();
        const base = selectedIso ? new Date(`${selectedIso}T00:00:00`) : new Date();
        calState = { el: document.createElement('div'), anchor, year: base.getFullYear(), month: base.getMonth(), selected: selectedIso || '', onPick };
        calState.el.className = 'cal-popover';
        calState.el.addEventListener('click', e => e.stopPropagation());
        document.body.appendChild(calState.el);
        renderCalendar();
        positionCalendar();
        setTimeout(() => {
            document.addEventListener('click', calOutsideClick, true);
            document.addEventListener('keydown', calKeydown);
            window.addEventListener('resize', closeCalendar);
        }, 0);
    }

    function closeCalendar() {
        if (calState.el) calState.el.remove();
        calState.el = null; calState.anchor = null;
        document.removeEventListener('click', calOutsideClick, true);
        document.removeEventListener('keydown', calKeydown);
        window.removeEventListener('resize', closeCalendar);
    }

    function calOutsideClick(e) {
        if (!calState.el) return;
        if (calState.el.contains(e.target) || (calState.anchor && calState.anchor.contains(e.target))) return;
        closeCalendar();
    }
    function calKeydown(e) { if (e.key === 'Escape') closeCalendar(); }

    function positionCalendar() {
        const el = calState.el; if (!el) return;
        const r = calState.anchor.getBoundingClientRect();
        const w = el.offsetWidth;
        let left = r.left + r.width / 2 - w / 2;
        left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
        el.style.left = `${left + window.scrollX}px`;
        el.style.top = `${r.bottom + 10 + window.scrollY}px`;
    }

    function calShiftMonth(delta) {
        const d = new Date(calState.year, calState.month + delta, 1);
        calState.year = d.getFullYear(); calState.month = d.getMonth();
        renderCalendar();
    }

    function calPick(iso) {
        const cb = calState.onPick;
        closeCalendar();
        if (cb) cb(iso);
    }

    function renderCalendar() {
        const { year, month, selected } = calState;
        const today = getTodayIso();
        const first = new Date(year, month, 1);
        const lead = (first.getDay() + 6) % 7;            // 월요일 시작
        const days = new Date(year, month + 1, 0).getDate();
        const cells = [];
        for (let i = 0; i < lead; i++) cells.push('<span class="cal-cell cal-cell--empty"></span>');
        for (let day = 1; day <= days; day++) {
            const iso = dateToIso(new Date(year, month, day));
            const dow = new Date(year, month, day).getDay();
            const weekend = dow === 0 || dow === 6;       // 앱이 주말을 건너뛰므로 선택 불가
            const cls = ['cal-cell', 'cal-day'];
            if (weekend) cls.push('is-weekend');
            if (iso === today) cls.push('is-today');
            if (iso === selected) cls.push('is-selected');
            cells.push(weekend
                ? `<span class="${cls.join(' ')}">${day}</span>`
                : `<button type="button" class="${cls.join(' ')}" onclick="calPick('${iso}')">${day}</button>`);
        }
        const chev = (d) => `<path d="${d < 0 ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'}"/>`;
        calState.el.innerHTML = `
            <div class="cal-head">
                <button type="button" class="cal-nav" onclick="calShiftMonth(-1)" aria-label="이전 달"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${chev(-1)}</svg></button>
                <div class="cal-title">${year}.${String(month + 1).padStart(2, '0')}</div>
                <button type="button" class="cal-nav" onclick="calShiftMonth(1)" aria-label="다음 달"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${chev(1)}</svg></button>
            </div>
            <div class="cal-grid cal-weekdays">${CAL_WEEKDAYS.map((w, i) => `<span class="${i > 4 ? 'is-weekend' : ''}">${w}</span>`).join('')}</div>
            <div class="cal-grid">${cells.join('')}</div>`;
        positionCalendar();
    }
