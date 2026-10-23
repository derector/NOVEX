const MIN_CLIP_DURATION = 0.1;
const roundSeconds = (value) => Math.round(value * 1000) / 1000;

function clipLength(clip) {
  return Number(clip.end) - Number(clip.start);
}

function validIndex(timeline, index) {
  if (!Number.isInteger(index) || index < 0 || index >= timeline.length) {
    throw new RangeError("Выбранный фрагмент больше не существует.");
  }
}

function seconds(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TypeError(label + " должно быть числом.");
  return parsed;
}

/** Recalculate a gap-free project timeline while preserving every clip's duration. */
export function reflowTimeline(timeline) {
  let cursor = 0;
  return timeline.map((clip) => {
    const duration = clipLength(clip);
    if (!Number.isFinite(duration) || duration < MIN_CLIP_DURATION) {
      throw new RangeError("Длительность фрагмента должна быть не меньше 0,1 секунды.");
    }
    const start = roundSeconds(cursor);
    const end = roundSeconds(start + duration);
    cursor = end;
    return { ...clip, start, end, sourceDuration: roundSeconds(duration) };
  });
}

export function timelineDuration(timeline) {
  return roundSeconds(timeline.reduce((total, clip) => total + clipLength(clip), 0));
}

/** Move one segment by a relative direction (-1 or +1). */
export function moveTimelineClip(timeline, index, direction) {
  validIndex(timeline, index);
  if (direction !== -1 && direction !== 1) {
    throw new RangeError("Направление перемещения должно быть -1 или 1.");
  }
  return moveTimelineClipTo(timeline, index, index + direction);
}

/** Move one segment to a target timeline index. */
export function moveTimelineClipTo(timeline, fromIndex, toIndex) {
  validIndex(timeline, fromIndex);
  if (!Number.isInteger(toIndex) || toIndex < 0 || toIndex >= timeline.length) {
    return reflowTimeline(timeline);
  }
  const next = [...timeline];
  const [clip] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, clip);
  return reflowTimeline(next);
}

export function duplicateTimelineClip(timeline, index) {
  validIndex(timeline, index);
  const next = [...timeline];
  const copy = { ...timeline[index] };
  next.splice(index + 1, 0, copy);
  return reflowTimeline(next);
}

export function removeTimelineClip(timeline, index) {
  validIndex(timeline, index);
  if (timeline.length <= 1) {
    throw new RangeError("В монтажной шкале должен остаться хотя бы один видеосегмент.");
  }
  const next = [...timeline];
  next.splice(index, 1);
  return reflowTimeline(next);
}

/** Trim a source segment, then close the timeline gap and update project timing. */
export function trimTimelineClip(
  timeline,
  index,
  { sourceStart, duration, maxSourceDuration = Infinity, minDuration = MIN_CLIP_DURATION },
) {
  validIndex(timeline, index);
  const inPoint = seconds(sourceStart, "Начало фрагмента");
  const length = seconds(duration, "Длительность фрагмента");
  const minimum = Math.max(MIN_CLIP_DURATION, seconds(minDuration, "Минимальная длительность"));
  const maximum = Number(maxSourceDuration);

  if (inPoint < 0) throw new RangeError("Начало фрагмента не может быть раньше 0.");
  if (length < minimum) throw new RangeError("Фрагмент слишком короткий: минимум 0,1 секунды.");
  if (Number.isFinite(maximum) && maximum > 0 && inPoint >= maximum) {
    throw new RangeError("Начало фрагмента выходит за длительность исходного видео.");
  }

  const next = [...timeline];
  const clip = next[index];
  next[index] = {
    ...clip,
    sourceStart: roundSeconds(inPoint),
    start: clip.start,
    end: roundSeconds(clip.start + length),
    sourceDuration: roundSeconds(length),
  };
  return reflowTimeline(next);
}
