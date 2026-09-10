"use client";

import { AlertCircle, Database, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SetupScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-8 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">Database Setup Required</h1>
              <p className="text-gray-500">LUC Exam requires Supabase for backend persistence.</p>
            </div>
          </div>
        </div>
        
        <div className="p-8 space-y-6">
          <div className="space-y-4 text-sm text-gray-600">
            <p>
              To run the LUC Exam application in your environment, you need to connect it to a Supabase project.
            </p>
            
            <div className="bg-amber-50 text-amber-800 p-4 rounded-md flex gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium text-amber-900 mb-1">Missing Environment Variables</p>
                <p>The application could not find the required Supabase credentials.</p>
              </div>
            </div>
            
            <h3 className="font-semibold text-gray-900 text-base mt-6 mb-2">Instructions</h3>
            <ol className="list-decimal pl-5 space-y-3">
              <li>Create a free account and new project at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">Supabase</a>.</li>
              <li>Go to <strong>Project Settings &gt; API</strong> to find your keys.</li>
              <li>Add the following keys to your AI Studio Secrets (or `.env.local` if running locally):
                <ul className="list-disc pl-5 mt-2 space-y-1 text-xs font-mono bg-gray-100 p-3 rounded text-gray-800">
                  <li>NEXT_PUBLIC_SUPABASE_URL</li>
                  <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                  <li>SUPABASE_SERVICE_ROLE_KEY</li>
                </ul>
              </li>
              <li>Go to the <strong>SQL Editor</strong> in your Supabase dashboard.</li>
              <li>Copy and run the contents of the <span className="font-mono bg-gray-100 px-1 py-0.5 rounded">supabase/schema.sql</span> file from this workspace to initialize the database tables and security rules.</li>
            </ol>
          </div>
        </div>
        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end">
          <Button onClick={() => window.location.reload()}>
            I have added the keys - Refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
