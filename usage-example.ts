import { HybridOMRPipeline } from './omr-pipeline';
import { OMRResult } from './interfaces';

async function main() {
  // Initialize pipeline
  const omr = new HybridOMRPipeline();
  
  // Define answer key (question -> correct answers)
  const answerKey = new Map<number, number[]>([
    [1, [0]], // Single answer
    [2, [1]], // Single answer
    [3, [0, 2]], // Multiple correct answers
    [4, [3]], // Single answer
    // ... etc
  ]);
  
  try {
    // Process a single sheet
    const result: OMRResult = await omr.processSheet('path/to/omr_sheet.jpg', answerKey);
    
    // Output results
    console.log(`Student ID: ${result.studentId} (confidence: ${result.studentIdConfidence.toFixed(2)})`);
    console.log(`Total Score: ${result.totalScore.toFixed(2)}`);
    console.log(`Processing Time: ${result.processingTime.toFixed(2)}ms`);
    
    if (result.flags.length > 0) {
      console.log(`Flags: ${result.flags.join(', ')}`);
    }
    
    // Detailed answers
    result.answers.forEach(q => {
      console.log(`Q${q.question}: [${q.detectedAnswers.join(', ')}] - ${q.partialCredit.toFixed(2)} points`);
    });
    
  } catch (error) {
    console.error('OMR processing failed:', error);
  } finally {
    await omr.terminate();
  }
}