import React, { useState } from 'react';
import { XIcon } from '../ui/Icons';

interface ReminderModalProps {
    onClose: () => void;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({ onClose }) => {
    const [time, setTime] = useState('');
    const [message, setMessage] = useState('');

    const handleSetReminder = (time: string, message: string) => {
        const [hours, minutes] = time.split(':').map(Number);
        const now = new Date();
        const reminderTime = new Date();
        reminderTime.setHours(hours, minutes, 0, 0);

        if (reminderTime <= now) {
            // If time is in the past for today, set it for tomorrow
            reminderTime.setDate(reminderTime.getDate() + 1);
        }
        
        const delay = reminderTime.getTime() - now.getTime();

        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                setTimeout(() => {
                    new Notification('CK AI Assistant Reminder', {
                        body: message,
                        icon: 'https://ckhealthturkey.com/wp-content/uploads/2024/01/CK-Health-Turkey-Logo.png'
                    });
                }, delay);
                alert(`Reminder set for ${reminderTime.toLocaleTimeString()}!`);
                onClose();
            } else {
                alert("You need to allow notifications to set a reminder.");
            }
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if(time && message){
            handleSetReminder(time, message);
        }
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white dark:bg-dark-card p-6 rounded-lg shadow-xl w-full max-w-sm m-4">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Set a Reminder</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full">
                        <XIcon className="w-6 h-6 text-gray-600 dark:text-gray-300"/>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label htmlFor="time" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Time</label>
                        <input type="time" id="time" value={time} onChange={e => setTime(e.target.value)} required className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white" />
                    </div>
                     <div className="mb-6">
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Message</label>
                        <input type="text" id="message" value={message} onChange={e => setMessage(e.target.value)} required placeholder="What should I remind you about?" className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary dark:bg-gray-700 dark:text-white" />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 transition">Cancel</button>
                        <button type="submit" className="px-4 py-2 bg-primary text-white rounded-md hover:bg-opacity-90 transition">Set Reminder</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
