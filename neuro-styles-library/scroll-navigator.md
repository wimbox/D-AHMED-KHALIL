## Scroll Navigator Style
**Description:** Floating, blurred navigation buttons attached to the viewport bottom for quick vertical scrolling.

### CSS Code:
```css
/* Scroll Navigator Core Styles */
.scroll-navigator {
    position: fixed;
    left: 30px; /* Or Right depending on UI */
    bottom: 30px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 9999;
}

.scroll-nav-btn {
    width: 50px;
    height: 50px;
    background: rgba(15, 23, 42, 0.7); /* Deep Glass */
    backdrop-filter: blur(12px);
    border: 2px solid rgba(0, 234, 255, 0.3); /* Subtle Cyan */
    border-radius: 15px;
    color: #00eaff; /* Cyan */
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 1.2rem;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    transition: all 0.3s ease;
    opacity: 0.6;
}

.scroll-nav-btn:hover {
    opacity: 1;
    transform: translateY(-5px);
    border-color: #00eaff;
    background: rgba(0, 234, 255, 0.1);
    box-shadow: 0 0 20px rgba(0, 234, 255, 0.4);
}
```

### HTML Usage:
```html
<div class="scroll-navigator">
    <button class="scroll-nav-btn" title="Scroll Top">
        <i class="fas fa-chevron-up"></i>
    </button>
    <button class="scroll-nav-btn" title="Scroll Bottom">
        <i class="fas fa-chevron-down"></i>
    </button>
</div>
```

### AI Prompt (Copy & Paste):
"Create a `.scroll-navigator` fixed to the bottom-left (or right) of the viewport. Inside, create button components `.scroll-nav-btn` that are 50x50px squares with 15px rounded corners. They should have a deep glass background (rgba(15, 23, 42, 0.7)), blur-12px, and a subtle cyan border (rgba(0, 234, 255, 0.3)). On hover, they should become fully opaque, lift up by 5px, and glow with a stronger cyan border and background tint."
