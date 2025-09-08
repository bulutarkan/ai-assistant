
import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpIcon, PaperclipIcon, MicIcon, XIcon } from '../ui/Icons';

// Fix: Add type definitions for the Web Speech API to resolve TypeScript errors.
// These types are not always included in default TypeScript configurations.
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onstart: () => void;
  onend: () => void;
}

interface ChatInputProps {
  onSendMessage: (text: string, file?: File) => void;
  isLoading: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [text, setText] = useState('');
  const [attachment, setAttachment] = useState<{ file: File, preview: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [linkPreviews, setLinkPreviews] = useState<any[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // File size limits (in bytes)
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB for images

  useEffect(() => {
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // Corresponds to max-h-50
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [text]);

  // Link Detection
  const detectLinks = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches || [];
  };

  const handleTextChange = (value: string) => {
    setText(value);

    // Detect URLs and create previews
    const urls = detectLinks(value);
    if (urls.length > 0) {
      urls.forEach(url => {
        if (!linkPreviews.some(preview => preview.url === url)) {
          fetchLinkPreview(url);
        }
      });
    }
  };



  const handleSendMessage = () => {
    if ((!text.trim() && !attachment) || isLoading) return;
    onSendMessage(text, attachment?.file);
    setText('');
    setAttachment(null);
    setLinkPreviews([]); // Clear link previews
    setFileError(null); // Clear any file errors
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Advanced focus management for all browsers
    const forceFocus = () => {
      if (textareaRef.current) {
        // Ensure element is visible and focusable
        textareaRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
        textareaRef.current.focus({ preventScroll: true });

        // Additional checks for different browsers
        setTimeout(() => {
          if (document.activeElement !== textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
          }
        }, 10);
      }
    };

    // Multiple focus attempts for reliability
    requestAnimationFrame(() => {
      forceFocus();
      setTimeout(forceFocus, 25);
      setTimeout(forceFocus, 50);
      setTimeout(forceFocus, 100);
    });
  };

  const fetchLinkPreview = async (url: string) => {
    try {
      const hostname = new URL(url).hostname;

      // For favicon
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;

      // For title - using hostname as fallback for now (CORS limitation)
      const title = hostname.replace('www.', '');

      const preview = {
        url,
        favicon: faviconUrl,
        title,
        domain: hostname
      };

      setLinkPreviews(prev => [...prev.filter(p => p.url !== url), preview]);
    } catch (error) {
      console.error('Error creating link preview:', error);
      // Fallback
      try {
        const hostname = new URL(url).hostname;
        const fallbackPreview = {
          url,
          favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
          title: hostname,
          domain: hostname
        };
        setLinkPreviews(prev => [...prev.filter(p => p.url !== url), fallbackPreview]);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelection(event.target.files?.[0]);
  };

  const getFileAcceptString = (file: File) => {
    // Supported file types with their MIME types
    const supportedTypes = {
      // Images
      'image/jpeg': '.jpg,.jpeg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',

      // Documents
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/vnd.ms-powerpoint': '.ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',

      // Text files
      'text/plain': '.txt',
      'text/csv': '.csv',
      'application/json': '.json',

      // Archives
      'application/zip': '.zip',
      'application/x-rar-compressed': '.rar'
    };

    return supportedTypes[file.type as keyof typeof supportedTypes] || '';
  };

  const isFileSupported = (file: File) => {
    const supportedMimes = [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',

      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',

      // Text
      'text/plain', 'text/csv', 'application/json',

      // Archives
      'application/zip', 'application/x-rar-compressed'
    ];

    return supportedMimes.includes(file.type);
  };

  const validateFile = (file: File): string | null => {
    // Check file size
    const maxSize = file.type.startsWith('image/') ? MAX_IMAGE_SIZE : MAX_FILE_SIZE;

    if (file.size > maxSize) {
      const sizeMB = (maxSize / (1024 * 1024)).toFixed(0);
      return `File size must be less than ${sizeMB}MB for ${file.type.startsWith('image/') ? 'images' : 'files'}.`;
    }

    // Check if file type is supported
    if (!isFileSupported(file)) {
      return 'File type not supported. Supported types: images, PDFs, documents, text files, and archives.';
    }

    return null; // File is valid
  };

  const handleFileSelection = (file: File | undefined) => {
    console.log('📁 File selection triggered:', file?.name, file?.type, file?.size);

    setFileError(null); // Clear previous errors

    if (!file) {
      console.log('❌ No file selected');
      setIsDragOver(false);
      return;
    }

    console.log('🔍 Validating file:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / (1024 * 1024)).toFixed(2) + 'MB'
    });

    // Validate file
    const validationError = validateFile(file);
    if (validationError) {
      console.error('❌ File validation failed:', validationError);
      setFileError(validationError);
      setIsDragOver(false);
      return;
    }

    console.log('✅ File validation passed, processing file...');

    try {
      // For image files, create preview
      if (file.type.startsWith('image/')) {
        console.log('🖼️ Processing image file...');
        const reader = new FileReader();
        reader.onloadend = () => {
          console.log('📖 Image file read complete, result length:', reader.result?.toString().length);
          if (reader.result) {
            setAttachment({ file, preview: reader.result as string });
            console.log('✅ Image attachment set successfully');
          } else {
            console.error('❌ Image reader returned null result');
            setFileError('Failed to read image file.');
          }
          setIsDragOver(false);
        };
        reader.onerror = () => {
          console.error('❌ Image reader error:', reader.error);
          setFileError('Error reading file. Please try again.');
          setIsDragOver(false);
        };
        reader.readAsDataURL(file);
      } else {
        // For non-image files, create file attachment without preview
        console.log('📄 Processing non-image file...');
        setAttachment({ file, preview: '' });
        console.log('✅ Non-image attachment set successfully');
        setIsDragOver(false);
      }
    } catch (error) {
      console.error('💥 File processing exception:', error);
      setFileError('Error processing file. Please try again.');
      setIsDragOver(false);
    }
  };

  // Drag and Drop Handler Functions
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set drag over to false if we're actually leaving the drop zone
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelection(files[0]);
    }
  };
  
  const handleMicClick = () => {
    // Fix: Cast window to `any` to access browser-specific SpeechRecognition APIs.
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
        // Safari-specific message
        const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        const message = isSafari
            ? "Safari'de ses tanıma özelliği sınırlıdır. Lütfen mesajınızı yazarak gönderin."
            : "Sorry, your browser doesn't support speech recognition.";
        alert(message);
        return;
    }

    if (isRecording) {
        recognitionRef.current?.stop();
        return;
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = true;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
        setIsRecording(true);
    };

    recognitionRef.current.onend = () => {
        setIsRecording(false);
    };

    recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
    };

    recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            }
        }
        if (finalTranscript) {
            setText(prevText => (prevText.trim() ? prevText + ' ' : '') + finalTranscript.trim());
        }
    };
    
    recognitionRef.current.start();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);


  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      {fileError && (
        <div className="mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <p className="text-red-400 text-sm">{fileError}</p>
          <button
            onClick={() => setFileError(null)}
            className="mt-1 text-red-400 hover:text-red-300 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <div
        className={`relative bg-dark-card rounded-2xl shadow-input border transition-all duration-300 ${
          isDragOver
            ? 'border-primary border-2 bg-primary/5 shadow-lg'
            : fileError
            ? 'border-red-500/50'
            : 'border-dark-border'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {attachment && (
            <div className="p-2 pl-4 border-b border-dark-border">
                <div className="flex items-center gap-2 bg-dark-sidebar p-1 rounded-md max-w-xs">
                    {attachment.preview ? (
                        <img src={attachment.preview} alt="preview" className="w-10 h-10 rounded-md object-cover" />
                    ) : (
                        <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-md flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold">📄</span>
                        </div>
                    )}
                    <p className="text-sm text-text-secondary truncate flex-1">{attachment.file.name}</p>
                    <button onClick={() => setAttachment(null)} className="p-1 text-text-tertiary hover:text-text-primary">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {linkPreviews.length > 0 && (
            <div className="p-2 pl-4 border-b border-dark-border">
                <div className="flex items-center gap-2 bg-dark-sidebar p-1 rounded-md max-w-xs">
                    <img src={linkPreviews[0]?.favicon} alt="favicon" className="w-8 h-8 rounded" />
                    <div className="flex-1">
                        <p className="text-sm font-medium text-text-primary">{linkPreviews[0]?.title}</p>
                        <p className="text-xs text-primary truncate">{linkPreviews[0]?.domain}</p>
                    </div>
                    <button onClick={() => setLinkPreviews([])} className="p-1 text-text-tertiary hover:text-text-primary">
                        <XIcon className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}
        <div className="flex items-end p-2 pl-4">
          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-text-secondary hover:text-text-primary transition-colors" disabled={isLoading} aria-label="Attach file">
            <PaperclipIcon className="w-5 h-5" />
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden"
                 accept=".jpg,.jpeg,.png,.gif,.webp,.svg,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.zip,.rar"/>
          
          <button onClick={handleMicClick} className={`p-2 transition-colors ${isRecording ? 'text-red-500 animate-pulse' : 'text-text-secondary hover:text-text-primary'}`} disabled={isLoading} aria-label={isRecording ? 'Stop recording' : 'Start recording'}>
              <MicIcon className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={
              isRecording
                ? "Recording... speak now"
                : isProcessingFile
                ? "Processing file..."
                : "Ask anything..."
            }
            className="flex-1 max-h-48 pl-2 pr-2 py-2.5 resize-none bg-transparent focus:outline-none text-text-primary placeholder:text-text-tertiary text-base"
            rows={1}
            disabled={isLoading || isRecording}
          />
          <div className="flex items-center self-end">
          <button
            onClick={handleSendMessage}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-primary text-dark-bg hover:bg-primary-focus disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
            disabled={(!text.trim() && !attachment) || isLoading || isProcessingFile}
            aria-label="Send message"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
          </div>
        </div>
      </div>
    </div>
  );
};
