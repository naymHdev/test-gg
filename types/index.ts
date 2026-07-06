declare namespace Express {
  interface Request {
    user: {
      id: string;
      role: string;
      email: string;
      username: string;
    };
  }
}
