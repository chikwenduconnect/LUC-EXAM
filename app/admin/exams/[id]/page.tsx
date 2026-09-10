import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExamControls } from "@/components/admin/exam-controls";
import { EditExamDetails } from "@/components/admin/edit-exam-details";
import { ExamTabsView } from "@/components/admin/exam-tabs-view";
import { getExamRoster } from "@/app/actions/roster";
import { getExamConfig } from "@/lib/roster-service";
import Link from "next/link";
import { ArrowLeft, PlayCircle, Lock, Unlock, Users } from "lucide-react";

export default async function AdminExamDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  const supabase = await createClient();

  const { data: rawExam, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();

  if (error || !rawExam) {
    notFound();
  }

  const config = await getExamConfig(examId, rawExam);
  const exam = {
    ...rawExam,
    access_code: config.access_code,
    roster_only: config.roster_only,
  };

  // Fetch Questions
  const { data: questions } = await supabase
    .from("questions")
    .select("*, options(*)")
    .eq("exam_id", examId)
    .order("question_order", { ascending: true });

  // Fetch Candidate Roster
  const roster = await getExamRoster(examId);

  // Fetch all registered students for enrollment modal safely (id, name, email)
  const { data: studentsData } = await supabase
    .from("profiles")
    .select("id, name, email")
    .eq("role", "student")
    .order("name", { ascending: true });

  const allStudents = (studentsData || []).map((s: any) => ({
    ...s,
    programme: null,
  }));

  // Compute total points
  const totalPoints = questions?.reduce((sum, q) => sum + q.points, 0) || 0;

  // Fetch written grading entries (submitted attempts with written answers)
  const hasWrittenQuestions = questions?.some((q: any) => q.question_type === 'WRITTEN');
  let writtenGradingEntries: any[] = [];

  if (hasWrittenQuestions) {
    // Get correct_answers for rubric and model answer
    const { data: correctAnswers } = await supabase
      .from("correct_answers")
      .select("*");

    const correctMap = new Map();
    for (const ca of correctAnswers || []) {
      let rubric = (ca as any).rubric || "";
      let modelAnswer = ca.model_answer || "";
      if (!rubric && ca.model_answer) {
        try {
          const parsed = JSON.parse(ca.model_answer);
          if (parsed.rubric) {
            rubric = parsed.rubric;
            modelAnswer = parsed.modelAnswer || "";
          }
        } catch {}
      }
      correctMap.set(ca.question_id, { rubric, modelAnswer });
    }

    // Get all submitted attempts for this exam
    const { data: attempts } = await supabase
      .from("attempts")
      .select("id, user_id, status, profiles(id, name, email)")
      .eq("exam_id", examId)
      .eq("status", "SUBMITTED");

    for (const attempt of attempts || []) {
      // Try fetching with ai_feedback and rubric_breakdown
      let { data: writtenAnswers, error: fetchErr } = await supabase
        .from("answers")
        .select("id, question_id, written_answer, is_correct, points_awarded, ai_feedback, rubric_breakdown, questions(id, question_text, points, question_type)")
        .eq("attempt_id", attempt.id)
        .eq("questions.question_type", "WRITTEN");

      // Fallback if ai_feedback column migration is pending
      if (fetchErr) {
        const { data: fallbackAnswers } = await supabase
          .from("answers")
          .select("id, question_id, written_answer, is_correct, points_awarded, questions(id, question_text, points, question_type)")
          .eq("attempt_id", attempt.id)
          .eq("questions.question_type", "WRITTEN");
        writtenAnswers = fallbackAnswers as any;
      }

      if (writtenAnswers && writtenAnswers.length > 0) {
        const profile = (attempt as any).profiles;
        writtenGradingEntries.push({
          attemptId: attempt.id,
          userId: attempt.user_id,
          userName: profile?.name || "Unknown",
          userEmail: profile?.email || "",
          answers: writtenAnswers.map((a: any) => {
            const ref = correctMap.get(a.question_id) || {};
            return {
              answerId: a.id,
              questionId: a.question_id,
              questionText: a.questions?.question_text || "",
              points: a.questions?.points || 0,
              writtenAnswer: a.written_answer || "",
              isCorrect: a.is_correct,
              pointsAwarded: a.points_awarded,
              rubric: ref.rubric || "",
              modelAnswer: ref.modelAnswer || "",
              aiFeedback: a.ai_feedback || null,
              rubricBreakdown: a.rubric_breakdown || null,
            };
          }),
        });
      }
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-24">
      <div className="mb-6">
        <Link href="/admin/exams" className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Exams
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-1">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{exam.title}</h1>
              <Badge variant={exam.status === 'LIVE' ? 'default' : 'secondary'}>{exam.status}</Badge>
              {exam.roster_only && (
                <Badge variant="outline" className="border-amber-400 text-amber-800 bg-amber-50">
                  <Lock className="h-3 w-3 mr-1 text-amber-600" /> Strict Roster
                </Badge>
              )}
            </div>
            <p className="text-gray-500">
              {exam.programme || 'General Assessment'} • {exam.duration_minutes} Minutes • {questions?.length || 0} Questions • {roster.length} Enrolled
              {exam.access_code ? ` • PIN: ${exam.access_code}` : ''}
            </p>
          </div>
          
          <ExamControls examId={exam.id} currentStatus={exam.status} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Main Content (Tabs: Questions & Candidate Roster) */}
        <div className="md:col-span-2">
          <ExamTabsView 
            exam={exam}
            questions={questions || []}
            roster={roster}
            allStudents={allStudents || []}
            writtenGradingEntries={writtenGradingEntries}
          />
        </div>

        {/* Sidebar (Details & Access Control) */}
        <div className="space-y-6">
          {/* Candidate Access Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-700" />
                  Candidate Access
                </CardTitle>
                <Badge variant={exam.roster_only ? "default" : "secondary"} className="text-[11px]">
                  {exam.roster_only ? "Strict Roster" : "Open Programme"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-slate-600 pt-0">
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Enrolled Candidates:</span>
                <span className="font-bold text-slate-900">{roster.length}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-slate-100">
                <span>Access Security:</span>
                <span className="font-medium text-slate-900 flex items-center gap-1">
                  {exam.roster_only ? (
                    <>
                      <Lock className="h-3 w-3 text-amber-600" /> Enrolled only
                    </>
                  ) : (
                    <>
                      <Unlock className="h-3 w-3 text-slate-400" /> Programme-wide
                    </>
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                {exam.roster_only 
                  ? "Only candidates assigned to this exam's roster can view or take this test."
                  : "Any student with a matching programme code can take this test once live."}
              </p>
            </CardContent>
          </Card>

          {/* Exam Details Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Exam Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <span className="text-gray-500 block mb-1">Pass Mark</span>
                <span className="font-medium">{exam.pass_mark}%</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Total Points</span>
                <span className="font-medium">{totalPoints}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Programme</span>
                <span className="font-medium">{exam.programme || 'Not specified'}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Result Mode</span>
                <span className="font-medium capitalize">{exam.result_release_mode.toLowerCase()}</span>
              </div>
              <div>
                <span className="text-gray-500 block mb-1">Instructions</span>
                <p className="text-gray-900 line-clamp-3">{exam.instructions || "None provided"}</p>
              </div>
              
              {exam.status === 'DRAFT' && (
                <EditExamDetails exam={exam} />
              )}
            </CardContent>
          </Card>
          
          {exam.status === 'LIVE' && (
            <Card className="border-indigo-200 bg-indigo-50/50">
              <CardContent className="p-6">
                <h3 className="font-bold text-indigo-900 mb-2">Live Control Room</h3>
                <p className="text-sm text-indigo-700 mb-4">Monitor active participants and track exam progress in real-time.</p>
                <Button className="w-full" asChild>
                  <Link href={`/admin/exams/${exam.id}/control-room`}>
                    <PlayCircle className="h-4 w-4 mr-2" /> Open Control Room
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
