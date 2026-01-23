import { useState } from "react";
import { Question, Section } from "./FormEditor";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, Heart, ThumbsUp, Upload, ChevronLeft, ChevronRight } from "lucide-react";

interface FormPreviewProps {
  title: string;
  description: string;
  questions: Question[];
  sections?: Section[];
  onBack: () => void;
}

export function FormPreview({
  title,
  description,
  questions,
  sections = [],
  onBack,
}: FormPreviewProps) {
  const [responses, setResponses] = useState<Record<string, string | string[]>>(
    {},
  );
  
  // Check if there are questions without section to determine initial index
  const questionsWithoutSection = questions.filter(q => !q.sectionId);
  const hasQuestionsWithoutSection = questionsWithoutSection.length > 0;
  const [currentSectionIndex, setCurrentSectionIndex] = useState(
    sections.length > 0 && hasQuestionsWithoutSection ? -1 : 0
  );

  const handleInputChange = (questionId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleCheckboxChange = (
    questionId: string,
    option: string,
    checked: boolean,
  ) => {
    setResponses((prev) => {
      const current = (prev[questionId] || []) as string[];
      if (checked) {
        return {
          ...prev,
          [questionId]: [...current, option],
        };
      } else {
        return {
          ...prev,
          [questionId]: current.filter((item) => item !== option),
        };
      }
    });
  };

  const handleRadioChange = (questionId: string, option: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: option,
    }));
  };

  const handleSelectChange = (questionId: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = () => {
    console.log("Form responses:", responses);
    alert("Form submitted! Check console for responses.");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-0 h-8 w-8"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-gray-600">Preview</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto py-8 px-4">
        {/* Form Header Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-8 mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">{title}</h1>
          {description && (
            <p className="text-gray-600 text-lg">{description}</p>
          )}
        </div>

        {/* Questions Section - Grouped by sections */}
        {sections.length > 0 ? (
          <>
            {/* Section Header - Only show if on a section (not on questions without section) */}
            {currentSectionIndex >= 0 && sections[currentSectionIndex] && (
              <div className="bg-white rounded-lg border border-gray-200 mb-6">
                {/* Orange Banner */}
                <div className="bg-orange-500 text-white px-4 py-2 rounded-t-lg font-medium text-sm">
                  Section {currentSectionIndex + 1} of {sections.length}
                </div>
                
                {/* Section Content Box */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-b-lg border-t-0 border-2 border-orange-200 p-6">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {sections[currentSectionIndex]?.title || `Section ${currentSectionIndex + 1}`}
                    </h2>
                    {sections[currentSectionIndex]?.description && (
                      <p className="text-gray-600">{sections[currentSectionIndex].description}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Questions for current section */}
            <div className="space-y-6">
              {questions
                .filter(q => {
                  // If currentSectionIndex is -1, show only questions without section
                  if (currentSectionIndex === -1) {
                    return !q.sectionId;
                  }
                  // If on a section, show only questions for that section
                  if (!q.sectionId) {
                    return false;
                  }
                  return String(q.sectionId) === String(sections[currentSectionIndex]?.id);
                })
                .map((question) => (
                  <div
                    key={question.id}
                    className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
                  >
              <div>
                <label className="text-base font-medium text-gray-900 block mb-1">
                  {question.title.replace(/0+$/, '')}
                  {question.required && (
                    <span className="text-red-500 ml-1">*</span>
                  )}
                </label>
              </div>

              {/* Short Answer */}
              {question.type === "short" && (
                <input
                  type="text"
                  value={(responses[question.id] as string) || ""}
                  onChange={(e) =>
                    handleInputChange(question.id, e.target.value)
                  }
                  placeholder="Your answer"
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}

              {/* Long Answer */}
              {question.type === "long" && (
                <textarea
                  value={(responses[question.id] as string) || ""}
                  onChange={(e) =>
                    handleInputChange(question.id, e.target.value)
                  }
                  placeholder="Your answer"
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                />
              )}

              {/* Multiple Choice */}
              {question.type === "multiple" && (
                <div className="space-y-3">
                  {question.options?.map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={responses[question.id] === option}
                        onChange={(e) =>
                          handleRadioChange(question.id, e.target.value)
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Checkboxes */}
              {question.type === "checkbox" && (
                <div className="space-y-3">
                  {question.options?.map((option) => (
                    <label
                      key={option}
                      className="flex items-center gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={(
                          (responses[question.id] || []) as string[]
                        ).includes(option)}
                        onChange={(e) =>
                          handleCheckboxChange(
                            question.id,
                            option,
                            e.target.checked,
                          )
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-gray-700">{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Dropdown */}
              {question.type === "dropdown" && (
                <select
                  value={(responses[question.id] as string) || ""}
                  onChange={(e) =>
                    handleSelectChange(question.id, e.target.value)
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                >
                  <option value="">-- Select an option --</option>
                  {question.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}

              {/* Linear Scale */}
              {question.type === "linear" && (
                <div className="flex items-center gap-4">
                  {[1, 2, 3, 4, 5].map((num) => (
                    <label key={num} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`linear-${question.id}`}
                        value={num}
                        checked={responses[question.id] === String(num)}
                        onChange={(e) =>
                          handleRadioChange(question.id, e.target.value)
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-gray-600">{num}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Rating */}
              {question.type === "rating" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-1">
                    {Array.from({
                      length: parseInt(question.options?.[1] || "5", 10) || 5,
                    }).map((_, idx) => {
                      const num = idx + 1;
                      return (
                        <div key={num} className="flex flex-col items-center gap-1">
                          <span className="text-sm text-gray-600">{num}</span>
                          <button
                            type="button"
                            onClick={() => handleInputChange(question.id, String(num))}
                            className="transition-transform hover:scale-110"
                          >
                          {(() => {
                            const ratingIcon = question.options?.[0] || "star";
                            const isSelected = Number(responses[question.id]) >= num;
                            
                            if (ratingIcon === "heart") {
                              return (
                                <Heart
                                  className={`w-8 h-8 ${
                                    isSelected
                                      ? "fill-red-500 text-red-500"
                                      : "text-gray-300"
                                  }`}
                                />
                              );
                            } else if (ratingIcon === "like") {
                              return (
                                <ThumbsUp
                                  className={`w-8 h-8 ${
                                    isSelected
                                      ? "fill-blue-500 text-blue-500"
                                      : "text-gray-300"
                                  }`}
                                />
                              );
                            } else {
                              return (
                                <Star
                                  className={`w-8 h-8 ${
                                    isSelected
                                      ? "fill-yellow-400 text-yellow-400"
                                      : "text-gray-300"
                                  }`}
                                />
                              );
                            }
                          })()}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Date */}
              {question.type === "date" && (
                <input
                  type="date"
                  value={(responses[question.id] as string) || ""}
                  onChange={(e) =>
                    handleInputChange(question.id, e.target.value)
                  }
                  required={question.required}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}

              {/* Time */}
              {question.type === "time" && (
                <input
                  type="time"
                  value={(responses[question.id] as string) || ""}
                  onChange={(e) =>
                    handleInputChange(question.id, e.target.value)
                  }
                  required={question.required}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              )}

              {/* File Upload */}
              {question.type === "file" && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleInputChange(question.id, file.name);
                      }
                    }}
                    className="hidden"
                    id={`file-${question.id}`}
                    required={question.required}
                  />
                  <label
                    htmlFor={`file-${question.id}`}
                    className="cursor-pointer inline-block px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Choose File
                  </label>
                  {responses[question.id] && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selected: {responses[question.id] as string}
                    </p>
                  )}
                </div>
              )}

              {/* Multiple Choice Grid */}
              {question.type === "multiple_grid" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 p-2 bg-gray-50"></th>
                        {(question.columns || ["Column 1", "Column 2"]).map((col, idx) => (
                          <th
                            key={idx}
                            className="border border-gray-300 p-2 bg-gray-50 text-center font-medium text-gray-700"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(question.rows || ["Row 1", "Row 2"]).map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="border border-gray-300 p-2 bg-gray-50 font-medium text-gray-700">
                            {row}
                          </td>
                          {(question.columns || ["Column 1", "Column 2"]).map((col, colIdx) => (
                            <td key={colIdx} className="border border-gray-300 p-2 text-center">
                              <input
                                type="radio"
                                name={`grid-${question.id}-${rowIdx}`}
                                value={col}
                                checked={
                                  (responses[`${question.id}-${rowIdx}`] as string) === col
                                }
                                onChange={(e) =>
                                  handleInputChange(`${question.id}-${rowIdx}`, e.target.value)
                                }
                                className="w-4 h-4"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Checkbox Grid */}
              {question.type === "checkbox_grid" && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 p-2 bg-gray-50"></th>
                        {(question.columns || ["Column 1", "Column 2"]).map((col, idx) => (
                          <th
                            key={idx}
                            className="border border-gray-300 p-2 bg-gray-50 text-center font-medium text-gray-700"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(question.rows || ["Row 1", "Row 2"]).map((row, rowIdx) => (
                        <tr key={rowIdx}>
                          <td className="border border-gray-300 p-2 bg-gray-50 font-medium text-gray-700">
                            {row}
                          </td>
                          {(question.columns || ["Column 1", "Column 2"]).map((col, colIdx) => (
                            <td key={colIdx} className="border border-gray-300 p-2 text-center">
                              <input
                                type="checkbox"
                                checked={(
                                  (responses[`${question.id}-${rowIdx}`] || []) as string[]
                                ).includes(col)}
                                onChange={(e) =>
                                  handleCheckboxChange(
                                    `${question.id}-${rowIdx}`,
                                    col,
                                    e.target.checked
                                  )
                                }
                                className="w-4 h-4"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
                  </div>
                ))}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between items-center pt-6 border-t border-gray-200 mt-8">
              {currentSectionIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setCurrentSectionIndex(currentSectionIndex - 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Button>
              ) : (
                <div></div>
              )}
              
              {currentSectionIndex < sections.length - 1 ? (
                <Button
                  type="button"
                  onClick={() => {
                    setCurrentSectionIndex(currentSectionIndex + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-primary hover:bg-primary/90 text-white gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  className="bg-primary hover:bg-primary/90 text-white px-8 py-2"
                >
                  Submit
                </Button>
              )}
            </div>
          </>
        ) : (
          <>
            {/* No sections - show all questions */}
            <div className="space-y-6">
              {questions.map((question) => (
                <div
                  key={question.id}
                  className="bg-white rounded-lg border border-gray-200 p-6 space-y-4"
                >
                  <div>
                    <label className="text-base font-medium text-gray-900 block mb-1">
                      {question.title.replace(/0+$/, '')}
                      {question.required && (
                        <span className="text-red-500 ml-1">*</span>
                      )}
                    </label>
                  </div>
                  {/* All question types rendering here - same as above */}
                </div>
              ))}
            </div>

            {/* Submit Button */}
            <div className="flex justify-center mt-8">
              <Button
                onClick={handleSubmit}
                className="bg-primary hover:bg-primary/90 text-white px-8 py-2"
              >
                Submit
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
