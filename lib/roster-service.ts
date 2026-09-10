import { createAdminClient } from "./supabase/server";

export interface RosterCandidate {
  id: string;
  user_id: string;
  exam_id: string;
  enrolled_at: string;
  profile: {
    id: string;
    name: string;
    email: string;
    programme: string | null;
  };
  attempt?: {
    id: string;
    status: "IN_PROGRESS" | "SUBMITTED" | "ABANDONED";
    score: number | null;
    percentage: number | null;
    started_at: string;
    submitted_at: string | null;
  } | null;
}

export interface ExamConfig {
  access_code: string | null;
  roster_only: boolean;
}

// Track table/column capabilities discovered at runtime
let _hasExamRosterTable: boolean | null = null;
let _hasExamRosterOnlyCol: boolean | null = null;
let _hasExamAccessCodeCol: boolean | null = null;

/**
 * Check if the dedicated public.exam_roster table exists in the schema cache
 */
async function hasExamRosterTable(): Promise<boolean> {
  if (_hasExamRosterTable !== null) return _hasExamRosterTable;
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("exam_roster").select("id").limit(1);
    if (!error) {
      _hasExamRosterTable = true;
      return true;
    }
    // PGRST205 / PGRST200 or message contains table not found
    _hasExamRosterTable = false;
    return false;
  } catch {
    _hasExamRosterTable = false;
    return false;
  }
}

/**
 * Check if exams table has columns roster_only and access_code
 */
async function checkExamColumns(): Promise<{ hasRosterOnly: boolean; hasAccessCode: boolean }> {
  // Return cached result if already determined
  if (_hasExamRosterOnlyCol !== null && _hasExamAccessCodeCol !== null) {
    return { hasRosterOnly: _hasExamRosterOnlyCol, hasAccessCode: _hasExamAccessCodeCol };
  }
  
  // Default to false since the standard exams schema stores these in activity_logs
  _hasExamRosterOnlyCol = false;
  _hasExamAccessCodeCol = false;
  return { hasRosterOnly: false, hasAccessCode: false };
}

/**
 * Get exam settings (access_code, roster_only) with fallback to activity_logs
 */
export async function getExamConfig(examId: string, examRecord?: any): Promise<ExamConfig> {
  // If provided exam record already has the columns populated
  if (examRecord && (examRecord.roster_only !== undefined || examRecord.access_code !== undefined)) {
    if (examRecord.roster_only !== null && examRecord.access_code !== null) {
      return {
        access_code: examRecord.access_code || null,
        roster_only: Boolean(examRecord.roster_only),
      };
    }
  }

  const supabase = createAdminClient();

  // Try reading from activity_logs where event_type = 'EXAM_CONFIG'
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("metadata, created_at")
    .eq("event_type", "EXAM_CONFIG")
    .contains("metadata", { exam_id: examId })
    .order("created_at", { ascending: false })
    .limit(1);

  if (logs && logs.length > 0 && logs[0].metadata) {
    const meta = logs[0].metadata as any;
    return {
      access_code: meta.access_code || examRecord?.access_code || null,
      roster_only: meta.roster_only !== undefined ? Boolean(meta.roster_only) : Boolean(examRecord?.roster_only),
    };
  }

  return {
    access_code: examRecord?.access_code || null,
    roster_only: Boolean(examRecord?.roster_only),
  };
}

/**
 * Save exam config (access_code, roster_only) safely
 */
export async function saveExamConfig(examId: string, config: { access_code?: string | null; roster_only?: boolean }) {
  const supabase = createAdminClient();
  const { hasRosterOnly, hasAccessCode } = await checkExamColumns();

  // If columns exist on exams table, update them
  if (hasRosterOnly || hasAccessCode) {
    const updatePayload: Record<string, any> = {};
    if (hasRosterOnly && config.roster_only !== undefined) {
      updatePayload.roster_only = config.roster_only;
    }
    if (hasAccessCode && config.access_code !== undefined) {
      updatePayload.access_code = config.access_code || null;
    }

    if (Object.keys(updatePayload).length > 0) {
      await supabase.from("exams").update(updatePayload).eq("id", examId);
    }
  }

  // Always write to activity_logs as resilient store
  await supabase.from("activity_logs").insert({
    event_type: "EXAM_CONFIG",
    metadata: {
      exam_id: examId,
      access_code: config.access_code || null,
      roster_only: Boolean(config.roster_only),
      updated_at: new Date().toISOString(),
    },
  });
}

/**
 * Fetch roster candidates for an exam
 */
