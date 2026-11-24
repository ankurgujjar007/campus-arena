const errorMiddleware = (err, req, res, _next) => {
  console.error(err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  return res.status(statusCode).json({
    success: false,
    message,
    data: null
  });
};

module.exports = errorMiddleware;
