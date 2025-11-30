// Frontend JavaScript for Red Diamond Bank

class BankApp {
    constructor() {
        this.currentUser = null;
        this.initializeEventListeners();
        this.checkSession();
    }

    initializeEventListeners() {
        // Tab switching
        document.getElementById('loginTab').addEventListener('click', () => this.switchTab('login'));
        document.getElementById('registerTab').addEventListener('click', () => this.switchTab('register'));

        // Auth forms
        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));

        // Banking operations
        document.getElementById('withdrawForm').addEventListener('submit', (e) => this.handleWithdraw(e));
        document.getElementById('transferForm').addEventListener('submit', (e) => this.handleTransfer(e));

        // Logout
        document.getElementById('logoutBtn').addEventListener('click', () => this.handleLogout());
        
        // Delete account
        document.getElementById('deleteAccountBtn').addEventListener('click', () => this.handleDeleteAccount());
        
        // Change password
        document.getElementById('changePasswordBtn').addEventListener('click', () => this.showChangePasswordModal());
        document.getElementById('closeChangePasswordBtn').addEventListener('click', () => this.closeChangePasswordModal());
        document.getElementById('closeChangePasswordBtn2').addEventListener('click', () => this.closeChangePasswordModal());
        document.getElementById('changePasswordForm').addEventListener('submit', (e) => this.handleChangePassword(e));
        
        // Shop
        document.getElementById('shopBtn').addEventListener('click', () => this.showShop());
        document.getElementById('closeShopBtn').addEventListener('click', () => this.closeShop());
        
        // Mail
        document.getElementById('mailBtn').addEventListener('click', () => this.showMail());
        document.getElementById('closeMailBtn').addEventListener('click', () => this.closeMail());
        document.getElementById('composeMailBtn').addEventListener('click', () => this.showComposeView());
        document.getElementById('inboxMailBtn').addEventListener('click', () => this.showInboxView());
        document.getElementById('sentMailBtn').addEventListener('click', () => this.showSentView());
        document.getElementById('composeMailForm').addEventListener('submit', (e) => this.handleSendMail(e));
        document.getElementById('cancelComposeBtn').addEventListener('click', () => this.showInboxView());
        
        // Test mode
        document.getElementById('testModeBtn').addEventListener('click', () => this.toggleTestMode());
        
        // Forgot password
        document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForgotPasswordModal();
        });
        document.getElementById('closeModalBtn').addEventListener('click', () => this.closeForgotPasswordModal());
        document.getElementById('closeModalBtn2').addEventListener('click', () => this.closeForgotPasswordModal());
        document.getElementById('forgotPasswordForm').addEventListener('submit', (e) => this.handleForgotPassword(e));
    }

    switchTab(tab) {
        const loginTab = document.getElementById('loginTab');
        const registerTab = document.getElementById('registerTab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        if (tab === 'login') {
            loginTab.classList.add('active');
            registerTab.classList.remove('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            registerTab.classList.add('active');
            loginTab.classList.remove('active');
            registerForm.style.display = 'block';
            loginForm.style.display = 'none';
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const username = document.getElementById('registerUsername').value;
        const password = document.getElementById('registerPassword').value;
        const email = document.getElementById('registerEmail').value;

        try {
            const response = await fetch('http://localhost:3000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, email })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Registration successful! Please login.', 'success');
                this.switchTab('login');
                document.getElementById('registerForm').reset();
            } else {
                this.showNotification(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;

        try {
            const response = await fetch('http://localhost:3000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentUser = data.user;
                localStorage.setItem('userId', data.user.id);
                localStorage.setItem('username', data.user.username);
                this.showDashboard();
                this.showNotification('Welcome back, ' + data.user.username + '!', 'success');
                document.getElementById('loginForm').reset();
            } else {
                this.showNotification(data.error || 'Login failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async handleWithdraw(e) {
        e.preventDefault();
        const amount = parseFloat(document.getElementById('withdrawAmount').value);

        if (amount <= 0) {
            this.showNotification('Amount must be positive', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: localStorage.getItem('userId'),
                    amount 
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateBalance(data.balance);
                this.loadTransactions();
                this.showNotification(`Withdrew ${amount} ◆ Red Diamonds`, 'success');
                document.getElementById('withdrawForm').reset();
            } else {
                this.showNotification(data.error || 'Withdrawal failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async handleTransfer(e) {
        e.preventDefault();
        const recipient = document.getElementById('transferRecipient').value;
        const amount = parseFloat(document.getElementById('transferAmount').value);

        if (amount <= 0) {
            this.showNotification('Amount must be positive', 'error');
            return;
        }

        if (recipient === localStorage.getItem('username')) {
            this.showNotification('Cannot transfer to yourself', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    fromUserId: localStorage.getItem('userId'),
                    toUsername: recipient,
                    amount 
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateBalance(data.balance);
                this.loadTransactions();
                this.showNotification(`Transferred ${amount} ◆ to ${recipient}`, 'success');
                document.getElementById('transferForm').reset();
            } else {
                this.showNotification(data.error || 'Transfer failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async checkSession() {
        const userId = localStorage.getItem('userId');
        const username = localStorage.getItem('username');

        if (userId && username) {
            try {
                const response = await fetch(`http://localhost:3000/api/balance/${userId}`);
                const data = await response.json();

                if (response.ok) {
                    this.currentUser = { id: userId, username: username };
                    this.showDashboard();
                } else {
                    localStorage.clear();
                }
            } catch (error) {
                console.log('Session check failed - server may not be ready yet');
                localStorage.clear();
            }
        }
    }

    async showDashboard() {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        document.getElementById('userName').textContent = localStorage.getItem('username');
        document.getElementById('logoutBtn').style.display = 'block';
        document.getElementById('deleteAccountBtn').style.display = 'block';
        document.getElementById('changePasswordBtn').style.display = 'block';
        document.getElementById('shopBtn').style.display = 'block';
        document.getElementById('mailBtn').style.display = 'block';
        document.getElementById('testModeBtn').style.display = 'block';

        await this.loadBalance();
        await this.loadTransactions();
        await this.loadInventory();
        this.initializeGame();
        this.initializeHeistGame();
    }

    async loadBalance() {
        try {
            const response = await fetch(`http://localhost:3000/api/balance/${localStorage.getItem('userId')}`);
            const data = await response.json();

            if (response.ok) {
                this.updateBalance(data.balance);
            }
        } catch (error) {
            console.error('Failed to load balance');
        }
    }

    updateBalance(balance) {
        document.getElementById('balanceAmount').textContent = balance.toFixed(2);
    }

    async loadTransactions() {
        try {
            const response = await fetch(`http://localhost:3000/api/transactions/${localStorage.getItem('userId')}`);
            const data = await response.json();

            if (response.ok) {
                this.displayTransactions(data.transactions);
            }
        } catch (error) {
            console.error('Failed to load transactions');
        }
    }

    displayTransactions(transactions) {
        const transactionList = document.getElementById('transactionList');

        if (!transactions || transactions.length === 0) {
            transactionList.innerHTML = '<p class="no-transactions">No transactions yet</p>';
            return;
        }

        transactionList.innerHTML = transactions.map(tx => {
            const date = new Date(tx.timestamp).toLocaleString();
            let typeClass = tx.type;
            let amountClass = 'positive';
            let amountText = `+${tx.amount.toFixed(2)} ◆`;
            let info = '';

            if (tx.type === 'mine') {
                info = 'Mined from game';
            } else if (tx.type === 'deposit') {
                info = 'Deposit to account';
            } else if (tx.type === 'withdraw') {
                typeClass = 'withdraw';
                amountClass = 'negative';
                amountText = `-${tx.amount.toFixed(2)} ◆`;
                info = 'Withdrawal from account';
            } else if (tx.type === 'transfer-sent') {
                typeClass = 'transfer-sent';
                amountClass = 'negative';
                amountText = `-${tx.amount.toFixed(2)} ◆`;
                info = `Sent to ${tx.recipientUsername}`;
            } else if (tx.type === 'transfer-received') {
                typeClass = 'transfer-received';
                info = `Received from ${tx.senderUsername}`;
            }

            return `
                <div class="transaction-item ${typeClass}">
                    <div class="transaction-details">
                        <div class="transaction-type">${tx.type.replace('-', ' ')}</div>
                        <div class="transaction-info">${info} - ${date}</div>
                    </div>
                    <div class="transaction-amount ${amountClass}">
                        ${amountText}
                    </div>
                </div>
            `;
        }).join('');
    }

    handleLogout() {
        localStorage.clear();
        this.currentUser = null;
        this.testMode = false;
        document.getElementById('authSection').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
        document.getElementById('logoutBtn').style.display = 'none';
        document.getElementById('deleteAccountBtn').style.display = 'none';
        document.getElementById('changePasswordBtn').style.display = 'none';
        document.getElementById('shopBtn').style.display = 'none';
        document.getElementById('testModeBtn').style.display = 'none';
        document.getElementById('userName').textContent = 'Guest';
        this.showNotification('Logged out successfully', 'info');
    }

    async handleDeleteAccount() {
        const username = localStorage.getItem('username');
        console.log('Delete account clicked for user:', username);
        
        const confirmed = confirm(`Are you sure you want to delete your account "${username}"? This action cannot be undone and you will lose all your Red Diamonds.`);
        
        if (!confirmed) {
            console.log('User cancelled first confirmation');
            return;
        }

        const doubleCheck = confirm('This is your last chance! Really delete your account?');
        
        if (!doubleCheck) {
            console.log('User cancelled second confirmation');
            return;
        }

        console.log('Sending delete request for userId:', localStorage.getItem('userId'));

        try {
            const response = await fetch('http://localhost:3000/api/delete-account', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: localStorage.getItem('userId')
                })
            });

            const data = await response.json();
            console.log('Delete response:', data);

            if (response.ok) {
                this.showNotification('Account deleted successfully', 'success');
                localStorage.clear();
                this.currentUser = null;
                document.getElementById('authSection').style.display = 'flex';
                document.getElementById('dashboard').style.display = 'none';
                document.getElementById('logoutBtn').style.display = 'none';
                document.getElementById('deleteAccountBtn').style.display = 'none';
                document.getElementById('userName').textContent = 'Guest';
            } else {
                this.showNotification(data.error || 'Failed to delete account', 'error');
            }
        } catch (error) {
            console.error('Delete account error:', error);
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    showForgotPasswordModal() {
        const modal = document.getElementById('forgotPasswordModal');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        // Hide login/register forms when modal is shown
        if (loginForm) loginForm.style.opacity = '0.3';
        if (registerForm) registerForm.style.opacity = '0.3';
        
        modal.style.display = 'flex';
        
        // Close on background click
        const clickHandler = (e) => {
            if (e.target === modal) {
                this.closeForgotPasswordModal();
                modal.removeEventListener('click', clickHandler);
            }
        };
        modal.addEventListener('click', clickHandler);
        
        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeForgotPasswordModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeForgotPasswordModal() {
        const modal = document.getElementById('forgotPasswordModal');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        modal.style.display = 'none';
        document.getElementById('forgotPasswordForm').reset();
        
        // Restore login/register forms opacity
        if (loginForm) loginForm.style.opacity = '1';
        if (registerForm) registerForm.style.opacity = '1';
    }

    showChangePasswordModal() {
        const modal = document.getElementById('changePasswordModal');
        modal.style.display = 'flex';

        // Close on outside click
        const clickHandler = (e) => {
            if (e.target === modal) {
                this.closeChangePasswordModal();
                modal.removeEventListener('click', clickHandler);
            }
        };
        modal.addEventListener('click', clickHandler);

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeChangePasswordModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeChangePasswordModal() {
        document.getElementById('changePasswordModal').style.display = 'none';
        document.getElementById('changePasswordForm').reset();
    }

    async handleChangePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword !== confirmPassword) {
            this.showNotification('New passwords do not match', 'error');
            return;
        }

        if (newPassword.length < 4) {
            this.showNotification('Password must be at least 4 characters', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: localStorage.getItem('userId'),
                    currentPassword,
                    newPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Password changed successfully!', 'success');
                this.closeChangePasswordModal();
            } else {
                this.showNotification(data.error || 'Failed to change password', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async showShop() {
        const modal = document.getElementById('shopModal');
        modal.style.display = 'flex';
        await this.loadShopItems();
        await this.loadInventory();

        // Close on outside click
        const clickHandler = (e) => {
            if (e.target === modal) {
                this.closeShop();
                modal.removeEventListener('click', clickHandler);
            }
        };
        modal.addEventListener('click', clickHandler);

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeShop();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeShop() {
        document.getElementById('shopModal').style.display = 'none';
    }

    async loadShopItems() {
        const shopItems = [
            { id: 1, name: 'Crown', icon: '👑', description: 'Royal crown for VIP status', price: 100 },
            { id: 2, name: 'Yacht', icon: '🛥️', description: 'Luxury yacht for the seas', price: 500 },
            { id: 3, name: 'Mansion', icon: '🏰', description: 'Grand mansion estate', price: 1000 },
            { id: 4, name: 'Sports Car', icon: '🏎️', description: 'High-performance supercar', price: 250 },
            { id: 5, name: 'Private Jet', icon: '✈️', description: 'Personal aircraft', price: 2000 },
            { id: 6, name: 'Island', icon: '🏝️', description: 'Private tropical island', price: 5000 },
            { id: 7, name: 'Gold Watch', icon: '⌚', description: 'Luxury timepiece', price: 75 },
            { id: 8, name: 'Diamond Ring', icon: '💍', description: 'Precious jewelry', price: 150 },
            { id: 9, name: 'Trophy', icon: '🏆', description: 'Championship trophy', price: 50 },
            { id: 10, name: 'Rocket', icon: '🚀', description: 'Space exploration vessel', price: 10000 },
            { id: 11, name: 'Robot', icon: '🤖', description: 'Personal AI assistant', price: 300 },
            { id: 12, name: 'Gem', icon: '💎', description: 'Rare precious gemstone', price: 200 }
        ];

        const shopGrid = document.getElementById('shopGrid');
        shopGrid.innerHTML = shopItems.map(item => `
            <div class="shop-item">
                <div class="shop-item-icon">${item.icon}</div>
                <div class="shop-item-name">${item.name}</div>
                <div class="shop-item-description">${item.description}</div>
                <div class="shop-item-price">${item.price} ◆</div>
                <button class="btn-buy" onclick="app.buyItem(${item.id}, '${item.name}', ${item.price}, '${item.icon}')">Buy Now</button>
            </div>
        `).join('');
    }

    async buyItem(itemId, itemName, price, icon) {
        const userId = localStorage.getItem('userId');
        
        try {
            const response = await fetch('http://localhost:3000/api/shop/buy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, itemId, itemName, price, icon })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification(`Purchased ${itemName} for ${price} ◆!`, 'success');
                await this.loadBalance();
                await this.loadInventory();
                await this.loadTransactions();
                await this.checkMasterThiefKit();
            } else {
                this.showNotification(data.error || 'Purchase failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async loadInventory() {
        const userId = localStorage.getItem('userId');
        
        try {
            const response = await fetch(`http://localhost:3000/api/shop/inventory/${userId}`);
            const data = await response.json();

            const inventoryGrid = document.getElementById('inventoryGrid');
            
            if (data.inventory && data.inventory.length > 0) {
                inventoryGrid.innerHTML = data.inventory.map(item => `
                    <div class="inventory-item">
                        <div class="inventory-item-icon">${item.icon}</div>
                        <div class="inventory-item-name">${item.item_name}</div>
                        <div class="inventory-item-count">×${item.quantity}</div>
                    </div>
                `).join('');
            } else {
                inventoryGrid.innerHTML = '<p style="color: #888;">No items yet. Start shopping!</p>';
            }
        } catch (error) {
            console.error('Failed to load inventory:', error);
        }
    }

    toggleTestMode() {
        this.testMode = !this.testMode;
        const btn = document.getElementById('testModeBtn');
        
        if (this.testMode) {
            btn.textContent = '🔧 Test Mode: ON';
            btn.classList.add('active');
            this.showNotification('Test Mode Enabled!', 'success');
        } else {
            btn.textContent = '🔧 Test Mode: OFF';
            btn.classList.remove('active');
            this.showNotification('Test Mode Disabled', 'info');
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        const username = document.getElementById('resetUsername').value;
        const email = document.getElementById('resetEmail').value;

        try {
            const response = await fetch('http://localhost:3000/api/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email })
            });

            const data = await response.json();

            if (response.ok) {
                if (data.emailSent) {
                    this.showNotification('Temporary password sent to ' + data.email + '. Please check your email and log in to change it.', 'success');
                    this.closeForgotPasswordModal();
                } else {
                    // Email failed to send - show error, don't show password
                    const errorMsg = data.emailError ? 'Email could not be sent: ' + data.emailError + '. Please check your email configuration.' : 'Email could not be sent. Please contact support.';
                    this.showNotification(errorMsg, 'error');
                }
            } else {
                this.showNotification(data.error || 'Reset failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    initializeGame() {
        console.log('===== INITIALIZING GAME =====');
        this.gameScore = 0;
        this.gameTime = 30;
        this.gameActive = false;
        this.gameInterval = null;
        this.spawnInterval = null;
        this.gameBest = parseInt(localStorage.getItem('gameBest')) || 0;
        document.getElementById('gameBest').textContent = this.gameBest;
        
        const startBtn = document.getElementById('startGameBtn');
        console.log('Start button found:', !!startBtn);
        if (startBtn && !startBtn.hasGameListener) {
            startBtn.addEventListener('click', () => this.startNewGame());
            startBtn.hasGameListener = true;
            console.log('Click listener added to Start Game button');
        }
    }

    startNewGame() {
        console.log('===== START NEW GAME CALLED =====');
        if (this.gameActive) return;
        
        this.gameScore = 0;
        this.gameTime = 30;
        this.gameActive = true;
        
        console.log('Game activated, setting up UI');
        
        document.getElementById('gameScore').textContent = '0';
        document.getElementById('gameTime').textContent = '30';
        document.getElementById('gameReward').textContent = '';
        document.getElementById('startGameBtn').disabled = true;
        document.getElementById('startGameBtn').textContent = 'Playing...';
        
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = '';
        
        console.log('Starting game timer and spawn interval');
        
        // Start game timer
        this.gameInterval = setInterval(() => {
            this.gameTime--;
            document.getElementById('gameTime').textContent = this.gameTime;
            
            if (this.gameTime <= 0) {
                this.endGame();
            }
        }, 1000);
        
        // Spawn diamonds
        this.spawnInterval = setInterval(() => {
            this.spawnDiamond();
        }, 800);
        
        console.log('Game started successfully');
    }

    spawnDiamond() {
        if (!this.gameActive) return;
        
        const gameBoard = document.getElementById('gameBoard');
        if (!gameBoard) return;
        
        const diamond = document.createElement('div');
        diamond.textContent = '◆';
        
        // Random color - red diamonds are worth points, others are not
        const colors = ['red', 'blue', 'green', 'gold'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        diamond.className = `falling-diamond ${color}`;
        
        // Store color as data attribute for checking
        diamond.dataset.color = color;
        
        // Set color explicitly via inline style to ensure it's visible
        const colorMap = {
            red: '#dc143c',
            blue: '#4169e1',
            green: '#32cd32',
            gold: '#ffd700'
        };
        diamond.style.color = colorMap[color];
        diamond.style.textShadow = color === 'red' ? '0 0 10px rgba(220, 20, 60, 0.8)' :
                                   color === 'blue' ? '0 0 10px rgba(65, 105, 225, 0.8)' :
                                   color === 'green' ? '0 0 10px rgba(50, 205, 50, 0.8)' :
                                   '0 0 10px rgba(255, 215, 0, 0.8)';
        
        // Make diamonds bigger
        diamond.style.fontSize = '48px';
        diamond.style.lineHeight = '1';
        
        // Add click handler - use capture phase to ensure it fires
        diamond.addEventListener('click', (e) => {
            e.stopPropagation();
            this.catchDiamond(diamond);
        }, true);
        
        // Set initial styles before appending
        diamond.style.position = 'absolute';
        diamond.style.top = '0px';
        diamond.style.margin = '0';
        diamond.style.padding = '0';
        diamond.style.pointerEvents = 'auto'; // Ensure clicks work
        diamond.style.cursor = 'pointer';
        
        // Append to DOM first
        gameBoard.appendChild(diamond);
        
        // Force a synchronous layout calculation
        void gameBoard.offsetHeight;
        
        // Get board dimensions using getBoundingClientRect (most reliable)
        const boardRect = gameBoard.getBoundingClientRect();
        const boardWidth = boardRect.width || gameBoard.offsetWidth || gameBoard.clientWidth || 500;
        const boardHeight = boardRect.height || gameBoard.offsetHeight || 400;
        const diamondSize = 48; // Font size is 48px (increased from 32px)
        
        // Random horizontal position in pixels (with padding from edges)
        const padding = 20;
        const availableWidth = boardWidth - (padding * 2) - diamondSize;
        const leftPos = padding + (availableWidth > 0 ? Math.random() * availableWidth : 0);
        
        // Explicitly set left position with !important to override any CSS
        diamond.style.setProperty('left', leftPos + 'px', 'important');
        diamond.style.setProperty('right', 'auto', 'important');
        
        // Random fall speed
        const fallDuration = 2 + Math.random() * 2;
        
        // Calculate fall distance
        const fallDistance = boardHeight + 100;
        
        // Set initial position (above the board) - use transform3d for hardware acceleration
        diamond.style.transform = 'translate3d(0, -50px, 0)';
        diamond.style.transition = 'none';
        diamond.style.willChange = 'transform';
        diamond.style.backfaceVisibility = 'hidden';
        
        // Force reflow
        void diamond.offsetHeight;
        
        // Double requestAnimationFrame for smoother animation start
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!diamond.parentNode || diamond.classList.contains('caught')) return;
                // Use smooth easing for better feel
                diamond.style.transition = `transform ${fallDuration}s cubic-bezier(0.4, 0.0, 0.2, 1)`;
                diamond.style.transform = `translate3d(0, ${fallDistance}px, 0)`;
            });
        });
        
        // Remove diamond after it falls
        setTimeout(() => {
            if (diamond.parentNode && !diamond.classList.contains('caught')) {
                diamond.remove();
            }
        }, fallDuration * 1000);
    }
    
    catchDiamond(diamond) {
        if (!this.gameActive) return;
        
        if (diamond.classList.contains('caught')) return;
        
        diamond.classList.add('caught');
        
        // Stop the falling animation
        diamond.style.transition = 'none';
        const currentTransform = window.getComputedStyle(diamond).transform;
        if (currentTransform && currentTransform !== 'none') {
            diamond.style.transform = currentTransform;
        }
        
        // Only red diamonds give points!
        const isRed = diamond.dataset.color === 'red';
        
        if (isRed) {
            this.gameScore += 1;
            const scoreElement = document.getElementById('gameScore');
            if (scoreElement) {
                scoreElement.textContent = this.gameScore;
            }
            
            // Show positive feedback
            this.showFloatingText('+1', diamond, 'gold');
        } else {
            // Penalty for clicking wrong color
            this.gameScore = Math.max(0, this.gameScore - 1);
            const scoreElement = document.getElementById('gameScore');
            if (scoreElement) {
                scoreElement.textContent = this.gameScore;
            }
            
            // Show negative feedback
            this.showFloatingText('-1', diamond, 'red');
        }
        
        setTimeout(() => {
            if (diamond.parentNode) {
                diamond.remove();
            }
        }, 500);
    }
    
    showFloatingText(text, element, color) {
        const gameBoard = document.getElementById('gameBoard');
        if (!gameBoard || !element.parentNode) return;
        
        // Get the actual position of the element
        const rect = element.getBoundingClientRect();
        const boardRect = gameBoard.getBoundingClientRect();
        
        const floatingText = document.createElement('div');
        floatingText.textContent = text;
        floatingText.style.position = 'absolute';
        floatingText.style.left = (rect.left - boardRect.left + rect.width / 2) + 'px';
        floatingText.style.top = (rect.top - boardRect.top) + 'px';
        floatingText.style.color = color === 'gold' ? '#FFD700' : '#dc143c';
        floatingText.style.fontSize = '24px';
        floatingText.style.fontWeight = 'bold';
        floatingText.style.pointerEvents = 'none';
        floatingText.style.zIndex = '1000';
        floatingText.style.transform = 'translateX(-50%)';
        floatingText.style.animation = 'floatUp 1s ease-out forwards';
        
        gameBoard.appendChild(floatingText);
        
        setTimeout(() => {
            if (floatingText.parentNode) {
                floatingText.remove();
            }
        }, 1000);
    }
    
    endGame() {
        if (!this.gameActive) return;
        
        this.gameActive = false;
        
        // Clear intervals
        if (this.gameInterval) {
            clearInterval(this.gameInterval);
            this.gameInterval = null;
        }
        if (this.spawnInterval) {
            clearInterval(this.spawnInterval);
            this.spawnInterval = null;
        }
        
        // Clear game board
        const gameBoard = document.getElementById('gameBoard');
        gameBoard.innerHTML = `<div class="game-message">Game Over!<br>Score: ${this.gameScore}</div>`;
        
        // Re-enable start button
        document.getElementById('startGameBtn').disabled = false;
        document.getElementById('startGameBtn').textContent = '🎮 Play Again';
        
        // Award diamonds based on score
        const reward = Math.floor(this.gameScore / 3);
        if (reward > 0) {
            this.awardPoints(reward);
        }
        
        // Update best score
        if (this.gameScore > this.gameBest) {
            this.gameBest = this.gameScore;
            localStorage.setItem('gameBest', this.gameBest);
            document.getElementById('gameBest').textContent = this.gameBest;
            this.showNotification(`🏆 New Best Score: ${this.gameBest}!`, 'success');
        }
    }

    async awardPoints(amount) {
        const rewardEl = document.getElementById('gameReward');
        rewardEl.textContent = `+${amount} ◆`;
        
        setTimeout(() => {
            rewardEl.textContent = '';
        }, 1500);

        try {
            const response = await fetch('http://localhost:3000/api/mine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: localStorage.getItem('userId'),
                    amount: amount
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateBalance(data.balance);
                this.loadTransactions();
            } else {
                this.showNotification(data.error || 'Reward failed', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    // Diamond Heist Game
    initializeHeistGame() {
        this.heistActive = false;
        this.heistTime = 60;
        this.heistDiamonds = 0;
        this.heistCombo = 0;
        this.heistStreak = 0;
        this.heistLevel = 1;
        this.heistMultiplier = 1;
        this.heistBest = parseInt(localStorage.getItem('heistBest')) || 0;
        this.heistPlayerPos = { x: 0, y: 9 };
        this.heistGrid = [];
        this.heistLasers = [];
        this.heistPowerups = [];
        this.heistGuards = [];
        this.heistTraps = [];
        this.heistMultiplierZones = [];
        this.heistDashes = 3;
        this.heistSprintEnergy = 100;
        this.heistIsSprinting = false;
        this.heistActiveEffect = null;
        this.heistEffectTimer = 0;
        this.heistLaserHits = 0;
        this.heistHasKit = false;
        this.heistAchievements = [];
        
        document.getElementById('heistBest').textContent = this.heistBest;
        
        const startBtn = document.getElementById('startHeistBtn');
        if (startBtn && !startBtn.hasHeistListener) {
            startBtn.addEventListener('click', () => this.startHeist());
            startBtn.hasHeistListener = true;
        }
        
        this.checkMasterThiefKit();
    }

    async checkMasterThiefKit() {
        const userId = localStorage.getItem('userId');
        try {
            const response = await fetch(`http://localhost:3000/api/shop/inventory/${userId}`);
            const data = await response.json();
            this.heistHasKit = data.inventory && data.inventory.some(item => item.item_name === 'Master Thief Kit');
        } catch (error) {
            console.error('Failed to check kit:', error);
        }
    }

    startHeist() {
        if (this.heistActive) return;
        
        this.heistActive = true;
        this.heistTime = 60;
        this.heistDiamonds = 0;
        this.heistCombo = 0;
        this.heistStreak = 0;
        this.heistLevel = 1;
        this.heistMultiplier = 1;
        this.heistPlayerPos = { x: 0, y: 9 };
        this.heistLasers = [];
        this.heistPowerups = [];
        this.heistGuards = [];
        this.heistTraps = [];
        this.heistMultiplierZones = [];
        this.heistDashes = this.heistHasKit ? 5 : 3;
        this.heistSprintEnergy = 100;
        this.heistIsSprinting = false;
        this.heistActiveEffect = null;
        this.heistEffectTimer = 0;
        this.heistLaserHits = 0;
        this.heistCollectedDiamonds = [];
        this.heistAchievements = [];
        
        document.getElementById('heistTime').textContent = '60';
        document.getElementById('heistDiamonds').textContent = '0';
        document.getElementById('heistCombo').textContent = '0';
        document.getElementById('heistStreak').textContent = '0';
        document.getElementById('heistLevel').textContent = '1';
        document.getElementById('heistMultiplier').textContent = '1';
        document.getElementById('guardCount').textContent = '0';
        document.getElementById('dashCount').textContent = this.heistDashes;
        document.getElementById('sprintEnergy').textContent = '100';
        document.getElementById('activeEffect').style.display = 'none';
        document.getElementById('startHeistBtn').disabled = true;
        document.getElementById('startHeistBtn').textContent = 'In Progress...';
        
        this.createHeistBoard();
        this.spawnHeistDiamonds();
        this.createHeistLasers();
        this.createMultiplierZones();
        this.createTraps();
        this.setupHeistControls();
        this.startHeistGameLoop();
    }

    createHeistBoard() {
        const board = document.getElementById('heistBoard');
        board.innerHTML = '';
        board.classList.remove('heist-screen-shake');
        
        const grid = document.createElement('div');
        grid.className = 'heist-grid';
        grid.id = 'heistGrid';
        
        this.heistGrid = [];
        for (let y = 0; y < 10; y++) {
            this.heistGrid[y] = [];
            for (let x = 0; x < 10; x++) {
                const cell = document.createElement('div');
                cell.className = 'heist-cell';
                cell.dataset.x = x;
                cell.dataset.y = y;
                this.heistGrid[y][x] = cell;
                grid.appendChild(cell);
            }
        }
        
        board.appendChild(grid);
        
        // Add player
        const playerCell = this.heistGrid[9][0];
        const player = document.createElement('div');
        player.className = 'heist-player';
        player.id = 'heistPlayer';
        player.textContent = '\ud83e\udd77';
        playerCell.appendChild(player);
        
        // Add vault door
        const vaultCell = this.heistGrid[0][9];
        const vault = document.createElement('div');
        vault.className = 'heist-vault-door';
        vault.textContent = '\ud83d\udeaa';
        vaultCell.appendChild(vault);
    }

    spawnHeistDiamonds() {
        const diamondCount = 15;
        const positions = [];
        
        for (let i = 0; i < diamondCount; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * 10);
                y = Math.floor(Math.random() * 10);
            } while ((x === 0 && y === 9) || (x === 9 && y === 0) || positions.some(p => p.x === x && p.y === y));
            
            positions.push({ x, y });
            this.heistCollectedDiamonds.push({ x, y, collected: false });
            
            const diamond = document.createElement('div');
            diamond.className = 'heist-diamond';
            diamond.textContent = '\u25c6';
            diamond.dataset.x = x;
            diamond.dataset.y = y;
            this.heistGrid[y][x].appendChild(diamond);
        }
    }

    createHeistLasers() {
        const difficulty = Math.floor(this.heistDiamonds / 10);
        const laserCount = Math.min(2 + difficulty * 2, 8);
        
        // Track used positions to prevent trapping
        const horizontalPositions = new Set();
        const verticalPositions = new Set();
        
        for (let i = 0; i < laserCount; i++) {
            const isHorizontal = Math.random() < 0.5;
            let position;
            
            // Ensure we don't create lasers that completely block all paths
            if (isHorizontal) {
                // Don't allow more than 8 horizontal lasers (leave 2 rows free)
                if (horizontalPositions.size >= 8) continue;
                do {
                    position = Math.floor(Math.random() * 10);
                } while (horizontalPositions.has(position));
                horizontalPositions.add(position);
            } else {
                // Don't allow more than 8 vertical lasers (leave 2 columns free)
                if (verticalPositions.size >= 8) continue;
                do {
                    position = Math.floor(Math.random() * 10);
                } while (verticalPositions.has(position));
                verticalPositions.add(position);
            }
            
            const speed = 0.02 + Math.random() * 0.03 + (difficulty * 0.01);
            const isDanger = Math.random() < 0.2;
            
            this.heistLasers.push({
                isHorizontal,
                position,
                offset: Math.random() * 10,
                speed,
                direction: Math.random() < 0.5 ? 1 : -1,
                isDanger
            });
        }
    }

    createMultiplierZones() {
        this.heistMultiplierZones = [];
        const zoneCount = 3;
        
        for (let i = 0; i < zoneCount; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * 10);
                y = Math.floor(Math.random() * 10);
            } while ((x === 0 && y === 9) || (x === 9 && y === 0));
            
            this.heistMultiplierZones.push({ x, y });
            this.heistGrid[y][x].classList.add('multiplier-zone');
        }
    }

    createTraps() {
        this.heistTraps = [];
        const trapCount = 5;
        
        for (let i = 0; i < trapCount; i++) {
            let x, y;
            do {
                x = Math.floor(Math.random() * 10);
                y = Math.floor(Math.random() * 10);
            } while ((x === 0 && y === 9) || (x === 9 && y === 0));
            
            this.heistTraps.push({ x, y });
            const trap = document.createElement('div');
            trap.className = 'heist-trap';
            trap.textContent = '⚠️';
            trap.dataset.x = x;
            trap.dataset.y = y;
            this.heistGrid[y][x].appendChild(trap);
        }
    }

    spawnGuard() {
        const edge = Math.floor(Math.random() * 4);
        let x, y;
        
        switch(edge) {
            case 0: x = 0; y = Math.floor(Math.random() * 10); break;
            case 1: x = 9; y = Math.floor(Math.random() * 10); break;
            case 2: x = Math.floor(Math.random() * 10); y = 0; break;
            case 3: x = Math.floor(Math.random() * 10); y = 9; break;
        }
        
        const guard = {
            x, y,
            element: document.createElement('div'),
            speed: 0.03,
            path: []
        };
        
        guard.element.className = 'heist-guard';
        guard.element.textContent = '💂';
        this.heistGrid[y][x].appendChild(guard.element);
        this.heistGuards.push(guard);
        
        document.getElementById('guardCount').textContent = this.heistGuards.length;
    }

    updateGuards() {
        for (const guard of this.heistGuards) {
            const dx = this.heistPlayerPos.x - guard.x;
            const dy = this.heistPlayerPos.y - guard.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 5) {
                const moveX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
                const moveY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
                
                const newX = Math.max(0, Math.min(9, guard.x + moveX));
                const newY = Math.max(0, Math.min(9, guard.y + moveY));
                
                if (newX !== guard.x || newY !== guard.y) {
                    guard.element.remove();
                    guard.x = newX;
                    guard.y = newY;
                    this.heistGrid[newY][newX].appendChild(guard.element);
                    
                    if (guard.x === this.heistPlayerPos.x && guard.y === this.heistPlayerPos.y) {
                        this.caughtByGuard();
                    }
                }
            }
        }
    }

    caughtByGuard() {
        if (this.heistActiveEffect === 'ghost') return;
        
        this.heistDiamonds = Math.max(0, this.heistDiamonds - 10);
        this.heistCombo = 0;
        this.heistStreak = 0;
        document.getElementById('heistDiamonds').textContent = this.heistDiamonds;
        document.getElementById('heistCombo').textContent = '0';
        document.getElementById('heistStreak').textContent = '0';
        
        const board = document.getElementById('heistBoard');
        board.classList.add('heist-screen-shake');
        setTimeout(() => board.classList.remove('heist-screen-shake'), 300);
        
        this.createHeistParticle(this.heistPlayerPos.x, this.heistPlayerPos.y, '💥', 'red');
        this.showHeistMessage('CAUGHT! -10 💎', 'red');
    }

    showHeistMessage(text, color) {
        const board = document.getElementById('heistBoard');
        const message = document.createElement('div');
        message.className = 'heist-combo-text';
        message.textContent = text;
        message.style.color = color;
        board.appendChild(message);
        setTimeout(() => message.remove(), 800);
    }

    checkAchievements() {
        if (this.heistCombo >= 10 && !this.heistAchievements.includes('combo10')) {
            this.heistAchievements.push('combo10');
            this.showAchievement('🏆 Combo Master!', '+5 Bonus Diamonds');
            this.heistDiamonds += 5;
        }
        
        if (this.heistStreak >= 20 && !this.heistAchievements.includes('streak20')) {
            this.heistAchievements.push('streak20');
            this.showAchievement('🔥 On Fire!', '+10 Bonus Diamonds');
            this.heistDiamonds += 10;
        }
        
        if (this.heistLaserHits === 0 && this.heistDiamonds >= 10 && !this.heistAchievements.includes('perfect10')) {
            this.heistAchievements.push('perfect10');
            this.showAchievement('👻 Ghost Thief!', '+15 Bonus Diamonds');
            this.heistDiamonds += 15;
        }
    }

    showAchievement(title, subtitle) {
        const board = document.getElementById('heistBoard');
        const achievement = document.createElement('div');
        achievement.className = 'achievement-popup';
        achievement.innerHTML = `<div style="font-size: 32px; margin-bottom: 10px;">${title}</div><div style="font-size: 18px;">${subtitle}</div>`;
        board.appendChild(achievement);
        setTimeout(() => achievement.remove(), 2000);
    }

    setupHeistControls() {
        this.heistKeys = new Set();
        
        const handleKeyDown = (e) => {
            if (!this.heistActive) return;
            
            const key = e.key.toLowerCase();
            this.heistKeys.add(key);
            
            if (key === ' ') {
                if (this.heistDashes > 0) this.activateDash();
                e.preventDefault();
            }
            
            if (key === 'shift') {
                this.heistIsSprinting = true;
                e.preventDefault();
            }
        };
        
        const handleKeyUp = (e) => {
            const key = e.key.toLowerCase();
            this.heistKeys.delete(key);
            
            if (key === 'shift') {
                this.heistIsSprinting = false;
            }
        };
        
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('keyup', handleKeyUp);
        this.heistKeyHandler = handleKeyDown;
        this.heistKeyUpHandler = handleKeyUp;
    }

    processMovement() {
        if (!this.heistActive || this.heistKeys.size === 0) return;
        
        let dx = 0, dy = 0;
        
        if (this.heistKeys.has('arrowup') || this.heistKeys.has('w')) dy = -1;
        if (this.heistKeys.has('arrowdown') || this.heistKeys.has('s')) dy = 1;
        if (this.heistKeys.has('arrowleft') || this.heistKeys.has('a')) dx = -1;
        if (this.heistKeys.has('arrowright') || this.heistKeys.has('d')) dx = 1;
        
        if (dx !== 0 || dy !== 0) {
            const isSprinting = this.heistIsSprinting && this.heistSprintEnergy > 0;
            this.moveHeistPlayer(dx, dy, isSprinting);
            
            if (isSprinting) {
                this.heistSprintEnergy = Math.max(0, this.heistSprintEnergy - 2);
                document.getElementById('sprintEnergy').textContent = Math.floor(this.heistSprintEnergy);
            }
        }
    }

    moveHeistPlayer(dx, dy, isSprinting = false) {
        const newX = Math.max(0, Math.min(9, this.heistPlayerPos.x + dx));
        const newY = Math.max(0, Math.min(9, this.heistPlayerPos.y + dy));
        
        if (newX !== this.heistPlayerPos.x || newY !== this.heistPlayerPos.y) {
            // Remove from old cell with fade out
            const oldCell = this.heistGrid[this.heistPlayerPos.y][this.heistPlayerPos.x];
            const player = oldCell.querySelector('.heist-player');
            if (player) {
                player.style.opacity = '0';
                player.style.transform = 'scale(0.8)';
                setTimeout(() => {
                    if (player.parentNode) {
                        oldCell.removeChild(player);
                    }
                }, 100);
            }
            
            // Add to new cell with smooth fade in
            this.heistPlayerPos.x = newX;
            this.heistPlayerPos.y = newY;
            const newCell = this.heistGrid[newY][newX];
            const newPlayer = document.createElement('div');
            newPlayer.className = 'heist-player';
            newPlayer.id = 'heistPlayer';
            newPlayer.textContent = '🥷';
            newPlayer.style.opacity = '0';
            newPlayer.style.transform = 'scale(0.8)';
            
            if (isSprinting) {
                newPlayer.classList.add('player-speed');
            }
            
            if (this.heistActiveEffect === 'ghost') {
                newPlayer.classList.add('player-ghost');
            } else if (this.heistActiveEffect === 'speed') {
                newPlayer.classList.add('player-speed');
            }
            
            newCell.appendChild(newPlayer);
            
            // Smooth fade in animation
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    newPlayer.style.transition = 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
                    newPlayer.style.opacity = '1';
                    newPlayer.style.transform = 'scale(1)';
                });
            });
            
            this.checkHeistCollision();
        }
    }

    activateDash() {
        if (this.heistDashes <= 0) return;
        
        this.heistDashes--;
        document.getElementById('dashCount').textContent = this.heistDashes;
        
        const player = document.getElementById('heistPlayer');
        if (player) {
            player.classList.add('player-dashing');
            setTimeout(() => {
                if (player) player.classList.remove('player-dashing');
            }, 300);
        }
        
        this.createHeistParticle(this.heistPlayerPos.x, this.heistPlayerPos.y, '💨', 'cyan');
        this.createHeistParticle(this.heistPlayerPos.x, this.heistPlayerPos.y, '⚡', 'yellow');
    }

    checkHeistCollision() {
        const { x, y } = this.heistPlayerPos;
        const cell = this.heistGrid[y][x];
        
        // Check multiplier zone
        const isInMultiplierZone = this.heistMultiplierZones.some(z => z.x === x && z.y === y);
        if (isInMultiplierZone) {
            this.heistMultiplier = 2;
            document.getElementById('heistMultiplier').textContent = '2';
        } else {
            this.heistMultiplier = 1;
            document.getElementById('heistMultiplier').textContent = '1';
        }
        
        // Check trap
        const trapIndex = this.heistTraps.findIndex(t => t.x === x && t.y === y);
        if (trapIndex !== -1) {
            this.heistDiamonds = Math.max(0, this.heistDiamonds - 3);
            this.heistCombo = 0;
            document.getElementById('heistDiamonds').textContent = this.heistDiamonds;
            document.getElementById('heistCombo').textContent = '0';
            this.createHeistParticle(this.heistPlayerPos.x, this.heistPlayerPos.y, '💥', 'orange');
            this.showHeistMessage('TRAP! -3 💎', 'orange');
            this.heistTraps.splice(trapIndex, 1);
            const trapEl = cell.querySelector('.heist-trap');
            if (trapEl) trapEl.remove();
        }
        
        // Check diamond
        const diamond = cell.querySelector('.heist-diamond');
        if (diamond) {
            const baseReward = 1 * this.heistMultiplier;
            this.heistDiamonds += baseReward;
            this.heistCombo++;
            this.heistStreak++;
            document.getElementById('heistDiamonds').textContent = this.heistDiamonds;
            document.getElementById('heistCombo').textContent = this.heistCombo;
            document.getElementById('heistStreak').textContent = this.heistStreak;
            
            if (this.heistCombo >= 5) {
                this.showHeistMessage(`${this.heistCombo}x COMBO!`, '#FFD700');
            }
            
            this.createHeistParticle(x, y, '✨', 'gold');
            diamond.remove();
            
            const diamondData = this.heistCollectedDiamonds.find(d => d.x === x && d.y === y);
            if (diamondData) diamondData.collected = true;
            
            // Level up every 10 diamonds
            if (this.heistDiamonds % 10 === 0 && this.heistDiamonds > 0) {
                this.heistLevel++;
                document.getElementById('heistLevel').textContent = this.heistLevel;
                this.createHeistLasers();
                if (this.heistLevel % 2 === 0) {
                    this.spawnGuard();
                }
                this.showHeistMessage(`LEVEL ${this.heistLevel}!`, '#00FF00');
            }
            
            // Check achievements
            this.checkAchievements();
            
            // Spawn powerup randomly
            if (Math.random() < 0.15) {
                this.spawnHeistPowerup();
            }
        }
        
        // Check powerup
        const powerup = cell.querySelector('.heist-powerup');
        if (powerup) {
            const type = powerup.dataset.type;
            this.activateHeistPowerup(type);
            powerup.remove();
        }
        
        // Check vault door
        if (x === 9 && y === 0 && this.heistDiamonds > 0) {
            this.heistDiamonds += 5;
            document.getElementById('heistDiamonds').textContent = this.heistDiamonds;
            this.createHeistParticle(x, y, '🏆', 'gold');
            this.showHeistMessage('VAULT BONUS! +5 💎', '#FFD700');
        }
        
        // Check laser collision
        if (this.heistActiveEffect !== 'ghost') {
            this.checkLaserCollision();
        }
    }

    checkLaserCollision() {
        const { x, y } = this.heistPlayerPos;
        
        for (const laser of this.heistLasers) {
            const laserPos = Math.floor(laser.offset);
            
            if (laser.isHorizontal && laserPos === y) {
                this.hitByLaser();
                return;
            } else if (!laser.isHorizontal && laserPos === x) {
                this.hitByLaser();
                return;
            }
        }
    }

    hitByLaser() {
        if (this.heistActiveEffect === 'ghost') return;
        
        this.heistLaserHits++;
        this.heistDiamonds = Math.max(0, this.heistDiamonds - 5);
        this.heistCombo = 0;
        document.getElementById('heistDiamonds').textContent = this.heistDiamonds;
        document.getElementById('heistCombo').textContent = '0';
        
        const board = document.getElementById('heistBoard');
        board.classList.add('heist-screen-shake');
        setTimeout(() => board.classList.remove('heist-screen-shake'), 300);
        
        this.createHeistParticle('\ud83d\udca5', this.heistPlayerPos.x, this.heistPlayerPos.y);
    }

    spawnHeistPowerup() {
        let x, y;
        do {
            x = Math.floor(Math.random() * 10);
            y = Math.floor(Math.random() * 10);
        } while ((x === this.heistPlayerPos.x && y === this.heistPlayerPos.y) || 
                 this.heistGrid[y][x].querySelector('.heist-diamond, .heist-powerup'));
        
        const types = ['\u23f8\ufe0f', '\ud83d\udc7b', '\u26a1', '\ud83d\udd0d'];
        const names = ['freeze', 'ghost', 'speed', 'reveal'];
        const type = Math.floor(Math.random() * types.length);
        
        const powerup = document.createElement('div');
        powerup.className = 'heist-powerup';
        powerup.textContent = types[type];
        powerup.dataset.type = names[type];
        this.heistGrid[y][x].appendChild(powerup);
    }

    activateHeistPowerup(type) {
        this.heistActiveEffect = type;
        this.heistEffectTimer = type === 'freeze' ? 3 : type === 'ghost' ? 3 : type === 'speed' ? 5 : 0;
        
        const effectEl = document.getElementById('activeEffect');
        const icons = { freeze: '\u23f8\ufe0f Freeze', ghost: '\ud83d\udc7b Ghost', speed: '\u26a1 Speed', reveal: '\ud83d\udd0d Reveal' };
        
        if (type === 'reveal') {
            this.revealLaserPattern();
            effectEl.style.display = 'none';
        } else {
            effectEl.textContent = icons[type] + ': ' + this.heistEffectTimer + 's';
            effectEl.style.display = 'block';
        }
        
        const player = document.getElementById('heistPlayer');
        if (player) {
            if (type === 'ghost') player.classList.add('player-ghost');
            if (type === 'speed') player.classList.add('player-speed');
        }
    }

    revealLaserPattern() {
        this.heistLasers.forEach(laser => {
            if (laser.element) {
                laser.element.style.opacity = '1';
                laser.element.style.boxShadow = '0 0 20px rgba(220, 20, 60, 1)';
            }
        });
        
        setTimeout(() => {
            this.heistLasers.forEach(laser => {
                if (laser.element) {
                    laser.element.style.opacity = '';
                    laser.element.style.boxShadow = '';
                }
            });
        }, 2000);
    }

    createHeistParticle(x, y, emoji, color = 'gold') {
        const cell = this.heistGrid[y][x];
        const rect = cell.getBoundingClientRect();
        const board = document.getElementById('heistBoard');
        const boardRect = board.getBoundingClientRect();
        
        for (let i = 0; i < 5; i++) {
            const particle = document.createElement('div');
            particle.className = 'heist-particle';
            particle.textContent = emoji;
            particle.style.color = color;
            
            const offsetX = rect.left - boardRect.left + rect.width / 2;
            const offsetY = rect.top - boardRect.top + rect.height / 2;
            
            particle.style.left = offsetX + 'px';
            particle.style.top = offsetY + 'px';
            particle.style.setProperty('--tx', (Math.random() - 0.5) * 100 + 'px');
            particle.style.setProperty('--ty', (Math.random() - 0.5) * 100 + 'px');
            
            board.appendChild(particle);
            setTimeout(() => particle.remove(), 1000);
        }
    }

    updateHeistLasers() {
        const grid = document.getElementById('heistGrid');
        if (!grid) return;
        
        this.heistLasers.forEach(laser => {
            const isFrozen = this.heistActiveEffect === 'freeze';
            
            if (!isFrozen) {
                laser.offset += laser.speed * laser.direction;
                
                if (laser.offset < 0 || laser.offset > 10) {
                    laser.direction *= -1;
                    laser.offset = Math.max(0, Math.min(10, laser.offset));
                }
            }
            
            // Remove old element
            if (laser.element) {
                laser.element.remove();
            }
            
            // Create new element at current position
            const pos = Math.floor(laser.offset);
            if (pos >= 0 && pos < 10) {
                const laserEl = document.createElement('div');
                const laserClass = 'heist-laser ' + (laser.isHorizontal ? 'horizontal' : 'vertical');
                laserEl.className = laser.isDanger ? laserClass + ' danger' : laserClass;
                
                if (laser.isHorizontal) {
                    const row = this.heistGrid[pos];
                    if (row && row[0]) {
                        const cell = row[0];
                        const cellRect = cell.getBoundingClientRect();
                        const gridRect = grid.getBoundingClientRect();
                        laserEl.style.top = (cellRect.top - gridRect.top + cellRect.height / 2) + 'px';
                    }
                } else {
                    const cell = this.heistGrid[0][pos];
                    if (cell) {
                        const cellRect = cell.getBoundingClientRect();
                        const gridRect = grid.getBoundingClientRect();
                        laserEl.style.left = (cellRect.left - gridRect.left + cellRect.width / 2) + 'px';
                    }
                }
                
                grid.appendChild(laserEl);
                laser.element = laserEl;
            }
        });
    }

    startHeistGameLoop() {
        let lastTime = Date.now();
        let moveTimer = 0;
        const moveInterval = 0.15; // Move every 150ms
        
        this.heistInterval = setInterval(() => {
            const currentTime = Date.now();
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;
            
            // Update time
            this.heistTime -= deltaTime;
            const timeLeft = Math.max(0, Math.ceil(this.heistTime));
            document.getElementById('heistTime').textContent = timeLeft;
            
            // Regenerate sprint energy
            if (!this.heistIsSprinting && this.heistSprintEnergy < 100) {
                this.heistSprintEnergy = Math.min(100, this.heistSprintEnergy + deltaTime * 20);
                document.getElementById('sprintEnergy').textContent = Math.floor(this.heistSprintEnergy);
            }
            
            // Process movement
            moveTimer += deltaTime;
            if (moveTimer >= moveInterval) {
                this.processMovement();
                moveTimer = 0;
            }
            
            // Update effect timer
            if (this.heistActiveEffect && this.heistActiveEffect !== 'reveal') {
                this.heistEffectTimer -= deltaTime;
                if (this.heistEffectTimer <= 0) {
                    this.heistActiveEffect = null;
                    document.getElementById('activeEffect').style.display = 'none';
                    
                    const player = document.getElementById('heistPlayer');
                    if (player) {
                        player.classList.remove('player-ghost', 'player-speed');
                    }
                } else {
                    const effectIcons = { freeze: '⏸️', ghost: '👻', speed: '⚡' };
                    document.getElementById('activeEffect').textContent = 
                        `${effectIcons[this.heistActiveEffect] || ''} ${Math.ceil(this.heistEffectTimer)}s`;
                }
            }
            
            // Update lasers
            this.updateHeistLasers();
            
            // Update guards
            this.updateGuards();
            
            // Check laser collision
            if (this.heistActiveEffect !== 'ghost') {
                this.checkLaserCollision();
            }
            
            // Check end condition
            if (this.heistTime <= 0) {
                this.endHeist();
            }
        }, 1000 / 30); // 30 FPS
    }

    async endHeist() {
        this.heistActive = false;
        clearInterval(this.heistInterval);
        if (this.heistKeyHandler) {
            document.removeEventListener('keydown', this.heistKeyHandler);
        }
        if (this.heistKeyUpHandler) {
            document.removeEventListener('keyup', this.heistKeyUpHandler);
        }
        
        const board = document.getElementById('heistBoard');
        
        // Apply bonuses
        const comboBonus = Math.floor(this.heistCombo / 3);
        const streakBonus = Math.floor(this.heistStreak / 5);
        const perfectionBonus = this.heistLaserHits === 0 ? 10 : 0;
        const levelBonus = (this.heistLevel - 1) * 5;
        const totalDiamonds = this.heistDiamonds + comboBonus + streakBonus + perfectionBonus + levelBonus;
        
        let message = `🏆 Heist Complete!\n`;
        message += `💎 Stolen: ${this.heistDiamonds} diamonds\n`;
        if (comboBonus > 0) message += `🎯 Combo Bonus: +${comboBonus}\n`;
        if (streakBonus > 0) message += `🔥 Streak Bonus: +${streakBonus}\n`;
        if (levelBonus > 0) message += `🎮 Level Bonus: +${levelBonus}\n`;
        if (perfectionBonus > 0) message += `✨ Perfect Run: +${perfectionBonus}\n`;
        message += `🚨 Laser Hits: ${this.heistLaserHits}\n`;
        message += `\n💰 Total Score: ${totalDiamonds}\n`;
        message += `🏅 Reward: ${Math.floor(totalDiamonds / 2)} ◆`;
        
        board.innerHTML = `<div class="game-message">${message.replace(/\n/g, '<br>')}</div>`;
        
        document.getElementById('startHeistBtn').disabled = false;
        document.getElementById('startHeistBtn').textContent = 'Start Heist';
        
        // Award reward
        const reward = Math.floor(totalDiamonds / 2);
        if (reward > 0) {
            await this.awardHeistReward(reward);
        }
        
        // Update best score
        if (totalDiamonds > this.heistBest) {
            this.heistBest = totalDiamonds;
            localStorage.setItem('heistBest', this.heistBest);
            document.getElementById('heistBest').textContent = this.heistBest;
            this.showNotification(`🏆 New Best Heist: ${this.heistBest}!`, 'success');
        }
    }

    async awardHeistReward(amount) {
        const rewardEl = document.getElementById('heistReward');
        rewardEl.textContent = `+${amount} \u25c6`;
        
        setTimeout(() => {
            rewardEl.textContent = '';
        }, 2000);

        try {
            const response = await fetch('http://localhost:3000/api/mine', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: localStorage.getItem('userId'),
                    amount: amount
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.updateBalance(data.balance);
                this.loadTransactions();
                this.showNotification(`Heist successful! Earned ${amount} Red Diamonds!`, 'success');
            }
        } catch (error) {
            console.error('Failed to award heist reward:', error);
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `notification ${type}`;
        
        // Trigger reflow to restart animation
        notification.offsetHeight;
        
        notification.classList.add('show');

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Mail Service Functions
    async showMail() {
        const modal = document.getElementById('mailModal');
        modal.style.display = 'flex';
        this.showInboxView();
        await this.loadInbox();
        await this.loadSentMail();

        // Close on outside click
        const clickHandler = (e) => {
            if (e.target === modal) {
                this.closeMail();
                modal.removeEventListener('click', clickHandler);
            }
        };
        modal.addEventListener('click', clickHandler);

        // Close on Escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeMail();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    closeMail() {
        document.getElementById('mailModal').style.display = 'none';
    }

    showComposeView() {
        document.getElementById('composeMailView').style.display = 'block';
        document.getElementById('inboxMailView').style.display = 'none';
        document.getElementById('sentMailView').style.display = 'none';
        document.getElementById('composeMailBtn').classList.add('active');
        document.getElementById('inboxMailBtn').classList.remove('active');
        document.getElementById('sentMailBtn').classList.remove('active');
    }

    showInboxView() {
        document.getElementById('composeMailView').style.display = 'none';
        document.getElementById('inboxMailView').style.display = 'block';
        document.getElementById('sentMailView').style.display = 'none';
        document.getElementById('composeMailBtn').classList.remove('active');
        document.getElementById('inboxMailBtn').classList.add('active');
        document.getElementById('sentMailBtn').classList.remove('active');
        this.loadInbox();
    }

    showSentView() {
        document.getElementById('composeMailView').style.display = 'none';
        document.getElementById('inboxMailView').style.display = 'none';
        document.getElementById('sentMailView').style.display = 'block';
        document.getElementById('composeMailBtn').classList.remove('active');
        document.getElementById('inboxMailBtn').classList.remove('active');
        document.getElementById('sentMailBtn').classList.add('active');
        this.loadSentMail();
    }

    async handleSendMail(e) {
        e.preventDefault();
        const to = document.getElementById('mailTo').value;
        const subject = document.getElementById('mailSubject').value;
        const body = document.getElementById('mailBody').value;

        try {
            const response = await fetch('http://localhost:3000/api/mail/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: localStorage.getItem('userId'),
                    to: to,
                    subject: subject,
                    body: body
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.showNotification('Email sent successfully!', 'success');
                document.getElementById('composeMailForm').reset();
                this.showSentView();
                await this.loadSentMail();
            } else {
                this.showNotification(data.error || 'Failed to send email', 'error');
            }
        } catch (error) {
            this.showNotification('Network error. Please try again.', 'error');
        }
    }

    async loadInbox() {
        try {
            const response = await fetch(`http://localhost:3000/api/mail/inbox?userId=${localStorage.getItem('userId')}`);
            const emails = await response.json();
            
            const inboxList = document.getElementById('inboxMailList');
            if (emails.length === 0) {
                inboxList.innerHTML = '<p style="color: #888; text-align: center;">No emails yet</p>';
                return;
            }

            inboxList.innerHTML = emails.map(email => `
                <div class="mail-item" style="padding: 15px; margin-bottom: 10px; background: rgba(220, 20, 60, 0.1); border-left: 3px solid var(--red-diamond); border-radius: 8px; cursor: pointer;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: var(--red-diamond);">${email.from_username || email.from_email}</strong>
                        <span style="color: #888; font-size: 12px;">${new Date(email.sent_at).toLocaleDateString()}</span>
                    </div>
                    <div style="font-weight: bold; margin-bottom: 5px;">${email.subject}</div>
                    <div style="color: #aaa; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${email.body}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load inbox:', error);
        }
    }

    async loadSentMail() {
        try {
            const response = await fetch(`http://localhost:3000/api/mail/sent?userId=${localStorage.getItem('userId')}`);
            const emails = await response.json();
            
            const sentList = document.getElementById('sentMailList');
            if (emails.length === 0) {
                sentList.innerHTML = '<p style="color: #888; text-align: center;">No sent emails yet</p>';
                return;
            }

            sentList.innerHTML = emails.map(email => `
                <div class="mail-item" style="padding: 15px; margin-bottom: 10px; background: rgba(220, 20, 60, 0.1); border-left: 3px solid var(--red-diamond); border-radius: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                        <strong style="color: var(--red-diamond);">To: ${email.to_username || email.to_email}</strong>
                        <span style="color: #888; font-size: 12px;">${new Date(email.sent_at).toLocaleDateString()}</span>
                    </div>
                    <div style="font-weight: bold; margin-bottom: 5px;">${email.subject}</div>
                    <div style="color: #aaa; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${email.body}</div>
                </div>
            `).join('');
        } catch (error) {
            console.error('Failed to load sent mail:', error);
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new BankApp();
});
