/**
 * Dashboard UI: Manages stats, tables, and modal interactions.
 * Integrates with SyncManager for data.
 */
class DashboardUI {
    constructor() {
        // Elements
        this.stats = {
            patients: document.getElementById('stat-patients-count'),
            appointments: document.getElementById('stat-appointments-today'),
            income: document.getElementById('stat-income-total'),
            expenses: document.getElementById('stat-expenses-total'),
            dues: document.getElementById('stat-dues-total'),
            netProfit: document.getElementById('stat-net-profit')
        };

        this.elements = {
            appointmentPatientName: document.getElementById('book-patient-name-appointment'),
            appointmentSuggestions: document.getElementById('appointment-name-suggestions'),
            globalSearch: document.getElementById('global-patient-search'),
            globalSuggestions: document.getElementById('global-search-suggestions')
        };

        this.tables = {
            todayAppointments: document.querySelector('#view-dashboard .neuro-table tbody'),
            allAppointments: document.getElementById('appointments-table-body'),
            patients: document.getElementById('view-patients'),
            finance: document.getElementById('view-finance'),
            settings: document.getElementById('view-settings'),
            users: document.getElementById('view-users'),
            logs: document.getElementById('view-logs')
        };

        this.init();
    }

    init() {
        this.updateStats();

        // Final Force: If a migration happened during SyncManager init, 
        // update stats again to erase Alexandria data from other branches.
        if (window.syncManager && window.syncManager.shouldForceStatsRefresh) {
            this.updateStats();
            window.syncManager.shouldForceStatsRefresh = false;
        }
        this.renderTodayAppointments();

        // Global Modal Helper
        window.showNeuroModal = (title, msg, onConfirm = null, showCancel = true, onCancel = null) => {
            const overlay = document.createElement('div');
            overlay.className = 'neuro-modal-overlay';
            // Use div instead of p for msg to allow HTML content
            overlay.innerHTML = `
                <div class="neuro-modal-content">
                    <h2 class="neuro-modal-title">${title}</h2>
                    <div class="neuro-modal-msg" style="text-align: right;">${msg}</div>
                    <div class="neuro-modal-actions">
                        <button class="btn-modal-confirm">تأكيد</button>
                        ${showCancel ? '<button class="btn-modal-cancel">إلغاء</button>' : ''}
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const confirmBtn = overlay.querySelector('.btn-modal-confirm');
            confirmBtn.onclick = async () => {
                const originalText = confirmBtn.innerHTML;
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التنفيذ...';
                
                try {
                    if (onConfirm) {
                        const result = await onConfirm(overlay);
                        if (result === false) {
                            confirmBtn.disabled = false;
                            confirmBtn.innerHTML = originalText;
                            return;
                        }
                    }
                    overlay.remove();
                } catch (err) {
                    console.error("Modal Action Error:", err);
                    alert("خطأ في تنفيذ العملية: " + err.message); // Visual fallback
                    confirmBtn.disabled = false;
                    confirmBtn.innerHTML = originalText;
                }
            };
            if (showCancel) {
                overlay.querySelector('.btn-modal-cancel').onclick = () => {
                    if (onCancel) onCancel();
                    overlay.remove();
                };
            }
            overlay.onclick = (e) => {
                if (e.target === overlay) {
                    if (onCancel) onCancel();
                    overlay.remove();
                }
            };
        };

        // Promise-based Confirmation
        window.showNeuroConfirm = (title, msg) => {
            return new Promise((resolve) => {
                window.showNeuroModal(title, msg, () => {
                    resolve(true);
                    return true;
                }, true, () => {
                    resolve(false);
                });
            });
        };

        // Custom Toast Notification (Premium Look)
        window.showNeuroToast = (message, type = 'success') => {
            const toast = document.createElement('div');
            toast.className = 'neuro-toast';
            const icon = type === 'success' ? 'fa-circle-check' : (type === 'error' ? 'fa-circle-xmark' : 'fa-circle-info');
            const color = type === 'success' ? '#10b981' : (type === 'error' ? '#ef4444' : '#00eaff');

            toast.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px; padding: 15px 25px; background: var(--theme-panel-bg); border: 1px solid ${color}; border-radius: 12px; backdrop-filter: blur(15px); box-shadow: var(--theme-glow); border-left: 5px solid ${color};">
                    <i class="fa-solid ${icon}" style="color: ${color}; font-size: 1.2rem;"></i>
                    <span style="color: var(--text-primary); font-weight: 700;">${message}</span>
                </div>
            `;
            toast.style.cssText = `position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%) translateY(100px); z-index: 40000; transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); opacity: 0;`;
            document.body.appendChild(toast);

            // Trigger animation
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(0)';
                toast.style.opacity = '1';
            }, 100);

