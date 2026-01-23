import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Edit2, Loader2, Copy, Check, Share2, Trash2, HelpCircle, FileQuestion, MessageSquare, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { ResponsesView } from "@/components/forms/ResponsesView";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface FormQuestion {
  id: number;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  description?: string;
}

interface FormData {
  id: number;
  title: string;
  description: string | null;
  share_token: string;
  submission_count: number;
  is_quiz?: boolean;
  requires_login?: boolean;
  questions: FormQuestion[];
}

export default function FormDetail() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState<FormData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"questions" | "responses">("questions");
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(true);
  const [isUpdatingRequiresLogin, setIsUpdatingRequiresLogin] = useState(false);

  useEffect(() => {
    if (formId) {
      if (token) {
        fetchForm();
      } else {
        setError('Please log in to view this form');
        setIsLoading(false);
      }
    }
  }, [formId, token]);

  const fetchForm = async () => {
    try {
      setIsLoading(true);
      setError('');

      if (!token) {
        setError('Please log in to view this form');
        return;
      }

      const response = await fetch(`/api/forms/${formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Form not found. This form may have been deleted, or the link is incorrect.');
        } else if (response.status === 403) {
          setError('Access denied. This form belongs to another user.');
        } else if (response.status === 401) {
          setError('Please log in to view this form');
          navigate('/login');
          return;
        } else {
          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || 'Failed to load form. Please try again.');
        }
        return;
      }

      const data = await response.json();
      setForm(data);
      setRequiresLogin(data.requires_login !== undefined ? data.requires_login : true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyShareLink = () => {
    if (form) {
      const shareUrl = `${window.location.origin}/form/${form.share_token}`;
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Copied!",
        description: "Shareable link copied to clipboard",
      });
    }
  };

  const handleRequiresLoginChange = async (checked: boolean) => {
    if (!form || !token) return;
    
    setIsUpdatingRequiresLogin(true);
    try {
      const response = await fetch(`/api/forms/${form.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description || '',
          questions: form.questions.map(q => ({
            title: q.question_text,
            type: q.question_type,
            required: q.is_required,
            options: q.options || []
          })),
          requires_login: checked
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update setting');
      }

      setRequiresLogin(checked);
      setForm({ ...form, requires_login: checked });
      toast({
        title: "Setting Updated",
        description: checked ? "Users must log in to access this form" : "Form can be accessed without login",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update setting',
        variant: "destructive",
      });
    } finally {
      setIsUpdatingRequiresLogin(false);
    }
  };

  const exportToCSV = async () => {
    if (!form) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast({
          title: "Error",
          description: "Please log in to export responses",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(`/api/forms/${form.id}/responses/export`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to export responses');
      }

      // Get the CSV content
      const csvContent = await response.text();
      
      // Create a blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${form.title}_responses.csv`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }
      
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Success!",
        description: "Responses exported to CSV",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Error",
        description: "Failed to export responses. Please try again.",
        variant: "destructive",
      });
    }
  };

  const mapDbTypeToFrontend = (dbType: string, options?: string[]): string => {
    // Check for special markers in options
    if (dbType === 'number' && options && options.length > 0 && ['star', 'heart', 'like'].includes(options[0])) {
      return 'rating';
    }
    if (dbType === 'text' && options && options.length > 0 && options[0] === '__TIME__') {
      return 'time';
    }
    
    // Map database types to frontend types
    const typeMap: Record<string, string> = {
      'text': 'short',
      'textarea': 'long',
      'radio': 'multiple',
      'checkbox': 'checkbox',
      'select': 'dropdown',
      'number': 'linear',
      'email': 'short',
      'date': 'date'
    };
    return typeMap[dbType] || 'short';
  };

  const getQuestionTypeDisplayLabel = (dbType: string, options?: string[]): string => {
    // Check for special markers
    if (dbType === 'number' && options && options.length > 0 && ['star', 'heart', 'like'].includes(options[0])) {
      return 'Rating';
    }
    if (dbType === 'text' && options && options.length > 0 && options[0] === '__TIME__') {
      return 'Time';
    }
    
    // Map database types to display labels
    const typeMap: Record<string, string> = {
      'text': 'Short Answer',
      'textarea': 'Long Answer',
      'radio': 'Multiple Choice',
      'checkbox': 'Checkboxes',
      'select': 'Dropdown',
      'number': 'Linear Scale',
      'email': 'Email',
      'date': 'Date'
    };
    return typeMap[dbType] || dbType;
  };

  const handleDelete = async () => {
    if (!formId) return;
    
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete form');
      }

      toast({
        title: "Form Deleted",
        description: `"${form?.title}" has been deleted successfully.`,
      });

      setShowDeleteDialog(false);
      
      // Navigate back to home page
      navigate("/");
      
      // Trigger refresh of forms list
      window.dispatchEvent(new CustomEvent('formDeleted'));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete form',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
          <p className="text-slate-200 text-sm">Loading form details...</p>
        </div>
      </Layout>
    );
  }

  if (error || !form) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px] px-4">
          <Card className="w-full max-w-md border-red-200 bg-red-50/50">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <HelpCircle className="w-6 h-6 text-red-600" />
              </div>
              <CardTitle className="text-red-900">Form Not Found</CardTitle>
              <div className="mt-2 text-sm text-muted-foreground">
                <p className="mb-4">
                  {error || "The form you're looking for doesn't exist or you don't have access to it."}
                </p>
                <p className="text-sm text-gray-600 mb-2">This could happen if:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-left text-sm text-gray-600">
                  <li>The form was deleted</li>
                  <li>The form belongs to another user</li>
                  <li>The form ID is incorrect</li>
                </ul>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => navigate("/")} className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Forms
          </Button>
              <p className="text-xs text-center text-gray-500">
                If you believe this is an error, please contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  const shareUrl = `${window.location.origin}/form/${form.share_token}`;

  return (
    <TooltipProvider>
      <Layout>
        <div className="space-y-6 pb-8">
      {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Tooltip>
                <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
                    className="p-0 h-10 w-10 rounded-lg shrink-0 flex-shrink-0 bg-white text-slate-900 hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Back to forms"
            >
                    <ArrowLeft className="w-5 h-5" />
            </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Back to all forms</p>
                </TooltipContent>
              </Tooltip>
              <div className="flex-1 min-w-0 pr-2">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-slate-50 via-slate-100 to-slate-200 bg-clip-text text-transparent break-words leading-tight">
                {form.title}
              </h1>
                {form.description && (
                  <p className="text-slate-200 mt-2 text-sm sm:text-base break-words">{form.description}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    onClick={copyShareLink}
                    className="gap-2 border-gray-300 bg-white text-slate-900 hover:bg-slate-50 hover:text-slate-900 focus-visible:text-slate-900"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-600" />
                        <span className="hidden sm:inline">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Share</span>
                      </>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copy shareable link to clipboard</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={exportToCSV}
                    variant="outline"
                    className="gap-2 border-green-300 hover:bg-green-50 text-green-700 hover:text-green-800"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download all responses as CSV file</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => navigate(`/create?edit=${form.id}`)}
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white gap-2 shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Edit</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit form questions and settings</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setShowDeleteDialog(true)}
                    variant="destructive"
                    className="gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Delete this form permanently</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Share Link Card */}
          <Card className="border border-white/20 shadow-lg bg-white/95 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5 text-blue-600" />
                </div>
                Shareable Link
              </CardTitle>
              <CardDescription className="text-base text-slate-600">
                Share this link with others to collect responses. Anyone with this link can submit responses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 items-center">
                <Input 
                  value={shareUrl} 
                  readOnly 
                  className="flex-1 min-w-0 h-11 border-gray-300 bg-white text-xs sm:text-sm font-mono truncate" 
                  aria-label="Shareable form link"
                />
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                <div className="space-y-0.5">
                  <Label htmlFor="requires-login" className="text-sm font-medium">
                    Require Login
                  </Label>
                  <p className="text-xs text-gray-500">
                    {requiresLogin 
                      ? "Users must log in to view and submit this form"
                      : "Anyone with the link can view and submit without logging in"}
                  </p>
                </div>
                <Switch
                  id="requires-login"
                  checked={requiresLogin}
                  onCheckedChange={handleRequiresLoginChange}
                  disabled={isUpdatingRequiresLogin}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="border border-white/10 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/95 backdrop-blur">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-slate-900">{form.questions.length}</div>
                    <p className="text-sm text-slate-600 mt-1">Questions</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                    <FileQuestion className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border border-white/10 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/95 backdrop-blur">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-4xl font-bold text-slate-900">{form.submission_count || 0}</div>
                    <p className="text-sm text-slate-600 mt-1">Responses</p>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

        {/* Tabs */}
          <div className="flex gap-4 sm:gap-6 border-b-2 border-white/20 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => setActiveTab("questions")}
              className={`pb-4 px-1 font-semibold text-sm sm:text-base transition-colors relative whitespace-nowrap flex-shrink-0 ${
              activeTab === "questions"
                  ? "text-white"
                : "text-slate-200 hover:text-white/90"
            }`}
              aria-selected={activeTab === "questions"}
              role="tab"
          >
              <span className="flex items-center gap-2">
                <FileQuestion className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Questions ({form.questions.length})</span>
              </span>
              {activeTab === "questions" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
              )}
          </button>
          <button
            onClick={() => setActiveTab("responses")}
              className={`pb-4 px-1 font-semibold text-sm sm:text-base transition-colors relative whitespace-nowrap flex-shrink-0 ${
              activeTab === "responses"
                  ? "text-white"
                : "text-slate-200 hover:text-white/90"
            }`}
              aria-selected={activeTab === "responses"}
              role="tab"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="whitespace-nowrap">Responses ({form.submission_count || 0})</span>
              </span>
              {activeTab === "responses" && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white"></span>
              )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "questions" && (
          <div className="space-y-4">
              {form.questions.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-300">
                  <CardContent className="pt-12 pb-12">
                    <div className="flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                        <FileQuestion className="w-8 h-8 text-gray-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Questions Yet</h3>
                      <p className="text-sm text-gray-600 mb-6 max-w-md">
                        This form doesn't have any questions yet. Edit the form to add questions and start collecting responses.
                      </p>
                      <Button
                        onClick={() => navigate(`/create?edit=${form.id}`)}
                        className="gap-2"
                      >
                        <Edit2 className="w-4 h-4" />
                        Add Questions
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                form.questions.map((question, index) => (
                  <Card key={question.id} className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="pt-6">
                <div className="w-full">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 sm:gap-3 mb-3 flex-wrap">
                            <span className="text-xs sm:text-sm font-bold text-primary bg-primary/10 px-2 sm:px-3 py-1 rounded-full shrink-0">
                              Q{index + 1}
                            </span>
                            {question.is_required && (
                              <Badge variant="destructive" className="text-xs font-semibold shrink-0">
                                Required
                              </Badge>
                            )}
                          </div>
                          <h3 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900 mb-3 break-words leading-snug">
                            {question.question_text.replace(/0+$/, '')}
                    </h3>
                          <p className="text-xs sm:text-sm font-medium text-gray-500 mb-4 bg-gray-50 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg inline-block">
                            Type: {getQuestionTypeDisplayLabel(question.question_type, question.options)}
                    </p>
                    {question.options && question.options.length > 0 && (
                            <div className="mt-4 space-y-2 bg-gray-50 p-3 sm:p-4 rounded-lg">
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                                Options:
                              </p>
                              <div className="space-y-1.5">
                              {question.options.map((option, optIndex) => (
                          <div
                                  key={optIndex}
                                  className="text-xs sm:text-sm text-gray-700 flex items-start gap-2 font-medium break-words"
                          >
                                  <span className="text-primary font-bold shrink-0 mt-0.5">•</span>
                                  <span className="flex-1 break-words">{option}</span>
                          </div>
                        ))}
                              </div>
                            </div>
                    )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
          </div>
        )}

        {activeTab === "responses" && (
            <ResponsesView 
              questions={form.questions.map(q => ({
                id: q.id.toString(),
                title: q.question_text,
                type: mapDbTypeToFrontend(q.question_type, q.options) as any,
                required: q.is_required,
                options: q.options || []
              }))} 
              formId={form.id}
              isQuiz={form.is_quiz || false}
            />
        )}
      </div>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                Delete Form
              </AlertDialogTitle>
              <AlertDialogDescription className="pt-2">
                Are you sure you want to delete <strong>"{form?.title}"</strong>? 
                <br /><br />
                This action cannot be undone and will permanently delete:
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                  <li>The form and all its questions</li>
                  <li>All {form.submission_count || 0} response{form.submission_count !== 1 ? 's' : ''}</li>
                  <li>The shareable link will stop working</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Permanently
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Layout>
    </TooltipProvider>
  );
}
