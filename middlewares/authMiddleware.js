export const authMiddleware = (expectedToken) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header is required'
      });
    }
    
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Invalid Authorization header'
      });
    }
    
    // Extract the token (remove 'Bearer ' prefix)
    const token = authHeader.substring(7);
    
    // Check if token matches the expected token
    if (token !== expectedToken) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key'
      });
    }
    
    next();
  };
};
