const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function generateIcon(size) {
    // Create canvas
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Background gradient (simplified for node-canvas)
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#2563eb'); // Blue
    gradient.addColorStop(1, '#1d4ed8'); // Darker blue
    
    // Draw background
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Draw rounded corners by clipping
    ctx.globalCompositeOperation = 'destination-in';
    ctx.beginPath();
    const radius = size * 0.15;
    roundRect(ctx, 0, 0, size, size, radius);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    
    // Draw "W" letter for Wanderlust
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${size * 0.4}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('W', size / 2, size / 2);
    
    // Draw small "KB" below
    ctx.font = `${size * 0.12}px Arial`;
    ctx.fillText('KB', size / 2, size * 0.75);
    
    // Add a subtle border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = size * 0.01;
    ctx.beginPath();
    roundRect(ctx, size * 0.02, size * 0.02, size * 0.96, size * 0.96, radius * 0.9);
    ctx.stroke();
    
    return canvas;
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
}

// Generate icons
const sizes = [192, 512];
const publicDir = path.join(__dirname, '..', 'public'); // Go up one level to project root, then to public

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
}

sizes.forEach(size => {
    console.log(`Generating ${size}x${size} icon...`);
    
    const canvas = generateIcon(size);
    const buffer = canvas.toBuffer('image/png');
    const fileName = `icon-${size}.png`;
    const filePath = path.join(publicDir, fileName);
    
    fs.writeFileSync(filePath, buffer);
    console.log(`Created: ${fileName}`);
});

console.log('✅ PWA icons generated successfully!');
console.log('Icons created:');
console.log('- public/icon-192.png (192x192)');
console.log('- public/icon-512.png (512x512)');
