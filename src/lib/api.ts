import { supabase } from './supabaseClient';

// ---- Types ----

export type Energy = 'low' | 'normal' | 'high';
export type Outcome = 'start' | 'crux' | 'almost' | 'sent';

export type SessionRow = {
  id: string;
  date: string;
  energy: Energy;
  summary_photo_url?: string | null;
};

export type ProblemRow = {
  id: string;
  grade: string | null;
  status: 'project' | 'sent';
  created_at: string;
  gym_id: string | null;
  grade_id: string | null;
  photo_url?: string | null;
  boulder_color?: string | null;
};

export type ProblemStats = {
  attempts: number;
  lastOutcome: Outcome | null;
};

export type GymRow = {
  id: string;
  name: string;
  is_home: boolean;
  grading_mode: 'specific' | 'ranges';
  created_at: string;
};

export type GymGradeRow = {
  id: string;
  gym_id: string;
  name: string;
  color: string;
  sort_order: number;
  created_at: string;
};

// ---- Sessions ----

export async function getOrCreateTodaySession(
  energy?: Energy
): Promise<SessionRow> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: existing, error: existingError } = await supabase
    .from('sessions')
    .select('*')
    .eq('date', today)
    .maybeSingle();

  if (existingError && existingError.code !== 'PGRST116') {
    // PGRST116 = no rows found
    throw existingError;
  }

  if (existing) return existing as SessionRow;

  if (!energy) {
    throw new Error(
      'No session for today and no energy provided to create one.'
    );
  }

  const { data: created, error: createError } = await supabase
    .from('sessions')
    .insert({ date: today, energy })
    .select('*')
    .single();

  if (createError) throw createError;
  return created as SessionRow;
}

// ---- Problems / Attempts ----

// All problems (project + sent), oldest first
export async function getActiveProblems(): Promise<ProblemRow[]> {
  const { data, error } = await supabase
    .from('problems')
    .select('id, grade, status, created_at, gym_id, grade_id, photo_url, boulder_color')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading problems', error);
    throw error;
  }

  return (data ?? []) as ProblemRow[];
}

// Create a problem, using gym + grade if available
export async function createProblem(opts: {
  gradeLabel: string;
  gymId?: string;
  gradeId?: string;
  photoUrl?: string;
  boulderColor?: string;
}) {
  const { data, error } = await supabase
    .from('problems')
    .insert({
      grade: opts.gradeLabel,
      gym_id: opts.gymId ?? null,
      grade_id: opts.gradeId ?? null,
      photo_url: opts.photoUrl ?? null,
      boulder_color: opts.boulderColor ?? null,
    })
    .select('id, grade, status, created_at, gym_id, grade_id, photo_url, boulder_color')
    .single();

  if (error) throw error;
  return data as ProblemRow;
}

export async function logAttempt(
  sessionId: string,
  problemId: string,
  outcome: Outcome
) {
  const { data, error } = await supabase
    .from('attempts')
    .insert({ session_id: sessionId, problem_id: problemId, outcome })
    .select('*')
    .single();

  if (error) throw error;

  if (outcome === 'sent') {
    await supabase
      .from('problems')
      .update({ status: 'sent' })
      .eq('id', problemId);
  }

  return data;
}

