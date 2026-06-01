import { clampUnit, colorDistanceSquared, type Rgb } from "./sprite-cleanup-color";
import { buildEdgeBand, buildSelectedEdgeDistance } from "./sprite-cleanup-selection";

export function addSelectedSoftHalo(
  imageData: ImageData,
  selected: Uint8Array,
  sourceData: Uint8ClampedArray,
  target: Rgb,
  tolerance: number,
  feather: number,
  softness: number,
): number {
  const { data, width, height } = imageData;
  const featherAmount = clampUnit(feather / 100);
  const softnessAmount = clampUnit(softness / 100);
  if (featherAmount <= 0) return 0;

  const totalPixels = selected.length;
  const haloRadius = 1 + Math.round(featherAmount * 5);
  const selectedEdgeDistance = buildSelectedEdgeDistance(selected, sourceData, width, totalPixels, haloRadius, "all");
  const sampleRadius = haloRadius + 2 + Math.round(softnessAmount * 2);
  const targetTolerance = Math.max(1, tolerance);
  const maxHaloAlpha = 4 + featherAmount * (46 + softnessAmount * 18);
  const halo = new Uint8ClampedArray(totalPixels * 4);

  const findForegroundSample = (index: number): { color: Rgb; influence: number } | null => {
    const x = index % width;
    const y = Math.floor(index / width);
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let weightTotal = 0;

    for (let yOffset = -sampleRadius; yOffset <= sampleRadius; yOffset += 1) {
      const sampleY = y + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;

      for (let xOffset = -sampleRadius; xOffset <= sampleRadius; xOffset += 1) {
        if (xOffset === 0 && yOffset === 0) continue;

        const sampleDistance = Math.hypot(xOffset, yOffset);
        if (sampleDistance > sampleRadius) continue;

        const sampleX = x + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;

        const sampleIndex = sampleY * width + sampleX;
        if (selected[sampleIndex]) continue;

        const sampleOffset = sampleIndex * 4;
        const sampleAlpha = sourceData[sampleOffset + 3] ?? 0;
        if (sampleAlpha <= 28) continue;

        const targetDistance = Math.sqrt(colorDistanceSquared(sourceData, sampleOffset, target));
        const matteSeparation = clampUnit((targetDistance - targetTolerance * 0.45) / (targetTolerance * 1.55));
        if (matteSeparation <= 0) continue;

        const distanceWeight = Math.pow(1 - sampleDistance / Math.max(1, sampleRadius + 0.001), 1.6);
        const alphaWeight = Math.pow(sampleAlpha / 255, 1.15);
        const weight = distanceWeight * alphaWeight * Math.pow(matteSeparation, 1.2);
        if (weight <= 0) continue;

        redTotal += (sourceData[sampleOffset] ?? 0) * weight;
        greenTotal += (sourceData[sampleOffset + 1] ?? 0) * weight;
        blueTotal += (sourceData[sampleOffset + 2] ?? 0) * weight;
        weightTotal += weight;
      }
    }

    if (weightTotal <= 0) return null;

    return {
      color: [
        Math.round(redTotal / weightTotal),
        Math.round(greenTotal / weightTotal),
        Math.round(blueTotal / weightTotal),
      ],
      influence: clampUnit(weightTotal / (1.15 + sampleRadius * 0.38)),
    };
  };

  for (let index = 0; index < totalPixels; index += 1) {
    if (!selected[index]) continue;

    const distanceFromCut = selectedEdgeDistance[index] ?? 0;
    if (distanceFromCut === 0) continue;

    const sample = findForegroundSample(index);
    if (!sample) continue;

    const offset = index * 4;
    const sourceAlpha = sourceData[offset + 3] ?? 0;
    if (sourceAlpha <= 0) continue;

    const edgePosition = clampUnit((haloRadius - distanceFromCut + 1) / Math.max(1, haloRadius));
    const edgeCurve = 1.72 - softnessAmount * 0.58 - featherAmount * 0.46;
    const alpha = Math.min(
      sourceAlpha,
      Math.round(maxHaloAlpha * Math.pow(edgePosition, edgeCurve) * (0.55 + sample.influence * 0.45)),
    );
    if (alpha <= 0) continue;

    halo[offset] = sample.color[0];
    halo[offset + 1] = sample.color[1];
    halo[offset + 2] = sample.color[2];
    halo[offset + 3] = alpha;
  }

  const blurPasses = Math.round(softnessAmount * 2 + featherAmount * 2);
  for (let pass = 0; pass < blurPasses; pass += 1) {
    const previous = new Uint8ClampedArray(halo);

    for (let index = 0; index < totalPixels; index += 1) {
      if (!selected[index] || (selectedEdgeDistance[index] ?? 0) === 0) continue;

      const x = index % width;
      const y = Math.floor(index / width);
      const offset = index * 4;
      let redTotal = 0;
      let greenTotal = 0;
      let blueTotal = 0;
      let alphaTotal = 0;
      let weightTotal = 0;

      for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
        const sampleY = y + yOffset;
        if (sampleY < 0 || sampleY >= height) continue;

        for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
          const sampleX = x + xOffset;
          if (sampleX < 0 || sampleX >= width) continue;

          const sampleIndex = sampleY * width + sampleX;
          if (!selected[sampleIndex]) continue;

          const sampleOffset = sampleIndex * 4;
          const sampleDistance = Math.max(1, Math.hypot(xOffset, yOffset));
          const weight = xOffset === 0 && yOffset === 0 ? 1.8 : 1 / sampleDistance;
          const sampleAlpha = previous[sampleOffset + 3] ?? 0;
          weightTotal += weight;

          if (sampleAlpha <= 0) continue;
          redTotal += (previous[sampleOffset] ?? 0) * sampleAlpha * weight;
          greenTotal += (previous[sampleOffset + 1] ?? 0) * sampleAlpha * weight;
          blueTotal += (previous[sampleOffset + 2] ?? 0) * sampleAlpha * weight;
          alphaTotal += sampleAlpha * weight;
        }
      }

      if (alphaTotal <= 0 || weightTotal <= 0) continue;

      halo[offset] = Math.round(redTotal / alphaTotal);
      halo[offset + 1] = Math.round(greenTotal / alphaTotal);
      halo[offset + 2] = Math.round(blueTotal / alphaTotal);
      halo[offset + 3] = Math.round(alphaTotal / weightTotal);
    }
  }

  let changed = 0;
  for (let index = 0; index < totalPixels; index += 1) {
    if (!selected[index]) continue;

    const offset = index * 4;
    const alpha = halo[offset + 3] ?? 0;
    if (alpha <= 0) continue;

    if (
      data[offset] === halo[offset] &&
      data[offset + 1] === halo[offset + 1] &&
      data[offset + 2] === halo[offset + 2] &&
      data[offset + 3] === alpha
    ) {
      continue;
    }

    data[offset] = halo[offset] ?? 0;
    data[offset + 1] = halo[offset + 1] ?? 0;
    data[offset + 2] = halo[offset + 2] ?? 0;
    data[offset + 3] = alpha;
    changed += 1;
  }

  return changed;
}

