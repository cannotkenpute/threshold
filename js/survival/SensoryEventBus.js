export const SENSORY_EVENT_TYPES = Object.freeze([
  'player:footstep',
  'player:sprint',
  'player:flashlight',
  'player:interaction',
  'player:item_collected',
  'player:route_cell',
  'player:distress',
]);

const VALID_TYPES = new Set(SENSORY_EVENT_TYPES);

function copyPosition(position) {
  return {
    x: Number(position && position.x) || 0,
    y: Number(position && position.y) || 0,
    z: Number(position && position.z) || 0,
  };
}

export class SensoryEventBus {
  constructor(maxHistory = 256) {
    this.maxHistory = Math.max(16, maxHistory);
    this.sequence = 0;
    this.gameTime = 0;
    this.history = [];
    this.listeners = new Set();
  }

  emit(type, payload = {}) {
    if (!VALID_TYPES.has(type)) throw new Error(`Unknown sensory event type: ${String(type)}`);
    const event = Object.freeze({
      type,
      playerId: payload.playerId || 'local',
      position: Object.freeze(copyPosition(payload.position)),
      intensity: Math.max(0, Number(payload.intensity) || 0),
      gameTime: Math.max(0, Number(payload.gameTime ?? this.gameTime) || 0),
      sequence: ++this.sequence,
    });
    this.history.push(event);
    if (this.history.length > this.maxHistory) this.history.shift();
    for (const listener of this.listeners) listener(event);
    return event;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('Sensory listener must be a function');
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  eventsSince(sequence = 0) {
    return this.history.filter((event) => event.sequence > sequence);
  }

  setGameTime(gameTime) {
    this.gameTime = Math.max(0, Number(gameTime) || 0);
  }

  clear() {
    this.history.length = 0;
    this.listeners.clear();
  }
}
