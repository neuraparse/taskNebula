import { Metadata } from 'next';
import { DashboardClient } from './dashboard-client';

export const metadata: Metadata = {
  title: 'Dashboard | TaskNebula',
  description: 'Your project management dashboard',
};

export default function DashboardPage() {
  return <DashboardClient />;
}
