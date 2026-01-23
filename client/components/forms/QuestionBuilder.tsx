import React, { useState, useEffect } from "react";
import { X, Copy, ChevronDown, ChevronUp, ChevronDown as MoveDown, GripVertical, Image, Star, Clock, Calendar, Upload, Grid3x3, Heart, ThumbsUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Question, Section } from "./FormEditor";

interface QuestionBuilderProps {
  question: Question;
  allQuestions?: Question[]; // All questions in the form for conditional logic
  sections?: Section[]; // All sections in the form
  isQuizMode?: boolean; // Whether quiz mode is enabled for the form
  onUpdate: (id: string, updated: Partial<Question>) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onAddQuestion?: () => void; // Add question function
  onMove?: (id: string, direction: 'up' | 'down') => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isSelected?: boolean;
  isLastQuestion?: boolean; // Whether this is the last question
}

const QUESTION_TYPES = [
  { value: "short", label: "Short answer", icon: "text" },
  { value: "long", label: "Paragraph", icon: "paragraph" },
  { value: "multiple", label: "Multiple choice", icon: "radio" },
  { value: "checkbox", label: "Checkboxes", icon: "checkbox" },
  { value: "dropdown", label: "Drop-down", icon: "dropdown" },
  { value: "linear", label: "Linear scale", icon: "scale" },
  { value: "rating", label: "Rating", icon: "star" },
  { value: "date", label: "Date", icon: "calendar" },
  { value: "time", label: "Time", icon: "clock" },
];

