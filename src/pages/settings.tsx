/**
 * Shree Thaleshwor Mahadev Yuwa Samuh - Full Settings & Dashboard
 * Contains: Chat (for everyone), Monthly Report (for everyone),
 *           Users, Bulk Saving, Quarterly/Annual Reports (admin only)
 * Updated: January 2026 - Beginner friendly version
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
//                     TYPE DEFINITIONS
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

type Member = {
  id: string;
  name: string;
  // ... add other member fields if needed
};

// ─────────────────────────────────────────────────────────────
//                    MAIN COMPONENT
// ─────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { isAdmin, user } = useAuth();

  const [activeTab, setActiveTab] = useState('chat');

  // ── Shared loading state ──
  const [loading, setLoading] = useState(true);

  // ── Chat states ──
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);

  // ── Users states (admin only) ──
  const [settings, setSettings] = useState<Settings | null>(null);
  const [newUser, setNewUser] = useState({
    userId: '',
    name: '',
    password: '',
    role: 'Viewer' as 'Admin' | 'Viewer',
  });

  // ── Bulk saving states (admin only) ──
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().split('T')[0]);

  // ── Monthly report states (everyone) ──
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [monthlySummary, setMonthlySummary] = useState<any>(null);
  const [loadingMonthly, setLoadingMonthly] = useState(false);

  // ── Quarterly/Annual states (admin only) ──
  const [reportYear, setReportYear] = useState(new Date().getFullYear());

  // ─────────────────────────────────────────────────────────────
  //                          EFFECTS
  // ─────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      await Promise.all([
        isAdmin ? loadSettings() : Promise.resolve(),
        activeTab === 'chat' ? loadMessages() : Promise.resolve(),
      ]);
      setLoading(false);
    };
    init();
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (activeTab === 'monthly-reports') {
      loadMonthlySummary();
    }
  }, [activeTab, selectedMonth]);

  // ─────────────────────────────────────────────────────────────
  //                        DATA FUNCTIONS
  // ─────────────────────────────────────────────────────────────

  const loadSettings = async () => {
    try {
      const data = await readFile<Settings>('data/settings.json');
      setSettings(data || { users: [] });
    } catch (err) {
      toast.error('Failed to load users');
    }
  };

  const loadMessages = async () => {
    setLoadingMessages(true);
    try {
      const data = await readFile<any[]>('data/chat-messages.json');
      const loaded = data || [];
      loaded.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setMessages(loaded);
    } catch {
      setMessages([]);
    } finally {
      setLoadingMessages(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return toast.error('Write something first');
    if (!user?.userId) return toast.error('Please login');

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
      loadMessages();
      toast.success('Sent!');
    } catch {
      toast.error('Failed to send');
    }
  };

  const addUser = async () => {
    if (!newUser.userId || !newUser.name || !newUser.password) {
      return toast.error('Fill all fields');
    }

    try {
      const current = settings || { users: [] };
      if (current.users.some(u => u.userId === newUser.userId)) {
        return toast.error('User ID already exists');
      }

      const hashed = await hashPassword(newUser.password);
      const updated = {
        ...current,
        users: [...current.users, { ...newUser, password: hashed }],
      };

      await writeFile('data/settings.json', updated);
      setSettings(updated);
      setNewUser({ userId: '', name: '', password: '', role: 'Viewer' });
      toast.success('User added');
    } catch {
      toast.error('Failed to add user');
    }
  };

  const loadMonthlySummary = async () => {
    setLoadingMonthly(true);
    try {
      // Very simple placeholder summary - extend as needed
      const members = (await readFile<Member[]>('data/members.json')) || [];
      const summary = {
        month: selectedMonth,
        totalMembers: members.length,
        message: 'Monthly summary will be here...',
      };
      setMonthlySummary(summary);
    } catch {
      setMonthlySummary(null);
    } finally {
      setLoadingMonthly(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  //                           RENDER
  // ─────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-xl">Loading...</div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container mx-auto px-4 py-6 max-w-6xl">
          <h1 className="text-3xl font-bold text-center mb-8 text-blue-800">
            Shree Thaleshwor Mahadev Yuwa Samuh
          </h1>

          {/* ── TABS ── */}
          <div className="flex flex-wrap gap-2 justify-center mb-8 border-b pb-4">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-5 py-2.5 rounded font-medium ${
                activeTab === 'chat' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              <MessageSquare size={18} className="inline mr-2" />
              Chat
            </button>

            <button
              onClick={() => setActiveTab('monthly-reports')}
              className={`px-5 py-2.5 rounded font-medium ${
                activeTab === 'monthly-reports' ? 'bg-blue-600 text-white' : 'bg-gray-200'
              }`}
            >
              <FileText size={18} className="inline mr-2" />
              Monthly
            </button>

            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-5 py-2.5 rounded font-medium ${
                    activeTab === 'users' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  <UserPlus size={18} className="inline mr-2" />
                  Users
                </button>

                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`px-5 py-2.5 rounded font-medium ${
                    activeTab === 'bulk' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  <Upload size={18} className="inline mr-2" />
                  Bulk Saving
                </button>

                <button
                  onClick={() => setActiveTab('reports')}
                  className={`px-5 py-2.5 rounded font-medium ${
                    activeTab === 'reports' ? 'bg-blue-600 text-white' : 'bg-gray-200'
                  }`}
                >
                  <FileText size={18} className="inline mr-2" />
                  Quarterly / Annual
                </button>
              </>
            )}
          </div>

          {/* ── CONTENT ── */}

          {activeTab === 'chat' && (
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-blue-600 text-white p-5">
                <h2 className="text-xl font-bold">Group Chat</h2>
                <p>All logged-in members can write & see messages</p>
              </div>

              <div className="h-[60vh] overflow-y-auto p-5 space-y-4 bg-gray-50">
                {loadingMessages ? (
                  <p className="text-center py-10">Loading...</p>
                ) : messages.length === 0 ? (
                  <p className="text-center py-10 text-gray-500">No messages yet</p>
                ) : (
                  messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.userId === user?.userId ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl p-4 ${
                          msg.userId === user?.userId
                            ? 'bg-blue-500 text-white'
                            : 'bg-white border'
                        }`}
                      >
                        <div className="text-xs opacity-70 mb-1">
                          {msg.username} • {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <textarea
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    placeholder="Type message..."
                    className="flex-1 border rounded p-3 resize-none"
                    rows={2}
                  />
                  <button
                    onClick={sendMessage}
                    className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Send
                  </button>
                </div>
                <button onClick={loadMessages} className="mt-2 text-blue-600 text-sm">
                  Refresh
                </button>
              </div>
            </div>
          )}

          {activeTab === 'monthly-reports' && (
            <div className="bg-white p-8 rounded-xl shadow">
              <h2 className="text-2xl font-bold mb-6">Monthly Report</h2>

              <div className="max-w-xs mb-6">
                <label className="block mb-2 font-medium">Select Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full p-2 border rounded"
                />
              </div>

              {loadingMonthly ? (
                <p>Loading...</p>
              ) : monthlySummary ? (
                <div className="bg-gray-50 p-6 rounded">
                  <h3 className="text-xl mb-4">{monthlySummary.month}</h3>
                  <p>Total members: {monthlySummary.totalMembers}</p>
                  <p className="mt-2 text-gray-600">{monthlySummary.message}</p>
                </div>
              ) : (
                <p>No data available for this month</p>
              )}
            </div>
          )}

          {isAdmin && activeTab === 'users' && (
            <div className="bg-white p-8 rounded-xl shadow">
              <h2 className="text-2xl font-bold mb-6">Manage Users</h2>

              <div className="max-w-md">
                <h3 className="font-medium mb-4">Add New User</h3>
                <input
                  type="text"
                  placeholder="User ID"
                  value={newUser.userId}
                  onChange={e => setNewUser({ ...newUser, userId: e.target.value })}
                  className="w-full p-2 mb-3 border rounded"
                />
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newUser.name}
                  onChange={e => setNewUser({ ...newUser, name: e.target.value })}
                  className="w-full p-2 mb-3 border rounded"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={newUser.password}
                  onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  className="w-full p-2 mb-3 border rounded"
                />
                <select
                  value={newUser.role}
                  onChange={e => setNewUser({ ...newUser, role: e.target.value as 'Admin' | 'Viewer' })}
                  className="w-full p-2 mb-4 border rounded"
                >
                  <option value="Viewer">Viewer</option>
                  <option value="Admin">Admin</option>
                </select>
                <button
                  onClick={addUser}
                  className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700"
                >
                  Add User
                </button>
              </div>

              <div className="mt-10">
                <h3 className="font-medium mb-4">Existing Users</h3>
                {settings?.users?.length ? (
                  <ul className="space-y-2">
                    {settings.users.map(u => (
                      <li key={u.userId} className="p-3 bg-gray-50 rounded">
                        {u.name} ({u.userId}) - {u.role}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No users yet</p>
                )}
              </div>
            </div>
          )}

          {isAdmin && activeTab === 'bulk' && (
            <div className="bg-white p-8 rounded-xl shadow">
              <h2 className="text-2xl font-bold mb-6">Bulk Saving</h2>
              <p className="text-gray-600 mb-6">
                (Add your bulk saving logic here)
              </p>
              <div className="max-w-sm">
                <input
                  type="number"
                  placeholder="Amount per member"
                  value={bulkAmount}
                  onChange={e => setBulkAmount(e.target.value)}
                  className="w-full p-2 border rounded mb-3"
                />
                <input
                  type="date"
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="w-full p-2 border rounded mb-4"
                />
                <button className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700">
                  Apply to All
                </button>
              </div>
            </div>
          )}

          {isAdmin && activeTab === 'reports' && (
            <div className="bg-white p-8 rounded-xl shadow">
              <h2 className="text-2xl font-bold mb-6">Quarterly / Annual Reports</h2>
              <div className="max-w-xs">
                <label className="block mb-2 font-medium">Select Year</label>
                <input
                  type="number"
                  value={reportYear}
                  onChange={e => setReportYear(Number(e.target.value))}
                  className="w-full p-2 border rounded mb-4"
                />
                <div className="grid grid-cols-2 gap-3">
                  <button className="bg-blue-600 text-white py-2 rounded">Q1</button>
                  <button className="bg-blue-600 text-white py-2 rounded">Q2</button>
                  <button className="bg-blue-600 text-white py-2 rounded">Q3</button>
                  <button className="bg-blue-600 text-white py-2 rounded">Q4</button>
                  <button className="bg-green-600 text-white py-2 rounded col-span-2">
                    Full Year
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
