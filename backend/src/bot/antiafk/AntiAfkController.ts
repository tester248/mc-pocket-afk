import type { Bot } from "mineflayer";

import type { AntiAfkMode, ConcreteAntiAfkMode } from "../../types/protocol";

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const clamp = (value: number, min: number, max: number): number => {
  return Math.min(max, Math.max(min, value));
};

interface AntiAfkCallbacks {
  onModesChanged: (activeModes: ConcreteAntiAfkMode[]) => void;
  onInfo: (message: string) => void;
  onError: (message: string) => void;
}

export class AntiAfkController {
  private bot: Bot | null = null;
  private readonly activeModes = new Set<ConcreteAntiAfkMode>();
  private readonly timers = new Map<"swing" | "look" | "jump", NodeJS.Timeout>();

  private fishAbort = false;
  private fishLoopPromise: Promise<void> | null = null;

  public constructor(private readonly callbacks: AntiAfkCallbacks) {}

  public setBot(bot: Bot | null): void {
    this.bot = bot;
    if (!bot) {
      this.stop();
    }
  }

  public getActiveModes(): ConcreteAntiAfkMode[] {
    return Array.from(this.activeModes);
  }

  public start(mode: AntiAfkMode): void {
    if (mode === "all") {
      this.start("swing");
      this.start("look");
      this.start("jump");
      this.start("fish");
      return;
    }

    if (this.activeModes.has(mode)) {
      this.callbacks.onInfo(`Anti-AFK mode '${mode}' is already active.`);
      return;
    }

    this.activeModes.add(mode);
    this.callbacks.onModesChanged(this.getActiveModes());

    switch (mode) {
      case "swing":
        this.startSwingLoop();
        break;
      case "look":
        this.startLookLoop();
        break;
      case "jump":
        this.startJumpLoop();
        break;
      case "fish":
        this.startFishLoop();
        break;
      default:
        break;
    }
  }

  public stop(mode?: AntiAfkMode): void {
    if (!mode || mode === "all") {
      this.stopSingle("swing");
      this.stopSingle("look");
      this.stopSingle("jump");
      this.stopSingle("fish");
      this.callbacks.onModesChanged(this.getActiveModes());
      return;
    }

    this.stopSingle(mode);
    this.callbacks.onModesChanged(this.getActiveModes());
  }

  private stopSingle(mode: ConcreteAntiAfkMode): void {
    this.activeModes.delete(mode);

    if (mode === "swing" || mode === "look" || mode === "jump") {
      const timer = this.timers.get(mode);
      if (timer) {
        clearInterval(timer);
      }
      this.timers.delete(mode);

      if (mode === "jump") {
        this.bot?.setControlState("jump", false);
      }
      return;
    }

    this.fishAbort = true;
  }

  private startSwingLoop(): void {
    const timer = setInterval(() => {
      if (!this.activeModes.has("swing") || !this.bot) {
        return;
      }

      try {
        this.bot.swingArm("right");
      } catch (error) {
        this.callbacks.onError(`Swing loop failed: ${(error as Error).message}`);
      }
    }, 10_000);

    this.timers.set("swing", timer);
  }

  private startLookLoop(): void {
    const timer = setInterval(() => {
      if (!this.activeModes.has("look") || !this.bot || !this.bot.entity) {
        return;
      }

      const yawJitter = (Math.random() - 0.5) * 0.45;
      const pitchJitter = (Math.random() - 0.5) * 0.18;

      const targetYaw = this.bot.entity.yaw + yawJitter;
      const targetPitch = clamp(this.bot.entity.pitch + pitchJitter, -1.2, 1.2);

      void this.bot.look(targetYaw, targetPitch, true).catch((error: Error) => {
        this.callbacks.onError(`Look loop failed: ${error.message}`);
      });
    }, 12_000);

    this.timers.set("look", timer);
  }

  private startJumpLoop(): void {
    const timer = setInterval(() => {
      if (!this.activeModes.has("jump") || !this.bot) {
        return;
      }

      try {
        this.bot.setControlState("jump", true);
        setTimeout(() => {
          this.bot?.setControlState("jump", false);
        }, 350);
      } catch (error) {
        this.callbacks.onError(`Jump loop failed: ${(error as Error).message}`);
      }
    }, 11_000);

    this.timers.set("jump", timer);
  }

  private startFishLoop(): void {
    if (this.fishLoopPromise) {
      return;
    }

    this.fishAbort = false;
    this.fishLoopPromise = this.runFishLoop().finally(() => {
      this.fishLoopPromise = null;
    });
  }

  private async runFishLoop(): Promise<void> {
    while (this.activeModes.has("fish") && !this.fishAbort) {
      if (!this.bot || !this.bot.entity) {
        await sleep(3_000);
        continue;
      }

      const rod = this.bot.inventory.items().find((item) => item.name === "fishing_rod");
      if (!rod) {
        this.callbacks.onInfo("Fishing mode is active but no fishing_rod was found.");
        await sleep(8_000);
        continue;
      }

      try {
        await this.bot.equip(rod, "hand");

        const targetYaw = this.bot.entity.yaw + (Math.random() - 0.5) * 0.25;
        const targetPitch = clamp(this.bot.entity.pitch + 0.18, -1.2, 1.2);
        await this.bot.look(targetYaw, targetPitch, true);

        const fishFn = (this.bot as unknown as { fish?: () => Promise<void> }).fish;
        if (typeof fishFn === "function") {
          await fishFn.call(this.bot);
        } else {
          this.bot.activateItem();
          await sleep(1_500);
          this.bot.deactivateItem();
          await sleep(6_000);
        }
      } catch (error) {
        this.callbacks.onError(`Fish loop failed: ${(error as Error).message}`);
        await sleep(5_000);
      }
    }
  }
}
