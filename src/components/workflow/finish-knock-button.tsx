"use client";

/**
 * CryoFlow — the finish knock's DOOR (t438): a header bell with the
 * two opt-in channels and a try-it affordance.
 *
 * Design laws this button keeps:
 *   - EXPLICIT opt-in for everything that leaves the page: the chime
 *     and the OS notification are off until the user turns them on
 *     here. The title flicker needs no permission and gets none here —
 *     it is chrome, not a channel.
 *   - The chime's AudioContext is created (primed) INSIDE the toggle
 *     click — a user gesture — so no autoplay policy can silence the
 *     real knock later, and the enabling click doubles as a preview
 *     (you hear what you just signed up for).
 *   - Permission honesty: three states, each named — "Enable…" before
 *     asking, "On" with a test fire after granting, "Blocked in this
 *     browser" (disabled, with the escape hatch in the tooltip) after
 *     refusal. "Unsupported" hides the item rather than selling a
 *     promise the platform can't keep.
 *   - The test knock respects the visible/hidden split: the chime
 *     preview plays (the user is holding the button — a gesture, not a
 *     finish), but a test notification only fires when granted AND the
 *     tab is hidden — otherwise it would be invisible to the user and
 *     a pure lie to the OS.
 *
 * localStorage write happens ONLY inside toggleSound (t157-F: a fresh
 * boot writes zero keys — reads seed the UI, writes need a hand).
 */

import { useState, useSyncExternalStore } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getKnockPerm,
  getKnockSound,
  playKnockChime,
  primeKnockAudio,
  requestKnockPermission,
  sendKnockNotification,
  subscribeKnockPerm,
  subscribeKnockSound,
  writeKnockSound,
  type KnockPerm,
} from "@/lib/finish-knock";

const TEST_TITLE = "CryoFlow — knock test";

export function KnockSettingsButton() {
  // both client-only values ride the canonical store shape (use-now.ts
  // doctrine): the SERVER snapshot is the neutral default (off / default
  // permission) so hydration starts matched, the client snapshot reads
  // the truth right after mount, and every write publishes to the
  // subscribers — zero effects, zero setState-in-effect seeds.
  const soundOn = useSyncExternalStore(subscribeKnockSound, getKnockSound, () => false);
  const perm = useSyncExternalStore(subscribeKnockPerm, getKnockPerm, () => "default" as KnockPerm);
  const [asking, setAsking] = useState(false);

  const toggleSound = (next: boolean) => {
    writeKnockSound(next);
    if (next) {
      primeKnockAudio(); // gesture-time creation — the contract
      playKnockChime();  // the enabling click is also the preview
    }
  };

  const enableNotifications = async () => {
    setAsking(true);
    await requestKnockPermission(); // publishes to the perm store on resolve
    setAsking(false);
    if (getKnockPerm() === "granted") {
      // a test that only ever lands when it can be SEEN: hidden tab
      sendKnockNotification({
        title: TEST_TITLE,
        body: "Browser notifications are on — jobs that finish while this tab is hidden will announce themselves.",
      });
    }
  };

  const testKnock = () => {
    if (soundOn) playKnockChime();
    if (perm === "granted" && document.hidden) {
      sendKnockNotification({
        title: TEST_TITLE,
        body: "This is what a finished job will sound and look like from another tab.",
      });
    }
  };

  const permLabel =
    perm === "unsupported"
      ? null
      : perm === "granted"
        ? "Browser notifications — on"
        : perm === "denied"
          ? "Browser notifications — blocked"
          : asking
            ? "Browser notifications — asking…"
            : "Browser notifications — off";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          aria-label="Finish knock settings"
          title="Finish knock — a sound and an OS notification when a job finishes while this tab is hidden. The title flicker is always on."
        >
          {perm === "granted" || soundOn ? (
            <BellRing className="size-4" aria-hidden="true" />
          ) : (
            <Bell className="size-4" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Finish knock</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={soundOn === true}
          onCheckedChange={(checked) => toggleSound(checked === true)}
          onSelect={(e) => e.preventDefault()}
        >
          <BellRing className="size-4 mr-2 text-muted-foreground" aria-hidden="true" />
          <span>Chime when hidden</span>
        </DropdownMenuCheckboxItem>
        {permLabel === null ? null : perm === "granted" ? (
          <DropdownMenuCheckboxItem checked disabled>
            <BellRing className="size-4 mr-2 text-muted-foreground" aria-hidden="true" />
            <span>{permLabel}</span>
          </DropdownMenuCheckboxItem>
        ) : perm === "denied" ? (
          <DropdownMenuItem disabled title="This browser refused notifications — unblock CryoFlow in the site settings to change that.">
            <BellOff className="size-4 mr-2 text-muted-foreground" aria-hidden="true" />
            <span>{permLabel}</span>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            disabled={asking}
            onSelect={() => void enableNotifications()}
            title="Ask the browser for permission to show a desktop notification when a job finishes in a hidden tab."
          >
            <Bell className="size-4 mr-2 text-muted-foreground" aria-hidden="true" />
            <span>{permLabel}</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={testKnock} title="Hear the chime — and if notifications are on and this tab is hidden, receive a test notification.">
          Try the knock
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {/* the contract, in small print: visible tabs already have toasts */}
        <div className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
          Toasts speak while you watch. The knock speaks while you&apos;re away — the
          title flicker is always on, chime and notifications ride opt-in.
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
