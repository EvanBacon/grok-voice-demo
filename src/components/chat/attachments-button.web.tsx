import { AttachmentsContent } from "@/components/attachments-content";
import { Icon } from "@/components/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/web-popover";
import { Plus } from "lucide-react-native";
import { Text, View } from "react-native";

/**
 * Web composer "+" button. Instead of navigating to the `/attachments` page,
 * it opens the "Add to chat" UI in a Radix popover anchored to the button.
 */
export function AttachmentsButton() {
  return (
    <Popover>
      <PopoverTrigger
        aria-label="Add to chat"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/40 bg-transparent transition-colors hover:bg-accent"
      >
        <Icon icon={Plus} className="w-5 h-5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent>
        <View className="pb-1 pt-1">
          <Text className="px-5 pb-1 text-[13px] font-medium text-muted-foreground">
            Add to chat
          </Text>
          <AttachmentsContent />
        </View>
      </PopoverContent>
    </Popover>
  );
}
