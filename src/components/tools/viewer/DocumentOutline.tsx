import { useEffect, useState } from 'react';
import { ListTree } from 'lucide-react';
import type { DocumentHeading } from '@/lib/headings';
import { cn } from '@/lib/utils';

export function DocumentOutline({ headings }: { headings: DocumentHeading[] }) {
  const [active, setActive] = useState(headings[0]?.id ?? '');

  useEffect(() => setActive(headings[0]?.id ?? ''), [headings]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]?.target.id) setActive(visible[0].target.id);
    }, { rootMargin: '-8% 0px -72% 0px', threshold: 0 });
    for (const heading of headings) {
      const element = document.getElementById(heading.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [headings]);

  const goTo = (heading: DocumentHeading) => {
    setActive(heading.id);
    document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <aside className="hidden w-56 shrink-0 overflow-y-auto border-r bg-muted/20 p-3 md:block" aria-label="Índice del documento">
      <div className="mb-3 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><ListTree className="h-3.5 w-3.5" />Índice</div>
      <nav className="space-y-0.5">
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => goTo(heading)}
            className={cn('block w-full truncate rounded-md px-2 py-1.5 text-left text-xs leading-5 transition hover:bg-accent', active === heading.id ? 'bg-primary/10 font-medium text-primary' : 'text-muted-foreground')}
            style={{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }}
            title={heading.text}
          >
            {heading.text}
          </button>
        ))}
      </nav>
    </aside>
  );
}
