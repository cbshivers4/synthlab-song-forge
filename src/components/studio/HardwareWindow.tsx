import { useEffect, useRef, useState, type ReactNode, type PointerEvent } from 'react';
import { Move, Maximize2, PanelBottom, Grip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canvasPoint, canvasRect, sidewaysCanvas } from '@/lib/synclab/canvas-point';
import { fitWindow, type WindowBounds } from '@/lib/synclab/window-bounds';

const remembered = new Map<string, WindowBounds>();
const viewport = () => sidewaysCanvas() ? { w: window.innerHeight, h: window.innerWidth } : { w: window.innerWidth, h: window.innerHeight };

/** Move/resize the same mounted editor, never a second instrument or audio owner. */
export function HardwareWindow({ id, enabled, children }: { id: string; enabled: boolean; children: (controls: ReactNode) => ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [bounds, setBounds] = useState<WindowBounds | null>(null);
  const [moving, setMoving] = useState(false);
  const drag = useRef<{ mode: 'move' | 'size'; point: { x: number; y: number }; bounds: WindowBounds } | null>(null);
  useEffect(() => { setBounds(null); }, [id]);
  useEffect(() => {
    const resize = () => setBounds(b => b ? fitWindow(b, viewport()) : null);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const float = () => {
    const box = ref.current ? canvasRect(ref.current) : null;
    const size = viewport();
    const next = fitWindow(remembered.get(id) ?? { x: 40, y: 40, w: Math.min(box?.width ?? 960, size.w - 80), h: Math.min(box?.height ?? 600, 680, size.h - 80) }, size);
    setBounds(next);
    return next;
  };
  const start = (e: PointerEvent<HTMLElement>, mode: 'move' | 'size') => {
    if (!enabled || e.button !== 0) return;
    if (mode === 'move') {
      const target = e.target;
      if (!(target instanceof Element) || !target.closest('.editor-panel-header') || target.closest('button,input,select,a,[role="button"]')) return;
    }
    e.preventDefault();
    const current = bounds ?? float();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, point: canvasPoint(e.clientX, e.clientY), bounds: current };
    setMoving(true);
  };
  const move = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const point = canvasPoint(e.clientX, e.clientY);
    const dx = point.x - d.point.x, dy = point.y - d.point.y;
    const next = fitWindow(d.mode === 'move' ? { ...d.bounds, x: d.bounds.x + dx, y: d.bounds.y + dy } : { ...d.bounds, w: d.bounds.w + dx, h: d.bounds.h + dy }, viewport());
    setBounds(next);
    remembered.set(id, next);
  };
  const end = () => { drag.current = null; setMoving(false); };
  const controls = enabled && <>
    <Button size="icon" variant="ghost" className="hardware-window-control" aria-label={bounds ? 'Dock hardware window' : 'Float hardware window'} title={bounds ? 'Dock hardware window' : 'Float hardware window'} onClick={() => bounds ? setBounds(null) : float()}>{bounds ? <PanelBottom className="size-4" /> : <Move className="size-4" />}</Button>
    {bounds && <Button size="icon" variant="ghost" className="hardware-window-control" aria-label="Fit hardware window to screen" title="Fit to screen" onClick={() => setBounds(fitWindow({ x: 0, y: 0, ...viewport() }, viewport()))}><Maximize2 className="size-4" /></Button>}
  </>;
  return <section ref={ref} data-hardware-window={enabled || undefined} data-floating={!!bounds} data-moving={moving} aria-label={`${id} hardware window`} className="phone-tool-panel rack hardware-window fixed inset-0 z-40 flex min-w-0 flex-col overflow-x-hidden border-t-2 border-border sm:relative sm:inset-auto sm:z-auto sm:min-h-[240px]" style={bounds ? { '--hardware-window-x': `${bounds.x}px`, '--hardware-window-y': `${bounds.y}px`, '--hardware-window-w': `${bounds.w}px`, '--hardware-window-h': `${bounds.h}px` } as React.CSSProperties : undefined} onPointerDown={e => start(e, 'move')} onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
    {children(controls)}
    {bounds && <Button variant="ghost" size="icon" className="hardware-window-resize" aria-label="Resize hardware window" title="Drag to resize" onPointerDown={e => { e.stopPropagation(); start(e, 'size'); }}><Grip className="size-5" /></Button>}
  </section>;
}