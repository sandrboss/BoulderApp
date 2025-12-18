'use client';

import * as React from 'react';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Arc, LinePath } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import { LinearGradient } from '@visx/gradient';

import type { ProgressPayload } from './page';

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

/**
 * Zone definitions (color-first, coach-first)
 * rates are Attempts->Sends
 */
const ZONES = [
  {
    key: 'overreaching' as const,
    label: 'Overreaching',
    range: [0.0, 0.05],
    color: '#EF4444', // red
    hint: 'Too hard right now',
  },
  {
    key: 'limit' as const,
    label: 'Limit',
    range: [0.05, 0.12],
    color: '#F97316', // orange
    hint: 'Hard projecting',
  },
  {
    key: 'growth' as const,
    label: 'Growth',
    range: [0.12, 0.25],
    color: '#EAB308', // yellow
    hint: 'Ideal learning zone',
  },
  {
    key: 'cruising' as const,
    label: 'Cruising',
    range: [0.25, 0.5],
    color: '#22C55E', // green
    hint: 'Mostly comfortable',
  },
];

/** Coach copy based on zone */
function coachCopy(zone: ProgressPayload['conversion14d']['zone']) {
  switch (zone) {
    case 'cruising':
      return {
        title: 'You’re cruising',
        body: 'You convert a lot of attempts into sends. Add 1 slightly harder “learning project” next session to keep progressing.',
      };
    case 'growth':
      return {
        title: 'Healthy growth zone',
        body: 'Nice balance: you’re pushing but still converting. Keep the mix: a few confidence sends + 1–2 projects.',
      };
    case 'limit':
      return {
        title: 'You’re pushing your limit',
        body: 'Lower conversion is normal here. Prioritize rest (2–3 min), repeat quality attempts, and don’t spread yourself too thin.',
      };
    case 'overreaching':
      return {
        title: 'Likely overreaching',
        body: 'Very low conversion often means problems are too far above your current level. Next session: choose easier “learnable” projects and rebuild momentum.',
      };
  }
}

function zoneMeta(zone: ProgressPayload['conversion14d']['zone']) {
  return (
    ZONES.find((z) => z.key === zone) ?? {
      key: zone,
      label: '—',
      range: [0, 0],
      color: '#111827',
      hint: '',
    }
  );
}

