/**
 * Trash Panda Wash & Dry - Canvas Sprite & Environment Renderer
 * Procedurally draws crisp, beautiful, cozy vector characters, machines,
 * furniture, items, speech bubbles, and particle effects.
 */

class SpriteRenderer {
  constructor() {
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  // --- ENVIRONMENT & ROOM ---

  drawRoom(ctx, width, height, layout) {
    // Background wall (warm teal/navy retro wallpaper)
    const wallHeight = 110;
    
    // Wall gradient
    const wallGrad = ctx.createLinearGradient(0, 0, 0, wallHeight);
    wallGrad.addColorStop(0, '#212d40');
    wallGrad.addColorStop(1, '#2f3e58');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, wallHeight);

    // Wall retro stripe accent
    ctx.fillStyle = '#ff8e3c';
    ctx.fillRect(0, wallHeight - 12, width, 4);
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(0, wallHeight - 8, width, 3);
    ctx.fillStyle = '#2ec4b6';
    ctx.fillRect(0, wallHeight - 5, width, 5);

    // Baseboard
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(0, wallHeight, width, 8);

    // Front Window showing outside Critter City
    const winX = width * 0.55;
    const winW = width * 0.38;
    const winH = 75;
    ctx.save();
    ctx.fillStyle = '#16192b';
    ctx.fillRect(winX, 15, winW, winH);
    // City street backdrop
    ctx.fillStyle = '#0f111e';
    ctx.fillRect(winX, 45, winW, 45);
    // Outside streetlamp & stars
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.arc(winX + winW - 30, 32, 10, 0, Math.PI * 2);
    ctx.fill();
    // Warm streetlamp glow
    const lampGlow = ctx.createRadialGradient(winX + winW - 30, 32, 2, winX + winW - 30, 32, 40);
    lampGlow.addColorStop(0, 'rgba(255, 190, 11, 0.4)');
    lampGlow.addColorStop(1, 'rgba(255, 190, 11, 0)');
    ctx.fillStyle = lampGlow;
    ctx.fillRect(winX + winW - 70, 0, 80, 75);
    // Window frame
    ctx.strokeStyle = '#d4a373';
    ctx.lineWidth = 4;
    ctx.strokeRect(winX, 15, winW, winH);
    ctx.beginPath();
    ctx.moveTo(winX + winW / 2, 15);
    ctx.lineTo(winX + winW / 2, 15 + winH);
    ctx.stroke();
    ctx.restore();

    // Laundromat Neon Sign
    ctx.save();
    const neonGlow = (Math.sin(this.time * 3) + 1) * 0.15 + 0.7;
    ctx.fillStyle = `rgba(255, 142, 60, ${neonGlow})`;
    ctx.font = 'bold 18px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('🫧 BARNABY\'S WASH & DRY 🦝', 30, 45);
    ctx.fillStyle = 'rgba(46, 196, 182, 0.8)';
    ctx.font = '600 11px "Nunito", sans-serif';
    ctx.fillText('CRITTER CITY\'S FINEST LAUNDERETTE', 32, 65);
    ctx.restore();

    // Checkered Floor Tiles
    const floorY = wallHeight + 8;
    const floorH = height - floorY;
    const tileSize = 44;
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(floorH / tileSize);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const isEven = (r + c) % 2 === 0;
        ctx.fillStyle = isEven ? '#e2ece9' : '#c3ded7';
        ctx.fillRect(c * tileSize, floorY + r * tileSize, tileSize, tileSize);
        
