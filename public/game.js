// game.js - client logic: lobby flow + rendering the board + sending actions.

const socket = io();

const CELL = 28; // px per board cell, matches viewBox 560/20
const PLAYER_COLORS = ['#4f7cff', '#e08b3c', '#4fd18b', '#d14fd1']; // detectives = cats
const SUSPECT_COLORS = ['#caa15b', '#8fbf6f', '#6fa8bf', '#bf6f9d', '#bf8f6f', '#7f8fbf']; // suspects = birds

// Cartoon cat/bird icons + dice-pip icons (paw/eye), drawn once as <symbol>s
// and reused everywhere via <use>. Bodies use fill="currentColor" so each
// character can be tinted per player/suspect just by setting CSS `color`.
// Injected once into a hidden <svg> in the document so both the board SVG
// and the plain-HTML dice faces can reference the same ids.
const ICON_DEFS_SVG = `
<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true">
<defs>
  <symbol id="catIcon" viewBox="0 0 24 24">
    <path d="M6 8 L2 2 L9 6 Z" fill="currentColor"/>
    <path d="M18 8 L22 2 L15 6 Z" fill="currentColor"/>
    <path d="M6.3 7 L4 4 L7.6 6.2 Z" fill="#ffc2d1"/>
    <path d="M17.7 7 L20 4 L16.4 6.2 Z" fill="#ffc2d1"/>
    <circle cx="12" cy="13" r="8" fill="currentColor"/>
    <circle cx="8.7" cy="12" r="3.4" fill="#fff8f0"/>
    <circle cx="15.3" cy="12" r="3.4" fill="#fff8f0"/>
    <circle cx="8.9" cy="12.6" r="1.6" fill="#151515"/>
    <circle cx="15.5" cy="12.6" r="1.6" fill="#151515"/>
    <circle cx="9.5" cy="11.8" r="0.55" fill="#fff"/>
    <circle cx="16.1" cy="11.8" r="0.55" fill="#fff"/>
    <circle cx="6.6" cy="15.6" r="1.5" fill="#ffb3c1" opacity="0.7"/>
    <circle cx="17.4" cy="15.6" r="1.5" fill="#ffb3c1" opacity="0.7"/>
    <path d="M11 15.8 L13 15.8 L12 17 Z" fill="#e0899a"/>
    <path d="M12 17 Q10.6 18.2 9.2 17.6" stroke="#151515" stroke-width="0.6" fill="none" stroke-linecap="round"/>
    <path d="M12 17 Q13.4 18.2 14.8 17.6" stroke="#151515" stroke-width="0.6" fill="none" stroke-linecap="round"/>
    <line x1="2.5" y1="15" x2="7" y2="15.4" stroke="#151515" stroke-width="0.5"/>
    <line x1="2.5" y1="17" x2="7" y2="16.6" stroke="#151515" stroke-width="0.5"/>
    <line x1="21.5" y1="15" x2="17" y2="15.4" stroke="#151515" stroke-width="0.5"/>
    <line x1="21.5" y1="17" x2="17" y2="16.6" stroke="#151515" stroke-width="0.5"/>
  </symbol>
  <symbol id="birdIcon" viewBox="0 0 24 24">
    <path d="M6.5 16 Q3 18.5 2 22 Q7 20.5 9 17 Z" fill="currentColor" opacity="0.8"/>
    <ellipse cx="10" cy="15" rx="7.5" ry="6" fill="currentColor"/>
    <path d="M3 5 L5.5 8.2 L2 8.7 Z" fill="currentColor"/>
    <path d="M6.2 3.8 L7.8 7.6 L4.5 7.1 Z" fill="currentColor"/>
    <circle cx="15.5" cy="9" r="5.2" fill="currentColor"/>
    <circle cx="14.4" cy="7.7" r="2.7" fill="#fff8f0"/>
    <circle cx="14.9" cy="8" r="1.5" fill="#151515"/>
    <circle cx="15.5" cy="7.4" r="0.5" fill="#fff"/>
    <circle cx="12" cy="10.8" r="1.2" fill="#ffb3c1" opacity="0.7"/>
    <path d="M19.6 8.5 L23.8 7.1 L19.9 10.6 Z" fill="#e08b3c"/>
    <path d="M6 20.5 L5 23" stroke="#e08b3c" stroke-width="1.1" stroke-linecap="round"/>
    <path d="M9 20.5 L9.3 23" stroke="#e08b3c" stroke-width="1.1" stroke-linecap="round"/>
  </symbol>
  <symbol id="pawIcon" viewBox="0 0 24 24">
    <ellipse cx="12" cy="16" rx="6.2" ry="5" fill="currentColor"/>
    <circle cx="5.6" cy="8.2" r="2.7" fill="currentColor"/>
    <circle cx="12" cy="5.8" r="2.9" fill="currentColor"/>
    <circle cx="18.4" cy="8.2" r="2.7" fill="currentColor"/>
  </symbol>
  <symbol id="eyeIcon" viewBox="0 0 24 24">
    <path d="M1.5 12 Q12 1 22.5 12 Q12 23 1.5 12 Z" fill="currentColor"/>
    <circle cx="12" cy="12" r="4.6" fill="#3a2415"/>
    <circle cx="13.4" cy="10.5" r="1.3" fill="#fff"/>
  </symbol>

  <!-- Item icons a suspect can "carry" - drawn instead of item name text. -->
  <symbol id="item-tie" viewBox="0 0 16 16"><path d="M8 1 L10 4 L8.6 4 L9.4 13 L8 15 L6.6 13 L7.4 4 L6 4 Z" fill="currentColor"/></symbol>
  <symbol id="item-hat" viewBox="0 0 16 16"><rect x="2" y="11" width="12" height="2" rx="1" fill="currentColor"/><rect x="4" y="3" width="8" height="8" rx="1" fill="currentColor"/></symbol>
  <symbol id="item-black_shoes" viewBox="0 0 16 16"><path d="M2 13 L2 9 Q2 7 4 7 L8 7 L13 10 Q14 10.5 14 11.5 L14 13 Z" fill="currentColor"/></symbol>
  <symbol id="item-glasses" viewBox="0 0 16 16"><circle cx="4.5" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="11.5" cy="9" r="3" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="7.5" y1="8.5" x2="8.5" y2="8.5" stroke="currentColor" stroke-width="1.4"/><line x1="1" y1="8" x2="1.5" y2="9" stroke="currentColor" stroke-width="1.2"/><line x1="15" y1="8" x2="14.5" y2="9" stroke="currentColor" stroke-width="1.2"/></symbol>
  <symbol id="item-scarf" viewBox="0 0 16 16"><path d="M1 4 Q8 1 15 4 L15 6 Q8 3.5 1 6 Z" fill="currentColor"/><rect x="6" y="6" width="2.4" height="9" fill="currentColor"/></symbol>
  <symbol id="item-cane" viewBox="0 0 16 16"><path d="M10 1 Q13 1 13 4 Q13 6 10.5 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><line x1="10.5" y1="6" x2="6" y2="15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
  <symbol id="item-watch" viewBox="0 0 16 16"><rect x="6" y="0.5" width="4" height="3" rx="1" fill="currentColor"/><rect x="6" y="12.5" width="4" height="3" rx="1" fill="currentColor"/><circle cx="8" cy="8" r="4.3" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="8" y1="8" x2="8" y2="5.5" stroke="currentColor" stroke-width="1"/><line x1="8" y1="8" x2="9.6" y2="8.8" stroke="currentColor" stroke-width="1"/></symbol>
  <symbol id="item-gloves" viewBox="0 0 16 16"><path d="M4 15 L4 8 Q4 6 6 6 L6 3 Q6 2 7 2 Q8 2 8 3 L8 6 L9 6 L9 2.5 Q9 1.5 10 1.5 Q11 1.5 11 2.5 L11 6 Q13 6 13 8 L13 15 Z" fill="currentColor"/></symbol>
  <symbol id="item-coat" viewBox="0 0 16 16"><path d="M5 1 L8 3 L11 1 L13 4 L11.5 5.5 L12 15 L4 15 L4.5 5.5 L3 4 Z" fill="currentColor"/></symbol>
  <symbol id="item-pipe" viewBox="0 0 16 16"><path d="M2 9 Q2 6 5 6 L9 6 L9 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="8.3" y="5.3" width="6" height="4" rx="1.3" fill="currentColor"/></symbol>
  <symbol id="item-bag" viewBox="0 0 16 16"><path d="M5 6 L5 4 Q5 1 8 1 Q11 1 11 4 L11 6" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="2.5" y="6" width="11" height="9" rx="1.5" fill="currentColor"/></symbol>
  <symbol id="item-umbrella" viewBox="0 0 16 16"><path d="M1 8 Q8 0 15 8 Z" fill="currentColor"/><line x1="8" y1="8" x2="8" y2="14" stroke="currentColor" stroke-width="1.4"/><path d="M8 14 Q8 16 6 15.3" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></symbol>
  <symbol id="item-ring" viewBox="0 0 16 16"><circle cx="8" cy="10" r="4.3" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 3 L10 6 L6 6 Z" fill="currentColor"/></symbol>
  <symbol id="item-medal" viewBox="0 0 16 16"><path d="M5 1 L8 7 L11 1" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="10.5" r="4.3" fill="currentColor"/><circle cx="8" cy="10.5" r="2" fill="#1b1f2a"/></symbol>
  <symbol id="item-key" viewBox="0 0 16 16"><circle cx="4.5" cy="4.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><line x1="6.8" y1="6.8" x2="14" y2="14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="11" y1="11" x2="13" y2="9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><line x1="12.5" y1="12.5" x2="14.5" y2="10.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
</defs>
</svg>`;

