import { dbSeed, DB } from './dbSeed';
// FIX: Added ClassName, ClassRoutineEntry to imports to be used in new methods.
import { User, School, Student, Guard, Teacher, UserType, AttendanceLog, Complaint, ComplaintStatus, Message, Announcement, AttendanceStatus, AttendanceMode, ContactInfo, FooterInfo, StudentAnalytics, ClassName, ClassRoutineEntry } from '../types';

const DB_KEY = 'notifyedu_db';
const TOKEN_EXPIRY_MS = 60 * 60 * 1000; // 1 hour
const SIMULATED_DELAY = 300; // ms

// --- Token Management ---
const generateToken = (userId: string, userType: UserType): string => {
    const expiry = Date.now() + TOKEN_EXPIRY_MS;
    return btoa(`${userId}:${userType}:${expiry}`);
};

const validateToken = (token: string, requiredType?: UserType): { userId: string, userType: UserType } | null => {
    if (!token) throw new Error("Authentication token is missing.");
    try {
        const [userId, userType, expiryStr] = atob(token).split(':');
        const expiry = parseInt(expiryStr, 10);
        if (Date.now() > expiry) {
            throw new Error('Token expired. Please log in again.');
        }
        if (requiredType && userType !== requiredType) {
            throw new Error('Access denied. You do not have the required permissions.');
        }
        return { userId, userType: userType as UserType };
    } catch (e) {
        throw new Error("Invalid token. Please log in again.");
    }
};


class ApiService {
    private db: DB;
    private channel: BroadcastChannel;

    constructor() {
        this.db = this.loadDb();
        this.channel = new BroadcastChannel('notifyedu_attendance');
    }

    private loadDb(): DB {
        try {
            const storedDb = localStorage.getItem(DB_KEY);
            if (storedDb) {
                const parsedDb = JSON.parse(storedDb);
                // Ensure teachers array exists for backward compatibility
                if (!parsedDb.teachers) {
                    parsedDb.teachers = [];
                }
                return parsedDb;
            }
        } catch (e) {
            console.error("Failed to load DB from localStorage, seeding new DB.", e);
        }
        const seededDb = dbSeed();
        this.saveDb(seededDb);
        return seededDb;
    }

    private saveDb(db: DB = this.db) {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    }
    
    private async simulate<T>(data: T): Promise<T> {
        // The deep clone is to simulate a real API response where you get a new object,
        // not a reference to the one in the DB.
        // JSON.stringify(undefined) results in the string "undefined", which is not valid JSON and causes a SyntaxError.
        // We handle the `undefined` case separately to ensure promises returning `void` resolve correctly without error.
        if (typeof data === 'undefined') {
            return new Promise(resolve => setTimeout(() => resolve(data), SIMULATED_DELAY));
        }
        const clonedData = JSON.parse(JSON.stringify(data));
        return new Promise(resolve => setTimeout(() => resolve(clonedData), SIMULATED_DELAY));
    }
    
    // --- Auth Methods ---
    async loginSchool(id: string, pass: string): Promise<School> {
        const school = this.db.schools.find(s => s.id === id && s.password === pass);
        if (school) {
            school.token = generateToken(school.id, school.type);
            return this.simulate(school);
        }
        throw new Error("Invalid school ID or password.");
    }

    async loginStudent(id: string, pass: string): Promise<Student> {
        const student = this.db.students.find(s => s.student_id === id && s.password_auto === pass);
        if (student) {
            student.token = generateToken(student.id, student.type);
            return this.simulate(student);
        }
        throw new Error("Invalid student ID or password.");
    }

    async loginGuard(id: string, pass: string): Promise<Guard> {
        const guard = this.db.guards.find(g => g.guard_id === id && g.password_auto === pass);
        if (guard) {
            guard.token = generateToken(guard.id, guard.type);
            return this.simulate(guard);
        }
        throw new Error("Invalid guard ID or password.");
    }

    async loginSuperAdmin(id: string, pass: string): Promise<User> {
        const admin = this.db.superAdmins.find(a => a.id === id && a.password === pass);
        if (admin) {
            admin.token = generateToken(admin.id, admin.type);
            return this.simulate(admin);
        }
        throw new Error("Invalid admin ID or password.");
    }

