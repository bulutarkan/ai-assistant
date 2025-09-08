
import React, { useRef, useEffect } from 'react';
import { Conversation, User } from '../../types';
import { ChatMessage } from './ChatMessage';

interface ChatViewProps {
    conversation: Conversation;
    user: User | null;
    isLoading: boolean;
    onRetryMessage?: (text: string, file?: File) => void;
    aiName?: string;
}

const TypingIndicator = () => (
    <div className="flex items-center justify-center p-2">
        <div className="flex items-center space-x-1">
            <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2 h-2 bg-text-tertiary rounded-full animate-bounce"></span>
        </div>
    </div>
);

export const ChatView: React.FC<ChatViewProps> = ({ conversation, user, isLoading, onRetryMessage, aiName }) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [conversation.messages, isLoading]);

    return (
        <div className="w-full max-w-full max-w-[360px]:max-w-[320px] xs:max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-6xl mx-auto flex-1 overflow-y-auto chat-scroll">
            <div className="px-1 max-w-[360px]:px-2 sm:px-3 md:px-4">
                {conversation.messages.map((msg, index) => (
                    <ChatMessage
                        key={msg.id}
                        message={msg}
                        user={user}
                        onRetryMessage={onRetryMessage}
                        aiName={aiName}
                    />
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <TypingIndicator />
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
};
