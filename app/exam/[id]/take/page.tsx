import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ExamInterface } from "@/components/student/exam-interface";

export default async function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Fetch Exam
  const { data: exam, error: examError } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();

  if (examError || !exam || exam.status !== 'LIVE') {
    notFound();
  }

  // Fetch Attempt
  const { data: attempt } = await supabase
    .from("attempts")
    .select("*")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  if (!attempt) {
    redirect(`/exam/${examId}/instructions`);
  }

  if (attempt.status === 'SUBMITTED') {
    redirect(`/exam/${examId}/results`);
  }

  // Fetch Questions & Options (RLS allows this for LIVE exams)
  const { data: questions } = await supabase
    .from("questions")
    .select("*, options(*)")
    .eq("exam_id", examId)
    .order("question_order", { ascending: true });

  // Fetch existing answers to populate state
  const { data: existingAnswers } = await supabase
    .from("answers")
    .select("question_id, selected_option_id, written_answer")
    .eq("attempt_id", attempt.id);

  const initialAnswers: Record<string, string> = {};
  const initialWrittenAnswers: Record<string, string> = {};

  for (const ans of existingAnswers || []) {
    if (ans.selected_option_id) {
      initialAnswers[ans.question_id] = ans.selected_option_id;
    }
    if (ans.written_answer) {
      initialWrittenAnswers[ans.question_id] = ans.written_answer;
    }
  }

  // Calculate remaining time safely based on server time (`started_at` + `duration`)
  const startedAt = new Date(attempt.started_at).getTime();
  const durationMs = exam.duration_minutes * 60 * 1000;
  const endTime = startedAt + durationMs;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <ExamInterface 
        exam={exam}
        attemptId={attempt.id}
        questions={questions || []}
        initialAnswers={initialAnswers}
        initialWrittenAnswers={initialWrittenAnswers}
        endTimeMs={endTime}
      />
    </div>
  );
}
