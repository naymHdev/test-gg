import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/user/user.route";
import { adminRoutes } from "../modules/admin/admin.route";
import { postRoutes } from "../modules/post/post.routes";
import { mediaRouter } from "../modules/media/media.route";
import { tournamentRoute } from "../modules/tournament/tournament.route";
import { challengeRoute } from "../modules/challenge/challenge.route";
import { rewardRoute } from "../modules/reward/reward.route";
import { supportRouter } from "../modules/support/support.route";
import { reportRouter } from "../modules/report/report.route";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: authRoutes },
  { path: "/users", route: userRoutes },
  { path: "/admin", route: adminRoutes },
  { path: "/posts", route: postRoutes },
  { path: "/media", route: mediaRouter },
  { path: "/tournament", route: tournamentRoute },
  { path: "/challenge", route: challengeRoute },
  { path: "/reward", route: rewardRoute },
  { path: "/support", route: supportRouter },
  { path: "/report", route: reportRouter },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
