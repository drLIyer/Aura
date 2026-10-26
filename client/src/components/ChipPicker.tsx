import { Badge } from "@/components/ui/badge";

interface Option {
  id: string;
  label: string;
}

interface ChipPickerProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  testId?: string;
}

/** Multi-select as tappable chips — fast to use during an attack or on a phone. */
export default function ChipPicker({ options, value, onChange, testId }: ChipPickerProps) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {options.map((o) => (
        <Badge
          key={o.id}
          role="checkbox"
          aria-checked={value.includes(o.id)}
          tabIndex={0}
          variant={value.includes(o.id) ? "default" : "outline"}
          className="cursor-pointer select-none py-1"
          onClick={() => toggle(o.id)}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              toggle(o.id);
            }
          }}
        >
          {o.label}
        </Badge>
      ))}
    </div>
  );
}
