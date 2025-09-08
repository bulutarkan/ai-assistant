
import React, { useState } from 'react';
import { useProjects } from '../../hooks/useProjects';
import { PlusIcon, TrashIcon } from '../ui/Icons';
import { ProjectTask } from '../../types';

const TaskItem = ({ task, onToggle, onDelete }: { task: ProjectTask, onToggle: (id: string) => void, onDelete: (id: string) => void }) => {
    // Calculate remaining days for completed tasks (7 days total)
    const getRemainingDays = (createdAt: number, completed: boolean) => {
        if (!completed) return null;

        const completedTime = Date.now(); // Since we don't have completedAt in types yet
        const timeDiff = completedTime - createdAt;
        const daysPassed = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const remainingDays = Math.max(0, 7 - daysPassed);

        return remainingDays;
    };

    const remainingDays = getRemainingDays(task.createdAt, task.completed);

    return (
        <div className="bg-dark-card p-3 rounded-lg flex items-center gap-3 border border-dark-border group transition-all hover:border-primary/40">
            <input
                type="checkbox"
                checked={task.completed}
                onChange={() => onToggle(task.id)}
                className="w-5 h-5 bg-dark-sidebar border-dark-border rounded text-primary focus:ring-primary/50 cursor-pointer"
            />
            <span className={`flex-1 text-sm ${task.completed ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
                {task.text}
            </span>
            <div className="flex items-center gap-2">
                {remainingDays !== null && remainingDays >= 0 && (
                    <span className="text-xs text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
                        {remainingDays}d
                    </span>
                )}
                <button onClick={() => onDelete(task.id)} className="p-1 text-text-tertiary hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                    <TrashIcon className="w-4 h-4"/>
                </button>
            </div>
        </div>
    )
}

export const ProjectsView: React.FC = () => {
    const { tasks, addTask, toggleTask, deleteTask } = useProjects();
    const [newTaskText, setNewTaskText] = useState('');

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        addTask(newTaskText);
        setNewTaskText('');
    };
    
    const pendingTasks = tasks.filter(t => !t.completed).sort((a,b) => b.createdAt - a.createdAt);
    const completedTasks = tasks.filter(t => t.completed).sort((a,b) => b.createdAt - a.createdAt);

    return (
        <div className="w-full max-w-full max-w-[360px]:max-w-[320px] xs:max-w-sm sm:max-w-md md:max-w-2xl lg:max-w-4xl mx-auto flex-1 p-1 max-w-[360px]:p-2 sm:p-3 md:p-4">
            <h1 className="text-2xl font-bold mb-6">Projects To-Do</h1>

            <form onSubmit={handleAddTask} className="flex gap-2 mb-8">
                <input 
                    type="text"
                    value={newTaskText}
                    onChange={(e) => setNewTaskText(e.target.value)}
                    placeholder="Add a new task..."
                    className="flex-1 bg-dark-card border border-dark-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50"
                />
                <button type="submit" className="px-4 py-2 bg-primary text-dark-bg rounded-lg font-semibold hover:bg-primary-focus transition-colors flex items-center gap-1">
                    <PlusIcon className="w-4 h-4"/>
                    <span>Add</span>
                </button>
            </form>
            
            <div className="space-y-6">
                 <div>
                    <h2 className="text-lg font-semibold mb-3">Pending ({pendingTasks.length})</h2>
                     {pendingTasks.length > 0 ? (
                        <div className="space-y-2">
                           {pendingTasks.map(task => <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />)}
                        </div>
                     ) : (
                         <p className="text-text-tertiary text-sm">No pending tasks. Great job!</p>
                     )}
                 </div>
                 
                 <div>
                    <h2 className="text-lg font-semibold mb-3">Completed ({completedTasks.length})</h2>
                    {completedTasks.length > 0 ? (
                        <div className="space-y-2">
                           {completedTasks.map(task => <TaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />)}
                        </div>
                     ) : (
                         <p className="text-text-tertiary text-sm">No tasks completed yet.</p>
                     )}
                 </div>
            </div>
        </div>
    );
};
