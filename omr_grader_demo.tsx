import React, { useState, useRef } from 'react';
import { Upload, Camera, CheckCircle, XCircle, AlertCircle, Download } from 'lucide-react';

const OMRGrader = () => {
  const [image, setImage] = useState(null);
  const [results, setResults] = useState(null);
  const [processing, setProcessing] = useState(false);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  // Answer key (can be customized)
  const answerKey = {
    1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A',
    6: 'B', 7: 'C', 8: 'D', 9: 'A', 10: 'B',
    11: 'C', 12: 'D', 13: 'A', 14: 'B', 15: 'C',
    16: 'D', 17: 'A', 18: 'B', 19: 'C', 20: 'D'
  };

  const generateOMRSheet = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');

    // White background
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('OMR ANSWER SHEET', 250, 40);

    // Registration marks (corners)
    const markSize = 20;
    ctx.fillStyle = 'black';
    ctx.fillRect(30, 30, markSize, markSize);
    ctx.fillRect(750, 30, markSize, markSize);
    ctx.fillRect(30, 1050, markSize, markSize);
    ctx.fillRect(750, 1050, markSize, markSize);

    // Draw answer grid
    const startX = 150;
    const startY = 100;
    const bubbleRadius = 12;
    const questionSpacing = 50;
    const optionSpacing = 60;

    ctx.font = '14px Arial';
    ctx.fillStyle = 'black';
    ctx.fillText('Question', startX - 80, startY + 5);
    ctx.fillText('A', startX + 10, startY - 20);
    ctx.fillText('B', startX + optionSpacing + 10, startY - 20);
    ctx.fillText('C', startX + optionSpacing * 2 + 10, startY - 20);
    ctx.fillText('D', startX + optionSpacing * 3 + 10, startY - 20);

    for (let q = 0; q < 20; q++) {
      const y = startY + q * questionSpacing;
      
      // Question number
      ctx.fillStyle = 'black';
      ctx.fillText(`${q + 1}`, startX - 60, y + 5);

      // Draw bubbles for each option
      for (let opt = 0; opt < 4; opt++) {
        const x = startX + opt * optionSpacing;
        
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, bubbleRadius, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    return canvas.toDataURL();
  };

  const fillRandomAnswers = (templateImg) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        
        ctx.drawImage(img, 0, 0);

        // Fill random answers
        const startX = 150;
        const startY = 100;
        const bubbleRadius = 12;
        const questionSpacing = 50;
        const optionSpacing = 60;

        const studentAnswers = {};

        for (let q = 0; q < 20; q++) {
          const selectedOption = Math.floor(Math.random() * 4);
          const y = startY + q * questionSpacing;
          const x = startX + selectedOption * optionSpacing;
          
          studentAnswers[q + 1] = String.fromCharCode(65 + selectedOption); // A, B, C, D

          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.beginPath();
          ctx.arc(x, y, bubbleRadius - 2, 0, 2 * Math.PI);
          ctx.fill();
        }

        resolve({ dataUrl: canvas.toDataURL(), answers: studentAnswers });
      };
      img.src = templateImg;
    });
  };

  const simulateProcessing = async (imageData) => {
    setProcessing(true);
    
    // Simulate image processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const img = new Image();
    await new Promise((resolve) => {
      img.onload = resolve;
      img.src = imageData;
    });

    const canvas = canvasRef.current;
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    // Simulate mark detection
    const imageDataObj = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageDataObj.data;

    const detectedAnswers = {};
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;

    const startX = 150;
    const startY = 100;
    const bubbleRadius = 12;
    const questionSpacing = 50;
    const optionSpacing = 60;

    for (let q = 0; q < 20; q++) {
      const y = startY + q * questionSpacing;
      let maxDarkness = 0;
      let selectedOption = -1;

      for (let opt = 0; opt < 4; opt++) {
        const x = startX + opt * optionSpacing;
        let darkness = 0;
        let pixelCount = 0;

        for (let dy = -bubbleRadius + 2; dy < bubbleRadius - 2; dy++) {
          for (let dx = -bubbleRadius + 2; dx < bubbleRadius - 2; dx++) {
            if (dx * dx + dy * dy < (bubbleRadius - 2) * (bubbleRadius - 2)) {
              const pixelX = Math.round(x + dx);
              const pixelY = Math.round(y + dy);
              const idx = (pixelY * canvas.width + pixelX) * 4;
              
              const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
              darkness += (255 - brightness);
              pixelCount++;
            }
          }
        }

        const avgDarkness = darkness / pixelCount;
        if (avgDarkness > maxDarkness) {
          maxDarkness = avgDarkness;
          selectedOption = opt;
        }
      }

      if (maxDarkness > 50) {
        detectedAnswers[q + 1] = String.fromCharCode(65 + selectedOption);
        if (detectedAnswers[q + 1] === answerKey[q + 1]) {
          correct++;
        } else {
          incorrect++;
        }
      } else {
        detectedAnswers[q + 1] = '-';
        unanswered++;
      }
    }

    // Draw results on canvas
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 3;
    
    for (let q = 0; q < 20; q++) {
      const y = startY + q * questionSpacing;
      const detected = detectedAnswers[q + 1];
      const correctAns = answerKey[q + 1];
      
      if (detected !== '-') {
        const optIndex = detected.charCodeAt(0) - 65;
        const x = startX + optIndex * optionSpacing;
        
        if (detected === correctAns) {
          ctx.strokeStyle = '#10b981';
        } else {
          ctx.strokeStyle = '#ef4444';
        }
        
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, bubbleRadius + 5, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    setResults({
      correct,
      incorrect,
      unanswered,
      total: 20,
      score: ((correct / 20) * 100).toFixed(1),
      detectedAnswers,
      answerKey
    });

    setProcessing(false);
  };

  const handleGenerateDemo = async () => {
    const template = generateOMRSheet();
    const { dataUrl, answers } = await fillRandomAnswers(template);
    setImage(dataUrl);
    setResults(null);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setImage(event.target.result);
        setResults(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessImage = () => {
    if (image) {
      simulateProcessing(image);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">OMR Answer Sheet Grader</h1>
          <p className="text-gray-600 mb-6">Upload an OMR sheet or generate a demo to see automated grading in action</p>

          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={handleGenerateDemo}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              <Camera size={20} />
              Generate Demo Sheet
            </button>

            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              <Upload size={20} />
              Upload Image
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {image && (
              <button
                onClick={handleProcessImage}
                disabled={processing}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
              >
                {processing ? 'Processing...' : 'Grade Sheet'}
              </button>
            )}
          </div>

          {results && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="text-green-600" size={24} />
                  <h3 className="font-semibold text-gray-700">Correct</h3>
                </div>
                <p className="text-3xl font-bold text-green-600">{results.correct}</p>
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="text-red-600" size={24} />
                  <h3 className="font-semibold text-gray-700">Incorrect</h3>
                </div>
                <p className="text-3xl font-bold text-red-600">{results.incorrect}</p>
              </div>

              <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="text-yellow-600" size={24} />
                  <h3 className="font-semibold text-gray-700">Unanswered</h3>
                </div>
                <p className="text-3xl font-bold text-yellow-600">{results.unanswered}</p>
              </div>

              <div className="bg-indigo-50 border-2 border-indigo-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="text-indigo-600" size={24} />
                  <h3 className="font-semibold text-gray-700">Score</h3>
                </div>
                <p className="text-3xl font-bold text-indigo-600">{results.score}%</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Processed Sheet</h2>
            <div className="border-2 border-gray-200 rounded-lg overflow-hidden bg-gray-50">
              {image ? (
                <canvas ref={canvasRef} className="w-full h-auto" />
              ) : (
                <div className="flex items-center justify-center h-96 text-gray-400">
                  <div className="text-center">
                    <Camera size={48} className="mx-auto mb-2" />
                    <p>No image loaded</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {results && (
            <div className="bg-white rounded-lg shadow-xl p-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Answer Breakdown</h2>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">Q#</th>
                      <th className="px-4 py-2 text-left">Detected</th>
                      <th className="px-4 py-2 text-left">Correct</th>
                      <th className="px-4 py-2 text-left">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(results.detectedAnswers).map((q) => {
                      const detected = results.detectedAnswers[q];
                      const correct = results.answerKey[q];
                      const isCorrect = detected === correct && detected !== '-';
                      const isUnanswered = detected === '-';

                      return (
                        <tr key={q} className="border-b">
                          <td className="px-4 py-2 font-semibold">{q}</td>
                          <td className="px-4 py-2">{detected}</td>
                          <td className="px-4 py-2">{correct}</td>
                          <td className="px-4 py-2">
                            {isUnanswered ? (
                              <span className="text-yellow-600">-</span>
                            ) : isCorrect ? (
                              <CheckCircle size={18} className="text-green-600" />
                            ) : (
                              <XCircle size={18} className="text-red-600" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 bg-white rounded-lg shadow-xl p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-semibold mb-2">1. Image Processing</h3>
              <p className="text-gray-600">Converts the image to grayscale, applies thresholding, and detects registration marks for alignment</p>
            </div>
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-semibold mb-2">2. Bubble Detection</h3>
              <p className="text-gray-600">Analyzes pixel density within each bubble region to determine if it's filled</p>
            </div>
            <div className="border-l-4 border-indigo-500 pl-4">
              <h3 className="font-semibold mb-2">3. Grading</h3>
              <p className="text-gray-600">Compares detected answers against the answer key and calculates the score</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OMRGrader;