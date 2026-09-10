"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export function ControlRoomLive({ initialAttempts }: { initialAttempts: any[] }) {
  const [attempts, setAttempts] = useState(initialAttempts);
  const supabase = createClient();

  useEffect(() => {
    // Listen for changes to attempts table
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'attempts' },
        (payload) => {
          setAttempts(prev => {
            const index = prev.findIndex(a => a.id === payload.new.id);
            if (index !== -1) {
              const newAttempts = [...prev];
              newAttempts[index] = { ...newAttempts[index], ...payload.new };
              return newAttempts;
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  if (attempts.length === 0) {
    return (
      <tr>
        <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
          No participants have started this exam yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {attempts.map((attempt) => (
        <tr key={attempt.id} className="hover:bg-gray-50 transition-colors">
          <td className="px-6 py-4">
            <div className="font-medium text-gray-900">{attempt.profiles?.name || "Unknown"}</div>
            <div className="text-gray-500 text-xs">{attempt.profiles?.email}</div>
          </td>
          <td className="px-6 py-4">
            <Badge variant={attempt.status === 'SUBMITTED' ? 'secondary' : 'default'} className={attempt.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : ''}>
              {attempt.status.replace('_', ' ')}
            </Badge>
          </td>
          <td className="px-6 py-4 text-gray-500">
            {formatDistanceToNow(new Date(attempt.started_at), { addSuffix: true })}
          </td>
          <td className="px-6 py-4 text-right font-medium">
            {attempt.status === 'SUBMITTED' && attempt.percentage != null
              ? `${attempt.percentage}%`
              : '-'}
          </td>
        </tr>
      ))}
    </>
  );
}
