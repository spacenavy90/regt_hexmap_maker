const canvas = document.getElementById('mapCanvas');
const ctx = canvas.getContext('2d');
const size = 40; 
let currentTool = 'Open';
let hexes = [];
let rivers = new Set(); 
let isDrawing = false;
let gridStyle = 'white';
let hoveredHex = null;
let hoveredEdge = null;

let currentBiome = 'Temperate';
const biomeColors = {
    'Temperate': {
        'Open': '#90ee90',      
        'Forest': '#2e8b57', 
        'Hills': '#8db600', 
        'Mountain': '#ada9a9',
        'VP': '#ffff00',
        'Capital': '#ffff00',
        'Road': '#333333',      
        'Water': '#1e90ff',
        'Wetland': '#556b2f' 
    },
    'Desert': {
        'Open': '#eedd82', 
        'Forest': '#b8860b', 
        'Hills': '#cd853f', 
        'Mountain': '#8b4513', 
        'VP': '#ffff00',
        'Capital': '#ffff00',
        'Road': '#333333',
        'Water': '#1e90ff',
        'Wetland': '#6b946b'
    },
    'Snow': {
        'Open': '#c5c5c5', 
        'Forest': '#88a0c0', 
        'Hills': '#add8e6', 
        'Mountain': '#778899', 
        'VP': '#ffff00',
        'Capital': '#ffff00',
        'Road': '#333333',
        'Water': '#1e90ff',
        'Wetland': '#369980'
    }
};

function changeBiome(biome) {
    currentBiome = biome;
    draw();
    getShareCode();
}

const iconFiles = {
    'Forest': 'icons/forest.svg',
    'Hills': 'icons/hills.svg',
    'Mountain': 'icons/mountain.svg',
    'Wetland': 'icons/wetland.svg',
    'VP': 'icons/building.svg',
    'Capital': 'icons/capital.svg',
    'Road': 'icons/road.svg',
    'Water': 'icons/water.svg'
};

const loadedIcons = {};
for (let type in iconFiles) {
    let img = new Image();
    img.src = iconFiles[type];
    img.onload = () => draw(); 
    loadedIcons[type] = img;
}

const directions = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

const toolDisplayNames = {
    'Open': 'Open',
    'Forest': 'Forest',
    'Hills': 'Hills',
    'Mountain': 'Mountain',
    'Water': 'Water',
    'Wetland': 'Wetland',
    'VP': 'Victory Point',
    'Capital': 'Capital',
    'Road': 'Road',
    'River': 'River',
    'Eraser': 'Eraser'
};

const originalRandom = Math.random;

const t2c = { 'Open':'O', 'Forest':'F', 'Hills':'H', 'Mountain':'M', 'Water':'W', 'Wetland':'S', 'VP':'V', 'Capital':'C', 'Road':'R' };
const c2t = { 'O':'Open', 'F':'Forest', 'H':'Hills', 'M':'Mountain', 'W':'Water', 'S':'Wetland', 'V':'VP', 'C':'Capital', 'R':'Road' };

// Maps coordinates -5 through 5 to letters A through K
const n2c = (n) => String.fromCharCode(n + 70); 
const c2n = (c) => c.charCodeAt(0) - 70;

function getShareCode() {
    let terrainStr = hexes.map(h => t2c[h.terrain] || 'O').join('');
    
    let riverStr = Array.from(rivers).map(id => {
        let parts = id.split('_').map(p => p.split(',').map(Number));
        return n2c(parts[0][0]) + n2c(parts[0][1]) + n2c(parts[1][0]) + n2c(parts[1][1]);
    }).join('');
    
    // Append the current biome to the end of the code
    let shareCode = terrainStr + '|' + riverStr + '|' + currentBiome;
    document.getElementById('mapSeed').value = shareCode;
}

function loadShareCode() {
    let code = document.getElementById('mapSeed').value.trim();
    if (!code) {
        alert("Please enter a share code.");
        return;
    }
    
    let parts = code.split('|');
    let terrainStr = parts[0];
    let riverStr = parts[1] || '';
    let loadedBiome = parts[2] || 'Temperate'; // Fallback for older codes
    
    if (terrainStr.length !== hexes.length) {
        alert("Invalid share code length.");
        return;
    }
    
    for (let i = 0; i < hexes.length; i++) {
        hexes[i].terrain = c2t[terrainStr[i]] || 'Open';
    }
    
    rivers.clear();
    for (let i = 0; i < riverStr.length; i += 4) {
        let q1 = c2n(riverStr[i]);
        let r1 = c2n(riverStr[i+1]);
        let q2 = c2n(riverStr[i+2]);
        let r2 = c2n(riverStr[i+3]);
        rivers.add(getEdgeID(q1, r1, q2, r2));
    }
    
    currentBiome = loadedBiome;
    const biomeDropdown = document.getElementById('biomeSelect');
    if (biomeDropdown) biomeDropdown.value = loadedBiome;
    
    draw();
}

