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
  const [viewingFine, setViewingFine] = useState<FinePayment | null>(null);
  const [viewingExpenditure, setViewingExpenditure] = useState<Expenditure | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { isAdmin } = useAuth();
  const [showFineForm, setShowFineForm] = useState(false);
  const [showExpForm, setShowExpForm] = useState(false);
  const [editingFine, setEditingFine] = useState<FinePayment | null>(null);
  const [editingExpenditure, setEditingExpenditure] = useState<Expenditure | null>(null);
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
    setEditingFine(null);
    setEditingExpenditure(null);
    setViewingFine(null);
    setViewingExpenditure(null);
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

  const handleDeleteFine = async (fine: FinePayment) => {
    if (!isAdmin) {
      toast.error('Only admins can delete fines');
      return;
    }

    if (!confirm('Are you sure you want to delete this fine payment?')) {
      return;
    }

    try {
      const updatedFines = fines.filter(f => f.id !== fine.id);
      await writeFile('data/fines.json', updatedFines);
      setFines(updatedFines);
      toast.success('Fine payment deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete fine: ' + error.message);
    }
  };

  const handleEditFine = (fine: FinePayment) => {
    setEditingFine(fine);
    setFineForm({
      memberId: fine.memberId,
      date: fine.date,
      amount: fine.amount.toString(),
      reason: fine.reason,
      note: fine.note || '',
    });
    setShowFineForm(true);
  };

  const handleDeleteExpenditure = async (exp: Expenditure) => {
    if (!isAdmin) {
      toast.error('Only admins can delete expenditures');
      return;
    }

    if (!confirm('Are you sure you want to delete this expenditure?')) {
      return;
    }

    try {
      const updatedExpenditures = expenditures.filter(e => e.id !== exp.id);
      await writeFile('data/expenditures.json', updatedExpenditures);
      setExpenditures(updatedExpenditures);
      toast.success('Expenditure deleted successfully');
    } catch (error: any) {
      toast.error('Failed to delete expenditure: ' + error.message);
    }
  };

  const handleEditExpenditure = (exp: Expenditure) => {
    setEditingExpenditure(exp);
    setExpForm({
      date: exp.date,
      item: exp.item,
      amount: exp.amount.toString(),
      note: exp.note || '',
    });
    setShowExpForm(true);
  };

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
        <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Payments</h2>
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
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info focus:border-transparent touch-manipulation text-base"
            />
          </div>

          {/* Add/Edit Form */}
          {(showAddForm || editingPayment) && isAdmin && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h3 className="text-lg sm:text-xl font-semibold mb-4">
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info touch-manipulation text-base"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info touch-manipulation text-base"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-gray-100 touch-manipulation text-base"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info touch-manipulation text-base"
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
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info touch-manipulation text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
                    <input
                      type="text"
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-info touch-manipulation text-base"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="submit"
                    className="bg-info text-white px-6 py-2.5 rounded-lg hover:bg-info/90 active:bg-info/80 touch-manipulation font-medium"
                  >
                    {editingPayment ? 'Update' : 'Add'} Payment
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

          {/* Add Fine Form */}
          {showFineForm && isAdmin && (
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h3 className="text-lg sm:text-xl font-semibold mb-4">
                {editingFine ? 'Edit Fine Payment' : 'Add Fine Payment'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Member</label>
                  <select
                    required
                    value={fineForm.memberId}
                    onChange={(e) => setFineForm({ ...fineForm, memberId: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning touch-manipulation text-base"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning touch-manipulation text-base"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning touch-manipulation text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <select
                    value={fineForm.reason}
                    onChange={(e) => setFineForm({ ...fineForm, reason: e.target.value as any })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning touch-manipulation text-base"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-warning touch-manipulation text-base"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
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
                      let updated: FinePayment[];
                      if (editingFine) {
                        updated = list.map(f => 
                          f.id === editingFine.id
                            ? {
                                ...f,
                                memberId: fineForm.memberId,
                                date: fineForm.date,
                                amount,
                                reason: fineForm.reason,
                                note: fineForm.note || undefined,
                              }
                            : f
                        );
                        toast.success('Fine payment updated successfully');
                      } else {
                        const newItem: FinePayment = {
                          id: `F-${Date.now()}`,
                          memberId: fineForm.memberId,
                          date: fineForm.date,
                          amount,
                          reason: fineForm.reason,
                          note: fineForm.note || undefined,
                        };
                        updated = [...list, newItem];
                        toast.success('Fine payment added successfully');
                      }
                      await writeFile('data/fines.json', updated);
                      setFines(updated);
                      await loadData();
                      resetForm();
                    } catch (e: any) {
                      toast.error('Failed to save fine: ' + e.message);
                    }
                  }}
                  className="bg-warning text-white px-6 py-2.5 rounded-lg hover:bg-warning/90 active:bg-warning/80 touch-manipulation font-medium"
                >
                  {editingFine ? 'Update' : 'Save'} Fine
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
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h3 className="text-lg sm:text-xl font-semibold mb-4">
                {editingExpenditure ? 'Edit Expenditure' : 'Add Expenditure'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    value={expForm.date}
                    onChange={(e) => setExpForm({ ...expForm, date: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger touch-manipulation text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Item</label>
                  <input
                    type="text"
                    placeholder="DayBook, A4 Paper, Pen, Stamp, Inkpad, etc."
                    value={expForm.item}
                    onChange={(e) => setExpForm({ ...expForm, item: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger touch-manipulation text-base"
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
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger touch-manipulation text-base"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                  <input
                    type="text"
                    value={expForm.note}
                    onChange={(e) => setExpForm({ ...expForm, note: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-danger touch-manipulation text-base"
                  />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
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
                      let updated: Expenditure[];
                      if (editingExpenditure) {
                        updated = list.map(e => 
                          e.id === editingExpenditure.id
                            ? {
                                ...e,
                                date: expForm.date,
                                item: expForm.item,
                                amount,
                                note: expForm.note || undefined,
                              }
                            : e
                        );
                        toast.success('Expenditure updated successfully');
                      } else {
                        const newItem: Expenditure = {
                          id: `E-${Date.now()}`,
                          date: expForm.date,
                          item: expForm.item,
                          amount,
                          note: expForm.note || undefined,
                        };
                        updated = [...list, newItem];
                        toast.success('Expenditure added successfully');
                      }
                      await writeFile('data/expenditures.json', updated);
                      setExpenditures(updated);
                      await loadData();
                      resetForm();
                    } catch (e: any) {
                      toast.error('Failed to save expenditure: ' + e.message);
                    }
                  }}
                  className="bg-danger text-white px-6 py-2.5 rounded-lg hover:bg-danger/90 active:bg-danger/80 touch-manipulation font-medium"
                >
                  {editingExpenditure ? 'Update' : 'Save'} Expenditure
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

          {/* All Payments Details Section */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-gray-200">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-800">All Payment Details</h3>
              <p className="text-sm text-gray-600 mt-1">Complete list of all payments including loan interest, fines, and expenditures</p>
            </div>
            <div className="table-container overflow-x-auto -webkit-overflow-scrolling-touch">
              <table className="w-full min-w-[800px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member/Item</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Principal Paid</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Interest Paid</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Fine/Expenditure</th>
                    <th className="px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Amount</th>
                    <th className="px-4 sm:px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {(() => {
                    const allPayments: Array<{
                      id: string;
                      date: string;
                      type: 'Loan Payment' | 'Fine Payment' | 'Expenditure';
                      memberName?: string;
                      memberId?: string;
                      item?: string;
                      principalPaid?: number;
                      interestPaid?: number;
                      fineAmount?: number;
                      expenditureAmount?: number;
                      totalAmount: number;
                      details?: string;
                      reason?: string;
                      note?: string;
                      loanId?: string;
                      payment?: Payment;
                      fine?: FinePayment;
                      expenditure?: Expenditure;
                    }> = [];

                    payments.forEach((payment) => {
                      const loan = loans.find(l => l.id === payment.loanId);
                      const member = loan ? members.find(m => m.id === loan.memberId) : null;
                      allPayments.push({
                        id: payment.id,
                        date: payment.date,
                        type: 'Loan Payment',
                        memberName: member?.name,
                        memberId: loan?.memberId,
                        principalPaid: payment.principalPaid,
                        interestPaid: payment.interestPaid,
                        totalAmount: payment.principalPaid + payment.interestPaid,
                        details: payment.remarks,
                        loanId: payment.loanId,
                        payment,
                      });
                    });

                    fines.forEach((fine) => {
                      const member = members.find(m => m.id === fine.memberId);
                      allPayments.push({
                        id: fine.id,
                        date: fine.date,
                        type: 'Fine Payment',
                        memberName: member?.name,
                        memberId: fine.memberId,
                        fineAmount: fine.amount,
                        totalAmount: fine.amount,
                        reason: fine.reason,
                        note: fine.note,
                        fine,
                      });
                    });

                    expenditures.forEach((exp) => {
                      allPayments.push({
                        id: exp.id,
                        date: exp.date,
                        type: 'Expenditure',
                        item: exp.item,
                        expenditureAmount: exp.amount,
                        totalAmount: exp.amount,
                        note: exp.note,
                        expenditure: exp,
                      });
                    });

                    const combinedPayments: typeof allPayments = [];
                    const loanGroups = new Map<string, typeof allPayments>();

                    allPayments.forEach((payment) => {
                      if (payment.type !== 'Loan Payment') {
                        combinedPayments.push(payment);
                        return;
                      }

                      const key = `${payment.memberId || payment.loanId || payment.id}_${payment.type}`;
                      if (!loanGroups.has(key)) {
                        loanGroups.set(key, []);
                      }
                      loanGroups.get(key)!.push(payment);
                    });

                    loanGroups.forEach((memberPayments) => {
                      if (memberPayments.length === 1) {
                        combinedPayments.push(memberPayments[0]);
                        return;
                      }

                      const firstPayment = memberPayments[0];
                      const combinedLoanPayment: typeof firstPayment = {
                        ...firstPayment,
                        principalPaid: memberPayments.reduce((sum, p) => sum + (p.principalPaid || 0), 0) || undefined,
                        interestPaid: memberPayments.reduce((sum, p) => sum + (p.interestPaid || 0), 0) || undefined,
                        totalAmount: memberPayments.reduce((sum, p) => sum + p.totalAmount, 0),
                        details: memberPayments.map(p => p.details).filter(Boolean).join('; ') || undefined,
                        note: memberPayments.map(p => p.note).filter(Boolean).join('; ') || undefined,
                        date: memberPayments.sort((a, b) => (a.date < b.date ? 1 : -1))[0].date,
                        payment: memberPayments[0].payment,
                      };

                      combinedPayments.push(combinedLoanPayment);
                    });

                    combinedPayments.sort((a, b) => {
                      if (a.date !== b.date) {
                        return a.date < b.date ? 1 : -1;
                      }
                      return (a.memberName || a.item || '').localeCompare(b.memberName || b.item || '');
                    });

                    const filtered = combinedPayments.filter((p) => {
                      if (!searchTerm) return true;
                      const search = searchTerm.toLowerCase();
                      return (
                        p.memberName?.toLowerCase().includes(search) ||
                        p.memberId?.toLowerCase().includes(search) ||
                        p.item?.toLowerCase().includes(search) ||
                        p.type.toLowerCase().includes(search)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={7} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                            No payments found
                          </td>
                        </tr>
                      );
                    }

                    return filtered.map((payment) => (
                      <tr key={payment.id} className="hover:bg-gray-50">
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">{formatDate(payment.date)}</td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm">
                          {payment.memberName ? (
                            <div>
                              <div className="font-medium text-gray-800">{payment.memberName}</div>
                              <div className="text-xs text-gray-500">{payment.memberId}</div>
                            </div>
                          ) : payment.item ? (
                            <div className="font-medium text-gray-800">{payment.item}</div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                          {payment.principalPaid !== undefined ? (
                            <span className="text-gray-800">{formatCurrency(payment.principalPaid)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                          {payment.interestPaid !== undefined ? (
                            <span className="text-info font-semibold">{formatCurrency(payment.interestPaid)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                          {payment.fineAmount !== undefined ? (
                            <span className="text-warning font-semibold">{formatCurrency(payment.fineAmount)}</span>
                          ) : payment.expenditureAmount !== undefined ? (
                            <span className="text-danger font-semibold">{formatCurrency(payment.expenditureAmount)}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-right text-sm">
                          <span className="font-bold text-gray-900">{formatCurrency(payment.totalAmount)}</span>
                        </td>
                        <td className="px-4 sm:px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-2">
                            {/* REVIEW BUTTON - Fixed with correct toast usage */}
                            <button
                              onClick={() => {
                                if (payment.type === 'Loan Payment' && payment.loanId) {
                                  setViewingExpenditure(null);
                                  setViewingFine(null);
                                  setViewingLoanId(payment.loanId);
                                } else if (payment.type === 'Fine Payment') {
                                  const fine = payment.fine ?? fines.find((f) => f.id === payment.id);
                                  if (fine) {
                                    setViewingLoanId(null);
                                    setViewingExpenditure(null);
                                    setViewingFine(fine);
                                  } else {
                                    toast.error('Fine details not found');
                                  }
                                } else if (payment.type === 'Expenditure') {
                                  const expenditure = payment.expenditure ?? expenditures.find((e) => e.id === payment.id);
                                  if (expenditure) {
                                    setViewingLoanId(null);
                                    setViewingFine(null);
                                    setViewingExpenditure(expenditure);
                                  } else {
                                    toast.error('Expenditure details not found');
                                  }
                                }
                              }}
                              className="p-2 text-info hover:bg-info/10 active:bg-info/20 rounded-lg transition-colors touch-manipulation"
                              title="Review"
                            >
                              <Eye size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
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
                                      className="p-2 text-warning hover:bg-warning/10 active:bg-warning/20 rounded-lg touch-manipulation"
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
                                      className="p-2 text-danger hover:bg-danger/10 active:bg-danger/20 rounded-lg touch-manipulation"
                                    >
                                      <Trash2 size={18} />
                                    </button>
                                  </div>
                                )}

      {/* View Fine Details Modal */}
      {viewingFine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Fine Details</h3>
                <button
                  onClick={() => setViewingFine(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              {(() => {
                const member = members.find((m) => m.id === viewingFine.memberId);
                return (
                  <>
                    <div className="space-y-3 mb-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Member</label>
                        <p className="text-lg font-semibold">
                          {member?.name || 'Unknown'} ({viewingFine.memberId})
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Amount</label>
                          <p className="text-lg font-semibold text-danger">{formatCurrency(viewingFine.amount)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Date</label>
                          <p className="text-lg">{formatDate(viewingFine.date)}</p>
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Reason</label>
                        <p className="text-base">{viewingFine.reason}</p>
                      </div>
                      {viewingFine.note && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Note</label>
                          <p className="text-base">{viewingFine.note}</p>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => {
                            handleEditFine(viewingFine);
                            setViewingFine(null);
                          }}
                          className="flex-1 bg-warning text-white px-4 py-2.5 rounded-lg hover:bg-warning/90 active:bg-warning/80 touch-manipulation font-medium"
                        >
                          Edit Fine
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteFine(viewingFine);
                            setViewingFine(null);
                          }}
                          className="flex-1 bg-danger text-white px-4 py-2.5 rounded-lg hover:bg-danger/90 active:bg-danger/80 touch-manipulation font-medium"
                        >
                          Delete Fine
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

      {/* View Expenditure Details Modal */}
      {viewingExpenditure && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold text-gray-800">Expenditure Details</h3>
                <button
                  onClick={() => setViewingExpenditure(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
              {(() => {
                return (
                  <>
                    <div className="space-y-3 mb-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">Item</label>
                          <p className="text-lg font-semibold">{viewingExpenditure.item}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Amount</label>
                          <p className="text-lg font-semibold text-danger">{formatCurrency(viewingExpenditure.amount)}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Date</label>
                          <p className="text-lg">{formatDate(viewingExpenditure.date)}</p>
                        </div>
                      </div>
                      {viewingExpenditure.note && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Note</label>
                          <p className="text-base">{viewingExpenditure.note}</p>
                        </div>
                      )}
                    </div>
                    {isAdmin && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
                        <button
                          onClick={() => {
                            handleEditExpenditure(viewingExpenditure);
                            setViewingExpenditure(null);
                          }}
                          className="flex-1 bg-warning text-white px-4 py-2.5 rounded-lg hover:bg-warning/90 active:bg-warning/80 touch-manipulation font-medium"
                        >
                          Edit Expenditure
                        </button>
                        <button
                          onClick={() => {
                            handleDeleteExpenditure(viewingExpenditure);
                            setViewingExpenditure(null);
                          }}
                          className="flex-1 bg-danger text-white px-4 py-2.5 rounded-lg hover:bg-danger/90 active:bg-danger/80 touch-manipulation font-medium"
                        >
                          Delete Expenditure
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
