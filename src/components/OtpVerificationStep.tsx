import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

interface OtpVerificationStepProps {
  mobileNumber: string;
  onVerifyOtp: (otpCode: string) => Promise<void>;
  onResendOtp: () => Promise<void>;
  onChangeNumber: () => void;
  verifying: boolean;
  resending: boolean;
  error: string | null;
  isBlockedError: boolean;
}

const RESEND_SECONDS = 60;

export function OtpVerificationStep({
  mobileNumber,
  onVerifyOtp,
  onResendOtp,
  onChangeNumber,
  verifying,
  resending,
  error,
  isBlockedError,
}: OtpVerificationStepProps) {
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [secondsLeft]);

  const handleDigitChange = (index: number, rawValue: string) => {
    const clean = rawValue.replace(/\D/g, '');
    setLocalError(null);

    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < 6 - index && i < clean.length; i++) {
        next[index + i] = clean[i];
      }
      setDigits(next);
      const focusIdx = Math.min(index + clean.length, 5);
      inputRefs.current[focusIdx]?.focus();
      return;
    }

    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setDigits(next);
    setLocalError(null);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleResend = async () => {
    setLocalError(null);
    setDigits(['', '', '', '', '', '']);
    await onResendOtp();
    setSecondsLeft(RESEND_SECONDS);
    inputRefs.current[0]?.focus();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const code = digits.join('');
    if (code.length !== 6) {
      setLocalError('Please enter the complete 6-digit OTP sent to your mobile.');
      return;
    }
    await onVerifyOtp(code);
  };

  const otpComplete = digits.every((d) => d.length === 1);

  return (
    <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-7 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Mobile OTP Verification
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Enter the 6-digit verification code sent via SMS to{' '}
            <span className="font-mono font-semibold text-slate-900 tabular-nums">
              +91 {mobileNumber}
            </span>
          </p>
        </div>
        <button
          type="button"
          onClick={onChangeNumber}
          disabled={verifying || resending}
          className="inline-flex items-center gap-1.5 self-start rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Change Number
        </button>
      </div>

      {/* 6-Digit OTP Input Boxes */}
      <div>
        <label className="block text-sm font-semibold text-slate-800 mb-3">
          6-Digit Verification Code
        </label>
        <div className="grid grid-cols-6 gap-2 sm:gap-3 max-w-sm">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              maxLength={6}
              aria-label={`OTP digit ${index + 1}`}
              value={digit}
              disabled={verifying || isBlockedError}
              onChange={(e) => handleDigitChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              className="h-12 sm:h-13 w-full rounded-lg border border-slate-300 bg-white text-center text-lg font-mono font-semibold tabular-nums text-slate-900 focus:border-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 disabled:bg-slate-100 disabled:text-slate-400"
            />
          ))}
        </div>

        {/* Countdown & Resend Row */}
        <div className="mt-4 flex items-center justify-between text-xs sm:text-sm">
          {secondsLeft > 0 ? (
            <span className="text-slate-600">
              Resend code available in{' '}
              <span className="font-mono font-semibold text-slate-900 tabular-nums">
                00:{String(secondsLeft).padStart(2, '0')}
              </span>
            </span>
          ) : (
            <span className="text-slate-600">Didn&apos;t receive the SMS?</span>
          )}

          <button
            type="button"
            onClick={handleResend}
            disabled={secondsLeft > 0 || resending || verifying || isBlockedError}
            className="inline-flex items-center gap-1.5 font-semibold text-indigo-800 hover:text-indigo-950 disabled:cursor-not-allowed disabled:text-slate-400 transition-colors whitespace-nowrap shrink-0"
          >
            {resending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Resend OTP</span>
          </button>
        </div>
      </div>

      {/* Blocked Phone Post-Auth Alert */}
      {isBlockedError && error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-700" aria-hidden="true" />
          <div className="space-y-1.5">
            <p className="font-semibold leading-relaxed">{error}</p>
            <p className="text-xs text-rose-800">
              Your verification session has been signed out and no admission record was created.
            </p>
          </div>
        </div>
      )}

      {/* Standard Error */}
      {(localError || (error && !isBlockedError)) && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-900"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden="true" />
          <span>{localError || error}</span>
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 shrink-0 text-indigo-700" aria-hidden="true" />
        <span>
          Your admission record is submitted only after successful mobile OTP verification.
        </span>
      </div>

      {/* Hidden reCAPTCHA container for resend support */}
      <div id="recaptcha-container" className="flex justify-center" />

      <div className="pt-1 flex flex-col gap-3 sm:flex-row">
        {isBlockedError ? (
          <button
            type="button"
            onClick={onChangeNumber}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Return &amp; Use Another Number</span>
          </button>
        ) : (
          <button
            type="submit"
            disabled={verifying || !otpComplete}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 transition-colors"
          >
            {verifying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Verifying &amp; Submitting…</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Verify &amp; Submit Admission</span>
              </>
            )}
          </button>
        )}
      </div>
    </form>
  );
}
