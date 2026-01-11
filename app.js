// Moles World - PWA Enhancement Script

class MolesPWA {
    constructor() {
        this.VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE';
        this.notificationInterval = null;
        this.imageRefreshInterval = null;
    }
    
    // Initialize all PWA features
    async init() {
        console.log('Initializing Moles PWA...');
        
        // Register service worker
        await this.registerServiceWorker();
        
        // Request notification permission
        await this.requestNotificationPermission();
        
        // Setup periodic notifications
        this.setupPeriodicNotifications();
        
        // Setup image refresh
        this.setupImageRefresh();
        
        // Setup APK conversion
        this.setupAPKConversion();
        
        // Check if app is installed
        this.checkIfInstalled();
        
        console.log('Moles PWA initialized');
    }
    
    // Register service worker
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registration successful:', registration);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    console.log('ServiceWorker update found');
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New update available
                            this.showUpdateNotification();
                        }
                    });
                });
                
                return registration;
            } catch (error) {
                console.error('ServiceWorker registration failed:', error);
            }
        }
    }
    
    // Request notification permission
    async requestNotificationPermission() {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'default') {
            try {
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    console.log('Notification permission granted');
                    await this.subscribeToPushNotifications();
                }
            } catch (error) {
                console.error('Error requesting notification permission:', error);
            }
        }
    }
    
    // Subscribe to push notifications
    async subscribeToPushNotifications() {
        if (!('serviceWorker' in navigator)) return;
        
        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            
            if (!subscription) {
                const newSubscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this.urlBase64ToUint8Array(this.VAPID_PUBLIC_KEY)
                });
                
                // Send subscription to server (in real app)
                await this.sendSubscriptionToServer(newSubscription);
                console.log('Subscribed to push notifications');
            }
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
        }
    }
    
    // Setup periodic notifications
    setupPeriodicNotifications() {
        // Clear any existing interval
        if (this.notificationInterval) {
            clearInterval(this.notificationInterval);
        }
        
        // Send notification every 2 hours if enabled
        const notificationCheckbox = document.getElementById('factNotifications');
        if (notificationCheckbox && notificationCheckbox.checked) {
            this.notificationInterval = setInterval(() => {
                if (Notification.permission === 'granted') {
                    this.sendRandomNotification();
                }
            }, 2 * 60 * 60 * 1000); // 2 hours
        }
        
        // Update interval when checkbox changes
        if (notificationCheckbox) {
            notificationCheckbox.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.setupPeriodicNotifications();
                } else {
                    clearInterval(this.notificationInterval);
                }
            });
        }
    }
    
    // Send random notification
    sendRandomNotification() {
        const notifications = [
            "Mole tunnels can stretch for hundreds of meters underground!",
            "Did you know? Moles have special hemoglobin for low-oxygen environments.",
            "Moles consume 70-100% of their body weight in worms each day.",
            "Star-nosed moles can identify and eat food in under 0.2 seconds!",
            "Mole fur lies flat in any direction for easy tunnel movement.",
            "Moles help aerate soil and improve water absorption.",
            "A mole's saliva contains a toxin that paralyzes earthworms.",
            "Moles are solitary animals except during mating season.",
            "Moles can dig up to 18 feet of tunnel per hour.",
            "Moles have the highest muscle mass percentage of any mammal.",
            "Some mole species are excellent swimmers.",
            "Moles don't hibernate - they're active year-round.",
            "Mole tunnel systems can cover up to 2.7 acres.",
            "Moles have tiny eyes but aren't completely blind.",
            "Moles play a key role in soil ecology.",
            "European moles detect vibrations through their snouts.",
            "Moles live 3-6 years in the wild.",
            "Mole hills are created from excavated soil.",
            "Moles help control insect populations in gardens.",
            "A mole's front paws rotate for efficient digging."
        ];
        
        const randomNotification = notifications[Math.floor(Math.random() * notifications.length)];
        
        // Show notification
        if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification('Mole Fact!', {
                body: randomNotification,
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-72x72.png',
                tag: 'mole-fact',
                timestamp: Date.now(),
                data: {
                    url: window.location.href,
                    type: 'fact'
                }
            });
            
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
        }
    }
    
    // Setup image refresh every 5 minutes
    setupImageRefresh() {
        // Clear any existing interval
        if (this.imageRefreshInterval) {
            clearInterval(this.imageRefreshInterval);
        }
        
        // Update images every 5 minutes
        this.imageRefreshInterval = setInterval(() => {
            this.refreshMoleImages();
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    // Refresh mole images
    async refreshMoleImages() {
        try {
            // In a real app, fetch new images from API
            const response = await fetch('https://api.unsplash.com/photos/random?query=mole&count=3&client_id=YOUR_UNSPLASH_ACCESS_KEY');
            const images = await response.json();
            
            // Update gallery
            this.updateImageGallery(images);
            
            // Show notification if enabled
            const imageNotifications = document.getElementById('imageNotifications');
            if (imageNotifications && imageNotifications.checked && Notification.permission === 'granted') {
                new Notification('New Mole Images!', {
                    body: 'Fresh mole photos have been added to the gallery',
                    icon: '/icons/icon-192x192.png'
                });
            }
            
            // Update timestamp
            document.getElementById('lastUpdateTime').textContent = new Date().toLocaleTimeString();
            
        } catch (error) {
            console.error('Failed to refresh images:', error);
        }
    }
    
    // Update image gallery
    updateImageGallery(images) {
        const gallery = document.getElementById('imageGallery');
        if (!gallery) return;
        
        // Clear gallery
        gallery.innerHTML = '';
        
        // Add new images
        images.forEach((image, index) => {
            const imageElement = document.createElement('div');
            imageElement.innerHTML = `
                <img src="${image.urls.small}" alt="Mole image ${index + 1}" class="mole-image">
                <p class="image-caption">Photo by ${image.user.name}</p>
            `;
            gallery.appendChild(imageElement);
        });
    }
    
    // Setup APK conversion
    setupAPKConversion() {
        const convertBtn = document.getElementById('convertToAPK');
        if (!convertBtn) return;
        
        convertBtn.addEventListener('click', () => {
            this.convertToAPK();
        });
    }
    
    // Convert PWA to APK
    async convertToAPK() {
        console.log('Starting APK conversion...');
        
        // Show loading state
        const originalText = document.getElementById('convertToAPK').innerHTML;
        document.getElementById('convertToAPK').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Converting...';
        
        try {
            // In a real implementation, you would:
            // 1. Bundle the app
            // 2. Use PWABuilder API
            // 3. Generate signing keys
            // 4. Download APK
            
            // For demo purposes, simulate the process
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Redirect to PWABuilder
            window.open('https://www.pwabuilder.com', '_blank');
            
            // Show success message
            this.showStatus('APK conversion started! Visit PWABuilder to complete the process.', 'success');
            
        } catch (error) {
            console.error('APK conversion failed:', error);
            this.showStatus('Failed to start APK conversion. Please try again.', 'error');
        } finally {
            // Restore button
            document.getElementById('convertToAPK').innerHTML = originalText;
        }
    }
    
    // Check if app is installed
    checkIfInstalled() {
        // Check for display mode
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('App is running in standalone mode');
            document.getElementById('installBtn').style.display = 'none';
            this.showStatus('App is installed and running in standalone mode!', 'success');
        }
        
        // Check for iOS standalone mode
        if (window.navigator.standalone === true) {
            console.log('App is running in iOS standalone mode');
            document.getElementById('installBtn').style.display = 'none';
        }
    }
    
    // Show update notification
    showUpdateNotification() {
        if (confirm('A new version of Moles World is available. Reload to update?')) {
            window.location.reload();
        }
    }
    
    // Show status message
    showStatus(message, type) {
        const statusElement = document.getElementById('statusMessage');
        if (!statusElement) return;
        
        statusElement.textContent = message;
        statusElement.className = 'status-message';
        
        if (type === 'success') {
            statusElement.classList.add('status-success');
        } else if (type === 'error') {
            statusElement.classList.add('status-error');
        }
        
        // Show for 5 seconds
        statusElement.style.display = 'block';
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }
    
    // Helper function for VAPID key conversion
    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/\-/g, '+')
            .replace(/_/g, '/');
        
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    
    // Send subscription to server (placeholder)
    async sendSubscriptionToServer(subscription) {
        // In a real app, send this to your backend
        console.log('Subscription:', JSON.stringify(subscription));
        return Promise.resolve();
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const molesApp = new MolesPWA();
    molesApp.init();
});
