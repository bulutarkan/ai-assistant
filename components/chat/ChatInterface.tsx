import React, { useState, useEffect } from 'react';
import { ChatInput } from './ChatInput';
import { Sidebar } from './Sidebar';
import { GrokLogo, ClipboardListIcon } from '../ui/Icons';
import { Header } from './Header';
import { useChat } from '../../hooks/useChat';
import { useBlogAIChat } from '../../hooks/useBlogAIChat';
import { SettingsModal } from '../settings/SettingsModal';
import { ChatView } from './ChatView';
import { useAuth } from '../../hooks/useAuth';
import { FilesView } from '../files/FilesView';
import { ProjectsView } from '../projects/ProjectsView';
import { useProjects } from '../../hooks/useProjects';
import DashboardView from '../blogAI/DashboardView';
import BlogScheduleView from '../blogAI/BlogScheduleView';
import ContentAnalyzerView from '../blogAI/ContentAnalyzerView';
import SearchConsoleView from '../blogAI/SearchConsoleView';
import KeywordAnalyzerView from '../blogAI/KeywordAnalyzerView';
import AdvancedSEOView from '../blogAI/AdvancedSEOView';
import SerpApiView from '../blogAI/SerpApiView';

// Mutlak URL ile CK logo
const ckLogo = "https://ckhealthturkey.com/wp-content/uploads/ai-assistant/assets/unnamed.webp";

type ViewType = 'chat' | 'blogAI' | 'blogDashboard' | 'blogSchedule' | 'contentAnalyzer' | 'advancedSEO' | 'keywordAnalyzer' | 'searchConsole' | 'serpApi' | 'files' | 'projects';

const EmptyState = ({ onSetView, currentView }: { onSetView: (view: ViewType) => void, currentView: ViewType }) => {
    const { tasks } = useProjects();
    const pendingTasksCount = tasks.filter(task => !task.completed).length;

    return (
        <div className="flex flex-col items-center justify-center text-center w-full flex-grow p-4">
            <img
                src={ckLogo}
                alt="CK AI Assistant Logo"
                className="w-24 h-24 object-contain mb-4 rounded-lg shadow-lg"
            />
            <h1 className="text-2xl sm:text-3xl font-bold mt-4 text-white">
                {currentView === 'blogAI' ? 'Blog AI Assistant - Logar' : 'CK AI Assistant - Ceku'}
            </h1>
            <p className="text-text-secondary mt-2">How can I help you today?</p>
            
            {pendingTasksCount > 0 && (
                <button
                    onClick={() => onSetView('projects')}
                    className="mt-8 bg-dark-card border border-dark-border rounded-lg p-2 max-w-[360px]:p-3 sm:p-4 max-w-full max-w-[360px]:max-w-[300px] sm:max-w-sm w-full text-left hover:border-primary/50 hover-lift btn-press"
                    aria-label={`View your ${pendingTasksCount} pending tasks`}
                >
                    <div className="flex items-center gap-4">
                        <div className="bg-dark-sidebar p-3 rounded-full">
                            <ClipboardListIcon className="w-6 h-6 text-primary"/>
                        </div>
                        <div>
                            <p className="font-semibold text-text-primary">You have {pendingTasksCount} pending task{pendingTasksCount > 1 ? 's' : ''}</p>
                            <p className="text-sm text-text-secondary">Click here to view your projects.</p>
                        </div>
                    </div>
                </button>
            )}
        </div>
    );
};


