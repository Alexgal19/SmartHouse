# **App Name**: HR Housing Hub

## Core Features:

- Dashboard: Display key metrics (Total Employees, Apartments in Use, Upcoming Checkouts) and charts (Employees per Coordinator/Nationality/Department). Display table with housing addresses, capacity and occupancy.
- Employee Management: Manage active and dismissed employees with search, filtering, add, edit, and dismiss functionalities. Data grid to show employee details. Dedicated page for dismissed employees.
- Employee Form: Dialog form for adding/editing employee information. This feature also handles populating `Select` components with data from Firestore settings such as available addresses and nationalities.
- Settings Management: Admin interface for managing settings, such as addresses, nationalities, departments in Firestore.

## Style Guidelines:

- Primary color: Soft blue (#64B5F6) for a calm and professional feel.
- Background color: Light gray (#F5F5F5) for a clean and neutral backdrop.
- Accent color: Green (#81C784) to highlight important actions and elements.
- Font: 'Inter' (sans-serif) for a clean, modern, and readable text across the application.
- Collapsible sidebar on desktop, bottom navigation bar on mobile, top header bar with user information and scrollable main content area for optimal responsiveness.
- Use 'lucide-react' icons throughout the application to provide visual cues and enhance the user experience.
- Use subtle animations to highlight interactive elements on hover and focus to improve usability. Use 'Toast' component to show notifications.