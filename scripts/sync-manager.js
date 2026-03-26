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
        this.isMigrating = false;
        this.syncQueue = []; 
        this.isSyncing = false;
        this.hasDirtyData = false; // Flag to track changes during sync

        this.backupHandle = null; // System directory handle for Auto-Guardian
        this.isAutoBackupEnabled = false;
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
        // 2. Cross-Device Sync: Initialize Fragmented Observer
        // Aggressive initialization
        setTimeout(() => {
            console.log("[SyncManager] Initializing Cloud Observer...");
            this.startCloudObserver();
            // Force an initial pull if session is new
            if (this.isNewSession) {
                console.log("[SyncManager] New session detected, forcing cloud pull...");
                this.pullFromCloud();
            }
        }, 1000);
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
        try {
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("SyncManager: Failed to save to localStorage. Quota exceeded or invalid data.", e);
            if (window.showNeuroToast) {
                window.showNeuroToast("تنبيه: مساحة تخزين المتصفح ممتلئة بشدة! بعض البيانات قد لا تحفظ مؤقتاً، تأكد من اتصال الإنترنت.", "warning");
            }
        }

        if (this.syncTimeout) clearTimeout(this.syncTimeout);
        this.syncTimeout = setTimeout(async () => {
            this.recalculatePatientCounter(); // Auto-fix numbering watermark before sync
            this.triggerCloudSync();
            
            // --- Auto-Guardian Backup Logic ---
            if (this.isAutoBackupEnabled && this.backupHandle) {
                try {
                    await this.performAutoBackup();
                } catch (err) {
                    console.warn("Auto-Guardian: Automatic background backup failed:", err);
                    this.isAutoBackupEnabled = false; 
                    window.dispatchEvent(new CustomEvent('backupStatusChanged'));
                }
            }
        }, 500); 

        // Mark as dirty for cloud sync
        this.hasDirtyData = true;
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
    /**
     * Real-time listener for Fragmented Firestore structure.
     * This bypasses the 1MB limit by merging multiple documents.
     */
    startCloudObserver() {
        if (typeof db === 'undefined' || !db) return;

        console.log("SyncManager: Fragmented Observer active (Collection: clinic_fragments)");
        
        db.collection('clinic_fragments').onSnapshot((snapshot) => {
            if (snapshot.empty && !this.isMigrating) {
                console.log("Cloud Observer: Fragment collection is empty. Checking migration...");
                this.isMigrating = true;
                this.checkAndMigrateLegacyData().finally(() => this.isMigrating = false);
                return;
            }

            const fragments = {};
            snapshot.forEach(doc => fragments[doc.id] = doc.data());

            // Process assembly
            this.assembleAndMergeFragments(fragments);
            
            this.updateSyncUI();
        }, (error) => {
            console.error("Cloud Observer error:", error);
            this.cloudStatus = 'error';
            this.updateSyncUI();
        });
    }

    async checkAndMigrateLegacyData() {
        if (typeof db === 'undefined' || !db) return;

        try {
            console.log("Migration: Checking legacy 1MB document...");
            const legacyDoc = await db.collection('app_data').doc('clinic_master_data').get();
            
            if (legacyDoc.exists) {
                const cloudData = legacyDoc.data();
                console.log("%c Migration: Legacy data located. Shattering into fragments...", "color: #00eaff; font-weight: bold;");

                // Populate local memory first to ensure fragmented push works
                this.data = { ...this.data, ...cloudData };
                
                // CRITICAL: Ensure key collections are present
                this.data.patients = this.data.patients || [];
                this.data.appointments = this.data.appointments || [];
                this.data.finances = this.data.finances || { transactions: [], ledger: {} };
                
                this.isPullDone = true;
                
                // Shatter into fragments and push to cloud
                const pushSuccess = await this.triggerCloudSync();
                if (pushSuccess) {
                    console.log("Migration: Successfully fragmented legacy data.");
                    // Mark as migrated locally
                    this.data.settings.hasMigratedToFragments = true;
                    this.saveLocal();
                }
            } else {
                console.log("Migration: No legacy data found.");
                this.isPullDone = true;
            }
        } catch (err) {
            console.error("Migration Failed:", err);
            this.isPullDone = true;
        }
    }

    assembleAndMergeFragments(fragments) {
        if (!fragments || Object.keys(fragments).length === 0) {
            this.isSyncing = false;
            this.updateSyncUI();
            return;
        }

        const keys = Object.keys(fragments);
        console.log(`%c [SyncManager] Reassembling Fragments: ${keys.length} chunks. Keys: [${keys.join(', ')}]`, "color: #00eaff;");
        
        const metadata = fragments['metadata'];
        if (!metadata) {
            console.warn("[SyncManager] Missing 'metadata' fragment. Attempting generic assembly...");
            this.isSyncing = false;
            this.updateSyncUI();
            // Optional: return if metadata is absolutely essential
        }
        if (!metadata) return;

        // Defensive data retrieval
        const incomingClinics = metadata.clinics || this.data.clinics || [];
        const incomingUsers = metadata.users || this.data.users || [];

        // Protection: Ignore empty incoming data if local is not empty
        if (incomingClinics.length === 0 && this.data.clinics.length > 0) return;

        const cloudTime = metadata.updatedAt?.toDate?.()?.getTime() || 0;
        const lastSyncTime = new Date(this.data.settings?.lastSync || 0).getTime();
        const lastLocalUpdateTime = new Date(this.data.settings?.lastLocalUpdate || 0).getTime();

        // MERGE CRITERIA: Always prefer Cloud if newer OR if local is effectively standard/empty
        // FORCE SYNC if patients are empty or if it's a new session
        const localPatientsCount = this.data.patients?.length || 0;
        
        if (this.isNewSession || localPatientsCount === 0 || (cloudTime > lastSyncTime - 1000)) { 
            console.log("%c [SyncManager] Cloud Observer: Syncing incoming data bits...", "color: #10b981; font-weight: bold;");

            // 1. Rebuild Patients
            let patients = [];
            const patientInfo = fragments['patients_info'];
            if (patientInfo) {
                for (let i = 0; i < patientInfo.totalChunks; i++) {
                    const chunk = fragments[`patients_${i}`];
                    if (chunk && chunk.data) patients.push(...chunk.data);
                }
            } else {
                patients = this.data.patients;
            }

            // 2. Rebuild Appointments
            let appointments = [];
            const apptInfo = fragments['appointments_info'];
            if (apptInfo) {
                for (let i = 0; i < apptInfo.totalChunks; i++) {
                    const chunk = fragments[`appointments_${i}`];
                    if (chunk && chunk.data) appointments.push(...chunk.data);
                }
            } else {
                appointments = this.data.appointments;
            }

            // 3. Rebuild patientDocs Fragments
            let patientDocs = {};
            const docInfo = fragments['patientdocs_info'];
            if (docInfo) {
                for (let i = 0; i < docInfo.totalChunks; i++) {
                    const chunk = fragments[`patientdocs_${i}`];
                    if (chunk && chunk.data) {
                        Object.assign(patientDocs, chunk.data);
                    }
                }
            } else {
                patientDocs = metadata.patientDocs || this.data.patientDocs || {};
            }

            // 4. Simple Fragments
            const finances = fragments['finances'] || this.data.finances;
            const auditLog = fragments['audit_log']?.data || this.data.auditLog;

            // 5. ATOMIC DEEP CLEANING (Real-time Cloud Guard)
            const alexId = 'clinic-default';
            (patients || []).forEach(p => { if (!p.clinicId || p.clinicId === 'undefined') p.clinicId = alexId; });
            (appointments || []).forEach(a => { if (!a.clinicId || a.clinicId === 'undefined') a.clinicId = alexId; });
            if (finances.transactions) {
                finances.transactions.forEach(t => { if (!t.clinicId || t.clinicId === 'undefined') t.clinicId = alexId; });
            }

            // 6. Update local memory and disk
            const currentActiveId = metadata.settings?.activeClinicId || this.data?.settings?.activeClinicId || localStorage.getItem('neuro_active_clinic_id');

            this.data = {
                ...this.data,
                clinics: incomingClinics.length > 0 ? incomingClinics : this.data.clinics,
                users: incomingUsers.length > 0 ? incomingUsers : this.data.users,
                settings: metadata.settings,
                patients: patients.length > 0 ? patients : this.data.patients,
                appointments: appointments.length > 0 ? appointments : this.data.appointments,
                finances,
                auditLog,
                patientDocs: Object.keys(patientDocs).length > 0 ? patientDocs : this.data.patientDocs
            };

            if (currentActiveId) this.data.settings.activeClinicId = currentActiveId;
            
            this.data.settings.lastSync = new Date().toISOString();
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
            
            this.cloudStatus = 'online';
            
            // UI Update with debouncing to avoid main thread blocking
            if (this.uiUpdateTimeout) clearTimeout(this.uiUpdateTimeout);
            this.uiUpdateTimeout = setTimeout(() => {
                this.notifyDataChanged();
                this.updateSyncUI();
            }, 100);

            // REFRESH TRIGGER
            if (this.isNewSession) {
                this.isNewSession = false;
                console.log("%c First session sync successful. Refreshing application state...", "color: #00eaff; font-weight: bold;");
                setTimeout(() => window.location.reload(), 1000);
            }
            
            if (window.dashboardUI) {
                window.dashboardUI.updateStats();
                window.dashboardUI.renderTodayAppointments();
            }
            this.recalculatePatientCounter(); // Ensure next code is correct after merge
        }
        this.isPullDone = true;
    }

    recalculatePatientCounter() {
        if (!this.data.patients) return;
        
        const codes = this.data.patients.map(p => {
            const raw = String(p.patientCode || "");
            const numericPart = raw.replace(/\D/g, ""); // Remove all non-digits
            return numericPart ? (parseInt(numericPart) || 0) : 0;
        });
        
        // Safety: ensure we always have at least [100] as a base
        const validCodes = codes.filter(c => !isNaN(c));
        const currentMax = Math.max(100, ...validCodes);
        
        if (!this.data.settings) this.data.settings = {};
        this.data.settings.lastPatientCode = isNaN(currentMax) ? 100 : currentMax;
        
        console.log(`[SyncManager] Patient counter recalculated: ${this.data.settings.lastPatientCode}`);
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
            this.recalculatePatientCounter();
            const nextCode = (this.data.settings.lastPatientCode || 100) + 1;
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
        // Self-Healing: Ensure default clinic exists if list is empty
        if (!this.data.clinics || this.data.clinics.length === 0) {
            this.data.clinics = [{
                id: 'clinic-default',
                name: 'الاسكندرية',
                isActive: true,
                createdAt: new Date().toISOString(),
                settings: { currency: 'EGP', timezone: 'Africa/Cairo', workingHours: { start: '09:00', end: '21:00' } }
            }];
        }
        // Self-Healing: Ensure Shubrakhit exists
        if (!this.data.clinics.find(c => c.id === 'clinic-shubrakhit' || c.name === 'شبراخيت')) {
            this.data.clinics.push({
                id: 'clinic-shubrakhit',
                name: 'شبراخيت',
                isActive: true,
                createdAt: new Date().toISOString(),
                settings: { currency: 'EGP', timezone: 'Africa/Cairo', workingHours: { start: '09:00', end: '21:00' } }
            });
            this.saveLocal();
        }
        return this.data.clinics;
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
                workingHours: { start: '09:00', end: '21:00' },
                startingCode: 1000 // Default start for new clinics
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
    // --- Cloud Sync: Fragmented Logic ---
    async triggerCloudSync() {
        if (typeof db === 'undefined' || !db) return false;
        if (!this.isPullDone) return false;
        if (this.isSyncing) {
            this.hasDirtyData = true; // Ensure we sync again after finish
            return false;
        }

        this.isSyncing = true;
        this.hasDirtyData = false; // Reset flag as we are starting a sync
        this.cloudStatus = 'syncing';
        this.updateSyncUI();

        const startTime = Date.now();
        console.log("%c [SyncManager] Cloud sync: Executable Fragmented Batch started...", "color: #3b82f6; font-weight: bold;");

        try {
            const batch = db.batch();
            const updatedAt = firebase.firestore.FieldValue.serverTimestamp();
            
            // Clean data for sync (removes possible base64 bloat)
            const cleanData = this.getCleanedLocalData();

            // 1. Metadata Fragment (Essential metadata only)
            const metadata = {
                clinics: cleanData.clinics,
                users: cleanData.users,
                settings: cleanData.settings,
                updatedAt: updatedAt
            };
            batch.set(db.collection('clinic_fragments').doc('metadata'), metadata);

            // 1.5 PatientDocs Fragments (Object logic)
            const docItems = Object.entries(cleanData.patientDocs || {});
            const docChunks = [];
            for (let i = 0; i < docItems.length; i += 50) {
                const chunk = Object.fromEntries(docItems.slice(i, i + 50));
                docChunks.push(chunk);
            }
            docChunks.forEach((chunk, index) => {
                batch.set(db.collection('clinic_fragments').doc(`patientdocs_${index}`), {
                    data: chunk,
                    updatedAt: updatedAt
                });
            });
            batch.set(db.collection('clinic_fragments').doc('patientdocs_info'), {
                totalChunks: docChunks.length,
                updatedAt: updatedAt
            });

            // 2. Patient Fragments (Chunked by 250 - Optimized balance)
            const patientChunks = this.chunkArray(cleanData.patients, 250);
            patientChunks.forEach((chunk, index) => {
                batch.set(db.collection('clinic_fragments').doc(`patients_${index}`), {
                    data: chunk,
                    updatedAt: updatedAt
                });
            });
            batch.set(db.collection('clinic_fragments').doc('patients_info'), {
                totalChunks: patientChunks.length,
                totalPatients: cleanData.patients.length,
                updatedAt: updatedAt
            });

            // 3. Appointment Fragments (Chunked by 300 - Safety first)
            const apptChunks = this.chunkArray(cleanData.appointments, 300);
            apptChunks.forEach((chunk, index) => {
                batch.set(db.collection('clinic_fragments').doc(`appointments_${index}`), {
                    data: chunk,
                    updatedAt: updatedAt
                });
            });
            batch.set(db.collection('clinic_fragments').doc('appointments_info'), {
                totalChunks: apptChunks.length,
                updatedAt: updatedAt
            });

            // 4. Simple Fragments
            batch.set(db.collection('clinic_fragments').doc('finances'), {
                ...cleanData.finances,
                updatedAt: updatedAt
            });

            // 5. Pruned Audit Log (Last 500)
            batch.set(db.collection('clinic_fragments').doc('audit_log'), {
                data: cleanData.auditLog.slice(0, 500),
                updatedAt: updatedAt
            });

            // COMMIT with timeout safety
            await Promise.race([
                batch.commit(),
                new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase batch commit timeout")), 30000))
            ]);
            
            // Success
            this.data.settings.lastSync = new Date().toISOString();
            localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
            
            this.cloudStatus = 'online';
            console.log(`%c [SyncManager] Cloud sync: Fragmented batch success (took ${Date.now() - startTime}ms).`, "color: #10b981; font-weight: bold;");
            return true;
        } catch (error) {
            console.error("[SyncManager] Fragmented Cloud Sync Failed:", error);
            this.cloudStatus = 'error';
            return false;
        } finally {
            this.isSyncing = false;
            this.updateSyncUI();

            // Bridge Fix: If data became dirty while we were syncing, schedule a follow-up
            if (this.hasDirtyData) {
                console.log("%c [SyncManager] Pending changes detected during sync. Scheduling follow-up...", "color: #f59e0b; font-weight: bold;");
                if (this.syncTimeout) clearTimeout(this.syncTimeout);
                this.syncTimeout = setTimeout(() => this.triggerCloudSync(), 4000); 
            }
        }
    }

    // --- Core Sync Support Methods ---
    logAction(user, action, details, meta = null) {
        if (!this.data.auditLog) this.data.auditLog = [];
        this.data.auditLog.unshift({
            timestamp: new Date().toISOString(),
            user,
            action,
            details,
            meta
        });
        // Self-pruning: Keep only last 1000 logs locally
        if (this.data.auditLog.length > 1000) {
            this.data.auditLog = this.data.auditLog.slice(0, 1000);
        }
    }

    getBackupJSON() {
        return JSON.stringify(this.data);
    }

    isBackupOverdue() {
        if (!this.data.settings?.lastBackup) return true;
        const last = new Date(this.data.settings.lastBackup);
        const diff = Date.now() - last.getTime();
        return diff > (24 * 60 * 60 * 1000); // More than 24 hours
    }

    updateSyncUI() {
        const latency = this.lastLatency || 0;
        window.dispatchEvent(new CustomEvent('syncStatusChanged', { detail: { status: this.cloudStatus, latency } }));
    }

    dispatchSyncStatus(status, latency = 0) {
        this.cloudStatus = status;
        this.lastLatency = latency;
        this.updateSyncUI();
    }

    /**
     * Legacy Cloud Pull: Now used for Fragmented Recovery.
     */
    async pullFromCloud() {
        if (typeof db === 'undefined' || !db) return false;
        if (this.isSyncing) return false;
        
        this.isSyncing = true;
        this.cloudStatus = 'syncing';
        this.updateSyncUI();

        try {
            console.log("%c [SyncManager] Manual Cloud Pull: Scanning clinic_fragments...", "color: #3b82f6; font-weight: bold;");
            // Check fragments collection first
            const frags = await db.collection('clinic_fragments').get();
            console.log(`[SyncManager] Query complete. Found ${frags.size} fragment documents.`);

            if (!frags.empty) {
                const fragmentMap = {};
                frags.forEach(doc => fragmentMap[doc.id] = doc.data());
                this.assembleAndMergeFragments(fragmentMap);
                return true;
            } else {
                // Try legacy migration
                await this.checkAndMigrateLegacyData();
                return true;
            }
        } catch (err) {
            console.error("[SyncManager] Pull Cloud Failed:", err);
            this.cloudStatus = 'error';
            return false;
        } finally {
            this.isSyncing = false;
            this.updateSyncUI();
        }
    }

    // --- Internal Helpers for Fragmented Sync ---
    chunkArray(array, size) {
        if (!array) return [];
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }

    getCleanedLocalData() {
        const clean = JSON.parse(JSON.stringify(this.data));
        // Remove Base64 bloat from documents metadata
        if (clean.patientDocs) {
            Object.keys(clean.patientDocs).forEach(pId => {
                clean.patientDocs[pId].forEach(doc => {
                    if (doc.fileData && doc.fileData.length > 1000) {
                        console.warn(`Cleaning base64 bloat from patient ${pId}, doc ${doc.id}`);
                        doc.fileData = null;
                    }
                });
            });
        }
        return clean;
    }
}

window.syncManager = new SyncManager();
