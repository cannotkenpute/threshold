/**
 * 1980s First-Person Input & PointerLock Controller
 */

export class InputManager {
  constructor(domElement, onInteractKey) {
    this.domElement = domElement;
    this.onInteractKey = onInteractKey;
    this.isLocked = false;

    // Movement & state keys
    this.keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      lookUp: false,
      lookDown: false,
      lookLeft: false,
      lookRight: false,
      sprint: false,
      crouch: false,
      flashlight: false,
      inventory: false,
      tape: false
    };

    // Mouse delta
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.mouseSensitivity = 0.0022;

    this.initEvents();
  }

  initEvents() {
    // Pointer Lock
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = document.pointerLockElement === this.domElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    document.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code) || ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
      }
      if (e.repeat && ['KeyF', 'KeyE', 'Tab', 'KeyT', 'f', 'F', 'e', 'E', 't', 'T'].includes(e.code || e.key)) return;
      this.handleKeyEvent(e, true);
    });

    document.addEventListener('keyup', (e) => {
      this.handleKeyEvent(e, false);
    });

    // [E] alone handles both picking up/examining world items and using the active inventory
    // slot (see handlePlayerInteract's fallback in main.js) -- still suppress the browser's
    // right-click menu during pointer lock so a stray right-click doesn't break out of it.
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });
  }

  requestLock() {
    try {
      const res = this.domElement.requestPointerLock();
      if (res && res.catch) {
        res.catch(err => console.warn('Pointer lock request ignored:', err));
      }
    } catch (e) {
      console.warn('Pointer lock error:', e);
    }
  }

  exitLock() {
    if (document.exitPointerLock) {
      document.exitPointerLock();
    }
  }

  handleKeyEvent(e, isPressed) {
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();

    // WASD Movement
    if (code === 'KeyW' || key === 'w') {
      this.keys.forward = isPressed;
    } else if (code === 'KeyS' || key === 's') {
      this.keys.backward = isPressed;
    } else if (code === 'KeyA' || key === 'a') {
      this.keys.left = isPressed;
    } else if (code === 'KeyD' || key === 'd') {
      this.keys.right = isPressed;
    }

    // Arrow keys looking
    else if (code === 'ArrowUp' || key === 'arrowup') {
      this.keys.lookUp = isPressed;
    } else if (code === 'ArrowDown' || key === 'arrowdown') {
      this.keys.lookDown = isPressed;
    } else if (code === 'ArrowLeft' || key === 'arrowleft') {
      this.keys.lookLeft = isPressed;
    } else if (code === 'ArrowRight' || key === 'arrowright') {
      this.keys.lookRight = isPressed;
    }

    // Modifiers & Actions
    else if (code === 'ShiftLeft' || code === 'ShiftRight' || key === 'shift') {
      this.keys.sprint = isPressed;
    } else if (code === 'KeyC' || code === 'ControlLeft' || key === 'c' || key === 'control') {
      this.keys.crouch = isPressed;
    } else if ((code === 'KeyF' || key === 'f') && isPressed && this.onInteractKey) {
      this.onInteractKey('flashlight');
    } else if ((code === 'KeyE' || key === 'e') && isPressed && this.onInteractKey) {
      this.onInteractKey('interact');
    } else if ((code === 'Tab' || code === 'KeyI' || key === 'tab' || key === 'i') && isPressed && this.onInteractKey) {
      this.onInteractKey('inventory');
    } else if ((code === 'KeyT' || key === 't') && isPressed && this.onInteractKey) {
      this.onInteractKey('dev_menu');
    } else if ((code === 'KeyQ' || key === 'q') && isPressed && this.onInteractKey) {
      this.onInteractKey('archive');
    } else if (code.startsWith('Digit') || ['1','2','3','4','5','6'].includes(key)) {
      if (isPressed && this.onInteractKey) {
        const slotNum = code.startsWith('Digit') ? code.replace('Digit', '') : key;
        this.onInteractKey(`slot_${slotNum}`);
      }
    }
  }

  consumeMouseDelta() {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }
}
