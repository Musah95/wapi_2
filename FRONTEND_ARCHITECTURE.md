# Frontend Architecture & User Flow Guide

## Overview
The revised frontend is a single-page application (SPA) with dynamic content rendering based on authentication status. It uses a modern, modular approach with clean separation of concerns.

## Project Structure

```
wapi/
├── templates/
│   ├── index.html          # Main SPA (new)
│   └── index2.html         # Legacy (deprecated)
├── static/
│   ├── app.js              # Application logic (new)
│   ├── index.css           # Updated styling
│   ├── scripts.js          # Legacy (deprecated)
│   ├── index2.css          # Legacy (deprecated)
│   └── img/
```

## Application State Flow

### 1. Initial Page Load
```
User visits URL
    ↓
Check localStorage for token
    ↓
├─ Token exists → loadUserSession()
│              ↓
│           Fetch /users/me
│              ↓
│           Validate & load user data
│              ↓
│           showUserDashboard(user)
│
└─ No token → initializePublicView()
               ↓
            renderPublicStations()
               ↓
            Show public stations + auth button
```

### 2. Authentication Flow

#### Sign Up
```
User clicks "Sign Up"
    ↓
Opens auth modal (Sign Up tab)
    ↓
User enters: username, password, confirm password
    ↓
Form submitted: POST /users/
    ↓
User created (password hashed on backend)
    ↓
Success message + auto-switch to Sign In tab
    ↓
User signs in normally
```

#### Sign In
```
User clicks "Sign In / Sign Up" button
    ↓
Opens auth modal (Sign In tab)
    ↓
User enters: username, password
    ↓
Form submitted: POST /login
    ↓
Backend validates credentials
    ↓
Returns JWT token
    ↓
localStorage.setItem("token", access_token)
    ↓
loadUserSession()
    ↓
Fetch /users/me with token
    ↓
showUserDashboard(user)
```

### 3. Authenticated User Flow

#### View Public Stations
```
User (logged in) stays on landing page
    ↓
Sees public stations section
    ↓
Can click "View Details" on any public station
    ↓
Opens station-detail-modal
    ↓
Shows full station data
    ↓
Can view historical chart
    ↓
Cannot edit (not owner)
```

#### View Personal Stations
```
User navigates to "My Weather Stations" section
    ↓
Fetches /stations/all with authentication
    ↓
Displays user's stations
    ↓
Shows station status: Public or Private
    ↓
Displays API Key with copy button
    ↓
Action buttons: View Details, Edit
```

#### Add New Station
```
User clicks "+ Add New Station" button
    ↓
Opens add-station-modal
    ↓
User enters location
    ↓
Form submitted: POST /stations/
    ↓
Backend creates station + generates API key
    ↓
Success message
    ↓
Modal closes
    ↓
renderUserStations() refreshes list
```

#### Edit Station
```
User clicks "Edit" on station card
    ↓
Opens edit-station-modal with pre-filled data
    ↓
User can:
│   ├─ Change location
│   ├─ Toggle public/private status
│   └─ Delete station
│
├─ Update: PUT /stations/{id}/location
├─ Delete: DELETE /stations/{id}
│
    ↓
Success message
    ↓
Modal closes
    ↓
List refreshes
```

#### View Station Details
```
User clicks "View Details" on station
    ↓
Opens station-detail-modal
    ↓
Fetches /stations/{id}/details
    ↓
Displays all current weather metrics
    ↓
Shows action buttons:
│   ├─ View Historical Data (chart)
│   └─ Edit Station (if owner)
│
    ↓
User can interact with modal
```

#### Historical Data Chart
```
User clicks "View Historical Data"
    ↓
Opens historical-chart-modal
    ↓
Shows metric checkboxes:
│   ├─ Temperature
│   ├─ Humidity
│   ├─ Pressure
│   ├─ Wind Speed
│   ├─ UV Index
│   └─ Wind Direction
│
    ↓
User selects metrics to display
    ↓
Fetches /stations/{id}/historical_data
    ↓
Constructs datasets from selected metrics
    ↓
Renders Chart.js line chart
    ↓
User can update and refresh
```

### 4. Logout Flow

```
User clicks "Logout" button
    ↓
Confirmation dialog
    ↓
├─ Cancel → dismissed
└─ Confirm → 
     ↓
    localStorage.removeItem("token")
     ↓
    Clear currentUser state
     ↓
    Hide authenticated sections
     ↓
    initializePublicView()
     ↓
    Show public stations + login button
```

## Component Hierarchy

### Sections (Visibility Toggled)

```
.navbar                        (Always visible)
├─ .nav-brand
└─ .nav-actions               (Dynamic: login btn or user info)

.main-container
├─ .hero-section              (Hidden when authenticated)
├─ .section#public-stations-section (Visible when NOT authenticated)
├─ .section#user-dashboard    (Hidden when NOT authenticated)
├─ .section#user-stations-section (Hidden when NOT authenticated)
└─ Modals (all overlays)
   ├─ #auth-modal
   ├─ #station-detail-modal
   ├─ #historical-chart-modal
   ├─ #add-station-modal
   └─ #edit-station-modal

.footer                        (Always visible)
```

### Modal Details

