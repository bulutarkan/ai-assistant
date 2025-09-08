import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Conversation, BlogAIConversation } from '../../types';
import { useAuth } from '../../hooks/useAuth';
import {
    SearchIcon, EditIcon, FilesIcon, ProjectsIcon, HistoryIcon, ChevronDoubleLeftIcon,
    TrashIcon, CheckIcon, XIcon, MoreHorizontalIcon, SettingsIcon, ClipboardListIcon,
} from '../ui/Icons';
import { ConfirmationModal } from '../ui/ConfirmationModal';

type ViewType = 'chat' | 'blogAI' | 'blogDashboard' | 'blogSchedule' | 'contentAnalyzer' | 'advancedSEO' | 'keywordAnalyzer' | 'searchConsole' | 'serpApi' | 'files' | 'projects';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  conversations: Conversation[];
  blogAIConversations?: BlogAIConversation[];
  activeConversationId?: string;
  activeBlogAIConversationId?: string;
  onSelectConversation: (id: string) => void;
  onSelectBlogAIConversation?: (id: string) => void;
  onNewChat: () => void;
  onNewBlogAIChat?: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onRenameBlogAIConversation?: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onDeleteBlogAIConversation?: (id: string) => void;
  onOpenSettings: () => void;
  currentView: ViewType;
  onSetView: (view: ViewType) => void;
}

