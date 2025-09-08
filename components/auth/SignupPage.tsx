import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { EyeIcon, EyeSlashIcon } from '../ui/Icons';

export const SignupPage: React.FC = () => {
    const [name, setName] = useState('');
    const [surname, setSurname] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const auth = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isLoading) return;

        setIsLoading(true);

        try {
            const result = await auth.signup(name, surname, email, password);
            if (result.success) {
                navigate('/');
            }
            // Error is handled by useAuth hook and displayed via authError
        } catch (error) {
            console.error('Signup error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-dark-bg to-dark-card p-4">
            <div className="w-full max-w-md bg-dark-card rounded-2xl shadow-xl p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-dark-sidebar rounded-full mb-4">
                        <img
                            src="https://ckhealthturkey.com/wp-content/uploads/ai-assistant/assets/unnamed.webp"
                            alt="CK AI Assistant"
                            className="w-10 h-10 object-contain"
                        />
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        Create Account
                    </h1>
                    <p className="text-text-secondary mt-2">Join the CK AI Assistant platform</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-white mb-2">
                                    First Name
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    disabled={isLoading || auth.loading}
                                    className="w-full px-4 py-3 border-2 border-dark-border rounded-xl shadow-sm placeholder-text-tertiary text-white bg-dark-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Enter your name"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-white mb-2">
                                    Last Name
                                </label>
                                <input
                                    type="text"
                                    value={surname}
                                    onChange={(e) => setSurname(e.target.value)}
                                    required
                                    disabled={isLoading || auth.loading}
                                    className="w-full px-4 py-3 border-2 border-dark-border rounded-xl shadow-sm placeholder-text-tertiary text-white bg-dark-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Enter your surname"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-white mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={isLoading || auth.loading}
                                className="w-full px-4 py-3 border-2 border-dark-border rounded-xl shadow-sm placeholder-text-tertiary text-white bg-dark-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                placeholder="Enter your email"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-white mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    disabled={isLoading || auth.loading}
                                    className="w-full px-4 py-3 pr-12 border-2 border-dark-border rounded-xl shadow-sm placeholder-text-tertiary text-white bg-dark-border focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder="Create a password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-text-secondary hover:text-primary transition-colors"
                                    disabled={isLoading || auth.loading}
                                >
                                    {showPassword ? (
                                        <EyeSlashIcon className="w-5 h-5" />
                                    ) : (
                                        <EyeIcon className="w-5 h-5" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {(auth.authError) && (
                        <div className="bg-red-900/20 border border-red-800/50 rounded-xl p-4">
                            <p className="text-sm text-red-400">{auth.authError}</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading || auth.loading}
                        className="w-full flex items-center justify-center py-3.5 px-4 bg-dark-border hover:bg-dark-card text-white font-semibold rounded-xl shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none hover:scale-[1.05] transform"
                    >
                        {isLoading || auth.loading ? (
                            <>
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                                Creating Account...
                            </>
                        ) : (
                            'Create Account'
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-text-secondary">
                        Already have an account?{' '}
                        <Link
                            to="/login"
                            className="font-semibold text-primary hover:text-primary-focus transition-colors duration-200"
                        >
                            Sign in here
                        </Link>
                    </p>
                </div>


            </div>
        </div>
    );
};
