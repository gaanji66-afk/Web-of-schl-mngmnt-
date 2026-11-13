import { CheckCircle2, Printer, UserPlus, GraduationCap } from 'lucide-react';
import type { SubmittedAdmission } from '../types/admission';

interface AdmissionSlipStepProps {
  admission: SubmittedAdmission;
  onRegisterAnother: () => void;
}

export function AdmissionSlipStep({ admission, onRegisterAnother }: AdmissionSlipStepProps) {
  const formattedDate = admission.submittedAt.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="p-5 sm:p-7 space-y-6">
      {/* Printable Official Slip Container */}
      <div className="print-only-container rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
        {/* Slip Institutional Header */}
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-900 text-white shrink-0">
              <GraduationCap className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                Admission Confirmation Slip
              </p>
              <h2 className="text-lg font-bold text-slate-900">{admission.instituteName}</h2>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 self-start rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 sm:self-auto">
            <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
            <span>Submitted &amp; Verified</span>
          </div>
        </div>

        {/* Application ID Banner */}
        <div className="mt-5 flex flex-col gap-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs font-medium text-slate-600">
            Application / Registration ID
          </span>
          <span className="font-mono text-sm font-semibold tabular-nums text-slate-900 select-all">
            {admission.studentId}
          </span>
        </div>

        {/* Structured Details Definition List */}
        <dl className="mt-5 divide-y divide-slate-200 border-y border-slate-200 text-sm">
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500">Student Full Name</dt>
            <dd className="font-semibold text-slate-900 sm:col-span-2">{admission.name}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500">Father&apos;s Name</dt>
            <dd className="font-semibold text-slate-900 sm:col-span-2">{admission.fatherName}</dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500">Verified Mobile Number</dt>
            <dd className="font-mono font-semibold tabular-nums text-slate-900 sm:col-span-2">
              +91 {admission.mainContactNumber}
            </dd>
          </div>
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500">Enrolled Class</dt>
            <dd className="font-semibold text-slate-900 sm:col-span-2">{admission.className}</dd>
          </div>
          {admission.section && (
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
              <dt className="font-medium text-slate-500">Section</dt>
              <dd className="font-semibold text-slate-900 sm:col-span-2">{admission.section}</dd>
            </div>
          )}
          <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
            <dt className="font-medium text-slate-500">Submitted On</dt>
            <dd className="font-mono text-xs sm:text-sm tabular-nums text-slate-700 sm:col-span-2">
              {formattedDate}
            </dd>
          </div>
        </dl>

        {/* Mandatory Institutional Notice */}
        <div className="mt-5 rounded-lg border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950">
          <p className="font-medium leading-relaxed">
            Admission application submitted successfully. Please contact the coaching center for batch timings and fee deposition.
          </p>
        </div>
      </div>

      {/* Action Buttons (hidden during print) */}
      <div className="no-print flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 transition-colors whitespace-nowrap"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>Print / Save as PDF</span>
        </button>

        <button
          type="button"
          onClick={onRegisterAnother}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 transition-colors whitespace-nowrap"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          <span>Register Another Student</span>
        </button>
      </div>
    </div>
  );
}
