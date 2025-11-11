/**
 * Settings page - User management, Bulk saving, Backup/Restore
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile, writeFile, listFiles } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import type { Settings, Member, Saving } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { UserPlus, Upload, Download, RotateCcw, Save } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'bulk' | 'backup'>('users');
  const [backups, setBackups] = useState<string[]>([]);
  const { isAdmin } = useAuth();

  const [userForm, setUserForm] = useState({
    userId: '',
    name: '',
    password: '',
    role: 'Viewer' as 'Admin' | 'Viewer',
  });

  const [bulkData, setBulkData] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      loadBackups();
    }
  }, [isAdmin]);

  const loadSettings = async () => {
    try {
      const data = await readFile<Settings>('data/settings.json');
      setSettings(data || { users: [] });
    } catch (error: any) {
      toast.error('Failed to load settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadBackups = async () => {
    try {
      const files = await listFiles('backups');
      setBackups(files.filter(f => f.endsWith('.json')));
    } catch (error: any) {
      console.error('Failed to load backups:', error);
    }
  };
  
  const downloadBackup = async (backupPath: string) => {
    try {
      // Reuse readFile to fetch JSON content via backend API
      const data = await readFile<any>(backupPath);
      if (!data) {
        toast.error('Failed to read backup content');
        return;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const namePart = backupPath.split('/').pop() || 'backup.json';
      a.download = namePart;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast.error('Failed to download backup: ' + (error.message || 'Unknown error'));
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can add users');
      return;
    }

    try {
      const currentSettings = settings || { users: [] };
      
      if (currentSettings.users.find(u => u.userId === userForm.userId)) {
        toast.error('User ID already exists');
        return;
      }

      const hashedPassword = await hashPassword(userForm.password);
      const updatedUsers = [
        ...currentSettings.users,
        {
          userId: userForm.userId,
          name: userForm.name,
          password: hashedPassword,
          role: userForm.role,
        },
      ];

      const updatedSettings: Settings = {
        ...currentSettings,
        users: updatedUsers,
      };

      await writeFile('data/settings.json', updatedSettings);
      setSettings(updatedSettings);
      setUserForm({
        userId: '',
        name: '',
        password: '',
        role: 'Viewer',
      });
      toast.success('User added successfully');
    } catch (error: any) {
      toast.error('Failed to add user: ' + error.message);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!isAdmin) {
      toast.error('Only admins can delete users');
      return;
    }

    if (!confirm(`Are you sure you want to delete user ${userId}?`)) {
      return;
    }

    try {
      const currentSettings = settings || { users: [] };
      const updatedUsers = currentSettings.users.filter(u => u.userId !== userId);
      const updatedSettings: Settings = {
        ...currentSettings,
        users: updatedUsers,
      };

      await writeFile('data/settings.json', updatedSettings);
      setSettings(updatedSettings);
      toast.success('User deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete user: ' + error.message);
    }
  };

  const handleBulkSaving = async () => {
    if (!isAdmin) {
      toast.error('Only admins can perform bulk operations');
      return;
    }

    try {
      // Parse CSV or JSON
      let records: Array<{ memberId: string; amount: number; date: string }> = [];
      
      if (bulkData.trim().startsWith('[')) {
        // JSON format
        records = JSON.parse(bulkData);
      } else {
        // CSV format
        const lines = bulkData.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const memberIdIndex = headers.findIndex(h => h.includes('member') || h.includes('id'));
        const amountIndex = headers.findIndex(h => h.includes('amount'));
        const dateIndex = headers.findIndex(h => h.includes('date'));

        if (memberIdIndex === -1 || amountIndex === -1 || dateIndex === -1) {
          toast.error('CSV must have columns: MemberId, Amount, Date');
          return;
        }

        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          records.push({
            memberId: values[memberIdIndex].trim(),
            amount: parseFloat(values[amountIndex].trim()),
            date: values[dateIndex].trim() || `${selectedMonth}-01`,
          });
        }
      }

      // Validate members exist
      const members = await readFile<Member[]>('data/members.json') || [];
      const memberIds = new Set(members.map(m => m.id));
      const invalidRecords = records.filter(r => !memberIds.has(r.memberId));
      
      if (invalidRecords.length > 0) {
        toast.error(`Invalid member IDs found: ${invalidRecords.map(r => r.memberId).join(', ')}`);
        return;
      }

      // Load existing savings
      const existingSavings = await readFile<Saving[]>('data/savings.json') || [];
      
      // Add new savings
      const newSavings = records.map(record => ({
        id: `S-${Date.now()}-${Math.random()}`,
        memberId: record.memberId,
        amount: record.amount,
        date: record.date,
        remarks: 'Bulk import',
      }));

      const updatedSavings = [...existingSavings, ...newSavings];
      await writeFile('data/savings.json', updatedSavings);
      
      toast.success(`Successfully imported ${newSavings.length} saving records`);
      setBulkData('');
    } catch (error: any) {
      toast.error('Failed to import bulk savings: ' + error.message);
    }
  };

  const handleBackup = async () => {
    if (!isAdmin) {
      toast.error('Only admins can create backups');
      return;
    }

    try {
      const [members, savings, loans, payments, settingsData] = await Promise.all([
        readFile('data/members.json'),
        readFile('data/savings.json'),
        readFile('data/loans.json'),
        readFile('data/payments.json'),
        readFile('data/settings.json'),
      ]);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupData = {
        timestamp,
        members: members || [],
        savings: savings || [],
        loans: loans || [],
        payments: payments || [],
        settings: settingsData || { users: [] },
      };

      const filename = `backups/backup-${timestamp}.json`;
      await writeFile(filename, backupData);
      
      toast.success('Backup created successfully');
      loadBackups();
    } catch (error: any) {
      toast.error('Failed to create backup: ' + error.message);
    }
  };

  const handleRestore = async (backupPath: string) => {
    if (!isAdmin) {
      toast.error('Only admins can restore backups');
      return;
    }

    if (!confirm('Are you sure you want to restore from this backup? This will overwrite all current data.')) {
      return;
    }

    try {
      const backupData = await readFile<any>(backupPath);
      
      if (!backupData) {
        toast.error('Backup file not found');
        return;
      }

      // Restore all data files
      await Promise.all([
        writeFile('data/members.json', backupData.members || []),
        writeFile('data/savings.json', backupData.savings || []),
        writeFile('data/loans.json', backupData.loans || []),
        writeFile('data/payments.json', backupData.payments || []),
        writeFile('data/settings.json', backupData.settings || { users: [] }),
      ]);

      toast.success('Data restored successfully');
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to restore backup: ' + error.message);
    }
  };
  
  // Restore from already-parsed backup object (used for uploaded file)
  const handleRestoreFromObject = async (backupData: any) => {
    if (!isAdmin) {
      toast.error('Only admins can restore backups');
      return;
    }
    if (!backupData) {
      toast.error('Invalid backup data');
      return;
    }
    if (!confirm('Restore from uploaded backup? This will overwrite all current data.')) {
      return;
    }
    try {
      await Promise.all([
        writeFile('data/members.json', backupData.members || []),
        writeFile('data/savings.json', backupData.savings || []),
        writeFile('data/loans.json', backupData.loans || []),
        writeFile('data/payments.json', backupData.payments || []),
        writeFile('data/settings.json', backupData.settings || { users: [] }),
      ]);
      toast.success('Data restored from uploaded file');
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to restore uploaded backup: ' + error.message);
    }
  };

  if (!isAdmin) {
    return (
      <ProtectedRoute requireAdmin>
        <Layout>
          <div className="text-center py-12">
            <p className="text-gray-600">Only administrators can access settings.</p>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-gray-800">Settings</h2>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'users'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'bulk'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Bulk Saving
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === 'backup'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Backup/Restore
            </button>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <UserPlus size={24} />
                  Add New User
                </h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        User ID <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={userForm.userId}
                        onChange={(e) => setUserForm({ ...userForm, userId: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={userForm.name}
                        onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="password"
                        required
                        value={userForm.password}
                        onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Role <span className="text-red-500">*</span>
                      </label>
                      <select
                        required
                        value={userForm.role}
                        onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'Admin' | 'Viewer' })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                      >
                        <option value="Viewer">Viewer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90"
                  >
                    Add User
                  </button>
                </form>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4">Existing Users</h3>
                <div className="space-y-2">
                  {settings?.users.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{user.name} ({user.userId})</p>
                        <p className="text-sm text-gray-600">Role: {user.role}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(user.userId)}
                        className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bulk Saving Tab */}
          {activeTab === 'bulk' && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Upload size={24} />
                Bulk Saving Import
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    CSV or JSON Data
                  </label>
                  <textarea
                    value={bulkData}
                    onChange={(e) => setBulkData(e.target.value)}
                    rows={10}
                    placeholder={`CSV format:
MemberId,Amount,Date
M-0001,1000,2024-01-15
M-0002,2000,2024-01-15

OR JSON format:
[
  {"memberId": "M-0001", "amount": 1000, "date": "2024-01-15"},
  {"memberId": "M-0002", "amount": 2000, "date": "2024-01-15"}
]`}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary font-mono text-sm"
                  />
                </div>
                <button
                  onClick={handleBulkSaving}
                  className="flex items-center gap-2 bg-success text-white px-6 py-2 rounded-lg hover:bg-success/90"
                >
                  <Save size={20} />
                  Import Savings
                </button>
              </div>
            </div>
          )}

          {/* Backup/Restore Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Download size={24} />
                  Create Backup
                </h3>
                <p className="text-gray-600 mb-4">
                  Create a snapshot of all data files (members, savings, loans, payments, settings).
                </p>
                <button
                  onClick={handleBackup}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90"
                >
                  <Download size={20} />
                  Create Backup Now
                </button>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <RotateCcw size={24} />
                  Restore from Backup
                </h3>
                <p className="text-gray-600 mb-4">
                  Select a backup file to restore. This will overwrite all current data.
                </p>
                {/* Upload local backup file (fallback when no backups listed) */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upload backup JSON (backup-YYYYMMDD-HHMMSS.json)
                  </label>
                  <input
                    type="file"
                    accept="application/json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        await handleRestoreFromObject(data);
                      } catch (err: any) {
                        toast.error('Invalid backup file');
                      } finally {
                        // reset input
                        e.currentTarget.value = '';
                      }
                    }}
                    className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                </div>
                <div className="space-y-2">
                  {backups.length === 0 ? (
                    <p className="text-gray-500">No backups found</p>
                  ) : (
                    backups.map((backup) => (
                      <div
                        key={backup}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <span className="font-mono text-sm">{backup}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => downloadBackup(backup)}
                            className="px-3 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                            title="Download backup file"
                          >
                            Download
                          </button>
                          <button
                            onClick={() => handleRestore(backup)}
                            className="px-4 py-2 bg-warning text-white rounded-lg hover:bg-warning/90"
                          >
                            Restore
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}

