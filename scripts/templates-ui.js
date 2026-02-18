/**
 * Prescription Templates UI Handler
 * Manages the templates view in dashboard
 */
class TemplatesUI {
    constructor() {
        this.init();
    }

    init() {
        // Add template button
        const addBtn = document.getElementById('btn-add-template');
        if (addBtn) {
            addBtn.onclick = () => this.showAddTemplateModal();
        }

        // Search input
        const searchInput = document.getElementById('template-search');
        if (searchInput) {
            searchInput.oninput = (e) => this.handleSearch(e.target.value);
        }

        // Render templates when view becomes active
        document.getElementById('btn-templates')?.addEventListener('click', () => {
            this.renderTemplates();
        });
    }



    renderTemplateCard(template) {
        const preview = template.content.substring(0, 120) + (template.content.length > 120 ? '...' : '');
        const usageText = template.usageCount === 0 ? 'لم يُستخدم بعد' : `استُخدم ${template.usageCount} مرة`;

        return `
            <div class="template-card" style="background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(0, 234, 255, 0.1); border-radius: 15px; padding: 20px; transition: all 0.3s; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
                    <h3 style="color: #00eaff; font-size: 1.2rem; font-weight: 700; margin: 0;">${template.name}</h3>
                    <span style="background: rgba(0, 234, 255, 0.1); color: #00eaff; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: 600;">
                        ${usageText}
                    </span>
                </div>

                ${template.notes ? `<p style="color: #94a3b8; font-size: 0.85rem; margin-bottom: 12px; font-style: italic;">${template.notes}</p>` : ''}

                <div style="background: rgba(255, 255, 255, 0.03); padding: 12px; border-radius: 10px; margin-bottom: 15px; max-height: 100px; overflow-y: auto;">
                    <pre style="color: #e2e8f0; white-space: pre-wrap; font-size: 0.85rem; margin: 0; font-family: 'Tajawal', sans-serif;">${preview}</pre>
                </div>

                <div style="display: flex; gap: 8px;">
                    <button class="btn-neuro template-direct-send-btn" data-id="${template.id}" 
                        style="flex: 1.2; padding: 10px; font-size: 0.85rem; background: #3b82f6; animation: none;">
                        <i class="fa-solid fa-share-right"></i> إرسال للروشيته
                    </button>
                    <button class="btn-neuro template-use-btn" data-id="${template.id}" 
                        style="flex: 1; padding: 10px; font-size: 0.85rem; background: #10b981; animation: none;">
                        <i class="fa-solid fa-copy"></i> نسخ محتوى
                    </button>
                    <button class="btn-edit-tool template-edit-btn" data-id="${template.id}" 
                        title="تعديل" style="padding: 10px 12px;">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-edit-tool template-delete-btn" data-id="${template.id}" 
                        title="حذف" style="padding: 10px 12px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3);">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    handleSearch(query) {
        this.renderTemplates(query.trim());
    }

    renderTemplates(filter = '') {
        const grid = document.getElementById('templates-grid');
        const empty = document.getElementById('templates-empty');

        if (!grid || !empty) return;

        const templates = filter
            ? window.prescriptionTemplates.search(filter)
            : window.prescriptionTemplates.getAll();

        if (templates.length === 0) {
            grid.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        grid.innerHTML = templates.map(t => this.renderTemplateCard(t)).join('');

        // Attach event listeners
        grid.querySelectorAll('.template-use-btn').forEach(btn => {
            btn.onclick = () => this.useTemplate(btn.dataset.id);
        });

        grid.querySelectorAll('.template-direct-send-btn').forEach(btn => {
            btn.onclick = () => this.sendToPrescriptionDirectly(btn.dataset.id);
        });

        grid.querySelectorAll('.template-edit-btn').forEach(btn => {
            btn.onclick = () => this.editTemplate(btn.dataset.id);
        });

        grid.querySelectorAll('.template-delete-btn').forEach(btn => {
            btn.onclick = () => this.deleteTemplate(btn.dataset.id);
        });
    }

    sendToPrescriptionDirectly(id) {
        const template = window.prescriptionTemplates.getById(id);
        if (!template) return;

        // Save to temporary storage for the editor to pickup
        localStorage.setItem('neuro_pending_prescription', template.content);

        // Increase usage
        window.prescriptionTemplates.incrementUsage(id);

        window.soundManager.playSuccess();
        window.showNeuroToast('جاري تحويل المحتوى إلى الروشيته...', 'success');

        // Snap to editor
        setTimeout(() => {
            window.location.href = 'editor.html';
        }, 800);
    }

    showAddTemplateModal() {
        const modalHTML = `
            <div style="text-align: right;">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 700;">اسم القالب *</label>
                    <input type="text" id="template-name-input" class="neuro-input" 
                        placeholder="مثال: صداع نصفي - بروتوكول 1" 
                        style="width: 100%; background: #111827; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 10px; color: white;">
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 700;">محتوى الروشتة *</label>
                    <textarea id="template-content-input" class="neuro-input" 
                        placeholder="اكتب محتوى الروشتة هنا..." 
                        style="width: 100%; height: 200px; background: #111827; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 10px; color: white; resize: vertical; font-family: 'Tajawal', sans-serif;"></textarea>
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 600;">ملاحظات (اختياري)</label>
                    <input type="text" id="template-notes-input" class="neuro-input" 
                        placeholder="مثال: للمرضى فوق 40 سنة" 
                        style="width: 100%; background: #111827; border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; color: #94a3b8;">
                </div>
            </div>
        `;

        window.showNeuroModal('إنشاء قالب جديد', modalHTML, () => {
            const name = document.getElementById('template-name-input').value.trim();
            const content = document.getElementById('template-content-input').value.trim();
            const notes = document.getElementById('template-notes-input').value.trim();

            if (!name || !content) {
                window.soundManager.playError();
                window.showNeuroModal('خطأ', 'يرجى إدخال اسم القالب والمحتوى.', null, false);
                return false;
            }

            window.prescriptionTemplates.addTemplate(name, content, notes);
            this.renderTemplates();
            window.soundManager.playSuccess();
            window.showNeuroModal('تم الحفظ', 'تم حفظ القالب بنجاح!', null, false);
        }, true);
    }

    editTemplate(id) {
        const template = window.prescriptionTemplates.getById(id);
        if (!template) return;

        const modalHTML = `
            <div style="text-align: right;">
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 700;">اسم القالب *</label>
                    <input type="text" id="template-name-input" class="neuro-input" value="${template.name}"
                        style="width: 100%; background: #111827; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 10px; color: white;">
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 700;">محتوى الروشتة *</label>
                    <textarea id="template-content-input" class="neuro-input"
                        style="width: 100%; height: 200px; background: #111827; border: 1px solid rgba(255,255,255,0.1); padding: 12px; border-radius: 10px; color: white; resize: vertical; font-family: 'Tajawal', sans-serif;">${template.content}</textarea>
                </div>
                <div class="form-group" style="margin-bottom: 20px;">
                    <label style="display: block; color: #fff; margin-bottom: 8px; font-weight: 600;">ملاحظات (اختياري)</label>
                    <input type="text" id="template-notes-input" class="neuro-input" value="${template.notes || ''}"
                        style="width: 100%; background: #111827; border: 1px solid rgba(255,255,255,0.05); padding: 12px; border-radius: 10px; color: #94a3b8;">
                </div>
            </div>
        `;

        window.showNeuroModal('تعديل القالب', modalHTML, () => {
            const name = document.getElementById('template-name-input').value.trim();
            const content = document.getElementById('template-content-input').value.trim();
            const notes = document.getElementById('template-notes-input').value.trim();

            if (!name || !content) {
                window.soundManager.playError();
                window.showNeuroModal('خطأ', 'يرجى إدخال اسم القالب والمحتوى.', null, false);
                return false;
            }

            window.prescriptionTemplates.updateTemplate(id, { name, content, notes });
            this.renderTemplates();
            window.soundManager.playSuccess();
            window.showNeuroModal('تم التحديث', 'تم تحديث القالب بنجاح!', null, false);
        }, true);
    }

    deleteTemplate(id) {
        window.soundManager.playBuzz();
        window.showNeuroModal('تأكيد الحذف', 'هل أنت متأكد من حذف هذا القالب؟ لن يمكن استرجاعه.', () => {
            window.prescriptionTemplates.deleteTemplate(id);
            this.renderTemplates();
            window.soundManager.playSuccess();
            window.showNeuroModal('تم الحذف', 'تم حذف القالب بنجاح.', null, false);
        }, true);
    }

    useTemplate(id) {
        const template = window.prescriptionTemplates.getById(id);
        if (!template) return;

        // Copy to clipboard
        navigator.clipboard.writeText(template.content).then(() => {
            window.prescriptionTemplates.incrementUsage(id);
            this.renderTemplates();
            window.soundManager.playSuccess();
            window.showNeuroModal(
                'تم النسخ',
                `تم نسخ القالب "${template.name}" للحافظة!<br><br>الآن يمكنك فتح محرر الروشتات ولصقه (Ctrl+V) في منطقة التحرير.`,
                null,
                false
            );
        }).catch(() => {
            window.soundManager.playError();
            window.showNeuroModal('خطأ', 'فشل النسخ. حاول مرة أخرى.', null, false);
        });
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.templatesUI = new TemplatesUI();
});
