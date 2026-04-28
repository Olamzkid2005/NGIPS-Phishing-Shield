# Requirements Document: NGIPS Transformation with AI

## Introduction

This document specifies the requirements for transforming the Olazkid phishing detection repository from a standalone Flask web application into a comprehensive Next-Generation Intrusion Prevention System (NGIPS). The system will provide real-time phishing detection and prevention through a browser-based sensor, an AI-powered inspection engine, and a modern management dashboard. The transformation includes migrating the backend to React, retraining and enhancing ML models with advanced AI capabilities, building a Manifest V3 browser extension, and creating a React dashboard for system management and monitoring.

## Glossary

- **NGIPS**: Next-Generation Intrusion Prevention System - A security system that monitors network traffic and prevents malicious activities in real-time
- **Sensor**: The browser extension component that intercepts and monitors URL navigation events
- **AI_Inspection_Engine**: The React backend service that performs ML-based phishing detection and analysis
- **Management_Dashboard**: The Next.js 15 web application for monitoring, configuration, and analytics
- **ML_Model**: Machine Learning model trained to classify URLs as phishing or legitimate
- **Feature_Extractor**: Component that analyzes URL structure and extracts features for ML prediction
- **Threat_Intelligence**: External data sources providing information about known malicious URLs and domains
- **Ensemble_Model**: A combination of multiple ML models that vote on predictions to improve accuracy
- **Confidence_Score**: A numerical value (0-1) indicating the model's certainty in its prediction
- **False_Positive**: A legitimate URL incorrectly classified as phishing
- **False_Negative**: A phishing URL incorrectly classified as legitimate
- **Round_Trip_Property**: A property where parsing then printing then parsing produces an equivalent result
- **Row_Level_Security**: Database security policy that restricts data access based on user identity
- **CORS**: Cross-Origin Resource Sharing - Browser security mechanism for API access control
- **Manifest_V3**: The latest Chrome extension platform specification
- **Service_Worker**: Background script in Manifest V3 extensions that handles events
- **Prisma**: TypeScript ORM (Object-Relational Mapping) for database access
- **SQLite**: Lightweight file-based relational database
- **WCAG**: Web Content Accessibility Guidelines - Standards for accessible web content
- **API_Endpoint**: A specific URL path in the API that handles requests
- **Rate_Limiting**: Mechanism to restrict the number of API requests from a client
- **Joblib**: Python library for serializing and deserializing ML models
- **Cross_Validation**: ML technique for assessing model performance on unseen data
- **Model_Versioning**: System for tracking and managing different versions of ML models
- **Atomic_Transaction**: Database operation that completes entirely or not at all
- **JWT**: JSON Web Token - Standard for secure authentication tokens
- **PII**: Personally Identifiable Information - Data that can identify an individual

## Requirements

### Requirement 1: Backend Migration to React

**User Story:** As a system architect, I want to migrate the Flask backend to React, so that the system can handle high-performance ML inference with asynchronous processing.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL use React framework with Express ASGI server
2. THE AI_Inspection_Engine SHALL load ML models from joblib format files during startup
3. THE AI_Inspection_Engine SHALL expose a `/v1/analyze` API_Endpoint that accepts URL strings
4. WHEN a URL analysis request is received, THE AI_Inspection_Engine SHALL return results within 100 milliseconds
5. THE AI_Inspection_Engine SHALL implement CORS configuration to allow requests from the browser extension origin
6. THE AI_Inspection_Engine SHALL provide a `/health` API_Endpoint that returns system status
7. THE AI_Inspection_Engine SHALL provide a `/metrics` API_Endpoint that returns performance statistics
8. THE AI_Inspection_Engine SHALL log all analysis requests with timestamp, URL, and prediction result
9. THE AI_Inspection_Engine SHALL use environment variables for configuration (database path, model paths, CORS origins)
10. THE AI_Inspection_Engine SHALL validate all input parameters and return descriptive error messages for invalid requests

### Requirement 2: Database Layer Implementation

