import { DeviceToken } from "@shared/schema";
import { getFirebaseApp } from "../firebase";
const firebaseApp = getFirebaseApp();
const messaging = firebaseApp.messaging();

export async function sendFCMs(
  androidDevices: DeviceToken[],
  data: { campaignId: number; productId: number; resolvedName: string },
): Promise<string[]> {
  const notes: string[] = [];
  if (androidDevices.length > 0) {
    try {
      notes.push(`fcm_total_android_devices_${androidDevices.length}`);
      await Promise.all(
        androidDevices.map(async (device) => {
          const message = {
            token: device.deviceToken,
            notification: {
              title: "Added to cart",
              body: `${data.resolvedName} — tap to purchase`,
            },
            data: {
              productId: String(data.productId),
              campaignId: String(data.campaignId),
              action: "open_product",
            },
          };

          const response = await messaging.send(message);
          notes.push(`fcm_sent_to_${device.deviceId}`);
          console.log(
            `[CartIntent] FCM sent to deviceId=${device.deviceId}`,
            response,
          );
        }),
      );
    } catch (fcmErr) {
      console.error("[CartIntent] FCM error:", fcmErr);
      notes.push("fcm_error");
    }
  } else notes.push("no_android_device_registered");
  return notes;
}