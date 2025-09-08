import React, { useState, useEffect, useCallback, useMemo, startTransition } from 'react';
import { flushSync } from 'react-dom';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { BlogScheduleItem, ScheduleDragItem } from '../../types';

const ITEM_TYPES = {
  KEYWORD: 'keyword'
};

interface ScheduledItemProps {
  item: BlogScheduleItem;
  onEdit?: (item: BlogScheduleItem) => void;
  onDelete?: (item: BlogScheduleItem) => void;
}

const ScheduledItem: React.FC<ScheduledItemProps> = ({ item, onEdit, onDelete }) => {
  const [, drag] = useDrag(() => ({
    type: ITEM_TYPES.KEYWORD,
    item: {
      id: `scheduled-${item.id}-${Date.now()}`,
      type: ITEM_TYPES.KEYWORD,
      keyword: item.keyword,
      recordId: item.id,
      isScheduled: true
    } as ScheduleDragItem,
    end: (item, monitor) => {
      if (monitor.didDrop()) {
        console.log('✅ Scheduled item moved successfully');
      }
    }
  }));

  return (
    <div className="space-y-1">
      <div
        ref={drag}
        className="text-xs text-text-primary bg-green-500/20 border border-green-500/30 rounded px-2 py-1 truncate hover:bg-green-500/30 transition-colors cursor-move hover:scale-105"
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(item);
        }}
        data-edit-button="true"
        title={`Edit: ${item.keyword}`}
      >
        {item.keyword}
      </div>
    </div>
  );
};

interface KeywordCardProps {
  keyword: string;
  index: number;
  recordId: string;
  notes?: string;
  onRemove: (index: number) => void;
}

const KeywordCard: React.FC<KeywordCardProps> = ({ keyword, index, recordId, onRemove }) => {
  const [, drag] = useDrag(() => ({
    type: ITEM_TYPES.KEYWORD,
    item: {
      id: `keyword-${recordId || Date.now()}-${index}`,
      type: ITEM_TYPES.KEYWORD,
      keyword: keyword,
      recordId: recordId,
      isScheduled: false
    } as ScheduleDragItem,
    end: (item, monitor) => {
      if (monitor.didDrop()) {
        console.log('Keyword dropped successfully:', item.keyword);
      }
    }
  }));

  return (
    <div
      ref={drag}
      className="bg-gradient-to-br from-primary/20 to-primary/10 border border-primary/30 rounded-lg p-4 cursor-move hover:shadow-lg hover:shadow-primary/20 transition-all duration-200 hover:scale-105"
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-text-primary text-sm">{keyword}</h3>
        <button
          onClick={() => onRemove(index)}
          className="text-text-tertiary hover:text-red-400 transition-colors"
        >
          ✕
        </button>
      </div>
      <p className="text-xs text-text-secondary">Click to edit • Drag to schedule</p>
    </div>
  );
};



interface CalendarDayProps {
  date: Date;
  isToday: boolean;
  items: BlogScheduleItem[];
  onDrop: (keyword: string, date: Date) => void;
  onEdit?: (item: BlogScheduleItem) => void;
  onDelete?: (item: BlogScheduleItem) => void;
  onDayClick: (date: Date) => void;
}

