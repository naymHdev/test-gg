export type TJwtPayload = {
  userId: string;
  role: string;
  permissions?: string[];
};

export type TRegisterInput = {
  username: string;
  email: string;
  password: string;
  region: string;
  language: string;
  agreedToTerms: boolean;
  agreedToPrivacy: boolean;
};

export type TLoginInput = {
  email: string;
  password: string;
  stayLoggedIn?: boolean;
};

export type TVerifyOtpInput = {
  pendingToken: string;
  otp: string;
};
