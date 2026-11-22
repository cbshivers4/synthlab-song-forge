import { useState } from "react";
import { CloudUpload, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { getTapeMedia, useTapeMedia } from "@/lib/synclab/tape-media";
import { needsSave, type ShelfKind, type StoredInfo } from "@/lib/synclab/tape-media-model";

const NOUN: Record<ShelfKind, string> = { reel: "reel", cassette: "cassette", cd: "CD" };

/** Save a reel, cassette or CD (its name and recordings) to the account. */
export function SaveToAccountButton({
  kind,
  item,
  disabled,
  className = "h-11",
}: {
  kind: ShelfKind;
  item: { id: string; store?: StoredInfo };
  disabled?: boolean;
  className?: string;
}) {
  const { shelf } = useTapeMedia();
  const saving = shelf.saving?.id === item.id ? shelf.saving : null;
  const dirty = needsSave(item);
  return (
    <Button
      className={className}
      variant={dirty ? "default" : "secondary"}
      disabled={disabled || !!shelf.saving || !dirty}
      onClick={() => void getTapeMedia().saveItem(kind, item.id)}
      title={`Keep this ${NOUN[kind]} in your account, on every device you sign in on`}
    >
      {saving ? <CloudUpload /> : dirty ? <CloudUpload /> : <Check />}
      {saving
        ? `Saving… ${Math.round(saving.progress * 100)}%`
        : !dirty
          ? "Saved"
          : item.store
            ? "Save changes"
            : `Save ${NOUN[kind]}`}
    </Button>
  );
}

/** Remove from the shelf; saved items ask first, because they are deleted from the account. */
export function DeleteFromShelfButton({
  kind,
  item,
  name,
  disabled,
  onDeleted,
  compact,
}: {
  kind: ShelfKind;
  item: { id: string; store?: StoredInfo };
  name: string;
  disabled?: boolean;
  onDeleted?: () => void;
  compact?: boolean;
}) {
  const [asking, setAsking] = useState(false);
  const remove = async () => {
    if (await getTapeMedia().deleteItem(kind, item.id)) onDeleted?.();
  };
  const label = item.store ? `Delete ${name} from your account` : `Remove ${name} from the shelf`;
  return (
    <>
      {compact ? (
        <button
          type="button"
          className="cd-slot-remove"
          aria-label={label}
          disabled={disabled}
          onClick={() => (item.store ? setAsking(true) : void remove())}
        >
          <Trash2 className="size-3.5" />
        </button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label={label}
          title={label}
          disabled={disabled}
          onClick={() => (item.store ? setAsking(true) : void remove())}
        >
          <Trash2 />
        </Button>
      )}
      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This {NOUN[kind]} and its recordings are deleted from your account on every device.
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => void remove()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
