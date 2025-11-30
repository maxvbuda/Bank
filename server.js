require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Email configuration
// Configure email using environment variables in .env file
// Supports Gmail, GoDaddy, Resend, and other SMTP services

let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Resend SMTP configuration
    if (process.env.EMAIL_SERVICE === 'resend') {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.resend.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false, // Resend uses STARTTLS on port 587
            auth: {
                user: 'resend',
                pass: process.env.EMAIL_PASS // Use Resend API key as password
            }
        });
        console.log('Email service configured (Resend SMTP)');
    }
    // GoDaddy SMTP configuration
    else if (process.env.EMAIL_SERVICE === 'godaddy' || process.env.EMAIL_HOST) {
        transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtpout.secureserver.net',
            port: parseInt(process.env.EMAIL_PORT) || 465,
            secure: (process.env.EMAIL_PORT === '465' || !process.env.EMAIL_PORT), // true for 465, false for other ports
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                ciphers: 'SSLv3'
            }
        });
        console.log('Email service configured (GoDaddy SMTP)');
    } else {
        // Gmail or other service-based configuration
        transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log(`Email service configured (${process.env.EMAIL_SERVICE || 'gmail'})`);
    }
} else {
    console.warn('Email service not configured. Set EMAIL_USER and EMAIL_PASS in .env file to enable email functionality.');
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// Database setup
const db = new sqlite3.Database('./bank.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            email TEXT NOT NULL,
            balance REAL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            amount REAL NOT NULL,
            recipient_id INTEGER,
            sender_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (recipient_id) REFERENCES users(id),
            FOREIGN KEY (sender_id) REFERENCES users(id)
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            item_id INTEGER,
            item_name TEXT,
            icon TEXT,
            quantity INTEGER DEFAULT 1,
            purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    console.log('Database tables initialized');
}

// API Routes

// Register new user
app.post('/api/register', async (req, res) => {
    const { username, password, email } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        db.run(
            'INSERT INTO users (username, password, email) VALUES (?, ?, ?)',
            [username, hashedPassword, email],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Registration failed' });
                }

                res.status(201).json({
                    message: 'User registered successfully',
                    userId: this.lastID
                });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(401).json({ error: 'Invalid username or password' });
        }

        try {
            const match = await bcrypt.compare(password, user.password);

            if (!match) {
                return res.status(401).json({ error: 'Invalid username or password' });
            }

            res.json({
                message: 'Login successful',
                user: {
                    id: user.id,
                    username: user.username,
                    balance: user.balance
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });
});

// Get balance
app.get('/api/balance/:userId', (req, res) => {
    const { userId } = req.params;

    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ balance: user.balance });
    });
});

// Mine diamonds (game reward)
app.post('/api/mine', (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    // Validate amount is within game limits (precious diamonds!)
    if (amount > 30) {
        return res.status(400).json({ error: 'Invalid reward amount' });
    }

    db.run('BEGIN TRANSACTION');

    db.run(
        'UPDATE users SET balance = balance + ? WHERE id = ?',
        [amount, userId],
        function(err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Mining failed' });
            }

            db.run(
                'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
                [userId, 'mine', amount],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Mining failed' });
                    }

                    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Mining failed' });
                        }

                        db.run('COMMIT');
                        res.json({
                            message: 'Mining successful',
                            balance: user.balance
                        });
                    });
                }
            );
        }
    );
});

// Withdraw
app.post('/api/withdraw', (req, res) => {
    const { userId, amount } = req.body;

    if (!userId || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        db.run('BEGIN TRANSACTION');

        db.run(
            'UPDATE users SET balance = balance - ? WHERE id = ?',
            [amount, userId],
            function(err) {
                if (err) {
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Withdrawal failed' });
                }

                db.run(
                    'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
                    [userId, 'withdraw', amount],
                    function(err) {
                        if (err) {
                            db.run('ROLLBACK');
                            return res.status(500).json({ error: 'Withdrawal failed' });
                        }

                        db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Withdrawal failed' });
                            }

                            db.run('COMMIT');
                            res.json({
                                message: 'Withdrawal successful',
                                balance: user.balance
                            });
                        });
                    }
                );
            }
        );
    });
});

