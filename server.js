import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { handleTemplateRequest, getAvailableTemplateTypes, getTemplateInfo } from './templateRegistry.js';
import { FALLBACK_BUCKET } from './constants.js';
import { queueService } from './services/queueService.js';
import { authMiddleware } from './middlewares/authMiddleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error('❌ Error: API_KEY environment variable is required');
  process.exit(1);
}

app.use(helmet());
app.use(cors());
app.use(express.json());

// Middleware to log requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Protect image generation operations
app.use('/generate', authMiddleware(API_KEY));

// GET endpoint to list available templates
app.get('/templates', (req, res) => {
  try {
    const templateTypes = getAvailableTemplateTypes();
    const templates = templateTypes.map(type => getTemplateInfo(type));
    
    res.json({
      success: true,
      templates,
      total: templates.length
    });
  } catch (error) {
    console.error('Error listing templates:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to list templates' 
    });
  }
});

// POST endpoint for image generation
app.post('/generate/:templateType', async (req, res) => {
  try {
    const { templateType } = req.params;
    const props = req.body ?? {};
    
    // Validate template type
    if (!templateType) {
      return res.status(400).json({ 
        success: false, 
        error: 'Template type is required' 
      });
    }

    console.log(`🎨 Queuing template request: ${templateType}`);
    console.log('Props:', props);

    // Add request to queue
    const requestId = queueService.addRequest({
      templateType,
      props,
      handler: handleTemplateRequest
    });

    // respond immediately; worker will continue in background
    res.status(202).json({ success: true, accepted: true, message: `Request: ${requestId} queued` });

  } catch (error) {
    console.error('Error generating image:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Image generation failed' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /templates',
      'POST /generate/:templateType'
    ]
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
