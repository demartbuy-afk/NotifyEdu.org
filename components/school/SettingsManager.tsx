import React, { useState, useEffect } from 'react';
import { notificationService, NotificationSettings, NotificationEventType } from '../../services/notificationService';
import { School } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';

interface SettingsManagerProps {
    school: School;
    onUpdate: (updatedSchool: School) => void;
    showToast: (message: string) => void;
}

const SettingsManager: React.FC<SettingsManagerProps> = ({ school, onUpdate, showToast }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<NotificationSettings>(notificationService.getSettings());
    const [openingTime, setOpeningTime] = useState('');
    const [closingTime, setClosingTime] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        notificationService.saveSettings(settings);
    }, [settings]);

    useEffect(() => {
        setOpeningTime(school.opening_time || '09:00');
        setClosingTime(school.closing_time || '16:00');
    }, [school]);

    const handleToggle = (key: NotificationEventType) => {
        setSettings(prev => {
            const newSettings = { ...prev, [key]: !prev[key] };
            if (newSettings[key] && Notification.permission === 'default') {
                notificationService.requestPermission();
            }
            return newSettings;
        });
        showToast('Notification settings updated.');
    };
    
    const handleSaveTimings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSaving(true);
        try {
            const updatedSchool = await api.updateSchoolProfile(user.id, user.token, {
                opening_time: openingTime,
                closing_time: closingTime,
            });
            onUpdate(updatedSchool);
        } catch (err) {
            showToast(`Error: ${(err as Error).message}`);
        } finally {
            setIsSaving(false);
        }
    };
    
    const notificationPermission = Notification.permission;

    return (
        <div>
            <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-2">Notification Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Choose which events should trigger a browser notification on this device.
            </p>

            {notificationPermission === 'denied' && (
                 <div className="bg-red-100 dark:bg-red-900/50 border-l-4 border-red-500 text-red-700 dark:text-red-200 p-4 rounded-r-lg mb-6" role="alert">
                    <p className="font-bold">Notifications Blocked</p>
                    <p className="text-sm">
                        You have blocked notifications for this site. You must enable them in your browser settings to receive alerts.
                    </p>
                </div>
            )}
            
            <div className="max-w-2xl space-y-4">
                <SettingToggle
                    label="Attendance Marked"
                    description="Receive an alert when attendance is recorded for a student."
                    enabled={settings.attendance}
                    onToggle={() => handleToggle('attendance')}
                    disabled={notificationPermission === 'denied'}
                />
                 <SettingToggle
                    label="Announcement Posted"
                    description="Get notified when you post a new school-wide announcement."
                    enabled={settings.announcement}
                    onToggle={() => handleToggle('announcement')}
                    disabled={notificationPermission === 'denied'}
                />
                <SettingToggle
                    label="Complaint Resolved"
                    description="Receive a confirmation when you mark a complaint as resolved."
                    enabled={settings.complaint}
                    onToggle={() => handleToggle('complaint')}
                    disabled={notificationPermission === 'denied'}
                />
                <SettingToggle
                    label="Message Sent to Parent"
                    description="Get notified when you successfully send a direct message to a parent."
                    enabled={settings.message}
                    onToggle={() => handleToggle('message')}
                    disabled={notificationPermission === 'denied'}
                />
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-2">School Timings</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    Set the official school hours. This will be used for late-coming analysis.
                </p>
                <form onSubmit={handleSaveTimings} className="max-w-2xl space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <label htmlFor="openingTime" className="font-semibold text-neutral dark:text-gray-200">Opening Time</label>
                        <input
                            type="time"
                            id="openingTime"
                            value={openingTime}
                            onChange={(e) => setOpeningTime(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <label htmlFor="closingTime" className="font-semibold text-neutral dark:text-gray-200">Closing Time</label>
                        <input
                            type="time"
                            id="closingTime"
                            value={closingTime}
                            onChange={(e) => setClosingTime(e.target.value)}
                            className="px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <div className="text-right">
                        <button type="submit" disabled={isSaving} className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover disabled:bg-gray-400">
                            {isSaving ? 'Saving...' : 'Save Timings'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


interface SettingToggleProps {
    label: string;
    description: string;
    enabled: boolean;
    onToggle: () => void;
    disabled: boolean;
}

const SettingToggle: React.FC<SettingToggleProps> = ({ label, description, enabled, onToggle, disabled }) => {
    return (
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
                <p className="font-semibold text-neutral dark:text-gray-200">{label}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
            </div>
            <button
                type="button"
                onClick={onToggle}
                disabled={disabled}
                className={`${
                    enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
                } relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50`}
                aria-checked={enabled}
            >
                <span className="sr-only">Enable notifications</span>
                <span
                    className={`${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                    } inline-block w-4 h-4 transform bg-white rounded-full transition-transform`}
                />
            </button>
        </div>
    )
}


export default SettingsManager;