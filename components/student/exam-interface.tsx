"use client";

import { useState, useEffect, useCallback, useTransition } from "react";
import { saveAnswer, saveWrittenAnswer, submitExam, logProctoringEvent } from "@/app/actions/participant";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, Flag, Loader2, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function ExamInterface({ exam, attemptId, questions, initialAnswers, initialWrittenAnswers, endTimeMs }: any) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [writtenAnswers, setWrittenAnswers] = useState<Record<string, string>>(initialWrittenAnswers);
  const [writtenSaveTimers, setWrittenSaveTimers] = useState<Record<string, ReturnType<typeof setTimeout>>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [timeLeft, setTimeLeft] = useState(() => Math.max(0, endTimeMs - Date.now()));
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isSubmitting, startTransition] = useTransition();
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [tabSwitchWarnings, setTabSwitchWarnings] = useState(0);
  const [securityNotice, setSecurityNotice] = useState<string | null>(null);
  const maxAllowedWarnings = 3;

  const currentQuestion = questions[currentIndex];

  const handleForceSubmit = useCallback(() => {
    startTransition(async () => {
      try {
        await submitExam(attemptId, exam.id);
      } catch (err) {
        console.error("Auto-submit failed", err);
      }
    });
  }, [attemptId, exam.id]);
  
  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = Math.max(0, endTimeMs - Date.now());
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
        handleForceSubmit();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [endTimeMs, handleForceSubmit]);

  // Anti-Cheating: Tab Switch & Window Blur Detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitchWarnings((prev) => {
          const nextCount = prev + 1;
          logProctoringEvent(attemptId, "TAB_SWITCH_OR_BLUR", {
            warningNumber: nextCount,
            questionIndex: currentIndex + 1,
          });

          if (nextCount >= maxAllowedWarnings) {
            setSecurityNotice(
              `Proctoring Warning: You have switched away from the examination window ${nextCount} times. This activity has been recorded in the administrator audit log.`
            );
          } else {
            setSecurityNotice(
              `Security Warning ${nextCount} of ${maxAllowedWarnings}: Please remain on the exam screen. Leaving or switching tabs is flagged as potential misconduct.`
            );
          }
          return nextCount;
        });
      }
    };

    const handleWindowBlur = () => {
      logProctoringEvent(attemptId, "WINDOW_BLUR", {
        questionIndex: currentIndex + 1,
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [attemptId, currentIndex, maxAllowedWarnings]);

  const dismissSecurityNotice = useCallback(() => {
    setSecurityNotice(null);
  }, []);

  const formatTime = (ms: number) => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = async (optionId: string) => {
    if (!currentQuestion) return;

    setAnswers(prev => ({ ...prev, [currentQuestion.id]: optionId }));
    setSaveStatus("saving");
    try {
      await saveAnswer(attemptId, currentQuestion.id, optionId);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch (err) {
      console.error("Failed to save answer:", err);
      setSaveStatus("idle");
      alert("Failed to save answer. Please check your internet connection.");
    }
  };

  const handleWrittenAnswerChange = (questionId: string, text: string) => {
    setWrittenAnswers(prev => ({ ...prev, [questionId]: text }));

    if (writtenSaveTimers[questionId]) {
      clearTimeout(writtenSaveTimers[questionId]);
    }

    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        await saveWrittenAnswer(attemptId, questionId, text);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
      } catch (err) {
        console.error("Failed to save written answer:", err);
        setSaveStatus("idle");
      }
    }, 800);

    setWrittenSaveTimers(prev => ({ ...prev, [questionId]: timer }));
  };

  const toggleFlag = () => {
    const newFlagged = new Set(flagged);
    if (newFlagged.has(currentIndex)) newFlagged.delete(currentIndex);
    else newFlagged.add(currentIndex);
    setFlagged(newFlagged);
  };

  const isTimeCritical = timeLeft < 5 * 60 * 1000; // Less than 5 minutes

  if (isSubmitting) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
        <Loader2 className="h-12 w-12 animate-spin text-slate-900 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900">Submitting Exam...</h2>
        <p className="text-gray-500 mt-2">Please wait, do not close this window.</p>
      </div>
    );
  }

  if (showSubmitConfirm) {
    const answeredCount = Object.keys(answers).length;
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Submit your exam?</h2>
          <p className="text-gray-600 mb-6">
            You have answered <strong className="text-gray-900">{answeredCount} of {questions.length}</strong> questions.
            {answeredCount < questions.length && " Are you sure you want to submit with unanswered questions?"}
          </p>
          <div className="flex flex-col gap-3">
            <Button 
              size="lg" 
              onClick={() => handleForceSubmit()} 
              disabled={isSubmitting}
            >
              Confirm Submission
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => setShowSubmitConfirm(false)}
              disabled={isSubmitting}
            >
              Return to Exam
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="font-bold text-lg tracking-tight text-slate-900 hidden sm:block">LUC EXAM</div>
          <div className="h-4 w-px bg-gray-200 hidden sm:block"></div>
          <div className="font-medium text-gray-600 truncate max-w-[200px] sm:max-w-md">{exam.title}</div>
        </div>
        
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-xs sm:text-sm font-medium text-gray-400 w-24 text-right">
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved" : ""}
          </div>
          <div className={cn(
            "flex items-center gap-2 font-mono text-lg font-bold px-3 py-1 rounded-md",
            isTimeCritical ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-900"
          )}>
            <Clock className="h-4 w-4" />
            {formatTime(timeLeft)}
          </div>
          <Button variant="default" size="sm" onClick={() => setShowSubmitConfirm(true)}>
            Finish
          </Button>
        </div>
      </header>

      {/* Security / Anti-Cheating Alert Banner */}
      {securityNotice && (
        <div className="bg-amber-600 text-white px-4 py-3 shadow-md">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-200" />
              <p className="text-sm font-medium">
                <span className="font-bold">Exam Proctor:</span> {securityNotice}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={dismissSecurityNotice}
              className="bg-white text-amber-900 hover:bg-amber-50 shrink-0 border-white text-xs h-8"
            >
              I Understand
            </Button>
          </div>
        </div>
      )}

      {tabSwitchWarnings > 0 && !securityNotice && (
        <div className="bg-slate-100 border-b border-slate-200 px-4 py-1.5 text-xs text-slate-600">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-amber-700 font-medium">
              <ShieldAlert className="h-3.5 w-3.5" /> Security Notice: {tabSwitchWarnings} tab-switch infraction(s) logged.
            </span>
            <span className="text-slate-400 hidden sm:inline">Invigilator session active</span>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-4xl mx-auto w-full p-4 sm:p-8 flex flex-col md:flex-row gap-8">
        
        <div className="flex-1 flex flex-col">
          <div className="mb-6 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
              Question {currentIndex + 1} of {questions.length}
            </span>
            <Button variant="ghost" size="sm" onClick={toggleFlag} className={flagged.has(currentIndex) ? "text-amber-500 bg-amber-50" : "text-gray-400"}>
              <Flag className="h-4 w-4 mr-2" />
              {flagged.has(currentIndex) ? "Flagged for review" : "Mark for review"}
            </Button>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sm:p-8 mb-8">
            <div className="flex items-center gap-2 mb-2">
              {currentQuestion.question_type === 'WRITTEN' && (
                <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Written</span>
              )}
              <span className="text-xs text-gray-400">{currentQuestion.points} pt{currentQuestion.points !== 1 ? 's' : ''}</span>
            </div>
            <h2 className="text-xl font-medium text-gray-900 mb-8 leading-relaxed">
              {currentQuestion.question_text}
            </h2>

            {currentQuestion.question_type === 'WRITTEN' ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-600">Your Answer</Label>
                <textarea
                  className="flex min-h-[200px] w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 leading-relaxed"
                  value={writtenAnswers[currentQuestion.id] || ""}
                  onChange={(e) => handleWrittenAnswerChange(currentQuestion.id, e.target.value)}
                  placeholder="Type your answer here..."
                />
                <p className="text-xs text-gray-400">Your answer is saved automatically as you type.</p>
              </div>
            ) : (
              <div className="space-y-3" role="radiogroup" aria-label="Question options">
                {currentQuestion.options?.sort((a: any, b: any) => a.option_order - b.option_order).map((opt: any, index: number) => {
                  const isSelected = answers[currentQuestion.id] === opt.id;
                  const letter = String.fromCharCode(65 + index);

                  return (
                    <button
                      type="button"
                      key={opt.id}
                      id={`option-${opt.id}`}
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => handleSelectOption(opt.id)}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 sm:p-4.5 rounded-xl border-2 transition-all text-left select-none cursor-pointer active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-1",
                        isSelected 
                          ? "border-slate-900 bg-slate-50 shadow-sm" 
                          : "border-gray-200 bg-gray-50/60 hover:bg-gray-100 hover:border-gray-300"
                      )}
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "border-slate-900 bg-slate-900" : "border-gray-400 bg-white"
                      )}>
                        {isSelected && <div className="h-2.5 w-2.5 rounded-full bg-white" />}
                      </div>
                      <span className={cn(
                        "text-sm font-semibold w-5 shrink-0",
                        isSelected ? "text-slate-900" : "text-gray-400"
                      )}>
                        {letter}.
                      </span>
                      <span className={cn("text-base flex-1", isSelected ? "font-semibold text-slate-900" : "text-gray-800")}>
                        {opt.option_text}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-auto">
            <Button 
              variant="outline" 
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" /> Previous
            </Button>
            <Button 
              variant="default"
              onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
              disabled={currentIndex === questions.length - 1}
            >
              Next <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Question Navigator Desktop */}
        <div className="hidden md:block w-72 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-24">
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Navigator</h3>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((q: any, i: number) => {
                const isWritten = q.question_type === 'WRITTEN';
                const isAnswered = isWritten ? !!writtenAnswers[q.id] : !!answers[q.id];
                const isFlagged = flagged.has(i);
                const isCurrent = currentIndex === i;
                
                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(i)}
                    className={cn(
                      "h-10 w-10 rounded-md text-sm font-medium flex items-center justify-center relative transition-colors",
                      isCurrent ? "ring-2 ring-slate-900 ring-offset-2" : "",
                      isAnswered ? "bg-slate-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200",
                    )}
                  >
                    {i + 1}
                    {isFlagged && (
                      <div className="absolute -top-1 -right-1 h-3 w-3 bg-amber-500 rounded-full border-2 border-white" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
