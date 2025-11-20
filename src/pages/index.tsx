/**
 * Dashboard page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
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
  const [savingDefaulters, setSavingDefaulters] = useState<Array<{ id: string; name: string }>>([]);
  const [interestDefaulters, setInterestDefaulters] = useState<Array<{ id: string; name: string }>>([]);
  const [totalFine, setTotalFine] = useState(0);
  const [totalExpenditure, setTotalExpenditure] = useState(0);
  const router = useRouter();

  useEffect(() => {
    loadDashboardData();
  }, []);

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
        const principalPaid = loanPayments.reduce((sum, p) => sum + p.principalPaid, 0);
        return sum + Math.max(0, l.principal - principalPaid);
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

      // Calculate Monthly Defaulters with names
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Saving Defaulters: Members who saved last month but not this month
      const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonthStr = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
      
      const membersWhoSavedLastMonth = new Set(
        savings
          .filter(s => s.date.startsWith(prevMonthStr))
          .map(s => s.memberId)
      );
      
      const membersWhoSavedThisMonth = new Set(
        savings
          .filter(s => s.date.startsWith(currentMonth))
          .map(s => s.memberId)
      );
      
      // Defaulters are those who saved last month but not this month
      const savingDefaulterIds = Array.from(membersWhoSavedLastMonth).filter(
        memberId => !membersWhoSavedThisMonth.has(memberId)
      );
      
      const savingDefaulterList = savingDefaulterIds
        .map(memberId => {
          const member = members.find(m => m.id === memberId);
          return member ? { id: member.id, name: member.name } : null;
        })
        .filter((m): m is { id: string; name: string } => m !== null);
      
      setSavingDefaulters(savingDefaulterList);

      // Loan Interest Defaulters: Members with active loans who haven't paid interest this month
      const membersWithActiveLoans = new Map<string, string>(); // memberId -> memberName
      loans.forEach(loan => {
        const loanPayments = payments.filter(p => p.loanId === loan.id);
        const principalPaid = loanPayments.reduce((sum, p) => sum + p.principalPaid, 0);
        const outstanding = Math.max(0, loan.principal - principalPaid);
        if (outstanding > 0) {
          const member = members.find(m => m.id === loan.memberId);
          if (member) {
            membersWithActiveLoans.set(loan.memberId, member.name);
          }
        }
      });
      
      const membersWhoPaidInterestThisMonth = new Set(
        payments
          .filter(p => p.date.startsWith(currentMonth) && p.interestPaid > 0)
          .map(p => p.memberId)
      );
      
      // Defaulters are those with active loans but no interest payment this month
      const interestDefaulterList = Array.from(membersWithActiveLoans.entries())
        .filter(([memberId]) => !membersWhoPaidInterestThisMonth.has(memberId))
        .map(([id, name]) => ({ id, name }));
      
      setInterestDefaulters(interestDefaulterList);

      // Prepare line chart data (monthly trends)
      const monthlyData: { [key: string]: { saving: number; loan: number; month: string } } = {};
      
      savings.forEach(s => {
        const month = new Date(s.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!monthlyData[month]) {
          monthlyData[month] = { saving: 0, loan: 0, month };
        }
        monthlyData[month].saving += s.amount;
      });

      loans.forEach(l => {
        const month = new Date(l.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
        if (!monthlyData[month]) {
          monthlyData[month] = { saving: 0, loan: 0, month };
        }
        monthlyData[month].loan += l.principal;
      });

      const sortedMonths = Object.values(monthlyData).sort((a, b) => 
        new Date(a.month).getTime() - new Date(b.month).getTime()
      );
      setLineData(sortedMonths);

      // Prepare pie chart data (loan distribution by member)
      const loanByMember: { [key: string]: { name: string; value: number } } = {};
      
      loans.forEach(loan => {
        const member = members.find(m => m.id === loan.memberId);
        const memberName = member?.name || loan.memberId;
        if (!loanByMember[loan.memberId]) {
          loanByMember[loan.memberId] = { name: memberName, value: 0 };
        }
        loanByMember[loan.memberId].value += loan.principal;
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
                    <Line type="monotone" dataKey="loan" stroke="#f59e0b" strokeWidth={2} name="Loan" />
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
                      onClick={() => router.push(`/savings`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 truncate">{defaulter.name}</p>
                        <p className="text-sm text-gray-500 truncate">{defaulter.id}</p>
                      </div>
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
                      onClick={() => router.push(`/payments`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-800 truncate">{defaulter.name}</p>
                        <p className="text-sm text-gray-500 truncate">{defaulter.id}</p>
                      </div>
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

