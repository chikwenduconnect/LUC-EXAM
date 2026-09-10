import { createClient } from "@/lib/supabase/server";
import { getExamConfig, isCandidateEnrolled } from "@/lib/roster-service";
import { notFound, redirect } from "next/navigation";
import { startAttempt } from "@/app/actions/participant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Clock, HelpCircle, CheckCircle2, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { StartExamForm } from "@/components/student/start-exam-form";

export default async function ExamInstructionsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: rawExam, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();

  if (error || !rawExam || (rawExam.status !== 'LIVE' && rawExam.status !== 'ENDED')) {
    notFound();
  }

  const examConfig = await getExamConfig(examId, rawExam);
  const exam = {
    ...rawExam,
    access_code: examConfig.access_code,
    roster_only: examConfig.roster_only,
  };

  const { count: questionCount } = await supabase
    .from("questions")
    .select("*", { count: 'exact', head: true })
    .eq("exam_id", examId);

  // Check if attempt exists
  const { data: attempt } = await supabase
    .from("attempts")
    .select("status")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  if (attempt?.status === 'SUBMITTED') {
    redirect(`/exam/${examId}/results`);
  }

  // Verify candidate roster enrollment if strict access is required
  let isEnrolledOnRoster = true;
  if (exam.roster_only) {
    isEnrolledOnRoster = await isCandidateEnrolled(examId, user.id);
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 uppercase">{exam.title}</h1>
          <p className="text-gray-500 mt-2">{exam.programme}</p>
        </div>

        <Card className="shadow-lg border-gray-200">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 pb-8">
            <div className="flex flex-col sm:flex-row justify-center gap-8 mt-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <HelpCircle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Questions</p>
                  <p className="text-xl font-bold text-gray-900">{questionCount || 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Duration</p>
                  <p className="text-xl font-bold text-gray-900">{exam.duration_minutes} Min</p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-8 px-8 prose prose-slate max-w-none">
            {exam.roster_only && isEnrolledOnRoster && (
              <div className="not-prose p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2 mb-6">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span><strong>Verified Candidate:</strong> You are confirmed on the official candidate roster for this examination.</span>
              </div>
            )}

            {!isEnrolledOnRoster && (
              <div className="not-prose p-4 bg-amber-50 border border-amber-300 rounded-lg text-xs text-amber-900 flex items-start gap-3 mb-6">
                <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-amber-950 text-sm mb-1">Access Restricted: Not on Candidate Roster</h4>
                  <p>
                    This examination requires explicit student roster enrollment. Your account is not currently registered for this test.
                    If you are supposed to take this assessment, please contact your invigilator or course administrator immediately.
                  </p>
                </div>
              </div>
            )}

            <h3 className="text-lg font-semibold text-gray-900 mb-4">Before starting:</h3>
            <div className="whitespace-pre-wrap text-gray-600">
              {exam.instructions || "• Read every question carefully.\n• Your answers are automatically saved.\n• You cannot restart a submitted exam.\n• Do not refresh the page unnecessarily."}
            </div>
          </CardContent>
          <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <Button variant="ghost" asChild className="w-full sm:w-auto">
              <Link href="/">Cancel</Link>
            </Button>
            
            {isEnrolledOnRoster ? (
              <StartExamForm 
                examId={exam.id} 
                requiredAccessCode={exam.access_code} 
                isResuming={attempt?.status === 'IN_PROGRESS'} 
              />
            ) : (
              <Button disabled variant="outline" className="text-slate-400 cursor-not-allowed">
                Enrollment Required
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
