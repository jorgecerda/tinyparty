import { AudioAnalyser } from './audio.js';

const canvas = document.getElementById('visualizer-canvas');
const ctx = canvas.getContext('2d');
const OVERLAY = document.getElementById('onboarding-overlay');
const START_BTN = document.getElementById('start-btn');
const QUIT_BTN = document.getElementById('quit-btn');

// Configurations
const FFT_SIZE = 256;  // Fast Fourier Transform sample size (yields 128 bins)
const analyser = new AudioAnalyser(FFT_SIZE);

let currentStyle = 'spectrum';
let currentPalette = 'neon';

// Static 2-Layer 2D Mesh Configuration and State
const meshCols = 90;
const meshLayers = [
    { baseYOffset: 0, maxPeakHeight: 55, opacity: 0.45, smoothing: 0.30, freqScale: 0.65 }, // back layer (offset bottom)
    { baseYOffset: 0, maxPeakHeight: 80, opacity: 0.85, smoothing: 0.60, freqScale: 0.85 }  // front layer (offset bottom)
];
// 2D array [2][meshCols] to track current smoothed column heights for each layer
const meshHeights = Array.from({ length: 2 }, () => new Array(meshCols).fill(0));


// Set initial class on startup
if (currentStyle === 'glow') {
    canvas.classList.add('glow');
}

const peakHeights = new Array(90).fill(0);
const peakHoldFrames = new Array(90).fill(0);

// Resize canvas to match display resolution (supports Retina DPR)
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Map index and amplitude intensity to HSL hue color base on the active palette
function getBarColor(indexRatio, intensity) {
    let hue, saturation, lightness;

    if (currentPalette === 'neon') {
        hue = 120 + (indexRatio * 220); // Green to Blue/Purple
        saturation = 95;
        lightness = 40 + (intensity * 25);
    } else if (currentPalette === 'cyberpunk') {
        hue = 320 - (indexRatio * 140); // Hot Pink to Cyan
        saturation = 100;
        lightness = 45 + (intensity * 20);
    } else { // 'inferno'
        hue = 0 + (indexRatio * 65); // Red to Gold Yellow
        saturation = 100;
        lightness = 35 + (intensity * 30);
    }

    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Draw smooth, continuous glowing neon bars (glow style)
function drawGlowBars(frequencies, width, height) {
    ctx.clearRect(0, 0, width, height);

    const barCount = 90;
    const spacing = 3;
    const barWidth = (width - (spacing * (barCount - 1))) / barCount;
    const maxBarHeight = 90; // Lock height to 90px to match original size

    for (let i = 0; i < barCount; i++) {
        const indexRatio = i / barCount;
        const freqIndex = Math.floor(indexRatio * frequencies.length * 0.65);
        const amplitude = frequencies[freqIndex] || 0;
        const intensity = amplitude / 255;
        const barHeight = Math.max(3, intensity * maxBarHeight);

        const x = i * (barWidth + spacing);
        const y = height - barHeight;

        const barColor = getBarColor(indexRatio, intensity);
        
        ctx.fillStyle = barColor;
        ctx.shadowColor = barColor;
        ctx.shadowBlur = intensity > 0.15 ? 12 : 3;

        // Draw rounded rectangle bar
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
        } else {
            ctx.rect(x, y, barWidth, barHeight);
        }
        ctx.fill();
    }
    ctx.shadowBlur = 0; // Reset shadow blur
}

