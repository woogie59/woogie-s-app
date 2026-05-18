import React from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// SIDE BODY VIEW — Professional Anatomical SVG
// ViewBox "0 0 200 430" · Person facing RIGHT (anterior = right, posterior = left)
// Each muscle is a distinct <path> with smooth Bezier curves, clickable in admin.
// ═══════════════════════════════════════════════════════════════════════════════

const SIDE_REGIONS = [
  // ── Upper body ──────────────────────────────────────────────────────────────
  {
    id: 'side_delts',
    slugs: ['deltoids'],
    label: '측면 삼각근',
    // Dominant rounded shoulder cap — the signature muscle of the lateral view
    path: 'M 94,64 C 112,56 136,64 144,84 C 150,102 144,124 130,130 C 116,134 100,126 94,110 C 88,94 88,78 94,64 Z',
  },
  {
    id: 'rear_delts',
    slugs: ['deltoids'],
    label: '후면 삼각근',
    // Posterior deltoid — teardrop posterior to lateral deltoid
    path: 'M 74,70 C 86,62 104,68 110,84 C 114,98 110,116 102,122 C 90,128 76,120 70,104 C 64,88 66,76 74,70 Z',
  },
  {
    id: 'triceps',
    slugs: ['triceps'],
    label: '삼두근',
    // Long posterior head of triceps running down the back of the upper arm
    path: 'M 110,108 C 120,106 130,116 132,138 C 134,158 132,178 128,192 C 124,202 118,208 114,204 C 110,198 108,182 108,162 C 108,140 108,120 110,108 Z',
  },
  {
    id: 'brachialis',
    slugs: ['biceps'],
    label: '상완근',
    // Brachialis — lateral arm muscle visible between biceps/triceps from side
    path: 'M 136,132 C 146,132 152,146 150,166 C 148,182 142,196 134,196 C 126,194 122,182 122,164 C 122,146 128,130 136,132 Z',
  },
  // ── Torso ───────────────────────────────────────────────────────────────────
  {
    id: 'serratus',
    slugs: ['obliques'],
    label: '전거근',
    // Serratus anterior — finger-like projections under armpit on lateral ribcage
    path: 'M 116,114 C 130,118 138,134 136,150 C 134,158 130,163 128,167 C 132,171 134,178 130,184 C 128,189 124,193 122,196 C 126,202 128,208 126,214 C 122,222 114,226 108,220 C 104,214 104,200 104,184 C 104,162 108,138 116,114 Z',
  },
  {
    id: 'lats',
    slugs: ['upper-back'],
    label: '광배근',
    // Latissimus dorsi — wide fan muscle from armpit down to lower back
    path: 'M 96,116 C 82,120 68,132 56,150 C 46,166 42,186 44,208 C 46,226 54,240 68,244 C 82,246 94,236 100,220 C 108,204 110,182 108,154 C 106,134 100,120 96,116 Z',
  },
  {
    id: 'obliques',
    slugs: ['obliques'],
    label: '외복사근',
    // External oblique — diagonal waist muscle visible from lateral view
    path: 'M 62,234 C 72,224 90,220 108,224 C 118,228 122,244 118,262 C 114,278 104,292 90,294 C 76,292 62,278 56,262 C 52,246 56,234 62,234 Z',
  },
  // ── Glutes & Hip ────────────────────────────────────────────────────────────
  {
    id: 'gluteus_medius',
    slugs: ['gluteal'],
    label: '중둔근',
    // Gluteus medius — upper/outer gluteal, critical for hip abduction
    path: 'M 50,222 C 38,236 32,260 36,282 C 40,302 56,316 70,312 C 84,308 90,294 84,272 C 78,250 62,226 52,220 Z',
  },
  {
    id: 'gluteal',
    slugs: ['gluteal'],
    label: '대둔근',
    // Gluteus maximus — large posterior glute visible from lateral profile
    path: 'M 42,286 C 32,308 30,334 36,356 C 42,374 58,384 72,380 C 84,374 88,358 82,336 C 76,314 60,292 44,284 Z',
  },
  {
    id: 'tfl',
    slugs: ['quadriceps'],
    label: 'TFL',
    // Tensor Fasciae Latae — small triangular muscle at anterior hip
    path: 'M 104,252 C 116,246 126,254 128,272 C 128,290 118,306 106,308 C 94,306 86,292 88,276 C 88,258 96,250 104,252 Z',
  },
  // ── Thigh ───────────────────────────────────────────────────────────────────
  {
    id: 'quads_vastus',
    slugs: ['quadriceps'],
    label: 'Vastus Lateralis',
    // Outer quadriceps — most visible quad muscle from lateral view
    path: 'M 102,304 C 116,308 122,330 118,354 C 114,372 104,382 94,380 C 82,378 76,366 76,344 C 76,320 84,306 98,302 Z',
  },
  {
    id: 'hams_outer',
    slugs: ['hamstring'],
    label: '햄스트링 외측',
    // Biceps femoris — lateral hamstring visible from side profile
    path: 'M 48,294 C 38,314 36,338 40,362 C 44,378 56,386 66,382 C 74,376 76,360 70,338 C 64,318 52,302 50,292 Z',
  },
  // ── Lower leg ───────────────────────────────────────────────────────────────
  {
    id: 'fibularis',
    slugs: ['calves'],
    label: '비골근',
    // Fibularis/Peroneus Longus — outer lower leg, lateral calf
    path: 'M 96,384 C 110,388 116,404 112,416 L 104,422 L 88,422 C 80,416 76,400 82,390 C 86,382 92,380 96,384 Z',
  },
];

