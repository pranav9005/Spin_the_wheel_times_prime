/* ==========================================================
   TIMES PRIME — GFF STALL ACTIVATION
   Flow: WELCOME -> SPIN -> WIN -> DETAILS -> DONE
   Vanilla HTML / CSS / JS. No frameworks.
   ========================================================== */

/* ==========================================================
   1. LOGO CONFIGURATION  <-- EDIT FILENAMES HERE ONLY
   Relative path (no leading slash) so it works from any folder.
   If a file is missing, that logo falls back to clean text.
   ========================================================== */

const LOGO_BASE = "2x/";

const LOGOS = {
    "TIMES PRIME": "Times Prime@2x.png",
    "AEONIC":      "Aeonic@2x.png",
    "DINE":        "dinewithTP@2x.png"
};

// The lead brand shown on the welcome screen and in every corner
const LEAD_BRAND = "TIMES PRIME";

/* ==========================================================
   2. PRIZE CONFIGURATION
   ========================================================== */

const DEMO_MODE = true;          // false = one spin per mobile number
const SPIN_DURATION = 5000;      // ms
const MIN_ROTATIONS = 4;
const MAX_ROTATIONS = 6;
const REVEAL_DELAY = 500;        // ms after the wheel stops

const prizes = [
    { name: "TIMES PRIME", weight: 40 },
    { name: "AEONIC",      weight: 25 },
    { name: "DINE",        weight: 35 }
];

const prizeDetails = {
    "TIMES PRIME": { award: "MEMBERSHIP", accent: "#D936C8" },
    "AEONIC":      { award: "MEMBERSHIP", accent: "#B7D92D" },
    "DINE":        { award: "MEMBERSHIP", accent: "#315BFF" }
};

// Wheel face, clockwise from the pointer at 12 o'clock
const WHEEL_SEGMENTS = [
    "TIMES PRIME",
    "AEONIC",
    "DINE",
    "TIMES PRIME",
    "DINE",
    "AEONIC",
    "TIMES PRIME",
    "DINE"
];

const STORAGE_KEY = "gff_participants";

/* ==========================================================
   RUNTIME STATE
   ========================================================== */

const state = {
    current: "welcome",
    rotation: 0,
    spinning: false,
    hasSpun: false,
    participant: { name: "", mobile: "", email: "", consent: false },
    prize: null
};

const el = {};
const logoMeta = {};   // { name: { ok, src, aspect } }
let audioCtx = null;

/* ==========================================================
   INITIALIZE
   ========================================================== */

function initialize() {
    cacheElements();
    buildParticles();
    bindEvents();
    sizeBurstCanvas();
    showState("welcome");

    // Logos load asynchronously; the wheel and brandmarks render as soon as we
    // know each file's real aspect ratio, so nothing is ever stretched.
    preloadLogos(function () {
        applyBrandLogos();
        buildWheel();
    });
}

function cacheElements() {
    const ids = [
        "stage", "particles",
        "screen-welcome", "screen-spin", "screen-win", "screen-details", "screen-done",
        "btn-start", "btn-spin", "btn-claim", "btn-details-next", "btn-next",
        "btn-blocked-next", "btn-retry",
        "input-name", "input-mobile", "input-email", "input-consent",
        "error-name", "error-mobile", "error-email",
        "details-form-wrap", "blocked-panel",
        "segments", "labels", "wheel-rotor",
        "prize-card", "prize-logo-slot", "prize-award",
        "dimmer", "burst", "fallback"
    ];
    ids.forEach(function (id) { el[id] = document.getElementById(id); });

    el.screens = {
        welcome: el["screen-welcome"],
        spin: el["screen-spin"],
        win: el["screen-win"],
        details: el["screen-details"],
        done: el["screen-done"]
    };
}

