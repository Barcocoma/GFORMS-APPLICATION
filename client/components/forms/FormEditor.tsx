import { useState, useEffect } from "react";
import { Eye, Loader2, Copy, Check, ArrowLeft, Plus, Settings, FileQuestion, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams } from "react-router-dom";
import { QuestionBuilder } from "./QuestionBuilder";
import { ResponsesView } from "./ResponsesView";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { CreateFormRequest, CreateFormResponse, FormQuestion, ConditionalLogic } from "@shared/api";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type TemplateType = "contact" | "feedback" | "event" | "blank" | "survey" | "quiz" | "job" | "satisfaction" | "order" | "rsvp" | "registration" | "review" | "service" | "assessment";

interface FormEditorProps {
  formId?: string;
  template?: TemplateType;
}

export interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: 'email' | 'phone' | 'url' | 'number';
  minValue?: number;
  maxValue?: number;
  customPattern?: string;
}

export interface Question {
  id: string;
  title: string;
  type: "short" | "long" | "multiple" | "checkbox" | "dropdown" | "linear" | "file" | "rating" | "time" | "date" | "multiple_grid" | "checkbox_grid";
  required: boolean;
  options?: string[];
  rows?: string[]; // For grid types
  columns?: string[]; // For grid types
  hasOther?: boolean; // Enable "Other" option for multiple choice and checkbox
  description?: string; // Question description/help text
  validation?: ValidationRules; // Validation rules
  conditionalLogic?: ConditionalLogic; // Conditional logic rules
  correctAnswer?: string | string[]; // Correct answer for quiz mode
  points?: number; // Points for this question (default: 1)
}

export interface Section {
  id: string;
  title: string;
  description?: string;
}

