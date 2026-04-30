"use client";

import { useEffect, useRef } from "react";
import {
  coerceSiteSettings,
  DEFAULT_SITE_SETTINGS,
  type SiteSettings,
} from "@/lib/site-settings";

type Particle = {
  colorPhase: number;
  size: number;
  vx: number;
  vy: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
};

type PointerState = {
  active: boolean;
  hold: number;
  holding: boolean;
  lastTime: number;
  lastX: number;
  lastY: number;
  pulse: number;
  pulseX: number;
  pulseY: number;
  x: number;
  y: number;
};

type MotionField = {
  vx: number;
  vy: number;
};

const LOGO_SOURCE = "/sonosig-logo.png";
const SONOSIG_PALETTE = [
  { b: 249, g: 232, r: 103 },
  { b: 238, g: 211, r: 34 },
  { b: 248, g: 189, r: 56 },
  { b: 242, g: 139, r: 14 },
  { b: 251, g: 113, r: 217 },
];

export function InteractiveSonoSigLogo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const settingsRef = useRef<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const motionFieldRef = useRef<MotionField>({ vx: 0, vy: 0 });
  const pointerRef = useRef<PointerState>({
    active: false,
    hold: 0,
    holding: false,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    pulse: 0,
    pulseX: 0,
    pulseY: 0,
    x: 0,
    y: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d", { alpha: true });

    if (!context) {
      return;
    }

    const canvasElement = canvas;
    const canvasContext = context;
    let animationFrame = 0;
    let width = 0;
    let height = 0;
    let reducedMotion = false;
    let startTime = performance.now();
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function resizeCanvas() {
      const bounds = canvasElement.getBoundingClientRect();
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(bounds.width));
      height = Math.max(1, Math.floor(bounds.height));
      canvasElement.width = Math.floor(width * pixelRatio);
      canvasElement.height = Math.floor(height * pixelRatio);
      canvasContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function buildParticles(image: HTMLImageElement) {
      const maskWidth = 206;
      const maskHeight = Math.round((maskWidth / image.naturalWidth) * image.naturalHeight);
      const maskCanvas = document.createElement("canvas");
      const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true });

      if (!maskContext) {
        return;
      }

      maskCanvas.width = maskWidth;
      maskCanvas.height = maskHeight;
      maskContext.clearRect(0, 0, maskWidth, maskHeight);
      maskContext.drawImage(image, 0, 0, maskWidth, maskHeight);

      const imageData = maskContext.getImageData(0, 0, maskWidth, maskHeight);
      const logoScale = Math.min(width * 0.78 / maskWidth, height * 0.62 / maskHeight);
      const offsetX = (width - maskWidth * logoScale) / 2;
      const offsetY = (height - maskHeight * logoScale) / 2;
      const nextParticles: Particle[] = [];
      const logoSettings = settingsRef.current.homeLogo;
      const startupScatter = logoSettings.initialMotionEnabled
        ? logoSettings.initialScatter
        : 0;
      const startupVelocityX = logoSettings.initialMotionEnabled
        ? logoSettings.initialVelocityX
        : 0;
      const startupVelocityY = logoSettings.initialMotionEnabled
        ? logoSettings.initialVelocityY
        : 0;

      for (let y = 0; y < maskHeight; y += 4) {
        for (let x = 0; x < maskWidth; x += 4) {
          const alpha = imageData.data[(y * maskWidth + x) * 4 + 3] ?? 0;

          if (alpha < 72) {
            continue;
          }

          const targetX = offsetX + x * logoScale;
          const targetY = offsetY + y * logoScale;
          const edgeBias = alpha / 255;
          const seed = pseudoRandom(x, y);
          const seed2 = pseudoRandom(y + 31, x + 17);
          const scatterX = (seed - 0.5) * startupScatter;
          const scatterY = (seed2 - 0.5) * startupScatter;
          const velocityBias = 0.62 + edgeBias * 0.7 + seed * 0.3;

          nextParticles.push({
            colorPhase: (x / maskWidth + y / maskHeight) * Math.PI,
            size: 1.15 + edgeBias * 1.8,
            vx: startupVelocityX * velocityBias + scatterX * 0.018,
            vy: startupVelocityY * velocityBias + scatterY * 0.018,
            x: targetX + scatterX,
            y: targetY + scatterY,
            tx: targetX,
            ty: targetY,
          });
        }
      }

      particlesRef.current = nextParticles;
    }

    function render() {
      const pointer = pointerRef.current;
      const particles = particlesRef.current;
      const motionField = motionFieldRef.current;
      const logoSettings = settingsRef.current.homeLogo;
      const now = performance.now();
      const elapsedSeconds = (now - startTime) / 1000;
      if (
        logoSettings.autoResetEnabled &&
        !reducedMotion &&
        elapsedSeconds >= logoSettings.autoResetIntervalSeconds
      ) {
        rebuild();
      }
      const shadowOpacity =
        logoSettings.haloFadeEnabled && !reducedMotion
          ? Math.max(
              0,
              1 - elapsedSeconds / logoSettings.haloFadeDurationSeconds,
            )
          : 1;
      pointer.hold += pointer.holding ? (1 - pointer.hold) * 0.08 : -pointer.hold * 0.07;
      pointer.hold = Math.max(0, Math.min(1, pointer.hold));
      motionField.vx *= logoSettings.inertia;
      motionField.vy *= logoSettings.inertia;
      if (haloRef.current) {
        haloRef.current.style.opacity = String(shadowOpacity);
      }
      canvasContext.clearRect(0, 0, width, height);

      const paletteColor = getPaletteColor(now * 0.004);
      const gradient = canvasContext.createRadialGradient(
        width * 0.48,
        height * 0.46,
        0,
        width * 0.48,
        height * 0.46,
        Math.max(width, height) * 0.55,
      );
      gradient.addColorStop(
        0,
        logoSettings.strobeOnHold && pointer.hold > 0.02
          ? `rgba(${paletteColor.r}, ${paletteColor.g}, ${paletteColor.b}, ${
              (0.18 + pointer.hold * 0.12) * shadowOpacity
            })`
          : `rgba(${Math.round(103 + pointer.hold * 92)}, ${Math.round(
              232 - pointer.hold * 54,
            )}, 249, ${(0.18 + pointer.hold * 0.08) * shadowOpacity})`,
      );
      gradient.addColorStop(
        0.5,
        `rgba(${Math.round(34 + pointer.hold * 145)}, ${Math.round(
          211 - pointer.hold * 98,
        )}, 238, ${(0.06 + pointer.hold * 0.06) * shadowOpacity})`,
      );
      gradient.addColorStop(1, "rgba(8,145,178,0)");
      canvasContext.fillStyle = gradient;
      canvasContext.fillRect(0, 0, width, height);

      for (const particle of particles) {
        if (!reducedMotion) {
          const toTargetX = particle.tx - particle.x;
          const toTargetY = particle.ty - particle.y;
          const phaseBias = 0.75 + Math.sin(particle.colorPhase + now * 0.001) * 0.25;
          particle.vx += toTargetX * logoSettings.returnForce;
          particle.vy += toTargetY * logoSettings.returnForce;
          particle.vx += motionField.vx * 0.018 * phaseBias;
          particle.vy += motionField.vy * 0.018 * phaseBias;

          if (pointer.active) {
            const dx = particle.x - pointer.x;
            const dy = particle.y - pointer.y;
            const distanceSquared = dx * dx + dy * dy;
            const radius = Math.max(width, height) * 0.19;

            if (distanceSquared < radius * radius) {
              const distance = Math.sqrt(distanceSquared) || 1;
              const force = (1 - distance / radius) * 2.1;
              particle.vx += (dx / distance) * force;
              particle.vy += (dy / distance) * force;
            }
          }

          if (pointer.pulse > 0) {
            const dx = particle.x - pointer.pulseX;
            const dy = particle.y - pointer.pulseY;
            const distance = Math.sqrt(dx * dx + dy * dy) || 1;
            const wave = Math.sin(distance * 0.065 - pointer.pulse * 0.22);
            const force = Math.max(0, 1 - pointer.pulse / 48) * wave * 0.72;
            particle.vx += (dx / distance) * force;
            particle.vy += (dy / distance) * force;
          }

          particle.vx *= logoSettings.inertia;
          particle.vy *= logoSettings.inertia;
          particle.x += particle.vx;
          particle.y += particle.vy;
        } else {
          particle.x = particle.tx;
          particle.y = particle.ty;
        }

        const glow = 0.55 + Math.sin(now * 0.0012 + particle.colorPhase) * 0.22;
        const cyan = {
          b: 250,
          g: Math.round(205 + glow * 35),
          r: Math.round(80 + glow * 70),
        };
        const pressed = {
          b: Math.round(218 + glow * 24),
          g: Math.round(126 + glow * 52),
          r: Math.round(174 + glow * 62),
        };
        let mix = pointer.hold;
        let red = Math.round(cyan.r + (pressed.r - cyan.r) * mix);
        let green = Math.round(cyan.g + (pressed.g - cyan.g) * mix);
        let blue = Math.round(cyan.b + (pressed.b - cyan.b) * mix);

        if (logoSettings.strobeOnHold && pointer.hold > 0.02) {
          const strobe = getPaletteColor(now * 0.011 + particle.colorPhase * 1.4);
          mix = Math.min(1, pointer.hold * 1.2);
          red = Math.round(cyan.r + (strobe.r - cyan.r) * mix);
          green = Math.round(cyan.g + (strobe.g - cyan.g) * mix);
          blue = Math.round(cyan.b + (strobe.b - cyan.b) * mix);
        }

        canvasContext.fillStyle = `rgba(${red}, ${green}, ${blue}, ${0.56 + glow * 0.28})`;
        canvasContext.beginPath();
        canvasContext.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        canvasContext.fill();
      }

      if (pointer.pulse > 0 && !reducedMotion) {
        pointer.pulse += 1;

        if (pointer.pulse > 48) {
          pointer.pulse = 0;
        }
      }

      animationFrame = requestAnimationFrame(render);
    }

    function updatePointer(event: PointerEvent) {
      const bounds = canvasElement.getBoundingClientRect();
      const pointer = pointerRef.current;
      const nextX = event.clientX - bounds.left;
      const nextY = event.clientY - bounds.top;
      const nextTime = performance.now();
      const deltaTime = Math.max(16, nextTime - pointer.lastTime);

      if (pointer.active) {
        const velocityX = ((nextX - pointer.lastX) / deltaTime) * 16;
        const velocityY = ((nextY - pointer.lastY) / deltaTime) * 16;
        const speed = Math.hypot(velocityX, velocityY);
        const cap = 7;
        const scale = speed > cap ? cap / speed : 1;
        motionFieldRef.current.vx += velocityX * scale * 0.75;
        motionFieldRef.current.vy += velocityY * scale * 0.75;
      }

      pointerRef.current.active = true;
      pointerRef.current.lastTime = nextTime;
      pointerRef.current.lastX = nextX;
      pointerRef.current.lastY = nextY;
      pointerRef.current.x = nextX;
      pointerRef.current.y = nextY;
    }

    function pulse(event: PointerEvent) {
      updatePointer(event);
      pointerRef.current.holding = true;
      pointerRef.current.pulse = 1;
      pointerRef.current.pulseX = pointerRef.current.x;
      pointerRef.current.pulseY = pointerRef.current.y;
      motionFieldRef.current.vx += settingsRef.current.homeLogo.initialVelocityX * 2.4;
      motionFieldRef.current.vy += settingsRef.current.homeLogo.initialVelocityY * 2.4;
    }

    function clearPointer() {
      pointerRef.current.active = false;
    }

    function releaseHold() {
      pointerRef.current.holding = false;
    }

    function handleReducedMotionChange(event: MediaQueryListEvent) {
      reducedMotion = event.matches;
    }

    function resetInteractionState() {
      motionFieldRef.current = { vx: 0, vy: 0 };
      pointerRef.current = {
        active: false,
        hold: 0,
        holding: false,
        lastTime: 0,
        lastX: 0,
        lastY: 0,
        pulse: 0,
        pulseX: 0,
        pulseY: 0,
        x: 0,
        y: 0,
      };
    }

    function rebuild() {
      startTime = performance.now();
      resetInteractionState();
      resizeCanvas();
      const image = new Image();
      image.decoding = "async";
      image.onload = () => buildParticles(image);
      image.src = LOGO_SOURCE;
    }

    reducedMotion = mediaQuery.matches;
    resizeCanvas();
    rebuild();
    render();

    fetch("/api/site/settings")
      .then(async (response) => {
        if (!response.ok) {
          return;
        }

        const body = (await response.json()) as { settings?: unknown };
        settingsRef.current = coerceSiteSettings(body.settings);
        rebuild();
      })
      .catch(() => {
        settingsRef.current = DEFAULT_SITE_SETTINGS;
      });

    const resizeObserver = new ResizeObserver(rebuild);
    resizeObserver.observe(canvasElement);
    canvasElement.addEventListener("pointermove", updatePointer);
    canvasElement.addEventListener("pointerleave", clearPointer);
    canvasElement.addEventListener("pointerdown", pulse);
    window.addEventListener("pointercancel", releaseHold);
    window.addEventListener("pointerup", releaseHold);
    mediaQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      canvasElement.removeEventListener("pointermove", updatePointer);
      canvasElement.removeEventListener("pointerleave", clearPointer);
      canvasElement.removeEventListener("pointerdown", pulse);
      window.removeEventListener("pointercancel", releaseHold);
      window.removeEventListener("pointerup", releaseHold);
      mediaQuery.removeEventListener("change", handleReducedMotionChange);
    };
  }, []);

  return (
    <div className="relative aspect-square w-[min(72vw,440px)] overflow-visible lg:w-[clamp(340px,28vw,480px)]">
      <div
        className="absolute inset-[8%] rounded-full bg-cyan-300/10 blur-3xl"
        ref={haloRef}
      />
      <canvas
        aria-label="Interactive SonoSig logo"
        className="relative h-full w-full touch-none rounded-full"
        ref={canvasRef}
      />
    </div>
  );
}

function getPaletteColor(phase: number) {
  const index = Math.floor(phase) % SONOSIG_PALETTE.length;
  const nextIndex = (index + 1) % SONOSIG_PALETTE.length;
  const localPhase = phase - Math.floor(phase);
  const from = SONOSIG_PALETTE[index] ?? SONOSIG_PALETTE[0];
  const to = SONOSIG_PALETTE[nextIndex] ?? SONOSIG_PALETTE[0];

  return {
    b: Math.round(from.b + (to.b - from.b) * localPhase),
    g: Math.round(from.g + (to.g - from.g) * localPhase),
    r: Math.round(from.r + (to.r - from.r) * localPhase),
  };
}

function pseudoRandom(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;

  return value - Math.floor(value);
}
