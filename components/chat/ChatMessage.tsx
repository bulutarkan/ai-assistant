
import React, { useState, useEffect, memo, useMemo, useCallback } from 'react';
import { Message, MessageSender, User } from '../../types';
import { CopyIcon, ThumbsDownIcon, ThumbsUpIcon, RefreshIcon } from '../ui/Icons';
import { getFileUrl } from '../../services/supabaseClient';

// Mutlak URL ile CK logo
const ckLogo = "https://ckhealthturkey.com/wp-content/uploads/ai-assistant/assets/unnamed.webp";

interface ChatMessageProps {
  message: Message;
  user: User | null;
  onRetryMessage?: (text: string, file?: File) => void;
  aiName?: string;
}

const UserAvatar = ({ user }: { user: User | null }) => {
    if (user?.avatar) {
        return <img src={user.avatar} alt={user.name} className="w-8 h-8 rounded-full" />
    }
    const initials = `${user?.name[0] || ''}${user?.surname[0] || ''}`.toUpperCase();
    return (
        <div className="w-8 h-8 rounded-full bg-dark-sidebar flex items-center justify-center text-text-primary font-bold text-sm">
            {initials}
        </div>
    )
}

const AiAvatar = () => (
    <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
        <img src={ckLogo} alt="CK AI" className="w-full h-full object-cover" />
    </div>
)

const CodeBlock = ({ code }: { code: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative group">
            <pre className="bg-gray-800 dark:bg-black/50 text-white font-mono text-sm p-3 my-2 rounded-md overflow-x-auto">
                <code>{code}</code>
            </pre>
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 rounded-md text-gray-300 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity"
            >
                {copied ? (
                    <span className="text-xs">Copied!</span>
                ) : (
                    <CopyIcon className="w-4 h-4" />
                )}
            </button>
        </div>
    );
};

