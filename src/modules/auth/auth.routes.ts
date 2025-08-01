import { Router } from 'express';
import { authenticateToken } from './auth.middleware';

const router = Router();

// Temporary auth endpoints for Module 2
// These are basic implementations - enhance in production

// Register new user (connects wallet)
router.post('/register', async (req, res) => {
    try {
        const { wallet_pub_key, display_name } = req.body;
        
        // TODO: Implement actual registration logic
        // - Verify wallet signature
        // - Create user in database
        // - Generate JWT token
        
        res.json({
            success: true,
            data: {
                message: "Registration endpoint - to be implemented",
                wallet_pub_key
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Login with wallet
router.post('/login', async (req, res) => {
    try {
        const { wallet_pub_key, signature } = req.body;
        
        // TODO: Implement actual login logic
        // - Verify wallet ownership via signature
        // - Fetch user from database
        // - Generate JWT token
        
        res.json({
            success: true,
            data: {
                message: "Login endpoint - to be implemented",
                token: "temporary-jwt-token"
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Verify current user session
router.get('/verify', authenticateToken(), async (req, res) => {
    try {
        // User data comes from JWT middleware
        const user = req.user;
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user.id,
                    wallet_pub_key: user.wallet_pub_key,
                    mode: user.mode
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user mode (True Self, Alias, Soul)
router.put('/mode', authenticateToken(), async (req, res) => {
    try {
        const { mode } = req.body;
        const userId = req.user.id;
        
        // Validate mode
        if (!['true_self', 'alias', 'soul'].includes(mode)) {
            return res.status(400).json({ 
                success: false, 
                error: "Invalid mode. Must be: true_self, alias, or soul" 
            });
        }
        
        // TODO: Update user mode in database
        
        res.json({
            success: true,
            data: {
                message: "Mode updated successfully",
                mode
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout (optional - JWT is stateless)
router.post('/logout', authenticateToken(), async (req, res) => {
    // With JWT, logout is handled client-side by removing the token
    // This endpoint can be used for any server-side cleanup if needed
    
    res.json({
        success: true,
        data: { message: "Logged out successfully" }
    });
});

export default router;
