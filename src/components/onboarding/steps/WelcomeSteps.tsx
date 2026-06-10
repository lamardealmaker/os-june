import type { OnboardingProfile } from "../../../lib/onboarding";
import { Chip, StepActions, StepHeading } from "../StepChrome";

export const FOCUS_OPTIONS = [
  "Writing by voice",
  "Meeting notes",
  "Research and drafts",
  "Digging through files",
  "Recurring busywork",
];

export function WelcomeStep({
  name,
  onContinue,
}: {
  name?: string;
  onContinue: () => void;
}) {
  return (
    <section className="onboarding-step">
      <StepHeading
        title={name ? `Welcome, ${name}!` : "Welcome to June"}
        subtitle="June is your private AI assistant: dictate into any app, never take meeting notes again, and hand off real work to an agent that runs on your Mac."
      />
      <ul className="onboarding-feature-list">
        <li>
          <strong>Talk, don't type</strong> — hold a key and speak; June types
          at your cursor in whatever app has focus.
        </li>
        <li>
          <strong>Never take notes again</strong> — decisions, action items, and
          who said what, written for you.
        </li>
        <li>
          <strong>Hand off real work</strong> — give June a task, not just a
          question. It comes back with it done.
        </li>
      </ul>
      <StepActions
        continueLabel="Let's get you set up"
        onContinue={onContinue}
      />
    </section>
  );
}

export function FocusStep({
  profile,
  onProfileChange,
  onContinue,
}: {
  profile: OnboardingProfile;
  onProfileChange: (next: OnboardingProfile) => void;
  onContinue: () => void;
}) {
  function toggle(option: string) {
    const focus = profile.focus.includes(option)
      ? profile.focus.filter((item) => item !== option)
      : [...profile.focus, option];
    onProfileChange({ ...profile, focus });
  }
  return (
    <section className="onboarding-step">
      <StepHeading
        title="What should June take off your plate?"
        subtitle="Select all that apply."
      />
      <div
        className="onboarding-chip-grid"
        role="group"
        aria-label="What June should help with"
      >
        {FOCUS_OPTIONS.map((option) => (
          <Chip
            key={option}
            label={option}
            selected={profile.focus.includes(option)}
            onToggle={() => toggle(option)}
          />
        ))}
      </div>
      <StepActions
        onContinue={onContinue}
        continueDisabled={profile.focus.length === 0}
        onSkip={onContinue}
      />
    </section>
  );
}
