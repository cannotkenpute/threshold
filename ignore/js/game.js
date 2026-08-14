/**
 * Trash Panda Wash & Dry - Core Game Engine
 * Features: Complete Game Loop, Character Physics, Customer AI, Upgrade Shop,
 * Interactive Layout Editor (Remodel & Custom Decor), and Save Persistence.
 */

class RaccoonLaundromatGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.renderer = new SpriteRenderer();

    // Game Dimensions
    this.width = 960;
    this.height = 600;

    // Game States
    this.isRunning = false;
    this.isPaused = false;
    this.isLayoutMode = false;
    this.gridSnap = true;
    this.snapGridSize = 20;
    this.lastTime = 0;

    // Layout Editor Drag States
    this.selectedFurniture = null;
    this.hoveredFurniture = null;
    this.isDraggingFurniture = false;
    this.dragOffset = { x: 0, y: 0 };

    // Player Economy & Progress
    this.money = 50;
    this.reputationLevel = 1;
    this.reputationPoints = 0;
    this.day = 1;
    this.dayTime = 9 * 60; // 9:00 AM
    this.dayEndMinutes = 18 * 60; // 6:00 PM
    this.timeScale = 3.5;

    // Daily Shift Stats
    this.dailyStats = {
      loads: 0,
      customers: 0,
      revenue: 0,
      tips: 0,
      trinkets: 0,
    };

    // Purchased Upgrades
    this.upgrades = {
      washers: 1,
      dryers: 1,
      turboWash: false,
      fastDry: false,
      autoSoap: false,
      steamPress: false,
      rollerSkates: false,
      helperPip: false,
      arcadeCabinet: false,
      lavenderSoap: false,
      glitterSoap: false,
    };

    // Lost & Found Pocket Trinkets (12 Collectibles)
    this.trinkets = [
      { id: 'bottle_cap', name: 'Shiny Bottle Cap', icon: '🪙', desc: 'A gleaming soda cap. Prime raccoon currency.', count: 0 },
      { id: 'golden_thimble', name: 'Golden Thimble', icon: '🪡', desc: 'Lost by a tiny seamstress mouse.', count: 0 },
      { id: 'lucky_coin', name: '1984 Lucky Coin', icon: '✨', desc: 'Still gives off a warm copper glow.', count: 0 },
      { id: 'vintage_key', name: 'Mystery Brass Key', icon: '🗝️', desc: 'Opens something mysterious somewhere.', count: 0 },
      { id: 'guitar_pick', name: 'Tortoiseshell Pick', icon: '🎸', desc: 'Fiona the Fox must have left this behind.', count: 0 },
      { id: 'glitter_sticker', name: 'Holo Cat Sticker', icon: '⭐', desc: 'Extra sparkly and sticky.', count: 0 },
      { id: 'sparkly_marble', name: 'Galaxy Marble', icon: '🔮', desc: 'Swirling blue and purple glass.', count: 0 },
      { id: 'safety_pin', name: 'Silver Safety Pin', icon: '🧷', desc: 'A handy tool for quick fashion fixes.', count: 0 },
      { id: 'rubber_duck', name: 'Micro Rubber Duck', icon: '🐥', desc: 'Squeaks at high frequencies.', count: 0 },
      { id: 'seashell', name: 'Smooth Spiral Shell', icon: '🐚', desc: 'Smells like the ocean.', count: 0 },
      { id: 'velvet_ribbon', name: 'Ruby Velvet Ribbon', icon: '🎀', desc: 'Silky smooth to the touch.', count: 0 },
      { id: 'antique_watch', name: 'Pocket Watch Gear', icon: '⚙️', desc: 'Tick-tocks when wound by raccoon claws.', count: 0 }
    ];

    // Player (Barnaby)
    this.player = {
      x: 480,
      y: 320,
      vx: 0,
      vy: 0,
      speed: 220,
      baseSpeed: 220,
      facing: 1,
      radius: 16,
      carrying: null,
      isZooming: false,
      hasSkates: false,
    };

    // Hired Staff System ($12 / game hour per employee, capacity scales with Level)
    this.hourlyWage = 12;
    this.lastWageHour = 9;
    this.dailyWagesPaid = 0;
    this.hiredStaff = []; // Array of active helper entities

    this.staffCandidates = [
      { id: 'pip', name: 'Pip the Apprentice', species: 'raccoon', icon: '🦝', trait: '⚡ Agile Transfer Master', desc: 'Balanced helper. Rapidly transfers laundry from Washers ➔ Dryers ➔ Folding Tables.' },
      { id: 'pippin', name: 'Pippin the Swift Bunny', species: 'bunny', icon: '🐰', trait: '✨ Turbo Laundry Folder', desc: 'Flurry of paws! Folds dry laundry at the folding table 2x faster than normal.' },
      { id: 'bramble', name: 'Bramble Bear Cub', species: 'bear', icon: '🐻', trait: '🧺 Front Counter Hauler', desc: 'Strong cub! Directly takes dirty laundry from waiting customers at the counter and loads washers.' },
      { id: 'fiona', name: 'Fiona the Quick Fox', species: 'fox', icon: '🦊', trait: '💨 Speed Sprint Champion', desc: 'Moves +40% faster across the shop floor with boundless enthusiasm.' },
      { id: 'capy', name: 'Capy the Zen Capybara', species: 'capybara', icon: '🦫', trait: '🧘 Customer Calmer', desc: 'Radiates soothing vibes! Customer patience drains 30% slower while Capy is on duty.' },
      { id: 'oliver', name: 'Oliver the Owl', species: 'owl', icon: '🦉', trait: '🧪 Auto-Detergent Injector', desc: 'Meticulous bird! Automatically adds fresh detergent soap to washing machines upon loading.' },
    ];

    // Input States
    this.keys = {};
    this.mouseTarget = null;
    this.pendingInteractTarget = null;
    this.touchJoystick = { active: false, dx: 0, dy: 0 };
    this.focusedInteractive = null;

    // Layout Customization & Decor Lists
    this.customRugs = [
      { id: 'rug_1', x: 40, y: 158, w: 200, h: 150, style: 'coral' }
    ];
    this.customDecor = [
      { id: 'plant_1', x: 220, y: 170, width: 28, height: 35, decorType: 'monstera' },
      { id: 'plant_2', x: 840, y: 440, width: 28, height: 35, decorType: 'monstera' }
    ];

    // Game Entities
    this.washers = [];
    this.dryers = [];
    this.foldingTable = null;
    this.counter = null;
    this.soapStation = null;
    this.benches = [];
    this.arcade = null;
    this.customers = [];
    this.bubbles = [];
    this.particles = [];
    this.droppedItems = [];

    // Timers
    this.customerSpawnTimer = 2.5;
    // Setup Stations & Layout first
    this.initLayout();

    // Load Save Data & Saved Layout
    this.loadSaveData();

    // Bind Event Listeners & UI
    this.bindEvents();
    this.initUI();

    // Canvas Resize Handling
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  resizeCanvas() {
    const container = document.getElementById('game-container');
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    const scale = Math.min(cw / this.width, ch / this.height);
    this.canvas.style.width = `${this.width * scale}px`;
    this.canvas.style.height = `${this.height * scale}px`;
  }

  // --- INITIALIZATION & LAYOUT ---

  closeAllModals() {
    const modalIds = [
      'modal-shop', 'modal-staff', 'modal-trinkets', 'modal-summary',
      'modal-presets', 'modal-decor', 'modal-place-machines', 'modal-pause'
    ];
    modalIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
  }

  initLayout() {
    const washerStartX = 280;
    const washerY = 145;
    const washerGap = 68;

    // 4 Washers
    if (!this.washers || this.washers.length === 0) {
      this.washers = [];
      for (let i = 0; i < 4; i++) {
        this.washers.push({
          type: 'washer',
          id: i + 1,
          name: `Washer #${i + 1}`,
          x: washerStartX + (i * washerGap),
          y: washerY,
          width: 58,
          height: 78,
          unlocked: i < this.upgrades.washers,
          state: 'empty',
          progress: 0,
          totalTime: this.upgrades.turboWash ? 4.0 : 6.5,
          customerId: null,
          soapType: 'regular',
        });
      }
    } else {
      // Update unlocked status & speeds & rescue positions
      this.washers.forEach((w, i) => {
        const wasUnlocked = w.unlocked;
        w.unlocked = i < this.upgrades.washers;
        w.totalTime = this.upgrades.turboWash ? 4.0 : 6.5;
        
        // If newly unlocked or out-of-bounds, place adjacent to washer #1
        if ((!wasUnlocked && w.unlocked) || w.x < 30 || w.x > 890 || w.y < 120 || w.y > 540) {
          const w1 = this.washers[0];
          w.x = (w1 && w1.x < 700) ? w1.x + (i * washerGap) : (washerStartX + i * washerGap);
          w.y = w1 ? w1.y : washerY;
          if (w.x > 880) w.x = washerStartX + (i * washerGap);
        }
      });
    }

    const dryerStartX = 590;
    const dryerY = 145;
    const dryerGap = 68;

    // 4 Dryers
    if (!this.dryers || this.dryers.length === 0) {
      this.dryers = [];
      for (let i = 0; i < 4; i++) {
        this.dryers.push({
          type: 'dryer',
          id: i + 1,
          name: `Dryer #${i + 1}`,
          x: dryerStartX + (i * dryerGap),
          y: dryerY,
          width: 58,
          height: 78,
          unlocked: i < this.upgrades.dryers,
          state: 'empty',
          progress: 0,
          totalTime: this.upgrades.fastDry ? 4.0 : 6.5,
          customerId: null,
        });
      }
    } else {
      this.dryers.forEach((d, i) => {
        const wasUnlocked = d.unlocked;
        d.unlocked = i < this.upgrades.dryers;
        d.totalTime = this.upgrades.fastDry ? 4.0 : 6.5;

        // If newly unlocked or out-of-bounds, position adjacent to dryer #1
        if ((!wasUnlocked && d.unlocked) || d.x < 30 || d.x > 890 || d.y < 120 || d.y > 540) {
          const d1 = this.dryers[0];
          d.x = (d1 && d1.x < 700) ? d1.x + (i * dryerGap) : (dryerStartX + i * dryerGap);
          d.y = d1 ? d1.y : dryerY;
          if (d.x > 880) d.x = dryerStartX + (i * dryerGap);
        }
      });
    }

    // Folding Table
    if (!this.foldingTable) {
      this.foldingTable = {
        type: 'folding_table',
        name: 'Folding Table',
        x: 430,
        y: 380,
        width: 140,
        height: 52,
        isFolding: false,
        progress: 0,
        totalTime: this.upgrades.steamPress ? 1.0 : 2.2,
        hasStack: false,
        customerId: null,
      };
    } else {
      this.foldingTable.totalTime = this.upgrades.steamPress ? 1.0 : 2.2;
    }

    // Soap Station
    if (!this.soapStation) {
      this.soapStation = {
        type: 'soap_station',
        name: 'Soap Shelf',
        x: 870,
        y: 260,
        width: 64,
        height: 38,
      };
    }

    // Counter
    if (!this.counter) {
      this.counter = {
        type: 'counter',
        name: 'Check-in Counter',
        x: 75,
        y: 420,
        width: 130,
        height: 55,
      };
    }

    // Benches
    if (!this.benches || this.benches.length === 0) {
      this.benches = [
        { type: 'bench', name: 'Waiting Bench', id: 'bench_1', x: 70, y: 220, width: 90, height: 36, occupiedBy: null },
        { type: 'bench', name: 'Waiting Bench', id: 'bench_2', x: 70, y: 285, width: 90, height: 36, occupiedBy: null },
      ];
    }

    // Arcade Cabinet
    if (!this.arcade) {
      this.arcade = {
        type: 'arcade',
        name: 'Arcade Cabinet',
        x: 70,
        y: 135,
        width: 48,
        height: 62,
        unlocked: this.upgrades.arcadeCabinet,
        occupiedBy: null,
      };
    } else {
      this.arcade.unlocked = this.upgrades.arcadeCabinet;
    }
  }

  // --- MOVABLE FURNITURE REGISTRY FOR LAYOUT EDITOR ---

  getAllMovableFurniture() {
    const list = [
      ...this.washers.filter(w => w.unlocked),
      ...this.dryers.filter(d => d.unlocked),
      this.foldingTable,
      this.counter,
      this.soapStation,
      ...this.benches,
      ...this.customDecor,
      ...this.customRugs,
    ];
    if (this.arcade.unlocked) {
      list.push(this.arcade);
    }
    return list;
  }

  // --- COLLISION OBSTACLES & DISTANCE HELPERS ---

  getDistToRect(px, py, rx, ry, rw, rh) {
    const cx = Math.max(rx, Math.min(px, rx + rw));
    const cy = Math.max(ry, Math.min(py, ry + rh));
    return Math.hypot(px - cx, py - cy);
  }

  getObstacles() {
    const obs = [
      // Check-in Counter
      { x: this.counter.x, y: this.counter.y, w: this.counter.width, h: this.counter.height },
      // Folding Table
      { x: this.foldingTable.x, y: this.foldingTable.y, w: this.foldingTable.width, h: this.foldingTable.height },
      // Soap Shelf
      { x: this.soapStation.x, y: this.soapStation.y, w: this.soapStation.width, h: this.soapStation.height },
      // Benches
      ...this.benches.map(b => ({ x: b.x, y: b.y, w: b.width || 90, h: b.height || 36 })),
      // Custom Decor that have collision
      ...this.customDecor.filter(d => d.decorType !== 'rug').map(d => ({ x: d.x, y: d.y, w: d.width || 30, h: d.height || 35 })),
    ];

    // Washers that are positioned on floor area (outside back wall)
    this.washers.filter(w => w.unlocked && w.y > 160).forEach(w => {
      obs.push({ x: w.x, y: w.y, w: w.width, h: w.height });
    });

    // Dryers that are positioned on floor area
    this.dryers.filter(d => d.unlocked && d.y > 160).forEach(d => {
      obs.push({ x: d.x, y: d.y, w: d.width, h: d.height });
    });

    if (this.arcade.unlocked) {
      obs.push({ x: this.arcade.x, y: this.arcade.y, w: this.arcade.width, h: this.arcade.height });
    }
    return obs;
  }

  resolveCollisions(entity) {
    const radius = entity.radius || 16;
    const minX = 35 + radius;
    const maxX = this.width - 35 - radius;
    const minY = 224 + radius; // Just below top wall
    const maxY = this.height - 35 - radius;

    // Room boundaries
    entity.x = Math.max(minX, Math.min(maxX, entity.x));
    entity.y = Math.max(minY, Math.min(maxY, entity.y));

    // Obstacle box collisions with smooth sliding
    const obstacles = this.getObstacles();
    for (let obs of obstacles) {
      const nearX = Math.max(obs.x, Math.min(entity.x, obs.x + obs.w));
      const nearY = Math.max(obs.y, Math.min(entity.y, obs.y + obs.h));
      const dx = entity.x - nearX;
      const dy = entity.y - nearY;
      const dist = Math.hypot(dx, dy);

      if (dist < radius) {
        const overlap = radius - dist;
        if (dist > 0.001) {
          entity.x += (dx / dist) * overlap;
          entity.y += (dy / dist) * overlap;
        } else {
          entity.y += overlap || radius;
        }
      }
    }
  }

  // --- EVENT LISTENERS ---

  bindEvents() {
    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') {
        if (!this.isLayoutMode) {
          e.preventDefault();
          this.handlePlayerAction();
        }
      }
      if (e.code === 'KeyQ') {
        if (!this.isLayoutMode) {
          e.preventDefault();
          this.dropCarriedItem();
        }
      }
      if (e.code === 'KeyL') {
        this.toggleLayoutMode();
      }
      if (e.code === 'KeyH' && !this.isLayoutMode) {
        this.toggleStaff();
      }
      if (e.code === 'KeyB' && !this.isLayoutMode) {
        this.toggleShop();
      }
      if (e.code === 'KeyT' && !this.isLayoutMode) {
        this.toggleTrinkets();
      }
      if (e.code === 'KeyM') {
        this.toggleSound();
      }
      if (e.code === 'KeyN') {
        this.toggleMusic();
      }
      if (e.code === 'Escape') {
        if (this.isLayoutMode) {
          this.toggleLayoutMode(false);
        } else {
          this.togglePause();
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Pointer Events for Drag & Drop in Layout Mode + Gameplay
    this.canvas.addEventListener('pointerdown', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      const clickX = (e.clientX - rect.left) * scaleX;
      const clickY = (e.clientY - rect.top) * scaleY;

      // --- LAYOUT EDITOR MODE POINTERDOWN ---
      if (this.isLayoutMode) {
        const movable = this.getAllMovableFurniture();
        let hitItem = null;

        // Search reverse order (topmost first)
        for (let i = movable.length - 1; i >= 0; i--) {
          const item = movable[i];
          const w = item.width || item.w || 40;
          const h = item.height || item.h || 40;
          if (clickX >= item.x && clickX <= item.x + w && clickY >= item.y && clickY <= item.y + h) {
            hitItem = item;
            break;
          }
        }

        if (hitItem) {
          this.selectedFurniture = hitItem;
          this.isDraggingFurniture = true;
          this.dragOffset = { x: clickX - hitItem.x, y: clickY - hitItem.y };
          window.gameAudio.playBubblePop(1.5);

          // Show/Hide Delete Button if item is custom decor
          const btnDel = document.getElementById('btn-delete-selected');
          if (this.customDecor.includes(hitItem) || this.customRugs.includes(hitItem)) {
            btnDel.classList.remove('hidden');
          } else {
            btnDel.classList.add('hidden');
          }
        } else {
          this.selectedFurniture = null;
          document.getElementById('btn-delete-selected').classList.add('hidden');
        }
        return;
      }

      // --- GAMEPLAY MODE POINTERDOWN ---
      // 1. Pop bubbles
      for (let i = this.bubbles.length - 1; i >= 0; i--) {
        const b = this.bubbles[i];
        if (Math.hypot(clickX - b.x, clickY - b.y) <= b.radius + 14) {
          this.popBubble(i);
          return;
        }
      }

      // 2. Direct click on interactive objects
      let clickedStation = null;
      let walkTarget = { x: clickX, y: Math.max(242, clickY) };

      for (let w of this.washers) {
        if (w.unlocked && clickX >= w.x - 12 && clickX <= w.x + w.width + 12 && clickY >= w.y - 12 && clickY <= w.y + w.height + 20) {
          clickedStation = w;
          walkTarget = { x: w.x + w.width / 2, y: w.y + w.height + 30 };
          break;
        }
      }

      if (!clickedStation) {
        for (let d of this.dryers) {
          if (d.unlocked && clickX >= d.x - 12 && clickX <= d.x + d.width + 12 && clickY >= d.y - 12 && clickY <= d.y + d.height + 20) {
            clickedStation = d;
            walkTarget = { x: d.x + d.width / 2, y: d.y + d.height + 30 };
            break;
          }
        }
      }

      if (!clickedStation) {
        const ft = this.foldingTable;
        if (clickX >= ft.x - 15 && clickX <= ft.x + ft.width + 15 && clickY >= ft.y - 15 && clickY <= ft.y + ft.height + 15) {
          clickedStation = ft;
          walkTarget = { x: ft.x + ft.width / 2, y: ft.y - 30 };
        }
      }

      if (!clickedStation) {
        const ct = this.counter;
        if (clickX >= ct.x - 15 && clickX <= ct.x + ct.width + 15 && clickY >= ct.y - 15 && clickY <= ct.y + ct.height + 15) {
          clickedStation = ct;
          walkTarget = { x: ct.x + ct.width / 2 + 10, y: ct.y - 30 };
        }
      }

      if (!clickedStation) {
        const sp = this.soapStation;
        if (clickX >= sp.x - 20 && clickX <= sp.x + sp.width + 20 && clickY >= sp.y - 15 && clickY <= sp.y + sp.height + 15) {
          clickedStation = sp;
          walkTarget = { x: sp.x - 30, y: sp.y + sp.height / 2 };
        }
      }

      if (!clickedStation) {
        for (let c of this.customers) {
          if (Math.hypot(clickX - c.x, clickY - c.y) < 40) {
            clickedStation = c;
            walkTarget = { x: c.x, y: Math.max(242, c.y + 25) };
            break;
          }
        }
      }

      if (clickedStation) {
        const dist = Math.hypot(this.player.x - walkTarget.x, this.player.y - walkTarget.y);
        if (dist < 65) {
          this.handlePlayerAction();
          this.mouseTarget = null;
          this.pendingInteractTarget = null;
          return;
        } else {
          this.pendingInteractTarget = clickedStation;
        }
      } else {
        this.pendingInteractTarget = null;
      }

      this.mouseTarget = walkTarget;
    });

    // Pointer Move for dragging furniture in layout mode
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.width / rect.width;
      const scaleY = this.height / rect.height;
      const posX = (e.clientX - rect.left) * scaleX;
      const posY = (e.clientY - rect.top) * scaleY;

      if (this.isLayoutMode) {
        if (this.isDraggingFurniture && this.selectedFurniture) {
          let newX = posX - this.dragOffset.x;
          let newY = posY - this.dragOffset.y;

          if (this.gridSnap) {
            newX = Math.round(newX / this.snapGridSize) * this.snapGridSize;
            newY = Math.round(newY / this.snapGridSize) * this.snapGridSize;
          }

          const w = this.selectedFurniture.width || this.selectedFurniture.w || 40;
          const h = this.selectedFurniture.height || this.selectedFurniture.h || 40;

          // Clamp within room
          newX = Math.max(30, Math.min(this.width - w - 30, newX));
          newY = Math.max(125, Math.min(this.height - h - 30, newY));

          this.selectedFurniture.x = newX;
          this.selectedFurniture.y = newY;
        } else {
          // Hover detection
          const movable = this.getAllMovableFurniture();
          this.hoveredFurniture = null;
          for (let i = movable.length - 1; i >= 0; i--) {
            const item = movable[i];
            const w = item.width || item.w || 40;
            const h = item.height || item.h || 40;
            if (posX >= item.x && posX <= item.x + w && posY >= item.y && posY <= item.y + h) {
              this.hoveredFurniture = item;
              break;
            }
          }
        }
      }
    });

    // Pointer Up
    window.addEventListener('pointerup', () => {
      if (this.isLayoutMode && this.isDraggingFurniture) {
        this.isDraggingFurniture = false;
        window.gameAudio.playFold();
      }
    });

    // Touch Virtual Joystick
    const joystickZone = document.getElementById('joystick-zone');
    const joystickKnob = document.getElementById('joystick-knob');
    if (joystickZone) {
      const handleJoystick = (e) => {
        const rect = joystickZone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const touch = e.touches ? e.touches[0] : e;
        const dx = touch.clientX - centerX;
        const dy = touch.clientY - centerY;
        const dist = Math.hypot(dx, dy);
        const maxDist = rect.width / 2;

        const clampedDist = Math.min(dist, maxDist);
        const angle = Math.atan2(dy, dx);
        const knobX = Math.cos(angle) * clampedDist;
        const knobY = Math.sin(angle) * clampedDist;

        joystickKnob.style.transform = `translate(calc(-50% + ${knobX}px), calc(-50% + ${knobY}px))`;

        this.touchJoystick.active = true;
        this.touchJoystick.dx = knobX / maxDist;
        this.touchJoystick.dy = knobY / maxDist;
      };

      const resetJoystick = () => {
        joystickKnob.style.transform = 'translate(-50%, -50%)';
        this.touchJoystick.active = false;
        this.touchJoystick.dx = 0;
        this.touchJoystick.dy = 0;
      };

      joystickZone.addEventListener('touchstart', (e) => { e.preventDefault(); handleJoystick(e); });
      joystickZone.addEventListener('touchmove', (e) => { e.preventDefault(); handleJoystick(e); });
      joystickZone.addEventListener('touchend', resetJoystick);
      joystickZone.addEventListener('touchcancel', resetJoystick);
    }

    // Touch Action Buttons
    const mobileActionBtn = document.getElementById('mobile-action-btn');
    if (mobileActionBtn) {
      mobileActionBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handlePlayerAction();
      });
    }

    const mobileSprintBtn = document.getElementById('mobile-sprint-btn');
    if (mobileSprintBtn) {
      mobileSprintBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.player.isZooming = true;
      });
      mobileSprintBtn.addEventListener('touchend', () => {
        this.player.isZooming = false;
      });
    }

    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      const mobileControls = document.getElementById('mobile-controls');
      if (mobileControls) mobileControls.classList.remove('hidden');
    }
  }

  initUI() {
    // Top Bar Buttons
    document.getElementById('btn-sound').onclick = () => this.toggleSound();
    document.getElementById('btn-music').onclick = () => this.toggleMusic();
    document.getElementById('btn-layout').onclick = () => this.toggleLayoutMode();
    document.getElementById('btn-staff').onclick = () => this.toggleStaff();
    document.getElementById('btn-shop').onclick = () => this.toggleShop();
    document.getElementById('btn-trinkets').onclick = () => this.toggleTrinkets();
    document.getElementById('btn-pause').onclick = () => this.togglePause();

    // Start Game
    const titleModal = document.getElementById('modal-title');
    const startBtn = document.getElementById('btn-start-game');

    const handleStartGame = (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      titleModal.classList.remove('active');
      titleModal.classList.add('hidden');
      window.gameAudio.ensureContext();
      this.startGame();
    };

    if (startBtn) {
      startBtn.addEventListener('click', handleStartGame);
      startBtn.addEventListener('pointerdown', handleStartGame);
      startBtn.addEventListener('touchend', handleStartGame);
    }

    // Allow pressing Space or Enter on title screen to start
    window.addEventListener('keydown', (e) => {
      if (!this.isRunning && !titleModal.classList.contains('hidden')) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleStartGame();
        }
      }
    });

    // Layout Editor Controls
    document.getElementById('btn-save-layout').onclick = () => {
      this.toggleLayoutMode(false);
      this.saveLayout();
      this.showToast('Layout remodeled & saved! 📐✨');
    };

    document.getElementById('btn-grid-snap').onclick = () => {
      this.gridSnap = !this.gridSnap;
      document.getElementById('snap-label').textContent = this.gridSnap ? 'ON' : 'OFF';
      document.getElementById('btn-grid-snap').classList.toggle('active-toggle', this.gridSnap);
    };

    document.getElementById('btn-place-machines').onclick = () => {
      this.togglePlaceMachines(true);
    };

    document.getElementById('btn-close-place-machines').onclick = () => {
      this.togglePlaceMachines(false);
    };

    document.getElementById('btn-auto-align-machines').onclick = () => {
      this.autoAlignAllMachines();
    };

    document.getElementById('btn-bring-all-to-center').onclick = () => {
      this.bringAllMachinesInBounds();
    };

    document.getElementById('btn-layout-presets').onclick = () => {
      document.getElementById('modal-presets').classList.remove('hidden');
    };

    document.getElementById('btn-close-presets').onclick = () => {
      document.getElementById('modal-presets').classList.add('hidden');
    };

    // Preset Apply Buttons
    document.querySelectorAll('.btn-apply-preset').forEach(btn => {
      btn.onclick = () => {
        const preset = btn.dataset.preset;
        this.applyLayoutPreset(preset);
        document.getElementById('modal-presets').classList.add('hidden');
        window.gameAudio.playUpgrade();
        this.showToast(`Applied ${preset.toUpperCase()} Layout! 🎨`);
      };
    });

    document.getElementById('btn-add-decor').onclick = () => {
      document.getElementById('modal-decor').classList.remove('hidden');
    };

    document.getElementById('btn-close-decor').onclick = () => {
      document.getElementById('modal-decor').classList.add('hidden');
    };

    // Decor Item Add Buttons
    document.querySelectorAll('.decor-item-btn').forEach(btn => {
      btn.onclick = () => {
        const decorType = btn.dataset.decor;
        this.addDecorItem(decorType);
        document.getElementById('modal-decor').classList.add('hidden');
        window.gameAudio.playUpgrade();
        this.showToast(`Added ${btn.querySelector('.decor-name').textContent}! 🌿`);
      };
    });

    document.getElementById('btn-delete-selected').onclick = () => {
      this.removeSelectedDecor();
    };

    document.getElementById('btn-reset-layout').onclick = () => {
      if (confirm('Reset to default laundromat layout?')) {
        this.applyLayoutPreset('classic');
        this.showToast('Reset to Classic Layout 🔄');
      }
    };

    // Close Modals
    document.getElementById('btn-close-shop').onclick = () => this.toggleShop(false);
    document.getElementById('btn-close-staff').onclick = () => this.toggleStaff(false);
    document.getElementById('btn-close-trinkets').onclick = () => this.toggleTrinkets(false);
    document.getElementById('btn-resume').onclick = () => this.togglePause(false);
    document.getElementById('btn-drop-item').onclick = () => this.dropCarriedItem();

    document.getElementById('btn-next-day').onclick = () => {
      document.getElementById('modal-summary').classList.add('hidden');
      this.startNewDay();
    };

    document.getElementById('btn-restart').onclick = () => {
      this.togglePause(false);
      this.startNewDay();
    };
    document.getElementById('btn-reset-save').onclick = () => {
      if (confirm('Reset all coins, upgrades, and scrapbook discoveries?')) {
        localStorage.removeItem('trash_panda_save');
        localStorage.removeItem('trash_panda_layout');
        location.reload();
      }
    };

    const tabs = document.querySelectorAll('.shop-tab');
    tabs.forEach(tab => {
      tab.onclick = () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.renderShopItems(tab.dataset.tab);
      };
    });

    this.updateHUD();
  }

  // --- LAYOUT EDITOR METHODS ---

  toggleLayoutMode(forceState) {
    this.isLayoutMode = forceState !== undefined ? forceState : !this.isLayoutMode;
    const bar = document.getElementById('layout-editor-bar');
    const promptEl = document.getElementById('interaction-prompt');

    if (this.isLayoutMode) {
      this.closeAllModals();
      this.isPaused = true;
      bar.classList.remove('hidden');
      promptEl.classList.add('hidden');
      window.gameAudio.playUpgrade();
      this.showToast('Entered Remodel Mode! Drag any machine or station 📐');
    } else {
      bar.classList.add('hidden');
      document.getElementById('modal-presets').classList.add('hidden');
      document.getElementById('modal-decor').classList.add('hidden');
      document.getElementById('modal-place-machines').classList.add('hidden');
      this.isPaused = false;
      this.selectedFurniture = null;
      this.hoveredFurniture = null;
    }
  }

  togglePlaceMachines(forceState) {
    const modal = document.getElementById('modal-place-machines');
    const isOpening = forceState !== undefined ? forceState : modal.classList.contains('hidden');
    if (isOpening) {
      modal.classList.remove('hidden');
      this.renderPlaceMachinesModal();
    } else {
      modal.classList.add('hidden');
    }
  }

  renderPlaceMachinesModal() {
    const grid = document.getElementById('owned-machines-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const items = [
      ...this.washers.filter(w => w.unlocked).map(w => ({ type: 'washer', id: w.id, name: w.name, icon: '🫧', obj: w })),
      ...this.dryers.filter(d => d.unlocked).map(d => ({ type: 'dryer', id: d.id, name: d.name, icon: '♨️', obj: d })),
      { type: 'folding_table', id: 'ft', name: 'Folding Table', icon: '🧺', obj: this.foldingTable },
      { type: 'counter', id: 'counter', name: 'Check-in Counter', icon: '🛎️', obj: this.counter },
      { type: 'soap_station', id: 'soap', name: 'Soap Shelf', icon: '🧼', obj: this.soapStation },
    ];
    if (this.arcade.unlocked) {
      items.push({ type: 'arcade', id: 'arcade', name: 'Arcade Cabinet', icon: '🕹️', obj: this.arcade });
    }
    this.benches.forEach(b => {
      items.push({ type: 'bench', id: b.id, name: b.name, icon: '🪑', obj: b });
    });

    items.forEach(item => {
      const card = document.createElement('div');
      card.className = 'owned-machine-item';
      const isOut = item.obj.x < 30 || item.obj.x > 900 || item.obj.y < 100 || item.obj.y > 540;
      card.innerHTML = `
        <div class="machine-item-left">
          <span class="machine-item-icon">${item.icon}</span>
          <div class="machine-item-details">
            <h4>${item.name}</h4>
            <span class="machine-item-coords">Pos: (${Math.round(item.obj.x)}, ${Math.round(item.obj.y)}) ${isOut ? '⚠️ Out of Bounds' : '✅ Placed'}</span>
          </div>
        </div>
        <button class="btn btn-primary btn-sm btn-relocate-item">
          📍 Place at Center
        </button>
      `;
      const btn = card.querySelector('.btn-relocate-item');
      btn.onclick = () => {
        this.relocateMachine(item.type, item.id);
      };
      grid.appendChild(card);
    });
  }

  relocateMachine(type, id) {
    let target = null;
    if (type === 'washer') target = this.washers.find(w => w.id === id);
    else if (type === 'dryer') target = this.dryers.find(d => d.id === id);
    else if (type === 'folding_table') target = this.foldingTable;
    else if (type === 'counter') target = this.counter;
    else if (type === 'soap_station') target = this.soapStation;
    else if (type === 'arcade') target = this.arcade;
    else if (type === 'bench') target = this.benches.find(b => b.id === id);

    if (target) {
      target.x = 440;
      target.y = 280;
      this.selectedFurniture = target;
      document.getElementById('modal-place-machines').classList.add('hidden');
      if (!this.isLayoutMode) {
        this.toggleLayoutMode(true);
      }
      window.gameAudio.playUpgrade();
      this.showToast(`Placed ${target.name || 'Station'} at center floor! Drag to position 📐✨`);
      this.saveLayout();
    }
  }

  autoAlignAllMachines() {
    // 1. Line up washers
    this.washers.forEach((w, i) => {
      if (w.unlocked) {
        w.x = 280 + (i * 68);
        w.y = 145;
      }
    });
    // 2. Line up dryers
    this.dryers.forEach((d, i) => {
      if (d.unlocked) {
        d.x = 590 + (i * 68);
        d.y = 145;
      }
    });
    // 3. Central folding table
    this.foldingTable.x = 430;
    this.foldingTable.y = 380;
    // 4. Counter & soap
    this.counter.x = 75;
    this.counter.y = 420;
    this.soapStation.x = 870;
    this.soapStation.y = 260;
    // 5. Benches & arcade
    if (this.benches[0]) { this.benches[0].x = 70; this.benches[0].y = 220; }
    if (this.benches[1]) { this.benches[1].x = 70; this.benches[1].y = 285; }
    if (this.arcade) { this.arcade.x = 70; this.arcade.y = 135; }

    document.getElementById('modal-place-machines').classList.add('hidden');
    window.gameAudio.playUpgrade();
    this.showToast('✨ Cleanly auto-aligned all machines & stations!');
    this.saveLayout();
  }

  bringAllMachinesInBounds() {
    const list = this.getAllMovableFurniture();
    let fixedCount = 0;
    list.forEach(item => {
      const minX = 40;
      const maxX = 900 - (item.width || item.w || 40);
      const minY = 135;
      const maxY = 550 - (item.height || item.h || 40);
      if (item.x < minX || item.x > maxX || item.y < minY || item.y > maxY) {
        item.x = Math.max(minX, Math.min(maxX, item.x));
        item.y = Math.max(minY, Math.min(maxY, item.y));
        fixedCount++;
      }
    });
    document.getElementById('modal-place-machines').classList.add('hidden');
    window.gameAudio.playBubblePop(1.2);
    this.showToast(fixedCount > 0 ? `Brought ${fixedCount} item${fixedCount > 1 ? 's' : ''} back in bounds!` : 'All items are already in bounds! 👍');
    this.saveLayout();
  }

  applyLayoutPreset(presetName) {
    if (presetName === 'classic') {
      const washerStartX = 280;
      const washerGap = 68;
      this.washers.forEach((w, i) => { w.x = washerStartX + (i * washerGap); w.y = 145; });

      const dryerStartX = 590;
      const dryerGap = 68;
      this.dryers.forEach((d, i) => { d.x = dryerStartX + (i * dryerGap); d.y = 145; });

      this.foldingTable.x = 430;
      this.foldingTable.y = 380;
      this.counter.x = 75;
      this.counter.y = 420;
      this.soapStation.x = 870;
      this.soapStation.y = 260;

      if (this.benches[0]) { this.benches[0].x = 70; this.benches[0].y = 220; }
      if (this.benches[1]) { this.benches[1].x = 70; this.benches[1].y = 285; }
      this.arcade.x = 70;
      this.arcade.y = 135;

      this.customRugs = [{ id: 'rug_1', x: 40, y: 158, w: 200, h: 150, style: 'coral' }];
    } else if (presetName === 'island') {
      // Washers & Dryers back to back in center island
      this.washers.forEach((w, i) => { w.x = 320 + (i * 68); w.y = 260; });
      this.dryers.forEach((d, i) => { d.x = 320 + (i * 68); d.y = 350; });

      this.foldingTable.x = 640;
      this.foldingTable.y = 300;
      this.counter.x = 75;
      this.counter.y = 420;
      this.soapStation.x = 230;
      this.soapStation.y = 260;

      if (this.benches[0]) { this.benches[0].x = 70; this.benches[0].y = 200; }
      if (this.benches[1]) { this.benches[1].x = 70; this.benches[1].y = 270; }
      this.arcade.x = 70;
      this.arcade.y = 135;

      this.customRugs = [{ id: 'rug_1', x: 40, y: 150, w: 180, h: 180, style: 'teal' }];
    } else if (presetName === 'speedrun') {
      // Tight production triangle near counter
      this.counter.x = 75;
      this.counter.y = 420;

      this.washers.forEach((w, i) => { w.x = 260 + (i * 68); w.y = 145; });
      this.dryers.forEach((d, i) => { d.x = 260 + (i * 68); d.y = 270; });
      this.foldingTable.x = 260;
      this.foldingTable.y = 390;
      this.soapStation.x = 180;
      this.soapStation.y = 270;

      if (this.benches[0]) { this.benches[0].x = 680; this.benches[0].y = 220; }
      if (this.benches[1]) { this.benches[1].x = 680; this.benches[1].y = 290; }
      this.arcade.x = 680;
      this.arcade.y = 135;

      this.customRugs = [{ id: 'rug_1', x: 640, y: 160, w: 220, h: 190, style: 'coral' }];
    }
  }

  addDecorItem(decorType) {
    const id = `decor_${Date.now()}`;
    if (decorType.startsWith('rug_')) {
      const style = decorType.replace('rug_', '');
      this.customRugs.push({
        id,
        x: 400,
        y: 260,
        w: 160,
        h: 110,
        style,
        name: 'Cozy Rug',
      });
    } else if (decorType === 'bench') {
      this.benches.push({
        id,
        type: 'bench',
        name: 'Waiting Bench',
        x: 420,
        y: 280,
        width: 90,
        height: 36,
        occupiedBy: null,
      });
    } else {
      this.customDecor.push({
        id,
        decorType,
        name: decorType.toUpperCase(),
        x: 440,
        y: 280,
        width: 28,
        height: 35,
      });
    }
  }

  removeSelectedDecor() {
    if (!this.selectedFurniture) return;
    const item = this.selectedFurniture;

    let idx = this.customDecor.indexOf(item);
    if (idx !== -1) {
      this.customDecor.splice(idx, 1);
      this.selectedFurniture = null;
      document.getElementById('btn-delete-selected').classList.add('hidden');
      window.gameAudio.playBubblePop(0.8);
      this.showToast('Removed decor item 🗑️');
      return;
    }

    idx = this.customRugs.indexOf(item);
    if (idx !== -1) {
      this.customRugs.splice(idx, 1);
      this.selectedFurniture = null;
      document.getElementById('btn-delete-selected').classList.add('hidden');
      window.gameAudio.playBubblePop(0.8);
      this.showToast('Removed rug 🗑️');
      return;
    }

    idx = this.benches.indexOf(item);
    if (idx !== -1 && this.benches.length > 1) {
      this.benches.splice(idx, 1);
      this.selectedFurniture = null;
      document.getElementById('btn-delete-selected').classList.add('hidden');
      window.gameAudio.playBubblePop(0.8);
      this.showToast('Removed bench 🗑️');
      return;
    }
  }

  saveLayout() {
    const layout = {
      washers: this.washers.map(w => ({ id: w.id, x: w.x, y: w.y })),
      dryers: this.dryers.map(d => ({ id: d.id, x: d.x, y: d.y })),
      foldingTable: { x: this.foldingTable.x, y: this.foldingTable.y },
      counter: { x: this.counter.x, y: this.counter.y },
      soapStation: { x: this.soapStation.x, y: this.soapStation.y },
      benches: this.benches.map(b => ({ id: b.id, x: b.x, y: b.y })),
      arcade: { x: this.arcade.x, y: this.arcade.y },
      customRugs: this.customRugs,
      customDecor: this.customDecor,
    };
    try {
      localStorage.setItem('trash_panda_layout', JSON.stringify(layout));
    } catch (e) {
      console.warn('LocalStorage save layout failed', e);
    }
  }

  loadLayoutData() {
    try {
      const raw = localStorage.getItem('trash_panda_layout');
      if (raw) {
        const layout = JSON.parse(raw);
        if (layout.washers) {
          layout.washers.forEach(sw => {
            const w = this.washers.find(item => item.id === sw.id);
            if (w) { w.x = sw.x; w.y = sw.y; }
          });
        }
        if (layout.dryers) {
          layout.dryers.forEach(sd => {
            const d = this.dryers.find(item => item.id === sd.id);
            if (d) { d.x = sd.x; d.y = sd.y; }
          });
        }
        if (layout.foldingTable && this.foldingTable) {
          this.foldingTable.x = layout.foldingTable.x;
          this.foldingTable.y = layout.foldingTable.y;
        }
        if (layout.counter && this.counter) {
          this.counter.x = layout.counter.x;
          this.counter.y = layout.counter.y;
        }
        if (layout.soapStation && this.soapStation) {
          this.soapStation.x = layout.soapStation.x;
          this.soapStation.y = layout.soapStation.y;
        }
        if (layout.benches && layout.benches.length > 0) {
          layout.benches.forEach(sb => {
            const b = this.benches.find(item => item.id === sb.id);
            if (b) { b.x = sb.x; b.y = sb.y; }
          });
        }
        if (layout.arcade && this.arcade) {
          this.arcade.x = layout.arcade.x;
          this.arcade.y = layout.arcade.y;
        }
        if (layout.customRugs) this.customRugs = layout.customRugs;
        if (layout.customDecor) this.customDecor = layout.customDecor;
      }
    } catch (e) {
      console.warn('LocalStorage load layout failed', e);
    }
  }

  // --- AUDIO CONTROLS ---

  toggleSound() {
    const on = window.gameAudio.toggleSound();
    document.getElementById('sound-icon').textContent = on ? '🔊' : '🔇';
    this.showToast(on ? 'Sound Enabled' : 'Sound Muted');
  }

  toggleMusic() {
    const on = window.gameAudio.toggleMusic();
    document.getElementById('music-icon').textContent = on ? '🎵' : '🔇';
    this.showToast(on ? 'Lofi Music Enabled' : 'Music Paused');
  }

  togglePause(forceState) {
    if (this.isLayoutMode) return;
    const modal = document.getElementById('modal-pause');
    const isOpening = forceState !== undefined ? forceState : modal.classList.contains('hidden');
    if (isOpening) {
      this.closeAllModals();
      this.isPaused = true;
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
      this.isPaused = false;
    }
  }

  showToast(message, icon = '✨') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(50px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  // --- GAME START & LOOP ---

  startGame() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
    this.showToast('Welcome to Barnaby\'s Laundromat! 🦝🧼');
  }

  gameLoop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (!this.isPaused && !this.isLayoutMode) {
      this.update(dt);
    }

    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  getMaxStaffSlots() {
    return Math.min(this.staffCandidates.length, Math.max(1, this.reputationLevel));
  }

  // --- UPDATE LOGIC ---

  update(dt) {
    this.renderer.update(dt);

    this.updateDayTimer(dt);
    this.updatePlayer(dt);

    if (this.hiredStaff.length > 0) {
      this.updateHelpers(dt);
    }

    this.updateMachines(dt);
    this.updateFoldingTable(dt);
    this.updateCustomers(dt);
    this.updateBubbles(dt);
    this.updateParticles(dt);
    this.updateInteractionPrompt();
  }

  updateDayTimer(dt) {
    this.dayTime += dt * this.timeScale;

    const totalMin = Math.floor(this.dayTime);
    const hrs = Math.floor(totalMin / 60);
    const mins = totalMin % 60;
    const ampm = hrs >= 12 ? 'PM' : 'AM';
    const displayHrs = hrs > 12 ? hrs - 12 : (hrs === 0 ? 12 : hrs);
    const formattedMins = mins < 10 ? `0${mins}` : mins;

    document.getElementById('time-display').textContent = `Day ${this.day} • ${displayHrs}:${formattedMins} ${ampm}`;

    // Hourly Wage Deduction ($12 / game hour per hired employee)
    if (hrs > this.lastWageHour && this.hiredStaff.length > 0) {
      this.lastWageHour = hrs;
      const totalHourlyWage = this.hiredStaff.length * this.hourlyWage;
      if (this.money >= totalHourlyWage) {
        this.money -= totalHourlyWage;
        this.dailyWagesPaid += totalHourlyWage;
        this.hiredStaff.forEach(h => {
          h.hoursWorked = (h.hoursWorked || 0) + 1;
          this.createCoinParticle(h.x, h.y - 20, `-🪙${this.hourlyWage} Wage`);
        });
        this.showToast(`Paid 🪙${totalHourlyWage} wages to ${this.hiredStaff.length} staff member${this.hiredStaff.length > 1 ? 's' : ''} 💼`);
        this.updateHUD();
      } else {
        this.showToast(`⚠️ Insufficient coins to pay full staff wages! (Needed 🪙${totalHourlyWage})`, '💸');
      }
    }

    if (this.dayTime >= this.dayEndMinutes) {
      this.endDayShift();
    }
  }

  endDayShift() {
    this.isPaused = true;
    window.gameAudio.playUpgrade();

    const netProfit = (this.dailyStats.revenue + this.dailyStats.tips) - this.dailyWagesPaid;

    document.getElementById('summary-day-title').textContent = `Day ${this.day} Shift Report`;
    document.getElementById('stat-loads').textContent = this.dailyStats.loads;
    document.getElementById('stat-customers').textContent = this.dailyStats.customers;
    document.getElementById('stat-revenue').textContent = `+🪙 ${this.dailyStats.revenue}`;
    document.getElementById('stat-tips').textContent = `+🪙 ${this.dailyStats.tips}`;
    document.getElementById('stat-trinkets').textContent = this.dailyStats.trinkets;
    document.getElementById('stat-total-profit').textContent = `🪙 ${Math.max(0, netProfit)} (Wages: -🪙${this.dailyWagesPaid})`;

    document.getElementById('modal-summary').classList.remove('hidden');
    this.saveGameData();
  }

  startNewDay() {
    this.day++;
    this.dayTime = 9 * 60;
    this.lastWageHour = 9;
    this.dailyWagesPaid = 0;
    this.dailyStats = { loads: 0, customers: 0, revenue: 0, tips: 0, trinkets: 0 };
    this.customers = [];
    this.bubbles = [];
    this.isPaused = false;
    this.updateHUD();
    this.showToast(`Good morning! Day ${this.day} begins ☀️`);
  }

  // --- PLAYER MOVEMENT & COLLISION RESOLUTION ---

  updatePlayer(dt) {
    const p = this.player;

    let moveSpeed = p.baseSpeed;
    if (this.upgrades.rollerSkates) moveSpeed *= 1.4;
    if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || p.isZooming) {
      moveSpeed *= 1.35;
      p.isZooming = true;
    } else {
      p.isZooming = false;
    }
    p.hasSkates = this.upgrades.rollerSkates;

    let dx = 0;
    let dy = 0;

    if (this.keys['KeyA'] || this.keys['ArrowLeft']) dx -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) dx += 1;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) dy -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) dy += 1;

    if (this.touchJoystick.active) {
      dx = this.touchJoystick.dx;
      dy = this.touchJoystick.dy;
    }

    if (this.mouseTarget && dx === 0 && dy === 0) {
      const targetDist = Math.hypot(this.mouseTarget.x - p.x, this.mouseTarget.y - p.y);
      if (targetDist > 12) {
        dx = (this.mouseTarget.x - p.x) / targetDist;
        dy = (this.mouseTarget.y - p.y) / targetDist;
      } else {
        this.mouseTarget = null;
        if (this.pendingInteractTarget) {
          this.handlePlayerAction();
          this.pendingInteractTarget = null;
        }
      }
    } else if (dx !== 0 || dy !== 0) {
      this.mouseTarget = null;
      this.pendingInteractTarget = null;
    }

    const len = Math.hypot(dx, dy);
    if (len > 0) {
      p.vx = (dx / len) * moveSpeed;
      p.vy = (dy / len) * moveSpeed;
      if (dx > 0.05) p.facing = 1;
      else if (dx < -0.05) p.facing = -1;

      if (Math.random() < 0.08) {
        window.gameAudio.playPawStep();
      }
    } else {
      p.vx = 0;
      p.vy = 0;
    }

    p.x += p.vx * dt;
    this.resolveCollisions(p);

    p.y += p.vy * dt;
    this.resolveCollisions(p);

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      if (Math.hypot(p.x - b.x, p.y - b.y) < p.radius + b.radius) {
        this.popBubble(i);
      }
    }
  }

  // --- MULTI-STAFF AUTOMATION ENGINE ---

  updateHelpers(dt) {
    this.hiredStaff.forEach(h => this.updateHelperEntity(h, dt));
  }

  updateHelperEntity(h, dt) {
    // 1. If not carrying anything: find best available unclaimed task
    if (!h.carrying) {
      // A. Finished Washer ready for Dryer?
      const finishedWasher = this.washers.find(w => w.unlocked && w.state === 'done');
      const emptyDryer = this.dryers.find(d => d.unlocked && d.state === 'empty');
      if (finishedWasher && emptyDryer) {
        this.moveEntityTowards(h, finishedWasher.x + 30, finishedWasher.y + 40, dt);
        if (this.getDistToRect(h.x, h.y, finishedWasher.x, finishedWasher.y, finishedWasher.width, finishedWasher.height) < 45) {
          finishedWasher.state = 'empty';
          h.carrying = { type: 'clean_wet_basket', customerId: finishedWasher.customerId };
          finishedWasher.customerId = null;
          window.gameAudio.playBubblePop();
        }
        return;
      }

      // B. Finished Dryer ready for Folding Table?
      const finishedDryer = this.dryers.find(d => d.unlocked && d.state === 'done');
      if (finishedDryer && !this.foldingTable.isFolding && !this.foldingTable.hasStack) {
        this.moveEntityTowards(h, finishedDryer.x + 30, finishedDryer.y + 40, dt);
        if (this.getDistToRect(h.x, h.y, finishedDryer.x, finishedDryer.y, finishedDryer.width, finishedDryer.height) < 45) {
          finishedDryer.state = 'empty';
          h.carrying = { type: 'dry_basket', customerId: finishedDryer.customerId };
          finishedDryer.customerId = null;
          window.gameAudio.playFold();
        }
        return;
      }

      // C. Folded stack ready for Delivery to Customer?
      if (this.foldingTable.hasStack) {
        this.moveEntityTowards(h, this.foldingTable.x + 70, this.foldingTable.y - 20, dt);
        if (this.getDistToRect(h.x, h.y, this.foldingTable.x, this.foldingTable.y, this.foldingTable.width, this.foldingTable.height) < 45) {
          h.carrying = { type: 'folded_clothes', customerId: this.foldingTable.customerId };
          this.foldingTable.hasStack = false;
          this.foldingTable.customerId = null;
          window.gameAudio.playDing();
        }
        return;
      }

      // D. Dirty laundry intake from waiting customer at counter
      const waitingCust = this.customers.find(c => c.state === 'waiting_intake');
      const emptyWasher = this.washers.find(w => w.unlocked && w.state === 'empty');
      if (waitingCust && emptyWasher) {
        this.moveEntityTowards(h, this.counter.x + 60, this.counter.y - 20, dt);
        if (this.getDistToRect(h.x, h.y, this.counter.x, this.counter.y, this.counter.width, this.counter.height) < 55) {
          h.carrying = { type: 'dirty_basket', customerId: waitingCust.id };
          waitingCust.state = 'waiting_wash';
          this.assignWaitingSpot(waitingCust);
          window.gameAudio.playBubblePop();
          this.showToast(`${h.name} accepted laundry from ${waitingCust.name}! 🧺`);
        }
        return;
      }

      // Idle patrol near folding table with distinct offset per worker
      const idleOffset = (this.hiredStaff.indexOf(h) - (this.hiredStaff.length - 1) / 2) * 45;
      this.moveEntityTowards(h, this.foldingTable.x + 40 + idleOffset, this.foldingTable.y - 30, dt);
    }
    // 2. Carrying Dirty Basket -> Load Empty Washer
    else if (h.carrying.type === 'dirty_basket') {
      const emptyWasher = this.washers.find(w => w.unlocked && w.state === 'empty');
      if (emptyWasher) {
        this.moveEntityTowards(h, emptyWasher.x + 30, emptyWasher.y + 40, dt);
        if (this.getDistToRect(h.x, h.y, emptyWasher.x, emptyWasher.y, emptyWasher.width, emptyWasher.height) < 45) {
          emptyWasher.customerId = h.carrying.customerId;
          h.carrying = null;
          if (this.upgrades.autoSoap || h.id === 'oliver') {
            emptyWasher.state = 'washing';
            emptyWasher.progress = 0;
            emptyWasher.soapType = this.upgrades.glitterSoap ? 'glitter' : 'regular';
            window.gameAudio.playBubblePop(1.4);
            this.showToast(`${h.name} loaded & soaped Washer #${emptyWasher.id}! 🫧`);
          } else {
            emptyWasher.state = 'needs_soap';
            window.gameAudio.playFold();
            this.showToast(`${h.name} loaded Washer #${emptyWasher.id}! 🧼`);
          }
        }
      }
    }
    // 3. Carrying Clean Wet Basket -> Load Empty Dryer
    else if (h.carrying.type === 'clean_wet_basket') {
      const emptyDryer = this.dryers.find(d => d.unlocked && d.state === 'empty');
      if (emptyDryer) {
        this.moveEntityTowards(h, emptyDryer.x + 30, emptyDryer.y + 40, dt);
        if (this.getDistToRect(h.x, h.y, emptyDryer.x, emptyDryer.y, emptyDryer.width, emptyDryer.height) < 45) {
          emptyDryer.state = 'drying';
          emptyDryer.progress = 0;
          emptyDryer.customerId = h.carrying.customerId;
          h.carrying = null;
          window.gameAudio.playFold();
          this.showToast(`${h.name} loaded Dryer #${emptyDryer.id}! ♨️`);
        }
      }
    }
    // 4. Carrying Dry Basket -> Load Folding Table
    else if (h.carrying.type === 'dry_basket') {
      if (!this.foldingTable.isFolding && !this.foldingTable.hasStack) {
        this.moveEntityTowards(h, this.foldingTable.x + 70, this.foldingTable.y - 20, dt);
        if (this.getDistToRect(h.x, h.y, this.foldingTable.x, this.foldingTable.y, this.foldingTable.width, this.foldingTable.height) < 45) {
          this.foldingTable.isFolding = true;
          this.foldingTable.progress = 0;
          // Pippin the Bunny folds twice as fast
          if (h.id === 'pippin') {
            this.foldingTable.totalTime = Math.min(this.foldingTable.totalTime, 1.2);
          }
          this.foldingTable.customerId = h.carrying.customerId;
          h.carrying = null;
          window.gameAudio.playFold();
          this.showToast(`${h.name} started folding! 🐾✨`);
        }
      }
    }
    // 5. Carrying Folded Clothes -> Deliver to Customer at Counter / Lounge
    else if (h.carrying.type === 'folded_clothes') {
      let targetCust = this.customers.find(c => c.id === h.carrying.customerId) || this.customers.find(c => c.state === 'ready_for_pickup' || c.state === 'waiting_wash');
      if (targetCust) {
        this.moveEntityTowards(h, targetCust.x, targetCust.y + 20, dt);
        if (Math.hypot(h.x - targetCust.x, h.y - targetCust.y) < 55) {
          this.completeCustomerOrder(targetCust);
          h.carrying = null;
          this.showToast(`${h.name} delivered laundry to ${targetCust.name}! 💖`);
        }
      }
    }
  }

  moveEntityTowards(entity, targetX, targetY, dt) {
    const dx = targetX - entity.x;
    const dy = targetY - entity.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 6) {
      entity.vx = (dx / dist) * entity.speed;
      entity.vy = (dy / dist) * entity.speed;
      entity.x += entity.vx * dt;
      entity.y += entity.vy * dt;
      entity.facing = dx > 0 ? 1 : -1;
      this.resolveCollisions(entity);
    } else {
      entity.vx = 0;
      entity.vy = 0;
    }
  }

  // --- MACHINES WORKFLOW ---

  updateMachines(dt) {
    this.washers.forEach(w => {
      if (!w.unlocked) return;

      if (w.state === 'washing') {
        w.progress += dt;
        if (Math.random() < 0.05) {
          this.createBubble(w.x + w.width / 2 + (Math.random() * 20 - 10), w.y + 30);
        }
        if (w.progress >= w.totalTime) {
          w.state = 'done';
          window.gameAudio.playDing();
          this.createSparkles(w.x + w.width / 2, w.y + 40, 8);
        }
      }
    });

    this.dryers.forEach(d => {
      if (!d.unlocked) return;

      if (d.state === 'drying') {
        d.progress += dt;
        if (d.progress >= d.totalTime) {
          d.state = 'done';
          window.gameAudio.playDing();
          this.createSparkles(d.x + d.width / 2, d.y + 40, 8);
        }
      }
    });
  }

  updateFoldingTable(dt) {
    const ft = this.foldingTable;
    if (ft.isFolding) {
      ft.progress += dt;
      if (Math.random() < 0.15) {
        window.gameAudio.playFold();
      }
      if (ft.progress >= ft.totalTime) {
        ft.isFolding = false;
        ft.hasStack = true;
        window.gameAudio.playDing();
        this.createSparkles(ft.x + ft.width / 2, ft.y + 20, 12);

        const targetCust = this.customers.find(c => c.id === ft.customerId) || this.customers.find(c => c.state === 'waiting_wash');
        if (targetCust) {
          targetCust.state = 'ready_for_pickup';
          window.gameAudio.playCustomerChirp(true);
        }

        const trinketChance = this.upgrades.glitterSoap ? 0.65 : 0.35;
        if (Math.random() < trinketChance) {
          this.discoverRandomTrinket();
        }
      }
    }
  }

  // --- CUSTOMERS AI ---

  updateCustomers(dt) {
    this.customerSpawnTimer -= dt;
    if (this.customerSpawnTimer <= 0 && this.customers.length < 5) {
      this.spawnCustomer();
      this.customerSpawnTimer = 7 + Math.random() * 7;
    }

    // If Capybara is hired, patience drops 30% slower
    const hasCapy = this.hiredStaff.some(s => s.id === 'capy');
    const patienceDecay = hasCapy ? dt * 0.7 : dt;

    for (let i = this.customers.length - 1; i >= 0; i--) {
      const c = this.customers[i];

      if (c.state === 'waiting_intake' || c.state === 'waiting_wash') {
        c.patience -= patienceDecay;
        if (c.patience <= 0) {
          c.state = 'leaving_angry';
          window.gameAudio.playCustomerChirp(false);
          this.showToast(`${c.name} ran out of time! 😿`, '⏳');
          this.freeCustomerSpot(c);
        }
      }

      if (c.state === 'entering') {
        this.moveEntityTowards(c, this.counter.x + 60, this.counter.y - 20, dt);
        if (Math.hypot(c.x - (this.counter.x + 60), c.y - (this.counter.y - 20)) < 25) {
          c.state = 'waiting_intake';
          window.gameAudio.playCustomerChirp(true);
        }
      } else if (c.state === 'waiting_wash') {
        if (c.targetSpot) {
          this.moveEntityTowards(c, c.targetSpot.x, c.targetSpot.y, dt);
        }
      } else if (c.state === 'ready_for_pickup') {
        this.moveEntityTowards(c, this.counter.x + 60, this.counter.y - 20, dt);
      } else if (c.state === 'happy_leaving' || c.state === 'leaving_angry') {
        this.moveEntityTowards(c, this.width + 40, 480, dt);
        if (c.x >= this.width + 30) {
          this.freeCustomerSpot(c);
          this.customers.splice(i, 1);
        }
      }
    }
  }

  spawnCustomer() {
    const speciesList = ['bear', 'fox', 'owl', 'bunny', 'capybara', 'possum'];
    const names = {
      bear: 'Bramble the Bear',
      fox: 'Fiona the Fox',
      owl: 'Oliver the Owl',
      bunny: 'Pippin the Bunny',
      capybara: 'Capy the Capybara',
      possum: 'Jasper the Possum',
    };

    const chosenSpecies = speciesList[Math.floor(Math.random() * speciesList.length)];
    const basePatience = this.upgrades.arcadeCabinet ? 95 : 70;

    const customer = {
      id: Date.now() + Math.random(),
      type: chosenSpecies,
      name: names[chosenSpecies],
      x: -40,
      y: 480,
      vx: 0,
      vy: 0,
      speed: 100,
      radius: 16,
      facing: 1,
      state: 'entering',
      patience: basePatience,
      maxPatience: basePatience,
      targetSpot: null,
      requestedBasket: 'dirty',
      hasPaidTip: false,
    };

    this.customers.push(customer);
  }

  assignWaitingSpot(customer) {
    if (this.arcade.unlocked && !this.arcade.occupiedBy) {
      this.arcade.occupiedBy = customer;
      customer.targetSpot = { x: this.arcade.x + 20, y: this.arcade.y + 45 };
      return;
    }

    for (let b of this.benches) {
      if (!b.occupiedBy) {
        b.occupiedBy = customer;
        customer.targetSpot = { x: b.x + (b.width || 90) / 2, y: b.y + (b.height || 36) / 2 };
        return;
      }
    }

    customer.targetSpot = { x: 100 + Math.random() * 80, y: 320 + Math.random() * 40 };
  }

  freeCustomerSpot(customer) {
    if (this.arcade.occupiedBy === customer) this.arcade.occupiedBy = null;
    for (let b of this.benches) {
      if (b.occupiedBy === customer) b.occupiedBy = null;
    }
  }

  // --- ITEM CARRYING & DROP SYSTEM ---

  dropCarriedItem() {
    const p = this.player;
    if (!p.carrying) return;

    const dropX = Math.max(45, Math.min(this.width - 45, p.x + (p.facing * 28)));
    const dropY = Math.max(230, Math.min(this.height - 45, p.y + 10));

    this.droppedItems.push({
      id: `drop_${Date.now()}_${Math.random()}`,
      ...p.carrying,
      x: dropX,
      y: dropY,
    });

    const droppedName = this.getItemDisplayName(p.carrying);
    p.carrying = null;
    window.gameAudio.playFold();
    this.showToast(`Set down ${droppedName} on the floor! 🧺 (Press [SPACE] or [Q] to pick up)`);
    this.updateHUD();
  }

  getItemDisplayName(carrying) {
    if (!carrying) return 'Nothing';
    if (carrying.type === 'dirty_basket') return 'Dirty Basket';
    if (carrying.type === 'clean_wet_basket') return 'Clean Wet Basket';
    if (carrying.type === 'dry_basket') return 'Dry Clothes Basket';
    if (carrying.type === 'folded_clothes') return 'Folded Laundry Stack';
    if (carrying.type === 'soap') return `${(carrying.soapType || 'regular').toUpperCase()} Soap`;
    return 'Item';
  }

  // --- PLAYER ACTION DISPATCHER WITH SMART ITEM SWAPPING ---

  handlePlayerAction() {
    const p = this.player;

    // 0. Check Dropped Items on the floor first (Pick up or Swap)
    for (let i = this.droppedItems.length - 1; i >= 0; i--) {
      const item = this.droppedItems[i];
      if (Math.hypot(p.x - item.x, p.y - item.y) < 65) {
        this.droppedItems.splice(i, 1);
        if (p.carrying) {
          // Swap: set current item down on floor, pick up this one
          const oldCarrying = p.carrying;
          p.carrying = { type: item.type, customerId: item.customerId, soapType: item.soapType };
          this.droppedItems.push({
            id: `drop_${Date.now()}`,
            ...oldCarrying,
            x: item.x,
            y: item.y,
          });
          window.gameAudio.playFold();
          this.showToast(`Swapped for ${this.getItemDisplayName(p.carrying)}! 🔄`);
        } else {
          p.carrying = { type: item.type, customerId: item.customerId, soapType: item.soapType };
          window.gameAudio.playFold();
          this.showToast(`Picked up ${this.getItemDisplayName(p.carrying)}! 🧺`);
        }
        this.updateHUD();
        return;
      }
    }

    // 1. Deliver folded laundry to customer
    if (p.carrying && p.carrying.type === 'folded_clothes') {
      let targetCust = this.customers.find(c => c.id === p.carrying.customerId);
      if (!targetCust) {
        targetCust = this.customers.find(c => c.state === 'ready_for_pickup' || c.state === 'waiting_wash');
      }

      if (targetCust) {
        const distCust = Math.hypot(p.x - targetCust.x, p.y - targetCust.y);
        const distCounter = this.getDistToRect(p.x, p.y, this.counter.x, this.counter.y, this.counter.width, this.counter.height);

        if (distCust < 85 || distCounter < 80) {
          this.completeCustomerOrder(targetCust);
          p.carrying = null;
          this.updateHUD();
          return;
        }
      }
    }

    // 2. Folding table interaction
    const distToTable = this.getDistToRect(p.x, p.y, this.foldingTable.x, this.foldingTable.y, this.foldingTable.width, this.foldingTable.height);
    if (distToTable < 75) {
      const ft = this.foldingTable;
      if (!ft.isFolding && !ft.hasStack && p.carrying && p.carrying.type === 'dry_basket') {
        ft.customerId = p.carrying.customerId;
        p.carrying = null;
        ft.isFolding = true;
        ft.progress = 0;
        window.gameAudio.playFold();
        this.showToast('Barnaby folding clothes with rapid paws! 🐾');
        this.updateHUD();
        return;
      }
      if (ft.hasStack) {
        if (p.carrying) {
          // Auto-drop current item to take folded stack!
          this.dropCarriedItem();
        }
        p.carrying = { type: 'folded_clothes', customerId: ft.customerId };
        ft.hasStack = false;
        ft.customerId = null;
        window.gameAudio.playDing();
        this.showToast('Folded stack ready for customer pickup! ✨');
        this.updateHUD();
        return;
      }
    }

    // 3. Dryers interaction
    for (let d of this.dryers) {
      if (!d.unlocked) continue;
      const distD = this.getDistToRect(p.x, p.y, d.x, d.y, d.width, d.height);
      if (distD < 70) {
        if (d.state === 'empty' && p.carrying && p.carrying.type === 'clean_wet_basket') {
          d.customerId = p.carrying.customerId;
          p.carrying = null;
          d.state = 'drying';
          d.progress = 0;
          window.gameAudio.playFold();
          this.showToast(`Dryer #${d.id} spinning warm! ♨️`);
          this.updateHUD();
          return;
        }
        if (d.state === 'done') {
          if (p.carrying) {
            // Auto-drop current item to pick up dry basket!
            this.dropCarriedItem();
          }
          p.carrying = { type: 'dry_basket', customerId: d.customerId };
          d.state = 'empty';
          d.customerId = null;
          window.gameAudio.playFold();
          this.showToast(`Dry clothes collected from Dryer #${d.id}! Ready to fold 👕`);
          this.updateHUD();
          return;
        }
      }
    }

    // 4. Washers interaction
    for (let w of this.washers) {
      if (!w.unlocked) continue;
      const distW = this.getDistToRect(p.x, p.y, w.x, w.y, w.width, w.height);
      if (distW < 70) {
        if (w.state === 'empty' && p.carrying && p.carrying.type === 'dirty_basket') {
          w.customerId = p.carrying.customerId;
          p.carrying = null;

          if (this.upgrades.autoSoap) {
            w.state = 'washing';
            w.progress = 0;
            w.soapType = this.upgrades.glitterSoap ? 'glitter' : 'regular';
            window.gameAudio.playBubblePop(1.4);
            this.showToast(`Auto-Soap injected! Washer #${w.id} spinning 🫧`);
          } else {
            w.state = 'needs_soap';
            window.gameAudio.playFold();
            this.showToast(`Washer #${w.id} loaded! Add soap to start. 🧼`);
          }
          this.updateHUD();
          return;
        }

        if (w.state === 'needs_soap' && p.carrying && p.carrying.type === 'soap') {
          w.soapType = p.carrying.soapType;
          p.carrying = null;
          w.state = 'washing';
          w.progress = 0;
          window.gameAudio.playBubblePop(1.5);
          this.showToast(`Soap added! Washer #${w.id} cycle started 🫧`);
          this.updateHUD();
          return;
        }

        if (w.state === 'done') {
          if (p.carrying) {
            // Auto-drop current item to take clean basket!
            this.dropCarriedItem();
          }
          p.carrying = { type: 'clean_wet_basket', customerId: w.customerId };
          w.state = 'empty';
          w.customerId = null;
          window.gameAudio.playBubblePop();
          this.showToast(`Clean wet basket from Washer #${w.id}! 💧`);
          this.updateHUD();
          return;
        }
      }
    }

    // 5. Soap Shelf
    const distToSoap = this.getDistToRect(p.x, p.y, this.soapStation.x, this.soapStation.y, this.soapStation.width, this.soapStation.height);
    if (distToSoap < 75) {
      if (p.carrying && p.carrying.type === 'soap') {
        // Return soap
        p.carrying = null;
        window.gameAudio.playFold();
        this.showToast('Returned soap to shelf 🧼');
        this.updateHUD();
        return;
      } else {
        if (p.carrying) {
          // Auto-drop carried basket to grab soap!
          this.dropCarriedItem();
        }
        let soap = 'regular';
        if (this.upgrades.glitterSoap) soap = 'glitter';
        else if (this.upgrades.lavenderSoap) soap = 'lavender';

        p.carrying = { type: 'soap', soapType: soap };
        window.gameAudio.playBubblePop();
        this.showToast(`Grabbed ${soap.toUpperCase()} Soap! 🧼`);
        this.updateHUD();
        return;
      }
    }

    // 6. Intake Dirty Basket from Customer
    const distCounter = this.getDistToRect(p.x, p.y, this.counter.x, this.counter.y, this.counter.width, this.counter.height);
    const waitingCust = this.customers.find(c => c.state === 'waiting_intake');
    if (waitingCust) {
      const distCust = Math.hypot(p.x - waitingCust.x, p.y - waitingCust.y);
      if (distCust < 85 || distCounter < 80) {
        if (p.carrying) {
          // Auto-drop carried item to accept new laundry!
          this.dropCarriedItem();
        }
        p.carrying = { type: 'dirty_basket', customerId: waitingCust.id };
        waitingCust.state = 'waiting_wash';
        this.assignWaitingSpot(waitingCust);
        window.gameAudio.playBubblePop();
        this.showToast(`Accepted laundry from ${waitingCust.name}! 🧺`);
        this.updateHUD();
        return;
      }
    }
  }

  // --- REWARD & DELIVERY ---

  completeCustomerOrder(customer) {
    const basePay = 25;
    const patiencePct = customer.patience / customer.maxPatience;
    let tip = Math.round(15 * patiencePct);

    if (this.upgrades.lavenderSoap) tip += 8;
    if (this.upgrades.glitterSoap) tip += 15;

    const totalEarned = basePay + tip;
    this.money += totalEarned;
    this.dailyStats.loads++;
    this.dailyStats.customers++;
    this.dailyStats.revenue += basePay;
    this.dailyStats.tips += tip;

    this.reputationPoints += 10 + Math.round(tip / 2);
    if (this.reputationPoints >= this.reputationLevel * 80) {
      this.reputationLevel++;
      window.gameAudio.playUpgrade();
      this.showToast(`🎉 Laundromat leveled up to Level ${this.reputationLevel}! ⭐`);
    }

    window.gameAudio.playCoin();
    window.gameAudio.playCustomerChirp(true);
    this.createCoinParticle(customer.x, customer.y - 20, `+🪙 ${totalEarned}`);
    this.createSparkles(customer.x, customer.y - 10, 15);

    customer.state = 'happy_leaving';
    this.freeCustomerSpot(customer);
    this.updateHUD();
    this.showToast(`Delivered to ${customer.name}! Earned 🪙${totalEarned} 💖`);
  }

  discoverRandomTrinket() {
    const available = this.trinkets;
    const item = available[Math.floor(Math.random() * available.length)];
    item.count++;
    this.dailyStats.trinkets++;

    window.gameAudio.playTrinketFound();
    this.createCoinParticle(this.foldingTable.x + 70, this.foldingTable.y - 10, `${item.icon} Found ${item.name}!`);
    this.showToast(`Found shiny pocket treasure: ${item.name}! ${item.icon}`);
    this.updateTrinketBadge();
    this.saveGameData();
  }

  // --- BUBBLE BURST MINI-EVENT ---

  createBubble(x, y) {
    const colors = ['rgba(72, 202, 228, 0.5)', 'rgba(255, 142, 60, 0.5)', 'rgba(255, 0, 110, 0.4)', 'rgba(255, 190, 11, 0.5)'];
    this.bubbles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 40,
      vy: -20 - Math.random() * 30,
      radius: 12 + Math.random() * 14,
      color: colors[Math.floor(Math.random() * colors.length)],
      life: 10 + Math.random() * 5,
    });
  }

  updateBubbles(dt) {
    this.bubbleEventTimer -= dt;
    if (this.bubbleEventTimer <= 0) {
      for (let i = 0; i < 8; i++) {
        this.createBubble(250 + Math.random() * 450, 200 + Math.random() * 200);
      }
      this.bubbleEventTimer = 22 + Math.random() * 15;
    }

    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      b.x += Math.sin(this.renderer.time * 4 + i) * 0.4;

      if (b.y < 120 || b.life <= 0) {
        this.bubbles.splice(i, 1);
      }
    }
  }

  popBubble(index) {
    const b = this.bubbles[index];
    if (!b) return;

    this.bubbles.splice(index, 1);
    window.gameAudio.playBubblePop(1.2 + Math.random() * 0.6);

    if (Math.random() < 0.4) {
      this.money += 2;
      this.createCoinParticle(b.x, b.y, '+🪙2');
      this.updateHUD();
    }
    this.createSparkles(b.x, b.y, 6);
  }

  // --- PARTICLES ---

  createSparkles(x, y, count = 8) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x, y,
        vx: (Math.random() - 0.5) * 80,
        vy: (Math.random() - 0.5) * 80,
        alpha: 1,
        life: 0.6,
        size: 2 + Math.random() * 3,
        color: '#ffbe0b',
      });
    }
  }

  createCoinParticle(x, y, text) {
    this.particles.push({
      x, y,
      vx: 0,
      vy: -35,
      text,
      alpha: 1.2,
      scale: 1,
      life: 1.2,
      isText: true,
    });
  }

  updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      p.alpha = p.life;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  // --- INTERACTION FOCUS & PROMPT ---

  updateInteractionPrompt() {
    if (this.isLayoutMode) return;

    const promptEl = document.getElementById('interaction-prompt');
    const p = this.player;

    let promptText = null;
    this.focusedInteractive = null;

    // 0. Check Dropped Items on the floor
    for (let item of this.droppedItems) {
      if (Math.hypot(p.x - item.x, p.y - item.y) < 65) {
        promptText = p.carrying ? `Swap for ${this.getItemDisplayName(item)} [SPACE / Q]` : `Pick Up ${this.getItemDisplayName(item)} [SPACE]`;
        this.focusedInteractive = { x: item.x, y: item.y, radius: 22 };
        break;
      }
    }

    if (!promptText && p.carrying && p.carrying.type === 'folded_clothes') {
      const targetCust = this.customers.find(c => (c.state === 'ready_for_pickup' || c.state === 'waiting_wash') && Math.hypot(p.x - c.x, p.y - c.y) < 85);
      const distCounter = this.getDistToRect(p.x, p.y, this.counter.x, this.counter.y, this.counter.width, this.counter.height);

      if (targetCust) {
        promptText = `Deliver Laundry to ${targetCust.name} ✨`;
        this.focusedInteractive = { x: targetCust.x, y: targetCust.y, radius: 25 };
      } else if (distCounter < 80) {
        promptText = 'Deliver Clean Laundry ✨';
        this.focusedInteractive = { x: this.counter.x + this.counter.width / 2, y: this.counter.y + this.counter.height / 2, radius: 45 };
      }
    }

    if (!promptText) {
      const distTable = this.getDistToRect(p.x, p.y, this.foldingTable.x, this.foldingTable.y, this.foldingTable.width, this.foldingTable.height);
      if (distTable < 75) {
        const ft = this.foldingTable;
        if (!ft.isFolding && !ft.hasStack && p.carrying && p.carrying.type === 'dry_basket') {
          promptText = 'Fold Dry Clothes 🐾';
          this.focusedInteractive = { x: ft.x + ft.width / 2, y: ft.y + ft.height / 2, radius: 55 };
        } else if (ft.hasStack) {
          promptText = p.carrying ? 'Swap & Pick Up Folded Stack ✨' : 'Pick Up Folded Stack ✨';
          this.focusedInteractive = { x: ft.x + ft.width / 2, y: ft.y + ft.height / 2, radius: 55 };
        }
      }
    }

    if (!promptText) {
      for (let d of this.dryers) {
        if (!d.unlocked) continue;
        const distD = this.getDistToRect(p.x, p.y, d.x, d.y, d.width, d.height);
        if (distD < 70) {
          if (d.state === 'empty' && p.carrying && p.carrying.type === 'clean_wet_basket') {
            promptText = `Load Dryer #${d.id} ♨️`;
            this.focusedInteractive = { x: d.x + d.width / 2, y: d.y + d.height / 2, radius: 34 };
            break;
          } else if (d.state === 'done') {
            promptText = p.carrying ? `Swap & Take Dry Clothes #${d.id} 👕` : `Take Dry Clothes from #${d.id} 👕`;
            this.focusedInteractive = { x: d.x + d.width / 2, y: d.y + d.height / 2, radius: 34 };
            break;
          }
        }
      }
    }

    if (!promptText) {
      for (let w of this.washers) {
        if (!w.unlocked) continue;
        const distW = this.getDistToRect(p.x, p.y, w.x, w.y, w.width, w.height);
        if (distW < 70) {
          if (w.state === 'empty' && p.carrying && p.carrying.type === 'dirty_basket') {
            promptText = `Load Washer #${w.id} 🧺`;
            this.focusedInteractive = { x: w.x + w.width / 2, y: w.y + w.height / 2, radius: 34 };
            break;
          } else if (w.state === 'needs_soap' && p.carrying && p.carrying.type === 'soap') {
            promptText = `Add Soap to Washer #${w.id} 🧼`;
            this.focusedInteractive = { x: w.x + w.width / 2, y: w.y + w.height / 2, radius: 34 };
            break;
          } else if (w.state === 'done') {
            promptText = p.carrying ? `Swap & Take Clean Basket #${w.id} 💧` : `Take Clean Clothes from #${w.id} 💧`;
            this.focusedInteractive = { x: w.x + w.width / 2, y: w.y + w.height / 2, radius: 34 };
            break;
          }
        }
      }
    }

    if (!promptText) {
      const distSoap = this.getDistToRect(p.x, p.y, this.soapStation.x, this.soapStation.y, this.soapStation.width, this.soapStation.height);
      if (distSoap < 75) {
        if (p.carrying && p.carrying.type === 'soap') {
          promptText = 'Return Soap to Shelf 🧼';
          this.focusedInteractive = { x: this.soapStation.x + this.soapStation.width / 2, y: this.soapStation.y + this.soapStation.height / 2, radius: 32 };
        } else {
          promptText = p.carrying ? 'Swap & Grab Soap 🧼' : 'Grab Detergent 🧼';
          this.focusedInteractive = { x: this.soapStation.x + this.soapStation.width / 2, y: this.soapStation.y + this.soapStation.height / 2, radius: 32 };
        }
      }
    }

    if (!promptText) {
      const waitingCust = this.customers.find(c => c.state === 'waiting_intake');
      const distCounter = this.getDistToRect(p.x, p.y, this.counter.x, this.counter.y, this.counter.width, this.counter.height);
      if (waitingCust) {
        const distCust = Math.hypot(p.x - waitingCust.x, p.y - waitingCust.y);
        if (distCust < 85 || distCounter < 80) {
          promptText = p.carrying ? `Swap & Take Dirty Laundry from ${waitingCust.name} 🧺` : `Take Dirty Laundry from ${waitingCust.name} 🧺`;
          this.focusedInteractive = { x: waitingCust.x, y: waitingCust.y, radius: 28 };
        }
      }
    }

    if (promptText) {
      promptEl.querySelector('.prompt-text').textContent = promptText;
      promptEl.classList.remove('hidden');
    } else {
      promptEl.classList.add('hidden');
    }
  }

  // --- SHOP & SCRAPBOOK ---

  toggleShop(forceState) {
    if (this.isLayoutMode) return;
    const modal = document.getElementById('modal-shop');
    const isOpening = forceState !== undefined ? forceState : modal.classList.contains('hidden');
    if (isOpening) {
      this.closeAllModals();
      this.isPaused = true;
      modal.classList.remove('hidden');
      this.renderShopItems('machines');
      document.getElementById('shop-money-display').textContent = `🪙 ${this.money}`;
      document.getElementById('shop-rep-display').textContent = `⭐ Level ${this.reputationLevel}`;
    } else {
      modal.classList.add('hidden');
      this.isPaused = false;
    }
  }

  renderShopItems(category) {
    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';

    const catalog = {
      machines: [
        { key: 'washer_2', name: 'Washer #2', icon: '🫧', cost: 100, desc: 'Add a 2nd washing machine to your floor.', isOwned: () => this.upgrades.washers >= 2, buy: () => { this.upgrades.washers = 2; this.initLayout(); this.saveLayout(); } },
        { key: 'washer_3', name: 'Washer #3', icon: '🫧', cost: 220, desc: 'Add a 3rd washing machine.', isOwned: () => this.upgrades.washers >= 3, buy: () => { this.upgrades.washers = 3; this.initLayout(); this.saveLayout(); } },
        { key: 'washer_4', name: 'Washer #4 (Deluxe)', icon: '✨🫧', cost: 400, desc: 'Full 4-washer industrial capacity setup.', isOwned: () => this.upgrades.washers >= 4, buy: () => { this.upgrades.washers = 4; this.initLayout(); this.saveLayout(); } },
        { key: 'dryer_2', name: 'Dryer #2', icon: '♨️', cost: 100, desc: 'Add a 2nd tumble dryer to your floor.', isOwned: () => this.upgrades.dryers >= 2, buy: () => { this.upgrades.dryers = 2; this.initLayout(); this.saveLayout(); } },
        { key: 'dryer_3', name: 'Dryer #3', icon: '♨️', cost: 220, desc: 'Add a 3rd tumble dryer.', isOwned: () => this.upgrades.dryers >= 3, buy: () => { this.upgrades.dryers = 3; this.initLayout(); this.saveLayout(); } },
        { key: 'dryer_4', name: 'Dryer #4 (Deluxe)', icon: '✨♨️', cost: 400, desc: 'Full 4-dryer high capacity.', isOwned: () => this.upgrades.dryers >= 4, buy: () => { this.upgrades.dryers = 4; this.initLayout(); this.saveLayout(); } },
        { key: 'turboWash', name: 'Turbo Spin Washers', icon: '⚡', cost: 150, desc: 'All washers run 35% faster!', isOwned: () => this.upgrades.turboWash, buy: () => { this.upgrades.turboWash = true; this.initLayout(); } },
        { key: 'fastDry', name: 'High-Heat Dryers', icon: '🔥', cost: 150, desc: 'All dryers run 35% faster!', isOwned: () => this.upgrades.fastDry, buy: () => { this.upgrades.fastDry = true; this.initLayout(); } },
      ],
      helpers: [
        { key: 'staffEspresso', name: 'Staff Break Espresso Bar', icon: '☕', cost: 180, desc: 'Hot gourmet brew gives all hired staff +25% movement & task speed!', isOwned: () => this.upgrades.staffEspresso, buy: () => { this.upgrades.staffEspresso = true; this.hiredStaff.forEach(s => s.speed = Math.round(s.speed * 1.25)); } },
        { key: 'rollerSkates', name: 'Barnaby\'s Roller Skates', icon: '🛼', cost: 120, desc: 'Zoom around the laundromat +40% faster!', isOwned: () => this.upgrades.rollerSkates, buy: () => { this.upgrades.rollerSkates = true; } },
        { key: 'autoSoap', name: 'Auto-Detergent Injector', icon: '🧪', cost: 250, desc: 'Washers automatically inject soap—no manual carrying needed!', isOwned: () => this.upgrades.autoSoap, buy: () => { this.upgrades.autoSoap = true; } },
        { key: 'steamPress', name: 'Steam Press Iron', icon: '💨', cost: 180, desc: 'Instant crisp folds at the folding table!', isOwned: () => this.upgrades.steamPress, buy: () => { this.upgrades.steamPress = true; this.initLayout(); } },
      ],
      amenities: [
        { key: 'arcadeCabinet', name: 'Retro Arcade: Trash Invaders', icon: '🕹️', cost: 200, desc: 'Customers play while waiting—massively increases patience!', isOwned: () => this.upgrades.arcadeCabinet, buy: () => { this.upgrades.arcadeCabinet = true; this.arcade.unlocked = true; this.saveLayout(); } },
      ],
      soaps: [
        { key: 'lavenderSoap', name: 'Lavender Bliss Soap', icon: '🪻', cost: 90, desc: 'Calming floral aroma gives +🪙8 extra tips per customer!', isOwned: () => this.upgrades.lavenderSoap, buy: () => { this.upgrades.lavenderSoap = true; } },
        { key: 'glitterSoap', name: 'Sparkle Glitter Suds', icon: '✨', cost: 220, desc: 'Glitter soap gives +🪙15 tips and doubles pocket trinket discovery chance!', isOwned: () => this.upgrades.glitterSoap, buy: () => { this.upgrades.glitterSoap = true; } },
      ]
    };

    const items = catalog[category] || [];
    items.forEach(item => {
      const owned = item.isOwned();
      const card = document.createElement('div');
      card.className = `shop-item-card ${owned ? 'purchased' : ''}`;
      card.innerHTML = `
        <div class="shop-item-header">
          <div class="shop-item-icon">${item.icon}</div>
          <div class="shop-item-info">
            <h3>${item.name}</h3>
            <p>${item.desc}</p>
          </div>
        </div>
        <div class="shop-item-footer">
          <span class="shop-item-cost">${owned ? '✅ INSTALLED' : `🪙 ${item.cost}`}</span>
          <button class="btn btn-primary btn-sm" ${owned ? 'disabled' : ''}>
            ${owned ? 'Owned' : 'Purchase'}
          </button>
        </div>
      `;

      const btn = card.querySelector('button');
      if (!owned) {
        btn.onclick = () => {
          if (this.money >= item.cost) {
            this.money -= item.cost;
            item.buy();
            window.gameAudio.playUpgrade();
            this.showToast(`Purchased ${item.name}! 🎉 (Placed on floor — press L to remodel)`);
            this.updateHUD();
            this.saveGameData();
            this.renderShopItems(category);
            document.getElementById('shop-money-display').textContent = `🪙 ${this.money}`;
          } else {
            this.showToast('Not enough coins! Keep washing laundry 🧺');
          }
        };
      }

      container.appendChild(card);
    });
  }

  toggleTrinkets(forceState) {
    if (this.isLayoutMode) return;
    const modal = document.getElementById('modal-trinkets');
    const isOpening = forceState !== undefined ? forceState : modal.classList.contains('hidden');
    if (isOpening) {
      this.closeAllModals();
      this.isPaused = true;
      modal.classList.remove('hidden');
      this.renderTrinkets();
    } else {
      modal.classList.add('hidden');
      this.isPaused = false;
    }
  }

  renderTrinkets() {
    const grid = document.getElementById('trinkets-grid');
    grid.innerHTML = '';

    this.trinkets.forEach(t => {
      const found = t.count > 0;
      const card = document.createElement('div');
      card.className = `trinket-card ${found ? 'discovered' : 'locked'}`;
      card.innerHTML = `
        <span class="trinket-icon">${found ? t.icon : '❓'}</span>
        <div class="trinket-name">${found ? t.name : 'Unknown Treasure'}</div>
        <div class="trinket-count">${found ? `Found: ${t.count}x` : 'Locked in pockets'}</div>
      `;
      grid.appendChild(card);
    });
  }

  updateTrinketBadge() {
    const discovered = this.trinkets.filter(t => t.count > 0).length;
    document.getElementById('trinket-count-badge').textContent = `${discovered}/12`;
  }

  updateHUD() {
    document.getElementById('money-display').textContent = this.money;
    document.getElementById('rep-display').textContent = `Lvl ${this.reputationLevel} (${this.reputationPoints}★)`;
    this.updateTrinketBadge();

    const staffBadge = document.getElementById('staff-count-badge');
    if (staffBadge) {
      staffBadge.textContent = `${this.hiredStaff.length}/${this.getMaxStaffSlots()}`;
    }

    // Update Carrying Indicator Pill
    const carryPill = document.getElementById('hud-carrying');
    if (carryPill) {
      const carryIcon = document.getElementById('carry-icon');
      const carryLabel = document.getElementById('carry-label');
      if (this.player.carrying) {
        carryPill.classList.remove('hidden');
        let icon = '🧺';
        let label = 'Basket';
        if (this.player.carrying.type === 'dirty_basket') { icon = '🧺'; label = 'Dirty Basket'; }
        else if (this.player.carrying.type === 'clean_wet_basket') { icon = '💧🧺'; label = 'Clean Wet'; }
        else if (this.player.carrying.type === 'dry_basket') { icon = '♨️🧺'; label = 'Dry Laundry'; }
        else if (this.player.carrying.type === 'folded_clothes') { icon = '✨👕'; label = 'Folded Stack'; }
        else if (this.player.carrying.type === 'soap') { icon = '🧼'; label = `${(this.player.carrying.soapType || 'regular').toUpperCase()} Soap`; }
        if (carryIcon) carryIcon.textContent = icon;
        if (carryLabel) carryLabel.textContent = label;
      } else {
        carryPill.classList.add('hidden');
      }
    }
  }

  // --- CRITTER EMPLOYMENT AGENCY ---

  toggleStaff(forceState) {
    if (this.isLayoutMode) return;
    const modal = document.getElementById('modal-staff');
    const isOpening = forceState !== undefined ? forceState : modal.classList.contains('hidden');
    if (isOpening) {
      this.closeAllModals();
      this.isPaused = true;
      modal.classList.remove('hidden');
      this.renderStaffModal();
    } else {
      modal.classList.add('hidden');
      this.isPaused = false;
    }
  }

  hireEmployee(candidateId) {
    const maxSlots = this.getMaxStaffSlots();
    if (this.hiredStaff.length >= maxSlots) {
      this.showToast(`Crew capacity full (${this.hiredStaff.length}/${maxSlots})! Level up to unlock more slots ⭐`);
      return;
    }

    if (this.hiredStaff.some(s => s.id === candidateId)) {
      this.showToast('Already on duty in your crew!');
      return;
    }

    const cand = this.staffCandidates.find(c => c.id === candidateId);
    if (!cand) return;

    let helperSpeed = 140;
    if (cand.id === 'fiona') helperSpeed = 195;
    if (cand.id === 'bramble') helperSpeed = 120;

    const offset = this.hiredStaff.length * 35;
    const newStaff = {
      id: cand.id,
      name: cand.name,
      species: cand.species,
      icon: cand.icon,
      trait: cand.trait,
      desc: cand.desc,
      wage: this.hourlyWage,
      hoursWorked: 0,
      x: this.counter.x + 80 + (offset % 120),
      y: this.counter.y - 20 + Math.floor(offset / 120) * 30,
      vx: 0,
      vy: 0,
      speed: helperSpeed,
      radius: 14,
      facing: 1,
      carrying: null,
      targetStation: null,
      stateTimer: 0,
    };

    this.hiredStaff.push(newStaff);
    window.gameAudio.playUpgrade();
    this.showToast(`Hired ${cand.name}! Crew: ${this.hiredStaff.length}/${maxSlots} 👔🐾`);
    this.renderStaffModal();
    this.updateHUD();
    this.saveGameData();
  }

  fireEmployee(candidateId) {
    const index = this.hiredStaff.findIndex(s => s.id === candidateId);
    if (index === -1) return;

    const staff = this.hiredStaff[index];
    if (staff.carrying) {
      // Drop whatever they were carrying on the floor
      this.droppedItems.push({
        id: `drop_${Date.now()}_${Math.random()}`,
        ...staff.carrying,
        x: staff.x,
        y: staff.y,
      });
    }

    this.hiredStaff.splice(index, 1);
    window.gameAudio.playBubblePop(0.7);
    this.showToast(`Dismissed ${staff.name}. Wage deductions stopped. 👋`);
    this.renderStaffModal();
    this.updateHUD();
    this.saveGameData();
  }

  renderStaffModal() {
    const currentSection = document.getElementById('current-employee-section');
    const candidatesGrid = document.getElementById('staff-candidates-grid');
    const maxSlots = this.getMaxStaffSlots();
    const isMaxLevel = maxSlots >= this.staffCandidates.length;

    // Capacity Banner & Active Staff List
    let bannerHtml = `
      <div class="staff-capacity-banner">
        <div class="capacity-title">
          👥 Active Crew: <strong>${this.hiredStaff.length} / ${maxSlots} Staff Slots</strong> (Laundromat Level ${this.reputationLevel})
        </div>
        <div class="capacity-unlock-hint">
          ${isMaxLevel ? '🌟 Max Crew Capacity Reached!' : `⭐ Level ${this.reputationLevel + 1} unlocks +1 Staff Slot!`}
        </div>
      </div>
    `;

    if (this.hiredStaff.length > 0) {
      let activeListHtml = '<div class="active-staff-list">';
      this.hiredStaff.forEach(staff => {
        activeListHtml += `
          <div class="current-employee-box">
            <div class="current-employee-info">
              <span class="employee-avatar-large">${staff.icon}</span>
              <div class="employee-details">
                <h3>${staff.name} <span class="badge">ON DUTY</span></h3>
                <p>${staff.trait} — ${staff.desc}</p>
                <span class="employee-wage-tag">Wage: 🪙${this.hourlyWage} / game hour • Worked: ${staff.hoursWorked || 0} hrs</span>
              </div>
            </div>
            <button class="btn btn-fire btn-fire-single" data-staff-id="${staff.id}">
              🔥 Fire ${staff.name.split(' ')[0]}
            </button>
          </div>
        `;
      });
      activeListHtml += '</div>';
      currentSection.innerHTML = bannerHtml + activeListHtml;

      currentSection.querySelectorAll('.btn-fire-single').forEach(btn => {
        btn.onclick = () => this.fireEmployee(btn.dataset.staffId);
      });
    } else {
      currentSection.innerHTML = bannerHtml + `
        <div class="no-employee-box">
          <p>🚫 No assistants currently on duty. Select candidates below to automate tasks (Up to ${maxSlots} at Level ${this.reputationLevel})!</p>
        </div>
      `;
    }

    candidatesGrid.innerHTML = '';
    this.staffCandidates.forEach(cand => {
      const isHired = this.hiredStaff.some(s => s.id === cand.id);
      const isFull = !isHired && this.hiredStaff.length >= maxSlots;
      const card = document.createElement('div');
      card.className = `candidate-card ${isHired ? 'purchased' : ''}`;
      card.innerHTML = `
        <div class="candidate-header">
          <span class="candidate-avatar">${cand.icon}</span>
          <div class="candidate-info">
            <h4>${cand.name}</h4>
            <span class="candidate-trait">${cand.trait}</span>
          </div>
        </div>
        <p class="candidate-desc">${cand.desc}</p>
        <div class="candidate-footer">
          <span class="candidate-wage">🪙 ${this.hourlyWage} / hr</span>
          <button class="btn ${isHired ? 'btn-danger' : (isFull ? 'btn-secondary' : 'btn-primary')} btn-sm" ${isFull ? 'disabled' : ''}>
            ${isHired ? '🔥 Fire' : (isFull ? `🔒 Capacity Full (Lvl ${this.reputationLevel + 1})` : '👔 Hire Assistant')}
          </button>
        </div>
      `;
      const btn = card.querySelector('button');
      if (isHired) {
        btn.onclick = () => this.fireEmployee(cand.id);
      } else if (!isFull) {
        btn.onclick = () => this.hireEmployee(cand.id);
      }
      candidatesGrid.appendChild(card);
    });
  }

  updateHUD() {
    document.getElementById('money-display').textContent = this.money;
    document.getElementById('rep-display').textContent = `Lvl ${this.reputationLevel} (${this.reputationPoints}★)`;
    this.updateTrinketBadge();

    const staffBadge = document.getElementById('staff-count-badge');
    if (staffBadge) {
      staffBadge.textContent = `${this.hiredStaff.length}/${this.getMaxStaffSlots()}`;
    }

    // Update Carrying Indicator Pill
    const carryPill = document.getElementById('hud-carrying');
    if (carryPill) {
      const carryIcon = document.getElementById('carry-icon');
      const carryLabel = document.getElementById('carry-label');
      if (this.player.carrying) {
        carryPill.classList.remove('hidden');
        let icon = '🧺';
        let label = 'Basket';
        if (this.player.carrying.type === 'dirty_basket') { icon = '🧺'; label = 'Dirty Basket'; }
        else if (this.player.carrying.type === 'clean_wet_basket') { icon = '💧🧺'; label = 'Clean Wet'; }
        else if (this.player.carrying.type === 'dry_basket') { icon = '♨️🧺'; label = 'Dry Laundry'; }
        else if (this.player.carrying.type === 'folded_clothes') { icon = '✨👕'; label = 'Folded Stack'; }
        else if (this.player.carrying.type === 'soap') { icon = '🧼'; label = `${(this.player.carrying.soapType || 'regular').toUpperCase()} Soap`; }
        if (carryIcon) carryIcon.textContent = icon;
        if (carryLabel) carryLabel.textContent = label;
      } else {
        carryPill.classList.add('hidden');
      }
    }
  }

  // --- SAVE & LOAD PERSISTENCE ---

  saveGameData() {
    const data = {
      money: this.money,
      reputationLevel: this.reputationLevel,
      reputationPoints: this.reputationPoints,
      day: this.day,
      upgrades: this.upgrades,
      hiredStaff: this.hiredStaff.map(s => ({ id: s.id, hoursWorked: s.hoursWorked || 0 })),
      trinkets: this.trinkets.map(t => ({ id: t.id, count: t.count })),
    };
    try {
      localStorage.setItem('trash_panda_save', JSON.stringify(data));
    } catch (e) {
      console.warn('LocalStorage save failed', e);
    }
    this.saveLayout();
  }

  loadSaveData() {
    try {
      const raw = localStorage.getItem('trash_panda_save');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.money !== undefined) this.money = data.money;
        if (data.reputationLevel !== undefined) this.reputationLevel = data.reputationLevel;
        if (data.reputationPoints !== undefined) this.reputationPoints = data.reputationPoints;
        if (data.day !== undefined) this.day = data.day;
        if (data.upgrades) this.upgrades = Object.assign(this.upgrades, data.upgrades);
        if (data.hiredStaff && Array.isArray(data.hiredStaff)) {
          this.hiredStaff = [];
          data.hiredStaff.forEach((saved, idx) => {
            const match = this.staffCandidates.find(c => c.id === saved.id);
            if (match) {
              let helperSpeed = 140;
              if (match.id === 'fiona') helperSpeed = 195;
              if (match.id === 'bramble') helperSpeed = 120;
              const offset = idx * 35;
              this.hiredStaff.push({
                id: match.id,
                name: match.name,
                species: match.species,
                icon: match.icon,
                trait: match.trait,
                desc: match.desc,
                wage: this.hourlyWage,
                hoursWorked: saved.hoursWorked || 0,
                x: 320 + (offset % 120),
                y: 300 + Math.floor(offset / 120) * 30,
                vx: 0,
                vy: 0,
                speed: helperSpeed,
                radius: 14,
                facing: 1,
                carrying: null,
                targetStation: null,
                stateTimer: 0,
              });
            }
          });
        }
        if (data.trinkets) {
          data.trinkets.forEach(saved => {
            const match = this.trinkets.find(t => t.id === saved.id);
            if (match) match.count = saved.count;
          });
        }
      }
    } catch (e) {
      console.warn('LocalStorage load failed', e);
    }
    this.loadLayoutData();
  }

  // --- RENDER PIPELINE ---

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Laundromat Floor & Wallpaper
    this.renderer.drawRoom(ctx, this.width, this.height);

    // 2. Draw Blueprint Grid if in Layout Editor Mode
    if (this.isLayoutMode) {
      this.renderer.drawBlueprintGrid(ctx, this.width, this.height, this.snapGridSize);
    }

    // 3. Draw Custom Rugs
    this.customRugs.forEach(rug => this.renderer.drawCustomRug(ctx, rug));

    // 4. Draw Furniture & Stations
    this.renderer.drawCounter(ctx, this.counter.x, this.counter.y, this.counter.width, this.counter.height);
    this.renderer.drawSoapStation(ctx, this.soapStation.x, this.soapStation.y, this.soapStation.width, this.soapStation.height);
    this.renderer.drawFoldingTable(ctx, this.foldingTable);

    // Benches, Arcade & Custom Decor
    this.benches.forEach(b => this.renderer.drawBench(ctx, b));
    if (this.arcade.unlocked) {
      this.renderer.drawArcade(ctx, this.arcade.x, this.arcade.y, this.arcade.width, this.arcade.height);
    }
    this.customDecor.forEach(decor => this.renderer.drawDecorItem(ctx, decor));

    // 5. Draw Washers & Dryers
    this.washers.forEach(w => {
      if (w.unlocked) this.renderer.drawWasher(ctx, w);
    });
    this.dryers.forEach(d => {
      if (d.unlocked) this.renderer.drawDryer(ctx, d);
    });

    // 6. Draw Dropped Items on the Floor
    this.droppedItems.forEach(item => {
      this.renderer.drawDroppedItem(ctx, item);
    });

    // 7. Draw Selection Boxes in Layout Mode
    if (this.isLayoutMode) {
      if (this.hoveredFurniture && this.hoveredFurniture !== this.selectedFurniture) {
        const item = this.hoveredFurniture;
        const w = item.width || item.w || 40;
        const h = item.height || item.h || 40;
        this.renderer.drawSelectionBox(ctx, item.x, item.y, w, h, true, false, item.name || 'Move');
      }
      if (this.selectedFurniture) {
        const item = this.selectedFurniture;
        const w = item.width || item.w || 40;
        const h = item.height || item.h || 40;
        this.renderer.drawSelectionBox(ctx, item.x, item.y, w, h, true, this.isDraggingFurniture, item.name || 'Selected');
      }
    } else {
      // Draw Active Interaction Halo under focused station/customer/dropped item
      if (this.focusedInteractive) {
        ctx.save();
        const pulse = (Math.sin(this.renderer.time * 6) + 1) * 0.2 + 0.5;
        ctx.fillStyle = `rgba(46, 196, 182, ${pulse * 0.25})`;
        ctx.strokeStyle = `rgba(255, 190, 11, ${pulse * 0.8})`;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.ellipse(this.focusedInteractive.x, this.focusedInteractive.y + 15, this.focusedInteractive.radius, this.focusedInteractive.radius * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 8. Draw Characters (Y-sorted: Customers + Barnaby + All Hired Staff)
      const entities = [
        ...this.customers.map(c => ({ type: 'customer', data: c, y: c.y })),
        { type: 'player', data: this.player, y: this.player.y },
        ...this.hiredStaff.map(h => ({ type: 'helper', data: h, y: h.y }))
      ];
      entities.sort((a, b) => a.y - b.y);

      entities.forEach(ent => {
        if (ent.type === 'customer') this.renderer.drawCustomer(ctx, ent.data);
        else if (ent.type === 'player') this.renderer.drawRaccoon(ctx, ent.data);
        else if (ent.type === 'helper') this.renderer.drawHiredEmployee(ctx, ent.data);
      });

      // 9. Draw Floating Soap Bubbles & Particles
      this.bubbles.forEach(b => this.renderer.drawFloatingBubble(ctx, b));

      this.particles.forEach(p => {
        if (p.isText) {
          this.renderer.drawCoinParticle(ctx, p);
        } else {
          ctx.save();
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.alpha;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });
    }
  }
}

// Start Game Instance upon window load
window.addEventListener('DOMContentLoaded', () => {
  window.gameInstance = new RaccoonLaundromatGame();
});
