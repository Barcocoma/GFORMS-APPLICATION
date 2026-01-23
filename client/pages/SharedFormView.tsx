import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, Star, Heart, ThumbsUp, BarChart3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ValidationRules {
  minLength?: number;
  maxLength?: number;
  pattern?: 'email' | 'phone' | 'url' | 'number';
  minValue?: number;
  maxValue?: number;
  customPattern?: string;
}

interface ConditionalLogic {
  showIfQuestion?: string;
  showIfAnswer?: string | string[];
  operator?: 'equals' | 'contains' | 'not_equals';
}

interface FormQuestion {
  id: number;
  question_text: string;
  question_type: string;
  options: string[];
  is_required: boolean;
  has_other?: boolean; // Enable "Other" option
  description?: string; // Question description/help text
  validation?: ValidationRules; // Validation rules
  conditional_logic?: ConditionalLogic; // Conditional logic rules
  sectionId?: string | number | null; // Section this question belongs to
}

interface FormSection {
  id: string | number;
  title: string;
  description?: string;
  conditionalNavigation?: {
    questionId?: string;
    answer?: string | string[];
    operator?: 'equals' | 'contains' | 'not_equals';
  };
  display_order?: number;
}

interface SharedForm {
  id: number;
  title: string;
  description: string | null;
  confirmation_message: string | null;
  accepting_responses: boolean;
  response_limit: number | null;
  requires_login?: boolean;
  questions: FormQuestion[];
  sections?: FormSection[];
}