export function softenKeptCutEdge(
  imageData: ImageData,
  selected: Uint8Array,
  sourceData: Uint8ClampedArray,
  target: Rgb,
  tolerance: number,
  softness: number,
  feather: number,
): number {
  const { data, width, height } = imageData;
  const softnessAmount = clampUnit(softness / 100);
  const featherAmount = clampUnit(feather / 100);
  const transitionAmount = clampUnit(softnessAmount * 0.72 + featherAmount * 0.42);
  if (transitionAmount <= 0) return 0;

  const totalPixels = selected.length;
  const edgeRadius = 1 + Math.round(softnessAmount * 2 + featherAmount * 3);
  const edgeDistance = buildEdgeBand(selected, width, totalPixels, edgeRadius, "all");
  const softened = new Uint8ClampedArray(data);
  const matteTolerance = Math.max(1, tolerance * (1.14 + transitionAmount * 0.82));
  const decontaminateAmount = clampUnit((softnessAmount * 0.65 + featherAmount * 0.55 - 0.3) / 0.7);
  const sampleRadius = 2 + edgeRadius;
  const targetLuma = target[0] * 0.2126 + target[1] * 0.7152 + target[2] * 0.0722;

  const findForegroundColor = (index: number): { color: Rgb; luma: number; weight: number } | null => {
    const x = index % width;
    const y = Math.floor(index / width);
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let weightTotal = 0;

    for (let yOffset = -sampleRadius; yOffset <= sampleRadius; yOffset += 1) {
      const sampleY = y + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;

      for (let xOffset = -sampleRadius; xOffset <= sampleRadius; xOffset += 1) {
        if (xOffset === 0 && yOffset === 0) continue;

        const sampleDistance = Math.hypot(xOffset, yOffset);
        if (sampleDistance > sampleRadius) continue;

        const sampleX = x + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;

        const sampleIndex = sampleY * width + sampleX;
        if (selected[sampleIndex]) continue;

        const sampleOffset = sampleIndex * 4;
        const sampleAlpha = sourceData[sampleOffset + 3] ?? 0;
        if (sampleAlpha <= 48) continue;

        const targetDistance = Math.sqrt(colorDistanceSquared(sourceData, sampleOffset, target));
        const matteSeparation = clampUnit(
          (targetDistance - matteTolerance * 0.72) / Math.max(1, matteTolerance * 1.55),
        );
        if (matteSeparation <= 0) continue;

        const distanceWeight = Math.pow(1 - sampleDistance / Math.max(1, sampleRadius + 0.001), 1.35);
        const alphaWeight = Math.pow(sampleAlpha / 255, 1.1);
        const weight = distanceWeight * alphaWeight * Math.pow(matteSeparation, 1.25);
        if (weight <= 0) continue;

        redTotal += (sourceData[sampleOffset] ?? 0) * weight;
        greenTotal += (sourceData[sampleOffset + 1] ?? 0) * weight;
        blueTotal += (sourceData[sampleOffset + 2] ?? 0) * weight;
        weightTotal += weight;
      }
    }

    if (weightTotal <= 0) return null;

    const color: Rgb = [
      Math.round(redTotal / weightTotal),
      Math.round(greenTotal / weightTotal),
      Math.round(blueTotal / weightTotal),
    ];
    const luma = color[0] * 0.2126 + color[1] * 0.7152 + color[2] * 0.0722;
    return { color, luma, weight: weightTotal };
  };

  for (let index = 0; index < totalPixels; index += 1) {
    const distanceFromCut = edgeDistance[index] ?? 0;
    if (distanceFromCut === 0) continue;

    const offset = index * 4;
    const currentAlpha = data[offset + 3] ?? 0;
    const originalAlpha = sourceData[offset + 3] ?? 0;
    if (currentAlpha <= 0 || originalAlpha <= 0) continue;

    const edgePosition = clampUnit((edgeRadius - distanceFromCut + 1) / Math.max(1, edgeRadius));
    const targetDistance = Math.sqrt(colorDistanceSquared(sourceData, offset, target));
    const matteSimilarity = targetDistance <= matteTolerance ? 1 - targetDistance / matteTolerance : 0;
    const alphaVulnerability = clampUnit((248 - originalAlpha) / (218 - transitionAmount * 82));

    if (decontaminateAmount > 0 && matteSimilarity > 0.05) {
      const foreground = findForegroundColor(index);
      if (foreground) {
        const currentRed = sourceData[offset] ?? 0;
        const currentGreen = sourceData[offset + 1] ?? 0;
        const currentBlue = sourceData[offset + 2] ?? 0;
        const currentLuma = currentRed * 0.2126 + currentGreen * 0.7152 + currentBlue * 0.0722;
        const lightResidueBias =
          targetLuma > foreground.luma
            ? clampUnit((currentLuma - foreground.luma - 4) / Math.max(28, targetLuma - foreground.luma))
            : 0;
        const darkResidueBias =
          targetLuma < foreground.luma
            ? clampUnit((foreground.luma - currentLuma - 4) / Math.max(28, foreground.luma - targetLuma))
            : 0;
        const residueBias = Math.max(matteSimilarity, lightResidueBias, darkResidueBias);
        const confidence = clampUnit(foreground.weight / (1.4 + sampleRadius * 0.42));
        const colorPull = clampUnit(
          decontaminateAmount *
            Math.pow(edgePosition, 0.88) *
            residueBias *
            (0.42 + alphaVulnerability * 0.28 + confidence * 0.3),
        );

        if (colorPull > 0) {
          softened[offset] = Math.round(currentRed * (1 - colorPull) + foreground.color[0] * colorPull);
          softened[offset + 1] = Math.round(currentGreen * (1 - colorPull) + foreground.color[1] * colorPull);
          softened[offset + 2] = Math.round(currentBlue * (1 - colorPull) + foreground.color[2] * colorPull);
        }
      }
    }

    const softenStrength =
      transitionAmount *
      Math.pow(edgePosition, 0.92 + (1 - featherAmount) * 0.28) *
      (0.16 + matteSimilarity * 0.58 + alphaVulnerability * 0.3);
    softened[offset + 3] = Math.min(currentAlpha, Math.round(currentAlpha * (1 - clampUnit(softenStrength))));
  }

  const blurred = new Uint8ClampedArray(softened);
  for (let index = 0; index < totalPixels; index += 1) {
    const distanceFromCut = edgeDistance[index] ?? 0;
    if (distanceFromCut === 0) continue;

    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    const currentAlpha = softened[offset + 3] ?? 0;
    if (currentAlpha <= 0) continue;

    let alphaTotal = 0;
    let weightTotal = 0;

    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      const sampleY = y + yOffset;
      if (sampleY < 0 || sampleY >= height) continue;

      for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
        const sampleX = x + xOffset;
        if (sampleX < 0 || sampleX >= width) continue;

        const sampleIndex = sampleY * width + sampleX;
        const sampleOffset = sampleIndex * 4;
        const sampleAlpha = selected[sampleIndex] ? 0 : (softened[sampleOffset + 3] ?? 0);
        const sampleDistance = Math.max(1, Math.hypot(xOffset, yOffset));
        const weight = xOffset === 0 && yOffset === 0 ? 1.8 : 1 / sampleDistance;

        alphaTotal += sampleAlpha * weight;
        weightTotal += weight;
      }
    }

    if (weightTotal <= 0) continue;

    const edgePosition = clampUnit((edgeRadius - distanceFromCut + 1) / Math.max(1, edgeRadius));
    const averagedAlpha = Math.round(alphaTotal / weightTotal);
    const blurMix = transitionAmount * Math.pow(edgePosition, 0.72) * 0.64;
    blurred[offset + 3] = Math.min(currentAlpha, Math.round(currentAlpha * (1 - blurMix) + averagedAlpha * blurMix));
  }

  let changed = 0;
  for (let index = 0; index < totalPixels; index += 1) {
    const distanceFromCut = edgeDistance[index] ?? 0;
    if (distanceFromCut === 0) continue;

    const offset = index * 4;
    const nextRed = blurred[offset] ?? 0;
    const nextGreen = blurred[offset + 1] ?? 0;
    const nextBlue = blurred[offset + 2] ?? 0;
    const nextAlpha = blurred[offset + 3] ?? 0;
    if (
      nextRed === data[offset] &&
      nextGreen === data[offset + 1] &&
      nextBlue === data[offset + 2] &&
      nextAlpha === data[offset + 3]
    ) {
      continue;
    }

    data[offset] = nextRed;
    data[offset + 1] = nextGreen;
    data[offset + 2] = nextBlue;
    data[offset + 3] = nextAlpha;
    changed += 1;
  }

  return changed;
}
