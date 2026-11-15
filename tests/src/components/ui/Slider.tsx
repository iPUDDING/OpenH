import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '@/lib/utils';

interface SliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  className?: string;
  disabled?: boolean;
}

export function Slider({ value, onValueChange, min, max, step = 1, label, className, disabled }: SliderProps) {
  return (
    <SliderPrimitive.Root
      className={cn('relative flex h-5 w-full touch-none select-none items-center', className)}
      value={[value]}
      onValueChange={([next]) => onValueChange(next)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={label}
    >
      <SliderPrimitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-secondary">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-4 w-4 rounded-full border-2 border-primary bg-background shadow transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none" />
    </SliderPrimitive.Root>
  );
}
