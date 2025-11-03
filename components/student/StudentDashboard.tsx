import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { Student, StudentAnalytics, UserType, AttendanceLog, AttendanceStatus } from '../../types';
import Header from '../common/Header';
import AnalyticsCard from './AnalyticsCard';
import RecentAttendance from './RecentAttendance';
import ComplaintBox from './ComplaintBox';
import FeeStatusCard from './FeeStatusCard';
import MessageBoard from './MessageBoard';
import { pushService } from '../../services/pushService';
import DownloadStudentReportModal from './DownloadStudentReportModal';
import { downloadCSV } from '../../utils/csv';
import ClassRoutineViewer from './ClassRoutineViewer';
import PayFeeModal from './PayFeeModal';

const StudentDashboard: React.FC = () => {
    const { user } = useAuth();
    const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDownloadModalOpen, setDownloadModalOpen] = useState(false);
    const [isPayFeeModalOpen, setIsPayFeeModalOpen] = useState(false);
    const [toastMessage, setToastMessage] = useState<string>('');

    const studentUser = user as Student;
    
    const showToast = (message: string) => {
        setToastMessage(message);
        setTimeout(() => setToastMessage(''), 3000);
    };

    const fetchData = useCallback(async () => {
        if (studentUser) {
            setLoading(true);
            setError(null);
            try {
                const analyticsData = await api.getStudentAnalytics(studentUser.id, studentUser.token);
                setAnalytics(analyticsData);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setLoading(false);
            }
        }
    }, [studentUser]);

    useEffect(() => {
        fetchData();
        // Ask for push notification permission on load
        pushService.subscribeUser(studentUser.id);
    }, [fetchData, studentUser.id]);

    const handlePaymentSuccess = () => {
        setIsPayFeeModalOpen(false);
        showToast("Payment proof submitted successfully for verification.");
        fetchData(); // Refresh analytics to show updated fee status eventually
    };
    
    const handleDownloadReport = async () => {
        if (!user) return;
        try {
            const allLogs = await api.getStudentAttendanceHistory(user.id, user.token);
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const historicalLogs = allLogs.filter(log => {
                const logDate = new Date(log.timestamp);
                logDate.setHours(0, 0, 0, 0);
                return logDate.getTime() < today.getTime();
            });
            
            if (historicalLogs.length === 0) {
                showToast("No historical attendance data found.");
                return;
            }

            const logsByDate = historicalLogs.reduce((acc, log) => {
                const dateStr = new Date(log.timestamp).toLocaleDateString();
                if (!acc[dateStr]) acc[dateStr] = [];
                acc[dateStr].push(log);
                return acc;
            }, {} as Record<string, AttendanceLog[]>);

            const headers = ['Date', 'Status', 'Check-in Time', 'Check-out Time'];
            const data = Object.entries(logsByDate).map(([date, logs]) => {
                logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(a.timestamp).getTime());
                
                const firstIn = logs.find(l => l.status === AttendanceStatus.IN);
                const lastOut = logs.filter(l => l.status === AttendanceStatus.OUT).pop();
                const isAbsent = logs.some(l => l.status === AttendanceStatus.ABSENT);
                
                let status = 'ABSENT'; // Default if no other logs
                if (firstIn) {
                    status = 'PRESENT';
                } else if (isAbsent) {
                    status = 'ABSENT';
                }

                const inTime = firstIn ? new Date(firstIn.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
                const outTime = lastOut ? new Date(lastOut.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
                
                return [date, status, inTime, outTime];
            });

            downloadCSV(headers, data, `Attendance_Report_${user.name}.csv`);
            showToast('Report downloaded successfully!');
            
        } catch (err) {
            showToast(`Error downloading report: ${(err as Error).message}`);
        }
    };

    if (!user || user.type !== UserType.Student) {
        return null; // Or a redirect
    }

    if (loading) {
        return (
            <>
                <Header />
                <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
                    <div className="animate-spin rounded-full h-24 w-24 border-t-2 border-b-2 border-primary"></div>
                </div>
            </>
        );
    }
    
    if (error) {
        return (
            <>
                <Header />
                <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                    <div className="text-center text-red-500 bg-red-100 dark:bg-red-900 dark:text-red-200 p-4 rounded-lg">{error}</div>
                </main>
            </>
        )
    }

    return (
        <>
            <Header />
            <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-neutral dark:text-gray-200">Welcome, {studentUser.name}</h1>
                    <p className="text-gray-500 dark:text-gray-400">Class: {studentUser.class} | Roll No: {studentUser.roll_no}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <AnalyticsCard title="Days Present" value={`${analytics?.present_count || 0}`} color="green" />
                    <AnalyticsCard title="Days Absent" value={`${analytics?.absent_count || 0}`} color="red" />
                    <AnalyticsCard title="Last Entry" value={analytics?.last_entry ? new Date(analytics.last_entry).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'} color="blue" />
                    <AnalyticsCard title="Last Exit" value={analytics?.last_exit ? new Date(analytics.last_exit).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'} color="yellow" />
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <ClassRoutineViewer student={studentUser} />
                        <MessageBoard studentId={studentUser.id} schoolId={studentUser.school_id} token={studentUser.token} />
                        <ComplaintBox studentId={studentUser.id} token={studentUser.token} />
                    </div>
                    <div className="space-y-8">
                        <FeeStatusCard student={studentUser} onPayNow={() => setIsPayFeeModalOpen(true)} />
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                            <h3 className="text-xl font-bold text-neutral dark:text-gray-200 mb-4">Quick Actions</h3>
                            <div className="space-y-3">
                                <button 
                                    onClick={() => setDownloadModalOpen(true)}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-secondary rounded-lg shadow-md hover:bg-secondary-hover">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                    Download Report
                                </button>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
                            <h3 className="text-xl font-bold text-neutral dark:text-gray-200 mb-4">Recent Activity</h3>
                            <RecentAttendance logs={analytics?.recent_logs || []} />
                        </div>
                    </div>
                </div>
            </main>
            {isDownloadModalOpen && (
                <DownloadStudentReportModal 
                    isOpen={isDownloadModalOpen}
                    onClose={() => setDownloadModalOpen(false)}
                    onDownload={handleDownloadReport}
                />
            )}
            {isPayFeeModalOpen && (
                <PayFeeModal
                    isOpen={isPayFeeModalOpen}
                    onClose={() => setIsPayFeeModalOpen(false)}
                    student={studentUser}
                    onSuccess={handlePaymentSuccess}
                />
            )}
            {toastMessage && (
                <div className="fixed bottom-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg animate-bounce z-[100]">
                    {toastMessage}
                </div>
            )}
        </>
    );
};

export default StudentDashboard;
