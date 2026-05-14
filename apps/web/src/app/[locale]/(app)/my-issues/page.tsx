import { Metadata } from 'next';
import { MyIssuesClient } from './my-issues-client';

export const metadata: Metadata = {
  title: 'My Issues | TaskNebula',
  description: 'View and manage your assigned issues',
};

export default function MyIssuesPage() {
  return <MyIssuesClient />;
}
