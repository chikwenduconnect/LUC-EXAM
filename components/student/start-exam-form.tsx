"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { startAttempt } from "@/app/actions/participant";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export function StartExamForm({ 
  examId, 
  requiredAccessCode, 
  isResuming 
}: { 
  examId: string, 
  requiredAccessCode: string | null,
  isResuming: boolean 
}) {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Only check access code if one is set, and it's not currently being resumed.
    if (requiredAccessCode && !isResuming) {
      if (accessCode.trim() !== requiredAccessCode) {
        setError("Invalid access code.");
        return;
      }
    }

    setLoading(true);
    try {
      await startAttempt(examId);
      router.push(`/exam/${examId}/take`);
    } catch (err: any) {
      setError(err.message || "Failed to start exam.");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleStart} className="flex flex-col sm:flex-row items-center gap-4">
      {error && (
        <div className="text-sm text-red-600 mr-2">
          {error}
        </div>
      )}
      
      {requiredAccessCode && !isResuming && (
        <Input 
          type="text" 
          placeholder="Enter Access Code" 
          required 
          value={accessCode}
          onChange={(e) => setAccessCode(e.target.value)}
          className="w-48 bg-white"
        />
      )}
      
      <Button type="submit" size="lg" className="bg-slate-900 text-white hover:bg-slate-800" disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {isResuming ? 'Resume Exam' : 'Start Exam'}
      </Button>
    </form>
  );
}