function bindEvents() {
    el["btn-start"].addEventListener("click", function () {
        unlockAudio();
        showState("spin");
    });

    el["btn-spin"].addEventListener("click", spinWheel);

    el["btn-claim"].addEventListener("click", function () {
        el.dimmer.classList.remove("is-on");
        clearBurst();
        showState("details");
        setTimeout(function () { el["input-name"].focus(); }, 380);
    });

    el["btn-details-next"].addEventListener("click", handleDetailsSubmit);
    el["btn-next"].addEventListener("click", resetExperience);
    el["btn-blocked-next"].addEventListener("click", resetExperience);
    el["btn-retry"].addEventListener("click", function () {
        el.fallback.hidden = true;
        resetExperience();
    });

    el["input-mobile"].addEventListener("input", function () {
        this.value = this.value.replace(/\D/g, "").slice(0, 10);
        clearError("mobile");
    });
    el["input-name"].addEventListener("input", function () { clearError("name"); });
    el["input-email"].addEventListener("input", function () { clearError("email"); });

    window.addEventListener("resize", sizeBurstCanvas);
    window.addEventListener("orientationchange", sizeBurstCanvas);

    document.addEventListener("gesturestart", function (e) { e.preventDefault(); });
    document.addEventListener("touchmove", function (e) {
        if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
}

/* ==========================================================
   LOGO LOADING
   ========================================================== */

function preloadLogos(done) {
    const names = Object.keys(LOGOS);
    let pending = names.length;

    if (pending === 0) { done(); return; }

    names.forEach(function (name) {
        const src = LOGO_BASE + LOGOS[name];
        const img = new Image();

        img.onload = function () {
            logoMeta[name] = {
                ok: true,
                src: src,
                aspect: (img.naturalWidth || 1) / (img.naturalHeight || 1)
            };
            if (--pending === 0) done();
        };

        img.onerror = function () {
            logoMeta[name] = { ok: false, src: src, aspect: 3.2 };
            if (--pending === 0) done();
        };

        img.src = src;
    });
}

// Fills every [data-brand-logo] slot with the lead brand logo
function applyBrandLogos() {
    const slots = document.querySelectorAll("[data-brand-logo]");
    slots.forEach(function (slot) {
        slot.innerHTML = "";
        slot.appendChild(makeLogoNode(LEAD_BRAND));
    });
}

// Returns an <img> if the file loaded, otherwise a clean text placeholder
function makeLogoNode(name) {
    const meta = logoMeta[name];
    if (meta && meta.ok) {
        const img = document.createElement("img");
        img.src = meta.src;
        img.alt = name;
        return img;
    }
    const span = document.createElement("span");
    span.className = "logo-text";
    span.textContent = name;
    return span;
}

/* ==========================================================
   STATE MACHINE
   ========================================================== */

function showState(next) {
    Object.keys(el.screens).forEach(function (key) {
        const node = el.screens[key];
        if (key === next) {
            node.classList.add("is-mounted");
            node.setAttribute("aria-hidden", "false");
            void node.offsetWidth;
            node.classList.add("is-active");
        } else {
            node.classList.remove("is-active");
            node.setAttribute("aria-hidden", "true");
            setTimeout(function () {
                if (!node.classList.contains("is-active")) node.classList.remove("is-mounted");
            }, 360);
        }
    });

    if (next === "welcome") {
        el.screens.welcome.classList.remove("screen-welcome-intro");
        void el.screens.welcome.offsetWidth;
        el.screens.welcome.classList.add("screen-welcome-intro");
    }

    state.current = next;
}

/* ==========================================================
   FORM
   ========================================================== */

function handleDetailsSubmit() {
    if (!validateForm()) return;

    state.participant = {
        name: el["input-name"].value.trim(),
        mobile: el["input-mobile"].value.trim(),
        email: el["input-email"].value.trim(),
        consent: el["input-consent"].checked
    };

    if (!DEMO_MODE && hasAlreadyParticipated(state.participant.mobile)) {
        showBlockedPanel();
        return;
    }

    if (!DEMO_MODE) recordParticipant(state.participant.mobile);

    // Hook point: send { participant, prize } to your backend here.
    showState("done");
}

function validateForm() {
    let valid = true;

    const name = el["input-name"].value.trim();
    const mobile = el["input-mobile"].value.trim();
    const email = el["input-email"].value.trim();

    clearError("name");
    clearError("mobile");
    clearError("email");

    if (name.length < 2) {
        setError("name", "PLEASE ENTER YOUR NAME");
        valid = false;
    }

    if (!/^\d{10}$/.test(mobile)) {
        setError("mobile", "PLEASE ENTER A VALID MOBILE NUMBER");
        valid = false;
    }

    if (email.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        setError("email", "PLEASE ENTER A VALID EMAIL ADDRESS");
        valid = false;
    }

    return valid;
}

function setError(field, message) {
    el["error-" + field].textContent = message;
    el["error-" + field].classList.add("is-visible");
    el["input-" + field].classList.add("has-error");
}

function clearError(field) {
    el["error-" + field].classList.remove("is-visible");
    el["error-" + field].textContent = "";
    el["input-" + field].classList.remove("has-error");
}

function readParticipants() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) { return []; }
}

