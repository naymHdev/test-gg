import { cert, getApps, initializeApp } from "firebase-admin/app";
import {
  getMessaging,
  type Message,
  type MulticastMessage,
} from "firebase-admin/messaging";
import config from "../../config";

type FirebaseServiceAccount = Parameters<typeof cert>[0];

type PushNotificationPayload = {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
};

type MulticastPushPayload = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
};

export type MulticastPushResult = {
  token: string;
  success: boolean;
  messageId?: string;
  error?: string;
};

const getFirebaseApp = () => {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const { service_account_json, project_id, client_email, private_key } =
    config.firebase;

  if (service_account_json) {
    const serviceAccount = JSON.parse(
      service_account_json,
    ) as FirebaseServiceAccount;
    return initializeApp({
      credential: cert(serviceAccount),
    });
  }

  if (project_id && client_email && private_key) {
    return initializeApp({
      credential: cert({
        projectId: project_id,
        clientEmail: client_email,
        privateKey: private_key,
      } as FirebaseServiceAccount),
    });
  }

  throw new Error(
    "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID/FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY.",
  );
};

const buildMessage = (payload: PushNotificationPayload): Message => {
  const message: Message = {
    token: payload.token,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
  };

  if (payload.imageUrl) {
    message.notification = {
      ...message.notification,
      imageUrl: payload.imageUrl,
    };
  }

  return message;
};

const sendPushNotification = async (
  payload: PushNotificationPayload,
): Promise<string> => {
  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  const message = buildMessage(payload);

  return messaging.send(message);
};

const sendMulticastPush = async (
  payload: MulticastPushPayload,
): Promise<MulticastPushResult[]> => {
  const app = getFirebaseApp();
  const messaging = getMessaging(app);
  const tokens = payload.tokens.filter(Boolean);

  if (tokens.length === 0) {
    return [];
  }

  const results: MulticastPushResult[] = [];
  const chunkSize = 500;

  for (let index = 0; index < tokens.length; index += chunkSize) {
    const tokenChunk = tokens.slice(index, index + chunkSize);
    const multicastMessage: MulticastMessage = {
      tokens: tokenChunk,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
      },
      data: payload.data,
    };

    const batchResponse =
      await messaging.sendEachForMulticast(multicastMessage);

    batchResponse.responses.forEach((response, responseIndex) => {
      results.push({
        token: tokenChunk[responseIndex],
        success: response.success,
        messageId: response.success ? response.messageId : undefined,
        error: response.success ? undefined : response.error?.message,
      });
    });
  }

  return results;
};

export { sendPushNotification, sendMulticastPush };
