# HR Housing Hub

A comprehensive management system for HR and Housing coordination, built with **Next.js**, **Firebase**, and **Google Sheets** integration. This application serves as a central hub for managing employees, housing allocations, and coordinator tasks.

## 🚀 Features

*   **Dashboard & Analytics**: Visual overview of occupancy, coordinator KPIs, and upcoming checkouts.
*   **Employee Management**: 
    *   Track active and dismissed employees.
    *   Manage non-employees and BOK residents.
    *   Detailed records including contract dates, deductions, and statuses.
*   **Housing Management**:
    *   Manage apartments, rooms, and bed capacity.
    *   Visualize housing occupancy.
    *   Track address history for residents.
*   **Coordinator Hub**:
    *   Coordinator-specific views and filtering.
    *   Task management and notifications.
*   **AI Integration**:
    *   Powered by Genkit for intelligent features (e.g., passport data extraction).
*   **PWA Support**: Installable as a Progressive Web App for mobile access.

## 🛠 Tech Stack

*   **Framework**: [Next.js 14+](https://nextjs.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
*   **Backend / Database**: 
    *   [Google Sheets API](https://theoephraim.github.io/node-google-spreadsheet/) (acting as the primary CMS/Database)
    *   [Firebase](https://firebase.google.com/) (Hosting, Auth, Messaging)
*   **AI**: [Genkit](https://firebase.google.com/docs/genkit)
*   **Charts**: [Recharts](https://recharts.org/)

## ⚙️ Environment Setup

To run this project locally, you need to configure the following environment variables. Create a `.env.local` file in the root directory:

```bash
# Google Sheets Service Account Authentication
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-service-account-email@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour Private Key...\n-----END PRIVATE KEY-----"

# Firebase Configuration (Already integrated in src/lib/firebase.ts, but can be moved here)
# NEXT_PUBLIC_FIREBASE_API_KEY=...
```

## 📦 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <project-directory>
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    # or
    yarn install
    ```

3.  **Run the development server:**
    ```bash
    npm run dev
    ```

4.  **Open the app:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 📂 Project Structure

*   `src/app` - App Router pages and layouts.
*   `src/components` - Reusable UI components (shadcn/ui) and feature-specific views.
*   `src/lib` - Utility functions, API clients (Sheets, Firebase), and types.
    *   `sheets.ts` - Core logic for Google Sheets interactions.
    *   `firebase.ts` - Firebase initialization.
*   `src/ai` - AI flows and Genkit configuration.
*   `public` - Static assets and PWA service workers.

## 🤝 Contributing

1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add some amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

## 📄 License

[MIT](LICENSE)
