/**
 * THRESHOLD Multiplayer — Lobby UI (Phase 3/4).
 *
 * Follows the ArchiveUI/CassetteUI modal-lifecycle convention (isOpen/open()/
 * close()/toggle(), `.classList.add('active')`) rather than OptionsUI's
 * style.display pattern. One modal, five internal sub-views toggled by JS
 * (architecture doc §17, §49-51): menu, browser, create, code, lobby.
 */

const PLAYER_NAME_STORAGE_KEY = 'threshold_mp_player_name';

/** Chosen callsign persisted across sessions; falls back to 'PLAYER' if never set. */
export function getStoredPlayerName() {
  try {
    const raw = localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    return raw && raw.trim() ? raw.trim().slice(0, 24) : 'PLAYER';
  } catch (err) {
    return 'PLAYER';
  }
}

const ERROR_MESSAGES = {
  LOBBY_NOT_FOUND: 'That lobby no longer exists.',
  LOBBY_FULL: 'That lobby is full.',
  LOBBY_NOT_JOINABLE: 'That lobby is no longer accepting players.',
  ALREADY_MEMBER: "You're already in that lobby.",
  INVALID_CODE: 'Invalid or expired code.',
  VERSION_MISMATCH: 'VERSION MISMATCH — refresh THRESHOLD to continue.',
  NOT_MEMBER: "You're not a member of this lobby.",
  NOT_HOST: 'Only the host can do that.',
  NOT_ALL_READY: 'Not all players are ready yet.',
  INVALID_STATE: 'That action is not available right now.',
  AUTH_REQUIRED: 'Connecting to Supabase Auth failed — try again.',
  MATCH_NOT_FOUND: 'Match not found.',
  RATE_LIMITED: 'Too many attempts. Try again in a few minutes.',
  VALIDATION_ERROR: 'Invalid request.',
};

function errorMessage(err) {
  return ERROR_MESSAGES[err && err.code] || (err && err.message) || 'Something went wrong.';
}

export class MultiplayerUI {
  constructor(multiplayerManager) {
    this.manager = multiplayerManager;
    this.isOpen = false;
    this._pageCursor = null;
    this._browserRegion = '';

    this.modal = document.getElementById('multiplayer-modal');
    this.errorEl = document.getElementById('mp-error');
    this.views = Array.from(document.querySelectorAll('#multiplayer-modal .mp-view'));
    this.backBtn = document.getElementById('mp-btn-back');
    this.closeBtn = document.getElementById('btn-multiplayer-close');

    this._initName();
    this._initMenu();
    this._initBrowser();
    this._initCreate();
    this._initCode();
    this._initLobby();

    if (this.backBtn) this.backBtn.addEventListener('click', () => this.showView('menu'));
    if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.close());

