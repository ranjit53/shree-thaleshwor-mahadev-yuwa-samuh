/**
 * Shree Thaleshwor Mahadev Yuwa Samuh - Complete Dashboard
 * Chat (all users) + Monthly Report (all) + Admin features
 * Fixed TypeScript error on chat sorting
 * Last updated: January 2026
 */

import { useState, useEffect } from 'react';
import { readFile, writeFile, listFiles } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import {
  MessageSquare,
  Users,
  Upload,
  Download,
  RotateCcw,
  FileText,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────
//                          TYPES
// ─────────────────────────────────────────────────────────────

type User = {
  userId: string;
  name: string;
  password: string;
  role: 'Admin' | 'Viewer';
};

type Settings = {
  users: User[];
};

type Member = any; // ← extend later if needed

// ─────────────────────────────────────────────────────────────
//                   MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin, user } = useAuth();

  const [activeTab, setActiveTab] = useState('chat');
  const [loading, setLoading] = useState(true);

  // ── Chat ──
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Users (admin) ──
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newUserForm, setNewUserForm] = useState({
    userId: '',
    name: '',
    password: '',
    role: 'Viewer' as 'Admin' | 'Viewer',
  });

  // ── Bulk Saving (admin) ──
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Backup / Restore (admin) ──
  const [backups, setBackups] = useState<string[]>([]);

  // ── Monthly Report (everyone) ──
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlyData, setMonthlyData] = useState<any>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // ── Quarterly / Annual (admin) ──
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // ─────────────────────────────────────────────────────────────
  //                          EFFECTS
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      if (isAdmin) {
        await Promise.all([loadSettings(), loadBackups()]);
      }
      setLoading(false);
    };
    init();
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'chat') loadChatMessages();
    if (activeTab === 'monthly-reports') loadMonthlyData();
  }, [activeTab, selectedMonth]);

  // ─────────────────────────────────────────────────────────────
  //                        CHAT FUNCTIONS
  // ─────────────────────────────────────────────────────────────

  const loadChatMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await readFile<any[]>('data/chat-messages.json');
      const loaded = data || [];
      // Fixed: use getTime() to avoid TS error
      loaded.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setMessages(loaded);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendChatMessage = async () => {
    if (!newMessage.trim()) return toast.error('Please write something');
    if (!user?.userId) return toast.error('You must be logged in');

    const msg = {
      id: `msg_${Date.now()}`,
      userId: user.userId,
      username: user.name || 'Member',
      text: newMessage.trim(),
      timestamp: new Date().toISOString(),
    };

    try {
      const old = (await readFile<any[]>('data/chat-messages.json')) || [];
      await writeFile('data/chat-messages.json', [msg, ...old]);
      setNewMessage('');
      loadChatMessages();
      toast.success('Message sent');
    } catch {
      toast.error('Could not send message');
    }
  };

  // ─────────────────────────────────────────────────────────────
  //                     ADMIN FUNCTIONS
  // ─────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    try {
      const data = await readFile<Settings>('data/settings.json');
      setSettings(data || { users: [] });
    } catch {
      toast.error('Failed to load settings');
    }
  };

  const addUser = async () => {
    if (!newUserForm.userId || !newUserForm.name || !newUserForm.password) {
      return toast.error('All fields required');
    }

    try {
      const current = settings || { users: [] };
      if (current.users.some(u => u.userId === newUserForm.userId)) {
        return toast.error('User ID already exists');
      }

      const hashed = await hashPassword(newUserForm.password);
      const updated = {
        ...current,
        users: [...current.users, { ...newUserForm, password: hashed }],
      };

      await writeFile('data/settings.json', updated);
      setSettings(updated);
      setNewUserForm({ userId: '', name: '', password: '', role: 'Viewer' });
      toast.success('User added');
    } catch {
      toast.error('Failed to add user');
    }
  };

  const loadBackups = async () => {
    try {
      const files = await listFiles('backups');
      setBackups(files.filter(f => f.endsWith('.json')));
    } catch {
      toast.error('Failed to load backups');
    }
  };

  const createBackup = async () => {
    // Placeholder - implement your full backup logic here
    toast.success('Backup created (placeholder)');
  };

  // ─────────────────────────────────────────────────────────────
  //                  MONTHLY REPORT (simple placeholder)
  // ─────────────────────────────────────────────────────────────

  const loadMonthlyData = async () => {
    setLoadingMonthly(true);
    try {
      const members = (await readFile<Member[]>('data/members.json')) || [];
      setMonthlyData({
        month: selectedMonth,
        totalMembers: members.length,
        note: 'Extend this section with real savings/loans data later',
      });
    } catch {
      setMonthlyData(null);
    } finally {
      setLoadingMonthly(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  //                           RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) return <div className="p-10 text-center">Loading...</div>;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <h1 className="text-3xl md:text-4xl font-bold text-center mb-10 text-blue-800">
            Shree Thaleshwor Mahadev Yuwa Samuh
          </h1>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 md:gap-3 justify-center mb-10 border-b pb-4 overflow-x-auto">
            <TabButton active={activeTab === 'chat'} onClick={() => setActiveTab('chat')}>
              <MessageSquare size={18} /> Chat
            </TabButton>

            <TabButton active={activeTab === 'monthly-reports'} onClick={() => setActiveTab('monthly-reports')}>
              <FileText size={18} /> Monthly
            </TabButton>

            {isAdmin && (
              <>
                <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')}>
                  <UserPlus size={18} /> Users
                </TabButton>

                <TabButton active={activeTab === 'bulk'} onClick={() => setActiveTab('bulk')}>
                  <Upload size={18} /> Bulk Saving
                </TabButton>

                <TabButton active={activeTab === 'backup'} onClick={() => setActiveTab('backup')}>
                  <Download size={18} /> Backup
                </TabButton>

                <TabButton active={activeTab === 'quarterly'} onClick={() => setActiveTab('quarterly')}>
                  <FileText size={18} /> Quarterly/Annual
                </TabButton>
              </>
            )}
          </div>

          {/* ── Chat (Everyone) ── */}
          {activeTab === 'chat' && (
            <ChatSection
              messages={messages}
              loading={loadingMessages}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              sendMessage={sendChatMessage}
              currentUserId={user?.userId}
              refresh={loadChatMessages}
            />
          )}

          {/* ── Monthly Report (Everyone) ── */}
          {activeTab === 'monthly-reports' && (
            <div className="bg-white p-8 rounded-xl shadow">
              <h2 className="text-2xl font-bold mb-6">Monthly Report</h2>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="border p-2 rounded mb-6"
              />

              {loadingMonthly ? (
                <p>Loading...</p>
              ) : monthlyData ? (
                <div className="bg-gray-50 p-6 rounded">
                  <h3 className="text-xl mb-4">{monthlyData.month}</h3>
                  <p className="mb-2">Total members: <strong>{monthlyData.totalMembers}</strong></p>
                  <p className="text-gray-600">{monthlyData.note}</p>
                </div>
              ) : (
                <p>No data available</p>
              )}
            </div>
          )}

          {/* ── Admin Only Tabs ── */}
          {isAdmin && (
            <>
              {activeTab === 'users' && <UsersSection form={newUserForm} setForm={setNewUserForm} addUser={addUser} settings={settings} />}
              {activeTab === 'bulk' && <BulkSavingSection amount={bulkAmount} setAmount={setBulkAmount} date={bulkDate} setDate={setBulkDate} />}
              {activeTab === 'backup' && <BackupSection backups={backups} createBackup={createBackup} />}
              {activeTab === 'quarterly' && <QuarterlySection year={reportYear} setYear={setReportYear} />}
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

// ─────────────────────────────────────────────────────────────
//                     HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────

function TabButton({ active, children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-4 md:px-6 py-2.5 rounded-lg font-medium text-sm md:text-base transition-all ${
        active ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'
      }`}
    >
      {children}
    </button>
  );
}

function ChatSection({ messages, loading, newMessage, setNewMessage, sendMessage, currentUserId, refresh }: any) {
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden border">
      <div className="bg-blue-600 text-white p-5">
        <h2 className="text-xl font-bold">Group Chat</h2>
        <p className="text-sm opacity-90">Everyone can write & read</p>
      </div>

      <div className="h-[55vh] md:h-[65vh] overflow-y-auto p-4 md:p-6 space-y-4 bg-gray-50">
        {loading ? (
          <p className="text-center py-12">Loading messages...</p>
        ) : messages.length === 0 ? (
          <p className="text-center py-12 text-gray-500">No messages yet. Be first!</p>
        ) : (
          messages.map((msg: any) => (
            <div key={msg.id} className={`flex ${msg.userId === currentUserId ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-sm ${
                  msg.userId === currentUserId ? 'bg-blue-500 text-white' : 'bg-white border'
                }`}
              >
                <div className="text-xs opacity-75 mb-1">
                  {msg.username} • {new Date(msg.timestamp).toLocaleString()}
                </div>
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t bg-white">
        <div className="flex gap-3">
          <textarea
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 border rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
          />
          <button
            onClick={sendMessage}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            disabled={!newMessage.trim()}
          >
            Send
          </button>
        </div>
        <button onClick={refresh} className="mt-3 text-blue-600 text-sm hover:underline">
          ↻ Refresh messages
        </button>
      </div>
    </div>
  );
}

function UsersSection({ form, setForm, addUser, settings }: any) {
  return (
    <div className="bg-white p-8 rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-6">Manage Users (Admin)</h2>

      <div className="max-w-md">
        <h3 className="font-medium mb-4">Add New User</h3>
        <input placeholder="User ID" value={form.userId} onChange={e => setForm({ ...form, userId: e.target.value })} className="w-full p-2 mb-3 border rounded" />
        <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full p-2 mb-3 border rounded" />
        <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full p-2 mb-3 border rounded" />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full p-2 mb-4 border rounded">
          <option value="Viewer">Viewer</option>
          <option value="Admin">Admin</option>
        </select>
        <button onClick={addUser} className="bg-green-600 text-white px-6 py-2.5 rounded hover:bg-green-700">
          Add User
        </button>
      </div>

      <div className="mt-10">
        <h3 className="font-medium mb-4">Current Users</h3>
        {settings?.users?.length > 0 ? (
          <div className="space-y-3">
            {settings.users.map((u: any) => (
              <div key={u.userId} className="p-3 bg-gray-50 rounded flex justify-between">
                <div>
                  <span className="font-medium">{u.name}</span> ({u.userId}) - {u.role}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No users yet</p>
        )}
      </div>
    </div>
  );
}

function BulkSavingSection({ amount, setAmount, date, setDate }: any) {
  return (
    <div className="bg-white p-8 rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-6">Bulk Fixed Saving (Admin)</h2>
      <div className="max-w-md">
        <input
          type="number"
          placeholder="Amount per member"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full p-2 mb-3 border rounded"
        />
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="w-full p-2 mb-4 border rounded"
        />
        <button className="bg-green-600 text-white px-8 py-3 rounded hover:bg-green-700 w-full">
          Apply to Selected Members
        </button>
      </div>
    </div>
  );
}

function BackupSection({ backups, createBackup }: any) {
  return (
    <div className="bg-white p-8 rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-6">Backup & Restore (Admin)</h2>
      <button
        onClick={createBackup}
        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 mb-6"
      >
        Create New Backup
      </button>

      <h3 className="font-medium mb-3">Existing Backups</h3>
      {backups.length > 0 ? (
        <ul className="space-y-2">
          {backups.map((file: string) => (
            <li key={file} className="p-3 bg-gray-50 rounded flex justify-between items-center">
              <span>{file}</span>
              <button className="text-sm text-blue-600 hover:underline">Download</button>
            </li>
          ))}
        </ul>
      ) : (
        <p>No backups yet</p>
      )}
    </div>
  );
}

function QuarterlySection({ year, setYear }: any) {
  return (
    <div className="bg-white p-8 rounded-xl shadow">
      <h2 className="text-2xl font-bold mb-6">Quarterly & Annual Reports (Admin)</h2>
      <div className="max-w-xs">
        <label className="block mb-2 font-medium">Year</label>
        <input
          type="number"
          value={year}
          onChange={e => setYear(Number(e.target.value))}
          className="w-full p-2 border rounded mb-6"
        />
        <div className="grid grid-cols-2 gap-4">
          {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
            <button key={q} className="bg-blue-600 text-white py-3 rounded hover:bg-blue-700">
              {q}
            </button>
          ))}
          <button className="col-span-2 bg-green-600 text-white py-3 rounded hover:bg-green-700">
            Full Year Report
          </button>
        </div>
      </div>
    </div>
  );
}