// ── SVG structural paths ──────────────────────────────────────────────────────
// All coordinates fit within ViewBox "0 0 200 430"

// Main body silhouette — neck to feet, person facing RIGHT
const BODY_PATH = [
  // Back neck → down the posterior (left side)
  'M 78,50',
  'C 62,56 48,68 46,80',
  'C 44,94 44,110 44,126',
  'C 44,142 42,158 42,176',
  'C 40,192 36,208 36,226',
  'C 34,244 34,262 38,278',
  'C 42,294 46,310 48,326',
  'C 50,342 50,356 48,370',
  'C 44,382 40,392 42,402',
  'L 42,408 L 58,418 L 126,418',
  // Across foot and up the anterior (right side)
  'L 126,410',
  'C 108,406 106,400 106,390',
  'C 106,376 104,362 104,348',
  'C 104,334 102,320 102,306',
  'C 100,290 100,274 100,258',
  'C 100,242 102,228 104,214',
  'C 108,196 110,178 112,162',
  'C 114,146 116,130 116,114',
  'C 116,100 116,88 114,76',
  'C 112,68 108,60 100,54',
  'L 78,50 Z',
].join(' ');

// Upper arm — lateral aspect from shoulder to elbow
const ARM_PATH = [
  'M 116,68',
  'C 126,66 138,74 142,90',
  'C 146,108 144,130 140,150',
  'C 136,168 130,182 124,192',
  'C 120,200 116,204 114,206',
  'C 110,200 108,190 108,172',
  'C 108,152 110,132 114,112',
  'C 116,96 116,80 116,68 Z',
].join(' ');

