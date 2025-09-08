
import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { Conversation, Message, MessageSender } from '../types';
import { generateResponseStream, generateTitle } from '../services/geminiService';
import { useAuth } from './useAuth';
import { supabase, uploadFile, getFileUrl } from '../services/supabaseClient';

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
    });
};

interface ChatContextType {
    conversations: Conversation[];
    activeConversation: Conversation | null | undefined;
    isLoading: boolean;
    startNewChat: () => void;
    selectConversation: (id: string) => void;
    deleteConversation: (id: string) => void;
    renameConversation: (id: string, newTitle: string) => void;
    sendMessage: (text: string, file?: File) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Load conversations from Supabase when user logs in
    const loadConversations = useCallback(async () => {
        if (!user) {
            console.log('❌ No user available for loading conversations');
            setConversations([]);
            setActiveConversationId(null);
            return;
        }

        console.log('� Loading conversations from database...');

        try {
            const { data, error } = await supabase
                .from('chats')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Error loading conversations:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                return;
            }

            console.log('✅ Successfully loaded conversations:', data?.length || 0);

            const formattedConversations: Conversation[] = data.map(chat => ({
                id: chat.id,
                title: chat.title,
                messages: chat.messages || [],
                createdAt: new Date(chat.created_at).getTime(),
            }));

            console.log('📝 Formatted conversations:', formattedConversations.length);
            setConversations(formattedConversations);
        } catch (error) {
            console.error('💥 Exception loading conversations:', error);
        }
    }, [user]);

    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Silent state management - no logging
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            // Keep this empty for future debugging if needed
        }
    }, [conversations.length, activeConversationId, isLoading]);

    const activeConversation = conversations.find(c => c.id === activeConversationId);

    const saveConversationToDB = useCallback(async (conversation: Conversation) => {
        if (!user) {
            console.error('❌ Cannot save conversation: No user available');
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
            };

            const { error } = await supabase
                .from('chats')
                .upsert(chatData, { onConflict: 'id' });

            if (error) {
                console.error('❌ Error saving conversation:', error.message);
            }
        } catch (error) {
            console.error('💥 Exception saving conversation:', error.message);
        }
    }, [user]);

    const updateConversation = useCallback((id: string, updateFn: (conv: Conversation) => Conversation, saveToDB: boolean = true) => {
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

    // Function to refresh conversation data from Supabase
    const refreshConversationFromDB = useCallback(async (conversationId: string) => {
        if (!user) return;

        try {
            console.log('🔄 Refreshing conversation from DB:', conversationId);
            const { data, error } = await supabase
                .from('chats')
                .select('*')
                .eq('id', conversationId)
                .single();

            if (error) {
                console.error('❌ Error refreshing conversation:', error);
                return;
            }

            if (data) {
                console.log('✅ Refreshed conversation with', data.messages?.length || 0, 'messages');
                setConversations(prev => prev.map(conv =>
                    conv.id === conversationId ? {
                        id: data.id,
                        title: data.title,
                        messages: data.messages || [],
                        createdAt: new Date(data.created_at).getTime(),
                    } : conv
                ));
            }
        } catch (error) {
            console.error('💥 Exception refreshing conversation:', error);
        }
    }, [user]);

    const startNewChat = useCallback(() => {
        // Clear file input if any when starting new chat
        if (activeConversation && activeConversation.messages.length === 0) {
            // If current conversation is empty, just clear active conversation
            setActiveConversationId(null);
        } else {
            setActiveConversationId(null);
        }
    }, [activeConversation]);

    const selectConversation = useCallback(async (id: string) => {
        setActiveConversationId(id);
        // DB refresh is now handled during sendMessage if needed
    }, []);

    const deleteConversation = useCallback(async (id: string) => {
        if (!user) return;

        try {
            const { error } = await supabase
                .from('chats')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting conversation:', error);
                return;
            }

            setConversations(prev => prev.filter(c => c.id !== id));
            if (activeConversationId === id) {
                setActiveConversationId(null);
            }
        } catch (error) {
            console.error('Error deleting conversation:', error);
        }
    }, [activeConversationId, user]);

    const renameConversation = useCallback((id: string, newTitle: string) => {
        updateConversation(id, conv => ({ ...conv, title: newTitle }));
    }, [updateConversation]);

    const sendMessage = useCallback(async (text: string, file?: File) => {
        if (!user) {
            console.error('❌ Cannot send message: No user available');
            return;
        }

        console.log('💬 Sending message for user:', {
            userId: user.id,
            userName: user.name,
            userSurname: user.surname,
            messageText: text.substring(0, 50) + (text.length > 50 ? '...' : ''),
            hasFile: !!file,
            fileInfo: file ? {
                name: file.name,
                type: file.type,
                size: file.size,
                sizeMB: (file.size / (1024 * 1024)).toFixed(2) + 'MB'
            } : null
        });

        setIsLoading(true);

        let base64Image: string | undefined;
        let filePath: string | undefined;

        if (file) {
            try {
                // For images, we need base64 for Gemini API, but also upload to storage
                if (file.type.startsWith('image/')) {
                    console.log('🖼️ Processing image file...');
                    base64Image = await fileToBase64(file);

                    // Also upload to storage for permanent reference
                    console.log('🗂️ Uploading image to storage...');
                    filePath = await uploadFile(file, user.id);
                    console.log('✅ Image uploaded to storage:', filePath);
                } else {
                    // For non-image files, only upload to storage
                    console.log('📄 Processing non-image file...');
                    filePath = await uploadFile(file, user.id);
                    console.log('✅ File uploaded to storage:', filePath);
                }
            } catch (error) {
                console.error('❌ File processing/upload failed:', error);
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

        console.log('📝 User message created:', {
            id: userMessage.id,
            hasImage: !!userMessage.image,
            hasFile: !!userMessage.file,
            filePath: filePath,
            imageLength: base64Image?.length
        });

        let conversationId = activeConversationId;
        let needsTitle = false;

        // Create new conversation if none is active
        // First, ensure user message is added to conversation
        if (!conversationId) {
            // Generate a proper UUID for the conversation ID
            conversationId = crypto.randomUUID();
            needsTitle = true;
            const newConversation: Conversation = {
                id: conversationId,
                title: 'New Conversation',
                messages: [userMessage],
                createdAt: Date.now(),
            };
            setConversations(prev => [newConversation, ...prev]);
            setActiveConversationId(conversationId);
            await saveConversationToDB(newConversation);
        } else {
            // Add message to existing conversation
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
            // Use cached conversation data to avoid unnecessary DB calls
            let currentConversation = conversations.find(c => c.id === conversationId);

            let conversationHistory: Array<{ role: 'user' | 'model'; content: string }> = [];

            if (currentConversation && currentConversation.messages) {
                // Include all previous messages except the AI placeholder
                const rawMessages = currentConversation.messages;
                conversationHistory = rawMessages
                    .filter(msg => msg.id !== aiMessageId && msg.text && msg.text.trim())
                    .map(msg => ({
                        role: msg.sender === MessageSender.USER ? 'user' as const : 'model' as const,
                        content: msg.text
                    }));
            }

            const stream = generateResponseStream({
                prompt: text,
                conversationHistory,
                image: file ? { base64: userMessage.image!, mimeType: file.type } : undefined,
                user: user,
            });

            let fullResponse = '';
            let hasReceivedChunk = false;
            let retryCount = 0;
            const MAX_RETRIES = 2;

            // Safari has different timeout behaviors, use shorter timeout for better UX
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            const timeoutDuration = isSafari ? 20000 : 30000; // 20s for Safari, 30s for others

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Response timeout')), timeoutDuration)
            );

            const streamPromise = (async () => {
                try {
                    let chunkCount = 0;
                    const startTime = Date.now();

                    for await (const chunk of stream) {
                        hasReceivedChunk = true;
                        fullResponse += chunk;
                        chunkCount++;

                        // Update conversation with current response
                        updateConversation(conversationId, conv => {
                            const updatedMessages = conv.messages.map(m =>
                                m.id === aiMessageId ? { ...m, text: fullResponse } : m
                            );
                            return {
                                ...conv,
                                messages: updatedMessages
                            };
                        }, false); // Don't save to DB during streaming

                        // Reduced logging for production - only every 100 chunks
                        if (chunkCount % 100 === 0 && process.env.NODE_ENV === 'development') {
                            console.log(`📊 Processed ${chunkCount} chunks (${fullResponse.length} chars)`);
                        }
                    }

                    const duration = Date.now() - startTime;
                    if (process.env.NODE_ENV === 'development') {
                        console.log(`✅ Stream completed: ${chunkCount} chunks in ${duration}ms`);
                    }

                } catch (streamError) {
                    console.error('Streaming error:', streamError);
                    console.error('Stream error details:', {
                        message: streamError.message,
                        name: streamError.name,
                        stack: streamError.stack?.substring(0, 200)
                    });
                    throw streamError;
                }
            })();

            await Promise.race([streamPromise, timeoutPromise]);

            // If no chunks were received, it means the stream failed silently
            if (!hasReceivedChunk) {
                console.error('No response chunks received from AI stream');
                throw new Error('No response received from AI');
            }

            // Force final UI update after streaming completes AND save to DB
            updateConversation(conversationId, conv => {
                const finalMessages = conv.messages.map(m =>
                    m.id === aiMessageId ? { ...m, text: fullResponse } : m
                );
                return {
                    ...conv,
                    messages: finalMessages
                };
            }, true); // Force save to DB after streaming completes

            if (needsTitle && fullResponse) {
                const newTitle = await generateTitle(`${text}\n\n${fullResponse}`);
                updateConversation(conversationId, conv => ({ ...conv, title: newTitle }), true);
            }

        } catch (error) {
            console.error("Error sending message to AI:", error);

            // For Safari and other browsers with connection issues, provide more specific error messages
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            let errorMessage = "I'm sorry, I encountered an error while processing your request.";

            if (error.message?.includes('timeout')) {
                errorMessage = isSafari
                    ? "Response timed out. Safari may have connectivity issues. Please try again."
                    : "Response timed out. Please try again.";
            } else if (error.message?.includes('No response received')) {
                errorMessage = isSafari
                    ? "Connection issue with Safari. Please check your internet and try again."
                    : "Connection issue. Please check your internet and try again.";
            } else if (isSafari && error.message?.includes('Failed to fetch')) {
                errorMessage = "Safari network issue detected. Please try refreshing the page and sending your message again.";
            }

            console.log('📋 Error details:', {
                errorMessage: error.message,
                isSafari,
                userAgent: navigator.userAgent.substring(0, 50),
                finalErrorMessage: errorMessage
            });

            updateConversation(conversationId, conv => ({
                ...conv,
                messages: conv.messages.map(m => m.id === aiMessageId ? {
                    ...m,
                    text: errorMessage
                } : m),
            }), true); // Save error messages to DB too
        } finally {
            setIsLoading(false);
        }

    }, [activeConversationId, updateConversation, user, saveConversationToDB]);

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

// FIX: Replaced JSX with React.createElement to avoid syntax errors in a .ts file.
// This resolves "Cannot find namespace 'ChatContext'" and "Operator '<' cannot be applied..." errors.
    return React.createElement(ChatContext.Provider, { value }, children);
};

export const useChat = (): ChatContextType => {
    const context = useContext(ChatContext);
    if (context === undefined) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
};
