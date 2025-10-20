// ===== Elements =====
const intro = document.querySelector('.intro');
const header = document.getElementById('header');
const mapSection = document.getElementById('mapSection');
const mapSticky  = document.getElementById('mapSticky');

const boxes = [
  document.getElementById('box1'),
  document.getElementById('box2'),
  document.getElementById('box3'),
  document.getElementById('box4'),
  document.getElementById('box5'),
].filter(Boolean);

const overlayImg = document.getElementById('overlay'); // optional legacy
const footer  = document.getElementById('footer');

const svg1 = document.getElementById('svg1');
const svg2 = document.getElementById('svg2');
const svg3 = document.getElementById('svg3');

// ===== Intro fade on scroll =====
(function animateIntro(){
  const y = window.scrollY || window.pageYOffset;
  const h = intro.offsetHeight || 1;
  const p = Math.min(y / (h / 10.5), 1);
  header.style.opacity = String(1 - p);
  header.style.filter  = `blur(${(p * 2).toFixed(2)}px)`;
  requestAnimationFrame(animateIntro);
})();

// ===== Helpers =====
const clamp = (v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const lerp  = (a,b,t)=>a+(b-a)*t;
const easeInOutCubic = x => x<.5 ? 4*x*x*x : 1-Math.pow(-2*x+2,3)/2;
const smoothstep = (e0,e1,x)=>{ const t=clamp((x-e0)/(e1-e0),0,1); return t*t*(3-2*t); };
const eps = 0.01;

// ===== Scroll-driven timeline with easing =====
let tTarget = 0; // 0..1 from scroll progress
let tRender = 0; // eased value
let jumpedToFooterOnce = false;

// 8 steps (index): 0 box1, 1 svg1, 2 box2, 3 svg2, 4 box3, 5 svg3, 6 box4, 7 box5
const STEPS = [
  { kind:'text',    boxIdx:0, zoomA:100, zoomB:112 },
  { kind:'overlay', id:'svg1', zoomA:112, zoomB:112, cx:69, cy:42  },
  { kind:'text',    boxIdx:1, zoomA:112, zoomB:112 },
  { kind:'overlay', id:'svg2', zoomA:112, zoomB:142, cx:30, cy:30 },
  { kind:'text',    boxIdx:2, zoomA:142, zoomB:152 },
  { kind:'overlay', id:'svg3', zoomA:152, zoomB:160 },
  { kind:'text',    boxIdx:3, zoomA:160, zoomB:170 },
  { kind:'text',    boxIdx:4, zoomA:170, zoomB:180 },
];

const STEP_COUNT = STEPS.length;
const STEP_LEN   = 1 / STEP_COUNT;

// Overlay timing within overlay steps (for the fade-in part)
const HOLD_IN  = 0.30;
const HOLD_OUT = 0.70;
const FADE_LEN = 0.12;

// Text boxes map to specific step indices
const TEXT_STEP_INDEX = [0,2,4,6,7];

// ===== Progress from scroll =====
function sectionProgress(){
  const rect = mapSection.getBoundingClientRect();
  const view = window.innerHeight || document.documentElement.clientHeight;
  const total = rect.height - view;
  const scrolled = clamp(-rect.top, 0, Math.max(total,1));
  return clamp(scrolled / Math.max(total,1), 0, 1);
}

// Utility: overlay alpha that spans multiple steps (with soft edges at boundaries)
function overlayAlphaForRange(t, startStep, endStep, fade = FADE_LEN) {
  const s0 = startStep * STEP_LEN;
  const s1 = (endStep + 1) * STEP_LEN; // inclusive
  const fadePx = fade * STEP_LEN;

  const aIn  = smoothstep(s0, s0 + fadePx, t);
  const aOut = 1 - smoothstep(s1 - fadePx, s1, t);
  const inside = t >= s0 && t <= s1 ? 1 : 0;

  return inside * Math.min(aIn, aOut);
}

// ===== Apply visuals from tRender =====
function apply(t){
  // Which step + local progress
  const idx = clamp(Math.floor(t / STEP_LEN), 0, STEP_COUNT - 1);
  const stepStart = idx * STEP_LEN;
  const local = clamp((t - stepStart) / STEP_LEN, 0, 1);
  const step = STEPS[idx];

  // ---- Zoom (pause during overlay steps, continuous during text steps)
  const { zoomA, zoomB } = step;
  const zoomMid = lerp(zoomA, zoomB, 0.5);
  let z;
  if (step.kind === 'overlay') {
    if (local < HOLD_IN) {
      z = lerp(zoomA, zoomMid, easeInOutCubic(local / HOLD_IN));
    } else if (local <= HOLD_OUT) {
      z = zoomMid;
    } else {
      z = lerp(zoomMid, zoomB, easeInOutCubic((local - HOLD_OUT) / (1 - HOLD_OUT)));
    }
  } else {
    z = lerp(zoomA, zoomB, easeInOutCubic(local));
  }
  mapSticky.style.backgroundSize     = z + '%';
  mapSticky.style.backgroundPosition = 'center center';

  // ---- Overlay visibility windows
  const a1 = svg1 ? overlayAlphaForRange(t, 1, 2) : 0;
  const a2 = svg2 ? overlayAlphaForRange(t, 3, 4) : 0;
  const a3 = svg3 ? overlayAlphaForRange(t, 5, 7, 0.12) : 0;

  if (svg1) {
    svg1.style.opacity = a1.toFixed(3);
    if (a1 > 0.001) {
      const cfg = STEPS[1];
      svg1.style.left = cfg.cx + '%';
      svg1.style.top  = cfg.cy + '%';
    }
  }
  if (svg2) {
    svg2.style.opacity = a2.toFixed(3);
    if (a2 > 0.001) {
      const cfg = STEPS[3];
      svg2.style.left = cfg.cx + '%';
      svg2.style.top  = cfg.cy + '%';
    }
  }
  if (svg3) {
    svg3.style.opacity = a3.toFixed(3);
  }

  // ---- Text boxes
  boxes.forEach((box, i) => {
    const stepIndexForBox = TEXT_STEP_INDEX[i];
    const s = stepIndexForBox * STEP_LEN;
    const l = (t - s) / STEP_LEN;

    // More overlap: fade in earlier, fade out later
    const visIn  = smoothstep(-0.20,  0.20, l);
    const visOut = 1 - smoothstep(0.70, 1.20, l);
    const vis = visIn * visOut;

    const slideX = clamp(l, 0, 1);
    const eased  = easeInOutCubic(slideX);
    const y = 100 - eased * 120; // same distance, slower since scroll is longer

    box.style.opacity   = vis.toFixed(3);
    box.style.transform = `translate3d(-50%, ${y}vh, 0)`;
  });

  // Optional legacy overlay
  if (overlayImg) {
    overlayImg.style.opacity = t > 0.9 ? ((t - 0.9) / 0.1) : 0;
  }
}

// ===== RAF easing loop =====
(function tick(){
  tRender += (tTarget - tRender) * 0.18;
  if (Math.abs(tTarget - tRender) < 0.001) tRender = tTarget;
  apply(tRender);
  requestAnimationFrame(tick);
})();

// ===== Scroll drives timeline; footer jump =====
function onScroll(){
  const p = sectionProgress();
  tTarget = p;

  if (!jumpedToFooterOnce && p >= 1 - eps) {
    jumpedToFooterOnce = true;
    setTimeout(()=> footer.scrollIntoView({ behavior:'smooth', block:'start' }), 80);
  }
  if (p < 1 - eps) jumpedToFooterOnce = false;
}
window.addEventListener('scroll', onScroll, { passive:true });

// Init
(function init(){
  tTarget = sectionProgress();
  tRender = tTarget;
  apply(tRender);
})();
