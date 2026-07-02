import { AttachmentsContent } from "@/components/attachments-content";
import { AndroidGrabber } from "@/components/grabber";
import { ScrollView } from "react-native";

export default function AddToChatSheet() {
  return (
    <ScrollView className="flex-1 " contentInsetAdjustmentBehavior="automatic">
      <AndroidGrabber />
      <AttachmentsContent />
    </ScrollView>
  );
}
