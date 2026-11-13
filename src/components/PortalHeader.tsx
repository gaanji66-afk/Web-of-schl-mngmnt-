import { GraduationCap, CheckCircle2 } from 'lucide-react';

interface PortalHeaderProps {
  instituteName?: string;
  academicSession?: string;
}

export function PortalHeader({
  instituteName = 'Coaching Center',
  academicSession = '2026–27',
}: PortalHeaderProps) {
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-4 py-3.5 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          className="flex items-center gap-2.5 text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 rounded-md"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-900 text-white shrink-0">
            <GraduationCap className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <span className="font-display text-base font-bold tracking-tight sm:text-lg truncate max-w-[210px] sm:max-w-none">
            {instituteName} Admission Portal
          </span>
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="Portal sections"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#admission-form"
            className="hover:text-indigo-900 transition-colors whitespace-nowrap shrink-0"
          >
            Registration
          </a>
          <a
            href="#admission-steps"
            className="hover:text-indigo-900 transition-colors whitespace-nowrap shrink-0"
          >
            Process
          </a>
          <a
            href="#guidelines"
            className="hover:text-indigo-900 transition-colors whitespace-nowrap shrink-0"
          >
            Guidelines
          </a>
        </nav>

        {/* Zone 3: Clear Institutional Status */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-900 whitespace-nowrap shrink-0">
            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-700 shrink-0" aria-hidden="true" />
            <span>Admissions Open {academicSession}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