            // Auto-hide
            setTimeout(() => {
                toast.style.transform = 'translateX(-50%) translateY(100px)';
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 500);
            }, 4000);
        };

        // Appointment Modal Logic
        const appointmentBtn = document.getElementById('btn-open-booking');
        const appointmentModal = document.getElementById('appointment-booking-modal');
        const appointmentForm = document.getElementById('appointment-booking-form');

        if (appointmentBtn) {
            appointmentBtn.onclick = () => openModal();
        }

        const quickAppointmentBtn = document.getElementById('btn-quick-appointment');
        if (quickAppointmentBtn) {
            quickAppointmentBtn.onclick = () => openModal();
        }

        const openModal = () => {
            appointmentModal.style.display = 'flex';
            // Auto-fill datetime
            const now = new Date();

            // Auto-fill Date (New Split Fields)
            const dSel = document.getElementById('book-day-appointment');
            const mSel = document.getElementById('book-month-appointment');
            const ySel = document.getElementById('book-year-appointment');
            if (dSel && mSel && ySel) {
                dSel.value = String(now.getDate()).padStart(2, '0');
                mSel.value = String(now.getMonth() + 1).padStart(2, '0');
                ySel.value = now.getFullYear();
            }

            // Auto-fill Time
            let hours = now.getHours();
            const mins = now.getMinutes();
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12 || 12;

            document.getElementById('book-hour-appointment').value = hours;
            document.getElementById('book-minute-appointment').value = mins;
            document.getElementById('book-ampm-appointment').value = ampm;
        };

        const closeAppointmentBtn = document.getElementById('btn-close-appointment-booking');
        if (closeAppointmentBtn) closeAppointmentBtn.onclick = () => {
            appointmentModal.style.display = 'none';
            this.elements.appointmentSuggestions.style.display = 'none';
        };

        const printReportBtn = document.getElementById('btn-print-monthly-report');
        if (printReportBtn) {
            printReportBtn.onclick = () => this.printMonthlyReport();
        }

        this.initGlobalSearch();
        this.initAppointmentLogic();
        this.initPatientLogic();
        this.initSettingsLogic();
        this.startModalClock();

        // Populate Time Selects
        const hSelect = document.getElementById('book-hour-appointment');
        const mSelect = document.getElementById('book-minute-appointment');
        if (hSelect && mSelect) {
            hSelect.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${String(i + 1).padStart(2, '0')}</option>`).join('');
            mSelect.innerHTML = Array.from({ length: 60 }, (_, i) => `<option value="${i}">${String(i).padStart(2, '0')}</option>`).join('');
        }

        // Populate Date Selects
        const daySelect = document.getElementById('book-day-appointment');
        const monthSelect = document.getElementById('book-month-appointment');
        const yearSelect = document.getElementById('book-year-appointment');
        if (daySelect && monthSelect && yearSelect) {
            daySelect.innerHTML = Array.from({ length: 31 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${String(i + 1).padStart(2, '0')}</option>`).join('');
            monthSelect.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${String(i + 1).padStart(2, '0')}">${String(i + 1).padStart(2, '0')}</option>`).join('');

            const currentYear = new Date().getFullYear();
            const years = [];
            for (let y = currentYear; y <= 2050; y++) {
                years.push(y);
            }
            yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');

            // Set Automatic Date (Today)
            const now = new Date();
            daySelect.value = String(now.getDate()).padStart(2, '0');
            monthSelect.value = String(now.getMonth() + 1).padStart(2, '0');
            yearSelect.value = now.getFullYear();
        }

        // Sound Toggle & Startup
        const soundBtn = document.getElementById('btn-toggle-sound');
        if (soundBtn) {
            soundBtn.onclick = () => window.soundManager.toggle();
            window.soundManager.updateUI();
        }

        // Play error sound when browser validation fails (e.g. required fields missed)
        document.addEventListener('invalid', () => {
            window.soundManager.playError();
        }, true);

        this.initUsersAndLogs();

        // Listen for Real-time Cloud Sync or Cross-tab Sync
        window.addEventListener('syncDataRefreshed', () => {
            console.log("DashboardUI: Data refreshed from sync. Updating tables...");
            this.updateStats();
            this.renderTodayAppointments();
            if (!this.tables.allAppointments?.parentElement.classList.contains('hidden')) {
                this.renderAllAppointments();
            }
            if (!this.tables.patients?.classList.contains('hidden')) {
                this.renderPatientsManagement();
            }
        });

        // Backup Guardian Monitoring
        window.addEventListener('backupStatusChanged', () => this.checkBackupGuardian());
        this.checkBackupGuardian();

        // Check every 30 mins
        setInterval(() => this.checkBackupGuardian(), 30 * 60 * 1000);

        // Scroll Navigator Listener
        const container = this.getScrollContainer();
        const scrollTarget = container === window ? window : container;
        scrollTarget.addEventListener('scroll', () => this.handleScrollNavigator());



        setTimeout(() => window.soundManager.playStartup(), 1000);
    }

    getScrollContainer() {
        const desktopScroll = document.getElementById('main-content-view');
        // On mobile, the body/window scrolls. On desktop, the dedicated div scrolls.
        if (window.innerWidth <= 1024 || !desktopScroll) return window;
        return desktopScroll;
    }

    handleScrollNavigator() {
        const btnTop = document.getElementById('btn-scroll-top');
        const btnStepUp = document.getElementById('btn-scroll-step-up');
        if (!btnTop || !btnStepUp) return;

        const container = this.getScrollContainer();
        const scrollTop = container === window ? window.scrollY : container.scrollTop;

        // Show 'up' controls after 300px scroll
        if (scrollTop > 300) {
            btnTop.classList.remove('hidden');
            btnStepUp.classList.remove('hidden');
        } else {
            btnTop.classList.add('hidden');
            btnStepUp.classList.add('hidden');
        }
    }

    scrollToTop() {
        const container = this.getScrollContainer();
        container.scrollTo({ top: 0, behavior: 'smooth' });
    }

    scrollToBottom() {
        const container = this.getScrollContainer();
        const target = container === window ? document.body.scrollHeight : container.scrollHeight;
        container.scrollTo({ top: target, behavior: 'smooth' });
    }

    scrollStepDown() {
        const container = this.getScrollContainer();
        const current = container === window ? window.scrollY : container.scrollTop;
        container.scrollTo({ top: current + 400, behavior: 'smooth' });
    }

    scrollStepUp() {
        const container = this.getScrollContainer();
        const current = container === window ? window.scrollY : container.scrollTop;
        container.scrollTo({ top: current - 400, behavior: 'smooth' });
    }

    checkBackupGuardian() {
        const banner = document.getElementById('backup-alert-banner');
        if (!banner) return;

        if (window.syncManager.isBackupOverdue()) {
            banner.style.display = 'flex';
        } else {
            banner.style.display = 'none';
        }
    }

    printMonthlyReport() {
        // Create printable structure
        const header = `
            <div class="report-print-header">
                <h1 style="font-size: 2.5rem; margin-bottom: 5px;">تقرير الحسابات المالي</h1>
                <p style="font-size: 1.2rem; color: #333;">بتاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
            </div>
        `;

        // Add current stats to print
        const statsPrint = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 30px; text-align: center; border: 2px solid #000; padding: 20px;">
                <div><strong>إجمالي الإيرادات:</strong> <p>${this.stats.income.textContent}</p></div>
                <div><strong>إجمالي المصاريف:</strong> <p>${this.stats.expenses.textContent}</p></div>
                <div><strong>صافي الربح:</strong> <p style="font-size: 1.5rem;">${this.stats.netProfit.textContent}</p></div>
            </div>
        `;

        const originalContent = document.body.innerHTML;
        const printContent = `
            <div style="padding: 20mm; direction: rtl; font-family: 'Tajawal', sans-serif;">
                ${header}
                ${statsPrint}
                <h3 style="margin-bottom: 10px;">جدول الحسابات التفصيلي:</h3>
                <table class="neuro-table" style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background: #f0f0f0;">
                            <th style="border: 1px solid #000; padding: 10px;">التاريخ</th>
                            <th style="border: 1px solid #000; padding: 10px;">البيان</th>
                            <th style="border: 1px solid #000; padding: 10px;">النوع</th>
                            <th style="border: 1px solid #000; padding: 10px;">المبلغ</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${syncManager.data.finances.transactions.map(t => `
                            <tr>
                                <td style="border: 1px solid #000; padding: 8px;">${new Date(t.date).toLocaleDateString('ar-EG')}</td>
                                <td style="border: 1px solid #000; padding: 8px;">${t.description}</td>
                                <td style="border: 1px solid #000; padding: 8px;">${t.type === 'income' ? 'إيراد' : 'مصروف'}</td>
                                <td style="border: 1px solid #000; padding: 8px;">${t.amount} EGP</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 50px; text-align: left;">
                    <p>توقيع الإدارة: .............................</p>
                </div>
            </div>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Financial Report</title>
                    <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
                    <style>
                        body { font-family: 'Tajawal', sans-serif; direction: rtl; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                        th, td { border: 1px solid #ccc; padding: 12px; text-align: right; }
                        @media print { .no-print { display: none; } }
                    </style>
                head>
                <body>
                    ${printContent}
                    <script>setTimeout(() => { window.print(); window.close(); }, 500);</script>
                </body>
            </html>
        `);
    }

    initGlobalSearch() {
        if (!this.elements.globalSearch) return;

        this.elements.globalSearch.oninput = (e) => {
            const query = e.target.value.trim();
            if (query.length < 1) {
                this.elements.globalSuggestions.style.display = 'none';
                return;
            }

            const lowerQuery = query.toLowerCase();
            const patients = syncManager.getPatientsByClinic().filter(p => {
                const matchBasic = (p.name && p.name.toLowerCase().includes(lowerQuery)) ||
                    (p.phone && p.phone.includes(query)) ||
                    (p.patientCode && p.patientCode.toString().includes(query));

                if (matchBasic) return true;

                // Search in visits (diagnosis and medicines)
                if (p.visits && Array.isArray(p.visits)) {
                    return p.visits.some(v => {
                        const matchDiagnosis = (v.diagnosis && v.diagnosis.toLowerCase().includes(lowerQuery)) ||
                            (v.chiefComplaint && v.chiefComplaint.toLowerCase().includes(lowerQuery));
                        const matchMedicines = v.medicines && v.medicines.some(m =>
                            m.name && m.name.toLowerCase().includes(lowerQuery)
                        );
                        return matchDiagnosis || matchMedicines;
                    });
                }
                return false;
            });

            if (patients.length > 0) {
                this.elements.globalSuggestions.innerHTML = patients.map(p => {
                    let matchInfo = '';
                    const isNameMatch = p.name && p.name.toLowerCase().includes(lowerQuery);
                    const isPhoneMatch = p.phone && p.phone.includes(query);
                    const isCodeMatch = p.patientCode && p.patientCode.toString().includes(query);

                    if (!isNameMatch && !isPhoneMatch && !isCodeMatch && p.visits) {
                        const visit = p.visits.find(v =>
                            (v.diagnosis && v.diagnosis.toLowerCase().includes(lowerQuery)) ||
                            (v.chiefComplaint && v.chiefComplaint.toLowerCase().includes(lowerQuery)) ||
                            (v.medicines && v.medicines.some(m => m.name && m.name.toLowerCase().includes(lowerQuery)))
                        );
                        if (visit) {
                            if (visit.diagnosis && visit.diagnosis.toLowerCase().includes(lowerQuery)) {
                                matchInfo = `<span style="color: #10b981; font-size: 0.75rem;"><i class="fa-solid fa-stethoscope"></i> مطابق للتشخيص: ${visit.diagnosis}</span>`;
                            } else if (visit.chiefComplaint && visit.chiefComplaint.toLowerCase().includes(lowerQuery)) {
                                matchInfo = `<span style="color: #3b82f6; font-size: 0.75rem;"><i class="fa-solid fa-comment-medical"></i> مطابق للشكوى: ${visit.chiefComplaint}</span>`;
                            } else {
                                const med = visit.medicines.find(m => m.name && m.name.toLowerCase().includes(lowerQuery));
                                matchInfo = `<span style="color: #f59e0b; font-size: 0.75rem;"><i class="fa-solid fa-pills"></i> مطابق للدواء: ${med.name}</span>`;
                            }
                        }
                    }

                    // Fetch last 2 appointments for history
                    const patientAppointments = (syncManager.data.appointments || [])
                        .filter(a => a.patientId === p.id)
                        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
                        .slice(0, 2);

                    const historyHTML = patientAppointments.length > 0
                        ? `<div style="margin-top: 5px; border-top: 1px inset rgba(255,255,255,0.1); padding-top: 5px;">
                             <span style="color: #94a3b8; font-size: 0.75rem;"><i class="fa-solid fa-history"></i> السجل: </span>
                             ${patientAppointments.map(a => `<span style="background: rgba(0, 234, 255, 0.05); color: #00eaff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; margin-right: 5px;">${a.service} (${a.datetime.split('T')[0]})</span>`).join('')}
                           </div>`
                        : '';

                    return `
                    <div class="suggestion-item" data-id="${p.id}" style="padding: 15px 20px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                            <span style="font-weight: 700; color: #fff; font-size: 1rem;">${p.name} <small style="color:var(--accent-blue); opacity:0.8;">#${p.patientCode || '---'}</small></span>
                            <div style="color: #f59e0b; font-size: 0.8rem; font-weight: 600;"><i class="fa-solid fa-comment-dots"></i> الملاحظات: ${p.permanentNotes || 'بدون ملاحظات'}</div>
                            ${matchInfo ? `<div style="margin-top: -2px;">${matchInfo}</div>` : ''}
                            <div style="display: flex; gap: 15px; align-items: center; opacity: 0.6; font-size: 0.8rem;">
                                <span><i class="fa-solid fa-phone" style="font-size: 0.7rem;"></i> ${p.phone || '--'}</span>
                                <span><i class="fa-solid fa-calendar-day" style="font-size: 0.7rem;"></i> العمر: ${p.age || '--'}</span>
                            </div>
                            ${historyHTML}
                        </div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <button class="btn-edit-tool quick-action-btn" data-action="prescribe" data-id="${p.id}" title="روشتة جديدة" style="background: rgba(0, 234, 255, 0.1); border-color: var(--accent-blue);">
                                <i class="fa-solid fa-file-prescription"></i>
                            </button>
                            <button class="btn-edit-tool quick-action-btn" data-action="view" data-id="${p.id}" title="عرض الملف">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                        </div>
                    </div>
                `;
                }).join('');
                this.elements.globalSuggestions.style.display = 'block';

                // Add event listeners to items and buttons
                this.elements.globalSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
                    item.onclick = () => {
                        const id = item.dataset.id;
                        window.patientFileUI.open(id);
                    };

                    item.querySelectorAll('.quick-action-btn').forEach(btn => {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            const id = btn.dataset.id;
                            const action = btn.dataset.action;
                            if (action === 'prescribe') {
                                window.location.href = `editor.html?patientId=${id}`;
                            } else {
                                window.patientFileUI.open(id);
                            }
                        };
                    });
                });
            } else {
                this.elements.globalSuggestions.innerHTML = `
                    <div class="suggestion-item" style="cursor:default; color: #ef4444; justify-content: center; padding: 20px;">
                        <i class="fa-solid fa-user-slash" style="margin-left: 10px;"></i> مريض غير مسجل..
                    </div>
                `;
                this.elements.globalSuggestions.style.display = 'block';
            }
        };

        this.elements.globalSearch.onblur = () => {
            setTimeout(() => {
                this.elements.globalSuggestions.style.display = 'none';
            }, 300);
        };
    }

    initAppointmentLogic() {
        const appointmentModal = document.getElementById('appointment-booking-modal');
        const appointmentForm = document.getElementById('appointment-booking-form');

        if (this.elements.appointmentPatientName) {
            this.elements.appointmentPatientName.oninput = (e) => {
                const query = e.target.value.trim();
                if (query.length < 1) {
                    this.elements.appointmentSuggestions.style.display = 'none';
                    return;
                }

                const patients = syncManager.getPatientsByClinic().filter(p => p.name.includes(query));
                if (patients.length > 0) {
                    this.elements.appointmentSuggestions.innerHTML = patients.map(p => {
                        // Fetch last 2 appointments for history
                        const patientAppointments = (syncManager.data.appointments || [])
                            .filter(a => a.patientId === p.id)
                            .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
                            .slice(0, 2);

                        const historyHTML = patientAppointments.length > 0
                            ? `<div style="margin-top: 5px; border-top: 1px inset rgba(255,255,255,0.1); padding-top: 3px;">
                                 <span style="color: #94a3b8; font-size: 0.7rem;">السجل: </span>
                                 ${patientAppointments.map(a => `<span style="background: rgba(0, 234, 255, 0.05); color: #00eaff; padding: 1px 4px; border-radius: 4px; font-size: 0.65rem; margin-right: 3px;">${a.service}</span>`).join('')}
                               </div>`
                            : '';

                        return `
                            <div class="suggestion-item" data-id="${p.id}" data-name="${p.name}" style="padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <div style="display:flex; flex-direction:column; width: 100%;">
                                    <div style="display:flex; justify-content:space-between; align-items:center;">
                                        <span style="font-weight:bold; color: #fff;">${p.name}</span>
                                        <small style="color:var(--accent-blue);">#${p.patientCode || '---'}</small>
                                    </div>
                                    <div style="color: #f59e0b; font-size: 0.75rem; margin-top: 2px;"><i class="fa-solid fa-comment-dots"></i> ${p.permanentNotes || 'لا توجد ملاحظات'}</div>
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2px; opacity: 0.7; font-size: 0.7rem;">
                                        <span><i class="fa-solid fa-phone"></i> ${p.phone || '--'}</span>
                                        <span><i class="fa-solid fa-calendar-day"></i> ${p.age || '--'}</span>
                                    </div>
                                    ${historyHTML}
                                </div>
                            </div>
                        `;
                    }).join('');
                    this.elements.appointmentSuggestions.style.display = 'block';

                    // Add click listeners
                    this.elements.appointmentSuggestions.querySelectorAll('.suggestion-item').forEach(item => {
                        item.onclick = () => {
                            this.elements.appointmentPatientName.value = item.dataset.name;
                            this.elements.appointmentPatientName.dataset.selectedId = item.dataset.id;
                            this.elements.appointmentSuggestions.style.display = 'none';
                        };
                    });
                } else {
                    this.elements.appointmentSuggestions.innerHTML = `
                        <div class="suggestion-item" style="cursor:default; color: #ef4444;">
                            مريض غير مسجل.. يرجى إضافته أولاً
                        </div>
                    `;
                    this.elements.appointmentSuggestions.style.display = 'block';
                }
            };

            this.elements.appointmentPatientName.onblur = () => {
                setTimeout(() => this.elements.appointmentSuggestions.style.display = 'none', 200);
            };
        }

        if (appointmentForm) {
            appointmentForm.onsubmit = (e) => {
                e.preventDefault();
                const selectedPatientId = this.elements.appointmentPatientName.dataset.selectedId;

                if (!selectedPatientId) {
                    showNeuroModal('تنببه', 'يرجى اختيار مريض من القائمة المنسدلة. إذا كان مريضاً جديداً، يرجى إضافته من تبويب إدارة المرضى أولاً.', null, false);
                    return;
                }

                // Read Date from Split Fields
                const dayVal = document.getElementById('book-day-appointment').value;
                const monthVal = document.getElementById('book-month-appointment').value;
                const yearVal = document.getElementById('book-year-appointment').value;

                if (!dayVal || !monthVal || !yearVal) {
                    showNeuroModal('خطأ', 'يرجى تحديد تاريخ الموعد بالكامل (اليوم، الشهر، السنة).', null, false);
                    return;
                }

                const dVal = `${yearVal}-${monthVal}-${dayVal}`;

                // Read Time
                const hVal = parseInt(document.getElementById('book-hour-appointment').value);
                const mVal = parseInt(document.getElementById('book-minute-appointment').value);
                const ampmVal = document.getElementById('book-ampm-appointment').value;

                let hour24 = ampmVal === 'PM' ? (hVal === 12 ? 12 : hVal + 12) : (hVal === 12 ? 0 : hVal);
                const combinedDatetime = `${dVal}T${String(hour24).padStart(2, '0')}:${String(mVal).padStart(2, '0')}`;

                const appData = {
                    patientId: selectedPatientId,
                    patientName: this.elements.appointmentPatientName.value,
                    service: document.getElementById('book-service-appointment').value,
                    datetime: combinedDatetime,
                    cost: document.getElementById('book-cost-appointment').value,
                    paid: document.getElementById('book-paid-appointment').value
                };

                if (appointmentForm.dataset.editId) {
                    appData.id = appointmentForm.dataset.editId;
                    appointmentManager.updateAppointment(appData);
                    showNeuroModal('تم الحفظ', 'تم تعديل الموعد بنجاح.', null, false);
                } else {
                    appointmentManager.addAppointment(appData);
                    showNeuroModal('نجاح', 'تم حجز الموعد بنجاح.', null, false);
                }

                appointmentModal.style.display = 'none';
                e.target.reset();
                delete this.elements.appointmentPatientName.dataset.selectedId;
                delete appointmentForm.dataset.editId;
                this.updateStats();
                this.renderTodayAppointments();
                if (this.tables.allAppointments) this.renderAllAppointments();
            };
        }
    }

    initPatientLogic() {
        const patientBtn = document.getElementById('btn-add-new-patient');
        const patientModal = document.getElementById('booking-modal');
        const patientForm = document.getElementById('booking-form');

        if (patientBtn) {
            patientBtn.onclick = () => {
                patientModal.style.display = 'flex';
                patientForm.reset();
                delete patientForm.dataset.editId;
                // Reset gender toggle to neutral
                const m = document.getElementById('gender-male');
                const f = document.getElementById('gender-female');
                const g = document.getElementById('book-gender');
                if (m && f && g) {
                    m.style.background = 'transparent'; m.style.color = '#94a3b8';
                    f.style.background = 'transparent'; f.style.color = '#94a3b8';
                    g.value = '';
                }
            };
        }

        // Gender Toggle Logic (Add Patient)
        const maleBtn = document.getElementById('gender-male');
        const femaleBtn = document.getElementById('gender-female');
        const genderInput = document.getElementById('book-gender');
        if (maleBtn && femaleBtn && genderInput) {
            const setGender = (isMale) => {
                maleBtn.style.background = isMale ? 'var(--theme-accent)' : 'transparent';
                maleBtn.style.color = isMale ? 'var(--theme-text-accent)' : 'var(--text-secondary)';
                femaleBtn.style.background = isMale ? 'transparent' : 'var(--theme-accent)';
                femaleBtn.style.color = isMale ? 'var(--text-secondary)' : 'var(--theme-text-accent)';
                genderInput.value = isMale ? 'ذكر' : 'أنثى';

                // Add border highlight to active
                maleBtn.style.border = isMale ? '2px solid #fff' : 'none';
                femaleBtn.style.border = isMale ? 'none' : '2px solid #fff';
            };
            maleBtn.onclick = () => setGender(true);
            femaleBtn.onclick = () => setGender(false);
        }

        const closePatientBtn = document.getElementById('btn-close-booking');
        if (closePatientBtn) closePatientBtn.onclick = () => patientModal.style.display = 'none';



        if (patientForm) {
            let isSavingPatient = false;

            const savePatientAction = async () => {
                if (isSavingPatient) return null;

                const fullName = document.getElementById('book-patient-name').value.trim();
                const ageNum = document.getElementById('book-age-number').value || 0;
                const ageUnit = document.getElementById('book-age-unit').value || 'سنة';

                if (!fullName) {
                    window.soundManager.playError();
                    showNeuroModal('بيانات ناقصة', 'يرجى إدخال اسم المريض بالكامل.', null, false);
                    return null;
                }

                const genderVal = document.getElementById('book-gender').value;
                if (!genderVal) {
                    window.soundManager.playError();
                    showNeuroModal('تنبيه', 'يرجى اختيار جنس المريض (ذكر أو أنثى).', null, false);
                    return null;
                }

                // Construct Age String (New Engineering Standard)
                const ageStr = `${ageNum} ${ageUnit}`;

                const patientData = {
                    name: fullName,
                    age: ageStr,
                    gender: genderVal,
                    phone: document.getElementById('book-phone').value.trim(),
                    allergies: document.getElementById('book-allergies').value,
                    permanentNotes: document.getElementById('book-notes').value
                };

                if (!patientData.phone || patientData.phone.length < 7) {
                    window.soundManager.playError();
                    showNeuroModal('خطأ التحقق', 'يرجى إدخال رقم هاتف صحيح (7 أرقام على الأقل).', null, false);
                    return null;
                }

                if (patientForm.dataset.editId) {
                    patientData.id = patientForm.dataset.editId;
                }

                // UI Protection: Disable Buttons
                isSavingPatient = true;
                const submitBtn = patientForm.querySelector('button[type="submit"]');
                const saveAndBookBtn = document.getElementById('btn-save-and-book');
                if (submitBtn) submitBtn.disabled = true;
                if (saveAndBookBtn) saveAndBookBtn.disabled = true;

                try {
                    const result = await syncManager.upsertPatient(patientData);
                    this.updateStats();
                    this.renderPatientsManagement();
                    return result;
                } catch (err) {
                    window.soundManager.playError();
                    console.error("Error saving patient:", err);
                    alert("حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى.");
                    return null;
                } finally {
                    isSavingPatient = false;
                    if (submitBtn) submitBtn.disabled = false;
                    if (saveAndBookBtn) saveAndBookBtn.disabled = false;
                }
            };

            patientForm.onsubmit = async (e) => {
                e.preventDefault();
                const saved = await savePatientAction();
                if (saved) {
                    patientModal.style.display = 'none';
                    window.soundManager.playSuccess();
                    showNeuroModal('تم الحفظ', 'تم حفظ بيانات المريض بنجاح.', null, false);
                }
            };

            const saveAndBookBtn = document.getElementById('btn-save-and-book');
            if (saveAndBookBtn) {
                saveAndBookBtn.onclick = async () => {
                    const savedPatient = await savePatientAction();
                    if (savedPatient) {
                        patientModal.style.display = 'none';
                        window.soundManager.playSuccess();

                        // Open Appointment Modal
                        const appointmentModal = document.getElementById('appointment-booking-modal');
                        if (appointmentModal) {
                            // We use the shared openModal if available, or just set display
                            appointmentModal.style.display = 'flex';

                            // Auto-fill patient info
                            const nameInput = document.getElementById('book-patient-name-appointment');
                            if (nameInput) {
                                nameInput.value = savedPatient.name;
                                nameInput.dataset.selectedId = savedPatient.id;
                                // Trigger any search/suggestions hide logic if needed
                                const suggestions = document.getElementById('appointment-name-suggestions');
                                if (suggestions) suggestions.style.display = 'none';
                            }

                            // Auto-fill default datetime
                            const now = new Date();
                            const dSel = document.getElementById('book-day-appointment');
                            const mSel = document.getElementById('book-month-appointment');
                            const ySel = document.getElementById('book-year-appointment');
                            if (dSel && mSel && ySel) {
                                dSel.value = String(now.getDate()).padStart(2, '0');
                                mSel.value = String(now.getMonth() + 1).padStart(2, '0');
                                ySel.value = now.getFullYear();
                            }

                            let hours = now.getHours();
                            const mins = now.getMinutes();
                            const ampm = hours >= 12 ? 'PM' : 'AM';
                            hours = hours % 12 || 12;

                            const hInput = document.getElementById('book-hour-appointment');
                            const mInput = document.getElementById('book-minute-appointment');
                            const ampmInput = document.getElementById('book-ampm-appointment');
                            if (hInput) hInput.value = hours;
                            if (mInput) mInput.value = mins;
                            if (ampmInput) ampmInput.value = ampm;
                        }
                    }
                };
            }
        }

        const expenseBtn = document.getElementById('btn-add-expense');
        if (expenseBtn) {
            expenseBtn.onclick = () => {
                const modalFormHTML = `
                    <div style="text-align: center;">
                        <input type="radio" name="expense-type" value="Clinic" checked id="radio-clinic" style="display:none">
                        <input type="radio" name="expense-type" value="Patient" id="radio-patient" style="display:none">
                        
                        <!-- Toggle Buttons -->
                        <div style="margin-bottom: 25px; display: flex; gap: 15px; justify-content: center; background: rgba(255,255,255,0.03); padding: 8px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
                            <label for="radio-clinic" id="label-clinic" style="flex:1; cursor: pointer; padding: 10px; border-radius: 8px; color: #fff; background: rgba(0,234,255,0.1); border: 1px solid var(--accent-blue); font-weight: 600; text-align:center; transition:0.3s; border: 1px solid var(--accent-blue);">
                                 عيادة (عام)
                            </label>
                            <label for="radio-patient" id="label-patient" style="flex:1; cursor: pointer; padding: 10px; border-radius: 8px; color: var(--text-secondary); border: 1px solid transparent; font-weight: 600; text-align:center; transition:0.3s;">
                                 خاص بمريض
                            </label>
                        </div>

                        <!-- Patient Search Section -->
                        <div id="patient-selector-container" style="display: none; margin-bottom: 15px; position: relative; text-align: right;">
                             <label style="display: block; color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem;">اختر المريض المستفيد</label>
                             <input type="text" id="expense-patient-search" class="neuro-input" placeholder="ابحث باسم المريض..." autocomplete="off" style="width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); padding: 12px; border-radius: 10px; color: #fff; outline: none; font-size:1rem;">
                             <div id="expense-patient-suggestions" class="autocomplete-suggestions" style="display: none; position: absolute; width: 100%; z-index: 1000; top: 100%; background: #1e293b; border: 1px solid var(--glass-border); border-radius: 0 0 10px 10px; max-height:200px; overflow-y:auto;"></div>
                        </div>

                        <div style="margin-bottom: 15px; text-align: right;">
                            <label style="display: block; color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem;">بيان المصروف</label>
                            <input type="text" id="expense-desc" class="neuro-input" placeholder="اسم المصروف..." style="width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); padding: 12px; border-radius: 10px; color: #fff; outline: none; font-size:1rem;">
                        </div>
                        <div style="text-align: right;">
                            <label style="display: block; color: var(--text-secondary); margin-bottom: 8px; font-size: 0.9rem;">المبلغ (EGP)</label>
                            <input type="number" id="expense-amount" class="neuro-input" placeholder="0.00" style="width: 100%; background: rgba(15, 23, 42, 0.6); border: 1px solid var(--glass-border); padding: 12px; border-radius: 10px; color: #fff; outline: none; font-size:1rem; font-weight:bold; color: var(--accent-blue);">
                        </div>
                    </div>
                `;

                // Logic: Toggle visibility and Search
                setTimeout(() => {
                    const radios = document.getElementsByName('expense-type');
                    const patientContainer = document.getElementById('patient-selector-container');
                    const searchInput = document.getElementById('expense-patient-search');
                    const suggestionsBox = document.getElementById('expense-patient-suggestions');
                    const labelClinic = document.getElementById('label-clinic');
                    const labelPatient = document.getElementById('label-patient');

                    // 1. Toggle
                    radios.forEach(r => {
                        r.addEventListener('change', (e) => {
                            if (e.target.value === 'Patient') {
                                patientContainer.style.display = 'block';
                                labelPatient.style.background = 'rgba(0,234,255,0.1)';
                                labelPatient.style.color = '#fff';
                                labelPatient.style.border = '1px solid var(--accent-blue)';

                                labelClinic.style.background = 'transparent';
                                labelClinic.style.color = 'var(--text-secondary)';
                                labelClinic.style.border = '1px solid transparent';
                            } else {
                                patientContainer.style.display = 'none';
                                labelClinic.style.background = 'rgba(0,234,255,0.1)';
                                labelClinic.style.color = '#fff';
                                labelClinic.style.border = '1px solid var(--accent-blue)';

                                labelPatient.style.background = 'transparent';
                                labelPatient.style.color = 'var(--text-secondary)';
                                labelPatient.style.border = '1px solid transparent';

                                // Reset
                                searchInput.value = '';
                                delete searchInput.dataset.selectedId;
                            }
                        });
                    });

                    // 2. Search
                    searchInput.addEventListener('input', (e) => {
                        const query = e.target.value.trim();
                        if (query.length < 1) {
                            suggestionsBox.style.display = 'none';
                            return;
                        }

                        const matches = syncManager.getPatients().filter(p => p.name.includes(query) || (p.phone && p.phone.includes(query)));
                        if (matches.length > 0) {
                            suggestionsBox.innerHTML = matches.map(p => `
                                <div class="suggestion-item" data-id="${p.id}" data-name="${p.name}" style="padding: 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">
                                    <div style="font-weight:bold; color:#fff;">${p.name}</div>
                                    <div style="font-size:0.8rem; color:#94a3b8;">${p.phone || '--'}</div>
                                </div>
                            `).join('');
                            suggestionsBox.style.display = 'block';

                            suggestionsBox.querySelectorAll('.suggestion-item').forEach(item => {
                                item.onclick = () => {
                                    searchInput.value = item.dataset.name;
                                    searchInput.dataset.selectedId = item.dataset.id;
                                    suggestionsBox.style.display = 'none';
                                };
                            });
                        } else {
                            suggestionsBox.innerHTML = `<div style="padding:10px; color:#ef4444; text-align:center;">لا يوجد مريض بهذا الاسم</div>`;
                            suggestionsBox.style.display = 'block';
                        }
                    });

                    searchInput.addEventListener('blur', () => setTimeout(() => suggestionsBox.style.display = 'none', 200));

                }, 100);

                showNeuroModal('تسجيل مصروف', modalFormHTML, () => {
                    const desc = document.getElementById('expense-desc').value;
                    const amount = document.getElementById('expense-amount').value;
                    const typeRadio = document.querySelector('input[name="expense-type"]:checked');

                    if (!desc || !amount) {
                        alert('يرجى ملء بيان المصروف والمبلغ');
                        return false;
                    }

                    let beneficiary = 'Clinic'; // Default
                    if (typeRadio.value === 'Patient') {
                        const searchInput = document.getElementById('expense-patient-search');
                        if (!searchInput.dataset.selectedId) {
                            alert('يرجى اختيار مريض من القائمة المنسدلة (يجب أن يكون مسجلاً مسبقاً)');
                            return false;
                        }
                        beneficiary = searchInput.value; // Store the patient NAME to display in the table
                    }

                    this.addTx('expense', amount, desc, beneficiary);
                    return true;
                }, true);
            };
        }

        setInterval(() => {
            this.updateStats();
            this.renderTodayAppointments();
        }, 60000);
    }

    startModalClock() {
        // Digital Units
        const hEl = document.getElementById('digital-h');
        const mEl = document.getElementById('digital-m');
        const sEl = document.getElementById('digital-s');
        const ampmEl = document.getElementById('digital-ampm');
        const dateEl = document.getElementById('modal-clock-date');

        // Analog hands
        const hourHand = document.getElementById('analog-hour');
        const minuteHand = document.getElementById('analog-minute');
        const secondHand = document.getElementById('analog-second');

        if (!dateEl) return;

        const update = () => {
            const now = new Date();

            // Time logic
            const seconds = now.getSeconds();
            const minutes = now.getMinutes();
            const hours = now.getHours();

            // Digital Update (Multi-Color)
            if (hEl) hEl.textContent = String(hours % 12 || 12).padStart(2, '0');
            if (mEl) mEl.textContent = String(minutes).padStart(2, '0');
            if (sEl) sEl.textContent = String(seconds).padStart(2, '0');
            if (ampmEl) ampmEl.textContent = hours >= 12 ? 'مساءً' : 'صباحاً';

            // Analog Rotation
            if (secondHand) {
                const sDeg = (seconds / 60) * 360;
                secondHand.style.transform = `translateX(-50%) rotate(${sDeg}deg)`;
            }
            if (minuteHand) {
                const mDeg = (minutes / 60) * 360 + (seconds / 60) * 6;
                minuteHand.style.transform = `translateX(-50%) rotate(${mDeg}deg)`;
            }
            if (hourHand) {
                const hDeg = ((hours % 12) / 12) * 360 + (minutes / 60) * 30;
                hourHand.style.transform = `translateX(-50%) rotate(${hDeg}deg)`;
            }

            // Date (Arabic Locale)
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            dateEl.textContent = now.toLocaleDateString('ar-EG', options);
        };

        update();
        setInterval(update, 1000);
    }


    updateStats() {
        const patients = syncManager.getPatientsByClinic();
        const appointments = syncManager.getAppointmentsByClinic();
        const transactions = syncManager.getTransactionsByClinic();

        const activeClinic = syncManager.getActiveClinic();
        const currency = "EGP"; // Default currency

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const currentMonthStr = todayStr.substring(0, 7);

        // --- Today's Stats ---
        const apptsToday = appointments.filter(a => a.datetime && a.datetime.split('T')[0] === todayStr).length;

        // --- Monthly Financials ---
        const monthlyTransactions = transactions.filter(t => t.date && t.date.substring(0, 7) === currentMonthStr);
        const income = monthlyTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const expenses = monthlyTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
        const netProfit = income - expenses;

        // --- All-time Dues ---
        let totalDues = 0;
        const ledgers = syncManager.data.finances.ledger || {};
        Object.values(ledgers).forEach(ledger => {
            if (ledger && ledger.balance < 0) totalDues += Math.abs(ledger.balance);
        });

        // Update UI Elements
        if (this.stats.patients) this.stats.patients.textContent = patients.length || 0;
        if (this.stats.appointments) this.stats.appointments.textContent = apptsToday || 0;
        if (this.stats.income) this.stats.income.textContent = income.toLocaleString() + " " + currency;
        if (this.stats.expenses) this.stats.expenses.textContent = expenses.toLocaleString() + " " + currency;
        if (this.stats.dues) this.stats.dues.textContent = totalDues.toLocaleString() + " " + currency;
        if (this.stats.netProfit) {
            this.stats.netProfit.textContent = netProfit.toLocaleString() + " " + currency;
            this.stats.netProfit.style.color = netProfit >= 0 ? '#10b981' : '#ef4444';
        }

        // Force Sync Status UI update
        if (window.syncManager) window.syncManager.updateSyncUI();
    }

    initSettingsLogic() {
        // Handle Sidebar Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.onclick = () => {
                const view = item.dataset.view;
                if (!view) return;
                
                this.switchView(view);
                
                if (view === 'settings') {
                    this.loadSettingsView();
                } else if (view === 'patients') {
                    this.renderPatientsManagement();
                } else if (view === 'finance') {
                    this.renderFinanceTable();
                } else if (view === 'appointments') {
                    this.renderAllAppointments();
                }
            };
        });

        // Shutdown App Logic
        const shutdownBtn = document.getElementById('btn-shutdown');
        if (shutdownBtn) {
            shutdownBtn.onclick = () => this.shutdownApp();
        }
    }


    renderAllAppointments() {
        const appointments = syncManager.getAppointmentsByClinic();
        if (!this.tables.allAppointments) return;

        // Initialize Archive Controls (Once)
        const archiveFilter = document.getElementById('appointment-archive-filter');
        const resetArchiveBtn = document.getElementById('btn-reset-archive');

        if (archiveFilter && !archiveFilter.dataset.initialized) {
            // Set default to current month
            const now = new Date();
            const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
            archiveFilter.value = currentMonth;

            // Event Listeners
            archiveFilter.addEventListener('change', () => this.renderAllAppointments());

            if (resetArchiveBtn) {
                resetArchiveBtn.addEventListener('click', () => {
                    archiveFilter.value = currentMonth;
                    this.renderAllAppointments();
                });
            }

            archiveFilter.dataset.initialized = 'true';
        }

        // Apply Filter
        let filteredAppointments = appointments;
        if (archiveFilter && archiveFilter.value) {
            const selectedMonth = archiveFilter.value; // YYYY-MM
            filteredAppointments = appointments.filter(app => app.datetime.startsWith(selectedMonth));
        }

        // Sort by date desc
        const sortedList = filteredAppointments.slice().sort((a, b) => new Date(b.datetime) - new Date(a.datetime));

        this.tables.allAppointments.innerHTML = sortedList.map(app => {
            const remaining = parseFloat(app.cost || 0) - parseFloat(app.paid || 0);
            let statusHTML = `
                <div style="font-size: 0.85rem; line-height: 1.4;">
                    <div style="color: #94a3b8;">إجمالي: ${app.cost}</div>
                    <div style="color: #10b981;">مدفوع: ${app.paid}</div>
                    ${remaining > 0 ? `<div style="color: #ef4444; font-weight: 700;">باقي: ${remaining}</div>` : '<div style="color: #10b981; font-weight: 700;">خالص</div>'}
                </div>
            `;

            return `
            <tr onclick="window.patientFileUI.open('${app.patientId}')" style="cursor:pointer">
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 32px; height: 32px; border-radius: 8px; background: #0f172a; border: 1px solid var(--accent-blue); display:flex; align-items:center; justify-content:center; color: var(--accent-blue); font-size: 0.8rem; box-shadow: 0 0 10px rgba(0, 234, 255, 0.1);">
                            ${app.patientName ? app.patientName.charAt(0) : '?'}
                        </div>
                        <strong style="color: #fff;">${app.patientName || 'مجهول'}</strong>
                    </div>
                </td>
                <td style="color: var(--accent-glow); font-weight: 600;">${new Date(app.datetime).toLocaleString('ar-EG')}</td>
                <td>${app.service}</td>
                <td>${statusHTML}</td>
                <td>
                    <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.editAppointment('${app.id}')" title="تعديل" style="margin-left:5px;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                     <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.deleteAppointment('${app.id}')" title="حذف" style="margin-left:5px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    <button class="btn-edit-tool" onclick="event.stopPropagation(); window.patientFileUI.open('${app.patientId}')" title="عرض الملف">
                         <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.handleQueueAction('${app.id}', '${app.patientId}')" title="إدارة الطابور" style="color: #f59e0b; border-color: rgba(245, 158, 11, 0.3);">
                         <i class="fa-solid fa-person-walking-arrow-right"></i>
                    </button>
                </td>
            </tr>
        `}).join('');

        if (sortedList.length === 0) {
            this.tables.allAppointments.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:20px;">لا يوجد مواعيد مسجلة</td></tr>';
        }
    }

    renderPatientsManagement() {
        const patients = syncManager.getPatientsByClinic();
        // The original code used `this.tables.managePatients` which is now `this.tables.patients`
        // Assuming the user wants to render into the new 'view-patients' container,
        // I'll use a generic querySelector for the table body within that view.
        const patientTableBody = document.querySelector('#view-patients .neuro-table tbody');
        if (!patientTableBody) return;

        patientTableBody.innerHTML = patients.map(p => `
            <tr>
                <td style="color: var(--accent-blue); font-weight: 800; font-family: 'Inter';">#${p.patientCode || '10x'}#</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <div style="width: 35px; height: 35px; border-radius: 10px; background: var(--bg-deep); border: 1px solid var(--accent-blue); display:flex; align-items:center; justify-content:center; color: var(--accent-blue); font-weight: 800; box-shadow: 0 0 15px var(--glass-border);">
                            ${p.name.charAt(0)}
                        </div>
                        <strong style="color: var(--text-primary); font-size: 1rem;">${p.name}</strong>
                    </div>
                </td>
                <td style="color: var(--text-primary); font-weight: 600;">${p.age || '--'}</td>
                <td style="color: var(--text-secondary);">${p.phone || '--'}</td>
                <td style="color: var(--accent-blue); font-size: 0.9rem;">${p.visits && p.visits.length > 0 ? p.visits[0].date : 'بدون زيارات'}</td>
                <td>
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-edit-tool" onclick="event.stopPropagation(); window.patientFileUI.open('${p.id}')" title="تعديل البيانات">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-neuro" onclick="event.stopPropagation(); window.patientFileUI.open('${p.id}')" style="padding: 8px 15px; font-size: 0.75rem; animation: none; box-shadow: none;">
                            <i class="fa-solid fa-file-invoice-dollar"></i> الحسابات
                        </button>
                        <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.deletePatientDirect('${p.id}')" title="حذف المريض نهائياً" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    renderFinanceTable() {
        const transactions = syncManager.getTransactionsByClinic();
        const financeTableBody = document.querySelector('#view-finance .neuro-table tbody');

        // Render Charts
        if (window.financialCharts) {
            window.financialCharts.renderRevenueChart('revenue-chart-container');
            window.financialCharts.renderExpenseBreakdown('expense-pie-chart-container');
            window.financialCharts.renderFinancialSummary('financial-summary-container');
        }

        if (!financeTableBody) return;

        financeTableBody.innerHTML = transactions.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).map(t => `
            <tr>
                <td>${new Date(t.date).toLocaleDateString('ar-EG')}</td>
                <td>${t.description}</td>
                <td><span class="status-badge" style="background: ${t.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; color: ${t.type === 'income' ? '#10b981' : '#ef4444'}; border: 1px solid ${t.type === 'income' ? '#10b981' : '#ef4444'};">${t.type === 'income' ? 'دخول (إيراد)' : 'خروج (مصروف)'}</span></td>
                <td style="font-weight: 800; color: ${t.type === 'income' ? '#10b981' : '#ef4444'};">${t.type === 'income' ? '+' : '-'}${parseFloat(t.amount || 0).toLocaleString()} EGP</td>
                <td style="color: #94a3b8;">${!!t.beneficiary && t.beneficiary !== 'Clinic' ? '<i class="fa-solid fa-user-tag"></i> ' + t.beneficiary : '<i class="fa-solid fa-building-medical"></i> العيادة'}</td>
                <td>
                    <button class="btn-edit-tool" onclick="dashboardUI.editTransaction('${t.id}')" title="تعديل">
                        <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    <button class="btn-edit-tool" onclick="dashboardUI.deleteTransaction('${t.id}')" style="color:#ef4444; border-color:rgba(239,68,68,0.2)" title="حذف">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    editPatient(id) {
        const p = syncManager.getPatients().find(pat => pat.id === id);
        if (!p) return;

        const modal = document.getElementById('booking-modal');
        const form = document.getElementById('booking-form');

        // Split name into 4 parts
        const nameParts = p.name ? p.name.split(' ') : [];
        if (document.getElementById('book-name-1')) document.getElementById('book-name-1').value = nameParts[0] || '';
        if (document.getElementById('book-name-2')) document.getElementById('book-name-2').value = nameParts[1] || '';
        if (document.getElementById('book-name-3')) document.getElementById('book-name-3').value = nameParts[2] || '';
        if (document.getElementById('book-name-4')) document.getElementById('book-name-4').value = nameParts.slice(3).join(' ') || '';

        // Old field cleanup just in case
        if (document.getElementById('book-patient-name')) document.getElementById('book-patient-name').value = p.name;
        document.getElementById('book-age').value = p.age || '';
        document.getElementById('book-gender').value = p.gender || 'ذكر';
        document.getElementById('book-phone').value = p.phone || '';
        document.getElementById('book-allergies').value = p.allergies || '';
        document.getElementById('book-notes').value = p.permanentNotes || '';

        form.dataset.editId = id;
        modal.style.display = 'flex';
    }


    editAppointment(id) {
        const app = syncManager.data.appointments.find(a => a.id === id);
        if (!app) return;

        const modal = document.getElementById('appointment-booking-modal');
        const form = document.getElementById('appointment-booking-form');

        // Populate fields
        this.elements.appointmentPatientName.value = app.patientName;
        this.elements.appointmentPatientName.dataset.selectedId = app.patientId;
        document.getElementById('book-service-appointment').value = app.service;

        // Deconstruct datetime into split fields
        const [d, t] = app.datetime.split('T');

        // Split date (YYYY-MM-DD) into separate fields
        if (d) {
            const [year, month, day] = d.split('-');
            document.getElementById('book-day-appointment').value = day;
            document.getElementById('book-month-appointment').value = month;
            document.getElementById('book-year-appointment').value = year;
        }

        // Split time
        if (t) {
            let [h, m] = t.split(':').map(Number);
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            document.getElementById('book-hour-appointment').value = h;
            document.getElementById('book-minute-appointment').value = m;
            document.getElementById('book-ampm-appointment').value = ampm;
        }

        document.getElementById('book-cost-appointment').value = app.cost;
        document.getElementById('book-paid-appointment').value = app.paid;

        form.dataset.editId = id;
        modal.style.display = 'flex';
    }

    deleteAppointment(id) {
        if (!window.authManager.isAdmin()) {
            window.soundManager.playError();
            window.showNeuroToast('عفواً، صلاحية حذف المواعيد للمدير فقط.', 'error');
            return;
        }
        window.soundManager.playDeleteWarning();
        showNeuroModal('حذف الموعد', 'هل أنت متأكد من حذف هذا الموعد نهائياً؟', () => {
            appointmentManager.deleteAppointment(id);
            this.updateStats();
            this.renderTodayAppointments();
            if (this.tables.allAppointments) this.renderAllAppointments();
            window.soundManager.playSuccess();
            showNeuroModal('تم الحذف', 'تم حذف الموعد بنجاح.', null, false);
        }, true);
    }





    deletePatientDirect(id) {
        if (!window.authManager.isAdmin()) {
            window.soundManager.playError();
            window.showNeuroToast('عفواً، صلاحية حذف المرضى للمدير فقط.', 'error');
            return;
        }
        window.soundManager.playDeleteWarning();
        showNeuroModal('تحذير نهائي', 'هل أنت متأكد من حذف هذا المريض؟ سيؤدي ذلك لمسح كافة بياناته الطبية وحساباته فوراً.', () => {
            syncManager.deletePatient(id);
            this.renderPatientsManagement();
            this.updateStats();
            window.soundManager.playSuccess();
            showNeuroModal('تم الحذف', 'تم مسح سجل المريض بنجاح.', null, false);
        }, true);
    }

    renderTodayAppointments() {
        const apps = syncManager.getAppointmentsByClinic();
        const today = new Date().toDateString();
        const todaysList = apps.filter(a => new Date(a.datetime).toDateString() === today);
        todaysList.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

        if (!this.tables.todayAppointments) return;

        // Fetch latest patients data
        const allPatients = window.syncManager.getPatients();

        this.tables.todayAppointments.innerHTML = todaysList.map(app => {
            const time = new Date(app.datetime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

            // Get latest patient name
            let currentPatientName = app.patientName;
            if (app.patientId) {
                const patient = allPatients.find(p => p.id === app.patientId);
                if (patient) currentPatientName = patient.name;
            }

            // Queue Action Calculation
            let queueActionBtn = '';

            // Check if in queue
            const queueList = window.queueManager ? window.queueManager.getActiveQueue() : [];
            const queueItem = queueList.find(q => q.appointmentId === app.id);

            if (!queueItem) {
                // Not in queue -> Show Check-in
                queueActionBtn = `
                    <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.handleQueueAction('${app.id}', '${app.patientId}', 'check-in', '${currentPatientName}')" title="تسجيل حضور" style="color: #64748b; border: 1px solid #64748b;">
                         <i class="fa-solid fa-person-walking-arrow-right"></i>
                    </button>
                `;
            } else if (queueItem.status === 'waiting') {
                // Waiting -> Call Patient
                queueActionBtn = `
                    <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.handleQueueAction('${app.id}', '${app.patientId}', 'call', '${currentPatientName}', '${queueItem.id}')" title="دخول المريض" style="color: #f59e0b; border-color: #f59e0b; background: rgba(245, 158, 11, 0.1);">
                         <i class="fa-solid fa-bullhorn"></i>
                    </button>
                `;
            } else if (queueItem.status === 'in-progress') {
                // In Progress -> Complete
                queueActionBtn = `
                    <button class="btn-edit-tool" onclick="event.stopPropagation(); window.dashboardUI.handleQueueAction('${app.id}', '${app.patientId}', 'complete', '${currentPatientName}', '${queueItem.id}')" title="إنهاء الزيارة" style="color: #10b981; border-color: #10b981; background: rgba(16, 185, 129, 0.1);">
                         <i class="fa-solid fa-check"></i>
                    </button>
                `;
            } else {
                queueActionBtn = `<span style="color:#10b981; font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> تم</span>`;
            }

            return `
            <tr>
                <td>${time}</td>
                <td><strong>${currentPatientName}</strong></td>
                <td>${app.service}</td>
                <td>
                    <div style="display:flex; gap:5px;">
                        ${queueActionBtn}
                        <button class="btn-edit-tool" onclick="event.stopPropagation(); window.patientFileUI.open('${app.patientId}')">
                             <i class="fa-solid fa-folder-open"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');

        if (todaysList.length === 0) {
            this.tables.todayAppointments.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:20px; color:#64748b;">لا توجد مواعيد اليوم</td></tr>`;
        }
    }

    handleQueueAction(appId, patientId, action, patientName, queueId) {
        if (!window.queueManager) return;

        // Find patient data to ensure we have Name and Code
        const patient = syncManager.data.patients.find(p => p.id === patientId);
        const code = patient ? (patient.patientCode || '101') : '101';
        const name = patient ? patient.name : (patientName || 'مريض');

        if (action === 'check-in' || !action) { // Default to check-in if not specified
            window.queueManager.checkIn(appId, name, code);
            window.soundManager.playSuccess();
            window.showNeuroToast('تم إضافة المريض لقائمة الانتظار', 'success');
        } else if (action === 'call') {
            window.queueManager.updateStatus(queueId, 'in-progress');
            window.soundManager.playBuzz(); // Attention sound
        } else if (action === 'complete') {
            window.queueManager.updateStatus(queueId, 'completed');
            window.soundManager.playSuccess();
        }

        this.renderTodayAppointments();
        if (this.tables.allAppointments) this.renderAllAppointments();
    }

    addTx(type, amount, description, beneficiary) {
        if (!amount || isNaN(amount) || amount <= 0) {
            window.soundManager.playError();
            alert('قيمة المبلغ غير صحيحة');
            return false;
        }

        const activeClinicId = syncManager.data.settings.activeClinicId || 'clinic-default';

        const tx = {
            id: crypto.randomUUID(),
            date: new Date().toISOString(),
            type: type, // 'income' or 'expense'
            amount: parseFloat(amount),
            description: description,
            beneficiary: beneficiary || 'Clinic',
            clinicId: activeClinicId
        };

        syncManager.data.finances.transactions.push(tx);
        syncManager.saveLocal();

        this.renderFinanceTable();
        this.updateStats();
        window.soundManager.playSuccess();

        // If it's a patient payment, update their ledger too (optional logic depending on beneficiary being ID or Name)
        // Here we kept it simple as per original design.

        showNeuroModal('تم الحفظ', 'تم إضافة العملية المالية بنجاح.', null, false);
        return true;
    }

    editTransaction(id) {
        const tx = syncManager.data.finances.transactions.find(t => t.id === id);
        if (!tx) return;

        const modalFormHTML = `
            <div style="text-align: right;">
                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px;">التاريخ</label>
                <input type="datetime-local" id="edit-tx-date" class="neuro-input" value="${tx.date.substring(0, 16)}" style="margin-bottom: 15px; width: 100%;">
                
                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px;">النوع</label>
                <select id="edit-tx-type" class="neuro-input" style="margin-bottom: 15px; width: 100%;">
                    <option value="income" ${tx.type === 'income' ? 'selected' : ''}>إيراد (دخول)</option>
                    <option value="expense" ${tx.type === 'expense' ? 'selected' : ''}>مصروف (خروج)</option>
                </select>

                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px;">البيان</label>
                <input type="text" id="edit-tx-desc" class="neuro-input" value="${tx.description}" style="margin-bottom: 15px; width: 100%;">

                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px;">المبلغ</label>
                <input type="number" id="edit-tx-amount" class="neuro-input" value="${tx.amount}" style="margin-bottom: 15px; width: 100%;">

                <label style="display: block; color: var(--text-secondary); margin-bottom: 8px;">المستفيد / المصدر</label>
                <input type="text" id="edit-tx-beneficiary" class="neuro-input" value="${tx.beneficiary || ''}" style="width: 100%;">
            </div>
        `;

        showNeuroModal('تعديل عملية مالية', modalFormHTML, () => {
            return this.saveTransactionChange(id);
        }, true);
    }

    saveTransactionChange(id) {
        const index = syncManager.data.finances.transactions.findIndex(t => t.id === id);
        if (index === -1) return false;

        const date = document.getElementById('edit-tx-date').value;
        const type = document.getElementById('edit-tx-type').value;
        const desc = document.getElementById('edit-tx-desc').value;
        const amount = parseFloat(document.getElementById('edit-tx-amount').value);
        const beneficiary = document.getElementById('edit-tx-beneficiary').value;

        if (!desc || !amount || isNaN(amount)) {
            alert('بيانات غير مكتملة');
            return false;
        }

        syncManager.data.finances.transactions[index] = {
            ...syncManager.data.finances.transactions[index],
            date: new Date(date).toISOString(),
            type,
            description: desc,
            amount,
            beneficiary
        };
        syncManager.saveLocal();

        this.renderFinanceTable();
        this.updateStats();
        window.soundManager.playSuccess();
        return true;
    }

    deleteTransaction(id) {
        if (!window.authManager.isAdmin()) {
            window.soundManager.playError();
            window.showNeuroToast('عفواً، صلاحية حذف المعاملات المالية للمدير فقط.', 'error');
            return;
        }

        window.soundManager.playDeleteWarning();
        showNeuroModal('حذف', 'هل أنت متأكد من حذف هذه العملية المالية؟ لا يمكن التراجع.', () => {
            syncManager.data.finances.transactions = syncManager.data.finances.transactions.filter(t => t.id !== id);
            syncManager.saveLocal();
            this.renderFinanceTable();
            this.updateStats();
            window.soundManager.playSuccess();
        }, true);
    }

    initUsersAndLogs() {
        // Legacy function - no longer needed
        // User management is now handled through openAddUserModal() in settings
    }

    renderUsers() {
        const activeClinicId = syncManager.data.settings.activeClinicId;
        const users = syncManager.data.users || [];
        const container = document.getElementById('users-list-container');
        if (!container) return;

        container.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                ${users.map(u => {
            const isAdminAccount = u.username === 'admin';
            const clinics = syncManager.getClinics().filter(c => u.assignedClinics?.includes(c.id));
            const clinicsNames = clinics.map(c => c.name).join(' - ') || 'لا يوجد عيادات';

            return `
                    <div class="user-card" style="background: #1e293b; border: 2px solid rgba(0, 234, 255, 0.2); border-radius: 20px; padding: 25px; transition: all 0.3s; position: relative; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
                        <div style="display: flex; align-items: start; gap: 18px; margin-bottom: 20px;">
                            <div style="width: 55px; height: 55px; background: rgba(0, 234, 255, 0.1); border-radius: 15px; display: flex; align-items: center; justify-content: center; color: #00eaff; border: 1px solid rgba(0, 234, 255, 0.3);">
                                <i class="fa-solid ${u.role === 'admin' ? 'fa-user-shield' : (u.role === 'doctor' ? 'fa-user-doctor' : 'fa-user-tie')}" style="font-size: 1.5rem;"></i>
                            </div>
                            <div style="flex: 1;">
                                <h4 style="color: #fff; margin: 0 0 5px 0; font-size: 1.2rem; font-weight: 800;">${u.name}</h4>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                    <span style="color: #00eaff; font-family: 'Inter'; font-size: 0.85rem; font-weight: 600;">@${u.username}</span>
                                    <span style="color: #64748b; font-size: 0.75rem;">•</span>
                                    <span style="background: rgba(16, 185, 129, 0.1); color: #10b981; padding: 2px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700;">
                                        ${this.getRoleLabel(u.role)}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style="background: rgba(0, 234, 255, 0.05); padding: 12px; border-radius: 12px; margin-bottom: 20px; border: 1px dashed rgba(0, 234, 255, 0.2);">
                            <small style="color: #94a3b8; display: block; margin-bottom: 4px; font-size: 0.75rem;">العيادات المتاحة:</small>
                            <span style="color: #fff; font-size: 0.85rem; font-weight: 600; line-height: 1.4;">${clinicsNames}</span>
                        </div>

                        <div style="display: flex; justify-content: flex-end; gap: 10px;">
                            ${isAdminAccount ?
                    `<span style="color: #475569; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;"><i class="fa-solid fa-lock"></i> حساب نظام محمي</span>` :
                    `
                                <button class="btn-edit-tool" onclick="window.dashboardUI.openEditUserModal('${u.id}')" title="تعديل البيانات" style="width: 38px; height: 38px; border-radius: 10px;">
                                    <i class="fa-solid fa-user-pen"></i>
                                </button>
                                <button class="btn-edit-tool" onclick="window.dashboardUI.changeUserPassword('${u.id}')" title="تغيير كلمة المرور" style="color: #00eaff; border-color: rgba(0, 234, 255, 0.1); width: 38px; height: 38px; border-radius: 10px;">
                                    <i class="fa-solid fa-key"></i>
                                </button>
                                <button class="btn-edit-tool" onclick="window.dashboardUI.deleteUser('${u.id}')" title="حذف" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.2); width: 38px; height: 38px; border-radius: 10px;">
                                    <i class="fa-solid fa-user-xmark"></i>
                                </button>
                                `
                }
                        </div>
                    </div>
                    `;
        }).join('')}
            </div>
        `;
    }

    getRoleLabel(role) {
        const map = { 'admin': 'مدير النظام', 'doctor': 'طبيب العيادة', 'secretary': 'فريق السكرتارية' };
        return map[role] || role;
    }

    deleteUser(id) {
        const user = syncManager.data.users.find(u => u.id === id);
        if (user && user.username === 'admin') {
            showNeuroModal('خطأ', 'لا يمكن حذف الحساب الرئيسي للمدير.', null, false);
            return;
        }

        showNeuroModal('تأكيد الحذف', `هل أنت متأكد من حذف المستخدم "${user.name}"؟`, () => {
            if (syncManager.deleteUser(id)) {
                this.renderUsers();
                window.soundManager.playSuccess();
            } else {
                showNeuroModal('خطأ', 'لا يمكن حذف آخر مدير في النظام.', null, false);
            }
        });
    }

    changeUserPassword(id) {
        const user = syncManager.data.users.find(u => u.id === id);
        if (!user) return;

        const modalHTML = `
            <div style="text-align: right;">
                <p style="color: #94a3b8; margin-bottom: 20px;">تغيير كلمة المرور للمستخدم: <strong>${user.name}</strong></p>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">كلمة المرور الجديدة</label>
                    <input type="password" id="user-change-password-input" class="neuro-input" style="width:100%" placeholder="أدخل كلمة المرور الجديدة...">
                </div>
            </div>
        `;

        showNeuroModal('تغيير كلمة المرور', modalHTML, () => {
            const newPassword = document.getElementById('user-change-password-input').value;
            if (!newPassword || newPassword.trim().length < 4) {
                alert('يرجى إدخال كلمة مرور قوية (4 رموز على الأقل)');
                window.soundManager.playError();
                return false;
            }

            if (syncManager.changeUserPassword(id, newPassword)) {
                showNeuroModal('نجاح', 'تم تغيير كلمة المرور بنجاح.', null, false);
                window.soundManager.playSuccess();
                return true;
            }
            return false;
        });
    }

    openAddUserModal() {
        const clinics = syncManager.getClinics();
        const activeDetails = syncManager.getActiveClinic();
        const activeId = activeDetails ? activeDetails.id : null;

        const clinicsOptions = clinics.map(c => `
            <label style="display: flex; align-items: center; gap: 10px; color: #fff; margin-bottom: 8px; cursor: pointer;">
                <input type="checkbox" name="assignedClinic" value="${c.id}" ${c.id === activeId ? 'checked' : ''}> ${c.name}
                ${c.id === activeId ? '<span style="font-size:0.8rem; color:#00eaff;">(الفرع الحالي)</span>' : ''}
            </label>
        `).join('');

        const modalHTML = `
            <div style="text-align: right; max-height: 70vh; overflow-y: auto; padding-left: 10px;">
                <h3 style="color: #10b981; margin-bottom: 20px;"><i class="fa-solid fa-user-plus"></i> إضافة موظف جديد</h3>
                
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">الاسم الكامل للموظف *</label>
                    <input type="text" id="add-user-name" class="neuro-input" style="width:100%" placeholder="مثلاً: أحمد محمد">
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">اسم المستخدم (Username) *</label>
                    <input type="text" id="add-user-username" class="neuro-input" style="width:100%" placeholder="مثلاً: ahmed_2024">
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">كلمة المرور *</label>
                    <input type="password" id="add-user-password" class="neuro-input" style="width:100%" placeholder="أدخل كلمة المرور...">
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">الصلاحية *</label>
                    <select id="add-user-role" class="neuro-input" style="width:100%">
                        <option value="secretary">فريق السكرتارية (حجز وماليات فقط)</option>
                        <option value="doctor">طبيب العيادة (كشف وروشتات)</option>
                        <option value="admin">مدير النظام (تحكم كامل)</option>
                    </select>
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">العيادات المسموح له بالوصول إليها:</label>
                    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        ${clinicsOptions}
                    </div>
                </div>
            </div>
        `;

        showNeuroModal('موظف جديد', modalHTML, () => {
            const name = document.getElementById('add-user-name').value.trim();
            const username = document.getElementById('add-user-username').value.trim();
            const password = document.getElementById('add-user-password').value.trim();
            const role = document.getElementById('add-user-role').value;
            const assignedClinics = Array.from(document.querySelectorAll('input[name="assignedClinic"]:checked')).map(cb => cb.value);

            if (!name || !username || !password) {
                window.showNeuroToast('يرجى إكمال الحقول الإجبارية (*)', 'error');
                window.soundManager.playError();
                return false;
            }

            if (assignedClinics.length === 0) {
                window.showNeuroToast('يجب تعيين عيادة واحدة على الأقل لهذا الموظف!', 'info');
                window.soundManager.playError();
                return false;
            }

            // Check if username already exists
            const exists = syncManager.data.users.find(u => u.username === username);
            if (exists) {
                window.showNeuroToast('اسم المستخدم موجود بالفعل! اختر اسماً آخر.', 'error');
                window.soundManager.playError();
                return false;
            }

            syncManager.addUser({
                name,
                username,
                password,
                role,
                assignedClinics,
                defaultClinic: assignedClinics[0]
            });

            window.soundManager.playSuccess();
            this.renderUsers();
            return true;
        });
    }

    openEditUserModal(id) {
        const user = syncManager.data.users.find(u => u.id === id);
        if (!user) return;

        const clinics = syncManager.getClinics();
        const clinicsOptions = clinics.map(c => `
            <label style="display: flex; align-items: center; gap: 10px; color: #fff; margin-bottom: 8px; cursor: pointer;">
                <input type="checkbox" name="editAssignedClinic" value="${c.id}" ${user.assignedClinics?.includes(c.id) ? 'checked' : ''}> ${c.name}
            </label>
        `).join('');

        const modalHTML = `
            <div style="text-align: right; max-height: 70vh; overflow-y: auto; padding-left: 10px;">
                <h3 style="color: #00eaff; margin-bottom: 20px;"><i class="fa-solid fa-user-pen"></i> تعديل بيانات الموظف</h3>
                
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">الاسم الكامل *</label>
                    <input type="text" id="edit-user-name" class="neuro-input" style="width:100%" value="${user.name}">
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">اسم المستخدم (Username)</label>
                    <input type="text" class="neuro-input" style="width:100%; opacity: 0.6;" value="${user.username}" disabled>
                </div>

                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">الصلاحية *</label>
                    <select id="edit-user-role" class="neuro-input" style="width:100%">
                        <option value="secretary" ${user.role === 'secretary' ? 'selected' : ''}>فريق السكرتارية</option>
                        <option value="doctor" ${user.role === 'doctor' ? 'selected' : ''}>طبيب العيادة</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>مدير النظام</option>
                    </select>
                </div>

                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">تعديل العيادات المتاحة:</label>
                    <div style="background: rgba(0,0,0,0.2); padding: 15px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.05);">
                        ${clinicsOptions}
                    </div>
                </div>
            </div>
        `;

        showNeuroModal('تعديل الموظف', modalHTML, () => {
            const name = document.getElementById('edit-user-name').value.trim();
            const role = document.getElementById('edit-user-role').value;
            const assignedClinics = Array.from(document.querySelectorAll('input[name="editAssignedClinic"]:checked')).map(cb => cb.value);

            if (!name) {
                alert('يرجى إدخال اسم الموظف');
                window.soundManager.playError();
                return false;
            }

            if (assignedClinics.length === 0) {
                alert('يجب تعيين عيادة واحدة على الأقل!');
                window.soundManager.playError();
                return false;
            }

            syncManager.updateUser(id, { name, role, assignedClinics });
            window.soundManager.playSuccess();
            this.renderUsers();
            return true;
        });
    }

    switchView(viewName) {
        Object.values(this.tables).forEach(el => {
            if (el) el.classList.add('hidden');
        });
        if (this.tables[viewName]) {
            this.tables[viewName].classList.remove('hidden');
        }

        // Sidebar active state
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewName) item.classList.add('active');
        });
    }

    loadSettingsView() {
        const settingsContainer = document.getElementById('view-settings');
        if (!settingsContainer) return;

        const currentUser = window.authManager?.currentUser;
        const isAdmin = currentUser?.role === 'admin';

        const healthStatus = window.syncManager.isPullDone ?
            '<span style="color:#10b981"><i class="fa-solid fa-shield-check"></i> متصل ومحمي بمزامنة ذكية</span>' :
            '<span style="color:#f59e0b"><i class="fa-solid fa-arrows-rotate"></i> جاري التحقق من السحابة...</span>';

        settingsContainer.innerHTML = `
            <div style="padding: 20px; direction: rtl; text-align: right;">
                <h2 style="color: var(--text-primary); margin-bottom: 30px; font-size: 1.8rem; font-weight: 900;">
                    <i class="fa-solid fa-gear"></i> الإعدادات
                </h2>

                <!-- Premium Health Status Card -->
                <div style="background: rgba(16, 185, 129, 0.12); border: 2px solid rgba(16, 185, 129, 0.4); border-radius: 20px; padding: 25px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 10px 30px rgba(0,0,0,0.05); color: var(--text-primary);">
                    <div>
                        <h3 style="color: var(--text-primary); margin: 0 0 8px 0; font-size: 1.3rem; font-weight: 800;">حالة أمان النظام والبيانات</h3>
                        <p style="color: var(--text-primary); font-size: 1rem; margin: 0; line-height: 1.6; opacity: 0.9;">تم تفعيل <strong style="text-decoration: underline;">صمامات الأمان</strong> ضد الحذف المفاجئ، ونظام <strong style="text-decoration: underline;">الرفع الذكي</strong> لزيادة السرعة 10 أضعاف.</p>
                    </div>
                    <div style="background: rgba(15, 23, 42, 0.2); padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.6); font-weight: 900; font-size: 1.1rem; min-width: 250px; text-align: center; color: #10b981;">
                        ${healthStatus}
                    </div>
                </div>

                <!-- Clinics Management Section -->
                ${isAdmin ? window.clinicManager.renderClinicsManagement() : ''}

                <!-- Users Management Section -->
                <div style="background: var(--bg-surface); border: 1px solid var(--glass-border); border-radius: 24px; padding: 30px; margin-top: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                        <h2 style="color: var(--text-primary); font-size: 1.6rem; margin: 0; font-weight: 900;">
                            <i class="fa-solid fa-users-gear"></i> إدارة الموظفين والصلاحيات
                        </h2>
                        ${isAdmin ? `
                            <button onclick="window.dashboardUI.openAddUserModal()" class="btn-neuro" style="background: #10b981; border-color: #10b981;">
                                <i class="fa-solid fa-user-plus"></i> إضافة موظف جديد
                            </button>
                        ` : ''}
                    </div>
                    <div id="users-list-container"></div>
                </div>

                <!-- Backup & Security Section -->
                <div style="background: var(--bg-surface); border: 1px solid var(--glass-border); border-radius: 24px; padding: 30px; margin-top: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                    <h2 style="color: var(--text-primary); font-size: 1.6rem; margin-bottom: 25px; font-weight: 900;">
                        <i class="fa-solid fa-shield-halved"></i> النسخ الاحتياطي وأمن المعلومات
                    </h2>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                        <div style="background: var(--bg-deep); padding: 25px; border-radius: 18px; border: 2px solid var(--glass-border);">
                            <h4 style="color: var(--text-primary); margin-bottom: 12px; font-weight: 900; font-size: 1.1rem;">نسخة كاملة (JSON)</h4>
                            <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 20px; font-weight: 600;">يحتوي على كافة المرضى، المواعيد، الحسابات والإعدادات بشكل مشفر.</p>
                            <button onclick="window.dashboardUI.exportFullBackup()" class="btn-neuro" style="width: 100%; background: var(--accent-primary); color: #fff; border-radius: 12px; font-weight: 800; padding: 12px;">
                                <i class="fa-solid fa-cloud-arrow-down"></i> تحميل نسخة شاملة
                            </button>
                        </div>
                        <div style="background: var(--bg-deep); padding: 25px; border-radius: 18px; border: 2px solid var(--glass-border);">
                            <h4 style="color: #10b981; margin-bottom: 12px; font-weight: 900; font-size: 1.1rem;">سجل المرضى (Excel)</h4>
                            <p style="color: var(--text-secondary); font-size: 0.95rem; margin-bottom: 20px; font-weight: 600;">تصدير قائمة المرضى كملف CSV لسهولة البحث والطباعة الخارجية.</p>
                            <button onclick="window.dashboardUI.exportPatientsCSV()" class="btn-neuro" style="width: 100%; background: #059669; color: #fff; border-color: #059669; border-radius: 12px; font-weight: 800; padding: 12px;">
                                <i class="fa-solid fa-file-excel"></i> تصدير للميكروسوفت إكسيل
                            </button>
                        </div>
                    </div>
                    
                    ${isAdmin ? `
                    <div style="margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px dashed var(--glass-border); padding-top: 25px;">
                        <div style="padding: 20px; border: 1px dashed rgba(245, 158, 11, 0.6); border-radius: 15px; text-align: center; background: rgba(245, 158, 11, 0.05);">
                            <h4 style="color: #d97706; margin-bottom: 15px; font-weight: 800;">استعادة نسخة احتياطية (JSON)</h4>
                            <input type="file" id="restore-backup-input" accept=".json" style="display: none;" onchange="window.dashboardUI.handleRestoreBackup(event)">
                            <button onclick="document.getElementById('restore-backup-input').click()" class="btn-neuro" style="background: #d97706; border-color: #d97706; color: #fff; margin: 0 auto; width: 100%; font-weight: 800;">
                                <i class="fa-solid fa-upload"></i> رفع واستعادة JSON
                            </button>
                            <p style="color: #ef4444; font-size: 0.8rem; margin-top: 10px; font-weight: 700;">⚠️ سيتم مسح واستبدال كافة البيانات</p>
                        </div>

                        <div id="backup-settings-card" style="padding: 25px; border: 2px solid var(--accent-primary); border-radius: 20px; text-align: center; background: rgba(0, 234, 255, 0.04); grid-column: span 2; box-shadow: 0 5px 15px rgba(0,0,0,0.02);">
                            <h4 style="color: var(--accent-primary); margin-bottom: 15px; font-weight: 900; font-size: 1.2rem;"><i class="fa-solid fa-folder-tree"></i> درع الحماية الإجباري (Mandatory Auto-Guardian)</h4>
                            <p style="color: var(--text-secondary); font-size: 1rem; margin-bottom: 20px; line-height: 1.5; font-weight: 600;">يتم حفظ نسخة احتياطية "تلقائية وإجبارية" في مسار آمن على جهازك عند كل تعديل وعند الخروج من البرنامج.</p>
                            
                            <div style="background: rgba(0, 234, 255, 0.08); padding: 15px; border-radius: 12px; border: 1px dashed var(--accent-primary); display: inline-block; min-width: 300px; margin-bottom: 15px;">
                                <small style="color: #94a3b8; display: block; margin-bottom: 5px; font-weight: 800;">مسار الحفظ الحالي:</small>
                                <span style="color: #00eaff; font-family: 'Inter'; font-weight: 900; font-size: 1.1rem;">${window.syncManager.getBackupInfo().primaryPath}</span>
                            </div>

                            <div id="folder-sync-status" style="margin-top: 10px; font-weight: 800; font-size: 1.05rem; color: ${window.syncManager.isAutoBackupEnabled ? '#10b981' : '#f59e0b'};">
                                <i class="fa-solid ${window.syncManager.isAutoBackupEnabled ? 'fa-shield-check' : 'fa-circle-exclamation'}"></i> 
                                الحالة: ${window.syncManager.isAutoBackupEnabled ? 'نشط (تلقائي)' : (window.syncManager.savedHandleProxy ? 'ينتظر إعادة التفعيل' : 'غير مفعل')}
                            </div>
                            
                            <button onclick="window.syncManager.performAutoBackup().then(res => { if(res && res.success) window.showNeuroToast('✅ تم الحفظ بنجاح في: ' + res.path, 'success'); else window.showNeuroToast('❌ فشل الحفظ: ' + (res?.error || ''), 'error'); })" class="btn-neuro" style="margin-top: 15px; background: rgba(0, 234, 255, 0.1); border-color: var(--accent-primary); color: var(--accent-primary); width: 100%; font-weight: 800;">
                                <i class="fa-solid fa-flask"></i> اختبار الحفظ الفوري (Backup Test)
                            </button>

                            ${(!window.electronAPI && window.syncManager.savedHandleProxy && !window.syncManager.isAutoBackupEnabled) ? `
                            <button onclick="window.dashboardUI.reactivateBackupFolder()" class="btn-neuro" style="margin-top: 10px; background: #f59e0b; border-color: #f59e0b; color: #fff; width: 100%; font-weight: 900; box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);">
                                <i class="fa-solid fa-bolt"></i> لمسة واحدة: إعادة تفعيل المجلد المرتبط
                            </button>
                            ` : ''}

                            ${!window.electronAPI ? `
                            <button onclick="window.dashboardUI.linkBackupFolder()" class="btn-neuro" style="margin-top: 10px; background: none; border-color: #64748b; color: #64748b; width: 100%; font-size: 0.9rem;">
                                <i class="fa-solid fa-link"></i> ربط مجلد متصفح جديد
                            </button>
                            ` : ''}
                        </div>

                        <div style="padding: 20px; border: 1px dashed rgba(16, 185, 129, 0.6); border-radius: 15px; text-align: center; background: rgba(16, 185, 129, 0.05);">
                            <h4 style="color: #059669; margin-bottom: 15px; font-weight: 800;">استيراد مرضى من (CSV)</h4>
                            <input type="file" id="restore-csv-input" accept=".csv" style="display: none;" onchange="window.dashboardUI.handleRestoreCSV(event)">
                            <button onclick="document.getElementById('restore-csv-input').click()" class="btn-neuro" style="background: #059669; border-color: #059669; color: #fff; margin: 0 auto; width: 100%; font-weight: 800;">
                                <i class="fa-solid fa-file-import"></i> استيراد ملف CSV
                            </button>
                            <p style="color: var(--text-secondary); font-size: 0.8rem; margin-top: 10px; font-weight: 600;">يتم إضافة المرضى الجدد فقط لسجلك الحالي</p>
                        </div>
                    </div>

                    <div style="margin-top: 20px; padding: 25px; border: 1px solid var(--glass-border); border-radius: 20px; background: rgba(0, 234, 255, 0.03); text-align: center; box-shadow: 0 4px 15px rgba(0,0,0,0.02);">
                        <h4 style="color: var(--accent-primary); margin-bottom: 12px; font-weight: 900; font-size: 1.15rem;">المزامنة اليدوية مع السحابة</h4>
                        <p style="color: var(--text-primary); font-size: 0.95rem; margin-bottom: 20px; font-weight: 800;">استخدم هذا الزر إذا كنت تشك بأن البيانات لم ترفع تلقائياً للسحاب.</p>
                        <button onclick="window.dashboardUI.forceSync()" class="btn-neuro" style="background: var(--accent-primary); border-color: var(--accent-primary); color: #fff; margin: 0 auto; font-weight: 800; padding: 12px 25px; border-radius: 12px;">
                            <i class="fa-solid fa-cloud-arrow-up"></i> رفع البيانات للسحاب الآن
                        </button>
                    </div>

                    <!-- Master Factory Reset Button -->
                    <div style="margin-top: 30px; padding: 25px; border: 2px solid #ef4444; border-radius: 24px; background: rgba(239, 68, 68, 0.04); text-align: center; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.05);">
                        <h4 style="color: #ef4444; margin-bottom: 12px; font-weight: 900; font-size: 1.2rem;"><i class="fa-solid fa-triangle-exclamation"></i> منطقة الخطر: ضبط مصنع شامل</h4>
                        <p style="color: var(--text-primary); font-size: 1rem; margin-bottom: 25px; font-weight: 800; line-height: 1.6;">هذا الزر سيحذف جميع المرضى والعمليات المالية ويبدأ العداد من 101. يتطلب كلمة سر المدير.</p>
                        <button onclick="window.dashboardUI.triggerMasterReset()" class="btn-neuro" style="background: #ef4444; border-color: #ef4444; color: #fff; margin: 0 auto; box-shadow: 0 0 20px rgba(239, 68, 68, 0.3); font-weight: 900; padding: 14px 40px; border-radius: 15px;">
                            <i class="fa-solid fa-trash-can-arrow-up"></i> تصفير النظام والبدء من #101#
                        </button>
                    </div>
                    ` : ''}
                </div>

                <!-- System Info & Help -->
                <div style="background: var(--bg-surface); border: 1px solid var(--glass-border); border-radius: 24px; padding: 30px; margin-top: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.03);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 40px;">
                        
                        <!-- Info Column -->
                        <div style="flex: 1; min-width: 250px;">
                            <h3 style="color: var(--text-primary); margin-bottom: 20px; font-weight: 900; font-size: 1.4rem;">
                                <i class="fa-solid fa-info-circle"></i> معلومات النظام
                            </h3>
                            <div style="color: var(--text-secondary); line-height: 2; font-size: 1.05rem; font-weight: 700;">
                                <p style="margin-bottom: 10px;"><strong>الإصدار:</strong> 2.6.0 (Auto-Guardian Edition)</p>
                                <p style="margin-bottom: 10px;"><strong>آخر تحديث:</strong> ${new Date().toLocaleDateString('ar-EG')}</p>
                                <p style="margin-bottom: 10px;"><strong>المستخدم الحالي:</strong> ${currentUser?.name || 'غير معروف'}</p>
                                <p style="margin-bottom: 10px;"><strong>الصلاحية:</strong> ${this.getRoleLabel(currentUser?.role)}</p>
                            </div>
                        </div>

                        <!-- Documentation Column -->
                        <div style="flex: 1; min-width: 250px;">
                            <h3 style="color: var(--accent-primary); margin-bottom: 20px; font-weight: 900; font-size: 1.4rem;">
                                <i class="fa-solid fa-book-open"></i> المساعدة والتوثيق
                            </h3>
                            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                                <a href="capabilities_guide.html" target="_blank" class="btn-neuro" style="text-decoration: none; display: inline-flex; background: rgba(0, 234, 255, 0.1); color: var(--accent-primary); border: 2px solid var(--accent-primary); font-weight: 800; padding: 12px 20px; border-radius: 12px;">
                                    <i class="fa-solid fa-star"></i> دليل الإمكانيات
                                </a>
                                <a href="user_manual.html" target="_blank" class="btn-neuro" style="text-decoration: none; display: inline-flex; background: rgba(34, 197, 94, 0.1); color: #059669; border: 2px solid #059669; font-weight: 800; padding: 12px 20px; border-radius: 12px;">
                                    <i class="fa-solid fa-circle-question"></i> دليل المستخدم
                                </a>
                            </div>
                            <p style="margin-top: 20px; color: var(--text-secondary); font-size: 0.95rem; font-weight: 800; font-style: italic;">
                                <i class="fa-solid fa-arrow-pointer"></i> اضغط لفتح الدليل في تبويب منفصل
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        `;

        // Render users list
        this.renderUsers();
    }

    // --- Backup & Export Methods ---
    async exportFullBackup() {
        const data = syncManager.getBackupJSON();

        // Smart "Save As" Approach
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `neuro_clinic_backup_${new Date().toISOString().split('T')[0]}.json`,
                    types: [{
                        description: 'JSON Backup File',
                        accept: { 'application/json': ['.json'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(data);
                await writable.close();
                window.syncManager.markBackupSuccessful(); // Successful auto-backup
                window.soundManager?.playSuccess();
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn("Smart Save failed, falling back to legacy download:", err);
            }
        }

        // Legacy Fallback
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `neuro_clinic_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        window.syncManager.markBackupSuccessful(); // Successful legacy-backup
        window.soundManager?.playSuccess();
    }

    async exportPatientsCSV() {
        const csv = syncManager.exportPatientsCSV();
        if (!csv) {
            window.showNeuroToast('لا توجد بيانات مرضى للتصدير!', 'info');
            return;
        }

        // Smart "Save As" Approach
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `patients_list_${new Date().toISOString().split('T')[0]}.csv`,
                    types: [{
                        description: 'CSV Spreadsheet',
                        accept: { 'text/csv': ['.csv'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(csv);
                await writable.close();
                window.soundManager?.playSuccess();
                return;
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.warn("Smart Save failed, falling back to legacy download:", err);
            }
        }

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patients_list_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        window.soundManager?.playSuccess();
    }

    async linkBackupFolder() {
        if (!('showDirectoryPicker' in window)) {
            window.showNeuroModal('غير مدعوم', 'عذراً، متصفحك لا يدعم ربط المجلدات المباشر. يرجى استخدام متصفح Google Chrome أو Edge.', null, false);
            return;
        }

        try {
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite'
            });

            // Test Permission
            const permission = await handle.queryPermission({ mode: 'readwrite' });
            if (permission !== 'granted') {
                await handle.requestPermission({ mode: 'readwrite' });
            }

            window.syncManager.backupHandle = handle;
            window.syncManager.isAutoBackupEnabled = true;

            // Save for future sessions
            if (window.syncManager.saveHandleToDB) {
                await window.syncManager.saveHandleToDB(handle);
            }

            // Immediate first backup
            await window.syncManager.performAutoBackup();

            window.showNeuroToast('تم تفعيل درع الحماية وربط المجلد بنجاح!', 'success');
            window.soundManager?.playSuccess();

            // Refresh Settings UI
            this.loadSettingsView();
        } catch (err) {
            if (err.name === 'AbortError') return;
            console.error("Folder Link Failed:", err);
            window.showNeuroToast('فشل ربط المجلد. يرجى التأكد من إعطاء الصلاحيات.', 'error');
        }
    }

    async reactivateBackupFolder() {
        if (!window.syncManager.savedHandleProxy) return;
        try {
            const handle = window.syncManager.savedHandleProxy;
            // Trigger browser permission prompt (must be called from a user gesture)
            const permission = await handle.requestPermission({ mode: 'readwrite' });

            if (permission === 'granted') {
                window.syncManager.backupHandle = handle;
                window.syncManager.isAutoBackupEnabled = true;
                window.syncManager.savedHandleProxy = null;

                await window.syncManager.performAutoBackup();
                window.showNeuroToast('تم استعادة درع الحماية بنجاح!', 'success');
                window.soundManager?.playSuccess();
                this.loadSettingsView();
            }
        } catch (err) {
            console.error("Reactivation failed:", err);
            window.showNeuroToast('فشل إعادة التفعيل. قد تحتاج لربط المجلد من جديد.', 'info');
        }
    }

    handleRestoreBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            
            // Verify if JSON is even valid before showing modal
            try {
                JSON.parse(content);
            } catch (e) {
                alert("الملف المختار ليس ملف JSON صحيح.");
                return;
            }

            window.showNeuroModal('تأكيد الاستعادة الكاملة (JSON)', 'هل أنت متأكد؟ سيتم حذف جميع البيانات الحالية واستبدالها بمحتوى الملف المرفوع.', async (modalOverlay) => {
                try {
                    // Force re-check of syncManager instance
                    const manager = window.syncManager;
                    if (!manager || typeof manager.restoreBackup !== 'function') {
                        throw new Error("نظام المزامنة (SyncManager) لم يتم تحميله بالكامل بعد. يرجى تحديث الصفحة.");
                    }

                    if (manager.restoreBackup(content)) {
                        const msgContainer = modalOverlay.querySelector('.neuro-modal-msg');
                        if (msgContainer) {
                            msgContainer.innerHTML += '<div style="margin-top:15px; padding:10px; color:#10b981; border:1px solid #10b981; border-radius:8px;">✅ تم الحفظ محلياً.. جاري المزامنة...</div>';
                        }

                        // Try Sync
                        if (typeof db !== 'undefined') {
                            await window.syncManager.triggerCloudSync();
                        }

                        alert('تم استعادة البيانات بنجاح! سيتم الآن إعادة تحميل الصفحة.');
                        window.location.reload();
                        return true;
                    } else {
                        alert('فشل تطبيق النسخة الاحتياطية. قد يكون الملف تالفاً.');
                        return false;
                    }
                } catch (restoreErr) {
                    alert("خطأ أثناء الاستعادة: " + restoreErr.message);
                    return false;
                }
            });
        };
        reader.readAsText(file);
        event.target.value = ''; 
    }

    handleRestoreCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            window.showNeuroModal('استيراد مرضى (CSV)', 'سيقوم النظام بقراءة ملف CSV وإضافة المرضى غير الموجودين مسبقاً إلى سجلك الحالي. هل تود الاستمرار؟', async () => {
                const result = window.syncManager.restoreFromCSV(content);
                if (result && result.success) {
                    window.soundManager?.playSuccess();

                    if (window.syncManager && typeof db !== 'undefined') {
                        const statusMsg = document.createElement('div');
                        statusMsg.innerHTML = `<div style="text-align:center; padding:15px; color:#00eaff;"><i class="fa-solid fa-sync fa-spin"></i> تم استيراد ${result.count} مريض.. جاري المزامنة مع السحاب...</div>`;
                        document.querySelector('.neuro-modal-msg').appendChild(statusMsg);
                        await window.syncManager.triggerCloudSync();
                    }

                    window.showNeuroToast(`تم استيراد ${result.count} مريض بنجاح!`);
                    this.renderPatientsManagement();
                    this.updateStats();
                    return true;
                } else {
                    window.showNeuroToast('فشل استيراد الملف. تأكد من الصيغة.', 'error');
                    window.soundManager?.playError();
                    return false;
                }
            });
        };
        reader.readAsText(file);
        event.target.value = ''; // Reset input
    }

    async forceSync() {
        if (!window.syncManager) return;

        const btn = event.currentTarget;
        const originalHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-sync fa-spin"></i> جاري الرفع...';

        const success = await window.syncManager.triggerCloudSync();

        if (success) {
            window.soundManager?.playSuccess();
            btn.style.background = '#10b981';
            btn.innerHTML = '<i class="fa-solid fa-check"></i> تم الرفع بنجاح';
        } else {
            window.soundManager?.playError();
            btn.style.background = '#ef4444';
            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> فشل الرفع';
        }

        setTimeout(() => {
            btn.disabled = false;
            btn.style.background = '';
            btn.innerHTML = originalHTML;
        }, 3000);
    }

    triggerMasterReset() {
        const modalHTML = `
            <div style="text-align: right; direction: rtl;">
                <div style="background: rgba(239, 68, 68, 0.1); border: 1px dashed #ef4444; padding: 15px; border-radius: 12px; margin-bottom: 20px;">
                    <p style="color: #ef4444; font-weight: 800; margin-bottom: 10px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> تحذير أمني شديد الخطورة!
                    </p>
                    <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.6;">
                        أنت على وشك <strong>حذف كافة بيانات العيادة نهائياً</strong>. 
                        سيتم مسح جميع المرضى، المواعيد، والماليات، وسيعود العداد للرقم 101.
                    </p>
                </div>
                
                <label style="display: block; color: var(--text-primary); margin-bottom: 8px; font-weight: 700;">أدخل كلمة مرور المدير للتأكيد:</label>
                <input type="password" id="master-reset-pass" class="neuro-input" 
                       style="width: 100%; border-color: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.1);" 
                       placeholder="********" autofocus>
            </div>
        `;

        window.showNeuroModal('تحذير نهائي: مسح البيانات', modalHTML, () => {
            const pass = document.getElementById('master-reset-pass').value;

            if (pass === 'admin123') {
                const success = window.syncManager.masterFactoryReset();
                if (success) {
                    window.showNeuroToast('تم تصفير النظام بنجاح! العداد سيبدأ من 101.', 'success');
                    window.soundManager?.playSuccess();
                    setTimeout(() => window.location.reload(), 2000);
                    return true;
                }
            } else {
                window.showNeuroToast('كلمة المرور غير صحيحة! تم إلغاء العملية.', 'error');
                window.soundManager?.playError();
                return false;
            }
        }, true);
    }

    async shutdownApp() {
        const backupInfo = window.syncManager?.getBackupInfo() || { description: 'نسخة احتياطية' };

        // 1. Confirmation with explicit dynamic Save text
        const confirmed = await window.showNeuroConfirm(
            'إغلاق المنظومة',
            `هل أنت متأكد من رغبتك في إغلاق البرنامج وتأمين كافة البيانات في (${backupInfo.description})؟`,
            'تأكيد الإغلاق والحفظ'
        );

        if (!confirmed) return;

        const shutdownBtn = document.getElementById('btn-shutdown') || document.querySelector('.shutdown-link');
        if (shutdownBtn) {
            shutdownBtn.style.pointerEvents = 'none';
            shutdownBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>جاري التأمين...</span>`;
        }

        // 2. Show Full-Screen Securing Overlay
        if (window.authManager && window.authManager.showSecuringOverlay) {
            window.authManager.showSecuringOverlay('جاري الإغلاق الآمن وتأمين البيانات...');
        }

        try {
            let backupResult = { success: false };
            if (window.syncManager) {
                console.log("DashboardUI: Triggering mandatory final backup before shutdown...");
                backupResult = await window.syncManager.performAutoBackup(true);
            }

            // UX Delay
            await new Promise(r => setTimeout(r, 1200));

            const successMsg = backupResult.success
                ? `تم تأمين البيانات بنجاح في:<br><small style="color:#00eaff">${backupResult.path}</small>`
                : `فشل الحفظ التلقائي: ${backupResult.error || 'عطل غير معروف'}`;

            if (window.authManager && window.authManager.updateSecuringOverlayStatus) {
                window.authManager.updateSecuringOverlayStatus(backupResult.success, successMsg);
            }

            // Ensure the user can see the status before exit
            await new Promise(r => setTimeout(r, 2000));

        } catch (err) {
            console.error("Final shutdown backup failed:", err);
            if (window.authManager && window.authManager.updateSecuringOverlayStatus) {
                window.authManager.updateSecuringOverlayStatus(false, "خطأ تقني أثناء الحفظ النهائي");
            }
            await new Promise(r => setTimeout(r, 2000));
        }

        // Final Exit Sequence
        if (window.electronAPI && window.electronAPI.exitAppFinal) {
            window.electronAPI.exitAppFinal();
        } else if (window.electronAPI && window.electronAPI.quitApp) {
            window.electronAPI.quitApp();
        } else {
            window.close();
            // If window.close() fails (browser restriction), show a manual message
            if (window.authManager && window.authManager.updateSecuringOverlayStatus) {
                window.authManager.updateSecuringOverlayStatus(true, "تم الحفظ بنجاح. يمكنك إغلاق هذه الصفحة الآن.");
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dashboardUI = new DashboardUI();

    // Show Shutdown Button globally (both Browser and Desktop)
    const shutdownBtn = document.getElementById('btn-shutdown');
    if (shutdownBtn) shutdownBtn.style.setProperty('display', 'flex', 'important');

    // Theme Switcher Logic (New)
    const themeBtn = document.getElementById('btn-theme-switcher');
    const themeMenu = document.getElementById('theme-menu');
    const themeOptions = document.querySelectorAll('.theme-option');

    if (themeBtn && themeMenu) {
        // Toggle Menu
        themeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            themeMenu.classList.toggle('active');
        });

        // Close when clicking outside
        document.addEventListener('click', () => {
            themeMenu.classList.remove('active');
        });

        // Select Theme
        themeOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                const theme = opt.dataset.theme;
                applyTheme(theme);
                themeMenu.classList.remove('active');
            });
        });
    }

    function applyTheme(theme) {
        // Remove existing theme classes
        document.body.classList.remove('theme-blue', 'theme-gold', 'theme-light', 'theme-royal');
        // Add new theme
        document.body.classList.add(theme);
        // Save preference
        localStorage.setItem('selectedTheme', theme);
        console.log("Theme applied & saved:", theme);
    }

    // Initialize saved theme
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        applyTheme('theme-blue'); // Default
    }
});