const CalendarDay: React.FC<CalendarDayProps> = ({
  date,
  isToday,
  items,
  onDrop,
  onEdit,
  onDelete,
  onDayClick
}) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: ITEM_TYPES.KEYWORD,
    drop: (item: ScheduleDragItem) => {
      if (item.type === ITEM_TYPES.KEYWORD) {
        onDrop(item.keyword, date);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  const handleClick = (e: React.MouseEvent) => {
    // Prevent triggering if edit button was clicked
    if ((e.target as Element).closest('[data-edit-button="true"]')) {
      return;
    }
    onDayClick(date);
  };

  // Calculate unpublished items count for all cases
  const unpublishedCount = items.filter(item => item.status !== 'published').length;
  const totalItems = items.length;
  const publishedCount = totalItems - unpublishedCount;
  const isAllPublished = totalItems > 0 && unpublishedCount === 0;

  return (
    <div
      ref={drop}
      onClick={handleClick}
      className={`
        relative h-20 p-2 border border-dark-border/50 hover:border-primary/50 transition-all cursor-pointer
        ${isToday
          ? 'border-2 border-primary bg-primary/5 hover:bg-primary/10'
          : 'bg-dark-card/30 hover:bg-dark-card/50'
        }
        ${isOver ? 'ring-2 ring-primary/50 bg-primary/10' : ''}
        ${items.length > 0 ? 'ring-1 ring-green-500/50' : ''}
      `}
    >

      <div className={`text-xs font-medium mb-1 flex items-center gap-1 ${isToday ? 'text-primary' : 'text-text-secondary'}`}>
        {date.getDate()}
        {isAllPublished && <span className="text-green-500 text-sm">✓</span>}
      </div>

      {/* Calendar Day Content with Badge Logic */}
      {items.length === 0 ? (
        <div className="text-xs text-text-tertiary text-center mt-4 opacity-0 hover:opacity-100 transition-opacity">
          Click to view • Drop here
        </div>
      ) : items.length === 1 ? (
        <ScheduledItem
          item={items[0]}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ) : (() => {
        if (isAllPublished) {
          // All items published - show checkmark in date, remove "All Completed"
          return (
            <div className="space-y-1">
              <div
                className="text-xs text-text-primary bg-green-500/20 border border-green-500/30 rounded px-2 py-1 truncate hover:bg-green-500/30 transition-colors cursor-move hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(items[0]);
                }}
                data-edit-button="true"
                title={`${publishedCount}/${totalItems} items published`}
              >
                {items[0]?.keyword || 'Loading...'}
              </div>
            </div>
          );
        } else {
          // Show progress with unpublished count
          return (
            <div className="relative">
              <div
                className="text-xs text-text-primary bg-green-500/20 border border-green-500/30 rounded px-2 py-1 truncate hover:bg-green-500/30 transition-colors cursor-move hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(items[0]);
                }}
                data-edit-button="true"
                title={`${publishedCount}/${totalItems} items published, ${unpublishedCount} remaining`}
              >
                {items[0]?.keyword || 'Loading...'}
              </div>

              {/* Remaining Count Badge - Gray instead of Red */}
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-gray-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-md hover:bg-gray-600 transition-colors">
                {unpublishedCount}
              </div>
            </div>
          );
        }
      })()}

    </div>
  );
};

interface AddKeywordFormProps {
  onAdd: (keyword: string) => void;
  onCancel: () => void;
}

