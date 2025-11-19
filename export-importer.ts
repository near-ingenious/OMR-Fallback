
import { OMRResult } from './interfaces';

export class ResultsExporter {
  /**
   * Exports results to CSV format
   */
  static toCSV(results: OMRResult[]): string {
    const header = 'Student ID,Score,Confidence,Flags\n';
    const rows = results.map(r => 
      `${r.studentId},${r.totalScore.toFixed(2)},${r.studentIdConfidence},${r.flags.join(';')}`
    );
    return header + rows.join('\n');
  }

  /**
   * Generates annotated visualization (Section IV-C)
   */
  static generateAnnotatedSheet(
    alignedImage: cv.Mat,
    bubbleResults: BubbleResult[],
    questions: QuestionResult[]
  ): cv.Mat {
    const annotated = alignedImage.clone();
    
    // Draw detected bubbles
    bubbleResults.forEach(bubble => {
      const x = 30 + bubble.option * 60;
      const y = 20 + bubble.question * 50;
      
      if (bubble.isMarked) {
        cv.circle(annotated, new cv.Point(x, y), 12, new cv.Scalar(0, 255, 0), 2);
      }
    });
    
    // Draw question results
    questions.forEach(q => {
      if (q.isAmbiguous) {
        const y = 20 + q.question * 50;
        cv.putText(annotated, 'AMBIGUOUS', new cv.Point(300, y), 
                  cv.FONT_HERSHEY_SIMPLEX, 0.5, new cv.Scalar(0, 0, 255), 2);
      }
    });
    
    return annotated;
  }
}