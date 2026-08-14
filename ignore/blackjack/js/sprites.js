/**
 * Two Raccoons in a Trench Coat: High-Stakes Blackjack
 * Procedural Vector Renderer for Dealer Raccoons, Casino Guests, Felt Table, and Cards
 */

class CasinoRenderer {
  constructor() {
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
  }

  // --- CASINO FELT TABLE & BACKGROUND ---

  drawCasinoRoom(ctx, width, height) {
    // 1. Speakeasy Wall Background
    const wallGrad = ctx.createLinearGradient(0, 0, 0, height * 0.45);
    wallGrad.addColorStop(0, '#0a1611');
    wallGrad.addColorStop(0.7, '#0f241a');
    wallGrad.addColorStop(1, '#183829');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height * 0.45);

    // Wall Moldings & Velvet Drapery
    ctx.strokeStyle = 'rgba(255, 190, 11, 0.2)';
    ctx.lineWidth = 2;
    ctx.strokeRect(40, 20, width - 80, height * 0.35);

    // Golden Chandelier Glows
    this.drawChandelier(ctx, width * 0.22, 25);
    this.drawChandelier(ctx, width * 0.78, 25);

    // 2. Blackjack Table Mahogany Outer Rail
    const tableCenterX = width / 2;
    const tableCenterY = height * 0.38;
    const tableRadiusX = width * 0.52;
    const tableRadiusY = height * 0.58;

    ctx.save();
    // Drop shadow under rail
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;

    ctx.fillStyle = '#3a1a0b'; // Rich Mahogany
    ctx.beginPath();
    ctx.ellipse(tableCenterX, tableCenterY, tableRadiusX, tableRadiusY, 0, 0, Math.PI);
    ctx.fill();
    ctx.restore();

    // Wood Grain Inlay Rim
    ctx.strokeStyle = '#5a2d16';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.ellipse(tableCenterX, tableCenterY, tableRadiusX - 10, tableRadiusY - 10, 0, 0, Math.PI);
    ctx.stroke();

    // 3. Emerald Velvet Felt Surface
    ctx.save();
    const feltGrad = ctx.createRadialGradient(
      tableCenterX, tableCenterY + 40, 20,
      tableCenterX, tableCenterY + 60, tableRadiusX - 25
    );
    feltGrad.addColorStop(0, '#135c3b');
    feltGrad.addColorStop(0.65, '#0d4229');
    feltGrad.addColorStop(1, '#072416');
    ctx.fillStyle = feltGrad;

    ctx.beginPath();
    ctx.ellipse(tableCenterX, tableCenterY, tableRadiusX - 22, tableRadiusY - 22, 0, 0, Math.PI);
    ctx.fill();

