import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User, CreateUserRequest } from '@shared/api';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Users, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export default function AdminUsers() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  
  // Form state for single user
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  
  // Form state for multiple users
  const [userList, setUserList] = useState<CreateUserRequest[]>([]);
  const [sortField, setSortField] = useState<'id' | 'username' | 'role' | 'created_at'>('id');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const sortedUsers = [...users].sort((a, b) => {
    let aVal: string | number = a[sortField];
    let bVal: string | number = b[sortField];

    if (sortField === 'created_at') {
      aVal = new Date((a as any).created_at).getTime();
      bVal = new Date((b as any).created_at).getTime();
    }

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      const cmp = aVal.localeCompare(bVal);
      return sortDirection === 'asc' ? cmp : -cmp;
    }

    const cmp = (aVal as number) - (bVal as number);
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const handleSort = (field: 'id' | 'username' | 'role' | 'created_at') => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const addUserToList = () => {
    if (!username.trim() || !password.trim()) {
      setCreateError('Username and password are required');
      return;
    }
    
    setUserList([...userList, { username: username.trim(), password, role }]);
    setUsername('');
    setPassword('');
    setRole('user');
    setCreateError('');
  };

  const removeUserFromList = (index: number) => {
    setUserList(userList.filter((_, i) => i !== index));
  };

  const createUsers = async () => {
    if (userList.length === 0) {
      setCreateError('Please add at least one user');
      return;
    }

    setIsCreating(true);
    setCreateError('');
    setCreateSuccess('');

    try {
      const results = [];
      const errors = [];

      for (const user of userList) {
        try {
          const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(user),
          });

          if (!response.ok) {
            const error = await response.json();
            errors.push(`${user.username}: ${error.error || 'Failed to create'}`);
          } else {
            const data = await response.json();
            results.push(data);
          }
        } catch (err) {
          errors.push(`${user.username}: ${err instanceof Error ? err.message : 'Failed to create'}`);
        }
      }

      if (errors.length > 0) {
        setCreateError(`Some users failed to create:\n${errors.join('\n')}`);
      }

      if (results.length > 0) {
        setCreateSuccess(`Successfully created ${results.length} user(s)`);
        setUserList([]);
        fetchUsers(); // Refresh user list
        setTimeout(() => {
          setIsDialogOpen(false);
          setCreateSuccess('');
        }, 2000);
      }
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create users');
    } finally {
      setIsCreating(false);
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
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="h-7 w-7 text-blue-600" />
            </div>
            Manage Users
          </h1>
          <p className="text-slate-200 text-lg">View and manage all registered users</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-md hover:shadow-lg transition-all duration-200">
                <Plus className="w-4 h-4 mr-2" />
                Create Users
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Users</DialogTitle>
                <DialogDescription>
                  Add multiple users at once. Fill in the form below and click "Add to List" for each user.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                {createError && (
                  <Alert variant="destructive">
                    <AlertDescription className="whitespace-pre-line">{createError}</AlertDescription>
                  </Alert>
                )}
                
                {createSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertDescription className="text-green-800">{createSuccess}</AlertDescription>
                  </Alert>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={role} onValueChange={(value: 'user' | 'admin') => setRole(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={addUserToList} variant="outline" className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add to List
                </Button>

                {userList.length > 0 && (
                  <div className="space-y-2">
                    <Label>Users to Create ({userList.length})</Label>
                    <div className="border rounded-md p-4 space-y-2 max-h-60 overflow-y-auto">
                      {userList.map((user, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex-1">
                            <span className="font-medium">{user.username}</span>
                            <span className="text-gray-500 ml-2">({user.role})</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeUserFromList(index)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={createUsers}
                    disabled={isCreating || userList.length === 0}
                    className="flex-1"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Create {userList.length > 0 ? `${userList.length} ` : ''}User{userList.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      setUserList([]);
                      setUsername('');
                      setPassword('');
                      setRole('user');
                      setCreateError('');
                      setCreateSuccess('');
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          <Link to="/admin">
            <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white shadow-md hover:shadow-lg transition-all duration-200">
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-md shadow-sm">
          <p className="font-medium">{error}</p>
        </div>
      )}

      <Card className="border-0 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b">
          <CardTitle className="text-2xl font-bold">All Users ({users.length})</CardTitle>
          <CardDescription className="text-base">List of all users in the system</CardDescription>
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
                  onClick={() => handleSort('username')}
                >
                  Username {sortField === 'username' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('role')}
                >
                  Role {sortField === 'role' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
                <TableHead
                  className="font-semibold cursor-pointer"
                  onClick={() => handleSort('created_at')}
                >
                  Created At {sortField === 'created_at' ? (sortDirection === 'asc' ? '▲' : '▼') : ''}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                sortedUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.id}</TableCell>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(user.created_at).toLocaleDateString()}
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

