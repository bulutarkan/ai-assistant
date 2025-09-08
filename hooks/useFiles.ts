
import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { StoredFile } from '../types';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';

const FILE_EXPIRATION_TIME = 24 * 60 * 60 * 1000; // 24 hours

interface FilesContextType {
    files: StoredFile[];
    isLoading: boolean;
    addFile: (file: File) => Promise<void>;
    deleteFile: (id: string) => Promise<void>;
    getFileBase64: (fileId: string) => Promise<string>;
}

const FilesContext = createContext<FilesContextType | undefined>(undefined);

export const FilesProvider = ({ children }: { children: ReactNode }) => {
    const [files, setFiles] = useState<StoredFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Load files from Supabase when user logs in
    const loadFiles = useCallback(async () => {
        if (!user) {
            setFiles([]);
            return;
        }

        try {
            setIsLoading(true);

            // Clean up expired files first
            await supabase.rpc('cleanup_expired_files');

            const { data, error } = await supabase
                .from('files')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading files:', error);
                return;
            }

            // Filter out expired files and format for frontend
            const stillValidFiles = data.filter(f => new Date(f.expires_at) > new Date());

            const formattedFiles: StoredFile[] = stillValidFiles.map(file => ({
                id: file.id,
                name: file.name,
                type: file.type,
                size: file.size,
                base64: '', // We'll load this from storage when needed
                expiresAt: new Date(file.expires_at).getTime(),
            }));

            setFiles(formattedFiles);
        } catch (error) {
            console.error('Error loading files:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    // Update file base64 data when needed (lazy loading)
    const loadFileBase64 = useCallback(async (fileId: string, filePath: string): Promise<string> => {
        try {
            const { data, error } = await supabase.storage
                .from('user-files')
                .download(filePath);

            if (error) {
                console.error('Error downloading file:', error);
                return '';
            }

            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve((reader.result as string).split(',')[1]);
                reader.readAsDataURL(data);
            });
        } catch (error) {
            console.error('Error loading file base64:', error);
            return '';
        }
    }, []);

    const addFile = useCallback(async (file: File) => {
        if (!user) return;

        try {
            setIsLoading(true);

            // Generate unique file path
            const fileExtension = file.name.split('.').pop();
            const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExtension}`;
            const filePath = `${user.id}/${fileName}`;

            // Upload file to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('user-files')
                .upload(filePath, file);

            if (uploadError) {
                console.error('Error uploading file:', uploadError);
                return;
            }

            // Save file metadata to database
            const fileData = {
                user_id: user.id,
                name: file.name,
                type: file.type,
                size: file.size,
                file_path: filePath,
                expires_at: new Date(Date.now() + FILE_EXPIRATION_TIME).toISOString(),
            };

            const { data, error: dbError } = await supabase
                .from('files')
                .insert([fileData])
                .select()
                .single();

            if (dbError) {
                console.error('Error saving file metadata:', dbError);
                // Clean up uploaded file if database insert failed
                await supabase.storage
                    .from('user-files')
                    .remove([filePath]);
                return;
            }

            // Add to local state
            const newFile: StoredFile = {
                id: data.id,
                name: file.name,
                type: file.type,
                size: file.size,
                base64: '', // Load on demand
                expiresAt: new Date(data.expires_at).getTime(),
            };

            setFiles(prev => [newFile, ...prev]);
        } catch (error) {
            console.error('Error adding file:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const deleteFile = useCallback(async (id: string) => {
        if (!user) return;

        try {
            setIsLoading(true);

            // Find file to get path before deleting
            const fileToDelete = files.find(f => f.id === id);
            if (!fileToDelete) return;

            // Find the file record to get the path
            const { data: fileRecord, error: fetchError } = await supabase
                .from('files')
                .select('file_path')
                .eq('id', id)
                .single();

            if (fetchError) {
                console.error('Error fetching file record:', fetchError);
                return;
            }

            // Delete from storage
            const { error: storageError } = await supabase.storage
                .from('user-files')
                .remove([fileRecord.file_path]);

            if (storageError) {
                console.error('Error deleting file from storage:', storageError);
            }

            // Delete from database
            const { error: dbError } = await supabase
                .from('files')
                .delete()
                .eq('id', id);

            if (dbError) {
                console.error('Error deleting file from database:', dbError);
                return;
            }

            // Remove from local state
            setFiles(prev => prev.filter(f => f.id !== id));
        } catch (error) {
            console.error('Error deleting file:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, files]);

    // Get file base64 for a specific file (used when file needs to be displayed)
    const getFileBase64 = useCallback(async (fileId: string): Promise<string> => {
        const file = files.find(f => f.id === fileId);
        if (!file) return '';

        if (file.base64) return file.base64;

        // Find file record to get path
        const { data: fileRecord, error } = await supabase
            .from('files')
            .select('file_path')
            .eq('id', fileId)
            .single();

        if (error) {
            console.error('Error fetching file record:', error);
            return '';
        }

        const base64 = await loadFileBase64(fileId, fileRecord.file_path);

        // Update local state with base64
        setFiles(prev => prev.map(f =>
            f.id === fileId ? { ...f, base64 } : f
        ));

        return base64;
    }, [files, loadFileBase64]);

    const value = { files, isLoading, addFile, deleteFile, getFileBase64 };

    return React.createElement(FilesContext.Provider, { value }, children);
};

export const useFiles = (): FilesContextType => {
    const context = useContext(FilesContext);
    if (context === undefined) {
        throw new Error('useFiles must be used within a FilesProvider');
    }
    return context;
};