function setTool(tool) {
    currentTool = tool;
    document.getElementById('active-tool').innerText = toolDisplayNames[tool] || tool;
    
    document.querySelectorAll('button[data-tool]').forEach(btn => {
        btn.classList.remove('active-tool');
    });
    
    const activeBtn = document.querySelector(`button[data-tool="${tool}"]`);
    if (activeBtn) activeBtn.classList.add('active-tool');
}

for (let q = -5; q <= 5; q++) {
    for (let r = Math.max(-5, -q - 5); r <= Math.min(5, -q + 5); r++) {
        hexes.push({ q, r, terrain: 'Open' });
    }
}

canvas.addEventListener('mousedown', (e) => { isDrawing = true; applyTool(e); });
canvas.addEventListener('mousemove', (e) => { 
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - 400;
    const dy = mouseY - 400;
    const q_frac = (2/3 * dx) / size;
    const r_frac = (-1/3 * dx + Math.sqrt(3)/3 * dy) / size;
    
    let q = Math.round(q_frac);
    let r = Math.round(r_frac);
    let s = Math.round(-q_frac - r_frac);

    if (Math.abs(q - q_frac) > Math.abs(r - r_frac) && Math.abs(q - q_frac) > Math.abs(s - (-q_frac - r_frac))) {
        q = -r - s;
    } else if (Math.abs(r - r_frac) > Math.abs(s - (-q_frac - r_frac))) {
        r = -q - s;
    }

    document.getElementById('hex-coords').innerText = `${q}, ${r}`;

    let newHoveredHex = hexes.find(h => h.q === q && h.r === r) || null;
    let newHoveredEdge = null;

    if (newHoveredHex && (currentTool === 'River' || currentTool === 'Eraser')) {
        const hexCenterX = 400 + size * 3/2 * q;
        const hexCenterY = 400 + size * Math.sqrt(3) * (r + q/2);
        const distToCenter = Math.hypot(mouseX - hexCenterX, mouseY - hexCenterY);

        // Only search for edges if the mouse is in the outer ring of the hex
        if (distToCenter >= size * 0.55) {
            let bestNeighbor = null;
            let minCenterDist = Infinity;

            directions.forEach(d => {
                const nq = q + d[0];
                const nr = r + d[1];
                if (!hexes.some(h => h.q === nq && h.r === nr)) return;

                const nx = 400 + size * 3/2 * nq;
                const ny = 400 + size * Math.sqrt(3) * (nr + nq/2);
                const dist = Math.hypot(mouseX - nx, mouseY - ny);
                
                if (dist < minCenterDist) {
                    minCenterDist = dist;
                    bestNeighbor = { q: nq, r: nr };
                }
            });

            if (bestNeighbor) {
                newHoveredEdge = getEdgeID(q, r, bestNeighbor.q, bestNeighbor.r);
            }
        }
    }

    if (hoveredHex !== newHoveredHex || hoveredEdge !== newHoveredEdge) {
        hoveredHex = newHoveredHex;
        hoveredEdge = newHoveredEdge;
        draw();
    }

    if (isDrawing) applyTool(e); 
});

window.addEventListener('mouseup', () => { 
    if (isDrawing) {
        isDrawing = false; 
        getShareCode();
    }
});

canvas.addEventListener('mouseleave', () => { 
    hoveredHex = null;
    hoveredEdge = null;
    draw();
    if (isDrawing) {
        isDrawing = false; 
        getShareCode();
    }
});

