// FIX: This file was a placeholder. Implemented the FaceRecognitionConfirmModal component.
import React from 'react';
// FIX: Import AttendanceStatus to use the enum type for the onConfirm prop.
import { Student, AttendanceStatus } from '../../types';

interface FaceRecognitionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Student;
  // FIX: Updated the onConfirm prop to expect an AttendanceStatus enum member instead of a string literal.
  onConfirm: (status: AttendanceStatus) => void;
  loading: boolean;
}

const FaceRecognitionConfirmModal: React.FC<FaceRecognitionConfirmModalProps> = ({ isOpen, onClose, student, onConfirm, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm">
        <div className="p-6 border-b dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-xl font-semibold leading-6 text-gray-900 dark:text-gray-100">
            Confirm Student
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">&times;</button>
        </div>
        
        <div className="p-6 text-center space-y-4">
            <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 mx-auto flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
            </div>
            <div className="text-left bg-gray-50 dark:bg-gray-700 p-4 rounded-lg space-y-2 text-gray-800 dark:text-gray-200">
                <p><strong>Name:</strong> {student.name}</p>
                <p><strong>Roll No:</strong> {student.roll_no}</p>
                <p><strong>Class:</strong> {student.class}</p>
            </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 grid grid-cols-3 gap-3">
            <button
              type="button"
              // FIX: Pass the correct enum member instead of a string literal.
              onClick={() => onConfirm(AttendanceStatus.IN)}
              disabled={loading}
              className="col-span-1 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-green-400"
            >
              {loading ? '...' : 'Confirm IN'}
            </button>
            <button
              type="button"
              // FIX: Pass the correct enum member instead of a string literal.
              onClick={() => onConfirm(AttendanceStatus.OUT)}
              disabled={loading}
              className="col-span-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-400"
            >
              {loading ? '...' : 'Confirm OUT'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="col-span-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Wrong Student
            </button>
        </div>
      </div>
    </div>
  );
};

export default FaceRecognitionConfirmModal;
