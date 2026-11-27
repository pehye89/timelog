    // ===================== 도움말 =====================
    // 1) 헤더의 「?」 → 도움말 창 (왼쪽 목차 · 오른쪽 설명). 지금 보고 있는 탭의 설명이 먼저 열린다.
    // 2) 각 탭 제목 옆 작은 「?」 → 그 화면의 핵심 몇 가지를 말풍선으로. 「자세히 보기」로 도움말 창의 같은 항목.
    // 두 곳 모두 아래 HELP_SECTIONS 한 곳의 글을 쓰므로, 기능이 바뀌면 여기만 고치면 된다.
    // 글 안의 [[…]]는 버튼·키 이름처럼 강조해서 보여준다.

    const HELP_SECTIONS = [
        {
            id: 'start', title: '시작하기', img: 'images/help/start.webp',
            lead: '운영을 등록하고, 타이머로 기록하고, 표와 보고서로 정리해요.',
            steps: [
                '[[운영 관리]]에서 운영 등록',
                '[[타이머]]에서 ▶로 기록',
                '[[시간로그]]에서 복사 · ERP 입력',
                '[[주간보고]]로 한 주 정리',
            ],
            items: [
                '데이터는 이 브라우저에만 저장돼요. [[백업 · 설정]]을 참고해 백업해 두세요',
                '⚙ 설정에서 업무 · 점심 시간을 먼저 맞춰 두세요',
            ],
            tips: ['운영 관리 → 타이머 → 시간로그 → 주간보고 순서로 써요'],
        },
        {
            id: 'tracker', title: '타이머', img: 'images/help/tracker.webp',
            lead: '운영을 골라 시간을 기록해요.',
            items: [
                '▶ 시작 · ■ 저장. 한 번에 한 운영만 기록돼요',
                '기록 중 메모 칸에 하는 일을 적어요',
                '타임라인 빈 칸 드래그 → 기록 추가, 기록 드래그 → 삭제',
                '타임로그의 시간 · 메모는 눌러서 수정',
                '점심시간은 자동으로 빠져요',
            ],
            tips: ['▶ 시작 · ■ 저장', '타임라인 드래그로 기록 추가 · 삭제', '타임로그의 시간 · 메모는 눌러서 수정'],
        },
        {
            id: 'management', title: '운영 관리', img: 'images/help/management.webp',
            lead: '운영을 등록하고 상태를 관리해요.',
            items: [
                '[[+ 추가]]로 등록, [[수정]]으로 편집',
                '상태 버튼(▾)으로 진행중 · 완료 · 중단 전환',
                '삭제한 운영은 [[휴지통]]에서 복원',
                '[[ERP 업무]]는 ERP 자동입력의 「업무」 칸 값 (비우면 「운영」)',
            ],
            tips: ['[[+ 추가]]로 등록, [[수정]]으로 편집', '상태 버튼(▾)으로 상태 전환', '삭제한 운영은 [[휴지통]]에서 복원'],
        },
        {
            id: 'timelog', title: '시간로그', img: 'images/help/timelog.webp',
            lead: '하루 기록을 운영별로 합친 표예요.',
            items: [
                '[[표 전체 복사]] → 엑셀 · 구글 시트에 그대로 붙여넣기',
                '완료일자 · 메모는 눌러서 수정',
                '칼럼명을 눌러 정렬',
                '[[ERP 자동입력]]: 즐겨찾기 버튼 등록 → [[이 날짜 복사]] → ERP 화면에서 실행. 저장(F8)은 직접',
            ],
            tips: ['[[표 전체 복사]] → 엑셀에 붙여넣기', '완료일자 · 메모는 눌러서 수정', '[[ERP 자동입력]]으로 ERP 입력'],
        },
        {
            id: 'weekly', title: '주간보고', img: 'images/help/weekly.webp',
            lead: '한 주의 운영별 시간과 메모를 모아 봐요.',
            items: [
                '‹ › 로 주 이동, [[금주]]로 이번 주',
                '[[금주요약]]: 운영별 합계',
                '[[운영별 상세]]: 날짜별 기록 · 메모',
                '상태는 [[운영 관리]]에서만 바꿀 수 있어요',
            ],
            tips: ['‹ › 로 주 이동', '[[금주요약]]은 합계, [[운영별 상세]]는 날짜별 기록'],
        },
        {
            id: 'memo', title: '메모', img: 'images/help/memo.webp',
            lead: '떠오르는 일을 시간과 함께 바로 적어요.',
            items: [
                '맨 아래 칸에 쓰고 [[Enter]] → 지금 시각으로 저장',
                '[[Tab]] → 위 메모의 하위 항목, 빈 칸에서 [[Enter]] → 나가기',
                '메모를 눌러 수정, 마우스를 올려 삭제 (되돌리기 가능)',
                '캘린더로 기간 선택: 한 번 누르면 그날, 두 번째 날짜까지 누르면 기간',
            ],
            tips: ['쓰고 [[Enter]] → 바로 저장', '[[Tab]] → 하위 항목', '캘린더로 기간 선택'],
        },
        {
            id: 'data', title: '백업 · 설정', img: 'images/help/data.webp',
            lead: '데이터를 파일이나 Google Drive에 백업해요.',
            items: [
                '[[내보내기]]: 전체 데이터를 파일로 저장',
                '다운로드 아이콘: 파일 가져오기 · Drive 백업 · 복원',
                '⚙ 설정: 업무 · 점심 시간, 타임라인 단위, 색상',
            ],
            tips: ['[[내보내기]]로 파일 백업', '⚙ 설정에서 업무 · 점심 시간'],
        },
        {
            id: 'keys', title: '단축키',
            keys: [
                ['어디서나', [['?', '도움말'], ['Esc', '창 · 달력 닫기']]],
                ['메모 입력', [['Enter', '저장'], ['Tab', '하위 항목'], ['Shift+Tab', '한 단계 위로'], ['빈 칸 Enter', '한 단계 위로'], ['Esc', '비우기']]],
                ['메모 수정', [['바깥 클릭', '저장'], ['Esc', '취소']]],
                ['타이머 · 시간로그 메모', [['Enter', '새 항목'], ['Tab', '하위 항목'], ['Shift+Tab', '한 단계 위로']]],
            ],
        },
    ];

    // 탭 → 도움말 항목
    const HELP_TAB_SECTION = { tracker: 'tracker', management: 'management', timelog: 'timelog', weekly: 'weekly', memo: 'memo' };

    const helpText = (s) => escapeHtml(s).replace(/\[\[(.+?)\]\]/g, '<b class="help-key">$1</b>');
    const findHelpSection = (id) => HELP_SECTIONS.find(s => s.id === id) || HELP_SECTIONS[0];

    function currentHelpTab() {
        const tab = Object.keys(HELP_TAB_SECTION).find(t => {
            const el = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}View`);
            return el && !el.classList.contains('hidden');
        });
        return tab ? HELP_TAB_SECTION[tab] : 'start';
    }

    // ---------- 1) 도움말 창 ----------
    function openHelp(sectionId) {
        closeHelpTip();
        renderHelpNav();
        showHelpSection(sectionId || currentHelpTab());
        openModal('helpModal');
    }

    function renderHelpNav() {
        document.getElementById('helpNav').innerHTML = HELP_SECTIONS.map(s =>
            `<button type="button" class="help-nav-btn" data-help="${s.id}" onclick="showHelpSection('${s.id}')">${escapeHtml(s.title)}</button>`).join('');
    }

    function showHelpSection(id) {
        const s = findHelpSection(id);
        document.querySelectorAll('#helpNav .help-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.help === s.id));
        let html = `<h4 class="help-title">${escapeHtml(s.title)}</h4>`;
        if (s.lead) html += `<p class="help-lead">${escapeHtml(s.lead)}</p>`;
        if (s.img) html += `<figure class="help-figure"><img src="${s.img}" alt="${escapeHtml(s.title)} 화면" loading="lazy"></figure>`;
        if (s.steps) html += `<ol class="help-steps">${s.steps.map(t => `<li><span>${helpText(t)}</span></li>`).join('')}</ol>`;
        if (s.items) html += `<ul class="help-list">${s.items.map(t => `<li>${helpText(t)}</li>`).join('')}</ul>`;
        if (s.keys) {
            html += s.keys.map(([where, rows]) => `
                <div class="help-group">
                    <div class="help-group-title">${escapeHtml(where)}</div>
                    <table class="help-keys">${rows.map(([k, d]) => `<tr><td><kbd>${escapeHtml(k)}</kbd></td><td>${escapeHtml(d)}</td></tr>`).join('')}</table>
                </div>`).join('');
        }
        const body = document.getElementById('helpBody');
        body.innerHTML = html;
        body.scrollTop = 0;
    }

    // ---------- 2) 탭별 작은 「?」 말풍선 ----------
    let helpTipFor = null;

    function toggleHelpTip(e, id) {
        e.stopPropagation();
        if (helpTipFor === id) { closeHelpTip(); return; }
        closeHelpTip();
        const s = findHelpSection(id);
        const tip = document.createElement('div');
        tip.className = 'help-tip';
        tip.id = 'helpTip';
        tip.onclick = (ev) => ev.stopPropagation();
        tip.innerHTML = `
            <div class="help-tip-title">${escapeHtml(s.title)}</div>
            <ul class="help-list help-list--tip">${(s.tips || []).map(t => `<li>${helpText(t)}</li>`).join('')}</ul>
            <button type="button" class="btn-text help-tip-more" onclick="openHelp('${s.id}')">자세히 보기 →</button>`;
        document.body.appendChild(tip);
        // 버튼 바로 아래, 화면 밖으로 나가지 않게
        const r = e.currentTarget.getBoundingClientRect();
        const w = tip.offsetWidth;
        const left = Math.min(Math.max(12, r.left + r.width / 2 - 24), window.innerWidth - w - 12);
        tip.style.left = `${left}px`;
        tip.style.top = `${r.bottom + 8}px`;
        tip.style.setProperty('--arrow-x', `${r.left + r.width / 2 - left}px`);
        helpTipFor = id;
    }

    function closeHelpTip() {
        const tip = document.getElementById('helpTip');
        if (tip) tip.remove();
        helpTipFor = null;
    }

    document.addEventListener('click', () => { if (helpTipFor) closeHelpTip(); });
    window.addEventListener('scroll', () => { if (helpTipFor) closeHelpTip(); }, true);
    window.addEventListener('resize', () => { if (helpTipFor) closeHelpTip(); });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (helpTipFor) { closeHelpTip(); return; }
            const m = document.getElementById('helpModal');
            if (m && m.classList.contains('open')) closeModal('helpModal');
            return;
        }
        // 글을 쓰는 중이 아닐 때 ? 키 → 도움말
        if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target;
            if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (document.querySelector('.modal-bg.open')) return;
            e.preventDefault();
            openHelp();
        }
    });
