import { browser } from 'wxt/browser';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    let sessionStartTime: number | null = null;
    let currentUrl: string = window.location.href;

    const startSession = () => {
      if (sessionStartTime === null) {
        sessionStartTime = Date.now();
        currentUrl = window.location.href;
        browser.runtime.sendMessage({
          type: 'PAGE_ACTIVATED',
          payload: { url: currentUrl },
        });
      }
    };

    const endSession = () => {
      if (sessionStartTime !== null) {
        const sessionEndTime = Date.now();
        const faviconUrl = findFavicon();
        browser.runtime.sendMessage({
          type: 'PAGE_DEACTIVATED',
          payload: {
            url: currentUrl,
            startTime: sessionStartTime,
            endTime: sessionEndTime,
            faviconUrl,
          },
        });
        sessionStartTime = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startSession();
      } else {
        endSession();
      }
    };

    const handleUrlChange = () => {
      endSession();
      startSession();
    };

    // 监听 SPA 路由变化
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);

    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      originalPushState.apply(this, args);
      handleUrlChange();
    };

    const originalReplaceState = history.replaceState;
    history.replaceState = function (...args) {
      originalReplaceState.apply(this, args);
      handleUrlChange();
    };

    // 监听标签页激活/失活
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 页面加载时，如果可见，则直接开始会话
    if (document.visibilityState === 'visible') {
      startSession();
    }

    // 页面卸载前，结束会话
    window.addEventListener('beforeunload', endSession);

    function findFavicon(): string | undefined {
      let favicon = Array.from(document.querySelectorAll<HTMLLinkElement>("link[rel*='icon']")).find(el => el.href);
      return favicon?.href;
    }
  },
});