"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { overrideWrittenScore } from "@/app/actions/grading";
import { Sparkles, CheckCircle2, User, FileText, Check, Loader2, AlertCircle } from "lucide-react";

export interface WrittenAnswerReviewItem {
  id: string; // answer id
  question_id: string;
  question_text: string;
  points: number; // max points
  rubric: string;
  model_answer?: string;
  written_answer: string;
  points_awarded: number | null;
  ai_feedback?: string | null;
  rubric_breakdown?: any[] | null;
}

export interface CandidateSubmission {
  attemptId: string;
  userId: string;
  userName: string;
  userEmail: string;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  submittedAt: string | null;
  writtenAnswers: WrittenAnswerReviewItem[];
}

interface WrittenSubmissionReviewProps {
  submissions: CandidateSubmission[];
  examTitle: string;
}

export function WrittenSubmissionReview({ submissions, examTitle }: WrittenSubmissionReviewProps) {
  const [selectedAttemptId, setSelectedAttemptId] = useState<string>(
    submissions[0]?.attemptId || ""
  );
  const [isPending, startTransition] = useTransition();
  const [overrideScores, setOverrideScores] = useState<Record<string, number>>({});
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string>("");

  const currentSubmission = submissions.find((s) => s.attemptId === selectedAttemptId);

  const handleScoreChange = (answerId: string, val: number) => {
    setOverrideScores((prev) => ({ ...prev, [answerId]: val }));
  };

  const handleSaveScore = (attemptId: string, answer: WrittenAnswerReviewItem) => {
    const newScore = overrideScores[answer.id] !== undefined ? overrideScores[answer.id] : (answer.points_awarded || 0);
    const notes = adminNotes[answer.id] || "";

    setSuccessMsg("");
    startTransition(async () => {
      const res = await overrideWrittenScore(attemptId, answer.id, newScore, notes);
      if (res.success) {
        setSuccessMsg(`Score updated to ${newScore}/${answer.points}! Candidate new total: ${res.newTotalScore} pts (${res.newPercentage}%).`);
        setTimeout(() => setSuccessMsg(""), 4000);
      } else {
        alert(res.error || "Failed to update score");
      }
    });
  };

  if (submissions.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
        <FileText className="h-10 w-10 text-gray-400 mx-auto mb-2" />
        <h4 className="font-medium text-gray-800">No Submitted Attempts Yet</h4>
        <p className="text-sm text-gray-500 mt-1">
          When students complete this examination, their written answers and AI grading evaluations will appear here for review.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Candidate Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div>
          <Label className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Candidate Submission</Label>
          <div className="flex items-center gap-2 mt-1">
            <select
              value={selectedAttemptId}
              onChange={(e) => setSelectedAttemptId(e.target.value)}
              className="h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              {submissions.map((sub) => (
                <option key={sub.attemptId} value={sub.attemptId}>
                  {sub.userName} ({sub.userEmail}) — {sub.score !== null ? `${sub.score} pts (${sub.percentage}%)` : "Pending"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {currentSubmission && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Total Exam Grade</span>
              <span className="font-bold text-slate-900 text-lg">
                {currentSubmission.score ?? "--"} pts ({currentSubmission.percentage ?? "--"}%)
              </span>
            </div>
            <Badge variant={currentSubmission.passed ? "default" : "destructive"}>
              {currentSubmission.passed ? "PASSED" : "FAILED"}
            </Badge>
          </div>
        )}
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Written Question Cards */}
      {currentSubmission?.writtenAnswers.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
          This examination does not contain any written/essay questions.
        </div>
      ) : (
        <div className="space-y-6">
          {currentSubmission?.writtenAnswers.map((item, index) => {
            const currentScore = overrideScores[item.id] !== undefined ? overrideScores[item.id] : (item.points_awarded ?? 0);

            return (
              <Card key={item.id} className="overflow-hidden border-slate-200 shadow-sm">
                <CardHeader className="bg-slate-50/60 border-b border-slate-100">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className="text-xs font-semibold">
                          Written Question #{index + 1}
                        </Badge>
                        <span className="text-xs text-slate-500 font-medium">Max: {item.points} pts</span>
                      </div>
                      <h4 className="font-semibold text-slate-900 text-base">{item.question_text}</h4>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold border border-indigo-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI Score: {item.points_awarded ?? "--"} / {item.points}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-6 space-y-6">
                  {/* Student Answer */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block">
                      Candidate Response
                    </Label>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                      {item.written_answer ? item.written_answer : <span className="text-slate-400 italic">No answer submitted.</span>}
                    </div>
                  </div>

                  {/* Rubric Reference (Collapsible or Shown) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/70 rounded-lg text-amber-950">
                      <span className="font-bold block mb-1">Grading Rubric / Criteria</span>
                      <p className="whitespace-pre-wrap leading-relaxed text-amber-900">{item.rubric || "Standard accuracy & completeness"}</p>
                    </div>
                    {item.model_answer && (
                      <div className="p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-lg text-blue-950">
                        <span className="font-bold block mb-1">Model / Reference Answer</span>
                        <p className="whitespace-pre-wrap leading-relaxed text-blue-900">{item.model_answer}</p>
                      </div>
                    )}
                  </div>

                  {/* AI Evaluation & Feedback */}
                  {item.ai_feedback && (
                    <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4 space-y-3">
                      <div className="flex items-center gap-2 text-indigo-950 font-semibold text-sm">
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        Gemini AI Evaluation Justification
                      </div>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                        {item.ai_feedback}
                      </p>

                      {/* Criteria Breakdown if available */}
                      {Array.isArray(item.rubric_breakdown) && item.rubric_breakdown.length > 0 && (
                        <div className="pt-2 border-t border-indigo-100/80 space-y-1.5">
                          <span className="text-xs font-semibold text-slate-600 block">Rubric Concept Breakdown:</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {item.rubric_breakdown.map((crit: any, cIdx: number) => (
                              <div key={cIdx} className="bg-white/80 border border-indigo-100 p-2 rounded text-xs">
                                <div className="flex justify-between font-medium text-slate-800">
                                  <span>{crit.criteria}</span>
                                  <span className="text-indigo-600 font-bold">{crit.awarded} / {crit.max}</span>
                                </div>
                                {crit.remarks && <p className="text-slate-500 text-[11px] mt-0.5">{crit.remarks}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Instructor Score Override */}
                  <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 bg-slate-50 -mx-6 -mb-6 p-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <div>
                        <Label htmlFor={`override-${item.id}`} className="text-xs font-semibold text-slate-700">
                          Adjust / Final Score (Max {item.points})
                        </Label>
                        <Input
                          id={`override-${item.id}`}
                          type="number"
                          step="0.5"
                          min={0}
                          max={item.points}
                          value={currentScore}
                          onChange={(e) => handleScoreChange(item.id, parseFloat(e.target.value) || 0)}
                          className="w-28 bg-white h-9 mt-1"
                        />
                      </div>
                      <div className="flex-1 min-w-[200px]">
                        <Label htmlFor={`notes-${item.id}`} className="text-xs font-semibold text-slate-700">
                          Instructor Feedback Notes (Optional)
                        </Label>
                        <Input
                          id={`notes-${item.id}`}
                          placeholder="Note for student..."
                          value={adminNotes[item.id] || ""}
                          onChange={(e) => setAdminNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          className="bg-white h-9 mt-1"
                        />
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleSaveScore(currentSubmission.attemptId, item)}
                      disabled={isPending}
                      className="shrink-0 gap-1.5"
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Save & Recalculate
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
