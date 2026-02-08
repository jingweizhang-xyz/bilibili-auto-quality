// ==UserScript==
// @name         Bilibili Auto Quality (Ordered)
// @namespace    https://github.com/jingweizhang-xyz/bilibili-auto-quality
// @version      1.0
// @description  根据配置的清晰度顺序，自动选择并设置B站播放器清晰度
// @author       You
// @match        https://www.bilibili.com/video/*
// @icon         https://www.bilibili.com/favicon.ico
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
  'use strict';

  // 配置：清晰度顺序（从高到低）。脚本会选中第一个在视频可用列表中的清晰度。
  // 画质码对应关系（常见）：120=超清4K, 116=高清1080P60, 80=高清1080P, 64=高清720P, 32=清晰480P, 16=流畅360P
  const RESOLUTION_ORDER = [
    120,  // 超清 4K
    116,  // 高清 1080P60
    112,  // 高清 1080P 高码率
    80,   // 高清 1080P
    64,   // 高清 720P
    32,   // 清晰 480P
    16,   // 流畅 360P
  ];

  // 日志前缀
  const LOG_PREFIX = '[BiliAutoQuality]';

  function log(...args) {
    console.log(LOG_PREFIX, ...args);
  }
  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  // 获取画质数据
  function getQualityData() {
    const pi = window.__playinfo__;
    if (!pi || !pi.data) return null;
    const accept = pi.data.accept_quality || [];
    const desc = pi.data.accept_description || [];
    if (!accept.length) return null;
    return { accept, desc };
  }

  // 选择目标画质
  function selectTargetQuality(accept) {
    for (const q of RESOLUTION_ORDER) {
      if (accept.includes(q)) return q;
    }
    // fallback 到最高可用
    return accept[0];
  }

  // 设置画质
  function setQuality(q) {
    const player = window.player;
    if (!player) return false;

    // 如果播放器暴露了获取支持列表的方法，打印日志便于调试
    const supported = player.getSupportedQualityList;
    if (typeof supported === 'function') {
      try {
        log('支持画质列表:', supported.call(player));
      } catch {}
    }

    // 优先使用 requestQuality（B站 PC 网页播放器实现）
    if (typeof player.requestQuality === 'function') {
      try {
        player.requestQuality(q, null).then(
          () => log(`画质已设置为: ${q}`),
          (e) => warn(`调用 requestQuality 失败`, e)
        );
        return true;
      } catch (e) {
        warn(`调用 requestQuality 抛出异常`, e);
      }
    }

    // 兜底：旧版可能存在的接口
    const methods = ['setQuality', 'setPlaybackQuality'];
    for (const method of methods) {
      if (typeof player[method] === 'function') {
        try {
          player[method](q);
          log(`画质已设置为: ${q}`);
          return true;
        } catch (e) {
          warn(`调用 ${method} 失败`, e);
        }
      }
    }

    warn('未找到有效的画质设置方法');
    return false;
  }

  // 检查并设置
  function trySetQuality() {
    const data = getQualityData();
    if (!data) {
      warn('未找到画质数据');
      return false;
    }
    const q = selectTargetQuality(data.accept);
    if (!setQuality(q)) return false;

    const desc = data.desc[data.accept.indexOf(q)] || String(q);
    log(`已选择画质: ${desc} (${q})`);
    return true;
  }

  // 等待播放器挂载
  function waitForPlayerAndSet() {
    let attempts = 0;
    const maxAttempts = 40; // 约 20 秒
    const interval = 500;

    const id = window.setInterval(() => {
      attempts += 1;
      const ok = trySetQuality();
      if (ok) {
        window.clearInterval(id);
        return;
      }
      if (attempts >= maxAttempts) {
        window.clearInterval(id);
        warn('已达到最大重试次数，停止自动设置');
      }
    }, interval);
  }

  // 入口
  function main() {
    // 如果已经加载完成，立即尝试
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      if (!trySetQuality()) {
        waitForPlayerAndSet();
      }
      return;
    }

    // 否则等待 DOM 加载
    document.addEventListener('DOMContentLoaded', () => {
      if (!trySetQuality()) {
        waitForPlayerAndSet();
      }
    }, { once: true });
  }

  main();
})();
