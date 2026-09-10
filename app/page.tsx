import { createClient } from "@/lib/supabase/server";
import { getStudentEnrolledExamIds, getExamConfig } from "@/lib/roster-service";
import { SetupScreen } from "@/components/setup-screen";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, HelpCircle, Calendar, LogOut, CheckCircle2, Lock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function HomePage() {
  // 1. Check Setup
  let rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let isUrlValid = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');

  // Fallback to derive URL from JWT if invalid
  if (!isUrlValid) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      try {
        const payloadB64 = anonKey.split('.')[1];
        if (payloadB64) {
          const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());
          if (payload.ref) {
            rawUrl = `https://${payload.ref}.supabase.co`;
            isUrlValid = true;
          }
        }
      } catch (e) {
        // ignore
      }
    }
  }

  if (!isUrlValid || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || rawUrl === 'https://placeholder.supabase.co') {
    return <SetupScreen />;
  }

  // 2. Check Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return <LoginForm />;
  }

  // 3. Fetch User Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role === "admin") {
    redirect("/admin");
  }

  // 4. Fetch Candidate Roster enrollments for this student safely
  const enrolledExamIds = await getStudentEnrolledExamIds(user.id);

  // 5. Fetch Available & Completed Exams (Student Dashboard)
  const { data: allActiveExams } = await supabase
    .from("exams")
    .select("*")
    .in("status", ["LIVE", "SCHEDULED", "ENDED"])
    .order("created_at", { ascending: false });
    
  // Fetch configs (access_code, roster_only) safely
  const examsWithConfig = await Promise.all(
    (allActiveExams || []).map(async (exam: any) => {
      const config = await getExamConfig(exam.id, exam);
      return {
        ...exam,
        access_code: config.access_code,
        roster_only: config.roster_only,
      };
    })
  );

  // Filter exams that the student is permitted to see:
  // 1. Explicitly enrolled candidates ALWAYS see their assigned paper
  // 2. Strict roster exams (roster_only = true) are HIDDEN unless enrolled
  // 3. Open exams are visible if matching the student's programme or general
  const exams = examsWithConfig.filter((exam: any) => {
    const isEnrolled = enrolledExamIds.has(exam.id);
    if (isEnrolled) return true;
    if (exam.roster_only) return false;

    if (!profile?.programme) return true;
    return !exam.programme || exam.programme.trim() === "" || exam.programme.toLowerCase() === profile.programme.toLowerCase();
  });
    
  const { data: attempts } = await supabase
    .from("attempts")
    .select("*")
    .eq("user_id", user.id);

  // Sign out action
  async function signOut() {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut();
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-sm">
              LUC
            </div>
            <span className="font-semibold text-slate-900 tracking-tight">EXAM</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline-block">
              {profile?.name || user.email}
            </span>
            <form action={signOut}>
              <Button variant="ghost" size="sm" type="submit" className="text-gray-500">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Your Dashboard</h1>
          <p className="text-gray-500">View and manage your examinations.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {exams?.length === 0 ? (
            <div className="col-span-full py-12 text-center bg-white border border-dashed border-gray-300 rounded-xl">
              <h3 className="text-lg font-medium text-gray-900">No active examinations</h3>
              <p className="text-gray-500 mt-1">You don&apos;t have any available exams right now.</p>
            </div>
          ) : (
            exams?.map((exam) => {
              const attempt = attempts?.find(a => a.exam_id === exam.id);
              const isCompleted = attempt?.status === 'SUBMITTED';
              const isInProgress = attempt?.status === 'IN_PROGRESS';
              
              return (
                <Card key={exam.id} className="flex flex-col">
                  <CardHeader>
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={isCompleted ? "secondary" : (exam.status === "LIVE" ? "default" : "outline")}>
                          {isCompleted ? "Completed" : exam.status}
                        </Badge>
                        {enrolledExamIds.has(exam.id) && (
                          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 text-[11px] font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Enrolled Candidate
                          </Badge>
                        )}
                        {exam.roster_only && (
                          <span title="Restricted Exam Roster">
                            <Lock className="h-3.5 w-3.5 text-slate-400" />
                          </span>
                        )}
                      </div>
                      {isCompleted && exam.result_release_mode === 'IMMEDIATE' && attempt?.percentage != null && (
                        <div className="text-right">
                          <span className="text-2xl font-bold text-slate-900">{attempt.percentage}%</span>
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-xl leading-tight">{exam.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {exam.access_code && !isCompleted && !isInProgress && (
                        <span title="Access PIN required">
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        </span>
                      )}
                      {exam.programme || 'General Assessment'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-gray-600">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>Duration: {exam.duration_minutes} minutes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4 text-gray-400" />
                        <span>Pass mark: {exam.pass_mark}%</span>
                      </div>
                      {exam.start_time && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>Starts: {format(new Date(exam.start_time), "PPP 'at' p")}</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter className="pt-4 border-t border-gray-100 bg-gray-50/50">
                    {isCompleted ? (
                      <div className="w-full text-center text-sm font-medium text-gray-500 py-2">
                        Submitted on {attempt?.submitted_at ? format(new Date(attempt.submitted_at), "MMM d, yyyy") : "Unknown"}
                      </div>
                    ) : exam.status === "LIVE" || isInProgress ? (
                      <Button asChild className="w-full">
                        <Link href={`/exam/${exam.id}/instructions`}>
                          {isInProgress ? "Resume Exam" : "Start Exam"}
                        </Link>
                      </Button>
                    ) : (
                      <div className="w-full text-center text-sm font-medium text-gray-500 py-2">
                        Exam is not currently available
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
