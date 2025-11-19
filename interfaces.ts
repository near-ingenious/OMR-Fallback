// ============================================================================
// interfaces.ts - Core interfaces and types
// ============================================================================

export interface OMRConfig {
  // Image parameters
  templateWidth: number;
  templateHeight: number;
  
  // Bubble detection
  bubbleRadius: number;
  fillThreshold: number; // τ = 0.35
  maxMarksPerQuestion: number; // 3
  
  // Registration
  minMarkerArea: number;
  markerAspectRatioRange: [number, number];
  markerSolidity: number;
  
  // ROI coordinates
  rollNumberROI: { x: number; y: number; width: number; height: number };
  bubbleGridROI: { x: number; y: number; cols: number; rows: number };
  
  // OCR settings
  ocrWhitelist: string;
  
  // YOLO config
  yoloConfidenceThreshold: number;
  yoloNMSThreshold: number;
}

export interface RegistrationResult {
  success: boolean;
  homography: number[][] | null;
  usedFallback: boolean;
  detectedMarkers: number;
}

export interface BubbleResult {
  question: number;
  option: number;
  fillRatio: number;
  isMarked: boolean;
}

export interface QuestionResult {
  question: number;
  detectedAnswers: number[];
  isAmbiguous: boolean;
  confidence: number;
  partialCredit: number;
}

export interface OMRResult {
  studentId: string;
  studentIdConfidence: number;
  answers: QuestionResult[];
  totalScore: number;
  processingTime: number;
  flags: string[];
}
