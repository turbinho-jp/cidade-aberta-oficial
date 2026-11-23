import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { 
  Menu, X, Map as MapIcon, Megaphone, Bell,
  BarChart2, HardHat, Building2, UserCircle, LogOut, 
  Settings, LogIn, UserPlus, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LevelBadge } from "@/components/level-badge";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

type TopAnnouncement = {
  id: number;
  title: string;
  scope: "municipal" | "estadual" | "comunitario";
};

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isAdmin, isSecretary } = useAuth();
  const logoutMutation = useLogout();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [latestNotice, setLatestNotice] = useState<TopAnnouncement | null>(null);
  const [dismissedNoticeId, setDismissedNoticeId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/announcements", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((data) => {
        if (active && Array.isArray(data.announcements) && data.announcements.length > 0) {
          setLatestNotice(data.announcements[0]);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      }
    });
  };

  const navLinks = [
    { href: "/mapa", label: "Mapa da Cidade", icon: MapIcon },
    { href: "/demandas", label: "Demandas", icon: Megaphone },
    { href: "/avisos", label: "Avisos", icon: Bell },
    { href: "/obras", label: "Obras", icon: HardHat },
    { href: "/painel", label: "Transparência", icon: BarChart2 },
    { href: "/secretarias", label: "Secretarias", icon: Building2 },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
              <span className="w-8 h-8 rounded bg-primary text-primary-foreground flex items-center justify-center">
                CA
              </span>
              Cidade Aberta
            </Link>
            
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <Button 
                    variant={location === link.href ? "secondary" : "ghost"} 
                    className={cn(
                      "text-sm font-medium transition-colors",
                      location === link.href ? "" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </Button>
                </Link>
              ))}
            </nav>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                <Link href="/demandas/nova">
                  <Button variant="default" size="sm" className="font-semibold">
                    Nova Demanda
                  </Button>
                </Link>
                {(isAdmin || isSecretary) && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="w-4 h-4" />
                      Gestão
                    </Button>
                  </Link>
                )}
                {(isAdmin || isSecretary) && (
                  <Link href="/admin/moderacao">
                    <Button variant="outline" size="sm" className="gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      Moderação
                    </Button>
                  </Link>
                )}
                {(isAdmin || isSecretary) && (
                  <Link href="/admin/avisos">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Bell className="w-4 h-4" />
                      Avisos
                    </Button>
                  </Link>
                )}
                <Link href={`/perfil/${user?.id}`}>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <UserCircle className="w-5 h-5" />
                    <span className="max-w-[100px] truncate">{user?.name}</span>
                    {user?.role === "citizen" && <LevelBadge points={user.points} compact />}
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm">Entrar</Button>
                </Link>
                <Link href="/cadastro">
                  <Button variant="default" size="sm">Cadastrar</Button>
                </Link>
              </div>
            )}
          </div>

          <button 
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </header>

      {/* Banner do Último Comunicado Oficial */}
      {latestNotice && dismissedNoticeId !== latestNotice.id && location !== "/avisos" && (
        <div className="bg-primary/10 border-b border-primary/20 text-foreground">
          <div className="container mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <Link href="/avisos" className="flex items-center gap-2 min-w-0 hover:underline font-medium">
              <Bell className="w-4 h-4 text-primary shrink-0" />
              <span className="uppercase text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground shrink-0">
                Aviso
              </span>
              <span className="truncate">{latestNotice.title}</span>
            </Link>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/avisos">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary">
                  Ver mural
                </Button>
              </Link>
              <button
                type="button"
                onClick={() => setDismissedNoticeId(latestNotice.id)}
                className="p-1 text-muted-foreground hover:text-foreground"
                aria-label="Fechar aviso"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailVerificationBanner />

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 z-40 bg-background border-b border-border overflow-y-auto">
          <div className="flex flex-col p-4 gap-2">
            {isAuthenticated && (
              <Link href="/demandas/nova" onClick={() => setIsMobileMenuOpen(false)}>
                <Button className="w-full justify-start font-semibold mb-2" size="lg">
                  <Megaphone className="w-5 h-5 mr-3" />
                  Nova Demanda
                </Button>
              </Link>
            )}
            
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setIsMobileMenuOpen(false)}>
                <Button 
                  variant={location === link.href ? "secondary" : "ghost"} 
                  className="w-full justify-start text-base"
                  size="lg"
                >
                  <link.icon className="w-5 h-5 mr-3" />
                  {link.label}
                </Button>
              </Link>
            ))}

            <div className="my-4 border-t border-border"></div>

            {isAuthenticated ? (
              <>
                {(isAdmin || isSecretary) && (
                  <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start text-base mb-2" size="lg">
                      <Settings className="w-5 h-5 mr-3" />
                      Painel de Gestão
                    </Button>
                  </Link>
                )}
                {(isAdmin || isSecretary) && (
                  <Link href="/admin/moderacao" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start text-base mb-2" size="lg">
                      <ShieldCheck className="w-5 h-5 mr-3" />
                      Moderação
                    </Button>
                  </Link>
                )}
                {(isAdmin || isSecretary) && (
                  <Link href="/admin/avisos" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full justify-start text-base mb-2" size="lg">
                      <Bell className="w-5 h-5 mr-3" />
                      Gerenciar Avisos
                    </Button>
                  </Link>
                )}
                <Link href={`/perfil/${user?.id}`} onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="ghost" className="w-full justify-start text-base" size="lg">
                    <UserCircle className="w-5 h-5 mr-3" />
                    Meu Perfil
                  </Button>
                </Link>
                <Button variant="ghost" className="w-full justify-start text-base text-destructive mt-2" size="lg" onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }}>
                  <LogOut className="w-5 h-5 mr-3" />
                  Sair da Conta
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                <Link href="/login" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="outline" className="w-full justify-start text-base" size="lg">
                    <LogIn className="w-5 h-5 mr-3" />
                    Entrar
                  </Button>
                </Link>
                <Link href="/cadastro" onClick={() => setIsMobileMenuOpen(false)}>
                  <Button variant="default" className="w-full justify-start text-base" size="lg">
                    <UserPlus className="w-5 h-5 mr-3" />
                    Criar Conta
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t bg-muted/40 py-8 mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 opacity-50 grayscale">
            <span className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-bold">
              CA
            </span>
            <span className="font-bold tracking-tight">Cidade Aberta</span>
          </div>
          <p className="text-sm text-muted-foreground text-center md:text-left">
            Uma plataforma de participação cidadã. Construída para a comunidade.
          </p>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacidade" className="hover:text-foreground hover:underline">Privacidade</Link>
            <Link href="/termos" className="hover:text-foreground hover:underline">Termos de Uso</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}