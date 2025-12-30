[README.md](https://github.com/user-attachments/files/23426390/README.md)
# Shree Thaleshwor Mahadev Yuwa Samuh

## Mini Microfinance Management System

A full-stack web application for managing microfinance operations including members, savings, loans, and payments. The application uses GitHub as the data storage backend via GitHub REST API.

## Features

- **Dashboard**: Overview with summary cards, monthly trends (line chart), and loan distribution (pie chart)
- **Member Management**: Add, edit, delete, and view member information
- **Saving Management**: Track member savings with transaction history
- **Loan Management**: Manage loans with interest calculation and outstanding balance tracking
- **Payment Management**: Record loan payments with principal and interest breakdown
- **Settings**:
  - User management with role-based access (Admin/Viewer)
  - Bulk saving import (CSV/JSON)
  - Backup and restore functionality
- **Authentication**: JWT-based authentication with role-based access control
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Authentication**: JWT (jsonwebtoken), bcryptjs
- **Data Storage**: GitHub REST API (JSON files in repository)
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ and npm
- GitHub account
- GitHub Personal Access Token (PAT) with `repo` permissions

## Getting Started

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd "Shree Thaleshwor MAhadev Yuwa Samuh"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up GitHub Personal Access Token

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name (e.g., "Microfinance App Token")
4. Select the `repo` scope (full control of private repositories)
5. Click "Generate token"
6. **Copy the token immediately** (you won't be able to see it again)

### 4. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# GitHub Configuration
GITHUB_OWNER=your-github-username
GITHUB_REPO=shree-thaleshwor-mahadev-yuwa-samuh
GITHUB_TOKEN=your-github-personal-access-token

# JWT Secret (generate a random string for production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# WhatsApp Notifications (Optional)
SENDWO_API_KEY=your_sendwo_api_key
SENDWO_BASE_URL=https://api.sendwo.com
SENDWO_WHATSAPP_NUMBER=your_sendwo_whatsapp_number
```

**Important**: Never commit `.env.local` to the repository. It's already in `.gitignore`.

### 5. Set Up WhatsApp Notifications (Optional)

The application supports automatic WhatsApp notifications for all transactions. To enable this feature:

#### Get SendWo WhatsApp Credentials

1. **Sign up for SendWo**: Go to [sendwo.com](https://sendwo.com/) and create an account
2. **Set up WhatsApp Business API**: Follow SendWo's setup process to connect your WhatsApp Business account
3. **Get your credentials**:
   - **API Key**: Provided by SendWo after account setup
   - **Base URL**: Usually `https://api.sendwo.com` (confirm with SendWo)
   - **WhatsApp Number**: Your verified WhatsApp Business number

#### Configure WhatsApp in Environment Variables

Add these to your `.env.local` file:

```env
SENDWO_API_KEY=your_sendwo_api_key
SENDWO_BASE_URL=https://api.sendwo.com
SENDWO_WHATSAPP_NUMBER=+977xxxxxxxxxx  # Your SendWo WhatsApp number
```

#### Supported Notifications

The system automatically sends WhatsApp messages for:

- ✅ **New Loan Approvals**: Sent to the member when a loan is approved
- ✅ **Payment Receipts**: Sent when loan payments are recorded
- ✅ **Savings Deposits**: Sent when savings are added to a member's account
- ✅ **Fine Applications**: Sent when fines are applied to members
- ✅ **Group Expenditures**: Sent to all active members when expenditures are recorded

#### Message Format

All messages are sent in Nepali/English format with:
- Group branding (श्री थलेस्वर महादेव युवा समूह)
- Professional formatting with emojis
- Complete transaction details
- Local currency formatting (रू)

#### Phone Number Format

The system automatically formats phone numbers:
- Handles various Nepali number formats (9812092516 → +9779812092516)
- Supports international format (+977xxxxxxxxxx)
- Defaults to Nepal (+977) for numbers without country code

### 5. Generate Admin Password Hash

The default admin user needs a password hash. Run:

```bash
node scripts/generate-password-hash.js admin123
```

Copy the generated hash and update `data/settings.json`:

```json
{
  "users": [
    {
      "userId": "admin",
      "name": "Administrator",
      "password": "<paste-generated-hash-here>",
      "role": "Admin"
    }
  ]
}
```

### 6. Push Initial Data Files to GitHub

Before running the app, you need to push the initial data files to your GitHub repository:

```bash
git add data/
git commit -m "Initial data files"
git push origin main
```

### 7. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 8. Login

- **User ID**: `admin`
- **Password**: `admin123` (or the password you hashed)

## Deployment

### Deploy to Vercel (Recommended)

1. Push your code to GitHub
2. Go to [Vercel](https://vercel.com) and import your repository
3. Add environment variables in Vercel dashboard:
   - `GITHUB_OWNER`
   - `GITHUB_REPO`
   - `GITHUB_TOKEN`
   - `JWT_SECRET`
4. Deploy

### Deploy to Other Platforms

For other platforms (Netlify, Railway, etc.), follow similar steps:
1. Push code to GitHub
2. Connect repository to the platform
3. Set environment variables
4. Deploy

**Note**: The GitHub token must be stored securely in environment variables/secrets and never exposed to the frontend.

## Project Structure

```
├── src/
│   ├── components/          # React components
│   │   ├── Layout.tsx       # Main layout with sidebar
│   │   └── ProtectedRoute.tsx
│   ├── hooks/               # Custom React hooks
│   │   └── useAuth.tsx      # Authentication hook
│   ├── lib/                 # Utility functions
│   │   ├── api.ts           # Frontend API client
│   │   ├── auth.ts          # Authentication utilities
│   │   ├── github.ts       # GitHub API utilities
│   │   ├── utils.ts         # General utilities
│   │   └── whatsapp.ts      # WhatsApp notification service
│   ├── pages/               # Next.js pages
│   │   ├── api/             # API routes (backend)
│   │   │   ├── auth/        # Authentication endpoints
│   │   │   └── github/      # GitHub proxy endpoints
│   │   ├── index.tsx        # Dashboard
│   │   ├── login.tsx        # Login page
│   │   ├── members.tsx      # Members page
│   │   ├── savings.tsx      # Savings page
│   │   ├── loans.tsx        # Loans page
│   │   ├── payments.tsx     # Payments page
│   │   └── settings.tsx     # Settings page
│   ├── styles/              # Global styles
│   └── types/                # TypeScript types
├── data/                     # JSON data files (stored in GitHub)
│   ├── members.json
│   ├── savings.json
│   ├── loans.json
│   ├── payments.json
│   └── settings.json
├── backups/                  # Backup files (created automatically)
└── scripts/                  # Utility scripts
```

## Usage Guide

### Adding a Member

1. Navigate to **Members** page
2. Click **Add Member**
3. Fill in the form (Name and Phone are required)
4. Click **Add Member**

### Adding a Saving

1. Navigate to **Saving** page
2. Click **Add Saving**
3. Select a member, enter amount and date
4. Click **Add Saving**

### Adding a Loan

1. Navigate to **Loan** page
2. Click **Add Loan**
3. Fill in loan details:
   - Select member
   - Enter principal amount
   - Enter interest rate (% per year)
   - Select start date
   - Enter term (months)
   - (Optional) Enter purpose
4. Click **Add Loan**

### Recording a Payment

1. Navigate to **Payment** page
2. Click **Add Payment**
3. Select a loan
4. The monthly interest will be auto-calculated
5. Enter principal and interest amounts
6. Click **Add Payment**

### Bulk Saving Import

1. Navigate to **Settings** → **Bulk Saving tab**
2. Prepare your data in CSV or JSON format:

**CSV Format:**
```csv
MemberId,Amount,Date
M-0001,1000,2024-01-15
M-0002,2000,2024-01-15
```

**JSON Format:**
```json
[
  {"memberId": "M-0001", "amount": 1000, "date": "2024-01-15"},
  {"memberId": "M-0002", "amount": 2000, "date": "2024-01-15"}
]
```

3. Paste the data into the textarea
4. Select the month
5. Click **Import Savings**

### Backup and Restore

**Create Backup:**
1. Navigate to **Settings** → **Backup/Restore**
2. Click **Create Backup Now**
3. A backup file will be created in `backups/` directory

**Restore from Backup:**
1. Navigate to **Settings** → **Backup/Restore**
2. Find the backup you want to restore
3. Click **Restore**
4. Confirm the action (this will overwrite all current data)

## Role-Based Access

- **Admin**: Can create, edit, and delete all resources. Can access settings, create backups, and restore data.
- **Viewer**: Can only view data. Cannot modify anything.

## Demo Script

To verify the application works correctly:

1. **Login** as admin (admin/admin123)
2. **Add a Member**: Go to Members → Add Member → Fill form → Save
3. **Add a Saving**: Go to Savings → Add Saving → Select member → Enter amount → Save
4. **Add a Loan**: Go to Loans → Add Loan → Fill form → Save
5. **Make a Payment**: Go to Payments → Add Payment → Select loan → Enter amounts → Save
6. **Check Dashboard**: View summary cards and charts
7. **Create Backup**: Go to Settings → Backup/Restore → Create Backup
8. **Restore**: Select a backup and restore (optional)

## Troubleshooting

### GitHub API Errors

- **401 Unauthorized**: Check that your GitHub token is valid and has `repo` permissions
- **404 Not Found**: Ensure the repository exists and the data files are pushed to GitHub
- **409 Conflict**: This happens when multiple users try to update the same file. The app should handle this automatically by fetching the latest SHA.

### Authentication Issues

- If you can't login, verify the password hash in `data/settings.json` is correct
- Regenerate the hash using `node scripts/generate-password-hash.js <password>`

### Data Not Loading

- Check that environment variables are set correctly
- Verify the GitHub repository exists and is accessible
- Check browser console for errors

## Security Notes

1. **Never commit** `.env.local` or any file containing secrets
2. **GitHub Token**: Store securely in environment variables, never in code
3. **JWT Secret**: Use a strong random string in production
4. **Password Hashing**: All passwords are hashed using bcrypt before storage
5. **API Routes**: All GitHub API calls go through backend API routes to keep the token secure

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please open an issue in the GitHub repository.

---

**Built with ❤️ for Shree Thaleshwor Mahadev Yuwa Samuh**