// Draw segmented VFD style bar equalizer with floating peak hold (retro style)
function drawRetroBars(frequencies, width, height) {
    ctx.clearRect(0, 0, width, height);

    const barCount = 90;
    const spacing = 3;
    const barWidth = (width - (spacing * (barCount - 1))) / barCount;
    const maxBarHeight = 85; // Lock height to 85px to match original size

    for (let i = 0; i < barCount; i++) {
        const indexRatio = i / barCount;
        const freqIndex = Math.floor(indexRatio * frequencies.length * 0.7);
        const amplitude = frequencies[freqIndex] || 0;
        const intensity = amplitude / 255;
        const barHeight = Math.max(0, intensity * maxBarHeight);

        const x = i * (barWidth + spacing);

        // Draw segmented blocks (VU-meter look)
        const blockSize = 5;
        const gapSize = 3;
        const totalBlockSize = blockSize + gapSize;
        const numBlocks = Math.floor(barHeight / totalBlockSize);

        // Update floating peaks
        if (numBlocks >= peakHeights[i]) {
            peakHeights[i] = numBlocks;
            peakHoldFrames[i] = 20; // Hold for 20 frames
        } else {
            if (peakHoldFrames[i] > 0) {
                peakHoldFrames[i]--;
            } else {
                peakHeights[i] = Math.max(0, peakHeights[i] - 0.25); // Smooth decay
            }
        }

        // Draw the vertical column blocks
        for (let j = 0; j < numBlocks; j++) {
            const blockY = height - (j * totalBlockSize) - blockSize;
            const heightPct = j / (maxBarHeight / totalBlockSize);
            
            // Map the colors depending on the active palette
            let color;
            if (currentPalette === 'neon') {
                let hue = 120 + (heightPct * 120);
                color = `hsl(${hue}, 95%, 45%)`;
            } else if (currentPalette === 'cyberpunk') {
                let hue = 320 - (heightPct * 120);
                color = `hsl(${hue}, 100%, 50%)`;
            } else { // 'inferno'
                let hue = 0 + (heightPct * 60);
                color = `hsl(${hue}, 100%, 45%)`;
            }

            ctx.fillStyle = color;
            ctx.fillRect(x, blockY, barWidth, blockSize);
        }

        // Draw the floating peak indicator block
        const peakIdx = Math.floor(peakHeights[i]);
        if (peakIdx > 0 && peakIdx > numBlocks) {
            const peakY = height - (peakIdx * totalBlockSize) - blockSize;
            const heightPct = (peakIdx * totalBlockSize) / maxBarHeight;

            let color;
            if (currentPalette === 'neon') {
                let hue = 120 + (heightPct * 120);
                color = `hsl(${hue}, 95%, 45%)`;
            } else if (currentPalette === 'cyberpunk') {
                let hue = 320 - (heightPct * 120);
                color = `hsl(${hue}, 100%, 50%)`;
            } else { // 'inferno'
                let hue = 0 + (heightPct * 60);
                color = `hsl(${hue}, 100%, 45%)`;
            }

            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = 5;
            ctx.fillRect(x, peakY, barWidth, blockSize);
            ctx.shadowBlur = 0;
        }
    }
}

// Draw a single triangulated mountain range layer
function drawLayer(layer, heightsForLayer, width, height) {
    const colSpacing = width / (meshCols - 1);
    
    // Generate vertices for this layer
    const vertices = [];
    for (let c = 0; c < meshCols; c++) {
        const x = c * colSpacing;
        const vertexHeight = heightsForLayer[c];
        
        const baselineY = height - layer.baseYOffset;
        const peakY = baselineY - vertexHeight;
        const midY = baselineY - vertexHeight * 0.45;
        
        // Define peak, mid, and base points starting from the bottom of the screen
        vertices.push({
            p0: { x, y: peakY },         // peak (top node)
            p1: { x, y: midY },          // mid node
            p2: { x, y: baselineY }      // baseline node
        });
    }
    
    // Connect vertices to draw filled & stroked triangles
    for (let c = 0; c < meshCols - 1; c++) {
        const v1 = vertices[c];
        const v2 = vertices[c + 1];
        
        // Average column ratio for color calculation
        const indexRatio = (c + 0.5) / (meshCols - 1);
        const avgHeight = (heightsForLayer[c] + heightsForLayer[c + 1]) / 2;
        const intensity = Math.min(1.0, avgHeight / layer.maxPeakHeight);
        
        // Base color with layer opacity
        const baseColor = getBarColor(indexRatio, intensity);
        // Replace HSL with HSLA for transparency
        const hslaColor = baseColor.replace('hsl', 'hsla').replace(')', `, ${layer.opacity})`);
        
        ctx.strokeStyle = hslaColor;
        ctx.lineWidth = 1.2;
        
        // Top cell triangles
        drawTriangle(v1.p0, v2.p0, v2.p1);
        drawTriangle(v1.p0, v1.p1, v2.p1);
        
        // Bottom cell triangles
        drawTriangle(v1.p1, v2.p1, v2.p2);
        drawTriangle(v1.p1, v1.p2, v2.p2);
    }
}

// Draw a single filled triangle with stroke outline
function drawTriangle(a, b, c) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.15)'; // Semi-opaque dark mask to hide background layers
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

// Draw the 2D wireframe mesh
function drawMesh(width, height) {
    ctx.clearRect(0, 0, width, height);
    
    // Draw layers from back to front
    for (let i = 0; i < meshLayers.length; i++) {
        // Calculate display heights with horizontal 3-point smoothing
        const displayHeights = new Array(meshCols);
        for (let c = 0; c < meshCols; c++) {
            const prev = c > 0 ? meshHeights[i][c - 1] : meshHeights[i][c];
            const curr = meshHeights[i][c];
            const next = c < meshCols - 1 ? meshHeights[i][c + 1] : meshHeights[i][c];
            displayHeights[c] = prev * 0.25 + curr * 0.5 + next * 0.25;
        }
        drawLayer(meshLayers[i], displayHeights, width, height);
    }
}