    // --- School Methods ---
    async getSchoolStudents(schoolId: string, token: string): Promise<Student[]> {
        validateToken(token, UserType.School);
        const students = this.db.students.filter(s => s.school_id === schoolId);
        return this.simulate(students);
    }
    
    async addStudent(schoolId: string, token: string, details: Partial<Student>): Promise<Student> {
        validateToken(token, UserType.School);
        const newStudent: Student = {
            ...details,
            id: details.student_id!,
            school_id: schoolId,
            token: '',
            type: UserType.Student,
            qr_value: JSON.stringify({ student_id: details.student_id, school_id: schoolId }),
            fees_paid: 0,
            total_fees: 0
        } as Student;
        this.db.students.push(newStudent);
        this.saveDb();
        return this.simulate(newStudent);
    }

    async deleteStudent(schoolId: string, token: string, studentId: string): Promise<void> {
        validateToken(token, UserType.School);
        this.db.students = this.db.students.filter(s => !(s.school_id === schoolId && s.student_id === studentId));
        this.db.attendanceLogs = this.db.attendanceLogs.filter(l => l.entity_id !== studentId);
        this.saveDb();
        return this.simulate(undefined);
    }
    
    private notifyParent(log: AttendanceLog) {
        if (log.entity_type !== 'student') return;
        this.channel.postMessage({
            type: 'ATTENDANCE_UPDATE',
            studentId: log.entity_id,
            log: log
        });
    }

    async markAttendance(schoolId: string, token: string, entityId: string, status: AttendanceStatus, mode: AttendanceMode = AttendanceMode.MANUAL, entityType: 'student' | 'teacher' = 'student'): Promise<AttendanceLog> {
        validateToken(token, UserType.School);
        
        const entity = entityType === 'student'
            ? this.db.students.find(s => s.student_id === entityId && s.school_id === schoolId)
            : this.db.teachers.find(t => t.teacher_id === entityId && t.school_id === schoolId);

        if (!entity) throw new Error(`${entityType.charAt(0).toUpperCase() + entityType.slice(1)} not found in this school.`);
        
        const todaysLogs = this.db.attendanceLogs.filter(l => l.entity_id === entityId && new Date(l.timestamp).toDateString() === new Date().toDateString());
        const lastLog = todaysLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

        if(lastLog) {
            if(status === AttendanceStatus.IN && lastLog.status === AttendanceStatus.IN) {
                throw new Error(`${entity.name} is already marked as IN.`);
            }
            if(status === AttendanceStatus.OUT && lastLog.status === AttendanceStatus.OUT) {
                throw new Error(`${entity.name} is already marked as OUT.`);
            }
             if(status === AttendanceStatus.OUT && lastLog.status !== AttendanceStatus.IN) {
                throw new Error(`Cannot mark OUT before marking IN.`);
            }
        } else {
            if (status === AttendanceStatus.OUT) {
                throw new Error(`Cannot mark OUT before marking IN.`);
            }
        }


        const newLog: AttendanceLog = {
            log_id: `log_${Date.now()}_${Math.random()}`,
            entity_id: entityId,
            entity_name: entity.name,
            entity_type: entityType,
            timestamp: new Date().toISOString(),
            status,
            mode
        };
        this.db.attendanceLogs.unshift(newLog);
        this.saveDb();
        if (entityType === 'student') {
            this.notifyParent(newLog);
        }
        return this.simulate(newLog);
    }

    async markAttendanceByQr(schoolId: string, token: string, qrValue: string): Promise<{log: AttendanceLog, entityName: string}> {
        validateToken(token, UserType.School);
        
        let entityId, school_id, entityType: 'student' | 'teacher';
        let entityName: string;
        try {
            const parsed = JSON.parse(qrValue);
            if (parsed.student_id) {
                entityId = parsed.student_id;
                entityType = 'student';
            } else if (parsed.teacher_id) {
                entityId = parsed.teacher_id;
                entityType = 'teacher';
            } else {
                throw new Error("Invalid QR code content.");
            }
            school_id = parsed.school_id;
        } catch (e) {
            throw new Error("Invalid QR code format.");
        }

        if(school_id !== schoolId) throw new Error("This QR code is not for your school.");
        const entity = entityType === 'student'
            ? this.db.students.find(s => s.student_id === entityId)
            : this.db.teachers.find(t => t.teacher_id === entityId);
            
        if (!entity) throw new Error(`${entityType} not found from QR code.`);
        entityName = entity.name;
        
        const todaysLogs = this.db.attendanceLogs.filter(l => l.entity_id === entityId && new Date(l.timestamp).toDateString() === new Date().toDateString());
        const lastLog = todaysLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        if (lastLog && lastLog.status === AttendanceStatus.OUT) {
            throw new Error(`${entityName} has already been marked OUT for the day.`);
        }
        
        const newStatus = (!lastLog || lastLog.status === AttendanceStatus.OUT) ? AttendanceStatus.IN : AttendanceStatus.OUT;

        const log = await this.markAttendance(schoolId, token, entityId, newStatus, AttendanceMode.QR, entityType);
        return this.simulate({ log, entityName });
    }

