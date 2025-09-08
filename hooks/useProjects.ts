
import React, { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { ProjectTask } from '../types';
import { supabase } from '../services/supabaseClient';
import { useAuth } from './useAuth';

interface ProjectsContextType {
    tasks: ProjectTask[];
    isLoading: boolean;
    addTask: (text: string) => Promise<void>;
    toggleTask: (id: string) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextType | undefined>(undefined);

export const ProjectsProvider = ({ children }: { children: ReactNode }) => {
    const [tasks, setTasks] = useState<ProjectTask[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // Load tasks from Supabase when user logs in
    const loadTasks = useCallback(async () => {
        if (!user) {
            setTasks([]);
            return;
        }

        try {
            setIsLoading(true);
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading projects:', error);
                return;
            }

            const formattedTasks: ProjectTask[] = data.map(task => ({
                id: task.id,
                text: task.text,
                completed: task.completed,
                createdAt: new Date(task.created_at).getTime(),
            }));

            setTasks(formattedTasks);
        } catch (error) {
            console.error('Error loading projects:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadTasks();
    }, [loadTasks]);

    const insertTaskToDB = useCallback(async (task: ProjectTask) => {
        if (!user) return null;

        try {
            const taskData = {
                user_id: user.id,
                text: task.text,
                completed: task.completed,
            };

            const { data, error } = await supabase
                .from('projects')
                .insert(taskData)
                .select()
                .single();

            if (error) {
                console.error('Error inserting task:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('Error inserting task:', error);
            return null;
        }
    }, [user]);

    const addTask = useCallback(async (text: string) => {
        if (!text.trim() || !user) return;

        try {
            setIsLoading(true);

            // Create temporary task for optimistic update
            const tempTask: ProjectTask = {
                id: `temp-${Date.now()}`,
                text,
                completed: false,
                createdAt: Date.now(),
            };

            // Add to local state immediately for optimistic update
            setTasks(prev => [tempTask, ...prev]);

            // Save to database
            const savedTask = await insertTaskToDB({
                id: tempTask.id,
                text: tempTask.text,
                completed: tempTask.completed,
                createdAt: tempTask.createdAt
            });

            if (savedTask) {
                // Update local state with real database ID
                setTasks(prev => prev.map(task =>
                    task.id === tempTask.id
                        ? {
                            id: savedTask.id,
                            text: savedTask.text,
                            completed: savedTask.completed,
                            createdAt: new Date(savedTask.created_at).getTime(),
                        }
                        : task
                ));
            } else {
                // If saving failed, remove from local state
                setTasks(prev => prev.filter(task => task.id !== tempTask.id));
            }
        } catch (error) {
            console.error('Error adding task:', error);
            // Remove from local state on error
            setTasks(prev => prev.filter(task => task.id.startsWith('temp-')));
        } finally {
            setIsLoading(false);
        }
    }, [user, insertTaskToDB]);

    const toggleTask = useCallback(async (id: string) => {
        if (!user) return;

        try {
            setIsLoading(true);

            // Find the current task
            const currentTask = tasks.find(t => t.id === id);
            if (!currentTask) return;

            // Optimistic update
            const newCompleted = !currentTask.completed;
            setTasks(prev =>
                prev.map(task =>
                    task.id === id ? { ...task, completed: newCompleted } : task
                )
            );

            // Update in database
            const { error } = await supabase
                .from('projects')
                .update({
                    completed: newCompleted,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .eq('user_id', user.id);

            if (error) {
                console.error('Error updating task:', error);
                // Revert optimistic update if database update failed
                setTasks(prev =>
                    prev.map(task =>
                        task.id === id ? { ...task, completed: currentTask.completed } : task
                    )
                );
            }
        } catch (error) {
            console.error('Error toggling task:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user, tasks]);

    const deleteTask = useCallback(async (id: string) => {
        if (!user) return;

        try {
            setIsLoading(true);
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting task:', error);
                return;
            }

            setTasks(prev => prev.filter(t => t.id !== id));
        } catch (error) {
            console.error('Error deleting task:', error);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const value = { tasks, isLoading, addTask, toggleTask, deleteTask };

    return React.createElement(ProjectsContext.Provider, { value }, children);
};

export const useProjects = (): ProjectsContextType => {
    const context = useContext(ProjectsContext);
    if (context === undefined) {
        throw new Error('useProjects must be used within a ProjectsProvider');
    }
    return context;
};
