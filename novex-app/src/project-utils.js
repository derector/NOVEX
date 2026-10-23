export function localMediaProjectId(project) {
  const value = project?.localProjectId ?? project?.project_data?.localProjectId ?? project?.id;
  return value == null ? "" : String(value);
}

export function fileMatchesIdentity(file, identity, name = identity?.name) {
  if (!file || (name && file.name !== name)) return false;
  if (!identity) return true;
  return (
    (identity.size == null || Number(file.size) === Number(identity.size)) &&
    (identity.lastModified == null || Number(file.lastModified) === Number(identity.lastModified)) &&
    (!identity.type || !file.type || file.type === identity.type)
  );
}

/** Match duplicate filenames by occurrence and, when present, file fingerprint. */
export function matchProjectReferences(names, references, identities = []) {
  const available = [...references];
  return names.map((name, index) => {
    const identity = identities[index];
    const candidate = available.findIndex((item) => fileMatchesIdentity(item?.file, identity, name));
    if (candidate < 0) return null;
    return available.splice(candidate, 1)[0];
  });
}

/** Keep caption positions proportional to their original range after timeline edits. */
export function retimeCaptionLines(lines, oldRange, nextDuration) {
  if (!Array.isArray(lines) || !lines.length) return [];
  const rangeStart = Number(oldRange?.start) || 0;
  const oldDuration = Math.max(0, Number(oldRange?.duration) || 0);
  const duration = Math.max(0, Number(nextDuration) || 0);
  if (!oldDuration || !duration) return [];
  const endLimit = rangeStart + duration;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  return lines.map((line) => {
    const startRatio = clamp((Number(line.start) - rangeStart) / oldDuration);
    const endRatio = clamp((Number(line.end) - rangeStart) / oldDuration);
    const start = Math.min(endLimit, rangeStart + startRatio * duration);
    const end = Math.min(endLimit, Math.max(start, rangeStart + endRatio * duration));
    return { ...line, start, end };
  });
}
