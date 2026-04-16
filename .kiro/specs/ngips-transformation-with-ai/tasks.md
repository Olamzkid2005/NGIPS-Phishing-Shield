# Implementation Plan: NGIPS Transformation with AI

## Overview

This implementation plan transforms the existing Flask-based phishing detection application into a comprehensive Next-Generation Intrusion Prevention System (NGIPS) with three main components:

1. **AI_Inspection_Engine**: FastAPI backend with ML-based phishing detection
2. **Sensor**: Manifest V3 Chrome extension for real-time URL interception
3. **Management_Dashboard**: Next.js 15 dashboard for monitoring and analytics

The implementation follows a 7-phase approach over 10 weeks, building incrementally from backend foundation through deployment.

## Tasks

### Phase 1: Backend Foundation (Weeks 1-2)

- [x] 0. Archive existing Flask application
  - [x] 0.1 Create `legacy/` directory in project root
    - Move existing Flask app files to `legacy/` folder
    - Move `app.py`, `Code/app.py`, templates, static files
    - Keep `Dataset/` and model `.pkl` files in current location (will be used by new backend)
    - _Requirements: N/A (organizational task)_

  - [x] 0.2 Update documentation
    - Add note to README.md about legacy Flask app location
    - Document that Flask app is archived and no longer maintained
    - _Requirements: 17.1_

  - [x] 0.3 Commit archive changes
    - Git commit with message: "chore: archive Flask app to legacy/ folder"
    - _Requirements: N/A_

- [x] 1. Set up FastAPI project structure
  - Create `backend/` directory with proper Python package structure
  - Initialize `app/` module with `__init__.py`, `main.py`
  - Create subdirectories: `api/`, `ml/`, `core/`, `db/`, `threat_intel/`
  - Set up virtual environment and create `requirements.txt`
  - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.1 Create FastAPI application entry point
    - Write `app/main.py` with FastAPI app initialization
    - Configure CORS middleware for browser extension origin
    - Add startup event handlers for model loading
    - _Requirements: 1.1, 1.5_

  - [x] 1.2 Implement environment configuration
    - Create `app/core/config.py` with Pydantic Settings
    - Define environment variables: DATABASE_URL, CORS_ORIGINS, LOG_LEVEL, MODEL_PATHS
    - Add validation for required configuration
    - _Requirements: 1.9, 13.1, 13.2, 13.3_

  - [x] 1.3 Set up structured logging
    - Create `app/core/logging.py` with JSON formatter
    - Configure log levels and rotation
    - Implement request ID tracking
    - _Requirements: 1.8, 12.1, 12.2, 12.4_

- [ ] 2. Implement ML model loading and management
  - [ ] 2.1 Create model loader module
    - Write `app/ml/models.py` with model loading functions
    - Load existing Logistic Regression and Naive Bayes models from .pkl files
    - Implement model validation on startup
    - Add model versioning metadata
    - _Requirements: 1.2, 3.7, 3.9_

  - [ ] 2.2 Implement feature extraction pipeline
    - Create `app/ml/feature_extraction.py`
    - Extract URL features: length, domain length, path length, subdomain count
    - Extract character features: special chars, digits, entropy
    - Parse TLD and check for suspicious keywords
    - _Requirements: 4.3, 4.4, 4.10_

  - [ ]* 2.3 Write unit tests for feature extraction
    - Test with various URL patterns (short, long, international domains)
    - Test edge cases (empty, malformed URLs)
    - Verify feature values match expected ranges
    - _Requirements: 15.1, 15.7_

- [ ] 3. Implement ensemble prediction logic
  - [ ] 3.1 Create ensemble module
    - Write `app/ml/ensemble.py` with weighted voting logic
    - Combine predictions from multiple models
    - Calculate confidence score based on model agreement
    - Implement uncertainty quantification
    - _Requirements: 4.1, 4.2, 4.8_

  - [ ] 3.2 Create inference pipeline
    - Write `app/ml/inference.py` orchestrating feature extraction and prediction
    - Implement prediction caching for performance
    - Add timing instrumentation
    - _Requirements: 1.4, 4.1, 4.2_

  - [ ]* 3.3 Write unit tests for ensemble logic
    - Test with mock model predictions
    - Verify confidence calculation
    - Test edge cases (all models agree, all disagree)
    - _Requirements: 15.1, 15.3_

