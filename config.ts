export const DEFAULT_CONFIG: OMRConfig = {
  templateWidth: 800,
  templateHeight: 1100,
  bubbleRadius: 12,
  fillThreshold: 0.35,
  maxMarksPerQuestion: 3,
  minMarkerArea: 0.4 * 40 * 40,
  markerAspectRatioRange: [0.8, 1.2],
  markerSolidity: 0.85,
  rollNumberROI: { x: 500, y: 20, width: 250, height: 60 },
  bubbleGridROI: { x: 30, y: 20, cols: 4, rows: 20 },
  ocrWhitelist: '0123456789',
  yoloConfidenceThreshold: 0.5,
  yoloNMSThreshold: 0.45
};