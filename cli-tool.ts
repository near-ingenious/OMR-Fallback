import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { HybridOMRPipeline } from './omr-pipeline';
import { ResultsExporter } from './export-importer';

const program = new Command();

program
  .name('omr-tool')
  .description('Hybrid OMR grading system CLI')
  .version('1.0.0');

program
  .command('process')
  .description('Process a single OMR sheet')
  .argument('<image>', 'Path to OMR image')
  .argument('<answerKey>', 'JSON file with answer key')
  .action(async (image, answerKey) => {
    const omr = new HybridOMRPipeline();
    const keyData = JSON.parse(await fs.readFile(answerKey, 'utf-8'));
    const answerKey = new Map<number, number[]>(keyData);
    
    const result = await omr.processSheet(image, answerKey);
    console.log(JSON.stringify(result, null, 2));
    
    await omr.terminate();
  });

program
  .command('batch')
  .description('Process batch of OMR sheets')
  .argument('<directory>', 'Directory containing OMR images')
  .argument('<answerKey>', 'JSON file with answer key')
  .option('-o, --output <file>', 'Output CSV file', 'results.csv')
  .action(async (directory, answerKey, options) => {
    const omr = new HybridOMRPipeline();
    const keyData = JSON.parse(await fs.readFile(answerKey, 'utf-8'));
    const answerKey = new Map<number, number[]>(keyData);
    
    const files = await fs.readdir(directory);
    const imageFiles = files.filter(f => f.match(/\.(jpg|jpeg|png)$/i));
    
    const results = [];
    for (const file of imageFiles) {
      const result = await omr.processSheet(path.join(directory, file), answerKey);
      results.push(result);
      console.log(`Processed ${file}: ${result.studentId} - ${result.totalScore.toFixed(2)}`);
    }
    
    const csv = ResultsExporter.toCSV(results);
    await fs.writeFile(options.output, csv);
    console.log(`Results saved to ${options.output}`);
    
    await omr.terminate();
  });

program.parse();