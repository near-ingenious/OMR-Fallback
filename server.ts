
import express, { Request, Response } from 'express';
import multer from 'multer';
import { HybridOMRPipeline } from './omr-pipeline';
import { ResultsExporter } from './export-importer';

const app = express();
const upload = multer({ dest: 'uploads/' });

// Initialize pipeline once
const omr = new HybridOMRPipeline();

app.post('/process', upload.single('omrSheet'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    // Parse answer key from request body
    const answerKey = new Map<number, number[]>(
      JSON.parse(req.body.answerKey)
    );
    
    const result = await omr.processSheet(req.file.path, answerKey);
    
    res.json({
      success: true,
      data: result
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/batch', upload.array('omrSheets'), async (req: Request, res: Response) => {
  try {
    const answerKey = new Map<number, number[]>(
      JSON.parse(req.body.answerKey)
    );
    
    const results = await Promise.all(
      req.files.map(file => omr.processSheet(file.path, answerKey))
    );
    
    // Export to CSV
    const csv = ResultsExporter.toCSV(results);
    
    res.setHeader('Content-Type', 'text/csv');
    res.send(csv);
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`OMR API server running on port ${PORT}`);
});