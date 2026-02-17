## Neuro Button Style
**Description:** A futuristic, glowing action button with a laser flicker animation. Ideal for primary CTAs in sci-fi or medical tech interfaces.

### CSS Code:
```css
/* Neuro Button Core Styles */
.btn-neuro {
    background: #0f172a;
    color: #fff;
    border: 2px solid #00eaff;
    padding: 12px 25px;
    border-radius: 14px;
    cursor: pointer;
    font-weight: 800;
    display: flex;
    align-items: center;
    gap: 12px;
    transition: all 0.3s;
    text-shadow: 0 0 10px #00eaff;
    box-shadow: 0 0 15px rgba(0, 234, 255, 0.2);
    animation: laser-flicker 0.2s infinite alternate;
    font-family: 'Tajawal', sans-serif;
}

.btn-neuro:hover {
    background: #00eaff;
    color: #000;
    text-shadow: none;
    box-shadow: 0 0 35px #00eaff;
    transform: translateY(-3px);
}

@keyframes laser-flicker {
    0% {
        opacity: 0.9;
        box-shadow: 0 0 10px rgba(0, 234, 255, 0.2);
    }
    100% {
        opacity: 1;
        box-shadow: 0 0 25px rgba(0, 234, 255, 0.5);
    }
}
```

### HTML Usage:
```html
<button class="btn-neuro">
    <i class="fas fa-rocket"></i> Launch Action
</button>
```

### AI Prompt (Copy & Paste):
"Create a button component with the class `btn-neuro`. It should have a dark navy background (#0f172a), white text, and a 2px solid cyan border (#00eaff). The button must have a glowing text shadow and box and box shadow in cyan. On hover, the background should turn cyan and the text black. Add a subtle 'laser-flicker' animation that varies opacity and shadow intensity slightly."
