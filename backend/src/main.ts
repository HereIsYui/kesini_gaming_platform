import { createApp } from "vue";
import { ElAlert } from "element-plus/es/components/alert/index";
import { ElButton } from "element-plus/es/components/button/index";
import { ElCard } from "element-plus/es/components/card/index";
import {
  ElAside,
  ElContainer,
  ElHeader,
  ElMain,
} from "element-plus/es/components/container/index";
import { ElDialog } from "element-plus/es/components/dialog/index";
import { ElDivider } from "element-plus/es/components/divider/index";
import {
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
} from "element-plus/es/components/dropdown/index";
import { ElEmpty } from "element-plus/es/components/empty/index";
import { ElForm, ElFormItem } from "element-plus/es/components/form/index";
import { ElIcon } from "element-plus/es/components/icon/index";
import { ElInput } from "element-plus/es/components/input/index";
import { ElLoading } from "element-plus/es/components/loading/index";
import {
  ElMenu,
  ElMenuItem,
  ElMenuItemGroup,
} from "element-plus/es/components/menu/index";
import { ElScrollbar } from "element-plus/es/components/scrollbar/index";
import { ElSwitch } from "element-plus/es/components/switch/index";
import { ElTag } from "element-plus/es/components/tag/index";
import { provideGlobalConfig } from "element-plus/es/components/config-provider/src/hooks/use-global-config";
import zhCn from "element-plus/es/locale/lang/zh-cn";
import "element-plus/es/components/alert/style/css";
import "element-plus/es/components/button/style/css";
import "element-plus/es/components/card/style/css";
import "element-plus/es/components/checkbox/style/css";
import "element-plus/es/components/container/style/css";
import "element-plus/es/components/date-picker/style/css";
import "element-plus/es/components/descriptions/style/css";
import "element-plus/es/components/dialog/style/css";
import "element-plus/es/components/divider/style/css";
import "element-plus/es/components/dropdown/style/css";
import "element-plus/es/components/empty/style/css";
import "element-plus/es/components/form/style/css";
import "element-plus/es/components/icon/style/css";
import "element-plus/es/components/input/style/css";
import "element-plus/es/components/input-number/style/css";
import "element-plus/es/components/loading/style/css";
import "element-plus/es/components/menu/style/css";
import "element-plus/es/components/message/style/css";
import "element-plus/es/components/message-box/style/css";
import "element-plus/es/components/pagination/style/css";
import "element-plus/es/components/radio/style/css";
import "element-plus/es/components/scrollbar/style/css";
import "element-plus/es/components/select/style/css";
import "element-plus/es/components/switch/style/css";
import "element-plus/es/components/table/style/css";
import "element-plus/es/components/tabs/style/css";
import "element-plus/es/components/tag/style/css";
import "element-plus/theme-chalk/dark/css-vars.css";
import "./styles.css";
import App from "./App.vue";

const app = createApp(App);

[
  ElAlert,
  ElAside,
  ElButton,
  ElCard,
  ElContainer,
  ElDialog,
  ElDivider,
  ElDropdown,
  ElDropdownItem,
  ElDropdownMenu,
  ElEmpty,
  ElForm,
  ElFormItem,
  ElHeader,
  ElIcon,
  ElInput,
  ElLoading,
  ElMain,
  ElMenu,
  ElMenuItem,
  ElMenuItemGroup,
  ElScrollbar,
  ElSwitch,
  ElTag,
].forEach((component) => app.use(component));

provideGlobalConfig({ locale: zhCn }, app, true);
app.mount("#app");
