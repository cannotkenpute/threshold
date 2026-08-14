/**
 * Two Raccoons in a Trench Coat: High-Stakes Blackjack
 * Core Game Engine: Full Blackjack Rules, Suspicion & Disguise System,
 * Dual-Raccoon Emergency QTEs, Human vs Animal AI, and Disguise Upgrades Shop.
 */

class TrenchCoatBlackjackGame {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.renderer = new CasinoRenderer();

    // Dimensions
    this.width = 960;
    this.height = 600;

    // Game Lifecycle
    this.isRunning = false;
    this.isPaused = false;
    this.lastTime = 0;

    // Economy & Progress
    this.chips = 150;
    this.shiftEarnings = 0;
    this.tableNumber = 1;
    this.handNumber = 1;
    this.alliesCheered = 0;

    // Suspicion Meter (0 - 100)
    this.suspicion = 0;
    this.suspicionSpeed = 1.0;

    // Disguise & Raccoon States
    this.wobble = 0;
    this.wobbleTarget = 0;
    this.mustacheLoose = false;
    this.tailVisible = false;
    this.isCheating = false;
    this.cheatCooldown = 0;
    this.isPocketing = false;
    this.pocketCount = 0;

    // Emergency QTE Timers
    this.qteTimer = 3.5;
    this.humanGazeTimer = 2.0;

    // Deck & Card Game State
    this.deck = [];
    this.dealerHand = [];
    this.playerHand = [];
    this.bet = 50;
    this.gamePhase = 'ready_to_deal'; // 'ready_to_deal' | 'player_turn' | 'dealer_turn' | 'hand_ended'

    // Upgrades
    this.upgrades = {
      mustacheGlue: false,
      longCoat: false,
      voiceModulator: false,
      silkGloves: false,
      cocktailDistraction: false,
      magneticShoe: false,
    };

    // Casino Guests Catalog
    this.guestCatalog = [
      { type: 'inspector', name: 'Inspector Higgins', isHuman: true, baseSuspicionRate: 1.8, quote: "Hmm... your collar seems exceptionally high, sir." },
      { type: 'tycoon', name: 'Tycoon Sterling', isHuman: true, baseSuspicionRate: 1.3, quote: "Deal the cards, dealer! Time is money!" },
      { type: 'capybara', name: 'Chester the Capybara', isHuman: false, baseSuspicionRate: 0.2, quote: "Looking fresh, fellow adult human. Deal me in." },
      { type: 'fox', name: 'Sly Fiona Fox', isHuman: false, baseSuspicionRate: 0.1, quote: "Wink wink! Don't let Higgins catch you, boys." },
    ];

    this.currentGuest = this.guestCatalog[0];

    // Load Saved Data
    this.loadSaveData();

    // Initialize Card Deck
    this.initDeck();

    // Bind Event Listeners & UI
    this.bindEvents();
    this.initUI();

    // Responsive Canvas
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

  // --- CARD DECK ENGINE ---

  initDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const values = [
      { val: '2', num: 2 }, { val: '3', num: 3 }, { val: '4', num: 4 },
      { val: '5', num: 5 }, { val: '6', num: 6 }, { val: '7', num: 7 },
      { val: '8', num: 8 }, { val: '9', num: 9 }, { val: '10', num: 10 },
      { val: 'J', num: 10 }, { val: 'Q', num: 10 }, { val: 'K', num: 10 },
      { val: 'A', num: 11 }
    ];

