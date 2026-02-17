## Neuro Search Bar Style
**Description:** A clean, dark search input with a transparent background that illuminates with a cyan border and glow when focused.

### CSS Code:
```css
/* Neuro Search Bar Core Styles */
.search-bar {
    background: #0f172a; /* Dark Navy */
    border: 1px solid rgba(255, 255, 255, 0.05); /* Very subtle white border */
    border-radius: 12px;
    padding: 10px 18px;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 350px;
    transition: all 0.3s;
}

.search-bar:focus-within {
    border-color: #00eaff; /* Cyan */
    box-shadow: 0 0 15px rgba(0, 234, 255, 0.1);
}

.search-bar i {
    color: #00eaff;
}

.search-bar input {
    background: transparent;
    border: none;
    color: white; /* Important */
    outline: none;
    width: 100%;
    font-size: 0.95rem;
    font-family: 'Tajawal', sans-serif;
}
```

### HTML Usage:
```html
<div class="search-bar">
    <i class="fas fa-search"></i>
    <input type="text" placeholder="Search patients...">
</div>
```

### AI Prompt (Copy & Paste):
"Create a `search-bar` container with a dark navy background (#0f172a) and a very subtle white border. Inside put an icon (color #00eaff) and a transparent input with white text. When the user focuses on the input (use `:focus-within`), the container should get a cyan border (#00eaff) and a soft box-shadow in cyan."
