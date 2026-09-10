"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Loader2 } from "lucide-react";
import { createParticipantManually } from "@/app/actions/participant";

export function AddParticipantDialog({ availableExams }: { availableExams: { id: string, title: string, status: string }[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const handleAction = async (formData: FormData) => {
    setError("");
    startTransition(async () => {
      try {
        const result = await createParticipantManually(formData);
        if (result.success) {
          setOpen(false);
        } else {
          setError(result.error || "Failed to create participant");
        }
      } catch (err: any) {
        setError(err.message || "An unexpected error occurred");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <UserPlus className="h-4 w-4" />
          Add Student Manually
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add Student Manually</DialogTitle>
          <DialogDescription>
            Create a new student profile and optionally assign them to an exam roster.
          </DialogDescription>
        </DialogHeader>
        <form action={handleAction} className="space-y-4 py-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
            <Input id="name" name="name" required placeholder="e.g. John Doe" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
            <Input id="email" name="email" type="email" required placeholder="e.g. student@luc.edu" />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Initial Password</Label>
            <Input id="password" name="password" type="text" placeholder="Defaults to: Student123!" />
            <p className="text-xs text-slate-500">The student will use this to log in.</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="programme">Programme / Course (Optional)</Label>
            <Input id="programme" name="programme" placeholder="e.g. BSc Computer Science" />
          </div>

          <div className="space-y-2 pt-2">
            <Label htmlFor="exam_id">Assign to Exam Roster (Optional)</Label>
            <select 
              id="exam_id" 
              name="exam_id" 
              className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">-- No Exam Assigned --</option>
              {availableExams.map(exam => (
                <option key={exam.id} value={exam.id}>
                  {exam.title} ({exam.status})
                </option>
              ))}
            </select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Student
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
