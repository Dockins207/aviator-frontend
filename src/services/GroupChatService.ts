import { io, Socket } from 'socket.io-client';
import { toast } from 'react-hot-toast';
import { AuthService } from '@/app/lib/auth';

// Utility function for generating unique IDs
function generateUniqueId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Define interfaces for type safety
export interface GroupMessage {
  id?: string;
  sender: string;
  message: string;
  media_url?: string | null;
  timestamp: Date;
  integrity?: string;
  status?: 'sent' | 'pending' | 'failed';
}

export interface MessageOptions {
  limit?: number;
  offset?: number;
  hours?: number;
}

class GroupChatService {
  private socket!: Socket;
  private static instance: GroupChatService;
  private offlineQueue: GroupMessage[] = [];
  private LOCAL_STORAGE_KEY = 'group_chat_messages';
  private LOCAL_STORAGE_QUEUE_KEY = 'group_chat_offline_queue';
  private LAST_CLEAR_TIMESTAMP_KEY = 'last_local_messages_clear';
  private CLEAR_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds

  // Restore message deduplication cache
  private messageDedupeCache = new Map<string, number>();
  private MAX_CACHE_SIZE = 500;

  private constructor() {
    this.initializeSocket();
    this.loadOfflineQueue();
    this.setupConnectionListeners();
    
    // Use setTimeout to defer initialization
    setTimeout(() => {
      this.setupPeriodicLocalStorageClear();
    }, 5000); // 5-second delay to ensure everything is set up
  }

