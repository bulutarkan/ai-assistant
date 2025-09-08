
import React, { useState, useCallback, useEffect } from 'react';
import { useFiles } from '../../hooks/useFiles';
import { UploadCloudIcon, FilesIcon, ClockIcon, TrashIcon, DownloadIcon } from '../ui/Icons';

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const TimeLeft = ({ expiryTimestamp }: { expiryTimestamp: number }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = expiryTimestamp - Date.now();
            if (difference <= 0) {
                setTimeLeft('Expired');
                return;
            }
            const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            setTimeLeft(`${hours}h ${minutes}m left`);
        };

        calculateTimeLeft();
        const timer = setInterval(calculateTimeLeft, 60000); // Update every minute
        return () => clearInterval(timer);
    }, [expiryTimestamp]);

    return <span className="text-xs text-text-tertiary flex items-center gap-1"><ClockIcon className="w-3 h-3"/> {timeLeft}</span>;
}

const FileItem = ({ file, onDelete }: { file: any, onDelete: (id: string) => void }) => {
    const { getFileBase64 } = useFiles();

    const handleDownload = async () => {
        try {
            const base64Data = await getFileBase64(file.id);
            if (!base64Data) return;

            // Convert base64 to blob
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: file.type });

            // Create download link
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = file.name;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error downloading file:', error);
        }
    };

    return (
        <div className="bg-dark-card p-3 rounded-lg flex items-center gap-4 border border-dark-border group">
            <FilesIcon className="w-6 h-6 text-text-secondary flex-shrink-0"/>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                <p className="text-xs text-text-tertiary">{formatBytes(file.size)}</p>
            </div>
            <TimeLeft expiryTimestamp={file.expiresAt} />
            <button onClick={handleDownload} className="p-1 text-text-tertiary hover:text-green-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <DownloadIcon className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(file.id)} className="p-1 text-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                <TrashIcon className="w-4 h-4" />
            </button>
        </div>
    );
};

export const FilesView: React.FC = () => {
    const { files, addFile, deleteFile, getFileBase64 } = useFiles();
    const [isDragging, setIsDragging] = useState(false);

    const handleFileDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            for (const file of Array.from(e.dataTransfer.files)) {
                await addFile(file);
            }
            e.dataTransfer.clearData();
        }
    }, [addFile]);

    const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    };

    return (
        <div className="w-full max-w-full max-w-[360px]:max-w-[320px] xs:max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex-1 p-1 max-w-[360px]:p-2 sm:p-3 md:p-4">
            <h1 className="text-2xl font-bold mb-4">Temporary Files</h1>
            <p className="text-text-secondary mb-6">Upload files for quick access. They will be automatically deleted after 24 hours.</p>

            <div 
                onDrop={handleFileDrop}
                onDragOver={handleDragEvents}
                onDragEnter={handleDragEvents}
                onDragLeave={handleDragEvents}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-primary/80 bg-dark-card/50' : 'border-dark-border hover:border-primary/50'}`}
            >
                <UploadCloudIcon className="w-12 h-12 mx-auto text-text-tertiary mb-2"/>
                <p className="text-text-secondary">Drag & Drop files here</p>
                <p className="text-xs text-text-tertiary">or click to select</p>
                 <input
                    type="file"
                    multiple
                    className="hidden"
                    id="file-upload"
                    onChange={async (e) => {
                        if (e.target.files) {
                            for (const file of Array.from(e.target.files)) {
                                await addFile(file);
                            }
                        }
                    }}
                />
                <label htmlFor="file-upload" className="mt-2 inline-block px-4 py-1.5 text-sm bg-dark-card border border-dark-border rounded-md cursor-pointer hover:bg-dark-border">
                    Browse Files
                </label>
            </div>

            <div className="mt-8">
                {files.length > 0 ? (
                    <div className="space-y-3">
                        {files.map(file => <FileItem key={file.id} file={file} onDelete={deleteFile}/>)}
                    </div>
                ) : (
                    <div className="text-center py-10">
                        <p className="text-text-tertiary">No files uploaded yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
