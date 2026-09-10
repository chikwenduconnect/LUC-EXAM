"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QuestionBuilder } from "@/components/admin/question-builder";
import { ExamRosterManager } from "@/components/admin/exam-roster-manager";
import { WrittenGrader, type GradingEntry } from "@/components/admin/written-grader";
import { RosterCandidate } from "@/app/actions/roster";
import { HelpCircle, Users, Lock, Unlock, PenLine } from "lucide-react";

interface ExamTabsViewProps {
  exam: any;
  questions: any[];
  roster: RosterCandidate[];
  allStudents: {
    id: string;
    name: string;
    email: string;
    programme: string | null;
  }[];
  writtenGradingEntries?: GradingEntry[];
}

export function ExamTabsView({ exam, questions, roster, allStudents, writtenGradingEntries = [] }: ExamTabsViewProps) {
  const [activeTab, setActiveTab] = useState<'questions' | 'roster' | 'grading'>('questions');
  const hasWrittenQuestions = questions?.some((q: any) => q.question_type === 'WRITTEN');

  return (
    <div className="space-y-6">
      {/* Primary Tab Bar */}
      <div className="flex border-b border-slate-200 gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('questions')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'questions'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          <span>Questions & Content</span>
          <Badge variant={activeTab === 'questions' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
            {questions?.length || 0}
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('roster')}
          className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'roster'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="h-4 w-4" />
          <span>Candidate Roster</span>
          <Badge variant={activeTab === 'roster' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
            {roster?.length || 0}
          </Badge>
          {exam.roster_only && (
            <span title="Strict candidate roster enforced">
              <Lock className="h-3.5 w-3.5 text-amber-600" />
            </span>
          )}
        </button>

        {hasWrittenQuestions && (
          <button
            type="button"
            onClick={() => setActiveTab('grading')}
            className={`pb-3 px-4 font-semibold text-sm border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'grading'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PenLine className="h-4 w-4" />
            <span>Grade Written</span>
            <Badge variant={activeTab === 'grading' ? 'default' : 'secondary'} className="text-xs px-1.5 py-0">
              {writtenGradingEntries.length}
            </Badge>
          </button>
        )}
      </div>

      {/* Tab 1: Questions */}
      {activeTab === 'questions' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Questions ({questions?.length || 0})</h2>
            <span className="text-xs text-gray-500">
              Total Points: {questions?.reduce((sum, q) => sum + q.points, 0) || 0} pts
            </span>
          </div>
          
          {questions?.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
              <p className="text-gray-500 mb-4">No questions added yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {questions?.map((q, i) => (
                <Card key={q.id}>
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <h4 className="font-medium text-gray-900">
                        {i + 1}. {q.question_text}
                      </h4>
                      <div className="flex items-center gap-2 shrink-0">
                        {q.question_type === 'WRITTEN' && (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">Written</Badge>
                        )}
                        <Badge variant="outline">{q.points} pt{q.points !== 1 ? 's' : ''}</Badge>
                      </div>
                    </div>
                    {q.question_type !== 'WRITTEN' && (
                      <div className="space-y-2">
                        {q.options?.sort((a: any, b: any) => a.option_order - b.option_order).map((opt: any, j: number) => (
                          <div key={opt.id} className="flex items-center gap-3 text-sm text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                            <span className="font-semibold text-gray-400 w-5">{String.fromCharCode(65 + j)}.</span>
                            {opt.option_text}
                          </div>
                        ))}
                      </div>
                    )}
                    {q.question_type === 'WRITTEN' && (
                      <p className="text-sm text-gray-500 italic">Students write their response in a text area. Graded manually after submission.</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {exam.status === 'DRAFT' && (
            <QuestionBuilder examId={exam.id} />
          )}
          {exam.status !== 'DRAFT' && (
            <div className="bg-amber-50 text-amber-800 p-4 rounded-md text-sm">
              Questions cannot be modified while the exam is {exam.status}.
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Candidate Roster */}
      {activeTab === 'roster' && (
        <ExamRosterManager 
          exam={exam} 
          initialRoster={roster} 
          allStudents={allStudents} 
        />
      )}

      {/* Tab 3: Grade Written Answers */}
      {activeTab === 'grading' && (
        <WrittenGrader
          examId={exam.id}
          entries={writtenGradingEntries}
        />
      )}
    </div>
  );
}