// Forearm — elbow to wrist
const FOREARM_PATH = [
  'M 114,206',
  'C 116,216 120,230 124,246',
  'C 126,260 124,272 118,276',
  'C 112,278 108,270 108,258',
  'C 108,244 110,230 112,216',
  'C 113,208 114,206 114,206 Z',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Professional anatomical lateral-view SVG.
 *
 * @param {string[]} activeMuscleIds  Raw IDs from target_muscles (e.g. ['rear_delts', 'tfl'])
 * @param {string}   primaryColor     Highlight for the first / primary muscle
 * @param {string}   secondaryColor   Highlight for secondary / synergist muscles
 * @param {string}   defaultFill      Resting muscle fill
 * @param {number}   scale            Render scale (1 = 200×430 px)
 * @param {function} onRegionPress    Admin click handler — receives the region object
 */
const SideBodyView = ({
  activeMuscleIds   = [],
  primaryColor      = '#16a34a',
  secondaryColor    = '#86efac',
  defaultFill       = '#f1f5f9',
  scale             = 1,
  onRegionPress,
}) => {
  const BASE_W = 200;
  const BASE_H = 430;

  const getRegionState = (region) => {
    if (activeMuscleIds[0] === region.id) return 'primary';
    if (activeMuscleIds.includes(region.id)) return 'secondary';
    // Slug-level fallback: region activates if any mapped slug matches
    const activeSlugSet = new Set(
      activeMuscleIds.flatMap((id) => {
        const r = SIDE_REGIONS.find((r) => r.id === id);
        return r ? r.slugs : [id];
      })
    );
    if (region.slugs.some((s) => activeSlugSet.has(s))) return 'secondary';
    return 'inactive';
  };

  const STYLE = {
    primary:   { fill: primaryColor,   stroke: primaryColor,   opacity: 0.86, strokeW: 1.6 },
    secondary: { fill: secondaryColor, stroke: '#4ade80',      opacity: 0.72, strokeW: 1.2 },
    inactive:  { fill: defaultFill,    stroke: '#cbd5e1',      opacity: 0.6,  strokeW: 0.7 },
  };

  // Rough centroid from path numeric tokens (even = x, odd = y)
  const centroid = (path) => {
    const ns = path.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
    const xs = ns.filter((_, i) => i % 2 === 0);
    const ys = ns.filter((_, i) => i % 2 === 1);
    return [
      (Math.min(...xs) + Math.max(...xs)) / 2,
      (Math.min(...ys) + Math.max(...ys)) / 2,
    ];
  };

  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="측면 근육 해부도"
    >
      {/* ── Subtle clinical grid ── */}
      <defs>
        <pattern id="sideGrid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#f1f5f9" strokeWidth="0.4" />
        </pattern>
        {/* Soft shadow for active muscles */}
        <filter id="muscleGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
          <feOffset dx="0" dy="1" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.25" />
          </feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <rect width={BASE_W} height={BASE_H} fill="url(#sideGrid)" />

      {/* ── Body silhouette ── */}
      <path d={BODY_PATH}    fill="white" stroke="#c8d3dc" strokeWidth="1.6" strokeLinejoin="round" />
      <path d={ARM_PATH}     fill="white" stroke="#c8d3dc" strokeWidth="1.3" strokeLinejoin="round" />
      <path d={FOREARM_PATH} fill="white" stroke="#c8d3dc" strokeWidth="1.2" strokeLinejoin="round" />

      {/* ── Head ── */}
      <ellipse cx="92" cy="26" rx="21" ry="24"
        fill="white" stroke="#c8d3dc" strokeWidth="1.6" />
      {/* Minimal facial profile suggestion */}
      <path d="M 104,21 C 109,26 109,32 104,37"
        fill="none" stroke="#e2e8f0" strokeWidth="1" />

      {/* ── Anatomical reference lines ── */}
      {/* Spine dashed center */}
      <path d="M 44,82 C 43,108 43,138 43,168 C 41,188 38,206 38,224"
        fill="none" stroke="#e2e8f0" strokeWidth="0.9" strokeDasharray="3,4" />
      {/* IT band (iliotibial tract) — connects TFL to knee */}
      <path d="M 108,296 C 104,318 101,338 101,358"
        fill="none" stroke="#e9edf2" strokeWidth="1.4" strokeDasharray="2,5" />

      {/* ── Muscle overlays — rendered back-to-front ── */}
      {/* Draw inactive first, then active on top */}
      {[...SIDE_REGIONS].reverse().map((region) => {
        const state  = getRegionState(region);
        const s      = STYLE[state];
        const active = state !== 'inactive';
        const [cx, cy] = centroid(region.path);

        return (
          <g key={region.id} filter={active ? 'url(#muscleGlow)' : undefined}>
            <path
              d={region.path}
              fill={s.fill}
              fillOpacity={s.opacity}
              stroke={s.stroke}
              strokeWidth={s.strokeW}
              strokeLinejoin="round"
              onClick={() => onRegionPress?.(region)}
              style={{
                cursor: onRegionPress ? 'pointer' : 'default',
                transition: 'fill 0.2s ease, fill-opacity 0.2s ease',
              }}
            />
            {/* Label only when active */}
            {active && (
              <text
                x={cx}
                y={cy + 0.5}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={state === 'primary' ? 5.4 : 4.8}
                fontWeight="800"
                fill="white"
                letterSpacing="0.2"
                pointerEvents="none"
              >
                {region.label}
              </text>
            )}
          </g>
        );
      })}

      {/* ── Direction & view labels ── */}
      <text x="18"  y="424" fontSize="5.5" fill="#94a3b8" fontWeight="700" letterSpacing="0.6">← POST.</text>
      <text x="132" y="424" fontSize="5.5" fill="#94a3b8" fontWeight="700" letterSpacing="0.6">ANT. →</text>
      <text x="100" y="424" textAnchor="middle" fontSize="5.2" fill="#b0bec5" fontWeight="600" letterSpacing="1.2">
        LATERAL
      </text>
    </svg>
  );
};

export default SideBodyView;
