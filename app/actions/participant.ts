"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getExamConfig, isCandidateEnrolled } from "@/lib/roster-service";
import { evaluateWrittenAnswer } from "@/lib/ai-grading";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createParticipantManually(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "Unauthorized" };

  // Verify caller is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== 'admin') return { success: false, error: "Unauthorized" };

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = (formData.get('password') as string) || 'Student123!';
  const programme = formData.get('programme') as string;
  const examId = formData.get('exam_id') as string;

  if (!name || !email) {
    return { success: false, error: "Name and Email are required." };
  }

  const adminClient = createAdminClient();

  try {
    // 1. Create Auth User
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true, // auto-confirm
      user_metadata: { name: name }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return { success: false, error: "A user with this email already exists." };
      }
      return { success: false, error: authError.message };
    }

    const newUserId = authUser.user.id;

    // 2. Create Profile Record
    const { error: profileError } = await adminClient
      .from("profiles")
      .upsert({
        id: newUserId,
        name: name,
        email: email,
        programme: programme || null,
        role: 'student'
      });

    if (profileError) {
      return { success: false, error: "Failed to create profile: " + profileError.message };
    }

    // 3. Assign to Exam Roster if selected
    if (examId) {
      await adminClient
        .from("activity_logs")
        .insert({
          event_type: 'ROSTER_ENROLLMENT',
          user_id: newUserId,
          metadata: {
            exam_id: examId,
            enrolled_by: user.id,
            timestamp: new Date().toISOString()
          }
        });
    }

    revalidatePath('/admin/participants');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || "An unexpected error occurred." };
  }
}

