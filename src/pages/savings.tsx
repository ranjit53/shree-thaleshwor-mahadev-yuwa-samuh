/**
 * Savings management page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile, writeFile } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Member, Saving } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

type ExtendedMember = Member & { active: boolean };

export default function SavingsPage() {
  const [members, setMembers] = useState<ExtendedMember[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSaving, setEditingSaving] = useState<Saving | null>(null);
  const [viewingMemberId, setViewingMemberId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    remarks: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [membersData, savingsData] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Saving[]>('data/savings.json'),
      ]);
      const extendedMembers = (membersData || []).map((m: Member) => ({ 
        ...m, 
        active: (m as any).active !== undefined ? (m as any).active : true 
      })) as ExtendedMember[];
      setMembers(extendedMembers);
      setSavings(savingsData || []);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMemberSavings = (memberId: string) => {
    return savings.filter(s => s.memberId === memberId);
  };

  const getTotalSaving = (memberId: string) => {
    return getMemberSavings(memberId).reduce((sum, s) => sum + s.amount, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can modify savings');
      return;
    }

    try {
      const member = members.find(m => m.id === formData.memberId);
      if (!member?.active) {
        toast.error('Inactive members cannot add savings.');
        return;
      }

      const updatedSavings = [...savings];
      
      if (editingSaving) {
        const index = updatedSavings.findIndex(s => s.id === editingSaving.id);
        updatedSavings[index] = {
          ...editingSaving,
          memberId: formData.memberId,
          amount: parseFloat(formData.amount),
          date: formData.date,
          remarks: formData.remarks,
        };
        toast.success('Saving updated successfully');
      } else {
        const newId = `S-${Date.now()}`;
        updatedSavings.push({
          id: newId,
          memberId: formData.memberId,
          amount: parseFloat(formData.amount),
          date: formData.date,
          remarks: formData.remarks || undefined,
        });
        toast.success('Saving added successfully');
      }

      await writeFile('data/savings.json', updatedSavings);
      setSavings(updatedSavings);
      resetForm();
    } catch (error: any) {
      toast.error('Failed to save saving: ' + error.message);
    }
  };

  const handleDelete = async (saving: Saving) => {
    if (!isAdmin) {
      toast.error('Only admins can delete savings');
      return;
    }

    if (!confirm('Are you sure you want to delete this saving transaction?')) {
      return;
    }

    try {
      const updatedSavings = savings.filter(s => s.id !== saving.id);
      await writeFile('data/savings.json', updatedSavings);
      setSavings(updatedSavings);
      toast.success('Saving deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete saving: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      memberId: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      remarks: '',
    });
    setShowAddForm(false);
    setEditingSaving(null);
    setViewingMemberId(null);
  };

  const handleEdit = (saving: Saving) => {
    setEditingSaving(saving);
    setFormData({
      memberId: saving.memberId,
      amount: saving.amount.toString(),
      date: saving.date,
      remarks: saving.remarks || '',
    });
    setViewingMemberId(null);
  };

  const memberSavingsMap = new Map<string, number>();
  members.forEach(member => {
    memberSavingsMap.set(member.id, getTotalSaving(member.id));
  });

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-3xl font-bold text-gray-800">Savings</h2>
            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="flex items-center gap-2 bg-success text-white px-4 py-2 rounded-lg hover:bg-success/90 transition-colors"
              >
                <Plus size={20} />
                Add Saving
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by member name or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success focus:border-transparent"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingSaving) && isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4">
                {editingSaving ? 'Edit Saving' : 'Add New Saving'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Member <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.memberId}
                      onChange={(e) => setFormData({ ...formData, memberId: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success"
                    >
                      <option value="">Select Member</option>
                      {members.filter(m => m.active).map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-success"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-success text-white px-6 py-2 rounded-lg hover:bg-success/90"
                  >
                    {editingSaving ? 'Update' : 'Add'} Saving
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Savings Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Saving</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        No members found
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => {
                      const totalSaving = memberSavingsMap.get(member.id) || 0;
                      return (
                        <tr key={member.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{member.id}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{member.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold text-success">
                            {formatCurrency(totalSaving)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => setViewingMemberId(member.id)}
                              className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors"
                              title="Review"
                            >
                              <Eye size={18} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* View Transactions Modal */}
          {viewingMemberId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">
                      Saving Transactions - {members.find(m => m.id === viewingMemberId)?.name}
                    </h3>
                    <button
                      onClick={() => setViewingMemberId(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2">
                    {getMemberSavings(viewingMemberId).length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No saving transactions</p>
                    ) : (
                      getMemberSavings(viewingMemberId).map((saving) => (
                        <div key={saving.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div>
                            <p className="font-semibold">{formatCurrency(saving.amount)}</p>
                            <p className="text-sm text-gray-500">{formatDate(saving.date)}</p>
                            {saving.remarks && <p className="text-sm text-gray-600 mt-1">{saving.remarks}</p>}
                          </div>
                          {isAdmin && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  handleEdit(saving);
                                  setViewingMemberId(null);
                                }}
                                className="p-2 text-warning hover:bg-warning/10 rounded-lg"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  handleDelete(saving);
                                  if (getMemberSavings(viewingMemberId).length === 1) {
                                    setViewingMemberId(null);
                                  }
                                }}
                                className="p-2 text-danger hover:bg-danger/10 rounded-lg"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
