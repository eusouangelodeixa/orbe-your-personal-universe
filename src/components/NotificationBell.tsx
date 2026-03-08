import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, useUnreadCount, useMarkNotificationRead, useMarkAllRead } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_COLORS: Record<string, string> = {
  aula: "bg-blue-500",
  prova: "bg-red-500",
  trabalho: "bg-amber-500",
  atividade: "bg-cyan-500",
  revisao: "bg-emerald-500",
  info: "bg-muted-foreground",
};

export function NotificationBell() {
  const { data: notifications = [] } = useNotifications();
  const unreadCount = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllRead();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] text-destructive-foreground font-bold">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAll.mutate()}>
              <CheckCheck className="h-3 w-3 mr-1" /> Marcar todas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[300px]">
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-8">Nenhuma notificação</p>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`flex items-start gap-3 p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read ? "bg-primary/5" : ""}`}
                onClick={() => !n.read && markRead.mutate(n.id)}
              >
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${TYPE_COLORS[n.type] || TYPE_COLORS.info}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${!n.read ? "font-medium" : ""}`}>{n.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
