/**
 * Clinic Manager UI
 * Handles clinic selection, management, and UI updates
 */

class ClinicManager {
    constructor() {
        this.init();
    }

    init() {
        this.populateClinicSelector();
        this.attachEventListeners();
    }

    populateClinicSelector() {
        const activeNameDisplay = document.getElementById('active-clinic-name');
        const menu = document.getElementById('clinic-drop-menu');
        if (!menu || !activeNameDisplay) return;

        const clinics = syncManager.getClinics();
        const activeClinic = syncManager.getActiveClinic();
        const currentUser = window.authManager?.currentUser;

        // Filter clinics based on user permissions
        const allowedClinics = currentUser?.role === 'admin'
            ? clinics
            : clinics.filter(c => currentUser?.assignedClinics?.includes(c.id));

        // Update active name
        activeNameDisplay.textContent = activeClinic.name;

        // Populate menu items
        menu.innerHTML = allowedClinics.map(clinic => {
            const isActive = clinic.id === activeClinic.id;
            return `
                <div class="clinic-item ${isActive ? 'active' : ''}" data-id="${clinic.id}">
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <i class="fa-solid ${isActive ? 'fa-hospital-user' : 'fa-hospital'}"></i>
                        <span>${clinic.name}</span>
                    </div>
                    ${isActive ? '<i class="fa-solid fa-check active-check"></i>' : ''}
                </div>
            `;
        }).join('');

        // Attach click listeners to new items
        menu.querySelectorAll('.clinic-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                const clinicId = item.dataset.id;
                if (clinicId !== activeClinic.id) {
                    this.switchClinic(clinicId);
                }
                document.getElementById('clinic-switcher-wrapper').classList.remove('active');
            };
        });
    }

    attachEventListeners() {
        const wrapper = document.getElementById('clinic-switcher-wrapper');
        const btn = document.getElementById('active-clinic-display');

        if (btn && wrapper) {
            btn.onclick = (e) => {
                e.stopPropagation();
                wrapper.classList.toggle('active');
            };

            // Close on outside click or Escape key
            document.addEventListener('click', (e) => {
                if (!wrapper.contains(e.target)) {
                    wrapper.classList.remove('active');
                }
            });

            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    wrapper.classList.remove('active');
                }
            });
        }
    }

    switchClinic(clinicId) {
        if (syncManager.setActiveClinic(clinicId)) {
            // Play success sound
            if (window.soundManager) window.soundManager.playSuccess();

            const clinic = syncManager.getActiveClinic();

            // Show premium loading toast
            if (window.showNeuroToast) {
                window.showNeuroToast(`جاري التحويل إلى عيادة: ${clinic.name}...`, 'info');
            }

            // Snappy reload to apply branch state
            setTimeout(() => {
                window.location.reload();
            }, 600);
        }
    }

    // --- Clinic CRUD UI ---
    renderClinicsManagement() {
        const clinics = syncManager.getClinics();
        const currentUser = window.authManager?.currentUser;
        const isAdmin = currentUser?.role === 'admin';

        return `
            <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 30px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
                    <h2 style="color: #fff; font-size: 1.5rem; margin: 0;">
                        <i class="fa-solid fa-hospital"></i> إدارة العيادات
                    </h2>
                    ${isAdmin ? `
                        <button onclick="clinicManager.openAddClinicModal()" class="btn-neuro" style="background: #10b981; border-color: #10b981;">
                            <i class="fa-solid fa-plus"></i> إضافة عيادة جديدة
                        </button>
                    ` : ''}
                </div>

                <div style="display: grid; gap: 20px;">
                    ${clinics.map(clinic => this.renderClinicCard(clinic, isAdmin)).join('')}
                </div>
            </div>
        `;
    }

    renderClinicCard(clinic, isAdmin) {
        const activeClinic = syncManager.getActiveClinic();
        const isActive = clinic.id === activeClinic.id;
        const patientsCount = syncManager.getPatientsByClinic(clinic.id).length;
        const appointmentsCount = syncManager.getAppointmentsByClinic(clinic.id).length;

        return `
            <div style="background: ${isActive ? 'rgba(0, 234, 255, 0.1)' : 'rgba(15, 23, 42, 0.5)'}; border: 1px solid ${isActive ? 'rgba(0, 234, 255, 0.3)' : 'rgba(255,255,255,0.05)'}; border-radius: 15px; padding: 20px; display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fa-solid fa-hospital" style="color: ${isActive ? '#00eaff' : '#94a3b8'}; font-size: 1.3rem;"></i>
                        <h3 style="color: #fff; margin: 0; font-size: 1.2rem;">${clinic.name}</h3>
                        ${isActive ? '<span style="background: #00eaff; color: #000; padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">نشط</span>' : ''}
                    </div>
                    <div style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 8px;">
                        ${clinic.address ? `<div><i class="fa-solid fa-location-dot"></i> ${clinic.address}</div>` : ''}
                        ${clinic.phone ? `<div><i class="fa-solid fa-phone"></i> ${clinic.phone}</div>` : ''}
                    </div>
                    <div style="display: flex; gap: 20px; margin-top: 12px;">
                        <span style="color: #10b981; font-size: 0.9rem;">
                            <i class="fa-solid fa-users"></i> ${patientsCount} مريض
                        </span>
                        <span style="color: #f59e0b; font-size: 0.9rem;">
                            <i class="fa-solid fa-calendar"></i> ${appointmentsCount} موعد
                        </span>
                    </div>
                </div>
                <div style="display: flex; gap: 10px;">
                    ${isAdmin ? `
                        <button onclick="clinicManager.openEditClinicModal('${clinic.id}')" class="btn-edit-tool" title="تعديل" style="color: #3b82f6; border-color: rgba(59, 130, 246, 0.3);">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        ${syncManager.getClinics().length > 1 ? `
                            <button onclick="clinicManager.deleteClinic('${clinic.id}')" class="btn-edit-tool" title="حذف" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        ` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }

    openAddClinicModal() {
        const modalHTML = `
            <div style="text-align: right;">
                <h3 style="color: #10b981; margin-bottom: 20px; font-size: 1.4rem;">
                    <i class="fa-solid fa-hospital"></i> إضافة عيادة جديدة
                </h3>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">اسم العيادة *</label>
                    <input type="text" id="clinic-name" class="neuro-input" style="width:100%" placeholder="مثال: عيادة المعادي" required>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">العنوان</label>
                    <input type="text" id="clinic-address" class="neuro-input" style="width:100%" placeholder="العنوان الكامل">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">رقم الهاتف</label>
                    <input type="tel" id="clinic-phone" class="neuro-input" style="width:100%" placeholder="0123456789">
                </div>
            </div>
        `;

        showNeuroModal('إضافة عيادة', modalHTML, () => {
            const name = document.getElementById('clinic-name').value.trim();
            const address = document.getElementById('clinic-address').value.trim();
            const phone = document.getElementById('clinic-phone').value.trim();

            if (!name) {
                window.showNeuroToast('يرجى إدخال اسم العيادة', 'error');
                window.soundManager?.playError();
                return false;
            }

            const newClinic = syncManager.addClinic({ name, address, phone });

            window.soundManager?.playSuccess();
            this.showNotification(`تم إضافة العيادة: ${name}`);

            // Refresh UI
            this.populateClinicSelector();
            if (window.dashboardUI) {
                window.dashboardUI.loadSettingsView();
            }

            return true;
        });
    }

    openEditClinicModal(clinicId) {
        const clinic = syncManager.getClinics().find(c => c.id === clinicId);
        if (!clinic) return;

        const modalHTML = `
            <div style="text-align: right;">
                <h3 style="color: #3b82f6; margin-bottom: 20px; font-size: 1.4rem;">
                    <i class="fa-solid fa-pen-to-square"></i> تعديل بيانات العيادة
                </h3>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">اسم العيادة *</label>
                    <input type="text" id="edit-clinic-name" class="neuro-input" style="width:100%" value="${clinic.name}" required>
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">العنوان</label>
                    <input type="text" id="edit-clinic-address" class="neuro-input" style="width:100%" value="${clinic.address || ''}">
                </div>
                <div class="form-group" style="margin-bottom: 15px;">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">رقم الهاتف</label>
                    <input type="tel" id="edit-clinic-phone" class="neuro-input" style="width:100%" value="${clinic.phone || ''}">
                </div>
            </div>
        `;

        showNeuroModal('تعديل العيادة', modalHTML, () => {
            const name = document.getElementById('edit-clinic-name').value.trim();
            const address = document.getElementById('edit-clinic-address').value.trim();
            const phone = document.getElementById('edit-clinic-phone').value.trim();

            if (!name) {
                window.showNeuroToast('يرجى إدخال اسم العيادة', 'error');
                window.soundManager?.playError();
                return false;
            }

            syncManager.updateClinic(clinicId, { name, address, phone });

            window.soundManager?.playSuccess();
            this.showNotification(`تم تحديث بيانات العيادة`);

            // Refresh UI
            this.populateClinicSelector();
            if (window.dashboardUI) {
                window.dashboardUI.loadSettingsView();
            }

            return true;
        });
    }

    deleteClinic(clinicId) {
        if (clinicId === 'clinic-default') {
            window.showNeuroToast('خطأ: لا يمكن حذف العيادة الرئيسية للنظام.', 'error');
            window.soundManager?.playError();
            return;
        }

        const clinic = syncManager.getClinics().find(c => c.id === clinicId);
        if (!clinic) return;

        window.soundManager?.playBuzz();

        const modalHTML = `
            <div style="text-align: right;">
                <p style="color: #ef4444; font-size: 1.1rem; margin-bottom: 15px;">
                    هل أنت متأكد من حذف العيادة: <strong>${clinic.name}</strong>؟
                </p>
                <div class="form-group">
                    <label style="display: block; margin-bottom: 8px; color: #fff;">أدخل كلمة مرور التأكيد (admin123)</label>
                    <input type="password" id="delete-clinic-password" class="neuro-input" style="width:100%" placeholder="كلمة المرور...">
                </div>
                <p style="color: #94a3b8; margin-top: 15px; font-size: 0.9rem;">⚠️ تنبيه: لا يمكن الحذف إذا كانت العيادة تحتوي على بيانات.</p>
            </div>
        `;

        showNeuroModal('حذف العيادة', modalHTML, () => {
            const password = document.getElementById('delete-clinic-password').value;
            if (password !== 'admin123') {
                window.showNeuroToast('كلمة المرور غير صحيحة!', 'error');
                window.soundManager?.playError();
                return false;
            }

            const result = syncManager.deleteClinic(clinicId);
            if (result.success) {
                window.soundManager?.playSuccess();
                this.showNotification('تم حذف العيادة بنجاح');
                this.populateClinicSelector();
                if (window.dashboardUI) {
                    window.dashboardUI.loadSettingsView();
                    window.dashboardUI.updateStats();
                }
                return true;
            } else {
                window.showNeuroToast('لا يمكن حذف العيادة لأنها تحتوي على بيانات مسجلة.', 'info');
                window.soundManager?.playError();
                return false;
            }
        });
    }

    showNotification(msg, type = 'success') {
        if (window.showNeuroToast) {
            window.showNeuroToast(msg, type);
        } else {
            console.log("Notification fallback:", msg);
        }
    }
}

// Initialize on load
window.clinicManager = new ClinicManager();
