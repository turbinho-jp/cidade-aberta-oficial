import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compressImage, ImageError, MAX_PHOTOS } from "@/lib/image-compress";

export interface PickedPhoto {
  key: string;
  blob: Blob;
  previewUrl: string;
}

interface PhotoPickerProps {
  value: PickedPhoto[];
  onChange: (photos: PickedPhoto[]) => void;
  disabled?: boolean;
  max?: number;
}

/** Escolhe/tira fotos, já reduzidas no navegador. O envio em si fica com quem usa o componente. */
export function PhotoPicker({ value, onChange, disabled, max = MAX_PHOTOS }: PhotoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(value);
  latest.current = value;

  // Libera as miniaturas ao sair da tela.
  useEffect(() => () => latest.current.forEach((p) => URL.revokeObjectURL(p.previewUrl)), []);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    const next = [...value];
    try {
      for (const file of Array.from(files)) {
        if (next.length >= max) {
          setError(`No máximo ${max} fotos.`);
          break;
        }
        try {
          const blob = await compressImage(file);
          next.push({ key: crypto.randomUUID(), blob, previewUrl: URL.createObjectURL(blob) });
        } catch (e) {
          setError(e instanceof ImageError ? e.message : "Não foi possível processar a foto.");
        }
      }
    } finally {
      setBusy(false);
      onChange(next);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = (key: string) => {
    const gone = value.find((p) => p.key === key);
    if (gone) URL.revokeObjectURL(gone.previewUrl);
    onChange(value.filter((p) => p.key !== key));
  };

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {value.map((p) => (
            <li key={p.key} className="relative aspect-square overflow-hidden rounded-md border bg-muted">
              <img src={p.previewUrl} alt="Foto escolhida" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => remove(p.key)}
                disabled={disabled}
                className="absolute right-1 top-1 rounded-full bg-background/90 p-1 shadow hover:bg-background"
                aria-label="Remover foto"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void handleFiles(e.target.files)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || busy || value.length >= max}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />}
        {value.length === 0 ? "Adicionar fotos" : `Adicionar mais (${value.length}/${max})`}
      </Button>

      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
