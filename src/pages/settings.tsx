/**
 * Settings page - User management, Bulk saving, Backup/Restore, Reports
 */

import { useState, useEffect } from 'react';
import { readFile, writeFile, listFiles } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import type { Settings, Member, Saving, Loan, Payment, FinePayment, Expenditure } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { UserPlus, Upload, Download, RotateCcw, Save, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

// PDF libraries
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'bulk' | 'backup' | 'reports'>('users');
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
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [bulkFixedAmount, setBulkFixedAmount] = useState<string>('');
  const [bulkFixedDate, setBulkFixedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectAllMembers, setSelectAllMembers] = useState<boolean>(true);

  // Report states
  const [reportLoading, setReportLoading] = useState(false);
  const [selectedReportYear, setSelectedReportYear] = useState<number>(new Date().getFullYear());

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      loadBackups();
      loadMembersForBulk();
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

  const loadMembersForBulk = async () => {
    try {
      const list = await readFile<Member[]>('data/members.json');
      const m = list || [];
      setMembers(m);
      const all = new Set(m.map(mm => mm.id));
      setSelectedMemberIds(all);
      setSelectAllMembers(true);
    } catch (e) {
      // ignore
    }
  };

  const loadBackups = async () => {
    try {
      const files = await listFiles('backups');
      setBackups(files.filter(f => f.endsWith('.json')));
    } catch (error: any) {
      console.error('Failed to load backups:', error);
      toast.error('Failed to load backups: ' + error.message);
    }
  };

  const toggleSelectAllMembers = (checked: boolean) => {
    setSelectAllMembers(checked);
    if (checked) {
      setSelectedMemberIds(new Set(members.map(m => m.id)));
    } else {
      setSelectedMemberIds(new Set());
    }
  };

  const toggleMember = (id: string, checked: boolean) => {
    const next = new Set(selectedMemberIds);
    if (checked) next.add(id); else next.delete(id);
    setSelectedMemberIds(next);
    setSelectAllMembers(next.size === members.length && members.length > 0);
  };

  const applyBulkFixedSavings = async () => {
    if (!isAdmin) {
      toast.error('Only admins can perform bulk operations');
      return;
    }
    const amount = parseFloat(bulkFixedAmount || '0');
    if (!amount || amount <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    if (!bulkFixedDate) {
      toast.error('Select a date');
      return;
    }
    if (selectedMemberIds.size === 0) {
      toast.error('Select at least one member');
      return;
    }
    try {
      toast.loading(`Adding savings for ${selectedMemberIds.size} members...`, { id: 'bulk-saving' });
      const existing = (await readFile<Saving[]>('data/savings.json')) || [];
      const now = Date.now();
      const add: Saving[] = Array.from(selectedMemberIds).map((memberId, idx) => ({
        id: `S-${now}-${idx}`,
        memberId,
        amount,
        date: bulkFixedDate,
        remarks: 'Bulk fixed saving',
      }));
      await writeFile('data/savings.json', [...existing, ...add]);
      toast.success(`Successfully added ${add.length} saving records`, { id: 'bulk-saving' });
      setBulkFixedAmount('');
    } catch (error: any) {
      toast.error('Failed to add bulk savings: ' + error.message, { id: 'bulk-saving' });
      console.error('Bulk saving error:', error);
    }
  };

  const downloadBackup = async (backupPath: string) => {
    try {
      toast.loading('Downloading backup...', { id: 'download-backup' });
      const data = await readFile<any>(backupPath);
      if (!data) {
        toast.error('Failed to read backup content', { id: 'download-backup' });
        return;
      }
      const backupData = data.timestamp ? data : { timestamp: new Date().toISOString(), ...data };
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const namePart = backupPath.split('/').pop() || 'backup.json';
      a.download = namePart.endsWith('.json') ? namePart : `${namePart}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded successfully', { id: 'download-backup' });
    } catch (error: any) {
      toast.error('Failed to download backup: ' + (error.message || 'Unknown error'), { id: 'download-backup' });
      console.error('Download backup error:', error);
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
      let records: Array<{ memberId: string; amount: number; date: string }> = [];
      if (bulkData.trim().startsWith('[')) {
        records = JSON.parse(bulkData);
      } else {
        const lines = bulkData.trim().split('\n');
        if (lines.length < 1) {
          toast.error('Paste CSV or JSON data');
          return;
        }
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
          if (values.length < headers.length) continue;
          records.push({
            memberId: values[memberIdIndex].trim(),
            amount: parseFloat(values[amountIndex].trim()),
            date: values[dateIndex].trim() || `${selectedMonth}-01`,
          });
        }
      }
      const membersList = await readFile<Member[]>('data/members.json') || [];
      const memberIds = new Set(membersList.map(m => m.id));
      const invalidRecords = records.filter(r => !memberIds.has(r.memberId) || isNaN(r.amount));
      if (invalidRecords.length > 0) {
        toast.error(`Invalid records found (check member ID or amount)`);
        return;
      }
      const existingSavings = await readFile<Saving[]>('data/savings.json') || [];
      const newSavings = records.map((record, idx) => ({
        id: `S-${Date.now()}-${idx}`,
        memberId: record.memberId,
        amount: record.amount,
        date: record.date,
        remarks: 'Bulk import',
      }));
      await writeFile('data/savings.json', [...existingSavings, ...newSavings]);
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
      const [members, savings, loans, payments, fines, expenditures, settingsData] = await Promise.all([
        readFile('data/members.json'),
        readFile('data/savings.json'),
        readFile('data/loans.json'),
        readFile('data/payments.json'),
        readFile('data/fines.json'),
        readFile('data/expenditures.json'),
        readFile('data/settings.json'),
      ]);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const backupData = {
        timestamp,
        members: members || [],
        savings: savings || [],
        loans: loans || [],
        payments: payments || [],
        fines: fines || [],
        expenditures: expenditures || [],
        settings: settingsData || { users: [] },
      };
      const filename = `backups/backup-${timestamp}.json`;
      await writeFile(filename, backupData);
      toast.success('Backup created successfully');
      await loadBackups();
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
      await Promise.all([
        writeFile('data/members.json', backupData.members || []),
        writeFile('data/savings.json', backupData.savings || []),
        writeFile('data/loans.json', backupData.loans || []),
        writeFile('data/payments.json', backupData.payments || []),
        writeFile('data/fines.json', backupData.fines || []),
        writeFile('data/expenditures.json', backupData.expenditures || []),
        writeFile('data/settings.json', backupData.settings || { users: [] }),
      ]);
      toast.success('Data restored successfully');
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to restore backup: ' + error.message);
    }
  };

  const handleRestoreFromObject = async (backupData: any) => {
    if (!isAdmin) {
      toast.error('Only admins can restore backups');
      return;
    }
    if (!backupData || !confirm('Restore from uploaded backup? This will overwrite all current data.')) {
      return;
    }
    try {
      await Promise.all([
        writeFile('data/members.json', backupData.members || []),
        writeFile('data/savings.json', backupData.savings || []),
        writeFile('data/loans.json', backupData.loans || []),
        writeFile('data/payments.json', backupData.payments || []),
        writeFile('data/fines.json', backupData.fines || []),
        writeFile('data/expenditures.json', backupData.expenditures || []),
        writeFile('data/settings.json', backupData.settings || { users: [] }),
      ]);
      toast.success('Data restored from uploaded file');
      window.location.reload();
    } catch (error: any) {
      toast.error('Failed to restore uploaded backup: ' + error.message);
    }
  };

  // =========================================================
  // UPDATED: FIXED ENGLISH PROFESSIONAL REPORT
  // =========================================================
  const generateReport = async (period: 'q1' | 'q2' | 'q3' | 'q4' | 'annual') => {
    setReportLoading(true);
    try {
      const [membersRes, savingsRes, loansRes, paymentsRes, finesRes, expRes] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Saving[]>('data/savings.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
        readFile<FinePayment[]>('data/fines.json'),
        readFile<Expenditure[]>('data/expenditures.json'),
      ]);

      // SORTED BY ID: M-0001, M-0002...
      const members = (membersRes ?? []).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      const savings = savingsRes ?? [];
      const loans = loansRes ?? [];
      const payments = paymentsRes ?? [];
      const fines = finesRes ?? [];
      const expenditures = expRes ?? [];

      const year = selectedReportYear;
      let startDate: Date, endDate: Date;

      if (period === 'annual') {
        startDate = new Date(year, 0, 1);
        endDate = new Date(year, 11, 31);
      } else {
        const quarter = parseInt(period.slice(1)) - 1;
        startDate = new Date(year, quarter * 3, 1);
        endDate = new Date(year, quarter * 3 + 3, 0);
      }

      const formatDate = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const formatCurrency = (amount: number) => `Rs ${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

      const inPeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= startDate && d <= endDate;
      };

      const filteredSavings = savings.filter(s => inPeriod(s.date));
      const filteredLoans = loans.filter(l => inPeriod(l.startDate));
      const filteredPayments = payments.filter(p => inPeriod(p.date));
      const filteredFines = fines.filter(f => inPeriod(f.date));
      const filteredExpenditures = expenditures.filter(e => inPeriod(e.date));

      let totalSavings = 0, totalLoansIssued = 0, totalPrincipalPaid = 0, totalInterest = 0;
      let totalFines = 0, totalExpenditures = 0;

      const memberData: Array<{
        member: Member;
        savings: number;
        loansIssued: number;
        principalPaid: number;
        interestPaid: number;
        fines: number;
        netContribution: number;
      }> = [];

      members.forEach(member => {
        const memSavings = filteredSavings.filter(s => s.memberId === member.id).reduce((sum, s) => sum + s.amount, 0);
        const memLoans = filteredLoans.filter(l => l.memberId === member.id).reduce((sum, l) => sum + l.principal, 0);
        const memPayments = filteredPayments.filter(p => p.memberId === member.id);
        const memPrincipalPaid = memPayments.reduce((sum, p) => sum + p.principalPaid, 0);
        const memInterestPaid = memPayments.reduce((sum, p) => sum + p.interestPaid, 0);
        const memFines = filteredFines.filter(f => f.memberId === member.id).reduce((sum, f) => sum + f.amount, 0);

        totalSavings += memSavings;
        totalLoansIssued += memLoans;
        totalPrincipalPaid += memPrincipalPaid;
        totalInterest += memInterestPaid;
        totalFines += memFines;

        memberData.push({
          member,
          savings: memSavings,
          loansIssued: memLoans,
          principalPaid: memPrincipalPaid,
          interestPaid: memInterestPaid,
          fines: memFines,
          netContribution: memSavings + memInterestPaid + memFines - memLoans,
        });
      });

      totalExpenditures = filteredExpenditures.reduce((sum, e) => sum + e.amount, 0);
      const outstandingLoans = totalLoansIssued - totalPrincipalPaid;
      const netBalance = totalSavings + totalInterest + totalFines - outstandingLoans - totalExpenditures;

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 20;

      // Header
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Shree Thaleshwor Mahadev Yuwa Samuh , Financial Report', pageWidth / 2, y, { align: 'center' });

      y += 10;
      doc.setFontSize(16);
      const periodTitle = period === 'annual' 
        ? `${year} Annual Report` 
        : `${year} ${period.toUpperCase()} Quarterly Report`;
      doc.text(periodTitle, pageWidth / 2, y, { align: 'center' });

      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Period: ${formatDate(startDate)} – ${formatDate(endDate)}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, pageWidth / 2, y, { align: 'center' });

      y += 15;

      // Overall Financial Summary
      doc.setFillColor(30, 64, 175);
      doc.rect(14, y, pageWidth - 28, 10, 'F');
      doc.setTextColor(255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Overall Financial Summary', pageWidth / 2, y + 7, { align: 'center' });

      y += 18;

      (doc as any).autoTable({
        startY: y,
        head: [['Description', 'Amount']],
        body: [
          ['Total Savings Collected', formatCurrency(totalSavings)],
          ['Total Loans Issued', formatCurrency(totalLoansIssued)],
          ['Principal Repaid', formatCurrency(totalPrincipalPaid)],
          ['Interest Collected', formatCurrency(totalInterest)],
          ['Fines Collected', formatCurrency(totalFines)],
          ['Total Expenditures', formatCurrency(totalExpenditures)],
          ['Outstanding Loans', formatCurrency(outstandingLoans)],
          ['Net Available Balance', formatCurrency(netBalance)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 11, fontStyle: 'bold' },
        bodyStyles: { fontSize: 10, textColor: 0 },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 20;

      // Member-wise Detailed Report
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }
      doc.setFillColor(30, 64, 175);
      doc.rect(14, y, pageWidth - 28, 10, 'F');
      doc.setTextColor(255);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('Member-wise Financial Details', pageWidth / 2, y + 7, { align: 'center' });

      y += 18;

      (doc as any).autoTable({
        startY: y,
        // UPDATED: Added S.N. and placed ID before Name
        head: [['S.N.', 'ID', 'Member Name', 'Savings', 'Loans', 'P. Paid', 'Int. Paid', 'Fines', 'Net']],
        body: memberData.map((m, index) => [
          index + 1,
          m.member.id,
          m.member.name,
          formatCurrency(m.savings),
          formatCurrency(m.loansIssued),
          formatCurrency(m.principalPaid),
          formatCurrency(m.interestPaid),
          formatCurrency(m.fines),
          formatCurrency(m.netContribution),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7, textColor: 0 },
        alternateRowStyles: { fillColor: [240, 249, 255] },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' }, // S.N.
          1: { cellWidth: 18, fontStyle: 'bold' }, // ID
          2: { cellWidth: 35 }, // Name
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 20 },
          6: { halign: 'right', cellWidth: 20 },
          7: { halign: 'right', cellWidth: 15 },
          8: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
      });

      // Footer
      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text('Generated by Shree Thaleshwor Mahadev Yuwa Samuh', pageWidth / 2, pageHeight - 15, { align: 'center' });

      const filename = `${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Detailed_Report.pdf`;
      doc.save(filename);

      toast.success('Detailed member-wise report downloaded successfully!');
    } catch (error: any) {
      toast.error('Failed to generate report: ' + error.message);
    } finally {
      setReportLoading(false);
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
        <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-x-hidden">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Settings</h2>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 overflow-x-auto -webkit-overflow-scrolling-touch">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}
            >
              Users
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'bulk' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}
            >
              Bulk Saving
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'backup' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}
            >
              Backup/Restore
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'reports' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}
            >
              Reports
            </button>
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
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
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary touch-manipulation text-base"
                      >
                        <option value="Viewer">Viewer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90 active:bg-primary/80 touch-manipulation font-medium"
                  >
                    Add User
                  </button>
                </form>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Existing Users</h3>
                <div className="space-y-2">
                  {settings?.users.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-semibold">{user.name} ({user.userId})</p>
                        <p className="text-sm text-gray-600">Role: {user.role}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteUser(user.userId)}
                        className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 touch-manipulation font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {(!settings?.users || settings.users.length === 0) && (
                    <p className="text-gray-500 text-center py-8">No users yet.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Bulk Saving Tab */}
          {activeTab === 'bulk' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                  <Upload size={24} />
                  Bulk Fixed Saving (Same Amount to Selected Members)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount (per member) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={bulkFixedAmount}
                      onChange={(e) => setBulkFixedAmount(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={bulkFixedDate}
                      onChange={(e) => setBulkFixedDate(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={applyBulkFixedSavings}
                      className="w-full bg-green-600 text-white px-6 py-2.5 rounded-lg hover:bg-green-700 active:bg-green-800 touch-manipulation font-medium"
                    >
                      Apply to Selected ({selectedMemberIds.size})
                    </button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
                    <input
                      id="select-all-members"
                      type="checkbox"
                      checked={selectAllMembers}
                      onChange={(e) => toggleSelectAllMembers(e.target.checked)}
                    />
                    <label htmlFor="select-all-members" className="font-medium">
                      Select all members
                    </label>
                    <span className="text-sm text-gray-500">({members.length} members)</span>
                  </div>
                  <div className="max-h-64 overflow-auto divide-y">
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.has(m.id)}
                          onChange={(e) => toggleMember(m.id, e.target.checked)}
                        />
                        <span className="font-medium">{m.name}</span>
                        <span className="text-sm text-gray-500">({m.id})</span>
                      </label>
                    ))}
                    {members.length === 0 && (
                      <div className="px-4 py-6 text-gray-500 text-center">No members available.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Bulk Import via CSV/JSON</h3>
                <textarea
                  value={bulkData}
                  onChange={(e) => setBulkData(e.target.value)}
                  placeholder="Paste CSV (MemberId,Amount,Date) or JSON array"
                  className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg font-mono text-sm"
                />
                <button
                  onClick={handleBulkSaving}
                  className="mt-4 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90"
                >
                  Import Savings
                </button>
              </div>
            </div>
          )}

          {/* Backup/Restore Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                  <Download size={24} />
                  Create Backup
                </h3>
                <p className="text-gray-600 mb-4">
                  Create a snapshot of all data files (members, savings, loans, payments, settings).
                </p>
                <button
                  onClick={handleBackup}
                  className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90 active:bg-primary/80 touch-manipulation font-medium"
                >
                  <Download size={20} />
                  Create Backup Now
                </button>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2">
                  <RotateCcw size={24} />
                  Restore from Backup
                </h3>
                <p className="text-gray-600 mb-6">
                  Select a backup file to restore. <strong className="text-red-600">This will overwrite all current data.</strong>
                </p>

                <div className="mb-8 p-5 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Upload Backup File (from your computer)
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Choose a previously downloaded <code className="bg-gray-200 px-1 rounded">backup-YYYYMMDD-HHMMSS.json</code> file
                  </p>
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const text = await file.text();
                        const data = JSON.parse(text);
                        await handleRestoreFromObject(data);
                      } catch (err: any) {
                        toast.error('Invalid or corrupted backup file');
                      } finally {
                        if (e.currentTarget) e.currentTarget.value = '';
                      }
                    }}
                    className="block w-full text-sm text-gray-700 file:mr-4 file:py-2.5 file:px-5 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-md font-medium text-gray-700">
                      Or restore from server backups:
                    </h4>
                    <button
                      onClick={loadBackups}
                      className="px-3 py-1.5 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center gap-1 touch-manipulation"
                    >
                      <RotateCcw size={14} />
                      Refresh
                    </button>
                  </div>
                  {backups.length === 0 ? (
                    <p className="text-gray-500 italic">No server backups available yet. Create one above and refresh.</p>
                  ) : (
                    <div className="space-y-2">
                      {backups.map((backup) => (
                        <div
                          key={backup}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                        >
                          <code className="text-xs font-mono text-gray-700">{backup.replace('backups/', '')}</code>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => downloadBackup(backup)}
                              className="px-3 py-1.5 text-xs bg-gray-200 text-gray-800 rounded hover:bg-gray-300 flex items-center gap-1 touch-manipulation"
                            >
                              <Download size={14} />
                              Download
                            </button>
                            <button
                              onClick={() => handleRestore(backup)}
                              className="px-4 py-1.5 text-xs bg-orange-600 text-white rounded hover:bg-orange-700 touch-manipulation font-medium"
                            >
                              Restore
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText size={24} className="text-primary" />
                  Download Financial Reports
                </h3>
                <p className="text-gray-600 mb-6">
                  Select a year and generate PDF reports for quarterly or annual financial summary with member-wise details.
                </p>

                <div className="mb-8 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Year
                  </label>
                  <input
                    type="number"
                    min="2000"
                    max="2100"
                    value={selectedReportYear}
                    onChange={(e) => setSelectedReportYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                  <p className="text-xs text-gray-500 mt-1">Current year: {new Date().getFullYear()}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <button onClick={() => generateReport('q1')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 font-medium">
                    <Download size={20} />
                    1st Quarter ({selectedReportYear} Jan–Mar)
                  </button>
                  <button onClick={() => generateReport('q2')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 font-medium">
                    <Download size={20} />
                    2nd Quarter ({selectedReportYear} Apr–Jun)
                  </button>
                  <button onClick={() => generateReport('q3')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 font-medium">
                    <Download size={20} />
                    3rd Quarter ({selectedReportYear} Jul–Sep)
                  </button>
                  <button onClick={() => generateReport('q4')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2 font-medium">
                    <Download size={20} />
                    4th Quarter ({selectedReportYear} Oct–Dec)
                  </button>
                  <button onClick={() => generateReport('annual')} disabled={reportLoading} className="bg-green-600 text-white py-4 px-6 rounded-lg shadow hover:bg-green-700 disabled:opacity-60 flex items-center justify-center gap-2 font-medium md:col-span-2">
                    <Download size={20} />
                    Annual Report (Full Year {selectedReportYear})
                  </button>
                </div>

                {reportLoading && (
                  <p className="text-center text-gray-500 mt-6">Generating report, please wait...</p>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
