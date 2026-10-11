/**
 * Centralized Error and 404 Handling Middleware
 * Adheres to CodeDNA API_CONTRACT.md and SYSTEM_DESIGN.md specifications.
 */

/**
 * Handles unmatched routes (404 Not Found)
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint '${req.originalUrl}' not found`
    },
    path: req.originalUrl,
    message: `Endpoint '${req.originalUrl}' not found`
  });
}

/**
 * Handles errors thrown synchronously or passed via next(err)
 */
export function errorHandler(err, req, res, next) {
  // 1. Handle malformed JSON body from express.json()
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload in request body'
      },
      message: 'Malformed JSON payload in request body'
    });
  }

  // 2. Handle payload size limit exceeded (e.g. > 100kb)
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: 'Request body exceeds maximum allowed limit (100kb)'
      },
      message: 'Request body exceeds maximum allowed limit (100kb)'
    });
  }

  // 3. Handle CORS restriction
  if (err.message === 'Blocked by CORS policy') {
    return res.status(403).json({
      error: {
        code: 'CORS_ERROR',
        message: 'Origin is not permitted by CORS policy'
      },
      message: 'Origin is not permitted by CORS policy'
    });
  }

  // 4. Default / custom HTTP errors
  const statusCode = (typeof err.status === 'number' && err.status) || 
                     (typeof err.statusCode === 'number' && err.statusCode) || 
                     500;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  const errorMessage = err.message || 'Internal Server Error';

  if (statusCode >= 500 && process.env.NODE_ENV !== 'test') {
    console.error('[SERVER_ERROR]', err);
  }

  res.status(statusCode).json({
    error: {
      code: errorCode,
      message: errorMessage
    },
    message: errorMessage
  });
}
