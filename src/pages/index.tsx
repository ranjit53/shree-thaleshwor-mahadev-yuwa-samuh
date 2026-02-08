/**
 * Dashboard page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile } from '@/lib/api';
// FIX: Ensure all necessary utility functions are correctly imported.
import { formatCurrency, formatNumber, formatDate, calculateOutstandingPrincipal } from '@/lib/utils'; 
import type { Member, Saving, Loan, Payment, FinePayment, Expenditure } from '@/types';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Users, PiggyBank, CreditCard, DollarSign, TrendingUp, TrendingDown, AlertTriangle, UserX } from 'lucide-react';
import { useRouter } from 'next/router';
import toast from 'react-hot-toast';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#3b82f6'];

// New types to include date and pending count
type SavingDefaulter = {
  id: string;
  name: string;
  lastSavingDate: string; // The exact YYYY-MM-DD date
  pendingMonths: number;
};

// New type for Interest Defaulters
type InterestDefaulter = {
  id: string;
  name: string;
  lastPaymentDate: string; // The exact YYYY-MM-DD date of last interest payment
  pendingMonths: number;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalSaving: 0,
    totalLoan: 0,
    totalInterest: 0,
    availableBalance: 0,
  });
  const [lineData, setLineData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);
  const [savingDefaulters, setSavingDefaulters] = useState<SavingDefaulter[]>([]);
  const [interestDefaulters, setInterestDefaulters] = useState<InterestDefaulter[]>([]);
  const [totalFine, setTotalFine] = useState(0);
  const [totalExpenditure, setTotalExpenditure] = useState(0);
  const router = useRouter();

  useEffect(() => {
    loadDashboardData();
  }, []);

  /**
   * Calculates the difference in months between two Date objects (laterDate - earlierDate).
   * Result is always >= 0.
   */
  const calculateMonthDiff = (laterDate: Date, earlierDate: Date): number => {
    const diffYears = laterDate.getFullYear() - earlierDate.getFullYear();
    const diffMonths = laterDate.getMonth() - earlierDate.getMonth();
    return (diffYears * 12) + diffMonths;
  };
  
  /**
   * Helper to get YYYY-MM key from date string (YYYY-MM-DD)
   */
  const getMonthKey = (dateString: string): string => dateString.slice(0, 7);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [membersRes, savingsRes, loansRes, paymentsRes, finesRes, expRes] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Saving[]>('data/savings.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
        readFile<FinePayment[]>('data/fines.json'),
        readFile<Expenditure[]>('data/expenditures.json'),
      ]);
      const members: Member[] = membersRes ?? [];
      const savings: Saving[] = savingsRes ?? [];
      const loans: Loan[] = loansRes ?? [];
      const payments: Payment[] = paymentsRes ?? [];
      const fines: FinePayment[] = finesRes ?? [];
      const expenditures: Expenditure[] = expRes ?? [];

      // Calculate statistics
      const totalMembers = members.length;
      const totalSaving = savings.reduce((sum, s) => sum + s.amount, 0);
      
      const totalLoan = loans.reduce((sum, l) => {
        const loanPayments = payments.filter(p => p.loanId === l.id);
        const outstanding = calculateOutstandingPrincipal(
          l.principal, 
          l.interestRate, 
          l.termMonths, 
          loanPayments
        );
        return sum + outstanding;
      }, 0);
      
      const totalInterest = payments.reduce((sum, p) => sum + p.interestPaid, 0);
      const totalFineComputed = fines.reduce((sum, f) => sum + f.amount, 0);
      const totalExpenditureComputed = expenditures.reduce((sum, e) => sum + e.amount, 0);
      const availableBalance = totalSaving + totalInterest + totalFineComputed - totalLoan - totalExpenditureComputed;

      setStats({
        totalMembers,
        totalSaving,
        totalLoan,
        totalInterest,
        availableBalance,
      });
      setTotalFine(totalFineComputed);
      setTotalExpenditure(totalExpenditureComputed);

      // Calculate Defaulters
      const now = new Date();
      const currentMonthKey = getMonthKey(now.toISOString().split('T')[0]); // YYYY-MM
      const currentMonthDate = new Date(currentMonthKey); // YYYY-MM-01

      // =========================================================
      // SAVING DEFAULTERS LOGIC
      // =========================================================
      
      const memberLastSavingMonth = new Map<string, string>(); // memberId -> YYYY-MM
      const memberLastSavingDate = new Map<string, string>(); // memberId -> YYYY-MM-DD
      
      const allSavingsSorted = savings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      allSavingsSorted.forEach(s => {
        if (!memberLastSavingMonth.has(s.memberId)) {
          memberLastSavingMonth.set(s.memberId, getMonthKey(s.date));
          memberLastSavingDate.set(s.memberId, s.date);
        }
      });

      const savingDefaulterList: SavingDefaulter[] = [];

      members.forEach(member => {
        const lastSaveMonthKey = memberLastSavingMonth.get(member.id);

        if (lastSaveMonthKey && lastSaveMonthKey !== currentMonthKey) {
            
            const lastSaveMonthDate = new Date(lastSaveMonthKey); 
            let pendingMonths = calculateMonthDiff(currentMonthDate, lastSaveMonthDate);
            
            if (pendingMonths > 0) {
                savingDefaulterList.push({
                    id: member.id,
                    name: member.name,
                    lastSavingDate: memberLastSavingDate.get(member.id) || 'N/A',
                    pendingMonths: pendingMonths,
                });
            }
        }
      });
      
      setSavingDefaulters(savingDefaulterList);
      // =========================================================
      
      // =========================================================
      // LOAN INTEREST DEFAULTERS LOGIC
      // =========================================================
      
      const interestDefaulterMap = new Map<string, InterestDefaulter>();

      loans.forEach(loan => {
        if (loan.startDate.startsWith(currentMonthKey)) {
          return;
        }

        const loanPayments = payments.filter(p => p.loanId === loan.id);
        const outstanding = calculateOutstandingPrincipal(
          loan.principal, 
          loan.interestRate, 
          loan.termMonths, 
          loanPayments
        );
        
        if (outstanding <= 0) {
            return;
        }

        const latestInterestPayment = loanPayments
            .filter(p => p.interestPaid > 0)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        let lastPaymentDateStr: string;
        let lastPaymentMonthKey: string;

        if (latestInterestPayment) {
            lastPaymentDateStr = latestInterestPayment.date;
            lastPaymentMonthKey = getMonthKey(latestInterestPayment.date);
        } else {
            lastPaymentDateStr = loan.startDate;
            lastPaymentMonthKey = getMonthKey(loan.startDate);
        }

        if (lastPaymentMonthKey !== currentMonthKey) {
            const lastPaymentMonthDate = new Date(lastPaymentMonthKey);
            
            let pendingMonths = calculateMonthDiff(currentMonthDate, lastPaymentMonthDate);

            if (pendingMonths > 0) {
                const member = members.find(m => m.id === loan.memberId);
                if (!member) return;

                const existingDefaulter = interestDefaulterMap.get(member.id);

                if (!existingDefaulter || pendingMonths > existingDefaulter.pendingMonths) {
                    interestDefaulterMap.set(member.id, {
                        id: member.id,
                        name: member.name,
                        lastPaymentDate: lastPaymentDateStr,
                        pendingMonths: pendingMonths,
                    });
                }
            }
        }
      });

      const interestDefaulterList = Array.from(interestDefaulterMap.values());
      setInterestDefaulters(interestDefaulterList);
      // =========================================================

      // Prepare line chart data (monthly trends)
      const monthlyData: { [key: string]: { 
        saving: number; 
        loan: number; 
        fine: number; 
        interest: number; 
        expenditure: number; 
        collection: number;    // ← NEW
        month: string 
      } } = {};
      
      // Initialize months from all data sources
      const allDates = [
        ...savings.map(s => s.date),
        ...loans.map(l => l.startDate),
        ...fines.map(f => f.date),
        ...payments.map(p => p.date),
        ...expenditures.map(e => e.date),
      ];

      allDates.forEach(dateStr => {
        const month = new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!monthlyData[month]) {
          monthlyData[month] = { saving: 0, loan: 0, fine: 0, interest: 0, expenditure: 0, collection: 0, month };
        }
      });

      savings.forEach(s => {
        const month = new Date(s.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        monthlyData[month].saving += s.amount;
        monthlyData[month].collection += s.amount;           // ← NEW
      });

      loans.forEach(l => {
        const month = new Date(l.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        monthlyData[month].loan += l.principal;
      });

      fines.forEach(f => {
        const month = new Date(f.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        monthlyData[month].fine += f.amount;
        monthlyData[month].collection += f.amount;           // ← NEW
      });

      payments.forEach(p => {
        if (p.interestPaid > 0) {
          const month = new Date(p.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
          monthlyData[month].interest += p.interestPaid;
          monthlyData[month].collection += p.interestPaid;   // ← NEW
        }
      });

      expenditures.forEach(e => {
        const month = new Date(e.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        monthlyData[month].expenditure += e.amount;
      });

      const sortedMonths = Object.values(monthlyData).sort((a, b) => 
        new Date(a.month).getTime() - new Date(b.month).getTime()
      );
      setLineData(sortedMonths);

      // Prepare pie chart data (loan distribution by member)
      const loanByMember: { [key: string]: { name: string; value: number } } = {};
      
      loans.forEach(loan => {
        const loanPayments = payments.filter(p => p.loanId === loan.id);
        
        const outstanding = calculateOutstandingPrincipal(
          loan.principal, 
          loan.interestRate, 
          loan.termMonths, 
          loanPayments
        );
        
        if (outstanding > 0) {
          const member = members.find(m => m.id === loan.memberId);
          const memberName = member?.name || loan.memberId;
          if (!loanByMember[loan.memberId]) {
            loanByMember[loan.memberId] = { name: memberName, value: 0 };
          }
          loanByMember[loan.memberId].value += outstanding;
        }
      });

      const pieDataArray = Object.values(loanByMember)
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      
      const othersTotal = Object.values(loanByMember)
        .slice(5)
        .reduce((sum, item) => sum + item.value, 0);
      
      if (othersTotal > 0) {
        pieDataArray.push({ name: 'Others', value: othersTotal });
      }

      setPieData(pieDataArray);
    } catch (error: any) {
      toast.error('Failed to load dashboard data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      title: 'Total Member',
      value: formatNumber(stats.totalMembers),
      icon: Users,
      color: 'bg-primary',
      onClick: () => router.push('/members'),
    },
    {
      title: 'Total Saving',
      value: formatCurrency(stats.totalSaving),
      icon: PiggyBank,
      color: 'bg-success',
      onClick: () => router.push('/savings'),
    },
    {
      title: 'Total Loan',
      value: formatCurrency(stats.totalLoan),
      icon: CreditCard,
      color: 'bg-warning',
      onClick: () => router.push('/loans'),
    },
    {
      title: 'Total Interest Payment',
      value: formatCurrency(stats.totalInterest),
      icon: DollarSign,
      color: 'bg-info',
      onClick: () => router.push('/payments'),
    },
    {
      title: 'Total Fine Collected',
      value: formatCurrency(totalFine),
      icon: AlertTriangle,
      color: 'bg-accent',
      onClick: () => router.push('/payments'),
    },
    {
      title: 'Total Expenditure',
      value: formatCurrency(totalExpenditure),
      icon: TrendingDown,
      color: 'bg-danger',
      onClick: () => router.push('/payments'),
    },
	{
      title: 'Net Collected Amount',
      value: formatCurrency(stats.totalSaving + stats.totalInterest + totalFine),
      icon: DollarSign,
      color: 'bg-indigo-700',
      onClick: () => router.push('/payments'),
    },
    {
      title: 'Net Available Balance',
      value: formatCurrency(stats.availableBalance),
      icon: TrendingUp,
      color: stats.availableBalance >= 0 ? 'bg-success' : 'bg-danger',
      onClick: () => router.push('/savings'),
    },
  ];

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
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-800">Dashboard</h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7 gap-3 sm:gap-4">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  onClick={card.onClick}
                  className={`
                    ${card.color} text-white p-4 sm:p-6 rounded-xl shadow-lg
                    transform transition-all active:scale-95 hover:scale-105 hover:shadow-xl cursor-pointer
                    touch-manipulation min-h-[120px] sm:min-h-[140px]
                  `}
                >
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <Icon size={28} className="sm:w-8 sm:h-8 opacity-80" />
                  </div>
                  <div className="text-xs sm:text-sm font-medium opacity-90 mb-1">{card.title}</div>
                  <div className="text-xl sm:text-2xl font-bold break-words">{card.value}</div>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Line Chart */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full overflow-x-auto">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Monthly Trends</h3>
              <div className="w-full" style={{ minWidth: '300px' }}>
                <ResponsiveContainer width="100%" height={250} minHeight={250}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="saving" stroke="#10b981" strokeWidth={2} name="Saving" />
                    <Line type="monotone" dataKey="collection" stroke="#8b5cf6" strokeWidth={2} name="Collection" /> {/* ← NEW */}
                    <Line type="monotone" dataKey="loan" stroke="#f59e0b" strokeWidth={2} name="Loan" />
                    <Line type="monotone" dataKey="fine" stroke="#ef4444" strokeWidth={2} name="Fine" />
                    <Line type="monotone" dataKey="interest" stroke="#3b82f6" strokeWidth={2} name="Interest" />
                    <Line type="monotone" dataKey="expenditure" stroke="#6b7280" strokeWidth={2} name="Expenditure" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Pie Chart */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg w-full overflow-x-auto">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Loan Distribution</h3>
              <div className="w-full" style={{ minWidth: '300px' }}>
                <ResponsiveContainer width="100%" height={250} minHeight={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Defaulters Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Saving Defaulters */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <UserX size={20} className="sm:w-6 sm:h-6 text-danger" />
                Saving Defaulters ({savingDefaulters.length})
              </h3>
              {savingDefaulters.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No saving defaulters this month</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {savingDefaulters.map((defaulter) => (
                    <div
                      key={defaulter.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200 cursor-pointer touch-manipulation"
                      onClick={() => router.push(`/savings?memberId=${defaulter.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 truncate">{defaulter.name}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {defaulter.id}
                          <span className="ml-2 text-danger font-semibold">
                            ({defaulter.pendingMonths} {defaulter.pendingMonths === 1 ? 'month' : 'months'} pending)
                          </span>
                        </p>
                      </div>
                      <p className="text-sm text-gray-600">
                        Last Save: {formatDate(defaulter.lastSavingDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Interest Defaulters */}
            <div className="bg-white p-4 sm:p-6 rounded-xl shadow-lg">
              <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertTriangle size={20} className="sm:w-6 sm:h-6 text-warning" />
                Interest Defaulters ({interestDefaulters.length})
              </h3>
              {interestDefaulters.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No interest defaulters this month</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {interestDefaulters.map((defaulter) => (
                    <div
                      key={defaulter.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 active:bg-gray-200 cursor-pointer touch-manipulation"
                      onClick={() => router.push(`/payments?memberId=${defaulter.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 truncate">{defaulter.name}</p>
                        <p className="text-sm text-gray-500 truncate">
                          {defaulter.id}
                          <span className="ml-2 text-warning font-semibold">
                            ({defaulter.pendingMonths} {defaulter.pendingMonths === 1 ? 'month' : 'months'} overdue)
                          </span>
                        </p>
                      </div>
                      <p className="text-sm text-gray-600">
                        Last Int. Pay: {formatDate(defaulter.lastPaymentDate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Layout>
    </ProtectedRoute>
  );
}
