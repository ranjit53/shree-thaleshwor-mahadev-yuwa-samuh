/**
 * Loans management page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile, writeFile } from '@/lib/api';
import { formatCurrency, formatDate, calculateOutstandingPrincipal, calculateMonthlyInterest } from '@/lib/utils';
import type { Member, Loan, Payment } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoansPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [viewingLoanId, setViewingLoanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin } = useAuth();

  const [formData, setFormData] = useState({
    memberId: '',
    principal: '',
    interestRate: '',
    startDate: new Date().toISOString().split('T')[0],
    termMonths: '',
    purpose: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [membersData, loansData, paymentsData] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
      ]);
      setMembers(membersData || []);
      setLoans(loansData || []);
      setPayments(paymentsData || []);
    } catch (error: any) {
      toast.error('Failed to load data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getLoanPayments = (loanId: string) => {
    return payments.filter(p => p.loanId === loanId);
  };

  const getOutstanding = (loan: Loan) => {
    const loanPayments = getLoanPayments(loan.id);
    return calculateOutstandingPrincipal(
      loan.principal,
      loan.interestRate,
      loan.termMonths,
      loanPayments.map(p => ({
        principalPaid: p.principalPaid,
        interestPaid: p.interestPaid,
        date: p.date,
      }))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can modify loans');
      return;
    }

    try {
      const updatedLoans = [...loans];
      
      if (editingLoan) {
        const index = updatedLoans.findIndex(l => l.id === editingLoan.id);
        updatedLoans[index] = {
          ...editingLoan,
          memberId: formData.memberId,
          principal: parseFloat(formData.principal),
          interestRate: parseFloat(formData.interestRate),
          startDate: formData.startDate,
          termMonths: parseInt(formData.termMonths),
          purpose: formData.purpose || undefined,
        };
        toast.success('Loan updated successfully');
      } else {
        const newId = `L-${Date.now()}`;
        updatedLoans.push({
          id: newId,
          memberId: formData.memberId,
          principal: parseFloat(formData.principal),
          interestRate: parseFloat(formData.interestRate),
          startDate: formData.startDate,
          termMonths: parseInt(formData.termMonths),
          purpose: formData.purpose || undefined,
        });
        toast.success('Loan added successfully');
      }

      await writeFile('data/loans.json', updatedLoans);
      setLoans(updatedLoans);
      resetForm();
    } catch (error: any) {
      toast.error('Failed to save loan: ' + error.message);
    }
  };

  const handleDelete = async (loan: Loan) => {
    if (!isAdmin) {
      toast.error('Only admins can delete loans');
      return;
    }

    if (!confirm(`Are you sure you want to delete this loan?`)) {
      return;
    }

    try {
      const updatedLoans = loans.filter(l => l.id !== loan.id);
      await writeFile('data/loans.json', updatedLoans);
      setLoans(updatedLoans);
      toast.success('Loan deleted successfully');
      setViewingLoanId(null);
    } catch (error: any) {
      toast.error('Failed to delete loan: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      memberId: '',
      principal: '',
      interestRate: '',
      startDate: new Date().toISOString().split('T')[0],
      termMonths: '',
      purpose: '',
    });
    setShowAddForm(false);
    setEditingLoan(null);
    setViewingLoanId(null);
  };

  const handleEdit = (loan: Loan) => {
    setEditingLoan(loan);
    setFormData({
      memberId: loan.memberId,
      principal: loan.principal.toString(),
      interestRate: loan.interestRate.toString(),
      startDate: loan.startDate,
      termMonths: loan.termMonths.toString(),
      purpose: loan.purpose || '',
    });
    setViewingLoanId(null);
  };

  const filteredLoans = loans.filter(l => {
    const member = members.find(m => m.id === l.memberId);
    return (
      (member?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      l.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

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
            <h2 className="text-3xl font-bold text-gray-800">Loans</h2>
            {isAdmin && (
              <button
                onClick={() => {
                  resetForm();
                  setShowAddForm(true);
                }}
                className="flex items-center gap-2 bg-warning text-white px-4 py-2 rounded-lg hover:bg-warning/90 transition-colors"
              >
                <Plus size={20} />
                Add Loan
              </button>
            )}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search by member name or loan ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning focus:border-transparent"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingLoan) && isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4">
                {editingLoan ? 'Edit Loan' : 'Add New Loan'}
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
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                    >
                      <option value="">Select Member</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Principal Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.principal}
                      onChange={(e) => setFormData({ ...formData, principal: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interest Rate (% per year) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.interestRate}
                      onChange={(e) => setFormData({ ...formData, interestRate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loan Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Term (months) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.termMonths}
                      onChange={(e) => setFormData({ ...formData, termMonths: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                    <input
                      type="text"
                      value={formData.purpose}
                      onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-warning text-white px-6 py-2 rounded-lg hover:bg-warning/90"
                  >
                    {editingLoan ? 'Update' : 'Add'} Loan
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

          {/* Loans Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Principal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Outstanding</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No loans found
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => {
                      const member = members.find(m => m.id === loan.memberId);
                      const outstanding = getOutstanding(loan);
                      return (
                        <tr key={loan.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{loan.memberId}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{member?.name || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(loan.principal)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{loan.interestRate}%</td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold">
                            {formatCurrency(outstanding)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setViewingLoanId(loan.id)}
                                className="p-2 text-info hover:bg-info/10 rounded-lg transition-colors"
                                title="Review"
                              >
                                <Eye size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* View Loan Details Modal */}
          {viewingLoanId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">Loan Details</h3>
                    <button
                      onClick={() => setViewingLoanId(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  {(() => {
                    const loan = loans.find(l => l.id === viewingLoanId);
                    if (!loan) return null;
                    const member = members.find(m => m.id === loan.memberId);
                    const outstanding = getOutstanding(loan);
                    const monthlyInterest = calculateMonthlyInterest(outstanding, loan.interestRate);
                    const loanPayments = getLoanPayments(loan.id);
                    
                    return (
                      <>
                        <div className="space-y-4 mb-6">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium text-gray-500">Member</label>
                              <p className="text-lg font-semibold">{member?.name} ({loan.memberId})</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Principal</label>
                              <p className="text-lg font-semibold">{formatCurrency(loan.principal)}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Interest Rate</label>
                              <p className="text-lg">{loan.interestRate}% per year</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Outstanding</label>
                              <p className="text-lg font-semibold text-warning">{formatCurrency(outstanding)}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Monthly Interest</label>
                              <p className="text-lg">{formatCurrency(monthlyInterest)}</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Term</label>
                              <p className="text-lg">{loan.termMonths} months</p>
                            </div>
                            <div>
                              <label className="text-sm font-medium text-gray-500">Start Date</label>
                              <p className="text-lg">{formatDate(loan.startDate)}</p>
                            </div>
                            {loan.purpose && (
                              <div className="col-span-2">
                                <label className="text-sm font-medium text-gray-500">Purpose</label>
                                <p className="text-lg">{loan.purpose}</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-3">Payment History</h4>
                          {loanPayments.length === 0 ? (
                            <p className="text-gray-500">No payments yet</p>
                          ) : (
                            <div className="space-y-2">
                              {loanPayments.map((payment) => (
                                <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                  <div>
                                    <p className="font-semibold">{formatDate(payment.date)}</p>
                                    <p className="text-sm text-gray-600">
                                      Principal: {formatCurrency(payment.principalPaid)} | 
                                      Interest: {formatCurrency(payment.interestPaid)}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex gap-2 mt-6">
                            <button
                              onClick={() => {
                                handleEdit(loan);
                              }}
                              className="flex-1 bg-warning text-white px-4 py-2 rounded-lg hover:bg-warning/90 flex items-center justify-center gap-2"
                            >
                              <Edit size={16} />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(loan)}
                              className="flex-1 bg-danger text-white px-4 py-2 rounded-lg hover:bg-danger/90 flex items-center justify-center gap-2"
                            >
                              <Trash2 size={16} />
                              Delete
                            </button>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