**User Story:** As a system administrator, I want persistent storage for scan logs and configuration, so that I can track system activity and maintain historical data.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL use SQLite database with Prisma ORM for data persistence
2. THE AI_Inspection_Engine SHALL store scan records with fields: id, url, result, confidence_score, timestamp, model_version
3. THE AI_Inspection_Engine SHALL store user feedback records with fields: id, scan_id, is_false_positive, user_comment, timestamp
4. THE AI_Inspection_Engine SHALL store configuration settings with fields: key, value, description, updated_at
5. THE AI_Inspection_Engine SHALL store blocked threat records with fields: id, url, threat_level, block_count, first_seen, last_seen
6. THE AI_Inspection_Engine SHALL implement database migrations using Prisma migrate
7. THE AI_Inspection_Engine SHALL use Atomic_Transaction for operations that modify multiple records
8. THE AI_Inspection_Engine SHALL create database indexes on frequently queried fields (url, timestamp, result)
9. THE AI_Inspection_Engine SHALL provide database seeding scripts for initial configuration data
10. THE AI_Inspection_Engine SHALL implement database backup mechanism that runs daily

### Requirement 3: ML Model Retraining and Enhancement

**User Story:** As a data scientist, I want to retrain the existing ML models with proper validation, so that the system achieves higher accuracy and reliability.

#### Acceptance Criteria

1. THE ML_Model SHALL be trained using datasets from Dataset/phishing_site_urls.csv and Dataset/verified_online.csv
2. THE ML_Model SHALL implement train-test split with 80% training data and 20% test data
3. THE ML_Model SHALL use 5-fold cross-validation during training
4. THE ML_Model SHALL achieve minimum 95% accuracy on the test dataset
5. THE ML_Model SHALL achieve maximum 2% false positive rate on the test dataset
6. THE ML_Model SHALL include both Logistic Regression and Naive Bayes classifiers
7. THE ML_Model SHALL be serialized in joblib format with version metadata
8. THE ML_Model SHALL include the trained vectorizer in the serialized model file
9. THE ML_Model SHALL record training metrics (accuracy, precision, recall, F1-score) in a metrics file
10. THE ML_Model SHALL include a training script that can be re-run to retrain models with new data

### Requirement 4: Advanced AI Layer Integration

**User Story:** As a security analyst, I want advanced AI capabilities beyond traditional ML, so that the system can detect sophisticated phishing attacks.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL implement an Ensemble_Model that combines predictions from multiple ML_Model instances
2. THE AI_Inspection_Engine SHALL calculate a Confidence_Score for each prediction based on model agreement
3. THE Feature_Extractor SHALL analyze URL structure including TLD, path length, subdomain count, special character ratio
4. THE Feature_Extractor SHALL analyze domain reputation using age and registration information when available
5. THE Feature_Extractor SHALL analyze SSL certificate validity when HTTPS URLs are provided
6. THE AI_Inspection_Engine SHALL integrate with external Threat_Intelligence feeds (PhishTank, OpenPhish) for known malicious URLs
7. WHEN Threat_Intelligence indicates a URL is malicious, THE AI_Inspection_Engine SHALL return a block action with high confidence
8. THE AI_Inspection_Engine SHALL implement uncertainty quantification that flags predictions with low Confidence_Score for manual review
9. THE AI_Inspection_Engine SHALL support model versioning with ability to load and compare different model versions
10. THE AI_Inspection_Engine SHALL log feature extraction results for model improvement and debugging

### Requirement 5: Browser Extension Development

**User Story:** As an end user, I want a browser extension that protects me from phishing sites, so that I am blocked from accessing malicious URLs before the page loads.

#### Acceptance Criteria

