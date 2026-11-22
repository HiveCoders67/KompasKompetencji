import { RequiredMark } from './ui';
/** Text field of the form; shows the AI-draft label until the first manual edit (schema: texts.*AiDraft). */
export function AiTextField({
  id,
  label,
  required,
  value,
  aiDraft,
  disabled,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  required?: boolean;
  value: string | null;
  aiDraft: boolean;
  disabled: boolean;
  hint?: string;
  onChange: (v: string | null) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-s3">
        <label htmlFor={id} className="label !mb-0">
          {label}
          {required && <RequiredMark />}
        </label>
        {aiDraft && <span className="badge badge-warning">Szkic wygenerowany przez AI — wymaga weryfikacji</span>}
      </div>
      <textarea id={id} className="textarea" rows={5} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value || null)} />
      {hint && <p className="hint mt-1">{hint}</p>}
    </div>
  );
}
