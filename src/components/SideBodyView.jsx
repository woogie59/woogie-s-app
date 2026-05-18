import React from 'react';

// ── Anatomical region definitions ─────────────────────────────────────────────
// id        : micro-segment ID (stored in target_muscles array)
// slugs     : library slugs that also activate this region
// label     : Korean display label
// path      : SVG path data
//
// Silhouette layout: ViewBox "0 0 200 445", person facing RIGHT.
// Back of body = left side (x ≈ 36–50), Front of body = right side (x ≈ 100–120).

export const SIDE_REGIONS = [
  {
    id: 'side_delts',
    slugs: ['deltoids'],
    label: '측면 삼각근',
    // Large rounded cap at the top of the arm — most prominent lateral feature
    path: 'M 94,66 C 112,58 134,66 142,86 C 148,104 142,124 130,130 C 116,134 100,126 94,110 C 88,94 88,78 94,66 Z',
  },
  {
    id: 'rear_delts',
    slugs: ['deltoids'],
    label: '후면 삼각근',
    // Smaller teardrop shape posterior to the lateral deltoid
    path: 'M 74,70 C 86,62 102,68 108,84 C 112,98 108,114 100,120 C 90,126 76,118 70,104 C 64,90 66,78 74,70 Z',
  },
  {
    id: 'triceps',
    slugs: ['triceps'],
    label: '삼두근',
    // Elongated posterior upper-arm muscle, visible from lateral view
    path: 'M 110,110 C 118,108 126,116 128,136 C 130,154 128,172 124,186 C 120,196 116,202 112,198 C 108,192 108,178 108,160 C 108,140 108,122 110,110 Z',
  },
  {
    id: 'serratus',
    slugs: ['obliques'],
    label: '전거근',
    // Finger-like projections on lateral ribcage below armpit
    path: 'M 118,116 C 130,120 136,136 134,152 C 132,160 128,165 126,168 C 129,172 130,178 128,183 C 126,187 122,191 120,194 C 122,199 124,205 122,209 C 118,215 112,217 108,213 C 104,207 104,194 104,180 C 104,160 108,138 118,116 Z',
  },
  {
    id: 'lats',
    slugs: ['upper-back'],
    label: '광배근',
    // Wide fan from armpit area down to lower back — signature lateral back muscle
    path: 'M 96,118 C 84,122 70,134 58,152 C 48,168 44,186 44,206 C 44,222 50,234 62,240 C 76,244 88,236 96,220 C 104,206 106,186 104,160 C 102,140 98,124 96,118 Z',
  },
  {
    id: 'obliques',
    slugs: ['obliques'],
    label: '외복사근',
    // Diagonal muscle on the side of the waist/abdomen
    path: 'M 62,230 C 72,220 88,216 104,220 C 114,224 118,238 114,254 C 110,268 102,280 90,282 C 78,280 66,268 60,254 C 56,240 58,232 62,230 Z',
  },
  {
    id: 'gluteus_medius',
    slugs: ['gluteal'],
    label: '중둔근',
    // Upper/outer gluteal region, critical for hip stabilization
    path: 'M 50,222 C 38,234 34,256 38,276 C 42,294 56,306 68,304 C 80,300 86,288 82,268 C 78,248 66,228 52,220 Z',
  },
  {
    id: 'tfl',
    slugs: ['quadriceps'],
    label: 'TFL',
    // Tensor Fasciae Latae — front-hip, small triangular muscle
    path: 'M 102,250 C 114,244 122,252 122,268 C 122,284 114,296 104,298 C 94,296 88,284 88,270 C 88,254 96,248 102,250 Z',
  },
  {
    id: 'quads_vastus',
    slugs: ['quadriceps'],
    label: 'Vastus Lateralis',
    // Outer quadriceps — very prominent from lateral view
    path: 'M 102,296 C 114,300 120,320 116,342 C 112,360 104,370 96,370 C 86,368 80,358 80,338 C 80,316 86,298 96,294 Z',
  },
  {
    id: 'fibularis',
    slugs: ['calves'],
    label: '비골근',
    // Fibularis/Peroneus Longus — lateral lower leg, visible from side
    path: 'M 98,378 C 110,382 116,398 112,416 L 104,420 L 88,420 C 80,414 78,400 84,388 C 88,378 94,374 98,378 Z',
  },
];

// ── SVG structural paths ──────────────────────────────────────────────────────

const BODY_PATH = [
  'M 78,52',
  'C 62,58 48,68 46,80',
  'C 44,94 44,110 44,126',
  'C 44,142 42,160 42,178',
  'C 40,194 36,210 36,228',
  'C 34,246 34,264 40,282',
  'C 44,298 48,314 50,330',
  'C 50,346 50,360 48,374',
  'C 44,388 42,400 44,410',
  'L 44,418 L 62,424 L 130,424',
  'L 130,416',
  'C 112,410 110,404 110,392',
  'C 108,376 106,360 106,346',
  'C 106,330 104,314 102,298',
  'C 100,282 100,268 102,252',
  'C 104,238 106,224 108,212',
  'C 112,194 114,174 116,158',
  'C 118,140 120,124 118,108',
  'C 116,96 116,84 114,74',
  'C 112,66 108,60 100,56',
  'L 78,52 Z',
].join(' ');

// Upper arm — lateral aspect visible from side view
const ARM_PATH = [
  'M 118,72',
  'C 128,68 140,76 144,92',
  'C 148,110 146,132 142,152',
  'C 138,170 132,184 126,194',
  'C 122,202 118,206 116,208',
  'C 112,202 108,192 108,174',
  'C 108,154 110,134 114,114',
  'C 116,98 118,84 118,72 Z',
].join(' ');

