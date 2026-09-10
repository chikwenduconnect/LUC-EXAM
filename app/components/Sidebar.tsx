import Link from 'next/link';
import { LayoutDashboard, Users, FileText, Settings } from 'lucide-react';

export default function Sidebar() {
  return (
    <div className="w-64 bg-white border-r h-screen flex flex-col">
      <div className="p-6 border-b">
        <h2 className="text-xl font-bold text-gray-800">Admin Portal</h2>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </Link>
        <Link href="/participants" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
          <Users size={20} />
          <span>Participants</span>
        </Link>
        <Link href="/exams" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
          <FileText size={20} />
          <span>Exams</span>
        </Link>
      </nav>
      <div className="p-4 border-t">
        <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-100 rounded-lg">
          <Settings size={20} />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}
