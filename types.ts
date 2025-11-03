// FIX: This file was a placeholder. Added all necessary type definitions and enums.
export enum UserType {
  School = 'school',
  Student = 'student',
  SuperAdmin = 'super_admin',
  Guard = 'guard',
  Teacher = 'teacher',
}

export interface User {
  id: string;
  name: string;
  token: string;
  type: UserType;
}

export interface Teacher {
  id: string;
  teacher_id: string;
  school_id: string;
  name: string;
  subject: string;
  phone_number: string;
  qr_value: string;
  type: UserType.Teacher;
}

export interface Guard extends User {
    guard_id: string;
    school_id: string;
    password_auto?: string; // Only on creation
}

export interface School extends User {
  address: string;
  contact_no: string;
  status: 'ACTIVE' | 'LOCKED';
  subscription_expiry_date: string;
  student_count?: number;
  password?: string; // Only available on creation
  opening_time?: string; // e.g., "09:00"
  closing_time?: string; // e.g., "16:00"
  payment_qr_code_base64?: string;
}

export interface Student extends User {
    student_id: string;
    school_id: string;
    roll_no: string;
    class: string;
    parent_phone: string;
    qr_value: string;
    password_auto?: string; // Only on creation
    total_fees?: number;
    fees_paid?: number;
    // FIX: Added optional face_enrolled property for face recognition feature.
    face_enrolled?: boolean;
}

export enum AttendanceStatus {
    IN = 'IN',
    OUT = 'OUT',
    ABSENT = 'ABSENT',
}

export enum AttendanceMode {
    MANUAL = 'MANUAL',
    QR = 'QR',
    FINGERPRINT = 'FINGERPRINT',
    // FIX: Added FACE mode for facial recognition attendance.
    FACE = 'FACE',
    SYSTEM = 'SYSTEM' // For automated absentee marking
}

export interface AttendanceLog {
    log_id: string;
    entity_id: string; // student_id or teacher_id
    entity_name: string;
    entity_type: 'student' | 'teacher';
    timestamp: string;
    status: AttendanceStatus;
    mode: AttendanceMode;
}


export interface StudentAnalytics {
    present_count: number;
    absent_count: number;
    last_entry: string | null;
    last_exit: string | null;
    recent_logs: AttendanceLog[];
}

export enum ComplaintStatus {
    OPEN = 'OPEN',
    RESOLVED = 'RESOLVED',
}

export interface Complaint {
    complaint_id: string;
    student_id: string;
    student_name: string;
    timestamp: string;
    text: string;
    status: ComplaintStatus;
    submitted_by_name: string;
    submitted_by_role: 'Student' | 'Guard';
}

export interface Message {
    message_id: string;
    student_id: string;
    text: string;
    timestamp: string;
}

export interface Announcement {
    announcement_id: string;
    school_id: string;
    title: string;
    content: string;
    timestamp: string;
}

export interface ContactInfo {
    title: string;
    description: string;
    email: string;
    phone: string;
}

export interface NavLink {
    title: string;
    href: string;
}

export interface FooterInfo {
    navLinks: NavLink[];
    email: string;
    phone: string;
    copyright: string;
}


export interface LoginAttempt {
    count: number;
    lockUntil: number | null;
}

export const CLASS_NAMES = ['NURSERY', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;
export type ClassName = typeof CLASS_NAMES[number];

export interface ClassRoutineEntry {
  id: string;
  school_id: string;
  class_name: ClassName;
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  subject: string;
  teacher_id: string;
}

export enum PaymentProofStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

export interface PaymentProof {
    proof_id: string;
    school_id: string;
    student_id: string;
    student_name: string;
    amount: number;
    payer_name: string;
    transaction_id: string;
    timestamp: string;
    status: PaymentProofStatus;
}
