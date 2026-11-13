# Firestore Security Specification

## 1. Data Invariants
1. **Phone Authentication Required**: No student admission record in `students/{studentId}` can be created without an active Firebase Phone Auth session (`request.auth != null` and `request.auth.token.phone_number is string`).
2. **Phone Ownership Integrity**: `mainContactNumber` in the created student document must match the last 10 digits of the authenticated `request.auth.token.phone_number`.
3. **Server-Side Blocked Number Gate**: If either `request.auth.token.phone_number`, `+91` + `mainContactNumber`, or `mainContactNumber` exists in `blocked_numbers` with `isBlocked != false`, creation in `students` is unconditionally denied (`PERMISSION_DENIED`).
4. **Zero Fee Tampering**: `feeStatus` must equal `0`, `dueDateLevel` must equal `0`, `firstDueDate` must equal `null`, and `currentDueDate` must equal `null`.
5. **Relational Class Integrity**: `setupId` and `classId` must reference an existing document at `/coaching_setup/{setupId}/classes/{classId}`.
6. **Strict Schema & Size Guards**: Exact key allowlisting (`hasAll` + `hasOnly`), string length limits, and server timestamp checks (`createdAt == request.time`, `updatedAt == request.time`).
7. **PII Isolation**:
   - `students` collection denies `get`, `list`, `update`, and `delete` to non-admins.
   - `blocked_numbers` denies `list` completely (preventing scraping of blocked phone numbers) and only permits single-document `get` by exact normalized phone key.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Create**: Anonymous/unauthenticated POST to `students/{id}` -> DENIED (`request.auth == null`).
2. **Blocked E.164 Number**: Phone Auth user `+919876543210` where `blocked_numbers/+919876543210` has `isBlocked: true` -> DENIED.
3. **Blocked 10-Digit Number**: Phone Auth user `+919876543211` where `blocked_numbers/9876543211` has `isBlocked: true` -> DENIED.
4. **Phone Spoofing**: Auth token has `+919876543210` but payload sets `mainContactNumber: "9999999999"` -> DENIED.
5. **Fee Status Tampering**: Payload sets `feeStatus: 1` or `feeStatus: 2` -> DENIED.
6. **Due Date Tampering**: Payload sets `dueDateLevel: 1` or non-null `firstDueDate` -> DENIED.
7. **Shadow / Ghost Field Injection**: Payload adds `isVerified: true` or `discount: 500` -> DENIED via `keys().hasOnly(...)`.
8. **Orphaned Class Reference**: Payload specifies a non-existent `classId` or `setupId` -> DENIED via `exists(...)`.
9. **Client Timestamp Forgery**: Payload sends `createdAt` different from `request.time` -> DENIED.
10. **ID Poisoning**: `studentId` contains invalid characters or exceeds 128 bytes -> DENIED via `isValidId(studentId)`.
11. **Oversized String Exhaustion**: `name` exceeds 100 characters -> DENIED.
12. **PII Scraping**: Signed-in phone user attempts `list` on `students` or `blocked_numbers` -> DENIED.
