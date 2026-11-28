import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Lock, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { compressAvatar, ImageError } from "@/lib/image-compress";
import { removeAvatar, uploadMyAvatar } from "@/lib/avatar";
import { AVATAR_UNLOCK_POINTS } from "@/lib/gamification";

interface Props {
  userId: number;
  hasAvatar: boolean;
  /** Quem está vendo é a dona/o dono do perfil. */
  isMe: boolean;
  /** Quem está vendo é da equipe da prefeitura (pode remover a foto de qualquer pessoa). */
  isStaff: boolean;
  /** Pontos de quem está vendo (só usado quando `isMe`). */
  myPoints: number;
}

/**
 * Botões de foto de perfil no perfil:
 * - a própria pessoa envia/troca/remove a foto, se já chegou ao nível Prefeito (a equipe é dispensada);
 * - antes disso vê quanto falta;
 * - a equipe da prefeitura vê "Remover foto" no perfil dos outros (moderação).
 */
export function AvatarManager({ userId, hasAvatar, isMe, isStaff, myPoints }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const unlocked = isStaff || myPoints >= AVATAR_UNLOCK_POINTS;

  // Foto aparece em perfil, ranking, comentários e na sessão (/auth/me): atualiza tudo.
  const refresh = () => queryClient.invalidateQueries();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo
    if (!file) return;
    setBusy(true);
    try {
      const image = await compressAvatar(file);
      await uploadMyAvatar(image);
      await refresh();
      toast({ title: "Foto atualizada" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível trocar a foto",
        description: err instanceof Error || err instanceof ImageError ? err.message : undefined,
      });
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await removeAvatar(userId);
      await refresh();
      toast({ title: isMe ? "Foto removida" : "Foto removida pela moderação" });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Não foi possível remover a foto",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  if (isMe && !unlocked) {
    const missing = Math.max(0, AVATAR_UNLOCK_POINTS - myPoints);
    return (
      <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground max-w-[10rem] text-center">
        <Lock className="w-3.5 h-3.5 shrink-0" aria-hidden />
        <span>Foto de perfil liberada no nível Prefeito. Faltam {missing} pts.</span>
      </p>
    );
  }

  const canRemove = hasAvatar && (isMe || isStaff);
  if (!(isMe && unlocked) && !canRemove) return null;

  return (
    <div className="flex flex-col items-center gap-2">
      {isMe && unlocked && (
        <>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} aria-label="Escolher foto de perfil" />
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden /> : <Camera className="w-4 h-4 mr-2" aria-hidden />}
            {hasAvatar ? "Trocar foto" : "Adicionar foto"}
          </Button>
        </>
      )}
      {canRemove && (
        <>
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={busy} onClick={() => (isMe ? onRemove() : setConfirmOpen(true))}>
            <Trash2 className="w-4 h-4 mr-2" aria-hidden />
            {isMe ? "Remover foto" : "Remover foto (moderação)"}
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remover a foto deste perfil?</AlertDialogTitle>
                <AlertDialogDescription>
                  Use quando a imagem for imprópria ou abusiva. A pessoa continua com a conta e pode enviar outra foto.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
                <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void onRemove(); }}>
                  Remover
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
