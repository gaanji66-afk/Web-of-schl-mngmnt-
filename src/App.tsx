import { useCallback, useEffect, useRef, useState } from 'react';
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type ConfirmationResult,
} from 'firebase/auth';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { BookOpenCheck, PhoneCall, ShieldCheck } from 'lucide-react';
import { auth } from './firebase';
import {
  BlockedPhoneError,
  BLOCKED_PHONE_MESSAGE,
  checkBlockedNumber,
  fetchActiveCoachingCatalog,
  normalizePhoneNumber,
  submitStudentAdmission,
} from './services/admissionService';
import type {
  AdmissionFormValues,
  AdmissionStep,
  CoachingClass,
  CoachingSetup,
  SubmittedAdmission,
} from './types/admission';
import campusImage from './assets/images/academic_portal_campus_1794559007225.jpg';
import { PortalHeader } from './components/PortalHeader';
import { StepIndicator } from './components/StepIndicator';
import { StudentDetailsStep } from './components/StudentDetailsStep';
import { OtpVerificationStep } from './components/OtpVerificationStep';
import { AdmissionSlipStep } from './components/AdmissionSlipStep';

const CAMPUS_IMAGE_SRC = campusImage;

const INITIAL_FORM_VALUES: AdmissionFormValues = {
  studentName: '',
  fatherName: '',
  classId: '',
  className: '',
  section: '',
  mobileNumber: '',
};

function mapPhoneAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  const lowerMsg = rawMessage.toLowerCase();

  if (lowerMsg.includes('region') || lowerMsg.includes('sms unable to be sent')) {
    return 'SMS OTP for India (+91) is currently restricted in your Firebase SMS Region Policy. Open Firebase Console → Authentication → Settings → SMS Region Policy and add India (+91) to Allowed regions (or add test phone numbers under Sign-in method → Phone).';
  }

  if (code === 'auth/billing-not-enabled' || lowerMsg.includes('billing_not_enabled')) {
    return 'Live SMS OTP requires a Blaze billing account on your Firebase project. For free testing without billing, add test phone numbers under Firebase Console → Authentication → Sign-in method → Phone.';
  }

  switch (code) {
    case 'auth/invalid-phone-number':
      return 'Please enter a valid 10-digit mobile number.';
    case 'auth/too-many-requests':
      return 'Too many OTP requests from this device or number. Please wait a few minutes and try again.';
    case 'auth/invalid-verification-code':
      return 'Incorrect 6-digit OTP entered. Please verify the SMS code and try again.';
    case 'auth/code-expired':
      return 'This OTP code has expired. Please request a new code via Resend OTP.';
    case 'auth/operation-not-allowed':
      return 'Firebase Auth rejected this SMS request (operation-not-allowed). Please check Firebase Console → Authentication → Settings → SMS Region Policy (allow India +91) and ensure Phone Sign-In is enabled.';
    case 'auth/unauthorized-domain':
      return `This domain (${window.location.hostname}) is not authorized for Firebase Phone Auth. Add it under Firebase Console → Authentication → Settings → Authorized domains.`;
    case 'auth/captcha-check-failed':
    case 'auth/invalid-app-credential':
      return 'reCAPTCHA verification failed. Please refresh the page and try again.';
    default:
      return rawMessage || 'Unable to complete verification. Please try again.';
  }
}