document.body.insertAdjacentHTML('afterbegin', ICON_DEFS_SVG);

function stringToColor(str, palette) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

let myId = null;
let latestState = null;

// "Held back" visual state - see render() for why these lag behind the
// server's live state until a resolved roll has finished animating.
let displayedFoxStep = null;
let displayedHand = null;
let displayedStatus = null;

// Remembers which goal (hunt suspects / seek footprints) was last chosen so
// the toggle stays put between turns instead of snapping back to "hunt".
let lastGoalChoice = 'suspects';

// ---------- Lobby ----------

const el = (id) => document.getElementById(id);

el('createRoomBtn').onclick = () => {
  socket.emit('createRoom', { name: el('playerName').value.trim() });
};

el('joinRoomBtn').onclick = () => {
  socket.emit('joinRoom', {
    code: el('joinCode').value.trim(),
    name: el('playerName').value.trim()
  });
};

el('startGameBtn').onclick = () => {
  socket.emit('startGame', { numSuspects: parseInt(el('numSuspects').value, 10) || 25 });
};

socket.on('roomCreated', ({ code, players }) => {
  myId = socket.id;
  showRoom(code, players, true);
});

socket.on('roomUpdate', ({ code, players }) => {
  const isHost = players.length && players[0].id === socket.id;
  showRoom(code, players, isHost);
});

function showRoom(code, players, isHost) {
  el('roomInfo').classList.remove('hidden');
  el('roomCode').textContent = code;
  el('playerList').innerHTML = players.map(p => `<li>${escapeHtml(p.name)}</li>`).join('');
  el('startGameBtn').classList.toggle('hidden', !isHost);
  el('waitingMsg').classList.toggle('hidden', isHost);
}

socket.on('gameStarted', () => {
  el('lobby').classList.add('hidden');
  el('game').classList.remove('hidden');
});

