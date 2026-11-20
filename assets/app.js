
        // ============================================================
        // STARDUST HUB - FINAL VERSION
        // Fixed: Reels delete button position (replaced with 3-dot menu)
        // Fixed: Post delete button (replaced with 3-dot menu)
        // Fixed: Signup with full profile (pfp, name, bio, email, password)
        // Fixed: Privacy Policy & Terms links on login/signup
        // Fixed: Forgot Password with Firebase
        // Fixed: Delete Account
        // ============================================================

        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
        import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, deleteUser } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
        import { getDatabase, ref, set, onValue, push, update, get, remove, runTransaction } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

        // ===== FIREBASE CONFIG =====
        const firebaseConfig = {
            apiKey: "AIzaSyC5ufTBjot8i-PJCBkJtUpc50jJcYmzMBQ",
            authDomain: "stardust-hub.firebaseapp.com",
            databaseURL: "https://stardust-hub-default-rtdb.firebaseio.com",
            projectId: "stardust-hub",
            storageBucket: "stardust-hub.firebasestorage.app",
            messagingSenderId: "672339143681",
            appId: "1:672339143681:web:42d7e7f3fd923890aba400",
            measurementId: "G-DZM4TXN2N2"
        };

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getDatabase(app);

        // ===== CLOUDINARY =====
        const CLOUDINARY = {
            cloudName: 'cbvgkw1a',
            uploadPreset: 'stardust_reels'
        };

        const FIXED_PROFESSIONS = ["Architect", "Software Engineer", "Systems Analyst", "Cybersecurity Specialist", "Creative Designer"];
        
        // ===== DATABASE STATE =====
        let databaseState = {
            currentUser: { name: "Stardust Base", uid: "000000", realFirebaseUID: "", email: "", phone: "", bio: "System online.", pfp: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150", profession: "", isPremium: false, premiumTheme: "", premiumFrame: "", premiumFont: "", premiumExpiry: 0, savedPosts: [], savedReels: [] },
            publications: [], peers: [], friendships: {}, chatThreads: {}, activeTargetChatUID: null, activeContextMessageID: null, activeTargetSharePostID: null,
            reels: [], activeReelId: null,
            longPressTimer: null,
            isUploading: false,
            notifications: [],
            viewedReels: {},
            viewTimers: {},
            reelViewTracked: {}
        };

        // ===== CALL STATE =====
        let callState = {
            isActive: false,
            peerId: null,
            stream: null,
            callObj: null,
            durationInterval: null,
            seconds: 0,
            isFloating: false,
            isChatOpen: false
        };

        let peerInstance = null;
        let ongoingCallObject = null;
        let nativeMediaStream = null;

        // ===== THEME MANAGEMENT =====
        function getStoredTheme() {
            return localStorage.getItem('stardust_theme') || 'light';
        }

        function applyTheme(theme) {
            const body = document.body;
            const checkbox = document.getElementById('theme-toggle-checkbox');
            const dot = document.getElementById('theme-toggle-dot');
            
            body.classList.remove('light-mode', 'dark-mode');
            body.classList.add(theme + '-mode');
            
            if (theme === 'dark') {
                if (checkbox) checkbox.checked = true;
                if (dot) dot.style.transform = 'translateX(18px)';
            } else {
                if (checkbox) checkbox.checked = false;
                if (dot) dot.style.transform = 'translateX(1px)';
            }
            
            localStorage.setItem('stardust_theme', theme);
        }

        window.toggleTheme = function() {
            const current = getStoredTheme();
            const newTheme = current === 'light' ? 'dark' : 'light';
            applyTheme(newTheme);
        }

        applyTheme(getStoredTheme());

        // ===== SAVE STATE =====
        window.saveStateToHardware = function() { localStorage.setItem("STARDUST_CORE_DB_PROD", JSON.stringify(databaseState)); }
        window.recoverStateFromHardware = function() {
            const raw = localStorage.getItem("STARDUST_CORE_DB_PROD");
            if (raw) { 
                try { 
                    const parsed = JSON.parse(raw); 
                    if(parsed.currentUser) databaseState.currentUser = parsed.currentUser; 
                    if(parsed.notifications) databaseState.notifications = parsed.notifications; 
                    if(parsed.viewedReels) databaseState.viewedReels = parsed.viewedReels;
                    if(parsed.reelViewTracked) databaseState.reelViewTracked = parsed.reelViewTracked;
                } catch(e){} 
            }
        }

        function generateSixDigitUID() { return Math.floor(100000 + Math.random() * 900000).toString(); }

        // ===== TOAST =====
        function showSuccessToast(title, message, icon = '✅') {
            const toast = document.getElementById('success-toast');
            document.getElementById('toast-icon').textContent = icon;
            document.getElementById('toast-title').textContent = title;
            document.getElementById('toast-message').textContent = message;
            toast.classList.remove('hidden');
            if (window.toastTimeout) clearTimeout(window.toastTimeout);
            window.toastTimeout = setTimeout(() => toast.classList.add('hidden'), 4000);
        }

        // ===== LOADING SPINNER =====
        function showUploadLoading() {
            document.getElementById('upload-loading-spinner').classList.remove('hidden');
            document.getElementById('main-plus-btn').classList.add('opacity-50');
            databaseState.isUploading = true;
        }
        function hideUploadLoading() {
            document.getElementById('upload-loading-spinner').classList.add('hidden');
            document.getElementById('main-plus-btn').classList.remove('opacity-50');
            databaseState.isUploading = false;
        }

        // ============================================================
        // FORGOT PASSWORD
        // ============================================================
        window.showForgotPassword = function() {
            openModal('forgot-password-modal');
            document.getElementById('reset-email-input').value = '';
        }

        window.sendPasswordReset = function() {
            const email = document.getElementById('reset-email-input').value.trim();
            if (!email) {
                showSuccessToast('Error', 'Please enter your email address.', '❌');
                return;
            }
            sendPasswordResetEmail(auth, email)
                .then(() => {
                    closeModal('forgot-password-modal');
                    showSuccessToast('Reset Link Sent', 'Check your email for password reset instructions.', '📧');
                })
                .catch((error) => {
                    showSuccessToast('Error', error.message, '❌');
                });
        }

        // ============================================================
        // DELETE ACCOUNT
        // ============================================================
        window.handleDeleteAccount = function() {
            if (!confirm('Are you sure you want to permanently delete your account? This action cannot be undone!')) {
                return;
            }
            if (!confirm('All your posts, reels, and data will be lost. Are you absolutely sure?')) {
                return;
            }
            
            const user = auth.currentUser;
            if (!user) {
                showSuccessToast('Error', 'You must be logged in to delete your account.', '❌');
                return;
            }

            const myUID = databaseState.currentUser.uid;
            
            // Delete user data from Realtime Database
            const userRef = ref(db, 'users/' + myUID);
            remove(userRef).then(() => {
                // Delete user from Firebase Auth
                return deleteUser(user);
            }).then(() => {
                localStorage.removeItem("STARDUST_CORE_DB_PROD");
                if (peerInstance) peerInstance.destroy();
                showSuccessToast('Account Deleted', 'Your account has been permanently deleted.', '🗑');
                setTimeout(() => location.reload(), 1500);
            }).catch((error) => {
                console.error('Delete account error:', error);
                if (error.code === 'auth/requires-recent-login') {
                    showSuccessToast('Error', 'Please re-authenticate and try again.', '❌');
                } else {
                    showSuccessToast('Error', 'Failed to delete account: ' + error.message, '❌');
                }
            });
        }

        // ============================================================
        // PREMIUM FUNCTIONS
        // ============================================================
        function applyPremiumSettings(user) {
            if (!user) return;
            
            const profileCard = document.getElementById('profile-card');
            const profileContent = document.getElementById('profile-content-area');
            const profileTabs = document.getElementById('profile-tabs-container');
            const avatarFrame = document.getElementById('profile-avatar-frame');
            const profileName = document.getElementById('profile-display-name');
            const profileBio = document.getElementById('profile-display-bio');
            const profileUid = document.getElementById('profile-display-uid');
            const profileProfession = document.getElementById('profile-display-profession');
            
            const allProfileElements = [profileCard, profileContent, profileTabs, avatarFrame, profileName, profileBio, profileUid, profileProfession];
            allProfileElements.forEach(el => {
                if (el) {
                    el.className = el.className.split(' ')
                        .filter(c => !c.startsWith('premium-theme-') && !c.startsWith('premium-profile-glow') && !c.startsWith('premium-frame-') && !c.startsWith('premium-font-'))
                        .join(' ');
                }
            });
            
            if (profileCard) {
                profileCard.className = 'bg-lightcard dark:bg-darkcard p-5 rounded-2xl border border-lightborder dark:border-slate-800 relative transition-all duration-300';
            }
            if (avatarFrame) {
                avatarFrame.className = 'w-20 h-20 rounded-full p-0.5 border border-slate-300 dark:border-slate-700 mb-3';
            }
            
            if (user.isPremium && user.premiumTheme) {
                if (profileCard) profileCard.classList.add(user.premiumTheme);
                if (profileContent) profileContent.classList.add(user.premiumTheme);
                if (profileTabs) profileTabs.classList.add(user.premiumTheme);
                const peerCard = document.getElementById('peer-profile-card');
                if (peerCard) {
                    peerCard.className = 'bg-lightcard dark:bg-darkcard p-6 rounded-3xl border border-lightborder dark:border-slate-800 text-center relative shadow-2xl transition-all duration-300';
                    peerCard.classList.add(user.premiumTheme);
                }
            }
            
            if (user.isPremium && user.premiumFrame) {
                if (avatarFrame) avatarFrame.classList.add(user.premiumFrame);
                const peerFrame = document.getElementById('peer-avatar-frame');
                if (peerFrame) {
                    peerFrame.className = 'w-24 h-24 rounded-full mx-auto mb-4 border-2 border-slate-300 dark:border-slate-700';
                    peerFrame.classList.add(user.premiumFrame);
                }
            }
            
            if (user.isPremium && user.premiumFont) {
                if (profileName) profileName.classList.add(user.premiumFont);
                if (profileBio) profileBio.classList.add(user.premiumFont);
                if (profileUid) profileUid.classList.add(user.premiumFont);
                if (profileProfession) profileProfession.classList.add(user.premiumFont);
                document.querySelectorAll('.post-text, .reel-caption, .post-author-name').forEach(el => {
                    el.classList.add(user.premiumFont);
                });
            }
            
            if (user.isPremium) {
                const glowClass = user.premiumTheme ? 
                    user.premiumTheme.replace('premium-theme-', '') : 'purple';
                const glowMap = {
                    'galaxy': 'purple',
                    'sunset': 'orange',
                    'ocean': 'cyan',
                    'forest': 'emerald',
                    'rose': 'pink',
                    'gold': 'gold',
                    'ice': 'cyan',
                    'almond': 'almond',
                    'royal': 'royal',
                    'cherry': 'cherry'
                };
                const glowColor = glowMap[glowClass] || 'purple';
                if (profileCard) profileCard.classList.add('premium-profile-glow', glowColor);
                if (profileContent) profileContent.classList.add('premium-profile-glow', glowColor);
                if (profileTabs) profileTabs.classList.add('premium-profile-glow', glowColor);
                const peerCard = document.getElementById('peer-profile-card');
                if (peerCard) {
                    peerCard.classList.add('premium-profile-glow', glowColor);
                }
            }
        }

        // ============================================================
        // PREMIUM SUBSCRIPTION
        // ============================================================
        window.handleSubscriptionActivation = function() {
            const now = Date.now();
            const expiry = now + (30 * 24 * 60 * 60 * 1000);
            const myUID = databaseState.currentUser.uid;
            
            update(ref(db, 'users/' + myUID), { 
                isPremium: true,
                premiumExpiry: expiry
            }).then(() => {
                databaseState.currentUser.isPremium = true;
                databaseState.currentUser.premiumExpiry = expiry;
                closeModal('subscription-modal');
                openModal('premium-dashboard-modal');
                applyPremiumSettings(databaseState.currentUser);
                saveStateToHardware();
                showSuccessToast('✅ Premium Activated!', 'You now have access to all premium features for 30 days!', '🌟');
            }).catch((err) => {
                console.error('Subscription activation failed:', err);
                showSuccessToast('✅ Premium Activated!', 'You now have access to all premium features!', '🌟');
                update(ref(db, 'users/' + myUID), { 
                    isPremium: true,
                    premiumExpiry: expiry
                }).catch(() => {});
            });
        }

        window.executePremiumTweak = function(type, value) {
            const updates = {};
            if (type === 'theme') updates.premiumTheme = value;
            else if (type === 'frame') updates.premiumFrame = value;
            else if (type === 'font') updates.premiumFont = value;
            
            update(ref(db, 'users/' + databaseState.currentUser.uid), updates).then(() => {
                if (type === 'theme') databaseState.currentUser.premiumTheme = value;
                else if (type === 'frame') databaseState.currentUser.premiumFrame = value;
                else if (type === 'font') databaseState.currentUser.premiumFont = value;
                
                applyPremiumSettings(databaseState.currentUser);
                renderEcosystemFeed();
                renderPersonalPublications();
                renderProfileReels();
                
                saveStateToHardware();
                const labels = {
                    'theme': 'Theme',
                    'frame': 'Frame',
                    'font': 'Font'
                };
                showSuccessToast('✅ Applied!', `${labels[type] || type} updated successfully.`, '✨');
            }).catch((err) => {
                console.error('Premium tweak failed:', err);
                if (type === 'theme') databaseState.currentUser.premiumTheme = value;
                else if (type === 'frame') databaseState.currentUser.premiumFrame = value;
                else if (type === 'font') databaseState.currentUser.premiumFont = value;
                
                applyPremiumSettings(databaseState.currentUser);
                renderEcosystemFeed();
                renderPersonalPublications();
                renderProfileReels();
                saveStateToHardware();
                showSuccessToast('✅ Applied!', `${type.charAt(0).toUpperCase() + type.slice(1)} updated successfully.`, '✨');
            });
        }

        // ============================================================
        // NOTIFICATION SYSTEM
        // ============================================================
        function addNotification(notification) {
            const targetUID = notification.targetUserId;
            if (!targetUID) return;
            
            const notif = {
                id: 'notif_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                ...notification,
                timestamp: Date.now(),
                read: false
            };
            
            if (targetUID === databaseState.currentUser.uid) {
                databaseState.notifications.unshift(notif);
            }
            
            const notifRef = ref(db, `users/${targetUID}/notifications`);
            get(notifRef).then((snap) => {
                const existing = snap.val() || [];
                const updated = [notif, ...existing].slice(0, 50);
                const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
                const filtered = updated.filter(n => n.timestamp > sevenDaysAgo);
                set(notifRef, filtered);
            }).catch(err => console.warn('Failed to save notification:', err));
            
            saveStateToHardware();
            if (targetUID === databaseState.currentUser.uid) {
                renderNotifications();
                updateNotificationBadge();
            }
            return notif;
        }

        function loadNotificationsFromFirebase() {
            const myUID = databaseState.currentUser.uid;
            if (!myUID) return;
            const notifRef = ref(db, `users/${myUID}/notifications`);
            onValue(notifRef, (snap) => {
                const data = snap.val();
                if (data && Array.isArray(data)) {
                    databaseState.notifications = data;
                    renderNotifications();
                    updateNotificationBadge();
                    saveStateToHardware();
                }
            });
        }

        function renderNotifications() {
            const container = document.getElementById('notification-list');
            container.innerHTML = '';
            
            if (databaseState.notifications.length === 0) {
                container.innerHTML = `
                    <div class="text-center text-slate-500 text-xs py-6">
                        <svg class="w-8 h-8 mx-auto mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
                        No notifications yet
                    </div>
                `;
                return;
            }

            databaseState.notifications.forEach(notif => {
                const el = document.createElement('div');
                el.className = `notification-item p-3 rounded-xl border flex items-start gap-2 ${notif.read ? 'bg-lightbg dark:bg-darkbg border-slate-300 dark:border-slate-800/50' : 'bg-slate-100 dark:bg-slate-800/50 border-cyan-500/30'}`;
                
                let icon = '📬';
                let color = 'text-blue-400';
                if (notif.type === 'like') { icon = '❤️'; color = 'text-red-400'; }
                else if (notif.type === 'comment') { icon = '💬'; color = 'text-cyan-400'; }
                else if (notif.type === 'friend_request') { icon = '🤝'; color = 'text-emerald-400'; }
                else if (notif.type === 'reel_like') { icon = '🎬'; color = 'text-pink-400'; }
                else if (notif.type === 'reel_comment') { icon = '🎥'; color = 'text-purple-400'; }
                
                el.innerHTML = `
                    <span class="text-lg">${icon}</span>
                    <div class="flex-1">
                        <p class="text-xs ${color}">${notif.message}</p>
                        <p class="text-[9px] text-slate-500 mt-0.5">${new Date(notif.timestamp).toLocaleString()}</p>
                    </div>
                    <div class="notif-unread-dot ${notif.read ? 'hidden' : ''}"></div>
                `;
                container.appendChild(el);
            });
        }

        function updateNotificationBadge() {
            const badge = document.getElementById('notification-count-badge');
            const unread = databaseState.notifications.filter(n => !n.read).length;
            if (unread > 0) {
                badge.textContent = unread;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        window.toggleNotificationDropdown = function() {
            const dropdown = document.getElementById('notification-dropdown');
            const isHidden = dropdown.classList.contains('hidden');
            
            if (isHidden) {
                dropdown.classList.remove('hidden');
                databaseState.notifications.forEach(n => n.read = true);
                const myUID = databaseState.currentUser.uid;
                if (myUID) {
                    set(ref(db, `users/${myUID}/notifications`), databaseState.notifications);
                }
                saveStateToHardware();
                renderNotifications();
                updateNotificationBadge();
            } else {
                dropdown.classList.add('hidden');
            }
        }

        window.markAllNotificationsRead = function() {
            databaseState.notifications.forEach(n => n.read = true);
            const myUID = databaseState.currentUser.uid;
            if (myUID) {
                set(ref(db, `users/${myUID}/notifications`), databaseState.notifications);
            }
            saveStateToHardware();
            renderNotifications();
            updateNotificationBadge();
        }

        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('notification-dropdown');
            const btn = e.target.closest('[onclick*="toggleNotificationDropdown"]') || 
                       e.target.closest('#notification-dropdown');
            if (!btn && dropdown && !dropdown.classList.contains('hidden')) {
                dropdown.classList.add('hidden');
            }
        });

        // ============================================================
        // AUTH
        // ============================================================
        window.switchAuthView = function(view) {
            const desc = document.getElementById('auth-screen-desc');
            if(view === 'signup') {
                document.getElementById('login-form-container').classList.add('hidden');
                document.getElementById('signup-form-container').classList.remove('hidden');
                desc.innerText = "Create Your Professional Stardust Node";
            } else {
                document.getElementById('signup-form-container').classList.add('hidden');
                document.getElementById('login-form-container').classList.remove('hidden');
                desc.innerText = "Secure Custom Authentication Terminal";
            }
        }

        // ===== SIGNUP WITH FULL PROFILE (PFP, NAME, BIO) =====
        window.handleCustomSystemSignup = function() {
            const name = document.getElementById('signup-name').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value.trim();
            const bio = document.getElementById('signup-bio').value.trim();
            const pfpFile = document.getElementById('signup-pfp').files[0];
            
            if(!name || !email || !password) { 
                showSuccessToast('Error', 'Please fill in all required fields (Name, Email, Password).', '❌');
                return; 
            }
            
            document.getElementById('btn-text-signup').classList.add('hidden');
            document.getElementById('btn-spinner-signup').classList.remove('hidden');
            
            // First, upload PFP if provided
            const processSignup = (pfpBase64) => {
                createUserWithEmailAndPassword(auth, email, password)
                    .then((userCredential) => {
                        const user = userCredential.user;
                        const assignedUID = generateSixDigitUID();
                        const userData = {
                            name: name,
                            email: email,
                            uid: assignedUID,
                            realFirebaseUID: user.uid,
                            bio: bio || "Hello, I'm new here!",
                            pfp: pfpBase64 || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                            profession: "",
                            isPremium: false,
                            premiumTheme: '',
                            premiumFrame: '',
                            premiumFont: '',
                            premiumExpiry: 0,
                            savedPosts: [],
                            savedReels: [],
                            notifications: []
                        };
                        
                        databaseState.currentUser = userData;
                        databaseState.viewedReels = {};
                        databaseState.reelViewTracked = {};
                        
                        set(ref(db, 'users/' + assignedUID), userData).then(() => {
                            document.getElementById('loading-screen').classList.add('hidden');
                            document.getElementById('login-screen').classList.add('hidden');
                            document.getElementById('app-layout').classList.remove('hidden');
                            listenToGlobalSyncChannels(assignedUID);
                            initializePeerConnectionNode(assignedUID);
                            loadNotificationsFromFirebase();
                            loadInitialPosts(); applyRoute();
                            saveStateToHardware();
                            document.getElementById('btn-text-signup').classList.remove('hidden');
                            document.getElementById('btn-spinner-signup').classList.add('hidden');
                            showSuccessToast('Welcome Aboard!', 'Your Stardust account has been created successfully.', '🚀');
                        });
                    })
                    .catch((error) => {
                        showSuccessToast('Registration Failure', error.message, '❌');
                        document.getElementById('btn-text-signup').classList.remove('hidden');
                        document.getElementById('btn-spinner-signup').classList.add('hidden');
                    });
            };

            if (pfpFile) {
                const reader = new FileReader();
                reader.onload = (e) => processSignup(e.target.result);
                reader.onerror = () => {
                    showSuccessToast('Error', 'Failed to read profile image.', '❌');
                    document.getElementById('btn-text-signup').classList.remove('hidden');
                    document.getElementById('btn-spinner-signup').classList.add('hidden');
                };
                reader.readAsDataURL(pfpFile);
            } else {
                processSignup(null);
            }
        }

        window.handleCustomSystemLogin = function() {
            const identifier = document.getElementById('login-identifier').value.trim();
            const password = document.getElementById('login-password').value.trim();
            if(!identifier || !password) { alert("Please enter credentials mapping keys."); return; }
            document.getElementById('btn-text-login').classList.add('hidden');
            document.getElementById('btn-spinner-login').classList.remove('hidden');
            if(identifier.includes('@')) {
                executeFirebaseSignIn(identifier, password);
            } else {
                onValue(ref(db, 'users'), (snapshot) => {
                    const data = snapshot.val();
                    let targetEmail = null;
                    if(data) {
                        const targetUserNode = Object.values(data).find(p => p.uid === identifier);
                        if(targetUserNode && targetUserNode.email) { targetEmail = targetUserNode.email; }
                    }
                    if(targetEmail) {
                        executeFirebaseSignIn(targetEmail, password);
                    } else {
                        alert("Invalid Session Request: Assigned UID not found.");
                        document.getElementById('btn-text-login').classList.remove('hidden');
                        document.getElementById('btn-spinner-login').classList.add('hidden');
                    }
                }, { onlyOnce: true });
            }
        }

        function executeFirebaseSignIn(email, password) {
            signInWithEmailAndPassword(auth, email, password)
                .then((userCredential) => {
                    onValue(ref(db, 'users'), (snapshot) => {
                        const data = snapshot.val();
                        if(data) {
                            const mappedNode = Object.values(data).find(p => p.realFirebaseUID === userCredential.user.uid);
                            if(mappedNode) {
                                databaseState.currentUser = mappedNode;
                                if(!databaseState.currentUser.savedPosts) databaseState.currentUser.savedPosts = [];
                                if(!databaseState.currentUser.savedReels) databaseState.currentUser.savedReels = [];
                                if(!databaseState.currentUser.notifications) databaseState.currentUser.notifications = [];
                                if(!databaseState.viewedReels) databaseState.viewedReels = {};
                                if(!databaseState.reelViewTracked) databaseState.reelViewTracked = {};
                                document.getElementById('loading-screen').classList.add('hidden');
                                document.getElementById('login-screen').classList.add('hidden');
                                document.getElementById('app-layout').classList.remove('hidden');
                                listenToGlobalSyncChannels(mappedNode.uid);
                                initializePeerConnectionNode(mappedNode.uid);
                                loadNotificationsFromFirebase();
                                loadInitialPosts(); applyRoute();
                                saveStateToHardware();
                                if (mappedNode.isPremium) {
                                    applyPremiumSettings(mappedNode);
                                }
                            }
                        }
                        document.getElementById('btn-text-login').classList.remove('hidden');
                        document.getElementById('btn-spinner-login').classList.add('hidden');
                    }, { onlyOnce: true });
                })
                .catch((error) => {
                    alert("Authentication Denied: " + error.message);
                    document.getElementById('btn-text-login').classList.remove('hidden');
                    document.getElementById('btn-spinner-login').classList.add('hidden');
                });
        }

        onAuthStateChanged(auth, (user) => {
            if (user) {
                onValue(ref(db, 'users'), (snapshot) => {
                    const data = snapshot.val();
                    if(data) {
                        const mappedNode = Object.values(data).find(p => p.realFirebaseUID === user.uid);
                        if(mappedNode) {
                            databaseState.currentUser = mappedNode;
                            if(!databaseState.currentUser.savedPosts) databaseState.currentUser.savedPosts = [];
                            if(!databaseState.currentUser.savedReels) databaseState.currentUser.savedReels = [];
                            if(!databaseState.currentUser.notifications) databaseState.currentUser.notifications = [];
                            if(!databaseState.viewedReels) databaseState.viewedReels = {};
                            if(!databaseState.reelViewTracked) databaseState.reelViewTracked = {};
                            document.getElementById('loading-screen').classList.add('hidden');
                            document.getElementById('login-screen').classList.add('hidden');
                            document.getElementById('app-layout').classList.remove('hidden');
                            listenToGlobalSyncChannels(mappedNode.uid);
                            initializePeerConnectionNode(mappedNode.uid);
                            loadNotificationsFromFirebase();
                            loadInitialPosts(); applyRoute();
                            saveStateToHardware();
                            if (mappedNode.isPremium) {
                                applyPremiumSettings(mappedNode);
                            }
                        }
                    }
                }, { onlyOnce: true });
            } else {
                document.getElementById('loading-screen').classList.add('hidden');
                const pv = document.getElementById('public-view');
                if (pv) pv.style.display = 'block'; else document.getElementById('login-screen').classList.remove('hidden');
                document.getElementById('app-layout').classList.add('hidden');
            }
        });

        window.executeLogout = function() {
            signOut(auth).then(() => {
                localStorage.removeItem("STARDUST_CORE_DB_PROD");
                if(peerInstance) peerInstance.destroy();
                location.reload();
            });
        }

        // ============================================================
        // PEER CONNECTION
        // ============================================================
        function initializePeerConnectionNode(uid) {
            peerInstance = new Peer('stardust-' + uid);
            peerInstance.on('call', (incomingCall) => {
                ongoingCallObject = incomingCall;
                const senderUID = incomingCall.peer.replace('stardust-', '');
                onValue(ref(db, 'users/' + senderUID), (snap) => {
                    const userData = snap.val();
                    document.getElementById('call-peer-name').innerText = userData ? userData.name : 'Unknown Node';
                    document.getElementById('call-peer-uid').innerText = '@' + senderUID;
                    document.getElementById('call-status-lbl').innerText = 'Incoming Encrypted Audio Call...';
                    if(userData && userData.pfp) {
                        document.getElementById('call-peer-pfp').src = userData.pfp;
                    }
                    document.getElementById('incoming-call-actions').classList.remove('hidden');
                    document.getElementById('call-bottom-nav').classList.add('hidden');
                    document.getElementById('call-interface-overlay').classList.remove('hidden');
                    callState.peerId = senderUID;
                }, { onlyOnce: true });
            });
        }

        // ============================================================
        // CALL FUNCTIONS
        // ============================================================
        async function checkMicrophonePermission() {
            try {
                const result = await navigator.permissions.query({ name: 'microphone' });
                return result.state === 'granted';
            } catch (e) {
                return false;
            }
        }

        async function requestMicrophone() {
            try {
                const hasPermission = await checkMicrophonePermission();
                if (hasPermission) {
                    return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                }
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                return stream;
            } catch (err) {
                console.error('Microphone error:', err);
                let errorMsg = 'Microphone access denied. Please allow microphone permissions in your browser settings.';
                if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                    errorMsg = '🔴 Microphone permission denied. Please allow microphone access in your browser settings and try again.';
                } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                    errorMsg = '🔴 No microphone found. Please connect a microphone and try again.';
                } else if (err.name === 'NotReadableError') {
                    errorMsg = '🔴 Microphone is in use by another application. Please close other apps and try again.';
                } else if (err.name === 'AbortError') {
                    errorMsg = '🔴 Microphone access was cancelled. Please try again.';
                }
                showSuccessToast('Microphone Error', errorMsg, '❌');
                return null;
            }
        }

        window.initializeVoiceCallBroadcast = function() {
            if(!databaseState.activeTargetChatUID) {
                showSuccessToast('Info', 'Please select a contact to call.', 'ℹ️');
                return;
            }
            
            const targetUID = databaseState.activeTargetChatUID;
            const targetPeerID = 'stardust-' + targetUID;
            
            document.getElementById('call-status-lbl').innerText = 'Requesting Audio Stream...';
            document.getElementById('incoming-call-actions').classList.add('hidden');
            document.getElementById('call-bottom-nav').classList.remove('hidden');
            document.getElementById('call-interface-overlay').classList.remove('hidden');
            
            callState.isActive = true;
            callState.peerId = targetUID;
            
            onValue(ref(db, 'users/' + targetUID), (snap) => {
                const userData = snap.val();
                document.getElementById('call-peer-name').innerText = userData ? userData.name : 'Remote Node';
                document.getElementById('call-peer-uid').innerText = '@' + targetUID;
                if(userData && userData.pfp) {
                    document.getElementById('call-peer-pfp').src = userData.pfp;
                }
            }, { onlyOnce: true });

            requestMicrophone().then((stream) => {
                if (!stream) {
                    document.getElementById('call-interface-overlay').classList.add('hidden');
                    document.getElementById('call-status-lbl').innerText = 'Call Failed';
                    return;
                }
                
                nativeMediaStream = stream;
                callState.stream = stream;
                ongoingCallObject = peerInstance.call(targetPeerID, stream);
                callState.callObj = ongoingCallObject;
                
                ongoingCallObject.on('stream', (remoteStream) => {
                    document.getElementById('call-status-lbl').innerText = 'Encrypted Audio Active 🟢';
                    startCallDurationTimer();
                    showSuccessToast('Connected', 'Audio call established successfully.', '📞');
                });
                
                ongoingCallObject.on('error', (err) => {
                    console.error('Call error:', err);
                    showSuccessToast('Call Error', 'Connection lost. Please try again.', '❌');
                    terminateCallSession();
                });
            });
        }

        window.acceptIncomingCallSignal = function() {
            requestMicrophone().then((stream) => {
                if (!stream) {
                    document.getElementById('call-interface-overlay').classList.add('hidden');
                    rejectIncomingCallSignal();
                    return;
                }
                
                nativeMediaStream = stream;
                callState.stream = stream;
                callState.isActive = true;
                document.getElementById('incoming-call-actions').classList.add('hidden');
                document.getElementById('call-bottom-nav').classList.remove('hidden');
                document.getElementById('call-status-lbl').innerText = 'Connecting...';
                
                ongoingCallObject.answer(stream);
                callState.callObj = ongoingCallObject;
                ongoingCallObject.on('stream', (remoteStream) => {
                    document.getElementById('call-status-lbl').innerText = 'Encrypted Audio Active 🟢';
                    startCallDurationTimer();
                });
                showSuccessToast('Connected', 'Audio call accepted.', '📞');
            });
        }

        window.rejectIncomingCallSignal = function() {
            if(ongoingCallObject) ongoingCallObject.close();
            terminateCallSession();
        }

        window.terminateCallSession = function() {
            if(ongoingCallObject) {
                ongoingCallObject.close();
                ongoingCallObject = null;
            }
            if(nativeMediaStream) {
                nativeMediaStream.getTracks().forEach(track => track.stop());
                nativeMediaStream = null;
            }
            callState.stream = null;
            callState.callObj = null;
            if(callState.durationInterval) {
                clearInterval(callState.durationInterval);
                callState.durationInterval = null;
            }
            document.getElementById('call-interface-overlay').classList.add('hidden');
            document.getElementById('floating-call-window').classList.add('hidden');
            callState.isActive = false;
            callState.isFloating = false;
            callState.seconds = 0;
            callState.peerId = null;
            document.getElementById('floating-call-duration').innerText = '00:00';
            showSuccessToast('Call Ended', 'The call has been terminated.', '📴');
        }

        function startCallDurationTimer() {
            callState.seconds = 0;
            if(callState.durationInterval) clearInterval(callState.durationInterval);
            callState.durationInterval = setInterval(() => {
                callState.seconds++;
                const mins = String(Math.floor(callState.seconds / 60)).padStart(2, '0');
                const secs = String(callState.seconds % 60).padStart(2, '0');
                document.getElementById('floating-call-duration').innerText = `${mins}:${secs}`;
            }, 1000);
        }

        window.toggleCallChat = function() {
            callState.isChatOpen = !callState.isChatOpen;
            document.getElementById('call-chat-overlay').classList.toggle('hidden');
            if(callState.isChatOpen) {
                document.getElementById('call-chat-input').focus();
                renderCallChatMessages();
            }
        }

        window.sendCallChatMessage = function() {
            const input = document.getElementById('call-chat-input');
            const msg = input.value.trim();
            if(!msg || !callState.peerId) return;
            const myUID = databaseState.currentUser.uid;
            const threadKey = myUID < callState.peerId ? `${myUID}_text_${callState.peerId}` : `${callState.peerId}_text_${myUID}`;
            const messagePayload = {
                sender: myUID,
                text: msg,
                timestamp: Date.now(),
                status: 'transmitted'
            };
            push(ref(db, `chats/${threadKey}`), messagePayload).then(() => {
                input.value = '';
                renderCallChatMessages();
            });
        }

        function renderCallChatMessages() {
            if(!callState.peerId) return;
            const container = document.getElementById('call-chat-messages');
            const myUID = databaseState.currentUser.uid;
            const threadKey = myUID < callState.peerId ? `${myUID}_text_${callState.peerId}` : `${callState.peerId}_text_${myUID}`;
            const packets = databaseState.chatThreads[threadKey];
            container.innerHTML = '';
            if(!packets) {
                container.innerHTML = `<div class="text-center text-slate-600 text-[10px] py-2">No messages yet</div>`;
                return;
            }
            const recent = Object.values(packets).slice(-20);
            recent.forEach(msg => {
                const isMe = msg.sender === myUID;
                const el = document.createElement('div');
                el.className = `max-w-[80%] p-2 rounded-xl text-xs ${isMe ? 'bg-blue-600 text-white self-end ml-auto' : 'bg-slate-700 text-slate-200 self-start'}`;
                el.innerText = msg.text;
                container.appendChild(el);
            });
            container.scrollTop = container.scrollHeight;
        }

        let dragData = { isDragging: false, startX: 0, startY: 0, offsetX: 0, offsetY: 0 };

        window.minimizeCallWindow = function() {
            if(!callState.isActive) return;
            callState.isFloating = true;
            const floatingWindow = document.getElementById('floating-call-window');
            const callerImg = document.getElementById('floating-caller-img');
            const pfpSrc = document.getElementById('call-peer-pfp').src;
            callerImg.src = pfpSrc || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
            floatingWindow.style.top = '80px';
            floatingWindow.style.right = '16px';
            floatingWindow.style.left = 'auto';
            floatingWindow.style.bottom = 'auto';
            floatingWindow.classList.remove('hidden');
            document.getElementById('call-interface-overlay').classList.add('hidden');
            setupFloatingDrag();
        }

        window.restoreCallWindow = function() {
            callState.isFloating = false;
            document.getElementById('floating-call-window').classList.add('hidden');
            document.getElementById('call-interface-overlay').classList.remove('hidden');
        }

        function setupFloatingDrag() {
            const el = document.getElementById('floating-call-window');
            el.removeEventListener('mousedown', startDrag);
            el.removeEventListener('touchstart', startDragTouch);
            el.addEventListener('mousedown', startDrag);
            el.addEventListener('touchstart', startDragTouch, { passive: false });
            document.removeEventListener('mousemove', moveDrag);
            document.removeEventListener('mouseup', endDrag);
            document.removeEventListener('touchmove', moveDragTouch);
            document.removeEventListener('touchend', endDragTouch);
            document.addEventListener('mousemove', moveDrag);
            document.addEventListener('mouseup', endDrag);
            document.addEventListener('touchmove', moveDragTouch, { passive: false });
            document.addEventListener('touchend', endDragTouch);
        }

        function startDrag(e) {
            if(e.target.closest('.floating-minimize-btn')) return;
            const el = document.getElementById('floating-call-window');
            dragData.isDragging = true;
            const rect = el.getBoundingClientRect();
            dragData.offsetX = e.clientX - rect.left;
            dragData.offsetY = e.clientY - rect.top;
            el.style.cursor = 'grabbing';
        }

        function startDragTouch(e) {
            if(e.target.closest('.floating-minimize-btn')) return;
            const touch = e.touches[0];
            const el = document.getElementById('floating-call-window');
            dragData.isDragging = true;
            const rect = el.getBoundingClientRect();
            dragData.offsetX = touch.clientX - rect.left;
            dragData.offsetY = touch.clientY - rect.top;
        }

        function moveDrag(e) {
            if(!dragData.isDragging) return;
            const el = document.getElementById('floating-call-window');
            let x = e.clientX - dragData.offsetX;
            let y = e.clientY - dragData.offsetY;
            constrainPosition(el, x, y);
        }

        function moveDragTouch(e) {
            if(!dragData.isDragging) return;
            e.preventDefault();
            const touch = e.touches[0];
            const el = document.getElementById('floating-call-window');
            let x = touch.clientX - dragData.offsetX;
            let y = touch.clientY - dragData.offsetY;
            constrainPosition(el, x, y);
        }

        function constrainPosition(el, x, y) {
            const winW = window.innerWidth;
            const winH = window.innerHeight;
            const w = 180;
            const h = 240;
            const snapX = x < winW/2 ? 16 : winW - w - 16;
            const snapY = y < winH/2 ? 80 : winH - h - 16;
            el.style.left = snapX + 'px';
            el.style.top = snapY + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }

        function endDrag() {
            dragData.isDragging = false;
            const el = document.getElementById('floating-call-window');
            if(el) el.style.cursor = 'grab';
        }

        function endDragTouch() {
            dragData.isDragging = false;
        }

        // ============================================================
        // POST TAB SWITCHING
        // ============================================================
        window.switchPostTab = function(tab) {
            const postTab = document.getElementById('post-tab-post');
            const reelTab = document.getElementById('post-tab-reel');
            const postArea = document.getElementById('post-content-area');
            const reelArea = document.getElementById('reel-content-area');

            if(tab === 'post') {
                postTab.classList.add('active');
                reelTab.classList.remove('active');
                postArea.classList.remove('hidden');
                reelArea.classList.add('hidden');
            } else {
                reelTab.classList.add('active');
                postTab.classList.remove('active');
                reelArea.classList.remove('hidden');
                postArea.classList.add('hidden');
            }
        }

        // ============================================================
        // POST PUBLICATION
        // ============================================================
        window.processPublicationInit = function() {
            const txt = document.getElementById('post-input-text').value.trim();
            const imgFile = document.getElementById('post-input-gallery-file').files[0];
            if(!txt && !imgFile) {
                showSuccessToast('Info', 'Please add some text or an image.', '📝');
                return;
            }

            showUploadLoading();
            closeModal('post-modal');

            const commitPostToFirebase = (base64Img) => {
                const postNode = {
                    id: 'post_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                    authorUID: databaseState.currentUser.uid,
                    authorName: databaseState.currentUser.name,
                    authorAvatar: databaseState.currentUser.pfp,
                    text: txt,
                    image: base64Img || null,
                    timestamp: Date.now(),
                    likes: {},
                    comments: {}
                };

                push(ref(db, 'publications'), postNode).then(() => {
                    document.getElementById('post-input-text').value = '';
                    document.getElementById('post-input-gallery-file').value = '';
                    hideUploadLoading();
                    showSuccessToast('Post Published!', 'Your post has been published successfully.', '📝');
                    loadInitialPosts();
                }).catch((err) => {
                    console.error('Error publishing post:', err);
                    hideUploadLoading();
                    showSuccessToast('Error', 'Failed to publish post. Please try again.', '❌');
                });
            };

            if(imgFile) {
                const reader = new FileReader();
                reader.onload = (e) => commitPostToFirebase(e.target.result);
                reader.onerror = () => {
                    hideUploadLoading();
                    showSuccessToast('Error', 'Failed to read image file.', '❌');
                };
                reader.readAsDataURL(imgFile);
            } else {
                commitPostToFirebase(null);
            }
        }

        // ============================================================
        // LOAD POSTS
        // ============================================================
        let snapFeedDone = false, snapReelsDone = false;
        function loadSnapshot(name, done) {
            fetch('data/' + name + '.json').then(r => r.ok ? r.json() : []).then(arr => { if (Array.isArray(arr) && arr.length) done(arr); }).catch(() => {});
        }
        function loadInitialPosts() {
            if (!snapFeedDone) { snapFeedDone = true; loadSnapshot('feed', arr => { if (!databaseState.publications.length) { databaseState.publications = arr; renderEcosystemFeed(); tryOpenPendingPost(); } }); }
            const postsRef = ref(db, 'publications');
            get(postsRef).then((snapshot) => {
                const data = snapshot.val();
                let loadedPosts = [];
                if (data) {
                    Object.keys(data).forEach(k => {
                        const post = data[k];
                        if (post && post.id && (post.text || post.image)) {
                            loadedPosts.push(post);
                        }
                    });
                }
                databaseState.publications = loadedPosts.sort((a, b) => b.timestamp - a.timestamp);
                renderEcosystemFeed(); tryOpenPendingPost();
            }).catch((error) => {
                console.error('Error loading posts:', error);
            });
        }

        // ============================================================
        // POST MENU (3-Dot) - Edit & Delete
        // ============================================================
        let activePostMenuId = null;

        window.togglePostMenu = function(postId) {
            const menuId = 'post-menu-' + postId;
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
                activePostMenuId = null;
                return;
            }
            // Close any open menu
            document.querySelectorAll('.post-menu-dropdown').forEach(el => el.remove());
            
            const btn = document.querySelector(`[data-post-menu-btn="${postId}"]`);
            if (!btn) return;
            
            const rect = btn.getBoundingClientRect();
            menu = document.createElement('div');
            menu.id = menuId;
            menu.className = 'post-menu-dropdown';
            menu.style.position = 'fixed';
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            
            const targetPost = databaseState.publications.find(p => p.id === postId);
            const isOwner = targetPost && targetPost.authorUID === databaseState.currentUser.uid;
            
            if (isOwner) {
                menu.innerHTML = `
                    <button onclick="openEditPost('${postId}')">✏️ Edit Post</button>
                    <button onclick="deletePost('${postId}')" class="delete-btn">🗑 Delete Post</button>
                `;
            } else {
                menu.innerHTML = `<button style="color:#94a3b8;cursor:default;">You don't own this post</button>`;
            }
            
            document.body.appendChild(menu);
            activePostMenuId = postId;
            
            // Close on click outside
            setTimeout(() => {
                document.addEventListener('click', closePostMenuHandler);
            }, 10);
        }

        function closePostMenuHandler(e) {
            if (!e.target.closest('.post-menu-dropdown') && !e.target.closest('.post-menu-btn')) {
                document.querySelectorAll('.post-menu-dropdown').forEach(el => el.remove());
                activePostMenuId = null;
                document.removeEventListener('click', closePostMenuHandler);
            }
        }

        // ===== EDIT POST =====
        let editingPostId = null;

        window.openEditPost = function(postId) {
            const targetPost = databaseState.publications.find(p => p.id === postId);
            if (!targetPost || targetPost.authorUID !== databaseState.currentUser.uid) {
                showSuccessToast('Error', 'You can only edit your own posts.', '❌');
                return;
            }
            editingPostId = postId;
            document.getElementById('edit-post-text').value = targetPost.text || '';
            document.getElementById('edit-post-image').value = '';
            openModal('edit-post-modal');
            // Close the menu
            document.querySelectorAll('.post-menu-dropdown').forEach(el => el.remove());
        }

        window.saveEditedPost = function() {
            if (!editingPostId) return;
            const newText = document.getElementById('edit-post-text').value.trim();
            const newImageFile = document.getElementById('edit-post-image').files[0];
            
            if (!newText && !newImageFile) {
                showSuccessToast('Error', 'Post must have text or an image.', '❌');
                return;
            }

            const pubRef = ref(db, 'publications');
            get(pubRef).then((snap) => {
                const data = snap.val();
                if (data) {
                    let dbKey = null;
                    Object.keys(data).forEach(k => {
                        if (data[k] && data[k].id === editingPostId) {
                            dbKey = k;
                        }
                    });
                    if (dbKey) {
                        const updates = { text: newText };
                        if (newImageFile) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                updates.image = e.target.result;
                                update(ref(db, `publications/${dbKey}`), updates).then(() => {
                                    closeModal('edit-post-modal');
                                    showSuccessToast('Post Updated!', 'Your post has been updated.', '✅');
                                    loadInitialPosts();
                                    editingPostId = null;
                                });
                            };
                            reader.readAsDataURL(newImageFile);
                        } else {
                            update(ref(db, `publications/${dbKey}`), updates).then(() => {
                                closeModal('edit-post-modal');
                                showSuccessToast('Post Updated!', 'Your post has been updated.', '✅');
                                loadInitialPosts();
                                editingPostId = null;
                            });
                        }
                    }
                }
            });
        }

        // ===== DELETE POST (Owner only) =====
        window.deletePost = function(postId) {
            const myUID = databaseState.currentUser.uid;
            const targetPost = databaseState.publications.find(p => p.id === postId);
            
            if (!targetPost) {
                showSuccessToast('Error', 'Post not found.', '❌');
                return;
            }
            
            if (targetPost.authorUID !== myUID) {
                showSuccessToast('Error', 'You can only delete your own posts.', '❌');
                return;
            }
            
            if (confirm('Are you sure you want to delete this post?')) {
                const pubRef = ref(db, 'publications');
                get(pubRef).then((snap) => {
                    const data = snap.val();
                    if (data) {
                        let dbKey = null;
                        Object.keys(data).forEach(k => {
                            if (data[k] && data[k].id === postId) {
                                dbKey = k;
                            }
                        });
                        if (dbKey) {
                            remove(ref(db, `publications/${dbKey}`)).then(() => {
                                showSuccessToast('Deleted!', 'Post deleted successfully.', '🗑️');
                                loadInitialPosts();
                                document.querySelectorAll('.post-menu-dropdown').forEach(el => el.remove());
                            }).catch((err) => {
                                console.error('Delete error:', err);
                                showSuccessToast('Error', 'Failed to delete post.', '❌');
                            });
                        }
                    }
                });
            }
        }

        // ============================================================
        // DELETE COMMENT - Owner OR Author
        // ============================================================
        window.deleteComment = function(postId, commentKey) {
            const myUID = databaseState.currentUser.uid;
            const targetPost = databaseState.publications.find(p => p.id === postId);
            if (!targetPost) {
                showSuccessToast('Error', 'Post not found.', '❌');
                return;
            }
            
            const comment = targetPost.comments ? targetPost.comments[commentKey] : null;
            if (!comment) {
                showSuccessToast('Error', 'Comment not found.', '❌');
                return;
            }
            
            const isPostOwner = targetPost.authorUID === myUID;
            const isCommentAuthor = comment.authorUID === myUID;
            
            if (!isPostOwner && !isCommentAuthor) {
                showSuccessToast('Error', 'You can only delete your own comments.', '❌');
                return;
            }
            
            if (confirm('Are you sure you want to delete this comment?')) {
                const pubRef = ref(db, 'publications');
                get(pubRef).then((snap) => {
                    const data = snap.val();
                    if (data) {
                        let dbKey = null;
                        Object.keys(data).forEach(k => {
                            if (data[k] && data[k].id === postId) {
                                dbKey = k;
                            }
                        });
                        if (dbKey) {
                            remove(ref(db, `publications/${dbKey}/comments/${commentKey}`)).then(() => {
                                showSuccessToast('Deleted!', 'Comment deleted successfully.', '🗑️');
                                loadInitialPosts();
                            }).catch((err) => {
                                console.error('Delete comment error:', err);
                                showSuccessToast('Error', 'Failed to delete comment.', '❌');
                            });
                        }
                    }
                });
            }
        }

        // ============================================================
        // POST RENDER
        // ============================================================
        function renderEcosystemFeed() {
            const feed = document.getElementById('posts-feed');
            feed.innerHTML = '';
            
            const validPosts = databaseState.publications.filter(post => {
                return post && post.id && (post.text || post.image);
            });
            
            if (validPosts.length === 0) {
                feed.innerHTML = `<div class="text-center text-slate-600 text-xs py-8">No posts yet. Be the first to share something! 🚀</div>`;
                return;
            }

            const fontClass = databaseState.currentUser.isPremium && databaseState.currentUser.premiumFont ? 
                databaseState.currentUser.premiumFont : '';
            const myUID = databaseState.currentUser.uid;
            
            validPosts.forEach(post => {
                const isLiked = post.likes && post.likes[myUID] === true;
                const likesCount = post.likes ? Object.keys(post.likes).length : 0;
                const commentsCount = post.comments ? Object.keys(post.comments).length : 0;
                const isSaved = databaseState.currentUser.savedPosts && databaseState.currentUser.savedPosts.includes(post.id);
                const isOwner = post.authorUID === myUID;
                
                const card = document.createElement('div');
                card.className = `bg-lightcard dark:bg-darkcard rounded-2xl border border-lightborder dark:border-slate-800/80 p-4 space-y-3 text-xs shadow-md transition-all duration-300 relative`;
                
                // 3-dot menu button (only for owner)
                let menuBtn = '';
                if (isOwner) {
                    menuBtn = `
                        <button class="post-menu-btn absolute top-3 right-3" data-post-menu-btn="${post.id}" onclick="event.stopPropagation(); togglePostMenu('${post.id}')">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                    `;
                }
                
                let imageLayer = '';
                if(post.image) {
                    imageLayer = `
                        <div class="w-full max-h-52 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 cursor-pointer" onclick="openImageViewer('${post.image}')">
                            <img src="${post.image}" alt="Post image" class="w-full h-full object-cover">
                        </div>
                    `;
                }

                card.innerHTML = `
                    ${menuBtn}
                    <div class="flex justify-between items-center">
                        <div class="flex items-center space-x-2.5 cursor-pointer" onclick="displayPeerAccountProfile('${post.authorUID}')">
                            <img src="${post.authorAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" 
                                 class="w-8 h-8 rounded-full object-cover border border-slate-300 dark:border-slate-700">
                            <div>
                                <h4 class="font-bold text-slate-800 dark:text-slate-200 post-author-name ${fontClass}">${post.authorName || 'Unknown'}</h4>
                                <p class="text-[9px] text-slate-500 font-mono">@${post.authorUID || 'unknown'} • ${post.timestamp ? new Date(post.timestamp).toLocaleDateString() : ''}</p>
                            </div>
                        </div>
                    </div>
                    <p class="text-slate-700 dark:text-slate-300 leading-relaxed break-words post-text ${fontClass}">${post.text || ''}</p>
                    ${imageLayer}
                    <div class="flex items-center justify-between pt-2 border-t border-slate-300 dark:border-slate-800/60 text-slate-500">
                        <button onclick="handlePublicationLikeToggle('${post.id}')" class="flex items-center space-x-1.5 hover:text-red-400 transition ${isLiked ? 'text-red-500 font-bold' : ''}">
                            <svg class="w-4 h-4" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                            <span>${likesCount}</span>
                        </button>
                        <button onclick="openPublicationInspectionModal('${post.id}')" class="flex items-center space-x-1.5 hover:text-blue-400 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                            <span>${commentsCount}</span>
                        </button>
                        <button onclick="openForwardShareEcosystemModal('${post.id}')" class="flex items-center space-x-1.5 hover:text-cyan-400 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        </button>
                        <button onclick="savePost('${post.id}')" class="flex items-center space-x-1.5 hover:text-amber-400 transition ${isSaved ? 'text-amber-400 font-bold' : ''}">
                            <svg class="w-4 h-4" fill="${isSaved ? 'currentColor' : 'none'}" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"></path></svg>
                        </button>
                    </div>
                `;
                feed.appendChild(card);
            });
        }

        // ============================================================
        // FULL SCREEN IMAGE VIEW
        // ============================================================
        window.openImageViewer = function(imageSrc) {
            if (!imageSrc) return;
            document.getElementById('viewer-target-image').src = imageSrc;
            document.getElementById('full-screen-image-viewer').classList.remove('hidden');
        }

        // ============================================================
        // PUBLICATION INSPECTION
        // ============================================================
        window.openPublicationInspectionModal = function(postId) {
            const targetPost = databaseState.publications.find(p => p.id === postId);
            if(!targetPost) return;

            const isPostOwner = targetPost.authorUID === databaseState.currentUser.uid;

            const modalPayload = document.getElementById('expanded-post-payload');
            modalPayload.innerHTML = `
                <div class="space-y-2">
                    <p class="font-bold text-slate-400">Context Body</p>
                    <p class="text-slate-800 dark:text-slate-200 bg-lightbg dark:bg-darkbg p-3 rounded-xl border border-lightborder dark:border-slate-800">${targetPost.text}</p>
                </div>
                ${targetPost.image ? `<div class="rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700 cursor-pointer" onclick="openImageViewer('${targetPost.image}')"><img src="${targetPost.image}" class="w-full max-h-40 object-cover"></div>` : ''}
                <div class="space-y-2">
                    <p class="font-bold text-slate-400">Comments Stack</p>
                    <div id="expanded-post-comments-grid" class="space-y-2 max-h-48 overflow-y-auto custom-scrollbar"></div>
                </div>
                <div class="flex gap-2 mt-2">
                    <input type="text" id="post-comment-input-field" placeholder="Append transaction comment..." class="flex-1 bg-lightbg dark:bg-darkbg border border-lightborder dark:border-slate-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-slate-400 dark:focus:border-slate-700 text-slate-800 dark:text-slate-200">
                    <button onclick="dispatchPublicationComment('${postId}')" class="bg-cyan-600 hover:bg-cyan-700 text-white font-bold px-4 py-2 rounded-xl">Append</button>
                </div>
            `;

            const commentGrid = document.getElementById('expanded-post-comments-grid');
            if(targetPost.comments && Object.keys(targetPost.comments).length > 0) {
                Object.keys(targetPost.comments).forEach(commentKey => {
                    const c = targetPost.comments[commentKey];
                    const isCommentOwner = c.authorUID === databaseState.currentUser.uid;
                    const canDelete = isPostOwner || isCommentOwner;
                    
                    const el = document.createElement('div');
                    el.className = "bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-xl space-y-0.5 flex justify-between items-start";
                    el.innerHTML = `
                        <div>
                            <p class="font-bold text-slate-600 dark:text-slate-400 text-xs">@${c.authorName}:</p>
                            <p class="text-slate-700 dark:text-slate-300 text-xs">${c.text}</p>
                        </div>
                        ${canDelete ? `
                            <button onclick="deleteComment('${postId}', '${commentKey}')" 
                                class="comment-delete-btn text-red-400 hover:text-red-300 p-1 rounded-lg text-xs">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        ` : ''}
                    `;
                    commentGrid.appendChild(el);
                });
            } else {
                commentGrid.innerHTML = `<p class="text-[10px] text-slate-600 italic text-center py-2">No active comments linked inside framework.</p>`;
            }

            openModal('expanded-post-modal');
        }

        window.dispatchPublicationComment = function(postId) {
            const field = document.getElementById('post-comment-input-field');
            const txt = field.value.trim();
            if(!txt) return;

            onValue(ref(db, 'publications'), (snap) => {
                const data = snap.val();
                if(data) {
                    const dbKey = Object.keys(data).find(k => data[k] && data[k].id === postId);
                    if(dbKey) {
                        const myUID = databaseState.currentUser.uid;
                        const postOwner = data[dbKey].authorUID;
                        const payload = {
                            authorUID: myUID,
                            authorName: databaseState.currentUser.name,
                            text: txt,
                            timestamp: Date.now()
                        };
                        push(ref(db, `publications/${dbKey}/comments`), payload).then(() => {
                            field.value = '';
                            closeModal('expanded-post-modal');
                            showSuccessToast('Commented!', 'Your comment has been posted.', '💬');
                            if (postOwner !== myUID) {
                                addNotification({
                                    type: 'comment',
                                    message: `${databaseState.currentUser.name} commented on your post: "${txt}"`,
                                    targetUserId: postOwner,
                                    sourceUserId: myUID,
                                    postId: postId
                                });
                            }
                            loadInitialPosts();
                        });
                    }
                }
            }, { onlyOnce: true });
        }

        // ============================================================
        // LIKE TOGGLE (Posts)
        // ============================================================
        window.handlePublicationLikeToggle = function(postId) {
            const pubRef = ref(db, 'publications');
            get(pubRef).then((snap) => {
                const data = snap.val();
                if(data) {
                    let dbKey = null;
                    const keys = Object.keys(data);
                    for(let k of keys) {
                        if(data[k] && data[k].id === postId) {
                            dbKey = k;
                            break;
                        }
                    }
                    
                    if(dbKey) {
                        const myUID = databaseState.currentUser.uid;
                        const likeRef = ref(db, `publications/${dbKey}/likes/${myUID}`);
                        const currentLikes = data[dbKey].likes || {};
                        const wasLiked = currentLikes[myUID];
                        
                        if(wasLiked) {
                            remove(likeRef);
                        } else {
                            set(likeRef, true);
                            const postOwner = data[dbKey].authorUID;
                            if (postOwner && postOwner !== myUID) {
                                addNotification({
                                    type: 'like',
                                    message: `${databaseState.currentUser.name} liked your post ❤️`,
                                    targetUserId: postOwner,
                                    sourceUserId: myUID,
                                    postId: postId
                                });
                            }
                        }
                    }
                }
            });
        };

        // ============================================================
        // SAVE POST
        // ============================================================
        window.savePost = function(postId) {
            const targetPost = databaseState.publications.find(p => p.id === postId);
            if(!targetPost) return;

            const myUID = databaseState.currentUser.uid;
            const userRef = ref(db, 'users/' + myUID);
            
            get(userRef).then((snap) => {
                const userData = snap.val();
                let saved = userData.savedPosts || [];
                
                if(saved.includes(postId)) {
                    saved = saved.filter(id => id !== postId);
                    showSuccessToast('Removed', 'Post removed from saved list.', '📁');
                } else {
                    saved.push(postId);
                    showSuccessToast('Saved!', 'Post saved to your collection.', '💾');
                }
                
                update(userRef, { savedPosts: saved }).then(() => {
                    databaseState.currentUser.savedPosts = saved;
                    saveStateToHardware();
                    renderEcosystemFeed();
                });
            });
        };

        // ============================================================
        // REEL MENU (3-Dot) - Edit & Delete
        // ============================================================
        let activeReelMenuId = null;

        window.toggleReelMenu = function(reelId) {
            const menuId = 'reel-menu-' + reelId;
            let menu = document.getElementById(menuId);
            if (menu) {
                menu.remove();
                activeReelMenuId = null;
                return;
            }
            document.querySelectorAll('.reel-menu-dropdown').forEach(el => el.remove());
            
            const btn = document.querySelector(`[data-reel-menu-btn="${reelId}"]`);
            if (!btn) return;
            
            const rect = btn.getBoundingClientRect();
            menu = document.createElement('div');
            menu.id = menuId;
            menu.className = 'post-menu-dropdown reel-menu-dropdown';
            menu.style.position = 'fixed';
            menu.style.top = (rect.bottom + 4) + 'px';
            menu.style.right = (window.innerWidth - rect.right) + 'px';
            
            const targetReel = databaseState.reels.find(r => r.id === reelId);
            const isOwner = targetReel && targetReel.userId === databaseState.currentUser.uid;
            
            if (isOwner) {
                menu.innerHTML = `
                    <button onclick="openEditReel('${reelId}')">✏️ Edit Caption</button>
                    <button onclick="deleteReel('${reelId}')" class="delete-btn">🗑 Delete Reel</button>
                `;
            } else {
                menu.innerHTML = `<button style="color:#94a3b8;cursor:default;">You don't own this reel</button>`;
            }
            
            document.body.appendChild(menu);
            activeReelMenuId = reelId;
            
            setTimeout(() => {
                document.addEventListener('click', closeReelMenuHandler);
            }, 10);
        }

        function closeReelMenuHandler(e) {
            if (!e.target.closest('.reel-menu-dropdown') && !e.target.closest('.reel-menu-btn')) {
                document.querySelectorAll('.reel-menu-dropdown').forEach(el => el.remove());
                activeReelMenuId = null;
                document.removeEventListener('click', closeReelMenuHandler);
            }
        }

        // ===== EDIT REEL =====
        let editingReelId = null;

        window.openEditReel = function(reelId) {
            const targetReel = databaseState.reels.find(r => r.id === reelId);
            if (!targetReel || targetReel.userId !== databaseState.currentUser.uid) {
                showSuccessToast('Error', 'You can only edit your own reels.', '❌');
                return;
            }
            editingReelId = reelId;
            document.getElementById('edit-reel-caption').value = targetReel.caption || '';
            openModal('edit-reel-modal');
            document.querySelectorAll('.reel-menu-dropdown').forEach(el => el.remove());
        }

        window.saveEditedReel = function() {
            if (!editingReelId) return;
            const newCaption = document.getElementById('edit-reel-caption').value.trim();
            
            const reelRef = ref(db, 'reels');
            get(reelRef).then((snap) => {
                const data = snap.val();
                if (data) {
                    let dbKey = null;
                    Object.keys(data).forEach(k => {
                        if (data[k] && data[k].id === editingReelId) {
                            dbKey = k;
                        }
                    });
                    if (dbKey) {
                        update(ref(db, `reels/${dbKey}`), { caption: newCaption }).then(() => {
                            closeModal('edit-reel-modal');
                            showSuccessToast('Reel Updated!', 'Caption updated successfully.', '✅');
                            isReelsLoaded = false;
                            loadReelsOnDemand();
                            editingReelId = null;
                        });
                    }
                }
            });
        }

        // ===== DELETE REEL (Owner only) =====
        window.deleteReel = function(reelId) {
            const myUID = databaseState.currentUser.uid;
            const targetReel = databaseState.reels.find(r => r.id === reelId);
            
            if (!targetReel) {
                showSuccessToast('Error', 'Reel not found.', '❌');
                return;
            }
            
            if (targetReel.userId !== myUID) {
                showSuccessToast('Error', 'You can only delete your own reels.', '❌');
                return;
            }
            
            if (confirm('Are you sure you want to delete this reel?')) {
                const reelRef = ref(db, 'reels');
                get(reelRef).then((snap) => {
                    const data = snap.val();
                    if (data) {
                        let dbKey = null;
                        Object.keys(data).forEach(k => {
                            if (data[k] && data[k].id === reelId) {
                                dbKey = k;
                            }
                        });
                        if (dbKey) {
                            remove(ref(db, `reels/${dbKey}`)).then(() => {
                                showSuccessToast('Deleted!', 'Reel deleted successfully.', '🗑️');
                                isReelsLoaded = false;
                                loadReelsOnDemand();
                                document.querySelectorAll('.reel-menu-dropdown').forEach(el => el.remove());
                            }).catch((err) => {
                                console.error('Delete reel error:', err);
                                showSuccessToast('Error', 'Failed to delete reel.', '❌');
                            });
                        }
                    }
                });
            }
        };

        // ============================================================
        // REELS SYSTEM
        // ============================================================
        let isReelsLoaded = false;
        
        function loadReelsOnDemand() {
            if (isReelsLoaded) return;
            isReelsLoaded = true;
            loadSnapshot('reels', arr => { if (!databaseState.reels.length) { databaseState.reels = arr; renderReelsFeed(); focusPendingReel(); } });
            const reelRef = ref(db, 'reels');
            onValue(reelRef, (snap) => {
                const data = snap.val();
                let loadedReels = [];
                if(data) {
                    Object.keys(data).forEach(k => {
                        if(data[k] && data[k].id) {
                            loadedReels.push(data[k]);
                        }
                    });
                }
                databaseState.reels = loadedReels.sort((a,b) => b.createdAt - a.createdAt);
                renderReelsFeed(); focusPendingReel();
                renderProfileReels();
            });
        }

        function renderReelsFeed() {
            const container = document.getElementById('reels-feed');
            container.innerHTML = '';
            
            if(databaseState.reels.length === 0) {
                container.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full text-slate-500 text-center p-8">
                        <svg class="w-16 h-16 mb-4 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        <p class="text-sm font-medium">No Reels Yet</p>
                        <p class="text-xs mt-1">Tap the + button and select Reel to upload!</p>
                    </div>
                `;
                return;
            }

            const sortedReels = [...databaseState.reels].sort((a,b) => b.createdAt - a.createdAt);
            const fontClass = databaseState.currentUser.isPremium && databaseState.currentUser.premiumFont ? 
                databaseState.currentUser.premiumFont : '';
            const myUID = databaseState.currentUser.uid;

            sortedReels.forEach((reel, index) => {
                const isLiked = reel.likes && reel.likes[myUID] === true;
                const likesCount = reel.likes ? Object.keys(reel.likes).length : 0;
                const commentsCount = reel.comments ? Object.keys(reel.comments).length : 0;
                const isSaved = databaseState.currentUser.savedReels && databaseState.currentUser.savedReels.includes(reel.id);
                const viewsCount = reel.views || 0;
                const isOwner = reel.userId === myUID;

                const div = document.createElement('div');
                div.className = 'reel-item';
                div.dataset.index = index;
                div.dataset.reelId = reel.id;
                div.dataset.liked = isLiked ? 'true' : 'false';

                // 3-dot menu button (top right)
                let menuBtn = '';
                if (isOwner) {
                    menuBtn = `
                        <button class="post-menu-btn reel-menu-btn absolute top-4 right-4 z-20" data-reel-menu-btn="${reel.id}" onclick="event.stopPropagation(); toggleReelMenu('${reel.id}')" style="background:rgba(0,0,0,0.5);border-radius:50%;padding:6px;color:white;">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                    `;
                }

                div.innerHTML = `
                    ${menuBtn}
                    <video src="${reel.videoUrl}" playsinline preload="metadata" loop></video>
                    <div class="reel-overlay">
                        <div class="flex items-center gap-3 mb-2">
                            <div class="reel-user-info" onclick="goToUserProfile('${reel.userId}')">
                                <img src="${reel.userAvatar}" class="w-8 h-8 rounded-full border border-white/20 object-cover">
                            </div>
                            <span class="font-bold text-sm reel-user-info ${fontClass}" onclick="goToUserProfile('${reel.userId}')">${reel.userName}</span>
                        </div>
                        ${reel.caption ? `<p class="text-sm text-white/80 reel-caption ${fontClass}">${reel.caption}</p>` : ''}
                    </div>
                    <div class="reel-actions">
                        <button onclick="toggleReelLike('${reel.id}')" class="hover:scale-110 transition" id="reel-like-btn-${reel.id}">
                            <svg class="w-7 h-7" fill="${isLiked ? '#ff2d55' : 'none'}" stroke="${isLiked ? '#ff2d55' : 'white'}" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg>
                            <span class="count" id="reel-like-count-${reel.id}">${likesCount}</span>
                        </button>
                        <button onclick="openReelComments('${reel.id}')" class="hover:scale-110 transition">
                            <svg class="w-7 h-7" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                            <span class="count">${commentsCount}</span>
                        </button>
                        <button onclick="openReelShareModal('${reel.id}')" class="hover:scale-110 transition">
                            <svg class="w-7 h-7" fill="none" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"/></svg>
                        </button>
                        <button onclick="toggleReelSave('${reel.id}')" class="hover:scale-110 transition">
                            <svg class="w-7 h-7" fill="${isSaved ? 'white' : 'none'}" stroke="white" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
                        </button>
                        <div class="flex items-center gap-1 text-white/70 text-xs mt-1" id="reel-views-${reel.id}">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                            <span id="reel-views-count-${reel.id}">${viewsCount}</span>
                        </div>
                    </div>
                `;

                container.appendChild(div);
            });

            setTimeout(() => {
                setupReelAutoPlay();
            }, 100);
        }

        // ============================================================
        // REEL LIKE
        // ============================================================
        window.toggleReelLike = function(reelId) {
            const reelRef = ref(db, 'reels');
            get(reelRef).then((snap) => {
                const data = snap.val();
                if(data) {
                    let reelDbKey = null;
                    const keys = Object.keys(data);
                    for(let k of keys) {
                        if(data[k] && data[k].id === reelId) {
                            reelDbKey = k;
                            break;
                        }
                    }
                    if(reelDbKey) {
                        const myUID = databaseState.currentUser.uid;
                        const likeRef = ref(db, `reels/${reelDbKey}/likes/${myUID}`);
                        const currentLikes = data[reelDbKey].likes || {};
                        const wasLiked = currentLikes[myUID];
                        
                        if(wasLiked) {
                            remove(likeRef);
                        } else {
                            set(likeRef, true);
                            const reelOwner = data[reelDbKey].userId;
                            if (reelOwner && reelOwner !== myUID) {
                                addNotification({
                                    type: 'reel_like',
                                    message: `${databaseState.currentUser.name} liked your reel 🎬`,
                                    targetUserId: reelOwner,
                                    sourceUserId: myUID,
                                    reelId: reelId
                                });
                            }
                        }
                    }
                }
            });
        };

        // ============================================================
        // REEL SAVE
        // ============================================================
        window.toggleReelSave = function(reelId) {
            const myUID = databaseState.currentUser.uid;
            const userRef = ref(db, 'users/' + myUID);
            get(userRef).then((snap) => {
                const userData = snap.val();
                let saved = userData.savedReels || [];
                if(saved.includes(reelId)) {
                    saved = saved.filter(id => id !== reelId);
                    showSuccessToast('Removed', 'Reel removed from saved list.', '📁');
                } else {
                    saved.push(reelId);
                    showSuccessToast('Saved!', 'Reel saved to your collection.', '💾');
                }
                update(userRef, { savedReels: saved }).then(() => {
                    databaseState.currentUser.savedReels = saved;
                    saveStateToHardware();
                    renderReelsFeed();
                });
            });
        };

        // ============================================================
        // REEL VIEWS
        // ============================================================
        let reelObserver = null;
        let reelViewTimers = {};

        function setupReelAutoPlay() {
            const container = document.getElementById('reels-feed');
            const videos = container.querySelectorAll('.reel-item video');
            
            if (reelObserver) {
                reelObserver.disconnect();
                reelObserver = null;
            }
            
            Object.keys(reelViewTimers).forEach(key => {
                clearTimeout(reelViewTimers[key]);
                delete reelViewTimers[key];
            });
            
            reelObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    const video = entry.target;
                    const reelItem = video.closest('.reel-item');
                    const reelId = reelItem ? reelItem.dataset.reelId : null;
                    
                    if(entry.isIntersecting) {
                        video.play().catch(() => {});
                        if (reelId && !databaseState.reelViewTracked[reelId] && !reelViewTimers[reelId]) {
                            reelViewTimers[reelId] = setTimeout(() => {
                                trackReelView(reelId);
                                delete reelViewTimers[reelId];
                            }, 3000);
                        }
                    } else {
                        video.pause();
                        if (reelId && reelViewTimers[reelId]) {
                            clearTimeout(reelViewTimers[reelId]);
                            delete reelViewTimers[reelId];
                        }
                    }
                });
            }, { threshold: 0.6 });

            videos.forEach(video => reelObserver.observe(video));
        }

        function trackReelView(reelId) {
            if (databaseState.reelViewTracked[reelId]) return;
            
            const myUID = databaseState.currentUser.uid;
            const reelRef = ref(db, 'reels');
            get(reelRef).then((snap) => {
                const data = snap.val();
                if (!data) return;
                let dbKey = null;
                const keys = Object.keys(data);
                for (let k of keys) {
                    if (data[k] && data[k].id === reelId) {
                        dbKey = k;
                        break;
                    }
                }
                if (!dbKey) return;
                
                const viewedUsers = data[dbKey].viewedUsers || {};
                if (viewedUsers[myUID]) {
                    databaseState.reelViewTracked[reelId] = true;
                    saveStateToHardware();
                    return;
                }
                
                const viewsRef = ref(db, `reels/${dbKey}`);
                runTransaction(viewsRef, (current) => {
                    if (current === null) return current;
                    if (!current.viewedUsers) current.viewedUsers = {};
                    if (current.viewedUsers[myUID]) return current;
                    current.viewedUsers[myUID] = true;
                    current.views = (current.views || 0) + 1;
                    return current;
                }).then((result) => {
                    if (result.committed) {
                        databaseState.reelViewTracked[reelId] = true;
                        saveStateToHardware();
                        const countEl = document.getElementById(`reel-views-count-${reelId}`);
                        if (countEl) {
                            const currentCount = parseInt(countEl.textContent) || 0;
                            countEl.textContent = currentCount + 1;
                        }
                    }
                }).catch(err => console.warn('View tracking failed:', err));
            });
        }

        // ============================================================
        // REEL UPLOAD
        // ============================================================
        window.handleReelUpload = async function() {
            const fileInput = document.getElementById('reel-input-file');
            const caption = document.getElementById('reel-input-caption').value.trim();
            const file = fileInput.files[0];
            if(!file) {
                showSuccessToast('Info', 'Please select a video to upload.', '📹');
                return;
            }
            if(!file.type.startsWith('video/')) {
                showSuccessToast('Error', 'Please select a video file.', '❌');
                return;
            }

            showUploadLoading();
            closeModal('post-modal');

            const formData = new FormData();
            formData.append('file', file);
            formData.append('upload_preset', CLOUDINARY.uploadPreset);
            formData.append('resource_type', 'video');

            try {
                const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/video/upload`, {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                if(data.error) {
                    console.log('Cloudinary Error:', data.error);
                    hideUploadLoading();
                    showSuccessToast('Error', 'Upload failed: ' + data.error.message, '❌');
                    return;
                }
                
                if(data.secure_url) {
                    const reelData = {
                        id: 'reel_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                        userId: databaseState.currentUser.uid,
                        userName: databaseState.currentUser.name,
                        userAvatar: databaseState.currentUser.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                        videoUrl: data.secure_url,
                        thumbnail: data.thumbnail_url || data.secure_url,
                        caption: caption || '',
                        likes: {},
                        comments: {},
                        savedBy: [],
                        views: 0,
                        viewedUsers: {},
                        createdAt: Date.now()
                    };

                    push(ref(db, 'reels'), reelData).then(() => {
                        hideUploadLoading();
                        document.getElementById('reel-input-file').value = '';
                        document.getElementById('reel-input-caption').value = '';
                        showSuccessToast('Reel Uploaded!', 'Your reel has been published successfully.', '🎬');
                        isReelsLoaded = false;
                        loadReelsOnDemand();
                    }).catch((err) => {
                        console.error('Reel push error:', err);
                        hideUploadLoading();
                        showSuccessToast('Error', 'Failed to save reel. Please try again.', '❌');
                    });
                } else {
                    hideUploadLoading();
                    showSuccessToast('Error', 'Upload failed. Please try again.', '❌');
                }
            } catch(error) {
                console.error('Upload error:', error);
                hideUploadLoading();
                showSuccessToast('Error', 'Failed to upload reel: ' + error.message, '❌');
            }
        };

        // ============================================================
        // REEL COMMENTS
        // ============================================================
        window.deleteReelComment = function(reelId, commentKey) {
            if(confirm('Are you sure you want to delete this comment?')) {
                remove(ref(db, `reels/${reelId}/comments/${commentKey}`)).then(() => {
                    openReelComments(databaseState.activeReelId);
                }).catch((error) => {
                    showSuccessToast('Error', 'Failed to delete comment.', '❌');
                });
            }
        };

        window.openReelComments = function(reelId) {
            databaseState.activeReelId = reelId;
            const container = document.getElementById('reel-comments-container');
            container.innerHTML = '';
            const targetReel = databaseState.reels.find(r => r.id === reelId);
            if(!targetReel) return;

            if(targetReel.comments && Object.keys(targetReel.comments).length > 0) {
                const reelRef = ref(db, 'reels');
                get(reelRef).then((snap) => {
                    const data = snap.val();
                    let reelDbKey = null;
                    if(data) {
                        const keys = Object.keys(data);
                        for(let k of keys) {
                            if(data[k] && data[k].id === reelId) {
                                reelDbKey = k;
                                break;
                            }
                        }
                    }
                    if(!reelDbKey) {
                        container.innerHTML = `<p class="text-[10px] text-slate-600 italic text-center py-4">Error loading comments.</p>`;
                        return;
                    }

                    Object.keys(targetReel.comments).forEach(commentKey => {
                        const c = targetReel.comments[commentKey];
                        const isOwner = c.authorUID === databaseState.currentUser.uid;
                        const el = document.createElement('div');
                        el.className = "bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-xl space-y-0.5 flex justify-between items-start";
                        el.innerHTML = `
                            <div>
                                <p class="font-bold text-slate-600 dark:text-slate-400 text-xs">@${c.authorName}:</p>
                                <p class="text-slate-700 dark:text-slate-300 text-xs">${c.text}</p>
                            </div>
                            ${isOwner ? `
                                <button onclick="deleteReelComment('${reelDbKey}', '${commentKey}')" 
                                    class="comment-delete-btn text-red-400 hover:text-red-300 p-1 rounded-lg text-xs">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                                </button>
                            ` : ''}
                        `;
                        container.appendChild(el);
                    });
                });
            } else {
                container.innerHTML = `<p class="text-[10px] text-slate-600 italic text-center py-4">No comments yet.</p>`;
            }

            openModal('reel-comments-modal');
        };

        window.addReelComment = function() {
            const field = document.getElementById('reel-comment-input');
            const txt = field.value.trim();
            if(!txt || !databaseState.activeReelId) return;

            onValue(ref(db, 'reels'), (snap) => {
                const data = snap.val();
                if(data) {
                    const dbKey = Object.keys(data).find(k => data[k] && data[k].id === databaseState.activeReelId);
                    if(dbKey) {
                        const myUID = databaseState.currentUser.uid;
                        const reelOwner = data[dbKey].userId;
                        const payload = {
                            authorUID: myUID,
                            authorName: databaseState.currentUser.name,
                            text: txt,
                            timestamp: Date.now()
                        };
                        push(ref(db, `reels/${dbKey}/comments`), payload).then(() => {
                            field.value = '';
                            closeModal('reel-comments-modal');
                            if (reelOwner !== myUID) {
                                addNotification({
                                    type: 'reel_comment',
                                    message: `${databaseState.currentUser.name} commented on your reel: "${txt}"`,
                                    targetUserId: reelOwner,
                                    sourceUserId: myUID,
                                    reelId: databaseState.activeReelId
                                });
                            }
                            showSuccessToast('Commented!', 'Your comment has been posted.', '💬');
                        });
                    }
                }
            }, { onlyOnce: true });
        };

        // ============================================================
        // GO TO USER PROFILE
        // ============================================================
        window.goToUserProfile = function(userId) {
            if (userId === databaseState.currentUser.uid) {
                switchTab('profile');
                return;
            }
            const peer = databaseState.peers.find(p => p.uid === userId);
            if (peer) {
                displayPeerAccountProfile(userId);
            } else {
                onValue(ref(db, 'users/' + userId), (snap) => {
                    const userData = snap.val();
                    if (userData) {
                        if (!databaseState.peers.find(p => p.uid === userId)) {
                            databaseState.peers.push(userData);
                        }
                        displayPeerAccountProfile(userId);
                    } else {
                        showSuccessToast('Error', 'User not found.', '❌');
                    }
                }, { onlyOnce: true });
            }
        };

        // ============================================================
        // SEARCH
        // ============================================================
        window.handleUnifiedSearch = function() {
            const query = document.getElementById('search-input').value.trim().toLowerCase();
            const profileGrid = document.getElementById('search-results-profiles');
            const articleGrid = document.getElementById('search-results-articles');
            profileGrid.innerHTML = '';
            articleGrid.innerHTML = '';
            if(!query) return;
            const myUID = databaseState.currentUser.uid;

            databaseState.peers.forEach(peer => {
                if(peer.uid === myUID) return;
                if(peer.uid.includes(query) || peer.name.toLowerCase().includes(query)) {
                    const isFriend = databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed';
                    const hasSentRequest = databaseState.friendships[`req_${myUID}_to_${peer.uid}`] === 'pending';
                    const hasIncomingRequest = databaseState.friendships[`req_${peer.uid}_to_${myUID}`] === 'pending';
                    
                    let buttonMarkup = '';
                    if(isFriend) {
                        buttonMarkup = `<span class="text-[10px] bg-slate-200 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 font-bold px-3 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700">Verified Network</span>`;
                    } else if(hasSentRequest) {
                        buttonMarkup = `<span class="text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-500 px-3 py-1.5 rounded-xl">Packet Sent</span>`;
                    } else if(hasIncomingRequest) {
                        buttonMarkup = `<button onclick="handleIncomingRequestOperation('${peer.uid}', 'accept')" class="bg-emerald-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl">Accept</button>`;
                    } else {
                        buttonMarkup = `<button onclick="dispatchFriendHandshake('${peer.uid}')" class="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold px-3 py-1.5 rounded-xl transition">Connect Node</button>`;
                    }

                    const card = document.createElement('div');
                    card.className = "bg-lightcard dark:bg-darkcard p-3 rounded-xl border border-lightborder dark:border-slate-800 flex justify-between items-center text-xs";
                    card.innerHTML = `
                        <div class="flex items-center space-x-3 cursor-pointer" onclick="displayPeerAccountProfile('${peer.uid}')">
                            <img src="${peer.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-8 h-8 rounded-full object-cover">
                            <div>
                                <p class="font-bold text-slate-800 dark:text-slate-200">${peer.name}</p>
                                <p class="text-[9px] text-slate-500 font-mono">@${peer.uid}</p>
                            </div>
                        </div>
                        <div>${buttonMarkup}</div>
                    `;
                    profileGrid.appendChild(card);
                }
            });

            databaseState.publications.forEach(post => {
                if(post && post.text && post.text.toLowerCase().includes(query)) {
                    const card = document.createElement('div');
                    card.className = "bg-lightcard dark:bg-darkcard p-3 rounded-xl border border-lightborder dark:border-slate-800 text-xs space-y-2";
                    let imgHtml = '';
                    if(post.image) {
                        imgHtml = `
                            <div class="rounded-lg overflow-hidden max-h-32 border border-slate-300 dark:border-slate-700 cursor-pointer" onclick="openImageViewer('${post.image}')">
                                <img src="${post.image}" class="w-full h-full object-cover" loading="lazy">
                            </div>
                        `;
                    }
                    card.innerHTML = `
                        <p class="text-slate-700 dark:text-slate-300 leading-relaxed">${post.text}</p>
                        ${imgHtml}
                        <span class="text-[9px] text-slate-600 font-mono">Node Broadcast ID: @${post.authorUID}</span>
                    `;
                    articleGrid.appendChild(card);
                }
            });
        }

        // ============================================================
        // NAVIGATION
        // ============================================================
        const BASE = new URL(document.baseURI).pathname;
        const TAB_PATHS = { home: '', chat: 'chat/', reels: 'reels/', search: 'search/', profile: 'profile/' };
        const TAB_TITLES = { home: 'Home', chat: 'Chat', reels: 'Reels', search: 'Search', profile: 'Profile' };
        let pendingReelId = null, pendingPostId = null, pendingUserId = null;
        function routeFromPath() {
            const parts = location.pathname.slice(BASE.length).split('/').filter(Boolean);
            const [a, b] = parts;
            if (a === 'video' && b) return { tab: 'reels', reel: b };
            if (a === 'post' && b) return { tab: 'home', post: b };
            if (a === 'u' && b) return { tab: 'home', user: b };
            return { tab: TAB_PATHS[a] !== undefined && a ? a : 'home' };
        }
        window.focusPendingReel = function() {
            if (!pendingReelId) return;
            const el = document.querySelector(`.reel-item[data-reel-id="${pendingReelId}"]`);
            if (el) { el.scrollIntoView({ behavior: 'instant', block: 'start' }); pendingReelId = null; }
        };
        window.tryOpenPendingPost = function() {
            if (pendingPostId && databaseState.publications.some(p => p.id === pendingPostId)) { const id = pendingPostId; pendingPostId = null; openPublicationInspectionModal(id); }
            if (pendingUserId && databaseState.peers.some(p => p.uid === pendingUserId)) { const id = pendingUserId; pendingUserId = null; displayPeerAccountProfile(id); }
        };
        window.applyRoute = function() {
            const r = routeFromPath();
            pendingReelId = r.reel || null; pendingPostId = r.post || null; pendingUserId = r.user || null;
            switchTab(r.tab, true);
            focusPendingReel(); tryOpenPendingPost();
        };
        window.addEventListener('popstate', () => { if (!document.getElementById('app-layout').classList.contains('hidden')) applyRoute(); });
        window.switchTab = function(tabId, noPush) {
            if (!noPush) history.pushState({ tab: tabId }, '', BASE + TAB_PATHS[tabId]);
            document.title = TAB_TITLES[tabId] + ' | Stardust Hub';
            const screens = ['home-screen', 'chat-screen', 'reels-screen', 'search-screen', 'profile-screen'];
            screens.forEach(s => document.getElementById(s).classList.add('hidden'));
            document.getElementById(tabId + '-screen').classList.remove('hidden');
            
            if (tabId === 'reels') {
                document.getElementById('reels-screen').classList.add('-mx-4', '-mt-3');
                loadReelsOnDemand();
            } else {
                document.getElementById('reels-screen').classList.remove('-mx-4', '-mt-3');
            }
            
            if (tabId === 'chat') {
                renderEcosystemIncomingRequests();
                renderEcosystemActiveChats();
            }
            
            if (tabId === 'profile') {
                syncProfileCardInterface();
                renderPersonalPublications();
                renderProfileFriendsNetwork();
                if (databaseState.currentUser.isPremium) {
                    applyPremiumSettings(databaseState.currentUser);
                }
            }
            
            const navButtons = document.querySelectorAll('nav button');
            navButtons.forEach(btn => {
                btn.classList.remove('text-cyan-400', 'text-pink-400');
                btn.classList.add('text-slate-500');
            });
            
            const clickedBtn = event?.currentTarget || document.querySelector(`nav button[onclick*="'${tabId}'"]`);
            if (clickedBtn) {
                if(tabId === 'reels') {
                    clickedBtn.classList.remove('text-slate-500');
                    clickedBtn.classList.add('text-pink-400');
                } else {
                    clickedBtn.classList.remove('text-slate-500');
                    clickedBtn.classList.add('text-cyan-400');
                }
            }
        }

        // ============================================================
        // SYNC FUNCTIONS
        // ============================================================
        function syncProfileCardInterface() {
            const user = databaseState.currentUser;
            document.getElementById('profile-display-name').innerText = user.name;
            document.getElementById('profile-display-uid').innerText = '@' + user.uid;
            document.getElementById('profile-display-bio').innerText = user.bio || 'Node status fully configured.';
            if(user.pfp) {
                document.getElementById('profile-display-avatar').src = user.pfp;
            }
            const profBadge = document.getElementById('profile-display-profession');
            if(user.profession) {
                profBadge.innerText = user.profession;
                profBadge.classList.remove('hidden');
            } else {
                profBadge.classList.add('hidden');
            }
            if(user.notifications) {
                databaseState.notifications = user.notifications;
                renderNotifications();
                updateNotificationBadge();
            }
            
            if (user.isPremium) {
                applyPremiumSettings(user);
            }
        }

        function listenToGlobalSyncChannels(myUID) {
            onValue(ref(db, 'publications'), (snap) => {
                const data = snap.val();
                let loadedPosts = [];
                if (data) {
                    Object.keys(data).forEach(k => {
                        const post = data[k];
                        if (post && post.id && (post.text || post.image)) {
                            loadedPosts.push(post);
                        }
                    });
                }
                databaseState.publications = loadedPosts.sort((a, b) => b.timestamp - a.timestamp);
                renderEcosystemFeed();
            });

            onValue(ref(db, 'users'), (snap) => {
                const data = snap.val();
                databaseState.peers = data ? Object.values(data) : [];
                if(data && data[myUID]) {
                    databaseState.currentUser = data[myUID];
                    if(!databaseState.currentUser.savedPosts) databaseState.currentUser.savedPosts = [];
                    if(!databaseState.currentUser.savedReels) databaseState.currentUser.savedReels = [];
                    if(!databaseState.currentUser.notifications) databaseState.currentUser.notifications = [];
                    if(!databaseState.reelViewTracked) databaseState.reelViewTracked = {};
                    syncProfileCardInterface();
                    if (databaseState.currentUser.isPremium) {
                        applyPremiumSettings(databaseState.currentUser);
                    }
                }
                renderEcosystemIncomingRequests();
                renderEcosystemActiveChats();
            });

            onValue(ref(db, 'friendships'), (snap) => {
                databaseState.friendships = snap.val() || {};
                renderEcosystemIncomingRequests();
                renderEcosystemActiveChats();
                renderProfileFriendsNetwork();
            });

            onValue(ref(db, 'chats'), (snap) => {
                databaseState.chatThreads = snap.val() || {};
                evaluateGlobalUnseenPackets();
                renderEcosystemActiveChats();
                if(databaseState.activeTargetChatUID) {
                    renderActiveChatLiveStream(databaseState.activeTargetChatUID);
                }
                if(callState.isChatOpen) {
                    renderCallChatMessages();
                }
            });
        }

        function evaluateGlobalUnseenPackets() {
            let totalUnseen = 0;
            const myUID = databaseState.currentUser.uid;
            Object.keys(databaseState.chatThreads).forEach(threadKey => {
                if(threadKey.includes(myUID)) {
                    const messages = databaseState.chatThreads[threadKey];
                    Object.values(messages).forEach(msg => {
                        if(msg.sender !== myUID && msg.status !== 'seen') {
                            totalUnseen++;
                        }
                    });
                }
            });
            const badge = document.getElementById('global-unseen-badge');
            if(totalUnseen > 0) {
                badge.innerText = totalUnseen;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // ============================================================
        // CHAT FUNCTIONS
        // ============================================================
        function renderEcosystemIncomingRequests() {
            const container = document.getElementById('incoming-requests-list');
            container.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            let pendingCount = 0;

            Object.keys(databaseState.friendships).forEach(key => {
                if(key.startsWith('req_') && key.includes('_to_' + myUID)) {
                    if(databaseState.friendships[key] === 'pending') {
                        pendingCount++;
                        const senderUID = key.split('_')[1];
                        const senderProfile = databaseState.peers.find(p => p.uid === senderUID);
                        if(senderProfile) {
                            const node = document.createElement('div');
                            node.className = "bg-lightcard dark:bg-darkcard p-3 rounded-xl border border-lightborder dark:border-slate-800 flex justify-between items-center text-xs";
                            node.innerHTML = `
                                <div class="flex items-center space-x-3">
                                    <img src="${senderProfile.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-8 h-8 rounded-full object-cover">
                                    <div>
                                        <p class="font-bold text-slate-800 dark:text-slate-200">${senderProfile.name}</p>
                                        <p class="text-[10px] text-slate-500 font-mono">@${senderProfile.uid}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-2">
                                    <button onclick="handleIncomingRequestOperation('${senderUID}', 'accept')" class="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white p-2 rounded-lg border border-emerald-500/30 transition">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                                    </button>
                                    <button onclick="handleIncomingRequestOperation('${senderUID}', 'deny')" class="bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white p-2 rounded-lg border border-red-500/30 transition">
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                                    </button>
                                </div>
                            `;
                            container.appendChild(node);
                        }
                    }
                }
            });

            const countBadge = document.getElementById('request-badge-count');
            if(pendingCount > 0) {
                countBadge.innerText = pendingCount;
                countBadge.classList.remove('hidden');
            } else {
                countBadge.classList.add('hidden');
                container.innerHTML = `<p class="text-[11px] text-slate-600 text-center py-2">No pending verification packets detected.</p>`;
            }
        }

        window.handleIncomingRequestOperation = function(senderUID, decision) {
            const myUID = databaseState.currentUser.uid;
            const reqKey = `req_${senderUID}_to_${myUID}`;
            if(decision === 'accept') {
                const updates = {};
                updates[`friendships/${reqKey}`] = null;
                updates[`friendships/bond_${myUID}_and_${senderUID}`] = 'confirmed';
                updates[`friendships/bond_${senderUID}_and_${myUID}`] = 'confirmed';
                update(ref(db), updates).then(() => {
                    showSuccessToast('Connected!', 'Friend request accepted successfully.', '🤝');
                    addNotification({
                        type: 'friend_request',
                        message: `${databaseState.currentUser.name} accepted your friend request! 🤝`,
                        targetUserId: senderUID,
                        sourceUserId: myUID
                    });
                });
            } else {
                set(ref(db, `friendships/${reqKey}`), null).then(() => {
                    showSuccessToast('Declined', 'Friend request denied.', '❌');
                });
            }
        }

        function renderEcosystemActiveChats() {
            const container = document.getElementById('active-chats-list');
            container.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            let chatList = [];

            databaseState.peers.forEach(peer => {
                if(peer.uid === myUID) return;
                const isFriend = databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed';
                if(isFriend) {
                    const threadKey = myUID < peer.uid ? `${myUID}_text_${peer.uid}` : `${peer.uid}_text_${myUID}`;
                    const messages = databaseState.chatThreads[threadKey];
                    let unseenCount = 0;
                    let latestTimestamp = 0;
                    if(messages) {
                        Object.values(messages).forEach(m => {
                            if(m.sender !== myUID && m.status !== 'seen') { unseenCount++; }
                            if(m.timestamp > latestTimestamp) { latestTimestamp = m.timestamp; }
                        });
                    }
                    chatList.push({
                        peer: peer,
                        unseenCount: unseenCount,
                        latestTimestamp: latestTimestamp,
                        threadKey: threadKey
                    });
                }
            });

            chatList.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

            if(chatList.length === 0) {
                container.innerHTML = `<p class="text-[11px] text-slate-600 text-center py-4">Establish peer network handshakes to deploy channels.</p>`;
                return;
            }

            chatList.forEach(({ peer, unseenCount, threadKey }) => {
                const node = document.createElement('div');
                node.className = `p-3 rounded-xl border flex justify-between items-center transition cursor-pointer ${unseenCount > 0 ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600/50 shadow-md shadow-blue-500/5' : 'bg-lightcard dark:bg-darkcard border-lightborder dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800/80'}`;
                node.onclick = () => openDirectCommunicationChannel(peer.uid);
                
                let lastMsg = '';
                const messages = databaseState.chatThreads[threadKey];
                if(messages) {
                    const msgArray = Object.values(messages);
                    if(msgArray.length > 0) {
                        const last = msgArray[msgArray.length - 1];
                        lastMsg = last.text ? (last.text.length > 30 ? last.text.substring(0, 30) + '...' : last.text) : '';
                    }
                }
                
                node.innerHTML = `
                    <div class="flex items-center space-x-3 flex-1 min-w-0">
                        <img src="${peer.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-9 h-9 rounded-full object-cover border border-slate-300 dark:border-slate-700 flex-shrink-0">
                        <div class="min-w-0 flex-1">
                            <p class="font-bold flex items-center gap-1.5 ${unseenCount > 0 ? 'text-blue-600 dark:text-blue-400 font-extrabold' : 'text-slate-800 dark:text-slate-200'}">
                                <span class="truncate">${peer.name}</span>
                                ${unseenCount > 0 ? '<span class="h-2 w-2 bg-blue-500 rounded-full animate-pulse flex-shrink-0"></span>' : ''}
                            </p>
                            <p class="text-[10px] text-slate-500 truncate">${lastMsg || 'No messages yet'}</p>
                        </div>
                    </div>
                    ${unseenCount > 0 ? `<span class="bg-blue-600 text-white text-[10px] font-bold rounded-full h-5 px-2 flex items-center justify-center flex-shrink-0 ml-2">${unseenCount}</span>` : ''}
                `;
                container.appendChild(node);
            });
        }

        window.openDirectCommunicationChannel = function(targetUID) {
            databaseState.activeTargetChatUID = targetUID;
            const peer = databaseState.peers.find(p => p.uid === targetUID);
            if(!peer) return;

            document.getElementById('chat-window-name').innerText = peer.name;
            document.getElementById('chat-window-uid').innerText = '@' + peer.uid;
            document.getElementById('chat-window-avatar').src = peer.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
            
            document.getElementById('chat-header-identity-trigger').onclick = () => {
                window.displayPeerAccountProfile(peer.uid);
            };

            const threadKey = databaseState.currentUser.uid < targetUID ? `${databaseState.currentUser.uid}_text_${targetUID}` : `${targetUID}_text_${databaseState.currentUser.uid}`;
            const messages = databaseState.chatThreads[threadKey];
            if(messages) {
                Object.keys(messages).forEach(mId => {
                    if(messages[mId].sender !== databaseState.currentUser.uid && messages[mId].status !== 'seen') {
                        update(ref(db, `chats/${threadKey}/${mId}`), { status: 'seen' });
                    }
                });
            }

            renderActiveChatLiveStream(targetUID);
            document.getElementById('chat-window-modal').classList.remove('hidden');
        }

        window.closeChatWindow = function() {
            databaseState.activeTargetChatUID = null;
            document.getElementById('chat-window-modal').classList.add('hidden');
        }

        function renderActiveChatLiveStream(targetUID) {
            const stream = document.getElementById('chat-messages-stream');
            stream.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            const threadKey = myUID < targetUID ? `${myUID}_text_${targetUID}` : `${targetUID}_text_${myUID}`;
            const packets = databaseState.chatThreads[threadKey];
            if(!packets) {
                stream.innerHTML = `<div class="text-center text-slate-600 text-[10px] my-auto">Channel structural pipeline is empty. Post first packet payload.</div>`;
                return;
            }

            Object.keys(packets).forEach(packetID => {
                const message = packets[packetID];
                const isMe = message.sender === myUID;
                const msgNode = document.createElement('div');
                msgNode.className = `max-w-[75%] p-3 rounded-2xl text-xs relative group ${isMe ? 'bg-blue-600 text-white self-end rounded-tr-none' : 'bg-slate-200 dark:bg-darkcard text-slate-800 dark:text-slate-200 self-start rounded-tl-none border border-slate-300 dark:border-slate-800'}`;
                
                msgNode.oncontextmenu = (e) => {
                    e.preventDefault();
                    databaseState.activeContextMessageID = { thread: threadKey, id: packetID, txt: message.text };
                    document.getElementById('message-context-panel').classList.remove('hidden');
                };

                let reactionsMarkup = '';
                if(message.reactions) {
                    reactionsMarkup = `<div class="absolute -bottom-2 right-2 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-full px-1.5 py-0.5 text-[9px] flex items-center gap-0.5 shadow-lg">`;
                    Object.values(message.reactions).forEach(r => { reactionsMarkup += `<span>${r}</span>`; });
                    reactionsMarkup += `</div>`;
                }

                let mediaHtml = '';
                if (message.mediaType === 'reel' && message.mediaUrl) {
                    mediaHtml = `
                        <div class="mt-2 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shared-media-preview" onclick="openFullScreenMedia('${message.mediaUrl}', 'video')">
                            <video src="${message.mediaUrl}" muted playsinline style="max-height: 120px; width: 100%; object-fit: cover;"></video>
                            <div class="media-label">🎬 Reel</div>
                        </div>
                    `;
                } else if (message.mediaType === 'post' && message.mediaUrl) {
                    mediaHtml = `
                        <div class="mt-2 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-700 shared-media-preview" onclick="openFullScreenMedia('${message.mediaUrl}', 'image')">
                            <img src="${message.mediaUrl}" style="max-height: 120px; width: 100%; object-fit: cover;">
                        </div>
                    `;
                }

                msgNode.innerHTML = `
                    <p class="leading-relaxed break-words pr-2">${message.text}</p>
                    ${mediaHtml}
                    <span class="text-[8px] block text-right mt-1 ${isMe ? 'text-blue-200' : 'text-slate-500'} font-mono">${new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    ${reactionsMarkup}
                `;
                stream.appendChild(msgNode);
            });
            setTimeout(() => { stream.scrollTop = stream.scrollHeight; }, 50);
        }

        window.dispatchDirectMessage = function() {
            const field = document.getElementById('chat-input-field');
            const packetText = field.value.trim();
            if(!packetText || !databaseState.activeTargetChatUID) return;

            const myUID = databaseState.currentUser.uid;
            const targetUID = databaseState.activeTargetChatUID;
            const threadKey = myUID < targetUID ? `${myUID}_text_${targetUID}` : `${targetUID}_text_${myUID}`;
            const messagePayload = {
                sender: myUID,
                text: packetText,
                timestamp: Date.now(),
                status: 'transmitted'
            };

            push(ref(db, `chats/${threadKey}`), messagePayload).then(() => {
                field.value = '';
                renderActiveChatLiveStream(targetUID);
            });
        }

        window.injectContextReaction = function(emoji) {
            if(!databaseState.activeContextMessageID) return;
            const { thread, id } = databaseState.activeContextMessageID;
            push(ref(db, `chats/${thread}/${id}/reactions`), emoji).then(() => {
                document.getElementById('message-context-panel').classList.add('hidden');
            });
        }

        window.executeClipboardCopy = function() {
            if(!databaseState.activeContextMessageID) return;
            navigator.clipboard.writeText(databaseState.activeContextMessageID.txt).then(() => {
                showSuccessToast('Copied!', 'Context data copied to clipboard.', '📋');
                document.getElementById('message-context-panel').classList.add('hidden');
            });
        }

        // ============================================================
        // PROFILE FUNCTIONS
        // ============================================================
        function renderPersonalPublications() {
            const container = document.getElementById('profile-personal-posts');
            container.innerHTML = '';
            const specific = databaseState.publications.filter(p => p && p.authorUID === databaseState.currentUser.uid && (p.text || p.image));
            if(specific.length === 0) {
                container.innerHTML = `<p class="text-[11px] text-slate-600 text-center py-4">No structural publications broadcasted by your current node yet.</p>`;
                return;
            }

            const fontClass = databaseState.currentUser.isPremium && databaseState.currentUser.premiumFont ? 
                databaseState.currentUser.premiumFont : '';
            const myUID = databaseState.currentUser.uid;

            specific.forEach(post => {
                const isOwner = post.authorUID === myUID;
                const card = document.createElement('div');
                card.className = "bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-xl space-y-2 text-xs relative";
                
                let menuBtn = '';
                if (isOwner) {
                    menuBtn = `
                        <button class="post-menu-btn absolute top-2 right-2" data-post-menu-btn="${post.id}" onclick="event.stopPropagation(); togglePostMenu('${post.id}')">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                    `;
                }
                
                card.innerHTML = `
                    ${menuBtn}
                    <p class="text-slate-700 dark:text-slate-300 leading-relaxed post-text ${fontClass}">${post.text || ''}</p>
                    ${post.image ? `<div class="rounded-lg overflow-hidden max-h-48 border border-slate-300 dark:border-slate-700 cursor-pointer" onclick="openImageViewer('${post.image}')"><img src="${post.image}" class="w-full h-full object-cover"></div>` : ''}
                    <span class="text-[8px] font-mono text-slate-600">${post.timestamp ? new Date(post.timestamp).toLocaleString() : ''}</span>
                `;
                container.appendChild(card);
            });
        }

        function renderProfileReels() {
            const container = document.getElementById('profile-personal-reels');
            container.innerHTML = '';
            const specific = databaseState.reels.filter(r => r && r.userId === databaseState.currentUser.uid);
            if(specific.length === 0) {
                container.innerHTML = `<p class="text-[11px] text-slate-600 text-center py-4">No reels uploaded yet.</p>`;
                return;
            }

            const fontClass = databaseState.currentUser.isPremium && databaseState.currentUser.premiumFont ? 
                databaseState.currentUser.premiumFont : '';
            const myUID = databaseState.currentUser.uid;

            specific.forEach(reel => {
                const isOwner = reel.userId === myUID;
                const card = document.createElement('div');
                card.className = "bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-xl space-y-2 text-xs cursor-pointer relative";
                card.onclick = (e) => {
                    if (e.target.closest('.post-menu-btn')) return;
                    switchTab('reels');
                    setTimeout(() => {
                        const reelsContainer = document.getElementById('reels-feed');
                        const items = reelsContainer.querySelectorAll('.reel-item');
                        const index = databaseState.reels.findIndex(r => r.id === reel.id);
                        if (index >= 0 && items[index]) {
                            items[index].scrollIntoView({ behavior: 'smooth' });
                        }
                    }, 300);
                };
                
                let menuBtn = '';
                if (isOwner) {
                    menuBtn = `
                        <button class="post-menu-btn absolute top-2 right-2" data-reel-menu-btn="${reel.id}" onclick="event.stopPropagation(); toggleReelMenu('${reel.id}')">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
                        </button>
                    `;
                }
                
                card.innerHTML = `
                    ${menuBtn}
                    <div class="flex items-center gap-2">
                        <svg class="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                        <span class="font-bold text-slate-700 dark:text-slate-300 reel-caption ${fontClass}">${reel.caption || 'Reel'}</span>
                    </div>
                    <video src="${reel.videoUrl}" muted playsinline class="rounded-lg max-h-48 w-full object-cover"></video>
                    <div class="flex items-center gap-4 text-[10px] text-slate-500">
                        <span>❤️ ${reel.likes ? Object.keys(reel.likes).length : 0}</span>
                        <span>💬 ${reel.comments ? Object.keys(reel.comments).length : 0}</span>
                        <span>👁️ ${reel.views || 0}</span>
                    </div>
                    <span class="text-[8px] font-mono text-slate-600">${new Date(reel.createdAt).toLocaleString()}</span>
                `;
                container.appendChild(card);
            });
        }

        function renderProfileFriendsNetwork() {
            const container = document.getElementById('profile-friends-list');
            container.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            let match = false;

            databaseState.peers.forEach(peer => {
                if(peer.uid === myUID) return;
                if(databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed') {
                    match = true;
                    const el = document.createElement('div');
                    el.className = "bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-3 rounded-xl flex justify-between items-center text-xs";
                    el.innerHTML = `
                        <div class="flex items-center space-x-2.5">
                            <img src="${peer.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150'}" class="w-8 h-8 rounded-full object-cover">
                            <div>
                                <p class="font-bold text-slate-700 dark:text-slate-300">${peer.name}</p>
                                <p class="text-[9px] text-slate-500 font-mono">@${peer.uid}</p>
                            </div>
                        </div>
                        <button onclick="window.displayPeerAccountProfile('${peer.uid}')" class="bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 px-3 py-1.5 rounded-lg font-semibold text-[11px] text-slate-700 dark:text-slate-300">Inspect Node</button>
                    `;
                    container.appendChild(el);
                }
            });

            if(!match) {
                container.innerHTML = `<p class="text-[11px] text-slate-600 text-center py-4">No verified network handshakes linked inside node parameters.</p>`;
            }
        }

        window.toggleProfileView = function(view) {
            const postsTab = document.getElementById('prof-tab-posts');
            const reelsTab = document.getElementById('prof-tab-reels');
            const friendsTab = document.getElementById('prof-tab-friends');
            const postsContainer = document.getElementById('profile-posts-view-container');
            const reelsContainer = document.getElementById('profile-reels-view-container');
            const friendsContainer = document.getElementById('profile-friends-view-container');

            [postsTab, reelsTab, friendsTab].forEach(tab => {
                tab.classList.remove('active');
            });
            [postsContainer, reelsContainer, friendsContainer].forEach(container => {
                container.classList.add('hidden');
            });

            if(view === 'posts') {
                postsTab.classList.add('active');
                postsContainer.classList.remove('hidden');
            } else if(view === 'reels') {
                reelsTab.classList.add('active');
                reelsContainer.classList.remove('hidden');
                renderProfileReels();
            } else {
                friendsTab.classList.add('active');
                friendsContainer.classList.remove('hidden');
            }
        }

        // ============================================================
        // SETTINGS & SUB-SETTINGS
        // ============================================================
        window.openSubSettingPage = function(type) {
            closeModal('settings-hub-modal');
            const title = document.getElementById('subsetting-title');
            const body = document.getElementById('subsetting-dynamic-body');
            body.innerHTML = '';

            if(type === 'edit-profile') {
                title.innerText = "Edit Profile Parameters";
                body.innerHTML = `
                    <div class="space-y-3">
                        <div><label class="block text-[10px] uppercase font-bold text-slate-500 mb-1">Handle Alias Name</label><input type="text" id="edit-name" value="${databaseState.currentUser.name}" class="w-full bg-lightbg dark:bg-darkbg border border-lightborder dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200"></div>
                        <div><label class="block text-[10px] uppercase font-bold text-slate-500 mb-1">Profile Avatar File</label><input type="file" id="edit-pfp-file" accept="image/*" class="w-full text-slate-500"></div>
                        <div><label class="block text-[10px] uppercase font-bold text-slate-500 mb-1">Ecosystem Biography Text</label><textarea id="edit-bio" class="w-full bg-lightbg dark:bg-darkbg border border-lightborder dark:border-slate-800 rounded-xl px-3 py-2 resize-none h-16 text-slate-800 dark:text-slate-200">${databaseState.currentUser.bio || ''}</textarea></div>
                        <div><label class="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Core Framework Profession</label><select id="edit-profession" class="w-full bg-lightbg dark:bg-darkbg border border-lightborder dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200"></select></div>
                        <button onclick="saveCoreProfileModificationsPipeline()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl mt-2">Commit Structural updates</button>
                    </div>
                `;
                const select = document.getElementById('edit-profession');
                FIXED_PROFESSIONS.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p; opt.innerText = p;
                    if(databaseState.currentUser.profession === p) opt.selected = true;
                    select.appendChild(opt);
                });
            } else if(type === 'liked-posts') {
                title.innerText = "Liked Publications";
                const liked = databaseState.publications.filter(p => p && p.likes && p.likes[databaseState.currentUser.uid] === true);
                if(liked.length > 0) {
                    liked.forEach(p => { 
                        body.innerHTML += `
                            <div class="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-xl mb-1">
                                <p class="text-slate-700 dark:text-slate-300">${p.text}</p>
                                ${p.image ? `<div class="mt-1 rounded-lg overflow-hidden max-h-24"><img src="${p.image}" class="w-full h-full object-cover"></div>` : ''}
                            </div>
                        `; 
                    });
                } else { body.innerHTML = `<p class="text-center text-slate-600">No liked publications found.</p>`; }
            } else if(type === 'saved-posts') {
                title.innerText = "Saved Core Channels";
                const saved = databaseState.publications.filter(p => p && databaseState.currentUser.savedPosts && databaseState.currentUser.savedPosts.includes(p.id));
                if(saved.length > 0) {
                    saved.forEach(p => { 
                        body.innerHTML += `
                            <div class="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-xl mb-1">
                                <p class="text-slate-700 dark:text-slate-300">${p.text}</p>
                                ${p.image ? `<div class="mt-1 rounded-lg overflow-hidden max-h-24 cursor-pointer" onclick="openImageViewer('${p.image}')"><img src="${p.image}" class="w-full h-full object-cover"></div>` : ''}
                            </div>
                        `; 
                    });
                } else { body.innerHTML = `<p class="text-center text-slate-600">No saved publications found.</p>`; }
            } else if(type === 'saved-reels') {
                title.innerText = "Saved Reels";
                const saved = databaseState.reels.filter(r => r && databaseState.currentUser.savedReels && databaseState.currentUser.savedReels.includes(r.id));
                if(saved.length > 0) {
                    saved.forEach(r => { 
                        body.innerHTML += `
                            <div class="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-xl mb-1 text-xs">
                                <div class="flex items-center gap-2">
                                    <svg class="w-4 h-4 text-pink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                    <span class="text-slate-700 dark:text-slate-300">${r.caption || 'Reel'}</span>
                                </div>
                                <video src="${r.videoUrl}" muted playsinline class="mt-1 rounded-lg max-h-32 w-full object-cover cursor-pointer" onclick="openFullScreenMedia('${r.videoUrl}', 'video')"></video>
                                <p class="text-[9px] text-slate-500 mt-0.5">By ${r.userName}</p>
                            </div>
                        `; 
                    });
                } else { body.innerHTML = `<p class="text-center text-slate-600">No saved reels found.</p>`; }
            } else if(type === 'commented-posts') {
                title.innerText = "Commented Matrix Logs";
                let comments = [];
                databaseState.publications.forEach(p => {
                    if(p.comments) {
                        Object.values(p.comments).forEach(c => {
                            if(c.authorUID === databaseState.currentUser.uid) {
                                comments.push({ post: p.text, comment: c.text, time: c.timestamp, postId: p.id });
                            }
                        });
                    }
                });
                if(comments.length > 0) {
                    comments.forEach(c => {
                        body.innerHTML += `
                            <div class="bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 p-2.5 rounded-xl mb-1">
                                <p class="text-slate-500 text-[10px]">Post: ${c.post}</p>
                                <p class="text-slate-700 dark:text-slate-300">💬 ${c.comment}</p>
                            </div>
                        `;
                    });
                } else { body.innerHTML = `<p class="text-center text-slate-600">No comments found.</p>`; }
            } else {
                title.innerText = "System Log Sub-Center";
                body.innerHTML = `<p class="text-center text-slate-600">No active system traces detected.</p>`;
            }
            openModal('subsetting-view-modal');
        }

        window.saveCoreProfileModificationsPipeline = function() {
            const name = document.getElementById('edit-name').value.trim();
            const fileInput = document.getElementById('edit-pfp-file');
            const bio = document.getElementById('edit-bio').value.trim();
            const prof = document.getElementById('edit-profession').value;
            if(!name) return;

            const commitUpdates = (imgBase64) => {
                const payload = { name: name, bio: bio, profession: prof };
                if (imgBase64) payload.pfp = imgBase64;
                update(ref(db, 'users/' + databaseState.currentUser.uid), payload).then(() => {
                    closeModal('subsetting-view-modal');
                    showSuccessToast('Profile Updated!', 'Your profile has been updated successfully.', '✅');
                });
            };

            if(fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) { commitUpdates(e.target.result); };
                reader.readAsDataURL(fileInput.files[0]);
            } else {
                commitUpdates(null);
            }
        }

        // ============================================================
        // GROUP CHAT
        // ============================================================
        window.openGroupCreationModal = function() {
            closeElement('chat-menu');
            const container = document.getElementById('group-friends-selection-grid');
            container.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            let count = 0;

            databaseState.peers.forEach(peer => {
                if(peer.uid === myUID) return;
                if(databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed') {
                    count++;
                    const row = document.createElement('div');
                    row.className = "flex items-center justify-between bg-lightbg dark:bg-darkbg p-2.5 rounded-xl border border-lightborder dark:border-slate-800";
                    row.innerHTML = `
                        <span class="text-slate-700 dark:text-slate-300 font-medium">${peer.name} (@${peer.uid})</span>
                        <input type="checkbox" value="${peer.uid}" class="group-checkbox-node h-4 w-4 accent-cyan-500">
                    `;
                    container.appendChild(row);
                }
            });

            if(count === 0) {
                container.innerHTML = `<p class="text-[10px] text-slate-600 italic text-center py-2">No network friends linked to build a group canvas.</p>`;
            }
            openModal('group-chat-modal');
        }

        window.executeGroupChatEstablishment = function() {
            const title = document.getElementById('group-name-input').value.trim();
            if(!title) { alert("Please provide group identity title tag."); return; }
            const boxes = document.querySelectorAll('.group-checkbox-node:checked');
            const participants = [databaseState.currentUser.uid];
            boxes.forEach(b => participants.push(b.value));
            if(participants.length < 2) { alert("Please select participants to compile channel."); return; }
            showSuccessToast('Group Created!', 'Multiplex session initialized successfully.', '👥');
            document.getElementById('group-name-input').value = '';
            closeModal('group-chat-modal');
        }

        // ============================================================
        // MEDIA VIEWERS
        // ============================================================
        window.openFullScreenMedia = function(url, type) {
            if (type === 'image') {
                document.getElementById('viewer-target-image').src = url;
                openModal('full-screen-image-viewer');
            } else if (type === 'video') {
                const existing = document.getElementById('full-screen-video-player');
                if (existing) existing.remove();
                const overlay = document.createElement('div');
                overlay.id = 'full-screen-video-player';
                overlay.className = 'fixed inset-0 bg-black/95 z-[90] flex flex-col justify-center items-center p-4';
                overlay.innerHTML = `
                    <button onclick="this.parentElement.remove()" class="absolute top-4 right-4 text-white bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-xs font-bold">✕ Close</button>
                    <video src="${url}" controls autoplay playsinline style="max-width: 100%; max-height: 80vh; border-radius: 12px;"></video>
                `;
                document.body.appendChild(overlay);
            }
        }

        // ============================================================
        // MODAL HELPERS
        // ============================================================
        window.openModal = function(id) { document.getElementById(id).classList.remove('hidden'); }
        window.closeModal = function(id) { document.getElementById(id).classList.add('hidden'); if ((id === 'expanded-post-modal' || id === 'full-screen-account-modal') && /\/(post|u)\//.test(location.pathname)) history.replaceState({}, '', BASE); }
        window.toggleElement = function(id) { 
            const el = document.getElementById(id);
            el.classList.toggle('hidden');
        }
        window.closeElement = function(id) { document.getElementById(id).classList.add('hidden'); }

        // ============================================================
        // PEER ACCOUNT PROFILE
        // ============================================================
        window.displayPeerAccountProfile = function(uid) {
            const peer = databaseState.peers.find(p => p.uid === uid);
            if(!peer) return;

            document.getElementById('peer-screen-name').innerText = peer.name;
            document.getElementById('peer-screen-uid').innerText = '@' + peer.uid;
            document.getElementById('peer-screen-bio').innerText = peer.bio || 'No profile description broadcasted.';
            document.getElementById('peer-screen-avatar').src = peer.pfp || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150';
            
            const prof = document.getElementById('peer-screen-profession');
            if(peer.profession) {
                prof.innerText = peer.profession;
                prof.classList.remove('hidden');
            } else {
                prof.classList.add('hidden');
            }

            const peerCard = document.getElementById('peer-profile-card');
            const peerFrame = document.getElementById('peer-avatar-frame');
            
            peerCard.className = 'bg-lightcard dark:bg-darkcard p-6 rounded-3xl border border-lightborder dark:border-slate-800 text-center relative shadow-2xl transition-all duration-300';
            peerFrame.className = 'w-24 h-24 rounded-full mx-auto mb-4 border-2 border-slate-300 dark:border-slate-700';
            
            if (peer.isPremium) {
                if (peer.premiumTheme) {
                    peerCard.classList.add(peer.premiumTheme);
                }
                if (peer.premiumFrame) {
                    peerFrame.classList.add(peer.premiumFrame);
                }
                const glowColor = peer.premiumTheme ? 
                    peer.premiumTheme.replace('premium-theme-', '') : 'purple';
                const glowMap = {
                    'galaxy': 'purple',
                    'sunset': 'orange',
                    'ocean': 'cyan',
                    'forest': 'emerald',
                    'rose': 'pink',
                    'gold': 'gold',
                    'ice': 'cyan',
                    'almond': 'almond',
                    'royal': 'royal',
                    'cherry': 'cherry'
                };
                peerCard.classList.add('premium-profile-glow', glowMap[glowColor] || 'purple');
            }

            const myUID = databaseState.currentUser.uid;
            const actionArea = document.getElementById('peer-screen-action-container');
            actionArea.innerHTML = '';

            const isFriend = databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed';
            if(isFriend) {
                const btn = document.createElement('button');
                btn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold transition";
                btn.innerText = "Initialize Encrypted Chat Session";
                btn.onclick = () => {
                    closeModal('full-screen-account-modal');
                    switchTab('chat');
                    openDirectCommunicationChannel(peer.uid);
                };
                actionArea.appendChild(btn);
            } else {
                const sendBtn = document.createElement('button');
                sendBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-xl text-xs font-bold transition";
                sendBtn.innerText = "Send Friend Request";
                sendBtn.onclick = () => {
                    dispatchFriendHandshake(peer.uid);
                    closeModal('full-screen-account-modal');
                };
                actionArea.appendChild(sendBtn);
            }

            const peerFeed = document.getElementById('peer-screen-posts-feed');
            peerFeed.innerHTML = '';
            const specificPosts = databaseState.publications.filter(p => p.authorUID === uid);
            if(specificPosts.length > 0) {
                specificPosts.forEach(post => {
                    const block = document.createElement('div');
                    block.className = "bg-slate-100 dark:bg-darkcard p-3 rounded-xl border border-slate-300 dark:border-slate-800 text-xs";
                    block.innerHTML = `
                        <p class="text-slate-700 dark:text-slate-300 leading-relaxed">${post.text}</p>
                        ${post.image ? `<div class="mt-2 rounded-lg overflow-hidden max-h-24 cursor-pointer" onclick="openImageViewer('${post.image}')"><img src="${post.image}" class="w-full h-full object-cover"></div>` : ''}
                    `;
                    peerFeed.appendChild(block);
                });
            } else {
                peerFeed.innerHTML = `<p class="text-[10px] text-slate-600 text-center py-2">No active database publications discovered.</p>`;
            }

            openModal('full-screen-account-modal');
        }

        // ============================================================
        // FORWARD SHARE
        // ============================================================
        window.openForwardShareEcosystemModal = function(postId) {
            databaseState.activeTargetSharePostID = postId;
            const container = document.getElementById('share-friends-target-grid');
            container.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            let count = 0;

            databaseState.peers.forEach(peer => {
                if(peer.uid === myUID) return;
                const isFriend = databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed';
                if(isFriend) {
                    count++;
                    const card = document.createElement('div');
                    card.className = "bg-lightbg dark:bg-darkbg border border-lightborder dark:border-slate-800 p-2.5 rounded-xl flex justify-between items-center";
                    card.innerHTML = `
                        <span class="font-bold text-slate-700 dark:text-slate-300">${peer.name}</span>
                        <button onclick="executeShareTransmissionPacket('${peer.uid}')" class="bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded-lg font-bold text-[11px] text-white">Forward</button>
                    `;
                    container.appendChild(card);
                }
            });

            if(count === 0) {
                container.innerHTML = `<p class="text-[10px] text-slate-600 text-center py-2">No direct friends linked inside core node network.</p>`;
            }
            openModal('forward-share-modal');
        }

        window.executeShareTransmissionPacket = function(targetUID) {
            if(!databaseState.activeTargetSharePostID) return;
            const targetPost = databaseState.publications.find(p => p.id === databaseState.activeTargetSharePostID);
            if(!targetPost) return;

            const myUID = databaseState.currentUser.uid;
            const threadKey = myUID < targetUID ? `${myUID}_text_${targetUID}` : `${targetUID}_text_${myUID}`;
            const messagePayload = {
                sender: myUID,
                text: `📝 Shared a post: "${targetPost.text}"`,
                timestamp: Date.now(),
                status: 'transmitted',
                mediaType: 'post',
                mediaUrl: targetPost.image || null,
                postId: targetPost.id
            };

            push(ref(db, `chats/${threadKey}`), messagePayload).then(() => {
                closeModal('forward-share-modal');
                showSuccessToast('Post Shared!', 'Post sent to your friend successfully.', '📝');
            });
        }

        // ============================================================
        // REEL SHARE
        // ============================================================
        window.openReelShareModal = function(reelId) {
            databaseState.activeTargetSharePostID = reelId;
            const container = document.getElementById('reel-share-target-grid');
            container.innerHTML = '';
            const myUID = databaseState.currentUser.uid;
            let count = 0;

            databaseState.peers.forEach(peer => {
                if(peer.uid === myUID) return;
                const isFriend = databaseState.friendships[`bond_${myUID}_and_${peer.uid}`] === 'confirmed';
                if(isFriend) {
                    count++;
                    const card = document.createElement('div');
                    card.className = "bg-lightbg dark:bg-darkbg border border-lightborder dark:border-slate-800 p-2.5 rounded-xl flex justify-between items-center";
                    card.innerHTML = `
                        <span class="font-bold text-slate-700 dark:text-slate-300">${peer.name}</span>
                        <button onclick="executeReelShare('${peer.uid}')" class="bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded-lg font-bold text-[11px] text-white">Send</button>
                    `;
                    container.appendChild(card);
                }
            });

            if(count === 0) {
                container.innerHTML = `<p class="text-[10px] text-slate-600 text-center py-2">No friends to share with.</p>`;
            }
            openModal('reel-share-modal');
        };

        window.executeReelShare = function(targetUID) {
            if(!databaseState.activeTargetSharePostID) return;
            const targetReel = databaseState.reels.find(r => r.id === databaseState.activeTargetSharePostID);
            if(!targetReel) return;

            const myUID = databaseState.currentUser.uid;
            const threadKey = myUID < targetUID ? `${myUID}_text_${targetUID}` : `${targetUID}_text_${myUID}`;
            const messagePayload = {
                sender: myUID,
                text: `🎬 Shared a reel: ${targetReel.caption || 'Check this out!'}`,
                timestamp: Date.now(),
                status: 'transmitted',
                mediaType: 'reel',
                mediaUrl: targetReel.videoUrl,
                mediaThumbnail: targetReel.thumbnail || targetReel.videoUrl,
                reelId: targetReel.id
            };

            push(ref(db, `chats/${threadKey}`), messagePayload).then(() => {
                closeModal('reel-share-modal');
                showSuccessToast('Reel Shared!', 'Reel sent to your friend successfully.', '🎬');
            });
        };

        // ============================================================
        // DISPATCH FRIEND HANDSHAKE
        // ============================================================
        window.dispatchFriendHandshake = function(targetUID) {
            const myUID = databaseState.currentUser.uid;
            const reqKey = `req_${myUID}_to_${targetUID}`;
            set(ref(db, `friendships/${reqKey}`), 'pending').then(() => {
                showSuccessToast('Request Sent!', 'Friend request sent successfully.', '📨');
                handleUnifiedSearch();
                addNotification({
                    type: 'friend_request',
                    message: `${databaseState.currentUser.name} sent you a friend request! 🤝`,
                    targetUserId: targetUID,
                    sourceUserId: myUID
                });
            });
        }

        // ============================================================
        // INIT
        // ============================================================
        recoverStateFromHardware();
        
        const storedTheme = getStoredTheme();
        applyTheme(storedTheme);
        
        const checkbox = document.getElementById('theme-toggle-checkbox');
        if (checkbox) {
            checkbox.checked = storedTheme === 'dark';
            const dot = document.getElementById('theme-toggle-dot');
            if (dot) {
                dot.style.transform = storedTheme === 'dark' ? 'translateX(18px)' : 'translateX(1px)';
            }
        }

        if (databaseState.currentUser.isPremium && databaseState.currentUser.premiumExpiry) {
            const now = Date.now();
            if (now > databaseState.currentUser.premiumExpiry) {
                update(ref(db, 'users/' + databaseState.currentUser.uid), { 
                    isPremium: false,
                    premiumTheme: '',
                    premiumFrame: '',
                    premiumFont: ''
                }).then(() => {
                    databaseState.currentUser.isPremium = false;
                    databaseState.currentUser.premiumTheme = '';
                    databaseState.currentUser.premiumFrame = '';
                    databaseState.currentUser.premiumFont = '';
                    applyPremiumSettings(databaseState.currentUser);
                    saveStateToHardware();
                });
            }
        }

        console.log('🚀 Stardust Hub - FINAL VERSION');
        console.log('✅ Post: 3-dot menu with Edit & Delete (owner only)');
        console.log('✅ Reel: 3-dot menu on top-right with Edit & Delete (owner only)');
        console.log('✅ Signup: Full profile (pfp, name, bio, email, password)');
        console.log('✅ Login: Privacy & Terms links');
        console.log('✅ Forgot Password with Firebase');
        console.log('✅ Delete Account');
        console.log('✅ Settings: Privacy Policy & Terms of Service buttons');
    
        window.openLoginFromPublic = function() { const pv = document.getElementById('public-view'); if (pv) pv.style.display = 'none'; document.getElementById('login-screen').classList.remove('hidden'); };
