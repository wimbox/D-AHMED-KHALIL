## Neuro Table Style
**Description:** A futuristic, spaced table layout where each row is a separate card, with transparent backgrounds and hover highlights in cyan.

### CSS Code:
```css
/* Neuro Table Core Styles */
.neuro-table {
    width: 100%;
    border-collapse: separate; /* Required for border-radius */
    border-spacing: 0 10px; /* Space between rows */
    font-family: 'Tajawal', sans-serif;
}

.neuro-table th {
    text-align: right;
    color: #94a3b8; /* Slate */
    padding: 15px 20px;
    font-weight: 600;
    font-size: 0.95rem;
    border: none;
}

.neuro-table tr {
    transition: all 0.3s;
}

.neuro-table td {
    padding: 20px;
    background: rgba(15, 23, 42, 0.4); /* Glassy Navy */
    border-top: 1px solid rgba(255, 255, 255, 0.02);
    border-bottom: 1px solid rgba(255, 255, 255, 0.02);
    color: #f3f4f6; /* Off-White */
}

/* Rounded Edges for Rows */
.neuro-table td:first-child {
    border-radius: 0 15px 15px 0; /* RTL Support */
    border-right: 1px solid rgba(255, 255, 255, 0.02);
}

.neuro-table td:last-child {
    border-radius: 15px 0 0 15px; /* RTL Support */
    border-left: 1px solid rgba(255, 255, 255, 0.02);
}

/* Hover Effect */
.neuro-table tr:hover td {
    background: rgba(0, 234, 255, 0.05); /* Very faint Cyan */
    border-color: rgba(0, 234, 255, 0.1);
}
```

### HTML Usage:
```html
<table class="neuro-table">
    <thead>
        <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Amount</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>John Doe</td>
            <td>Active</td>
            <td>$500</td>
        </tr>
    </tbody>
</table>
```

### AI Prompt (Copy & Paste):
"Create a `neuro-table` component where rows are visually separated by 10px (`border-spacing: 0 10px`). The cells (`td`) should have a glassy dark navy background (rgba(15, 23, 42, 0.4)) and very subtle white borders. The first and last cells of each row should have rounded corners (15px) to make each row look like a floating card. On hover, the row background should turn very faint cyan (rgba(0, 234, 255, 0.05))."
