/** What a reference picture is for. The words go into the image prompt, since few models have a field for it. */
export const IMAGE_REFERENCE_ROLES = ["likeness", "outfit", "pose", "style", "place", "other"] as const;

export type ImageReferenceRole = (typeof IMAGE_REFERENCE_ROLES)[number];

/** The most reference pictures one image request carries; each connection may take fewer. */
export const MAX_IMAGE_REFERENCE_PICTURES = 16;

export function isImageReferenceRole(value: unknown): value is ImageReferenceRole {
  return typeof value === "string" && (IMAGE_REFERENCE_ROLES as readonly string[]).includes(value);
}

/**
 * One sentence that tells the image model what each reference picture is for, in the order they are sent,
 * or "" when no picture has a job. `name` is the character the likeness belongs to.
 */
export function imageReferenceRoleNotes(roles: readonly unknown[], name: string): string {
  const subject = name.trim() || "the character";
  const parts = roles.map((role, index) => {
    const picture = `picture ${index + 1}`;
    switch (isImageReferenceRole(role) ? role : "other") {
      case "likeness":
        return `${picture} shows the face and look of ${subject}`;
      case "outfit":
        return `${picture} shows the outfit to wear`;
      case "pose":
        return `${picture} shows the pose to copy`;
      case "style":
        return `${picture} shows the art style and colours to match`;
      case "place":
        return `${picture} shows the place where it happens`;
      default:
        return `${picture} is a general reference`;
    }
  });
  if (parts.length === 0 || roles.every((role) => !isImageReferenceRole(role) || role === "other")) return "";
  return `Reference pictures: ${parts.join("; ")}.`;
}
