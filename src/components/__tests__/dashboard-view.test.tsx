import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardView from '../dashboard-view';
import { useMainLayout } from '../main-layout';
import { useIsMobile } from '@/hooks/use-mobile';
import { SessionData, Settings } from '@/types';

// Mock dependencies
jest.mock('../main-layout');
jest.mock('@/hooks/use-mobile');
jest.mock('../dashboard/kpi-cards', () => ({
  DashboardKPIs: () => <div data-testid="dashboard-kpis">KPI Cards</div>,
}));
jest.mock('../dashboard/coordinator-filter', () => ({
  CoordinatorFilter: () => <div data-testid="coordinator-filter">Coordinator Filter</div>,
}));
jest.mock('../dashboard/upcoming-checkouts-dialog', () => ({
  UpcomingCheckoutsDialog: ({ isOpen }: { isOpen: boolean }) => (
    isOpen ? <div data-testid="upcoming-checkouts-dialog">Upcoming Checkouts Dialog</div> : null
  ),
}));
jest.mock('../dashboard/quick-actions', () => ({
  QuickActions: () => <div data-testid="quick-actions">Quick Actions</div>,
}));

// Mock dynamic imports
jest.mock('next/dynamic', () => () => {
  const DynamicComponent = () => <div data-testid="dynamic-chart">Dynamic Chart</div>;
  return DynamicComponent;
});

const mockSettings: Settings = {
  id: 'global-settings',
  coordinators: [],
  localities: [],
  departments: [],
  nationalities: [],
  genders: [],
  addresses: [],
  paymentTypesNZ: [],
  statuses: [],
  bokRoles: [],
  bokReturnOptions: [],
  bokStatuses: [],
};

const mockSession: SessionData = {
  isLoggedIn: true,
  uid: 'user-1',
  name: 'Test User',
  isAdmin: false,
};

describe('DashboardView', () => {
  const mockUseMainLayout = useMainLayout as jest.Mock;
  const mockUseIsMobile = useIsMobile as jest.Mock;

  beforeEach(() => {
    mockUseMainLayout.mockReturnValue({
      allEmployees: [],
      allNonEmployees: [],
      settings: mockSettings,
      hasNewCheckouts: false,
      setHasNewCheckouts: jest.fn(),
      selectedCoordinatorId: 'all',
    });
    mockUseIsMobile.mockReturnValue({ isMobile: false });
  });

  it('renders loading state when data is missing', () => {
    mockUseMainLayout.mockReturnValue({
      allEmployees: undefined, // Simulating loading
      allNonEmployees: [],
      settings: mockSettings,
    });

    render(<DashboardView currentUser={mockSession} />);
    // Skeleton elements usually don't have text, so checking structure or lack of main content
    expect(screen.queryByTestId('dashboard-kpis')).not.toBeInTheDocument();
  });

  it('renders dashboard content when data is loaded', () => {
    render(<DashboardView currentUser={mockSession} />);

    expect(screen.getByTestId('dashboard-kpis')).toBeInTheDocument();
    expect(screen.getByTestId('quick-actions')).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-chart')).toHaveLength(2); // Charts + Occupancy (if admin) or just Charts?
    // Wait, DashboardCharts is one dynamic component. CoordinatorOccupancyChart is another.
    // If not admin, CoordinatorOccupancyChart is not rendered?
    // Let's check logic:
    // {currentUser.isAdmin && selectedCoordinatorId !== 'all' && (<DynamicCoordinatorOccupancyChart />)}
    // mockSession is NOT admin. So only DashboardCharts.
    expect(screen.getAllByTestId('dynamic-chart')).toHaveLength(1);
  });

  it('renders admin components for admin user', () => {
    const adminSession = { ...mockSession, isAdmin: true };
    mockUseMainLayout.mockReturnValue({
        allEmployees: [],
        allNonEmployees: [],
        settings: mockSettings,
        hasNewCheckouts: false,
        setHasNewCheckouts: jest.fn(),
        selectedCoordinatorId: 'coord-1', // Not 'all' to show chart
    });

    render(<DashboardView currentUser={adminSession} />);

    expect(screen.getByTestId('coordinator-filter')).toBeInTheDocument();
    expect(screen.getAllByTestId('dynamic-chart')).toHaveLength(2); // Charts + Occupancy
  });

});