socket.on('errorMsg', ({ message }) => {
  const box = el('lobbyError');
  box.textContent = message;
  box.classList.remove('hidden');
  setTimeout(() => box.classList.add('hidden'), 4000);
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------- Game state rendering ----------

socket.on('state', (state) => {
  myId = state.you;
  latestState = state;
  // If a dice-roll animation is currently playing, don't let a fresh state
  // yank the UI out from under it - the animation acknowledges the roll
  // itself once it's done, which is what triggers the next 'state' event.
  if (isRollAnimating) return;
  render(state);
});

// Some pieces of state (fox position/progress, the detective hand, a
// win/loss reveal) shouldn't visually update the instant a resolved roll
// arrives from the server - the player needs to see the dice animation (and,
// on a failed roll, the fox actually run away) FIRST. `freshResolvedRoll`
// detects "this state contains a roll result we haven't shown yet", and in
// that case we keep displaying the previous values for those pieces; once
// the dice (and fox) animation finishes, render() is called again with the
// same state, `freshResolvedRoll` is now false (lastAttemptShown caught up),
// and everything reveals at once.
function render(state) {
  if (displayedFoxStep === null) displayedFoxStep = state.foxStep;
  if (displayedHand === null) displayedHand = { hand: state.hand, deckCount: state.deckCount };
  if (displayedStatus === null) displayedStatus = { status: state.status, solvedSuspect: state.solvedSuspect };

  const pr = state.pendingRoll;
  const freshResolvedRoll = !!(pr && pr.resolved && pr.attempt > lastAttemptShown);
  const foxStepToShow = freshResolvedRoll ? displayedFoxStep : state.foxStep;

  renderStatus(state, freshResolvedRoll ? displayedStatus : null);
  renderFoxTrack(foxStepToShow, state.foxTrackLength);
  renderBoard(state, foxStepToShow);
  renderTurnPanel(state);
  renderHand(state, freshResolvedRoll ? displayedHand : null);

  if (!freshResolvedRoll) {
    displayedStatus = { status: state.status, solvedSuspect: state.solvedSuspect };
    displayedHand = { hand: state.hand, deckCount: state.deckCount };
    displayedFoxStep = state.foxStep;
  }
}

// `statusOverride`, when given, shows an earlier {status, solvedSuspect}
// instead of the live one - used to hold the "you lost/won" reveal back
// until a resolved dice roll has finished animating (see render()).
function renderStatus(state, statusOverride) {
  const box = el('statusMsg');
  const status = statusOverride ? statusOverride.status : state.status;
  const solvedSuspect = statusOverride ? statusOverride.solvedSuspect : state.solvedSuspect;
  if (status === 'fox_wins') {
    box.textContent = 'השועל ברח! הבלשים הפסידו 🦊';
  } else if (status === 'detectives_win') {
    box.textContent = `נמצא! הגנב הוא ${solvedSuspect.name} 🎉`;
  } else {
    const turnName = state.playerNames[state.turnPlayerId] || '?';
    box.textContent = state.turnPlayerId === state.you ? 'התור שלך!' : `תור של ${turnName}`;
  }
}

function renderFoxTrack(step, trackLength) {
  const pct = Math.min(100, Math.round((step / trackLength) * 100));
  el('foxProgressFill').style.width = pct + '%';
  el('foxStepsLabel').textContent = `${step}/${trackLength}`;
}

// A top-down "city" background (roads + building blocks + trees) is purely
// decorative and never changes between turns, so it's built once and cached
// instead of being regenerated on every render.
let cityBackgroundCache = null;

// Lightens (amt > 0) or darkens (amt < 0) a "#rrggbb" color by a flat amount
// per channel - used to shade a building's side/front walls vs its roof so
// blocks read as simple 3D-ish volumes instead of flat colored squares.
function shadeColor(hex, amt) {
  const num = parseInt(hex.replace('#', ''), 16);
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const r = clamp((num >> 16) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function drawPark(parts, bxPix, byPix, bw, bh) {
  parts.push(`<rect x="${bxPix}" y="${byPix}" width="${bw}" height="${bh}" fill="#4f7a4a"/>`);
  const spots = [[0.28, 0.3], [0.72, 0.35], [0.5, 0.72]];
  for (const [fx, fy] of spots) {
    const tx = bxPix + fx*bw, ty = byPix + fy*bh;
    parts.push(`<circle cx="${tx}" cy="${ty}" r="4" fill="#3f6b3a" opacity="0.6"/>`);
    parts.push(`<rect x="${tx-1.5}" y="${ty-1}" width="3" height="6" fill="#5a4632"/>`);
    parts.push(`<circle cx="${tx}" cy="${ty-7}" r="7" fill="#3f7a45"/>`);
  }
}

// A simple pseudo-3D building: the footprint sits on the ground, and the
// "roof" is that same footprint shifted up-and-left by the building's own
// height, so its right and bottom edges become visible shaded side walls -
// a cheap oblique-view trick that reads as a solid block instead of a flat
// tile. Footprint inset and height both vary per block (seeded by the
// block's index) so buildings differ in both floor size and how tall they
// look, instead of a uniform grid of identical boxes.
function drawBuilding(parts, bxPix, byPix, bw, bh, color, seed) {
  const margin = 3 + (seed % 4); // varies the footprint size a bit
  const height = 6 + ((seed * 11) % 5) * 3; // ~6-18px of apparent height
  const fx = bxPix + margin, fy = byPix + margin;
  const fw = Math.max(10, bw - margin * 2), fh = Math.max(10, bh - margin * 2);
  const rx = fx - height * 0.4, ry = fy - height;

  const sideColor = shadeColor(color, -30);
  const frontColor = shadeColor(color, -16);
  const roofColor = shadeColor(color, 14);

  // sidewalk halo behind the building
  parts.push(`<rect x="${bxPix}" y="${byPix}" width="${bw}" height="${bh}" rx="3" fill="#9a968a" opacity="0.3"/>`);

  // right-side wall
  parts.push(`<polygon points="${fx+fw},${fy} ${fx+fw},${fy+fh} ${rx+fw},${ry+fh} ${rx+fw},${ry}" fill="${sideColor}" stroke="#2e2620" stroke-width="0.6"/>`);
  // front (bottom) wall
  parts.push(`<polygon points="${fx},${fy+fh} ${fx+fw},${fy+fh} ${rx+fw},${ry+fh} ${rx},${ry+fh}" fill="${frontColor}" stroke="#2e2620" stroke-width="0.6"/>`);
  // roof / top face
  parts.push(`<rect x="${rx}" y="${ry}" width="${fw}" height="${fh}" fill="${roofColor}" stroke="#2e2620" stroke-width="0.8"/>`);

  // a couple of windows on the roof face
  const winCols = fw > 26 ? 2 : 1, winRows = fh > 26 ? 2 : 1;
  for (let wx = 0; wx < winCols; wx++) {
    for (let wy = 0; wy < winRows; wy++) {
      const winX = rx + 6 + wx * Math.max(1, fw - 16);
      const winY = ry + 6 + wy * Math.max(1, fh - 16);
      parts.push(`<rect x="${winX}" y="${winY}" width="7" height="7" fill="#f2e6b3" opacity="0.7"/>`);
    }
  }
  // lit windows on the visible front wall, for a bit of depth
  const frontWinCount = Math.max(1, Math.floor(fw / 18));
  for (let i = 0; i < frontWinCount; i++) {
    const t = (i + 0.5) / frontWinCount;
    const wx = fx + t * fw + (rx - fx) * 0.5;
    const wy = fy + fh * 0.55 + (ry - fy) * 0.5;
    parts.push(`<rect x="${wx-3}" y="${wy-3}" width="6" height="6" fill="#f2e6b3" opacity="0.55"/>`);
  }
  // a random rooftop fixture - antenna, water heater ("דוד"), solar panel,
  // or a plain AC condenser - picked per building for variety
  drawRoofDetail(parts, rx, ry, fw, fh, seed);
}

// Adds one randomly-chosen rooftop fixture, scaled to fit the roof, so
// buildings don't all look identical on top.
function drawRoofDetail(parts, rx, ry, fw, fh, seed) {
  const kind = Math.floor(Math.random() * 4); // 0 antenna, 1 boiler, 2 solar, 3 AC unit
  const cx = rx + Math.min(fw * 0.72, fw - 8);
  const cy = ry + Math.min(fh * 0.32, fh - 8);

  if (kind === 0) {
    // TV antenna: a short mast with a few crossbars
    parts.push(`<line x1="${cx}" y1="${cy+2}" x2="${cx}" y2="${cy-9}" stroke="#3a3a3a" stroke-width="1"/>`);
    parts.push(`<line x1="${cx-4}" y1="${cy-2}" x2="${cx+4}" y2="${cy-2}" stroke="#3a3a3a" stroke-width="1"/>`);
    parts.push(`<line x1="${cx-3}" y1="${cy-5}" x2="${cx+3}" y2="${cy-5}" stroke="#3a3a3a" stroke-width="1"/>`);
    parts.push(`<line x1="${cx-2}" y1="${cy-8}" x2="${cx+2}" y2="${cy-8}" stroke="#3a3a3a" stroke-width="1"/>`);
  } else if (kind === 1) {
    // water heater ("דוד") on legs, with a small tilted solar panel beside it
    parts.push(`<rect x="${cx-5}" y="${cy-5}" width="10" height="6" rx="3" fill="#c9c9c9" stroke="#8a8a8a" stroke-width="0.6"/>`);
    parts.push(`<line x1="${cx-4}" y1="${cy+1}" x2="${cx-4}" y2="${cy+4}" stroke="#6a6a6a" stroke-width="1"/>`);
    parts.push(`<line x1="${cx+4}" y1="${cy+1}" x2="${cx+4}" y2="${cy+4}" stroke="#6a6a6a" stroke-width="1"/>`);
    parts.push(`<rect x="${cx-8}" y="${cy+3}" width="15" height="3" fill="#4a6fa0" opacity="0.85"/>`);
  } else if (kind === 2) {
    // standalone solar panel array
    parts.push(`<rect x="${cx-8}" y="${cy-4}" width="16" height="9" fill="#2c4a70" stroke="#1a2f47" stroke-width="0.6"/>`);
    parts.push(`<line x1="${cx-4}" y1="${cy-4}" x2="${cx-4}" y2="${cy+5}" stroke="#1a2f47" stroke-width="0.5"/>`);
    parts.push(`<line x1="${cx}" y1="${cy-4}" x2="${cx}" y2="${cy+5}" stroke="#1a2f47" stroke-width="0.5"/>`);
    parts.push(`<line x1="${cx+4}" y1="${cy-4}" x2="${cx+4}" y2="${cy+5}" stroke="#1a2f47" stroke-width="0.5"/>`);
  } else {
    // plain AC condenser unit
    parts.push(`<rect x="${cx-4}" y="${cy-4}" width="8" height="8" fill="#3a3a3a" opacity="0.6"/>`);
  }
}

function buildCityBackground(size) {
  if (cityBackgroundCache) return cityBackgroundCache;
  const parts = [];
  const px = size * CELL;

  // Roads sit at irregular, unevenly-spaced lines on each axis (and the two
  // axes use different spacing from each other), so the resulting blocks
  // vary in size and the whole layout avoids looking like a symmetric,
  // perfectly repeating checkerboard.
  const roadsX = [0, 4, 9, 13, 17, size];
  const roadsY = [0, 3, 8, 12, 16, size];
  const buildingColors = ['#9c7b52', '#7d8f68', '#8a6b7d', '#6b7d8a', '#9c8b52', '#7d6b52', '#8f7a4d', '#6d8a7a', '#a8865f', '#5f7a8a'];

  parts.push(`<rect x="0" y="0" width="${px}" height="${px}" fill="#5c6b4f"/>`);

  for (const rx of roadsX) {
    if (rx >= size) continue;
    const p = rx * CELL;
    parts.push(`<rect x="${p-2}" y="0" width="${CELL+4}" height="${px}" fill="#7a7d82"/>`);
    parts.push(`<rect x="${p}" y="0" width="${CELL}" height="${px}" fill="#43474d"/>`);
    const mid = p + CELL/2;
    parts.push(`<line x1="${mid}" y1="0" x2="${mid}" y2="${px}" stroke="#d8c96a" stroke-width="1.5" stroke-dasharray="8 8" opacity="0.85"/>`);
  }
  for (const ry of roadsY) {
    if (ry >= size) continue;
    const p = ry * CELL;
    parts.push(`<rect x="0" y="${p-2}" width="${px}" height="${CELL+4}" fill="#7a7d82"/>`);
    parts.push(`<rect x="0" y="${p}" width="${px}" height="${CELL}" fill="#43474d"/>`);
    const mid = p + CELL/2;
    parts.push(`<line x1="0" y1="${mid}" x2="${px}" y2="${mid}" stroke="#d8c96a" stroke-width="1.5" stroke-dasharray="8 8" opacity="0.85"/>`);
  }
  // crosswalk stripes at every road intersection
  for (const rx of roadsX) {
    if (rx >= size) continue;
    for (const ry of roadsY) {
      if (ry >= size) continue;
      const x0 = rx*CELL, y0 = ry*CELL;
      for (let s = 0; s < 4; s++) {
        const off = 3 + s * 6;
        parts.push(`<rect x="${x0+off}" y="${y0+2}" width="4" height="${CELL-4}" fill="#e8e2d0" opacity="0.55"/>`);
        parts.push(`<rect x="${x0+2}" y="${y0+off}" width="${CELL-4}" height="4" fill="#e8e2d0" opacity="0.55"/>`);
      }
    }
  }

  // one building (or, every so often, a park) per city block - blocks are
  // simply the gaps between consecutive road lines, so their sizes follow
  // the irregular road spacing above instead of being uniform.
  let blockIdx = 0;
  for (let ix = 0; ix < roadsX.length - 1; ix++) {
    const bx0 = roadsX[ix] + 1, bx1 = roadsX[ix+1] - 1;
    if (bx1 < bx0) continue;
    for (let iy = 0; iy < roadsY.length - 1; iy++) {
      const by0 = roadsY[iy] + 1, by1 = roadsY[iy+1] - 1;
      if (by1 < by0) continue;
      const bxPix = bx0 * CELL, byPix = by0 * CELL;
      const bw = (bx1 - bx0 + 1) * CELL, bh = (by1 - by0 + 1) * CELL;

      if (blockIdx % 5 === 3) {
        drawPark(parts, bxPix, byPix, bw, bh);
      } else {
        drawBuilding(parts, bxPix, byPix, bw, bh, buildingColors[blockIdx % buildingColors.length], blockIdx);
      }
      blockIdx++;
    }
  }

  cityBackgroundCache = parts.join('');
  return cityBackgroundCache;
}

function ensureBoardGroups() {
  const svg = el('board');
  if (!svg.querySelector('#boardStatic')) {
    svg.innerHTML = '<g id="boardStatic"></g><g id="boardPlayers"></g>';
  }
}

function renderBoard(state, foxStepToShow) {
  ensureBoardGroups();
  const size = state.boardSize;
  let parts = [];

  // city backdrop (roads/buildings/trees), then a grid overlay so cells are
  // still easy to count for movement (thicker/more visible than a hairline)
  parts.push(buildCityBackground(size));
  for (let i = 0; i <= size; i++) {
    parts.push(`<line x1="${i*CELL}" y1="0" x2="${i*CELL}" y2="${size*CELL}" stroke="#ffffff" stroke-width="1.4" opacity="0.16"/>`);
    parts.push(`<line x1="0" y1="${i*CELL}" x2="${size*CELL}" y2="${i*CELL}" stroke="#ffffff" stroke-width="1.4" opacity="0.16"/>`);
  }

  // fox track (perimeter), a dim line to trace it visually - the fox itself
  // is a persistent token (see positionFoxToken) so it can walk smoothly
  // between cells instead of teleporting on every render.
  const path = state.foxPath;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i], b = path[i+1];
    parts.push(`<line x1="${a.x*CELL+CELL/2}" y1="${a.y*CELL+CELL/2}" x2="${b.x*CELL+CELL/2}" y2="${b.y*CELL+CELL/2}" stroke="#5a3a1e" stroke-width="3" stroke-linecap="round" opacity="0.5"/>`);
  }

  // clues: revealed ones show the actual item drawn on the tile instead of
  // a plain colored dot; unrevealed ones stay a generic "?" marker
  for (const clue of state.clues) {
    if (clue.revealed) {
      const bg = clue.belongsToFox ? '#2f6b3f' : '#6b2f2f';
      const iconColor = clue.belongsToFox ? '#bdf0c9' : '#f0bdbd';
      parts.push(circle(clue.pos.x, clue.pos.y, bg, '', 12));
      parts.push(icon(clue.pos.x, clue.pos.y, `item-${clue.itemId}`, iconColor, 16));
    } else {
      parts.push(circle(clue.pos.x, clue.pos.y, '#7a6a4a', '?', 8));
    }
  }

  // highlight + make clickable the single adjacent cells the current player
  // can step into next (one cell at a time until all rolled steps are used)
  const me = state.players[state.you];
  const isMyMoveTurn = state.turnPlayerId === state.you && state.status === 'playing' && me && me.remainingSteps > 0;
  if (isMyMoveTurn) {
    const neighbors = [
      { x: me.pos.x + 1, y: me.pos.y }, { x: me.pos.x - 1, y: me.pos.y },
      { x: me.pos.x, y: me.pos.y + 1 }, { x: me.pos.x, y: me.pos.y - 1 }
    ];
    for (const n of neighbors) {
      if (n.x < 0 || n.x >= size || n.y < 0 || n.y >= size) continue;
      parts.push(`<rect x="${n.x*CELL+2}" y="${n.y*CELL+2}" width="${CELL-4}" height="${CELL-4}" rx="5" fill="#ffffff" opacity="0.28" stroke="#ffffff" stroke-width="1.5" style="cursor:pointer" onclick="handleCellClick(${n.x},${n.y})"/>`);
    }
  }

  el('board').querySelector('#boardStatic').innerHTML = parts.join('');
  renderPlayerTokens(state);
  positionFoxToken(foxStepToShow, path);
}

// Player tokens (the cats) live as persistent DOM nodes updated in place
// (not rebuilt every render) so the browser can smoothly animate their x/y
// when they take a step, instead of teleporting between renders.
const playerTokenEls = {};
const knownPlayerPositions = {};

function renderPlayerTokens(state) {
  const group = el('board').querySelector('#boardPlayers');
  const ids = Object.keys(state.players);
  ids.forEach((id, idx) => {
    const p = state.players[id];
    const color = PLAYER_COLORS[idx % PLAYER_COLORS.length];
    const size = 24;
    let entry = playerTokenEls[id];
    if (!entry) {
      const ns = 'http://www.w3.org/2000/svg';
      const ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('r', String(size / 2 + 3));
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#fff');
      ring.setAttribute('stroke-width', '1.5');
      ring.classList.add('player-token-ring');
      const use = document.createElementNS(ns, 'use');
      use.setAttribute('href', '#catIcon');
      use.setAttribute('width', String(size));
      use.setAttribute('height', String(size));
      use.style.color = color;
      use.classList.add('player-token');
      group.appendChild(ring);
      group.appendChild(use);
      entry = { ring, use };
      playerTokenEls[id] = entry;
    }
    const cx = p.pos.x * CELL + CELL / 2;
    const cy = p.pos.y * CELL + CELL / 2;
    entry.ring.setAttribute('cx', String(cx));
    entry.ring.setAttribute('cy', String(cy));
    entry.ring.style.display = id === state.you ? '' : 'none';
    entry.use.setAttribute('x', String(cx - size / 2));
    entry.use.setAttribute('y', String(cy - size / 2));

    const prev = knownPlayerPositions[id];
    if (prev && (prev.x !== p.pos.x || prev.y !== p.pos.y)) {
      playMeowSound();
    }
    knownPlayerPositions[id] = { x: p.pos.x, y: p.pos.y };
  });
}

// The fox is a persistent token too (like the player cats), positioned via
// positionFoxToken() so CSS can smoothly animate it walking between cells
// along its track instead of jumping straight there.
let foxTokenEl = null;

function ensureFoxToken() {
  if (foxTokenEl) return foxTokenEl;
  const group = el('board').querySelector('#boardPlayers');
  const ns = 'http://www.w3.org/2000/svg';
  const glow = document.createElementNS(ns, 'circle');
  glow.setAttribute('r', '13');
  glow.setAttribute('fill', '#e08b3c');
  glow.classList.add('fox-token');
  const label = document.createElementNS(ns, 'text');
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('font-size', '13');
  label.classList.add('fox-token-label');
  label.textContent = '🦊';
  group.appendChild(glow);
  group.appendChild(label);
  foxTokenEl = { glow, label };
  return foxTokenEl;
}

function positionFoxToken(step, path) {
  const cell = path[Math.max(0, Math.min(path.length - 1, step - 1))] || path[0];
  const cx = cell.x * CELL + CELL / 2;
  const cy = cell.y * CELL + CELL / 2;
  const { glow, label } = ensureFoxToken();
  glow.setAttribute('cx', String(cx));
  glow.setAttribute('cy', String(cy));
  label.setAttribute('x', String(cx));
  label.setAttribute('y', String(cy + 4));
}

// Synthesizes a short, original "sneaky getaway" riff (a few quick plucked
// notes) - an in-house cartoon-chase flourish, not a reproduction of any
// existing tune - played whenever the fox actually makes its escape.
function playFoxEscapeSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const notes = [392, 466.16, 392, 349.23, 311.13, 349.23];
    notes.forEach((freq, i) => {
      const t = now + i * 0.1;
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      const gain = audioCtx.createGain();
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    });
  } catch (e) {
    // Web Audio unavailable - fail silently.
  }
}

