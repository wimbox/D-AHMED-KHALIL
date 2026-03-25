/**
 * SyncManager: Handles local data with background cloud sync preparation.
 * Supports CRUD operations with offline persistence.
 */

// --- إعدادات النظام ---
const GLOBAL_CONFIG = {
    STARTING_CODE: 100,
    CLINIC_NAME: 'الاسكندرية'
};

class SyncManager {
    constructor() {
        this.DB_KEY = 'neuro_clinic_data_v1';
        this.data = this.loadLocal();
        this.isNewSession = !localStorage.getItem(this.DB_KEY);
        this.isPullDone = false;
        this.syncQueue = [];
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
        setTimeout(() => this.startCloudObserver(), 300);
    }

    notifyDataChanged() {
        window.dispatchEvent(new CustomEvent('syncDataRefreshed', { detail: this.data }));
    }

    loadLocal() {
        const saved = localStorage.getItem(this.DB_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            const alexId = 'clinic-default';
            if (!parsed.clinics) parsed.clinics = [{ id: alexId, name: 'الاسكندرية', isActive: true }];
            if (!parsed.settings) parsed.settings = { activeClinicId: alexId };
            return parsed;
        }
        return {
            patients: [],
            appointments: [],
            finances: { transactions: [], ledger: {} },
            settings: { lastPatientCode: 100, activeClinicId: 'clinic-default' },
            logs: [],
            clinics: [{ id: 'clinic-default', name: 'الاسكندرية', isActive: true }]
        };
    }

    saveLocal() {
        this.data.settings.lastLocalUpdate = new Date().toISOString();
        localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));

        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(async () => {
            this.triggerCloudSync();
        }, 500);
    }

    async triggerCloudSync() {
        if (typeof db === 'undefined' || !db) return false;
        
        try {
            this.dispatchSyncStatus('syncing');
            const startTime = performance.now();
            const docId = 'clinic_master_data';

            this.data.settings.lastSync = new Date().toISOString();
            
            // AGGRESSIVE TRIM: Keep only last 50 logs to ensure it fits under 1MB
            if (this.data.logs && this.data.logs.length > 50) {
                this.data.logs = this.data.logs.slice(0, 50);
            }
            if (this.data.auditLog && this.data.auditLog.length > 50) {
                this.data.auditLog = this.data.auditLog.slice(0, 50);
            }

            const cleanPayload = JSON.parse(JSON.stringify(this.data));
            
            // Size Check for Console
            const size = new Blob([JSON.stringify(cleanPayload)]).size;
            console.log(`Sync Manager: Payload Size is ${(size / 1024).toFixed(1)} KB`);

            await db.collection('app_data').doc(docId).set({
                ...cleanPayload,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.lastLatency = Math.round(performance.now() - startTime);
            this.dispatchSyncStatus('online', this.lastLatency);
            return true;
        } catch (error) {
            console.error("Cloud sync failed:", error);
            this.dispatchSyncStatus('error');
            return false;
        }
    }

    startCloudObserver() {
        if (typeof db === 'undefined' || !db) return;
        db.collection('app_data').doc('clinic_master_data').onSnapshot((doc) => {
            if (doc.exists) {
                const cloudData = doc.data();
                const cloudTime = cloudData.updatedAt?.toDate?.()?.getTime() || 0;
                const lastLocalUpdate = new Date(this.data.settings?.lastLocalUpdate || 0).getTime();

                if (this.isNewSession || cloudTime > lastLocalUpdate) {
                    this.data = cloudData;
                    localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
                    this.notifyDataChanged();
                }
                this.dispatchSyncStatus('online');
            }
            this.isNewSession = false;
        }, (err) => this.dispatchSyncStatus('error'));
    }

    dispatchSyncStatus(status, latency = 0) {
        this.cloudStatus = status;
        this.lastLatency = latency;
        window.dispatchEvent(new CustomEvent('syncStatusChanged', { detail: { status, latency } }));
    }

    getPatients() { return this.data.patients || []; }
    getClinics() { return this.data.clinics || []; }
    getActiveClinic() {
        const id = this.data.settings?.activeClinicId || 'clinic-default';
        return this.data.clinics?.find(c => c.id === id) || this.data.clinics?.[0];
    }
    setActiveClinic(id) {
        if (!this.data.settings) this.data.settings = {};
        this.data.settings.activeClinicId = id;
        localStorage.setItem('neuro_active_clinic_id', id);
        this.saveLocal();
        return true;
    }
    getPatientsByClinic(clinicId = null) {
        const target = clinicId || this.data.settings?.activeClinicId || 'clinic-default';
        const alexId = 'clinic-default';
        return (this.data.patients || []).filter(p => (target === alexId) ? (!p.clinicId || p.clinicId === alexId) : p.clinicId === target);
    }
    getAppointmentsByClinic(clinicId = null) {
        const target = clinicId || this.data.settings?.activeClinicId || 'clinic-default';
        const alexId = 'clinic-default';
        return (this.data.appointments || []).filter(a => (target === alexId) ? (!a.clinicId || a.clinicId === alexId) : a.clinicId === target);
    }
    getTransactionsByClinic(clinicId = null) {
        const target = clinicId || this.data.settings?.activeClinicId || 'clinic-default';
        const alexId = 'clinic-default';
        return (this.data.finances?.transactions || []).filter(t => (target === alexId) ? (!t.clinicId || t.clinicId === alexId) : t.clinicId === target);
    }

    upsertPatient(patient) {
        const idx = (this.data.patients || []).findIndex(p => p.id === patient.id);
        if (idx > -1) {
            this.data.patients[idx] = { ...this.data.patients[idx], ...patient };
        } else {
            this.data.settings.lastPatientCode = (this.data.settings.lastPatientCode || 100) + 1;
            this.data.patients.push({ ...patient, id: crypto.randomUUID(), patientCode: this.data.settings.lastPatientCode, visits: [] });
        }
        this.saveLocal();
    }

    async pullFromCloud() {
        if (typeof db === 'undefined' || !db) return false;
        try {
            this.dispatchSyncStatus('syncing');
            const doc = await db.collection('app_data').doc('clinic_master_data').get();
            if (doc.exists) {
                this.data = doc.data();
                localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
                this.isPullDone = true;
                this.notifyDataChanged();
                this.dispatchSyncStatus('online');
                return true;
            }
        } catch (e) { this.dispatchSyncStatus('error'); }
        return false;
    }
}

window.syncManager = new SyncManager();