- [ ] 4. Implement API endpoints
  - [ ] 4.1 Create analyze endpoint
    - Write `app/api/v1/analyze.py` with POST `/v1/analyze` endpoint
    - Define Pydantic request/response models
    - Implement input validation (URL format, length limits)
    - Add request logging
    - _Requirements: 1.3, 1.4, 1.10_

  - [ ] 4.2 Implement health check endpoint
    - Create GET `/health` endpoint
    - Check database connectivity, model status
    - Return component health status
    - _Requirements: 1.6, 16.5_

  - [ ] 4.3 Implement metrics endpoint
    - Create GET `/metrics` endpoint
    - Return performance statistics (uptime, request count, response times)
    - _Requirements: 1.7, 14.1, 14.2, 14.4_

  - [ ]* 4.4 Write API endpoint tests
    - Test `/v1/analyze` with valid and invalid inputs
    - Test error responses (400, 429, 500, 503)
    - Verify response schema matches specification
    - _Requirements: 15.1, 15.2_

- [ ] 5. Implement rate limiting and security
  - [ ] 5.1 Add rate limiting middleware
    - Implement rate limiter (100 req/min per IP)
    - Return 429 with retry-after header when exceeded
    - _Requirements: 11.1, 11.2, 11.9_

  - [ ] 5.2 Add input validation and sanitization
    - Validate URL format and length
    - Sanitize URLs to prevent injection
    - _Requirements: 11.3, 11.4_

  - [ ] 5.3 Add security headers
    - Implement middleware for security headers
    - Add X-Content-Type-Options, X-Frame-Options, HSTS
    - _Requirements: 11.8_

- [ ] 6. Checkpoint - Ensure backend tests pass
  - Run all unit tests and verify 80%+ coverage
  - Test API endpoints manually with curl/Postman
  - Verify models load correctly on startup
  - Ask user if questions arise

### Phase 2: Database Layer (Week 3)

- [ ] 7. Set up Prisma with SQLite
  - [ ] 7.1 Initialize Prisma
    - Install Prisma CLI and client
    - Run `prisma init` to create schema file
    - Configure SQLite datasource
    - _Requirements: 2.1_

  - [ ] 7.2 Define database schema
    - Create Prisma schema with Scan, Feedback, Config, Threat, ModelMetric models
    - Add indexes on frequently queried fields
    - Define relationships between models
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.8_

  - [ ] 7.3 Create initial migration
    - Run `prisma migrate dev` to create migration
    - Verify migration creates all tables and indexes
    - _Requirements: 2.6_

  - [ ] 7.4 Create database seeding script
    - Write `prisma/seed.ts` with sample data
    - Seed configuration defaults
    - Seed sample scans and feedback
    - _Requirements: 2.9_

- [ ] 8. Integrate database into FastAPI
  - [ ] 8.1 Create Prisma client wrapper
    - Write `app/db/client.py` with Prisma client initialization
    - Implement connection lifecycle management
    - Add connection pooling configuration
    - _Requirements: 2.1, 2.7_

  - [ ] 8.2 Update analyze endpoint to log scans
    - Modify `/v1/analyze` to save scan results to database
    - Extract domain from URL for indexing
    - Store features as JSON
    - _Requirements: 1.8, 2.2_

  - [ ] 8.3 Implement feedback endpoint
    - Create POST `/v1/feedback` endpoint
    - Validate scanId exists
    - Store feedback with timestamp
    - _Requirements: 2.3, 10.1_

  - [ ]* 8.4 Write database integration tests
    - Test scan creation and retrieval
    - Test feedback submission
    - Test configuration updates
    - Verify transactions work correctly
    - _Requirements: 15.2, 2.7_

- [ ] 9. Implement database backup mechanism
  - Create backup script that copies SQLite file
  - Schedule daily backups
  - Document backup/restore procedures
  - _Requirements: 2.10, 16.10_

