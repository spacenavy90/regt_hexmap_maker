# Regiment Hexmap Maker

A lightweight, browser-based map creation tool for my **Regiment** wargame campaign mode. This tool allows players to generate tabletop wargaming maps, customize terrain manually, and share layouts using compressed text codes.

## Features
- **Procedural Generation**: Create unique, fair map layouts with roads and rivers at the click of a button.
- **Manual Editing**: Paint terrain (Forests, Hills, Mountains, Water) or place structures (Victory Points, Capitals) directly onto the grid.
- **Biome Support**: Swap between Temperate, Desert, and Snow themes instantly.
- **Share Codes**: Every map state is encoded into a short text string. Copy the code to share your exact layout with others.
- **High-Res Export**: Save your maps as PNGs in resolutions up to 8K for digital play or professional printing.
- **Project Portability**: Save and load your maps as `.json` files to continue editing later.

## How to Use
1. **Generate**: Click "Random Map" to create a base layout.
2. **Edit**: Select a tool from the top bar (e.g., "Forest" or "Road") and click/drag on the hexes. Use the "Eraser" to revert hexes to Grass.
3. **Share**: The "Share Code" box updates automatically. Click "Copy Code" to send your map to a friend.
4. **Load**: Paste a code into the box and click "Load Code" to see the map.
5. **Reset**: Use "Reset Map" to return to a blank temperate starting point.

## Technical Details
- Built with Vanilla JavaScript and HTML5 Canvas.
- Uses a Flat-Topped Hexagonal coordinate system (Axial).
- No external dependencies or libraries required.