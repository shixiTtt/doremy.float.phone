// ── 设备性能分级 ──────────────────────────────────────────────
// 目的：在低配 / 安卓 WebView / 华为 HarmonyOS 上自动切到「流畅模式」。
//
// 为什么需要它：
//   - 全站大量使用 backdrop-filter（毛玻璃）与循环环境动画，在 Kirin / 老 WebView
//     上几乎是最大的 GPU 开销，真机上会表现为「滑动掉帧、点哪都卡」。
//   - 桌面浏览器性能充足，保持高质量；手机壳里默认降级。
//
// 落点：给 <html> 挂 data-perf="low" | "high"，styles/performance.css 依此
// 关闭毛玻璃与循环动画。首帧前由 app/layout.tsx 的内联脚本先挂一次，避免
// 先渲染重特效再降级的闪动。
//
// 用户可在「设置 → Runtime → 低配流畅模式」手动覆盖，偏好存在 localStorage。

export type PerfTier = "low" | "high";
export type PerfPreference = "auto" | "low" | "high";

export const PERF_STORAGE_KEY = "ai_phone_perf_mode_v1";
export const PERF_ATTR = "data-perf";

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

/** 自动判断当前设备是否应按低配渲染。 */
export function detectAutoPerfTier(): PerfTier {
    if (typeof window === "undefined") return "high";

    const ua = navigator.userAgent || "";
    // 安卓壳：UA 追加了 FloatShell/<版本>，并且注入了 window.AndroidShell。
    const inShell = /FloatShell/i.test(ua)
        || Boolean((window as unknown as { AndroidShell?: unknown }).AndroidShell);
    // 华为 HarmonyOS / ArkWeb：系统 WebView 的 GPU 路径比桌面 Chrome 慢不少。
    const isHarmony = /HarmonyOS|OpenHarmony|ArkWeb/i.test(ua);

    const cores = navigator.hardwareConcurrency || 8;
    const memory = (navigator as NavigatorWithMemory).deviceMemory || 8;

    return (inShell || isHarmony || cores <= 4 || memory <= 4) ? "low" : "high";
}

/** 读取用户偏好；未设置时返回 auto。 */
export function loadPerfPreference(): PerfPreference {
    if (typeof window === "undefined") return "auto";
    try {
        const stored = window.localStorage.getItem(PERF_STORAGE_KEY);
        if (stored === "low" || stored === "high" || stored === "auto") return stored;
    } catch {
        /* 隐私模式 / 存储被禁用时退回自动 */
    }
    return "auto";
}

export function savePerfPreference(preference: PerfPreference): void {
    if (typeof window === "undefined") return;
    try {
        window.localStorage.setItem(PERF_STORAGE_KEY, preference);
    } catch {
        /* 忽略存储失败 */
    }
}

/** 结合偏好与自动检测，算出最终档位。 */
export function resolvePerfTier(preference: PerfPreference = loadPerfPreference()): PerfTier {
    if (preference === "low" || preference === "high") return preference;
    return detectAutoPerfTier();
}

/** 把档位写到 <html data-perf>，CSS 据此生效。 */
export function applyPerfTier(tier: PerfTier): void {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute(PERF_ATTR, tier);
}

/** 当前是否处于流畅（低配）模式。 */
export function isPerfLowActive(): boolean {
    return resolvePerfTier() === "low";
}

/**
 * 手动开启 / 关闭流畅模式。
 * 开启 = 固定 low；关闭 = 固定 high（不再自动检测，方便用户自行对比）。
 */
export function applyPerfLowMode(low: boolean): void {
    savePerfPreference(low ? "low" : "high");
    applyPerfTier(low ? "low" : "high");
}

/** 首帧前内联脚本会用到的最小检测逻辑，导出为字符串供 layout 注入。 */
export function buildPerfBootstrapScript(): string {
    return `(function(){try{`
        + `var ua=navigator.userAgent||"";`
        + `var shell=/FloatShell/i.test(ua)||!!(window&&window.AndroidShell);`
        + `var harmony=/HarmonyOS|OpenHarmony|ArkWeb/i.test(ua);`
        + `var cores=navigator.hardwareConcurrency||8;`
        + `var mem=navigator.deviceMemory||8;`
        + `var pref="auto";try{pref=localStorage.getItem("${PERF_STORAGE_KEY}")||"auto";}catch(e){}`
        + `var low;`
        + `if(pref==="low")low=true;`
        + `else if(pref==="high")low=false;`
        + `else low=shell||harmony||cores<=4||mem<=4;`
        + `document.documentElement.setAttribute("${PERF_ATTR}",low?"low":"high");`
        + `}catch(e){}})();`;
}
