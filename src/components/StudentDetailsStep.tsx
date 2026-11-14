import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Loader2,
  Phone,
  RefreshCw,
  ShieldAlert,
  User,
  Users,
  BookOpen,
} from 'lucide-react';
import {
  BLOCKED_PHONE_MESSAGE,
  checkBlockedNumber,
  normalizePhoneNumber,
} from '../services/admissionService';
import type { AdmissionFormValues, CoachingClass } from '../types/admission';

interface StudentDetailsStepProps {
  values: AdmissionFormValues;
  onChange: (updated: Partial<AdmissionFormValues>) => void;
  classes: CoachingClass[];
  loadingCatalog: boolean;
  catalogError: string | null;
  onRetryCatalog: () => void;
  onSendOtp: () => Promise<void>;
  sendingOtp: boolean;
  authError: string | null;
}

export function StudentDetailsStep({
  values,
  onChange,
  classes,
  loadingCatalog,
  catalogError,
  onRetryCatalog,
  onSendOtp,
  sendingOtp,
  authError,
}: StudentDetailsStepProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [checkingBlocked, setCheckingBlocked] = useState(false);
  const [blockedPhoneError, setBlockedPhoneError] = useState<string | null>(null);

  const selectedClass = classes.find((c) => c.id === values.classId) ?? null;
  const hasSections = Boolean(selectedClass && selectedClass.sections.length > 0);

  // Pre-check blocked_numbers whenever a 10-digit mobile number is entered
  useEffect(() => {
    const { isValid, tenDigits } = normalizePhoneNumber(values.mobileNumber);
    if (!isValid) {
      setBlockedPhoneError(null);
      setCheckingBlocked(false);
      return;
    }

    let cancelled = false;
    setCheckingBlocked(true);
    setBlockedPhoneError(null);

    const timer = window.setTimeout(async () => {
      try {
        const result = await checkBlockedNumber(tenDigits);
        if (!cancelled) {
          if (result.isBlocked) {
            setBlockedPhoneError(BLOCKED_PHONE_MESSAGE);
          } else {
            setBlockedPhoneError(null);
          }
        }
      } catch {
        // Non-blocking fallback: final check still runs on Send OTP and Post-Auth
      } finally {
        if (!cancelled) {
          setCheckingBlocked(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [values.mobileNumber]);

  const handleClassChange = (classId: string) => {
    const nextClass = classes.find((c) => c.id === classId);
    onChange({
      classId,
      className: nextClass ? nextClass.name : '',
      section: '',
    });
    setFormError(null);
  };

  const handlePhoneInput = (raw: string) => {
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 10);
    onChange({ mobileNumber: digitsOnly });
    setFormError(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedStudent = values.studentName.trim();
    const trimmedFather = values.fatherName.trim();
    const { isValid: validPhone, tenDigits } = normalizePhoneNumber(values.mobileNumber);

    if (trimmedStudent.length < 2) {
      setFormError('Please enter the student full name (at least 2 characters).');
      return;
    }
    if (trimmedFather.length < 2) {
      setFormError("Please enter the father's full name (at least 2 characters).");
      return;
    }
    if (!selectedClass) {
      setFormError('Please select a class to apply for.');
      return;
    }
    if (hasSections && !values.section) {
      setFormError('Please select a section for the chosen class.');
      return;
    }
    if (!validPhone) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    // Mandatory synchronous Pre-Check before triggering OTP
    setCheckingBlocked(true);
    try {
      const blockedResult = await checkBlockedNumber(tenDigits);
      if (blockedResult.isBlocked) {
        setBlockedPhoneError(BLOCKED_PHONE_MESSAGE);
        setCheckingBlocked(false);
        return;
      }
    } catch {
      setFormError('Unable to verify mobile number eligibility right now. Please try again.');
      setCheckingBlocked(false);
      return;
    }
    setCheckingBlocked(false);

    await onSendOtp();
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-7 space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          Student &amp; Academic Details
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Enter student particulars accurately. You will verify your mobile number via SMS OTP in the next step.
        </p>
      </div>

      {catalogError && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
            <span>{catalogError}</span>
          </div>
          <button
            type="button"
            onClick={onRetryCatalog}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      )}

      {!loadingCatalog && !catalogError && classes.length === 0 && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2.5">
            <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900">No active classes published yet</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Classes configured in the Coaching Management App under <code className="font-mono">coaching_setup</code> will appear here automatically.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetryCatalog}
            className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Refresh
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* 1. Student Full Name */}
        <div className="sm:col-span-1">
          <label htmlFor="studentName" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Student Full Name <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <User
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="studentName"
              name="studentName"
              type="text"
              required
              maxLength={100}
              autoComplete="name"
              placeholder="e.g. Aarav Sharma"
              value={values.studentName}
              onChange={(e) => {
                onChange({ studentName: e.target.value });
                setFormError(null);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>
        </div>

        {/* 2. Father's Name */}
        <div className="sm:col-span-1">
          <label htmlFor="fatherName" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Father&apos;s Name <span className="text-rose-600">*</span>
          </label>
          <div className="relative">
            <Users
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="fatherName"
              name="fatherName"
              type="text"
              required
              maxLength={100}
              placeholder="e.g. Rajesh Sharma"
              value={values.fatherName}
              onChange={(e) => {
                onChange({ fatherName: e.target.value });
                setFormError(null);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            />
          </div>
        </div>
      </div>

      {/* 3. Dynamic Class & 4. Conditional Section */}
      <div className={`grid grid-cols-1 gap-4 ${hasSections ? 'sm:grid-cols-2' : ''}`}>
        <div>
          <label htmlFor="classSelect" className="block text-sm font-semibold text-slate-800 mb-1.5">
            Class / Batch Selection <span className="text-rose-600">*</span>
          </label>
          {loadingCatalog ? (
            <div className="flex h-[42px] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-700" aria-hidden="true" />
              <span>Loading active classes…</span>
            </div>
          ) : (
            <select
              id="classSelect"
              name="classId"
              required
              disabled={classes.length === 0}
              value={values.classId}
              onChange={(e) => handleClassChange(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            >
              <option value="">
                {classes.length === 0 ? 'No active classes available' : 'Select class'}
              </option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Conditional Section Dropdown: Completely hidden when no sections exist */}
        {hasSections && selectedClass && (
          <div>
            <label htmlFor="sectionSelect" className="block text-sm font-semibold text-slate-800 mb-1.5">
              Section <span className="text-rose-600">*</span>
            </label>
            <select
              id="sectionSelect"
              name="section"
              required
              value={values.section}
              onChange={(e) => {
                onChange({ section: e.target.value });
                setFormError(null);
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20"
            >
              <option value="">Select section</option>
              {selectedClass.sections.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 5. Mobile Contact Number */}
      <div>
        <label htmlFor="mobileNumber" className="block text-sm font-semibold text-slate-800 mb-1.5">
          Mobile Contact Number <span className="text-rose-600">*</span>
        </label>
        <div className="flex rounded-lg border border-slate-300 bg-white focus-within:border-indigo-700 focus-within:ring-2 focus-within:ring-indigo-600/20 overflow-hidden">
          <span className="inline-flex items-center gap-1.5 border-r border-slate-200 bg-slate-50 px-3.5 text-sm font-mono font-medium text-slate-700 select-none">
            <Phone className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            +91
          </span>
          <input
            id="mobileNumber"
            name="mobileNumber"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            required
            maxLength={10}
            placeholder="10-digit mobile number"
            value={values.mobileNumber}
            onChange={(e) => handlePhoneInput(e.target.value)}
            className="w-full bg-white px-3.5 py-2.5 text-sm font-mono tabular-nums text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
          <span>A 6-digit verification OTP will be sent to this number.</span>
          {checkingBlocked && (
            <span className="inline-flex items-center gap-1 text-indigo-700 font-medium">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              Checking eligibility…
            </span>
          )}
        </div>
      </div>

      {/* Blocked Phone Number Alert */}
      {blockedPhoneError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold leading-relaxed">{blockedPhoneError}</p>
            <p className="text-xs text-rose-800">
              Admission cannot proceed with this mobile number. Please contact the coaching center office.
            </p>
          </div>
        </div>
      )}

      {/* Validation or Firebase Auth Errors */}
      {(formError || authError) && !blockedPhoneError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
          <span>{formError || authError}</span>
        </div>
      )}

      <div className="pt-1">
        <button
          type="submit"
          disabled={sendingOtp || checkingBlocked || Boolean(blockedPhoneError) || classes.length === 0}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
        >
          {sendingOtp ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Sending Verification Code…</span>
            </>
          ) : (
            <>
              <span>Send Verification Code</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
