import { signOut } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import type {
  BlockedCheckResult,
  CoachingClass,
  CoachingSetup,
  SubmittedAdmission,
} from '../types/admission';

export const BLOCKED_PHONE_MESSAGE =
  'आप इस मोबाइल नंबर से एडमिशन लेने के लिए अधिकृत नहीं हैं। कृपया कोचिंग कार्यालय से संपर्क करें।';

export class BlockedPhoneError extends Error {
  constructor(message = BLOCKED_PHONE_MESSAGE) {
    super(message);
    this.name = 'BlockedPhoneError';
  }
}

export interface NormalizedPhone {
  tenDigits: string;
  e164: string;
  isValid: boolean;
}

export function normalizePhoneNumber(rawInput: string): NormalizedPhone {
  const digits = rawInput.replace(/\D/g, '');
  const tenDigits = digits.length >= 10 ? digits.slice(-10) : digits;
  const isValid = /^[0-9]{10}$/.test(tenDigits);
  const e164 = isValid ? `+91${tenDigits}` : '';
  return { tenDigits, e164, isValid };
}

function buildBlockedCandidateKeys(phoneInput: string): string[] {
  const keys = new Set<string>();
  const trimmed = phoneInput.trim();
  if (/^\+[0-9]{10,15}$/.test(trimmed)) {
    keys.add(trimmed);
  }
  const { tenDigits, e164, isValid } = normalizePhoneNumber(phoneInput);
  if (isValid) {
    keys.add(e164);
    keys.add(tenDigits);
  }
  return Array.from(keys);
}

