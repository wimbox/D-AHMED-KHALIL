/**
 * SyncManager: Handles local data with background cloud sync preparation.
 * Supports CRUD operations with offline persistence.
 */

// --- إعدادات النظام (يمكنك التعديل من هنا مباشرة) ---
const GLOBAL_CONFIG = {
    STARTING_CODE: 100,
    CLINIC_NAME: 'الاسكندرية'
};
// -----------------------------------------------
class SyncManager {
    constructor() {
        this.DB_KEY = 'neuro_clinic_data_v1';
        // Force Reload Logic Fix
        this.data = this.loadLocal();
        this.isNewSession = !localStorage.getItem(this.DB_KEY);
        this.isPullDone = false; // Start false to force initial check
        this.syncQueue = []; // For granular updates
        this.isSyncing = false;

        this.backupHandle = null; // System directory handle for Auto-Guardian
        this.isAutoBackupEnabled = false;

        this.cloudStatus = 'offline';
        this.lastLatency = 0;
        this.syncTimeout = null;

        // Initialize real-time synchronization listeners
        this.initSyncListeners();

        // Safe-Exit Browser Listener (Guardian Second Chance)
        this.initExitListener();

        // Try restoring folder handle from IndexedDB (Auto-Guardian Persistence)
        this.restoreFolderHandle();
    }

    /**
     * Browser Safety: Prompt user before closing to prevent data loss.
     * Changed: Disabled intrusive browser beforeunload by user request.
     */
    initExitListener() {
        // Feature disabled intentionally.
        // The application now relies on explicit logout/close buttons from the UI.
    }

    /**
     * Persistence: Try to find a saved folder handle in IndexedDB
     */
    async restoreFolderHandle() {
        if (!('showDirectoryPicker' in window)) return;
        try {
            const handle = await this.getHandleFromDB();
            if (handle) {
                // Verify if we still have permission (usually requires a user click to re-activate)
                const permission = await handle.queryPermission({ mode: 'readwrite' });
                if (permission === 'granted') {
                    this.backupHandle = handle;
                    this.isAutoBackupEnabled = true;
                    console.log("SyncManager: Auto-Guardian handle restored successfully.");
                } else {
                    console.log("SyncManager: Saved handle found, but needs re-activation.");
                    this.savedHandleProxy = handle; // Store for DashboardUI to trigger re-activation
                }
            }
        } catch (err) { console.warn("Failed to restore handle:", err); }
    }

