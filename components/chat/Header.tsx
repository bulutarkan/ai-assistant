
import React, { useState } from 'react';
import { MenuIcon, BellIcon } from '../ui/Icons';
import { useProjects } from '../../hooks/useProjects';
import { useNavigate } from 'react-router-dom';

interface HeaderProps {
    onToggleSidebar: () => void;
    isSidebarOpen: boolean;
    title?: string;
    onSetView?: (view: 'chat' | 'blogAI' | 'blogDashboard' | 'blogSchedule' | 'contentAnalyzer' | 'advancedSEO' | 'keywordAnalyzer' | 'searchConsole' | 'serpApi' | 'files' | 'projects') => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleSidebar, isSidebarOpen, title, onSetView }) => {
    const { tasks } = useProjects();
    const navigate = useNavigate();
    const [showTooltip, setShowTooltip] = useState(false);

    const pendingTaskCount = tasks.filter(task => !task.completed).length;

    const handleNotificationClick = () => {
        if (onSetView) {
            onSetView('projects');
        } else {
            // Fallback to navigation if onSetView not provided
            navigate('/projects');
        }
    };

    const handleMouseEnter = () => {
        setShowTooltip(true);
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    return (
        <header className="flex-shrink-0 w-full h-16 sticky top-0 z-20 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border">
            <div className="flex items-center justify-between p-4 h-full">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleSidebar}
                        className="p-2 -ml-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-dark-border/50 transition-colors"
                        title="Toggle sidebar"
                    >
                        <MenuIcon className="w-6 h-6" />
                    </button>
                    {title && (
                        <h2 className="text-lg font-semibold text-text-primary truncate max-w-xs">
                            {title}
                        </h2>
                    )}
                </div>

                <div className="flex items-center relative">
                    <button
                        onClick={handleNotificationClick}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                        className="relative p-2 text-text-secondary hover:text-text-primary rounded-lg hover:bg-dark-border/50 transition-colors"
                        title={`You have ${pendingTaskCount} pending task${pendingTaskCount !== 1 ? 's' : ''}`}
                    >
                        <BellIcon className={`${pendingTaskCount > 0 ? 'fill-current' : ''} w-6 h-6`} />
                        {pendingTaskCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                                {pendingTaskCount > 9 ? '9+' : pendingTaskCount}
                            </span>
                        )}
                    </button>

                    {/* Hover Tooltip */}
                    {showTooltip && (
                        <div className="absolute top-12 right-0 bg-gray-800 text-white px-4 py-3 rounded-md text-sm font-medium shadow-lg z-50 border border-gray-600 transform translate-y-2 transition-all duration-200 ease-out whitespace-nowrap">
                            You have {pendingTaskCount} pending task{pendingTaskCount !== 1 ? 's' : ''}
                            {/* Tooltip Arrow */}
                            <div className="absolute -top-1 right-6 w-2 h-2 bg-gray-800 border-l border-t border-gray-600 transform rotate-45"></div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};
