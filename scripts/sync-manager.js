/**
 * SyncManager: Optimized for Ultra-Fast Fragmented Cloud Sync.
 * Handles local-first data with background fragmented Firestore synchronization.
 */

class SyncManager {
    constructor() {
        this.DB_KEY = 'neuro_clinic_data_v1';
        this.data = this.loadLocal();
        this.isNewSession = !localStorage.getItem(this.DB_KEY);
        this.isPullDone = false; 
        this.isMigrating = false;
        this.isSyncing = false;
        this.cloudStatus = 'offline';
        this.lastLatency = 0;
        this.syncTimeout = null;

        this.initSyncListeners();
    }

    initSyncListeners() {
        window.addEventListener('storage', (e) => {
            if (e.key === this.DB_KEY && e.newValue) {
                this.data = JSON.parse(e.newValue);
                this.notifyDataChanged();
            }
        });
        // Faster Initialization (150ms instead of 1000ms)
        setTimeout(() => {
            this.startCloudObserver();
            if (this.isNewSession) this.pullFromCloud();
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
        try { localStorage.setItem(this.DB_KEY, JSON.stringify(this.data)); } catch (e) {}
        
        // Faster Debounce (400ms instead of 800ms)
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

    // --- Aliases for better compatibility ---
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

    startCloudObserver() {
        if (typeof db === 'undefined' || !db) return;
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
            this.cloudStatus = 'error';
            this.updateSyncUI();
        });
    }

    async checkAndMigrateLegacyData() {
        if (typeof db === 'undefined' || !db) return;
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
        
        // Fast skip if local is already fresh
        if (!this.isNewSession && this.data.patients.length > 0 && (cloudUpdate <= lastSync + 100)) return;

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
            finances: {
                transactions: finances.transactions || [],
                ledger: finances.ledger || {}
            },
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
        if (typeof db === 'undefined' || !db || !this.isPullDone || this.isSyncing) return false;
        
        // Safety lock: Don't push if local data is empty but we should have records
        if (this.data.patients.length === 0 && !this.isNewSession) return false;

        this.isSyncing = true;
        this.cloudStatus = 'syncing';
        this.updateSyncUI();
        try {
            const batch = db.batch();
            const updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            const clean = JSON.parse(JSON.stringify(this.data));

            batch.set(db.collection('clinic_fragments').doc('metadata'), {
                clinics: clean.clinics,
                users: clean.users,
                settings: clean.settings,
                updatedAt
            });

            // Optimized Chunks: 350 per fragment for faster uploads
            const pChunks = this.chunkArray(clean.patients, 350);
            pChunks.forEach((chunk, i) => batch.set(db.collection('clinic_fragments').doc(`patients_${i}`), { data: chunk, updatedAt }));
            batch.set(db.collection('clinic_fragments').doc('patients_info'), { totalChunks: pChunks.length, updatedAt });

            const aChunks = this.chunkArray(clean.appointments, 400);
            aChunks.forEach((chunk, i) => batch.set(db.collection('clinic_fragments').doc(`appointments_${i}`), { data: chunk, updatedAt }));
            batch.set(db.collection('clinic_fragments').doc('appointments_info'), { totalChunks: aChunks.length, updatedAt });

            batch.set(db.collection('clinic_fragments').doc('finances'), { ...clean.finances, updatedAt });
            batch.set(db.collection('clinic_fragments').doc('audit_log'), { data: clean.auditLog || [], updatedAt });

            await batch.commit();
            this.data.settings.lastSync = new Date().toISOString();
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
            this.cloudStatus = 'online';
            return true;
        } catch (e) {
            this.cloudStatus = 'error';
            return false;
        } finally {
            this.isSyncing = false;
            this.updateSyncUI();
        }
    }

    async pullFromCloud() {
        if (typeof db === 'undefined' || !db || this.isSyncing) return false;
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
                return true;
            }
            return false;
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
}

window.syncManager = new SyncManager();
console.log("Nitro Sync Ready.");
