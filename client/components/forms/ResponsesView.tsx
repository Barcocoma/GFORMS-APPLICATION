import React, { useEffect, useState } from "react";
import { Question } from "./FormEditor";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, MessageSquare, Share2, FileQuestion, Star, Heart, ThumbsUp, Edit2, Trash2, Eye, Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Response {
  id: number;
  submitted_at: string;
  submitted_by: string;
  answers: Record<number, string[]>;
  quiz_results?: {
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
  };
  manual_scores?: Record<number, number>; // question_id: points
  total_score?: number;
}

interface ResponsesViewProps {
  questions: Question[];
  formId: number;
  isQuiz?: boolean;
}

export function ResponsesView({ questions, formId, isQuiz = false }: ResponsesViewProps) {
  const { token } = useAuth();
  const { toast } = useToast();
  const [responses, setResponses] = useState<Response[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingResponse, setEditingResponse] = useState<Response | null>(null);
  const [editAnswers, setEditAnswers] = useState<Record<number, string | string[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [deletingResponseId, setDeletingResponseId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewingResponse, setViewingResponse] = useState<Response | null>(null);
  const [manualScores, setManualScores] = useState<Record<number, number>>({});
  const [isSavingScore, setIsSavingScore] = useState(false);

  useEffect(() => {
    if (formId && token) {
      fetchResponses();
    }
  }, [formId, token]);

  const fetchResponses = async () => {
    try {
    setIsLoading(true);
      const response = await fetch(`/api/forms/${formId}/responses`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load responses');
      }

      const data = await response.json();
      setResponses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load responses');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (response: Response) => {
    setEditingResponse(response);
    // Convert answers to editable format
    const editableAnswers: Record<number, string | string[]> = {};
    Object.keys(response.answers).forEach((key) => {
      const questionId = parseInt(key);
      const answer = response.answers[questionId];
      if (Array.isArray(answer) && answer.length === 1) {
        editableAnswers[questionId] = answer[0];
      } else {
        editableAnswers[questionId] = answer;
      }
    });
    setEditAnswers(editableAnswers);
  };

  const handleSaveEdit = async () => {
    if (!editingResponse) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/forms/${formId}/responses/${editingResponse.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ answers: editAnswers }),
      });

      if (!response.ok) {
        throw new Error('Failed to update response');
      }

      toast({
        title: "Success",
        description: "Response updated successfully",
      });

      setEditingResponse(null);
      setEditAnswers({});
      fetchResponses(); // Refresh responses
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to update response',
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingResponseId) return;
    
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/forms/${formId}/responses/${deletingResponseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete response');
      }

      toast({
        title: "Success",
        description: "Response deleted successfully",
      });

      setShowDeleteDialog(false);
      setDeletingResponseId(null);
      fetchResponses(); // Refresh responses
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : 'Failed to delete response',
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openDeleteDialog = (responseId: number) => {
    setDeletingResponseId(responseId);
    setShowDeleteDialog(true);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    // Use toLocaleString with explicit options for better formatting
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return "No date";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const getQuestionTypeLabel = (type: Question["type"]): string => {
    const typeLabels: Record<Question["type"], string> = {
      'short': 'Short Answer',
      'long': 'Long Answer',
      'multiple': 'Multiple Choice',
      'checkbox': 'Checkboxes',
      'dropdown': 'Dropdown',
      'linear': 'Linear Scale',
      'rating': 'Rating',
      'date': 'Date',
      'time': 'Time',
      'file': 'File Upload',
      'multiple_grid': 'Multiple Choice Grid',
      'checkbox_grid': 'Checkbox Grid'
    };
    return typeLabels[type] || 'Unknown';
  };

  const formatAnswer = (answer: string, question: Question): React.ReactNode => {
    if (!answer) return null;

    // Handle "Other" option answers (format: "__OTHER__:user text")
    if (typeof answer === 'string' && answer.startsWith('__OTHER__:')) {
      const otherText = answer.replace('__OTHER__:', '');
      return (
        <span className="italic text-gray-600">
          Other: <span className="font-medium text-gray-900">{otherText}</span>
        </span>
      );
    }

    // Handle array answers (for checkbox) that may contain "Other"
    if (Array.isArray(answer)) {
      return (
        <div className="space-y-1">
          {answer.map((ans, idx) => {
            if (typeof ans === 'string' && ans.startsWith('__OTHER__:')) {
              const otherText = ans.replace('__OTHER__:', '');
              return (
                <div key={idx} className="text-sm">
                  <span className="italic text-gray-600">Other: </span>
                  <span className="font-medium text-gray-900">{otherText}</span>
                </div>
              );
            }
            return <div key={idx} className="text-sm">{ans}</div>;
          })}
        </div>
      );
    }

    switch (question.type) {
      case 'rating':
        const ratingValue = parseInt(answer, 10);
        const maxRating = parseInt(question.options?.[1] || "5", 10) || 5;
        const iconType = question.options?.[0] || "star";
        
        return (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {Array.from({ length: maxRating }).map((_, idx) => {
                const num = idx + 1;
                const isSelected = ratingValue >= num;
                
                if (iconType === "heart") {
                  return (
                    <Heart
                      key={num}
                      className={`w-4 h-4 ${
                        isSelected
                          ? "fill-red-500 text-red-500"
                          : "text-gray-300"
                      }`}
                    />
                  );
                } else if (iconType === "like") {
                  return (
                    <ThumbsUp
                      key={num}
                      className={`w-4 h-4 ${
                        isSelected
                          ? "fill-blue-500 text-blue-500"
                          : "text-gray-300"
                      }`}
                    />
                  );
                } else {
                  return (
                    <Star
                      key={num}
                      className={`w-4 h-4 ${
                        isSelected
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-gray-300"
                      }`}
                    />
                  );
                }
              })}
            </div>
            <span className="text-sm text-gray-600">({ratingValue}/{maxRating})</span>
          </div>
        );
      
      case 'date':
        try {
          const date = new Date(answer);
          return <span>{date.toLocaleDateString()}</span>;
        } catch {
          return <span>{answer}</span>;
        }
      
      case 'time':
        return <span>{answer}</span>;
      
      case 'linear':
        return <span className="font-medium">{answer}</span>;
      
      default:
        return <span>{answer}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-gray-600 text-sm">Loading responses...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Error Loading Responses</h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalResponses = responses.length;
  const lastResponse = responses.length > 0 ? responses[0] : null;

  // Calculate summary per question
  const questionSummary = questions.map((question) => {
    const questionId = parseInt(question.id);
    let answeredCount = 0;
    const answerCounts: Record<string, number> = {};
    
    responses.forEach((response) => {
      const answer = response.answers[questionId];
      if (answer && answer.length > 0) {
        answeredCount++;
        answer.forEach((ans) => {
          // Handle "Other" option - group all "Other" answers together
          if (typeof ans === 'string' && ans.startsWith('__OTHER__:')) {
            answerCounts['Other'] = (answerCounts['Other'] || 0) + 1;
          } else {
            answerCounts[ans] = (answerCounts[ans] || 0) + 1;
          }
        });
      }
    });

    return {
      question,
      answeredCount,
      totalCount: totalResponses,
      answerCounts: answerCounts,
    };
  });

  return (
    <div className="space-y-5 bg-gray-50/50 -mx-4 px-4 py-4 rounded-lg">
      {totalResponses === 0 ? (
        <Card className="border-2 border-dashed border-gray-300 bg-gray-50/50">
          <CardContent className="pt-12 pb-12">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                <MessageSquare className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No Responses Yet</h3>
              <p className="text-sm text-gray-600 mb-6 max-w-md">
                You haven't received any responses yet. Share your form link with others to start collecting responses.
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Share2 className="w-4 h-4" />
                <span>Use the "Share" button above to get your form link</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80">
              <CardContent className="pt-6">
          <p className="text-gray-600 text-sm font-medium">Total Responses</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">
            {totalResponses}
          </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80">
              <CardContent className="pt-6">
                <p className="text-gray-600 text-sm font-medium">Questions</p>
                <p className="text-4xl font-bold text-gray-900 mt-2">
                  {questions.length}
                </p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-300 bg-white/80">
              <CardContent className="pt-6">
          <p className="text-gray-600 text-sm font-medium">Last Response</p>
          <p className="text-lg font-semibold text-gray-900 mt-2">
                  {lastResponse ? formatTimeAgo(lastResponse.submitted_at) : "No responses yet"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Question Summary */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <FileQuestion className="w-5 h-5 text-gray-600" />
              Question Summary
            </h3>
            {questionSummary.length === 0 ? (
              <Card className="border-2 border-dashed border-gray-300">
                <CardContent className="pt-6 pb-6">
                  <p className="text-sm text-gray-500 text-center">
                    No questions available to summarize.
                  </p>
                </CardContent>
              </Card>
            ) : (
              questionSummary.map((summary, index) => (
                <Card
                  key={summary.question.id}
                  className="border shadow-sm hover:shadow-md transition-shadow duration-200 bg-white"
                >
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-500 shrink-0">Q{index + 1}</span>
                          <h4 className="text-base font-semibold text-gray-900 break-words">
                            {summary.question.title}
                          </h4>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {getQuestionTypeLabel(summary.question.type)}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500">
                          {summary.answeredCount} of {summary.totalCount} response{summary.totalCount !== 1 ? 's' : ''} answered
                          {summary.totalCount > 0 && (
                            <span className="ml-2">
                              ({Math.round((summary.answeredCount / summary.totalCount) * 100)}%)
                            </span>
                          )}
          </p>
        </div>
                    </div>

                    {/* Answer Distribution */}
                    {Object.keys(summary.answerCounts).length > 0 ? (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm font-medium text-gray-700 mb-3">Answer Distribution:</p>
                        <div className="space-y-2">
                          {Object.entries(summary.answerCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([answer, count]) => (
                              <div key={answer} className="flex items-center gap-3">
                                <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden min-w-[100px]">
                                  <div
                                    className="bg-primary h-full rounded-full flex items-center justify-end pr-2 transition-all duration-300"
                                    style={{
                                      width: `${(count / summary.totalCount) * 100}%`,
                                    }}
                                  >
                                    {count > 0 && (
                                      <span className="text-xs font-medium text-white">
                                        {count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-sm text-gray-700 min-w-[100px] break-words">
                                  {formatAnswer(answer, summary.question)}
                                </div>
                                <span className="text-xs text-gray-500 shrink-0">
                                  {Math.round((count / summary.totalCount) * 100)}%
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-4 text-sm text-gray-500 italic">
                        No answers provided for this question yet.
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
      </div>

      {/* Responses Table */}
          <Card className="border-0 shadow-md overflow-hidden bg-white/80">
        <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 whitespace-nowrap">
                  Timestamp
                </th>
                {questions.map((question) => (
                  <th
                    key={question.id}
                        className="px-3 sm:px-4 lg:px-6 py-3 text-left text-xs sm:text-sm font-semibold text-gray-900 min-w-[120px]"
                  >
                        <div className="space-y-1">
                          <span className="line-clamp-2 block break-words">{question.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {getQuestionTypeLabel(question.type)}
                          </Badge>
                        </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
                  {responses.map((response, idx) => (
                <tr
                  key={response.id}
                      className={`${idx !== responses.length - 1 ? "border-b border-gray-200" : ""} hover:bg-gray-50 transition-colors`}
                >
                      <td className="px-3 sm:px-4 lg:px-6 py-4 text-xs sm:text-sm text-gray-600 whitespace-nowrap">
                        <div>
                          <div className="break-words">{formatDate(response.submitted_at)}</div>
                          <div className="text-xs text-gray-400 mt-1 break-words">
                            by {response.submitted_by}
                          </div>
                        </div>
                  </td>
                      {questions.map((question) => {
                        const questionId = parseInt(question.id);
                        const answer = response.answers[questionId];
                        
                        return (
                    <td
                      key={`${response.id}-${question.id}`}
                            className="px-3 sm:px-4 lg:px-6 py-4 text-xs sm:text-sm text-gray-900"
                    >
                      <div className="max-w-[200px] sm:max-w-xs">
                              {answer && answer.length > 0 ? (
                          <div className="space-y-1">
                                  {answer.map((ans, ansIdx) => (
                                <div
                                      key={ansIdx}
                                      className="inline-block bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs mr-1 mb-1 break-words max-w-full"
                                >
                                      {formatAnswer(ans, question) || ans}
                                </div>
                                  ))}
                          </div>
                        ) : (
                                <span className="text-gray-400 italic text-xs">
                                  (no answer)
                          </span>
                        )}
                      </div>
                    </td>
                        );
                      })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          </Card>

      {/* Individual Response Details */}
      <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-gray-600" />
              Individual Responses ({responses.length})
        </h3>
            {responses.map((response, responseIndex) => (
              <Card
            key={response.id}
                className="border shadow-sm hover:shadow-md transition-shadow duration-200 bg-white"
          >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-gray-200 pb-2 mb-3 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 break-words">
                          Response #{responseIndex + 1}
                        </p>
                        {isQuiz && response.total_score !== undefined && response.total_score !== null && (
                          <Badge className="bg-blue-100 text-blue-700 font-semibold flex items-center gap-1 shrink-0">
                            <Award className="w-3 h-3 shrink-0" />
                            <span className="whitespace-nowrap">
                              Total: {typeof response.total_score === 'number' ? Math.round(response.total_score) : Math.round(parseFloat(response.total_score || '0'))}
                              {response.quiz_results && (
                                <span className="text-xs ml-1 font-normal">
                                  / {response.quiz_results.total_points}
                                </span>
                              )}
                            </span>
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">
                        {formatDate(response.submitted_at)} • {response.submitted_by}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setViewingResponse(response);
                          setManualScores(response.manual_scores || {});
                        }}
                        className="h-7 px-2.5 whitespace-nowrap text-xs"
                      >
                        <Eye className="w-3 h-3 mr-1 shrink-0" /> View
                      </Button>
                    </div>
                </div>
                  <div className="space-y-2.5">
                    {questions.map((question, qIndex) => {
                      const questionId = parseInt(question.id);
                      const answer = response.answers[questionId];
                      
                      return (
                        <div key={question.id} className="border-l-2 border-primary/20 pl-3 py-1">
                          <div className="flex items-start gap-2 mb-1 flex-wrap">
                            <p className="text-xs font-semibold text-gray-900 break-words flex-1 min-w-0">
                              Q{qIndex + 1}: {question.title}
                            </p>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {getQuestionTypeLabel(question.type)}
                            </Badge>
            </div>
                          <div className="mt-1">
                            {answer && answer.length > 0 ? (
                              <div className="space-y-1">
                                {answer.map((ans, ansIdx) => (
                                  <div
                                    key={ansIdx}
                                    className="inline-block bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs mr-1 mb-0.5 break-words max-w-full"
                                  >
                                    {formatAnswer(ans, question) || ans}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs italic text-gray-400">(no answer provided)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Edit Response Dialog */}
      <Dialog open={!!editingResponse} onOpenChange={(open) => !open && setEditingResponse(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col bg-gray-50">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle>Edit Response</DialogTitle>
            <DialogDescription>
              Update the answers for this response
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {editingResponse && questions.map((question) => {
              const questionId = parseInt(question.id);
              const answer = editAnswers[questionId];
              
              return (
                <div key={question.id} className="space-y-2">
                  <label className="text-sm font-semibold text-gray-900">
                    {question.title}
                    {question.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {question.type === 'long' ? (
                    <Textarea
                      value={Array.isArray(answer) ? answer.join(', ') : (answer || '')}
                      onChange={(e) => setEditAnswers({
                        ...editAnswers,
                        [questionId]: e.target.value
                      })}
                      rows={4}
                    />
                  ) : question.type === 'checkbox' || question.type === 'multiple' ? (
                    <div className="space-y-2">
                      {question.options?.map((option, idx) => {
                        const isChecked = Array.isArray(answer) 
                          ? answer.includes(option) || answer.some(a => a.startsWith('__OTHER__:') && option === 'Other')
                          : answer === option;
                        
                        return (
                          <label key={idx} className="flex items-center gap-2">
                            <input
                              type={question.type === 'checkbox' ? 'checkbox' : 'radio'}
                              checked={isChecked}
                              onChange={(e) => {
                                if (question.type === 'checkbox') {
                                  const current = Array.isArray(answer) ? answer : (answer ? [answer] : []);
                                  if (e.target.checked) {
                                    setEditAnswers({
                                      ...editAnswers,
                                      [questionId]: [...current, option]
                                    });
                                  } else {
                                    setEditAnswers({
                                      ...editAnswers,
                                      [questionId]: current.filter(a => a !== option && !a.startsWith('__OTHER__:'))
                                    });
                                  }
                                } else {
                                  setEditAnswers({
                                    ...editAnswers,
                                    [questionId]: option
                                  });
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <span>{option}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      value={Array.isArray(answer) ? answer.join(', ') : (answer || '')}
                      onChange={(e) => setEditAnswers({
                        ...editAnswers,
                        [questionId]: e.target.value
                      })}
                      type={question.type === 'date' ? 'date' : question.type === 'time' ? 'time' : question.type === 'linear' ? 'number' : 'text'}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingResponse(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Response Dialog with Manual Scoring */}
      <Dialog open={!!viewingResponse} onOpenChange={(open) => !open && setViewingResponse(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col bg-gray-50">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between flex-wrap gap-2">
              <span className="break-words">View Response</span>
              {isQuiz && viewingResponse?.total_score !== undefined && viewingResponse?.total_score !== null && (
                <Badge className="bg-blue-100 text-blue-700 font-semibold text-sm sm:text-base px-2 sm:px-3 py-1 shrink-0">
                  <Award className="w-4 h-4 mr-1 inline" />
                  {typeof viewingResponse.total_score === 'number' ? Math.round(viewingResponse.total_score) : Math.round(parseFloat(viewingResponse.total_score || '0'))}
                  {viewingResponse.quiz_results && (
                    <span className="ml-1 font-normal">/ {viewingResponse.quiz_results.total_points}</span>
                  )}
                </Badge>
              )}
            </DialogTitle>
            {viewingResponse && (
              <DialogDescription asChild>
                <div className="text-xs sm:text-sm text-gray-600 space-y-1 mt-2 break-words">
                  <div>{formatDate(viewingResponse.submitted_at)}</div>
                  <div>{viewingResponse.submitted_by}</div>
                  {isQuiz && viewingResponse.quiz_results && (
                    <div className="mt-2 pt-2 border-t border-gray-200 space-y-1">
                      <div className="text-xs font-medium text-gray-700">Score Breakdown:</div>
                      <div className="text-xs text-gray-600">
                        Auto: {viewingResponse.quiz_results.earned_points}/{viewingResponse.quiz_results.total_points} points
                        {viewingResponse.manual_scores && Object.keys(viewingResponse.manual_scores).length > 0 && (
                          <span className="ml-2">
                            + Manual: {Math.round(Object.values(viewingResponse.manual_scores).reduce((a, b) => a + b, 0))} points
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600">
                        = Total: {viewingResponse.total_score !== undefined && viewingResponse.total_score !== null 
                          ? (typeof viewingResponse.total_score === 'number' ? Math.round(viewingResponse.total_score) : Math.round(parseFloat(viewingResponse.total_score || '0')))
                          : viewingResponse.quiz_results.earned_points
                        }/{viewingResponse.quiz_results.total_points} points
                      </div>
                    </div>
                  )}
                </div>
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-4 py-4 overflow-y-auto flex-1 min-h-0">
            {viewingResponse && questions.map((question, qIndex) => {
              const questionId = parseInt(question.id);
              const answer = viewingResponse.answers[questionId];
              const quizResult = viewingResponse.quiz_results?.question_results?.[questionId];
              const hasCorrectAnswer = question.correctAnswer !== undefined && question.correctAnswer !== null && question.correctAnswer !== '';
              const manualScore = manualScores[questionId];
              const points = question.points || 1;
              
              return (
                <div key={question.id} className={`border rounded-lg p-4 ${
                  isQuiz && quizResult?.is_correct ? 'bg-green-50/80 border-green-200' : 
                  isQuiz && quizResult?.is_correct === false ? 'bg-red-50/80 border-red-200' : 
                  'bg-white/60 border-gray-200'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <span className="text-sm font-semibold text-gray-900">
                          Q{qIndex + 1}: {question.title}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getQuestionTypeLabel(question.type)}
                        </Badge>
                        {isQuiz && quizResult && (
                          <Badge className={quizResult.is_correct ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {quizResult.is_correct ? '✓ Correct' : '✗ Incorrect'} ({quizResult.earned_points}/{quizResult.points} pts)
                          </Badge>
                        )}
                      </div>
                      
                      <div className="mt-3 space-y-2">
                        <div>
                          <span className="text-xs font-medium text-gray-600">Answer:</span>
                          <div className="mt-1">
                            {answer && answer.length > 0 ? (
                              <div className="space-y-1">
                                {answer.map((ans, ansIdx) => (
                                  <div key={ansIdx} className="text-sm text-gray-900 bg-white/80 px-3 py-2 rounded border">
                                    {formatAnswer(ans, question) || ans}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm italic text-gray-400">(no answer provided)</span>
                            )}
                          </div>
                        </div>
                        
                        {isQuiz && quizResult && quizResult.correct_answer && (
                          <div>
                            <span className="text-xs font-medium text-green-700">Correct Answer:</span>
                            <div className="mt-1 text-sm text-green-900 bg-white/80 px-3 py-2 rounded border border-green-200">
                              {Array.isArray(quizResult.correct_answer) 
                                ? quizResult.correct_answer.join(', ') 
                                : quizResult.correct_answer}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Manual Scoring - Only show for quiz forms and if no correct answer set */}
                  {isQuiz && !hasCorrectAnswer && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-medium text-gray-700">Manual Scoring</label>
                          <p className="text-xs text-gray-500 mt-0.5">Assign points manually (max: {points})</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            max={points}
                            step="1"
                            value={manualScore !== undefined ? manualScore : ''}
                            onChange={(e) => {
                              const inputValue = e.target.value;
                              if (inputValue === '') {
                                setManualScores({
                                  ...manualScores,
                                  [questionId]: undefined
                                });
                                return;
                              }
                              const value = parseInt(inputValue, 10);
                              if (!isNaN(value)) {
                                setManualScores({
                                  ...manualScores,
                                  [questionId]: Math.max(0, Math.min(Math.floor(points), value))
                                });
                              }
                            }}
                            className="w-24 h-8 text-sm"
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500">/ {points}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setViewingResponse(null);
                setManualScores({});
              }}
            >
              Close
            </Button>
            {isQuiz && viewingResponse && Object.values(manualScores).some(v => v !== undefined && v !== null) && (
              <Button
                onClick={async () => {
                  if (!viewingResponse) return;
                  
                  setIsSavingScore(true);
                  try {
                    const response = await fetch(`/api/forms/${formId}/responses/${viewingResponse.id}/score`, {
                      method: 'PUT',
                      headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ manual_scores: manualScores }),
                    });

                    if (!response.ok) {
                      throw new Error('Failed to save scores');
                    }

                    const result = await response.json();
                    
                    const totalScore = result.total_score !== undefined && result.total_score !== null 
                      ? (typeof result.total_score === 'number' ? Math.round(result.total_score) : Math.round(parseFloat(result.total_score || '0')))
                      : '0';
                    
                    toast({
                      title: "Success",
                      description: `Manual scores saved. Total score: ${totalScore}`,
                    });

                    fetchResponses(); // Refresh responses
                    
                    // Update viewingResponse with new scores before closing
                    if (viewingResponse) {
                      setViewingResponse({
                        ...viewingResponse,
                        manual_scores: result.manual_scores,
                        total_score: result.total_score
                      });
                    }
                    
                    // Close dialog after a short delay to show updated score
                    setTimeout(() => {
                      setViewingResponse(null);
                      setManualScores({});
                    }, 1500);
                  } catch (err) {
                    toast({
                      title: "Error",
                      description: err instanceof Error ? err.message : 'Failed to save scores',
                      variant: "destructive",
                    });
                  } finally {
                    setIsSavingScore(false);
                  }
                }}
                disabled={isSavingScore}
              >
                {isSavingScore ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Scores
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              Delete Response
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Are you sure you want to delete this response? This action cannot be undone.
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
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
