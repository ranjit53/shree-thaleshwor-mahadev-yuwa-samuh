/**
 * Settings page - User management, Bulk saving, Backup/Restore, Reports
 * Features:
 * 1. Exact functional copies of Users, Bulk, Backup from 'settings (3).tsx'
 * 2. Professional Reports from 'sett.tsx'
 * 3. NEW: Automatic Nepali-to-English transliteration for PDF compatibility
 * 4. NEW: Group Chat for all logged-in users
 * 5. NEW: Monthly Reports with charts for all logged-in users
 */

import { useState, useEffect } from 'react';
import { readFile, writeFile, listFiles } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import type { Settings, Member, Saving, Loan, Payment, FinePayment, Expenditure } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { UserPlus, Upload, Download, RotateCcw, Save, FileText, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

// PDF libraries
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Chart libraries
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

// --- HELPER: Devanagari to English Transliteration ---
const transliterateToEnglish = (text: string): string => {
  if (!text) return '';
  
  // Mapping for Nepali/Devanagari characters
  const map: { [key: string]: string } = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo', 'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'अं': 'am', 'अः': 'ah',
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'f', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'w',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    'क्ष': 'ksh', 'त्र': 'tr', 'ज्ञ': 'gy',
    'ा': 'a', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ं': 'n', 'ः': 'ah', '्': '',
    '०': '0', '१': '1', '२': '2', '३': '3', '४': '4', '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
  };

  return text.split('').map(char => map[char] || char).join('');
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'users' | 'bulk' | 'backup' | 'reports' | 'monthly-reports' | 'chat'>('chat');
  const [backups, setBackups] = useState<string[]>([]);
  const { isAdmin, user } = useAuth();

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

  // Monthly reports states
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const [monthlyData, setMonthlyData] = useState<any>(null);

  // Chat states
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    if (isAdmin) {
      loadSettings();
      loadBackups();
      loadMembersForBulk();
    }
    setLoading(false);
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'monthly-reports') {
      generateMonthlyData();
    } else if (activeTab === 'chat') {
      loadMessages();
    }
  }, [activeTab, selectedMonth]);

  const loadSettings = async () => {
    try {
      const data = await readFile<Settings>('data/settings.json');
      setSettings(data || { users: [] });
    } catch (error: any) {
      toast.error('Failed to load settings: ' + error.message);
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
    if (!confirm(`Are you sure to delete user ${userId}?`)) {
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
  // IMPROVED REPORT GENERATION (ID FIRST, SERIAL WISE, P&L, TRANSLITERATION)
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
          transliterateToEnglish(m.member.name), // Transliterate Unicode Name to English
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

  // =========================================================
  // MONTHLY DATA GENERATION FOR UI (TABLE, PIE, BAR CHARTS)
  // =========================================================
  const generateMonthlyData = async () => {
    setMonthlyLoading(true);
    try {
      const [membersRes, savingsRes, loansRes, paymentsRes, finesRes, expRes] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Saving[]>('data/savings.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
        readFile<FinePayment[]>('data/fines.json'),
        readFile<Expenditure[]>('data/expenditures.json'),
      ]);

      const members = (membersRes ?? []).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      const savings = savingsRes ?? [];
      const loans = loansRes ?? [];
      const payments = paymentsRes ?? [];
      const fines = finesRes ?? [];
      const expenditures = expRes ?? [];

      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const inMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return d >= startDate && d <= endDate;
      };

      const filteredSavings = savings.filter(s => inMonth(s.date));
      const filteredLoans = loans.filter(l => inMonth(l.startDate));
      const filteredPayments = payments.filter(p => inMonth(p.date));
      const filteredFines = fines.filter(f => inMonth(f.date));
      const filteredExpenditures = expenditures.filter(e => inMonth(e.date));

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

      const memberLabels: string[] = [];
      const memberSavingsData: number[] = [];
      const memberLoansData: number[] = [];
      const memberInterestData: number[] = [];
      const memberFinesData: number[] = [];

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

        memberLabels.push(`${member.id} - ${member.name.slice(0, 10)}`);
        memberSavingsData.push(memSavings);
        memberLoansData.push(memLoans);
        memberInterestData.push(memInterestPaid);
        memberFinesData.push(memFines);
      });

      totalExpenditures = filteredExpenditures.reduce((sum, e) => sum + e.amount, 0);
      const outstandingLoans = totalLoansIssued - totalPrincipalPaid;
      const netBalance = totalSavings + totalInterest + totalFines - outstandingLoans - totalExpenditures;
      const grossIncome = totalInterest + totalFines;
      const netProfit = grossIncome - totalExpenditures;

      setMonthlyData({
        totalSavings,
        totalLoansIssued,
        outstandingLoans,
        totalInterest,
        totalFines,
        totalExpenditures,
        netBalance,
        grossIncome,
        netProfit,
        memberData,
        pieData: {
          labels: ['Savings', 'Interest', 'Fines', 'Expenditures', 'Outstanding Loans'],
          datasets: [{
            data: [totalSavings, totalInterest, totalFines, totalExpenditures, outstandingLoans],
            backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56', '#4BC0C0', '#9966FF'],
          }],
        },
        barData: {
          labels: memberLabels,
          datasets: [
            { label: 'Savings', data: memberSavingsData, backgroundColor: '#36A2EB' },
            { label: 'Loans Issued', data: memberLoansData, backgroundColor: '#FF6384' },
            { label: 'Interest Paid', data: memberInterestData, backgroundColor: '#FFCE56' },
            { label: 'Fines', data: memberFinesData, backgroundColor: '#4BC0C0' },
          ],
        },
      });
    } catch (error: any) {
      toast.error('Failed to generate monthly data: ' + error.message);
    } finally {
      setMonthlyLoading(false);
    }
  };

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 p-4 md:p-8">
          <h2 className="text-3xl font-bold text-gray-800">Settings</h2>

          {/* Tabs */}
          <div className="flex gap-4 border-b border-gray-200 overflow-x-auto">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 ${activeTab === 'chat' ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
            >
              <MessageSquare size={20} className="inline mr-2" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('monthly-reports')}
              className={`px-4 py-2 ${activeTab === 'monthly-reports' ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
            >
              <FileText size={20} className="inline mr-2" />
              Monthly Reports
            </button>
            {isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 ${activeTab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
                >
                  <UserPlus size={20} className="inline mr-2" />
                  Users
                </button>
                <button
                  onClick={() => setActiveTab('bulk')}
                  className={`px-4 py-2 ${activeTab === 'bulk' ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
                >
                  <Upload size={20} className="inline mr-2" />
                  Bulk Saving
                </button>
                <button
                  onClick={() => setActiveTab('backup')}
                  className={`px-4 py-2 ${activeTab === 'backup' ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
                >
                  <Download size={20} className="inline mr-2" />
                  Backup/Restore
                </button>
                <button
                  onClick={() => setActiveTab('reports')}
                  className={`px-4 py-2 ${activeTab === 'reports' ? 'border-b-2 border-primary text-primary' : 'text-gray-600'}`}
                >
                  <FileText size={20} className="inline mr-2" />
                  Quarterly/Annual Reports
                </button>
              </>
            )}
          </div>

          {/* Users Tab */}
          {activeTab === 'users' && isAdmin && (
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
          {activeTab === 'bulk' && isAdmin && (
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
          {activeTab === 'backup' && isAdmin && (
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
          {activeTab === 'reports' && isAdmin && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-primary">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary"><FileText size={24} />Professional Reports</h3>
                <div className="mb-6 max-w-xs">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Report Year</label>
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

          {/* Monthly Reports Tab */}
          {activeTab === 'monthly-reports' && (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-lg border-t-4 border-primary">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-primary"><FileText size={24} />Monthly Reports</h3>
                <div className="mb-6 max-w-xs">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                  />
                </div>

                {monthlyLoading && (
                  <p className="text-center text-gray-500 mt-6">Loading monthly data, please wait...</p>
                )}

                {!monthlyLoading && monthlyData && (
                  <div className="space-y-8">
                    {/* Summary */}
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Summary</h4>
                      <ul className="space-y-2">
                        <li>Total Savings: Rs {monthlyData.totalSavings.toFixed(2)}</li>
                        <li>Total Loans Issued: Rs {monthlyData.totalLoansIssued.toFixed(2)}</li>
                        <li>Outstanding Loans: Rs {monthlyData.outstandingLoans.toFixed(2)}</li>
                        <li>Total Interest: Rs {monthlyData.totalInterest.toFixed(2)}</li>
                        <li>Total Fines: Rs {monthlyData.totalFines.toFixed(2)}</li>
                        <li>Total Expenditures: Rs {monthlyData.totalExpenditures.toFixed(2)}</li>
                        <li>Net Balance: Rs {monthlyData.netBalance.toFixed(2)}</li>
                        <li>Gross Income: Rs {monthlyData.grossIncome.toFixed(2)}</li>
                        <li>Net Profit/Loss: Rs {monthlyData.netProfit.toFixed(2)}</li>
                      </ul>
                    </div>

                    {/* Pie Chart */}
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Aggregate Distribution (Pie Chart)</h4>
                      <div className="max-w-md mx-auto">
                        <Pie data={monthlyData.pieData} options={{ responsive: true }} />
                      </div>
                    </div>

                    {/* Bar Chart */}
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Member-wise Breakdown (Bar Chart)</h4>
                      <div className="overflow-x-auto">
                        <Bar data={monthlyData.barData} options={{ responsive: true, indexAxis: 'y' }} />
                      </div>
                    </div>

                    {/* Member-wise Table */}
                    <div>
                      <h4 className="text-lg font-semibold mb-4">Member-wise Details</h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full bg-white border border-gray-200">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 border">S.N.</th>
                              <th className="px-4 py-2 border">ID</th>
                              <th className="px-4 py-2 border">Name</th>
                              <th className="px-4 py-2 border">Savings</th>
                              <th className="px-4 py-2 border">Loans Issued</th>
                              <th className="px-4 py-2 border">Principal Paid</th>
                              <th className="px-4 py-2 border">Interest Paid</th>
                              <th className="px-4 py-2 border">Fines</th>
                              <th className="px-4 py-2 border">Net Contribution</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthlyData.memberData.map((m: any, index: number) => (
                              <tr key={m.member.id}>
                                <td className="px-4 py-2 border">{index + 1}</td>
                                <td className="px-4 py-2 border">{m.member.id}</td>
                                <td className="px-4 py-2 border">{m.member.name}</td>
                                <td className="px-4 py-2 border text-right">Rs {m.savings.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">Rs {m.loansIssued.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">Rs {m.principalPaid.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">Rs {m.interestPaid.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">Rs {m.fines.toFixed(2)}</td>
                                <td className="px-4 py-2 border text-right">Rs {m.netContribution.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