export async function startAttempt(examId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify candidate eligibility if exam has strict roster access
  const examConfig = await getExamConfig(examId);

  if (examConfig.roster_only) {
    const enrolled = await isCandidateEnrolled(examId, user.id);

    if (!enrolled) {
      throw new Error("Access restricted: You are not on the enrolled candidate roster for this examination. Please contact your course coordinator or invigilator.");
    }
  }

  // Check if attempt exists
  const { data: existing } = await supabase
    .from("attempts")
    .select("id, status")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  if (existing) {
    if (existing.status === 'SUBMITTED') {
      redirect(`/exam/${examId}/results`);
    }
    return existing.id; // Resume
  }

  const { data: newAttempt, error } = await supabase
    .from("attempts")
    .insert([{ exam_id: examId, user_id: user.id, status: 'IN_PROGRESS' }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return newAttempt.id;
}

export async function saveAnswer(attemptId: string, questionId: string, optionId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status === "SUBMITTED") {
    throw new Error("Invalid or already completed attempt.");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("answers")
    .upsert({ 
      attempt_id: attemptId, 
      question_id: questionId, 
      selected_option_id: optionId,
      saved_at: new Date().toISOString()
    }, { 
      onConflict: 'attempt_id, question_id' 
    });

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function saveWrittenAnswer(attemptId: string, questionId: string, writtenAnswer: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: attempt } = await supabase
    .from("attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status === "SUBMITTED") {
    throw new Error("Invalid or already completed attempt.");
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("answers")
    .upsert({
      attempt_id: attemptId,
      question_id: questionId,
      written_answer: writtenAnswer,
      saved_at: new Date().toISOString()
    }, {
      onConflict: 'attempt_id, question_id'
    });

  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Log cheating attempt / proctoring security violation (e.g., tab switch, window blur)
 */
export async function logProctoringEvent(attemptId: string, eventType: string, details?: Record<string, any>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false };

  const adminClient = createAdminClient();
  await adminClient.from("activity_logs").insert({
    attempt_id: attemptId,
    user_id: user.id,
    event_type: eventType,
    metadata: {
      ...details,
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true };
}

export async function submitExam(attemptId: string, examId: string) {
  const supabase = await createClient();
  const adminClient = createAdminClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // 1. Fetch attempt and verify it belongs to user
  const { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status === 'SUBMITTED') {
    throw new Error("Invalid or already submitted attempt");
  }

  // 2. Fetch exam config
  const { data: exam } = await adminClient
    .from("exams")
    .select("pass_mark")
    .eq("id", examId)
    .single();

  // 3. Fetch all questions and correct answers for this exam
  const { data: questions } = await adminClient
    .from("questions")
    .select("id, points, question_type, question_text")
    .eq("exam_id", examId);

  const { data: correctAnswers } = await adminClient
    .from("correct_answers")
    .select("*");

  // 4. Fetch user's answers
  const { data: userAnswers } = await adminClient
    .from("answers")
    .select("id, question_id, selected_option_id, written_answer")
    .eq("attempt_id", attemptId);

  // 5. Calculate Score securely (MCQ Auto-Grading + AI Written Answer Evaluation)
  let totalScore = 0;
  let maxPossibleScore = 0;

  const correctMap = new Map(correctAnswers?.map((ca: any) => [ca.question_id, ca.correct_option_id]));
  const answersToUpdate: any[] = [];

  for (const q of (questions || [] as any[])) {
    maxPossibleScore += q.points;
    const userAnswer = userAnswers?.find((ua: any) => ua.question_id === q.id);

    if (q.question_type === 'WRITTEN') {
      const studentText = userAnswer?.written_answer || "";
      const ca = correctAnswers?.find((c: any) => c.question_id === q.id);

      let rubricText = (ca as any)?.rubric || "";
      let benchmarkAnswer = ca?.model_answer || "";
      if (!rubricText && ca?.model_answer) {
        try {
          const parsed = JSON.parse(ca.model_answer);
          if (parsed.rubric) {
            rubricText = parsed.rubric;
            benchmarkAnswer = parsed.modelAnswer || "";
          }
        } catch {
          // not JSON
        }
      }

      // Grade via Google Gemini AI
      const aiResult = await evaluateWrittenAnswer({
        questionText: q.question_text || "",
        rubric: rubricText,
        modelAnswer: benchmarkAnswer,
        maxPoints: q.points,
        studentAnswer: studentText
      });

      const awarded = aiResult.pointsAwarded;
      totalScore += awarded;

      if (userAnswer) {
        answersToUpdate.push({
          id: userAnswer.id,
          points_awarded: awarded,
          is_correct: awarded >= (q.points / 2),
          ai_feedback: aiResult.feedback,
          rubric_breakdown: aiResult.criteriaScores,
          is_written: true
        });
      }
      continue;
    }

    // MCQ Question Grading
    const correctOption = correctMap.get(q.id);
    let isCorrect = false;
    let pointsAwarded = 0;

    if (userAnswer && userAnswer.selected_option_id === correctOption) {
      isCorrect = true;
      pointsAwarded = q.points;
      totalScore += pointsAwarded;
    }

    if (userAnswer) {
      answersToUpdate.push({
        id: userAnswer.id,
        is_correct: isCorrect,
        points_awarded: pointsAwarded,
        is_written: false
      });
    }
  }

  const percentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;
  const passed = percentage >= (exam?.pass_mark || 50);

  // 6. Bulk update answers with correctness, points, and AI feedback
  for (const ans of answersToUpdate) {
    if (ans.is_written) {
      // Try writing with ai_feedback and rubric_breakdown
      const { error: updateErr } = await adminClient
        .from("answers")
        .update({
          is_correct: ans.is_correct,
          points_awarded: ans.points_awarded,
          ai_feedback: ans.ai_feedback,
          rubric_breakdown: ans.rubric_breakdown
        })
        .eq("id", ans.id);

      // Fallback if ai_feedback column is not yet migrated in Supabase
      if (updateErr) {
        await adminClient
          .from("answers")
          .update({
            is_correct: ans.is_correct,
            points_awarded: ans.points_awarded
          })
          .eq("id", ans.id);
      }
    } else {
      await adminClient
        .from("answers")
        .update({ is_correct: ans.is_correct, points_awarded: ans.points_awarded })
        .eq("id", ans.id);
    }
  }

  // 7. Mark attempt as submitted with final score and percentage
  await adminClient
    .from("attempts")
    .update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      score: Math.round(totalScore * 10) / 10,
      percentage: Math.round(percentage * 10) / 10,
      passed: passed
    })
    .eq("id", attemptId);

  revalidatePath(`/exam/${examId}/results`);
  redirect(`/exam/${examId}/results`);
}
