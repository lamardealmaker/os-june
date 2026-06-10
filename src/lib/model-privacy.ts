import type { VeniceModelDto } from "./tauri";

export type ModelPrivacyMode = "private" | "anonymous";

export type ModelPrivacyBadge = {
  mode: ModelPrivacyMode;
  label: string;
  description: string;
};

export const PRIVATE_MODEL_DESCRIPTION =
  "You're using a model that is private and anonymous.";
export const ANONYMOUS_MODEL_DESCRIPTION =
  "You're using a model that is anonymizing your prompts but may still train on your data.";

export function modelPrivacyBadge(
  model: Pick<VeniceModelDto, "privacy" | "traits">,
): ModelPrivacyBadge | undefined {
  const flags = modelPrivacyFlags(model);
  if (flags.private) {
    return {
      mode: "private",
      label: "Private mode",
      description: PRIVATE_MODEL_DESCRIPTION,
    };
  }
  if (flags.anonymous) {
    return {
      mode: "anonymous",
      label: "Anonymous mode",
      description: ANONYMOUS_MODEL_DESCRIPTION,
    };
  }
  return undefined;
}

export function modelPrivacyFlags(
  model: Pick<VeniceModelDto, "privacy" | "traits">,
) {
  const privacy = (model.privacy ?? "").toLowerCase();
  const traits = model.traits.map((trait) => trait.toLowerCase());
  return {
    private:
      privacy === "private" || traits.some((trait) => trait === "private"),
    anonymous:
      privacy.includes("anonymous") ||
      privacy.includes("anonymized") ||
      traits.some(
        (trait) => trait.includes("anonymous") || trait.includes("anonymized"),
      ),
    uncensored: traits.some((trait) => trait.includes("uncensored")),
  };
}