// Walks the fox token forward one cell at a time along its track from
// `fromStep` to `toStep`, playing the getaway riff once at the start, and
// keeping the progress bar in sync with each hop. Calls `onDone` once the
// fox has actually arrived at its final step.
function animateFoxEscape(fromStep, toStep, path, trackLength, onDone) {
  if (toStep <= fromStep) { onDone(); return; }
  playFoxEscapeSound();
  let current = fromStep;
  function stepOnce() {
    current++;
    displayedFoxStep = current;
    positionFoxToken(current, path);
    renderFoxTrack(current, trackLength);
    if (current >= toStep) {
      onDone();
      return;
    }
    setTimeout(stepOnce, 160);
  }
  setTimeout(stepOnce, 60);
}

function circle(cx, cy, color, label, r = 8, highlight = false) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  const stroke = highlight ? `<circle cx="${x}" cy="${y}" r="${r+3}" fill="none" stroke="#fff" stroke-width="1.5"/>` : '';
  return `${stroke}<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>` +
    (label ? `<text x="${x}" y="${y+3}" text-anchor="middle" font-size="9" fill="#111">${label}</text>` : '');
}

// Places one of the reusable <symbol> icons (cat/bird) centered on a cell.
function icon(cx, cy, symbolId, color, size = 18, highlight = false) {
  const x = cx * CELL + CELL / 2;
  const y = cy * CELL + CELL / 2;
  const stroke = highlight
    ? `<circle cx="${x}" cy="${y}" r="${size/2 + 3}" fill="none" stroke="#fff" stroke-width="1.5"/>`
    : '';
  return `${stroke}<use href="#${symbolId}" x="${x - size/2}" y="${y - size/2}" width="${size}" height="${size}" style="color:${color}"/>`;
}