export const ChatInterface: React.FC = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<ViewType>('chat');
  const { user } = useAuth();
  const {
      conversations,
      activeConversation,
      sendMessage,
      startNewChat,
      selectConversation,
      deleteConversation,
      renameConversation,
      isLoading,
  } = useChat();

  const {
      conversations: blogAIConversations,
      activeConversation: blogAIActiveConversation,
      sendMessage: sendBlogAIMessage,
      startNewChat: startBlogAINewChat,
      selectConversation: selectBlogAIConversation,
      deleteConversation: deleteBlogAIConversation,
      renameConversation: renameBlogAIConversation,
      isLoading: blogAIIsLoading,
  } = useBlogAIChat();

  const handleSendMessage = (text: string, file?: File) => {
    if (!text.trim() && !file) return;
    sendMessage(text, file);
  };

  const handleBlogAISendMessage = (text: string, file?: File) => {
    if (!text.trim() && !file) return;
    sendBlogAIMessage(text, file, "https://ckhealthturkey.com");
  };

  const handleSelectConversation = (id: string) => {
    selectConversation(id);
    setView('chat');
  }

  const handleBlogAISelectConversation = (id: string) => {
    selectBlogAIConversation(id);
    setView('blogAI');
  }

  const handleNewChat = () => {
      startNewChat();
      setView('chat');
  }

  const handleBlogAINewChat = () => {
      startBlogAINewChat();
      setView('blogAI');
  }

  const handleNavToChat = () => {
      setView('chat');
  }

  const handleNavToBlogAI = () => {
      setView('blogAI');
  }

  const handleChatAreaClick = () => {
      // Mobil cihazlarda sidebar açıkken chat alanına tıklayınca sidebar'ı kapat
      if (window.innerWidth < 1024 && isSidebarOpen) {
          setSidebarOpen(false);
      }
  }

  // Mobil cihazlarda otomatik sidebar kapat (sadece resize için)
  useEffect(() => {
      const handleResize = () => {
          // Ekran boyutu 1024px'den küçükse ve sidebar açıksa kapat
          if (window.innerWidth < 1024 && isSidebarOpen) {
              setSidebarOpen(false);
          }
      };

      // İlk yüklemede kontrol et
      handleResize();

      // Sadece resize eventi dinle (dependency kaldırıldı)
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderView = () => {
      // Only log in development and only when view changes
      if (process.env.NODE_ENV === 'development' && view !== renderView.lastView) {
          console.log('🔄 ChatInterface view changed:', view);
          renderView.lastView = view;
      }

      switch (view) {
          case 'chat':
              if (activeConversation) {
                  return (
                      <ChatView
                          key={`chat-${activeConversation.id}`}
                          conversation={activeConversation}
                          user={user}
                          isLoading={isLoading}
                          onRetryMessage={handleSendMessage}
                      />
                  );
              } else {
                  return <EmptyState onSetView={setView} currentView={view} />;
              }
          case 'blogAI':
              if (blogAIActiveConversation) {
                  return (
                      <ChatView
                          key={`blogai-${blogAIActiveConversation.id}`}
                          conversation={blogAIActiveConversation}
                          user={user}
                          isLoading={blogAIIsLoading}
                          onRetryMessage={handleBlogAISendMessage}
                          aiName="Logar"
                      />
                  );
              } else {
                  return <EmptyState onSetView={setView} currentView={view} />;
              }
          case 'blogDashboard':
              return <DashboardView />;
          case 'blogSchedule':
              return <BlogScheduleView />;
          case 'contentAnalyzer':
              return <ContentAnalyzerView />;
          case 'advancedSEO':
              return <AdvancedSEOView user={user} wordpressUrl="https://ckhealthturkey.com" />;
          case 'keywordAnalyzer':
              return <KeywordAnalyzerView />;
          case 'searchConsole':
              return <SearchConsoleView />;
          case 'serpApi':
              return <SerpApiView />;
          case 'files':
              return <FilesView />;
          case 'projects':
              return <ProjectsView />;
          default:
              return <EmptyState onSetView={setView} currentView={view} />;
      }
  }

  // Store last view for optimization
  renderView.lastView = view;

  return (
    <div className="h-screen w-full text-text-primary overflow-hidden flex">
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setSidebarOpen(!isSidebarOpen)}
        conversations={view === 'chat' ? conversations : []}
        blogAIConversations={view === 'blogAI' ? blogAIConversations : []}
        activeConversationId={view === 'chat' ? activeConversation?.id : undefined}
        activeBlogAIConversationId={view === 'blogAI' ? blogAIActiveConversation?.id : undefined}
        onSelectConversation={handleSelectConversation}
        onSelectBlogAIConversation={handleBlogAISelectConversation}
        onNewChat={handleNavToChat}
        onNewBlogAIChat={handleNavToBlogAI}
        onRenameConversation={renameConversation}
        onRenameBlogAIConversation={renameBlogAIConversation}
        onDeleteConversation={deleteConversation}
        onDeleteBlogAIConversation={deleteBlogAIConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        currentView={view}
        onSetView={setView}
      />
      <div className={`h-full flex-1 flex flex-col transition-all duration-300 ease-in-out ${isSidebarOpen ? 'sm:ml-72 md:ml-80 lg:ml-96' : 'ml-0'}`}>
        <Header
            onToggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
            isSidebarOpen={isSidebarOpen}
            title={view === 'chat' ? activeConversation?.title : (view === 'blogAI' ? 'New Chat' : view === 'blogDashboard' ? 'Blog Dashboard' : view === 'blogSchedule' ? 'Blog Schedule' : view === 'contentAnalyzer' ? 'Content Analyzer' : view === 'advancedSEO' ? 'Advanced SEO Sensor' : view === 'keywordAnalyzer' ? 'Keyword Analyzer' : view === 'searchConsole' ? 'Search Console' : view.charAt(0).toUpperCase() + view.slice(1))}
            onSetView={setView}
        />
        <main className="flex-1 flex flex-col justify-end overflow-hidden relative" onClick={handleChatAreaClick}>
            <div className="flex-1 flex flex-col items-center justify-center overflow-y-auto p-4 scroll-smooth">
                <div
                    key={view}
                    className="page-enter-active w-full h-full flex flex-col justify-center"
                    style={{
                        animation: 'pageFadeIn 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards'
                    }}
                >
                    {renderView()}
                </div>
            </div>
            {(view === 'chat' || view === 'blogAI') && (
                <div className="pb-6 pt-2 shrink-0">
                    <ChatInput
                        onSendMessage={view === 'chat' ? handleSendMessage : handleBlogAISendMessage}
                        isLoading={view === 'chat' ? isLoading : blogAIIsLoading}
                    />
                </div>
            )}
        </main>
      </div>
      {isSettingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
};