function applyTool(e) {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const dx = mouseX - 400;
    const dy = mouseY - 400;

    const q_frac = (2/3 * dx) / size;
    const r_frac = (-1/3 * dx + Math.sqrt(3)/3 * dy) / size;
    const s_frac = -q_frac - r_frac;

    let q = Math.round(q_frac);
    let r = Math.round(r_frac);
    let s = Math.round(s_frac);

    const q_diff = Math.abs(q - q_frac);
    const r_diff = Math.abs(r - r_frac);
    const s_diff = Math.abs(s - s_frac);

    if (q_diff > r_diff && q_diff > s_diff) {
        q = -r - s;
    } else if (r_diff > s_diff) {
        r = -q - s;
    }

    const baseHex = hexes.find(h => h.q === q && h.r === r);
    if (!baseHex) return; 

    if (currentTool === 'River' || currentTool === 'Eraser') {
        const hexCenterX = 400 + size * 3/2 * q;
        const hexCenterY = 400 + size * Math.sqrt(3) * (r + q/2);
        const distToCenter = Math.hypot(mouseX - hexCenterX, mouseY - hexCenterY);

        if (distToCenter >= size * 0.55) {
            let bestNeighbor = null;
            let minCenterDist = Infinity;

            directions.forEach(d => {
                const nq = q + d[0];
                const nr = r + d[1];
                
                if (!hexes.some(h => h.q === nq && h.r === nr)) return;

                const nx = 400 + size * 3/2 * nq;
                const ny = 400 + size * Math.sqrt(3) * (nr + nq/2);
                const dist = Math.hypot(mouseX - nx, mouseY - ny);
                
                if (dist < minCenterDist) {
                    minCenterDist = dist;
                    bestNeighbor = { q: nq, r: nr };
                }
            });

            if (bestNeighbor) {
                let hex1 = [q, r];
                let hex2 = [bestNeighbor.q, bestNeighbor.r];
                
                if (hex1[0] > hex2[0] || (hex1[0] === hex2[0] && hex1[1] > hex2[1])) {
                    let temp = hex1; hex1 = hex2; hex2 = temp;
                }
                
                const edgeID = `${hex1[0]},${hex1[1]}_${hex2[0]},${hex2[1]}`;
                
                if (currentTool === 'River') {
                    rivers.add(edgeID);
                } else if (currentTool === 'Eraser') {
                    if (rivers.has(edgeID)) {
                        rivers.delete(edgeID);
                    } else {
                        baseHex.terrain = 'Open';
                    }
                }
                draw();
                getShareCode();
            }
        } else if (currentTool === 'Eraser') {
            // User clicked the inner circle of the hex
            baseHex.terrain = 'Open';
            draw();
            getShareCode();
        }
    } else {
        baseHex.terrain = currentTool;
        draw();
        getShareCode();
    }
}

function draw(targetCtx = ctx) {
    targetCtx.clearRect(0, 0, 800, 800); 
    
    hexes.forEach(h => {
        const x = 400 + size * 3/2 * h.q;
        const y = 400 + size * Math.sqrt(3) * (h.r + h.q/2);
        drawHex(targetCtx, x, y, h.terrain);
    });

    drawRivers(targetCtx);

    // Draw hover highlights on the main canvas (not during export)
    if (hoveredHex && targetCtx === ctx) {
        const x = 400 + size * 3/2 * hoveredHex.q;
        const y = 400 + size * Math.sqrt(3) * (hoveredHex.r + hoveredHex.q/2);

        if (currentTool === 'River') {
            if (hoveredEdge) drawEdgeHighlight(targetCtx, hoveredEdge);
        } else if (currentTool === 'Eraser') {
            // Prioritize edge highlight if a river exists, otherwise highlight the hex
            if (hoveredEdge && rivers.has(hoveredEdge)) {
                drawEdgeHighlight(targetCtx, hoveredEdge);
            } else {
                drawHexHighlight(targetCtx, x, y);
            }
        } else {
            drawHexHighlight(targetCtx, x, y);
        }
    }
}

function drawHexHighlight(targetCtx, x, y) {
    targetCtx.beginPath();
    for (let i = 0; i < 6; i++) {
        targetCtx.lineTo(x + size * Math.cos(i * Math.PI / 3), y + size * Math.sin(i * Math.PI / 3));
    }
    targetCtx.closePath();
    targetCtx.strokeStyle = currentTool === 'Eraser' ? 'rgba(255, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)';
    targetCtx.lineWidth = 4;
    targetCtx.stroke();
}

function drawEdgeHighlight(targetCtx, edgeID) {
    const parts = edgeID.split('_');
    const h1 = parts[0].split(',').map(Number);
    const h2 = parts[1].split(',').map(Number);

    const x1 = 400 + size * 3/2 * h1[0];
    const y1 = 400 + size * Math.sqrt(3) * (h1[1] + h1[0]/2);
    const x2 = 400 + size * 3/2 * h2[0];
    const y2 = 400 + size * Math.sqrt(3) * (h2[1] + h2[0]/2);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    const nx = -dy / length;
    const ny = dx / length;

    targetCtx.beginPath();
    targetCtx.moveTo(mx - nx * (size / 2), my - ny * (size / 2));
    targetCtx.lineTo(mx + nx * (size / 2), my + ny * (size / 2));
    
    // Turns red if erasing a river, white if placing one
    if (currentTool === 'Eraser' && rivers.has(edgeID)) {
        targetCtx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    } else {
        targetCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    }
    
    targetCtx.lineWidth = 8;
    targetCtx.lineCap = 'round';
    targetCtx.stroke();
}

