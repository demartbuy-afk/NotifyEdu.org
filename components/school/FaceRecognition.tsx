import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Webcam from 'react-webcam';
// FIX: Import AttendanceMode to use the enum instead of a string literal.
import { Student, AttendanceLog, AttendanceStatus, AttendanceMode } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import FaceRecognitionConfirmModal from './FaceRecognitionConfirmModal';

// --- Constants ---
const CONSECUTIVE_FRAMES_SUCCESS = 5;

// --- Prop Types ---
interface FaceRecognitionProps {
  students: Student[];
  logs: AttendanceLog[];
  onAttendanceMarked: (log: AttendanceLog) => void;
}

// --- Component State and Types ---
type Status = 'IDLE' | 'SCANNING' | 'VERIFYING' | 'SUCCESS' | 'FAILURE';

const FaceRecognition: React.FC<FaceRecognitionProps> = ({ students, logs, onAttendanceMarked }) => {
  const { user } = useAuth();
  const webcamRef = useRef<Webcam>(null);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>('IDLE');
  const [hint, setHint] = useState('Select a student and activate the camera to begin.');
  const [stableFrames, setStableFrames] = useState(0);

  const [confirmingStudent, setConfirmingStudent] = useState<Student | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  
  const [simulatedStudentId, setSimulatedStudentId] = useState<string>('');
  
  const enrolledStudents = useMemo(() => {
      return students.filter(s => s.face_enrolled);
  }, [students]);

  const resetState = useCallback((nextStatus: Status = 'IDLE') => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setStatus(nextStatus);
    setStableFrames(0);
    setHint(nextStatus === 'SCANNING' ? 'Searching for face...' : 'Select a student and activate the camera to begin.');
  }, []);

  // --- Verification Logic now uses the selected student ---
  const handleVerification = useCallback(() => {
    setStatus('VERIFYING');
    setHint('Face detected. Please confirm.');
    
    const recognizedStudent = students.find(s => s.student_id === simulatedStudentId);
    
    if (!recognizedStudent) {
      setStatus('FAILURE');
      setHint("Error: Simulated student not found. Please select one.");
      timeoutRef.current = window.setTimeout(() => resetState('SCANNING'), 4000);
      return;
    }

    // Check if student is already marked IN today
    const todaysLogsMap = new Map<string, AttendanceLog>();
    logs.forEach(log => {
      // Get the latest log for each student today
      // FIX: Changed student_id to entity_id to match the AttendanceLog type.
      if (!todaysLogsMap.has(log.entity_id) || new Date(log.timestamp) > new Date(todaysLogsMap.get(log.entity_id)!.timestamp)) {
        // FIX: Changed student_id to entity_id to match the AttendanceLog type.
        todaysLogsMap.set(log.entity_id, log);
      }
    });
    const lastLog = todaysLogsMap.get(recognizedStudent.student_id);

    if (lastLog && lastLog.status === 'IN') {
      setStatus('FAILURE');
      setHint(`${recognizedStudent.name} is already marked as IN.`);
      timeoutRef.current = window.setTimeout(() => resetState('SCANNING'), 4000);
      return;
    }
    
    setConfirmingStudent(recognizedStudent);
  }, [simulatedStudentId, students, logs, resetState]);


  // --- Handles confirmation from modal ---
  const handleConfirmAttendance = async (statusToMark: AttendanceStatus) => {
    if (!user || !confirmingStudent) return;
    
    setConfirmLoading(true);
    
    try {
      // FIX: Use the AttendanceMode enum for type safety.
      const newLog = await api.markAttendance(user.id, user.token, confirmingStudent.student_id, statusToMark, AttendanceMode.FACE);
      
      setStatus('SUCCESS');
      setHint(`Attendance Recorded for ${confirmingStudent.name} ✅`);
      onAttendanceMarked(newLog);
      
      setConfirmingStudent(null);
      timeoutRef.current = window.setTimeout(() => resetState('SCANNING'), 3000);

    } catch (err) {
      setStatus('FAILURE');
      setHint(`Failed: ${(err as Error).message}`);
      setConfirmingStudent(null);
      timeoutRef.current = window.setTimeout(() => resetState('SCANNING'), 4000);
    } finally {
      setConfirmLoading(false);
    }
  };

  // --- Frame Processing Simulation ---
  const processFrame = useCallback(() => {
    if (Math.random() < 0.95) {
        setHint("Hold steady...");
        setStableFrames(prev => prev + 1);
        return;
    }

    const randomFailure = Math.random();
    if (randomFailure < 0.25) setHint("Please center your face in the camera.");
    else if (randomFailure < 0.5) setHint("Too dark. Please find better lighting.");
    else if (randomFailure < 0.75) setHint("Face obstructed. Please ensure your face is clear.");
    else setHint("Liveness check failed. Please hold still.");

    setStableFrames(0);
  }, []);
  
  useEffect(() => {
    if (stableFrames >= CONSECUTIVE_FRAMES_SUCCESS) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        handleVerification();
    }
  }, [stableFrames, handleVerification]);

  const toggleScanning = () => {
    if (status === 'SCANNING') {
        resetState('IDLE');
    } else {
        if (!simulatedStudentId) {
            setHint("Please select a student to simulate recognition for.");
            return;
        }
        setStatus('SCANNING');
        setHint('Searching for face...');
        intervalRef.current = window.setInterval(processFrame, 500);
    }
  };
  
  useEffect(() => {
      return () => {
          if (intervalRef.current) clearInterval(intervalRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
  }, []);

  const progressPercentage = (stableFrames / CONSECUTIVE_FRAMES_SUCCESS) * 100;

  return (
    <>
      <div className="flex flex-col items-center space-y-4">
        <div className="w-full max-w-sm">
            <label htmlFor="simulateStudent" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                1. Select Student to Simulate
            </label>
            <select
                id="simulateStudent"
                value={simulatedStudentId}
                onChange={(e) => {
                    setSimulatedStudentId(e.target.value);
                    setHint(e.target.value ? "Ready to scan. Activate the camera." : "Select a student to begin.");
                }}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                disabled={status !== 'IDLE' && status !== 'SCANNING'}
            >
                <option value="">-- Select a student to test --</option>
                {enrolledStudents.map(student => (
                    <option key={student.student_id} value={student.student_id}>
                        {student.name} ({student.roll_no})
                    </option>
                ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                This is a demo. Selecting a student ensures a 100% successful match for testing.
            </p>
        </div>
      
        <div className="relative w-full max-w-sm aspect-square rounded-full overflow-hidden border-4 border-dashed border-gray-300 dark:border-gray-600 mx-auto flex items-center justify-center bg-black">
          <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              width={400}
              height={400}
              videoConstraints={{ facingMode: "user" }}
              mirrored
              className="scale-150"
          />
          <div className={`absolute inset-0 transition-all duration-300 flex flex-col items-center justify-center text-white p-4 text-center z-10 ${status === 'SUCCESS' ? 'bg-green-500/80' : status === 'FAILURE' ? 'bg-red-500/80' : status === 'VERIFYING' ? 'bg-black/70' : 'bg-transparent pointer-events-none'}`}>
            {status === 'VERIFYING' && !confirmingStudent && <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white mb-4"></div>}
            <p className="font-semibold text-lg drop-shadow-md">{hint}</p>
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-4/5">
              <div className="w-full bg-black/30 rounded-full h-2.5">
                  <div className="bg-secondary h-2.5 rounded-full transition-all duration-500" style={{width: `${progressPercentage}%`}}></div>
              </div>
          </div>
        </div>

        <div className="text-center h-5">
            <p className={`text-sm font-medium ${status === 'FAILURE' ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
                {/* Message is now shown in the camera overlay */}
            </p>
        </div>
        
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            2. Activate Camera
        </label>
        <button 
            onClick={toggleScanning}
            disabled={status === 'VERIFYING' || status === 'SUCCESS' || (!simulatedStudentId && status !== 'SCANNING')}
            className={`px-8 py-3 text-white font-bold rounded-lg shadow-lg transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed
              ${status === 'SCANNING' ? 'bg-red-600 hover:bg-red-700' : 'bg-secondary hover:bg-secondary-hover'}`}
        >
            {status === 'SCANNING' ? 'Stop Camera' : 'Activate Camera'}
        </button>
      </div>

      {confirmingStudent && (
        <FaceRecognitionConfirmModal
            isOpen={!!confirmingStudent}
            onClose={() => {
                setConfirmingStudent(null);
                if (status !== 'SUCCESS') resetState('SCANNING');
            }}
            student={confirmingStudent}
            onConfirm={handleConfirmAttendance}
            loading={confirmLoading}
        />
      )}
    </>
  );
};

export default FaceRecognition;