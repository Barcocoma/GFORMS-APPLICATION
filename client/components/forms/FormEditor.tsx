import { useState, useEffect } from "react";
import { Eye, Loader2, Copy, Check, ArrowLeft, Plus, Settings, FileQuestion, MessageSquare, Minus, X, ChevronRight, Image, Video, Type, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
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
  sectionId?: string | null; // Section this question belongs to
}

export interface ConditionalSectionNavigation {
  questionId?: string; // Question ID that triggers the navigation
  answer?: string | string[]; // Answer value(s) that trigger navigation to this section
  operator?: 'equals' | 'contains' | 'not_equals'; // How to compare the answer
}

export interface Section {
  id: string;
  title: string;
  description?: string;
  conditionalNavigation?: ConditionalSectionNavigation; // Conditional navigation rules
}

export function FormEditor({ formId: initialFormId, template: initialTemplate }: FormEditorProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  
  // Get formId from URL params (updated after save) or from props
  const currentFormId = searchParams.get("edit") || initialFormId;
  const currentTemplate = searchParams.get("template") as TemplateType | null || initialTemplate;
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [acceptingResponses, setAcceptingResponses] = useState(true);
  const [responseLimit, setResponseLimit] = useState<number | null>(null);
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(false);
  const [emailNotificationRecipients, setEmailNotificationRecipients] = useState("");
  const [sendConfirmationEmail, setSendConfirmationEmail] = useState(false);
  const [requiresLogin, setRequiresLogin] = useState(true);
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
        sections,
        confirmationMessage,
        acceptingResponses,
        responseLimit,
        requiresLogin,
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
          setSections(parsed.sections || []);
          setConfirmationMessage(parsed.confirmationMessage || "");
          setAcceptingResponses(parsed.acceptingResponses !== undefined ? parsed.acceptingResponses : true);
          setResponseLimit(parsed.responseLimit || null);
          setRequiresLogin(parsed.requiresLogin !== undefined ? parsed.requiresLogin : true);
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
    // CRITICAL: If coming back from preview, restore state from location.state first
    const locationState = location.state as {
      title?: string;
      description?: string;
      questions?: Question[];
      sections?: Section[];
    } | null;
    
    if (locationState && (locationState.title || locationState.questions)) {
      // Restore form state from preview navigation
      if (locationState.title) setFormTitle(locationState.title);
      if (locationState.description !== undefined) setFormDescription(locationState.description);
      if (locationState.questions) setQuestions(locationState.questions);
      if (locationState.sections) setSections(locationState.sections);
      setInitializedFromTemplate(true);
      return; // Don't load from server or template if we have state from preview
    }
    
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
  }, [currentFormId, token, initializedFromTemplate, currentTemplate, location.state]);

  // Save draft to localStorage whenever form data changes (debounced)
  useEffect(() => {
    if (!initializedFromTemplate) return;
    
    const timeoutId = setTimeout(() => {
      saveDraftToLocalStorage();
    }, 1000); // Debounce: save 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [formTitle, formDescription, questions, sections, confirmationMessage, acceptingResponses, responseLimit, isQuiz, initializedFromTemplate, currentTemplate]);

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
      // Load email settings
      setEmailNotificationsEnabled(data.email_notifications_enabled || false);
      setEmailNotificationRecipients(data.email_notification_recipients || "");
      setSendConfirmationEmail(data.send_confirmation_email || false);
      // Load requires_login setting
      setRequiresLogin(data.requires_login !== undefined ? (data.requires_login === true || data.requires_login === 1) : true);
      
      // Load sections if they exist
      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        const mappedSections: Section[] = data.sections.map((s: any) => ({
          id: String(s.id || s.id?.toString() || Date.now().toString()), // Ensure ID is always a string
          title: s.title || s.section_title || 'Untitled Section',
          description: s.description || s.section_description,
          conditionalNavigation: s.conditionalNavigation || s.conditional_navigation,
        }));
        setSections(mappedSections);
        
        // Debug: Log loaded sections
        console.log('Loaded sections from backend:', mappedSections);
      } else {
        setSections([]);
        // Debug: Log if no sections found
        console.log('No sections found in form data:', data.sections);
      }
      
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

        // Map sectionId - ensure it matches section IDs (both as strings)
        // First, try to get sectionId from the question
        let sectionId = null;
        if (q.sectionId !== undefined && q.sectionId !== null) {
          sectionId = String(q.sectionId);
        } else if (q.section_id !== undefined && q.section_id !== null) {
          sectionId = String(q.section_id);
        }
        
        // Verify that the sectionId actually exists in the loaded sections
        // This ensures we don't have orphaned sectionIds
        if (sectionId && data.sections && Array.isArray(data.sections)) {
          const sectionExists = data.sections.some((s: any) => String(s.id) === sectionId);
          if (!sectionExists) {
            console.warn(`Question "${q.question_text?.substring(0, 30)}" has sectionId ${sectionId} but section doesn't exist`);
            sectionId = null; // Clear invalid sectionId
          }
        }

        return {
          id: q.id.toString(),
          title: q.question_text ? q.question_text.replace(/0+$/, '') : '',
          type,
          required: q.is_required,
          options: q.options || [],
          hasOther: q.has_other || false,
          description: q.description || '',
          validation: q.validation || undefined,
          conditionalLogic: q.conditional_logic || undefined,
          correctAnswer: q.correct_answer || undefined,
          points: q.points || 1,
          sectionId: sectionId,
        };
      });
      
      // Debug: Log loaded questions with their sectionIds
      console.log('Loaded questions with sectionIds:', mappedQuestions.map(q => ({
        id: q.id,
        title: q.title.substring(0, 30),
        sectionId: q.sectionId
      })));

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

  const addQuestion = (sectionId?: string | null) => {
    // If no sectionId provided but sections exist, assign to last section
    let targetSectionId = sectionId;
    if (!targetSectionId && sections.length > 0) {
      targetSectionId = sections[sections.length - 1].id;
    }
    
    const newQuestion: Question = {
      id: Date.now().toString(),
      title: "",
      type: "short",
      required: false,
      sectionId: targetSectionId || null,
    };
    
    // Always add new questions at the bottom of the section
    if (targetSectionId) {
      const sectionIndex = sections.findIndex(s => s.id === targetSectionId);
      if (sectionIndex === -1) {
        // Section not found, just add to end
        setQuestions([...questions, newQuestion]);
        setSelectedQuestionId(newQuestion.id);
        return;
      }
      
      // Find all questions that belong to this section (in order they appear in questions array)
      const sectionQuestions = questions.filter(q => q.sectionId === targetSectionId);
      
      if (sectionQuestions.length > 0) {
        // Section has questions - find the LAST question in this section and add after it (bottom)
        const lastSectionQuestion = sectionQuestions[sectionQuestions.length - 1];
        const lastIndex = questions.findIndex(q => q.id === lastSectionQuestion.id);
        
        // Add the new question right after the last question in this section
        const newQuestions = [...questions];
        newQuestions.splice(lastIndex + 1, 0, newQuestion);
        setQuestions(newQuestions);
      } else {
        // Empty section - find where this section should appear
        // We need to find where all questions for this section should go
        // This is after all questions from previous sections, before questions from next sections
        
        // Start by finding the last question from previous sections
        let insertIndex = -1;
        
        // Find the last question from all previous sections
        for (let i = 0; i < sectionIndex; i++) {
          const prevSection = sections[i];
          const prevSectionQuestions = questions.filter(q => q.sectionId === prevSection.id);
          if (prevSectionQuestions.length > 0) {
            const lastPrevQuestion = prevSectionQuestions[prevSectionQuestions.length - 1];
            const lastPrevIndex = questions.findIndex(q => q.id === lastPrevQuestion.id);
            if (lastPrevIndex !== -1) {
              insertIndex = Math.max(insertIndex, lastPrevIndex);
            }
          }
        }
        
        // If no previous sections have questions, check if there are questions without section
        // and if this is the first section, insert before them
        if (insertIndex === -1 && sectionIndex === 0) {
          const questionsWithoutSection = questions.filter(q => !q.sectionId);
          if (questionsWithoutSection.length > 0) {
            const firstNoSectionIndex = questions.findIndex(q => q.id === questionsWithoutSection[0].id);
            if (firstNoSectionIndex !== -1) {
              insertIndex = firstNoSectionIndex - 1;
            }
          }
        }
        
        // If still no position found, check for next section's first question
        if (insertIndex === -1) {
          for (let i = sectionIndex + 1; i < sections.length; i++) {
            const nextSection = sections[i];
            const nextSectionQuestions = questions.filter(q => q.sectionId === nextSection.id);
            if (nextSectionQuestions.length > 0) {
              const firstNextQuestion = nextSectionQuestions[0];
              const firstNextIndex = questions.findIndex(q => q.id === firstNextQuestion.id);
              if (firstNextIndex !== -1) {
                insertIndex = firstNextIndex - 1;
                break;
              }
            }
          }
        }
        
        // Insert at the calculated position (or at end if no position found)
        const newQuestions = [...questions];
        if (insertIndex === -1) {
          // No position found, add at the end
          newQuestions.push(newQuestion);
        } else {
          // Insert after the last question from previous sections
          newQuestions.splice(insertIndex + 1, 0, newQuestion);
        }
        setQuestions(newQuestions);
      }
      
      if (sections[sectionIndex]) {
        toast({
          title: "Question Added",
          description: `Question added to "${sections[sectionIndex].title}"`,
        });
      }
    } else {
      // No section - add at the END of all questions without sections
      const questionsWithoutSection = questions.filter(q => !q.sectionId);
      if (questionsWithoutSection.length > 0) {
        // Find the last question without section and add after it
        const lastNoSectionQuestion = questionsWithoutSection[questionsWithoutSection.length - 1];
        const lastNoSectionIndex = questions.findIndex(q => q.id === lastNoSectionQuestion.id);
        const newQuestions = [...questions];
        newQuestions.splice(lastNoSectionIndex + 1, 0, newQuestion);
        setQuestions(newQuestions);
      } else {
        // No questions without sections, add to the very end
        setQuestions([...questions, newQuestion]);
      }
    }
    
    setSelectedQuestionId(newQuestion.id);
    
    // Scroll to the new question after a brief delay
    setTimeout(() => {
      const questionElement = document.querySelector(`[data-question-id="${newQuestion.id}"]`);
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const addSection = () => {
    const newSection: Section = {
      id: Date.now().toString(),
      title: "Untitled Section",
      description: "",
    };
    
    // Insert section after current position if question is selected
    let insertIndex = sections.length; // Default: add at end
    
    if (selectedQuestionId) {
      const selectedQuestion = questions.find(q => q.id === selectedQuestionId);
      if (selectedQuestion?.sectionId) {
        // Find the section index and insert after it
        const sectionIndex = sections.findIndex(s => s.id === selectedQuestion.sectionId);
        if (sectionIndex !== -1) {
          insertIndex = sectionIndex + 1;
        }
      }
    }
    
    // Insert the new section at the calculated position
    const newSections = [...sections];
    newSections.splice(insertIndex, 0, newSection);
    setSections(newSections);
    
    // Just create an empty section - don't assign existing questions
    toast({
      title: "Section Added",
      description: "New section created. You can now add questions to this section.",
    });
    
    // Scroll to the new section after a brief delay
    setTimeout(() => {
      const sectionElement = document.querySelector(`[data-section-id="${newSection.id}"]`);
      if (sectionElement) {
        sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const updateSection = (id: string, updated: Partial<Section>) => {
    setSections(
      sections.map((s) => (s.id === id ? { ...s, ...updated } : s)),
    );
  };

  const deleteSection = (id: string) => {
    // Remove section from sections array
    setSections(sections.filter((s) => s.id !== id));
    // Remove sectionId from questions that belonged to this section
    setQuestions(
      questions.map((q) => (q.sectionId === id ? { ...q, sectionId: null } : q)),
    );
  };

  const addTitleAndDescription = () => {
    // Scroll to form header
    const formHeader = document.querySelector('[placeholder="Enter Form Title"]') as HTMLElement;
    if (formHeader) {
      formHeader.focus();
      formHeader.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const updateQuestion = (id: string, updated: Partial<Question>) => {
    // Normalize sectionId to string for consistency
    const normalizedUpdate = { ...updated };
    if ('sectionId' in normalizedUpdate) {
      normalizedUpdate.sectionId = normalizedUpdate.sectionId 
        ? String(normalizedUpdate.sectionId) 
        : null;
    }
    
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...normalizedUpdate } : q)),
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
        email_notifications_enabled: emailNotificationsEnabled,
        email_notification_recipients: emailNotificationRecipients.trim() || undefined,
        send_confirmation_email: sendConfirmationEmail,
        requires_login: requiresLogin,
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
            title: q.title ? q.title.replace(/0+$/, '') : '',
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
            sectionId: q.sectionId || null,
          };
        }),
        sections: (sections && Array.isArray(sections) && sections.length > 0) ? sections.map(s => ({
          id: String(s.id), // Ensure ID is always a string
          title: s.title || 'Untitled Section',
          description: s.description || '',
          conditionalNavigation: s.conditionalNavigation || undefined,
        })) : [], // Always send sections array, even if empty
      };
      
      // Debug: Log what we're saving
      console.log('=== SAVING FORM ===');
      console.log('Current sections state:', sections);
      console.log('Sections being sent:', formData.sections);
      console.log('Questions being sent:', formData.questions.map(q => ({
        title: q.title?.substring(0, 30),
        sectionId: q.sectionId,
        sectionIdType: typeof q.sectionId
      })));

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
      
      // Auto-copy the link to clipboard
      try {
        await navigator.clipboard.writeText(fullShareUrl);
        toast({
          title: "Form Saved!",
          description: `"${formTitle}" has been ${isEditMode ? 'updated' : 'saved'} and link copied to clipboard.`,
        });
      } catch (err) {
        // Fallback if clipboard API fails
        toast({
          title: "Form Saved!",
          description: `"${formTitle}" has been ${isEditMode ? 'updated' : 'saved'}.`,
        });
      }
      
      // Clear draft from localStorage after successful save
      clearDraftFromLocalStorage();
      
      // Trigger a custom event to refresh the forms list
      window.dispatchEvent(new CustomEvent('formCreated'));
      
      // Navigate to home page
      navigate("/");
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
        sections,
        formId: currentFormId, // Preserve formId for navigation back
        editMode: !!currentFormId, // Indicate if we're editing an existing form
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
      <div className="max-w-4xl mx-auto relative">
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
            <TabsContent value="questions" className="mt-6 px-6 pb-8 relative">
              {/* Sidebar Toolbar - Google Forms Style (Fixed - For general use) */}
              <div className="absolute -right-14 top-0 z-50">
                <div className="bg-white rounded-lg shadow-md border border-gray-300 p-1.5 flex flex-col gap-0.5">
                  {/* Add Question (without section) */}
                  <button
                    type="button"
                    onClick={() => addQuestion(null)}
                    className="p-2.5 rounded-md hover:bg-gray-100 transition-colors group relative"
                    title="Add question"
                  >
                    <Plus className="w-5 h-5 text-gray-600 group-hover:text-primary" />
                  </button>
                  
                  {/* Add Section */}
                  <button
                    type="button"
                    onClick={addSection}
                    className="p-2.5 rounded-md hover:bg-gray-100 transition-colors group relative"
                    title="Add section"
                  >
                    <div className="w-5 h-5 flex flex-col justify-center items-center gap-0.5">
                      <div className="w-full h-[2px] bg-gray-600 group-hover:bg-primary rounded transition-colors"></div>
                      <div className="w-full h-[2px] bg-gray-600 group-hover:bg-primary rounded transition-colors"></div>
                    </div>
                  </button>
                  
                  {/* Divider */}
                  <div className="h-px bg-gray-200 my-0.5 mx-1"></div>
                  
                  {/* Add Text */}
                  <button
                    type="button"
                    onClick={addTitleAndDescription}
                    className="p-2.5 rounded-md hover:bg-gray-100 transition-colors group relative"
                    title="Add title and description"
                  >
                    <Type className="w-5 h-5 text-gray-600 group-hover:text-primary" />
                  </button>
                  
                  {/* Placeholder for Image */}
                  <button
                    type="button"
                    disabled
                    className="p-2.5 rounded-md hover:bg-gray-100 transition-colors group relative opacity-50 cursor-not-allowed"
                    title="Add image (coming soon)"
                  >
                    <Image className="w-5 h-5 text-gray-600" />
                  </button>
                  
                  {/* Placeholder for Video */}
                  <button
                    type="button"
                    disabled
                    className="p-2.5 rounded-md hover:bg-gray-100 transition-colors group relative opacity-50 cursor-not-allowed"
                    title="Add video (coming soon)"
                  >
                    <Video className="w-5 h-5 text-gray-600" />
                  </button>
                </div>
              </div>

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

              {/* Questions Section - Grouped by sections */}
              <div className="space-y-8 relative">
                {(() => {
                  // Group questions by section
                  const questionsBySection = new Map<string, Question[]>();
                  const questionsWithoutSection: Question[] = [];
                  
                  // Debug: Log sections and questions
                  console.log('Rendering - Sections:', sections.map(s => ({ id: String(s.id), title: s.title })));
                  console.log('Rendering - Questions with sectionIds:', questions.map(q => ({
                    id: q.id,
                    title: q.title?.substring(0, 30),
                    sectionId: q.sectionId,
                    sectionIdType: typeof q.sectionId
                  })));
                  
                  // Create a set of valid section IDs for quick lookup
                  const validSectionIds = new Set(sections.map(s => String(s.id)));
                  
                  questions.forEach((q) => {
                    if (q.sectionId) {
                      // Normalize sectionId to string for matching
                      const normalizedSectionId = String(q.sectionId);
                      
                      // Verify section exists
                      if (!validSectionIds.has(normalizedSectionId)) {
                        console.warn(`Question "${q.title?.substring(0, 30)}" has sectionId "${normalizedSectionId}" but section doesn't exist. Available sections:`, Array.from(validSectionIds));
                        questionsWithoutSection.push(q);
                        return;
                      }
                      
                      const sectionQuestions = questionsBySection.get(normalizedSectionId) || [];
                      sectionQuestions.push(q);
                      questionsBySection.set(normalizedSectionId, sectionQuestions);
                    } else {
                      questionsWithoutSection.push(q);
                    }
                  });

                  // Sort sections by display order (maintain order they were added)
                  const sortedSections = [...sections];
                  
                  // Ensure all sections have an entry in the map (even if empty)
                  // Normalize section IDs to strings for matching
                  sortedSections.forEach((section) => {
                    const normalizedSectionId = String(section.id);
                    if (!questionsBySection.has(normalizedSectionId)) {
                      questionsBySection.set(normalizedSectionId, []);
                    }
                  });
                  
                  const result: JSX.Element[] = [];
                  let questionIndex = 0;

                  // Render sections with their questions
                  sortedSections.forEach((section) => {
                    // Normalize section ID for matching
                    const normalizedSectionId = String(section.id);
                    const sectionQuestions = questionsBySection.get(normalizedSectionId) || [];
                    
                    // Debug: Log if section has questions
                    if (sectionQuestions.length > 0) {
                      console.log(`Section "${section.title}" has ${sectionQuestions.length} questions`);
                    } else {
                      console.log(`Section "${section.title}" is empty`);
                    }

                    const sectionIndex = sortedSections.findIndex(s => s.id === section.id);
                    const sectionNumber = sectionIndex + 1;
                    const totalSections = sortedSections.length;

                    result.push(
                      <div key={`section-${section.id}`} data-section-id={section.id} className="space-y-4 mb-8">
                        {/* Google Forms Style Section Banner */}
                        <div className="bg-orange-500 text-white px-4 py-2 rounded-t-lg font-medium text-sm">
                          Section {sectionNumber} of {totalSections}
                        </div>
                        
                        {/* Section Header Box */}
                        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-b-lg border-2 border-t-0 border-orange-200 p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <input
                                type="text"
                                value={section.title}
                                onChange={(e) => updateSection(section.id, { title: e.target.value })}
                                className="text-xl font-semibold text-gray-900 bg-transparent border-none outline-none w-full placeholder-gray-400 mb-2"
                                placeholder="Untitled Section"
                                onClick={(e) => e.stopPropagation()}
                              />
                              <textarea
                                value={section.description || ""}
                                onChange={(e) => updateSection(section.id, { description: e.target.value })}
                                className="text-sm text-gray-600 bg-transparent border-none outline-none w-full resize-none placeholder-gray-400"
                                placeholder="Section description (optional)"
                                rows={1}
                                onClick={(e) => e.stopPropagation()}
                              />
                              {sectionQuestions.length === 0 && (
                                <p className="text-xs text-gray-500 mt-2 italic">
                                  This section is empty. Add questions to this section using the "Section" dropdown in each question.
                                </p>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSection(section.id);
                              }}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        
                        {/* Section Navigation Hint (Google Forms Style) */}
                        {sectionIndex < sortedSections.length - 1 && (
                          <div className="text-sm text-gray-600 py-2 px-4 bg-gray-50 rounded border border-gray-200">
                            After section {sectionNumber} <span className="font-medium">Continue to next section</span>
                            <ChevronRight className="w-4 h-4 inline-block ml-1" />
                          </div>
                        )}

                        {/* Section Questions */}
                        {sectionQuestions.map((question) => {
                          const globalIndex = questions.findIndex((q) => q.id === question.id);
                          return (
                  <div
                    key={question.id}
                              data-question-id={question.id}
                    onClick={() => setSelectedQuestionId(question.id)}
                    className={selectedQuestionId === question.id ? "ring-2 ring-blue-500 rounded-lg" : ""}
                  >
                    <QuestionBuilder
                      question={question}
                      allQuestions={questions}
                                sections={sections}
                      isQuizMode={isQuiz}
                      onUpdate={updateQuestion}
                      onDelete={deleteQuestion}
                      onDuplicate={duplicateQuestion}
                      onMove={moveQuestion}
                                canMoveUp={globalIndex > 0}
                                canMoveDown={globalIndex < questions.length - 1}
                      isSelected={selectedQuestionId === question.id}
                                isLastQuestion={globalIndex === questions.length - 1}
                                onAddQuestion={() => addQuestion(section.id)}
                    />
                  </div>
                          );
                        })}
                        
                        {/* Contextual Toolbar - Google Forms Style (Below Section) */}
                        <div className="flex items-center justify-center py-3 gap-2 bg-gray-50 rounded-lg border border-gray-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              addQuestion(section.id);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 shadow-sm hover:shadow"
                            title="Add question to this section"
                          >
                            <Plus className="w-4 h-4" />
                            Add question
                          </button>
                          
                          <div className="h-6 w-px bg-gray-300"></div>
                          
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const currentIndex = sortedSections.findIndex(s => s.id === section.id);
                              const newSection: Section = {
                                id: Date.now().toString(),
                                title: "Untitled Section",
                                description: "",
                              };
                              const newSections = [...sections];
                              newSections.splice(currentIndex + 1, 0, newSection);
                              setSections(newSections);
                              
                              toast({
                                title: "Section Added",
                                description: "New section created after this section.",
                              });
                              
                              setTimeout(() => {
                                const sectionElement = document.querySelector(`[data-section-id="${newSection.id}"]`);
                                if (sectionElement) {
                                  sectionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }
                              }, 100);
                            }}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                            title="Add section after this section"
                          >
                            <div className="w-4 h-4 flex flex-col justify-center items-center gap-0.5">
                              <div className="w-full h-[2px] bg-gray-600 rounded"></div>
                              <div className="w-full h-[2px] bg-gray-600 rounded"></div>
                            </div>
                            Add section
                          </button>
                        </div>
                      </div>
                    );
                  });

                  // Render questions without a section
                  questionsWithoutSection.forEach((question) => {
                    const globalIndex = questions.findIndex((q) => q.id === question.id);
                    result.push(
                            <div
                              key={question.id}
                              data-question-id={question.id}
                              onClick={() => setSelectedQuestionId(question.id)}
                              className={selectedQuestionId === question.id ? "ring-2 ring-blue-500 rounded-lg" : ""}
                            >
                        <QuestionBuilder
                          question={question}
                          allQuestions={questions}
                          sections={sections}
                          isQuizMode={isQuiz}
                          onUpdate={updateQuestion}
                          onDelete={deleteQuestion}
                          onDuplicate={duplicateQuestion}
                          onMove={moveQuestion}
                          canMoveUp={globalIndex > 0}
                          canMoveDown={globalIndex < questions.length - 1}
                          isSelected={selectedQuestionId === question.id}
                          isLastQuestion={globalIndex === questions.length - 1}
                          onAddQuestion={() => addQuestion(null)}
                        />
                      </div>
                    );
                  });

                  // If no questions at all, show empty state
                  if (result.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <FileQuestion className="w-12 h-12 text-gray-400 mb-4" />
                        <p className="text-gray-600 mb-4">No questions yet. Add your first question!</p>
                        <Button onClick={() => addQuestion(null)} variant="outline">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Question
                        </Button>
                      </div>
                    );
                  }

                  return result;
                })()}
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

                {/* Email Notifications Section */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <Label htmlFor="email-notifications" className="block text-sm font-semibold text-gray-700 mb-1">
                        Email Notifications
                      </Label>
                      <p className="text-xs text-gray-500">
                        Receive email notifications when someone submits this form.
                      </p>
                    </div>
                    <Switch
                      id="email-notifications"
                      checked={emailNotificationsEnabled}
                      onCheckedChange={setEmailNotificationsEnabled}
                    />
                  </div>
                  
                  {emailNotificationsEnabled && (
                    <div className="mt-4 space-y-4">
                      <div>
                        <Label htmlFor="email-recipients" className="block text-sm font-medium text-gray-700 mb-2">
                          Notification Recipients
                        </Label>
                        <p className="text-xs text-gray-500 mb-2">
                          Enter email addresses (comma-separated) who should receive notifications when forms are submitted.
                        </p>
                        <Input
                          id="email-recipients"
                          type="text"
                          value={emailNotificationRecipients}
                          onChange={(e) => setEmailNotificationRecipients(e.target.value)}
                          placeholder="email1@example.com, email2@example.com"
                          className="w-full"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex-1">
                          <Label htmlFor="send-confirmation" className="block text-sm font-medium text-gray-700 mb-1">
                            Send Confirmation Email to Submitter
                          </Label>
                          <p className="text-xs text-gray-500">
                            Automatically send a confirmation email to the submitter (requires email field in form).
                          </p>
                        </div>
                        <Switch
                          id="send-confirmation"
                          checked={sendConfirmationEmail}
                          onCheckedChange={setSendConfirmationEmail}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Require Login Section */}
                <div className="px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <Label htmlFor="requires-login" className="block text-sm font-semibold text-gray-700 mb-1">
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
                      onCheckedChange={setRequiresLogin}
                    />
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
