"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function overrideWrittenScore(
  attemptId: string,
  answerId: string,
  newPointsAwarded: number,
  adminNotes?: string
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  // Verify caller is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") return { success: false, error: "Unauthorized" };

  const adminClient = createAdminClient();

  // 1. Get answer & question max points
  const { data: answer, error: ansError } = await adminClient
    .from("answers")
    .select("*, questions(points, exam_id)")
    .eq("id", answerId)
    .single();

  if (ansError || !answer) {
    return { success: false, error: "Answer not found." };
  }

  const maxPoints = answer.questions?.points || 1;
  const clampedPoints = Math.max(0, Math.min(maxPoints, newPointsAwarded));
  const examId = answer.questions?.exam_id;

  // 2. Update answer record
  const updatePayload: any = {
    points_awarded: clampedPoints,
    is_correct: clampedPoints >= maxPoints / 2,
  };
  if (adminNotes) {
    updatePayload.ai_feedback = `${answer.ai_feedback || ""}\n\n[Instructor Override Notes]: ${adminNotes}`.trim();
  }

  const { error: updateError } = await adminClient
    .from("answers")
    .update(updatePayload)
    .eq("id", answerId);

  if (updateError) {
    // Fallback if ai_feedback is not migrated
    await adminClient
      .from("answers")
      .update({
        points_awarded: clampedPoints,
        is_correct: clampedPoints >= maxPoints / 2,
      })
      .eq("id", answerId);
  }

  // 3. Recalculate Attempt total score & percentage
  const { data: allAnswers } = await adminClient
    .from("answers")
    .select("points_awarded")
    .eq("attempt_id", attemptId);

  const { data: allQuestions } = await adminClient
    .from("questions")
    .select("points")
    .eq("exam_id", examId);

  const totalScore = (allAnswers as any[])?.reduce((sum: number, a: any) => sum + (a.points_awarded || 0), 0) || 0;
  const maxPossible = (allQuestions as any[])?.reduce((sum: number, q: any) => sum + (q.points || 0), 0) || 1;
  const percentage = Math.round((totalScore / maxPossible) * 1000) / 10;

  const { data: exam } = await adminClient
    .from("exams")
    .select("pass_mark")
    .eq("id", examId)
    .single();

  const passed = percentage >= (exam?.pass_mark || 50);

  await adminClient
    .from("attempts")
    .update({
      score: Math.round(totalScore * 10) / 10,
      percentage: percentage,
      passed: passed,
    })
    .eq("id", attemptId);

  revalidatePath(`/admin/exams/${examId}`);
  revalidatePath(`/exam/${examId}/results`);

  return { success: true, newTotalScore: totalScore, newPercentage: percentage };
}
