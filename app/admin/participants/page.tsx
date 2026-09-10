import { getParticipantsWithRosters } from "@/lib/roster-service";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AddParticipantDialog } from "@/components/admin/add-participant-dialog";
import { createClient } from "@/lib/supabase/server";

export default async function AdminParticipantsPage() {
  const users = await getParticipantsWithRosters();
  const supabase = await createClient();
  const { data: exams } = await supabase.from('exams').select('id, title, status').in('status', ['LIVE', 'SCHEDULED']);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Participants & Candidate Rosters</h1>
          <p className="text-gray-500">View all registered students and their assigned exam papers.</p>
        </div>
        <div>
          <AddParticipantDialog availableExams={exams || []} />
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Name</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Programme</th>
                <th className="px-6 py-4 font-semibold">Enrolled Papers</th>
                <th className="px-6 py-4 font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody>
              {users?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No participants registered yet.
                  </td>
                </tr>
              ) : (
                users?.map((user: any) => {
                  const enrolledList = user.enrolledExams || [];

                  return (
                    <tr key={user.id} className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {user.name}
                      </td>
                      <td className="px-6 py-4">
                        {user.email}
                      </td>
                      <td className="px-6 py-4">
                        {user.programme ? (
                          <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-medium">
                            {user.programme}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic">Not specified</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {enrolledList.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">None assigned</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {enrolledList.map((ex: any) => (
                              <Link key={ex.id} href={`/admin/exams/${ex.id}`}>
                                <Badge variant="outline" className="text-[11px] hover:bg-slate-100 transition-colors cursor-pointer">
                                  {ex.title}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs">
                        {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
