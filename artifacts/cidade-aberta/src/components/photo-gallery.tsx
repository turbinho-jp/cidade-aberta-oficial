import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Attachment } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { attachmentSrc } from "@/lib/attachments";

interface PhotoGalleryProps {
  photos: Attachment[];
  alt: string;
  /** Quando informado, mostra o botão de apagar em cada foto. */
  onDelete?: (photo: Attachment) => void;
  deleting?: boolean;
}

/** Miniaturas que abrem em tamanho grande ao clicar. */
export function PhotoGallery({ photos, alt, onDelete, deleting }: PhotoGalleryProps) {
  const [open, setOpen] = useState<Attachment | null>(null);
  if (photos.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((p, i) => (
          <li key={p.id} className="relative aspect-[4/3] overflow-hidden rounded-lg border bg-muted">
            <button type="button" className="h-full w-full" onClick={() => setOpen(p)} aria-label={`Ampliar foto ${i + 1}`}>
              <img
                src={attachmentSrc(p.url)}
                alt={`${alt} (foto ${i + 1})`}
                loading="lazy"
                className="h-full w-full object-cover transition-transform hover:scale-105"
              />
            </button>
            {onDelete && (
              <button
                type="button"
                disabled={deleting}
                onClick={() => onDelete(p)}
                className="absolute right-2 top-2 rounded-full bg-background/90 p-1.5 shadow hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Apagar foto"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </li>
        ))}
      </ul>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">{alt}</DialogTitle>
          {open && <img src={attachmentSrc(open.url)} alt={alt} className="max-h-[80vh] w-full rounded object-contain" />}
        </DialogContent>
      </Dialog>
    </>
  );
}
