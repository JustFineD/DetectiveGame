// gameEngine.js
// Core rules engine for "מי הגנב?" (Who's the Fox?) - a cooperative detective board game.
// This module is framework-agnostic: it holds pure game state + logic, no networking.

const BOARD_SIZE = 20;
const CENTER = { x: 9, y: 9 }; // All detectives start here.

// Pool of possible items a suspect (or the fox) can carry.
// Feel free to extend/replace - Hebrew display names + short ids.
const ITEM_POOL = [
  { id: 'tie', name: 'עניבה' },
  { id: 'hat', name: 'כובע' },
  { id: 'black_shoes', name: 'נעליים שחורות' },
  { id: 'glasses', name: 'משקפיים' },
  { id: 'scarf', name: 'צעיף' },
  { id: 'cane', name: 'מקל הליכה' },
  { id: 'watch', name: 'שעון' },
  { id: 'gloves', name: 'כפפות' },
  { id: 'coat', name: 'מעיל' },
  { id: 'pipe', name: 'מקטרת' },
  { id: 'bag', name: 'תיק' },
  { id: 'umbrella', name: 'מטריה' },
  { id: 'ring', name: 'טבעת' },
  { id: 'medal', name: 'מדליה' },
  { id: 'key', name: 'מפתח' }
];

// Pool of suspect names (needs to be >= number of suspects requested).
const NAME_POOL = [
  'משה כהן', 'רותי לוי', 'דני אברהם', 'שירה מזרחי', 'יוסי פרץ',
  'נועה בן דוד', 'אבי גולן', 'מיכל שגיא', 'עומר חדד', 'טליה אזולאי',
  'רון שפירא', 'הדר נחום', 'איתי ברק', 'קרן דהן', 'גיל וייס',
  'ליאור נוי', 'עדי רז', 'בועז אלון', 'שרון מלכה', 'אורי טל',
  'נטלי בר', 'עידן שלו', 'יעל קדוש', 'רועי סבן', 'דורית עמר',
  'אלון פינטו', 'מאיה זהבי', 'תומר יוסף', 'ורד אשכנזי', 'נדב חסון'
];

const AVG_ITEM_OCCURRENCE = 5; // tuning knob: how many suspects (on average) share each item
const ITEMS_PER_SUSPECT = 3;
const FOX_TRACK_LENGTH = 50;
const FOX_STEP_ON_FAIL = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandomSubset(pool, count) {
  return shuffle(pool).slice(0, count);
}

// Builds a fixed serpentine path of BOARD-cells for the fox to walk along,
// so the fox's track is visually merged into the same 20x20 board instead
// of living on a separate strip. The path sweeps along the board's border
// (perimeter) which naturally reads as a "track" framing the board.
function buildFoxPath(length) {
  const perimeter = [];
  const n = BOARD_SIZE;
  // top row left->right
  for (let x = 0; x < n; x++) perimeter.push({ x, y: 0 });
  // right col top->bottom
  for (let y = 1; y < n; y++) perimeter.push({ x: n - 1, y });
  // bottom row right->left
  for (let x = n - 2; x >= 0; x--) perimeter.push({ x, y: n - 1 });
  // left col bottom->top
  for (let y = n - 2; y >= 1; y--) perimeter.push({ x: 0, y });
  // Take exactly `length` evenly-spaced cells around the perimeter so the
  // fox's 50-step track is spread all the way around the board.
  const path = [];
  for (let i = 0; i < length; i++) {
    const idx = Math.floor((i / length) * perimeter.length);
    path.push(perimeter[idx]);
  }
  return path;
}

// Fixed clue-tile layout: positions never change between games (as requested),
// only *which item* sits at each position is randomized per game.
// Arranged as a ring around the center starting area, well inside the
// perimeter (so it doesn't collide with the fox's track).
const CLUE_POSITIONS = [
  { x: 4, y: 4 }, { x: 9, y: 3 }, { x: 14, y: 4 },
  { x: 3, y: 9 }, { x: 15, y: 9 },
  { x: 4, y: 14 }, { x: 9, y: 15 }, { x: 14, y: 14 },
  { x: 6, y: 6 }, { x: 12, y: 6 }, { x: 6, y: 12 }, { x: 12, y: 12 },
  { x: 2, y: 2 }, { x: 17, y: 2 }, { x: 2, y: 17 }, { x: 17, y: 17 }
];

