import React, { useState, useEffect } from 'react';
import { User, MessageSender } from '../../types';
import { generateBlogResponseStream } from '../../services/blogAIService';
import { generateBlogTitle } from '../../services/blogAIService';
import { Message } from '../../types';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import {
  MessageSquare,
  Activity,
  TrendingUp,
  BarChart3,
  Globe,
  Target,
  FileText,
  Zap
} from 'lucide-react';
import AdvancedSEOView from './AdvancedSEOView';

interface BlogAIViewProps {
  user?: User;
  wordpressUrl?: string;
}

export const BlogAIView: React.FC<BlogAIViewProps> = ({ user, wordpressUrl }) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'seo-sensor'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId] = useState(() => `blogai-${Date.now()}`);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: MessageSender.USER,
      text: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiMessage: Message = {
        id: `msg-${Date.now() + 1}`,
        sender: MessageSender.AI,
        text: '',
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, aiMessage]);

      let fullResponse = '';
      for await (const chunk of generateBlogResponseStream({
        prompt: userMessage.text,
        user: user,
        conversationHistory: messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          content: msg.text,
        })),
        wordpressUrl: wordpressUrl,
      })) {
        fullResponse += chunk;
        setMessages(prev => prev.map(msg =>
          msg.id === aiMessage.id
            ? { ...msg, text: fullResponse }
            : msg
        ));
      }
    } catch (error) {
      console.error('Error generating blog AI response:', error);
      const errorMessage: Message = {
        id: `msg-${Date.now() + 2}`,
        sender: MessageSender.AI,
        text: 'Sorry, I encountered an error while processing your blog analysis request. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderChatInterface = () => (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-dark-card rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-text-primary mb-2">Welcome to Blog AI</h3>
            <p className="text-text-secondary max-w-md mx-auto mb-6">
              Ask me about your blog content, keyword analysis, SEO opportunities, or content strategy insights.
            </p>

            {/* Feature Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto mb-6">
              <div className="bg-dark-card p-4 rounded-lg border border-dark-border hover:border-primary/50 transition-colors">
                <Globe className="w-6 h-6 text-blue-400 mb-2" />
                <h4 className="font-medium text-text-primary mb-1">Content Analysis</h4>
                <p className="text-sm text-text-secondary">Get insights on your blog performance</p>
              </div>
              <div className="bg-dark-card p-4 rounded-lg border border-dark-border hover:border-primary/50 transition-colors">
                <Target className="w-6 h-6 text-green-400 mb-2" />
                <h4 className="font-medium text-text-primary mb-1">Keyword Research</h4>
                <p className="text-sm text-text-secondary">Find trending topics and keywords</p>
              </div>
              <div className="bg-dark-card p-4 rounded-lg border border-dark-border hover:border-primary/50 transition-colors">
                <BarChart3 className="w-6 h-6 text-purple-400 mb-2" />
                <h4 className="font-medium text-text-primary mb-1">SEO Optimization</h4>
                <p className="text-sm text-text-secondary">Improve your search rankings</p>
              </div>
              <div className="bg-dark-card p-4 rounded-lg border border-dark-border hover:border-primary/50 transition-colors">
                <TrendingUp className="w-6 h-6 text-orange-400 mb-2" />
                <h4 className="font-medium text-text-primary mb-1">Content Strategy</h4>
                <p className="text-sm text-text-secondary">Plan your publishing calendar</p>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6">
              <h4 className="font-medium text-primary mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" />
                Try Advanced SEO Sensor
              </h4>
              <p className="text-sm text-text-secondary mb-3">
                Get professional-grade SEO analysis with Core Web Vitals, mobile optimization, and rich snippets detection.
              </p>
              <Button
                onClick={() => setActiveTab('seo-sensor')}
                className="w-full bg-primary hover:bg-primary-focus"
              >
                <Activity className="w-4 h-4 mr-2" />
                Switch to Advanced SEO Sensor
              </Button>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-3xl ${message.sender === 'user' ? 'order-2' : 'order-1'}`}>
                <div className={`p-4 rounded-lg ${
                  message.sender === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-dark-card text-text-primary'
                }`}>
                  <div className="whitespace-pre-wrap">{message.text}</div>
                </div>
                <div className={`text-xs text-text-tertiary mt-1 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-3xl">
              <div className="p-4 rounded-lg bg-dark-card text-text-primary">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  <span>Analyzing your blog data...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-6 border-t border-dark-border">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about your blog content, keywords, or content strategy..."
            className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-3 text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="bg-primary hover:bg-primary-focus disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Sending...</span>
              </>
            ) : (
              <>
                <FileText className="w-4 h-4" />
                <span>Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex-shrink-0 p-6 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">Blog AI Assistant</h1>
              <p className="text-text-secondary">Analyze your blog content and get insights</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex bg-dark-bg rounded-lg p-1 border border-dark-border">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'chat'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-dark-card'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('seo-sensor')}
              className={`px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'seo-sensor'
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-text-primary hover:bg-dark-card'
              }`}
            >
              <Activity className="w-4 h-4" />
              Advanced SEO
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && renderChatInterface()}
        {activeTab === 'seo-sensor' && <AdvancedSEOView user={user} wordpressUrl={wordpressUrl} />}
      </div>
    </div>
  );
};
