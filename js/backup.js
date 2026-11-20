    // ---- Online backup via Google Drive ----
    // Uses Google Identity Services (GIS) to get a short-lived OAuth access token scoped to
    // "drive.file" (this app can only see/edit files it created — not the rest of the user's Drive).
    // The Client ID and file id are plain (non-secret) config, kept in localStorage. The access
    // token is also cached in localStorage so a page reload doesn't force a fresh consent prompt
    // within the token's ~1hr lifetime, but nothing here is a long-lived secret.
    const DRIVE_CLIENT_ID_KEY = 'timelog_drive_client_id';
    const DRIVE_FILE_ID_KEY = 'timelog_drive_file_id';
    const DRIVE_TOKEN_KEY = 'timelog_drive_access_token';
    const DRIVE_TOKEN_EXPIRY_KEY = 'timelog_drive_token_expiry';
    const DRIVE_LAST_BACKUP_KEY = 'timelog_drive_last_backup';
    const DRIVE_LAST_BACKUP_DATE_KEY = 'timelog_drive_last_backup_date';
    const DRIVE_SCHEDULED_DONE_DATE_KEY = 'timelog_drive_scheduled_done_date';
    const DRIVE_BACKUP_TIME_KEY = 'timelog_drive_backup_time';
    const DRIVE_FILE_NAME = 'timelog-backup.json';
    const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

    let driveTokenClient = null;

    function getDriveClientId() { return localStorage.getItem(DRIVE_CLIENT_ID_KEY) || ''; }
    function saveDriveClientId(val) { localStorage.setItem(DRIVE_CLIENT_ID_KEY, val.trim()); driveTokenClient = null; }
    function getDriveFileId() { return localStorage.getItem(DRIVE_FILE_ID_KEY) || ''; }
    function setDriveFileId(id) { localStorage.setItem(DRIVE_FILE_ID_KEY, id); }
    function getDriveBackupTime() { return localStorage.getItem(DRIVE_BACKUP_TIME_KEY) || '20:00'; }
    function saveDriveBackupTime(val) { localStorage.setItem(DRIVE_BACKUP_TIME_KEY, val); }

    function formatBackupTimestamp(iso) {
        const d = new Date(iso);
        const pad = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    function refreshDriveBackupStatus(errorMsg) {
        const el = document.getElementById('driveBackupStatus');
        if (!el) return;
        if (errorMsg) {
            el.innerText = '백업 실패: ' + errorMsg;
            el.classList.add('text-error');
            return;
        }
        el.classList.remove('text-error');
        const last = localStorage.getItem(DRIVE_LAST_BACKUP_KEY);
        el.innerText = last ? `마지막 백업: ${formatBackupTimestamp(last)}` : '아직 백업한 적 없음';
    }

    function waitForGis(timeoutMs = 8000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            (function poll() {
                if (window.google && google.accounts && google.accounts.oauth2) { resolve(); return; }
                if (Date.now() - start > timeoutMs) { reject(new Error('Google 로그인 스크립트를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.')); return; }
                setTimeout(poll, 150);
            })();
        });
    }

    function ensureDriveTokenClient() {
        const clientId = getDriveClientId();
        if (!clientId) return null;
        if (driveTokenClient) return driveTokenClient;
        driveTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: DRIVE_SCOPE,
            callback: () => {}
        });
        return driveTokenClient;
    }

    async function requestDriveAccessToken(interactive) {
        await waitForGis();
        const client = ensureDriveTokenClient();
        if (!client) throw new Error('Google Client ID가 설정되지 않았습니다.');
        return new Promise((resolve, reject) => {
            client.callback = (resp) => {
                if (!resp || resp.error) { reject(new Error((resp && resp.error) || '인증에 실패했습니다.')); return; }
                const expiresAt = Date.now() + (resp.expires_in * 1000) - 60000;
                localStorage.setItem(DRIVE_TOKEN_KEY, resp.access_token);
                localStorage.setItem(DRIVE_TOKEN_EXPIRY_KEY, String(expiresAt));
                resolve(resp.access_token);
            };
            try {
                client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
            } catch (err) { reject(err); }
        });
    }

    async function getDriveAccessToken(interactive) {
        const cached = localStorage.getItem(DRIVE_TOKEN_KEY);
        const expiry = parseInt(localStorage.getItem(DRIVE_TOKEN_EXPIRY_KEY) || '0', 10);
        if (cached && Date.now() < expiry) return cached;
        return requestDriveAccessToken(interactive);
    }

    async function uploadBackupToDrive(token, data) {
        let fileId = getDriveFileId();
        const boundary = 'timelog_boundary_' + Date.now();
        const metadata = fileId ? {} : { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
        const body =
            `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(data, null, 2)}\r\n` +
            `--${boundary}--`;

        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart`;

        const res = await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body
        });

        if (!res.ok) {
            if (res.status === 404 && fileId) {
                setDriveFileId('');
                return uploadBackupToDrive(token, data);
            }
            const errBody = await res.json().catch(() => ({}));
            throw new Error((errBody.error && errBody.error.message) || `HTTP ${res.status}`);
        }
        const json = await res.json();
        setDriveFileId(json.id);
        return json;
    }

    async function downloadBackupFromDrive(token) {
        const fileId = getDriveFileId();
        if (!fileId) throw new Error('아직 백업 파일이 없습니다. 먼저 "지금 백업"을 눌러주세요.');
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
    }

    // interactive=false is used for automatic (app-open / scheduled) backups: it tries a silent
    // token refresh and quietly gives up (no popup, no alert) if that's not possible.
    async function performDriveBackup(interactive) {
        try {
            const token = await getDriveAccessToken(interactive);
            const data = { settings: appSettings, presets: getPresets(), history: getHistory() };
            await uploadBackupToDrive(token, data);
            localStorage.setItem(DRIVE_LAST_BACKUP_KEY, new Date().toISOString());
            localStorage.setItem(DRIVE_LAST_BACKUP_DATE_KEY, getTodayIso());
            // 정한 백업 시각 이후에 한 백업이면 오늘 예약 백업도 한 것으로 본다 (곧바로 두 번 올리지 않게)
            if (dateToHHMM(new Date()) >= getDriveBackupTime()) localStorage.setItem(DRIVE_SCHEDULED_DONE_DATE_KEY, getTodayIso());
            refreshDriveBackupStatus();
            return true;
        } catch (err) {
            if (interactive) refreshDriveBackupStatus(err.message);
            return false;
        }
    }

    async function backupToDrive() {
        if (!getDriveClientId()) { alert('먼저 Google Client ID를 입력해주세요.'); return; }
        const ok = await performDriveBackup(true);
        if (ok) alert('구글 드라이브에 백업이 완료되었습니다.');
        else alert('백업에 실패했습니다. 상태 메시지와 Client ID 설정을 확인해주세요.');
    }

    async function restoreFromDrive() {
        if (!getDriveClientId()) { alert('먼저 Google Client ID를 입력해주세요.'); return; }
        if (!confirm('구글 드라이브 백업으로 복원하면 현재 이 기기의 데이터를 덮어씁니다. 계속할까요?')) return;
        try {
            const token = await getDriveAccessToken(true);
            applyImportedData(await downloadBackupFromDrive(token));
            alert('구글 드라이브 백업에서 복원했습니다.');
        } catch (err) {
            alert('복원에 실패했습니다: ' + err.message);
        }
    }

    // Called once on app load: if today doesn't have a backup yet, try a silent one.
    async function runAppOpenAutoBackup() {
        if (!getDriveClientId()) return;
        if (localStorage.getItem(DRIVE_LAST_BACKUP_DATE_KEY) === getTodayIso()) return;
        await performDriveBackup(false);
    }

    // 탭이 열려 있는 동안 30초마다 확인해, 정한 백업 시각이 지났고 오늘 아직 안 했으면 백업한다.
    // (정각 1분만 보면 PC가 잠들어 있다 깨어난 날은 건너뛰게 되어 '지났는지'로 본다)
    function startDriveScheduledBackupWatcher() {
        let triedDate = ''; // 실패해도 하루에 한 번만 시도 (로그인 창이 반복해서 뜨지 않게)
        setInterval(async () => {
            if (!getDriveClientId()) return;
            const today = getTodayIso();
            if (dateToHHMM(new Date()) < getDriveBackupTime() || triedDate === today) return;
            if (localStorage.getItem(DRIVE_SCHEDULED_DONE_DATE_KEY) === today) return;
            triedDate = today;
            await performDriveBackup(false);
        }, 30000);
    }
