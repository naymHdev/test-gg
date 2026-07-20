import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { userRoutes } from "../modules/user/user.route";
import { adminRoutes } from "../modules/admin/admin.route";
import { postRoutes } from "../modules/post/post.routes";
import { tournamentRoute } from "../modules/tournament/tournament.route";
import { challengeRoute } from "../modules/challenge/challenge.route";
import { rewardRoute } from "../modules/reward/reward.route";
import { supportRouter } from "../modules/support/support.route";
import { reportRouter } from "../modules/report/report.route";
import { walletRouter } from "../modules/wallet/wallet.route";
import { legalRouter } from "../modules/legal/legal.route";
import { subscriptionRouter } from "../modules/subscription/subscription.routes";
import { notificationRouter } from "../modules/notification/notification.route";
import { friendRouter } from "../modules/friend/friend.route";
import { messageRouter } from "../modules/message/message.route";
import { mediaRouter } from "../modules/media/media.route";
import { channelRoutes } from "../channel/channel.route";

const router = Router();

const moduleRoutes = [
  { path: "/auth", route: authRoutes },
  { path: "/users", route: userRoutes },
  { path: "/admin", route: adminRoutes },
  { path: "/posts", route: postRoutes },
  { path: "/tournament", route: tournamentRoute },
  { path: "/challenge", route: challengeRoute },
  { path: "/reward", route: rewardRoute },
  { path: "/support", route: supportRouter },
  { path: "/report", route: reportRouter },
  { path: "/wallet", route: walletRouter },
  { path: "/legal", route: legalRouter },
  { path: "/premium", route: subscriptionRouter },
  { path: "/notifications", route: notificationRouter },
  { path: "/friends", route: friendRouter },
  { path: "/messages", route: messageRouter },
  { path: "/media", route: mediaRouter },
  { path: "/channels", route: channelRoutes },
];

moduleRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

export default router;