export async function checkBlockedNumber(phoneInput: string): Promise<BlockedCheckResult> {
  const candidateKeys = buildBlockedCandidateKeys(phoneInput);
  if (candidateKeys.length === 0) {
    return { isBlocked: false };
  }

  for (const key of candidateKeys) {
    const path = `blocked_numbers/${key}`;
    try {
      const snap = await getDoc(doc(db, 'blocked_numbers', key));
      if (snap.exists()) {
        const data = snap.data();
        if (data?.isBlocked !== false) {
          return {
            isBlocked: true,
            studentName: typeof data?.studentName === 'string' ? data.studentName : null,
            matchedKey: key,
          };
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  return { isBlocked: false };
}

function extractSectionsFromArray(rawSections: unknown): string[] {
  if (!Array.isArray(rawSections)) return [];
  const results: string[] = [];
  for (const item of rawSections) {
    if (typeof item === 'string') {
      const cleaned = item.trim();
      if (cleaned) results.push(cleaned);
    } else if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      if (record.isActive === false || record.active === false) continue;
      const label =
        (typeof record.name === 'string' && record.name.trim()) ||
        (typeof record.sectionName === 'string' && record.sectionName.trim()) ||
        (typeof record.title === 'string' && record.title.trim()) ||
        '';
      if (label) results.push(label);
    }
  }
  return Array.from(new Set(results));
}

function parseClassName(data: Record<string, unknown>): string {
  const candidates = [
    data.name,
    data.className,
    data.class_name,
    data.title,
    data.label,
    data.standard,
    data.batchName,
    data.courseName,
    data.class,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
}

function isRecordActive(data: Record<string, unknown>): boolean {
  if (data.isActive === false || data.active === false || data.is_active === false) {
    return false;
  }
  if (typeof data.status === 'string' && data.status.toLowerCase() === 'inactive') {
    return false;
  }
  return true;
}

async function parseClassDocs(
  setupId: string,
  docs: QueryDocumentSnapshot<DocumentData>[]
): Promise<CoachingClass[]> {
  const parsed: CoachingClass[] = [];

  for (const classDoc of docs) {
    const data = classDoc.data();
    if (!isRecordActive(data)) continue;

    const name = parseClassName(data);
    if (!name) continue;

    let sections = extractSectionsFromArray(data.sections);

    // Fallback: inspect sections subcollection if array is empty
    if (sections.length === 0) {
      const sectionsPath = `coaching_setup/${setupId}/classes/${classDoc.id}/sections`;
      try {
        const subSnap = await getDocs(
          collection(db, 'coaching_setup', setupId, 'classes', classDoc.id, 'sections')
        );
        if (!subSnap.empty) {
          sections = subSnap.docs
            .filter((s) => isRecordActive(s.data()))
            .map((s) => {
              const sData = s.data();
              return (
                (typeof sData.name === 'string' && sData.name.trim()) ||
                (typeof sData.sectionName === 'string' && sData.sectionName.trim()) ||
                s.id
              );
            })
            .filter(Boolean);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, sectionsPath);
      }
    }

    const orderVal =
      typeof data.order === 'number'
        ? data.order
        : typeof data.displayOrder === 'number'
          ? data.displayOrder
          : typeof data.classNumber === 'number'
            ? data.classNumber
            : undefined;

    parsed.push({
      id: classDoc.id,
      name,
      sections,
      isActive: true,
      order: orderVal,
    });
  }

  return parsed;
}

export async function fetchActiveCoachingCatalog(): Promise<{
  setup: CoachingSetup | null;
  classes: CoachingClass[];
}> {
  const setupPath = 'coaching_setup';
  let setupDocs;
  try {
    setupDocs = await getDocs(collection(db, setupPath));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, setupPath);
  }

  let chosenSetup: CoachingSetup | null = null;
  let classes: CoachingClass[] = [];

  if (!setupDocs.empty) {
    // Prioritize active setup docs first
    const orderedSetups = [...setupDocs.docs].sort((a, b) => {
      const aActive = a.data().isActive === true || a.data().active === true ? 1 : 0;
      const bActive = b.data().isActive === true || b.data().active === true ? 1 : 0;
      return bActive - aActive;
    });

    for (const setupDoc of orderedSetups) {
      const setupData = setupDoc.data();
      const candidateSetup: CoachingSetup = {
        id: setupDoc.id,
        instituteName:
          (typeof setupData.instituteName === 'string' && setupData.instituteName.trim()) ||
          (typeof setupData.coachingName === 'string' && setupData.coachingName.trim()) ||
          (typeof setupData.name === 'string' && setupData.name.trim()) ||
          'Coaching Center',
        academicSession:
          (typeof setupData.academicSession === 'string' && setupData.academicSession.trim()) ||
          (typeof setupData.session === 'string' && setupData.session.trim()) ||
          '2026–27',
        contactPhone:
          typeof setupData.contactPhone === 'string' ? setupData.contactPhone.trim() : undefined,
        isActive: isRecordActive(setupData),
      };

      if (!chosenSetup) {
        chosenSetup = candidateSetup;
      }

      const classesPath = `coaching_setup/${candidateSetup.id}/classes`;
      let classSnapshot;
      try {
        classSnapshot = await getDocs(
          collection(db, 'coaching_setup', candidateSetup.id, 'classes')
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.LIST, classesPath);
      }

      const parsedClasses = await parseClassDocs(candidateSetup.id, classSnapshot.docs);
      if (parsedClasses.length > 0) {
        chosenSetup = candidateSetup;
        classes = parsedClasses;
        break;
      }
    }
  }

  // Fallback for virtual/italicized parent coaching_setup/{setupId} docs via collectionGroup('classes')
  if (classes.length === 0) {
    try {
      const groupSnap = await getDocs(collectionGroup(db, 'classes'));
      const groupedBySetup = new Map<string, QueryDocumentSnapshot<DocumentData>[]>();
      for (const docSnap of groupSnap.docs) {
        const parentDocRef = docSnap.ref.parent.parent;
        const parentCollectionId = parentDocRef?.parent?.id;
        if (parentCollectionId === 'coaching_setup' && parentDocRef?.id) {
          const arr = groupedBySetup.get(parentDocRef.id) ?? [];
          arr.push(docSnap);
          groupedBySetup.set(parentDocRef.id, arr);
        }
      }

      for (const [setupId, docs] of groupedBySetup.entries()) {
        const parsedClasses = await parseClassDocs(setupId, docs);
        if (parsedClasses.length > 0) {
          chosenSetup = chosenSetup ?? {
            id: setupId,
            instituteName: 'Coaching Center',
            academicSession: '2026–27',
            isActive: true,
          };
          chosenSetup.id = setupId;
          classes = parsedClasses;
          break;
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'classes');
    }
  }

  classes.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined && a.order !== b.order) {
      return a.order - b.order;
    }
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return { setup: chosenSetup, classes };
}

export interface SubmitAdmissionParams {
  studentName: string;
  fatherName: string;
  mainContactNumber: string;
  classId: string;
  className: string;
  section: string | null;
  setupId: string;
  instituteName: string;
}

export async function submitStudentAdmission(
  params: SubmitAdmissionParams
): Promise<SubmittedAdmission> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Mobile OTP verification session expired. Please verify your mobile number again.');
  }

  const verifiedAuthPhone = currentUser.phoneNumber ?? '';
  const { tenDigits } = normalizePhoneNumber(params.mainContactNumber);

  // Post-Auth Blocked Number Verification (checks both verified token phone and 10-digit form phone)
  const [authBlockCheck, formBlockCheck] = await Promise.all([
    verifiedAuthPhone ? checkBlockedNumber(verifiedAuthPhone) : Promise.resolve({ isBlocked: false }),
    checkBlockedNumber(tenDigits),
  ]);

  if (authBlockCheck.isBlocked || formBlockCheck.isBlocked) {
    await signOut(auth);
    throw new BlockedPhoneError(BLOCKED_PHONE_MESSAGE);
  }

  const studentRef = doc(collection(db, 'students'));
  const studentId = studentRef.id;
  const path = `students/${studentId}`;

  const payload = {
    name: params.studentName.trim().slice(0, 100),
    fatherName: params.fatherName.trim().slice(0, 100),
    mainContactNumber: tenDigits,
    class: params.className.trim().slice(0, 100),
    classId: params.classId,
    section: params.section && params.section.trim() ? params.section.trim().slice(0, 60) : null,
    feeStatus: 0,
    dueDateLevel: 0,
    firstDueDate: null,
    currentDueDate: null,
    setupId: params.setupId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(studentRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }

  return {
    studentId,
    name: payload.name,
    fatherName: payload.fatherName,
    mainContactNumber: payload.mainContactNumber,
    className: payload.class,
    classId: payload.classId,
    section: payload.section,
    setupId: payload.setupId,
    instituteName: params.instituteName,
    submittedAt: new Date(),
  };
}
