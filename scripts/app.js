/* =========================================
   Custom Modal System
   ========================================= */
function showCustomModal(title, message, onConfirm = null, showCancel = true, showInput = false, inputPlaceholder = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 30000;
            animation: fadeIn 0.2s ease;
        `;

        const modal = document.createElement('div');
        modal.style.cssText = `
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            border: 1px solid rgba(0, 234, 255, 0.3);
            border-radius: 16px;
            padding: 30px;
            max-width: 450px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 234, 255, 0.2);
            animation: slideUp 0.3s ease;
        `;

        modal.innerHTML = `
            <h2 style="color: #00eaff; margin: 0 0 15px 0; font-size: 1.5rem; text-align: right;">${title}</h2>
            <p style="color: #cbd5e1; margin: 0 0 20px 0; line-height: 1.6; text-align: right;">${message}</p>
            ${showInput ? `
                <input type="text" id="modal-prompt-input" placeholder="${inputPlaceholder}" style="width: 100%; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,234,255,0.3); border-radius: 8px; color: white; margin-bottom: 25px; outline: none; font-size: 1rem; text-align: right;">
            ` : ''}
            <div style="flex: 1; display: flex; gap: 10px; justify-content: flex-end;">
                ${showCancel ? '<button class="modal-cancel" style="flex: 1; padding: 12px 24px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #cbd5e1; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: all 0.3s;">إلغاء</button>' : ''}
                <button class="modal-confirm" style="flex: 1; padding: 12px 24px; background: linear-gradient(135deg, #00eaff 0%, #0ea5e9 100%); border: none; color: #000; font-weight: 600; border-radius: 8px; cursor: pointer; font-size: 1rem; box-shadow: 0 4px 15px rgba(0, 234, 255, 0.4); transition: all 0.3s;">تأكيد</button>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const inputEl = modal.querySelector('#modal-prompt-input');
        if (inputEl) {
            setTimeout(() => inputEl.focus(), 100);
            inputEl.onkeydown = (e) => {
                if (e.key === 'Enter') confirmBtn.click();
            };
        }

        const confirmBtn = modal.querySelector('.modal-confirm');
        const cancelBtn = modal.querySelector('.modal-cancel');

        confirmBtn.onclick = () => {
            const val = inputEl ? inputEl.value : true;
            overlay.remove();
            if (onConfirm) onConfirm(val);
            resolve(val);
        };

        if (cancelBtn) {
            cancelBtn.onclick = () => {
                overlay.remove();
                resolve(null);
            };
        }

        overlay.onclick = (e) => {
            if (e.target === overlay) {
                overlay.remove();
                resolve(null);
            }
        };
    });
}

/* =========================================
   Security & Encryption (security.js)
   ========================================= */
class SecurityManager {
    constructor() {
        this.key = null;
    }

    async generateKey() {
        this.key = await window.crypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256
            },
            true,
            ["encrypt", "decrypt"]
        );
        return this.key;
    }

    async encryptData(data) {
        if (!this.key) await this.generateKey();

        const encoder = new TextEncoder();
        const encodedData = encoder.encode(JSON.stringify(data));

        // IV must be unique for every encryption
        const iv = window.crypto.getRandomValues(new Uint8Array(12));

        const encryptedContent = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.key,
            encodedData
        );

        // Return IV + Encrypted Data
        return {
            iv: Array.from(iv),
            content: Array.from(new Uint8Array(encryptedContent))
        };
    }

    async decryptData(encryptedObject) {
        if (!this.key) throw new Error("No key loaded");

        const iv = new Uint8Array(encryptedObject.iv);
        const content = new Uint8Array(encryptedObject.content);

        const decryptedContent = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            this.key,
            content
        );

        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decryptedContent));
    }
}

/* =========================================
   Watermarking (watermark.js)
   ========================================= */
class Watermarker {
    constructor() {
        this.ctx = null;
    }

    // Convert text to binary string
    textToBin(text) {
        return text.split('').map(char => {
            return char.charCodeAt(0).toString(2).padStart(8, '0');
        }).join('');
    }

    // Convert binary string to text
    binToText(bin) {
        return bin.match(/.{1,8}/g).map(byte => {
            return String.fromCharCode(parseInt(byte, 2));
        }).join('');
    }

    generateWatermarkCanvas(width, height, dataObject) {
        const json = JSON.stringify(dataObject);
        const binary = this.textToBin(json);
        const finalBinary = binary + "00000000";

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        let dataIndex = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (dataIndex < finalBinary.length) {
                data[i] = 0; // R
                data[i + 1] = 0; // G
                data[i + 2] = 0; // B
                data[i + 3] = finalBinary[dataIndex] === '1' ? 2 : 1;
                dataIndex++;
            } else {
                data[i + 3] = 0; // Transparent
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    async decodeFromCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        let binary = '';

        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha === 0) break;

            if (alpha === 2) binary += '1';
            else if (alpha === 1) binary += '0';
            else {
                break;
            }
        }

        try {
            const text = this.binToText(binary);
            const nullTerm = text.indexOf('\0');
            const cleanText = nullTerm !== -1 ? text.substring(0, nullTerm) : text;

            return JSON.parse(cleanText);
        } catch (e) {
            console.error("Watermark extraction failed", e);
            return null;
        }
    }
}

/* =========================================
   Editor Logic (editor.js)
   ========================================= */
class Editor {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.contentLayer = this.canvas.querySelector('.content-layer');
        this.backgroundLayer = this.canvas.querySelector('.background-layer');
        this.isLocked = false;

        this.setupEventListeners();

