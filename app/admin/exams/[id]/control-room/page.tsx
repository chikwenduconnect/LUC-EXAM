import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Users, Play, CheckCircle } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { ControlRoomLive } from "@/components/admin/control-room-live";

export default async function ControlRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const examId = resolvedParams.id;
  const supabase = await createClient();

  const { data: exam, error } = await supabase
    .from("exams")
    .select("*")
    .eq("id", examId)
    .single();

  if (error || !exam) notFound();

  // Fetch initial attempts and profiles
  const { data: attempts } = await supabase
    .from("attempts")
    .select("*, profiles(name, email)")
    .eq("exam_id", examId)
    .order("started_at", { ascending: false });

  const activeCount = attempts?.filter(a => a.status === 'IN_PROGRESS').length || 0;
  const submittedCount = attempts?.filter(a => a.status === 'SUBMITTED').length || 0;

  return (
    <div className="p-8 max-w-6xl mx-auto h-screen flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <Link href={`/admin/exams/${examId}`} className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Exam Details
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Control Room</h1>
            <p className="text-gray-500">{exam.title}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className={exam.status === 'LIVE' ? "animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" : ""}></span>
              <span className={`relative inline-flex rounded-full h-3 w-3 ${exam.status === 'LIVE' ? 'bg-green-500' : 'bg-gray-400'}`}></span>
            </span>
            <Badge variant="outline" className="font-mono">{exam.status}</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8 flex-shrink-0">
        <Card className="bg-slate-900 text-white border-none">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 bg-slate-800 rounded-full flex items-center justify-center">
              <Users className="h-6 w-6 text-slate-300" />
            </div>
            <div>
              <p className="text-slate-400 text-sm font-medium">Total Participants</p>
              <p className="text-2xl font-bold">{attempts?.length || 0}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-indigo-50 border-indigo-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <Play className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-indigo-600/80 text-sm font-medium">Active (Testing)</p>
              <p className="text-2xl font-bold text-indigo-900">{activeCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-emerald-600/80 text-sm font-medium">Submitted</p>
              <p className="text-2xl font-bold text-emerald-900">{submittedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <div className="p-6 border-b border-gray-100 flex-shrink-0">
          <h3 className="font-semibold text-gray-900">Live Participant Feed</h3>
        </div>
        <div className="flex-1 overflow-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500 sticky top-0">
              <tr>
                <th className="px-6 py-3 font-medium">Participant Name</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Started</th>
                <th className="px-6 py-3 font-medium text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <ControlRoomLive initialAttempts={attempts || []} />
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
