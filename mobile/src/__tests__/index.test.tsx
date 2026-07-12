import { render, screen, waitFor, fireEvent, act } from '@testing-library/react-native';
import { toHaveDisabledAccessibility } from '@testing-library/jest-native/extenders';
import { ThemeProvider, useTheme } from '../src/theme';
import { AuthProvider, useAuth } from '../src/api/AuthContext';
import { APIProvider } from '../src/api/client';
import App from '../app/index';

expect.extend(toHaveDisabledAccessibility);

jest.mock('../src/api/client', () => ({
  apiFetch: jest.fn(),
  apiFetchText: jest.fn(),
  getToken: jest.fn(),
  setToken: jest.fn(),
  clearToken: jest.fn(),
  getFaceIdEnabled: jest.fn(),
  setFaceIdEnabled: jest.fn(),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useSegments: () => ([null]),
  Group: ({ children }) => children,
  Slot: ({ children }) => children,
}));

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('expo-local-authentication', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
}));

describe('Mobile App - Phase 11: Automated Test Suite Implementation', () => {
  const renderApp = (ui) => {
    return render(
      <ThemeProvider>
        <AuthProvider>
          <APIProvider>
            {ui}
          </APIProvider>
        </AuthProvider>
      </ThemeProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Authentication Tests', () => {
    test('login page renders correctly', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve(null));

      const { findByTestId } = renderApp(<App />);
      const loginEmailInput = await findByTestId('login-email-input');
      const loginPasswordInput = await findByTestId('login-password-input');
      const loginButton = await findByTestId('login-button');

      expect(loginEmailInput).toBeTruthy();
      expect(loginPasswordInput).toBeTruthy();
      expect(loginButton).toBeTruthy();
      expect(loginButton.props.disabled).toBe(true);
    });

    test('login submits successfully', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve(null));
      authClient.apiFetch.mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'user1', email: 'test@example.com', name: 'Test User', permissions: ['EDIT_ITEMS'] }
      });

      const { findByTestId, findByText } = renderApp(<App />);

      const loginEmailInput = await findByTestId('login-email-input');
      const loginPasswordInput = await findByTestId('login-password-input');
      const loginButton = await findByTestId('login-button');

      await act(async () => {
        fireEvent.changeText(loginEmailInput, 'test@example.com');
        fireEvent.changeText(loginPasswordInput, 'password123');
      });

      expect(loginButton.props.disabled).toBe(false);

      await act(async () => {
        fireEvent.press(loginButton);
      });

      await waitFor(() => {
        expect(authClient.apiFetch).toHaveBeenCalledWith('/api/v1/auth/login', expect.any(Object));
      });
    });
  });

  describe('Protected Routes Tests', () => {
    test('protected routes redirect to login when not authenticated', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve(null));

      const { findByText } = renderApp(<App />);

      await waitFor(() => {
        expect(screen.getByText(/login/i)).toBeTruthy();
      }, { timeout: 2000 });
    });

    test('dashboard accessible when authenticated', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve('test-token'));
      authClient.apiFetch.mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'user1', email: 'test@example.com', name: 'Test User', permissions: ['EDIT_ITEMS'] }
      });

      const { findByText } = renderApp(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Screen Accessibility Tests (Phase 11 Check)', () => {
    test('dashboard screen has proper accessibility labels', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve('test-token'));
      authClient.apiFetch.mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'user1', email: 'test@example.com', name: 'Test User', permissions: ['EDIT_ITEMS'] }
      });

      const { findByTestId } = renderApp(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeTruthy();
      }, { timeout: 2000 });

      const revenueCard = await findByTestId('today-revenue-card');
      expect(revenueCard).toHaveAccessibilityHint('Today\'s revenue card');

      const lowStockBadge = await findByTestId('low-stock-badge');
      expect(lowStockBadge).toHaveAccessibilityLabel('Low stock: 5 items');
    });

    test('items screen has proper screen reader support', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve('test-token'));
      authClient.apiFetch.mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'user1', email: 'test@example.com', name: 'Test User', permissions: ['EDIT_ITEMS'] }
      });

      const { findByLabelText, findByTestId } = renderApp(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeTruthy();
      }, { timeout: 2000 });

      const itemsTab = await findByLabelText(/items tab/i);
      await act(async () => {
        fireEvent.press(itemsTab);
      });

      const itemsList = await findByTestId('items-list');
      expect(itemsList).toBeAccessible();
    });
  });

  describe('Navigation Tests', () => {
    test('bottom navigation works correctly', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve('test-token'));
      authClient.apiFetch.mockResolvedValueOnce({
        token: 'test-token',
        user: { id: 'user1', email: 'test@example.com', name: 'Test User', permissions: ['EDIT_ITEMS'] }
      });

      const { findByLabelText } = renderApp(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeTruthy();
      }, { timeout: 2000 });

      const itemsTab = await findByLabelText(/items tab/i);
      expect(itemsTab).toBeTruthy();

      await act(async () => {
        fireEvent.press(itemsTab);
      });

      await waitFor(() => {
        expect(screen.getByText(/items list/i)).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Error Handling Tests', () => {
    test('network errors are handled gracefully', async () => {
      const authClient = require('../src/api/client');
      authClient.getToken.mockReturnValueOnce(Promise.resolve('test-token'));
      authClient.apiFetch.mockRejectedValueOnce(
        new authClient.ApiError(0, 'Could not reach the server. Check your connection and try again.')
      );

      const { findByText, findByTestId } = renderApp(<App />);

      await waitFor(() => {
        expect(screen.getByText(/dashboard/i)).toBeTruthy();
      }, { timeout: 2000 });

      await act(async () => {
        const refreshButton = await findByTestId('refresh-button');
        fireEvent.press(refreshButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeTruthy();
      }, { timeout: 2000 });
    });
  });

  describe('Theme Tests', () => {
    test('dark mode is respected', () => {
      const { useTheme } = require('../src/theme');

      const TestComponent = () => {
        const theme = useTheme();
        return null;
      };

      renderApp(<TestComponent />);
      expect(theme.isDark).toBe(true);
    });

    test('light mode is respected', () => {
      const { useTheme } = require('../src/theme');

      const TestComponent = () => {
        const theme = useTheme();
        return null;
      };

      const lightTheme = { isDark: false, colors: {} };
      jest.mock('../src/theme', () => ({
        ...require('../src/theme'),
        useTheme: () => lightTheme,
      }));

      renderApp(<TestComponent />);
      expect(useTheme().isDark).toBe(false);
    });
  });
});
