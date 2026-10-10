import { useState } from 'react';
import { CalendarSync, ListTodo, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RemindersList } from '@ebarooni/capacitor-calendar';

interface AppleRemindersButtonProps {
  supported: boolean;
  connected: boolean;
  listTitle: string | null;
  selectedListId: string;
  lists: RemindersList[];
  loading: boolean;
  syncing: boolean;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
  error: string | null;
  openListPicker: () => Promise<void>;
  chooseList: (list: RemindersList) => Promise<boolean>;
  syncNow: () => Promise<boolean>;
}

export function AppleRemindersButton(props: AppleRemindersButtonProps) {
  const [selectedListId, setSelectedListId] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePickList = async (id: string) => {
    setSelectedListId(id);
    const list = props.lists.find(item => item.id === id);
    if (!list) return;
    setSaving(true);
    try {
      await props.chooseList(list);
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    if (props.syncing) return;
    setSaving(true);
    try {
      await props.syncNow();
    } finally {
      setSaving(false);
    }
  };

  if (!props.supported) {
    return <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Apple Reminders works in the iPhone and iPad app</p>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-2 py-1">
        <CalendarSync className="h-3.5 w-3.5 text-[hsl(var(--status-completed))]" />
        <span className="text-[11px] font-mono text-sidebar-foreground truncate">
          {props.connected ? `Reminders · ${props.listTitle}` : 'Apple Reminders not linked'}
        </span>
      </div>
      {props.connected ? (
        <>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-[11px]" disabled={saving || props.loading} onClick={handleSync}>
            <RefreshCw className={`h-3.5 w-3.5 ${saving || props.syncing ? 'animate-spin' : ''}`} />
            {saving || props.syncing ? 'Syncing…' : 'Sync tasks now'}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-[11px]" disabled={props.loading} onClick={() => { setSelectedListId(props.selectedListId); void props.openListPicker(); }}>
            <ListTodo className="h-3.5 w-3.5" /> Change Reminders list
          </Button>
        </>
      ) : (
        <Button type="button" variant="ghost" size="sm" className="h-8 w-full justify-start gap-2 px-2 text-[11px]" disabled={props.loading} onClick={() => { setSelectedListId(''); void props.openListPicker(); }}>
          <CalendarSync className="h-3.5 w-3.5" /> Link Apple Reminders
        </Button>
      )}
      {props.error && <p className="px-2 text-[11px] text-destructive">{props.error}</p>}

      <Dialog open={props.dialogOpen} onOpenChange={props.setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose a Reminders list</DialogTitle>
            <DialogDescription>PTT will sync its regular tasks with the list you select.</DialogDescription>
          </DialogHeader>
          <Select value={selectedListId} onValueChange={id => { void handlePickList(id); }}>
            <SelectTrigger aria-label="Apple Reminders list">
              <SelectValue placeholder={props.loading ? 'Loading lists…' : 'Select a list'} />
            </SelectTrigger>
            <SelectContent>
              {props.lists.map(list => (
                <SelectItem key={list.id} value={list.id}>{list.title ?? 'Untitled list'}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {props.error && <p className="text-sm text-destructive">{props.error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => props.setDialogOpen(false)}>Cancel</Button>
            <Button type="button" disabled={!selectedListId || saving || props.loading} onClick={() => { void handlePickList(selectedListId); }}>
              {saving ? 'Linking…' : 'Link selected list'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}