// Transfer
app.post('/api/transfer', (req, res) => {
    const { fromUserId, toUsername, amount } = req.body;

    if (!fromUserId || !toUsername || !amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [fromUserId], (err, sender) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!sender) {
            return res.status(404).json({ error: 'Sender not found' });
        }

        if (sender.balance < amount) {
            return res.status(400).json({ error: 'Insufficient funds' });
        }

        db.get('SELECT * FROM users WHERE username = ?', [toUsername], (err, recipient) => {
            if (err) {
                return res.status(500).json({ error: 'Server error' });
            }

            if (!recipient) {
                return res.status(404).json({ error: 'Recipient not found' });
            }

            if (sender.id === recipient.id) {
                return res.status(400).json({ error: 'Cannot transfer to yourself' });
            }

            db.run('BEGIN TRANSACTION');

            // Deduct from sender
            db.run(
                'UPDATE users SET balance = balance - ? WHERE id = ?',
                [amount, fromUserId],
                function(err) {
                    if (err) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ error: 'Transfer failed' });
                    }

                    // Add to recipient
                    db.run(
                        'UPDATE users SET balance = balance + ? WHERE id = ?',
                        [amount, recipient.id],
                        function(err) {
                            if (err) {
                                db.run('ROLLBACK');
                                return res.status(500).json({ error: 'Transfer failed' });
                            }

                            // Record transaction for sender
                            db.run(
                                'INSERT INTO transactions (user_id, type, amount, recipient_id) VALUES (?, ?, ?, ?)',
                                [fromUserId, 'transfer-sent', amount, recipient.id],
                                function(err) {
                                    if (err) {
                                        db.run('ROLLBACK');
                                        return res.status(500).json({ error: 'Transfer failed' });
                                    }

                                    // Record transaction for recipient
                                    db.run(
                                        'INSERT INTO transactions (user_id, type, amount, sender_id) VALUES (?, ?, ?, ?)',
                                        [recipient.id, 'transfer-received', amount, fromUserId],
                                        function(err) {
                                            if (err) {
                                                db.run('ROLLBACK');
                                                return res.status(500).json({ error: 'Transfer failed' });
                                            }

                                            db.get('SELECT balance FROM users WHERE id = ?', [fromUserId], (err, user) => {
                                                if (err) {
                                                    db.run('ROLLBACK');
                                                    return res.status(500).json({ error: 'Transfer failed' });
                                                }

                                                db.run('COMMIT');
                                                res.json({
                                                    message: 'Transfer successful',
                                                    balance: user.balance
                                                });
                                            });
                                        }
                                    );
                                }
                            );
                        }
                    );
                }
            );
        });
    });
});

// Get transactions
app.get('/api/transactions/:userId', (req, res) => {
    const { userId } = req.params;

    const query = `
        SELECT 
            t.*,
            sender.username as senderUsername,
            recipient.username as recipientUsername
        FROM transactions t
        LEFT JOIN users sender ON t.sender_id = sender.id
        LEFT JOIN users recipient ON t.recipient_id = recipient.id
        WHERE t.user_id = ?
        ORDER BY t.timestamp DESC
        LIMIT 50
    `;

    db.all(query, [userId], (err, transactions) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        res.json({ transactions });
    });
});

// Delete account
app.delete('/api/delete-account', (req, res) => {
    const { userId } = req.body;
    
    console.log('Delete account request received for userId:', userId);

    if (!userId) {
        console.log('Error: No userId provided');
        return res.status(400).json({ error: 'User ID required' });
    }

    db.run('BEGIN TRANSACTION');

    // Delete all user's transactions
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId], (err) => {
        if (err) {
            console.error('Error deleting user transactions:', err);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Failed to delete account' });
        }

        // Delete transactions where user was sender or recipient
        db.run('DELETE FROM transactions WHERE sender_id = ? OR recipient_id = ?', [userId, userId], (err) => {
            if (err) {
                console.error('Error deleting related transactions:', err);
                db.run('ROLLBACK');
                return res.status(500).json({ error: 'Failed to delete account' });
            }

            // Delete user
            db.run('DELETE FROM users WHERE id = ?', [userId], (err) => {
                if (err) {
                    console.error('Error deleting user:', err);
                    db.run('ROLLBACK');
                    return res.status(500).json({ error: 'Failed to delete account' });
                }

                console.log('Account deleted successfully for userId:', userId);
                db.run('COMMIT');
                res.json({ message: 'Account deleted successfully' });
            });
        });
    });
});

