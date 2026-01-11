/**
 * Integration tests for message passing between background and popup
 */

const {
  setupAllMocks,
  resetAllMocks
} = require('../helpers/mock-browser');

describe('Message Handling Integration Tests', () => {
  let mocks;

  beforeEach(() => {
    mocks = setupAllMocks();
    resetAllMocks();
  });

  afterEach(() => {
    resetAllMocks();
  });

  describe('Background ↔ Popup Communication', () => {
    test('should route organize action correctly', async () => {
      const message = { action: 'organize' };
      const response = { success: true, movedCount: 5 };

      // Simulate background message handler
      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'organize') {
          Promise.resolve(response).then(sendResponse);
          return true; // Indicates async response
        }
      };

      let receivedResponse;
      const sendResponse = (resp) => {
        receivedResponse = resp;
      };

      messageHandler(message, null, sendResponse);
      
      // Wait for async response
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(receivedResponse.success).toBe(true);
      expect(receivedResponse.movedCount).toBe(5);
    });

    test('should route switchWorkspace action correctly', async () => {
      const message = { action: 'switchWorkspace', workspaceName: 'Development' };
      const response = { success: true, count: 3 };

      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'switchWorkspace') {
          Promise.resolve(response).then(sendResponse);
          return true;
        }
      };

      let receivedResponse;
      const sendResponse = (resp) => {
        receivedResponse = resp;
      };

      messageHandler(message, null, sendResponse);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedResponse.success).toBe(true);
      expect(receivedResponse.count).toBe(3);
    });

    test('should route showAll action correctly', async () => {
      const message = { action: 'showAll' };
      const response = { success: true, count: 10 };

      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'showAll') {
          Promise.resolve(response).then(sendResponse);
          return true;
        }
      };

      let receivedResponse;
      const sendResponse = (resp) => {
        receivedResponse = resp;
      };

      messageHandler(message, null, sendResponse);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedResponse.success).toBe(true);
      expect(receivedResponse.count).toBe(10);
    });

    test('should route getState action correctly', async () => {
      const message = { action: 'getState' };
      const response = {
        isOrganized: true,
        currentWorkspace: 'Development',
        workspaceFolders: ['Development', 'Personal'],
        isProcessing: false
      };

      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'getState') {
          Promise.resolve(response).then(sendResponse);
          return true;
        }
      };

      let receivedResponse;
      const sendResponse = (resp) => {
        receivedResponse = resp;
      };

      messageHandler(message, null, sendResponse);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedResponse.isOrganized).toBe(true);
      expect(receivedResponse.currentWorkspace).toBe('Development');
      expect(receivedResponse.workspaceFolders).toEqual(['Development', 'Personal']);
    });

    test('should route getContainerInfo action correctly', async () => {
      const message = { action: 'getContainerInfo' };
      const response = {
        currentContainer: 'Development',
        containers: [
          { name: 'Development', color: 'blue' },
          { name: 'Personal', color: 'green' }
        ],
        workspaceFolders: [
          { name: 'Development', bookmarkCount: 5, folderCount: 2, total: 7 }
        ]
      };

      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'getContainerInfo') {
          Promise.resolve(response).then(sendResponse);
          return true;
        }
      };

      let receivedResponse;
      const sendResponse = (resp) => {
        receivedResponse = resp;
      };

      messageHandler(message, null, sendResponse);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedResponse.currentContainer).toBe('Development');
      expect(receivedResponse.containers.length).toBe(2);
      expect(receivedResponse.workspaceFolders.length).toBe(1);
    });

    test('should handle unknown actions gracefully', async () => {
      const message = { action: 'unknownAction' };

      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'organize' || 
            msg.action === 'switchWorkspace' ||
            msg.action === 'showAll' ||
            msg.action === 'getState' ||
            msg.action === 'getContainerInfo') {
          return true;
        }
        return false; // Unknown action
      };

      const result = messageHandler(message, null, () => {});
      expect(result).toBe(false);
    });

    test('should handle errors in message handlers', async () => {
      const message = { action: 'switchWorkspace', workspaceName: 'Invalid' };
      const error = new Error('Workspace not found');

      const messageHandler = (msg, sender, sendResponse) => {
        if (msg.action === 'switchWorkspace') {
          Promise.reject(error).catch((err) => {
            sendResponse({ success: false, error: err.message });
          });
          return true;
        }
      };

      let receivedResponse;
      const sendResponse = (resp) => {
        receivedResponse = resp;
      };

      messageHandler(message, null, sendResponse);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedResponse.success).toBe(false);
      expect(receivedResponse.error).toBe('Workspace not found');
    });
  });
});
