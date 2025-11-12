/**
 * Type definitions for the application
 */

export interface Member {
  id: string;
  name: string;
  phone: string;
  joinDate: string;
  address?: string;
}

export interface Saving {
  id: string;
  memberId: string;
  amount: number;
  date: string;
  remarks?: string;
}

export interface Loan {
  id: string;
  memberId: string;
  principal: number;
  interestRate: number; // annual percentage
  startDate: string;
  termMonths: number;
  purpose?: string;
}

export interface Payment {
  id: string;
  loanId: string;
  memberId: string;
  date: string;
  principalPaid: number;
  interestPaid: number;
  remarks?: string;
}

export interface FinePayment {
  id: string;
  memberId: string;
  date: string;
  amount: number;
  reason: 'Saving Default' | 'Interest Default' | 'Other';
  note?: string;
}

export interface Expenditure {
  id: string;
  date: string;
  item: string; // e.g., DayBook, A4 Paper, Pen, Stamp, Inkpad, etc.
  amount: number;
  note?: string;
}

export interface Settings {
  users: Array<{
    userId: string;
    name: string;
    password: string; // hashed
    role: 'Admin' | 'Viewer';
  }>;
}

export interface BackupData {
  timestamp: string;
  members: Member[];
  savings: Saving[];
  loans: Loan[];
  payments: Payment[];
  fines?: FinePayment[];
  expenditures?: Expenditure[];
  settings: Settings;
}