        // Tile subtle border
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.04)';
        ctx.lineWidth = 1;
        ctx.strokeRect(c * tileSize, floorY + r * tileSize, tileSize, tileSize);
      }
    }

    // Cozy Rug in waiting lounge area
    const rugX = 40;
    const rugY = floorY + 40;
    const rugW = 200;
    const rugH = 150;
    ctx.save();
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.roundRect(rugX, rugY, rugW, rugH, 16);
    ctx.fill();
    ctx.strokeStyle = '#f4a261';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Rug inner pattern
    ctx.fillStyle = '#264653';
    ctx.beginPath();
    ctx.roundRect(rugX + 12, rugY + 12, rugW - 24, rugH - 24, 10);
    ctx.fill();
    ctx.restore();
  }

  // --- WASHING MACHINE ---

  drawWasher(ctx, m) {
    const { x, y, width, height, state, progress, totalTime, id } = m;
    ctx.save();
    ctx.translate(x, y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(width / 2, height - 2, width / 2 + 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Machine Main Body (Pastel Turquoise / White)
    const bodyGrad = ctx.createLinearGradient(0, 0, width, height);
    bodyGrad.addColorStop(0, '#f0fbfc');
    bodyGrad.addColorStop(0.3, '#d8f3dc');
    bodyGrad.addColorStop(1, '#a3e4d7');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 12);
    ctx.fill();

    // Metal Border
    ctx.strokeStyle = '#48cae4';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Top control panel
    ctx.fillStyle = '#1b4965';
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, 22, 6);
    ctx.fill();

    // Machine number badge
    ctx.fillStyle = '#ffbe0b';
    ctx.font = 'bold 10px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`W-${id}`, 8, 18);

    // LED Status Indicator
    let statusColor = '#06d6a0'; // Ready
    if (state === 'needs_soap') statusColor = '#ffbe0b'; // Needs soap
    else if (state === 'washing') statusColor = '#3a86ff'; // Washing
    else if (state === 'done') statusColor = '#ff006e'; // Done

    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(width - 12, 15, 4.5, 0, Math.PI * 2);
    ctx.fill();
    // LED glow
    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(width - 12, 15, 7, 0, Math.PI * 2);
    ctx.globalAlpha = 0.35;
    ctx.fill();
    ctx.globalAlpha = 1.0;

    // Circular Glass Porthole Door
    const doorX = width / 2;
    const doorY = 56;
    const doorRadius = 24;

    // Chrome Bezel
    ctx.fillStyle = '#adb5bd';
    ctx.beginPath();
    ctx.arc(doorX, doorY, doorRadius + 4, 0, Math.PI * 2);
    ctx.fill();

    // Inner drum background
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(doorX, doorY, doorRadius, 0, Math.PI * 2);
    ctx.fill();

    // Inner drum wash animation
    if (state === 'washing') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(doorX, doorY, doorRadius - 2, 0, Math.PI * 2);
      ctx.clip();

      // Sloshing water
      const spinAngle = this.time * 8;
      ctx.fillStyle = 'rgba(58, 134, 255, 0.7)';
      ctx.fillRect(doorX - doorRadius, doorY - 4, doorRadius * 2, doorRadius * 2);

      // Rotating clothes inside
      ctx.translate(doorX, doorY);
      ctx.rotate(spinAngle);
      ctx.fillStyle = '#e76f51';
      ctx.fillRect(-10, -10, 14, 14);
      ctx.fillStyle = '#f4a261';
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = '#ffbe0b';
      ctx.fillRect(-6, 4, 10, 10);
      ctx.restore();

      // Suds & Bubbles on glass
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (let i = 0; i < 6; i++) {
        const bx = doorX + Math.sin(this.time * 5 + i * 1.5) * 12;
        const by = doorY + Math.cos(this.time * 4 + i) * 10;
        ctx.beginPath();
        ctx.arc(bx, by, 3 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (state === 'done') {
      // Clean sparkling clothes visible
      ctx.fillStyle = '#48cae4';
      ctx.beginPath();
      ctx.arc(doorX, doorY, doorRadius - 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨', doorX, doorY + 5);
    } else if (state === 'needs_soap') {
      // Prompt icon
      ctx.fillStyle = '#ffbe0b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🧼?', doorX, doorY + 5);
    }

    // Glass Reflection curve
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(doorX, doorY, doorRadius - 5, -Math.PI * 0.75, -Math.PI * 0.25);
    ctx.stroke();

    // Progress Bar (when washing)
    if (state === 'washing') {
      const barW = width - 16;
      const barH = 5;
      const barX = 8;
      const barY = height - 10;
      const pct = Math.min(1, progress / totalTime);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 2);
      ctx.fill();

      ctx.fillStyle = '#06d6a0';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 2);
      ctx.fill();
    }

    // Floating status icon if done
    if (state === 'done') {
      const bob = Math.sin(this.time * 6) * 3;
      ctx.fillStyle = '#ffbe0b';
      ctx.font = 'bold 12px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🔔 CLEAN!', width / 2, -8 + bob);
    }

    ctx.restore();
  }

  // --- TUMBLE DRYER ---

  drawDryer(ctx, d) {
    const { x, y, width, height, state, progress, totalTime, id } = d;
    ctx.save();
    ctx.translate(x, y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(width / 2, height - 2, width / 2 + 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Machine Main Body (Warm Cream / Coral)
    const bodyGrad = ctx.createLinearGradient(0, 0, width, height);
    bodyGrad.addColorStop(0, '#fff3ea');
    bodyGrad.addColorStop(0.4, '#ffe5d9');
    bodyGrad.addColorStop(1, '#ffcad4');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 12);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#f4a261';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Top control panel
    ctx.fillStyle = '#6b2d5c';
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, 22, 6);
    ctx.fill();

    // Machine number badge
    ctx.fillStyle = '#ffbe0b';
    ctx.font = 'bold 10px "Fredoka", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`D-${id}`, 8, 18);

    // LED Status Indicator
    let statusColor = '#06d6a0'; // Ready
    if (state === 'drying') statusColor = '#ff8e3c'; // Drying warm
    else if (state === 'done') statusColor = '#ffbe0b'; // Done

    ctx.fillStyle = statusColor;
    ctx.beginPath();
    ctx.arc(width - 12, 15, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Square / Round Glass Door
    const doorX = width / 2;
    const doorY = 56;
    const doorRadius = 24;

    ctx.fillStyle = '#d88373';
    ctx.beginPath();
    ctx.roundRect(doorX - doorRadius - 3, doorY - doorRadius - 3, (doorRadius + 3) * 2, (doorRadius + 3) * 2, 8);
    ctx.fill();

    // Inner drum
    ctx.fillStyle = state === 'drying' ? '#3d1308' : '#221518';
    ctx.beginPath();
    ctx.arc(doorX, doorY, doorRadius, 0, Math.PI * 2);
    ctx.fill();

    // Warm Interior Glow & Tumbling clothes
    if (state === 'drying') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(doorX, doorY, doorRadius - 1, 0, Math.PI * 2);
      ctx.clip();

      // Warm amber heat glow
      const heatGlow = ctx.createRadialGradient(doorX, doorY, 2, doorX, doorY, doorRadius);
      heatGlow.addColorStop(0, 'rgba(255, 142, 60, 0.8)');
      heatGlow.addColorStop(1, 'rgba(247, 127, 0, 0.2)');
      ctx.fillStyle = heatGlow;
      ctx.fillRect(doorX - doorRadius, doorY - doorRadius, doorRadius * 2, doorRadius * 2);

      // Tumble animation
      ctx.translate(doorX, doorY);
      ctx.rotate(-this.time * 6);
      ctx.fillStyle = '#ffbe0b';
      ctx.fillRect(-12, -8, 16, 12);
      ctx.fillStyle = '#e76f51';
      ctx.fillRect(0, 2, 14, 10);
      ctx.restore();
    } else if (state === 'done') {
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(doorX, doorY, doorRadius - 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d90429';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♨️', doorX, doorY + 5);
    }

    // Glass Reflection
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(doorX, doorY, doorRadius - 6, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();

    // Progress Bar
    if (state === 'drying') {
      const barW = width - 16;
      const barH = 5;
      const barX = 8;
      const barY = height - 10;
      const pct = Math.min(1, progress / totalTime);

      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 2);
      ctx.fill();

      ctx.fillStyle = '#ff8e3c';
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW * pct, barH, 2);
      ctx.fill();
    }

    if (state === 'done') {
      const bob = Math.sin(this.time * 6) * 3;
      ctx.fillStyle = '#ffbe0b';
      ctx.font = 'bold 12px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('♨️ DRY!', width / 2, -8 + bob);
    }

    ctx.restore();
  }

  // --- FOLDING TABLE ---

  drawFoldingTable(ctx, station) {
    const { x, y, width, height, isFolding, progress, totalTime, hasStack } = station;
    ctx.save();
    ctx.translate(x, y);

    // Table shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(width / 2, height + 4, width / 2 + 6, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden Table Top
    ctx.fillStyle = '#d4a373';
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 8);
    ctx.fill();

    // Wood rim
    ctx.fillStyle = '#bc6c25';
    ctx.fillRect(0, height - 6, width, 6);

    // Wooden Legs
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(6, height, 8, 18);
    ctx.fillRect(width - 14, height, 8, 18);

    // Ironing Pad / Mat
    ctx.fillStyle = '#e9ecef';
    ctx.beginPath();
    ctx.roundRect(8, 6, width - 16, height - 16, 4);
    ctx.fill();

    // Iron
    ctx.fillStyle = '#495057';
    ctx.beginPath();
    ctx.roundRect(width - 24, 10, 16, 12, 3);
    ctx.fill();
    ctx.fillStyle = '#ff006e';
    ctx.fillRect(width - 20, 8, 8, 3);

    // Clothes on table
    if (isFolding) {
      // Rapid rustle folding animation
      const wiggle = Math.sin(this.time * 20) * 3;
      ctx.fillStyle = '#3a86ff';
      ctx.fillRect(16 + wiggle, 10, 24, 16);
      ctx.fillStyle = '#ffbe0b';
      ctx.fillRect(20 - wiggle, 12, 20, 14);

      // Progress bar
      const pct = Math.min(1, progress / totalTime);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(8, height - 6, width - 16, 4);
      ctx.fillStyle = '#2ec4b6';
      ctx.fillRect(8, height - 6, (width - 16) * pct, 4);
    } else if (hasStack) {
      // Sparkling neat folded stack
      this.drawFoldedStack(ctx, 22, 10);
      const bob = Math.sin(this.time * 5) * 3;
      ctx.fillStyle = '#2ec4b6';
      ctx.font = 'bold 11px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✨ FOLDED!', width / 2, -6 + bob);
    } else {
      ctx.fillStyle = '#adb5bd';
      ctx.font = '600 10px "Nunito", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Folding Table', width / 2 - 6, 20);
    }

    ctx.restore();
  }

  // --- SOAP SUPPLY STATION ---

  drawSoapStation(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Shelf
    ctx.fillStyle = '#bc6c25';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(0, h - 4, w, 4);

    // Detergent Bottles
    // Blue Bottle
    ctx.fillStyle = '#3a86ff';
    ctx.beginPath();
    ctx.roundRect(6, 4, 14, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(8, 1, 10, 3); // cap

    // Purple Lavender Bottle
    ctx.fillStyle = '#8338ec';
    ctx.beginPath();
    ctx.roundRect(24, 4, 14, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(26, 1, 10, 3);

    // Sparkle Gold Bottle
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.roundRect(42, 4, 14, 20, 3);
    ctx.fill();
    ctx.fillStyle = '#ff006e';
    ctx.fillRect(44, 1, 10, 3);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOAP', w / 2, h + 12);

    ctx.restore();
  }

  // --- INTAKE & CHECKOUT COUNTER ---

  drawCounter(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(w / 2, h + 2, w / 2 + 4, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wooden Counter Front
    ctx.fillStyle = '#603813';
    ctx.beginPath();
    ctx.roundRect(0, 10, w, h - 10, 6);
    ctx.fill();

    // Wooden Top
    ctx.fillStyle = '#dda15e';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, 14, 4);
    ctx.fill();

    // Brass Service Bell
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.arc(16, 6, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#bc6c25';
    ctx.fillRect(15, 0, 2, 2);

    // Cash Register
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.roundRect(w - 32, -4, 26, 16, 3);
    ctx.fill();
    ctx.fillStyle = '#06d6a0';
    ctx.fillRect(w - 28, -2, 18, 5); // display

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CHECK-IN', w / 2, h / 2 + 10);

    ctx.restore();
  }

  // --- WAITING BENCH & ARCADE & PLANTS ---

  drawBench(ctx, b) {
    const { x, y, w, h } = b;
    ctx.save();
    ctx.translate(x, y);

    // Wooden Bench
    ctx.fillStyle = '#bc6c25';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 6);
    ctx.fill();
    ctx.fillStyle = '#8b4513';
    ctx.fillRect(4, h, 6, 12);
    ctx.fillRect(w - 10, h, 6, 12);

    // Cozy Seat Cushion
    ctx.fillStyle = '#2a9d8f';
    ctx.beginPath();
    ctx.roundRect(2, 2, w - 4, h - 4, 4);
    ctx.fill();

    ctx.restore();
  }

  drawArcade(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // Arcade Cabinet Body (Retro Purple/Teal)
    ctx.fillStyle = '#3a0ca3';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 8);
    ctx.fill();

    // Marquee
    ctx.fillStyle = '#ff006e';
    ctx.fillRect(4, 4, w - 8, 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TRASH INVADERS', w / 2, 12);

    // Screen (animated pixel glow)
    const screenGlow = Math.sin(this.time * 8) > 0 ? '#4cc9f0' : '#7209b7';
    ctx.fillStyle = '#0f111a';
    ctx.fillRect(6, 20, w - 12, 24);
    ctx.fillStyle = screenGlow;
    ctx.fillRect(10, 24, 8, 8);
    ctx.fillStyle = '#f72585';
    ctx.fillRect(w - 18, 30, 8, 8);

    // Joystick & Buttons
    ctx.fillStyle = '#f72585';
    ctx.beginPath();
    ctx.arc(14, 52, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4cc9f0';
    ctx.beginPath();
    ctx.arc(w - 14, 52, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawPlant(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Ceramic Terracotta Pot
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.moveTo(4, 18);
    ctx.lineTo(24, 18);
    ctx.lineTo(21, 32);
    ctx.lineTo(7, 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f4a261';
    ctx.fillRect(2, 14, 24, 5);

    // Lush Monstera Green Leaves
    const leafSway = Math.sin(this.time * 2) * 2;
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.ellipse(14 + leafSway, 8, 12, 8, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#40916c';
    ctx.beginPath();
    ctx.ellipse(20, 6 - leafSway, 10, 7, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#52b788';
    ctx.beginPath();
    ctx.ellipse(8, 10, 9, 6, -0.8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // --- BARNABY THE RACCOON (PLAYER) ---

  drawRaccoon(ctx, p) {
    const { x, y, vx, vy, facing, state, carrying, isZooming, hasSkates } = p;
    ctx.save();
    ctx.translate(x, y);

    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;
    const walkBob = isMoving ? Math.sin(this.time * 16) * 3 : 0;
    const tailWag = Math.sin(this.time * 10) * 0.25;

    // Zoomies speed dust / particle trail
    if (isZooming && isMoving) {
      ctx.fillStyle = 'rgba(255, 142, 60, 0.4)';
      ctx.beginPath();
      ctx.arc(-facing * 16, 12 + Math.random() * 4, 6 + Math.random() * 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(facing, 1); // Flip horizontally depending on facing direction

    // Striped Raccoon Tail
    ctx.save();
    ctx.translate(-10, 6 + walkBob);
    ctx.rotate(-0.4 + tailWag + (isMoving ? 0.3 : 0));
    // Tail base
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.ellipse(-8, 0, 14, 7, -0.2, 0, Math.PI * 2);
    ctx.fill();
    // Tail black stripes
    ctx.fillStyle = '#212529';
    ctx.fillRect(-16, -5, 5, 10);
    ctx.fillRect(-8, -6, 5, 12);
    ctx.fillRect(0, -6, 4, 12);
    ctx.restore();

    // Raccoon Feet / Roller Skates
    if (hasSkates) {
      // Roller skates
      ctx.fillStyle = '#ff006e';
      ctx.fillRect(-9, 14 + walkBob, 7, 5);
      ctx.fillRect(2, 14 - walkBob, 7, 5);
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(-7, 20 + walkBob, 2.5, 0, Math.PI * 2);
      ctx.arc(-2, 20 + walkBob, 2.5, 0, Math.PI * 2);
      ctx.arc(4, 20 - walkBob, 2.5, 0, Math.PI * 2);
      ctx.arc(9, 20 - walkBob, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Cute black paws
      ctx.fillStyle = '#212529';
      ctx.beginPath();
      ctx.ellipse(-6, 17 + walkBob, 4, 3, 0, 0, Math.PI * 2);
      ctx.ellipse(5, 17 - walkBob, 4, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Body (Round chubby gray torso with stylish orange laundromat apron)
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.ellipse(0, 4 + walkBob, 15, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Orange Launderette Apron
    ctx.fillStyle = '#ff8e3c';
    ctx.beginPath();
    ctx.roundRect(-10, -2 + walkBob, 20, 16, 4);
    ctx.fill();
    // Apron Pocket
    ctx.fillStyle = '#f77f00';
    ctx.fillRect(-6, 4 + walkBob, 12, 7);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('🧼', -4, 10 + walkBob);

    // Fluffy Head
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.ellipse(0, -12 + walkBob, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Fluffy White Cheeks
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(-10, -9 + walkBob, 6, 6, 0.3, 0, Math.PI * 2);
    ctx.ellipse(10, -9 + walkBob, 6, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();

    // Raccoon Ears
    ctx.fillStyle = '#495057';
    ctx.beginPath();
    ctx.ellipse(-10, -22 + walkBob, 5, 6, -0.4, 0, Math.PI * 2);
    ctx.ellipse(10, -22 + walkBob, 5, 6, 0.4, 0, Math.PI * 2);
    ctx.fill();
    // Ear Inner Pink
    ctx.fillStyle = '#ffcad4';
    ctx.beginPath();
    ctx.ellipse(-10, -21 + walkBob, 3, 4, -0.4, 0, Math.PI * 2);
    ctx.ellipse(10, -21 + walkBob, 3, 4, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Iconic Raccoon Bandit Eye Mask
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.ellipse(-6, -13 + walkBob, 6, 4.5, -0.15, 0, Math.PI * 2);
    ctx.ellipse(6, -13 + walkBob, 6, 4.5, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Cute Shiny Eyes
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5, -14 + walkBob, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -14 + walkBob, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Pupils
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(-4.5, -14 + walkBob, 1.4, 0, Math.PI * 2);
    ctx.arc(6.5, -14 + walkBob, 1.4, 0, Math.PI * 2);
    ctx.fill();
    // Eye sparkle
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-5.2, -14.8 + walkBob, 0.8, 0, Math.PI * 2);
    ctx.arc(5.8, -14.8 + walkBob, 0.8, 0, Math.PI * 2);
    ctx.fill();

    // Cute Pink Snout & Nose
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(0, -8 + walkBob, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff758f';
    ctx.beginPath();
    ctx.arc(0, -9 + walkBob, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Whiskers
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, -8 + walkBob);
    ctx.lineTo(12, -7 + walkBob);
    ctx.moveTo(4, -6 + walkBob);
    ctx.lineTo(13, -4 + walkBob);
    ctx.stroke();

    // Carrying Item Animation (Laundry Basket, Folded Clothes, or Soap)
    if (carrying) {
      ctx.save();
      ctx.translate(6, -2 + walkBob);
      if (carrying.type === 'dirty_basket') {
        this.drawBasket(ctx, 0, 0, 'dirty');
      } else if (carrying.type === 'clean_wet_basket') {
        this.drawBasket(ctx, 0, 0, 'wet');
      } else if (carrying.type === 'dry_basket') {
        this.drawBasket(ctx, 0, 0, 'dry');
      } else if (carrying.type === 'folded_clothes') {
        this.drawFoldedStack(ctx, -8, -14);
      } else if (carrying.type === 'soap') {
        this.drawSoapBottle(ctx, 0, -10, carrying.soapType || 'regular');
      }
      ctx.restore();

      // Front Paws holding the item
      ctx.fillStyle = '#212529';
      ctx.beginPath();
      ctx.arc(2, 0 + walkBob, 3.5, 0, Math.PI * 2);
      ctx.arc(10, 0 + walkBob, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Idle / Walking Paws
      ctx.fillStyle = '#212529';
      const armSwing = Math.sin(this.time * 16) * 4;
      ctx.beginPath();
      ctx.arc(8, 2 + walkBob + armSwing, 3.5, 0, Math.PI * 2);
      ctx.arc(-8, 2 + walkBob - armSwing, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // --- HIRED CRITTER EMPLOYEES ---

  drawHelperRaccoon(ctx, h) {
    this.drawHiredEmployee(ctx, h);
  }

  drawHiredEmployee(ctx, h) {
    const { x, y, vx, vy, facing, carrying, species = 'raccoon', name = 'Pip' } = h;
    ctx.save();
    ctx.translate(x, y);

    const isMoving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;
    const walkBob = isMoving ? Math.sin(this.time * 18) * 2.5 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(facing, 1);

    // Body colors & features by species
    let furColor = '#868e96';
    let earColor = '#495057';
    let apronColor = '#2ec4b6';

    if (species === 'bunny') {
      furColor = '#f8f9fa';
      earColor = '#ffb5a7';
      apronColor = '#06d6a0';
    } else if (species === 'bear') {
      furColor = '#7f4f24';
      earColor = '#582f0e';
      apronColor = '#e76f51';
    } else if (species === 'fox') {
      furColor = '#e76f51';
      earColor = '#264653';
      apronColor = '#ffbe0b';
    } else if (species === 'capybara') {
      furColor = '#a06b3a';
      earColor = '#6e441f';
      apronColor = '#3a86ff';
    } else if (species === 'owl') {
      furColor = '#b5838d';
      earColor = '#6d6875';
      apronColor = '#8338ec';
    }

    // Tail (if raccoon or fox)
    if (species === 'raccoon' || species === 'fox') {
      ctx.fillStyle = furColor;
      ctx.beginPath();
      ctx.ellipse(-8, 4 + walkBob, 10, 5, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#212529';
      ctx.fillRect(-12, 0, 4, 8);
    }

    // Body
    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(0, 3 + walkBob, 11, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Employee Apron / Uniform
    ctx.fillStyle = apronColor;
    ctx.beginPath();
    ctx.moveTo(-7, -4 + walkBob);
    ctx.lineTo(7, -4 + walkBob);
    ctx.lineTo(5, 10 + walkBob);
    ctx.lineTo(-5, 10 + walkBob);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Head
    ctx.fillStyle = furColor;
    ctx.beginPath();
    ctx.ellipse(0, -9 + walkBob, 10, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ears depending on species
    if (species === 'bunny') {
      // Long Bunny Ears
      ctx.fillStyle = furColor;
      ctx.beginPath();
      ctx.ellipse(-5, -22 + walkBob, 3, 9, -0.15, 0, Math.PI * 2);
      ctx.ellipse(5, -22 + walkBob, 3, 9, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.ellipse(-5, -22 + walkBob, 1.5, 6, -0.15, 0, Math.PI * 2);
      ctx.ellipse(5, -22 + walkBob, 1.5, 6, 0.15, 0, Math.PI * 2);
      ctx.fill();
    } else if (species === 'owl') {
      // Owl Feathers / Spectacles
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.arc(-7, -15 + walkBob, 3, 0, Math.PI * 2);
      ctx.arc(7, -15 + walkBob, 3, 0, Math.PI * 2);
      ctx.fill();
      // Glasses
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(-4, -10 + walkBob, 3.5, 0, Math.PI * 2);
      ctx.arc(4, -10 + walkBob, 3.5, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Round or pointy ears
      ctx.fillStyle = earColor;
      ctx.beginPath();
      ctx.arc(-7, -17 + walkBob, 4, 0, Math.PI * 2);
      ctx.arc(7, -17 + walkBob, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes & Face details
    if (species === 'raccoon') {
      ctx.fillStyle = '#212529';
      ctx.fillRect(-7, -12 + walkBob, 14, 5);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-4, -10 + walkBob, 2, 0, Math.PI * 2);
    ctx.arc(4, -10 + walkBob, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-3.5, -10 + walkBob, 1, 0, Math.PI * 2);
    ctx.arc(4.5, -10 + walkBob, 1, 0, Math.PI * 2);
    ctx.fill();

    // Cute Helper Badge
    ctx.fillStyle = '#ffbe0b';
    ctx.font = 'bold 9px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⭐ ${name}`, 0, -22);

    // Carrying item
    if (carrying) {
      ctx.save();
      ctx.translate(4, -4 + walkBob);
      if (carrying.type === 'folded_clothes') {
        this.drawFoldedStack(ctx, -6, -10);
      } else if (carrying.type === 'dry_basket') {
        this.drawBasket(ctx, 0, 0, 'dry');
      } else if (carrying.type === 'clean_wet_basket') {
        this.drawBasket(ctx, 0, 0, 'wet');
      } else if (carrying.type === 'dirty_basket') {
        this.drawBasket(ctx, 0, 0, 'dirty');
      } else if (carrying.type === 'soap') {
        this.drawSoapBottle(ctx, 0, -6, carrying.soapType || 'regular');
      }
      ctx.restore();
    }

    ctx.restore();
  }

  // --- ANIMAL CUSTOMERS ---

  drawCustomer(ctx, c) {
    const { x, y, type, state, patience, maxPatience, mood, requestedBasket, facing } = c;
    ctx.save();
    ctx.translate(x, y);

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 16, 15, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.scale(facing || 1, 1);

    // Draw specific animal species
    switch (type) {
      case 'bear':
        this.drawBear(ctx);
        break;
      case 'fox':
        this.drawFox(ctx);
        break;
      case 'owl':
        this.drawOwl(ctx);
        break;
      case 'bunny':
        this.drawBunny(ctx);
        break;
      case 'capybara':
        this.drawCapybara(ctx);
        break;
      case 'possum':
        this.drawPossum(ctx);
        break;
      default:
        this.drawBunny(ctx);
    }

    // Reset scale for overhead HUD / speech bubble
    ctx.scale(facing || 1, 1);

    // Overhead Status Bubble
    const bubbleY = -36 + Math.sin(this.time * 4) * 2;
    this.drawSpeechBubble(ctx, 0, bubbleY, state, patience, maxPatience, requestedBasket);

    ctx.restore();
  }

  // Specific Animal Drawers
  drawBear(ctx) {
    // Bramble the Bear
    ctx.fillStyle = '#6f4e37';
    ctx.beginPath();
    ctx.ellipse(0, 2, 17, 16, 0, 0, Math.PI * 2); // body
    ctx.fill();
    // Yellow Honey Sweater
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.roundRect(-12, -4, 24, 14, 6);
    ctx.fill();
    // Head & Ears
    ctx.fillStyle = '#6f4e37';
    ctx.beginPath();
    ctx.arc(0, -14, 13, 0, Math.PI * 2);
    ctx.arc(-11, -24, 5, 0, Math.PI * 2);
    ctx.arc(11, -24, 5, 0, Math.PI * 2);
    ctx.fill();
    // Muzzle & Eyes
    ctx.fillStyle = '#d4a373';
    ctx.beginPath();
    ctx.ellipse(0, -10, 7, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(0, -12, 2.5, 0, Math.PI * 2);
    ctx.arc(-5, -16, 1.8, 0, Math.PI * 2);
    ctx.arc(5, -16, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  drawFox(ctx) {
    // Fiona the Fox
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.ellipse(0, 3, 13, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    // Fluffy White Chest
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, 4, 7, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // Big Bushy Tail
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.ellipse(-14, 2, 12, 7, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-22, -1, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head & Pointy Ears
    ctx.fillStyle = '#e76f51';
    ctx.beginPath();
    ctx.arc(0, -12, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-9, -16);
    ctx.lineTo(-13, -28);
    ctx.lineTo(-2, -20);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -16);
    ctx.lineTo(13, -28);
    ctx.lineTo(2, -20);
    ctx.fill();
    // Snout & Eyes
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(0, -9, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(0, -10, 1.8, 0, Math.PI * 2);
    ctx.arc(-4, -14, 1.6, 0, Math.PI * 2);
    ctx.arc(4, -14, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  drawOwl(ctx) {
    // Oliver the Owl
    ctx.fillStyle = '#582f0e';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    // Feather belly
    ctx.fillStyle = '#ddb892';
    ctx.beginPath();
    ctx.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Feather tufts / ears
    ctx.fillStyle = '#582f0e';
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(-14, -25);
    ctx.lineTo(-4, -18);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, -14);
    ctx.lineTo(14, -25);
    ctx.lineTo(4, -18);
    ctx.fill();
    // Big Round Eyes & Tiny Glasses
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.arc(-6, -10, 5.5, 0, Math.PI * 2);
    ctx.arc(6, -10, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-5.5, -10, 2.5, 0, Math.PI * 2);
    ctx.arc(5.5, -10, 2.5, 0, Math.PI * 2);
    ctx.fill();
    // Gold Glasses Wire
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(-6, -10, 6, 0, Math.PI * 2);
    ctx.arc(6, -10, 6, 0, Math.PI * 2);
    ctx.moveTo(0, -10);
    ctx.lineTo(0, -10);
    ctx.stroke();
    // Beak
    ctx.fillStyle = '#f77f00';
    ctx.beginPath();
    ctx.moveTo(-2, -7);
    ctx.lineTo(2, -7);
    ctx.lineTo(0, -3);
    ctx.closePath();
    ctx.fill();
  }

  drawBunny(ctx) {
    // Pippin the Bunny
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(0, 4, 13, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Pastel Teal Hoodie
    ctx.fillStyle = '#2ec4b6';
    ctx.beginPath();
    ctx.roundRect(-10, -2, 20, 14, 5);
    ctx.fill();
    // Head & Tall Floppy Ears
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.arc(0, -12, 11, 0, Math.PI * 2);
    ctx.fill();
    // Ears
    ctx.beginPath();
    ctx.ellipse(-6, -26, 4.5, 11, -0.15, 0, Math.PI * 2);
    ctx.ellipse(6, -26, 4.5, 11, 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffcad4';
    ctx.beginPath();
    ctx.ellipse(-6, -26, 2.5, 8, -0.15, 0, Math.PI * 2);
    ctx.ellipse(6, -26, 2.5, 8, 0.15, 0, Math.PI * 2);
    ctx.fill();
    // Face
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(-4, -13, 1.6, 0, Math.PI * 2);
    ctx.arc(4, -13, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff758f';
    ctx.beginPath();
    ctx.arc(0, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCapybara(ctx) {
    // Capy the Capybara (Ultra Zen)
    ctx.fillStyle = '#a06cd5';
    // Body
    ctx.fillStyle = '#b08968';
    ctx.beginPath();
    ctx.ellipse(0, 3, 16, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // Big Boxy Head
    ctx.fillStyle = '#7f5539';
    ctx.beginPath();
    ctx.roundRect(-12, -22, 24, 18, 6);
    ctx.fill();
    // Tiny Zen Eyes (happy slits)
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-6, -15, 3, Math.PI, 0);
    ctx.arc(6, -15, 3, Math.PI, 0);
    ctx.stroke();
    // Tiny Yuzu / Orange on head!
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.arc(0, -25, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#38b000';
    ctx.fillRect(-1, -29, 2, 3);
  }

  drawPossum(ctx) {
    // Jasper the Possum
    ctx.fillStyle = '#adb5bd';
    ctx.beginPath();
    ctx.ellipse(0, 3, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head & White Face
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.arc(0, -11, 10, 0, Math.PI * 2);
    ctx.fill();
    // Black Ears
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(-8, -20, 4, 0, Math.PI * 2);
    ctx.arc(8, -20, 4, 0, Math.PI * 2);
    ctx.fill();
    // Pink Nose & Eyes
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.arc(-4, -12, 1.8, 0, Math.PI * 2);
    ctx.arc(4, -12, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff758f';
    ctx.beginPath();
    ctx.arc(0, -8, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- SPEECH & STATUS BUBBLE ---

  drawSpeechBubble(ctx, x, y, state, patience, maxPatience, requestedBasket) {
    ctx.save();
    ctx.translate(x, y);

    const bw = 38;
    const bh = 28;

    // Bubble Body
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(-bw / 2, -bh / 2, bw, bh, 8);
    ctx.fill();
    ctx.strokeStyle = '#343a40';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Little tail
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.moveTo(-4, bh / 2 - 1);
    ctx.lineTo(0, bh / 2 + 5);
    ctx.lineTo(4, bh / 2 - 1);
    ctx.fill();

    // Inner Icon depending on state
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    if (state === 'entering' || state === 'waiting_intake') {
      ctx.font = '14px sans-serif';
      ctx.fillText('🧺', 0, 4);
    } else if (state === 'waiting_wash') {
      ctx.font = '12px sans-serif';
      ctx.fillText('⏳🫧', 0, 4);
    } else if (state === 'ready_for_pickup') {
      ctx.font = '14px sans-serif';
      ctx.fillText('✨👕', 0, 4);
    } else if (state === 'happy_leaving') {
      ctx.font = '14px sans-serif';
      ctx.fillText('💖🪙', 0, 4);
    }

    // Patience indicator ring around the bubble
    if (patience !== undefined && maxPatience !== undefined && state !== 'happy_leaving') {
      const pct = Math.max(0, patience / maxPatience);
      let ringColor = '#06d6a0'; // green
      if (pct < 0.3) ringColor = '#d90429'; // red
      else if (pct < 0.6) ringColor = '#ffbe0b'; // yellow

      ctx.strokeStyle = ringColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(bw / 2 - 2, -bh / 2 + 2, 4.5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * pct));
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- ITEM GRAPHICS ---

  drawBasket(ctx, x, y, state = 'dirty') {
    ctx.save();
    ctx.translate(x, y);

    // Basket wicker weave
    ctx.fillStyle = '#d4a373';
    ctx.beginPath();
    ctx.moveTo(-10, -2);
    ctx.lineTo(10, -2);
    ctx.lineTo(8, 10);
    ctx.lineTo(-8, 10);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#bc6c25';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Clothes overflowing
    if (state === 'dirty') {
      ctx.fillStyle = '#8d99ae';
      ctx.beginPath();
      ctx.arc(0, -4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b705c';
      ctx.fillRect(-6, -8, 12, 5);
      // Mud speck
      ctx.fillStyle = '#582f0e';
      ctx.beginPath();
      ctx.arc(-2, -5, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (state === 'wet') {
      ctx.fillStyle = '#48cae4';
      ctx.beginPath();
      ctx.arc(0, -4, 7, 0, Math.PI * 2);
      ctx.fill();
      // Water droplet
      ctx.fillStyle = '#0077b6';
      ctx.beginPath();
      ctx.arc(2, -6, 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (state === 'dry') {
      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(0, -4, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fb8500';
      ctx.fillRect(-5, -7, 10, 4);
    }

    ctx.restore();
  }

  drawFoldedStack(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Neat layered folded pastel shirts
    const colors = ['#3a86ff', '#ff006e', '#ffbe0b', '#2ec4b6'];
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = colors[i];
      ctx.beginPath();
      ctx.roundRect(-10, 8 - (i * 5), 20, 5, 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Sparkle star on top
    const starBob = Math.sin(this.time * 8) * 2;
    ctx.fillStyle = '#ffd166';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('✨', 0, -12 + starBob);

    ctx.restore();
  }

  drawSoapBottle(ctx, x, y, soapType) {
    ctx.save();
    ctx.translate(x, y);

    let color = '#3a86ff';
    if (soapType === 'lavender') color = '#8338ec';
    if (soapType === 'glitter') color = '#ffbe0b';

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-6, -10, 12, 16, 3);
    ctx.fill();

    ctx.fillStyle = '#fff';
    ctx.fillRect(-3, -13, 6, 3); // cap

    ctx.restore();
  }

  // --- PARTICLES & POPPING BUBBLES ---

  drawFloatingBubble(ctx, b) {
    const { x, y, radius, color } = b;
    ctx.save();
    ctx.translate(x, y);

    // Iridescent soap bubble
    const grad = ctx.createRadialGradient(
      -radius * 0.3, -radius * 0.3, radius * 0.1,
      0, 0, radius
    );
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.5, color || 'rgba(72, 202, 228, 0.4)');
    grad.addColorStop(0.85, 'rgba(255, 0, 110, 0.3)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.7)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();

    // Bubble highlight reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(-radius * 0.4, -radius * 0.4, radius * 0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawCoinParticle(ctx, p) {
    const { x, y, text, alpha, scale } = p;
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.scale(scale || 1, scale || 1);

    ctx.fillStyle = '#ffbe0b';
    ctx.font = 'bold 14px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 3;
    ctx.strokeText(text, 0, 0);
    ctx.fillText(text, 0, 0);

    ctx.restore();
  }

  // --- LAYOUT EDITOR & DECOR RENDERING ---

  drawBlueprintGrid(ctx, width, height, snapSize = 20) {
    ctx.save();
    
    // Grid Lines on floor area
    const startY = 118;
    ctx.lineWidth = 1;

    // Minor grid
    ctx.strokeStyle = 'rgba(46, 196, 182, 0.18)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += snapSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y <= height; y += snapSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major grid (every 100px)
    ctx.strokeStyle = 'rgba(255, 142, 60, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 100) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, height);
    }
    for (let y = startY; y <= height; y += 100) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Blueprint Header Banner
    ctx.fillStyle = 'rgba(15, 13, 26, 0.85)';
    ctx.fillRect(width / 2 - 220, 10, 440, 32);
    ctx.strokeStyle = '#ff8e3c';
    ctx.lineWidth = 2;
    ctx.strokeRect(width / 2 - 220, 10, 440, 32);

    ctx.fillStyle = '#ffbe0b';
    ctx.font = 'bold 13px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('📐 REMODEL MODE: DRAG & DROP ANY MACHINE OR FURNITURE', width / 2, 31);

    ctx.restore();
  }

  drawSelectionBox(ctx, x, y, width, height, isValid = true, isDragging = false, label = '') {
    ctx.save();
    ctx.translate(x, y);

    const color = isValid ? (isDragging ? '#ffbe0b' : '#2ec4b6') : '#e63946';

    // Bounding Box Fill
    ctx.fillStyle = isValid ? 'rgba(46, 196, 182, 0.18)' : 'rgba(230, 57, 70, 0.25)';
    ctx.fillRect(-4, -4, width + 8, height + 8);

    // Dashed border
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(-4, -4, width + 8, height + 8);
    ctx.setLineDash([]);

    // Corner Handles
    ctx.fillStyle = color;
    const hs = 6;
    ctx.fillRect(-6, -6, hs, hs);
    ctx.fillRect(width, -6, hs, hs);
    ctx.fillRect(-6, height, hs, hs);
    ctx.fillRect(width, height, hs, hs);

    // Label Badge
    if (label) {
      ctx.fillStyle = 'rgba(20, 17, 34, 0.9)';
      ctx.fillRect(width / 2 - 40, -22, 80, 16);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.strokeRect(width / 2 - 40, -22, 80, 16);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, width / 2, -10);
    }

    ctx.restore();
  }

  drawCustomRug(ctx, rug) {
    const { x, y, w, h, style } = rug;
    ctx.save();
    ctx.translate(x, y);

    let mainColor = '#e76f51';
    let innerColor = '#264653';
    let borderColor = '#f4a261';

    if (style === 'teal') {
      mainColor = '#2a9d8f';
      innerColor = '#e9c46a';
      borderColor = '#d8f3dc';
    } else if (style === 'pink') {
      mainColor = '#ff006e';
      innerColor = '#8338ec';
      borderColor = '#ffbe0b';
    }

    // Outer Mat
    ctx.fillStyle = mainColor;
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Inner Pattern
    ctx.fillStyle = innerColor;
    ctx.beginPath();
    ctx.roundRect(10, 10, w - 20, h - 20, 8);
    ctx.fill();

    // Corner Tassels
    ctx.fillStyle = borderColor;
    ctx.fillRect(-3, -2, 6, 4);
    ctx.fillRect(w - 3, -2, 6, 4);
    ctx.fillRect(-3, h - 2, 6, 4);
    ctx.fillRect(w - 3, h - 2, 6, 4);

    ctx.restore();
  }

  drawDecorItem(ctx, decor) {
    const { x, y, decorType } = decor;
    ctx.save();
    ctx.translate(x, y);

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(14, 28, 12, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    if (decorType === 'monstera') {
      this.drawPlant(ctx, 0, 0);
    } else if (decorType === 'cactus') {
      // Terracotta Pot
      ctx.fillStyle = '#bc6c25';
      ctx.beginPath();
      ctx.moveTo(4, 18);
      ctx.lineTo(24, 18);
      ctx.lineTo(21, 30);
      ctx.lineTo(7, 30);
      ctx.closePath();
      ctx.fill();
      // Round Saguaro Cactus
      ctx.fillStyle = '#2d6a4f';
      ctx.beginPath();
      ctx.ellipse(14, 10, 8, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      // Tiny Pink Flower on top
      ctx.fillStyle = '#ff006e';
      ctx.beginPath();
      ctx.arc(14, -2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (decorType === 'coffee') {
      // Coffee Machine Body
      ctx.fillStyle = '#d90429';
      ctx.beginPath();
      ctx.roundRect(2, 4, 24, 26, 4);
      ctx.fill();
      ctx.fillStyle = '#2b2d42';
      ctx.fillRect(6, 12, 16, 12);
      // Coffee Pot
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.roundRect(8, 14, 12, 10, 2);
      ctx.fill();
      // Steam
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.font = '8px sans-serif';
      ctx.fillText('♨️', 10, 2);
    } else if (decorType === 'bubble_lamp') {
      // Floor Lamp Stand
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(13, 8, 3, 22);
      ctx.beginPath();
      ctx.arc(14, 30, 8, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Bubble Glass Top
      const lampGlow = ctx.createRadialGradient(14, 6, 2, 14, 6, 14);
      lampGlow.addColorStop(0, '#ffbe0b');
      lampGlow.addColorStop(0.5, 'rgba(72, 202, 228, 0.8)');
      lampGlow.addColorStop(1, 'rgba(255, 0, 110, 0.4)');
      ctx.fillStyle = lampGlow;
      ctx.beginPath();
      ctx.arc(14, 6, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawDroppedItem(ctx, item) {
    const { x, y, type, soapType } = item;
    ctx.save();
    ctx.translate(x, y);

    // Subtle pulsing ring on floor
    const pulse = (Math.sin(this.time * 6) + 1) * 0.15 + 0.3;
    ctx.fillStyle = `rgba(255, 190, 11, ${pulse * 0.3})`;
    ctx.beginPath();
    ctx.ellipse(0, 6, 16, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (type === 'soap') {
      this.drawSoapBottle(ctx, 0, 0, soapType || 'regular');
    } else if (type === 'dirty_basket') {
      this.drawBasket(ctx, 0, 0, 'dirty');
    } else if (type === 'clean_wet_basket') {
      this.drawBasket(ctx, 0, 0, 'wet');
    } else if (type === 'dry_basket') {
      this.drawBasket(ctx, 0, 0, 'dry');
    } else if (type === 'folded_clothes') {
      this.drawFoldedStack(ctx, 0, 0);
    }

    ctx.restore();
  }
}

window.SpriteRenderer = SpriteRenderer;