function renderTurnPanel(state) {
  const isMyTurn = state.turnPlayerId === state.you && state.status === 'playing';
  el('turnTitle').textContent = isMyTurn ? 'התור שלך' : 'ממתינים...';

  const goalArea = el('goalToggleWrap');
  const diceArea = el('diceArea');
  const moveArea = el('moveArea');
  goalArea.classList.add('hidden');
  diceArea.classList.add('hidden');
  moveArea.classList.add('hidden');

  if (!isMyTurn) return;

  // A pending roll (even a resolved one, until it's acknowledged) always
  // takes priority - this is what guarantees the dice are actually shown
  // before the screen moves on to the move buttons or the next turn.
  if (state.pendingRoll) {
    diceArea.classList.remove('hidden');
    renderDiceArea(state.pendingRoll);
    return;
  }
  lastAttemptShown = 0; // reset so the next roll sequence animates from scratch

  const me = state.players[state.you];
  if (me.remainingSteps > 0) {
    moveArea.classList.remove('hidden');
    el('stepsLabel').textContent = `נותרו ${me.remainingSteps} צעדים`;
    return;
  }

  goalArea.classList.remove('hidden');
  el('goalKnob').classList.toggle('pos-right', lastGoalChoice === 'footprints');
}

// ---------- Dice: realistic faces + roll animation ----------