function drawHex(targetCtx, x, y, type) {
    targetCtx.beginPath();
    for (let i = 0; i < 6; i++) {
        targetCtx.lineTo(x + size * Math.cos(i * Math.PI / 3), y + size * Math.sin(i * Math.PI / 3));
    }
    targetCtx.closePath();
    targetCtx.fillStyle = biomeColors[currentBiome][type] || biomeColors[currentBiome]['Open'];
    targetCtx.fill();
    
    // Grid stroke is now always rendered as either white or black
    targetCtx.strokeStyle = gridStyle;
    targetCtx.lineWidth = 1;
    targetCtx.stroke();

    if (loadedIcons[type] && loadedIcons[type].complete && loadedIcons[type].naturalWidth !== 0) {
        const iconSize = size * 1.2; 
        if (type === 'Road') targetCtx.filter = 'invert(100%)';
        targetCtx.drawImage(loadedIcons[type], x - iconSize / 2, y - iconSize / 2, iconSize, iconSize);
        targetCtx.filter = 'none';
    }
}

function drawRivers(targetCtx) {
    targetCtx.strokeStyle = '#1e90ff';
    targetCtx.lineWidth = 6;
    targetCtx.lineCap = 'round';

    rivers.forEach(edgeID => {
        const parts = edgeID.split('_');
        const h1 = parts[0].split(',').map(Number);
        const h2 = parts[1].split(',').map(Number);

        const x1 = 400 + size * 3/2 * h1[0];
        const y1 = 400 + size * Math.sqrt(3) * (h1[1] + h1[0]/2);
        const x2 = 400 + size * 3/2 * h2[0];
        const y2 = 400 + size * Math.sqrt(3) * (h2[1] + h2[0]/2);

        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        
        const dx = x2 - x1;
        const dy = y2 - y1;
        const length = Math.hypot(dx, dy);
        const nx = -dy / length;
        const ny = dx / length;

        targetCtx.beginPath();
        targetCtx.moveTo(mx - nx * (size / 2), my - ny * (size / 2));
        targetCtx.lineTo(mx + nx * (size / 2), my + ny * (size / 2));
        targetCtx.stroke();
    });
}

function clearMap() {
    hexes.forEach(h => h.terrain = 'Open');
    rivers.clear();
    draw();
    getShareCode();
}

