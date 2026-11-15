import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Play } from 'lucide-react';

interface ReaderContextMenuProps {
  x: number;
  y: number;
  onReadFromHere: () => void;
  onClose: () => void;
}

/**
 * Menú contextual del visor (clic derecho sobre el documento) con la acción
 * "Empezar lectura desde aquí". Se renderiza en un portal para no recortarse
 * con los contenedores con scroll y se cierra con clic exterior, Escape,
 * scroll o cambio de tamaño de ventana.
 */
export function ReaderContextMenu({ x, y, onReadFromHere, onClose }: ReaderContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  // Mantiene el menú dentro de la ventana tras medirlo.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
    menu.querySelector<HTMLButtonElement>('button')?.focus();
  }, [x, y]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onScroll = () => onClose();
    const onResize = () => onClose();
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Menú de lectura"
      className="fixed z-[100] min-w-56 rounded-md border bg-popover p-1 shadow-lg"
      style={{ left: position.left, top: position.top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground focus-visible:outline-none"
        onClick={() => {
          onReadFromHere();
          onClose();
        }}
      >
        <Play className="h-4 w-4 shrink-0" />
        Empezar lectura desde aquí
      </button>
    </div>,
    document.body,
  );
}
