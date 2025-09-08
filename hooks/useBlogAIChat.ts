import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { BlogAIConversation, Message, MessageSender } from '../types';
import { generateBlogResponseStream, generateBlogTitle } from '../services/blogAIService';
import { useAuth } from './useAuth';
import { supabase, uploadFile } from '../services/supabaseClient';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

interface BlogAIChatContextType {
    conversations: BlogAIConversation[];
    activeConversation: BlogAIConversation | null | undefined;
    isLoading: boolean;
    startNewChat: () => void;
    selectConversation: (id: string) => void;
    deleteConversation: (id: string) => void;
    renameConversation: (id: string, newTitle: string) => void;
    sendMessage: (text: string, file?: File, wordpressUrl?: string) => void;
}

const BlogAIChatContext = createContext<BlogAIChatContextType | undefined>(undefined);

export const BlogAIChatProvider = ({ children }: { children: ReactNode }) => {
    const [conversations, setConversations] = useState<BlogAIConversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Load conversations from Supabase when user logs in
    const loadConversations = useCallback(async () => {
        if (!user) {
            console.log('❌ No user available for loading Blog AI conversations');
            setConversations([]);
            setActiveConversationId(null);
            return;
        }

        console.log('📚 Loading Blog AI conversations from database...');

        try {
            const { data, error } = await supabase
                .from('blog_ai_chats')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error loading Blog AI conversations:', error);
                return;
            }

            console.log('✅ Successfully loaded Blog AI conversations:', data?.length || 0);

            const formattedConversations: BlogAIConversation[] = data.map(chat => ({
                id: chat.id,
                title: chat.title,
                messages: chat.messages || [],
                wordpressUrl: chat.wordpress_url,
                createdAt: new Date(chat.created_at).getTime(),
            }));

            console.log('📝 Formatted Blog AI conversations:', formattedConversations.length);
            setConversations(formattedConversations);
        } catch (error) {
            console.error('💥 Exception loading Blog AI conversations:', error);
        }
    }, [user]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    const activeConversation = conversations.find(c => c.id === activeConversationId);

    const saveConversationToDB = useCallback(async (conversation: BlogAIConversation) => {
        if (!user) {
            console.error('❌ Cannot save Blog AI conversation: No user available');
            return;
        }

        try {
            const fullName = (user.name?.trim() && user.surname?.trim())
                ? `${user.name.trim()} ${user.surname.trim()}`
                : user.name?.trim() || user.surname?.trim() || 'User';

            const chatData = {
                id: conversation.id,
                user_id: user.id,
                title: conversation.title,
                user_full_name: fullName,
                messages: conversation.messages,
                wordpress_url: conversation.wordpressUrl,
            };

            const { error } = await supabase
                .from('blog_ai_chats')
                .upsert(chatData, { onConflict: 'id' });

            if (error) {
                console.error('❌ Error saving Blog AI conversation:', error.message);
            }
        } catch (error) {
            console.error('💥 Exception saving Blog AI conversation:', error.message);
        }
    }, [user]);

    const updateConversation = useCallback((id: string, updateFn: (conv: BlogAIConversation) => BlogAIConversation, saveToDB: boolean = true) => {
        setConversations(prev => {
            const updatedConversations = prev.map(conv => {
                if (conv.id === id) {
                    const updatedConv = updateFn(conv);
                    // Silent DB operations
                    if (saveToDB) {
                        saveConversationToDB(updatedConv);
                    }
                    return updatedConv;
                }
                return conv;
            });
            return updatedConversations;
        });
    }, [saveConversationToDB]);

    const startNewChat = useCallback(() => {
        console.log('🚀 Starting new Blog AI chat');
        setActiveConversationId(null);
    }, []);

    const selectConversation = useCallback(async (id: string) => {
        setActiveConversationId(id);
    }, []);

    const deleteConversation = useCallback(async (id: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('blog_ai_chats')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting Blog AI conversation:', error);
                return;
            }

            setConversations(prev => prev.filter(c => c.id !== id));
            if (activeConversationId === id) {
                setActiveConversationId(null);
            }
        } catch (error) {
            console.error('Error deleting Blog AI conversation:', error);
        }
    }, [activeConversationId, user]);

    const renameConversation = useCallback((id: string, newTitle: string) => {
        updateConversation(id, conv => ({ ...conv, title: newTitle }));
    }, [updateConversation]);

    const sendMessage = useCallback(async (text: string, file?: File, wordpressUrl?: string) => {
        if (!user) {
            console.error('❌ Cannot send Blog AI message: No user available');
            return;
        }

        console.log('🤖 Blog AI - Sending message for user:', {
            userId: user.id,
            userName: user.name,
            messageText: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            hasFile: !!file,
            wordpressUrl: wordpressUrl
        });

        setIsLoading(true);

        let base64Image: string | undefined;
        let filePath: string | undefined;

        if (file) {
            try {
                if (file.type.startsWith('image/')) {
                    console.log('🖼️ Processing image file for Blog AI...');
                    base64Image = await fileToBase64(file);
                    filePath = await uploadFile(file, user.id);
                    console.log('✅ Image uploaded to storage for Blog AI:', filePath);
                } else {
                    console.log('📄 Processing non-image file for Blog AI...');
                    filePath = await uploadFile(file, user.id);
                    console.log('✅ File uploaded to storage for Blog AI:', filePath);
                }
            } catch (error) {
                console.error('❌ File processing/upload failed for Blog AI:', error);
                setIsLoading(false);
                return;
            }
        }

        const userMessage: Message = {
            id: `msg-${Date.now()}`,
            sender: MessageSender.USER,
            text,
            timestamp: Date.now(),
            image: base64Image,
            file: file ? {
                name: file.name,
                type: file.type,
                size: file.size,
                path: filePath
            } : undefined
        };

        console.log('📝 Blog AI user message created:', {
            id: userMessage.id,
            hasImage: !!userMessage.image,
            hasFile: !!userMessage.file
        });

        let conversationId = activeConversationId;
        let needsTitle = false;

        if (!conversationId) {
            conversationId = crypto.randomUUID();
            needsTitle = true;
            const newConversation: BlogAIConversation = {
                id: conversationId,
                title: 'Blog Analysis',
                messages: [userMessage],
                wordpressUrl: wordpressUrl,
                createdAt: Date.now(),
            };
            setConversations(prev => [newConversation, ...prev]);
            setActiveConversationId(conversationId);
            await saveConversationToDB(newConversation);
        } else {
            updateConversation(conversationId, conv => ({
                ...conv,
                messages: [...conv.messages, userMessage],
            }));
        }

        const aiMessageId = `msg-${Date.now()}-ai`;
        const aiMessagePlaceholder: Message = {
            id: aiMessageId,
            sender: MessageSender.AI,
            text: '',
            timestamp: Date.now(),
        };

        updateConversation(conversationId, conv => ({
            ...conv,
            messages: [...conv.messages, aiMessagePlaceholder],
        }));

        try {
            let currentConversation = conversations.find(c => c.id === conversationId);

            let conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [];

            if (currentConversation && currentConversation.messages) {
                const rawMessages = currentConversation.messages;
                conversationHistory = rawMessages
                    .filter(msg => msg.id !== aiMessageId && msg.text && msg.text.trim())
                    .map(msg => ({
                        role: msg.sender === MessageSender.USER ? 'user' as const : 'model' as const,
                        content: msg.text
                    }));
            }

            const stream = generateBlogResponseStream({
                prompt: text,
                conversationHistory,
                image: file ? { base64: userMessage.image!, mimeType: file.type } : undefined,
                user: user,
                wordpressUrl: wordpressUrl,
            });

            let fullResponse = '';
            let hasReceivedChunk = false;

            for await (const chunk of stream) {
                hasReceivedChunk = true;
                fullResponse += chunk;

                updateConversation(conversationId, conv => {
                    const updatedMessages = conv.messages.map(m =>
                        m.id === aiMessageId ? { ...m, text: fullResponse } : m
                    );
                    return {
                        ...conv,
                        messages: updatedMessages
                    };
                }, false);
            }

            if (!hasReceivedChunk) {
                throw new Error('No response received from Blog AI');
            }

            updateConversation(conversationId, conv => {
                const finalMessages = conv.messages.map(m =>
                    m.id === aiMessageId ? { ...m, text: fullResponse } : m
                );
                return {
                    ...conv,
                    messages: finalMessages
                };
            }, true);

            if (needsTitle && fullResponse) {
                const newTitle = await generateBlogTitle(`${text}\n\n${fullResponse}`);
                updateConversation(conversationId, conv => ({ ...conv, title: newTitle }), true);
            }

        } catch (error) {
            console.error("Error sending message to Blog AI:", error);

            let errorMessage = "I'm sorry, I encountered an error while processing your blog analysis request.";

            if (error.message?.includes('timeout')) {
                errorMessage = "Blog analysis response timed out. Please try again.";
            } else if (error.message?.includes('No response received')) {
                errorMessage = "Connection issue with Blog AI. Please check your internet and try again.";
            }

            updateConversation(conversationId, conv => ({
                ...conv,
                messages: conv.messages.map(m => m.id === aiMessageId ? {
                    ...m,
                    text: errorMessage
                } : m),
            }), true);
        } finally {
            setIsLoading(false);
        }

    }, [activeConversationId, updateConversation, user, saveConversationToDB, conversations]);

    const value = {
        conversations,
        activeConversation,
        isLoading,
        startNewChat,
        selectConversation,
        deleteConversation,
        renameConversation,
        sendMessage,
    };

    return React.createElement(BlogAIChatContext.Provider, { value }, children);
};

export const useBlogAIChat = (): BlogAIChatContextType => {
    const context = useContext(BlogAIChatContext);
    if (context === undefined) {
        throw new Error('useBlogAIChat must be used within a BlogAIChatProvider');
    }
    return context;
};
