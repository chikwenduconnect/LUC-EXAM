"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Save, Sparkles, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export interface GradingEntry {
  attemptId: string;
  userId: string;
  userName: string;
  userEmail: string;
  answers: {
    answerId: string;
    questionId: string;
    questionText: string;
    points: number;
    writtenAnswer: string;
    isCorrect: boolean | null;
    pointsAwarded: number | null;
    rubric?: string;
    modelAnswer?: string;
    aiFeedback?: string | null;
    rubricBreakdown?: any[] | null;
  }[];
}

interface WrittenGraderProps {
  examId: string;
  entries: GradingEntry[];
  onGraded?: () => void;
}

export function WrittenGrader({ examId, entries: initialEntries, onGraded }: WrittenGraderProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [grading, setGrading] = useState<Record<string, number>>({});
  const [saving, startTransition] = useTransition();
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const handlePointsChange = (answerId: string, points: number) => {
    setGrading(prev => ({ ...prev, [answerId]: points }));
    setSaved(prev => ({ ...prev, [answerId]: false }));
  };

  const handleSaveGrade = async (entry: GradingEntry, answer: GradingEntry['answers'][0]) => {
    const pointsAwarded = grading[answer.answerId] ?? answer.pointsAwarded ?? 0;
    const clampedPoints = Math.max(0, Math.min(answer.points, pointsAwarded));
    const isCorrect = clampedPoints >= (answer.points / 2);

    startTransition(async () => {
      try {
        const supabase = createClient();
        await supabase
          .from("answers")
          .update({ is_correct: isCorrect, points_awarded: clampedPoints })
          .eq("id", answer.answerId);

        // Recalculate attempt score
        const { data: allAnswers } = await supabase
          .from("answers")
          .select("id, question_id, is_correct, points_awarded, questions!inner(id, points, question_type, exam_id)")
          .eq("attempt_id", entry.attemptId)
          .eq("questions.exam_id", examId);

        let totalScore = 0;
        let maxScore = 0;
        let allGraded = true;

        for (const a of allAnswers || []) {
          const q = (a as any).questions;
          maxScore += q.points;
          if (q.question_type === 'WRITTEN' && a.points_awarded === null) {
            allGraded = false;
          }
          if (a.points_awarded !== null) {
            totalScore += a.points_awarded;
          }
        }

        const percentage = allGraded && maxScore > 0 ? (totalScore / maxScore) * 100 : null;
        const { data: exam } = await supabase.from("exams").select("pass_mark").eq("id", examId).single();
        const passed = percentage !== null ? percentage >= (exam?.pass_mark || 50) : null;

        await supabase
          .from("attempts")
          .update({
            score: allGraded ? Math.round(totalScore * 10) / 10 : null,
            percentage: percentage !== null ? Math.round(percentage * 10) / 10 : null,
            passed
          })
          .eq("id", entry.attemptId);

        setSaved(prev => ({ ...prev, [answer.answerId]: true }));
        setTimeout(() => setSaved(prev => ({ ...prev, [answer.answerId]: false })), 2500);
      } catch (err) {
        console.error("Failed to save grade:", err);
        alert("Failed to save grade.");
      }
    });
  };

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
        <p className="text-gray-500">No submitted attempts with written answers yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs text-indigo-900">
        <Sparkles className="h-4 w-4 text-indigo-600 shrink-0" />
        <span>
          <strong>AI Auto-Evaluation:</strong> Student written answers were automatically graded by Gemini AI using your marking rubric upon submission. You can inspect the AI feedback and override scores anytime below.
        </span>
      </div>

      {entries.map((entry) => (
        <Card key={entry.attemptId} className="border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h4 className="font-semibold text-gray-900">{entry.userName}</h4>
                <p className="text-xs text-gray-500">{entry.userEmail}</p>
              </div>
              <Badge variant="outline">{entry.answers.length} written response{entry.answers.length !== 1 ? 's' : ''}</Badge>
            </div>

            <div className="space-y-6">
              {entry.answers.map((answer, qIdx) => {
                const currentScore = grading[answer.answerId] ?? answer.pointsAwarded ?? '';

                return (
                  <div key={answer.answerId} className="border border-slate-200 rounded-xl p-5 bg-white space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Question #{qIdx + 1}
                        </span>
                        <p className="font-medium text-sm text-gray-900">{answer.questionText}</p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs font-semibold">
                        Max {answer.points} pt{answer.points !== 1 ? 's' : ''}
                      </Badge>
                    </div>

                    {/* Candidate Response */}
                    <div>
                      <Label className="text-xs font-medium text-gray-500 block mb-1.5">Candidate&apos;s Answer:</Label>
                      <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {answer.writtenAnswer || <span className="text-gray-400 italic">No answer provided</span>}
                      </div>
                    </div>

                    {/* Rubric & Benchmark */}
                    {(answer.rubric || answer.modelAnswer) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        {answer.rubric && (
                          <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded-md text-amber-950">
                            <span className="font-bold block mb-1">Marking Rubric:</span>
                            <p className="whitespace-pre-wrap leading-relaxed text-amber-900">{answer.rubric}</p>
                          </div>
                        )}
                        {answer.modelAnswer && (
                          <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-md text-blue-950">
                            <span className="font-bold block mb-1">Model / Reference Answer:</span>
                            <p className="whitespace-pre-wrap leading-relaxed text-blue-900">{answer.modelAnswer}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Feedback Card */}
                    {answer.aiFeedback && (
                      <div className="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 font-semibold text-xs text-indigo-950">
                            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                            Gemini AI Evaluation Justification
                          </div>
                          <span className="text-xs font-bold text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-100">
                            AI Score: {answer.pointsAwarded ?? 0} / {answer.points}
                          </span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {answer.aiFeedback}
                        </p>

                        {/* Breakdown if criteria exists */}
                        {Array.isArray(answer.rubricBreakdown) && answer.rubricBreakdown.length > 0 && (
                          <div className="pt-2 border-t border-indigo-100/70 space-y-1">
                            <span className="text-[11px] font-semibold text-slate-500 block">Criteria Breakdown:</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                              {answer.rubricBreakdown.map((crit: any, cIdx: number) => (
                                <div key={cIdx} className="bg-white p-1.5 rounded border border-indigo-100 text-[11px] flex justify-between">
                                  <span className="text-slate-700 truncate mr-2">{crit.criteria}</span>
                                  <span className="font-bold text-indigo-600 shrink-0">{crit.awarded}/{crit.max}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Instructor Score Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-3">
                        <Label className="text-xs font-semibold text-gray-700 shrink-0">
                          Final / Override Score:
                        </Label>
                        <Input
                          type="number"
                          step="0.5"
                          min={0}
                          max={answer.points}
                          className="w-24 h-8 text-sm"
                          value={currentScore}
                          placeholder="0"
                          onChange={(e) => handlePointsChange(answer.answerId, parseFloat(e.target.value) || 0)}
                        />
                        <span className="text-xs text-slate-400">/ {answer.points} pts</span>
                      </div>

                      <Button
                        size="sm"
                        variant={saved[answer.answerId] ? "default" : "outline"}
                        onClick={() => handleSaveGrade(entry, answer)}
                        disabled={saving}
                        className="h-8 gap-1.5"
                      >
                        {saving ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : saved[answer.answerId] ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        ) : (
                          <Save className="h-3.5 w-3.5" />
                        )}
                        {saved[answer.answerId] ? "Saved" : "Save Score"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
