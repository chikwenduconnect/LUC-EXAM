"use client";

import { useState, useTransition } from "react";
import { updateExamStatus } from "@/app/actions/exam";
import { Button } from "@/components/ui/button";
import { Play, Square, Pause, Loader2 } from "lucide-react";

export function ExamControls({ examId, currentStatus }: { examId: string, currentStatus: string }) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: string) => {
    if (newStatus === 'ENDED') {
      if (!confirm("Are you sure you want to end this exam? Participants will no longer be able to submit.")) {
        return;
      }
    }
    
    startTransition(async () => {
      try {
        await updateExamStatus(examId, newStatus);
      } catch (err: any) {
        alert("Failed to update status: " + err.message);
      }
    });
  };

  if (currentStatus === 'DRAFT' || currentStatus === 'SCHEDULED') {
    return (
      <Button 
        onClick={() => handleStatusChange('LIVE')} 
        disabled={isPending}
        className="bg-green-600 hover:bg-green-700 text-white"
      >
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
        Publish & Go Live
      </Button>
    );
  }

  if (currentStatus === 'LIVE') {
    return (
      <div className="flex gap-2">
        <Button 
          variant="outline"
          onClick={() => handleStatusChange('PAUSED')} 
          disabled={isPending}
          className="text-amber-600 border-amber-200 hover:bg-amber-50"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Pause className="mr-2 h-4 w-4" />}
          Pause
        </Button>
        <Button 
          variant="destructive"
          onClick={() => handleStatusChange('ENDED')} 
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-4 w-4" />}
          End Exam
        </Button>
      </div>
    );
  }

  if (currentStatus === 'PAUSED') {
    return (
      <div className="flex gap-2">
        <Button 
          onClick={() => handleStatusChange('LIVE')} 
          disabled={isPending}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
          Resume Exam
        </Button>
      </div>
    );
  }

  return null;
}