  private initializeSocket() {
    const socketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL 
      ? `${process.env.NEXT_PUBLIC_WEBSOCKET_URL}/group-chat` 
      : process.env.NEXT_PUBLIC_FALLBACK_WEBSOCKET_URL || 'http://192.168.0.12:8000/group-chat';
    
    try {
      const token = AuthService.getToken();
      if (!token) {
        throw new Error('No authentication token available');
      }

      this.socket = io(socketUrl, {
        auth: { token },
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 5000
      });
    } catch (error) {
      console.error('❌ Failed to initialize socket:', error);
      toast.error(`Unable to initialize chat: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private setupConnectionListeners() {
    this.socket.on('connect_error', (error) => {
      console.error('🚨 Socket Connection Error:', error);
      toast.error(`Chat connection failed: ${error.message}`);
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('🔌 Socket Disconnected:', reason);
      toast.error('Chat disconnected. Attempting to reconnect...');
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket Connected Successfully');
      this.processOfflineQueue();
    });
  }

  private loadOfflineQueue() {
    try {
      const storedQueue = localStorage.getItem(this.LOCAL_STORAGE_QUEUE_KEY);
      this.offlineQueue = storedQueue ? JSON.parse(storedQueue) : [];
    } catch (error) {
      console.error('Error loading offline queue:', error);
      this.offlineQueue = [];
    }
  }

  private saveOfflineQueue() {
    try {
      localStorage.setItem(this.LOCAL_STORAGE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      console.error('Error saving offline queue:', error);
    }
  }

  private processOfflineQueue() {
    while (this.offlineQueue.length > 0) {
      const message = this.offlineQueue.shift();
      if (message) {
        this.sendMessage(message.message, message.media_url || undefined)
          .then(() => {
            message.status = 'sent';
          })
          .catch(() => {
            message.status = 'failed';
            this.offlineQueue.push(message);
          });
      }
    }
    this.saveOfflineQueue();
  }

  private storeMessage(message: GroupMessage) {
    try {
      const messages = this.getStoredMessages();
      messages.push(message);
      
      // Keep only last 100 messages
      const trimmedMessages = messages.slice(-100);
      
      localStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(trimmedMessages));
    } catch (error) {
      console.error('Error storing message:', error);
    }
  }

  private getStoredMessages(): GroupMessage[] {
    try {
      const stored = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error retrieving stored messages:', error);
      return [];
    }
  }

  private normalizeMessage(message: GroupMessage): GroupMessage {
    // Normalize message to ensure consistent representation
    return {
      ...message,
      id: message.id || generateUniqueId(), // Ensure unique ID
      timestamp: message.timestamp instanceof Date 
        ? message.timestamp 
        : new Date(message.timestamp),
      sender: message.sender || 'Unknown',
      status: message.status || 'sent'
    };
  }

  private generateMessageFingerprint(message: GroupMessage): string {
    // Ensure timestamp is always a Date object
    const timestamp = message.timestamp instanceof Date 
      ? message.timestamp 
      : new Date(message.timestamp || Date.now());

    // Create a unique fingerprint that captures essential message characteristics
    return `${message.sender}:${message.message}:${timestamp.getTime()}`;
  }

  private isDuplicateMessage(message: GroupMessage): boolean {
    const fingerprint = this.generateMessageFingerprint(message);
    const now = Date.now();

    // Check if message exists in cache
    const lastSeenTime = this.messageDedupeCache.get(fingerprint);
    
    // Consider message a duplicate if seen within last 5 seconds
    if (lastSeenTime && (now - lastSeenTime) < 5000) {
      return true;
    }

    // Update cache
    this.messageDedupeCache.set(fingerprint, now);

    // Manage cache size
    if (this.messageDedupeCache.size > this.MAX_CACHE_SIZE) {
      // Get the first key in the cache to remove
      const cacheKeys = Array.from(this.messageDedupeCache.keys());
      if (cacheKeys.length > 0) {
        const oldestKey = cacheKeys[0];
        this.messageDedupeCache.delete(oldestKey);
      }
    }

    return false;
  }

  private setupPeriodicLocalStorageClear() {
    try {
      const storedLastClearTime = localStorage.getItem(this.LAST_CLEAR_TIMESTAMP_KEY);
      const lastClearTime = storedLastClearTime ? parseInt(storedLastClearTime) : 0;
      const currentTime = Date.now();

      // Debug logging
      console.log('Last clear time:', new Date(lastClearTime).toLocaleString());
      console.log('Current time:', new Date(currentTime).toLocaleString());
      console.log('Time since last clear:', (currentTime - lastClearTime) / 1000 / 60, 'minutes');

      // Only set up interval, don't clear immediately
      const clearInterval = setInterval(() => {
        try {
          const now = Date.now();
          const storedLastClearTime = localStorage.getItem(this.LAST_CLEAR_TIMESTAMP_KEY);
          const lastClearTime = storedLastClearTime ? parseInt(storedLastClearTime) : 0;
          
          // Only clear if more than an hour has passed
          if (now - lastClearTime >= this.CLEAR_INTERVAL) {
            this.clearLocalMessages();
          }
        } catch (error) {
          console.error('Periodic local storage clear failed:', error);
        }
      }, this.CLEAR_INTERVAL);

      // Store interval ID to allow potential cancellation
      (this as any)._clearIntervalId = clearInterval;
    } catch (error) {
      console.error('Error setting up periodic local storage clear:', error);
    }
  }

  private clearMessageDedupeCache() {
    this.messageDedupeCache.clear();
  }

  private clearLocalMessages() {
    try {
      // Prevent clearing if messages are less than an hour old
      const storedLastClearTime = localStorage.getItem(this.LAST_CLEAR_TIMESTAMP_KEY);
      const lastClearTime = storedLastClearTime ? parseInt(storedLastClearTime) : 0;
      const currentTime = Date.now();

      if (currentTime - lastClearTime < this.CLEAR_INTERVAL) {
        console.log('Local storage not cleared: Less than an hour since last clear');
        return;
      }

      // Clear messages from local storage
      const existingMessages = localStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (!existingMessages) {
        console.log('No messages to clear');
        return;
      }

      localStorage.removeItem(this.LOCAL_STORAGE_KEY);
      
      // Clear offline queue
      localStorage.removeItem(this.LOCAL_STORAGE_QUEUE_KEY);
      
      // Clear in-memory caches
      this.clearMessageDedupeCache();
      
      // Update last clear timestamp
      localStorage.setItem(this.LAST_CLEAR_TIMESTAMP_KEY, currentTime.toString());
      
      // Optional: Notify user
      toast.success('Local chat history cleared after 1 hour');
    } catch (error) {
      console.error('Error clearing local messages:', error);
      toast.error('Failed to clear local chat history');
    }
  }

  public static getInstance(): GroupChatService {
    if (!GroupChatService.instance) {
      GroupChatService.instance = new GroupChatService();
    }
    return GroupChatService.instance;
  }

  public sendMessage(message: string, id?: string, mediaUrl?: string | null): Promise<GroupMessage> {
    // Ensure message is not empty
    if (!message.trim()) {
      return Promise.reject(new Error('Message cannot be empty'));
    }

    const pendingMessage: GroupMessage = this.normalizeMessage({
      id: id || generateUniqueId(), // Use provided ID or generate a new one
      sender: 'me',
      message: message.trim(), // Trim whitespace
      media_url: mediaUrl || null, // Ensure media_url is either a string or null
      timestamp: new Date(),
      status: 'pending'
    });

    // Store message locally immediately
    this.storeMessage(pendingMessage);

    return new Promise((resolve, reject) => {
      // If socket is disconnected, add to offline queue
      if (!this.socket.connected) {
        this.offlineQueue.push(pendingMessage);
        this.saveOfflineQueue();
        toast.error('Message queued. Will send when connection is restored.');
        reject(new Error('Offline'));
        return;
      }

      // Prepare socket payload, handling optional mediaUrl
      const payload: { 
        id: string, 
        message: string, 
        media_url?: string | null 
      } = { 
        id: pendingMessage.id!, // Use non-null assertion since we just generated it
        message: pendingMessage.message
      };

      // Only add media_url if it's not null or undefined
      if (mediaUrl) {
        payload.media_url = mediaUrl;
      }

      this.socket.emit('send_group_message', payload, (response: GroupMessage) => {
        if (response) {
          const sentMessage = this.normalizeMessage({
            ...pendingMessage,
            ...response,
            status: 'sent'
          });
          
          this.storeMessage(sentMessage);
          resolve(sentMessage);
        } else {
          pendingMessage.status = 'failed';
          this.storeMessage(pendingMessage);
          reject(new Error('Failed to send message'));
        }
      });

      this.socket.once('message_error', (error) => {
        pendingMessage.status = 'failed';
        this.storeMessage(pendingMessage);
        reject(new Error(error.message));
      });
    });
  }

  public sendMessageWithMedia(message: string, mediaUrl?: string | null): Promise<GroupMessage> {
    // Ensure mediaUrl is either a valid string or null
    const safeMediaUrl = mediaUrl && typeof mediaUrl === 'string' && mediaUrl.trim() !== '' ? mediaUrl : null;
    
    // Call sendMessage with the safely handled mediaUrl
    return this.sendMessage(message, undefined, safeMediaUrl);
  }

  public onNewMessage(callback: (message: GroupMessage) => void) {
    this.socket.on('new_group_message', (rawMessage: GroupMessage) => {
      // Normalize and validate incoming message
      const message = this.normalizeMessage(rawMessage);

      // Store new messages locally
      this.storeMessage(message);

      // Check for duplicates before calling callback
      if (!this.isDuplicateMessage(message)) {
        callback(message);
      }
    });
  }

  public getRecentMessages(hours: number = 24): Promise<GroupMessage[]> {
    return new Promise((resolve, reject) => {
      // If socket is connected, fetch from server
      if (this.socket.connected) {
        this.socket.emit('get_recent_group_messages', { hours });

        this.socket.once('recent_group_messages', (serverMessages: GroupMessage[]) => {
          // Clear local storage if server returns empty list
          if (serverMessages.length === 0) {
            this.clearLocalMessages();
          }

          // Normalize server messages
          const normalizedServerMessages = serverMessages.map(this.normalizeMessage);

          // Update local storage with server messages
          normalizedServerMessages.forEach(msg => this.storeMessage(msg));

          resolve(normalizedServerMessages);
        });

        this.socket.once('messages_fetch_error', (error) => {
          // If server fetch fails, return an empty list and clear local storage
          this.clearLocalMessages();
          resolve([]);
        });
      } else {
        // If offline, return an empty list and clear local storage
        this.clearLocalMessages();
        resolve([]);
      }
    });
  }

  public removeNewMessageListener(callback?: (message: GroupMessage) => void) {
    if (callback) {
      this.socket.off('new_group_message', callback);
    } else {
      this.socket.off('new_group_message');
    }
  }

  public disconnect() {
    this.socket.disconnect();
  }

  public checkAndClearLocalStorage() {
    const storedLastClearTime = localStorage.getItem(this.LAST_CLEAR_TIMESTAMP_KEY);
    const lastClearTime = storedLastClearTime ? parseInt(storedLastClearTime) : 0;
    const currentTime = Date.now();
    const timeSinceLastClear = currentTime - lastClearTime;

    console.log(`Time since last clear: ${timeSinceLastClear / 1000 / 60} minutes`);

    if (timeSinceLastClear >= this.CLEAR_INTERVAL) {
      this.clearLocalMessages();
    } else {
      console.log(`Cannot clear. Wait ${(this.CLEAR_INTERVAL - timeSinceLastClear) / 1000 / 60} more minutes.`);
    }
  }

  public cleanup() {
    if ((this as any)._clearIntervalId) {
      clearInterval((this as any)._clearIntervalId);
    }
  }
}

export default GroupChatService;
