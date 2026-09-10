import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Activity, ShieldAlert, MonitorPlay, MousePointerClick } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default async function AdminLogsPage() {
  const supabase = await createClient();
  
  // Fetch recent activity logs with user and exam details
  const { data: logs } = await supabase
    .from("activity_logs")
    .select(`
      *,
      profiles:user_id (name, email),
      attempts:attempt_id (
        exams:exam_id (title)
      )
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'TAB_LEFT':
      case 'WINDOW_BLUR':
        return <ShieldAlert className="h-4 w-4 text-amber-500" />;
      case 'EXAM_STARTED':
      case 'EXAM_SUBMITTED':
        return <MonitorPlay className="h-4 w-4 text-indigo-500" />;
      default:
        return <MousePointerClick className="h-4 w-4 text-slate-400" />;
    }
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Activity Logs</h1>
          <p className="text-gray-500">System event monitoring and audit trails.</p>
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Event Type</th>
                <th className="px-6 py-4 font-semibold">Participant</th>
                <th className="px-6 py-4 font-semibold">Exam</th>
                <th className="px-6 py-4 font-semibold">Time</th>
              </tr>
            </thead>
            <tbody>
              {(!logs || logs.length === 0) ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    No activity logs recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                      {getEventIcon(log.event_type)}
                      {log.event_type}
                    </td>
                    <td className="px-6 py-4">
                      {log.profiles?.name || 'Unknown User'}
                    </td>
                    <td className="px-6 py-4">
                      {log.attempts?.exams?.title || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