export default function SharedFormView() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { token, isAuthenticated } = useAuth();
  const [form, setForm] = useState<SharedForm | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState<Record<number, string | string[]>>({});
  const [otherAnswers, setOtherAnswers] = useState<Record<number, string>>({}); // Store "Other" text inputs
  const otherInputRefs = useRef<Record<number, HTMLInputElement | null>>({}); // Refs for "Other" inputs to maintain focus
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({}); // Validation errors per question
  const [quizResults, setQuizResults] = useState<{
    total_points: number;
    earned_points: number;
    score_percentage: number;
    question_results: Record<number, {
      is_correct: boolean;
      user_answer: string | string[];
      correct_answer: string | string[];
      points: number;
      earned_points: number;
    }>;
  } | null>(null);
  const [currentSectionIndex, setCurrentSectionIndex] = useState<number>(0); // Current section being displayed
  const [sections, setSections] = useState<FormSection[]>([]); // All sections in the form

  // Helper function to remove trailing "0" from question_text
  const cleanQuestionText = (text: string | undefined | null): string => {
    if (!text || typeof text !== 'string') return '';
    return text.replace(/0+$/, '');
  };

  useEffect(() => {
    if (shareToken) {
      fetchForm();
    }
  }, [shareToken]);

  const fetchForm = async () => {
    try {
      setIsLoading(true);
      
      // Build headers - include token if available
      const headers: HeadersInit = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(`/api/forms/shared/${shareToken}`, {
        headers
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError('Form not found');
        } else if (response.status === 401) {
          // Login required but user not authenticated
          navigate('/login', { state: { from: `/form/${shareToken}` } });
          return;
        } else {
          throw new Error('Failed to load form');
        }
        return;
      }

      const data = await response.json();
      
      // Clean trailing "0" from all question_text - remove ALL trailing zeros IMMEDIATELY
      const cleanedQuestions = (data.questions || []).map((q: FormQuestion) => {
        let text = (q.question_text || '').trim();
        // Remove ALL trailing zeros (keep removing until none left)
        while (text.endsWith('0')) {
          text = text.slice(0, -1).trim();
        }
        return {
          ...q,
          question_text: text
        };
      });
      
      // Set the cleaned form data with cleaned questions
      const cleanedForm = {
        ...data,
        questions: cleanedQuestions
      };
      
      console.log('[FORM LOADED] Questions after cleaning:', cleanedQuestions.map(q => ({
        id: q.id,
        text: q.question_text
      })));
      
      setForm(cleanedForm);
      
      // If form requires login and user is not authenticated, redirect to login
      // Check explicitly: requires_login must be explicitly false (or 0) to allow public access
      const requiresLogin = data.requires_login !== undefined ? (data.requires_login === true || data.requires_login === 1) : true;
      if (requiresLogin && !isAuthenticated && !token) {
        navigate('/login', { state: { from: `/form/${shareToken}` } });
        return;
      }
      
      // Load sections if they exist - ALWAYS check for sections array
      console.log('=== LOADING FORM DATA ===');
      console.log('Raw data.sections:', data.sections);
      console.log('data.sections type:', typeof data.sections);
      console.log('data.sections is array?', Array.isArray(data.sections));
      console.log('data.sections length:', data.sections?.length);
      
      if (data.sections && Array.isArray(data.sections) && data.sections.length > 0) {
        // Normalize section IDs to strings for consistent matching
        const normalizedSections = data.sections.map((s: FormSection) => ({
          ...s,
          id: String(s.id) // Ensure ID is always a string
        }));
        setSections(normalizedSections);
        
        // Check if there are questions without section
        const questionsWithoutSection = (data.questions || []).filter((q: FormQuestion) => !q.sectionId);
        // If there are questions without section, start with index -1 (first page without section)
        // Otherwise, start with first section (index 0)
        setCurrentSectionIndex(questionsWithoutSection.length > 0 ? -1 : 0);
        
        // Debug: Log sections and questions
        console.log('✅ Loaded sections:', normalizedSections);
        console.log('Questions without section:', questionsWithoutSection.length);
        console.log('Questions with sectionIds:', data.questions?.map((q: FormQuestion) => ({
          id: q.id,
          text: q.question_text?.substring(0, 30),
          sectionId: q.sectionId,
          sectionIdType: typeof q.sectionId
        })));
      } else {
        console.log('❌ No sections found - data.sections:', data.sections);
        setSections([]);
        setCurrentSectionIndex(0);
      }
      
      // Initialize otherAnswers from existing answers if any (for edit scenarios)
      // This is mainly for future use if we add edit response feature
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnswerChange = (questionId: number, value: string | string[]) => {
    setAnswers({
      ...answers,
      [questionId]: value
    });
    // Clear validation error when user starts typing
    if (validationErrors[questionId]) {
      setValidationErrors({
        ...validationErrors,
        [questionId]: ''
      });
    }
  };

  // Validation function
  const validateAnswer = (question: FormQuestion, answer: string | string[] | undefined): string | null => {
    if (!answer) {
      if (question.is_required) {
        return 'This field is required';
      }
      return null; // Optional field, no validation needed
    }

    const validation = question.validation;
    if (!validation) return null;

    // Handle array answers (checkbox)
    if (Array.isArray(answer)) {
      // For arrays, validate each item
      for (const item of answer) {
        if (typeof item === 'string' && item.startsWith('__OTHER__:')) {
          const otherText = item.replace('__OTHER__:', '');
          const error = validateTextValue(otherText, validation);
          if (error) return error;
        } else if (typeof item === 'string') {
          const error = validateTextValue(item, validation);
          if (error) return error;
        }
      }
      return null;
    }

    // Handle string answers
    if (typeof answer === 'string') {
      // Check if it's "Other" option
      if (answer.startsWith('__OTHER__:')) {
        const otherText = answer.replace('__OTHER__:', '');
        return validateTextValue(otherText, validation);
      }
      
      // Check if it's a number field
      if (question.question_type === 'number' || question.question_type === 'linear') {
        return validateNumberValue(answer, validation);
      }
      
      // Text field validation
      return validateTextValue(answer, validation);
    }

    return null;
  };

  const validateTextValue = (value: string, validation: ValidationRules): string | null => {
    // Min/Max length
    if (validation.minLength !== undefined && value.length < validation.minLength) {
      return `Minimum length is ${validation.minLength} characters`;
    }
    if (validation.maxLength !== undefined && value.length > validation.maxLength) {
      return `Maximum length is ${validation.maxLength} characters`;
    }

    // Pattern validation
    if (validation.pattern) {
      switch (validation.pattern) {
        case 'email':
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            return 'Please enter a valid email address';
          }
          break;
        case 'phone':
          const phoneRegex = /^[\d\s\-\+\(\)]+$/;
          if (!phoneRegex.test(value) || value.replace(/\D/g, '').length < 10) {
            return 'Please enter a valid phone number';
          }
          break;
        case 'url':
          try {
            new URL(value.startsWith('http') ? value : `https://${value}`);
          } catch {
            return 'Please enter a valid URL';
          }
          break;
        case 'number':
          if (isNaN(Number(value))) {
            return 'Please enter a valid number';
          }
          break;
      }
    }

    return null;
  };

  const validateNumberValue = (value: string, validation: ValidationRules): string | null => {
    const num = Number(value);
    if (isNaN(num)) {
      return 'Please enter a valid number';
    }

    if (validation.minValue !== undefined && num < validation.minValue) {
      return `Minimum value is ${validation.minValue}`;
    }
    if (validation.maxValue !== undefined && num > validation.maxValue) {
      return `Maximum value is ${validation.maxValue}`;
    }

    return null;
  };

  // Evaluate if a question should be shown based on conditional logic
  const shouldShowQuestion = (question: FormQuestion): boolean => {
    if (!question.conditional_logic || !question.conditional_logic.showIfQuestion) {
      return true; // No condition, always show
    }

    // Handle both string and numeric question IDs
    // The triggerQuestionId can be a string (from frontend) or number (from backend)
    let triggerQuestionId: number | string = question.conditional_logic.showIfQuestion;
    
    // If it's a string that looks like a number, convert it
    if (typeof triggerQuestionId === 'string' && /^\d+$/.test(triggerQuestionId)) {
      triggerQuestionId = parseInt(triggerQuestionId, 10);
    }
    
    // Try to find the trigger question by matching ID (either string or number)
    const triggerQuestion = form?.questions.find(q => 
      q.id === triggerQuestionId || 
      q.id.toString() === triggerQuestionId.toString() ||
      triggerQuestionId.toString() === q.id.toString()
    );
    
    if (!triggerQuestion) {
      return false; // Trigger question not found, hide this question
    }
    
    const triggerAnswer = answers[triggerQuestion.id];
    
    if (!triggerAnswer) {
      return false; // Trigger question not answered, hide this question
    }

    const expectedAnswer = question.conditional_logic.showIfAnswer;
    const operator = question.conditional_logic.operator || 'equals';

    // Handle array answers (checkbox)
    if (Array.isArray(triggerAnswer)) {
      if (Array.isArray(expectedAnswer)) {
        // Check if any of the expected answers are in the trigger answer
        return expectedAnswer.some(expected => triggerAnswer.includes(expected));
      } else {
        return triggerAnswer.includes(expectedAnswer as string);
      }
    }

    // Handle string answers
    const triggerAnswerStr = triggerAnswer.toString();
    const expectedAnswerStr = expectedAnswer?.toString() || '';

    // Handle "Other" option
    if (triggerAnswerStr.startsWith('__OTHER__:')) {
      const otherText = triggerAnswerStr.replace('__OTHER__:', '');
      switch (operator) {
        case 'equals':
          return otherText === expectedAnswerStr;
        case 'contains':
          return otherText.toLowerCase().includes(expectedAnswerStr.toLowerCase());
        case 'not_equals':
          return otherText !== expectedAnswerStr;
        default:
          return otherText === expectedAnswerStr;
      }
    }

    // Regular comparison
    switch (operator) {
      case 'equals':
        return triggerAnswerStr === expectedAnswerStr;
      case 'contains':
        return triggerAnswerStr.toLowerCase().includes(expectedAnswerStr.toLowerCase());
      case 'not_equals':
        return triggerAnswerStr !== expectedAnswerStr;
      default:
        return triggerAnswerStr === expectedAnswerStr;
    }
  };

  // Get visible questions based on conditional logic
  // Group questions by sections
  const getQuestionsBySection = () => {
    if (!form) return { bySection: new Map(), withoutSection: [] };
    
    const bySection = new Map<string | number, FormQuestion[]>();
    const withoutSection: FormQuestion[] = [];
    
    form.questions.forEach((q) => {
      if (shouldShowQuestion(q)) {
        if (q.sectionId) {
          // Normalize sectionId to string for consistent key matching
          const normalizedSectionId = String(q.sectionId);
          const sectionQuestions = bySection.get(normalizedSectionId) || [];
          sectionQuestions.push(q);
          bySection.set(normalizedSectionId, sectionQuestions);
        } else {
          withoutSection.push(q);
        }
      }
    });
    
    return { bySection, withoutSection };
  };
  
  // Get questions without section
  const getQuestionsWithoutSection = () => {
    if (!form) return [];
    return form.questions.filter(q => shouldShowQuestion(q) && !q.sectionId);
  };

  // Get questions for current section
  const getCurrentSectionQuestions = () => {
    if (!form) return [];
    
    const questionsWithoutSection = getQuestionsWithoutSection();
    const hasQuestionsWithoutSection = questionsWithoutSection.length > 0;
    
    console.log('getCurrentSectionQuestions - sections.length:', sections.length);
    console.log('getCurrentSectionQuestions - currentSectionIndex:', currentSectionIndex);
    console.log('getCurrentSectionQuestions - hasQuestionsWithoutSection:', hasQuestionsWithoutSection);
    console.log('getCurrentSectionQuestions - form.questions:', form.questions.map(q => ({
      id: q.id,
      text: cleanQuestionText(q.question_text)?.substring(0, 30),
      sectionId: q.sectionId
    })));
    
    // If no sections, show all questions (with cleaned question_text)
    if (sections.length === 0) {
      console.log('No sections - showing all questions');
      return form.questions.filter(q => shouldShowQuestion(q)).map(q => ({
        ...q,
        question_text: cleanQuestionText(q.question_text)
      }));
    }
    
    // If currentSectionIndex is -1, show questions without section
    if (currentSectionIndex === -1) {
      console.log('Showing questions without section');
      return questionsWithoutSection.map(q => ({
        ...q,
        question_text: cleanQuestionText(q.question_text)
      }));
    }
    
    // Sections exist - show questions from current section
    const sectionIndex = hasQuestionsWithoutSection ? currentSectionIndex : currentSectionIndex;
    const currentSection = sections[sectionIndex];
    if (!currentSection) {
      console.log('No current section at index', sectionIndex);
      return [];
    }
    
    console.log('=== GET CURRENT SECTION QUESTIONS ===');
    console.log('Current section index:', sectionIndex);
    console.log('Total sections:', sections.length);
    console.log('Current section:', { id: currentSection.id, title: currentSection.title });
    console.log('All sections:', sections.map((s, idx) => ({ index: idx, id: s.id, title: s.title })));
    
    // Normalize section ID to string for consistent comparison
    const currentSectionId = String(currentSection.id);
    
    // Filter questions that belong to current section only and clean question_text
    const sectionQuestions = form.questions.filter(q => {
      if (!shouldShowQuestion(q)) {
        console.log(`Question "${cleanQuestionText(q.question_text)?.substring(0, 30)}" filtered out by shouldShowQuestion`);
        return false;
      }
      
      // Exclude questions without section when showing a section
      if (!q.sectionId) {
        console.log(`Question "${cleanQuestionText(q.question_text)?.substring(0, 30)}" has no sectionId - excluding`);
        return false;
      }
      
      // Normalize and compare section IDs
      const qSectionId = String(q.sectionId);
      const matches = qSectionId === currentSectionId;
      const cleanedText = cleanQuestionText(q.question_text);
      console.log(`Question "${cleanedText?.substring(0, 30)}" (ID: ${q.id}) sectionId: ${qSectionId}, currentSectionId: ${currentSectionId}, matches: ${matches}`);
      return matches;
    }).map(q => {
      const cleaned = cleanQuestionText(q.question_text);
      console.log(`[GET QUESTIONS] Cleaning question ${q.id}: "${q.question_text}" -> "${cleaned}"`);
      return {
        ...q,
        question_text: cleaned
      };
    });
    
    console.log(`Found ${sectionQuestions.length} questions for current section (index ${sectionIndex})`);
    console.log('Questions in this section:', sectionQuestions.map(q => ({ id: q.id, text: q.question_text?.substring(0, 30) })));
    return sectionQuestions;
  };
  
  const visibleQuestions = getCurrentSectionQuestions();
  
  // Get total number of pages (including questions without section)
  const getTotalPages = () => {
    if (sections.length === 0) return 1;
    const questionsWithoutSection = getQuestionsWithoutSection();
    return questionsWithoutSection.length > 0 ? sections.length + 1 : sections.length;
  };

  // Navigation functions
  const goToNextSection = (e?: React.MouseEvent) => {
    // CRITICAL: Prevent form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    const questionsWithoutSection = getQuestionsWithoutSection();
    const hasQuestionsWithoutSection = questionsWithoutSection.length > 0;
    const totalPages = getTotalPages();
    const maxIndex = sections.length - 1;
    
    // Calculate next index
    let nextIndex = currentSectionIndex + 1;
    
    // If currently on -1 (questions without section), go to 0 (first section)
    if (currentSectionIndex === -1) {
      nextIndex = 0;
    }
    
    // Check if we can go to next page
    if (currentSectionIndex === -1 && hasQuestionsWithoutSection) {
      // From questions without section, go to first section (index 0)
      nextIndex = 0;
    } else if (currentSectionIndex >= 0 && currentSectionIndex < maxIndex) {
      // Within sections, go to next section
      nextIndex = currentSectionIndex + 1;
    } else {
      // Already on last page
      console.log('❌ Cannot go to next section: Already on last page');
      return;
    }
    
    console.log('=== GOING TO NEXT SECTION ===');
    console.log('Current section:', currentSectionIndex);
    console.log('Next section:', nextIndex);
    console.log('Total pages:', totalPages);
    
    // Validate current section before allowing navigation
    const errors: Record<number, string> = {};
    let hasErrors = false;
    
    // Check all required questions in current section
    for (const question of visibleQuestions) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          errors[question.id] = 'This field is required';
          hasErrors = true;
        } else if (question.has_other) {
          // Validate "Other" option
          if (typeof answer === 'string' && answer === '__OTHER__') {
            errors[question.id] = 'Please specify your answer';
            hasErrors = true;
          } else if (Array.isArray(answer) && answer.some(a => typeof a === 'string' && a.startsWith('__OTHER__') && a === '__OTHER__')) {
            errors[question.id] = 'Please specify your answer';
            hasErrors = true;
          }
        }
        
        // Validate answer against validation rules
        const validationError = validateAnswer(question, answer);
        if (validationError) {
          errors[question.id] = validationError;
          hasErrors = true;
        }
      }
    }
    
    if (hasErrors) {
      setValidationErrors(errors);
      toast({
        title: "Please complete this section",
        description: "Answer all required questions before proceeding to the next section.",
        variant: "destructive",
      });
      return;
    }
    
    // Clear validation errors for current section
    const currentSectionQuestionIds = visibleQuestions.map(q => q.id);
    setValidationErrors(prev => {
      const updated = { ...prev };
      currentSectionQuestionIds.forEach(id => {
        delete updated[id];
      });
      return updated;
    });
    
    console.log('✅ Navigating to next section');
    setCurrentSectionIndex(nextIndex);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const goToPreviousSection = () => {
    if (currentSectionIndex === -1) {
      // Already on first page (questions without section)
      return;
    }
    
    if (currentSectionIndex === 0) {
      // On first section, check if we should go back to questions without section
      const questionsWithoutSection = getQuestionsWithoutSection();
      if (questionsWithoutSection.length > 0) {
        setCurrentSectionIndex(-1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }
    
    if (currentSectionIndex > 0) {
      setCurrentSectionIndex(currentSectionIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  
  // Check if current section is complete (all required questions answered)
  const isCurrentSectionComplete = () => {
    if (sections.length === 0) return true;
    
    for (const question of visibleQuestions) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          return false;
        }
        // Check "Other" option
        if (question.has_other) {
          if (typeof answer === 'string' && answer === '__OTHER__') {
            return false;
          }
          if (Array.isArray(answer) && answer.some(a => typeof a === 'string' && a.startsWith('__OTHER__') && a === '__OTHER__')) {
            return false;
          }
        }
        // Validate answer
        const validationError = validateAnswer(question, answer);
        if (validationError) {
          return false;
        }
      }
    }
    return true;
  };
  
  // Check if ALL questions from ALL sections are answered (for submit button)
  const areAllQuestionsAnswered = () => {
    if (!form) {
      console.log('areAllQuestionsAnswered: No form');
      return false;
    }
    
    const allQuestionsToCheck = form.questions.filter(q => shouldShowQuestion(q));
    console.log('areAllQuestionsAnswered: Checking', allQuestionsToCheck.length, 'questions');
    
    const unansweredRequired: string[] = [];
    
    for (const question of allQuestionsToCheck) {
      if (question.is_required) {
        const answer = answers[question.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          unansweredRequired.push(`Q${question.id}: ${question.question_text?.substring(0, 30)}`);
          console.log(`  ❌ Required question "${question.question_text?.substring(0, 30)}" (ID: ${question.id}) not answered. Answer:`, answer);
          continue;
        }
        // Check "Other" option
        if (question.has_other) {
          if (typeof answer === 'string' && answer === '__OTHER__') {
            unansweredRequired.push(`Q${question.id}: ${question.question_text?.substring(0, 30)} (Other not specified)`);
            console.log(`  ❌ Required question "${question.question_text?.substring(0, 30)}" has "Other" selected but no text provided`);
            continue;
          }
          if (Array.isArray(answer) && answer.some(a => typeof a === 'string' && a.startsWith('__OTHER__') && a === '__OTHER__')) {
            unansweredRequired.push(`Q${question.id}: ${question.question_text?.substring(0, 30)} (Other not specified)`);
            console.log(`  ❌ Required question "${question.question_text?.substring(0, 30)}" has "Other" selected but no text provided`);
            continue;
          }
        }
        // Validate answer
        const validationError = validateAnswer(question, answer);
        if (validationError) {
          unansweredRequired.push(`Q${question.id}: ${question.question_text?.substring(0, 30)} (${validationError})`);
          console.log(`  ❌ Required question "${question.question_text?.substring(0, 30)}" has validation error:`, validationError);
          continue;
        }
        console.log(`  ✅ Required question "${question.question_text?.substring(0, 30)}" answered`);
      }
    }
    
    if (unansweredRequired.length > 0) {
      console.log('areAllQuestionsAnswered: FALSE - Unanswered required questions:', unansweredRequired);
      return false;
    }
    
    console.log('areAllQuestionsAnswered: TRUE - All required questions answered');
    return true;
  };
  
  // CRITICAL: Only show "Next" button if NOT on last section
  // Only show "Submit" button if ON last section
  // Calculate navigation state
  const questionsWithoutSection = getQuestionsWithoutSection();
  const hasQuestionsWithoutSection = questionsWithoutSection.length > 0;
  const totalPages = getTotalPages();
  
  // isLastSection: true if we're on the last page (last section index)
  const isLastSection = sections.length > 0 && (
    (hasQuestionsWithoutSection && currentSectionIndex === sections.length - 1) ||
    (!hasQuestionsWithoutSection && currentSectionIndex === sections.length - 1)
  );
  
  // canGoNext: true if there's a next page and current page is complete
  const canGoNext = (() => {
    if (sections.length === 0) return false; // No sections, single page
    if (!isCurrentSectionComplete()) return false; // Current page not complete
    
    if (currentSectionIndex === -1) {
      // On questions without section, can go to first section (index 0)
      return hasQuestionsWithoutSection && sections.length > 0;
    }
    
    // On a section, can go to next section if not last
    return currentSectionIndex < sections.length - 1;
  })();
  
  // canGoPrevious: true if there's a previous page
  const canGoPrevious = (() => {
    if (currentSectionIndex === -1) return false; // Already on first page
    if (currentSectionIndex === 0) {
      // On first section, can go back to questions without section if they exist
      return hasQuestionsWithoutSection;
    }
    return true; // Can go to previous section
  })();
  
  // Debug: Log navigation state
  console.log('=== NAVIGATION STATE ===');
  console.log('sections.length:', sections.length);
  console.log('sections:', sections.map(s => ({ id: s.id, title: s.title })));
  console.log('currentSectionIndex:', currentSectionIndex);
  console.log('isLastSection:', isLastSection);
  console.log('canGoNext:', canGoNext);
  console.log('canGoPrevious:', canGoPrevious);
  console.log('visibleQuestions.length:', visibleQuestions.length);
  console.log('isCurrentSectionComplete:', isCurrentSectionComplete());
  console.log('areAllQuestionsAnswered:', areAllQuestionsAnswered());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!form) return;

    // CRITICAL: Only allow submission if we're on the last section
    if (sections.length > 0 && !isLastSection) {
      console.log('❌ Form submission blocked: Not on last section. Current:', currentSectionIndex, 'Last:', sections.length - 1);
      toast({
        title: "Cannot Submit",
        description: "Please complete all sections before submitting.",
        variant: "destructive",
      });
      return;
    }

    // Clear previous validation errors
    setValidationErrors({});

    // CRITICAL: Validate ALL questions from ALL sections, not just visible ones
    // Get all questions that should be shown (considering conditional logic)
    const allQuestionsToValidate = form.questions.filter(q => shouldShowQuestion(q));
    
    console.log('=== SUBMITTING FORM ===');
    console.log('Total questions to validate:', allQuestionsToValidate.length);
    console.log('Current visibleQuestions:', visibleQuestions.length);
    console.log('Answers provided:', Object.keys(answers).length);
    
    const errors: Record<number, string> = {};
    let hasErrors = false;

    // Validate ALL questions from ALL sections
    for (const question of allQuestionsToValidate) {
      const answer = answers[question.id];
      
      // Check required fields
      if (question.is_required) {
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          errors[question.id] = 'This field is required';
          hasErrors = true;
          console.log(`  ❌ Question "${question.question_text?.substring(0, 30)}" is required but not answered`);
          continue;
        }
        // Validate "Other" option - if "Other" is selected, text must be provided
        if (question.has_other) {
          if (typeof answer === 'string' && answer === '__OTHER__') {
            errors[question.id] = 'Please specify your answer';
            hasErrors = true;
            continue;
          }
          if (Array.isArray(answer) && answer.some(a => typeof a === 'string' && a.startsWith('__OTHER__') && a === '__OTHER__')) {
            errors[question.id] = 'Please specify your answer';
            hasErrors = true;
            continue;
          }
        }
      }

      // Validate answer against validation rules
      const validationError = validateAnswer(question, answer);
      if (validationError) {
        errors[question.id] = validationError;
        hasErrors = true;
      }
    }
    
    console.log(`Validation complete: ${hasErrors ? 'HAS ERRORS' : 'NO ERRORS'}, errors:`, errors);

    if (hasErrors) {
      setValidationErrors(errors);
      
      // If errors are in a different section, navigate to that section
      const errorQuestionIds = Object.keys(errors).map(id => parseInt(id));
      if (sections.length > 0) {
        // Find which section contains the first error
        for (const errorQuestionId of errorQuestionIds) {
          const errorQuestion = form.questions.find(q => q.id === errorQuestionId);
          if (errorQuestion && errorQuestion.sectionId) {
            const errorSectionIndex = sections.findIndex(s => String(s.id) === String(errorQuestion.sectionId));
            if (errorSectionIndex !== -1 && errorSectionIndex !== currentSectionIndex) {
              setCurrentSectionIndex(errorSectionIndex);
              window.scrollTo({ top: 0, behavior: 'smooth' });
              toast({
                title: "Validation Error",
                description: `Please answer all required questions. Navigated to section ${errorSectionIndex + 1}.`,
                variant: "destructive",
              });
              return;
            }
          }
        }
      }
      
      toast({
        title: "Validation Error",
        description: "Please answer all required questions before submitting",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Build headers - include token if available and form requires login
      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      };
      if (form?.requires_login !== false && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/forms/shared/${shareToken}/submit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ answers }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Error",
            description: "Please log in to submit the form",
            variant: "destructive",
          });
          navigate('/login', { state: { from: `/form/${shareToken}` } });
          return;
        }
        throw new Error('Failed to submit form');
      }

      const data = await response.json();
      
      // Check if quiz results are included
      if (data.quiz_results) {
        setQuizResults(data.quiz_results);
      }

      setIsSubmitted(true);
      toast({
        title: "Success",
        description: data.quiz_results 
          ? `You scored ${data.quiz_results.earned_points}/${data.quiz_results.total_points} (${data.quiz_results.score_percentage}%)`
          : "Your response has been submitted successfully!",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to submit form',
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Form Not Found</CardTitle>
            <CardDescription>The form you're looking for doesn't exist or has been removed.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/')} className="w-full">
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if form is accepting responses
  if (!form.accepting_responses) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 via-white to-gray-50 px-4">
        <Card className="w-full max-w-md border-0 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-50 border-b pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-gray-400 to-gray-500 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">🔒</span>
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              Form Closed
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-8 pb-8">
            <div className="text-center space-y-4">
              <p className="text-gray-600 text-lg">
                This form is no longer accepting responses.
              </p>
              <p className="text-gray-500 text-sm">
                The form owner has closed this form to new submissions.
              </p>
              <Button onClick={() => navigate('/')} className="mt-6">
                Go to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Orange bar */}
          <div className="h-2 bg-orange-500 rounded-t-lg"></div>
          
          {/* White card */}
          <Card className="border border-gray-200 rounded-b-lg shadow-sm">
            <CardContent className="pt-12 pb-12 px-8">
              <div className="text-center space-y-6">
                {/* Form Title */}
                <h1 className="text-3xl font-normal text-gray-900" style={{ fontFamily: 'Google Sans, Roboto, sans-serif' }}>
                  {form.title}
                </h1>
                
                {/* Quiz Results */}
                {quizResults && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600 mb-2">
                        {quizResults.score_percentage}%
                      </div>
                      <div className="text-lg text-gray-700 font-medium">
                        Score: {quizResults.earned_points} / {quizResults.total_points} points
                      </div>
                    </div>
                    
                    {/* Question Results */}
                    <div className="mt-6 space-y-4 max-h-96 overflow-y-auto">
                      {form.questions.map((question) => {
                        const result = quizResults.question_results[question.id];
                        if (!result) return null;
                        
                        const getAnswerDisplay = (answer: string | string[]) => {
                          if (Array.isArray(answer)) {
                            return answer.length > 0 ? answer.join(', ') : '(No answer)';
                          }
                          return answer || '(No answer)';
                        };
                        
                        return (
                          <div
                            key={question.id}
                            className={`p-4 rounded-lg border-2 ${
                              result.is_correct
                                ? 'bg-green-50 border-green-200'
                                : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="font-medium text-gray-900 flex-1">
                                {question.question_text || ''}
                              </div>
                              <div className={`ml-3 font-bold ${
                                result.is_correct ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {result.is_correct ? '✓' : '✗'} {result.earned_points}/{result.points} pts
                              </div>
                            </div>
                            <div className="space-y-1.5 text-sm">
                              <div>
                                <span className="font-medium text-gray-600">Your answer: </span>
                                <span className="text-gray-800">{getAnswerDisplay(result.user_answer)}</span>
                              </div>
                              {!result.is_correct && (
                                <div>
                                  <span className="font-medium text-green-700">Correct answer: </span>
                                  <span className="text-green-800">{getAnswerDisplay(result.correct_answer)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Confirmation Message */}
                {!quizResults && (
                <p className="text-lg text-gray-700 whitespace-pre-line">
                  {form.confirmation_message || "Your response has been recorded."}
                </p>
                )}
                
                {/* Submit Another Response Link */}
                <div className="pt-4">
                  <Button
                    variant="link"
                    onClick={() => {
                      setAnswers({});
                      setIsSubmitted(false);
                      setQuizResults(null);
                      window.scrollTo(0, 0);
                    }}
                    className="text-blue-600 hover:text-blue-700 underline p-0 h-auto font-normal"
                  >
                    Submit another response
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Footer text */}
          <div className="text-center mt-6 space-y-2">
            <p className="text-xs text-gray-500">
              This content is neither created nor endorsed by GleentForm.
            </p>
            <p className="text-xs text-gray-500">
              GleentForm
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <Card className="border-0 shadow-2xl">
          <CardHeader className="bg-gradient-to-r from-primary/10 to-primary/5 border-b pb-6">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg">
                <span className="text-3xl">📋</span>
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
              {form.title}
            </CardTitle>
            {form.description && (
              <CardDescription className="text-center text-lg mt-3">{form.description}</CardDescription>
            )}
            
            {/* Progress Bar */}
            {visibleQuestions.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium text-gray-600 mb-2">
                  <span className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4" />
                    Progress
                  </span>
                  <span className="text-primary font-semibold">
                    {visibleQuestions.filter((q) => {
                      const answer = answers[q.id];
                      // Only count as answered if there's an actual answer
                      if (Array.isArray(answer)) {
                        return answer.length > 0;
                      }
                      if (answer) {
                        const answerStr = answer.toString().trim();
                        // Check if it's "Other" option without text
                        if (answerStr === '__OTHER__') {
                          return false; // "Other" selected but no text provided
                        }
                        if (answerStr.startsWith('__OTHER__:')) {
                          const otherText = answerStr.replace('__OTHER__:', '').trim();
                          return otherText.length > 0; // "Other" with text counts as answered
                        }
                        return answerStr.length > 0; // Non-empty answer
                      }
                      return false; // No answer provided
                    }).length} of {visibleQuestions.length} questions
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-500 ease-out shadow-sm"
                    style={{
                      width: `${Math.min(100, (visibleQuestions.filter((q) => {
                        const answer = answers[q.id];
                        // Only count as answered if there's an actual answer
                        if (Array.isArray(answer)) {
                          return answer.length > 0;
                        }
                        if (answer) {
                          const answerStr = answer.toString().trim();
                          // Check if it's "Other" option without text
                          if (answerStr === '__OTHER__') {
                            return false; // "Other" selected but no text provided
                          }
                          if (answerStr.startsWith('__OTHER__:')) {
                            const otherText = answerStr.replace('__OTHER__:', '').trim();
                            return otherText.length > 0; // "Other" with text counts as answered
                          }
                          return answerStr.length > 0; // Non-empty answer
                        }
                        return false; // No answer provided
                      }).length / visibleQuestions.length) * 100)}%`
                    }}
                  />
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="pt-8">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section Header - Google Forms Style */}
              {/* Only show section header if we're on a section (not on questions without section) */}
              {sections.length > 0 && currentSectionIndex >= 0 && sections[currentSectionIndex] && (
                <>
                  {/* Orange Banner */}
                  <div className="bg-orange-500 text-white px-4 py-2 rounded-t-lg font-medium text-sm mb-0">
                    Section {currentSectionIndex + 1} of {sections.length}
                  </div>
                  
                  {/* Section Content Box */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-b-lg border-2 border-t-0 border-orange-200 p-6 mb-6 shadow-sm">
                    <div className="text-center space-y-2">
                      <h2 className="text-2xl font-semibold text-gray-900">
                        {sections[currentSectionIndex].title}
                      </h2>
                      {sections[currentSectionIndex].description && (
                        <p className="text-sm text-gray-600">
                          {sections[currentSectionIndex].description}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
              
              {/* Show message if section has no questions */}
              {sections.length > 0 && visibleQuestions.length === 0 && (
                <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <p className="font-semibold text-lg mb-2">This section has no questions yet.</p>
                  <p className="text-sm">Section: {sections[currentSectionIndex]?.title || `Section ${currentSectionIndex + 1}`}</p>
                  <p className="text-xs mt-2 text-gray-400">
                    Debug: Section ID: {sections[currentSectionIndex]?.id}, 
                    Total questions in form: {form?.questions.length || 0},
                    Questions with this sectionId: {form?.questions.filter(q => String(q.sectionId) === String(sections[currentSectionIndex]?.id)).length || 0}
                  </p>
                </div>
              )}
              
              {visibleQuestions.map((question, index) => {
                const totalQuestions = visibleQuestions.length;
                const currentQuestion = index + 1;
                
                return (
                <div key={question.id} className="space-y-3 p-6 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="space-y-1 flex-1">
                      <Label htmlFor={`q${question.id}`} className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-primary font-bold">Q{currentQuestion}:</span>
                        {question.question_text ? question.question_text.replace(/0+$/, '') : ''}
                        {question.is_required && <span className="text-red-500 ml-1 font-bold">*</span>}
                      </Label>
                      {question.description && (
                        <p className="text-sm text-gray-500 ml-8 italic">{question.description}</p>
                      )}
                      {validationErrors[question.id] && (
                        <p className="text-sm text-red-600 ml-8 mt-1 font-medium">{validationErrors[question.id]}</p>
                      )}
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full ml-4 shrink-0">
                      {currentQuestion} of {totalQuestions}
                    </span>
                  </div>

                  {/* Plain text */}
                  {question.question_type === 'text' && !(
                    question.options && question.options[0] === '__TIME__'
                  ) && (
                    <Input
                      id={`q${question.id}`}
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                    />
                  )}

                  {/* Time question stored as text with special marker */}
                  {question.question_type === 'text' && question.options && question.options[0] === '__TIME__' && (
                    <Input
                      id={`q${question.id}`}
                      type="time"
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                    />
                  )}

                  {question.question_type === 'textarea' && (
                    <Textarea
                      id={`q${question.id}`}
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                      rows={4}
                      className={validationErrors[question.id] ? 'border-red-500 focus:border-red-500' : ''}
                    />
                  )}

                  {question.question_type === 'email' && (
                    <Input
                      id={`q${question.id}`}
                      type="email"
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                    />
                  )}

                  {/* Number input (plain) */}
                  {question.question_type === 'number' && !(
                    question.options &&
                    ['star', 'heart', 'like'].includes(question.options[0])
                  ) && (
                    <Input
                      id={`q${question.id}`}
                      type="number"
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                    />
                  )}

                  {/* Rating rendered for special "number" questions with options[0] marker */}
                  {question.question_type === 'number' && question.options && ['star', 'heart', 'like'].includes(question.options[0]) && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-1">
                        {Array.from({
                          length: parseInt(question.options?.[1] || "5", 10) || 5,
                        }).map((_, idx) => {
                          const num = idx + 1;
                          const ratingIcon = question.options?.[0] || "star";
                          const isSelected = Number(answers[question.id] || 0) >= num;
                          
                          return (
                            <div key={num} className="flex flex-col items-center gap-1">
                              <span className="text-sm text-gray-600">{num}</span>
                              <button
                                type="button"
                                onClick={() => handleAnswerChange(question.id, String(num))}
                                className="transition-transform hover:scale-110 focus:outline-none"
                              >
                                {ratingIcon === "heart" ? (
                                  <Heart
                                    className={`w-8 h-8 ${
                                      isSelected
                                        ? "fill-red-500 text-red-500"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ) : ratingIcon === "like" ? (
                                  <ThumbsUp
                                    className={`w-8 h-8 ${
                                      isSelected
                                        ? "fill-blue-500 text-blue-500"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ) : (
                                  <Star
                                    className={`w-8 h-8 ${
                                      isSelected
                                        ? "fill-yellow-400 text-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                  />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {question.question_type === 'date' && (
                    <Input
                      id={`q${question.id}`}
                      type="date"
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                    />
                  )}

                  {question.question_type === 'radio' && question.options && (
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <label key={optIndex} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="radio"
                            name={`q${question.id}`}
                            value={option}
                            checked={(answers[question.id] as string) === option}
                            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                            required={question.is_required}
                            className="w-4 h-4"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                      {/* "Other" option for radio */}
                      {question.has_other && (
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="radio"
                              name={`q${question.id}`}
                              value="__OTHER__"
                              checked={typeof answers[question.id] === 'string' && (answers[question.id] as string).startsWith('__OTHER__')}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const currentText = otherAnswers[question.id] || '';
                                  handleAnswerChange(question.id, currentText ? `__OTHER__:${currentText}` : "__OTHER__");
                                } else {
                                  handleAnswerChange(question.id, "");
                                  setOtherAnswers({ ...otherAnswers, [question.id]: '' });
                                }
                              }}
                              required={question.is_required && !answers[question.id]}
                              className="w-4 h-4"
                            />
                            <span>Other:</span>
                          </label>
                          {typeof answers[question.id] === 'string' && (answers[question.id] as string).startsWith('__OTHER__') && (
                            <Input
                              type="text"
                              ref={(el) => {
                                otherInputRefs.current[question.id] = el;
                              }}
                              value={otherAnswers[question.id] || ''}
                              onChange={(e) => {
                                const textValue = e.target.value;
                                // Update otherAnswers state
                                setOtherAnswers(prev => ({ ...prev, [question.id]: textValue }));
                                // Update the answer with "Other: [text]" format
                                handleAnswerChange(question.id, textValue ? `__OTHER__:${textValue}` : "__OTHER__");
                              }}
                              onFocus={(e) => {
                                // Ensure "Other" is selected when focusing on input
                                const currentAnswer = answers[question.id];
                                if (!(typeof currentAnswer === 'string' && currentAnswer.startsWith('__OTHER__'))) {
                                  handleAnswerChange(question.id, "__OTHER__");
                                }
                              }}
                              placeholder="Please specify"
                              className="ml-6"
                              required={question.is_required}
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {question.question_type === 'checkbox' && question.options && (
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <label key={optIndex} className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            value={option}
                            checked={((answers[question.id] as string[]) || []).includes(option)}
                            onChange={(e) => {
                              const current = (answers[question.id] as string[]) || [];
                              const updated = e.target.checked
                                ? [...current, option]
                                : current.filter(v => v !== option);
                              handleAnswerChange(question.id, updated);
                            }}
                            className="w-4 h-4"
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                      {/* "Other" option for checkbox */}
                      {question.has_other && (
                        <div className="space-y-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={((answers[question.id] as string[]) || []).some(v => v.startsWith("__OTHER__"))}
                              onChange={(e) => {
                                const current = (answers[question.id] as string[]) || [];
                                if (e.target.checked) {
                                  // Add "Other" option
                                  handleAnswerChange(question.id, [...current, "__OTHER__"]);
                                } else {
                                  // Remove "Other" option and its text
                                  const filtered = current.filter(v => !v.startsWith("__OTHER__"));
                                  handleAnswerChange(question.id, filtered);
                                  setOtherAnswers({ ...otherAnswers, [question.id]: '' });
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span>Other:</span>
                          </label>
                          {((answers[question.id] as string[]) || []).some(v => typeof v === 'string' && v.startsWith("__OTHER__")) && (
                            <Input
                              type="text"
                              ref={(el) => {
                                otherInputRefs.current[question.id] = el;
                              }}
                              value={otherAnswers[question.id] || ''}
                              onChange={(e) => {
                                const textValue = e.target.value;
                                const current = (answers[question.id] as string[]) || [];
                                const otherIndex = current.findIndex(v => typeof v === 'string' && v.startsWith("__OTHER__"));
                                const updated = [...current];
                                
                                // Update otherAnswers first
                                setOtherAnswers(prev => ({ ...prev, [question.id]: textValue }));
                                
                                // Then update the answer array
                                if (otherIndex >= 0) {
                                  updated[otherIndex] = textValue ? `__OTHER__:${textValue}` : "__OTHER__";
                                } else {
                                  updated.push(textValue ? `__OTHER__:${textValue}` : "__OTHER__");
                                }
                                handleAnswerChange(question.id, updated);
                              }}
                              onFocus={(e) => {
                                // Ensure "Other" checkbox is checked when focusing on input
                                const current = (answers[question.id] as string[]) || [];
                                if (!current.some(v => typeof v === 'string' && v.startsWith("__OTHER__"))) {
                                  handleAnswerChange(question.id, [...current, "__OTHER__"]);
                                }
                              }}
                              placeholder="Please specify"
                              className="ml-6"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {question.question_type === 'select' && question.options && (
                    <select
                      id={`q${question.id}`}
                      value={(answers[question.id] as string) || ''}
                      onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                      required={question.is_required}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select an option</option>
                      {question.options.map((option, optIndex) => (
                        <option key={optIndex} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              );
              })}

              {/* Navigation Buttons - Only show if sections exist */}
              {sections.length > 0 ? (
                <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                  {canGoPrevious ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={goToPreviousSection}
                      className="gap-2"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                  ) : (
                    <div></div>
                  )}
                  
                  {canGoNext ? (
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        goToNextSection(e);
                      }}
                      className="bg-primary hover:bg-primary/90 text-white gap-2"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  ) : isLastSection ? (
                    // Only show Submit button if we're on the last section
                    <Button
                      type="submit"
                      disabled={isSubmitting || !areAllQuestionsAnswered()}
                      onClick={(e) => {
                        if (!areAllQuestionsAnswered()) {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('Submit button clicked but not all questions answered');
                          toast({
                            title: "Cannot Submit",
                            description: "Please answer all required questions before submitting.",
                            variant: "destructive",
                          });
                          return false;
                        }
                      }}
                      className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      title={!areAllQuestionsAnswered() ? "Please answer all required questions before submitting" : ""}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Response'
                      )}
                    </Button>
                  ) : (
                    // If not last section and can't go next (section incomplete), show disabled Next button
                    <Button
                      type="button"
                      disabled={true}
                      className="bg-gray-300 text-gray-500 cursor-not-allowed gap-2"
                      title="Please complete this section before proceeding"
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex justify-center pt-6 border-t border-gray-200">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !areAllQuestionsAnswered()}
                    onClick={(e) => {
                      if (!areAllQuestionsAnswered()) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Submit button clicked but not all questions answered');
                        toast({
                          title: "Cannot Submit",
                          description: "Please answer all required questions before submitting.",
                          variant: "destructive",
                        });
                        return false;
                      }
                    }}
                    className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!areAllQuestionsAnswered() ? "Please answer all required questions before submitting" : ""}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Response'
                    )}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

