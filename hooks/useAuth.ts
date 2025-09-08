import { useState, useEffect } from 'react';
import { User } from '../types';
import { supabase } from '../services/supabaseClient';
import { AuthError, User as SupabaseUser } from '@supabase/supabase-js';

export const useAuth = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState<string | null>(null);

    useEffect(() => {
        // Clear any demo/localStorage data on mount
        if (typeof window !== 'undefined') {
            localStorage.removeItem('chat-user');
            localStorage.removeItem('chat-conversations');
        }

        // Get initial session
        const getInitialSession = async () => {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                console.error('Error getting session:', error.message);
                setAuthError(error.message);
                setUser(null);
            } else if (session?.user) {
                setUser(formatUserFromSupabase(session.user));
                setAuthError(null);
            } else {
                setUser(null);
            }

            setLoading(false);
        };

        getInitialSession();

        // Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                // Only log important auth events, not every state change
                if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                    console.log('🔄 Auth state changed:', { event, userId: session?.user?.id });
                }

                if (event === 'SIGNED_IN' && session?.user) {
                    const formattedUser = formatUserFromSupabase(session.user);
                    setUser(formattedUser);
                    setAuthError(null);
                } else if (event === 'SIGNED_OUT') {
                    setUser(null);
                    setAuthError(null);
                    if (typeof window !== 'undefined') {
                        localStorage.clear();
                    }
                } else if (event === 'TOKEN_REFRESHED' && session?.user) {
                    const formattedUser = formatUserFromSupabase(session.user);
                    setUser(formattedUser);
                } else if (event === 'USER_UPDATED' && session?.user) {
                    // Prevent duplicate updates - only update if user data has actually changed
                    const formattedUser = formatUserFromSupabase(session.user);
                    setUser(prevUser => {
                        // Only update if the user data is actually different
                        if (JSON.stringify(prevUser) !== JSON.stringify(formattedUser)) {
                            setUser(formattedUser);
                            return formattedUser;
                        } else {
                            return prevUser;
                        }
                    });
                    setAuthError(null);
                }

                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const formatUserFromSupabase = (supabaseUser: SupabaseUser): User => {
        const user = {
            id: supabaseUser.id,
            name: supabaseUser.user_metadata?.name || '',
            surname: supabaseUser.user_metadata?.surname || '',
            email: supabaseUser.email || '',
            avatar: supabaseUser.user_metadata?.avatar,
        };

        return user;
    };

    const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        setLoading(true);
        setAuthError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                setAuthError(error.message);
                setLoading(false);
                return { success: false, error: error.message };
            }

            if (data.user) {
                setUser(formatUserFromSupabase(data.user));
            }

            setLoading(false);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setAuthError(errorMessage);
            setLoading(false);
            return { success: false, error: errorMessage };
        }
    };

    const signup = async (name: string, surname: string, email: string, password: string): Promise<{ success: boolean; error?: string }> => {
        setLoading(true);
        setAuthError(null);

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name,
                        surname,
                        full_name: `${name} ${surname}`,
                    }
                }
            });

            if (error) {
                setAuthError(error.message);
                setLoading(false);
                return { success: false, error: error.message };
            }

            // Note: User might need to confirm email before being fully authenticated
            if (data.user && !data.user.email_confirmed_at) {
                setAuthError('Please check your email and confirm your account before signing in.');
                setLoading(false);
                return { success: false, error: 'Please check your email and confirm your account before signing in.' };
            }

            setLoading(false);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            setAuthError(errorMessage);
            setLoading(false);
            return { success: false, error: errorMessage };
        }
    };

    const logout = async (): Promise<{ success: boolean; error?: string }> => {
        setLoading(true);

        try {
            const { error } = await supabase.auth.signOut();

            if (error) {
                setAuthError(error.message);
                setLoading(false);
                return { success: false, error: error.message };
            }

            setUser(null);
            setAuthError(null);
            setLoading(false);
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during logout';
            setAuthError(errorMessage);
            setLoading(false);
            return { success: false, error: errorMessage };
        }
    };

    const updateUser = async (updatedUser: Partial<User>, newPassword?: string): Promise<{ success: boolean; error?: string }> => {
        try {
            console.log('🚀 Starting user update process ====');
            console.log('Update data received:', { updatedUser, hasPassword: !!newPassword });

            // Get current session to verify auth state
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('❌ Session error:', sessionError);
                return { success: false, error: 'Authentication session error' };
            }

            if (!sessionData.session?.user) {
                console.error('❌ No authenticated user found');
                return { success: false, error: 'No authenticated user' };
            }

            const currentUser = sessionData.session.user;
            console.log('📋 Current Supabase user metadata:', currentUser.user_metadata);

            const updates: any = {};

            // Always include current data to prevent overwriting
            if (updatedUser.name !== undefined || updatedUser.surname !== undefined || updatedUser.avatar !== undefined) {
                // Calculate full_name for Supabase display name
                const name = updatedUser.name || currentUser.user_metadata?.name || '';
                const surname = updatedUser.surname || currentUser.user_metadata?.surname || '';
                const fullName = name && surname ? `${name} ${surname}` : 'User';

                updates.data = {
                    // Merge with existing metadata to prevent data loss
                    ...(currentUser.user_metadata || {}),
                    name,
                    surname,
                    avatar: updatedUser.avatar !== undefined ? updatedUser.avatar : currentUser.user_metadata?.avatar,
                    full_name: fullName, // This will update display name in Supabase dashboard
                };
                console.log('📝 User metadata to update:', updates.data);
                console.log('📝 Existing metadata preserved:', currentUser.user_metadata);
                console.log('👤 Calculated full_name for display:', fullName);
            }

            if (newPassword && newPassword.trim()) {
                updates.password = newPassword;
                console.log('🔒 Password will be updated');
            }

            console.log('📡 Sending to Supabase Auth (enhanced method):', JSON.stringify(updates, null, 2));

            // Enhanced auth update with multiple attempts and verification
            let updateAttempts = 0;
            const maxAttempts = 3;
            let lastError = null;

            while (updateAttempts < maxAttempts) {
                try {
                    updateAttempts++;
                    console.log(`🔄 Auth update attempt ${updateAttempts}/${maxAttempts}`);

                    const { data, error } = await supabase.auth.updateUser(updates);

                    if (error) {
                        console.error(`❌ Auth update attempt ${updateAttempts} failed:`, error);
                        lastError = error;

                        if (updateAttempts < maxAttempts) {
                            console.log('⏳ Retrying auth update in 1 second...');
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        }
                        break;
                    }

                    console.log('✅ Auth update API call successful');
                    console.log('Response data:', data);

                    if (data.user) {
                        console.log('🔄 Updated Supabase user metadata:', data.user.user_metadata);

                        // Multiple verification attempts
                        let verified = false;
                        for (let verifyAttempt = 1; verifyAttempt <= 3; verifyAttempt++) {
                            console.log(`🔍 Verification attempt ${verifyAttempt}/3`);

                            // Get fresh user data
                            const { data: verifyData, error: verifyError } = await supabase.auth.getUser();

                            if (verifyError) {
                                console.warn(`⚠️ Verification ${verifyAttempt} failed:`, verifyError);
                                continue;
                            }

                            if (verifyData.user) {
                                console.log(`✅ Verification ${verifyAttempt} successful`);
                                console.log('Verified user metadata:', verifyData.user.user_metadata);

                                // Check if changes were actually applied
                                const hasChanges = JSON.stringify(verifyData.user.user_metadata) !== JSON.stringify(currentUser.user_metadata);
                                console.log('📊 Changes applied:', hasChanges);

                                if (hasChanges) {
                                    console.log('🎉 Changes verified successfully!');
                                    verified = true;

                                    const formattedUser = formatUserFromSupabase(verifyData.user);
                                    console.log('✨ Final formatted user:', formattedUser);

                                    // Force state update
                                    setUser(formattedUser);
                                    console.log('🔄 User state updated in React');

                                    break;
                                } else {
                                    console.warn(`⚠️ Verification ${verifyAttempt}: No changes detected, but API was successful`);
                                }
                            }
                        }

                        if (!verified) {
                            console.warn('⚠️ All verifications failed - changes may not have been applied');
                        }

                        console.log('🎉 Auth update process completed');
                        return { success: true };
                    } else {
                        console.warn('⚠️ No user data in auth update response');
                    }

                    // If we get here, something went wrong but no error was thrown
                    break;

                } catch (attemptError) {
                    console.error(`💥 Auth update attempt ${updateAttempts} crashed:`, attemptError);
                    lastError = attemptError;

                    if (updateAttempts < maxAttempts) {
                        console.log('⏳ Retrying after crash...');
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            }

            // All attempts failed
            const errorMessage = lastError ? lastError.message : 'All auth update attempts failed';
            console.error('💥 All auth update attempts failed:', errorMessage);
            return { success: false, error: errorMessage };

            console.log('🎉 User update process completed successfully');
            return { success: true };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
            console.error('💥 User update process failed:', errorMessage);
            console.error('Full error:', err);
            return { success: false, error: errorMessage };
        }
    };

    // Debug function to test Supabase auth directly
    const debugAuthUpdate = async (testData: any) => {
        console.log('🔧 DEBUG AUTH UPDATE STARTED ====');
        console.log('Test data:', testData);

        try {
            // Test 1: Get current session
            console.log('📋 Test 1: Getting current session...');
            const { data: session, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) {
                console.error('❌ Session error:', sessionError);
                return { success: false, error: 'Session error' };
            }
            console.log('✅ Session OK:', {
                hasSession: !!session.session,
                userId: session.session?.user?.id,
                currentMetadata: session.session?.user?.user_metadata
            });

            // Test 2: Direct auth update
            console.log('🔄 Test 2: Direct auth update...');
            const { data: updateData, error: updateError } = await supabase.auth.updateUser({
                data: testData
            });

            if (updateError) {
                console.error('❌ Auth update error:', updateError);
                console.error('Full error object:', JSON.stringify(updateError, null, 2));
                return { success: false, error: updateError.message };
            }

            console.log('✅ Auth update response:', updateData);

            // Test 3: Verify the update
            console.log('🔍 Test 3: Verifying update...');
            const { data: verifyData, error: verifyError } = await supabase.auth.getSession();
            if (verifyError) {
                console.error('❌ Verification error:', verifyError);
                return { success: false, error: 'Verification error' };
            }

            console.log('✅ Verification result:', {
                updatedMetadata: verifyData.session?.user?.user_metadata,
                isChanged: JSON.stringify(verifyData.session?.user?.user_metadata) !== JSON.stringify(session.session?.user?.user_metadata)
            });

            return {
                success: true,
                before: session.session?.user?.user_metadata,
                after: verifyData.session?.user?.user_metadata
            };

        } catch (error) {
            console.error('💥 Debug auth update failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    };

    return {
        user,
        loading,
        authError,
        login,
        signup,
        logout,
        updateUser,
        debugAuthUpdate // Export for testing
    };
};