// 60FPS animation rendering loop
function draw() {
    requestAnimationFrame(draw);
    
    if (!analyser.isInitialized) return;

    const logicalWidth = canvas.clientWidth;
    const logicalHeight = canvas.clientHeight;
    const frequencies = analyser.getFrequencies();

    if (currentStyle === 'spectrum' || currentStyle === 'glow') {
        drawGlowBars(frequencies, logicalWidth, logicalHeight);
    } else if (currentStyle === 'mesh') {
        // Update column heights for each layer independently using their respective smoothing and freqScale
        for (let i = 0; i < meshLayers.length; i++) {
            const layer = meshLayers[i];
            const maxIdx = (frequencies.length - 1) * layer.freqScale;
            for (let c = 0; c < meshCols; c++) {
                const indexRatio = c / (meshCols - 1);
                
                // Linearly interpolate between adjacent frequency bins for ultra-smooth wave movement
                const floatIndex = indexRatio * maxIdx;
                const indexLower = Math.floor(floatIndex);
                const indexUpper = Math.min(frequencies.length - 1, indexLower + 1);
                const weight = floatIndex - indexLower;
                
                const amplitude = (frequencies[indexLower] || 0) * (1 - weight) + 
                                  (frequencies[indexUpper] || 0) * weight;
                                  
                // Boost signal sensitivity by 45% for increased vertical range
                const intensity = Math.min(1.0, (amplitude / 255) * 1.45);
                const targetVal = intensity * layer.maxPeakHeight;
                
                // Smooth interpolation
                meshHeights[i][c] += (targetVal - meshHeights[i][c]) * layer.smoothing;
            }
        }

        drawMesh(logicalWidth, logicalHeight);
    } else if (currentStyle === 'retro') {
        drawRetroBars(frequencies, logicalWidth, logicalHeight);
    }
}

// Listen for style changes from the main process
if (window.electronAPI && typeof window.electronAPI.onStyleChange === 'function') {
    window.electronAPI.onStyleChange((style) => {
        currentStyle = style;
        
        // Update canvas classes
        canvas.className = '';
        if (style === 'glow') {
            canvas.classList.add('glow');
        }
    });
}

// Listen for palette changes from the main process
if (window.electronAPI && typeof window.electronAPI.onPaletteChange === 'function') {
    window.electronAPI.onPaletteChange((palette) => {
        currentPalette = palette;
    });
}

// Request permissions, clear overlay, and trigger pass-through mode
async function startVisualizer() {
    START_BTN.textContent = 'connecting...';
    START_BTN.disabled = true;

    try {
        // Explicitly request native macOS system permission first
        if (window.electronAPI && typeof window.electronAPI.requestMicrophonePermission === 'function') {
            const granted = await window.electronAPI.requestMicrophonePermission();
            if (!granted) {
                throw new Error('Microphone permission denied by system.');
            }
        }

        await analyser.init();
        
        // Tell Electron onboarding is complete
        if (window.electronAPI && typeof window.electronAPI.onboardingComplete === 'function') {
            window.electronAPI.onboardingComplete();
        }
    } catch (error) {
        START_BTN.textContent = 'retry start';
        START_BTN.disabled = false;
        alert('permission denied: tinyparty needs microphone access. if you just clicked "ok" on the macOS system prompt, please restart the app (quit and reopen) for the permission to take effect!');
        console.error(error);
    }
}

// Determine if we should skip onboarding (visualizer-only window)
const isVisualizerOnly = window.location.hash === '#visualizer';

if (isVisualizerOnly) {
    OVERLAY.style.display = 'none';
    analyser.init().then(() => {
        draw();
    }).catch(error => {
        console.error('Failed to auto-start visualizer:', error);
    });
} else {
    OVERLAY.style.display = 'flex';
}

// Event listeners
START_BTN.addEventListener('click', startVisualizer);

if (QUIT_BTN) {
    QUIT_BTN.addEventListener('click', () => {
        if (window.electronAPI && typeof window.electronAPI.quitApp === 'function') {
            window.electronAPI.quitApp();
        }
    });
}

// Hitting Escape closes the application at any time
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (window.electronAPI && typeof window.electronAPI.quitApp === 'function') {
            window.electronAPI.quitApp();
        }
    }
});

// Resume AudioContext on interaction if browser suspended it
document.body.addEventListener('click', () => {
    analyser.resume();
});

// Notify the main process that the visualizer is fully loaded and ready to sync configuration
if (window.electronAPI && typeof window.electronAPI.visualizerReady === 'function') {
    window.electronAPI.visualizerReady();
}
