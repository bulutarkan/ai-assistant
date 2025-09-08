import { createClient } from '@supabase/supabase-js';

// Get Supabase credentials from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// File storage utilities
export const uploadFile = async (file: File, userId: string): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `user-files/${userId}/${fileName}`;

    console.log('🗂️ Uploading file to Supabase Storage:', {
        originalName: file.name,
        generatedName: fileName,
        path: filePath,
        size: file.size
    });

    const { data, error } = await supabase.storage
        .from('files')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) {
        console.error('❌ File upload failed:', error);
        throw error;
    }

    console.log('✅ File uploaded successfully:', data);
    return filePath;
};

export const getFileUrl = (filePath: string): string => {
    const { data } = supabase.storage
        .from('files')
        .getPublicUrl(filePath);

    return data.publicUrl;
};

export const deleteFile = async (filePath: string): Promise<void> => {
    const { error } = await supabase.storage
        .from('files')
        .remove([filePath]);

    if (error) {
        console.error('❌ File deletion failed:', error);
        throw error;
    }

    console.log('✅ File deleted successfully:', filePath);
};
