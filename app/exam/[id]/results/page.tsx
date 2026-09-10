import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home } from "lucide-react";
import Link from "next/link";

export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  // Fetch Attempt
  const { data: attempt } = await supabase
    .from("attempts")
    .select("*, exams(title, result_release_mode, pass_mark)")
    .eq("exam_id", examId)
    .eq("user_id", user.id)
    .single();

  if (!attempt || attempt.status !== 'SUBMITTED') {
    redirect(`/`);
  }

  const exam = attempt.exams;

  // Check if there are written questions pending manual grading
  const hasWrittenQuestions = attempt.percentage === null && attempt.score === null;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="text-center shadow-lg border-gray-200 overflow-hidden">
          <div className="h-2 w-full bg-slate-900" />
          <CardHeader className="pt-8 pb-4">
            <div className="mx-auto h-16 w-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-gray-900">Exam Completed</CardTitle>
            <p className="text-gray-500 mt-2">{exam.title}</p>
          </CardHeader>
          <CardContent className="pb-8">
            {hasWrittenQuestions ? (
              <div className="mt-4 p-4 bg-amber-50 text-amber-800 rounded-lg text-sm leading-relaxed">
                Your exam contains written/essay questions that require manual grading by an administrator.
                Your final score will be available once all written responses have been reviewed.
              </div>
            ) : exam.result_release_mode === 'IMMEDIATE' ? (
              <div className="mt-6 bg-gray-50 rounded-xl p-6 border border-gray-100">
                <div className="text-5xl font-black text-slate-900 mb-2">
                  {attempt.percentage}%
                </div>
                <div className="text-sm text-gray-500 font-medium mb-4 uppercase tracking-wider">
                  Final Score
                </div>
                
                <div className="inline-flex items-center px-4 py-1.5 rounded-full font-bold text-sm tracking-wide">
                  {attempt.passed ? (
                    <span className="text-green-700 bg-green-100 px-4 py-1.5 rounded-full">PASSED</span>
                  ) : (
                    <span className="text-red-700 bg-red-100 px-4 py-1.5 rounded-full">FAILED</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-lg text-sm leading-relaxed">
                Your submission has been received successfully. Results will be released by LUC Hub & Academy at a later date.
              </div>
            )}
          </CardContent>
          <CardFooter className="bg-gray-50 border-t border-gray-100 p-6 flex justify-center">
            <Button asChild variant="outline" className="w-full">
              <Link href="/">
                <Home className="h-4 w-4 mr-2" />
                Return to Dashboard
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