const DIE_VALUES = ['eye', 'foot1', 'foot2', 'foot3'];
// Each slot is positioned as a percentage box within the die face - single
// pips get to be big and centered, paired/tripled ones shrink to fit.
const SLOT_RECT = {
  single: { top: 12, left: 12, size: 76 },
  tl: { top: 5, left: 5, size: 48 },
  br: { top: 47, left: 47, size: 48 },
  triCenter: { top: 26, left: 26, size: 48 }
};
const PIP_LAYOUT = {
  eye: ['single'], foot1: ['single'],
  foot2: ['tl', 'br'],
  foot3: ['tl', 'triCenter', 'br']
};

let lastAttemptShown = 0;
let isRollAnimating = false;

function diceFaceHTML(value) {
  if (!value) return '<div class="die-face"></div>';
  const symbolId = value === 'eye' ? 'eyeIcon' : 'pawIcon';
  const pipClass = value === 'eye' ? 'pip pip-eye' : 'pip pip-paw';
  const slots = PIP_LAYOUT[value];
  const pips = slots.map(slot => {
    const r = SLOT_RECT[slot];
    return `<svg class="${pipClass}" viewBox="0 0 24 24" style="top:${r.top}%;left:${r.left}%;width:${r.size}%;height:${r.size}%"><use href="#${symbolId}"/></svg>`;
  }).join('');
  return `<div class="die-face">${pips}</div>`;
}