function downloadMap() {
    const scaleStr = document.getElementById('exportScale').value;
    const scale = parseFloat(scaleStr);
    
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 800 * scale;
    exportCanvas.height = 800 * scale;
    const exportCtx = exportCanvas.getContext('2d');
    
    exportCtx.scale(scale, scale);
    draw(exportCtx);

    const link = document.createElement('a');
    link.download = `regiment-map-${exportCanvas.width}x${exportCanvas.height}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function hexDistance(a, b) {
    return (Math.abs(a.q - b.q) + Math.abs(a.r - b.r) + Math.abs(-a.q - a.r - (-b.q - b.r))) / 2;
}

function getEdgeID(q1, r1, q2, r2) {
    let hex1 = [q1, r1];
    let hex2 = [q2, r2];
    if (hex1[0] > hex2[0] || (hex1[0] === hex2[0] && hex1[1] > hex2[1])) {
        return `${hex2[0]},${hex2[1]}_${hex1[0]},${hex1[1]}`;
    }
    return `${hex1[0]},${hex1[1]}_${hex2[0]},${hex2[1]}`;
}

function getCommonNeighbors(h1, h2) {
    let common = [];
    directions.forEach(d => {
        let nq = h1.q + d[0];
        let nr = h1.r + d[1];
        if (hexDistance({q:nq, r:nr}, h2) === 1) {
            let hex = hexes.find(h => h.q === nq && h.r === nr);
            if (hex) common.push(hex);
        }
    });
    return common;
}

function getPath(startHex, endHex) {
    let openSet = [startHex];
    let cameFrom = new Map();
    let gScore = new Map();
    let fScore = new Map();
    
    hexes.forEach(h => {
        gScore.set(h, Infinity);
        fScore.set(h, Infinity);
        h.weight = 1 + Math.random() * 4; 
        
        let roadNeighbors = 0;
        directions.forEach(d => {
            let n = hexes.find(nx => nx.q === h.q + d[0] && nx.r === h.r + d[1]);
            if (n && n.terrain === 'Road') roadNeighbors++;
        });
        if (roadNeighbors > 0) h.weight += 20; 
    });
    
    gScore.set(startHex, 0);
    fScore.set(startHex, hexDistance(startHex, endHex));
    
    while(openSet.length > 0) {
        openSet.sort((a, b) => fScore.get(a) - fScore.get(b));
        let current = openSet.shift();
        
        if (current === endHex) {
            let path = [current];
            while(cameFrom.has(current)) {
                current = cameFrom.get(current);
                path.unshift(current);
            }
            return path;
        }
        
        directions.forEach(d => {
            let neighbor = hexes.find(h => h.q === current.q + d[0] && h.r === current.r + d[1]);
            if (!neighbor) return;
            
            if (neighbor.terrain === 'VP' || neighbor.terrain === 'Capital') {
                if (neighbor !== endHex && neighbor !== startHex) return; 
            }
            
            let tentative_gScore = gScore.get(current) + neighbor.weight;
            if (tentative_gScore < gScore.get(neighbor)) {
                cameFrom.set(neighbor, current);
                gScore.set(neighbor, tentative_gScore);
                fScore.set(neighbor, tentative_gScore + hexDistance(neighbor, endHex));
                if (!openSet.includes(neighbor)) {
                    openSet.push(neighbor);
                }
            }
        });
    }
    return [];
}

function generateMap() {
    // Ensure we are using standard randomness for the new generation
    Math.random = originalRandom; 

    // Reset the map state
    hexes.forEach(h => {
        h.terrain = 'Open';
        h.populated = false; // Reset population flag for scatter-burst
    });
    rivers.clear();

    const capitalHex = hexes.find(h => h.q === 0 && h.r === 0);
    if (capitalHex) capitalHex.terrain = 'Capital';

    const vpCoords = [
        {q: -4, r: 2}, {q: 4, r: -2}, {q: -2, r: -1}, 
        {q: 2, r: -3}, {q: -2, r: 3}, {q: 2, r: 1}    
    ];

    vpCoords.forEach(coord => {
        const hex = hexes.find(h => h.q === coord.q && h.r === coord.r);
        if (hex) hex.terrain = 'VP';
    });

    const perimeterHexes = hexes.filter(h => hexDistance({q:0, r:0}, h) === 5);
    const centerHexes = hexes.filter(h => hexDistance({q:0, r:0}, h) <= 1 && h.terrain === 'Open');
    
    function buildRoad(start, end) {
        let path = getPath(start, end);
        path.forEach(h => {
            if (h.terrain === 'Open') h.terrain = 'Road';
        });
        return path;
    }

    // --- ROAD GENERATION ---
    let start1 = perimeterHexes[Math.floor(Math.random() * perimeterHexes.length)];
    let mid1 = centerHexes[Math.floor(Math.random() * centerHexes.length)];
    let validEnd1 = perimeterHexes.filter(h => hexDistance({q: -start1.q, r: -start1.r}, h) <= 2);
    let end1 = validEnd1[Math.floor(Math.random() * validEnd1.length)] || perimeterHexes[0];

    let mainRoadPath = buildRoad(start1, mid1);
    mainRoadPath = mainRoadPath.concat(buildRoad(mid1, end1));

    let intersectionRoll = Math.random();
    
    if (intersectionRoll > 0.80 && intersectionRoll <= 0.95) { 
        let forkStart = mainRoadPath[Math.floor(Math.random() * mainRoadPath.length)];
        let validPerimeters = perimeterHexes.filter(h => h.terrain === 'Open' && hexDistance(forkStart, h) > 3);
        let forkEnd = validPerimeters[Math.floor(Math.random() * validPerimeters.length)];
        if (forkEnd && forkStart) buildRoad(forkStart, forkEnd);
    } 
    else if (intersectionRoll > 0.95) { 
        let start2 = perimeterHexes.filter(h => h.terrain === 'Open')[Math.floor(Math.random() * perimeterHexes.length)];
        let mid2 = centerHexes[Math.floor(Math.random() * centerHexes.length)];
        if (start2 && mid2) {
            let validEnd2 = perimeterHexes.filter(h => h.terrain === 'Open' && hexDistance({q: -start2.q, r: -start2.r}, h) <= 2);
            let end2 = validEnd2[Math.floor(Math.random() * validEnd2.length)];
            if (end2) {
                buildRoad(start2, mid2);
                buildRoad(mid2, end2);
            }
        }
    }

    // --- RIVER EDGE NETWORK ---
    let allEdges = [];
    let edgeMap = new Map();

    hexes.forEach(h => {
        directions.forEach(d => {
            let n = hexes.find(nx => nx.q === h.q + d[0] && nx.r === h.r + d[1]);
            if (n) {
                let id = getEdgeID(h.q, h.r, n.q, n.r);
                if (!edgeMap.has(id)) {
                    let edge = { id: id, h1: h, h2: n, weight: 1 + Math.random() * 4, neighbors: [] };
                    edgeMap.set(id, edge);
                    allEdges.push(edge);
                }
            }
        });
    });

    allEdges.forEach(e => {
        let commons = getCommonNeighbors(e.h1, e.h2);
        commons.forEach(c => {
            let id1 = getEdgeID(e.h1.q, e.h1.r, c.q, c.r);
            let id2 = getEdgeID(e.h2.q, e.h2.r, c.q, c.r);
            if (edgeMap.has(id1)) e.neighbors.push(edgeMap.get(id1));
            if (edgeMap.has(id2)) e.neighbors.push(edgeMap.get(id2));
        });
    });

    function getRiverPath(startEdge, endEdge) {
        let openSet = [startEdge];
        let cameFrom = new Map();
        let gScore = new Map();
        let fScore = new Map();
        
        allEdges.forEach(e => {
            gScore.set(e, Infinity);
            fScore.set(e, Infinity);
        });
        
        gScore.set(startEdge, 0);
        let heuristic = (e) => {
            let mx1 = (e.h1.q + e.h2.q)/2; let my1 = (e.h1.r + e.h2.r)/2;
            let mx2 = (endEdge.h1.q + endEdge.h2.q)/2; let my2 = (endEdge.h1.r + endEdge.h2.r)/2;
            return Math.abs(mx1 - mx2) + Math.abs(my1 - my2); 
        };
        fScore.set(startEdge, heuristic(startEdge));
        
        while(openSet.length > 0) {
            openSet.sort((a, b) => fScore.get(a) - fScore.get(b));
            let current = openSet.shift();
            
            if (current === endEdge) {
                let path = [current];
                while(cameFrom.has(current)) {
                    current = cameFrom.get(current);
                    path.unshift(current);
                }
                return path;
            }
            
            current.neighbors.forEach(neighbor => {
                let penalty = rivers.has(neighbor.id) ? 10 : 0; 
                let tentative_gScore = gScore.get(current) + neighbor.weight + penalty;
                if (tentative_gScore < gScore.get(neighbor)) {
                    cameFrom.set(neighbor, current);
                    gScore.set(neighbor, tentative_gScore);
                    fScore.set(neighbor, tentative_gScore + heuristic(neighbor));
                    if (!openSet.includes(neighbor)) {
                        openSet.push(neighbor);
                    }
                }
            });
        }
        return [];
    }

    function applyRiverFeatures(path) {
        path.forEach(e => {
            rivers.add(e.id);
            if (Math.random() < 0.06) {
                let lakeHex = Math.random() < 0.5 ? e.h1 : e.h2;
                if (lakeHex.terrain === 'Open') {
                    lakeHex.terrain = 'Water';
                    if (Math.random() < 0.15) {
                        let ns = hexes.filter(h => hexDistance(lakeHex, h) === 1 && h.terrain === 'Open');
                        if (ns.length > 0) ns[Math.floor(Math.random() * ns.length)].terrain = 'Water';
                    }
                }
            }
        });
    }

    // --- RIVER GENERATION ---
    let perimeterEdges = allEdges.filter(e => hexDistance({q:0,r:0}, e.h1) === 5 && hexDistance({q:0,r:0}, e.h2) === 5);
    
    let rStartEdge = perimeterEdges[Math.floor(Math.random() * perimeterEdges.length)];
    let sx = (rStartEdge.h1.q + rStartEdge.h2.q)/2;
    let sy = (rStartEdge.h1.r + rStartEdge.h2.r)/2;
    let rValidEnds = perimeterEdges.filter(e => {
        let mx = (e.h1.q + e.h2.q)/2;
        let my = (e.h1.r + e.h2.r)/2;
        return Math.abs(mx - (-sx)) + Math.abs(my - (-sy)) <= 4;
    });
    let rEndEdge = rValidEnds.length > 0 ? rValidEnds[Math.floor(Math.random() * rValidEnds.length)] : perimeterEdges[Math.floor(Math.random() * perimeterEdges.length)];
    
    let riverPath1 = getRiverPath(rStartEdge, rEndEdge);
    applyRiverFeatures(riverPath1);

    if (Math.random() < 0.20 && riverPath1.length > 5) {
        let forkStartEdge = riverPath1[Math.floor(Math.random() * (riverPath1.length - 2)) + 1];
        let forkValidEnds = perimeterEdges.filter(e => e !== rStartEdge && e !== rEndEdge);
        if (forkValidEnds.length > 0) {
            let forkEndEdge = forkValidEnds[Math.floor(Math.random() * forkValidEnds.length)];
            let forkPath = getRiverPath(forkStartEdge, forkEndEdge);
            applyRiverFeatures(forkPath);
        }
    }

    if (Math.random() < 0.05) {
        let rStart2 = perimeterEdges[Math.floor(Math.random() * perimeterEdges.length)];
        let centerHex = hexes.find(h => h.q === 0 && h.r === 0);
        let centerEdges = allEdges.filter(e => e.h1 === centerHex || e.h2 === centerHex);
        let rEnd2 = centerEdges[Math.floor(Math.random() * centerEdges.length)];
        let riverPath2 = getRiverPath(rStart2, rEnd2);
        applyRiverFeatures(riverPath2);
    }

    // --- ENCIRCLEMENT CHECK ---
    hexes.forEach(h => {
        if (h.terrain === 'Open') {
            let riverEdges = 0;
            directions.forEach(d => {
                let n = hexes.find(nx => nx.q === h.q + d[0] && nx.r === h.r + d[1]);
                if (n && rivers.has(getEdgeID(h.q, h.r, n.q, n.r))) {
                    riverEdges++;
                }
            });
            if (riverEdges === 6) h.terrain = 'Water';
        }
    });

// --- TERRAIN SCATTER-BURST ---
    hexes.forEach(h => {
        h.populated = h.terrain !== 'Open';
    });

    // Helper to check if a hex touches a water hex or a river edge
    function isNearWater(hex) {
        let near = false;
        directions.forEach(d => {
            let n = hexes.find(nx => nx.q === hex.q + d[0] && nx.r === hex.r + d[1]);
            if (n) {
                if (n.terrain === 'Water') near = true;
                if (rivers.has(getEdgeID(hex.q, hex.r, n.q, n.r))) near = true;
            }
        });
        return near;
    }

    hexes.forEach(h => {
        if (!h.populated && h.terrain === 'Open') {
            
            let nearWater = isNearWater(h);
            let roll = Math.random();
            let type = 'Open';
            
            if (nearWater) {
                // Coastal/River Roll: 45% Open, 20% Forest, 20% Hills, 10% Wetland, 5% Mountain
                if (roll > 0.45 && roll <= 0.65) type = 'Forest';
                else if (roll > 0.65 && roll <= 0.85) type = 'Hills';
                else if (roll > 0.85 && roll <= 0.95) type = 'Wetland';
                else if (roll > 0.95) type = 'Mountain';
            } else {
                // Inland Roll: 45% Open, 20% Forest, 30% Hills, 5% Mountain
                if (roll > 0.45 && roll <= 0.65) type = 'Forest';
                else if (roll > 0.65 && roll <= 0.95) type = 'Hills';
                else if (roll > 0.95) type = 'Mountain';
            }

            h.terrain = type;
            h.populated = true;

            function getValidNeighbors(center) {
                let valids = [];
                directions.forEach(d => {
                    let n = hexes.find(nx => nx.q === center.q + d[0] && nx.r === center.r + d[1]);
                    if (n && !n.populated && n.terrain === 'Open') {
                        valids.push(n);
                    }
                });
                return valids;
            }

            let neighbors = getValidNeighbors(h);
            if (neighbors.length > 0) {
                // Prevent Wetlands from spreading inland during scatter-burst
                let validSpreadNeighbors = neighbors;
                if (type === 'Wetland') {
                    validSpreadNeighbors = neighbors.filter(n => isNearWater(n));
                }

                if (validSpreadNeighbors.length > 0) {
                    let adj1 = validSpreadNeighbors[Math.floor(Math.random() * validSpreadNeighbors.length)];
                    adj1.terrain = type;
                    adj1.populated = true;

                    if (Math.random() < 0.15) {
                        let extendedNeighbors = [...new Set([...getValidNeighbors(h), ...getValidNeighbors(adj1)])];
                        if (type === 'Wetland') {
                            extendedNeighbors = extendedNeighbors.filter(n => isNearWater(n));
                        }
                        if (extendedNeighbors.length > 0) {
                            let adj2 = extendedNeighbors[Math.floor(Math.random() * extendedNeighbors.length)];
                            adj2.terrain = type;
                            adj2.populated = true;
                        }
                    }
                }
            }
        }
    });

    draw();
    getShareCode();
}

function saveProject() {
    const projectData = {
        hexes: hexes,
        rivers: Array.from(rivers),
        biome: currentBiome // Added to track palette in JSON files
    };
    
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(projectData));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "regiment-map-save.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function loadProject(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const projectData = JSON.parse(e.target.result);
            if (projectData.hexes && projectData.rivers) {
                hexes = projectData.hexes;
                rivers = new Set(projectData.rivers);
                
                // Restore biome and update the dropdown menu
                if (projectData.biome) {
                    currentBiome = projectData.biome;
                    const bSelect = document.getElementById('biomeSelect');
                    if (bSelect) bSelect.value = currentBiome;
                }
                
                draw();
                getShareCode();
            } else {
                alert("Invalid map file format.");
            }
        } catch (err) {
            alert("Error reading file.");
        }
        event.target.value = ""; 
    };
    reader.readAsText(file);
}

function toggleGrid() {
    // Cycles strictly between white and black
    gridStyle = (gridStyle === 'white') ? 'black' : 'white';
    
    const btn = document.getElementById('gridToggleBtn');
    if (btn) {
        btn.innerText = `Grid: ${gridStyle.charAt(0).toUpperCase() + gridStyle.slice(1)}`;
    }
    
    draw();
}

function rotateMap() {
    // 1. Cache current terrain and clear rivers for recalculation
    const terrainMap = new Map();
    hexes.forEach(h => {
        terrainMap.set(`${h.q},${h.r}`, h.terrain);
    });

    // 2. Rotate Hex Content
    // To move content CW, each hex (q, r) looks at the source that was 60 deg CCW
    // CCW Lookup: sourceQ = -r, sourceR = q + r
    hexes.forEach(h => {
        const sourceQ = -h.r;
        const sourceR = h.q + h.r;
        const sourceTerrain = terrainMap.get(`${sourceQ},${sourceR}`);
        
        // Only update if the source was within map bounds
        if (sourceTerrain) {
            h.terrain = sourceTerrain;
        } else {
            h.terrain = 'Open';
        }
    });

    // 3. Rotate Rivers
    const newRivers = new Set();
    const rot = (q, r) => [q + r, -q]; // CW Transform

    rivers.forEach(id => {
        const parts = id.split('_').map(p => p.split(',').map(Number));
        const p1 = rot(parts[0][0], parts[0][1]);
        const p2 = rot(parts[1][0], parts[1][1]);
        
        newRivers.add(getEdgeID(p1[0], p1[1], p2[0], p2[1]));
    });

    rivers = newRivers;
    draw();
    getShareCode();
}

function generateRandomMap() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let randomSeed = '';
    // Restore original random to ensure true randomness for the seed string
    Math.random = originalRandom; 
    for (let i = 0; i < 8; i++) {
        randomSeed += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    document.getElementById('mapSeed').value = randomSeed;
    generateMap();
}

function generateFromSeed() {
    if (document.getElementById('mapSeed').value.trim() === "") {
        alert("Please enter a seed value.");
        return;
    }
    generateMap();
}

function mirrorMap(direction) {
    const terrainMap = new Map();
    hexes.forEach(h => terrainMap.set(`${h.q},${h.r}`, h.terrain));

    const newRivers = new Set();
    
    const mirrorQ = (q, r, dir) => dir === 'horizontal' ? -q : q;
    const mirrorR = (q, r, dir) => dir === 'horizontal' ? r + q : -r - q;

    hexes.forEach(h => {
        let srcQ = mirrorQ(h.q, h.r, direction);
        let srcR = mirrorR(h.q, h.r, direction);
        
        const srcTerrain = terrainMap.get(`${srcQ},${srcR}`);
        if (srcTerrain) h.terrain = srcTerrain;
    });

    rivers.forEach(id => {
        const parts = id.split('_').map(p => p.split(',').map(Number));
        let p1 = parts[0], p2 = parts[1];
        
        let m1Q = mirrorQ(p1[0], p1[1], direction);
        let m1R = mirrorR(p1[0], p1[1], direction);
        let m2Q = mirrorQ(p2[0], p2[1], direction);
        let m2R = mirrorR(p2[0], p2[1], direction);
        
        newRivers.add(getEdgeID(m1Q, m1R, m2Q, m2R));
    });

    rivers = newRivers;
    draw();
    getShareCode();
}

function copyShareCode() {
    const codeInput = document.getElementById('mapSeed');
    if (!codeInput.value) return;
    
    codeInput.select();
    codeInput.setSelectionRange(0, 99999); 
    navigator.clipboard.writeText(codeInput.value).then(() => {
        const copyBtn = document.getElementById('copyBtn');
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "Copied!";
        setTimeout(() => { copyBtn.innerText = originalText; }, 1500);
    });
}

function resetMap() {
    currentBiome = 'Temperate';
    const biomeDropdown = document.getElementById('biomeSelect');
    if (biomeDropdown) biomeDropdown.value = 'Temperate';
    
    // clearMap handles resetting all hexes to 'Open' and clearing rivers
    clearMap(); 
}

draw();