export async function getExamRoster(examId: string): Promise<RosterCandidate[]> {
  const supabase = createAdminClient();
  const hasTable = await hasExamRosterTable();

  let rosterEntries: { id: string; user_id: string; exam_id: string; enrolled_at: string }[] = [];

  if (hasTable) {
    const { data, error } = await supabase
      .from("exam_roster")
      .select("id, user_id, exam_id, enrolled_at")
      .eq("exam_id", examId)
      .order("enrolled_at", { ascending: false });

    if (!error && data) {
      rosterEntries = data;
    }
  }

  // If no table or table empty, check activity_logs
  if (rosterEntries.length === 0) {
    const { data: logs } = await supabase
      .from("activity_logs")
      .select("id, user_id, metadata, created_at")
      .eq("event_type", "EXAM_ROSTER")
      .contains("metadata", { exam_id: examId })
      .order("created_at", { ascending: false });

    if (logs && logs.length > 0) {
      const seenUsers = new Set<string>();
      for (const log of logs) {
        const uId = log.user_id || (log.metadata as any)?.user_id;
        if (uId && !seenUsers.has(uId)) {
          seenUsers.add(uId);
          rosterEntries.push({
            id: log.id,
            user_id: uId,
            exam_id: examId,
            enrolled_at: (log.metadata as any)?.enrolled_at || log.created_at,
          });
        }
      }
    }
  }

  if (rosterEntries.length === 0) {
    return [];
  }

  // Fetch profiles safely (only existing columns: id, name, email)
  const userIds = rosterEntries.map((r) => r.user_id);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, name, email")
    .in("id", userIds);

  const profileMap = new Map<string, any>();
  if (profiles) {
    for (const p of profiles) {
      profileMap.set(p.id, {
        id: p.id,
        name: p.name,
        email: p.email,
        programme: null,
      });
    }
  }

  // Fetch student programmes from activity_logs if present
  const { data: programmeLogs } = await supabase
    .from("activity_logs")
    .select("user_id, metadata")
    .eq("event_type", "STUDENT_PROGRAMME")
    .in("user_id", userIds);

  if (programmeLogs) {
    for (const pl of programmeLogs) {
      const prof = profileMap.get(pl.user_id);
      if (prof && (pl.metadata as any)?.programme) {
        prof.programme = (pl.metadata as any).programme;
      }
    }
  }

  // Fetch exam attempts to show progress
  const { data: attempts } = await supabase
    .from("attempts")
    .select("id, user_id, status, score, percentage, started_at, submitted_at")
    .eq("exam_id", examId)
    .in("user_id", userIds);

  const attemptMap = new Map<string, any>();
  if (attempts) {
    for (const att of attempts) {
      attemptMap.set(att.user_id, att);
    }
  }

  return rosterEntries.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    exam_id: r.exam_id,
    enrolled_at: r.enrolled_at,
    profile: profileMap.get(r.user_id) || {
      id: r.user_id,
      name: "Unknown Candidate",
      email: "",
      programme: null,
    },
    attempt: attemptMap.get(r.user_id) || null,
  }));
}

/**
 * Enroll candidates into an exam
 */
export async function enrollCandidates(examId: string, userIds: string[]) {
  if (!userIds || userIds.length === 0) {
    return { success: true, count: 0, message: "No candidates selected." };
  }

  const supabase = createAdminClient();
  const hasTable = await hasExamRosterTable();

  if (hasTable) {
    const records = userIds.map((userId) => ({
      exam_id: examId,
      user_id: userId,
    }));
    await supabase.from("exam_roster").upsert(records, { onConflict: "exam_id,user_id", ignoreDuplicates: true });
  }

  // Resilient persistence into activity_logs
  // First, find existing enrolled userIds in activity_logs to avoid duplicate logs
  const { data: existingLogs } = await supabase
    .from("activity_logs")
    .select("user_id, metadata")
    .eq("event_type", "EXAM_ROSTER")
    .contains("metadata", { exam_id: examId });

  const enrolledSet = new Set<string>();
  if (existingLogs) {
    for (const l of existingLogs) {
      const uId = l.user_id || (l.metadata as any)?.user_id;
      if (uId) enrolledSet.add(uId);
    }
  }

  const toInsert = userIds
    .filter((uId) => !enrolledSet.has(uId))
    .map((userId) => ({
      user_id: userId,
      event_type: "EXAM_ROSTER",
      metadata: {
        exam_id: examId,
        user_id: userId,
        enrolled_at: new Date().toISOString(),
      },
    }));

  if (toInsert.length > 0) {
    await supabase.from("activity_logs").insert(toInsert);
  }

  return {
    success: true,
    count: userIds.length,
    message: `Successfully enrolled ${userIds.length} candidate(s).`,
  };
}

