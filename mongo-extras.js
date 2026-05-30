/**
 * mongo-extras.js
 * Replaces the SQLite-backed mail, shop/inventory, mine, withdraw, and
 * race-reward routes with MongoDB equivalents.
 * Mounted in server.js BEFORE the old SQLite routes.
 * userId values passed from the browser are usernames (strings) — set by
 * mongo-banking.js which returns username as the userId on login/register.
 */
const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

// ── Re-use the User model registered by mongo-banking.js ─────────────────────
function User() { return mongoose.model('User'); }

// ── Mail schema ───────────────────────────────────────────────────────────────
const mailSchema = new mongoose.Schema({
    fromUserId:   String,
    fromUsername: String,
    fromNexmail:  String,
    toUserId:     String,
    toUsername:   String,
    toNexmail:    String,
    subject:      { type: String, default: '' },
    body:         { type: String, default: '' },
    incognito:    { type: Boolean, default: false },
    read:         { type: Boolean, default: false },
}, { timestamps: { createdAt: 'sent_at', updatedAt: false } });

const Mail = mongoose.models.Mail || mongoose.model('Mail', mailSchema);

// ── Inventory schema ──────────────────────────────────────────────────────────
const inventorySchema = new mongoose.Schema({
    userId:   { type: String, required: true, index: true },
    itemId:   { type: String, required: true },
    itemName: { type: String, required: true },
    icon:     { type: String, default: '💎' },
    quantity: { type: Number, default: 1 },
}, { timestamps: { createdAt: 'purchased_at', updatedAt: false } });

const Inventory = mongoose.models.Inventory || mongoose.model('Inventory', inventorySchema);

// ── Transaction model (same as API server) ────────────────────────────────────
const txSchema = new mongoose.Schema({
    fromUser: { type: String, required: true },
    toUser:   { type: String, required: true },
    amount:   { type: Number, required: true },
    note:     { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false } });

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', txSchema);