const FOREARM_PATH = [
  'M 116,208',
  'C 118,218 122,232 126,248',
  'C 128,262 126,274 120,278',
  'C 114,280 110,272 108,260',
  'C 108,246 110,232 112,218',
  'C 114,210 116,208 116,208 Z',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * @param {string[]} activeMuscleIds  - raw IDs from target_muscles (e.g. 'rear_delts', 'tfl')
 * @param {string}   primaryColor     - active primary muscle highlight
 * @param {string}   secondaryColor   - secondary/synergist highlight
 * @param {string}   defaultFill      - resting muscle fill
 * @param {number}   scale            - render scale factor
 * @param {function} onRegionPress    - (region) => void — admin click handler
 */
const SideBodyView = ({
  activeMuscleIds   = [],
  primaryColor      = '#16a34a',
  secondaryColor    = '#86efac',
  defaultFill       = '#f3f4f6',
  scale             = 1,
  onRegionPress,
}) => {
  const BASE_W = 200;
  const BASE_H = 445;

  const getRegionState = (region) => {
    if (activeMuscleIds[0] === region.id) return 'primary';
    if (activeMuscleIds.includes(region.id)) return 'secondary';
    // Fallback: any mapped slug matches a mapped ID
    const activeSlugSet = new Set(activeMuscleIds.flatMap((id) => {
      const r = SIDE_REGIONS.find((r) => r.id === id);
      return r ? r.slugs : [id];
    }));
    if (region.slugs.some((s) => activeSlugSet.has(s))) return 'secondary';
    return 'inactive';
  };

  const getFill = (state) => {
    if (state === 'primary')   return primaryColor;
    if (state === 'secondary') return secondaryColor;
    return defaultFill;
  };

  const getStroke = (state) => {
    if (state === 'primary')   return primaryColor;
    if (state === 'secondary') return '#4ade80';
    return '#d1d5db';
  };

  const getOpacity = (state) => {
    if (state === 'primary')   return 0.88;
    if (state === 'secondary') return 0.72;
    return 0.55;
  };

  return (
    <svg
      viewBox={`0 0 ${BASE_W} ${BASE_H}`}
      width={BASE_W * scale}
      height={BASE_H * scale}
      style={{ display: 'block', overflow: 'visible' }}
      aria-label="측면 근육 해부도"
    >
      {/* ── Clinical grid lines ── */}
      <defs>
        <pattern id="sideGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width={BASE_W} height={BASE_H} fill="url(#sideGrid)" />

      {/* ── Body silhouette ── */}
      <path d={BODY_PATH}     fill="white" stroke="#cbd5e1" strokeWidth="1.4" strokeLinejoin="round" />
      <path d={ARM_PATH}      fill="white" stroke="#cbd5e1" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={FOREARM_PATH}  fill="white" stroke="#cbd5e1" strokeWidth="1.1" strokeLinejoin="round" />

      {/* ── Head ── */}
      <ellipse cx="94" cy="28" rx="21" ry="24"
        fill="white" stroke="#cbd5e1" strokeWidth="1.4" />
      {/* Subtle facial profile suggestion */}
      <path d="M 106,24 C 110,28 110,34 106,38" fill="none" stroke="#e5e7eb" strokeWidth="1" />

      {/* ── Spine centerline ── */}
      <path d="M 44,82 C 43,110 43,140 43,170 C 41,190 38,208 38,226"
        fill="none" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="3,4" />

      {/* ── Muscle overlays ── */}
      {SIDE_REGIONS.map((region) => {
        const state   = getRegionState(region);
        const fill    = getFill(state);
        const stroke  = getStroke(state);
        const opacity = getOpacity(state);
        const isActive = state !== 'inactive';

        return (
          <g key={region.id}>
            <path
              d={region.path}
              fill={fill}
              fillOpacity={opacity}
              stroke={stroke}
              strokeWidth={isActive ? 1.4 : 0.8}
              strokeLinejoin="round"
              onClick={() => onRegionPress?.(region)}
              style={{
                cursor: onRegionPress ? 'pointer' : 'default',
                transition: 'fill 0.18s ease, fill-opacity 0.18s ease',
              }}
            />
            {/* Label for active muscles */}
            {isActive && (() => {
              // Calculate approximate centroid from path bounding box (rough)
              const nums = region.path.match(/-?\d+\.?\d*/g)?.map(Number) ?? [];
              const xs = nums.filter((_, i) => i % 2 === 0);
              const ys = nums.filter((_, i) => i % 2 === 1);
              const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
              const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
              return (
                <text
                  x={cx}
                  y={cy + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={5.2}
                  fontWeight="800"
                  fill="white"
                  letterSpacing="0.3"
                  pointerEvents="none"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  {region.label}
                </text>
              );
            })()}
          </g>
        );
      })}

      {/* ── Direction indicator ── */}
      <g>
        <text x="28" y="440" fontSize="5.5" fill="#94a3b8" fontWeight="600" letterSpacing="0.8">
          ← POST.
        </text>
        <text x="130" y="440" fontSize="5.5" fill="#94a3b8" fontWeight="600" letterSpacing="0.8">
          ANT. →
        </text>
        <text x="100" y="440" fontSize="5" fill="#cbd5e1" fontWeight="500" textAnchor="middle" letterSpacing="1">
          LATERAL VIEW
        </text>
      </g>
    </svg>
  );
};

export default SideBodyView;
