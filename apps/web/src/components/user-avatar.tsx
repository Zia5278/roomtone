import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { User } from "@/lib/api";
import { cn } from "@/lib/utils";

const avatarColors: Record<User["avatar_color"], string> = {
  coral: "bg-primary",
  blue: "bg-[#5865f2]",
  green: "bg-[#23a559]",
  purple: "bg-[#9b59b6]",
  gold: "bg-[#f0b232]",
};

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function UserAvatar({
  user,
  className,
}: {
  user: User;
  className?: string;
}) {
  return (
    <Avatar className={className} aria-label={`${user.display_name}'s avatar`}>
      <AvatarFallback
        className={cn(
          "font-semibold text-white",
          avatarColors[user.avatar_color],
        )}
      >
        {getInitials(user.display_name)}
      </AvatarFallback>
    </Avatar>
  );
}
