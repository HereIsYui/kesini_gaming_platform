import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  watch,
  type Ref,
} from "vue";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type ModalStackOptions = {
  modalFocusKey: Readonly<Ref<string>>;
  closeTopOverlay: () => boolean;
};

export function useModalStack(options: ModalStackOptions) {
  let pageScrollSnapshot: { body: string; html: string } | null = null;
  let modalReturnFocusTarget: HTMLElement | null = null;
  const modalOverlayOpen = computed(() => Boolean(options.modalFocusKey.value));

  function setPageScrollLocked(locked: boolean) {
    if (locked) {
      if (pageScrollSnapshot) {
        return;
      }
      pageScrollSnapshot = {
        body: document.body.style.overflow,
        html: document.documentElement.style.overflow,
      };
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      return;
    }
    if (!pageScrollSnapshot) {
      return;
    }
    document.body.style.overflow = pageScrollSnapshot.body;
    document.documentElement.style.overflow = pageScrollSnapshot.html;
    pageScrollSnapshot = null;
  }

  function getTopModalElement() {
    const selectorByKey: Record<string, string> = {
      confirm: ".confirm-modal",
      share: ".share-text-modal",
      card: ".card-intro-modal",
      recycle: ".recycle-modal",
      upgrade: ".upgrade-modal",
      star: ".star-modal",
      listing: ".trade-create-modal",
      formation: ".formation-picker-modal",
      profile: ".profile-picker-modal",
      result: ".draw-result-modal",
      recharge: ".recharge-modal",
      launch: ".launch-activity-modal",
      history: ".draw-history-modal",
      pool: ".pool-detail-modal",
      announcement: ".announcement-modal",
    };
    const selector = selectorByKey[options.modalFocusKey.value];
    return selector
      ? (document.querySelector(selector) as HTMLElement | null)
      : null;
  }

  function isFocusableElement(element: Element): element is HTMLElement {
    if (!(element instanceof HTMLElement)) {
      return false;
    }
    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }
    return element.getClientRects().length > 0;
  }

  function getModalFocusableElements(container: HTMLElement) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
      isFocusableElement,
    );
  }

  function rememberModalReturnFocus(container: HTMLElement) {
    const activeElement = document.activeElement;
    if (
      !modalReturnFocusTarget &&
      activeElement instanceof HTMLElement &&
      !container.contains(activeElement)
    ) {
      modalReturnFocusTarget = activeElement;
    }
  }

  function focusTopModal() {
    const modal = getTopModalElement();
    if (!modal) {
      return;
    }
    rememberModalReturnFocus(modal);
    const focusable = getModalFocusableElements(modal);
    const target = focusable[0] || modal;
    if (!modal.hasAttribute("tabindex")) {
      modal.tabIndex = -1;
    }
    target.focus({ preventScroll: true });
  }

  function restoreModalReturnFocus() {
    const target = modalReturnFocusTarget;
    modalReturnFocusTarget = null;
    if (!target || !document.contains(target)) {
      return;
    }
    target.focus({ preventScroll: true });
  }

  function trapModalFocus(event: KeyboardEvent) {
    const modal = getTopModalElement();
    if (!modal) {
      return;
    }
    const focusable = getModalFocusableElements(modal);
    if (focusable.length === 0) {
      event.preventDefault();
      modal.focus({ preventScroll: true });
      return;
    }
    const activeElement = document.activeElement;
    const activeIndex =
      activeElement instanceof HTMLElement
        ? focusable.indexOf(activeElement)
        : -1;
    if (event.shiftKey) {
      if (activeIndex <= 0) {
        event.preventDefault();
        focusable[focusable.length - 1].focus({ preventScroll: true });
      }
      return;
    }
    if (activeIndex === -1 || activeIndex >= focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus({ preventScroll: true });
    }
  }

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === "Tab" && options.modalFocusKey.value) {
      trapModalFocus(event);
      return;
    }
    if (event.key !== "Escape") {
      return;
    }
    if (options.closeTopOverlay()) {
      event.preventDefault();
    }
  }

  onMounted(() => {
    window.addEventListener("keydown", handleGlobalKeydown);
  });

  onBeforeUnmount(() => {
    window.removeEventListener("keydown", handleGlobalKeydown);
    setPageScrollLocked(false);
  });

  watch(modalOverlayOpen, (open) => {
    setPageScrollLocked(open);
  });

  watch(options.modalFocusKey, async (key) => {
    if (!key) {
      restoreModalReturnFocus();
      return;
    }
    await nextTick();
    focusTopModal();
  });

  return {
    modalOverlayOpen,
    setPageScrollLocked,
    getTopModalElement,
    isFocusableElement,
    getModalFocusableElements,
    rememberModalReturnFocus,
    focusTopModal,
    restoreModalReturnFocus,
    trapModalFocus,
    handleGlobalKeydown,
  };
}
