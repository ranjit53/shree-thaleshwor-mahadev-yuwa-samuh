/**
 * Settings page - User management, Bulk saving, Backup/Restore, Reports
 * Full Code: Original logic for Users/Backup + New Professional Reports
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
  // IMPROVED REPORT GENERATION (ID FIRST, SERIAL WISE, P&L)
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

      // 1. Sort members by Member ID numerically
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

      const formatDateStr = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
      
      // Profit & Loss Calculations
      const grossIncome = totalInterest + totalFines;
      const netProfit = grossIncome - totalExpenditures;

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let y = 20;

      // Header
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text('Shree Thaleshwor Mahadev Yuwa Samuh', pageWidth / 2, y, { align: 'center' });

      y += 10;
      doc.setFontSize(16);
      const periodTitle = period === 'annual' 
        ? `${year} Annual Report` 
        : `${year} ${period.toUpperCase()} Quarterly Report`;
      doc.text(periodTitle, pageWidth / 2, y, { align: 'center' });

      y += 8;
      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Period: ${formatDateStr(startDate)} - ${formatDateStr(endDate)}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
      doc.text(`Generated on: ${new Date().toLocaleString('en-GB')}`, pageWidth / 2, y, { align: 'center' });

      y += 15;

      // Section 1: Balance Sheet Summary
      doc.setFillColor(30, 64, 175);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setTextColor(255);
      doc.setFontSize(11);
      doc.text('Balance Summary', pageWidth / 2, y + 5.5, { align: 'center' });
      y += 12;

      (doc as any).autoTable({
        startY: y,
        head: [['Account Description', 'Amount']],
        body: [
          ['Total Members Savings', formatCurrency(totalSavings)],
          ['Total Outstanding Loans', formatCurrency(outstandingLoans)],
          ['Net Available Cash Balance', formatCurrency(netBalance)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: 0 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // Section 2: Profit & Loss Statement (New)
      doc.setFillColor(5, 150, 105);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setTextColor(255);
      doc.setFontSize(11);
      doc.text('Profit & Loss Statement', pageWidth / 2, y + 5.5, { align: 'center' });
      y += 12;

      (doc as any).autoTable({
        startY: y,
        head: [['Income & Expenditure Description', 'Amount']],
        body: [
          ['Interest Earned (+)', formatCurrency(totalInterest)],
          ['Fines Collected (+)', formatCurrency(totalFines)],
          ['Total Revenue', formatCurrency(grossIncome)],
          ['Operating Expenses (-)', formatCurrency(totalExpenditures)],
          [netProfit >= 0 ? 'NET PROFIT' : 'NET LOSS', formatCurrency(netProfit)],
        ],
        theme: 'grid',
        headStyles: { fillColor: [5, 150, 105], textColor: 255, fontSize: 10, fontStyle: 'bold' },
        bodyStyles: { fontSize: 9, textColor: 0 },
        columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
        margin: { left: 14, right: 14 },
        didParseCell: function(data: any) {
          if (data.section === 'body' && data.row.index === 4) {
            data.cell.styles.fillColor = netProfit >= 0 ? [209, 250, 229] : [254, 226, 226];
          }
        }
      });

      y = (doc as any).lastAutoTable.finalY + 15;

      // Section 3: Member Details (Serial Wise, ID First)
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
      doc.setFillColor(30, 64, 175);
      doc.rect(14, y, pageWidth - 28, 8, 'F');
      doc.setTextColor(255);
      doc.setFontSize(11);
      doc.text('Member-wise Detailed Report', pageWidth / 2, y + 5.5, { align: 'center' });
      y += 12;

      (doc as any).autoTable({
        startY: y,
        head: [['S.N.', 'ID', 'Member Name', 'Savings', 'Loans', 'P. Paid', 'Int. Paid', 'Fines', 'Net']],
        body: memberData.map((m, index) => [
          index + 1, // Sequential Serial Number
          m.member.id, // ID first
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
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 18, fontStyle: 'bold' },
          2: { cellWidth: 35 },
          3: { halign: 'right', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 20 },
          5: { halign: 'right', cellWidth: 20 },
          6: { halign: 'right', cellWidth: 20 },
          7: { halign: 'right', cellWidth: 15 },
          8: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        },
        margin: { left: 14, right: 14 },
      });

      doc.setFontSize(10);
      doc.setTextColor(128);
      doc.text('Shree Thaleshwor Mahadev Yuwa Samuh Management System', pageWidth / 2, pageHeight - 15, { align: 'center' });

      const filename = `${periodTitle.replace(/[^a-zA-Z0-9]/g, '_')}_Financial_Report.pdf`;
      doc.save(filename);
      toast.success('Professional report downloaded!');
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
            <button onClick={() => setActiveTab('users')} className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}>Users</button>
            <button onClick={() => setActiveTab('bulk')} className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'bulk' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}>Bulk Saving</button>
            <button onClick={() => setActiveTab('backup')} className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'backup' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}>Backup/Restore</button>
            <button onClick={() => setActiveTab('reports')} className={`px-4 py-2 font-medium transition-colors touch-manipulation whitespace-nowrap ${activeTab === 'reports' ? 'border-b-2 border-primary text-primary' : 'text-gray-600 hover:text-gray-800 active:text-gray-900'}`}>Reports</button>
          </div>

          {/* User Management Tab */}
          {activeTab === 'users' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2"><UserPlus size={24} />Add New User</h3>
                <form onSubmit={handleAddUser} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
                      <input type="text" required value={userForm.userId} onChange={(e) => setUserForm({ ...userForm, userId: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                      <input type="text" required value={userForm.name} onChange={(e) => setUserForm({ ...userForm, name: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <input type="password" required value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                      <select required value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value as 'Admin' | 'Viewer' })} className="w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-primary">
                        <option value="Viewer">Viewer</option>
                        <option value="Admin">Admin</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="bg-primary text-white px-6 py-2.5 rounded-lg hover:bg-primary/90 font-medium">Add User</button>
                </form>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Existing Users</h3>
                <div className="space-y-2">
                  {settings?.users.map((user) => (
                    <div key={user.userId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
                      <div>
                        <p className="font-semibold">{user.name} ({user.userId})</p>
                        <p className="text-sm text-gray-600">Role: {user.role}</p>
                      </div>
                      <button onClick={() => handleDeleteUser(user.userId)} className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 touch-manipulation font-medium">Delete</button>
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
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2"><Upload size={24} />Bulk Fixed Saving</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                    <input type="number" value={bulkFixedAmount} onChange={(e) => setBulkFixedAmount(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={bulkFixedDate} onChange={(e) => setBulkFixedDate(e.target.value)} className="w-full px-4 py-2 border rounded-lg" />
                  </div>
                  <div className="flex items-end">
                    <button onClick={applyBulkFixedSavings} className="w-full bg-green-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-green-700">Apply to Selected ({selectedMemberIds.size})</button>
                  </div>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b">
                    <input id="select-all" type="checkbox" checked={selectAllMembers} onChange={(e) => toggleSelectAllMembers(e.target.checked)} />
                    <label htmlFor="select-all" className="font-medium cursor-pointer">Select All Members ({members.length})</label>
                  </div>
                  <div className="max-h-72 overflow-auto divide-y">
                    {members.map((m) => (
                      <label key={m.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
                        <input type="checkbox" checked={selectedMemberIds.has(m.id)} onChange={(e) => toggleMember(m.id, e.target.checked)} />
                        <span className="font-medium text-gray-800">{m.name}</span><span className="text-sm text-gray-500">({m.id})</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4">Bulk Import (CSV/JSON)</h3>
                <textarea value={bulkData} onChange={(e) => setBulkData(e.target.value)} placeholder="Format: MemberId,Amount,Date" className="w-full h-32 p-3 border rounded-lg font-mono text-sm" />
                <button onClick={handleBulkSaving} className="mt-3 bg-primary text-white px-6 py-2 rounded-lg font-medium">Import Data</button>
              </div>
            </div>
          )}

          {/* Backup/Restore Tab */}
          {activeTab === 'backup' && (
            <div className="space-y-6">
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2"><Download size={24} />Data Backup</h3>
                <button onClick={handleBackup} className="bg-primary text-white px-8 py-3 rounded-lg font-bold flex items-center gap-2"><Save size={20}/>Create New Backup File</button>
              </div>
              <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 flex items-center gap-2"><RotateCcw size={24} />Restore Data</h3>
                <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 mb-6 text-center">
                   <input type="file" accept=".json" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const data = JSON.parse(await file.text()); handleRestoreFromObject(data);
                    }} className="text-sm" />
                </div>
                <div className="space-y-2">
                  <h4 className="font-medium text-gray-700">Recent Server Backups:</h4>
                  {backups.map((b) => (
                    <div key={b} className="flex items-center justify-between p-3 bg-white border rounded-lg">
                      <span className="text-xs font-mono">{b.replace('backups/', '')}</span>
                      <div className="flex gap-2">
                         <button onClick={() => downloadBackup(b)} className="px-3 py-1 bg-gray-200 rounded text-xs">Download</button>
                         <button onClick={() => handleRestore(b)} className="px-3 py-1 bg-orange-600 text-white rounded text-xs">Restore</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Reports Tab */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-primary">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary"><FileText size={24} />Professional Reports</h3>
                <div className="mb-6 max-w-xs">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Report Year</label>
                  <input type="number" value={selectedReportYear} onChange={(e) => setSelectedReportYear(parseInt(e.target.value))} className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <button onClick={() => generateReport('q1')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow-md hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-2">1st Quarter (Jan-Mar)</button>
                  <button onClick={() => generateReport('q2')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow-md hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-2">2nd Quarter (Apr-Jun)</button>
                  <button onClick={() => generateReport('q3')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow-md hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-2">3rd Quarter (Jul-Sep)</button>
                  <button onClick={() => generateReport('q4')} disabled={reportLoading} className="bg-primary text-white py-4 px-6 rounded-lg shadow-md hover:translate-y-[-2px] transition-transform flex items-center justify-center gap-2">4th Quarter (Oct-Dec)</button>
                  <button onClick={() => generateReport('annual')} disabled={reportLoading} className="bg-green-700 text-white py-4 px-6 rounded-lg shadow-md md:col-span-2 font-bold text-lg hover:bg-green-800 transition-colors">Download Annual Statement ({selectedReportYear})</button>
                </div>
                {reportLoading && <div className="mt-6 text-center text-primary font-medium animate-pulse">Generating PDF... Please wait.</div>}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
