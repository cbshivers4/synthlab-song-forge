import {
  ChevronRight,
  FilePlus2,
  Folder,
  FolderOpen,
  Music2,
  Play,
  Search,
  Square,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addLocalFolder,
  forgetRememberedFolder,
  getLocalFolders,
  onFoldersChange,
  onPreviewChange,
  pickFiles,
  pickFolder,
  playPreview,
  reconnectFolder,
  rememberedFolders,
  restoreGrantedFolders,
  removeLocalFolder,
  stopPreview,
  type LocalFile,
  type LocalFolder,
  type RememberedFolder,
} from "@/lib/synclab/local-files";

/* ---------- Studio One-style file browser: breadcrumb + folder tree + file list ---------- */
type DirNode = { name: string; path: string; dirs: DirNode[]; files: LocalFile[] };

function buildTree(files: LocalFile[]): DirNode {
  const root: DirNode = { name: "", path: "", dirs: [], files: [] };
  const nodes = new Map<string, DirNode>([["", root]]);
  const ensure = (path: string): DirNode => {
    const found = nodes.get(path);
    if (found) return found;
    const parentPath = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
    const node: DirNode = {
      name: path.slice(parentPath ? parentPath.length + 1 : 0),
      path,
      dirs: [],
      files: [],
    };
    nodes.set(path, node);
    ensure(parentPath).dirs.push(node);
    return node;
  };
  for (const f of files) {
    const dirPath = f.path.includes("/") ? f.path.slice(0, f.path.lastIndexOf("/")) : "";
    ensure(dirPath).files.push(f);
  }
  for (const n of nodes.values()) {
    n.dirs.sort((a, b) => a.name.localeCompare(b.name));
    n.files.sort((a, b) => a.name.localeCompare(b.name));
  }
  return root;
}

function nodeAt(root: DirNode, path: string): DirNode {
  let node = root;
  if (!path) return node;
  for (const part of path.split("/")) {
    const next = node.dirs.find((d) => d.name === part);
    if (!next) return root;
    node = next;
  }
  return node;
}

const fileSize = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

