import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { api } from '../../services/api';
import { Student } from '../../types';

interface FaceEnrollmentStepProps {
  student: Student;
  token: string;
  onComplete: (enrolled: boolean) => void;
}

type EnrollmentStatus = 'IDLE' | 'SCANNING' | 'SAVING' | 'DONE';
interface Coverage {
  left: boolean;
  center: boolean;
  right: boolean;
}

const FaceEnrollmentStep: React.FC<FaceEnrollmentStepProps> = ({ student, token, onComplete }) => {
  const webcamRef = useRef<Webcam>(null);
  const timeoutRef = useRef<number | null>(null);

  const [status, setStatus] = useState<EnrollmentStatus>('IDLE');
  const [hint, setHint] = useState('Click "Start Enrollment" to begin the guided process.');
  const [coverage, setCoverage] = useState<Coverage>({ left: false, center: false, right: false });

  const resetState = useCallback(() => {
    setStatus('IDLE');
    setCoverage({ left: false, center: false, right: false });
    setHint('Click "Start Enrollment" to begin.');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);
  
  const handleSaveEnrollment = useCallback(async () => {
      setStatus('SAVING');
      setHint('Saving enrollment data...');
      try {
        await api.enrollFace(student.student_id, token);
        setStatus('DONE');
        setHint('Enrollment Successful!');
        setTimeout(() => onComplete(true), 1500); // Wait a bit before closing
      } catch (err) {
        setHint(`Error: ${(err as Error).message}`);
        setTimeout(resetState, 3000);
      }
  }, [student, token, onComplete, resetState]);

  // State machine to guide the user through capturing different angles
  useEffect(() => {
    if (status === 'SCANNING') {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      if (coverage.left && coverage.center && coverage.right) {
        setHint("All angles captured! Saving...");
        handleSaveEnrollment();
      } else if (!coverage.left) {
        setHint("Slowly turn your head to the LEFT");
        timeoutRef.current = window.setTimeout(() => setCoverage(prev => ({ ...prev, left: true })), 2000);
      } else if (!coverage.center) {
        setHint("Great! Now look at the CENTER");
        timeoutRef.current = window.setTimeout(() => setCoverage(prev => ({ ...prev, center: true })), 2000);
      } else if (!coverage.right) {
        setHint("Perfect. Now slowly turn to the RIGHT");
        timeoutRef.current = window.setTimeout(() => setCoverage(prev => ({ ...prev, right: true })), 2000);
      }
    }
  }, [status, coverage, handleSaveEnrollment]);

  const handleStartScan = () => {
    setStatus('SCANNING');
  };
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const videoConstraints = {
    width: 320, height: 320, facingMode: "user"
  };

  return (
    <div className="w-full text-center space-y-4">
        <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 border-dashed border-primary mx-auto flex items-center justify-center bg-black">
             <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                videoConstraints={videoConstraints}
                mirrored
                className="scale-150"
            />
            {status === 'SAVING' || status === 'DONE' ? (
                 <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                    {status === 'SAVING' && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>}
                    {status === 'DONE' && <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                    <p className="mt-4 font-semibold">{hint}</p>
                 </div>
            ) : null}
        </div>
        <div className="h-5">
            <p className="text-sm text-center text-gray-600 dark:text-gray-400 font-semibold">{hint}</p>
        </div>
        <div className="flex justify-center items-center space-x-4">
            <div className={`w-3 h-3 rounded-full transition-colors ${coverage.left ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <div className={`w-3 h-3 rounded-full transition-colors ${coverage.center ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <div className={`w-3 h-3 rounded-full transition-colors ${coverage.right ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
        </div>
        <div className="flex justify-center space-x-4 pt-4">
            <button
                onClick={() => onComplete(false)}
                disabled={status !== 'IDLE'}
                className="px-6 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
                Skip For Now
            </button>
             <button
                onClick={handleStartScan}
                disabled={status !== 'IDLE'}
                className="px-6 py-2 text-sm font-medium text-white bg-secondary rounded-md shadow-sm hover:bg-secondary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-focus disabled:bg-green-300 dark:disabled:bg-green-800 disabled:opacity-50"
            >
                Start Enrollment
            </button>
        </div>
    </div>
  );
};

export default FaceEnrollmentStep;