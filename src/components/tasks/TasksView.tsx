import React, { useState } from 'react';
import { useXLate } from '../../context/XLateContext';
import { AITask } from '../../types';
import confetti from 'canvas-confetti';
import { CheckSquare, Calendar, Bell, Plus, Check, Trash2, ExternalLink, Sparkles, AlertCircle, Clock } from 'lucide-react';

export const TasksView: React.FC = () => {
  const {
    tasks,
    morningAlerts,
    toggleTaskDone,
    deleteTask,
    addTaskManually,
    ackMorningAlert
  } = useXLate();

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDueDate, setNewDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [newDueTime, setNewDueTime] = useState('09:00');
  const [newPriority, setNewPriority] = useState<'IMPORTANT' | 'NORMAL'>('NORMAL');

  const pendingTasks = tasks.filter(t => t.status === 'PENDING');
  const completedTasks = tasks.filter(t => t.status === 'DONE');

  const handleToggleDone = async (taskId: string, currentStatus: string) => {
    if (currentStatus === 'PENDING') {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 }
      });
    }
    await toggleTaskDone(taskId);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await addTaskManually({
      title: newTitle,
      dueDate: newDueDate,
      dueTime: newDueTime,
      priority: newPriority,
      reminderIntervals: ['1_DAY_BEFORE', 'SAME_DAY']
    });

    setNewTitle('');
    setShowAddModal(false);
  };

  const handleExportCalendar = async (task: AITask, platform: 'google' | 'outlook' | 'zoho' | 'ics') => {
    try {
      const res = await fetch('/api/calendar/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: task.title,
          description: task.description || 'X-Late AI Live Translation Commitment',
          dueDate: task.dueDate,
          dueTime: task.dueTime
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (platform === 'google') window.open(data.googleUrl, '_blank');
        else if (platform === 'outlook') window.open(data.outlookUrl, '_blank');
        else if (platform === 'zoho') window.open(data.zohoUrl, '_blank');
        else if (platform === 'ics') {
          const blob = new Blob([data.icsContent], { type: 'text/calendar' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${task.title.replace(/[^a-z0-9]/gi, '_')}.ics`;
          a.click();
        }
      }
    } catch (err) {
      console.error('Calendar export error:', err);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-amber-400" />
            <span>AI Tasks & Reminders</span>
          </h2>
          <p className="text-xs text-slate-400">Extracted from live translation commitments</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Add Reminder</span>
        </button>
      </div>

      {/* IMPORTANT MORNING ALERT BANNER (CRITICAL REQUIREMENT) */}
      {morningAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 border-2 border-amber-500/60 rounded-2xl p-4 shadow-xl space-y-3 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
                  Important Morning Alert
                </h3>
                <p className="text-xs text-white font-medium">You have important tasks scheduled for today!</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            {morningAlerts.map(alertTask => (
              <div key={alertTask.id} className="bg-slate-950/80 p-3 rounded-xl border border-amber-500/30 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{alertTask.title}</p>
                  <p className="text-[10px] text-amber-300">Due today at {alertTask.dueTime || '09:00'}</p>
                </div>
                <button
                  onClick={() => ackMorningAlert(alertTask.id)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px]"
                >
                  Acknowledge
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Pending Reminders ({pendingTasks.length})
        </h3>

        {pendingTasks.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 text-center text-slate-500 text-xs">
            No pending AI tasks. Speech commitments with dates & times will automatically appear here.
          </div>
        ) : (
          pendingTasks.map((task) => (
            <div
              key={task.id}
              className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => handleToggleDone(task.id, task.status)}
                    className="mt-0.5 w-5 h-5 rounded-lg border-2 border-slate-700 hover:border-amber-400 flex items-center justify-center transition-colors shrink-0"
                  >
                    {task.status === 'DONE' && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-white">{task.title}</h4>
                      {task.priority === 'IMPORTANT' && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Important
                        </span>
                      )}
                    </div>

                    {task.extractedFromText && (
                      <p className="text-[11px] text-slate-400 italic mt-0.5">
                        Extracted from: "{task.extractedFromText}"
                      </p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 text-cyan-400 font-mono">
                        <Clock className="w-3 h-3" />
                        {task.dueDate} {task.dueTime}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* One-Tap Calendar Export Toolbar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                <span className="text-slate-500">Add to Calendar:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExportCalendar(task, 'google')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    Google
                  </button>
                  <button
                    onClick={() => handleExportCalendar(task, 'outlook')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    Outlook
                  </button>
                  <button
                    onClick={() => handleExportCalendar(task, 'zoho')}
                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    Zoho
                  </button>
                  <button
                    onClick={() => handleExportCalendar(task, 'ics')}
                    className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                  >
                    .ICS
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Completed Tasks Section */}
      {completedTasks.length > 0 && (
        <div className="space-y-2 pt-4">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Completed ({completedTasks.length})
          </h3>
          <div className="space-y-1.5">
            {completedTasks.map((task) => (
              <div key={task.id} className="bg-slate-900/40 border border-slate-800/50 rounded-xl p-3 flex items-center justify-between opacity-60">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs line-through text-slate-400">{task.title}</span>
                </div>
                <button onClick={() => deleteTask(task.id)} className="p-1 text-slate-500 hover:text-rose-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual Task Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-white">Add New AI Reminder</h3>

            <form onSubmit={handleCreateTask} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Reminder Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Call client about taxi payment"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={newDueTime}
                    onChange={(e) => setNewDueTime(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Priority</label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as any)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white"
                >
                  <option value="NORMAL">Normal Reminder</option>
                  <option value="IMPORTANT">IMPORTANT (Triggers Morning Alert)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold"
                >
                  Save Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