// Reset password
app.post('/api/reset-password', async (req, res) => {
    const { username, email } = req.body;

    if (!username || !email) {
        return res.status(400).json({ error: 'Username and email are required' });
    }

    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Verify email matches the account
        if (user.email.toLowerCase() !== email.toLowerCase()) {
            return res.status(400).json({ error: 'Email does not match the account' });
        }

        try {
            // Generate temporary password
            const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).replace(/[0-9]/g, '').substring(0, 2);
            const hashedPassword = await bcrypt.hash(tempPassword, 10);

            // Update user password
            db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, user.id],
                async (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to reset password' });
                    }

                    console.log(`Password reset for user: ${username}`);
                    console.log(`Sending temporary password email to: ${user.email}`);
                    console.log(`Email transporter available: ${transporter ? 'Yes' : 'No'}`);

                    // Send email with temporary password
                    const fromEmail = process.env.EMAIL_SERVICE === 'resend' 
                        ? process.env.EMAIL_USER 
                        : (process.env.EMAIL_USER || 'Red Diamond Bank <noreply@reddiamondbank.com>');
                    
                    console.log(`From email: ${fromEmail}`);
                    console.log(`To email: ${user.email}`);
                    
                    const mailOptions = {
                        from: fromEmail,
                        to: user.email,
                        subject: 'Red Diamond Bank - Password Reset',
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #dc143c;">🔴 Red Diamond Bank</h2>
                                <h3>Password Reset Request</h3>
                                <p>Hello ${username},</p>
                                <p>Your temporary password is:</p>
                                <div style="background: #f5f5f5; padding: 15px; border-left: 4px solid #dc143c; margin: 20px 0;">
                                    <code style="font-size: 18px; font-weight: bold;">${tempPassword}</code>
                                </div>
                                <p>Please use this temporary password to log in, then change it immediately using the "Change Password" button in your dashboard.</p>
                                <p style="color: #666; font-size: 12px; margin-top: 30px;">
                                    If you did not request this password reset, please contact support immediately.
                                </p>
                            </div>
                        `
                    };

                    if (transporter) {
                        try {
                            console.log('Attempting to send email...');
                            const info = await transporter.sendMail(mailOptions);
                            console.log('Temporary password email sent successfully!');
                            console.log('Message ID:', info.messageId);
                            console.log('Response:', info.response);
                            res.json({
                                message: 'Temporary password sent to ' + user.email,
                                emailSent: true,
                                email: user.email
                            });
                        } catch (emailError) {
                            console.error('Email send failed:');
                            console.error('Error:', emailError);
                            console.error('Error message:', emailError.message);
                            console.error('Error code:', emailError.code);
                            console.error('Error response:', emailError.response);
                            // Email failed, return temp password as fallback
                            res.json({
                                message: 'Email service error. Your temporary password: ' + tempPassword,
                                emailSent: false,
                                tempPassword: tempPassword,
                                emailError: emailError.message || 'Unknown error',
                                email: user.email
                            });
                        }
                    } else {
                        console.error('Email transporter is not configured!');
                        console.error('Check your .env file for EMAIL_USER and EMAIL_PASS');
                        // Return temp password if email not configured
                        res.json({
                            message: 'Email service not configured. Your temporary password: ' + tempPassword,
                            emailSent: false,
                            tempPassword: tempPassword,
                            emailError: 'Email service not configured',
                            email: user.email
                        });
                    }
                }
            );
        } catch (error) {
            console.error('Password reset error:', error);
            res.status(500).json({ error: 'Server error' });
        }
    });
});

// Change password
app.post('/api/change-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'All fields required' });
    }

    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        try {
            // Verify current password
            const match = await bcrypt.compare(currentPassword, user.password);

            if (!match) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }

            // Hash new password
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            // Update password
            db.run(
                'UPDATE users SET password = ? WHERE id = ?',
                [hashedPassword, userId],
                (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Failed to change password' });
                    }

                    console.log(`Password changed for user: ${user.username}`);
                    res.json({ message: 'Password changed successfully' });
                }
            );
        } catch (error) {
            res.status(500).json({ error: 'Server error' });
        }
    });
});

// Shop - Buy item
app.post('/api/shop/buy', (req, res) => {
    const { userId, itemId, itemName, price, icon } = req.body;

    if (!userId || !itemId || !itemName || !price) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check user balance
    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.balance < price) {
            return res.status(400).json({ error: 'Insufficient Red Diamonds' });
        }

        // Deduct price from balance
        const newBalance = user.balance - price;

        db.run(
            'UPDATE users SET balance = ? WHERE id = ?',
            [newBalance, userId],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to update balance' });
                }

                // Check if item already exists in inventory
                db.get(
                    'SELECT * FROM inventory WHERE user_id = ? AND item_id = ?',
                    [userId, itemId],
                    (err, existingItem) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }

                        if (existingItem) {
                            // Update quantity
                            db.run(
                                'UPDATE inventory SET quantity = quantity + 1 WHERE user_id = ? AND item_id = ?',
                                [userId, itemId],
                                (err) => {
                                    if (err) {
                                        return res.status(500).json({ error: 'Failed to update inventory' });
                                    }
                                    recordPurchase();
                                }
                            );
                        } else {
                            // Add new item
                            db.run(
                                'INSERT INTO inventory (user_id, item_id, item_name, icon) VALUES (?, ?, ?, ?)',
                                [userId, itemId, itemName, icon],
                                (err) => {
                                    if (err) {
                                        return res.status(500).json({ error: 'Failed to add to inventory' });
                                    }
                                    recordPurchase();
                                }
                            );
                        }

                        function recordPurchase() {
                            // Record transaction
                            db.run(
                                'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
                                [userId, 'purchase', -price],
                                (err) => {
                                    if (err) {
                                        console.error('Failed to record transaction:', err);
                                    }
                                    res.json({ 
                                        message: 'Purchase successful',
                                        newBalance 
                                    });
                                }
                            );
                        }
                    }
                );
            }
        );
    });
});

// Shop - Get inventory
app.get('/api/shop/inventory/:userId', (req, res) => {
    const { userId } = req.params;

    db.all(
        'SELECT item_id, item_name, icon, SUM(quantity) as quantity FROM inventory WHERE user_id = ? GROUP BY item_id ORDER BY purchased_at DESC',
        [userId],
        (err, items) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json({ inventory: items });
        }
    );
});

// Race reward
app.post('/api/race-reward', (req, res) => {
    const { userId, diamonds } = req.body;

    if (!userId || !diamonds) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    db.get('SELECT balance FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) {
            return res.status(500).json({ error: 'User not found' });
        }

        const newBalance = user.balance + diamonds;

        db.run(
            'UPDATE users SET balance = ? WHERE id = ?',
            [newBalance, userId],
            (err) => {
                if (err) {
                    return res.status(500).json({ error: 'Failed to update balance' });
                }

                db.run(
                    'INSERT INTO transactions (user_id, type, amount) VALUES (?, ?, ?)',
                    [userId, 'race-reward', diamonds],
                    (err) => {
                        if (err) {
                            console.error('Failed to record transaction:', err);
                        }
                        res.json({ message: 'Reward added', newBalance });
                    }
                );
            }
        );
    });
});

// Start HTTP server (always available)
http.createServer(app).listen(PORT, () => {
    console.log(`🏦 Red Diamond Bank server running on http://localhost:${PORT}`);
    console.log(`💎 Currency: Red Diamonds ◆`);
});