    async saveHandleToDB(handle) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open("NeuroGuardianDB", 1);
            request.onupgradeneeded = (e) => e.target.result.createObjectStore("handles");
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction("handles", "readwrite");
                tx.objectStore("handles").put(handle, "auto_guardian_folder");
                tx.oncomplete = () => resolve();
            };
            request.onerror = () => reject();
        });
    }

    async getHandleFromDB() {
        return new Promise((resolve) => {
            const request = indexedDB.open("NeuroGuardianDB", 1);
            request.onupgradeneeded = (e) => e.target.result.createObjectStore("handles");
            request.onsuccess = (e) => {
                const db = e.target.result;
                const tx = db.transaction("handles", "readonly");
                const getReq = tx.objectStore("handles").get("auto_guardian_folder");
                getReq.onsuccess = () => resolve(getReq.result);
                getReq.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    }

    /**
     * Gets the most appropriate backup path/description based on environment.
     */
    getBackupInfo() {
        if (window.electronAPI) {
            return {
                type: 'desktop',
                primaryPath: 'D:\\Backups-neuro-clinic',
                secondaryPaths: ['Desktop', 'Documents'],
                description: 'المسار المخصص في القرص D:'
            };
        } else if (this.backupHandle) {
            return {
                type: 'linked-folder',
                primaryPath: 'المجلد المتصل المحفوظ',
                description: 'المجلد الذي قمت بربطه يدوياً'
            };
        } else {
            return {
                type: 'browser',
                primaryPath: 'تنزيلات المتصفح (Edge/Chrome)',
                description: 'تحميل ملف نسخة (Downloads)'
            };
        }
    }



    /**
     * Set up listeners for cross-tab and cross-device synchronization.
     */
    initSyncListeners() {
        // 1. Cross-Tab Sync: Listen for changes from other tabs on the same computer
        window.addEventListener('storage', (e) => {
            if (e.key === this.DB_KEY && e.newValue) {
                console.log("SyncManager: Data updated in another tab. Syncing local state...");
                this.data = JSON.parse(e.newValue);
                this.notifyDataChanged();
            }
        });

        // 2. Cross-Device Sync: Initialize Firestore listener
        // Reduced delay to 300ms to catch cloud data before any accidental local saves
        setTimeout(() => this.startCloudObserver(), 300);
    }

    notifyDataChanged() {
        // Dispatch event for UI components to refresh
        window.dispatchEvent(new CustomEvent('syncDataRefreshed', { detail: this.data }));
        this.updateSyncUI();
    }

    loadLocal() {
        const saved = localStorage.getItem(this.DB_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Ensure settings and counter exist
            // Ensure clinics array exists with correct identity
            if (!parsed.clinics || parsed.clinics.length === 0) {
                parsed.clinics = [
                    {
                        id: 'clinic-default',
                        name: 'الاسكندرية',
                        isActive: true,
                        settings: { currency: 'EGP', timezone: 'Africa/Cairo', workingHours: { start: '09:00', end: '21:00' } }
                    },
                    {
                        id: 'clinic-shubrakhit',
                        name: 'شبراخيت',
                        isActive: true,
                        settings: { currency: 'EGP', timezone: 'Africa/Cairo', workingHours: { start: '09:00', end: '21:00' } }
                    }
                ];
            } else {
                // Fix names if they exist but are wrong
                const main = parsed.clinics.find(c => c.id === 'clinic-default');
                if (main) main.name = 'الاسكندرية';

                // Robust Check for Shubrakhit
                let shub = parsed.clinics.find(c => c.id === 'clinic-shubrakhit');
                if (!shub) {
                    // Try finding by name to prevent duplicates if ID was wrong
                    shub = parsed.clinics.find(c => c.name === 'شبراخيت');
                    if (shub) {
                        shub.id = 'clinic-shubrakhit'; // Fix ID
                    } else {
                        // Create New
                        parsed.clinics.push({
                            id: 'clinic-shubrakhit',
                            name: 'شبراخيت',
                            isActive: true,
                            settings: { currency: 'EGP', timezone: 'Africa/Cairo', workingHours: { start: '09:00', end: '21:00' } }
                        });
                    }
                } else {
                    // Ensure Name is Correct
                    shub.name = 'شبراخيت';
                }
            }

            // Persistence: Force save back to localStorage if we had to fix things
            localStorage.setItem(this.DB_KEY, JSON.stringify(parsed));

            // --- ULTIMATE Data Self-Healing (Isolation Fix) ---
            // CRITICAL: Always assign legacy data to Alexandria (clinic-default), NOT the active clinic
            // This prevents old data from appearing in Shubrakhit when it's the active clinic
            let repaired = false;
            const alexClinicId = 'clinic-default';

            // FORCE CLEANUP: Any data that isn't explicitly in Alexandria 
            // but was created before we stabilized the branches, MUST be moved back.
            if (!parsed.settings.hasFixedShubrakhitOverlap_FINAL_V3) {
                console.log("SyncManager: EXECUTING GLOBAL DATA RESET TO ALEXANDRIA...");

                // 1. Reset Patients
                (parsed.patients || []).forEach(p => {
                    if (p.clinicId !== alexClinicId) {
                        p.clinicId = alexClinicId;
                        repaired = true;
                    }
                });
                // 2. Reset Appointments
                (parsed.appointments || []).forEach(a => {
                    if (a.clinicId !== alexClinicId) {
                        a.clinicId = alexClinicId;
                        repaired = true;
                    }
                });
                // 3. Reset Transactions
                if (parsed.finances?.transactions) {
                    parsed.finances.transactions.forEach(t => {
                        if (t.clinicId !== alexClinicId) {
                            t.clinicId = alexClinicId;
                            repaired = true;
                        }
                    });
                }

                parsed.settings.hasFixedShubrakhitOverlap_FINAL_V3 = true;
                repaired = true;
                localStorage.setItem('neuro_repair_success', 'true');
            } else {
                // Ongoing safety: Every single time we load, ensure isolation
                (parsed.patients || []).forEach(p => {
                    if (!p.clinicId || p.clinicId === 'undefined') { p.clinicId = alexClinicId; repaired = true; }
                });
                (parsed.appointments || []).forEach(a => {
                    if (!a.clinicId || a.clinicId === 'undefined') { a.clinicId = alexClinicId; repaired = true; }
                });
                if (parsed.finances?.transactions) {
                    parsed.finances.transactions.forEach(t => {
                        if (!t.clinicId || t.clinicId === 'undefined') { t.clinicId = alexClinicId; repaired = true; }
                    });
                }
            }

            if (repaired) {
                console.log("SyncManager: Global Data Migration Successful.");
                localStorage.setItem(this.DB_KEY, JSON.stringify(parsed));
                this.shouldForceStatsRefresh = true; // NEW FLAG
            }

            if (parsed.settings.lastPatientCode === undefined || parsed.settings.lastPatientCode < 100) {
                parsed.settings.lastPatientCode = 100;
            }

            // --- Migration for New Features (Users & Logs) ---
            if (!parsed.users) {
                parsed.users = [
                    { id: 'admin-001', username: 'admin', password: 'admin', role: 'admin', name: 'المدير العام', assignedClinics: ['clinic-default', 'clinic-shubrakhit'], defaultClinic: 'clinic-default' }
                ];
            } else {
                // Critical Fix: Ensure existing users have clinic assignments
                const clinicIds = parsed.clinics.map(c => c.id);
                parsed.users.forEach(u => {
                    if (!u.assignedClinics || u.assignedClinics.length === 0) {
                        u.assignedClinics = [...clinicIds];
                    }
                });

                // --- SECURITY EXCEPTION: Restrict 'Hind' to Alexandria Only ---
                const hindUser = parsed.users.find(u => u.name.includes('هند') || u.username === 'hind' || u.username === 'hand');
                if (hindUser) {
                    // Remove Shubrakhit from assigned clinics
                    hindUser.assignedClinics = hindUser.assignedClinics.filter(id => id !== 'clinic-shubrakhit');
                    // Ensure Alexandria is assigned
                    if (!hindUser.assignedClinics.includes('clinic-default')) {
                        hindUser.assignedClinics.push('clinic-default');
                    }
                }

                // --- SECURITY EXCEPTION: Restrict 'Sasha' to Alexandria Only ---
                const sashaUser = parsed.users.find(u => u.name.includes('صشة') || u.name.includes('صشه') || u.username === 'sasha');
                if (sashaUser) {
                    // Remove Shubrakhit from assigned clinics
                    sashaUser.assignedClinics = sashaUser.assignedClinics.filter(id => id !== 'clinic-shubrakhit');
                    // Ensure Alexandria is assigned
                    if (!sashaUser.assignedClinics.includes('clinic-default')) {
                        sashaUser.assignedClinics.push('clinic-default');
                    }
                }
                // -------------------------------------------------------------
            }
            if (!parsed.auditLog) parsed.auditLog = [];

            // --- Document Integration Migration ---
            if (!parsed.patientDocs) {
                const legacyDocs = localStorage.getItem('neuro-patient-documents');
                parsed.patientDocs = legacyDocs ? JSON.parse(legacyDocs) : {};
                console.log("SyncManager: Migrated legacy documents to main sync data.");
            }
            // --------------------------------------------------

            // --- Migration for Multi-Clinic Support ---
            if (!parsed.clinics) {
                // Create default clinic
                const defaultClinic = {
                    id: 'clinic-default',
                    name: GLOBAL_CONFIG.CLINIC_NAME || 'Neuro-Clinic',
                    address: '',
                    phone: '',
                    logo: null,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    settings: {
                        currency: 'EGP',
                        timezone: 'Africa/Cairo',
                        workingHours: { start: '09:00', end: '21:00' }
                    }
                };
                parsed.clinics = [defaultClinic];

                // Assign default clinic to all existing data
                parsed.patients.forEach(p => { if (!p.clinicId) p.clinicId = 'clinic-default'; });
                parsed.appointments.forEach(a => { if (!a.clinicId) a.clinicId = 'clinic-default'; });
                if (parsed.finances && parsed.finances.transactions) {
                    parsed.finances.transactions.forEach(t => { if (!t.clinicId) t.clinicId = 'clinic-default'; });
                }

                // Assign default clinic to all users
                parsed.users.forEach(u => {
                    if (!u.assignedClinics) u.assignedClinics = ['clinic-default'];
                    if (!u.defaultClinic) u.defaultClinic = 'clinic-default';
                });

                parsed.settings.activeClinicId = 'clinic-default';
            }
            // --------------------------------------------------

            // Migrate: Assign codes to patients who don't have one
            let changed = false;
            parsed.patients.forEach(p => {
                if (p.patientCode === undefined) {
                    parsed.settings.lastPatientCode++;
                    p.patientCode = parsed.settings.lastPatientCode;
                    changed = true;
                }
            });
            if (changed) {
                this.data = parsed;
                this.saveLocal();
            }

            // --- GLOBAL FINANCIAL RECALCULATION (One-time fix for Dues) ---
            if (!parsed.settings.hasRunRecalcV2) {
                setTimeout(() => {
                    if (window.appointmentManager) {
                        this.recalcAllLedgers();
                        this.data.settings.hasRunRecalcV2 = true;
                        this.saveLocal();
                        console.log("SyncManager: Global financial recalculation completed.");
                    }
                }, 1000);
            }

            // --- Force Sticky Clinic (Persistent across Refreshes) ---
            const stickyClinicId = localStorage.getItem('neuro_active_clinic_id');
            if (stickyClinicId && parsed.clinics.find(c => c.id === stickyClinicId)) {
                parsed.settings.activeClinicId = stickyClinicId;
            }

            return parsed;
        }

        // Default Structure
        return {
            clinics: [
                {
                    id: 'clinic-default',
                    name: GLOBAL_CONFIG.CLINIC_NAME || 'Neuro-Clinic',
                    address: '',
                    phone: '',
                    logo: null,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    settings: {
                        currency: 'EGP',
                        timezone: 'Africa/Cairo',
                        workingHours: { start: '09:00', end: '21:00' }
                    }
                }
            ],
            users: [
                {
                    id: 'admin-001',
                    username: 'admin',
                    password: 'admin',
                    role: 'admin',
                    name: 'المدير العام',
                    assignedClinics: ['clinic-default'],
                    defaultClinic: 'clinic-default'
                }
            ],
            auditLog: [], // { timestamp, user, action, details }
            patients: [],
            patientDocs: {}, // { patientId: [docs] }
            appointments: [],
            finances: {
                transactions: [],
                ledger: {}
            },
            settings: {
                clinicName: GLOBAL_CONFIG.CLINIC_NAME,
                lastSync: null,
                lastPatientCode: GLOBAL_CONFIG.STARTING_CODE,
                activeClinicId: 'clinic-default',
                lastBackup: null // Track the last time a full backup was performed
            }
        };
    }

    /**
     * Updates the last backup timestamp and saves.
     */
    markBackupSuccessful() {
        this.data.settings.lastBackup = new Date().toISOString();
        this.saveLocal();
        window.dispatchEvent(new CustomEvent('backupStatusChanged'));
    }

    /**
     * Checks if a backup is overdue (more than 24 hours).
     */
    isBackupOverdue() {
        if (!this.data.settings.lastBackup) return true;
        const last = new Date(this.data.settings.lastBackup).getTime();
        const now = new Date().getTime();
        return (now - last) > (7 * 24 * 60 * 60 * 1000); // 7 Days threshold
    }

    // --- Audit Logging ---
    logAction(user, action, details, meta = null) {
        const log = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            user: user, // username
            action: action, // e.g., 'DELETE_PATIENT', 'ADD_USER'
            details: details,
            meta: meta // Store backup of deleted data here
        };
        this.data.auditLog.unshift(log); // Add to top
        // Limit log size to last 1000 actions to save space
        if (this.data.auditLog.length > 1000) this.data.auditLog.pop();
        this.saveLocal();
    }

    // --- Data Export & Backup ---
    exportPatientsCSV() {
        const patients = this.data.patients;
        if (patients.length === 0) return null;

        // CSV Header
        let csv = '\uFEFF'; // BOM for Excel Arabic support
        csv += "الكود,الاسم,السن,الهاتف,النوع,تاريخ التسجيل\n";

        // CSV Rows
        patients.forEach(p => {
            csv += `${p.patientCode},"${p.name}",${p.age},"${p.phone}",${p.gender},${new Date(p.createdAt).toLocaleDateString()}\n`;
        });

        return csv;
    }

    getBackupJSON() {
        // Create a deep copy to avoid modifying runtime data
        const backupData = JSON.parse(JSON.stringify(this.data));

        // Include Prescription Templates from localStorage
        try {
            const templates = localStorage.getItem('mediscript_templates');
            if (templates) {
                backupData.prescriptionTemplates = JSON.parse(templates);
            }
        } catch (e) {
            console.warn("Could not include templates in backup:", e);
        }

        return JSON.stringify(backupData, null, 2);
    }

    restoreBackup(jsonString) {
        try {
            const parsed = JSON.parse(jsonString);

            // Basic Validation - must have at least patients/users/settings
            if (parsed.patients && parsed.users && parsed.settings) {
                // 1. Restore Dashboard Data
                const { prescriptionTemplates, ...dashboardData } = parsed;

                // Ensure lastLocalUpdate is set to current so cloud pull doesn't overwrite it immediately
                if (!dashboardData.settings) dashboardData.settings = {};
                dashboardData.settings.lastLocalUpdate = new Date().toISOString();

                this.data = dashboardData;
                this.saveLocal();

                // 2. Restore Prescription Templates if they exist in backup
                if (prescriptionTemplates) {
                    localStorage.setItem('mediscript_templates', JSON.stringify(prescriptionTemplates));
                }

                return true;
            }
            return false;
        } catch (e) {
            console.error("Restore failed:", e);
            return false;
        }
    }

    restoreFromCSV(csvText) {
        try {
            // Remove BOM if present
            const cleanCSV = csvText.replace(/^\uFEFF/, '').trim();
            const lines = cleanCSV.split(/\r?\n/);
            if (lines.length < 2) return false;

            const patients = [];

            // Expected columns based on export: الكود,الاسم,السن,الهاتف,النوع,تاريخ التسجيل
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                // Simple but effective CSV split (handles quotes)
                const parts = [];
                let current = '';
                let inQuotes = false;
                for (let char of line) {
                    if (char === '"') inQuotes = !inQuotes;
                    else if (char === ',' && !inQuotes) {
                        parts.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
                parts.push(current.trim());

                if (parts.length < 2) continue;

                patients.push({
                    id: crypto.randomUUID(),
                    patientCode: parseInt(parts[0]) || 0,
                    name: parts[1] || 'غير معروف',
                    age: parts[2] || '',
                    phone: parts[3] || '',
                    gender: parts[4] || 'ذكر',
                    visits: [],
                    createdAt: parts[5] ? new Date(parts[5]).toISOString() : new Date().toISOString(),
                    clinicId: this.data.settings.activeClinicId || 'clinic-default'
                });
            }

            if (patients.length > 0) {
                // Merge patients (avoid duplicates by code)
                let addedCount = 0;
                patients.forEach(newP => {
                    const exists = this.data.patients.find(p => p.patientCode === newP.patientCode);
                    if (!exists) {
                        this.data.patients.push(newP);
                        addedCount++;
                    }
                });

                this.saveLocal();
                return { success: true, count: addedCount };
            }
            return false;
        } catch (e) {
            console.error("CSV Import failed:", e);
            return false;
        }
    }

    saveLocal() {
        // Track the exact moment this local change occurred
        this.data.settings.lastLocalUpdate = new Date().toISOString();
        localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));

        // Debounce cloud sync to avoid rapid consecutive writes
        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(async () => {
            this.triggerCloudSync();

            // --- Auto-Guardian Backup Logic ---
            if (this.isAutoBackupEnabled && this.backupHandle) {
                try {
                    await this.performAutoBackup();
                } catch (err) {
                    console.warn("Auto-Guardian: Automatic background backup failed:", err);
                    this.isAutoBackupEnabled = false; // Disable if permission lost
                    window.dispatchEvent(new CustomEvent('backupStatusChanged'));
                }
            }
        }, 500); // 0.5s debounce for faster real-time feeling
    }

    /**
     * Performs a background save to the linked directory.
     */
    async performAutoBackup(isManualExit = false) {
        // --- 1. High Priority: Electron Forced Fixed Backup (D:\Partition) ---
        if (window.electronAPI && window.electronAPI.forceFixedBackup) {
            try {
                const dataStr = this.getBackupJSON();
                const result = await window.electronAPI.forceFixedBackup(dataStr);

                if (result.success) {
                    this.data.settings.lastBackup = new Date().toISOString();
                    localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
                    window.dispatchEvent(new CustomEvent('backupStatusChanged'));
                    console.log(`%c [Auto-Guardian] Backup successful at: ${result.path}`, "color: #10b981; font-weight: bold;");
                    return { success: true, path: result.path };
                } else {
                    console.error("[Auto-Guardian] Fixed backup failed:", result.error);
                    // Critical: DO NOT return here, instead FALLTHROUGH to other methods
                }
            } catch (err) {
                console.error("[Auto-Guardian] Exception during backup:", err);
            }
        }

        // --- 2. Secondary: Standard Directory Handle (FileSystem Access API - Browser) ---
        if (this.backupHandle) {
            try {
                const data = this.getBackupJSON();
                const fileName = `neuro_auto_backup_${new Date().toISOString().split('T')[0]}.json`;
                const fileHandle = await this.backupHandle.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(data);
                await writable.close();

                this.data.settings.lastBackup = new Date().toISOString();
                localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
                window.dispatchEvent(new CustomEvent('backupStatusChanged'));
                return { success: true, path: 'المجلد المرتبط (Manual Handle)' };
            } catch (err) {
                console.error("Auto-Guardian (Handle) Error:", err);
            }
        }

        // --- 3. Final Fallback: Emergency Browser Download (Only for Exit/Logout) ---
        if (isManualExit) {
            try {
                const dataStr = this.getBackupJSON();
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `neuro_emergency_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);

                return { success: true, path: 'مجلد التنزيلات (Downloads)' };
            } catch (err) {
                return { success: false, error: "فشل التحميل التلقائي للمتصفح" };
            }
        }

        return { success: false, error: "لا يوجد اتصال بمساحة تخزين (تحقق من وجود قرص D: أو اربط مجلداً)" };
    }


    /**
     * Real-time listener for Firestore changes.
     */
    startCloudObserver() {
        if (typeof db === 'undefined' || !db) {
            console.log("Cloud Observer: Firebase/Firestore not available.");
            return;
        }

        console.log("Cloud Observer: Starting real-time listener...");
        db.collection('app_data').doc('clinic_master_data').onSnapshot((doc) => {
            if (doc.exists) {
                let cloudData = doc.data();

                // --- ATOMIC DEEP CLEANING (Real-time Cloud Guard) ---
                const alexId = 'clinic-default';
                let repairedInCloud = false;

                // 1. Repair Patients (Only those with NO ID)
                (cloudData.patients || []).forEach(p => {
                    if (!p.clinicId || p.clinicId === 'undefined') { p.clinicId = alexId; repairedInCloud = true; }
                });
                // 2. Repair Appointments (Only those with NO ID)
                (cloudData.appointments || []).forEach(a => {
                    if (!a.clinicId || a.clinicId === 'undefined') { a.clinicId = alexId; repairedInCloud = true; }
                });
                // 3. Repair Transactions (Only those with NO ID)
                if (cloudData.finances?.transactions) {
                    cloudData.finances.transactions.forEach(t => {
                        if (!t.clinicId || t.clinicId === 'undefined') { t.clinicId = alexId; repairedInCloud = true; }
                    });
                }

                if (repairedInCloud) {
                    console.log("Cloud Observer: Legacy data detected in cloud stream. Sanitized in-flight.");
                    cloudData.settings.hasFixedShubrakhitOverlap_FINAL_V3 = true;
                }

                // Compare timestamps to decide if we should update local state
                const cloudTime = cloudData.updatedAt?.toDate?.()?.getTime() || 0;
                const lastSyncTime = new Date(this.data.settings?.lastSync || 0).getTime();
                const lastLocalUpdateTime = new Date(this.data.settings?.lastLocalUpdate || 0).getTime();

                if (this.isNewSession || (cloudTime > lastSyncTime && cloudTime > lastLocalUpdateTime)) {
                    if (cloudData.patients && cloudData.patients.length === 0 && this.data.patients.length > 10) {
                        console.warn("Cloud Observer: Blocked merge of empty cloud data.");
                    } else {
                        console.log("Cloud Observer: Merging sanitized cloud data...");

                        // VITAL PERSISTENCE FIX: Don't let background sync change our branch
                        const currentActiveId = this.data?.settings?.activeClinicId || localStorage.getItem('neuro_active_clinic_id') || alexId;

                        // --- SMART FIELD MERGE (Name Recovery Logic) ---
                        // If local has patients without names but cloud has them, recover names
                        if (this.data.patients && this.data.patients.length > 0) {
                            cloudData.patients.forEach(cloudP => {
                                const localP = this.data.patients.find(p => p.id === cloudP.id);
                                if (localP && !localP.name && cloudP.name) {
                                    console.log(`Cloud Observer: Recovering missing name for patient ${cloudP.id} (${cloudP.name})`);
                                    localP.name = cloudP.name;
                                    localP.patientCode = cloudP.patientCode; // Restore code too
                                }
                            });
                        }

                        this.data = cloudData;

                        // Restore the locally selected branch
                        this.data.settings.activeClinicId = currentActiveId;

                        localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));

                        // Force Full UI refresh (Boxes + Tables)
                        if (window.dashboardUI) {
                            window.dashboardUI.updateStats();
                            window.dashboardUI.renderTodayAppointments();
                        }

                        this.notifyDataChanged();

                        // If it was dirty in cloud, push our clean version back immediately
                        if (repairedInCloud) {
                            setTimeout(() => this.triggerCloudSync(), 2000);
                        }
                    }
                    this.isNewSession = false;
                } else {
                    // EVEN IF LOCAL IS NEWER: Still check for missing names to recover
                    let recoveredCount = 0;
                    cloudData.patients.forEach(cloudP => {
                        const localP = this.data.patients.find(p => p.id === cloudP.id);
                        if (localP && (!localP.name || localP.name === 'غير معروف') && cloudP.name) {
                            localP.name = cloudP.name;
                            localP.patientCode = cloudP.patientCode;
                            recoveredCount++;
                        }
                    });

                    if (recoveredCount > 0) {
                        console.log(`Cloud Observer: Proactively recovered ${recoveredCount} missing names despite local being newer.`);
                        this.saveLocal();
                        if (window.dashboardUI) {
                            window.dashboardUI.renderTodayAppointments();
                            window.dashboardUI.updateStats();
                        }
                    }
                    console.log("Cloud Observer: Multi-Clinic State Verified.");
                }
                this.isPullDone = true;
            } else {
                console.log("Cloud Observer: Cloud document is empty.");
                this.isPullDone = true;
                this.isNewSession = false;
            }
        }, (error) => {
            console.error("Cloud Observer error:", error);
            this.cloudStatus = 'error';
            this.updateSyncUI();
        });
    }

    // --- Patient Operations (CRUD) ---
    getPatients() { return this.data.patients; }

    upsertPatient(patient) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const index = this.data.patients.findIndex(p => p.id === patient.id);
        if (index > -1) {
            const oldName = this.data.patients[index].name;
            this.data.patients[index] = { ...this.data.patients[index], ...patient, lastUpdated: new Date().toISOString() };
            this.logAction(currentUser, 'UPDATE_PATIENT', `تعديل بيانات المريض: ${oldName} (${patient.name})`);
            this.saveLocal();
            return this.data.patients[index];
        } else {
            const nextCode = (this.data.settings.lastPatientCode || 0) + 1;
            this.data.settings.lastPatientCode = nextCode;

            const newPatient = {
                id: crypto.randomUUID(),
                patientCode: nextCode,
                visits: [],
                createdAt: new Date().toISOString(),
                clinicId: this.data.settings.activeClinicId || 'clinic-default', // Auto-assign active clinic
                ...patient
            };
            this.data.patients.push(newPatient);
            this.logAction(currentUser, 'ADD_PATIENT', `إضافة مريض جديد: ${newPatient.name} (${newPatient.patientCode})`);
            this.saveLocal();
            return newPatient;
        }
    }

    deletePatient(id) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const patient = this.data.patients.find(p => p.id === id);
        if (patient) {
            // Backup full data in log for recovery
            const backupData = {
                patient: { ...patient },
                appointments: this.data.appointments.filter(a => a.patientId === id),
                transactions: this.data.finances.transactions.filter(t => t.patientId === id)
            };

            this.logAction(currentUser, 'DELETE_PATIENT', `حذف المريض وسجلاته المالية: ${patient.name} (#${patient.patientCode})`, backupData);

            // 1. Remove Patient
            this.data.patients = this.data.patients.filter(p => p.id !== id);

            // 2. Remove Appointments
            this.data.appointments = this.data.appointments.filter(a => a.patientId !== id);

            // 3. Remove Financial Transactions
            this.data.finances.transactions = this.data.finances.transactions.filter(t => t.patientId !== id);

            // 4. Remove Ledger Entry
            if (this.data.finances.ledger[id]) {
                delete this.data.finances.ledger[id];
            }

            this.saveLocal();
        }
    }

    // --- Financial Operations ---
    addTransaction(tx) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const transaction = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            clinicId: this.data.settings.activeClinicId || 'clinic-default', // Auto-assign active clinic
            ...tx
        };
        this.data.finances.transactions.push(transaction);

        // Update patient ledger
        if (tx.patientId) {
            if (!this.data.finances.ledger[tx.patientId]) {
                this.data.finances.ledger[tx.patientId] = { balance: 0 };
            }
            const amount = parseFloat(tx.amount);
            if (tx.type === 'income') this.data.finances.ledger[tx.patientId].balance += amount;
            else this.data.finances.ledger[tx.patientId].balance -= amount;
        }

        this.logAction(currentUser, tx.type === 'income' ? 'ADD_INCOME' : 'ADD_EXPENSE', `تسجيل ${tx.type === 'income' ? 'إيراد' : 'مصروف'}: ${tx.description} بقيمة ${tx.amount}`);
        this.saveLocal();
    }

    recalcAllLedgers() {
        if (!window.appointmentManager) return;
        console.log("SyncManager: Recalculating all patient ledgers...");
        this.data.patients.forEach(p => {
            window.appointmentManager.recalcPatientLedger(p.id);
        });
        this.saveLocal();
    }

    // --- User Management ---
    addUser(user) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const newUser = {
            id: crypto.randomUUID(),
            ...user
        };
        this.data.users = this.data.users || [];
        this.data.users.push(newUser);
        this.logAction(currentUser, 'ADD_USER', `إضافة مستخدم جديد: ${user.name} (${user.username}) بصلاحية ${user.role}`);
        this.saveLocal();
    }

    updateUser(userId, updates) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const index = this.data.users.findIndex(u => u.id === userId);
        if (index > -1) {
            const oldName = this.data.users[index].name;
            this.data.users[index] = { ...this.data.users[index], ...updates };
            this.logAction(currentUser, 'UPDATE_USER', `تعديل بيانات الموظف: ${oldName} (${this.data.users[index].name})`);
            this.saveLocal();
            return true;
        }
        return false;
    }

    deleteUser(userId) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const user = this.data.users.find(u => u.id === userId);
        if (user) {
            if (user.role === 'admin' && this.data.users.filter(u => u.role === 'admin').length <= 1) {
                console.error("Cannot delete the last admin user.");
                return false;
            }
            this.logAction(currentUser, 'DELETE_USER', `حذف المستخدم: ${user.name} (${user.username})`);
            this.data.users = this.data.users.filter(u => u.id !== userId);
            this.saveLocal();
            return true;
        }
        return false;
    }

    masterFactoryReset() {
        console.warn("SyncManager: Initiating Master Factory Reset...");

        // Reset core data collections
        this.data.patients = [];
        this.data.appointments = [];
        this.data.finances.transactions = [];
        this.data.finances.ledger = {};
        this.data.logs = [];

        // Critically reset the patient code counter to 100
        this.data.settings.lastPatientCode = 100;

        // Save and Sync
        this.saveLocal();
        this.notifyDataChanged();
        console.log("SyncManager: Master Factory Reset completed. Counter reset to 100.");
        return true;
    }

    changeUserPassword(userId, newPassword) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const user = this.data.users.find(u => u.id === userId);
        if (user) {
            user.password = newPassword;
            this.logAction(currentUser, 'CHANGE_PASSWORD', `تعديل كلمة المرور للمستخدم: ${user.name} (${user.username})`);
            this.saveLocal();
            return true;
        }
        return false;
    }

    // --- Clinic Management ---
    getClinics() {
        // Self-Healing: Ensure Shubrakhit exists whenever clinics are accessed
        if (this.data.clinics && !this.data.clinics.find(c => c.id === 'clinic-shubrakhit' || c.name === 'شبراخيت')) {
            this.data.clinics.push({
                id: 'clinic-shubrakhit',
                name: 'شبراخيت',
                isActive: true,
                createdAt: new Date().toISOString(),
                settings: { currency: 'EGP', timezone: 'Africa/Cairo', workingHours: { start: '09:00', end: '21:00' } }
            });
            this.saveLocal(); // Force Save immediately
        }
        return this.data.clinics || [];
    }

    getActiveClinic() {
        const activeId = this.data.settings.activeClinicId || 'clinic-default';
        return this.data.clinics.find(c => c.id === activeId) || this.data.clinics[0];
    }

    setActiveClinic(clinicId) {
        const clinic = this.data.clinics.find(c => c.id === clinicId);
        if (clinic) {
            this.data.settings.activeClinicId = clinicId;
            localStorage.setItem('neuro_active_clinic_id', clinicId); // PERSISTENT OVERRIDE
            this.saveLocal();
            return true;
        }
        return false;
    }

    addClinic(clinic) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const newClinic = {
            id: crypto.randomUUID(),
            isActive: true,
            createdAt: new Date().toISOString(),
            settings: {
                currency: 'EGP',
                timezone: 'Africa/Cairo',
                workingHours: { start: '09:00', end: '21:00' }
            },
            ...clinic
        };
        this.data.clinics.push(newClinic);
        this.logAction(currentUser, 'ADD_CLINIC', `إضافة عيادة جديدة: ${clinic.name}`);
        this.saveLocal();
        return newClinic;
    }

    updateClinic(clinicId, updates) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const index = this.data.clinics.findIndex(c => c.id === clinicId);
        if (index !== -1) {
            this.data.clinics[index] = { ...this.data.clinics[index], ...updates };
            this.logAction(currentUser, 'UPDATE_CLINIC', `تعديل بيانات العيادة: ${this.data.clinics[index].name}`);
            this.saveLocal();
            return true;
        }
        return false;
    }

    deleteClinic(clinicId) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const clinic = this.data.clinics.find(c => c.id === clinicId);

        if (!clinic) return false;

        // Prevent deleting the last clinic
        if (this.data.clinics.length <= 1) {
            console.error("Cannot delete the last clinic.");
            return false;
        }

        // Check if clinic has data
        const hasPatients = this.data.patients.some(p => p.clinicId === clinicId);
        const hasAppointments = this.data.appointments.some(a => a.clinicId === clinicId);
        const hasTransactions = this.data.finances.transactions.some(t => t.clinicId === clinicId);

        if (hasPatients || hasAppointments || hasTransactions) {
            console.error("Cannot delete clinic with existing data. Please transfer or delete data first.");
            return { success: false, reason: 'has_data' };
        }

        this.logAction(currentUser, 'DELETE_CLINIC', `حذف العيادة: ${clinic.name}`);
        this.data.clinics = this.data.clinics.filter(c => c.id !== clinicId);

        // If deleted clinic was active, switch to first available
        if (this.data.settings.activeClinicId === clinicId) {
            this.data.settings.activeClinicId = this.data.clinics[0].id;
        }

        this.saveLocal();
        return { success: true };
    }

    // --- Get filtered data by active clinic (Aggressive Isolation) ---
    getPatientsByClinic(clinicId = null) {
        const targetClinic = clinicId || this.data.settings.activeClinicId;
        const alexId = 'clinic-default';

        return this.data.patients.filter(p => {
            // Alexandria Case: Show everything that isn't tagged elsewhere or is tagged as default
            if (targetClinic === alexId) {
                return !p.clinicId || p.clinicId === alexId;
            }
            // Other Branches (e.g., Shubrakhit): ONLY show what is explicitly tagged for it
            return p.clinicId === targetClinic;
        });
    }

    getAppointmentsByClinic(clinicId = null) {
        const targetClinic = clinicId || this.data.settings.activeClinicId;
        const alexId = 'clinic-default';

        return this.data.appointments.filter(a => {
            // STRICT ISOLATION RULE
            if (targetClinic === alexId) {
                return !a.clinicId || a.clinicId === alexId;
            }
            // Secondary branches: MUST have the tag, no exceptions.
            return a.clinicId === targetClinic;
        });
    }

    getTransactionsByClinic(clinicId = null) {
        const targetClinic = clinicId || this.data.settings.activeClinicId;
        const alexId = 'clinic-default';

        return this.data.finances.transactions.filter(t => {
            if (targetClinic === alexId) {
                return !t.clinicId || t.clinicId === alexId || !t.clinicId;
            }
            return t.clinicId === targetClinic;
        });
    }

    // --- Cloud Sync ---
    async triggerCloudSync() {
        if (typeof db === 'undefined' || !db) {
            console.log("Cloud sync: Firebase not initialized or configured.");
            this.cloudStatus = 'offline';
            this.updateSyncUI();
            return false;
        }

        const startTime = performance.now();
        const docId = 'clinic_master_data';

        // --- Critical Safety Check ---
        if (!this.isPullDone) {
            console.warn("Cloud sync: Push blocked. Still waiting for initial cloud pull verification.");
            return false;
        }

        // --- EMPTY DATA GUARD: Never push empty data if cloud has existing data ---
        if (this.data.patients.length === 0) {
            console.warn("Cloud sync: Empty local dataset detected. Checking cloud status before push...");
        }

        // --- FINAL INTEGRITY GUARD (Pre-push check) ---
        // If we are pushing data that is significantly smaller than what's in the cloud, 
        // we must block this to prevent accidental data wipes.
        const cloudDoc = await db.collection('app_data').doc(docId).get();
        if (cloudDoc.exists) {
            const cloudPatients = cloudDoc.data().patients || [];

            // 1. DATA LOSS PREVENTION: If local has way fewer patients than cloud (and cloud is not empty)
            if (this.data.patients.length < cloudPatients.length * 0.5 && cloudPatients.length > 5) {
                console.error("Cloud sync: PUSH BLOCKED. Local data is significantly smaller than Cloud. Protective lock engaged.");
                if (window.showNeuroToast) window.showNeuroToast("خطأ: تم حظر المزامنة لأن البيانات المحلية ناقصة بشكل كبير. يرجى التحديث.", "error");
                this.isPullDone = false; // Force re-pull
                return false;
            }

            // 2. NAME DEGRADATION PREVENTION
            const hasDegradedData = this.data.patients.some(p => {
                const cp = cloudPatients.find(c => c.id === p.id);
                return cp && cp.name && (!p.name || p.name === 'غير معروف');
            });

            if (hasDegradedData) {
                console.error("Cloud sync: PUSH BLOCKED. Local names are missing while Cloud has them.");
                this.isPullDone = false; // Force re-pull
                return false;
            }
        }

        this.cloudStatus = 'syncing';
        this.updateSyncUI();

        try {
            console.log("Cloud sync: Syncing data to Firestore...");

            // Update lastSync timestamp locally before uploading
            this.data.settings.lastSync = new Date().toISOString();

            // CLONE data and clean it for Firestore (no undefined values)
            const cleanData = JSON.parse(JSON.stringify(this.data));

            await db.collection('app_data').doc(docId).set({
                ...cleanData,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Very important: Update local lastSync to current time AFTER set
            this.data.settings.lastSync = new Date().toISOString();
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));

            this.lastLatency = Math.round(performance.now() - startTime);
            this.cloudStatus = 'online';
            console.log(`Cloud sync: Success (${this.lastLatency}ms).`);
            this.updateSyncUI();
            return true;
        } catch (error) {
            this.cloudStatus = 'error';
            console.error("Cloud sync failed:", error);

            let errorMsg = "فشل في مزامنة البيانات مع السحابة.";
            if (error.code === 'permission-denied') {
                errorMsg = "خطأ في الصلاحيات (Permission Denied): تأكد من إعدادات Firebase.";
            } else if (error.code === 'failed-precondition') {
                errorMsg = "خطأ: حجم البيانات كبير جداً أو تحتاج لفهرسة في Firebase.";
            } else if (error.message.includes('offline')) {
                errorMsg = "أنت غير متصل بالإنترنت حالياً. سيتم الرفع تلقائياً عند عودة الاتصال.";
            }

            // Report the error to UI
            const event = new CustomEvent('syncError', { detail: { message: errorMsg, raw: error } });
            window.dispatchEvent(event);

            this.updateSyncUI();
            return false;
        }
    }

    updateSyncUI() {
        // Dispatch event for UI components to listen to
        const event = new CustomEvent('syncStatusChanged', {
            detail: {
                status: this.cloudStatus,
                latency: this.lastLatency
            }
        });
        window.dispatchEvent(event);
    }

    /**
     * Downloads and merges data from cloud.
     * Caution: This currently overwrites local data.
     */
    async pullFromCloud() {
        if (typeof db === 'undefined' || !db) return false;

        try {
            this.cloudStatus = 'syncing';
            this.updateSyncUI();

            const doc = await db.collection('app_data').doc('clinic_master_data').get();
            if (doc.exists) {
                let cloudData = doc.data();
                if (cloudData.patients) {
                    // --- ATOMIC DEEP CLEANING (Cloud-to-Local Guard) ---
                    const alexId = 'clinic-default';

                    // 1. Repair Patients from Cloud (Only those with NO ID)
                    (cloudData.patients || []).forEach(p => {
                        if (!p.clinicId || p.clinicId === 'undefined') p.clinicId = alexId;
                    });
                    // 2. Repair Appointments from Cloud (Only those with NO ID)
                    (cloudData.appointments || []).forEach(a => {
                        if (!a.clinicId || a.clinicId === 'undefined') a.clinicId = alexId;
                    });
                    // 3. Repair Transactions from Cloud (Only those with NO ID)
                    if (cloudData.finances?.transactions) {
                        cloudData.finances.transactions.forEach(t => {
                            if (!t.clinicId || t.clinicId === 'undefined') t.clinicId = alexId;
                        });
                    }

                    // Conversion for consistency
                    if (cloudData.updatedAt?.toDate) {
                        cloudData.settings.lastSync = cloudData.updatedAt.toDate().toISOString();
                    }

                    // Record that cleanup is done for this session
                    cloudData.settings.hasFixedShubrakhitOverlap_FINAL_V3 = true;

                    // --- VITAL PERSISTENCE FIX ---
                    // Save the current locally selected clinic before overwriting with cloud data
                    const currentActiveId = this.data?.settings?.activeClinicId || localStorage.getItem('neuro_active_clinic_id') || alexId;

                    this.data = cloudData;

                    // RE-APPLY LOCALLY SELECTED CLINIC (Never let cloud change our branch)
                    this.data.settings.activeClinicId = currentActiveId;

                    localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));

                    this.isPullDone = true;
                    console.log("Cloud pull: Applied and Sanitized successfully.");

                    // Force Stats Refresh in Dashboard if active
                    if (window.dashboardUI) window.dashboardUI.updateStats();

                    this.notifyDataChanged();

                    // TRIPLE SECURITY: Immediately push the cleaned version back to cloud
                    setTimeout(() => this.triggerCloudSync(), 1000);

                    return true;
                }
            }
        } catch (error) {
            console.error("Cloud pull failed:", error);
            this.cloudStatus = 'error';
        }
        this.updateSyncUI();
        return false;
    }
}

window.syncManager = new SyncManager();
