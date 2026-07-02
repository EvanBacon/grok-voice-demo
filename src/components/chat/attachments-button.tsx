import { Icon } from "@/components/icon";
import { Link } from "expo-router";
import { Plus } from "lucide-react-native";

import { PromptInputAction } from "./prompt-input";

/**
 * Composer "+" button. On native it opens the `/attachments` form sheet; the
 * web variant (`attachments-button.web.tsx`) opens an inline popover instead.
 */
export function AttachmentsButton() {
  return (
    <Link href="/attachments" asChild>
      <PromptInputAction>
        <Icon icon={Plus} className="w-5 h-5 text-muted-foreground" />
      </PromptInputAction>
    </Link>
  );
}
