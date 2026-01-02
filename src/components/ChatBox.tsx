import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

type Message = {
  id: string;
  sender: string;
  text: string;
  attachment?: {
    name: string;
    url: string;
    type?: string;
  } | null;
  timestamp: string;
  edited?: boolean;
};

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const { user, isAdmin } = useAuth();

  useEffect(() => {
    loadMessages();
    // poll for new messages every 5 seconds
    const id = setInterval(loadMessages, 5000);
    return () => clearInterval(id);
  }, []);

  const loadMessages = async () => {
    try {
      const res = await fetch('/api/chat/get');
      if (!res.ok) throw new Error('Failed to load messages');
      const data: Message[] = await res.json();
      setMessages(data);
      // mark messages as seen for current user
      try {
        const token = localStorage.getItem('token');
        if (token) {
          await fetch('/api/chat/seen', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          });
        }
      } catch (e) {
        console.error('Mark seen failed', e);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // auto-scroll when messages change
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const payload: any = { text: text.trim() };
    // include attachment if present and user is admin
    if (isAdmin && selectedFile) {
      payload.attachment = selectedFilePayload;
    }
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Send failed');
      const newMsg: Message = await res.json();
      setMessages(prev => [...prev, newMsg]);
      setText('');
      // focus input after send
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Attachment handling (admin only)
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [selectedFilePayload, setSelectedFilePayload] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const onFileChange = (f: File | null) => {
    if (!f) {
      setSelectedFile(null);
      setSelectedFileName(null);
      setSelectedFilePayload(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:<mime>;base64,<data>
      const base64 = result.split(',')[1];
      setSelectedFilePayload({ name: f.name, data: base64, type: f.type });
      setSelectedFileName(f.name);
      setSelectedFile(f);
    };
    reader.readAsDataURL(f);
  };

  const startEdit = (m: Message) => {
    setEditingId(m.id);
    setEditingText(m.text);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editingText.trim()) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id: editingId, text: editingText.trim() }),
      });
      if (!res.ok) throw new Error('Edit failed');
      const updated: Message = await res.json();
      setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
      cancelEdit();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteMessage = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/chat/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      setMessages(prev => prev.filter(m => m.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-2xl w-full mx-auto bg-white rounded-lg shadow p-4">
      <div ref={containerRef} className="h-72 overflow-y-auto mb-4 space-y-3 p-2 border rounded">
        {messages.length === 0 && <div className="text-sm text-gray-500">No messages</div>}
        {messages.map(m => {
          const isOwn = user ? m.sender === user.userId : false;
          const editing = editingId === m.id;
          return (
            <div key={m.id} className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
              <div className="text-xs text-gray-400">{new Date(m.timestamp).toLocaleString()}{m.edited ? ' • edited' : ''}</div>
              {editing ? (
                <div className="mt-1 inline-block max-w-full">
                  <input className="border rounded px-2 py-1 w-full" value={editingText} onChange={e => setEditingText(e.target.value)} />
                  <div className="mt-1 flex gap-2">
                    <button onClick={saveEdit} className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
                    <button onClick={cancelEdit} className="bg-gray-300 px-3 py-1 rounded">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className={`mt-1 px-3 py-2 rounded-md inline-block max-w-full ${isOwn ? 'bg-indigo-50 text-right' : 'bg-gray-100'}`}>
                  {!isOwn && <div className="text-sm font-medium">{m.sender}</div>}
                  <div className="text-sm">{m.text}</div>
                  {(isOwn || isAdmin) && (
                    <div className="mt-1 text-xs flex gap-2 justify-end">
                      {isOwn && <button onClick={() => startEdit(m)} className="text-indigo-600">Edit</button>}
                      <button onClick={() => deleteMessage(m.id)} className="text-red-600">Delete</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
          className="flex-1 border rounded px-3 py-2"
          placeholder="Type a message..."
        />
        {isAdmin && (
          <label className="flex items-center gap-2">
            <input
              type="file"
              onChange={e => onFileChange(e.target.files ? e.target.files[0] : null)}
              className="hidden"
            />
            <div className="text-sm text-gray-600">{selectedFileName || 'Attach'}</div>
          </label>
        )}
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-indigo-600 text-white px-4 py-2 rounded disabled:opacity-60"
        >
          Send
        </button>
      </div>
    </div>
  );
}
