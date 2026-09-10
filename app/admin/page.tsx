import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, PlayCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

export default async function AdminDashboard() {
  const supabase = await createClient();
  
  // Aggregate stats
  const { count: examsCount } = await supabase.from("exams").select("*", { count: 'exact', head: true });
  const { count: activeExamsCount } = await supabase.from("exams").select("*", { count: 'exact', head: true }).eq('status', 'LIVE');
  const { count: usersCount } = await supabase.from("profiles").select("*", { count: 'exact', head: true }).eq('role', 'student');
  const { count: attemptsCount } = await supabase.from("attempts").select("*", { count: 'exact', head: true });
  const { count: completedCount } = await supabase.from("attempts").select("*", { count: 'exact', head: true }).eq('status', 'SUBMITTED');

  // Recent active exams
  const { data: activeExams } = await supabase
    .from("exams")
    .select("*")
    .in("status", ["LIVE", "SCHEDULED"])
    .order("created_at", { ascending: false })
    .limit(5);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">{getGreeting()}.</h1>
        <p className="text-gray-500 mt-2">Here&apos;s an overview of the examination platform.</p>
      </div>

      <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Active Exams</p>
              <h2 className="text-3xl font-bold text-gray-900">{activeExamsCount || 0}</h2>
            </div>
            <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <PlayCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Exams</p>
              <h2 className="text-3xl font-bold text-gray-900">{examsCount || 0}</h2>
            </div>
            <div className="h-12 w-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
              <FileText className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Participants</p>
              <h2 className="text-3xl font-bold text-gray-900">{usersCount || 0}</h2>
            </div>
            <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Completed Attempts</p>
              <h2 className="text-3xl font-bold text-gray-900">{completedCount || 0}</h2>
            </div>
            <div className="h-12 w-12 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Active & Scheduled Examinations</h3>
        <Card>
          {activeExams?.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No active or scheduled exams at the moment.
              <div className="mt-4">
                <Link href="/admin/exams/create" className="text-indigo-600 font-medium hover:underline">
                  Create a new exam &rarr;
                </Link>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {activeExams?.map(exam => (
                <div key={exam.id} className="p-6 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="font-semibold text-gray-900">{exam.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        exam.status === 'LIVE' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {exam.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{exam.programme} • {exam.duration_minutes} minutes</p>
                  </div>
                  <div>
                    <Link href={`/admin/exams/${exam.id}`} className="text-sm font-medium text-slate-900 hover:underline">
                      Manage &rarr;
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