    this.manager.onChange(() => this._renderLobbyView());
  }

  // --- modal lifecycle -----------------------------------------------------

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    if (this.modal) this.modal.classList.add('active');
    this.showView(this.manager.isActive ? 'lobby' : 'menu');
  }

  close() {
    this.isOpen = false;
    if (this.modal) this.modal.classList.remove('active');
  }

  showView(name) {
    this._clearError();
    for (const view of this.views) {
      view.classList.toggle('active', view.dataset.view === name);
    }
    if (this.backBtn) this.backBtn.style.display = name === 'menu' ? 'none' : '';
    if (name === 'browser') this._refreshBrowser();
    if (name === 'lobby') this._renderLobbyView();
  }

  _showError(err) {
    if (!this.errorEl) return;
    this.errorEl.textContent = errorMessage(err);
    this.errorEl.style.display = '';
  }

  _clearError() {
    if (!this.errorEl) return;
    this.errorEl.style.display = 'none';
    this.errorEl.textContent = '';
  }

  // --- callsign --------------------------------------------------------------

  _initName() {
    this.nameInput = document.getElementById('mp-name-input');
    if (!this.nameInput) return;
    this.nameInput.value = getStoredPlayerName();
    const persist = () => {
      const value = this.nameInput.value.trim().slice(0, 24);
      try {
        localStorage.setItem(PLAYER_NAME_STORAGE_KEY, value || 'PLAYER');
      } catch (err) {
        // Storage unavailable (private mode, quota) -- the name just won't persist
        // across reloads; main.js still reads it fresh at match-start time.
      }
    };
    this.nameInput.addEventListener('input', persist);
    this.nameInput.addEventListener('blur', persist);
  }

  // --- main menu -------------------------------------------------------------

  _initMenu() {
    const quickJoinBtn = document.getElementById('mp-btn-quick-join');
    const browseBtn = document.getElementById('mp-btn-browse');
    const createBtn = document.getElementById('mp-btn-create');
    const codeBtn = document.getElementById('mp-btn-code');

    if (quickJoinBtn) {
      quickJoinBtn.addEventListener('click', async () => {
        this._clearError();
        try {
          await this.manager.quickJoin({});
          this.showView('lobby');
        } catch (err) {
          this._showError(err);
        }
      });
    }
    if (browseBtn) browseBtn.addEventListener('click', () => this.showView('browser'));
    if (createBtn) createBtn.addEventListener('click', () => this.showView('create'));
    if (codeBtn) codeBtn.addEventListener('click', () => this.showView('code'));
  }

  // --- public lobby browser ---------------------------------------------

  _initBrowser() {
    this.lobbyListEl = document.getElementById('mp-lobby-list');
    this.regionSelect = document.getElementById('mp-browser-region');
    this.loadMoreBtn = document.getElementById('mp-btn-load-more');
    const refreshBtn = document.getElementById('mp-btn-refresh');

    if (refreshBtn) refreshBtn.addEventListener('click', () => this._refreshBrowser());
    if (this.regionSelect) {
      this.regionSelect.addEventListener('change', () => {
        this._browserRegion = this.regionSelect.value;
        this._refreshBrowser();
      });
    }
    if (this.loadMoreBtn) {
      this.loadMoreBtn.addEventListener('click', () => this._loadLobbies(this._pageCursor));
    }

    this._autoRefreshTimer = setInterval(() => {
      if (this.isOpen && this._activeView() === 'browser') this._refreshBrowser();
    }, 12000);
  }

  _activeView() {
    const active = this.views.find((v) => v.classList.contains('active'));
    return active ? active.dataset.view : null;
  }

  async _refreshBrowser() {
    this._pageCursor = null;
    await this._loadLobbies(null, /* replace */ true);
  }

  async _loadLobbies(cursor, replace = false) {
    this._clearError();
    try {
      const { lobbies, nextCursor } = await this.manager.fetchPublicLobbies({ cursor });
      const filtered = this._browserRegion
        ? lobbies.filter((l) => l.region === this._browserRegion)
        : lobbies;
      this._renderLobbyList(filtered, replace);
      this._pageCursor = nextCursor;
      if (this.loadMoreBtn) this.loadMoreBtn.style.display = nextCursor ? '' : 'none';
    } catch (err) {
      this._showError(err);
    }
  }

  _renderLobbyList(lobbies, replace) {
    if (!this.lobbyListEl) return;
    if (replace) this.lobbyListEl.innerHTML = '';
    if (replace && lobbies.length === 0) {
      this.lobbyListEl.innerHTML = '<div class="mp-lobby-empty">NO OPEN LOBBIES</div>';
      return;
    }
    for (const lobby of lobbies) {
      const card = document.createElement('div');
      card.className = 'mp-lobby-card';
      card.innerHTML = `
        <div class="mp-lobby-card-info">
          <div class="mp-lobby-host">${escapeHtml(lobby.host_display_name || 'HOST')}</div>
          <div class="mp-lobby-meta">${escapeHtml(lobby.game_mode === 'STORY' ? 'STORY' : 'SURVIVAL')} &middot; ${lobby.player_count}/${lobby.max_players} &middot; ${escapeHtml(lobby.region)} &middot; ${escapeHtml(lobby.difficulty || 'NORMAL')}</div>
        </div>
        <button class="deck-btn mp-lobby-join-btn">JOIN</button>
      `;
      card.querySelector('.mp-lobby-join-btn').addEventListener('click', async () => {
        this._clearError();
        try {
          await this.manager.joinLobby(lobby.id);
          this.showView('lobby');
        } catch (err) {
          this._showError(err);
          if (err.code === 'LOBBY_FULL' || err.code === 'LOBBY_NOT_JOINABLE') {
            this._refreshBrowser();
          }
        }
      });
      this.lobbyListEl.appendChild(card);
    }
  }

  // --- create lobby -------------------------------------------------------

  _initCreate() {
    const submitBtn = document.getElementById('mp-btn-create-submit');
    this.createVisibility = document.getElementById('mp-create-visibility');
    this.createRegion = document.getElementById('mp-create-region');
    this.createDifficulty = document.getElementById('mp-create-difficulty');
    this.createMode = document.getElementById('mp-create-mode');

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        this._clearError();
        try {
          await this.manager.createLobby({
            visibility: this.createVisibility ? this.createVisibility.value : 'PUBLIC',
            region: this.createRegion ? this.createRegion.value : 'AUTO',
            difficulty: this.createDifficulty ? this.createDifficulty.value : 'NORMAL',
            gameMode: this.createMode ? this.createMode.value : 'SURVIVAL',
          });
          this.showView('lobby');
        } catch (err) {
          this._showError(err);
        }
      });
    }
  }

  // --- join with code -------------------------------------------------------

  _initCode() {
    this.codeInput = document.getElementById('mp-code-input');
    const submitBtn = document.getElementById('mp-btn-code-submit');

    if (this.codeInput) {
      this.codeInput.addEventListener('input', () => {
        this.codeInput.value = this.codeInput.value.replace(/\D/g, '').slice(0, 5);
      });
      this.codeInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        this.codeInput.value = text.replace(/\D/g, '').slice(0, 5);
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        this._clearError();
        const code = this.codeInput ? this.codeInput.value : '';
        if (!/^[0-9]{5}$/.test(code)) {
          this._showError({ code: 'VALIDATION_ERROR', message: 'Enter a 5-digit code.' });
          return;
        }
        try {
          await this.manager.joinByCode(code);
          this.showView('lobby');
        } catch (err) {
          this._showError(err);
        }
      });
    }
  }

  // --- lobby screen -------------------------------------------------------

  _initLobby() {
    this.codeRow = document.getElementById('mp-lobby-code-row');
    this.codeLabel = document.getElementById('mp-lobby-code');
    this.modeLabel = document.getElementById('mp-lobby-mode');
    this.slotsEl = document.getElementById('mp-slots');
    this.readyBtn = document.getElementById('mp-btn-ready');
    this.startBtn = document.getElementById('mp-btn-start');
    this.leaveBtn = document.getElementById('mp-btn-leave');
    const copyBtn = document.getElementById('mp-btn-copy-code');

    this._isReady = false;

    if (this.readyBtn) {
      this.readyBtn.addEventListener('click', async () => {
        if (this._togglingReady) return;
        this._togglingReady = true;
        this._clearError();
        try {
          this._isReady = !this._isReady;
          await this.manager.setReady(this._isReady);
        } catch (err) {
          this._isReady = !this._isReady;
          this._showError(err);
        } finally {
          this._togglingReady = false;
          this._renderLobbyView();
        }
      });
    }
    if (this.startBtn) {
      this.startBtn.addEventListener('click', async () => {
        // Guards against a real double-click (or an impatient second click while the
        // first request is still in flight) firing startMatch() twice: the first call
        // flips the lobby out of OPEN, so the second sees INVALID_STATE even though the
        // match already started successfully.
        if (this._starting) return;
        this._starting = true;
        this._clearError();
        this.startBtn.disabled = true;
        try {
          await this.manager.startMatch();
        } catch (err) {
          this._showError(err);
        } finally {
          this._starting = false;
          this._renderLobbyView();
        }
      });
    }
    if (this.leaveBtn) {
      this.leaveBtn.addEventListener('click', async () => {
        this._clearError();
        try {
          await this.manager.leaveLobby();
          this._isReady = false;
          this.showView('menu');
        } catch (err) {
          this._showError(err);
        }
      });
    }
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (this.manager.lobby && navigator.clipboard) {
          navigator.clipboard.writeText(this.manager.lobby.join_code || '').catch(() => {});
        }
      });
    }
  }

  _renderLobbyView() {
    if (!this.isOpen || this._activeView() !== 'lobby') return;
    const lobby = this.manager.lobby;
    if (!lobby) return;

    if (this.codeRow) this.codeRow.style.display = lobby.visibility === 'PRIVATE' ? '' : 'none';
    if (this.codeLabel) this.codeLabel.textContent = lobby.join_code || '';
    if (this.modeLabel) this.modeLabel.textContent = lobby.game_mode === 'STORY' ? 'CO-OP STORY MODE' : 'ENDLESS SURVIVAL';

    if (this.slotsEl) {
      this.slotsEl.innerHTML = '';
      for (const slot of this.manager.players) {
        const el = document.createElement('div');
        el.className = 'mp-slot' + (slot.empty ? ' empty' : '') + (slot.isHost ? ' host' : '') + (slot.isReady ? ' ready' : '');
        el.innerHTML = slot.empty
          ? '<span class="mp-slot-name">EMPTY</span>'
          : `<span class="mp-slot-name">${escapeHtml(slot.displayName)}</span>
             ${slot.isHost ? '<span class="mp-slot-badge">HOST</span>' : ''}
             <span class="mp-slot-status">${slot.isReady ? 'READY' : 'NOT READY'}</span>`;
        this.slotsEl.appendChild(el);
      }
    }

    if (this.readyBtn) {
      this.readyBtn.style.display = this.manager.isHost ? 'none' : '';
      this.readyBtn.textContent = this._isReady ? 'NOT READY' : 'READY';
    }
    if (this.startBtn) {
      this.startBtn.style.display = this.manager.isHost ? '' : 'none';
      this.startBtn.disabled = !this.manager.canStart;
    }
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