1. THE Sensor SHALL be implemented as a Manifest V3 Chrome extension
2. THE Sensor SHALL use a Service_Worker to intercept navigation events using chrome.webNavigation API
3. WHEN a user navigates to a URL, THE Sensor SHALL send the URL to the AI_Inspection_Engine `/v1/analyze` API_Endpoint
4. WHEN the AI_Inspection_Engine returns a block action, THE Sensor SHALL inject a warning overlay preventing page access
5. WHEN the AI_Inspection_Engine returns an allow action, THE Sensor SHALL permit normal page loading
6. THE Sensor SHALL implement local caching to avoid repeated API calls for recently checked URLs
7. THE Sensor SHALL provide a popup interface showing recent scan results and statistics
8. THE Sensor SHALL allow users to whitelist trusted domains that bypass analysis
9. THE Sensor SHALL allow users to report false positives directly from the warning overlay
10. THE Sensor SHALL handle API errors gracefully and allow page access when the AI_Inspection_Engine is unavailable
11. THE Sensor SHALL add analysis latency of less than 50 milliseconds to page navigation
12. THE Sensor SHALL store user preferences (whitelist, settings) in chrome.storage.local

### Requirement 6: Warning Overlay Implementation

**User Story:** As an end user, I want clear warnings when accessing phishing sites, so that I understand the threat and can make informed decisions.

#### Acceptance Criteria

1. WHEN a URL is blocked, THE Sensor SHALL inject a full-page warning overlay that prevents access to the underlying page
2. THE warning overlay SHALL display the threat level and Confidence_Score
3. THE warning overlay SHALL display the specific reasons for blocking (e.g., "Known phishing site", "Suspicious URL structure")
4. THE warning overlay SHALL provide a "Go Back" button that navigates to the previous page
5. THE warning overlay SHALL provide a "Report False Positive" button that sends feedback to the AI_Inspection_Engine
6. THE warning overlay SHALL provide an "I Understand the Risk" button that allows advanced users to proceed
7. WHEN a user proceeds despite the warning, THE Sensor SHALL log this action to the AI_Inspection_Engine
8. THE warning overlay SHALL meet WCAG 2.1 Level AA accessibility standards
9. THE warning overlay SHALL be responsive and display correctly on mobile and desktop browsers
10. THE warning overlay SHALL use clear, non-technical language that average users can understand

### Requirement 7: Next.js Dashboard Development

**User Story:** As a system administrator, I want a modern dashboard to monitor system activity, so that I can track threats and system performance in real-time.

#### Acceptance Criteria

1. THE Management_Dashboard SHALL be implemented using Next.js 15 with App Router
2. THE Management_Dashboard SHALL use React Server Components for direct database access via Prisma
3. THE Management_Dashboard SHALL display a real-time monitoring page showing recent scan results
4. THE Management_Dashboard SHALL display threat analytics with charts showing scan volume, block rate, and threat trends
5. THE Management_Dashboard SHALL display a feedback management page listing user-reported false positives
6. THE Management_Dashboard SHALL display a settings page for configuring system parameters
7. THE Management_Dashboard SHALL implement server-side rendering for initial page load performance
8. THE Management_Dashboard SHALL update scan statistics every 5 seconds using polling or WebSocket
9. THE Management_Dashboard SHALL support dark mode theme
10. THE Management_Dashboard SHALL meet WCAG 2.1 Level AA accessibility standards
11. THE Management_Dashboard SHALL be responsive and work on mobile, tablet, and desktop screen sizes
12. THE Management_Dashboard SHALL implement authentication for administrative access (optional for MVP)

### Requirement 8: Real-Time Monitoring Interface

**User Story:** As a security analyst, I want to see scan results in real-time, so that I can monitor threats as they occur.

#### Acceptance Criteria

1. THE Management_Dashboard SHALL display a table of recent scans with columns: timestamp, URL, result, confidence, action taken
2. THE Management_Dashboard SHALL update the scan table automatically when new scans occur
3. THE Management_Dashboard SHALL allow filtering scans by result (blocked, allowed), date range, and confidence threshold
4. THE Management_Dashboard SHALL allow searching scans by URL or domain
5. THE Management_Dashboard SHALL display scan details when a row is clicked, including feature extraction results
6. THE Management_Dashboard SHALL display current system status (API health, database status, model version)
7. THE Management_Dashboard SHALL display performance metrics (average response time, requests per minute, cache hit rate)
8. THE Management_Dashboard SHALL highlight high-threat scans with visual indicators
9. THE Management_Dashboard SHALL allow exporting scan data to CSV format
10. THE Management_Dashboard SHALL paginate scan results with 50 records per page

