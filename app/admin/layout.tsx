import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, FileText, Users, Activity, Settings, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }
  
  async function signOut() {
    "use server";
    const supabaseServer = await createClient();
    await supabaseServer.auth.signOut();
    redirect("/");
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 text-slate-300 md:min-h-screen flex flex-col shrink-0 z-10 sticky top-0 md:relative shadow-md md:shadow-none">
        <div className="p-4 md:p-6 flex items-center justify-between md:mb-8">
          <div className="flex items-center gap-2 text-white">
            <div className="h-8 w-8 bg-white text-slate-900 rounded-md flex items-center justify-center font-bold text-sm">
              LUC
            </div>
            <span className="font-semibold tracking-tight text-lg">EXAM ADMIN</span>
          </div>
          {/* Sign Out on mobile header */}
          <div className="md:hidden">
            <form action={signOut}>
              <button type="submit" className="text-slate-400 hover:text-white transition-colors" aria-label="Sign Out">
                <LogOut className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
        
        <nav className="flex flex-row md:flex-col overflow-x-auto gap-2 px-4 md:px-6 pb-4 md:pb-0 md:space-y-1 no-scrollbar border-b border-slate-800 md:border-b-0 whitespace-nowrap">
          <Link href="/admin" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <Link href="/admin/exams" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <FileText className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Exams</span>
          </Link>
          <Link href="/admin/participants" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Users className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Participants</span>
          </Link>
          <Link href="/admin/logs" className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800 hover:text-white transition-colors">
            <Activity className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">Activity Logs</span>
          </Link>
        </nav>
        
        <div className="mt-auto p-6 border-t border-slate-900 hidden md:block">
          <form action={signOut}>
            <button type="submit" className="flex items-center gap-3 px-3 py-2 w-full text-left rounded-md hover:bg-slate-800 hover:text-white transition-colors">
              <LogOut className="h-4 w-4 shrink-0" />
              Sign Out
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden w-full max-w-full">
        {children}
      </main>
    </div>
  );
}
