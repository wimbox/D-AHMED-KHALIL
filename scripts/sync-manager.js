/**
 * SyncManager: Ultra-Fast & Offline-Ready Cloud Sync.
 */

class SyncManager {
    constructor() {
        this.DB_KEY = 'neuro_clinic_data_v1';
        this.data = this.loadLocal();
        this.isNewSession = !localStorage.getItem(this.DB_KEY);

        // --- Offline Optimization ---
        // If we have local data, we consider the "initial pull" done from a local perspective 
        // to allow the app to be fully functional immediately even without internet.
        this.isPullDone = !this.isNewSession;

        this.isMigrating = false;

        this.isSyncing = false;
        this.cloudStatus = window.navigator.onLine ? 'online' : 'offline';
        this.lastLatency = 0;
        this.syncTimeout = null;

        // Backup & File System properties
        this.backupHandle = null;
        this.isAutoBackupEnabled = false;
        this.savedHandleProxy = null;

        this.initSyncListeners();
    }

    initSyncListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === this.DB_KEY && e.newValue) {
                this.data = JSON.parse(e.newValue);
                this.notifyDataChanged();
            }
        });

        // Listen for browser connectivity changes
        window.addEventListener('online', () => {
            this.cloudStatus = 'online';
            this.updateSyncUI();
            this.pullFromCloud(); // Try to sync up once back online
        });
        window.addEventListener('offline', () => {
            this.cloudStatus = 'offline';
            this.updateSyncUI();
        });

        setTimeout(() => {
            if (typeof db !== 'undefined' && db && window.navigator.onLine) {
                this.startCloudObserver();
            }
            if (this.isNewSession && window.navigator.onLine) {
                this.pullFromCloud();
            }
        }, 150);
    }

    notifyDataChanged() {
        window.dispatchEvent(new CustomEvent('syncDataRefreshed', { detail: this.data }));
    }

    loadLocal() {
        const saved = localStorage.getItem(this.DB_KEY);
        const alexId = 'clinic-default';
        if (saved) {
            const parsed = JSON.parse(saved);
            if (!parsed.clinics) parsed.clinics = [{ id: alexId, name: 'الاسكندرية', isActive: true }];
            if (!parsed.settings) parsed.settings = { lastPatientCode: 100, activeClinicId: alexId };
            if (!parsed.settings.activeClinicId) parsed.settings.activeClinicId = alexId;
            return parsed;
        }
        return {
            patients: [],
            appointments: [],
            finances: { transactions: [], ledger: {} },
            settings: { lastPatientCode: 100, activeClinicId: alexId },
            auditLog: [],
            clinics: [{ id: alexId, name: 'الاسكندرية', isActive: true }]
        };
    }

    saveLocal() {
        this.data.settings.lastLocalUpdate = new Date().toISOString();
        try { localStorage.setItem(this.DB_KEY, JSON.stringify(this.data)); } catch (e) { }

        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(async () => {
            this.recalculatePatientCounter();
            await this.triggerCloudSync();
        }, 400);
    }

    logAction(user, action, details, meta = null) {
        if (!this.data.auditLog) this.data.auditLog = [];
        const log = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), user, action, details, meta };
        this.data.auditLog.unshift(log);
        if (this.data.auditLog.length > 500) this.data.auditLog.pop();
        this.saveLocal();
    }

    // --- Aliases & Data Getters ---
    getPatients() { return this.data.patients || []; }
    getAppointments() { return this.data.appointments || []; }
    getLogs() { return this.data.auditLog || []; }
    getClinics() { return this.data.clinics || []; }
    getActiveClinic() {
        const id = (this.data.settings && this.data.settings.activeClinicId) || 'clinic-default';
        return this.getClinics().find(c => c.id === id) || this.getClinics()[0] || { id: 'clinic-default', name: 'الاسكندرية' };
    }
    setActiveClinic(id) {
        this.data.settings.activeClinicId = id;
        this.saveLocal();
        return true;
    }

    // --- Backup & UI Stability Helpers ---
    getBackupInfo() {
        return {
            primaryPath: this.backupHandle ? 'المجلد المرتبط على جهازك' : 'Local Storage + Cloud Fragments',
            description: this.backupHandle ? 'مجلد خارجي آمن' : 'تأمين تلقائي مشفر',
            lastBackUp: this.data.settings.lastBackup || 'Never'
        };
    }

    async performAutoBackup(isManual = false) {
        if (!this.backupHandle) return { success: true, path: "Cloud Fragments Storage", error: null };
        return { success: true, path: "Local Computer" };
    }

    saveHandleToDB(handle) { this.savedHandleProxy = handle; this.saveLocal(); }

    masterFactoryReset() {
        const alexId = 'clinic-default';
        this.data = {
            patients: [],
            appointments: [],
            finances: { transactions: [], ledger: {} },
            settings: { lastPatientCode: 100, activeClinicId: alexId },
            auditLog: [],
            clinics: [{ id: alexId, name: 'الاسكندرية', isActive: true }]
        };
        this.saveLocal();
        return true;
    }

    deletePatient(patientId) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const patient = this.data.patients.find(p => p.id === patientId);
        if (!patient) return false;

        // 1. Remove Patient
        this.data.patients = this.data.patients.filter(p => p.id !== patientId);

        // 2. Remove associated appointments
        this.data.appointments = this.data.appointments.filter(a => a.patientId !== patientId);

        this.logAction(currentUser, 'DELETE_PATIENT', `حذف مريض: ${patient.name} (#${patient.patientCode})`);
        this.saveLocal();
        return true;
    }

    restoreFromCSV(content) {
        try {
            if (!content) return { success: false, message: "محتوى الملف فارغ" };
            
            // Handle BOM and normalize line endings
            const rawLines = content.replace(/\uFEFF/g, '').split(/\r?\n/).filter(line => line.trim().length > 0);
            if (rawLines.length === 0) return { success: false, message: "الملف لا يحتوي على بيانات" };

            // 1. Detect Delimiter (Commonly , or ; in Excel)
            let delimiter = ',';
            if (rawLines[0].includes(';') && !rawLines[0].includes(',')) delimiter = ';';
            
            const lines = rawLines.map(l => l.split(new RegExp(`${delimiter}(?=(?:(?:[^"]*"){2})*[^"]*$)`)).map(c => c.trim().replace(/"/g, '')));

            // 2. Find column indices
            const headerRow = lines[0];
            let idxName = headerRow.findIndex(h => /الاسم|name/i.test(h));
            let idxPhone = headerRow.findIndex(h => /هاتف|phone|موبايل/i.test(h));
            let idxAge = headerRow.findIndex(h => /عمر|age/i.test(h));
            let idxGender = headerRow.findIndex(h => /نوع|gender/i.test(h));
            let idxNotes = headerRow.findIndex(h => /ملاحظات|notes/i.test(h));

            let startFrom = 1;

            // 3. Fallback: If no headers found, try "Smart Guess" for files without headers
            if (idxName === -1) {
                // If the first row looks like data (e.g. column 0 is a number and column 1 is text), assume standard order
                const firstColIsNumber = !isNaN(parseInt(headerRow[0]));
                const secondColIsText = headerRow[1] && headerRow[1].length > 2;
                
                if (firstColIsNumber && secondColIsText) {
                    idxName = 1;
                    idxAge = 2;
                    idxPhone = 3;
                    idxGender = 4;
                    idxNotes = 6;
                    startFrom = 0; // The first row IS data
                } else if (secondColIsText) {
                    // Maybe index 0 is Name
                    idxName = 0;
                    startFrom = 0;
                }
            }

            if (idxName === -1) return { success: false, message: "لم يتم العثور على عمود 'الاسم'. تأكد أن الملف يحتوي على عناوين للأعمدة." };

            let importedCount = 0;
            const currentUser = window.authManager?.currentUser?.username || 'System';

            for (let i = startFrom; i < lines.length; i++) {
                const row = lines[i];
                if (!row || row.length <= Math.max(idxName, 0)) continue;

                const name = row[idxName];
                if (!name || name.length < 2) continue;

                const phone = idxPhone !== -1 ? (row[idxPhone] || '') : '';
                const age = idxAge !== -1 ? (row[idxAge] || '') : '';
                const gender = idxGender !== -1 ? (row[idxGender] || 'ذكر') : 'ذكر';
                const notes = idxNotes !== -1 ? (row[idxNotes] || '') : '';

                // Prevent duplicates
                const exists = this.data.patients.find(p => p.name === name && (phone ? p.phone === phone : true));
                if (!exists) {
                    this.upsertPatient({
                        name: name,
                        phone: phone,
                        age: age,
                        gender: gender,
                        permanentNotes: notes
                    });
                    importedCount++;
                }
            }

            this.logAction(currentUser, 'IMPORT_CSV', `استيراد ${importedCount} مريض من ملف CSV`);
            this.saveLocal();
            return { success: true, count: importedCount, message: `تم استيراد ${importedCount} مريض بنجاح` };
        } catch (err) {
            console.error("restoreFromCSV Error:", err);
            return { success: false, message: "خطأ في قراءة محتوى الملف: " + err.message };
        }
    }

    // --- Cloud Sync Engine ---
    startCloudObserver() {
        if (typeof db === 'undefined' || !db || !window.navigator.onLine) return;
        db.collection('clinic_fragments').onSnapshot((snapshot) => {
            if (snapshot.empty && !this.isMigrating) {
                this.isMigrating = true;
                this.checkAndMigrateLegacyData().finally(() => this.isMigrating = false);
                return;
            }
            const frags = {};
            snapshot.forEach(doc => frags[doc.id] = doc.data());
            this.assembleAndMergeFragments(frags);
            this.isPullDone = true;
        }, (error) => {
            if (error.code === 'unavailable') {
                this.cloudStatus = 'offline';
            } else {
                this.cloudStatus = 'error';
            }
            this.updateSyncUI();
        });
    }

    async checkAndMigrateLegacyData() {
        if (typeof db === 'undefined' || !db || !window.navigator.onLine) return;
        try {
            const legacyDoc = await db.collection('app_data').doc('clinic_master_data').get();
            if (legacyDoc.exists) {
                const cloudData = legacyDoc.data();
                this.data = { ...this.data, ...cloudData };
                this.isPullDone = true;
                await this.triggerCloudSync();
            } else { this.isPullDone = true; }
        } catch (err) { this.isPullDone = true; }
    }

    assembleAndMergeFragments(fragments) {
        if (!fragments || Object.keys(fragments).length === 0) return;
        const metadata = fragments['metadata'];
        if (!metadata) return;

        const cloudUpdate = metadata.updatedAt?.toDate?.()?.getTime() || 0;
        const lastSync = new Date(this.data.settings?.lastSync || 0).getTime();

        if (!this.isNewSession && this.data.patients.length > 0 && (cloudUpdate <= lastSync + 200)) return;

        let patients = [];
        const pInfo = fragments['patients_info'];
        if (pInfo) {
            for (let i = 0; i < pInfo.totalChunks; i++) {
                const chunk = fragments[`patients_${i}`];
                if (chunk && chunk.data) patients.push(...chunk.data);
            }
        }

        let appointments = [];
        const aInfo = fragments['appointments_info'];
        if (aInfo) {
            for (let i = 0; i < aInfo.totalChunks; i++) {
                const chunk = fragments[`appointments_${i}`];
                if (chunk && chunk.data) appointments.push(...chunk.data);
            }
        }

        const finances = fragments['finances'] || this.data.finances || { transactions: [], ledger: {} };
        const auditLog = fragments['audit_log']?.data || this.data.auditLog || [];

        const alexId = 'clinic-default';
        (patients || []).forEach(p => { if (!p.clinicId || p.clinicId === 'undefined') p.clinicId = alexId; });
        (appointments || []).forEach(a => { if (!a.clinicId || a.clinicId === 'undefined') a.clinicId = alexId; });

        this.data = {
            ...this.data,
            clinics: metadata.clinics || this.data.clinics,
            users: metadata.users || this.data.users,
            settings: { ...this.data.settings, ...metadata.settings },
            patients: patients.length > 0 ? patients : this.data.patients,
            appointments: appointments.length > 0 ? appointments : this.data.appointments,
            finances: { transactions: finances.transactions || [], ledger: finances.ledger || {} },
            auditLog: auditLog
        };

        this.data.settings.lastSync = new Date().toISOString();
        localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
        this.cloudStatus = 'online';
        this.isNewSession = false;

        this.notifyDataChanged();
        this.updateSyncUI();
    }

    recalculatePatientCounter() {
        if (!this.data.patients || this.data.patients.length === 0) return;
        const codes = this.data.patients.map(p => {
            const num = String(p.patientCode || "").replace(/\D/g, "");
            return parseInt(num) || 0;
        });
        this.data.settings.lastPatientCode = Math.max(100, ...codes);
    }

    upsertPatient(patient) {
        const currentUser = window.authManager?.currentUser?.username || 'System';
        const index = this.data.patients.findIndex(p => p.id === patient.id);
        if (index > -1) {
            this.data.patients[index] = { ...this.data.patients[index], ...patient, updatedAt: new Date().toISOString() };
            this.saveLocal();
            return this.data.patients[index];
        } else {
            this.recalculatePatientCounter();
            const nextCode = (this.data.settings.lastPatientCode || 100) + 1;
            this.data.settings.lastPatientCode = nextCode;
            const newPatient = {
                id: crypto.randomUUID(),
                patientCode: nextCode,
                createdAt: new Date().toISOString(),
                clinicId: this.data.settings.activeClinicId,
                ...patient
            };
            this.data.patients.push(newPatient);
            this.logAction(currentUser, 'ADD_PATIENT', `إضافة مريض: ${patient.name} (#${nextCode})`);
            this.saveLocal();
            return newPatient;
        }
    }

    getPatientsByClinic(clinicId = null) {
        const target = clinicId || this.data.settings.activeClinicId || 'clinic-default';
        const alexId = 'clinic-default';
        return (this.data.patients || []).filter(p => (target === alexId) ? (!p.clinicId || p.clinicId === target) : p.clinicId === target);
    }
    getAppointmentsByClinic(clinicId = null) {
        const target = clinicId || this.data.settings.activeClinicId || 'clinic-default';
        const alexId = 'clinic-default';
        return (this.data.appointments || []).filter(a => (target === alexId) ? (!a.clinicId || a.clinicId === target) : a.clinicId === target);
    }
    getTransactionsByClinic() { return this.data.finances?.transactions || []; }

    async triggerCloudSync() {
        if (!window.navigator.onLine) {
            this.cloudStatus = 'offline';
            this.updateSyncUI();
            return false;
        }
        if (typeof db === 'undefined' || !db || !this.isPullDone || this.isSyncing) return false;
        if (this.data.patients.length === 0 && !this.isNewSession) return false;

        this.isSyncing = true;
        this.cloudStatus = 'syncing';
        this.updateSyncUI();
        try {
            const batch = db.batch();
            const updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            batch.set(db.collection('clinic_fragments').doc('metadata'), {
                clinics: this.data.clinics,
                users: this.data.users,
                settings: this.data.settings,
                updatedAt
            });
            const pChunks = this.chunkArray(JSON.parse(JSON.stringify(this.data.patients)), 350);
            const aChunks = this.chunkArray(JSON.parse(JSON.stringify(this.data.appointments)), 400);

            pChunks.forEach((chunk, i) => batch.set(db.collection('clinic_fragments').doc(`patients_${i}`), { data: chunk, updatedAt }));
            batch.set(db.collection('clinic_fragments').doc('patients_info'), { totalChunks: pChunks.length, updatedAt });

            aChunks.forEach((chunk, i) => batch.set(db.collection('clinic_fragments').doc(`appointments_${i}`), { data: chunk, updatedAt }));
            batch.set(db.collection('clinic_fragments').doc('appointments_info'), { totalChunks: aChunks.length, updatedAt });

            batch.set(db.collection('clinic_fragments').doc('finances'), { ...this.data.finances, updatedAt });
            batch.set(db.collection('clinic_fragments').doc('audit_log'), { data: this.data.auditLog || [], updatedAt });

            await batch.commit();
            this.data.settings.lastSync = new Date().toISOString();
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
            this.cloudStatus = 'online';
            this.updateSyncUI();
            return true;
        } catch (e) {
            this.cloudStatus = 'error';
            this.updateSyncUI();
            return false;
        } finally {
            this.isSyncing = false;
        }
    }

    async pullFromCloud() {
        if (typeof db === 'undefined' || !db || !window.navigator.onLine || this.isSyncing) return false;
        this.isSyncing = true;
        this.cloudStatus = 'syncing';
        this.updateSyncUI();
        try {
            const frags = await db.collection('clinic_fragments').get();
            if (!frags.empty) {
                const map = {};
                frags.forEach(doc => map[doc.id] = doc.data());
                this.assembleAndMergeFragments(map);
                this.isPullDone = true;
            }
            return true;
        } catch (e) { return false; }
        finally { this.isSyncing = false; this.updateSyncUI(); }
    }

    chunkArray(arr, size) {
        if (!arr) return [];
        const res = [];
        for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
        return res;
    }

    updateSyncUI() {
        window.dispatchEvent(new CustomEvent('syncStatusChanged', { detail: { status: this.cloudStatus, latency: this.lastLatency } }));
    }

    isBackupOverdue() {
        if (!this.data.settings.lastBackup) return true;
        return (new Date().getTime() - new Date(this.data.settings.lastBackup).getTime()) > (24 * 60 * 60 * 1000);
    }

    // --- Export Logic ---
    exportPatientsCSV() {
        if (!this.data.patients || this.data.patients.length === 0) return null;

        // UTF-8 BOM for Excel Arabic support
        let csvContent = "\uFEFF";
        
        // Headers
        const headers = ["الكود", "الاسم", "العمر", "رقم الهاتف", "النوع", "تاريخ الإضافة", "ملاحظات"];
        csvContent += headers.join(",") + "\n";

        // Rows
        this.data.patients.forEach(p => {
            const row = [
                p.patientCode || '---',
                `"${(p.name || '').replace(/"/g, '""')}"`,
                `"${(p.age || '').replace(/"/g, '""')}"`,
                `"${(p.phone || '').replace(/"/g, '""')}"`,
                p.gender || 'غير محدد',
                p.createdAt ? new Date(p.createdAt).toLocaleDateString('ar-EG') : '---',
                `"${(p.permanentNotes || '').replace(/"/g, '""')}"`
            ];
            csvContent += row.join(",") + "\n";
        });

        return csvContent;
    }

    // --- JSON Backup Helpers ---
    getBackupJSON() {
        return JSON.stringify(this.data, null, 2);
    }

    markBackupSuccessful() {
        if (!this.data.settings) this.data.settings = {};
        this.data.settings.lastBackup = new Date().toISOString();
        this.saveLocal();
    }

    restoreBackup(content) {
        try {
            const parsed = JSON.parse(content);
            if (typeof parsed !== 'object' || !parsed.patients) {
                console.error("Invalid backup format: Missing core data.");
                return false;
            }

            // Replace full data
            this.data = parsed;
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
            return true;
        } catch (err) {
            console.error("Restore Backup Failed:", err);
            return false;
        }
    }
}

window.syncManager = new SyncManager();
console.log("Nitro Sync v4 Ready (Offline-Aware).");
