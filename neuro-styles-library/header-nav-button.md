## Header Nav Button Style
**Description:** Subtle, semi-transparent buttons for the top navigation bar, featuring specialized accent colors based on context (e.g., Finance, Editor).

### CSS Code:
```css
/* Header Nav Button Core Styles */
.header-nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 20px;
    height: 48px; /* Slightly Taller */
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.08); /* Frosted White */
    color: #94a3b8; /* Slate */
    text-decoration: none;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.3s ease;
    border: 1px solid rgba(255, 255, 255, 0.05); /* Barely Visible */
    font-family: 'Tajawal', sans-serif;
}

.header-nav-btn:hover {
    background: rgba(255, 255, 255, 0.15);
    color: #fff;
    transform: translateY(-2px);
    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    border-color: rgba(255, 255, 255, 0.2);
}

/* Contextual Variant: Finance (Cyan) */
.header-nav-btn.finance-variant {
    background: rgba(0, 234, 255, 0.1);
    color: #00eaff;
    border-color: rgba(0, 234, 255, 0.3);
}

.header-nav-btn.finance-variant:hover {
    color: #000;
    background: #00eaff;
    border-color: #00eaff;
    box-shadow: 0 0 20px #00eaff;
}
```

### HTML Usage:
```html
<a href="#" class="header-nav-btn">
    <i class="fas fa-cog"></i> Settings
</a>

<a href="#" class="header-nav-btn finance-variant">
    <i class="fas fa-coins"></i> Finance
</a>
```

### AI Prompt (Copy & Paste):
"Create a `.header-nav-btn` component that is 48px high with a frosted, semi-transparent white background (rgba(255, 255, 255, 0.08)) and slate grey text. It should have a 1px subtle white border and rounded corners (12px). On hover, increase background opacity and lift the button (-2px). Create a `.finance-variant` that starts with a cyan tint and border, and on hover becomes solid cyan (#00eaff) with black text and a glowing box-shadow."
