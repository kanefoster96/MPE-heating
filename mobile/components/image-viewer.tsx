import { Image, Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { PressableScale } from "@/components/ui";

/** A chat photo, full screen on black, pinch to zoom (Kanvas Academy's image-viewer, cut down). */
export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <ScrollView
          maximumZoomScale={4}
          minimumZoomScale={1}
          centerContent
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center" }}
        >
          <Pressable onPress={onClose} accessibilityLabel="Close photo">
            {uri ? <Image source={{ uri }} style={{ width, height: height * 0.8 }} resizeMode="contain" accessibilityIgnoresInvertColors /> : null}
          </Pressable>
        </ScrollView>
        <PressableScale
          onPress={onClose}
          accessibilityLabel="Close"
          style={{ position: "absolute", top: insets.top + 8, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </PressableScale>
      </View>
    </Modal>
  );
}
