export interface SocialLoginPayload {
  provider: "google" | "apple";
  providerId: string;
  email: string;
  name: string;
  profileImg?: string;
}