    async getTodaysAttendance(schoolId: string, token: string): Promise<AttendanceLog[]> {
        validateToken(token, UserType.School);
        const todayStr = new Date().toDateString();

        const studentIds = new Set(this.db.students.filter(s => s.school_id === schoolId).map(s => s.student_id));
        const teacherIds = new Set(this.db.teachers.filter(t => t.school_id === schoolId).map(t => t.teacher_id));

        const logs = this.db.attendanceLogs.filter(l => {
            const isToday = new Date(l.timestamp).toDateString() === todayStr;
            const belongsToSchool = (l.entity_type === 'student' && studentIds.has(l.entity_id)) || (l.entity_type === 'teacher' && teacherIds.has(l.entity_id));
            return isToday && belongsToSchool;
        });

        return this.simulate(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }
    
    async getStudentAttendanceHistory(studentId: string, token: string): Promise<AttendanceLog[]> {
        validateToken(token); // School or student can view
        const logs = this.db.attendanceLogs.filter(l => l.entity_id === studentId && l.entity_type === 'student');
        return this.simulate(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

    async getAttendanceForDate(schoolId: string, token: string, date: string): Promise<AttendanceLog[]> {
        validateToken(token, UserType.School);
        const dateStr = new Date(date).toDateString();
        
        const studentIds = new Set(this.db.students.filter(s => s.school_id === schoolId).map(s => s.student_id));

        const logs = this.db.attendanceLogs.filter(l => {
             const isDate = new Date(l.timestamp).toDateString() === dateStr;
             const isStudent = l.entity_type === 'student' && studentIds.has(l.entity_id);
             return isDate && isStudent;
        });
        return this.simulate(logs);
    }
    
    async getMonthlyAttendanceLogs(schoolId: string, token: string): Promise<AttendanceLog[]> {
        validateToken(token, UserType.School);
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        
        const studentIds = new Set(this.db.students.filter(s => s.school_id === schoolId).map(s => s.student_id));

        const logs = this.db.attendanceLogs.filter(l => {
            const belongsToSchool = l.entity_type === 'student' && studentIds.has(l.entity_id);
            return belongsToSchool && new Date(l.timestamp) >= firstDayOfMonth;
        });
        return this.simulate(logs);
    }

    async markAllAbsent(schoolId: string, token: string): Promise<number> {
        validateToken(token, UserType.School);
        const todayStr = new Date().toDateString();
        const presentStudentIds = new Set(this.db.attendanceLogs
            .filter(l => l.entity_type === 'student' && new Date(l.timestamp).toDateString() === todayStr && (l.status === AttendanceStatus.IN || l.status === AttendanceStatus.OUT))
            .map(l => l.entity_id));
        
        const studentsToMark = this.db.students.filter(s => s.school_id === schoolId && !presentStudentIds.has(s.student_id));
        
        studentsToMark.forEach(s => {
            const newLog: AttendanceLog = {
                log_id: `log_absent_${s.student_id}_${Date.now()}`,
                entity_id: s.student_id,
                entity_name: s.name,
                entity_type: 'student',
                timestamp: new Date().toISOString(),
                status: AttendanceStatus.ABSENT,
                mode: AttendanceMode.SYSTEM
            };
            this.db.attendanceLogs.unshift(newLog);
            this.notifyParent(newLog);
        });

        this.saveDb();
        return this.simulate(studentsToMark.length);
    }
    
    async updateStudentFees(token: string, studentId: string, totalFees: number, feesPaid: number): Promise<Student> {
        validateToken(token, UserType.School);
        const student = this.db.students.find(s => s.student_id === studentId);
        if (!student) throw new Error("Student not found");
        student.total_fees = totalFees;
        student.fees_paid = feesPaid;
        this.saveDb();
        return this.simulate(student);
    }
    
    async getComplaints(schoolId: string, token: string): Promise<Complaint[]> {
        validateToken(token, UserType.School);
        const studentIds = new Set(this.db.students.filter(s => s.school_id === schoolId).map(s => s.student_id));
        const complaints = this.db.complaints.filter(c => studentIds.has(c.student_id));
        return this.simulate(complaints.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

    async resolveComplaint(schoolId: string, token: string, complaintId: string): Promise<Complaint> {
        validateToken(token, UserType.School);
        const complaint = this.db.complaints.find(c => c.complaint_id === complaintId);
        if (!complaint) throw new Error("Complaint not found");
        complaint.status = ComplaintStatus.RESOLVED;
        this.saveDb();
        return this.simulate(complaint);
    }

    async createAnnouncement(schoolId: string, token: string, title: string, content: string): Promise<Announcement> {
        validateToken(token, UserType.School);
        const newAnnouncement: Announcement = {
            announcement_id: `ann_${Date.now()}`,
            school_id: schoolId,
            title,
            content,
            timestamp: new Date().toISOString()
        };
        this.db.announcements.unshift(newAnnouncement);
        this.saveDb();
        return this.simulate(newAnnouncement);
    }

    async deleteAnnouncement(token: string, announcementId: string): Promise<void> {
        validateToken(token, UserType.School);
        this.db.announcements = this.db.announcements.filter(a => a.announcement_id !== announcementId);
        this.saveDb();
        return this.simulate(undefined);
    }
    
    async getAnnouncementsForSchool(schoolId: string, token: string): Promise<Announcement[]> {
        validateToken(token);
        const announcements = this.db.announcements.filter(a => a.school_id === schoolId);
        return this.simulate(announcements.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }
    
    async sendMessageToParent(schoolId: string, token: string, studentId: string, text: string): Promise<Message> {
        validateToken(token, UserType.School);
        const newMessage: Message = {
            message_id: `msg_${Date.now()}`,
            student_id: studentId,
            text,
            timestamp: new Date().toISOString(),
        };
        this.db.messages.unshift(newMessage);
        this.saveDb();
        return this.simulate(newMessage);
    }
    
    async updateSchoolProfile(schoolId: string, token: string, data: Partial<School>): Promise<School> {
        validateToken(token, UserType.School);
        const school = this.db.schools.find(s => s.id === schoolId);
        if(!school) throw new Error("School not found");
        Object.assign(school, data);
        this.saveDb();
        return this.simulate(school);
    }

    // --- Student Methods ---
    async getStudentAnalytics(studentId: string, token: string): Promise<StudentAnalytics> {
        validateToken(token, UserType.Student);
        const logs = this.db.attendanceLogs.filter(l => l.entity_id === studentId && l.entity_type === 'student');
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        const presentDays = new Set<string>();
        const absentDays = new Set<string>();
        
        logs.forEach(l => {
            const dateStr = new Date(l.timestamp).toDateString();
            if (l.status === AttendanceStatus.IN || l.status === AttendanceStatus.OUT) {
                presentDays.add(dateStr);
            } else if (l.status === AttendanceStatus.ABSENT) {
                if (!presentDays.has(dateStr)) { // Don't count as absent if they were also present
                    absentDays.add(dateStr);
                }
            }
        });
        
        const todayStr = new Date().toDateString();
        const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === todayStr);
        const lastEntryLog = [...todayLogs].filter(l => l.status === AttendanceStatus.IN).pop();
        const lastExitLog = [...todayLogs].filter(l => l.status === AttendanceStatus.OUT).pop();

        return this.simulate({
            present_count: presentDays.size,
            absent_count: absentDays.size,
            last_entry: lastEntryLog?.timestamp || null,
            last_exit: lastExitLog?.timestamp || null,
            recent_logs: logs.slice(0, 5)
        });
    }

    async getMessagesForStudent(studentId: string, token: string): Promise<Message[]> {
        validateToken(token, UserType.Student);
        const messages = this.db.messages.filter(m => m.student_id === studentId);
        return this.simulate(messages.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

    async submitComplaint(studentId: string, token: string, text: string): Promise<Complaint> {
        validateToken(token, UserType.Student);
        const student = this.db.students.find(s => s.student_id === studentId);
        if(!student) throw new Error("Student not found");

        const newComplaint: Complaint = {
            complaint_id: `comp_${Date.now()}`,
            student_id: studentId,
            student_name: student.name,
            text,
            timestamp: new Date().toISOString(),
            status: ComplaintStatus.OPEN,
            submitted_by_name: student.name,
            submitted_by_role: 'Student'
        };
        this.db.complaints.unshift(newComplaint);
        this.saveDb();
        return this.simulate(newComplaint);
    }
    
    async enrollFace(studentId: string, token: string): Promise<Student> {
        validateToken(token);
        const student = this.db.students.find(s => s.id === studentId);
        if (!student) throw new Error("Student not found");
        student.face_enrolled = true;
        this.saveDb();
        return this.simulate(student);
    }
    
    async studentMarkAttendanceByQr(studentId: string, token: string, qrValue: string): Promise<AttendanceLog> {
        validateToken(token, UserType.Student);
        const student = this.db.students.find(s => s.student_id === studentId);
        if (!student) throw new Error("Student not found");
        
        // Allow scanning either the school location QR or the student's own QR
        let schoolQrMatch = qrValue === this.db.locationQrValue;
        let personalQrMatch = false;
        try {
            const parsed = JSON.parse(qrValue);
            if (parsed.student_id === student.student_id) {
                personalQrMatch = true;
            }
        } catch(e) { /* Not a personal QR, ignore error */ }


        if (!schoolQrMatch && !personalQrMatch) {
            throw new Error("Invalid QR code. Please scan the school's location QR or your personal ID QR.");
        }
        
        // School token is required for the internal markAttendance function
        const schoolToken = generateToken(student.school_id, UserType.School);
        
        const todaysLogs = this.db.attendanceLogs.filter(l => l.entity_id === studentId && new Date(l.timestamp).toDateString() === new Date().toDateString());
        const lastLog = todaysLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        // Prevent scanning again if already marked OUT for the day
        if (lastLog && lastLog.status === AttendanceStatus.OUT) {
            throw new Error(`You have already been marked OUT for the day.`);
        }
        
        const newStatus = (!lastLog || lastLog.status === AttendanceStatus.OUT) ? AttendanceStatus.IN : AttendanceStatus.OUT;

        const log = await this.markAttendance(student.school_id, schoolToken, studentId, newStatus, AttendanceMode.QR, 'student');
        return this.simulate(log);
    }
    
    async getStudentAttendanceForDate(studentId: string, token: string, date: string): Promise<AttendanceLog[]> {
        validateToken(token, UserType.Student);
        const dateStr = new Date(date).toDateString();
        const logs = this.db.attendanceLogs.filter(l => l.entity_id === studentId && l.entity_type === 'student' && new Date(l.timestamp).toDateString() === dateStr);
        return this.simulate(logs);
    }

    // --- Guard Methods ---
    async getSchoolGuards(schoolId: string, token: string): Promise<Guard[]> {
        validateToken(token, UserType.School);
        return this.simulate(this.db.guards.filter(g => g.school_id === schoolId));
    }

    async addGuard(schoolId: string, token: string, details: Partial<Guard>): Promise<Guard> {
        validateToken(token, UserType.School);
        const newGuard: Guard = {
            ...details,
            id: details.guard_id!,
            school_id: schoolId,
            token: '',
            type: UserType.Guard,
        } as Guard;
        this.db.guards.push(newGuard);
        this.saveDb();
        return this.simulate(newGuard);
    }
    
    async guardMarkAttendanceByQr(guardToken: string, qrValue: string): Promise<{log: AttendanceLog, entityName: string}> {
        const validation = validateToken(guardToken, UserType.Guard);
        const guard = this.db.guards.find(g => g.id === validation?.userId);
        if (!guard) throw new Error("Guard not found.");

        let entityId, school_id, entityType: 'student' | 'teacher';
        let entityName: string;

        try {
            const parsed = JSON.parse(qrValue);
             if (parsed.student_id) {
                entityId = parsed.student_id;
                entityType = 'student';
            } else if (parsed.teacher_id) {
                entityId = parsed.teacher_id;
                entityType = 'teacher';
            } else {
                throw new Error("Invalid QR code content.");
            }
            school_id = parsed.school_id;
        } catch (e) { throw new Error("Invalid QR code format."); }

        if(school_id !== guard.school_id) throw new Error("This QR code is not for your school.");
        const entity = entityType === 'student'
            ? this.db.students.find(s => s.student_id === entityId)
            : this.db.teachers.find(t => t.teacher_id === entityId);
            
        if (!entity) throw new Error(`${entityType} not found from QR code.`);
        entityName = entity.name;
        
        const todaysLogs = this.db.attendanceLogs.filter(l => l.entity_id === entityId && new Date(l.timestamp).toDateString() === new Date().toDateString());
        const lastLog = todaysLogs.sort((a,b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
        
        if (lastLog && lastLog.status === AttendanceStatus.OUT) {
            throw new Error(`${entityName} has already been marked OUT for the day.`);
        }
        
        const newStatus = (!lastLog || lastLog.status === AttendanceStatus.OUT) ? AttendanceStatus.IN : AttendanceStatus.OUT;

        // Use a temporary school token to call the internal method
        const tempSchoolToken = generateToken(guard.school_id, UserType.School);
        const log = await this.markAttendance(guard.school_id, tempSchoolToken, entityId, newStatus, AttendanceMode.QR, entityType);
        return this.simulate({ log, entityName });
    }

    async guardSubmitComplaint(guardToken: string, studentIdentifier: string, text: string): Promise<Complaint> {
        const validation = validateToken(guardToken, UserType.Guard);
        const guard = this.db.guards.find(g => g.id === validation?.userId);
        if (!guard) throw new Error("Guard not found.");
        
        const student = this.db.students.find(s => s.school_id === guard.school_id && (s.student_id === studentIdentifier || s.roll_no === studentIdentifier));
        if (!student) throw new Error(`Student with ID or Roll No. "${studentIdentifier}" not found.`);

        const newComplaint: Complaint = {
            complaint_id: `comp_guard_${Date.now()}`,
            student_id: student.student_id,
            student_name: student.name,
            text,
            timestamp: new Date().toISOString(),
            status: ComplaintStatus.OPEN,
            submitted_by_name: guard.name,
            submitted_by_role: 'Guard'
        };
        this.db.complaints.unshift(newComplaint);
        this.saveDb();
        return this.simulate(newComplaint);
    }

    // --- Teacher Methods ---
    async getSchoolTeachers(schoolId: string, token: string): Promise<Teacher[]> {
        validateToken(token, UserType.School);
        return this.simulate(this.db.teachers.filter(t => t.school_id === schoolId));
    }

    async addTeacher(schoolId: string, token: string, details: Partial<Teacher>): Promise<Teacher> {
        validateToken(token, UserType.School);
        const newTeacher: Teacher = {
            ...details,
            id: details.teacher_id!,
            school_id: schoolId,
            type: UserType.Teacher,
            qr_value: JSON.stringify({ teacher_id: details.teacher_id, school_id: schoolId }),
        } as Teacher;
        this.db.teachers.push(newTeacher);
        this.saveDb();
        return this.simulate(newTeacher);
    }
    
    async getTeacherAttendanceHistory(teacherId: string, token: string): Promise<AttendanceLog[]> {
        validateToken(token, UserType.School); // Only school can see history
        const logs = this.db.attendanceLogs.filter(l => l.entity_id === teacherId && l.entity_type === 'teacher');
        return this.simulate(logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
    }

    async getTeacherMonthlyReport(teacherId: string): Promise<AttendanceLog[]> {
        // Public method, no token validation
        const teacher = this.db.teachers.find(t => t.teacher_id === teacherId);
        if (!teacher) {
            throw new Error("Teacher ID not found.");
        }
        const today = new Date();
        const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        const logs = this.db.attendanceLogs.filter(l => 
            l.entity_id === teacherId && 
            l.entity_type === 'teacher' &&
            new Date(l.timestamp) >= firstDayOfMonth &&
            new Date(l.timestamp) <= lastDayOfMonth
        );
        return this.simulate(logs);
    }

    // --- Class Routine Methods ---
    async getSchoolClassRoutine(schoolId: string, token: string, className: ClassName): Promise<ClassRoutineEntry[]> {
        validateToken(token, UserType.School);
        const routine = this.db.classRoutines.filter(
            r => r.school_id === schoolId && r.class_name === className
        );
        return this.simulate(routine.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    }

    async getAllSchoolClassRoutines(schoolId: string, token: string): Promise<ClassRoutineEntry[]> {
        validateToken(token, UserType.School);
        const routines = this.db.classRoutines.filter(r => r.school_id === schoolId);
        return this.simulate(routines);
    }

    async updateSchoolClassRoutine(schoolId: string, token: string, className: ClassName, routine: Partial<ClassRoutineEntry>[]): Promise<void> {
        validateToken(token, UserType.School);

        // Remove old entries for this class
        this.db.classRoutines = this.db.classRoutines.filter(
            r => !(r.school_id === schoolId && r.class_name === className)
        );

        // Add new entries
        const newEntries: ClassRoutineEntry[] = routine
            .filter(r => r.start_time && r.end_time && r.subject && r.teacher_id) // Filter out incomplete entries
            .map(entry => ({
                id: `routine_${schoolId}_${className}_${Date.now()}_${Math.random()}`,
                school_id: schoolId,
                class_name: className,
                start_time: entry.start_time!,
                end_time: entry.end_time!,
                subject: entry.subject!,
                teacher_id: entry.teacher_id!,
            }));
        
        this.db.classRoutines.push(...newEntries);
        this.saveDb();
        return this.simulate(undefined);
    }

    async getStudentClassRoutine(studentId: string, token: string): Promise<{ routine: ClassRoutineEntry[], teachers: Teacher[] }> {
        validateToken(token, UserType.Student);
        const student = this.db.students.find(s => s.id === studentId);
        if (!student) {
            throw new Error("Student not found.");
        }

        const routine = this.db.classRoutines.filter(
            r => r.school_id === student.school_id && r.class_name === student.class
        );
        
        const teacherIds = new Set(routine.map(r => r.teacher_id));
        const teachers = this.db.teachers.filter(t => teacherIds.has(t.id));

        return this.simulate({ routine, teachers });
    }


    // --- Admin Methods ---
    async getAllSchools(token: string): Promise<School[]> {
        validateToken(token, UserType.SuperAdmin);
        const schools = this.db.schools.map(s => ({
            ...s,
            student_count: this.db.students.filter(st => st.school_id === s.id).length
        }));
        return this.simulate(schools);
    }

    async adminGetStudentsForSchool(token: string, schoolId: string): Promise<Student[]> {
        validateToken(token, UserType.SuperAdmin);
        const students = this.db.students.filter(s => s.school_id === schoolId);
        return this.simulate(students);
    }

    async createSchool(token: string, details: Partial<School>): Promise<School> {
        validateToken(token, UserType.SuperAdmin);
        const newSchool: School = {
            id: details.name!.toLowerCase().replace(/\s+/g, '_') + '_' + Math.random().toString(36).substr(2, 4),
            name: details.name!,
            token: '',
            type: UserType.School,
            address: details.address!,
            contact_no: details.contact_no!,
            status: 'ACTIVE',
            subscription_expiry_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            password: details.password,
        };
        this.db.schools.push(newSchool);
        this.saveDb();
        return this.simulate(newSchool);
    }

    async updateSchool(token: string, schoolId: string, data: Partial<School>): Promise<School> {
        validateToken(token, UserType.SuperAdmin);
        const school = this.db.schools.find(s => s.id === schoolId);
        if(!school) throw new Error("School not found");
        Object.assign(school, data);
        this.saveDb();
        return this.simulate(school);
    }
    
    // --- Public/CMS Methods ---
    async getContactInfo(): Promise<ContactInfo> {
        return this.simulate(this.db.contactInfo);
    }
    
    async updateContactInfo(token: string, data: ContactInfo): Promise<ContactInfo> {
        validateToken(token, UserType.SuperAdmin);
        this.db.contactInfo = data;
        this.saveDb();
        return this.simulate(this.db.contactInfo);
    }

    async getFooterInfo(): Promise<FooterInfo> {
        return this.simulate(this.db.footerInfo);
    }

    async updateFooterInfo(token: string, data: FooterInfo): Promise<FooterInfo> {
        validateToken(token, UserType.SuperAdmin);
        this.db.footerInfo = data;
        this.saveDb();
        return this.simulate(this.db.footerInfo);
    }
}

export const api = new ApiService();