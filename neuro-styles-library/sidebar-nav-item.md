## Neuro Sidebar Nav Item Style
**Description:** A navigation item for sidebar menus, featuring a transparent initial state that glows and scales on hover, with a distinctive cyan active state.

### CSS Code:
```css
/* Sidebar Nav Item Core Styles */
.nav-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    padding: 10px 5px;
    border-radius: 12px;
    color: #94a3b8; /* Slate */
    text-decoration: none;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    cursor: pointer;
    font-weight: 600;
    font-size: 0.75rem;
    text-align: center;
    font-family: 'Tajawal', sans-serif;
}

.nav-item i {
    font-size: 1.6rem;
    color: #94a3b8;
    transition: all 0.3s;
    margin-bottom: 2px;
}

.nav-item:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    transform: translateY(-2px);
}

.nav-item.active {
    background: rgba(0, 234, 255, 0.1);
    color: #fff;
    border: 1px solid rgba(0, 234, 255, 0.3);
    box-shadow: 0 0 15px rgba(0, 234, 255, 0.15) inset;
}

.nav-item.active i {
    color: #00eaff;
    filter: drop-shadow(0 0 12px #00eaff);
}
```

### HTML Usage:
```html
<a href="#" class="nav-item active">
    <i class="fas fa-home"></i>
    <span>Dashboard</span>
</a>
```

### AI Prompt (Copy & Paste):
"Create a sidebar `nav-item` component that has a transparent background by default, with slate-grey text (#94a3b8). On hover, it should have a subtle white background (rgba(255,255,255,0.05)) and lift slightly. When active (`.active`), background should be a faint cyan (rgba(0, 234, 255, 0.1)) with a cyan border and inner shadow. The active icon should be fully cyan (#00eaff) and have a drop-shadow glow."