function computeItemCount(numSuspects) {
  const raw = Math.ceil((numSuspects * ITEMS_PER_SUSPECT) / AVG_ITEM_OCCURRENCE);
  return Math.max(4, Math.min(raw, ITEM_POOL.length, CLUE_POSITIONS.length));
}

class Die {
  constructor() {
    this.value = null; // 'eye' | 'foot1' | 'foot2' | 'foot3'
    this.locked = false; // player chose to keep this die between rerolls
  }
  roll() {
    if (this.locked) return;
    const faces = ['eye', 'eye', 'eye', 'foot1', 'foot2', 'foot3'];
    this.value = faces[Math.floor(Math.random() * faces.length)];
  }
}

class GameEngine {
  /**
   * @param {object} opts
   * @param {number} opts.numSuspects total suspect cards in the deck (default 25)
   * @param {string[]} opts.playerIds ids of the players (1-4)
   */
  constructor({ numSuspects = 25, playerIds = [] } = {}) {
    if (playerIds.length < 1 || playerIds.length > 4) {
      throw new Error('Windows detective game supports 1 to 4 players');
    }
    this.numSuspects = numSuspects;
    this.playerIds = playerIds;
    this.turnIndex = 0;
    this.log = [];
    this.status = 'playing'; // 'playing' | 'detectives_win' | 'fox_wins'
    this.pendingRoll = null; // holds in-progress dice-roll state for current turn

    this._setup();
  }

  _setup() {
    const itemCount = computeItemCount(this.numSuspects);
    this.items = pickRandomSubset(ITEM_POOL, itemCount);

    // Assign each clue position a random item from the chosen set (1:1).
    const shuffledPositions = shuffle(CLUE_POSITIONS).slice(0, itemCount);
    this.clues = this.items.map((item, i) => ({
      itemId: item.id,
      pos: shuffledPositions[i],
      revealed: false,
      belongsToFox: null // filled in once the fox is chosen
    }));

    // Build the suspect deck. One of these becomes the fox.
    const names = pickRandomSubset(NAME_POOL, this.numSuspects);
    this.deck = names.map((name, i) => ({
      id: `suspect-${i}`,
      name,
      items: pickRandomSubset(this.items, ITEMS_PER_SUSPECT).map(it => it.id)
    }));
    this.deck = shuffle(this.deck);

    // Secretly choose the fox from the deck without anyone seeing it.
    const foxIndex = Math.floor(Math.random() * this.deck.length);
    this.fox = this.deck.splice(foxIndex, 1)[0];
    // Fox's card goes back into circulation - it CAN be drawn like any other card,
    // its items just happen to always match what's revealed.
    this.deck.splice(Math.floor(Math.random() * (this.deck.length + 1)), 0, this.fox);

    for (const clue of this.clues) {
      clue.belongsToFox = this.fox.items.includes(clue.itemId);
    }

    this.foxPath = buildFoxPath(FOX_TRACK_LENGTH);
    this.foxStep = 0; // index into foxPath; 0 = not moved yet

    this.hand = []; // suspects currently drawn & not yet burned (shared, visible to all)
    this.burned = []; // suspects eliminated

    this.players = {};
    for (const id of this.playerIds) {
      this.players[id] = {
        id,
        pos: { ...CENTER },
        remainingSteps: 0 // steps left to spend this turn after a successful footprints roll
      };
    }
  }

  currentPlayerId() {
    return this.playerIds[this.turnIndex];
  }

  _advanceTurn() {
    this.turnIndex = (this.turnIndex + 1) % this.playerIds.length;
    this.pendingRoll = null;
  }

  _checkWinLoss() {
    if (this.foxStep >= FOX_TRACK_LENGTH) {
      this.status = 'fox_wins';
      return;
    }
    if (this.deck.length === 0) {
      const alive = this.hand.filter(s => !s.burnedAt);
      if (alive.length === 1) {
        this.status = 'detectives_win';
        this.solvedSuspect = alive[0];
      }
      // If 0 or >1 remain with an empty deck, the mystery can no longer be
      // narrowed by drawing suspects. This is a design edge case: it means
      // the suspects/items ratio let too many (or too few) survive.
      // TODO: revisit ratio tuning (AVG_ITEM_OCCURRENCE) if this triggers often.
    }
  }

  // --- Turn actions -------------------------------------------------

