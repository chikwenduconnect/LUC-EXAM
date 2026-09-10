"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { updateExamConfigAction } from "@/app/actions/roster";
import { Loader2, Edit, X } from "lucide-react";

export function EditExamDetails({ exam }: { exam: any }) {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    title: exam.title,
    programme: exam.programme || "",
    access_code: exam.access_code || "",
    duration_minutes: exam.duration_minutes,
    pass_mark: exam.pass_mark,
    instructions: exam.instructions || "",
    roster_only: exam.roster_only || false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const standardPayload = {
        title: formData.title,
        programme: formData.programme,
        duration_minutes: formData.duration_minutes,
        pass_mark: formData.pass_mark,
        instructions: formData.instructions,
      };

      // Update native columns in exams table
      const { error } = await supabase
        .from('exams')
        .update(standardPayload)
        .eq('id', exam.id);

      if (error) throw error;

      // Safely persist exam settings
      await updateExamConfigAction(exam.id, {
        access_code: formData.access_code || null,
        roster_only: formData.roster_only,
      });
      
      setIsEditing(false);
      router.refresh();
    } catch (err: any) {
      alert("Error updating exam: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isEditing) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="w-full mt-4">
        <Edit className="h-4 w-4 mr-2" /> Edit Details
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-semibold text-lg">Edit Exam Details</h3>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input 
              required
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Programme / Course Code</Label>
              <Input 
                value={formData.programme}
                onChange={(e) => setFormData({...formData, programme: e.target.value})}
                placeholder="e.g. Computer Science, BIO101"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Access Code (PIN)</Label>
              <Input 
                value={formData.access_code}
                onChange={(e) => setFormData({...formData, access_code: e.target.value})}
                placeholder="Leave blank for no PIN"
              />
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <input 
              type="checkbox"
              id="edit_roster_only"
              checked={formData.roster_only}
              onChange={(e) => setFormData({...formData, roster_only: e.target.checked})}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-950"
            />
            <label htmlFor="edit_roster_only" className="text-xs text-slate-700 cursor-pointer">
              <span className="font-semibold block text-slate-900">Enforce Strict Candidate Roster</span>
              Only students explicitly assigned to this exam&apos;s roster will be permitted to access and write this paper.
            </label>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration (Minutes)</Label>
              <Input 
                type="number"
                required
                min={1}
                value={Number.isNaN(formData.duration_minutes) ? '' : formData.duration_minutes}
                onChange={(e) => setFormData({...formData, duration_minutes: parseInt(e.target.value)})}
              />
            </div>
            <div className="space-y-2">
              <Label>Pass Mark (%)</Label>
              <Input 
                type="number"
                required
                min={1}
                max={100}
                value={Number.isNaN(formData.pass_mark) ? '' : formData.pass_mark}
                onChange={(e) => setFormData({...formData, pass_mark: parseInt(e.target.value)})}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Instructions</Label>
            <textarea 
              className="flex min-h-[80px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
              value={formData.instructions}
              onChange={(e) => setFormData({...formData, instructions: e.target.value})}
              rows={4}
            />
          </div>
          
          <div className="pt-4 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsEditing(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
