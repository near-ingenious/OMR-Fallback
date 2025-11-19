import * as cv from '@techstark/opencv-js';
import Tesseract from 'tesseract.js';
import { 
  OMRConfig, DEFAULT_CONFIG, OMRResult, RegistrationResult, BubbleResult 
} from './interfaces';

export class HybridOMRPipeline {
  private config: OMRConfig;
  private tesseractWorker: Tesseract.Worker | null = null;
  private yoloModel: any = null; // Could be ONNX Runtime or tfjs model

  constructor(config: Partial<OMRConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Processes an OMR sheet image through the complete pipeline
   * Sections III-A through III-H
   */
  async processSheet(imagePath: string, answerKey: Map<number, number[]>): Promise<OMRResult> {
    const startTime = performance.now();
    const flags: string[] = [];

    try {
      // Section III-A: Preprocessing
      const image = await this.loadImage(imagePath);
      const processed = this.preprocess(image);
      
      // Section III-B: Registration Detection
      const registration = this.detectRegistration(processed);
      if (registration.usedFallback) {
        flags.push('FALLBACK_REGISTRATION');
      }
      
      // Section III-C: Perspective Alignment
      const aligned = this.alignPerspective(processed, registration);
      
      // Section III-D: Bubble Grid Extraction
      const bubbleGrid = this.extractBubbleGrid(aligned);
      
      // Section III-E: Fill Ratio Analysis
      const bubbleResults = this.analyzeBubbles(bubbleGrid);
      
      // Section III-F: Multi-Answer Extraction and G: Partial Credit
      const questions = this.gradeQuestions(bubbleResults, answerKey);
      
      // Section III-G: Handwriting Recognition
      let studentId = 'UNKNOWN';
      let studentIdConfidence = 0;
      try {
        const ocrResult = await this.extractRollNumber(aligned);
        studentId = ocrResult.text;
        studentIdConfidence = ocrResult.confidence;
      } catch (error) {
        flags.push('OCR_FAILED');
      }
      
      // Compute total score
      const totalScore = questions.reduce((sum, q) => sum + q.partialCredit, 0);
      
      return {
        studentId,
        studentIdConfidence,
        answers: questions,
        totalScore,
        processingTime: performance.now() - startTime,
        flags
      };

    } catch (error) {
      throw new Error(`OMR processing failed: ${error.message}`);
    }
  }

  private async loadImage(src: string): Promise<cv.Mat> {
    // Implementation depends on environment (Node.js vs browser)
    // Using canvas for browser environment or file system for Node.js
    const img = await createImageBitmap(src);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imgData = ctx.getImageData(0, 0, img.width, img.height);
    
    return cv.matFromImageData(imgData);
  }

  /**
   * Section III-A: Preprocessing
   * Grayscale → Gaussian Blur → Adaptive Thresholding
   */
  preprocess(image: cv.Mat): cv.Mat {
    const gray = new cv.Mat();
    cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY);
    
    const blurred = new cv.Mat();
    const ksize = new cv.Size(5, 5);
    cv.GaussianBlur(gray, blurred, ksize, 1.5);
    
    const thresholded = new cv.Mat();
    cv.adaptiveThreshold(
      blurred, thresholded, 255, 
      cv.ADAPTIVE_THRESH_GAUSSIAN_C, 
      cv.THRESH_BINARY, 41, 10
    );
    
    gray.delete();
    blurred.delete();
    
    return thresholded;
  }

  /**
   * Section III-B: Robust Registration Mark Detection
   * Detects 4 corner markers with fallback to synthetic corners
   */
  detectRegistration(image: cv.Mat): RegistrationResult {
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    
    cv.findContours(
      image, contours, hierarchy,
      cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE
    );
    
    const markers: cv.Mat[] = [];
    
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      
      // Apply geometric constraints from paper (Eq. 1-3)
      const area = cv.contourArea(contour);
      const rect = cv.minAreaRect(contour);
      const aspectRatio = rect.size.width / rect.size.height;
      const hull = new cv.Mat();
      cv.convexHull(contour, hull);
      const hullArea = cv.contourArea(hull);
      const solidity = area / hullArea;
      
      const [minAspect, maxAspect] = this.config.markerAspectRatioRange;
      
      if (area > this.config.minMarkerArea && 
          aspectRatio >= minAspect && aspectRatio <= maxAspect &&
          solidity > this.config.markerSolidity) {
        markers.push(contour);
      }
      
      hull.delete();
      contour.delete();
    }
    
    // Section III-B: Fallback mechanism
    const usedFallback = markers.length < 4;
    if (usedFallback) {
      // Inject synthetic markers (Eq. 4)
      const { width, height } = image.size();
      const syntheticMarkers = [
        [50, 50], [width - 50, 50], 
        [50, height - 50], [width - 50, height - 50]
      ];
      
      syntheticMarkers.forEach(([x, y]) => {
        const pointMat = cv.matFromArray(1, 1, cv.CV_32SC2, [x, y]);
        markers.push(pointMat);
      });
    }
    
