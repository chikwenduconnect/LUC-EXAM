"use client";

import { useState } from "react";
import { addMultipleChoiceQuestion, addWrittenQuestion } from "@/app/actions/exam";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2, FileText, List, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuestionBuilder({ examId }: { examId: string }) {
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [questionType, setQuestionType] = useState<"MULTIPLE_CHOICE" | "WRITTEN">("MULTIPLE_CHOICE");
  const [questionText, setQuestionText] = useState("");
  const [rubric, setRubric] = useState("");
  const [modelAnswer, setModelAnswer] = useState("");
  const [points, setPoints] = useState(1);
  const [options, setOptions] = useState([{ text: "" }, { text: "" }, { text: "" }, { text: "" }]);
  const [correctIndex, setCorrectIndex] = useState(0);

  const handleAddOption = () => {
    setOptions([...options, { text: "" }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    if (correctIndex === index) setCorrectIndex(0);
    else if (correctIndex > index) setCorrectIndex(correctIndex - 1);
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleOptionChange = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].text = text;
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (questionType === "MULTIPLE_CHOICE" && options.some(o => !o.text.trim())) {
      alert("All options must have text.");
      return;
    }

    setLoading(true);
    try {
      if (questionType === "WRITTEN") {
        await addWrittenQuestion(examId, questionText, points, rubric, modelAnswer);
      } else {
        await addMultipleChoiceQuestion(examId, questionText, points, options, correctIndex);
      }
      setIsOpen(false);
      resetForm();
    } catch (err: any) {
      alert("Error adding question: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setQuestionText("");
    setRubric("");
    setModelAnswer("");
    setOptions([{ text: "" }, { text: "" }, { text: "" }, { text: "" }]);
    setCorrectIndex(0);
    setPoints(1);
    setQuestionType("MULTIPLE_CHOICE");
  };

  if (!isOpen) {
    return (
      <Button onClick={() => setIsOpen(true)} className="w-full border-dashed border-2 py-8 bg-gray-50 text-gray-600 hover:bg-gray-100" variant="outline">
        <Plus className="h-5 w-5 mr-2" /> Add New Question
      </Button>
    );
  }

  return (
    <div className="border border-slate-200 rounded-xl bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-lg mb-4">Build Question</h3>
      <form onSubmit={handleSubmit} className="space-y-4">

        <div className="space-y-2">
          <Label>Question Type</Label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setQuestionType("MULTIPLE_CHOICE")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                questionType === "MULTIPLE_CHOICE"
                  ? "border-slate-900 bg-slate-50 text-slate-900"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
              )}
            >
              <List className="h-4 w-4" />
              Multiple Choice
            </button>
            <button
              type="button"
              onClick={() => setQuestionType("WRITTEN")}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all",
                questionType === "WRITTEN"
                  ? "border-slate-900 bg-slate-50 text-slate-900"
                  : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
              )}
            >
              <FileText className="h-4 w-4" />
              Written / Essay
            </button>
          </div>
          {questionType === "WRITTEN" && (
            <div className="flex items-start gap-2.5 p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-lg text-xs text-indigo-900 leading-relaxed">
              <Sparkles className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-indigo-950">AI-Powered Grading with Gemini:</span>
                <p className="mt-0.5 text-indigo-800">
                  Candidate responses will be automatically evaluated against your grading rubric upon exam submission. You can review and override the AI marks anytime.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Question Text <span className="text-red-500">*</span></Label>
          <textarea
            required
            className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            placeholder={questionType === "WRITTEN" ? "Type your essay/written question here..." : "Type your question here..."}
          />
        </div>

        {questionType === "WRITTEN" && (
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="rubric" className="flex items-center justify-between">
                <span>Grading Rubric / Marking Criteria <span className="text-red-500">*</span></span>
                <span className="text-xs font-normal text-slate-500">Guides AI marking</span>
              </Label>
              <textarea
                id="rubric"
                required
                rows={4}
                className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                placeholder={"Specify your scoring criteria. E.g.:\n- Clear definition of concept (3 pts)\n- Accurate real-world example (3 pts)\n- Discussion of key trade-offs (4 pts)"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="modelAnswer" className="flex items-center justify-between">
                <span>Model / Reference Answer <span className="text-xs font-normal text-slate-500">(Optional)</span></span>
                <span className="text-xs font-normal text-slate-400">Benchmark comparison</span>
              </Label>
              <textarea
                id="modelAnswer"
                rows={3}
                className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                value={modelAnswer}
                onChange={(e) => setModelAnswer(e.target.value)}
                placeholder="Optional reference response for AI to compare candidate answers against..."
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Points</Label>
          <Input 
            type="number" 
            min={1} 
            required 
            value={Number.isNaN(points) ? '' : points} 
            onChange={e => setPoints(parseInt(e.target.value))} 
            className="w-32"
          />
        </div>

        {questionType === "MULTIPLE_CHOICE" && (
          <div className="space-y-3 mt-6">
            <Label>Options & Correct Answer</Label>
            <p className="text-xs text-gray-500 mb-2">Select the radio button next to the correct option.</p>
            
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input 
                  type="radio" 
                  name="correctOption"
                  checked={correctIndex === idx}
                  onChange={() => setCorrectIndex(idx)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                />
                <Input 
                  required
                  value={opt.text}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  className={correctIndex === idx ? "border-indigo-300 bg-indigo-50/30" : ""}
                />
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleRemoveOption(idx)}
                  disabled={options.length <= 2}
                  className="text-gray-400 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            
            <Button type="button" variant="outline" size="sm" onClick={handleAddOption} className="mt-2">
              <Plus className="h-4 w-4 mr-2" /> Add Option
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 mt-6">
          <Button type="button" variant="ghost" onClick={() => { setIsOpen(false); resetForm(); }} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Question
          </Button>
        </div>

      </form>
    </div>
  );
}
