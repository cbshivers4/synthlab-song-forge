import { useEffect } from 'react';
import { toast } from 'sonner';
import { useStudio } from '@/lib/synclab/store';
import { useApp } from '@/lib/synclab/app-state';
import { usePlan } from '@/lib/synclab/plan';
import { useIsMobile } from '@/hooks/use-mobile';
import { saveCloudProject } from '@/lib/synclab/cloud';
import { QWERTY_MAP, qwertyEnabled, qwertyOctave, setQwertyEnabled, setQwertyOctave } from '@/lib/synclab/qwerty';
import { matchShortcut } from '@/lib/synclab/shortcuts';
import { songSteps } from '@/lib/synclab/timebase';
import { deleteRegion } from '@/lib/synclab/note-cuts';
import { selectedClip, selectedPartBounds } from '@/lib/synclab/workflow';

export function openShortcutSettings() {
  sessionStorage.setItem('synclab.settings.shortcuts', 'open');
  window.dispatchEvent(new Event('synclab:shortcuts-settings'));
  requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('synclab:shortcuts-settings'))));
}
export function useShortcuts() {
  const studio = useStudio();
  const { project, setProject } = useApp();
  const { requirePro } = usePlan();
  const isMobile = useIsMobile();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (e.defaultPrevented || e.isComposing || el?.isContentEditable || el?.closest('input, textarea, select, [role="slider"], [role="spinbutton"], [role="tablist"], [role="menu"], [role="listbox"], [role="dialog"], [role="alertdialog"]') || document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      if (e.key === ' ' && el?.closest('button, [role="button"], [role="checkbox"], [role="switch"]')) return;
      const { selected, tracks, transport } = studio;
      if (!e.ctrlKey && !e.metaKey && !e.altKey && qwertyEnabled()) {
        const playable = (t: typeof selected) => t && ['instrument', 'midi', 'sampler'].includes(t.kind);
        const target = tracks.find((t) => t.armed && playable(t)) ?? (playable(selected) ? selected : null);
        const key = e.key.toLowerCase();
        const offset = QWERTY_MAP[key];
        if (target && (offset != null || key === 'z' || key === 'x')) {
          e.preventDefault();
          if (e.repeat) return;
          if (key === 'z' || key === 'x') setQwertyOctave(qwertyOctave() + (key === 'z' ? -1 : 1));
          else if (offset != null) studio.previewNote(target.id, (qwertyOctave() + 1) * 12 + offset);
          return;
        }
      }
      const action = matchShortcut(e);
      if (!action) return;
      e.preventDefault();
      const changeTrack = (patch: Parameters<typeof studio.updateTrack>[1]) => {
        if (selected) studio.updateTrack(selected.id, patch);
        else toast('Select a track first');
      };
      const move = (amount: number) => studio.setTransport({ step: Math.max(0, Math.min(songSteps(transport.bars) - 1, transport.step + amount)) });
      switch (action) {
        case 'play': studio.togglePlay(); break;
        case 'stop': void studio.stop(); break;
        case 'record': studio.toggleRecord(); break;
        case 'loop': studio.setTransport({ loop: !transport.loop }); break;
        case 'click': studio.setTransport({ metronome: !transport.metronome }); break;
        case 'follow': studio.setTransport({ follow: !transport.follow }); break;
        case 'home': studio.setTransport({ step: 0 }); break;
        case 'end': studio.setTransport({ step: songSteps(transport.bars) - 1 }); break;
        case 'left': move(-4); break;
        case 'right': move(4); break;
        case 'leftStep': move(-1); break;
        case 'rightStep': move(1); break;
        case 'undo': studio.undo(); break;
        case 'redo': studio.redo(); break;
        case 'save':
          if (!isMobile) document.dispatchEvent(new Event('synclab:cloud-save'));
          else if (project && requirePro('Cloud saving')) {
            const id = toast.loading('Saving project and audio…');
            void (async () => {
              // Finalize any in-progress take first, so the save includes it.
              if (transport.recording) await studio.stop();
              const session = studio.snapshot();
              const saved = await saveCloudProject({ ...project, id: project.id ?? '' }, session);
              setProject({ ...project, id: saved.id, openedAt: Date.now() });
              document.dispatchEvent(new CustomEvent('synclab:project-saved', { detail: session }));
              toast.success('Project saved to your cloud', { id });
            })().catch((error: unknown) => toast.error(error instanceof Error ? error.message : 'Cloud save failed', { id }));
          }
          break;
        case 'duplicate': if (selected) studio.duplicateTrack(selected.id); break;
        case 'copy': case 'cut': {
          if (!selected) break;
          const clip = selectedClip(selected);
          if (clip) (action === 'copy' ? studio.copyClip : studio.cutClip)(selected.id, clip.id);
          else (action === 'copy' ? studio.copyTrack : studio.cutTrack)(selected.id);
          break;
        }
        case 'paste': if (studio.clipClipboardName) studio.pasteClip(); else studio.pasteTrack(); break;
        case 'selectAll': studio.selectAll(); break;
        case 'delete': {
          if (!selected) break;
          const clip = selectedClip(selected);
          const part = selectedPartBounds(selected, transport.bpm, transport.bars);
          if (clip) studio.removeClip(selected.id, clip.id);
          else if (part) studio.updateTrack(selected.id, {
            notes: deleteRegion(selected.notes ?? [], part), activeRegion: undefined,
            ...(selected.pads ? { pads: selected.pads.map((pad) => ({ ...pad, steps: pad.steps.map((value, index) => {
              const length = Math.max(1, pad.steps.length);
              const first = index + Math.max(0, Math.ceil((part[0] - index) / length)) * length;
              return first < part[1] ? 0 : value;
            }) })) } : {}),
          });
          else studio.removeTrack(selected.id);
          break;
        }
        case 'split': studio.splitAtPlayhead(); break;
        case 'quantize': window.dispatchEvent(new Event('synclab:quantize')); break;
        case 'arm': if (!transport.recording && transport.countInLeft == null) changeTrack({ armed: !selected?.armed }); break;
        case 'mute': changeTrack({ muted: !selected?.muted }); break;
        case 'solo': changeTrack({ solo: !selected?.solo }); break;
        case 'selectTool': studio.setEditTool('select'); break;
        case 'drawTool': studio.setEditTool('draw'); break;
        case 'splitTool': studio.setEditTool('split'); break;
        case 'razorTool': studio.setEditTool('razor'); break;
        case 'typing': setQwertyEnabled(!qwertyEnabled()); toast(qwertyEnabled() ? 'Computer keyboard notes on' : 'Computer keyboard notes off'); break;
        case 'shortcuts': openShortcutSettings(); studio.setPanel('settings'); break;
        case 'instrument': studio.setPanel(selected?.kind === 'drum' ? 'drums' : selected?.kind === 'sampler' ? 'sampler' : 'synth'); break;
        case 'closePanel': studio.setPanel(null); break;
        default: studio.setPanel(action); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studio, project, setProject, requirePro, isMobile]);
}
