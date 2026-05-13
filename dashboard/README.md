# NGIPS Phishing Shield - Dashboard

React-based management dashboard for the Next-Generation Intrusion Prevention System (NGIPS) Phishing Shield.

## Features

- **Dashboard Overview** - Real-time stats and visualizations
- **URL Analyzer** - Analyze URLs for phishing threats
- **Scan History** - View and manage past scan results
- **Settings** - Configure dashboard preferences
- **Dark Mode** - Support for light/dark themes
- **Responsive Design** - Works on desktop and mobile

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- Zustand (State Management)
- Recharts (Charts)
- Lucide Icons

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Navigate to dashboard directory
cd dashboard

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

### Configuration

Edit `.env` file:

```
VITE_API_BASE_URL=/api
```

Point to your FastAPI backend URL (default: `/api` for proxy, or `http://localhost:8000`)

## Project Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   └── layout/       # Layout components
├── pages/            # Page components
├── services/         # API services
├── store/            # Zustand stores
├── types/            # TypeScript types
└── utils/            # Utility functions
```

## API Integration

The dashboard communicates with the FastAPI backend via REST API:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Check API health status |
| `/v1/analyze` | POST | Analyze a URL |
| `/v1/scans` | GET | Get scan history |
| `/v1/feedback` | POST | Submit feedback |

## Pages

### Dashboard (`/`)
- System status card
- Statistics overview
- Daily scan charts
- Recent scans list

### Analyzer (`/analyzer`)
- URL input form
- Analysis results
- Model predictions
- Feature analysis

### History (`/history`)
- Searchable scan list
- Filter by result type
- Export to CSV
- Pagination

### Settings (`/settings`)
- Theme selection
- API configuration
- Auto-refresh settings
- Notifications

## License

MIT