export function QuestionBuilder({
  question,
  allQuestions = [],
  sections = [],
  isQuizMode = false,
  onUpdate,
  onDelete,
  onDuplicate,
  onAddQuestion,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  isSelected = false,
  isLastQuestion = false,
}: QuestionBuilderProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Ensure multiple choice, checkbox, and dropdown questions always have at least one option
  useEffect(() => {
    if (needsOptions && (!question.options || question.options.length === 0)) {
      onUpdate(question.id, { options: ["Option 1"] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.type]);

  const handleAddOption = () => {
    const currentOptions = question.options && question.options.length > 0 ? question.options : ["Option 1"];
    const newOptions = [...currentOptions, "New option"];
    onUpdate(question.id, { options: newOptions });
  };

  const handleUpdateOption = (index: number, value: string) => {
    const currentOptions = question.options && question.options.length > 0 ? question.options : ["Option 1"];
    const newOptions = [...currentOptions];
    newOptions[index] = value;
    onUpdate(question.id, { options: newOptions });
  };

  const handleDeleteOption = (index: number) => {
    const currentOptions = question.options && question.options.length > 0 ? question.options : ["Option 1"];
    // Don't allow deleting if only one option remains
    if (currentOptions.length <= 1) return;
    const newOptions = currentOptions.filter((_, i) => i !== index);
    onUpdate(question.id, { options: newOptions });
  };

  const needsOptions =
    question.type === "checkbox" ||
    question.type === "multiple" ||
    question.type === "dropdown";

  const needsGridSetup =
    question.type === "multiple_grid" ||
    question.type === "checkbox_grid";

  const getQuestionIcon = (type: string): React.ReactNode => {
    switch (type) {
      case "short": return "📝";
      case "long": return "📄";
      case "multiple": return "🔘";
      case "checkbox": return "☑️";
      case "dropdown": return "📋";
      case "file": return <Upload className="w-4 h-4" />;
      case "linear": return "1-5";
      case "rating": return <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />;
      case "date": return <Calendar className="w-4 h-4" />;
      case "time": return <Clock className="w-4 h-4" />;
      case "multiple_grid": return <Grid3x3 className="w-4 h-4" />;
      case "checkbox_grid": return <Grid3x3 className="w-4 h-4" />;
      default: return "?";
    }
  };

  return (
    <div className={`bg-white rounded-lg border-2 ${isSelected ? 'border-blue-500' : 'border-gray-200'} p-6 space-y-4 relative`}>
      {/* Blue selection indicator */}
      {isSelected && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l-lg" />
      )}
      
      {/* Question Title and Right Side Panel */}
      <div className="flex items-start gap-4">
        {/* Left: Question Content */}
        <div className="flex items-start gap-3 flex-1">
          <div className="pt-2 flex items-center">
            {getQuestionIcon(question.type)}
          </div>
          <div className="flex-1 space-y-2">
            <input
              type="text"
              value={question.title ? question.title.replace(/0+$/, '') : ''}
              onChange={(e) => {
                const cleanedValue = e.target.value.replace(/0+$/, '');
                onUpdate(question.id, { title: cleanedValue });
              }}
              className="w-full text-lg font-medium text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-primary outline-none pb-2"
              placeholder="Question"
            />
            {/* Question Description/Help Text */}
            <input
              type="text"
              value={question.description || ''}
              onChange={(e) => onUpdate(question.id, { description: e.target.value })}
              className="w-full text-sm text-gray-500 bg-transparent border-b border-transparent hover:border-gray-200 focus:border-gray-300 outline-none pb-1 placeholder:text-gray-400"
              placeholder="Description (optional)"
            />
          </div>
        </div>
        
        {/* Right: Validation Rules and Conditional Logic - Stacked */}
        <div className="w-64 space-y-2 shrink-0">
          {/* Validation Rules */}
          {(question.type === "short" || question.type === "long" || question.type === "linear") && (
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-1.5">Validation Rules</div>
              
              {/* Min/Max Length for text fields */}
              {(question.type === "short" || question.type === "long") && (
                <>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Min</label>
                      <input
                        type="number"
                        min="0"
                        value={question.validation?.minLength || ''}
                        onChange={(e) => onUpdate(question.id, {
                          validation: {
                            ...question.validation,
                            minLength: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Min"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Max</label>
                      <input
                        type="number"
                        min="0"
                        value={question.validation?.maxLength || ''}
                        onChange={(e) => onUpdate(question.id, {
                          validation: {
                            ...question.validation,
                            maxLength: e.target.value ? parseInt(e.target.value) : undefined
                          }
                        })}
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="Max"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Pattern</label>
                    <select
                      value={question.validation?.pattern || ''}
                      onChange={(e) => onUpdate(question.id, {
                        validation: {
                          ...question.validation,
                          pattern: e.target.value ? (e.target.value as 'email' | 'phone' | 'url' | 'number') : undefined
                        }
                      })}
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">None</option>
                      <option value="email">Email</option>
                      <option value="phone">Phone</option>
                      <option value="url">URL</option>
                      <option value="number">Number</option>
                    </select>
                  </div>
                </>
              )}
              
              {/* Min/Max Value for number fields */}
              {question.type === "linear" && (
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Min</label>
                    <input
                      type="number"
                      value={question.validation?.minValue || ''}
                      onChange={(e) => onUpdate(question.id, {
                        validation: {
                          ...question.validation,
                          minValue: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Min"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-0.5">Max</label>
                    <input
                      type="number"
                      value={question.validation?.maxValue || ''}
                      onChange={(e) => onUpdate(question.id, {
                        validation: {
                          ...question.validation,
                          maxValue: e.target.value ? parseFloat(e.target.value) : undefined
                        }
                      })}
                      className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Max"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Section Assignment */}
          {sections && sections.length > 0 && (
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-1.5">Section</div>
              <select
                value={question.sectionId || ''}
                onChange={(e) => onUpdate(question.id, {
                  sectionId: e.target.value || null
                })}
                className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No Section</option>
                {sections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {/* Conditional Logic */}
          {allQuestions && allQuestions.length > 1 && (
            <div className="bg-gray-50 rounded p-2 border border-gray-200">
              <div className="text-xs font-semibold text-gray-600 mb-1.5">Conditional Logic</div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={!!question.conditionalLogic?.showIfQuestion}
                    onChange={(e) => {
                      if (e.target.checked) {
                        onUpdate(question.id, {
                          conditionalLogic: {
                            showIfQuestion: '',
                            showIfAnswer: '',
                            operator: 'equals'
                          }
                        });
                      } else {
                        onUpdate(question.id, {
                          conditionalLogic: undefined
                        });
                      }
                    }}
                    className="w-3.5 h-3.5 text-primary rounded focus:ring-primary"
                  />
                  <span className="text-xs">Show if answered</span>
                </label>
                
                {question.conditionalLogic?.showIfQuestion && (
                  <div className="space-y-1.5 pl-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-0.5">Question:</label>
                      <select
                        value={question.conditionalLogic.showIfQuestion || ''}
                        onChange={(e) => onUpdate(question.id, {
                          conditionalLogic: {
                            ...question.conditionalLogic,
                            showIfQuestion: e.target.value,
                            showIfAnswer: ''
                          }
                        })}
                        className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select...</option>
                        {allQuestions && allQuestions
                          .filter(q => q.id !== question.id)
                          .map(q => (
                            <option key={q.id} value={q.id}>
                              {q.title?.substring(0, 20) || `Q${allQuestions.indexOf(q) + 1}`}
                            </option>
                          ))}
                      </select>
                    </div>
                    
                    {question.conditionalLogic.showIfQuestion && (() => {
                      const triggerQuestion = allQuestions && allQuestions.find(q => q.id === question.conditionalLogic?.showIfQuestion);
                      if (!triggerQuestion) return null;
                      
                      if (triggerQuestion.type === 'multiple' || triggerQuestion.type === 'checkbox' || triggerQuestion.type === 'dropdown') {
                        return (
                          <div>
                            <label className="text-xs text-gray-500 block mb-0.5">Answer:</label>
                            <select
                              value={Array.isArray(question.conditionalLogic.showIfAnswer) 
                                ? question.conditionalLogic.showIfAnswer[0] || ''
                                : question.conditionalLogic.showIfAnswer || ''}
                              onChange={(e) => onUpdate(question.id, {
                                conditionalLogic: {
                                  ...question.conditionalLogic,
                                  showIfAnswer: e.target.value,
                                  operator: 'equals'
                                }
                              })}
                              className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="">Select...</option>
                              {triggerQuestion.options?.map((option, idx) => (
                                <option key={idx} value={option}>
                                  {option.substring(0, 15)}
                                </option>
                              ))}
                            </select>
                          </div>
                        );
                      } else {
                        return (
                          <div className="space-y-1.5">
                            <div>
                              <label className="text-xs text-gray-500 block mb-0.5">Op:</label>
                              <select
                                value={question.conditionalLogic.operator || 'equals'}
                                onChange={(e) => onUpdate(question.id, {
                                  conditionalLogic: {
                                    ...question.conditionalLogic,
                                    operator: e.target.value as 'equals' | 'contains' | 'not_equals'
                                  }
                                })}
                                className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                              >
                                <option value="equals">=</option>
                                <option value="contains">Contains</option>
                                <option value="not_equals">≠</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 block mb-0.5">Value:</label>
                              <input
                                type="text"
                                value={Array.isArray(question.conditionalLogic.showIfAnswer) 
                                  ? question.conditionalLogic.showIfAnswer[0] || ''
                                  : question.conditionalLogic.showIfAnswer || ''}
                                onChange={(e) => onUpdate(question.id, {
                                  conditionalLogic: {
                                    ...question.conditionalLogic,
                                    showIfAnswer: e.target.value
                                  }
                                })}
                                className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                                placeholder="Value..."
                              />
                            </div>
                          </div>
                        );
                      }
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-gray-400 hover:text-gray-600"
          title="Add image"
        >
          <Image className="w-4 h-4" />
        </Button>
      </div>

      {/* Options Editor - Moved to top, right after question title for better UX */}
      {needsOptions && (
        <div className="pt-3 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {question.type === "multiple" && "Add your choices"}
            {question.type === "checkbox" && "Add your options"}
            {question.type === "dropdown" && "Add your options"}
          </div>
          <div className="space-y-2">
            {(() => {
              const displayOptions = question.options && question.options.length > 0 ? question.options : ["Option 1"];
              return displayOptions.map((option, idx) => (
              <div key={idx} className="flex items-center gap-3 group bg-white rounded-md border border-gray-200 hover:border-primary/30 transition-colors px-3 py-2">
                <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                  {question.type === "checkbox" && (
                    <input type="checkbox" disabled className="w-4 h-4 text-primary cursor-default" />
                  )}
                  {question.type === "multiple" && (
                    <input type="radio" disabled className="w-4 h-4 text-primary cursor-default" />
                  )}
                  {question.type === "dropdown" && (
                    <span className="text-gray-400 text-xs">•</span>
                  )}
                </div>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleUpdateOption(idx, e.target.value)}
                  className="flex-1 px-2 py-1.5 border-0 bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-primary rounded"
                  placeholder={`Option ${idx + 1}`}
                />
                  {displayOptions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteOption(idx)}
                    className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove option"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
              ));
            })()}
          </div>
          
          {/* Add Option Button */}
          <Button
            variant="outline"
            onClick={handleAddOption}
            className="w-full border-dashed border-gray-300 text-primary hover:text-primary hover:border-primary hover:bg-primary/5 text-sm h-9 font-medium mt-3"
          >
            + Add option
          </Button>

          {/* "Other" Option Toggle - Only for multiple choice and checkbox */}
          {(question.type === "multiple" || question.type === "checkbox") && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={question.hasOther || false}
                  onChange={(e) => onUpdate(question.id, { hasOther: e.target.checked })}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="font-medium">Add "Other" option</span>
                <span className="text-xs text-gray-500">(Allows respondents to write their own answer)</span>
              </label>
            </div>
          )}

          {/* Quiz Mode: Set Correct Answer - Only show when quiz mode is enabled */}
          {isQuizMode && (question.type === "multiple" || question.type === "checkbox" || question.type === "dropdown" || question.type === "short" || question.type === "long") && (
            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700">Quiz Mode</label>
                <span className="text-xs text-gray-500">Set correct answer</span>
              </div>
              
              {/* Points per question */}
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 whitespace-nowrap">Points:</label>
                <input
                  type="number"
                  min="1"
                  value={question.points || 1}
                  onChange={(e) => {
                    const points = parseInt(e.target.value) || 1;
                    onUpdate(question.id, { points });
                  }}
                  className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Correct Answer Input */}
              {(question.type === "multiple" || question.type === "dropdown") && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 block">Correct Answer:</label>
                  <select
                    value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                    onChange={(e) => onUpdate(question.id, { correctAnswer: e.target.value || undefined })}
                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary bg-white"
                  >
                    <option value="">No correct answer</option>
                    {question.options?.map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>
              )}

              {question.type === "checkbox" && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 block">Correct Answers (select all):</label>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto border border-gray-200 rounded p-2">
                    {question.options?.map((opt, idx) => {
                      const correctAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                      const isSelected = correctAnswers.includes(opt);
                      return (
                        <label key={idx} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              const currentAnswers = Array.isArray(question.correctAnswer) ? question.correctAnswer : [];
                              const newAnswers = e.target.checked
                                ? [...currentAnswers, opt]
                                : currentAnswers.filter(a => a !== opt);
                              onUpdate(question.id, { correctAnswer: newAnswers.length > 0 ? newAnswers : undefined });
                            }}
                            className="w-3.5 h-3.5 text-primary rounded focus:ring-primary"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {(question.type === "short" || question.type === "long") && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-600 block">Correct Answer:</label>
                  {question.type === "short" ? (
                    <input
                      type="text"
                      value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                      onChange={(e) => onUpdate(question.id, { correctAnswer: e.target.value || undefined })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="Enter correct answer (case-insensitive)"
                    />
                  ) : (
                    <textarea
                      value={typeof question.correctAnswer === 'string' ? question.correctAnswer : ''}
                      onChange={(e) => onUpdate(question.id, { correctAnswer: e.target.value || undefined })}
                      className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      placeholder="Enter correct answer (case-insensitive)"
                      rows={2}
                    />
                  )}
                  <p className="text-xs text-gray-400">Answers are compared case-insensitively</p>
                </div>
              )}

              {/* Clear correct answer button */}
              {(question.correctAnswer !== undefined && question.correctAnswer !== null && question.correctAnswer !== '') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdate(question.id, { correctAnswer: undefined })}
                  className="h-7 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50"
                >
                  Clear correct answer
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Question Preview - Only for non-option types */}
      {question.type === "short" && (
        <input
          type="text"
          placeholder="Short answer text"
          disabled
          className="w-full px-3 py-2 border-b border-gray-300 text-sm text-gray-500 bg-gray-50"
        />
      )}
      {question.type === "long" && (
        <textarea
          placeholder="Long answer text"
          disabled
          className="w-full px-3 py-2 border-b border-gray-300 text-sm text-gray-500 bg-gray-50 resize-none"
          rows={3}
        />
      )}
      {question.type === "date" && (
        <input
          type="date"
          disabled
          className="w-full px-3 py-2 border-b border-gray-300 text-sm text-gray-500 bg-gray-50"
        />
      )}
      {question.type === "time" && (
        <input
          type="time"
          disabled
          className="w-full px-3 py-2 border-b border-gray-300 text-sm text-gray-500 bg-gray-50"
        />
      )}
      {question.type === "file" && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p className="text-sm text-gray-500">File upload</p>
        </div>
      )}
      {question.type === "rating" && (
        <div className="space-y-4">
          {/* Rating configuration: max value + icon type */}
          <div className="flex justify-between items-center gap-3">
            {/* Max value selector (1–10) */}
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Max rating</span>
              <select
                className="px-2 py-1 border border-gray-300 rounded-md bg-white text-xs text-gray-700"
                value={question.options?.[1] || "5"}
                onChange={(e) => {
                  const current = question.options || ["star", "5"];
                  const updated = [...current];
                  // options[0] = icon type, options[1] = max value
                  updated[1] = e.target.value;
                  onUpdate(question.id, { options: updated });
                }}
              >
                {Array.from({ length: 10 }).map((_, idx) => {
                  const v = (idx + 1).toString();
                  return (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Icon type selector (Star / Heart / Like) */}
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span>Icon</span>
              <select
                className="px-2 py-1 border border-gray-300 rounded-md bg-white text-xs text-gray-700"
                value={question.options?.[0] || "star"}
                onChange={(e) => {
                  const current = question.options || ["star", question.options?.[1] || "5"];
                  const updated = [...current];
                  updated[0] = e.target.value;
                  onUpdate(question.id, { options: updated });
                }}
              >
                <option value="star">Star</option>
                <option value="heart">Heart</option>
                <option value="like">Like</option>
              </select>
            </div>
          </div>

          {/* Rating scale preview (1–max) */}
          <div className="flex items-center justify-between max-w-md">
            {Array.from({ length: parseInt(question.options?.[1] || "5", 10) || 5 }).map(
              (_, idx) => {
                const value = idx + 1;
                const iconType = question.options?.[0] || "star";

                let Icon = Star as typeof Star | typeof Heart | typeof ThumbsUp;
                if (iconType === "heart") Icon = Heart;
                if (iconType === "like") Icon = ThumbsUp;

                return (
                  <div key={value} className="flex flex-col items-center gap-1">
                    <span className="text-sm text-gray-700">{value}</span>
                    <Icon className="w-7 h-7 text-gray-400" />
                  </div>
                );
              },
            )}
          </div>
        </div>
      )}
      {needsGridSetup && (
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">Rows</p>
            {(question.rows || ["Row 1", "Row 2"]).map((row, idx) => (
              <input
                key={idx}
                type="text"
                value={row}
                onChange={(e) => {
                  const newRows = [...(question.rows || ["Row 1", "Row 2"])];
                  newRows[idx] = e.target.value;
                  onUpdate(question.id, { rows: newRows });
                }}
                className="w-full px-2 py-1 mb-1 border border-gray-200 rounded text-sm"
                placeholder={`Row ${idx + 1}`}
              />
            ))}
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Columns</p>
            {(question.columns || ["Column 1", "Column 2"]).map((col, idx) => (
              <input
                key={idx}
                type="text"
                value={col}
                onChange={(e) => {
                  const newCols = [...(question.columns || ["Column 1", "Column 2"])];
                  newCols[idx] = e.target.value;
                  onUpdate(question.id, { columns: newCols });
                }}
                className="w-full px-2 py-1 mb-1 border border-gray-200 rounded text-sm"
                placeholder={`Column ${idx + 1}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Settings Row */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={question.required}
              onChange={(e) =>
                onUpdate(question.id, { required: e.target.checked })
              }
              className="w-4 h-4"
            />
            Required
          </label>
          
          {/* Move Buttons */}
          {onMove && (
            <div className="flex items-center gap-1 border-l border-gray-200 pl-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMove(question.id, 'up')}
                disabled={!canMoveUp}
                className="h-8 w-8 p-0"
                title="Move up"
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onMove(question.id, 'down')}
                disabled={!canMoveDown}
                className="h-8 w-8 p-0"
                title="Move down"
              >
                <MoveDown className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Add Question Button - Only show on last question */}
          {isLastQuestion && onAddQuestion && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onAddQuestion}
              className="h-8 gap-1 text-sm text-primary hover:text-primary hover:bg-primary/10"
              title="Add question"
            >
              <Plus className="w-4 h-4" />
              Add Question
            </Button>
          )}
          
          {/* Duplicate Button */}
          {onDuplicate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(question.id)}
              className="h-8 gap-1 text-sm"
              title="Duplicate question"
            >
              <Copy className="w-4 h-4" />
              Duplicate
            </Button>
          )}

          {/* Question Type Dropdown */}
          <div className="relative">
            <button 
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex items-center gap-2 px-3 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xs">{getQuestionIcon(question.type)}</span>
              {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showTypeDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowTypeDropdown(false)}
                />
                <div className="absolute right-0 mt-1 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
                  {QUESTION_TYPES.map((type) => (
                    <button
                      key={type.value}
                      onClick={() => {
                        onUpdate(question.id, {
                          type: type.value as Question["type"],
                          options: ["checkbox", "multiple", "dropdown"].includes(
                            type.value,
                          )
                            ? question.options && question.options.length > 0 
                              ? question.options 
                              : ["Option 1"]
                            : undefined,
                          rows: ["multiple_grid", "checkbox_grid"].includes(type.value)
                            ? question.rows || ["Row 1", "Row 2"]
                            : undefined,
                          columns: ["multiple_grid", "checkbox_grid"].includes(type.value)
                            ? question.columns || ["Column 1", "Column 2"]
                            : undefined,
                        });
                        setShowTypeDropdown(false);
                      }}
                      className={`flex items-center gap-3 w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg ${
                        question.type === type.value ? 'bg-blue-50 text-blue-700' : ''
                      }`}
                    >
                      <span className="text-base">{getQuestionIcon(type.value)}</span>
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Delete Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(question.id)}
            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
            title="Delete question"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

    </div>
  );
}
