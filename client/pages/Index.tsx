import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { FormCard } from "@/components/forms/FormCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Eye, EyeOff, Settings, FileQuestion, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Form } from "@shared/api";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TemplateKey = "contact" | "feedback" | "event" | "survey" | "quiz" | "job" | "satisfaction" | "order" | "rsvp" | "registration" | "review" | "service" | "assessment";

export default function Index() {
  const { token } = useAuth();
  const [forms, setForms] = useState<Form[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [hiddenTemplates, setHiddenTemplates] = useState<Set<TemplateKey>>(new Set());
  const [showHidden, setShowHidden] = useState(false);
  const [showManageDialog, setShowManageDialog] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "quiz" | "regular">("all");
  const [sortBy, setSortBy] = useState<"recent" | "created" | "responses" | "alphabetical">("recent");
  
  // Template metadata for management dialog
  const templateMetadata: Record<TemplateKey, { name: string; description: string }> = {
    contact: { name: "Contact Information", description: "Collect basic contact details" },
    feedback: { name: "Feedback", description: "Get ratings and comments" },
    event: { name: "Event Registration", description: "Register attendees for an event" },
    survey: { name: "Survey", description: "Create a questionnaire survey" },
    quiz: { name: "Quiz", description: "Create a knowledge quiz" },
    job: { name: "Job Application", description: "Collect job applications" },
    satisfaction: { name: "Customer Satisfaction", description: "Measure customer satisfaction" },
    order: { name: "Order Form", description: "Collect product orders" },
    rsvp: { name: "RSVP", description: "Event attendance confirmation" },
    registration: { name: "Registration", description: "User account registration" },
    review: { name: "Product Review", description: "Collect product reviews" },
    service: { name: "Service Request", description: "Handle service requests" },
    assessment: { name: "Assessment", description: "Skills and knowledge assessment" },
  };

  // Load hidden templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('hiddenTemplates');
      if (stored) {
        const parsed = JSON.parse(stored);
        setHiddenTemplates(new Set(parsed));
      }
    } catch (error) {
      console.error('Failed to load hidden templates:', error);
    }
  }, []);

  // Save hidden templates to localStorage
  const saveHiddenTemplates = (hidden: Set<TemplateKey>) => {
    try {
      localStorage.setItem('hiddenTemplates', JSON.stringify(Array.from(hidden)));
    } catch (error) {
      console.error('Failed to save hidden templates:', error);
    }
  };

  const toggleTemplateVisibility = (templateKey: TemplateKey, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newHidden = new Set(hiddenTemplates);
    if (newHidden.has(templateKey)) {
      newHidden.delete(templateKey);
    } else {
      newHidden.add(templateKey);
    }
    setHiddenTemplates(newHidden);
    saveHiddenTemplates(newHidden);
  };

  const isTemplateHidden = (templateKey: TemplateKey) => {
    return hiddenTemplates.has(templateKey) && !showHidden;
  };

  // Hover border class mapping for each template
  const hoverBorderClasses: Record<TemplateKey, string> = {
    contact: "hover:border-emerald-300",
    feedback: "hover:border-indigo-300",
    event: "hover:border-amber-300",
    survey: "hover:border-purple-300",
    quiz: "hover:border-red-300",
    job: "hover:border-blue-300",
    satisfaction: "hover:border-green-300",
    order: "hover:border-teal-300",
    rsvp: "hover:border-pink-300",
    registration: "hover:border-cyan-300",
    review: "hover:border-orange-300",
    service: "hover:border-slate-300",
    assessment: "hover:border-violet-300",
  };

  // Helper function to render template card with hide/unhide button
  const renderTemplateCard = (
    templateKey: TemplateKey,
    link: string,
    title: string,
    description: string,
    iconBg: string,
    gradientFrom: string,
    gradientTo: string,
    iconText: string
  ) => {
    if (isTemplateHidden(templateKey)) return null;

    return (
      <div key={templateKey} className="relative group flex-shrink-0">
        <Link to={link}>
          <div className={`w-[13rem] sm:w-56 h-40 rounded-xl border border-gray-200 bg-gradient-to-br ${gradientFrom} via-white ${gradientTo} hover:shadow-lg ${hoverBorderClasses[templateKey]} transition-all duration-200 flex flex-col overflow-hidden cursor-pointer`}>
            <div className="flex-1 flex items-center justify-center">
              <div className={`w-12 h-12 rounded-xl ${iconBg} flex items-center justify-center shadow-md`}>
                <span className="text-white text-lg font-semibold">{iconText}</span>
              </div>
            </div>
            <div className="border-t border-gray-100 px-4 py-3 bg-white/70">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {title}
              </p>
              <p className="text-xs text-gray-500 line-clamp-2">
                {description}
              </p>
            </div>
          </div>
        </Link>
      </div>
    );
  };

  useEffect(() => {
    if (token) {
      fetchForms();
    }
    
    // Listen for form creation/deletion events to refresh the list
    const handleFormCreated = () => {
      if (token) {
        fetchForms();
      }
    };
    
    const handleFormDeleted = () => {
      if (token) {
        fetchForms();
      }
    };
    
    // Refresh when page becomes visible (user comes back from opening a form)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && token) {
        fetchForms();
    }
    };
    
    window.addEventListener('formCreated', handleFormCreated);
    window.addEventListener('formDeleted', handleFormDeleted);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('formCreated', handleFormCreated);
      window.removeEventListener('formDeleted', handleFormDeleted);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token]);

  const fetchForms = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/user/forms', {
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

  // Listen for search changes dispatched from header
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>;
      setSearchTerm(custom.detail || "");
    };

    window.addEventListener("formSearchChanged", handler as EventListener);
    return () => {
      window.removeEventListener("formSearchChanged", handler as EventListener);
    };
  }, []);

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w ago`;
    return `${Math.floor(diffInSeconds / 2592000)}mo ago`;
  };

  const formatExactTime = (dateString: string | null | undefined) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const filteredForms = forms
    .filter((form) => {
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesSearch = form.title.toLowerCase().includes(q) ||
          (form.description || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      
      // Type filter
      if (filterType === "quiz") {
        // Check if is_quiz is true (backend converts to boolean)
        return Boolean(form.is_quiz);
      } else if (filterType === "regular") {
        // Check if is_quiz is false/null/undefined
        return !form.is_quiz;
      }
      return true; // "all"
    })
    .sort((a, b) => {
      // Sort filter
      switch (sortBy) {
        case "recent":
          // Sort by last_opened_at (most recent first)
          const aOpened = a.last_opened_at ? new Date(a.last_opened_at).getTime() : 0;
          const bOpened = b.last_opened_at ? new Date(b.last_opened_at).getTime() : 0;
          return bOpened - aOpened;
        case "created":
          // Sort by created_at (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "responses":
          // Sort by response_count (most responses first)
          return (b.response_count || 0) - (a.response_count || 0);
        case "alphabetical":
          // Sort alphabetically by title
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });

  if (isLoading) {
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
      <div className="space-y-8">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="space-y-2">
            <h2 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">
              Your Forms
            </h2>
            <p className="text-gray-600 text-lg">
              Create, manage, and share forms to collect responses from your audience
            </p>
          </div>
        </div>

        {/* Start a new form (Google Forms-style) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-800">
              Add a new form
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowManageDialog(true)}
              className="text-xs text-gray-600 hover:text-gray-900 h-8 px-3 gap-2"
            >
              <Settings className="w-3 h-3" />
              Manage Templates
              {hiddenTemplates.size > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700 text-[10px] font-semibold">
                  {hiddenTemplates.size} hidden
                </span>
              )}
            </Button>
          </div>
          {/* Blank form and Quiz buttons - first row */}
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 md:overflow-visible">
            {/* Blank form */}
            <Link to="/create" className="flex-shrink-0">
              <div className="w-[13rem] sm:w-56 h-40 rounded-xl border border-gray-200 bg-gradient-to-br from-primary/5 via-white to-primary/10 hover:shadow-lg hover:border-primary/40 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer">
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-md">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="border-t border-gray-100 px-4 py-3 bg-white/70">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    Blank form
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    Create a form from scratch
                  </p>
                </div>
              </div>
            </Link>

            {/* Quiz form */}
            <Link to="/create?template=quiz" className="flex-shrink-0">
              <div className="w-[13rem] sm:w-56 h-40 rounded-xl border border-gray-200 bg-gradient-to-br from-red-50 via-white to-red-100 hover:shadow-lg hover:border-red-300 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer">
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-12 h-12 rounded-xl bg-red-500 flex items-center justify-center shadow-md">
                    <FileQuestion className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="border-t border-gray-100 px-4 py-3 bg-white/70">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    Quiz
                  </p>
                  <p className="text-xs text-gray-500 line-clamp-2">
                    Creat a quiz
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* Template cards - second row */}
          <div className="flex gap-3 sm:gap-4 overflow-x-auto pb-3 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 md:overflow-visible md:flex-wrap md:justify-start">
            {renderTemplateCard(
              "contact",
              "/create?template=contact",
              "Contact Information",
              "Collect basic contact details",
              "bg-emerald-500",
              "from-emerald-50",
              "to-emerald-100",
              "CI"
            )}

            {renderTemplateCard(
              "feedback",
              "/create?template=feedback",
              "Feedback",
              "Get ratings and comments",
              "bg-indigo-500",
              "from-indigo-50",
              "to-indigo-100",
              "FB"
            )}

            {renderTemplateCard(
              "event",
              "/create?template=event",
              "Event registration",
              "Register attendees for an event",
              "bg-amber-500",
              "from-amber-50",
              "to-amber-100",
              "EV"
            )}

            {renderTemplateCard(
              "survey",
              "/create?template=survey",
              "Survey",
              "Create a questionnaire survey",
              "bg-purple-500",
              "from-purple-50",
              "to-purple-100",
              "SV"
            )}

            {renderTemplateCard(
              "job",
              "/create?template=job",
              "Job Application",
              "Collect job applications",
              "bg-blue-500",
              "from-blue-50",
              "to-blue-100",
              "JB"
            )}

            {renderTemplateCard(
              "satisfaction",
              "/create?template=satisfaction",
              "Customer Satisfaction",
              "Measure customer satisfaction",
              "bg-green-500",
              "from-green-50",
              "to-green-100",
              "CS"
            )}

            {renderTemplateCard(
              "order",
              "/create?template=order",
              "Order Form",
              "Collect product orders",
              "bg-teal-500",
              "from-teal-50",
              "to-teal-100",
              "OR"
            )}

            {renderTemplateCard(
              "rsvp",
              "/create?template=rsvp",
              "RSVP",
              "Event attendance confirmation",
              "bg-pink-500",
              "from-pink-50",
              "to-pink-100",
              "RP"
            )}

            {renderTemplateCard(
              "registration",
              "/create?template=registration",
              "Registration",
              "User account registration",
              "bg-cyan-500",
              "from-cyan-50",
              "to-cyan-100",
              "RG"
            )}

            {renderTemplateCard(
              "review",
              "/create?template=review",
              "Product Review",
              "Collect product reviews",
              "bg-orange-500",
              "from-orange-50",
              "to-orange-100",
              "PR"
            )}

            {renderTemplateCard(
              "service",
              "/create?template=service",
              "Service Request",
              "Handle service requests",
              "bg-slate-500",
              "from-slate-50",
              "to-slate-100",
              "SR"
            )}

            {renderTemplateCard(
              "assessment",
              "/create?template=assessment",
              "Assessment",
              "Skills and knowledge assessment",
              "bg-violet-500",
              "from-violet-50",
              "to-violet-100",
              "AS"
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 text-red-800 px-4 py-3 rounded-md shadow-sm">
            <p className="font-medium">{error}</p>
          </div>
        )}

        {/* Forms Grid */}
        {forms.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-base font-semibold text-gray-800">
                Recent forms
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterType} onValueChange={(value: "all" | "quiz" | "regular") => setFilterType(value)}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Forms</SelectItem>
                    <SelectItem value="quiz">Quiz Only</SelectItem>
                    <SelectItem value="regular">Regular Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(value: "recent" | "created" | "responses" | "alphabetical") => setSortBy(value)}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Recently Opened</SelectItem>
                    <SelectItem value="created">Recently Created</SelectItem>
                    <SelectItem value="responses">Most Responses</SelectItem>
                    <SelectItem value="alphabetical">Alphabetical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredForms.map((form) => (
                  <FormCard
                    key={form.id}
                    id={form.id.toString()}
                  shareToken={form.share_token}
                    title={form.title}
                    description={form.description || ""}
                    responses={form.response_count || 0}
                  updatedAt={form.last_opened_at ? formatExactTime(form.last_opened_at) : "Never"}
                  onDelete={fetchForms}
                  />
                ))}
              {filteredForms.length === 0 && (
                <p className="text-sm text-gray-500 col-span-full">
                  No forms match your search.
                </p>
              )}
            </div>
              </div>
            )}

        {/* Empty state hint */}
        {forms.length === 0 && !isLoading && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 mb-6">
              <Plus className="w-10 h-10 text-primary" />
              </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              No forms yet
                  </h3>
            <p className="text-gray-600 text-lg mb-6 max-w-md mx-auto">
              Get started by creating your first form to collect responses
            </p>
            <Link to="/create">
              <Button className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary text-white gap-2 shadow-md hover:shadow-lg transition-all duration-200">
                <Plus className="w-5 h-5" />
                Create Your First Form
              </Button>
            </Link>
          </div>
            )}

        {/* Manage Templates Dialog */}
        <Dialog open={showManageDialog} onOpenChange={setShowManageDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Templates</DialogTitle>
              <DialogDescription>
                Select which templates to show or hide. Hidden templates won't appear in the list below.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between border-b pb-3 mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="select-all"
                    checked={hiddenTemplates.size === 0}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setHiddenTemplates(new Set());
                        saveHiddenTemplates(new Set());
                      } else {
                        const allTemplates = new Set(Object.keys(templateMetadata) as TemplateKey[]);
                        setHiddenTemplates(allTemplates);
                        saveHiddenTemplates(allTemplates);
                      }
                    }}
                  />
                  <Label htmlFor="select-all" className="text-sm font-semibold cursor-pointer">
                    {hiddenTemplates.size === 0 ? "Show All" : "Hide All"}
                  </Label>
                </div>
                <span className="text-xs text-gray-500">
                  {Object.keys(templateMetadata).length - hiddenTemplates.size} of {Object.keys(templateMetadata).length} visible
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(templateMetadata) as TemplateKey[]).map((templateKey) => {
                  const isHidden = hiddenTemplates.has(templateKey);
                  const template = templateMetadata[templateKey];
                  
                  return (
                    <div
                      key={templateKey}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        isHidden ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      <Checkbox
                        id={templateKey}
                        checked={!isHidden}
                        onCheckedChange={(checked) => {
                          const newHidden = new Set(hiddenTemplates);
                          if (checked) {
                            newHidden.delete(templateKey);
                          } else {
                            newHidden.add(templateKey);
                          }
                          setHiddenTemplates(newHidden);
                          saveHiddenTemplates(newHidden);
                        }}
                      />
                      <Label
                        htmlFor={templateKey}
                        className="flex-1 cursor-pointer"
                      >
                        <div className="text-sm font-medium text-gray-900">
                          {template.name}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {template.description}
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowManageDialog(false)}
              >
                Done
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
