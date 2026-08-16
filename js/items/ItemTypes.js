/**
 * 1980s Item Database & Definitions
 */

export const ITEM_TYPES = {
  battery: {
    id: 'battery',
    name: 'Alkaline D-Cell Battery',
    category: 'SURVIVAL',
    icon: '⚡',
    description: '1.5V heavy-duty alkaline cell. Used to recharge the exploration flashlight.',
    stackable: true,
    maxStack: 6,
    onUse: (player, hud) => {
      if (player.batteryLevel >= 95) return false;
      player.reloadBattery();
      return true;
    }
  },
  almond_water: {
    id: 'almond_water',
    name: 'Unmarked Bottle ("Almond Water")',
    category: 'SURVIVAL',
    icon: '💧',
    description: 'Clear glass bottle with handwritten masking tape label. Sweet aroma with faint almond traces. Restores 30% Health, 35% Sanity, and 20% Stamina.',
    stackable: true,
    maxStack: 3,
    onUse: (player, hud) => {
      player.heal(30);
      player.sanity = Math.min(100, player.sanity + 35);
      player.stamina = Math.min(100, player.stamina + 20);
      return true;
    }
  },
  medkit: {
    id: 'medkit',
    name: 'Emergency First Aid Kit',
    category: 'MEDICAL',
    icon: '🩹',
    description: 'Field medical pack containing sterile gauze, antiseptic, and ammonia ampoules. Restores 100% Health, calms severe panic, and revives stamina.',
    stackable: false,
    maxStack: 1,
    onUse: (player, hud) => {
      player.heal(100);
      player.sanity = 100;
      player.stamina = 100;
      return true;
    }
  },
  ration_pack: {
    id: 'ration_pack',
    name: 'DSA Field Ration Pack',
    category: 'SURVIVAL',
    icon: '🥫',
    description: 'Sealed 1980s-issue survival ration tin. Foil pouch labeled "DEPT. OF SPATIAL ANOMALY — EMERGENCY SUSTAINMENT". Restores 40% Hunger.',
    stackable: true,
    maxStack: 5,
    onUse: (player, hud) => {
      if (player.survivalState) player.survivalState.eat(40);
      return true;
    }
  },
  canteen_water: {
    id: 'canteen_water',
    name: 'Military Canteen',
    category: 'SURVIVAL',
    icon: '🧴',
    description: 'Dented steel canteen with a screw cap, stamped with a faded DSA supply serial. Restores 45% Thirst.',
    stackable: true,
    maxStack: 4,
    onUse: (player, hud) => {
      if (player.survivalState) player.survivalState.drink(45);
      return true;
    }
  },
  security_keycard: {
    id: 'security_keycard',
    name: 'Level 5 Security Keycard',
    category: 'ACCESS',
    icon: '▣',
    description: 'DTE-04 facility access card encoded for Level 5 security airlocks.',
    stackable: false,
    maxStack: 1
  },
  convenience_store_key: {
    id: 'convenience_store_key',
    name: 'Antique Convenience Store Key',
    category: 'ACCESS',
    icon: '🔑',
    description: 'A weathered brass key found behind the roadside convenience store.',
    stackable: false,
    maxStack: 1
  },
  mercer_01: {
    id: 'mercer_01',
    name: 'Dr. Mercer Log 01 (Tape Reel)',
    category: 'RESEARCH',
    icon: '📼',
    description: 'Standard 60-minute microcassette. Recorded by Lead Expedition Physicist Dr. Evelyn Mercer.',
    stackable: false,
    isTape: true
  },
  reed_notes: {
    id: 'reed_notes',
    name: 'Dr. Reed Spatial Anomaly Notes',
    category: 'RESEARCH',
    icon: '📄',
    description: 'Handwritten graph paper notes documenting non-Euclidean spatial folding.',
    stackable: false,
    isDoc: true
  },
  cole_tape: {
    id: 'cole_tape',
    name: 'Daniel Cole Audio Tape #2',
    category: 'RESEARCH',
    icon: '📼',
    description: 'Microcassette marked "EMERGENCY COMMS BACKUP - D. COLE".',
    stackable: false,
    isTape: true
  },
  park_notes: {
    id: 'park_notes',
    name: 'Dr. Helen Park Biological Log',
    category: 'RESEARCH',
    icon: '📄',
    description: 'Field report documenting biological carpet residue and organic moisture.',
    stackable: false,
    isDoc: true
  },
  wall_warning: {
    id: 'wall_warning',
    name: 'Observation Room Scrawled Warning',
    category: 'RESEARCH',
    icon: '⚠️',
    description: 'Rubbing of the desperate directional arrows on the wallpaper.',
    stackable: false,
    isDoc: true
  },
  mercer_final: {
    id: 'mercer_final',
    name: 'Dr. Mercer Final Audio Tape',
    category: 'RESEARCH',
    icon: '📼',
    description: 'Heavily damaged tape recovered from destroyed campsite.',
    stackable: false,
    isTape: true
  },
  garage_mercer_tape: {
    id: 'garage_mercer_tape',
    name: 'Dr. Mercer Garage Log (Tape Reel)',
    category: 'RESEARCH',
    icon: '📼',
    description: 'Microcassette found on vehicle in the Subterranean Complex.',
    stackable: false,
    isTape: true
  },
  gas_can: {
    id: 'gas_can',
    name: 'Emergency Fuel Canister [GAS CAN]',
    category: 'SURVIVAL',
    icon: '⛽',
    description: 'Heavy metal red jerrycan with remaining fuel. Needed to fuel generator or vehicle escape.',
    stackable: false,
    maxStack: 1
  },
  crow_bar: {
    id: 'crow_bar',
    name: 'Steel Crowbar',
    category: 'TOOL',
    icon: '🔧',
    description: 'Heavy-duty steel pry bar. Can be used to jimmy open locked car doors or force entries.',
    stackable: false,
    maxStack: 1
  },
  police_radio_tape: {
    id: 'police_radio_tape',
    name: 'Highway Patrol Dispatch Tape (Unit 412)',
    category: 'RESEARCH',
    icon: '📼',
    description: 'Cassette from an abandoned State Patrol cruiser. Radio calls report infinite road paradox.',
    stackable: false,
    isTape: true
  },
  highway_reed_store_tape: {
    id: 'highway_reed_store_tape',
    name: 'Dr. Reed Roadside Store Recording',
    category: 'RESEARCH',
    icon: '📼',
    description: 'An undated microcassette left in the middle of the abandoned convenience store.',
    stackable: false,
    isTape: true
  }
};