/**
 * Unenroll candidate
 */
export async function unenrollCandidate(examId: string, userId: string) {
  const supabase = createAdminClient();
  const hasTable = await hasExamRosterTable();

  if (hasTable) {
    await supabase.from("exam_roster").delete().eq("exam_id", examId).eq("user_id", userId);
  }

  // Remove from activity_logs
  await supabase
    .from("activity_logs")
    .delete()
    .eq("event_type", "EXAM_ROSTER")
    .eq("user_id", userId)
    .contains("metadata", { exam_id: examId });

  return { success: true };
}

/**
 * Get all exam IDs a student is enrolled in
 */
export async function getStudentEnrolledExamIds(userId: string): Promise<Set<string>> {
  const supabase = createAdminClient();
  const enrolledIds = new Set<string>();

  const hasTable = await hasExamRosterTable();
  if (hasTable) {
    const { data } = await supabase.from("exam_roster").select("exam_id").eq("user_id", userId);
    if (data) {
      for (const r of data) {
        if (r.exam_id) enrolledIds.add(r.exam_id);
      }
    }
  }

  // Also query activity_logs
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("metadata")
    .eq("event_type", "EXAM_ROSTER")
    .eq("user_id", userId);

  if (logs) {
    for (const l of logs) {
      const exId = (l.metadata as any)?.exam_id;
      if (exId) enrolledIds.add(exId);
    }
  }

  return enrolledIds;
}

/**
 * Check if candidate is enrolled for an exam
 */
export async function isCandidateEnrolled(examId: string, userId: string): Promise<boolean> {
  const enrolled = await getStudentEnrolledExamIds(userId);
  return enrolled.has(examId);
}

/**
 * Get all students for the admin participant directory with their enrolled exam badges
 */
export async function getParticipantsWithRosters() {
  const supabase = createAdminClient();

  // 1. Fetch profiles safely (id, name, email, role, created_at)
  const { data: users, error } = await supabase
    .from("profiles")
    .select("id, name, email, role, created_at")
    .eq("role", "student")
    .order("created_at", { ascending: false });

  if (error || !users) return [];

  // 2. Fetch all exams to get title and status
  const { data: exams } = await supabase.from("exams").select("id, title, status");
  const examMap = new Map<string, any>();
  if (exams) {
    for (const ex of exams) {
      examMap.set(ex.id, ex);
    }
  }

  // 3. Fetch all roster entries from activity_logs & exam_roster
  const userExamMap = new Map<string, Set<string>>();

  const hasTable = await hasExamRosterTable();
  if (hasTable) {
    const { data: rosterData } = await supabase.from("exam_roster").select("exam_id, user_id");
    if (rosterData) {
      for (const r of rosterData) {
        if (!userExamMap.has(r.user_id)) userExamMap.set(r.user_id, new Set());
        userExamMap.get(r.user_id)!.add(r.exam_id);
      }
    }
  }

  const { data: logs } = await supabase
    .from("activity_logs")
    .select("user_id, metadata")
    .eq("event_type", "EXAM_ROSTER");

  if (logs) {
    for (const l of logs) {
      const uId = l.user_id || (l.metadata as any)?.user_id;
      const exId = (l.metadata as any)?.exam_id;
      if (uId && exId) {
        if (!userExamMap.has(uId)) userExamMap.set(uId, new Set());
        userExamMap.get(uId)!.add(exId);
      }
    }
  }

  // 4. Fetch student programmes from activity_logs if present
  const { data: progLogs } = await supabase
    .from("activity_logs")
    .select("user_id, metadata")
    .eq("event_type", "STUDENT_PROGRAMME");

  const progMap = new Map<string, string>();
  if (progLogs) {
    for (const pl of progLogs) {
      if (pl.user_id && (pl.metadata as any)?.programme) {
        progMap.set(pl.user_id, (pl.metadata as any).programme);
      }
    }
  }

  return (users as any[]).map((user: any) => {
    const enrolledExamIds = userExamMap.get(user.id) || new Set<string>();
    const enrolledExams = Array.from(enrolledExamIds)
      .map((eId) => examMap.get(eId))
      .filter(Boolean);

    return {
      ...user,
      programme: progMap.get(user.id) || null,
      enrolledExams,
    };
  });
}
