/**
 * PatientFileUI: Manages the detailed patient view, editing, deletion, and individual ledger.
 */
class PatientFileUI {
    constructor() {
        this.modal = document.getElementById('patient-file-modal');
        this.init();
    }

    init() {
        const uploadBtn = document.getElementById('btn-upload-doc');
        const fileInput = document.getElementById('doc-file-input');

        if (uploadBtn && fileInput) {
            uploadBtn.onclick = () => fileInput.click();
            fileInput.onchange = (e) => {
                if (e.target.files.length > 0) {
                    this.handleFileUpload(e.target.files[0]);
                }
            };
        }

        // Close Button
        const closeBtn = document.getElementById('btn-close-file');
        if (closeBtn) {
            closeBtn.onclick = () => this.close();
        }

        // Start Prescription Button
        const startPrescriptionBtn = document.getElementById('btn-file-start-prescription');
        if (startPrescriptionBtn) {
            startPrescriptionBtn.onclick = () => {
                if (this.currentPatientId) {
                    window.location.href = `editor.html?patientId=${this.currentPatientId}`;
                }
            };
        }

        // Show Medical Alerts Button
        const showAlertsBtn = document.getElementById('btn-show-medical-alerts');
        const alertsOverlay = document.getElementById('medical-alerts-overlay');
        if (showAlertsBtn && alertsOverlay) {
            showAlertsBtn.onclick = () => {
                alertsOverlay.style.display = 'flex';
                // Sync data to overlay before showing
                const patient = syncManager.getPatientsByClinic().find(p => p.id === this.currentPatientId);
                if (patient) {
                    const yesBtn = document.getElementById('alert-btn-allergies-yes');
                    const noBtn = document.getElementById('alert-btn-allergies-no');
                    const allergyInput = document.getElementById('alert-input-allergies');
                    const notesArea = document.getElementById('alert-input-notes');

                    if (patient.allergies && patient.allergies !== 'لا') {
                        yesBtn.style.background = '#ef4444';
                        yesBtn.style.color = '#fff';
                        noBtn.style.background = 'transparent';
                        noBtn.style.color = '#ef4444';
                        allergyInput.value = patient.allergies;
                    } else {
                        noBtn.style.background = '#10b981';
                        noBtn.style.color = '#fff';
                        yesBtn.style.background = 'transparent';
                        yesBtn.style.color = '#ef4444';
                        allergyInput.value = '';
                    }
                    notesArea.value = patient.permanentNotes || '';
                }
            };
        }

        // Overlay Toggle Logic
        const yesBtn = document.getElementById('alert-btn-allergies-yes');
        const noBtn = document.getElementById('alert-btn-allergies-no');
        if (yesBtn && noBtn) {
            yesBtn.onclick = () => {
                yesBtn.style.background = '#ef4444'; yesBtn.style.color = '#fff';
                noBtn.style.background = 'transparent'; noBtn.style.color = '#ef4444';
            };
            noBtn.onclick = () => {
                noBtn.style.background = '#10b981'; noBtn.style.color = '#fff';
                yesBtn.style.background = 'transparent'; yesBtn.style.color = '#ef4444';
                document.getElementById('alert-input-allergies').value = '';
            };
        }

        // Save Medical Alerts (From Overlay)
        const saveAlertsBtn = document.getElementById('btn-save-medical-alerts');
        if (saveAlertsBtn) {
            saveAlertsBtn.onclick = () => {
                const allergyVal = yesBtn.style.background === 'rgb(239, 68, 68)'
                    ? document.getElementById('alert-input-allergies').value || 'يوجد حساسية'
                    : 'لا';
                const notesVal = document.getElementById('alert-input-notes').value;

                window.syncManager.upsertPatient({
                    id: this.currentPatientId,
                    allergies: allergyVal,
                    permanentNotes: notesVal
                });

                alertsOverlay.style.display = 'none';
                this.open(this.currentPatientId);
                window.showNeuroToast('تم تحديث التنبيهات الطبية بنجاح');
            };
        }

        // Gender Toggle (Edit Mode)
        const eMaleBtn = document.getElementById('edit-gender-male');
        const eFemaleBtn = document.getElementById('edit-gender-female');
        const eGenderInput = document.getElementById('edit-p-gender');
        if (eMaleBtn && eFemaleBtn && eGenderInput) {
            const setEditGender = (isMale) => {
                eMaleBtn.style.background = isMale ? '#00eaff' : 'transparent';
                eMaleBtn.style.color = isMale ? '#000' : '#94a3b8';
                eFemaleBtn.style.background = isMale ? 'transparent' : '#00eaff';
                eFemaleBtn.style.color = isMale ? '#94a3b8' : '#000';
                eGenderInput.value = isMale ? 'ذكر' : 'أنثى';
            };
            eMaleBtn.onclick = () => setEditGender(true);
            eFemaleBtn.onclick = () => setEditGender(false);
        }

        // Delete Patient Button
        const deleteBtn = document.getElementById('btn-delete-patient');
        if (deleteBtn) {
            deleteBtn.onclick = () => {
                if (!this.currentPatientId) return;

                window.soundManager.playDeleteWarning();
                window.showNeuroModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا المريض نهائياً مع كافة سجلاته الطبية والمالية؟', () => {
                    window.syncManager.deletePatient(this.currentPatientId);
                    this.close();
                    if (window.navigation) window.navigation.switchView('patients');
                    window.showNeuroToast('تم حذف المريض وسجلاته بنجاح');
                }, true);
            };
        }

        const editForm = document.getElementById('edit-patient-form');
        if (editForm) {
            editForm.onsubmit = (e) => {
                e.preventDefault();
                if (!this.currentPatientId) return;

                const fullName = document.getElementById('edit-p-full-name').value.trim();

                const ageNum = document.getElementById('edit-p-age-number').value || 0;
                const ageUnit = document.getElementById('edit-p-age-unit').value || 'سنة';

                if (!fullName) {
                    window.soundManager.playError();
                    window.showNeuroToast('يرجى إدخال اسم المريض', 'error');
                    return;
                }

                const genderVal = document.getElementById('edit-p-gender').value;

                const ageStr = `${ageNum} ${ageUnit}`;

                const patientData = {
                    id: this.currentPatientId,
                    name: fullName,
                    age: ageStr,
                    gender: genderVal,
                    phone: document.getElementById('edit-p-phone').value.trim()
                };

                window.syncManager.upsertPatient(patientData);
                window.soundManager.playSuccess();
                window.showNeuroToast('تم تحديث بيانات المريض بنجاح');

                // Refresh local UI
                this.open(this.currentPatientId);
                if (window.dashboardUI) {
                    window.dashboardUI.updateStats();
                    window.dashboardUI.renderPatientsManagement();
                }
            };
        }

        // Add Income Button (Ledger)
        const addIncomeBtn = document.getElementById('btn-add-p-income');
        const incomeInput = document.getElementById('add-p-income-amount');
        if (addIncomeBtn && incomeInput) {
            addIncomeBtn.onclick = () => {
                const amount = parseFloat(incomeInput.value);
                if (isNaN(amount) || amount <= 0) {
                    window.soundManager.playError();
                    return;
                }

                window.syncManager.addTransaction({
                    patientId: this.currentPatientId,
                    type: 'income',
                    amount: amount,
                    description: 'تحصيل نقدي (عن طريق ملف المريض)',
                    beneficiary: 'Clinic'
                });

                incomeInput.value = '';
                this.updateLedgerView();
                window.soundManager.playSuccess();
                window.showNeuroToast('تم تسجيل المبلغ في حساب المريض');
            };

            incomeInput.onkeydown = (e) => {
                if (e.key === 'Enter') addIncomeBtn.click();
            };
        }
    }

    open(patientId) {
        const patients = syncManager.getPatientsByClinic();
        const patient = patients.find(p => p.id === patientId);
        if (!patient) return;

        this.currentPatientId = patientId;
        this.lastUploadedFile = null;
        this.pendingFileData = null;

        document.getElementById('file-patient-name').textContent = `${patient.name}`;

        const infoEl = document.getElementById('file-patient-info');
        if (infoEl) {
            infoEl.textContent = `كود: #${patient.patientCode || '---'} | ${patient.gender || 'غير محدد'} | ${patient.age || '--'} | ${patient.phone || 'بدون هاتف'}`;
        }

        // Set edit gender toggle
        if (patient.gender === 'أنثى') {
            const femaleBtn = document.getElementById('edit-gender-female');
            if (femaleBtn) femaleBtn.click();
        } else {
            const maleBtn = document.getElementById('edit-gender-male');
            if (maleBtn) maleBtn.click();
        }

        // Handle Medical Alert Card (Deleted as we now use the 'بيانات المريض' button and overlay)
        // But we still update existing inputs just in case
        const alertCard = document.getElementById('medical-alert-card');
        const alertContent = document.getElementById('file-medical-alerts');
        if (alertCard && alertContent) {
            const hasAllergies = patient.allergies && patient.allergies.trim().length > 0;
            const hasNotes = patient.permanentNotes && patient.permanentNotes.trim().length > 0;

            if (hasAllergies || hasNotes) {
                alertCard.style.display = 'flex';
                let html = '';
                if (hasAllergies) {
                    html += `<div style="margin-bottom: 5px;"><span style="color: #ef4444; border: 1px solid #ef4444; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; margin-left: 10px;">حساسية</span> <span style="font-weight: 800; color: #f87171;">${patient.allergies}</span></div>`;
                }
                if (hasNotes) {
                    html += `<div><span style="color: #f59e0b; border: 1px solid #f59e0b; padding: 2px 8px; border-radius: 6px; font-size: 0.8rem; margin-left: 10px;">ملاحظات</span> <span>${patient.permanentNotes}</span></div>`;
                }
                alertContent.innerHTML = html;
            } else {
                alertCard.style.display = 'none';
            }
        }

        // Populate edit fields
        // Populate full name field
        if (document.getElementById('edit-p-full-name')) {
            document.getElementById('edit-p-full-name').value = patient.name || '';
        }

        // Parse Age (New Format: "33 سنة" or Old Format: "33 سنة / 5 شهر / 20 يوم")
        if (patient.age) {
            const parts = patient.age.split(' ');
            if (parts.length >= 2) {
                // Digital style: Get number and unit
                document.getElementById('edit-p-age-number').value = parseInt(parts[0]) || 0;
                // If it was the old complex format, parts[1] might be "سنة" which is fine
                const unit = parts[1];
                if (['سنة', 'شهر', 'يوم'].includes(unit)) {
                    document.getElementById('edit-p-age-unit').value = unit;
                } else {
                    document.getElementById('edit-p-age-unit').value = 'سنة';
                }
            } else {
                // Full backward compatibility
                document.getElementById('edit-p-age-number').value = parseInt(patient.age) || 0;
                document.getElementById('edit-p-age-unit').value = 'سنة';
            }
        }

        if (document.getElementById('edit-p-phone')) document.getElementById('edit-p-phone').value = patient.phone || '';

        this.updateLedgerView();
        this.renderDocuments();

        if (this.modal) this.modal.style.display = 'flex';
    }

    renderDocuments() {
        // Find grid by both possible IDs to ensure compatibility
        const grid = document.getElementById('patient-docs-grid') || document.getElementById('file-docs-grid');
        if (!grid) return;

        const docs = window.patientDocuments.getPatientDocuments(this.currentPatientId);

        if (docs.length === 0) {
            grid.innerHTML = `
                <div style="text-align: center; color: #64748b; padding: 20px; grid-column: 1/-1;">
                    <i class="fa-solid fa-folder-open" style="font-size: 2rem; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>لا توجد مستندات محفوظة لهذا المريض.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = docs.map(doc => {
            const cat = window.patientDocuments.getCategoryFromType(doc.type);
            return `
                <div class="doc-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 15px; position: relative;">
                    <div style="text-align: center; margin-bottom: 10px;">
                        <i class="fa-solid ${cat.icon}" style="font-size: 2rem; color: ${cat.color};"></i>
                    </div>
                    <h4 style="color: #e2e8f0; font-size: 0.9rem; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${doc.name}</h4>
                    <div style="display: flex; gap: 5px; justify-content: center; margin-top: 10px;">
                        <button class="btn-neuro" onclick="window.patientFileUI.viewDocument('${doc.id}')" style="padding: 5px 10px; font-size: 0.8rem; background: rgba(59, 130, 246, 0.2); color: #3b82f6;">
                            <i class="fa-solid fa-eye"></i>
                        </button>
                        <button class="btn-neuro" onclick="window.patientFileUI.deleteDocument('${doc.id}')" style="padding: 5px 10px; font-size: 0.8rem; background: rgba(239, 68, 68, 0.2); color: #ef4444;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    }

    handleFileUpload(file) {
        if (file.type.startsWith('image/')) {
            window.showNeuroToast('جاري ضغط الصورة لزيادة السرعة..', 'info');
            this.compressImage(file, (compressedBlob) => {
                this.lastUploadedFile = compressedBlob;
                const reader = new FileReader();
                reader.onload = (re) => {
                    this.pendingFileData = re.target.result;
                    this.showCategorySelector(file.name, compressedBlob.size);
                };
                reader.readAsDataURL(compressedBlob);
            });
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.lastUploadedFile = file;
                this.pendingFileData = e.target.result;
                this.showCategorySelector(file.name, file.size);
            };
            reader.readAsDataURL(file);
        }
    }

    compressImage(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const MAX = 1600;
                if (width > height && width > MAX) { height *= MAX / width; width = MAX; }
                else if (height > MAX) { width *= MAX / height; height = MAX; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => callback(blob), 'image/jpeg', 0.7);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    showCategorySelector(name, size) {
        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <button class="btn-neuro" onclick="window.patientFileUI.confirmUpload('${name}', 'xray', ${size})">أشعة X-Ray</button>
                <button class="btn-neuro" onclick="window.patientFileUI.confirmUpload('${name}', 'mri', ${size})">RM (MRI)</button>
                <button class="btn-neuro" onclick="window.patientFileUI.confirmUpload('${name}', 'ct', ${size})">أشعة مقطعية</button>
                <button class="btn-neuro" onclick="window.patientFileUI.confirmUpload('${name}', 'lab', ${size})">تحليل معملي</button>
                <button class="btn-neuro" onclick="window.patientFileUI.confirmUpload('${name}', 'report', ${size})">تقرير طبي</button>
                <button class="btn-neuro" onclick="window.patientFileUI.confirmUpload('${name}', 'other', ${size})">أخرى</button>
            </div>
        `;
        showNeuroModal('تصنيف الملف', 'اختر نوع المستند للرفع الفوري:', null, false);
        const modalMsg = document.querySelector('.neuro-modal-msg');
        if (modalMsg) modalMsg.innerHTML = html;
        const actions = document.querySelector('.neuro-modal-actions');
        if (actions) actions.style.display = 'none';
    }

    async confirmUpload(name, type, size) {
        const overlay = document.querySelector('.neuro-modal-overlay');
        if (overlay) overlay.remove();

        window.showNeuroToast('جاري الرفع المباشر للسحابة..', 'info');
        const data = this.pendingFileData; // Get the huge string from memory

        // Safety Check: Prevent crash if data is missing
        if (!data) {
            window.showNeuroToast('خطأ: لم يتم تحميل الملف بشكل صحيح. حاول مرة أخرى.', 'error');
            return;
        }

        let mimeType = 'application/octet-stream';
        try {
            mimeType = data.split(';')[0].split(':')[1];
        } catch (e) {
            console.warn("Could not extract MIME type, using default.");
        }

        // Fire and forget - don't wait for cloud upload to render UI
        window.patientDocuments.addDocument(this.currentPatientId, {
            name: name,
            type: type,
            fileData: data,
            blob: this.lastUploadedFile,
            mimeType: mimeType,
            size: size
        }).then(() => {
            console.log("Background upload task initiated");
        }).catch(err => console.error(err));

        // Render IMMEDIATELY regarding of cloud status
        this.renderDocuments();
        window.soundManager.playSuccess();
        window.showNeuroToast('تم الإضافة للأرشيف (جاري التزامن...)');
        this.lastUploadedFile = null; this.pendingFileData = null;
    }

    deleteDocument(docId) {
        window.soundManager.playDeleteWarning();
        showNeuroModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا المستند؟', () => {
            window.patientDocuments.deleteDocument(this.currentPatientId, docId);
            this.renderDocuments();
            window.showNeuroToast('تم الحذف');
        }, true);
    }

    viewDocument(docId) {
        const doc = window.patientDocuments.getDocument(this.currentPatientId, docId);
        if (!doc) return;
        const uri = doc.cloudUrl || doc.fileData;
        if (!uri) return window.showNeuroToast('الملف غير متوفر', 'error');

        const content = doc.mimeType.startsWith('image/') ?
            `<img src="${uri}" style="max-width: 100%; border-radius: 8px;">` :
            `<iframe src="${uri}" style="width: 100%; height: 80vh; border: none;"></iframe>`;

        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 30001; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);';
        overlay.innerHTML = `<div style="position: relative; max-width: 90vw; max-height: 90vh;">
            <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: -40px; right: 0; background: none; border: none; color: white; font-size: 2rem; cursor: pointer;">×</button>
            ${content}
        </div>`;
        document.body.appendChild(overlay);
    }

    updateLedgerView() {
        const balanceEl = document.getElementById('patient-ledger-balance');
        const listEl = document.getElementById('patient-transactions-list');
        if (!balanceEl || !listEl) return;

        const ledger = window.syncManager.data.finances.ledger[this.currentPatientId] || { balance: 0, history: [] };
        const isNegative = ledger.balance < 0;

        balanceEl.textContent = `${ledger.balance} EGP`;
        balanceEl.style.color = isNegative ? '#ff4d4d' : '#10b981';

        // Dynamic box color
        const container = balanceEl.parentElement;
        if (container) {
            container.style.background = isNegative ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)';
            container.style.borderColor = isNegative ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)';
        }

        const transactions = window.syncManager.getTransactionsByClinic().filter(t => t.patientId === this.currentPatientId);
        listEl.innerHTML = transactions.map(t => {
            const dateStr = t.date ? new Date(t.date).toLocaleString('ar-EG', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            }).replace(',', '') : '---';

            const description = t.description || t.details || 'بدون تفاصيل';

            return `
                <div style="padding: 15px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column; gap: 5px; text-align: right;">
                        <span style="color: #ffffff; font-size: 1.15rem; font-weight: 800;">${description}</span>
                        <span style="color: #94a3b8; font-size: 0.9rem; font-weight: 500;">${dateStr}</span>
                    </div>
                    <span style="color: ${t.type === 'income' ? '#10b981' : '#ef4444'}; font-weight: 900; font-size: 1.4rem; text-shadow: 0 0 10px ${t.type === 'income' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'};">
                        ${t.type === 'income' ? '+' : '-'}${t.amount}
                    </span>
                </div>
            `;
        }).join('');
    }

    close() { if (this.modal) this.modal.style.display = 'none'; }
}

window.patientFileUI = new PatientFileUI();
