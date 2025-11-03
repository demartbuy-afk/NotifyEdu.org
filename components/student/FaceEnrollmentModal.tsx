import React, { useState, useRef, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { api } from '../../services/api';

interface FaceEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentId: string;
  token: string;
  onSuccess: () => void;
}

type EnrollmentStatus = 'IDLE' | 'SCANNING' | 'SAVING' | 'DONE';
interface Coverage {
  left: boolean;
  center: boolean;
  right: boolean;
}

const FaceEnrollmentModal: React.FC<FaceEnrollmentModalProps> = ({ isOpen, onClose, studentId, token, onSuccess }) => {
  const webcamRef = useRef<Webcam>(null);
  const timeoutRef = useRef<number | null>(null);

  const [status, setStatus] = useState<EnrollmentStatus>('IDLE');
  const [hint, setHint] = useState('Follow the on-screen instructions to complete enrollment.');
  const [coverage, setCoverage] = useState<Coverage>({ left: false, center: false, right: false });

  const resetState = useCallback(() => {
    setStatus('IDLE');
    setCoverage({ left: false, center: false, right: false });
    setHint('Follow the on-screen instructions to complete enrollment.');
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  const handleClose = () => {
    resetState();
    if (status === 'DONE') {
      onSuccess();
    }
    onClose();
  };

  const handleSaveEnrollment = useCallback(async () => {
    setStatus('SAVING');
    setHint('Saving your enrollment...');
    try {
      await api.enrollFace(studentId, token);
      setStatus('DONE');
      setHint('Enrollment Successful!');
    } catch (err) {
      setStatus('IDLE'); // Reset to allow retry
      setHint(`Error: ${(err as Error).message}. Please try again.`);
    }
  }, [studentId, token]);

  // State machine to guide the user through capturing different angles
  useEffect(() => {
    if (status === 'SCANNING') {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        
        if(coverage.left && coverage.center && coverage.right) {
            setHint("All angles captured! Saving...");
            handleSaveEnrollment();
        } else if (!coverage.left) {
            setHint("Slowly turn your head to the LEFT");
            timeoutRef.current = window.setTimeout(() => setCoverage(prev => ({...prev, left: true})), 2000);
        } else if (!coverage.center) {
            setHint("Great! Now look at the CENTER");
            timeoutRef.current = window.setTimeout(() => setCoverage(prev => ({...prev, center: true})), 2000);
        } else if (!coverage.right) {
            setHint("Perfect. Now slowly turn to the RIGHT");
            timeoutRef.current = window.setTimeout(() => setCoverage(prev => ({...prev, right: true})), 2000);
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

  if (!isOpen) return null;
  
  const isActionable = status === 'IDLE' || status === 'DONE';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6 border-b dark:border-gray-700">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Face Enrollment</h3>
        </div>
        <div className="p-6 text-center space-y-4">
          <div className="w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden border-4 border-dashed border-primary mx-auto flex items-center justify-center bg-black">
            <Webcam
              audio={false}
              ref={webcamRef}
              videoConstraints={{ facingMode: "user" }}
              mirrored
              className="scale-150"
            />
             {status === 'SAVING' || status === 'DONE' ? (
                 <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white">
                    {status === 'SAVING' && <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>}
                    {status === 'DONE' && <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>}
                 </div>
            ) : null}
          </div>
          <p className="h-5 text-sm font-semibold text-gray-600 dark:text-gray-400">{hint}</p>
          <div className="flex justify-center items-center space-x-4">
            <div className={`w-3 h-3 rounded-full transition-colors ${coverage.left ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <div className={`w-3 h-3 rounded-full transition-colors ${coverage.center ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
            <div className={`w-3 h-3 rounded-full transition-colors ${coverage.right ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 flex justify-end space-x-3">
          {isActionable ? (
            <button onClick={handleClose} type="button" className="px-4 py-2 text-sm font-medium text-white bg-primary rounded-md shadow-sm hover:bg-primary-hover">
              {status === 'DONE' ? 'Done' : 'Close'}
            </button>
          ) : (
            <button type="button" disabled className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 dark:bg-gray-700 dark:text-gray-400 rounded-md">Cancel</button>
          )}

          {status === 'IDLE' && (
            <button onClick={handleStartScan} type="button" className="px-4 py-2 text-sm font-medium text-white bg-secondary rounded-md shadow-sm hover:bg-secondary-hover">
                Start
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FaceEnrollmentModal;