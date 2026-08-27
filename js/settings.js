    function renderPaletteOptions() {
        const container = document.getElementById('paletteOptions'); if (!container) return;
        container.innerHTML = Object.entries(PALETTE_THEMES).map(([key, palette]) => {
            const checked = appSettings.paletteTheme === key ? 'checked' : '';
            const selected = appSettings.paletteTheme === key ? 'selected' : '';
            return `
                <label class="palette-option ${selected}">
                    <input type="radio" name="paletteTheme" value="${key}" ${checked} onchange="selectPaletteTheme('${key}')">
                    <div class="palette-swatches">${palette.colors.map(c => `<span style="background:${c};"></span>`).join('')}</div>
                    <span class="palette-name">${palette.name}</span>
                </label>`;
        }).join('');
    }

    function syncPaletteInputs() {
        const colors = appSettings.palette || PALETTE_THEMES.themeGrad.colors;
        for (let i = 0; i < 6; i++) { const input = document.getElementById(`pal${i+1}`); if (input) input.value = colors[i] || '#0f172a'; }
    }

    function selectPaletteTheme(key) {
        const palette = PALETTE_THEMES[key]; if (!palette) return;
        appSettings.paletteTheme = key; appSettings.palette = [...palette.colors];
        renderPaletteOptions(); syncPaletteInputs();
    }

    function handleMainColorChange(val) {
        document.getElementById('settingMainColorText').innerText = val;
        PALETTE_THEMES.themeGrad.colors = getThemeGradation(val);
        if (appSettings.paletteTheme === 'themeGrad') {
            appSettings.palette = [...PALETTE_THEMES.themeGrad.colors];
            syncPaletteInputs();
        }
        renderPaletteOptions();
    }

    function loadSettings() {
        const saved = localStorage.getItem(STORAGE_KEY_SETTINGS); 
        if (saved) { try { appSettings = { ...appSettings, ...JSON.parse(saved) }; } catch (e) { appSettings = { ...appSettings }; } }
        if (!appSettings.mainColor) appSettings.mainColor = '#0f172a';

        PALETTE_THEMES.themeGrad.colors = getThemeGradation(appSettings.mainColor);

        if (!appSettings.paletteTheme || !PALETTE_THEMES[appSettings.paletteTheme]) appSettings.paletteTheme = 'themeGrad';
        if (!Array.isArray(appSettings.palette) || appSettings.palette.length < 6) appSettings.palette = [...PALETTE_THEMES[appSettings.paletteTheme].colors];

        applyTheme(); 
        document.getElementById('settingTheme').value = appSettings.theme || 'light';
        document.getElementById('roundSetting').value = appSettings.roundSetting || '10';
        document.getElementById('settingMainColor').value = appSettings.mainColor;
        document.getElementById('settingMainColorText').innerText = appSettings.mainColor;
        document.getElementById('settingWorkStart').value = appSettings.workStart || '09:00';
        document.getElementById('settingWorkEnd').value = appSettings.workEnd || '20:00';
        document.getElementById('settingLunchStart').value = appSettings.lunchStart || '11:40';
        document.getElementById('settingLunchEnd').value = appSettings.lunchEnd || '12:40';
        document.getElementById('driveClientId').value = getDriveClientId();
        document.getElementById('driveBackupTime').value = getDriveBackupTime();
        refreshDriveBackupStatus();
        renderPaletteOptions(); syncPaletteInputs();
    }

    function applyTheme() { 
        document.body.className = appSettings.theme === 'dark' ? 'dark-mode' : '';
        const root = document.documentElement;
        const mainCol = appSettings.mainColor || '#0f172a';
        root.style.setProperty('--accent-main', mainCol);
        
        if (appSettings.theme === 'dark') {
            root.style.setProperty('--bg-subtle', `color-mix(in srgb, ${mainCol} 20%, #0f172a)`);
            root.style.setProperty('--accent-light', `color-mix(in srgb, ${mainCol} 30%, #0f172a)`);
            root.style.setProperty('--bg-hover', `color-mix(in srgb, ${mainCol} 12%, #0f172a)`);
        } else {
            root.style.setProperty('--bg-subtle', `color-mix(in srgb, ${mainCol} 8%, #ffffff)`);
            root.style.setProperty('--accent-light', `color-mix(in srgb, ${mainCol} 14%, #ffffff)`);
            root.style.setProperty('--bg-hover', `color-mix(in srgb, ${mainCol} 4%, #ffffff)`);
        }
    }
    
    function saveSettings() {
        const newPalette = []; for (let i = 0; i < 6; i++) newPalette.push(document.getElementById(`pal${i+1}`).value);
        const selectedPalette = document.querySelector('input[name="paletteTheme"]:checked');
        const paletteTheme = selectedPalette ? selectedPalette.value : (appSettings.paletteTheme || 'themeGrad');

        appSettings = { 
            ...appSettings,
            theme: document.getElementById('settingTheme').value, 
            mainColor: document.getElementById('settingMainColor').value,
            roundSetting: document.getElementById('roundSetting').value,
            workStart: document.getElementById('settingWorkStart').value || '09:00', workEnd: document.getElementById('settingWorkEnd').value || '20:00',
            lunchStart: document.getElementById('settingLunchStart').value || '11:40', lunchEnd: document.getElementById('settingLunchEnd').value || '12:40',
            paletteTheme: paletteTheme, palette: newPalette
        };

        const presets = getPresets();
        presets.forEach((job, index) => {
            if (!job.isCustomColor) {
                job.color = newPalette[index % newPalette.length];
            }
        });
        localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(presets));

        localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(appSettings)); 
        applyTheme(); closeModal('settingsModal'); renderAll();
    }

    function exportData() {
        const data = { settings: appSettings, presets: getPresets(), history: getHistory() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `timelog_export_${getTodayIso()}.json`; a.click(); URL.revokeObjectURL(url);
    }

    function triggerImport() { document.getElementById('importFileInput').click(); }
    function handleImport(event) {
        const file = event.target.files[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if(data.settings) {
                    const importedSettings = { ...appSettings, ...data.settings };
                    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(importedSettings));
                }
                if(data.presets) localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(data.presets));
                if(data.history) localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(data.history));
                
                alert('데이터를 성공적으로 불러왔습니다.'); loadSettings(); renderAll(); closeModal('exportBackupModal');
            } catch(err) { alert('데이터 형식이 올바르지 않거나 손상된 파일입니다.'); }
        };
        reader.readAsText(file); event.target.value = ''; 
    }