function randomDieValue() {
  return DIE_VALUES[Math.floor(Math.random() * DIE_VALUES.length)];
}

// Synthesizes a short dice-rattle sound with the Web Audio API (no audio
// file needed). Several quick filtered noise "clacks" over ~1.5s, timed to
// roughly match the tumble animation.
let audioCtx = null;
function playDiceRollSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const clacks = 9;
    for (let i = 0; i < clacks; i++) {
      const t = now + i * 0.16 + Math.random() * 0.03;
      const dur = 0.045;
      const bufferSize = Math.floor(audioCtx.sampleRate * dur);
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / bufferSize, 3);
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 700 + Math.random() * 500;
      const gain = audioCtx.createGain();
      gain.gain.value = 0.35 * (1 - i / (clacks * 1.4));
      noise.connect(filter).connect(gain).connect(audioCtx.destination);
      noise.start(t);
    }
  } catch (e) {
    // Web Audio unavailable (or blocked) - fail silently, sound is a nicety.
  }
}

// Short synthesized "meow" (pitch bend up then down) played whenever any
// player's token actually moves a cell - no audio file needed.
function playMeowSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    const gain = audioCtx.createGain();
    osc.frequency.setValueAtTime(500, now);
    osc.frequency.exponentialRampToValueAtTime(850, now + 0.09);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.24);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch (e) {
    // Web Audio unavailable - fail silently.
  }
}

function attachDieClickHandlers(pr) {
  document.querySelectorAll('#diceRow .die').forEach(dieEl => {
    dieEl.onclick = () => {
      if (pr.resolved || isRollAnimating) return;
      socket.emit('toggleLock', { dieIndex: parseInt(dieEl.dataset.idx, 10) });
    };
  });
}

function renderDiceFacesStatic(pr, settle) {
  const diceRow = el('diceRow');
  diceRow.innerHTML = pr.dice.map((d, i) =>
    `<div class="die ${d.locked ? 'locked' : ''} ${settle ? 'settle' : ''}" data-idx="${i}">${diceFaceHTML(d.value)}</div>`
  ).join('');
  attachDieClickHandlers(pr);
}

function updateRollInfo(pr) {
  const rollBtn = el('rollBtn');
  if (pr.resolved) {
    rollBtn.classList.add('hidden');
    el('rollInfo').textContent = pr.success
      ? 'הצלחה! ✅'
      : `נכשל אחרי ${pr.attempt} ניסיונות ❌ - השועל התקדם`;
  } else {
    rollBtn.classList.remove('hidden');
    rollBtn.disabled = false;
    el('rollInfo').textContent = `ניסיון ${pr.attempt}/3 - בוחרים ${pr.goal === 'suspects' ? 'עיניים' : 'עקבות'}`;
  }
}

const ROLL_HOLD_MS = 800;  // extra pause on the final result before the UI moves on

