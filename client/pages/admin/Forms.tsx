import { useEffect, useState } from 'react';
import { apiUrl } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Form } from '@shared/api';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function AdminForms() {
  const { token } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortField, setSortField] = useState<'id' | 'title' | 'username' | 'created_at'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchForms();
  }, []);

  const fetchForms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/forms', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }

      const data = await response.json();
      setForms(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms');
    } finally {
      setIsLoading(false);
    }
  };

  const sortedForms = [...forms].sort((a, b) => {
    let aVal: string | number = a[sortField === 'username' ? 'username' : sortField];
    let bVal: string | number = b[sortField === 'username' ? 'username' : sortField];

    if (sortField === 'created_at') {
      aVal = new Date(a.created_at).getTime();
      bVal = new Date(b.created_at).getTime();
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    }

    const cmp = (aVal as number) - (bVal as number);
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: 'id' | 'title' | 'username' | 'created_at') => {
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
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <FileText className="h-7 w-7 text-green-600" />
            </div>
            Manage Forms
          </h1>
          <p className="text-slate-200 text-lg">View and manage all forms created by users</p>
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
          <CardTitle className="text-2xl font-bold">All Forms ({forms.length})</CardTitle>
          <CardDescription className="text-base">List of all forms in the system</CardDescription>
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
                  onClick={() => handleSort('title')}
                >
                  Title {sortField === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('username')}
                >
                  Created By {sortField === 'username' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  Created At {sortField === 'created_at' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                    No forms found
                  </TableCell>
                </TableRow>
              ) : (
                sortedForms.map((form) => (
                  <TableRow key={form.id}>
                    <TableCell>{form.id}</TableCell>
                    <TableCell className="font-medium">{form.title}</TableCell>
                    <TableCell>{form.username || `User #${form.user_id}`}</TableCell>
                    <TableCell>
                      <Badge variant={form.is_shared ? 'default' : 'secondary'}>
                        {form.is_shared ? 'Shared' : 'Private'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(form.created_at).toLocaleDateString()}
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

