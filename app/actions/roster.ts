"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import {
  getExamRoster as serviceGetExamRoster,
  enrollCandidates as serviceEnrollCandidates,
  unenrollCandidate as serviceUnenrollCandidate,
  saveExamConfig,
  getExamConfig,
  type RosterCandidate,
} from "@/lib/roster-service";

export type { RosterCandidate };

/**
 * Fetch all students currently enrolled in an exam's roster,
 * along with their profile information and real-time attempt status.
 */
export async function getExamRoster(examId: string): Promise<RosterCandidate[]> {
  try {
    return await serviceGetExamRoster(examId);
  } catch (err: any) {
    console.warn("Notice in getExamRoster:", err?.message || err);
    return [];
  }
}

/**
 * Enroll candidate user IDs into an exam
 */
export async function enrollCandidates(examId: string, userIds: string[]) {
  if (!userIds || userIds.length === 0) {
    return { success: true, count: 0, message: "No candidates selected." };
  }

  const result = await serviceEnrollCandidates(examId, userIds);

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/");
  return result;
}

/**
 * Bulk enroll all students belonging to a specific programme
 */
export async function enrollByProgramme(examId: string, programme: string) {
  if (!programme || !programme.trim()) {
    throw new Error("Programme name is required");
  }

  const supabase = createAdminClient();
  const searchProgramme = programme.trim().toLowerCase();

  // 1. Fetch all student profiles safely
  const { data: students, error: findError } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("role", "student");

  if (findError) throw new Error(findError.message);
  if (!students || students.length === 0) {
    return { success: true, count: 0, message: "No registered students found in the system." };
  }

  // 2. Check student programmes in activity_logs
  const { data: progLogs } = await supabase
    .from("activity_logs")
    .select("user_id, metadata")
    .eq("event_type", "STUDENT_PROGRAMME");

  const matchingUserIds = new Set<string>();

  if (progLogs) {
    for (const log of progLogs) {
      const p = (log.metadata as any)?.programme;
      if (p && typeof p === "string" && p.toLowerCase().includes(searchProgramme)) {
        matchingUserIds.add(log.user_id);
      }
    }
  }

  // If no specific programme logs were found, check if programme matches student name/email convention or enroll all students in that programme
  const finalUserIds = Array.from(matchingUserIds);

  if (finalUserIds.length === 0) {
    // If no programme metadata matched yet, return informative message
    return {
      success: false,
      count: 0,
      message: `No students explicitly mapped to programme "${programme}". Please select students manually or enroll by email.`,
    };
  }

  return await enrollCandidates(examId, finalUserIds);
}

/**
 * Enroll students by a list of emails (comma, newline, or space separated)
 */
export async function enrollByEmails(examId: string, rawEmails: string) {
  const emails = rawEmails
    .split(/[\n,; ]+/)
    .map((e: string) => e.trim().toLowerCase())
    .filter((e: string) => e.length > 0);

  if (emails.length === 0) {
    throw new Error("Please enter at least one valid email address.");
  }

  const supabase = createAdminClient();

  // Find students with these emails (only existing columns: id, email)
  const { data: matchedProfiles, error: fetchError } = await supabase
    .from("profiles")
    .select("id, email")
    .in("email", emails);

  if (fetchError) throw new Error(fetchError.message);

  const matchedEmails = new Set(((matchedProfiles as any[]) || []).map((p: any) => p.email.toLowerCase()));
  const missingEmails = emails.filter((e: string) => !matchedEmails.has(e));

  if (!matchedProfiles || matchedProfiles.length === 0) {
    return {
      success: false,
      count: 0,
      missingEmails,
      message: "No registered students found matching the provided emails.",
    };
  }

  const userIds = (matchedProfiles as any[]).map((p: any) => p.id);
  await enrollCandidates(examId, userIds);

  return {
    success: true,
    count: userIds.length,
    missingEmails,
    message: `Enrolled ${userIds.length} candidate(s)${missingEmails.length > 0 ? ` (${missingEmails.length} email(s) not registered yet)` : ""}.`,
  };
}

/**
 * Remove a student from the exam roster
 */
export async function unenrollCandidate(examId: string, userId: string) {
  await serviceUnenrollCandidate(examId, userId);

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/");
  return { success: true };
}

/**
 * Toggle whether an exam is strictly restricted to enrolled roster candidates
 */
export async function toggleExamRosterOnly(examId: string, rosterOnly: boolean) {
  const currentConfig = await getExamConfig(examId);
  await saveExamConfig(examId, {
    access_code: currentConfig.access_code,
    roster_only: rosterOnly,
  });

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/");
  return { success: true };
}

/**
 * Save exam access code and roster enforcement configuration safely
 */
export async function updateExamConfigAction(examId: string, config: { access_code?: string | null; roster_only?: boolean }) {
  await saveExamConfig(examId, config);
  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath("/");
  return { success: true };
}
