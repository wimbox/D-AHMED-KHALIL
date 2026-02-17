## Neuro Modal Dialog Style
**Description:** A dramatic, dark modal with a heavy glow and smooth slide animation, perfect for critical alerts and confirmations.

### CSS Code:
```css
/* Neuro Modal Core Styles */
.neuro-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.85); /* Deep Dark Overlay */
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

.neuro-modal-content {
    background: #0f172a; /* Deep Navy */
    border: 2px solid #00eaff; /* Cyan */
    border-radius: 28px;
    padding: 40px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 0 50px rgba(0, 234, 255, 0.2); /* Heavy Glow */
    text-align: center;
    animation: modalSlide 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    font-family: 'Tajawal', sans-serif;
}

.neuro-modal-title {
    font-size: 1.8rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 20px;
    text-shadow: 0 0 10px rgba(0, 234, 255, 0.4);
}

.neuro-modal-msg {
    font-size: 1.1rem;
    color: #94a3b8; /* Slate */
    margin-bottom: 35px;
    line-height: 1.6;
}

@keyframes modalSlide {
    from {
        transform: translateY(30px);
        opacity: 0;
    }
    to {
        transform: translateY(0);
        opacity: 1;
    }
}
```

### HTML Usage:
```html
<div class="neuro-modal-overlay">
    <div class="neuro-modal-content">
        <h2 class="neuro-modal-title">Confirm Action</h2>
        <p class="neuro-modal-msg">Are you sure you want to delete this record?</p>
        <div class="neuro-modal-actions">
           <!-- Buttons Go Here -->
        </div>
    </div>
</div>
```

### AI Prompt (Copy & Paste):
"Create a modal component (`neuro-modal-content`) centered in a dark, blurred overlay. The modal should have a dark navy background (#0f172a), a 2px solid cyan border (#00eaff), and a heavy cyan outer glow (box-shadow: 0 0 50px). Use a slide-up animation (`modalSlide`). The title should be large (1.8rem) and white with a subtle text shadow."