const NavItem = ({ icon, label, active = false, onClick }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void }) => (
    <button
        onClick={onClick}
        className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium btn-press focus-ring ${
            active
                ? 'bg-dark-card text-text-primary active'
                : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
        }`}
    >
        {icon}
        <span>{label}</span>
    </button>
);

const HistoryItem = ({
    conversation,
    isActive,
    onSelect,
    onRename,
    onDelete,
    openMenuId,
    setOpenMenuId,
    editingMenuId,
    setEditingMenuId
}: {
    conversation: Conversation,
    isActive: boolean,
    onSelect: (id: string) => void,
    onRename: (id: string, title: string) => void,
    onDelete: (id: string) => void,
    openMenuId: string | null,
    setOpenMenuId: (id: string | null) => void,
    editingMenuId: string | null,
    setEditingMenuId: (id: string | null) => void
}) => {
    const [title, setTitle] = useState(conversation.title);
    const [isConfirmingDelete, setConfirmingDelete] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const isEditing = editingMenuId === conversation.id;

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (title.trim() && title.trim() !== conversation.title) {
            onRename(conversation.id, title.trim());
        }
        setEditingMenuId(null);
    };

    const startRename = () => {
        setEditingMenuId(conversation.id);
    };

    return (
        <div className={`group flex items-center gap-2 px-3 py-2 rounded-md ${isActive ? 'bg-dark-card/70' : 'hover:bg-dark-card/50'}`}>
            {isEditing ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                        ref={inputRef}
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        onBlur={handleSave}
                        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                        className="flex-1 bg-dark-border text-sm px-2 py-1 rounded-md focus:outline-none min-w-0 truncate"
                    />
                    <button onClick={handleSave} className="flex-shrink-0 p-1 text-green-500 hover:bg-dark-border rounded-md">
                        <CheckIcon className="w-4 h-4"/>
                    </button>
                    <button onClick={() => setEditingMenuId(null)} className="flex-shrink-0 p-1 text-red-500 hover:bg-dark-border rounded-md">
                        <XIcon className="w-4 h-4"/>
                    </button>
                </div>
            ) : (
                <>
                    <button
                        onClick={() => onSelect(conversation.id)}
                        className="flex-1 text-left text-sm text-text-secondary hover:text-text-primary truncate transition-colors min-w-0"
                    >
                        {conversation.title}
                    </button>
                    <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                            onClick={startRename}
                            className="p-1.5 text-text-tertiary hover:text-blue-500 hover:bg-dark-border rounded-md transition-colors"
                            title="Rename chat"
                        >
                            <EditIcon className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setConfirmingDelete(true)}
                            className="p-1.5 text-text-tertiary hover:text-red-500 hover:bg-dark-border rounded-md transition-colors"
                            title="Delete chat"
                        >
                            <TrashIcon className="w-4 h-4" />
                        </button>
                    </div>
                </>
            )}

            <ConfirmationModal
                isOpen={isConfirmingDelete}
                title="Delete Chat?"
                message={`Are you sure you want to delete "${conversation.title}"?`}
                onConfirm={() => { onDelete(conversation.id); setConfirmingDelete(false); }}
                onCancel={() => setConfirmingDelete(false)}
            />
        </div>
    );
};

const UserProfile = ({ onToggleSidebar, onOpenSettings }: { onToggleSidebar: () => void, onOpenSettings: () => void }) => {
    const { user, logout, loading } = useAuth();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Show loading state if still checking authentication
    if (loading) {
        return (
            <div className="p-3 border-t border-dark-border">
                <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                </div>
            </div>
        );
    }

    // Show not authenticated state
    if (!user) {
        return (
            <div className="p-3 border-t border-dark-border">
                <div className="text-center text-sm text-text-secondary">
                    <p>Not signed in</p>
                    <p className="text-xs mt-1">Please refresh the page</p>
                </div>
            </div>
        );
    }

    const initials = `${user.name[0] || ''}${user.surname[0] || ''}`.toUpperCase();

    const handleLogout = async () => {
        if (isLoggingOut) return;

        setIsLoggingOut(true);
        try {
            const result = await logout();
            if (!result.success) {
                console.error('Logout failed:', result.error);
                // Force logout even if API call fails
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout error:', error);
            // Force redirect on error
            window.location.href = '/login';
        } finally {
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="p-3 border-t border-dark-border">
            <div className="flex items-center justify-between mb-3">
                 <button onClick={onOpenSettings} className="flex items-center gap-3 text-left w-full hover:bg-dark-card p-2 rounded-md transition-colors">
                    {user.avatar ? (
                        <img
                            src={user.avatar}
                            alt="Avatar"
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 shadow-sm border-2 border-primary"
                        />
                    ) : (
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-focus rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm">
                            {initials}
                        </div>
                    )}
                    <div className="flex flex-col flex-1 min-w-0">
                        <p className="font-semibold text-sm text-text-primary truncate">{`${user.name} ${user.surname}`}</p>
                        <p className="text-xs text-text-secondary truncate">{user.email}</p>
                    </div>
                 </button>
                 <button onClick={onToggleSidebar} className="p-2 text-text-tertiary hover:text-text-primary rounded-md transition-colors">
                    <ChevronDoubleLeftIcon className="w-5 h-5"/>
                 </button>
            </div>

            <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-lg border border-red-500/20 hover:border-red-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoggingOut ? (
                    <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-red-400 border-t-transparent"></div>
                        <span className="text-sm font-medium">Logging out...</span>
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                            <polyline points="16 17 21 12 16 7"></polyline>
                            <line x1="21" y1="12" x2="9" y2="12"></line>
                        </svg>
                        <span className="text-sm font-medium">Logout</span>
                    </>
                )}
            </button>
        </div>
    );
};

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  conversations,
  blogAIConversations = [],
  activeConversationId,
  activeBlogAIConversationId,
  onSelectConversation,
  onSelectBlogAIConversation,
  onNewChat,
  onNewBlogAIChat,
  onRenameConversation,
  onRenameBlogAIConversation,
  onDeleteConversation,
  onDeleteBlogAIConversation,
  onOpenSettings,
  currentView,
  onSetView
}) => {
    const { user } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
    const [isBlogAIMenuOpen, setIsBlogAIMenuOpen] = useState(false);
    const sidebarRef = useRef<HTMLElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setOpenMenuId(null);
                setEditingMenuId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredConversations = useMemo(() => {
        if (currentView === 'blogAI') {
            return blogAIConversations.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        return conversations.filter(c => c.title.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [conversations, blogAIConversations, searchTerm, currentView]);
  
    return (
        <aside ref={sidebarRef} className={`bg-dark-sidebar text-text-primary flex flex-col fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'} w-80 border-r border-dark-border`}>

            {/* Fixed Navigation Section */}
            <div className="flex-shrink-0">
                <div className="p-3">
                    <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"/>
                        <input
                            type="text"
                            placeholder="Search history..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-dark-card border border-dark-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <nav className="px-3 space-y-1.5">
                    <NavItem icon={<EditIcon className="w-5 h-5"/>} label="Ask" onClick={onNewChat} active={currentView === 'chat'} />

                    {/* Blog AI Dropdown */}
                    <div>
                        <button
                            onClick={() => setIsBlogAIMenuOpen(!isBlogAIMenuOpen)}
                            className={`flex w-full items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${
                                currentView === 'blogAI' || currentView === 'blogDashboard' || currentView === 'blogSchedule' || currentView === 'contentAnalyzer' || currentView === 'keywordAnalyzer' || currentView === 'searchConsole' || currentView === 'serpApi'
                                    ? 'bg-dark-card text-text-primary'
                                    : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                            }`}
                        >
                            <ClipboardListIcon className="w-5 h-5" />
                            <span>Digital Marketing</span>
                            <ChevronDoubleLeftIcon className={`w-4 h-4 ml-auto transition-transform ${isBlogAIMenuOpen ? 'rotate-90' : ''}`} />
                        </button>

                        {/* Dropdown Menu */}
                        {isBlogAIMenuOpen && (
                            <div className="ml-6 mt-1 space-y-1 border-l border-dark-border pl-3">
                                <button
                                    onClick={onNewBlogAIChat}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'blogAI' && !activeBlogAIConversationId
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <EditIcon className="w-5 h-5" />
                                    New Chat
                                </button>
                                <button
                                    onClick={() => onSetView('blogDashboard')}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'blogDashboard'
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <ClipboardListIcon className="w-5 h-5" />
                                    Blog Dashboard
                                </button>
                                <button
                                    onClick={() => onSetView('blogSchedule')}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'blogSchedule'
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Blog Schedule
                                </button>
                                <button
                            onClick={() => onSetView('contentAnalyzer')}
                            className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                currentView === 'contentAnalyzer'
                                    ? 'bg-primary/20 text-primary active'
                                    : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                            }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            Content Analyzer
                                </button>
                                <button
                                    onClick={() => onSetView('advancedSEO')}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'advancedSEO'
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                    </svg>
                                    Advanced SEO Sensor
                                </button>
                                <button
                                    onClick={() => onSetView('keywordAnalyzer')}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'keywordAnalyzer'
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                    </svg>
                                    Keyword Analyzer
                                </button>
                                <button
                                    onClick={() => onSetView('searchConsole')}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'searchConsole'
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Search Console
                                </button>
                                <button
                                    onClick={() => onSetView('serpApi')}
                                    className={`sidebar-nav-item flex w-full items-center gap-3 px-3 py-2 rounded-lg text-sm btn-press focus-ring ${
                                        currentView === 'serpApi'
                                            ? 'bg-primary/20 text-primary active'
                                            : 'text-text-secondary hover:bg-dark-card hover:text-text-primary'
                                    }`}
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                    SerpApi
                                </button>
                            </div>
                        )}
                    </div>

                    <NavItem icon={<FilesIcon className="w-5 h-5"/>} label="Files" onClick={() => onSetView('files')} active={currentView === 'files'} />
                    <NavItem icon={<ProjectsIcon className="w-5 h-5"/>} label="Projects" onClick={() => onSetView('projects')} active={currentView === 'projects'} />

                    <div className="pt-4">
                        <h3 className="px-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2 flex items-center gap-2">
                            <HistoryIcon className="w-4 h-4" />
                            History
                        </h3>
                    </div>
                </nav>
            </div>

            {/* Scrollable Chat History Section */}
            <div className="flex-1 overflow-y-auto sidebar-scroll">
                <div className="px-3 pb-3">
                    <div className="space-y-1">
                        {filteredConversations.sort((a,b) => b.createdAt - a.createdAt).map(conv => (
                            <HistoryItem
                                key={conv.id}
                                conversation={conv}
                                isActive={currentView === 'chat' ? conv.id === activeConversationId : conv.id === activeBlogAIConversationId}
                                onSelect={currentView === 'blogAI' ? onSelectBlogAIConversation || (() => {}) : onSelectConversation}
                                onRename={currentView === 'blogAI' ? onRenameBlogAIConversation || (() => {}) : onRenameConversation}
                                onDelete={currentView === 'blogAI' ? onDeleteBlogAIConversation || (() => {}) : onDeleteConversation}
                                openMenuId={openMenuId}
                                setOpenMenuId={setOpenMenuId}
                                editingMenuId={editingMenuId}
                                setEditingMenuId={setEditingMenuId}
                            />
                        ))}
                    </div>
                </div>
            </div>

            <div className="border-t border-dark-border mt-auto">
                <UserProfile onToggleSidebar={onToggle} onOpenSettings={onOpenSettings} />
            </div>
        </aside>
    );
};
