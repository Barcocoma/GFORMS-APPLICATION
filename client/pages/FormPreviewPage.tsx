import { useLocation, useNavigate } from "react-router-dom";
import { FormPreview } from "@/components/forms/FormPreview";
import { Question, Section } from "@/components/forms/FormEditor";

export default function FormPreviewPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state as {
    title: string;
    description: string;
    questions: Question[];
    sections?: Section[];
    formId?: string;
    editMode?: boolean;
  } | null;

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            No form data
          </h1>
          <p className="text-gray-600 mb-4">Please go back and open a form</p>
          <button
            onClick={() => navigate("/create")}
            className="text-primary hover:text-primary/90 underline"
          >
            Go back to form editor
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    if (state?.formId && state?.editMode) {
      // If editing an existing form, navigate back to edit page with formId
      navigate(`/create?edit=${state.formId}`, { 
        state: {
          title: state.title,
          description: state.description,
          questions: state.questions,
          sections: state.sections,
        }
      });
    } else {
      // If creating a new form, navigate back to create page with form data
      navigate("/create", { state });
    }
  };

  return (
    <FormPreview
      title={state.title}
      description={state.description}
      questions={state.questions}
      sections={state.sections}
      onBack={handleBack}
    />
  );
}