### Requirement 9: Threat Analytics Visualization

**User Story:** As a security manager, I want visual analytics of threat trends, so that I can understand attack patterns and system effectiveness.

#### Acceptance Criteria

1. THE Management_Dashboard SHALL display a line chart showing scan volume over time (hourly, daily, weekly views)
2. THE Management_Dashboard SHALL display a pie chart showing the distribution of blocked vs allowed URLs
3. THE Management_Dashboard SHALL display a bar chart showing top blocked domains
4. THE Management_Dashboard SHALL display a line chart showing model accuracy metrics over time
5. THE Management_Dashboard SHALL display a gauge showing current false positive rate
6. THE Management_Dashboard SHALL display a heatmap showing scan activity by hour of day and day of week
7. THE Management_Dashboard SHALL allow selecting date ranges for all charts
8. THE Management_Dashboard SHALL display summary statistics (total scans, total blocks, block rate percentage)
9. THE Management_Dashboard SHALL display model performance metrics (accuracy, precision, recall, F1-score)
10. THE Management_Dashboard SHALL update charts automatically when new data is available

### Requirement 10: Feedback Management System

**User Story:** As a system administrator, I want to manage user feedback on false positives, so that I can improve model accuracy.

#### Acceptance Criteria

1. THE Management_Dashboard SHALL display a list of user-reported false positives with URL, report date, and user comment
2. THE Management_Dashboard SHALL allow marking feedback as "Confirmed False Positive", "Correctly Blocked", or "Under Review"
3. WHEN feedback is marked as "Confirmed False Positive", THE Management_Dashboard SHALL add the URL to a whitelist
4. THE Management_Dashboard SHALL display statistics on feedback (total reports, confirmed false positives, accuracy improvement)
5. THE Management_Dashboard SHALL allow exporting feedback data for model retraining
6. THE Management_Dashboard SHALL allow administrators to add comments to feedback entries
7. THE Management_Dashboard SHALL send notifications when new feedback is submitted
8. THE Management_Dashboard SHALL display the original scan details alongside feedback
9. THE Management_Dashboard SHALL allow bulk actions on multiple feedback entries
10. THE Management_Dashboard SHALL track which administrator reviewed each feedback entry

### Requirement 11: API Security and Rate Limiting

**User Story:** As a security engineer, I want API security controls, so that the system is protected from abuse and unauthorized access.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL implement rate limiting of 100 requests per minute per client IP address
2. WHEN rate limit is exceeded, THE AI_Inspection_Engine SHALL return HTTP 429 status with retry-after header
3. THE AI_Inspection_Engine SHALL validate all input parameters and reject requests with invalid data
4. THE AI_Inspection_Engine SHALL sanitize URL inputs to prevent injection attacks
5. THE AI_Inspection_Engine SHALL implement CORS with explicit allowed origins (not wildcard with credentials)
6. THE AI_Inspection_Engine SHALL log all API requests with client IP, timestamp, and response status
7. THE AI_Inspection_Engine SHALL implement API authentication using API keys for production deployment
8. THE AI_Inspection_Engine SHALL use HTTPS for all API communication in production
9. THE AI_Inspection_Engine SHALL implement request timeout of 5 seconds to prevent resource exhaustion
10. THE AI_Inspection_Engine SHALL return generic error messages that do not expose internal system details

### Requirement 12: Error Handling and Logging

