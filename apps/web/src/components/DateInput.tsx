import type { DateOnly } from '@kompas/domain';

/** Calendar date input — the value is a DateOnly string (stored as 00:00 Europe/Warsaw by the codec). */
export function DateInput({
  id,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  id?: string;
  value: DateOnly | null;
  onChange: (d: DateOnly | null) => void;
  disabled?: boolean;
  min?: DateOnly | null;
  max?: DateOnly | null;
}) {
  return (
    <input
      id={id}
      type="date"
      className="input mono max-w-[220px]"
      value={value ?? ''}
      min={min ?? undefined}
      max={max ?? undefined}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value || null)}
    />
  );
}
