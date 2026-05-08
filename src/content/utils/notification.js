/**
 * Notification Utility for Content Script
 * Provides visual feedback for form filling operations
 */

/**
 * Create a notification element
 * @param {string} message - The notification message
 * @param {string} type - The notification type (success, error, info, loading)
 * @returns {HTMLElement} - The notification element
 */
function createNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `ai-form-filler-notification ai-form-filler-${type}`;
  notification.innerHTML = `
    <div class="ai-form-filler-notification-content">
      <span class="ai-form-filler-notification-message">${message}</span>
    </div>
  `;
  
  // Add inline styles for the notification
  Object.assign(notification.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    padding: '16px 24px',
    backgroundColor: getNotificationColor(type),
    color: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: '2147483647',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    maxWidth: '400px',
    animation: 'aiFormFillerSlideIn 0.3s ease-out',
    transition: 'opacity 0.3s ease-out'
  });

  return notification;
}

/**
 * Get notification color based on type
 * @param {string} type - The notification type
 * @returns {string} - The background color
 */
function getNotificationColor(type) {
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    loading: '#f59e0b'
  };
  return colors[type] || colors.info;
}

/**
 * Add animation styles to document
 */
function addAnimationStyles() {
  if (document.getElementById('ai-form-filler-styles')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'ai-form-filler-styles';
  style.textContent = `
    @keyframes aiFormFillerSlideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes aiFormFillerSlideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
    
    .ai-form-filler-notification.ai-form-filler-exit {
      animation: aiFormFillerSlideOut 0.3s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
}

/**
 * Show a notification
 * @param {string} message - The notification message
 * @param {string} type - The notification type (success, error, info, loading)
 * @param {number} duration - Duration in milliseconds (0 for persistent)
 * @returns {HTMLElement} - The notification element
 */
function showNotification(message, type = 'info', duration = 3000) {
  addAnimationStyles();
  
  const notification = createNotification(message, type);
  document.body.appendChild(notification);
  
  console.log(`[Notification] ${type}: ${message}`);
  
  if (duration > 0) {
    setTimeout(() => {
      hideNotification(notification);
    }, duration);
  }
  
  return notification;
}

/**
 * Hide a notification
 * @param {HTMLElement} notification - The notification element
 */
function hideNotification(notification) {
  if (!notification || !notification.parentNode) {
    return;
  }
  
  notification.classList.add('ai-form-filler-exit');
  
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 300);
}

/**
 * Show a loading notification
 * @param {string} message - The loading message
 * @returns {HTMLElement} - The notification element
 */
function showLoading(message = 'Processing...') {
  return showNotification(message, 'loading', 0);
}

/**
 * Update a loading notification
 * @param {HTMLElement} notification - The notification element
 * @param {string} message - The new message
 */
function updateLoading(notification, message) {
  if (!notification) {
    return;
  }
  
  const messageElement = notification.querySelector('.ai-form-filler-notification-message');
  if (messageElement) {
    messageElement.textContent = message;
  }
}

/**
 * Hide loading notification and show result
 * @param {HTMLElement} notification - The loading notification
 * @param {boolean} success - Whether the operation was successful
 * @param {string} message - The result message
 */
function hideLoadingWithResult(notification, success, message) {
  if (!notification) {
    return;
  }
  
  hideNotification(notification);
  
  if (success) {
    showNotification(message, 'success');
  } else {
    showNotification(message, 'error');
  }
}
