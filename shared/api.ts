/**
 * Shared code between client and server
 * Useful to share types between client and server
 * and/or small pure JS functions that can be used on both client and server
 */

/**
 * Example response type for /api/demo
 */
export interface DemoResponse {
  message: string;
}

/**
 * Authentication types
 */
export type UserRole = 'user' | 'admin';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  created_at?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface AuthVerifyResponse {
  user: User;
}

/**
 * Admin types
 */
export interface AdminStats {
  totalUsers: number;
  totalForms: number;
  totalSubmissions: number;
}

export interface Form {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  is_shared: boolean;
  share_token: string | null;
  is_quiz?: boolean;
  created_at: string;
  updated_at: string;
  last_opened_at?: string | null;
  username?: string;
  response_count?: number;
}

export interface FormSubmission {
  id: number;
  form_id: number;
  submitted_by: number | null;
  submitted_at: string;
  form_title?: string;
  username?: string;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface ValidationRules {
  minLength?: number; // Minimum length for text fields
  maxLength?: number; // Maximum length for text fields
  pattern?: 'email' | 'phone' | 'url' | 'number'; // Pattern validation
  minValue?: number; // Minimum value for number fields
  maxValue?: number; // Maximum value for number fields
  customPattern?: string; // Custom regex pattern
}

export interface ConditionalLogic {
  showIfQuestion?: string; // ID of the question that triggers this
  showIfAnswer?: string | string[]; // Answer value(s) that trigger showing this question
  operator?: 'equals' | 'contains' | 'not_equals'; // How to compare the answer
}

export interface FormQuestion {
  id?: string;
  title: string;
  type: 'short' | 'long' | 'multiple' | 'checkbox' | 'dropdown' | 'linear' | 'text' | 'textarea' | 'radio' | 'select' | 'number' | 'email' | 'date' | 'file' | 'rating' | 'time' | 'multiple_grid' | 'checkbox_grid';
  required: boolean;
  options?: string[];
  rows?: string[];
  columns?: string[];
  hasOther?: boolean; // Enable "Other" option for multiple choice and checkbox
  description?: string; // Question description/help text
  validation?: ValidationRules; // Validation rules
  conditionalLogic?: ConditionalLogic; // Conditional logic rules
  correctAnswer?: string | string[]; // Correct answer(s) for quiz mode
  points?: number; // Points for this question (default: 1)
}

export interface CreateFormRequest {
  title: string;
  description?: string;
  confirmation_message?: string;
  accepting_responses?: boolean;
  response_limit?: number | null;
  is_quiz?: boolean; // Enable quiz mode
  points_per_question?: number; // Default points per question (default: 1)
  questions: FormQuestion[];
  theme_color?: string;
  theme_background?: string;
  header_image_url?: string;
}

export interface CreateFormResponse {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  is_shared: boolean;
  share_token: string;
  share_url: string;
  created_at: string;
  updated_at: string;
}
