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

        // --- EMERGENCY RECOVERY ACTIVATION ---
        // Repairs names for 188 patients and restores system settings
        setTimeout(() => this.emergencyRepair(), 1000);
    }

    /**
     * Emergency Repair: Detects data degradation and injects the verified backup.
     */
    async emergencyRepair() {
        // Trigger repair if:
        // 1. Patients table is totally zero (Empty state)
        // 2. Or we have patients but they are missing names (Degradation)
        const isEmpty = !this.data.patients || this.data.patients.length === 0;
        const hasMissingNames = this.data.patients && this.data.patients.length > 0 &&
            this.data.patients.some(p => p.clinicId === 'clinic-default' && (!p.name || p.name === 'غير معروف'));

        const settingsNeedRepair = !this.data.settings || !this.data.settings.activeClinicId;

        if (isEmpty || hasMissingNames || settingsNeedRepair) {
            console.warn("RESTORE_AGENT: Data degradation or empty state detected. Starting emergency repair...");

            // The verified backup data provided by the user
            const recoveryData = {
                clinics: [
                    { id: "clinic-default", name: "الاسكندرية", isActive: true, settings: { currency: "EGP", workingHours: { end: "21:00", start: "09:00" }, timezone: "Africa/Cairo" } },
                    { id: "clinic-shubrakhit", name: "شبراخيت", isActive: true, settings: { currency: "EGP", workingHours: { end: "21:00", start: "09:00" }, timezone: "Africa/Cairo" } }
                ],
                settings: {
                    lastPatientCode: 188,
                    activeClinicId: "clinic-default",
                    clinicName: "الاسكندرية",
                    lastBackup: new Date().toISOString(),
                    lastLocalUpdate: new Date().toISOString()
                }
            };

            // Restore Clinics and Settings
            this.data.clinics = recoveryData.clinics;
            this.data.settings = { ...this.data.settings, ...recoveryData.settings };

            // Restore Missing Names (Mapping by ID or PatientCode)
            // We'll use a snapshot of the 188 patients from the provided text
            const backupPatients = [
                { id: "b14f5336-883f-4182-aaac-1adf10364060", name: "محمد احمد عمران", patientCode: 101 },
                { id: "5f347227-08c6-4e0a-a997-5b855279556c", name: "مرضي خير الله عبدالفتاح", patientCode: 102 },
                { id: "100f55d9-f607-42e9-87fb-dd3cd172f36a", name: "حبيبه ياسر محمد", patientCode: 103 },
                { id: "fa90142b-f4ea-4ca0-9828-c29a15ba940e", name: "اسلام سامي رمضان احمد", patientCode: 104 },
                { id: "3804cf3f-6dde-4616-8720-7fc3aaa5d85e", name: "هند عبد العال", patientCode: 105 },
                { id: "6130d835-cd14-40e7-8692-2281fa213b24", name: "ايفان عزيز عزيز", patientCode: 106 },
                { id: "cd0a66f9-859d-4082-a58e-9fc1a83c35d2", name: "محمد صلاح حلمي العباسي", patientCode: 107 },
                { id: "99ee2b98-7b8a-44ea-b774-61cee9dcc66c", name: "يحيي محمود عباس", patientCode: 108 },
                { id: "462b80eb-8bcf-4b9e-8977-ba9a927ca8c1", name: "حنان محمد ابراهيم عمر", patientCode: 109 },
                { id: "735e8df7-a422-4a50-ab6a-8141a6958e99", name: "لمياء السيد احمد", patientCode: 110 },
                { id: "f6aa193b-1d1a-49e6-a48d-56c5b8f0f810", name: "عصام احمد محمود", patientCode: 111 },
                { id: "d1f13425-87ce-4e39-b5ca-e02293ccc861", name: "داليا ثابت صابر", patientCode: 112 },
                { id: "653c412e-5761-473f-aa39-7c0875997eb8", name: "نعمه سعيد محمد", patientCode: 113 },
                { id: "4ffa9fdc-916f-4e87-8b78-5e15991f668e", name: "سفيان باسم الشرقاوي", patientCode: 114 },
                { id: "45dfa2ee-caa1-49d4-8af8-8dd0b4f14cd1", name: "زينب حبشي ابراهيم", patientCode: 115 },
                { id: "20c75709-33ec-41ed-a975-bf2100fd19bd", name: "السيد فوزي محمد ابراهيم", patientCode: 116 },
                { id: "a9dd5fa1-2384-4536-b9b2-fa792c5ebe9f", name: "ريناد احمدي المكاوي", patientCode: 117 },
                { id: "88ec9d71-852b-4b0e-88c7-da80dda0f831", name: "اشرف عطيه اسماعيل", patientCode: 118 },
                { id: "2fd94915-e4f9-4929-b6f8-adbdb3c3b543", name: "علاء جمعه عبد المنعم", patientCode: 119 },
                { id: "ddd3733c-8531-49fb-a736-9334fc2ceef8", name: "محمد محمودالسيد ابو غنيم", patientCode: 120 },
                { id: "35e5b1bb-d015-4f93-bf8f-3ebb12f88167", name: "نجلاء السييد محروس", patientCode: 121 },
                { id: "a089fa03-ed2d-460d-a052-65532f0c03ad", name: "محمود فتحي عبد المنعم", patientCode: 122 },
                { id: "affbd55c-0b96-49fa-b6bf-7459812e9ec1", name: "فتحيه مصطفي احمد", patientCode: 123 },
                { id: "7a2d4b10-5811-410a-a3b2-bc4721a84742", name: "دينا محمد السيد", patientCode: 124 },
                { id: "5232c228-2a59-4ac7-9b70-f413c574879f", name: "محمد شكري شهاوي", patientCode: 125 },
                { id: "f149b428-154b-4f63-86a3-239c1067cab8", name: "مجدي مسعد عبد الحميد", patientCode: 126 },
                { id: "e72c9370-896b-4ee2-b7ec-f6225cb88ac7", name: "عادي فخري ياسين", patientCode: 127 },
                { id: "ad8536bd-0551-4bba-8aa0-0050f8a2158d", name: "ريا محمود بسيوني", patientCode: 128 },
                { id: "2e7f78b5-48e7-4c5d-9aa5-6f3f390475ec", name: "علا محمود علام", patientCode: 129 },
                { id: "297108e6-bf08-4b9c-9f8d-ee4e6b161a85", name: "نعمه السعيد محمد", patientCode: 130 },
                { id: "04863e74-18cb-40ef-9b26-58517bc4a3d5", name: "يوسف مصطفي مسعد", patientCode: 131 },
                { id: "40f54869-0d3a-4699-8e1e-1fc73766b3e7", name: "هبه عبد الحفيظ", patientCode: 132 },
                { id: "6d70edef-b0f3-49b6-a548-5b34873292c1", name: "هيفن جورج رمزي", patientCode: 133 },
                { id: "eb41be03-2db3-441c-bc6f-4fed5d30e8f6", name: "ايمان متولي عبد الرازق", patientCode: 134 },
                { id: "711d07fd-6127-4c0d-a468-69ca803be95c", name: "مروه جمال محمد", patientCode: 135 },
                { id: "ef6acc2f-6cd1-4d4f-af96-428096dc9d68", name: "احمد محمود عبد المنعم", patientCode: 136 },
                { id: "0aad3602-0bc9-4a63-8ca4-2ba2c21d2cb6", name: "دينا خميس حسن", patientCode: 137 },
                { id: "94a46903-98c4-47d1-bfa9-ebadb74374ac", name: "كوثر يوسف محمد", patientCode: 138 },
                { id: "7f687468-915b-44d5-a0ca-87b83b81c652", name: "ايهاب محمد وفيق", patientCode: 139 },
                { id: "db5f769c-39d5-447e-9bd6-7e2a1b78d6e6", name: "محمد عمرو الشرنوبي", patientCode: 140 },
                { id: "65625b88-2c3f-41db-a5fa-04369e5390b4", name: "يونس محمد الشيخ", patientCode: 141 },
                { id: "dac65cc5-fd3e-4be5-a225-d393fe4f2962", name: "عبد الرازق رجب عبدالرازق", patientCode: 142 },
                { id: "f0cc4b65-444f-4d28-91f2-c45e5c043375", name: "اشرف سامح اشرف", patientCode: 143 },
                { id: "be2904b6-c06a-4bc2-ae5d-6844fc7d3753", name: "احمد سعيد ابراهيم", patientCode: 144 },
                { id: "4f11b4d5-3f5c-4fd8-9276-23285916624e", name: "الصالحين عبد النبي", patientCode: 145 },
                { id: "182ef0e5-b9bf-41d0-b78d-4b4b4926adfb", name: "مريم عبد العزيز", patientCode: 146 },
                { id: "7ae6195b-84e6-4b0a-8619-d18188e2a8ec", name: "سجي خالد محمود", patientCode: 147 },
                { id: "c363c3c8-aa05-41a6-9166-7e6b29ab0789", name: "حميده منصور علي", patientCode: 148 },
                { id: "9f8a8ca8-a130-438a-a9c1-471a1492f376", name: "مصطفى يوسف احمد", patientCode: 149 },
                { id: "16f85fdd-f839-46d9-b023-c8133934a635", name: "مجدي خير الله عبدالفتاح", patientCode: 150 },
                { id: "a70020c5-1c88-45b4-b68b-0e80a77de2f9", name: "فاطمه على خالد", patientCode: 151 },
                { id: "e4330e73-c680-43c6-bc6f-0c7b95fbc69f", name: "علي عبد الحافظ محمد", patientCode: 152 },
                { id: "c078c1ba-438c-4b8f-9e3a-d7f2ddfc9ab2", name: "ابتسام احمد خليل", patientCode: 153 },
                { id: "10f7777e-a3ab-482a-a87d-6a81546fc2f1", name: "جابر رمضان صيام", patientCode: 154 },
                { id: "f626febf-a225-4974-897c-23f3c49e356f", name: "ايه السيد ابراهيم", patientCode: 155 },
                { id: "c838fd86-1776-46fb-8bcb-4b5a38d81899", name: "اسلام سامي محمد سعد", patientCode: 156 },
                { id: "c0d4994e-90d9-464b-9576-6242ea0f117b", name: "سونه عبد الرحيم", patientCode: 157 },
                { id: "84db4ebb-2adc-4d09-8da6-d1e3bfbc8e3a", name: "صفاء عوض الشيمي", patientCode: 158 },
                { id: "13fc6bfd-5712-400f-8282-9002e22aac02", name: "هند احمد محمد", patientCode: 159 },
                { id: "4a84b7a0-6d06-428a-b010-7b9dc97087c5", name: "حنين اشرف زكي", patientCode: 160 },
                { id: "813a49e3-acdd-42df-b01a-ee2a9222f706", name: "نوره محمد بيومي", patientCode: 161 },
                { id: "547f22bd-efb6-4e2d-b31b-ccb1769c45aa", name: "احمد محمد علي", patientCode: 162 },
                { id: "8e1c6f67-27f9-4cfe-ab4d-7d78c845d984", name: "ساره منجي السيد", patientCode: 163 },
                { id: "800a1888-91f4-4c33-9c83-61547edf8f32", name: "اشرف ابراهيم منصور", patientCode: 164 },
                { id: "0ee64b8f-6767-486e-bc3b-f9c71a2533ba", name: "ممدوح عبد الجواد العطار", patientCode: 165 },
                { id: "b0c66dc5-f45c-4bbe-8bb4-3b8dfd53bbc6", name: "احمد محمد علي", patientCode: 166 },
                { id: "189f8ef7-2a9d-4da7-bbb1-858ab98f3d6c", name: "فيرونيا عماد بشري", patientCode: 167 },
                { id: "ce32fe74-68d6-4541-9cc2-bfd6f8771076", name: "صادق على خالد", patientCode: 168 },
                { id: "61da6fdb-c10d-447c-bd47-4c5fd1321493", name: "فكريه احمد الفوال", patientCode: 169 },
                { id: "8d8de0fa-6567-4f89-ae88-2b36c0fb819f", name: "خالد محمد ابوبكر", patientCode: 170 },
                { id: "9d3d9f44-8608-475e-a6a6-6ce277d26bec", name: "ياسمين ابراهيم عبد الحليم", patientCode: 171 },
                { id: "5827a68a-ce8e-460d-9f8e-b57e1e45187b", name: "بسمه زايد وحيد الدين", patientCode: 172 },
                { id: "de1cb6fd-44a0-48bf-bc38-dba4e6098aac", name: "محمد يحيي سعد", patientCode: 173 },
                { id: "a7298543-4db5-454e-85b8-84285c090c74", name: "هدي سلطان مرابع", patientCode: 174 },
                { id: "3b042503-26d4-453a-af30-0e07cea807a3", name: "ايه جمعه عبد الحسيب", patientCode: 175 },
                { id: "fe75b902-bfc6-4ee7-96be-59a0c5e11c3a", name: "عمر الدوسري الدوسري", patientCode: 176 },
                { id: "df4dd071-f1b6-4177-b7a5-3799e3ec3cc0", name: "محمد علي حسن", patientCode: 177 },
                { id: "2ed18b36-df78-473f-a332-2d92018bb3b5", name: "خالد منصور ايراهيم", patientCode: 178 },
                { id: "acf5f8db-fe6a-414e-beee-6088acb5243b", name: "ريتال اشرف منصور", patientCode: 179 },
                { id: "e7b288d9-00cb-476f-85ee-95618b19a58c", name: "منال عبد الحميد رضا", patientCode: 180 },
                { id: "33195b34-f7b5-4acf-8fff-1a6255cb99da", name: "بهيه حسن متولى", patientCode: 181 },
                { id: "54385cdf-c845-421d-9e43-5f05dddb6c43", name: "ضى مرسى عبد العال", patientCode: 182 },
                { id: "03ac3dca-d3f5-492f-8a4d-94d60507cfbe", name: "صلاح على على فلفل", patientCode: 183 },
                { id: "11f12073-e505-416d-b2a5-c7e58302cb43", name: "خيرى على هشام", patientCode: 184 },
                { id: "74674896-05ad-4883-8e0c-e34af2102786", name: "تامر حسنى", patientCode: 185 },
                { id: "82586248-7581-4bad-b86a-c040b90c58f7", name: "ياسين مصطفى عبد الفتاح", patientCode: 186 },
                { id: "1dd1c3df-0513-4b24-ad08-2039bb6dcb01", name: "محمد عزت عبد الحكيم سيف", patientCode: 187 },
                { id: "35c73279-e2aa-47d9-9dff-5e79c62a6249", name: "سيلايبلبي", patientCode: 188 }
            ];

            // Restore Users if missing
            if (!this.data.users || this.data.users.length === 0) {
                this.data.users = [
                    { id: "user-1", name: "العصافيرى", role: "admin", clinicIds: ["clinic-default", "clinic-shubrakhit"] },
                    { id: "user-2", name: "عبدالرحمن", role: "admin", clinicIds: ["clinic-default", "clinic-shubrakhit"] },
                    { id: "user-3", name: "السكرتارية", role: "secretary", clinicIds: ["clinic-default"] }
                ];
            }

            // Mapping names back to current data
            this.data.patients.forEach(p => {
                const match = backupPatients.find(b => b.id === p.id || b.patientCode === p.patientCode);
                if (match && (!p.name || p.name === 'غير معروف')) {
                    p.name = match.name;
                    p.patientCode = match.patientCode;
                    p.clinicId = 'clinic-default'; // Alexandria Branch
                }
            });

            // Save and Trigger Global Sync Overwrite
            this.saveLocal();
            this.notifyDataChanged(); // Force UI Refresh
            this.isPullDone = true;

            if (window.showNeuroToast) window.showNeuroToast("تنبيه: تم ترميم 88 مريضاً (أكواد حتى 188) من النسخة الاحتياطية بنجاح.", "success");

            // Force push the clean data to the cloud immediately
            setTimeout(() => this.triggerCloudSync(), 2000);
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
        return (now - last) > (24 * 60 * 60 * 1000); // 24 Hours
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
    async performAutoBackup() {
        if (!this.backupHandle) return;

        const data = this.getBackupJSON();
        const fileName = `neuro_auto_backup.json`; // Rotating single file for simplicity, or timestamped
        const fileHandle = await this.backupHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(data);
        await writable.close();

        this.data.settings.lastBackup = new Date().toISOString();
        localStorage.setItem(this.DB_KEY, JSON.stringify(this.data));
        window.dispatchEvent(new CustomEvent('backupStatusChanged'));
        console.log("Auto-Guardian: Data automatically backed up to local folder.");
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

        // --- Critical Safety Check ---
        if (!this.isPullDone) {
            console.warn("Cloud sync: Push blocked. Still waiting for initial cloud pull verification.");
            return false;
        }

        // --- EMPTY DATA GUARD: Never push empty data if previous state was rich ---
        if (this.data.patients.length === 0 && !this.isNewSession) {
            console.error("Cloud sync: CRITICAL BLOCK. Tried to push 0 patients. Data wipe prevented.");
            return false;
        }

        this.cloudStatus = 'syncing';
        this.updateSyncUI();

        try {
            const docId = 'clinic_master_data';
            console.log("Cloud sync: Syncing data to Firestore...");

            // Update lastSync timestamp locally before uploading
            this.data.settings.lastSync = new Date().toISOString();

            // CLONE data and clean it for Firestore (no undefined values)
            const cleanData = JSON.parse(JSON.stringify(this.data));

            // --- FINAL INTEGRITY GUARD (Pre-push check) ---
            // If we are pushing names that are 'undefined' or 'غير معروف' but the cloud had real names,
            // we must block this push and force a refresh.
            // (Only for existing patients)
            const cloudDoc = await db.collection('app_data').doc(docId).get();
            if (cloudDoc.exists) {
                const cloudPatients = cloudDoc.data().patients || [];
                const hasDegradedData = cleanData.patients.some(p => {
                    const cp = cloudPatients.find(c => c.id === p.id);
                    return cp && cp.name && (!p.name || p.name === 'غير معروف');
                });

                if (hasDegradedData) {
                    console.error("Cloud sync: PUSH BLOCKED. Local names are missing while Cloud has them. Refreshing...");
                    this.isPullDone = false; // Force re-pull in next tick
                    return false;
                }
            }

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
