<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Certification PrepCamp

A comprehensive certification preparation platform for Databricks certifications. This application provides a simulated exam environment with detailed performance analytics and review capabilities.

## Features

- **User Authentication**: Corporate email verification with OTP (One-Time Password) system
- **Exam Taking**: Interactive multiple-choice question interface with progress tracking
- **Performance Analytics**: Detailed results with:
  - Overall score percentage
  - Category-wise performance breakdown
  - Visual charts and graphs
  - Question-by-question review with explanations
- **Session Persistence**: Exam progress is saved locally and can be resumed
- **Admin Panel**: Domain whitelist management for access control
- **Responsive Design**: Mobile-friendly interface with adaptive navigation

## Tech Stack

- **Frontend**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Routing**: React Router DOM
- **Deployment**: GitHub Pages

## Prerequisites

- Node.js (v20 or higher recommended)
- npm or yarn package manager

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd CertificationBootcamp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```
   
   For production, the `VITE_API_URL` should point to your backend API endpoint.

## Running Locally

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Building for Production

1. Build the application:
   ```bash
   npm run build
   ```

2. Preview the production build:
   ```bash
   npm run preview
   ```

The built files will be in the `dist` directory.

## Deployment

The application is automatically deployed to GitHub Pages via GitHub Actions when changes are pushed to the `main` branch. The deployment workflow:

1. Builds the application with the configured `VITE_API_URL` from GitHub secrets
2. Uploads the build artifacts
3. Deploys to GitHub Pages

Ensure that `VITE_API_URL` is set in your GitHub repository secrets for production deployments.

## Application Structure

### Main Routes

- `/` - Home page with registration/login form
- `/exam` - Exam taking interface
- `/results` - Results and performance review
- `/faq` - Frequently asked questions
- `/contact` - Contact information
- `/admin` - Admin panel for domain management

### Key Components

- `App.tsx` - Main application component with routing and state management
- `Admin.tsx` - Admin panel for managing email domain whitelist
- `QuestionView.tsx` - Individual question display component
- `ResultsChart.tsx` - Overall performance visualization
- `CategoryChart.tsx` - Category-wise performance breakdown
- `dbService.ts` - API service layer for backend communication

## Admin Page

The admin page (`/admin`) provides functionality to manage email domain whitelisting for the application.

### Access Requirements

- Only users with `@databricks.com` email addresses can access the admin panel
- Two-factor authentication is required:
  1. OTP (One-Time Password) is sent to the Databricks email
  2. The OTP must be validated before accessing admin functions

### How It Works

1. **Authentication Flow**:
   - Enter your `@databricks.com` email address
   - Click "Enviar Código de Verificação" (Send Verification Code)
   - A 6-digit OTP code will be sent to your email
   - Enter the OTP code and click "Validar Código" (Validate Code)
   - Once validated, you'll see a confirmation message

2. **Adding Domains**:
   After successful authentication, you can add new email domains to the whitelist:
   - **Domain**: Enter the domain name (e.g., `example.com` - without the `@` symbol)
   - **Company Name**: Enter the company name associated with the domain
   - Click "Adicionar Domínio" (Add Domain) to submit

3. **Domain Validation**:
   - The system validates the domain format before submission
   - Domains must follow standard domain name format rules
   - Once added, users with emails from that domain can register and access the application

### Use Cases

- Adding new corporate domains for partner companies
- Granting access to specific organizations
- Managing the list of allowed email domains for registration

### Security Features

- Email-based authentication restricted to Databricks employees
- OTP verification prevents unauthorized access
- Domain format validation ensures data integrity
- All admin actions are logged through the backend API

## User Flow

1. **Registration**:
   - User enters first name, last name, corporate email, and selects an exam
   - System validates email domain against whitelist
   - OTP is sent to the email address
   - User validates OTP to complete registration

2. **Exam Taking**:
   - User selects an exam from available options
   - Questions are displayed one at a time
   - Progress is automatically saved to localStorage
   - User can navigate between questions
   - Exam can be completed at any time

3. **Results**:
   - After completion, results are displayed with:
     - Overall score percentage
     - Correct/incorrect answer breakdown
     - Category-wise performance
     - Detailed review of each question with explanations
   - Results are saved and can be viewed again later

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `VITE_API_URL` | Backend API base URL | Yes | `http://localhost:3001/api` |

## Development

### Project Structure

```
CertificationBootcamp/
├── components/          # React components
│   ├── Admin.tsx        # Admin panel
│   ├── Button.tsx       # Reusable button component
│   ├── Card.tsx         # Card container component
│   ├── CategoryChart.tsx # Category performance chart
│   ├── QuestionView.tsx # Question display component
│   └── ResultsChart.tsx # Overall results chart
├── services/            # Service layer
│   └── dbService.ts     # API communication service
├── public/              # Static assets
├── App.tsx              # Main application component
├── index.tsx            # Application entry point
├── types.ts             # TypeScript type definitions
└── vite.config.ts       # Vite configuration
```

## License

This project is proprietary and confidential.

## Support

For questions, feedback, or support, please contact the development team through the contact page in the application or via the email provided in the contact section.
