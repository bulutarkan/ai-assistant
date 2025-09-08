import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../services/supabaseClient';
import { XIcon } from '../ui/Icons';

interface SettingsModalProps {
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const { user, updateUser, debugAuthUpdate } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [surname, setSurname] = useState(user?.surname || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.avatar || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Sync local state with user state when modal opens or user changes
  useEffect(() => {
    if (user) {
      console.log('🔄 Syncing Settings Modal state with user:', user);
      setName(user.name || '');
      setSurname(user.surname || '');
      setAvatarPreview(user.avatar || null);
      console.log('✅ Settings Modal state synced');
    }
  }, [user]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  // Upload avatar to Supabase Storage
  const uploadAvatar = async (file: File): Promise<string | null> => {
    if (!user) return null;

    console.log('Starting avatar upload for user:', user.id);

    const fileExt = file.name.split('.').pop();
    const filePath = `${user.id}_${Date.now()}.${fileExt}`; // Remove 'avatars/' prefix

    console.log('Uploading to path:', filePath);

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file);

    if (error) {
      console.error('Avatar upload error:', error);
      throw error;
    }

    console.log('Upload successful:', data);

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    console.log('Generated public URL:', publicUrl);

    return publicUrl;
  };

  // Update user profile in Supabase Auth
  const updateProfile = async (updates: {
    name?: string;
    surname?: string;
    avatar?: string;
  }) => {
    if (!user) {
      console.error('❌ No user found for profile update');
      return;
    }

    console.log('🔄 Starting profile update to Supabase Auth');
    console.log('Profile updates:', updates);

    // Calculate full_name for Supabase display name
    const fullName = updates.name && updates.surname
      ? `${updates.name} ${updates.surname}`
      : (user?.name && user?.surname ? `${user.name} ${user.surname}` : 'User');

    const authUpdates = {
      data: {
        name: updates.name,
        surname: updates.surname,
        avatar: updates.avatar,
        full_name: fullName, // This will update the display name in Supabase dashboard
      }
    };

    console.log('Auth update payload:', JSON.stringify(authUpdates, null, 2));

    const { data, error } = await supabase.auth.updateUser(authUpdates);

    if (error) {
      console.error('❌ Profile update error:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.status,
        details: error
      });
      throw error;
    }

    console.log('✅ Profile update successful');
    console.log('Response:', data);

    if (data.user) {
      console.log('User metadata after update:', data.user.user_metadata);
    }
  };