    // Estimate homography from markers
    const homography = this.estimateHomography(markers, usedFallback);
    
    // Cleanup
    contours.delete();
    hierarchy.delete();
    
    return {
      success: markers.length >= 4,
      homography,
      usedFallback,
      detectedMarkers: markers.length
    };
  }

  private estimateHomography(
    markers: cv.Mat[], 
    usedFallback: boolean
  ): number[][] | null {
    if (markers.length < 4) return null;
    
    // Template corners as destination points
    const dstPoints = [
      [50, 50], [750, 50], [50, 1050], [750, 1050]
    ];
    
    // Sort markers to match template corners (top-left, top-right, bottom-left, bottom-right)
    const srcPoints = this.sortMarkers(markers, usedFallback);
    
    if (!srcPoints) return null;
    
    // Convert to cv.Mat for findHomography
    const srcMat = cv.matFromArray(4, 1, cv.CV_32FC2, srcPoints.flat());
    const dstMat = cv.matFromArray(4, 1, cv.CV_32FC2, dstPoints.flat());
    
    const homography = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5);
    
    srcMat.delete();
    dstMat.delete();
    
    if (homography.empty()) return null;
    
    return this.matTo2DArray(homography);
  }

  private sortMarkers(markers: cv.Mat[], usedFallback: boolean): number[] | null {
    // Implementation: sort markers by their geometric positions
    // For real markers, compute centroid of each contour
    // For fallback markers, they're already points
    return null; // Placeholder - full implementation needed
  }

  private matTo2DArray(mat: cv.Mat): number[][] {
    const arr: number[][] = [];
    for (let i = 0; i < mat.rows; i++) {
      arr.push([]);
      for (let j = 0; j < mat.cols; j++) {
        arr[i].push(mat.floatAt(i, j));
      }
    }
    return arr;
  }

  /**
   * Section III-C: Perspective Alignment
   * Applies homography transform to canonical template
   */
  alignPerspective(image: cv.Mat, registration: RegistrationResult): cv.Mat {
    if (!registration.homography) {
      throw new Error('No valid homography found');
    }
    
    const dst = new cv.Mat();
    const homographyMat = cv.matFromArray(3, 3, cv.CV_32F, registration.homography.flat());
    
    cv.warpPerspective(
      image, dst, homographyMat,
      new cv.Size(this.config.templateWidth, this.config.templateHeight),
      cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar(0)
    );
    
    homographyMat.delete();
    return dst;
  }

  /**
   * Section III-D: Bubble Grid Extraction
   * Crops ROI and partitions into Q&A grid (Eq. 5-6)
   */
  extractBubbleGrid(aligned: cv.Mat): cv.Mat {
    const { x, y, cols, rows } = this.config.bubbleGridROI;
    const width = (cols - 1) * 60 + 2 * x;
    const height = (rows - 1) * 50 + 2 * y;
    
    const roiRect = new cv.Rect(x, y, width, height);
    return aligned.roi(roiRect);
  }

  /**
   * Section III-E: Fill Ratio Analysis
   * Computes fill density for each bubble (Eq. 7)
   */
  analyzeBubbles(bubbleGrid: cv.Mat): BubbleResult[] {
    const results: BubbleResult[] = [];
    
    for (let q = 0; q < this.config.bubbleGridROI.rows; q++) {
      for (let o = 0; o < this.config.bubbleGridROI.cols; o++) {
        // Compute bubble center (Eq. 5-6)
        const x = this.config.bubbleGridROI.x + o * 60;
        const y = this.config.bubbleGridROI.y + q * 50;
        
        // Extract bubble region
        const bubbleMask = this.createBubbleMask(x, y);
        
        // Compute fill ratio (Eq. 7)
        const fillRatio = this.computeFillRatio(bubbleGrid, bubbleMask);
        
        results.push({
          question: q,
          option: o,
          fillRatio,
          isMarked: fillRatio > this.config.fillThreshold
        });
        
        bubbleMask.delete();
      }
    }
    
    return results;
  }

  private createBubbleMask(centerX: number, centerY: number): cv.Mat {
    const mask = new cv.Mat(
      this.config.templateHeight, 
      this.config.templateWidth, 
      cv.CV_8UC1, 
      new cv.Scalar(0)
    );
    
    const radius = this.config.bubbleRadius;
    cv.circle(mask, new cv.Point(centerX, centerY), radius, new cv.Scalar(255), -1);
    
    return mask;
  }

  private computeFillRatio(image: cv.Mat, mask: cv.Mat): number {
    const masked = new cv.Mat();
    cv.bitwise_and(image, image, masked, mask);
    
    const totalPixels = cv.countNonZero(mask);
    const filledPixels = cv.countNonZero(masked);
    
    masked.delete();
    
    return filledPixels / totalPixels;
  }

  /**
   * Section III-F: Multi-Answer Extraction and G: Partial Credit
   * Grades questions with SCA/MCA support
   */
  gradeQuestions(
    bubbles: BubbleResult[], 
    answerKey: Map<number, number[]>
  ): QuestionResult[] {
    const questions: Map<number, QuestionResult> = new Map();
    
    // Group bubbles by question
    for (const bubble of bubbles) {
      if (!questions.has(bubble.question)) {
        questions.set(bubble.question, {
          question: bubble.question,
          detectedAnswers: [],
          isAmbiguous: false,
          confidence: 0,
          partialCredit: 0
        });
      }
      
      if (bubble.isMarked) {
        questions.get(bubble.question)!.detectedAnswers.push(bubble.option);
      }
    }
    
    // Evaluate each question
    for (const [q, result] of questions) {
      // Section III-F: Multi-mark detection
      if (result.detectedAnswers.length > this.config.maxMarksPerQuestion) {
        result.isAmbiguous = true;
        result.detectedAnswers = ['AMBIGUOUS' as any];
      }
      
      // Section III-G: Partial credit scoring
      const correctAnswers = answerKey.get(q) || [];
      result.partialCredit = this.calculatePartialCredit(result, correctAnswers);
      result.confidence = this.calculateConfidence(bubbles, q);
    }
    
    return Array.from(questions.values());
  }

  private calculatePartialCredit(
    result: QuestionResult, 
    correct: number[]
  ): number {
    // Eq. 9: Partial credit scoring logic
    if (result.detectedAnswers.length === 0) return 0;
    if (result.isAmbiguous) return 0;
    
    const detected = new Set(result.detectedAnswers);
    const correctSet = new Set(correct);
    
    // Check if all detected answers are in correct set
    for (const ans of detected) {
      if (!correctSet.has(ans)) return 0;
    }
    
    // Partial credit: proportion of correct answers marked
    return detected.size / correct.length;
  }

  private calculateConfidence(bubbles: BubbleResult[], question: number): number {
    // Confidence score based on fill ratios
    const questionBubbles = bubbles.filter(b => b.question === question);
    const marked = questionBubbles.filter(b => b.isMarked);
    
    if (marked.length === 0) return 0;
    
    const sumMarked = marked.reduce((sum, b) => sum + b.fillRatio, 0);
    const sumAll = questionBubbles.reduce((sum, b) => sum + Math.max(0, b.fillRatio - this.config.fillThreshold), 0);
    
    return sumAll > 0 ? sumMarked / sumAll : 0;
  }

  /**
   * Section III-G: Handwriting Recognition
   * Extracts student roll number using Tesseract OCR
   */
  async extractRollNumber(aligned: cv.Mat): Promise<{ text: string; confidence: number }> {
    if (!this.tesseractWorker) {
      this.tesseractWorker = await Tesseract.createWorker('eng', 1, {
        logger: m => console.log(m)
      });
    }
    
    const { x, y, width, height } = this.config.rollNumberROI;
    const roi = aligned.roi(new cv.Rect(x, y, width, height));
    
    // Preprocessing: Adaptive threshold + dilation (Eq. 8)
    const roiGray = new cv.Mat();
    cv.cvtColor(roi, roiGray, cv.COLOR_RGBA2GRAY);
    
    const roiThresh = new cv.Mat();
    cv.adaptiveThreshold(roiGray, roiThresh, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);
    
    const kernel = cv.Mat.ones(3, 3, cv.CV_8U);
    const roiDilated = new cv.Mat();
    cv.dilate(roiThresh, roiDilated, kernel, new cv.Point(-1, -1), 1);
    
    // Run OCR
    const canvas = createCanvas(roiDilated.cols, roiDilated.rows);
    cv.imshow(canvas, roiDilated);
    const buffer = canvas.toBuffer('image/png');
    
    const result = await this.tesseractWorker.recognize(buffer, {
      tessedit_char_whitelist: this.config.ocrWhitelist
    });
    
    // Extract confidence from character length ratio
    const confidence = result.text.replace(/\D/g, '').length / result.text.length;
    
    // Cleanup
    roiGray.delete();
    roiThresh.delete();
    roiDilated.delete();
    kernel.delete();
    
    return {
      text: result.data.text.replace(/\D/g, ''),
      confidence
    };
  }

  /**
   * Section III-H: YOLOv8 Alternative Path
   * Processes severely degraded images using YOLO
   */
  async detectBubblesYOLO(image: cv.Mat): Promise<BubbleResult[]> {
    if (!this.yoloModel) {
      throw new Error('YOLO model not loaded');
    }
    
    // Resize image to YOLO input size (640x640)
    const input = new cv.Mat();
    cv.resize(image, input, new cv.Size(640, 640));
    
    // Convert to tensor and run inference
    // Implementation depends on ONNX Runtime or tfjs
    // This is a placeholder for the actual YOLO inference
    
    // Post-process detections to get bubble results
    return [];
  }

  /**
   * Cleanup resources
   */
  async terminate(): Promise<void> {
    if (this.tesseractWorker) {
      await this.tesseractWorker.terminate();
      this.tesseractWorker = null;
    }
    
    if (this.yoloModel) {
      // Cleanup ML model
      this.yoloModel = null;
    }
  }
}