function Card({
  title,
  right,
  children,
  className,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-white/85 p-4 shadow-sm backdrop-blur ${className ?? ''}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {right}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Pill({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <span
      style={style}
      className={`rounded-full px-3 py-1 text-[11px] font-semibold ${className ?? 'bg-black/5 text-slate-900'}`}
    >
      {children}
    </span>
  );
}

export default function ProgressVisxClient({ data }: { data: ProgressPayload }) {
  const coach = coachCopy(data.conversion14d.zone);
  const meta = zoneMeta(data.conversion14d.zone);

  const oneIn = Math.max(
    1,
    Math.round(1 / Math.max(0.01, data.conversion14d.rate))
  );

  return (
    <main className="min-h-screen app-pattern text-fg p-4">
      <div className="max-w-sm mx-auto px-3 space-y-4 pb-24">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">Progress</h1>

            {/* colored zone pill */}
            <Pill
              style={{ backgroundColor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
            >
              {meta.label}
            </Pill>
          </div>

          <div className="flex flex-wrap gap-2">
            <Pill>{data.header.totalAttempts} attempts</Pill>
            <Pill>{data.header.totalProblems} projects</Pill>
            {data.header.homeGymName && <Pill>Home: {data.header.homeGymName}</Pill>}
          </div>
        </header>

        {/* Coach Card */}
        <Card title="Your coach says" right={<Pill>last 14 days</Pill>}>
          <div className="rounded-xl px-3 py-3" style={{ backgroundColor: `${meta.color}10`, border: `1px solid ${meta.color}22` }}>
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-slate-900">{coach.title}</div>
              <Pill
                style={{ backgroundColor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}55` }}
              >
                {meta.hint}
              </Pill>
            </div>

            <div className="mt-1 text-xs text-slate-700">{coach.body}</div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Pill>
                {data.conversion14d.sends} sends / {data.conversion14d.attempts} attempts
              </Pill>
              <Pill style={{ backgroundColor: `${meta.color}22`, color: meta.color }}>
                {pct(data.conversion14d.rate)} conversion
              </Pill>
              <Pill>
                ≈ 1 in <span className="font-semibold">{oneIn}</span> attempts becomes a send
              </Pill>
            </div>
          </div>
        </Card>

        {/* HERO: Gauge (prominent) */}
        <Card
          title="Effort vs conversion"
          right={<Pill className="bg-black/5 text-slate-900">coach widget</Pill>}
          className="p-5"
        >
          <div className="text-xs text-slate-700">
            This gauge is the shortcut: it tells you whether you’re <b>cruising</b> (high conversion) or <b>pushing</b> (low conversion) —
            without needing to “read” percentages.
          </div>

          <div className="mt-3 h-[190px]">
            <ParentSize>
                {({ width, height }) => {
                // Prevent SSR/CSR mismatch: ParentSize is 0 on server, real on client
                if (width < 20 || height < 20) return null;
                return (
                    <ConversionGauge
                    width={width}
                    height={height}
                    value={data.conversion14d.rate}
                    />
                );
                }}
            </ParentSize>
            </div>


          {/* Zone legend */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ZONES.map((z) => (
              <div key={z.key} className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: z.color }}
                />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-900 leading-tight">{z.label}</div>
                  <div className="text-[10px] text-slate-600 leading-tight">
                    {Math.round(z.range[0] * 100)}–{Math.round(z.range[1] * 100)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>


          
        </div>



    </main>
  );
}

/* -------------------- Widgets -------------------- */

function ConversionGauge({
  width,
  height,
  value,
}: {
  width: number;
  height: number;
  value: number; // 0..1
}) {
  if (width < 20 || height < 20) return null;

  const w = width;
  const h = height;

  const cx = w / 2;

  // Move the gauge UP so the needle is visible and the arc is centered in the card
  const radius = Math.min(w * 0.44, h * 0.62);
  const thickness = Math.max(16, radius * 0.20);

  // y-position of arc center (raise it)
  const cy = h * 0.62;

  const startAngle = -Math.PI * 0.85;
  const endAngle = Math.PI * 0.85;

  // scale: 0..0.5 is our dial range
  const v = clamp(value, 0, 0.5);
  const t = v / 0.5;
  const angle = startAngle + (endAngle - startAngle) * t;

  // Ring mid radius (where the pointer should touch)
  const ringR = radius - thickness * 0.5;

  // Target point on ring
  const tipX = cx + Math.cos(angle) * ringR;
  const tipY = cy + Math.sin(angle) * ringR;

  // Anchor point (bottom middle inside the dial)
  // This ensures the line always starts visibly inside the SVG
  const anchorX = cx;
  const anchorY = cy + radius * 0.30;

  // Needle ends slightly before the ring (looks nicer)
  const dx = tipX - anchorX;
  const dy = tipY - anchorY;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const needleEndX = anchorX + (dx / len) * (len - 10);
  const needleEndY = anchorY + (dy / len) * (len - 10);

  return (
    <svg width={w} height={h}>
      <LinearGradient
        id="gaugeBase"
        from="#0F172A"
        to="#0F172A"
        fromOpacity={0.08}
        toOpacity={0.18}
      />

      {/* Arcs */}
      <Group left={cx} top={cy}>
        {/* base */}
        <Arc
          innerRadius={radius - thickness}
          outerRadius={radius}
          startAngle={startAngle}
          endAngle={endAngle}
          fill="url(#gaugeBase)"
        />

        {/* zones */}
        {ZONES.map((z) => {
          const a0 = startAngle + (endAngle - startAngle) * (z.range[0] / 0.5);
          const a1 = startAngle + (endAngle - startAngle) * (z.range[1] / 0.5);
          return (
            <Arc
              key={z.key}
              innerRadius={radius - thickness}
              outerRadius={radius}
              startAngle={a0}
              endAngle={a1}
              fill={z.color}
              fillOpacity={0.88}
            />
          );
        })}
      </Group>

      {/* Value text INSIDE the dial */}
      <text
        x={cx}
        y={cy - radius * 0.10}
        textAnchor="middle"
        fontSize={26}
        fontWeight={900}
        fill="#0F172A"
      >
        {pct(value)}
      </text>
      <text
        x={cx}
        y={cy + radius * 0.02}
        textAnchor="middle"
        fontSize={11}
        fontWeight={700}
        fill="#334155"
      >
        Attempts → Sends
      </text>

      {/* Dot on the ring at the value */}
      <circle cx={tipX} cy={tipY} r={6.5} fill="#0F172A" opacity={0.92} />
      <circle cx={tipX} cy={tipY} r={11} fill="#0F172A" opacity={0.10} />

      {/* Needle from bottom-middle to the dot */}
      <line
        x1={anchorX}
        y1={anchorY}
        x2={needleEndX}
        y2={needleEndY}
        stroke="#0F172A"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.98}
      />
      <circle cx={anchorX} cy={anchorY} r={8} fill="#0F172A" />

      {/* labels */}
      <text
        x={cx - radius}
        y={cy + radius * 0.40}
        fontSize={11}
        fill="#64748b"
        textAnchor="start"
      >
        pushing
      </text>
      <text
        x={cx + radius}
        y={cy + radius * 0.40}
        fontSize={11}
        fill="#64748b"
        textAnchor="end"
      >
        cruising
      </text>
    </svg>
  );
}






function ConversionSpark({
  width,
  height,
  series,
}: {
  width: number;
  height: number;
  series: Array<{ week: string; rate: number; attempts: number; sends: number }>;
}) {
  const w = Math.max(10, width);
  const h = Math.max(10, height);
  const pad = { l: 6, r: 6, t: 10, b: 14 };

  const data = series.slice(-8);
  if (data.length <= 1) return <EmptySpark width={w} height={h} label="Not enough data" />;

  const x = scaleBand({
    domain: data.map((d) => d.week),
    range: [pad.l, w - pad.r],
    padding: 0.35,
  });

  const y = scaleLinear({
    domain: [0, 0.35],
    range: [h - pad.b, pad.t],
    clamp: true,
  });

  const points = data.map((d) => ({
    x: (x(d.week) ?? 0) + (x.bandwidth() / 2),
    y: y(d.rate),
    rate: d.rate,
  }));

  return (
    <svg width={w} height={h}>
      {/* Healthy band (12–25%) in soft green */}
      <rect
        x={pad.l}
        y={y(0.25)}
        width={w - pad.l - pad.r}
        height={y(0.12) - y(0.25)}
        fill="#22C55E"
        opacity={0.10}
        rx={10}
      />

      <LinePath
        data={points}
        x={(d) => d.x}
        y={(d) => d.y}
        stroke="#2563EB" // blue line
        strokeWidth={2.6}
        strokeLinecap="round"
      />

      {/* points */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="#2563EB" opacity={0.92} />
      ))}

      {/* bottom labels */}
      <text x={pad.l} y={h - 4} fontSize={9} fill="#64748b">
        older
      </text>
      <text x={w - pad.r} y={h - 4} fontSize={9} fill="#64748b" textAnchor="end">
        now
      </text>
    </svg>
  );
}

function AttemptsDistribution({
  width,
  height,
  flash,
  learn,
  project,
}: {
  width: number;
  height: number;
  flash: number;
  learn: number;
  project: number;
}) {
  const w = Math.max(10, width);
  const h = Math.max(10, height);

  const total = flash + learn + project;
  if (total === 0) return <EmptySpark width={w} height={h} label="No sends yet" />;

  const pad = 8;
  const barH = Math.max(18, h * 0.46);
  const y = (h - barH) / 2;

  const fw = (w - pad * 2) * (flash / total);
  const lw = (w - pad * 2) * (learn / total);
  const pw = (w - pad * 2) * (project / total);

  // Colors communicate: Flash (green), Learn (yellow), Project (purple)
  return (
    <svg width={w} height={h}>
      <rect x={pad} y={y} width={w - pad * 2} height={barH} rx={14} fill="#0F172A" opacity={0.06} />

      <RoundedRect x={pad} y={y} width={fw} height={barH} radius={14} fill="#22C55E" opacity={0.70} />
      <rect x={pad + fw} y={y} width={lw} height={barH} fill="#EAB308" opacity={0.70} />
      <RoundedRect x={pad + fw + lw} y={y} width={pw} height={barH} radius={14} fill="#8B5CF6" opacity={0.65} />

      {/* separators */}
      <line x1={pad + fw} y1={y + 6} x2={pad + fw} y2={y + barH - 6} stroke="#fff" opacity={0.28} />
      <line x1={pad + fw + lw} y1={y + 6} x2={pad + fw + lw} y2={y + barH - 6} stroke="#fff" opacity={0.28} />

      <text x={pad} y={y - 5} fontSize={10} fill="#334155" fontWeight={800}>
        Flash
      </text>
      <text x={pad + fw + lw / 2} y={y - 5} fontSize={10} fill="#334155" fontWeight={800} textAnchor="middle">
        Learn
      </text>
      <text x={w - pad} y={y - 5} fontSize={10} fill="#334155" fontWeight={800} textAnchor="end">
        Project
      </text>
    </svg>
  );
}

function GradeStepSpark({
  width,
  height,
  series,
}: {
  width: number;
  height: number;
  series: Array<{ day: string; maxRankSoFar: number }>;
}) {
  const w = Math.max(10, width);
  const h = Math.max(10, height);
  const pad = { l: 8, r: 8, t: 12, b: 12 };

  const data = series.slice(-18);
  if (data.length <= 1) return <EmptySpark width={w} height={h} label="No milestone sends yet" />;

  const x = scaleBand({
    domain: data.map((d) => d.day),
    range: [pad.l, w - pad.r],
    padding: 0.25,
  });

  const maxRank = Math.max(...data.map((d) => d.maxRankSoFar), 1);
  const y = scaleLinear({
    domain: [0, maxRank],
    range: [h - pad.b, pad.t],
    nice: true,
  });

  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    const xi = (x(d.day) ?? 0) + x.bandwidth() / 2;
    const yi = y(d.maxRankSoFar);

    if (i === 0) {
      pts.push({ x: xi, y: yi });
    } else {
      pts.push({ x: xi, y: pts[pts.length - 1].y });
      pts.push({ x: xi, y: yi });
    }
  }

  return (
    <svg width={w} height={h}>
      <line x1={pad.l} y1={h - pad.b} x2={w - pad.r} y2={h - pad.b} stroke="#0F172A" opacity={0.10} />

      <LinePath
        data={pts}
        x={(d) => d.x}
        y={(d) => d.y}
        stroke="#06B6D4" // cyan
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4.8} fill="#06B6D4" />

      <text x={pad.l} y={11} fontSize={10} fill="#64748b">
        new hardest moments
      </text>
    </svg>
  );
}

function Heatmap28({
  width,
  height,
  series,
}: {
  width: number;
  height: number;
  series: Array<{ day: string; attempts: number; sends: number }>;
}) {
  const w = Math.max(10, width);
  const h = Math.max(10, height);

  const cols = 7;
  const rows = 4;
  const pad = 6;

  const cellW = (w - pad * 2) / cols;
  const cellH = (h - pad * 2) / rows;
  const size = Math.min(cellW, cellH) * 0.8;

  const maxAttempts = Math.max(...series.map((d) => d.attempts), 1);

  return (
    <svg width={w} height={h}>
      <text x={pad} y={12} fontSize={10} fill="#64748b">
        attempts / day
      </text>

      <Group left={pad} top={18}>
        {series.map((d, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);

          const x = col * cellW + (cellW - size) / 2;
          const y = row * cellH + (cellH - size) / 2;

          const t = clamp(d.attempts / maxAttempts, 0, 1);

          // teal intensity
          const base = '#14B8A6';
          const opacity = 0.10 + t * 0.70;

          return (
            <g key={d.day}>
              <rect
                x={x}
                y={y}
                width={size}
                height={size}
                rx={8}
                fill={base}
                opacity={opacity}
              />

              {/* send dot */}
              {d.sends > 0 && (
                <circle
                  cx={x + size - 6}
                  cy={y + 6}
                  r={2.6}
                  fill="#0F172A"
                  opacity={0.85}
                />
              )}
            </g>
          );
        })}
      </Group>
    </svg>
  );
}

function EmptySpark({ width, height, label }: { width: number; height: number; label: string }) {
  return (
    <svg width={width} height={height}>
      <rect
        x={6}
        y={6}
        width={Math.max(0, width - 12)}
        height={Math.max(0, height - 12)}
        rx={14}
        fill="#0F172A"
        opacity={0.06}
      />
      <text x={width / 2} y={height / 2} textAnchor="middle" fontSize={11} fill="#64748b">
        {label}
      </text>
    </svg>
  );
}

/* small helper for rounded segments */
function RoundedRect({
  x,
  y,
  width,
  height,
  radius,
  fill,
  opacity,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  fill: string;
  opacity?: number;
}) {
  if (width <= 0) return null;
  if (width < radius * 2) {
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={Math.min(radius, width / 2)}
        fill={fill}
        opacity={opacity}
      />
    );
  }
  return <rect x={x} y={y} width={width} height={height} rx={radius} fill={fill} opacity={opacity} />;
}
