/**
 * Payments management page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile, writeFile } from '@/lib/api';
import { formatCurrency, formatDate, calculateMonthlyInterest, calculateOutstandingPrincipal } from '@/lib/utils';
import type { Member, Loan, Payment, FinePayment, Expenditure } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Search, Edit, Trash2, Eye } from 'lucide-react';
import toast from 'react-hot-toast';

export default function PaymentsPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [viewingLoanId, setViewingLoanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin } = useAuth();
  const [showFineForm, setShowFineForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [fines, setFines] = useState<FinePayment[]>([]);
  const [expenditures, setExpenditures] = useState<Expenditure[]>([]);

  const [formData, setFormData] = useState({
    loanId: '',
    date: new Date().toISOString().split('T')[0],
    principalPaid: '',
    interestPaid: '',
    remarks: '',
  });
  const [fineForm, setFineForm] = useState({
    memberId: '',
    date: new Date().toISOString().split('T')[0],
    amount: '',
    reason: 'Saving Default' as 'Saving Default' | 'Interest Default' | 'Other',
    note: '',
  });
  const [expForm, setExpForm] = useState({
    date: new Date().toISOString().split('T')[0],
    item: '',
    amount: '',
    note: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [membersData, loansData, paymentsData, finesData, expData] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
        readFile<FinePayment[]>('data/fines.json'),
        readFile<Expenditure[]>('data/expenditures.json'),
      ]);
      setMembers(membersData || []);
      setLoans(loansData || []);
      setPayments(paymentsData || []);
      setFines(finesData || []);
      setExpenditures(expData || []);
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

  const handleLoanSelect = (loanId: string) => {
    const loan = loans.find(l => l.id === loanId);
    if (loan) {
      const outstanding = getOutstanding(loan);
      const monthlyInterest = calculateMonthlyInterest(outstanding, loan.interestRate);
      setFormData({
        ...formData,
        loanId,
        interestPaid: monthlyInterest.toFixed(2),
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isAdmin) {
      toast.error('Only admins can modify payments');
      return;
    }

    try {
      const loan = loans.find(l => l.id === formData.loanId);
      if (!loan) {
        toast.error('Loan not found');
        return;
      }

      const updatedPayments = [...payments];
      
      if (editingPayment) {
        const index = updatedPayments.findIndex(p => p.id === editingPayment.id);
        updatedPayments[index] = {
          ...editingPayment,
          loanId: formData.loanId,
          date: formData.date,
          principalPaid: parseFloat(formData.principalPaid),
          interestPaid: parseFloat(formData.interestPaid),
          remarks: formData.remarks || undefined,
        };
        toast.success('Payment updated successfully');
      } else {
        const newId = `P-${Date.now()}`;
        updatedPayments.push({
          id: newId,
          loanId: formData.loanId,
          memberId: loan.memberId,
          date: formData.date,
          principalPaid: parseFloat(formData.principalPaid),
          interestPaid: parseFloat(formData.interestPaid),
          remarks: formData.remarks || undefined,
        });
        toast.success('Payment added successfully');
      }

      await writeFile('data/payments.json', updatedPayments);
      setPayments(updatedPayments);
      resetForm();
    } catch (error: any) {
      toast.error('Failed to save payment: ' + error.message);
    }
  };

  const handleDelete = async (payment: Payment) => {
    if (!isAdmin) {
      toast.error('Only admins can delete payments');
      return;
    }

    if (!confirm('Are you sure you want to delete this payment?')) {
      return;
    }

    try {
      const updatedPayments = payments.filter(p => p.id !== payment.id);
      await writeFile('data/payments.json', updatedPayments);
      setPayments(updatedPayments);
      toast.success('Payment deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete payment: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      loanId: '',
      date: new Date().toISOString().split('T')[0],
      principalPaid: '',
      interestPaid: '',
      remarks: '',
    });
    setShowAddForm(false);
    setEditingPayment(null);
    setViewingLoanId(null);
    setShowFineForm(false);
    setShowExpForm(false);
  };

  const handleEdit = (payment: Payment) => {
    setEditingPayment(payment);
    setFormData({
      loanId: payment.loanId,
      date: payment.date,
      principalPaid: payment.principalPaid.toString(),
      interestPaid: payment.interestPaid.toString(),
      remarks: payment.remarks || '',
    });
    setViewingLoanId(null);
  };

  // Group payments by loan for display
  const paymentsByLoan = new Map<string, Payment[]>();
  loans.forEach(loan => {
    const loanPayments = getLoanPayments(loan.id);
    if (loanPayments.length > 0) {
      paymentsByLoan.set(loan.id, loanPayments);
    }
  });

  const filteredLoans = Array.from(paymentsByLoan.keys()).filter(loanId => {
    const loan = loans.find(l => l.id === loanId);
    const member = loan ? members.find(m => m.id === loan.memberId) : null;
    return (
      member?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      loanId.toLowerCase().includes(searchTerm.toLowerCase())
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
            <h2 className="text-3xl font-bold text-gray-800">Payments</h2>
            {isAdmin && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    resetForm();
                    setShowAddForm(true);
                  }}
                  className="flex items-center gap-2 bg-info text-white px-4 py-2 rounded-lg hover:bg-info/90 transition-colors"
                >
                  <Plus size={20} />
                  Add Payment
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowFineForm(true);
                  }}
                  className="flex items-center gap-2 bg-warning text-white px-4 py-2 rounded-lg hover:bg-warning/90 transition-colors"
                >
                  <Plus size={20} />
                  Add Fine
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowExpForm(true);
                  }}
                  className="flex items-center gap-2 bg-danger text-white px-4 py-2 rounded-lg hover:bg-danger/90 transition-colors"
                >
                  <Plus size={20} />
                  Add Expenditure
                </button>
              </div>
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
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info focus:border-transparent"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingPayment) && isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4">
                {editingPayment ? 'Edit Payment' : 'Add New Payment'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Loan <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={formData.loanId}
                      onChange={(e) => handleLoanSelect(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info"
                    >
                      <option value="">Select Loan</option>
                      {loans.map(loan => {
                        const member = members.find(m => m.id === loan.memberId);
                        const outstanding = getOutstanding(loan);
                        return (
                          <option key={loan.id} value={loan.id}>
                            {member?.name} - {formatCurrency(outstanding)} outstanding
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Interest Preview (per month)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      readOnly
                      value={formData.interestPaid}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Applied to Principal <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.principalPaid}
                      onChange={(e) => setFormData({ ...formData, principalPaid: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Applied to Interest <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={formData.interestPaid}
                      onChange={(e) => setFormData({ ...formData, interestPaid: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="bg-info text-white px-6 py-2 rounded-lg hover:bg-info/90"
                  >
                    {editingPayment ? 'Update' : 'Add'} Payment
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

          {/* Add Fine Form */}
          {showFineForm && isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Add Fine Payment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
                  <select
                    required
                    value={fineForm.memberId}
                    onChange={(e) => setFineForm({ ...fineForm, memberId: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                  >
                    <option value="">Select Member</option>
                    {members.map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={fineForm.date}
                    onChange={(e) => setFineForm({ ...fineForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fineForm.amount}
                    onChange={(e) => setFineForm({ ...fineForm, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={fineForm.reason}
                    onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value as any })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                  >
                    <option>Saving Default</option>
                    <option>Interest Default</option>
                    <option>Other</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <input
                    type="text"
                    value={fineForm.note}
                    onChange={(e) => setFineForm({ ...fineForm, note: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={async () => {
                    if (!isAdmin) return;
                    if (!fineForm.memberId) {
                      toast.error('Select a member for the fine');
                      return;
                    }
                    const amount = parseFloat(fineForm.amount);
                    if (!amount || amount <= 0) {
                      toast.error('Enter a positive fine amount');
                      return;
                    }
                    try {
                      const list = fines || [];
                      const newItem: FinePayment = {
                        id: `F-${Date.now()}`,
                        memberId: fineForm.memberId,
                        date: fineForm.date,
                        amount,
                        reason: fineForm.reason,
                        note: fineForm.note || undefined,
                      };
                      const updated = [...list, newItem];
                      await writeFile('data/fines.json', updated);
                      setFines(updated);
                      await loadData();
                      resetForm();
                    } catch (e: any) {
                      toast.error('Failed to add fine: ' + e.message);
                    }
                  }}
                  className="bg-warning text-white px-6 py-2 rounded-lg hover:bg-warning/90"
                >
                  Save Fine
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Add Expenditure Form */}
          {showExpForm && isAdmin && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold mb-4">Add Expenditure</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={expForm.date}
                    onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <input
                    type="text"
                    placeholder="DayBook, A4 Paper, Pen, Stamp, Inkpad, etc."
                    value={expForm.item}
                    onChange={(e) => setExpForm({ ...expForm, item: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={expForm.amount}
                    onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <input
                    type="text"
                    value={expForm.note}
                    onChange={(e) => setExpForm({ ...expForm, note: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={async () => {
                    if (!isAdmin) return;
                    const amount = parseFloat(expForm.amount);
                    if (!expForm.item.trim()) {
                      toast.error('Enter expenditure item');
                      return;
                    }
                    if (!amount || amount <= 0) {
                      toast.error('Enter a positive expenditure amount');
                      return;
                    }
                    try {
                      const list = expenditures || [];
                      const newItem: Expenditure = {
                        id: `E-${Date.now()}`,
                        date: expForm.date,
                        item: expForm.item,
                        amount,
                        note: expForm.note || undefined,
                      };
                      const updated = [...list, newItem];
                      await writeFile('data/expenditures.json', updated);
                      setExpenditures(updated);
                      await loadData();
                      resetForm();
                    } catch (e: any) {
                      toast.error('Failed to add expenditure: ' + e.message);
                    }
                  }}
                  className="bg-danger text-white px-6 py-2 rounded-lg hover:bg-danger/90"
                >
                  Save Expenditure
                </button>
                <button
                  onClick={resetForm}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Payments Table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Loan Principal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Dues Principal</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Interest Payment</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loanId) => {
                      const loan = loans.find(l => l.id === loanId);
                      if (!loan) return null;
                      const member = members.find(m => m.id === loan.memberId);
                      const loanPayments = getLoanPayments(loanId);
                      const totalPrincipalPaid = loanPayments.reduce((sum, p) => sum + p.principalPaid, 0);
                      const totalInterestPaid = loanPayments.reduce((sum, p) => sum + p.interestPaid, 0);
                      const outstanding = getOutstanding(loan);
                      
                      return (
                        <tr key={loanId} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap font-medium">{loan.memberId}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{member?.name || '-'}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(loan.principal)}</td>
                          <td className="px-6 py-4 whitespace-nowrap font-semibold">{formatCurrency(outstanding)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">{formatCurrency(totalInterestPaid)}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => setViewingLoanId(loanId)}
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

          {/* Fine & Expenditure Records */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Fine Payments</h3>
                <span className="text-sm text-gray-500">
                  Total: {formatCurrency(fines.reduce((sum, f) => sum + f.amount, 0))}
                </span>
              </div>
              {fines.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No fines recorded.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Member</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...fines].sort((a, b) => (a.date < b.date ? 1 : -1)).map((fine) => {
                        const member = members.find((m) => m.id === fine.memberId);
                        return (
                          <tr key={fine.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{formatDate(fine.date)}</td>
                            <td className="px-4 py-2">
                              <div className="font-medium text-gray-800">{member?.name || fine.memberId}</div>
                              <div className="text-xs text-gray-500">{fine.memberId}</div>
                            </td>
                            <td className="px-4 py-2 text-right text-danger font-semibold">
                              {formatCurrency(fine.amount)}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{fine.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Expenditures</h3>
                <span className="text-sm text-gray-500">
                  Total: {formatCurrency(expenditures.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>
              {expenditures.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No expenditures recorded.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...expenditures].sort((a, b) => (a.date < b.date ? 1 : -1)).map((exp) => (
                        <tr key={exp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{formatDate(exp.date)}</td>
                          <td className="px-4 py-2 text-gray-800 font-medium">{exp.item}</td>
                          <td className="px-4 py-2 text-right text-danger font-semibold">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{exp.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* View Payment History Modal */}
          {viewingLoanId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">Payment History</h3>
                    <button
                      onClick={() => setViewingLoanId(null)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                  {(() => {
                    const loan = loans.find((l) => l.id === viewingLoanId);
                    if (!loan) return null;
                    const member = members.find((m) => m.id === loan.memberId);
                    const loanPayments = getLoanPayments(viewingLoanId);

                    return (
                      <>
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <p className="font-semibold">
                            {member?.name} ({loan.memberId})
                          </p>
                          <p className="text-sm text-gray-600">Loan: {formatCurrency(loan.principal)}</p>
                        </div>
                        <div className="space-y-2">
                          {loanPayments.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No payments yet</p>
                          ) : (
                            loanPayments.map((payment) => (
                              <div
                                key={payment.id}
                                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                              >
                                <div>
                                  <p className="font-semibold">{formatDate(payment.date)}</p>
                                  <p className="text-sm text-gray-600">
                                    Principal: {formatCurrency(payment.principalPaid)} | Interest:{' '}
                                    {formatCurrency(payment.interestPaid)}
                                  </p>
                                  {payment.remarks && (
                                    <p className="text-sm text-gray-500 mt-1">{payment.remarks}</p>
                                  )}
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        handleEdit(payment);
                                        setViewingLoanId(null);
                                      }}
                                      className="p-2 text-warning hover:bg-warning/10 rounded-lg"
                                    >
                                      <Edit size={18} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleDelete(payment);
                                        if (loanPayments.length === 1) {
                                          setViewingLoanId(null);
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

          {/* View Payment History Modal */}
          {viewingLoanId && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-2xl font-bold text-gray-800">Payment History</h3>
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
                    const loanPayments = getLoanPayments(viewingLoanId);
                    
                    return (
                      <>
                        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                          <p className="font-semibold">{member?.name} ({loan.memberId})</p>
                          <p className="text-sm text-gray-600">Loan: {formatCurrency(loan.principal)}</p>
                        </div>
                        <div className="space-y-2">
                          {loanPayments.length === 0 ? (
                            <p className="text-gray-500 text-center py-8">No payments yet</p>
                          ) : (
                            loanPayments.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-semibold">{formatDate(payment.date)}</p>
                                  <p className="text-sm text-gray-600">
                                    Principal: {formatCurrency(payment.principalPaid)} | 
                                    Interest: {formatCurrency(payment.interestPaid)}
                                  </p>
                                  {payment.remarks && (
                                    <p className="text-sm text-gray-500 mt-1">{payment.remarks}</p>
                                  )}
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        handleEdit(payment);
                                        setViewingLoanId(null);
                                      }}
                                      className="p-2 text-warning hover:bg-warning/10 rounded-lg"
                                    >
                                      <Edit size={18} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        handleDelete(payment);
                                        if (loanPayments.length === 1) {
                                          setViewingLoanId(null);
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
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Fine & Expenditure Records */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Fine Payments</h3>
                <span className="text-sm text-gray-500">Total: {formatCurrency(fines.reduce((sum, f) => sum + f.amount, 0))}</span>
              </div>
              {fines.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No fines recorded.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Member</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...fines].sort((a, b) => (a.date < b.date ? 1 : -1)).map(fine => {
                        const member = members.find(m => m.id === fine.memberId);
                        return (
                          <tr key={fine.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2">{formatDate(fine.date)}</td>
                            <td className="px-4 py-2">
                              <div className="font-medium text-gray-800">{member?.name || fine.memberId}</div>
                              <div className="text-xs text-gray-500">{fine.memberId}</div>
                            </td>
                            <td className="px-4 py-2 text-right text-danger font-semibold">
                              {formatCurrency(fine.amount)}
                            </td>
                            <td className="px-4 py-2 text-gray-600">{fine.reason}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-xl shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-gray-800">Expenditures</h3>
                <span className="text-sm text-gray-500">Total: {formatCurrency(expenditures.reduce((sum, e) => sum + e.amount, 0))}</span>
              </div>
              {expenditures.length === 0 ? (
                <p className="text-gray-500 text-center py-6">No expenditures recorded.</p>
              ) : (
                <div className="overflow-x-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase">
                      <tr>
                        <th className="px-4 py-2 text-left">Date</th>
                        <th className="px-4 py-2 text-left">Item</th>
                        <th className="px-4 py-2 text-right">Amount</th>
                        <th className="px-4 py-2 text-left">Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[...expenditures].sort((a, b) => (a.date < b.date ? 1 : -1)).map(exp => (
                        <tr key={exp.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2">{formatDate(exp.date)}</td>
                          <td className="px-4 py-2 text-gray-800 font-medium">{exp.item}</td>
                          <td className="px-4 py-2 text-right text-danger font-semibold">
                            {formatCurrency(exp.amount)}
                          </td>
                          <td className="px-4 py-2 text-gray-600">{exp.note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