export default function App() {
  const [setup, setSetup] = useState<CoachingSetup | null>(null);
  const [classes, setClasses] = useState<CoachingClass[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [campusImgFailed, setCampusImgFailed] = useState(false);

  const [step, setStep] = useState<AdmissionStep>('details');
  const [formValues, setFormValues] = useState<AdmissionFormValues>(INITIAL_FORM_VALUES);

  const [sendingOtp, setSendingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [authError, setAuthError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isBlockedError, setIsBlockedError] = useState(false);

  const [submittedAdmission, setSubmittedAdmission] = useState<SubmittedAdmission | null>(null);

  const recaptchaHostRef = useRef<HTMLDivElement | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);

  const loadCatalog = useCallback(async () => {
    setLoadingCatalog(true);
    setCatalogError(null);
    try {
      const result = await fetchActiveCoachingCatalog();
      setSetup(result.setup);
      setClasses(result.classes);
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('permission-denied') || msg.includes('Missing or insufficient permissions')) {
        setCatalogError(
          'Firestore permission denied while reading classes. Please allow read access on coaching_setup (and its classes/sections subcollections) in your Firestore Security Rules.'
        );
      } else {
        setCatalogError(
          'Could not load classes from Firestore right now. Please check your connection and retry.'
        );
      }
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const clearRecaptcha = useCallback(() => {
    if (recaptchaVerifierRef.current) {
      try {
        recaptchaVerifierRef.current.clear();
      } catch {
        // Ignore cleanup errors on unmounted nodes
      }
      recaptchaVerifierRef.current = null;
    }
    if (recaptchaHostRef.current) {
      recaptchaHostRef.current.innerHTML = '';
    }
  }, []);

  useEffect(() => {
    return () => {
      clearRecaptcha();
    };
  }, [clearRecaptcha]);

  const createRecaptchaVerifier = useCallback(() => {
    clearRecaptcha();
    const host = recaptchaHostRef.current;
    if (!host) {
      throw new Error('Verification widget is not ready yet. Please try again.');
    }
    const freshMount = document.createElement('div');
    host.appendChild(freshMount);
    const verifier = new RecaptchaVerifier(auth, freshMount, {
      size: 'invisible',
    });
    recaptchaVerifierRef.current = verifier;
    return verifier;
  }, [clearRecaptcha]);

  const handleFormChange = (updated: Partial<AdmissionFormValues>) => {
    setFormValues((prev) => ({ ...prev, ...updated }));
    setAuthError(null);
  };

  const handleSendOtp = async () => {
    setAuthError(null);
    setOtpError(null);
    setIsBlockedError(false);

    const { e164, tenDigits, isValid } = normalizePhoneNumber(formValues.mobileNumber);
    if (!isValid) {
      setAuthError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSendingOtp(true);
    try {
      // Pre-Check blocked_numbers right before sending SMS OTP
      const blockedCheck = await checkBlockedNumber(tenDigits);
      if (blockedCheck.isBlocked) {
        setAuthError(BLOCKED_PHONE_MESSAGE);
        setSendingOtp(false);
        return;
      }

      const appVerifier = createRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, e164, appVerifier);
      confirmationResultRef.current = confirmation;
      setStep('otp');
    } catch (error) {
      clearRecaptcha();
      setAuthError(mapPhoneAuthError(error));
    } finally {
      setSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError(null);
    setIsBlockedError(false);
    const { e164, tenDigits, isValid } = normalizePhoneNumber(formValues.mobileNumber);
    if (!isValid) return;

    setResendingOtp(true);
    try {
      const blockedCheck = await checkBlockedNumber(tenDigits);
      if (blockedCheck.isBlocked) {
        setIsBlockedError(true);
        setOtpError(BLOCKED_PHONE_MESSAGE);
        setResendingOtp(false);
        return;
      }

      const appVerifier = createRecaptchaVerifier();
      const confirmation = await signInWithPhoneNumber(auth, e164, appVerifier);
      confirmationResultRef.current = confirmation;
    } catch (error) {
      clearRecaptcha();
      setOtpError(mapPhoneAuthError(error));
    } finally {
      setResendingOtp(false);
    }
  };

  const handleVerifyAndSubmit = async (otpCode: string) => {
    if (!confirmationResultRef.current) {
      setOtpError('Verification session expired. Please request a new OTP.');
      return;
    }
    if (!setup) {
      setOtpError('Coaching setup configuration is missing. Please refresh and try again.');
      return;
    }

    setVerifyingOtp(true);
    setOtpError(null);
    setIsBlockedError(false);

    try {
      await confirmationResultRef.current.confirm(otpCode);

      const selectedClass = classes.find((c) => c.id === formValues.classId);
      const hasSections = Boolean(selectedClass && selectedClass.sections.length > 0);

      const submission = await submitStudentAdmission({
        studentName: formValues.studentName,
        fatherName: formValues.fatherName,
        mainContactNumber: formValues.mobileNumber,
        classId: formValues.classId,
        className: selectedClass ? selectedClass.name : formValues.className,
        section: hasSections && formValues.section ? formValues.section : null,
        setupId: setup.id,
        instituteName: setup.instituteName,
      });

      setSubmittedAdmission(submission);
      setStep('confirmation');
    } catch (error) {
      if (error instanceof BlockedPhoneError) {
        setIsBlockedError(true);
        setOtpError(error.message);
      } else {
        setOtpError(mapPhoneAuthError(error));
      }
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleChangeNumber = async () => {
    clearRecaptcha();
    confirmationResultRef.current = null;
    setOtpError(null);
    setIsBlockedError(false);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // Ignore sign-out errors
    }
    setStep('details');
  };

  const handleRegisterAnother = async () => {
    clearRecaptcha();
    confirmationResultRef.current = null;
    setFormValues(INITIAL_FORM_VALUES);
    setSubmittedAdmission(null);
    setAuthError(null);
    setOtpError(null);
    setIsBlockedError(false);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch {
      // Ignore sign-out errors
    }
    setStep('details');
  };

  const instituteName = setup?.instituteName ?? 'Coaching Center';
  const academicSession = setup?.academicSession ?? '2026–27';

  return (
    <MotionConfig reducedMotion="user">
      <div id="top" className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <PortalHeader instituteName={instituteName} academicSession={academicSession} />

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start lg:gap-10">
            {/* Left Column: Institutional Context & Admission Guide */}
            <aside className="no-print lg:col-span-5 space-y-6">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-800">
                  Online Student Self-Registration · Session {academicSession}
                </p>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl [text-wrap:balance]">
                  Apply for Admission at {instituteName}
                </h1>
                <p className="text-sm sm:text-base leading-relaxed text-slate-600">
                  Complete your enrollment application in minutes. Verify your mobile number with an instant SMS OTP and download your official admission slip immediately.
                </p>
              </div>

              {/* Institutional Campus Visual with Fallback */}
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {!campusImgFailed ? (
                  <img
                    src={CAMPUS_IMAGE_SRC}
                    alt={`${instituteName} modern study hall and library`}
                    referrerPolicy="no-referrer"
                    onError={() => setCampusImgFailed(true)}
                    className="h-48 w-full object-cover sm:h-56"
                  />
                ) : (
                  <div className="flex h-48 w-full flex-col items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 px-6 text-center text-white sm:h-56">
                    <BookOpenCheck className="h-8 w-8 text-indigo-200 mb-2" aria-hidden="true" />
                    <p className="font-display text-base font-semibold">{instituteName}</p>
                    <p className="text-xs text-indigo-200 mt-1">Academic Session {academicSession}</p>
                  </div>
                )}
              </div>

              {/* Editorial 3-Step Guide */}
              <section id="admission-steps" className="border-t border-slate-200 pt-5 space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  How Online Admission Works
                </h2>
                <ol className="space-y-3.5 text-sm">
                  <li className="flex items-start gap-3">
                    <span className="font-mono text-xs font-semibold text-indigo-800 pt-0.5 tabular-nums">
                      01.
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Fill Academic Particulars</p>
                      <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                        Provide student and father&apos;s name, choose an active class, and enter your 10-digit mobile number.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-mono text-xs font-semibold text-indigo-800 pt-0.5 tabular-nums">
                      02.
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Verify Mobile via SMS OTP</p>
                      <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                        Confirm the 6-digit verification code sent to your phone to authenticate your application.
                      </p>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="font-mono text-xs font-semibold text-indigo-800 pt-0.5 tabular-nums">
                      03.
                    </span>
                    <div>
                      <p className="font-semibold text-slate-900">Print Confirmation Slip</p>
                      <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                        Save or print your official admission slip with your unique Registration ID.
                      </p>
                    </div>
                  </li>
                </ol>
              </section>

              {/* Guidelines & Policy */}
              <section
                id="guidelines"
                className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 text-xs text-slate-600"
              >
                <div className="flex items-center gap-2 font-semibold text-slate-900 text-sm">
                  <ShieldCheck className="h-4 w-4 text-indigo-800 shrink-0" aria-hidden="true" />
                  <span>Important Admission Notice</span>
                </div>
                <p className="leading-relaxed">
                  This portal collects academic and contact details only. No online fee payment is collected here—fee deposition and batch allocation are finalized directly at the coaching office.
                </p>
                {setup?.contactPhone && (
                  <div className="flex items-center gap-2 pt-1 text-slate-800 font-medium">
                    <PhoneCall className="h-3.5 w-3.5 text-indigo-700 shrink-0" aria-hidden="true" />
                    <span>
                      Office Helpdesk:{' '}
                      <span className="font-mono tabular-nums">{setup.contactPhone}</span>
                    </span>
                  </div>
                )}
              </section>
            </aside>

            {/* Right Column: Step-by-Step Registration Card */}
            <section
              id="admission-form"
              aria-label="Student admission form"
              className="lg:col-span-7"
            >
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="no-print">
                  <StepIndicator currentStep={step} />
                </div>

                <AnimatePresence mode="wait">
                  {step === 'details' && (
                    <motion.div
                      key="step-details"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <StudentDetailsStep
                        values={formValues}
                        onChange={handleFormChange}
                        classes={classes}
                        loadingCatalog={loadingCatalog}
                        catalogError={catalogError}
                        onRetryCatalog={loadCatalog}
                        onSendOtp={handleSendOtp}
                        sendingOtp={sendingOtp}
                        authError={authError}
                      />
                    </motion.div>
                  )}

                  {step === 'otp' && (
                    <motion.div
                      key="step-otp"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <OtpVerificationStep
                        mobileNumber={formValues.mobileNumber}
                        onVerifyOtp={handleVerifyAndSubmit}
                        onResendOtp={handleResendOtp}
                        onChangeNumber={handleChangeNumber}
                        verifying={verifyingOtp}
                        resending={resendingOtp}
                        error={otpError}
                        isBlockedError={isBlockedError}
                      />
                    </motion.div>
                  )}

                  {step === 'confirmation' && submittedAdmission && (
                    <motion.div
                      key="step-confirmation"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <AdmissionSlipStep
                        admission={submittedAdmission}
                        onRegisterAnother={handleRegisterAnother}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </main>

        <footer className="no-print border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p>
              &copy; {new Date().getFullYear()} {instituteName}. Official Online Admission Portal.
            </p>
            <p>Academic Session {academicSession}</p>
          </div>
        </footer>

        {/* Dedicated reCAPTCHA mount host outside step transitions */}
        <div ref={recaptchaHostRef} className="no-print" aria-hidden="true" />
      </div>
    </MotionConfig>
  );
}