#### Auth Modal
```
#auth-modal
├─ .auth-tabs
│  ├─ Sign In tab (active by default)
│  └─ Sign Up tab
├─ #signin-form.auth-form.active
│  ├─ username input
│  ├─ password input
│  └─ Submit button
└─ #signup-form.auth-form (hidden)
   ├─ username input
   ├─ password input
   ├─ confirm password input
   └─ Submit button
```

#### Add/Edit Station Modals
```
#add-station-modal
├─ location input
└─ Submit button

#edit-station-modal
├─ location input
├─ public checkbox
├─ Action buttons:
│  ├─ Save Changes
│  ├─ Cancel
│  └─ Delete Station
```

#### Station Detail Modal
```
#station-detail-modal
├─ Station info (read-only)
│  ├─ Location
│  ├─ Temperature
│  ├─ Humidity
│  ├─ Pressure
│  ├─ Wind Speed
│  ├─ Wind Direction
│  ├─ UV Index
│  └─ Rain Status
└─ Action buttons:
   ├─ View Historical Data
   └─ Edit Station (if owner)
```

## API Interaction Summary

### Authentication
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| POST | `/users/` | No | Create new user |
| POST | `/login` | No | Get JWT token |
| GET | `/users/me` | Yes | Get current user |

### Stations
| Method | Endpoint | Auth Required | Purpose |
|--------|----------|---------------|---------|
| GET | `/stations/public` | No | Get public stations |
| GET | `/stations/all` | Yes | Get user's stations |
| POST | `/stations/` | Yes | Create station |
| GET | `/stations/{id}/details` | Yes | Get station details |
| PUT | `/stations/{id}/location` | Yes | Update station |
| DELETE | `/stations/{id}` | Yes | Delete station |
| GET | `/stations/{id}/historical_data` | Yes | Get historical data |

## Key JavaScript Functions

### Initialization
- `initializePublicView()` - Set up public landing page
- `loadUserSession()` - Load authenticated user data
- `updateNavBar()` - Update navigation based on auth status

### Authentication
- `handleSignIn()` - Process sign in form
- `handleSignUp()` - Process sign up form
- `logout()` - Clear session and return to public view

### Station Management
- `renderPublicStations()` - Display public stations
- `renderUserStations()` - Display user's stations
- `openAddStationModal()` / `closeAddStationModal()`
- `handleAddStation()` - Create new station
- `openEditStationModal()` / `closeEditStationModal()`
- `handleEditStation()` - Update station
- `handleDeleteStation()` - Delete station

### Detail Views
- `viewStationDetail()` - Open station detail modal
- `fetchStationDetail()` - Fetch station data
- `showHistoricalChart()` - Open chart modal
- `updateChart()` - Render chart with selected metrics

### Utilities
- `copyToClipboard()` - Copy API key to clipboard
- `getRandomColor()` - Generate colors for chart
- `formatFieldName()` - Format metric names for display

## Styling Architecture

### CSS Custom Properties
```css
:root {
  --primary-color: #2563eb;
  --secondary-color: #64748b;
  --success-color: #10b981;
  --danger-color: #ef4444;
  --bg-light: #f8fafc;
  --bg-white: #ffffff;
  --border-color: #e2e8f0;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
  --shadow-sm/md/lg: ...
  --transition: all 0.3s ease;
}
```

### Utility Classes
- `.hidden` - Display none
- `.no-data` - Empty state styling
- `.error` - Error message styling

### Responsive Breakpoints
- Desktop: 1200px max-width container
- Tablet: 768px media query
- Mobile: 480px media query

## Performance Considerations

### Lazy Loading
- Stations only fetched when section becomes visible
- Historical data only fetched when chart opened

### Caching
- User data stored in memory (currentUser variable)
- Token persisted in localStorage

### API Calls
- Minimal API calls on page load
- Optimized fetching (only needed endpoints)
- Error handling with user feedback

## Security Notes

### Frontend Security
1. **Token Storage**: JWT stored in localStorage
2. **Authorization Header**: Automatically attached to protected requests
3. **Token Expiration**: Backend validates token, frontend redirects to login if expired
4. **HTTPS**: Should be enforced in production
5. **Password**: Never logged or exposed in frontend

### Data Protection
- API keys displayed with copy functionality (not input fields)
- Passwords only submitted to login endpoint
- No sensitive data logged to console

## Testing Scenarios

### Happy Path
1. Visit landing page → See public stations
2. Click sign up → Create account
3. Sign in with credentials → See dashboard
4. Add station → Create weather station
5. View station details → See all metrics
6. View historical chart → See data visualization
7. Edit station → Update location/visibility
8. Delete station → Remove from list
9. Logout → Return to public view

### Edge Cases
1. Invalid credentials → Error message
2. Username already taken → Error on signup
3. Passwords don't match → Error on signup
4. No historical data → Appropriate message
5. No public stations → "No stations available" message
6. Session expired → Logout and redirect to login
7. Network error → Error messages

## Browser Developer Tools Tips

### Debug Authentication
```javascript
// Check token
localStorage.getItem('token')

// Check current user
currentUser

// Check API calls
// Open Network tab in DevTools
```

### Debug Modals
```javascript
// Toggle modal visibility
document.getElementById('auth-modal').classList.toggle('hidden')
```

### Clear Session
```javascript
// Clear all local data
localStorage.clear()
location.reload()
```
