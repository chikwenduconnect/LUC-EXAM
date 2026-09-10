'use client';

import { useState } from 'react';
import { Plus, CheckCircle2, Circle, Trash2, PauseCircle, PlayCircle, FileText } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type Question = {
  id: string;
  text: string;
  options: string[];
  correctOptionIndex: number;
};

type Exam = {
  id: string;
  title: string;
  status: 'active' | 'paused' | 'draft';
  questions: Question[];
};

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([
    { 
      id: '1', 
      title: 'Introduction to Computer Science', 
      status: 'active',
      questions: [
        { id: 'q1', text: 'What does CPU stand for?', options: ['Central Process Unit', 'Central Processing Unit', 'Computer Personal Unit'], correctOptionIndex: 1 }
      ]
    }
  ]);
  
  const [selectedExamId, setSelectedExamId] = useState<string>('1');
  
  const [isAddQuestionModalOpen, setIsAddQuestionModalOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState({ text: '', options: ['', '', '', ''], correctOptionIndex: 0 });

  const activeExam = exams.find(e => e.id === selectedExamId);

  const toggleExamStatus = (examId: string) => {
    setExams(exams.map(exam => {
      if (exam.id === examId) {
        return { ...exam, status: exam.status === 'active' ? 'paused' : 'active' };
      }
      return exam;
    }));
  };

  const deleteExam = (examId: string) => {
    setExams(exams.filter(e => e.id !== examId));
    if (selectedExamId === examId) setSelectedExamId('');
  };
  
  const deleteQuestion = (examId: string, questionId: string) => {
    setExams(exams.map(exam => {
      if (exam.id === examId) {
        return { ...exam, questions: exam.questions.filter(q => q.id !== questionId) };
      }
      return exam;
    }));
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.text || newQuestion.options.some(opt => !opt.trim())) return;
    
    setExams(exams.map(exam => {
      if (exam.id === selectedExamId) {
        return {
          ...exam,
          questions: [...exam.questions, {
            id: Math.random().toString(36).substring(7),
            text: newQuestion.text,
            options: newQuestion.options,
            correctOptionIndex: newQuestion.correctOptionIndex
          }]
        };
      }
      return exam;
    }));
    
    setNewQuestion({ text: '', options: ['', '', '', ''], correctOptionIndex: 0 });
    setIsAddQuestionModalOpen(false);
  };

  const handleOptionChange = (index: number, value: string) => {
    const updatedOptions = [...newQuestion.options];
    updatedOptions[index] = value;
    setNewQuestion({ ...newQuestion, options: updatedOptions });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto w-full flex gap-8">
      {/* Exams List Sidebar */}
      <div className="w-1/3 flex flex-col gap-4">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-xl font-bold text-gray-900">All Exams</h2>
          <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
            <Plus size={20} />
          </button>
        </div>
        
        <div className="flex flex-col gap-2">
          {exams.map(exam => (
            <div 
              key={exam.id}
              onClick={() => setSelectedExamId(exam.id)}
              className={`p-4 rounded-xl cursor-pointer border transition-all ${
                selectedExamId === exam.id 
                  ? 'border-blue-500 bg-blue-50/50 shadow-sm' 
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-gray-900 pr-4">{exam.title}</h3>
                <div className="flex gap-1 mt-1">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleExamStatus(exam.id); }}
                    className={`p-1 rounded ${exam.status === 'active' ? 'text-amber-500 hover:bg-amber-50' : 'text-green-500 hover:bg-green-50'}`}
                    title={exam.status === 'active' ? "Pause Exam" : "Resume Exam"}
                  >
                    {exam.status === 'active' ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); deleteExam(exam.id); }}
                    className="p-1 rounded text-red-500 hover:bg-red-50"
                    title="Delete Exam"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  exam.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {exam.status.charAt(0).toUpperCase() + exam.status.slice(1)}
                </span>
                <span className="text-gray-500">{exam.questions.length} questions</span>
              </div>
            </div>
          ))}
          {exams.length === 0 && (
            <div className="p-8 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">
              No exams found. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {/* Selected Exam Editor */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border p-6 min-h-[600px]">
        {activeExam ? (
          <div>
            <div className="flex justify-between items-start border-b pb-6 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{activeExam.title}</h1>
                <p className="text-gray-500 mt-1">Manage questions and exam settings</p>
              </div>
              
              <Dialog.Root open={isAddQuestionModalOpen} onOpenChange={setIsAddQuestionModalOpen}>
                <Dialog.Trigger asChild>
                  <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                    <Plus size={20} />
                    Add Question
                  </button>
                </Dialog.Trigger>
                
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" />
                  <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-6 w-full max-w-lg z-50 max-h-[90vh] overflow-y-auto">
                    <Dialog.Title className="text-xl font-semibold mb-4">Add New Question</Dialog.Title>
                    <p className="text-gray-500 text-sm mb-6">Enter the question text and options. Select the radio button next to the correct answer.</p>
                    
                    <form onSubmit={handleAddQuestion} className="space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
                        <textarea 
                          required
                          rows={3}
                          className="w-full border rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          placeholder="e.g., What is the capital of France?"
                          value={newQuestion.text}
                          onChange={(e) => setNewQuestion({...newQuestion, text: e.target.value})}
                        />
                      </div>
                      
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-gray-700">Options</label>
                        {newQuestion.options.map((opt, idx) => (
                          <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg border ${newQuestion.correctOptionIndex === idx ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                            <button 
                              type="button"
                              onClick={() => setNewQuestion({...newQuestion, correctOptionIndex: idx})}
                              className={`flex-shrink-0 focus:outline-none ${newQuestion.correctOptionIndex === idx ? 'text-green-600' : 'text-gray-300 hover:text-gray-400'}`}
                            >
                              {newQuestion.correctOptionIndex === idx ? <CheckCircle2 size={24} /> : <Circle size={24} />}
                            </button>
                            <input
                              type="text"
                              required
                              className="flex-1 bg-transparent outline-none"
                              placeholder={`Option ${idx + 1}`}
                              value={opt}
                              onChange={(e) => handleOptionChange(idx, e.target.value)}
                            />
                          </div>
                        ))}
                      </div>
                      
                      <div className="flex justify-end gap-3 pt-4 border-t mt-6">
                        <Dialog.Close asChild>
                          <button type="button" className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                            Cancel
                          </button>
                        </Dialog.Close>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium">
                          Save Question
                        </button>
                      </div>
                    </form>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            </div>
            
            <div className="space-y-4">
              {activeExam.questions.map((question, qIdx) => (
                <div key={question.id} className="p-4 border rounded-xl bg-gray-50/50">
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium text-gray-900">
                      <span className="text-gray-500 mr-2">{qIdx + 1}.</span>
                      {question.text}
                    </h4>
                    <button 
                      onClick={() => deleteQuestion(activeExam.id, question.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Question"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  
                  <div className="space-y-2 pl-6">
                    {question.options.map((opt, optIdx) => (
                      <div 
                        key={optIdx} 
                        className={`flex items-center gap-3 p-3 rounded-lg border ${
                          optIdx === question.correctOptionIndex 
                            ? 'bg-green-50 border-green-200 text-green-900' 
                            : 'bg-white border-gray-200 text-gray-700'
                        }`}
                      >
                        {optIdx === question.correctOptionIndex ? (
                          <CheckCircle2 size={18} className="text-green-600" />
                        ) : (
                          <Circle size={18} className="text-gray-300" />
                        )}
                        <span>{opt}</span>
                        {optIdx === question.correctOptionIndex && (
                          <span className="ml-auto text-xs font-semibold text-green-600 uppercase tracking-wider">Correct Answer</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              {activeExam.questions.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No questions added to this exam yet.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <FileText size={48} className="text-gray-300 mb-4" />
            <p className="text-lg">Select an exam to view and edit its questions.</p>
          </div>
        )}
      </div>
    </div>
  );
}
