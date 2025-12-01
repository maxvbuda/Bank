require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const Stripe = require('stripe');
const https = require('https');
const http = require('http');
const fs = require('fs');

// Initialize Stripe lazily (only when needed and key is provided)
let stripe = null;
function getStripe() {
    if (!stripe && process.env.STRIPE_SECRET_KEY) {
        stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    }
    return stripe;
}

const app = express();
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// Email configuration
// Configure email using environment variables in .env file
// Supports Gmail, GoDaddy, Resend (API), and other SMTP services

let transporter = null;
let resendClient = null;

if (process.env.EMAIL_SERVICE === 'resend' && process.env.EMAIL_PASS) {
    // Resend API configuration (Resend doesn't support SMTP)
    resendClient = new Resend(process.env.EMAIL_PASS);
    console.log('Email service configured (Resend API)');
} else if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // GoDaddy SMTP configuration
    if (process.env.EMAIL_SERVICE === 'godaddy' || process.env.EMAIL_HOST) {
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
    console.warn('Email service not configured. Set EMAIL_SERVICE=resend and EMAIL_PASS, or EMAIL_USER and EMAIL_PASS in .env file to enable email functionality.');
}

// Stripe configuration check
if (process.env.STRIPE_SECRET_KEY) {
    console.log('✅ Stripe payment processing enabled');
} else {
    console.warn('⚠️  Stripe not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY in .env file to enable payment processing.');
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // For webhook form data
app.use(express.static(__dirname));

// Favicon route - serve SVG favicon for .ico requests too
app.get('/favicon.ico', (req, res) => {
    res.sendFile(__dirname + '/favicon.svg');
});

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
        CREATE TABLE IF NOT EXISTS purchases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            diamond_amount INTEGER NOT NULL,
            cost REAL NOT NULL,
            payment_info TEXT,
            purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);
    
    // Add payment_info column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE purchases ADD COLUMN payment_info TEXT`, (err) => {
        // Ignore error if column already exists
    });

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

    db.run(`
        CREATE TABLE IF NOT EXISTS incoming_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_email TEXT NOT NULL,
            to_email TEXT NOT NULL,
            subject TEXT,
            body TEXT,
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS incoming_emails (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_email TEXT NOT NULL,
            to_email TEXT NOT NULL,
            subject TEXT,
            body TEXT,
            received_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS mail (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            from_user_id INTEGER NOT NULL,
            from_username TEXT NOT NULL,
            from_nexmail TEXT NOT NULL,
            to_user_id INTEGER,
            to_username TEXT,
            to_nexmail TEXT NOT NULL,
            subject TEXT NOT NULL,
            body TEXT NOT NULL,
            incognito INTEGER DEFAULT 0,
            sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME,
            FOREIGN KEY (from_user_id) REFERENCES users(id),
            FOREIGN KEY (to_user_id) REFERENCES users(id)
        )
    `);
    
    // Add nexmail columns if they don't exist (for existing databases)
    db.run(`ALTER TABLE mail ADD COLUMN from_nexmail TEXT`, (err) => {
        // Ignore error if column already exists
        if (!err || err.message.includes('duplicate column')) {
            // Migrate existing data from email to nexmail format
            db.run(`UPDATE mail SET from_nexmail = from_username || '◆nexmail.diamond' WHERE from_nexmail IS NULL`, () => {});
        }
    });
    
    db.run(`ALTER TABLE mail ADD COLUMN to_nexmail TEXT`, (err) => {
        // Ignore error if column already exists
        if (!err || err.message.includes('duplicate column')) {
            // Migrate existing data from email to nexmail format
            db.run(`UPDATE mail SET to_nexmail = COALESCE(to_username || '◆nexmail.diamond', to_email) WHERE to_nexmail IS NULL`, () => {});
        }
    });

    // Add incognito column if it doesn't exist (for existing databases)
    db.run(`ALTER TABLE mail ADD COLUMN incognito INTEGER DEFAULT 0`, (err) => {
        if (err && !err.message.includes('duplicate column')) {
            console.error('Error adding incognito column:', err);
        }
    });

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
                    const fromEmail = 'Red Diamond Bank <mail@reddiamondbank.com>';
                    
                    console.log(`From email: ${fromEmail}`);
                    console.log(`To email: ${user.email}`);
                    
                    const emailHtml = `
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
                    `;

                    // Use Resend API if configured, otherwise use SMTP transporter
                    if (resendClient) {
                        try {
                            console.log('Attempting to send email via Resend API...');
                            const { data, error } = await resendClient.emails.send({
                                from: fromEmail,
                                to: user.email,
                                subject: 'Red Diamond Bank - Password Reset',
                                html: emailHtml
                            });
                            
                            if (error) {
                                throw error;
                            }
                            
                            console.log('Temporary password email sent successfully via Resend!');
                            console.log('Email ID:', data?.id);
                        res.json({
                                message: 'Temporary password sent to ' + user.email,
                                emailSent: true,
                            email: user.email
                        });
                    } catch (emailError) {
                            console.error('Resend API email send failed:');
                            console.error('Error:', emailError);
                            res.status(500).json({
                                error: 'Failed to send email. Please check email configuration or contact support.',
                                emailSent: false,
                                emailError: emailError.message || 'Unknown error',
                                email: user.email
                            });
                        }
                    } else if (transporter) {
                        try {
                            console.log('Attempting to send email via SMTP...');
                            const mailOptions = {
                                from: fromEmail,
                                to: user.email,
                                subject: 'Red Diamond Bank - Password Reset',
                                html: emailHtml
                            };
                            const info = await transporter.sendMail(mailOptions);
                            console.log('Temporary password email sent successfully via SMTP!');
                            console.log('Message ID:', info.messageId);
                        res.json({
                                message: 'Temporary password sent to ' + user.email,
                                emailSent: true,
                                email: user.email
                            });
                        } catch (emailError) {
                            console.error('SMTP email send failed:');
                            console.error('Error:', emailError);
                            res.status(500).json({
                                error: 'Failed to send email. Please check email configuration or contact support.',
                                emailSent: false,
                                emailError: emailError.message || 'Unknown error',
                                email: user.email
                            });
                        }
                    } else {
                        console.error('Email service is not configured!');
                        console.error('Check your .env file for EMAIL_SERVICE and EMAIL_PASS');
                        res.status(500).json({
                            error: 'Email service is not configured. Please contact support.',
                            emailSent: false,
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

// Resend Webhooks - Receive email events (bounces, opens, clicks, etc.)
app.post('/api/webhooks/resend', (req, res) => {
    const event = req.body;
    
    console.log('Resend webhook received:', event.type);
    
    // Handle different event types
    switch (event.type) {
        case 'email.sent':
            console.log('Email sent:', event.data);
            break;
        case 'email.delivered':
            console.log('Email delivered:', event.data);
            break;
        case 'email.delivery_delayed':
            console.log('Email delivery delayed:', event.data);
            break;
        case 'email.complained':
            console.log('Email complained (marked as spam):', event.data);
            break;
        case 'email.bounced':
            console.log('Email bounced:', event.data);
            break;
        case 'email.opened':
            console.log('Email opened:', event.data);
            break;
        case 'email.clicked':
            console.log('Email clicked:', event.data);
            break;
        default:
            console.log('Unknown event type:', event.type);
    }
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
});

// Receive incoming emails (via forwarding or email service webhook)
// This endpoint can receive emails forwarded from your email service
app.post('/api/webhooks/incoming-email', (req, res) => {
    try {
        const emailData = req.body;
        
        console.log('Incoming email received:');
        console.log('From:', emailData.from || emailData.sender);
        console.log('To:', emailData.to || emailData.recipient);
        console.log('Subject:', emailData.subject);
        console.log('Body:', emailData.text || emailData.html);
        
        // Process the incoming email
        // You can add logic here to handle different types of emails
        // For example: support requests, password reset requests, etc.
        
        // Store in database if needed
        db.run(
            'INSERT INTO incoming_emails (from_email, to_email, subject, body, received_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [
                emailData.from || emailData.sender,
                emailData.to || emailData.recipient,
                emailData.subject,
                emailData.text || emailData.html || ''
            ],
            (err) => {
                if (err) {
                    console.error('Error storing incoming email:', err);
                } else {
                    console.log('Incoming email stored in database');
                }
            }
        );
        
        res.status(200).json({ received: true, message: 'Email received and processed' });
    } catch (error) {
        console.error('Error processing incoming email:', error);
        res.status(500).json({ error: 'Failed to process email' });
    }
});

// Get received emails
app.get('/api/incoming-emails', (req, res) => {
    db.all(
        'SELECT * FROM incoming_emails ORDER BY received_at DESC LIMIT 50',
        [],
        (err, emails) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch emails' });
            }
            res.json(emails);
        }
    );
});

