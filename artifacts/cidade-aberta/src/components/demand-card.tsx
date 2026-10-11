import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, ThumbsUp, MapPin } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { CategoryIcon } from "./category-icon";
import type { Demand } from "@workspace/api-client-react";
import { coverUrl } from "@/lib/attachments";

export function DemandCard({ demand }: { demand: Demand }) {
  return (
    <Card className="hover-elevate transition-all flex flex-col h-full overflow-hidden border-border/50 group">
      <Link href={`/demandas/${demand.id}`} className="block flex-1">
        {coverUrl(demand) && (
          <div className="w-full h-48 overflow-hidden bg-muted">
            <img 
              src={coverUrl(demand)!} 
              alt={demand.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          </div>
        )}
        <CardHeader className="p-4 pb-2 space-y-2">
          <div className="flex justify-between items-start gap-2">
            <StatusBadge status={demand.status} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(demand.createdAt), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {demand.title}
          </h3>
        </CardHeader>
        <CardContent className="p-4 pt-0 flex-1">
          <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
            {demand.description}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {demand.category && (
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                <CategoryIcon name={demand.category.icon} className="w-3 h-3" />
                {demand.category.name}
              </span>
            )}
            {demand.neighborhood && (
              <span className="flex items-center gap-1 bg-muted px-2 py-1 rounded-md">
                <MapPin className="w-3 h-3" />
                {demand.neighborhood.name}
              </span>
            )}
          </div>
        </CardContent>
      </Link>
      <CardFooter className="p-4 pt-0 flex items-center justify-between border-t mt-auto">
        <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium pt-3">
          <div className="flex items-center gap-1.5" title="Confirmações">
            <ThumbsUp className={`w-4 h-4 ${demand.isConfirmedByMe ? 'text-primary fill-primary' : ''}`} />
            <span className={demand.isConfirmedByMe ? 'text-primary' : ''}>{demand.confirmationsCount}</span>
          </div>
          <div className="flex items-center gap-1.5" title="Comentários">
            <MessageSquare className="w-4 h-4" />
            <span>{demand.commentsCount}</span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground pt-3 truncate max-w-[120px]">
          Por {demand.authorName}
        </div>
      </CardFooter>
    </Card>
  );
}
