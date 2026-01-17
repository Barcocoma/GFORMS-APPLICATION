import { FormEditor, TemplateType } from "@/components/forms/FormEditor";
import { useSearchParams } from "react-router-dom";

export default function CreateForm() {
  const [searchParams] = useSearchParams();
  const editFormId = searchParams.get("edit");
  const templateParam = searchParams.get("template") as TemplateType | null;

  return <FormEditor formId={editFormId || undefined} template={templateParam ?? undefined} />;
}
