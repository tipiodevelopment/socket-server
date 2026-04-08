import { DeviceToken } from "@shared/schema";
import apn from "@parse/node-apn";

export async function sendAPNs(
  iosDevices: DeviceToken[],
  data: {
    campaignId: number;
    productId: number;
    resolvedName: string;
    userId: string;
  },
): Promise<string[]> {
  let exit: boolean = false;
  let notes: string[] = [];
  // Send APNs push notification
  const _rawApnsKey = process.env.APNS_KEY || "";
  // Replit secrets store multiline values with spaces — reconstruct proper PEM format
  let apnsKeyContent: string = "";
  if (_rawApnsKey) {
    const match = _rawApnsKey
      .replace(/\\n/g, "\n")
      .match(/-----BEGIN PRIVATE KEY-----([\s\S]+?)-----END PRIVATE KEY-----/);
    if (match) {
      const b64 = match[1].replace(/\s+/g, "");
      apnsKeyContent = `-----BEGIN PRIVATE KEY-----\n${b64}\n-----END PRIVATE KEY-----\n`;
    } else {
      apnsKeyContent = _rawApnsKey.replace(/\\n/g, "\n");
    }
  }

  const apnsKeyId = process.env.APNS_KEY_ID || "";
  const apnsTeamId = process.env.APNS_TEAM_ID || "";
  const apnsBundleId = process.env.APNS_BUNDLE_ID || "viodev.tv2demo";

  if (!apnsKeyContent || !apnsKeyId || !apnsTeamId) {
    console.log(
      `[CartIntent] APNs not configured — logging intent: userId=${data.userId} productId=${data.productId} productName="${data.resolvedName}"`,
    );
    notes.push("apns_not_configured");
    exit = true;
  }
  if (!exit) {
    try {
      const apnProvider = new apn.Provider({
        token: {
          key: apnsKeyContent,
          keyId: apnsKeyId,
          teamId: apnsTeamId,
        },
        production: false, // sandbox — change to true when using production APNs certificates
      });

      const notification = new apn.Notification();
      notification.expiry = Math.floor(Date.now() / 1000) + 3600;
      notification.badge = 1;
      notification.sound = "default";
      notification.alert = {
        title: "Produkt lagt til",
        body: `${data.resolvedName} — trykk for å kjøpe`,
      };
      notification.payload = {
        vio_notification_version: 1,
        vio_event_type: "cart_intent",
        vio_cartIntent_kind: "cart_intent",
        vio_cartIntent_productId: String(data.productId),
        vio_cartIntent_productName: data.resolvedName,
        vio_cartIntent_campaignId: data.campaignId,
      };
      notification.topic = apnsBundleId;

      await Promise.all(
        iosDevices.map(async (device) => {
          const result = await apnProvider.send(
            notification,
            device.deviceToken,
          );

          if (result.failed?.length > 0) {
            console.error(
              "[CartIntent] APNs push failed:",
              result.failed[0].response,
            );
          } else {
            console.log(
              `[CartIntent] Push sent to deviceId=${device.deviceId}`,
            );
          }
        }),
      );

      apnProvider.shutdown();
    } catch (apnsErr) {
      console.error("[CartIntent] APNs error:", apnsErr);
    }
  }
  return notes;
}