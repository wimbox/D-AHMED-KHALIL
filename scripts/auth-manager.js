/**
 * AuthManager: Manages Login, Logout, Sessions, and Role-Based Access Control (RBAC).
 */
class AuthManager {
    constructor() {
        this.currentUser = JSON.parse(localStorage.getItem('neuro_current_user')) || null;
        this.loginModal = null;
    }

    init() {
        if (!this.currentUser) {
            this.showLogin();
        } else {
            this.applyPermissions();
        }

        // Setup Logout Button in Sidebar if exists, or create one
        this.setupLogoutUI();
    }

    setupLogoutUI() {
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("AuthManager: Logout button clicked.");
                this.logout();
            });
        }

        const shutdownBtn = document.getElementById('btn-shutdown');
        if (shutdownBtn) {
            shutdownBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("AuthManager: Shutdown button clicked.");
                if (window.dashboardUI) window.dashboardUI.shutdownApp();
            });
        }

        const queueBtn = document.getElementById('btn-queue-display');
        if (queueBtn) {
            queueBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("AuthManager: Queue display button clicked.");
                window.open('queue-display.html', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
            });
        }
    }

    login(username, password) {
        const u = username.trim();
        const p = password.trim();
        let users = window.syncManager.data.users || [];

        // 1. Check for Employee Password Recovery Hint (Master Key admin123)
        if (p === 'admin123') {
            const recoveryTarget = users.find(usr => usr.username === u);
            // Allow recovery for anyone except the main 'admin' account
            if (recoveryTarget && recoveryTarget.username !== 'admin') {
                this.showLoginError(`كلمة مرور الموظف هي: [ ${recoveryTarget.password} ]`, '#00eaff');
                window.soundManager.playSuccess();
                return;
            }
        }

        // 2. Regular Login / Admin Backdoor
        let user = null;
        if (u === 'admin' && (p === 'admin' || p === 'admin123')) {
            user = users.find(usr => usr.username === 'admin') || { id: 'master-admin', username: 'admin', role: 'admin', name: 'المدير العام' };
        } else {
            user = users.find(usr => usr.username === u && usr.password === p);
        }

        if (user) {
            this.currentUser = user;
            localStorage.setItem('neuro_current_user', JSON.stringify(user));
            window.syncManager.logAction(user.username, 'LOGIN', 'دخول ناجح');
            this.hideLogin();
            this.applyPermissions();
            window.soundManager.playSuccess();
            window.location.reload();
        } else {
            window.soundManager.playError();
            this.showLoginError('تأكد من اسم المستخدم أو كلمة المرور', '#ff4d4d');
        }
    }

    showLoginError(msg, color = '#ff4d4d') {
        let errDiv = document.getElementById('login-error-msg');
        if (!errDiv) {
            errDiv = document.createElement('div');
            errDiv.id = 'login-error-msg';
            errDiv.style.cssText = `
                padding: 12px; border-radius: 12px; margin-top: 15px; 
                font-size: 0.95rem; font-weight: bold; animation: shake 0.4s ease-in-out;
            `;
            const container = document.getElementById('login-form-view');
            const submitBtn = document.getElementById('btn-login-submit');
            if (container && submitBtn) container.insertBefore(errDiv, submitBtn);
        }
        errDiv.style.color = color;
        errDiv.style.background = `${color}1A`; // 10% opacity
        errDiv.style.border = `1px solid ${color}33`; // 20% opacity
        errDiv.innerText = msg;

        const container = document.getElementById('login-container');
        if (container && color === '#ff4d4d') {
            container.style.borderColor = color;
            setTimeout(() => container.style.borderColor = '#00eaff', 1000);
        }
    }

    async logout() {
        const backupInfo = window.syncManager?.getBackupInfo() || { description: 'نسخة احتياطية' };

        // 1. Ask for confirmation with explicit Save text and dynamic path
        const confirmed = await window.showNeuroConfirm(
            'تسجيل خروج آمن',
            `هل تريد تسجيل الخروج وتأمين نسخة احتياطية فورية في (${backupInfo.description})؟`,
            'تأكيد الخروج والحفظ'
        );

        if (!confirmed) return;

        // 2. Show Full-Screen Securing Overlay
        this.showSecuringOverlay('جاري تأمين بياناتك قبل الخروج...');

        try {
            let backupResult = { success: false };
            if (window.syncManager) {
                // Perform backup with manual exit fallback (CRITICAL: passing true)
                backupResult = await window.syncManager.performAutoBackup(true);
            }

            // Artificial delay for UX and to ensure I/O completion
            await new Promise(r => setTimeout(r, 1200));

            const finalMsg = backupResult.success
                ? `تم تأمين بياناتك بنجاح في: ${backupResult.path}`
                : `تم الخروج (فشل الحفظ التلقائي: ${backupResult.error || ''})`;

            this.updateSecuringOverlayStatus(backupResult.success, finalMsg);
            await new Promise(r => setTimeout(r, 1500)); // Success/Error blink

        } catch (err) {
            console.error("Final logout backup failed:", err);
            this.updateSecuringOverlayStatus(false, "تم الخروج مع وجود خطأ تقني في الحفظ");
            await new Promise(r => setTimeout(r, 1500));
        }

        if (this.currentUser) {
            window.syncManager?.logAction(this.currentUser.username, 'LOGOUT', 'تم تسجيل الخروج');
        }

        this.currentUser = null;
        localStorage.removeItem('neuro_current_user');

        window.location.reload();
    }

    showLogin() {
        // Create Login Overlay
        const overlay = document.createElement('div');
        overlay.id = 'login-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
            background: #0f172a; 
            z-index: 9999; display: flex; align-items: center; justify-content: center;
            font-family: 'Tajawal', sans-serif;
        `;

        // Inject specific styles for options to try and control their look in supported browsers
        const styleTag = document.createElement('style');
        styleTag.innerHTML = `
            select option {
                background: #1e293b !important;
                color: #fff !important;
                padding: 15px !important;
                font-family: 'Tajawal', sans-serif !important;
                font-size: 1.1rem !important;
            }
            select:focus {
                border-color: #00eaff !important;
                background: rgba(0, 234, 255, 0.1) !important;
            }
        `;
        document.head.appendChild(styleTag);

        overlay.innerHTML = `
            <div id="login-container" style="text-align: center; width: 450px; padding: 40px; background: #1e293b; border: 2px solid #00eaff; border-radius: 25px; box-shadow: 0 0 50px rgba(0, 234, 255, 0.2);">
                <div style="margin-bottom: 25px;">
                    <i class="fa-solid fa-brain" style="font-size: 3.5rem; color: #00eaff; margin-bottom: 15px; filter: drop-shadow(0 0 15px #00eaff);"></i>
                    <h1 style="color: #fff; font-size: 2rem; margin: 0; font-family: 'Tajawal', sans-serif; letter-spacing: 1px;">Neuro-Clinic</h1>
                    
                    <!-- Master Clinic Selector -->
                    <div style="margin-top: 15px; position: relative; display: inline-block; width: 100%;">
                        <select id="login-clinic-master" style="
                            background: rgba(15, 23, 42, 0.8);
                            color: #00eaff;
                            border: 2px solid rgba(0, 234, 255, 0.3);
                            border-radius: 15px;
                            padding: 0 40px 0 15px; /* Extra padding for arrow */
                            font-family: 'Tajawal', sans-serif;
                            font-weight: 800;
                            font-size: 1.2rem;
                            width: 90%;
                            height: 55px;
                            text-align: center;
                            cursor: pointer;
                            outline: none;
                            transition: all 0.3s ease;
                            box-shadow: 0 0 20px rgba(0, 234, 255, 0.05);
                            appearance: none;
                            -webkit-appearance: none;
                        " onmouseover="this.style.borderColor='#00eaff'; this.style.boxShadow='0 0 25px rgba(0, 234, 255, 0.25)'; this.style.background='rgba(0, 234, 255, 0.1)'" 
                           onmouseout="this.style.borderColor='rgba(0, 234, 255, 0.4)'; this.style.boxShadow='0 0 15px rgba(0, 234, 255, 0.1)'; this.style.background='rgba(15, 23, 42, 0.8)'">
                        </select>
                        <i class="fa-solid fa-chevron-down" style="position: absolute; left: 12%; top: 50%; transform: translateY(-50%); color: #00eaff; font-size: 0.8rem; pointer-events: none; opacity: 0.7;"></i>
                    </div>
                </div>

                <!-- Choice View -->
                <div id="login-choice-view" style="display: flex; flex-direction: column; gap: 15px;">
                    <button id="choice-admin" style="padding: 15px; background: #00eaff; color: #000; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 0 25px rgba(0, 234, 255, 0.5)'" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none'">
                        <i class="fa-solid fa-user-shield"></i> مدير النظام
                    </button>
                    <button id="choice-employee" style="padding: 15px; background: rgba(0,234,255,0.05); color: #fff; border: 1.5px solid #00eaff; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s;" onmouseover="this.style.background='rgba(0,234,255,0.1)'; this.style.transform='scale(1.02)'" onmouseout="this.style.background='rgba(0,234,255,0.05)'; this.style.transform='scale(1)'">
                        <i class="fa-solid fa-user-group"></i> موظف / سكرتارية
                    </button>
                    <button id="choice-close-app" style="margin-top: 10px; padding: 12px; background: rgba(239, 68, 68, 0.05); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; font-weight: bold; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 10px; transition: 0.3s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.borderColor='#ef4444'" onmouseout="this.style.background='rgba(239, 68, 68, 0.05)'; this.style.borderColor='rgba(239, 68, 68, 0.3)'">
                        <i class="fa-solid fa-power-off"></i> إغلاق المنظومة
                    </button>
                </div>

                <!-- Form View (Hidden by default) -->
                <div id="login-form-view" style="display: none; flex-direction: column; gap: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 5px;">
                        <button id="btn-back-to-choice" style="background:none; border:none; color:#00eaff; cursor:pointer; font-size:1.5rem;"><i class="fa-solid fa-arrow-right"></i></button>
                        <span id="login-view-title" style="color:#fff; font-weight:bold; font-size: 1.1rem;">دخول النظام</span>
                    </div>


                    <div id="employee-select-container" style="display: none; position: relative;">
                        <label style="color: #94a3b8; font-size: 0.9rem; display: block; margin-bottom: 8px; text-align: right; font-weight: bold;">الرجاء اختيار اسمك:</label>
                        <select id="login-user-select" class="neuro-input" style="
                            width: 100%; 
                            height: 55px; 
                            text-align: center; 
                            background: #0f172a; 
                            color: #fff; 
                            border: 2px solid rgba(0, 234, 255, 0.5); 
                            border-radius: 15px; 
                            font-size: 1.1rem; 
                            font-weight: bold;
                            appearance: none;
                            -webkit-appearance: none;
                            cursor: pointer;
                            transition: 0.3s;
                        "
                        onmouseover="this.style.borderColor='#00eaff'; this.style.boxShadow='0 0 15px rgba(0, 234, 255, 0.2)'"
                        onmouseout="this.style.borderColor='rgba(0, 234, 255, 0.5)'; this.style.boxShadow='none'"
                        ></select>
                        <i class="fa-solid fa-chevron-down" style="position: absolute; left: 20px; bottom: 20px; color: #00eaff; pointer-events: none;"></i>
                    </div>

                    <input type="text" id="login-user" placeholder="اسم المستخدم" style="width: 100%; height: 45px; padding: 0 15px; background: #0f172a; color: #fff; border: 1px solid #00eaff; border-radius: 10px; text-align: center; box-sizing: border-box;">
                    
                    <div style="position: relative; width: 100%;">
                        <input type="password" id="login-pass" placeholder="كلمة المرور" style="width: 100%; height: 45px; padding: 0 15px; background: #0f172a; color: #fff; border: 1px solid #00eaff; border-radius: 10px; text-align: center; box-sizing: border-box;">
                        <i class="fa-solid fa-eye" id="toggle-pass-visibility" style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%); color: #00eaff; cursor: pointer; opacity: 0.7; transition: 0.3s;"></i>
                    </div>

                    <button id="btn-login-submit" style="width: 100%; padding: 15px; background: #00eaff; color: #000; border: none; border-radius: 12px; font-weight: bold; font-size: 1.1rem; cursor: pointer; box-shadow: 0 0 20px rgba(0, 234, 255, 0.3);">دخول</button>
                    <a href="javascript:void(0)" id="link-forgot-pass" style="color: #64748b; font-size: 0.85rem; text-decoration: none; margin-top: 5px; display: block;">نسيت كلمة المرور؟</a>
                </div>

                <div style="margin-top: 30px; font-size: 0.85rem; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                    نسخة مرخصة للدكتور / أحمد محمد أحمد خليل
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Elements
        const choiceView = document.getElementById('login-choice-view');
        const formView = document.getElementById('login-form-view');
        const btnAdmin = document.getElementById('choice-admin');
        const btnEmp = document.getElementById('choice-employee');
        const btnCloseApp = document.getElementById('choice-close-app');
        const btnBack = document.getElementById('btn-back-to-choice');
        const btnSubmit = document.getElementById('btn-login-submit');
        const userIn = document.getElementById('login-user');
        const userSelect = document.getElementById('login-user-select');
        const userSelectCont = document.getElementById('employee-select-container');
        const passIn = document.getElementById('login-pass');
        const viewTitle = document.getElementById('login-view-title');
        const forgotLink = document.getElementById('link-forgot-pass');
        const masterClinicSelect = document.getElementById('login-clinic-master');

        let isEmployeeMode = false;

        // Populate Master Clinics
        const clinics = window.syncManager.getClinics();
        masterClinicSelect.innerHTML = clinics.map(c => `
            <option value="${c.id}">${c.name === 'الاسكندرية' ? 'فرع الاسكندرية (الرئيسي)' : 'فرع ' + c.name}</option>
        `).join('');

        const currentActive = window.syncManager.data.settings.activeClinicId;
        if (currentActive) masterClinicSelect.value = currentActive;

        const refreshEmployeeList = () => {
            const selectedClinicId = masterClinicSelect.value;
            const users = (window.syncManager?.data?.users || []).filter(u =>
                u.username !== 'admin' && u.assignedClinics?.includes(selectedClinicId)
            );

            if (users.length === 0) {
                userSelect.innerHTML = `<option value="">لا يوجد موظفين بهذا الفرع</option>`;
            } else {
                userSelect.innerHTML = `<option value="" selected disabled>--- اختر اسمك من هنا ---</option>` +
                    users.map(u => `<option value="${u.username}">${u.name}</option>`).join('');
            }
        };

        masterClinicSelect.onchange = refreshEmployeeList;

        btnCloseApp.onclick = async () => {
            if (window.electronAPI) {
                btnCloseApp.style.pointerEvents = 'none';
                btnCloseApp.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري التأمين...`;

                if (window.syncManager) {
                    await window.syncManager.performAutoBackup(true);
                }
                setTimeout(() => window.electronAPI.quitApp(), 500);
            } else {
                // Browser Fallback logic with UI feedback
                const origHTML = btnCloseApp.innerHTML;
                btnCloseApp.style.borderColor = '#00eaff';
                btnCloseApp.style.color = '#00eaff';
                btnCloseApp.innerHTML = `<i class="fa-solid fa-circle-info"></i> يرجى إغلاق المتصفح يدوياً للتأمين`;

                if (window.syncManager) {
                    window.syncManager.performAutoBackup(true);
                }

                setTimeout(() => {
                    btnCloseApp.innerHTML = origHTML;
                    btnCloseApp.style.borderColor = '';
                    btnCloseApp.style.color = '';
                }, 4000);
            }
        };

        btnAdmin.onclick = () => {
            isEmployeeMode = false;
            choiceView.style.display = 'none';
            formView.style.display = 'flex';
            viewTitle.innerText = "دخول مدير النظام";
            userIn.style.display = 'block';
            userIn.value = 'admin';
            userSelectCont.style.display = 'none';
            passIn.focus();
        };

        btnEmp.onclick = () => {
            isEmployeeMode = true;
            choiceView.style.display = 'none';
            formView.style.display = 'flex';
            viewTitle.innerText = "دخول الموظفين";
            userIn.style.display = 'none';
            userSelectCont.style.display = 'block';
            refreshEmployeeList();
            passIn.focus();
        };

        btnBack.onclick = () => {
            formView.style.display = 'none';
            choiceView.style.display = 'flex';
        };

        const attempt = () => {
            const u = isEmployeeMode ? userSelect.value : userIn.value;
            const p = passIn.value;
            const clinicId = masterClinicSelect.value;

            if (isEmployeeMode && !u) {
                this.showLoginError('يرجى اختيار اسم الموظف أولاً');
                return;
            }

            if (u && p) {
                window.syncManager.data.settings.activeClinicId = clinicId;
                localStorage.setItem('neuro_active_clinic_id', clinicId); // PERSISTENCE SYNC
                window.syncManager.saveLocal();
                this.login(u, p);
            }
        };

        btnSubmit.onclick = attempt;
        passIn.onkeypress = (e) => { if (e.key === 'Enter') attempt(); };
        forgotLink.onclick = () => this.handleForgotPassword();

        const toggleEye = document.getElementById('toggle-pass-visibility');
        if (toggleEye) {
            toggleEye.onclick = () => {
                const isPass = passIn.type === 'password';
                passIn.type = isPass ? 'text' : 'password';
                toggleEye.className = isPass ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
                toggleEye.style.color = isPass ? '#ff4d4d' : '#00eaff'; // Change color when visible
            };
        }
    }

    handleForgotPassword() {
        this.showLoginError("لاستعادة كلمتك: اختر اسمك من القائمة ثم اكتب مفتاح المدير في خانة كلمة المرور وسيظهر لك سرك فوراً.", "#00eaff");
    }

    hideLogin() {
        const overlay = document.getElementById('login-overlay');
        if (overlay) overlay.remove();
    }

    applyPermissions() {
        if (!this.currentUser) return;
        const role = this.currentUser.role;
        const name = this.currentUser.name;

        console.log(`Logged in as: ${name} (${role})`);

        const nav = {
            dashboard: document.querySelector('[data-view="dashboard"]'),
            patients: document.querySelector('[data-view="patients"]'),
            appointments: document.querySelector('[data-view="appointments"]'),
            finance: document.querySelector('[data-view="finance"]'),
            settings: document.querySelector('[data-view="settings"]'),
            templates: document.querySelector('[data-view="templates"]'),
            users: document.querySelector('[data-view="users"]'),
            editor: document.querySelector('a[href="editor.html"]'),
            finManager: document.querySelector('a[href="finance-manager.html"]')
        };

        // Reset visibility first - Admin sees all
        Object.values(nav).forEach(el => { if (el) el.style.display = 'flex'; });

        if (role === 'doctor') {
            // Doctor: Medical only. Hide Finance, Users, Logs.
            if (nav.finance) nav.finance.style.display = 'none';
            if (nav.finManager) nav.finManager.style.display = 'none';
            if (nav.users) nav.users.style.display = 'none';
            if (nav.settings) nav.settings.style.display = 'none';
        }

        else if (role === 'secretary') {
            // Secretary: Admin/Finance only. Hide Editor, Medical Templates, Users.
            if (nav.editor) nav.editor.style.display = 'none';
            if (nav.templates) nav.templates.style.display = 'none';
            if (nav.users) nav.users.style.display = 'none';
            if (nav.settings) nav.settings.style.display = 'none';
        }

        // Handle inner Settings User Management section
        const userSettingsSec = document.getElementById('settings-users-section');
        if (userSettingsSec) {
            userSettingsSec.style.display = (role === 'admin') ? 'block' : 'none';
        }

        // Add user name to top bar
        const topBar = document.querySelector('.top-bar');
        if (topBar) {
            let userBadge = document.getElementById('user-badge');
            if (!userBadge) {
                userBadge = document.createElement('div');
                userBadge.id = 'user-badge';
                userBadge.className = 'user-badge';
                topBar.prepend(userBadge);
            }
            const icon = role === 'admin' ? 'fa-user-shield' : (role === 'doctor' ? 'fa-user-doctor' : 'fa-user-tie');
            const roleLabel = this.getRoleInArabic(role);
            userBadge.innerHTML = `
                <div class="user-badge-icon">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div style="display: flex; flex-direction: column; text-align: right;">
                    <span style="font-size: 0.95rem; line-height: 1;">${name}</span>
                    <small style="color: var(--accent-blue); font-size: 0.7rem; opacity: 0.8;">${roleLabel}</small>
                </div>
            `;
        }
    }


    getRoleInArabic(role) {
        const map = { 'admin': 'مدير', 'doctor': 'طبيب', 'secretary': 'سكرتارية' };
        return map[role] || role;
    }

    showSecuringOverlay(msg) {
        let overlay = document.getElementById('securing-data-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'securing-data-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100vh;
                background: rgba(15, 23, 42, 0.98); backdrop-filter: blur(20px);
                z-index: 20000; display: flex; flex-direction: column; align-items: center; justify-content: center;
                font-family: 'Tajawal', sans-serif; transition: all 0.5s ease;
            `;
            overlay.innerHTML = `
                <div id="securing-anim-container" style="position: relative; margin-bottom: 30px;">
                    <div class="neuro-spinner" style="width: 100px; height: 100px; border: 4px solid rgba(0, 234, 255, 0.1); border-top-color: #00eaff; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                    <i class="fa-solid fa-shield-halved" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2.5rem; color: #00eaff; filter: drop-shadow(0 0 15px #00eaff);"></i>
                </div>
                <h2 id="securing-msg" style="color: #fff; font-size: 1.8rem; margin: 0; font-weight: 800; text-shadow: 0 0 15px rgba(0, 234, 255, 0.3); text-align: center;">${msg || 'جاري تأمين البيانات...'}</h2>
                <div id="securing-progress-bar" style="width: 300px; height: 4px; background: rgba(255,255,255,0.05); border-radius: 10px; margin-top: 25px; overflow: hidden; position: relative;">
                    <div id="securing-progress-fill" style="position: absolute; top: 0; left: 0; height: 100%; width: 0%; background: #00eaff; box-shadow: 0 0 15px #00eaff; transition: width 1.5s ease-in-out;"></div>
                </div>
            `;

            // Add spin animation if not exists
            if (!document.getElementById('neuro-global-animations')) {
                const style = document.createElement('style');
                style.id = 'neuro-global-animations';
                style.innerHTML = `
                    @keyframes spin { to { transform: rotate(360deg); } }
                    @keyframes pulse-success { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(overlay);

            // Animate progress bar
            setTimeout(() => {
                const fill = document.getElementById('securing-progress-fill');
                if (fill) fill.style.width = '100%';
            }, 50);
        }
    }

    updateSecuringOverlayStatus(isSuccess, customMsg = null) {
        const msg = document.getElementById('securing-msg');
        const container = document.getElementById('securing-anim-container');
        const fill = document.getElementById('securing-progress-fill');

        if (isSuccess && msg && container) {
            msg.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${customMsg || 'تم تأمين بياناتك بنجاح'}`;
            msg.style.color = '#10b981';
            container.innerHTML = `<i class="fa-solid fa-circle-check" style="font-size: 5rem; color: #10b981; filter: drop-shadow(0 0 20px #10b981); animation: pulse-success 0.5s ease-out;"></i>`;
            if (fill) {
                fill.style.background = '#10b981';
                fill.style.boxShadow = '0 0 15px #10b981';
            }
        } else if (!isSuccess && msg && container) {
            msg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${customMsg || 'فشل تأمين البيانات - يرجى المحاولة يدوياً'}`;
            msg.style.color = '#ef4444';
            container.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="font-size: 5rem; color: #ef4444; filter: drop-shadow(0 0 20px #ef4444);"></i>`;
            if (fill) {
                fill.style.background = '#ef4444';
                fill.style.boxShadow = '0 0 15px #ef4444';
            }
        }
    }

    isAdmin() { return this.currentUser && this.currentUser.role === 'admin'; }
    isDoctor() { return this.currentUser && (this.currentUser.role === 'doctor' || this.currentUser.role === 'admin'); }
}

window.authManager = new AuthManager();