  /** Step 1 of a turn: player declares what they're going for. */
  declareGoal(playerId, goal) {
    this._assertTurn(playerId);
    if (goal !== 'suspects' && goal !== 'footprints') {
      throw new Error('goal must be "suspects" or "footprints"');
    }
    if (this.pendingRoll) throw new Error('Already declared this turn');
    this.pendingRoll = {
      goal,
      playerId,
      attempt: 0, // 0-indexed; 0,1,2 = three allowed rolls
      dice: [new Die(), new Die(), new Die()],
      resolved: false
    };
    this._log(`${playerId} declared goal: ${goal}`);
    return this.getState();
  }

  /** Roll (or re-roll) the dice that aren't locked. */
  rollDice(playerId) {
    this._assertTurn(playerId);
    const pr = this.pendingRoll;
    if (!pr) throw new Error('Declare a goal before rolling');
    if (pr.resolved) throw new Error('This roll is already resolved');
    if (pr.attempt >= 3) throw new Error('No rolls left');

    for (const die of pr.dice) die.roll();
    pr.attempt += 1;

    const symbol = pr.goal === 'suspects' ? 'eye' : null;
    const matchesGoal = pr.dice.every(d =>
      pr.goal === 'suspects' ? d.value === 'eye' : d.value !== 'eye'
    );

    if (matchesGoal) {
      pr.resolved = true;
      pr.success = true;
      this._applySuccess(playerId, pr);
    } else if (pr.attempt >= 3) {
      pr.resolved = true;
      pr.success = false;
      this._applyFailure(playerId);
    }
    this._log(`${playerId} rolled attempt ${pr.attempt}: ${pr.dice.map(d => d.value).join(',')}`);
    return this.getState();
  }

  /** Between rolls, choose which dice to keep locked for the next roll. */
  toggleLock(playerId, dieIndex) {
    this._assertTurn(playerId);
    const pr = this.pendingRoll;
    if (!pr || pr.resolved) throw new Error('No active roll to lock dice for');
    if (dieIndex < 0 || dieIndex > 2) throw new Error('Invalid die index');
    pr.dice[dieIndex].locked = !pr.dice[dieIndex].locked;
    return this.getState();
  }

  _applyFailure(playerId) {
    this.foxStep = Math.min(FOX_TRACK_LENGTH, this.foxStep + FOX_STEP_ON_FAIL);
    this._log(`${playerId} failed all 3 rolls - the fox advances ${FOX_STEP_ON_FAIL} steps (now at ${this.foxStep}/${FOX_TRACK_LENGTH})`);
    this._checkWinLoss();
    // Turn advancement is deferred until the player acknowledges the result
    // (see acknowledgeRoll) so their client has a chance to actually show
    // the resolved dice before the screen moves on.
  }

  _applySuccess(playerId, pr) {
    if (pr.goal === 'footprints') {
      const steps = pr.dice.reduce((sum, d) => {
        const map = { foot1: 1, foot2: 2, foot3: 3 };
        return sum + map[d.value];
      }, 0);
      this.players[playerId].remainingSteps = steps;
      this._log(`${playerId} succeeded on attempt ${pr.attempt} - gained ${steps} steps to move`);
    } else {
      // suspects: attempt 1 -> 3 cards, attempt 2 -> 2 cards, attempt 3 -> 1 card
      const drawCount = 4 - pr.attempt; // attempt(1,2,3) -> (3,2,1)
      const drawn = [];
      for (let i = 0; i < drawCount && this.deck.length > 0; i++) {
        drawn.push(this.deck.pop());
      }
      for (const suspect of drawn) {
        this._checkSuspectAgainstRevealedClues(suspect);
        this.hand.push(suspect);
      }
      this._log(`${playerId} succeeded on attempt ${pr.attempt} - drew ${drawn.length} suspect(s)`);
      this._checkWinLoss();
    }
    // Turn advancement for a 'suspects' success is deferred to acknowledgeRoll
    // (same reasoning as _applyFailure). For 'footprints', the turn stays
    // open regardless until the player spends their steps via moveAdjacent.
  }

