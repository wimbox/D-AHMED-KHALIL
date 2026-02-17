## Neuro Doctor Brand Badge Style
**Description:** A prominent, glowing badge for the main brand/doctor's name, featuring a pill-shape and flickering text shadow.

### CSS Code:
```css
/* Doctor Brand Badge Core Styles */
.doctor-brand-badge {
    background: #0f172a;
    border: 2px solid #00eaff;
    padding: 8px 25px;
    border-radius: 50px; /* Pill Shape */
    color: #fff;
    font-weight: 800;
    font-size: 1.2rem;
    text-shadow: 0 0 10px #00eaff, 0 0 20px #00eaff;
    box-shadow: 0 0 15px rgba(0, 234, 255, 0.3);
    animation: laser-flicker 0.2s infinite alternate;
    font-family: 'Tajawal', sans-serif;
    display: flex;
    align-items: center;
    gap: 10px;
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
<div class="doctor-brand-badge">
    <i class="fas fa-user-md"></i> Dr. Ahmed Khalil
</div>
```

### AI Prompt (Copy & Paste):
"Create a component called `doctor-brand-badge` that is a pill-shaped container (border-radius: 50px) with a dark navy background (#0f172a) and a solid 2px cyan border (#00eaff). The text should be bold, white, and have a `text-shadow` of 0 0 10px cyan. Apply a `laser-flicker` animation that slightly pulsates the box-shadow opacity to give it a techy, glowing effect."