// Helper function to generate nexmail address with creative format
function generateNexmailAddress(username) {
    // Creative format: username◆nexmail.diamond
    return `${username}◆nexmail.diamond`;
}

// Helper function to parse nexmail address (supports multiple formats)
function parseNexmailAddress(nexmailAddress) {
    if (!nexmailAddress) return '';
    
    // Remove various nexmail formats
    let parsed = nexmailAddress
        .replace(/@nexmail\.diamond$/i, '')
        .replace(/◆nexmail\.diamond$/i, '')
        .replace(/@reddiamondbank\.com$/i, '')
        .replace(/◆/g, '') // Remove diamond symbols
        .replace(/💎/g, '') // Remove diamond emoji
        .trim();
    
    // If it still contains @, extract the part before @
    if (parsed.includes('@')) {
        parsed = parsed.split('@')[0].trim();
    }
    
    return parsed;
}

// Helper function to format nexmail address for display (with styling)
function formatNexmailForDisplay(nexmailAddress) {
    if (!nexmailAddress) return '';
    // Ensure it has the proper format for display
    if (!nexmailAddress.includes('◆') && !nexmailAddress.includes('@')) {
        return `${nexmailAddress}◆nexmail.diamond`;
    }
    return nexmailAddress;
}

// Nexmail Service - Send Nexmail
app.post('/api/mail/send', async (req, res) => {
    const { userId, to, subject, body, incognito } = req.body;

    if (!userId || !to || !subject || !body) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const isIncognito = incognito === true || incognito === 1 || incognito === 'true';

    // Get sender info
    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, sender) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!sender) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Parse nexmail address - extract username
        const recipientUsername = parseNexmailAddress(to);

        // Find recipient by username (nexmail addresses are based on username)
        db.get('SELECT * FROM users WHERE username = ?', [recipientUsername], async (err, recipient) => {
            if (err) {
                return res.status(500).json({ error: 'Server error' });
            }

            if (!recipient) {
                return res.status(404).json({ error: `Nexmail address not found: ${to}. User must be registered in the system.` });
            }

            const senderNexmail = generateNexmailAddress(sender.username);
            const recipientNexmail = generateNexmailAddress(recipient.username);

            // Store nexmail in database (internal system only - no external email sending)
            db.run(
                'INSERT INTO mail (from_user_id, from_username, from_nexmail, to_user_id, to_username, to_nexmail, subject, body, incognito) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [userId, sender.username, senderNexmail, recipient.id, recipient.username, recipientNexmail, subject, body, isIncognito ? 1 : 0],
                (err) => {
                    if (err) {
                        console.error('Error storing nexmail:', err);
                        return res.status(500).json({ error: 'Failed to send nexmail' });
                    }

                    console.log(`Nexmail sent from ${senderNexmail} to ${recipientNexmail}`);
                    res.json({ message: 'Nexmail sent successfully!', emailSent: true });
                }
            );
        });
    });
});

