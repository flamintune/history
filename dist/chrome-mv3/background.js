var background = function() {
  "use strict";
  var _a, _b;
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
  }
  function extractDomain(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
    } catch (e) {
      return url;
    }
  }
  async function analyzeHistory(startTime, endTime) {
    const historyItems = await chrome.history.search({
      text: "",
      // 空字符串匹配所有记录
      startTime,
      // 开始时间
      endTime,
      // 结束时间
      maxResults: 5e3
      // 最大结果数量
    });
    const stats = {
      totalVisits: 0,
      uniqueDomains: 0,
      topDomains: [],
      hourlyActivity: {},
      dailyActivity: {}
    };
    const domainCount = {};
    for (const item of historyItems) {
      if (!item.url) continue;
      stats.totalVisits++;
      const domain = extractDomain(item.url);
      domainCount[domain] = (domainCount[domain] || 0) + 1;
      if (item.lastVisitTime) {
        const date = new Date(item.lastVisitTime);
        const hour = date.getHours();
        stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;
        const dateString = date.toISOString().split("T")[0];
        stats.dailyActivity[dateString] = (stats.dailyActivity[dateString] || 0) + 1;
      }
    }
    stats.uniqueDomains = Object.keys(domainCount).length;
    stats.topDomains = Object.entries(domainCount).map(([domain, visits]) => ({ domain, visits })).sort((a, b) => b.visits - a.visits).slice(0, 10);
    return stats;
  }
  async function getTodayStats() {
    const now = /* @__PURE__ */ new Date();
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    ).getTime();
    return await analyzeHistory(startOfDay, now.getTime());
  }
  background;
  async function saveDailyStats(date, stats) {
    await chrome.storage.local.set({ [`stats_${date}`]: stats });
    const { availableDates = [] } = await chrome.storage.local.get(
      "availableDates"
    );
    if (!availableDates.includes(date)) {
      availableDates.push(date);
      await chrome.storage.local.set({ availableDates });
    }
  }
  background;
  const definition = defineBackground({
    main() {
      setupAlarms();
      updateDailyStats();
    }
  });
  function setupAlarms() {
    chrome.alarms.create("dailyStats", {
      periodInMinutes: 24 * 60,
      // 每24小时
      when: getNextMidnight()
      // 下一个午夜时间点
    });
    chrome.alarms.create("updateTodayStats", {
      periodInMinutes: 60
      // 每60分钟
    });
    chrome.alarms.onAlarm.addListener((alarm) => {
      if (alarm.name === "dailyStats") {
        const yesterday = /* @__PURE__ */ new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const dateString = yesterday.toISOString().split("T")[0];
        collectAndSaveStats(dateString);
      } else if (alarm.name === "updateTodayStats") {
        updateDailyStats();
      }
    });
  }
  function getNextMidnight() {
    const tomorrow = /* @__PURE__ */ new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime();
  }
  async function collectAndSaveStats(dateString) {
    const date = new Date(dateString);
    const startTime = date.getTime();
    const endTime = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
    try {
      const stats = await chrome.history.search({
        text: "",
        startTime,
        endTime,
        maxResults: 1e4
      });
      const analyzedStats = await analyzeHistory(startTime, endTime);
      await saveDailyStats(dateString, analyzedStats);
    } catch (error) {
      console.error("Error collecting history stats:", error);
    }
  }
  async function updateDailyStats() {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    try {
      const stats = await getTodayStats();
      await saveDailyStats(today, stats);
    } catch (error) {
      console.error("Error updating today stats:", error);
    }
  }
  background;
  function initPlugins() {
  }
  const browser = (
    // @ts-expect-error
    ((_b = (_a = globalThis.browser) == null ? void 0 : _a.runtime) == null ? void 0 : _b.id) == null ? globalThis.chrome : (
      // @ts-expect-error
      globalThis.browser
    )
  );
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = `${"ws:"}//${"localhost"}:${3e3}`;
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws == null ? void 0 : ws.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws == null ? void 0 : ws.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([{ ...contentScript, id }]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([{ ...contentScript, id }]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      var _a2, _b2;
      const hasJs = (_a2 = contentScript.js) == null ? void 0 : _a2.find((js) => {
        var _a3;
        return (_a3 = cs.js) == null ? void 0 : _a3.includes(js);
      });
      const hasCss = (_b2 = contentScript.css) == null ? void 0 : _b2.find((css) => {
        var _a3;
        return (_a3 = cs.css) == null ? void 0 : _a3.includes(css);
      });
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
}();
background;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjE5LjI4X0B0eXBlcytub2RlQDIyLjEzLjlfcm9sbHVwQDQuMzQuOV95YW1sQDIuNy4xL25vZGVfbW9kdWxlcy93eHQvZGlzdC9zYW5kYm94L2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS9Ad2ViZXh0LWNvcmUrbWF0Y2gtcGF0dGVybnNAMS4wLjMvbm9kZV9tb2R1bGVzL0B3ZWJleHQtY29yZS9tYXRjaC1wYXR0ZXJucy9saWIvaW5kZXguanMiLCIuLi8uLi9saWIvaGlzdG9yeS1hbmFseXplci50cyIsIi4uLy4uL2xpYi9zdG9yYWdlLW1hbmFnZXIudHMiLCIuLi8uLi9lbnRyeXBvaW50cy9iYWNrZ3JvdW5kLnRzIiwiLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjE5LjI4X0B0eXBlcytub2RlQDIyLjEzLjlfcm9sbHVwQDQuMzQuOV95YW1sQDIuNy4xL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyL2Nocm9tZS5tanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUJhY2tncm91bmQoYXJnKSB7XG4gIGlmIChhcmcgPT0gbnVsbCB8fCB0eXBlb2YgYXJnID09PSBcImZ1bmN0aW9uXCIpIHJldHVybiB7IG1haW46IGFyZyB9O1xuICByZXR1cm4gYXJnO1xufVxuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiIsIi8vIOWumuS5ieWIhuaekOeahOaVsOaNrue7k+aehFxuZXhwb3J0IGludGVyZmFjZSBIaXN0b3J5U3RhdHMge1xuICB0b3RhbFZpc2l0czogbnVtYmVyO1xuICB1bmlxdWVEb21haW5zOiBudW1iZXI7XG4gIHRvcERvbWFpbnM6IEFycmF5PHsgZG9tYWluOiBzdHJpbmc7IHZpc2l0czogbnVtYmVyIH0+O1xuICBob3VybHlBY3Rpdml0eTogUmVjb3JkPG51bWJlciwgbnVtYmVyPjsgLy8g5bCP5pe2IC0+IOiuv+mXruaVsOmHj1xuICBkYWlseUFjdGl2aXR5OiBSZWNvcmQ8c3RyaW5nLCBudW1iZXI+OyAvLyDml6XmnJ8gLT4g6K6/6Zeu5pWw6YePXG59XG5cbi8vIOS7jlVSTOS4reaPkOWPluWfn+WQjVxuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3REb21haW4odXJsOiBzdHJpbmcpOiBzdHJpbmcge1xuICB0cnkge1xuICAgIGNvbnN0IGhvc3RuYW1lID0gbmV3IFVSTCh1cmwpLmhvc3RuYW1lO1xuICAgIHJldHVybiBob3N0bmFtZS5zdGFydHNXaXRoKFwid3d3LlwiKSA/IGhvc3RuYW1lLnNsaWNlKDQpIDogaG9zdG5hbWU7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICByZXR1cm4gdXJsO1xuICB9XG59XG5cbi8vIOWIhuaekOaMh+WumuaXtumXtOauteeahOWOhuWPsuiusOW9lVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGFuYWx5emVIaXN0b3J5KFxuICBzdGFydFRpbWU6IG51bWJlcixcbiAgZW5kVGltZTogbnVtYmVyXG4pOiBQcm9taXNlPEhpc3RvcnlTdGF0cz4ge1xuICAvLyDmn6Xor6Lljoblj7LorrDlvZVcbiAgY29uc3QgaGlzdG9yeUl0ZW1zID0gYXdhaXQgY2hyb21lLmhpc3Rvcnkuc2VhcmNoKHtcbiAgICB0ZXh0OiBcIlwiLCAvLyDnqbrlrZfnrKbkuLLljLnphY3miYDmnInorrDlvZVcbiAgICBzdGFydFRpbWU6IHN0YXJ0VGltZSwgLy8g5byA5aeL5pe26Ze0XG4gICAgZW5kVGltZTogZW5kVGltZSwgLy8g57uT5p2f5pe26Ze0XG4gICAgbWF4UmVzdWx0czogNTAwMCwgLy8g5pyA5aSn57uT5p6c5pWw6YePXG4gIH0pO1xuXG4gIC8vIOWIneWni+WMlue7n+iuoeaVsOaNrlxuICBjb25zdCBzdGF0czogSGlzdG9yeVN0YXRzID0ge1xuICAgIHRvdGFsVmlzaXRzOiAwLFxuICAgIHVuaXF1ZURvbWFpbnM6IDAsXG4gICAgdG9wRG9tYWluczogW10sXG4gICAgaG91cmx5QWN0aXZpdHk6IHt9LFxuICAgIGRhaWx5QWN0aXZpdHk6IHt9LFxuICB9O1xuXG4gIC8vIOWfn+WQjeiuoeaVsFxuICBjb25zdCBkb21haW5Db3VudDogUmVjb3JkPHN0cmluZywgbnVtYmVyPiA9IHt9O1xuXG4gIC8vIOWIhuaekOavj+S4quWOhuWPsuiusOW9lemhuVxuICBmb3IgKGNvbnN0IGl0ZW0gb2YgaGlzdG9yeUl0ZW1zKSB7XG4gICAgaWYgKCFpdGVtLnVybCkgY29udGludWU7XG5cbiAgICBzdGF0cy50b3RhbFZpc2l0cysrO1xuXG4gICAgLy8g57uf6K6h5Z+f5ZCNXG4gICAgY29uc3QgZG9tYWluID0gZXh0cmFjdERvbWFpbihpdGVtLnVybCk7XG4gICAgZG9tYWluQ291bnRbZG9tYWluXSA9IChkb21haW5Db3VudFtkb21haW5dIHx8IDApICsgMTtcblxuICAgIC8vIOe7n+iuoeWwj+aXtua0u+WKqFxuICAgIGlmIChpdGVtLmxhc3RWaXNpdFRpbWUpIHtcbiAgICAgIGNvbnN0IGRhdGUgPSBuZXcgRGF0ZShpdGVtLmxhc3RWaXNpdFRpbWUpO1xuICAgICAgY29uc3QgaG91ciA9IGRhdGUuZ2V0SG91cnMoKTtcbiAgICAgIHN0YXRzLmhvdXJseUFjdGl2aXR5W2hvdXJdID0gKHN0YXRzLmhvdXJseUFjdGl2aXR5W2hvdXJdIHx8IDApICsgMTtcblxuICAgICAgLy8g57uf6K6h5pel5pyf5rS75YqoXG4gICAgICBjb25zdCBkYXRlU3RyaW5nID0gZGF0ZS50b0lTT1N0cmluZygpLnNwbGl0KFwiVFwiKVswXTsgLy8gWVlZWS1NTS1ERFxuICAgICAgc3RhdHMuZGFpbHlBY3Rpdml0eVtkYXRlU3RyaW5nXSA9XG4gICAgICAgIChzdGF0cy5kYWlseUFjdGl2aXR5W2RhdGVTdHJpbmddIHx8IDApICsgMTtcbiAgICB9XG4gIH1cblxuICAvLyDorqHnrpfllK/kuIDln5/lkI3mlbDph49cbiAgc3RhdHMudW5pcXVlRG9tYWlucyA9IE9iamVjdC5rZXlzKGRvbWFpbkNvdW50KS5sZW5ndGg7XG5cbiAgLy8g6K6h566X6K6/6Zeu5pyA5aSa55qE5Z+f5ZCNXG4gIHN0YXRzLnRvcERvbWFpbnMgPSBPYmplY3QuZW50cmllcyhkb21haW5Db3VudClcbiAgICAubWFwKChbZG9tYWluLCB2aXNpdHNdKSA9PiAoeyBkb21haW4sIHZpc2l0cyB9KSlcbiAgICAuc29ydCgoYSwgYikgPT4gYi52aXNpdHMgLSBhLnZpc2l0cylcbiAgICAuc2xpY2UoMCwgMTApOyAvLyDliY0xMOWQjVxuXG4gIHJldHVybiBzdGF0cztcbn1cblxuLy8g6I635Y+W5LuK5aSp55qE5Y6G5Y+y57uf6K6hXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0VG9kYXlTdGF0cygpOiBQcm9taXNlPEhpc3RvcnlTdGF0cz4ge1xuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpO1xuICBjb25zdCBzdGFydE9mRGF5ID0gbmV3IERhdGUoXG4gICAgbm93LmdldEZ1bGxZZWFyKCksXG4gICAgbm93LmdldE1vbnRoKCksXG4gICAgbm93LmdldERhdGUoKVxuICApLmdldFRpbWUoKTtcbiAgcmV0dXJuIGF3YWl0IGFuYWx5emVIaXN0b3J5KHN0YXJ0T2ZEYXksIG5vdy5nZXRUaW1lKCkpO1xufVxuXG4vLyDojrflj5bov4fljrvkuIDlkajnmoTljoblj7Lnu5/orqFcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRXZWVrU3RhdHMoKTogUHJvbWlzZTxIaXN0b3J5U3RhdHM+IHtcbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKTtcbiAgY29uc3Qgd2Vla0FnbyA9IG5ldyBEYXRlKG5vdy5nZXRUaW1lKCkgLSA3ICogMjQgKiA2MCAqIDYwICogMTAwMCkuZ2V0VGltZSgpO1xuICByZXR1cm4gYXdhaXQgYW5hbHl6ZUhpc3Rvcnkod2Vla0Fnbywgbm93LmdldFRpbWUoKSk7XG59XG4iLCJpbXBvcnQgdHlwZSB7IEhpc3RvcnlTdGF0cyB9IGZyb20gXCIuL2hpc3RvcnktYW5hbHl6ZXJcIjtcblxuLy8g5L+d5a2Y5q+P5pel57uf6K6hXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gc2F2ZURhaWx5U3RhdHMoXG4gIGRhdGU6IHN0cmluZyxcbiAgc3RhdHM6IEhpc3RvcnlTdGF0c1xuKTogUHJvbWlzZTx2b2lkPiB7XG4gIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IFtgc3RhdHNfJHtkYXRlfWBdOiBzdGF0cyB9KTtcblxuICAvLyDmm7TmlrDnu5/orqHml6XmnJ/liJfooahcbiAgY29uc3QgeyBhdmFpbGFibGVEYXRlcyA9IFtdIH0gPSBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoXG4gICAgXCJhdmFpbGFibGVEYXRlc1wiXG4gICk7XG4gIGlmICghYXZhaWxhYmxlRGF0ZXMuaW5jbHVkZXMoZGF0ZSkpIHtcbiAgICBhdmFpbGFibGVEYXRlcy5wdXNoKGRhdGUpO1xuICAgIGF3YWl0IGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IGF2YWlsYWJsZURhdGVzIH0pO1xuICB9XG59XG5cbi8vIOWKoOi9veeJueWumuaXpeacn+eahOe7n+iuoVxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGxvYWRTdGF0cyhkYXRlOiBzdHJpbmcpOiBQcm9taXNlPEhpc3RvcnlTdGF0cyB8IG51bGw+IHtcbiAgY29uc3QgcmVzdWx0ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KGBzdGF0c18ke2RhdGV9YCk7XG4gIHJldHVybiByZXN1bHRbYHN0YXRzXyR7ZGF0ZX1gXSB8fCBudWxsO1xufVxuXG4vLyDojrflj5bmiYDmnInlj6/nlKjnmoTnu5/orqHml6XmnJ9cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRBdmFpbGFibGVEYXRlcygpOiBQcm9taXNlPHN0cmluZ1tdPiB7XG4gIGNvbnN0IHsgYXZhaWxhYmxlRGF0ZXMgPSBbXSB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFxuICAgIFwiYXZhaWxhYmxlRGF0ZXNcIlxuICApO1xuICByZXR1cm4gYXZhaWxhYmxlRGF0ZXMuc29ydCgpLnJldmVyc2UoKTsgLy8g5pyA5paw5pel5pyf5Zyo5YmNXG59XG5cbi8vIOa4hemZpOaJgOaciee7n+iuoeaVsOaNrlxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNsZWFyQWxsU3RhdHMoKTogUHJvbWlzZTx2b2lkPiB7XG4gIGNvbnN0IHsgYXZhaWxhYmxlRGF0ZXMgPSBbXSB9ID0gYXdhaXQgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFxuICAgIFwiYXZhaWxhYmxlRGF0ZXNcIlxuICApO1xuXG4gIC8vIOWIoOmZpOavj+S4quaXpeacn+eahOe7n+iuoeaVsOaNrlxuICBmb3IgKGNvbnN0IGRhdGUgb2YgYXZhaWxhYmxlRGF0ZXMpIHtcbiAgICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoYHN0YXRzXyR7ZGF0ZX1gKTtcbiAgfVxuXG4gIC8vIOa4hemZpOaXpeacn+WIl+ihqFxuICBhd2FpdCBjaHJvbWUuc3RvcmFnZS5sb2NhbC5yZW1vdmUoXCJhdmFpbGFibGVEYXRlc1wiKTtcbn1cbiIsImltcG9ydCB7IGRlZmluZUJhY2tncm91bmQgfSBmcm9tICd3eHQvc2FuZGJveCc7XG5pbXBvcnQgeyBhbmFseXplSGlzdG9yeSwgZ2V0VG9kYXlTdGF0cyB9IGZyb20gJy4uL2xpYi9oaXN0b3J5LWFuYWx5emVyJztcbmltcG9ydCB7IHNhdmVEYWlseVN0YXRzIH0gZnJvbSAnLi4vbGliL3N0b3JhZ2UtbWFuYWdlcic7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUJhY2tncm91bmQoe1xuICBtYWluKCkge1xuICAgIC8vIOWIneWni+WMllxuICAgIHNldHVwQWxhcm1zKCk7XG4gICAgXG4gICAgLy8g6aaW5qyh6L+Q6KGM5pe25pS26ZuG5pWw5o2uXG4gICAgdXBkYXRlRGFpbHlTdGF0cygpO1xuICB9XG59KTtcblxuLy8g6K6+572u5q+P5pel5a6a5pe25Lu75YqhXG5mdW5jdGlvbiBzZXR1cEFsYXJtcygpIHtcbiAgLy8g5q+P5aSp5Y2I5aSc6L+Q6KGMXG4gIGNocm9tZS5hbGFybXMuY3JlYXRlKCdkYWlseVN0YXRzJywge1xuICAgIHBlcmlvZEluTWludXRlczogMjQgKiA2MCwgLy8g5q+PMjTlsI/ml7ZcbiAgICB3aGVuOiBnZXROZXh0TWlkbmlnaHQoKSAvLyDkuIvkuIDkuKrljYjlpJzml7bpl7TngrlcbiAgfSk7XG4gIFxuICAvLyDmr4/lsI/ml7bmm7TmlrDku4rml6XmlbDmja5cbiAgY2hyb21lLmFsYXJtcy5jcmVhdGUoJ3VwZGF0ZVRvZGF5U3RhdHMnLCB7XG4gICAgcGVyaW9kSW5NaW51dGVzOiA2MCAvLyDmr482MOWIhumSn1xuICB9KTtcbiAgXG4gIC8vIOebkeWQrOWumuaXtuWZqOinpuWPkVxuICBjaHJvbWUuYWxhcm1zLm9uQWxhcm0uYWRkTGlzdGVuZXIoKGFsYXJtKSA9PiB7XG4gICAgaWYgKGFsYXJtLm5hbWUgPT09ICdkYWlseVN0YXRzJykge1xuICAgICAgLy8g5q+P5aSp5Y2I5aSc5aSE55CGXG4gICAgICBjb25zdCB5ZXN0ZXJkYXkgPSBuZXcgRGF0ZSgpO1xuICAgICAgeWVzdGVyZGF5LnNldERhdGUoeWVzdGVyZGF5LmdldERhdGUoKSAtIDEpO1xuICAgICAgY29uc3QgZGF0ZVN0cmluZyA9IHllc3RlcmRheS50b0lTT1N0cmluZygpLnNwbGl0KCdUJylbMF07XG4gICAgICBcbiAgICAgIC8vIOS/neWtmOaYqOWkqeeahOe7n+iuoVxuICAgICAgY29sbGVjdEFuZFNhdmVTdGF0cyhkYXRlU3RyaW5nKTtcbiAgICB9IGVsc2UgaWYgKGFsYXJtLm5hbWUgPT09ICd1cGRhdGVUb2RheVN0YXRzJykge1xuICAgICAgLy8g5pu05paw5LuK5aSp55qE57uf6K6hXG4gICAgICB1cGRhdGVEYWlseVN0YXRzKCk7XG4gICAgfVxuICB9KTtcbn1cblxuLy8g6I635Y+W5LiL5LiA5Liq5Y2I5aSc55qE5pe26Ze05oizXG5mdW5jdGlvbiBnZXROZXh0TWlkbmlnaHQoKTogbnVtYmVyIHtcbiAgY29uc3QgdG9tb3Jyb3cgPSBuZXcgRGF0ZSgpO1xuICB0b21vcnJvdy5zZXREYXRlKHRvbW9ycm93LmdldERhdGUoKSArIDEpO1xuICB0b21vcnJvdy5zZXRIb3VycygwLCAwLCAwLCAwKTtcbiAgcmV0dXJuIHRvbW9ycm93LmdldFRpbWUoKTtcbn1cblxuLy8g5pS26ZuG5bm25L+d5a2Y5oyH5a6a5pel5pyf55qE57uf6K6hXG5hc3luYyBmdW5jdGlvbiBjb2xsZWN0QW5kU2F2ZVN0YXRzKGRhdGVTdHJpbmc6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuICBjb25zdCBkYXRlID0gbmV3IERhdGUoZGF0ZVN0cmluZyk7XG4gIGNvbnN0IHN0YXJ0VGltZSA9IGRhdGUuZ2V0VGltZSgpO1xuICBjb25zdCBlbmRUaW1lID0gbmV3IERhdGUoZGF0ZS5nZXRGdWxsWWVhcigpLCBkYXRlLmdldE1vbnRoKCksIGRhdGUuZ2V0RGF0ZSgpICsgMSkuZ2V0VGltZSgpIC0gMTtcbiAgXG4gIHRyeSB7XG4gICAgY29uc3Qgc3RhdHMgPSBhd2FpdCBjaHJvbWUuaGlzdG9yeS5zZWFyY2goe1xuICAgICAgdGV4dDogJycsXG4gICAgICBzdGFydFRpbWUsXG4gICAgICBlbmRUaW1lLFxuICAgICAgbWF4UmVzdWx0czogMTAwMDBcbiAgICB9KTtcbiAgICBcbiAgICAvLyDliIbmnpDlkozkv53lrZjljoblj7LmlbDmja5cbiAgICBjb25zdCBhbmFseXplZFN0YXRzID0gYXdhaXQgYW5hbHl6ZUhpc3Rvcnkoc3RhcnRUaW1lLCBlbmRUaW1lKTtcbiAgICBhd2FpdCBzYXZlRGFpbHlTdGF0cyhkYXRlU3RyaW5nLCBhbmFseXplZFN0YXRzKTtcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvciBjb2xsZWN0aW5nIGhpc3Rvcnkgc3RhdHM6JywgZXJyb3IpO1xuICB9XG59XG5cbi8vIOabtOaWsOS7iuWkqeeahOe7n+iuoVxuYXN5bmMgZnVuY3Rpb24gdXBkYXRlRGFpbHlTdGF0cygpOiBQcm9taXNlPHZvaWQ+IHtcbiAgY29uc3QgdG9kYXkgPSBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCkuc3BsaXQoJ1QnKVswXTtcbiAgdHJ5IHtcbiAgICBjb25zdCBzdGF0cyA9IGF3YWl0IGdldFRvZGF5U3RhdHMoKTtcbiAgICBhd2FpdCBzYXZlRGFpbHlTdGF0cyh0b2RheSwgc3RhdHMpO1xuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHVwZGF0aW5nIHRvZGF5IHN0YXRzOicsIGVycm9yKTtcbiAgfVxufSIsImV4cG9ydCBjb25zdCBicm93c2VyID0gKFxuICAvLyBAdHMtZXhwZWN0LWVycm9yXG4gIGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWQgPT0gbnVsbCA/IGdsb2JhbFRoaXMuY2hyb21lIDogKFxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3JcbiAgICBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgKVxuKTtcbiJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUs7QUFDbEUsV0FBTztBQUFBLEVBQ1Q7QUNGQSxNQUFJLGdCQUFnQixNQUFNO0FBQUEsSUFDeEIsWUFBWSxjQUFjO0FBQ3hCLFVBQUksaUJBQWlCLGNBQWM7QUFDakMsYUFBSyxZQUFZO0FBQ2pCLGFBQUssa0JBQWtCLENBQUMsR0FBRyxjQUFjLFNBQVM7QUFDbEQsYUFBSyxnQkFBZ0I7QUFDckIsYUFBSyxnQkFBZ0I7QUFBQSxNQUMzQixP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
