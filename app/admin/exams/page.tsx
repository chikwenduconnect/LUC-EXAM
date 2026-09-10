import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

export default async function AdminExamsPage() {
  const supabase = await createClient();
  const { data: exams } = await supabase
    .from("exams")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Examinations</h1>
          <p className="text-gray-500">Manage all your exams and assessments.</p>
        </div>
        <Button asChild>
          <Link href="/admin/exams/create">
            <Plus className="h-4 w-4 mr-2" />
            Create Exam
          </Link>
        </Button>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-semibold">Exam Title</th>
                <th className="px-6 py-4 font-semibold">Programme</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Duration</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No exams created yet.
                  </td>
                </tr>
              ) : (
                exams?.map((exam) => (
                  <tr key={exam.id} className="bg-white border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {exam.title}
                    </td>
                    <td className="px-6 py-4">
                      {exam.programme || "-"}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={
                        exam.status === 'LIVE' ? 'default' :
                        exam.status === 'DRAFT' ? 'secondary' :
                        exam.status === 'ENDED' ? 'outline' : 'default'
                      }>
                        {exam.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {exam.duration_minutes} min
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/exams/${exam.id}`}>
                          Manage
                        </Link>
                      </Button>
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
