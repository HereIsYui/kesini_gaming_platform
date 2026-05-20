import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const PageShell = {
  template: "<span />",
};

const routes: RouteRecordRaw[] = [
  { path: "/", redirect: "/draw" },
  { path: "/draw", name: "draw", component: PageShell },
  { path: "/result", redirect: "/draw" },
  { path: "/bag", name: "bag", component: PageShell },
  { path: "/synthesize", name: "synthesize", component: PageShell },
  { path: "/leaderboard", name: "leaderboard", component: PageShell },
  { path: "/trade", name: "trade", component: PageShell },
  { path: "/redeem", name: "redeem", component: PageShell },
  { path: "/:pathMatch(.*)*", redirect: "/draw" },
];

export default createRouter({
  history: createWebHistory(),
  routes,
});
