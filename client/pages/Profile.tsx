import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { User, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, token, updateProfile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || "");
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!username.trim()) {
      toast({
        title: "Error",
        description: "Username cannot be empty",
        variant: "destructive",
      });
      return;
    }

    if (username === user?.username) {
      toast({
        title: "No changes",
        description: "Username is the same as before",
      });
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile({ username: username.trim() });
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-slate-50 via-slate-100 to-slate-200 bg-clip-text text-transparent">
              Profile Settings
            </h2>
            <p className="text-slate-200 text-lg">
              Manage your account information and preferences
            </p>
          </div>

          <Card className="bg-gray-100 border-gray-300">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl text-gray-900">Account Information</CardTitle>
                  <CardDescription className="text-gray-600">
                    Update your profile details
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="userId" className="text-sm font-semibold text-gray-700">
                    User ID
                  </Label>
                  <Input
                    id="userId"
                    type="text"
                    value={user.id}
                    disabled
                    className="bg-gray-200 text-gray-600 cursor-not-allowed"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role" className="text-sm font-semibold text-gray-700">
                    Role
                  </Label>
                  <Input
                    id="role"
                    type="text"
                    value={user.role === 'admin' ? 'Administrator' : 'User'}
                    disabled
                    className="bg-gray-200 text-gray-600 cursor-not-allowed capitalize"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-sm font-semibold text-gray-700">
                    Username
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isSaving}
                    className="bg-white text-gray-900"
                  />
                  <p className="text-xs text-gray-500">
                    This is your display name. It will be visible to other users.
                  </p>
                </div>

                {user.created_at && (
                  <div className="space-y-2">
                    <Label htmlFor="createdAt" className="text-sm font-semibold text-gray-700">
                      Member Since
                    </Label>
                    <Input
                      id="createdAt"
                      type="text"
                      value={new Date(user.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                      disabled
                      className="bg-gray-200 text-gray-600 cursor-not-allowed"
                    />
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={isSaving || username.trim() === user.username}
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Changes"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    disabled={isSaving}
                    className="border-gray-300 hover:bg-gray-200"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}