export function FormEditor({ formId: initialFormId, template: initialTemplate }: FormEditorProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  
  // Get formId from URL params (updated after save) or from props
  const currentFormId = searchParams.get("edit") || initialFormId;
  const currentTemplate = searchParams.get("template") as TemplateType | null || initialTemplate;
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [acceptingResponses, setAcceptingResponses] = useState(true);
  const [responseLimit, setResponseLimit] = useState<number | null>(null);
  // Quiz is determined by template type for new forms, or by is_quiz from database for existing forms
  const [isQuizFromDb, setIsQuizFromDb] = useState(false);
  const isQuiz = currentFormId ? isQuizFromDb : (currentTemplate === "quiz");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const isEditMode = !!currentFormId;
  const [initializedFromTemplate, setInitializedFromTemplate] = useState(false);
  const [activeTab, setActiveTab] = useState<"questions" | "responses" | "settings">("questions");
  const [submissionCount, setSubmissionCount] = useState(0);

  // LocalStorage key for form draft
  const getDraftKey = () => {
    if (currentFormId) {
      return `form_draft_${currentFormId}`;
    }
    // Use template-specific key for new forms to avoid conflicts
    if (currentTemplate) {
      return `form_draft_new_${currentTemplate}`;
    }
    // Use a fixed key for blank forms
    return `form_draft_new_blank`;
  };

  // Save form data to localStorage
  const saveDraftToLocalStorage = () => {
    try {
      const draftData = {
        formTitle,
        formDescription,
        questions,
        confirmationMessage,
        acceptingResponses,
        responseLimit,
        // Note: isQuiz is determined by template, not stored in draft
        timestamp: Date.now(),
      };
      localStorage.setItem(getDraftKey(), JSON.stringify(draftData));
    } catch (error) {
      console.error('Failed to save draft to localStorage:', error);
    }
  };

  // Load form data from localStorage
  const loadDraftFromLocalStorage = () => {
    try {
      const draftData = localStorage.getItem(getDraftKey());
      if (draftData) {
        const parsed = JSON.parse(draftData);
        // Check if draft is not too old (24 hours)
        const draftAge = Date.now() - (parsed.timestamp || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (draftAge < maxAge) {
          setFormTitle(parsed.formTitle || "");
          setFormDescription(parsed.formDescription || "");
          setQuestions(parsed.questions || []);
          setConfirmationMessage(parsed.confirmationMessage || "");
          setAcceptingResponses(parsed.acceptingResponses !== undefined ? parsed.acceptingResponses : true);
          setResponseLimit(parsed.responseLimit || null);
          // Note: isQuiz is now determined by template, not stored in draft
          return true; // Draft was loaded
        } else {
          // Draft is too old, remove it
          localStorage.removeItem(getDraftKey());
        }
      }
    } catch (error) {
      console.error('Failed to load draft from localStorage:', error);
    }
    return false; // No draft was loaded
  };

  // Clear draft from localStorage
  const clearDraftFromLocalStorage = () => {
    try {
      localStorage.removeItem(getDraftKey());
    } catch (error) {
      console.error('Failed to clear draft from localStorage:', error);
    }
  };

  const getTemplateConfig = (templateType?: TemplateType) => {
    switch (templateType) {
      case "contact":
        return {
          title: "Contact Information",
          description: "Please provide your contact details.",
          questions: [
            {
              id: "name",
              title: "Full name",
              type: "short",
              required: true,
            },
            {
              id: "email",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "phone",
              title: "Phone number",
              type: "short",
              required: false,
            },
            {
              id: "message",
              title: "Message / notes",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "feedback":
        return {
          title: "Feedback Form",
          description: "Help us improve by sharing your feedback.",
          questions: [
            {
              id: "experience",
              title: "How was your overall experience?",
              type: "multiple",
              required: true,
              options: ["Excellent", "Good", "Average", "Poor"],
            },
            {
              id: "rating",
              title: "Rate us from 1 to 5",
              type: "linear",
              required: true,
            },
            {
              id: "improve",
              title: "What can we improve?",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "event":
        return {
          title: "Event Registration",
          description: "Register for our event by filling out the form below.",
          questions: [
            {
              id: "fullname",
              title: "Full name",
              type: "short",
              required: true,
            },
            {
              id: "email_event",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "attendance",
              title: "Will you attend?",
              type: "multiple",
              required: true,
              options: ["Yes", "No", "Maybe"],
            },
            {
              id: "guests",
              title: "Number of guests",
              type: "short",
      required: false,
    },
    {
              id: "notes_event",
              title: "Special requirements or notes",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "survey":
        return {
          title: "Survey Questionnaire",
          description: "Please take a few minutes to complete this survey. Your feedback is valuable to us.",
          questions: [
            {
              id: "age",
              title: "Age group",
              type: "multiple",
              required: true,
              options: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"],
            },
            {
              id: "frequency",
              title: "How often do you use our service?",
              type: "multiple",
              required: true,
              options: ["Daily", "Weekly", "Monthly", "Rarely", "First time"],
            },
            {
              id: "satisfaction_survey",
              title: "Overall satisfaction",
              type: "rating",
              required: true,
              options: ["star", "5"],
            },
            {
              id: "features",
              title: "Which features do you find most useful? (Select all that apply)",
              type: "checkbox",
              required: false,
              options: ["Easy to use", "Fast performance", "Good design", "Customer support", "Pricing"],
            },
            {
              id: "comments_survey",
              title: "Additional comments or suggestions",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "quiz":
        return {
          title: "Knowledge Quiz",
          description: "Test your knowledge with this quiz. Good luck!",
          questions: [
            {
              id: "name_quiz",
              title: "Your name",
              type: "short",
              required: true,
            },
            {
              id: "question1",
              title: "What is the capital of France?",
              type: "multiple",
              required: true,
              options: ["London", "Berlin", "Paris", "Madrid"],
              correctAnswer: "Paris",
              points: 1,
            },
            {
              id: "question2",
              title: "Which planet is closest to the Sun?",
              type: "multiple",
              required: true,
              options: ["Venus", "Mercury", "Earth", "Mars"],
              correctAnswer: "Mercury",
              points: 1,
            },
            {
              id: "question3",
              title: "What is 2 + 2?",
              type: "short",
              required: true,
              correctAnswer: "4",
              points: 1,
            },
          ] as Question[],
        };
      case "job":
        return {
          title: "Job Application Form",
          description: "Please fill out this application form. We'll review your submission and get back to you soon.",
          questions: [
            {
              id: "fullname_job",
              title: "Full name",
              type: "short",
              required: true,
            },
            {
              id: "email_job",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "phone_job",
              title: "Phone number",
              type: "short",
              required: true,
            },
            {
              id: "position",
              title: "Position you're applying for",
              type: "short",
              required: true,
            },
            {
              id: "experience",
              title: "Years of relevant experience",
              type: "multiple",
              required: true,
              options: ["0-1 years", "2-3 years", "4-5 years", "6-10 years", "10+ years"],
            },
            {
              id: "resume",
              title: "Upload your resume",
              type: "file",
              required: true,
            },
            {
              id: "cover_letter",
              title: "Cover letter",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "satisfaction":
        return {
          title: "Customer Satisfaction Survey",
          description: "We'd love to hear about your experience with our service.",
          questions: [
            {
              id: "service_rating",
              title: "How would you rate our service?",
              type: "rating",
              required: true,
              options: ["star", "5"],
            },
            {
              id: "likely_recommend",
              title: "How likely are you to recommend us to others?",
              type: "linear",
              required: true,
            },
            {
              id: "most_satisfied",
              title: "What are you most satisfied with?",
              type: "checkbox",
              required: false,
              options: ["Product quality", "Customer service", "Delivery speed", "Price value", "Website experience"],
            },
            {
              id: "improvements",
              title: "What could we improve?",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "order":
        return {
          title: "Order Form",
          description: "Place your order by filling out the form below.",
          questions: [
            {
              id: "customer_name",
              title: "Customer name",
              type: "short",
              required: true,
            },
            {
              id: "email_order",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "phone_order",
              title: "Phone number",
              type: "short",
              required: true,
            },
            {
              id: "product",
              title: "Product selection",
              type: "dropdown",
              required: true,
              options: ["Product A", "Product B", "Product C", "Product D"],
            },
            {
              id: "quantity",
              title: "Quantity",
              type: "short",
              required: true,
            },
            {
              id: "shipping",
              title: "Shipping address",
              type: "long",
              required: true,
            },
            {
              id: "notes_order",
              title: "Special instructions",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "rsvp":
        return {
          title: "RSVP Form",
          description: "Please let us know if you'll be attending.",
          questions: [
            {
              id: "name_rsvp",
              title: "Your name",
              type: "short",
              required: true,
            },
            {
              id: "email_rsvp",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "attending",
              title: "Will you be attending?",
              type: "multiple",
              required: true,
              options: ["Yes, I'll be there", "Sorry, I can't make it"],
            },
            {
              id: "guests_rsvp",
              title: "Number of guests (including yourself)",
              type: "short",
              required: false,
            },
            {
              id: "dietary",
              title: "Dietary restrictions or preferences",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      case "registration":
        return {
          title: "Registration Form",
          description: "Create your account by completing the registration form.",
          questions: [
            {
              id: "username",
              title: "Username",
              type: "short",
              required: true,
            },
            {
              id: "email_reg",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "fullname_reg",
              title: "Full name",
              type: "short",
              required: true,
            },
            {
              id: "organization",
              title: "Organization / Company",
              type: "short",
              required: false,
            },
            {
              id: "interests",
              title: "Areas of interest (Select all that apply)",
              type: "checkbox",
              required: false,
              options: ["Technology", "Business", "Education", "Healthcare", "Other"],
            },
          ] as Question[],
        };
      case "review":
        return {
          title: "Product Review",
          description: "Share your honest review of our product.",
          questions: [
            {
              id: "product_name",
              title: "Product name",
              type: "short",
              required: true,
            },
            {
              id: "overall_rating",
              title: "Overall rating",
              type: "rating",
              required: true,
              options: ["star", "5"],
            },
            {
              id: "pros",
              title: "What did you like?",
              type: "long",
              required: false,
            },
            {
              id: "cons",
              title: "What could be improved?",
              type: "long",
              required: false,
            },
            {
              id: "recommend",
              title: "Would you recommend this product?",
              type: "multiple",
              required: true,
              options: ["Yes, definitely", "Yes, probably", "Maybe", "Probably not", "No"],
            },
          ] as Question[],
        };
      case "service":
        return {
          title: "Service Request Form",
          description: "Submit your service request and we'll get back to you as soon as possible.",
          questions: [
            {
              id: "name_service",
              title: "Your name",
              type: "short",
              required: true,
            },
            {
              id: "email_service",
              title: "Email address",
              type: "short",
              required: true,
            },
            {
              id: "phone_service",
              title: "Phone number",
              type: "short",
              required: true,
            },
            {
              id: "service_type",
              title: "Type of service needed",
              type: "multiple",
              required: true,
              options: ["Technical Support", "Sales Inquiry", "Billing Question", "General Inquiry", "Other"],
            },
            {
              id: "priority",
              title: "Priority level",
              type: "multiple",
              required: true,
              options: ["Low", "Medium", "High", "Urgent"],
            },
            {
              id: "description",
              title: "Please describe your request in detail",
              type: "long",
              required: true,
            },
          ] as Question[],
        };
      case "assessment":
        return {
          title: "Skills Assessment",
          description: "Complete this assessment to evaluate your skills and knowledge.",
          questions: [
            {
              id: "name_assessment",
              title: "Your name",
              type: "short",
              required: true,
            },
            {
              id: "skill_level",
              title: "What is your current skill level?",
              type: "multiple",
              required: true,
              options: ["Beginner", "Intermediate", "Advanced", "Expert"],
            },
            {
              id: "skills",
              title: "Select your skills (Select all that apply)",
              type: "checkbox",
              required: false,
              options: ["Communication", "Problem Solving", "Teamwork", "Leadership", "Time Management", "Technical Skills"],
            },
            {
              id: "strengths",
              title: "What are your main strengths?",
              type: "long",
              required: true,
            },
            {
              id: "areas_improvement",
              title: "Areas you'd like to improve",
              type: "long",
              required: false,
            },
          ] as Question[],
        };
      default:
        return {
          title: "",
          description: "",
          questions: [
            {
              id: Date.now().toString(),
              title: "",
              type: "short",
      required: false,
            },
          ] as Question[],
        };
    }
  };

  // Map database question types to frontend types
  const mapDbTypeToFrontend = (dbType: string): Question["type"] => {
    const typeMap: Record<string, Question["type"]> = {
      'text': 'short',
      'textarea': 'long',
      'radio': 'multiple',
      'checkbox': 'checkbox',
      'select': 'dropdown',
      'number': 'linear',
      'email': 'short',
      'date': 'date',
    };
    return typeMap[dbType] || 'short';
  };

  // Load form data if editing or from localStorage/template
  useEffect(() => {
    if (currentFormId && token) {
      // Try to load draft first, then load from server
      const draftLoaded = loadDraftFromLocalStorage();
      if (!draftLoaded) {
        loadFormData();
      } else {
        // Still load from server in background to get latest data
        loadFormData();
      }
      return;
    }

    // Initialize from template or localStorage when creating a new form
    if (!currentFormId && !initializedFromTemplate) {
      // If a specific template is selected, prioritize template over draft
      // Otherwise, try to load draft first
      if (currentTemplate && currentTemplate !== 'blank') {
        // Template is specified, use it directly (don't load draft)
        const config = getTemplateConfig(currentTemplate);
        setFormTitle(config.title);
        setFormDescription(config.description);
        setQuestions(config.questions);
      } else {
        // No specific template, try to load draft first
        const draftLoaded = loadDraftFromLocalStorage();
        
        if (!draftLoaded) {
          // No draft, use template (blank or specified)
          const config = getTemplateConfig(currentTemplate);
          setFormTitle(config.title);
          setFormDescription(config.description);
          setQuestions(config.questions);
        }
      }
      
      setInitializedFromTemplate(true);
    }
  }, [currentFormId, token, initializedFromTemplate, currentTemplate]);

  // Save draft to localStorage whenever form data changes (debounced)
  useEffect(() => {
    if (!initializedFromTemplate) return;
    
    const timeoutId = setTimeout(() => {
      saveDraftToLocalStorage();
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [formTitle, formDescription, questions, confirmationMessage, acceptingResponses, responseLimit, isQuiz, initializedFromTemplate, currentTemplate]);

  const loadFormData = async () => {
    // Don't call API if formId is undefined
    if (!currentFormId || !token) {
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(`/api/forms/${currentFormId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load form');
      }

      const data = await response.json();
      setFormTitle(data.title);
      setFormDescription(data.description || "");
      setConfirmationMessage(data.confirmation_message || "");
      setAcceptingResponses(data.accepting_responses !== undefined ? data.accepting_responses : true);
      setResponseLimit(data.response_limit || null);
      // Set isQuiz from database for existing forms
      setIsQuizFromDb(data.is_quiz !== undefined ? data.is_quiz : false);
      setSubmissionCount(data.submission_count || 0);
      
      // Convert database questions to frontend format
      const mappedQuestions: Question[] = data.questions.map((q: any) => {
        // Determine frontend type, including special handling for rating vs linear
        let type = mapDbTypeToFrontend(q.question_type);

        if (q.question_type === 'number') {
          // If options[0] is star/heart/like, treat as rating, otherwise linear
          const marker = Array.isArray(q.options) ? q.options[0] : undefined;
          if (marker && ['star', 'heart', 'like'].includes(marker)) {
            type = 'rating';
          } else {
            type = 'linear';
          }
        } else if (q.question_type === 'text') {
          // Detect time questions stored as text with special marker
          const marker = Array.isArray(q.options) ? q.options[0] : undefined;
          if (marker === '__TIME__') {
            type = 'time';
          }
        }

        return {
          id: q.id.toString(),
          title: q.question_text,
          type,
          required: q.is_required,
          options: q.options || [],
          hasOther: q.has_other || false,
          description: q.description || '',
          validation: q.validation || undefined,
          conditionalLogic: q.conditional_logic || undefined,
          correctAnswer: q.correct_answer || undefined,
          points: q.points || 1,
        };
      });

      if (mappedQuestions.length > 0) {
        setQuestions(mappedQuestions);
      } else {
        // If no questions, add one empty question
        setQuestions([{
          id: Date.now().toString(),
          title: "",
          type: "short",
          required: false,
        }]);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to load form',
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setIsLoading(false);
    }
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString(),
      title: "",
      type: "short",
      required: false,
    };
    setQuestions([...questions, newQuestion]);
    setSelectedQuestionId(newQuestion.id);
  };

  const addSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: "Untitled Section",
      description: "",
    };
    setSections([...sections, newSection]);
  };

  const addTitleAndDescription = () => {
    // This is essentially the form header, which already exists
    // But we can scroll to it or highlight it
    toast({
      title: "Info",
      description: "Form title and description are at the top of the form.",
    });
  };

  const updateQuestion = (id: string, updated: Partial<Question>) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updated } : q)),
    );
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const duplicateQuestion = (id: string) => {
    const questionToDuplicate = questions.find((q) => q.id === id);
    if (questionToDuplicate) {
      const index = questions.findIndex((q) => q.id === id);
      const duplicatedQuestion: Question = {
        ...questionToDuplicate,
        id: Date.now().toString(),
        title: `${questionToDuplicate.title} (Copy)`,
      };
      const newQuestions = [...questions];
      newQuestions.splice(index + 1, 0, duplicatedQuestion);
      setQuestions(newQuestions);
      toast({
        title: "Question Duplicated",
        description: "Question has been duplicated successfully",
      });
    }
  };

  const moveQuestion = (id: string, direction: 'up' | 'down') => {
    const index = questions.findIndex((q) => q.id === id);
    if (index === -1) return;
    
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;
    
    const newQuestions = [...questions];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    setQuestions(newQuestions);
  };

  // Map frontend question types to backend types
  const mapFrontendTypeToBackend = (type: Question["type"]): FormQuestion["type"] => {
    const typeMap: Record<Question["type"], FormQuestion["type"]> = {
      'short': 'short',
      'long': 'long',
      'multiple': 'multiple',
      'checkbox': 'checkbox',
      'dropdown': 'dropdown',
      'linear': 'number',
      'date': 'date',
      'time': 'text', // Store as text, use options[0] marker to restore
      'file': 'text', // Map file to text for now
      'rating': 'number', // Map rating to number/linear scale
      'multiple_grid': 'multiple', // Map grid to multiple choice for now
      'checkbox_grid': 'checkbox', // Map grid to checkbox for now
    };
    return typeMap[type] || 'short';
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a form title",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one question",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);

    try {
      const formData: CreateFormRequest = {
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
        confirmation_message: confirmationMessage.trim() || undefined,
        accepting_responses: acceptingResponses,
        response_limit: responseLimit && responseLimit > 0 ? responseLimit : null,
        is_quiz: isQuiz,
        questions: questions.map((q) => {
          // Ensure rating and time questions carry markers in options
          let options = q.options ? [...q.options] : [];

          if (q.type === "rating") {
            // options[0] holds icon type: star | heart | like
            if (!options[0]) {
              options[0] = "star";
            }
          }

          if (q.type === "time") {
            // Mark time questions so we can restore type on load
            if (!options[0]) {
              options[0] = "__TIME__";
            }
          }

          return {
            title: q.title,
            type: mapFrontendTypeToBackend(q.type),
            required: q.required,
            options,
            rows: q.rows,
            columns: q.columns,
            hasOther: q.hasOther || false,
            description: q.description || '',
            validation: q.validation || undefined,
            conditionalLogic: q.conditionalLogic || undefined,
            correctAnswer: q.correctAnswer || undefined,
            points: q.points || 1,
          };
        }),
      };

      const url = isEditMode ? `/api/forms/${currentFormId}` : '/api/forms';
      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save form');
      }

      const data: CreateFormResponse = await response.json();
      const fullShareUrl = `${window.location.origin}/form/${data.share_token}`;
      setShareUrl(fullShareUrl);
      setShowSuccessDialog(true);

      toast({
        title: "Success",
        description: `"${formTitle}" has been ${isEditMode ? 'updated' : 'saved'}.`,
      });
      
      // Clear draft from localStorage after successful save
      clearDraftFromLocalStorage();

      // If it's a new form, update the URL to include formId for edit mode
      // This allows the user to continue editing without losing their work
      if (!isEditMode && data.id) {
        // Update URL without navigation to preserve current state
        window.history.replaceState({}, '', `/create?edit=${data.id}`);
        // Reload form data to get submission count and enable responses tab
        setTimeout(() => {
          loadFormData();
        }, 500);
      }
      
      // Trigger a custom event to refresh the forms list
      window.dispatchEvent(new CustomEvent('formCreated'));
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save form',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copied!",
      description: "Shareable link copied to clipboard",
    });
  };

  const handleCloseSuccess = () => {
    // Just close the dialog, don't navigate away
    // User can continue editing their form
    setShowSuccessDialog(false);
  };

  const handlePreview = () => {
    navigate("/preview", {
      state: {
        title: formTitle,
        description: formDescription,
        questions,
      },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (isEditMode && currentFormId) {
                  navigate(`/forms/${currentFormId}`);
                } else {
                  navigate("/");
                }
              }}
              className="p-0 h-8 w-8"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-semibold text-gray-900">
              {isEditMode ? 'Edit Form' : 'Form Editor'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handlePreview} variant="outline" className="gap-2">
              <Eye className="w-4 h-4" />
              Preview
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || isLoading}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEditMode ? 'Updating...' : 'Saving...'}
                </>
              ) : (
                isEditMode ? 'Update Form' : 'Save Form'
              )}
            </Button>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
        </div>
      ) : (
      <div className="max-w-4xl mx-auto">
        {/* Navigation Tabs - Google Forms Style */}
        <div className="border-b border-gray-300 bg-white -mx-6 px-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "questions" | "responses" | "settings")} className="w-full">
            <TabsList className="w-full justify-start bg-transparent border-none rounded-none h-auto p-0 gap-0">
              <TabsTrigger
                value="questions"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 gap-2 font-medium text-base text-gray-700 hover:text-gray-900 transition-colors"
              >
                <FileQuestion className="w-4 h-4" />
                <span>Questions</span>
                <span className="text-sm text-gray-500 ml-1">({questions.length})</span>
              </TabsTrigger>
              <TabsTrigger
                value="responses"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 gap-2 font-medium text-base text-gray-700 hover:text-gray-900 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Responses</span>
                <span className="text-sm text-gray-500 ml-1">({submissionCount})</span>
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 gap-2 font-medium text-base text-gray-700 hover:text-gray-900 transition-colors"
              >
                <Settings className="w-4 h-4" />
                <span>Settings</span>
              </TabsTrigger>
            </TabsList>

            {/* Questions Tab Content */}
            <TabsContent value="questions" className="mt-6 px-6 pb-8">
              {/* Form Header Section */}
              <div className="bg-gradient-to-br from-purple-100 to-purple-50 rounded-lg p-8 mb-8 border border-purple-200">
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="text-4xl font-bold text-gray-900 mb-4 bg-transparent border-none outline-none w-full placeholder-gray-400"
                  placeholder="Enter Form Title"
                />
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="text-base text-gray-600 bg-transparent border-none outline-none w-full resize-none placeholder-gray-400"
                  placeholder="Form description"
                  rows={2}
                />
              </div>

              {/* Questions Section */}
              <div className="space-y-6 relative">
                {questions.map((question, index) => (
                  <div
                    key={question.id}
                    onClick={() => setSelectedQuestionId(question.id)}
                    className={selectedQuestionId === question.id ? "ring-2 ring-blue-500 rounded-lg" : ""}
                  >
                    <QuestionBuilder
                      question={question}
                      allQuestions={questions}
                      isQuizMode={isQuiz}
                      onUpdate={updateQuestion}
                      onDelete={deleteQuestion}
                      onDuplicate={duplicateQuestion}
                      onMove={moveQuestion}
                      canMoveUp={index > 0}
                      canMoveDown={index < questions.length - 1}
                      isSelected={selectedQuestionId === question.id}
                      isLastQuestion={index === questions.length - 1}
                      onAddQuestion={addQuestion}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Responses Tab Content */}
            <TabsContent value="responses" className="mt-6 px-6 pb-8">
              {isEditMode && currentFormId ? (
                <ResponsesView 
                  questions={questions.map(q => ({
                    id: q.id,
                    title: q.title,
                    type: q.type,
                    required: q.required,
                    options: q.options || []
                  }))} 
                  formId={parseInt(currentFormId)} 
                />
              ) : (
                <div className="flex flex-col items-center justify-center min-h-[400px] bg-white rounded-lg border-2 border-dashed border-gray-300">
                  <div className="text-center p-8">
                    <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Responses Yet</h3>
                    <p className="text-sm text-gray-600 mb-4 max-w-md">
                      Save your form first to start collecting responses. Once saved, you'll be able to view and manage all submitted form data here.
                    </p>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving || isLoading}
                      className="bg-primary hover:bg-primary/90 text-white"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Form'
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Settings Tab Content */}
            <TabsContent value="settings" className="mt-6 px-6 pb-8">
              <div className="bg-white rounded-lg border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">Form Settings</h3>
                  <p className="text-xs text-gray-500 mt-1">Configure how your form accepts and handles responses</p>
                </div>

                {/* Accepting Responses Toggle */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="accepting-responses" className="block text-sm font-semibold text-gray-700 mb-1">
                        Accepting Responses
                      </Label>
                      <p className="text-xs text-gray-500">
                        Toggle to stop or start accepting new responses for this form.
                      </p>
                    </div>
                    <Switch
                      id="accepting-responses"
                      checked={acceptingResponses}
                      onCheckedChange={setAcceptingResponses}
                    />
                  </div>
                </div>

                {/* Form Type Info (for quiz forms) */}
                {isQuiz && (
                  <div className="px-6 py-4 border-b border-gray-200 bg-blue-50/50">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                        <FileQuestion className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <Label className="block text-sm font-semibold text-blue-900 mb-1">
                          Quiz Form
                        </Label>
                        <p className="text-xs text-blue-700">
                          This is a quiz form. You can set correct answers and points for each question. Scores will be calculated automatically when users submit their responses.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Response Limit Section */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <Label htmlFor="response-limit" className="block text-sm font-semibold text-gray-700 mb-2">
                    Response Limit (Optional)
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">
                    Set a maximum number of responses. Form will automatically stop accepting responses when limit is reached. Leave empty for unlimited responses.
                  </p>
                  <div className="flex items-center gap-3">
                    <Input
                      id="response-limit"
                      type="number"
                      min="1"
                      value={responseLimit || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setResponseLimit(value === '' ? null : parseInt(value, 10));
                      }}
                      placeholder="Unlimited"
                      className="w-32"
                    />
                    <span className="text-sm text-gray-600">responses</span>
                    {responseLimit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setResponseLimit(null)}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Custom Confirmation Message Section */}
                <div className="px-6 py-4">
                  <Label htmlFor="confirmation-message" className="block text-sm font-semibold text-gray-700 mb-2">
                    Custom Confirmation Message (Optional)
                  </Label>
                  <p className="text-xs text-gray-500 mb-3">
                    This message will be shown to users after they submit the form. Leave empty to use default message.
                  </p>
                  <Textarea
                    id="confirmation-message"
                    value={confirmationMessage}
                    onChange={(e) => setConfirmationMessage(e.target.value)}
                    className="w-full"
                    placeholder="Thank you for your submission! Your response has been recorded."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      )}

      {/* Floating Action Buttons Sidebar */}

      {/* Success Dialog */}
      <Dialog 
        open={showSuccessDialog} 
        onOpenChange={(open) => {
          // Just close the dialog, don't navigate away
          // User can continue editing their form
          setShowSuccessDialog(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Form Updated Successfully!' : 'Form Created Successfully!'}</DialogTitle>
            <DialogDescription>
              Your form has been {isEditMode ? 'updated' : 'saved'}. Share this link with others to collect responses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Shareable Link</label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="flex-1"
                />
                <Button
                  onClick={copyShareUrl}
                  variant="outline"
                  size="icon"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleCloseSuccess}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
