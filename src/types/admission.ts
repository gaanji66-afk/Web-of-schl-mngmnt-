export interface CoachingSetup {
  id: string;
  instituteName: string;
  academicSession?: string;
  contactPhone?: string;
  isActive: boolean;
}

export interface CoachingClass {
  id: string;
  name: string;
  sections: string[];
  isActive: boolean;
  order?: number;
}

export interface AdmissionFormValues {
  studentName: string;
  fatherName: string;
  classId: string;
  className: string;
  section: string;
  mobileNumber: string;
}

export interface BlockedCheckResult {
  isBlocked: boolean;
  studentName?: string | null;
  matchedKey?: string;
}

export interface SubmittedAdmission {
  studentId: string;
  name: string;
  fatherName: string;
  mainContactNumber: string;
  className: string;
  classId: string;
  section: string | null;
  setupId: string;
  instituteName: string;
  submittedAt: Date;
}

export type AdmissionStep = 'details' | 'otp' | 'confirmation';