function hasAlreadyParticipated(mobile) {
    return readParticipants().indexOf(mobile) !== -1;
}

function recordParticipant(mobile) {
    try {
        const list = readParticipants();
        list.push(mobile);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (e) { /* storage unavailable — prototype only */ }
}

function showBlockedPanel() {
    el["details-form-wrap"].hidden = true;
    el["blocked-panel"].hidden = false;
    el["btn-details-next"].hidden = true;
    el["btn-blocked-next"].hidden = false;
}

/* ==========================================================
   WHEEL CONSTRUCTION
   ========================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";
const XLINK_NS = "http://www.w3.org/1999/xlink";
const CX = 200, CY = 200, R_OUTER = 182, R_INNER = 62;
const SEG_COUNT = WHEEL_SEGMENTS.length;
const SEG_ANGLE = 360 / SEG_COUNT;

// Logo box on the wheel face — tuned so no wordmark touches the hub or the rim
const LOGO_RADIUS = 126;   // distance from centre to the logo's midpoint
const LOGO_MAX_W = 104;    // viewBox units
const LOGO_MAX_H = 26;

const segmentStyles = {
    "TIMES PRIME": { fillA: "#131840", fillB: "#0A0D2E", accent: "#D936C8" },
    "AEONIC":      { fillA: "#0F1638", fillB: "#080B28", accent: "#B7D92D" },
    "DINE":        { fillA: "#101642", fillB: "#0A0D30", accent: "#315BFF" }
};

function polar(angleFromTop, radius) {
    const rad = (angleFromTop - 90) * Math.PI / 180;
    return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function buildWheel() {
    const segGroup = el["segments"];
    const labelGroup = el["labels"];
    segGroup.innerHTML = "";
    labelGroup.innerHTML = "";

    for (let i = 0; i < SEG_COUNT; i++) {
        const name = WHEEL_SEGMENTS[i];
        const style = segmentStyles[name];
        const start = i * SEG_ANGLE;
        const end = start + SEG_ANGLE;
        const center = start + SEG_ANGLE / 2;

        // Wedge
        const p1 = polar(start, R_OUTER);
        const p2 = polar(end, R_OUTER);
        const p3 = polar(end, R_INNER);
        const p4 = polar(start, R_INNER);

        const gradId = "segGrad" + i;
        const grad = document.createElementNS(SVG_NS, "linearGradient");
        grad.setAttribute("id", gradId);
        grad.setAttribute("gradientUnits", "userSpaceOnUse");
        grad.setAttribute("x1", p1.x); grad.setAttribute("y1", p1.y);
        grad.setAttribute("x2", CX);   grad.setAttribute("y2", CY);
        grad.innerHTML =
            '<stop offset="0%" stop-color="' + style.fillA + '"/>' +
            '<stop offset="100%" stop-color="' + style.fillB + '"/>';
        segGroup.appendChild(grad);

        const path = document.createElementNS(SVG_NS, "path");
        path.setAttribute("d",
            "M " + p1.x + " " + p1.y +
            " A " + R_OUTER + " " + R_OUTER + " 0 0 1 " + p2.x + " " + p2.y +
            " L " + p3.x + " " + p3.y +
            " A " + R_INNER + " " + R_INNER + " 0 0 0 " + p4.x + " " + p4.y + " Z");
        path.setAttribute("fill", "url(#" + gradId + ")");
        path.setAttribute("stroke", "rgba(83,108,255,0.32)");
        path.setAttribute("stroke-width", "1");
        segGroup.appendChild(path);

        // Thin illuminated accent arc just outside the hub — colour-codes the brand
        const accentR = R_INNER + 6;
        const a1 = polar(start + 5, accentR);
        const a2 = polar(end - 5, accentR);
        const accent = document.createElementNS(SVG_NS, "path");
        accent.setAttribute("d",
            "M " + a1.x + " " + a1.y +
            " A " + accentR + " " + accentR + " 0 0 1 " + a2.x + " " + a2.y);
        accent.setAttribute("fill", "none");
        accent.setAttribute("stroke", style.accent);
        accent.setAttribute("stroke-width", "3");
        accent.setAttribute("stroke-linecap", "round");
        accent.setAttribute("opacity", "0.85");
        segGroup.appendChild(accent);

        labelGroup.appendChild(buildSegmentMark(name, center));
    }
}

// Brand logo (or text fallback) laid radially along the segment spoke.
// Left-half segments are rotated the other way so nothing reads upside down.
function buildSegmentMark(name, center) {
    const meta = logoMeta[name];
    const rotation = center < 180 ? center - 90 : center + 90;
    const anchorX = center < 180 ? CX + LOGO_RADIUS : CX - LOGO_RADIUS;

    if (meta && meta.ok) {
        // Fit the real aspect ratio inside the box — never stretch a logo
        let h = LOGO_MAX_H;
        let w = h * meta.aspect;
        if (w > LOGO_MAX_W) { w = LOGO_MAX_W; h = w / meta.aspect; }

        const image = document.createElementNS(SVG_NS, "image");
        image.setAttribute("x", anchorX - w / 2);
        image.setAttribute("y", CY - h / 2);
        image.setAttribute("width", w);
        image.setAttribute("height", h);
        image.setAttribute("preserveAspectRatio", "xMidYMid meet");
        image.setAttribute("href", meta.src);
        image.setAttributeNS(XLINK_NS, "xlink:href", meta.src);
        image.setAttribute("transform", "rotate(" + rotation + " " + CX + " " + CY + ")");
        return image;
    }

    const text = document.createElementNS(SVG_NS, "text");
    text.setAttribute("class", "seg-label");
    text.setAttribute("x", anchorX);
    text.setAttribute("y", CY + 5);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("transform", "rotate(" + rotation + " " + CX + " " + CY + ")");
    text.textContent = name;
    return text;
}

/* ==========================================================
   PRIZE ENGINE — prize chosen first, rotation calculated to match
   ========================================================== */

function selectPrize() {
    const total = prizes.reduce(function (sum, p) { return sum + p.weight; }, 0);
    let roll = Math.random() * total;

    for (let i = 0; i < prizes.length; i++) {
        roll -= prizes[i].weight;
        if (roll <= 0) return prizes[i].name;
    }
    return prizes[prizes.length - 1].name;
}

function calculateRotation(prizeName) {
    const candidates = [];
    for (let i = 0; i < SEG_COUNT; i++) {
        if (WHEEL_SEGMENTS[i] === prizeName) candidates.push(i);
    }
    const index = candidates[Math.floor(Math.random() * candidates.length)];

    const segCenter = index * SEG_ANGLE + SEG_ANGLE / 2;
    const jitter = (Math.random() * 2 - 1) * (SEG_ANGLE / 2 - 8);

    const targetMod = (360 - ((segCenter + jitter) % 360) + 360) % 360;
    const currentMod = ((state.rotation % 360) + 360) % 360;

    let delta = targetMod - currentMod;
    if (delta < 0) delta += 360;

    const spins = MIN_ROTATIONS + Math.floor(Math.random() * (MAX_ROTATIONS - MIN_ROTATIONS + 1));
    return state.rotation + spins * 360 + delta;
}

/* ==========================================================
   SPIN ANIMATION — slow start, accelerate, hold, decelerate, crawl
   ========================================================== */

const VELOCITY = [
    { t: 0.00, v: 0.05 },
    { t: 0.06, v: 0.15 },
    { t: 0.24, v: 1.00 },
    { t: 0.56, v: 1.00 },
    { t: 0.90, v: 0.10 },
    { t: 1.00, v: 0.00 }
];

function velocityAt(t) {
    for (let i = 0; i < VELOCITY.length - 1; i++) {
        const a = VELOCITY[i], b = VELOCITY[i + 1];
        if (t >= a.t && t <= b.t) {
            const local = (t - a.t) / (b.t - a.t);
            const smooth = local * local * (3 - 2 * local);
            return a.v + (b.v - a.v) * smooth;
        }
    }
    return 0;
}

// Pre-integrate the velocity curve into a normalised easing table
const EASE_TABLE = (function () {
    const steps = 600;
    const table = new Float64Array(steps + 1);
    let acc = 0;
    for (let i = 1; i <= steps; i++) {
        const t0 = (i - 1) / steps, t1 = i / steps;
        acc += (velocityAt(t0) + velocityAt(t1)) / 2 * (1 / steps);
        table[i] = acc;
    }
    for (let i = 0; i <= steps; i++) table[i] /= acc;
    return table;
})();

function easeSpin(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const steps = EASE_TABLE.length - 1;
    const pos = t * steps;
    const i = Math.floor(pos);
    const frac = pos - i;
    return EASE_TABLE[i] + (EASE_TABLE[Math.min(i + 1, steps)] - EASE_TABLE[i]) * frac;
}

function spinWheel() {
    if (state.spinning || state.hasSpun) return;   // no double-tap, no second spin
    state.spinning = true;
    state.hasSpun = true;
    el["btn-spin"].disabled = true;

    unlockAudio();

    state.prize = selectPrize();
    const target = calculateRotation(state.prize);

    const from = state.rotation;
    const distance = target - from;
    const start = performance.now();
    let lastTickBucket = Math.floor(from / SEG_ANGLE);

    function frame(now) {
        const t = Math.min((now - start) / SPIN_DURATION, 1);
        const angle = from + distance * easeSpin(t);

        el["wheel-rotor"].style.transform = `rotate(${angle}deg)`;

        const bucket = Math.floor(angle / SEG_ANGLE);
        if (bucket !== lastTickBucket) {
            lastTickBucket = bucket;
            playTick(1 - t);
        }

        if (t < 1) {
            requestAnimationFrame(frame);
        } else {
            state.rotation = target;
            state.spinning = false;
            playConfirm();
            setTimeout(showWinner, REVEAL_DELAY);
        }
    }

    requestAnimationFrame(frame);
}

/* ==========================================================
   WIN REVEAL
   ========================================================== */

function showWinner() {
    const prize = state.prize;
    const detail = prizeDetails[prize] || { award: "REWARD", accent: "#315BFF" };

    el["prize-logo-slot"].innerHTML = "";
    el["prize-logo-slot"].appendChild(makeLogoNode(prize));
    el["prize-award"].textContent = detail.award;

    el["prize-card"].style.setProperty("--accent", detail.accent);
    el["prize-card"].classList.remove("is-revealed");

    el.dimmer.classList.add("is-on");
    showState("win");

    setTimeout(function () {
        void el["prize-card"].offsetWidth;
        el["prize-card"].classList.add("is-revealed");
        setTimeout(function () { releaseBurst(detail.accent); }, 380);
    }, 260);
}

/* ==========================================================
   RESET — nothing from the previous participant may survive
   ========================================================== */

function resetExperience() {
    el["input-name"].value = "";
    el["input-mobile"].value = "";
    el["input-email"].value = "";
    el["input-consent"].checked = false;
    clearError("name");
    clearError("mobile");
    clearError("email");
    state.participant = { name: "", mobile: "", email: "", consent: false };

    state.prize = null;
    state.hasSpun = false;
    state.spinning = false;
    state.rotation = 0;
    el["wheel-rotor"].style.transform = "rotate(0deg)";
    el["btn-spin"].disabled = false;

    el["prize-card"].classList.remove("is-revealed");
    el["prize-logo-slot"].innerHTML = "";
    el["prize-award"].textContent = "";
    el.dimmer.classList.remove("is-on");
    clearBurst();

    el["details-form-wrap"].hidden = false;
    el["blocked-panel"].hidden = true;
    el["btn-details-next"].hidden = false;
    el["btn-blocked-next"].hidden = true;

    showState("welcome");
}

/* ==========================================================
   AMBIENCE
   ========================================================== */

function buildParticles() {
    const count = 12;
    let html = "";
    for (let i = 0; i < count; i++) {
        const left = Math.random() * 100;
        const top = 30 + Math.random() * 65;
        const delay = Math.random() * 12;
        const duration = 12 + Math.random() * 8;
        const size = 2 + Math.random() * 2;
        html += '<span class="particle" style="left:' + left.toFixed(2) + '%;top:' + top.toFixed(2) +
                '%;width:' + size.toFixed(1) + 'px;height:' + size.toFixed(1) +
                'px;animation-duration:' + duration.toFixed(1) + 's;animation-delay:-' + delay.toFixed(1) + 's;"></span>';
    }
    el.particles.innerHTML = html;
}

/* ==========================================================
   WIN BURST — white, electric blue, prize accent
   ========================================================== */

let burstParticles = [];
let burstRaf = null;

function sizeBurstCanvas() {
    const c = el.burst;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = window.innerWidth * dpr;
    c.height = window.innerHeight * dpr;
    c.getContext("2d").setTransform(dpr, 0, 0, dpr, 0, 0);
}

function releaseBurst(accent) {
    const ctx = el.burst.getContext("2d");
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight * 0.5;
    const colours = ["#FFFFFF", "#315BFF", accent];

    burstParticles = [];
    for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3.4 + Math.random() * 6.2;
        burstParticles.push({
            x: originX,
            y: originY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.2,
            r: 1.4 + Math.random() * 2.2,
            life: 1,
            decay: 0.012 + Math.random() * 0.012,
            colour: colours[i % colours.length]
        });
    }

    cancelAnimationFrame(burstRaf);

    function step() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        let alive = false;

        burstParticles.forEach(function (p) {
            if (p.life <= 0) return;
            alive = true;
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.045;
            p.vx *= 0.992;
            p.life -= p.decay;

            ctx.globalAlpha = Math.max(p.life, 0);
            ctx.fillStyle = p.colour;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.globalAlpha = 1;
        if (alive) burstRaf = requestAnimationFrame(step);
    }

    burstRaf = requestAnimationFrame(step);
}

function clearBurst() {
    cancelAnimationFrame(burstRaf);
    burstParticles = [];
    el.burst.getContext("2d").clearRect(0, 0, window.innerWidth, window.innerHeight);
}

/* ==========================================================
   SOUND — premium interface ticks. Silent if audio is blocked.
   ========================================================== */

function unlockAudio() {
    try {
        if (!audioCtx) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            audioCtx = new Ctx();
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
    } catch (e) { audioCtx = null; }
}

function playTick(intensity) {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        filter.type = "bandpass";
        filter.frequency.value = 2100;
        filter.Q.value = 6;

        osc.type = "square";
        osc.frequency.value = 1500 + intensity * 500;

        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.05 + intensity * 0.05, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

        osc.connect(filter).connect(gain).connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.06);
    } catch (e) { /* no audio, no problem */ }
}

function playConfirm() {
    if (!audioCtx) return;
    try {
        const now = audioCtx.currentTime;
        [660, 990].forEach(function (freq, i) {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            const at = now + i * 0.13;
            gain.gain.setValueAtTime(0.0001, at);
            gain.gain.exponentialRampToValueAtTime(0.10, at + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start(at);
            osc.stop(at + 0.6);
        });
    } catch (e) { /* no audio, no problem */ }
}

/* ==========================================================
   FAILSAFE
   ========================================================== */

function showFallback() { el.fallback.hidden = false; }

window.addEventListener("error", function (e) {
    if (e instanceof ErrorEvent && e.message) showFallback();
});
window.addEventListener("unhandledrejection", showFallback);

document.addEventListener("DOMContentLoaded", function () {
    try {
        initialize();
    } catch (e) {
        showFallback();
    }
});