function FolderBrowser({
  folder,
  playingFile,
  query,
}: {
  folder: LocalFolder;
  playingFile: string | null;
  query: string;
}) {
  const [dir, setDir] = useState("");
  const tree = useMemo(() => buildTree(folder.files), [folder.files]);
  const node = nodeAt(tree, dir);
  const crumbs = dir ? dir.split("/") : [];
  const matches = query ? folder.files.filter((f) => f.name.toLowerCase().includes(query)) : null;

  const fileRow = (x: LocalFile) => {
    const playing = playingFile === x.id;
    return (
      <div
        key={x.id}
        draggable
        onDragStart={(e) => {
          const payload = JSON.stringify({ type: "localfile", id: x.id, name: x.name });
          e.dataTransfer.setData("application/synclab", payload);
          e.dataTransfer.setData("text/plain", payload);
          e.dataTransfer.effectAllowed = "copy";
        }}
        title={`${x.path} — drag onto the timeline`}
        className={`group flex cursor-grab items-center gap-1.5 rounded-[3px] px-1.5 py-1 active:cursor-grabbing ${playing ? "bg-primary/15" : "hover:bg-surface-2"}`}
      >
        <button
          type="button"
          aria-label={playing ? `Stop ${x.name}` : `Play ${x.name}`}
          onClick={() =>
            playing
              ? stopPreview()
              : void playPreview(x.id).catch(() =>
                  toast.error(`Can't play ${x.name}`, {
                    description: "This browser can't decode that file type.",
                  }),
                )
          }
          className="grid size-5 shrink-0 place-items-center rounded-sm border border-border text-primary hover:border-primary"
        >
          {playing ? (
            <Square className="size-2.5 fill-current" />
          ) : (
            <Play className="size-2.5 fill-current" />
          )}
        </button>
        <Music2 className="size-3.5 shrink-0 text-primary/70" />
        <span className="min-w-0 flex-1 truncate text-[11px]">
          {x.name.replace(/\.[^.]+$/, "")}
        </span>
        <span className="shrink-0 font-mono text-[8px] text-muted-foreground/60">
          {fileSize(x.size)}
        </span>
      </div>
    );
  };

  return (
    <div className="overflow-hidden rounded-[3px] border border-border/60 bg-surface-1/40">
      {/* Breadcrumb trail, like Files › Desktop › my songs */}
      <div className="flex items-center gap-0.5 border-b border-border/60 px-1.5 py-1">
        <FolderOpen className="size-3 shrink-0 text-amber-400" />
        <button
          type="button"
          onClick={() => setDir("")}
          className={`max-w-24 truncate font-mono text-[9px] font-bold uppercase tracking-wider ${crumbs.length ? "text-muted-foreground hover:text-foreground" : "text-foreground"}`}
        >
          {folder.name}
        </button>
        {crumbs.map((c, i) => (
          <span key={i} className="flex min-w-0 items-center gap-0.5">
            <ChevronRight className="size-2.5 shrink-0 text-muted-foreground/50" />
            <button
              type="button"
              onClick={() => setDir(crumbs.slice(0, i + 1).join("/"))}
              className={`max-w-20 truncate font-mono text-[9px] font-bold uppercase tracking-wider ${i === crumbs.length - 1 ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {c}
            </button>
          </span>
        ))}
        <button
          type="button"
          aria-label={`Close ${folder.name}`}
          title="Close this folder"
          onClick={() => removeLocalFolder(folder.id)}
          className="ml-auto shrink-0 px-1 text-muted-foreground/60 hover:text-foreground"
        >
          ×
        </button>
      </div>
      <div className="max-h-56 overflow-y-auto p-0.5">
        {matches ? (
          matches.length ? (
            matches.map(fileRow)
          ) : (
            <p className="px-2 py-1.5 text-[10px] text-muted-foreground/70">
              No files match “{query}”.
            </p>
          )
        ) : (
          <>
            {node.dirs.map((d) => (
              <button
                key={d.path}
                type="button"
                onClick={() => setDir(d.path)}
                className="flex w-full items-center gap-1.5 rounded-[3px] px-1.5 py-1 text-left text-[11px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" />
                <Folder className="size-3.5 shrink-0 text-amber-400" />
                <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
              </button>
            ))}
            {node.files.map(fileRow)}
            {node.dirs.length === 0 && node.files.length === 0 && (
              <p className="px-2 py-1.5 text-[10px] text-muted-foreground/70">Empty folder.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** "My Computer" file list shared by the desktop left menu and the phone/narrow navigation bar. */
export function ComputerFiles() {
  const [folders, setFolders] = useState(getLocalFolders);
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const [fileQuery, setFileQuery] = useState("");
  const [remembered, setRemembered] = useState<RememberedFolder[]>([]);
  useEffect(() => {
    const refresh = () => {
      setFolders(getLocalFolders());
      void rememberedFolders().then(setRemembered);
    };
    refresh();
    void restoreGrantedFolders().then(refresh);
    return onFoldersChange(refresh);
  }, []);
  useEffect(() => onPreviewChange(setPlayingFile), []);
  const openComputerFiles = async () => {
    const f = await pickFiles();
    if (!f) return;
    addLocalFolder(f);
  };
  const reopen = async (r: RememberedFolder) => {
    try {
      await reconnectFolder(r.id);
    } catch (err) {
      toast.error(`Couldn't reopen ${r.name}`, {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
  const openComputerFolder = async () => {
    try {
      const f = await pickFolder();
      if (!f) return;
      if (f.files.length === 0) {
        toast("No audio files in that folder", {
          description: "Looking for WAV, MP3, AIFF, FLAC, OGG and M4A.",
        });
        return;
      }
      addLocalFolder(f);
      toast.success(`${f.name}: ${f.files.length} audio file${f.files.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Couldn't open that folder", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };
  return (
    <div className="pt-1.5">
      <div className="flex items-center gap-0.5 px-1.5 pb-1">
        <span className="min-w-0 flex-1 font-mono text-[9px] tracking-[0.18em] text-muted-foreground/70">
          MY COMPUTER
        </span>
        <button
          type="button"
          title="Open a folder from your computer"
          aria-label="Open a folder from your computer"
          onClick={() => void openComputerFolder()}
          className="rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-primary"
        >
          <FolderOpen className="size-3.5" />
        </button>
        <button
          type="button"
          title="Add individual audio files"
          aria-label="Add individual audio files"
          onClick={() => void openComputerFiles()}
          className="rounded-[3px] p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-primary"
        >
          <FilePlus2 className="size-3.5" />
        </button>
      </div>
      {(folders.length > 0 || remembered.length > 0) && (
        <div className="mx-1.5 mb-1 flex items-center gap-1.5 rounded-[3px] border border-border/60 bg-surface-1/60 px-1.5">
          <Search className="size-3 shrink-0 text-muted-foreground/60" />
          <input
            value={fileQuery}
            onChange={(e) => setFileQuery(e.target.value)}
            placeholder="Search files"
            aria-label="Search your files"
            className="h-6 min-w-0 flex-1 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/50"
          />
        </div>
      )}
      {remembered.map((r) => (
        <div key={r.id} className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
          <FolderOpen className="size-3.5 shrink-0 opacity-60" />
          <button
            type="button"
            onClick={() => void reopen(r)}
            title="Allow access again and list its files"
            className="min-w-0 flex-1 truncate text-left hover:text-foreground"
          >
            {r.name}
          </button>
          <button
            type="button"
            aria-label={`Forget ${r.name}`}
            onClick={() =>
              void forgetRememberedFolder(r.id).then(() => rememberedFolders().then(setRemembered))
            }
            className="px-1 hover:text-foreground"
          >
            ×
          </button>
        </div>
      ))}
      {folders.length === 0 && remembered.length === 0 ? (
        <button
          type="button"
          onClick={() => void openComputerFolder()}
          className="flex w-full items-center gap-2 rounded-[3px] px-2 py-1.5 text-left text-xs text-primary transition-colors hover:bg-surface-2"
        >
          <FolderOpen className="size-3.5 shrink-0" />
          <span className="font-medium tracking-wide">Choose your music</span>
        </button>
      ) : (
        <div className="space-y-1 px-0.5">
          {folders.map((f) => (
            <FolderBrowser
              key={f.id}
              folder={f}
              playingFile={playingFile}
              query={fileQuery.trim().toLowerCase()}
            />
          ))}
        </div>
      )}
    </div>
  );
}
