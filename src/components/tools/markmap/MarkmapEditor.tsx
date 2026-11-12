import { useEffect, useRef } from 'react';
import { basicSetup } from 'codemirror';
import { EditorView, placeholder } from '@codemirror/view';
import { Compartment, EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { oneDark } from '@codemirror/theme-one-dark';
import { useAppStore } from '@/store/useAppStore';

interface MarkmapEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function systemIsDark(theme: 'light' | 'dark' | 'system'): boolean {
  return theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

export function MarkmapEditor({ value, onChange }: MarkmapEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const compartmentRef = useRef(new Compartment());
  const onChangeRef = useRef(onChange);
  const theme = useAppStore((state) => state.theme);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          markdown(),
          placeholder('# Título\n\n## Rama principal\n\n- Idea'),
          EditorView.lineWrapping,
          compartmentRef.current.of(systemIsDark(theme) ? oneDark : []),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
          EditorView.theme({
            '&': { height: '100%' },
            '.cm-content': { padding: '16px 0', caretColor: 'hsl(var(--primary))' },
            '.cm-scroller': { overflow: 'auto' },
          }),
        ],
      }),
      parent: containerRef.current,
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // El editor solo se crea una vez; valor y tema se sincronizan por separado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartmentRef.current.reconfigure(systemIsDark(theme) ? oneDark : []),
    });
  }, [theme]);

  return <div ref={containerRef} className="h-full min-h-0 overflow-hidden" aria-label="Editor CodeMirror del mapa mental" />;
}
