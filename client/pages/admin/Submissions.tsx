import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { FormSubmission } from '@shared/api';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function AdminSubmissions() {
  const { token } = useAuth();
  const [submissions, setSubmissions] = useState<FormSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<'id' | 'form_title' | 'username' | 'submitted_at'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/submissions', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await response.json();
      setSubmissions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const sortedSubmissions = [...submissions].sort((a, b) => {
    let aVal: string | number;
    let bVal: string | number;

    switch (sortField) {
      case 'form_title':
        aVal = a.form_title || `Form #${a.form_id}`;
        bVal = b.form_title || `Form #${b.form_id}`;
        break;
      case 'username':
        aVal = a.username || (a.submitted_by ? `User #${a.submitted_by}` : 'Anonymous');
        bVal = b.username || (b.submitted_by ? `User #${b.submitted_by}` : 'Anonymous');
        break;
      case 'submitted_at':
        aVal = new Date(a.submitted_at).getTime();
        bVal = new Date(b.submitted_at).getTime();
        break;
      default:
        aVal = a.id;
        bVal = b.id;
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    }

    const cmp = (aVal as number) - (bVal as number);
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: 'id' | 'form_title' | 'username' | 'submitted_at') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-50 via-slate-100 to-slate-200 bg-clip-text text-transparent flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-purple-600" />
            </div>
            View Submissions
          </h1>
          <p className="text-slate-200 text-lg">View all form submissions</p>
        </div>
        <Link to="/admin">
          <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-md hover:shadow-lg transition-all duration-200">
            Back to Dashboard
          </Button>
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-md shadow-sm">
          <p className="font-medium">{error}</p>
        </div>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
          <CardTitle className="text-2xl font-bold">All Submissions ({submissions.length})</CardTitle>
          <CardDescription className="text-base">List of all form submissions in the system</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/50">
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('id')}
                >
                  ID {sortField === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('form_title')}
                >
                  Form Title {sortField === 'form_title' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('username')}
                >
                  Submitted By {sortField === 'username' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('submitted_at')}
                >
                  Submitted At {sortField === 'submitted_at' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    No submissions found
                  </TableCell>
                </TableRow>
              ) : (
                sortedSubmissions.map((submission) => (
                  <TableRow key={submission.id}>
                    <TableCell>{submission.id}</TableCell>
                    <TableCell className="font-medium">
                      {submission.form_title || `Form #${submission.form_id}`}
                    </TableCell>
                    <TableCell>
                      {submission.username ||
                        (submission.submitted_by ? `User #${submission.submitted_by}` : 'Anonymous')}
                    </TableCell>
                    <TableCell>
                      {new Date(submission.submitted_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}

