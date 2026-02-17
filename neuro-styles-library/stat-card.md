## Neuro Stat Card Style
**Description:** A glassmorphic card for displaying statistics, featuring a blurred background, glowing cyan border on hover, and a futuristic icon container.

### CSS Code:
```css
/* Neuro Stat Card Core Styles */
.stat-card {
    background: rgba(30, 41, 59, 0.5); /* Glass Background */
    border: 1px solid rgba(0, 234, 255, 0.15); /* Slight cyan tint */
    border-radius: 24px;
    padding: 25px;
    backdrop-filter: blur(20px);
    display: flex;
    align-items: center;
    gap: 20px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.stat-card:hover {
    transform: translateY(-8px);
    border-color: #00eaff;
    box-shadow: 0 15px 40px rgba(0, 234, 255, 0.1);
}

.stat-icon {
    width: 60px;
    height: 60px;
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.8rem;
    background: #0f172a;
    border: 1px solid rgba(255, 255, 255, 0.05);
    color: #00eaff;
    box-shadow: 0 0 15px rgba(0, 234, 255, 0.1);
}

.stat-info h3 {
    font-size: 2rem;
    font-weight: 800;
    color: #fff;
    margin-bottom: 5px;
}

.stat-info p {
    color: #94a3b8;
    font-weight: 600;
    font-size: 0.9rem;
}
```

### HTML Usage:
```html
<div class="stat-card">
    <div class="stat-icon">
        <i class="fas fa-users"></i>
    </div>
    <div class="stat-info">
        <h3>120</h3>
        <p>Total Patients</p>
    </div>
</div>
```

### AI Prompt (Copy & Paste):
"Create a `stat-card` component with a semi-transparent dark slate background (rgba(30, 41, 59, 0.5)) and backdrop-filter blur. It should have a subtle cyan border (rgba(0, 234, 255, 0.15)) that becomes vibrant cyan on hover. Include a `stat-icon` container (60x60px) with a dark navy background (#0f172a) and a cyan icon. The main number should be large (2rem), bold, and white, while the label should be smaller and slate-grey."
