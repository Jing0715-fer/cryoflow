// Task 92 — the staging step shared by every import form.
//
// Task 86 built the parse funnel (parseWorkflowFiles) and left the
// post-parse choreography (all-invalid → destructive toast with the first
// parse error; otherwise hand the queue to the preview dialog) duplicated
// in its two callers. Task 92 adds a third form (canvas file drop), which
// is exactly the moment a three-copy choreography would start disagreeing
// with itself — extract first, then add the form.
//
// Forms, one contract:
//   1. canvas file input      (Task 86, canvas.tsx)
//   2. palette dynamic input  (Task 86, command-palette.tsx)
//   3. canvas file drop       (Task 92, drop-import.tsx)
//
// Returns true when the preview dialog was opened (≥1 valid file);
// false when every file failed client-side parsing (destructive toast
// fired, dialog stays closed, nothing POSTed).
import { toast } from "@/hooks/use-toast";
import { parseWorkflowFiles } from "@/lib/workflow-io";
import { useWorkflowStore } from "@/lib/store";

export async function stageWorkflowFiles(files: File[]): Promise<boolean> {
  const { entries, failures } = await parseWorkflowFiles(files);
  if (entries.length === 0) {
    toast({
      title: "Import failed",
      description: failures[0]?.error ?? "No readable workflow files",
      variant: "destructive",
    });
    return false;
  }
  // NOT imported here — the preview dialog (mounted once in page.tsx)
  // takes over: file queue + target-workspace picker before any POST.
  useWorkflowStore.getState().openImportPreview(entries, failures);
  return true;
}