        // Initialize Autosave
        this.loadFromStorage();
        this.setupAutoSave();
    }

    toggleLock() {
        this.isLocked = !this.isLocked;
        const sheet = document.getElementById('prescription-canvas');
        if (this.isLocked) {
            sheet.classList.add('locked');
            this.deselectAll(); // Clear selection so borders disappear
        } else {
            sheet.classList.remove('locked');
        }
        return this.isLocked;
    }

    setupEventListeners() {
        // Initialize AutoSave if not already done (idempotent check or just call)
        // Actually best to call init in constructor, listeners here.

        this.contentLayer.addEventListener('mousedown', (e) => {
            if (e.target === this.contentLayer) {
                this.deselectAll();
            }
        });

        document.addEventListener('keydown', (e) => {
            if (this.selectedElement) {
                if (e.key === 'Delete') {
                    this.deleteElement(this.selectedElement);
                }
            }
        });
    }

    addText(initialText = "") {
        const div = document.createElement('div');
        div.contentEditable = true;
        div.spellcheck = false;
        div.className = 'text-element';

        // If empty, put a placeholder-like structure or just focus
        if (!initialText) {
            // Create a list or standard prescription intro
            div.innerHTML = `<div><br></div>`;
        } else {
            div.innerText = initialText;
        }

        // Position: Fill the whitespace below header
        div.style.position = 'absolute';
        div.style.top = '272px'; /* تم إنزاله بمقدار 1.5 سم (حوالي 57 بكسل إضافية) */
        div.style.right = '5%'; /* Centered roughly */
        div.style.width = '90%';
        div.style.left = 'auto';
        div.style.height = '600px'; /* Fill down to footer */

        // Styling
        div.style.fontSize = '20px';
        div.style.fontWeight = '500';
        div.style.fontFamily = "'Tajawal', sans-serif";
        div.style.color = '#1e293b';
        div.style.lineHeight = '1.8';
        div.style.textAlign = 'right';

        // Allow it to be a big block
        div.style.overflow = 'hidden';

        div.addEventListener('mousedown', (e) => this.handleMouseDown(e, div));
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectElement(div);
        });

        this.contentLayer.appendChild(div);
        this.selectElement(div);
        return div;
    }

    handleMouseDown(e, element) {
        if (this.isLocked) return; // Prevent dragging if locked
        if (e.target !== element) return;

        // If element is positioned by 'right', convert to 'left' for dragging logic
        if (element.style.left === 'auto' || !element.style.left) {
            const computedLeft = element.getBoundingClientRect().left - this.contentLayer.getBoundingClientRect().left;
            element.style.left = `${computedLeft}px`;
            element.style.right = 'auto';
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const rect = element.getBoundingClientRect();
        const offsetX = startX - rect.left;
        const offsetY = startY - rect.top;

        const onMouseMove = (moveEvent) => {
            const canvasRect = this.contentLayer.getBoundingClientRect();
            let newLeft = moveEvent.clientX - canvasRect.left - offsetX;
            let newTop = moveEvent.clientY - canvasRect.top - offsetY;

            element.style.left = `${newLeft}px`;
            element.style.top = `${newTop}px`;
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    selectElement(element) {
        this.deselectAll();
        this.selectedElement = element;
        element.classList.add('selected');

        const event = new CustomEvent('elementSelected', { detail: { element } });
        document.dispatchEvent(event);
    }

    deselectAll() {
        if (this.selectedElement) {
            this.selectedElement.classList.remove('selected');
            this.selectedElement = null;
            document.dispatchEvent(new CustomEvent('selectionCleared'));
        }
    }

    deleteElement(element) {
        element.remove();
        this.selectedElement = null;
        document.dispatchEvent(new CustomEvent('selectionCleared'));
    }

    updateStyle(property, value) {
        if (this.selectedElement) {
            this.selectedElement.style[property] = value;
        }
    }

    setBackground(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.backgroundLayer.style.backgroundImage = `url(${e.target.result})`;
            this.saveToStorage(); // Save background change
        };
        reader.readAsDataURL(file);
    }

    /* ===========================
       Auto-Save System
       =========================== */
    setupAutoSave() {
        // Save every time DOM changes in content layer
        const observer = new MutationObserver(() => this.saveToStorage());
        observer.observe(this.contentLayer, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true
        });

        // Also save on mouseup (end of drag)
        this.contentLayer.addEventListener('mouseup', () => this.saveToStorage());
        this.contentLayer.addEventListener('keyup', () => this.saveToStorage());

        // Save header fields when changed
        const headerFields = ['patient-name', 'patient-age', 'patient-date'];
        headerFields.forEach(fieldId => {
            const elem = document.getElementById(fieldId);
            if (elem) {
                elem.addEventListener('input', () => this.saveToStorage());
                elem.addEventListener('blur', () => this.saveToStorage());
            }
        });

        // Save writing areas when changed
        const writingAreas = ['right-margin-area', 'main-content-area'];
        writingAreas.forEach(areaId => {
            const area = document.getElementById(areaId);
            if (area) {
                area.addEventListener('input', () => this.saveToStorage());
                area.addEventListener('blur', () => this.saveToStorage());
            }
        });
    }

    saveToStorage() {
        const data = {
            html: this.contentLayer.innerHTML,
            bg: this.backgroundLayer.style.backgroundImage,
            timestamp: Date.now(),
            // Save header fields (contenteditable)
            patientName: document.getElementById('patient-name')?.textContent || '',
            patientAge: document.getElementById('patient-age')?.textContent || '',
            patientDate: document.getElementById('patient-date')?.textContent || '',
            // Save writing areas
            marginArea: document.getElementById('right-margin-area')?.innerHTML || '',
            mainArea: document.getElementById('main-content-area')?.innerHTML || ''
        };
        localStorage.setItem('mediscript_autosave', JSON.stringify(data));
        this.showSaveStatus('Saved');
    }

    loadFromStorage() {
        const saved = localStorage.getItem('mediscript_autosave');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.contentLayer.innerHTML = data.html;
                if (data.bg) this.backgroundLayer.style.backgroundImage = data.bg;

                // Restore header fields
                if (data.patientName) document.getElementById('patient-name').textContent = data.patientName;
                if (data.patientAge) document.getElementById('patient-age').textContent = data.patientAge;
                if (data.patientDate) document.getElementById('patient-date').textContent = data.patientDate;

                // Restore writing areas
                if (data.marginArea) document.getElementById('right-margin-area').innerHTML = data.marginArea;
                if (data.mainArea) document.getElementById('main-content-area').innerHTML = data.mainArea;

                // Re-attach listeners to new elements
                Array.from(this.contentLayer.children).forEach(el => {
                    el.addEventListener('mousedown', (e) => this.handleMouseDown(e, el));
                    el.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.selectElement(el);
                    });
                });
                console.log("Restored from Autosave");
            } catch (e) {
                console.error("Failed to load autosave", e);
            }
        }
    }

    clearWorkspace() {
        this.contentLayer.innerHTML = '';
        // Clear header fields (contenteditable)
        const patientName = document.getElementById('patient-name');
        const patientAge = document.getElementById('patient-age');
        const patientGender = document.getElementById('patient-gender');
        const patientDate = document.getElementById('patient-date');
        if (patientName) patientName.textContent = '';
        if (patientAge) patientAge.textContent = '';
        if (patientGender) patientGender.textContent = '';
        if (patientDate) patientDate.textContent = '';

        // Clear Patient ID
        const patientIdDisplay = document.getElementById('patient-id-display');
        if (patientIdDisplay) patientIdDisplay.textContent = '';

        // Clear writing areas
        const marginArea = document.getElementById('right-margin-area');
        const mainArea = document.getElementById('main-content-area');
        if (marginArea) marginArea.innerHTML = '';
        if (mainArea) mainArea.innerHTML = '';

        // Hide alerts
        const alertBadge = document.getElementById('allergy-badge');
        if (alertBadge) alertBadge.classList.add('hidden');

        this.saveToStorage();
        this.deselectAll();
    }

    showSaveStatus(msg) {
        const indicator = document.getElementById('security-status');
        if (indicator) {
            const original = indicator.innerHTML;
            indicator.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> ${msg}`;
            indicator.style.color = '#10b981'; // Green
            setTimeout(() => {
                indicator.innerHTML = original; // Revert to "Protected"
                indicator.style.color = '';
            }, 1500);
        }
    }
}

/* =========================================
   Main Application (app.js)
   ========================================= */
class App {
    constructor() {
        this.editor = new Editor('prescription-canvas');
        this.watermarker = new Watermarker();
        this.security = new SecurityManager();

        this.initUI();
        this.initTools();
        this.initPatientIntegration();

        // Fix: Listen for cloud sync updates to populate patient info if it wasn't ready initially
        window.addEventListener('syncDataRefreshed', () => {
            console.log("App: Data synced from cloud. Refreshing patient integration...");
            this.initPatientIntegration();
        });

        // تتبع آخر منطقة كتابة تم التركيز عليها لضمان عمل زر الاتجاه بشكل سليم
        this.lastFocusedArea = document.getElementById('main-content-area');
        [document.getElementById('main-content-area'), document.getElementById('right-margin-area')].forEach(area => {
            if (area) {
                area.addEventListener('focus', () => {
                    this.lastFocusedArea = area;
                });
            }
        });
    }

    initPatientIntegration() {
        const selected = patientManager.getSelectedPatient();
        if (selected) {
            console.log("Patient selected from dashboard:", selected);
            const nameEl = document.getElementById('patient-name');
            const ageEl = document.getElementById('patient-age');
            const genderEl = document.getElementById('patient-gender');

            if (nameEl) nameEl.textContent = selected.name;
            if (ageEl) {
                // Digital Prescription Standard: Show only digits, strip units (سنة، شهر، يوم)
                const ageDigitsOnly = selected.age ? selected.age.split(' ')[0] : '--';
                ageEl.textContent = ageDigitsOnly;
            }
            if (genderEl) genderEl.textContent = selected.gender;

            // Patient ID Display
            const idEl = document.getElementById('patient-id-display');
            if (idEl) {
                // Ensure ID is displayed as #123#
                // We use the patientCode (human readable) instead of the UUID
                const code = selected.patientCode || '---';
                idEl.textContent = `#${code}#`;
            }

            // Show allergy alert if exists
            if (selected.allergies) {
                const badge = document.getElementById('allergy-badge');
                const text = document.getElementById('allergy-text');
                if (badge && text) {
                    text.textContent = selected.allergies;
                    badge.classList.remove('hidden');
                }
            }

            // Note: date is auto-filled in initHeaderFieldsFeatures
        }

        // Repeat Last Button
        const repeatBtn = document.getElementById('btn-repeat-last');
        if (repeatBtn) {
            repeatBtn.addEventListener('click', () => {
                const patient = patientManager.getSelectedPatient() || patientManager.currentPatient;
                if (!patient || !patient.visits || patient.visits.length === 0) {
                    showCustomModal('تنبيه', "لا توجد زيارات سابقة لهذا المريض لتكرارها.", null, false);
                    return;
                }

                const lastVisit = patient.visits[0];
                if (lastVisit.medicines && lastVisit.medicines.length > 0) {
                    const mainArea = document.getElementById('main-content-area');

                    // Helper to clean old data on the fly
                    const cleanOldData = (text) => {
                        if (!text) return "";
                        return text
                            .replace(/["']/g, '') // Remove quotes
                            .replace(/\(([^)]+)\)/g, '- $1') // Convert (text) to - text
                            .replace(/^[,\s-]+|[,\s-]+$/g, '') // Clean start/end
                            .trim();
                    };

                    const content = lastVisit.medicines.map(m => `<div>${cleanOldData(m)}</div>`).join('');
                    if (!mainArea.innerHTML.trim()) {
                        mainArea.innerHTML = content;
                    } else {
                        mainArea.innerHTML += "<div><br></div>" + content;
                    }
                    this.editor.saveToStorage();
                    this.editor.showSaveStatus('Repeated');
                } else {
                    showCustomModal('تنبيه', "الزيارة السابقة لا تحتوي على أدوية مسجلة.", null, false);
                }
            });
        }
    }

    initDatabaseTools() {
        const addBtn = document.getElementById('btn-add-to-db');
        const bulkBtn = document.getElementById('btn-bulk-add');
        const input = document.getElementById('new-medicine-input');

        if (addBtn && input) {
            addBtn.addEventListener('click', () => {
                const name = input.value.trim();
                if (name) {
                    this.addMedicineToDB(name);
                    input.value = '';
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    addBtn.click();
                }
            });
        }

        if (bulkBtn) {
            bulkBtn.addEventListener('click', () => {
                const modal = document.getElementById('database-modal');
                if (modal) modal.classList.remove('hidden');
                this.renderDatabaseList(); // Refresh list just in case
            });
        }

        const exportBtn = document.getElementById('btn-export-js');
        const exportBtnModal = document.getElementById('btn-db-export-js');

        [exportBtn, exportBtnModal].forEach(btn => {
            if (btn) btn.addEventListener('click', () => this.exportUpdatedMedicines());
        });

        this.initDatabaseManager();
    }

    async exportUpdatedMedicines() {
        const meds = (typeof MEDICINE_DB !== 'undefined') ? MEDICINE_DB : [];
        const userMeds = (typeof USER_MEDICINES !== 'undefined') ? USER_MEDICINES : [];

        // Merge and unique
        const fullList = Array.from(new Set([...meds, ...userMeds]));

        if (fullList.length === 0) {
            alert("خطأ: لم يتم العثور على أي أدوية في النظام لتصديرها.");
            return;
        }

        // Build the JS file content
        let content = `// UTF-8\n// Updated on: ${new Date().toLocaleString()}\n`;
        content += `const MEDICINE_DB = [\n`;
        fullList.sort().forEach((med, idx) => {
            content += `    "${med.replace(/"/g, '\\"')}"${idx < fullList.length - 1 ? ',' : ''}\n`;
        });
        content += `];\n\n`;
        content += `// SECTION: USER CUSTOM ADDITIONS\n`;
        content += `const CUSTOM_MEDICINES = [];\n\n`;
        content += `if (typeof MEDICINE_DB !== 'undefined') {\n`;
        content += `    MEDICINE_DB.push(...CUSTOM_MEDICINES);\n`;
        content += `}\n`;

        // Modern Approach: File System Access API (Smart Save)
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: 'medicines.js',
                    types: [{
                        description: 'JavaScript File',
                        accept: { 'application/javascript': ['.js'] },
                    }],
                });
                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();
                alert("تم تحديث الملف بنجاح في مكانه!");
                return;
            } catch (err) {
                // If user cancels or error occurs, fall back to old method
                if (err.name === 'AbortError') return;
                console.warn("Smart Save failed, falling back to legacy download:", err);
            }
        }

        // Legacy Fallback Method
        const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'medicines.js';

        // Simple success message before download
        alert("سيتم الآن تنزيل ملف medicines.js المحدث.\nفضلاً قم باستبدال الملف القديم في مجلد scripts بهذا الملف ليكون التغيير دائماً.");

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    addMedicineToDB(name) {
        if (typeof MEDICINE_DB !== 'undefined') {
            if (!MEDICINE_DB.includes(name)) {
                // Add to runtime DB
                MEDICINE_DB.push(name);

                // Track in session list (optional)
                console.log(`[DB] Added: ${name}`);

                // Update UI Feedback
                const securityStatus = document.getElementById('security-status');
                if (securityStatus) {
                    const original = securityStatus.innerHTML;
                    securityStatus.innerHTML = `<i class="fa-solid fa-database"></i> Added: ${name}`;
                    securityStatus.style.color = '#10b981';
                    setTimeout(() => {
                        securityStatus.innerHTML = original;
                        securityStatus.style.color = '';
                    }, 2500);
                }

                showCustomModal('تمت الإضافة', `تمت إضافة "${name}" بنجاح! سيظهر الآن في الاقتراحات.`, null, false);

                // Update manage list if modal is open
                this.renderDatabaseList();

                // Persist to localStorage
                const custom = JSON.parse(localStorage.getItem('custom_medicines') || '[]');
                if (!custom.includes(name)) {
                    custom.push(name);
                    localStorage.setItem('custom_medicines', JSON.stringify(custom));
                }
            } else {
                showCustomModal('تنبيه', "هذا الدواء موجود مسبقاً في القائمة.", null, false);
            }
        }
    }

    loadUserCustomMedicines() {
        const customString = localStorage.getItem('custom_medicines');
        if (customString && typeof MEDICINE_DB !== 'undefined') {
            try {
                const list = JSON.parse(customString);
                if (Array.isArray(list)) {
                    list.forEach(m => {
                        if (!MEDICINE_DB.includes(m)) MEDICINE_DB.push(m);
                    });
                    console.log(`Loaded ${list.length} custom medicines from storage.`);
                }
            } catch (e) {
                console.error("Failed to load custom medicines", e);
            }
        }
    }

    initUI() {
        // Navigation Switcher
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) {
                    // Logic to switch panels if we implemented them
                    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });

        // Theme Switcher
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove all themes
                document.body.classList.remove('theme-blue', 'theme-gray', 'theme-red', 'theme-brown', 'theme-gold', 'theme-light');
                // Add new theme
                document.body.classList.add(btn.dataset.theme);

                // Save theme preference
                localStorage.setItem('selectedTheme', btn.dataset.theme);

                // Update active state visual
                document.querySelectorAll('.theme-btn').forEach(b => b.style.borderColor = 'transparent');
                btn.style.borderColor = 'white';
            });
        });

        // Verification Handler
        const verifyInput = document.createElement('input');
        verifyInput.type = 'file';
        verifyInput.accept = 'image/*';
        verifyInput.style.display = 'none';
        document.body.appendChild(verifyInput);

        verifyInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                const img = new Image();
                img.onload = async () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0);

                    const data = await this.watermarker.decodeFromCanvas(canvas);
                    if (data) {
                        showCustomModal('تم التحقق', `تم التحقق من المستند بنجاح!\n\nID: ${data.docId}\nالتاريخ: ${new Date(data.timestamp).toLocaleString()}\nالعيادة: ${data.clinicId}`, null, false);
                    } else {
                        showCustomModal('فشل التحقق', "فشل التحقق من المستند: لم يتم العثور على علامة مائية صالحة.", null, false);
                    }
                };
                img.src = URL.createObjectURL(file);
            }
        });

        // Button Listeners
        const verifyBtn = document.querySelector('[data-view="verify"]');
        if (verifyBtn) verifyBtn.addEventListener('click', () => verifyInput.click());

        // Workspace Background Changer
        this.initWorkspaceBackground();

        // Background Toggle (View & Print)
        const printModeBtn = document.getElementById('btn-toggle-print-mode');
        if (printModeBtn) {
            printModeBtn.addEventListener('click', () => {
                document.body.classList.toggle('hide-background');
                const isHidden = document.body.classList.contains('hide-background');

                printModeBtn.style.color = isHidden ? '#60a5fa' : 'white';
                printModeBtn.title = isHidden ? "Background: Hidden (Text Only)" : "Background: Visible";
            });
        }

        // New Prescription (Clear)
        const newBtn = document.getElementById('btn-new');
        if (newBtn) {
            newBtn.addEventListener('click', () => {
                showCustomModal('روشتة جديدة', 'هل تريد بدء روشتة جديدة؟ سيتم مسح النص الحالي وإلغاء اختيار المريض.', () => {
                    this.editor.clearWorkspace();

                    // Remove patientId from URL without reloading
                    const url = new URL(window.location);
                    url.searchParams.delete('patientId');
                    window.history.pushState({}, '', url);

                    // Clear any internal selection state if necessary
                    // (clearWorkspace handles UI, but patientManager might need reset if it caches)
                    // For now, removing URL param is enough to stop re-init on reload.
                }, true);
            });
        }

        // Remove Background Button
        const removeBgBtn = document.getElementById('btn-remove-bg');
        if (removeBgBtn) {
            removeBgBtn.addEventListener('click', () => {
                showCustomModal('حذف الخلفية', 'هل أنت متأكد من حذف صورة الخلفية؟ سيبقى النص كما هو.', () => {
                    this.editor.backgroundLayer.style.backgroundImage = 'none';
                }, true);
            });
        }

        // Print
        const pBtn = document.getElementById('btn-print');
        if (pBtn) pBtn.addEventListener('click', () => this.handlePrint());

        // Lock Document
        const lockBtn = document.getElementById('btn-lock');
        if (lockBtn) {
            // Initial state: Unlocked (Red background)
            lockBtn.classList.add('unlocked-state');
            lockBtn.innerHTML = '<i class="fa-solid fa-lock-open"></i>';

            lockBtn.addEventListener('click', () => {
                const locked = this.editor.toggleLock();
                // Update UI
                lockBtn.innerHTML = locked ? '<i class="fa-solid fa-lock"></i>' : '<i class="fa-solid fa-lock-open"></i>';

                if (locked) {
                    lockBtn.classList.remove('unlocked-state');
                    lockBtn.classList.add('locked-state');
                    lockBtn.title = "Document Frozen (Layout Fixed)";
                } else {
                    lockBtn.classList.remove('locked-state');
                    lockBtn.classList.add('unlocked-state');
                    lockBtn.title = "Document Unfrozen (Editable)";
                }
            });
        }

        // Templates Manager
        this.initTemplateManager();

        // Keyboard Shortcuts (Using ALT to avoid browser conflicts)
        this.setupKeyboardShortcuts();

        // New: Sync/Backup Feature for Online usage
        this.initSyncFeature();

        // New: Protocol Manager
        this.initProtocolManager();

        // Load default template from assets
        this.loadDefaultTemplate();

        // Auto-fill date feature
        this.initHeaderFieldsFeatures();

        // New: Database Management Tools
        this.initDatabaseTools();
        this.loadUserCustomMedicines();
    }

    initHeaderFieldsFeatures() {
        // Auto-fill date on focus if empty
        const dateInput = document.getElementById('patient-date');
        if (dateInput) {
            dateInput.addEventListener('focus', () => {
                if (!dateInput.value) {
                    const today = new Date();
                    const day = String(today.getDate()).padStart(2, '0');
                    const month = String(today.getMonth() + 1).padStart(2, '0');
                    const year = today.getFullYear();
                    dateInput.value = `${day} / ${month} / ${year}`;
                }
            });
        }
    }

    setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            // Using Alt instead of Ctrl to avoid conflict with browser shortcuts (like Ctrl+S, Ctrl+P)
            if (e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 's': // Alt + S
                        e.preventDefault();
                        const saveBtn = document.getElementById('btn-save-template');
                        if (saveBtn) saveBtn.click();
                        break;
                    case 'p': // Alt + P
                        e.preventDefault();
                        this.handlePrint();
                        break;
                    case 'n': // Alt + N
                        e.preventDefault();
                        showCustomModal('روشتة جديدة', 'هل تريد بدء روشتة جديدة؟ سيتم مسح النص الحالي.', () => {
                            this.editor.clearWorkspace();
                        }, true);
                        break;
                    case 'l': // Alt + L (Lock/Unlock)
                        e.preventDefault();
                        const lockBtn = document.getElementById('btn-lock');
                        if (lockBtn) lockBtn.click();
                        break;
                }
            }
        });
    }

    initSyncFeature() {
        const syncBtn = document.getElementById('btn-backup-export');
        const backupModal = document.getElementById('backup-modal');
        const closeBackupBtn = document.getElementById('close-backup-btn');
        const doExportBtn = document.getElementById('btn-do-export');
        const doImportBtn = document.getElementById('btn-do-import');

        if (syncBtn && backupModal) {
            // Open Modal
            syncBtn.addEventListener('click', () => {
                backupModal.classList.remove('hidden');
            });

            // Close Modal
            const closeBackup = () => backupModal.classList.add('hidden');
            if (closeBackupBtn) closeBackupBtn.addEventListener('click', closeBackup);
            backupModal.addEventListener('click', (e) => {
                if (e.target === backupModal) closeBackup();
            });

            // --- EXPORT Logic ---
            if (doExportBtn) {
                doExportBtn.addEventListener('click', async () => {
                    const data = localStorage.getItem('mediscript_templates') || '[]';

                    const now = new Date();
                    const timestamp = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}_${now.getHours()}-${now.getMinutes()}`;
                    const suggestedName = `Prescriptions_Templates_Backup_${timestamp}.json`;

                    // Smart "Save As" Approach
                    if ('showSaveFilePicker' in window) {
                        try {
                            const handle = await window.showSaveFilePicker({
                                suggestedName: suggestedName,
                                types: [{
                                    description: 'JSON Backup',
                                    accept: { 'application/json': ['.json'] }
                                }]
                            });
                            const writable = await handle.createWritable();
                            await writable.write(data);
                            await writable.close();

                            if (typeof window.soundManager !== 'undefined') window.soundManager.playSuccess();
                            closeBackup();
                            return;
                        } catch (err) {
                            if (err.name === 'AbortError') return;
                            console.warn("Save As failed, falling back to legacy:", err);
                        }
                    }

                    // Legacy Fallback
                    const blob = new Blob([data], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);

                    const a = document.createElement('a');
                    a.href = url;
                    a.download = suggestedName;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);

                    closeBackup();
                });
            }

            // --- IMPORT Logic ---
            if (doImportBtn) {
                doImportBtn.addEventListener('click', () => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';

                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (re) => {
                            try {
                                const importedData = JSON.parse(re.target.result);
                                if (Array.isArray(importedData)) {
                                    if (confirm(`تم العثور على ${importedData.length} قالب. هل تريد استبدال القوالب الحالية بها؟`)) {
                                        localStorage.setItem('mediscript_templates', JSON.stringify(importedData));
                                        alert("تمت العملية بنجاح! سيتم إعادة تحميل الصفحة.");
                                        location.reload();
                                    }
                                } else {
                                    alert("الملف غير صالح.");
                                }
                            } catch (err) {
                                console.error(err);
                                alert("خطأ في قراءة الملف.");
                            }
                        };
                        reader.readAsText(file);
                    };
                    input.click();
                    closeBackup();
                });
            }
        }
    }

    initTemplateManager() {
        const modal = document.getElementById('modal-container');
        const saveBtn = document.getElementById('btn-save-template'); // Sidebar Save
        const loadBtn = document.getElementById('btn-load-template'); // Sidebar Load
        const closeBtn = document.getElementById('close-modal-btn');
        const listContainer = document.getElementById('templates-list');

        // Storage Helpers
        const getTemplates = () => JSON.parse(localStorage.getItem('mediscript_templates') || '[]');
        const saveTemplates = (list) => localStorage.setItem('mediscript_templates', JSON.stringify(list));

        // UI Functions
        const toggleModal = (show) => {
            if (show) {
                modal.classList.remove('hidden');
                renderList();
            } else {
                modal.classList.add('hidden');
            }
        };

        const renderList = (filter = "") => {
            let templates = getTemplates();

            if (filter) {
                templates = templates.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()));
            }

            if (templates.length === 0) {
                listContainer.innerHTML = `<p style="color:#aaa; text-align:center;">${filter ? "لا توجد نتائج بحث" : "No templates saved yet."}</p>`;
                return;
            }

            listContainer.innerHTML = templates.map((t, index) => {
                // We need to keep track of the original index for loading/deleting if we filter
                // However, since we re-fetch templates in the click handlers, we should probably 
                // store the unique ID or just re-get current filtered list.
                // Simple way: store the template data in elements or filter by name on action.
                return `
                <div class="template-item">
                    <div class="template-info">
                        <h4>${t.name}</h4>
                        <span>${new Date(t.date).toLocaleDateString()}</span>
                    </div>
                    <div class="template-actions">
                        <button class="modal-btn primary load-btn" data-name="${t.name}">Load</button>
                        <button class="modal-btn" style="background:#ef4444; color:white;" data-del-name="${t.name}"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            `;
            }).join('');

            // Attach listeners to dynamic list items
            listContainer.querySelectorAll('.load-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const allTemplates = getTemplates();
                    const t = allTemplates.find(temp => temp.name === btn.dataset.name);
                    if (t) {
                        showCustomModal('تحميل القالب', `هل تريد تحميل القالب "${t.name}"؟ سيتم استبدال النص الحالي.`, () => {
                            // 1. Restore Dynamic Content
                            this.editor.contentLayer.innerHTML = t.html || '';

                            // 2. Restore Fixed Areas Content
                            if (t.mainContent !== undefined) document.getElementById('main-content-area').innerHTML = t.mainContent;
                            if (t.marginContent !== undefined) document.getElementById('right-margin-area').innerHTML = t.marginContent;

                            // Restore Header Inputs (if saved)
                            if (t.headerData) {
                                if (document.getElementById('patient-name')) document.getElementById('patient-name').innerText = t.headerData.name || '';
                                if (document.getElementById('patient-age')) document.getElementById('patient-age').innerText = t.headerData.age || '';
                            }

                            this.editor.saveToStorage();
                            this.editor.setupEventListeners();
                            toggleModal(false);
                        }, true);
                    }
                });
            });

            listContainer.querySelectorAll('[data-del-name]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const allTemplates = getTemplates();
                    const idx = allTemplates.findIndex(temp => temp.name === btn.dataset.delName);
                    if (idx !== -1) {
                        showCustomModal('حذف القالب', 'هل أنت متأكد من حذف هذا القالب نهائياً؟', () => {
                            allTemplates.splice(idx, 1);
                            saveTemplates(allTemplates);
                            renderList(document.getElementById('template-search').value);
                        }, true);
                    }
                });
            });
        };

        const handleSaveAction = () => {
            showCustomModal('حفظ كقالب', 'أدخل اسماً لهذا القالب (مثال: "علاج نزلات البرد"):', null, true, true, 'اسم القالب...').then(name => {
                if (!name || !name.trim()) return; // Cancelled or empty

                const templates = getTemplates();

                // Gather all content
                const mainContent = document.getElementById('main-content-area').innerHTML;
                const marginContent = document.getElementById('right-margin-area').innerHTML;
                const headerData = {
                    name: document.getElementById('patient-name').innerText,
                    age: document.getElementById('patient-age').innerText,
                    date: document.getElementById('patient-date').innerText
                };

                templates.unshift({
                    name: name.trim(),
                    date: Date.now(),
                    html: this.editor.contentLayer.innerHTML, // Dynamic elements
                    mainContent: mainContent,
                    marginContent: marginContent,
                    headerData: headerData
                });

                saveTemplates(templates);
                showCustomModal('تم الحفظ', "تم حفظ القالب بنجاح!", null, false);
            });
        };

        // Event Listeners
        if (saveBtn) saveBtn.addEventListener('click', handleSaveAction);
        if (loadBtn) loadBtn.addEventListener('click', () => {
            console.log("Load template clicked");
            toggleModal(true);
        });

        if (closeBtn) closeBtn.addEventListener('click', () => toggleModal(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(false);
        });

        // Search Listener
        const searchInput = document.getElementById('template-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                renderList(e.target.value);
            });
        }
    }

    initWorkspaceBackground() {
        const canvas = document.querySelector('.canvas-container');
        const btn = document.getElementById('btn-workspace-bg');

        // Load saved background on startup
        const savedBg = localStorage.getItem('workspace_bg');
        if (savedBg) {
            canvas.style.backgroundImage = `url(${savedBg})`;
            canvas.style.backgroundSize = 'cover';
            canvas.style.backgroundPosition = 'center';
            canvas.style.backgroundRepeat = 'no-repeat';
        }

        if (!btn) return;

        btn.addEventListener('click', () => {
            showCustomModal(
                'خلفية مساحة العمل',
                'هل تريد تغيير خلفية مساحة العمل؟\n\nتأكيد = رفع صورة جديدة\nإلغاء = العودة للنمط الافتراضي',
                () => {
                    // Confirm clicked: Upload new image
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = (re) => {
                                const imageUrl = re.target.result;
                                canvas.style.backgroundImage = `url(${imageUrl})`;
                                canvas.style.backgroundSize = 'cover';
                                canvas.style.backgroundPosition = 'center';
                                canvas.style.backgroundRepeat = 'no-repeat';
                                localStorage.setItem('workspace_bg', imageUrl);
                            };
                            reader.readAsDataURL(file);
                        }
                    };
                    input.click();
                },
                true
            ).then(choice => {
                // If the promise resolved to false (Cancel clicked), reset background
                if (!choice) {
                    canvas.style.backgroundImage = '';
                    localStorage.removeItem('workspace_bg');
                }
            });
        });
    }

    loadDefaultTemplate() {
        const img = new Image();
        img.onload = () => {
            if (this.editor && this.editor.backgroundLayer) {
                this.editor.backgroundLayer.style.backgroundImage = `url('assets/template.jpg')`;
            }
        };
        img.src = 'assets/template.jpg';
    }

    initTools() {
        const getEl = (id) => document.getElementById(id);

        let activeRange = null;
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const container = document.getElementById('prescription-canvas');
                if (container && container.contains(range.commonAncestorContainer)) {
                    activeRange = range.cloneRange();

                    // Sync font size input
                    const parent = range.commonAncestorContainer.parentElement;
                    if (parent) {
                        const computedSize = window.getComputedStyle(parent).fontSize;
                        const sizeInput = getEl('font-size');
                        if (computedSize && sizeInput && document.activeElement !== sizeInput) {
                            sizeInput.value = parseFloat(computedSize);
                        }
                    }
                }
            }
        });

        const restoreSelection = () => {
            if (activeRange) {
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(activeRange);
            }
        };

        const applyFormat = (command, value = null) => {
            restoreSelection(); // Restore active range first

            // First check if there is text selected in a contenteditable area
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                document.execCommand('styleWithCSS', false, true);
                document.execCommand(command, false, value);
                this.editor.saveToStorage(); // Trigger autosave
                return;
            }

            // Fallback: If no text selected, apply to the currently selected object container
            if (this.editor.selectedElement) {
                // Mapping commands to style properties
                if (command === 'foreColor') this.editor.updateStyle('color', value);
                if (command === 'fontName') this.editor.updateStyle('fontFamily', value);
                if (command === 'fontSize') this.editor.updateStyle('fontSize', value + 'px');

                if (command === 'bold') {
                    const current = this.editor.selectedElement.style.fontWeight;
                    this.editor.updateStyle('fontWeight', current === 'bold' ? 'normal' : 'bold');
                }
                if (command === 'italic') {
                    const current = this.editor.selectedElement.style.fontStyle;
                    this.editor.updateStyle('fontStyle', current === 'italic' ? 'normal' : 'italic');
                }
                if (command === 'underline') {
                    const current = this.editor.selectedElement.style.textDecoration;
                    this.editor.updateStyle('textDecoration', current === 'underline' ? 'none' : 'underline');
                }
            }
        };

        getEl('font-family').addEventListener('change', (e) => {
            applyFormat('fontName', e.target.value);
        });

        const updateFontSize = (sizeVal) => {
            restoreSelection(); // Restore active range first

            const size = sizeVal + 'px';
            const selection = window.getSelection();

            // Case 1: Active Text Selection
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                document.execCommand('styleWithCSS', false, true);

                // Hack: Apply huge font then find and replace with specific pixel size
                document.execCommand('fontSize', false, '7');

                // Find element with size 7 (xxx-large)
                const fontElements = document.getElementsByTagName("font");

                let found = false;
                for (let i = 0; i < fontElements.length; i++) {
                    if (fontElements[i].size === "7") {
                        fontElements[i].removeAttribute("size");
                        fontElements[i].style.fontSize = size;
                        found = true;
                    }
                }

                if (!found) {
                    const spans = document.querySelectorAll('span[style*="font-size: xxx-large"], span[style*="font-size: -webkit-xxx-large"]');
                    spans.forEach(span => span.style.fontSize = size);
                }

                this.editor.saveToStorage();
            }
            // Case 2: Whole Element Selected
            else if (this.editor.selectedElement) {
                this.editor.updateStyle('fontSize', size);
            }
        };

        getEl('font-size').addEventListener('input', (e) => {
            updateFontSize(e.target.value);
        });

        // Sync input with selection
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && !selection.isCollapsed) {
                const parent = selection.anchorNode.parentElement;
                if (parent) {
                    const computedSize = window.getComputedStyle(parent).fontSize;
                    if (computedSize) {
                        const sizeNum = parseFloat(computedSize);
                        const input = getEl('font-size');
                        if (input && document.activeElement !== input) {
                            input.value = sizeNum;
                        }
                    }
                }
            }
        });

        getEl('text-color').addEventListener('input', (e) => {
            applyFormat('foreColor', e.target.value);
        });

        getEl('btn-bold').addEventListener('click', (e) => { e.preventDefault(); applyFormat('bold'); });
        getEl('btn-italic').addEventListener('click', (e) => { e.preventDefault(); applyFormat('italic'); });
        getEl('btn-underline').addEventListener('click', (e) => { e.preventDefault(); applyFormat('underline'); });

        // زر تحويل اتجاه اللغة
        const dirBtn = getEl('btn-toggle-direction');
        if (dirBtn) {
            dirBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const targetArea = this.lastFocusedArea || getEl('main-content-area');

                if (targetArea) {
                    targetArea.focus();
                    const isCurrentlyLeft = document.queryCommandState('justifyLeft');

                    if (isCurrentlyLeft) {
                        document.execCommand('justifyRight', false, null);
                        dirBtn.innerHTML = '<i class="fa-solid fa-align-right"></i>';
                    } else {
                        document.execCommand('justifyLeft', false, null);
                        dirBtn.innerHTML = '<i class="fa-solid fa-align-left"></i>';
                    }
                    this.editor.saveToStorage();
                }
            });
        }

        document.addEventListener('elementSelected', (e) => {
            const el = e.detail.element;
            const fSize = window.getComputedStyle(el).fontSize;
            if (getEl('font-size')) getEl('font-size').value = parseInt(fSize);

            const section = document.querySelector('.panel-section');
            if (section) {
                section.innerHTML = `
                    <h3>Properties</h3>
                    <div class="prop-item">
                        <label>Text Content</label>
                        <textarea id="prop-text" style="width:100%; height:80px; font-family:inherit; background:rgba(0,0,0,0.2); color:white; border:1px solid rgba(255,255,255,0.1); border-radius:5px;">${el.innerText}</textarea>
                    </div>
                `;

                document.getElementById('prop-text').addEventListener('input', (ev) => {
                    el.innerText = ev.target.value;
                });
            }
        });

        document.addEventListener('selectionCleared', () => {
            const section = document.querySelector('.panel-section');
            if (section) {
                section.innerHTML = `
                    <p class="placeholder-text">Select an element to edit properties</p>
                `;
            }
        });
    }

    async handlePrint() {
        const metaData = {
            docId: crypto.randomUUID(),
            timestamp: Date.now(),
            clinicId: "CLINIC-001"
        };

        const canvasContainer = document.querySelector('#prescription-canvas');
        const width = canvasContainer.offsetWidth;
        const height = canvasContainer.offsetHeight;

        const wmCanvas = this.watermarker.generateWatermarkCanvas(width, height, metaData);

        const wmLayer = document.getElementById('watermark-layer');
        wmLayer.width = width;
        wmLayer.height = height;
        const ctx = wmLayer.getContext('2d');
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(wmCanvas, 0, 0);
        wmLayer.style.display = 'block';

        window.print();

        // Record visit history if a patient is selected
        const patient = patientManager.getSelectedPatient();
        if (patient) {
            // Extract medicines from main-content-area
            const mainArea = document.getElementById('main-content-area');
            const lines = Array.from(mainArea.querySelectorAll('div, p, li'))
                .map(el => el.textContent.trim())
                .filter(txt => txt.length > 0);

            // Fallback to textContent if no divs/markup
            const medicines = lines.length > 0 ? lines : [mainArea.textContent.trim()].filter(t => t);

            patientManager.addVisit(patient.id, {
                medicines: medicines,
                notes: "روشتة مطبوعة"
            });
            console.log("Visit recorded for patient:", patient.name);
        }
    }
    initDatabaseManager() {
        const modal = document.getElementById('database-modal');
        const closeBtn = document.getElementById('close-database-btn');
        const tabs = modal.querySelectorAll('.tab-btn');
        const tabContents = modal.querySelectorAll('.tab-content');

        // Tab Switching
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const target = tab.dataset.tab;
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.add('hidden'));

                tab.classList.add('active');
                document.getElementById(target).classList.remove('hidden');

                if (target === 'tab-manage-list') this.renderDatabaseList();
            });
        });

        // Close logic
        const closeModal = () => modal.classList.add('hidden');
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        // Bulk Process
        const processBtn = document.getElementById('btn-process-bulk');
        const bulkInput = document.getElementById('bulk-medicine-input');
        const countStatus = document.getElementById('bulk-count-status');

        if (bulkInput && countStatus) {
            bulkInput.addEventListener('input', () => {
                const lines = bulkInput.value.split('\n').filter(l => l.trim().length > 0);
                countStatus.innerText = `${lines.length} دواء مكتشف`;
            });
        }

        if (processBtn && bulkInput) {
            processBtn.addEventListener('click', () => {
                const lines = bulkInput.value.split('\n')
                    .map(l => l.trim())
                    .filter(l => l.length > 0);

                if (lines.length === 0) {
                    showCustomModal('تنبيه', "فضلاً قم بكتابة أو لصق بضعة أسماء أولاً.", null, false);
                    return;
                }

                let addedCount = 0;
                let existsCount = 0;
                const meds = (typeof MEDICINE_DB !== 'undefined') ? MEDICINE_DB : [];
                const custom = JSON.parse(localStorage.getItem('custom_medicines') || '[]');

                lines.forEach(name => {
                    if (!meds.includes(name)) {
                        meds.push(name);
                        if (!custom.includes(name)) custom.push(name);
                        addedCount++;
                    } else {
                        existsCount++;
                    }
                });

                localStorage.setItem('custom_medicines', JSON.stringify(custom));
                showCustomModal('اكتملت العملية', `تم إضافة: ${addedCount} دواء جديد.\nالأدوية المتكررة: ${existsCount}.`, null, false);

                bulkInput.value = '';
                countStatus.innerText = '0 دواء مكتشف';

                // Switch to manage list to see result
                modal.querySelector('[data-tab="tab-manage-list"]').click();
            });
        }

        // Search logic
        const dbSearch = document.getElementById('db-search');
        if (dbSearch) {
            dbSearch.addEventListener('input', (e) => this.renderDatabaseList(e.target.value));
        }

        // Copy for Assistant Logic
        const copyBtn = document.getElementById('btn-copy-for-assistant');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const meds = (typeof MEDICINE_DB !== 'undefined') ? MEDICINE_DB : [];
                const userMeds = (typeof USER_MEDICINES !== 'undefined') ? USER_MEDICINES : [];
                const fullList = Array.from(new Set([...meds, ...userMeds])).sort();

                const text = "UPDATE_MEDICINE_LIST\n" + JSON.stringify(fullList);

                navigator.clipboard.writeText(text).then(() => {
                    showCustomModal('تم النسخ', "تم نسخ القائمة الجديدة بنجاح!\n\nكل ما عليك هو لصقها (Paste) في المحادثة مع المساعد وقول له 'حدث الملف'، وهو سيتولى المهمة.", null, false);
                }).catch(err => {
                    showCustomModal('فشل النسخ', "فشل النسخ التلقائي، يرجى المحاولة مرة أخرى.", null, false);
                });
            });
        }
    }

    renderDatabaseList(filter = "") {
        const listContainer = document.getElementById('db-medicine-list');
        const countDisplay = document.getElementById('db-total-count');
        if (!listContainer) return;

        const meds = (typeof MEDICINE_DB !== 'undefined') ? MEDICINE_DB : [];
        const userMeds = (typeof USER_MEDICINES !== 'undefined') ? USER_MEDICINES : [];
        let all = Array.from(new Set([...meds, ...userMeds])).sort();

        if (filter) {
            all = all.filter(m => m.toLowerCase().includes(filter.toLowerCase()));
        }

        countDisplay.innerText = `الإجمالي: ${all.length} دواء`;

        if (all.length === 0) {
            listContainer.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:#64748b; padding:20px;">لا توجد أدوية مطابقة للبحث.</p>';
            return;
        }

        // Show only first 500 for performance, or use virtualization
        const displayList = all.slice(0, 500);
        listContainer.innerHTML = displayList.map(m => `
            <div class="db-item-pill" style="background: rgba(255,255,255,0.05); padding: 5px 10px; border-radius: 4px; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid rgba(255,255,255,0.03);">
                <span title="${m}" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${m}</span>
            </div>
        `).join('');

        if (all.length > 500) {
            listContainer.innerHTML += `<p style="grid-column: 1/-1; text-align:center; color:#f59e0b; font-size: 0.75rem; padding: 10px;">تم عرض أول 500 عنصر فقط. استخدم البحث للوصول للبقية.</p>`;
        }
    }

    initProtocolManager() {
        const protocols = (typeof PROTOCOLS_DB !== 'undefined') ? PROTOCOLS_DB : [];
        const btn = document.getElementById('btn-protocols');
        const modal = document.getElementById('protocols-modal');
        const closeBtn = document.getElementById('close-protocols-btn');
        const listContainer = document.getElementById('protocols-list');

        if (!btn || !modal) return;

        const toggleModal = (show) => {
            if (show) {
                modal.classList.remove('hidden');
                renderList();
            } else {
                modal.classList.add('hidden');
            }
        };

        const renderList = () => {
            if (!protocols || protocols.length === 0) {
                listContainer.innerHTML = '<p class="empty-msg">No protocols available.</p>';
                return;
            }

            listContainer.innerHTML = protocols.map(p => `
                <div class="template-item">
                    <div class="template-info">
                        <h4>${p.name}</h4>
                        <span style="font-size:0.8rem; color:#64748b;">${p.description}</span>
                    </div>
                    <div class="template-actions">
                        <button class="modal-btn primary apply-protocol-btn" data-name="${p.name}">Apply Set</button>
                    </div>
                </div>
            `).join('');

            listContainer.querySelectorAll('.apply-protocol-btn').forEach(b => {
                b.addEventListener('click', () => {
                    const p = protocols.find(pro => pro.name === b.dataset.name);
                    if (p) {
                        showCustomModal('تطبيق البروتوكول', `هل تريد إضافة بروتوكول "${p.name}" إلى الروشتة؟`, () => {
                            const mainArea = document.getElementById('main-content-area');
                            if (!mainArea.innerHTML.trim()) {
                                mainArea.innerHTML = p.content;
                            } else {
                                mainArea.innerHTML += "<div><br></div>" + p.content;
                            }
                            toggleModal(false);
                            this.editor.saveToStorage();
                        }, true);
                    }
                });
            });
        };

        btn.addEventListener('click', () => toggleModal(true));
        if (closeBtn) closeBtn.addEventListener('click', () => toggleModal(false));
        modal.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(false);
        });
    }
}


// Initialize Global App
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();

    // Restore saved theme
    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) {
        document.body.classList.remove('theme-blue', 'theme-gray', 'theme-red', 'theme-brown', 'theme-gold', 'theme-light');
        document.body.classList.add(savedTheme);

        // Highlight the active theme button
        document.querySelectorAll('.theme-btn').forEach(btn => {
            if (btn.dataset.theme === savedTheme) {
                btn.style.borderColor = 'white';
            } else {
                btn.style.borderColor = 'transparent';
            }
        });
    }

    // Auto-fill Date
    const dateField = document.getElementById('patient-date');
    if (dateField) {
        const today = new Date();
        const yyyy = today.getFullYear();
        let mm = today.getMonth() + 1;
        let dd = today.getDate();

        if (dd < 10) dd = '0' + dd;
        if (mm < 10) mm = '0' + mm;

        dateField.innerText = dd + ' / ' + mm + ' / ' + yyyy;
    }

    // Refresh Button Logic
    const refreshBtn = document.getElementById('btn-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            showCustomModal('إعادة تحميل', "هل تريد إعادة تحميل الصفحة؟ تأكد من حفظ القالب أولاً.", () => {
                location.reload();
            }, true);
        });
    }

    // ===========================
    //  Drug Interaction Checker
    // ===========================
    const initDrugInteractionChecker = () => {
        const mainArea = document.getElementById('main-content-area');
        const marginArea = document.getElementById('right-margin-area');

        if (!mainArea || !window.drugInteractionChecker) return;

        let checkTimeout = null;

        const checkPrescription = () => {
            const prescriptionText = mainArea.textContent || mainArea.innerText;

            // Get patient allergies if available
            const patient = patientManager.getSelectedPatient();
            const allergies = patient?.allergies || '';

            // Check drug interactions
            const interactions = window.drugInteractionChecker.checkDrugInteractions(prescriptionText);

            // Check allergies
            const allergyWarnings = allergies ?
                window.drugInteractionChecker.checkPatientAllergies(prescriptionText, allergies) : [];

            // Display warnings if any
            if (interactions.length > 0 || allergyWarnings.length > 0) {
                showDrugWarnings(interactions, allergyWarnings);
            }
        };

        const showDrugWarnings = (interactions, allergyWarnings) => {
            let warningHTML = '<div style="text-align: right; direction: rtl;">';

            // Critical allergies first
            if (allergyWarnings.length > 0) {
                warningHTML += '<div style="background: rgba(239, 68, 68, 0.2); border: 2px solid #ef4444; padding: 15px; border-radius: 12px; margin-bottom: 15px;">';
                warningHTML += '<h3 style="color: #ef4444; margin-bottom: 10px;"><i class="fa-solid fa-triangle-exclamation"></i> تحذير: حساسية المريض</h3>';
                allergyWarnings.forEach(w => {
                    warningHTML += `<p style="margin: 8px 0; font-size: 1.05rem;"><strong>${w.drug}</strong> → المريض لديه حساسية من <strong>${w.allergy}</strong></p>`;
                });
                warningHTML += '</div>';
            }

            // Drug interactions
            if (interactions.length > 0) {
                const highSeverity = interactions.filter(i => i.severity === 'high');
                const mediumSeverity = interactions.filter(i => i.severity === 'medium');

                if (highSeverity.length > 0) {
                    warningHTML += '<div style="background: rgba(239, 68, 68, 0.15); border: 2px solid #f59e0b; padding: 15px; border-radius: 12px; margin-bottom: 15px;">';
                    warningHTML += '<h3 style="color: #f59e0b; margin-bottom: 10px;"><i class="fa-solid fa-skull-crossbones"></i> تداخل دوائي خطر</h3>';
                    highSeverity.forEach(i => {
                        warningHTML += `<p style="margin: 8px 0; font-size: 1rem;"><strong>${i.drug1}</strong> + <strong>${i.drug2}</strong><br><span style="color: #fbbf24;">${i.warning}</span></p>`;
                    });
                    warningHTML += '</div>';
                }

                if (mediumSeverity.length > 0) {
                    warningHTML += '<div style="background: rgba(245, 158, 11, 0.1); border: 2px solid rgba(245, 158, 11, 0.5); padding: 15px; border-radius: 12px;">';
                    warningHTML += '<h3 style="color: #f59e0b; margin-bottom: 10px;"><i class="fa-solid fa-exclamation-triangle"></i> تحذير متوسط</h3>';
                    mediumSeverity.forEach(i => {
                        warningHTML += `<p style="margin: 8px 0; font-size: 0.95rem;"><strong>${i.drug1}</strong> + <strong>${i.drug2}</strong><br><span style="color: #fcd34d;">${i.warning}</span></p>`;
                    });
                    warningHTML += '</div>';
                }
            }

            warningHTML += '</div>';

            // Show modal with warnings
            const severity = allergyWarnings.length > 0 || interactions.some(i => i.severity === 'high') ? 'critical' : 'warning';

            showCustomModal(
                severity === 'critical' ? '⚠️ تحذير حرج' : '⚡ تنبيه دوائي',
                warningHTML,
                null,
                false
            );

            // Play error sound for critical warnings
            if (severity === 'critical') {
                // Sound effect (if sound manager exists)
                if (window.soundManager && window.soundManager.playError) {
                    window.soundManager.playError();
                }
            }
        };

        // Monitor changes
        const setupMonitoring = () => {
            if (mainArea) {
                mainArea.addEventListener('input', () => {
                    clearTimeout(checkTimeout);
                    checkTimeout = setTimeout(checkPrescription, 2000); // Check 2s after typing stops
                });

                // Also check on paste
                mainArea.addEventListener('paste', () => {
                    setTimeout(checkPrescription, 500);
                });
            }
        };

        setupMonitoring();
        console.log('Drug Interaction Checker initialized');
    };

    // Initialize drug checker
    if (typeof window.drugInteractionChecker !== 'undefined') {
        initDrugInteractionChecker();
    }

    console.log("App Initialized");
});

/* =========================================
   F1 Help Center Integration
   ========================================= */
document.addEventListener('keydown', function (e) {
    // F1 key opens Help Center
    if (e.key === 'F1') {
        e.preventDefault(); // Prevent browser's default F1 behavior
        window.open('help-center.html', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');
    }
});

