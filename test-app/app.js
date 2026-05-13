/**
 * Simple client-side authentication for test app
 * This simulates login/logout without requiring a backend
 */

// Check if we're on the dashboard page and not logged in
if (window.location.pathname.includes('dashboard')) {
    const session = getSession();
    if (!session) {
        // Redirect to login if not authenticated
        window.location.href = '/';
    } else {
        // Display user info on dashboard
        displayDashboardInfo(session);
    }
}

// Handle login form submission
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        
        // Accept any email/password combination
        if (email && password) {
            // Randomly fail 50% of login attempts to demonstrate screenshot capture
            const shouldFail = Math.random() < 0.3;
            
            if (shouldFail) {
                // Redirect to error page
                window.location.href = '/error.html';
                return;
            }
            
            // Create session
            const session = {
                email: email,
                sessionId: generateSessionId(),
                loginTime: new Date().toISOString()
            };
            
            // Store in localStorage
            localStorage.setItem('testAppSession', JSON.stringify(session));
            
            // Redirect to dashboard
            window.location.href = '/dashboard.html';
        }
    });
}

// Handle logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
        // Clear session
        localStorage.removeItem('testAppSession');
        
        // Redirect to login
        window.location.href = '/';
    });
}

// Helper functions
function getSession() {
    const sessionData = localStorage.getItem('testAppSession');
    return sessionData ? JSON.parse(sessionData) : null;
}

function generateSessionId() {
    return 'sess_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

function displayDashboardInfo(session) {
    const userEmailEl = document.getElementById('userEmail');
    const sessionIdEl = document.getElementById('sessionId');
    const loginTimeEl = document.getElementById('loginTime');
    
    if (userEmailEl) userEmailEl.textContent = session.email;
    if (sessionIdEl) sessionIdEl.textContent = session.sessionId;
    if (loginTimeEl) {
        const date = new Date(session.loginTime);
        loginTimeEl.textContent = date.toLocaleString();
    }
}

function showAlert() {
    const resultEl = document.getElementById('actionResult');
    if (resultEl) {
        resultEl.textContent = '✅ Action completed successfully!';
        resultEl.style.display = 'block';
        
        setTimeout(() => {
            resultEl.style.display = 'none';
        }, 3000);
    }
}