const SimpleMarkdown = memo<{ text: string }>(({ text }) => {
    // Fallback for empty text
    if (!text || text.trim() === '') {
        return <span>Empty message</span>;
    }

    // Memoize the expensive text processing
    const processedContent = useMemo(() => {
        // Split by multiple elements that need special handling
        const parts = text.split(/(```[\s\S]*?```|\n\s*\n)/g);

        const renderTextWithMarkdown = (content: string) => {
            // Comprehensive inline markdown replacements
            let html = content
                .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>') // Bold + Italic (must come first)
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
                .replace(/\*(.*?)\*/g, '<em>$1</em>')           // Italic
                .replace(/`(.*?)`/g, '<code class="inline-code">$1</code>') // Inline code
                .replace(/~~(.*?)~~/g, '<del>$1</del>')         // Strikethrough
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>'); // Links

            return { __html: html };
        };

        const parseBlock = (block: string, index: number) => {
            if (block.trim() === '') return null;

            // Code blocks
            if (block.startsWith('```')) {
                const code = block.replace(/^```(?:\w+)?\n|```$/g, '').trim();
                return <CodeBlock key={`code-${index}`} code={code} />;
            }

            // Blockquotes
            if (block.trim().startsWith('> ')) {
                const quoteContent = block.split('\n').map(line =>
                    line.startsWith('> ') ? line.substring(2) : line
                ).join('\n');
                return (
                    <blockquote key={`quote-${index}`} className="border-l-4 border-primary pl-4 my-4 italic text-text-secondary">
                        <div dangerouslySetInnerHTML={renderTextWithMarkdown(quoteContent)} />
                    </blockquote>
                );
            }

            // Horizontal rules
            if (block.trim().match(/^[-*_]{3,}$/)) {
                return <hr key={`hr-${index}`} className="my-4 border-t border-dark-border" />;
            }

            // Tables
            if (block.includes('|') && block.includes('\n')) {
                const lines = block.trim().split('\n');
                if (lines.length >= 2) {
                    const headerLine = lines[0];
                    const separatorLine = lines[1];

                    // Check if it's a valid table
                    if (headerLine.includes('|') && separatorLine.match(/^\s*\|[\s\-\|:]+\|\s*$/)) {
                        const headers = headerLine.split('|').map(h => h.trim()).filter(h => h);
                        const rows = lines.slice(2).map(line =>
                            line.split('|').map(cell => cell.trim()).filter(cell => cell !== '')
                        ).filter(row => row.length > 0);

                        return (
                            <table key={`table-${index}`} className="border-collapse border border-dark-border my-4 w-full">
                                <thead>
                                    <tr className="bg-dark-card">
                                        {headers.map((header, i) => (
                                            <th key={i} className="border border-dark-border px-3 py-2 text-left font-semibold">
                                                <span dangerouslySetInnerHTML={renderTextWithMarkdown(header)} />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, rowIndex) => (
                                        <tr key={rowIndex} className="even:bg-dark-card/50">
                                            {row.map((cell, cellIndex) => (
                                                <td key={cellIndex} className="border border-dark-border px-3 py-2">
                                                    <span dangerouslySetInnerHTML={renderTextWithMarkdown(cell)} />
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        );
                    }
                }
            }

            const lines = block.split('\n');

            // Headings (H1-H6 and special formats like "#### a.", "#### b." etc.)
            const headingMatch = lines[0]?.match(/^#{1,6}\s/);
            if (headingMatch) {
                const level = headingMatch[0].length - 1; // Count the # characters
                const headingText = lines[0].substring(level + 1); // Skip the # and space

                // Handle special formats like "#### a.", "#### b.", "#### 1." etc.
                const specialHeadingMatch = headingText.match(/^\s*[a-zA-Z0-9]+\.\s+(.*)$/);
                const displayText = specialHeadingMatch ? specialHeadingMatch[1] : headingText;

                const headingProps = {
                    key: `h${level}-${index}`,
                    className: `my-2 font-semibold ${
                        level === 1 ? 'text-2xl font-bold' :
                        level === 2 ? 'text-xl' :
                        level === 3 ? 'text-lg' :
                        level === 4 ? 'text-base' :
                        level === 5 ? 'text-sm' :
                        'text-xs'
                    }`,
                    dangerouslySetInnerHTML: renderTextWithMarkdown(displayText)
                };

                switch (level) {
                    case 1: return <h1 {...headingProps} />;
                    case 2: return <h2 {...headingProps} />;
                    case 3: return <h3 {...headingProps} />;
                    case 4: return <h4 {...headingProps} />;
                    case 5: return <h5 {...headingProps} />;
                    case 6: return <h6 {...headingProps} />;
                    default: return <p {...headingProps} />;
                }
            }

            // Ordered Lists
            const isOrderedList = lines.filter(l => l.trim() !== '').every(l => /^\d+\.\s/.test(l.trim()));
            if (isOrderedList) {
                return (
                    <ol key={`ol-${index}`} className="list-decimal pl-5 my-2 space-y-1">
                        {lines.filter(l => l.trim() !== '').map((item, itemIndex) => (
                            <li key={itemIndex} dangerouslySetInnerHTML={renderTextWithMarkdown(item.replace(/^\d+\.\s/, ''))} />
                        ))}
                    </ol>
                );
            }

            // Unordered Lists
            const isUnorderedList = lines.filter(l => l.trim() !== '').every(l => l.trim().startsWith('* ') || l.trim().startsWith('- '));
            if (isUnorderedList) {
                return (
                    <ul key={`ul-${index}`} className="list-disc pl-5 my-2 space-y-1">
                        {lines.filter(l => l.trim() !== '').map((item, itemIndex) => (
                            <li key={itemIndex} dangerouslySetInnerHTML={renderTextWithMarkdown(item.substring(item.indexOf(' ') + 1))} />
                        ))}
                    </ul>
                );
            }

            // Regular paragraphs
            const paragraphContent = lines.join('<br />');
            return <p key={`p-${index}`} className="my-2 leading-relaxed" dangerouslySetInnerHTML={renderTextWithMarkdown(paragraphContent)} />;
        };

        return (
            <>
                {parts.map((part, index) => {
                    if (part.trim() === '') return null;
                    return parseBlock(part, index);
                })}
            </>
        );
    }, [text]);

    return processedContent;
});


const FileAttachment = ({ file }: { file: NonNullable<Message['file']> }) => {
    const handleFileClick = (e: React.MouseEvent) => {
        e.preventDefault();
        if (file.path) {
            const fileUrl = getFileUrl(file.path);
            window.open(fileUrl, '_blank');
        }
    };

    return (
        <div
            onClick={handleFileClick}
            className="flex items-center gap-2 p-2 mb-2 bg-gray-100 dark:bg-gray-800 rounded-md text-sm cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
            <div className="flex-shrink-0 w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded flex items-center justify-center">
                <span className="text-xs font-bold">📄</span>
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                    {file.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
            </div>
        </div>
    );
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message, user, onRetryMessage, aiName }) => {
  const isUser = message.sender === MessageSender.USER;
  const [isCopied, setIsCopied] = useState(false);
  const [isRendered, setIsRendered] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsRendered(true), 100);
    return () => clearTimeout(timer);
  }, []);



  const handleCopy = () => {
      if (isCopied) return;
      navigator.clipboard.writeText(message.text)
        .then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        })
        .catch(err => console.error('Failed to copy text: ', err));
  };

  const handleRetry = useCallback(() => {
      if (isRetrying || !onRetryMessage || !isUser) return;

      setIsRetrying(true);
      try {
          // For the retry, we need to create the File object from message.file if it exists
          // However, since we didn't store the actual File object, we'll retry without the file
          // This is a limitation - we can only retry text messages with attached files if we rebuild the File object
          const file = message.file ? new File([''], message.file.name, {
              type: message.file.type,
              lastModified: Date.now()
          }) : undefined;

          onRetryMessage(message.text, file);
      } catch (error) {
          console.error('Error retrying message:', error);
      } finally {
          // Reset retrying state after a short delay to show feedback
          setTimeout(() => {
              setIsRetrying(false);
          }, 1000);
      }
  }, [isRetrying, onRetryMessage, isUser, message]);

  return (
    <div className={`flex items-start gap-3 my-4 transition-all duration-500 ease-in-out ${isUser ? 'justify-end' : 'justify-start'} ${isRendered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      {!isUser && <AiAvatar />}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        <div className="font-bold text-sm mb-1 text-gray-600 dark:text-gray-400">
            {isUser ? `${user?.name} ${user?.surname}` : (aiName || 'Ceku')}
        </div>
        <div className={`p-3 rounded-xl shadow-sm w-full ${isUser ? 'bg-dark-sidebar text-text-primary rounded-br-none' : 'bg-gray-200 dark:bg-dark-card text-gray-900 dark:text-text-primary rounded-bl-none'}`}>
          {message.image && message.image.trim() !== '' && !message.file && <img src={message.image} alt="attachment" className="rounded-lg mb-2 max-w-xs" />}
          {message.file && <FileAttachment file={message.file} />}
          <div className="prose prose-sm dark:prose-invert max-w-none break-words overflow-wrap-anywhere">
            {message.text ? (
              <SimpleMarkdown text={message.text} />
            ) : (
              <span className={`animate-pulse ${isUser ? 'text-gray-500' : 'thinking-wave bg-gradient-to-r from-blue-500 via-purple-500 via-cyan-500 to-green-500 bg-clip-text text-transparent font-medium'}`}>
                {isUser ? '...' : 'Thinking...'}
              </span>
            )}
          </div>

          <style dangerouslySetInnerHTML={{
            __html: `
              .inline-code {
                background: rgb(229 231 235);
                padding: 2px 4px;
                border-radius: 3px;
                font-size: 0.875rem;
                font-family: ui-monospace, SFMono-Regular, "SF Mono", Monaco, Inconsolata, "Roboto Mono", "Noto Sans Mono", "Droid Sans Mono", "Source Code Pro", monospace;
              }
              .dark .inline-code {
                background: rgb(55 65 81);
              }
              .markdown-link {
                color: rgb(59 130 246);
                text-decoration: none;
              }
              .markdown-link:hover {
                text-decoration: underline;
              }
            `
          }} />
        </div>
        {isUser && message.text && onRetryMessage && (
            <div className="mt-2 flex items-center gap-2 text-gray-400">
                <button
                    onClick={handleRetry}
                    className={`p-1 transition-colors ${isRetrying ? 'text-primary animate-spin' : 'hover:text-primary'}`}
                    aria-label={isRetrying ? "Retrying..." : "Retry message"}
                    title={isRetrying ? "Retrying..." : "Retry message"}
                    disabled={isRetrying}
                >
                    <RefreshIcon className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                </button>
            </div>
        )}
        {!isUser && message.text && (
            <div className="mt-2 flex items-center gap-2 text-gray-400">
                <button
                    onClick={handleCopy}
                    className={`p-1 transition-colors ${isCopied ? 'text-green-500' : 'hover:text-primary'}`}
                    aria-label={isCopied ? "Copied!" : "Copy message"}
                    title={isCopied ? "Copied!" : "Copy message"}
                    disabled={isCopied}
                >
                    <CopyIcon className="w-4 h-4" />
                </button>
                <button className="p-1 hover:text-primary transition-colors" title="Good response"><ThumbsUpIcon className="w-4 h-4" /></button>
                <button className="p-1 hover:text-red-500 transition-colors" title="Bad response"><ThumbsDownIcon className="w-4 h-4" /></button>
            </div>
        )}
      </div>

      {isUser && <UserAvatar user={user} />}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ChatMessage = memo(ChatMessageComponent);
