## Analog Clock Style
**Description:** A complex, chronograph-style analog clock face with glowing hands and tick marks. Note: This style requires JS to move the hands.

### CSS Code:
```css
/* Analog Clock Core Styles */
.neuro-clock-container {
    position: relative;
    width: 220px;
    height: 220px;
    background: radial-gradient(circle, #1e293b 0%, #07090f 100%);
    border: 6px solid #1e293b; /* Outer Rim */
    border-radius: 50%; /* Circle */
    box-shadow: 
        0 0 40px rgba(0, 0, 0, 0.8), 
        inset 0 0 30px rgba(0, 234, 255, 0.1), 
        0 0 0 2px rgba(0, 234, 255, 0.2);
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 25px;
    overflow: hidden;
}

.neuro-clock-face {
    position: relative;
    width: 100%;
    height: 100%;
    /* Subtle radial lines */
    background: repeating-conic-gradient(from 0deg, rgba(0, 234, 255, 0.05) 0deg 1deg, transparent 1deg 30deg);
    border-radius: 50%;
}

.clock-hand {
    position: absolute;
    bottom: 50%;
    left: 50%;
    transform-origin: bottom;
    border-radius: 4px;
    z-index: 5;
    transition: transform 0.1s cubic-bezier(0.4, 2.08, 0.55, 0.44); /* Elastic movement */
}

.hour-hand {
    width: 8px;
    height: 60px;
    background: #fff;
    box-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
}

.minute-hand {
    width: 5px;
    height: 85px;
    background: #00eaff; /* Cyan */
    box-shadow: 0 0 20px rgba(0, 234, 255, 0.4);
}

.second-hand {
    width: 2px;
    height: 95px;
    background: #ff3e3e; /* Red Detail */
    box-shadow: 0 0 10px rgba(255, 62, 62, 0.5);
    z-index: 10;
}

.clock-center {
    position: absolute;
    width: 18px;
    height: 18px;
    background: #020617;
    border-radius: 50%;
    border: 3px solid #00eaff;
    box-shadow: 0 0 15px #00eaff;
    z-index: 20;
    top: 50%; left: 50%; transform: translate(-50%, -50%);
}
```

### HTML Usage:
```html
<div class="neuro-clock-container">
    <div class="neuro-clock-face">
        <div class="clock-hand hour-hand"></div>
        <div class="clock-hand minute-hand"></div>
        <div class="clock-hand second-hand"></div>
        <div class="clock-center"></div>
        <!-- Add tick marks <div class="clock-mark m1">...</div> etc. -->
    </div>
</div>
```

### AI Prompt (Copy & Paste):
"Create a `.neuro-clock-container` (220x220px circle) with a dark radial gradient background (#1e293b to #07090f) and a thick 6px border. Inside, create a `.neuro-clock-face` with subtle repeating conic-gradient lines. Add three hands (`.hour-hand`, `.minute-hand`, `.second-hand`) positioned via `transform-origin: bottom`. The hour hand should be white/bold, minute hand cyan/long, and second hand red/thin. Add a glowing center dot."