// Start HTTPS server if certificates are provided
if (USE_HTTPS) {
    const sslKeyPath = process.env.SSL_KEY_PATH || './ssl/private.key';
    const sslCertPath = process.env.SSL_CERT_PATH || './ssl/certificate.crt';
    
    try {
        if (fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
            const options = {
                key: fs.readFileSync(sslKeyPath),
                cert: fs.readFileSync(sslCertPath)
            };
            
            https.createServer(options, app).listen(HTTPS_PORT, () => {
                console.log(`🔒 Red Diamond Bank HTTPS server running on https://localhost:${HTTPS_PORT}`);
                console.log(`   Using SSL certificates from: ${sslKeyPath} and ${sslCertPath}`);
            });
        } else {
            console.warn(`⚠️  HTTPS enabled but certificates not found at ${sslKeyPath} and ${sslCertPath}`);
            console.warn(`   Set SSL_KEY_PATH and SSL_CERT_PATH in .env file, or disable HTTPS by setting USE_HTTPS=false`);
        }
    } catch (error) {
        console.error('❌ Error starting HTTPS server:', error.message);
        console.error('   Make sure SSL certificates are in the correct location and readable');
    }
}

// Graceful shutdown
process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        } else {
            console.log('Database connection closed');
        }
        process.exit(0);
    });
});