  /**
   * The player who just rolled calls this once their client has finished
   * showing the dice animation/result. This is what actually advances the
   * turn (for a 'suspects' roll or any failure) - decoupling "the roll is
   * resolved" from "the turn moves on" is what lets the client reliably
   * display the final dice faces before the screen changes, instead of the
   * turn switching away in the very same update that resolved the roll.
   */
  acknowledgeRoll(playerId) {
    this._assertTurn(playerId);
    const pr = this.pendingRoll;
    if (!pr || pr.playerId !== playerId || !pr.resolved) {
      throw new Error('No resolved roll to acknowledge');
    }
    const isFootprintsSuccess = pr.goal === 'footprints' && pr.success;
    if (isFootprintsSuccess) {
      // Turn stays open so the player can spend their steps; just clear the
      // roll display so a future re-render doesn't re-show old dice.
      this.pendingRoll = null;
    } else {
      this._advanceTurn(); // also clears pendingRoll
    }
    return this.getState();
  }

  _checkSuspectAgainstRevealedClues(suspect) {
    for (const clue of this.clues) {
      if (!clue.revealed) continue;
      const holds = suspect.items.includes(clue.itemId);
      if (clue.belongsToFox && !holds) { suspect.burnedAt = Date.now(); return; }
      if (!clue.belongsToFox && holds) { suspect.burnedAt = Date.now(); return; }
    }
  }

  _reRunAllSuspectChecks() {
    for (const suspect of this.hand) {
      if (!suspect.burnedAt) this._checkSuspectAgainstRevealedClues(suspect);
    }
  }

  /**
   * Move the current player one cell (to an orthogonal neighbor) by clicking
   * it on the board. Called once per step - the client highlights only the
   * legal neighboring cells and the player clicks through them one at a
   * time until `remainingSteps` reaches 0, which is what naturally enforces
   * "must use every rolled step". Landing on (or passing through, since each
   * call only ever moves one cell) a clue tile collects it automatically.
   */
  moveAdjacent(playerId, target) {
    this._assertTurn(playerId);
    const player = this.players[playerId];
    if (player.remainingSteps <= 0) throw new Error('No steps left to spend');
    if (target.x < 0 || target.x >= BOARD_SIZE || target.y < 0 || target.y >= BOARD_SIZE) {
      throw new Error('Target is off the board');
    }
    const manhattan = Math.abs(target.x - player.pos.x) + Math.abs(target.y - player.pos.y);
    if (manhattan !== 1) throw new Error('Target must be an adjacent cell (one step away)');

    player.pos = target;
    player.remainingSteps -= 1;

    const clue = this.clues.find(c => !c.revealed && c.pos.x === target.x && c.pos.y === target.y);
    if (clue) {
      clue.revealed = true;
      this._log(`${playerId} uncovered a clue: "${this.items.find(i => i.id === clue.itemId).name}" ${clue.belongsToFox ? 'belongs' : 'does NOT belong'} to the fox`);
      this._reRunAllSuspectChecks();
      this._checkWinLoss();
    }

    if (player.remainingSteps === 0 && this.status === 'playing') {
      this._advanceTurn();
    }
    return this.getState();
  }

  _assertTurn(playerId) {
    if (playerId !== this.currentPlayerId()) {
      throw new Error('Not your turn');
    }
  }

  _log(msg) {
    this.log.push({ t: Date.now(), msg });
    if (this.log.length > 200) this.log.shift();
  }

  /** Serializable public state - never leaks which suspect is the fox. */
  getState() {
    return {
      boardSize: BOARD_SIZE,
      status: this.status,
      solvedSuspect: this.solvedSuspect || null,
      turnPlayerId: this.currentPlayerId(),
      players: this.players,
      items: this.items,
      clues: this.clues.map(c => ({
        pos: c.pos,
        revealed: c.revealed,
        itemId: c.revealed ? c.itemId : null,
        belongsToFox: c.revealed ? c.belongsToFox : null
      })),
      deckCount: this.deck.length,
      hand: this.hand.map(s => ({ id: s.id, name: s.name, items: s.items, burned: !!s.burnedAt })),
      foxPath: this.foxPath,
      foxStep: this.foxStep,
      foxTrackLength: FOX_TRACK_LENGTH,
      pendingRoll: this.pendingRoll && {
        goal: this.pendingRoll.goal,
        playerId: this.pendingRoll.playerId,
        attempt: this.pendingRoll.attempt,
        dice: this.pendingRoll.dice.map(d => ({ value: d.value, locked: d.locked })),
        resolved: this.pendingRoll.resolved,
        success: this.pendingRoll.success
      },
      log: this.log.slice(-30)
    };
  }
}

module.exports = { GameEngine, BOARD_SIZE, ITEM_POOL };
