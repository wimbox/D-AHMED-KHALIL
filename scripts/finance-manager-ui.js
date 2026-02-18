/**
 * Finance Manager UI (Independent Full Page)
 */

window.showNeuroModal = (title, msg, onConfirm = null, showCancel = true) => {
    const overlay = document.createElement('div');
    overlay.className = 'neuro-modal-overlay';
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
    confirmBtn.onclick = () => {
        if (onConfirm) {
            const result = onConfirm();
            if (result === false) return;
        }
        overlay.remove();
    };
    if (showCancel) {
        overlay.querySelector('.btn-modal-cancel').onclick = () => overlay.remove();
    }
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
};

class FinanceManagerUI {
    constructor() {
        this.init();
    }

    init() {
        // Load data on startup
        this.renderTable();
        this.updateStats();

        // Listen for storage updates (sync with other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'neuro_clinic_data_v1') {
                this.renderTable();
                this.updateStats();
            }
        });

        // Listen for Real-time Cloud Sync
        window.addEventListener('syncDataRefreshed', () => {
            console.log("FinanceManagerUI: Data refreshed from sync. Updating...");
            this.renderTable();
            this.updateStats();
        });

        // Event Listeners
        document.getElementById('btn-add-income').addEventListener('click', () => this.openAddModal('income'));
        document.getElementById('btn-add-expense-main').addEventListener('click', () => this.openAddModal('expense'));
        document.getElementById('btn-print-report').addEventListener('click', () => this.printReport());

        document.getElementById('finance-search').addEventListener('input', () => this.renderTable());
        document.getElementById('finance-filter-month').addEventListener('change', () => {
            this.renderTable();
            this.updateStats();
        });

        this.populateMonthFilter();
    }

    populateMonthFilter() {
        const select = document.getElementById('finance-filter-month');
        if (!select) return;

        const monthsNames = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        select.innerHTML = '';

        // Logic: Show from 6 months in the FUTURE down to JANUARY of the CURRENT year only
        // This effectively removes 2025 and any previous years from the list
        for (let i = -6; i <= currentMonth; i++) {
            const date = new Date(currentYear, currentMonth - i, 1);
            const m = date.getMonth();
            const y = date.getFullYear();

            // Safety check: Don't show anything before current year
            if (y < currentYear) continue;

            const option = document.createElement('option');
            option.value = `${y}-${String(m + 1).padStart(2, '0')}`;
            option.text = `${monthsNames[m]} ${y}`;

            if (i === 0) option.selected = true;
            select.appendChild(option);
        }
    }

    getFilteredData() {
        const query = document.getElementById('finance-search').value.toLowerCase();
        const monthFilter = document.getElementById('finance-filter-month').value; // YYYY-MM

        let txs = syncManager.getTransactionsByClinic();

        // Apply Month Filter
        if (monthFilter) {
            txs = txs.filter(t => {
                if (!t.date) return false;
                const cleanDate = t.date.replace(/\//g, '-');
                return cleanDate.startsWith(monthFilter);
            });
        }

        // Apply Search
        if (query) {
            txs = txs.filter(t =>
                t.description.toLowerCase().includes(query) ||
                (t.beneficiary && t.beneficiary.toLowerCase().includes(query)) ||
                t.amount.toString().includes(query)
            );
        }

        return txs.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    renderTable() {
        const data = this.getFilteredData();
        const tbody = document.getElementById('finance-grid-body');

        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #64748b; font-size: 1.2rem;">لا توجد عمليات مسجلة لهذا الشهر</td></tr>`;
            return;
        }

        tbody.innerHTML = data.map(t => {
            const paid = parseFloat(t.amount || 0);
            const original = parseFloat(t.originalAmount || paid);
            const remaining = original - paid;

            return `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 15px; color: #94a3b8;">${new Date(t.date).toLocaleDateString('ar-EG')} <span style="font-size:0.8rem; opacity:0.5">${new Date(t.date).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></td>
                <td style="padding: 15px; font-weight: 600; color: #fff;">${t.description}</td>
                <td style="padding: 15px;">
                    <span style="
                        background: ${t.type === 'income' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'};
                        color: ${t.type === 'income' ? '#10b981' : '#ef4444'};
                        padding: 5px 12px;
                        border-radius: 20px;
                        font-size: 0.9rem;
                        border: 1px solid ${t.type === 'income' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                    ">${t.type === 'income' ? 'إيراد' : 'مصروف'}</span>
                </td>
                <td style="padding: 15px; font-weight: 700; color: #cbd5e1;">
                    ${original.toLocaleString()} ${syncManager.getActiveClinic()?.settings?.currency || 'EGP'}
                </td>
                <td style="padding: 15px; font-weight: 800; font-family: 'Inter'; font-size: 1.1rem; color: ${t.type === 'income' ? '#10b981' : '#ef4444'};">
                    ${paid.toLocaleString()} ${syncManager.getActiveClinic()?.settings?.currency || 'EGP'}
                </td>
                <td style="padding: 15px; font-weight: 700; color: ${remaining > 0 ? '#f59e0b' : '#64748b'};">
                    ${remaining.toLocaleString()} ${syncManager.getActiveClinic()?.settings?.currency || 'EGP'}
                </td>
                <td style="padding: 15px; color: #cbd5e1;">${t.beneficiary || '-'}</td>
                <td style="padding: 15px;">
                    <div style="display: flex; gap: 10px;">
                        <button onclick="financeManager.editTx('${t.id}')" title="تعديل" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #3b82f6; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; transition: 0.2s;">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button onclick="financeManager.deleteTx('${t.id}')" title="حذف" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; width: 35px; height: 35px; border-radius: 8px; cursor: pointer; transition: 0.2s;">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }

    updateStats() {
        // Calculate based on CURRENT FILTER (Month)
        const data = this.getFilteredData();

        let income = 0;
        let expense = 0;

        data.forEach(t => {
            if (t.type === 'income') income += parseFloat(t.amount);
            else expense += parseFloat(t.amount);
        });

        const currency = syncManager.getActiveClinic()?.settings?.currency || 'EGP';
        document.getElementById('total-income').innerText = income.toLocaleString() + ' ' + currency;
        document.getElementById('total-expense').innerText = expense.toLocaleString() + ' ' + currency;

        const net = income - expense;
        const netEl = document.getElementById('net-profit');
        netEl.innerText = net.toLocaleString() + ' ' + currency;
        netEl.style.color = net >= 0 ? '#10b981' : '#ef4444';
    }

    openAddModal(type) {
        const isExpense = type === 'expense';
        const title = isExpense ? 'تسجيل مصروف جديد' : 'تسجيل إيراد جديد';
        const color = isExpense ? '#ef4444' : '#10b981';

        const modalHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div style="background: #1e293b; width: 700px; padding: 40px 50px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
                    <h2 style="color: ${color}; margin-bottom: 30px; font-size: 1.8rem;"><i class="fa-solid ${isExpense ? 'fa-minus-circle' : 'fa-plus-circle'}"></i> ${title}</h2>
                    
                    <div style="margin-bottom: 20px; text-align: right;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 10px; font-size: 1.05rem; text-align: right;">التاريخ</label>
                        <input type="datetime-local" id="new-tx-date" class="neuro-input" style="width: 100%; font-size: 1.1rem; padding: 12px; text-align: center;" value="${new Date().toISOString().slice(0, 16)}">
                    </div>

                    <div style="margin-bottom: 20px; text-align: right;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 10px; font-size: 1.05rem; text-align: right;">الوصف / البيان</label>
                        <input type="text" id="new-tx-desc" class="neuro-input" placeholder="مثال: فاتورة كهرباء، صيانة..." style="width: 100%; font-size: 1.1rem; padding: 12px; text-align: right;">
                    </div>

                    <div style="margin-bottom: 20px; text-align: right;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 10px; font-size: 1.05rem; text-align: right;">المبلغ الأساسي (الإجمالي)</label>
                        <input type="number" id="new-tx-original" class="neuro-input" placeholder="0.00" style="width: 100%; font-size: 1.2rem; padding: 12px; text-align: center;">
                    </div>

                    <div style="margin-bottom: 20px; text-align: right;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 10px; font-size: 1.05rem; text-align: right;">المدفوع حالياً</label>
                        <input type="number" id="new-tx-amount" class="neuro-input" placeholder="0.00" style="width: 100%; font-size: 1.3rem; font-weight: bold; padding: 12px; text-align: center;">
                    </div>

                    <div style="margin-bottom: 30px; text-align: right;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 10px; font-size: 1.05rem; text-align: right;">المستفيد / المصدر (اختياري)</label>
                        <input type="text" id="new-tx-beneficiary" class="neuro-input" placeholder="اسم الشخص أو الجهة" style="width: 100%; font-size: 1.1rem; padding: 12px; text-align: right;">
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="this.closest('div[style*=\'position: fixed\']').parentElement.remove()" class="btn-neuro" style="background: transparent; border: 1px solid #64748b; color: #cbd5e1;">إلغاء</button>
                        <button id="btn-save-new-tx" class="btn-neuro" style="background: ${color}; border-color: ${color}; color: #fff;">حفظ العملية</button>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHTML;
        document.body.appendChild(wrapper);

        // Get overlay and cancel button
        const overlay = wrapper.firstElementChild;
        const cancelBtn = wrapper.querySelector('button[onclick*="closest"]');

        // Override cancel button behavior
        cancelBtn.onclick = (e) => {
            e.preventDefault();
            wrapper.remove();
        };

        // Close on backdrop click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                wrapper.remove();
            }
        };

        // Auto-fill logic
        const origInput = document.getElementById('new-tx-original');
        const paidInput = document.getElementById('new-tx-amount');

        // If user enters Original first, auto-fill Paid
        origInput.addEventListener('change', () => {
            if (!paidInput.value) paidInput.value = origInput.value;
        });

        // Focus
        setTimeout(() => origInput.focus(), 100);

        document.getElementById('btn-save-new-tx').onclick = () => {
            const date = document.getElementById('new-tx-date').value;
            const desc = document.getElementById('new-tx-desc').value;
            const amount = parseFloat(document.getElementById('new-tx-amount').value);
            const original = parseFloat(document.getElementById('new-tx-original').value);
            const beneficiary = document.getElementById('new-tx-beneficiary').value;

            if (!amount || amount <= 0 || !desc) {
                window.soundManager.playError();
                if (window.showNeuroToast) window.showNeuroToast('يرجى إدخال المبلغ والوصف بشكل صحيح.', 'error');
                else alert('يرجى إدخال المبلغ والوصف بشكل صحيح.');
                return;
            }

            const finalOriginal = (original && original >= amount) ? original : amount;

            const tx = {
                id: crypto.randomUUID(),
                date: new Date(date).toISOString(),
                type: type,
                amount: amount,
                originalAmount: finalOriginal,
                description: desc,
                beneficiary: beneficiary || (type === 'income' ? 'عيادة' : 'مورد')
            };

            syncManager.addTransaction(tx);

            // Close modal
            wrapper.remove();

            // Refresh
            this.renderTable();
            this.updateStats();
            window.soundManager.playSuccess();

            // Show Success Notification
            this.showNotification(`تم تسجيل ${isExpense ? 'المصروف' : 'الإيراد'} بنجاح`);
        };
    }

    editTx(id) {
        const tx = syncManager.data.finances.transactions.find(t => t.id === id);
        if (!tx) return;

        const modalHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 2000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div style="background: #1e293b; width: 700px; padding: 40px 50px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1);">
                    <h2 style="color: #3b82f6; margin-bottom: 30px; font-size: 1.8rem;"><i class="fa-solid fa-pen-to-square"></i> تعديل عملية</h2>
                    
                     <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 8px;">التاريخ</label>
                        <input type="datetime-local" id="edit-tx-date" class="neuro-input" style="width: 100%;" value="${tx.date.substring(0, 16)}">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 8px;">النوع</label>
                        <select id="edit-tx-type" class="neuro-input" style="width: 100%;">
                            <option value="income" ${tx.type === 'income' ? 'selected' : ''}>إيراد</option>
                            <option value="expense" ${tx.type === 'expense' ? 'selected' : ''}>مصروف</option>
                        </select>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 8px;">الوصف</label>
                        <input type="text" id="edit-tx-desc" class="neuro-input" value="${tx.description}" style="width: 100%;">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 8px;">المبلغ الأساسي</label>
                        <input type="number" id="edit-tx-original" class="neuro-input" value="${tx.originalAmount || tx.amount}" style="width: 100%;">
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; color: #94a3b8; margin-bottom: 8px;">المدفوع</label>
                        <input type="number" id="edit-tx-amount" class="neuro-input" value="${tx.amount}" style="width: 100%;">
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                         <label style="display: block; color: #94a3b8; margin-bottom: 8px;">المستفيد</label>
                        <input type="text" id="edit-tx-beneficiary" class="neuro-input" value="${tx.beneficiary || ''}" style="width: 100%;">
                    </div>

                    <div style="display: flex; gap: 10px; justify-content: flex-end;">
                        <button onclick="this.closest('div[style*=\'position: fixed\']').parentElement.remove()" class="btn-neuro" style="background: transparent; border: 1px solid #64748b; color: #cbd5e1;">إلغاء</button>
                        <button id="btn-update-tx" class="btn-neuro" style="background: #3b82f6; border-color: #3b82f6; color: #fff;">حفظ التعديلات</button>
                    </div>
                </div>
            </div>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = modalHTML;
        document.body.appendChild(wrapper);

        // Get overlay and cancel button
        const overlay = wrapper.firstElementChild;
        const cancelBtn = wrapper.querySelector('button[onclick*="closest"]');

        // Override cancel button behavior
        cancelBtn.onclick = (e) => {
            e.preventDefault();
            wrapper.remove();
        };

        // Close on backdrop click
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                wrapper.remove();
            }
        };

        document.getElementById('btn-update-tx').onclick = () => {
            const index = syncManager.data.finances.transactions.findIndex(t => t.id === id);
            if (index === -1) return;

            const amount = parseFloat(document.getElementById('edit-tx-amount').value);
            const original = parseFloat(document.getElementById('edit-tx-original').value);
            const finalOriginal = (original && original >= amount) ? original : amount;

            syncManager.data.finances.transactions[index] = {
                ...syncManager.data.finances.transactions[index],
                date: new Date(document.getElementById('edit-tx-date').value).toISOString(),
                type: document.getElementById('edit-tx-type').value,
                description: document.getElementById('edit-tx-desc').value,
                amount: amount,
                originalAmount: finalOriginal,
                beneficiary: document.getElementById('edit-tx-beneficiary').value
            };
            syncManager.saveLocal();

            wrapper.remove();
            this.renderTable();
            this.updateStats();
            window.soundManager.playSuccess();
            this.showNotification('تم تحديث البيانات بنجاح');
        };
    }

    deleteTx(id) {
        if (!window.authManager.isAdmin()) {
            window.soundManager.playError();
            this.showNotification('عفواً، صلاحية الحذف للمدير فقط.', 'error');
            return;
        }

        window.soundManager.playBuzz();
        showNeuroModal('تأكيد الحذف', 'هل أنت متأكد تماماً من حذف هذا السجل المالي نهائياً؟', () => {
            syncManager.data.finances.transactions = syncManager.data.finances.transactions.filter(t => t.id !== id);
            syncManager.saveLocal();
            this.renderTable();
            this.updateStats();
            window.soundManager.playSuccess();
            this.showNotification('تم الحذف بنجاح');
        }, true);
    }

    printReport() {
        // Trigger print function (assuming browser default for now or we build a print view)
        window.print();
    }

    showNotification(msg, type = 'success') {
        // Use global toast if available (from dashboard or defined here)
        if (window.showNeuroToast) {
            window.showNeuroToast(msg, type);
            return;
        }

        const div = document.createElement('div');
        div.style.cssText = `
            position: fixed;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(239, 68, 68, 0.9)'};
            color: white;
            padding: 15px 30px;
            border-radius: 50px;
            font-weight: bold;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            z-index: 3000;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        `;
        div.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> ${msg}`;
        document.body.appendChild(div);

        setTimeout(() => div.remove(), 3000);
    }
}

window.financeManager = new FinanceManagerUI();