**User Story:** As a system operator, I want comprehensive error handling and logging, so that I can troubleshoot issues and monitor system health.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL log all errors with timestamp, error type, stack trace, and request context
2. THE AI_Inspection_Engine SHALL log all API requests with timestamp, endpoint, parameters, response time, and status code
3. THE AI_Inspection_Engine SHALL log model predictions with URL, result, confidence, and feature values
4. THE AI_Inspection_Engine SHALL implement structured logging in JSON format for easy parsing
5. THE AI_Inspection_Engine SHALL rotate log files daily and retain logs for 30 days
6. WHEN a critical error occurs, THE AI_Inspection_Engine SHALL send alerts to administrators
7. THE AI_Inspection_Engine SHALL handle database connection errors gracefully and retry with exponential backoff
8. THE AI_Inspection_Engine SHALL handle model loading errors and prevent startup if models are missing or corrupted
9. THE AI_Inspection_Engine SHALL return appropriate HTTP status codes for different error types (400, 404, 429, 500, 503)
10. THE AI_Inspection_Engine SHALL not log sensitive information (PII, credentials) in log files

### Requirement 13: Configuration Management

**User Story:** As a system administrator, I want centralized configuration management, so that I can adjust system behavior without code changes.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL load configuration from environment variables
2. THE AI_Inspection_Engine SHALL support configuration for database path, model paths, CORS origins, rate limits, and log level
3. THE AI_Inspection_Engine SHALL validate all configuration values at startup and fail fast if invalid
4. THE AI_Inspection_Engine SHALL provide default values for optional configuration parameters
5. THE AI_Inspection_Engine SHALL store runtime configuration in the database config table
6. THE Management_Dashboard SHALL provide a settings page for modifying runtime configuration
7. WHEN runtime configuration is changed, THE AI_Inspection_Engine SHALL reload configuration without restart
8. THE AI_Inspection_Engine SHALL log all configuration changes with timestamp and administrator identity
9. THE AI_Inspection_Engine SHALL support configuration profiles for development, staging, and production environments
10. THE AI_Inspection_Engine SHALL document all configuration parameters with descriptions and valid value ranges

### Requirement 14: Model Performance Monitoring

**User Story:** As a data scientist, I want to monitor model performance in production, so that I can detect model degradation and trigger retraining.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL track model prediction distribution (blocked vs allowed) over time
2. THE AI_Inspection_Engine SHALL track average Confidence_Score over time
3. THE AI_Inspection_Engine SHALL track false positive rate based on user feedback
4. THE AI_Inspection_Engine SHALL track prediction latency (time to analyze URL)
5. THE AI_Inspection_Engine SHALL calculate and store daily accuracy metrics
6. WHEN false positive rate exceeds 5%, THE AI_Inspection_Engine SHALL send an alert for model review
7. WHEN average Confidence_Score drops below 0.7, THE AI_Inspection_Engine SHALL send an alert for model review
8. THE Management_Dashboard SHALL display model performance metrics on the analytics page
9. THE Management_Dashboard SHALL display alerts when model performance degrades
10. THE AI_Inspection_Engine SHALL export model performance data for offline analysis

### Requirement 15: Testing and Quality Assurance

**User Story:** As a quality assurance engineer, I want comprehensive test coverage, so that the system is reliable and maintainable.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL have unit tests for all API endpoints with minimum 80% code coverage
2. THE AI_Inspection_Engine SHALL have integration tests for database operations
3. THE AI_Inspection_Engine SHALL have tests for ML model loading and prediction
4. THE Sensor SHALL have unit tests for URL interception and API communication logic
5. THE Management_Dashboard SHALL have component tests for all UI components
6. THE system SHALL have end-to-end tests covering the complete flow from URL navigation to dashboard display
7. THE ML_Model SHALL have tests verifying accuracy on a held-out test dataset
8. THE system SHALL have performance tests verifying API response time under load
9. THE system SHALL have security tests verifying input validation and authentication
10. THE system SHALL have accessibility tests verifying WCAG 2.1 Level AA compliance

### Requirement 16: Deployment and DevOps

**User Story:** As a DevOps engineer, I want automated deployment and monitoring, so that the system can be deployed reliably and maintained efficiently.

#### Acceptance Criteria

