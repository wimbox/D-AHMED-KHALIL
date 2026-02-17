## Pulse Danger Button Style
**Description:** A high-alert red button that pulses continuously, ideal for destructive actions like 'Delete' or 'Reset'.

### CSS Code:
```css
/* Pulse Danger Button Core Styles */
.btn-pulse-danger {
    background: #ef4444 !important; /* Bright Red */
    color: #fff !important;
    border: none !important;
    padding: 8px 20px !important;
    border-radius: 8px !important;
    font-weight: 800 !important;
    cursor: pointer !important;
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.6) !important;
    transition: 0.3s !important;
    font-family: 'Tajawal', sans-serif;
    animation: danger-throbbing 2s infinite ease-in-out;
}

.btn-pulse-danger:hover {
    transform: scale(1.05);
    background: #dc2626 !important; /* Darker Red */
    box-shadow: 0 0 25px rgba(239, 68, 68, 0.8) !important;
}

@keyframes danger-throbbing {
    0% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
    }
    70% {
        box-shadow: 0 0 0 10px rgba(239, 68, 68, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
    }
}
```

### HTML Usage:
```html
<button class="btn-pulse-danger">
    <i class="fas fa-trash"></i> Delete
</button>
```

### AI Prompt (Copy & Paste):
"Create a danger button component `.btn-pulse-danger` with a bright red background (#ef4444), white text, and no border. It must have a strong box-shadow in red. On hover, it should scale up slightly (1.05) and darken slightly. Add a CSS keyframe animation called `danger-throbbing` that creates a pulsating red outline effect (using box-shadow spread) to indicate urgency."
