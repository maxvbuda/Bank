/**
 * mongo-banking.js
 *
 * Replaces the SQLite-backed register / login / balance / transfer /
 * transactions routes with MongoDB equivalents so the website shares
 * the same database as the Red Diamond Bank mobile and desktop apps.
 *
 * Mounted by server.js before the old SQLite routes — Express will use
 * the first matching handler, so these take precedence.
 *
 * User IDs returned to the browser are the MongoDB usernames (strings).
 * The website's app.js stores them in localStorage as `userId`, and
 * every subsequent call passes that value back — so userId === username.
 */

const express  = require('express');
const bcrypt   = require('bcrypt');
const mongoose = require('mongoose');

const router = express.Router();

// ── Schema (mirrors reddiamondbank-api exactly) ───────────────────────────────

let User, Transaction;

function initModels() {
    if (mongoose.models.User) {
        User        = mongoose.model('User');
        Transaction = mongoose.model('Transaction');
        return;
    }

    const userSchema = new mongoose.Schema({
        username:           { type: String, required: true, unique: true, lowercase: true, trim: true },
        email:              { type: String, required: true, unique: true, lowercase: true, trim: true },
        passwordHash:       { type: String, required: true },
        accountNumber:      { type: String, required: true, unique: true },
        balance:            { type: Number, required: true, default: 1000, min: 0 },
        isVerified:         { type: Boolean, default: false },
        verificationCode:   { type: String, default: null },
        verificationExpiry: { type: Date,   default: null },
    }, { timestamps: true });

    const txSchema = new mongoose.Schema({
        fromUser: { type: String, required: true, index: true },
        toUser:   { type: String, required: true, index: true },
        amount:   { type: Number, required: true, min: 0 },
        note:     { type: String, default: '' },
    }, { timestamps: { createdAt: true, updatedAt: false } });

    User        = mongoose.model('User',        userSchema);
    Transaction = mongoose.model('Transaction', txSchema);
}

// ── Connect to MongoDB ────────────────────────────────────────────────────────

async function connectMongo() {
    if (mongoose.connection.readyState !== 0) return; // already connected/connecting
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('⚠️  MONGODB_URI not set — mongo-banking routes will not work.');
        return;
    }
    await mongoose.connect(uri);
    initModels();
    console.log('🍃 mongo-banking connected to MongoDB');
}

connectMongo().catch(err => console.error('mongo-banking connect error:', err));

// ── Helpers ───────────────────────────────────────────────────────────────────

async function nextAccountNumber() {
    const count = await User.estimatedDocumentCount();
    return `RDB${String(count + 1).padStart(9, '0')}`;
}

function toPublic(user) {
    return {
        id:            user.username,   // website stores this as userId
        username:      user.username,
        email:         user.email,
        balance:       user.balance,
        accountNumber: user.accountNumber,
        isVerified:    user.isVerified,
    };
}

// ── Routes ────────────────────────────────────────────────────────────────────

// POST /api/register
router.post('/register', async (req, res) => {
    try {
        const { username, password, email } = req.body || {};
        if (!username || !password || !email) {
            return res.status(400).json({ error: 'All fields are required' });
        }
        if (String(password).length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const exists = await User.findOne({ username: username.toLowerCase() });
        if (exists) return res.status(400).json({ error: 'Username already exists' });

        const emailExists = await User.findOne({ email: email.toLowerCase() });
        if (emailExists) return res.status(400).json({ error: 'Email already registered' });

        const user = await User.create({
            username,
            email,
            passwordHash:  await bcrypt.hash(password, 10),
            accountNumber: await nextAccountNumber(),
            balance:       1000,
            isVerified:    false,
        });

        return res.status(201).json({
            message: 'User registered successfully',
            userId:  user.username,   // string — mirrors mobile app
            user:    toPublic(user),
        });
    } catch (err) {
        if (err?.code === 11000) return res.status(400).json({ error: 'Username already exists' });
        console.error('register error:', err);
        return res.status(500).json({ error: 'Registration failed' });
    }
});

// POST /api/login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body || {};
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Invalid username or password' });

        return res.json({
            message: 'Login successful',
            userId:  user.username,
            user:    toPublic(user),
        });
    } catch (err) {
        console.error('login error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/balance/:userId   (userId is username)
router.get('/balance/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.userId.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json({ balance: user.balance, accountNumber: user.accountNumber });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/profile/:userId
router.get('/profile/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.userId.toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json(toPublic(user));
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/transfer
router.post('/transfer', async (req, res) => {
    try {
        const { fromUserId, toUsername, amount, note } = req.body || {};
        const amt = Number(amount);

        if (!fromUserId || !toUsername || !amt || amt <= 0) {
            return res.status(400).json({ error: 'Invalid request' });
        }

        const toUser = toUsername.toLowerCase();
        const fromUser = String(fromUserId).toLowerCase();

        if (fromUser === toUser) {
            return res.status(400).json({ error: 'Cannot transfer to yourself' });
        }

        const recipient = await User.findOne({ username: toUser });
        if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

        // Atomic debit — only succeeds if balance is sufficient
        const sender = await User.findOneAndUpdate(
            { username: fromUser, balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true }
        );
        if (!sender) return res.status(400).json({ error: 'Insufficient funds' });

        await User.updateOne({ username: toUser }, { $inc: { balance: amt } });

        await Transaction.create({
            fromUser,
            toUser,
            amount: amt,
            note:   note || '',
        });

        return res.json({ message: 'Transfer successful', balance: sender.balance });
    } catch (err) {
        console.error('transfer error:', err);
        return res.status(500).json({ error: 'Transfer failed' });
    }
});

// GET /api/transactions/:userId
router.get('/transactions/:userId', async (req, res) => {
    try {
        const me = req.params.userId.toLowerCase();
        const txns = await Transaction.find({ $or: [{ fromUser: me }, { toUser: me }] })
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();

        // Format to match what the website's app.js expects
        const formatted = txns.map(t => ({
            id:         t._id.toString(),
            type:       t.fromUser === me ? 'transfer-sent' : 'transfer-received',
            amount:     t.amount,
            note:       t.note,
            created_at: t.createdAt,
            other_user: t.fromUser === me ? t.toUser : t.fromUser,
        }));

        return res.json({ transactions: formatted });
    } catch (err) {
        console.error('transactions error:', err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/change-password
router.post('/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body || {};
        const user = await User.findOne({ username: String(userId).toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const ok = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });

        if (String(newPassword).length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        user.passwordHash = await bcrypt.hash(newPassword, 10);
        await user.save();
        return res.json({ message: 'Password changed successfully' });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/delete-account
router.delete('/delete-account', async (req, res) => {
    try {
        const { userId, password } = req.body || {};
        const user = await User.findOne({ username: String(userId).toLowerCase() });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return res.status(401).json({ error: 'Incorrect password' });

        await User.deleteOne({ username: user.username });
        return res.json({ message: 'Account deleted' });
    } catch (err) {
        return res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/users/search (same as Render API)
router.get('/users/search', async (req, res) => {
    try {
        const q = String(req.query.q || '').trim().toLowerCase();
        if (!q) return res.json({ users: [] });

        const users = await User.find({
            username: { $regex: `^${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, $options: 'i' },
        })
        .select('username accountNumber')
        .limit(10)
        .lean();

        return res.json({ users });
    } catch (err) {
        return res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;
