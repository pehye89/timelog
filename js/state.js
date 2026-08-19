    let timerInterval = null; let startTime = null; let currentJob = null;
    let jobCollapseState = {}; 
    let paintState = { isPainting: false, jobId: null, startMins: null, currentMins: null };
    let currentWeekDate = new Date();
    let timelineJobOrder = [];
    let draggedRowIndex = null;
    let tempSelectedColor = null;
    let isTempCustomColor = false;
    let sessionBulletEditor = null;
    let manualAddBulletEditor = null;
    
    // Management Tab State
    let mgmtStatusTab = 'active'; 
    let mgmtCurrentPage = 1;
    const MGMT_ITEMS_PER_PAGE = 10;

    // Search & Period Filter State (per tab)
    let filters = {
        tracker: { search: '', dateFrom: '', dateTo: '' },
        management: { search: '', dateFrom: '', dateTo: '' },
        weekly: { search: '', dateFrom: '', dateTo: '' }
    };

    const DELETED_RETENTION_DAYS = 30;
    
    // Dynamic Main Theme Gradation Helper
    function getThemeGradation(mainHex) {
        let hex = (mainHex || '#0f172a').replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
        let num = parseInt(hex, 16);
        if (isNaN(num)) num = 0x0f172a;
        let r = (num >> 16) & 255;
        let g = (num >> 8) & 255;
        let b = num & 255;
        
        const factors = [1.0, 0.8, 0.65, 0.5, 0.35, 0.2];
        return factors.map(f => {
            let nr = Math.round(r * f + 255 * (1 - f));
            let ng = Math.round(g * f + 255 * (1 - f));
            let nb = Math.round(b * f + 255 * (1 - f));
            return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1)}`;
        });
    }

    let PALETTE_THEMES = {
        themeGrad: { name: '메인 테마', colors: getThemeGradation('#0f172a') },
        deepPastel: { name: '짙은 파스텔', colors: ['#5b3a70', '#405a7a', '#356b66', '#80623f', '#7c4f57', '#4f6287'] },
        lightPastel: { name: '밝은 파스텔', colors: ['#b8a4d9', '#9fc5e8', '#9fcfc3', '#e8c39e', '#e5aeb6', '#b8c7e3'] },
        vivid: { name: '비비드', colors: ['#7c3aed', '#2563eb', '#059669', '#f59e0b', '#ef4444', '#db2777'] },
        softVivid: { name: '소프트 비비드', colors: ['#6d5dfc', '#3b82f6', '#14b8a6', '#f97316', '#ec4899', '#8b5cf6'] }
    };

    let appSettings = { 
        theme: 'light', 
        mainColor: '#0f172a',
        roundSetting: '10',
        workStart: '09:00', workEnd: '20:00', 
        lunchStart: '11:40', lunchEnd: '12:40',
        paletteTheme: 'themeGrad',
        palette: [...PALETTE_THEMES.themeGrad.colors]
    };
    
    const STORAGE_KEY_PRESETS = 'wt_minimal_presets_v3';
    const STORAGE_KEY_HISTORY = 'wt_minimal_history_v3';
    const STORAGE_KEY_ACTIVE  = 'wt_minimal_active_v3';
    const STORAGE_KEY_SETTINGS = 'wt_minimal_settings_v3';
    const DAYS_EN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    const defaultPresets = [
        { id: 1, opsCode: '0000', opsName: '일일점검', taskCode: '6841', taskName: 'DQ일일점검', status: 'active', startDate: getTodayIso(), endDate: '', color: PALETTE_THEMES.themeGrad.colors[0], isCustomColor: false }
    ];
