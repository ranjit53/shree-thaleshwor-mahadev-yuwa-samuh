/**
 * Dashboard page
 */

import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import { readFile } from '@/lib/api';
import { formatCurrency, formatNumber } from '@/lib/utils';
import type { Member, Saving, Loan, Payment } from '@/types';
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
import { Users, PiggyBank, CreditCard, DollarSign, TrendingUp } from 'lucide-react';
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
  const router = useRouter();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [membersRes, savingsRes, loansRes, paymentsRes] = await Promise.all([
        readFile<Member[]>('data/members.json'),
        readFile<Saving[]>('data/savings.json'),
        readFile<Loan[]>('data/loans.json'),
        readFile<Payment[]>('data/payments.json'),
      ]);
      const members: Member[] = membersRes ?? [];
      const savings: Saving[] = savingsRes ?? [];
      const loans: Loan[] = loansRes ?? [];
      const payments: Payment[] = paymentsRes ?? [];

      // Calculate statistics
      const totalMembers = members.length;
      const totalSaving = savings.reduce((sum, s) => sum + s.amount, 0);
      const totalLoan = loans.reduce((sum, l) => {
        const loanPayments = payments.filter(p => p.loanId === l.id);
        const principalPaid = loanPayments.reduce((sum, p) => sum + p.principalPaid, 0);
        return sum + Math.max(0, l.principal - principalPaid);
      }, 0);
      const totalInterest = payments.reduce((sum, p) => sum + p.interestPaid, 0);
      const availableBalance = totalSaving - totalLoan;

      setStats({
        totalMembers,
        totalSaving,
        totalLoan,
        totalInterest,
        availableBalance,
      });

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
      title: 'Available Balance',
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
        <div className="space-y-6">
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {statCards.map((card, index) => {
              const Icon = card.icon;
              return (
                <div
                  key={index}
                  onClick={card.onClick}
                  className={`
                    ${card.color} text-white p-6 rounded-xl shadow-lg
                    transform transition-all hover:scale-105 hover:shadow-xl cursor-pointer
                  `}
                >
                  <div className="flex items-center justify-between mb-4">
                    <Icon size={32} className="opacity-80" />
                  </div>
                  <div className="text-sm font-medium opacity-90 mb-1">{card.title}</div>
                  <div className="text-2xl font-bold">{card.value}</div>
                </div>
              );
            })}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Monthly Trends</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={lineData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="saving" stroke="#10b981" strokeWidth={2} name="Saving" />
                  <Line type="monotone" dataKey="loan" stroke="#f59e0b" strokeWidth={2} name="Loan" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Pie Chart */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Loan Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
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
      </Layout>
    </ProtectedRoute>
  );
}