// Each unlocked die tumbles on its own random-speed interval and stops at its
// own random time (roughly 1000-2400ms in), instead of all three freezing at
// once. Once every unlocked die has individually settled, the true final
// faces are already showing (they were revealed die-by-die), so we just
// update the roll-info text and, after a short pause, tell the server the
// player has seen the result via acknowledgeRoll - the server then decides
// whether the turn advances or the player still needs to spend movement.
function animateRoll(pr) {
  isRollAnimating = true;
  const rollBtn = el('rollBtn');
  rollBtn.disabled = true;
  rollBtn.classList.add('hidden');
  el('rollInfo').textContent = 'מטילים את הקוביות...';

  const diceRow = el('diceRow');

  // Which dice actually got a FRESH value this attempt (and so need to be
  // animated) has to be judged against how things looked BEFORE this roll -
  // not against pr's own `locked` flags. The server auto-locks any die that
  // matches the goal as soon as it rolls that way (see gameEngine.js), so on
  // a roll that succeeds, pr's dice all come back already marked `locked`
  // even though some of them (maybe all three) only just landed on their
  // final value this very attempt. Reading the previously-rendered DOM
  // (still showing last attempt's state) is what tells us which dice are
  // actually new this time.
  // A brand-new goal declaration always starts with 3 fresh, fully unlocked
  // dice (attempt 1) - ignore whatever the DOM still shows from the end of
  // a previous roll/turn in that case, so nothing is mistaken for "already
  // locked" leftovers.
  const wasLockedBefore = pr.attempt <= 1
    ? [false, false, false]
    : Array.from(diceRow.children).map(el => el.classList.contains('locked'));

  diceRow.innerHTML = pr.dice.map((d, i) =>
    `<div class="die ${d.locked ? 'locked' : 'rolling'}" data-idx="${i}">${diceFaceHTML(d.locked ? d.value : randomDieValue())}</div>`
  ).join('');

  const unlockedIdx = pr.dice.map((d, i) => i).filter(i => !wasLockedBefore[i]);
  let stillRolling = unlockedIdx.length;

  function finishAll() {
    isRollAnimating = false;
    renderDiceFacesStatic(pr, true); // faces are already final; just add the settle bounce
    updateRollInfo(pr);
    if (!pr.resolved) return; // another attempt is still available - nothing to reveal yet

    // The dice are showing their true final result now - only from this
    // point on is it safe to reveal whatever the roll actually caused
    // (the fox advancing, new cards drawn, a win/loss). Revealing earlier
    // (e.g. the instant the server's state arrived) is what let the fox
    // jump or cards appear before the player even saw the dice settle.
    const reveal = () => {
      render(latestState); // lastAttemptShown already caught up, so this shows everything live
      setTimeout(() => socket.emit('acknowledgeRoll'), ROLL_HOLD_MS);
    };

    if (pr.success === false) {
      // Failure: let the fox actually run its steps along the track, with
      // its getaway sound, before revealing the rest and acknowledging.
      animateFoxEscape(displayedFoxStep, latestState.foxStep, latestState.foxPath, latestState.foxTrackLength, reveal);
    } else {
      reveal();
    }
  }

  if (stillRolling === 0) {
    // Every die was already locked - nothing to animate, show the result at once.
    finishAll();
    return;
  }

  unlockedIdx.forEach(i => {
    const dieEl = diceRow.children[i];
    const tickMs = 70 + Math.random() * 60;
    const stopAfterMs = 1000 + Math.random() * 1400;

    const tickTimer = setInterval(() => {
      if (dieEl) dieEl.innerHTML = diceFaceHTML(randomDieValue());
    }, tickMs);

    setTimeout(() => {
      clearInterval(tickTimer);
      if (dieEl) {
        dieEl.classList.remove('rolling');
        dieEl.classList.add('settle');
        dieEl.innerHTML = diceFaceHTML(pr.dice[i].value);
      }
      stillRolling--;
      if (stillRolling === 0) finishAll();
    }, stopAfterMs);
  });
}

function renderDiceArea(pr) {
  const isNewRoll = pr.attempt > lastAttemptShown;
  if (isNewRoll) {
    lastAttemptShown = pr.attempt;
    animateRoll(pr);
  } else if (!isRollAnimating) {
    renderDiceFacesStatic(pr, false);
    updateRollInfo(pr);
  }
}

function setGoalToggle(goal) {
  lastGoalChoice = goal;
  el('goalKnob').classList.toggle('pos-right', goal === 'footprints');
}

document.querySelectorAll('.goal-toggle-label').forEach(btn => {
  btn.onclick = () => {
    setGoalToggle(btn.dataset.goal);
    socket.emit('declareGoal', { goal: btn.dataset.goal });
  };
});

el('rollBtn').onclick = () => { playDiceRollSound(); socket.emit('rollDice'); };

// Movement is done by clicking a highlighted destination cell on the board
// (see the click-to-move overlay drawn in renderBoard) instead of arrows.
function handleCellClick(x, y) {
  socket.emit('moveTo', { x, y });
}

// `handOverride`, when given, shows an earlier {hand, deckCount} instead of
// the live one - held back the same way as status/foxStep (see render()).
function renderHand(state, handOverride) {
  const hand = handOverride ? handOverride.hand : state.hand;
  const deckCount = handOverride ? handOverride.deckCount : state.deckCount;
  el('deckCount').textContent = deckCount;
  // The page is RTL, and #handList is a plain (non-reversed) flex row, so
  // the FIRST array item lands on the right. Sorting still-possible
  // suspects first (stable sort keeps their relative order) puts everyone
  // who could still be the fox on the right, with eliminated suspects
  // trailing off to the left.
  const sorted = hand.slice().sort((a, b) => (a.burned === b.burned ? 0 : a.burned ? 1 : -1));
  el('handList').innerHTML = sorted.map(s => {
    const color = stringToColor(s.id, SUSPECT_COLORS);
    const birdSvg = `<svg width="34" height="34" viewBox="0 0 24 24" style="color:${color}">
      <use href="#birdIcon"/>
    </svg>`;
    const itemIcons = s.items.map(id =>
      `<svg viewBox="0 0 16 16"><use href="#item-${id}"/></svg>`
    ).join('');
    return `<div class="suspect-card ${s.burned ? 'burned' : ''}">
      ${birdSvg}
      <div class="suspect-name">${escapeHtml(s.name)}</div>
      <div class="suspect-items">${itemIcons}</div>
    </div>`;
  }).join('') || '<p style="color:#889">אין חשודים ביד עדיין</p>';
}