// Get Inbox (Nexmail)
app.get('/api/mail/inbox', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    db.all(
        `SELECT m.*, u.username as from_username 
         FROM mail m 
         LEFT JOIN users u ON m.from_user_id = u.id 
         WHERE m.to_user_id = ? OR m.to_nexmail = (SELECT username || '◆nexmail.diamond' FROM users WHERE id = ?)
         ORDER BY m.sent_at DESC`,
        [userId, userId],
        (err, emails) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch inbox' });
            }
            res.json(emails);
        }
    );
});

// Get Stripe publishable key
app.get('/api/stripe-config', (req, res) => {
    const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
        return res.status(200).json({ 
            publishableKey: null,
            configured: false,
            error: 'Stripe not configured. Please set STRIPE_PUBLISHABLE_KEY in .env file.'
        });
    }
    res.json({ 
        publishableKey: publishableKey,
        configured: true
    });
});

// Create Stripe Payment Intent
app.post('/api/create-payment-intent', async (req, res) => {
    const { userId, amount, cost } = req.body;

    if (!userId || !amount || !cost) {
        return res.status(400).json({ error: 'User ID, amount, and cost are required' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Amount must be at least 1 diamond' });
    }

    const expectedCost = amount * 0.50;
    if (Math.abs(cost - expectedCost) > 0.01) {
        return res.status(400).json({ error: 'Invalid cost calculation' });
    }

    // Verify user exists
    db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return res.status(500).json({ error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in .env' });
        }

        try {
            const stripeClient = getStripe();
            if (!stripeClient) {
                return res.status(500).json({ error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in .env' });
            }
            
            // Create payment intent in cents
            const paymentIntent = await stripeClient.paymentIntents.create({
                amount: Math.round(cost * 100), // Convert to cents
                currency: 'usd',
                metadata: {
                    userId: userId.toString(),
                    diamondAmount: amount.toString(),
                    username: user.username
                }
            });

            res.json({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            });
        } catch (error) {
            console.error('Stripe error:', error);
            let errorMessage = 'Failed to create payment intent: ' + error.message;
            
            // Provide more helpful error messages
            if (error.type === 'StripeAuthenticationError') {
                errorMessage = 'Invalid Stripe API key. Please check your STRIPE_SECRET_KEY in the .env file. Make sure you copied the full key from your Stripe Dashboard (https://dashboard.stripe.com/test/apikeys) without any extra spaces or characters.';
            } else if (error.type === 'StripeInvalidRequestError') {
                errorMessage = 'Stripe request error: ' + error.message;
            }
            
            res.status(500).json({ error: errorMessage });
        }
    });
});

// Confirm Payment and Complete Purchase (after Stripe payment succeeds)
app.post('/api/confirm-payment', async (req, res) => {
    const { userId, amount, cost, paymentIntentId } = req.body;

    if (!userId || !amount || !cost || !paymentIntentId) {
        return res.status(400).json({ error: 'User ID, amount, cost, and payment intent ID are required' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Amount must be at least 1 diamond' });
    }

    const expectedCost = amount * 0.50;
    if (Math.abs(cost - expectedCost) > 0.01) {
        return res.status(400).json({ error: 'Invalid cost calculation' });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
        return res.status(500).json({ error: 'Stripe not configured' });
    }

    try {
        const stripeClient = getStripe();
        if (!stripeClient) {
            return res.status(500).json({ error: 'Stripe not configured. Please set STRIPE_SECRET_KEY in .env' });
        }
        
        // Verify payment intent with Stripe
        const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId);
        
        if (paymentIntent.status !== 'succeeded') {
            return res.status(400).json({ error: 'Payment not completed. Status: ' + paymentIntent.status });
        }

        // Verify the payment matches the request
        if (paymentIntent.metadata.userId !== userId.toString() || 
            parseInt(paymentIntent.metadata.diamondAmount) !== amount) {
            return res.status(400).json({ error: 'Payment verification failed' });
        }

        // Get user
        db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
            if (err) {
                return res.status(500).json({ error: 'Server error' });
            }

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            // Record purchase with payment info
            const paymentInfo = {
                paymentIntentId: paymentIntentId,
                stripeChargeId: paymentIntent.charges.data[0]?.id || null,
                amountPaid: paymentIntent.amount / 100,
                currency: paymentIntent.currency,
                status: 'succeeded'
            };

            db.run(
                'INSERT INTO purchases (user_id, diamond_amount, cost, payment_info) VALUES (?, ?, ?, ?)',
                [userId, amount, cost, JSON.stringify(paymentInfo)],
                (err) => {
                    if (err) {
                        console.error('Error recording purchase:', err);
                        return res.status(500).json({ error: 'Failed to record purchase' });
                    }

                    // Update user balance
                    const newBalance = user.balance + amount;
                    db.run(
                        'UPDATE users SET balance = ? WHERE id = ?',
                        [newBalance, userId],
                        (err) => {
                            if (err) {
                                console.error('Error updating balance:', err);
                                return res.status(500).json({ error: 'Failed to update balance' });
                            }

                            // Record transaction
                            db.run(
                                'INSERT INTO transactions (user_id, type, amount, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                                [userId, 'purchase', amount],
                                (err) => {
                                    if (err) {
                                        console.error('Error recording transaction:', err);
                                    }
                                    
                                    console.log(`Purchase completed: User ${userId} bought ${amount} diamonds for $${cost.toFixed(2)} (Stripe: ${paymentIntentId})`);
                                    res.json({ 
                                        message: 'Purchase successful', 
                                        newBalance: newBalance,
                                        diamondsPurchased: amount
                                    });
                                }
                            );
                        }
                    );
                }
            );
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({ error: 'Payment verification failed: ' + error.message });
    }
});

// Purchase Red Diamonds (Old endpoint - kept for backwards compatibility, but requires Stripe)
app.post('/api/purchase-diamonds', (req, res) => {
    const { userId, amount, cost, paymentInfo } = req.body;

    if (!userId || !amount || !cost) {
        return res.status(400).json({ error: 'User ID, amount, and cost are required' });
    }

    if (!paymentInfo || !paymentInfo.cardLast4 || !paymentInfo.cardName || !paymentInfo.billingAddress) {
        return res.status(400).json({ error: 'Payment information is required' });
    }

    if (amount < 1) {
        return res.status(400).json({ error: 'Amount must be at least 1 diamond' });
    }

    const expectedCost = amount * 0.50;
    if (Math.abs(cost - expectedCost) > 0.01) {
        return res.status(400).json({ error: 'Invalid cost calculation' });
    }

    // Get user
    db.get('SELECT * FROM users WHERE id = ?', [userId], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Record purchase with payment info
        db.run(
            'INSERT INTO purchases (user_id, diamond_amount, cost, payment_info) VALUES (?, ?, ?, ?)',
            [userId, amount, cost, JSON.stringify(paymentInfo)],
            (err) => {
                if (err) {
                    console.error('Error recording purchase:', err);
                    return res.status(500).json({ error: 'Failed to record purchase' });
                }

                // Update user balance
                const newBalance = user.balance + amount;
                db.run(
                    'UPDATE users SET balance = ? WHERE id = ?',
                    [newBalance, userId],
                    (err) => {
                        if (err) {
                            console.error('Error updating balance:', err);
                            return res.status(500).json({ error: 'Failed to update balance' });
                        }

                        // Record transaction
                        db.run(
                            'INSERT INTO transactions (user_id, type, amount, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
                            [userId, 'purchase', amount],
                            (err) => {
                                if (err) {
                                    console.error('Error recording transaction:', err);
                                }
                                
                                console.log(`Purchase: User ${userId} bought ${amount} diamonds for $${cost.toFixed(2)}`);
                                res.json({ 
                                    message: 'Purchase successful', 
                                    newBalance: newBalance,
                                    diamondsPurchased: amount
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

// Get Sent Mail (Nexmail)
app.get('/api/mail/sent', (req, res) => {
    const userId = req.query.userId;

    if (!userId) {
        return res.status(400).json({ error: 'User ID required' });
    }

    db.all(
        `SELECT m.*, u.username as to_username 
         FROM mail m 
         LEFT JOIN users u ON m.to_user_id = u.id 
         WHERE m.from_user_id = ?
         ORDER BY m.sent_at DESC`,
        [userId],
        (err, emails) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch sent mail' });
            }
            res.json(emails);
        }
    );
});

// Start HTTP server (always available)
http.createServer(app).listen(PORT, () => {
    console.log(`🏦 Red Diamond Bank server running on http://localhost:${PORT}`);
    console.log(`💎 Currency: Red Diamonds ◆`);
});

// Resend Webhooks - Receive email events (bounces, opens, clicks, etc.)
app.post('/api/webhooks/resend', (req, res) => {
    const event = req.body;
    
    console.log('Resend webhook received:', event.type);
    
    // Handle different event types
    switch (event.type) {
        case 'email.sent':
            console.log('Email sent:', event.data);
            break;
        case 'email.delivered':
            console.log('Email delivered:', event.data);
            break;
        case 'email.delivery_delayed':
            console.log('Email delivery delayed:', event.data);
            break;
        case 'email.complained':
            console.log('Email complained (marked as spam):', event.data);
            break;
        case 'email.bounced':
            console.log('Email bounced:', event.data);
            break;
        case 'email.opened':
            console.log('Email opened:', event.data);
            break;
        case 'email.clicked':
            console.log('Email clicked:', event.data);
            break;
        default:
            console.log('Unknown event type:', event.type);
    }
    
    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
});

// Receive incoming emails (via forwarding or email service webhook)
// This endpoint can receive emails forwarded from your email service
app.post('/api/webhooks/incoming-email', (req, res) => {
    try {
        const emailData = req.body;
        
        console.log('Incoming email received:');
        console.log('From:', emailData.from || emailData.sender);
        console.log('To:', emailData.to || emailData.recipient);
        console.log('Subject:', emailData.subject);
        console.log('Body:', emailData.text || emailData.html);
        
        // Process the incoming email
        // You can add logic here to handle different types of emails
        // For example: support requests, password reset requests, etc.
        
        // Store in database if needed
        db.run(
            'INSERT INTO incoming_emails (from_email, to_email, subject, body, received_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)',
            [
                emailData.from || emailData.sender,
                emailData.to || emailData.recipient,
                emailData.subject,
                emailData.text || emailData.html || ''
            ],
            (err) => {
                if (err) {
                    console.error('Error storing incoming email:', err);
                } else {
                    console.log('Incoming email stored in database');
                }
            }
        );
        
        res.status(200).json({ received: true, message: 'Email received and processed' });
    } catch (error) {
        console.error('Error processing incoming email:', error);
        res.status(500).json({ error: 'Failed to process email' });
    }
});

// Get received emails
app.get('/api/incoming-emails', (req, res) => {
    db.all(
        'SELECT * FROM incoming_emails ORDER BY received_at DESC LIMIT 50',
        [],
        (err, emails) => {
            if (err) {
                return res.status(500).json({ error: 'Failed to fetch emails' });
            }
            res.json(emails);
        }
    );
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
