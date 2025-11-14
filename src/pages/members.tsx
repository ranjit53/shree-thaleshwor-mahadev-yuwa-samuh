/**
 * Members management page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile, writeFile } from '@/lib/api';
import { formatDate, generateMemberId } from '@/lib/utils';
import type { Member } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Edit, Trash2, Eye, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

type ExtendedMember = Member & { active: boolean };

export default function MembersPage() {
  const [members, setMembers] = useState<ExtendedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<ExtendedMember | null>(null);
  const [viewingMember, setViewingMember] = useState<ExtendedMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    joinDate: new Date().toISOString().split('T')[0],
    address: '',
  });

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      const data = await readFile<Member[]>('data/members.json');
      const extendedMembers = (data || []).map((m: Member) => ({ 
        ...m, 
        active: (m as any).active !== undefined ? (m as any).active : true 
      })) as ExtendedMember[];
      setMembers(extendedMembers);
    } catch (error: any) {
      toast.error('Failed to load members: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can modify members');
      return;
    }

    try {
      const updatedMembers = [...members];
      
      if (editingMember) {
        // Update existing
        const index = updatedMembers.findIndex(m => m.id === editingMember.id);
        const updatedMember = {
          ...editingMember,
          ...formData,
        } as ExtendedMember;
        updatedMembers[index] = updatedMember;
        toast.success('Member updated successfully');
      } else {
        // Add new
        const newId = generateMemberId(updatedMembers.map(m => m.id));
        const newMember = {
          id: newId,
          ...formData,
          active: true,
        } as ExtendedMember;
        updatedMembers.push(newMember);
        toast.success('Member added successfully');
      }

      await writeFile('data/members.json', updatedMembers);
      setMembers(updatedMembers);
      resetForm();
    } catch (error: any) {
      toast.error('Failed to save member: ' + error.message);
    }
  };

  const handleDelete = async (member: ExtendedMember) => {
    if (!isAdmin) {
      toast.error('Only admins can delete members');
      return;
    }

    if (!confirm(`Are you sure you want to delete ${member.name}?`)) {
      return;
    }

    try {
      const updatedMembers = members.filter(m => m.id !== member.id);
      await writeFile('data/members.json', updatedMembers);
      setMembers(updatedMembers);
      toast.success('Member deleted successfully');
      setViewingMember(null);
    } catch (error: any) {
      toast.error('Failed to delete member: ' + error.message);
    }
  };

  const handleToggleActive = async (member: ExtendedMember, newActive: boolean) => {
    if (!isAdmin) {
      toast.error('Only admins can modify status');
      return;
    }

    if (newActive === member.active) {
      toast('Status is already set');
      return;
    }

    try {
      const updatedMembers = [...members];
      const index = updatedMembers.findIndex(m => m.id === member.id);
      const updatedMember: ExtendedMember = { ...member, active: newActive };
      updatedMembers[index] = updatedMember;
      await writeFile('data/members.json', updatedMembers);
      setMembers(updatedMembers);
      setViewingMember(updatedMember);
      toast.success(`Member ${newActive ? 'activated' : 'deactivated'} successfully`);
    } catch (error: any) {
      toast.error(`Failed to update status: ${error.message}`);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      joinDate: new Date().toISOString().split('T')[0],
      address: '',
    });
    setShowAddForm(false);
    setEditingMember(null);
    setViewingMember(null);
  };

  const handleEdit = (member: ExtendedMember) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      phone: member.phone,
      joinDate: member.joinDate,
      address: member.address || '',
    });
    setViewingMember(null);
  };

  const filteredMembers = members.filter(m =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.phone.includes(searchTerm)
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
            <h2 className="text-3xl font-bold text-gray-800">Members</h2>
            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus size={20} />
                Add Member
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by name, ID, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingMember) && isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4">
                {editingMember ? 'Edit Member' : 'Add New Member'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Join Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.joinDate}
                      onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-primary text-white px-6 py-2 rounded-lg hover:bg-primary/90"
                  >
                    {editingMember ? 'Update' : 'Add'} Member
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

          {/* Members Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No members found
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-medium">{member.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{member.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{member.phone}</td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(member.joinDate)}</td>
                        <td className="px-6 py-4">{member.address || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setViewingMember(member)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Review"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* View/Edit Modal */}
          {viewingMember && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">Member Details</h3>
                    <button
                      onClick={() => setViewingMember(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Member ID</label>
                      <p className="text-lg font-semibold">{viewingMember.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Name</label>
                      <p className="text-lg">{viewingMember.name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Phone</label>
                      <p className="text-lg">{viewingMember.phone}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Join Date</label>
                      <p className="text-lg">{formatDate(viewingMember.joinDate)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Address</label>
                      <p className="text-lg">{viewingMember.address || '-'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p className={`text-lg font-medium ${viewingMember.active ? 'text-green-600' : 'text-red-600'}`}>
                        {viewingMember.active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="grid grid-cols-2 gap-2 mt-6">
                      <button
                        onClick={() => {
                          handleEdit(viewingMember);
                        }}
                        className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(viewingMember)}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => handleToggleActive(viewingMember, true)}
                        disabled={viewingMember.active}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          viewingMember.active
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-green-600 text-white hover:bg-green-700'
                        }`}
                      >
                        <CheckCircle size={16} />
                        Activate
                      </button>
                      <button
                        onClick={() => handleToggleActive(viewingMember, false)}
                        disabled={!viewingMember.active}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                          !viewingMember.active
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                            : 'bg-red-600 text-white hover:bg-red-700'
                        }`}
                      >
                        <XCircle size={16} />
                        Deactivate
                      </button>
                    </div>
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