    this.deck = [];
    // 4 standard casino decks in the shoe
    for (let d = 0; d < 4; d++) {
      for (let s of suits) {
        for (let v of values) {
          this.deck.push({ suit: s, value: v.val, numValue: v.num });
        }
      }
    }
    this.shuffleDeck();
  }

  shuffleDeck() {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
    }
  }

  drawCard() {
    if (this.deck.length < 15) {
      this.initDeck();
      this.showToast('Shoe reshuffled! 🎴');
    }
    return this.deck.pop();
  }

  calculateHandScore(hand) {
    let total = 0;
    let aces = 0;

    for (let card of hand) {
      total += card.numValue;
      if (card.value === 'A') aces++;
    }

    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }

    return total;
  }

  isBlackjack(hand) {
    return hand.length === 2 && this.calculateHandScore(hand) === 21;
  }

  // --- BLACKJACK DEALING FLOW ---

  dealHand() {
    if (this.gamePhase !== 'ready_to_deal') return;

    this.gamePhase = 'dealing';
    this.dealerHand = [];
    this.playerHand = [];

    window.casinoAudio.playCardDeal();

    // Deal: Player Card 1, Dealer Card 1 (face down), Player Card 2, Dealer Card 2 (face up)
    this.playerHand.push(this.drawCard());
    setTimeout(() => {
      this.dealerHand.push(this.drawCard());
      window.casinoAudio.playCardDeal();
    }, 200);

    setTimeout(() => {
      this.playerHand.push(this.drawCard());
      window.casinoAudio.playCardDeal();
    }, 400);

    setTimeout(() => {
      this.dealerHand.push(this.drawCard());
      window.casinoAudio.playCardDeal();

      this.gamePhase = 'player_turn';
      this.updateControlsUI();

      // Check Instant Blackjacks
      const pScore = this.calculateHandScore(this.playerHand);
      if (pScore === 21) {
        this.resolveHand();
      } else {
        this.setDealerPrompt(`"You have ${pScore}, esteemed patron. Hit or Stand?"`);
      }
    }, 600);
  }

  playerHit() {
    if (this.gamePhase !== 'player_turn') return;

    this.playerHand.push(this.drawCard());
    window.casinoAudio.playCardDeal();

    const pScore = this.calculateHandScore(this.playerHand);
    if (pScore > 21) {
      // Player Bust!
      this.setDealerPrompt(`"Bust at ${pScore}! House takes the pot, fellow human!"`);
      window.casinoAudio.playBlackjackWin();
      this.resolveHand();
    } else if (pScore === 21) {
      this.playerStand();
    } else {
      this.setDealerPrompt(`"Total is now ${pScore}. Hit again or Stand?"`);
    }
  }

  playerStand() {
    if (this.gamePhase !== 'player_turn') return;

    this.gamePhase = 'dealer_turn';
    this.updateControlsUI();
    this.setDealerPrompt('"Dealer reveals hole card..."');

    window.casinoAudio.playCardDeal();

    // Dealer AI Play Loop (Must draw to 16, stand on 17+)
    const stepDealer = () => {
      const dScore = this.calculateHandScore(this.dealerHand);
      if (dScore < 17) {
        setTimeout(() => {
          this.dealerHand.push(this.drawCard());
          window.casinoAudio.playCardDeal();
          stepDealer();
        }, 500);
      } else {
        setTimeout(() => {
          this.resolveHand();
        }, 400);
      }
    };

    setTimeout(stepDealer, 500);
  }

  playerDouble() {
    if (this.gamePhase !== 'player_turn' || this.playerHand.length !== 2) return;
    this.bet *= 2;
    this.playerHit();
    if (this.calculateHandScore(this.playerHand) <= 21) {
      this.playerStand();
    }
  }

  resolveHand() {
    this.gamePhase = 'hand_ended';
    const pScore = this.calculateHandScore(this.playerHand);
    const dScore = this.calculateHandScore(this.dealerHand);
    const pBJ = this.isBlackjack(this.playerHand);
    const dBJ = this.isBlackjack(this.dealerHand);

    let result = '';

    if (pScore > 21) {
      // Player Bust (Dealer Wins)
      result = 'Player Bust! House Wins 🪙';
      this.chips += this.bet;
      this.shiftEarnings += this.bet;
      window.casinoAudio.playChipClink();
    } else if (dScore > 21) {
      // Dealer Bust (Player Wins)
      result = 'Dealer Busts! Player Wins 🎉';
      this.chips = Math.max(0, this.chips - this.bet);
    } else if (pBJ && !dBJ) {
      // Player Natural Blackjack (3:2)
      result = 'Player Blackjack (3:2)! 🌟';
      this.chips = Math.max(0, this.chips - Math.round(this.bet * 1.5));
    } else if (dBJ && !pBJ) {
      // Dealer Blackjack
      result = 'Dealer Natural Blackjack! 🦝🎩';
      this.chips += Math.round(this.bet * 1.5);
      this.shiftEarnings += Math.round(this.bet * 1.5);
      window.casinoAudio.playBlackjackWin();
    } else if (pScore > dScore) {
      // Player higher
      result = `Player Wins (${pScore} vs ${dScore})!`;
      this.chips = Math.max(0, this.chips - this.bet);
    } else if (dScore > pScore) {
      // Dealer higher
      result = `Dealer Wins (${dScore} vs ${pScore})! 🦝🪙`;
      this.chips += this.bet;
      this.shiftEarnings += this.bet;
      window.casinoAudio.playChipClink();
    } else {
      // Push (Tie)
      result = `Push at ${pScore}! Bets Returned 🤝`;
    }

    this.showToast(result);
    this.setDealerPrompt(`"${result} Ready for the next hand?"`);

    this.handNumber++;
    this.updateHUD();
    this.saveGameData();

    // Rotate Guest Every 3 Hands
    if (this.handNumber % 3 === 0) {
      setTimeout(() => this.rotateGuest(), 1200);
    }

    setTimeout(() => {
      this.gamePhase = 'ready_to_deal';
      this.bet = 50;
      this.updateControlsUI();
    }, 1600);
  }

  rotateGuest() {
    const nextIdx = (this.guestCatalog.indexOf(this.currentGuest) + 1) % this.guestCatalog.length;
    this.currentGuest = this.guestCatalog[nextIdx];
    this.showToast(`New Player Sat at Table: ${this.currentGuest.name}! ${this.currentGuest.isHuman ? '🕵️' : '🐾'}`);
    this.setDealerPrompt(`"${this.currentGuest.quote}"`);

    if (!this.currentGuest.isHuman) {
      this.alliesCheered++;
      // Animal ally reduces suspicion!
      this.suspicion = Math.max(0, this.suspicion - 25);
    }
  }

  // --- DUAL-RACCOON DISGUISE & SUSPICION SYSTEM ---

  update(dt) {
    this.renderer.update(dt);

    if (this.isPaused) return;

    // 1. Balance Wobble Physics
    this.wobble += (this.wobbleTarget - this.wobble) * dt * 5;

    // 2. Emergency QTE Trigger Timer
    this.qteTimer -= dt;
    if (this.qteTimer <= 0) {
      this.triggerRandomDisguiseEmergency();
      this.qteTimer = 4.0 + Math.random() * 4.0;
    }

    // 3. Human Eye Gaze & Suspicion Buildup
    this.humanGazeTimer -= dt;
    if (this.humanGazeTimer <= 0) {
      this.currentGuest.eyeGaze = this.currentGuest.eyeGaze === 'dealer' ? 'away' : 'dealer';
      this.humanGazeTimer = 2.0 + Math.random() * 2.5;
    }

    // Suspicion increases if emergencies are ignored when human is watching
    let suspicionGain = 0;

    if (this.currentGuest.isHuman && this.currentGuest.eyeGaze === 'dealer') {
      let multiplier = this.currentGuest.baseSuspicionRate;
      if (this.upgrades.voiceModulator) multiplier *= 0.6;

      if (this.mustacheLoose) suspicionGain += 14 * multiplier;
      if (this.tailVisible) suspicionGain += 20 * multiplier;
      if (Math.abs(this.wobble) > 0.08) suspicionGain += 16 * multiplier;
      if (this.isCheating) suspicionGain += 40 * multiplier; // Caught cheating red-pawed!
    } else {
      // Natural passive decay when human is looking away or player is an animal ally
      this.suspicion = Math.max(0, this.suspicion - 4 * dt);
    }

    if (suspicionGain > 0) {
      this.suspicion = Math.min(100, this.suspicion + suspicionGain * dt);
      if (Math.random() < 0.04) window.casinoAudio.playSuspicionWarning();
    }

    // Check Disguise Blown!
    if (this.suspicion >= 100) {
      this.bustDisguise();
    }

    // Cooldowns
    if (this.cheatCooldown > 0) {
      this.cheatCooldown -= dt;
      if (this.cheatCooldown <= 0) {
        document.getElementById('cheat-badge').textContent = 'Ready';
        this.isCheating = false;
      }
    }

    this.updateSuspicionUI();
  }

  triggerRandomDisguiseEmergency() {
    const roll = Math.random();
    if (roll < 0.35 && !this.upgrades.mustacheGlue) {
      this.mustacheLoose = true;
      document.getElementById('alert-mustache').classList.remove('hidden');
      this.showToast('⚠️ Fake Mustache is Peeling Off! [M]', '🥸');
    } else if (roll < 0.7 && !this.upgrades.longCoat) {
      this.tailVisible = true;
      document.getElementById('alert-tail').classList.remove('hidden');
      this.showToast('⚠️ Raccoon Tail Poking Out! [T]', '🦝');
    } else {
      // Wobble coat balance
      this.wobbleTarget = (Math.random() > 0.5 ? 1 : -1) * (0.12 + Math.random() * 0.06);
      document.getElementById('alert-balance').classList.remove('hidden');
      this.showToast('⚠️ Trench Coat Wobbling! Balance [A/D]', '🧥');
    }
  }

  // --- EMERGENCY ACTIONS ---

  fixMustache() {
    this.mustacheLoose = false;
    document.getElementById('alert-mustache').classList.add('hidden');
    window.casinoAudio.playMustachePat();
    this.showToast('Patted fake mustache firmly! 🥸');
    this.suspicion = Math.max(0, this.suspicion - 8);
  }

  tuckTail() {
    this.tailVisible = false;
    document.getElementById('alert-tail').classList.add('hidden');
    window.casinoAudio.playTailTuck();
    this.showToast('Tucked tail inside trench coat lining! 🦝');
    this.suspicion = Math.max(0, this.suspicion - 10);
  }

  balanceCoat(dir = 0) {
    if (dir === 0) {
      this.wobbleTarget = 0;
      this.wobble = 0;
    } else {
      this.wobbleTarget -= dir * 0.1;
      if (Math.abs(this.wobbleTarget) < 0.05) this.wobbleTarget = 0;
    }
    document.getElementById('alert-balance').classList.add('hidden');
    window.casinoAudio.playMustachePat();
    this.showToast('Balanced the trench coat posture! 🧥');
    this.suspicion = Math.max(0, this.suspicion - 6);
  }

  sleightOfPawCheat() {
    if (this.cheatCooldown > 0) {
      this.showToast('Sleight of Paw on cooldown! ⏳');
      return;
    }

    this.isCheating = true;
    this.cheatCooldown = 8.0;
    document.getElementById('cheat-badge').textContent = 'Cooldown';

    // Swap top of deck with an Ace or 10
    this.deck.push({ suit: '♥', value: 'A', numValue: 11 });
    window.casinoAudio.playCardDeal();

    if (this.currentGuest.isHuman && this.currentGuest.eyeGaze === 'dealer') {
      this.suspicion = Math.min(100, this.suspicion + 35);
      this.showToast('🚨 Human caught a glimpse of your secret paw card swap!', '⚠️');
    } else {
      this.showToast('🤫 Secretly loaded an Ace into the deck! 🎴✨');
    }
  }

  pocketChips() {
    this.chips += 25;
    this.pocketCount++;
    this.isPocketing = true;
    window.casinoAudio.playChipClink();
    this.showToast('Sneaked $25 in shiny chips into coat pocket! 🤫🪙');
    setTimeout(() => { this.isPocketing = false; }, 600);

    if (this.currentGuest.isHuman && this.currentGuest.eyeGaze === 'dealer') {
      this.suspicion = Math.min(100, this.suspicion + 20);
    }
    this.updateHUD();
  }

  bustDisguise() {
    this.isPaused = true;
    window.casinoAudio.playBustedAlarm();

    document.getElementById('busted-hands').textContent = this.handNumber;
    document.getElementById('busted-chips').textContent = `$${this.chips}`;
    document.getElementById('busted-allies').textContent = this.alliesCheered;

    document.getElementById('modal-busted').classList.remove('hidden');
  }

  // --- UI & EVENT BINDINGS ---

  bindEvents() {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyM') {
        if (!this.isRunning) return;
        this.fixMustache();
      }
      if (e.code === 'KeyT') {
        this.tuckTail();
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.balanceCoat(-1);
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.balanceCoat(1);
      }
      if (e.code === 'KeyC') {
        this.sleightOfPawCheat();
      }
      if (e.code === 'Space' || e.code === 'Enter') {
        if (this.gamePhase === 'ready_to_deal') this.dealHand();
        else if (this.gamePhase === 'player_turn') this.playerHit();
      }
      if (e.code === 'KeyS') {
        if (this.gamePhase === 'player_turn') this.playerStand();
      }
      if (e.code === 'KeyB') {
        this.toggleShop();
      }
      if (e.code === 'Escape') {
        this.togglePause();
      }
    });

    // Touch / Click Emergency Buttons
    document.getElementById('btn-fix-mustache').onclick = () => this.fixMustache();
    document.getElementById('btn-tuck-tail').onclick = () => this.tuckTail();
    document.getElementById('btn-balance-coat').onclick = () => this.balanceCoat(0);
    document.getElementById('btn-cheat-swap').onclick = () => this.sleightOfPawCheat();
    document.getElementById('btn-pocket-chips').onclick = () => this.pocketChips();

    // Table Dealer Action Buttons
    document.getElementById('btn-deal').onclick = () => this.dealHand();
    document.getElementById('btn-hit').onclick = () => this.playerHit();
    document.getElementById('btn-stand').onclick = () => this.playerStand();
    document.getElementById('btn-double').onclick = () => this.playerDouble();

    // Audio & Header Buttons
    document.getElementById('btn-sound').onclick = () => {
      const on = window.casinoAudio.toggleSound();
      document.getElementById('sound-icon').textContent = on ? '🔊' : '🔇';
    };
    document.getElementById('btn-music').onclick = () => {
      const on = window.casinoAudio.toggleMusic();
      document.getElementById('music-icon').textContent = on ? '🎷' : '🔇';
    };
    document.getElementById('btn-disguise-shop').onclick = () => this.toggleShop();
    document.getElementById('btn-close-shop').onclick = () => this.toggleShop(false);
    document.getElementById('btn-pause').onclick = () => this.togglePause();
    document.getElementById('btn-resume').onclick = () => this.togglePause(false);

    document.getElementById('btn-try-again').onclick = () => {
      document.getElementById('modal-busted').classList.add('hidden');
      this.suspicion = 0;
      this.isPaused = false;
      this.gamePhase = 'ready_to_deal';
      this.updateControlsUI();
      this.showToast('Disguise back on! Ready to deal 🦝🎩');
    };

    document.getElementById('btn-reset-save').onclick = () => {
      if (confirm('Reset all stolen chips and disguise gear?')) {
        localStorage.removeItem('raccoons_casino_save');
        location.reload();
      }
    };
  }

  initUI() {
    const startBtn = document.getElementById('btn-start-casino');
    const titleModal = document.getElementById('modal-title');

    const handleStart = (e) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      titleModal.classList.remove('active');
      titleModal.classList.add('hidden');
      window.casinoAudio.ensureContext();
      this.startGame();
    };

    if (startBtn) {
      startBtn.addEventListener('click', handleStart);
      startBtn.addEventListener('pointerdown', handleStart);
      startBtn.addEventListener('touchend', handleStart);
    }

    this.updateHUD();
    this.updateControlsUI();
  }

  startGame() {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
    this.showToast('Welcome to the Emerald Velvet Casino, Mr. Hugh Mann! 🦝🎩');
  }

  gameLoop(currentTime) {
    if (!this.isRunning) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  // --- DISGUISE UPGRADES SHOP ---

  toggleShop(forceState) {
    const modal = document.getElementById('modal-disguise-shop');
    const isOpening = forceState !== undefined ? forceState : modal.classList.contains('hidden');
    if (isOpening) {
      this.isPaused = true;
      modal.classList.remove('hidden');
      this.renderShopItems();
      document.getElementById('shop-chips-display').textContent = `$${this.chips}`;
    } else {
      modal.classList.add('hidden');
      this.isPaused = false;
    }
  }

  renderShopItems() {
    const container = document.getElementById('disguise-shop-grid');
    container.innerHTML = '';

    const items = [
      { key: 'mustacheGlue', name: 'Industrial Mustache Wax', icon: '🥸', cost: 100, desc: 'Fake mustache stays stuck forever! Never falls loose.', isOwned: () => this.upgrades.mustacheGlue, buy: () => { this.upgrades.mustacheGlue = true; this.mustacheLoose = false; document.getElementById('alert-mustache').classList.add('hidden'); } },
      { key: 'longCoat', name: 'Extra-Long Wool Coat', icon: '🧥', cost: 120, desc: 'Covers the bottom raccoon tail completely.', isOwned: () => this.upgrades.longCoat, buy: () => { this.upgrades.longCoat = true; this.tailVisible = false; document.getElementById('alert-tail').classList.add('hidden'); } },
      { key: 'voiceModulator', name: 'Smooth Accent Modulator', icon: '🎙️', cost: 150, desc: 'Deals in a deep classy voice. Reduces human suspicion gain by 40%!', isOwned: () => this.upgrades.voiceModulator, buy: () => { this.upgrades.voiceModulator = true; } },
      { key: 'silkGloves', name: 'White Silk Dealer Gloves', icon: '🧤', cost: 180, desc: 'Hides raccoon claws and doubles Sleight-of-Paw speed!', isOwned: () => this.upgrades.silkGloves, buy: () => { this.upgrades.silkGloves = true; } },
      { key: 'magneticShoe', name: 'Loaded Blackjack Shoe', icon: '🧲', cost: 220, desc: 'Increases chance of dealing 20s and Blackjacks to the house!', isOwned: () => this.upgrades.magneticShoe, buy: () => { this.upgrades.magneticShoe = true; } },
    ];

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
          <span class="shop-item-cost">${owned ? '✅ EQUIPPED' : `$${item.cost}`}</span>
          <button class="btn btn-gold btn-sm" ${owned ? 'disabled' : ''}>
            ${owned ? 'Equipped' : 'Buy Gear'}
          </button>
        </div>
      `;

      const btn = card.querySelector('button');
      if (!owned) {
        btn.onclick = () => {
          if (this.chips >= item.cost) {
            this.chips -= item.cost;
            item.buy();
            window.casinoAudio.playBlackjackWin();
            this.showToast(`Equipped ${item.name}! 🎩✨`);
            this.updateHUD();
            this.saveGameData();
            this.renderShopItems();
            document.getElementById('shop-chips-display').textContent = `$${this.chips}`;
          } else {
            this.showToast('Need more casino chips! Keep dealing hands 🎴');
          }
        };
      }

      container.appendChild(card);
    });
  }

  togglePause(forceState) {
    this.isPaused = forceState !== undefined ? forceState : !this.isPaused;
    const modal = document.getElementById('modal-pause');
    if (this.isPaused) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }

  setDealerPrompt(text) {
    document.getElementById('prompt-text').textContent = text;
  }

  showToast(message, icon = '✨') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-30px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  updateControlsUI() {
    const btnDeal = document.getElementById('btn-deal');
    const btnHit = document.getElementById('btn-hit');
    const btnStand = document.getElementById('btn-stand');
    const btnDouble = document.getElementById('btn-double');

    if (this.gamePhase === 'ready_to_deal') {
      btnDeal.classList.remove('hidden');
      btnHit.classList.add('hidden');
      btnStand.classList.add('hidden');
      btnDouble.classList.add('hidden');
    } else if (this.gamePhase === 'player_turn') {
      btnDeal.classList.add('hidden');
      btnHit.classList.remove('hidden');
      btnStand.classList.remove('hidden');
      if (this.playerHand.length === 2) btnDouble.classList.remove('hidden');
      else btnDouble.classList.add('hidden');
    } else {
      btnDeal.classList.add('hidden');
      btnHit.classList.add('hidden');
      btnStand.classList.add('hidden');
      btnDouble.classList.add('hidden');
    }
  }

  updateSuspicionUI() {
    const pct = Math.round(this.suspicion);
    document.getElementById('suspicion-pct').textContent = `${pct}%`;
    document.getElementById('suspicion-bar-fill').style.width = `${pct}%`;
  }

  updateHUD() {
    document.getElementById('chips-display').textContent = `$${this.chips}`;
    document.getElementById('shift-display').textContent = `Table ${this.tableNumber} • Hand #${this.handNumber}`;
  }

  saveGameData() {
    const data = {
      chips: this.chips,
      tableNumber: this.tableNumber,
      handNumber: this.handNumber,
      upgrades: this.upgrades,
      alliesCheered: this.alliesCheered,
    };
    try {
      localStorage.setItem('raccoons_casino_save', JSON.stringify(data));
    } catch (e) {
      console.warn('Save failed', e);
    }
  }

  loadSaveData() {
    try {
      const raw = localStorage.getItem('raccoons_casino_save');
      if (raw) {
        const data = JSON.parse(raw);
        if (data.chips !== undefined) this.chips = data.chips;
        if (data.tableNumber !== undefined) this.tableNumber = data.tableNumber;
        if (data.handNumber !== undefined) this.handNumber = data.handNumber;
        if (data.upgrades) this.upgrades = Object.assign(this.upgrades, data.upgrades);
        if (data.alliesCheered !== undefined) this.alliesCheered = data.alliesCheered;
      }
    } catch (e) {
      console.warn('Load failed', e);
    }
  }

  // --- RENDER PIPELINE ---

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // 1. Draw Casino Felt Table & Speakeasy Room
    this.renderer.drawCasinoRoom(ctx, this.width, this.height);

    // 2. Draw Casino Player / Guest across the table
    this.renderer.drawCasinoGuest(ctx, this.width * 0.5, 400, this.currentGuest);

    // 3. Draw Dealer: Two Raccoons in Trench Coat
    this.renderer.drawTwoRaccoonsDealer(ctx, this.width * 0.5, 120, {
      wobbleAngle: this.wobble,
      mustacheLoose: this.mustacheLoose,
      tailVisible: this.tailVisible,
      isCheating: this.isCheating,
      isPocketing: this.isPocketing,
      pocketCount: this.pocketCount,
      equippedGear: this.upgrades,
    });

    // 4. Draw Cards
    // Dealer Cards (top center table)
    const dCardStartX = this.width * 0.5 - ((this.dealerHand.length - 1) * 32);
    this.dealerHand.forEach((card, idx) => {
      const isHoleCard = idx === 0 && (this.gamePhase === 'player_turn' || this.gamePhase === 'dealing');
      this.renderer.drawPlayingCard(ctx, card, dCardStartX + idx * 64, 210, isHoleCard);
    });

    if (this.dealerHand.length > 0 && this.gamePhase !== 'player_turn' && this.gamePhase !== 'dealing') {
      const dScore = this.calculateHandScore(this.dealerHand);
      this.renderer.drawHandScoreBadge(ctx, this.width * 0.5, 160, dScore, dScore > 21, this.isBlackjack(this.dealerHand));
    }

    // Player Cards (bottom center table)
    const pCardStartX = this.width * 0.5 - ((this.playerHand.length - 1) * 32);
    this.playerHand.forEach((card, idx) => {
      this.renderer.drawPlayingCard(ctx, card, pCardStartX + idx * 64, 320, false);
    });

    if (this.playerHand.length > 0) {
      const pScore = this.calculateHandScore(this.playerHand);
      this.renderer.drawHandScoreBadge(ctx, this.width * 0.5, 375, pScore, pScore > 21, this.isBlackjack(this.playerHand));
    }

    // 5. Draw Betting Chips on Felt
    this.renderer.drawBettingChipsStack(ctx, this.width * 0.32, 280, this.bet);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.trenchCoatBlackjack = new TrenchCoatBlackjackGame();
});
