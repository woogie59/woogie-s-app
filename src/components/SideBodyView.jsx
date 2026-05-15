import React from 'react';

// Muscle regions visible from the lateral view, mapped to their library slugs.
// Each region is rendered as a semi-transparent ellipse overlay on the silhouette.
const SIDE_REGIONS = [
  // ── Back-side muscles (left of SVG) ─────────────────────────
  { slugs: ['trapezius'],  label: '승모근',    cx: 51,  cy: 86,  rx: 13, ry: 20 },
  { slugs: ['upper-back'], label: '광배근',    cx: 47,  cy: 128, rx: 10, ry: 28 },
  { slugs: ['lower-back'], label: '척추기립근', cx: 45,  cy: 178, rx: 9,  ry: 22 },
  { slugs: ['gluteal'],    label: '둔근',      cx: 39,  cy: 244, rx: 15, ry: 26 },
  { slugs: ['hamstring'],  label: '햄스트링',  cx: 52,  cy: 308, rx: 10, ry: 38 },
  { slugs: ['calves'],     label: '종아리',    cx: 47,  cy: 358, rx: 9,  ry: 20 },
  // ── Front-side muscles (right of SVG) ────────────────────────
  { slugs: ['chest'],      label: '가슴',      cx: 116, cy: 116, rx: 12, ry: 28 },
  { slugs: ['abs'],        label: '복근',      cx: 108, cy: 175, rx: 10, ry: 27 },
  { slugs: ['quadriceps'], label: '대퇴사두',  cx: 98,  cy: 290, rx: 10, ry: 38 },
  { slugs: ['tibialis'],   label: '전경골근',  cx: 109, cy: 358, rx: 8,  ry: 20 },
  // ── Both sides (centered) ────────────────────────────────────
  { slugs: ['deltoids'],   label: '삼각근',    cx: 78,  cy: 80,  rx: 22, ry: 13 },
  { slugs: ['obliques'],   label: '옆구리',    cx: 90,  cy: 178, rx: 11, ry: 30 },
  // ── Arm (hanging in front, offset right) ─────────────────────
  { slugs: ['biceps'],     label: '이두근',    cx: 134, cy: 122, rx: 10, ry: 28 },
  { slugs: ['triceps'],    label: '삼두근',    cx: 146, cy: 122, rx: 10, ry: 28 },
  { slugs: ['forearm'],    label: '전완근',    cx: 140, cy: 182, rx: 9,  ry: 24 },
];

// ── SVG paths ──────────────────────────────────────────────────────────────────

// Body silhouette (neck → feet), person facing RIGHT.
const BODY_PATH = [
  'M 76,52',
  'C 62,58 48,68 44,80',
  'C 42,94 42,110 44,126',
  'C 44,144 44,160 44,176',
  'C 42,190 38,204 36,220',
  'C 34,236 34,252 38,268',
  'C 42,282 46,296 50,310',
  'C 52,324 52,338 50,352',
  'C 46,366 42,374 42,382',
  'C 44,390 52,396 62,398',
  'L 62,403 L 126,403',
  'L 126,396',
  'C 114,396 112,392 112,386',
  'C 112,374 112,360 110,348',
  'C 108,334 106,320 104,306',
  'C 100,292 98,276 98,262',
  'C 98,246 100,232 104,218',
  'C 106,204 108,190 110,178',
  'C 112,164 116,150 118,138',
  'C 122,122 124,108 122,94',
  'C 120,84 118,76 116,72',
  'C 110,66 104,62 98,58',
  'L 76,52 Z',
].join(' ');

// Upper arm (hanging in front of body)
const UPPER_ARM_PATH = [
  'M 116,72',
  'C 126,74 136,82 140,98',
  'C 144,114 144,132 142,150',
  'C 140,164 132,172 124,168',
  'C 120,166 118,158 120,144',
  'C 122,128 124,110 120,94',
  'C 118,84 116,76 116,72 Z',
].join(' ');

// Forearm
const FOREARM_PATH = [
  'M 142,150',
  'C 146,164 150,180 150,198',
  'C 150,212 146,222 138,224',
  'C 132,224 128,218 128,208',
  'C 128,194 130,180 134,166',
  'C 136,156 140,152 142,150 Z',
].join(' ');

// ── Component ─────────────────────────────────────────────────────────────────

const SideBodyView = ({
  activeSlugs = [],
  primaryColor   = '#16a34a',
  secondaryColor = '#86efac',
  defaultFill    = '#e5e7eb',
  scale          = 1,
  onRegionPress,
}) => {
  const baseW = 180;
  const baseH = 415;

  const getRegionFill = (region) => {
    const hit = region.slugs.some((s) => activeSlugs.includes(s));
    if (!hit) return defaultFill;
    const isPrimary = region.slugs.some((s) => s === activeSlugs[0]);
    return isPrimary ? primaryColor : secondaryColor;
  };

  return (
    <svg
      viewBox={`0 0 ${baseW} ${baseH}`}
      width={baseW * scale}
      height={baseH * scale}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {/* ── Silhouette fills ── */}
      <path d={BODY_PATH}     fill="#f9fafb" stroke="#d1d5db" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={UPPER_ARM_PATH} fill="#f9fafb" stroke="#d1d5db" strokeWidth="1.2" strokeLinejoin="round" />
      <path d={FOREARM_PATH}   fill="#f9fafb" stroke="#d1d5db" strokeWidth="1.2" strokeLinejoin="round" />

      {/* ── Head ── */}
      <ellipse cx="92" cy="30" rx="22" ry="26" fill="#f9fafb" stroke="#d1d5db" strokeWidth="1.5" />

      {/* ── Subtle spine line ── */}
      <path d="M 44,84 C 44,120 44,156 44,176 C 42,192 38,208 38,222"
        fill="none" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />

      {/* ── Muscle region overlays ── */}
      {SIDE_REGIONS.map((region) => {
        const fill = getRegionFill(region);
        const isActive = fill !== defaultFill;
        return (
          <ellipse
            key={region.label}
            cx={region.cx}
            cy={region.cy}
            rx={region.rx}
            ry={region.ry}
            fill={fill}
            fillOpacity={isActive ? 0.82 : 0.45}
            stroke={isActive ? fill : '#d1d5db'}
            strokeWidth={isActive ? 1.5 : 0.8}
            onClick={() => onRegionPress?.(region)}
            style={{ cursor: onRegionPress ? 'pointer' : 'default', transition: 'fill 0.15s, fill-opacity 0.15s' }}
          />
        );
      })}

      {/* ── Labels on active regions ── */}
      {SIDE_REGIONS.filter((r) => getRegionFill(r) !== defaultFill).map((region) => (
        <text
          key={`lbl-${region.label}`}
          x={region.cx}
          y={region.cy + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={region.rx > 14 ? 5.5 : 4.8}
          fill="white"
          fontWeight="700"
          letterSpacing="-0.1"
          pointerEvents="none"
        >
          {region.label}
        </text>
      ))}

      {/* ── Direction hint ── */}
      <text x="94" y="408" textAnchor="middle" fontSize="6" fill="#9ca3af" fontWeight="500" letterSpacing="0.5">
        측면 (좌→우: 후→전)
      </text>
    </svg>
  );
};

export { SIDE_REGIONS };
export default SideBodyView;
