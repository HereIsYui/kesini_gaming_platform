import {
  createRouter,
  createWebHistory,
  type RouteRecordRaw,
} from "vue-router";

const PageShell = {
  template: "<span />",
};

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/draw" },
  { path: "/draw", name: "draw", component: PageShell },
  { path: "/profile", name: "profile", component: PageShell },
  { path: "/u/:publicId", name: "publicProfile", component: PageShell },
  { path: "/friends", name: "friends", component: PageShell },
  { path: "/guild", name: "guild", component: PageShell },
  { path: "/messages", name: "messages", component: PageShell },
  { path: "/settings", name: "settings", component: PageShell },
  { path: "/result", redirect: "/draw" },
  { path: "/bag", name: "bag", component: PageShell },
  { path: "/formation", name: "formation", component: PageShell },
  { path: "/pve", name: "pve", component: PageShell },
  { path: "/synthesize", name: "synthesize", component: PageShell },
  { path: "/points", name: "points", component: PageShell },
  { path: "/monthly-card", name: "monthlyCard", component: PageShell },
  { path: "/leaderboard", name: "leaderboard", component: PageShell },
  { path: "/tasks", name: "tasks", component: PageShell },
  { path: "/achievements", name: "achievements", component: PageShell },
  { path: "/trade", name: "trade", component: PageShell },
  { path: "/redeem", name: "redeem", component: PageShell },
  { path: "/:pathMatch(.*)*", redirect: "/draw" },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
