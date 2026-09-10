"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateExamConfigAction } from "@/app/actions/roster";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function CreateExamPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    programme: "",
    description: "",
    access_code: "",
    duration_minutes: 60,
    pass_mark: 50,
    result_release_mode: "MANUAL",
    instructions: "Read all questions carefully. Your progress is saved automatically.",
    roster_only: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let createdExamId: string | null = null;
      const basePayload: any = {
        title: formData.title,
        programme: formData.programme,
        description: formData.description,
        duration_minutes: formData.duration_minutes,
        pass_mark: formData.pass_mark,
        result_release_mode: formData.result_release_mode,
        instructions: formData.instructions,
        status: "DRAFT"
      };

      // Insert into exams table using native columns only
      const { data, error } = await supabase
        .from("exams")
        .insert([basePayload])
        .select()
        .single();

      if (error) throw error;
      createdExamId = data.id;

      if (createdExamId) {
        // Safely persist exam access_code and roster_only settings
        await updateExamConfigAction(createdExamId, {
          access_code: formData.access_code || null,
          roster_only: formData.roster_only,
        });

        router.push(`/admin/exams/${createdExamId}`);
      }
    } catch (err: any) {
      setError(err.message || "Failed to create exam");
      setLoading(false);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <Link href="/admin/exams" className="text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" /> Back to Exams
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Create New Exam</h1>
        <p className="text-gray-500">Configure the basic details for the examination.</p>
      </div>

      <Card>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6 pt-6">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="title">Exam Title *</Label>
              <Input 
                id="title" 
                required 
                value={formData.title}
                onChange={e => setFormData({...formData, title: e.target.value})}
                placeholder="e.g. Web Development Assessment" 
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="programme">Programme / Category</Label>
                <Input 
                  id="programme" 
                  value={formData.programme}
                  onChange={e => setFormData({...formData, programme: e.target.value})}
                  placeholder="e.g. Software Engineering Cohort 4" 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="access_code">Exam Access Code (PIN)</Label>
                <Input 
                  id="access_code" 
                  value={formData.access_code}
                  onChange={e => setFormData({...formData, access_code: e.target.value})}
                  placeholder="e.g. 2026-FINAL (Leave blank for no PIN)" 
                />
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <input 
                type="checkbox"
                id="create_roster_only"
                checked={formData.roster_only}
                onChange={(e) => setFormData({...formData, roster_only: e.target.checked})}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-950"
              />
              <label htmlFor="create_roster_only" className="text-xs text-slate-700 cursor-pointer">
                <span className="font-semibold block text-slate-900">Enforce Strict Candidate Roster</span>
                Require explicit student enrollment. Only candidates added to the roster will be permitted to see and sit for this examination.
              </label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Short Description</Label>
              <Input 
                id="description" 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Brief summary of what this exam covers" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (Minutes) *</Label>
                <Input 
                  id="duration" 
                  type="number" 
                  min={5}
                  required 
                  value={Number.isNaN(formData.duration_minutes) ? '' : formData.duration_minutes}
                  onChange={e => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pass_mark">Pass Mark (%) *</Label>
                <Input 
                  id="pass_mark" 
                  type="number"
                  min={1}
                  max={100}
                  required 
                  value={Number.isNaN(formData.pass_mark) ? '' : formData.pass_mark}
                  onChange={e => setFormData({...formData, pass_mark: parseInt(e.target.value)})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="result_mode">Result Release Mode</Label>
              <select 
                id="result_mode"
                className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                value={formData.result_release_mode}
                onChange={e => setFormData({...formData, result_release_mode: e.target.value})}
              >
                <option value="MANUAL">Manual (Admin must release results)</option>
                <option value="IMMEDIATE">Immediate (Show score upon submission)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Participant Instructions</Label>
              <textarea 
                id="instructions" 
                className="flex min-h-[100px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                value={formData.instructions}
                onChange={e => setFormData({...formData, instructions: e.target.value})}
                placeholder="Instructions shown to participant before starting..."
              />
            </div>

          </CardContent>
          <CardFooter className="bg-gray-50 flex justify-end p-6 border-t border-gray-100">
            <Button type="button" variant="ghost" className="mr-2" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create Exam & Continue
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
