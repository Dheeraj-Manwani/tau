import { Avatar, AvatarFallback, AvatarImage } from "@/src/components/ui/avatar";
import {
  avatarSrc,
  initialsOf,
  type Identity,
} from "@/src/features/account/identity";

/**
 * The one avatar used everywhere: the profile picture when there is one,
 * otherwise mono initials on the raised surface (boards/Surfaces.dc.html).
 * Sizes: 24 in chat and lists, 32 in the top bar (default), 40 in a menu
 * header.
 */
export function UserAvatar({
  user,
  className,
  fallbackClassName,
}: {
  user: Identity;
  className?: string;
  fallbackClassName?: string;
}) {
  const src = avatarSrc(user);
  return (
    <Avatar className={className}>
      {src && <AvatarImage src={src} alt="" className="object-cover" />}
      <AvatarFallback className={fallbackClassName}>
        {initialsOf(user)}
      </AvatarFallback>
    </Avatar>
  );
}
