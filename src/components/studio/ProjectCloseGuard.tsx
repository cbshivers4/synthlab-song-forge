import { useEffect, useRef, useState } from "react";
import { consumeTakeFailure, TakeNotKeptError } from "@/lib/synclab/take-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useApp, type Stage } from "@/lib/synclab/app-state";
import { useStudio } from "@/lib/synclab/store";
import { usePlan } from "@/lib/synclab/plan";
import { saveCloudProject, type CloudSession } from "@/lib/synclab/cloud";
import {
  completeProjectClose,
  needsSavePrompt,
  projectFingerprint,
} from "@/lib/synclab/project-close";
import { toast } from "sonner";

export function ProjectCloseGuard() {
  const { stage, project, setProject } = useApp();
  const { snapshot, stop, transport } = useStudio();
  const { requirePro } = usePlan();
  const baseline = useRef("");
  const [pending, setPending] = useState<{ proceed: () => void } | null>(null);
  const [saving, setSaving] = useState(false);
  const latest = useRef({ snapshot, transport });
  latest.current = { snapshot, transport };

  useEffect(() => {
    if (stage === "studio") baseline.current = projectFingerprint(latest.current.snapshot());
  }, [stage]);

  useEffect(() => {
    const onSaved = (event: Event) => {
      const session = (event as CustomEvent<CloudSession>).detail;
      baseline.current = projectFingerprint(session ?? latest.current.snapshot());
    };
    document.addEventListener("synclab:project-saved", onSaved);
    return () => document.removeEventListener("synclab:project-saved", onSaved);
  }, []);

  useEffect(() => {
    const onLeave = (event: Event) => {
      if (stage !== "studio") return;
      const current = projectFingerprint(latest.current.snapshot());
      if (
        !needsSavePrompt(project?.id, baseline.current, current, latest.current.transport.recording)
      ) {
        void stop();
        return;
      }
      event.preventDefault();
      const { proceed } = (event as CustomEvent<{ next: Stage; proceed: () => void }>).detail;
      setPending({ proceed });
    };
    document.addEventListener("synclab:before-project-close", onLeave);
    return () => document.removeEventListener("synclab:before-project-close", onLeave);
  }, [stage, project?.id, stop]);

  const saveAndClose = async () => {
    if (!pending || !project || saving || !requirePro("Cloud saving")) return;
    setSaving(true);
    try {
      await completeProjectClose(
        async () => {
          consumeTakeFailure();
          await stop();
          if (consumeTakeFailure()) throw new TakeNotKeptError();
          // Let React publish the completed recording into the snapshot refs.
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          );
          const session = latest.current.snapshot();
          const saved = await saveCloudProject({ ...project, id: project.id ?? "" }, session);
          setProject({ ...project, id: saved.id, openedAt: Date.now() });
          document.dispatchEvent(new CustomEvent("synclab:project-saved", { detail: session }));
          toast.success("Project saved");
          return true;
        },
        () => {
          setPending(null);
          pending.proceed();
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not save project. Your project is still open.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open && !saving) setPending(null);
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onEscapeKeyDown={(event) => {
          if (saving) event.preventDefault();
        }}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Do you want to save your project?</DialogTitle>
          <DialogDescription>
            “{project?.name ?? "Untitled project"}” has unsaved changes. Closing without saving will
            discard them.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="ghost" disabled={saving} onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={saving}
            onClick={async () => {
              const action = pending;
              if (!action) return;
              setSaving(true);
              await stop();
              setPending(null);
              setSaving(false);
              action.proceed();
            }}
          >
            Don’t save
          </Button>
          <Button disabled={saving} onClick={() => void saveAndClose()}>
            {saving ? "Saving…" : "Save project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