  // Update password
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      console.error('Password update error:', error);
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isLoading) {
      console.log('❌ Submit blocked:', { user: !!user, isLoading });
      return;
    }

    console.log('🚀 Starting profile update submission ====');
    console.log('Current form state:', {
      name,
      surname,
      hasAvatarFile: !!avatarFile,
      hasNewPassword: !!newPassword,
      avatarPreview: avatarPreview?.substring(0, 50) + '...',
    });

    setIsLoading(true);
    setMessage(null);

    try {
      let avatarUrl = avatarPreview;

      console.log('📁 Checking avatar upload...');
      // Upload new avatar if selected
      if (avatarFile) {
        console.log('📤 Uploading avatar file...');
        avatarUrl = await uploadAvatar(avatarFile);
        console.log('📤 Avatar upload completed, URL:', avatarUrl);
      } else {
        console.log('⏭️ No avatar file selected, using existing:', avatarPreview);
      }

      console.log('👤 Updating profile data...');
      const profileUpdates = {
        name: name || user.name,
        surname: surname || user.surname,
        avatar: avatarUrl,
      };
      console.log('Profile updates to send:', profileUpdates);

      console.log('🔄 Step 1: Updating profile via Supabase Auth');
      // Update profile (name, surname, avatar)
      await updateProfile(profileUpdates);

      console.log('🔄 Step 2: Updating user state via useAuth hook');
      // Also update via useAuth hook to trigger state updates
      await updateUser({
        name: profileUpdates.name,
        surname: profileUpdates.surname,
        avatar: profileUpdates.avatar,
      });

      console.log('🔑 Checking password update...');
      // Update password if provided
      if (newPassword) {
        console.log('🔐 Password update requested');
        if (newPassword !== confirmPassword) {
          throw new Error('New passwords do not match');
        }
        if (newPassword.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }
        await updatePassword(newPassword);
        console.log('🔐 Password updated successfully');
      } else {
        console.log('⏭️ No password update requested');
      }

      console.log('✅ All updates completed successfully!');
      setMessage({ type: 'success', text: 'Profile updated successfully!' });

      // Close modal after success - auth state listener will handle the UI updates automatically
      setTimeout(() => {
        handleClose();
        console.log('✅ Profile updated - auth state listener will update UI automatically');
      }, 1500);

    } catch (error) {
      console.error('💥 Profile update failed:', error);
      setMessage({
        type: 'error',
        text: error instanceof Error ? error.message : 'An error occurred while updating profile'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);

      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = async () => {
    try {
      console.log('🗑️ Removing avatar...');
      setAvatarFile(null);
      setAvatarPreview(null);

      // Update profile to remove avatar from Supabase Auth
      await updateProfile({
        name,
        surname,
        avatar: undefined, // This will remove avatar from metadata
      });

      console.log('✅ Avatar removed from profile');
    } catch (error) {
      console.error('❌ Failed to remove avatar:', error);
      // Still clear the local state even if API call fails
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  };

  const initials = `${name[0] || ''}${surname[0] || ''}`.toUpperCase();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 transition-opacity duration-300" onClick={handleClose}>
      <div 
        className={`bg-dark-card rounded-lg shadow-xl w-full max-w-lg m-4 transition-all duration-300 ease-in-out ${isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-dark-border flex justify-between items-center">
          <h2 className="text-2xl font-bold text-text-primary">Profile Settings</h2>
          <button onClick={handleClose} className="p-1 rounded-full text-text-tertiary hover:bg-dark-border">
            <XIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-6">
            {message && (
              <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {message.text}
              </div>
            )}

            <div className="flex items-center space-x-4">
                {avatarPreview ?
                    <img src={avatarPreview} alt="avatar" className="w-20 h-20 rounded-full object-cover flex-shrink-0" /> :
                    <div className="w-20 h-20 rounded-full bg-dark-sidebar flex items-center justify-center text-text-primary text-3xl font-bold flex-shrink-0">{initials}</div>
                }
                <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row gap-2">
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="px-4 py-2 text-sm bg-dark-border rounded-md hover:bg-dark-border/80 text-text-primary transition" disabled={isLoading}>Change Avatar</button>
                        <button type="button" onClick={removeAvatar} className="px-4 py-2 text-sm bg-dark-border text-text-secondary rounded-md hover:bg-dark-border/80 transition" disabled={isLoading}>Remove</button>
                    </div>
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handleAvatarChange} className="hidden" disabled={isLoading} />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">First Name</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-dark-sidebar text-text-primary"
                      disabled={isLoading}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">Last Name</label>
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      className="w-full px-3 py-2 border border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-dark-sidebar text-text-primary"
                      disabled={isLoading}
                    />
                </div>
            </div>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-text-secondary mb-1">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password (optional)"
                      className="w-full px-3 py-2 border border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-dark-sidebar text-text-primary"
                      disabled={isLoading}
                    />
                </div>
                {newPassword && (
                  <div>
                      <label className="block text-sm font-medium text-text-secondary mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        className="w-full px-3 py-2 border border-dark-border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/50 bg-dark-sidebar text-text-primary"
                        disabled={isLoading}
                      />
                  </div>
                )}
            </div>
          </div>

          <div className="p-6 bg-dark-sidebar/50 rounded-b-lg flex justify-end space-x-3">
             <button type="button" onClick={handleClose} className="px-4 py-2 bg-dark-border text-text-secondary rounded-md hover:bg-dark-border/80 transition" disabled={isLoading}>Cancel</button>
             <button type="submit" className="px-4 py-2 bg-primary text-dark-bg font-semibold rounded-md hover:bg-primary-focus transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading}>
                 {isLoading ? 'Saving...' : 'Save Changes'}
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};