const AddKeywordForm: React.FC<AddKeywordFormProps> = ({ onAdd, onCancel }) => {
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (keyword.trim()) {
      onAdd(keyword.trim());
      setKeyword('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-dark-card border border-dark-border rounded-lg p-4">
      <h3 className="font-semibold text-text-primary mb-3">Add New Content</h3>
      <input
        type="text"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="Enter keyword or topic..."
        className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/50"
        autoFocus
      />
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          className="justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 flex items-center gap-2"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-dark-border hover:bg-dark-bg text-text-secondary px-4 py-2 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

interface SidebarProps {
  keywords: string[];
  keywordRecordIds: string[];
  isAddingKeyword: boolean;
  onShowAddForm: () => void;
  onAddKeyword: (keyword: string) => void;
  onCancelAdd: () => void;
  onRemoveKeyword: (index: number) => void;
  onSidebarDrop: (recordId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  keywords,
  keywordRecordIds,
  isAddingKeyword,
  onShowAddForm,
  onAddKeyword,
  onCancelAdd,
  onRemoveKeyword,
  onSidebarDrop
}) => {
  const [{ isOverSidebar }, dropRef] = useDrop(() => ({
    accept: ITEM_TYPES.KEYWORD,
    drop: (item: ScheduleDragItem) => {
      if (item.isScheduled && item.recordId) {
        console.log('🎯 Scheduled item dropped on sidebar:', item.keyword);
        onSidebarDrop(item.recordId);
      }
    },
    collect: (monitor) => ({
      isOverSidebar: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={dropRef}
      className={`w-80 border-r border-dark-border p-6 bg-dark-card/30 transition-colors ${
        isOverSidebar ? 'bg-primary/10 ring-2 ring-primary/50' : ''
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-text-primary">Content Planner</h2>
        <button
          onClick={onShowAddForm}
          className="justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-9 px-3 py-2 flex items-center gap-2"
        >
          + Add New
        </button>
      </div>

      {isAddingKeyword ? (
        <AddKeywordForm
          onAdd={onAddKeyword}
          onCancel={onCancelAdd}
        />
      ) : (
        <p className="text-sm text-text-secondary mb-4">
          Drop scheduled items here to convert them back to drafts.
        </p>
      )}

      <div className="space-y-3">
        {keywords.map((keyword, index) => (
          <KeywordCard
            key={keywordRecordIds[index] || index}
            keyword={keyword}
            index={index}
            recordId={keywordRecordIds[index] || ''}
            onRemove={onRemoveKeyword}
          />
        ))}
      </div>

      {keywords.length === 0 && !isAddingKeyword && (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-dark-border rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-text-secondary text-sm mb-4">No content planned yet.</p>
          <p className="text-text-tertiary text-xs mb-4">
            Drag scheduled content here to revert to draft.
          </p>
          <button
            onClick={onShowAddForm}
            className="text-primary hover:text-primary-focus transition-colors text-sm"
          >
            Add your first content
          </button>
        </div>
      )}

      {isOverSidebar && (
        <div className="mt-4 p-3 bg-primary/20 border border-primary/50 rounded-lg text-center text-primary text-sm font-medium">
          🎯 Drop here to revert to draft
        </div>
      )}
    </div>
  );
};

const BlogScheduleViewContent: React.FC = () => {
  const { user } = useAuth();
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordRecordIds, setKeywordRecordIds] = useState<string[]>([]);
  const [scheduleItems, setScheduleItems] = useState<BlogScheduleItem[]>([]);
  const [isAddingKeyword, setIsAddingKeyword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<BlogScheduleItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Get today's date for highlighting
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Generate calendar dates for current month
  const getDaysInMonth = useCallback((month: number, year: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay()); // Start from Sunday

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }

    return days;
  }, []);

  const calendarDays = getDaysInMonth(currentMonth, currentYear);

  // Load schedule data and draft keywords
  const loadScheduleData = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Load all draft keywords (not assigned to any date)
      const { data: draftKeywords, error: draftError } = await supabase
        .from('blog_schedules')
        .select('*')
        .eq('user_id', user.id)
        .is('assigned_date', null)
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (draftError) throw draftError;

      // Load scheduled items for current month
      const { data: scheduledItems, error: scheduledError } = await supabase
        .from('blog_schedules')
        .select('*')
        .eq('user_id', user.id)
        .gte('assigned_date', new Date(currentYear, currentMonth, 1).toISOString().split('T')[0])
        .lte('assigned_date', new Date(currentYear, currentMonth + 1, 0).toISOString().split('T')[0])
        .order('assigned_date');

      if (scheduledError) throw scheduledError;

      const allData = [...(draftKeywords || []), ...(scheduledItems || [])];
      setScheduleItems(allData);

      // Extract draft keywords and their record IDs for sidebar display
      const draftItems = allData.filter(item => item.status === 'draft' && !item.assigned_date);
      const draftKeywordList = draftItems.map(item => item.keyword);
      const draftRecordIds = draftItems.map(item => item.id);

      setKeywords(draftKeywordList);
      setKeywordRecordIds(draftRecordIds);
    } catch (error) {
      console.error('Error loading schedule data:', error);
    } finally {
      setLoading(false);
    }
  }, [user, currentMonth, currentYear]);

  useEffect(() => {
    loadScheduleData();
  }, [user?.id, currentMonth, currentYear]);

  const handleAddKeyword = async (keyword: string) => {
    if (!user) return;

    const loweredKeyword = keyword.toLowerCase();
    // Check if keyword already exists (both in local state and database)
    const existingKeyword = keywords.some(k => k.toLowerCase() === loweredKeyword) ||
      scheduleItems.some(item => item.keyword.toLowerCase() === loweredKeyword && !item.assigned_date);

    if (!existingKeyword) {
      try {
        // Save to database as draft
        const { data, error } = await supabase
          .from('blog_schedules')
          .insert({
            user_id: user.id,
            keyword: keyword,
            status: 'draft',
            assigned_date: null,
            notes: null
          })
          .select()
          .single();

        if (error) throw error;

        // Add to local state
        setKeywords([keyword, ...keywords]);
        setKeywordRecordIds([data.id, ...keywordRecordIds]);
        setIsAddingKeyword(false);
      } catch (error) {
        console.error('Error saving keyword:', error);
        setIsAddingKeyword(false);
      }
    }
  };

  const handleRemoveKeyword = async (index: number) => {
    if (!user) return;

    const keyword = keywords[index];
    if (!keyword) return;

    try {
      // Find the draft record for this keyword
      const draftRecord = scheduleItems.find(
        item => item.keyword === keyword && item.status === 'draft' && !item.assigned_date
      );

      if (draftRecord) {
        // Delete from database
        const { error } = await supabase
          .from('blog_schedules')
          .delete()
          .eq('id', draftRecord.id)
          .eq('user_id', user.id);

        if (error) throw error;

        // Remove from local states
        setKeywords(keywords.filter((_, i) => i !== index));
        setScheduleItems(scheduleItems.filter(si => si.id !== draftRecord.id));
      } else {
        // Fallback - just remove from local state if database record not found
        setKeywords(keywords.filter((_, i) => i !== index));
      }
    } catch (error) {
      console.error('Error deleting keyword:', error);
    }
  };

  // Anahtar kelimeyi draft'a geri çevirme
  const handleRevertToDraft = async (recordId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blog_schedules')
        .update({
          assigned_date: null,
          status: 'draft',
          updated_at: new Date().toISOString()
        })
        .eq('id', recordId)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // State güncelleme: scheduled'den çıkarıp draft'a ekle
      setScheduleItems(scheduleItems.map(si =>
        si.id === recordId ? data : si
      ));

      // 🔧 DUPLICATE SORUNU ÇÖZÜLDÜ: Sadece olmayan keyword'leri ekle
      setKeywords(prevKeywords => {
        const loweredKeyword = data.keyword.toLowerCase();
        const exists = prevKeywords.some(k => k.toLowerCase() === loweredKeyword);
        return exists ? prevKeywords : [data.keyword, ...prevKeywords];
      });

      setKeywordRecordIds(prevIds => {
        const exists = prevIds.includes(data.id);
        return exists ? prevIds : [data.id, ...prevIds];
      });

      // 🔧 SAYFA YENİLEME SORUNU İÇİN: State güncellemesini zorunlu kıl
      setTimeout(() => {
        console.log('✅ Item reverted to draft:', data.keyword);
        // State güncellemesini garantile
        React.Component.prototype.forceUpdate?.();
      }, 100);

    } catch (error) {
      console.error('❌ Error reverting to draft:', error);
    }
  };

  const handleDropKeyword = async (keyword: string, date: Date) => {
    if (!user) return;

    const dateStr = date.toISOString().split('T')[0];
    console.log('🗓️ Dropping keyword:', keyword, 'to date:', dateStr);

    try {
      // Find the existing draft item
      const existingDraft = scheduleItems.find(
        item => item.keyword === keyword && item.status === 'draft' && !item.assigned_date
      );

      let updatedItem;

      if (existingDraft) {
        // Update existing draft record
        const { data, error } = await supabase
          .from('blog_schedules')
          .update({
            assigned_date: dateStr,
            status: 'scheduled',
            updated_at: new Date().toISOString()
          })
          .eq('id', existingDraft.id)
          .eq('user_id', user.id)
          .select()
          .single();

        if (error) throw error;
        updatedItem = data;

      } else {
        // Create new record (fallback for any edge case)
        const { data, error } = await supabase
          .from('blog_schedules')
          .insert({
            user_id: user.id,
            keyword: keyword,
            assigned_date: dateStr,
            status: 'scheduled'
          })
          .select()
          .single();

        if (error) throw error;
        updatedItem = data;
      }

      // 🔧 SENKRON STATE GÜNCELLEME: Anında UI güncellensin
      flushSync(() => {
        // 1. Schedule items'e ekle
        setScheduleItems(prev => [...prev, updatedItem]);

        // 2. Keywords'den kaldır
        setKeywords(prev => prev.filter(k => k !== keyword));
      });

      console.log('✅ Keyword scheduled successfully:', keyword);

    } catch (error) {
      console.error('❌ Error saving schedule item:', error);
    }
  };

  const handleUpdateItem = async (item: BlogScheduleItem, updates: Partial<BlogScheduleItem>) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('blog_schedules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      // Update local state
      setScheduleItems(scheduleItems.map(si => si.id === item.id ? data : si));
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (item: BlogScheduleItem) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('blog_schedules')
        .delete()
        .eq('id', item.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove from local state
      setScheduleItems(scheduleItems.filter(si => si.id !== item.id));

      // Add back to keywords if it was a draft
      if (item.status === 'draft') {
        setKeywords([item.keyword, ...keywords]);
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="h-full bg-dark-bg">
      <div className="flex h-full">
        <Sidebar
          keywords={keywords}
          keywordRecordIds={keywordRecordIds}
          isAddingKeyword={isAddingKeyword}
          onShowAddForm={() => setIsAddingKeyword(true)}
          onAddKeyword={handleAddKeyword}
          onCancelAdd={() => setIsAddingKeyword(false)}
          onRemoveKeyword={handleRemoveKeyword}
          onSidebarDrop={handleRevertToDraft}
        />

        {/* Calendar */}
        <div className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary mb-2">
              {new Intl.DateTimeFormat('en-US', {
                year: 'numeric',
                month: 'long'
              }).format(today)}
            </h1>
            <p className="text-text-secondary">
              Drag keywords from the sidebar onto dates to schedule content
            </p>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-4">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 text-center text-sm font-medium text-text-secondary">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((date, index) => {
              const isToday = date.toDateString() === today.toDateString();
              const itemsForDate = scheduleItems.filter(
                item => item.assigned_date === date.toISOString().split('T')[0]
              );

              return (
                <CalendarDay
                  key={index}
                  date={date}
                  isToday={isToday}
                  items={itemsForDate}
                  onDrop={handleDropKeyword}
                  onEdit={(item) => setEditingItem(item)}
                  onDelete={handleDeleteItem}
                  onDayClick={(date) => setSelectedDate(date)}
                />
              );
            })}
          </div>

          <div className="mt-6 p-4 bg-dark-card/50 rounded-lg">
            <h3 className="font-semibold text-text-primary mb-2">Legend</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-primary bg-primary/5 rounded"></div>
                <span className="text-text-secondary">Today</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-500/20 border border-green-500/30 rounded"></div>
                <span className="text-text-secondary">Scheduled Content</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 cursor-move bg-primary/20 border border-primary/30 rounded"></div>
                <span className="text-text-secondary">Draggable Keyword</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-card border border-dark-border rounded-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Edit Schedule Item</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Keyword
                </label>
                <input
                  type="text"
                  value={editingItem.keyword}
                  onChange={(e) => setEditingItem({ ...editingItem, keyword: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-text-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Status
                </label>
                <select
                  value={editingItem.status}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value as any })}
                  className="appearance-none bg-dark-card border border-dark-border rounded-lg px-4 py-2.5 pr-8 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all duration-200 min-w-[140px] hover:bg-dark-bg"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={editingItem.notes || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                  className="w-full bg-dark-bg border border-dark-border rounded px-3 py-2 text-text-primary"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => handleUpdateItem(editingItem, {
                  keyword: editingItem.keyword,
                  status: editingItem.status,
                  notes: editingItem.notes
                })}
                className="bg-primary hover:bg-primary-focus text-black px-4 py-2 rounded-lg transition-colors"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingItem(null)}
                className="bg-dark-border hover:bg-dark-bg text-text-secondary px-4 py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteItem(editingItem);
                  setEditingItem(null);
                }}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 px-4 py-2 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day View Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-card border border-dark-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-dark-border">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">
                  {new Intl.DateTimeFormat('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  }).format(selectedDate)}
                </h3>
                <button
                  onClick={() => setSelectedDate(null)}
                  className="text-text-tertiary hover:text-text-primary transition-colors text-2xl leading-none"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {(() => {
                const itemsForDate = scheduleItems.filter(
                  item => item.assigned_date === selectedDate.toISOString().split('T')[0]
                );

                if (itemsForDate.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-dark-border rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h4 className="text-lg font-semibold text-text-primary mb-2">No content scheduled</h4>
                      <p className="text-text-secondary">
                        Drag keywords from the sidebar onto this date to schedule content.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-text-primary">
                        Scheduled Content ({itemsForDate.length})
                      </h4>
                      <span className="text-xs text-text-tertiary bg-dark-border px-2 py-1 rounded">
                        Click items to edit
                      </span>
                    </div>

                    <div className="space-y-3">
                      {itemsForDate.map((item) => (
                        <div
                          key={item.id}
                          className="bg-dark-bg border border-dark-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer"
                          onClick={() => {
                            setSelectedDate(null);
                            setEditingItem(item);
                          }}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {item.notes && (
                                <span className="text-primary text-sm" title="Has notes">
                                  📎
                                </span>
                              )}
                              <h5 className="font-medium text-text-primary truncate">
                                {item.keyword}
                              </h5>
                            </div>
                            <span
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                item.status === 'published'
                                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                  : item.status === 'scheduled'
                                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                              }`}
                            >
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </span>
                          </div>

                          {item.notes && (
                            <p className="text-sm text-text-secondary mt-2 bg-dark-border/30 p-2 rounded">
                              {item.notes}
                            </p>
                          )}

                          <div className="text-xs text-text-tertiary mt-2">
                            Created {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }).format(new Date(item.created_at))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BlogScheduleView: React.FC = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <BlogScheduleViewContent />
    </DndProvider>
  );
};

export default BlogScheduleView;
