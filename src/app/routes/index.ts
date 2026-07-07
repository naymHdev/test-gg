import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/user/user.route";
import { adminRoutes } from "../modules/admin/admin.route";
import { postRoutes } from "../modules/post/post.routes";
import { mediaRouter } from "../modules/media/media.route";
import { tournamentRoute } from "../modules/tournament/tournament.route";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: authRoutes },
  { path: "/users", route: userRoutes },
  { path: "/admin", route: adminRoutes },
  { path: "/posts", route: postRoutes },
  { path: "/media", route: mediaRouter },
  { path: "/tournament", route: tournamentRoute },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
