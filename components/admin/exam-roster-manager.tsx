"use client";

import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { 
  enrollCandidates, 
  enrollByProgramme, 
  enrollByEmails, 
  unenrollCandidate, 
  toggleExamRosterOnly, 
  RosterCandidate 
} from "@/app/actions/roster";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Search, 
  Download, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  Mail, 
  CheckCircle2, 
  Clock, 
  X, 
  Loader2, 
  Check, 
  Filter,
  GraduationCap
} from "lucide-react";
import { format } from "date-fns";

interface StudentProfile {
  id: string;
  name: string;
  email: string;
  programme: string | null;
}

interface ExamRosterManagerProps {
  exam: {
    id: string;
    title: string;
    programme: string | null;
    roster_only?: boolean;
    status: string;
  };
  initialRoster: RosterCandidate[];
  allStudents: StudentProfile[];
}

export function ExamRosterManager({ exam, initialRoster, allStudents }: ExamRosterManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState(false);
  const [activeEnrollTab, setActiveEnrollTab] = useState<'select' | 'programme' | 'emails'>('select');

  // Table search & filter
  const [rosterSearch, setRosterSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Multi-select in modal
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [modalSearch, setModalSearch] = useState("");
  const [modalProgFilter, setModalProgFilter] = useState<string>("ALL");

  // Programme bulk enroll
  const [selectedProgramme, setSelectedProgramme] = useState<string>(exam.programme || "");

  // Email bulk enroll
  const [emailBatchText, setEmailBatchText] = useState("");
  const [batchFeedback, setBatchFeedback] = useState<string | null>(null);

  // Set of enrolled user IDs for quick lookup
  const enrolledUserIds = useMemo(() => {
    return new Set(initialRoster.map(r => r.user_id));
  }, [initialRoster]);

  // Unique list of programmes from registered students
  const availableProgrammes = useMemo(() => {
    const progs = new Set<string>();
    if (exam.programme) progs.add(exam.programme);
    for (const s of allStudents) {
      if (s.programme?.trim()) progs.add(s.programme.trim());
    }
    return Array.from(progs).sort();
  }, [allStudents, exam.programme]);

  // Enrolled list filtered by search and status
  const filteredRoster = useMemo(() => {
    return initialRoster.filter(item => {
      const q = rosterSearch.toLowerCase();
      const matchesSearch = 
        !q ||
        item.profile.name.toLowerCase().includes(q) ||
        item.profile.email.toLowerCase().includes(q) ||
        (item.profile.programme && item.profile.programme.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (statusFilter === "ALL") return true;
      if (statusFilter === "NOT_STARTED") return !item.attempt;
      if (statusFilter === "IN_PROGRESS") return item.attempt?.status === "IN_PROGRESS";
      if (statusFilter === "SUBMITTED") return item.attempt?.status === "SUBMITTED";

      return true;
    });
  }, [initialRoster, rosterSearch, statusFilter]);

  // Available students in enrollment modal
  const eligibleStudents = useMemo(() => {
    return allStudents.filter(s => {
      const q = modalSearch.toLowerCase();
      const matchesSearch = 
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q) ||
        (s.programme && s.programme.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (modalProgFilter !== "ALL" && s.programme !== modalProgFilter) {
        return false;
      }

      return true;
    });
  }, [allStudents, modalSearch, modalProgFilter]);

  // Compute stats
  const stats = useMemo(() => {
    let notStarted = 0;
    let inProgress = 0;
    let submitted = 0;

    for (const r of initialRoster) {
      if (!r.attempt) notStarted++;
      else if (r.attempt.status === 'IN_PROGRESS') inProgress++;
      else if (r.attempt.status === 'SUBMITTED') submitted++;
    }

    return { total: initialRoster.length, notStarted, inProgress, submitted };
  }, [initialRoster]);

  // Handlers
  const handleToggleRosterOnly = () => {
    const nextState = !exam.roster_only;
    startTransition(async () => {
      try {
        await toggleExamRosterOnly(exam.id, nextState);
        router.refresh();
      } catch (err: any) {
        alert("Failed to update access policy: " + err.message);
      }
    });
  };

  const handleEnrollSelected = () => {
    if (selectedUserIds.length === 0) return;
    startTransition(async () => {
      try {
        await enrollCandidates(exam.id, selectedUserIds);
        setSelectedUserIds([]);
        setIsEnrollModalOpen(false);
        router.refresh();
      } catch (err: any) {
        alert("Error enrolling students: " + err.message);
      }
    });
  };

  const handleEnrollProgramme = () => {
    if (!selectedProgramme) {
      alert("Please select a programme.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await enrollByProgramme(exam.id, selectedProgramme);
        alert((res as any)?.message || `Successfully enrolled candidates from ${selectedProgramme}`);
        setIsEnrollModalOpen(false);
        router.refresh();
      } catch (err: any) {
        alert("Error enrolling by programme: " + err.message);
      }
    });
  };

  const handleEnrollEmails = () => {
    if (!emailBatchText.trim()) return;
    startTransition(async () => {
      try {
        const res = await enrollByEmails(exam.id, emailBatchText);
        setBatchFeedback(res.message);
        if (res.success && res.count > 0) {
          setEmailBatchText("");
          router.refresh();
        }
      } catch (err: any) {
        setBatchFeedback("Error: " + err.message);
      }
    });
  };

  const handleUnenroll = (userId: string, studentName: string) => {
    if (!confirm(`Are you sure you want to remove "${studentName}" from this exam roster?`)) {
      return;
    }
    startTransition(async () => {
      try {
        await unenrollCandidate(exam.id, userId);
        router.refresh();
      } catch (err: any) {
        alert("Failed to unenroll: " + err.message);
      }
    });
  };

  const handleExportCSV = () => {
    if (initialRoster.length === 0) {
      alert("No enrolled candidates to export.");
      return;
    }

    const headers = ["Name", "Email", "Programme", "Enrollment Date", "Status", "Score", "Percentage", "Submitted At"];
    const rows = initialRoster.map(r => [
      `"${r.profile.name.replace(/"/g, '""')}"`,
      `"${r.profile.email.replace(/"/g, '""')}"`,
      `"${(r.profile.programme || '').replace(/"/g, '""')}"`,
      `"${format(new Date(r.enrolled_at), "yyyy-MM-dd HH:mm")}"`,
      `"${r.attempt?.status || 'NOT_STARTED'}"`,
      r.attempt?.score != null ? r.attempt.score : '',
      r.attempt?.percentage != null ? `${r.attempt.percentage}%` : '',
      r.attempt?.submitted_at ? `"${format(new Date(r.attempt.submitted_at), "yyyy-MM-dd HH:mm")}"` : ''
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `roster_${exam.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Access Mode Switcher */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className={`p-4 sm:p-6 border-b ${exam.roster_only ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-lg shrink-0 ${exam.roster_only ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                {exam.roster_only ? <Lock className="h-5 w-5" /> : <Unlock className="h-5 w-5" />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">Candidate Access Policy</h3>
                  <Badge variant={exam.roster_only ? "default" : "outline"} className={exam.roster_only ? "bg-amber-700 hover:bg-amber-700" : ""}>
                    {exam.roster_only ? "Strict Roster Only" : "Programme-Wide Open"}
                  </Badge>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-xl">
                  {exam.roster_only 
                    ? "Strict mode is ACTIVE: Only students explicitly enrolled in the roster below can view and take this exam. All other candidates are restricted."
                    : `Open mode: Any student belonging to "${exam.programme || 'all programmes'}" can see and take this exam once live.`
                  }
                </p>
              </div>
            </div>

            <Button 
              variant={exam.roster_only ? "outline" : "default"}
              size="sm"
              onClick={handleToggleRosterOnly}
              disabled={isPending}
              className="shrink-0"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {exam.roster_only ? "Switch to Programme-Wide" : "Enforce Strict Roster"}
            </Button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-slate-100 border-b border-slate-100 bg-white text-center py-3">
          <div className="p-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Total Enrolled</span>
            <span className="text-2xl font-bold text-slate-900 mt-0.5 block">{stats.total}</span>
          </div>
          <div className="p-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Not Started</span>
            <span className="text-2xl font-bold text-slate-600 mt-0.5 block">{stats.notStarted}</span>
          </div>
          <div className="p-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">In Progress</span>
            <span className="text-2xl font-bold text-blue-600 mt-0.5 block">{stats.inProgress}</span>
          </div>
          <div className="p-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">Completed</span>
            <span className="text-2xl font-bold text-emerald-600 mt-0.5 block">{stats.submitted}</span>
          </div>
        </div>

        {/* Controls & Search */}
        <div className="p-4 sm:p-6 bg-white space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1 max-w-lg">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search enrolled candidates..."
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700"
              >
                <option value="ALL">All Statuses ({stats.total})</option>
                <option value="NOT_STARTED">Not Started ({stats.notStarted})</option>
                <option value="IN_PROGRESS">In Progress ({stats.inProgress})</option>
                <option value="SUBMITTED">Completed ({stats.submitted})</option>
              </select>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleExportCSV}
                disabled={initialRoster.length === 0}
                className="text-slate-700"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Roster
              </Button>
              <Button 
                size="sm"
                onClick={() => {
                  setBatchFeedback(null);
                  setIsEnrollModalOpen(true);
                }}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Enroll Candidates
              </Button>
            </div>
          </div>

          {/* Roster Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Candidate Name</th>
                    <th className="px-5 py-3 font-semibold">Email</th>
                    <th className="px-5 py-3 font-semibold">Programme</th>
                    <th className="px-5 py-3 font-semibold">Exam Status</th>
                    <th className="px-5 py-3 font-semibold">Enrolled</th>
                    <th className="px-5 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRoster.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                        {initialRoster.length === 0 ? (
                          <div className="max-w-sm mx-auto space-y-3">
                            <Users className="h-10 w-10 text-slate-300 mx-auto" />
                            <h4 className="font-semibold text-slate-800">No candidates enrolled yet</h4>
                            <p className="text-xs text-slate-500">
                              Enroll students individually, bulk-register an entire programme cohort, or paste emails.
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setIsEnrollModalOpen(true)}
                              className="mt-2"
                            >
                              <UserPlus className="h-4 w-4 mr-1.5" /> Add Candidates Now
                            </Button>
                          </div>
                        ) : (
                          <span>No enrolled candidates match your search filter.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredRoster.map((candidate) => {
                      const isCompleted = candidate.attempt?.status === 'SUBMITTED';
                      const isInProgress = candidate.attempt?.status === 'IN_PROGRESS';

                      return (
                        <tr key={candidate.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {candidate.profile.name}
                          </td>
                          <td className="px-5 py-3 text-slate-600">
                            {candidate.profile.email}
                          </td>
                          <td className="px-5 py-3">
                            {candidate.profile.programme ? (
                              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">
                                {candidate.profile.programme}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs italic">General</span>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {isCompleted ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Submitted {candidate.attempt?.percentage != null ? `(${candidate.attempt.percentage}%)` : ''}
                                </span>
                              </div>
                            ) : isInProgress ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                                <Clock className="h-3 w-3 mr-1 animate-pulse" />
                                Writing Exam
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                                Ready / Not Started
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-xs text-slate-500">
                            {format(new Date(candidate.enrolled_at), "MMM d, yyyy")}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              disabled={isPending || isCompleted}
                              onClick={() => handleUnenroll(candidate.user_id, candidate.profile.name)}
                              className="text-slate-400 hover:text-red-600 h-8 px-2"
                              title={isCompleted ? "Cannot remove candidate who already submitted" : "Remove from roster"}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </Card>

      {/* Enroll Candidates Modal */}
      {isEnrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Enroll Candidates</h3>
                <p className="text-xs text-slate-500">Assign students to &quot;{exam.title}&quot;</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsEnrollModalOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200 bg-white px-6">
              <button
                type="button"
                onClick={() => setActiveEnrollTab('select')}
                className={`py-3 px-4 font-medium text-xs border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeEnrollTab === 'select'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Users className="h-4 w-4" />
                Select Students
              </button>
              <button
                type="button"
                onClick={() => setActiveEnrollTab('programme')}
                className={`py-3 px-4 font-medium text-xs border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeEnrollTab === 'programme'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="h-4 w-4" />
                By Programme Cohort
              </button>
              <button
                type="button"
                onClick={() => setActiveEnrollTab('emails')}
                className={`py-3 px-4 font-medium text-xs border-b-2 flex items-center gap-1.5 transition-colors ${
                  activeEnrollTab === 'emails'
                    ? 'border-slate-900 text-slate-900 font-semibold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Mail className="h-4 w-4" />
                Bulk Email / List
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB 1: SELECT INDIVIDUAL STUDENTS */}
              {activeEnrollTab === 'select' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <Input 
                        placeholder="Search student by name or email..."
                        value={modalSearch}
                        onChange={(e) => setModalSearch(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                    <select
                      value={modalProgFilter}
                      onChange={(e) => setModalProgFilter(e.target.value)}
                      className="h-9 px-3 rounded-md border border-slate-200 bg-white text-xs font-medium text-slate-700"
                    >
                      <option value="ALL">All Programmes</option>
                      {availableProgrammes.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-72 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 sticky top-0">
                        <tr>
                          <th className="p-3 w-10 text-center">
                            <input 
                              type="checkbox"
                              checked={
                                eligibleStudents.length > 0 && 
                                eligibleStudents.filter(s => !enrolledUserIds.has(s.id)).every(s => selectedUserIds.includes(s.id))
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const notEnrolled = eligibleStudents
                                    .filter(s => !enrolledUserIds.has(s.id))
                                    .map(s => s.id);
                                  setSelectedUserIds(Array.from(new Set([...selectedUserIds, ...notEnrolled])));
                                } else {
                                  const removeIds = new Set(eligibleStudents.map(s => s.id));
                                  setSelectedUserIds(selectedUserIds.filter(id => !removeIds.has(id)));
                                }
                              }}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-950"
                            />
                          </th>
                          <th className="p-3 font-semibold">Student</th>
                          <th className="p-3 font-semibold">Programme</th>
                          <th className="p-3 font-semibold text-right">Roster Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eligibleStudents.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-slate-500">
                              No students found matching your criteria.
                            </td>
                          </tr>
                        ) : (
                          eligibleStudents.map(student => {
                            const isAlreadyEnrolled = enrolledUserIds.has(student.id);
                            const isChecked = selectedUserIds.includes(student.id);

                            return (
                              <tr 
                                key={student.id} 
                                className={`hover:bg-slate-50 transition-colors ${isAlreadyEnrolled ? 'bg-slate-50/50 opacity-60' : ''}`}
                              >
                                <td className="p-3 text-center">
                                  <input 
                                    type="checkbox"
                                    disabled={isAlreadyEnrolled}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedUserIds([...selectedUserIds, student.id]);
                                      } else {
                                        setSelectedUserIds(selectedUserIds.filter(id => id !== student.id));
                                      }
                                    }}
                                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-950"
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="font-medium text-slate-900">{student.name}</div>
                                  <div className="text-slate-500 text-[11px]">{student.email}</div>
                                </td>
                                <td className="p-3">
                                  {student.programme ? (
                                    <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[11px]">
                                      {student.programme}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">None</span>
                                  )}
                                </td>
                                <td className="p-3 text-right">
                                  {isAlreadyEnrolled ? (
                                    <span className="inline-flex items-center text-emerald-700 font-medium text-[11px]">
                                      <Check className="h-3 w-3 mr-1" /> Enrolled
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[11px]">Available</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>{selectedUserIds.length} student(s) selected</span>
                    <Button 
                      size="sm"
                      onClick={handleEnrollSelected}
                      disabled={isPending || selectedUserIds.length === 0}
                      className="bg-slate-900 text-white"
                    >
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enroll Selected ({selectedUserIds.length})
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: BULK ENROLL BY PROGRAMME */}
              {activeEnrollTab === 'programme' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-xs text-blue-800">
                    <p className="font-semibold mb-1">One-Click Cohort Enrollment</p>
                    <p>
                      This will find all registered students with the selected programme or course code and add them to this exam&apos;s official roster.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Select Cohort / Programme</Label>
                    <select
                      value={selectedProgramme}
                      onChange={(e) => setSelectedProgramme(e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-slate-200 bg-white text-sm"
                    >
                      <option value="">Select Programme...</option>
                      {availableProgrammes.map(p => {
                        const count = allStudents.filter(s => s.programme?.trim() === p).length;
                        return (
                          <option key={p} value={p}>
                            {p} ({count} student{count !== 1 ? 's' : ''})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button 
                      size="sm"
                      onClick={handleEnrollProgramme}
                      disabled={isPending || !selectedProgramme}
                      className="bg-slate-900 text-white"
                    >
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Enroll All Students in {selectedProgramme || 'Programme'}
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 3: BULK ENROLL BY EMAILS */}
              {activeEnrollTab === 'emails' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold">Candidate Emails</Label>
                    <p className="text-xs text-slate-500">
                      Paste student email addresses separated by commas, spaces, or newlines.
                    </p>
                    <textarea 
                      rows={5}
                      value={emailBatchText}
                      onChange={(e) => setEmailBatchText(e.target.value)}
                      placeholder={`student1@example.com\nstudent2@example.com, student3@example.com`}
                      className="w-full p-3 rounded-md border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  {batchFeedback && (
                    <div className="bg-slate-100 p-3 rounded-md text-xs text-slate-700 font-medium">
                      {batchFeedback}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <Button 
                      size="sm"
                      onClick={handleEnrollEmails}
                      disabled={isPending || !emailBatchText.trim()}
                      className="bg-slate-900 text-white"
                    >
                      {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Process and Enroll Emails
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setIsEnrollModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
