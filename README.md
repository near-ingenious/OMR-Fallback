# OMR-Fallback

A Robust Hybrid Pipeline for Multi-Format Educational Assessment Integrating Computer Vision, OCR, and Deep Learning

## Table of Contents

* [Introduction](#introduction)
* [Features](#features)
* [Installation](#installation)
* [Usage](#usage)
* [Dependencies](#dependencies)
* [Configuration](#configuration)
* [Documentation](#documentation)
* [Examples](#examples)
* [Troubleshooting](#troubleshooting)
* [Contributing](#contributing)
* [License](#license)

## Introduction

OMR-Fallback is a hybrid pipeline designed to process and assess educational forms in multiple formats. It combines computer vision techniques, OCR (Optical Character Recognition), and deep learning models to reliably extract data from varied assessment sheets, even when formats differ or carry non-standard layouts.
The aim is to support educational institutions or assessment providers with a robust tool to automate grading, extraction and reporting of multi-format assessments.

## Features

* Multi-format support for assessment sheets (different layouts, styles)
* Integration of computer vision to detect regions of interest (bubbles, checkboxes, text zones)
* OCR to extract textual responses or identifiers
* Deep learning model(s) for recognizing marks, ticks, handwritten or printed responses
* CLI tool plus usage example for embedding or custom workflows
* Export/import interface for results (to integrate with LMS or grading systems)
* Server component (optional) for remote processing / API use

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/near-ingenious/OMR-Fallback.git  
   cd OMR-Fallback  
   ```
2. Install dependencies (assuming Node/TypeScript + Python/Jupyter environment):

   ```bash
   # For TypeScript/Node parts  
   npm install  

   # If there are Python/Jupyter notebook parts (the .ipynb)  
   pip install -r requirements.txt  
   ```
3. Build/compile TypeScript (if required):

   ```bash
   npm run build  
   ```
4. (Optional) Start the server:

   ```bash
   npm run start  
   ```

## Usage

There are multiple entry points:

* CLI tool (`cli-tool.ts`) to run from command line with configuration.
* Pipeline module (`omr-pipeline.ts`) for programmatic usage in custom scripts.
* Server component (`server.ts`) to expose as an API.
* Usage example (`usage-example.ts`) to show how to integrate the library.

### Example (CLI)

```bash
node dist/cli-tool.js --config path/to/config.json --input path/to/scan.jpeg  
```

### Example (Programmatically)

```ts
import { runOMR } from './omr-pipeline';  
const config = require('./config');  
const result = await runOMR(config, 'path/to/scan.jpeg');  
console.log(result);  
```

## Dependencies

* Node.js + TypeScript environment
* Python (for notebooks) if using the `.ipynb` part
* OCR engine/library (e.g., Tesseract, or whichever specified in config)
* Deep learning framework (e.g., TensorFlow, PyTorch) depending on the implementation in notebook
* Computer vision library (e.g., OpenCV)
* Other dependencies listed in `package.json`, `requirements.txt`

## Configuration

The `config.ts` (and corresponding JSON) allows you to specify:

* Paths to models (deep learning)
* OCR settings (language, engine)
* Region definitions or format templates (for multi-format support)
* Output formatting (JSON, CSV, LMS integration)
* Server settings (port, API endpoints)

Example snippet of config:

```json
{  
  "formats": [  
    {  
      "name": "FormatA",  
      "templateImage": "templates/formatA.png",  
      "bubbleRegion": { "x": 100, "y": 200, "width": 300, "height": 400 }  
    }  
  ],  
  "ocr": { "language": "eng", "engine": "tesseract" },  
  "model": { "path": "models/mark_recogniser.pt" }  
}  
```

## Documentation

* The Jupyter notebook `OMR.ipynb` provides a walkthrough of the pipeline and shows experiments / model training.
* Inline comments and TypeScript interfaces (`interfaces.ts`) document the architecture and expected data flows.
* The export/importer (`export-importer.ts`) handles integration with external systems.
* For API usage, see `server.ts` which defines endpoints and request/response formats.

## Examples

* A sample scan image and the processing result (not included in repo) to demonstrate full workflow.
* `usage-example.ts` in the repo shows how to integrate the pipeline into a larger system.
* Extend the pipeline by adding new format definitions in the configuration to support additional assessment templates.

## Troubleshooting

* If results are poor (accuracy low): check image quality, alignment, lighting and template definitions.
* If OCR fails: ensure the correct language/engine is set and input image resolution is good.
* If pipeline hangs or fails: check model path in config, ensure dependencies installed and compatible.
* For server mode: verify that port isn’t blocked, and that requests match expected API schema.

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature or bug-fix branch (`git checkout -b feature-xyz`)
3. Make your changes, add tests if applicable
4. Submit a pull request with description of change
   Please abide by coding standards and include documentation for your additions.

## License

*( MIT License.)*


