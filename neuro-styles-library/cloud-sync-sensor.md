## Cloud Sync Sensor Style
**Description:** A status indicator that shows network or sync health, featuring a dot that changes color and animates based on connection quality.

### CSS Code:
```css
/* Cloud Sync Sensor Core Styles */
.sync-sensor {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(15, 23, 42, 0.6); /* Glassy Navy */
    padding: 6px 15px;
    border-radius: 50px; /* Pill Shape */
    border: 1px solid rgba(0, 234, 255, 0.15); /* Slight Cyan */
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    font-family: 'Tajawal', sans-serif;
}

.sync-status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #64748b; /* Grey (Offline) */
    box-shadow: 0 0 5px #64748b;
    transition: all 0.3s;
}

/* Online State */
.sync-sensor.online .sync-status-dot {
    background: #10b981; /* Green */
    box-shadow: 0 0 10px #10b981;
}

/* Syncing State */
.sync-sensor.syncing .sync-status-dot {
    background: #f59e0b; /* Amber */
    box-shadow: 0 0 10px #f59e0b;
    animation: pulse-sync 1s infinite alternate;
}

/* Error State */
.sync-sensor.error .sync-status-dot {
    background: #ef4444; /* Red */
    box-shadow: 0 0 10px #ef4444;
}

.sync-label {
    font-size: 0.7rem;
    font-weight: 700;
    color: #94a3b8; /* Slate */
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.sync-latency {
    font-size: 0.85rem;
    font-weight: 800;
    color: #00eaff; /* Cyan */
    font-family: monospace;
}

@keyframes pulse-sync {
    from {
        opacity: 0.4;
        transform: scale(0.8);
    }
    to {
        opacity: 1;
        transform: scale(1.1);
    }
}
```

### HTML Usage:
```html
<div class="sync-sensor online">
    <div class="sync-status-dot"></div>
    <div class="sync-info">
        <div class="sync-label">Latency</div>
        <div class="sync-latency">24ms</div>
    </div>
</div>
```

### AI Prompt (Copy & Paste):
"Create a component called `.sync-sensor` as a glassmorphic pill (rgba(15, 23, 42, 0.6), rounded-full, blur-10px) containing a `sync-status-dot`. The dot should be 10px round. Define states for `.online` (green glow: #10b981), `.syncing` (amber pulse: #f59e0b), and `.error` (red glow: #ef4444). Inside, use a small slate label (uppercase) and a cyan monospace text for ping/latency."