- [ ] 10. Checkpoint - Ensure database integration works
  - Run integration tests and verify they pass
  - Manually test scan logging and feedback submission
  - Verify database indexes improve query performance
  - Ask user if questions arise

### Phase 3: Browser Extension (Weeks 4-5)

- [ ] 11. Initialize Chrome extension project
  - [ ] 11.1 Create extension directory structure
    - Create `extension/` directory
    - Create subdirectories: `background/`, `content/`, `popup/`, `utils/`, `icons/`
    - _Requirements: 5.1_

  - [ ] 11.2 Create Manifest V3 configuration
    - Write `manifest.json` with Manifest V3 format
    - Define permissions: webNavigation, storage, activeTab
    - Configure service worker and content scripts
    - Add extension icons and metadata
    - _Requirements: 5.1, 18.2, 18.3_

- [ ] 12. Implement service worker for URL interception
  - [ ] 12.1 Create service worker
    - Write `background/service-worker.js`
    - Listen to chrome.webNavigation.onBeforeNavigate events
    - Implement URL filtering (skip chrome://, about:, etc.)
    - _Requirements: 5.2, 5.3_

  - [ ] 12.2 Implement local caching
    - Create cache management in service worker
    - Store analysis results with 1-hour TTL
    - Implement cache lookup before API calls
    - _Requirements: 5.6, 19.2_

  - [ ] 12.3 Implement whitelist management
    - Store whitelist in chrome.storage.local
    - Check whitelist before analysis
    - Provide add/remove whitelist functions
    - _Requirements: 5.8, 5.12_

  - [ ]* 12.4 Write unit tests for service worker logic
    - Test URL filtering logic
    - Test cache hit/miss scenarios
    - Test whitelist lookup
    - _Requirements: 15.4_

- [ ] 13. Implement API client
  - [ ] 13.1 Create API client module
    - Write `utils/api.js` with fetch wrapper
    - Implement 5-second timeout
    - Add retry logic with exponential backoff (max 3 retries)
    - _Requirements: 5.3, 5.10_

  - [ ] 13.2 Implement error handling
    - Handle network errors gracefully
    - Implement fail-safe behavior (allow navigation on error)
    - Log errors to console
    - _Requirements: 5.10, 5.11_

  - [ ]* 13.3 Write unit tests for API client
    - Test timeout behavior
    - Test retry logic
    - Test error handling
    - _Requirements: 15.4_

- [ ] 14. Implement content script and warning overlay
  - [ ] 14.1 Create content script
    - Write `content/content-script.js`
    - Listen for messages from service worker
    - Inject warning overlay when URL blocked
    - _Requirements: 5.4_

  - [ ] 14.2 Design warning overlay UI
    - Create `content/overlay.html` and `content/overlay.css`
    - Display threat level, confidence, and reasons
    - Add "Go Back", "Report False Positive", "Proceed Anyway" buttons
    - Ensure WCAG 2.1 Level AA compliance
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.8, 6.9_

  - [ ] 14.3 Implement user actions
    - Handle "Go Back" button (navigate to previous page)
    - Handle "Report False Positive" (send feedback to backend)
    - Handle "Proceed Anyway" (log action and allow navigation)
    - _Requirements: 6.4, 6.5, 6.6, 6.7_

- [ ] 15. Implement popup interface
  - [ ] 15.1 Create popup HTML and CSS
    - Write `popup/popup.html` with statistics display
    - Style with modern, responsive CSS
    - Add dark mode support
    - _Requirements: 5.7_

  - [ ] 15.2 Implement popup logic
    - Write `popup/popup.js` to fetch and display stats
    - Show recent scan count, blocked count, last scan time
    - Display whitelist with add/remove functionality
    - Add enable/disable toggle for extension
    - _Requirements: 5.7, 5.8, 5.12_

- [ ] 16. Test extension across browsers
  - Test on Chrome (primary target)
  - Test on Edge (Chromium-based)
  - Test on Brave (Chromium-based)
  - Document any browser-specific issues
  - _Requirements: 18.6_

- [ ] 17. Checkpoint - Ensure extension works end-to-end
  - Load unpacked extension in Chrome
  - Navigate to test phishing URL and verify blocking
  - Test whitelist functionality
  - Test offline behavior (backend unavailable)
  - Ask user if questions arise

### Phase 4: Next.js Dashboard (Weeks 6-7)

- [ ] 18. Initialize Next.js 15 project
  - [ ] 18.1 Create Next.js project
    - Run `npx create-next-app@latest dashboard --app --typescript --tailwind`
    - Configure App Router structure
    - Set up Tailwind CSS
    - _Requirements: 7.1_

  - [ ] 18.2 Set up Prisma client for dashboard
    - Install Prisma client in dashboard project
    - Create `lib/prisma.ts` with client initialization
    - Configure DATABASE_URL environment variable
    - _Requirements: 7.2_

  - [ ] 18.3 Create layout and navigation
    - Create `app/layout.tsx` with navigation sidebar
    - Add navigation links: Dashboard, Scans, Analytics, Feedback, Settings
    - Implement responsive mobile menu
    - _Requirements: 7.3, 7.11_

- [ ] 19. Implement dashboard home page
  - [ ] 19.1 Create dashboard page
    - Write `app/page.tsx` with real-time scan monitoring
    - Fetch recent scans using Server Components
    - Display summary statistics (total scans, blocked count, block rate)
    - _Requirements: 7.3, 8.1, 8.7_

  - [ ] 19.2 Implement real-time updates
    - Add client component with polling (every 5 seconds)
    - Update scan list automatically
    - Highlight new scans
    - _Requirements: 7.8, 8.2_

  - [ ] 19.3 Display system status
    - Show API health status
    - Show database status
    - Show current model version
    - _Requirements: 8.6_

- [ ] 20. Implement scan history page
  - [ ] 20.1 Create scans page
    - Write `app/scans/page.tsx` with scan table
    - Implement server-side pagination (50 records per page)
    - Display columns: timestamp, URL, result, confidence, threat level
    - _Requirements: 8.1, 8.10_

  - [ ] 20.2 Add filtering and search
    - Implement filters: result, date range, confidence threshold, threat level
    - Add search input for URL/domain
    - Update URL query params for shareable filters
    - _Requirements: 8.3, 8.4_

  - [ ] 20.3 Implement scan details modal
    - Show full scan details when row clicked
    - Display feature extraction results
    - Show model predictions breakdown
    - _Requirements: 8.5_

  - [ ] 20.4 Add CSV export
    - Implement export button
    - Generate CSV from filtered scan data
    - Download file to user's computer
    - _Requirements: 8.9_

- [ ] 21. Implement analytics page
  - [ ] 21.1 Create analytics page
    - Write `app/analytics/page.tsx`
    - Set up Recharts or Chart.js
    - _Requirements: 7.4, 9.1_

  - [ ] 21.2 Implement scan volume chart
    - Create line chart showing scans over time
    - Support hourly, daily, weekly views
    - Allow date range selection
    - _Requirements: 9.1, 9.7_

  - [ ] 21.3 Implement block rate chart
    - Create pie chart showing blocked vs allowed distribution
    - Display percentages
    - _Requirements: 9.2, 9.8_

  - [ ] 21.4 Implement top blocked domains chart
    - Create bar chart showing most blocked domains
    - Display domain names and counts
    - _Requirements: 9.3_

  - [ ] 21.5 Implement model performance metrics
    - Display accuracy, precision, recall, F1 score over time
    - Show false positive rate gauge
    - Show average confidence
    - _Requirements: 9.4, 9.5, 9.9_

  - [ ] 21.6 Implement activity heatmap
    - Create heatmap showing scans by hour and day of week
    - Use color intensity for scan volume
    - _Requirements: 9.6_

- [ ] 22. Implement feedback management page
  - [ ] 22.1 Create feedback page
    - Write `app/feedback/page.tsx` with feedback table
    - Display: URL, report date, user comment, status
    - Implement pagination
    - _Requirements: 10.1, 10.2_

  - [ ] 22.2 Implement feedback review actions
    - Add status dropdown: Confirmed False Positive, Correctly Blocked, Under Review
    - Add admin comment field
    - Update feedback status via API
    - _Requirements: 10.2, 10.6_

  - [ ] 22.3 Implement whitelist integration
    - When marking as "Confirmed False Positive", add URL to whitelist
    - Display confirmation dialog
    - _Requirements: 10.3_

  - [ ] 22.4 Display feedback statistics
    - Show total reports, confirmed false positives, accuracy improvement
    - _Requirements: 10.4_

  - [ ] 22.5 Add bulk actions
    - Implement checkbox selection
    - Add bulk status update
    - _Requirements: 10.9_

- [ ] 23. Implement settings page
  - [ ] 23.1 Create settings page
    - Write `app/settings/page.tsx` with configuration form
    - Display current configuration values
    - _Requirements: 7.5, 13.6_

  - [ ] 23.2 Implement configuration updates
    - Add form inputs for: confidence threshold, rate limit, cache settings, threat intel toggle
    - Validate input values
    - Submit updates to backend API
    - _Requirements: 13.6, 13.7_

  - [ ] 23.3 Display model information
    - Show current model version
    - Show model performance metrics
    - _Requirements: 13.6_

- [ ] 24. Implement dark mode
  - Add dark mode toggle in layout
  - Respect system preference
  - Store user preference in localStorage
  - Update Tailwind config for dark mode
  - _Requirements: 7.9_

- [ ] 25. Ensure accessibility compliance
  - Run Lighthouse accessibility audit (target ≥90)
  - Fix any WCAG 2.1 Level AA violations
  - Test keyboard navigation
  - Test with screen reader
  - _Requirements: 7.10, 15.9_

- [ ] 26. Checkpoint - Ensure dashboard works end-to-end
  - Test all pages and features
  - Verify real-time updates work
  - Test filtering, search, and export
  - Verify charts render correctly
  - Ask user if questions arise

### Phase 5: Advanced Features (Week 8)

- [ ] 27. Integrate threat intelligence
  - [ ] 27.1 Implement PhishTank integration
    - Create `app/threat_intel/phishtank.py`
    - Fetch PhishTank API data
    - Parse and store in Threat table
    - _Requirements: 4.6_

  - [ ] 27.2 Implement OpenPhish integration
    - Create `app/threat_intel/openphish.py`
    - Fetch OpenPhish feed
    - Parse and store in Threat table
    - _Requirements: 4.6_

  - [ ] 27.3 Implement threat database caching
    - Cache threat data locally
    - Update periodically (daily)
    - Implement stale data cleanup (>90 days)
    - _Requirements: 4.6_

  - [ ] 27.4 Integrate threat check into analysis
    - Check URL against threat database before ML prediction
    - Return block action immediately if found
    - Log threat source in scan record
    - _Requirements: 4.7_

- [ ] 28. Implement advanced ML features
  - [ ] 28.1 Add domain reputation scoring
    - Implement domain age check (if available)
    - Add reputation score to feature set
    - _Requirements: 4.4_

  - [ ] 28.2 Add SSL certificate validation
    - Check SSL certificate validity for HTTPS URLs
    - Add certificate info to features
    - _Requirements: 4.5_

  - [ ] 28.3 Implement model versioning
    - Add version metadata to model files
    - Support loading multiple model versions
    - Allow version comparison in dashboard
    - _Requirements: 4.9_

- [ ] 29. Implement model performance monitoring
  - [ ] 29.1 Create metrics collection
    - Aggregate daily metrics from scans and feedback
    - Calculate accuracy, precision, recall, F1 score
    - Store in ModelMetric table
    - _Requirements: 14.1, 14.2, 14.3, 14.5_

  - [ ] 29.2 Implement performance alerts
    - Check false positive rate threshold (>5%)
    - Check average confidence threshold (<0.7)
    - Send alerts when thresholds exceeded
    - _Requirements: 14.6, 14.7_

  - [ ] 29.3 Add performance dashboard
    - Display model metrics in analytics page
    - Show alerts and warnings
    - _Requirements: 14.8, 14.9_

- [ ] 30. Checkpoint - Ensure advanced features work
  - Test threat intelligence integration
  - Verify threat database updates
  - Test model performance monitoring
  - Verify alerts trigger correctly
  - Ask user if questions arise

### Phase 6: Integration & Testing (Week 9)

- [ ] 31. Set up Docker Compose for local development
  - [ ] 31.1 Create Dockerfiles
    - Write `backend/Dockerfile` for FastAPI
    - Write `dashboard/Dockerfile` for Next.js
    - _Requirements: 16.1_

  - [ ] 31.2 Create docker-compose.yml
    - Define services: backend, dashboard
    - Configure volumes for database and models
    - Set environment variables
    - _Requirements: 16.2_

  - [ ] 31.3 Test Docker setup
    - Run `docker-compose up`
    - Verify all services start correctly
    - Test inter-service communication
    - _Requirements: 16.2_

- [ ] 32. Write end-to-end tests
  - [ ] 32.1 Set up Playwright
    - Install Playwright
    - Configure test environment
    - _Requirements: 15.6_

  - [ ] 32.2 Write phishing detection flow test
    - Test: Navigate to malicious URL → Extension blocks → Warning displayed → Go back
    - _Requirements: 15.6_

  - [ ] 32.3 Write false positive reporting flow test
    - Test: Block legitimate site → Report false positive → Admin reviews → Whitelist added
    - _Requirements: 15.6_

  - [ ] 32.4 Write dashboard monitoring flow test
    - Test: Open dashboard → View scans → Filter → Export CSV → View analytics
    - _Requirements: 15.6_

- [ ] 33. Perform load testing
  - [ ] 33.1 Set up Locust or k6
    - Install load testing tool
    - Write test scenarios
    - _Requirements: 15.8_

  - [ ] 33.2 Run load tests
    - Simulate 100 concurrent users
    - Measure response times (p50, p95, p99)
    - Verify 0% error rate under normal load
    - Test rate limiting (verify 429 responses)
    - _Requirements: 15.8, 19.1_

  - [ ] 33.3 Identify and fix bottlenecks
    - Profile slow endpoints
    - Optimize database queries
    - Add caching where needed
    - _Requirements: 19.4, 19.5_

- [ ] 34. Run security scans
  - [ ] 34.1 Run OWASP ZAP scan
    - Scan backend API
    - Review findings
    - Fix critical and high severity issues
    - _Requirements: 15.9_

  - [ ] 34.2 Review security checklist
    - Verify no hardcoded secrets
    - Verify input validation
    - Verify error handling doesn't leak info
    - Verify rate limiting works
    - _Requirements: 11.1-11.10_

- [ ] 35. Conduct accessibility testing
  - Run Lighthouse audit on all dashboard pages
  - Run axe DevTools
  - Test keyboard navigation
  - Test with screen reader (NVDA or VoiceOver)
  - Fix any violations
  - _Requirements: 15.9, 7.10_

- [ ] 36. Perform cross-browser testing
  - Test extension on Chrome, Edge, Brave
  - Test dashboard on Chrome, Firefox, Safari, Edge
  - Fix any browser-specific issues
  - _Requirements: 18.6_

- [ ] 37. Optimize performance
  - [ ] 37.1 Optimize backend
    - Add database query indexes
    - Implement response caching
    - Optimize ML inference
    - _Requirements: 19.1, 19.4, 19.5_

  - [ ] 37.2 Optimize dashboard
    - Implement code splitting
    - Add lazy loading for charts
    - Optimize images
    - _Requirements: 19.6, 19.7_

  - [ ] 37.3 Optimize extension
    - Implement aggressive caching
    - Optimize API calls
    - Measure overhead (<50ms target)
    - _Requirements: 19.2, 19.3_

- [ ] 38. Checkpoint - Ensure all tests pass
  - Run all unit tests (backend, frontend, extension)
  - Run all integration tests
  - Run all E2E tests
  - Verify performance targets met
  - Verify security scans pass
  - Ask user if questions arise

### Phase 7: Deployment & Documentation (Week 10)

- [ ] 39. Set up CI/CD pipeline
  - [ ] 39.1 Create GitHub Actions workflow
    - Write `.github/workflows/ci.yml`
    - Run linters (flake8, eslint, prettier)
    - Run unit tests
    - Run integration tests
    - _Requirements: 16.9_

  - [ ] 39.2 Add security scanning to CI
    - Run pip-audit for Python dependencies
    - Run npm audit for JavaScript dependencies
    - Fail build on critical vulnerabilities
    - _Requirements: 16.9_

  - [ ] 39.3 Add E2E tests to CI
    - Build Docker images
    - Run E2E tests against containers
    - Generate coverage reports
    - _Requirements: 16.9_

- [ ] 40. Create production Docker images
  - Optimize Dockerfiles for production
  - Use multi-stage builds
  - Minimize image size
  - _Requirements: 16.2_

- [ ] 41. Write deployment documentation
  - [ ] 41.1 Write DEPLOYMENT.md
    - Document production deployment steps
    - Document environment variables
    - Document database setup
    - Document SSL certificate setup
    - _Requirements: 16.3, 16.7_

  - [ ] 41.2 Write DEVELOPMENT.md
    - Document local development setup
    - Document how to run tests
    - Document how to build extension
    - _Requirements: 16.8_

  - [ ] 41.3 Write API.md
    - Document all API endpoints
    - Include request/response examples
    - Document error codes
    - _Requirements: 17.2_

  - [ ] 41.4 Write ARCHITECTURE.md
    - Document system architecture
    - Document component interactions
    - Document data flow
    - _Requirements: 17.3_

- [ ] 42. Write user documentation
  - [ ] 42.1 Update README.md
    - Write project overview
    - List features
    - Add quick start guide
    - _Requirements: 17.1_

  - [ ] 42.2 Write extension user guide
    - Document installation steps
    - Document how to use extension
    - Document whitelist management
    - Document how to report false positives
    - _Requirements: 17.4, 18.5_

  - [ ] 42.3 Write dashboard administrator guide
    - Document dashboard features
    - Document how to review feedback
    - Document how to configure settings
    - Document how to export data
    - _Requirements: 17.5_

  - [ ] 42.4 Write troubleshooting guide
    - Document common issues and solutions
    - Document how to check logs
    - Document how to report bugs
    - _Requirements: 17.7_

  - [ ] 42.5 Write security guide
    - Document security features
    - Document best practices
    - Document how to rotate API keys
    - _Requirements: 17.9_

  - [ ] 42.6 Write privacy policy
    - Document data collection practices
    - Document data retention policies
    - Document user rights (GDPR compliance)
    - _Requirements: 20.4, 20.5_

- [ ] 43. Prepare browser extension for Chrome Web Store
  - [ ] 43.1 Create store listing assets
    - Create promotional images (1400x560, 920x680)
    - Create screenshots (1280x800 or 640x400)
    - Write store description
    - _Requirements: 18.1, 18.7_

  - [ ] 43.2 Package extension
    - Create production build
    - Generate .zip file
    - Test packaged extension
    - _Requirements: 18.1_

  - [ ] 43.3 Create Chrome Web Store listing (draft)
    - Fill in metadata
    - Upload assets
    - Set pricing (free)
    - Save as draft (don't publish yet)
    - _Requirements: 18.1, 18.7_

- [ ] 44. Final checkpoint - Production readiness
  - Review all documentation
  - Verify CI/CD pipeline works
  - Test production Docker images
  - Verify all quality gates pass
  - Get user approval for deployment

## Notes

- Tasks marked with `*` are optional testing tasks that can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and provide opportunities for user feedback
- The implementation follows a bottom-up approach: backend → database → extension → dashboard → advanced features → testing → deployment
- All components can be developed and tested independently before integration
- The 7-phase structure allows for parallel work on different components after Phase 2

## Success Criteria

- All non-optional tasks completed
- All tests passing (unit, integration, E2E)
- Performance targets met (API <100ms, extension <50ms overhead)
- Security scans pass with no critical vulnerabilities
- Accessibility compliance verified (WCAG 2.1 Level AA)
- Documentation complete and reviewed
- User approval obtained for production deployment