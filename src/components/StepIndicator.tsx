import { Check } from 'lucide-react';
import type { AdmissionStep } from '../types/admission';

interface StepIndicatorProps {
  currentStep: AdmissionStep;
}

const STEPS: { id: AdmissionStep; number: string; label: string }[] = [
  { id: 'details', number: '01', label: 'Student Details' },
  { id: 'otp', number: '02', label: 'OTP Verification' },
  { id: 'confirmation', number: '03', label: 'Admission Slip' },
];

export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === currentStep);

  return (
    <div aria-label="Admission progress" className="border-b border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-7">
      <ol className="grid grid-cols-3 gap-2 sm:gap-4">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-2.5 min-w-0">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-mono font-semibold transition-colors ${
                  isCompleted
                    ? 'bg-emerald-700 text-white'
                    : isCurrent
                      ? 'bg-indigo-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-500'
                }`}
              >
                {isCompleted ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : step.number}
              </span>
              <span
                className={`text-xs sm:text-sm font-medium truncate ${
                  isCurrent
                    ? 'text-slate-900 font-semibold'
                    : isCompleted
                      ? 'text-emerald-800'
                      : 'text-slate-500'
                }`}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