    // Gold Embossed Table Arc & Rules Text
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.45)';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.ellipse(tableCenterX, tableCenterY, tableRadiusX * 0.75, tableRadiusY * 0.72, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.setLineDash([]);

    // Table Markings Text
    ctx.fillStyle = 'rgba(255, 215, 0, 0.75)';
    ctx.font = 'bold 13px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ BLACKJACK PAYS 3 TO 2 ★', tableCenterX, tableCenterY + 115);

    ctx.font = 'bold 11px "Nunito", sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.fillText('Dealer must stand on 17 and draw to 16 • Insurance Pays 2 to 1', tableCenterX, tableCenterY + 138);

    // 4. Brass Card Shoe & Chip Tray
    this.drawCardShoe(ctx, width * 0.82, tableCenterY + 10);
    this.drawChipTray(ctx, width * 0.16, tableCenterY + 10);

    ctx.restore();
  }

  drawChandelier(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Warm Ambient Light Halo
    const glow = ctx.createRadialGradient(0, 30, 5, 0, 30, 60);
    glow.addColorStop(0, 'rgba(255, 215, 0, 0.35)');
    glow.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 30, 60, 0, Math.PI * 2);
    ctx.fill();

    // Brass Fixture & Crystals
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-15, 0, 30, 6);
    ctx.fillRect(-2, 6, 4, 18);
    ctx.beginPath();
    ctx.moveTo(-20, 24);
    ctx.lineTo(20, 24);
    ctx.lineTo(0, 42);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawCardShoe(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Angled Blackjack Acrylic/Brass Shoe
    ctx.fillStyle = '#1e1e24';
    ctx.beginPath();
    ctx.roundRect(-25, -20, 50, 40, 6);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Red Deck Sides Visible in Shoe
    ctx.fillStyle = '#d90429';
    ctx.fillRect(-18, -12, 36, 24);
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(-18, 8, 36, 4);

    ctx.restore();
  }

  drawChipTray(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Multi-row metallic chip rack
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.roundRect(-30, -18, 60, 36, 4);
    ctx.fill();
    ctx.strokeStyle = '#d4af37';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Red, Green, Black Chip stacks
    const colors = ['#d90429', '#2a9d8f', '#101010', '#ffd166'];
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 5; row++) {
        ctx.fillStyle = colors[col];
        ctx.beginPath();
        ctx.ellipse(-20 + col * 13, 10 - row * 4, 5, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // --- THE DEALER: TWO RACCOONS IN A TRENCH COAT ---

  drawTwoRaccoonsDealer(ctx, x, y, state) {
    const {
      wobbleAngle = 0,
      mustacheLoose = false,
      tailVisible = false,
      isCheating = false,
      isPocketing = false,
      equippedGear = {}
    } = state;

    ctx.save();
    ctx.translate(x, y);

    // Apply Trench Coat Balance Wobble
    ctx.rotate(wobbleAngle);

    // Subtle breathing animation
    const breath = Math.sin(this.time * 3) * 2;

    // --- BOTTOM RACCOON (Barnaby Jr.) & COAT LOWER HALF ---

    // 1. Two Human Dress Shoes
    ctx.fillStyle = '#101014';
    ctx.beginPath();
    ctx.roundRect(-38, 145, 30, 16, 8); // Left Shoe
    ctx.roundRect(8, 145, 30, 16, 8);  // Right Shoe
    ctx.fill();
    // Shoe buckles
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-30, 148, 12, 3);
    ctx.fillRect(16, 148, 12, 3);

    // 2. Wagging Raccoon Tail (Behind Trench Coat Vent)
    if (tailVisible) {
      const tailWag = Math.sin(this.time * 12) * 18;
      ctx.save();
      ctx.translate(28, 120);
      ctx.rotate((tailWag * Math.PI) / 180);

      // Fluffy Striped Tail
      ctx.fillStyle = '#495057';
      ctx.beginPath();
      ctx.ellipse(25, 0, 32, 14, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Black Rings
      ctx.fillStyle = '#212529';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(8 + i * 10, -10, 5, 20);
      }
      ctx.restore();
    }

    // 3. Bulky Tan Trench Coat Lower Section
    ctx.fillStyle = '#c5a059'; // Classic Trench Wool Tan
    ctx.beginPath();
    ctx.moveTo(-55, 30);
    ctx.lineTo(55, 30);
    ctx.lineTo(65, 140);
    ctx.lineTo(-65, 140);
    ctx.closePath();
    ctx.fill();

    // Coat Fold Shadows & Pocket Slits
    ctx.strokeStyle = '#9c7a36';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.lineTo(5, 140); // Center seam
    ctx.moveTo(-45, 80);
    ctx.lineTo(-20, 85); // Left pocket
    ctx.moveTo(20, 85);
    ctx.lineTo(45, 80);  // Right pocket
    ctx.stroke();

    // Pockets with Shiny Gold Chips poking out
    if (isPocketing || state.pocketCount > 0) {
      ctx.fillStyle = '#ffbe0b';
      ctx.beginPath();
      ctx.arc(32, 78, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Belt & Brass Buckle around the middle
    ctx.fillStyle = '#8b6528';
    ctx.fillRect(-58, 25, 116, 12);
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-12, 21, 24, 20);
    ctx.fillStyle = '#8b6528';
    ctx.fillRect(-6, 25, 12, 12);

    // --- TOP RACCOON (Reggie) & COAT UPPER HALF ---

    // 4. Upper Trench Coat Lapels & Shoulders
    ctx.fillStyle = '#c5a059';
    ctx.beginPath();
    ctx.roundRect(-60, -50 + breath, 120, 80, 16);
    ctx.fill();

    // Dark Lapels & Silk Tie
    ctx.fillStyle = '#1e3d59'; // Navy Silk Tie
    ctx.beginPath();
    ctx.moveTo(-8, -25 + breath);
    ctx.lineTo(8, -25 + breath);
    ctx.lineTo(12, 25 + breath);
    ctx.lineTo(0, 32 + breath);
    ctx.lineTo(-12, 25 + breath);
    ctx.closePath();
    ctx.fill();

    // Large Tan Lapels
    ctx.fillStyle = '#d4b06a';
    ctx.beginPath();
    ctx.moveTo(-40, -45 + breath);
    ctx.lineTo(-10, -5 + breath);
    ctx.lineTo(-28, 15 + breath);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(40, -45 + breath);
    ctx.lineTo(10, -5 + breath);
    ctx.lineTo(28, 15 + breath);
    ctx.closePath();
    ctx.fill();

    // Shiny Double-Breasted Horn Buttons
    ctx.fillStyle = '#2b1e16';
    ctx.beginPath();
    ctx.arc(-22, -10 + breath, 5, 0, Math.PI * 2);
    ctx.arc(22, -10 + breath, 5, 0, Math.PI * 2);
    ctx.arc(-20, 12 + breath, 5, 0, Math.PI * 2);
    ctx.arc(20, 12 + breath, 5, 0, Math.PI * 2);
    ctx.fill();

    // 5. Reggie's Raccoon Head peeking out of Oversized Collar
    ctx.save();
    ctx.translate(0, -65 + breath);

    // Raccoon Ears
    ctx.fillStyle = '#343a40';
    ctx.beginPath();
    ctx.ellipse(-26, -20, 12, 16, -0.3, 0, Math.PI * 2);
    ctx.ellipse(26, -20, 12, 16, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(-26, -20, 6, 10, -0.3, 0, Math.PI * 2);
    ctx.ellipse(26, -20, 6, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Main Face Fur
    ctx.fillStyle = '#6c757d';
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 26, 0, 0, Math.PI * 2);
    ctx.fill();

    // White Cheeks & Brow
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(-16, 8, 14, 12, -0.2, 0, Math.PI * 2);
    ctx.ellipse(16, 8, 14, 12, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Bandit Mask across eyes
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.ellipse(-14, -2, 12, 9, -0.15, 0, Math.PI * 2);
    ctx.ellipse(14, -2, 12, 9, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Shiny Eyes
    ctx.fillStyle = '#ffbe0b';
    ctx.beginPath();
    ctx.arc(-14, -2, 3.5, 0, Math.PI * 2);
    ctx.arc(14, -2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-13, -3, 1.2, 0, Math.PI * 2);
    ctx.arc(15, -3, 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Snout & Button Nose
    ctx.fillStyle = '#f8f9fa';
    ctx.beginPath();
    ctx.ellipse(0, 10, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#101014';
    ctx.beginPath();
    ctx.arc(0, 7, 4, 0, Math.PI * 2);
    ctx.fill();

    // 6. Fake Handlebar Mustache & Eyeglasses Disguise
    ctx.save();
    if (mustacheLoose) {
      // Dangling on one side!
      ctx.translate(0, 15);
      ctx.rotate(0.45);
    } else {
      ctx.translate(0, 15);
    }
    // Thick Black Handlebar Mustache
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.quadraticCurveTo(-14, -6, -24, 6);
    ctx.quadraticCurveTo(-12, 1, 0, 0);
    ctx.quadraticCurveTo(12, 1, 24, 6);
    ctx.quadraticCurveTo(14, -6, 0, -3);
    ctx.fill();
    ctx.restore();

    // Fake Monocle or Glasses
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(-14, -2, 9, 0, Math.PI * 2);
    ctx.arc(14, -2, 9, 0, Math.PI * 2);
    ctx.moveTo(-5, -2);
    ctx.lineTo(5, -2); // Bridge
    ctx.stroke();

    // 7. Dealer Fedora Hat
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.ellipse(0, -22, 38, 9, 0, 0, Math.PI * 2); // Brim
    ctx.fill();
    ctx.beginPath();
    ctx.roundRect(-22, -45, 44, 26, [8, 8, 2, 2]); // Crown
    ctx.fill();
    // Gold Hat Band
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(-22, -26, 44, 5);

    ctx.restore(); // Restore head

    // 8. Dealer Arms & Raccoon Paws dealing cards
    // Left Arm holding the deck
    ctx.fillStyle = '#c5a059';
    ctx.beginPath();
    ctx.roundRect(-75, -20 + breath, 24, 60, 10);
    ctx.fill();
    // White Shirt Cuff
    ctx.fillStyle = '#fff';
    ctx.fillRect(-75, 32 + breath, 24, 8);
    // Dark Raccoon Paw
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.ellipse(-63, 46 + breath, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    // Right Arm dealing cards (or Sleight of Paw cheat)
    ctx.fillStyle = '#c5a059';
    ctx.beginPath();
    ctx.roundRect(51, -20 + breath, 24, 60, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(51, 32 + breath, 24, 8);
    ctx.fillStyle = '#212529';
    ctx.beginPath();
    ctx.ellipse(63, 46 + breath, 10, 8, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isCheating) {
      // Secret ace peeking out of sleeve!
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(56, 18 + breath, 14, 18);
      ctx.strokeStyle = '#d90429';
      ctx.lineWidth = 1;
      ctx.strokeRect(56, 18 + breath, 14, 18);
      ctx.fillStyle = '#d90429';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('A♥', 60, 30 + breath);
    }

    ctx.restore();
  }

  // --- CASINO GUESTS & PLAYERS ---

  drawCasinoGuest(ctx, x, y, guest) {
    const { type, name, isHuman, mood = 'neutral', eyeGaze = 'dealer' } = guest;

    ctx.save();
    ctx.translate(x, y);

    if (type === 'inspector') {
      // Inspector Higgins (Human Detective)
      // Brown Trench Coat & Fedora
      ctx.fillStyle = '#6c584c';
      ctx.beginPath();
      ctx.roundRect(-42, 20, 84, 90, 16);
      ctx.fill();
      // Human Face
      ctx.fillStyle = '#fed0bb';
      ctx.beginPath();
      ctx.ellipse(0, -10, 26, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      // Stern Brows & Eyes
      ctx.fillStyle = '#3a2e26';
      ctx.fillRect(-18, -20, 14, 4);
      ctx.fillRect(4, -20, 14, 4);
      ctx.fillStyle = '#1a1a1a';
      const lookX = eyeGaze === 'dealer' ? 0 : 4;
      ctx.beginPath();
      ctx.arc(-11 + lookX, -12, 3, 0, Math.PI * 2);
      ctx.arc(11 + lookX, -12, 3, 0, Math.PI * 2);
      ctx.fill();
      // Big Walrus Mustache
      ctx.fillStyle = '#4a3b32';
      ctx.beginPath();
      ctx.ellipse(0, 6, 20, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      // Brass Magnifying Monocle
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(11, -12, 10, 0, Math.PI * 2);
      ctx.stroke();
      // Detective Fedora
      ctx.fillStyle = '#4a3b32';
      ctx.fillRect(-38, -36, 76, 8);
      ctx.fillRect(-22, -60, 44, 26);
    } else if (type === 'tycoon') {
      // Wealthy Tycoon (Human)
      // Tuxedo
      ctx.fillStyle = '#101018';
      ctx.beginPath();
      ctx.roundRect(-45, 18, 90, 90, 16);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(-15, 18);
      ctx.lineTo(15, 18);
      ctx.lineTo(0, 50);
      ctx.closePath();
      ctx.fill();
      // Face
      ctx.fillStyle = '#e8beac';
      ctx.beginPath();
      ctx.ellipse(0, -12, 28, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      // Eyes & Smug Grin
      ctx.fillStyle = '#212529';
      ctx.beginPath();
      ctx.arc(-12, -14, 3, 0, Math.PI * 2);
      ctx.arc(12, -14, 3, 0, Math.PI * 2);
      ctx.fill();
      // Glowing Cigar in mouth with smoke
      ctx.fillStyle = '#582f0e';
      ctx.fillRect(8, 2, 18, 5);
      ctx.fillStyle = '#ff5400';
      ctx.fillRect(24, 2, 4, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '10px sans-serif';
      ctx.fillText('💨', 28, -2);
      // Sleek Grey Hair
      ctx.fillStyle = '#adb5bd';
      ctx.beginPath();
      ctx.arc(0, -32, 26, Math.PI, 0);
      ctx.fill();
    } else if (type === 'capybara') {
      // Chester the Capybara (Animal Ally)
      ctx.fillStyle = '#8b5a2b';
      ctx.beginPath();
      ctx.roundRect(-40, 15, 80, 80, 18);
      ctx.fill();
      // Chill Capybara Face
      ctx.fillStyle = '#a06b3a';
      ctx.beginPath();
      ctx.ellipse(0, -8, 30, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      // Calm Eyes (horizontal lines)
      ctx.strokeStyle = '#2b1a0e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -10);
      ctx.lineTo(-6, -10);
      ctx.moveTo(6, -10);
      ctx.lineTo(18, -10);
      ctx.stroke();
      // Big Blunt Snout
      ctx.fillStyle = '#6e441f';
      ctx.beginPath();
      ctx.roundRect(-16, 0, 32, 18, 8);
      ctx.fill();
      // Cute Fedora Hat & Hawaiian Floral Shirt
      ctx.fillStyle = '#ffbe0b';
      ctx.fillRect(-20, -36, 40, 6);
      ctx.fillRect(-14, -50, 28, 16);
      // Friendly speech
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 11px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦝 "Looking sharp, human!"', 0, 105);
    } else if (type === 'fox') {
      // Sly Fiona the Fox (Animal Ally)
      ctx.fillStyle = '#264653';
      ctx.beginPath();
      ctx.roundRect(-38, 15, 76, 80, 16);
      ctx.fill();
      // Rust Red Face
      ctx.fillStyle = '#e76f51';
      ctx.beginPath();
      ctx.ellipse(0, -10, 26, 24, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pointed Fox Ears
      ctx.fillStyle = '#e76f51';
      ctx.beginPath();
      ctx.moveTo(-24, -20);
      ctx.lineTo(-32, -45);
      ctx.lineTo(-12, -30);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(24, -20);
      ctx.lineTo(32, -45);
      ctx.lineTo(12, -30);
      ctx.closePath();
      ctx.fill();
      // White Cheeks & Slanted Eyes
      ctx.fillStyle = '#fdfdfd';
      ctx.beginPath();
      ctx.ellipse(-14, 4, 12, 10, -0.3, 0, Math.PI * 2);
      ctx.ellipse(14, 4, 12, 10, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#264653';
      ctx.beginPath();
      ctx.ellipse(-12, -8, 4, 2.5, 0.4, 0, Math.PI * 2);
      ctx.ellipse(12, -8, 4, 2.5, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Wink & Bowtie
      ctx.fillStyle = '#e63946';
      ctx.fillRect(-10, 16, 20, 8);
    }

    // Name Badge below player seat
    ctx.fillStyle = 'rgba(10, 24, 18, 0.9)';
    ctx.beginPath();
    ctx.roundRect(-70, 78, 140, 22, 6);
    ctx.fill();
    ctx.strokeStyle = isHuman ? '#ffd166' : '#2ec4b6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${name} ${isHuman ? '🕵️' : '🐾'}`, 0, 93);

    ctx.restore();
  }

  // --- PLAYING CARDS & BETTING CHIPS ---

  drawPlayingCard(ctx, card, x, y, isHidden = false, animProgress = 1) {
    const { suit, value, numValue } = card;
    const cardWidth = 56;
    const cardHeight = 80;

    ctx.save();
    ctx.translate(x, y);

    // Drop Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;

    if (isHidden) {
      // Card Back (Casino Gold-Leaf Pattern)
      ctx.fillStyle = '#8b0000';
      ctx.beginPath();
      ctx.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
      ctx.fill();
      ctx.strokeStyle = '#ffd700';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Gold Lattice Pattern
      ctx.fillStyle = '#d4af37';
      ctx.beginPath();
      ctx.roundRect(-cardWidth / 2 + 5, -cardHeight / 2 + 5, cardWidth - 10, cardHeight - 10, 4);
      ctx.stroke();
      ctx.font = '14px serif';
      ctx.textAlign = 'center';
      ctx.fillText('🦝', 0, 5);

      ctx.restore();
      return;
    }

    // Card Front Face
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(-cardWidth / 2, -cardHeight / 2, cardWidth, cardHeight, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    const isRed = suit === '♥' || suit === '♦';
    const suitColor = isRed ? '#d90429' : '#1e1e24';

    ctx.fillStyle = suitColor;
    ctx.font = 'bold 14px "Cinzel", Georgia, serif';
    ctx.textAlign = 'left';

    // Top-Left Index
    ctx.fillText(value, -cardWidth / 2 + 6, -cardHeight / 2 + 16);
    ctx.font = '12px sans-serif';
    ctx.fillText(suit, -cardWidth / 2 + 6, -cardHeight / 2 + 28);

    // Center Large Suit Icon
    ctx.font = '26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(suit, 0, 8);

    // Bottom-Right Inverted Index
    ctx.save();
    ctx.translate(cardWidth / 2 - 6, cardHeight / 2 - 6);
    ctx.rotate(Math.PI);
    ctx.font = 'bold 14px "Cinzel", Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText(value, 0, 10);
    ctx.font = '12px sans-serif';
    ctx.fillText(suit, 0, 22);
    ctx.restore();

    ctx.restore();
  }

  drawHandScoreBadge(ctx, x, y, score, isBust = false, isBlackjack = false) {
    ctx.save();
    ctx.translate(x, y);

    let bgColor = 'rgba(14, 28, 22, 0.92)';
    let textColor = '#ffd166';
    let label = `${score}`;

    if (isBlackjack) {
      bgColor = '#ffbe0b';
      textColor = '#1a1005';
      label = 'BLACKJACK! 21';
    } else if (isBust) {
      bgColor = '#d90429';
      textColor = '#fff';
      label = 'BUST!';
    }

    ctx.fillStyle = bgColor;
    ctx.beginPath();
    ctx.roundRect(-35, -12, 70, 24, 12);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = 'bold 12px "Fredoka", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, 0, 5);

    ctx.restore();
  }

  drawBettingChipsStack(ctx, x, y, amount) {
    ctx.save();
    ctx.translate(x, y);

    const chipCount = Math.min(6, Math.max(1, Math.floor(amount / 25)));
    const chipColor = amount >= 100 ? '#101010' : (amount >= 25 ? '#2a9d8f' : '#d90429');

    for (let i = 0; i < chipCount; i++) {
      ctx.fillStyle = chipColor;
      ctx.beginPath();
      ctx.ellipse(0, -i * 5, 14, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 11px "Cinzel", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(`$${amount}`, 0, 18);

    ctx.restore();
  }
}

window.CasinoRenderer = CasinoRenderer;
