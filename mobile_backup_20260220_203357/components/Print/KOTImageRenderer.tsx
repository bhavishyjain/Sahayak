// components/KOTImageRenderer.tsx
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { captureRef } from "react-native-view-shot";
import { KOTImage } from "../../utils/printer/components/KOTImage";
import { CUT, INIT } from "../../utils/printer/escpos/commands";
import { convertImageToRasterBytes } from "../../utils/printer/escpos/imageRaster";
import { Order } from "../../utils/printer/types";

interface KOTImageRendererProps {
  order: Order;
  paperWidth: "58" | "80";
  onImageReady: (bytes: number[]) => void;
  onError: (error: Error) => void;
}

/**
 * This component renders the KOT image off-screen and captures it for printing
 * Usage:
 *
 * <KOTImageRenderer
 *   order={order}
 *   paperWidth="58"
 *   onImageReady={(bytes) => {
 *     // Send bytes to printer
 *     print(bytes, config);
 *   }}
 *   onError={(error) => console.error(error)}
 * />
 */
export const KOTImageRenderer: React.FC<KOTImageRendererProps> = ({
  order,
  paperWidth,
  onImageReady,
  onError,
}) => {
  const viewRef = useRef<View>(null);

  useEffect(() => {
    const captureImage = async () => {
      try {
        if (!viewRef.current) {
          throw new Error("View ref not ready");
        }

        // Small delay to ensure rendering is complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Capture the view as base64 PNG
        const uri = await captureRef(viewRef, {
          format: "png",
          quality: 1,
          result: "base64",
        });

        // Convert to ESC/POS raster bytes
        const pixelWidth = paperWidth === "58" ? 384 : 576;
        const rasterBytes = convertImageToRasterBytes(uri, pixelWidth);

        // Add printer initialization and cut commands
        const bytes: number[] = [];
        bytes.push(...INIT);
        bytes.push(...rasterBytes);
        bytes.push(...CUT.FEED_AND_CUT);

        onImageReady(bytes);
      } catch (error) {
        onError(error as Error);
      }
    };

    captureImage();
  }, [order, paperWidth, onImageReady, onError]);

  return (
    <View style={{ position: "absolute", left: -9999, top: -9999 }}>
      <KOTImage ref={viewRef} order={order} paperWidth={paperWidth} />
    </View>
  );
};