export async function getSessionAttemptStats(sessionId: string) {
  const { data, error } = await supabase
    .from('attempts')
    .select('problem_id, outcome, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const map: Record<string, { attempts: number; lastOutcome: Outcome | null }> = {};
  for (const row of data ?? []) {
    const pid = row.problem_id as string;
    const outcome = row.outcome as Outcome;
    if (!map[pid]) map[pid] = { attempts: 0, lastOutcome: null };
    map[pid].attempts += 1;
    map[pid].lastOutcome = outcome;
  }
  return map;
}





export async function deleteProblem(problemId: string) {
  const { error } = await supabase
    .from('problems')
    .delete()
    .eq('id', problemId);

  if (error) throw error;
}

export async function deleteProblemWithPhoto(problem: {
  id: string;
  photo_url?: string | null;
}) {
  // 1) Best-effort photo cleanup
  if (problem.photo_url) {
    try {
      await deleteImageByPublicUrl('boulder-photos', problem.photo_url);
    } catch (e) {
      console.warn('Photo delete failed (continuing):', e);
    }
  }

  // 2) Delete problem row
  const { error } = await supabase.from('problems').delete().eq('id', problem.id);
  if (error) throw error;
}







// All attempt stats, grouped per problem
export async function getProblemStats(): Promise<
  Record<string, ProblemStats>
> {
  const { data, error } = await supabase
    .from('attempts')
    .select('problem_id, outcome, created_at');

  if (error) {
    console.error('Error loading attempt stats', error);
    throw error;
  }

  const stats: Record<string, ProblemStats & { lastCreatedAt?: string }> = {};

  (data ?? []).forEach((row: any) => {
    const pid = row.problem_id as string;
    const outcome = row.outcome as Outcome;
    const createdAt = row.created_at as string;

    if (!stats[pid]) {
      stats[pid] = {
        attempts: 0,
        lastOutcome: null,
        lastCreatedAt: createdAt,
      };
    }

    stats[pid].attempts += 1;

    if (!stats[pid].lastCreatedAt || createdAt > stats[pid].lastCreatedAt!) {
      stats[pid].lastOutcome = outcome;
      stats[pid].lastCreatedAt = createdAt;
    }
  });

  const result: Record<string, ProblemStats> = {};
  Object.entries(stats).forEach(([pid, value]) => {
    result[pid] = {
      attempts: value.attempts,
      lastOutcome: value.lastOutcome,
    };
  });

  return result;
}

// ---- Gyms & Grades ----

export async function getGymsAndGrades(): Promise<{
  gyms: GymRow[];
  gradesByGym: Record<string, GymGradeRow[]>;
}> {
  const [{ data: gymsData, error: gymsError }, { data: gradesData, error: gradesError }] =
    await Promise.all([
      supabase
        .from('gyms')
        .select('*')
        .order('created_at', { ascending: true }),
      supabase
        .from('gym_grades')
        .select('*')
        .order('sort_order', { ascending: true }),
    ]);

  if (gymsError) throw gymsError;
  if (gradesError) throw gradesError;

  const gyms = (gymsData ?? []) as GymRow[];
  const grades = (gradesData ?? []) as GymGradeRow[];

  const gradesByGym: Record<string, GymGradeRow[]> = {};
  for (const g of grades) {
    if (!gradesByGym[g.gym_id]) gradesByGym[g.gym_id] = [];
    gradesByGym[g.gym_id].push(g);
  }

  return { gyms, gradesByGym };
}

export async function createGym(name: string): Promise<GymRow> {
  const { data, error } = await supabase
    .from('gyms')
    .insert({ name })
    .select('*')
    .single();

  if (error) throw error;
  return data as GymRow;
}

export async function setHomeGym(gymId: string) {
  // First unset home on all, then set on this gym
  const { error: clearError } = await supabase
    .from('gyms')
    .update({ is_home: false })
    .neq('id', gymId);
  if (clearError) throw clearError;

  const { error: setError } = await supabase
    .from('gyms')
    .update({ is_home: true })
    .eq('id', gymId);

  if (setError) throw setError;
}

export async function updateGymGradingMode(
  gymId: string,
  mode: 'specific' | 'ranges'
) {
  const { error } = await supabase
    .from('gyms')
    .update({ grading_mode: mode })
    .eq('id', gymId);

  if (error) throw error;
}

export async function createGymGrade(
  gymId: string,
  name: string,
  color: string
): Promise<GymGradeRow> {
  const { data, error } = await supabase
    .from('gym_grades')
    .insert({ gym_id: gymId, name, color })
    .select('*')
    .single();

  if (error) throw error;
  return data as GymGradeRow;
}

export async function updateGymGrade(
  gradeId: string,
  name: string,
  color: string
): Promise<GymGradeRow> {
  const { data, error } = await supabase
    .from('gym_grades')
    .update({ name, color })
    .eq('id', gradeId)
    .select('*')
    .single();

  if (error) throw error;
  return data as GymGradeRow;
}

export async function deleteGymGrade(gradeId: string) {
  const { error } = await supabase
    .from('gym_grades')
    .delete()
    .eq('id', gradeId);

  if (error) throw error;
}

// Convenience: get home gym + its grades
export async function getHomeGymWithGrades(): Promise<{
  gym: GymRow | null;
  grades: GymGradeRow[];
}> {
  const { data: gymsData, error: gymsError } = await supabase
    .from('gyms')
    .select('*')
    .eq('is_home', true)
    .maybeSingle();

  if (gymsError && gymsError.code !== 'PGRST116') {
    throw gymsError;
  }

  const gym = (gymsData ?? null) as GymRow | null;

  if (!gym) {
    return { gym: null, grades: [] };
  }

  const { data: gradesData, error: gradesError } = await supabase
    .from('gym_grades')
    .select('*')
    .eq('gym_id', gym.id)
    .order('sort_order', { ascending: true });

  if (gradesError) throw gradesError;

  return {
    gym,
    grades: (gradesData ?? []) as GymGradeRow[],
  };
}


// ---- Images / Storage ----

export async function uploadImageToBucket(
  bucket: string,
  file: File,
  pathPrefix: string
): Promise<string> {
  const ext = file.name.split('.').pop() || 'jpg';
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filePath = `${pathPrefix}/${unique}.${ext}`;

  const { error: uploadError } = await supabase
    .storage
    .from(bucket)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export function storagePathFromPublicUrl(bucket: string, publicUrl: string) {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export async function deleteImageByPublicUrl(bucket: string, publicUrl: string) {
  const path = storagePathFromPublicUrl(bucket, publicUrl);
  if (!path) return;

  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
}