1. THE system SHALL provide Docker containers for the AI_Inspection_Engine
2. THE system SHALL provide a docker-compose.yml file for local development setup
3. THE system SHALL provide deployment scripts for production environments
4. THE system SHALL provide database migration scripts that run automatically on deployment
5. THE system SHALL provide health check endpoints for monitoring tools
6. THE system SHALL provide Prometheus metrics endpoints for observability
7. THE system SHALL document deployment procedures in DEPLOYMENT.md
8. THE system SHALL document development setup procedures in DEVELOPMENT.md
9. THE system SHALL provide CI/CD pipeline configuration for automated testing and deployment
10. THE system SHALL provide backup and restore procedures for the database

### Requirement 17: Documentation and User Guides

**User Story:** As a new user, I want comprehensive documentation, so that I can understand and use the system effectively.

#### Acceptance Criteria

1. THE system SHALL provide a README.md with project overview, features, and quick start guide
2. THE system SHALL provide API documentation with endpoint descriptions, parameters, and example requests
3. THE system SHALL provide architecture documentation describing system components and data flow
4. THE system SHALL provide user guide for the browser extension with installation and usage instructions
5. THE system SHALL provide administrator guide for the Management_Dashboard
6. THE system SHALL provide developer guide for contributing to the project
7. THE system SHALL provide troubleshooting guide for common issues
8. THE system SHALL provide model training guide for retraining ML models
9. THE system SHALL provide security guide describing security features and best practices
10. THE system SHALL keep all documentation up-to-date with code changes

### Requirement 18: Browser Extension Distribution

**User Story:** As an end user, I want to easily install the browser extension, so that I can start using the phishing protection immediately.

#### Acceptance Criteria

1. THE Sensor SHALL be packaged for distribution in the Chrome Web Store
2. THE Sensor SHALL include all required metadata (name, description, version, icons, permissions)
3. THE Sensor SHALL request only necessary permissions (webNavigation, storage, activeTab)
4. THE Sensor SHALL include privacy policy describing data collection and usage
5. THE Sensor SHALL include user-friendly installation instructions
6. THE Sensor SHALL support Chrome, Edge, and Brave browsers
7. THE Sensor SHALL include screenshots and promotional images for the store listing
8. THE Sensor SHALL implement automatic updates when new versions are released
9. THE Sensor SHALL provide uninstall feedback form to understand why users remove the extension
10. THE Sensor SHALL include a welcome page that displays after installation with setup instructions

### Requirement 19: Performance Optimization

**User Story:** As an end user, I want fast phishing detection, so that my browsing experience is not slowed down.

#### Acceptance Criteria

1. THE AI_Inspection_Engine SHALL respond to analysis requests within 100 milliseconds at 95th percentile
2. THE Sensor SHALL cache analysis results for 1 hour to avoid repeated API calls
3. THE Sensor SHALL implement request debouncing to avoid analyzing the same URL multiple times during navigation
4. THE AI_Inspection_Engine SHALL use connection pooling for database access
5. THE AI_Inspection_Engine SHALL load ML models into memory at startup to avoid loading delays
6. THE Management_Dashboard SHALL implement code splitting to reduce initial bundle size
7. THE Management_Dashboard SHALL implement lazy loading for charts and heavy components
8. THE Management_Dashboard SHALL use server-side rendering for initial page load
9. THE system SHALL implement CDN caching for static assets
10. THE system SHALL implement database query optimization with appropriate indexes

### Requirement 20: Data Privacy and Compliance

**User Story:** As a privacy-conscious user, I want my browsing data to be protected, so that my privacy is respected.

#### Acceptance Criteria

1. THE Sensor SHALL only send URLs to the AI_Inspection_Engine, not page content or user data
2. THE AI_Inspection_Engine SHALL not store full URLs in logs, only domain and path hash for privacy
3. THE AI_Inspection_Engine SHALL not collect or store PII without explicit user consent
4. THE system SHALL provide a privacy policy describing data collection, usage, and retention
5. THE system SHALL allow users to opt out of data collection for analytics
6. THE system SHALL implement data retention policies (delete scan logs older than 90 days)
7. THE system SHALL provide data export functionality for users to download their data
8. THE system SHALL provide data deletion functionality for users to delete their data
9. THE system SHALL encrypt sensitive data at rest in the database
10. THE system SHALL comply with GDPR requirements for users in the European Union

