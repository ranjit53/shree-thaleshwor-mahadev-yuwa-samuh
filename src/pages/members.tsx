/**
 * Members management page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile, writeFile } from '@/lib/api';
import { formatDate, generateMemberId, formatCurrency, calculateOutstandingPrincipal, calculateMonthlyInterest } from '@/lib/utils';
import type { Member, Saving, Loan, Payment, FinePayment } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [savings, setSavings] = useState<Saving[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [fines, setFines] = useState<FinePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [viewingMember, setViewingMember] = useState<Member | null>(null);
  const [activeTab, setActiveTab] = useState<'savings' | 'loans' | 'payments' | 'fines'>('savings');
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    joinDate: new Date().toISOString().split('T')[0],
    address: '',
    isActive: true, // ADDED: Status for new members
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [membersData, savingsData, loansData, paymentsData, finesData] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Saving[]>('data/savings.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
        readFile<FinePayment[]>('data/fines.json'),
      ]);
      setMembers(membersData || []);
      setSavings(savingsData || []);
      setLoans(loansData || []);
      setPayments(paymentsData || []);
      setFines(finesData || []);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getMemberSavings = (memberId: string): Saving[] => {
    return savings.filter((s: Saving) => s.memberId === memberId);
  };

  const getMemberLoans = (memberId: string): Loan[] => {
    return loans.filter((l: Loan) => l.memberId === memberId);
  };

  const getMemberPayments = (memberId: string): Payment[] => {
    const memberLoans = getMemberLoans(memberId);
    const loanIds = memberLoans.map((l: Loan) => l.id);
    return payments.filter((p: Payment) => loanIds.includes(p.loanId));
  };

  const getMemberFines = (memberId: string): FinePayment[] => {
    return fines.filter((f: FinePayment) => f.memberId === memberId);
  };

  const getLoanPayments = (loanId: string): Payment[] => {
    return payments.filter((p: Payment) => p.loanId === loanId);
  };

  const getOutstanding = (loan: Loan): number => {
    const loanPayments = getLoanPayments(loan.id);
    return calculateOutstandingPrincipal(
      loan.principal,
      loan.interestRate,
      loan.termMonths,
      loanPayments.map((p: Payment) => ({
        principalPaid: p.principalPaid,
        interestPaid: p.interestPaid,
        date: p.date,
      }))
    );
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
        updatedMembers[index] = {
          ...editingMember,
          ...formData,
          isActive: formData.isActive, // ADDED: Ensure isActive is carried through update
        };
        toast.success('Member updated successfully');
      } else {
        // Add new
        const newId = generateMemberId(updatedMembers.map(m => m.id));
        updatedMembers.push({
          id: newId,
          ...formData,
          isActive: formData.isActive ?? true, // ADDED: Ensure isActive is set for new member
        });
        toast.success('Member added successfully');
      }

      await writeFile('data/members.json', updatedMembers);
      setMembers(updatedMembers);
      resetForm();
      await loadData();
    } catch (error: any) {
      toast.error('Failed to save member: ' + error.message);
    }
  };

  const handleDelete = async (member: Member) => {
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
      await loadData();
    } catch (error: any) {
      toast.error('Failed to delete member: ' + error.message);
    }
  };

  // ADDED: Function to toggle member's active status
  const handleToggleActive = async (member: Member) => {
    if (!isAdmin) {
      toast.error('Only admins can change member status');
      return;
    }

    try {
      const updatedMembers = members.map(m => 
        m.id === member.id ? { ...m, isActive: !member.isActive } : m
      );
      await writeFile('data/members.json', updatedMembers);
      setMembers(updatedMembers);
      // Update viewing member state to reflect the change immediately in the modal
      setViewingMember(updatedMembers.find(m => m.id === member.id) || null);
      toast.success(`Member ${member.name} is now ${!member.isActive ? 'Active' : 'Inactive'}`);
      await loadData();
    } catch (error: any) {
      toast.error('Failed to update member status: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      joinDate: new Date().toISOString().split('T')[0],
      address: '',
      isActive: true, // ADDED: Reset isActive state
    });
    setShowAddForm(false);
    setEditingMember(null);
    setViewingMember(null);
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setFormData({
      name: member.name,
      phone: member.phone,
      joinDate: member.joinDate,
      address: member.address || '',
      isActive: member.isActive ?? true, // ADDED: Load existing isActive status
    });
    setViewingMember(null);
  };

  const handleViewMember = (member: Member) => {
    setViewingMember(member);
    setActiveTab('savings');
  };

  const filteredMembers = members.filter((m: Member) =>
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
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Members</h2>
            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary/90 active:bg-primary/80 transition-colors touch-manipulation font-medium w-full sm:w-auto justify-center"
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
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent touch-manipulation text-base"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingMember) && isAdmin && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h3 className="text-lg sm:text-xl font-semibold mb-4">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                    <input
                      type="text"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
                    />
                  </div>
                  {/* ADDED: Active Status toggle on form - only visible if editing existing member */}
                  {editingMember && (
                    <div className="md:col-span-2 flex items-center gap-4">
                      <label className="text-sm font-medium text-gray-700">
                        Active Status:
                      </label>
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="h-4 w-4 text-primary rounded border-gray-300 focus:ring-primary"
                      />
                      <span className={`text-sm font-semibold ${formData.isActive ? 'text-success' : 'text-danger'}`}>
                        {formData.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="submit"
                    className="bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90 active:bg-primary/80 touch-manipulation font-medium"
                  >
                    {editingMember ? 'Update' : 'Add'} Member
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg hover:bg-gray-300 active:bg-gray-400 touch-manipulation font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Members Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="table-container overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full min-w-[640px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member ID</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Join Date</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Address</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                        No members found
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr key={member.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap font-medium text-sm">{member.id}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                          {member.name}
                          {/* ADDED: Status Badge */}
                          <span 
                            className={`ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              (member.isActive ?? true) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {(member.isActive ?? true) ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">{member.phone}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">{formatDate(member.joinDate)}</td>
                        <td className="px-4 sm:px-6 py-4 text-sm max-w-[200px] truncate">{member.address || '-'}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleViewMember(member)}
                              className="p-2 text-info hover:bg-info/10 active:bg-info/20 rounded-lg transition-colors touch-manipulation"
                              title="Review"
                              aria-label="View member details"
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
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto my-4">
                <div className="p-4 sm:p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">Member Review - {viewingMember.name}</h3>
                    <button
                      onClick={() => setViewingMember(null)}
                      className="text-gray-500 hover:text-gray-700 active:text-gray-900 p-2 touch-manipulation"
                      aria-label="Close"
                    >
                      <span className="text-2xl">✕</span>
                    </button>
                  </div>

                  {/* Member Basic Info */}
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Member ID</label>
                        <p className="text-base font-semibold break-words">{viewingMember.id}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
                        <p className="text-base break-words">{viewingMember.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Phone</label>
                        <p className="text-base break-words">{viewingMember.phone}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Join Date</label>
                        <p className="text-base">{formatDate(viewingMember.joinDate)}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Status</label>
                        <p className={`text-base font-bold ${viewingMember.isActive ?? true ? 'text-success' : 'text-danger'}`}>
                          {viewingMember.isActive ?? true ? 'Active' : 'Inactive'}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-sm font-medium text-gray-500">Address</label>
                        <p className="text-base break-words">{viewingMember.address || '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Tabs */}
                  <div className="border-b border-gray-200 mb-4">
                    <nav className="flex space-x-4 overflow-x-auto">
                      <button
                        onClick={() => setActiveTab('savings')}
                        className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                          activeTab === 'savings'
                            ? 'border-success text-success'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Savings ({getMemberSavings(viewingMember.id).length})
                      </button>
                      <button
                        onClick={() => setActiveTab('loans')}
                        className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                          activeTab === 'loans'
                            ? 'border-warning text-warning'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Loans ({getMemberLoans(viewingMember.id).length})
                      </button>
                      <button
                        onClick={() => setActiveTab('payments')}
                        className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                          activeTab === 'payments'
                            ? 'border-info text-info'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Payments ({getMemberPayments(viewingMember.id).length})
                      </button>
                      <button
                        onClick={() => setActiveTab('fines')}
                        className={`px-4 py-2 font-medium text-sm whitespace-nowrap border-b-2 transition-colors ${
                          activeTab === 'fines'
                            ? 'border-danger text-danger'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Fines ({getMemberFines(viewingMember.id).length})
                      </button>
                    </nav>
                  </div>

                  {/* Tab Content */}
                  <div className="min-h-[300px]">
                    {/* Savings Tab */}
                    {activeTab === 'savings' && (
                      <div>
                        <div className="mb-4 flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-800">Saving Transactions</h4>
                          <p className="text-sm text-gray-600">
                            Total: <span className="font-bold text-success">{formatCurrency(getMemberSavings(viewingMember.id).reduce((sum: number, s: Saving) => sum + s.amount, 0))}</span>
                          </p>
                        </div>
                        {getMemberSavings(viewingMember.id).length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No saving transactions</p>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {getMemberSavings(viewingMember.id).map((saving: Saving) => (
                              <div key={saving.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-semibold text-success">{formatCurrency(saving.amount)}</p>
                                  <p className="text-sm text-gray-500">{formatDate(saving.date)}</p>
                                  {saving.remarks && <p className="text-sm text-gray-600 mt-1">{saving.remarks}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Loans Tab */}
                    {activeTab === 'loans' && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Loan Details</h4>
                        {getMemberLoans(viewingMember.id).length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No loans</p>
                        ) : (
                          <div className="space-y-4 max-h-[400px] overflow-y-auto">
                            {getMemberLoans(viewingMember.id).map((loan: Loan) => {
                              const outstanding = getOutstanding(loan);
                              const monthlyInterest = calculateMonthlyInterest(outstanding, loan.interestRate);
                              const loanPayments = getLoanPayments(loan.id);
                              return (
                                <div key={loan.id} className="p-4 bg-gray-50 rounded-lg">
                                  <div className="grid grid-cols-2 gap-4 mb-3">
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Loan ID</label>
                                      <p className="font-semibold">{loan.id}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Principal</label>
                                      <p className="font-semibold">{formatCurrency(loan.principal)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Interest Rate</label>
                                      <p>{loan.interestRate}% per year</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Outstanding</label>
                                      <p className="font-semibold text-warning">{formatCurrency(outstanding)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Monthly Interest</label>
                                      <p>{formatCurrency(monthlyInterest)}</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Term</label>
                                      <p>{loan.termMonths} months</p>
                                    </div>
                                    <div>
                                      <label className="text-sm font-medium text-gray-500">Start Date</label>
                                      <p>{formatDate(loan.startDate)}</p>
                                    </div>
                                    {loan.purpose && (
                                      <div>
                                        <label className="text-sm font-medium text-gray-500">Purpose</label>
                                        <p>{loan.purpose}</p>
                                      </div>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <p className="text-sm font-medium text-gray-600 mb-2">Payment History ({loanPayments.length})</p>
                                    {loanPayments.length === 0 ? (
                                      <p className="text-sm text-gray-500">No payments yet</p>
                                    ) : (
                                      <div className="space-y-1">
                                        {loanPayments.map((payment: Payment) => (
                                          <div key={payment.id} className="text-sm bg-white p-2 rounded">
                                            <span className="font-medium">{formatDate(payment.date)}</span> - 
                                            Principal: {formatCurrency(payment.principalPaid)} | 
                                            Interest: {formatCurrency(payment.interestPaid)}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payments Tab */}
                    {activeTab === 'payments' && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Loan Payment History</h4>
                        {getMemberPayments(viewingMember.id).length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No payments</p>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {getMemberPayments(viewingMember.id).map((payment: Payment) => {
                              const loan = loans.find((l: Loan) => l.id === payment.loanId);
                              return (
                                <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                  <div>
                                    <p className="font-semibold">{formatDate(payment.date)}</p>
                                    <p className="text-sm text-gray-600">
                                      Loan: {loan?.id || payment.loanId}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      Principal: {formatCurrency(payment.principalPaid)} | 
                                      Interest: {formatCurrency(payment.interestPaid)}
                                    </p>
                                    {payment.remarks && (
                                      <p className="text-sm text-gray-500 mt-1">{payment.remarks}</p>
                                    )}
                                  </div>
                                  <div className="text-right">
                                    <p className="font-bold text-info">
                                      {formatCurrency(payment.principalPaid + payment.interestPaid)}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Fines Tab */}
                    {activeTab === 'fines' && (
                      <div>
                        <div className="mb-4 flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-gray-800">Fine Payments</h4>
                          <p className="text-sm text-gray-600">
                            Total: <span className="font-bold text-danger">{formatCurrency(getMemberFines(viewingMember.id).reduce((sum: number, f: FinePayment) => sum + f.amount, 0))}</span>
                          </p>
                        </div>
                        {getMemberFines(viewingMember.id).length === 0 ? (
                          <p className="text-gray-500 text-center py-8">No fines</p>
                        ) : (
                          <div className="space-y-2 max-h-[400px] overflow-y-auto">
                            {getMemberFines(viewingMember.id).map((fine: FinePayment) => (
                              <div key={fine.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-semibold text-danger">{formatCurrency(fine.amount)}</p>
                                  <p className="text-sm text-gray-500">{formatDate(fine.date)}</p>
                                  <p className="text-sm text-gray-600 mt-1">Reason: {fine.reason}</p>
                                  {fine.note && <p className="text-sm text-gray-600 mt-1">Note: {fine.note}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="flex flex-col sm:flex-row gap-2 mt-6 pt-4 border-t border-gray-200">
                      
                      {/* ADDED: Active/Inactive Toggle Button */}
                      <button
                        onClick={() => handleToggleActive(viewingMember)}
                        className={`flex-1 px-4 py-2.5 rounded-lg touch-manipulation font-medium transition-colors text-white ${
                          (viewingMember.isActive ?? true)
                            ? 'bg-danger hover:bg-danger/90 active:bg-danger/80' // Deactivate (Red)
                            : 'bg-success hover:bg-success/90 active:bg-success/80' // Activate (Green)
                        }`}
                        title={(viewingMember.isActive ?? true) ? 'Deactivate Member' : 'Activate Member'}
                      >
                        {(viewingMember.isActive ?? true) ? 'Deactivate Member' : 'Activate Member'}
                      </button>

                      <button
                        onClick={() => {
                          handleEdit(viewingMember);
                        }}
                        className="flex-1 bg-warning text-white px-4 py-2.5 rounded-lg hover:bg-warning/90 active:bg-warning/80 touch-manipulation font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(viewingMember)}
                        className="flex-1 bg-gray-500 text-white px-4 py-2.5 rounded-lg hover:bg-gray-600 active:bg-gray-700 touch-manipulation font-medium" // CHANGED: Delete button color to avoid confusion with Deactivate
                      >
                        Delete
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
