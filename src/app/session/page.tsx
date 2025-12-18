'use client';

import * as React from 'react';
import { supabase } from '@/lib/supabaseClient';

type Energy = 'low' | 'normal' | 'high' | null;

type SessionRow = {
  id: string;
  date: string;
  energy: Energy;
};

type AttemptRow = {
  id: string;
  session_id: string;
  problem_id: string;
  outcome: string;
};

/* ---------------- utils ---------------- */

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function startOfNextMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function fmtMonth(d: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(d);
}

function fmtSessionRightDate(dateStr: string) {
  const [y, m, day] = dateStr.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1, day ?? 1);

  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(d);
  const dd = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(d);

  return `${weekday}, ${dd} ${month}`;
}

/* ---------------- micro components ---------------- */

function SmallCaps({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[9px] tracking-[0.18em] uppercase text-black/40">
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <SmallCaps>{label}</SmallCaps>
      <div className="mt-0.5 text-base font-medium tabular-nums text-black">
        {value}
      </div>
    </div>
  );
}

/* ---------------- main ---------------- */

export default function SessionPage() {
  const [monthCursor, setMonthCursor] = React.useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [attempts, setAttempts] = React.useState<AttemptRow[]>([]);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const from = startOfMonth(monthCursor).toISOString().slice(0, 10);
      const to = startOfNextMonth(monthCursor).toISOString().slice(0, 10);

      try {
        const { data: sessionsData, error: sErr } = await supabase
          .from('sessions')
          .select('id, date, energy')
          .gte('date', from)
          .lt('date', to)
          .order('date', { ascending: false });

        if (sErr) throw sErr;

        const list = (sessionsData ?? []) as SessionRow[];
        if (cancelled) return;

        setSessions(list);

        const ids = list.map((s) => s.id);
        if (!ids.length) {
          setAttempts([]);
          return;
        }

        const { data: attemptsData, error: aErr } = await supabase
          .from('attempts')
          .select('id, session_id, problem_id, outcome')
          .in('session_id', ids);

        if (aErr) throw aErr;

        if (!cancelled) setAttempts((attemptsData ?? []) as AttemptRow[]);
      } catch (e: any) {
        console.error(e);
        if (!cancelled) setError(e?.message ?? 'Could not load sessions.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [monthCursor]);

  const statsBySession = React.useMemo(() => {
    const map: Record<
      string,
      { attempts: number; sends: number; projects: number; unique: Set<string>; sent: Set<string> }
    > = {};

    for (const a of attempts) {
      if (!map[a.session_id]) {
        map[a.session_id] = {
          attempts: 0,
          sends: 0,
          projects: 0,
          unique: new Set(),
          sent: new Set(),
        };
      }

      const m = map[a.session_id];
      m.attempts += 1;
      m.unique.add(a.problem_id);
      if (a.outcome === 'sent') {
        m.sends += 1;
        m.sent.add(a.problem_id);
      }
    }

    for (const k of Object.keys(map)) {
      map[k].projects = clamp(map[k].unique.size - map[k].sent.size, 0, 999);
    }

    return map;
  }, [attempts]);

  return (
    <main className="min-h-screen bg-[#F3F1EE] text-black p-4">
      <div className="mx-auto w-full max-w-sm pb-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold tracking-tight">Sessions</h1>

          <div className="flex items-center gap-3 text-sm">
            <button
              onClick={() =>
                setMonthCursor((d) =>
                  startOfMonth(new Date(d.getFullYear(), d.getMonth() - 1, 1))
                )
              }
              className="opacity-60 hover:opacity-100"
            >
              ←
            </button>

            <button
              onClick={() => setMonthCursor(startOfMonth(new Date()))}
              className="text-xs opacity-60 hover:opacity-100"
            >
              Today
            </button>

            <button
              onClick={() =>
                setMonthCursor((d) =>
                  startOfMonth(new Date(d.getFullYear(), d.getMonth() + 1, 1))
                )
              }
              className="opacity-60 hover:opacity-100"
            >
              →
            </button>
          </div>
        </div>

        {/* Month */}
        <div className="mt-6 flex justify-between text-sm text-black/70">
          <div>{sessions.length} sessions</div>
          <div className="font-medium text-black">{fmtMonth(monthCursor)}</div>
        </div>

        {/* Content */}
        <div className="mt-6 space-y-3">
          {loading && (
            <div className="rounded-2xl bg-white/60 p-4 text-xs text-black/50">
              Loading…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-2xl bg-white/60 p-4 text-xs text-red-600">
              {error}
            </div>
          )}

          {sessions.map((s) => {
            const st = statsBySession[s.id] ?? { attempts: 0, sends: 0, projects: 0 };
            const conv = st.attempts ? Math.round((st.sends / st.attempts) * 100) : 0;

            return (
              <div key={s.id} className="rounded-3xl bg-[#DEE4EE] p-4">
                <div className="flex justify-between items-start">
                  <div className="text-sm font-medium text-black">
                    {fmtSessionRightDate(s.date)}
                  </div>
                  <div className="text-xs text-black/50">{s.energy ?? 'normal'}</div>
                </div>

                <div className="mt-4 grid grid-cols-3">
                  <Metric label="Sends" value={String(st.sends)} />
                  <Metric label="Attempts" value={String(st.attempts)} />
                  <Metric label="Projects" value={String(st.projects)} />
                </div>

                <div className="mt-4 flex justify-center text-xs text-black/60">
                  Conversion: <span className="ml-1 font-medium text-black">{conv}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}
