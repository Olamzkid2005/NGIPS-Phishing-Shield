"""
NGIPS Phishing Shield - Structured Logging Configuration
JSON-formatted logging with request ID tracking
"""

import logging
import sys
import json
from datetime import datetime, timezone
from typing import Any, Dict
import uuid
from contextvars import ContextVar

# Context variable for request ID tracking
request_id_var: ContextVar[str] = ContextVar('request_id', default='')


class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as JSON
        """
        log_data: Dict[str, Any] = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        }
        
        # Add request ID if available
        request_id = request_id_var.get()
        if request_id:
            log_data['request_id'] = request_id
        
        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)
        
        # Add extra fields from record
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)
        
        return json.dumps(log_data)


class TextFormatter(logging.Formatter):
    """
    Human-readable text formatter for development
    """
    
    def format(self, record: logging.LogRecord) -> str:
        """
        Format log record as readable text
        """
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        request_id = request_id_var.get()
        request_id_str = f" [{request_id[:8]}]" if request_id else ""
        
        base_msg = f"{timestamp} {record.levelname:8s} {record.name}{request_id_str}: {record.getMessage()}"
        
        if record.exc_info:
            base_msg += "\n" + self.formatException(record.exc_info)
        
        return base_msg


def setup_logging(log_level: str = "INFO", log_format: str = "json") -> None:
    """
    Configure application logging
    
    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Format type ("json" or "text")
    """
    # Get root logger
    root_logger = logging.getLogger()
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Set log level
    root_logger.setLevel(getattr(logging, log_level.upper()))
    
    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, log_level.upper()))
    
    # Set formatter based on format type
    if log_format.lower() == "json":
        formatter = JSONFormatter()
    else:
        formatter = TextFormatter()
    
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)
    
    # Reduce noise from third-party libraries
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name
    
    Args:
        name: Logger name (typically __name__)
    
    Returns:
        Logger instance
    """
    return logging.getLogger(name)


def set_request_id(request_id: str = None) -> str:
    """
    Set request ID for current context
    
    Args:
        request_id: Request ID (generated if not provided)
    
    Returns:
        The request ID that was set
    """
    if request_id is None:
        request_id = str(uuid.uuid4())
    
    request_id_var.set(request_id)
    return request_id


def get_request_id() -> str:
    """
    Get current request ID from context
    
    Returns:
        Current request ID or empty string
    """
    return request_id_var.get()


def log_with_extra(logger: logging.Logger, level: str, message: str, **extra_fields) -> None:
    """
    Log message with extra structured fields
    
    Args:
        logger: Logger instance
        level: Log level (debug, info, warning, error, critical)
        message: Log message
        **extra_fields: Additional fields to include in log
    """
    log_record = logger.makeRecord(
        logger.name,
        getattr(logging, level.upper()),
        "(unknown file)",
        0,
        message,
        (),
        None
    )
    log_record.extra_fields = extra_fields
    logger.handle(log_record)


# Convenience functions for structured logging
def log_api_request(logger: logging.Logger, method: str, path: str, status_code: int, duration_ms: float) -> None:
    """
    Log API request with structured data
    """
    log_with_extra(
        logger,
        "info",
        f"{method} {path} - {status_code}",
        method=method,
        path=path,
        status_code=status_code,
        duration_ms=duration_ms,
        event_type="api_request"
    )


def log_ml_prediction(logger: logging.Logger, url: str, result: str, confidence: float, duration_ms: float) -> None:
    """
    Log ML prediction with structured data
    """
    log_with_extra(
        logger,
        "info",
        f"Prediction: {result} (confidence: {confidence:.2f})",
        url=url,
        result=result,
        confidence=confidence,
        duration_ms=duration_ms,
        event_type="ml_prediction"
    )


def log_error(logger: logging.Logger, error: Exception, context: Dict[str, Any] = None) -> None:
    """
    Log error with structured context
    """
    extra_fields = {
        "error_type": type(error).__name__,
        "error_message": str(error),
        "event_type": "error"
    }
    
    if context:
        extra_fields.update(context)
    
    log_with_extra(
        logger,
        "error",
        f"Error occurred: {str(error)}",
        **extra_fields
    )


if __name__ == "__main__":
    # Test logging setup
    print("Testing JSON logging:")
    setup_logging(log_level="INFO", log_format="json")
    logger = get_logger(__name__)
    
    set_request_id("test-request-123")
    logger.info("Test info message")
    logger.warning("Test warning message")
    log_with_extra(logger, "info", "Test with extra fields", user_id=123, action="test")
    
    print("\n\nTesting text logging:")
    setup_logging(log_level="INFO", log_format="text")
    logger = get_logger(__name__)
    
    set_request_id("test-request-456")
    logger.info("Test info message")
    logger.warning("Test warning message")
    log_api_request(logger, "GET", "/v1/analyze", 200, 45.2)
    log_ml_prediction(logger, "https://example.com", "safe", 0.95, 12.3)