// ── Helper ────────────────────────────────────────────────────────────────────
function nexmail(username) {
    return `${String(username).toLowerCase()}@mail.reddiamondbank.com`;
}
function parseNexmail(address) {
    return String(address || '').toLowerCase().replace('@mail.reddiamondbank.com', '');
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIL
// ─────────────────────────────────────────────────────────────────────────────

router.post('/mail/send', async (req, res) => {
    try {
        const { userId, to, subject, body, incognito } = req.body || {};
        if (!userId || !to || !subject || !body)
            return res.status(400).json({ error: 'All fields are required' });

        const sender = await User().findOne({ username: String(userId).toLowerCase() });
        if (!sender) return res.status(404).json({ error: 'User not found' });

        const recipientUsername = parseNexmail(to);
        const recipient = await User().findOne({ username: recipientUsername });
        if (!recipient)
            return res.status(404).json({ error: `Address not found: ${to}. The user must be registered.` });

        const isIncognito   = incognito === true || incognito === 1 || incognito === 'true';
        const senderAddr    = nexmail(sender.username);
        const recipientAddr = nexmail(recipient.username);

        await Mail.create({
            fromUserId:   sender.username,
            fromUsername: sender.username,
            fromNexmail:  senderAddr,
            toUserId:     recipient.username,
            toUsername:   recipient.username,
            toNexmail:    recipientAddr,
            subject,
            body,
            incognito: isIncognito,
        });

        res.json({ message: 'Email sent!', emailSent: true });
    } catch (err) {
        console.error('mail/send error:', err);
        res.status(500).json({ error: 'Failed to send email' });
    }
});

router.get('/mail/inbox', async (req, res) => {
    try {
        const userId = String(req.query.userId || '').toLowerCase();
        if (!userId) return res.status(400).json({ error: 'User ID required' });

        const mails = await Mail.find({ toUserId: userId })
            .sort({ sent_at: -1 })
            .lean();

        // Shape to match what app.js expects
        const shaped = mails.map(m => ({
            id:           m._id.toString(),
            from_user_id: m.fromUserId,
            from_username: m.incognito ? null : m.fromUsername,
            from_nexmail:  m.incognito ? 'Anonymous' : m.fromNexmail,
            to_user_id:   m.toUserId,
            to_username:  m.toUsername,
            to_nexmail:   m.toNexmail,
            subject:      m.subject,
            body:         m.body,
            incognito:    m.incognito ? 1 : 0,
            sent_at:      m.sent_at,
            read:         m.read,
        }));

        res.json(shaped);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch inbox' });
    }
});

router.get('/mail/sent', async (req, res) => {
    try {
        const userId = String(req.query.userId || '').toLowerCase();
        const mails = await Mail.find({ fromUserId: userId })
            .sort({ sent_at: -1 })
            .lean();

        const shaped = mails.map(m => ({
            id:           m._id.toString(),
            from_nexmail: m.fromNexmail,
            to_nexmail:   m.toNexmail,
            to_username:  m.toUsername,
            subject:      m.subject,
            body:         m.body,
            incognito:    m.incognito ? 1 : 0,
            sent_at:      m.sent_at,
        }));

        res.json(shaped);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sent mail' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// SHOP / INVENTORY
// ─────────────────────────────────────────────────────────────────────────────

router.post('/shop/buy', async (req, res) => {
    try {
        const { userId, itemId, itemName, price, icon } = req.body || {};
        const amt = Number(price);
        if (!userId || !itemId || !itemName || !amt)
            return res.status(400).json({ error: 'Missing required fields' });

        // Atomic balance deduct
        const user = await User().findOneAndUpdate(
            { username: String(userId).toLowerCase(), balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true }
        );
        if (!user) return res.status(400).json({ error: 'Insufficient Red Diamonds' });

        // Upsert inventory
        await Inventory.findOneAndUpdate(
            { userId: user.username, itemId },
            { $inc: { quantity: 1 }, $setOnInsert: { itemName, icon: icon || '💎' } },
            { upsert: true }
        );

        await Transaction.create({
            fromUser: user.username,
            toUser:   'shop',
            amount:   amt,
            note:     `Purchased ${itemName}`,
        });

        res.json({ message: 'Purchase successful', newBalance: user.balance });
    } catch (err) {
        console.error('shop/buy error:', err);
        res.status(500).json({ error: 'Purchase failed' });
    }
});

router.get('/shop/inventory/:userId', async (req, res) => {
    try {
        const items = await Inventory.find({
            userId: req.params.userId.toLowerCase()
        }).sort({ purchased_at: -1 }).lean();

        res.json({
            inventory: items.map(i => ({
                item_id:   i.itemId,
                item_name: i.itemName,
                icon:      i.icon,
                quantity:  i.quantity,
            }))
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load inventory' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// MINE / WITHDRAW / RACE-REWARD
// ─────────────────────────────────────────────────────────────────────────────

router.post('/mine', async (req, res) => {
    try {
        const { userId, amount } = req.body || {};
        const amt = Number(amount);
        if (!userId || !amt || amt <= 0 || amt > 30)
            return res.status(400).json({ error: 'Invalid request' });

        const user = await User().findOneAndUpdate(
            { username: String(userId).toLowerCase() },
            { $inc: { balance: amt } },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        await Transaction.create({ fromUser: 'mine', toUser: user.username, amount: amt, note: 'Mining reward' });
        res.json({ message: 'Mining successful', balance: user.balance });
    } catch (err) {
        res.status(500).json({ error: 'Mining failed' });
    }
});

router.post('/withdraw', async (req, res) => {
    try {
        const { userId, amount } = req.body || {};
        const amt = Number(amount);
        if (!userId || !amt || amt <= 0)
            return res.status(400).json({ error: 'Invalid request' });

        const user = await User().findOneAndUpdate(
            { username: String(userId).toLowerCase(), balance: { $gte: amt } },
            { $inc: { balance: -amt } },
            { new: true }
        );
        if (!user) return res.status(400).json({ error: 'Insufficient funds' });

        await Transaction.create({ fromUser: user.username, toUser: 'withdrawal', amount: amt, note: 'Withdrawal' });
        res.json({ message: 'Withdrawal successful', balance: user.balance });
    } catch (err) {
        res.status(500).json({ error: 'Withdrawal failed' });
    }
});

router.post('/race-reward', async (req, res) => {
    try {
        const { userId, diamonds } = req.body || {};
        const amt = Number(diamonds);
        if (!userId || !amt || amt <= 0 || amt > 100)
            return res.status(400).json({ error: 'Invalid reward' });

        const user = await User().findOneAndUpdate(
            { username: String(userId).toLowerCase() },
            { $inc: { balance: amt } },
            { new: true }
        );
        if (!user) return res.status(404).json({ error: 'User not found' });

        await Transaction.create({ fromUser: 'race-reward', toUser: user.username, amount: amt, note: 'Race reward' });
        res.json({ message: 'Reward added', newBalance: user.balance });
    } catch (err) {
        res.status(500).json({ error: 'Reward failed' });
    }
});

module.exports = router;
