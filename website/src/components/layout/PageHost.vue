<script setup lang="ts">
import type { SectionKey } from "../../constants/navigation";
import AchievementsPage from "../../pages/AchievementsPage.vue";
import BagPage from "../../pages/BagPage.vue";
import DrawPage from "../../pages/DrawPage.vue";
import FormationPage from "../../pages/FormationPage.vue";
import FriendsPage from "../../pages/FriendsPage.vue";
import GuildPage from "../../pages/GuildPage.vue";
import LeaderboardPage from "../../pages/LeaderboardPage.vue";
import MessagesPage from "../../pages/MessagesPage.vue";
import MonthlyCardPage from "../../pages/MonthlyCardPage.vue";
import PointsPage from "../../pages/PointsPage.vue";
import ProfilePage from "../../pages/ProfilePage.vue";
import PvePage from "../../pages/PvePage.vue";
import RedeemPage from "../../pages/RedeemPage.vue";
import SettingsPage from "../../pages/SettingsPage.vue";
import ShopPage from "../../pages/ShopPage.vue";
import SynthesizePage from "../../pages/SynthesizePage.vue";
import TasksPage from "../../pages/TasksPage.vue";
import TradePage from "../../pages/TradePage.vue";

const props = defineProps<{
  activeSection: SectionKey;
}>();
</script>

<template>
  <main class="page">
    <DrawPage v-if="props.activeSection === 'draw'" />
    <ShopPage v-if="props.activeSection === 'shop'" />
    <ProfilePage v-if="props.activeSection === 'profile'" />
    <FriendsPage v-if="props.activeSection === 'friends'" />
    <MessagesPage v-if="props.activeSection === 'messages'" />
    <SettingsPage v-if="props.activeSection === 'settings'" />
    <GuildPage v-if="props.activeSection === 'guild'" />
    <BagPage v-if="props.activeSection === 'bag'" />
    <FormationPage v-if="props.activeSection === 'formation'" />
    <PvePage v-if="props.activeSection === 'pve'" />
    <SynthesizePage v-if="props.activeSection === 'synthesize'" />
    <PointsPage v-if="props.activeSection === 'points'" />
    <MonthlyCardPage v-if="props.activeSection === 'monthlyCard'" />
    <TradePage v-if="props.activeSection === 'trade'" />
    <LeaderboardPage v-if="props.activeSection === 'leaderboard'" />
    <TasksPage v-if="props.activeSection === 'tasks'" />
    <AchievementsPage v-if="props.activeSection === 'achievements'" />
    <RedeemPage v-if="props.activeSection === 'redeem'" />
  </main>
</template>
