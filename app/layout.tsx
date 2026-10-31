import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ChatPluginBootstrap } from "@/components/chat-plugin-bootstrap";
import { ChatReasoningVisibilityController } from "@/components/chat-reasoning-visibility-controller";
import { CSSImportEnhancer } from "@/components/css-import-enhancer";
import { PWAManifestInjector } from "@/components/pwa-manifest-injector";
import { PWARegistrar } from "@/components/pwa-registrar";
import { buildPerfBootstrapScript } from "@/lib/device-performance";
import { shellChannel } from "@/lib/mobile-shell";
import "../styles/fonts.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // Android 键盘弹出时让浏览器原生压缩布局视口（而非只压缩 visualViewport）。
  // 配合 desktop-shell 的 --phone-screen-height 同步：输入栏天然贴在键盘上方，
  // 点击命中区域由原生布局保证，彻底避免手动抬升带来的视觉/hit-test 错位。
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  title: "float",
  description: "float",
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 首帧前先挂 data-perf，避免"先渲染毛玻璃、再降级"的闪动。
            检测逻辑与 lib/device-performance.ts 保持一致。 */}
        <script dangerouslySetInnerHTML={{ __html: buildPerfBootstrapScript() }} />
        {/* 物理手机判定：浏览器谎报/放大视口时（桌面版网站、私有缩放、系统显示大小调小），
            按物理屏幕尺寸 + 触摸点数强制手机全屏布局，首帧前执行避免先闪桌面壳。
            与 lib/mobile-shell.ts 的判定保持一致。 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;var mode=null;try{mode=localStorage.getItem("ai_phone_shell_mode_v1");}catch(e3){}if(mode!=="phone"&&mode!=="desktop")mode="auto";var ch=${JSON.stringify(shellChannel())};var t=(navigator.maxTouchPoints||0)>0;var s=Math.min(screen.width,screen.height);var m=window.matchMedia("(hover: none) and (pointer: coarse)").matches;if(!m){if(mode==="phone"){d.setAttribute("data-force-mobile","1");m=true;}else if(mode==="auto"&&ch==="beta"&&t&&s>0&&s<=620){d.setAttribute("data-force-mobile","1");m=true;}}if(m&&s>=520&&(ch==="beta"||mode==="phone")){var z=Math.min(window.innerWidth/390,window.innerHeight/844);if(isFinite(z)&&z>1.001){d.style.setProperty("--shell-zoom",z.toFixed(4));try{var p=document.createElement("div");p.style.cssText="position:absolute;left:-9999px;top:0;width:100px;--zp:2;zoom:var(--zp)";d.appendChild(p);var w=p.getBoundingClientRect().width;d.removeChild(p);if(!(w>150)){d.setAttribute("data-zoom-fallback","1");}}catch(e2){}}}}catch(e){}})();`,
          }}
        />
        <link rel="manifest" href="/manifest.webmanifest" crossOrigin="use-credentials" />
        <meta name="theme-color" content="#f8f7f2" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="float" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <PWAManifestInjector />
        <PWARegistrar />
        <CSSImportEnhancer />
        <ChatPluginBootstrap />
        <ChatReasoningVisibilityController />
        {children}
      </body>
    </html>
  );
}
