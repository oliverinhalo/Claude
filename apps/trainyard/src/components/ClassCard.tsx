import { MAX_SAMPLES, MIN_CLASSES, MIN_TO_TRAIN, type ClassData } from '../lib/dataset';

interface Props {
  data: ClassData;
  index: number;
  selected: boolean;
  recording: boolean;
  classCount: number;
  thumbs: string[];
  onSelect: () => void;
  onRename: (name: string) => void;
  onRemove: () => void;
  onClear: () => void;
}

export function ClassCard({
  data,
  index,
  selected,
  recording,
  classCount,
  thumbs,
  onSelect,
  onRename,
  onRemove,
  onClear,
}: Props) {
  const n = data.samples.length;
  const need = Math.max(0, MIN_TO_TRAIN - n);
  return (
    <li
      className="panel p-3"
      style={{
        ['--lamp' as string]: `var(--k-${index})`,
        borderColor: selected ? 'var(--lamp)' : undefined,
        boxShadow: selected ? '0 0 0 1px var(--lamp)' : undefined,
      }}
      data-testid="class-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="lamp" aria-hidden="true" />
        <input
          className="name-input"
          value={data.name}
          maxLength={40}
          aria-label={`Name of class ${index + 1}`}
          onChange={(e) => onRename(e.target.value)}
          onBlur={(e) => !e.target.value.trim() && onRename(`Class ${index + 1}`)}
        />
        <button
          type="button"
          className={`btn btn-sm ${selected ? 'btn-primary' : ''}`}
          aria-pressed={selected}
          onClick={onSelect}
          aria-label={`${selected ? 'Selected:' : 'Select'} ${data.name}`}
        >
          {selected ? (recording ? 'Recording…' : 'Selected') : 'Select'}
        </button>
      </div>

      <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
        <div className="thumbs" aria-hidden="true">
          {thumbs.slice(-8).map((src, i) => (
            <img key={`${i}-${src.length}`} src={src} alt="" />
          ))}
        </div>
        <p className="tnum shrink-0 text-sm text-[var(--text-muted)]" role="status">
          {n} / {MAX_SAMPLES}
          {need > 0 && (
            <span className="text-[var(--text-faint)]"> · {need} more to train</span>
          )}
        </p>
      </div>

      <div className="mt-2 flex gap-1">
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={n === 0}
          onClick={onClear}
          aria-label={`Clear examples in ${data.name}`}
        >
          Clear examples
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={classCount <= MIN_CLASSES}
          onClick={onRemove}
          aria-label={`Remove class ${data.name}`}
        >
          Remove class
        </button>
      </div>
    </li>
  );
}
